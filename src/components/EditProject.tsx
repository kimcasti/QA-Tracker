import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Row,
  Select,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { appBranding } from '../assets/branding';
import { useProjects } from '../modules/projects/hooks/useProjects';
import { Project, ProjectStatus } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface EditProjectProps {
  project: Project;
  onCancel: () => void;
  onSave: () => void;
}

const EditProject: React.FC<EditProjectProps> = ({ project, onCancel, onSave }) => {
  const { save: saveProject } = useProjects();
  const [form] = Form.useForm();
  const [requirements, setRequirements] = useState<string[]>(project.coreRequirements || []);
  const [newRequirement, setNewRequirement] = useState('');

  useEffect(() => {
    form.setFieldsValue({
      name: project.name,
      version: project.version,
      status: project.status,
      purpose: project.purpose,
      businessRules: project.businessRules,
    });
  }, [form, project]);

  const handleSave = async (values: any) => {
    const updatedProject: Project = {
      ...project,
      ...values,
      coreRequirements: requirements,
    };

    try {
      await saveProject(updatedProject);
      message.success('Cambios guardados con exito');
      onSave();
    } catch (error) {
      console.error('Error saving project:', error);
      message.error('Error al guardar los cambios');
    }
  };

  const addRequirement = () => {
    if (!newRequirement.trim()) return;
    setRequirements([...requirements, newRequirement.trim()]);
    setNewRequirement('');
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="relative min-h-full overflow-hidden px-6 py-8 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{
          background: `
            radial-gradient(circle at 14% 16%, rgba(23,182,211,0.10) 0%, transparent 34%),
            radial-gradient(circle at 86% 10%, rgba(18,63,104,0.08) 0%, transparent 28%)
          `,
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={onCancel}
            className="rounded-lg border-none hover:bg-gray-100"
          />
          <div>
            <Title level={2} className="m-0">
              Editar Proyecto
            </Title>
            <Text type="secondary">
              Actualiza la informacion general y el proposito del proyecto.
            </Text>
          </div>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSave} className="space-y-8">
          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <div className="mb-6 flex items-center gap-4">
              <img
                src={appBranding.logoUrl}
                alt="QA Tracker"
                className="h-10 w-10 rounded-xl object-cover shadow-sm"
              />
              <Title level={4} className="m-0">
                INFORMACION GENERAL
              </Title>
            </div>

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Nombre del Proyecto"
                  rules={[{ required: true, message: 'El nombre es requerido' }]}
                >
                  <Input placeholder="Nombre del proyecto" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="version"
                  label="Version"
                  rules={[{ required: true, message: 'La version es requerida' }]}
                >
                  <Input placeholder="v1.0.0" className="h-10 rounded-lg" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="status" label="Estado del Proyecto">
                  <Select className="h-10 rounded-lg">
                    <Option value={ProjectStatus.ACTIVE}>Activo</Option>
                    <Option value={ProjectStatus.PAUSED}>Pausado</Option>
                    <Option value={ProjectStatus.COMPLETED}>Completado</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <Title level={4} className="mb-6">
              PROPOSITO DEL PROYECTO
            </Title>
            <Form.Item name="purpose" label="Objetivo del Proyecto">
              <Input.TextArea
                rows={4}
                placeholder="Describe el objetivo principal y el alcance del proyecto..."
                className="rounded-xl p-4"
              />
            </Form.Item>
          </Card>

          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <Title level={4} className="mb-6">
              REQUISITOS CLAVE (CORE REQUIREMENTS)
            </Title>
            <div className="mb-6 flex gap-3">
              <Input
                placeholder="Ej. Autenticacion Biometrica"
                value={newRequirement}
                onChange={event => setNewRequirement(event.target.value)}
                onPressEnter={addRequirement}
                className="h-10 rounded-lg"
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={addRequirement}
                className="h-10 rounded-lg bg-emerald-600 border-none"
              >
                Agregar
              </Button>
            </div>

            <List
              dataSource={requirements}
              renderItem={(item, index) => (
                <List.Item className="mb-2 flex items-center justify-between rounded-xl border-none bg-gray-50 px-4">
                  <Text>{item}</Text>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeRequirement(index)}
                    className="rounded-lg hover:bg-red-50"
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <Title level={4} className="mb-6">
              REGLAS DE NEGOCIO
            </Title>
            <Form.Item name="businessRules" label="Reglas Importantes">
              <Input.TextArea
                rows={6}
                placeholder="Define las reglas de negocio criticas para el QA..."
                className="rounded-xl p-4 font-mono text-sm"
              />
            </Form.Item>
          </Card>

          <div className="flex justify-end gap-4 pb-12">
            <Button size="large" onClick={onCancel} className="h-12 rounded-xl px-8 border-gray-200">
              Cancelar
            </Button>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              icon={<SaveOutlined />}
              className="h-12 rounded-xl border-none bg-emerald-600 px-8 shadow-md hover:bg-emerald-700"
            >
              Guardar Cambios
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default EditProject;
