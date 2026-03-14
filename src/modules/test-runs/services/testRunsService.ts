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
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { getBugs } from '../../bugs/services/bugsService';
import { getFunctionalities } from '../../functionalities/services/functionalitiesService';
import { getSprints } from '../../settings/services/settingsService';
import { getTestCases } from '../../test-cases/services/testCasesService';
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
    bugId: document.bug?.internalBugId,
    bugTitle: document.bugTitle,
    bugLink: document.bugLink,
    severity: severityFromApi(document.severity),
    linkedBugId: document.linkedBugId,
  };
}

function mapTestRun(document: TestRunDto): TestRun {
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
    results: (document.results || []).map(mapTestRunResult),
  };
}

async function syncResults(
  testRunDocumentId: string,
  testRun: TestRun,
  organizationDocumentId?: string,
  projectDocumentId?: string,
) {
  const [functionalities, testCases, bugs, existingResults] = await Promise.all([
    getFunctionalities(testRun.projectId),
    getTestCases(testRun.projectId),
    getBugs(testRun.projectId),
    listDocuments<TestRunResultDto>('/api/test-run-results', {
      'filters[testRun][documentId][$eq]': testRunDocumentId,
      populate: 'functionality,testCase,bug',
    }),
  ]);

  const savedResults: TestRunResultDto[] = [];
  for (const result of testRun.results) {
    const functionality = functionalities.find(item => item.id === result.functionalityId);
    const testCase = testCases.find(item => item.id === result.testCaseId);
    const linkedBug = bugs.find(
      item =>
        item.internalBugId === result.linkedBugId || item.internalBugId === result.bugId,
    );
    const bugDocuments = linkedBug
      ? await listDocuments<any>('/api/bugs', {
          'filters[internalBugId][$eq]': linkedBug.internalBugId,
        })
      : [];

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
        organization: relation(organizationDocumentId),
        project: relation(projectDocumentId),
        testRun: relation(testRunDocumentId),
        functionality: relation(functionality?.id),
        testCase: relation(testCase?.id),
        bug: relation(bugDocuments[0]?.documentId),
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
  const documents = await listDocuments<TestRunDto>('/api/test-runs', {
    populate: 'project,sprint,results,results.functionality,results.testCase,results.bug',
    sort: 'executionDate:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapTestRun);
}

export async function saveTestRun(testRun: TestRun) {
  const context = await findProjectContext(testRun.projectId);
  if (!context) {
    throw new Error(`Project ${testRun.projectId} is not available in the workspace.`);
  }

  const sprints = await getSprints(testRun.projectId);
  const sprint = sprints.find(item => item.name === testRun.sprint);
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
    sprint: relation(sprint?.id),
  });

  await syncResults(
    saved.documentId,
    testRun,
    context.organizationDocumentId,
    context.documentId,
  );

  const refreshedRuns = await getTestRuns(testRun.projectId);
  return refreshedRuns.find(item => item.id === saved.documentId) || mapTestRun(saved);
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
