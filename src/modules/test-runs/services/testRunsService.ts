import type { TestRun, TestRunResult } from '../../../types';
import type { PublicUatSessionSummary } from '../../../types';
import {
  browserFromApi,
  browserToApi,
  deviceTypeFromApi,
  deviceTypeToApi,
  environmentFromApi,
  environmentToApi,
  executionStatusFromApi,
  executionStatusToApi,
  operatingSystemFromApi,
  operatingSystemToApi,
  priorityFromApi,
  priorityToApi,
  severityFromApi,
  severityToApi,
  testResultFromApi,
  testResultToApi,
  testTypeFromApi,
  testTypeToApi,
} from '../../shared/services/enumMappers';
import {
  deleteDocument,
  getDocument,
  listDocuments,
  populateParams,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestRunDto, TestRunResultDto } from '../types/api';
import { Http } from '../../../config/http';

type SaveTestRunOptions = {
  resultsToSync?: TestRunResult[];
  removeMissingResults?: boolean;
};

const testRunBasePopulatePaths = ['project', 'sprint'] as const;

function compareTestRunResults(left: TestRunResult, right: TestRunResult) {
  const leftOrder = typeof left.orderIndex === 'number' ? left.orderIndex : Number.MAX_SAFE_INTEGER;
  const rightOrder =
    typeof right.orderIndex === 'number' ? right.orderIndex : Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (left.functionalityId !== right.functionalityId) {
    return left.functionalityId.localeCompare(right.functionalityId);
  }

  return left.testCaseId.localeCompare(right.testCaseId);
}

function mapPublicUatSession(document?: TestRunDto['publicUatSession']): PublicUatSessionSummary | null {
  if (!document?.documentId) {
    return null;
  }

  const participant = document.participant || document.externalParticipant || null;

  return {
    documentId: document.documentId,
    status: document.status,
    expiresAt: document.expiresAt || null,
    activatedAt: document.activatedAt || null,
    completedAt: document.completedAt || null,
    revokedAt: document.revokedAt || null,
    lastAccessedAt: document.lastAccessedAt || null,
    allowResultEditing: document.allowResultEditing ?? true,
    allowEvidenceUpload: document.allowEvidenceUpload ?? true,
    allowCommentEditing: document.allowCommentEditing ?? true,
    completionLocked: document.completionLocked ?? false,
    publicUrl: document.publicUrl || null,
    participant,
  };
}

function mapTestRunResult(document: TestRunResultDto): TestRunResult {
  return {
    id: document.documentId,
    orderIndex: typeof document.orderIndex === 'number' ? document.orderIndex : undefined,
    functionalityId: document.functionality?.code || '',
    testCaseId: document.testCase?.documentId || '',
    result: testResultFromApi(document.result),
    notes: document.notes || '',
    evidenceImage: document.evidenceImage,
    bugId: document.bug?.externalBugId || document.bug?.internalBugId,
    bugTitle: document.bugTitle,
    bugLink: document.bugLink,
    severity: severityFromApi(document.severity),
    linkedBugId: document.linkedBugId,
  };
}

function mapTestRun(document: TestRunDto, resultsOverride?: TestRunResult[]): TestRun {
  const resolvedResults = (resultsOverride || (document.results || []).map(mapTestRunResult)).sort(
    compareTestRunResults,
  );

  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    title: document.title,
    description: document.description || '',
    executionDate: document.executionDate || '',
    status: executionStatusFromApi(document.status),
    testType: testTypeFromApi(document.testType),
    sprint: document.sprint?.name || '',
    priority: priorityFromApi(document.priority),
    tester: document.tester || '',
    buildVersion: document.buildVersion,
    environment: environmentFromApi(document.environment),
    browser: browserFromApi(document.browser),
    deviceType: deviceTypeFromApi(document.deviceType),
    operatingSystem: operatingSystemFromApi(document.operatingSystem),
    browserVersion: document.browserVersion,
    osVersion: document.osVersion,
    resolution: document.resolution,
    identifiedRisks: document.identifiedRisks || [],
    exitCriteria: document.exitCriteria || [],
    selectedModules: document.selectedModules || [],
    selectedFunctionalities: document.selectedFunctionalities || [],
    results: resolvedResults,
    totalResults: document.totalResults ?? resolvedResults.length,
    executedResults:
      document.executedResults ??
      resolvedResults.filter(result => result.result !== 'No Ejecutado').length,
    publicUatSession: mapPublicUatSession(document.publicUatSession),
  };
}

