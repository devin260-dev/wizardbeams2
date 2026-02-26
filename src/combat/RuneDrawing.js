import { BALANCE } from '../data/BalanceConfig.js';
import { getSpell } from '../data/SpellDatabase.js';
import { NodeState } from './CombatState.js';

/**
 * Gesture capture, recognition dispatch, visual trail, and targeting state.
 *
 * State machine:
 *   idle ──[mouseDown in empty space]──> drawing
 *   drawing ──[mouseUp, recognized + immediate]──> idle  (cast)
 *   drawing ──[mouseUp, recognized + targeting]──> targeting
 *   drawing ──[mouseUp, not recognized]──> idle  (fizzle)
 *   targeting ──[left click valid target]──> idle  (cast)
 *   targeting ──[left click invalid / mouseDown]──> idle  (cancel)
 */
export class RuneDrawing {
  /**
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('./RuneRecognizer.js').RuneRecognizer} recognizer
   * @param {import('./SpellCaster.js').SpellCaster} spellCaster
   * @param {import('./NodeNetwork.js').NodeNetwork} playerNetwork
   * @param {import('./NodeNetwork.js').NodeNetwork} enemyNetwork
   * @param {object} playerState - combatState.player
   */
  constructor(inputManager, recognizer, spellCaster, playerNetwork, enemyNetwork, playerState) {
    this.input = inputManager;
    this.recognizer = recognizer;
    this.spellCaster = spellCaster;
    this.playerNetwork = playerNetwork;
    this.enemyNetwork = enemyNetwork;
    this.playerState = playerState;

    // Drawing state
    this._state = 'idle'; // 'idle' | 'drawing' | 'targeting'
    this._drawnPoints = [];

    // Lazy-mouse stabilizer ("string" smoothing)
    this._brushX = 0;
    this._brushY = 0;

    // Targeting state (after successful recognition of a targeted spell)
    this._targetingSpellId = null;
    this._targetingSpell = null;

    // Visual feedback
    this._feedbackTimer = 0;
    this._feedbackType = ''; // 'success' | 'fizzle' | 'unavailable' | 'cooldown'
    this._feedbackPos = { x: 0, y: 0 };
    this._feedbackText = '';
  }

  // ── Public state queries ──────────────────────────────────────────

  isDrawing() { return this._state === 'drawing'; }
  isTargeting() { return this._state === 'targeting'; }
  isIdle() { return this._state === 'idle'; }

  /** True when left clicks should NOT be routed to nodes or buttons. */
  isNodeClickLocked() {
    return this._state === 'drawing' || this._state === 'targeting';
  }

  /** Returns the SpellDatabase entry for the spell being targeted, or null. */
  getTargetingSpell() {
    return this._targetingSpell;
  }

  // ── Called by CombatHUD ───────────────────────────────────────────

  /**
   * Start drawing. Called by CombatHUD when mouseDown lands on empty space.
   */
  startDrawing(x, y) {
    if (this._state === 'targeting') {
      // Cancel targeting and start a new drawing
      this._targetingSpellId = null;
      this._targetingSpell = null;
    }
    this._state = 'drawing';
    this._brushX = x;
    this._brushY = y;
    this._drawnPoints = [{ x, y }];
  }

