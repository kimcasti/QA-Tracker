import type { ReportAutomationJob } from '../modules/automation/services/reportAutomationJobs';
import { automationReportTimestamp } from './automationReportTimestamp';
import {
  AutomationResultStatus, AutomationTool, ExecutionStatus, TestType, deriveAutomationStatus, isAutomatedCoverageStatus,
  type AutomationImportHistoryEntry, type Functionality, type TestCase, type TestRun,
} from '../types';

const percent = (value: number, total: number) => total ? Math.round(value / total * 100) : 0;
export const reportEntityAliases = (item: { id: string; documentId?: string }) =>
  [...new Set([item.id, item.documentId].filter((value): value is string => Boolean(value)))];
export const reportHasAutomatedCoverage = (item: Pick<TestCase, 'automationStatus' | 'isAutomated'>) =>
  isAutomatedCoverageStatus(deriveAutomationStatus(item));
export function reportIdentityMap<T extends { id: string; documentId?: string }>(items: T[]) {
  return new Map(items.flatMap(item => reportEntityAliases(item).map(id => [id, item] as const)));
}

export function reportRunAutomationMetrics(testRun: TestRun | null, testCaseMap: Map<string, TestCase>) {
  const cases = reportIdentityMap([...testCaseMap.values()]);
  const related = (testRun?.results || []).map(result => cases.get(result.testCaseId)).filter((item): item is TestCase => Boolean(item));
  const automatedCount = related.filter(reportHasAutomatedCoverage).length;
  const tools = new Map<AutomationTool, number>();
  related.filter(reportHasAutomatedCoverage).forEach(item => {
    if (item.automationTool) tools.set(item.automationTool, (tools.get(item.automationTool) || 0) + 1);
  });
  return {
    automatedCount,
    manualCount: Math.max((testRun?.results.length || 0) - automatedCount, 0),
    automationRate: percent(automatedCount, testRun?.results.length || 0),
    leadingAutomationTool: [...tools].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    latestAutomationResult: related.filter(item => item.lastAutomationStatus)
      .sort((a, b) => Date.parse(b.lastAutomationRunAt || '') - Date.parse(a.lastAutomationRunAt || ''))[0]?.lastAutomationStatus || null,
  };
}

type ReportAutomationHistory = Pick<AutomationImportHistoryEntry, 'id' | 'tool' | 'importedAt' | 'matchedCases'> & { testRunId: string };
type ReportAutomationOptions = { sprint?: string | null; runs?: TestRun[]; histories?: ReportAutomationHistory[]; jobs?: ReportAutomationJob[] };
const sprintKey = (value?: string | null) => (value || '').trim().toLowerCase().replace(/^sprint\s*/i, '');

