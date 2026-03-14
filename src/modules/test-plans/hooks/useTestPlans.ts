import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TestPlan } from '../types/model';
import { getTestPlans, removeTestPlan, saveTestPlan } from '../services/testPlansService';

export function useTestPlans(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: () => Promise.resolve(getTestPlans(projectId)),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (plan: TestPlan) => Promise.resolve(saveTestPlan(plan)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(removeTestPlan(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
