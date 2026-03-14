import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Module } from '../../../types';
import { getModules, removeModule, saveModule } from '../services/settingsService';

export function useModules(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings', 'modules', projectId],
    queryFn: () => getModules(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (module: Module) => saveModule(module),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings', 'modules', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeModule(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings', 'modules', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
