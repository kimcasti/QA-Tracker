import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TestRun } from '../../../types';
import { getTestRuns, removeTestRun, saveTestRun } from '../services/testRunsService';

export function useTestRuns(projectId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? Boolean(projectId);

  const query = useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: () => getTestRuns(projectId),
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: (testRun: TestRun) => saveTestRun(testRun),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-runs', 'summary', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeTestRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-runs', 'summary', projectId] });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
