import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTestCases, removeTestCase, saveTestCase } from '../services/testCasesService';
import type { TestCase } from '../../../types';
import { invalidateWorkspaceCache } from '../../workspace/services/workspaceService';

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
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: removeTestCase,
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
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
      await queryClient.invalidateQueries({ queryKey });
    },
    saveManyWithSingleRefresh: async (testCases: TestCase[]) => {
      for (const testCase of testCases) {
        await saveTestCase(testCase);
      }

      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'test-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  };
}
