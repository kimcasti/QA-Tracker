export interface TestRunResultDto {
  documentId: string;
  result?: string;
  notes?: string;
  evidenceImage?: string;
  bugTitle?: string;
  bugLink?: string;
  severity?: string;
  linkedBugId?: string;
  testRun?: {
    documentId: string;
  };
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
  browser?: string;
  deviceType?: string;
  operatingSystem?: string;
  browserVersion?: string;
  osVersion?: string;
  resolution?: string;
  identifiedRisks?: string[];
  exitCriteria?: string[];
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
  publicUatSession?: {
    documentId: string;
    status: 'draft' | 'active' | 'completed' | 'expired' | 'revoked';
    expiresAt?: string | null;
    activatedAt?: string | null;
    completedAt?: string | null;
    revokedAt?: string | null;
    lastAccessedAt?: string | null;
    allowResultEditing?: boolean;
    allowEvidenceUpload?: boolean;
    allowCommentEditing?: boolean;
    completionLocked?: boolean;
    publicUrl?: string | null;
    participant?: {
      documentId?: string | null;
      name: string;
      email?: string | null;
      role?: string;
    } | null;
  } | null;
}
