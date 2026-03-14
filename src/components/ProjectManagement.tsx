import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  EditOutlined,
  FolderOpenOutlined,
  MoreOutlined,
  PauseCircleFilled,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { appBranding } from '../assets/branding';
import { useProjects } from '../modules/projects/hooks/useProjects';
import { Project, ProjectStatus } from '../types';
import { qaBrand, qaPalette, softSurface } from '../theme/palette';

const { Title, Text, Paragraph } = Typography;

interface ProjectManagementProps {
  onViewDetails: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onOpenCreateModal: () => void;
}

const ALL_PROJECTS_FILTER = 'ALL';

type ProjectFilter = ProjectStatus | typeof ALL_PROJECTS_FILTER;

const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  [ProjectStatus.ACTIVE]: {
    label: 'Activo',
    color: qaPalette.functionalityStatus.completed,
    icon: <CheckCircleFilled />,
  },
  [ProjectStatus.PAUSED]: {
    label: 'Pausado',
    color: qaPalette.functionalityStatus.inProgress,
    icon: <PauseCircleFilled />,
  },
  [ProjectStatus.COMPLETED]: {
    label: 'Completado',
    color: qaPalette.primary,
    icon: <TrophyFilled />,
  },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function openProjectFromKeyboard(event: React.KeyboardEvent<HTMLDivElement>, onOpen: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onOpen();
}

