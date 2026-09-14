import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jiraAccountService, type JiraAccountDraft } from '../services/jiraAccountService';

export function useJiraAccount() {
  const cache = useQueryClient();
  const [isSaving, setSaving] = useState(false);
  const status = useQuery({ queryKey: ['jira-account'], queryFn: jiraAccountService.status, retry: false });
  const refresh = async () => {
    await Promise.all(['jira-oauth', 'jira-account', 'jira', 'jira-projects', 'jira-types'].map(key => cache.invalidateQueries({ queryKey: [key] })));
  };
  // Keep the submitted token out of React Query's mutation cache.
  const save = async (draft: JiraAccountDraft) => {
    setSaving(true);
    try { const result = await jiraAccountService.save(draft); await refresh(); return result; }
    finally { setSaving(false); }
  };
  const disconnect = useMutation({ mutationFn: jiraAccountService.disconnect, onSuccess: refresh, retry: false });
  return { status, save, isSaving, disconnect };
}
