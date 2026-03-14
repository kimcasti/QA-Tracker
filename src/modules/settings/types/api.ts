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
  startDate: string;
  endDate: string;
  status?: string;
  objective?: string;
  project?: {
    documentId: string;
    key: string;
  };
}
