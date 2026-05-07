import dayjs from 'dayjs';
import { Http } from '../../../config/http';
import { ProposalType, type Project } from '../../../types';
import { projectStatusFromApi } from '../../shared/services/enumMappers';
import type { ProjectContextsDto, WorkspaceDto } from '../types/api';
import type {
  OrganizationUsageSnapshot,
  ProjectContext,
  Workspace,
  WorkspaceMembership,
  WorkspaceProjectQuota,
} from '../types/model';

let workspaceCache: Workspace | null = null;
let workspacePromise: Promise<Workspace> | null = null;
let projectContextsPromise: Promise<Record<string, ProjectContext>> | null = null;
let projectContextCache: Record<string, ProjectContext> = {};

function parseServiceBillingPhases(value: WorkspaceDto['projects'][number]['serviceBillingPhases']) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapProject(document: WorkspaceDto['projects'][number]): Project {
  return {
    id: document.key,
    name: document.name,
    organizationName: document.organization?.name,
    description: document.description || '',
    version: document.version || '',
    status: projectStatusFromApi(document.status),
    createdAt: document.createdAt?.slice(0, 10) || dayjs().format('YYYY-MM-DD'),
    icon: document.icon,
    logo: document.logoDataUrl,
    teamMembers: document.teamMembers || [],
    purpose: document.purpose || '',
    coreRequirements: document.coreRequirements || [],
    businessRules: document.businessRules || '',
    aiProjectInsights: document.aiProjectInsights || '',
    aiWireframeBrief: document.aiWireframeBrief || '',
    serviceBillingPhases: parseServiceBillingPhases(document.serviceBillingPhases),
    proposalType:
      document.proposalType === ProposalType.PHASES ||
      document.proposalType === ProposalType.SERVICES ||
      document.proposalType === ProposalType.MIXED
        ? document.proposalType
        : undefined,
    proposalSentAt: document.proposalSentAt || '',
    projectStartAt: document.projectStartAt || '',
    contractNumber: document.contractNumber || '',
    proposalNumber: document.proposalNumber || '',
    currency: document.currency || '',
    paymentTermsDays:
      typeof document.paymentTermsDays === 'number' ? document.paymentTermsDays : undefined,
    proposalOwner: document.proposalOwner || '',
  };
}

function mapMembership(membership: WorkspaceDto['memberships'][number]): WorkspaceMembership {
  return {
    documentId: membership.documentId,
    organization: membership.organization,
    role: membership.role,
  };
}

function mapProjectQuota(projectQuota?: WorkspaceDto['projectQuota']): WorkspaceProjectQuota | undefined {
  if (!projectQuota) {
    return undefined;
  }

  return {
    plan: projectQuota.plan,
    effectivePlan: projectQuota.effectivePlan,
    currentCount: projectQuota.currentCount,
    limit: projectQuota.limit,
    limits: projectQuota.limits,
    usage: projectQuota.usage,
    allowedByRole: projectQuota.allowedByRole,
    canCreate: projectQuota.canCreate,
    limitReached: projectQuota.limitReached,
    upgradePriceMonthlyUsd: projectQuota.upgradePriceMonthlyUsd,
    features: projectQuota.features,
    billing: projectQuota.billing,
    aiUsage: projectQuota.aiUsage,
    reports: projectQuota.reports,
    exportUsage: projectQuota.exportUsage,
    organizationUsage: projectQuota.organizationUsage || null,
  };
}

function buildProjectContextMap(
  projects: Array<{
    documentId: string;
    key: string;
    organization?: {
      documentId: string;
      name: string;
    };
  }>,
) {
  return Object.fromEntries(
    (projects || []).map(project => [
      project.key,
      {
        documentId: project.documentId,
        organizationDocumentId: project.organization?.documentId,
        organizationName: project.organization?.name,
      } satisfies ProjectContext,
    ]),
  );
}

export async function getWorkspace() {
  if (workspaceCache) {
    return workspaceCache;
  }

  if (!workspacePromise) {
    workspacePromise = Http.get<WorkspaceDto>('/api/me/workspace')
      .then(response => {
        projectContextCache = buildProjectContextMap(response.data.projects || []);

        const workspace: Workspace = {
          user: response.data.user,
          memberships: (response.data.memberships || []).map(mapMembership),
          projects: (response.data.projects || []).map(mapProject),
          projectQuota: mapProjectQuota(response.data.projectQuota),
        };

        workspaceCache = workspace;
        return workspace;
      })
      .finally(() => {
        workspacePromise = null;
      });
  }

  return workspacePromise;
}

export function invalidateWorkspaceCache() {
  workspaceCache = null;
  workspacePromise = null;
  projectContextsPromise = null;
  projectContextCache = {};
}

export async function renameActiveOrganization(name: string) {
  const response = await Http.put('/api/me/organization', {
    data: {
      name: name.trim(),
    },
  });

  invalidateWorkspaceCache();
  return response.data?.data;
}

export async function getActiveOrganizationDocumentId() {
  const workspace = await getWorkspace();
  return workspace.memberships[0]?.organization?.documentId || null;
}

export async function getOrganizationUsage(): Promise<OrganizationUsageSnapshot | null> {
  const response = await Http.get<{ data?: OrganizationUsageSnapshot | null }>('/api/me/organization-usage');
  return response.data?.data || null;
}

export async function findProjectContext(projectId: string): Promise<ProjectContext | null> {
  if (!projectContextCache[projectId]) {
    if (!projectContextsPromise) {
      projectContextsPromise = Http.get<ProjectContextsDto>('/api/me/project-contexts')
        .then(response => {
          const nextMap = buildProjectContextMap(response.data.projects || []);
          projectContextCache = {
            ...projectContextCache,
            ...nextMap,
          };
          return projectContextCache;
        })
        .finally(() => {
          projectContextsPromise = null;
        });
    }

    await projectContextsPromise;
  }

  if (!projectContextCache[projectId]) {
    await getWorkspace();
  }

  return projectContextCache[projectId] || null;
}
