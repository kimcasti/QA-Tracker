import dayjs from 'dayjs';
import { ProposalType, type Project } from '../../../types';
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

function parseServiceBillingPhases(value: ProjectDto['serviceBillingPhases']) {
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
    documentId: document.documentId,
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
    aiProjectInsights: project.aiProjectInsights || '',
    aiWireframeBrief: project.aiWireframeBrief || '',
    serviceBillingPhases: project.serviceBillingPhases || [],
    proposalType: project.proposalType || null,
    proposalSentAt: project.proposalSentAt || null,
    projectStartAt: project.projectStartAt || null,
    contractNumber: project.contractNumber || null,
    proposalNumber: project.proposalNumber || null,
    currency: project.currency || null,
    paymentTermsDays: typeof project.paymentTermsDays === 'number' ? project.paymentTermsDays : null,
    proposalOwner: project.proposalOwner || null,
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
