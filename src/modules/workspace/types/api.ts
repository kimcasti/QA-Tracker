export interface WorkspaceUserDto {
  id?: number;
  username?: string;
  email?: string;
}

export interface WorkspaceMembershipDto {
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

export interface WorkspaceProjectDto {
  documentId: string;
  name: string;
  key: string;
  description?: string;
  version?: string;
  status?: string;
  createdAt?: string;
  icon?: string;
  logoDataUrl?: string;
  teamMembers?: string[];
  purpose?: string;
  coreRequirements?: string[];
  businessRules?: string;
  aiProjectInsights?: string;
  aiWireframeBrief?: string;
  organization?: {
    documentId: string;
    name: string;
  };
}

export interface WorkspaceProjectQuotaDto {
  plan?: 'starter' | 'growth' | 'enterprise';
  currentCount: number;
  limit: number | null;
  allowedByRole: boolean;
  canCreate: boolean;
  limitReached: boolean;
  upgradePriceMonthlyUsd: number;
}

export interface WorkspaceDto {
  user?: WorkspaceUserDto;
  memberships: WorkspaceMembershipDto[];
  projects: WorkspaceProjectDto[];
  projectQuota?: WorkspaceProjectQuotaDto;
}

export interface ProjectContextsDto {
  projects: Array<{
    documentId: string;
    key: string;
    organization?: {
      documentId: string;
      name: string;
    };
  }>;
}
