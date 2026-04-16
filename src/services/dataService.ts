import axios, { type AxiosRequestConfig } from 'axios';
import dayjs from 'dayjs';
import {
  Priority,
  ProjectStatus,
  RiskLevel,
  TestStatus,
  TestType,
  type Functionality,
  type Module,
  type Project,
  type Role,
  type Sprint,
  type TestCase,
} from '../types';
import { storageService } from './storageService';

/**
 * @deprecated Legacy migration layer retained only as a temporary fallback.
 * Do not use this service in new code.
 */

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_IDENTIFIER = (import.meta.env.VITE_API_IDENTIFIER || '').trim();
const API_PASSWORD = (import.meta.env.VITE_API_PASSWORD || '').trim();
const JWT_STORAGE_KEY = 'qa_tracker_api_jwt';

type ApiDocument = Record<string, any>;

let cachedWorkspace: any | null = null;
const STRAPI_MAX_PAGE_SIZE = 100;

function apiEnabled() {
  return Boolean(API_URL);
}

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(JWT_STORAGE_KEY);
}

function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;

  if (!token) {
    window.localStorage.removeItem(JWT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(JWT_STORAGE_KEY, token);
}

async function ensureToken() {
  if (!apiEnabled()) return null;

  const existingToken = getStoredToken();
  if (existingToken) return existingToken;

  if (!API_IDENTIFIER || !API_PASSWORD) return null;

  const response = await axios.post(`${API_URL}/api/auth/local`, {
    identifier: API_IDENTIFIER,
    password: API_PASSWORD,
  });

  const token = response.data?.jwt as string | undefined;
  if (!token) return null;

  setStoredToken(token);
  return token;
}

async function apiRequest<T = any>(config: AxiosRequestConfig): Promise<T> {
  const token = await ensureToken();

  if (!token) {
    throw new Error(
      'Backend auth is not configured. Set VITE_API_URL, VITE_API_IDENTIFIER and VITE_API_PASSWORD.'
    );
  }

  const response = await axios({
    baseURL: API_URL,
    ...config,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(config.headers || {}),
    },
  });

  return response.data as T;
}

async function withApiFallback<T>(apiFn: () => Promise<T>, fallbackFn: () => T | Promise<T>) {
  if (!apiEnabled()) return fallbackFn();

  try {
    return await apiFn();
  } catch (error) {
    console.warn('Falling back to local storage service.', error);
    return fallbackFn();
  }
}

async function getWorkspace() {
  if (cachedWorkspace) return cachedWorkspace;

  cachedWorkspace = await apiRequest<{ memberships: any[]; projects: ApiDocument[] }>({
    method: 'GET',
    url: '/api/me/workspace',
  });

  return cachedWorkspace;
}

async function getActiveOrganizationDocumentId() {
  const workspace = await getWorkspace();
  return workspace.memberships?.[0]?.organization?.documentId ?? null;
}

