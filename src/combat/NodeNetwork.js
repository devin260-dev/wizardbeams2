import { BALANCE } from '../data/BalanceConfig.js';
import { NodeState } from './CombatState.js';

// Node type constants
const NODE_TYPE = {
  GEM_SLOT: 'gem_slot',
  BEAM_TYPE: 'beam_type',
  PATHWAY: 'pathway',
};

// Node definitions with positions (scaled 1.4x from center for spacing)
// Center of network: x=98, y=416
const NODE_CX = 98;
const NODE_CY = 416;
const NODE_SCALE = 1.4;
function _np(x, y) {
  return { x: Math.round(NODE_CX + (x - NODE_CX) * NODE_SCALE), y: Math.round(NODE_CY + (y - NODE_CY) * NODE_SCALE) };
}
const NODE_DEFS = {
  // Gem slot nodes
  crown:           { ..._np(98, 358),  type: NODE_TYPE.GEM_SLOT },
  third_eye:       { ..._np(98, 374),  type: NODE_TYPE.GEM_SLOT },
  throat:          { ..._np(98, 396),  type: NODE_TYPE.GEM_SLOT },
  left_shoulder:   { ..._np(121, 412), type: NODE_TYPE.GEM_SLOT },
  right_shoulder:  { ..._np(72, 412),  type: NODE_TYPE.GEM_SLOT },
  left_root:       { ..._np(123, 475), type: NODE_TYPE.GEM_SLOT },
  right_root:      { ..._np(70, 475),  type: NODE_TYPE.GEM_SLOT },
  // Beam type nodes
  belly:           { ..._np(98, 446),  type: NODE_TYPE.BEAM_TYPE, beam_school: 'pure' },
  left_hand:       { ..._np(150, 472), type: NODE_TYPE.BEAM_TYPE, beam_school: 'chaos' },
  right_hand:      { ..._np(44, 472),  type: NODE_TYPE.BEAM_TYPE, beam_school: 'order' },
  // Pathway nodes
  sternum:         { ..._np(98, 412),  type: NODE_TYPE.PATHWAY },
  left_elbow:      { ..._np(130, 447), type: NODE_TYPE.PATHWAY },
  right_elbow:     { ..._np(63, 447),  type: NODE_TYPE.PATHWAY },
};

// Adjacency list
const ADJACENCY = {
  crown: ['third_eye'],
  third_eye: ['crown', 'throat'],
  throat: ['third_eye', 'sternum'],
  sternum: ['throat', 'belly', 'left_shoulder', 'right_shoulder'],
  belly: ['sternum', 'left_root', 'right_root'],
  left_shoulder: ['sternum', 'left_elbow'],
  right_shoulder: ['sternum', 'right_elbow'],
  left_elbow: ['left_shoulder', 'left_hand'],
  right_elbow: ['right_shoulder', 'right_hand'],
  left_hand: ['left_elbow'],
  right_hand: ['right_elbow'],
  left_root: ['belly', 'right_root'],
  right_root: ['belly', 'left_root'],
};

const GEM_SLOT_NODES = ['crown', 'third_eye', 'throat', 'left_shoulder', 'right_shoulder', 'left_root', 'right_root'];
const BEAM_TYPE_NODES = ['belly', 'left_hand', 'right_hand'];
const PATHWAY_NODES = ['sternum', 'left_elbow', 'right_elbow'];

// Map beam school to beam type node
const SCHOOL_TO_NODE = {
  pure: 'belly',
  chaos: 'left_hand',
  order: 'right_hand',
};

export class NodeNetwork {
  constructor(isEnemy, eventBus, sideState) {
    this.isEnemy = isEnemy;
    this.eventBus = eventBus;
    this.sideState = sideState;
    this.side = isEnemy ? 'enemy' : 'player';

    // Node states
    this.nodes = {};
    for (const id of Object.keys(NODE_DEFS)) {
      this.nodes[id] = {
        id,
        ...NODE_DEFS[id],
        state: NodeState.DORMANT,
        gem: null,
        activation_progress: 0, // 0-1 progress for activation/repair
      };
    }

    // Mirror positions for enemy
    if (isEnemy) {
      const mirrorX = 960; // canvas width
      for (const id of Object.keys(this.nodes)) {
        this.nodes[id].x = mirrorX - this.nodes[id].x;
      }
    }

    // Awareness
    this.awarenessNode = null;
    this.awarenessTarget = null;
    this.awarenessPath = [];
    this.awarenessTravelProgress = 0;
    this.awarenessSpeed = BALANCE.nodes.awareness_travel_time; // ms per hop
    this.isRepairing = false;
    this.repairTimer = 0;

    // Multiplier for activation/repair time (used for enemy slowdown)
    this.activationTimeMultiplier = 1.0;

    // Passive bonuses accumulated from gems
    this.passiveBonuses = {};
  }

