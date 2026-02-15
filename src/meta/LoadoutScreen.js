import { BALANCE } from '../data/BalanceConfig.js';
import { Button } from '../rendering/UIComponents.js';
import { NODE_TYPE, GEM_SLOT_NODES, SCHOOL_TO_NODE } from '../combat/NodeNetwork.js';
import { getSpell } from '../data/SpellDatabase.js';

// Node positions (player side, non-mirrored)
const NODE_POSITIONS = {
  crown:          { x: 200, y: 180 },
  third_eye:      { x: 200, y: 210 },
  throat:         { x: 200, y: 240 },
  left_shoulder:  { x: 240, y: 270 },
  right_shoulder: { x: 160, y: 270 },
  sternum:        { x: 200, y: 270 },
  belly:          { x: 200, y: 320 },
  left_elbow:     { x: 250, y: 310 },
  right_elbow:    { x: 150, y: 310 },
  left_hand:      { x: 270, y: 340 },
  right_hand:     { x: 130, y: 340 },
  left_root:      { x: 230, y: 370 },
  right_root:     { x: 170, y: 370 },
};

const ELEMENT_COLORS = {
  fire: '#ff4400',
  water: '#0088ff',
  earth: '#8b5e3c',
  air: '#eeeeff',
  '': '#888',
};

const SCHOOL_COLORS = {
  pure: '#ff4d00',
  order: '#8000cc',
  chaos: '#ffe600',
  neutral: '#808080',
};

