import { BALANCE } from '../data/BalanceConfig.js';

export class ShieldSystem {
  constructor(sideState, eventBus, nodeNetwork, side) {
    this.sideState = sideState;
    this.eventBus = eventBus;
    this.nodeNetwork = nodeNetwork;
    this.side = side;
  }

  // Called when shield gem enters Open state
  activate() {
    this.sideState.shield_state = 'down';
    this.sideState.shield_up = false;
    this.sideState.shield_duration_timer = 0;
  }

  // Called when shield gem leaves Open state (damaged/dormant)
  deactivate() {
    this.sideState.shield_state = 'unavailable';
    this.sideState.shield_up = false;
    this.sideState.shield_duration_timer = 0;
    this.eventBus.emit('shield_state_changed', { side: this.side, state: 'unavailable' });
  }

  // Called by SpellCaster when shield spell is cast
  raise() {
    const s = this.sideState;
    if (s.shield_state !== 'down') return false;
    s.shield_state = 'up';
    s.shield_up = true;
    s.shield_duration_timer = BALANCE.shield.duration;
    this.eventBus.emit('shield_state_changed', { side: this.side, state: 'up' });
    return true;
  }

  canBlock(spell) {
    return this.sideState.shield_state === 'up' && spell.is_projectile;
  }

  absorbHit() {
    const s = this.sideState;
    s.shield_state = 'down';
    s.shield_up = false;
    s.shield_duration_timer = 0;
    this.eventBus.emit('shield_broke', { side: this.side });
    this.eventBus.emit('shield_state_changed', { side: this.side, state: 'down' });
  }

  update(dt) {
    const s = this.sideState;
    if (s.shield_state !== 'up') return;

    s.shield_duration_timer -= dt;
    if (s.shield_duration_timer <= 0) {
      s.shield_duration_timer = 0;
      s.shield_state = 'down';
      s.shield_up = false;
      this.eventBus.emit('shield_state_changed', { side: this.side, state: 'down' });
    }
  }
}
