import assert from 'node:assert/strict';
import test from 'node:test';
import { reportAutomationPortfolio } from '../src/utils/reportAutomationMetrics';
import { AutomationTool, AutomationResultStatus, ExecutionStatus, TestType, type TestRun, type TestCase, type Functionality } from '../src/types';
import type { AutomationJob } from '../src/modules/automation/services/runnerService';

export const reportRunnerFixture = {
  functionality: { id: 'FUN-7', documentId: 'fun-seven', sprint: 'Sprint 7', name: 'Synthetic login', module: 'Access' } as Functionality,
  testCase: { id: 'TC-7', documentId: 'case-seven', functionalityId: 'fun-seven', automationTool: AutomationTool.PLAYWRIGHT } as TestCase,
  run: { id: 'run-seven', status: ExecutionStatus.FINAL, testType: TestType.REGRESSION, sprint: '7', results: [{ id: 'result-seven', testCaseId: 'case-seven' }] } as TestRun,
  job: { id: 17, runId: 'run-seven', runnerId: 3, state: 'completed', cases: [{ resultId: 'result-seven', caseId: 'case-seven', reference: 'login.spec.ts::login succeeds', title: 'Synthetic login' }], completedCount: 1, startedAt: '2026-10-20T10:00:00Z', finishedAt: '2026-10-20T10:05:00Z', outcomes: [{ automationReference: 'login.spec.ts::login succeeds', status: 'passed' }] } as AutomationJob,
};
const { functionality, testCase, run, job } = reportRunnerFixture;
const metrics = (jobs = [job], histories: any[] = [], runs = [run], cases = [testCase]) => reportAutomationPortfolio([functionality], cases, { sprint: '7', runs, histories, jobs } as any);

test('sprint 7 counts persisted completed runner PASSED without import history', () => {
  assert.equal(metrics().successByTool[0]?.successRate, 100);
  assert.equal(metrics().successByTool[0]?.total, 1);
});

test('runner PASSED newer than imported FAILED wins once per exact case/tool', () => {
  const history = { id: 'import-one', testRunId: run.id, tool: AutomationTool.PLAYWRIGHT, importedAt: '2026-10-20T09:00:00Z', matchedCases: [{ testCaseId: testCase.id, status: AutomationResultStatus.FAILED }] };
  assert.equal(metrics([job], [history]).successByTool[0]?.successRate, 100);
  assert.equal(metrics([job], [history]).successByTool[0]?.total, 1);
  assert.equal(metrics([job], [{ ...history, importedAt: '2026-10-20T11:00:00Z' }]).successByTool[0]?.successRate, 0);
});

for (const [name, override] of Object.entries({
  draftJob: { state: 'pending' }, runningJob: { state: 'running' }, interruptedJob: { state: 'interrupted' },
  failedJob: { state: 'failed' }, foreignRun: { runId: 'other-run' }, invalidTime: { finishedAt: 'invalid' },
  missingTime: { finishedAt: undefined }, unpublished: { outcomes: undefined },
  unfinished: { completedCount: 0 }, foreignReference: { outcomes: [{ automationReference: 'other.spec.ts::other', status: 'passed' }] },
  invalidOutcome: { outcomes: [{ automationReference: job.cases[0].reference, status: 'PASSED' }] },
  foreignCase: { cases: [{ ...job.cases[0], caseId: 'foreign-case' }] },
  foreignResult: { cases: [{ ...job.cases[0], resultId: 'foreign-result' }] },
  emptySelection: { cases: [], outcomes: [], completedCount: 0 },
  duplicateOutcomes: { outcomes: [job.outcomes![0], job.outcomes![0]] },
})) {
  test(`runner provenance rejects ${name}`, () => {
    assert.equal(metrics([{ ...job, ...override } as AutomationJob]).successByTool[0]?.successRate, null);
  });
}
for (const [name, override] of Object.entries({ draft: { status: ExecutionStatus.DRAFT }, foreignSprint: { sprint: '8' }, uat: { testType: TestType.UAT }, absentCase: { results: [] } })) {
  test(`runner provenance rejects ${name} run`, () => {
    assert.equal(metrics([job], [], [{ ...run, ...override } as TestRun]).successByTool[0]?.successRate, null);
  });
}
test('runner uses persisted Playwright identity, aliases and finishedAt, not current snapshots or tool', () => {
  const aliasedRun = { ...run, id: 'TR-7', documentId: run.id, results: [{ ...run.results[0], testCaseId: 'TC-7' }] };
  const changedCase = { ...testCase, automationTool: AutomationTool.CYPRESS, lastAutomationStatus: AutomationResultStatus.FAILED, lastAutomationRunAt: '2026-10-20T12:00:00Z' };
  const rows = metrics([job, job], [], [aliasedRun], [changedCase]).successByTool;
  assert.equal(rows.find(row => row.tool === AutomationTool.PLAYWRIGHT)?.successRate, 100);
  assert.equal(rows.find(row => row.tool === AutomationTool.PLAYWRIGHT)?.total, 1);
  assert.equal(rows.find(row => row.tool === AutomationTool.CYPRESS)?.successRate, null);
});
test('latest unknown runner outcome is unavailable, not an old pass or fabricated failure', () => {
  const newer = { ...job, id: 18, finishedAt: '2026-10-20T11:00:00Z', outcomes: [{ ...job.outcomes![0], status: 'unknown' }] };
  assert.equal(metrics([newer, job]).successByTool[0]?.successRate, null);
});
