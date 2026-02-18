import { BALANCE } from '../data/BalanceConfig.js';
import { Button, ProgressBar, PipBar } from '../rendering/UIComponents.js';
import { NodeState } from './CombatState.js';
import { SCHOOL_TO_NODE } from './NodeNetwork.js';

export class CombatHUD {
  constructor(combatState, eventBus, inputManager, playerNetwork, enemyNetwork,
    beamSwitcher, spellBook, spellCaster, shieldSystem) {
    this.state = combatState;
    this.eventBus = eventBus;
    this.input = inputManager;
    this.playerNetwork = playerNetwork;
    this.enemyNetwork = enemyNetwork;
    this.beamSwitcher = beamSwitcher;
    this.spellBook = spellBook;
    this.spellCaster = spellCaster;
    this.shield = shieldSystem;

    // Beam type buttons — Order, Pure, Chaos across top; Neutral beneath
    this.beamButtons = {
      order: new Button(370, 494, 65, 24, 'Order', { color: '#444444', hoverColor: '#606060' }),
      pure: new Button(440, 494, 65, 24, 'Pure', { color: '#666666', hoverColor: '#888888' }),
      chaos: new Button(510, 494, 65, 24, 'Chaos', { color: '#111111', hoverColor: '#252525' }),
      neutral: new Button(440, 520, 65, 24, 'Neutral', { color: '#2d2d2d', hoverColor: '#444444' }),
    };

    // Spell book widget buttons (~x=186, y=440)
    this.leftArrow = new Button(186, 447, 22, 22, '◄', { color: '#333', hoverColor: '#555', fontSize: 11 });
    this.bookBtn = new Button(211, 440, 60, 32, 'Hold', { color: '#335', hoverColor: '#448', fontSize: 12 });
    this.rightArrow = new Button(274, 447, 22, 22, '►', { color: '#333', hoverColor: '#555', fontSize: 11 });

    // Shield button (separate toggle)
    this.shieldBtn = new Button(211, 500, 60, 22, 'Shield', { color: '#444', hoverColor: '#666', fontSize: 12 });

    // HP bars
    this.playerHpBar = new PipBar(10, 10, 6, 14, BALANCE.hp.starting_max, { fgColor: '#cc0000', bgColor: '#440000' });
    this.enemyHpBar = new PipBar(560, 10, 6, 14, BALANCE.hp.starting_max, { fgColor: '#cc0000', bgColor: '#440000' });

    // Stability bars
    this.playerStabilityBar = new ProgressBar(10, 30, 200, 10, { fgColor: '#00cc00', bgColor: '#003300' });
    this.enemyStabilityBar = new ProgressBar(750, 30, 200, 10, { fgColor: '#00cc00', bgColor: '#003300' });


    // Hold detection state
    this.holdingBook = false;
    this.holdJustReleased = false;

    // Shield hold detection state
    this.holdingShield = false;
    this.shieldChargeTimer = 0;
    this.shieldRaised = false; // true once charge completes and shield is up
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

  handleInput() {
    const mouse = this.input.getMousePos();
    const clicked = this.input.wasClicked();
    const clickPos = this.input.getClickPos();
    const isMouseDown = this.input.isMouseDown();

    // Update hover states
    for (const btn of Object.values(this.beamButtons)) {
      btn.updateHover(mouse.x, mouse.y);
    }
    this.leftArrow.updateHover(mouse.x, mouse.y);
    this.bookBtn.updateHover(mouse.x, mouse.y);
    this.rightArrow.updateHover(mouse.x, mouse.y);
    this.shieldBtn.updateHover(mouse.x, mouse.y);

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
    if (this.input.wasKeyPressed('s') || this.input.wasKeyPressed('S')) {
      this.beamSwitcher.requestSwitch('neutral');
    }

    // Hold detection for book button
    const overBook = this._pointInButton(this.bookBtn, mouse.x, mouse.y);
    if (isMouseDown && overBook && !this.holdingBook && this.spellBook.isIdle()) {
      this.holdingBook = true;
      this.spellBook.startHold(this.spellCaster);
    }
    if (this.holdingBook && (!isMouseDown || !overBook)) {
      if (this.spellBook.isCharging()) {
        this.spellBook.cancelHold();
      }
      // Suppress the click fired by mouse release so it doesn't immediately
      // resolve/cancel the ready state when the player lifts off the book button
      if (!isMouseDown) {
        this.holdJustReleased = true;
      }
      this.holdingBook = false;
    }

    // Hold detection for shield button
    const ps = this.state.player;
    const shieldGem = this._findOpenShieldGem();
    const overShield = this._pointInButton(this.shieldBtn, mouse.x, mouse.y);
    if (isMouseDown && overShield && !this.holdingShield && !this.holdingBook &&
        this.spellBook.isIdle() && shieldGem &&
        ps.shield_state === 'down' &&
        !this.spellCaster.isOnCooldown('shield', 'player')) {
      this.holdingShield = true;
      this.shieldChargeTimer = 0;
    }
    if (this.holdingShield) {
      // After shield is raised, only mouse-up drops it (can move cursor freely)
      // Before shield is raised, moving off the button also cancels
      const shouldCancel = this.shieldRaised ? !isMouseDown : (!isMouseDown || !overShield);
      if (shouldCancel) {
        if (this.shieldRaised) this.shield.lower();
        this.holdingShield = false;
        this.shieldChargeTimer = 0;
        this.shieldRaised = false;
      }
    }
    // Set / clear shield charge debuff every frame based on hold state
    ps.shield_charge_debuff_active = this.holdingShield;
    ps.shield_charge_debuff_amount = (this.holdingShield && shieldGem) ? shieldGem.spell_mana_debuff : 0;

    // When spell is ready, handle targeting
    if (this.spellBook.isReady()) {
      if (clicked && !this.holdJustReleased) {
        const entry = this.spellBook.activeSpellEntry;
        if (entry) {
          const bounds = this.enemyNetwork.getBounds();

          if (entry.spell.targeting === 'single_node') {
            const nodeId = this.enemyNetwork.getNodeAtPoint(clickPos.x, clickPos.y);
            if (nodeId) {
              this.spellBook.resolve({ nodeId }, this.spellCaster);
            } else {
              this.spellBook.cancelReady();
            }
          } else if (entry.spell.targeting === 'aoe_circle') {
            if (this._pointInRect(clickPos.x, clickPos.y, bounds)) {
              this.spellBook.resolve({ x: clickPos.x, y: clickPos.y }, this.spellCaster);
            } else {
              this.spellBook.cancelReady();
            }
          }
          // 'immediate' spells auto-fire in SpellBook.update()
        }
      }
      this.holdJustReleased = false;
      return; // block all other clicks when ready
    }

    this.holdJustReleased = false;

    if (!clicked) return;

    // Beam buttons
    for (const [school, btn] of Object.entries(this.beamButtons)) {
      if (btn.isClicked(clickPos.x, clickPos.y)) {
        this.beamSwitcher.requestSwitch(school);
        return;
      }
    }

    // Arrow buttons (cycle spells)
    if (this.leftArrow.isClicked(clickPos.x, clickPos.y)) {
      this.spellBook.cycleLeft();
      return;
    }
    if (this.rightArrow.isClicked(clickPos.x, clickPos.y)) {
      this.spellBook.cycleRight();
      return;
    }

    // Click on player node network for awareness (only when not locked)
    if (!this.spellBook.isNodeClickLocked()) {
      const playerNodeId = this.playerNetwork.getNodeAtPoint(clickPos.x, clickPos.y);
      if (playerNodeId) {
        this.playerNetwork.setAwarenessTarget(playerNodeId);
        return;
      }
    }
  }

  update(dt) {
    // Tick shield charge timer / monitor raised shield
    if (this.holdingShield) {
      const shieldGem = this._findOpenShieldGem();
      if (shieldGem) {
        if (!this.shieldRaised) {
          // Still charging — tick timer
          this.shieldChargeTimer += dt;
          if (this.shieldChargeTimer >= shieldGem.spell_charge_time) {
            this.spellCaster.castSpell('shield', {}, 'player');
            this.shieldRaised = true; // keep holding; shield is now up
          }
        } else {
          // Shield is raised — check if it dropped externally (duration or projectile)
          if (this.state.player.shield_state !== 'up') {
            this.holdingShield = false;
            this.shieldChargeTimer = 0;
            this.shieldRaised = false;
            this.state.player.shield_charge_debuff_active = false;
            this.state.player.shield_charge_debuff_amount = 0;
          }
        }
      } else {
        // Gem was damaged mid-hold — cancel
        this.holdingShield = false;
        this.shieldChargeTimer = 0;
        this.shieldRaised = false;
        this.state.player.shield_charge_debuff_active = false;
        this.state.player.shield_charge_debuff_amount = 0;
      }
    }

    this._updateButtonStates();

    // Cursor management
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.cursor = this.spellBook.isReady() ? 'crosshair' : 'default';
    }
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
        btn.disabled = ps.beam_switch_state !== 'ready' || !nodeOpen || ps.current_beam_school === school;
      }
    }

    // Spell book buttons
    const availableSpells = this.spellBook.getAvailableSpells();
    const entry = this.spellBook.getSelectedEntry();
    const onCd = entry ? this.spellCaster.isOnCooldown(entry.spellId, 'player') : true;

    this.leftArrow.disabled = availableSpells.length <= 1 || !this.spellBook.isIdle();
    this.rightArrow.disabled = availableSpells.length <= 1 || !this.spellBook.isIdle();
    this.bookBtn.disabled = !entry || onCd || !this.spellBook.isIdle();

    if (this.spellBook.isCharging()) {
      this.bookBtn.text = 'Charging';
      this.bookBtn.color = '#553';
    } else if (this.spellBook.isReady()) {
      this.bookBtn.text = 'CAST!';
      this.bookBtn.color = '#363';
    } else {
      this.bookBtn.text = entry ? 'Hold' : '---';
      this.bookBtn.color = '#335';
    }

    // Shield button
    const shieldOpen = this._findOpenShieldGem();
    const shieldCd = this.spellCaster.getCooldownRemaining('shield', 'player');
    const shieldReady = shieldOpen && ps.shield_state === 'down' && shieldCd <= 0;
    this.shieldBtn.disabled = !shieldReady && !this.holdingShield;
    if (!shieldOpen || ps.shield_state === 'unavailable') {
      this.shieldBtn.text = 'Shield';
      this.shieldBtn.color = '#333';
    } else if (this.holdingShield && this.shieldRaised) {
      this.shieldBtn.text = `Up: ${ps.shield_duration_timer.toFixed(1)}s`;
      this.shieldBtn.color = '#055';
    } else if (this.holdingShield) {
      this.shieldBtn.text = 'Charging';
      this.shieldBtn.color = '#553';
    } else if (ps.shield_state === 'up') {
      // shouldn't normally happen for player, but handle gracefully
      this.shieldBtn.text = `Up: ${ps.shield_duration_timer.toFixed(1)}s`;
      this.shieldBtn.color = '#055';
    } else if (shieldCd > 0) {
      this.shieldBtn.text = `CD: ${shieldCd.toFixed(1)}s`;
      this.shieldBtn.color = '#333';
    } else {
      this.shieldBtn.text = 'Hold';
      this.shieldBtn.color = '#335';
    }
  }

  // Renders coloured mana modifier chips anchored at (anchorX, y).
  // Player side: items spread rightward, rightmost chip at anchorX (closest to centre).
  // Enemy  side: items spread rightward, leftmost  chip at anchorX (closest to centre).
  _renderManaBreakdown(renderer, breakdown, anchorX, y, side) {
    if (!breakdown) return;

    // Build ordered segment list: nodes → attunement → spell debuff → counter debuff → panic
    const segs = [];
    segs.push({ text: `${breakdown.nodes}n`,          color: '#999999' });
    if (breakdown.spellDebuff   > 0) segs.push({ text: `-${breakdown.spellDebuff}sp`,   color: '#ffaa00' });
    if (breakdown.counterDebuff > 0) segs.push({ text: `-${breakdown.counterDebuff}ctr`, color: '#ff4444' });
    if (breakdown.panic         > 0) segs.push({ text: `+${breakdown.panic}!`,           color: '#ffd700' });

    const step = 34; // px between chip centres

    if (side === 'player') {
      // Rightmost segment at anchorX, others spread left
      const n = segs.length;
      for (let i = 0; i < n; i++) {
        const x = anchorX - (n - 1 - i) * step;
        renderer.drawText(segs[i].text, x, y, segs[i].color, 9, 'center', 'middle');
      }
    } else {
      // Leftmost segment at anchorX, others spread right
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
    // Both sides anchored at x=480, player right-aligned, enemy left-aligned
    const cx = 480;
    const manaGap = 14; // px from centre to mana total
    const playerMana = ps.effective_mana !== undefined ? ps.effective_mana : 0;
    const enemyMana  = es.effective_mana !== undefined ? es.effective_mana  : 0;

    const pManaSize = Math.max(7, Math.min(22, Math.round(8 + playerMana * 1.3)));
    const eManaSize = Math.max(7, Math.min(22, Math.round(8 + enemyMana  * 1.3)));
    renderer.drawText(`Mana: ${playerMana}`, cx - manaGap, 106, '#88ccff', pManaSize, 'right', 'middle');
    renderer.drawText(`Mana: ${enemyMana}`,  cx + manaGap, 106, '#88ccff', eManaSize, 'left',  'middle');

    // Breakdown rows — player right-aligned, enemy left-aligned
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

    // ── Spell Book Widget ──────────────────────────────────────────
    // Panel background
    renderer.drawRect(183, 437, 116, 90, '#111', 0.7);
    renderer.drawRectOutline(183, 437, 116, 90, '#444');

    // Arrow buttons
    this.leftArrow.render(renderer);
    this.rightArrow.render(renderer);

    // Book button
    this.bookBtn.render(renderer);

    // Spell name and element label
    const entry = this.spellBook.getSelectedEntry();
    if (entry) {
      const elemColor = BALANCE.element.colors[entry.spell.element] || '#aaa';
      renderer.drawText(entry.spell.name, 241, 476, elemColor, 10, 'center', 'middle');
      // Cooldown indicator
      const cd = this.spellCaster.getCooldownRemaining(entry.spellId, 'player');
      if (cd > 0) {
        renderer.drawText(`${cd.toFixed(1)}s`, 241, 488, '#ff4444', 9, 'center', 'middle');
      }
    } else {
      renderer.drawText('No spells', 241, 476, '#555', 10, 'center', 'middle');
    }

    // Charge progress bar (below arrows/book)
    const progress = this.spellBook.getChargeProgress();
    if (progress) {
      const fill = 1 - (progress.remaining / progress.total);
      renderer.drawRect(211, 495, 60, 4, '#222');
      renderer.drawRect(211, 495, Math.floor(60 * fill), 4, '#ffaa00');
    }

    // READY indicator
    if (this.spellBook.isReady()) {
      renderer.drawRect(211, 493, 60, 8, '#004400');
      renderer.drawText('READY', 241, 497, '#00ff88', 9, 'center', 'middle');
    }

    // Shield button
    this.shieldBtn.render(renderer);

    // Shield charge progress bar
    if (this.holdingShield) {
      const sGem = this._findOpenShieldGem();
      if (sGem) {
        const fill = Math.min(1, this.shieldChargeTimer / sGem.spell_charge_time);
        renderer.drawRect(211, 524, 60, 4, '#222');
        renderer.drawRect(211, 524, Math.floor(60 * fill), 4, '#00ccff');
      }
    }

    // ── Targeting overlays (when spell is ready) ──────────────────
    if (this.spellBook.isReady()) {
      const mouse = this.input.getMousePos();
      const activeEntry = this.spellBook.activeSpellEntry;
      if (activeEntry) {
        if (activeEntry.spell.targeting === 'single_node') {
          const nodeId = this.enemyNetwork.getNodeAtPoint(mouse.x, mouse.y);
          if (nodeId) {
            const node = this.enemyNetwork.getNode(nodeId);
            renderer.drawCircleOutline(node.x, node.y, 14, '#00ff88', 2);
          }
        } else if (activeEntry.spell.targeting === 'aoe_circle') {
          const bounds = this.enemyNetwork.getBounds();
          if (this._pointInRect(mouse.x, mouse.y, bounds)) {
            renderer.drawCircleOutline(mouse.x, mouse.y, activeEntry.spell.radius, '#ff880088', 2);
            renderer.drawCircle(mouse.x, mouse.y, activeEntry.spell.radius, '#ff880022');
          }
        }
      }
    }

    // Collision point indicator
    renderer.drawText(`Beam: ${Math.floor(this.state.collision_point)}%`, 440, 90, '#fff', 12, 'center');
  }
}
