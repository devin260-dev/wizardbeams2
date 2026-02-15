import { BALANCE } from '../data/BalanceConfig.js';
import { Button } from '../rendering/UIComponents.js';

const TYPE_COLORS = {
  duel: '#cc4444',
  elite: '#ff6600',
  rest: '#44cc44',
  merchant: '#cccc44',
  shrine: '#44cccc',
  mystery: '#8844cc',
  boss: '#ff0000',
};

const TYPE_ICONS = {
  duel: '\u2620',      // skull
  elite: '\u2694',     // crossed swords
  rest: '\u2668',      // hot springs (campfire)
  merchant: '\u2696',  // scales
  shrine: '\u2666',    // diamond
  mystery: '?',
  boss: '\u2655',      // queen (crown)
};

export class MapScreen {
  constructor(sceneManager, eventBus, inputManager, renderer) {
    this.sceneManager = sceneManager;
    this.eventBus = eventBus;
    this.input = inputManager;
    this.renderer = renderer;
    this.runState = null;
    this.mapData = null;
  }

  enter(data) {
    this.runState = data.runState;
    this.mapData = this.runState.map_data;
  }

  exit() {}

  update(dt) {
    if (!this.input.wasClicked()) return;
    const click = this.input.getClickPos();

    // Find clickable nodes
    const currentNode = this._getNode(this.runState.current_node_id);
    if (!currentNode) return;

    const reachable = currentNode.connections;
    for (const nodeId of reachable) {
      const node = this._getNode(nodeId);
      if (!node || node.visited) continue;

      const dx = click.x - node.x;
      const dy = click.y - node.y;
      if (dx * dx + dy * dy <= 20 * 20) {
        this._visitNode(node);
        return;
      }
    }
  }

  _getNode(id) {
    return this.mapData.nodes.find(n => n.id === id);
  }

  _visitNode(node) {
    // Mark current as visited
    const currentNode = this._getNode(this.runState.current_node_id);
    if (currentNode) currentNode.visited = true;

    this.runState.current_node_id = node.id;

    // Reveal hidden nodes
    if (node.hidden) {
      node.hidden = false;
    }

    // Update tier
    this.runState.current_tier = node.tier;

    switch (node.type) {
      case 'duel':
      case 'elite':
      case 'boss':
        this.sceneManager.changeScene('loadout', {
          runState: this.runState,
          enemyData: node.enemyData,
        });
        break;
      case 'merchant':
        this.sceneManager.changeScene('merchant', { runState: this.runState });
        break;
      case 'shrine':
        this.sceneManager.changeScene('shrine', { runState: this.runState });
        break;
      case 'rest':
        this.sceneManager.changeScene('rest', { runState: this.runState });
        break;
      case 'mystery':
        this.sceneManager.changeScene('event', { runState: this.runState });
        break;
    }
  }

  render(ctx) {
    const r = this.renderer;
    r.clear('#1a1008');

    r.drawText('THE ASTRAL GAUNTLET', 480, 15, '#cc8844', 20, 'center');

    // HUD
    r.drawText(`HP: ${this.runState.hp}/${this.runState.max_hp}`, 10, 510, '#cc4444', 12);
    r.drawText(`Gold: ${this.runState.gold}`, 150, 510, '#cccc44', 12);
    r.drawText(`Gems: ${this.runState.gems.length}`, 280, 510, '#44cccc', 12);
    r.drawText(`Tier: ${this.runState.current_tier}`, 400, 510, '#888', 12);

    if (!this.mapData) return;

    // Draw connections
    for (const node of this.mapData.nodes) {
      for (const connId of node.connections) {
        const target = this._getNode(connId);
        if (!target) continue;
        const color = node.visited ? '#333' : '#555';
        r.drawLine(node.x, node.y, target.x, target.y, color, 1);
      }
    }

    // Draw nodes
    const currentId = this.runState.current_node_id;
    const currentNode = this._getNode(currentId);
    const reachable = currentNode ? new Set(currentNode.connections) : new Set();

    for (const node of this.mapData.nodes) {
      const isReachable = reachable.has(node.id) && !node.visited;
      const isCurrent = node.id === currentId;
      const displayType = node.hidden ? 'mystery' : node.type;
      const color = node.visited ? '#444' : TYPE_COLORS[displayType] || '#888';
      const radius = isCurrent ? 18 : (node.type === 'boss' ? 16 : 14);

      // Node circle
      r.drawCircle(node.x, node.y, radius, color, node.visited ? 0.4 : 0.8);

      // Current node highlight
      if (isCurrent) {
        r.drawCircleOutline(node.x, node.y, radius + 3, '#fff', 2);
      }

      // Reachable highlight
      if (isReachable) {
        r.drawCircleOutline(node.x, node.y, radius + 2, '#ffff00', 1);
      }

      // Icon
      const icon = node.hidden ? '?' : TYPE_ICONS[node.type] || '?';
      r.drawText(icon, node.x, node.y, '#fff', 14, 'center', 'middle');

      // Type label
      if (!node.hidden) {
        r.drawText(node.type, node.x, node.y + radius + 8, '#888', 9, 'center');
      }
    }
  }
}
