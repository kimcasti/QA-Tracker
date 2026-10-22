// External-contact recovery regression suite. Runs its own loopback-only Vite server.
// All API responses and writes are synthetic; no database, credentials file or .env is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { classifyBrowserErrors } from './browser-regression-errors.mjs';

assert.ok(process.env.QA_SECURITY_SCRATCH, 'QA_SECURITY_SCRATCH must explicitly select a local output directory.');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = fs.mkdtempSync(path.join(process.env.QA_SECURITY_SCRATCH, 'external-contact-recovery-'));
for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key];
const projectDocumentId = 'localprojectfixture01';
const organizationDocumentId = 'localorganization01';
const rawProject = { documentId: projectDocumentId, key: 'LOCAL-IMPROVEMENTS', name: 'Proyecto de prueba local',
  organization: { documentId: organizationDocumentId, name: 'Organización sintética', plan: 'growth' },
  status: 'active', description: 'Fixture sintético', teamMembers: ['Participante base de prueba'] };
let contactFailure = true;
let projectMismatch = false;
let projectReads = 0;
let contactReads = 0;
let failedReads = 0;
let contacts = [{ documentId: 'localexternalexisting01', name: 'Contacto externo existente', role: 'Cliente UAT',
  email: 'existing@example.test', organization: rawProject.organization,
  sourceProject: { documentId: projectDocumentId, key: rawProject.key, name: rawProject.name } }];
let deleteFailure = false;
let failedDeletes = 0;
let failDeleteReadback = false;
let loseDeleteResponse = false;
const lostDeleteResponseUrls = new Set();
const deleteReadbacks = [];
contacts.push({ documentId: 'localshared01', name: 'Contacto compartido de prueba', organization: rawProject.organization, sourceProject: null });
const cases = [];
const writes = [];
const unexpectedApi = [];
const blockedExternal = [];
const consoleErrors = [];
const pageErrors = [];
const expectedResourceFailures = new Set();
const expectedResourceResponses = [];
let browser;
let page;
const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module">' +
  "import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/support/local-improvements-harness.tsx');" +
  '</script></body></html>';
