// Component/browser regression suite. Runs its own loopback-only Vite server.
// All API responses and writes are synthetic; no database, credentials file or .env is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { classifyBrowserErrors } from './browser-regression-errors.mjs';

assert.ok(process.env.QA_SECURITY_SCRATCH, 'QA_SECURITY_SCRATCH must explicitly select a local output directory.');
const root = fileURLToPath(new URL('../', import.meta.url));
const baselineOnly = process.env.QA_IMPROVEMENTS_BASELINE_ONLY === '1';
const baselineAbout = baselineOnly ? execFileSync('git', ['show', 'main:src/components/AboutView.tsx'], { cwd: root, encoding: 'utf8' }) : null;
const output = fs.mkdtempSync(path.join(process.env.QA_SECURITY_SCRATCH, 'local-improvements-ui-'));
for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key];
const projectDocumentId = 'localprojectfixture01';
const organizationDocumentId = 'localorganization01';
const rawProject = { documentId: projectDocumentId, key: 'LOCAL-IMPROVEMENTS', name: 'Proyecto de prueba local',
  organization: { documentId: organizationDocumentId, name: 'Organización sintética', plan: 'growth' },
  status: 'active', description: 'Fixture sintético', teamMembers: ['Participante base de prueba'] };
let contacts = [{ documentId: 'localexternalexisting01', name: 'Contacto externo existente', role: 'Cliente UAT',
  email: 'existing@example.test', organization: rawProject.organization,
  sourceProject: { documentId: projectDocumentId, key: rawProject.key, name: rawProject.name } }];
const cases = [];
const writes = [];
const unexpectedApi = [];
const blockedExternal = [];
const consoleErrors = [];
const pageErrors = [];
const expectedResourceFailures = new Set();
const expectedResourceResponses = [];
let allowBrokenImage = false;
let automationSource = 'imports';
let localImage;
let browser;
let page;
const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module">' +
  "import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/support/local-improvements-harness.tsx');" +
  '</script></body></html>';
