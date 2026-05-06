import { useQuery } from '@tanstack/react-query';
import { getSuperadminOrganizationMemberships } from '../services/superadminService';

export function useSuperadminOrganizationMemberships(organizationDocumentId?: string) {
  return useQuery({
    queryKey: ['superadmin', 'organizations', organizationDocumentId, 'memberships'],
    queryFn: () => getSuperadminOrganizationMemberships(String(organizationDocumentId)),
    enabled: Boolean(organizationDocumentId),
  });
}
