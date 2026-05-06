import { useQuery } from '@tanstack/react-query';
import { getSuperadminBillingRequests } from '../services/superadminService';

export function useSuperadminBillingRequests(enabled = true) {
  return useQuery({
    queryKey: ['superadmin', 'billing-requests'],
    queryFn: getSuperadminBillingRequests,
    enabled,
  });
}
