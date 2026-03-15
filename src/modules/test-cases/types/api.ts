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
  project?: {
    documentId: string;
    key: string;
  };
  functionality?: {
    documentId: string;
    code: string;
  };
}
