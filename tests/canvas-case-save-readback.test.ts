import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
const scratch = process.env.QA_SECURITY_SCRATCH!;
assert.ok(scratch); mkdirSync(scratch, { recursive: true });
const dir = mkdtempSync(join(scratch, 'case-readback-'));
const file = join(dir, 'service.cjs');
writeFileSync(file, buildSync({ stdin: { contents: `export * from './src/modules/test-cases/services/testCasesService'; export { Http } from './src/config/http';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://canvas.invalid' }) } }).outputFiles[0].text);
const service = createRequire(import.meta.url)(file);
test.after(() => rmSync(dir, { recursive: true, force: true }));
const project = { documentId: 'p', key: 'P', organization: { documentId: 'o' } };
const parent = { documentId: 'b', code: 'SAME', project };
const row = { documentId: 'case', project, functionality: parent, title: 'Persisted', testType: 'functional', priority: 'medium' };
const input = { id: 'TC-new', projectId: 'P', functionalityId: 'SAME', title: 'Draft', testType: 'Funcional', priority: 'Media' };
function fixture(failRead = false) {
  const requests: any[] = [];
  service.Http.defaults.adapter = async (config: any) => {
    requests.push(config);
    const reply = (data: any) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
    if (config.method !== 'get') return reply({ data: { ...row, title: 'ACK' } });
    if (config.url === '/api/me/project-contexts') return reply({ projects: [project] });
    if (config.url === '/api/functionalities/b') return reply({ data: parent });
    if (config.url === '/api/test-cases/case') {
      if (failRead) throw { isAxiosError: true, response: { status: 403 }, message: 'forbidden readback' };
      return reply({ data: row });
    }
    throw new Error('Unexpected ' + config.url);
  };
  return requests;
}
test('exact save returns independent persisted readback, not the write acknowledgement', async () => {
  const requests = fixture(); const saved = await service.saveTestCase(input, 'b');
  assert.equal(saved.title, 'Persisted');
  assert.equal(requests.at(-1).url, '/api/test-cases/case');
});
test('postcommit readback 403 is uncertain, not a known prewrite rejection', async () => {
  fixture(true);
  await assert.rejects(service.saveTestCase(input, 'b'), (error: any) => !error.isAxiosError && /verific|inciert/i.test(error.message));
});
test('disposed scope guard is called after all async preflights and prevents the actual write', async () => {
  const requests = fixture();
  await assert.rejects(service.saveTestCase(input, 'b', () => { throw new Error('disposed'); }), /disposed/);
  assert.equal(requests.filter(r => r.method !== 'get').length, 0);
});
