import type {
  AutomationImportHistoryEntry,
  ExecutionStatus,
  TestType,
} from '../../../types';

export interface AutomationImportHistoryRecord extends AutomationImportHistoryEntry {
  documentId: string;
  projectId: string;
  testRunId: string;
  testRunTitle: string;
  testRunStatus: ExecutionStatus;
  testRunType: TestType;
}
