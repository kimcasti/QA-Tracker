import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegressionCycle } from '../../../types';
import { getTestCycles, saveTestCycle } from '../services/testCyclesService';

export function useSmokeCycles(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-cycles', 'smoke', projectId],
    queryFn: () => getTestCycles(projectId, 'SMOKE'),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => saveTestCycle({ ...cycle, type: 'SMOKE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-cycles', 'smoke', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
  };
}
