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
            case 'circular':
                positionedNodes = calculateCircularLayout(initNodes, layoutConfig.options);
                break;
            case 'x':
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