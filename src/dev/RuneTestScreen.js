import { BALANCE } from '../data/BalanceConfig.js';
import { RuneRecognizer } from '../combat/RuneRecognizer.js';
import { Button } from '../rendering/UIComponents.js';

/**
 * Dev tool: draw rune patterns and see recognition results.
 * No combat systems — just raw pattern testing.
 */
export class RuneTestScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;

    this.recognizer = new RuneRecognizer({
      numPoints: BALANCE.rune.num_resample_points,
      squareSize: BALANCE.rune.square_size,
      recognitionThreshold: BALANCE.rune.recognition_threshold,
      minPointCount: BALANCE.rune.min_point_count,
    });

    this.backButton = new Button(20, 10, 80, 30, 'Back', { color: '#333', hoverColor: '#555', fontSize: 12 });
    this.clearButton = new Button(120, 10, 80, 30, 'Clear', { color: '#333', hoverColor: '#555', fontSize: 12 });

    // Pre-compute template preview points (scaled to fit small boxes)
    this.templatePreviews = this._buildTemplatePreviews();

    this.drawing = false;
    this.points = [];
    this.lastResult = null;    // { name, score } or null
    this.lastFizzle = false;
    this.history = [];         // [{name, score, pointCount}]
    this.frozenTrail = [];     // last completed drawing (kept on screen)
  }

  enter() {
    this.drawing = false;
    this.points = [];
    this.lastResult = null;
    this.lastFizzle = false;
    this.history = [];
    this.frozenTrail = [];
  }

  update(dt) {
    const mouse = this.input.getMousePos();
    this.backButton.updateHover(mouse.x, mouse.y);
    this.clearButton.updateHover(mouse.x, mouse.y);

    const clicked = this.input.wasClicked();
    const clickPos = this.input.getClickPos();
    const isDown = this.input.isMouseDown();
    const justPressed = this.input.wasMouseJustPressed();

    if (clicked) {
      if (this.backButton.isClicked(clickPos.x, clickPos.y)) {
        this.sceneManager.changeScene('start');
        return;
      }
      if (this.clearButton.isClicked(clickPos.x, clickPos.y)) {
        this.history = [];
        this.lastResult = null;
        this.lastFizzle = false;
        this.frozenTrail = [];
        return;
      }
    }

    // Drawing
    if (justPressed && !this._isOverButton(mouse.x, mouse.y)) {
      this.drawing = true;
      this.points = [{ x: mouse.x, y: mouse.y }];
      this.lastResult = null;
      this.lastFizzle = false;
      this.frozenTrail = [];
    }

    if (this.drawing && isDown) {
      this.points.push({ x: mouse.x, y: mouse.y });
    }

    if (this.drawing && !isDown) {
      this.drawing = false;
      this.frozenTrail = [...this.points];
      this._recognize();
    }
  }

  _isOverButton(x, y) {
    const btns = [this.backButton, this.clearButton];
    for (const b of btns) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
    return false;
  }

  _recognize() {
    const pts = this.points;
    if (pts.length < BALANCE.rune.min_point_count) {
      this.lastFizzle = true;
      this.lastResult = null;
      return;
    }

    const result = this.recognizer.recognize(pts);
    if (result) {
      this.lastResult = result;
      this.lastFizzle = false;
      this.history.unshift({ name: result.name, score: result.score, pointCount: pts.length });
    } else {
      // Show best match even below threshold
      const best = this._getBestMatch(pts);
      this.lastResult = null;
      this.lastFizzle = true;
      if (best) {
        this.history.unshift({ name: `(${best.name})`, score: best.score, pointCount: pts.length });
      } else {
        this.history.unshift({ name: '(none)', score: 0, pointCount: pts.length });
      }
    }
    if (this.history.length > 10) this.history.length = 10;
  }

  _buildTemplatePreviews() {
    const rawTemplates = RuneRecognizer.getDefaultTemplates();
    const previews = [];
    const seen = new Set();
    const previewSize = 50; // px box for each template

    for (const t of rawTemplates) {
      // Only show first template per spell name (skip orientation variants)
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      const pts = t.points;
      // Find bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const w = maxX - minX || 1;
      const h = maxY - minY || 1;
      const scale = (previewSize - 8) / Math.max(w, h);
      // Normalize points to fit in a previewSize box with 4px padding
      const normalized = pts.map(p => ({
        x: (p.x - minX) * scale + 4,
        y: (p.y - minY) * scale + 4,
      }));
      previews.push({ name: t.name, points: normalized });
    }
    return previews;
  }

  _getBestMatch(drawnPoints) {
    // Run recognition without threshold to see best match
    const saved = this.recognizer.threshold;
    this.recognizer.threshold = 0;
    const result = this.recognizer.recognize(drawnPoints);
    this.recognizer.threshold = saved;
    return result;
  }

  render() {
    const r = this.renderer;
    r.clear('#0a0a1a');

    // Title
    r.drawText('RUNE TEST', 480, 30, '#8000cc', 24, 'center', 'middle');

    // Buttons
    this.backButton.render(r);
    this.clearButton.render(r);

    // Instructions
    r.drawText('Draw a pattern with left mouse button. Release to recognize.', 480, 60, '#666', 11, 'center');
    r.drawText(`Threshold: ${BALANCE.rune.recognition_threshold}   Min points: ${BALANCE.rune.min_point_count}`, 480, 75, '#444', 9, 'center');

    // Template reference with visual previews (right side)
    r.drawText('RUNE SHAPES', 860, 95, '#aaa', 12, 'center');
    const previewSize = 50;
    const cols = 2;
    const startX = 770;
    const startY = 110;
    const gapX = 100;
    const gapY = 75;

    for (let i = 0; i < this.templatePreviews.length; i++) {
      const t = this.templatePreviews[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * gapX;
      const by = startY + row * gapY;

      // Draw box background
      r.drawRect(bx, by, previewSize, previewSize, '#1a1a2e', 0.8);
      r.drawRectOutline(bx, by, previewSize, previewSize, '#333');

      // Draw template shape inside box
      const shifted = t.points.map(p => ({ x: p.x + bx, y: p.y + by }));
      if (shifted.length >= 2) {
        r.drawPolyline(shifted, '#88ccff', 1.5);
        // Draw start dot
        r.drawCircle(shifted[0].x, shifted[0].y, 2, '#00ff88');
      }

      // Label beneath
      // Highlight if this was the last recognized spell
      const isMatch = this.lastResult && this.lastResult.name === t.name;
      const labelColor = isMatch ? '#00ff88' : '#88ccff';
      r.drawText(t.name, bx + previewSize / 2, by + previewSize + 10, labelColor, 9, 'center');
    }

    // Frozen trail (last completed drawing)
    if (this.frozenTrail.length >= 2) {
      r.drawPolyline(this.frozenTrail, '#444', 1);
    }

    // Active drawing trail
    if (this.drawing && this.points.length >= 2) {
      r.drawPolyline(this.points, BALANCE.rune.trail_color, BALANCE.rune.trail_width);
      // Point count
      r.drawText(`${this.points.length} pts`, 480, 510, '#666', 10, 'center');
    }

    // Recognition result
    if (this.lastResult) {
      const score = (this.lastResult.score * 100).toFixed(1);
      r.drawText(`${this.lastResult.name}`, 480, 440, '#00ff88', 28, 'center', 'middle');
      r.drawText(`Score: ${score}%`, 480, 470, '#00cc66', 14, 'center', 'middle');
    } else if (this.lastFizzle) {
      r.drawText('FIZZLE', 480, 440, '#ff4444', 28, 'center', 'middle');
      r.drawText('No match above threshold', 480, 470, '#884444', 12, 'center', 'middle');
    }

    // History (left side)
    if (this.history.length > 0) {
      r.drawText('HISTORY', 100, 100, '#aaa', 12, 'center');
      let hy = 120;
      for (const h of this.history) {
        const score = (h.score * 100).toFixed(1);
        const color = h.name.startsWith('(') ? '#664444' : '#448844';
        r.drawText(`${h.name}  ${score}%  (${h.pointCount}pts)`, 20, hy, color, 10);
        hy += 16;
      }
    }
  }

  exit() {}
}
