import React, { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StarFilled,
} from '@ant-design/icons';
import {
  ProjectProposalStatus,
  ProposalType,
  type ProjectProposal,
} from '../../../types';
import { useProjectProposals } from '../hooks/useProjectProposals';
import { normalizeProjectServiceBillingPhases } from '../utils/billingPhases';

const { Title, Text } = Typography;

const proposalStatusOptions = [
  { label: 'Borrador', value: ProjectProposalStatus.DRAFT },
  { label: 'Enviada', value: ProjectProposalStatus.SENT },
  { label: 'Aprobada', value: ProjectProposalStatus.APPROVED },
  { label: 'Rechazada', value: ProjectProposalStatus.REJECTED },
  { label: 'Archivada', value: ProjectProposalStatus.ARCHIVED },
];

const proposalTypeOptions = [
  { label: 'Por fases', value: ProposalType.PHASES },
  { label: 'Por servicios', value: ProposalType.SERVICES },
  { label: 'Mixta', value: ProposalType.MIXED },
];

function getStatusTag(status: ProjectProposalStatus) {
  const config: Record<ProjectProposalStatus, { color: string; label: string }> = {
    [ProjectProposalStatus.DRAFT]: { color: 'default', label: 'Borrador' },
    [ProjectProposalStatus.SENT]: { color: 'blue', label: 'Enviada' },
    [ProjectProposalStatus.APPROVED]: { color: 'green', label: 'Aprobada' },
    [ProjectProposalStatus.REJECTED]: { color: 'red', label: 'Rechazada' },
    [ProjectProposalStatus.ARCHIVED]: { color: 'orange', label: 'Archivada' },
  };

  return <Tag color={config[status].color}>{config[status].label}</Tag>;
}

function buildNextProposalName(proposals: ProjectProposal[]) {
  const highestSequence = proposals.reduce((maxValue, proposal) => {
    const nameMatch = String(proposal.name || '').match(/propuesta\s*(\d+)/i);
    const proposalNumberMatch = String(proposal.proposalNumber || '').match(/(\d+)/);
    const candidate = Number(nameMatch?.[1] || proposalNumberMatch?.[1] || 0);

    return Number.isFinite(candidate) && candidate > maxValue ? candidate : maxValue;
  }, 0);

  return `Propuesta ${String(highestSequence + 1).padStart(3, '0')}`;
}

function buildNextProposalNumber(proposals: ProjectProposal[]) {
  const highestSequence = proposals.reduce((maxValue, proposal) => {
    const proposalNumberMatch = String(proposal.proposalNumber || '').match(/(\d+)/);
    const nameMatch = String(proposal.name || '').match(/propuesta\s*(\d+)/i);
    const candidate = Number(proposalNumberMatch?.[1] || nameMatch?.[1] || 0);

    return Number.isFinite(candidate) && candidate > maxValue ? candidate : maxValue;
  }, 0);

  return `PROP-${String(highestSequence + 1).padStart(3, '0')}`;
}

type Props = {
  projectId: string;
  isViewer: boolean;
};

