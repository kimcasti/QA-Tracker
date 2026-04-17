import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTestCases, removeTestCase, saveTestCase } from '../services/testCasesService';
import type { TestCase } from '../../../types';

export function useTestCases(projectId?: string, functionalityId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-cases', projectId, functionalityId],
    queryFn: () => getTestCases(projectId, functionalityId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: saveTestCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId, functionalityId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeTestCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId, functionalityId] });
    },
  });

  return {
    ...query,
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    delete: deleteMutation.mutate,
    invalidate: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['test-cases', projectId, functionalityId] }),
      ]);
    },
    saveManyWithSingleRefresh: async (testCases: TestCase[]) => {
      for (const testCase of testCases) {
        await saveTestCase(testCase);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['test-cases', projectId, functionalityId] }),
      ]);
    },
  };
}
