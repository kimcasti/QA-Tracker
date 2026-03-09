import React, { useState } from 'react';
import { Card, Button, Input, Select, Tag, Modal, Form, message, Row, Col, Typography, Space, Empty } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  EyeOutlined, 
  RocketOutlined, 
  ProjectOutlined,
  TeamOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useProjects } from '../hooks';
import { Project, ProjectStatus } from '../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface ProjectManagementProps {
  onViewDetails: (project: Project) => void;
  onEditProject: (project: Project) => void;
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({ onViewDetails, onEditProject }) => {
  const { data: projects = [], save: saveProject } = useProjects();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [form] = Form.useForm();

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateProject = (values: any) => {
    const newProject: Project = {
      id: `P${Date.now()}`,
      name: values.name,
      description: values.description,
      version: values.version,
      status: values.status,
      createdAt: dayjs().format('YYYY-MM-DD'),
      teamMembers: values.teamMembers,
      icon: 'ProjectOutlined',
      purpose: '',
      coreRequirements: [],
      businessRules: ''
    };
    saveProject(newProject);
    message.success('Proyecto creado con éxito');
    setIsModalVisible(false);
    form.resetFields();
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.ACTIVE: return 'success';
      case ProjectStatus.PAUSED: return 'warning';
      case ProjectStatus.COMPLETED: return 'blue';
      default: return 'default';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Title level={2}>Gestión de Proyectos</Title>
          <Text type="secondary">Administra tus espacios de trabajo de QA de forma independiente.</Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large"
          onClick={() => setIsModalVisible(true)}
          className="bg-emerald-600 hover:bg-emerald-700 border-none h-12 px-6 rounded-lg shadow-md"
        >
          Nuevo Proyecto
        </Button>
      </div>

      <div className="flex gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <Input 
          placeholder="Buscar proyectos..." 
          prefix={<SearchOutlined className="text-gray-400" />} 
          className="max-w-md h-10 rounded-lg"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Select 
          defaultValue="All" 
          className="w-48 h-10"
          onChange={value => setStatusFilter(value)}
        >
          <Option value="All">Todos los Estados</Option>
          <Option value={ProjectStatus.ACTIVE}>Activos</Option>
          <Option value={ProjectStatus.PAUSED}>Pausados</Option>
          <Option value={ProjectStatus.COMPLETED}>Completados</Option>
        </Select>
      </div>

      {filteredProjects.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredProjects.map(project => (
            <Col xs={24} sm={12} lg={8} key={project.id}>
              <Card 
                hoverable 
                className="rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300"
                bodyStyle={{ padding: '24px' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <ProjectOutlined className="text-2xl text-emerald-600" />
                  </div>
                  <Tag color={getStatusColor(project.status)} className="rounded-full px-3 border-none">
                    {project.status}
                  </Tag>
                </div>

                <Title level={4} className="mb-1">{project.name}</Title>
                <Text type="secondary" className="block mb-4 text-xs">Versión: {project.version}</Text>
                
                <Paragraph ellipsis={{ rows: 2 }} className="text-gray-500 mb-6 h-12">
                  {project.description}
                </Paragraph>

                <div className="flex items-center gap-4 mb-6 text-gray-400 text-xs">
                  <span className="flex items-center gap-1">
                    <CalendarOutlined /> {project.createdAt}
                  </span>
                  {project.teamMembers && (
                    <span className="flex items-center gap-1">
                      <TeamOutlined /> {project.teamMembers.length} Miembros
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={() => onEditProject(project)}
                    className="rounded-lg border-gray-200 hover:border-emerald-500 hover:text-emerald-600"
                  >
                    Editar
                  </Button>
                  <Button 
                    type="primary" 
                    icon={<EyeOutlined />} 
                    onClick={() => onViewDetails(project)}
                    className="rounded-lg bg-gray-900 hover:bg-black border-none"
                  >
                    Ver Detalles
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty 
          description="No se encontraron proyectos" 
          className="py-20 bg-white rounded-2xl shadow-sm"
        />
      )}

      <Modal
        title={<Title level={4} className="m-0">Crear Nuevo Proyecto</Title>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        className="rounded-2xl overflow-hidden"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
          initialValues={{ status: ProjectStatus.ACTIVE }}
          className="mt-6"
        >
          <Form.Item 
            name="name" 
            label="Nombre del Proyecto" 
            rules={[{ required: true, message: 'Por favor ingresa el nombre' }]}
          >
            <Input placeholder="Ej. Nexus Core Platform" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item 
            name="description" 
            label="Descripción" 
            rules={[{ required: true, message: 'Por favor ingresa una descripción' }]}
          >
            <Input.TextArea rows={3} placeholder="Breve descripción del objetivo del proyecto" className="rounded-lg" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="version" 
                label="Versión del Sistema" 
                rules={[{ required: true, message: 'Ingresa la versión' }]}
              >
                <Input placeholder="v1.0.0" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Estado Inicial">
                <Select className="h-10 rounded-lg">
                  <Option value={ProjectStatus.ACTIVE}>Activo</Option>
                  <Option value={ProjectStatus.PAUSED}>Pausado</Option>
                  <Option value={ProjectStatus.COMPLETED}>Completado</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="teamMembers" label="Miembros del Equipo">
            <Select mode="multiple" placeholder="Selecciona miembros" className="rounded-lg">
              <Option value="user1">Juan Pérez (QA Lead)</Option>
              <Option value="user2">María García (QA Engineer)</Option>
              <Option value="user3">Carlos Ruiz (DevOps)</Option>
            </Select>
          </Form.Item>

          <div className="flex justify-end gap-3 mt-8">
            <Button onClick={() => setIsModalVisible(false)} className="rounded-lg h-10 px-6">
              Cancelar
            </Button>
            <Button type="primary" htmlType="submit" className="rounded-lg h-10 px-6 bg-emerald-600 border-none">
              Crear Proyecto
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectManagement;
