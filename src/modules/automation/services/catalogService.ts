import { Http } from '../../../config/http';
import type { AutomationEnvironment } from './runnerService';

export interface CatalogConnection {
  id: number; runnerId: number | null; label: string; online: boolean; busy: boolean; compatible: boolean;
  environments: AutomationEnvironment[];
}
export interface CatalogCase {
  id: string; title: string; reference: string; status: string; tool: string; type: string; snapshot: string;
  module: string; functionality: string; functionalityId: string;
}
export interface CatalogRequest {
  id: number; runnerId: number; environment: AutomationEnvironment;
  state: 'pending' | 'running' | 'completed' | 'failed'; requestedAt: string; finishedAt?: string;
  references: string[]; catalogHash?: string; error?: string; cases?: CatalogCase[];
}
export interface CatalogAssignment { caseId: string; reference: string; snapshot: string }
const base = (projectId: string) => `/api/automation-projects/${encodeURIComponent(projectId)}`;
export const catalogService = {
  connections: async (projectId: string) => (await Http.get<{ data: CatalogConnection[] }>(`${base(projectId)}/catalog-connections`)).data.data,
  request: async (projectId: string, data: { runnerId: number; environment: AutomationEnvironment; requestId: string }) =>
    (await Http.post<{ data: CatalogRequest }>(`${base(projectId)}/catalog-requests`, { data })).data.data,
  details: async (projectId: string, id: number) =>
    (await Http.get<{ data: CatalogRequest }>(`${base(projectId)}/catalog-requests/${id}`)).data.data,
  assign: async (projectId: string, id: number, data: { requestId: string; catalogHash: string; assignments: CatalogAssignment[] }) =>
    (await Http.post<{ data: { saved: string[] } }>(`${base(projectId)}/catalog-requests/${id}/assignments`, { data })).data.data,
};
