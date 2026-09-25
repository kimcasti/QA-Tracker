import { Http } from '../../../config/http';

export interface RunnerCase { resultId: string; caseId: string; reference: string; title: string; module?: string }
export interface AutomationRunner { id: number; label: string; online: boolean; busy: boolean; catalog: string[] }
export interface AutomationJob {
  id: number; runId: string; runnerId: number;
  state: 'pending' | 'running' | 'completed' | 'interrupted';
  cases: RunnerCase[]; completedCount: number; message?: string;
  startedAt?: string | null; finishedAt?: string | null;
  outcomes?: { automationReference: string; status: string; notes?: string; evidenceImage?: string }[];
}
export interface RunnerInspection {
  runners: AutomationRunner[]; cases: RunnerCase[]; duplicateReferences: string[];
  jobs: AutomationJob[]; canRun: boolean;
}
export const runnerService = {
  details: async (runId: string, jobId: number) =>
    (await Http.get<{ data: AutomationJob }>(`/api/automation-runs/${encodeURIComponent(runId)}/jobs/${jobId}`)).data.data,
  inspect: async (runId: string) =>
    (await Http.get<{ data: RunnerInspection }>(`/api/automation-runs/${encodeURIComponent(runId)}/runner`)).data.data,
  enqueue: async (runId: string, data: { runnerId: number; caseIds: string[]; requestId: string }) =>
    (await Http.post<{ data: AutomationJob }>(`/api/automation-runs/${encodeURIComponent(runId)}/jobs`, { data })).data.data,
};
export function runnerReferenceProblem(reference: string, runner?: AutomationRunner, duplicates: string[] = []) {
  if (!reference) return 'Falta la referencia';
  if (!runner) return 'Selecciona un ejecutor';
  const matches = runner.catalog.filter(item => item === reference).length;
  if (!matches) return 'Referencia inexistente';
  if (matches > 1 || duplicates.includes(reference)) return 'Referencia ambigua';
  return null;
}
