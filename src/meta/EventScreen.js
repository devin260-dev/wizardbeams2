import { Button } from '../rendering/UIComponents.js';
import { generateRandomGem, generatePenaltyGem } from '../data/GemDatabase.js';
import { generateEnemy } from '../data/EnemyDatabase.js';
import { GEM_SLOT_NODES } from '../combat/NodeNetwork.js';

const EVENTS = [
  {
    name: 'Wandering Merchant',
    text: 'A robed figure offers you a mysterious gem.',
    apply(runState) {
      const gem = generateRandomGem(runState.current_tier);
      runState.addGem(gem);
      return 'You received a free gem!';
    },
  },
  {
    name: 'Healing Spring',
    text: 'Glowing waters flow from an ancient fountain.',
    apply(runState) {
      runState.hp = runState.max_hp;
      return 'Fully healed!';
    },
  },
  {
    name: 'Cursed Ground',
    text: 'Dark energy seeps from the earth. Gold glints among the bones.',
    apply(runState) {
      runState.takeDamage(5);
      runState.addGold(20);
      return 'Took 5 damage, gained 20 gold.';
    },
  },
  {
    name: 'Abandoned Cache',
    text: 'An old chest lies half-buried. Its contents shimmer...',
    apply(runState) {
      const isPenalty = Math.random() < 0.5;
      const gem = isPenalty ? generatePenaltyGem() : generateRandomGem(runState.current_tier);
      runState.addGem(gem);
      return isPenalty ? 'Found a cursed gem...' : 'Found a useful gem!';
    },
  },
  {
    name: 'Ambush!',
    text: 'A rival wizard leaps from the shadows!',
    apply(runState, sceneManager) {
      // Auto-slot unslotted gems
      const unslotted = runState.getUnslottedGems();
      const slotsUsed = new Set(Object.keys(runState.gem_slots));
      const availableSlots = GEM_SLOT_NODES.filter(s => !slotsUsed.has(s));

      for (let i = 0; i < unslotted.length && i < availableSlots.length; i++) {
        runState.slotGem(unslotted[i].id, availableSlots[i]);
      }

      const enemy = generateEnemy(runState.current_tier);
      // Ambush goes straight to combat - no loadout screen
      sceneManager.changeScene('combat', {
        runState,
        enemyData: enemy,
        isAmbush: true,
      });
      return null; // No result text, going to combat
    },
  },
  {
    name: 'Meditation',
    text: 'A peaceful grove invites you to rest.',
    apply(runState) {
      runState.heal(0.15);
      return 'Healed 15% HP.';
    },
  },
];

export class EventScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.event = null;
    this.resultText = null;
    this.resolved = false;
    this.proceedButton = new Button(380, 350, 200, 40, 'Proceed', { color: '#442266', hoverColor: '#663399', fontSize: 14 });
    this.continueButton = new Button(380, 420, 200, 40, 'Continue', { color: '#333', hoverColor: '#555', fontSize: 14 });
  }

  enter(data) {
    this.runState = data.runState;
    this.event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    this.resultText = null;
    this.resolved = false;
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();
    this.proceedButton.updateHover(mouse.x, mouse.y);
    this.continueButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    if (!this.resolved && this.proceedButton.isClicked(click.x, click.y)) {
      this.resultText = this.event.apply(this.runState, this.sceneManager);
      this.resolved = true;
      if (this.resultText === null) return; // Ambush went to combat
    }

    if (this.resolved && this.continueButton.isClicked(click.x, click.y)) {
      this.sceneManager.changeScene('map', { runState: this.runState });
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#1a0a2a');
    r.drawText('MYSTERY EVENT', 480, 20, '#8844cc', 24, 'center');

    if (this.event) {
      r.drawText(this.event.name, 480, 120, '#cc88ff', 20, 'center');
      r.drawText(this.event.text, 480, 180, '#aaa', 14, 'center');
    }

    if (!this.resolved) {
      this.proceedButton.render(r);
    }

    if (this.resolved && this.resultText) {
      r.drawText(this.resultText, 480, 370, '#00ff00', 16, 'center');
      this.continueButton.render(r);
    }
  }
}