  init(attunement, gems, gemSlots, allNodesOpen = false) {
    // Reset all nodes to dormant
    for (const id of Object.keys(this.nodes)) {
      this.nodes[id].state = NodeState.DORMANT;
      this.nodes[id].gem = null;
      this.nodes[id].activation_progress = 0;
    }

    // Slot gems
    if (gems && gemSlots) {
      for (const [nodeId, gemId] of Object.entries(gemSlots)) {
        const gem = gems.find(g => g.id === gemId);
        if (gem && this.nodes[nodeId]) {
          this.nodes[nodeId].gem = gem;
        }
      }
    }

    // Set attuned beam node to Open
    const attunedNode = SCHOOL_TO_NODE[attunement];
    if (attunedNode) {
      this.nodes[attunedNode].state = NodeState.OPEN;
    }

    // Boss: all nodes open
    if (allNodesOpen) {
      for (const id of Object.keys(this.nodes)) {
        this.nodes[id].state = NodeState.OPEN;
      }
    }

    // Set awareness at attuned beam node
    this.awarenessNode = attunedNode;
    this.awarenessTarget = null;
    this.awarenessPath = [];
    this.awarenessTravelProgress = 0;
    this.isRepairing = false;
    this.repairTimer = 0;

    // Calculate passive bonuses
    this._recalcPassives();
  }

  _recalcPassives() {
    this.passiveBonuses = {};
    for (const id of Object.keys(this.nodes)) {
      const node = this.nodes[id];
      if ((node.state === NodeState.OPEN || node.state === NodeState.CHANNELED) && node.gem) {
        const stat = node.gem.passive_stat;
        if (stat) {
          this.passiveBonuses[stat] = (this.passiveBonuses[stat] || 0) + node.gem.passive_value;
        }
      }
    }
  }

  getPassiveBonus(stat) {
    return this.passiveBonuses[stat] || 0;
  }

  getEffectiveAwarenessSpeed() {
    const bonus = this.getPassiveBonus('awareness_speed');
    return Math.max(BALANCE.floors.awareness_speed, this.awarenessSpeed + bonus);
  }

  getEffectiveActivationTime() {
    const bonus = this.getPassiveBonus('activation_speed');
    const base = (BALANCE.nodes.activation_time + bonus) * this.activationTimeMultiplier;
    return Math.max(BALANCE.floors.activation_speed, base);
  }

  getEffectiveRepairTime() {
    const bonus = this.getPassiveBonus('node_repair');
    const base = (BALANCE.nodes.repair_time + bonus) * this.activationTimeMultiplier;
    return Math.max(BALANCE.floors.node_repair, base);
  }

  // State queries
  getState(nodeId) {
    return this.nodes[nodeId]?.state;
  }

  setState(nodeId, newState) {
    const node = this.nodes[nodeId];
    if (!node) return;
    const oldState = node.state;
    node.state = newState;
    node.activation_progress = 0;
    this._recalcPassives();
    this.eventBus.emit('node_state_changed', {
      side: this.side,
      nodeId,
      oldState,
      newState,
      node,
    });
  }

  damageNode(nodeId) {
    this.setState(nodeId, NodeState.DAMAGED);
  }

  disruptNode(nodeId) {
    this.setState(nodeId, NodeState.DORMANT);
  }

  getOpenNodes() {
    return Object.values(this.nodes).filter(n => n.state === NodeState.OPEN);
  }

  getChanneledNodes() {
    return Object.values(this.nodes).filter(n => n.state === NodeState.CHANNELED);
  }

  getDamagedNodes() {
    return Object.values(this.nodes).filter(n => n.state === NodeState.DAMAGED);
  }

  getDormantNodes() {
    return Object.values(this.nodes).filter(n => n.state === NodeState.DORMANT);
  }

  getNodesByType(type) {
    return Object.values(this.nodes).filter(n => n.type === type);
  }

  getGemAtNode(nodeId) {
    return this.nodes[nodeId]?.gem || null;
  }

  isNodeOpen(nodeId) {
    return this.nodes[nodeId]?.state === NodeState.OPEN;
  }

  // Mana from Open + Channeled nodes (each +1)
  getNodeMana() {
    let mana = 0;
    for (const node of Object.values(this.nodes)) {
      if (node.type === NODE_TYPE.PATHWAY) continue;
      if (node.state === NodeState.OPEN || node.state === NodeState.CHANNELED) {
        mana += 1;
      }
    }
    return mana;
  }

  // Element counts from Open nodes only + attunement
  getElementCounts(attunementElement) {
    const counts = { fire: 0, water: 0, earth: 0, air: 0 };
    for (const node of Object.values(this.nodes)) {
      if (node.state === NodeState.OPEN && node.gem && node.gem.element) {
        counts[node.gem.element] = (counts[node.gem.element] || 0) + 1;
      }
    }
    // Attunement bonus
    if (attunementElement && counts[attunementElement] !== undefined) {
      counts[attunementElement] += 1;
    }
    return counts;
  }

  getDominantElement(attunementElement) {
    const counts = this.getElementCounts(attunementElement);
    let maxCount = 0;
    let dominant = attunementElement || '';
    for (const [element, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = element;
      } else if (count === maxCount && element === attunementElement) {
        dominant = element; // ties go to attuned
      }
    }
    return dominant;
  }

