import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Badge, Group, Select, Slider, Stack, Text, Collapse, Switch, Tooltip, ColorInput, rgba, ActionIcon } from '@mantine/core';
import { IconEye, IconEyeOff, IconX } from '@tabler/icons-react';

import { inputDataToNodeAndEdges, LayoutType } from '../utils/inputData/inputDataToNode';
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
  const nodesRef = useRef<Node<any>[]>(nodes);
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
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // helper to update nodes state and keep ref in sync
  const updateNodes = useCallback((updater: Node<any>[] | ((prev: Node<any>[]) => Node<any>[])) => {
    setNodes((prev) => {
      const next = typeof updater === 'function' ? (updater as (prev: Node<any>[]) => Node<any>[])(prev) : updater;
      nodesRef.current = next as Node<any>[];
      return next as Node<any>[];
    });
  }, []);
  const [shouldFitOnUpdate, setShouldFitOnUpdate] = useState(false);

  // Layout configuration state
  const [circularRadius, setCircularRadius] = useState(500);
  // New X/Y/Box layout options
  const [xyOffset, setXyOffset] = useState(200); // used for X and Y layouts
  const [circularOffsetX, setCircularOffsetX] = useState(50);
  const [boxOffsetX, setBoxOffsetX] = useState(200);
  const [boxOffsetY, setBoxOffsetY] = useState(150);
  // persisted compact mode for box layout
  const boxCompact = useUISettingsStore((s: any) => s.boxCompact ?? true);
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
  // When true, Reformat will only recompute layout for nodes currently visible in the viewport
  const [viewportOnlyReformat, setViewportOnlyReformat] = useState(false);

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
    var changedNodes = nodes.map(node => ({
      ...node,
      style: {
        ...(node.style || {}),
        opacity: connectedNodeIds.has(node.id) ? 1 : 0.12,
      },
    }));



    return changedNodes;
  }, [nodes, edges, highlightedNodeId, highlightMode]);

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
        opacity: edge.source === highlightedNodeId || edge.target === highlightedNodeId ? 1 : 0.08,
      },
    }));
  }, [edges, highlightedNodeId, highlightMode]);

  useEffect(() => {
    // no-op: placeholder to satisfy linting if function is hoisted below
  }, []);

  // compute and apply layout — extracted so we can call it on demand (Reformat button) or from effects
  // layoutOptions is now available at component scope for all callbacks
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

  const computeAndApplyLayout = useCallback((viewportOnly: boolean = false) => {
    // If viewportOnly is requested, try to compute which nodes are visible in the
    // current React Flow viewport and only run layout for those. We rely on
    // rfInstance.project to translate screen coords to flow coordinates. If the
    // instance or projection fails, fallback to full layout.
    if (viewportOnly && rfInstanceRef.current) {
      try {
        // top-left and bottom-right of the viewport in screen coords
        const topLeft = rfInstanceRef.current!.project({ x: 0, y: 0 });
        const bottomRight = rfInstanceRef.current!.project({ x: window.innerWidth, y: window.innerHeight });

        const minX = Math.min(topLeft.x, bottomRight.x);
        const maxX = Math.max(topLeft.x, bottomRight.x);
        const minY = Math.min(topLeft.y, bottomRight.y);
        const maxY = Math.max(topLeft.y, bottomRight.y);

        // decide which current nodes fall into the viewport rectangle
        const visibleNodeIds = new Set<string>();
        nodesRef.current.forEach(n => {
          if (!n.position) return;
          const nx = n.position.x;
          const ny = n.position.y;
          // conservative test: check node origin is inside viewport
          if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
            visibleNodeIds.add(n.id);
          }
        });

        if (visibleNodeIds.size > 0) {
          const subsetTables = tableArray.filter(t => visibleNodeIds.has(t.name));
          if (subsetTables.length > 0) {
            const testDataSubset = inputDataToNodeAndEdges(subsetTables, { type: layoutType, options: layoutOptions });

            // apply background color only for nodes returned by the layout
            const styledSubsetNodes = testDataSubset.nodes.map(n => ({
              ...n,
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

            // map returned positions back into the existing nodes state
            const posMap = new Map<string, { x: number; y: number }>();
            styledSubsetNodes.forEach(n => posMap.set(n.id, n.position));

            updateNodes(prev => prev.map(n => (
              visibleNodeIds.has(n.id) ? { ...n, position: posMap.get(n.id) || n.position, style: { ...(n.style || {}), background: tableBackgroundColor, backgroundColor: tableBackgroundColor }, data: { ...(n.data || {}), __background: tableBackgroundColor } } : n
            )));

            // Keep existing edges; updating only nodes' positions is sufficient here
            setEdges((eds) => eds.map(e => ({ ...e })));
            setShouldFitOnUpdate(true);
            return;
          }
        }
      } catch (err) {
        // projection failed — fall back to full layout below
        // noop
      }
    }

    // full layout fallback
    const testData = inputDataToNodeAndEdges(tableArray, { type: layoutType, options: layoutOptions });

    // apply per-node React Flow style for background color so nodes pick up color via node.style
    // Utility to determine best contrast color (black or white) for a given background
    function getContrastYIQ(hexcolor: string) {
      let color = hexcolor.replace('#', '');
      if (color.length === 3) {
        color = color.split('').map(c => c + c).join('');
      }
      const r = parseInt(color.substr(0, 2), 16);
      const g = parseInt(color.substr(2, 2), 16);
      const b = parseInt(color.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    const textColor = getContrastYIQ(tableBackgroundColor);

    const styledNodes = testData.nodes.map(n => ({
      ...n,
      style: {
        ...(n.style || {}),
        background: tableBackgroundColor,
        backgroundColor: tableBackgroundColor,
        color: textColor,
      },
      data: {
        ...(n.data || {}),
        __background: tableBackgroundColor,
        __textColor: textColor,
      }
    }));

    // Merge new positions/styles into existing nodes to preserve filtered/dimmed state
    // Replace nodes state with the full set of generated nodes to ensure all tables are added
    setNodes(styledNodes);
    setEdges(testData.edges);
    setShouldFitOnUpdate(true);
  }, [
    tableArray,
    layoutType,
    circularRadius,
    forceRepulsion,
    forceRepulsionMultiplier,
    forceAttraction,
    forceIterations,
    forceCenterX,
    forceCenterY,
    forceDamping,
    forceMinDistance,
    hierarchicalNodeSpacing,
    hierarchicalLevelSpacing,
    xyOffset,
    boxOffsetX,
    boxOffsetY,
    boxCompact,
    tableBackgroundColor,
  ]);

  // run layout computation initially and whenever relevant inputs change
  useEffect(() => {
    computeAndApplyLayout();
  }, [computeAndApplyLayout]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      updateNodes((nds) => applyNodeChanges(changes, nds))
    }, [updateNodes]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node,) => {
      !!updateTablePositions && updateTablePositions(node.data.name, node.position);
    }, []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  // Recalculate layout whenever edges, tableArray, layoutType, or layoutOptions change
  useEffect(() => {
    const layoutResult = inputDataToNodeAndEdges(tableArray, { type: layoutType, options: layoutOptions });
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
  }, [tableArray, layoutType, layoutOptions]);

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

  useEffect(() => {
    if (!shouldFitOnUpdate) return;
    if (!rfInstance) return;

    let cancelled = false;
    // run two rAFs to ensure the DOM/React Flow has painted the new nodes
    let raf1: number | undefined;
    let raf2: number | undefined;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          rfInstance.fitView({ padding: 0.12 });
        } catch (e) {
          // ignore errors from fitView when instance is unavailable
        }
        // clear the flag so we don't refit repeatedly
        setShouldFitOnUpdate(false);
      });
    });

    return () => {
      cancelled = true;
      // cancel both rafs if still pending
      if (raf1 !== undefined) cancelAnimationFrame(raf1);
      if (raf2 !== undefined) cancelAnimationFrame(raf2);
    };
  }, [shouldFitOnUpdate, filteredNodes, rfInstance]);

  // When a filter (highlightedNodeId) is applied, recompute layout for the
  // visible subset (neighbors + highlighted node) so their positions are
  // recalculated and the viewport can refit to the new arrangement.
  useEffect(() => {
    if (!highlightedNodeId) return;

    // collect connected node ids
    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(highlightedNodeId);
    edges.forEach(edge => {
      if (edge.source === highlightedNodeId) connectedNodeIds.add(edge.target);
      else if (edge.target === highlightedNodeId) connectedNodeIds.add(edge.source);
    });

    // build a filtered table array matching the connected nodes so the
    // layout utility computes positions for only those nodes
    const subsetTables = tableArray.filter(t => connectedNodeIds.has(t.name));
    if (subsetTables.length === 0) return;

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
      offset: xyOffset,
      offsetX: boxOffsetX,
      offsetY: boxOffsetY,
      compact: boxCompact,
    };

    console.log(subsetTables);
    const testData = inputDataToNodeAndEdges(subsetTables, { type: layoutType, options: layoutOptions });

    // map returned positions back into the existing nodes state
    const posMap = new Map<string, { x: number; y: number }>();
    testData.nodes.forEach(n => posMap.set(n.id, n.position));

    updateNodes(prev => prev.map(n => (
      connectedNodeIds.has(n.id) ? { ...n, position: posMap.get(n.id) || n.position } : n
    )));

    // request fit after repaint
    setShouldFitOnUpdate(true);
  }, [highlightedNodeId, tableArray, layoutType, circularRadius, forceRepulsion, forceRepulsionMultiplier, forceAttraction, forceIterations, forceCenterX, forceCenterY, forceDamping, forceMinDistance, hierarchicalNodeSpacing, hierarchicalLevelSpacing, xyOffset, boxOffsetX, boxOffsetY, boxCompact, edges]);

  return (
    <div style={{ height: '100%', width: "100%", marginTop: "5vh" }}>
      <ReactFlow
        onInit={(instance) => { setRfInstance(instance); rfInstanceRef.current = instance; }}
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

        <Panel position="top-right" style={{ width: 500, background: rgba('red', 0.08), padding: 6, borderRadius: 6 }}>
          <Group mt={8}>
            <Select
              size="xs"
              placeholder="Layout"
              data={[
                { value: 'linear', label: 'Manual' },
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
                // request fitView after the layout change has been applied and nodes rendered
                setShouldFitOnUpdate(true);
              }}
              style={{ width: 140 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tooltip label="Dim non-neighbors (de-emphasize)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text size="xs">Dim</Text>
                  <IconEye size={14} />
                </div>
              </Tooltip>
              <Switch size="xs" color="green" checked={highlightMode === 'hide'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHighlightMode?.(e.currentTarget.checked ? 'hide' : 'dim')} />
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
            <Button size="xs" variant="default" onClick={() => computeAndApplyLayout(viewportOnlyReformat)}>Reformat</Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text size="xs">Viewport</Text>
              <Tooltip label="Only recompute layout for nodes currently visible in the viewport">
                <Switch size="xs" checked={viewportOnlyReformat} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setViewportOnlyReformat(e.currentTarget.checked)} />
              </Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tooltip label={highlightedNodeId ? 'Click to clear filter' : ''}>
                <Badge
                  radius="sm"
                  variant='light'
                  color="green"
                  tt="none"
                  style={{ cursor: highlightedNodeId ? 'pointer' : 'default' }}
                  onClick={() => { if (highlightedNodeId) setHighlightedNodeId(null); }}
                >
                  Table count: {filteredNodes.length}{highlightedNodeId ? ` (filtered)` : ''}
                </Badge>
              </Tooltip>
              {highlightedNodeId && (
                <ActionIcon size="xs" color="gray" variant="subtle" onClick={() => setHighlightedNodeId(null)}>
                  <IconX size={14} />
                </ActionIcon>
              )}
            </div>
            {highlightedNodeId && (
              <Badge radius="sm" variant='filled' color="blue" tt="none">
                Highlighted: {highlightedNodeId}
              </Badge>
            )}

            {!!updateTablePositions && <DownloadButton />}
            <ReloadButton />
          </Group>

          {/* Show relevant layout controls depending on the selected layout mode */}
          <Stack gap="xs" mt={8}>
            {layoutType === 'circular' && (
              <div>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Radius:</Text>
                  <Slider
                    size="xs"
                    min={100}
                    max={4000}
                    step={100}
                    value={circularRadius}
                    onChange={setCircularRadius}
                    style={{ width: 140 }}
                  />
                  <Text size="xs" w={40}>{circularRadius}</Text>
                </Group>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Offset X:</Text>
                  <Slider
                    size="xs"
                    min={0}
                    max={800}
                    step={50}
                    value={circularOffsetX}
                    onChange={setCircularOffsetX}
                    style={{ width: 140 }}
                  />
                  <Text size="xs" w={40}>{circularOffsetX}</Text>
                </Group>

              </div>
            )}

            {(layoutType === 'x' || layoutType === 'y') && (
              <div>
                <Group gap="xs" align="center">
                  <Text size="xs" w={80}>Offset:</Text>
                  <Slider
                    size="xs"
                    min={50}
                    max={800}
                    step={10}
                    value={xyOffset}
                    onChange={setXyOffset}
                    style={{ width: 140 }}
                  />
                  <Text size="xs" w={40}>{xyOffset}</Text>
                </Group>
              </div>
            )}

            {layoutType === 'box' && (
              <div>
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
                    />
                    <Text size="xs" w={40}>{boxOffsetY}</Text>
                  </Group>
                  <Group gap="xs" align="center">
                    <Text size="xs" w={80}>Compact:</Text>
                    <Switch size="xs" checked={boxCompact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBoxCompact(e.currentTarget.checked)} />
                  </Group>
                </Stack>
              </div>
            )}

            {layoutType === 'hierarchical' && (
              <div>
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
                    />
                    <Text size="xs" w={40}>{hierarchicalLevelSpacing}</Text>
                  </Group>
                </Stack>
              </div>
            )}

            {layoutType === 'force-directed' && (
              <div>
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
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
                      style={{ width: 140 }}
                    />
                    <Text size="xs" w={40}>{forceRepulsionMultiplier.toFixed(2)}</Text>
                  </Group>
                </Stack>
              </div>
            )}
          </Stack>
        </Panel>
      </ReactFlow>
    </div>
  )
}

export default ERTableComp
