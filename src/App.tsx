import { Layout, Menu, Input, Badge, Avatar, Space, Button, Typography } from 'antd';
import {
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
  CalendarOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import CreateProjectModal from './components/CreateProjectModal';
import StoryMapPage from './modules/storymap/components/StoryMapPage';
import type { Project } from './types';
import { useProjects } from './hooks';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { qaBrand } from './theme/palette';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

type WorkspaceViewKey =
  | 'dashboard'
  | 'functionalities'
  | 'storymap'
  | 'testing'
  | 'plans'
  | 'regression_cycles'
  | 'smoke_cycles'
  | 'reports'
  | 'coverage'
  | 'config'
  | 'about';

type ParsedRoute =
  | { type: 'projects' }
  | { type: 'edit'; projectId: string }
  | { type: 'workspace'; projectId: string; scene: string }
  | { type: 'legacy_workspace'; scene: string }
  | { type: 'unknown' };

const SELECTED_PROJECT_STORAGE_KEY = 'qa_tracker_selected_project_id';

const WORKSPACE_VIEW_TO_PATH: Record<WorkspaceViewKey, string> = {
  dashboard: 'dashboard',
  functionalities: 'functionalities',
  storymap: 'story-map',
  testing: 'testing',
  plans: 'plans',
  regression_cycles: 'regression-cycles',
  smoke_cycles: 'smoke-cycles',
  reports: 'reports',
  coverage: 'coverage',
  config: 'config',
  about: 'about',
};

const SCENE_TO_WORKSPACE_VIEW: Record<string, WorkspaceViewKey> = {
  dashboard: 'dashboard',
  functionalities: 'functionalities',
  storymap: 'storymap',
  'story-map': 'storymap',
  testing: 'testing',
  plans: 'plans',
  regression_cycles: 'regression_cycles',
  'regression-cycles': 'regression_cycles',
  smoke_cycles: 'smoke_cycles',
  'smoke-cycles': 'smoke_cycles',
  reports: 'reports',
  coverage: 'coverage',
  config: 'config',
  about: 'about',
};

function routeForProjectWorkspace(projectId: string, view: WorkspaceViewKey) {
  return `/projects/${encodeURIComponent(projectId)}/${WORKSPACE_VIEW_TO_PATH[view]}`;
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRoute(pathname: string): ParsedRoute {
  if (pathname === '/' || pathname === '') {
    return { type: 'projects' };
  }

  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  const editMatch = normalized.match(/^\/edit-project\/([^/]+)$/);
  if (editMatch) {
    return { type: 'edit', projectId: decodePathSegment(editMatch[1]) };
  }

  const workspaceMatch = normalized.match(/^\/projects\/([^/]+)\/([^/]+)$/);
  if (workspaceMatch) {
    return {
      type: 'workspace',
      projectId: decodePathSegment(workspaceMatch[1]),
      scene: decodePathSegment(workspaceMatch[2]),
    };
  }

  const singleSegmentMatch = normalized.match(/^\/([^/]+)$/);
  if (singleSegmentMatch) {
    return { type: 'legacy_workspace', scene: decodePathSegment(singleSegmentMatch[1]) };
  }

  return { type: 'unknown' };
}

function renderWorkspaceContent(view: WorkspaceViewKey, currentProject: Project) {
  switch (view) {
    case 'dashboard':
      return <Dashboard projectId={currentProject.id} />;
    case 'coverage':
      return <CoverageMatrix projectId={currentProject.id} />;
    case 'regression_cycles':
      return <RegressionCycles projectId={currentProject.id} />;
    case 'smoke_cycles':
      return <SmokeCycles projectId={currentProject.id} />;
    case 'functionalities':
      return <FunctionalityList projectId={currentProject.id} />;
    case 'storymap':
      return <StoryMapPage projectId={currentProject.id} />;
    case 'testing':
      return <TestExecutionView projectId={currentProject.id} />;
    case 'plans':
      return <TestPlanView projectId={currentProject.id} />;
    case 'reports':
      return <Reports projectId={currentProject.id} />;
    case 'config':
      return <Settings projectId={currentProject.id} />;
    case 'about':
      return <AboutView project={currentProject} />;
    default:
      return <Dashboard projectId={currentProject.id} />;
  }
}

function getPersistedProjectId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
}

export default function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: projects = [], isLoading: isProjectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(getPersistedProjectId);
  const [collapsed, setCollapsed] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  const currentProject = useMemo(
    () => projects.find(project => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const parsedRoute = useMemo(() => parseRoute(location.pathname), [location.pathname]);

  useEffect(() => {
    if (!selectedProjectId || projects.length === 0) return;
    const projectExists = projects.some(project => project.id === selectedProjectId);
    if (!projectExists) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedProjectId) {
      window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (parsedRoute.type !== 'workspace') return;
    if (!parsedRoute.projectId) return;
    if (selectedProjectId === parsedRoute.projectId) return;
    setSelectedProjectId(parsedRoute.projectId);
  }, [parsedRoute, selectedProjectId]);

  const workspaceMenuItems = useMemo(
    () => [
      { key: 'dashboard', icon: <AppstoreOutlined />, label: t('nav.dashboard') },
      { key: 'functionalities', icon: <DatabaseOutlined />, label: t('nav.functionalities') },
      { key: 'storymap', icon: <ApartmentOutlined />, label: t('nav.storymap') },
      { key: 'testing', icon: <CheckCircleOutlined />, label: t('nav.testing') },
      { key: 'plans', icon: <CalendarOutlined />, label: t('nav.plans') },
      { key: 'regression_cycles', icon: <HistoryOutlined />, label: t('nav.regression') },
      { key: 'smoke_cycles', icon: <ThunderboltOutlined />, label: t('nav.smoke') },
      { key: 'reports', icon: <BarChartOutlined />, label: t('nav.reports') },
      { key: 'coverage', icon: <DatabaseOutlined />, label: t('nav.coverage') },
      { key: 'config', icon: <SettingOutlined />, label: t('nav.config') },
      { key: 'about', icon: <InfoCircleOutlined />, label: t('nav.about') },
    ],
    [t]
  );

  const handleViewProject = (project: Project) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, project.id);
    }
    flushSync(() => {
      setSelectedProjectId(project.id);
    });
    navigate(routeForProjectWorkspace(project.id, 'dashboard'));
  };

  const handleEditProject = (project: Project) => {
    navigate(`/edit-project/${encodeURIComponent(project.id)}`);
  };

  const handleBackToProjects = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
    }
    flushSync(() => {
      setSelectedProjectId(null);
    });
    navigate('/');
  };

  const projectsScreen = (
    <Layout className="min-h-screen bg-slate-50">
      <Header className="bg-white px-6 h-16 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-md">
            <ProjectOutlined className="text-white text-lg" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-slate-800">{qaBrand.name}</span>
            <span className="text-[11px] text-slate-500">{qaBrand.tagline}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher size="small" />
          <Avatar src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
          <Text strong>Admin User</Text>
        </div>
      </Header>
      <Content>
        <ProjectManagement
          onViewDetails={handleViewProject}
          onEditProject={handleEditProject}
          onOpenCreateModal={() => setIsCreateProjectModalOpen(true)}
        />
      </Content>
      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onCancel={() => setIsCreateProjectModalOpen(false)}
      />
    </Layout>
  );

  if (parsedRoute.type === 'projects') {
    return projectsScreen;
  }

  if (parsedRoute.type === 'edit') {
    const project = projects.find(current => current.id === parsedRoute.projectId);

    if (!project && isProjectsLoading) return null;
    if (!project) return <Navigate to="/" replace />;

    return (
      <>
        <Layout className="min-h-screen bg-slate-50">
          <EditProject
            project={project}
            onCancel={() => navigate('/')}
            onSave={() => navigate('/')}
          />
        </Layout>
        <CreateProjectModal
          open={isCreateProjectModalOpen}
          onCancel={() => setIsCreateProjectModalOpen(false)}
        />
      </>
    );
  }

  if (parsedRoute.type === 'legacy_workspace') {
    const workspaceView = SCENE_TO_WORKSPACE_VIEW[parsedRoute.scene];
    if (!workspaceView) return <Navigate to="/" replace />;
    if (!currentProject && isProjectsLoading) return null;
    if (!currentProject) return <Navigate to="/" replace />;
    return <Navigate to={routeForProjectWorkspace(currentProject.id, workspaceView)} replace />;
  }

  if (parsedRoute.type === 'workspace') {
    const workspaceView = SCENE_TO_WORKSPACE_VIEW[parsedRoute.scene];
    const routedProject = projects.find(project => project.id === parsedRoute.projectId) || null;

    if (!workspaceView) {
      return (
        <Navigate
          to={routedProject ? routeForProjectWorkspace(routedProject.id, 'dashboard') : '/'}
          replace
        />
      );
    }

    if (!routedProject && isProjectsLoading) return null;
    if (!routedProject) return <Navigate to="/" replace />;

    const isStoryMapView = workspaceView === 'storymap';

    return (
      <>
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
                {routedProject.logo ? (
                  <Avatar src={routedProject.logo} className="border border-slate-100" />
                ) : (
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                    <ProjectOutlined className="text-white text-sm" />
                  </div>
                )}
                <div className="flex flex-col">
                  <Text strong className="leading-none">
                    {routedProject.organizationName || routedProject.name}
                  </Text>
                  <Text type="secondary" className="text-[10px] uppercase tracking-wider">
                    {routedProject.version}
                  </Text>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder={t('app.search_workspace')}
                className="w-64 bg-slate-50 border-none rounded-lg h-10"
              />
              <Space size={20}>
                <Badge dot color="blue">
                  <BellOutlined className="text-xl text-slate-500 cursor-pointer hover:text-blue-600 transition-colors" />
                </Badge>
                <SettingOutlined className="text-xl text-slate-500 cursor-pointer hover:text-blue-600 transition-colors" />
                <LanguageSwitcher size="small" />
              </Space>
            </div>
          </Header>

          <Layout>
            <Sider
              width={260}
              collapsible
              collapsed={collapsed}
              onCollapse={value => setCollapsed(value)}
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
                      <span className="font-bold text-slate-800 leading-none truncate">{qaBrand.workspaceLabel}</span>
                      <span className="text-[10px] text-slate-400 font-medium truncate">{routedProject.name}</span>
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
                  selectedKeys={[workspaceView]}
                  items={workspaceMenuItems}
                  onClick={({ key }) => {
                    const view = key as WorkspaceViewKey;
                    navigate(routeForProjectWorkspace(routedProject.id, view));
                  }}
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
                      {t('app.exit_project')}
                    </Button>
                  </div>
                )}
              </div>
            </Sider>
            <Content className={`${isStoryMapView ? 'p-4' : 'p-8'} overflow-auto`}>
              <div className={isStoryMapView ? 'w-full' : 'max-w-7xl mx-auto'}>
                {renderWorkspaceContent(workspaceView, routedProject)}
              </div>
            </Content>
          </Layout>
        </Layout>
        <CreateProjectModal
          open={isCreateProjectModalOpen}
          onCancel={() => setIsCreateProjectModalOpen(false)}
        />
      </>
    );
  }

  return <Navigate to="/" replace />;
}
