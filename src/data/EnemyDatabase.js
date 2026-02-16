import { BALANCE } from './BalanceConfig.js';
import { createGreyBolt, createShieldGem, generateRandomGem } from './GemDatabase.js';

const SCHOOLS = ['pure', 'order', 'chaos'];
const ELEMENTS = ['fire', 'water', 'earth', 'air'];
const GEM_SLOT_NODES = ['crown', 'third_eye', 'throat', 'left_shoulder', 'right_shoulder', 'left_root', 'right_root'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateEnemy(tier, isElite = false, isBoss = false) {
  const tierData = isBoss ? BALANCE.enemy.boss : BALANCE.enemy.tiers[tier];
  if (!tierData) throw new Error(`Invalid tier: ${tier}`);

  const school_attunement = randomElement(SCHOOLS);
  const element_attunement = randomElement(ELEMENTS);

  let hp = tierData.hp;
  let awareness_speed = tierData.awareness_speed;
  let gem_count = tierData.gem_count;

  if (isElite && !isBoss) {
    hp += BALANCE.enemy.elite.hp_bonus;
    awareness_speed += BALANCE.enemy.elite.awareness_speed_bonus;
    gem_count += BALANCE.enemy.elite.extra_gems;
  }

  // Determine unlocked beam types
  const otherSchools = SCHOOLS.filter(s => s !== school_attunement);
  const shuffledOthers = shuffle(otherSchools);
  const beam_types_unlocked = [school_attunement];
  const additionalBeams = tierData.beam_types_unlocked - 1;
  for (let i = 0; i < additionalBeams && i < shuffledOthers.length; i++) {
    beam_types_unlocked.push(shuffledOthers[i]);
  }

  // Create gems - always include Grey Bolt
  const gems = [createGreyBolt()];
  if (tierData.has_shield) {
    gems.push(createShieldGem());
  }
  // Add random gems up to gem_count
  const additionalGems = Math.max(0, gem_count - gems.length);
  for (let i = 0; i < additionalGems; i++) {
    gems.push(generateRandomGem(tier));
  }

  // Assign gems to random slots
  const gem_slots = {};
  const availableSlots = shuffle(GEM_SLOT_NODES);
  for (let i = 0; i < gems.length && i < availableSlots.length; i++) {
    gem_slots[availableSlots[i]] = gems[i].id;
  }

  return {
    school_attunement,
    element_attunement,
    hp,
    max_hp: hp,
    awareness_speed,
    beam_types_unlocked,
    reaction_time: tierData.reaction_time,
    has_shield: tierData.has_shield,
    gems,
    gem_slots,
    decision_delay: tierData.decision_delay,
    all_nodes_open: tierData.all_nodes_open || false,
    activation_time_multiplier: tierData.activation_time_multiplier || 1.0,
    is_elite: isElite,
    is_boss: isBoss,
    tier,
  };
}
