import React, { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { deliveryActivityCategoryOptions } from '../modules/delivery-activity-templates/constants/categories';
import { useDeliveryActivityTemplates } from '../modules/delivery-activity-templates/hooks/useDeliveryActivityTemplates';
import { useDeliveryUnits } from '../modules/delivery-units/hooks/useDeliveryUnits';
import { ProjectProposalManager } from '../modules/project-proposals/components/ProjectProposalManager';
import { useProjectProposals } from '../modules/project-proposals/hooks/useProjectProposals';
import { useModules } from '../modules/settings/hooks/useModules';
import { useRoles } from '../modules/settings/hooks/useRoles';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCaseTemplates } from '../modules/test-case-templates/hooks/useTestCaseTemplates';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  DeliveryUnitStatus,
  DeliveryUnitType,
  Module,
  Priority,
  Role,
  Sprint,
  TestCaseTemplate,
  TestType,
  type DeliveryActivityTemplate,
  type DeliveryUnit,
} from '../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface SettingsProps {
  projectId: string;
}

type SettingsTabKey = 'sprints' | 'roles' | 'modules' | 'templates' | 'proposal';
type SettingsItem = Sprint | Role | Module | TestCaseTemplate | null;

const templateTypeOptions = Object.values(TestType);
const templatePriorityOptions = Object.values(Priority);
const deliveryUnitTypeOptions = Object.values(DeliveryUnitType);
const deliveryUnitStatusOptions = Object.values(DeliveryUnitStatus);

const tabLabelMap: Record<SettingsTabKey, string> = {
  sprints: 'Sprint',
  roles: 'Rol',
  modules: 'Módulo',
  templates: 'Plantilla',
  proposal: 'Propuesta',
};

function formatDeliveryUnitType(type: DeliveryUnitType) {
  const labels: Record<DeliveryUnitType, string> = {
    [DeliveryUnitType.PHASE]: 'Fase',
    [DeliveryUnitType.SERVICE]: 'Servicio',
    [DeliveryUnitType.MAINTENANCE]: 'Mantenimiento',
    [DeliveryUnitType.SUPPORT]: 'Soporte',
    [DeliveryUnitType.MILESTONE]: 'Hito',
    [DeliveryUnitType.OTHER]: 'Otro',
  };

  return labels[type] || 'Otro';
}

function formatDeliveryUnitStatus(status: DeliveryUnitStatus) {
  const labels: Record<DeliveryUnitStatus, string> = {
    [DeliveryUnitStatus.PLANNED]: 'Planeada',
    [DeliveryUnitStatus.IN_PROGRESS]: 'En progreso',
    [DeliveryUnitStatus.COMPLETED]: 'Completada',
    [DeliveryUnitStatus.PAUSED]: 'Pausada',
    [DeliveryUnitStatus.CANCELLED]: 'Cancelada',
  };

  return labels[status] || 'Planeada';
}

function renderDeliveryUnitStatusTag(status: DeliveryUnitStatus) {
  const colorMap: Record<DeliveryUnitStatus, string> = {
    [DeliveryUnitStatus.PLANNED]: 'default',
    [DeliveryUnitStatus.IN_PROGRESS]: 'blue',
    [DeliveryUnitStatus.COMPLETED]: 'green',
    [DeliveryUnitStatus.PAUSED]: 'orange',
    [DeliveryUnitStatus.CANCELLED]: 'red',
  };

  return (
    <Tag color={colorMap[status]} className="rounded-full border-none px-3 py-0.5 font-medium">
      {formatDeliveryUnitStatus(status)}
    </Tag>
  );
}

