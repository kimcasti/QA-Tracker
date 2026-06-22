export interface TestCaseTemplateDto {
  documentId: string;
  name: string;
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
  project?: {
    documentId: string;
    key: string;
  };
  module?: {
    documentId: string;
    name: string;
  };
}
