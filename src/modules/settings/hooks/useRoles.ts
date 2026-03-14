import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '../../../types';
import { getRoles, removeRole, saveRole } from '../services/settingsService';

export function useRoles(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings', 'roles', projectId],
    queryFn: () => getRoles(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (role: Role) => saveRole(role),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRole(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings', 'roles', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
