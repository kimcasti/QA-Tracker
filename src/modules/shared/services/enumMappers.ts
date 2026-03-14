import dayjs from 'dayjs';
import {
  BugOrigin,
  BugStatus,
  Environment,
  ExecutionStatus,
  FunctionalityScope,
  Priority,
  ProjectStatus,
  RiskLevel,
  Severity,
  TestResult,
  TestStatus,
  TestType,
  type Sprint,
} from '../../../types';

export function projectStatusToApi(status: ProjectStatus) {
  return {
    [ProjectStatus.ACTIVE]: 'active',
    [ProjectStatus.PAUSED]: 'paused',
    [ProjectStatus.COMPLETED]: 'completed',
  }[status];
}

export function projectStatusFromApi(status?: string) {
  return (
    {
      active: ProjectStatus.ACTIVE,
      paused: ProjectStatus.PAUSED,
      completed: ProjectStatus.COMPLETED,
    }[status || ''] || ProjectStatus.ACTIVE
  );
}

export function testStatusToApi(status: TestStatus) {
  return {
    [TestStatus.COMPLETED]: 'completed',
    [TestStatus.FAILED]: 'failed',
    [TestStatus.IN_PROGRESS]: 'in_progress',
    [TestStatus.BACKLOG]: 'backlog',
    [TestStatus.MVP]: 'mvp',
    [TestStatus.POST_MVP]: 'post_mvp',
  }[status];
}