export default function ProjectManagement({
  onViewDetails,
  onEditProject,
  onOpenCreateModal,
}: ProjectManagementProps) {
  const { data: projects = [] } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectFilter>(ALL_PROJECTS_FILTER);

  const projectMetrics = useMemo(() => {
    const activeProjects = projects.filter(
      project => project.status === ProjectStatus.ACTIVE,
    ).length;
    const completedProjects = projects.filter(
      project => project.status === ProjectStatus.COMPLETED,
    ).length;
    const distinctMembers = new Set(projects.flatMap(project => project.teamMembers || [])).size;
    const latestProject = [...projects].sort(
      (left, right) => dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf(),
    )[0];

    return {
      totalProjects: projects.length,
      activeProjects,
      completedProjects,
      distinctMembers,
      latestProject,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return projects.filter(project => {
      const workspaceName = (project.organizationName || project.name).toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        workspaceName.includes(normalizedSearch) ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.description.toLowerCase().includes(normalizedSearch) ||
        project.version.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === ALL_PROJECTS_FILTER || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const featuredProject = filteredProjects[0] || projectMetrics.latestProject || null;

  const filterOptions = [
    { label: 'Todos', value: ALL_PROJECTS_FILTER },
    { label: 'Activos', value: ProjectStatus.ACTIVE },
    { label: 'Pausados', value: ProjectStatus.PAUSED },
    { label: 'Completados', value: ProjectStatus.COMPLETED },
  ];

  return (
    <div className="relative overflow-hidden px-6 py-8 sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background: `
            radial-gradient(circle at 15% 15%, ${softSurface(qaPalette.accent)} 0%, transparent 34%),
            radial-gradient(circle at 85% 8%, ${softSurface(qaPalette.primary)} 0%, transparent 26%)
          `,
        }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 pb-10">
        <Card
          variant="borderless"
          className="qa-surface-card overflow-hidden rounded-[28px]"
          styles={{ body: { padding: 0 } }}
        >
          <div
            className="relative overflow-hidden rounded-[28px] p-6 sm:p-8"
            style={{
              background: `linear-gradient(135deg, ${qaPalette.card} 0%, ${softSurface(qaPalette.accent)} 100%)`,
            }}
          >
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl"
              style={{ backgroundColor: softSurface(qaPalette.primary) }}
            />

            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} xl={15}>
                <Space size={[8, 8]} wrap className="mb-4">
                  <Tag
                    variant="filled"
                    className="rounded-full px-3 py-1 font-semibold"
                    style={{
                      color: qaPalette.primary,
                      backgroundColor: softSurface(qaPalette.primary),
                    }}
                  >
                    {qaBrand.name}
                  </Tag>
                  <Tag
                    variant="filled"
                    className="rounded-full px-3 py-1 font-semibold"
                    style={{
                      color: qaPalette.accent,
                      backgroundColor: softSurface(qaPalette.accent),
                    }}
                  >
                    Ant Design Workspace
                  </Tag>
                </Space>

                <Title
                  level={1}
                  className="!mb-3 !text-3xl !font-bold !text-slate-900 sm:!text-5xl"
                >
                  Gestion de proyectos QA con identidad consistente y acceso claro.
                </Title>
                <Paragraph className="mb-0 max-w-3xl text-base text-slate-500 sm:text-lg">
                  Administra cada workspace con un layout mas solido, cards clicables de punta a
                  punta y un flujo de alta de proyecto construido con Ant Design.
                </Paragraph>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={onOpenCreateModal}
                    className="h-12 rounded-2xl px-6 text-base font-semibold"
                  >
                    Nuevo proyecto
                  </Button>
                  {featuredProject ? (
                    <Button
                      size="large"
                      icon={<ArrowRightOutlined />}
                      onClick={() => onViewDetails(featuredProject)}
                      className="h-12 rounded-2xl border-slate-200 px-6 text-base font-semibold"
                    >
                      Abrir ultimo workspace
                    </Button>
                  ) : null}
                </div>
              </Col>

              <Col xs={24} xl={9}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Card
                      variant="borderless"
                      className="h-full rounded-3xl"
                      styles={{ body: { padding: 20 } }}
                      style={{ backgroundColor: qaPalette.card }}
                    >
                      <Statistic
                        title={
                          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Workspaces
                          </span>
                        }
                        value={projectMetrics.totalProjects}
                        prefix={<AppstoreOutlined style={{ color: qaPalette.primary }} />}
                        styles={{ content: { color: qaPalette.primary, fontWeight: 700 } }}
                      />
                      <Text className="mt-2 block text-slate-500">
                        {projectMetrics.activeProjects} activos listos para seguimiento
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Card
                      variant="borderless"
                      className="h-full rounded-3xl"
                      styles={{ body: { padding: 20 } }}
                      style={{ backgroundColor: qaPalette.card }}
                    >
                      <Statistic
                        title={
                          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Colaboradores
                          </span>
                        }
                        value={projectMetrics.distinctMembers}
                        prefix={
                          <TeamOutlined
                            style={{ color: qaPalette.functionalityStatus.completed }}
                          />
                        }
                        styles={{
                          content: {
                            color: qaPalette.functionalityStatus.completed,
                            fontWeight: 700,
                          },
                        }}
                      />
                      <Text className="mt-2 block text-slate-500">
                        Participantes distintos registrados en el portfolio
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Card
                      variant="borderless"
                      className="rounded-3xl"
                      styles={{ body: { padding: 20 } }}
                      style={{
                        background: `linear-gradient(135deg, ${softSurface(qaPalette.primary)} 0%, ${qaPalette.card} 100%)`,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <Text className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            Ultimo workspace
                          </Text>
                          <Title level={4} className="!mb-1 !mt-2 !text-slate-900">
                            {featuredProject?.organizationName ||
                              featuredProject?.name ||
                              'Sin proyectos'}
                          </Title>
                          <Text className="text-slate-500">
                            {featuredProject
                              ? `Version ${featuredProject.version} - ${PROJECT_STATUS_META[featuredProject.status].label}`
                              : 'Crea el primer proyecto para comenzar.'}
                          </Text>
                        </div>

                        <Tag
                          variant="filled"
                          className="rounded-full px-3 py-1 font-semibold"
                          style={{
                            color: qaPalette.primary,
                            backgroundColor: qaPalette.card,
                          }}
                        >
                          {projectMetrics.completedProjects} completados
                        </Tag>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>
        </Card>

        <Card
          variant="borderless"
          className="qa-surface-card rounded-[28px]"
          styles={{ body: { padding: 24 } }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Title level={3} className="!mb-1 !text-slate-900">
                Portafolio de proyectos
              </Title>
              <Text className="text-slate-500">
                {filteredProjects.length} resultados visibles dentro de{' '}
                {projectMetrics.totalProjects} workspaces.
              </Text>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <Input
                allowClear
                size="large"
                placeholder="Buscar por nombre, descripcion o version..."
                prefix={<SearchOutlined className="text-slate-400" />}
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl sm:min-w-[340px]"
              />
              <Select
                size="large"
                value={statusFilter}
                onChange={value => setStatusFilter(value)}
                options={filterOptions}
                className="w-full rounded-2xl sm:min-w-[180px]"
              />
            </div>
          </div>
        </Card>

        {filteredProjects.length > 0 ? (
          <Row gutter={[24, 24]}>
            {filteredProjects.map(project => {
              const workspaceName = project.organizationName || project.name;
              const statusMeta = PROJECT_STATUS_META[project.status];
              const teamMemberCount = project.teamMembers?.length || 0;
              const menuItems: MenuProps['items'] = [
                {
                  key: 'open',
                  label: 'Abrir workspace',
                  icon: <FolderOpenOutlined />,
                },
                {
                  key: 'edit',
                  label: 'Editar proyecto',
                  icon: <EditOutlined />,
                },
              ];

              return (
                <Col xs={24} md={12} xl={8} key={project.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onViewDetails(project)}
                    onKeyDown={event =>
                      openProjectFromKeyboard(event, () => onViewDetails(project))
                    }
                    className="outline-none"
                    aria-label={`Abrir proyecto ${workspaceName}`}
                  >
                    <Card
                      hoverable
                      variant="borderless"
                      className="qa-surface-card h-full rounded-[28px] transition-transform duration-300 hover:-translate-y-1"
                      styles={{ body: { padding: 24 } }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {project.logo ? (
                            <Avatar
                              size={56}
                              shape="square"
                              src={project.logo}
                              className="border border-slate-100"
                            />
                          ) : (
                            <Avatar
                              size={56}
                              shape="square"
                              src={appBranding.logoUrl}
                              className="border border-slate-100"
                              style={{ borderRadius: 18 }}
                            >
                              {getInitials(workspaceName)}
                            </Avatar>
                          )}

                          <div className="flex flex-col gap-2">
                            <Tag
                              variant="filled"
                              className="m-0 w-fit rounded-full px-3 py-1 font-semibold"
                              style={{
                                color: statusMeta.color,
                                backgroundColor: softSurface(statusMeta.color),
                              }}
                            >
                              <span className="mr-2">{statusMeta.icon}</span>
                              {statusMeta.label}
                            </Tag>
                            <Tag
                              variant="filled"
                              className="m-0 w-fit rounded-full px-3 py-1 font-semibold text-slate-600"
                              style={{ backgroundColor: softSurface(qaPalette.border) }}
                            >
                              {project.version}
                            </Tag>
                          </div>
                        </div>

                        <Dropdown
                          trigger={['click']}
                          placement="bottomRight"
                          menu={{
                            items: menuItems,
                            onClick: info => {
                              info.domEvent.stopPropagation();
                              if (info.key === 'edit') {
                                onEditProject(project);
                                return;
                              }
                              onViewDetails(project);
                            },
                          }}
                        >
                          <Button
                            type="text"
                            icon={<MoreOutlined />}
                            onClick={event => event.stopPropagation()}
                            className="rounded-full text-slate-500"
                          />
                        </Dropdown>
                      </div>

                      <div className="mt-8 space-y-3">
                        <div>
                          <Title level={4} className="!mb-1 !text-slate-900">
                            {workspaceName}
                          </Title>
                          <Text className="text-slate-500">{project.name}</Text>
                        </div>

                        <Paragraph
                          ellipsis={{ rows: 3 }}
                          className="min-h-[66px] !text-sm !leading-6 !text-slate-500"
                        >
                          {project.description}
                        </Paragraph>
                      </div>

                      <div className="mt-8 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                          <Space size={8}>
                            <CalendarOutlined />
                            <span>{dayjs(project.createdAt).format('DD MMM YYYY')}</span>
                          </Space>
                          <Space size={8}>
                            <TeamOutlined />
                            <span>{teamMemberCount} miembros</span>
                          </Space>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center gap-3">
                        <Button
                          onClick={event => {
                            event.stopPropagation();
                            onEditProject(project);
                          }}
                          className="h-11 flex-1 rounded-2xl border-slate-200 font-semibold"
                        >
                          Editar
                        </Button>
                        <Button
                          type="primary"
                          icon={<ArrowRightOutlined />}
                          onClick={event => {
                            event.stopPropagation();
                            onViewDetails(project);
                          }}
                          className="h-11 flex-1 rounded-2xl font-semibold"
                        >
                          Abrir
                        </Button>
                      </div>
                    </Card>
                  </div>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Card
            variant="borderless"
            className="qa-surface-card rounded-[28px]"
            styles={{ body: { padding: 48 } }}
          >
            <Empty
              description="No se encontraron proyectos con los filtros actuales."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onOpenCreateModal}
                className="rounded-2xl px-5 font-semibold"
              >
                Crear proyecto
              </Button>
            </Empty>
          </Card>
        )}
      </div>
    </div>
  );
}
