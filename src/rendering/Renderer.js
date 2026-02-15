export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.width = ctx.canvas.width;
    this.height = ctx.canvas.height;
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawRect(x, y, w, h, color, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.globalAlpha = 1;
  }

  drawRectOutline(x, y, w, h, color, lineWidth = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, w, h);
  }

  drawCircle(cx, cy, r, color, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }

  drawCircleOutline(cx, cy, r, color, lineWidth = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawArc(cx, cy, r, startAngle, endAngle, color, lineWidth = 2) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, startAngle, endAngle);
    this.ctx.stroke();
  }

  drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawPolyline(points, color, lineWidth = 1, closed = false) {
    if (points.length < 2) return;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    if (closed) this.ctx.closePath();
    this.ctx.stroke();
  }

  drawFilledPolygon(points, color, alpha = 1) {
    if (points.length < 3) return;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }

  drawText(text, x, y, color = '#fff', fontSize = 14, align = 'left', baseline = 'top') {
    this.ctx.fillStyle = color;
    this.ctx.font = `${fontSize}px monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }

  drawBar(x, y, w, h, percent, fgColor, bgColor = '#333') {
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = fgColor;
    this.ctx.fillRect(x, y, w * Math.max(0, Math.min(1, percent)), h);
  }
}
