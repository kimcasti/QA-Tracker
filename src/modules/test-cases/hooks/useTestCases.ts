import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTestCases, removeTestCase, saveTestCase } from '../services/testCasesService';

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
    delete: deleteMutation.mutate,
  };
}
