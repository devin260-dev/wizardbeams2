export class GameLoop {
  constructor(inputManager) {
    this.lastTime = 0;
    this.elapsed = 0;
    this.running = false;
    this.scene = null;
    this.ctx = null;
    this.inputManager = inputManager;
  }

  start(ctx) {
    this.ctx = ctx;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  setScene(scene) {
    this.scene = scene;
  }

  loop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = timestamp;
    this.elapsed += dt;

    if (this.scene) {
      this.scene.update(dt);
      this.scene.render(this.ctx);
    }

    // Reset per-frame input flags AFTER scene has processed them
    if (this.inputManager) {
      this.inputManager.resetFrame();
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
