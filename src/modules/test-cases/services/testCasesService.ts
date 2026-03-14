import type { TestCase } from '../../../types';
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
import { getFunctionalities } from '../../functionalities/services/functionalitiesService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestCaseDto } from '../types/api';

function mapTestCase(document: TestCaseDto): TestCase {
  return {
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
  };
}

export async function getTestCases(projectId?: string, functionalityId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestCaseDto>('/api/test-cases', {
    populate: 'project,functionality',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  let mapped = documents.map(mapTestCase);
  if (functionalityId) {
    mapped = mapped.filter(item => item.functionalityId === functionalityId);
  }

  return mapped;
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
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    functionality: relation(functionality?.id),
  });

  return mapTestCase(saved);
}

export async function removeTestCase(id: string) {
  await deleteDocument('/api/test-cases', id);
}
