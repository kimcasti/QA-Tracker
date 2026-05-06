import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Functionality } from '../../../types';
import {
  bulkAddFunctionalities,
  bulkUpdateFunctionalities,
  getFunctionalities,
  removeFunctionality,
  saveFunctionality,
} from '../services/functionalitiesService';
import { invalidateWorkspaceCache } from '../../workspace/services/workspaceService';

export function useFunctionalities(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['functionalities', projectId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getFunctionalities(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (functionality: Functionality) => saveFunctionality(functionality),
    onSuccess: async savedFunctionality => {
      invalidateWorkspaceCache();
      queryClient.setQueryData<Functionality[] | undefined>(queryKey, previous => {
        if (!previous) return [savedFunctionality];

        const existingIndex = previous.findIndex(item =>
          savedFunctionality.documentId
            ? item.documentId === savedFunctionality.documentId
            : item.id === savedFunctionality.id,
        );

        if (existingIndex === -1) {
          return [...previous, savedFunctionality];
        }

        const next = [...previous];
        next[existingIndex] = savedFunctionality;
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'functionalities'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!projectId) throw new Error('A projectId is required to delete a functionality.');
      return removeFunctionality(projectId, id);
    },
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'functionalities'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Partial<Functionality> }) => {
      if (!projectId) throw new Error('A projectId is required to bulk update functionalities.');
      return bulkUpdateFunctionalities(projectId, ids, updates);
    },
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'functionalities'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: (functionalities: Functionality[]) => bulkAddFunctionalities(functionalities),
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      await queryClient.invalidateQueries({ queryKey: ['plan-usage', 'functionalities'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkAdd: bulkAddMutation.mutateAsync,
  };
}
