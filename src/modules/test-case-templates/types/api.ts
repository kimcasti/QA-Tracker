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
  project?: {
    documentId: string;
    key: string;
  };
  module?: {
    documentId: string;
    name: string;
  };
}
