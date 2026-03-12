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
  CalendarOutlined,
  ArrowRightOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useProjects } from '../hooks';
import { Project, ProjectStatus } from '../types';
import dayjs from 'dayjs';
import { Dropdown, MenuProps } from 'antd';

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

  const handleCreateProject = async (values: any) => {
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
    
    console.log('Payload - Create Project:', newProject);
    try {
      await saveProject(newProject);
      message.success('Proyecto creado con éxito');
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Error creating project:', error);
      message.error('Error al crear el proyecto');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

      <div className="flex gap-4 mb-8 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <Input 
          placeholder="Buscar proyectos por nombre o descripción..." 
          prefix={<SearchOutlined className="text-gray-400" />} 
          variant="borderless"
          className="flex-1 h-10"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredProjects.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredProjects.map(project => {
            const items: MenuProps['items'] = [
              {
                key: 'edit',
                label: 'Editar Proyecto',
                icon: <EditOutlined />,
                onClick: (e) => {
                  e.domEvent.stopPropagation();
                  onEditProject(project);
                }
              }
            ];

            return (
              <Col xs={24} sm={12} lg={8} key={project.id}>
                <Card 
                  hoverable 
                  onClick={() => onViewDetails(project)}
                  className="rounded-xl overflow-hidden border-none shadow-sm hover:shadow-lg transition-all duration-300 group"
                  bodyStyle={{ padding: '24px' }}
                >
                  <div className="flex justify-between items-start mb-6">
                    {project.logo ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden shadow-sm border border-gray-100">
                        <img src={project.logo} alt={project.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {getInitials(project.organizationName || project.name)}
                      </div>
                    )}
                    <Dropdown menu={{ items }} trigger={['click']}>
                      <Button 
                        type="text" 
                        icon={<MoreOutlined className="text-gray-400" />} 
                        onClick={(e) => e.stopPropagation()}
                        className="hover:bg-gray-100 rounded-full"
                      />
                    </Dropdown>
                  </div>

                  <Title level={4} className="mb-2 group-hover:text-emerald-600 transition-colors">
                    {project.organizationName || project.name}
                  </Title>
                  
                  <Paragraph ellipsis={{ rows: 2 }} className="text-gray-400 mb-8 text-sm h-10">
                    {project.description}
                  </Paragraph>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-gray-300 text-xs">
                        <CalendarOutlined />
                        <span>{dayjs(project.createdAt).format('D MMM YYYY')}</span>
                      </div>
                      <Tag className="m-0 rounded-md bg-gray-50 border-gray-100 text-gray-500 font-medium text-[10px] px-2">
                        {project.version}
                      </Tag>
                    </div>
                    
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${project.status === ProjectStatus.ACTIVE ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-300'}`}>
                      <ArrowRightOutlined className="text-xs" />
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
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
