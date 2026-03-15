import {
  deleteDocument,
  listDocuments,
  populateParams,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { functionalityScopeFromApi, functionalityScopeToApi, priorityFromApi, priorityToApi, testTypeFromApi, testTypeToApi } from '../../shared/services/enumMappers';
import { getSprints } from '../../settings/services/settingsService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestPlan } from '../types/model';
import type { TestPlanDto } from '../types/api';

function mapTestPlan(document: TestPlanDto): TestPlan {
  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    title: document.title,
    scope: functionalityScopeFromApi(document.scope),
    impactModules: Array.isArray(document.impactModules) ? document.impactModules : [],
    sprint: document.sprint?.name || '',
    testType: testTypeFromApi(document.testType),
    priority: priorityFromApi(document.priority),
    jiraId: document.jiraId || undefined,
    description: document.description || '',
    date: document.date,
  };
}

export async function getTestPlans(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<TestPlanDto>('/api/test-plans', {
    ...populateParams(['project', 'sprint']),
    sort: 'date:asc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapTestPlan);
}

export async function saveTestPlan(plan: TestPlan) {
  const context = await findProjectContext(plan.projectId);
  if (!context) {
    throw new Error(`Project ${plan.projectId} is not available in the workspace.`);
  }

  const sprints = await getSprints(plan.projectId);
  const sprint = sprints.find((item) => item.name === plan.sprint);
  const documentId = plan.id.startsWith('plan-') ? null : plan.id;

  const saved = await upsertDocument<TestPlanDto>('/api/test-plans', documentId, {
    title: plan.title,
    scope: functionalityScopeToApi(plan.scope),
    impactModules: plan.impactModules || [],
    date: plan.date,
    testType: testTypeToApi(plan.testType),
    priority: priorityToApi(plan.priority),
    jiraId: plan.jiraId || null,
    description: plan.description || '',
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    sprint: relation(sprint?.id),
  });

  return mapTestPlan(saved);
}

export async function removeTestPlan(id: string) {
  await deleteDocument('/api/test-plans', id);
}
