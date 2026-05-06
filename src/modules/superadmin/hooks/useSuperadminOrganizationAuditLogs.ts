import { useQuery } from '@tanstack/react-query';
import { getSuperadminOrganizationAuditLogs } from '../services/superadminService';

export function useSuperadminOrganizationAuditLogs(organizationDocumentId?: string) {
  return useQuery({
    queryKey: ['superadmin', 'organizations', organizationDocumentId, 'audit-logs'],
    queryFn: () => getSuperadminOrganizationAuditLogs(String(organizationDocumentId)),
    enabled: Boolean(organizationDocumentId),
  });
}