const server = await createServer({ root, envDir: false, cacheDir: path.join(output, 'vite-cache'),
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/__qa_api'),
    'import.meta.env.VITE_USE_SERVICE_AUTH': JSON.stringify('false') },
  server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false },
  plugins: [{ name: 'qa-isolated-external-contact-recovery', enforce: 'pre',
    configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/__qa_local')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return;
      }
      next();
    });
  } }],
});
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true, downloadsPath: output });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => sessionStorage.setItem('qa_tracker_api_jwt', 'local-synthetic-fixture'));
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) { blockedExternal.push(url.origin); await route.abort(); return; }
    if (!url.pathname.startsWith('/__qa_api/api/')) { await route.continue(); return; }
    const apiPath = url.pathname.slice('/__qa_api'.length);
    const method = request.method();
    const payload = request.postData() ? request.postDataJSON() : undefined;
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method !== 'GET') writes.push({ method, path: apiPath, payload });
    if (apiPath === `/api/projects/${projectDocumentId}` && method === 'GET') {
      const { organization, ...sanitizedProject } = rawProject;
      await reply({ data: sanitizedProject }); return;
    }
    if (apiPath === '/api/participant-directory/members' && method === 'GET') {
      await reply({ data: contacts.map(contact => ({ id: contact.documentId, username: contact.name,
        realName: contact.name, displayName: contact.name, fullName: contact.name,
        email: contact.email, isExternal: true })) }); return;
    }
    if (apiPath === '/api/external-participants') {
      // The real controller returns the full scoped directory without pagination metadata.
      if (method === 'GET') { contactReads++; if (contactFailure) { failedReads++; expectedResourceFailures.add(JSON.stringify([request.url(), 503])); await reply({ error: { status: 503, message: 'Synthetic contact outage' } }, 503); return; } await reply({ data: contacts }); return; }
      if (method === 'POST') {
        const record = { ...payload.data, documentId: `localexternalcreated${contacts.length}`, organization: rawProject.organization,
          sourceProject: { documentId: projectDocumentId, key: rawProject.key, name: rawProject.name } };
        contacts.push(record); await reply({ data: record }, 201); return;
      }
    }
    if (apiPath.startsWith('/api/external-participants/') && method === 'DELETE') {
      const id = apiPath.split('/').at(-1);
      if (deleteFailure) {
        failedDeletes++;
        expectedResourceFailures.add(JSON.stringify([request.url(), 503]));
        await reply({ error: { status: 503, message: 'No pudimos eliminar el contacto externo.' } }, 503); return;
      }
      assert.ok(contacts.some(contact => contact.documentId === id && contact.sourceProject?.documentId === projectDocumentId));
      contacts = contacts.filter(contact => contact.documentId !== id);
      deleteReadbacks.push({ documentId: id, present: contacts.some(contact => contact.documentId === id) });
      if (failDeleteReadback) contactFailure = true;
      if (loseDeleteResponse) {
        failedDeletes++;
        lostDeleteResponseUrls.add(request.url());
        await route.abort('failed'); return;
      }
      await route.fulfill({ status: 204, body: '' }); return;
    }
    if (apiPath === '/api/me/project-contexts') {
      projectReads++;
      await reply({ projects: [projectMismatch ? { ...rawProject, organization: { documentId: 'foreignorganization' } } : rawProject] }); return;
    }
    if (apiPath === '/api/me/workspace') {
      await reply({ user: { id: 1, username: 'persona-sintetica', email: 'owner@example.test' },
        memberships: [{ documentId: 'localmembership01', organization: rawProject.organization, role: { code: 'owner', name: 'Owner' } }],
        projects: [rawProject], projectQuota: { plan: 'growth', effectivePlan: 'growth', reports: { executiveProjectStatus: true } } }); return;
    }
    unexpectedApi.push({ method, path: apiPath });
    await reply({ error: { status: 501, message: `Missing synthetic fixture: ${method} ${apiPath}` } }, 501);
  });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url || '' }); });
  page.on('response', response => {
    if (expectedResourceFailures.has(JSON.stringify([response.url(), response.status()]))) {
      expectedResourceResponses.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto(origin + '/__qa_local?view=about', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('Acceso al proyecto', { exact: true }).waitFor({ timeout: 45000 });

  const warning = page.getByText('No pudimos verificar los contactos externos de este proyecto.', { exact: true });
  await warning.waitFor();
  const section = page.getByRole('region', { name: 'Participantes externos (sin cuenta)' });
  const memberToggle = page.getByRole('button', { name: /^Miembros con cuenta \(/ });
  assert.equal(await memberToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.getByText('Miembro con cuenta de prueba', { exact: true }).isVisible(), false);
  await memberToggle.click();
  await page.getByText('Miembro con cuenta de prueba', { exact: true }).waitFor();
  assert.equal(await memberToggle.getAttribute('aria-expanded'), 'true');
  await memberToggle.click();
  const externalToggle = section.getByRole('button', { name: /^Participantes externos \(sin cuenta\) \(/ });
  assert.equal(await externalToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await section.getByText('Contacto externo existente', { exact: true }).isVisible(), false);
  cases.push('Both participant lists default collapsed with accessible count toggles; add and errors stay visible');
  const add = section.getByRole('button', { name: 'Agregar externo', exact: true });
  assert.equal(await add.count(), 1, 'Load failure must retain a discoverable add action inside the access card');
  assert.equal(await section.getByText('No hay contactos externos para este proyecto.', { exact: true }).count(), 0,
    'Unverified contacts must not be presented as an empty directory');
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'error-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.waitForFunction(() => !document.querySelector('.ant-btn-loading'));
  const readsBefore = projectReads;
  await add.click();
  await warning.waitFor();
  await page.waitForFunction(() => !document.querySelector('.ant-btn-loading'));
  assert.ok(projectReads > readsBefore, 'Add retries project verification');
  assert.equal(await page.getByRole('dialog').count(), 0, 'Continued failure must not open the form');
  assert.equal(writes.length, 0);
  cases.push('Error retains add action; failed verification blocks modal and writes');
  contactFailure = false;
  await add.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.equal(await warning.count(), 0);
  assert.ok(projectReads >= 3 && contactReads >= 3);
  await dialog.getByRole('button', { name: 'Guardar contacto externo', exact: true }).click();
  await dialog.getByText('Ingresa el nombre del contacto.', { exact: true }).waitFor();
  assert.equal(writes.length, 0);
  await dialog.getByLabel('Nombre del contacto', { exact: true }).fill('Contacto sintético nuevo');
  await dialog.getByLabel('Correo de contacto (opcional)', { exact: true }).fill('not-an-email');
  await dialog.getByRole('button', { name: 'Guardar contacto externo', exact: true }).click();
  await dialog.getByText('Ingresa un correo válido.', { exact: true }).waitFor();
  assert.equal(writes.length, 0);
  await dialog.getByLabel('Correo de contacto (opcional)', { exact: true }).fill('new@example.test');
  const beforeSave = { projectReads, contactReads };
  await dialog.getByRole('button', { name: 'Guardar contacto externo', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await externalToggle.getAttribute('aria-expanded'), 'false');
  await page.getByText('Acceso al proyecto', { exact: true }).locator('xpath=ancestor::div[contains(@class,"qa-surface-card")][1]')
    .screenshot({ path: path.join(output, 'collapsed-desktop.png'), animations: 'disabled' });
  await externalToggle.focus();
  await page.keyboard.press('Enter');
  await section.getByText('Contacto sintético nuevo', { exact: true }).waitFor();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, 'POST');
  assert.equal(writes[0].path, '/api/external-participants');
  assert.ok(JSON.stringify(writes[0].payload.data.organization).includes(organizationDocumentId));
  assert.ok(JSON.stringify(writes[0].payload.data.sourceProject).includes(projectDocumentId));
  assert.ok(projectReads > beforeSave.projectReads && contactReads > beforeSave.contactReads,
    'Save must reread verified project/directory rather than trusting recovery cache');
  cases.push('Recovered add opens real modal, validates fields, rereads scope and persists scoped contact');
  await add.click();
  await dialog.getByLabel('Nombre del contacto', { exact: true }).fill('Duplicado');
  await dialog.getByLabel('Correo de contacto (opcional)', { exact: true }).fill('new@example.test');
  await dialog.getByRole('button', { name: 'Guardar contacto externo', exact: true }).click();
  await page.getByText('Este contacto ya existe en el proyecto o directorio de la organización.', { exact: true }).waitFor();
  assert.equal(writes.length, 1);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  cases.push('Duplicate and cancel cause no write');
  // Recheck authorization even after the form was opened successfully.
  await add.click();
  await dialog.getByLabel('Nombre del contacto', { exact: true }).fill('No guardar fuera del tenant');
  projectMismatch = true;
  const beforeMismatch = contactReads;
  await dialog.getByRole('button', { name: 'Guardar contacto externo', exact: true }).click();
  await page.getByText('La organización del proyecto no coincide con el espacio activo.', { exact: true }).waitFor();
  assert.equal(contactReads, beforeMismatch, 'Foreign project blocks directory request');
  assert.equal(writes.length, 1);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  cases.push('Pre-save tenant mismatch blocks all additional writes');
  await page.reload({ waitUntil: 'networkidle' });
  await warning.waitFor();
  const beforeForeignRetry = contactReads;
  await add.click();
  await page.waitForFunction(() => !document.querySelector('.ant-btn-loading'));
  assert.equal(await dialog.count(), 0);
  assert.equal(contactReads, beforeForeignRetry);
  cases.push('Recovery never bypasses project-organization verification');
  projectMismatch = false;
  contactFailure = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await warning.waitFor();
  await add.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const bounds = await add.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await section.screenshot({ path: path.join(output, 'error-mobile.png'), animations: 'disabled' });
  contactFailure = false;
  await add.click();
  await dialog.waitFor();
  await page.waitForTimeout(300);
  const modal = await dialog.boundingBox();
  assert.ok(modal.x >= 0 && modal.x + modal.width <= 390);
  assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
  await dialog.screenshot({ path: path.join(output, 'add-mobile.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  cases.push('Mobile error action and recovered dialog fit 390px viewport');
  contactFailure = true;
  await page.goto(origin + '/__qa_local?view=about&role=viewer', { waitUntil: 'networkidle' });
  await warning.waitFor();
  assert.equal(await page.getByRole('button', { name: 'Agregar externo', exact: true }).count(), 0);
  contactFailure = false;
  await page.getByRole('button', { name: 'Reintentar verificación', exact: true }).click();
  await warning.waitFor({ state: 'hidden' });
  await externalToggle.click();
  await page.getByText('Contacto sintético nuevo', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Agregar externo', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /^Editar contacto/ }).count(), 0);
  assert.equal(writes.length, 1);
  cases.push('Viewer can retry read but cannot add or edit before or after recovery');
  assert.equal(await page.getByRole('button', { name: /^Eliminar contacto/ }).count(), 0);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(origin + '/__qa_local?view=about', { waitUntil: 'networkidle' });
  await externalToggle.click();
  const existingDelete = section.getByRole('button', { name: 'Eliminar contacto Contacto externo existente', exact: true });
  await existingDelete.click();
  const confirmation = page.getByRole('dialog', { name: 'Eliminar participante externo' });
  await confirmation.waitFor();
  await confirmation.getByText('Contacto externo existente', { exact: true }).waitFor();
  assert.match(await confirmation.innerText(), /directorio.*no se puede deshacer/is);
  await page.waitForTimeout(300);
  await confirmation.screenshot({ path: path.join(output, 'delete-desktop.png'), animations: 'disabled' });
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await confirmation.waitFor({ state: 'hidden' });
  assert.equal(writes.length, 1, 'Cancel cannot issue a DELETE');
  assert.equal(await section.getByRole('button', { name: 'Eliminar contacto Contacto compartido de prueba', exact: true }).count(), 0);
  await existingDelete.click();
  const beforeDelete = { projectReads, contactReads };
  await confirmation.getByRole('button', { name: 'Eliminar contacto externo', exact: true }).click();
  await confirmation.waitFor({ state: 'hidden' });
  await page.getByText('Contacto externo eliminado del directorio.', { exact: true }).waitFor();
  assert.equal(await section.getByText('Contacto externo existente', { exact: true }).count(), 0);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].method, 'DELETE');
  assert.equal(writes[1].path, '/api/external-participants/localexternalexisting01');
  assert.deepEqual(deleteReadbacks, [{ documentId: 'localexternalexisting01', present: false }]);
  assert.ok(projectReads >= beforeDelete.projectReads + 2 && contactReads >= beforeDelete.contactReads + 2);
  assert.match(await externalToggle.innerText(), /\(2\)/);
  cases.push('Named confirmation cancel writes nothing; confirmed DELETE 204 rereads scope and exact absence, updates count; shared contacts protected');
  await page.waitForFunction(() => !document.querySelector('.ant-message-notice'));
  const newDelete = section.getByRole('button', { name: 'Eliminar contacto Contacto sintético nuevo', exact: true });
  await newDelete.click();
  deleteFailure = true;
  await confirmation.getByRole('button', { name: 'Eliminar contacto externo', exact: true }).click();
  await confirmation.getByText('No pudimos eliminar el contacto externo.', { exact: true }).waitFor();
  assert.ok(contacts.some(contact => contact.name === 'Contacto sintético nuevo'));
  assert.equal(await page.getByText('Contacto externo eliminado del directorio.', { exact: true }).count(), 0);
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await confirmation.waitFor({ state: 'hidden' });
  cases.push('Failed DELETE retains contact, shows error, no false success');
  deleteFailure = false;
  await newDelete.click();
  projectMismatch = true;
  const writesBeforeForeignDelete = writes.length;
  await confirmation.getByRole('button', { name: 'Eliminar contacto externo', exact: true }).click();
  await confirmation.getByText('La organización del proyecto no coincide con el espacio activo.', { exact: true }).waitFor();
  assert.equal(writes.length, writesBeforeForeignDelete);
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await confirmation.waitFor({ state: 'hidden' });
  projectMismatch = false;
  cases.push('Pre-delete fresh project-context mismatch blocks DELETE');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(await section.evaluate(el => el.scrollWidth <= el.clientWidth), 'Expanded participant list must not overflow on mobile');
  await section.screenshot({ path: path.join(output, 'expanded-mobile.png'), animations: 'disabled' });
  await newDelete.click();
  await page.waitForTimeout(300);
  const deleteBounds = await confirmation.boundingBox();
  assert.ok(deleteBounds.x >= 0 && deleteBounds.x + deleteBounds.width <= 390);
  assert.ok(await confirmation.evaluate(el => el.scrollWidth <= el.clientWidth));
  await confirmation.screenshot({ path: path.join(output, 'delete-mobile.png'), animations: 'disabled' });
  failDeleteReadback = true;
  loseDeleteResponse = true;
  const beforeUnknownDelete = { contactReads, writes: writes.length };
  await confirmation.getByRole('button', { name: 'Eliminar contacto externo', exact: true }).click();
  await confirmation.waitFor({ state: 'hidden' });
  const unverified = page.getByText('No pudimos verificar el resultado de la eliminación. Actualiza la lista antes de reintentar.', { exact: true });
  await unverified.waitFor();
  assert.ok(contactReads >= beforeUnknownDelete.contactReads + 2, 'Lost DELETE response must attempt fresh reconciliation');
  assert.equal(writes.length, beforeUnknownDelete.writes + 1, 'Unknown outcome must issue exactly one DELETE');
  assert.equal(await section.getByRole('button', { name: /^Editar contacto/ }).count(), 0, 'Unknown outcome must also lock editing');
  assert.equal(await add.count(), 1, 'Unverified deletion keeps the add action discoverable');
  assert.equal(await add.isDisabled(), true, 'Refresh the uncertain directory before allowing a new write');
  assert.equal(await page.getByText('Contacto externo eliminado del directorio.', { exact: true }).count(), 0);
  assert.equal(await newDelete.count(), 0, 'Do not retry DELETE while the outcome is unknown');
  contactFailure = false;
  await page.getByRole('button', { name: 'Actualizar lista de contactos', exact: true }).click();
  await unverified.waitFor({ state: 'hidden' });
  assert.equal(await section.getByText('Contacto sintético nuevo', { exact: true }).count(), 0);
  assert.match(await externalToggle.innerText(), /\(1\)/);
  await externalToggle.click();
  await page.getByText('Acceso al proyecto', { exact: true }).locator('xpath=ancestor::div[contains(@class,"qa-surface-card")][1]')
    .screenshot({ path: path.join(output, 'collapsed-mobile.png'), animations: 'disabled' });
  cases.push('Mobile confirmation fits; committed DELETE with lost response and failed reconciliation locks add/edit/delete without false success, then refresh recovers');
  assert.deepEqual(unexpectedApi, []);
  assert.deepEqual(blockedExternal, []);
  assert.deepEqual(pageErrors, []);
  // Explicit synthetic HTTP503 responses produce Chromium diagnostics plus one existing transport log each.
  const telemetry = consoleErrors.filter(entry => entry.url === origin + '/src/utils/errorMonitoring.ts' &&
    /^\[qa-tracker\] \{area: http\.private, contextMessage: API request failed for \/api\/external-participants(?:\/localexternalcreated\d+)?\., details: Object, error: Object\}$/.test(entry.text));
  assert.equal(telemetry.length, failedReads + failedDeletes);
  const lostResponseDiagnostics = consoleErrors.filter(entry => lostDeleteResponseUrls.has(entry.url) &&
    entry.text === 'Failed to load resource: net::ERR_FAILED');
  assert.equal(lostResponseDiagnostics.length, lostDeleteResponseUrls.size);
  const diagnostics = classifyBrowserErrors({ pageErrors, consoleErrors: consoleErrors.filter(entry => !telemetry.includes(entry) && !lostResponseDiagnostics.includes(entry)),
    baselineWarnings: [
      'Warning: [antd: Tag] `bordered={false}` is deprecated. Please use `variant="filled"` instead.',
      'Warning: [antd: Tooltip] `overlayClassName` is deprecated. Please use `classNames.root` instead.',
      'Warning: [antd: Progress] `trailColor` is deprecated. Please use `railColor` instead.',
      'Warning: Instance created by `useForm` is not connected to any Form element. Forget to pass `form` prop?',
    ], expectedResourceResponses });
  assert.deepEqual(diagnostics.unexpectedConsole, []);
  const result = { passed: true, cases, count: cases.length, writes, deleteReadbacks, projectReads, contactReads, failedReads, failedDeletes,
    unexpectedApi, blockedExternal, pageErrors, output, scope: 'Real AboutView, synthetic in-memory HTTP only; no database/auth/invitations' };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true, animations: 'disabled' }).catch(() => {});
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), cases, unexpectedApi, blockedExternal, consoleErrors, pageErrors }, null, 2));
  console.error(JSON.stringify({ output, error: String(error), consoleErrors }));
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
