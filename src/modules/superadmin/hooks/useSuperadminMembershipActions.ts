import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deactivateSuperadminMembership,
  deleteSuperadminMembership,
  reactivateSuperadminMembership,
  updateSuperadminMembershipRole,
} from '../services/superadminService';

export function useSuperadminMembershipActions(organizationDocumentId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['superadmin', 'organizations'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['superadmin', 'organizations', organizationDocumentId, 'memberships'],
      }),
    ]);
  };

  return {
    updateRole: useMutation({
      mutationFn: ({ membershipDocumentId, roleDocumentId }: { membershipDocumentId: string; roleDocumentId: string }) =>
        updateSuperadminMembershipRole(membershipDocumentId, roleDocumentId),
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: (membershipDocumentId: string) => deactivateSuperadminMembership(membershipDocumentId),
      onSuccess: invalidate,
    }),
    reactivate: useMutation({
      mutationFn: (membershipDocumentId: string) => reactivateSuperadminMembership(membershipDocumentId),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (membershipDocumentId: string) => deleteSuperadminMembership(membershipDocumentId),
      onSuccess: invalidate,
    }),
  };
}
