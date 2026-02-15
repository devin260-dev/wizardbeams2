import { Button } from '../rendering/UIComponents.js';

export class GameOverScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.result = 'defeat';
    this.newRunButton = new Button(380, 420, 200, 50, 'New Run', { color: '#333', hoverColor: '#555', fontSize: 18 });
  }

  enter(data) {
    this.runState = data.runState;
    this.result = data.result || 'defeat';
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();
    this.newRunButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    if (this.newRunButton.isClicked(click.x, click.y)) {
      this.sceneManager.changeScene('start');
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#0a0a0a');

    if (this.result === 'victory') {
      r.drawText('VICTORY!', 480, 100, '#00ff00', 40, 'center', 'middle');
      r.drawText('The Archmage falls. The Astral Gauntlet is yours.', 480, 160, '#888', 14, 'center');
    } else {
      r.drawText('DEFEAT', 480, 100, '#ff0000', 40, 'center', 'middle');
      r.drawText('Your journey ends here...', 480, 160, '#888', 14, 'center');
    }

    // Stats
    const rs = this.runState;
    if (rs) {
      r.drawText(`Tier Reached: ${rs.current_tier}`, 480, 220, '#aaa', 14, 'center');
      r.drawText(`Fights Won: ${rs.fights_won}`, 480, 245, '#aaa', 14, 'center');
      r.drawText(`HP Remaining: ${Math.max(0, rs.hp)}/${rs.max_hp}`, 480, 270, '#aaa', 14, 'center');
      r.drawText(`Gold Earned: ${rs.total_gold_earned}`, 480, 295, '#aaa', 14, 'center');
      r.drawText(`Gems Collected: ${rs.gems_collected}`, 480, 320, '#aaa', 14, 'center');
    }

    this.newRunButton.render(r);
  }
}
