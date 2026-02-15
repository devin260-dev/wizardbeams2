import { BALANCE } from '../data/BalanceConfig.js';

const ELEMENT_RPS = BALANCE.element.counter_map;

export class ElementSystem {
  constructor(sideState, eventBus, nodeNetwork, side) {
    this.sideState = sideState;
    this.eventBus = eventBus;
    this.nodeNetwork = nodeNetwork;
    this.side = side;
  }

  recalculate() {
    const newDominant = this.nodeNetwork.getDominantElement(this.sideState.element_attunement);

    if (newDominant !== this.sideState.dominant_element) {
      if (this.sideState.pending_dominant_element !== newDominant) {
        this.sideState.pending_dominant_element = newDominant;
        this.sideState.element_shift_timer = BALANCE.element.shift_delay;
      }
    } else {
      // Matches current, cancel pending shift
      this.sideState.pending_dominant_element = '';
      this.sideState.element_shift_timer = 0;
    }
  }

  update(dt) {
    this.recalculate();

    if (this.sideState.element_shift_timer > 0) {
      this.sideState.element_shift_timer -= dt;
      if (this.sideState.element_shift_timer <= 0) {
        this.sideState.dominant_element = this.sideState.pending_dominant_element;
        this.sideState.pending_dominant_element = '';
        this.sideState.element_shift_timer = 0;
        this.eventBus.emit('element_changed', {
          side: this.side,
          element: this.sideState.dominant_element,
        });
      }
    }
  }

  // Static utility methods
  static getMatchup(elementA, elementB) {
    if (!elementA || !elementB || elementA === elementB) return 'neutral';
    if (ELEMENT_RPS[elementA] === elementB) return 'winner_a';
    if (ELEMENT_RPS[elementB] === elementA) return 'winner_b';
    return 'neutral';
  }

  getElementMultiplier(playerElement, enemyElement) {
    const matchup = ElementSystem.getMatchup(playerElement, enemyElement);
    if (matchup === 'winner_a') return BALANCE.element.push_multiplier;
    if (matchup === 'winner_b') return 1.0 / BALANCE.element.push_multiplier;
    return 1.0;
  }

  static getSpellStabilityDamage(spellElement, defenderElement, shieldUp, isProjectile) {
    // No element spells = always neutral
    if (!spellElement) return BALANCE.element.spell_stability_base;

    const matchup = ElementSystem.getMatchup(spellElement, defenderElement);

    if (matchup === 'winner_a') {
      // Spell element beats defender
      return BALANCE.element.spell_stability_counter; // 40%
    } else if (matchup === 'winner_b') {
      // Defender element beats spell
      if (shieldUp && !isProjectile) {
        return 0; // Non-projectile, shield up, defender advantage = clean mitigation
      }
      return BALANCE.element.spell_stability_base; // 10%
    }
    // Neutral
    return BALANCE.element.spell_stability_base; // 10%
  }
}
