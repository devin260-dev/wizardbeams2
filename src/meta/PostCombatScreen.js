import { BALANCE } from '../data/BalanceConfig.js';
import { Button } from '../rendering/UIComponents.js';
import { generateRandomGem } from '../data/GemDatabase.js';
import { getSpell } from '../data/SpellDatabase.js';

const ELEMENT_COLORS = {
  fire: '#ff4400', water: '#0088ff', earth: '#8b5e3c', air: '#eeeeff', '': '#888',
};

export class PostCombatScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.goldReward = 0;
    this.gemOfferings = [];
    this.chosen = false;
    this.declined = false;
    this.continueButton = new Button(380, 460, 200, 40, 'Continue', { color: '#333', hoverColor: '#555', fontSize: 14 });
    this.declineButton = new Button(380, 400, 200, 30, 'Decline', { color: '#442222', hoverColor: '#663333', fontSize: 12 });
  }

  enter(data) {
    this.runState = data.runState;
    this.goldReward = data.goldReward || 0;
    this.runState.fights_won++;
    this.chosen = false;
    this.declined = false;

    // Generate gem offerings
    this.gemOfferings = [];
    for (let i = 0; i < BALANCE.meta.post_combat_gem_offering_count; i++) {
      this.gemOfferings.push(generateRandomGem(this.runState.current_tier));
    }

    // Check for boss victory
    this.isBossVictory = data.enemyData && data.enemyData.is_boss;
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();
    this.continueButton.updateHover(mouse.x, mouse.y);
    this.declineButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    if (!this.chosen && !this.declined) {
      // Gem selection
      for (let i = 0; i < this.gemOfferings.length; i++) {
        const gx = 120 + i * 240;
        const gy = 180;
        if (click.x >= gx && click.x <= gx + 210 && click.y >= gy && click.y <= gy + 170) {
          this.runState.addGem(this.gemOfferings[i]);
          this.chosen = true;
          return;
        }
      }

      if (this.declineButton.isClicked(click.x, click.y)) {
        this.declined = true;
        return;
      }
    }

    if ((this.chosen || this.declined) && this.continueButton.isClicked(click.x, click.y)) {
      if (this.isBossVictory) {
        this.sceneManager.changeScene('gameover', {
          runState: this.runState,
          result: 'victory',
        });
      } else {
        this.sceneManager.changeScene('map', { runState: this.runState });
      }
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#1a1a3a');

    r.drawText('VICTORY!', 480, 30, '#00cc00', 28, 'center');
    r.drawText(`Gold earned: +${this.goldReward}`, 480, 70, '#cccc44', 16, 'center');
    r.drawText(`Total gold: ${this.runState.gold}`, 480, 95, '#888', 12, 'center');

    if (this.isBossVictory) {
      r.drawText('THE ARCHMAGE IS DEFEATED!', 480, 130, '#ffcc00', 18, 'center');
    }

    r.drawText('Choose a gem reward (or decline):', 480, 155, '#aaa', 13, 'center');

    for (let i = 0; i < this.gemOfferings.length; i++) {
      const gem = this.gemOfferings[i];
      const gx = 120 + i * 240;
      const gy = 180;

      r.drawRect(gx, gy, 210, 170, '#1a1a2e');
      r.drawRectOutline(gx, gy, 210, 170, '#555');

      r.drawCircle(gx + 15, gy + 20, 6, ELEMENT_COLORS[gem.element] || '#888');
      r.drawText(`${gem.element || 'none'} / ${gem.school}`, gx + 30, gy + 14, '#aaa', 11);

      if (gem.spell_id) {
        r.drawText(getSpell(gem.spell_id)?.name || gem.spell_id, gx + 10, gy + 50, '#ffcc88', 13);
      } else {
        r.drawText('(no spell)', gx + 10, gy + 50, '#666', 12);
      }

      r.drawText(`Passive: ${gem.passive_stat}`, gx + 10, gy + 80, '#88ccff', 10);
      r.drawText(`${gem.passive_value > 0 ? '+' : ''}${gem.passive_value}`, gx + 10, gy + 95, '#aaa', 10);
    }

    if (this.chosen) {
      r.drawText('Gem acquired!', 480, 380, '#00ff00', 16, 'center');
    }
    if (this.declined) {
      r.drawText('No gem taken.', 480, 380, '#888', 16, 'center');
    }

    if (!this.chosen && !this.declined) {
      this.declineButton.render(r);
    }

    if (this.chosen || this.declined) {
      this.continueButton.render(r);
    }
  }
}