const server = await createServer({ root, envDir: false, cacheDir: path.join(output, 'vite-cache'),
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/__qa_api'),
    'import.meta.env.VITE_USE_SERVICE_AUTH': JSON.stringify('false') },
  server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false },
  plugins: [{ name: 'qa-isolated-improvements-page', enforce: 'pre',
    load(id) { if (baselineOnly && id.replaceAll('\\', '/').endsWith('/src/components/AboutView.tsx')) return baselineAbout; },
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
    if (url.pathname === '/__qa_fixture_image.png') {
      assert.ok(localImage, 'The local image fixture must be generated before PDF export.');
      await route.fulfill({ contentType: 'image/png', body: localImage }); return;
    }
    if (url.pathname === '/__qa_missing_image.png') {
      assert.ok(allowBrokenImage, 'Only the broken-image scenario may request this fixture.');
      expectedResourceFailures.add(JSON.stringify([request.url(), 404]));
      await route.fulfill({ status: 404, body: 'Synthetic missing image' }); return;
    }
    if (!url.pathname.startsWith('/__qa_api/api/')) { await route.continue(); return; }
    const apiPath = url.pathname.slice('/__qa_api'.length);
    const method = request.method();
    const payload = request.postData() ? request.postDataJSON() : undefined;
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (method !== 'GET') writes.push({ method, path: apiPath, payload });
    if (apiPath === '/api/test-runs/localtestrunfixture01/automation-report-jobs' && method === 'GET') {
      assert.equal(url.searchParams.get('page'), '1');
      assert.equal(url.searchParams.get('pageSize'), '100');
      if (automationSource === 'read-error') {
        expectedResourceFailures.add(JSON.stringify([request.url(), 500]));
        await reply({ error: { status: 500, message: 'Synthetic jobs read failure' } }, 500); return;
      }
      const jobs = automationSource === 'imports' ? [] : [{
        id: 1, runId: 'localtestrunfixture01', state: 'completed', finishedAt: '2026-10-20T13:00:00Z', completedCount: 2,
        cases: [0, 1].map(index => ({ caseId: `localcasefixture${index}0`, resultId: `RUN-RESULT-${index}`, reference: `local-test-${index}` })),
        outcomes: [0, 1].map(index => ({ automationReference: `local-test-${index}`,
          status: automationSource === 'runner-newer' || index === 0 ? 'passed' : 'failed' })),
      }];
      await reply({ data: { jobs, pagination: { page: 1, pageSize: 100, total: jobs.length, pageCount: jobs.length ? 1 : 0 } } }); return;
    }
    if (apiPath === `/api/projects/${projectDocumentId}` && method === 'GET') { await reply({ data: rawProject }); return; }
    if (apiPath.startsWith('/api/external-participants/') && method === 'PUT') {
      const documentId = apiPath.split('/').at(-1);
      const index = contacts.findIndex(contact => contact.documentId === documentId);
      assert.ok(index >= 0, 'Only fixture-owned contacts may be edited.');
      assert.ok(!Object.hasOwn(payload.data, 'organization') && !Object.hasOwn(payload.data, 'sourceProject'));
      contacts[index] = { ...contacts[index], ...payload.data };
      await reply({ data: contacts[index] }); return;
    }
    if (apiPath === '/api/participant-directory/members' && method === 'GET') {
      await reply({ data: contacts.map(contact => ({ id: contact.documentId, username: contact.name,
        realName: contact.name, displayName: contact.name, fullName: contact.name,
        email: contact.email, isExternal: true })) }); return;
    }
    if (apiPath === '/api/external-participants') {
      // The real controller returns the full scoped directory without pagination metadata.
      if (method === 'GET') { await reply({ data: contacts }); return; }
      if (method === 'POST') {
        const record = { ...payload.data, documentId: `localexternalcreated${contacts.length}`, organization: rawProject.organization,
          sourceProject: { documentId: projectDocumentId, key: rawProject.key, name: rawProject.name } };
        contacts.push(record); await reply({ data: record }, 201); return;
      }
    }
    if (apiPath === '/api/me/project-contexts') { await reply({ projects: [rawProject] }); return; }
    if (apiPath === '/api/me/workspace') {
      await reply({ user: { id: 1, username: 'persona-sintetica', email: 'owner@example.test' },
        memberships: [{ documentId: 'localmembership01', organization: rawProject.organization, role: { code: 'owner', name: 'Owner' } }],
        projects: [rawProject], projectQuota: { plan: 'growth', effectivePlan: 'growth', reports: { executiveProjectStatus: true } } }); return;
    }
    if (apiPath === '/api/plan-access/report' && method === 'POST') {
      assert.deepEqual(payload, { data: { projectId: projectDocumentId, report: 'executiveProjectStatus' } });
      await reply({ data: { allowed: true, plan: 'growth', report: 'executiveProjectStatus' } }); return;
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
  if (baselineOnly) {
    await page.waitForTimeout(500);
    assert.deepEqual(pageErrors, [], 'Baseline must not contain uncaught exceptions.');
    assert.ok(consoleErrors.every(entry => entry.text.startsWith('Warning:')), 'Baseline must not absorb runtime errors.');
    const baseline = { source: 'git show main:src/components/AboutView.tsx; no checkout or worktree edits',
      warnings: [...new Set(consoleErrors.map(entry => entry.text))], unexpectedApi, blockedExternal, output };
    fs.writeFileSync(path.join(process.env.QA_SECURITY_SCRATCH, 'browser-baseline-warnings.json'), JSON.stringify(baseline, null, 2));
    console.log(JSON.stringify(baseline));
  } else {
  await page.getByRole('button', { name: /^Miembros con cuenta \(/ }).click();
  await page.getByRole('button', { name: /^Participantes externos \(sin cuenta\) \(/ }).click();
  await page.getByText('Miembro con cuenta de prueba', { exact: true }).waitFor();
  await page.getByText('Contacto externo existente', { exact: true }).waitFor({ timeout: 15000 });
  const addExternal = page.getByRole('button', { name: /(?:Agregar|Añadir|Nuevo|Nueva).*extern/i });
  assert.equal(await addExternal.count(), 1, 'An editor must have one external-participant action.');
  await addExternal.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel(/^Nombre(?: completo| del contacto)?$/i).fill('Cliente UAT de prueba');
  const email = dialog.getByLabel(/correo|email/i);
  if (await email.count()) await email.fill('uat-client@example.test');
  const role = dialog.getByLabel(/rol|funci[oó]n|cargo|Descripci[oó]n del contacto/i);
  if (await role.count()) await role.fill('Cliente UAT');
  await dialog.getByRole('button', { name: /Guardar|Agregar participante|Crear participante|Agregar externo/i }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  await page.getByText('Cliente UAT de prueba', { exact: true }).first().waitFor({ timeout: 15000 });
  const participantWrites = writes.filter(item => item.path === '/api/external-participants');
  assert.equal(participantWrites.length, 1);
  assert.equal(participantWrites[0].payload.data.name, 'Cliente UAT de prueba');
  assert.equal(participantWrites[0].payload.data.role, 'Cliente UAT');
  assert.ok(JSON.stringify(participantWrites[0].payload.data.sourceProject).includes(projectDocumentId));
  assert.ok(JSON.stringify(participantWrites[0].payload.data.organization).includes(organizationDocumentId));
  assert.equal(writes.filter(item => /invitations|\/auth|\/users|\/members/.test(item.path)).length, 0,
    'Adding a contact must not create an account, invite a member or grant authenticated permissions.');
  cases.push('Editor creates project-scoped external contact without account/invitation');
  await addExternal.click();
  await dialog.getByLabel(/^Nombre(?: completo| del contacto)?$/i).fill('Cliente UAT de prueba');
  await dialog.getByLabel(/correo|email/i).fill('uat-client@example.test');
  await dialog.getByRole('button', { name: /Guardar contacto externo/i }).click();
  await page.getByText(/Este contacto ya existe en el proyecto/i).waitFor();
  assert.equal(writes.filter(item => item.path === '/api/external-participants').length, 1);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  cases.push('Duplicate external contact is rejected without another POST');
  await page.getByRole('button', { name: 'Editar contacto Cliente UAT de prueba', exact: true }).click();
  await dialog.getByLabel(/^Nombre(?: completo| del contacto)?$/i).fill('Cliente UAT actualizado');
  await dialog.getByRole('button', { name: /Guardar contacto externo/i }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('Cliente UAT actualizado', { exact: true }).waitFor();
  assert.equal(writes.filter(item => item.method === 'PUT' && item.path.startsWith('/api/external-participants/')).length, 1);
  cases.push('Editor updates only contact fields without changing provenance or organization');
  const beforeCancel = writes.length;
  await addExternal.click();
  await dialog.getByLabel(/^Nombre(?: completo| del contacto)?$/i).fill('No debe guardarse');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(writes.length, beforeCancel);
  cases.push('Canceling an external contact produces no write');
  await page.waitForFunction(() => !document.querySelector('.ant-message-notice'), null, { timeout: 10000 });
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const label = page.getByText(/^Participantes$/i).first();
    await label.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const geometry = await label.evaluate(element => {
      let card = element.parentElement;
      while (card?.parentElement && parseFloat(getComputedStyle(card).borderRadius) < 6) card = card.parentElement;
      const cardBounds = card.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(element);
      const textRects = Array.from(range.getClientRects()).map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
      return { textRects, card: { left: cardBounds.left, right: cardBounds.right, top: cardBounds.top, bottom: cardBounds.bottom } };
    });
    assert.ok(geometry.textRects.length > 0);
    assert.equal(new Set(geometry.textRects.map(rect => Math.round(rect.top))).size, 1,
      `PARTICIPANTES must remain a whole readable word at ${width}px: ${JSON.stringify(geometry)}`);
    for (const rect of geometry.textRects) {
      assert.ok(rect.left >= geometry.card.left - 1 && rect.right <= geometry.card.right + 1,
        `PARTICIPANTES must fit the metric card at ${width}px: ${JSON.stringify(geometry)}`);
      assert.ok(rect.top >= geometry.card.top - 1 && rect.bottom <= geometry.card.bottom + 1);
    }
    await page.screenshot({ path: path.join(output, `about-${width}.png`), fullPage: true, animations: 'disabled' });
    cases.push(`Meeting participant label stays whole and fits its card at ${width}px`);
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(origin + '/__qa_local?view=about&role=viewer', { waitUntil: 'networkidle' });
  await page.getByText('Acceso al proyecto', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /(?:Agregar|Añadir|Nuevo|Nueva).*extern/i }).count(), 0);
  cases.push('Viewer cannot add an external participant');

  await page.goto(origin + '/__qa_local?view=reports', { waitUntil: 'networkidle' });
  await page.getByText('Estado del Proyecto', { exact: true }).first().click();
  await page.getByRole('combobox').first().click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: /^6$/ }).click();
  await page.getByRole('button', { name: /Generar Reporte/i }).click();
  const metricsTitle = page.getByText(/M[eé]tricas de automatizaci[oó]n/i).first();
  await metricsTitle.waitFor({ timeout: 30000 });
  const metrics = metricsTitle.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-card ")][1]');
  await metrics.getByText('50%', { exact: true }).last().waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando resultados automáticos'));
  const metricsText = await metrics.innerText();
  assert.ok((metricsText.match(/50%/g) || []).length >= 5,
    `Two module, two functionality and one tool metrics must show 50%: ${metricsText}`);
  assert.match(metricsText, /Playwright/);
  assert.doesNotMatch(metricsText, /Sin resultados autom[aá]ticos/);
  await metrics.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'automation-metrics.png'), fullPage: true, animations: 'disabled' });
  await metrics.screenshot({ path: path.join(output, 'automation-card.png'), animations: 'disabled' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(output, 'estado-proyecto-sprint-6.pdf'), format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  cases.push('Project status report shows 50% automation coverage/tool rate for sprint 6');
  const images = await page.evaluate(() => window.__qaLocalImprovements.images());
  localImage = Buffer.from(images.png.split(',')[1], 'base64');
  for (const [includeBroken, filename] of [[false, 'casos-con-imagenes.pdf'], [true, 'casos-con-imagen-fallida.pdf']]) {
    allowBrokenImage = includeBroken;
    const dataUrl = await page.evaluate(broken => window.__qaLocalImprovements.generatePdf(broken), includeBroken);
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    assert.ok(buffer.subarray(0, 5).equals(Buffer.from('%PDF-')));
    fs.writeFileSync(path.join(output, filename), buffer);
    cases.push(`Real PDF generated: ${filename}`);
  }
  // Regression executions can test functionality delivered in an earlier sprint.
  await page.goto(origin + '/__qa_local?view=reports', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const { query, project } = window.__qaLocalImprovements;
    const functions = query.getQueryData(['functionalities', project.id]);
    const originalCases = query.getQueryData(['test-cases', project.id, 'all']);
    const originalRun = query.getQueryData(['test-runs', project.id])[0];
    const originalImport = query.getQueryData(['automation-import-history', project.id])[0];
    const earlierFunction = functions[0].id;
    const updatedFunctions = functions.map((item, index) => ({ ...item, sprint: index === 0 ? '2' : '6' }));
    const updatedCases = originalCases.map(item => {
      const automated = item.functionalityId === earlierFunction;
      return { ...item, isAutomated: automated,
        automationStatus: automated ? originalCases[0].automationStatus : originalCases[1].automationStatus,
        automationTool: automated ? originalCases[0].automationTool : undefined, lastAutomationStatus: undefined };
    });
    const earlierCases = updatedCases.filter(item => item.functionalityId === earlierFunction);
    const updatedRun = { ...originalRun, results: earlierCases.map((item, index) => ({
      id: `CROSS-RESULT-${index}`, functionalityId: item.functionalityId, testCaseId: item.id,
      result: originalRun.results[0].result })), totalResults: earlierCases.length };
    query.setQueryData(['functionalities', project.id], updatedFunctions);
    query.setQueryData(['test-cases', project.id, 'all'], updatedCases);
    query.setQueryData(['test-runs', project.id], [updatedRun]);
    query.setQueryData(['test-runs', 'summary', project.id], [updatedRun]);
    query.setQueryData(['automation-import-history', project.id], [{ ...originalImport,
      matchedCount: earlierCases.length, matchedCases: earlierCases.map((item, index) => ({
        testCaseId: item.id, testCaseTitle: item.title, reference: `cross-${index}`,
        status: originalImport.matchedCases[0].status })) }]);
  });
  await page.getByText('Estado del Proyecto', { exact: true }).first().click();
  await page.getByRole('combobox').first().click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: /^6$/ }).click();
  await page.getByRole('button', { name: /Generar Reporte/i }).click();
  const crossTitle = page.getByText(/M[eé]tricas de automatizaci[oó]n/i).first();
  await crossTitle.waitFor();
  const crossCard = crossTitle.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-card ")][1]');
  await crossCard.getByText('100%', { exact: true }).waitFor();
  assert.match(await crossCard.getByTestId('automation-module-coverage').innerText(), /0%/);
  assert.match(await crossCard.getByText('Casos automatizados por funcionalidad', { exact: true }).locator('xpath=ancestor::div[1]').innerText(), /0%\s*\(0\/2\)/);
  assert.match(await crossCard.innerText(), /Playwright\s+100%/);
  assert.doesNotMatch(await crossCard.innerText(), /Sin resultados automáticos/);
  await crossCard.screenshot({ path: path.join(output, 'automation-cross-delivery-sprint.png'), animations: 'disabled' });
  cases.push('Sprint 6 execution includes earlier-delivery imports while current-delivery coverage stays zero');

  for (const source of ['runner-only', 'runner-newer', 'read-error']) {
    automationSource = source;
    await page.goto(origin + '/__qa_local?view=reports&source=' + source, { waitUntil: 'networkidle' });
    await page.getByText('Estado del Proyecto', { exact: true }).first().click();
    await page.getByRole('combobox').first().click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({ hasText: /^6$/ }).click();
    await page.getByRole('button', { name: /Generar Reporte/i }).click();
    const title = page.getByText(/M[eé]tricas de automatizaci[oó]n/i).first();
    await title.waitFor();
    const card = title.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-card ")][1]');
    if (source === 'read-error') {
      await card.getByText(/No se pudieron cargar los resultados automáticos/).waitFor();
      assert.equal(await card.getByText('0%', { exact: true }).count(), 0);
      cases.push('Runner job read failure is visible instead of fabricated zero percent');
    } else {
      await card.getByText(source === 'runner-newer' ? '100%' : '50%', { exact: true }).last().waitFor();
      await page.waitForFunction(() => !document.body.innerText.includes('Cargando resultados automáticos'));
      const text = await card.innerText();
      assert.match(text, source === 'runner-newer' ? /Playwright\s+100%/ : /Playwright\s+50%/);
      cases.push(source === 'runner-newer' ? 'Newer runner publication overrides older failed import' : 'Runner outcomes appear without import history');
    }
    await card.screenshot({ path: path.join(output, `automation-${source}.png`), animations: 'disabled' });
  }
  assert.deepEqual(unexpectedApi, [], 'The test must explicitly fixture every API request.');
  assert.deepEqual(blockedExternal, [], 'Components must not attempt external traffic in this synthetic suite.');
  const baselineFile = path.join(process.env.QA_SECURITY_SCRATCH, 'browser-baseline-warnings.json');
  assert.ok(fs.existsSync(baselineFile), 'First run QA_IMPROVEMENTS_BASELINE_ONLY=1 to record existing main warnings without a checkout.');
  const baselineWarnings = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).warnings;
  // The deliberate HTTP500 scenario also emits the app's existing transport-monitor log.
  // Match that exact diagnostic and source only after observing the fixture response;
  // never exempt pageerror or a generic message containing an HTTP status.
  const expectedTelemetryText = '[qa-tracker] {area: http.private, contextMessage: API request failed for /api/test-runs/localtestrunfixture01/automation-report-jobs., details: Object, error: Object}';
  const expectedTelemetry = consoleErrors.filter(entry => automationSource === 'read-error' &&
    entry.url === origin + '/src/utils/errorMonitoring.ts' && entry.text === expectedTelemetryText);
  assert.equal(expectedTelemetry.length, 1, 'The simulated transport failure must be logged exactly once.');
  assert.ok(expectedResourceResponses.some(response => response.status === 500 &&
    response.url.startsWith(origin + '/__qa_api/api/test-runs/localtestrunfixture01/automation-report-jobs?')));
  const diagnostics = classifyBrowserErrors({ pageErrors,
    consoleErrors: consoleErrors.filter(entry => !expectedTelemetry.includes(entry)), baselineWarnings, expectedResourceResponses });
  assert.deepEqual(diagnostics.pageErrors, [], 'Uncaught exceptions are always failures.');
  assert.deepEqual(diagnostics.unexpectedConsole, [], 'The tested views must have no unexpected console errors.');
  const knownWarnings = diagnostics.knownWarnings;
  const result = { passed: true, cases, count: cases.length, writes, unexpectedApi, blockedExternal, knownWarnings,
    scope: 'Real components and real PDF generation; synthetic in-memory API only; no application database changed', output };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  }
} catch (error) {
  if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true, animations: 'disabled' }).catch(() => {});
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), cases, unexpectedApi, blockedExternal, consoleErrors, pageErrors }, null, 2));
  console.error(JSON.stringify({ output, error: String(error), unexpectedApi, consoleErrors }));
  throw error;
} finally {
  if (browser) await browser.close();
  await server.close();
}
