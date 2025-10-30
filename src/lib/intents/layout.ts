export type IntentGraphNode = {
  id: string;
  term: string;
  intent: string;
  persona: string;
  purchaseStage: string;
  score: number;
};

export type IntentGraphEdge = {
  source: string;
  target: string;
  weight: number;
  reason: string;
};

export type PositionedIntentNode = IntentGraphNode & {
  x: number;
  y: number;
  color: string;
};

export type IntentGraphLayout = {
  nodes: PositionedIntentNode[];
  edges: IntentGraphEdge[];
  legend: Array<{ intent: string; color: string }>;
};

const INTENT_COLORS = [
  "#60a5fa",
  "#f472b6",
  "#facc15",
  "#34d399",
  "#c084fc",
  "#fb7185",
  "#38bdf8",
];

function seededRandom(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (state + seed.charCodeAt(i) * 31) % 233280;
  }

  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function buildEdges(nodes: IntentGraphNode[]): IntentGraphEdge[] {
  const edges: IntentGraphEdge[] = [];
  const byIntent = new Map<string, IntentGraphNode[]>();
  const byStage = new Map<string, IntentGraphNode[]>();

  for (const node of nodes) {
    const stageKey = node.purchaseStage.toLowerCase();
    const intentKey = node.intent.toLowerCase();

    if (!byIntent.has(intentKey)) {
      byIntent.set(intentKey, []);
    }
    byIntent.get(intentKey)!.push(node);

    if (!byStage.has(stageKey)) {
      byStage.set(stageKey, []);
    }
    byStage.get(stageKey)!.push(node);
  }

  function connect(group: IntentGraphNode[], reason: string, weight: number) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        edges.push({
          source: group[i].id,
          target: group[j].id,
          weight,
          reason,
        });
      }
    }
  }

  for (const [intent, group] of byIntent.entries()) {
    if (group.length > 1) {
      connect(group, `Shared intent: ${intent}`, 1.25);
    }
  }

  for (const [stage, group] of byStage.entries()) {
    if (group.length > 1) {
      connect(group, `Funnel stage: ${stage}`, 0.8);
    }
  }

  return edges;
}

function applyRepulsion(
  positions: Array<{ x: number; y: number }>,
  forces: Array<{ x: number; y: number }>,
  repulsionStrength: number,
) {
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const dx = positions[j].x - positions[i].x;
      const dy = positions[j].y - positions[i].y;
      const distanceSq = Math.max(dx * dx + dy * dy, 0.01);
      const force = repulsionStrength / distanceSq;
      const distance = Math.sqrt(distanceSq);
      const fx = (force * dx) / distance;
      const fy = (force * dy) / distance;

      forces[i].x -= fx;
      forces[i].y -= fy;
      forces[j].x += fx;
      forces[j].y += fy;
    }
  }
}

function indexById(nodes: IntentGraphNode[]): Map<string, number> {
  const map = new Map<string, number>();
  nodes.forEach((node, index) => map.set(node.id, index));
  return map;
}

function applyEdgeForces(
  positions: Array<{ x: number; y: number }>,
  forces: Array<{ x: number; y: number }>,
  edges: IntentGraphEdge[],
  nodeIndex: Map<string, number>,
) {
  const baseSpring = 80;
  const springStrength = 0.1;

  for (const edge of edges) {
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);

    if (source === undefined || target === undefined) {
      continue;
    }

    const dx = positions[target].x - positions[source].x;
    const dy = positions[target].y - positions[source].y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const desired = baseSpring / Math.max(0.5, edge.weight);
    const force = springStrength * (distance - desired);
    const fx = (force * dx) / distance;
    const fy = (force * dy) / distance;

    forces[source].x += fx;
    forces[source].y += fy;
    forces[target].x -= fx;
    forces[target].y -= fy;
  }
}

function normalizePositions(positions: Array<{ x: number; y: number }>) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const position of positions) {
    if (position.x < minX) minX = position.x;
    if (position.y < minY) minY = position.y;
    if (position.x > maxX) maxX = position.x;
    if (position.y > maxY) maxY = position.y;
  }

  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  return positions.map((position) => ({
    x: ((position.x - minX) / width) * 2 - 1,
    y: ((position.y - minY) / height) * 2 - 1,
  }));
}

export function buildIntentGraphLayout(nodes: IntentGraphNode[]): IntentGraphLayout {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], legend: [] };
  }

  const edges = buildEdges(nodes);
  const nodeIndex = indexById(nodes);
  const random = seededRandom(`intent-graph-${nodes.length}`);

  const positions = nodes.map((_, index) => {
    const angle = (index / nodes.length) * Math.PI * 2;
    const radius = 0.5 + random() * 0.25;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });

  const velocities = nodes.map(() => ({ x: 0, y: 0 }));
  const forces = nodes.map(() => ({ x: 0, y: 0 }));
  const iterations = Math.min(300, 120 + nodes.length * 12);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    forces.forEach((force) => {
      force.x = 0;
      force.y = 0;
    });

    applyRepulsion(positions, forces, 0.05);
    applyEdgeForces(positions, forces, edges, nodeIndex);

    for (let i = 0; i < nodes.length; i += 1) {
      velocities[i].x = (velocities[i].x + forces[i].x) * 0.85;
      velocities[i].y = (velocities[i].y + forces[i].y) * 0.85;

      positions[i].x += velocities[i].x;
      positions[i].y += velocities[i].y;
    }
  }

  const normalized = normalizePositions(positions);

  const legendEntries = Array.from(
    new Map(
      nodes.map((node) => [node.intent, null as null]),
    ).keys(),
  ).map((intent, index) => ({ intent, color: INTENT_COLORS[index % INTENT_COLORS.length] }));

  const colorByIntent = new Map(legendEntries.map((entry) => [entry.intent, entry.color]));

  const positionedNodes: PositionedIntentNode[] = nodes.map((node, index) => ({
    ...node,
    x: normalized[index].x,
    y: normalized[index].y,
    color: colorByIntent.get(node.intent) ?? INTENT_COLORS[0],
  }));

  return { nodes: positionedNodes, edges, legend: legendEntries };
}
