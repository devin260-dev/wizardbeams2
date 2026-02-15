import { Button } from '../rendering/UIComponents.js';
import { generateRandomGem } from '../data/GemDatabase.js';
import { getSpell } from '../data/SpellDatabase.js';

const ELEMENT_COLORS = {
  fire: '#ff4400', water: '#0088ff', earth: '#8b5e3c', air: '#eeeeff', '': '#888',
};

export class ShrineScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.gems = [];
    this.chosen = false;
    this.chosenTimer = 0;
  }

  enter(data) {
    this.runState = data.runState;
    this.gems = [];
    this.chosen = false;
    this.chosenTimer = 0;
    for (let i = 0; i < 3; i++) {
      this.gems.push(generateRandomGem(this.runState.current_tier));
    }
  }

  exit() {}

  update(dt) {
    if (this.chosen) {
      this.chosenTimer += dt;
      if (this.chosenTimer >= 1.0) {
        this.sceneManager.changeScene('map', { runState: this.runState });
      }
      return;
    }

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    for (let i = 0; i < 3; i++) {
      const gx = 150 + i * 230;
      const gy = 150;
      if (click.x >= gx && click.x <= gx + 200 && click.y >= gy && click.y <= gy + 200) {
        this.runState.addGem(this.gems[i]);
        this.chosen = true;
        this.chosenTimer = 0;
        return;
      }
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#0a1a1a');
    r.drawText('SPELL SHRINE', 480, 20, '#44cccc', 24, 'center');
    r.drawText('Choose one gem (free)', 480, 55, '#888', 14, 'center');

    for (let i = 0; i < 3; i++) {
      const gem = this.gems[i];
      const gx = 150 + i * 230;
      const gy = 150;

      r.drawRect(gx, gy, 200, 200, '#1a2a2a');
      r.drawRectOutline(gx, gy, 200, 200, '#44cccc');

      r.drawCircle(gx + 15, gy + 20, 6, ELEMENT_COLORS[gem.element] || '#888');
      r.drawText(`${gem.element || 'none'} / ${gem.school}`, gx + 30, gy + 14, '#aaa', 11);
      if (gem.spell_id) {
        r.drawText(getSpell(gem.spell_id)?.name || gem.spell_id, gx + 10, gy + 50, '#ffcc88', 14);
      } else {
        r.drawText('(no spell)', gx + 10, gy + 50, '#666', 12);
      }
      r.drawText(`Passive: ${gem.passive_stat}`, gx + 10, gy + 80, '#88ccff', 11);
      r.drawText(`${gem.passive_value > 0 ? '+' : ''}${gem.passive_value}`, gx + 10, gy + 98, '#aaa', 11);
    }

    if (this.chosen) {
      r.drawText('Gem acquired!', 480, 420, '#00ff00', 18, 'center');
    }
  }
}
