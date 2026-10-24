// Offline real component + query hook + deletion transport. No listener, dotenv or database.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch && !resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()), 'Select scratch outside the repository');
await mkdir(scratch, { recursive: true });
const phase = process.env.QA_BULK_DELETE_PHASE || 'mobile';
const results = [];
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import FunctionalityList from './src/components/FunctionalityList';
import i18n from './src/i18n/i18n';
const root = createRoot(document.getElementById('root'));
let revision = 0;
window.mount = async (viewer = false, language = 'es') => {
  window.fixtureViewer = viewer;
  await i18n.changeLanguage(language);
  const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  root.render(<QueryClientProvider key={++revision} client={client}><ConfigProvider theme={{token:{motion:false}}}><FunctionalityList projectId="SYNTHETIC" /></ConfigProvider></QueryClientProvider>);
};` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://bulk-delete.invalid', VITE_USE_SERVICE_AUTH: 'false', DEV: false }) },
  plugins: [{ name: 'synthetic-nonfunctional-context', setup(b) {
    b.onLoad({ filter: /[\\/]hooks[\\/]use(Modules|Roles|Sprints|DeliveryUnits)\.ts$/ }, args => {
      const name = args.path.match(/use(\w+)\.ts$/)[1];
      return { contents: `export function use${name}(){return {data:[]}}`, loader: 'ts' };
    });
    b.onLoad({ filter: /[\\/]hooks[\\/]useWorkspaceAccess\.ts$/ }, () => ({ contents: 'export function useWorkspaceAccess(){return {isViewer:window.fixtureViewer}}', loader: 'ts' }));
  } }],
});
const js = bundle.outputFiles.find(file => file.path.endsWith('.js'))?.text || bundle.outputFiles[0].text;
const css = (await readFile('src/index.css', 'utf8')).replace(/@import[^;]+;/g, '');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let rows;
let writes = [];
let reads = [];
let failId;
let hold;
let release;
const unexpected = [];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.isNavigationRequest() && req.url() === 'https://bulk-delete.invalid/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' });
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.origin === 'https://bulk-delete.invalid' && url.pathname === '/api/functionalities' && req.method() === 'GET') {
      assert.equal(url.searchParams.get('filters[project][key][$eq]'), 'SYNTHETIC');
      const code = url.searchParams.get('filters[code][$eq]'); reads.push(code);
      return reply({ data: code ? rows.filter(row => row.code === code) : rows });
    }
    if (url.origin === 'https://bulk-delete.invalid' && url.pathname.startsWith('/api/functionalities/') && req.method() === 'DELETE') {
      const id = url.pathname.split('/').at(-1); writes.push(id);
      assert.ok(rows.some(row => row.documentId === id), 'DELETE must use persistence documentId, never business code');
      if (hold) await hold;
      if (id === failId) return reply({error:{message:'Synthetic rejected deletion'}}, 503);
      rows = rows.filter(row => row.documentId !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    unexpected.push(req.method() + ' ' + req.url()); return route.abort();
  });
  await page.goto('https://bulk-delete.invalid/');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  const reset = async (viewer = false, language = 'es') => {
    rows = [1,2,3].map(n => ({ documentId: `persist${n}`, code: `BUS-${n}`, name: `Synthetic functionality ${n}`, project:{key:'SYNTHETIC'}, module:{name:'Synthetic module'}, status:'backlog', priority:'medium', impactLevel:'medium', probabilityLevel:'medium', sortOrder:n }));
    writes = []; reads = []; failId = undefined; hold = undefined;
    await page.evaluate(({viewer,language}) => window.mount(viewer, language), {viewer,language});
    await expect(page.locator('tr[data-row-key="BUS-3"]')).toBeVisible();
  };
  const select = async n => page.locator(`tr[data-row-key="BUS-${n}"]`).getByRole('checkbox').check();
  const action = () => page.getByRole('button', { name: 'Eliminar seleccionadas', exact: true });
  const dialog = page.getByRole('dialog');
  await reset(); await select(1); await select(2);
  await expect(action(), 'Selected editable rows expose the real destructive action').toBeVisible({timeout:3000});
  await action().click();
  await expect(dialog).toContainText('2 funcionalidades');
  await expect(dialog).toContainText('no se puede deshacer');
  await dialog.getByRole('button', {name:'Cancelar',exact:true}).click();
  await expect(dialog).toBeHidden();
  assert.deepEqual(writes, []);
  await expect(page.locator('tr[data-row-key="BUS-1"]').getByRole('checkbox')).toBeChecked();
  results.push('cancel preserves rows/selection and sends zero DELETEs');
  if (phase !== 'cancel') {
    await action().click();
    hold = new Promise(resolve => { release = resolve; });
    await dialog.getByRole('button', {name:'Eliminar',exact:true}).click();
    await expect.poll(() => writes.length).toBe(2);
    // Repeated DOM activation must not submit again while transport is pending.
    await dialog.locator('.ant-modal-footer button').last().evaluate(el => {el.click();el.click();});
    assert.equal(writes.length,2);
    release(); hold = undefined;
    await expect(dialog).toBeHidden();
    await expect(page.locator('tr[data-row-key="BUS-1"]')).toHaveCount(0);
    await expect(page.locator('tr[data-row-key="BUS-2"]')).toHaveCount(0);
    await expect(page.locator('tr[data-row-key="BUS-3"]')).toBeVisible();
    assert.deepEqual([...writes].sort(),['persist1','persist2']);
    assert.ok(reads.includes('BUS-1') && reads.includes('BUS-2') && !reads.includes('BUS-3'));
    results.push('exact selected business rowKeys resolved through real service to persistence IDs; duplicate submissions locked; unselected row retained');
    await reset(true);
    await expect(action()).toHaveCount(0);
    await expect(page.locator('tbody').getByRole('checkbox')).toHaveCount(0);
    results.push('viewer has no selection or destructive bulk control');
  }
  if (['partial','mobile'].includes(phase)) {
    await reset(); failId = 'persist2'; await select(1); await select(2); await action().click();
    await dialog.getByRole('button',{name:'Eliminar',exact:true}).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Eliminadas: 1. No eliminadas: 1.',{exact:true})).toBeVisible();
    await expect(page.locator('tr[data-row-key="BUS-1"]')).toHaveCount(0);
    await expect(page.locator('tr[data-row-key="BUS-2"]').getByRole('checkbox')).toBeChecked();
    await expect(page.locator('tr[data-row-key="BUS-3"]').getByRole('checkbox')).not.toBeChecked();
    assert.deepEqual([...writes].sort(),['persist1','persist2']);
    results.push('partial failure reports exact counts, removes only successful rows and retains failed selection');
  }
  if (phase === 'mobile') {
    await page.setViewportSize({width:390,height:844});
    await reset(); await select(1); await select(2);
    const actionBox = await action().boundingBox();
    assert.ok(actionBox && actionBox.x >= 0 && actionBox.x + actionBox.width <= 390, 'Bulk delete control fits the narrow viewport');
    await action().click();
    await page.waitForTimeout(350);
    for (const locator of [dialog.locator('.ant-modal-container'), dialog.getByRole('button',{name:'Eliminar',exact:true}), dialog.getByRole('button',{name:'Cancelar',exact:true})]) {
      const box = await locator.boundingBox(); assert.ok(box && box.x>=0 && box.x+box.width<=390, 'Destructive dialog/control fits narrow viewport');
    }
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    await reset(false,'en'); await select(1);
    await page.getByRole('button',{name:'Delete selected',exact:true}).click();
    await expect(dialog).toContainText('1 functionalities');
    await expect(dialog).toContainText('cannot be undone');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    results.push('390px confirmation fits; English action, confirmation and cancel localized');
  }
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
  console.log(JSON.stringify({phase,results,unexpectedRequests:unexpected.length,pageErrors:errors},null,2));
} finally {
  release?.(); await browser.close();
  await writeFile(join(scratch,`bulk-delete-${phase}-results.json`),JSON.stringify({phase,results,unexpected,errors},null,2));
}
