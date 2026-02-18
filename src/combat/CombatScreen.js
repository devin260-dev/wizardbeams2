import { BALANCE } from '../data/BalanceConfig.js';
import { CombatState } from './CombatState.js';
import { NodeNetwork } from './NodeNetwork.js';
import { NodeRenderer } from './NodeRenderer.js';
import { BeamStruggle } from './BeamStruggle.js';
import { BeamSwitcher } from './BeamSwitcher.js';
import { ElementSystem } from './ElementSystem.js';
import { StabilitySystem } from './StabilitySystem.js';
import { ShieldSystem } from './ShieldSystem.js';
import { SpellBook } from './SpellBook.js';
import { SpellCaster } from './SpellCaster.js';
import { CombatHUD } from './CombatHUD.js';
import { CombatAI } from './CombatAI.js';

export class CombatScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.eventBus = eventBus;
    this.input = inputManager;
    this.renderer = renderer;

    this.combatState = null;
    this.playerNetwork = null;
    this.enemyNetwork = null;
    this.playerNodeRenderer = null;
    this.enemyNodeRenderer = null;
    this.beamStruggle = null;
    this.playerBeamSwitcher = null;
    this.enemyBeamSwitcher = null;
    this.playerElement = null;
    this.enemyElement = null;
    this.playerStability = null;
    this.enemyStability = null;
    this.playerShield = null;
    this.enemyShield = null;
    this.playerSpellBook = null;
    this.spellCaster = null;
    this.combatHUD = null;
    this.combatAI = null;

    this.runState = null;
    this.enemyData = null;
    this.resultTimer = 0;
  }

  enter(data) {
    this.runState = data.runState;
    this.enemyData = data.enemyData;
    this.devMode = data.devMode || false;

    // Create combat state
    this.combatState = new CombatState();
    this.combatState.reset(this.runState, this.enemyData);

    // Create node networks
    this.playerNetwork = new NodeNetwork(false, this.eventBus, this.combatState.player);
    this.enemyNetwork = new NodeNetwork(true, this.eventBus, this.combatState.enemy);

    // Initialize networks with gems and attunements
    this.playerNetwork.init(
      this.runState.school_attunement,
      this.runState.gems,
      this.runState.gem_slots,
      0
    );
    this.enemyNetwork.init(
      this.enemyData.school_attunement,
      this.enemyData.gems,
      this.enemyData.gem_slots,
      this.enemyData.bonus_open_nodes || 0
    );

    if (this.enemyData.awareness_speed) {
      this.enemyNetwork.awarenessSpeed = this.enemyData.awareness_speed;
    }
    if (this.enemyData.activation_time_multiplier) {
      this.enemyNetwork.activationTimeMultiplier = this.enemyData.activation_time_multiplier;
    }

    // Create node renderers
    this.playerNodeRenderer = new NodeRenderer(this.renderer);
    this.enemyNodeRenderer = new NodeRenderer(this.renderer);

    // Create beam switchers
    this.playerBeamSwitcher = new BeamSwitcher(this.combatState.player, this.eventBus, this.playerNetwork, 'player');
    this.enemyBeamSwitcher = new BeamSwitcher(this.combatState.enemy, this.eventBus, this.enemyNetwork, 'enemy');

    // Create element systems
    this.playerElement = new ElementSystem(this.combatState.player, this.eventBus, this.playerNetwork, 'player');
    this.enemyElement = new ElementSystem(this.combatState.enemy, this.eventBus, this.enemyNetwork, 'enemy');

    // Create stability systems
    this.playerStability = new StabilitySystem(this.combatState.player, this.eventBus, this.playerNetwork, 'player');
    this.enemyStability = new StabilitySystem(this.combatState.enemy, this.eventBus, this.enemyNetwork, 'enemy');

    // Create shield systems
    this.playerShield = new ShieldSystem(this.combatState.player, this.eventBus, this.playerNetwork, 'player');
    this.enemyShield = new ShieldSystem(this.combatState.enemy, this.eventBus, this.enemyNetwork, 'enemy');

    // Create spell book (player only)
    this.playerSpellBook = new SpellBook(this.combatState.player, this.playerNetwork, 'player');

    // Create spell caster
    this.spellCaster = new SpellCaster(
      this.combatState, this.eventBus,
      this.playerNetwork, this.enemyNetwork,
      this.playerShield, this.enemyShield
    );

    // Create beam struggle
    this.beamStruggle = new BeamStruggle(
      this.combatState, this.eventBus,
      this.playerNetwork, this.enemyNetwork,
      this.playerElement
    );

    // Create combat HUD
    this.combatHUD = new CombatHUD(
      this.combatState, this.eventBus, this.input,
      this.playerNetwork, this.enemyNetwork,
      this.playerBeamSwitcher, this.playerSpellBook,
      this.spellCaster, this.playerShield
    );

    // Create combat AI
    this.combatAI = new CombatAI(
      this.combatState, this.eventBus,
      this.enemyNetwork, this.playerNetwork,
      this.enemyBeamSwitcher,
      this.enemyShield, this.spellCaster, this.enemyData
    );

    // Listen for beam node damage -> forced neutral
    this.eventBus.on('node_state_changed', (data) => {
      if (data.newState === 'damaged' || data.newState === 'dormant') {
        this._checkBeamNodeLoss(data);
      }
    });

    this.resultTimer = 0;
    this.paused = false;
  }

  _checkBeamNodeLoss(data) {
    const { side, nodeId, node } = data;
    if (node.type !== 'beam_type') return;

    const sideState = this.combatState[side];
    // Check if this was the active beam's node
    if (node.beam_school === sideState.current_beam_school) {
      const switcher = side === 'player' ? this.playerBeamSwitcher : this.enemyBeamSwitcher;
      switcher.forcedNeutral();
    }
  }

  _findOpenShieldGem(network) {
    for (const node of Object.values(network.nodes)) {
      if (node.gem && node.gem.spell_id === 'shield' && node.state === 'open') {
        return node.gem;
      }
    }
    return null;
  }

  update(dt) {
    if (this.input.wasKeyPressed(' ') && !this.combatState.combat_over) {
      this.paused = !this.paused;
    }

    if (this.paused) return;

    if (this.combatState.combat_over) {
      this.resultTimer += dt;
      if (this.resultTimer > 2) {
        this._endCombat();
      }
      return;
    }

    // Handle input first
    this.combatHUD.handleInput();

    // Systems update in order
    this.combatAI.update(dt);
    this.playerNetwork.update(dt);
    this.enemyNetwork.update(dt);

    // Shield availability: activate/deactivate based on whether shield gem node is Open
    const pShieldOpen = this._findOpenShieldGem(this.playerNetwork);
    if (pShieldOpen && this.combatState.player.shield_state === 'unavailable') {
      this.playerShield.activate();
    } else if (!pShieldOpen && this.combatState.player.shield_state !== 'unavailable') {
      this.playerShield.deactivate();
    }
    const eShieldOpen = this._findOpenShieldGem(this.enemyNetwork);
    if (eShieldOpen && this.combatState.enemy.shield_state === 'unavailable') {
      this.enemyShield.activate();
    } else if (!eShieldOpen && this.combatState.enemy.shield_state !== 'unavailable') {
      this.enemyShield.deactivate();
    }

    // Spell book update (sets debuff flags read by BeamStruggle)
    this.playerSpellBook.update(dt);

    this.playerBeamSwitcher.update(dt);
    this.enemyBeamSwitcher.update(dt);
    this.playerElement.update(dt);
    this.enemyElement.update(dt);
    this.playerStability.update(dt);
    this.enemyStability.update(dt);
    this.playerShield.update(dt);
    this.enemyShield.update(dt);
    this.spellCaster.update(dt);
    this.beamStruggle.update(dt);
    this.combatHUD.update(dt);

    // Node renderers need time for pulse animations
    this.playerNodeRenderer.update(dt);
    this.enemyNodeRenderer.update(dt);
  }

  render(ctx) {
    const r = this.renderer;

    // Background
    r.clear('#1a1a3a');

    // Wizard sprites (placeholder rectangles)
    this._drawWizard(r, BALANCE.wizard.player_position, false, this.combatState.player);
    this._drawWizard(r, BALANCE.wizard.enemy_position, true, this.combatState.enemy);

    // Beams
    this.beamStruggle.render(r);

    // Node network silhouettes
    this.playerNodeRenderer.renderSilhouette(this.playerNetwork);
    this.enemyNodeRenderer.renderSilhouette(this.enemyNetwork);

    // Node networks
    this.playerNodeRenderer.render(this.playerNetwork);
    this.enemyNodeRenderer.render(this.enemyNetwork);

    // Projectiles
    this.spellCaster.render(r);

    // HUD
    this.combatHUD.render(r);

    // Pause overlay
    if (this.paused) {
      r.drawRect(0, 0, 960, 540, '#000000', 0.5);
      r.drawText('PAUSED', 480, 250, '#ffffff', 40, 'center', 'middle');
      r.drawText('Press SPACE to resume', 480, 300, '#888', 14, 'center', 'middle');
    }

    // Combat result overlay
    if (this.combatState.combat_over) {
      r.drawRect(0, 0, 960, 540, '#000000', 0.5);
      const text = this.combatState.combat_result === 'player_win' ? 'VICTORY!' : 'DEFEAT!';
      const color = this.combatState.combat_result === 'player_win' ? '#00ff00' : '#ff0000';
      r.drawText(text, 480, 250, color, 40, 'center', 'middle');
      r.drawText('Continuing...', 480, 300, '#888', 16, 'center', 'middle');
    }
  }

  _drawWizard(renderer, pos, mirrored, sideState) {
    const x = pos.x;
    const y = pos.y;

    // Body (rectangle)
    const bodyColor = BALANCE.school.colors[sideState.school_attunement]?.hex || '#555';
    renderer.drawRect(x - 15, y - 30, 30, 60, bodyColor, 0.7);

    // Head
    renderer.drawCircle(x, y - 40, 12, '#ddc');

    // Super Saiyan hair (panic mode)
    if (sideState.panic_mana_bonus > 0) {
      const hx = x, hy = y - 40;
      const spikes = [
        // center spike (tallest)
        [{ x: hx - 4, y: hy - 10 }, { x: hx, y: hy - 32 }, { x: hx + 4, y: hy - 10 }],
        // left-center spike
        [{ x: hx - 8, y: hy - 8 }, { x: hx - 7, y: hy - 28 }, { x: hx - 2, y: hy - 10 }],
        // right-center spike
        [{ x: hx + 2, y: hy - 10 }, { x: hx + 7, y: hy - 28 }, { x: hx + 8, y: hy - 8 }],
        // far left spike
        [{ x: hx - 12, y: hy - 4 }, { x: hx - 14, y: hy - 22 }, { x: hx - 6, y: hy - 8 }],
        // far right spike
        [{ x: hx + 6, y: hy - 8 }, { x: hx + 14, y: hy - 22 }, { x: hx + 12, y: hy - 4 }],
        // side left
        [{ x: hx - 13, y: hy }, { x: hx - 18, y: hy - 16 }, { x: hx - 10, y: hy - 5 }],
        // side right
        [{ x: hx + 10, y: hy - 5 }, { x: hx + 18, y: hy - 16 }, { x: hx + 13, y: hy }],
      ];
      for (const spike of spikes) {
        renderer.drawFilledPolygon(spike, '#ffd700', 0.9);
      }
      // Aura glow
      renderer.drawCircleOutline(x, y - 10, 30, '#ffd700', 2);
      renderer.drawCircle(x, y - 10, 30, '#ffd700', 0.08);
    }

    // Staff
    const staffDir = mirrored ? -1 : 1;
    const staffBaseX = x + staffDir * 20;
    const staffTipX = x + BALANCE.wizard.staff_tip_offset.x * staffDir;
    const staffTipY = y + BALANCE.wizard.staff_tip_offset.y;
    renderer.drawLine(staffBaseX, y + 20, staffTipX, staffTipY, '#8b6914', 2);

    // Staff gem (element attunement color)
    const gemColor = BALANCE.element.colors[sideState.element_attunement] || '#888';
    renderer.drawCircle(staffTipX, staffTipY, 4, gemColor);

    // Shield visual
    if (sideState.shield_up) {
      const shieldColor = BALANCE.element.colors[sideState.dominant_element] || '#88ccff';
      renderer.drawCircleOutline(x, y - 10, 25, shieldColor, 2);
      renderer.drawCircle(x, y - 10, 25, shieldColor, 0.15);
    }
  }

  _endCombat() {
    // Update RunState with combat results
    this.runState.hp = Math.max(0, this.combatState.player.hp);

    if (this.devMode) {
      this.sceneManager.changeScene('start');
      return;
    }

    if (this.combatState.combat_result === 'player_win') {
      // Award gold
      const goldReward = BALANCE.meta.gold_reward[this.enemyData.tier] || 10;
      this.runState.gold += goldReward;
      this.sceneManager.changeScene('postcombat', {
        runState: this.runState,
        enemyData: this.enemyData,
        goldReward,
      });
    } else {
      this.sceneManager.changeScene('gameover', {
        runState: this.runState,
        result: 'defeat',
      });
    }
  }

  exit() {
    this.eventBus.clear();
  }
}
