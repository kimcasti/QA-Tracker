import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportAutomationPortfolio } from '../src/utils/reportAutomationMetrics';
import { AutomationResultStatus, AutomationStatus, AutomationTool, ExecutionStatus, Priority, TestResult, TestType,
  type Functionality, type TestCase, type TestRun } from '../src/types';

const current = { id: 'CURRENT', documentId: 'current-function', name: 'Current delivery', module: 'Current module', sprint: '6' } as Functionality;
const older = { id: 'OLDER', documentId: 'older-function', name: 'Earlier delivery', module: 'Earlier module', sprint: '2' } as Functionality;
const manual = { id: 'CURRENT-CASE', documentId: 'current-case', functionalityId: current.id,
  automationStatus: AutomationStatus.NOT_AUTOMATED, isAutomated: false } as TestCase;
const automatic = { id: 'OLD-CASE', documentId: 'old-case', functionalityId: older.documentId,
  automationStatus: AutomationStatus.AUTOMATED, isAutomated: true, automationTool: AutomationTool.PLAYWRIGHT } as TestCase;
const run: TestRun & { documentId: string } = { id: 'RUN-6', documentId: 'run-six', projectId: 'SYNTHETIC-PROJECT',
  title: 'Synthetic regression', description: '', executionDate: '2026-10-20', priority: Priority.MEDIUM,
  tester: 'Synthetic tester', selectedModules: [], selectedFunctionalities: [older.id],
  status: ExecutionStatus.FINAL, testType: TestType.REGRESSION, sprint: 'Sprint 6',
  results: [{ id: 'RESULT-OLD', functionalityId: older.id, testCaseId: automatic.documentId!, result: TestResult.PASSED }] };
const history = { id: 'import-six', testRunId: run.documentId!, tool: AutomationTool.PLAYWRIGHT,
  importedAt: '2026-10-20T10:00:00Z', matchedCases: [{ testCaseId: automatic.id,
    testCaseTitle: 'Synthetic historical case', reference: 'older.spec.ts::case', status: AutomationResultStatus.PASSED }] };
type Options = NonNullable<Parameters<typeof reportAutomationPortfolio>[2]>;
const metrics = (options: Partial<Options> = {}) => reportAutomationPortfolio([current, older], [manual, automatic],
  { sprint: '6', runs: [run], histories: [history], ...options });

test('sprint approval includes an imported result from an earlier delivery without changing current coverage', () => {
  const result = metrics();
  assert.deepEqual(result.scopedTestCases.map(item => item.id), [manual.id]);
  assert.deepEqual(result.moduleCoverage, [{ name: current.module, totalCases: 1, automatedCases: 0, coverage: 0 }]);
  assert.equal(result.functionalityCoverage.length, 1);
  assert.equal(result.functionalityCoverage[0].coverage, 0);
  const tool = result.successByTool.find(item => item.tool === AutomationTool.PLAYWRIGHT);
  assert.equal(tool?.total, 1);
  assert.equal(tool?.successRate, 100);
});

const job = { id: 6, runId: run.documentId!, state: 'completed' as const, finishedAt: '2026-10-20T11:00:00Z',
  completedCount: 1, cases: [{ caseId: automatic.id, resultId: run.results[0].id, reference: 'older.spec.ts::case' }],
  outcomes: [{ automationReference: 'older.spec.ts::case', status: 'passed' as const }] };
const toolRate = (value: ReturnType<typeof metrics>) => value.successByTool.find(row => row.tool === AutomationTool.PLAYWRIGHT)?.successRate ?? null;

test('runner publication for an earlier-delivery case is attributed to the execution sprint', () => {
  const value = metrics({ histories: [], jobs: [job] });
  assert.equal(toolRate(value), 100);
  assert.equal(value.moduleCoverage[0].coverage, 0);
  assert.deepEqual(value.scopedFunctionalities.map(item => item.id), [current.id]);
});

test('cross-delivery imports and runner merge once per case and tool by event time', () => {
  const failed = { ...history, matchedCases: [{ ...history.matchedCases[0], status: AutomationResultStatus.FAILED }] };
  const value = metrics({ histories: [failed, failed], jobs: [job, job] });
  assert.equal(toolRate(value), 100);
  assert.equal(value.successByTool[0].total, 1);
  assert.equal(toolRate(metrics({ histories: [{ ...failed, importedAt: '2026-10-20T12:00:00Z' }], jobs: [job] })), 0);
});

for (const [label, override] of [
  ['different execution sprint', { sprint: '7' }], ['draft execution', { status: ExecutionStatus.DRAFT }],
  ['UAT execution', { testType: TestType.UAT }], ['case absent from execution', { results: [] }],
] as const) {
  test(`cross-delivery provenance still rejects ${label}`, () => {
    const value = metrics({ runs: [{ ...run, ...override } as TestRun], jobs: [job] });
    assert.equal(toolRate(value), null);
    assert.ok(value.successByTool.every(row => row.total === 0));
  });
}

test('a case outside the project functionality set is excluded even when named in the run and sources', () => {
  const foreign = { ...automatic, functionalityId: 'outside-project', title: older.name };
  const value = reportAutomationPortfolio([current, older], [manual, foreign],
    { sprint: '6', runs: [run], histories: [history], jobs: [job] });
  assert.equal(toolRate(value), null);
  assert.equal(value.moduleCoverage[0].coverage, 0);
});

test('manual execution success and global case snapshots do not become sprint automation outcomes', () => {
  const value = reportAutomationPortfolio([current, older], [manual, { ...automatic,
    lastAutomationStatus: AutomationResultStatus.PASSED, lastAutomationRunAt: '2026-10-20T14:00:00Z' }],
  { sprint: '6', runs: [run], histories: [], jobs: [] });
  assert.equal(toolRate(value), null);
});

test('an execution sprint without new delivery cases can still have proven automation results', () => {
  const value = reportAutomationPortfolio([older], [automatic], { sprint: '6', runs: [run], histories: [history] });
  assert.deepEqual(value.moduleCoverage, []);
  assert.deepEqual(value.scopedTestCases, []);
  assert.equal(toolRate(value), 100);
});

test('without sprint filter global coverage and current-case fallback stay unchanged', () => {
  const value = metrics({ sprint: undefined });
  assert.equal(value.scopedTestCases.length, 2);
  assert.equal(value.functionalityCoverage.find(item => item.id === older.id)?.coverage, 100);
  assert.equal(value.functionalityCoverage.find(item => item.id === current.id)?.coverage, 0);
  assert.equal(toolRate(value), 100);
});
