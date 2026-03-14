export interface FunctionalityDto {
  documentId: string;
  code: string;
  name: string;
  testTypes?: string[];
  isRegression?: boolean;
  isSmoke?: boolean;
  deliveryDate?: string;
  status?: string;
  priority?: string;
  riskLevel?: string;
  storyLegacyId?: string;
  project?: {
    documentId: string;
    key: string;
  };
  module?: {
    documentId: string;
    name: string;
  };
  personaRoles?: Array<{
    documentId: string;
    name: string;
  }>;
  sprint?: {
    documentId: string;
    name: string;
  };
}
