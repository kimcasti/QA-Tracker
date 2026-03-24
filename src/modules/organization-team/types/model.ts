export type OrganizationTeamRoleCode =
  | 'owner'
  | 'qa-lead'
  | 'qa-engineer'
  | 'viewer'
  | 'manager';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type MemberStatus = 'active' | 'inactive';

export interface OrganizationTeamRole {
  documentId: string;
  code: OrganizationTeamRoleCode;
  name: string;
}

export interface OrganizationTeamMember {
  documentId: string;
  name: string;
  email: string;
  role: OrganizationTeamRole | null;
  status: MemberStatus;
  isCurrentUser: boolean;
}

export interface OrganizationTeamInvitation {
  documentId: string;
  email: string;
  acceptUrl?: string;
  organizationId: string;
  role: OrganizationTeamRole | null;
  invitedBy?: {
    id: number;
    username?: string;
    email?: string;
  } | null;
  invitedAt: string;
  status: InvitationStatus;
}

export interface OrganizationTeamData {
  organization: {
    documentId: string;
    name: string;
  };
  currentMembership: {
    documentId: string;
    roleCode: OrganizationTeamRoleCode | string;
  };
  invitationEmailHealth?: {
    manualShareRecommended: boolean;
    summary?: string;
  };
  canManage: boolean;
  availableRoles: OrganizationTeamRole[];
  members: OrganizationTeamMember[];
  invitations: OrganizationTeamInvitation[];
}
