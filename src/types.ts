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
  MVP = 'MVP',
  POST_MVP = 'Post MVP',
}

export enum TestResult {
  PASSED = 'Aprobado',
  FAILED = 'Fallido',
  BLOCKED = 'Bloqueado',
  NOT_EXECUTED = 'No Ejecutado',
}

export enum ExecutionMode {
  MANUAL = 'Manual',
  AUTOMATED = 'Automatizada',
}

export enum ProjectStatus {
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  COMPLETED = 'Completed',
}

export interface Project {
  id: string;
  name: string;
  organizationName?: string;
  description: string;
  version: string;
  status: ProjectStatus;
  createdAt: string;
  icon?: string;
  logo?: string; // Base64 image
  teamMembers?: string[];
  purpose?: string;
  coreRequirements?: string[];
  businessRules?: string;
  aiProjectInsights?: string;
  aiWireframeBrief?: string;
  storyMapData?: import('./modules/storymap/types').StoryMapSnapshot;
}

export interface Functionality {
  documentId?: string;
  id: string;
  projectId: string;
  module: string;
  name: string;
  roles: string[];
  testTypes: TestType[];
  isCore?: boolean;
  isRegression: boolean;
  isSmoke: boolean;
  lastFunctionalChangeAt?: string;
  deliveryDate: string;
  status: TestStatus;
  priority: Priority;
  riskLevel: RiskLevel;
  sprint?: string;
  storyId?: string;
}

export interface TestCase {
  id: string;
  projectId: string;
  functionalityId: string;
  title: string;
  description: string;
  preconditions: string;
  testSteps: string;
  expectedResult: string;
  testType: TestType;
  priority: Priority;
  isAutomated?: boolean;
}

export interface TestCaseTemplate {
  id: string;
  projectId: string;
  moduleId: string;
  moduleName: string;
  name: string;
  description: string;
  preconditions: string;
  testSteps: string;
  expectedResult: string;
  testType: TestType;
  priority: Priority;
  isAutomated?: boolean;
}

export enum ExecutionStatus {
  DRAFT = 'Borrador',
  FINAL = 'Final',
}

export enum Priority {
  CRITICAL = 'Crítico',
  HIGH = 'Alto',
  MEDIUM = 'Medio',
  LOW = 'Bajo',
}

export enum RiskLevel {
  HIGH = 'Alto Riesgo',
  MEDIUM = 'Riesgo Medio',
  LOW = 'Bajo Riesgo',
}

export enum Severity {
  CRITICAL = 'Crítico',
  HIGH = 'Alto',
  MEDIUM = 'Medio',
  LOW = 'Bajo',
}

export enum FunctionalityScope {
  TOTAL = 'Total',
  PARTIAL = 'Parcial',
}

export enum CalendarEventType {
  TEST = 'Prueba',
  CLIENT_MEETING = 'Reunión con cliente',
  DEMO = 'Demo',
  ONBOARDING = 'Inducción',
  FOLLOW_UP = 'Seguimiento',
  REMINDER = 'Recordatorio',
}

export enum BugOrigin {
  GENERAL_EXECUTION = 'General Execution',
  REGRESSION_CYCLE = 'Regression Cycle',
  SMOKE_CYCLE = 'Smoke Cycle',
}

export enum BugStatus {
  PENDING = 'Pendiente',
  IN_PROGRESS = 'En curso',
  QA = 'QA',
  RESOLVED = 'Resuelto',
}

export enum Environment {
  TEST = 'Test',
  LOCAL = 'Local',
  PRODUCTION = 'Producción',
}

export interface TestPlan {
  id: string;
  projectId: string;
  eventType: CalendarEventType;
  title: string;
  scope?: FunctionalityScope;
  impactModules?: string[];
  sprint?: string;
  testType?: TestType;
  priority?: Priority;
  jiraId?: string;
  description: string;
  date: string;
  time?: string;
  attendees?: string;
  owner?: string;
}

export interface TestExecution {
  id: string;
  projectId: string;
  functionalityId: string;
  testCaseId?: string;
  testType: TestType;
  executed: boolean;
  result: TestResult;
  executionDate: string;
  tester: string;
  notes?: string;
  evidenceImage?: string;
  status: ExecutionStatus;
  scope?: FunctionalityScope;
  impactModules?: string[];
  sprint?: string;
  priority?: Priority;
  jiraId?: string;
  description?: string;
  bugId?: string;
  bugTitle?: string;
  bugLink?: string;
  severity?: Severity;
  linkedBugId?: string;
}

export interface TestRunResult {
  id: string;
  functionalityId: string;
  testCaseId: string;
  result: TestResult;
  notes?: string;
  evidenceImage?: string;
  bugId?: string;
  bugTitle?: string;
  bugLink?: string;
  severity?: Severity;
  linkedBugId?: string;
}

export interface TestRun {
  id: string;
  projectId: string;
  title: string;
  description: string;
  executionDate: string;
  status: ExecutionStatus;
  testType: TestType;
  sprint: string;
  priority: Priority;
  tester: string;
  buildVersion?: string;
  environment?: Environment;
  selectedModules: string[];
  selectedFunctionalities: string[]; // IDs
  results: TestRunResult[];
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
  testCaseId?: string; // New: Link to test case
  module: string;
  functionalityName: string;
  testCaseTitle?: string; // New: For display
  executionMode?: ExecutionMode;
  executed: boolean;
  date?: string;
  result: TestResult;
  evidence?: string; // Note
  evidenceImage?: string; // Base64 image
  bugId?: string;
  bugTitle?: string;
  bugLink?: string;
  severity?: Severity;
  linkedBugId?: string;
  assignedTesterName?: string;
  assignedTesterEmail?: string;
  updatedAt?: string;
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
  passRate: number;
  note: string;
  status: 'FINALIZADA' | 'EN_PROGRESO';
  sprint?: string;
  type?: 'REGRESSION' | 'SMOKE';
  tester?: string;
  buildVersion?: string;
  environment?: Environment;
  executions: RegressionExecution[];
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Planeado' | 'En Progreso' | 'Completado';
  objective: string;
}

export interface Role {
  id: string;
  projectId: string;
  name: string;
  description: string;
}

export interface Module {
  id: string;
  projectId: string;
  name: string;
  description: string;
}

export interface MeetingNote {
  id: string;
  projectId: string;
  title: string;
  date: string;
  time: string;
  participants: string;
  notes: string;
  aiSummary?: string;
  aiDecisions?: string;
  aiActions?: string;
  aiNextSteps?: string;
}

export interface PersonalNote {
  documentId?: string;
  activityDate: string;
  title: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QABug {
  internalBugId: string;
  externalBugId?: string;
  title: string;
  description?: string;
  severity?: Severity;
  bugLink?: string;
  evidenceImage?: string;
  origin: BugOrigin;
  projectId: string;
  functionalityId: string;
  functionalityName: string;
  module: string;
  sprint?: string;
  cycleId?: string;
  detectedAt: string;
  reportedBy?: string;
  status: BugStatus;
  testCaseId?: string;
  testCaseTitle?: string;
  testRunId?: string;
  executionId?: string;
  linkedSourceId?: string;
  updatedAt?: string;
}
