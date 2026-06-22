export interface TestCaseDto {
  documentId: string;
  title: string;
  description?: string;
  preconditions?: string;
  testSteps?: string;
  expectedResult?: string;
  testType?: string;
  priority?: string;
  isAutomated?: boolean;
  automationStatus?: string;
  automationType?: string;
  automationTool?: string;
  automationReference?: string;
  automationOwner?: string;
  lastAutomationStatus?: string;
  lastAutomationRunAt?: string;
  sortOrder?: number;
  project?: {
    documentId: string;
    key: string;
  };
  functionality?: {
    documentId: string;
    code: string;
  };
}
