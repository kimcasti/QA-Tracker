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
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { getSprints } from '../../settings/services/settingsService';
import { getTestCases } from '../../test-cases/services/testCasesService';
import { getFunctionalities } from '../../functionalities/services/functionalitiesService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { BugDto } from '../types/api';

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
    cycleId: document.testCycle?.code,
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
  const documents = await listDocuments<BugDto>('/api/bugs', {
    populate: 'project,functionality,sprint,testCase,testRun,testCycle',
    sort: 'detectedAt:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapBug);
}

export async function saveBug(bug: QABug) {
  const context = await findProjectContext(bug.projectId);
  if (!context) {
    throw new Error(`Project ${bug.projectId} is not available in the workspace.`);
  }

  const [functionalities, sprints, testCases, documents] = await Promise.all([
    getFunctionalities(bug.projectId),
    getSprints(bug.projectId),
    getTestCases(bug.projectId),
    listDocuments<BugDto>('/api/bugs', {
      'filters[internalBugId][$eq]': bug.internalBugId,
      'filters[project][documentId][$eq]': context.documentId,
    }),
  ]);

  const functionality = functionalities.find(item => item.id === bug.functionalityId);
  const sprint = sprints.find(item => item.name === bug.sprint);
  const testCase = testCases.find(
    item => item.id === bug.testCaseId || item.title === bug.testCaseTitle,
  );

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
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    functionality: relation(functionality?.id),
    sprint: relation(sprint?.id),
    testCase: relation(testCase?.id),
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
  });

  const documentId = documents[0]?.documentId;
  if (!documentId) return;

  await deleteDocument('/api/bugs', documentId);
}
