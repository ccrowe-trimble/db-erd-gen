import { Node, Edge } from "reactflow";

export interface LayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'; // Top-Bottom, Bottom-Top, Left-Right, Right-Left
  nodeSpacing?: number;
  levelSpacing?: number;
  centerX?: number;
  centerY?: number;
  isolatedNodesPerRow?: number; // How many isolated nodes per row at the top
  isolatedNodeSpacing?: number; // Spacing between isolated nodes
  isolatedRowSpacing?: number; // Spacing between rows of isolated nodes
}

/**
 * Calculates hierarchical layout for ER diagram nodes with isolated nodes at top
 * Uses a simplified Sugiyama-style algorithm suitable for database schemas
 * Isolated nodes (no relationships) are placed in a grid at the top, wrapping to new rows
 */
export function calculateHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const {
    direction = 'TB',
    nodeSpacing = 200,
    levelSpacing = 150,
    centerX = 400,
    centerY = 300,
    isolatedNodesPerRow = 5,
    isolatedNodeSpacing = nodeSpacing, // Use same spacing as connected nodes
    isolatedRowSpacing = 120
  } = options;

  if (nodes.length === 0) return nodes;

  // Build adjacency lists
  const outgoingEdges = new Map<string, string[]>();
  const incomingEdges = new Map<string, string[]>();

  edges.forEach(edge => {
    if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
    if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);

    outgoingEdges.get(edge.source)!.push(edge.target);
    incomingEdges.get(edge.target)!.push(edge.source);
  });

  // Separate isolated nodes from connected nodes
  const isolatedNodes: Node[] = [];
  const connectedNodes: Node[] = [];

  nodes.forEach(node => {
    const hasOutgoing = outgoingEdges.has(node.id) && outgoingEdges.get(node.id)!.length > 0;
    const hasIncoming = incomingEdges.has(node.id) && incomingEdges.get(node.id)!.length > 0;

    if (hasOutgoing || hasIncoming) {
      connectedNodes.push(node);
    } else {
      isolatedNodes.push(node);
    }
  });

  const positionedNodes = nodes.map(node => ({ ...node }));

  // Calculate hierarchical layout for connected nodes only
  const connectedLevels = new Map<string, number>();
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function assignLevel(nodeId: string): number {
    if (visited.has(nodeId)) return connectedLevels.get(nodeId)!;
    if (visiting.has(nodeId)) return 0; // cycle detected, place at level 0

    visiting.add(nodeId);

    const parentLevels = (incomingEdges.get(nodeId) || []).map(parentId => assignLevel(parentId));
    const level = parentLevels.length > 0 ? Math.max(...parentLevels) + 1 : 0;

    visiting.delete(nodeId);
    visited.add(nodeId);
    connectedLevels.set(nodeId, level);
    return level;
  }

  // Assign levels to connected nodes
  connectedNodes.forEach(node => assignLevel(node.id));

  // Group connected nodes by level
  const connectedNodesByLevel = new Map<number, Node[]>();
  connectedNodes.forEach(node => {
    const level = connectedLevels.get(node.id) || 0;
    if (!connectedNodesByLevel.has(level)) connectedNodesByLevel.set(level, []);
    connectedNodesByLevel.get(level)!.push(node);
  });

  // Position connected nodes first to determine their bounds
  const maxLevel = Math.max(...Array.from(connectedLevels.values()));
  const connectedStartY = 200; // Start connected nodes at y=200
  const connectedTotalHeight = maxLevel * levelSpacing;

  connectedNodesByLevel.forEach((levelNodes, level) => {
    const levelWidth = (levelNodes.length - 1) * nodeSpacing;
    const startX = centerX - levelWidth / 2;

    levelNodes.forEach((node, index) => {
      const nodeIndex = positionedNodes.findIndex(n => n.id === node.id);
      if (nodeIndex !== -1) {
        positionedNodes[nodeIndex] = {
          ...positionedNodes[nodeIndex],
          data: {
            ...positionedNodes[nodeIndex].data
          },
          position: {
            x: startX + index * nodeSpacing,
            y: connectedStartY + level * levelSpacing
          }
        };
      }
    });
  });

  // Now position isolated nodes above the connected nodes
  const isolatedStartY = connectedStartY - levelSpacing; // Place isolated nodes levelSpacing above connected nodes
  let currentY = isolatedStartY;
  let currentX = centerX - ((Math.min(isolatedNodesPerRow, isolatedNodes.length) - 1) * isolatedNodeSpacing) / 2;

  isolatedNodes.forEach((node, index) => {
    const row = Math.floor(index / isolatedNodesPerRow);
    const col = index % isolatedNodesPerRow;

    if (col === 0 && row > 0) {
      // Start new row
      currentY += isolatedRowSpacing;
      currentX = centerX - ((Math.min(isolatedNodesPerRow, isolatedNodes.length - row * isolatedNodesPerRow) - 1) * isolatedNodeSpacing) / 2;
    }

    const nodeIndex = positionedNodes.findIndex(n => n.id === node.id);
    if (nodeIndex !== -1) {
      positionedNodes[nodeIndex] = {
        ...positionedNodes[nodeIndex],
        data: {
          ...positionedNodes[nodeIndex].data
        },
        position: {
          x: currentX + col * isolatedNodeSpacing,
          y: currentY
        }
      };
    }
  });

  return positionedNodes;
}

