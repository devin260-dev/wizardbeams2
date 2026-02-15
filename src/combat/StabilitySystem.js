import { BALANCE } from '../data/BalanceConfig.js';
import { NodeState } from './CombatState.js';
import { GEM_SLOT_NODES, BEAM_TYPE_NODES, PATHWAY_NODES } from './NodeNetwork.js';

export class StabilitySystem {
  constructor(sideState, eventBus, nodeNetwork, side) {
    this.sideState = sideState;
    this.eventBus = eventBus;
    this.nodeNetwork = nodeNetwork;
    this.side = side;

    // Listen for stability damage events
    this.eventBus.on('stability_damage', (data) => {
      if (data.side === this.side) {
        this.applyDamage(data.amount);
      }
    });

    this.eventBus.on('stability_drain', (data) => {
      if (data.side === this.side) {
        this.applyDrain(data.amount, data.duration);
      }
    });
  }

  applyDamage(percent) {
    this.sideState.stability = Math.max(0, this.sideState.stability - percent);
    this.eventBus.emit('stability_changed', {
      side: this.side,
      stability: this.sideState.stability,
    });
  }

  applyDrain(totalPercent, duration) {
    this.sideState.active_stability_drains.push({
      remaining: totalPercent,
      rate: totalPercent / duration,
      duration,
      elapsed: 0,
    });
  }

  update(dt) {
    const s = this.sideState;

    // Neutral drain / attack regen
    if (s.current_beam_school === 'neutral') {
      s.stability -= BALANCE.stability.drain_rate * dt;
    } else {
      s.stability += BALANCE.stability.regen_rate * dt;
    }

    // Process active drains (from spell mitigation)
    for (let i = s.active_stability_drains.length - 1; i >= 0; i--) {
      const drain = s.active_stability_drains[i];
      const drainAmount = drain.rate * dt;
      s.stability -= drainAmount;
      drain.remaining -= drainAmount;
      drain.elapsed += dt;
      if (drain.elapsed >= drain.duration || drain.remaining <= 0) {
        s.active_stability_drains.splice(i, 1);
      }
    }

    // Clamp
    s.stability = Math.max(0, Math.min(BALANCE.stability.max, s.stability));

    // Punishment at 0
    if (s.stability <= 0) {
      this._punish();
    }
  }

  _punish() {
    // Pick random undamaged functional node and damage it
    const allNodes = [...GEM_SLOT_NODES, ...BEAM_TYPE_NODES, ...PATHWAY_NODES];
    const candidates = allNodes.filter(id => {
      const state = this.nodeNetwork.getState(id);
      return state !== NodeState.DAMAGED;
    });

    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      this.nodeNetwork.damageNode(target);
      this.eventBus.emit('stability_punishment', {
        side: this.side,
        nodeId: target,
      });
    }

    // Reset stability to 100%
    this.sideState.stability = BALANCE.stability.max;
    this.eventBus.emit('stability_changed', {
      side: this.side,
      stability: this.sideState.stability,
    });
  }
}
