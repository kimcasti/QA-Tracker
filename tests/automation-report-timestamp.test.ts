import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AxiosAdapter } from 'axios';
import { automationReportTimestamp } from '../src/utils/automationReportTimestamp';
import { reportAutomationPortfolio } from '../src/utils/reportAutomationMetrics';
import { AutomationTool, AutomationResultStatus, ExecutionStatus, TestType, type TestRun, type TestCase, type Functionality } from '../src/types';

const functionality = { id: 'FUN-7', sprint: '7' } as Functionality;
const testCase = { id: 'TC-7', functionalityId: functionality.id, automationTool: AutomationTool.PLAYWRIGHT } as TestCase;
const run = { id: 'run-seven', sprint: '7', status: ExecutionStatus.FINAL, testType: TestType.REGRESSION,
  results: [{ id: 'result-seven', testCaseId: testCase.id }] } as TestRun;
const job = { id: 17, runId: run.id, state: 'completed', completedCount: 1,
  cases: [{ caseId: testCase.id, resultId: 'result-seven', reference: 'login.spec.ts::login' }],
  outcomes: [{ automationReference: 'login.spec.ts::login', status: 'passed' }] };
const importedMetrics = (importedAt: string) => reportAutomationPortfolio([functionality], [testCase], {
  sprint: '7', runs: [run], histories: [{ id: 'import-seven', testRunId: run.id, tool: AutomationTool.PLAYWRIGHT,
    importedAt, matchedCases: [{ testCaseId: testCase.id, testCaseTitle: 'Synthetic login', reference: 'login.spec.ts::login', status: AutomationResultStatus.PASSED }] }],
});

assert.ok(process.env.QA_SECURITY_SCRATCH);
const directory = mkdtempSync(join(process.env.QA_SECURITY_SCRATCH, 'date-fix-transport-'));
const filename = join(directory, 'transport.cjs');
const bundle = buildSync({ stdin: { contents: `export { Http } from './src/config/http';
  export { getReportAutomationJobs } from './src/modules/automation/services/reportAutomationJobs';`,
  resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://date-fix.invalid' }) }, logLevel: 'silent' });
writeFileSync(filename, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(filename);
test.after(() => rmSync(directory, { recursive: true, force: true }));
function loadJob(finishedAt: unknown) {
  const adapter: AxiosAdapter = async config => {
    assert.equal(config.method, 'get');
    assert.equal(config.url, `/api/test-runs/${run.id}/automation-report-jobs`);
    return { config, status: 200, statusText: 'OK', headers: {}, data: { data: {
      jobs: [{ ...job, finishedAt }], pagination: { page: 1, pageSize: 100, total: 1, pageCount: 1 },
    } } };
  };
  service.Http.defaults.adapter = adapter;
  return service.getReportAutomationJobs([run]);
}

test('portfolio rejects numeric importedAt instead of reporting a sprint pass', () => {
  assert.equal(importedMetrics('1').successByTool[0]?.successRate, null);
  assert.equal(importedMetrics('1').successByTool[0]?.total, 0);
});
test('timestamp helper rejects February 30 rather than rolling into March', () => {
  assert.ok(Number.isNaN(automationReportTimestamp('2026-02-30T10:00:00Z')));
});
test('actual runner transport rejects rolled-over February 30', async () => {
  await assert.rejects(loadJob('2026-02-30T10:00:00Z'), /Historial automático/);
});

const invalidTimestamps: unknown[] = [
  '1', 1, null, undefined, {}, new Date('2024-02-29T10:00:00Z'),
  { toString: () => '2024-02-29T10:00:00Z' },
  '2026-02-28', '2026-02-28T10:00:00', ' 2026-02-28T10:00:00Z', '2026-02-28T10:00:00Z ',
  '2026-02-28T10:00:00Z\n', '2026-2-28T10:00:00Z',
  '2026-02-30T10:00:00Z', '2026-04-31T10:00:00Z', '2026-02-29T10:00:00Z',
  '1900-02-29T10:00:00Z', '2026-00-01T10:00:00Z', '2026-13-01T10:00:00Z',
  '2026-01-00T10:00:00Z', '2026-01-32T10:00:00Z',
  '2026-01-01T24:00:00Z', '2026-01-01T10:60:00Z', '2026-01-01T10:00:60Z',
  '2026-01-01T10:00:00+24:00', '2026-01-01T10:00:00+01:60', '2026-01-01T10:00:00+0100',
  '2026-04-31T00:30:00+01:00',
];
for (const [index, value] of invalidTimestamps.entries()) {
  test(`strict timestamp rejects malformed token ${index}: ${String(value)}`, async () => {
    assert.ok(Number.isNaN(automationReportTimestamp(value)));
    // Cast only to simulate malformed persisted DTOs; never coerce the source token.
    const metrics = importedMetrics(value as string);
    assert.equal(metrics.successByTool[0]?.successRate, null);
    assert.equal(metrics.successByTool[0]?.total, 0);
    await assert.rejects(loadJob(value), /Historial automático/);
  });
}

const validTimestamps = [
  ['2024-02-29T10:00:00Z', '2024-02-29T10:00:00.000Z'],
  ['2000-02-29T10:00:00Z', '2000-02-29T10:00:00.000Z'],
  ['1900-02-28T10:00:00Z', '1900-02-28T10:00:00.000Z'],
  ['2026-03-01T00:30:00+01:00', '2026-02-28T23:30:00.000Z'],
  ['2024-02-29T23:30:00-02:00', '2024-03-01T01:30:00.000Z'],
  ['2026-01-01T00:15:00+05:30', '2025-12-31T18:45:00.000Z'],
  ['2026-01-01T10:00:00.123456Z', '2026-01-01T10:00:00.123Z'],
  ['2026-01-01T10:00:00-00:00', '2026-01-01T10:00:00.000Z'],
];
for (const [value, expected] of validTimestamps) {
  test(`strict timestamp accepts real calendar timestamp ${value}`, async () => {
    assert.equal(new Date(automationReportTimestamp(value)).toISOString(), expected);
    assert.equal(importedMetrics(value).successByTool[0]?.successRate, 100);
    const jobs = await loadJob(value);
    assert.equal(jobs[0].finishedAt, value, 'transport preserves the exact valid token');
    const metrics = reportAutomationPortfolio([functionality], [testCase], { sprint: '7', runs: [run], jobs });
    assert.equal(metrics.successByTool[0]?.successRate, 100);
    assert.equal(metrics.successByTool[0]?.total, 1);
  });
}

test('valid offset timestamps keep chronological import versus runner precedence', async () => {
  const jobs = await loadJob('2026-03-01T00:30:00+01:00');
  const metrics = reportAutomationPortfolio([functionality], [testCase], { sprint: '7', runs: [run], jobs,
    histories: [{ id: 'newer-import', testRunId: run.id, tool: AutomationTool.PLAYWRIGHT,
      importedAt: '2026-02-28T23:45:00Z', matchedCases: [{ testCaseId: testCase.id, testCaseTitle: 'Synthetic login', reference: 'login.spec.ts::login', status: AutomationResultStatus.FAILED }] }],
  });
  assert.equal(metrics.successByTool[0]?.successRate, 0);
  assert.equal(metrics.successByTool[0]?.total, 1);
});
