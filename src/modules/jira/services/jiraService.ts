import { Http } from '../../../config/http';

export interface JiraDestination { site: string; projectId: string; projectKey: string; projectName: string; issueTypeId: string; issueTypeName: string }
export interface JiraStatus { configured: boolean; sendingEnabled: boolean; site: string | null; destination: JiraDestination | null }
export interface JiraIssueDraft { testRunId: string; testCaseId: string; title: string; description?: string; evidenceImage?: string }
export interface JiraIssueResult { key: string; url: string; warning?: string | null }
const endpoint = (key: string) => `/api/jira-integration/${encodeURIComponent(key)}`;

export const jiraService = {
  status: async (key: string) => (await Http.get<{ data: JiraStatus }>(endpoint(key))).data.data,
  projects: async (key: string) => (await Http.get<{ data: { accountName: string; projects: { id: string; key: string; name: string }[] } }>(`${endpoint(key)}/projects`)).data.data,
  types: async (key: string, projectId: string) => (await Http.get<{ data: { id: string; name: string }[] }>(`${endpoint(key)}/types/${encodeURIComponent(projectId)}`)).data.data,
  configure: async (key: string, data: { projectId: string; issueTypeId: string }) => (await Http.put<{ data: JiraDestination }>(endpoint(key), { data })).data.data,
  createIssue: async (key: string, data: JiraIssueDraft) => (await Http.post<{ data: JiraIssueResult }>(`${endpoint(key)}/issues`, { data }, { timeout: 65000 })).data.data,
};
