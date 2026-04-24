import type { TestCaseTemplate } from '../../../types';
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

function mapTemplate(document: TestCaseTemplateDto): TestCaseTemplate {
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
    isAutomated: Boolean(document.isAutomated),
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
    isAutomated: Boolean(template.isAutomated),
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    module: relation(template.moduleId),
  });

  return mapTemplate(saved);
}

export async function removeTestCaseTemplate(id: string) {
  await deleteDocument('/api/test-case-templates', id);
}
