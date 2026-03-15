import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelOrganizationInvitation,
  deactivateOrganizationMember,
  getOrganizationTeam,
  inviteOrganizationMember,
  resendOrganizationInvitation,
  updateOrganizationMemberRole,
} from '../services/organizationTeamService';
import type { OrganizationTeamData } from '../types/model';

const ORGANIZATION_TEAM_QUERY_KEY = ['organization-team'];

export function useOrganizationTeam(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ORGANIZATION_TEAM_QUERY_KEY,
    queryFn: getOrganizationTeam,
    enabled,
  });

  const syncTeamState = (data: OrganizationTeamData) => {
    queryClient.setQueryData(ORGANIZATION_TEAM_QUERY_KEY, data);
    queryClient.invalidateQueries({ queryKey: ['workspace'] });
  };

  const inviteMutation = useMutation({
    mutationFn: inviteOrganizationMember,
    onSuccess: syncTeamState,
  });

  const updateRoleMutation = useMutation({
    mutationFn: updateOrganizationMemberRole,
    onSuccess: syncTeamState,
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateOrganizationMember,
    onSuccess: syncTeamState,
  });

  const resendInvitationMutation = useMutation({
    mutationFn: resendOrganizationInvitation,
    onSuccess: syncTeamState,
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: cancelOrganizationInvitation,
    onSuccess: syncTeamState,
  });

  return {
    ...query,
    inviteMember: inviteMutation.mutateAsync,
    updateMemberRole: updateRoleMutation.mutateAsync,
    deactivateMember: deactivateMutation.mutateAsync,
    resendInvitation: resendInvitationMutation.mutateAsync,
    cancelInvitation: cancelInvitationMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isDeactivatingMember: deactivateMutation.isPending,
    isResendingInvitation: resendInvitationMutation.isPending,
    isCancellingInvitation: cancelInvitationMutation.isPending,
  };
}
