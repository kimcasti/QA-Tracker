import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  cancelSuperadminInvitation,
  inviteSuperadminOrganizationMember,
  resendSuperadminInvitation,
} from '../services/superadminService';

export function useSuperadminInvitationActions(organizationDocumentId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['superadmin', 'organizations'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['superadmin', 'organizations', organizationDocumentId, 'invitations'],
      }),
    ]);
  };

  return {
    invite: useMutation({
      mutationFn: ({ email, roleDocumentId }: { email: string; roleDocumentId: string }) =>
        inviteSuperadminOrganizationMember({
          organizationDocumentId: String(organizationDocumentId),
          email,
          roleDocumentId,
        }),
      onSuccess: invalidate,
    }),
    resend: useMutation({
      mutationFn: (invitationDocumentId: string) => resendSuperadminInvitation(invitationDocumentId),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (invitationDocumentId: string) => cancelSuperadminInvitation(invitationDocumentId),
      onSuccess: invalidate,
    }),
  };
}
