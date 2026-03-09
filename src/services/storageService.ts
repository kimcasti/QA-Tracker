import { Functionality, TestExecution, TestResult, TestStatus, TestType, RegressionCycle, ExecutionStatus, TestPlan, Project, ProjectStatus, Priority, RiskLevel, TestCase } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'qa_tracker_projects',
  FUNCTIONALITIES: 'qa_tracker_functionalities',
  TEST_CASES: 'qa_tracker_test_cases',
  EXECUTIONS: 'qa_tracker_executions',
  REGRESSION_CYCLES: 'qa_tracker_regression_cycles',
  SMOKE_CYCLES: 'qa_tracker_smoke_cycles',
  TEST_PLANS: 'qa_tracker_test_plans',
};

// Initial Mock Data if empty
const INITIAL_PROJECTS: Project[] = [
  {
    id: 'P1',
    name: 'Nexus Core Platform',
    description: 'Main enterprise platform for core services.',
    version: 'v2.4.0',
    status: ProjectStatus.ACTIVE,
    createdAt: '2024-01-15',
    icon: 'RocketOutlined',
    purpose: 'To provide a robust and scalable core platform for all enterprise services.',
    coreRequirements: [
      'Biometric Authentication (FaceID / TouchID)',
      'Stripe Payment Integration',
      'Order Tracking'
    ],
    businessRules: 'User cannot checkout if cart is below $5\nCoupons must match region\nStock must update after purchase'
  }
];

const INITIAL_FUNCTIONALITIES: Functionality[] = [
  { id: 'AUTH-01', projectId: 'P1', module: 'Login', name: 'Inicio de sesión', roles: ['Todos'], testTypes: [TestType.REGRESSION, TestType.SMOKE], isRegression: true, isSmoke: true, deliveryDate: '2025-02-02', status: TestStatus.COMPLETED, priority: Priority.HIGH, riskLevel: RiskLevel.MEDIUM },
  { id: 'PAT-01', projectId: 'P1', module: 'Pacientes', name: 'Lista de pacientes', roles: ['Todos'], testTypes: [TestType.REGRESSION, TestType.SMOKE], isRegression: true, isSmoke: true, deliveryDate: '2025-02-02', status: TestStatus.COMPLETED, priority: Priority.MEDIUM, riskLevel: RiskLevel.LOW },
  { id: 'CLN-06', projectId: 'P1', module: 'Sección-Clínica', name: 'Agregar Cita', roles: ['Manejador'], testTypes: [TestType.REGRESSION], isRegression: true, isSmoke: false, deliveryDate: '2025-02-20', status: TestStatus.FAILED, priority: Priority.CRITICAL, riskLevel: RiskLevel.HIGH },
];

const INITIAL_EXECUTIONS: TestExecution[] = [
  { id: '1', projectId: 'P1', functionalityId: 'AUTH-01', testType: TestType.SMOKE, executed: true, result: TestResult.PASSED, executionDate: '2025-02-24', status: ExecutionStatus.FINAL, tester: 'Admin' },
  { id: '2', projectId: 'P1', functionalityId: 'PAT-01', testType: TestType.REGRESSION, executed: true, result: TestResult.PASSED, executionDate: '2025-02-20', status: ExecutionStatus.FINAL, tester: 'Admin' },
  { id: '3', projectId: 'P1', functionalityId: 'CLN-06', testType: TestType.FUNCTIONAL, executed: true, result: TestResult.FAILED, executionDate: '2025-02-20', status: ExecutionStatus.FINAL, tester: 'Admin' },
];

