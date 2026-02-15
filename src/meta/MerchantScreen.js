import { BALANCE } from '../data/BalanceConfig.js';
import { Button } from '../rendering/UIComponents.js';
import { generateRandomGem } from '../data/GemDatabase.js';
import { getSpell } from '../data/SpellDatabase.js';

const ELEMENT_COLORS = {
  fire: '#ff4400', water: '#0088ff', earth: '#8b5e3c', air: '#eeeeff', '': '#888',
};

export class MerchantScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.gems = [];
    this.bought = new Set();
    this.leaveButton = new Button(800, 480, 120, 40, 'Leave', { color: '#553322', hoverColor: '#885533', fontSize: 16 });
  }

  enter(data) {
    this.runState = data.runState;
    this.gems = [];
    this.bought = new Set();
    const count = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      this.gems.push(generateRandomGem(this.runState.current_tier));
    }
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();
    this.leaveButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    if (this.leaveButton.isClicked(click.x, click.y)) {
      this.sceneManager.changeScene('map', { runState: this.runState });
      return;
    }

    // Buy gems
    for (let i = 0; i < this.gems.length; i++) {
      if (this.bought.has(i)) continue;
      const gx = 150 + (i % 3) * 220;
      const gy = 120 + Math.floor(i / 3) * 180;
      if (click.x >= gx && click.x <= gx + 200 && click.y >= gy && click.y <= gy + 150) {
        if (this.runState.spendGold(BALANCE.gem.price)) {
          this.runState.addGem(this.gems[i]);
          this.bought.add(i);
        }
        return;
      }
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#1a1008');

    r.drawText('MERCHANT', 480, 20, '#cccc44', 24, 'center');
    r.drawText(`Gold: ${this.runState.gold}`, 480, 50, '#cccc44', 14, 'center');

    for (let i = 0; i < this.gems.length; i++) {
      const gem = this.gems[i];
      const gx = 150 + (i % 3) * 220;
      const gy = 120 + Math.floor(i / 3) * 180;
      const bought = this.bought.has(i);

      r.drawRect(gx, gy, 200, 150, bought ? '#111' : '#222');
      r.drawRectOutline(gx, gy, 200, 150, bought ? '#333' : '#666');

      if (bought) {
        r.drawText('SOLD', gx + 100, gy + 75, '#444', 20, 'center', 'middle');
        continue;
      }

      r.drawCircle(gx + 15, gy + 20, 6, ELEMENT_COLORS[gem.element] || '#888');
      r.drawText(`${gem.element || 'none'} / ${gem.school}`, gx + 30, gy + 14, '#aaa', 11);
      if (gem.spell_id) {
        r.drawText(getSpell(gem.spell_id)?.name || gem.spell_id, gx + 10, gy + 40, '#ffcc88', 12);
      }
      r.drawText(`Passive: ${gem.passive_stat}`, gx + 10, gy + 65, '#88ccff', 10);
      r.drawText(`${gem.passive_value > 0 ? '+' : ''}${gem.passive_value}`, gx + 10, gy + 80, '#aaa', 10);
      r.drawText(`Price: ${BALANCE.gem.price}g`, gx + 10, gy + 110, '#cccc44', 12);

      if (this.runState.gold < BALANCE.gem.price) {
        r.drawText('Cannot afford', gx + 10, gy + 130, '#cc4444', 10);
      }
    }

    this.leaveButton.render(r);
  }
}
