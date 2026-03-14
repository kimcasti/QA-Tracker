import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project } from '../../../types';
import { getProjects, removeProject, saveProject } from '../services/projectsService';

export function useProjects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const saveMutation = useMutation({
    mutationFn: (project: Project) => saveProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => removeProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
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
