import React, { useState } from 'react';
import {
  Table,
  Button,
  Card,
  Typography,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { Sprint } from '../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface SprintManagementProps {
  projectId: string;
}

export default function SprintManagement({ projectId }: SprintManagementProps) {
  const { data: sprints = [], save: saveSprint } = useSprints(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [form] = Form.useForm();

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const [startDate, endDate] = values.dates;

      const sprint: Sprint = {
        ...editingSprint,
        ...values,
        id: editingSprint ? editingSprint.id : `SPRINT-${Date.now()}`,
        projectId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      saveSprint(sprint);
      message.success(`Sprint ${editingSprint ? 'actualizado' : 'creado'} exitosamente`);
      setIsModalOpen(false);
      setEditingSprint(null);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const getStatusTag = (status: Sprint['status']) => {
    switch (status) {
      case 'En Progreso':
        return (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Activo
          </Tag>
        );
      case 'Planeado':
        return (
          <Tag color="blue" icon={<ClockCircleOutlined />}>
            Planeado
          </Tag>
        );
      case 'Completado':
        return (
          <Tag color="default" icon={<StopOutlined />}>
            Cerrado
          </Tag>
        );
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Periodo',
      key: 'period',
      render: (_: any, record: Sprint) => (
        <Space>
          <CalendarOutlined className="text-slate-400" />
          <Text className="text-xs">
            {dayjs(record.startDate).format('DD/MM/YYYY')} -{' '}
            {dayjs(record.endDate).format('DD/MM/YYYY')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: Sprint['status']) => getStatusTag(status),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 72,
      render: (_: any, record: Sprint) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined className="text-blue-500" />}
            onClick={() => {
              setEditingSprint(record);
              form.setFieldsValue({
                ...record,
                dates: [dayjs(record.startDate), dayjs(record.endDate)],
              });
              setIsModalOpen(true);
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title level={3} className="!mb-1">
            Gestión de Sprints
          </Title>
          <Paragraph type="secondary">
            Administra los periodos de trabajo y ciclos de desarrollo del proyecto.
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingSprint(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
          className="h-10 rounded-lg"
        >
          Nuevo Sprint
        </Button>
      </div>

      <Card
        className="rounded-2xl border-slate-100 shadow-sm overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={sprints}
          rowKey="id"
          pagination={false}
          className="executive-table"
        />
      </Card>

      <Modal
        title={editingSprint ? 'Editar Sprint' : 'Nuevo Sprint'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingSprint(null);
          form.resetFields();
        }}
        onOk={handleSave}
        okText="Guardar"
        cancelText="Cancelar"
        centered
      >
        <Form form={form} layout="vertical" className="mt-4" initialValues={{ status: 'Planeado' }}>
          <Form.Item
            name="name"
            label="Nombre del Sprint"
            rules={[{ required: true, message: 'Ingresa el nombre del sprint' }]}
          >
            <Input placeholder="Ej: Sprint 1 - Core Features" />
          </Form.Item>

          <Form.Item
            name="dates"
            label="Periodo (Inicio - Fin)"
            rules={[{ required: true, message: 'Selecciona las fechas' }]}
          >
            <RangePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="status" label="Estado Inicial" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="Planeado">Planeado</Select.Option>
              <Select.Option value="En Progreso">Activo</Select.Option>
              <Select.Option value="Completado">Cerrado</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="goal" label="Objetivo del Sprint">
            <Input.TextArea rows={3} placeholder="¿Qué se espera lograr en este ciclo?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
