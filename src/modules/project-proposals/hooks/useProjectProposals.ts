import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectProposal } from '../../../types';
import {
  getProjectProposals,
  removeProjectProposal,
  saveProjectProposal,
} from '../services/projectProposalsService';

export function useProjectProposals(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['project-proposals', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => getProjectProposals(projectId),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (proposal: ProjectProposal) => saveProjectProposal(proposal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => removeProjectProposal(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
