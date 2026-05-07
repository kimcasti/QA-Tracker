import { Http, toApiError } from '../../../config/http';
import { queryClient } from '../../../config/query';
import {
  findProjectContext,
  invalidateWorkspaceCache,
} from '../../workspace/services/workspaceService';

export type PlanReportAccessKey =
  | 'qaStatusSummary'
  | 'qaProgress'
  | 'executiveProjectStatus'
  | 'deliveryUnitProgress';

async function postWithFriendlyError<T>(path: string, data: Record<string, unknown>) {
  try {
    const response = await Http.post(path, { data });
    return response.data?.data as T;
  } catch (error) {
    throw new Error(toApiError(error).message);
  }
}

async function resolveProjectDocumentId(projectId: string) {
  const context = await findProjectContext(projectId);
  return context?.documentId || projectId;
}

export async function authorizeAiAccess(projectId: string) {
  const resolvedProjectId = await resolveProjectDocumentId(projectId);
  return postWithFriendlyError<{ allowed: boolean; plan: string; feature: 'ai' }>(
    '/api/plan-access/ai',
    { projectId: resolvedProjectId },
  );
}

export async function authorizeReportAccess(projectId: string, report: PlanReportAccessKey) {
  const resolvedProjectId = await resolveProjectDocumentId(projectId);
  return postWithFriendlyError<{ allowed: boolean; plan: string; report: PlanReportAccessKey }>(
    '/api/plan-access/report',
    { projectId: resolvedProjectId, report },
  );
}

export async function authorizeExportAccess(projectId: string) {
  const resolvedProjectId = await resolveProjectDocumentId(projectId);
  return postWithFriendlyError<{ allowed: boolean; plan: string; feature: 'exports' }>(
    '/api/plan-access/export',
    { projectId: resolvedProjectId },
  );
}

export async function consumeExportUsage(projectId: string, amount = 1) {
  const resolvedProjectId = await resolveProjectDocumentId(projectId);
  const result = await postWithFriendlyError<{ usedThisMonth: number; resetAt: string | null }>(
    '/api/plan-access/export/consume',
    { projectId: resolvedProjectId, amount },
  );
  invalidateWorkspaceCache();
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] }),
  ]);
  return result;
}

export async function runTrackedExport<T>(input: {
  projectId: string;
  action: () => Promise<T> | T;
  amount?: number;
}) {
  await authorizeExportAccess(input.projectId);
  const result = await input.action();
  await consumeExportUsage(input.projectId, input.amount || 1);
  return result;
}
