import { BALANCE } from '../data/BalanceConfig.js';
import { generateEnemy } from '../data/EnemyDatabase.js';

const NODE_TYPES = ['duel', 'elite', 'rest', 'merchant', 'shrine', 'mystery', 'boss'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateMap() {
  const tiers = [];
  let nodeIdCounter = 0;

  for (let tier = 1; tier <= BALANCE.meta.tier_count; tier++) {
    const nodeCount = randInt(BALANCE.meta.nodes_per_tier_min, BALANCE.meta.nodes_per_tier_max);
    const tierNodes = [];

    for (let i = 0; i < nodeCount; i++) {
      tierNodes.push({
        id: nodeIdCounter++,
        tier,
        type: 'duel', // placeholder, assigned below
        connections: [], // forward connections to next tier
        visited: false,
        hidden: false,
        x: 0,
        y: 0,
        enemyData: null,
      });
    }

    // Assign types with constraints
    _assignNodeTypes(tierNodes, tier);

    // Position nodes
    const tierX = 100 + (tier - 1) * 250;
    for (let i = 0; i < tierNodes.length; i++) {
      tierNodes[i].x = tierX;
      tierNodes[i].y = 80 + i * (400 / Math.max(1, tierNodes.length - 1));
      if (tierNodes.length === 1) tierNodes[i].y = 270;
    }

    tiers.push(tierNodes);
  }

  // Add boss node at end of tier 3
  const bossNode = {
    id: nodeIdCounter++,
    tier: BALANCE.meta.tier_count + 1,
    type: 'boss',
    connections: [],
    visited: false,
    hidden: false,
    x: 100 + BALANCE.meta.tier_count * 250,
    y: 270,
    enemyData: generateEnemy(BALANCE.meta.tier_count, false, true),
  };

  // Connect tiers
  for (let t = 0; t < tiers.length - 1; t++) {
    _connectTiers(tiers[t], tiers[t + 1]);
  }

  // Connect last tier to boss
  for (const node of tiers[tiers.length - 1]) {
    node.connections.push(bossNode.id);
  }

  // Generate enemy data for duel/elite nodes
  for (const tier of tiers) {
    for (const node of tier) {
      if (node.type === 'duel') {
        node.enemyData = generateEnemy(node.tier);
      } else if (node.type === 'elite') {
        node.enemyData = generateEnemy(node.tier, true);
      }
    }
  }

  // Some mystery nodes start hidden
  for (const tier of tiers) {
    for (const node of tier) {
      if (node.type === 'mystery' || (node.type === 'shrine' && Math.random() > 0.5)) {
        node.hidden = true;
      }
    }
  }

  // Flatten
  const allNodes = [...tiers.flat(), bossNode];

  // Start node (tier 1, first)
  const startNodeId = tiers[0][0].id;

  return {
    nodes: allNodes,
    startNodeId,
    bossNodeId: bossNode.id,
    tiers,
  };
}

function _assignNodeTypes(nodes, tier) {
  const count = nodes.length;
  const types = [];

  // Required: at least 2 duels
  types.push('duel', 'duel');

  // Required: 1 elite
  types.push('elite');

  // Required: at least 1 rest or merchant
  types.push(Math.random() > 0.5 ? 'rest' : 'merchant');

  // Fill remaining
  const remaining = count - types.length;
  const pool = ['duel', 'rest', 'merchant', 'shrine', 'mystery'];
  let mysteryCount = 0;

  for (let i = 0; i < remaining; i++) {
    let type = pool[Math.floor(Math.random() * pool.length)];
    if (type === 'mystery' && mysteryCount >= 1) {
      type = 'duel';
    }
    if (type === 'mystery') mysteryCount++;
    types.push(type);
  }

  // Shuffle and assign
  const shuffled = shuffle(types);
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].type = shuffled[i];
  }
}

function _connectTiers(currentTier, nextTier) {
  // Ensure every node has at least 1 outgoing and 1 incoming
  const hasIncoming = new Set();

  for (const node of currentTier) {
    // Connect to 1-2 random nodes in next tier
    const numConnections = randInt(1, Math.min(2, nextTier.length));
    const targets = shuffle(nextTier).slice(0, numConnections);
    for (const target of targets) {
      if (!node.connections.includes(target.id)) {
        node.connections.push(target.id);
        hasIncoming.add(target.id);
      }
    }
  }

  // Ensure all next tier nodes have at least 1 incoming
  for (const node of nextTier) {
    if (!hasIncoming.has(node.id)) {
      const source = currentTier[Math.floor(Math.random() * currentTier.length)];
      if (!source.connections.includes(node.id)) {
        source.connections.push(node.id);
      }
    }
  }
}
