import { Http } from '../../../config/http';
import type { OrganizationTeamData } from '../types/model';

export async function getOrganizationTeam() {
  const response = await Http.get<OrganizationTeamData>('/api/organization-team');
  return response.data;
}

export async function inviteOrganizationMember(input: {
  email: string;
  roleDocumentId: string;
}) {
  const response = await Http.post<OrganizationTeamData>('/api/organization-team/invitations', {
    data: input,
  });

  return response.data;
}

export async function updateOrganizationMemberRole(input: {
  membershipDocumentId: string;
  roleDocumentId: string;
}) {
  const response = await Http.put<OrganizationTeamData>(
    `/api/organization-team/members/${input.membershipDocumentId}/role`,
    {
      data: {
        roleDocumentId: input.roleDocumentId,
      },
    },
  );

  return response.data;
}

export async function deactivateOrganizationMember(membershipDocumentId: string) {
  const response = await Http.put<OrganizationTeamData>(
    `/api/organization-team/members/${membershipDocumentId}/deactivate`,
  );

  return response.data;
}

export async function reactivateOrganizationMember(membershipDocumentId: string) {
  const response = await Http.put<OrganizationTeamData>(
    `/api/organization-team/members/${membershipDocumentId}/reactivate`,
  );

  return response.data;
}

export async function resendOrganizationInvitation(invitationDocumentId: string) {
  const response = await Http.post<OrganizationTeamData>(
    `/api/organization-team/invitations/${invitationDocumentId}/resend`,
  );

  return response.data;
}

export async function cancelOrganizationInvitation(invitationDocumentId: string) {
  const response = await Http.put<OrganizationTeamData>(
    `/api/organization-team/invitations/${invitationDocumentId}/cancel`,
  );

  return response.data;
}
