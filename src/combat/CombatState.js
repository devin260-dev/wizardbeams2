import { BALANCE } from '../data/BalanceConfig.js';

export const NodeState = {
  DORMANT: 'dormant',
  OPEN: 'open',
  DAMAGED: 'damaged',
};

export class CombatState {
  constructor() {
    this.reset();
  }

  reset(runState = null, enemyData = null) {
    // Collision
    this.collision_point = BALANCE.beam.collision_start;

    // Player state
    this.player = this._createSideState(runState);
    // Enemy state
    this.enemy = this._createSideState(null, enemyData);

    this.combat_over = false;
    this.combat_result = null; // 'player_win', 'enemy_win'
  }

  _createSideState(runState = null, enemyData = null) {
    const state = {
      // Beam
      current_beam_school: 'neutral',
      beam_switch_state: 'ready', // ready, charging, locked
      beam_switch_timer: 0,
      beam_switch_target: null,

      // Shield
      shield_up: false,
      shield_state: 'unavailable', // unavailable, down, up
      shield_duration_timer: 0,
      shield_school: null, // beam school when shield was raised

      // Stability
      stability: BALANCE.stability.max,

      // HP
      hp: BALANCE.hp.starting_max,
      max_hp: BALANCE.hp.starting_max,

      // Attunements
      school_attunement: 'pure',

      // Active drains (for Air Choke/Water Beam vs shield)
      active_stability_drains: [],

      // Panic bonus (set by AI)
      panic_mana_bonus: 0,
    };

    if (runState) {
      state.hp = runState.hp;
      state.max_hp = runState.max_hp;
      state.school_attunement = runState.school_attunement;
      state.current_beam_school = runState.school_attunement;
    }

    if (enemyData) {
      state.hp = enemyData.hp;
      state.max_hp = enemyData.max_hp;
      state.school_attunement = enemyData.school_attunement;
      state.current_beam_school = enemyData.school_attunement;
    }

    return state;
  }
}
