import { useQuery } from '@tanstack/react-query';
import { getOrganizationUsage } from '../services/workspaceService';

export function useOrganizationUsage(enabled = true) {
  return useQuery({
    queryKey: ['workspace', 'organization-usage'],
    queryFn: getOrganizationUsage,
    enabled,
    staleTime: 60_000,
  });
}
