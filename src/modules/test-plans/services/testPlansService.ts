import {
  CalendarEventType,
  FunctionalityScope,
  Priority,
  TestType,
} from '../../../types';
import {
  deleteDocument,
  listDocuments,
  populateParams,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import {
  functionalityScopeFromApi,
  functionalityScopeToApi,
  priorityFromApi,
  priorityToApi,
  testTypeFromApi,
  testTypeToApi,
} from '../../shared/services/enumMappers';
import { getSprints } from '../../settings/services/settingsService';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { TestPlan } from '../types/model';
import type { TestPlanDto } from '../types/api';

function eventTypeFromApi(type?: TestPlanDto['eventType']) {
  return (
    {
      test: CalendarEventType.TEST,
      client_meeting: CalendarEventType.CLIENT_MEETING,
      demo: CalendarEventType.DEMO,
      onboarding: CalendarEventType.ONBOARDING,
      follow_up: CalendarEventType.FOLLOW_UP,
      reminder: CalendarEventType.REMINDER,
    }[type || ''] || CalendarEventType.TEST
  );
}

function eventTypeToApi(type: CalendarEventType) {
  return {
    [CalendarEventType.TEST]: 'test',
    [CalendarEventType.CLIENT_MEETING]: 'client_meeting',
    [CalendarEventType.DEMO]: 'demo',
    [CalendarEventType.ONBOARDING]: 'onboarding',
    [CalendarEventType.FOLLOW_UP]: 'follow_up',
    [CalendarEventType.REMINDER]: 'reminder',
  }[type];
}

function mapTestPlan(document: TestPlanDto): TestPlan {
  const eventType = eventTypeFromApi(document.eventType);
  const isTestEvent = eventType === CalendarEventType.TEST;

  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    eventType,
    title: document.title,
    scope: isTestEvent ? functionalityScopeFromApi(document.scope) : undefined,
    impactModules: isTestEvent && Array.isArray(document.impactModules) ? document.impactModules : [],
    sprint: isTestEvent ? document.sprint?.name || '' : undefined,
    testType: isTestEvent ? testTypeFromApi(document.testType) : undefined,
    priority: isTestEvent ? priorityFromApi(document.priority) : undefined,
    jiraId: isTestEvent ? document.jiraId || undefined : undefined,
    description: document.description || '',
    date: document.date,
    time: document.time || undefined,
    attendees: document.attendees || undefined,
    owner: document.owner || undefined,
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
  const isTestEvent = plan.eventType === CalendarEventType.TEST;

  const saved = await upsertDocument<TestPlanDto>('/api/test-plans', documentId, {
    eventType: eventTypeToApi(plan.eventType),
    title: plan.title,
    scope: isTestEvent ? functionalityScopeToApi(plan.scope || FunctionalityScope.TOTAL) : null,
    impactModules: isTestEvent ? plan.impactModules || [] : [],
    date: plan.date,
    time: plan.time || null,
    attendees: plan.attendees || null,
    owner: plan.owner || null,
    testType: isTestEvent ? testTypeToApi(plan.testType || TestType.REGRESSION) : null,
    priority: isTestEvent ? priorityToApi(plan.priority || Priority.MEDIUM) : null,
    jiraId: isTestEvent ? plan.jiraId || null : null,
    description: plan.description || '',
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
    sprint: isTestEvent ? relation(sprint?.id) : null,
  });

  return mapTestPlan(saved);
}

export async function removeTestPlan(id: string) {
  await deleteDocument('/api/test-plans', id);
}
