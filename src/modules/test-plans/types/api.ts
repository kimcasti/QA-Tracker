export interface TestPlanDto {
  documentId: string;
  eventType?: 'test' | 'client_meeting' | 'demo' | 'onboarding' | 'follow_up' | 'reminder';
  title: string;
  scope?: 'total' | 'partial';
  impactModules?: string[] | null;
  date: string;
  testType?: string;
  priority?: string;
  jiraId?: string | null;
  description?: string | null;
  time?: string | null;
  attendees?: string | null;
  owner?: string | null;
  project?: {
    documentId: string;
    key: string;
  };
  sprint?: {
    documentId: string;
    name: string;
  };
}
