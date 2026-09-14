import { Http } from '../../../config/http';
export interface AutomationConnection { id: number; label: string; projectKey: string; projectName: string; expiresAt: string }
const endpoint = '/api/automation-connections';
export const connectionService = {
  list: async () => (await Http.get<{ data: AutomationConnection[] }>(endpoint)).data.data,
  approve: async (data: { code: string; projectKey: string }) => (await Http.post(`${endpoint}/approve`, { data })).data.data,
  revoke: async (id: number) => { await Http.delete(`${endpoint}/${id}`); },
};
