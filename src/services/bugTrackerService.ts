import dayjs from 'dayjs';
import { BugStatus, type BugOrigin, type QABug, type Severity } from '../types';
import { getBugs, saveBug } from '../modules/bugs/services/bugsService';

export interface BugSyncPayload {
  linkedBugId?: string;
  internalBugId?: string;
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

const INTERNAL_BUG_ID_REGEX = /^BUG-(\d+)$/i;

function formatInternalBugId(sequence: number) {
  return `BUG-${sequence.toString().padStart(4, '0')}`;
}

function extractInternalBugSequence(value?: string) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return null;

  const match = normalizedValue.match(INTERNAL_BUG_ID_REGEX);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getNextInternalBugId(existingIds: Array<string | undefined>) {
  const maxSequence = existingIds.reduce((currentMax, id) => {
    const sequence = extractInternalBugSequence(id);
    return sequence && sequence > currentMax ? sequence : currentMax;
  }, 0);

  return formatInternalBugId(maxSequence + 1);
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

export function shouldSyncBug(
  payload: Pick<
    BugSyncPayload,
    | 'linkedBugId'
    | 'internalBugId'
    | 'externalBugId'
    | 'title'
    | 'description'
    | 'severity'
    | 'bugLink'
    | 'evidenceImage'
  >,
) {
  return Boolean(
    normalize(payload.linkedBugId) ||
      normalize(payload.internalBugId) ||
      normalize(payload.externalBugId) ||
      normalize(payload.title) ||
      normalize(payload.description) ||
      payload.severity ||
      normalize(payload.bugLink) ||
      payload.evidenceImage,
  );
}

export async function previewNextInternalBugId(
  projectId: string,
  draftIds: Array<string | undefined> = [],
) {
  const bugs = await getBugs(projectId);
  return getNextInternalBugId([...bugs.map(bug => bug.internalBugId), ...draftIds]);
}

export async function syncBugReport(payload: BugSyncPayload): Promise<QABug | null> {
  if (!shouldSyncBug(payload)) {
    return null;
  }

  const bugs = await getBugs(payload.projectId);
  const linkedSourceId = buildLinkedSourceId(payload);
  const normalizedLinkedBugId = normalize(payload.linkedBugId);
  const normalizedInternalBugId = normalize(payload.internalBugId);
  const normalizedExternalBugId = normalize(payload.externalBugId);
  const now = dayjs().toISOString();

  const existing =
    bugs.find(bug => normalizedLinkedBugId && bug.internalBugId === normalizedLinkedBugId) ||
    bugs.find(bug => normalizedInternalBugId && bug.internalBugId === normalizedInternalBugId) ||
    bugs.find(bug => bug.linkedSourceId === linkedSourceId) ||
    bugs.find(
      bug =>
        normalizedExternalBugId &&
        bug.projectId === payload.projectId &&
        bug.origin === payload.origin &&
        bug.functionalityId === payload.functionalityId &&
        (bug.cycleId || undefined) === (payload.cycleId || undefined) &&
        (bug.testCaseId || undefined) === (payload.testCaseId || undefined) &&
        bug.externalBugId === normalizedExternalBugId,
    );

  const bug: QABug = {
    internalBugId:
      existing?.internalBugId ||
      normalizedInternalBugId ||
      getNextInternalBugId(bugs.map(item => item.internalBugId)),
    externalBugId: normalizedExternalBugId,
    title:
      normalize(payload.title) ||
      existing?.title ||
      normalizedExternalBugId ||
      `Bug ${payload.functionalityId}`,
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

  return saveBug(bug);
}
