import { BALANCE } from '../data/BalanceConfig.js';
import { createGreyBolt, createShieldGem } from '../data/GemDatabase.js';

export class RunState {
  constructor() {
    this.school_attunement = 'pure';
    this.element_attunement = 'fire';
    this.hp = BALANCE.hp.starting_max;
    this.max_hp = BALANCE.hp.starting_max;
    this.gold = 0;
    this.gems = [];
    this.gem_slots = {}; // nodeId -> gemId
    this.current_tier = 1;
    this.map_data = null;
    this.current_node_id = null;
    this.fights_won = 0;
    this.gems_collected = 0;
    this.total_gold_earned = 0;
  }

  startNewRun(school, element) {
    this.school_attunement = school;
    this.element_attunement = element;
    this.hp = BALANCE.hp.starting_max;
    this.max_hp = BALANCE.hp.starting_max;
    this.gold = 0;
    this.gems = [];
    this.gem_slots = {};
    this.current_tier = 1;
    this.map_data = null;
    this.current_node_id = null;
    this.fights_won = 0;
    this.gems_collected = 0;
    this.total_gold_earned = 0;

    // Starting gems
    const greyBolt = createGreyBolt();
    const shield = createShieldGem();
    this.gems.push(greyBolt);
    this.gems.push(shield);
  }

  addGem(gem) {
    this.gems.push(gem);
    this.gems_collected++;
  }

  removeGem(gemId) {
    this.gems = this.gems.filter(g => g.id !== gemId);
    // Remove from slots
    for (const [nodeId, gId] of Object.entries(this.gem_slots)) {
      if (gId === gemId) {
        delete this.gem_slots[nodeId];
      }
    }
  }

  slotGem(gemId, nodeId) {
    // Remove gem from current slot if any
    for (const [nId, gId] of Object.entries(this.gem_slots)) {
      if (gId === gemId) {
        delete this.gem_slots[nId];
      }
    }
    // If node already has a gem, unslot it
    if (this.gem_slots[nodeId]) {
      // Just remove the existing assignment
      delete this.gem_slots[nodeId];
    }
    this.gem_slots[nodeId] = gemId;
  }

  unslotGem(nodeId) {
    delete this.gem_slots[nodeId];
  }

  getUnslottedGems() {
    const slottedIds = new Set(Object.values(this.gem_slots));
    return this.gems.filter(g => !slottedIds.has(g.id));
  }

  spendGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  addGold(amount) {
    this.gold += amount;
    this.total_gold_earned += amount;
  }

  heal(percent) {
    const amount = Math.floor(this.max_hp * percent);
    this.hp = Math.min(this.max_hp, this.hp + amount);
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }
}
