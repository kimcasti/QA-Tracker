// Offline real automation dialog/hooks/transport; synthetic intercepted HTTP only.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch && !resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()));
await mkdir(scratch, { recursive: true });
const errors = [], outbound = [], posts = [], checks = [], detailReads = [];
const cases = Array.from({ length: 10 }, (_, i) => ({ caseId: 'case-' + i, resultId: 'result-' + i,
  title: ['Validación de acceso', 'Cambio de nombre', 'Buscar registro'][i] || 'Synthetic case ' + i,
  module: i < 5 ? 'Alpha' : 'Beta', reference: `synthetic.spec.ts::case-${i}` }));
const job = (id, state, included = cases) => ({ id, runId: 'synthetic-run', runnerId: 1, state, cases: included, completedCount: included.length });
let inspection, details, failDetails = false;
const resetData = () => {
  inspection = { canRun: true, cases, duplicateReferences: [],
    jobs: [job(20, 'completed'), job(30, 'interrupted', cases.slice(0, 3))], totalJobs: 2,
    runners: [{ id: 1, label: 'Synthetic runner', online: true, busy: false, catalog: cases.map(c => c.reference), environments: ['local', 'test'] }],
    connections: [{ id: 10, label: 'Synthetic connection', runnerId: 1, isOwnConnection: true, online: true, busy: false }] };
  details = { 20: { ...job(20, 'completed'), outcomes: [{ automationReference: cases[2].reference, status: 'failed' }, { automationReference: cases[5].reference, status: 'failed' }] },
    30: { ...job(30, 'interrupted', cases.slice(0, 3)), outcomes: [
      { automationReference: cases[0].reference, status: 'failed' },
      { automationReference: cases[1].reference, status: 'failed' },
      { automationReference: cases[2].reference, status: 'passed' },
      { automationReference: cases[9].reference, status: 'failed' }, // not in this attempt: must not leak into matches
    ] } };
};
resetData();
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ConfigProvider} from 'antd';
import {RunAutomationButton} from './src/modules/automation/components/RunAutomationButton';
const root=createRoot(document.getElementById('root'));let revision=0,client;
window.mount=()=>{client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});root.render(<QueryClientProvider key={++revision} client={client}><ConfigProvider theme={{token:{motion:false}}}><RunAutomationButton runId="synthetic-run" hasUnsavedChanges={false} onResults={async()=>{}}/></ConfigProvider></QueryClientProvider>)};
window.refresh=()=>client.invalidateQueries({queryKey:['automation-runner','synthetic-run']});
` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://automation-filters.invalid', VITE_USE_SERVICE_AUTH: 'false', DEV: false }) } });
const compiler = await compile(await readFile('src/index.css', 'utf8'), { base: resolve('src'), onDependency: () => {} });
const scanner = new Scanner({ sources: [{ base: resolve('src'), pattern: '**/*.{ts,tsx}', negated: false }] });
const css = compiler.build(scanner.scan());
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }) });
    if (request.isNavigationRequest() && url.href === 'https://automation-filters.invalid/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' });
    if (url.origin === 'https://automation-filters.invalid') {
      if (request.method() === 'POST') { posts.push(request.postDataJSON()); return reply(job(40, 'pending', cases.filter(c => posts.at(-1).data.caseIds.includes(c.caseId)))); }
      if (url.pathname.endsWith('/runner')) return reply(inspection);
      const id = Number(url.pathname.match(/\/jobs\/(\d+)$/)?.[1]);
      if (id && details[id]) {
        detailReads.push(id);
        if (failDetails && id === 30) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Synthetic details unavailable' } }) });
        return reply(details[id]);
      }
    }
    outbound.push(request.method() + ' ' + request.url()); return route.abort();
  });
  await page.goto('https://automation-filters.invalid/'); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const open = async () => {
    await page.evaluate(() => window.mount());
    await page.getByRole('button', { name: /Consultar Test Automatizados|Ejecutar automatizados/ }).click();
    await page.getByRole('tab', { name: 'Casos automatizados', exact: true }).click();
  };
  const dialog = page.getByRole('dialog');
  const rows = dialog.locator('tbody tr[data-row-key]');
  const search = dialog.getByRole('textbox', { name: 'Buscar por nombre del caso de prueba' });
  const choose = async (name, label) => {
    const control = dialog.getByRole('combobox', { name, exact: true }); await control.click();
    const id = await control.getAttribute('aria-controls');
    await page.locator(`[id="${id}"]`).locator('xpath=ancestor::div[contains(@class,"ant-select-dropdown")][1]').locator('.ant-select-item-option-content').getByText(label, { exact: true }).click();
  };
  await open(); await expect(rows).toHaveCount(8);
  await expect(search).toBeVisible({ timeout: 3000 });
  await choose('Ejecutor', 'Synthetic connection · Tu conexión · Disponible');
  await dialog.getByTitle('2', { exact: true }).click(); await expect(rows).toHaveCount(2);
  await search.fill('  VALIDACIÓN '); await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-row-key', 'case-0');
  await rows.first().getByRole('checkbox').check();
  await search.fill('cambio'); await expect(rows).toHaveCount(1); await rows.first().getByRole('checkbox').check();
  await expect(dialog.getByRole('button', { name: 'Ejecutar 2 casos', exact: true })).toBeEnabled();
  await expect(dialog).toContainText('1 fuera del filtro');
  checks.push('name search ignores case/outer whitespace, resets pagination and preserves hidden selections');
  await choose('Filtrar casos automatizados', 'Fallidos de la última ejecución');
  await expect(rows).toHaveCount(1); await search.fill(''); await expect(rows).toHaveCount(2);
  assert.deepEqual(await rows.evaluateAll(nodes => nodes.map(n => n.dataset.rowKey).sort()), ['case-0', 'case-1']);
  assert.ok(detailReads.includes(30));
  for (const checkbox of await rows.getByRole('checkbox').all()) await expect(checkbox).toBeChecked();
  await search.fill('not present'); await expect(rows).toHaveCount(0);
  await search.fill(''); await expect(rows).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Ejecutar 2 casos', exact: true }).click();
  assert.deepEqual(posts[0].data.caseIds.sort(), ['case-0', 'case-1']);
  checks.push('latest terminal job only, matching case identity/reference; no older failures or out-of-attempt cases; exact selected payload');
  resetData(); inspection.jobs = []; await open();
  await choose('Filtrar casos automatizados', 'Fallidos de la última ejecución');
  await expect(rows).toHaveCount(0); await expect(dialog).toContainText('No hay ejecuciones finalizadas');
  checks.push('no history is an explicit empty state, never fabricated failures');
  resetData(); failDetails = true; await open();
  await choose('Filtrar casos automatizados', 'Fallidos de la última ejecución');
  await expect(dialog.getByRole('alert')).toContainText('No se pudieron consultar los últimos casos fallidos');
  await expect(rows).toHaveCount(0);
  failDetails = false; await dialog.getByRole('button', { name: 'Reintentar', exact: true }).click(); await expect(rows).toHaveCount(2);
  checks.push('failed detail read fails closed; explicit retry restores the filter');
  await page.setViewportSize({ width: 390, height: 844 });
  await search.fill('cambio'); await expect(rows).toHaveCount(1);
  const bounds = await search.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  assert.equal(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth), true);
  await page.screenshot({ path: join(scratch, 'automation-case-filters-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: join(scratch, 'automation-case-filters-desktop.png'), fullPage: true, animations: 'disabled' });
  assert.deepEqual(outbound, []); assert.deepEqual(errors, []); assert.equal(posts.length, 1);
  checks.push('390px search and dialog fit; only one intentional synthetic enqueue; zero external/backend requests');
  await writeFile(join(scratch, 'automation-case-filters-results.json'), JSON.stringify({ checks, errors, outbound, posts }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, errors, outbound }, null, 2));
} finally { await browser.close(); }
