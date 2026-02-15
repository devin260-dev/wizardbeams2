import { BALANCE } from '../data/BalanceConfig.js';
import { Button, ProgressBar, PipBar } from '../rendering/UIComponents.js';
import { getSpell } from '../data/SpellDatabase.js';
import { NodeState } from './CombatState.js';
import { SCHOOL_TO_NODE } from './NodeNetwork.js';

export class CombatHUD {
  constructor(combatState, eventBus, inputManager, playerNetwork, enemyNetwork,
    beamSwitcher, channelingSystem, spellCaster, shieldSystem) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.input = inputManager;
    this.playerNetwork = playerNetwork;
    this.enemyNetwork = enemyNetwork;
    this.beamSwitcher = beamSwitcher;
    this.channeling = channelingSystem;
    this.spellCaster = spellCaster;
    this.shield = shieldSystem;

    // Beam type buttons
    this.beamButtons = {
      order: new Button(340, 500, 65, 24, 'Order', { color: '#3a0066', hoverColor: '#5500aa' }),
      chaos: new Button(410, 500, 65, 24, 'Chaos', { color: '#665500', hoverColor: '#aa8800' }),
      pure: new Button(480, 500, 65, 24, 'Pure', { color: '#662200', hoverColor: '#aa3300' }),
      neutral: new Button(550, 500, 65, 24, 'Neutral', { color: '#444', hoverColor: '#666' }),
    };

    // Shield button
    this.shieldButton = new Button(625, 500, 65, 24, 'Shield', { color: '#005566', hoverColor: '#0088aa' });

    // Spell buttons will be generated dynamically
    this.spellButtons = [];

    // HP bars
    this.playerHpBar = new PipBar(10, 10, 6, 14, BALANCE.hp.starting_max, { fgColor: '#cc0000', bgColor: '#440000' });
    this.enemyHpBar = new PipBar(560, 10, 6, 14, BALANCE.hp.starting_max, { fgColor: '#cc0000', bgColor: '#440000' });

    // Stability bars
    this.playerStabilityBar = new ProgressBar(10, 30, 200, 10, { fgColor: '#00cc00', bgColor: '#003300' });
    this.enemyStabilityBar = new ProgressBar(750, 30, 200, 10, { fgColor: '#00cc00', bgColor: '#003300' });