async function listCollection(endpoint: string, params?: Record<string, string>) {
  // Keep requests aligned with the backend maxLimit to avoid losing records when Strapi clamps page sizes.
  const requestedPageSize = Number(params?.['pagination[pageSize]'] ?? STRAPI_MAX_PAGE_SIZE);
  const pageSize =
    Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, STRAPI_MAX_PAGE_SIZE)
      : STRAPI_MAX_PAGE_SIZE;
  const baseParams = {
    ...params,
    'pagination[pageSize]': pageSize,
    'pagination[withCount]': 'true',
  };
  const documents: ApiDocument[] = [];
  let currentPage = 1;
  let declaredPageCount: number | null = null;
  let totalDocuments: number | null = null;
  let effectivePageSize = pageSize;

  while (true) {
    const response = await apiRequest<{
      data: ApiDocument[];
      meta?: {
        pagination?: {
          pageCount?: number;
          pageSize?: number;
          total?: number;
        };
      };
    }>({
      method: 'GET',
      url: endpoint,
      params: {
        ...baseParams,
        'pagination[page]': currentPage,
      },
    });

    const pageData = response.data || [];
    const pagination = response.meta?.pagination;
    const responsePageCount = Number(pagination?.pageCount);
    const responsePageSize = Number(pagination?.pageSize);
    const responseTotal = Number(pagination?.total);

    if (Number.isFinite(responsePageCount) && responsePageCount > 0) {
      declaredPageCount = responsePageCount;
    }

    if (Number.isFinite(responsePageSize) && responsePageSize > 0) {
      effectivePageSize = responsePageSize;
    }

    if (Number.isFinite(responseTotal) && responseTotal >= 0) {
      totalDocuments = responseTotal;
    }

    documents.push(...pageData);

    const reachedTotal = totalDocuments !== null && documents.length >= totalDocuments;
    const reachedDeclaredLastPage =
      declaredPageCount !== null && currentPage >= declaredPageCount;
    const receivedEmptyPage = pageData.length === 0;
    const receivedPartialPage = pageData.length < effectivePageSize;

    if (
      reachedTotal ||
      receivedEmptyPage ||
      (receivedPartialPage && reachedDeclaredLastPage) ||
      (receivedPartialPage && totalDocuments === null)
    ) {
      break;
    }

    if (reachedDeclaredLastPage && totalDocuments === null) {
      break;
    }

    currentPage += 1;
  }

  return documents;
}

async function createOrUpdateDocument(
  endpoint: string,
  documentId: string | undefined,
  data: Record<string, any>
) {
  const response = await apiRequest<{ data: ApiDocument }>({
    method: documentId ? 'PUT' : 'POST',
    url: documentId ? `${endpoint}/${documentId}` : endpoint,
    data: { data },
  });

  return response.data;
}

function relation(documentId?: string | null) {
  if (!documentId) {
    return undefined;
  }

  return { documentId };
}

function populateParams(paths: string[]) {
  return paths.reduce<Record<string, string>>((params, path, index) => {
    params[`populate[${index}]`] = path;
    return params;
  }, {});
}

function projectStatusToApi(status: ProjectStatus) {
  return {
    [ProjectStatus.ACTIVE]: 'active',
    [ProjectStatus.PAUSED]: 'paused',
    [ProjectStatus.COMPLETED]: 'completed',
  }[status];
}

function projectStatusFromApi(status?: string) {
  return (
    {
      active: ProjectStatus.ACTIVE,
      paused: ProjectStatus.PAUSED,
      completed: ProjectStatus.COMPLETED,
    }[status || ''] || ProjectStatus.ACTIVE
  );
}

function testStatusToApi(status: TestStatus) {
  return {
    [TestStatus.COMPLETED]: 'completed',
    [TestStatus.FAILED]: 'failed',
    [TestStatus.IN_PROGRESS]: 'in_progress',
    [TestStatus.BACKLOG]: 'backlog',
    [TestStatus.MVP]: 'mvp',
    [TestStatus.POST_MVP]: 'post_mvp',
  }[status];
}

function testStatusFromApi(status?: string) {
  return (
    {
      completed: TestStatus.COMPLETED,
      failed: TestStatus.FAILED,
      in_progress: TestStatus.IN_PROGRESS,
      backlog: TestStatus.BACKLOG,
      mvp: TestStatus.MVP,
      post_mvp: TestStatus.POST_MVP,
    }[status || ''] || TestStatus.BACKLOG
  );
}

function priorityToApi(priority: Priority) {
  return {
    [Priority.CRITICAL]: 'critical',
    [Priority.HIGH]: 'high',
    [Priority.MEDIUM]: 'medium',
    [Priority.LOW]: 'low',
  }[priority];
}

function priorityFromApi(priority?: string) {
  return (
    {
      critical: Priority.CRITICAL,
      high: Priority.HIGH,
      medium: Priority.MEDIUM,
      low: Priority.LOW,
    }[priority || ''] || Priority.MEDIUM
  );
}

function riskToApi(risk: RiskLevel) {
  return {
    [RiskLevel.HIGH]: 'high',
    [RiskLevel.MEDIUM]: 'medium',
    [RiskLevel.LOW]: 'low',
  }[risk];
}

