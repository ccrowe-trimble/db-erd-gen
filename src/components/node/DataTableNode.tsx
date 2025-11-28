import { Handle, Position, NodeProps } from 'reactflow';
import { Card, Text, Space, Badge, Grid, Box, Tooltip } from '@mantine/core';
import { Table } from '../../interface/inputData';
import TableForm from '../leftBar/components/TableForm';
import useTableStore from '../../store/zustandStore';
import useUISettingsStore from '../../store/uiSettingsStore';
import AnotherTableForm from '../leftBar/components/AnotherTableForm';

type DataTableNodeProps = NodeProps<Table>;

function DataTableNode({ data }: DataTableNodeProps) {

  const tableArray = useTableStore((state) => state.tableArray);
  const showDataTypes = useUISettingsStore((s: any) => s.showDataTypes ?? true);
  const tableBackgroundColor = useUISettingsStore((s: any) => s.tableBackgroundColor ?? '#ffffff');

  // prefer per-node data.__background (set when nodes are created), otherwise fallback to global UI color
  const bg = (data as any).__background || tableBackgroundColor;

  return (
    <Card
      shadow="sm"
      radius="md"
      style={{ background: bg, height: `${47 + data.columns.length * 28}px`, padding: "10px", fontSize: "2px", width: "320px" }}
    >
      <div>

        <Card.Section style={{ padding: 8 }}>
          <div style={{ position: 'relative', width: '100%', padding: '5px', boxSizing: 'border-box' }}>
            <Badge
              size="lg"
              tt="none"
              radius="md"
              style={{
                pointerEvents: 'none',
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxSizing: 'border-box'
              }}
              leftSection={<div>{data.name}
                {data && !(data as any).isIsolated && (
                  <Badge size="xs" color="gray" variant="light" style={{ pointerEvents: 'none' }}>isolated</Badge>
                )}
              </div>}
              rightSection={
                <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'row' }}>
                  <TableForm
                    mode={'edit'}
                    editData={data}
                    allTableData={tableArray}

                    size={14}
                    color={"white"}
                  />

                  <AnotherTableForm
                    mode={'edit'}
                    editData={data}
                    allTableData={tableArray}

                    size={14}
                    color={"white"}
                  />
                </div>
              }
            />


          </div>
        </Card.Section>

        <Space h="xs" />

        {/* prevent drag start when interacting with the rows — only the header (Badge) will start node drag */}
        <div onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>

          {data.columns.map((v, ind) => {

            // Align row handle Y with the node height calculation used on the Card
            // Card height is calculated as: 47 + data.columns.length * 28
            // so place handles at: base 47px + index * 28px
            const nodeDistance = 47 + ind * 28;

            const leftNodeName = `${data.name}_${v.name}_left`
            const rightNodeName = `${data.name}_${v.name}_right`

            return (
              <Box key={`${data.name}_${v.name}_rows`}>

                <Grid >
                  <Grid.Col span={2}>
                    <Text fz={8}>
                      {
                        v.isPrimaryKey
                          ? "PK"
                          : !!v.foreignTo
                            ? "FK"
                            : ""
                      }
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={showDataTypes ? 6 : 10}>
                    <Tooltip label={v.name}>
                      <Text fz={12}>
                        {v.name && v.name.length >= 20 ? v.name.slice(0, 20) + "..." : v.name}
                      </Text>
                    </Tooltip>
                  </Grid.Col>

                  {showDataTypes && (
                    <Grid.Col span={4}>
                      <Tooltip label={v.dataType}>
                        <Text fz={12}>
                          {v.dataType}
                        </Text>
                      </Tooltip>
                    </Grid.Col>
                  )}
                </Grid>

                <Handle
                  type={!!v.foreignTo ? "target" : "source"}
                  position={Position.Left} id={leftNodeName}
                  style={{ top: nodeDistance, width: "0px", minWidth: "0px" }}
                />
                <Handle
                  type={!!v.foreignTo ? "target" : "source"}
                  position={Position.Right} id={rightNodeName}
                  style={{ top: nodeDistance, width: "0px", minWidth: "0px" }}
                />
              </Box>
            )
          }
          )}

        </div>

      </div>
    </Card>
  );
}

export default DataTableNode