async function getResultsByRun(projectId?: string, testRunDocumentId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestRunResultDto>('/api/test-run-results', {
    ...populateParams(['testRun', 'functionality', 'testCase', 'bug']),
    'sort[0]': 'orderIndex:asc',
    'sort[1]': 'createdAt:asc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    ...(testRunDocumentId ? { 'filters[testRun][documentId][$eq]': testRunDocumentId } : {}),
  });

  return documents.reduce<Record<string, TestRunResult[]>>((acc, document) => {
    const runId = document.testRun?.documentId;
    if (!runId) {
      return acc;
    }

    if (!acc[runId]) {
      acc[runId] = [];
    }

    acc[runId].push(mapTestRunResult(document));
    return acc;
  }, {});
}

async function syncResults(
  testRunDocumentId: string,
  testRun: TestRun,
  organizationDocumentId?: string,
  projectDocumentId?: string,
  options?: SaveTestRunOptions,
) {
  const resultsToSync = options?.resultsToSync ?? testRun.results;
  const response = await Http.post<{ data: TestRunDto }>('/api/test-run-results/batch-sync', {
    data: {
      testRun: testRunDocumentId,
      project: projectDocumentId,
      organization: organizationDocumentId,
      removeMissingResults: options?.removeMissingResults ?? true,
      items: resultsToSync.map(result => ({
        documentId: result.id.startsWith('TR-') ? null : result.id,
        data: {
          orderIndex:
            typeof result.orderIndex === 'number' && Number.isFinite(result.orderIndex)
              ? result.orderIndex
              : null,
          result: testResultToApi(result.result),
          notes: result.notes || null,
          evidenceImage: result.evidenceImage || null,
          bugTitle: result.bugTitle || null,
          bugLink: result.bugLink || null,
          severity: severityToApi(result.severity),
          linkedBugId: result.linkedBugId || null,
          organization: relation(organizationDocumentId),
          project: relation(projectDocumentId),
          testRun: relation(testRunDocumentId),
          functionality: relation(result.functionalityId),
          testCase: relation(result.testCaseId),
          bug: relation(result.linkedBugId || result.bugId),
        },
      })),
    },
  });

  return response.data.data;
}

export async function getTestRuns(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const [documents, resultsByRun] = await Promise.all([
    listDocuments<TestRunDto>('/api/test-runs', {
      ...populateParams([...testRunBasePopulatePaths]),
      'sort[0]': 'executionDate:desc',
      'sort[1]': 'createdAt:desc',
      ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    }),
    getResultsByRun(projectId),
  ]);

  return documents.map(document => mapTestRun(document, resultsByRun[document.documentId] || []));
}

export async function getTestRunSummaries(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestRunDto>('/api/test-runs/list-summary', {
    'sort[0]': 'executionDate:desc',
    'sort[1]': 'createdAt:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(document => mapTestRun(document));
}

export async function getTestRunById(documentId: string) {
  const [document, resultsByRun] = await Promise.all([
    getDocument<TestRunDto>('/api/test-runs', documentId, {
      ...populateParams([...testRunBasePopulatePaths]),
    }),
    getResultsByRun(undefined, documentId),
  ]);

  return mapTestRun(document, resultsByRun[documentId] || []);
}

export async function saveTestRun(testRun: TestRun, options?: SaveTestRunOptions) {
  const context = await findProjectContext(testRun.projectId);
  if (!context) {
    throw new Error(`Project ${testRun.projectId} is not available in the workspace.`);
  }

  const documentId = testRun.id.startsWith('TR-') ? null : testRun.id;

  const saved = await upsertDocument<TestRunDto>('/api/test-runs', documentId, {
    title: testRun.title,
    description: testRun.description,
    executionDate: testRun.executionDate,
    status: executionStatusToApi(testRun.status),
    testType: testTypeToApi(testRun.testType),
    priority: priorityToApi(testRun.priority),
    tester: testRun.tester,
    buildVersion: testRun.buildVersion || null,
    environment: environmentToApi(testRun.environment),
    browser: browserToApi(testRun.browser),
    deviceType: deviceTypeToApi(testRun.deviceType),
    operatingSystem: operatingSystemToApi(testRun.operatingSystem),
    browserVersion: testRun.browserVersion || null,
    osVersion: testRun.osVersion || null,
    resolution: testRun.resolution || null,
    identifiedRisks: testRun.identifiedRisks || [],
    exitCriteria: testRun.exitCriteria || [],
    selectedModules: testRun.selectedModules || [],
    selectedFunctionalities: testRun.selectedFunctionalities || [],
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    sprint: testRun.sprint || null,
  });

  const syncedRun = await syncResults(
    saved.documentId,
    testRun,
    context.organizationDocumentId,
    context.documentId,
    options,
  );

  return mapTestRun(syncedRun);
}

export async function removeTestRun(id: string) {
  const existingResults = await listDocuments<TestRunResultDto>('/api/test-run-results', {
    'filters[testRun][documentId][$eq]': id,
  });

  await Promise.all(
    existingResults.map(result => deleteDocument('/api/test-run-results', result.documentId)),
  );
  await deleteDocument('/api/test-runs', id);
}
