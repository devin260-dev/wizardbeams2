import { Button } from '../rendering/UIComponents.js';
import { RunState } from './RunState.js';
import { generateMap } from './MapGenerator.js';
import { generateEnemy } from '../data/EnemyDatabase.js';
import { createGem } from '../data/GemDatabase.js';
import { BALANCE } from '../data/BalanceConfig.js';
import { GEM_SLOT_NODES } from '../combat/NodeNetwork.js';

const SCHOOL_COLORS = { order: '#8000cc', chaos: '#ffe600', pure: '#ff4d00' };
const ELEMENT_COLORS = { fire: '#ff4400', water: '#0088ff', earth: '#8b5e3c', air: '#eeeeff' };

export class StartScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;

    this.selectedSchool = null;
    this.selectedElement = null;

    this.schoolButtons = {
      order: new Button(250, 230, 120, 40, 'Order', { color: '#3a0066', hoverColor: '#5500aa', fontSize: 16 }),
      chaos: new Button(410, 230, 120, 40, 'Chaos', { color: '#665500', hoverColor: '#aa8800', fontSize: 16 }),
      pure: new Button(570, 230, 120, 40, 'Pure', { color: '#662200', hoverColor: '#aa3300', fontSize: 16 }),
    };

    this.elementButtons = {
      fire: new Button(200, 330, 100, 36, 'Fire', { color: '#662200', hoverColor: '#aa3300', fontSize: 14 }),
      water: new Button(320, 330, 100, 36, 'Water', { color: '#003366', hoverColor: '#0066aa', fontSize: 14 }),
      earth: new Button(440, 330, 100, 36, 'Earth', { color: '#3a2a1a', hoverColor: '#6b4e3c', fontSize: 14 }),
      air: new Button(560, 330, 100, 36, 'Air', { color: '#555566', hoverColor: '#8888aa', fontSize: 14 }),
    };

    this.beginButton = new Button(380, 430, 200, 50, 'Begin Run', { color: '#224422', hoverColor: '#33aa33', fontSize: 20 });
    this.devDuelButton = new Button(380, 490, 200, 36, 'Dev Duel', { color: '#443322', hoverColor: '#886644', fontSize: 16 });
  }

  enter() {
    this.selectedSchool = null;
    this.selectedElement = null;
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();

    for (const btn of Object.values(this.schoolButtons)) btn.updateHover(mouse.x, mouse.y);
    for (const btn of Object.values(this.elementButtons)) btn.updateHover(mouse.x, mouse.y);
    this.beginButton.updateHover(mouse.x, mouse.y);
    this.beginButton.disabled = !this.selectedSchool || !this.selectedElement;
    this.devDuelButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    for (const [school, btn] of Object.entries(this.schoolButtons)) {
      if (btn.isClicked(click.x, click.y)) {
        this.selectedSchool = school;
        return;
      }
    }

    for (const [element, btn] of Object.entries(this.elementButtons)) {
      if (btn.isClicked(click.x, click.y)) {
        this.selectedElement = element;
        return;
      }
    }

    if (this.beginButton.isClicked(click.x, click.y)) {
      this._startRun();
      return;
    }

    if (this.devDuelButton.isClicked(click.x, click.y)) {
      this._startDevDuel();
    }
  }

  _startRun() {
    const runState = new RunState();
    runState.startNewRun(this.selectedSchool, this.selectedElement);

    // Auto-slot starting gems
    const slots = GEM_SLOT_NODES;
    for (let i = 0; i < runState.gems.length && i < slots.length; i++) {
      runState.slotGem(runState.gems[i].id, slots[i]);
    }

    // Generate map
    const mapData = generateMap();
    runState.map_data = mapData;
    runState.current_node_id = mapData.startNodeId;

    this.sceneManager.changeScene('map', { runState });
  }

  _startDevDuel() {
    const school = this.selectedSchool || 'pure';
    const element = this.selectedElement || 'fire';

    const runState = new RunState();
    runState.startNewRun(school, element);

    // Add all spell gems for testing
    runState.addGem(createGem('fire', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'fireball'));
    runState.addGem(createGem('earth', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'earth_barrage'));
    runState.addGem(createGem('air', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'air_choke'));
    runState.addGem(createGem('water', 'pure', 'spell_cooldown', BALANCE.passives.spell_cooldown_bonus, 'water_beam'));

    // Generate a tier 1 enemy
    const enemyData = generateEnemy(1, false, false);

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

    r.drawText('Choose Element Attunement:', 480, 305, '#aaa', 14, 'center');
    for (const [element, btn] of Object.entries(this.elementButtons)) {
      btn.render(r);
      if (this.selectedElement === element) {
        r.drawRectOutline(btn.x - 2, btn.y - 2, btn.w + 4, btn.h + 4, '#ffffff', 2);
      }
    }

    // Selection summary
    if (this.selectedSchool) {
      r.drawText(`School: ${this.selectedSchool}`, 480, 390, SCHOOL_COLORS[this.selectedSchool], 14, 'center');
    }
    if (this.selectedElement) {
      r.drawText(`Element: ${this.selectedElement}`, 480, 410, ELEMENT_COLORS[this.selectedElement], 14, 'center');
    }

    this.beginButton.render(r);
    this.devDuelButton.render(r);
    r.drawText('(skip to combat)', 480, 520, '#666', 11, 'center');
  }
}
