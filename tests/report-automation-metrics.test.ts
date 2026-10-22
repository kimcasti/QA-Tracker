import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as types from '../src/types';
const run = { id: 'run-7', status: types.ExecutionStatus.FINAL, testType: types.TestType.REGRESSION, sprint: '7', results: [{ id: 'result-1', testCaseId: 'case-document', result: types.TestResult.PASSED }] } as types.TestRun;
const history = { id: 'history-1', testRunId: run.id, tool: types.AutomationTool.PLAYWRIGHT, importedAt: '2026-10-20T10:00:00Z', matchedCases: [{ testCaseId: 'case-document', status: types.AutomationResultStatus.PASSED }] };

test('sprint conserva ambos alias y usa resultados automáticos con procedencia de la ejecución', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const metrics = getAutomationPortfolioMetrics([functionality, { ...functionality, id: 'FUN-2', documentId: 'other-fun', sprint: '8' }], [caseFor(), caseFor({ id: 'other-case', documentId: 'other-case-doc', functionalityId: 'other-fun' })], { sprint: 'Sprint 7', runs: [run], histories: [history] });
  assert.equal(metrics.scopedTestCases.length, 1);
  assert.equal(metrics.moduleCoverage[0]?.coverage, 100);
  assert.equal(metrics.successByTool[0]?.successRate, 100);
  assert.equal(metrics.successByTool[0]?.total, 1);
});

test('un resultado manual o el snapshot global no prueba aprobación automática en un sprint', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const metrics = getAutomationPortfolioMetrics([functionality], [caseFor({ lastAutomationStatus: types.AutomationResultStatus.PASSED })], { sprint: '7', runs: [run], histories: [] });
  assert.equal(metrics.successByTool[0]?.successRate, null);
  assert.equal(metrics.successByTool[0]?.total, 0);
});

test('las omitidas y desconocidas no se convierten en fallos ni en un 0% inventado', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const metrics = getAutomationPortfolioMetrics([functionality], [caseFor({ lastAutomationStatus: types.AutomationResultStatus.SKIPPED })]);
  assert.equal(metrics.successByTool[0]?.successRate, null);
  assert.equal(metrics.successByTool[0]?.total, 0);
});


// Exercise the actual Reports calculation seam without mounting HTTP-backed hooks.
async function reportsCalculations(extra: Record<string, unknown> = {}) {
  const source = readFileSync(new URL('../src/components/Reports.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('Reports.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['getPercent', 'getTestRunAutomationMetrics', 'getAutomationPortfolioMetrics', 'ProjectStatusReport', 'getProjectRiskTone', 'normalizeSprintKey', 'getTestRunSummary', 'average', 'isExecutionSourceType', 'getTestRunTypeLabel']);
  const declarations = file.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.has(d.name.getText(file))));
  const helperUrl = new URL('../src/utils/reportAutomationMetrics.ts', import.meta.url);
  const helpers = existsSync(helperUrl) ? await import(helperUrl.href) : {};
  const code = declarations.map(node => node.getText(file)).join('\n') + '\n;globalThis.calculations = { getTestRunAutomationMetrics, getAutomationPortfolioMetrics, ProjectStatusReport };';
  const context = vm.createContext({ ...types, ...helpers, useReportAutomationJobs: () => ({ data: [] }), ...extra });
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
  return context.calculations;
}
test('Estado del Proyecto generado usa los casos y el historial del sprint, no snapshots globales', async () => {
  const element = (type: unknown, props: any, ...children: any[]) => ({ type, props: props || {}, children });
  const primitives = Object.fromEntries(['Card', 'Col', 'Row', 'Title', 'Text', 'Paragraph', 'Tag', 'Progress', 'Divider', 'ResponsiveContainer', 'BarChart', 'CartesianGrid', 'XAxis', 'YAxis', 'Bar', 'SafetyCertificateOutlined', 'ClockCircleOutlined', 'BugOutlined', 'TechnicalReportAnalysisCard'].map(name => [name, name]));
  const { ProjectStatusReport } = await reportsCalculations({
    ...primitives, React: { createElement: element }, useMemo: (fn: () => unknown) => fn(),
    useFunctionalities: () => ({ data: [functionality] }),
    useTestCases: () => ({ data: [caseFor()] }), useBugs: () => ({ data: [] }),
    useTestRuns: () => ({ data: [run] }), useAutomationImportHistories: () => ({ data: [history] }),
  });
  const tree = ProjectStatusReport({ projectId: 'project-fixture', sprint: '7', canUseAi: false, onRequireUpgrade() {} });
  const find = (node: any, title: string): any => node?.props?.title === title ? node : (node?.children || []).flat(Infinity).map((child: any) => typeof child === 'object' ? find(child, title) : null).find(Boolean);
  const metrics = JSON.stringify(find(tree, 'Métricas de automatización') || find(tree, 'Metricas de automatizacion'));
  assert.match(metrics, /Ingreso/);
  assert.match(metrics, /Acceso/);
  assert.match(metrics, /Playwright/);
  assert.match(metrics, /100/);
  assert.match(metrics, /"children":\["Playwright"\]\},\{"type":"Text","props":\{"strong":true\},"children":\["100%"\]/);
});

