export class Button {
  constructor(x, y, w, h, text, options = {}) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.text = text;
    this.color = options.color || '#555';
    this.hoverColor = options.hoverColor || '#777';
    this.disabledColor = options.disabledColor || '#333';
    this.textColor = options.textColor || '#fff';
    this.disabledTextColor = options.disabledTextColor || '#666';
    this.fontSize = options.fontSize || 14;
    this.disabled = false;
    this.hovered = false;
    this.visible = true;
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  updateHover(mouseX, mouseY) {
    this.hovered = mouseX >= this.x && mouseX <= this.x + this.w &&
                   mouseY >= this.y && mouseY <= this.y + this.h;
  }

  isClicked(clickX, clickY) {
    if (!this.visible || this.disabled) return false;
    return clickX >= this.x && clickX <= this.x + this.w &&
           clickY >= this.y && clickY <= this.y + this.h;
  }

  render(renderer) {
    if (!this.visible) return;
    const color = this.disabled ? this.disabledColor : (this.hovered ? this.hoverColor : this.color);
    const textCol = this.disabled ? this.disabledTextColor : this.textColor;
    renderer.drawRect(this.x, this.y, this.w, this.h, color);
    renderer.drawRectOutline(this.x, this.y, this.w, this.h, '#888');
    renderer.drawText(this.text, this.x + this.w / 2, this.y + this.h / 2, textCol, this.fontSize, 'center', 'middle');
  }
}

export class ProgressBar {
  constructor(x, y, w, h, options = {}) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.fgColor = options.fgColor || '#0f0';
    this.bgColor = options.bgColor || '#333';
    this.borderColor = options.borderColor || '#888';
    this.percent = 0;
  }

  render(renderer) {
    renderer.drawBar(this.x, this.y, this.w, this.h, this.percent, this.fgColor, this.bgColor);
    renderer.drawRectOutline(this.x, this.y, this.w, this.h, this.borderColor);
  }
}

export class PipBar {
  constructor(x, y, pipWidth, pipHeight, maxPips, options = {}) {
    this.x = x;
    this.y = y;
    this.pipWidth = pipWidth;
    this.pipHeight = pipHeight;
    this.maxPips = maxPips;
    this.currentPips = maxPips;
    this.gap = options.gap || 1;
    this.fgColor = options.fgColor || '#c00';
    this.bgColor = options.bgColor || '#400';
    this.borderColor = options.borderColor || '#888';
  }

  get totalWidth() {
    return this.maxPips * (this.pipWidth + this.gap) - this.gap;
  }

  render(renderer) {
    for (let i = 0; i < this.maxPips; i++) {
      const px = this.x + i * (this.pipWidth + this.gap);
      const color = i < this.currentPips ? this.fgColor : this.bgColor;
      renderer.drawRect(px, this.y, this.pipWidth, this.pipHeight, color);
    }
  }
}

export class Label {
  constructor(x, y, text, options = {}) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = options.color || '#fff';
    this.fontSize = options.fontSize || 14;
    this.align = options.align || 'left';
    this.baseline = options.baseline || 'top';
  }

  render(renderer) {
    renderer.drawText(this.text, this.x, this.y, this.color, this.fontSize, this.align, this.baseline);
  }
}
