export interface TestRunResultDto {
  documentId: string;
  result?: string;
  notes?: string;
  evidenceImage?: string;
  bugTitle?: string;
  bugLink?: string;
  severity?: string;
  linkedBugId?: string;
  functionality?: {
    documentId: string;
    code: string;
  };
  testCase?: {
    documentId: string;
    title: string;
  };
  bug?: {
    documentId: string;
    internalBugId: string;
    externalBugId?: string;
  };
}

export interface TestRunDto {
  documentId: string;
  title: string;
  description?: string;
  executionDate?: string;
  status?: string;
  testType?: string;
  priority?: string;
  tester?: string;
  buildVersion?: string;
  environment?: string;
  selectedModules?: string[];
  selectedFunctionalities?: string[];
  project?: {
    documentId: string;
    key: string;
  };
  sprint?: {
    documentId: string;
    name: string;
  };
  results?: TestRunResultDto[];
}
