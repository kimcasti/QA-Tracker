import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegressionCycle } from '../../../types';
import { getTestCycles, saveTestCycle } from '../services/testCyclesService';

export function useRegressionCycles(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['test-cycles', 'regression', projectId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getTestCycles(projectId, 'REGRESSION'),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => saveTestCycle({ ...cycle, type: 'REGRESSION' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
