export interface TestPlanDto {
  documentId: string;
  title: string;
  scope?: 'total' | 'partial';
  impactModules?: string[] | null;
  date: string;
  testType?: string;
  priority?: string;
  jiraId?: string | null;
  description?: string | null;
  project?: {
    documentId: string;
    key: string;
  };
  sprint?: {
    documentId: string;
    name: string;
  };
}