  // Check if all 10 mana-contributing nodes are Open or Channeled
  allManaNodesActive() {
    for (const id of [...GEM_SLOT_NODES, ...BEAM_TYPE_NODES]) {
      const node = this.nodes[id];
      if (node.state !== NodeState.OPEN && node.state !== NodeState.CHANNELED) {
        return false;
      }
    }
    return true;
  }

  // Click detection
  getNodeAtPoint(x, y) {
    const r = BALANCE.nodes.click_radius;
    for (const [id, node] of Object.entries(this.nodes)) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= r * r) {
        return id;
      }
    }
    return null;
  }

  // BFS pathfinding
  findPath(fromId, toId) {
    if (fromId === toId) return [fromId];
    const visited = new Set();
    const queue = [[fromId]];
    visited.add(fromId);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      for (const neighbor of ADJACENCY[current] || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        const newPath = [...path, neighbor];
        if (neighbor === toId) return newPath;
        queue.push(newPath);
      }
    }
    return []; // no path found (shouldn't happen in connected graph)
  }

  // Awareness
  setAwarenessTarget(nodeId) {
    if (this.awarenessPath.length > 0) return; // already traveling
    if (nodeId === this.awarenessNode) return;

    const path = this.findPath(this.awarenessNode, nodeId);
    if (path.length < 2) return;

    this.awarenessTarget = nodeId;
    this.awarenessPath = path.slice(1); // remove current node
    this.awarenessTravelProgress = 0;
    this.isRepairing = false;
    this.repairTimer = 0;
  }

  update(dt) {
    if (this.awarenessPath.length === 0) {
      // At current node - handle activation/repair
      this._processCurrentNode(dt);
      return;
    }

    // Traveling
    const nextNode = this.awarenessPath[0];
    const nextNodeData = this.nodes[nextNode];

    // Check if next node on path is Damaged - auto repair
    if (nextNodeData && nextNodeData.state === NodeState.DAMAGED && !this.isRepairing &&
        this.awarenessNode !== nextNode) {
      // Move to the damaged node first
      const hopTime = this.getEffectiveAwarenessSpeed() / 1000;
      this.awarenessTravelProgress += dt;
      if (this.awarenessTravelProgress >= hopTime) {
        this.awarenessNode = nextNode;
        this.awarenessTravelProgress = 0;
        this.isRepairing = true;
        this.repairTimer = 0;
        return;
      }
      return;
    }

    // Auto-repair in transit
    if (this.isRepairing) {
      const repairTime = this.getEffectiveRepairTime();
      this.repairTimer += dt;
      if (this.repairTimer >= repairTime) {
        this.setState(this.awarenessNode, NodeState.DORMANT);
        this.isRepairing = false;
        this.repairTimer = 0;
        this.awarenessPath.shift(); // remove this node from path
      }
      return;
    }

    // Normal travel
    const hopTime = this.getEffectiveAwarenessSpeed() / 1000;
    this.awarenessTravelProgress += dt;

    if (this.awarenessTravelProgress >= hopTime) {
      this.awarenessNode = nextNode;
      this.awarenessTravelProgress = 0;
      this.awarenessPath.shift();

      // Check if we arrived at a damaged node on our path (not final target)
      if (this.awarenessPath.length > 0 && nextNodeData.state === NodeState.DAMAGED) {
        this.isRepairing = true;
        this.repairTimer = 0;
      }
    }
  }

  _processCurrentNode(dt) {
    const node = this.nodes[this.awarenessNode];
    if (!node) return;

    if (node.state === NodeState.DAMAGED) {
      // Repair
      const repairTime = this.getEffectiveRepairTime();
      node.activation_progress += dt / repairTime;
      if (node.activation_progress >= 1) {
        this.setState(this.awarenessNode, NodeState.DORMANT);
        // Immediately start activating
        node.activation_progress = 0;
      }
    } else if (node.state === NodeState.DORMANT) {
      // Activate
      const activationTime = this.getEffectiveActivationTime();
      node.activation_progress += dt / activationTime;
      if (node.activation_progress >= 1) {
        this.setState(this.awarenessNode, NodeState.OPEN);
      }
    }
    // Open/Channeled nodes - awareness just sits here
  }

  // Get all node IDs
  getAllNodeIds() {
    return Object.keys(this.nodes);
  }

  getNode(nodeId) {
    return this.nodes[nodeId] || null;
  }

  getAdjacent(nodeId) {
    return ADJACENCY[nodeId] || [];
  }

  // Find nearest root node via BFS from a given node
  findNearestRoot(fromId) {
    const roots = ['left_root', 'right_root'];
    if (roots.includes(fromId)) return fromId;

    const visited = new Set();
    const queue = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbor of ADJACENCY[current] || []) {
        if (visited.has(neighbor)) continue;
        if (roots.includes(neighbor)) return neighbor;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    return roots[0];
  }
}

export { NODE_DEFS, ADJACENCY, GEM_SLOT_NODES, BEAM_TYPE_NODES, PATHWAY_NODES, SCHOOL_TO_NODE, NODE_TYPE };
