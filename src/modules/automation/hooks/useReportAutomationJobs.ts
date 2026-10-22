import { useQuery } from '@tanstack/react-query';
import { ExecutionStatus, TestType, type TestRun } from '../../../types';
import { getReportAutomationJobs } from '../services/reportAutomationJobs';

export function useReportAutomationJobs(projectId: string, runs: TestRun[], sprint?: string | null) {
  const sprintKey = (value?: string | null) => (value || '').trim().toLowerCase().replace(/^sprint\s*/i, '');
  const scopedRuns = runs.filter(run => run.status === ExecutionStatus.FINAL &&
    [TestType.SMOKE, TestType.REGRESSION].includes(run.testType) &&
    (!sprint || sprintKey(run.sprint) === sprintKey(sprint)));
  const runIds = [...new Set(scopedRuns.map(run => (run as TestRun & { documentId?: string }).documentId || run.id))].sort();
  return useQuery({
    queryKey: ['report-automation-jobs', projectId, sprintKey(sprint), runIds],
    queryFn: () => getReportAutomationJobs(scopedRuns),
    enabled: Boolean(projectId) && runIds.length > 0,
    retry: false,
  });
}
