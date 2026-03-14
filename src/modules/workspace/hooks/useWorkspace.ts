import { useQuery } from '@tanstack/react-query';
import { getWorkspace } from '../services/workspaceService';

export function useWorkspace() {
  return useQuery({
    queryKey: ['workspace'],
    queryFn: getWorkspace,
  });
}
