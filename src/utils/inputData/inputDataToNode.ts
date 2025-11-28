import { Node, Edge } from "reactflow";
import { Table } from "../../interface/inputData";
import { calculateHierarchicalLayout, calculateCircularLayout, calculateForceDirectedLayout, calculateXLayout, calculateYLayout, calculateBoxLayout, LayoutOptions } from "../layoutAlgorithms";

export type LayoutType = 'linear' | 'circular' | 'hierarchical' | 'force-directed' | 'x' | 'y' | 'box';

export interface LayoutConfig {
  type: LayoutType;
  options?: LayoutOptions & {
    radius?: number;
    iterations?: number;
    repulsionForce?: number;
    attractionForce?: number;
        // X/Y/Box specific options
        offset?: number;
        offsetX?: number;
        offsetY?: number;
                compact?: boolean;
    isolatedNodesPerRow?: number;
    isolatedNodeSpacing?: number;
    isolatedRowSpacing?: number;
  };
}

export function inputDataToNodeAndEdges(
  tablesArr: Table[],
  layoutConfig: LayoutConfig = { type: 'linear' }
){

    const initNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    let initTableDistance: number = 200;

    for(let table of tablesArr){

        const name = table.name;

        // Create Edge checking
        for(let [ind, k] of Object.entries(table.columns)){
            if(!!k.foreignTo){

                const sourceHandle = `${k.foreignTo!.name}_${k.foreignTo!.column}_right`
                const targetHandle = `${name}_${k.name}_left`

                initialEdges.push({
                    "id": `reactflow__${sourceHandle}_${targetHandle}_gen`,
                    "source": k.foreignTo!.name,
                    "sourceHandle": sourceHandle,
                    "target": name,
                    "targetHandle": targetHandle,
                    "type": "custom",
                } as Edge)
            }
        }

        const tableInfo = {
            name: name,
            columns: table.columns,
            position: table.position || { x: initTableDistance, y: 500 },
            // Width hint for layout algorithms (Box layout uses this)
            width: (table as any).width ?? 320
        }

        initNodes.push({
            id: name,
            type: 'textUpdater',
            position: table.position || { x: initTableDistance, y: 500 },
            data: tableInfo
        })

        initTableDistance += 250;
    }

    // Apply layout algorithm if not linear
    let positionedNodes = initNodes;
    
    if (layoutConfig.type !== 'linear') {
      switch (layoutConfig.type) {
        case 'circular': {
          // Separate linked and isolated nodes
          // Only include nodes that are present in at least one edge as source or target
          const edgeNodeIds = new Set<string>();
          initialEdges.forEach(e => {
            edgeNodeIds.add(e.source);
            edgeNodeIds.add(e.target);
          });
          // A node is isolated only if it has NO incoming AND NO outgoing edges
          const linkedNodes = initNodes.filter(n => edgeNodeIds.has(n.id));
          const isolatedNodes = initNodes.filter(n =>
            !initialEdges.some(e => e.source === n.id || e.target === n.id)
          );

          // Circular layout for linked nodes
          // Defensive: filter out any nodes that are not actually linked by an edge
          // Mark isolated nodes for debug/inspection
          const circularNodes = calculateCircularLayout(linkedNodes, layoutConfig.options);
          let markedGridNodes: Node[] = [];

          // Grid layout for isolated nodes (reuse box layout, above centerY)
          let gridNodes: Node[] = [];
          if (isolatedNodes.length > 0) {
            const gridOptions = {
              ...(layoutConfig.options || {}),
              centerY: (layoutConfig.options?.centerY ?? 300) - (layoutConfig.options?.radius ?? 300) - 220,
              offsetY: 10,
              offsetX: 220,
              compact: false
            };
            gridNodes = calculateBoxLayout(isolatedNodes, gridOptions);
            // Mark isolated nodes for debug/inspection
            markedGridNodes = gridNodes.map(n => ({
              ...n,
              data: {
                ...n.data,
                ISOLATED: true
              },
              position: {
                ...n.position,
                y: Math.min(n.position.y, (layoutConfig.options?.centerY ?? 300) - (layoutConfig.options?.radius ?? 300) - 80)
              }
            }));
          }

          positionedNodes = [...circularNodes, ...gridNodes];
          break;
        }
          case 'x':
              console.log('initNodes', initNodes);
                positionedNodes = calculateXLayout(initNodes, { offset: layoutConfig.options?.offset, centerX: layoutConfig.options?.centerX, y: layoutConfig.options?.centerY ?? 0 });
                break;
            case 'y':
                positionedNodes = calculateYLayout(initNodes, { offset: layoutConfig.options?.offset, centerY: layoutConfig.options?.centerY, x: layoutConfig.options?.centerX ?? 0 });
                break;
            case 'box':
                positionedNodes = calculateBoxLayout(initNodes, { offsetX: layoutConfig.options?.offsetX, offsetY: layoutConfig.options?.offsetY, centerX: layoutConfig.options?.centerX, centerY: layoutConfig.options?.centerY, compact: layoutConfig.options?.compact });
                break;
            case 'hierarchical':
                positionedNodes = calculateHierarchicalLayout(initNodes, initialEdges, layoutConfig.options);
                break;
            case 'force-directed':
                positionedNodes = calculateForceDirectedLayout(initNodes, initialEdges, layoutConfig.options);
                break;
        }

        // Update node data with new positions
        positionedNodes = positionedNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                position: node.position
            }
        }));
    }

    return {
        nodes: positionedNodes,
        edges: initialEdges
    }
}