async function renderRunnerReport(query: Record<string, unknown>) {
  const element = (type: unknown, props: any, ...children: any[]) => ({ type, props: props || {}, children });
  const primitives = Object.fromEntries(['Card', 'Col', 'Row', 'Title', 'Text', 'Paragraph', 'Tag', 'Progress', 'Divider', 'ResponsiveContainer', 'BarChart', 'CartesianGrid', 'XAxis', 'YAxis', 'Bar', 'SafetyCertificateOutlined', 'ClockCircleOutlined', 'BugOutlined', 'TechnicalReportAnalysisCard'].map(name => [name, name]));
  let requested = false;
  const { ProjectStatusReport } = await reportsCalculations({
    ...primitives, React: { createElement: element }, useMemo: (fn: () => unknown) => fn(),
    useFunctionalities: () => ({ data: [functionality] }), useTestCases: () => ({ data: [caseFor()] }),
    useBugs: () => ({ data: [] }), useTestRuns: () => ({ data: [run] }),
    useAutomationImportHistories: () => ({ data: [] }),
    useReportAutomationJobs: (projectId: string, runs: any[], sprint: string) => {
      requested = true;
      assert.equal(projectId, 'project-fixture'); assert.equal(runs[0].id, run.id); assert.equal(sprint, '7');
      return query;
    },
  });
  const tree = ProjectStatusReport({ projectId: 'project-fixture', sprint: '7', canUseAi: false, onRequireUpgrade() {} });
  assert.ok(requested, 'ProjectStatusReport must request persisted runner observations');
  const find = (node: any): any => node?.props?.title === 'Métricas de automatización' ? node : (node?.children || []).flat(Infinity).map((child: any) => typeof child === 'object' ? find(child) : null).find(Boolean);
  return JSON.stringify(find(tree));
}
test('project report renders runner-only passed observations in sprint 7', async () => {
  const job = { id: 17, runId: run.id, state: 'completed', finishedAt: '2026-10-20T10:00:00Z', completedCount: 1, cases: [{ resultId: 'result-1', caseId: 'case-document', reference: 'login.spec.ts::login' }], outcomes: [{ automationReference: 'login.spec.ts::login', status: 'passed' }] };
  assert.match(await renderRunnerReport({ data: [job] }), /"children":\["100%"\]/);
});
test('project report surfaces runner read errors, never Sin resultados or stale rates', async () => {
  const rendered = await renderRunnerReport({ data: [], isError: true, error: new Error('synthetic job read failed') });
  assert.match(rendered, /No se pudieron cargar los resultados automáticos/);
  assert.doesNotMatch(rendered, /Sin resultados|resultados automáticos concluyentes/);
});
test('project report shows runner loading instead of transient zero/no results', async () => {
  const rendered = await renderRunnerReport({ data: [], isLoading: true });
  assert.match(rendered, /Cargando resultados automáticos/);
  assert.doesNotMatch(rendered, /Sin resultados|resultados automáticos concluyentes/);
});

const functionality = { id: 'FUN-1', documentId: 'fun-document', name: 'Ingreso', module: 'Acceso', sprint: 'Sprint 7' } as types.Functionality;
const caseFor = (overrides: Partial<types.TestCase> = {}) => ({ id: 'TC-1', documentId: 'case-document', functionalityId: 'fun-document', automationStatus: types.AutomationStatus.AUTOMATED, automationTool: types.AutomationTool.PLAYWRIGHT, ...overrides }) as types.TestCase;

test('cobertura une functionalityId con documentId sin perder el id de negocio', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const metrics = getAutomationPortfolioMetrics([functionality], [caseFor()]);
  assert.equal(metrics.moduleCoverage[0]?.coverage, 100);
  assert.equal(metrics.functionalityCoverage[0]?.automatedCases, 1);
});

test('el estado explícito prevalece sobre isAutomated legacy contradictorio', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const metrics = getAutomationPortfolioMetrics([functionality], [caseFor({ functionalityId: functionality.id, automationStatus: types.AutomationStatus.OBSOLETE, isAutomated: true })]);
  assert.equal(metrics.moduleCoverage[0]?.coverage, 0);
});

