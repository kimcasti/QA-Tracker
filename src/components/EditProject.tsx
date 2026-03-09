import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Select, 
  Form, 
  message, 
  Row, 
  Col, 
  Typography, 
  Space, 
  List, 
  Divider,
  Breadcrumb
} from 'antd';
import { 
  ProjectOutlined, 
  SaveOutlined, 
  CloseOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { Project, ProjectStatus } from '../types';
import { useProjects } from '../hooks';

const { Title, Text, Paragraph } = Typography;
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
      businessRules: project.businessRules
    });
  }, [project, form]);

  const handleSave = (values: any) => {
    const updatedProject: Project = {
      ...project,
      ...values,
      coreRequirements: requirements
    };
    saveProject(updatedProject);
    message.success('Cambios guardados con éxito');
    onSave();
  };

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement('');
    }
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={onCancel} 
          className="rounded-lg border-none hover:bg-gray-100"
        />
        <div>
          <Title level={2} className="m-0">Editar Proyecto</Title>
          <Text type="secondary">Actualiza la información general y el propósito del proyecto.</Text>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        className="space-y-8"
      >
        {/* GENERAL INFORMATION */}
        <Card className="rounded-2xl shadow-sm border-none overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <ProjectOutlined className="text-xl text-emerald-600" />
            </div>
            <Title level={4} className="m-0">INFORMACIÓN GENERAL</Title>
          </div>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item 
                name="name" 
                label="Nombre del Proyecto" 
                rules={[{ required: true, message: 'El nombre es requerido' }]}
              >
                <Input placeholder="Nombre del proyecto" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item 
                name="version" 
                label="Versión" 
                rules={[{ required: true, message: 'La versión es requerida' }]}
              >
                <Input placeholder="v1.0.0" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={6}>
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

        {/* PROJECT PURPOSE */}
        <Card className="rounded-2xl shadow-sm border-none overflow-hidden">
          <Title level={4} className="mb-6">PROPÓSITO DEL PROYECTO</Title>
          <Form.Item name="purpose" label="Objetivo del Proyecto">
            <Input.TextArea 
              rows={4} 
              placeholder="Describe el objetivo principal y el alcance del proyecto..." 
              className="rounded-xl p-4"
            />
          </Form.Item>
        </Card>

        {/* CORE REQUIREMENTS */}
        <Card className="rounded-2xl shadow-sm border-none overflow-hidden">
          <Title level={4} className="mb-6">REQUISITOS CLAVE (CORE REQUIREMENTS)</Title>
          <div className="flex gap-3 mb-6">
            <Input 
              placeholder="Ej. Autenticación Biométrica" 
              value={newRequirement}
              onChange={e => setNewRequirement(e.target.value)}
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
              <List.Item
                className="bg-gray-50 rounded-xl mb-2 px-4 border-none flex justify-between items-center"
              >
                <Text>{item}</Text>
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={() => removeRequirement(index)}
                  className="hover:bg-red-50 rounded-lg"
                />
              </List.Item>
            )}
          />
        </Card>

        {/* BUSINESS RULES */}
        <Card className="rounded-2xl shadow-sm border-none overflow-hidden">
          <Title level={4} className="mb-6">REGLAS DE NEGOCIO</Title>
          <Form.Item name="businessRules" label="Reglas Importantes">
            <Input.TextArea 
              rows={6} 
              placeholder="Define las reglas de negocio críticas para el QA..." 
              className="rounded-xl p-4 font-mono text-sm"
            />
          </Form.Item>
        </Card>

        {/* ACTIONS */}
        <div className="flex justify-end gap-4 pb-12">
          <Button 
            size="large" 
            onClick={onCancel} 
            className="rounded-xl h-12 px-8 border-gray-200"
          >
            Cancelar
          </Button>
          <Button 
            type="primary" 
            size="large" 
            htmlType="submit" 
            icon={<SaveOutlined />}
            className="rounded-xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 border-none shadow-md"
          >
            Guardar Cambios
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default EditProject;
