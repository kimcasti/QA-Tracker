import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionService } from '../services/connectionService';
export function useConnections() {
  const client = useQueryClient();
  const key = ['automation-connections'];
  const refresh = () => client.invalidateQueries({ queryKey: key });
  return {
    list: useQuery({ queryKey: key, queryFn: connectionService.list }),
    approve: useMutation({ mutationFn: connectionService.approve, onSuccess: refresh }),
    revoke: useMutation({ mutationFn: connectionService.revoke, onSuccess: refresh }),
  };
}
