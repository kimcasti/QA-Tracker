import type { SlackMember } from '../../slack-members/types/model';
import type { Functionality, RegressionExecution } from '../../../types';
import { ExecutionMode, TestResult } from '../../../types';

export type CycleTesterAssignment = {
  name: string;
  email?: string;
};

export type AssignmentSelections = Record<string, string | undefined>;

export function getCycleTesterAssignmentValue(assignment: CycleTesterAssignment) {
  return assignment.email || assignment.name;
}

type ModuleScopedAssignmentItem = {
  id: string;
  module: string;
  assignedTesterName?: string;
  assignedTesterEmail?: string;
};

type ExecutionIdentityInput = {
  module?: string;
  functionalityId?: string;
  functionalityName?: string;
  testCaseId?: string;
  testCaseTitle?: string;
};

function normalizeComparableValue(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizeEmail(value?: string | null) {
  const normalized = normalizeComparableValue(value);
  return normalized || undefined;
}

function executionProgressScore(execution: Pick<
  RegressionExecution,
  | 'executed'
  | 'result'
  | 'date'
  | 'evidence'
  | 'evidenceImage'
  | 'bugTitle'
  | 'bugLink'
  | 'severity'
  | 'linkedBugId'
>) {
  let score = 0;

  if (execution.executed) score += 4;
  if (execution.result && execution.result !== TestResult.NOT_EXECUTED) score += 4;
  if ((execution.date || '').trim()) score += 1;
  if ((execution.evidence || '').trim()) score += 3;
  if ((execution.evidenceImage || '').trim()) score += 3;
  if ((execution.bugTitle || '').trim()) score += 2;
  if ((execution.bugLink || '').trim()) score += 1;
  if (execution.severity) score += 1;
  if ((execution.linkedBugId || '').trim()) score += 1;

  return score;
}

function compareIsoDate(left?: string, right?: string) {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;

  if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
  if (!Number.isFinite(leftTime)) return -1;
  if (!Number.isFinite(rightTime)) return 1;
  return leftTime - rightTime;
}

function preferExecution(left: RegressionExecution, right: RegressionExecution) {
  const leftScore = executionProgressScore(left);
  const rightScore = executionProgressScore(right);

  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left : right;
  }

  return compareIsoDate(left.updatedAt, right.updatedAt) >= 0 ? left : right;
}

function mergeExecutionFields(
  preferred: RegressionExecution,
  candidate: RegressionExecution,
): RegressionExecution {
  return {
    ...preferred,
    module: preferred.module || candidate.module,
    functionalityId: preferred.functionalityId || candidate.functionalityId,
    functionalityName: preferred.functionalityName || candidate.functionalityName,
    testCaseId: preferred.testCaseId || candidate.testCaseId,
    testCaseTitle: preferred.testCaseTitle || candidate.testCaseTitle,
    executionMode: preferred.executionMode || candidate.executionMode,
    executed: preferred.executed || candidate.executed,
    date: preferred.date || candidate.date,
    result:
      preferred.result && preferred.result !== TestResult.NOT_EXECUTED
        ? preferred.result
        : candidate.result,
    evidence: preferred.evidence || candidate.evidence,
    evidenceImage: preferred.evidenceImage || candidate.evidenceImage,
    bugId: preferred.bugId || candidate.bugId,
    bugTitle: preferred.bugTitle || candidate.bugTitle,
    bugLink: preferred.bugLink || candidate.bugLink,
    severity: preferred.severity || candidate.severity,
    linkedBugId: preferred.linkedBugId || candidate.linkedBugId,
    assignedTesterName: preferred.assignedTesterName || candidate.assignedTesterName,
    assignedTesterEmail: preferred.assignedTesterEmail || candidate.assignedTesterEmail,
    updatedAt:
      compareIsoDate(preferred.updatedAt, candidate.updatedAt) >= 0
        ? preferred.updatedAt
        : candidate.updatedAt,
  };
}

export function buildExecutionIdentity(input: ExecutionIdentityInput) {
  const moduleKey = normalizeComparableValue(input.module) || '__module__';
  const functionalityKey =
    normalizeComparableValue(input.functionalityId) ||
    normalizeComparableValue(input.functionalityName) ||
    '__functionality__';
  const testCaseKey =
    normalizeComparableValue(input.testCaseId) ||
    normalizeComparableValue(input.testCaseTitle) ||
    '__functionality_execution__';

  return `${moduleKey}::${functionalityKey}::${testCaseKey}`;
}

export function dedupeRegressionExecutions(executions: RegressionExecution[]) {
  const deduped = new Map<string, RegressionExecution>();

  executions.forEach(execution => {
    const identity = buildExecutionIdentity(execution);
    const current = deduped.get(identity);

    if (!current) {
      deduped.set(identity, execution);
      return;
    }

    const preferred = preferExecution(current, execution);
    const candidate = preferred.id === current.id ? execution : current;
    deduped.set(identity, mergeExecutionFields(preferred, candidate));
  });

  return Array.from(deduped.values());
}

