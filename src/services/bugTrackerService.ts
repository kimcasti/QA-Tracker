import dayjs from 'dayjs';
import { storageService } from './storageService';
import { BugStatus, type BugOrigin, type QABug, type Severity } from '../types';

export interface BugSyncPayload {
  linkedBugId?: string;
  externalBugId?: string;
  title?: string;
  description?: string;
  severity?: Severity;
  bugLink?: string;
  evidenceImage?: string;
  origin: BugOrigin;
  projectId: string;
  functionalityId: string;
  functionalityName: string;
  module: string;
  sprint?: string;
  cycleId?: string;
  reportedBy?: string;
  testCaseId?: string;
  testCaseTitle?: string;
  testRunId?: string;
  executionId?: string;
}

function normalize(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildLinkedSourceId(payload: BugSyncPayload) {
  return [
    payload.projectId,
    payload.origin,
    payload.cycleId || 'no-cycle',
    payload.testRunId || 'no-run',
    payload.executionId || 'no-execution',
    payload.testCaseId || 'no-test-case',
    payload.functionalityId,
  ].join('::');
}

export function shouldSyncBug(payload: Pick<BugSyncPayload, 'linkedBugId' | 'externalBugId' | 'title' | 'description' | 'severity' | 'bugLink' | 'evidenceImage'>) {
  return Boolean(
    normalize(payload.linkedBugId) ||
    normalize(payload.externalBugId) ||
    normalize(payload.title) ||
    normalize(payload.description) ||
    payload.severity ||
    normalize(payload.bugLink) ||
    payload.evidenceImage
  );
}

export function syncBugReport(payload: BugSyncPayload): QABug | null {
  if (!shouldSyncBug(payload)) {
    return null;
  }

  const bugs = storageService.getBugs();
  const linkedSourceId = buildLinkedSourceId(payload);
  const normalizedLinkedBugId = normalize(payload.linkedBugId);
  const normalizedExternalBugId = normalize(payload.externalBugId);
  const now = dayjs().toISOString();

  const existing =
    bugs.find(bug => normalizedLinkedBugId && bug.internalBugId === normalizedLinkedBugId) ||
    bugs.find(
      bug =>
        normalizedExternalBugId &&
        bug.projectId === payload.projectId &&
        bug.functionalityId === payload.functionalityId &&
        bug.externalBugId === normalizedExternalBugId
    ) ||
    bugs.find(bug => bug.linkedSourceId === linkedSourceId);

  const bug: QABug = {
    internalBugId: existing?.internalBugId || `BUG-${dayjs().format('YYYYMMDD-HHmmss')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    externalBugId: normalizedExternalBugId,
    title: normalize(payload.title) || existing?.title || normalizedExternalBugId || `Bug ${payload.functionalityId}`,
    description: normalize(payload.description) || existing?.description,
    severity: payload.severity || existing?.severity,
    bugLink: normalize(payload.bugLink) || existing?.bugLink,
    evidenceImage: payload.evidenceImage || existing?.evidenceImage,
    origin: existing?.origin || payload.origin,
    projectId: payload.projectId,
    functionalityId: payload.functionalityId,
    functionalityName: payload.functionalityName,
    module: payload.module,
    sprint: payload.sprint || existing?.sprint,
    cycleId: payload.cycleId || existing?.cycleId,
    detectedAt: existing?.detectedAt || now,
    reportedBy: normalize(payload.reportedBy) || existing?.reportedBy,
    status: existing?.status || BugStatus.PENDING,
    testCaseId: payload.testCaseId || existing?.testCaseId,
    testCaseTitle: normalize(payload.testCaseTitle) || existing?.testCaseTitle,
    testRunId: payload.testRunId || existing?.testRunId,
    executionId: payload.executionId || existing?.executionId,
    linkedSourceId,
    updatedAt: now,
  };

  storageService.saveBug(bug);
  return bug;
}