test('una ejecución resuelve el documentId del caso sin duplicar su cobertura', async () => {
  const { getTestRunAutomationMetrics } = await reportsCalculations();
  const item = caseFor();
  const metrics = getTestRunAutomationMetrics({ results: [{ testCaseId: item.documentId }] }, new Map([[item.id, item]]));
  assert.equal(metrics.automatedCount, 1);
});

for (const [status, legacy, expected] of [
  [undefined, true, 100], [undefined, false, 0],
  [types.AutomationStatus.AUTOMATED, false, 100],
  [types.AutomationStatus.CANDIDATE, true, 0],
  [types.AutomationStatus.NOT_AUTOMATED, true, 0],
  [types.AutomationStatus.OBSOLETE, true, 0],
] as const) {
  test(`cobertura respeta estado ${status || 'legacy'} e isAutomated=${legacy}`, async () => {
    const { getAutomationPortfolioMetrics } = await reportsCalculations();
    const metrics = getAutomationPortfolioMetrics([functionality], [caseFor({ automationStatus: status, isAutomated: legacy })]);
    assert.equal(metrics.functionalityCoverage[0]?.coverage, expected);
  });
}

for (const variant of ['otro-sprint', 'borrador', 'otro-tipo', 'otro-run', 'otro-caso', 'caso-no-incluido', 'sin-fecha'] as const) {
  test(`historial sin procedencia válida no atribuye aprobación: ${variant}`, async () => {
    const { getAutomationPortfolioMetrics } = await reportsCalculations();
    const badRun = { ...run, ...(variant === 'otro-sprint' ? { sprint: '8' } : variant === 'borrador' ? { status: types.ExecutionStatus.DRAFT } : variant === 'otro-tipo' ? { testType: types.TestType.UAT } : variant === 'caso-no-incluido' ? { results: [] } : {}) };
    const badHistory = { ...history, ...(variant === 'otro-run' ? { testRunId: 'not-the-run' } : variant === 'otro-caso' ? { matchedCases: [{ testCaseId: 'missing', status: types.AutomationResultStatus.PASSED }] } : variant === 'sin-fecha' ? { importedAt: '' } : {}) };
    const metrics = getAutomationPortfolioMetrics([functionality], [caseFor()], { sprint: '7', runs: [badRun], histories: [badHistory] });
    assert.equal(metrics.successByTool[0]?.successRate, null);
  });
}

test('la última observación por caso/herramienta evita duplicar importaciones y conserva herramientas distintas', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const failed = { ...history, id: 'new', importedAt: '2026-10-20T11:00:00Z', matchedCases: [{ testCaseId: 'TC-1', status: types.AutomationResultStatus.FAILED }] };
  const cypress = { ...history, id: 'cypress', tool: types.AutomationTool.CYPRESS };
  const metrics = getAutomationPortfolioMetrics([functionality], [caseFor()], { sprint: '7', runs: [run], histories: [failed, history, cypress, history] });
  assert.equal(metrics.successByTool.find((row: any) => row.tool === types.AutomationTool.PLAYWRIGHT)?.successRate, 0);
  assert.equal(metrics.successByTool.find((row: any) => row.tool === types.AutomationTool.PLAYWRIGHT)?.total, 1);
  assert.equal(metrics.successByTool.find((row: any) => row.tool === types.AutomationTool.CYPRESS)?.successRate, 100);
});

test('no crea asociaciones por nombre, no inventa herramienta ni datos para casos vacíos', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const unlinked = getAutomationPortfolioMetrics([functionality], [caseFor({ functionalityId: 'missing', automationTool: undefined })], { sprint: '7' });
  assert.equal(unlinked.scopedTestCases.length, 0);
  assert.equal(unlinked.moduleCoverage.length, 0);
  assert.equal(unlinked.successByTool.length, 0);
  const empty = getAutomationPortfolioMetrics([], []);
  assert.equal(empty.functionalityCoverage.length, 0);
  assert.equal(empty.successByTool.length, 0);
});

test('snapshot global conserva aprobadas y fallidas, pero sin herramienta no inventa una', async () => {
  const { getAutomationPortfolioMetrics } = await reportsCalculations();
  const metrics = getAutomationPortfolioMetrics([functionality], [caseFor({ lastAutomationStatus: types.AutomationResultStatus.PASSED }), caseFor({ id: 'case-2', documentId: 'case-2-doc', lastAutomationStatus: types.AutomationResultStatus.FAILED }), caseFor({ id: 'case-3', documentId: 'case-3-doc', automationTool: undefined, lastAutomationStatus: types.AutomationResultStatus.PASSED })]);
  assert.equal(metrics.successByTool.length, 1);
  assert.equal(metrics.successByTool[0]?.successRate, 50);
  assert.equal(metrics.successByTool[0]?.total, 2);
});
