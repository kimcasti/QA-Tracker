import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProjectComment,
  getProjectComments,
  removeProjectComment,
  updateProjectComment,
} from '../services/projectCommentsService';
import type { ProjectComment } from '../types/model';

const queryKeyFor = (projectId?: string) => ['project-comments', projectId];

export function useProjectComments(projectId?: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeyFor(projectId);
  const query = useQuery({
    queryKey,
    queryFn: () => getProjectComments(projectId),
    enabled: Boolean(projectId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: (content: string) => createProjectComment(projectId || '', content),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: ({ documentId, update }: { documentId: string; update: Pick<Partial<ProjectComment>, 'content' | 'isPinned'> }) =>
      updateProjectComment(documentId, update),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: removeProjectComment,
    onSuccess: invalidate,
  });

  return {
    ...query,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