export function ProjectProposalManager({ projectId, isViewer }: Props) {
  const { data: proposals = [], isLoading, save, delete: deleteProposal, isSaving } =
    useProjectProposals(projectId);
  const [form] = Form.useForm();
  const [editingProposal, setEditingProposal] = useState<ProjectProposal | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const primaryProposal = proposals.find(proposal => proposal.isPrimary) || proposals[0] || null;

  const closeModal = () => {
    setEditingProposal(null);
    setIsModalOpen(false);
    form.resetFields();
  };

  const openCreateModal = () => {
    setEditingProposal(null);
    form.setFieldsValue({
      name: buildNextProposalName(proposals),
      status: ProjectProposalStatus.DRAFT,
      isPrimary: proposals.length === 0,
      proposalType: ProposalType.PHASES,
      currency: 'USD',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (proposal: ProjectProposal) => {
    setEditingProposal(proposal);
    form.setFieldsValue({
      ...proposal,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await save({
        documentId: editingProposal?.documentId,
        id: editingProposal?.id || `proposal-${Date.now()}`,
        projectId,
        name: String(values.name || '').trim(),
        status: values.status,
        isPrimary: values.isPrimary === true,
        serviceBillingPhases: normalizeProjectServiceBillingPhases(
          editingProposal?.serviceBillingPhases,
        ),
        proposalType: values.proposalType || undefined,
        proposalSentAt: values.proposalSentAt || '',
        projectStartAt: values.projectStartAt || '',
        contractNumber: String(values.contractNumber || '').trim(),
        proposalNumber:
          String(editingProposal?.proposalNumber || '').trim() || buildNextProposalNumber(proposals),
        currency: String(values.currency || '').trim() || 'USD',
        paymentTermsDays:
          typeof values.paymentTermsDays === 'number' && Number.isFinite(values.paymentTermsDays)
            ? values.paymentTermsDays
            : undefined,
        proposalOwner: String(values.proposalOwner || '').trim(),
      });
      message.success(editingProposal ? 'Propuesta actualizada' : 'Propuesta creada');
      closeModal();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      console.error('Proposal save failed:', error);
      message.error('No se pudo guardar la propuesta.');
    }
  };

  const handleDelete = async (proposal: ProjectProposal) => {
    if (!proposal.documentId) return;

    try {
      await deleteProposal(proposal.documentId);
      message.success('Propuesta eliminada');
    } catch (error) {
      console.error('Proposal delete failed:', error);
      message.error('No se pudo eliminar la propuesta.');
    }
  };

  const handleSetPrimary = async (proposal: ProjectProposal) => {
    try {
      await save({
        ...proposal,
        isPrimary: true,
        serviceBillingPhases: normalizeProjectServiceBillingPhases(proposal.serviceBillingPhases),
      });
      message.success('Propuesta principal actualizada');
    } catch (error) {
      console.error('Set primary proposal failed:', error);
      message.error('No se pudo marcar la propuesta como principal.');
    }
  };

  const columns = [
    {
      title: 'Propuesta',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: ProjectProposal) => (
        <div>
          <Space size={8}>
            <Text strong>{record.name}</Text>
            {record.isPrimary ? <Tag color="gold">Principal</Tag> : null}
          </Space>
          <div className="mt-1">
            <Text type="secondary">
              {record.proposalNumber ? `No. ${record.proposalNumber}` : 'Sin número de propuesta'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (value: ProjectProposalStatus) => getStatusTag(value),
    },
    {
      title: 'Responsable',
      dataIndex: 'proposalOwner',
      key: 'proposalOwner',
      render: (value?: string) => value || 'No definido',
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: ProjectProposal) => (
        <Space>
          {!record.isPrimary && !isViewer ? (
            <Button type="link" onClick={() => void handleSetPrimary(record)}>
              Marcar principal
            </Button>
          ) : null}
          {!isViewer ? (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
              <Popconfirm title="Eliminar propuesta?" onConfirm={() => void handleDelete(record)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="mt-6 space-y-6">
      <Card className="rounded-2xl border-gray-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Title level={4}>Propuestas del proyecto</Title>
            <Text type="secondary">
              Administra varias propuestas comerciales por proyecto sin mezclar el alcance operativo.
            </Text>
          </div>
          {!isViewer ? (
            <Space wrap>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                className="bg-blue-600"
              >
                Nueva propuesta
              </Button>
            </Space>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total propuestas
            </Text>
            <Title level={3} className="!mb-0 !mt-2">
              {proposals.length}
            </Title>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Enviadas
            </Text>
            <Title level={3} className="!mb-0 !mt-2">
              {proposals.filter(proposal => proposal.status === ProjectProposalStatus.SENT).length}
            </Title>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Aprobadas
            </Text>
            <Title level={3} className="!mb-0 !mt-2">
              {proposals.filter(proposal => proposal.status === ProjectProposalStatus.APPROVED).length}
            </Title>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Propuesta principal
            </Text>
            <Text className="mt-2 block text-sm font-medium text-slate-700">
              {primaryProposal?.name || 'No definida'}
            </Text>
          </div>
        </div>

        {primaryProposal ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4">
            <Space size={10}>
              <StarFilled className="text-amber-500" />
              <Text strong>{primaryProposal.name}</Text>
              {getStatusTag(primaryProposal.status)}
            </Space>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-3">
              <span>{primaryProposal.proposalNumber || 'Sin número de propuesta'}</span>
              <span>{primaryProposal.proposalOwner || 'Sin responsable asignado'}</span>
              <span>{primaryProposal.currency || 'USD'}</span>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="rounded-2xl border-gray-100">
        {proposals.length === 0 && !isLoading ? (
          <Empty description="Todavía no hay propuestas registradas para este proyecto." />
        ) : (
          <Table
            columns={columns}
            dataSource={proposals}
            rowKey={record => record.documentId || record.id}
            loading={isLoading}
            pagination={false}
            className="overflow-hidden rounded-2xl border border-slate-100"
          />
        )}
      </Card>

      <Modal
        title={editingProposal ? 'Editar propuesta' : 'Nueva propuesta'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => void handleSave()}
        okText={editingProposal ? 'Guardar cambios' : 'Crear propuesta'}
        cancelText="Cancelar"
        width={760}
        confirmLoading={isSaving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                name="name"
                label="Nombre de la propuesta"
                rules={[{ required: true, message: 'Ingresa un nombre para la propuesta.' }]}
              >
                <Input placeholder="Ej: Propuesta QA Junio 2026" />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item
                name="status"
                label="Estado"
                rules={[{ required: true, message: 'Campo requerido' }]}
              >
                <Select options={proposalStatusOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="isPrimary" label="Principal" valuePropName="checked">
                <Switch checkedChildren="Si" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="proposalType" label="Tipo de propuesta">
                <Select options={proposalTypeOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="proposalSentAt" label="Fecha de envío">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="projectStartAt" label="Fecha de inicio proyectada">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="contractNumber" label="Número de contrato">
                <Input placeholder="Ej: CTR-8892" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="proposalOwner" label="Responsable">
                <Input placeholder="Ej: Kimberly Conde" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="currency" label="Moneda">
                <Input placeholder="USD" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="paymentTermsDays" label="Términos de pago (días)">
                <InputNumber className="!w-full" min={0} controls={false} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
