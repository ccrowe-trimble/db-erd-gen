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


  return (
    <>

      <Group justify="center">
        <Tooltip label={"Only Show Connected"}>
          <ActionIcon variant="light" onClick={() => { }} size="md" {...rest}>
            <IconGhost size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </>
  );
}

export default BtnGhost;