/**
 * Calculates circular layout for nodes
 */
export function calculateCircularLayout(
  nodes: Node[],
  options: { radius?: number; centerX?: number; centerY?: number } = {}
): Node[] {
  const { radius = 100, centerX = 400, centerY = 300 } = options;

  if (nodes.length === 0) return nodes;

  const angleStep = (2 * Math.PI) / nodes.length;

  return nodes.map((node, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return {
      ...node,
      position: { x, y }
    };
  });
}

/**
 * Calculates force-directed layout (simplified physics-based)
 */
export function calculateForceDirectedLayout(
  nodes: Node[],
  edges: Edge[],
  options: {
    iterations?: number;
    repulsionForce?: number;
    attractionForce?: number;
    minDistance?: number;
    repulsionMultiplier?: number;
    damping?: number;
    centerX?: number;
    centerY?: number;
  } = {}
): Node[] {
  const {
    iterations = 50,
    repulsionForce = 1000,
    attractionForce = 0.1,
    minDistance = 150,
    repulsionMultiplier = 1,
    damping = 0.9,
    centerX = 400,
    centerY = 300
  } = options;

  if (nodes.length === 0) return nodes;

  // Initialize positions randomly around center
  const positionedNodes = nodes.map(node => ({
    ...node,
    position: {
      x: centerX + (Math.random() - 0.5) * 400,
      y: centerY + (Math.random() - 0.5) * 400
    },
    velocity: { x: 0, y: 0 }
  }));

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!adjacencyList.has(edge.source)) adjacencyList.set(edge.source, []);
    if (!adjacencyList.has(edge.target)) adjacencyList.set(edge.target, []);

    adjacencyList.get(edge.source)!.push(edge.target);
    adjacencyList.get(edge.target)!.push(edge.source);
  });

  // Force-directed algorithm
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate repulsive forces between all pairs (use true distance; handle tiny epsilon)
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const rawDist = Math.sqrt(dx * dx + dy * dy);
        const distance = rawDist || 0.0001; // avoid division by zero

  // Scale repulsion by multiplier to allow looser/tighter layouts
  const effectiveRepulsion = repulsionForce * (repulsionMultiplier || 1);
  // Classical repulsive Coulomb-like force
  const force = effectiveRepulsion / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        nodeA.velocity.x -= fx;
        nodeA.velocity.y -= fy;
        nodeB.velocity.x += fx;
        nodeB.velocity.y += fy;
      }
    }

    // Calculate attractive forces for connected nodes
    edges.forEach(edge => {
      const sourceNode = positionedNodes.find(n => n.id === edge.source);
      const targetNode = positionedNodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = attractionForce * distance;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        sourceNode.velocity.x += fx;
        sourceNode.velocity.y += fy;
        targetNode.velocity.x -= fx;
        targetNode.velocity.y -= fy;
      }
    });

    // Apply velocity damping and update positions
    // Simple collision resolution and centering pull before final position update
    // Collision: if two nodes are closer than minDistance, push them apart immediately
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        const effectiveMinDist = minDistance * (repulsionMultiplier || 1);
        if (dist < effectiveMinDist) {
          const overlap = (effectiveMinDist - dist);
          const nx = dx / dist;
          const ny = dy / dist;

          // Move each node half the overlap along the normalized vector
          nodeA.position.x -= nx * (overlap / 2);
          nodeA.position.y -= ny * (overlap / 2);
          nodeB.position.x += nx * (overlap / 2);
          nodeB.position.y += ny * (overlap / 2);
        }
      }
    }

    // Small pull toward center to avoid drift (keeps graph near centerX/centerY)
    const centerPull = 0.01; // small constant; could be exposed as an option later
    positionedNodes.forEach(node => {
      // Apply velocity damping
      node.velocity.x *= damping;
      node.velocity.y *= damping;

      // Apply centering force to velocity
      node.velocity.x += (centerX - node.position.x) * centerPull;
      node.velocity.y += (centerY - node.position.y) * centerPull;

      node.position.x += node.velocity.x;
      node.position.y += node.velocity.y;
    });
  }

  // Remove velocity property and return
  return positionedNodes.map(({ velocity, ...node }) => node);
}