function riskFromApi(risk?: string) {
  return (
    {
      high: RiskLevel.HIGH,
      medium: RiskLevel.MEDIUM,
      low: RiskLevel.LOW,
    }[risk || ''] || RiskLevel.MEDIUM
  );
}

function testTypeToApi(type: TestType) {
  return {
    [TestType.INTEGRATION]: 'integration',
    [TestType.FUNCTIONAL]: 'functional',
    [TestType.SANITY]: 'sanity',
    [TestType.REGRESSION]: 'regression',
    [TestType.SMOKE]: 'smoke',
    [TestType.EXPLORATORY]: 'exploratory',
    [TestType.UAT]: 'uat',
  }[type];
}

function testTypeFromApi(type?: string) {
  return (
    {
      integration: TestType.INTEGRATION,
      functional: TestType.FUNCTIONAL,
      sanity: TestType.SANITY,
      regression: TestType.REGRESSION,
      smoke: TestType.SMOKE,
      exploratory: TestType.EXPLORATORY,
      uat: TestType.UAT,
    }[type || ''] || TestType.FUNCTIONAL
  );
}

function sprintStatusToApi(status: Sprint['status']) {
  return {
    Planeado: 'planned',
    'En Progreso': 'in_progress',
    Completado: 'completed',
  }[status];
}

function sprintStatusFromApi(status?: string): Sprint['status'] {
  return (
    {
      planned: 'Planeado',
      in_progress: 'En Progreso',
      completed: 'Completado',
    }[status || ''] || 'Planeado'
  ) as Sprint['status'];
}

function mapProject(document: ApiDocument): Project {
  return {
    documentId: document.documentId,
    organizationDocumentId: document.organization?.documentId,
    id: document.key,
    name: document.name,
    organizationName: document.organization?.name,
    description: document.description || '',
    version: document.version || '',
    status: projectStatusFromApi(document.status),
    createdAt: document.createdAt?.slice(0, 10) || dayjs().format('YYYY-MM-DD'),
    icon: document.icon,
    logo: document.logoDataUrl,
    teamMembers: document.teamMembers || [],
    purpose: document.purpose || '',
    coreRequirements: document.coreRequirements || [],
    businessRules: document.businessRules || '',
  } as Project;
}

function mapModule(document: ApiDocument): Module {
  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    description: document.description || '',
  } as Module;
}

function mapRole(document: ApiDocument): Role {
  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    description: document.description || '',
  } as Role;
}

function mapSprint(document: ApiDocument): Sprint {
  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    name: document.name,
    startDate: document.startDate,
    endDate: document.endDate,
    status: sprintStatusFromApi(document.status),
    objective: document.objective || '',
  } as Sprint;
}

function mapFunctionality(document: ApiDocument): Functionality {
  return {
    documentId: document.documentId,
    id: document.code,
    projectId: document.project?.key || '',
    module: document.module?.name || '',
    name: document.name,
    roles: (document.personaRoles || []).map((role: ApiDocument) => role.name),
    testTypes: (document.testTypes || []).map((type: string) => testTypeFromApi(type)),
    isRegression: Boolean(document.isRegression),
    isSmoke: Boolean(document.isSmoke),
    deliveryDate: document.deliveryDate || '',
    status: testStatusFromApi(document.status),
    priority: priorityFromApi(document.priority),
    riskLevel: riskFromApi(document.riskLevel),
    sprint: document.sprint?.name,
    storyId: document.storyLegacyId,
  } as Functionality;
}

function mapTestCase(document: ApiDocument): TestCase {
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
    isAutomated: Boolean(document.isAutomated),
  } as TestCase;
}

async function getProjectRecord(projectId: string) {
  const projects = await dataService.getProjects();
  return projects.find((project) => project.id === projectId) as any;
}

async function getProjectDocumentId(projectId: string) {
  return (await getProjectRecord(projectId))?.documentId || null;
}

