import { isAxiosError } from 'axios';
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
  getDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { Http } from '../../../config/http';
import { getFunctionalities } from '../../functionalities/services/functionalitiesService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestCaseDto } from '../types/api';
import { manualCasesForFunctionalities } from '../utils/automationCandidates';
import { saveBatch } from '../utils/saveBatch';
import { normalizeCaseType, validatedCaseTool } from '../utils/caseAuthoring';

export async function markManualCasesAsCandidates(projectId: string, functionalityIds: string[], caseIds: string[], functionalityDocumentId?: string, assertWriteActive?: () => void) {
  // Re-read before writing so a stale planning view does not reset existing automation.
  const selected = new Set(caseIds);
  const cases = manualCasesForFunctionalities(await getTestCases(projectId, undefined, functionalityDocumentId), projectId, functionalityIds)
    .filter(item => selected.has(item.id));
  return saveBatch(cases, async item => {
    const id = item.documentId || item.id;
    if (!id) throw new Error('Caso sin identificador persistido.');
    // The update endpoint expects the complete case, not a partial status payload.
    return saveTestCase({ ...item, automationStatus: AutomationStatus.CANDIDATE, isAutomated: false }, functionalityDocumentId, assertWriteActive);
  });
}

function automationStatusFromApi(value?: string | null) {
  switch (value) {
    case undefined:
    case null:
      return undefined;
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

export async function getTestCases(projectId?: string, functionalityId?: string, functionalityDocumentId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  if (functionalityDocumentId && !context) {
    throw new Error('Project scope is not available in the workspace.');
  }
  const documents = await listDocuments<TestCaseDto>('/api/test-cases', {
    'populate[project][fields][0]': 'key',
    'populate[functionality][fields][0]': 'code',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    ...(functionalityDocumentId
      ? { 'filters[functionality][documentId][$eq]': functionalityDocumentId }
      : functionalityId ? { 'filters[functionality][code][$eq]': functionalityId } : {}),
    'sort[0]': 'sortOrder:asc',
    'sort[1]': 'createdAt:asc',
  });

  if (functionalityDocumentId && documents.some(document =>
    document.project?.documentId !== context?.documentId ||
    document.functionality?.documentId !== functionalityDocumentId)) {
    throw new Error('Persisted case relations do not match the requested scope.');
  }

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

export async function saveTestCase(testCase: TestCase, functionalityDocumentId?: string, assertWriteActive?: () => void) {
  // Canvas must not resolve through getFunctionalities: that legacy catalog can
  // deduplicate distinct persisted parents sharing a business code.
  const freshProjects = functionalityDocumentId
    ? (await Http.get<{ projects: Array<{ key: string; documentId: string; organization?: { documentId: string } }> }>(
        '/api/me/project-contexts',
      )).data.projects
    : undefined;
  const freshProject = freshProjects?.find(item => item.key === testCase.projectId || item.documentId === testCase.projectId);
  const context = functionalityDocumentId
    ? freshProject?.organization?.documentId
      ? { documentId: freshProject.documentId, organizationDocumentId: freshProject.organization.documentId }
      : null
    : await findProjectContext(testCase.projectId);
  if (!context) {
    throw new Error(`Project ${testCase.projectId} is not available in the workspace.`);
  }

  const functionality = functionalityDocumentId
    ? await getDocument<{ documentId: string; code: string; project?: { documentId: string } }>(
        '/api/functionalities', functionalityDocumentId, { 'populate[0]': 'project' },
      )
    : (await getFunctionalities(testCase.projectId)).find(item => item.id === testCase.functionalityId);
  const documentId = testCase.documentId || (
    testCase.id.startsWith('TC-') || testCase.id.startsWith('TC-AI-') ? null : testCase.id);
  const original = documentId ? await getDocument<TestCaseDto>('/api/test-cases', documentId,
    functionalityDocumentId ? { 'populate[0]': 'project', 'populate[1]': 'functionality' } : undefined) : undefined;

  if (functionalityDocumentId) {
    if (!functionality || functionality.documentId !== functionalityDocumentId ||
        !('project' in functionality) || functionality.project?.documentId !== context.documentId ||
        !('code' in functionality) || functionality.code !== testCase.functionalityId) {
      throw new Error('La funcionalidad no pertenece al scope del proyecto seleccionado.');
    }
    if (documentId && (!original || original.documentId !== documentId ||
        original.project?.documentId !== context.documentId ||
        original.functionality?.documentId !== functionalityDocumentId)) {
      throw new Error('El caso persistido no pertenece al scope de proyecto y funcionalidad seleccionado.');
    }
  }

  const payload = {
    title: testCase.title,
    description: testCase.description,
    preconditions: testCase.preconditions,
    testSteps: testCase.testSteps,
    expectedResult: testCase.expectedResult,
    testType: testTypeToApi(normalizeCaseType(testCase.testType,
      original ? testTypeFromApi(original.testType) : undefined)),
    priority: priorityToApi(testCase.priority),
    isAutomated: isAutomatedCoverageStatus(deriveAutomationStatus(testCase)),
    automationStatus: automationStatusToApi(deriveAutomationStatus(testCase)),
    automationType: automationTypeToApi(testCase.automationType),
    automationTool: automationToolToApi(validatedCaseTool(testCase.automationTool, deriveAutomationStatus(testCase),
      original ? automationToolFromApi(original.automationTool) : undefined,
      original ? { originalAutomationStatus: deriveAutomationStatus({
        automationStatus: automationStatusFromApi(original.automationStatus), isAutomated: original.isAutomated,
      }) } : undefined)),
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
    functionality: relation(functionalityDocumentId || functionality?.documentId || (functionality && 'id' in functionality ? functionality.id : undefined)),
  };

  if (functionalityDocumentId) assertWriteActive?.();
  let saved: TestCaseDto;
  try {
    saved = await upsertDocument<TestCaseDto>('/api/test-cases', documentId, payload);
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (functionalityDocumentId && (!status || status === 409 || status === 408 || status >= 500)) {
      throw new Error('Resultado incierto al guardar el caso. Recarga para reconciliar antes de continuar.', { cause: error });
    }
    throw error;
  }
  if (!functionalityDocumentId) return mapTestCase(saved);
  try {
    if (!saved.documentId || (documentId && saved.documentId !== documentId)) throw new Error('Invalid saved case identity.');
    const persisted = await getDocument<TestCaseDto>('/api/test-cases', saved.documentId, {
      'populate[0]': 'project', 'populate[1]': 'functionality',
    });
    if (!persisted || persisted.documentId !== saved.documentId ||
        persisted.project?.documentId !== context.documentId ||
        persisted.functionality?.documentId !== functionalityDocumentId) {
      throw new Error('Persisted case scope mismatch.');
    }
    assertWriteActive?.();
    return mapTestCase(persisted);
  } catch (error) {
    // Even a 403 here follows a write: never classify it as a known rejection.
    throw new Error('No se pudo verificar el caso guardado; resultado incierto. Recarga para reconciliar.', { cause: error });
  }
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
