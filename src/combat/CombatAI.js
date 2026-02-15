import { BALANCE } from '../data/BalanceConfig.js';
import { NodeState } from './CombatState.js';
import { SCHOOL_TO_NODE, GEM_SLOT_NODES, BEAM_TYPE_NODES } from './NodeNetwork.js';

export class CombatAI {
  constructor(combatState, eventBus, enemyNetwork, playerNetwork,
    enemyBeamSwitcher, enemyChanneling, enemyShield, spellCaster, enemyData) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.enemyNetwork = enemyNetwork;
    this.playerNetwork = playerNetwork;
    this.beamSwitcher = enemyBeamSwitcher;
    this.channeling = enemyChanneling;
    this.shield = enemyShield;
    this.spellCaster = spellCaster;
    this.enemyData = enemyData;

    this.decisionTimer = 0;
    this.greyBoltTimer = 0;
    this.reactionTimer = 0;
    this.pendingBeamSwitch = null;
  }

  update(dt) {
    this.decisionTimer += dt;
    this.greyBoltTimer += dt;
    this.reactionTimer += dt;

    if (this.decisionTimer < BALANCE.enemy.ai_decision_interval) return;
    this.decisionTimer = 0;

    const es = this.state.enemy;

    this._awarenessAI();
    this._shieldAI(es);
    this._spellAI(es);
    this._beamAI(es);
  }

  _awarenessAI() {
    const network = this.enemyNetwork;
    if (network.awarenessPath.length > 0) return; // Already traveling

    // Priority 1: Repair damaged nodes
    const damaged = network.getDamagedNodes();
    if (damaged.length > 0) {
      // Prioritize spell gem nodes
      const spellDamaged = damaged.filter(n => n.gem && n.gem.spell_id);
      const target = spellDamaged.length > 0 ? spellDamaged[0] : damaged[0];
      network.setAwarenessTarget(target.id);
      return;
    }

    // Priority 2: Activate dormant gem slot nodes with spells
    const dormantGems = network.getDormantNodes().filter(n =>
      GEM_SLOT_NODES.includes(n.id) && n.gem && n.gem.spell_id
    );
    if (dormantGems.length > 0) {
      network.setAwarenessTarget(dormantGems[0].id);
      return;
    }

    // Priority 3: Activate dormant gem slot nodes (for mana)
    const dormantSlots = network.getDormantNodes().filter(n =>
      GEM_SLOT_NODES.includes(n.id)
    );
    if (dormantSlots.length > 0) {
      network.setAwarenessTarget(dormantSlots[0].id);
      return;
    }

    // Priority 4: Activate dormant beam type nodes
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

    // Am I being countered?
    if (es.current_beam_school !== 'neutral' &&
      counterMap[ps.current_beam_school] === es.current_beam_school) {
      if (es.stability > 50) {
        // Try to switch to counter player's beam
        const counterBeam = Object.entries(counterMap).find(([k, v]) => v === ps.current_beam_school);
        if (counterBeam) {
          const beamSchool = counterBeam[0];
          if (this._canSwitchTo(beamSchool, es)) {
            this.beamSwitcher.requestSwitch(beamSchool);
            this.reactionTimer = 0;
            return;
          }
        }
        // Can't counter, go neutral
        this.beamSwitcher.requestSwitch('neutral');
        this.reactionTimer = 0;
        return;
      }
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

    // Is my current beam locked out?
    if (es.locked_beam_types.includes(es.current_beam_school)) {
      for (const school of ['pure', 'order', 'chaos']) {
        if (this._canSwitchTo(school, es)) {
          this.beamSwitcher.requestSwitch(school);
          this.reactionTimer = 0;
          return;
        }
      }
    }
  }

  _canSwitchTo(school, es) {
    if (school === es.current_beam_school) return false;
    if (es.locked_beam_types.includes(school)) return false;
    const beamNode = SCHOOL_TO_NODE[school];
    return this.enemyNetwork.isNodeOpen(beamNode);
  }

  _shieldAI(es) {
    // Try to channel shield if not already
    if (es.shield_state === 'unavailable') {
      // Find shield gem
      for (const node of Object.values(this.enemyNetwork.nodes)) {
        if (node.gem && node.gem.spell_id === 'shield' && node.state === NodeState.OPEN) {
          const mana = this.enemyNetwork.getNodeMana() + 1; // +1 attunement
          if (mana >= 3) {
            this.channeling.requestChannel(node.gem.id);
          }
          break;
        }
      }
    }

    // Raise shield when threats incoming
    if (es.shield_state === 'down') {
      // Check if player has any channeled spells
      const playerHasSpells = this.state.player.channeled_gems.length > 0;
      if (playerHasSpells) {
        this.shield.toggleShield();
      }
    }
  }

  _spellAI(es) {
    // Try to channel Grey Bolt
    const greyBoltChanneled = this._isSpellChanneled('grey_bolt');

    if (!greyBoltChanneled) {
      if (es.stability > 50 && (es.effective_mana || 0) >= 3) {
        for (const node of Object.values(this.enemyNetwork.nodes)) {
          if (node.gem && node.gem.spell_id === 'grey_bolt' && node.state === NodeState.OPEN) {
            this.channeling.requestChannel(node.gem.id);
            break;
          }
        }
      }
    } else {
      // Grey bolt is channeled
      if ((es.effective_mana || 0) < 2) {
        // Unchannel for mana
        for (const node of Object.values(this.enemyNetwork.nodes)) {
          if (node.gem && node.gem.spell_id === 'grey_bolt' && node.state === NodeState.CHANNELED) {
            this.channeling.requestUnchannel(node.gem.id);
            break;
          }
        }
      } else if (this.greyBoltTimer >= BALANCE.enemy.grey_bolt_interval &&
        !this.spellCaster.isOnCooldown('grey_bolt', 'enemy')) {
        // Cast Grey Bolt
        const target = this._pickGreyBoltTarget();
        if (target) {
          this.spellCaster.castSpell('grey_bolt', { nodeId: target }, 'enemy');
          this.greyBoltTimer = 0;
        }
      }
    }
  }

  _isSpellChanneled(spellId) {
    for (const gemId of this.state.enemy.channeled_gems) {
      for (const node of Object.values(this.enemyNetwork.nodes)) {
        if (node.gem && node.gem.id === gemId && node.gem.spell_id === spellId) {
          return true;
        }
      }
    }
    return false;
  }

  _pickGreyBoltTarget() {
    // Weighted random from player nodes
    const candidates = [];
    for (const [id, node] of Object.entries(this.playerNetwork.nodes)) {
      if (node.state === NodeState.DAMAGED) continue; // Already damaged

      let weight = 1;
      if (GEM_SLOT_NODES.includes(id) && node.gem && node.gem.spell_id) {
        weight = 3; // Spell gem nodes
      } else if (BEAM_TYPE_NODES.includes(id)) {
        weight = 2; // Beam type nodes
      }
      if (node.state === NodeState.OPEN || node.state === NodeState.CHANNELED) {
        for (let i = 0; i < weight; i++) {
          candidates.push(id);
        }
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