const INITIAL_REGRESSION_CYCLES: RegressionCycle[] = [
  { id: '1', projectId: 'P1', cycleId: 'C-48', date: '2024-05-12', totalTests: 240, passed: 215, failed: 18, blocked: 7, pending: 0, approvalRate: 89.5, note: 'Estabilidad en el módulo de autenticación mejorada.', status: 'FINALIZADA', sprint: 'Sprint 24', executions: [] },
  { id: '2', projectId: 'P1', cycleId: 'C-47', date: '2024-04-28', totalTests: 235, passed: 210, failed: 15, blocked: 10, pending: 0, approvalRate: 89.3, note: 'Integración con API de terceros validada.', status: 'FINALIZADA', sprint: 'Sprint 23', executions: [] },
  { id: '3', projectId: 'P1', cycleId: 'C-46', date: '2024-04-14', totalTests: 235, passed: 180, failed: 45, blocked: 10, pending: 0, approvalRate: 76.5, note: 'Bloqueante crítico en pasarela de pagos.', status: 'FINALIZADA', sprint: 'Sprint 22', executions: [] },
  { id: '4', projectId: 'P1', cycleId: 'C-45', date: '2024-03-30', totalTests: 220, passed: 205, failed: 5, blocked: 10, pending: 0, approvalRate: 93.1, note: 'Regresión de hotfix exitosa.', status: 'FINALIZADA', sprint: 'Sprint 21', executions: [] },
];

const INITIAL_SMOKE_CYCLES: RegressionCycle[] = [
  { id: 's1', projectId: 'P1', cycleId: 'S-12', date: '2024-05-15', totalTests: 45, passed: 42, failed: 2, blocked: 1, pending: 0, approvalRate: 93.3, note: 'Smoke test post-despliegue de versión 2.4.', status: 'FINALIZADA', sprint: 'Sprint 24', executions: [] },
  { id: 's2', projectId: 'P1', cycleId: 'S-11', date: '2024-05-01', totalTests: 45, passed: 45, failed: 0, blocked: 0, pending: 0, approvalRate: 100, note: 'Validación de flujos críticos de pago.', status: 'FINALIZADA', sprint: 'Sprint 23', executions: [] },
];

