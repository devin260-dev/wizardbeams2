import { BALANCE } from '../data/BalanceConfig.js';
import { SCHOOL_TO_NODE } from './NodeNetwork.js';

export class BeamSwitcher {
  constructor(sideState, eventBus, nodeNetwork, side) {
    this.sideState = sideState;
    this.eventBus = eventBus;
    this.nodeNetwork = nodeNetwork;
    this.side = side;
  }

  requestSwitch(school) {
    const s = this.sideState;

    // Can't switch while locked or charging
    if (s.beam_switch_state !== 'ready') return false;

    // Same school
    if (school === s.current_beam_school) return false;

    if (school === 'neutral') {
      // Voluntary neutral switch - instant
      s.current_beam_school = 'neutral';
      s.beam_switch_state = 'locked';
      s.beam_switch_timer = BALANCE.beam_switch.neutral_lock_time;
      s.beam_switch_target = null;
      this.eventBus.emit('beam_switch_completed', { side: this.side, school: 'neutral' });
      this.eventBus.emit('stability_damage', {
        side: this.side,
        amount: BALANCE.beam_switch.neutral_voluntary_stability,
      });
      return true;
    }

    // Attack beam switch
    // Check if beam node is Open
    const beamNode = SCHOOL_TO_NODE[school];
    if (!this.nodeNetwork.isNodeOpen(beamNode)) return false;

    // Begin charging
    const bonus = this.nodeNetwork.getPassiveBonus('beam_switch');
    const chargeTime = Math.max(BALANCE.floors.beam_switch, BALANCE.beam_switch.charge_time + bonus);

    s.beam_switch_state = 'charging';
    s.beam_switch_timer = chargeTime;
    s.beam_switch_target = school;
    this.eventBus.emit('beam_switch_started', { side: this.side, school });
    return true;
  }

  forcedNeutral() {
    const s = this.sideState;
    s.current_beam_school = 'neutral';
    s.beam_switch_state = 'locked';
    s.beam_switch_timer = BALANCE.beam_switch.neutral_lock_time;
    s.beam_switch_target = null;
    this.eventBus.emit('forced_neutral', { side: this.side });
    this.eventBus.emit('beam_switch_completed', { side: this.side, school: 'neutral' });
    this.eventBus.emit('stability_damage', {
      side: this.side,
      amount: BALANCE.beam_switch.neutral_forced_stability,
    });
  }

  update(dt) {
    const s = this.sideState;
    if (s.beam_switch_state === 'ready') return;

    s.beam_switch_timer -= dt;
    if (s.beam_switch_timer <= 0) {
      if (s.beam_switch_state === 'charging') {
        // Charge complete - activate new beam, enter lock
        s.current_beam_school = s.beam_switch_target;
        s.beam_switch_state = 'locked';
        s.beam_switch_timer = BALANCE.beam_switch.lock_time;
        this.eventBus.emit('beam_switch_completed', {
          side: this.side,
          school: s.beam_switch_target,
        });
        s.beam_switch_target = null;
      } else if (s.beam_switch_state === 'locked') {
        // Lock expired
        s.beam_switch_state = 'ready';
        s.beam_switch_timer = 0;
      }
    }
  }
}
