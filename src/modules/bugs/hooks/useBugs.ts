import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QABug } from '../../../types';
import { getBugs, removeBug, saveBug } from '../services/bugsService';

export function useBugs(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['bugs', projectId],
    queryFn: () => getBugs(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (bug: QABug) => saveBug(bug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bugs', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (internalBugId: string) => removeBug(internalBugId, projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bugs', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
