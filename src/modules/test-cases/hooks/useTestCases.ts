import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTestCases, removeTestCase, saveTestCase } from '../services/testCasesService';
import type { TestCase } from '../../../types';

export function useTestCases(projectId?: string, functionalityId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['test-cases', projectId, functionalityId || 'all'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getTestCases(projectId, functionalityId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: saveTestCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeTestCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });

  return {
    ...query,
    data: query.data,
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    delete: deleteMutation.mutate,
    invalidate: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
    saveManyWithSingleRefresh: async (testCases: TestCase[]) => {
      for (const testCase of testCases) {
        await saveTestCase(testCase);
      }

      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  };
}