export class LoadoutScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.eventBus = eventBus;
    this.input = inputManager;
    this.renderer = renderer;

    this.runState = null;
    this.enemyData = null;
    this.selectedGemId = null;
    this.readyButton = new Button(800, 480, 120, 40, 'READY', { color: '#226622', hoverColor: '#33aa33', fontSize: 18 });
  }

  enter(data) {
    this.runState = data.runState;
    this.enemyData = data.enemyData;
    this.selectedGemId = null;
  }

  exit() {}

  update(dt) {
    const mouse = this.input.getMousePos();
    this.readyButton.updateHover(mouse.x, mouse.y);

    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    // Ready button
    if (this.readyButton.isClicked(click.x, click.y)) {
      this.sceneManager.changeScene('combat', {
        runState: this.runState,
        enemyData: this.enemyData,
      });
      return;
    }

    // Click on a node to place selected gem
    for (const nodeId of GEM_SLOT_NODES) {
      const pos = NODE_POSITIONS[nodeId];
      if (!pos) continue;
      const dx = click.x - pos.x;
      const dy = click.y - pos.y;
      if (dx * dx + dy * dy <= 15 * 15) {
        if (this.selectedGemId) {
          // Check if this node already has a gem -> swap
          const existingGemId = this.runState.gem_slots[nodeId];
          // Find where selected gem currently is
          let selectedCurrentNode = null;
          for (const [nId, gId] of Object.entries(this.runState.gem_slots)) {
            if (gId === this.selectedGemId) {
              selectedCurrentNode = nId;
              break;
            }
          }

          // Place selected gem
          this.runState.slotGem(this.selectedGemId, nodeId);

          // If there was a swap, put old gem where selected was
          if (existingGemId && selectedCurrentNode) {
            this.runState.slotGem(existingGemId, selectedCurrentNode);
          }

          this.selectedGemId = null;
        } else {
          // Select gem from node
          const gemId = this.runState.gem_slots[nodeId];
          if (gemId) {
            this.selectedGemId = gemId;
          }
        }
        return;
      }
    }

    // Click on inventory gem
    const unslotted = this.runState.getUnslottedGems();
    for (let i = 0; i < unslotted.length; i++) {
      const gx = 500 + (i % 4) * 110;
      const gy = 150 + Math.floor(i / 4) * 80;
      if (click.x >= gx && click.x <= gx + 100 && click.y >= gy && click.y <= gy + 60) {
        this.selectedGemId = unslotted[i].id;
        return;
      }
    }

    // Click elsewhere deselects
    this.selectedGemId = null;
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#0a0a1a');

    r.drawText('LOADOUT', 480, 15, '#aaaacc', 24, 'center');
    r.drawText('Click a gem from inventory, then click a node to place it.', 480, 45, '#666', 11, 'center');

    // Draw node network
    for (const nodeId of Object.keys(NODE_POSITIONS)) {
      const pos = NODE_POSITIONS[nodeId];
      const isGemSlot = GEM_SLOT_NODES.includes(nodeId);
      const radius = isGemSlot ? 12 : 6;
      let color = '#333';

      if (isGemSlot) {
        const gemId = this.runState.gem_slots[nodeId];
        if (gemId) {
          const gem = this.runState.gems.find(g => g.id === gemId);
          if (gem) {
            color = ELEMENT_COLORS[gem.element] || '#888';
          }
        }
      } else {
        // Beam type / pathway node
        color = '#555';
      }

      r.drawCircle(pos.x, pos.y, radius, color);
      if (isGemSlot) {
        r.drawCircleOutline(pos.x, pos.y, radius + 1, '#666');
      }

      // Node label
      r.drawText(nodeId.replace(/_/g, ' '), pos.x, pos.y + radius + 5, '#555', 8, 'center');

      // Show gem info on slot
      if (isGemSlot) {
        const gemId = this.runState.gem_slots[nodeId];
        if (gemId) {
          const gem = this.runState.gems.find(g => g.id === gemId);
          if (gem && gem.spell_id) {
            r.drawText(getSpell(gem.spell_id)?.name || '', pos.x, pos.y - radius - 8, '#ffff88', 8, 'center');
          }
        }
      }
    }

    // Inventory panel
    r.drawRect(490, 100, 460, 360, '#111', 0.8);
    r.drawRectOutline(490, 100, 460, 360, '#444');
    r.drawText('INVENTORY', 720, 110, '#aaa', 14, 'center');

    const unslotted = this.runState.getUnslottedGems();
    for (let i = 0; i < unslotted.length; i++) {
      const gem = unslotted[i];
      const gx = 500 + (i % 4) * 110;
      const gy = 140 + Math.floor(i / 4) * 80;

      const isSelected = gem.id === this.selectedGemId;
      const bgColor = isSelected ? '#335' : '#222';
      r.drawRect(gx, gy, 100, 65, bgColor);
      r.drawRectOutline(gx, gy, 100, 65, isSelected ? '#ffff00' : '#555');

      // Element color dot
      r.drawCircle(gx + 10, gy + 12, 5, ELEMENT_COLORS[gem.element] || '#888');

      // School
      r.drawText(gem.school, gx + 20, gy + 6, SCHOOL_COLORS[gem.school] || '#888', 9);

      // Spell name
      if (gem.spell_id) {
        const spell = getSpell(gem.spell_id);
        r.drawText(spell?.name || gem.spell_id, gx + 5, gy + 22, '#ffcc88', 9);
      }

      // Passive
      r.drawText(gem.passive_stat, gx + 5, gy + 36, '#88ccff', 8);
      r.drawText(`${gem.passive_value > 0 ? '+' : ''}${gem.passive_value}`, gx + 5, gy + 48, '#aaa', 8);
    }

    // Selected gem indicator
    if (this.selectedGemId) {
      const gem = this.runState.gems.find(g => g.id === this.selectedGemId);
      if (gem) {
        r.drawText(`Selected: ${gem.spell_id || gem.school} gem`, 480, 480, '#ffff00', 12, 'center');
      }
    }

    // Enemy info
    if (this.enemyData) {
      r.drawText(`Enemy: ${this.enemyData.school_attunement} / ${this.enemyData.element_attunement}`, 100, 430, '#cc8888', 11, 'center');
      r.drawText(`HP: ${this.enemyData.hp}  ${this.enemyData.is_elite ? 'ELITE' : ''} ${this.enemyData.is_boss ? 'BOSS' : ''}`,
        100, 445, '#cc8888', 11, 'center');
    }

    this.readyButton.render(r);
  }
}
