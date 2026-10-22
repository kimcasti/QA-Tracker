import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { AutomationStatus, type Functionality, type TestCase } from '../src/types';

const helperUrl = new URL('../src/utils/moduleAutomationCoverage.ts', import.meta.url);
const functionality = (id: string, module: string) => ({ id, documentId: `doc-${id}`, projectId: 'project', module, name: id } as Functionality);
const testCase = (id: string, functionalityId: string, extra: Partial<TestCase> = {}) => ({ id, projectId: 'project', functionalityId, title: id, ...extra } as TestCase);

export const functionalities = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Empty'].map((module, index) => functionality(`f${index}`, module));
export const cases = [
  testCase('automated', 'doc-f0', { isAutomated: true }),
  testCase('manual', 'f0'),
  testCase('candidate', 'f1', { automationStatus: AutomationStatus.CANDIDATE }),
  testCase('obsolete', 'doc-f2', { isAutomated: true, automationStatus: AutomationStatus.OBSOLETE }),
  testCase('delta', 'f3', { automationStatus: AutomationStatus.AUTOMATED }),
  testCase('foreign', 'doc-f0', { projectId: 'other', isAutomated: true }),
  testCase('orphan', 'unknown', { isAutomated: true }),
];

test('module coverage retains all modules and exact alias-aware project denominators', async () => {
  assert.ok(existsSync(helperUrl), 'module coverage helper must exist');
  const { buildModuleAutomationCoverage } = await import(helperUrl.href);
  const { modules, portfolio } = buildModuleAutomationCoverage(functionalities, cases);
  assert.equal(modules.length, 5);
  const alpha = modules.find(item => item.name === 'Alpha')!;
  assert.deepEqual([alpha.automatedCases, alpha.totalCases, alpha.coverage], [1, 2, 50]);
  assert.deepEqual(alpha.cases.map(item => item.id), ['automated', 'manual']);
  assert.deepEqual(modules.find(item => item.name === 'Beta')?.coverage, 0);
  assert.deepEqual(modules.find(item => item.name === 'Gamma')?.coverage, 0);
  assert.deepEqual(modules.find(item => item.name === 'Empty')?.coverage, null);
  assert.equal(portfolio.scopedTestCases.length, 5);
  assert.equal(modules.reduce((sum, item) => sum + item.totalCases, 0), portfolio.scopedTestCases.length);
});

// Execute the real component. Only React's state scheduler and AntD's portal are
// substituted; calculations, event handlers, labels and readonly rows are real.
test('module bars expose all denominators and readonly module-specific case drilldown', async () => {
  const componentUrl = new URL('../src/components/AutomationModuleCoverage.tsx', import.meta.url);
  assert.ok(existsSync(componentUrl), 'shared module coverage component must exist');
  const helper = await import(helperUrl.href);
  const types = await import('../src/types');
  let selected: string | null = null;
  const portal = ({ open, title, children }: any) => open ? React.createElement('section', { role: 'dialog', 'aria-label': title }, children) : null;
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(componentUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports: any = {};
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react') return { ...React, useMemo: (fn: any) => fn(), useState: () => [selected, (value: any) => { selected = value; }] };
    if (id === 'antd') return { Modal: portal };
    if (id.includes('moduleAutomationCoverage')) return helper;
    if (id === '../types') return types;
    return require(id);
  }, exports);
  const Component = exports.AutomationModuleCoverage || exports.default;
  const props = { functionalities, testCases: cases, scopeLabel: 'Todo el proyecto · Estado actual' };
  const initialTree = Component(props);
  const markup = renderToStaticMarkup(initialTree);
  assert.match(markup, /Casos automatizados por módulo/);
  assert.match(markup, /data-testid="automation-module-coverage"/);
  assert.match(markup, /data-module-name="Empty"/);
  assert.match(markup, /Todo el proyecto · Estado actual/);
  for (const module of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Empty']) assert.match(markup, new RegExp(`Ver casos de ${module}`));
  assert.match(markup, /Sin casos/);
  assert.match(markup, /0%/);
  assert.match(markup, /1 de 2/);
  assert.equal((markup.match(/role="progressbar"/g) || []).length, 4, 'no percent bar for undefined empty denominator');
  const elements: any[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    elements.push(node);
    walk(node.props?.children);
  };
  walk(initialTree);
  elements.find(node => node.props?.['aria-label'] === 'Ver casos de Alpha').props.onClick();
  const opened = renderToStaticMarkup(Component(props));
  const dialog = opened.slice(opened.indexOf('<section role="dialog"'));
  assert.match(dialog, /automated/);
  assert.match(dialog, /manual/);
  assert.match(dialog, /Solo lectura/);
  assert.match(dialog, /Automatizada/);
  assert.match(dialog, /1 de 2/);
  assert.doesNotMatch(dialog, /foreign|orphan|candidate|obsolete|<input|<select|contenteditable/);
  elements.find(node => node.props?.['aria-label'] === 'Ver casos de Empty').props.onClick();
  const empty = renderToStaticMarkup(Component(props));
  const emptyDialog = empty.slice(empty.indexOf('<section role="dialog"'));
  assert.match(emptyDialog, /Sin casos/);
  assert.doesNotMatch(emptyDialog, /0%|<table/);
});

