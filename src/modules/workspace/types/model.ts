import type { Project } from '../../../types';

export interface OrganizationUsageSnapshot {
  documentId: string;
  monthKey: string;
  periodStart: string;
  periodEnd: string;
  projectsCount: number;
  usersCount: number;
  functionalitiesCount: number;
  testCasesCount: number;
  aiUsageCount: number;
  exportUsageCount: number;
  lastRecomputedAt: string | null;
}

export interface WorkspaceMembership {
  documentId: string;
  organization?: {
    documentId: string;
    name: string;
    slug: string;
    plan?: 'starter' | 'growth' | 'enterprise';
    status?: 'active' | 'inactive';
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
  role?: {
    documentId: string;
    code: string;
    name: string;
  };
}

export interface WorkspaceUser {
  id?: number;
  username?: string;
  email?: string;
  isSuperAdmin?: boolean;
}

export interface WorkspaceProjectQuota {
  plan?: 'starter' | 'growth' | 'enterprise';
  effectivePlan?: 'starter' | 'growth' | 'enterprise';
  currentCount: number;
  limit: number | null;
  limits?: {
    projects: number | null;
    users: number | null;
    features: number | null;
    testCases: number | null;
    aiRequests?: number | null;
    exports?: number | null;
  };
  usage?: {
    projects: number;
    users: number;
    features: number;
    testCases: number;
    aiRequests: number;
    exports: number;
  };
  allowedByRole: boolean;
  canCreate: boolean;
  limitReached: boolean;
  upgradePriceMonthlyUsd: number;
  features?: {
    ai: boolean;
    templates: boolean;
    audit: boolean;
    exports: boolean;
  };
  billing?: {
    planStatus: 'active' | 'past_due' | 'canceled';
    planExpiresAt: string | null;
    gracePeriodEndsAt: string | null;
    planUpdatedAt?: string | null;
    billingNotes?: string | null;
    inGracePeriod?: boolean;
    downgradedToStarter?: boolean;
  };
  aiUsage?: {
    usedThisMonth: number;
    resetAt: string | null;
    limit?: number | null;
    remaining?: number | null;
    unlimited?: boolean;
    canUse?: boolean;
    nearLimit?: boolean;
    reachedLimit?: boolean;
  };
  reports?: {
    qaStatusSummary: boolean;
    qaProgress: boolean;
    executiveProjectStatus: boolean;
  };
  exportUsage?: {
    usedThisMonth: number;
    resetAt: string | null;
    limit?: number | null;
    remaining?: number | null;
    unlimited?: boolean;
    canUse?: boolean;
    nearLimit?: boolean;
    reachedLimit?: boolean;
  };
  organizationUsage?: OrganizationUsageSnapshot | null;
}

export interface Workspace {
  user?: WorkspaceUser;
  memberships: WorkspaceMembership[];
  projects: Project[];
  projectQuota?: WorkspaceProjectQuota;
}

export interface ProjectContext {
  documentId: string;
  organizationDocumentId?: string;
  organizationName?: string;
}
