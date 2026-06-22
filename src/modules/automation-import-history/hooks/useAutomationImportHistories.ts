import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutomationImportHistoryRecord } from '../types/model';
import {
  getAutomationImportHistories,
  saveAutomationImportHistory,
} from '../services/automationImportHistoryService';

export function useAutomationImportHistories(projectId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? Boolean(projectId);

  const query = useQuery({
    queryKey: ['automation-import-history', projectId],
    queryFn: () => getAutomationImportHistories(projectId),
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: (
      input: Pick<
        AutomationImportHistoryRecord,
        | 'projectId'
        | 'testRunId'
        | 'tool'
        | 'importedAt'
        | 'matchedCount'
        | 'missingReferenceCount'
        | 'unmatchedExecutionCount'
        | 'unmatchedReportReferenceCount'
        | 'duplicateReferenceCount'
        | 'matchedCases'
      >,
    ) => saveAutomationImportHistory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-import-history', projectId] });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
  };
}
