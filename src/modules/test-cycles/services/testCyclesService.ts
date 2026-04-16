import { Http } from '../../../config/http';
import {
  ExecutionMode,
  TestResult,
  type RegressionCycle,
  type RegressionExecution,
} from '../../../types';
import {
  cycleStatusFromApi,
  cycleStatusToApi,
  cycleTypeFromApi,
  cycleTypeToApi,
  environmentFromApi,
  environmentToApi,
  executionModeFromApi,
  executionModeToApi,
  severityFromApi,
  severityToApi,
  testResultFromApi,
  testResultToApi,
} from '../../shared/services/enumMappers';
import {
  listDocuments,
  populateParams,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { getSprints } from '../../settings/services/settingsService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestCycleDto, TestCycleExecutionDto } from '../types/api';
import { dedupeRegressionExecutions } from '../utils/executionIntegrity';

const testCyclePopulate = populateParams([
  'project',
  'sprint',
  'executions',
  'executions.functionality',
  'executions.testCase',
  'executions.bug',
]);

function normalizeSprintKey(value?: string | null) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^sprint\s*/i, '');
}

function findSprintByValue(
  sprints: Array<{ id: string; name: string }>,
  value?: string | null,
) {
  if (!value) return undefined;

  const raw = value.trim();
  const normalized = normalizeSprintKey(raw);

  return sprints.find(
    item => item.name === raw || normalizeSprintKey(item.name) === normalized,
  );
}

function mapExecution(document: TestCycleExecutionDto): RegressionExecution {
  return {
    id: document.documentId,
    functionalityId: document.functionality?.code || '',
    testCaseId: document.testCase?.documentId,
    module: document.moduleName || '',
    functionalityName: document.functionalityName || '',
    testCaseTitle: document.testCase?.title || document.testCaseTitle,
    executionMode:
      executionModeFromApi(document.executionMode) ||
      (document.testCase?.isAutomated ? ExecutionMode.AUTOMATED : ExecutionMode.MANUAL),
    executed: Boolean(document.executed),
    date: document.date,
    result: testResultFromApi(document.result),
    evidence: document.evidence || '',
    evidenceImage: document.evidenceImage,
    bugId: document.bug?.externalBugId || document.bug?.internalBugId,
    bugTitle: document.bugTitle,
    bugLink: document.bugLink,
    severity: severityFromApi(document.severity),
    linkedBugId: document.linkedBugId,
    assignedTesterName: document.assignedTesterName,
    assignedTesterEmail: document.assignedTesterEmail,
    updatedAt: document.updatedAt,
  };
}

function mapCycle(document: TestCycleDto): RegressionCycle {
  const dedupedExecutions = dedupeRegressionExecutions((document.executions || []).map(mapExecution));
  const hasExecutionPayload = Array.isArray(document.executions) && document.executions.length > 0;
  const totalTests = hasExecutionPayload ? dedupedExecutions.length : document.totalTests || 0;
  const passed = hasExecutionPayload
    ? dedupedExecutions.filter(item => item.result === TestResult.PASSED).length
    : document.passed || 0;
  const failed = hasExecutionPayload
    ? dedupedExecutions.filter(item => item.result === TestResult.FAILED).length
    : document.failed || 0;
  const blocked = hasExecutionPayload
    ? dedupedExecutions.filter(item => item.result === TestResult.BLOCKED).length
    : document.blocked || 0;
  const pending = hasExecutionPayload
    ? dedupedExecutions.filter(item => !item.executed).length
    : document.pending || 0;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 1000) / 10 : 0;

  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    cycleId: document.code,
    date: document.date,
    totalTests,
    passed,
    failed,
    blocked,
    pending,
    passRate,
    note: document.note || '',
    status: cycleStatusFromApi(document.status),
    sprint: document.sprint?.name,
    type: cycleTypeFromApi(document.cycleType),
    tester: document.tester,
    buildVersion: document.buildVersion,
    environment: environmentFromApi(document.environment),
    executions: dedupedExecutions,
  };
}

async function syncExecutions(
  cycleDocumentId: string,
  cycle: RegressionCycle,
  organizationDocumentId?: string,
  projectDocumentId?: string,
) {
  const desiredExecutions = dedupeRegressionExecutions(cycle.executions);
  const response = await Http.post<{ data: TestCycleDto }>('/api/test-cycle-executions/batch-sync', {
    data: {
      testCycle: cycleDocumentId,
      project: projectDocumentId,
      organization: organizationDocumentId,
      items: desiredExecutions.map(execution => ({
        data: {
          moduleName: execution.module,
          functionalityName: execution.functionalityName,
          testCaseTitle: execution.testCaseTitle || null,
          executed: execution.executed,
          date: execution.date || null,
          result: testResultToApi(execution.result),
          executionMode: executionModeToApi(execution.executionMode),
          evidence: execution.evidence || null,
          evidenceImage: execution.evidenceImage || null,
          bugTitle: execution.bugTitle || null,
          bugLink: execution.bugLink || null,
          severity: severityToApi(execution.severity),
          linkedBugId: execution.linkedBugId || null,
          assignedTesterName: execution.assignedTesterName || null,
          assignedTesterEmail: execution.assignedTesterEmail || null,
          organization: relation(organizationDocumentId),
          project: relation(projectDocumentId),
          testCycle: relation(cycleDocumentId),
          functionality: relation(execution.functionalityId),
          testCase: relation(execution.testCaseId),
        },
      })),
    },
  });

  return response.data.data;
}

export async function getTestCycles(projectId?: string, cycleType?: 'REGRESSION' | 'SMOKE') {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestCycleDto>('/api/test-cycles', {
    ...testCyclePopulate,
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
  const sprint = findSprintByValue(sprints, cycle.sprint);
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

  const syncedCycle = await syncExecutions(
    saved.documentId,
    cycle,
    context.organizationDocumentId,
    context.documentId,
  );

  return mapCycle(syncedCycle);
}

export async function saveTestCycleExecution(
  _cycleDocumentId: string,
  _projectId: string,
  executionId: string,
  updates: Partial<RegressionExecution>,
  expectedUpdatedAt?: string,
) {
  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'module')) {
    data.moduleName = updates.module || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'functionalityName')) {
    data.functionalityName = updates.functionalityName || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'testCaseTitle')) {
    data.testCaseTitle = updates.testCaseTitle || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'executed')) {
    data.executed = updates.executed;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'date')) {
    data.date = updates.date || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'result')) {
    data.result = updates.result ? testResultToApi(updates.result) : undefined;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'executionMode')) {
    data.executionMode = updates.executionMode
      ? executionModeToApi(updates.executionMode)
      : undefined;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'evidence')) {
    data.evidence = updates.evidence || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'evidenceImage')) {
    data.evidenceImage = updates.evidenceImage || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'bugTitle')) {
    data.bugTitle = updates.bugTitle || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'bugLink')) {
    data.bugLink = updates.bugLink || null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'severity')) {
    data.severity = updates.severity ? severityToApi(updates.severity) : null;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'linkedBugId')) {
    data.linkedBugId = updates.linkedBugId || null;
  }
  if (expectedUpdatedAt) {
    data.expectedUpdatedAt = expectedUpdatedAt;
  }

  const response = await Http.put<{ data: TestCycleDto }>(
    `/api/test-cycle-executions/${executionId}/persist`,
    {
      data,
    },
  );

  return mapCycle(response.data.data);
}
