export interface AutomationImportHistoryMatchDto {
  testCaseId: string;
  testCaseTitle: string;
  reference: string;
  status: string;
  bugId?: string;
}

export interface AutomationImportHistoryDto {
  documentId: string;
  tool?: string;
  importedAt?: string;
  matchedCount?: number;
  missingReferenceCount?: number;
  unmatchedExecutionCount?: number;
  unmatchedReportReferenceCount?: number;
  duplicateReferenceCount?: number;
  matchedCases?: AutomationImportHistoryMatchDto[];
  project?: {
    documentId: string;
    key: string;
  };
  testRun?: {
    documentId: string;
    title: string;
    status?: string;
    testType?: string;
  };
}