export const storageService = {
  getProjects: (): Project[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(INITIAL_PROJECTS));
      return INITIAL_PROJECTS;
    }
    return JSON.parse(data);
  },

  saveProject: (project: Project) => {
    const projects = storageService.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index > -1) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },

  deleteProject: (id: string) => {
    const projects = storageService.getProjects().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },

  getFunctionalities: (projectId?: string): Functionality[] => {
    const data = localStorage.getItem(STORAGE_KEYS.FUNCTIONALITIES);
    const all = data ? JSON.parse(data) : INITIAL_FUNCTIONALITIES;
    if (!data) localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(INITIAL_FUNCTIONALITIES));
    return projectId ? all.filter((f: any) => f.projectId === projectId) : all;
  },

  saveFunctionality: (func: Functionality) => {
    const data = localStorage.getItem(STORAGE_KEYS.FUNCTIONALITIES);
    const functionalities = data ? JSON.parse(data) : INITIAL_FUNCTIONALITIES;
    const index = functionalities.findIndex((f: any) => f.id === func.id);
    if (index > -1) {
      functionalities[index] = func;
    } else {
      functionalities.push(func);
    }
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(functionalities));
  },

  deleteFunctionality: (id: string) => {
    const functionalities = storageService.getFunctionalities().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(functionalities));
  },

  bulkUpdateFunctionalities: (ids: string[], updates: Partial<Functionality>) => {
    const functionalities = storageService.getFunctionalities();
    const updated = functionalities.map(f => {
      if (ids.includes(f.id)) {
        return { ...f, ...updates };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(updated));
  },

  bulkAddFunctionalities: (newFuncs: Functionality[]) => {
    const functionalities = storageService.getFunctionalities();
    const existingIds = new Set(functionalities.map(f => f.id));
    const uniqueNewFuncs = newFuncs.filter(f => !existingIds.has(f.id));
    const updated = [...functionalities, ...uniqueNewFuncs];
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(updated));
    return uniqueNewFuncs.length;
  },

  getExecutions: (projectId?: string): TestExecution[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EXECUTIONS);
    const all = data ? JSON.parse(data) : INITIAL_EXECUTIONS;
    if (!data) localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(INITIAL_EXECUTIONS));
    return projectId ? all.filter((e: any) => e.projectId === projectId) : all;
  },

  saveExecution: (exec: TestExecution) => {
    const data = localStorage.getItem(STORAGE_KEYS.EXECUTIONS);
    const executions = data ? JSON.parse(data) : INITIAL_EXECUTIONS;
    const index = executions.findIndex((e: any) => e.id === exec.id);
    if (index > -1) {
      executions[index] = exec;
    } else {
      executions.push(exec);
    }
    localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(executions));
  },

  getRegressionCycles: (projectId?: string): RegressionCycle[] => {
    const data = localStorage.getItem(STORAGE_KEYS.REGRESSION_CYCLES);
    const all = data ? JSON.parse(data) : INITIAL_REGRESSION_CYCLES;
    if (!data) localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(INITIAL_REGRESSION_CYCLES));
    return projectId ? all.filter((c: any) => c.projectId === projectId) : all;
  },

  saveRegressionCycle: (cycle: RegressionCycle) => {
    const data = localStorage.getItem(STORAGE_KEYS.REGRESSION_CYCLES);
    const cycles = data ? JSON.parse(data) : INITIAL_REGRESSION_CYCLES;
    const index = cycles.findIndex((c: any) => c.id === cycle.id);
    if (index > -1) {
      cycles[index] = cycle;
    } else {
      cycles.push(cycle);
    }
    localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(cycles));
  },

  getSmokeCycles: (projectId?: string): RegressionCycle[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SMOKE_CYCLES);
    const all = data ? JSON.parse(data) : INITIAL_SMOKE_CYCLES;
    if (!data) localStorage.setItem(STORAGE_KEYS.SMOKE_CYCLES, JSON.stringify(INITIAL_SMOKE_CYCLES));
    return projectId ? all.filter((c: any) => c.projectId === projectId) : all;
  },

  saveSmokeCycle: (cycle: RegressionCycle) => {
    const data = localStorage.getItem(STORAGE_KEYS.SMOKE_CYCLES);
    const cycles = data ? JSON.parse(data) : INITIAL_SMOKE_CYCLES;
    const index = cycles.findIndex((c: any) => c.id === cycle.id);
    if (index > -1) {
      cycles[index] = cycle;
    } else {
      cycles.push(cycle);
    }
    localStorage.setItem(STORAGE_KEYS.SMOKE_CYCLES, JSON.stringify(cycles));
  },

  getTestPlans: (projectId?: string): TestPlan[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TEST_PLANS);
    const all = data ? JSON.parse(data) : [];
    return projectId ? all.filter((p: any) => p.projectId === projectId) : all;
  },

  saveTestPlan: (plan: TestPlan) => {
    const plans = storageService.getTestPlans();
    const index = plans.findIndex(p => p.id === plan.id);
    if (index > -1) {
      plans[index] = plan;
    } else {
      plans.push(plan);
    }
    localStorage.setItem(STORAGE_KEYS.TEST_PLANS, JSON.stringify(plans));
  },

  deleteTestPlan: (id: string) => {
    const plans = storageService.getTestPlans().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.TEST_PLANS, JSON.stringify(plans));
  },

  getTestCases: (projectId?: string, functionalityId?: string): TestCase[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TEST_CASES);
    const all = data ? JSON.parse(data) : [];
    let filtered = all;
    if (projectId) filtered = filtered.filter((tc: any) => tc.projectId === projectId);
    if (functionalityId) filtered = filtered.filter((tc: any) => tc.functionalityId === functionalityId);
    return filtered;
  },

  saveTestCase: (testCase: TestCase) => {
    const data = localStorage.getItem(STORAGE_KEYS.TEST_CASES);
    const testCases = data ? JSON.parse(data) : [];
    const index = testCases.findIndex((tc: any) => tc.id === testCase.id);
    if (index > -1) {
      testCases[index] = testCase;
    } else {
      testCases.push(testCase);
    }
    localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(testCases));
  },

  deleteTestCase: (id: string) => {
    const data = localStorage.getItem(STORAGE_KEYS.TEST_CASES);
    const testCases = data ? JSON.parse(data) : [];
    const filtered = testCases.filter((tc: any) => tc.id !== id);
    localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(filtered));
  },
};
