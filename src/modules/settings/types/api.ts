export interface ProjectModuleDto {
  documentId: string;
  name: string;
  description?: string;
  project?: {
    documentId: string;
    key: string;
  };
}

export interface ProjectRoleDto {
  documentId: string;
  name: string;
  description?: string;
  project?: {
    documentId: string;
    key: string;
  };
}

export interface SprintDto {
  documentId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  objective?: string;
  project?: {
    documentId: string;
    key: string;
  };
}
