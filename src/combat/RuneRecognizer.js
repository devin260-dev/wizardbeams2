/**
 * $1 Unistroke Recognizer — adapted for Wizard Beams rune casting.
 *
 * Scale-invariant, position-invariant, rotation-invariant gesture recognition.
 * Templates are data-driven: add/change runes by editing the template list.
 *
 * Reference: Wobbrock, Wilson & Li, "$1 Unistroke Recognizer" (2007)
 */

const PHI = 0.5 * (-1 + Math.sqrt(5)); // golden ratio

export class RuneRecognizer {
  /**
   * @param {object} config
   * @param {number} config.numPoints      - resample count (default 64)
   * @param {number} config.squareSize     - normalization square (default 250)
   * @param {number} config.recognitionThreshold - min score to accept (default 0.65)
   * @param {number} config.minPointCount  - min drawn points to attempt (default 10)
   */
  constructor(config = {}) {
    this.numPoints = config.numPoints || 64;
    this.squareSize = config.squareSize || 250;
    this.threshold = config.recognitionThreshold ?? 0.65;
    this.minPointCount = config.minPointCount || 10;
    this.angleRange = Math.PI / 4;    // ±45°
    this.anglePrecision = Math.PI / 90; // 2°

    this.templates = [];

    // Load defaults
    for (const t of RuneRecognizer.getDefaultTemplates()) {
      this.addTemplate(t.name, t.points);
    }
  }

  /**
   * Register a template. Points are normalized on add for fast comparison.
   * @param {string} name   - spell id (e.g. 'grey_bolt')
   * @param {{x:number,y:number}[]} rawPoints
   */
  addTemplate(name, rawPoints) {
    const points = this._normalize(rawPoints);
    this.templates.push({ name, points });
  }

  /**
   * Clear all templates (useful before reloading a custom set).
   */
  clearTemplates() {
    this.templates = [];
  }

  /**
   * Attempt to recognize a drawn gesture.
   * @param {{x:number,y:number}[]} drawnPoints
   * @returns {{ name: string, score: number } | null}
   */
  recognize(drawnPoints) {
    if (drawnPoints.length < this.minPointCount) return null;

    const points = this._normalize(drawnPoints);
    let bestScore = 0;
    let bestName = null;

    for (const t of this.templates) {
      const d = this._distanceAtBestAngle(
        points, t.points,
        -this.angleRange, this.angleRange, this.anglePrecision
      );
      const halfDiag = 0.5 * Math.sqrt(
        this.squareSize * this.squareSize + this.squareSize * this.squareSize
      );
      const score = 1 - d / halfDiag;
      if (score > bestScore) {
        bestScore = score;
        bestName = t.name;
      }
    }

    if (bestScore >= this.threshold) {
      return { name: bestName, score: bestScore };
    }
    return null;
  }

  // ── Normalization pipeline ────────────────────────────────────────

  _normalize(rawPoints) {
    let pts = rawPoints.map(p => ({ x: p.x, y: p.y }));
    pts = this._resample(pts, this.numPoints);
    const angle = this._indicativeAngle(pts);
    pts = this._rotateBy(pts, -angle);
    pts = this._scaleTo(pts, this.squareSize);
    pts = this._translateTo(pts, { x: 0, y: 0 });
    return pts;
  }

  _resample(points, n) {
    const totalLen = this._pathLength(points);
    const interval = totalLen / (n - 1);
    const resampled = [{ x: points[0].x, y: points[0].y }];
    let D = 0;

    for (let i = 1; i < points.length; i++) {
      let d = this._distance(points[i - 1], points[i]);
      if (D + d >= interval) {
        let remaining = interval - D;
        while (D + d >= interval && resampled.length < n) {
          const t = remaining / d;
          const qx = points[i - 1].x + t * (points[i].x - points[i - 1].x);
          const qy = points[i - 1].y + t * (points[i].y - points[i - 1].y);
          const q = { x: qx, y: qy };
          resampled.push(q);
          // Insert q into points so next segment starts from q
          points.splice(i, 0, q);
          i++;
          D = 0;
          remaining = interval;
          d = this._distance(points[i - 1], points[i]);
        }
        D = 0;
      } else {
        D += d;
      }
    }

    // Rounding errors may leave us one short
    while (resampled.length < n) {
      resampled.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
    }

    return resampled.slice(0, n);
  }

  _indicativeAngle(points) {
    const c = this._centroid(points);
    return Math.atan2(c.y - points[0].y, c.x - points[0].x);
  }

  _rotateBy(points, radians) {
    const c = this._centroid(points);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return points.map(p => {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      return {
        x: dx * cos - dy * sin + c.x,
        y: dx * sin + dy * cos + c.y,
      };
    });
  }

  _scaleTo(points, size) {
    const bb = this._boundingBox(points);
    const w = bb.width || 1;
    const h = bb.height || 1;
    return points.map(p => ({
      x: p.x * (size / w),
      y: p.y * (size / h),
    }));
  }

  _translateTo(points, origin) {
    const c = this._centroid(points);
    return points.map(p => ({
      x: p.x - c.x + origin.x,
      y: p.y - c.y + origin.y,
    }));
  }

