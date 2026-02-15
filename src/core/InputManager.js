export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.clickX = 0;
    this.clickY = 0;
    this.keysPressed = {};
    this.keysJustPressed = {};
    this.scaleFactor = 1;

    this._updateScaleFactor();

    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('resize', () => this._updateScaleFactor());
  }

  _updateScaleFactor() {
    const rect = this.canvas.getBoundingClientRect();
    this.scaleFactor = this.canvas.width / rect.width;
  }

  _toGameCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * this.scaleFactor,
      y: (e.clientY - rect.top) * this.scaleFactor
    };
  }

  _onMouseMove(e) {
    const pos = this._toGameCoords(e);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
  }

  _onMouseDown(e) {
    this.mouseDown = true;
    const pos = this._toGameCoords(e);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
  }

  _onMouseUp(e) {
    this.mouseDown = false;
    const pos = this._toGameCoords(e);
    this.mouseX = pos.x;
    this.mouseY = pos.y;
    this.clicked = true;
    this.clickX = pos.x;
    this.clickY = pos.y;
  }

  _onKeyDown(e) {
    if (!this.keysPressed[e.key]) {
      this.keysJustPressed[e.key] = true;
    }
    this.keysPressed[e.key] = true;
  }

  _onKeyUp(e) {
    this.keysPressed[e.key] = false;
  }

  resetFrame() {
    this.clicked = false;
    this.keysJustPressed = {};
  }

  isMouseDown() {
    return this.mouseDown;
  }

  getMousePos() {
    return { x: this.mouseX, y: this.mouseY };
  }

  wasClicked() {
    return this.clicked;
  }

  getClickPos() {
    return { x: this.clickX, y: this.clickY };
  }

  wasKeyPressed(key) {
    return !!this.keysJustPressed[key];
  }

  isKeyDown(key) {
    return !!this.keysPressed[key];
  }

  isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  isPointInCircle(x, y, cx, cy, r) {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }
}
