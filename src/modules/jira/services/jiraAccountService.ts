import { Http, toApiError } from '../../../config/http';
export interface JiraAccountStatus {
  connected: boolean; source: 'saved' | 'environment' | 'oauth' | null; canStore: boolean;
  site: string | null; email: string | null; cloudId: string | null;
  accountName: string | null; validatedAt: string | null;
}
export interface JiraAccountDraft { site: string; email: string; token: string; cloudId?: string }
export const jiraAccountService = {
  status: async () => (await Http.get<{ data: JiraAccountStatus }>('/api/jira-account')).data.data,
  save: async (draft: JiraAccountDraft) => {
    try { return (await Http.put<{ data: JiraAccountStatus }>('/api/jira-account', { data: draft }, { timeout: 30000 })).data.data; }
    catch (error) { throw new Error(toApiError(error).message); }
  },
  disconnect: async () => { await Http.delete('/api/jira-account'); },
};
