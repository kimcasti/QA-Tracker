// Real execution view; synthetic data hooks, no backend/listener/dotenv.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch && !resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()));
await mkdir(scratch, { recursive: true });
const checks = [], errors = [], outbound = [];
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ConfigProvider} from 'antd';
import TestExecutionView from './src/components/TestExecutionView';
import {AutomationStatus,TestResult,TestType,ExecutionStatus} from './src/types';
import './src/i18n/i18n';
const base={projectId:'FILTERS',functionalityId:'F1',testType:TestType.FUNCTIONAL,testSteps:'Synthetic steps',expectedResult:'Synthetic expected'};
const cases=[
 ['auto-fail',AutomationStatus.AUTOMATED,TestResult.FAILED],
 ['auto-pass',AutomationStatus.AUTOMATED,TestResult.PASSED],
 ['auto-pending',null,TestResult.NOT_EXECUTED],
 ['manual-fail',AutomationStatus.NOT_AUTOMATED,TestResult.FAILED],
 ['candidate-fail',AutomationStatus.CANDIDATE,TestResult.FAILED],
 ['obsolete-pass',AutomationStatus.OBSOLETE,TestResult.PASSED],
 ['manual-pending',AutomationStatus.NOT_AUTOMATED,TestResult.NOT_EXECUTED]
].map(([id,automationStatus,result],i)=>({...base,id,title:'Synthetic '+id,automationStatus,isAutomated:id.startsWith('auto')||id==='candidate-fail',automationReference:id+'.spec.ts',functionalityId:i<3?'F1':'F2',sortOrder:i,result}));
const results=cases.map(c=>({id:'result-'+c.id,testCaseId:c.id,functionalityId:c.functionalityId,result:c.result,notes:'<p>Retained synthetic evidence</p>'}));
const run={id:'run-1',projectId:'FILTERS',title:'Synthetic filter run',testType:TestType.FUNCTIONAL,status:ExecutionStatus.DRAFT,executionDate:'2026-01-01',tester:'Synthetic QA',selectedModules:['Alpha','Beta'],selectedFunctionalities:['F1','F2'],results};
window.fixture={cases,runs:[run,{...run,id:'run-2',title:'Synthetic second run'}],functionalities:[{id:'F1',projectId:'FILTERS',name:'First feature',module:'Alpha'},{id:'F2',projectId:'FILTERS',name:'Second feature',module:'Beta'}]};
window.writes=[];window.reads=[];window.fixtureViewer=false;
const root=createRoot(document.getElementById('root'));let revision=0;
window.mount=(viewer=false)=>{window.fixtureViewer=viewer;const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});root.render(<QueryClientProvider key={++revision} client={client}><ConfigProvider theme={{token:{motion:false}}}><TestExecutionView projectId="FILTERS"/></ConfigProvider></QueryClientProvider>);};
` }, bundle: true, write: false, outfile: join(scratch, 'execution-filters.js'), platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://execution-filters.invalid', DEV: false }) },
  plugins: [{ name: 'synthetic-data-boundaries', setup(b) {
    b.onLoad({ filter: /[\\/]hooks[\\/]use(Functionalities|TestCases|TestRunSummaries|TestRuns|Modules|Sprints|Bugs|AutomationImportHistories|ParticipantDirectoryMembers)\.ts$/ }, args => {
      const name = args.path.match(/(use\w+)\.ts$/)[1];
      const data = { useFunctionalities: 'window.fixture.functionalities', useTestCases: 'window.fixture.cases', useTestRunSummaries: 'window.fixture.runs' }[name] || 'empty';
      return { loader: 'ts', contents: `const empty=[];const save=async v=>{window.writes.push(v);return v};export function ${name}(){return {data:${data},save,delete:save,saveManyWithSingleRefresh:save}}` };
    });
    b.onLoad({ filter: /[\\/]hooks[\\/]useWorkspaceAccess\.ts$/ }, () => ({ loader: 'ts', contents: `export function useWorkspaceAccess(){return {data:{memberships:[],projects:[]},isOwner:!window.fixtureViewer,isViewer:window.fixtureViewer,projectQuota:{plan:'enterprise',features:{exports:true,ai:false},billing:{planStatus:'active'}}}}` }));
    b.onLoad({ filter: /[\\/]hooks[\\/]useAutomationRunner\.ts$/ }, () => ({ loader: 'ts', contents: `export function useAutomationRunner(){return {inspection:{data:{jobs:[],runners:[],cases:[]}},enqueue:{mutateAsync:async v=>window.writes.push(v)}}}` }));
    b.onLoad({ filter: /[\\/]hooks[\\/]usePublicUatSession\.ts$/ }, () => ({ loader: 'ts', contents: `export function usePublicUatManagementAccess(){return false} export function usePublicUatSessionActions(){return {}} export function usePublicUatSessionStatus(){return {}}` }));
    b.onLoad({ filter: /[\\/]services[\\/]testRunsService\.ts$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      const ast = ts.createSourceFile(args.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'getTestRunById');
      assert.ok(declaration?.body);
      const parameter = declaration.parameters[0].name.getText(ast);
      const replacement = `{window.reads.push(${parameter});return structuredClone(window.fixture.runs.find(r=>r.id===${parameter}));}`;
      return { loader: 'ts', contents: source.slice(0, declaration.body.getStart(ast)) + replacement + source.slice(declaration.body.end) };
    });
  } }] });
const compiler = await compile(await readFile('src/index.css', 'utf8'), { base: resolve('src'), onDependency: () => {} });
const scanner = new Scanner({ sources: [{ base: resolve('src'), pattern: '**/*.{ts,tsx}', negated: false }] });
const css = compiler.build(scanner.scan()) + '\n' + bundle.outputFiles.filter(f => f.path.endsWith('.css')).map(f => f.text).join('\n');
const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest() && route.request().url() === 'https://execution-filters.invalid/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' });
    outbound.push(route.request().method() + ' ' + route.request().url()); return route.abort();
  });
  await page.goto('https://execution-filters.invalid/');
  await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
  const openRun = async (id = 'run-1') => {
    await page.locator(`tr[data-row-key="${id}"]`).getByRole('button', { name: /Continuar ejecución|Ver/ }).first().click();
    await expect(page.locator('.execution-detail-table')).toBeVisible();
  };
  const rows = page.locator('.execution-detail-table tr[data-row-key]');
  const ids = async () => (await rows.evaluateAll(nodes => nodes.map(n => n.dataset.rowKey))).sort();
  const choose = async label => {
    const control = page.getByRole('combobox', { name: 'Filtrar por automatización' });
    await control.click(); const id = await control.getAttribute('aria-controls');
    await page.locator(`[id="${id}"]`).locator('xpath=ancestor::div[contains(@class,"ant-select-dropdown")][1]').locator('.ant-select-item-option-content').getByText(label, { exact: true }).click();
  };
  await page.evaluate(() => window.mount()); await openRun();
  const original = await page.evaluate(() => JSON.stringify(window.fixture));
  const summaryCards = page.locator('.ant-row').first();
  const originalSummary = await summaryCards.innerText();
  assert.match(originalSummary, /total tests/i);
  await expect(rows).toHaveCount(7);
  await expect(page.getByRole('combobox', { name: 'Filtrar por automatización' })).toBeVisible({ timeout: 3000 });
  const searchBounds = await page.getByPlaceholder('Search by Module or Functionality...').locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," ant-input-affix-wrapper ")][1]').boundingBox();
  const automationBounds = await page.getByRole('combobox', { name: 'Filtrar por automatización' }).locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," ant-select ")][1]').boundingBox();
  const resultBounds = await page.getByRole('button', { name: 'Solo fallidos', exact: true }).boundingBox();
  assert.ok(searchBounds.width <= 320, 'search field stays compact on desktop');
  assert.ok(Math.abs((searchBounds.y + searchBounds.height) - (automationBounds.y + automationBounds.height)) <= 2, 'search and automation selector align at the bottom');
  assert.ok(Math.abs((searchBounds.y + searchBounds.height) - (resultBounds.y + resultBounds.height)) <= 2, 'search and result buttons align at the bottom');
  await choose('Automatizados'); await expect(rows).toHaveCount(3);
  assert.deepEqual(await ids(), ['auto-fail', 'auto-pass', 'auto-pending']);
  await page.getByRole('button', { name: 'Solo fallidos', exact: true }).click();
  await expect(rows).toHaveCount(1); assert.deepEqual(await ids(), ['auto-fail']);
  await choose('No automatizados'); await expect(rows).toHaveCount(2);
  assert.deepEqual(await ids(), ['candidate-fail', 'manual-fail']);
  assert.equal(await summaryCards.innerText(), originalSummary, 'full-run counts and percentages must not change with visible rows');
  checks.push('automation + failed intersect per case, explicit candidate status overrides legacy automated flag');
  await choose('Todos'); await expect(rows).toHaveCount(3);
  await page.getByRole('button', { name: 'Solo pendientes', exact: true }).click(); await expect(rows).toHaveCount(2);
  await choose('Automatizados'); await expect(rows).toHaveCount(1); assert.deepEqual(await ids(), ['auto-pending']);
  await page.getByRole('button', { name: 'Todos', exact: true }).click(); await expect(rows).toHaveCount(3);
  await page.getByPlaceholder('Search by Module or Functionality...').fill('auto-pass');
  await expect(rows).toHaveCount(1); assert.deepEqual(await ids(), ['auto-pass']);
  await choose('No automatizados'); await expect(rows).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); await expect(rows).toHaveCount(7);
  checks.push('pending, search, empty intersection and clear preserve all original results');
  await page.getByRole('button', { name: 'Solo fallidos', exact: true }).click();
  await choose('No automatizados');
  await page.getByPlaceholder('Search by Module or Functionality...').fill('manual');
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: /Volver$/ }).click(); await openRun('run-2');
  await expect(rows).toHaveCount(7); await expect(page.getByRole('button', { name: 'Todos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByPlaceholder('Search by Module or Functionality...')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Limpiar filtros', exact: true })).toBeDisabled();
  checks.push('filters reset when opening another run');
  await page.evaluate(() => window.mount(true)); await openRun();
  await choose('Automatizados'); await page.getByRole('button', { name: 'Solo fallidos', exact: true }).click(); await expect(rows).toHaveCount(1);
  await expect(rows.getByRole('combobox')).toBeDisabled();
  checks.push('viewer can filter without gaining edit permission');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click(); await expect(rows).toHaveCount(7);
  const control = page.getByRole('combobox', { name: 'Filtrar por automatización' });
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await choose('No automatizados'); await expect(rows).toHaveCount(4);
  await page.screenshot({ path: join(scratch, 'execution-filters-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: join(scratch, 'execution-filters-desktop.png'), fullPage: true, animations: 'disabled' });
  assert.equal(await page.evaluate(() => JSON.stringify(window.fixture)), original);
  assert.deepEqual(await page.evaluate(() => window.writes), []);
  assert.deepEqual(outbound, []); assert.deepEqual(errors, []);
  checks.push('390px controls fit; zero writes, external requests or changed fixture records');
  await writeFile(join(scratch, 'execution-filters-results.json'), JSON.stringify({ checks, errors, outbound }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, errors, outbound }, null, 2));
} finally { await browser.close(); }
