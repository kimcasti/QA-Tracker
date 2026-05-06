export interface SuperadminOrganizationSummary {
  documentId: string;
  name: string;
  slug: string;
  status?: 'active' | 'inactive';
  plan?: 'starter' | 'growth' | 'enterprise';
  planStatus?: 'active' | 'past_due' | 'canceled';
  planExpiresAt?: string | null;
  gracePeriodEndsAt?: string | null;
  planUpdatedAt?: string | null;
  aiUsageThisMonth?: number;
  aiResetAt?: string | null;
  aiLimit?: number | null;
  exportUsageThisMonth?: number;
  usageResetAt?: string | null;
  exportLimitMonthly?: number | null;
  contactNumber?: string | null;
  billingNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  memberCount: number;
  activeMemberCount: number;
  pendingInvitationCount: number;
  projectCount: number;
}

export interface SuperadminMembership {
  documentId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  user: {
    id: number;
    username?: string;
    email?: string;
    blocked: boolean;
    isSuperAdmin: boolean;
  } | null;
  role: {
    documentId: string;
    code: string;
    name: string;
  } | null;
}

export interface SuperadminInvitation {
  documentId: string;
  email: string;
  invitedAt?: string;
  status: string;
  workspaceProjectDocumentId: string | null;
  workspaceName: string | null;
  role: {
    documentId: string;
    code: string;
    name: string;
  } | null;
  invitedBy: {
    id: number;
    username?: string;
    email?: string;
  } | null;
}

export interface SuperadminOrganizationDetail {
  organization: {
    documentId: string;
    name: string;
    slug: string;
    status?: 'active' | 'inactive';
    plan?: 'starter' | 'growth' | 'enterprise';
    planStatus?: 'active' | 'past_due' | 'canceled';
    planExpiresAt?: string | null;
    gracePeriodEndsAt?: string | null;
    planUpdatedAt?: string | null;
    aiUsageThisMonth?: number;
    aiResetAt?: string | null;
    aiLimit?: number | null;
    exportUsageThisMonth?: number;
    usageResetAt?: string | null;
    exportLimitMonthly?: number | null;
    billingNotes?: string | null;
  };
  availableRoles: Array<{
    documentId: string;
    code: string;
    name: string;
  }>;
  memberships: SuperadminMembership[];
}

export interface SuperadminOrganizationInvitations {
  organization: {
    documentId: string;
    name: string;
    slug: string;
    status?: 'active' | 'inactive';
    plan?: 'starter' | 'growth' | 'enterprise';
    planStatus?: 'active' | 'past_due' | 'canceled';
    planExpiresAt?: string | null;
    gracePeriodEndsAt?: string | null;
    planUpdatedAt?: string | null;
    aiUsageThisMonth?: number;
    aiResetAt?: string | null;
    aiLimit?: number | null;
    exportUsageThisMonth?: number;
    usageResetAt?: string | null;
    exportLimitMonthly?: number | null;
    billingNotes?: string | null;
  };
  invitations: SuperadminInvitation[];
}

export interface SuperadminAuditLog {
  documentId: string;
  action: string;
  targetType: string;
  targetDocumentId: string | null;
  targetLabel: string | null;
  details: Record<string, unknown> | null;
  createdAt?: string;
  actor: {
    id: number;
    username?: string;
    email?: string;
  } | null;
}

export interface SuperadminBillingRequest {
  documentId: string;
  requestedPlan: 'growth' | 'enterprise';
  status: 'pending' | 'contacted' | 'approved' | 'rejected' | 'fulfilled';
  source?: string | null;
  requestedAt?: string | null;
  handledAt?: string | null;
  currentCount?: number | null;
  limitValue?: number | null;
  priceMonthlyUsd?: number | null;
  notes?: string | null;
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
  organization: {
    documentId: string;
    name: string;
    slug: string;
    plan?: 'starter' | 'growth' | 'enterprise';
    planStatus?: 'active' | 'past_due' | 'canceled';
  } | null;
  requestedBy: {
    id: number;
    username?: string;
    email?: string;
    contactNumber?: string | null;
  } | null;
  handledBy: {
    id: number;
    username?: string;
    email?: string;
    contactNumber?: string | null;
  } | null;
}

export interface SuperadminBillingRequestsResponse {
  billingRequests: SuperadminBillingRequest[];
}

export interface SuperadminOrganizationAuditLogs {
  organization: {
    documentId: string;
    name: string;
    slug: string;
    status?: 'active' | 'inactive';
    plan?: 'starter' | 'growth' | 'enterprise';
    planStatus?: 'active' | 'past_due' | 'canceled';
    planExpiresAt?: string | null;
    gracePeriodEndsAt?: string | null;
    planUpdatedAt?: string | null;
    aiUsageThisMonth?: number;
    aiResetAt?: string | null;
    aiLimit?: number | null;
    exportUsageThisMonth?: number;
    usageResetAt?: string | null;
    exportLimitMonthly?: number | null;
    billingNotes?: string | null;
  };
  logs: SuperadminAuditLog[];
}
