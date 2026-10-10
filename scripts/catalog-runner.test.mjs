import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { upgradeCatalogRunner } from '../../api/scripts/automation-runner/upgrade-catalog-runner.mjs';

test('updated runner uses Playwright list mode and publishes catalog without executing test bodies', { timeout: 60000 }, async () => {
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'qa-catalog-runner-')));
  const scripts = path.join(root, 'scripts'); await fs.mkdir(scripts);
  await fs.symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  const source = upgradeCatalogRunner(await fs.readFile(path.join(project, '../api/scripts/automation-runner/qa-runner-template.mjs'), 'utf8'));
  assert.equal(upgradeCatalogRunner(source), source);
  assert.throws(() => upgradeCatalogRunner('unrecognized'), /no reconocida/);
  await fs.writeFile(path.join(scripts, 'qa-runner.mjs'), source);
  await fs.copyFile(path.join(project, '../scripts/automation-runner/runner-environment.mjs'), path.join(scripts, 'runner-environment.mjs'));
  await fs.writeFile(path.join(scripts, 'runner-selection.mjs'), 'export function assertExactSelection() { throw Error("Execution forbidden"); } export function selectTests() { throw Error("Execution forbidden"); } export function testList() { throw Error("Execution forbidden"); }');
  await fs.writeFile(path.join(scripts, 'playwright-evidence.mjs'), 'export function collectResults() { throw Error("Execution forbidden"); }');
  await fs.writeFile(path.join(scripts, 'runner-reporter.mjs'), `import fs from 'node:fs'; export default class Reporter { onBegin(config, suite) { fs.writeFileSync(process.env.QA_RUNNER_CATALOG, JSON.stringify(suite.allTests().map(test => ({reference:'login.spec.ts::'+test.title})))); } }`);
  await fs.writeFile(path.join(root, 'playwright.e2e.config.ts'), `import { defineConfig } from '@playwright/test'; export default defineConfig({testDir:'.', testMatch:'login.spec.ts', projects:[{name:'chromium'}]});`);
  await fs.writeFile(path.join(root, 'login.spec.ts'), `import { test } from '@playwright/test'; import fs from 'node:fs'; test('Iniciar sesión', () => { fs.writeFileSync('test-body-executed', 'unexpected'); });`);
  let registered; let publication; let delivered = false; let resolveCompletion;
  const done = new Promise(resolve => { resolveCompletion = resolve; });
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw).data; let data = {};
    if (req.url.endsWith('/register')) registered = body;
    else if (req.url.endsWith('/poll') && body.claim && !delivered) { delivered = true; data = { catalogRequest: { id: 99, environment: 'test' }, job: null }; }
    else if (req.url.endsWith('/completeCatalog')) { publication = body; resolveCompletion(); }
    else if (req.url.endsWith('/complete')) assert.fail('No results should be published');
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  await fs.writeFile(path.join(scripts, 'qa-connection.mjs'), `export async function loadConnection(){return ${JSON.stringify({ apiUrl, token: 'test-token', projectKey: 'p', projectName: 'Test' })}} export const safeUrl=value=>value;`);
  const worker = spawn(process.execPath, [path.join(scripts, 'qa-runner.mjs')], { cwd: root, windowsHide: true,
    env: { ...process.env, QA_TRACKER_API_URL: apiUrl, QA_TRACKER_PROJECT_KEY: 'p', PLAYWRIGHT_LOCAL_BASE_URL: 'http://localhost:3000', PLAYWRIGHT_TEST_BASE_URL: 'http://localhost:3001' }, stdio: 'pipe' });
  let output = ''; worker.stdout.on('data', data => { output += data; }); worker.stderr.on('data', data => { output += data; });
  let timer;
  try {
    await Promise.race([done, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Discovery did not publish: ' + output)), 45000); }),
      new Promise((_, reject) => worker.once('exit', code => { if (!publication) reject(new Error('Runner exited ' + code + ': ' + output)); }))]);
    assert.equal(registered.catalogRefreshVersion, 1);
    assert.deepEqual(publication.references, ['login.spec.ts::Iniciar sesión']);
    assert.equal(publication.catalogRequestId, 99);
    await assert.rejects(fs.access(path.join(root, 'test-body-executed')));
  } finally { clearTimeout(timer); worker.kill(); await new Promise(resolve => server.close(resolve)); }
});
