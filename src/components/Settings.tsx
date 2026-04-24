import React, { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useModules } from '../modules/settings/hooks/useModules';
import { useRoles } from '../modules/settings/hooks/useRoles';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCaseTemplates } from '../modules/test-case-templates/hooks/useTestCaseTemplates';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { Module, Priority, Role, Sprint, TestCaseTemplate, TestType } from '../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface SettingsProps {
  projectId: string;
}

type SettingsTabKey = 'sprints' | 'roles' | 'modules' | 'templates';
type SettingsItem = Sprint | Role | Module | TestCaseTemplate | null;

const templateTypeOptions = Object.values(TestType);
const templatePriorityOptions = Object.values(Priority);

const tabLabelMap: Record<SettingsTabKey, string> = {
  sprints: 'Sprint',
  roles: 'Rol',
  modules: 'Módulo',
  templates: 'Plantilla',
};

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

  const [activeTab, setActiveTab] = useState<SettingsTabKey>('sprints');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingsItem>(null);
  const [form] = Form.useForm();

  const closeModal = () => {
    setEditingItem(null);
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as SettingsTabKey);
    if (isModalVisible) {
      closeModal();
    }
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
              <Popconfirm title="¿Eliminar rol?" onConfirm={() => handleDelete(record.id)}>
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
              <Popconfirm title="¿Eliminar módulo?" onConfirm={() => handleDelete(record.id)}>
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
      render: (text: string) => <Text>{text || 'Sin módulo'}</Text>,
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
              <Popconfirm title="¿Eliminar plantilla?" onConfirm={() => handleDelete(record.id)}>
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
  ];

  const renderTabContent = () => {
    if (activeTab === 'sprints') {
      return (
        <div className="mt-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Title level={4}>Gestión de Sprints</Title>
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
              <Title level={4}>Gestión de Roles</Title>
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
              <Title level={4}>Gestión de Módulos</Title>
              <Text type="secondary">
                Organiza las funcionalidades del sistema por módulos lógicos.
              </Text>
            </div>
            {!isViewer ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="bg-blue-600">
                Nuevo Módulo
              </Button>
            ) : null}
          </div>
          <Table columns={moduleColumns} dataSource={modules} rowKey="id" pagination={false} className="overflow-hidden rounded-lg border border-gray-100" />
        </div>
      );
    }

    return (
      <div className="mt-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Title level={4}>Gestión de Plantillas</Title>
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
          className="min-w-[220px]"
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
                <Input.TextArea rows={4} placeholder="¿Qué se espera lograr en este ciclo?" />
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
              <Form.Item name="name" label="Nombre del Módulo" rules={[{ required: true, message: 'Campo requerido' }]}>
                <Input placeholder="Ej: Autenticación, Pagos, Usuarios" />
              </Form.Item>
              <Form.Item name="description" label="Descripción">
                <Input.TextArea rows={4} placeholder="Describe el alcance de este módulo..." />
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
                <Input.TextArea rows={4} placeholder="Qué debe ocurrir si la funcionalidad se comporta correctamente..." />
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
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
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
    </Card>
  );
};

export default Settings;
