export class SceneManager {
  constructor(gameLoop) {
    this.scenes = {};
    this.activeScene = null;
    this.activeSceneName = null;
    this.gameLoop = gameLoop;
  }

  register(name, scene) {
    this.scenes[name] = scene;
  }

  changeScene(name, data) {
    if (this.activeScene && this.activeScene.exit) {
      this.activeScene.exit();
    }
    this.activeScene = this.scenes[name];
    this.activeSceneName = name;
    if (this.activeScene && this.activeScene.enter) {
      this.activeScene.enter(data);
    }
    this.gameLoop.setScene(this.activeScene);
  }

  getActiveSceneName() {
    return this.activeSceneName;
  }
}
