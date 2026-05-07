import type { ProjectServiceBillingPhase } from '../../../types';

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
  serviceBillingPhases?: ProjectServiceBillingPhase[] | string | null;
  proposalType?: string | null;
  proposalSentAt?: string | null;
  projectStartAt?: string | null;
  contractNumber?: string | null;
  proposalNumber?: string | null;
  currency?: string | null;
  paymentTermsDays?: number | null;
  proposalOwner?: string | null;
  organization?: {
    documentId: string;
    name: string;
  };
}