export function resolveCycleTesterAssignments(
  testerValues: string[],
  members: SlackMember[],
) {
  return testerValues
    .map(value => {
      const normalizedValue = normalizeComparableValue(value);
      const member = members.find(item => {
        return (
          normalizeComparableValue(item.fullName) === normalizedValue ||
          normalizeComparableValue(item.email) === normalizedValue ||
          normalizeComparableValue(item.username) === normalizedValue
        );
      });

      return {
        name: member?.fullName || value.trim(),
        email: normalizeEmail(member?.email),
      } satisfies CycleTesterAssignment;
    })
    .filter(item => item.name);
}

export function resolveSelectedTesterAssignment(
  assignments: CycleTesterAssignment[],
  value?: string | null,
) {
  if (!value) return undefined;

  return assignments.find(
    assignment =>
      getCycleTesterAssignmentValue(assignment) === value ||
      assignment.name === value ||
      assignment.email === value,
  );
}

export function groupItemsByModule<T extends { module: string }>(items: T[]) {
  const groups = new Map<string, T[]>();

  items.forEach(item => {
    const moduleName = normalizeModuleAssignmentKey(item.module);
    const group = groups.get(moduleName) || [];
    group.push(item);
    groups.set(moduleName, group);
  });

  return Array.from(groups.entries()).map(([module, groupedItems]) => ({
    module,
    items: groupedItems,
  }));
}

export function resolveAssignmentSelection(
  itemSelection?: string | null,
  moduleSelection?: string | null,
  fallbackSelection?: string | null,
) {
  return itemSelection ?? moduleSelection ?? fallbackSelection ?? undefined;
}

export function normalizeModuleAssignmentKey(moduleName?: string | null) {
  return moduleName?.trim() || 'Sin modulo';
}

export function buildModuleAssignmentState<T extends ModuleScopedAssignmentItem>(items: T[]) {
  const moduleSelections: AssignmentSelections = {};
  const itemSelections: AssignmentSelections = {};

  groupItemsByModule(items).forEach(group => {
    const assignmentValues = Array.from(
      new Set(
        group.items
          .map(item => item.assignedTesterEmail || item.assignedTesterName)
          .filter(Boolean),
      ),
    );

    if (assignmentValues.length === 1) {
      moduleSelections[group.module] = assignmentValues[0];
      return;
    }

    group.items.forEach(item => {
      itemSelections[item.id] = item.assignedTesterEmail || item.assignedTesterName || undefined;
    });
  });

  return {
    moduleSelections,
    itemSelections,
  };
}

export function buildAssignedExecutions(
  functionalities: Functionality[],
  testers: CycleTesterAssignment[],
  executionMode = ExecutionMode.MANUAL,
) {
  const executionSeeds = functionalities.map(functionality => ({
    id: Math.random().toString(36).slice(2, 11),
    functionalityId: functionality.id,
    module: functionality.module,
    functionalityName: functionality.name,
    executionMode,
    executed: false,
    result: TestResult.NOT_EXECUTED,
    date: undefined,
  })) satisfies RegressionExecution[];

  return applyTesterAssignmentsToExecutions(executionSeeds, testers);
}

export function applyTesterAssignmentsToExecutions(
  executions: RegressionExecution[],
  testers: CycleTesterAssignment[],
) {
  const assignmentsByModule = new Map<string, CycleTesterAssignment | undefined>();
  let nextTesterIndex = 0;

  return executions.map(execution => {
    if (!assignmentsByModule.has(execution.module)) {
      const tester =
        testers.length > 0 ? testers[nextTesterIndex % testers.length] : undefined;
      assignmentsByModule.set(execution.module, tester);
      nextTesterIndex += 1;
    }

    const assignedTester = assignmentsByModule.get(execution.module);

    return {
      ...execution,
      assignedTesterName: assignedTester?.name,
      assignedTesterEmail: assignedTester?.email,
    };
  });
}

export function canEditAssignedExecution(
  execution: Pick<RegressionExecution, 'assignedTesterEmail' | 'assignedTesterName'>,
  currentUserEmail?: string | null,
  canOverrideAssignment = false,
  currentUserName?: string | null,
) {
  if (canOverrideAssignment) return true;

  const assignedEmail = normalizeEmail(execution.assignedTesterEmail);
  const assignedName = normalizeComparableValue(execution.assignedTesterName);
  if (!assignedEmail && !assignedName) return true;

  const currentIdentities = new Set<string>();
  const normalizedCurrentEmail = normalizeEmail(currentUserEmail);
  const normalizedCurrentName = normalizeComparableValue(currentUserName);

  if (normalizedCurrentEmail) {
    currentIdentities.add(normalizedCurrentEmail);
    const [localPart] = normalizedCurrentEmail.split('@');
    if (localPart) {
      currentIdentities.add(localPart);
    }
  }

  if (normalizedCurrentName) {
    currentIdentities.add(normalizedCurrentName);
  }

  if (assignedEmail && currentIdentities.has(assignedEmail)) return true;
  if (assignedName && currentIdentities.has(assignedName)) return true;

  return false;
}
