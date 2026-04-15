import type { Project } from '../../../types';

export interface WorkspaceMembership {
  documentId: string;
  organization?: {
    documentId: string;
    name: string;
    slug: string;
    plan?: 'starter' | 'growth' | 'enterprise';
    status?: 'active' | 'inactive';
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
}

export interface WorkspaceProjectQuota {
  plan?: 'starter' | 'growth' | 'enterprise';
  currentCount: number;
  limit: number | null;
  allowedByRole: boolean;
  canCreate: boolean;
  limitReached: boolean;
  upgradePriceMonthlyUsd: number;
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
