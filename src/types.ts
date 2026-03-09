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

export enum ProjectStatus {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  COMPLETED = 'Completed',
}

export interface Project {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ProjectStatus;
  createdAt: string;
  icon?: string;
  teamMembers?: string[];
  purpose?: string;
  coreRequirements?: string[];
  businessRules?: string;
}

export interface Functionality {
  id: string;
  projectId: string;
  module: string;
  name: string;
  roles: string[];
  testTypes: TestType[];
  isRegression: boolean;
  isSmoke: boolean;
  deliveryDate: string;
  status: TestStatus;
}

export enum ExecutionStatus {
  DRAFT = 'Borrador',
  FINAL = 'Final',
}

export enum Priority {
  LOW = 'Bajo',
  MEDIUM = 'Medio',
  HIGH = 'Alto',
}

export enum FunctionalityScope {
  TOTAL = 'Total',
  PARTIAL = 'Parcial',
}

export interface TestPlan {
  id: string;
  projectId: string;
  title: string;
  scope: FunctionalityScope;
  impactModules: string[];
  sprint: string;
  testType: TestType;
  priority: Priority;
  jiraId?: string;
  description: string;
  date: string;
}

export interface TestExecution {
  id: string;
  projectId: string;
  functionalityId: string;
  testType: TestType;
  executed: boolean;
  result: TestResult;
  executionDate: string;
  notes?: string;
  evidenceImage?: string;
  status: ExecutionStatus;
  scope?: FunctionalityScope;
  impactModules?: string[];
  sprint?: string;
  priority?: Priority;
  jiraId?: string;
  description?: string;
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
  evidence?: string; // Note
  evidenceImage?: string; // Base64 image
}

export interface RegressionCycle {
  id: string;
  projectId: string;
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
