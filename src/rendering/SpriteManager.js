// Placeholder sprite manager for future art assets
// Currently all rendering is done inline with draw calls
export class SpriteManager {
  constructor() {
    this.sprites = {};
  }

  load(name, src) {
    // Future: load image assets
  }

  get(name) {
    return this.sprites[name] || null;
  }
}
