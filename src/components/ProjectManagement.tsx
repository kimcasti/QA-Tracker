import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ProjectUpgradeBox } from '../modules/projects/components/ProjectUpgradeBox';
import { useProjects } from '../modules/projects/hooks/useProjects';
import {
  DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD,
  PROJECT_CREATION_ROLE_MESSAGE,
  getEffectiveProjectCount,
  getProjectLimitForPlan,
  hasReachedProjectLimit,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';
import { OrganizationTeamModal } from '../modules/organization-team/components/OrganizationTeamModal';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { renameActiveOrganization } from '../modules/workspace/services/workspaceService';
import { Project, ProjectStatus } from '../types';
import { qaBrand, qaPalette, softSurface } from '../theme/palette';

const { Title, Text, Paragraph } = Typography;

interface ProjectManagementProps {
  onViewDetails: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onOpenCreateModal: () => void;
}

const ALL_PROJECTS_FILTER = 'ALL';
const SELECTED_PROJECT_STORAGE_KEY = 'qa_tracker_selected_project_id';

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

function formatPlanLabel(plan: 'starter' | 'growth' | 'enterprise') {
  if (plan === 'growth') return 'Growth';
  if (plan === 'enterprise') return 'Enterprise';
  return 'Starter';
}

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

function WorkspaceMetricCard({
  title,
  value,
  subtitle,
  icon,
  valueColor,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  valueColor: string;
}) {
  return (
    <Card
      variant="borderless"
      className="h-full rounded-[24px] border border-slate-100/80 shadow-[0_16px_30px_rgba(15,35,95,0.06)]"
      styles={{ body: { padding: 20 } }}
      style={{ backgroundColor: qaPalette.card }}
    >
      <Statistic
        title={
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {title}
          </span>
        }
        value={value}
        prefix={icon}
        styles={{ content: { color: valueColor, fontWeight: 700 } }}
      />
      <Text className="mt-2 block text-sm leading-6 text-slate-500">{subtitle}</Text>
    </Card>
  );
}

export default function ProjectManagement({
  onViewDetails,
  onEditProject,
  onOpenCreateModal,
}: ProjectManagementProps) {
  const { data: projects = [] } = useProjects();
  const {
    activeMembership,
    isViewer,
    canManageCycleConfig,
    canCreateProjectsByRole,
    projectQuota,
  } = useWorkspaceAccess();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectFilter>(ALL_PROJECTS_FILTER);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isEditOrganizationModalOpen, setIsEditOrganizationModalOpen] = useState(false);
  const [organizationForm] = Form.useForm<{ name: string }>();

  const activeOrganization = activeMembership?.organization;
  const canEditOrganization = canManageCycleConfig;
  const activeOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.plan || activeOrganization?.plan,
  );
  const projectLimitValue =
    typeof projectQuota?.limit === 'number'
      ? projectQuota.limit
      : getProjectLimitForPlan(activeOrganizationPlan);
  const upgradePriceMonthlyUsd =
    projectQuota?.upgradePriceMonthlyUsd ?? DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD;
  const effectiveProjectCount = useMemo(
    () =>
      getEffectiveProjectCount({
        currentCount: projectQuota?.currentCount,
        visibleProjectsCount: projects.length,
      }),
    [projectQuota?.currentCount, projects.length],
  );
  const projectLimitReached = hasReachedProjectLimit({
    limit: projectLimitValue,
    currentCount: projectQuota?.currentCount,
    visibleProjectsCount: projects.length,
  });
  const canCreateProjectsInUi =
    canCreateProjectsByRole &&
    (projectQuota?.canCreate ?? canCreateProjectsByRole) &&
    !projectLimitReached;
  const showProjectUpgradeBox =
    canCreateProjectsByRole &&
    projectLimitReached &&
    projectLimitValue !== null &&
    upgradePriceMonthlyUsd > 0;

  const renameOrganizationMutation = useMutation({
    mutationFn: renameActiveOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      message.success('Nombre de la organizacion actualizado');
      setIsEditOrganizationModalOpen(false);
    },
  });

  useEffect(() => {
    if (!isEditOrganizationModalOpen) return;
    organizationForm.setFieldValue('name', activeOrganization?.name || '');
  }, [activeOrganization?.name, isEditOrganizationModalOpen, organizationForm]);

  const projectMetrics = useMemo(() => {
    const activeProjects = projects.filter(
      project => project.status === ProjectStatus.ACTIVE,
    ).length;
    const distinctMembers = new Set(projects.flatMap(project => project.teamMembers || [])).size;

    return {
      totalProjects: projects.length,
      activeProjects,
      distinctMembers,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return projects.filter(project => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.description.toLowerCase().includes(normalizedSearch) ||
        project.version.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === ALL_PROJECTS_FILTER || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const workspaceProjectDocumentId = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const selectedProjectId = window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
    if (!selectedProjectId) return null;

    return projects.find(project => project.id === selectedProjectId)?.id || null;
  }, [projects, isTeamModalOpen]);

  const handleSaveOrganizationName = async () => {
    try {
      const values = await organizationForm.validateFields();
      await renameOrganizationMutation.mutateAsync(values.name);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }

      message.error('No se pudo actualizar el nombre de la organizacion');
    }
  };

  const filterOptions = [
    { label: 'Todos', value: ALL_PROJECTS_FILTER },
    { label: 'Activos', value: ProjectStatus.ACTIVE },
    { label: 'Pausados', value: ProjectStatus.PAUSED },
    { label: 'Completados', value: ProjectStatus.COMPLETED },
  ];

  const upgradeCurrentCount = Math.max(
    effectiveProjectCount,
    projectLimitValue ?? effectiveProjectCount,
  );

  return (
    <div className="relative min-h-full overflow-hidden px-6 py-8 sm:px-8">
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

            <div className="relative flex flex-col gap-8">
              <Space size={[8, 8]} wrap>
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
                  Organizacion y proyectos
                </Tag>
              </Space>

              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.95fr)]">
                <div className="flex flex-col gap-6">
                  <div>
                    <Title
                      level={1}
                      className="!mb-3 !max-w-4xl !text-3xl !font-bold !leading-[1.05] !text-slate-900 sm:!text-5xl"
                    >
                      Gestion de proyectos QA con identidad consistente y acceso claro.
                    </Title>
                    <Paragraph className="mb-0 max-w-3xl text-base text-slate-500 sm:text-lg">
                      Administra el portfolio, el equipo y el estado del plan desde una vista mas
                      clara y ordenada.
                    </Paragraph>
                  </div>

                  {isViewer ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3">
                      <Space size={[8, 8]} wrap>
                        <Tag color="default" className="rounded-full px-3 py-1 font-semibold">
                          Solo lectura
                        </Tag>
                        <Text className="text-slate-500">
                          Tu rol Viewer puede consultar proyectos y metricas, pero no crear ni
                          editar.
                        </Text>
                      </Space>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlusOutlined />}
                      onClick={onOpenCreateModal}
                      disabled={!canCreateProjectsInUi}
                      className="h-12 rounded-2xl px-6 text-base font-semibold"
                    >
                      Nuevo proyecto
                    </Button>
                    {!isViewer ? (
                      <Button
                        size="large"
                        icon={<TeamOutlined />}
                        onClick={() => setIsTeamModalOpen(true)}
                        className="h-12 rounded-2xl px-6 text-base font-semibold"
                      >
                        Gestionar equipo de trabajo
                      </Button>
                    ) : null}
                  </div>

                  {!canCreateProjectsByRole ? (
                    <Text className="block text-sm text-slate-500">
                      {PROJECT_CREATION_ROLE_MESSAGE}
                    </Text>
                  ) : null}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_35px_rgba(16,42,67,0.08)] backdrop-blur-sm">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col xl:items-stretch 2xl:flex-row 2xl:items-start">
                        <div>
                          <Text className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            Organizacion activa
                          </Text>
                          <Title level={3} className="!mb-1 !mt-2 !text-slate-900">
                            {activeOrganization?.name || 'Organizacion actual'}
                          </Title>
                          <Space size={[8, 8]} wrap className="mt-3">
                            <Tag
                              variant="filled"
                              className="rounded-full px-3 py-1 font-semibold"
                              style={{
                                color: qaPalette.primary,
                                backgroundColor: softSurface(qaPalette.primary),
                              }}
                            >
                              Plan {formatPlanLabel(activeOrganizationPlan)}
                            </Tag>
                            {activeMembership?.role?.name ? (
                              <Tag
                                variant="filled"
                                className="rounded-full px-3 py-1 font-semibold"
                                style={{
                                  color: qaPalette.secondary,
                                  backgroundColor: softSurface(qaPalette.border),
                                }}
                              >
                                {activeMembership.role.name}
                              </Tag>
                            ) : null}
                          </Space>
                        </div>

                        <Button
                          icon={<EditOutlined />}
                          onClick={() => setIsEditOrganizationModalOpen(true)}
                          disabled={!canEditOrganization}
                          className="h-11 rounded-2xl px-5 font-semibold"
                        >
                          Editar organizacion
                        </Button>
                      </div>

                      <Text className="text-sm leading-6 text-slate-500">
                        Centraliza el equipo, los proyectos y la configuracion principal del
                        workspace desde un solo bloque.
                      </Text>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <WorkspaceMetricCard
                      title="Proyectos"
                      value={projectMetrics.totalProjects}
                      subtitle={`${projectMetrics.activeProjects} activos listos para seguimiento`}
                      icon={<AppstoreOutlined style={{ color: qaPalette.primary }} />}
                      valueColor={qaPalette.primary}
                    />
                    <WorkspaceMetricCard
                      title="Colaboradores"
                      value={projectMetrics.distinctMembers}
                      subtitle="Participantes distintos registrados en el portfolio"
                      icon={
                        <TeamOutlined style={{ color: qaPalette.functionalityStatus.completed }} />
                      }
                      valueColor={qaPalette.functionalityStatus.completed}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {showProjectUpgradeBox ? (
          <ProjectUpgradeBox
            organizationName={activeOrganization?.name}
            currentCount={upgradeCurrentCount}
            limit={projectLimitValue}
            upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
          />
        ) : null}

        <Card
          variant="borderless"
          className="qa-surface-card rounded-[28px]"
          styles={{ body: { padding: 24 } }}
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <Title level={3} className="!mb-1 !text-slate-900">
                {activeOrganization?.name || 'Organizacion actual'}
              </Title>
              <Text className="text-slate-500">
                {filteredProjects.length} proyecto{filteredProjects.length === 1 ? '' : 's'} visibles
                {searchTerm || statusFilter !== ALL_PROJECTS_FILTER
                  ? ' con los filtros actuales.'
                  : ' en este portfolio.'}
              </Text>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
              <Input
                allowClear
                size="large"
                placeholder="Buscar por nombre del proyecto, descripcion o version..."
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
              const statusMeta = PROJECT_STATUS_META[project.status];
              const teamMemberCount = project.teamMembers?.length || 0;
              const menuItems: MenuProps['items'] = [
                {
                  key: 'open',
                  label: 'Abrir proyecto',
                  icon: <FolderOpenOutlined />,
                },
                ...(!isViewer
                  ? [
                      {
                        key: 'edit',
                        label: 'Editar proyecto',
                        icon: <EditOutlined />,
                      },
                    ]
                  : []),
              ];

              return (
                <Col xs={24} md={12} xl={8} key={project.id} className="flex">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onViewDetails(project)}
                    onKeyDown={event =>
                      openProjectFromKeyboard(event, () => onViewDetails(project))
                    }
                    className="h-full w-full outline-none"
                    aria-label={`Abrir proyecto ${project.name}`}
                  >
                    <Card
                      hoverable
                      variant="borderless"
                      className="qa-surface-card h-[430px] w-full rounded-[28px] border border-slate-100/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_rgba(16,42,67,0.08)]"
                      styles={{
                        body: {
                          padding: 24,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                        },
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-4">
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
                              {getInitials(project.name)}
                            </Avatar>
                          )}

                          <div className="flex min-w-0 flex-col gap-2">
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
                              if (info.key === 'edit' && !isViewer) {
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

                      <div className="mt-7 flex-1 overflow-hidden">
                        <div className="space-y-1">
                          <Paragraph
                            ellipsis={{ rows: 2, tooltip: project.name }}
                            className="!mb-1 !text-xl !font-semibold !leading-8 !text-slate-900"
                          >
                            {project.name}
                          </Paragraph>
                          <Paragraph
                            ellipsis={{
                              rows: 1,
                              tooltip: project.purpose || 'Proyecto QA de la organizacion actual',
                            }}
                            className="!mb-0 !text-sm !leading-6 !text-slate-500"
                          >
                            {project.purpose || 'Proyecto QA de la organizacion actual'}
                          </Paragraph>
                        </div>

                        <Paragraph
                          ellipsis={{ rows: 4, tooltip: project.description }}
                          className="!mb-0 min-h-[96px] !text-sm !leading-6 !text-slate-500"
                        >
                          {project.description}
                        </Paragraph>
                      </div>

                      <div className="mt-6 rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
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
              {!isViewer ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={onOpenCreateModal}
                  disabled={!canCreateProjectsInUi}
                  className="rounded-2xl px-5 font-semibold"
                >
                  Crear proyecto
                </Button>
              ) : null}
            </Empty>
          </Card>
        )}
      </div>

      <OrganizationTeamModal
        open={isTeamModalOpen}
        onCancel={() => setIsTeamModalOpen(false)}
        workspaceProjectDocumentId={workspaceProjectDocumentId}
      />

      <Modal
        open={isEditOrganizationModalOpen}
        title="Editar organizacion"
        onOk={handleSaveOrganizationName}
        onCancel={() => setIsEditOrganizationModalOpen(false)}
        okText="Guardar cambios"
        cancelText="Cancelar"
        confirmLoading={renameOrganizationMutation.isPending}
        destroyOnHidden
      >
        <Form form={organizationForm} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Nombre de la organizacion"
            rules={[{ required: true, message: 'Ingresa el nombre de la organizacion.' }]}
          >
            <Input size="large" placeholder="Ej. Laboratorio QA" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
