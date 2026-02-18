import { getSpell } from '../data/SpellDatabase.js';
import { NodeState } from './CombatState.js';

export class SpellBook {
  constructor(sideState, nodeNetwork, side) {
    this.sideState = sideState;
    this.nodeNetwork = nodeNetwork;
    this.side = side;

    this._state = 'idle'; // 'idle', 'charging', 'ready'
    this._selectedIndex = 0;
    this._activeSpellEntry = null;
    this._chargeTimer = 0;
    this._spellCaster = null; // stored at startHold for auto-fire
  }

  // Returns [{gemId, spellId, spell, gem, nodeId}] from Open nodes, excludes shield
  getAvailableSpells() {
    const result = [];
    for (const [nodeId, node] of Object.entries(this.nodeNetwork.nodes)) {
      if (node.state !== NodeState.OPEN) continue;
      if (!node.gem || !node.gem.spell_id) continue;
      if (node.gem.spell_id === 'shield') continue;
      const spell = getSpell(node.gem.spell_id);
      if (!spell) continue;
      result.push({
        gemId: node.gem.id,
        spellId: node.gem.spell_id,
        spell,
        gem: node.gem,
        nodeId,
      });
    }
    return result;
  }

  get activeSpellEntry() {
    return this._activeSpellEntry || this.getSelectedEntry();
  }

  getSelectedEntry() {
    const spells = this.getAvailableSpells();
    if (spells.length === 0) return null;
    const idx = Math.min(this._selectedIndex, spells.length - 1);
    return spells[idx];
  }

  cycleLeft() {
    if (this._state !== 'idle') return;
    const spells = this.getAvailableSpells();
    if (spells.length === 0) return;
    this._selectedIndex = (this._selectedIndex - 1 + spells.length) % spells.length;
  }

  cycleRight() {
    if (this._state !== 'idle') return;
    const spells = this.getAvailableSpells();
    if (spells.length === 0) return;
    this._selectedIndex = (this._selectedIndex + 1) % spells.length;
  }

  startHold(spellCaster) {
    if (this._state !== 'idle') return;
    const entry = this.getSelectedEntry();
    if (!entry) return;
    if (spellCaster.isOnCooldown(entry.spellId, this.side)) return;

    this._state = 'charging';
    this._activeSpellEntry = entry;
    this._chargeTimer = 0;
    this._spellCaster = spellCaster;
    this._updateDebuff();
  }

  cancelHold() {
    if (this._state !== 'charging') return;
    this._state = 'idle';
    this._activeSpellEntry = null;
    this._chargeTimer = 0;
    this._spellCaster = null;
    this._updateDebuff();
  }

  cancelReady() {
    if (this._state !== 'ready') return;
    this._state = 'idle';
    this._activeSpellEntry = null;
    this._chargeTimer = 0;
    this._spellCaster = null;
    this._updateDebuff();
  }

  update(dt) {
    if (this._state === 'charging') {
      this._chargeTimer += dt;
      const entry = this._activeSpellEntry;
      if (entry && this._chargeTimer >= entry.gem.spell_charge_time) {
        this._state = 'ready';
        // Auto-fire immediate spells
        if (entry.spell.targeting === 'immediate' && this._spellCaster) {
          this.resolve({}, this._spellCaster);
          return; // resolve already called _updateDebuff
        }
      }
    }
    this._updateDebuff();
  }

  _updateDebuff() {
    const active = this._state === 'charging' || this._state === 'ready';
    this.sideState.spell_book_debuff_active = active;
    if (active && this._activeSpellEntry) {
      this.sideState.spell_book_debuff_amount = this._activeSpellEntry.gem.spell_mana_debuff;
    } else {
      this.sideState.spell_book_debuff_amount = 0;
    }
  }

  isDebuffActive() {
    return this._state === 'charging' || this._state === 'ready';
  }

  isNodeClickLocked() {
    return this._state === 'ready';
  }

  isReady() { return this._state === 'ready'; }
  isCharging() { return this._state === 'charging'; }
  isIdle() { return this._state === 'idle'; }

  getChargeProgress() {
    if (this._state !== 'charging' || !this._activeSpellEntry) return null;
    const total = this._activeSpellEntry.gem.spell_charge_time;
    return {
      remaining: Math.max(0, total - this._chargeTimer),
      total,
    };
  }

  resolve(targetData, spellCaster) {
    if (this._state !== 'ready') return;
    const entry = this._activeSpellEntry;
    if (!entry) return;
    spellCaster.castSpell(entry.spellId, targetData, this.side);
    this._state = 'idle';
    this._activeSpellEntry = null;
    this._chargeTimer = 0;
    this._spellCaster = null;
    this._updateDebuff();
  }
}
