import type { ProjectServiceBillingPhase } from '../../../types';

export interface ProjectProposalDto {
  documentId: string;
  name: string;
  status?: string | null;
  isPrimary?: boolean | null;
  serviceBillingPhases?: ProjectServiceBillingPhase[] | string | null;
  proposalType?: string | null;
  proposalSentAt?: string | null;
  projectStartAt?: string | null;
  contractNumber?: string | null;
  proposalNumber?: string | null;
  currency?: string | null;
  paymentTermsDays?: number | null;
  proposalOwner?: string | null;
  project?: {
    documentId?: string;
    key?: string;
    name?: string;
  };
  organization?: {
    documentId?: string;
    name?: string;
  };
}
