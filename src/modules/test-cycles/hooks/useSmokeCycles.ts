import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegressionCycle } from '../../../types';
import { getTestCycles, saveTestCycle } from '../services/testCyclesService';

function upsertCycle(
  previous: RegressionCycle[] | undefined,
  savedCycle: RegressionCycle,
) {
  if (!previous) return [savedCycle];

  const existingIndex = previous.findIndex(item => item.id === savedCycle.id);
  if (existingIndex === -1) {
    return [...previous, savedCycle].sort((left, right) => right.date.localeCompare(left.date));
  }

  const next = [...previous];
  next[existingIndex] = savedCycle;
  return next;
}

export function useSmokeCycles(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['test-cycles', 'smoke', projectId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getTestCycles(projectId, 'SMOKE'),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (cycle: RegressionCycle) => saveTestCycle({ ...cycle, type: 'SMOKE' }),
    onSuccess: savedCycle => {
      queryClient.setQueryData<RegressionCycle[] | undefined>(queryKey, previous =>
        upsertCycle(previous, savedCycle),
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
