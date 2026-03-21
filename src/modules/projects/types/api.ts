export interface ProjectDto {
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
