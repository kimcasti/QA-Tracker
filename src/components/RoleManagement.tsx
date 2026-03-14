import React, { useState } from 'react';
import { 
  Table, 
  Button, 
  Card, 
  Typography, 
  Space, 
  Modal, 
  Form, 
  Input, 
  message,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useRoles } from '../hooks';
import { Role } from '../types';

const { Title, Text, Paragraph } = Typography;

interface RoleManagementProps {
  projectId: string;
}

export default function RoleManagement({ projectId }: RoleManagementProps) {
  const { data: roles = [], save: saveRole, delete: deleteRole } = useRoles(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const role: Role = {
        ...editingRole,
        ...values,
        id: editingRole ? editingRole.id : `ROLE-${Date.now()}`,
        projectId,
      };
      
      saveRole(role);
      message.success(`Rol ${editingRole ? 'actualizado' : 'creado'} exitosamente`);
      setIsModalOpen(false);
      setEditingRole(null);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const columns = [
    {
      title: 'Nombre del Rol',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <UserOutlined className="text-blue-500" />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Descripción',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Text type="secondary">{text || 'Sin descripción'}</Text>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_: any, record: Role) => (
        <Space>
          <Button 
            type="text" 
            icon={<EditOutlined className="text-blue-500" />} 
            onClick={() => {
              setEditingRole(record);
              form.setFieldsValue(record);
              setIsModalOpen(true);
            }}
          />
          <Popconfirm
            title="¿Eliminar este rol?"
            onConfirm={() => {
              deleteRole(record.id);
              message.success('Rol eliminado');
            }}
            okText="Sí"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title level={3} className="!mb-1">Gestión de Roles</Title>
          <Paragraph type="secondary">Define los roles de usuario que interactúan con las funcionalidades del sistema.</Paragraph>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => {
            setEditingRole(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
          className="h-10 rounded-lg"
        >
          Nuevo Rol
        </Button>
      </div>

      <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table 
          columns={columns} 
          dataSource={roles} 
          rowKey="id"
          pagination={false}
          className="executive-table"
        />
      </Card>

      <Modal
        title={editingRole ? 'Editar Rol' : 'Nuevo Rol'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRole(null);
          form.resetFields();
        }}
        onOk={handleSave}
        okText="Guardar"
        cancelText="Cancelar"
        centered
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Nombre del Rol"
            rules={[{ required: true, message: 'Ingresa el nombre del rol' }]}
          >
            <Input placeholder="Ej: Administrador, Cliente, Auditor" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Descripción"
          >
            <Input.TextArea rows={3} placeholder="Describe las responsabilidades de este rol..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
