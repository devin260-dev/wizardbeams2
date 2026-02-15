import { BALANCE } from '../data/BalanceConfig.js';
import { Button } from '../rendering/UIComponents.js';
import { getSpell } from '../data/SpellDatabase.js';

export class RestScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.healButton = new Button(200, 250, 200, 50, 'Heal 30% HP', { color: '#225522', hoverColor: '#33aa33', fontSize: 14 });
    this.upgradeButton = new Button(500, 250, 200, 50, 'Upgrade Spell', { color: '#552222', hoverColor: '#aa3333', fontSize: 14 });
    this.continueButton = new Button(380, 420, 200, 40, 'Continue', { color: '#333', hoverColor: '#555', fontSize: 14 });
    this.choiceMade = false;
    this.choiceText = '';
    this.upgradeGems = [];
    this.showUpgradeList = false;
  }

  enter(data) {
    this.runState = data.runState;
    this.choiceMade = false;
    this.choiceText = '';
    this.showUpgradeList = false;

    // Find upgradable spell gems
    this.upgradeGems = this.runState.gems.filter(g => g.spell_id && !g.upgraded);
    this.upgradeButton.disabled = this.upgradeGems.length === 0;
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();
    this.healButton.updateHover(mouse.x, mouse.y);
    this.upgradeButton.updateHover(mouse.x, mouse.y);
    this.continueButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    if (this.choiceMade) {
      if (this.continueButton.isClicked(click.x, click.y)) {
        this.sceneManager.changeScene('map', { runState: this.runState });
      }
      return;
    }

    if (this.showUpgradeList) {
      // Click on a gem to upgrade
      for (let i = 0; i < this.upgradeGems.length; i++) {
        const gy = 320 + i * 30;
        if (click.x >= 200 && click.x <= 700 && click.y >= gy && click.y <= gy + 25) {
          const gem = this.upgradeGems[i];
          gem.upgraded = true;
          this.choiceMade = true;
          this.showUpgradeList = false;
          this.choiceText = `Upgraded ${getSpell(gem.spell_id)?.name || gem.spell_id}!`;
          return;
        }
      }
      return;
    }

    if (this.healButton.isClicked(click.x, click.y) && !this.choiceMade) {
      const before = this.runState.hp;
      this.runState.heal(BALANCE.meta.rest_site_heal_percent);
      this.choiceMade = true;
      this.choiceText = `Healed ${this.runState.hp - before} HP (${this.runState.hp}/${this.runState.max_hp})`;
    }

    if (this.upgradeButton.isClicked(click.x, click.y) && !this.choiceMade) {
      this.showUpgradeList = true;
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#0a1a0a');
    r.drawText('REST SITE', 480, 20, '#44cc44', 24, 'center');
    r.drawText(`HP: ${this.runState.hp}/${this.runState.max_hp}`, 480, 60, '#cc4444', 14, 'center');

    if (!this.choiceMade && !this.showUpgradeList) {
      this.healButton.render(r);
      this.upgradeButton.render(r);
      if (this.upgradeGems.length === 0) {
        r.drawText('No spell gems to upgrade', 600, 310, '#664444', 10, 'center');
      }
    }

    if (this.showUpgradeList) {
      r.drawText('Choose a spell gem to upgrade:', 480, 290, '#ffcc88', 14, 'center');
      for (let i = 0; i < this.upgradeGems.length; i++) {
        const gem = this.upgradeGems[i];
        const gy = 320 + i * 30;
        r.drawRect(200, gy, 500, 25, '#222');
        r.drawRectOutline(200, gy, 500, 25, '#555');
        r.drawText(`${getSpell(gem.spell_id)?.name} (${gem.element || 'neutral'} / ${gem.school})`, 210, gy + 5, '#ffcc88', 11);
      }
    }

    if (this.choiceMade) {
      r.drawText(this.choiceText, 480, 370, '#00ff00', 16, 'center');
      this.continueButton.render(r);
    }
  }
}