async function getOrganizationDocumentId(projectId: string) {
  return (
    (await getProjectRecord(projectId))?.organizationDocumentId ||
    (await getActiveOrganizationDocumentId())
  );
}

async function getProjectModules(projectId: string) {
  return (await dataService.getModules(projectId)) as any[];
}

async function getProjectRoles(projectId: string) {
  return (await dataService.getRoles(projectId)) as any[];
}

async function getProjectSprints(projectId: string) {
  return (await dataService.getSprints(projectId)) as any[];
}

async function getProjectFunctionalities(projectId: string) {
  return (await dataService.getFunctionalities(projectId)) as any[];
}

export const dataService = {
  getProjects: () =>
    withApiFallback(async () => {
      const projects = await listCollection('/api/projects', {
        populate: 'organization',
        sort: 'name:asc',
      });
      return projects.map(mapProject);
    }, () => storageService.getProjects()),

  saveProject: (project: Project) =>
    withApiFallback(async () => {
      const saved = await createOrUpdateDocument('/api/projects', (project as any).documentId, {
        name: project.name,
        key: project.id,
        description: project.description,
        version: project.version,
        status: projectStatusToApi(project.status),
        icon: project.icon,
        logoDataUrl: project.logo,
        teamMembers: project.teamMembers || [],
        purpose: project.purpose || '',
        coreRequirements: project.coreRequirements || [],
        businessRules: project.businessRules || '',
        organization: relation(
          (project as any).organizationDocumentId || (await getActiveOrganizationDocumentId())
        ),
      });

      cachedWorkspace = null;
      return mapProject(saved);
    }, () => {
      storageService.saveProject(project);
      return project;
    }),

  deleteProject: (id: string) =>
    withApiFallback(async () => {
      const project = await getProjectRecord(id);
      if (!project?.documentId) return;

      await apiRequest({
        method: 'DELETE',
        url: `/api/projects/${project.documentId}`,
      });

      cachedWorkspace = null;
    }, () => storageService.deleteProject(id)),

  getModules: (projectId?: string) =>
    withApiFallback(async () => {
      const projectDocumentId = projectId ? await getProjectDocumentId(projectId) : null;
      const modules = await listCollection('/api/project-modules', {
        populate: 'project',
        ...(projectDocumentId ? { 'filters[project][documentId][$eq]': projectDocumentId } : {}),
      });

      return modules.map(mapModule);
    }, () => storageService.getModules(projectId)),

  saveModule: (module: Module) =>
    withApiFallback(async () => {
      const saved = await createOrUpdateDocument(
        '/api/project-modules',
        (module as any).documentId,
        {
          name: module.name,
          description: module.description,
          organization: relation(await getOrganizationDocumentId(module.projectId)),
          project: relation(await getProjectDocumentId(module.projectId)),
        }
      );

      return mapModule(saved);
    }, () => {
      storageService.saveModule(module);
      return module;
    }),

  deleteModule: (id: string) =>
    withApiFallback(async () => {
      await apiRequest({
        method: 'DELETE',
        url: `/api/project-modules/${id}`,
      });
    }, () => storageService.deleteModule(id)),

  getRoles: (projectId?: string) =>
    withApiFallback(async () => {
      const projectDocumentId = projectId ? await getProjectDocumentId(projectId) : null;
      const roles = await listCollection('/api/project-persona-roles', {
        populate: 'project',
        ...(projectDocumentId ? { 'filters[project][documentId][$eq]': projectDocumentId } : {}),
      });

      return roles.map(mapRole);
    }, () => storageService.getRoles(projectId)),

  saveRole: (role: Role) =>
    withApiFallback(async () => {
      const saved = await createOrUpdateDocument(
        '/api/project-persona-roles',
        (role as any).documentId,
        {
          name: role.name,
          description: role.description,
          organization: relation(await getOrganizationDocumentId(role.projectId)),
          project: relation(await getProjectDocumentId(role.projectId)),
        }
      );

      return mapRole(saved);
    }, () => {
      storageService.saveRole(role);
      return role;
    }),

  deleteRole: (id: string) =>
    withApiFallback(async () => {
      await apiRequest({
        method: 'DELETE',
        url: `/api/project-persona-roles/${id}`,
      });
    }, () => storageService.deleteRole(id)),

  getSprints: (projectId?: string) =>
    withApiFallback(async () => {
      const projectDocumentId = projectId ? await getProjectDocumentId(projectId) : null;
      const sprints = await listCollection('/api/sprints', {
        populate: 'project',
        ...(projectDocumentId ? { 'filters[project][documentId][$eq]': projectDocumentId } : {}),
      });

      return sprints.map(mapSprint);
    }, () => storageService.getSprints(projectId)),

  saveSprint: (sprint: Sprint) =>
    withApiFallback(async () => {
      const saved = await createOrUpdateDocument('/api/sprints', (sprint as any).documentId, {
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprintStatusToApi(sprint.status),
        objective: sprint.objective,
        organization: relation(await getOrganizationDocumentId(sprint.projectId)),
        project: relation(await getProjectDocumentId(sprint.projectId)),
      });

      return mapSprint(saved);
    }, () => {
      storageService.saveSprint(sprint);
      return sprint;
    }),

  deleteSprint: (id: string) =>
    withApiFallback(async () => {
      await apiRequest({
        method: 'DELETE',
        url: `/api/sprints/${id}`,
      });
    }, () => storageService.deleteSprint(id)),

  getFunctionalities: (projectId?: string) =>
    withApiFallback(async () => {
      const projectDocumentId = projectId ? await getProjectDocumentId(projectId) : null;
      const functionalities = await listCollection('/api/functionalities', {
        ...populateParams(['project', 'module', 'personaRoles', 'sprint']),
        ...(projectDocumentId ? { 'filters[project][documentId][$eq]': projectDocumentId } : {}),
      });

      return functionalities.map(mapFunctionality);
    }, () => storageService.getFunctionalities(projectId)),

  saveFunctionality: (func: Functionality) =>
    withApiFallback(async () => {
      const module = (await getProjectModules(func.projectId)).find((item) => item.name === func.module);
      const sprint = (await getProjectSprints(func.projectId)).find((item) => item.name === func.sprint);
      const roles = (await getProjectRoles(func.projectId))
        .filter((item) => func.roles.includes(item.name))
        .map((item) => ({ documentId: item.documentId }));

      const saved = await createOrUpdateDocument(
        '/api/functionalities',
        (func as any).documentId,
        {
          code: func.id,
          name: func.name,
          testTypes: (func.testTypes || []).map(testTypeToApi),
          isRegression: func.isRegression,
          isSmoke: func.isSmoke,
          deliveryDate: func.deliveryDate,
          status: testStatusToApi(func.status),
          priority: priorityToApi(func.priority),
          riskLevel: riskToApi(func.riskLevel),
          storyLegacyId: func.storyId,
          organization: relation(await getOrganizationDocumentId(func.projectId)),
          project: relation(await getProjectDocumentId(func.projectId)),
          module: relation(module?.documentId),
          sprint: relation(sprint?.documentId),
          personaRoles: roles.length ? { connect: roles } : { disconnect: [] },
        }
      );

      return mapFunctionality(saved);
    }, () => {
      storageService.saveFunctionality(func);
      return func;
    }),

  deleteFunctionality: (id: string) =>
    withApiFallback(async () => {
      const functionalities = (await dataService.getFunctionalities()) as any[];
      const target = functionalities.find((item) => item.id === id);
      if (!target?.documentId) return;
      await apiRequest({
        method: 'DELETE',
        url: `/api/functionalities/${target.documentId}`,
      });
    }, () => storageService.deleteFunctionality(id)),

  bulkUpdateFunctionalities: (ids: string[], updates: Partial<Functionality>) =>
    withApiFallback(async () => {
      const functionalities = await dataService.getFunctionalities();
      const targets = functionalities.filter((item) => ids.includes(item.id));
      await Promise.all(
        targets.map((target) =>
          dataService.saveFunctionality({ ...(target as Functionality), ...updates })
        )
      );
    }, () => storageService.bulkUpdateFunctionalities(ids, updates)),

  bulkAddFunctionalities: (newFuncs: Functionality[]) =>
    withApiFallback(async () => {
      const existing = await dataService.getFunctionalities(newFuncs[0]?.projectId);
      const existingIds = new Set(existing.map((item) => item.id));
      const uniqueNewFuncs = newFuncs.filter((item) => !existingIds.has(item.id));
      await Promise.all(uniqueNewFuncs.map((item) => dataService.saveFunctionality(item)));
      return uniqueNewFuncs.length;
    }, () => storageService.bulkAddFunctionalities(newFuncs)),

  getTestCases: (projectId?: string, functionalityId?: string) =>
    withApiFallback(async () => {
      const projectDocumentId = projectId ? await getProjectDocumentId(projectId) : null;
      const testCases = await listCollection('/api/test-cases', {
        ...populateParams(['project', 'functionality']),
        ...(projectDocumentId ? { 'filters[project][documentId][$eq]': projectDocumentId } : {}),
      });

      let mapped = testCases.map(mapTestCase);
      if (functionalityId) {
        mapped = mapped.filter((item) => item.functionalityId === functionalityId);
      }
      return mapped;
    }, () => storageService.getTestCases(projectId, functionalityId)),

  saveTestCase: (testCase: TestCase) =>
    withApiFallback(async () => {
      const functionality = (await getProjectFunctionalities(testCase.projectId)).find(
        (item) => item.id === testCase.functionalityId
      );

      const saved = await createOrUpdateDocument('/api/test-cases', (testCase as any).documentId, {
        title: testCase.title,
        description: testCase.description,
        preconditions: testCase.preconditions,
        testSteps: testCase.testSteps,
        expectedResult: testCase.expectedResult,
        testType: testTypeToApi(testCase.testType),
        priority: priorityToApi(testCase.priority),
        isAutomated: Boolean(testCase.isAutomated),
        organization: relation(await getOrganizationDocumentId(testCase.projectId)),
        project: relation(await getProjectDocumentId(testCase.projectId)),
        functionality: relation(functionality?.documentId || functionality?.id),
      });

      return mapTestCase(saved);
    }, () => {
      storageService.saveTestCase(testCase);
      return testCase;
    }),

  deleteTestCase: (id: string) =>
    withApiFallback(async () => {
      await apiRequest({
        method: 'DELETE',
        url: `/api/test-cases/${id}`,
      });
    }, () => storageService.deleteTestCase(id)),

  getExecutions: (projectId?: string) => storageService.getExecutions(projectId),
  saveExecution: (exec: any) => storageService.saveExecution(exec),
  getRegressionCycles: (projectId?: string) => storageService.getRegressionCycles(projectId),
  saveRegressionCycle: (cycle: any) => storageService.saveRegressionCycle(cycle),
  getSmokeCycles: (projectId?: string) => storageService.getSmokeCycles(projectId),
  saveSmokeCycle: (cycle: any) => storageService.saveSmokeCycle(cycle),
  getTestPlans: (projectId?: string) => storageService.getTestPlans(projectId),
  saveTestPlan: (plan: any) => storageService.saveTestPlan(plan),
  deleteTestPlan: (id: string) => storageService.deleteTestPlan(id),
  getTestRuns: (projectId?: string) => storageService.getTestRuns(projectId),
  saveTestRun: (run: any) => storageService.saveTestRun(run),
  deleteTestRun: (id: string) => storageService.deleteTestRun(id),
  getMeetingNotes: (projectId?: string) => storageService.getMeetingNotes(projectId),
  saveMeetingNote: (note: any) => storageService.saveMeetingNote(note),
  deleteMeetingNote: (id: string) => storageService.deleteMeetingNote(id),
  getBugs: (projectId?: string) => storageService.getBugs(projectId),
  saveBug: (bug: any) => storageService.saveBug(bug),
  deleteBug: (internalBugId: string) => storageService.deleteBug(internalBugId),
};
