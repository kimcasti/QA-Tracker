import { Http, toApiError } from '../../../config/http';
export interface OAuthSite { id: string; name: string; url: string }
export interface JiraOAuthStatus { configured: boolean; connected: boolean; reconnect: boolean; site: string | null; accountName: string | null; pending: { selectionId: number; sites: OAuthSite[] } | null }
export const jiraOAuthService = {
  status: async () => (await Http.get<{ data: JiraOAuthStatus }>('/api/jira-oauth')).data.data,
  start: async () => (await Http.post<{ data: { authorizationUrl: string } }>('/api/jira-oauth/start')).data.data,
  complete: async (data: { state?: string; code?: string; error?: string }) => {
    try { await Http.post('/api/jira-oauth/complete', { data }, { timeout: 50000 }); }
    catch (error) { throw new Error(toApiError(error).message); }
  },
  select: async (data: { selectionId: number; cloudId: string }) => { await Http.post('/api/jira-oauth/select-site', { data }, { timeout: 30000 }); },
};
