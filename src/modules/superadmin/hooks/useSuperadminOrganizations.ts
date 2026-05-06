import { useQuery } from '@tanstack/react-query';
import { getSuperadminOrganizations } from '../services/superadminService';

export function useSuperadminOrganizations(enabled = true) {
  return useQuery({
    queryKey: ['superadmin', 'organizations'],
    queryFn: getSuperadminOrganizations,
    enabled,
  });
}