test('Dashboard uses project module bars, precise functionality meaning and metadata-only independent tool rates', async () => {
  const types = await import('../src/types');
  const helper = await import(helperUrl.href);
  const dashboardCases = [
    ...cases,
    { ...cases[0], id: 'passed', automationTool: types.AutomationTool.PLAYWRIGHT, lastAutomationStatus: types.AutomationResultStatus.PASSED },
    { ...cases[0], id: 'failed', automationTool: types.AutomationTool.PLAYWRIGHT, lastAutomationStatus: types.AutomationResultStatus.FAILED },
    { ...cases[0], id: 'skipped', automationTool: types.AutomationTool.PLAYWRIGHT, lastAutomationStatus: types.AutomationResultStatus.SKIPPED },
    { ...cases[0], id: 'unknown', automationTool: types.AutomationTool.PLAYWRIGHT, lastAutomationStatus: types.AutomationResultStatus.UNKNOWN },
    { ...cases[0], id: 'manual-pass', automationTool: types.AutomationTool.CYPRESS },
  ];
  const primitive = ({ children }: any) => React.createElement('div', null, children);
  const text = ({ children }: any) => React.createElement('span', null, children);
  const antd: any = Object.fromEntries(['Button', 'Col', 'Row', 'Table', 'Tag'].map(name => [name, primitive]));
  antd.Card = ({ title, children }: any) => React.createElement('section', null, title, children);
  antd.Typography = { Title: primitive, Text: text };
  antd.Statistic = ({ title, value }: any) => React.createElement('div', null, title, value);
  antd.Progress = ({ percent, ...rest }: any) => React.createElement('span', { 'data-rate': percent, 'aria-label': rest['aria-label'] });
  antd.Empty = Object.assign(({ description }: any) => React.createElement('p', null, description), { PRESENTED_IMAGE_SIMPLE: null });
  antd.DatePicker = { RangePicker: primitive };
  const dashboardUrl = new URL('../src/components/Dashboard.tsx', import.meta.url);
  const dashboardRequire = createRequire(dashboardUrl);
  const compiled = ts.transpileModule(readFileSync(dashboardUrl, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  let sharedProps: any = null;
  const shared = (props: any) => { sharedProps = props; return React.createElement('div', null, 'Casos automatizados por módulo'); };
  const exports: any = {};
  let hookCases = dashboardCases;
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react') return { ...React, useMemo: (fn: any) => fn(), useState: (initial: any) => [initial, () => {}] };
    if (id === 'antd') return antd;
    if (id === '@ant-design/icons') return new Proxy({}, { get: () => primitive });
    if (id === 'recharts') return { PieChart: primitive, Pie: primitive, Cell: () => null, Tooltip: () => null };
    if (id === '../types') return types;
    if (id.includes('moduleAutomationCoverage')) return helper;
    if (id.includes('AutomationModuleCoverage')) return { default: shared, AutomationModuleCoverage: shared };
    if (id.includes('/hooks/')) {
      const hook = id.split('/').at(-1)!;
      const data = hook === 'useFunctionalities' ? functionalities : hook === 'useTestCases' ? hookCases : hook === 'useExecutions' ? [{ id: 'manual-run', testCaseId: 'manual-pass', result: types.TestResult.PASSED, status: types.ExecutionStatus.FINAL, executionDate: '2026-01-01' }] : [];
      return { [hook]: () => hook === 'useWorkspaceAccess' ? {} : { data } };
    }
    if (id.includes('PlanBillingBanner')) return { PlanBillingBanner: () => null };
    if (id.includes('functionalitiesService')) return { normalizeDateOnly: () => null };
    if (id.includes('projectUpgrade')) return { normalizeOrganizationPlan: () => 'starter', buildProjectUpgradeWhatsAppUrl: () => '' };
    if (id.includes('planAccessService') || id.includes('billingService')) return {};
    return dashboardRequire(id);
  }, exports);
  const markup = renderToStaticMarkup(exports.default({ projectId: 'project' }));
  assert.ok(sharedProps, 'Dashboard must mount shared module coverage even without positive module coverage');
  assert.equal(sharedProps.scopeLabel, 'Todo el proyecto · Estado actual');
  assert.equal(sharedProps.functionalities, functionalities);
  assert.match(markup, /Funcionalidades con automatización/);
  assert.match(markup, /al menos 1 caso automatizado/);
  assert.match(markup, /Último resultado automático por caso/);
  assert.match(markup, /Metadatos de casos/);
  assert.match(markup, /1 de 2/);
  assert.match(markup, /50%/);
  assert.match(markup, /Sin resultados/);
  assert.doesNotMatch(readFileSync(dashboardUrl, 'utf8'), /moduleAutomationCoveragePieData|automationSuccessByToolPieData|\.slice\(0, 3\)/);
  hookCases = [];
  sharedProps = null;
  const noAutomation = renderToStaticMarkup(exports.default({ projectId: 'project' }));
  assert.ok(sharedProps, 'zero automation must not hide project modules');
  assert.match(noAutomation, /al menos 1 caso automatizado/);
});
