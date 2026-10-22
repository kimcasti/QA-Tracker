import { Http } from '../../../config/http';
import { automationReportTimestamp } from '../../../utils/automationReportTimestamp';
import type { TestRun } from '../../../types';
import { ExecutionStatus, TestType } from '../../../types';
import type { AutomationJob, RunnerCase } from './runnerService';

// The report endpoint deliberately omits runner IDs, titles, notes and evidence.
export type ReportAutomationJob = Pick<AutomationJob, 'id' | 'runId' | 'finishedAt' | 'completedCount'> & {
  state: 'completed';
  cases: Pick<RunnerCase, 'caseId' | 'resultId' | 'reference'>[];
  outcomes: Pick<NonNullable<AutomationJob['outcomes']>[number], 'automationReference' | 'status'>[];
};
type ReportJobsPage = { jobs: ReportAutomationJob[]; pagination: { page: number; pageSize: number; total: number; pageCount: number } };
const invalidHistory = () => new Error('Historial automático incompleto o inválido. No se puede calcular la tasa de aprobación.');
const nonempty = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());

function validJob(job: ReportAutomationJob, runId: string) {
  if (!job || !Number.isSafeInteger(job.id) || job.id < 1 || job.runId !== runId || job.state !== 'completed' ||
      !nonempty(job.finishedAt) || !Number.isFinite(automationReportTimestamp(job.finishedAt)) ||
      !Array.isArray(job.cases) || !job.cases.length || !Array.isArray(job.outcomes) ||
      job.completedCount !== job.cases.length || job.outcomes.length !== job.cases.length) return false;
  if (job.cases.some(item => !item || !nonempty(item.caseId) || !nonempty(item.resultId) || !nonempty(item.reference)) ||
      new Set(job.cases.map(item => item.caseId)).size !== job.cases.length ||
      new Set(job.cases.map(item => item.resultId)).size !== job.cases.length) return false;
  const references = new Set(job.cases.map(item => item.reference));
  return references.size === job.cases.length && job.outcomes.every(item => item && references.has(item.automationReference) &&
    ['passed', 'failed', 'skipped', 'unknown'].includes(item.status)) &&
    new Set(job.outcomes.map(item => item.automationReference)).size === references.size;
}

/** Session JWT + tenant READ endpoint. Never inspect runners, expire jobs or enqueue. */
export async function getReportAutomationJobs(runs: TestRun[]): Promise<ReportAutomationJob[]> {
  const jobs: ReportAutomationJob[] = [];
  const seenRuns = new Set<string>();
  for (const run of runs) {
    if (run.status !== ExecutionStatus.FINAL || ![TestType.SMOKE, TestType.REGRESSION].includes(run.testType)) continue;
    const runId = (run as TestRun & { documentId?: string }).documentId || run.id;
    if (seenRuns.has(runId)) continue;
    seenRuns.add(runId);
    let total: number | undefined;
    let pageCount = 1;
    const seen = new Set<number>();
    for (let page = 1; page <= pageCount; page++) {
      const response = await Http.get<{ data: ReportJobsPage }>(`/api/test-runs/${encodeURIComponent(runId)}/automation-report-jobs`, {
        params: { page, pageSize: 100 },
      });
      const data = response.data?.data;
      const pagination = data?.pagination;
      if (!data || !Array.isArray(data.jobs) || !pagination || pagination.page !== page || pagination.pageSize !== 100 ||
          !Number.isSafeInteger(pagination.total) || pagination.total < 0 ||
          !Number.isSafeInteger(pagination.pageCount) ||
          !(pagination.pageCount === Math.ceil(pagination.total / 100) || (pagination.total === 0 && pagination.pageCount === 1)) ||
          (total !== undefined && (pagination.total !== total || pagination.pageCount !== pageCount)) ||
          data.jobs.length !== Math.min(100, Math.max(0, pagination.total - (page - 1) * 100))) throw invalidHistory();
      total = pagination.total;
      pageCount = pagination.pageCount;
      for (const job of data.jobs) {
        if (!validJob(job, runId) || seen.has(job.id)) throw invalidHistory();
        seen.add(job.id);
        jobs.push(job);
      }
    }
    if (seen.size !== total) throw invalidHistory();
  }
  return jobs;
}
