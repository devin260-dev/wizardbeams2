import { BALANCE } from '../data/BalanceConfig.js';
import { CombatState } from './CombatState.js';
import { NodeNetwork } from './NodeNetwork.js';
import { NodeRenderer } from './NodeRenderer.js';
import { BeamStruggle } from './BeamStruggle.js';
import { BeamSwitcher } from './BeamSwitcher.js';
import { ElementSystem } from './ElementSystem.js';
import { StabilitySystem } from './StabilitySystem.js';
import { ShieldSystem } from './ShieldSystem.js';
import { ChannelingSystem } from './ChannelingSystem.js';
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
    this.playerChanneling = null;
    this.enemyChanneling = null;
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
      false
    );
    this.enemyNetwork.init(
      this.enemyData.school_attunement,
      this.enemyData.gems,
      this.enemyData.gem_slots,
      this.enemyData.all_nodes_open
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

    // Create channeling systems
    this.playerChanneling = new ChannelingSystem(
      this.combatState.player, this.eventBus, this.playerNetwork,
      this.playerBeamSwitcher, this.playerShield, 'player'
    );
    this.enemyChanneling = new ChannelingSystem(
      this.combatState.enemy, this.eventBus, this.enemyNetwork,
      this.enemyBeamSwitcher, this.enemyShield, 'enemy'
    );

    // Create spell caster
    this.spellCaster = new SpellCaster(
      this.combatState, this.eventBus,
      this.playerNetwork, this.enemyNetwork,
      this.playerShield, this.enemyShield,
      this.playerChanneling, this.enemyChanneling
    );

    // Create beam struggle
    this.beamStruggle = new BeamStruggle(
      this.combatState, this.eventBus,
      this.playerNetwork, this.enemyNetwork,
      this.playerChanneling, this.enemyChanneling,
      this.playerElement
    );

    // Create combat HUD
    this.combatHUD = new CombatHUD(
      this.combatState, this.eventBus, this.input,
      this.playerNetwork, this.enemyNetwork,
      this.playerBeamSwitcher, this.playerChanneling,
      this.spellCaster, this.playerShield
    );

    // Create combat AI
    this.combatAI = new CombatAI(
      this.combatState, this.eventBus,
      this.enemyNetwork, this.playerNetwork,
      this.enemyBeamSwitcher, this.enemyChanneling,
      this.enemyShield, this.spellCaster, this.enemyData
    );

    // Listen for beam node damage -> forced neutral
    this.eventBus.on('node_state_changed', (data) => {
      if (data.newState === 'damaged' || data.newState === 'dormant') {
        this._checkBeamNodeLoss(data);
      }
    });

    this.resultTimer = 0;
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

  update(dt) {
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
    this.playerChanneling.update(dt);
    this.enemyChanneling.update(dt);
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
    r.clear('#0a0a2a');

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
    this.spellCaster.render(r, this.input.getMousePos());

    // HUD
    this.combatHUD.render(r);

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