/**
 * Place all nodes along the X axis (horizontal line). Y is fixed (default 0 or centerY)
 */
export function calculateXLayout(
  nodes: Node[],
  options: { offset?: number; centerX?: number; y?: number } = {}
): Node[] {
  const { centerX = 400, y = -500 } = options;
  if (nodes.length === 0) return nodes;

  // Compute widths for each node. Try to read numeric width from data or style, fall back to 320
  const nodeWidths = nodes.map(node => {
    try {
      const wFromData = node.data && (node.data as any).width;
      if (typeof wFromData === 'number') return wFromData;
      if (typeof wFromData === 'string') {
        const parsed = parseFloat(wFromData);
        if (!isNaN(parsed)) return parsed;
      }
      const styleWidth = (node as any).style && (node as any).style.width;
      if (typeof styleWidth === 'number') return styleWidth;
      if (typeof styleWidth === 'string') {
        const parsed = parseFloat(styleWidth);
        if (!isNaN(parsed)) return parsed;
      }
      return 320;
    } catch (e) {
      return 320;
    }
  });

  // Use the width of the first node as the offset between nodes
  const singeNodeWidth = nodeWidths.length > 0 ? nodeWidths[0] : 320;

  // Calculate total width: sum of all node widths + gaps between them (gap * (nodes.length - 1))
  const totalWidth = singeNodeWidth * Math.max(0, nodes.length - 1);
  const startX = centerX - totalWidth / 2;

  // Place each node at the correct x position, spacing by its width and the gap
  let xCursor = startX;
  const positionedNodes = nodes.map((node, index) => {
    const width = nodeWidths[index] || 320;
    const positioned = {
      ...node,
      position: { x: xCursor + width / 2, y }
    };
    xCursor += width + singeNodeWidth;
    return positioned;
  });

  return positionedNodes;
}

/**
 * Place all nodes along the Y axis (vertical line). X is fixed (default 0 or centerX)
 */
export function calculateYLayout(
  nodes: Node[],
  options: { offset?: number; centerY?: number; x?: number } = {}
): Node[] {
  const { offset = 200, centerY = 300, x = 0 } = options;
  if (nodes.length === 0) return nodes;

  // If offset is provided and positive, use it as minimum gap; otherwise default gap
  const gap = typeof offset === 'number' ? Math.max(0, offset) : 0;

  // Compute each node's height from node.data if available (DataTableNode uses: 47 + columns.length * 28)
  const nodeHeights = nodes.map(node => {
    try {
      const cols = (node.data && (node.data as any).columns) || [];
      const len = Array.isArray(cols) ? cols.length : 0;
      return 47 + len * 28;
    } catch (e) {
      return 100; // fallback height
    }
  });

  const totalHeight = nodeHeights.reduce((s, h) => s + h, 0) + gap * (nodes.length - 1);
  let currentY = centerY - totalHeight / 2;

  return nodes.map((node, index) => {
    const h = nodeHeights[index] || 100;
    const posY = currentY;
    currentY += h + gap;
    return {
      ...node,
      position: { x, y: posY }
    };
  });
}