    // Mana display positions
    this.playerManaPos = { x: 10, y: 48 };
    this.enemyManaPos = { x: 900, y: 48 };
  }

  _buildSpellButtons() {
    this.spellButtons = [];
    const playerNodes = this.playerNetwork.nodes;
    let btnX = 10;
    const btnY = 470;

    for (const [nodeId, node] of Object.entries(playerNodes)) {
      if (!node.gem || !node.gem.spell_id) continue;
      if (node.gem.spell_id === 'shield') continue; // Shield has its own button

      const spell = getSpell(node.gem.spell_id);
      if (!spell) continue;

      const btn = new Button(btnX, btnY, 80, 22, spell.name, {
        color: '#333', hoverColor: '#555', fontSize: 11,
      });
      btn._gemId = node.gem.id;
      btn._nodeId = nodeId;
      btn._spellId = node.gem.spell_id;
      this.spellButtons.push(btn);
      btnX += 85;
    }
  }

  handleInput() {
    const mouse = this.input.getMousePos();
    const clicked = this.input.wasClicked();
    const clickPos = this.input.getClickPos();
    const ps = this.state.player;

    // Update hover states
    for (const [school, btn] of Object.entries(this.beamButtons)) {
      btn.updateHover(mouse.x, mouse.y);
    }
    this.shieldButton.updateHover(mouse.x, mouse.y);
    for (const btn of this.spellButtons) {
      btn.updateHover(mouse.x, mouse.y);
    }

    if (!clicked) return;

    // Handle targeting mode
    if (this.spellCaster.targeting) {
      const targetNodeId = this.enemyNetwork.getNodeAtPoint(clickPos.x, clickPos.y);
      const spell = getSpell(this.spellCaster.targetingSpellId);

      if (spell && spell.targeting === 'aoe_circle') {
        // Fireball: click anywhere in enemy area
        this.spellCaster.castSpell(this.spellCaster.targetingSpellId,
          { x: clickPos.x, y: clickPos.y }, 'player');
        this.spellCaster.cancelTargeting();
        return;
      }

      if (targetNodeId) {
        this.spellCaster.castSpell(this.spellCaster.targetingSpellId,
          { nodeId: targetNodeId }, 'player');
        this.spellCaster.cancelTargeting();
        return;
      }

      // Click elsewhere cancels targeting
      this.spellCaster.cancelTargeting();
      return;
    }

    // Beam buttons
    for (const [school, btn] of Object.entries(this.beamButtons)) {
      if (btn.isClicked(clickPos.x, clickPos.y)) {
        this.beamSwitcher.requestSwitch(school);
        return;
      }
    }

    // Shield button
    if (this.shieldButton.isClicked(clickPos.x, clickPos.y)) {
      this.shield.toggleShield();
      return;
    }

    // Spell buttons
    for (const btn of this.spellButtons) {
      if (btn.isClicked(clickPos.x, clickPos.y)) {
        const node = this.playerNetwork.getNode(btn._nodeId);
        if (!node) continue;

        if (node.state === NodeState.OPEN && node.gem && node.gem.spell_id) {
          // Request channel
          this.channeling.requestChannel(btn._gemId);
        } else if (node.state === NodeState.CHANNELED) {
          // Cast or enter targeting
          const spell = getSpell(btn._spellId);
          if (!spell) continue;
          if (this.spellCaster.isOnCooldown(btn._spellId, 'player')) continue;

          if (spell.targeting === 'single_node' || spell.targeting === 'aoe_circle') {
            this.spellCaster.enterTargeting(btn._spellId, 'player');
          } else if (spell.targeting === 'immediate') {
            this.spellCaster.castSpell(btn._spellId, {}, 'player');
          }
        }
        return;
      }
    }

    // Click on player node network for awareness
    const playerNodeId = this.playerNetwork.getNodeAtPoint(clickPos.x, clickPos.y);
    if (playerNodeId) {
      this.playerNetwork.setAwarenessTarget(playerNodeId);
      return;
    }
  }

  update(dt) {
    this._buildSpellButtons();
    this._updateButtonStates();
  }

  _updateButtonStates() {
    const ps = this.state.player;

    // Beam buttons
    for (const [school, btn] of Object.entries(this.beamButtons)) {
      if (school === 'neutral') {
        btn.disabled = ps.beam_switch_state !== 'ready' || ps.current_beam_school === 'neutral';
      } else {
        const beamNode = SCHOOL_TO_NODE[school];
        const nodeOpen = this.playerNetwork.isNodeOpen(beamNode);
        const isLocked = ps.locked_beam_types.includes(school);
        btn.disabled = ps.beam_switch_state !== 'ready' || !nodeOpen || isLocked || ps.current_beam_school === school;
      }
    }

    // Shield button
    this.shieldButton.disabled = ps.shield_state === 'unavailable';
    this.shieldButton.text = ps.shield_state === 'up' ? 'Shield ON' :
      ps.shield_state === 'recharging' ? 'Recharge' : 'Shield';

    // Spell buttons
    for (const btn of this.spellButtons) {
      const node = this.playerNetwork.getNode(btn._nodeId);
      if (!node) { btn.disabled = true; continue; }

      if (node.state === NodeState.OPEN && node.gem && node.gem.spell_id) {
        // Can channel
        btn.disabled = this.state.player.channeled_gems.length >= BALANCE.channeling.max_channeled_spells;
        btn.text = 'CH: ' + getSpell(node.gem.spell_id)?.name;
        btn.color = '#335';
      } else if (node.state === NodeState.CHANNELED) {
        const onCd = this.spellCaster.isOnCooldown(btn._spellId, 'player');
        btn.disabled = onCd;
        btn.text = onCd ?
          `${getSpell(btn._spellId)?.name} (${Math.ceil(this.spellCaster.getCooldownRemaining(btn._spellId, 'player'))}s)` :
          getSpell(btn._spellId)?.name;
        btn.color = '#553';
      } else {
        btn.disabled = true;
        btn.text = getSpell(btn._spellId)?.name || '???';
      }
    }
  }

  render(renderer) {
    const ps = this.state.player;
    const es = this.state.enemy;

    // HP bars
    this.playerHpBar.maxPips = ps.max_hp;
    this.playerHpBar.currentPips = Math.max(0, ps.hp);
    this.playerHpBar.render(renderer);

    this.enemyHpBar.maxPips = es.max_hp;
    this.enemyHpBar.currentPips = Math.max(0, es.hp);
    this.enemyHpBar.render(renderer);

    // HP labels
    renderer.drawText(`HP: ${Math.max(0, ps.hp)}/${ps.max_hp}`, 10, 2, '#fff', 10);
    renderer.drawText(`HP: ${Math.max(0, es.hp)}/${es.max_hp}`, 560, 2, '#fff', 10);

    // Stability bars
    this.playerStabilityBar.percent = ps.stability / BALANCE.stability.max;
    this.playerStabilityBar.render(renderer);
    renderer.drawText(`Stability: ${Math.floor(ps.stability)}%`, 12, 31, '#fff', 8);

    this.enemyStabilityBar.percent = es.stability / BALANCE.stability.max;
    this.enemyStabilityBar.render(renderer);
    renderer.drawText(`Stability: ${Math.floor(es.stability)}%`, 752, 31, '#fff', 8);

    // Mana display
    const playerMana = ps.effective_mana !== undefined ? ps.effective_mana : 0;
    const enemyMana = es.effective_mana !== undefined ? es.effective_mana : 0;
    renderer.drawText(`Mana: ${playerMana}`, this.playerManaPos.x, this.playerManaPos.y, '#88ccff', 12);
    renderer.drawText(`Mana: ${enemyMana}`, this.enemyManaPos.x, this.enemyManaPos.y, '#88ccff', 12);

    // Current beam school
    const pSchoolColor = BALANCE.school.colors[ps.current_beam_school]?.hex || '#808080';
    renderer.drawText(`Beam: ${ps.current_beam_school.toUpperCase()}`, 10, 62, pSchoolColor, 12);

    const eSchoolColor = BALANCE.school.colors[es.current_beam_school]?.hex || '#808080';
    renderer.drawText(`Beam: ${es.current_beam_school.toUpperCase()}`, 850, 62, eSchoolColor, 12);

    // Beam switch state
    if (ps.beam_switch_state === 'charging') {
      renderer.drawText(`Charging: ${ps.beam_switch_timer.toFixed(1)}s`, 10, 76, '#ffaa00', 10);
    } else if (ps.beam_switch_state === 'locked') {
      renderer.drawText(`Locked: ${ps.beam_switch_timer.toFixed(1)}s`, 10, 76, '#ff4400', 10);
    }

    // Element indicators
    const pElemColor = BALANCE.element.colors[ps.dominant_element] || '#888';
    renderer.drawCircle(220, 55, 8, pElemColor);
    renderer.drawText(ps.dominant_element || '?', 232, 50, '#fff', 10);
    if (ps.element_shift_timer > 0) {
      renderer.drawText(`→ ${ps.pending_dominant_element}`, 270, 50, '#ffff00', 10);
    }

    const eElemColor = BALANCE.element.colors[es.dominant_element] || '#888';
    renderer.drawCircle(740, 55, 8, eElemColor);
    renderer.drawText(es.dominant_element || '?', 752, 50, '#fff', 10);

    // Beam buttons
    for (const btn of Object.values(this.beamButtons)) {
      btn.render(renderer);
    }

    // Shield button
    this.shieldButton.render(renderer);

    // Spell buttons
    for (const btn of this.spellButtons) {
      btn.render(renderer);
    }

    // Collision point indicator
    renderer.drawText(`Beam: ${Math.floor(this.state.collision_point)}%`, 440, 90, '#fff', 12, 'center');

    // Targeting mode indicator
    if (this.spellCaster.targeting) {
      renderer.drawText('TARGETING - Click enemy node (or click elsewhere to cancel)', 480, 130, '#ffff00', 12, 'center');
    }
  }
}
