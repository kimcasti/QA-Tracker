export interface FunctionalityDto {
  documentId: string;
  code: string;
  name: string;
  testTypes?: string[];
  isCore?: boolean;
  isRegression?: boolean;
  isSmoke?: boolean;
  lastFunctionalChangeAt?: string;
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