/**
 * Place all nodes into the smallest roughly-square box using provided offsets
 */
export function calculateBoxLayout(
  nodes: Node[],
  options: { offsetX?: number; offsetY?: number; centerX?: number; centerY?: number; compact?: boolean } = {}
): Node[] {
  const { offsetX = 200, offsetY = 150, centerX = 400, centerY = 300, compact = false } = options;
  if (nodes.length === 0) return nodes;

  // Determine grid dimensions (columns x rows) to make a compact box
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);

  // Compute heights for each node (use DataTableNode height heuristic)
  const nodeHeights = nodes.map(node => {
    try {
      const colsData = (node.data && (node.data as any).columns) || [];
      const len = Array.isArray(colsData) ? colsData.length : 0;
      return 47 + len * 28;
    } catch (e) {
      return 100;
    }
  });

  // Compute widths for each node. Try to read numeric width from data or style, fall back to 320
  const nodeWidths = nodes.map(node => {
    try {
      // Prefer explicit data.width if provided
      const wFromData = node.data && (node.data as any).width;
      if (typeof wFromData === 'number') return wFromData;
      if (typeof wFromData === 'string') {
        const parsed = parseFloat(wFromData);
        if (!isNaN(parsed)) return parsed;
      }

      // Try style.width if set like '320px'
      const styleWidth = (node as any).style && (node as any).style.width;
      if (typeof styleWidth === 'number') return styleWidth;
      if (typeof styleWidth === 'string') {
        const parsed = parseFloat(styleWidth);
        if (!isNaN(parsed)) return parsed;
      }

      return 320; // default width used in DataTableNode
    } catch (e) {
      return 320;
    }
  });

  // Build rows of indices and compute max height per row
  const rowsIndices: number[][] = [];
  const rowMaxHeights: number[] = [];
  for (let r = 0; r < rows; r++) {
    const start = r * cols;
    const end = Math.min(start + cols, nodes.length);
    const indices = [] as number[];
    let maxH = 0;
    for (let i = start; i < end; i++) {
      indices.push(i);
      if (nodeHeights[i] > maxH) maxH = nodeHeights[i];
    }
    rowsIndices.push(indices);
    rowMaxHeights.push(maxH || 0);
  }

  // Total height is sum of row heights plus gaps between rows
  const totalHeight = rowMaxHeights.reduce((s, h) => s + h, 0) + offsetY * Math.max(0, rows - 1);
  const startY = centerY - totalHeight / 2;

  const positioned: Node[] = [];

  if (!compact) {
    // For each row compute startX based on sum of widths and offset gaps, then assign positions
    let accumulatedY = 0;
    for (let r = 0; r < rows; r++) {
      const indices = rowsIndices[r];
      const itemsInRow = indices.length;

      // sum widths for this row
      const widths = indices.map(i => nodeWidths[i] || 0);
      const sumWidths = widths.reduce((s, w) => s + w, 0);
      const rowWidth = sumWidths + Math.max(0, itemsInRow - 1) * offsetX;
      const rowStartX = centerX - rowWidth / 2;

      const rowStartY = startY + accumulatedY;

      // place nodes left-to-right with their widths and offsetX gaps
      let xCursor = rowStartX;
      indices.forEach((nodeIdx, colIdx) => {
        const node = nodes[nodeIdx];
        const w = nodeWidths[nodeIdx] || 0;
        const x = xCursor;
        const y = rowStartY;
        positioned[nodeIdx] = {
          ...node,
          position: { x, y }
        };

        // advance cursor by width + gap
        xCursor += w + offsetX;
      });

      // advance accumulatedY by this row's max height + offsetY for next row
      accumulatedY += rowMaxHeights[r] + offsetY;
    }

    return positioned;
  }

  // Compact packing (row-major): fill rows left-to-right using actual node widths
  // Strategy:
  // 1) Compute per-column total heights (sum of node heights + offsetY gaps) so we can vertically center using the tallest column.
  // 2) During placement, use a per-column accumulated Y to stack nodes in the same column, ensuring each node's Y accounts for the full height above it.

  const colCounts = new Array(cols).fill(0);
  const colHeights = new Array(cols).fill(0);

  // Count nodes per column and sum heights
  for (let i = 0; i < nodes.length; i++) {
    const col = i % cols;
    colCounts[col] += 1;
    colHeights[col] += nodeHeights[i] || 0;
  }

  const colTotals = colHeights.map((h, ci) => {
    const count = colCounts[ci];
    return count > 0 ? h + offsetY * Math.max(0, count - 1) : 0;
  });

  const maxColHeight = Math.max(...colTotals, 0);
  // center vertically based on column totals (compact stacking uses column heights)
  const compactStartY = centerY - maxColHeight / 2;

  // per-column running Y accumulator (initially zero)
  const colAccumulatedY = new Array(cols).fill(0);

  for (let r = 0; r < rows; r++) {
    const indices = rowsIndices[r];
    const itemsInRow = indices.length;

    // sum widths for this row to center it
    const widths = indices.map(i => nodeWidths[i] || 0);
    const sumWidths = widths.reduce((s, w) => s + w, 0);
    const rowWidth = sumWidths + Math.max(0, itemsInRow - 1) * offsetX;
    const rowStartX = centerX - rowWidth / 2;

    // place nodes left-to-right with their widths and per-column Y offsets
    let xCursor = rowStartX;
    indices.forEach((nodeIdx, idxInRow) => {
      const node = nodes[nodeIdx];
      const w = nodeWidths[nodeIdx] || 0;

      // column index across the grid (consistent across rows)
      const col = nodeIdx % cols;

      // compute y based on the accumulated height for this column
      const y = compactStartY + colAccumulatedY[col];

      positioned[nodeIdx] = {
        ...node,
        position: { x: xCursor, y }
      };

      // advance cursor by width + gap
      xCursor += w + offsetX;

      // update this column's accumulated Y by this node's height + offsetY
      colAccumulatedY[col] += (nodeHeights[nodeIdx] || 0) + offsetY;
    });
  }

  return positioned;

}

