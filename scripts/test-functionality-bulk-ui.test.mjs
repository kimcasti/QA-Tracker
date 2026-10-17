// Integration test: explicit isolated local services and synthetic credentials only.
// Excluded from the mock-only .test.ts runner; never starts services or reads .env.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

function localOrigin(name) {
  assert.ok(process.env[name], `${name} must explicitly target the isolated manual environment.`);
  const url = new URL(process.env[name]);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), `${name} must be loopback HTTP.`);
  return url.origin;
}
const apiOrigin = localOrigin('QA_MANUAL_API_ORIGIN');
const clientOrigin = localOrigin('QA_MANUAL_CLIENT_ORIGIN');
assert.ok(process.env.QA_MANUAL_TEST_CREDENTIALS_FILE, 'Explicit synthetic credentials file is required.');
assert.ok(process.env.QA_SECURITY_SCRATCH, 'Explicit local output directory is required.');
const credentials = JSON.parse(fs.readFileSync(process.env.QA_MANUAL_TEST_CREDENTIALS_FILE, 'utf8'));
assert.equal(credentials.email, 'owner@qa-tracker.test', 'Only the isolated synthetic owner is allowed.');
const output = fs.mkdtempSync(path.join(process.env.QA_SECURITY_SCRATCH, 'functionality-bulk-'));
let token;
async function api(route, method = 'GET', payload) {
  const response = await fetch(apiOrigin + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  assert.ok(response.ok, `${method} ${route}: ${response.status} ${body.error?.message || ''}`);
  return body;
}
const auth = await api('/api/auth/local', 'POST', { identifier: credentials.email, password: credentials.password });
token = auth.jwt;
assert.ok(token, 'Real API authentication must succeed.');
const workspace = await api('/api/me/workspace');
const membership = workspace.memberships.find(item => item.role?.code === 'owner' && item.organization?.slug === 'pruebas-seguridad-local');
assert.ok(membership, 'The dedicated synthetic organization must be present.');
const organization = membership.organization.documentId;
const projectKey = 'BULK-REGRESSION-' + Date.now();
let project;
let browser;
const rows = [];
try {
  project = (await api('/api/projects', 'POST', { data: { name: 'Prueba aislada edición masiva', key: projectKey, organization, status: 'active' } })).data;
  for (let index = 1; index <= 3; index++) {
    rows.push((await api('/api/functionalities', 'POST', { data: { code: 'BULK-' + index, name: 'Prueba masiva ' + index,
      project: project.documentId, organization, status: 'completed', priority: 'medium', impactLevel: 'medium', probabilityLevel: 'medium' } })).data);
  }
  fs.writeFileSync(path.join(output, 'fixture.json'), JSON.stringify({ project: project.documentId, rows: rows.map(row => row.documentId) }));
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  await context.addInitScript(({ jwt, user }) => {
    sessionStorage.setItem('qa_tracker_api_jwt', jwt);
    sessionStorage.setItem('qa_tracker_auth_user', JSON.stringify(user));
  }, { jwt: token, user: auth.user });
  const page = await context.newPage();
  const writes = [];
  page.on('request', request => { if (request.method() === 'PUT' && request.url().includes('/api/functionalities/')) writes.push(request.url()); });
  await page.goto(clientOrigin + '/projects/' + project.key + '/functionalities', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByText('Prueba masiva 1', { exact: true }).waitFor({ timeout: 30000 });
  for (const index of [1, 2]) await page.getByRole('row').filter({ hasText: 'Prueba masiva ' + index }).getByRole('checkbox').check();
  await page.getByRole('button', { name: /Edición Masiva/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Estado Actual').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: /^Backlog$/ }).click();
  await dialog.getByRole('button', { name: 'Actualizar Todo', exact: true }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const readback = [];
  for (const row of rows) readback.push((await api('/api/functionalities/' + row.documentId)).data);
  const result = { project: projectKey, writes: writes.length, states: readback.map(row => ({ code: row.code, status: row.status })) };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(output, 'result.png'), fullPage: true });
  console.log(JSON.stringify({ ...result, output }));
  assert.equal(writes.length, 2, 'Bulk edit must update both selected rows, not silently resolve an empty selection.');
  assert.deepEqual(readback.map(row => row.status), ['backlog', 'backlog', 'completed']);
} finally {
  if (browser) await browser.close();
  for (const row of rows) await api('/api/functionalities/' + row.documentId, 'DELETE');
  if (project) await api('/api/projects/' + project.documentId, 'DELETE');
  console.log('Removed only the synthetic regression project and its records.');
}
