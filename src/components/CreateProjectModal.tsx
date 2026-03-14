import { Button, Col, Form, Input, Modal, Row, Select, message } from 'antd';
import dayjs from 'dayjs';
import { useProjects } from '../hooks';
import { Project, ProjectStatus } from '../types';

interface CreateProjectModalProps {
  open: boolean;
  onCancel: () => void;
}

export default function CreateProjectModal({
  open,
  onCancel,
}: CreateProjectModalProps) {
  const { save: saveProject, isSaving } = useProjects();
  const [form] = Form.useForm();

  const handleClose = () => {
    onCancel();
    form.resetFields();
  };

  const handleCreateProject = async (values: {
    name: string;
    organizationName?: string;
    description: string;
    version: string;
    status: ProjectStatus;
    teamMembers?: string[];
  }) => {
    const normalizedName = values.name.trim();
    const normalizedOrganizationName = values.organizationName?.trim();
    const normalizedMembers = (values.teamMembers || [])
      .map(member => member.trim())
      .filter(Boolean);

    const newProject: Project = {
      id: `P${Date.now()}`,
      name: normalizedName,
      organizationName: normalizedOrganizationName || normalizedName,
      description: values.description.trim(),
      version: values.version.trim(),
      status: values.status,
      createdAt: dayjs().format('YYYY-MM-DD'),
      teamMembers: normalizedMembers,
      icon: 'ProjectOutlined',
      purpose: '',
      coreRequirements: [],
      businessRules: '',
    };

    try {
      await saveProject(newProject);
      message.success('Proyecto creado con exito');
      handleClose();
    } catch (error) {
      console.error('Error creating project:', error);
      message.error('Error al crear el proyecto');
    }
  };

  return (
    <Modal
      open={open}
      title="Crear nuevo proyecto"
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={720}
    >
      <div className="pb-2 text-slate-500">
        Registra un workspace QA alineado con el branding y listo para navegar desde la home.
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleCreateProject}
        initialValues={{
          status: ProjectStatus.ACTIVE,
          version: 'v1.0.0',
          teamMembers: [],
        }}
        className="mt-6"
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="Nombre interno"
              rules={[{ required: true, message: 'Ingresa el nombre del proyecto' }]}
            >
              <Input size="large" placeholder="Ej. Nexus Core Platform" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="organizationName" label="Nombre visible del workspace">
              <Input size="large" placeholder="Ej. QA Payments Workspace" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="Descripcion"
          rules={[{ required: true, message: 'Ingresa una descripcion breve' }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="Describe el alcance, objetivos y el contexto del proyecto."
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="version"
              label="Version del sistema"
              rules={[{ required: true, message: 'Ingresa la version' }]}
            >
              <Input size="large" placeholder="v2.4.0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="status" label="Estado inicial">
              <Select
                size="large"
                options={[
                  { label: 'Activo', value: ProjectStatus.ACTIVE },
                  { label: 'Pausado', value: ProjectStatus.PAUSED },
                  { label: 'Completado', value: ProjectStatus.COMPLETED },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="teamMembers" label="Miembros del equipo">
          <Select
            mode="tags"
            size="large"
            tokenSeparators={[',']}
            placeholder="Agrega nombres del equipo"
            options={[
              { label: 'QA Lead', value: 'QA Lead' },
              { label: 'QA Engineer', value: 'QA Engineer' },
              { label: 'Automation Engineer', value: 'Automation Engineer' },
              { label: 'Product Owner', value: 'Product Owner' },
            ]}
          />
        </Form.Item>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            onClick={handleClose}
            className="h-11 rounded-2xl border-slate-200 px-6 font-semibold"
          >
            Cancelar
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={isSaving}
            className="h-11 rounded-2xl px-6 font-semibold"
          >
            Crear proyecto
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
