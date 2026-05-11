export interface DeliveryUnitDto {
  documentId: string;
  name: string;
  type?: string;
  baseDescription?: string;
  startDate?: string;
  estimatedEndDate?: string;
  periodLabel?: string;
  amount?: number | string | null;
  status?: string;
  sortOrder?: number;
  activities?: Array<{
    documentId: string;
    name: string;
    category?: string | null;
    isActive?: boolean | null;
  }>;
  project?: {
    documentId: string;
    key: string;
  };
  proposal?: {
    documentId: string;
    name: string;
    proposalOwner?: string | null;
  } | null;
}
