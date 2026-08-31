import {
  AutomationResultStatus,
  AutomationStatus,
  AutomationTool,
  AutomationType,
  deriveAutomationStatus,
  isAutomatedCoverageStatus,
  type TestCase,
} from '../../../types';
import {
  priorityFromApi,
  priorityToApi,
  testTypeFromApi,
  testTypeToApi,
} from '../../shared/services/enumMappers';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { Http } from '../../../config/http';
import { getFunctionalities } from '../../functionalities/services/functionalitiesService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestCaseDto } from '../types/api';

function automationStatusFromApi(value?: string) {
  switch (value) {
    case 'candidate':
      return AutomationStatus.CANDIDATE;
    case 'automated':
      return AutomationStatus.AUTOMATED;
    case 'obsolete':
      return AutomationStatus.OBSOLETE;
    case 'not_automated':
    default:
      return AutomationStatus.NOT_AUTOMATED;
  }
}

function automationStatusToApi(value?: AutomationStatus) {
  switch (value) {
    case AutomationStatus.CANDIDATE:
      return 'candidate';
    case AutomationStatus.AUTOMATED:
      return 'automated';
    case AutomationStatus.OBSOLETE:
      return 'obsolete';
    case AutomationStatus.NOT_AUTOMATED:
    default:
      return 'not_automated';
  }
}

function automationTypeFromApi(value?: string) {
  switch (value) {
    case 'api':
      return AutomationType.API;
    case 'integration':
      return AutomationType.INTEGRATION;
    case 'performance':
      return AutomationType.PERFORMANCE;
    case 'ui':
    default:
      return value ? AutomationType.UI : undefined;
  }
}

function automationTypeToApi(value?: AutomationType) {
  switch (value) {
    case AutomationType.API:
      return 'api';
    case AutomationType.INTEGRATION:
      return 'integration';
    case AutomationType.PERFORMANCE:
      return 'performance';
    case AutomationType.UI:
      return 'ui';
    default:
      return null;
  }
}

function automationToolFromApi(value?: string) {
  switch (value) {
    case 'cypress':
      return AutomationTool.CYPRESS;
    case 'postman':
      return AutomationTool.POSTMAN;
    case 'k6':
      return AutomationTool.K6;
    case 'webdriverio':
      return AutomationTool.WEBDRIVER_IO;
    case 'other':
      return AutomationTool.OTHER;
    case 'playwright':
    default:
      return value ? AutomationTool.PLAYWRIGHT : undefined;
  }
}

function automationToolToApi(value?: AutomationTool) {
  switch (value) {
    case AutomationTool.CYPRESS:
      return 'cypress';
    case AutomationTool.POSTMAN:
      return 'postman';
    case AutomationTool.K6:
      return 'k6';
    case AutomationTool.WEBDRIVER_IO:
      return 'webdriverio';
    case AutomationTool.OTHER:
      return 'other';
    case AutomationTool.PLAYWRIGHT:
      return 'playwright';
    default:
      return null;
  }
}

function automationResultStatusFromApi(value?: string) {
  switch (value) {
    case 'passed':
      return AutomationResultStatus.PASSED;
    case 'failed':
      return AutomationResultStatus.FAILED;
    case 'skipped':
      return AutomationResultStatus.SKIPPED;
    case 'unknown':
    default:
      return value ? AutomationResultStatus.UNKNOWN : undefined;
  }
}

function automationResultStatusToApi(value?: AutomationResultStatus) {
  switch (value) {
    case AutomationResultStatus.PASSED:
      return 'passed';
    case AutomationResultStatus.FAILED:
      return 'failed';
    case AutomationResultStatus.SKIPPED:
      return 'skipped';
    case AutomationResultStatus.UNKNOWN:
    default:
      return 'unknown';
  }
}

function mapTestCase(document: TestCaseDto): TestCase {
  const automationStatus = deriveAutomationStatus({
    automationStatus: automationStatusFromApi(document.automationStatus),
    isAutomated: document.isAutomated,
  });

  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    functionalityId: document.functionality?.code || '',
    title: document.title,
    description: document.description || '',
    preconditions: document.preconditions || '',
    testSteps: document.testSteps || '',
    expectedResult: document.expectedResult || '',
    testType: testTypeFromApi(document.testType),
    priority: priorityFromApi(document.priority),
    isAutomated: isAutomatedCoverageStatus(automationStatus),
    automationStatus,
    automationType: automationTypeFromApi(document.automationType),
    automationTool: automationToolFromApi(document.automationTool),
    automationReference: document.automationReference || '',
    automationOwner: document.automationOwner || '',
    lastAutomationStatus: automationResultStatusFromApi(document.lastAutomationStatus),
    lastAutomationRunAt: document.lastAutomationRunAt,
    sortOrder: typeof document.sortOrder === 'number' ? document.sortOrder : undefined,
  };
}

export async function getTestCases(projectId?: string, functionalityId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestCaseDto>('/api/test-cases', {
    'populate[project][fields][0]': 'key',
    'populate[functionality][fields][0]': 'code',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    ...(functionalityId ? { 'filters[functionality][code][$eq]': functionalityId } : {}),
    'sort[0]': 'sortOrder:asc',
    'sort[1]': 'createdAt:asc',
  });

  return documents.map((document, index) => {
    const mapped = mapTestCase(document);
    return {
      ...mapped,
      sortOrder:
        typeof mapped.sortOrder === 'number' && Number.isFinite(mapped.sortOrder)
          ? mapped.sortOrder
          : index,
    };
  });
}

export async function saveTestCase(testCase: TestCase) {
  const context = await findProjectContext(testCase.projectId);
  if (!context) {
    throw new Error(`Project ${testCase.projectId} is not available in the workspace.`);
  }

  const functionalities = await getFunctionalities(testCase.projectId);
  const functionality = functionalities.find(item => item.id === testCase.functionalityId);
  const documentId =
    testCase.id.startsWith('TC-') || testCase.id.startsWith('TC-AI-') ? null : testCase.id;

  const saved = await upsertDocument<TestCaseDto>('/api/test-cases', documentId, {
    title: testCase.title,
    description: testCase.description,
    preconditions: testCase.preconditions,
    testSteps: testCase.testSteps,
    expectedResult: testCase.expectedResult,
    testType: testTypeToApi(testCase.testType),
    priority: priorityToApi(testCase.priority),
    isAutomated: isAutomatedCoverageStatus(deriveAutomationStatus(testCase)),
    automationStatus: automationStatusToApi(deriveAutomationStatus(testCase)),
    automationType: automationTypeToApi(testCase.automationType),
    automationTool: automationToolToApi(testCase.automationTool),
    automationReference: testCase.automationReference?.trim() || null,
    automationOwner: testCase.automationOwner?.trim() || null,
    lastAutomationStatus: automationResultStatusToApi(testCase.lastAutomationStatus),
    lastAutomationRunAt: testCase.lastAutomationRunAt || null,
    sortOrder:
      typeof testCase.sortOrder === 'number' && Number.isFinite(testCase.sortOrder)
        ? testCase.sortOrder
        : 0,
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    functionality: relation(functionality?.documentId || functionality?.id),
  });

  return mapTestCase(saved);
}

export async function reorderTestCases(items: Array<{ documentId: string; sortOrder: number }>) {
  const response = await Http.post<{ data: TestCaseDto[] }>('/api/test-cases/reorder', {
    data: { items },
  });

  return response.data.data.map(mapTestCase);
}

export async function removeTestCase(id: string) {
  await deleteDocument('/api/test-cases', id);
}
