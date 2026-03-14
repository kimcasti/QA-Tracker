import React, { useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Space,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  CalendarOutlined,
  TeamOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useModules } from '../modules/settings/hooks/useModules';
import { useRoles } from '../modules/settings/hooks/useRoles';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { Sprint, Role, Module } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface SettingsProps {
  projectId: string;
}

const Settings: React.FC<SettingsProps> = ({ projectId }) => {
  const { data: sprints = [], save: saveSprint, delete: deleteSprint } = useSprints(projectId);
  const { data: roles = [], save: saveRole, delete: deleteRole } = useRoles(projectId);
  const { data: modules = [], save: saveModule, delete: deleteModule } = useModules(projectId);

  const [activeTab, setActiveTab] = useState('sprints');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  const handleOpenModal = (item: any = null) => {
    setEditingItem(item);
    if (item) {
      if (activeTab === 'sprints') {
        form.setFieldsValue({
          ...item,
          period: [dayjs(item.startDate), dayjs(item.endDate)],
        });
      } else {
        form.setFieldsValue(item);
      }
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSave = (values: any) => {
    const id =
      editingItem?.id ||
      `${activeTab === 'sprints' ? 'S' : activeTab === 'roles' ? 'R' : 'M'}${Date.now()}`;

    let payload: any = {
      id,
      projectId,
      ...values,
    };

    if (activeTab === 'sprints') {
      payload.startDate = values.period[0].format('YYYY-MM-DD');
      payload.endDate = values.period[1].format('YYYY-MM-DD');
      delete payload.period;
    }

    console.log(`Payload - Save ${activeTab}:`, payload);

    if (activeTab === 'sprints') saveSprint(payload);
    else if (activeTab === 'roles') saveRole(payload);
    else if (activeTab === 'modules') saveModule(payload);

    message.success(
      `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1, -1)} guardado con éxito`,
    );
    setIsModalVisible(false);
  };

  const handleDelete = (id: string) => {
    if (activeTab === 'sprints') deleteSprint(id);
    else if (activeTab === 'roles') deleteRole(id);
    else if (activeTab === 'modules') deleteModule(id);
    message.success('Eliminado con éxito');
  };

  const sprintColumns = [
    {
      title: 'NOMBRE',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'PERIODO',
      key: 'period',
      render: (_: any, record: Sprint) => (
        <Text type="secondary">
          {dayjs(record.startDate).format('DD/MM/YYYY')} -{' '}
          {dayjs(record.endDate).format('DD/MM/YYYY')}
        </Text>
      ),
    },
    { title: 'ESTADO', dataIndex: 'status', key: 'status' },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: any, record: Sprint) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Popconfirm title="¿Eliminar sprint?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const roleColumns = [
    {
      title: 'NOMBRE DEL ROL',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    { title: 'DESCRIPCIÓN', dataIndex: 'description', key: 'description' },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: any, record: Role) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Popconfirm title="¿Eliminar rol?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const moduleColumns = [
    {
      title: 'NOMBRE DEL MÓDULO',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    { title: 'DESCRIPCIÓN', dataIndex: 'description', key: 'description' },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: any, record: Module) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Popconfirm title="¿Eliminar módulo?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'sprints',
      label: (
        <span>
          <CalendarOutlined />
          Sprints
        </span>
      ),
      children: (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Title level={4}>Gestión de Sprints</Title>
              <Text type="secondary">
                Administra los periodos de trabajo y ciclos de desarrollo del proyecto.
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
              className="bg-blue-600"
            >
              Nuevo Sprint
            </Button>
          </div>
          <Table
            columns={sprintColumns}
            dataSource={sprints}
            rowKey="id"
            pagination={false}
            className="border border-gray-100 rounded-lg overflow-hidden"
          />
        </div>
      ),
    },
    {
      key: 'roles',
      label: (
        <span>
          <TeamOutlined />
          Roles
        </span>
      ),
      children: (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Title level={4}>Gestión de Roles</Title>
              <Text type="secondary">
                Define los roles de usuario que interactúan con las funcionalidades del sistema.
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
              className="bg-blue-600"
            >
              Nuevo Rol
            </Button>
          </div>
          <Table
            columns={roleColumns}
            dataSource={roles}
            rowKey="id"
            pagination={false}
            className="border border-gray-100 rounded-lg overflow-hidden"
          />
        </div>
      ),
    },
    {
      key: 'modules',
      label: (
        <span>
          <AppstoreOutlined />
          Módulos
        </span>
      ),
      children: (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <Title level={4}>Gestión de Módulos</Title>
              <Text type="secondary">
                Organiza las funcionalidades del sistema por módulos lógicos.
              </Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal()}
              className="bg-blue-600"
            >
              Nuevo Módulo
            </Button>
          </div>
          <Table
            columns={moduleColumns}
            dataSource={modules}
            rowKey="id"
            pagination={false}
            className="border border-gray-100 rounded-lg overflow-hidden"
          />
        </div>
      ),
    },
  ];

  return (
    <Card className="rounded-2xl border-slate-100 shadow-sm min-h-[600px]">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="settings-tabs"
      />

      <Modal
        title={editingItem ? `Editar ${activeTab.slice(0, -1)}` : `Nuevo ${activeTab.slice(0, -1)}`}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          {activeTab === 'sprints' && (
            <>
              <Form.Item
                name="name"
                label="Nombre del Sprint"
                rules={[{ required: true, message: 'Campo requerido' }]}
              >
                <Input placeholder="Ej: Sprint 1 - Core Features" />
              </Form.Item>
              <Form.Item
                name="period"
                label="Periodo (Inicio - Fin)"
                rules={[{ required: true, message: 'Campo requerido' }]}
              >
                <RangePicker className="w-full" />
              </Form.Item>
              <Form.Item
                name="status"
                label="Estado Inicial"
                rules={[{ required: true, message: 'Campo requerido' }]}
                initialValue="Planeado"
              >
                <Select>
                  <Option value="Planeado">Planeado</Option>
                  <Option value="En Progreso">En Progreso</Option>
                  <Option value="Completado">Completado</Option>
                </Select>
              </Form.Item>
              <Form.Item name="objective" label="Objetivo del Sprint">
                <Input.TextArea rows={4} placeholder="¿Qué se espera lograr en este ciclo?" />
              </Form.Item>
            </>
          )}

          {activeTab === 'roles' && (
            <>
              <Form.Item
                name="name"
                label="Nombre del Rol"
                rules={[{ required: true, message: 'Campo requerido' }]}
              >
                <Input placeholder="Ej: Administrador, Cliente, Auditor" />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea
                  rows={4}
                  placeholder="Describe las responsabilidades de este rol..."
                />
              </Form.Item>
            </>
          )}

          {activeTab === 'modules' && (
            <>
              <Form.Item
                name="name"
                label="Nombre del Módulo"
                rules={[{ required: true, message: 'Campo requerido' }]}
              >
                <Input placeholder="Ej: Autenticación, Pagos, Usuarios" />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea rows={4} placeholder="Describe el alcance de este módulo..." />
              </Form.Item>
            </>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setIsModalVisible(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" className="bg-blue-600">
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
};

export default Settings;
