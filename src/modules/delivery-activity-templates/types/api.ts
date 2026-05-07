export interface DeliveryActivityTemplateDto {
  documentId: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
  project?: {
    documentId: string;
    key: string;
  };
}
