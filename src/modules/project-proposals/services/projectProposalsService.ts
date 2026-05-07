import {
  ProjectProposalStatus,
  ProposalType,
  type ProjectProposal,
} from '../../../types';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { ProjectProposalDto } from '../types/api';
import { normalizeProjectServiceBillingPhases } from '../utils/billingPhases';

function parseServiceBillingPhases(value: ProjectProposalDto['serviceBillingPhases']) {
  if (Array.isArray(value)) {
    return normalizeProjectServiceBillingPhases(value);
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeProjectServiceBillingPhases(parsed) : [];
  } catch {
    return [];
  }
}

function mapProposal(document: ProjectProposalDto): ProjectProposal {
  const resolvedStatus = Object.values(ProjectProposalStatus).includes(
    document.status as ProjectProposalStatus,
  )
    ? (document.status as ProjectProposalStatus)
    : ProjectProposalStatus.DRAFT;

  const resolvedType = Object.values(ProposalType).includes(document.proposalType as ProposalType)
    ? (document.proposalType as ProposalType)
    : undefined;

  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name || 'Propuesta sin nombre',
    status: resolvedStatus,
    isPrimary: document.isPrimary === true,
    serviceBillingPhases: parseServiceBillingPhases(document.serviceBillingPhases),
    proposalType: resolvedType,
    proposalSentAt: document.proposalSentAt || '',
    projectStartAt: document.projectStartAt || '',
    contractNumber: document.contractNumber || '',
    proposalNumber: document.proposalNumber || '',
    currency: document.currency || 'USD',
    paymentTermsDays:
      typeof document.paymentTermsDays === 'number' ? document.paymentTermsDays : undefined,
    proposalOwner: document.proposalOwner || '',
  };
}

export async function getProjectProposals(projectId?: string) {
  if (!projectId) return [];

  const context = await findProjectContext(projectId);
  const documents = await listDocuments<ProjectProposalDto>('/api/project-proposals', {
    'populate[project][fields][0]': 'key',
    'populate[project][fields][1]': 'name',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    sort: 'createdAt:desc',
  });

  return documents.map(mapProposal);
}

export async function saveProjectProposal(proposal: ProjectProposal) {
  const context = await findProjectContext(proposal.projectId);
  if (!context) {
    throw new Error(`Project ${proposal.projectId} is not available in the workspace.`);
  }

  const saved = await upsertDocument<ProjectProposalDto>(
    '/api/project-proposals',
    proposal.documentId || null,
    {
      name: proposal.name,
      status: proposal.status,
      isPrimary: proposal.isPrimary,
      serviceBillingPhases: normalizeProjectServiceBillingPhases(proposal.serviceBillingPhases),
      proposalType: proposal.proposalType || null,
      proposalSentAt: proposal.proposalSentAt || null,
      projectStartAt: proposal.projectStartAt || null,
      contractNumber: proposal.contractNumber || null,
      proposalNumber: proposal.proposalNumber || null,
      currency: proposal.currency || null,
      paymentTermsDays:
        typeof proposal.paymentTermsDays === 'number' ? proposal.paymentTermsDays : null,
      proposalOwner: proposal.proposalOwner || null,
      organization: relation(context.organizationDocumentId),
      project: relation(context.documentId),
    },
  );

  return mapProposal(saved);
}

export async function removeProjectProposal(documentId: string) {
  await deleteDocument('/api/project-proposals', documentId);
}
