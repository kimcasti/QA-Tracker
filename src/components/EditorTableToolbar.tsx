import { Button, Dropdown, Modal, type MenuProps } from 'antd';
import {
  ArrowDownOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined,
  DeleteOutlined, DownOutlined, PlusOutlined, TableOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';

const tableCommands = [
  'addRowBefore', 'addRowAfter', 'deleteRow',
  'addColumnBefore', 'addColumnAfter', 'deleteColumn', 'deleteTable',
] as const;

export default function EditorTableToolbar({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState('3');
  const [cols, setCols] = useState('3');
  const inTable = useEditorState({ editor, selector: ({ editor: current }) => current?.isActive('table') ?? false });
  const valid = [rows, cols].every(value => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 20);
  const itemStyle = { minHeight: 44 };
  const items: MenuProps['items'] = [
    { key: 'insert', label: 'Insertar tabla', icon: <PlusOutlined aria-hidden="true" />, style: itemStyle },
    ...(inTable ? [
      { type: 'divider' as const },
      { type: 'group' as const, label: 'Filas', children: [
        { key: 'addRowBefore', label: 'Añadir fila encima', icon: <ArrowUpOutlined aria-hidden="true" />, style: itemStyle },
        { key: 'addRowAfter', label: 'Añadir fila debajo', icon: <ArrowDownOutlined aria-hidden="true" />, style: itemStyle },
        { key: 'deleteRow', label: 'Eliminar fila', icon: <DeleteOutlined aria-hidden="true" />, style: itemStyle },
      ] },
      { type: 'group' as const, label: 'Columnas', children: [
        { key: 'addColumnBefore', label: 'Añadir columna a la izquierda', icon: <ArrowLeftOutlined aria-hidden="true" />, style: itemStyle },
        { key: 'addColumnAfter', label: 'Añadir columna a la derecha', icon: <ArrowRightOutlined aria-hidden="true" />, style: itemStyle },
        { key: 'deleteColumn', label: 'Eliminar columna', icon: <DeleteOutlined aria-hidden="true" />, style: itemStyle },
      ] },
      { type: 'divider' as const },
      { key: 'deleteTable', label: 'Eliminar tabla', icon: <DeleteOutlined aria-hidden="true" />, danger: true, style: itemStyle },
    ] : []),
  ];

  return (
    <>
      <Dropdown trigger={['click']} placement="bottomLeft" disabled={disabled || !editor}
        menu={{ items, onClick: ({ key }) => {
          if (disabled || !editor) return;
          if (key === 'insert') { setOpen(true); return; }
          const command = tableCommands.find(value => value === key);
          if (command && editor.isActive('table')) editor.chain().focus()[command]().run();
        } }}>
        <Button type="text" aria-label="Opciones de tabla" icon={<TableOutlined aria-hidden="true" />}
          disabled={disabled || !editor} onMouseDown={event => event.preventDefault()}>
          Tabla <DownOutlined aria-hidden="true" style={{ fontSize: 10, opacity: 0.6 }} />
        </Button>
      </Dropdown>
      <Modal title="Insertar tabla" open={open && !disabled} onCancel={() => setOpen(false)} okText="Crear tabla" cancelText="Cancelar"
        okButtonProps={{ disabled: disabled || !editor || !valid }}
        onOk={() => {
          if (disabled || !editor || !valid) return;
          editor.chain().focus().insertTable({ rows: Number(rows), cols: Number(cols), withHeaderRow: false }).run();
          setOpen(false);
        }}>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">Filas
            <input className="qa-table-dimension-input" aria-label="Filas" type="number" min={1} max={20} step={1} value={rows} onChange={event => setRows(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">Columnas
            <input className="qa-table-dimension-input" aria-label="Columnas" type="number" min={1} max={20} step={1} value={cols} onChange={event => setCols(event.target.value)} />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-500">Entre 1 y 20 filas y columnas. Puedes modificarlas después.</p>
      </Modal>
    </>
  );
}
