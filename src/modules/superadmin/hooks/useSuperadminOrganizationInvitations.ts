import { useQuery } from '@tanstack/react-query';
import { getSuperadminOrganizationInvitations } from '../services/superadminService';

export function useSuperadminOrganizationInvitations(organizationDocumentId?: string) {
  return useQuery({
    queryKey: ['superadmin', 'organizations', organizationDocumentId, 'invitations'],
    queryFn: () => getSuperadminOrganizationInvitations(String(organizationDocumentId)),
    enabled: Boolean(organizationDocumentId),
  });
}
