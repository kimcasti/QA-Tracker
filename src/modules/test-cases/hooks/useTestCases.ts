import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTestCases, removeTestCase, saveTestCase } from '../services/testCasesService';
import type { TestCase } from '../../../types';

export function useTestCases(projectId?: string, functionalityId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: () => getTestCases(projectId),
    enabled: Boolean(projectId),
  });

  const data = functionalityId
    ? (query.data || []).filter(item => item.functionalityId === functionalityId)
    : query.data;

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
    data,
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
