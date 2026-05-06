import { Http } from '../../../config/http';
import type {
  SuperadminBillingRequestsResponse,
  SuperadminOrganizationAuditLogs,
  SuperadminOrganizationDetail,
  SuperadminOrganizationInvitations,
  SuperadminOrganizationSummary,
} from '../types/model';

export async function getSuperadminOrganizations() {
  const response = await Http.get<{ organizations: SuperadminOrganizationSummary[] }>(
    '/api/superadmin/organizations',
  );

  return response.data.organizations || [];
}

export async function getSuperadminBillingRequests() {
  const response = await Http.get<SuperadminBillingRequestsResponse>(
    '/api/superadmin/billing-requests',
  );

  return response.data.billingRequests || [];
}

export async function updateSuperadminOrganization(input: {
  organizationDocumentId: string;
  plan: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'inactive';
  planStatus: 'active' | 'past_due' | 'canceled';
  planExpiresAt?: string | null;
  gracePeriodEndsAt?: string | null;
  aiLimit?: number | null;
  exportLimitMonthly?: number | null;
  contactNumber?: string | null;
  billingNotes?: string | null;
  paymentMethod?: 'manual_transfer' | 'nequi' | 'whatsapp' | 'wompi' | 'mercadopago' | 'other' | null;
  externalReference?: string | null;
}) {
  const response = await Http.put<{ organizations: SuperadminOrganizationSummary[] }>(
    `/api/superadmin/organizations/${input.organizationDocumentId}`,
    {
      data: {
        plan: input.plan,
        status: input.status,
        planStatus: input.planStatus,
        planExpiresAt: input.planExpiresAt ?? null,
        gracePeriodEndsAt: input.gracePeriodEndsAt ?? null,
        aiLimit: input.aiLimit ?? null,
        exportLimitMonthly: input.exportLimitMonthly ?? null,
        contactNumber: input.contactNumber ?? null,
        billingNotes: input.billingNotes ?? null,
        paymentMethod: input.paymentMethod ?? null,
        externalReference: input.externalReference ?? null,
      },
    },
  );

  return response.data.organizations || [];
}

export async function updateSuperadminBillingRequest(input: {
  billingRequestDocumentId: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected' | 'fulfilled';
  statusNotes?: string | null;
  paymentMethod?:
    | 'manual_transfer'
    | 'nequi'
    | 'whatsapp'
    | 'wompi'
    | 'mercadopago'
    | 'other'
    | null;
  externalReference?: string | null;
}) {
  const response = await Http.put<SuperadminBillingRequestsResponse>(
    `/api/superadmin/billing-requests/${input.billingRequestDocumentId}`,
    {
      data: {
        status: input.status,
        statusNotes: input.statusNotes ?? null,
        paymentMethod: input.paymentMethod ?? null,
        externalReference: input.externalReference ?? null,
      },
    },
  );

  return response.data.billingRequests || [];
}

export async function getSuperadminOrganizationMemberships(organizationDocumentId: string) {
  const response = await Http.get<SuperadminOrganizationDetail>(
    `/api/superadmin/organizations/${organizationDocumentId}/memberships`,
  );

  return response.data;
}

export async function getSuperadminOrganizationInvitations(organizationDocumentId: string) {
  const response = await Http.get<SuperadminOrganizationInvitations>(
    `/api/superadmin/organizations/${organizationDocumentId}/invitations`,
  );

  return response.data;
}

export async function getSuperadminOrganizationAuditLogs(organizationDocumentId: string) {
  const response = await Http.get<SuperadminOrganizationAuditLogs>(
    `/api/superadmin/organizations/${organizationDocumentId}/audit-logs`,
  );

  return response.data;
}

export async function inviteSuperadminOrganizationMember(input: {
  organizationDocumentId: string;
  email: string;
  roleDocumentId: string;
}) {
  const response = await Http.post<SuperadminOrganizationInvitations>(
    `/api/superadmin/organizations/${input.organizationDocumentId}/invitations`,
    {
      data: {
        email: input.email,
        roleDocumentId: input.roleDocumentId,
      },
    },
  );

  return response.data;
}

export async function resendSuperadminInvitation(invitationDocumentId: string) {
  const response = await Http.post<SuperadminOrganizationInvitations>(
    `/api/superadmin/invitations/${invitationDocumentId}/resend`,
  );

  return response.data;
}

export async function cancelSuperadminInvitation(invitationDocumentId: string) {
  const response = await Http.put<SuperadminOrganizationInvitations>(
    `/api/superadmin/invitations/${invitationDocumentId}/cancel`,
  );

  return response.data;
}

export async function updateSuperadminMembershipRole(
  membershipDocumentId: string,
  roleDocumentId: string,
) {
  const response = await Http.put(
    `/api/superadmin/memberships/${membershipDocumentId}/role`,
    {
      data: {
        roleDocumentId,
      },
    },
  );

  return response.data;
}

export async function deactivateSuperadminMembership(membershipDocumentId: string) {
  const response = await Http.put(`/api/superadmin/memberships/${membershipDocumentId}/deactivate`);
  return response.data;
}

export async function reactivateSuperadminMembership(membershipDocumentId: string) {
  const response = await Http.put(`/api/superadmin/memberships/${membershipDocumentId}/reactivate`);
  return response.data;
}

export async function deleteSuperadminMembership(membershipDocumentId: string) {
  const response = await Http.delete(`/api/superadmin/memberships/${membershipDocumentId}`);
  return response.data;
}