export function reportAutomationPortfolio(functionalities: Functionality[], testCases: TestCase[], options: ReportAutomationOptions = {}) {
  const scopedFunctionalities = options.sprint
    ? functionalities.filter(item => sprintKey(item.sprint) === sprintKey(options.sprint)) : functionalities;
  const identities = reportIdentityMap(scopedFunctionalities);
  const scopedTestCases = options.sprint ? testCases.filter(item => identities.has(item.functionalityId)) : testCases;
  testCases = scopedTestCases;
  const grouped = new Map<Functionality, TestCase[]>();
  testCases.forEach(item => {
    const functionality = identities.get(item.functionalityId);
    if (functionality) grouped.set(functionality, [...(grouped.get(functionality) || []), item]);
  });
  const functionalityCoverage = [...grouped].map(([item, cases]) => ({
    id: item.id, name: item.name, totalCases: cases.length,
    automatedCases: cases.filter(reportHasAutomatedCoverage).length,
    coverage: percent(cases.filter(reportHasAutomatedCoverage).length, cases.length),
  })).sort((a, b) => b.coverage - a.coverage || b.automatedCases - a.automatedCases);
  const modules = new Map<string, { name: string; totalCases: number; automatedCases: number }>();
  grouped.forEach((cases, item) => {
    const name = item.module || 'Sin módulo';
    const row = modules.get(name) || { name, totalCases: 0, automatedCases: 0 };
    row.totalCases += cases.length;
    row.automatedCases += cases.filter(reportHasAutomatedCoverage).length;
    modules.set(name, row);
  });
  // Never infer execution provenance from a case's coverage flag or a manual run result.
  // A sprint needs persisted automation provenance linked to the exact finalized run and case.
  const casesById = reportIdentityMap(testCases);
  const runsById = reportIdentityMap((options.runs || []).filter(item =>
    item.status === ExecutionStatus.FINAL && [TestType.SMOKE, TestType.REGRESSION].includes(item.testType) &&
    (!options.sprint || sprintKey(item.sprint) === sprintKey(options.sprint)),
  ));
  const observations = new Map<string, { tool: string; status?: AutomationResultStatus; at: number }>();
  const observationKey = (item: TestCase, tool: string) => JSON.stringify([item.documentId || item.id, tool]);
  testCases.forEach(item => {
    if (!item.automationTool) return;
    observations.set(observationKey(item, item.automationTool), {
      tool: item.automationTool,
      status: options.sprint ? undefined : item.lastAutomationStatus,
      at: options.sprint ? -Infinity : (Date.parse(item.lastAutomationRunAt || '') || -Infinity),
    });
  });
  for (const history of options.histories || []) {
    const run = runsById.get(history.testRunId);
    const at = automationReportTimestamp(history.importedAt);
    if (!run || !history.tool || !Number.isFinite(at)) continue;
    const runCases = new Set(run.results.map(result => casesById.get(result.testCaseId)).filter(Boolean));
    for (const match of history.matchedCases) {
      const item = casesById.get(match.testCaseId);
      if (!item || !runCases.has(item)) continue;
      const key = observationKey(item, history.tool);
      const previous = observations.get(key);
      if (!previous || at >= previous.at) observations.set(key, { tool: history.tool, status: match.status, at });
    }
  }
  // The runner protocol only executes Playwright. Its selected result/case IDs and
  // persisted outcome references are the provenance, not today's case metadata.
  const runnerStatuses: Record<string, AutomationResultStatus> = {
    passed: AutomationResultStatus.PASSED, failed: AutomationResultStatus.FAILED,
    skipped: AutomationResultStatus.SKIPPED, unknown: AutomationResultStatus.UNKNOWN,
  };
  for (const job of options.jobs || []) {
    const run = runsById.get(job.runId);
    const at = automationReportTimestamp(job.finishedAt);
    if (!run || job.state !== 'completed' || !Number.isFinite(at) ||
        !job.cases?.length || job.completedCount !== job.cases.length ||
        !job.outcomes || job.outcomes.length !== job.cases.length) continue;
    const references = new Set(job.cases.map(selected => selected.reference));
    if (references.size !== job.cases.length || job.outcomes.some(outcome =>
      !references.has(outcome.automationReference) || !Object.hasOwn(runnerStatuses, outcome.status)) ||
      new Set(job.outcomes.map(outcome => outcome.automationReference)).size !== references.size) continue;
    for (const selected of job.cases) {
      const item = casesById.get(selected.caseId);
      if (!item || !selected.resultId || !selected.reference || !run.results.some(result =>
        result.id === selected.resultId && casesById.get(result.testCaseId) === item)) continue;
      const outcome = job.outcomes.find(value => value.automationReference === selected.reference)!;
      const tool = AutomationTool.PLAYWRIGHT;
      const key = observationKey(item, tool);
      const previous = observations.get(key);
      if (!previous || at >= previous.at) observations.set(key, { tool, status: runnerStatuses[outcome.status], at });
    }
  }
  const tools = new Map<string, { tool: string; total: number; passed: number }>();
  observations.forEach(item => {
    const row = tools.get(item.tool) || { tool: item.tool, total: 0, passed: 0 };
    if (item.status === AutomationResultStatus.PASSED || item.status === AutomationResultStatus.FAILED) {
      row.total++;
      if (item.status === AutomationResultStatus.PASSED) row.passed++;
    }
    tools.set(item.tool, row);
  });
  return {
    scopedFunctionalities,
    scopedTestCases,
    functionalityCoverage,
    moduleCoverage: [...modules.values()].map(row => ({ ...row, coverage: percent(row.automatedCases, row.totalCases) }))
      .sort((a, b) => b.coverage - a.coverage || b.automatedCases - a.automatedCases),
    successByTool: [...tools.values()].map(row => ({ ...row, successRate: row.total ? percent(row.passed, row.total) : null })),
  };
}
