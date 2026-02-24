import { BALANCE } from '../data/BalanceConfig.js';
import { Button, ProgressBar, PipBar } from '../rendering/UIComponents.js';
import { NodeState } from './CombatState.js';
import { SCHOOL_TO_NODE } from './NodeNetwork.js';

export class CombatHUD {
  constructor(combatState, eventBus, inputManager, playerNetwork, enemyNetwork,
    beamSwitcher, runeDrawing, spellCaster, shieldSystem) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.input = inputManager;
    this.playerNetwork = playerNetwork;
    this.enemyNetwork = enemyNetwork;
    this.beamSwitcher = beamSwitcher;
    this.runeDrawing = runeDrawing;
    this.spellCaster = spellCaster;
    this.shield = shieldSystem;

    // Beam type buttons — Order, Pure, Chaos
    this.beamButtons = {
      order: new Button(370, 494, 65, 24, 'Order', { color: '#555555', hoverColor: '#777777' }),
      pure: new Button(440, 494, 65, 24, 'Pure', { color: '#5a4400', hoverColor: '#7a6000' }),
      chaos: new Button(510, 494, 65, 24, 'Chaos', { color: '#111111', hoverColor: '#252525' }),
    };

    // HP bars
    this.playerHpBar = new PipBar(10, 10, 6, 14, BALANCE.hp.starting_max, { fgColor: '#cc0000', bgColor: '#440000' });
    this.enemyHpBar = new PipBar(560, 10, 6, 14, BALANCE.hp.starting_max, { fgColor: '#cc0000', bgColor: '#440000' });

