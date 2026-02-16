import { BALANCE } from '../data/BalanceConfig.js';
import { NodeState } from './CombatState.js';
import { NODE_TYPE } from './NodeNetwork.js';

const ELEMENT_COLORS = {
  fire: '#ff4400',
  water: '#0088ff',
  earth: '#8b5e3c',
  air: '#eeeeff',
  '': '#aaaaaa',
};

const STATE_COLORS = {
  [NodeState.DORMANT]: '#333',
  [NodeState.OPEN]: '#aaa',
  [NodeState.CHANNELED]: '#fff',
  [NodeState.DAMAGED]: '#cc0000',
};

const SCHOOL_NODE_COLORS = {
  pure: '#ff4d00',
  chaos: '#ffe600',
  order: '#8000cc',
};

export class NodeRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.pulseTimer = 0;
  }

  update(dt) {
    this.pulseTimer += dt;
  }

  render(nodeNetwork) {
    const r = this.renderer;
    const nodes = nodeNetwork.nodes;

    // Draw connections
    for (const [id, node] of Object.entries(nodes)) {
      const adj = nodeNetwork.getAdjacent(id);
      for (const neighborId of adj) {
        const neighbor = nodes[neighborId];
        if (neighbor && id < neighborId) { // draw each edge once
          r.drawLine(node.x, node.y, neighbor.x, neighbor.y, '#222', 1);
        }
      }
    }

    // Draw nodes
    for (const [id, node] of Object.entries(nodes)) {
      const isPathway = node.type === NODE_TYPE.PATHWAY;
      const isBeamType = node.type === NODE_TYPE.BEAM_TYPE;
      const radius = isPathway ? 6 : 10;

      // Node base color
      let color = STATE_COLORS[node.state] || '#333';

      // Beam type nodes get school color when open
      if (isBeamType && (node.state === NodeState.OPEN || node.state === NodeState.CHANNELED)) {
        color = SCHOOL_NODE_COLORS[node.beam_school] || color;
      }

      // Open gem nodes with element-tinted color
      if (node.state === NodeState.OPEN && node.gem && node.gem.element) {
        color = ELEMENT_COLORS[node.gem.element];
      }

      // Channeled pulse
      let alpha = 1;
      if (node.state === NodeState.CHANNELED) {
        alpha = 0.7 + 0.3 * Math.sin(this.pulseTimer * 4);
      }

      // Draw node circle
      r.drawCircle(node.x, node.y, radius, color, alpha);

      // Damaged: draw X
      if (node.state === NodeState.DAMAGED) {
        r.drawLine(node.x - 5, node.y - 5, node.x + 5, node.y + 5, '#ff0000', 2);
        r.drawLine(node.x - 5, node.y + 5, node.x + 5, node.y - 5, '#ff0000', 2);
      }

      // Activation/repair progress arc
      if (node.activation_progress > 0 && node.activation_progress < 1) {
        const angle = node.activation_progress * Math.PI * 2;
        r.drawArc(node.x, node.y, radius + 4, -Math.PI / 2, -Math.PI / 2 + angle, '#fff', 2);
      }

      // Gem element indicator (small dot)
      if (node.gem && node.gem.element && node.state !== NodeState.DAMAGED) {
        const dotColor = ELEMENT_COLORS[node.gem.element];
        r.drawCircle(node.x + radius, node.y - radius, 4, dotColor);
      }

      // Spell indicator for channeled spell gems
      if (node.state === NodeState.CHANNELED && node.gem && node.gem.spell_id) {
        r.drawCircleOutline(node.x, node.y, radius + 2, '#ffff00', 1);
      }
    }

    // Draw awareness indicator
    const awarenessNode = nodes[nodeNetwork.awarenessNode];
    if (awarenessNode) {
      let ax = awarenessNode.x;
      let ay = awarenessNode.y;

      // If traveling, interpolate position
      if (nodeNetwork.awarenessPath.length > 0 && !nodeNetwork.isRepairing) {
        const nextId = nodeNetwork.awarenessPath[0];
        const nextNode = nodes[nextId];
        if (nextNode) {
          const hopTime = nodeNetwork.getEffectiveAwarenessSpeed() / 1000;
          const t = Math.min(1, nodeNetwork.awarenessTravelProgress / hopTime);
          ax = awarenessNode.x + (nextNode.x - awarenessNode.x) * t;
          ay = awarenessNode.y + (nextNode.y - awarenessNode.y) * t;
        }
      }

      // Glowing white dot
      const glow = 0.5 + 0.5 * Math.sin(this.pulseTimer * 6);
      r.drawCircle(ax, ay, 5, '#ffffff', 0.5 + glow * 0.5);
      r.drawCircle(ax, ay, 7, '#ffffff', 0.2 + glow * 0.2);
    }

    // Draw repair indicator
    if (nodeNetwork.isRepairing && awarenessNode) {
      const repairTime = nodeNetwork.getEffectiveRepairTime();
      const progress = nodeNetwork.repairTimer / repairTime;
      const angle = progress * Math.PI * 2;
      r.drawArc(awarenessNode.x, awarenessNode.y, 14, -Math.PI / 2, -Math.PI / 2 + angle, '#00ff00', 2);
    }
  }

  // Draw simplified meditation figure silhouette
  renderSilhouette(nodeNetwork) {
    const r = this.renderer;
    const nodes = nodeNetwork.nodes;
    const color = '#1a1a2e';

    // Head
    const head = nodes.crown;
    r.drawCircle(head.x, head.y - 12, 12, color);

    // Spine line (crown to belly)
    r.drawLine(nodes.crown.x, nodes.crown.y, nodes.belly.x, nodes.belly.y, color, 3);

    // Shoulders
    r.drawLine(nodes.right_shoulder.x, nodes.right_shoulder.y,
               nodes.left_shoulder.x, nodes.left_shoulder.y, color, 3);

    // Arms
    r.drawLine(nodes.right_shoulder.x, nodes.right_shoulder.y,
               nodes.right_hand.x, nodes.right_hand.y, color, 2);
    r.drawLine(nodes.left_shoulder.x, nodes.left_shoulder.y,
               nodes.left_hand.x, nodes.left_hand.y, color, 2);

    // Legs (belly to roots)
    r.drawLine(nodes.belly.x, nodes.belly.y,
               nodes.left_root.x, nodes.left_root.y, color, 2);
    r.drawLine(nodes.belly.x, nodes.belly.y,
               nodes.right_root.x, nodes.right_root.y, color, 2);

    // Root connection
    r.drawLine(nodes.left_root.x, nodes.left_root.y,
               nodes.right_root.x, nodes.right_root.y, color, 2);
  }
}
