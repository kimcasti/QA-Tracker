import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogService, type CatalogAssignment } from '../services/catalogService';
import type { AutomationEnvironment } from '../services/runnerService';
import { invalidateWorkspaceCache } from '../../workspace/services/workspaceService';

export function useCatalogComparison(projectId: string, requestId?: number) {
  const client = useQueryClient();
  const key = ['automation-catalog', projectId, requestId];
  const connections = useQuery({ queryKey: ['automation-catalog-connections', projectId],
    queryFn: () => catalogService.connections(projectId), refetchInterval: 5000 });
  const request = useMutation({ mutationFn: (data: { runnerId: number; environment: AutomationEnvironment; requestId: string }) => catalogService.request(projectId, data) });
  const details = useQuery({ queryKey: key, queryFn: () => catalogService.details(projectId, requestId!), enabled: Boolean(requestId),
    refetchOnWindowFocus: false,
    refetchInterval: query => ['pending', 'running'].includes(query.state.data?.state || '') ? 2000 : false });
  const assign = useMutation({
    mutationFn: (data: { requestId: string; catalogHash: string; assignments: CatalogAssignment[] }) => catalogService.assign(projectId, requestId!, data),
    onSuccess: async () => {
      invalidateWorkspaceCache();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['test-cases', projectId] }),
        client.invalidateQueries({ queryKey: ['functionalities', projectId] }),
        client.invalidateQueries({ queryKey: ['workspace'] }),
        client.invalidateQueries({ queryKey: key }),
      ]);
    },
  });
  return { connections, request, details, assign };
}
