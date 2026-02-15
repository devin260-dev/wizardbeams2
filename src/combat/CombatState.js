import { BALANCE } from '../data/BalanceConfig.js';

export const NodeState = {
  DORMANT: 'dormant',
  OPEN: 'open',
  CHANNELED: 'channeled',
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

      // Element
      dominant_element: '',
      element_shift_timer: 0,
      pending_dominant_element: '',

      // Shield
      shield_up: false,
      shield_state: 'unavailable', // unavailable, down, up, recharging
      shield_recharge_timer: 0,

      // Stability
      stability: BALANCE.stability.max,

      // Channeling
      channeled_gems: [],
      locked_beam_types: [],

      // HP
      hp: BALANCE.hp.starting_max,
      max_hp: BALANCE.hp.starting_max,

      // Attunements
      school_attunement: 'pure',
      element_attunement: 'fire',

      // Active drains (for Air Choke/Water Beam vs shield)
      active_stability_drains: [],
    };

    if (runState) {
      state.hp = runState.hp;
      state.max_hp = runState.max_hp;
      state.school_attunement = runState.school_attunement;
      state.element_attunement = runState.element_attunement;
      state.current_beam_school = runState.school_attunement;
      state.dominant_element = runState.element_attunement;
    }

    if (enemyData) {
      state.hp = enemyData.hp;
      state.max_hp = enemyData.max_hp;
      state.school_attunement = enemyData.school_attunement;
      state.element_attunement = enemyData.element_attunement;
      state.current_beam_school = enemyData.school_attunement;
      state.dominant_element = enemyData.element_attunement;
    }

    return state;
  }
}