    // Stability bars
    this.playerStabilityBar = new ProgressBar(10, 30, 200, 10, { fgColor: '#00cc00', bgColor: '#003300' });
    this.enemyStabilityBar = new ProgressBar(750, 30, 200, 10, { fgColor: '#00cc00', bgColor: '#003300' });
  }

  _pointInButton(btn, x, y) {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
  }

  _pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  _findOpenShieldGem() {
    for (const node of Object.values(this.playerNetwork.nodes)) {
      if (node.gem && node.gem.spell_id === 'shield' && node.state === NodeState.OPEN) {
        return node.gem;
      }
    }
    return null;
  }

  /**
   * Check if a point is over a valid target area for the current targeting spell.
   * Prevents mouseDown from cancelling targeting when click is on a valid target.
   */
  _isOverTargetArea(x, y, spell) {
    if (!spell) return false;
    if (spell.targeting === 'single_node') {
      return !!this.enemyNetwork.getNodeAtPoint(x, y);
    }
    if (spell.targeting === 'aoe_circle') {
      const bounds = this.enemyNetwork.getBounds();
      return this._pointInRect(x, y, bounds);
    }
    return false;
  }

  /**
   * Check if a point is over any interactive HUD element (beam buttons, player nodes).
   * Used to decide whether mouseDown should start rune drawing or be handled normally.
   */
  _isOverInteractive(x, y) {
    // Beam buttons
    for (const btn of Object.values(this.beamButtons)) {
      if (this._pointInButton(btn, x, y)) return true;
    }
    // Player node network
    if (this.playerNetwork.getNodeAtPoint(x, y)) return true;
    return false;
  }

  handleInput() {
    const mouse = this.input.getMousePos();
    const clicked = this.input.wasClicked();
    const clickPos = this.input.getClickPos();
    const isMouseDown = this.input.isMouseDown();
    const justPressed = this.input.wasMouseJustPressed();

    // Update hover states for beam buttons
    for (const btn of Object.values(this.beamButtons)) {
      btn.updateHover(mouse.x, mouse.y);
    }

    // Beam switch hotkeys: Q=Order, W=Pure, E=Chaos, S=Neutral
    if (this.input.wasKeyPressed('q') || this.input.wasKeyPressed('Q')) {
      this.beamSwitcher.requestSwitch('order');
    }
    if (this.input.wasKeyPressed('w') || this.input.wasKeyPressed('W')) {
      this.beamSwitcher.requestSwitch('pure');
    }
    if (this.input.wasKeyPressed('e') || this.input.wasKeyPressed('E')) {
      this.beamSwitcher.requestSwitch('chaos');
    }

    // ── Rune drawing state machine ──────────────────────────────────

    // If currently drawing, accumulate points or finish on release
    if (this.runeDrawing.isDrawing()) {
      if (isMouseDown) {
        this.runeDrawing.addPoint(mouse.x, mouse.y);
      } else {
        // Mouse released — attempt recognition
        this.runeDrawing.finishDrawing();
      }
      return; // block all other input during drawing
    }

    // If in targeting mode, handle target click
    if (this.runeDrawing.isTargeting()) {
      const spell = this.runeDrawing.getTargetingSpell();

      if (justPressed) {
        // Check if mouseDown is on a valid target — if so, let the click resolve it
        const isOnTarget = this._isOverTargetArea(mouse.x, mouse.y, spell);
        if (!isOnTarget) {
          // Not on a target — cancel targeting, optionally start drawing
          this.runeDrawing.cancelTargeting();
          if (!this._isOverInteractive(mouse.x, mouse.y)) {
            this.runeDrawing.startDrawing(mouse.x, mouse.y);
          }
          return;
        }
      }

      if (clicked && spell) {
        if (spell.targeting === 'single_node') {
          const nodeId = this.enemyNetwork.getNodeAtPoint(clickPos.x, clickPos.y);
          if (nodeId) {
            this.runeDrawing.resolveTarget({ nodeId });
          } else {
            this.runeDrawing.cancelTargeting();
          }
        } else if (spell.targeting === 'aoe_circle') {
          const bounds = this.enemyNetwork.getBounds();
          if (this._pointInRect(clickPos.x, clickPos.y, bounds)) {
            this.runeDrawing.resolveTarget({ x: clickPos.x, y: clickPos.y });
          } else {
            this.runeDrawing.cancelTargeting();
          }
        }
      }
      return; // block other clicks during targeting
    }

    // ── Start rune drawing on mouseDown in empty space ──────────────

    if (justPressed && !this._isOverInteractive(mouse.x, mouse.y)) {
      this.runeDrawing.startDrawing(mouse.x, mouse.y);
      return;
    }

    // ── Normal click handling (beam buttons, node clicks) ───────────

    if (!clicked) return;

    // Beam buttons
    for (const [school, btn] of Object.entries(this.beamButtons)) {
      if (btn.isClicked(clickPos.x, clickPos.y)) {
        this.beamSwitcher.requestSwitch(school);
        return;
      }
    }

    // Click on player node network for awareness
    if (!this.runeDrawing.isNodeClickLocked()) {
      const playerNodeId = this.playerNetwork.getNodeAtPoint(clickPos.x, clickPos.y);
      if (playerNodeId) {
        this.playerNetwork.setAwarenessTarget(playerNodeId);
        return;
      }
    }
  }

  update(dt) {
    this.runeDrawing.update(dt);
    this._updateButtonStates();

    // Cursor management
    const canvas = document.querySelector('canvas');
    if (canvas) {
      if (this.runeDrawing.isTargeting()) {
        canvas.style.cursor = 'crosshair';
      } else if (this.runeDrawing.isDrawing()) {
        canvas.style.cursor = 'none';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  }

  _updateButtonStates() {
    const ps = this.state.player;

    // Beam buttons
    for (const [school, btn] of Object.entries(this.beamButtons)) {
      const beamNode = SCHOOL_TO_NODE[school];
      const nodeOpen = this.playerNetwork.isNodeOpen(beamNode);
      btn.disabled = ps.beam_switch_state !== 'ready' || !nodeOpen || ps.current_beam_school === school;
    }
  }

  _renderManaBreakdown(renderer, breakdown, anchorX, y, side) {
    if (!breakdown) return;

    const segs = [];
    segs.push({ text: `${breakdown.nodes}n`,          color: '#999999' });
    if (breakdown.counterDebuff > 0) segs.push({ text: `-${breakdown.counterDebuff}ctr`, color: '#ff4444' });
    if (breakdown.panic         > 0) segs.push({ text: `+${breakdown.panic}!`,           color: '#ffd700' });

    const step = 34;

    if (side === 'player') {
      const n = segs.length;
      for (let i = 0; i < n; i++) {
        const x = anchorX - (n - 1 - i) * step;
        renderer.drawText(segs[i].text, x, y, segs[i].color, 9, 'center', 'middle');
      }
    } else {
      for (let i = 0; i < segs.length; i++) {
        const x = anchorX + i * step;
        renderer.drawText(segs[i].text, x, y, segs[i].color, 9, 'center', 'middle');
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

    // ── Centred mana panel ─────────────────────────────────────────
    const cx = 480;
    const manaGap = 14;
    const playerMana = ps.effective_mana !== undefined ? ps.effective_mana : 0;
    const enemyMana  = es.effective_mana !== undefined ? es.effective_mana  : 0;

    const pManaSize = Math.max(7, Math.min(22, Math.round(8 + playerMana * 1.3)));
    const eManaSize = Math.max(7, Math.min(22, Math.round(8 + enemyMana  * 1.3)));
    renderer.drawText(`Mana: ${playerMana}`, cx - manaGap, 106, '#88ccff', pManaSize, 'right', 'middle');
    renderer.drawText(`Mana: ${enemyMana}`,  cx + manaGap, 106, '#88ccff', eManaSize, 'left',  'middle');

    this._renderManaBreakdown(renderer, ps.mana_breakdown, cx - manaGap, 120, 'player');
    this._renderManaBreakdown(renderer, es.mana_breakdown, cx + manaGap, 120, 'enemy');

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

    // ── Spell Status Panel (replaces Spell Book Widget) ─────────────
    renderer.drawRect(183, 437, 116, 90, '#111', 0.7);
    renderer.drawRectOutline(183, 437, 116, 90, '#444');

    const spells = this.runeDrawing.getAvailableSpells();
    if (spells.length > 0) {
      let sy = 445;
      for (const s of spells) {
        const elemColor = BALANCE.element.colors[s.spell.element] || '#aaa';
        const name = s.spell.name;
        const cdText = s.cooldownRemaining > 0 ? ` ${s.cooldownRemaining.toFixed(1)}s` : '';
        const color = s.cooldownRemaining > 0 ? '#ff4444' : elemColor;
        renderer.drawText(`${name}${cdText}`, 191, sy, color, 9);
        sy += 12;
      }
    } else {
      renderer.drawText('No spells', 241, 470, '#555', 10, 'center', 'middle');
    }

    // Shield status line
    const shieldCd = this.spellCaster.getCooldownRemaining('shield', 'player');
    if (ps.shield_state === 'up') {
      renderer.drawText(`Shield Up: ${ps.shield_duration_timer.toFixed(1)}s`, 191, 515, '#00ccff', 9);
    } else if (shieldCd > 0) {
      renderer.drawText(`Shield CD: ${shieldCd.toFixed(1)}s`, 191, 515, '#ff4444', 9);
    }

    // ── Rune drawing trail + feedback ───────────────────────────────
    this.runeDrawing.render(renderer);

    // ── Targeting overlays ──────────────────────────────────────────
    if (this.runeDrawing.isTargeting()) {
      const mouse = this.input.getMousePos();
      const spell = this.runeDrawing.getTargetingSpell();
      if (spell) {
        if (spell.targeting === 'single_node') {
          const nodeId = this.enemyNetwork.getNodeAtPoint(mouse.x, mouse.y);
          if (nodeId) {
            const node = this.enemyNetwork.getNode(nodeId);
            renderer.drawCircleOutline(node.x, node.y, 14, '#00ff88', 2);
          }
        } else if (spell.targeting === 'aoe_circle') {
          const bounds = this.enemyNetwork.getBounds();
          if (this._pointInRect(mouse.x, mouse.y, bounds)) {
            renderer.drawCircleOutline(mouse.x, mouse.y, spell.radius, '#ff880088', 2);
            renderer.drawCircle(mouse.x, mouse.y, spell.radius, '#ff880022');
          }
        }
      }
    }

    // Collision point indicator
    renderer.drawText(`Beam: ${Math.floor(this.state.collision_point)}%`, 440, 90, '#fff', 12, 'center');
  }
}
