import { BALANCE } from '../data/BalanceConfig.js';
import { getSpell } from '../data/SpellDatabase.js';
import { Projectile } from './Projectile.js';
import { ElementSystem } from './ElementSystem.js';
import { NodeState } from './CombatState.js';

export class SpellCaster {
  constructor(combatState, eventBus, playerNetwork, enemyNetwork, playerShield, enemyShield, playerChanneling, enemyChanneling) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.playerNetwork = playerNetwork;
    this.enemyNetwork = enemyNetwork;
    this.playerShield = playerShield;
    this.enemyShield = enemyShield;
    this.playerChanneling = playerChanneling;
    this.enemyChanneling = enemyChanneling;

    this.projectiles = [];
    this.cooldowns = { player: {}, enemy: {} };

    // Targeting state (player only)
    this.targeting = false;
    this.targetingSpellId = null;
    this.targetingSide = null;

    // Earth barrage staggered arrivals
    this.pendingRocks = [];
  }

  enterTargeting(spellId, side = 'player') {
    this.targeting = true;
    this.targetingSpellId = spellId;
    this.targetingSide = side;
  }

  cancelTargeting() {
    this.targeting = false;
    this.targetingSpellId = null;
    this.targetingSide = null;
  }

  isOnCooldown(spellId, side) {
    return (this.cooldowns[side][spellId] || 0) > 0;
  }

  getCooldownRemaining(spellId, side) {
    return Math.max(0, this.cooldowns[side][spellId] || 0);
  }

  castSpell(spellId, targetData, casterSide) {
    const spell = getSpell(spellId);
    if (!spell) return false;

    // Check cooldown
    if (this.isOnCooldown(spellId, casterSide)) return false;

    // Check spell is channeled
    const channeling = casterSide === 'player' ? this.playerChanneling : this.enemyChanneling;
    const sideState = this.state[casterSide];
    const casterNetwork = casterSide === 'player' ? this.playerNetwork : this.enemyNetwork;
    const defenderNetwork = casterSide === 'player' ? this.enemyNetwork : this.playerNetwork;
    const defenderShield = casterSide === 'player' ? this.enemyShield : this.playerShield;
    const defenderSide = casterSide === 'player' ? 'enemy' : 'player';
    const defenderState = this.state[defenderSide];

    // Verify the spell gem is actually channeled
    let isChanneled = false;
    for (const gemId of sideState.channeled_gems) {
      for (const node of Object.values(casterNetwork.nodes)) {
        if (node.gem && node.gem.id === gemId && node.gem.spell_id === spellId) {
          isChanneled = true;
          break;
        }
      }
      if (isChanneled) break;
    }
    if (!isChanneled) return false;

    // Apply cooldown with passive bonus
    const cooldownBonus = casterNetwork.getPassiveBonus('spell_cooldown');
    const cooldownReduction = Math.min(Math.abs(cooldownBonus) / 100, BALANCE.floors.spell_cooldown_reduction);
    this.cooldowns[casterSide][spellId] = spell.cooldown * (1 - cooldownReduction);

    // Get caster staff position for projectile origin
    const isPlayer = casterSide === 'player';
    const wizPos = isPlayer ? BALANCE.wizard.player_position : BALANCE.wizard.enemy_position;
    const staffOff = BALANCE.wizard.staff_tip_offset;
    const startX = wizPos.x + (isPlayer ? staffOff.x : -staffOff.x);
    const startY = wizPos.y + staffOff.y;

    // Handle each spell type
    switch (spellId) {
      case 'grey_bolt':
        this._castGreyBolt(spell, targetData, startX, startY, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide);
        break;
      case 'fireball':
        this._castFireball(spell, targetData, startX, startY, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide);
        break;
      case 'earth_barrage':
        this._castEarthBarrage(spell, targetData, startX, startY, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide);
        break;
      case 'air_choke':
        this._castAirChoke(spell, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide);
        break;
      case 'water_beam':
        this._castWaterBeam(spell, targetData, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide);
        break;
    }

    this.eventBus.emit('spell_cast', { side: casterSide, spellId });
    return true;
  }

  _castGreyBolt(spell, targetData, startX, startY, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide) {
    const targetNode = defenderNetwork.getNode(targetData.nodeId);
    if (!targetNode) return;
    const proj = new Projectile(startX, startY, targetNode.x, targetNode.y,
      spell.travel_speed, spell, targetData.nodeId, casterSide);
    this.projectiles.push(proj);
  }

  _castFireball(spell, targetData, startX, startY, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide) {
    // Target position (center of AOE)
    const tx = targetData.x;
    const ty = targetData.y;
    const proj = new Projectile(startX, startY, tx, ty,
      spell.travel_speed, spell, null, casterSide);
    // Store AOE data on projectile
    proj.isAOE = true;
    proj.aoeRadius = spell.radius;
    proj.defenderNetworkRef = defenderNetwork;
    this.projectiles.push(proj);
  }

  _castEarthBarrage(spell, targetData, startX, startY, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide) {
    const targetNode = defenderNetwork.getNode(targetData.nodeId);
    if (!targetNode) return;

    for (let i = 0; i < spell.rock_count; i++) {
      this.pendingRocks.push({
        delay: i * spell.stagger_delay,
        startX, startY,
        targetX: targetNode.x,
        targetY: targetNode.y,
        speed: spell.travel_speed,
        spell,
        targetNodeId: targetData.nodeId,
        casterSide,
        rockIndex: i,
        shieldBlocked: false,
      });
    }
  }

  _castAirChoke(spell, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide) {
    const shieldUp = defenderShield.sideState.shield_up;

    if (shieldUp) {
      // Shield mitigates to stability drain
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, true, false
      );
      this.eventBus.emit('stability_drain', {
        side: defenderSide,
        amount: spell.stability_drain,
        duration: spell.stability_drain_duration,
      });
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }
    } else {
      // No shield: disrupt crown, third_eye, throat
      for (const nodeId of spell.affected_nodes) {
        const nodeState = defenderNetwork.getState(nodeId);
        if (nodeState && nodeState !== NodeState.DAMAGED) {
          defenderNetwork.disruptNode(nodeId);
        }
      }
      // Element check
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, false, false
      );
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }
    }
  }

  _castWaterBeam(spell, targetData, casterSide, defenderNetwork, defenderShield, defenderState, defenderSide) {
    const shieldUp = defenderShield.sideState.shield_up;

    if (shieldUp) {
      // Shield mitigates to stability drain
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, true, false
      );
      this.eventBus.emit('stability_drain', {
        side: defenderSide,
        amount: spell.stability_drain,
        duration: spell.stability_drain_duration,
      });
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }
    } else {
      // Target node + flood path toward nearest root
      const targetNodeId = targetData.nodeId;
      const nearestRoot = defenderNetwork.findNearestRoot(targetNodeId);
      const path = defenderNetwork.findPath(targetNodeId, nearestRoot);

      // Disrupt target + up to flood_count nodes along path
      const nodesToDisrupt = [targetNodeId];
      for (let i = 1; i <= spell.flood_count && i < path.length; i++) {
        nodesToDisrupt.push(path[i]);
      }

      for (const nodeId of nodesToDisrupt) {
        const nodeState = defenderNetwork.getState(nodeId);
        if (nodeState && nodeState !== NodeState.DAMAGED) {
          defenderNetwork.disruptNode(nodeId);
        }
      }

      // Element check
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, false, false
      );
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }
    }
  }

  _resolveProjectileHit(projectile) {
    const defenderSide = projectile.owner === 'player' ? 'enemy' : 'player';
    const defenderNetwork = projectile.owner === 'player' ? this.enemyNetwork : this.playerNetwork;
    const defenderShield = projectile.owner === 'player' ? this.enemyShield : this.playerShield;
    const defenderState = this.state[defenderSide];
    const spell = projectile.spellData;

    if (projectile.isAOE) {
      // Fireball AOE
      if (defenderShield.canBlock(spell)) {
        // Shield blocks entire fireball
        defenderShield.absorbHit();
        const elementStab = ElementSystem.getSpellStabilityDamage(
          spell.element, defenderState.dominant_element, false, true
        );
        if (elementStab > 0) {
          this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
        }
        return;
      }

      // Find all nodes within radius
      const nodesHit = [];
      for (const [id, node] of Object.entries(defenderNetwork.nodes)) {
        const dx = node.x - projectile.targetX;
        const dy = node.y - projectile.targetY;
        if (dx * dx + dy * dy <= spell.radius * spell.radius) {
          nodesHit.push(id);
        }
      }

      for (const nodeId of nodesHit) {
        defenderNetwork.damageNode(nodeId);
        defenderState.hp -= spell.hp_damage;
      }

      // Single element check for fireball
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, false, true
      );
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }

      this._checkHpDeath(defenderSide, defenderState);
      return;
    }

    // Single target projectile (Grey Bolt or Earth Barrage rock)
    if (defenderShield.canBlock(spell)) {
      defenderShield.absorbHit();
      // Element check after shield breaks (shield is now down)
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, false, true
      );
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }
      return;
    }

    // No shield - hit the node
    const targetNodeId = projectile.targetNodeId;
    if (targetNodeId) {
      defenderNetwork.damageNode(targetNodeId);
      defenderState.hp -= spell.hp_damage;

      // Element check
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, false, true
      );
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }

      this._checkHpDeath(defenderSide, defenderState);
    }
  }

  _resolveEarthRock(rock) {
    const defenderSide = rock.casterSide === 'player' ? 'enemy' : 'player';
    const defenderNetwork = rock.casterSide === 'player' ? this.enemyNetwork : this.playerNetwork;
    const defenderShield = rock.casterSide === 'player' ? this.enemyShield : this.playerShield;
    const defenderState = this.state[defenderSide];
    const spell = rock.spell;

    // Shield roll (only first unblocked rock can be absorbed)
    if (defenderShield.canBlock(spell) && !rock.shieldBlocked) {
      if (Math.random() < spell.hit_chance) {
        defenderShield.absorbHit();
        // Element check after shield absorbs
        const elementStab = ElementSystem.getSpellStabilityDamage(
          spell.element, defenderState.dominant_element, false, true
        );
        if (elementStab > 0) {
          this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
        }
        // Mark remaining rocks so they skip shield
        for (const r of this.pendingRocks) {
          if (r.casterSide === rock.casterSide) r.shieldBlocked = true;
        }
        return;
      }
    }

    // Node hit roll
    if (Math.random() < spell.hit_chance) {
      defenderNetwork.damageNode(rock.targetNodeId);
      defenderState.hp -= spell.hp_damage;

      // Element check per rock hit
      const elementStab = ElementSystem.getSpellStabilityDamage(
        spell.element, defenderState.dominant_element, defenderShield.sideState.shield_up, true
      );
      if (elementStab > 0) {
        this.eventBus.emit('stability_damage', { side: defenderSide, amount: elementStab });
      }

      this._checkHpDeath(defenderSide, defenderState);
    }
  }

  _checkHpDeath(side, sideState) {
    if (sideState.hp <= 0) {
      sideState.hp = 0;
      this.state.combat_over = true;
      this.state.combat_result = side === 'enemy' ? 'player_win' : 'enemy_win';
      this.eventBus.emit('hp_death', { loser: side });
    }
  }

  update(dt) {
    // Tick cooldowns
    for (const side of ['player', 'enemy']) {
      for (const spellId of Object.keys(this.cooldowns[side])) {
        this.cooldowns[side][spellId] = Math.max(0, this.cooldowns[side][spellId] - dt);
      }
    }

    // Process pending rocks (earth barrage stagger)
    for (let i = this.pendingRocks.length - 1; i >= 0; i--) {
      const rock = this.pendingRocks[i];
      rock.delay -= dt;
      if (rock.delay <= 0) {
        // Create projectile for this rock
        const proj = new Projectile(rock.startX, rock.startY, rock.targetX, rock.targetY,
          rock.speed, rock.spell, rock.targetNodeId, rock.casterSide);
        proj.isEarthRock = true;
        proj.rockData = rock;
        this.projectiles.push(proj);
        this.pendingRocks.splice(i, 1);
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      if (proj.hasArrived()) {
        if (proj.isEarthRock) {
          this._resolveEarthRock(proj.rockData);
        } else {
          this._resolveProjectileHit(proj);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  render(renderer, mousePos) {
    // Draw projectiles
    for (const proj of this.projectiles) {
      proj.render(renderer);
    }

    // Draw targeting overlay
    if (this.targeting && mousePos) {
      const spell = getSpell(this.targetingSpellId);
      if (spell && spell.targeting === 'aoe_circle') {
        renderer.drawCircleOutline(mousePos.x, mousePos.y, spell.radius, '#ff880088', 2);
        renderer.drawCircle(mousePos.x, mousePos.y, spell.radius, '#ff880022');
      }
    }
  }
}
