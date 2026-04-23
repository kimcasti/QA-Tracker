import dayjs from 'dayjs';
import type { QABug } from '../../../types';
import {
  bugOriginFromApi,
  bugOriginToApi,
  bugStatusFromApi,
  bugStatusToApi,
  severityFromApi,
  severityToApi,
} from '../../shared/services/enumMappers';
import {
  deleteDocument,
  listDocuments,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { BugDto } from '../types/api';

function extractCycleIdFromLinkedSourceId(linkedSourceId?: string) {
  if (!linkedSourceId) return undefined;
  const parts = linkedSourceId.split('::');
  const cycleId = parts[2];
  return cycleId && cycleId !== 'no-cycle' ? cycleId : undefined;
}

function dedupeBugsByIdentity(bugs: QABug[]) {
  const unique = new Map<string, QABug>();

  for (const bug of bugs) {
    const key =
      bug.internalBugId ||
      bug.externalBugId ||
      bug.linkedSourceId ||
      [
        bug.projectId,
        bug.cycleId || 'no-cycle',
        bug.testCaseId || 'no-test-case',
        bug.functionalityId || 'no-functionality',
        bug.title || 'no-title',
      ].join('::');

    if (!unique.has(key)) {
      unique.set(key, bug);
    }
  }

  return Array.from(unique.values());
}

function mapBug(document: BugDto): QABug {
  return {
    internalBugId: document.internalBugId,
    externalBugId: document.externalBugId,
    title: document.title,
    description: document.description,
    severity: severityFromApi(document.severity),
    bugLink: document.bugLink,
    evidenceImage: document.evidenceImage,
    origin: bugOriginFromApi(document.origin),
    projectId: document.project?.key || '',
    functionalityId: document.functionality?.code || '',
    functionalityName: document.functionality?.name || document.functionalityName || '',
    module: document.moduleName || '',
    sprint: document.sprint?.name,
    cycleId: document.testCycle?.code || extractCycleIdFromLinkedSourceId(document.linkedSourceId),
    detectedAt: document.detectedAt,
    reportedBy: document.reportedBy,
    status: bugStatusFromApi(document.status),
    testCaseId: document.testCase?.documentId,
    testCaseTitle: document.testCase?.title || document.testCaseTitle,
    testRunId: document.testRun?.documentId,
    executionId: undefined,
    linkedSourceId: document.linkedSourceId,
    updatedAt: dayjs(document.detectedAt).toISOString(),
  };
}

export async function getBugs(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<BugDto>('/api/bug-summaries', {
    sort: 'detectedAt:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return dedupeBugsByIdentity(documents.map(mapBug));
}

export async function getAllBugInternalIds() {
  const documents = await listDocuments<BugDto>('/api/bugs', {
    sort: 'detectedAt:desc',
  });

  return documents.map(document => document.internalBugId).filter(Boolean);
}

export async function saveBug(bug: QABug) {
  const context = await findProjectContext(bug.projectId);
  if (!context) {
    throw new Error(`Project ${bug.projectId} is not available in the workspace.`);
  }

  const documents = await listDocuments<BugDto>('/api/bugs', {
    'filters[internalBugId][$eq]': bug.internalBugId,
    'filters[project][documentId][$eq]': context.documentId,
    'pagination[pageSize]': 1,
  }, {
    paginateAll: false,
  });

  const saved = await upsertDocument<BugDto>('/api/bugs', documents[0]?.documentId || null, {
    internalBugId: bug.internalBugId,
    externalBugId: bug.externalBugId || null,
    title: bug.title,
    description: bug.description || null,
    severity: severityToApi(bug.severity),
    bugLink: bug.bugLink || null,
    evidenceImage: bug.evidenceImage || null,
    origin: bugOriginToApi(bug.origin),
    functionalityName: bug.functionalityName,
    moduleName: bug.module,
    detectedAt: bug.detectedAt || dayjs().toISOString(),
    reportedBy: bug.reportedBy || null,
    status: bugStatusToApi(bug.status),
    testCaseTitle: bug.testCaseTitle || null,
    linkedSourceId: bug.linkedSourceId || null,
    organization: context.organizationDocumentId,
    project: context.documentId,
    functionality: bug.functionalityId || null,
    sprint: bug.sprint || null,
    testCase: bug.testCaseId || bug.testCaseTitle || null,
    testRun: bug.testRunId || null,
    testCycle: bug.cycleId || null,
  });

  return mapBug(saved);
}

export async function removeBug(internalBugId: string, projectId?: string) {
  if (!projectId) return;

  const context = await findProjectContext(projectId);
  if (!context) return;

  const documents = await listDocuments<BugDto>('/api/bugs', {
    'filters[internalBugId][$eq]': internalBugId,
    'filters[project][documentId][$eq]': context.documentId,
    'pagination[pageSize]': 1,
  }, {
    paginateAll: false,
  });

  const documentId = documents[0]?.documentId;
  if (!documentId) return;

  await deleteDocument('/api/bugs', documentId);
}
