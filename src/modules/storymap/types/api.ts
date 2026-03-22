export interface ProjectStoryMapDto {
  documentId: string;
  snapshot?: string;
  project?: {
    documentId: string;
  };
  organization?: {
    documentId: string;
  };
}
