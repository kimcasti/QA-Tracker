import dayjs from 'dayjs';
import type { Project } from '../../../types';
import { projectStatusFromApi, projectStatusToApi } from '../../shared/services/enumMappers';
import { deleteDocument, upsertDocument } from '../../shared/services/strapi';
import {
  findProjectContext,
  getActiveOrganizationDocumentId,
  getWorkspace,
  invalidateWorkspaceCache,
} from '../../workspace/services/workspaceService';
import type { WorkspaceDto } from '../../workspace/types/api';
import type { ProjectDto } from '../types/api';

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
  };
}

async function findProjectDocumentId(projectId: string) {
  const context = await findProjectContext(projectId);
  return context?.documentId || null;
}

export async function getProjects() {
  const workspace = await getWorkspace();
  return workspace.projects || [];
}

export async function saveProject(project: Project) {
  const documentId = await findProjectDocumentId(project.id);
  const organizationDocumentId = await getActiveOrganizationDocumentId();

  if (!organizationDocumentId) {
    throw new Error('No active organization was found for the current session.');
  }

  const saved = await upsertDocument<ProjectDto>('/api/projects', documentId, {
    name: project.name,
    key: project.id,
    description: project.description,
    version: project.version,
    status: projectStatusToApi(project.status),
    icon: project.icon,
    logoDataUrl: project.logo,
    teamMembers: project.teamMembers || [],
    purpose: project.purpose || '',
    coreRequirements: project.coreRequirements || [],
    businessRules: project.businessRules || '',
  });

  invalidateWorkspaceCache();
  return mapProject(saved);
}

export async function removeProject(projectId: string) {
  const documentId = await findProjectDocumentId(projectId);
  if (!documentId) return;

  await deleteDocument('/api/projects', documentId);
  invalidateWorkspaceCache();
}