export function testStatusFromApi(status?: string) {
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

export function priorityToApi(priority: Priority) {
  return {
    [Priority.CRITICAL]: 'critical',
    [Priority.HIGH]: 'high',
    [Priority.MEDIUM]: 'medium',
    [Priority.LOW]: 'low',
  }[priority];
}

export function priorityFromApi(priority?: string) {
  return (
    {
      critical: Priority.CRITICAL,
      high: Priority.HIGH,
      medium: Priority.MEDIUM,
      low: Priority.LOW,
    }[priority || ''] || Priority.MEDIUM
  );
}

export function riskToApi(risk: RiskLevel) {
  return {
    [RiskLevel.HIGH]: 'high',
    [RiskLevel.MEDIUM]: 'medium',
    [RiskLevel.LOW]: 'low',
  }[risk];
}

export function riskFromApi(risk?: string) {
  return (
    {
      high: RiskLevel.HIGH,
      medium: RiskLevel.MEDIUM,
      low: RiskLevel.LOW,
    }[risk || ''] || RiskLevel.MEDIUM
  );
}

export function testTypeToApi(type: TestType) {
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

export function testTypeFromApi(type?: string) {
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

export function sprintStatusToApi(status: Sprint['status']) {
  return {
    Planeado: 'planned',
    'En Progreso': 'in_progress',
    Completado: 'completed',
  }[status];
}

export function sprintStatusFromApi(status?: string): Sprint['status'] {
  return (
    {
      planned: 'Planeado',
      in_progress: 'En Progreso',
      completed: 'Completado',
    }[status || ''] || 'Planeado'
  ) as Sprint['status'];
}

export function executionStatusToApi(status: ExecutionStatus) {
  return {
    [ExecutionStatus.DRAFT]: 'draft',
    [ExecutionStatus.FINAL]: 'final',
  }[status];
}

export function executionStatusFromApi(status?: string) {
  return (
    {
      draft: ExecutionStatus.DRAFT,
      final: ExecutionStatus.FINAL,
    }[status || ''] || ExecutionStatus.DRAFT
  );
}

export function environmentToApi(environment?: Environment) {
  if (!environment) return undefined;

  return {
    [Environment.TEST]: 'test',
    [Environment.LOCAL]: 'local',
    [Environment.PRODUCTION]: 'production',
  }[environment];
}

export function environmentFromApi(environment?: string) {
  return (
    {
      test: Environment.TEST,
      local: Environment.LOCAL,
      production: Environment.PRODUCTION,
    }[environment || ''] || undefined
  );
}

export function testResultToApi(result: TestResult) {
  return {
    [TestResult.PASSED]: 'passed',
    [TestResult.FAILED]: 'failed',
    [TestResult.BLOCKED]: 'blocked',
    [TestResult.NOT_EXECUTED]: 'not_executed',
  }[result];
}

export function testResultFromApi(result?: string) {
  return (
    {
      passed: TestResult.PASSED,
      failed: TestResult.FAILED,
      blocked: TestResult.BLOCKED,
      not_executed: TestResult.NOT_EXECUTED,
    }[result || ''] || TestResult.NOT_EXECUTED
  );
}

export function severityToApi(severity?: Severity) {
  if (!severity) return undefined;

  return {
    [Severity.CRITICAL]: 'critical',
    [Severity.HIGH]: 'high',
    [Severity.MEDIUM]: 'medium',
    [Severity.LOW]: 'low',
  }[severity];
}

export function severityFromApi(severity?: string) {
  return (
    {
      critical: Severity.CRITICAL,
      high: Severity.HIGH,
      medium: Severity.MEDIUM,
      low: Severity.LOW,
    }[severity || ''] || undefined
  );
}

export function bugOriginToApi(origin: BugOrigin) {
  return {
    [BugOrigin.GENERAL_EXECUTION]: 'general_execution',
    [BugOrigin.REGRESSION_CYCLE]: 'regression_cycle',
    [BugOrigin.SMOKE_CYCLE]: 'smoke_cycle',
  }[origin];
}

export function bugOriginFromApi(origin?: string) {
  return (
    {
      general_execution: BugOrigin.GENERAL_EXECUTION,
      regression_cycle: BugOrigin.REGRESSION_CYCLE,
      smoke_cycle: BugOrigin.SMOKE_CYCLE,
    }[origin || ''] || BugOrigin.GENERAL_EXECUTION
  );
}

export function bugStatusToApi(status: BugStatus) {
  return {
    [BugStatus.PENDING]: 'pending',
    [BugStatus.IN_PROGRESS]: 'in_progress',
    [BugStatus.QA]: 'qa',
    [BugStatus.RESOLVED]: 'resolved',
  }[status];
}

export function bugStatusFromApi(status?: string) {
  return (
    {
      pending: BugStatus.PENDING,
      in_progress: BugStatus.IN_PROGRESS,
      qa: BugStatus.QA,
      resolved: BugStatus.RESOLVED,
    }[status || ''] || BugStatus.PENDING
  );
}

export function functionalityScopeToApi(scope: FunctionalityScope) {
  return {
    [FunctionalityScope.TOTAL]: 'total',
    [FunctionalityScope.PARTIAL]: 'partial',
  }[scope];
}

export function functionalityScopeFromApi(scope?: string) {
  return (
    {
      total: FunctionalityScope.TOTAL,
      partial: FunctionalityScope.PARTIAL,
    }[scope || ''] || FunctionalityScope.TOTAL
  );
}

export function cycleTypeToApi(type?: 'REGRESSION' | 'SMOKE') {
  if (!type) return undefined;
  return type === 'REGRESSION' ? 'regression' : 'smoke';
}

export function cycleTypeFromApi(type?: string): 'REGRESSION' | 'SMOKE' {
  return type === 'smoke' ? 'SMOKE' : 'REGRESSION';
}

export function cycleStatusToApi(status: 'FINALIZADA' | 'EN_PROGRESO') {
  return status === 'FINALIZADA' ? 'completed' : 'in_progress';
}

export function cycleStatusFromApi(status?: string): 'FINALIZADA' | 'EN_PROGRESO' {
  return status === 'completed' ? 'FINALIZADA' : 'EN_PROGRESO';
}

export function ensureIsoDate(value?: string) {
  if (!value) return dayjs().format('YYYY-MM-DD');
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
}
