import {
  AutomationStatus,
  AutomationTool,
  AutomationType,
  deriveAutomationStatus,
  isAutomatedCoverageStatus,
  type TestCaseTemplate,
} from '../../../types';
import {
  priorityToApi,
  priorityFromApi,
  testTypeToApi,
  testTypeFromApi,
} from '../../shared/services/enumMappers';
import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { getModules } from '../../settings/services/settingsService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestCaseTemplateDto } from '../types/api';

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

function mapTemplate(document: TestCaseTemplateDto): TestCaseTemplate {
  const automationStatus = deriveAutomationStatus({
    automationStatus: automationStatusFromApi(document.automationStatus),
    isAutomated: document.isAutomated,
  });

  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    moduleId: document.module?.documentId || '',
    moduleName: document.module?.name || '',
    name: document.name,
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
  };
}

export async function getTestCaseTemplates(projectId?: string, moduleName?: string) {
  if (!projectId) return [];

  const [context, modules] = await Promise.all([
    findProjectContext(projectId),
    getModules(projectId),
  ]);

  if (!context) return [];

  const module = moduleName ? modules.find(item => item.name === moduleName) : null;
  if (moduleName && !module?.id) return [];

  const documents = await listDocuments<TestCaseTemplateDto>('/api/test-case-templates', {
    'populate[project][fields][0]': 'key',
    'populate[module][fields][0]': 'name',
    'filters[project][documentId][$eq]': context.documentId,
    ...(module?.id ? { 'filters[module][documentId][$eq]': module.id } : {}),
    sort: 'name:asc',
  });

  return documents.map(mapTemplate);
}

export async function saveTestCaseTemplate(template: TestCaseTemplate) {
  const context = await findProjectContext(template.projectId);
  if (!context) {
    throw new Error(`Project ${template.projectId} is not available in the workspace.`);
  }

  if (!template.moduleId) {
    throw new Error('A module is required for the template.');
  }

  const existingDocuments = template.id
    ? await listDocuments<TestCaseTemplateDto>(
        '/api/test-case-templates',
        {
          'filters[project][documentId][$eq]': context.documentId,
          'filters[documentId][$eq]': template.id,
          'pagination[pageSize]': 1,
        },
        {
          paginateAll: false,
        },
      )
    : [];
  const documentId = existingDocuments[0]?.documentId || null;

  const saved = await upsertDocument<TestCaseTemplateDto>('/api/test-case-templates', documentId, {
    name: template.name,
    description: template.description,
    preconditions: template.preconditions,
    testSteps: template.testSteps,
    expectedResult: template.expectedResult,
    testType: testTypeToApi(template.testType),
    priority: priorityToApi(template.priority),
    isAutomated: isAutomatedCoverageStatus(deriveAutomationStatus(template)),
    automationStatus: automationStatusToApi(deriveAutomationStatus(template)),
    automationType: automationTypeToApi(template.automationType),
    automationTool: automationToolToApi(template.automationTool),
    automationReference: template.automationReference?.trim() || null,
    automationOwner: template.automationOwner?.trim() || null,
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    module: relation(template.moduleId),
  });

  return mapTemplate(saved);
}

export async function removeTestCaseTemplate(id: string) {
  await deleteDocument('/api/test-case-templates', id);
}
