import { Button } from '../rendering/UIComponents.js';
import { RunState } from './RunState.js';
import { generateMap } from './MapGenerator.js';
import { generateEnemy } from '../data/EnemyDatabase.js';
import { createGem } from '../data/GemDatabase.js';
import { BALANCE } from '../data/BalanceConfig.js';
import { GEM_SLOT_NODES } from '../combat/NodeNetwork.js';

const SCHOOL_COLORS = { order: '#8000cc', chaos: '#ffe600', pure: '#ff4d00' };

export class StartScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;

    this.selectedSchool = null;

    this.schoolButtons = {
      order: new Button(250, 230, 120, 40, 'Order', { color: '#3a0066', hoverColor: '#5500aa', fontSize: 16 }),
      chaos: new Button(410, 230, 120, 40, 'Chaos', { color: '#665500', hoverColor: '#aa8800', fontSize: 16 }),
      pure: new Button(570, 230, 120, 40, 'Pure', { color: '#662200', hoverColor: '#aa3300', fontSize: 16 }),
    };

    this.beginButton = new Button(380, 340, 200, 50, 'Begin Run', { color: '#224422', hoverColor: '#33aa33', fontSize: 20 });
    this.devDuelButton = new Button(380, 400, 200, 36, 'Dev Duel', { color: '#443322', hoverColor: '#886644', fontSize: 16 });
    this.runeTestButton = new Button(600, 400, 120, 36, 'Rune Test', { color: '#222244', hoverColor: '#444488', fontSize: 13 });

    this.selectedDevTier = 1;
    this.tierButtons = {};
    const tierColors = ['#333322', '#332222', '#222233', '#223322', '#332233'];
    const tierHovers = ['#666633', '#663333', '#333366', '#336633', '#663366'];
    for (let t = 1; t <= 5; t++) {
      this.tierButtons[t] = new Button(
        370 + (t - 1) * 45, 445, 38, 28, `T${t}`,
        { color: tierColors[t - 1], hoverColor: tierHovers[t - 1], fontSize: 13 }
      );
    }
  }

  enter() {
    this.selectedSchool = null;
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();

    for (const btn of Object.values(this.schoolButtons)) btn.updateHover(mouse.x, mouse.y);
    this.beginButton.updateHover(mouse.x, mouse.y);
    this.beginButton.disabled = !this.selectedSchool;
    this.devDuelButton.updateHover(mouse.x, mouse.y);
    this.runeTestButton.updateHover(mouse.x, mouse.y);
    for (const btn of Object.values(this.tierButtons)) btn.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    for (const [school, btn] of Object.entries(this.schoolButtons)) {
      if (btn.isClicked(click.x, click.y)) {
        this.selectedSchool = school;
        return;
      }
    }

    if (this.beginButton.isClicked(click.x, click.y)) {
      this._startRun();
      return;
    }

    if (this.devDuelButton.isClicked(click.x, click.y)) {
      this._startDevDuel();
      return;
    }

    if (this.runeTestButton.isClicked(click.x, click.y)) {
      this.sceneManager.changeScene('runetest');
      return;
    }

    for (const [tier, btn] of Object.entries(this.tierButtons)) {
      if (btn.isClicked(click.x, click.y)) {
        this.selectedDevTier = Number(tier);
        return;
      }
    }
  }

  _startRun() {
    const runState = new RunState();
    runState.startNewRun(this.selectedSchool);

    // Starting gems are auto-slotted into shoulder nodes by startNewRun

    // Generate map
    const mapData = generateMap();
    runState.map_data = mapData;
    runState.current_node_id = mapData.startNodeId;

    this.sceneManager.changeScene('map', { runState });
  }

  _startDevDuel() {
    const school = this.selectedSchool || 'pure';

    const runState = new RunState();
    runState.startNewRun(school);

    // Add all spell gems for testing
    runState.addGem(createGem('fire', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'fireball'));
    runState.addGem(createGem('earth', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'earth_barrage'));
    runState.addGem(createGem('air', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'air_choke'));
    runState.addGem(createGem('water', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'water_beam'));

    const enemyData = generateEnemy(this.selectedDevTier);

    // Go to loadout so player can equip gems before combat
    this.sceneManager.changeScene('loadout', { runState, enemyData, devMode: true });
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#0a0a1a');

    r.drawText('WIZARD BEAMS', 480, 80, '#8000cc', 40, 'center', 'middle');
    r.drawText('Astral Gauntlet Prototype', 480, 120, '#555', 14, 'center');

    r.drawText('Choose School Attunement:', 480, 195, '#aaa', 14, 'center');
    for (const [school, btn] of Object.entries(this.schoolButtons)) {
      btn.render(r);
      if (this.selectedSchool === school) {
        r.drawRectOutline(btn.x - 2, btn.y - 2, btn.w + 4, btn.h + 4, '#ffffff', 2);
      }
    }

    // Selection summary
    if (this.selectedSchool) {
      r.drawText(`School: ${this.selectedSchool}`, 480, 320, SCHOOL_COLORS[this.selectedSchool], 14, 'center');
    }

    this.beginButton.render(r);
    this.devDuelButton.render(r);
    this.runeTestButton.render(r);

    r.drawText('Enemy Tier:', 320, 459, '#666', 11, 'center');
    for (const [tier, btn] of Object.entries(this.tierButtons)) {
      btn.render(r);
      if (this.selectedDevTier === Number(tier)) {
        r.drawRectOutline(btn.x - 2, btn.y - 2, btn.w + 4, btn.h + 4, '#ffffff', 2);
      }
    }
  }
}