  /**
   * Record a point. Called every frame while mouse is down and we're drawing.
   * Uses a lazy-mouse stabilizer: the brush trails behind the cursor on an
   * invisible string, smoothing out hand jitter.
   */
  addPoint(x, y) {
    if (this._state !== 'drawing') return;

    const stringLen = BALANCE.rune.stabilizer_string_length;
    if (stringLen <= 0) {
      // Stabilizer disabled — raw input
      this._drawnPoints.push({ x, y });
      return;
    }

    const dx = x - this._brushX;
    const dy = y - this._brushY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > stringLen) {
      // Pull brush toward cursor, leaving a string-length gap
      const pull = dist - stringLen;
      this._brushX += (dx / dist) * pull;
      this._brushY += (dy / dist) * pull;
      this._drawnPoints.push({ x: this._brushX, y: this._brushY });
    }
    // If cursor is within string length, brush stays put (no new point)
  }

  /**
   * Mouse released. Attempt recognition.
   */
  finishDrawing() {
    if (this._state !== 'drawing') return;

    const points = this._drawnPoints;
    this._drawnPoints = [];

    // Too few points — silently ignore (accidental brief click)
    if (points.length < BALANCE.rune.min_point_count) {
      this._state = 'idle';
      return;
    }

    const result = this.recognizer.recognize(points);
    const center = this._centroid(points);

    if (!result) {
      this._showFeedback('fizzle', center, 'Fizzle');
      this._state = 'idle';
      return;
    }

    this._onRecognized(result.name, center);
  }

  /**
   * Resolve targeting — called by CombatHUD when player clicks a valid target.
   */
  resolveTarget(targetData) {
    if (this._state !== 'targeting' || !this._targetingSpellId) return;
    this.spellCaster.castSpell(this._targetingSpellId, targetData, 'player');
    this._targetingSpellId = null;
    this._targetingSpell = null;
    this._state = 'idle';
  }

  /**
   * Cancel targeting (invalid click or new drawing started).
   */
  cancelTargeting() {
    if (this._state !== 'targeting') return;
    this._targetingSpellId = null;
    this._targetingSpell = null;
    this._state = 'idle';
  }

  // ── Frame update ──────────────────────────────────────────────────

  update(dt) {
    if (this._feedbackTimer > 0) {
      this._feedbackTimer -= dt;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────

  render(renderer) {
    // Draw trail while drawing
    if (this._state === 'drawing' && this._drawnPoints.length >= 2) {
      renderer.drawPolyline(this._drawnPoints, BALANCE.rune.trail_color, BALANCE.rune.trail_width);

      // Draw stabilizer string from brush to cursor
      if (BALANCE.rune.stabilizer_string_length > 0) {
        const mouse = this.input.getMousePos();
        renderer.drawLine(this._brushX, this._brushY, mouse.x, mouse.y, 'rgba(255,204,0,0.25)', 1);
        renderer.drawCircle(this._brushX, this._brushY, 2, '#ffcc00');
      }
    }

    // Feedback flash
    if (this._feedbackTimer > 0) {
      const alpha = Math.min(1, this._feedbackTimer / BALANCE.rune.feedback_duration);
      const { x, y } = this._feedbackPos;

      if (this._feedbackType === 'success') {
        const r = 15 + (1 - alpha) * 20;
        renderer.drawCircleOutline(x, y, r, '#00ff88', 2);
        renderer.drawText(this._feedbackText, x, y - 20, '#00ff88', 12, 'center', 'middle');
      } else if (this._feedbackType === 'fizzle') {
        renderer.drawLine(x - 8, y - 8, x + 8, y + 8, '#ff4444', 2);
        renderer.drawLine(x + 8, y - 8, x - 8, y + 8, '#ff4444', 2);
      } else if (this._feedbackType === 'cooldown') {
        renderer.drawText(this._feedbackText, x, y - 12, '#ffaa00', 11, 'center', 'middle');
      } else if (this._feedbackType === 'unavailable') {
        renderer.drawText(this._feedbackText, x, y - 12, '#888888', 11, 'center', 'middle');
      }
    }
  }

  // ── Available spells query (for HUD info panel) ───────────────────

  /** Returns [{spellId, spell, gem, nodeId, cooldownRemaining}] for display. */
  getAvailableSpells() {
    const result = [];
    for (const [nodeId, node] of Object.entries(this.playerNetwork.nodes)) {
      if (node.state !== NodeState.OPEN) continue;
      if (!node.gem || !node.gem.spell_id) continue;
      const spell = getSpell(node.gem.spell_id);
      if (!spell) continue;
      result.push({
        spellId: node.gem.spell_id,
        spell,
        gem: node.gem,
        nodeId,
        cooldownRemaining: this.spellCaster.getCooldownRemaining(node.gem.spell_id, 'player'),
      });
    }
    return result;
  }

  // ── Internal ──────────────────────────────────────────────────────

  _onRecognized(spellName, center) {
    // Find gem with this spell in an Open node
    const gem = this._findOpenGemForSpell(spellName);
    if (!gem) {
      this._showFeedback('unavailable', center, 'No spell');
      this._state = 'idle';
      return;
    }

    // Check cooldown
    if (this.spellCaster.isOnCooldown(spellName, 'player')) {
      const cd = this.spellCaster.getCooldownRemaining(spellName, 'player');
      this._showFeedback('cooldown', center, `CD: ${cd.toFixed(1)}s`);
      this._state = 'idle';
      return;
    }

    // Get spell data
    const spell = getSpell(spellName);
    if (!spell) {
      this._showFeedback('fizzle', center, 'Fizzle');
      this._state = 'idle';
      return;
    }

    this._showFeedback('success', center, spell.name);

    // Immediate spells cast now
    if (spell.targeting === 'immediate') {
      this.spellCaster.castSpell(spellName, {}, 'player');
      this._state = 'idle';
      return;
    }

    // Targeted spells enter targeting mode
    this._targetingSpellId = spellName;
    this._targetingSpell = spell;
    this._state = 'targeting';
  }

  _findOpenGemForSpell(spellName) {
    for (const node of Object.values(this.playerNetwork.nodes)) {
      if (node.state === NodeState.OPEN && node.gem && node.gem.spell_id === spellName) {
        return node.gem;
      }
    }
    return null;
  }

  _showFeedback(type, pos, text) {
    this._feedbackType = type;
    this._feedbackPos = { x: pos.x, y: pos.y };
    this._feedbackText = text;
    this._feedbackTimer = BALANCE.rune.feedback_duration;
  }

  _centroid(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }
}
