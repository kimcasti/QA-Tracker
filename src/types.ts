export enum TestType {
  INTEGRATION = 'Integración',
  FUNCTIONAL = 'Funcional',
  SANITY = 'Sanity',
  REGRESSION = 'Regresión',
  SMOKE = 'Smoke',
  EXPLORATORY = 'Exploratoria',
  UAT = 'UAT',
}

export enum TestStatus {
  COMPLETED = 'Completado',
  FAILED = 'Fallido',
  IN_PROGRESS = 'En desarrollo',
  BACKLOG = 'Backlog',
  POST_MVP = 'Post MVP',
}

export enum TestResult {
  PASSED = 'Aprobado',
  FAILED = 'Fallido',
  BLOCKED = 'Bloqueado',
  NOT_EXECUTED = 'No Ejecutado',
}

export interface Functionality {
  id: string;
  module: string;
  name: string;
  roles: string[];
  testTypes: TestType[];
  isRegression: boolean;
  isSmoke: boolean;
  deliveryDate: string;
  status: TestStatus;
}

export interface TestExecution {
  id: string;
  functionalityId: string;
  testType: TestType;
  executed: boolean;
  result: TestResult;
  executionDate: string;
  notes?: string;
}

export interface DashboardMetrics {
  totalFunctionalities: number;
  executedCount: number;
  notExecutedCount: number;
  passedCount: number;
  failedCount: number;
  byStatus: Record<TestStatus, number>;
  byType: Record<TestType, number>;
}

export interface RegressionExecution {
  id: string;
  functionalityId: string;
  module: string;
  functionalityName: string;
  executed: boolean;
  date?: string;
  result: TestResult;
  evidence?: string; // Link or note
}

export interface RegressionCycle {
  id: string;
  cycleId: string;
  date: string;
  totalTests: number;
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  approvalRate: number;
  note: string;
  status: 'FINALIZADA' | 'EN_PROGRESO';
  sprint?: string;
  executions: RegressionExecution[];
}
