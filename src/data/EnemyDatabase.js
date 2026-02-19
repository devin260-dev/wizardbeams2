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

export function generateEnemy(tier) {
  const tierData = BALANCE.enemy.tiers[tier];
  if (!tierData) throw new Error(`Invalid enemy tier: ${tier}`);

  const school_attunement = randomElement(SCHOOLS);
  const element_attunement = randomElement(ELEMENTS);

  // Determine unlocked beam types
  const otherSchools = SCHOOLS.filter(s => s !== school_attunement);
  const shuffledOthers = shuffle(otherSchools);
  const beam_types_unlocked = [school_attunement];
  const additionalBeams = tierData.beam_types_unlocked - 1;
  for (let i = 0; i < additionalBeams && i < shuffledOthers.length; i++) {
    beam_types_unlocked.push(shuffledOthers[i]);
  }

  // Create gems — always include Grey Bolt
  const gems = [createGreyBolt()];
  if (tierData.has_shield) {
    gems.push(createShieldGem());
  }
  const additionalGems = Math.max(0, tierData.gem_count - gems.length);
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
    hp: tierData.hp,
    max_hp: tierData.hp,
    awareness_speed: tierData.awareness_speed,
    beam_types_unlocked,
    reaction_time: tierData.reaction_time,
    has_shield: tierData.has_shield,
    gems,
    gem_slots,
    decision_delay: tierData.decision_delay,
    bonus_open_nodes: tierData.bonus_open_nodes || 0,
    activation_time_multiplier: tierData.activation_time_multiplier || 1.0,
    tier,
    is_boss: false, // stamped true by MapGenerator for the final boss node
  };
}
