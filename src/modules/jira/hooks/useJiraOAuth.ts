import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jiraOAuthService } from '../services/jiraOAuthService';
export function useJiraOAuth() {
  const cache = useQueryClient();
  const status = useQuery({ queryKey: ['jira-oauth'], queryFn: jiraOAuthService.status, retry: false });
  const start = useMutation({ mutationFn: jiraOAuthService.start, retry: false });
  const select = useMutation({ mutationFn: jiraOAuthService.select, retry: false, onSuccess: async () => {
    await Promise.all(['jira-oauth', 'jira-account', 'jira', 'jira-projects', 'jira-types'].map(key => cache.invalidateQueries({ queryKey: [key] })));
  } });
  return { status, start, select };
}
