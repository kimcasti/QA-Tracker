import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AppstoreOutlined,
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
import { getOrganizationTeam } from '../modules/organization-team/services/organizationTeamService';
import { LimitGuardNotice } from '../modules/plans/components/LimitGuardNotice';
import { PlanCenterSection } from '../modules/plans/components/PlanCenterSection';
import { UpgradeModal } from '../modules/plans/components/UpgradeModal';
import { startUpgradeRequestFlow } from '../modules/plans/services/billingService';
import { ProjectUpgradeBox } from '../modules/projects/components/ProjectUpgradeBox';
import { useProjects } from '../modules/projects/hooks/useProjects';
import {
  DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD,
  PROJECT_CREATION_ROLE_MESSAGE,
  buildProjectUpgradeWhatsAppUrl,
  getEffectiveProjectCount,
  hasReachedProjectLimit,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';
import { OrganizationTeamModal } from '../modules/organization-team/components/OrganizationTeamModal';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { useOrganizationUsage } from '../modules/workspace/hooks/useOrganizationUsage';
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
      className="h-full rounded-[24px] shadow-[0_18px_34px_rgba(15,35,95,0.08)]"
      styles={{ body: { padding: 16 } }}
      style={{
        backgroundImage: `linear-gradient(135deg, ${softSurface(valueColor)} 0%, rgba(255,255,255,0.98) 48%, rgba(255,255,255,1) 100%)`,
      }}
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
      <Text className="mt-1 block text-sm leading-5 text-slate-500">{subtitle}</Text>
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
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [organizationForm] = Form.useForm<{ name: string }>();

  const activeOrganization = activeMembership?.organization;
  const canEditOrganization = canManageCycleConfig;
  const activeOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.plan || activeOrganization?.plan,
  );
  const effectiveOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.effectivePlan || projectQuota?.plan || activeOrganization?.plan,
  );
  const activeBillingState = useMemo(
    () => ({
      planStatus: projectQuota?.billing?.planStatus || activeOrganization?.planStatus || 'active',
      planExpiresAt:
        projectQuota?.billing?.planExpiresAt || activeOrganization?.planExpiresAt || null,
      gracePeriodEndsAt:
        projectQuota?.billing?.gracePeriodEndsAt || activeOrganization?.gracePeriodEndsAt || null,
      inGracePeriod: projectQuota?.billing?.inGracePeriod ?? false,
      downgradedToStarter: projectQuota?.billing?.downgradedToStarter ?? false,
    }),
    [
      activeOrganization?.gracePeriodEndsAt,
      activeOrganization?.planExpiresAt,
      activeOrganization?.planStatus,
      projectQuota?.billing?.downgradedToStarter,
      projectQuota?.billing?.gracePeriodEndsAt,
      projectQuota?.billing?.inGracePeriod,
      projectQuota?.billing?.planExpiresAt,
      projectQuota?.billing?.planStatus,
    ],
  );
  const gracePeriodLabel = useMemo(() => {
    const value = activeBillingState.gracePeriodEndsAt;
    if (!value) return null;

    const date = dayjs(value);
    return date.isValid() ? date.format('DD MMM YYYY') : null;
  }, [activeBillingState.gracePeriodEndsAt]);
  const hasActiveOrganization = Boolean(activeOrganization?.documentId);
  const organizationTeamQuery = useQuery({
    queryKey: ['organization-team', 'plan-usage'],
    queryFn: getOrganizationTeam,
    enabled: hasActiveOrganization,
    staleTime: 60_000,
  });
  const organizationUsageQuery = useOrganizationUsage(hasActiveOrganization);
  const projectLimitValue = projectQuota?.limits?.projects ?? projectQuota?.limit ?? null;
  const projectUsageCount = projectQuota?.usage?.projects ?? projectQuota?.currentCount ?? 0;
  const upgradePriceMonthlyUsd =
    projectQuota?.upgradePriceMonthlyUsd ?? DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD;
  const effectiveProjectCount = useMemo(
    () =>
      getEffectiveProjectCount({
        currentCount: projectUsageCount,
        visibleProjectsCount: projects.length,
      }),
    [projectUsageCount, projects.length],
  );
  const projectLimitReached = hasReachedProjectLimit({
    limit: projectLimitValue,
    currentCount: projectUsageCount,
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
  const projectUsagePercent =
    projectLimitValue && projectLimitValue > 0
      ? Math.min((effectiveProjectCount / projectLimitValue) * 100, 100)
      : 0;
  const isNearProjectLimit =
    Boolean(projectLimitValue) && !projectLimitReached && projectUsagePercent >= 80;
  const projectUpgradeUrl =
    projectLimitValue !== null
      ? buildProjectUpgradeWhatsAppUrl({
          organizationName: activeOrganization?.name,
          currentCount: Math.max(effectiveProjectCount, projectLimitValue),
          limit: projectLimitValue,
          upgradePriceMonthlyUsd,
        })
      : undefined;
  const handleUpgradeClick = async (source: string) => {
    if (!projectUpgradeUrl || projectLimitValue === null) {
      return;
    }

    await startUpgradeRequestFlow({
      requestedPlan: 'growth',
      source,
      currentCount: Math.max(effectiveProjectCount, projectLimitValue),
      limitValue: projectLimitValue,
      priceMonthlyUsd: upgradePriceMonthlyUsd,
      contactUrl: projectUpgradeUrl,
    });
  };

  const handleEnterpriseClick = async () => {
    if (!projectUpgradeUrl) {
      return;
    }

    await startUpgradeRequestFlow({
      requestedPlan: 'enterprise',
      source: 'project-management-upgrade-modal-enterprise',
      currentCount: effectiveProjectCount,
      limitValue: projectLimitValue,
      priceMonthlyUsd: null,
      contactUrl: projectUpgradeUrl,
    });
  };

  const renameOrganizationMutation = useMutation({
    mutationFn: renameActiveOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      message.success('Nombre de la organización actualizado');
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

  const planUsageMetrics = useMemo(() => {
    const usageSnapshot =
      organizationUsageQuery.data || projectQuota?.organizationUsage || null;
    const usageFallback = projectQuota?.usage;
    const activeMembersCount =
      usageSnapshot?.usersCount ??
      usageFallback?.users ??
      organizationTeamQuery.data?.members.filter(member => member.status === 'active').length ??
      projectMetrics.distinctMembers;
    const functionalitiesCount =
      usageSnapshot?.functionalitiesCount ?? usageFallback?.features ?? 0;
    const testCasesCount = usageSnapshot?.testCasesCount ?? usageFallback?.testCases ?? 0;

    return [
      {
        key: 'projects',
        label: 'Proyectos',
        current: projectQuota?.usage?.projects ?? effectiveProjectCount,
        limit: projectQuota?.limits?.projects ?? projectLimitValue,
      },
      {
        key: 'users',
        label: 'Usuarios',
        current: activeMembersCount,
        limit: projectQuota?.limits?.users ?? null,
      },
      {
        key: 'features',
        label: 'Funcionalidades',
        current: functionalitiesCount,
        limit: projectQuota?.limits?.features ?? null,
      },
      {
        key: 'testCases',
        label: 'Casos de prueba',
        current: testCasesCount,
        limit: projectQuota?.limits?.testCases ?? null,
      },
    ];
  }, [
    effectiveProjectCount,
    organizationUsageQuery.data,
    organizationTeamQuery.data?.members,
    projectQuota?.organizationUsage,
    projectQuota?.usage?.features,
    projectQuota?.usage?.projects,
    projectQuota?.usage?.testCases,
    projectQuota?.usage?.users,
    projectQuota?.limits?.features,
    projectQuota?.limits?.projects,
    projectQuota?.limits?.testCases,
    projectQuota?.limits?.users,
    projectLimitValue,
    projectMetrics.distinctMembers,
  ]);
  const isPlanUsageLoading =
    organizationTeamQuery.isLoading ||
    organizationUsageQuery.isLoading;

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

  const visibleProjectsCount = filteredProjects.length;

  const workspaceStats = useMemo(
    () => [
      {
        key: 'total-projects',
        title: 'Proyectos totales',
        value: projectMetrics.totalProjects,
        subtitle: 'portfolio registrado',
        icon: <AppstoreOutlined />,
        valueColor: qaPalette.primary,
      },
      {
        key: 'active-projects',
        title: 'Activos',
        value: projectMetrics.activeProjects,
        subtitle: 'operando hoy',
        icon: <CheckCircleFilled />,
        valueColor: qaPalette.functionalityStatus.completed,
      },
      {
        key: 'visible-projects',
        title: 'Visibles',
        value: visibleProjectsCount,
        subtitle:
          searchTerm || statusFilter !== ALL_PROJECTS_FILTER
            ? 'segun filtro actual'
            : 'sin filtro aplicado',
        icon: <FolderOpenOutlined />,
        valueColor: qaPalette.accent,
      },
      {
        key: 'members',
        title: 'Colaboradores',
        value: projectMetrics.distinctMembers,
        subtitle: 'participantes distintos',
        icon: <TeamOutlined />,
        valueColor: qaPalette.secondary,
      },
    ],
    [
      projectMetrics.activeProjects,
      projectMetrics.distinctMembers,
      projectMetrics.totalProjects,
      searchTerm,
      statusFilter,
      visibleProjectsCount,
    ],
  );

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
    <div className="relative min-h-full overflow-hidden p-7">
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

      <div className="relative flex w-full flex-col gap-4 pb-8">
        {false ? (
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

              <div className="relative flex flex-col gap-6">
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

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.48fr)_minmax(340px,1fr)]">
                  <div className="flex flex-col gap-4">
                    <div>
                      <Title
                        level={1}
                        className="!mb-3 !max-w-3xl !text-[2.1rem] !font-bold !leading-[1.08] !text-slate-900 sm:!text-[2.6rem]"
                      >
                        Gestión de proyectos QA con identidad consistente y acceso claro.
                      </Title>
                      <Paragraph className="mb-0 max-w-3xl text-[14px] leading-6 text-slate-500 sm:text-[15px]">
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
                            Tu rol Viewer puede consultar proyectos y métricas, pero no crear ni
                            editar.
                          </Text>
                        </Space>
                      </div>
                    ) : null}

                    {!canCreateProjectsByRole ? (
                      <Text className="block text-sm text-slate-500">
                        {PROJECT_CREATION_ROLE_MESSAGE}
                      </Text>
                    ) : null}

                    {canCreateProjectsByRole &&
                    projectLimitReached &&
                    projectLimitValue !== null &&
                    !showProjectUpgradeBox ? (
                        <LimitGuardNotice
                          blocked
                          title={`Limite alcanzado (${effectiveProjectCount}/${projectLimitValue})`}
                          description="Has alcanzado el limite del plan Starter. Actualiza a Growth para seguir creando proyectos."
                          ctaHref={projectUpgradeUrl}
                          onCtaClick={() => void handleUpgradeClick('project-management-limit-reached')}
                          onSecondaryAction={() => setIsUpgradeModalOpen(true)}
                        />
                    ) : null}

                    {canCreateProjectsByRole &&
                    !projectLimitReached &&
                    isNearProjectLimit &&
                    projectLimitValue !== null ? (
                        <LimitGuardNotice
                          title="Estás cerca del límite de tu plan"
                          description={`Te queda ${Math.max(projectLimitValue - effectiveProjectCount, 0)} proyecto disponible en Starter. Considera actualizar a Growth para escalar tu QA.`}
                          ctaHref={projectUpgradeUrl}
                          onCtaClick={() => void handleUpgradeClick('project-management-limit-warning')}
                          onSecondaryAction={() => setIsUpgradeModalOpen(true)}
                        />
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[0_18px_35px_rgba(16,42,67,0.08)] backdrop-blur-sm">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4">
                          <div>
                            <Text className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                              Organizacion activa
                            </Text>
                            <Title level={3} className="!mb-0 !mt-2 !text-slate-900">
                              {activeOrganization?.name || 'Organización actual'}
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
                              {activeBillingState.planStatus === 'past_due' &&
                              activeBillingState.inGracePeriod ? (
                                <Tag color="gold" className="rounded-full px-3 py-1 font-semibold">
                                  Gracia activa
                                  {gracePeriodLabel ? ` hasta ${gracePeriodLabel}` : ''}
                                </Tag>
                              ) : null}
                            </Space>
                          </div>
                        </div>

                        <Text className="text-sm leading-6 text-slate-500">
                          Centraliza el equipo, los proyectos y la configuracion principal del
                          workspace desde un solo bloque.
                        </Text>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0 rounded-[20px] border border-slate-100 bg-white/85 px-4 py-4">
                            <Text className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                              Proyectos
                            </Text>
                            <div className="mt-2.5">
                              <Text className="block text-[1.7rem] font-semibold leading-none text-slate-900">
                                {projectMetrics.totalProjects}
                              </Text>
                              <Text className="mt-1.5 block text-[13px] leading-4 text-slate-500">
                                {projectMetrics.activeProjects} activos
                              </Text>
                            </div>
                          </div>

                          <div className="min-w-0 rounded-[20px] border border-slate-100 bg-white/85 px-4 py-4">
                            <Text className="block text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">
                              Colaboradores
                            </Text>
                            <div className="mt-2.5">
                              <Text className="block text-[1.7rem] font-semibold leading-none text-slate-900">
                                {projectMetrics.distinctMembers}
                              </Text>
                              <Text className="mt-1.5 block text-[13px] leading-4 text-slate-500">
                                participantes distintos
                              </Text>
                            </div>
                          </div>
                        </div>

                        {activeBillingState.planStatus === 'past_due' &&
                        activeBillingState.inGracePeriod ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <Text className="block text-sm font-semibold text-amber-900">
                              Periodo de gracia activo
                            </Text>
                            <Text className="text-sm text-amber-800">
                              Tu organizacion mantiene temporalmente sus funciones activas
                              {gracePeriodLabel ? ` hasta el ${gracePeriodLabel}` : ''} mientras se
                              regulariza el pago del plan.
                            </Text>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <Card
          variant="borderless"
          className="qa-surface-card rounded-[28px]"
          styles={{ body: { padding: 16 } }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,720px)] xl:items-start">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Title level={3} className="!mb-1 !text-slate-900">
                    {activeOrganization?.name || 'Organización actual'}
                  </Title>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => setIsEditOrganizationModalOpen(true)}
                    disabled={!canEditOrganization}
                    className="mt-[-2px] flex h-9 w-9 items-center justify-center rounded-xl text-slate-500"
                    aria-label="Editar organización"
                  />
                </div>
                <Text className="text-slate-500">
                  {filteredProjects.length} proyecto{filteredProjects.length === 1 ? '' : 's'}{' '}
                  visibles
                  {searchTerm || statusFilter !== ALL_PROJECTS_FILTER
                    ? ' con los filtros actuales.'
                    : ' en este portfolio.'}
                </Text>
              </div>

              <div className="flex flex-col gap-2.5 xl:items-stretch">
                <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onOpenCreateModal}
                    disabled={!canCreateProjectsInUi}
                    className="h-10 rounded-2xl px-5 text-[15px] font-semibold xl:shrink-0 [&.ant-btn-disabled]:!opacity-100"
                    style={
                      !canCreateProjectsInUi
                        ? {
                            background: '#94a3b8',
                            borderColor: '#94a3b8',
                            color: '#ffffff',
                          }
                        : undefined
                    }
                  >
                    Nuevo proyecto
                  </Button>
                  {!isViewer ? (
                    <Button
                      icon={<TeamOutlined />}
                      onClick={() => setIsTeamModalOpen(true)}
                      className="h-10 rounded-2xl px-5 text-[15px] font-semibold xl:shrink-0"
                    >
                      Gestionar equipo de trabajo
                    </Button>
                  ) : null}
                  <Input
                    allowClear
                    size="large"
                    placeholder="Buscar por nombre del proyecto, descripción o versión..."
                    prefix={<SearchOutlined className="text-slate-400" />}
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    className="w-full rounded-2xl xl:min-w-[280px]"
                  />
                  <Select
                    size="large"
                    value={statusFilter}
                    onChange={value => setStatusFilter(value)}
                    options={filterOptions}
                    className="w-full rounded-2xl xl:min-w-[180px]"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {workspaceStats.map(({ key, ...metric }) => (
                <WorkspaceMetricCard key={key} {...metric} />
              ))}
            </div>

            {isViewer ? (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                <Space size={[8, 8]} wrap>
                  <Tag color="default" className="rounded-full px-3 py-1 font-semibold">
                    Solo lectura
                  </Tag>
                  <Text className="text-slate-500">
                    Tu rol Viewer puede consultar proyectos y métricas, pero no crear ni editar.
                  </Text>
                </Space>
              </div>
            ) : null}

            {!canCreateProjectsByRole ? (
              <Text className="block text-sm text-slate-500">{PROJECT_CREATION_ROLE_MESSAGE}</Text>
            ) : null}

            {canCreateProjectsByRole &&
            projectLimitReached &&
            projectLimitValue !== null &&
            !showProjectUpgradeBox ? (
              <LimitGuardNotice
                blocked
                title={'\uD83D\uDE80 Ya alcanzaste el límite de tu plan'}
                description={`Has usado ${effectiveProjectCount} de ${projectLimitValue} proyectos disponibles en Starter. Sigue creciendo sin interrupciones \uD83D\uDE80`}
                ctaHref={projectUpgradeUrl}
              />
            ) : null}

            {canCreateProjectsByRole &&
            !projectLimitReached &&
            isNearProjectLimit &&
            projectLimitValue !== null ? (
              <LimitGuardNotice
                title="Estás muy cerca del límite de tu plan"
                description={`Te queda ${Math.max(projectLimitValue - effectiveProjectCount, 0)} proyecto disponible en Starter. Sigue creciendo sin interrupciones \uD83D\uDE80`}
                ctaHref={projectUpgradeUrl}
              />
            ) : null}
          </div>
        </Card>

        {filteredProjects.length > 0 ? (
          <div className="mt-3 grid gap-4 sm:mt-4 sm:grid-cols-2 xl:grid-cols-4">
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
                <div key={project.id} className="flex">
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
                      className="qa-surface-card h-full w-full cursor-pointer rounded-[24px] border border-slate-100/80 transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-sky-200/80 hover:shadow-[0_28px_48px_rgba(16,42,67,0.12)]"
                      styles={{
                        body: {
                          padding: 14,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                        },
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {project.logo ? (
                            <Avatar
                              size={42}
                              shape="square"
                              src={project.logo}
                              className="border border-slate-100"
                            />
                          ) : (
                            <Avatar
                              size={42}
                              shape="square"
                              src={appBranding.logoUrl}
                              className="border border-slate-100"
                              style={{ borderRadius: 18 }}
                            >
                              {getInitials(project.name)}
                            </Avatar>
                          )}

                          <div className="flex min-w-0 flex-col gap-1.5">
                            <Tag
                              variant="filled"
                              className="m-0 w-fit rounded-full px-3 py-0.5 font-semibold"
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
                              className="m-0 w-fit rounded-full px-3 py-0.5 font-semibold text-slate-600"
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

                      <div className="mt-4 flex-1 overflow-hidden">
                        <div className="space-y-1">
                          <Paragraph
                            ellipsis={{ rows: 2, tooltip: project.name }}
                            className="!mb-1 !text-base !font-semibold !leading-6 !text-slate-900"
                          >
                            {project.name}
                          </Paragraph>
                          <Paragraph
                            ellipsis={{
                              rows: 1,
                              tooltip: project.purpose || 'Proyecto QA de la organización actual',
                            }}
                            className="!mb-0 !text-sm !leading-6 !text-slate-500"
                          >
                            {project.purpose || 'Proyecto QA de la organización actual'}
                          </Paragraph>
                        </div>

                        <Paragraph
                          ellipsis={{ rows: 3, tooltip: project.description }}
                          className="!mb-0 !text-sm !leading-6 !text-slate-500"
                        >
                          {project.description}
                        </Paragraph>
                      </div>

                      <div className="mt-3 rounded-[20px] border border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
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
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card
            variant="borderless"
            className="qa-surface-card rounded-[28px]"
            styles={{ body: { padding: 32 } }}
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
                  className="rounded-2xl px-5 font-semibold [&.ant-btn-disabled]:!border-sky-200 [&.ant-btn-disabled]:!bg-sky-100/90 [&.ant-btn-disabled]:!text-slate-600 [&.ant-btn-disabled]:!opacity-100"
                >
                  Crear proyecto
                </Button>
              ) : null}
            </Empty>
          </Card>
        )}

        <PlanCenterSection
          title="Controla capacidad, billing y crecimiento del workspace"
          description="Revisa de un vistazo el uso del plan, el consumo mensual y el estado de cobro para crecer sin fricciones."
          planLabel={formatPlanLabel(activeOrganizationPlan)}
          metrics={planUsageMetrics}
          metricsLoading={isPlanUsageLoading}
          organizationName={activeOrganization?.name}
          contractedPlan={activeOrganizationPlan}
          effectivePlan={effectiveOrganizationPlan}
          billing={activeBillingState}
          aiUsage={projectQuota?.aiUsage}
          exportUsage={projectQuota?.exportUsage}
          upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
          onViewPlans={() => setIsUpgradeModalOpen(true)}
          onUpgradeAi={() => void handleUpgradeClick('project-management-ai-card')}
          onUpgradeExport={() => void handleUpgradeClick('project-management-export-card')}
          onRenewPlan={() => void handleUpgradeClick('project-management-billing-banner')}
        />

        {showProjectUpgradeBox ? (
          <ProjectUpgradeBox
            organizationName={activeOrganization?.name}
            currentCount={upgradeCurrentCount}
            limit={projectLimitValue}
            upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
            onUpgradeClick={() => void handleUpgradeClick('project-management-upgrade-box')}
            onViewPlans={() => setIsUpgradeModalOpen(true)}
          />
        ) : null}

        <UpgradeModal
          open={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          organizationName={activeOrganization?.name}
          currentPlan={effectiveOrganizationPlan}
          title="Compara planes antes de seguir creciendo"
          description="Revisa qué desbloquea cada plan y elige la ruta que mejor acompaña el momento actual de tu equipo QA."
          onUpgradeGrowth={() => void handleUpgradeClick('project-management-upgrade-modal-growth')}
          onContactEnterprise={() => void handleEnterpriseClick()}
        />
      </div>

      <OrganizationTeamModal
        open={isTeamModalOpen}
        onCancel={() => setIsTeamModalOpen(false)}
        projects={projects}
      />

      <Modal
        open={isEditOrganizationModalOpen}
        title="Editar organización"
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
            label="Nombre de la organización"
            rules={[{ required: true, message: 'Ingresa el nombre de la organización.' }]}
          >
            <Input size="large" placeholder="Ej. Laboratorio QA" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
