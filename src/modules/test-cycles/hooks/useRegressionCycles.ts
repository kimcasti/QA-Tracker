import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegressionCycle } from '../../../types';
import { getTestCycles, saveTestCycle } from '../services/testCyclesService';

export function useRegressionCycles(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-cycles', 'regression', projectId],
    queryFn: () => getTestCycles(projectId, 'REGRESSION'),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => saveTestCycle({ ...cycle, type: 'REGRESSION' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-cycles', 'regression', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
  };
}
