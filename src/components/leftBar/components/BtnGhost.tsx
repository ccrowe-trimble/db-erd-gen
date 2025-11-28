import { useEffect, useState } from "react";
import { Column, Table } from "../../../interface/inputData";

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import { useForm } from '@mantine/form';
import { Tooltip, ActionIcon, Modal, Group, Button, TextInput, Grid, Switch, Select, Center } from "@mantine/core";

import { IconSquarePlus, IconEdit, IconTrash, IconDeviceFloppy, IconGripVertical, IconRefresh, IconGhost } from '@tabler/icons-react';
import useTableStore from "../../../store/zustandStore";

import { uuidGen } from "../../../utils/uuidGen";
import { commonSuccessActions, failedDeleteMessage } from "../../../utils/notificationUtils";

import { groupedPostgresTypeArray } from "../../../data/database/postgresType";
import ColumnTypeList from "../../dataSample/ColumnTypeList";
import useSettingStoreStore, { SettingData } from "../../../store/settingStore";


interface FormColumns {
  id: string
  name: string,
  dataType: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  unique?: boolean
  foreignTo?: {
    name: null | string,
    column: null | string
  },
  notNull: boolean
  relationship: null | string
}

function initDataGenerator(mode: "view_all" | "view_linked", editData?: Table): FormObject {

  if (mode === "view_linked" && !!editData) {

    return {
      tableName: editData.name,
      columns: editData.columns.map(v => {
        return {
          ...v,
          id: v.hasOwnProperty("id") ? v.id : uuidGen(),
          isForeignKey: !!v.foreignTo,
          relationship: null,
          unique: v.hasOwnProperty("unique") ? v.unique : false,
          foreignTo: v.hasOwnProperty("foreignTo") ? v.foreignTo : { name: null, column: null },
        }
      }) as FormColumns[]
    }
  }

  return {
    tableName: '',
    columns: [
      {
        id: uuidGen(),
        name: "id",
        dataType: "serial",
        isPrimaryKey: true,
        isForeignKey: false,
        notNull: false,
        unique: false,
        foreignTo: {
          name: null,
          column: null
        },
        relationship: null
      }
    ],
  }
}

interface FormObject {
  tableName: string
  columns: FormColumns[]
}

type TableFormProps = {
  mode: "view_all" | "view_linked"
  allTableData: Table[]
  editData?: Table // Optional if creating table 

  [x: string]: any; // For ActionIcon
};

function BtnGhost({ mode = "view_all", allTableData, editData, ...rest }: TableFormProps) {

  const [opened, setOpened] = useState<boolean>(false);

  const addTableObjStore = useTableStore((state) => state.addTableObj);
  const forceUpdateToggle = useTableStore((state) => state.forceUpdateToggle);
  const updateTableObj = useTableStore((state) => state.updateTableObj);

  const generalSettings = useSettingStoreStore((state) => state.settings);

  const form = useForm({
    initialValues: initDataGenerator(mode, editData),
    validate: {
      tableName: (v) => (v.length <= 1 ? "Table name should be larger than one" : null),
      columns: {
        name: (v) => (v.length === 0 ? 'Invalid names' : null)
      }
    }
  });

  useEffect(() => {
    form.setValues(
      initDataGenerator(mode, editData)
    )
  }, [editData])

  const tablesField = form.values.columns.map((v, index) => (
    <Draggable key={"col_" + v.id} index={index} draggableId={"col_" + v.id}>
      {(provided) => (
        <Grid ref={provided.innerRef} {...provided.draggableProps}>
          <Grid.Col span={{ base: 1, md: 1 }}>
            <Group mt={26}>
              <Center {...provided.dragHandleProps}>
                <IconGripVertical size="1.2rem" />
              </Center>

              <Tooltip label="Delete column">
                <ActionIcon
                  variant="light"

                  color="red"
                  onClick={() => form.removeListItem('columns', index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Grid.Col>



        </Grid>
      )}
    </Draggable>

  ));

  function handleSubmit(values: FormObject) {

    try {

      // Empty table name
      if (values.columns.length === 0) {
        failedDeleteMessage("Table can not be empty.")
        return
      }

      // PK more than one
      if (values.columns.filter(v => v.isPrimaryKey).length >= 2) {
        failedDeleteMessage("More than one PK exist, please remove it.")
        return
      }

      // Duplicated column name
      if (Array.from(new Set(values.columns.map(v => v.name))).length !== values.columns.length) {
        failedDeleteMessage("Duplicated column name")
        return
      }

      const storeObj = {
        name: values.tableName.trim().toLowerCase().split(" ").join("_"),
        columns: values.columns.map(v => {
          let baseObj = {
            id: v.id,
            name: v.name.trim().toLowerCase().split(" ").join("_"),
            dataType: v.dataType,
            unique: v.unique,
            isPrimaryKey: v.isPrimaryKey
          } as Column

          if (v.isForeignKey && !!v.foreignTo) {
            baseObj.foreignTo = {
              name: v.foreignTo.name as string,
              column: v.foreignTo.column as string
            }
          }

          baseObj.notNull = v.notNull

          return baseObj
        })
      } as Table


      setOpened(false);
      commonSuccessActions();

      form.reset()

    } catch (error) {
      console.error(error);
    }

  }

  return (
    <>
      <Modal
        size="95%"
        opened={opened}
        onClose={() => setOpened(false)}
        title="toggle view"
      >
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>

          <TextInput
            withAsterisk
            label="Table name"
            placeholder="some_table_name"

            description="Table Name Can not be change after created"
            {...form.getInputProps('tableName')}
          />

          <Group justify="space-between" mt="lg" mb={12}>
            <Group justify="center">
              <Tooltip label="Reset to changes state">
                <Button
                  onClick={() => form.reset()}
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                >
                  Reset all
                </Button>
              </Tooltip>
            </Group>

            <Button
              variant="light"
              onClick={() =>
                form.insertListItem(
                  'columns',
                  {
                    id: uuidGen(),
                    name: "name",
                    dataType: "varchar",
                    isPrimaryKey: false,
                    isForeignKey: false,
                    notNull: generalSettings.defaultToNotNull ?? false,
                    unique: false,
                    foreignTo: {
                      name: null,
                      column: null
                    },
                    relationship: null
                  }
                )
              }>
              + Add column
            </Button>
          </Group>


          <DragDropContext
            onDragEnd={({ destination, source }) =>
              destination?.index !== undefined && form.reorderListItem('columns', { from: source.index, to: destination.index })
            }
          >
            <Droppable droppableId="dnd-list" direction="vertical">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {tablesField}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>


          <Group justify="flex-end" mt="md">
            <Button type="submit" leftSection={<IconDeviceFloppy size={18} />} variant="light">
              Save Changes
            </Button>
          </Group>

        </form>
      </Modal>

      <Group justify="center">
        <Tooltip label={"Toggle View"}>
          <ActionIcon variant="light" onClick={() => setOpened(true)} size="md" {...rest}>
            <IconGhost size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </>
  );
}

export default BtnGhost;
