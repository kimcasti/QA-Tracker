import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jiraService, type JiraIssueDraft } from '../services/jiraService';

export function useJiraStatus(projectKey?: string) {
  return useQuery({ queryKey: ['jira', projectKey], queryFn: () => jiraService.status(projectKey!), enabled: Boolean(projectKey), retry: false });
}
export function useJiraProjects(projectKey: string, enabled: boolean) {
  return useQuery({ queryKey: ['jira-projects', projectKey], queryFn: () => jiraService.projects(projectKey), enabled, retry: false });
}
export function useJiraTypes(projectKey: string, projectId?: string) {
  return useQuery({ queryKey: ['jira-types', projectKey, projectId], queryFn: () => jiraService.types(projectKey, projectId!), enabled: Boolean(projectId), retry: false });
}
export function useJiraConfigure(projectKey: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (data: { projectId: string; issueTypeId: string }) => jiraService.configure(projectKey, data), onSuccess: () => cache.invalidateQueries({ queryKey: ['jira', projectKey] }) });
}
export function useJiraCreate(projectKey: string) {
  return useMutation({ mutationFn: (data: JiraIssueDraft) => jiraService.createIssue(projectKey, data), retry: false });
}
