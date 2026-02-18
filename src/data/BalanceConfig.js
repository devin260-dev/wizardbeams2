export const BALANCE = {
  beam: {
    collision_start: 50.0,
    push_rate: 1.0,
    beam_min_thickness: 4.0,
    beam_max_thickness: 22.0,
    max_mana: 11,
  },

  school: {
    counter_debuff: 3.0,
    counter_debuff_max: 6.0,
    gem_school_bonus_per_gem: 0.10, // 10% more effective counter debuff per matching Open gem
    colors: {
      order:   { r: 0.93, g: 0.93, b: 0.93, hex: '#eeeeee' },
      chaos:   { r: 0.07, g: 0.07, b: 0.07, hex: '#111111' },
      pure:    { r: 0.83, g: 0.68, b: 0.00, hex: '#d4ae00' },
      neutral: { r: 0.33, g: 0.33, b: 0.33, hex: '#555555' },
    },
    // RPS: order beats chaos, chaos beats pure, pure beats order
    counter_map: {
      order: 'chaos',   // order beats chaos
      chaos: 'pure',    // chaos beats pure
      pure: 'order',    // pure beats order
    },
  },

  beam_switch: {
    charge_time: 0.0,
    lock_time: 5.0,
    neutral_lock_time: 2.0,
    neutral_voluntary_stability: 10.0,
    neutral_forced_stability: 40.0,
  },

  element: {
    push_multiplier: 1.2,
    spell_stability_base: 10.0,
    spell_stability_counter: 40.0,
    shift_delay: 2.0,
    // RPS: fire > earth > air > water > fire
    counter_map: {
      fire: 'earth',
      earth: 'air',
      air: 'water',
      water: 'fire',
    },
    colors: {
      fire: '#ff4400',
      water: '#0088ff',
      earth: '#8b5e3c',
      air: '#eeeeff',
    },
  },

  stability: {
    drain_rate: 12.5,
    regen_rate: 1.0,
    max: 100.0,
  },

  shield: {
    duration: 3.0,
  },

  nodes: {
    activation_time: 2.0,
    repair_time: 3.0,
    awareness_travel_time: 375, // ms between adjacent nodes
    click_radius: 15,
  },

  spells: {
    grey_bolt: {
      mana_cost: 1.0,
      hp_damage: 3,
      cooldown: 5.0,
      travel_speed: 375.0,
    },
    shield: {
      cooldown: 10.0,
    },
    fireball: {
      radius: 40.0,
      mana_cost: 2.0,
      hp_damage_per_node: 3,
      cooldown: 15.0,
      travel_speed: 312.5,
    },
    earth_barrage: {
      rock_count: 4,
      hit_chance: 0.5,
      mana_cost: 2.0,
      hp_damage_per_rock: 3,
      cooldown: 12.0,
      travel_speed: 312.5,
      stagger_delay: 0.1,
    },
    air_choke: {
      mana_cost: 2.0,
      cooldown: 15.0,
      stability_drain: 50.0,
      stability_drain_duration: 3.0,
    },
    water_beam: {
      mana_cost: 2.0,
      cooldown: 15.0,
      flood_count: 2,
      stability_drain: 40.0,
      stability_drain_duration: 3.0,
    },
  },

  hp: {
    starting_max: 30,
  },

  floors: {
    awareness_speed: 100,       // ms minimum
    activation_speed: 0.5,      // seconds minimum
    beam_switch: 0.5,           // seconds minimum
    spell_cooldown_reduction: 0.5, // 50% max reduction
    node_repair: 1.0,           // seconds minimum
  },

  passives: {
    awareness_speed_bonus: -50.0,
    activation_speed_bonus: -0.25,
    beam_switch_bonus: -0.5,
    spell_cooldown_bonus: -10.0,
    node_repair_bonus: -0.5,
  },

  gem: {
    price: 15,
  },

  meta: {
    tier_count: 3,
    nodes_per_tier_min: 4,
    nodes_per_tier_max: 6,
    elites_per_tier: 1,
    rest_site_heal_percent: 0.3,
    gold_reward: { 1: 10, 2: 15, 3: 20 },
    post_combat_gem_offering_count: 3,
  },

  enemy: {
    grey_bolt_interval: 12.0,
    ai_decision_interval: 1.0,
    panic: {
      threshold: 25,       // collision_point <= this triggers panic
      mana_bonus: 5,       // bonus effective mana during panic
      duration: 15.0,      // seconds panic lasts (once per fight)
    },
    // Tier-dependent stats
    tiers: {
      1: {
        hp: 20,
        awareness_speed: 1350,
        beam_types_unlocked: 1,
        reaction_time: 2.0,
        has_shield: false,
        gem_count: 1,
        decision_delay: 1.5,
        activation_time_multiplier: 2.25,
      },
      2: {
        hp: 25,
        awareness_speed: 1200,
        beam_types_unlocked: 2,
        reaction_time: 1.5,
        has_shield: true,
        gem_count: 3,
        decision_delay: 1.0,
        activation_time_multiplier: 2.25,
      },
      3: {
        hp: 30,
        awareness_speed: 1050,
        beam_types_unlocked: 3,
        reaction_time: 1.0,
        has_shield: true,
        gem_count: 5,
        decision_delay: 0.5,
        activation_time_multiplier: 2.25,
      },
    },
    elite: {
      hp_bonus: 10,
      awareness_speed_bonus: -112,
      extra_gems: 1,
    },
    boss: {
      hp: 40,
      awareness_speed: 375,
      beam_types_unlocked: 3,
      reaction_time: 0.5,
      has_shield: true,
      gem_count: 6,
      decision_delay: 0.3,
      bonus_open_nodes: 1,
      activation_time_multiplier: 2.25,
    },
  },

  wizard: {
    player_position: { x: 86, y: 236 },
    enemy_position: { x: 874, y: 236 },
    staff_tip_offset: { x: 44, y: -38 },
    beam_y_offset: -65,
  },
};
