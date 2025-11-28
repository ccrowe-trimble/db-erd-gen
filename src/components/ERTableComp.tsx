import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Panel,
  Node,
  Edge,
  MiniMap,
  ReactFlowInstance,
} from 'reactflow';
import DataTableNode from './node/DataTableNode';
import CustomEdge from './edges/CustomEdge';
import { Badge, Group, Select, Slider, Stack, Text, Collapse, Switch, Tooltip, ColorInput, rgba } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

import { inputDataToNodeAndEdges, LayoutType } from '../utilis/inputData/inputDataToNode';
import { Table, TablePosition } from '../interface/inputData';

import useTableStore from '../store/zustandStore';
import useUISettingsStore from '../store/uiSettingsStore';
import DownloadButton from './leftBar/components/DownloadButton';
import ReloadButton from './leftBar/components/ReloadButton';
import { Button } from '@mantine/core';

// Define nodeTypes and edgeTypes at module scope so their identities are stable
const NODE_TYPES = { textUpdater: DataTableNode } as const;
const EDGE_TYPES = { custom: CustomEdge } as const;

interface ERTableProps {
  tableArray: Table[]
  updateTablePositions?: (tableName: string, position: TablePosition) => void
}

function ERTableComp({ tableArray, updateTablePositions }: ERTableProps) {

  const update = useTableStore((state) => state.update);

  const [nodes, setNodes] = useState<Node<any>[]>([]);
  const [edges, setEdges] = useState<Edge<any>[]>([]);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [layoutType, setLayoutType] = useState<LayoutType>('linear');
  // highlightMode persisted via ui settings store
  const highlightMode = useUISettingsStore((s: any) => s.highlightMode ?? 'dim');
  const setHighlightMode = useUISettingsStore((s: any) => s.setHighlightMode);
  // showEdges persisted via zustand store
  const showEdges = useUISettingsStore((s: any) => s.showEdges ?? true);
  const setShowEdges = useUISettingsStore((s: any) => s.setShowEdges);
  const resetUISettings = useUISettingsStore((s: any) => s.resetUISettings);
  const showDataTypes = useUISettingsStore((s: any) => s.showDataTypes ?? true);
  const setShowDataTypes = useUISettingsStore((s: any) => s.setShowDataTypes);
  const tableBackgroundColor = useUISettingsStore((s: any) => s.tableBackgroundColor ?? '#ffffff');
  const setTableBackgroundColor = useUISettingsStore((s: any) => s.setTableBackgroundColor);
  // React Flow instance for actions like fitView
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Layout configuration state
  const [circularRadius, setCircularRadius] = useState(800);
  // New X/Y/Box layout options
  const [xyOffset, setXyOffset] = useState(200); // used for X and Y layouts
  const [boxOffsetX, setBoxOffsetX] = useState(200);
  const [boxOffsetY, setBoxOffsetY] = useState(150);
  // persisted compact mode for box layout
  const boxCompact = useUISettingsStore((s: any) => s.boxCompact ?? false);
  const setBoxCompact = useUISettingsStore((s: any) => s.setBoxCompact);
  const [forceRepulsion, setForceRepulsion] = useState(1000);
  const [forceAttraction, setForceAttraction] = useState(0.1);
  const [forceIterations, setForceIterations] = useState(50);
  const [forceCenterX, setForceCenterX] = useState(400);
  const [forceCenterY, setForceCenterY] = useState(300);
  const [forceDamping, setForceDamping] = useState(0.9);
  const [forceMinDistance, setForceMinDistance] = useState(150);
  const [forceRepulsionMultiplier, setForceRepulsionMultiplier] = useState(1.0);
  const [hierarchicalNodeSpacing, setHierarchicalNodeSpacing] = useState(200);
  const [hierarchicalLevelSpacing, setHierarchicalLevelSpacing] = useState(150);

  // Filter nodes and edges based on highlighted node
  const filteredNodes = useMemo(() => {
    if (!highlightedNodeId) return nodes;
    // Get all node IDs that are directly connected to the highlighted node
    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(highlightedNodeId);

    edges.forEach(edge => {
      if (edge.source === highlightedNodeId) {
        connectedNodeIds.add(edge.target);
      } else if (edge.target === highlightedNodeId) {
        connectedNodeIds.add(edge.source);
      }
    });

    if (highlightMode === 'hide') {
      return nodes.filter(node => connectedNodeIds.has(node.id));
    }

    // dim mode: return all nodes but with reduced opacity for non-neighbors
    return nodes.map(node => ({
      ...node,
      style: {
        ...(node.style || {}),
        opacity: connectedNodeIds.has(node.id) ? 1 : 0.12
      }
    }));
  }, [nodes, edges, highlightedNodeId]);

  const filteredEdges = useMemo(() => {
    if (!highlightedNodeId) return edges;

    if (highlightMode === 'hide') {
      return edges.filter(edge =>
        edge.source === highlightedNodeId || edge.target === highlightedNodeId
      );
    }

    // dim mode: keep all edges but lower opacity for edges not connected to highlighted node
    return edges.map(edge => ({
      ...edge,
      style: {
        ...(edge.style || {}),
        opacity: edge.source === highlightedNodeId || edge.target === highlightedNodeId ? 1 : 0.08
      }
    }));
  }, [edges, highlightedNodeId]);

  useEffect(() => {
    const layoutOptions = {
      radius: circularRadius,
      repulsionForce: forceRepulsion,
      repulsionMultiplier: forceRepulsionMultiplier,
      attractionForce: forceAttraction,
      iterations: forceIterations,
      centerX: forceCenterX,
      centerY: forceCenterY,
      damping: forceDamping,
      minDistance: forceMinDistance,
      nodeSpacing: hierarchicalNodeSpacing,
      levelSpacing: hierarchicalLevelSpacing,
      // X/Y/Box options
      offset: xyOffset,
      offsetX: boxOffsetX,
      offsetY: boxOffsetY,
      compact: boxCompact,
    };

    const testData = inputDataToNodeAndEdges(tableArray, { type: layoutType, options: layoutOptions });

    // apply per-node React Flow style for background color so nodes pick up color via node.style
    const styledNodes = testData.nodes.map(n => ({
      ...n,
      // keep the visual style for React Flow, and also add a data hint so the node component can read it
      style: {
        ...(n.style || {}),
        background: tableBackgroundColor,
        backgroundColor: tableBackgroundColor,
      },
      data: {
        ...(n.data || {}),
        __background: tableBackgroundColor,
      }
    }));

    setNodes(styledNodes);
    setEdges(testData.edges);

  }, [tableArray, update, layoutType, circularRadius, forceRepulsion, forceAttraction, forceIterations, forceCenterX, forceCenterY, forceDamping, forceMinDistance, forceRepulsionMultiplier, hierarchicalNodeSpacing, hierarchicalLevelSpacing, xyOffset, boxOffsetX, boxOffsetY, boxCompact, tableBackgroundColor]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds))
    }, []
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node,) => {
      !!updateTablePositions && updateTablePositions(node.data.name, node.position);
    }, []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges, tableArray]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setHighlightedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  // Keyboard shortcuts: E toggles edges, H toggles highlight mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') {
        setShowEdges?.(!showEdges);
      } else if (e.key === 'h' || e.key === 'H') {
        setHighlightMode?.(highlightMode === 'hide' ? 'dim' : 'hide');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showEdges, highlightMode, setShowEdges, setHighlightMode]);

  // use stable module-level node/edge type objects
  const nodeTypes = NODE_TYPES;
  const edgeTypes = EDGE_TYPES;

  return (
    <div style={{ height: '100%', width: "100%", marginTop: "5vh" }}>
      <ReactFlow
        onInit={(instance) => setRfInstance(instance)}
        nodes={filteredNodes}
        edges={showEdges ? filteredEdges : []}

        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}

        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesUpdatable={true}
        minZoom={0.01}
        maxZoom={4}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />

        <Panel position="top-right" style={{ width: 360, background: rgba('red', 0.2), padding: 6, borderRadius: 6 }}>
          <Group mt={8}>
            <Select
              size="xs"
              placeholder="Layout"
              data={[
                { value: 'linear', label: 'Linear' },
                { value: 'circular', label: 'Circular' },
                { value: 'hierarchical', label: 'Hierarchical' },
                { value: 'x', label: 'X (left to right)' },
                { value: 'y', label: 'Y (top to bottom)' },
                { value: 'box', label: 'Box (grid)' },
                { value: 'force-directed', label: 'Force Directed' },
              ]}
              value={layoutType}
              onChange={(value) => {
                setLayoutType(value as LayoutType);
                setHighlightedNodeId(null); // Reset highlight when changing layout
              }}
              style={{ width: 120 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tooltip label="Dim non-neighbors (de-emphasize)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text size="xs">DIM</Text>
                  <IconEye size={14} />
                </div>
              </Tooltip>
              <Switch size="xs" checked={highlightMode === 'hide'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHighlightMode?.(e.currentTarget.checked ? 'hide' : 'dim')} />
              <Tooltip label="Hide non-neighbors (remove from view)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconEyeOff size={14} />
                  <Text size="xs">Hide</Text>
                </div>
              </Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text size="xs">Edges</Text>
              <Switch size="xs" checked={!!showEdges} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowEdges?.(e.currentTarget.checked)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text size="xs">Types</Text>
              <Switch size="xs" checked={!!showDataTypes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowDataTypes?.(e.currentTarget.checked)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text size="xs">Table BG</Text>
              <Tooltip label="Pick table background color (persisted)">
                <div>
                  <ColorInput
                    size="xs"
                    value={tableBackgroundColor}
                    onChange={(c) => setTableBackgroundColor?.(c || '#ffffff')}
                    swatches={['#ffffff', '#f8f9fa', '#f1f3f5', '#e9ecef', '#ffe066', '#ffd43b', '#ffa94d', '#ff6b6b', '#e64980', '#845ef7']}
                    style={{ width: 120 }}
                  />
                </div>
              </Tooltip>
            </div>
            <Button size="xs" variant="outline" onClick={() => { resetUISettings?.(); rfInstance?.fitView(); }}>Reset UI</Button>
            <Badge radius="sm" variant='light' color="green" tt="none">
              Table count: {filteredNodes.length}{highlightedNodeId ? ` (filtered)` : ''}
            </Badge>
            {highlightedNodeId && (
              <Badge radius="sm" variant='filled' color="blue" tt="none">
                Highlighted: {highlightedNodeId}
              </Badge>
            )}

            {!!updateTablePositions && <DownloadButton />}
            <ReloadButton />
          </Group>
        </Panel>

        <Panel position="top-left">
          <Stack gap="xs">

            <Collapse in={layoutType === 'circular'}>
              <Group gap="xs" align="center">
                <Text size="xs" w={80}>Radius:</Text>
                <Slider
                  size="xs"
                  min={100}
                  max={4000}
                  step={100}
                  value={circularRadius}
                  onChange={setCircularRadius}
                  style={{ width: 100 }}
                />
                <Text size="xs" w={30}>{circularRadius}</Text>
              </Group>
            </Collapse>

            <Collapse in={layoutType === 'x' || layoutType === 'y'}>
              <Group gap="xs" align="center">
                <Text size="xs" w={80}>Offset:</Text>
                <Slider
                  size="xs"
                  min={50}
                  max={800}
                  step={10}
                  value={xyOffset}
                  onChange={setXyOffset}
                  style={{ width: 100 }}
                />
                <Text size="xs" w={40}>{xyOffset}</Text>
              </Group>
            </Collapse>

            <Collapse in={layoutType === 'box'}>
              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Offset X:</Text>
                  <Slider
                    size="xs"
                    min={0}
                    max={800}
                    step={50}
                    value={boxOffsetX}
                    onChange={setBoxOffsetX}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{boxOffsetX}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Offset Y:</Text>
                  <Slider
                    size="xs"
                    min={0}
                    max={800}
                    step={50}
                    value={boxOffsetY}
                    onChange={setBoxOffsetY}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{boxOffsetY}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Compact:</Text>
                  <Switch size="xs" checked={boxCompact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBoxCompact(e.currentTarget.checked)} />
                </Group>
              </Stack>
            </Collapse>

            <Collapse in={layoutType === 'hierarchical'}>
              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Node Spacing:</Text>
                  <Slider
                    size="xs"
                    min={100}
                    max={3000}
                    step={100}
                    value={hierarchicalNodeSpacing}
                    onChange={setHierarchicalNodeSpacing}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{hierarchicalNodeSpacing}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Level Spacing:</Text>
                  <Slider
                    size="xs"
                    min={50}
                    max={3000}
                    step={50}
                    value={hierarchicalLevelSpacing}
                    onChange={setHierarchicalLevelSpacing}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{hierarchicalLevelSpacing}</Text>
                </Group>
              </Stack>
            </Collapse>

            <Collapse in={layoutType === 'force-directed'}>
              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Repulsion:</Text>
                  <Slider
                    size="xs"
                    min={200}
                    max={3000}
                    step={100}
                    value={forceRepulsion}
                    onChange={setForceRepulsion}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{forceRepulsion}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Attraction:</Text>
                  <Slider
                    size="xs"
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    value={forceAttraction}
                    onChange={setForceAttraction}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{forceAttraction.toFixed(2)}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Iterations:</Text>
                  <Slider
                    size="xs"
                    min={10}
                    max={200}
                    step={10}
                    value={forceIterations}
                    onChange={setForceIterations}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={30}>{forceIterations}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Center X:</Text>
                  <Slider
                    size="xs"
                    min={-1000}
                    max={2000}
                    step={50}
                    value={forceCenterX}
                    onChange={setForceCenterX}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{forceCenterX}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Center Y:</Text>
                  <Slider
                    size="xs"
                    min={-1000}
                    max={2000}
                    step={50}
                    value={forceCenterY}
                    onChange={setForceCenterY}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{forceCenterY}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Min Distance:</Text>
                  <Slider
                    size="xs"
                    min={50}
                    max={500}
                    step={25}
                    value={forceMinDistance}
                    onChange={setForceMinDistance}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{forceMinDistance}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Repulsion ×:</Text>
                  <Slider
                    size="xs"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={forceRepulsionMultiplier}
                    onChange={setForceRepulsionMultiplier}
                    style={{ width: 100 }}
                  />
                  <Text size="xs" w={40}>{forceRepulsionMultiplier.toFixed(2)}</Text>
                </Group>
              </Stack>
            </Collapse>
          </Stack>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default ERTableComp
