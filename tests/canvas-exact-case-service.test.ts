import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';

const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch, 'QA_SECURITY_SCRATCH required outside Git');
const dir = mkdtempSync(join(scratch, 'exact-case-'));
const filename = join(dir, 'service.cjs');
writeFileSync(filename, buildSync({ stdin: { contents: `export * from './src/modules/test-cases/services/testCasesService'; export { Http } from './src/config/http'; export { invalidateWorkspaceCache } from './src/modules/workspace/services/workspaceService';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://canvas.invalid' }) } }).outputFiles[0].text);
const service = createRequire(import.meta.url)(filename);
test.after(() => rmSync(dir, { recursive: true, force: true }));
const project = { documentId: 'project-a', key: 'PROJECT-A', organization: { documentId: 'org-a' } };
const parent = { documentId: 'func-b', code: 'SAME', project };
const row = { documentId: 'case-b', title: 'Exact case', project, functionality: parent, testType: 'functional', priority: 'medium' };
function fixture(overrides: Record<string, any> = {}) {
  service.invalidateWorkspaceCache();
  const requests: any[] = [];
  service.Http.defaults.adapter = async (config: any) => {
    const { url, method, params } = config;
    const data = config.data ? JSON.parse(config.data).data : undefined;
    requests.push({ url, method, params, data });
    const reply = (body: unknown) => ({ config, data: body, status: 200, statusText: 'OK', headers: {} });
    if (method !== 'get') return reply({ data: { ...row, ...data } });
    if (url === '/api/me/project-contexts') return reply({ projects: overrides.projects ?? [project] });
    if (url === '/api/functionalities/func-b') return reply({ data: overrides.parent ?? parent });
    if (url === '/api/test-cases/case-b') return reply({ data: overrides.original ?? row });
    if (url === '/api/test-cases') return reply({ data: overrides.listed ?? [row] });
    if (url === '/api/me/workspace') return reply({ projects: overrides.projects ?? [project] });
    // The old business-code resolver picks the wrong same-code sibling.
    if (url === '/api/functionalities') return reply({ data: [{ ...parent, documentId: 'func-a' }, parent] });
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  return requests;
}
const input = { id: 'case-b', documentId: 'case-b', projectId: 'PROJECT-A', functionalityId: 'SAME', title: 'Updated', description: '', preconditions: '', testSteps: '', expectedResult: '', testType: 'Funcional', priority: 'Media' };
test('exact read filters persisted parent documentId, never the shared business code', async () => {
  const requests = fixture();
  const cases = await service.getTestCases('PROJECT-A', 'SAME', 'func-b');
  assert.equal(cases[0].documentId, 'case-b');
  const request = requests.find(r => r.url === '/api/test-cases');
  assert.equal(request.params['filters[functionality][documentId][$eq]'], 'func-b');
  assert.equal(request.params['filters[functionality][code][$eq]'], undefined);
  assert.equal(requests.filter(r => r.method !== 'get').length, 0);
});

test('exact saves bypass code dedupe and retain the persisted same-code sibling', async () => {
  const requests = fixture();
  await service.saveTestCase(input, 'func-b');
  const write = requests.find(r => r.method === 'put');
  assert.equal(write.data.functionality.documentId, 'func-b');
  assert.ok(requests.some(r => r.url === '/api/functionalities/func-b'));
  assert.ok(!requests.some(r => r.url === '/api/functionalities'));
  const original = requests.find(r => r.url === '/api/test-cases/case-b' && r.method === 'get');
  assert.equal(original.params['populate[0]'], 'project');
  assert.equal(original.params['populate[1]'], 'functionality');
});

test('scoped edits reject foreign, missing or sibling persisted relations with zero writes', async () => {
  for (const original of [
    { ...row, project: { documentId: 'foreign', key: 'PROJECT-A' } },
    { ...row, project: undefined },
    { ...row, functionality: { ...parent, documentId: 'func-a' } },
    { ...row, functionality: undefined },
  ]) {
    const requests = fixture({ original });
    await assert.rejects(service.saveTestCase(input, 'func-b'), /scope|pertenece/i);
    assert.equal(requests.filter(r => r.method !== 'get').length, 0);
  }
});
test('scope preflight rejects foreign parent, stale code, unavailable projects and sanitized provenance', async () => {
  for (const overrides of [
    { parent: { ...parent, project: { documentId: 'foreign' } } },
    { parent: { ...parent, project: undefined } },
    { parent: { ...parent, code: 'CHANGED' } },
    { projects: [] }, { projects: [{ ...project, organization: undefined }] },
  ]) {
    const requests = fixture(overrides);
    await assert.rejects(service.saveTestCase(input, 'func-b'), /scope|pertenece|available/i);
    assert.equal(requests.filter(r => r.method !== 'get').length, 0);
  }
});
test('new cases attach the explicit parent and every save refreshes project provenance', async () => {
  const requests = fixture();
  await service.saveTestCase({ ...input, id: 'TC-new', documentId: undefined }, 'func-b');
  await service.saveTestCase(input, 'func-b');
  assert.equal(requests.find(r => r.method === 'post').data.functionality.documentId, 'func-b');
  assert.equal(requests.filter(r => r.url === '/api/me/project-contexts').length, 2);
});

test('exact reads fail closed on a missing project or foreign/sibling response relation', async () => {
  for (const overrides of [
    { projects: [] },
    { listed: [{ ...row, project: { ...project, documentId: 'foreign' } }] },
    { listed: [{ ...row, functionality: { ...parent, documentId: 'func-a' } }] },
    { listed: [{ ...row, functionality: undefined }] },
  ]) {
    const requests = fixture(overrides);
    await assert.rejects(service.getTestCases('PROJECT-A', 'SAME', 'func-b'), /scope|available/i);
    assert.equal(requests.filter(r => r.method !== 'get').length, 0);
  }
});
test('exact reads retain separate case documents and never deduplicate same-code parents', async () => {
  fixture({ listed: [row, { ...row, documentId: 'case-c' }] });
  const cases = await service.getTestCases('PROJECT-A', 'SAME', 'func-b');
  assert.deepEqual(cases.map((item: any) => item.documentId), ['case-b', 'case-c']);
});

test('cached workspace access cannot authorize a scoped save after project access disappears', async () => {
  const projects = [project];
  const requests = fixture({ projects });
  await service.getTestCases('PROJECT-A', 'SAME', 'func-b');
  projects.splice(0);
  await assert.rejects(service.saveTestCase(input, 'func-b'), /available/i);
  assert.equal(requests.filter(r => r.method !== 'get').length, 0);
});
test('manual candidate saves also retain the exact persisted parent without code dedupe', async () => {
  const requests = fixture();
  await service.markManualCasesAsCandidates('PROJECT-A', ['SAME'], ['case-b'], 'func-b');
  const writes = requests.filter(r => r.method !== 'get');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.functionality.documentId, 'func-b');
  assert.equal(writes[0].data.automationStatus, 'candidate');
  assert.ok(!requests.some(r => r.url === '/api/functionalities'));
});
