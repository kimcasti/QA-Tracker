import { Layout, Menu, Input, Badge, Avatar, Space, Button, Card, Typography, Divider } from 'antd';
import { 
  DashboardOutlined, 
  DatabaseOutlined, 
  CheckCircleOutlined, 
  SettingOutlined,
  BellOutlined,
  SearchOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  BarChartOutlined,
  ArrowLeftOutlined,
  ProjectOutlined,
  InfoCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import Dashboard from './components/Dashboard';
import FunctionalityList from './components/FunctionalityList';
import TestExecutionView from './components/TestExecutionView';
import RegressionCycles from './components/RegressionCycles';
import SmokeCycles from './components/SmokeCycles';
import TestPlanView from './components/TestPlanView';
import Reports from './components/Reports';
import CoverageMatrix from './components/CoverageMatrix';
import ProjectManagement from './components/ProjectManagement';
import EditProject from './components/EditProject';
import Settings from './components/Settings';
import AboutView from './components/AboutView';
import { Project } from './types';

import { useProjects } from './hooks';

const { Header, Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

export default function App() {
  const { data: projects = [] } = useProjects();
  const [view, setView] = useState<'projects' | 'workspace' | 'edit_project'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [currentWorkspaceView, setCurrentWorkspaceView] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const currentProject = projects.find(p => p.id === selectedProjectId) || null;

  const workspaceMenuItems = [
    { key: 'dashboard', icon: <AppstoreOutlined />, label: 'Dashboard' },
    { key: 'functionalities', icon: <DatabaseOutlined />, label: 'Funcionalidades' },
    { key: 'testing', icon: <CheckCircleOutlined />, label: 'Ejecución de Pruebas' },
    { key: 'plans', icon: <CalendarOutlined />, label: 'Planes de Prueba' },
    { key: 'regression_cycles', icon: <HistoryOutlined />, label: 'Control de Regresión' },
    { key: 'smoke_cycles', icon: <ThunderboltOutlined />, label: 'Control de Smoke' },
    { key: 'reports', icon: <BarChartOutlined />, label: 'Reportes' },
    { key: 'coverage', icon: <DatabaseOutlined />, label: 'Matriz de cobertura' },
    { key: 'config', icon: <SettingOutlined />, label: 'Configuración' },
    { key: 'about', icon: <InfoCircleOutlined />, label: 'Acerca de' },
  ];

  const handleViewDetails = (project: Project) => {
    setSelectedProjectId(project.id);
    setView('workspace');
    setCurrentWorkspaceView('dashboard');
  };

  const handleEditProject = (project: Project) => {
    setProjectToEdit(project);
    setView('edit_project');
  };

  const handleBackToProjects = () => {
    setView('projects');
    setSelectedProjectId(null);
  };

  const renderWorkspaceContent = () => {
    if (!currentProject) return null;
    
    switch (currentWorkspaceView) {
      case 'dashboard': return <Dashboard projectId={currentProject.id} />;
      case 'coverage': return <CoverageMatrix projectId={currentProject.id} />;
      case 'regression_cycles': return <RegressionCycles projectId={currentProject.id} />;
      case 'smoke_cycles': return <SmokeCycles projectId={currentProject.id} />;
      case 'functionalities': return <FunctionalityList projectId={currentProject.id} />;
      case 'testing': return <TestExecutionView projectId={currentProject.id} />;
      case 'plans': return <TestPlanView projectId={currentProject.id} />;
      case 'reports': return <Reports projectId={currentProject.id} />;
      case 'config': return <Settings projectId={currentProject.id} />;
      case 'about': return <AboutView project={currentProject} />;
      default: return <Dashboard projectId={currentProject.id} />;
    }
  };

  if (view === 'projects') {
    return (
      <Layout className="min-h-screen bg-slate-50">
        <Header className="bg-white px-6 h-16 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-md">
              <ProjectOutlined className="text-white text-lg" />
            </div>
            <div className="font-bold text-slate-800">QA Multi-Project Manager</div>
          </div>
          <div className="flex items-center gap-4">
            <Avatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
            <Text strong>Admin User</Text>
          </div>
        </Header>
        <Content>
          <ProjectManagement onViewDetails={handleViewDetails} onEditProject={handleEditProject} />
        </Content>
      </Layout>
    );
  }

  if (view === 'edit_project' && projectToEdit) {
    return (
      <Layout className="min-h-screen bg-slate-50">
        <EditProject 
          project={projectToEdit} 
          onCancel={() => setView('projects')} 
          onSave={() => setView('projects')} 
        />
      </Layout>
    );
  }

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Header className="bg-white px-6 h-16 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBackToProjects}
            className="border-none hover:bg-gray-100 rounded-lg"
          />
          <div className="h-6 w-[1px] bg-gray-200 mx-2" />
          <div className="flex items-center gap-3">
            {currentProject?.logo ? (
              <Avatar src={currentProject.logo} className="border border-slate-100" />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <ProjectOutlined className="text-white text-sm" />
              </div>
            )}
            <div className="flex flex-col">
              <Text strong className="leading-none">{currentProject?.organizationName || currentProject?.name}</Text>
              <Text type="secondary" className="text-[10px] uppercase tracking-wider">{currentProject?.version}</Text>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Input 
            prefix={<SearchOutlined className="text-slate-400" />} 
            placeholder="Buscar en el espacio..." 
            className="w-64 bg-slate-50 border-none rounded-lg h-10"
          />
          <Space size={20}>
            <Badge dot color="blue">
              <BellOutlined className="text-xl text-slate-500 cursor-pointer hover:text-blue-600 transition-colors" />
            </Badge>
            <SettingOutlined className="text-xl text-slate-500 cursor-pointer hover:text-blue-600 transition-colors" />
          </Space>
        </div>
      </Header>
      
      <Layout>
        <Sider
          width={260}
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          trigger={null}
          theme="light"
          className="bg-white border-r border-slate-100"
        >
          <div className={`px-4 py-6 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 min-w-[32px] bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <CheckCircleOutlined className="text-white text-lg" />
              </div>
              {!collapsed && (
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-slate-800 leading-none truncate">QA Workspace</span>
                  <span className="text-[10px] text-slate-400 font-medium truncate">{currentProject?.name}</span>
                </div>
              )}
            </div>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center"
            />
          </div>
          
          <div className="py-2 h-[calc(100%-80px)] flex flex-col justify-between">
            <Menu
              mode="inline"
              selectedKeys={[currentWorkspaceView]}
              items={workspaceMenuItems}
              onClick={({ key }) => setCurrentWorkspaceView(key)}
              className="bg-transparent border-none executive-menu"
            />
            
            {!collapsed && (
              <div className="px-4 py-6 border-t border-slate-100 mx-2 space-y-4">
                <Button 
                  type="text" 
                  danger 
                  icon={<LogoutOutlined />} 
                  onClick={handleBackToProjects}
                  className="w-full flex items-center justify-start h-10 rounded-xl font-medium hover:bg-red-50"
                >
                  Salir del Proyecto
                </Button>
              </div>
            )}
          </div>
        </Sider>
        <Content className="p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderWorkspaceContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
