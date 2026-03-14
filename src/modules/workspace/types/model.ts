import type { Project } from '../../../types';

export interface WorkspaceMembership {
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

export interface WorkspaceUser {
  id?: number;
  username?: string;
  email?: string;
}

export interface Workspace {
  user?: WorkspaceUser;
  memberships: WorkspaceMembership[];
  projects: Project[];
}

export interface ProjectContext {
  documentId: string;
  organizationDocumentId?: string;
  organizationName?: string;
}
