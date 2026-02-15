import { BALANCE } from '../data/BalanceConfig.js';
import { NodeState } from './CombatState.js';
import { getSpell } from '../data/SpellDatabase.js';

// Gem school → beam type that gets locked out
const LOCKOUT_MAP = {
  pure: 'chaos',   // Chaos beats Pure, so channeling Pure locks Chaos
  order: 'pure',   // Pure beats Order, so channeling Order locks Pure
  chaos: 'order',  // Order beats Chaos, so channeling Chaos locks Order
  neutral: null,
};

export class ChannelingSystem {
  constructor(sideState, eventBus, nodeNetwork, beamSwitcher, shieldSystem, side) {
    this.sideState = sideState;
    this.eventBus = eventBus;
    this.nodeNetwork = nodeNetwork;
    this.beamSwitcher = beamSwitcher;
    this.shieldSystem = shieldSystem;
    this.side = side;

    // Pending channel requests
    this.pendingChannels = []; // { gemId, nodeId, timer }
  }

  requestChannel(gemId) {
    const s = this.sideState;

    // Find the node with this gem
    let targetNodeId = null;
    for (const [nodeId, node] of Object.entries(this.nodeNetwork.nodes)) {
      if (node.gem && node.gem.id === gemId) {
        targetNodeId = nodeId;
        break;
      }
    }
    if (!targetNodeId) return false;

    const node = this.nodeNetwork.getNode(targetNodeId);
    if (!node || node.state !== NodeState.OPEN) return false;

    // Check gem has a spell
    if (!node.gem.spell_id) return false;

    // Check max channeled limit
    if (s.channeled_gems.length >= BALANCE.channeling.max_channeled_spells) return false;

    // Already pending?
    if (this.pendingChannels.some(p => p.gemId === gemId)) return false;

    // Already channeled?
    if (s.channeled_gems.includes(gemId)) return false;

    // Check if channeling would lock out current beam type
    const gemSchool = node.gem.school;
    const lockout = LOCKOUT_MAP[gemSchool];
    if (lockout && lockout === s.current_beam_school) {
      // Misfire! Force to Neutral, then proceed with channel
      this.beamSwitcher.forcedNeutral();
      this.eventBus.emit('misfire', { side: this.side, gemId });
    }

    // Start channel timer
    this.pendingChannels.push({
      gemId,
      nodeId: targetNodeId,
      timer: BALANCE.channeling.channel_time,
    });

    return true;
  }

  requestUnchannel(gemId) {
    const s = this.sideState;

    // Remove from channeled list
    const idx = s.channeled_gems.indexOf(gemId);
    if (idx === -1) return false;
    s.channeled_gems.splice(idx, 1);

    // Find node and set back to Open
    for (const [nodeId, node] of Object.entries(this.nodeNetwork.nodes)) {
      if (node.gem && node.gem.id === gemId && node.state === NodeState.CHANNELED) {
        this.nodeNetwork.setState(nodeId, NodeState.OPEN);
        break;
      }
    }

    // Check if this was the Shield Gem
    const gem = this._findGem(gemId);
    if (gem && gem.spell_id === 'shield') {
      this.shieldSystem.deactivate();
    }

    // Recalculate lockouts
    this._recalcLockouts();

    this.eventBus.emit('spell_unchanneled', { side: this.side, gemId });
    return true;
  }

  getContinuousManaCost() {
    let cost = 0;
    for (const gemId of this.sideState.channeled_gems) {
      const gem = this._findGem(gemId);
      if (gem && gem.spell_id) {
        const spell = getSpell(gem.spell_id);
        if (spell) cost += spell.mana_cost;
      }
    }
    return cost;
  }

  getLockedBeamTypes() {
    return [...this.sideState.locked_beam_types];
  }

  isGemChanneled(gemId) {
    return this.sideState.channeled_gems.includes(gemId);
  }

  isPendingChannel(gemId) {
    return this.pendingChannels.some(p => p.gemId === gemId);
  }

  update(dt) {
    // Process pending channels
    for (let i = this.pendingChannels.length - 1; i >= 0; i--) {
      const pending = this.pendingChannels[i];
      pending.timer -= dt;

      if (pending.timer <= 0) {
        // Complete the channel
        const node = this.nodeNetwork.getNode(pending.nodeId);
        if (node && node.state === NodeState.OPEN && node.gem) {
          this.nodeNetwork.setState(pending.nodeId, NodeState.CHANNELED);
          this.sideState.channeled_gems.push(pending.gemId);

          // Apply beam lockout
          this._recalcLockouts();

          // If this is the Shield Gem, activate shield system
          if (node.gem.spell_id === 'shield') {
            this.shieldSystem.activate();
          }

          this.eventBus.emit('spell_channeled', {
            side: this.side,
            gemId: pending.gemId,
            spellId: node.gem.spell_id,
          });
        }
        this.pendingChannels.splice(i, 1);
      }
    }
  }

  _recalcLockouts() {
    const locked = new Set();
    for (const gemId of this.sideState.channeled_gems) {
      const gem = this._findGem(gemId);
      if (gem) {
        const lockout = LOCKOUT_MAP[gem.school];
        if (lockout) locked.add(lockout);
      }
    }
    this.sideState.locked_beam_types = [...locked];
  }

  _findGem(gemId) {
    for (const node of Object.values(this.nodeNetwork.nodes)) {
      if (node.gem && node.gem.id === gemId) {
        return node.gem;
      }
    }
    return null;
  }
}

export { LOCKOUT_MAP };
