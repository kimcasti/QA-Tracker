import { Layout, Menu, Input, Badge, Avatar, Space, Button, Card, Typography } from 'antd';
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
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import Dashboard from './components/Dashboard';
import FunctionalityList from './components/FunctionalityList';
import TestExecutionView from './components/TestExecutionView';
import RegressionCycles from './components/RegressionCycles';

const { Header, Content, Sider } = Layout;
const { Title, Paragraph } = Typography;

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { key: 'dashboard', icon: <AppstoreOutlined />, label: 'Dashboard' },
    { key: 'regression_cycles', icon: <HistoryOutlined />, label: 'Control de Regresión' },
    { key: 'functionalities', icon: <DatabaseOutlined />, label: 'Funcionalidades' },
    { key: 'testing', icon: <CheckCircleOutlined />, label: 'Ejecución de Pruebas' },
    { key: 'plans', icon: <DatabaseOutlined />, label: 'Planes de Prueba' },
    { key: 'defects', icon: <ThunderboltOutlined />, label: 'Defectos' },
    { key: 'config', icon: <SettingOutlined />, label: 'Configuración' },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'regression_cycles': return <RegressionCycles />;
      case 'functionalities': return <FunctionalityList />;
      case 'regression': return <FunctionalityList filter="regression" />;
      case 'smoke': return <FunctionalityList filter="smoke" />;
      case 'testing': return <TestExecutionView />;
      case 'plans': return <Card className="rounded-2xl border-slate-100 shadow-sm"><Title level={3}>Planes de Prueba</Title><Paragraph>Próximamente...</Paragraph></Card>;
      case 'defects': return <Card className="rounded-2xl border-slate-100 shadow-sm"><Title level={3}>Defectos</Title><Paragraph>Próximamente...</Paragraph></Card>;
      case 'config': return <Card className="rounded-2xl border-slate-100 shadow-sm"><Title level={3}>Configuración</Title><Paragraph>Próximamente...</Paragraph></Card>;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Header className="bg-white px-6 h-16 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="text-slate-400 font-medium text-sm">QA Enterprise Division</div>
        </div>

        <div className="flex items-center gap-6">
          <Input 
            prefix={<SearchOutlined className="text-slate-400" />} 
            placeholder="Buscar métricas..." 
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
                  <span className="font-bold text-slate-800 leading-none truncate">QA Manager</span>
                  <span className="text-[10px] text-slate-400 font-medium truncate">Admin System</span>
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
              selectedKeys={[currentView]}
              items={menuItems}
              onClick={({ key }) => setCurrentView(key)}
              className="bg-transparent border-none executive-menu"
            />
            
            {!collapsed && (
              <div className="px-4 py-6 border-t border-slate-100 mx-2">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <Avatar 
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
                    className="border-2 border-white shadow-sm"
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-bold text-slate-800 truncate">Admin User</span>
                    <span className="text-[10px] text-slate-500 truncate">admin@company.com</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Sider>
        <Content className="p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
