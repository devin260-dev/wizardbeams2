import { BALANCE } from '../data/BalanceConfig.js';

export class ShieldSystem {
  constructor(sideState, eventBus, nodeNetwork, side) {
    this.sideState = sideState;
    this.eventBus = eventBus;
    this.nodeNetwork = nodeNetwork;
    this.side = side;
  }

  isChanneled() {
    return this.sideState.shield_state !== 'unavailable';
  }

  activate() {
    // Called when Shield Gem becomes Channeled
    this.sideState.shield_state = 'down';
    this.sideState.shield_up = false;
    this.sideState.shield_recharge_timer = 0;
  }

  deactivate() {
    // Called when Shield Gem is un-channeled
    this.sideState.shield_state = 'unavailable';
    this.sideState.shield_up = false;
    this.sideState.shield_recharge_timer = 0;
    this.eventBus.emit('shield_state_changed', { side: this.side, state: 'unavailable' });
  }

  toggleShield() {
    const s = this.sideState;
    if (s.shield_state === 'unavailable') return false;

    if (s.shield_state === 'down') {
      s.shield_state = 'up';
      s.shield_up = true;
      this.eventBus.emit('shield_state_changed', { side: this.side, state: 'up' });
      return true;
    }

    if (s.shield_state === 'up') {
      s.shield_state = 'down';
      s.shield_up = false;
      this.eventBus.emit('shield_state_changed', { side: this.side, state: 'down' });
      return true;
    }

    if (s.shield_state === 'recharging') {
      // Can toggle off during recharge
      s.shield_state = 'down';
      s.shield_up = false;
      s.shield_recharge_timer = 0;
      this.eventBus.emit('shield_state_changed', { side: this.side, state: 'down' });
      return true;
    }

    return false;
  }

  canBlock(spell) {
    return this.sideState.shield_state === 'up' && spell.is_projectile;
  }

  absorbHit() {
    const s = this.sideState;
    s.shield_state = 'recharging';
    s.shield_up = false;
    const bonus = this.nodeNetwork.getPassiveBonus('shield_recharge');
    s.shield_recharge_timer = Math.max(BALANCE.floors.shield_recharge, BALANCE.shield.recharge_time + bonus);
    this.eventBus.emit('shield_broke', { side: this.side });
    this.eventBus.emit('shield_state_changed', { side: this.side, state: 'recharging' });
  }

  update(dt) {
    const s = this.sideState;
    if (s.shield_state !== 'recharging') return;

    s.shield_recharge_timer -= dt;
    if (s.shield_recharge_timer <= 0) {
      s.shield_state = 'up';
      s.shield_up = true;
      s.shield_recharge_timer = 0;
      this.eventBus.emit('shield_restored', { side: this.side });
      this.eventBus.emit('shield_state_changed', { side: this.side, state: 'up' });
    }
  }
}
