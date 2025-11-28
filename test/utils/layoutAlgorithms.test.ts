import { expect, test } from 'vitest';
import { calculateHierarchicalLayout, calculateYLayout } from '../../src/utilis/layoutAlgorithms';
import { Node, Edge } from 'reactflow';

function makeNode(id: string, cols = 3): Node {
  return {
    id,
    type: 'textUpdater',
    position: { x: 0, y: 0 },
    data: { name: id, columns: Array.from({ length: cols }).map((_, i) => ({ name: `c${i}` })) }
  } as unknown as Node;
}

test('hierarchical layout places isolated nodes above connected ones', () => {
  const a = makeNode('A', 2);
  const b = makeNode('B', 2);
  const c = makeNode('C', 2);
  const d = makeNode('D', 2); // isolated

  const nodes: Node[] = [a, b, c, d];
  const edges: Edge[] = [
    { id: 'e1', source: 'A', target: 'B', sourceHandle: '', targetHandle: '', type: 'custom' } as Edge,
    { id: 'e2', source: 'B', target: 'C', sourceHandle: '', targetHandle: '', type: 'custom' } as Edge
  ];

  const laidOut = calculateHierarchicalLayout(nodes, edges, { centerX: 400, isolatedNodesPerRow: 3 });

  const isolated = laidOut.find(n => n.id === 'D')!;
  const connectedYs = laidOut.filter(n => n.id !== 'D').map(n => n.position!.y as number);

  expect(isolated.position!.y as number).toBeLessThan(Math.min(...connectedYs));
});

test('Y layout stacks nodes by data-driven heights', () => {
  const n1 = makeNode('n1', 1); // height 47 + 1*28 = 75
  const n2 = makeNode('n2', 3); // height 47 + 3*28 = 131
  const n3 = makeNode('n3', 2); // height 103

  const nodes = [n1, n2, n3];

  const out = calculateYLayout(nodes, { centerY: 300, offset: 20, x: 100 });

  const yPositions = out.map(n => n.position!.y as number);

  // positions should be strictly increasing
  expect(yPositions[0]).toBeLessThan(yPositions[1]);
  expect(yPositions[1]).toBeLessThan(yPositions[2]);

  // distance between top of node1 and top of node2 should be at least node1 height + offset
  const nodeHeights = nodes.map(n => 47 + (n.data as any).columns.length * 28);
  expect(yPositions[1] - yPositions[0]).toBeGreaterThanOrEqual(nodeHeights[0] + 20 - 1); // fudge
});
