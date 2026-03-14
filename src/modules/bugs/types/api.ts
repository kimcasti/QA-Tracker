export interface BugDto {
  documentId: string;
  internalBugId: string;
  externalBugId?: string;
  title: string;
  description?: string;
  severity?: string;
  bugLink?: string;
  evidenceImage?: string;
  origin?: string;
  functionalityName?: string;
  moduleName?: string;
  detectedAt: string;
  reportedBy?: string;
  status?: string;
  testCaseTitle?: string;
  linkedSourceId?: string;
  project?: {
    documentId: string;
    key: string;
  };
  functionality?: {
    documentId: string;
    code: string;
    name?: string;
  };
  sprint?: {
    documentId: string;
    name: string;
  };
  testCase?: {
    documentId: string;
    title: string;
  };
  testRun?: {
    documentId: string;
  };
  testCycle?: {
    documentId: string;
    code?: string;
  };
}
