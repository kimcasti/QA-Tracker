import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Sprint } from '../../../types';
import { getSprints, removeSprint, saveSprint } from '../services/settingsService';

export function useSprints(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings', 'sprints', projectId],
    queryFn: () => getSprints(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (sprint: Sprint) => saveSprint(sprint),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings', 'sprints', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSprint(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings', 'sprints', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
