import type { RegressionCycle, RegressionExecution } from '../../../types';
import {
  cycleStatusFromApi,
  cycleStatusToApi,
  cycleTypeFromApi,
  cycleTypeToApi,
  environmentFromApi,
  environmentToApi,
  severityFromApi,
  severityToApi,
  testResultFromApi,
  testResultToApi,
} from '../../shared/services/enumMappers';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { getFunctionalities } from '../../functionalities/services/functionalitiesService';
import { getSprints } from '../../settings/services/settingsService';
import { getTestCases } from '../../test-cases/services/testCasesService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestCycleDto, TestCycleExecutionDto } from '../types/api';

function mapExecution(document: TestCycleExecutionDto): RegressionExecution {
  return {
    id: document.documentId,
    functionalityId: document.functionality?.code || '',
    testCaseId: document.testCase?.documentId,
    module: document.moduleName || '',
    functionalityName: document.functionalityName || '',
    testCaseTitle: document.testCase?.title || document.testCaseTitle,
    executed: Boolean(document.executed),
    date: document.date,
    result: testResultFromApi(document.result),
    evidence: document.evidence || '',
    evidenceImage: document.evidenceImage,
    bugTitle: document.bugTitle,
    bugLink: document.bugLink,
    severity: severityFromApi(document.severity),
    linkedBugId: document.linkedBugId,
  };
}

function mapCycle(document: TestCycleDto): RegressionCycle {
  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    cycleId: document.code,
    date: document.date,
    totalTests: document.totalTests || 0,
    passed: document.passed || 0,
    failed: document.failed || 0,
    blocked: document.blocked || 0,
    pending: document.pending || 0,
    passRate: Number(document.passRate || 0),
    note: document.note || '',
    status: cycleStatusFromApi(document.status),
    sprint: document.sprint?.name,
    type: cycleTypeFromApi(document.cycleType),
    tester: document.tester,
    buildVersion: document.buildVersion,
    environment: environmentFromApi(document.environment),
    executions: (document.executions || []).map(mapExecution),
  };
}

async function syncExecutions(
  cycleDocumentId: string,
  cycle: RegressionCycle,
  organizationDocumentId?: string,
  projectDocumentId?: string,
) {
  const [functionalities, testCases, existingExecutions] = await Promise.all([
    getFunctionalities(cycle.projectId),
    getTestCases(cycle.projectId),
    listDocuments<TestCycleExecutionDto>('/api/test-cycle-executions', {
      'filters[testCycle][documentId][$eq]': cycleDocumentId,
      populate: 'functionality,testCase',
    }),
  ]);

  const savedExecutions: TestCycleExecutionDto[] = [];
  for (const execution of cycle.executions) {
    const functionality = functionalities.find(item => item.id === execution.functionalityId);
    const testCase = testCases.find(item => item.id === execution.testCaseId);
    const documentId = existingExecutions.some(item => item.documentId === execution.id)
      ? execution.id
      : null;

    const saved = await upsertDocument<TestCycleExecutionDto>(
      '/api/test-cycle-executions',
      documentId,
      {
        moduleName: execution.module,
        functionalityName: execution.functionalityName,
        testCaseTitle: execution.testCaseTitle || null,
        executed: execution.executed,
        date: execution.date || null,
        result: testResultToApi(execution.result),
        evidence: execution.evidence || null,
        evidenceImage: execution.evidenceImage || null,
        bugTitle: execution.bugTitle || null,
        bugLink: execution.bugLink || null,
        severity: severityToApi(execution.severity),
        linkedBugId: execution.linkedBugId || null,
        organization: relation(organizationDocumentId),
        project: relation(projectDocumentId),
        testCycle: relation(cycleDocumentId),
        functionality: relation(functionality?.id),
        testCase: relation(testCase?.id),
      },
    );

    savedExecutions.push(saved);
  }

  const savedIds = new Set(savedExecutions.map(item => item.documentId));
  await Promise.all(
    existingExecutions
      .filter(item => !savedIds.has(item.documentId))
      .map(item => deleteDocument('/api/test-cycle-executions', item.documentId)),
  );
}

export async function getTestCycles(projectId?: string, cycleType?: 'REGRESSION' | 'SMOKE') {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestCycleDto>('/api/test-cycles', {
    populate: 'project,sprint,executions,executions.functionality,executions.testCase',
    sort: 'date:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    ...(cycleType ? { 'filters[cycleType][$eq]': cycleTypeToApi(cycleType) } : {}),
  });

  return documents.map(mapCycle);
}

export async function saveTestCycle(cycle: RegressionCycle) {
  const context = await findProjectContext(cycle.projectId);
  if (!context) {
    throw new Error(`Project ${cycle.projectId} is not available in the workspace.`);
  }

  const sprints = await getSprints(cycle.projectId);
  const sprint = sprints.find(item => item.name === cycle.sprint);
  const documents = await listDocuments<TestCycleDto>('/api/test-cycles', {
    'filters[project][documentId][$eq]': context.documentId,
    'filters[code][$eq]': cycle.cycleId,
  });

  const saved = await upsertDocument<TestCycleDto>('/api/test-cycles', documents[0]?.documentId || null, {
    code: cycle.cycleId,
    cycleType: cycleTypeToApi(cycle.type),
    date: cycle.date,
    totalTests: cycle.totalTests,
    passed: cycle.passed,
    failed: cycle.failed,
    blocked: cycle.blocked,
    pending: cycle.pending,
    passRate: cycle.passRate,
    note: cycle.note,
    status: cycleStatusToApi(cycle.status),
    tester: cycle.tester || null,
    buildVersion: cycle.buildVersion || null,
    environment: environmentToApi(cycle.environment),
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    sprint: relation(sprint?.id),
  });

  await syncExecutions(
    saved.documentId,
    cycle,
    context.organizationDocumentId,
    context.documentId,
  );

  const refreshedCycles = await getTestCycles(cycle.projectId, cycle.type);
  return refreshedCycles.find(item => item.id === saved.documentId) || mapCycle(saved);
}
