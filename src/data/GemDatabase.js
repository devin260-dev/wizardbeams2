import { BALANCE } from './BalanceConfig.js';

let gemIdCounter = 0;

function nextGemId() {
  return 'gem_' + (++gemIdCounter);
}

const ELEMENTS = ['fire', 'water', 'earth', 'air'];
const SCHOOLS = ['pure', 'order', 'chaos'];
const PASSIVE_STATS = [
  { stat: 'awareness_speed', label: 'Awareness Speed', value: BALANCE.passives.awareness_speed_bonus },
  { stat: 'activation_speed', label: 'Activation Speed', value: BALANCE.passives.activation_speed_bonus },
  { stat: 'shield_recharge', label: 'Shield Recharge', value: BALANCE.passives.shield_recharge_bonus },
  { stat: 'beam_switch', label: 'Beam Switch Speed', value: BALANCE.passives.beam_switch_bonus },
  { stat: 'spell_cooldown', label: 'Spell Cooldown', value: BALANCE.passives.spell_cooldown_bonus },
  { stat: 'node_repair', label: 'Node Repair Speed', value: BALANCE.passives.node_repair_bonus },
];

// Spells available for random gem generation (Pure school only for now)
const SPELL_POOL = ['fireball', 'earth_barrage', 'air_choke', 'water_beam'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createGem(element, school, passiveStat, passiveValue, spellId = '') {
  return {
    id: nextGemId(),
    element,
    school,
    passive_stat: passiveStat,
    passive_value: passiveValue,
    spell_id: spellId,
    upgraded: false,
  };
}

export function createGreyBolt() {
  return {
    id: nextGemId(),
    element: '',
    school: 'neutral',
    passive_stat: 'spell_cooldown',
    passive_value: BALANCE.passives.spell_cooldown_bonus,
    spell_id: 'grey_bolt',
    upgraded: false,
  };
}

export function createShieldGem() {
  return {
    id: nextGemId(),
    element: '',
    school: 'neutral',
    passive_stat: 'shield_recharge',
    passive_value: BALANCE.passives.shield_recharge_bonus,
    spell_id: 'shield',
    upgraded: false,
  };
}

export function generateRandomGem(tier = 1) {
  const element = randomElement(ELEMENTS);
  const school = randomElement(SCHOOLS);
  const passive = randomElement(PASSIVE_STATS);

  // Higher tiers increase spell chance
  const spellChance = 0.2 + (tier - 1) * 0.15;
  let spellId = '';
  if (Math.random() < spellChance) {
    // Only assign spells matching the gem's element if Pure school, otherwise no spell
    if (school === 'pure') {
      const elementSpells = {
        fire: 'fireball',
        earth: 'earth_barrage',
        air: 'air_choke',
        water: 'water_beam',
      };
      spellId = elementSpells[element] || '';
    }
  }

  return createGem(element, school, passive.stat, passive.value, spellId);
}

export function generatePenaltyGem() {
  const element = randomElement(ELEMENTS);
  const school = randomElement(SCHOOLS);
  const passive = randomElement(PASSIVE_STATS);
  // Penalty: positive value instead of negative (makes things worse)
  return createGem(element, school, passive.stat, -passive.value, '');
}

export { ELEMENTS, SCHOOLS, PASSIVE_STATS };