const Settings: React.FC<SettingsProps> = ({ projectId }) => {
  const { isViewer } = useWorkspaceAccess();
  const { data: sprints = [], save: saveSprint, delete: deleteSprint } = useSprints(projectId);
  const { data: roles = [], save: saveRole, delete: deleteRole } = useRoles(projectId);
  const { data: modules = [], save: saveModule, delete: deleteModule } = useModules(projectId);
  const {
    data: templates = [],
    save: saveTemplate,
    delete: deleteTemplate,
    isLoading: isLoadingTemplates,
    error: templatesError,
  } = useTestCaseTemplates(projectId);
  const {
    data: deliveryUnits = [],
    save: saveDeliveryUnit,
    delete: deleteDeliveryUnit,
    isSaving: isSavingDeliveryUnit,
  } = useDeliveryUnits(projectId);
  const {
    data: deliveryActivityTemplates = [],
    save: saveDeliveryActivityTemplate,
    delete: deleteDeliveryActivityTemplate,
    isSaving: isSavingDeliveryActivityTemplate,
  } = useDeliveryActivityTemplates(projectId);
  const { data: projectProposals = [] } = useProjectProposals(projectId);

  const [activeTab, setActiveTab] = useState<SettingsTabKey>('sprints');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDeliveryUnitModalVisible, setIsDeliveryUnitModalVisible] = useState(false);
  const [isDeliveryActivityModalVisible, setIsDeliveryActivityModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingsItem>(null);
  const [editingDeliveryUnit, setEditingDeliveryUnit] = useState<DeliveryUnit | null>(null);
  const [editingDeliveryActivity, setEditingDeliveryActivity] =
    useState<DeliveryActivityTemplate | null>(null);
  const [deliveryActivitySearch, setDeliveryActivitySearch] = useState('');
  const [deliveryActivityCategoryFilter, setDeliveryActivityCategoryFilter] = useState<string>();
  const [form] = Form.useForm();
  const [deliveryUnitForm] = Form.useForm();
  const [deliveryActivityForm] = Form.useForm();

  const closeModal = () => {
    setEditingItem(null);
    setIsModalVisible(false);
    form.resetFields();
  };

  const closeDeliveryUnitModal = () => {
    setEditingDeliveryUnit(null);
    setIsDeliveryUnitModalVisible(false);
    deliveryUnitForm.resetFields();
  };

  const closeDeliveryActivityModal = () => {
    setEditingDeliveryActivity(null);
    setIsDeliveryActivityModalVisible(false);
    deliveryActivityForm.resetFields();
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as SettingsTabKey);
    if (isModalVisible) closeModal();
    if (isDeliveryUnitModalVisible) closeDeliveryUnitModal();
    if (isDeliveryActivityModalVisible) closeDeliveryActivityModal();
  };

  const handleOpenModal = (item: SettingsItem = null) => {
    setEditingItem(item);

    if (item) {
      if (activeTab === 'sprints') {
        const sprint = item as Sprint;
        form.setFieldsValue({
          ...sprint,
          period: [dayjs(sprint.startDate), dayjs(sprint.endDate)],
        });
      } else if (activeTab === 'templates') {
        const template = item as TestCaseTemplate;
        form.setFieldsValue({
          ...template,
          isAutomated: Boolean(template.isAutomated),
        });
      } else {
        form.setFieldsValue(item);
      }
    } else {
      form.resetFields();
      if (activeTab === 'sprints') {
        form.setFieldsValue({ status: 'Planeado' });
      }
      if (activeTab === 'templates') {
        form.setFieldsValue({
          testType: TestType.FUNCTIONAL,
          priority: Priority.MEDIUM,
          isAutomated: false,
        });
      }
    }

    setIsModalVisible(true);
  };

  const handleOpenDeliveryUnitModal = (item: DeliveryUnit | null = null) => {
    setEditingDeliveryUnit(item);

    if (item) {
      deliveryUnitForm.setFieldsValue({
        ...item,
        proposalDocumentId: item.proposalDocumentId,
        activityIds: item.activityIds || [],
      });
    } else {
      deliveryUnitForm.setFieldsValue({
        type: DeliveryUnitType.PHASE,
        status: DeliveryUnitStatus.PLANNED,
        sortOrder: deliveryUnits.length,
        proposalDocumentId: undefined,
        activityIds: [],
      });
    }

    setIsDeliveryUnitModalVisible(true);
  };

  const handleOpenDeliveryActivityModal = (item: DeliveryActivityTemplate | null = null) => {
    setEditingDeliveryActivity(item);

    if (item) {
      deliveryActivityForm.setFieldsValue(item);
    } else {
      deliveryActivityForm.setFieldsValue({
        isActive: true,
        category: undefined,
      });
    }

    setIsDeliveryActivityModalVisible(true);
  };

  const handleSave = async (values: any) => {
    const generatedId =
      editingItem?.id ||
      `${activeTab === 'sprints' ? 'S' : activeTab === 'roles' ? 'R' : activeTab === 'modules' ? 'M' : 'T'}${Date.now()}`;

    const payload: any = {
      id: generatedId,
      projectId,
      ...values,
    };

    if (activeTab === 'sprints') {
      payload.startDate = values.period[0].format('YYYY-MM-DD');
      payload.endDate = values.period[1].format('YYYY-MM-DD');
      delete payload.period;
    }

    try {
      if (activeTab === 'sprints') await saveSprint(payload);
      else if (activeTab === 'roles') await saveRole(payload);
      else if (activeTab === 'modules') await saveModule(payload);
      else if (activeTab === 'templates') await saveTemplate(payload);

      message.success(`${tabLabelMap[activeTab]} guardada con éxito`);
      closeModal();
    } catch (error) {
      console.error(`Error saving ${activeTab}:`, error);
      message.error(`No se pudo guardar la ${tabLabelMap[activeTab].toLowerCase()}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (activeTab === 'sprints') await deleteSprint(id);
      else if (activeTab === 'roles') await deleteRole(id);
      else if (activeTab === 'modules') await deleteModule(id);
      else if (activeTab === 'templates') await deleteTemplate(id);

      message.success('Eliminado con éxito');
    } catch (error) {
      console.error(`Error deleting ${activeTab}:`, error);
      message.error('No se pudo eliminar el registro');
    }
  };

  const handleSaveDeliveryUnit = async () => {
    try {
      const values = await deliveryUnitForm.validateFields();
      await saveDeliveryUnit({
        documentId: editingDeliveryUnit?.documentId,
        id: editingDeliveryUnit?.id || `delivery-unit-${Date.now()}`,
        projectId,
        name: String(values.name || '').trim(),
        proposalDocumentId: values.proposalDocumentId || undefined,
        type: values.type,
        baseDescription: String(values.baseDescription || '').trim(),
        startDate: values.startDate || '',
        estimatedEndDate: values.estimatedEndDate || '',
        periodLabel: String(values.periodLabel || '').trim(),
        amount:
          typeof values.amount === 'number' && Number.isFinite(values.amount)
            ? values.amount
            : undefined,
        status: values.status,
        sortOrder:
          typeof values.sortOrder === 'number' && Number.isFinite(values.sortOrder)
            ? values.sortOrder
            : editingDeliveryUnit?.sortOrder ?? deliveryUnits.length,
        activityIds: Array.isArray(values.activityIds) ? values.activityIds : [],
      });
      message.success('Unidad de entrega guardada con éxito');
      closeDeliveryUnitModal();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      console.error('Delivery unit save failed:', error);
      message.error('No se pudo guardar la unidad de entrega.');
    }
  };

  const handleSaveDeliveryActivity = async () => {
    try {
      const values = await deliveryActivityForm.validateFields();
      await saveDeliveryActivityTemplate({
        documentId: editingDeliveryActivity?.documentId,
        id: editingDeliveryActivity?.id || `delivery-activity-${Date.now()}`,
        projectId,
        name: String(values.name || '').trim(),
        category: String(values.category || '').trim(),
        isActive: values.isActive !== false,
      });
      message.success('Actividad operativa guardada con éxito');
      closeDeliveryActivityModal();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      console.error('Delivery activity save failed:', error);
      message.error('No se pudo guardar la actividad operativa.');
    }
  };

  const handleDeleteDeliveryUnit = async (item: DeliveryUnit) => {
    if (!item.documentId) return;

    try {
      await deleteDeliveryUnit(item.documentId);
      message.success('Unidad de entrega eliminada');
    } catch (error) {
      console.error('Delivery unit delete failed:', error);
      message.error('No se pudo eliminar la unidad de entrega.');
    }
  };

  const handleDeleteDeliveryActivity = async (item: DeliveryActivityTemplate) => {
    if (!item.documentId) return;

    try {
      await deleteDeliveryActivityTemplate(item.documentId);
      message.success('Actividad operativa eliminada');
    } catch (error) {
      console.error('Delivery activity delete failed:', error);
      message.error('No se pudo eliminar la actividad operativa.');
    }
  };

  const normalizedDeliveryActivitySearch = deliveryActivitySearch.trim().toLowerCase();

  const filteredDeliveryActivityTemplates = deliveryActivityTemplates.filter(template => {
    const matchesSearch =
      !normalizedDeliveryActivitySearch ||
      template.name.toLowerCase().includes(normalizedDeliveryActivitySearch) ||
      String(template.category || '')
        .toLowerCase()
        .includes(normalizedDeliveryActivitySearch);

    const matchesCategory =
      !deliveryActivityCategoryFilter || template.category === deliveryActivityCategoryFilter;

    return matchesSearch && matchesCategory;
  });

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
      render: (_: unknown, record: Sprint) => (
        <Text type="secondary">
          {dayjs(record.startDate).format('DD/MM/YYYY')} - {dayjs(record.endDate).format('DD/MM/YYYY')}
        </Text>
      ),
    },
    { title: 'ESTADO', dataIndex: 'status', key: 'status' },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: unknown, record: Sprint) => (
        <Space>
          {!isViewer ? (
            <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          ) : null}
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
      render: (_: unknown, record: Role) => (
        <Space>
          {!isViewer ? (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
              <Popconfirm title="Eliminar rol?" onConfirm={() => handleDelete(record.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : null}
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
      render: (_: unknown, record: Module) => (
        <Space>
          {!isViewer ? (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
              <Popconfirm title="Eliminar modulo?" onConfirm={() => handleDelete(record.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const templateColumns = [
    {
      title: 'NOMBRE DE LA PLANTILLA',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'MÓDULO',
      dataIndex: 'moduleName',
      key: 'moduleName',
      render: (text: string) => <Text>{text || 'Sin modulo'}</Text>,
    },
    {
      title: 'TIPO',
      dataIndex: 'testType',
      key: 'testType',
    },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: unknown, record: TestCaseTemplate) => (
        <Space>
          {!isViewer ? (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
              <Popconfirm title="Eliminar plantilla?" onConfirm={() => handleDelete(record.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const deliveryUnitColumns = [
    {
      title: 'NOMBRE',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'PROPUESTA',
      dataIndex: 'proposalName',
      key: 'proposalName',
      render: (_: string, record: DeliveryUnit) =>
        record.proposalName ? (
          <div>
            <Text strong>{record.proposalName}</Text>
            <Text className="mt-1 block text-xs text-slate-500">
              {record.proposalOwner || 'Sin responsable'}
            </Text>
          </div>
        ) : (
          <Text type="secondary">Sin propuesta</Text>
        ),
    },
    {
      title: 'TIPO',
      dataIndex: 'type',
      key: 'type',
      render: (value: DeliveryUnitType) => (
        <Tag className="rounded-full border-none bg-slate-100 px-3 py-0.5 text-slate-600">
          {formatDeliveryUnitType(value)}
        </Tag>
      ),
    },
    {
      title: 'PERIODO / FECHAS',
      key: 'period',
      render: (_: unknown, record: DeliveryUnit) => {
        if (record.periodLabel?.trim()) {
          return <Text>{record.periodLabel}</Text>;
        }

        if (record.startDate || record.estimatedEndDate) {
          return (
            <Text>
              {(record.startDate && dayjs(record.startDate).format('DD/MM/YYYY')) || '-'} -{' '}
              {(record.estimatedEndDate && dayjs(record.estimatedEndDate).format('DD/MM/YYYY')) || '-'}
            </Text>
          );
        }

        return <Text type="secondary">Sin periodo</Text>;
      },
    },
    {
      title: 'ACTIVIDADES',
      key: 'activities',
      render: (_: unknown, record: DeliveryUnit) => (
        <Tag className="rounded-full border-none bg-blue-50 px-3 py-0.5 text-blue-600">
          {Array.isArray(record.activities) && record.activities.length > 0
            ? `${record.activities.length} seleccionada(s)`
            : 'Sin actividades'}
        </Tag>
      ),
    },
    {
      title: 'MONTO',
      dataIndex: 'amount',
      key: 'amount',
      render: (value?: number) =>
        typeof value === 'number' ? <Text strong>US$ {value.toLocaleString()}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'ESTADO',
      dataIndex: 'status',
      key: 'status',
      render: (value: DeliveryUnitStatus) => renderDeliveryUnitStatusTag(value),
    },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: unknown, record: DeliveryUnit) => (
        <Space>
          {!isViewer ? (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenDeliveryUnitModal(record)} />
              <Popconfirm
                title="Eliminar unidad de entrega?"
                onConfirm={() => void handleDeleteDeliveryUnit(record)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const deliveryActivityColumns = [
    {
      title: 'NOMBRE',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: DeliveryActivityTemplate) => (
        <div className="min-w-0">
          <Text strong className="block text-slate-800">
            {record.name}
          </Text>
          <div className="mt-2">
            <Tag className="rounded-full border-none bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {record.category?.trim() || 'Sin categoría'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'ESTADO',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) => (
        <Tag
          color={value ? 'green' : 'default'}
          className="rounded-full border-none px-3 py-0.5 font-medium"
        >
          {value ? 'Activa' : 'Inactiva'}
        </Tag>
      ),
    },
    {
      title: 'ACCIONES',
      key: 'actions',
      render: (_: unknown, record: DeliveryActivityTemplate) => (
        <Space>
          {!isViewer ? (
            <>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleOpenDeliveryActivityModal(record)}
              />
              <Popconfirm
                title="Eliminar actividad operativa?"
                onConfirm={() => void handleDeleteDeliveryActivity(record)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const sectionOptions: Array<{
    key: SettingsTabKey;
    label: string;
    icon: React.ReactNode;
  }> = [
    { key: 'sprints', label: 'Sprints', icon: <CalendarOutlined /> },
    { key: 'roles', label: 'Roles', icon: <TeamOutlined /> },
    { key: 'modules', label: 'Módulos', icon: <AppstoreOutlined /> },
    { key: 'templates', label: 'Plantillas', icon: <FileTextOutlined /> },
    { key: 'proposal', label: 'Propuesta y unidades de entrega', icon: <FolderOpenOutlined /> },
  ];

  const renderProposalTab = () => (
    <div className="mt-6 space-y-6">
      <ProjectProposalManager
        projectId={projectId}
        isViewer={isViewer}
      />

      <Card className="rounded-2xl border-gray-100">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <Title level={4}>Unidades de entrega</Title>
            <Text type="secondary">
              Crea fases, servicios, hitos o mantenimientos reutilizables para asignar funcionalidades y generar reportes.
            </Text>
          </div>
          {!isViewer ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenDeliveryUnitModal()}
              className="bg-blue-600"
            >
              Nueva unidad
            </Button>
          ) : null}
        </div>

        <Table
          columns={deliveryUnitColumns}
          dataSource={deliveryUnits}
          rowKey={record => record.documentId || record.id}
          pagination={false}
          locale={{ emptyText: 'No hay unidades de entrega configuradas para este proyecto.' }}
          className="overflow-hidden rounded-2xl border border-slate-100"
          rowClassName={() => 'align-top'}
        />
      </Card>

      <Card className="rounded-2xl border-gray-100">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <Title level={4}>Plantillas de actividades de entrega</Title>
            <Text type="secondary">
              Configura el catálogo operativo reusable por proyecto para luego seleccionarlo en cada unidad de entrega.
            </Text>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <Input
              allowClear
              value={deliveryActivitySearch}
              onChange={event => setDeliveryActivitySearch(event.target.value)}
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Buscar por nombre o categoría"
              className="w-full md:w-[280px]"
            />
            <Select
              allowClear
              value={deliveryActivityCategoryFilter}
              onChange={value => setDeliveryActivityCategoryFilter(value)}
              placeholder="Filtrar por categoría"
              className="w-full md:w-[280px]"
              options={deliveryActivityCategoryOptions.map(category => ({
                label: category,
                value: category,
              }))}
            />
            {!isViewer ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenDeliveryActivityModal()}
                className="bg-blue-600"
              >
                Nueva actividad
              </Button>
            ) : null}
          </div>
        </div>

        <Table
          columns={deliveryActivityColumns}
          dataSource={filteredDeliveryActivityTemplates}
          rowKey={record => record.documentId || record.id}
          pagination={false}
          locale={{ emptyText: 'No hay actividades operativas configuradas para este proyecto.' }}
          className="overflow-hidden rounded-2xl border border-slate-100"
          rowClassName={() => 'align-top'}
          scroll={{ y: 480 }}
        />
      </Card>
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === 'sprints') {
      return (
        <div className="mt-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Title level={4}>Gestión de sprints</Title>
              <Text type="secondary">
                Administra los periodos de trabajo y ciclos de desarrollo del proyecto.
              </Text>
            </div>
            {!isViewer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-blue-600">
                Nuevo Sprint
              </Button>
            ) : null}
          </div>
          <Table columns={sprintColumns} dataSource={sprints} rowKey="id" pagination={false} className="overflow-hidden rounded-lg border border-gray-100" />
        </div>
      );
    }

    if (activeTab === 'roles') {
      return (
        <div className="mt-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Title level={4}>Gestión de roles</Title>
              <Text type="secondary">
                Define los roles de usuario que interactúan con las funcionalidades del sistema.
              </Text>
            </div>
            {!isViewer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-blue-600">
                Nuevo Rol
              </Button>
            ) : null}
          </div>
          <Table columns={roleColumns} dataSource={roles} rowKey="id" pagination={false} className="overflow-hidden rounded-lg border border-gray-100" />
        </div>
      );
    }

    if (activeTab === 'modules') {
      return (
        <div className="mt-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Title level={4}>Gestión de módulos</Title>
              <Text type="secondary">
                Organiza las funcionalidades del sistema por módulos lógicos.
              </Text>
            </div>
            {!isViewer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-blue-600">
                Nuevo módulo
              </Button>
            ) : null}
          </div>
          <Table columns={moduleColumns} dataSource={modules} rowKey="id" pagination={false} className="overflow-hidden rounded-lg border border-gray-100" />
        </div>
      );
    }

    if (activeTab === 'proposal') {
      return renderProposalTab();
    }

    return (
      <div className="mt-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
              <Title level={4}>Gestión de plantillas</Title>
              <Text type="secondary">
                Organiza las plantillas de casos de prueba asociadas a los módulos del proyecto.
              </Text>
          </div>
          {!isViewer ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-blue-600">
              Nueva Plantilla
            </Button>
          ) : null}
        </div>
        {templatesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 py-12 text-center">
            <Text type="danger">
              Error al cargar plantillas: {templatesError instanceof Error ? templatesError.message : 'Error desconocido'}
            </Text>
          </div>
        ) : isLoadingTemplates ? (
          <div className="py-12 text-center">
            <Text type="secondary">Cargando plantillas...</Text>
          </div>
        ) : templates.length > 0 ? (
          <Table columns={templateColumns} dataSource={templates} rowKey="id" pagination={false} className="overflow-hidden rounded-lg border border-gray-100" />
        ) : (
          <div className="rounded-lg border border-gray-100 bg-gray-50 py-12 text-center">
            <Text type="secondary">No hay plantillas disponibles. Crea una nueva.</Text>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="min-h-[600px] rounded-2xl border-slate-100 shadow-sm">
      <div className="relative z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
        <Text strong className="text-slate-600">
          Sección:
        </Text>
        <Select
          value={activeTab}
          onChange={handleTabChange}
          className="min-w-[260px]"
          options={sectionOptions.map(section => ({
            value: section.key,
            label: section.label,
          }))}
        />
      </div>

      <div className="relative z-0">{renderTabContent()}</div>

      <Modal
        title={editingItem ? `Editar ${tabLabelMap[activeTab]}` : `Nueva ${tabLabelMap[activeTab]}`}
        open={isModalVisible}
        onCancel={closeModal}
        closeIcon={
          <button
            type="button"
            onClick={closeModal}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <CloseOutlined />
          </button>
        }
        footer={null}
        width={activeTab === 'templates' ? 760 : 500}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSave} className="mt-4">
          {activeTab === 'sprints' && (
            <>
              <Form.Item name="name" label="Nombre del Sprint" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Input placeholder="Ej: Sprint 1 - Core Features" />
              </Form.Item>
              <Form.Item name="period" label="Periodo (Inicio - Fin)" rules={[{ required: true, message: 'Campo requerido' }]}>
                <RangePicker className="w-full" />
              </Form.Item>
              <Form.Item name="status" label="Estado Inicial" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Select>
                  <Option value="Planeado">Planeado</Option>
                  <Option value="En Progreso">En Progreso</Option>
                  <Option value="Completado">Completado</Option>
                </Select>
              </Form.Item>
              <Form.Item name="objective" label="Objetivo del Sprint">
                <Input.TextArea rows={4} placeholder="Que se espera lograr en este ciclo?" />
              </Form.Item>
            </>
          )}

          {activeTab === 'roles' && (
            <>
              <Form.Item name="name" label="Nombre del Rol" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Input placeholder="Ej: Administrador, Cliente, Auditor" />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea rows={4} placeholder="Describe las responsabilidades de este rol..." />
              </Form.Item>
            </>
          )}

          {activeTab === 'modules' && (
            <>
              <Form.Item name="name" label="Nombre del módulo" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Input placeholder="Ej: Autenticación, Pagos, Usuarios" />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea rows={4} placeholder="Describe el alcance de este modulo..." />
              </Form.Item>
            </>
          )}

          {activeTab === 'templates' && (
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="name" label="Nombre de la plantilla" rules={[{ required: true, message: 'Campo requerido' }]} className="col-span-2">
                <Input placeholder="Ej: Módulo Agencia -- revisión" />
              </Form.Item>
              <Form.Item name="description" label="Descripción" className="col-span-2">
                <Input.TextArea rows={4} placeholder="Describe el escenario base de la plantilla..." />
              </Form.Item>
              <Form.Item name="preconditions" label="Precondiciones" className="col-span-2">
                <Input.TextArea rows={4} placeholder="Condiciones necesarias antes de ejecutar la prueba..." />
              </Form.Item>
              <Form.Item name="testSteps" label="Pasos" className="col-span-2">
                <Input.TextArea rows={5} placeholder="Secuencia de pasos sugerida para el caso de prueba..." />
              </Form.Item>
              <Form.Item name="expectedResult" label="Resultado esperado" className="col-span-2">
                <Input.TextArea rows={4} placeholder="Que debe ocurrir si la funcionalidad se comporta correctamente..." />
              </Form.Item>
              <Form.Item name="moduleId" label="Módulo" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Select placeholder="Selecciona un módulo" options={modules.map(module => ({ label: module.name, value: module.id }))} />
              </Form.Item>
              <Form.Item name="testType" label="Tipo de prueba" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Select options={templateTypeOptions.map(type => ({ label: type, value: type }))} />
              </Form.Item>
              <Form.Item name="priority" label="Prioridad" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Select options={templatePriorityOptions.map(priority => ({ label: priority, value: priority }))} />
              </Form.Item>
              <Form.Item name="isAutomated" label="Automatizado" valuePropName="checked">
                <Switch checkedChildren="Si" unCheckedChildren="No" />
              </Form.Item>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={closeModal}>Cancelar</Button>
            {!isViewer ? (
              <Button type="primary" htmlType="submit" className="bg-blue-600">
                Guardar
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingDeliveryUnit ? 'Editar unidad de entrega' : 'Nueva unidad de entrega'}
        open={isDeliveryUnitModalVisible}
        onCancel={closeDeliveryUnitModal}
        footer={null}
        width={720}
        destroyOnHidden
        >
        <Form form={deliveryUnitForm} layout="vertical" onFinish={handleSaveDeliveryUnit} className="mt-4">
          <div className="space-y-6">
            <div>
              <Text className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Identidad
              </Text>
              <Text type="secondary" className="mb-4 block text-sm">
                Define el nombre, tipo y estado general de esta unidad de entrega.
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Form.Item
                  name="name"
                  label="Nombre"
                  rules={[{ required: true, message: 'Campo requerido' }]}
                  className="md:col-span-2"
                >
                  <Input placeholder="Ej: Fase 2 - Borrador MVP" className="h-11 rounded-xl" />
                </Form.Item>

                <Form.Item
                  name="type"
                  label="Tipo"
                  rules={[{ required: true, message: 'Campo requerido' }]}
                >
                  <Select
                    className="h-11"
                    options={deliveryUnitTypeOptions.map(option => ({
                      label: formatDeliveryUnitType(option),
                      value: option,
                    }))}
                  />
                </Form.Item>

                <Form.Item
                  name="status"
                  label="Estado"
                  rules={[{ required: true, message: 'Campo requerido' }]}
                >
                  <Select
                    className="h-11"
                    options={deliveryUnitStatusOptions.map(option => ({
                      label: formatDeliveryUnitStatus(option),
                      value: option,
                    }))}
                  />
                </Form.Item>

                <Form.Item
                  name="proposalDocumentId"
                  label="Propuesta asociada"
                  className="md:col-span-2"
                  extra="Opcional. Úsala para conectar esta unidad con una propuesta comercial concreta."
                >
                  <Select
                    allowClear
                    className="h-11"
                    placeholder="Selecciona una propuesta del proyecto..."
                    options={projectProposals.map(proposal => ({
                      label: proposal.isPrimary ? `${proposal.name} (Principal)` : proposal.name,
                      value: proposal.documentId || proposal.id,
                    }))}
                  />
                </Form.Item>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <Text className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Planificación
              </Text>
              <Text type="secondary" className="mb-4 block text-sm">
                Establece el periodo de trabajo y, si aplica, la referencia temporal o económica.
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Form.Item name="startDate" label="Fecha de inicio">
                  <Input type="date" className="h-11 rounded-xl" />
                </Form.Item>

                <Form.Item name="estimatedEndDate" label="Fecha de fin estimada">
                  <Input type="date" className="h-11 rounded-xl" />
                </Form.Item>

                <Form.Item
                  name="periodLabel"
                  label="Período o mes"
                  extra="Úsalo cuando la unidad represente un servicio mensual o una referencia temporal específica."
                >
                  <Input placeholder="Ej: Abril 2026" className="h-11 rounded-xl" />
                </Form.Item>

                <Form.Item name="amount" label="Monto">
                  <InputNumber
                    className="!w-full rounded-xl"
                    min={0}
                    controls={false}
                    addonBefore="US$"
                  />
                </Form.Item>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <Text className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Seguimiento
              </Text>
              <Text type="secondary" className="mb-4 block text-sm">
                Relaciona las actividades operativas y documenta el alcance base de esta unidad.
              </Text>
              <div className="grid grid-cols-1 gap-4">
                <Form.Item
                  name="activityIds"
                  label="Actividades realizadas"
                  extra={
                    deliveryActivityTemplates.filter(item => item.isActive).length > 0
                      ? 'Selecciona las actividades operativas que pertenecen a esta unidad.'
                      : 'Primero crea actividades operativas en la sección inferior.'
                  }
                >
                  <Select
                    mode="multiple"
                    allowClear
                    className="min-h-[44px]"
                    placeholder="Selecciona actividades operativas configuradas..."
                    options={deliveryActivityTemplates
                      .filter(item => item.isActive)
                      .map(item => ({
                        label: item.category
                          ? `${item.name} · ${item.category}`
                          : item.name,
                        value: item.documentId || item.id,
                      }))}
                  />
                </Form.Item>

                <Form.Item
                  name="baseDescription"
                  label="Descripción base"
                  extra="Este texto se utiliza como contexto para reportes y resúmenes de la unidad."
                >
                  <Input.TextArea
                    rows={5}
                    className="rounded-xl"
                    placeholder="Describe el alcance base de esta fase, servicio o hito."
                  />
                </Form.Item>
              </div>
            </div>

          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={closeDeliveryUnitModal}>Cancelar</Button>
            {!isViewer ? (
              <Button type="primary" htmlType="submit" className="bg-blue-600" loading={isSavingDeliveryUnit}>
                Guardar unidad
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>

      <Modal
        title={
          editingDeliveryActivity
            ? 'Editar actividad operativa'
            : 'Nueva actividad operativa'
        }
        open={isDeliveryActivityModalVisible}
        onCancel={closeDeliveryActivityModal}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Form
          form={deliveryActivityForm}
          layout="vertical"
          onFinish={handleSaveDeliveryActivity}
          className="mt-4"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Nombre"
              rules={[{ required: true, message: 'Campo requerido' }]}
              className="md:col-span-2"
            >
              <Input placeholder="Ej: Configuración de ambiente QA" />
            </Form.Item>

            <Form.Item name="isActive" label="Activa" valuePropName="checked">
              <Switch checkedChildren="Si" unCheckedChildren="No" />
            </Form.Item>

            <Form.Item
              name="category"
              label="Categoría"
              className="md:col-span-2"
              rules={[{ required: true, message: 'Selecciona una categoría' }]}
              extra="Usaremos estas categorías para filtrar, buscar y mantener un catálogo consistente."
            >
              <Select
                showSearch
                placeholder="Selecciona la categoría de la actividad"
                optionFilterProp="label"
                options={deliveryActivityCategoryOptions.map(category => ({
                  label: category,
                  value: category,
                }))}
              />
            </Form.Item>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={closeDeliveryActivityModal}>Cancelar</Button>
            {!isViewer ? (
              <Button
                type="primary"
                htmlType="submit"
                className="bg-blue-600"
                loading={isSavingDeliveryActivityTemplate}
              >
                Guardar actividad
              </Button>
            ) : null}
          </div>
        </Form>
      </Modal>
    </Card>
  );
};

export default Settings;


