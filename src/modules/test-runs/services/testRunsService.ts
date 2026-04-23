import type { TestRun, TestRunResult } from '../../../types';
import {
  environmentFromApi,
  environmentToApi,
  executionStatusFromApi,
  executionStatusToApi,
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

function mapTestRunResult(document: TestRunResultDto): TestRunResult {
  return {
    id: document.documentId,
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
    selectedModules: document.selectedModules || [],
    selectedFunctionalities: document.selectedFunctionalities || [],
    results: resultsOverride || (document.results || []).map(mapTestRunResult),
  };
}

async function getResultsByRun(projectId?: string, testRunDocumentId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestRunResultDto>('/api/test-run-results', {
    ...populateParams(['testRun', 'functionality', 'testCase', 'bug']),
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
) {
  const existingResults = await listDocuments<TestRunResultDto>('/api/test-run-results', {
    'filters[testRun][documentId][$eq]': testRunDocumentId,
    ...populateParams(['functionality', 'testCase', 'bug']),
  });

  const savedResults: TestRunResultDto[] = [];
  for (const result of testRun.results) {
    const documentId = existingResults.some(item => item.documentId === result.id) ? result.id : null;

    const saved = await upsertDocument<TestRunResultDto>(
      '/api/test-run-results',
      documentId,
      {
        result: testResultToApi(result.result),
        notes: result.notes || null,
        evidenceImage: result.evidenceImage || null,
        bugTitle: result.bugTitle || null,
        bugLink: result.bugLink || null,
        severity: severityToApi(result.severity),
        linkedBugId: result.linkedBugId || null,
        organization: organizationDocumentId,
        project: projectDocumentId,
        testRun: testRunDocumentId,
        functionality: result.functionalityId || null,
        testCase: result.testCaseId || null,
        bug: result.linkedBugId || result.bugId || null,
      },
    );

    savedResults.push(saved);
  }

  const savedIds = new Set(savedResults.map(result => result.documentId));
  await Promise.all(
    existingResults
      .filter(result => !savedIds.has(result.documentId))
      .map(result => deleteDocument('/api/test-run-results', result.documentId)),
  );
}

export async function getTestRuns(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const [documents, resultsByRun] = await Promise.all([
    listDocuments<TestRunDto>('/api/test-runs', {
      ...populateParams([
        'project',
        'sprint',
        'results',
        'results.functionality',
        'results.testCase',
        'results.bug',
      ]),
      sort: 'executionDate:desc',
      ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    }),
    getResultsByRun(projectId),
  ]);

  return documents.map(document => mapTestRun(document, resultsByRun[document.documentId] || []));
}

export async function getTestRunSummaries(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestRunDto>('/api/test-runs/list-summary', {
    sort: 'executionDate:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(document => mapTestRun(document));
}

export async function getTestRunById(documentId: string) {
  const [document, resultsByRun] = await Promise.all([
    getDocument<TestRunDto>('/api/test-runs', documentId, {
      ...populateParams([
        'project',
        'sprint',
        'results',
        'results.functionality',
        'results.testCase',
        'results.bug',
      ]),
    }),
    getResultsByRun(undefined, documentId),
  ]);

  return mapTestRun(document, resultsByRun[documentId] || []);
}

export async function saveTestRun(testRun: TestRun) {
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
    selectedModules: testRun.selectedModules || [],
    selectedFunctionalities: testRun.selectedFunctionalities || [],
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    sprint: testRun.sprint || null,
  });

  await syncResults(
    saved.documentId,
    testRun,
    context.organizationDocumentId,
    context.documentId,
  );

  return getTestRunById(saved.documentId);
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
