import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AxiosAdapter } from 'axios';
import { ExecutionStatus, TestType, AutomationTool, type TestRun, type TestCase, type Functionality } from '../src/types';

const guard = mock.method(Socket.prototype, 'connect', () => { throw new Error('REPORT_RUNNER_NETWORK_BLOCKED'); });
assert.ok(process.env.QA_SECURITY_SCRATCH);
const directory = mkdtempSync(join(process.env.QA_SECURITY_SCRATCH, 'report-runner-'));
const filename = join(directory, 'transport.cjs');
const bundle = buildSync({ stdin: { contents: `export { Http } from './src/config/http';
  export { reportAutomationPortfolio } from './src/utils/reportAutomationMetrics';
  export { getReportAutomationJobs } from './src/modules/automation/services/reportAutomationJobs';`,
  resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://report-runner.invalid' }) }, logLevel: 'silent' });
writeFileSync(filename, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(filename);
test.after(() => { guard.mock.restore(); rmSync(directory, { recursive: true, force: true }); });
const run = { id: 'run-seven', sprint: 'Sprint 7', status: ExecutionStatus.FINAL, testType: TestType.REGRESSION, results: [{ id: 'result-seven', testCaseId: 'case-seven' }] } as TestRun;
const job = { id: 17, runId: run.id, state: 'completed', cases: [{ caseId: 'case-seven', resultId: 'result-seven', reference: 'login.spec.ts::login succeeds' }], completedCount: 1, finishedAt: '2026-10-20T10:05:00Z', outcomes: [{ automationReference: 'login.spec.ts::login succeeds', status: 'passed' }] };
let requests: number[];
const pageData = (jobs: unknown[], total = jobs.length, page = 1, pageCount = Math.ceil(total / 100)) => ({ jobs, pagination: { page, pageSize: 100, total, pageCount } });
function transport(pages: unknown[], failPage?: number) {
  requests = [];
  const adapter: AxiosAdapter = async config => {
    assert.equal(config.method, 'get');
    assert.equal(config.url, `/api/test-runs/${run.id}/automation-report-jobs`, 'only tenant READ endpoint; no runner inspection/detail');
    assert.equal(config.params.pageSize, 100);
    const page = config.params.page;
    requests.push(page);
    if (page === failPage) throw new Error('synthetic page read failure');
    return { config, status: 200, statusText: 'OK', headers: {}, data: { data: pages[page - 1] } };
  };
  service.Http.defaults.adapter = adapter;
}

test('read-only paginated transport feeds sprint 7 runner PASSED without import history', async () => {
  transport([pageData([job])]);
  const jobs = await service.getReportAutomationJobs([run]);
  const metrics = service.reportAutomationPortfolio([{ id: 'FUN-7', sprint: '7' } as Functionality], [{ id: 'TC-7', documentId: 'case-seven', functionalityId: 'FUN-7', automationTool: AutomationTool.PLAYWRIGHT } as TestCase], { sprint: '7', runs: [run], histories: [], jobs });
  assert.equal(metrics.successByTool[0].successRate, 100);
  assert.equal(metrics.successByTool[0].total, 1);
  assert.deepEqual(requests, [1], 'outcomes from list require no detail calls');
});
const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...job, id: index + 1 }));
test('all 101 jobs across pages load without 20/100-job truncation or per-job calls', async () => {
  transport([pageData(firstPage, 101, 1), pageData([{ ...job, id: 101 }], 101, 2)]);
  const jobs = await service.getReportAutomationJobs([run]);
  assert.equal(jobs.length, 101);
  assert.equal(new Set(jobs.map((item: any) => item.id)).size, 101);
  assert.deepEqual(requests, [1, 2]);
});
test('a later-page failure propagates instead of returning partial/zero metrics', async () => {
  transport([pageData(firstPage, 101)], 2);
  await assert.rejects(service.getReportAutomationJobs([run]), /synthetic page read failure/);
});
for (const [name, response] of Object.entries({
  wrongPage: pageData([job], 1, 2), truncated: pageData([job], 101), wrongPageCount: pageData([job], 1, 1, 5),
  missingPagination: { jobs: [job] }, duplicates: pageData([job, job]), foreignRun: pageData([{ ...job, runId: 'other-run' }]),
  unpublished: pageData([{ ...job, state: 'running' }]), missingOutcomes: pageData([{ ...job, outcomes: undefined }]),
  invalidTime: pageData([{ ...job, finishedAt: 'invalid' }]), numericDate: pageData([{ ...job, finishedAt: '1' }]), mismatchedCount: pageData([{ ...job, completedCount: 2 }]),
  wrongReference: pageData([{ ...job, outcomes: [{ automationReference: 'other::ref', status: 'passed' }] }]),
})) {
  test(`invalid report response fails visibly: ${name}`, async () => {
    transport([response]);
    await assert.rejects(service.getReportAutomationJobs([run]), /Historial automático/);
  });
}
test('changing totals across pages fails closed', async () => {
  transport([pageData(firstPage, 101), pageData([{ ...job, id: 101 }], 102, 2)]);
  await assert.rejects(service.getReportAutomationJobs([run]), /Historial automático/);
});
test('draft and UAT runs never request report jobs', async () => {
  transport([]);
  assert.deepEqual(await service.getReportAutomationJobs([{ ...run, status: ExecutionStatus.DRAFT }, { ...run, testType: TestType.UAT }]), []);
  assert.equal(requests.length, 0);
});
test('empty complete history returns no jobs', async () => {
  transport([pageData([])]);
  assert.deepEqual(await service.getReportAutomationJobs([run]), []);
});
test('business run id with documentId requests the persisted documentId', async () => {
  transport([pageData([job])]);
  assert.equal((await service.getReportAutomationJobs([{ ...run, id: 'TR-7', documentId: run.id }])).length, 1);
});
test('runner transport socket guard prevents real requests', () => {
  const socket = new Socket();
  try { assert.throws(() => socket.connect(9, '127.0.0.1'), /REPORT_RUNNER_NETWORK_BLOCKED/); }
  finally { socket.destroy(); }
});
