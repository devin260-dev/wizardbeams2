/**
 * EffectSystem — temporary buff/debuff manager for one combatant.
 *
 * Usage:
 *   effectSystem.apply({ id, stat, type, value, duration, source, ... });
 *   effectSystem.update(dt);
 *   const bonus = effectSystem.getAdditive('awareness_speed');
 *   const mult  = effectSystem.getMultiplier('push_rate');
 *
 * Stat names consumed by other systems:
 *   effective_mana     — additive bonus/penalty (BeamStruggle)
 *   awareness_speed    — additive ms (NodeNetwork)
 *   activation_speed   — additive seconds (NodeNetwork)
 *   node_repair        — additive seconds (NodeNetwork)
 *   beam_switch        — additive seconds (BeamSwitcher)
 *   spell_cooldown     — additive percentage points (SpellCaster)
 *   push_rate          — multiplicative (BeamStruggle)
 *   shield_duration    — additive seconds (ShieldSystem)
 *   stability_drain    — multiplicative (StabilitySystem)
 *   stability_regen    — multiplicative (StabilitySystem)
 *
 * Any stat name is valid — systems query only the names they care about.
 */

export class EffectSystem {
  constructor() {
    /** @type {Effect[]} */
    this.effects = [];
  }

  /**
   * Apply a new effect. If stackable=false (default) and an effect with the
   * same id already exists, the existing effect's duration is refreshed and
   * its value is updated instead of adding a duplicate.
   *
   * @param {Object} def
   * @param {string} def.id          — unique key per effect type
   * @param {string} def.stat        — stat being modified
   * @param {'additive'|'multiplicative'} def.type — how the value combines
   * @param {number} def.value       — modifier value
   * @param {number} def.duration    — seconds (Infinity = until manually removed)
   * @param {string} [def.source]    — what applied it (for bulk removal)
   * @param {boolean} [def.stackable=false] — allow duplicates of same id?
   * @param {Function} [def.onApply]  — called on application
   * @param {Function} [def.onExpire] — called when duration runs out
   */
  apply(def) {
    if (!def.stackable) {
      const existing = this.effects.find(e => e.id === def.id);
      if (existing) {
        existing.duration = def.duration;
        existing.value = def.value;
        return;
      }
    }

    const effect = {
      id: def.id,
      stat: def.stat,
      type: def.type || 'additive',
      value: def.value,
      duration: def.duration,
      source: def.source || def.id,
      stackable: !!def.stackable,
      onApply: def.onApply || null,
      onExpire: def.onExpire || null,
    };

    this.effects.push(effect);
    if (effect.onApply) effect.onApply(effect);
  }

  /** Remove a specific effect by id. Removes all instances if stackable. */
  remove(id) {
    this.effects = this.effects.filter(e => e.id !== id);
  }

  /** Remove every effect that came from a given source. */
  removeBySource(source) {
    this.effects = this.effects.filter(e => e.source !== source);
  }

  /** Remove all effects. */
  clear() {
    this.effects.length = 0;
  }

  /** Does an effect with this id currently exist? */
  has(id) {
    return this.effects.some(e => e.id === id);
  }

  /** Tick durations and expire finished effects. */
  update(dt) {
    for (const e of this.effects) {
      if (e.duration !== Infinity) {
        e.duration -= dt;
      }
    }
    const expired = this.effects.filter(e => e.duration <= 0);
    for (const e of expired) {
      if (e.onExpire) e.onExpire(e);
    }
    this.effects = this.effects.filter(e => e.duration > 0);
  }

  /** Sum of all additive modifiers for a stat. */
  getAdditive(stat) {
    let sum = 0;
    for (const e of this.effects) {
      if (e.stat === stat && e.type === 'additive') {
        sum += e.value;
      }
    }
    return sum;
  }

  /** Product of all multiplicative modifiers for a stat (base = 1.0). */
  getMultiplier(stat) {
    let product = 1.0;
    for (const e of this.effects) {
      if (e.stat === stat && e.type === 'multiplicative') {
        product *= e.value;
      }
    }
    return product;
  }

  /** Get all active effects (read-only snapshot). */
  getAll() {
    return [...this.effects];
  }

  /** Get all active effects for a specific stat. */
  getForStat(stat) {
    return this.effects.filter(e => e.stat === stat);
  }
}
