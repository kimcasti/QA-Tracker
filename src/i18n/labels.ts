import type { TFunction } from 'i18next';
import {
  Environment,
  ExecutionStatus,
  Priority,
  RiskLevel,
  TestResult,
  TestStatus,
} from '../types';

export function labelTestStatus(value: TestStatus | string | undefined, t: TFunction) {
  switch (value) {
    case TestStatus.BACKLOG:
      return t('status.backlog');
    case TestStatus.POST_MVP:
      return t('status.post_mvp');
    case TestStatus.IN_PROGRESS:
      return t('status.in_progress');
    case TestStatus.COMPLETED:
      return t('status.completed');
    case TestStatus.FAILED:
      return t('status.failed');
    case TestStatus.MVP:
      return t('status.mvp');
    default:
      return value || '';
  }
}

export function labelPriority(value: Priority | string | undefined, t: TFunction) {
  switch (value) {
    case Priority.CRITICAL:
      return t('priority.critical');
    case Priority.HIGH:
      return t('priority.high');
    case Priority.MEDIUM:
      return t('priority.medium');
    case Priority.LOW:
      return t('priority.low');
    default:
      return value || '';
  }
}

export function labelRisk(value: RiskLevel | string | undefined, t: TFunction) {
  switch (value) {
    case RiskLevel.HIGH:
      return t('risk.high');
    case RiskLevel.MEDIUM:
      return t('risk.medium');
    case RiskLevel.LOW:
      return t('risk.low');
    default:
      return value || '';
  }
}

export function labelTestResult(value: TestResult | string | undefined, t: TFunction) {
  switch (value) {
    case TestResult.PASSED:
      return t('test_result.passed');
    case TestResult.FAILED:
      return t('test_result.failed');
    case TestResult.BLOCKED:
      return t('test_result.blocked');
    case TestResult.NOT_EXECUTED:
      return t('test_result.not_executed');
    default:
      return value || '';
  }
}

export function labelExecutionStatus(value: ExecutionStatus | string | undefined, t: TFunction) {
  switch (value) {
    case ExecutionStatus.DRAFT:
      return t('execution_status.draft');
    case ExecutionStatus.FINAL:
      return t('execution_status.final');
    default:
      return value || '';
  }
}

export function labelEnvironment(value: Environment | string | undefined, t: TFunction) {
  switch (value) {
    case Environment.TEST:
      return t('environment.test');
    case Environment.LOCAL:
      return t('environment.local');
    case Environment.PRODUCTION:
      return t('environment.production');
    default:
      return value || '';
  }
}

