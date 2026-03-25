import dayjs from 'dayjs';
import { Http } from '../../../config/http';
import type { Project } from '../../../types';
import { projectStatusFromApi } from '../../shared/services/enumMappers';
import type { WorkspaceDto } from '../types/api';
import type { ProjectContext, Workspace, WorkspaceMembership } from '../types/model';

let workspaceCache: Workspace | null = null;
let workspacePromise: Promise<Workspace> | null = null;
let projectContextCache: Record<string, ProjectContext> = {};

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
  };
}

function mapMembership(membership: WorkspaceDto['memberships'][number]): WorkspaceMembership {
  return {
    documentId: membership.documentId,
    organization: membership.organization,
    role: membership.role,
  };
}

export async function getWorkspace() {
  if (workspaceCache) {
    return workspaceCache;
  }

  if (!workspacePromise) {
    workspacePromise = Http.get<WorkspaceDto>('/api/me/workspace')
      .then(response => {
        projectContextCache = Object.fromEntries(
          (response.data.projects || []).map(project => [
            project.key,
            {
              documentId: project.documentId,
              organizationDocumentId: project.organization?.documentId,
              organizationName: project.organization?.name,
            } satisfies ProjectContext,
          ]),
        );

        const workspace: Workspace = {
          user: response.data.user,
          memberships: (response.data.memberships || []).map(mapMembership),
          projects: (response.data.projects || []).map(mapProject),
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

export async function findProjectContext(projectId: string): Promise<ProjectContext | null> {
  if (!projectContextCache[projectId]) {
    await getWorkspace();
  }

  return projectContextCache[projectId] || null;
}