  // ── Golden section search ─────────────────────────────────────────

  _distanceAtBestAngle(points, template, a, b, threshold) {
    let x1 = PHI * a + (1 - PHI) * b;
    let x2 = (1 - PHI) * a + PHI * b;
    let f1 = this._distanceAtAngle(points, template, x1);
    let f2 = this._distanceAtAngle(points, template, x2);

    while (Math.abs(b - a) > threshold) {
      if (f1 < f2) {
        b = x2;
        x2 = x1;
        f2 = f1;
        x1 = PHI * a + (1 - PHI) * b;
        f1 = this._distanceAtAngle(points, template, x1);
      } else {
        a = x1;
        x1 = x2;
        f1 = f2;
        x2 = (1 - PHI) * a + PHI * b;
        f2 = this._distanceAtAngle(points, template, x2);
      }
    }

    return Math.min(f1, f2);
  }

  _distanceAtAngle(points, template, angle) {
    const rotated = this._rotateBy(points, angle);
    return this._pathDistance(rotated, template);
  }

  // ── Utility ───────────────────────────────────────────────────────

  _pathDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += this._distance(a[i], b[i]);
    }
    return sum / a.length;
  }

  _pathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += this._distance(points[i - 1], points[i]);
    }
    return len;
  }

  _centroid(points) {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  _boundingBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  _distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Default rune templates ────────────────────────────────────────
  // Each template is generated programmatically for easy editing.
  // To add a new rune: add an entry here and it's immediately castable.

  static getDefaultTemplates() {
    const templates = [];

    // Grey Bolt — lightning bolt ⚡ (bottom-left → up-right → kink right → down-right)
    const bolt = [];
    const boltVerts = [
      { x: 0, y: 100 },   // bottom-left start
      { x: 35, y: 10 },   // up-right
      { x: 60, y: 45 },   // kink down-right
      { x: 100, y: 100 }, // down-right to bottom
    ];
    for (let i = 0; i < boltVerts.length - 1; i++) {
      for (let t = 0; t < 10; t++) {
        const frac = t / 10;
        bolt.push({
          x: boltVerts[i].x + (boltVerts[i + 1].x - boltVerts[i].x) * frac,
          y: boltVerts[i].y + (boltVerts[i + 1].y - boltVerts[i].y) * frac,
        });
      }
    }
    templates.push({ name: 'grey_bolt', points: bolt });

    // Shield — square (multiple starting corners for robust matching)
    // Dense interpolation (16 per side) to clearly distinguish from triangle
    const sqCorners = [
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],  // top-left start
      [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 }],  // top-right start
      [{ x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 0 }, { x: 100, y: 0 }],  // bottom-right start
      [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],  // bottom-left start
    ];
    for (const corners of sqCorners) {
      const sq = [];
      const verts = [...corners, corners[0]]; // close the shape
      for (let i = 0; i < verts.length - 1; i++) {
        for (let t = 0; t < 16; t++) {
          const frac = t / 16;
          sq.push({
            x: verts[i].x + (verts[i + 1].x - verts[i].x) * frac,
            y: verts[i].y + (verts[i + 1].y - verts[i].y) * frac,
          });
        }
      }
      templates.push({ name: 'shield', points: sq });
    }

    // Fireball — triangle (clockwise from top)
    const tri = [];
    const triVerts = [
      { x: 50, y: 0 }, { x: 100, y: 87 }, { x: 0, y: 87 }, { x: 50, y: 0 },
    ];
    for (let i = 0; i < triVerts.length - 1; i++) {
      for (let t = 0; t < 10; t++) {
        const frac = t / 10;
        tri.push({
          x: triVerts[i].x + (triVerts[i + 1].x - triVerts[i].x) * frac,
          y: triVerts[i].y + (triVerts[i + 1].y - triVerts[i].y) * frac,
        });
      }
    }
    templates.push({ name: 'fireball', points: tri });

    // Earth Barrage — zigzag W
    const zigzag = [];
    const zVerts = [
      { x: 0, y: 0 }, { x: 25, y: 100 }, { x: 50, y: 0 },
      { x: 75, y: 100 }, { x: 100, y: 0 },
    ];
    for (let i = 0; i < zVerts.length - 1; i++) {
      for (let t = 0; t < 6; t++) {
        const frac = t / 6;
        zigzag.push({
          x: zVerts[i].x + (zVerts[i + 1].x - zVerts[i].x) * frac,
          y: zVerts[i].y + (zVerts[i + 1].y - zVerts[i].y) * frac,
        });
      }
    }
    templates.push({ name: 'earth_barrage', points: zigzag });

    // Air Choke — inward spiral (3 turns)
    const spiral = [];
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      const angle = t * Math.PI * 6;
      const radius = 50 - t * 40;
      spiral.push({
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle),
      });
    }
    templates.push({ name: 'air_choke', points: spiral });

    // Water Beam — S-curve (one full sine period)
    const sCurve = [];
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      sCurve.push({
        x: t * 100,
        y: 50 + 40 * Math.sin(t * Math.PI * 2),
      });
    }
    templates.push({ name: 'water_beam', points: sCurve });

    return templates;
  }
}
