import { BALANCE } from '../data/BalanceConfig.js';
import { NodeState } from './CombatState.js';
import { GEM_SLOT_NODES, BEAM_TYPE_NODES } from './NodeNetwork.js';

export class CombatAI {
  constructor(combatState, eventBus, enemyNetwork, playerNetwork,
    enemyBeamSwitcher, enemyShield, spellCaster, enemyData) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.enemyNetwork = enemyNetwork;
    this.playerNetwork = playerNetwork;
    this.beamSwitcher = enemyBeamSwitcher;
    this.shield = enemyShield;
    this.spellCaster = spellCaster;
    this.enemyData = enemyData;

    this.decisionTimer = 0;
    this.greyBoltTimer = 0;
    this.reactionTimer = 0;
    this.pendingBeamSwitch = null;

    // Panic system (once per fight)
    this.panicActive = false;
    this.panicTimer = 0;
    this.panicUsed = false;

    // Shield reaction system
    this.shieldReacting = false;     // true = noticed a projectile, counting down
    this.shieldReactionTimer = 0;
    this.shieldDecided = false;      // true = already rolled for this volley
  }

  update(dt) {
    this.decisionTimer += dt;
    this.greyBoltTimer += dt;
    this.reactionTimer += dt;

    // Panic system
    this._updatePanic(dt);

    // Shield runs every frame (needs fast reaction timing)
    this._shieldAI(dt);

    if (this.decisionTimer < BALANCE.enemy.ai_decision_interval) return;
    this.decisionTimer = 0;

    const es = this.state.enemy;

    this._awarenessAI();
    this._spellAI(es);
    this._beamAI(es);
  }

  _updatePanic(dt) {
    const es = this.state.enemy;
    const panicCfg = BALANCE.enemy.panic;

    if (this.panicActive) {
      this.panicTimer -= dt;
      if (this.panicTimer <= 0) {
        this.panicActive = false;
        es.panic_mana_bonus = 0;
      }
    } else if (!this.panicUsed) {
      const enemyRemaining = 100 - this.state.collision_point; // how far beam is from enemy's side
      if (enemyRemaining <= panicCfg.threshold) {
        this.panicActive = true;
        this.panicUsed = true;
        this.panicTimer = panicCfg.duration;
        es.panic_mana_bonus = panicCfg.mana_bonus;
      }
    }
  }

  _awarenessAI() {
    const network = this.enemyNetwork;
    if (network.awarenessPath.length > 0) return; // Already traveling

    // Don't abandon a node that's more than 50% activated/repaired
    const currentNode = network.nodes[network.awarenessNode];
    if (currentNode && currentNode.activation_progress > 0.5 &&
        (currentNode.state === NodeState.DORMANT || currentNode.state === NodeState.DAMAGED)) {
      return;
    }

    const es = this.state.enemy;
    const ps = this.state.player;
    const counterMap = BALANCE.school.counter_map;
    const onNeutral = es.current_beam_school === 'neutral';
    const beamsMatch = !onNeutral && es.current_beam_school === ps.current_beam_school;
    const beingCountered = !onNeutral && counterMap[ps.current_beam_school] === es.current_beam_school;
    const needsEscape = onNeutral || beamsMatch || beingCountered;

    // Priority 0: If being countered, matching beams, or on neutral — rush a beam node
    // Prefer the counter beam node (the school that beats the player's current beam)
    if (needsEscape) {
      const counterSchool = Object.entries(counterMap).find(([k, v]) => v === ps.current_beam_school);
      const preferredSchool = counterSchool ? counterSchool[0] : null;
      const preferredNode = preferredSchool ? network.getNodeForSchool(preferredSchool) : null;

      // Check if preferred counter node needs repair or activation
      if (preferredNode) {
        const node = network.nodes[preferredNode];
        if (node && node.state === NodeState.DAMAGED) {
          network.setAwarenessTarget(preferredNode);
          return;
        }
        if (node && node.state === NodeState.DORMANT) {
          network.setAwarenessTarget(preferredNode);
          return;
        }
      }

      // Fallback: any beam node that's not our current school
      const otherBeamNodes = BEAM_TYPE_NODES.filter(id => {
        const node = network.nodes[id];
        return node.beam_school && node.beam_school !== es.current_beam_school &&
          (node.state === NodeState.DAMAGED || node.state === NodeState.DORMANT);
      });
      if (otherBeamNodes.length > 0) {
        network.setAwarenessTarget(otherBeamNodes[0]);
        return;
      }
    }

    // Priority 1: Repair damaged Grey Bolt / Shield nodes
    const damagedCore = network.getDamagedNodes().filter(n =>
      n.gem && (n.gem.spell_id === 'grey_bolt' || n.gem.spell_id === 'shield')
    );
    if (damagedCore.length > 0) {
      network.setAwarenessTarget(damagedCore[0].id);
      return;
    }

    // Priority 2: Activate dormant Grey Bolt / Shield nodes
    const dormantCore = network.getDormantNodes().filter(n =>
      GEM_SLOT_NODES.includes(n.id) && n.gem &&
      (n.gem.spell_id === 'grey_bolt' || n.gem.spell_id === 'shield')
    );
    if (dormantCore.length > 0) {
      network.setAwarenessTarget(dormantCore[0].id);
      return;
    }

    // Priority 3: Repair other damaged nodes
    const damaged = network.getDamagedNodes();
    if (damaged.length > 0) {
      const spellDamaged = damaged.filter(n => n.gem && n.gem.spell_id);
      const target = spellDamaged.length > 0 ? spellDamaged[0] : damaged[0];
      network.setAwarenessTarget(target.id);
      return;
    }

    // Priority 4: Activate other dormant spell gem nodes
    const dormantGems = network.getDormantNodes().filter(n =>
      GEM_SLOT_NODES.includes(n.id) && n.gem && n.gem.spell_id
    );
    if (dormantGems.length > 0) {
      network.setAwarenessTarget(dormantGems[0].id);
      return;
    }

    // Priority 5: Activate dormant gem slot nodes (for mana)
    const dormantSlots = network.getDormantNodes().filter(n =>
      GEM_SLOT_NODES.includes(n.id)
    );
    if (dormantSlots.length > 0) {
      network.setAwarenessTarget(dormantSlots[0].id);
      return;
    }

    // Priority 6: Activate dormant beam type nodes
    const dormantBeams = network.getDormantNodes().filter(n =>
      BEAM_TYPE_NODES.includes(n.id)
    );
    if (dormantBeams.length > 0) {
      network.setAwarenessTarget(dormantBeams[0].id);
      return;
    }
  }

  _beamAI(es) {
    if (es.beam_switch_state !== 'ready') return;
    if (this.reactionTimer < this.enemyData.reaction_time) return;

    const ps = this.state.player;
    const counterMap = BALANCE.school.counter_map;

    const onNeutral = es.current_beam_school === 'neutral';
    const beamsMatch = !onNeutral && es.current_beam_school === ps.current_beam_school;
    const beingCountered = !onNeutral && counterMap[ps.current_beam_school] === es.current_beam_school;

    // Top priority: escape neutral, matching beams, or being countered
    if (onNeutral || beamsMatch || beingCountered) {
      // Prefer the beam that counters the player
      const counterEntry = Object.entries(counterMap).find(([k, v]) => v === ps.current_beam_school);
      if (counterEntry && this._canSwitchTo(counterEntry[0], es)) {
        this.beamSwitcher.requestSwitch(counterEntry[0]);
        this.reactionTimer = 0;
        return;
      }
      // Otherwise take any available beam that's different from current
      for (const school of ['pure', 'order', 'chaos']) {
        if (this._canSwitchTo(school, es)) {
          this.beamSwitcher.requestSwitch(school);
          this.reactionTimer = 0;
          return;
        }
      }
      // No alternative beam available — awareness AI will work on opening one
      return;
    }

    // Can I counter the player?
    if (ps.current_beam_school !== 'neutral') {
      const myCounter = Object.entries(counterMap).find(([k, v]) => v === ps.current_beam_school);
      if (myCounter) {
        const beamSchool = myCounter[0];
        if (beamSchool !== es.current_beam_school && this._canSwitchTo(beamSchool, es)) {
          this.beamSwitcher.requestSwitch(beamSchool);
          this.reactionTimer = 0;
          return;
        }
      }
    }
  }

  _canSwitchTo(school, es) {
    if (school === es.current_beam_school) return false;
    const beamNode = this.enemyNetwork.getNodeForSchool(school);
    return beamNode && this.enemyNetwork.isNodeOpen(beamNode);
  }

  _shieldAI(dt) {
    const es = this.state.enemy;
    const tierData = BALANCE.enemy.tiers[this.enemyData.tier] || {};

    // Shield must be available (gem Open, state 'down', off cooldown)
    if (es.shield_state !== 'down' || this.spellCaster.isOnCooldown('shield', 'enemy')) {
      this.shieldReacting = false;
      this.shieldDecided = false;
      return;
    }

    // Check for incoming projectiles
    const hasIncoming = this.spellCaster.projectiles.some(p => p.owner === 'player')
      || this.spellCaster.pendingRocks.some(r => r.casterSide === 'player');

    if (!hasIncoming) {
      // Nothing incoming — reset so we can react to the next volley
      this.shieldReacting = false;
      this.shieldDecided = false;
      return;
    }

    // Already decided not to block this volley
    if (this.shieldDecided) return;

    // Start reacting if we haven't yet
    if (!this.shieldReacting) {
      this.shieldReacting = true;
      this.shieldReactionTimer = tierData.shield_reaction_time || 1.0;
      return;
    }

    // Count down reaction time
    this.shieldReactionTimer -= dt;
    if (this.shieldReactionTimer > 0) return;

    // Reaction time elapsed — roll to see if we actually block
    this.shieldDecided = true;
    const chance = tierData.shield_block_chance || 0.5;
    if (Math.random() < chance) {
      this.spellCaster.castSpell('shield', {}, 'enemy');
    }
  }

  _spellAI(es) {
    if (this.greyBoltTimer >= BALANCE.enemy.grey_bolt_interval &&
        !this.spellCaster.isOnCooldown('grey_bolt', 'enemy')) {
      for (const node of Object.values(this.enemyNetwork.nodes)) {
        if (node.gem && node.gem.spell_id === 'grey_bolt' && node.state === NodeState.OPEN) {
          const target = this._pickGreyBoltTarget();
          if (target) {
            this.spellCaster.castSpell('grey_bolt', { nodeId: target }, 'enemy');
            this.greyBoltTimer = 0;
          }
          break;
        }
      }
    }
  }

  _pickGreyBoltTarget() {
    const tier = this.enemyData.tier || 1;
    const candidates = [];

    for (const [id, node] of Object.entries(this.playerNetwork.nodes)) {
      if (node.state !== NodeState.OPEN) continue;

      // Tier 1: pure random targeting (all nodes equal)
      // Tier 2+: weighted toward high-value targets
      let weight = 1;
      if (tier >= 2) {
        if (GEM_SLOT_NODES.includes(id) && node.gem && node.gem.spell_id) {
          weight = tier; // Higher tiers focus spell gems more
        } else if (BEAM_TYPE_NODES.includes(id)) {
          weight = tier >= 3 ? 2 : 1;
        }
      }

      for (let i = 0; i < weight; i++) {
        candidates.push(id);
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
