import { useEffect, useMemo, useState } from 'react';
import { HttpStatusCode } from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Col, Form, Input, Modal, Row, Select, message } from 'antd';
import dayjs from 'dayjs';
import { toApiError } from '../config/http';
import { ProjectUpgradeBox } from '../modules/projects/components/ProjectUpgradeBox';
import { useProjects } from '../modules/projects/hooks/useProjects';
import {
  DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD,
  PROJECT_CREATION_ROLE_MESSAGE,
  getEffectiveProjectCount,
  getProjectLimitForPlan,
  getProjectLimitReachedMessage,
  hasReachedProjectLimit,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';
import { SlackMemberSelect } from '../modules/slack-members/components/SlackMemberSelect';
import { useSlackMembers } from '../modules/slack-members/hooks/useSlackMembers';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { invalidateWorkspaceCache } from '../modules/workspace/services/workspaceService';
import { Project, ProjectStatus } from '../types';

interface CreateProjectModalProps {
  open: boolean;
  onCancel: () => void;
}

const PROJECT_KEY_FALLBACK_PREFIX = 'PROJ';

function buildProjectKeyPrefix(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toUpperCase();

  if (!normalized) {
    return PROJECT_KEY_FALLBACK_PREFIX;
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    return words
      .slice(0, 4)
      .map(word => word[0])
      .join('')
      .slice(0, 6);
  }

  return words[0].slice(0, 6) || PROJECT_KEY_FALLBACK_PREFIX;
}

function buildProjectKey(name: string, existingKeys: string[]) {
  const prefix = buildProjectKeyPrefix(name);
  const existing = new Set(existingKeys.map(key => key.toUpperCase()));

  let nextKey = '';

  do {
    const timeChunk = Date.now().toString(36).toUpperCase();
    const randomChunk = Math.random().toString(36).slice(2, 6).toUpperCase();
    nextKey = `${prefix}-${timeChunk}-${randomChunk}`;
  } while (existing.has(nextKey));

  return nextKey;
}

export default function CreateProjectModal({ open, onCancel }: CreateProjectModalProps) {
  const queryClient = useQueryClient();
  const { data: projects = [], save: saveProject, isSaving } = useProjects();
  const {
    activeMembership,
    canCreateProjectsByRole,
    projectQuota,
  } = useWorkspaceAccess();
  const {
    data: slackMembers = [],
    isLoading: isSlackMembersLoading,
    error: slackMembersError,
  } = useSlackMembers(open);
  const [form] = Form.useForm();
  const [serverProjectLimitReached, setServerProjectLimitReached] = useState(false);

  const activeOrganizationName = activeMembership?.organization?.name || 'tu organizacion';
  const activeOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.plan || activeMembership?.organization?.plan,
  );
  const projectLimit =
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
  const limitReached =
    serverProjectLimitReached ||
    hasReachedProjectLimit({
      limit: projectLimit,
      currentCount: projectQuota?.currentCount,
      visibleProjectsCount: projects.length,
    });
  const quotaAllowsProjectCreation = projectQuota?.canCreate ?? canCreateProjectsByRole;
  const canCreateProjectsInUi = canCreateProjectsByRole && quotaAllowsProjectCreation && !limitReached;
  const showUpgradeBox =
    canCreateProjectsByRole &&
    limitReached &&
    projectLimit !== null &&
    upgradePriceMonthlyUsd > 0;
  const upgradeCurrentCount = Math.max(
    effectiveProjectCount,
    projectLimit ?? effectiveProjectCount,
  );
  const creationBlockedMessage = !canCreateProjectsByRole
    ? PROJECT_CREATION_ROLE_MESSAGE
    : showUpgradeBox
      ? getProjectLimitReachedMessage({
          organizationName: activeOrganizationName,
          currentCount: upgradeCurrentCount,
          limit: projectLimit,
          upgradePriceMonthlyUsd,
        })
      : null;

  useEffect(() => {
    if (!open) {
      setServerProjectLimitReached(false);
      form.resetFields();
    }
  }, [form, open]);

  const handleClose = () => {
    setServerProjectLimitReached(false);
    onCancel();
    form.resetFields();
  };

  const handleCreateProject = async (values: {
    name: string;
    description: string;
    version: string;
    status: ProjectStatus;
    teamMembers?: string[];
  }) => {
    if (!canCreateProjectsInUi) {
      message.warning(
        creationBlockedMessage || 'No tienes permisos para crear proyectos en esta organizacion.',
      );
      return;
    }

    const normalizedName = values.name.trim();
    const normalizedMembers = (values.teamMembers || [])
      .map(member => member.trim())
      .filter(Boolean);
    const projectKey = buildProjectKey(
      normalizedName,
      projects.map(project => project.id),
    );

    const newProject: Project = {
      id: projectKey,
      name: normalizedName,
      description: values.description.trim(),
      version: values.version.trim(),
      status: values.status,
      createdAt: dayjs().format('YYYY-MM-DD'),
      teamMembers: normalizedMembers,
      icon: 'ProjectOutlined',
      purpose: '',
      coreRequirements: [],
      businessRules: '',
    };

    try {
      await saveProject(newProject);
      message.success('Proyecto creado con exito');
      handleClose();
    } catch (error) {
      const apiError = toApiError(error);
      const blockedByStarterPlanLimit =
        apiError.status === HttpStatusCode.Forbidden &&
        canCreateProjectsByRole &&
        activeOrganizationPlan === 'starter' &&
        projectLimit !== null &&
        effectiveProjectCount >= projectLimit;

      if (blockedByStarterPlanLimit) {
        setServerProjectLimitReached(true);
        invalidateWorkspaceCache();
        void queryClient.invalidateQueries({ queryKey: ['workspace'] });
        void queryClient.invalidateQueries({ queryKey: ['projects'] });

        message.warning(
          getProjectLimitReachedMessage({
            organizationName: activeOrganizationName,
            currentCount: upgradeCurrentCount,
            limit: projectLimit,
            upgradePriceMonthlyUsd,
          }),
        );
        return;
      }

      message.error(apiError.message || 'Error al crear el proyecto');
    }
  };

  return (
    <Modal
      open={open}
      title="Crear nuevo proyecto"
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={720}
    >
      <div className="pb-2 text-slate-500">
        Registra un nuevo proyecto QA dentro de tu organizacion actual.
      </div>

      {!canCreateProjectsInUi ? (
        <div className="mt-6 space-y-4">
          <Alert
            type={showUpgradeBox ? 'warning' : 'info'}
            showIcon
            className="rounded-2xl"
            message={
              showUpgradeBox
                ? 'Limite del plan Starter alcanzado'
                : 'No tienes permisos para crear proyectos'
            }
            description={creationBlockedMessage || undefined}
          />

          {showUpgradeBox ? (
            <ProjectUpgradeBox
              organizationName={activeOrganizationName}
              currentCount={upgradeCurrentCount}
              limit={projectLimit}
              upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
            />
          ) : null}

          <div className="mt-8 flex justify-end">
            <Button
              onClick={handleClose}
              className="h-11 rounded-2xl border-slate-200 px-6 font-semibold"
            >
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
          initialValues={{
            status: ProjectStatus.ACTIVE,
            version: 'v1.0.0',
            teamMembers: [],
          }}
          className="mt-6"
        >
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="name"
                label="Nombre del proyecto"
                rules={[{ required: true, message: 'Ingresa el nombre del proyecto' }]}
              >
                <Input size="large" placeholder="Ej. Nexus Core Platform" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Descripcion"
            rules={[{ required: true, message: 'Ingresa una descripcion breve' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe el alcance, objetivos y el contexto del proyecto."
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="version"
                label="Version del sistema"
                rules={[{ required: true, message: 'Ingresa la version' }]}
              >
                <Input size="large" placeholder="v2.4.0" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Estado inicial">
                <Select
                  size="large"
                  options={[
                    { label: 'Activo', value: ProjectStatus.ACTIVE },
                    { label: 'Pausado', value: ProjectStatus.PAUSED },
                    { label: 'Completado', value: ProjectStatus.COMPLETED },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="teamMembers" label="Miembros del equipo">
            <SlackMemberSelect
              members={slackMembers}
              size="large"
              valueField="fullName"
              loading={isSlackMembersLoading}
              placeholder="Agrega nombres del equipo"
              extraOptions={[
                { label: 'QA Lead', value: 'QA Lead' },
                { label: 'QA Engineer', value: 'QA Engineer' },
                { label: 'Automation Engineer', value: 'Automation Engineer' },
                { label: 'Product Owner', value: 'Product Owner' },
              ]}
            />
          </Form.Item>

          {slackMembersError ? (
            <Alert
              type="warning"
              showIcon
              className="mb-6 rounded-2xl"
              message="No se pudieron cargar los miembros de Slack"
              description="Puedes seguir agregando nombres manualmente mientras revisas la configuracion de Slack."
            />
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              onClick={handleClose}
              className="h-11 rounded-2xl border-slate-200 px-6 font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSaving}
              className="h-11 rounded-2xl px-6 font-semibold"
            >
              Crear proyecto
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
