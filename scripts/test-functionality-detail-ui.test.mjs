// Offline real component + query hook + deletion transport. No listener, dotenv or database.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch && !resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()), 'Select scratch outside the repository');
await mkdir(scratch, { recursive: true });
const phase = 'detail';
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
const { compile } = await import('@tailwindcss/node');
const { Scanner } = await import('@tailwindcss/oxide');
const compiler = await compile(await readFile('src/index.css', 'utf8'), {base:resolve('src'),onDependency:()=>{}});
const scanner = new Scanner({sources:[{base:resolve('src'),pattern:'**/*.{ts,tsx}',negated:false}]});
const css = compiler.build(scanner.scan());
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
  const dialog = page.getByRole('dialog', {name:'Detalle de Funcionalidad'});
  const openDetail = async () => {
    await page.locator('tr[data-row-key="BUS-1"] button').first().click();
    await expect(dialog).toBeVisible();
  };
  await reset(); await openDetail();
  await expect(dialog.getByText('Estado funcional, cobertura y señales de riesgo para seguimiento.',{exact:true})).toHaveCount(0);
  await expect(dialog.getByText('Cobertura QA',{exact:true})).toHaveCount(0);
  for (const text of ['Identificación','Jira','Entrega']) await expect(dialog.getByText(text,{exact:true})).toBeVisible();
  results.push('QA block hidden; identification, Jira and delivery preserved');
  if (process.env.QA_DETAIL_PHASE !== 'hide') {
    const edit = dialog.getByRole('button',{name:'Editar funcionalidad',exact:true});
    await expect(dialog.locator('.ant-modal-header').getByRole('button',{name:'Editar funcionalidad',exact:true})).toBeVisible();
    await expect(dialog.locator('.ant-modal-footer').getByRole('button',{name:'Editar funcionalidad',exact:true})).toHaveCount(0);
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:1000}); await page.waitForTimeout(400);
      const header = await dialog.locator('.ant-modal-header').boundingBox();
      const box = await edit.boundingBox();
      const close = await dialog.locator('.ant-modal-close').boundingBox();
      assert.ok(box && header && close && box.x>=0 && box.x+box.width<=width);
      assert.ok(box.x+box.width/2>header.x+header.width/2,'Edit belongs to right side of header');
      assert.ok(box.x+box.width<=close.x || box.y>=close.y+close.height,'Edit does not overlap close');
      const container = dialog.locator('.ant-modal-container');
      assert.equal(await container.evaluate(el=>el.scrollWidth>el.clientWidth),false);
      await page.screenshot({path:join(scratch,`functionality-detail-${width}.png`),fullPage:true});
    }
    await edit.click();
    await expect(dialog).toBeHidden();
    const editor = page.getByRole('dialog');
    await expect(editor).toBeVisible();
    await expect(editor.locator('input').filter({visible:true}).first()).toHaveValue('BUS-1');
    await editor.getByRole('button',{name:'Cancelar',exact:true}).click();
    results.push('single edit action in upper-right header fits desktop/mobile and opens correct record');
    await page.setViewportSize({width:1280,height:1000});
    await reset(true); await openDetail();
    await expect(dialog.getByRole('button',{name:'Editar funcionalidad',exact:true})).toHaveCount(0);
    await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
    await expect(dialog).toBeHidden();
    results.push('viewer remains readonly; close action works');
  }
  assert.deepEqual(writes,[]); assert.deepEqual(unexpected,[]); assert.deepEqual(errors,[]);
  console.log(JSON.stringify({results,unexpectedRequests:unexpected.length,pageErrors:errors},null,2));
} finally {
  release?.(); await browser.close();
  await writeFile(join(scratch,'functionality-detail-results.json'),JSON.stringify({results,unexpected,errors},null,2));
}
