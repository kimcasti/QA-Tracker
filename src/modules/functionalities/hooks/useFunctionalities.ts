import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Functionality } from '../../../types';
import {
  bulkAddFunctionalities,
  bulkUpdateFunctionalities,
  getFunctionalities,
  removeFunctionality,
  saveFunctionality,
} from '../services/functionalitiesService';

export function useFunctionalities(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['functionalities', projectId],
    queryFn: () => getFunctionalities(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (functionality: Functionality) => saveFunctionality(functionality),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!projectId) throw new Error('A projectId is required to delete a functionality.');
      return removeFunctionality(projectId, id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Partial<Functionality> }) => {
      if (!projectId) throw new Error('A projectId is required to bulk update functionalities.');
      return bulkUpdateFunctionalities(projectId, ids, updates);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  const bulkAddMutation = useMutation({
    mutationFn: (functionalities: Functionality[]) => bulkAddFunctionalities(functionalities),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['functionalities', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkAdd: bulkAddMutation.mutateAsync,
  };
}