// Place nodes by rule and split by IsIsolated property
export type LayoutRule = "circular" | "hierarchical" | "force" | "x" | "y" | "box" | "ccrowe";

export function placeNodesByRule(
  nodes: Node[],
  edges: Edge[],
  rule: LayoutRule,
  options: LayoutOptions = {}
): Node[] {
  const isolated = nodes.filter(n => n.data?.IsIsolated);
  const nonIsolated = nodes.filter(n => !n.data?.IsIsolated);

  let layoutFn: (nodes: Node[], edges: Edge[], options: LayoutOptions) => Node[];
  switch (rule) {
    case "circular":
      layoutFn = (ns, _e, opts) => calculateCircularLayout(ns, opts);
      break;
    case "force":
      layoutFn = (ns, es, opts) => calculateForceDirectedLayout(ns, es, opts);
      break;
    case "x":
      layoutFn = (ns, _e, opts) => calculateXLayout(ns, opts);
      break;
    case "y":
      layoutFn = (ns, _e, opts) => calculateYLayout(ns, opts);
      break;
    case "box":
      layoutFn = (ns, _e, opts) => calculateBoxLayout(ns, opts);
      break;
    case "hierarchical":
    default:
      layoutFn = (ns, es, opts) => calculateHierarchicalLayout(ns, es, opts);
      break;
  }

  const positionedIsolated = isolated.length ? layoutFn(isolated, [], options) : [];
  const positionedNonIsolated = nonIsolated.length ? layoutFn(nonIsolated, edges, options) : [];

  // Combine results, preserving order
  const positionedMap = new Map<string, Node>();
  [...positionedIsolated, ...positionedNonIsolated].forEach(n => positionedMap.set(n.id, n));
  return nodes.map(n => positionedMap.get(n.id) ?? n);
}