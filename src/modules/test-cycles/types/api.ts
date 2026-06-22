export interface TestCycleExecutionDto {
  documentId: string;
  updatedAt?: string;
  moduleName?: string;
  functionalityName?: string;
  testCaseTitle?: string;
  executed?: boolean;
  date?: string;
  result?: string;
  executionMode?: string;
  evidence?: string;
  evidenceImage?: string;
  bugTitle?: string;
  bugLink?: string;
  severity?: string;
  linkedBugId?: string;
  assignedTesterName?: string;
  assignedTesterEmail?: string;
  bug?: {
    documentId: string;
    internalBugId: string;
    externalBugId?: string;
  };
  functionality?: {
    documentId: string;
    code: string;
  };
  testCase?: {
    documentId: string;
    title: string;
    isAutomated?: boolean;
    automationStatus?: string;
  };
}

export interface TestCycleDto {
  documentId: string;
  code: string;
  cycleType?: string;
  date: string;
  totalTests?: number;
  passed?: number;
  failed?: number;
  blocked?: number;
  pending?: number;
  passRate?: number;
  note?: string;
  status?: string;
  tester?: string;
  buildVersion?: string;
  environment?: string;
  browser?: string;
  deviceType?: string;
  operatingSystem?: string;
  browserVersion?: string;
  osVersion?: string;
  resolution?: string;
  identifiedRisks?: string[] | null;
  exitCriteria?: string[] | null;
  project?: {
    documentId: string;
    key: string;
  };
  sprint?: {
    documentId: string;
    name: string;
  };
  executions?: TestCycleExecutionDto[];
}
