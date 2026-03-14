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
  organization?: {
    documentId: string;
    name: string;
  };
}

export interface WorkspaceDto {
  user?: WorkspaceUserDto;
  memberships: WorkspaceMembershipDto[];
  projects: WorkspaceProjectDto[];
}
