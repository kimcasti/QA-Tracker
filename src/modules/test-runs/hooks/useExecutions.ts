import { useQuery } from '@tanstack/react-query';
import type { TestExecution, TestRun } from '../../../types';
import { ExecutionStatus, FunctionalityScope, TestResult } from '../../../types';
import { getTestRuns } from '../services/testRunsService';

function mapRunsToExecutions(testRuns: TestRun[]): TestExecution[] {
  return testRuns.flatMap((testRun) =>
    (testRun.results || []).map((result) => ({
      id: result.id || `${testRun.id}-${result.testCaseId || result.functionalityId}`,
      projectId: testRun.projectId,
      functionalityId: result.functionalityId,
      testCaseId: result.testCaseId,
      testType: testRun.testType,
      executed: result.result !== TestResult.NOT_EXECUTED,
      result: result.result,
      executionDate: testRun.executionDate,
      tester: testRun.tester,
      notes: result.notes,
      evidenceImage: result.evidenceImage,
      status: testRun.status || ExecutionStatus.DRAFT,
      scope: FunctionalityScope.TOTAL,
      impactModules: testRun.selectedModules,
      sprint: testRun.sprint,
      priority: testRun.priority,
      description: testRun.description,
      bugId: result.bugId,
      bugTitle: result.bugTitle,
      bugLink: result.bugLink,
      severity: result.severity,
      linkedBugId: result.linkedBugId,
    })),
  );
}

export function useExecutions(projectId?: string) {
  return useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: () => getTestRuns(projectId),
    enabled: Boolean(projectId),
    select: mapRunsToExecutions,
  });
}
