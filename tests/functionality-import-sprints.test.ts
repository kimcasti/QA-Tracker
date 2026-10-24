import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { syncImportedSprints } from '../src/modules/settings/services/importedSprints';
import { calculateRiskLevel } from '../src/modules/functionalities/utils/riskMatrix';
import { ImpactLevel, ProbabilityLevel, TestStatus, Priority, RiskLevel, TestType } from '../src/types';
import type { Functionality, Sprint } from '../src/types';

// Run the actual file handler, its row mappers and its useSprints binding. No
// component rendering, dotenv, service bootstrap, HTTP transport or sockets.
const source = ts.createSourceFile('FunctionalityList.tsx', readFileSync(
  new URL('../src/components/FunctionalityList.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'FunctionalityList');
assert.ok(component?.body, 'real FunctionalityList component must be found');
const handler = component.body.statements.find(node => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'handleImport'));
assert.ok(handler, 'real file import handler must be extracted');
const sprintHook = component.body.statements.find(node => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some(declaration => declaration.initializer &&
    ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(source) === 'useSprints'));
assert.ok(sprintHook, 'real useSprints destructuring must be extracted');
const helperNames = [
  'getImportedFieldValue', 'normalizeImportedStatus', 'normalizeImportedPriority',
  'normalizeImportedImpactLevel', 'normalizeImportedProbabilityLevel', 'parseBooleanLike',
  'normalizeComparableText', 'resolveImportedSprint', 'isJiraImportedRow',
  'resolveImportedJiraTaskUrl', 'mapImportedRowsToFunctionalities', 'resolveImportedFunctionalityIds',
];
const helpers = helperNames.map(name => {
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `real ${name} declaration must be extracted`);
  return declaration.getText(source);
}).join('\n');
const code = ts.transpileModule(`${helpers}\n${sprintHook.getText(source)}\n${handler.getText(source)}\nhandleImport;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const hasSyncImport = source.statements.some(node => ts.isImportDeclaration(node) &&
  ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith('/importedSprints') &&
  node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
  node.importClause.namedBindings.elements.some(item => item.name.text === 'syncImportedSprints'));

const rows = [
  { 'Issue key': 'SYN-1', Summary: 'Synthetic new sprint', Sprint: ' sprint NEW ' },
  { 'Issue key': 'SYN-2', Summary: 'Synthetic same sprint', Sprint: 'SPRINT   new' },
  { 'Issue key': 'SYN-3', Summary: 'Synthetic existing sprint', Sprint: 'SPRINT EXISTING' },
];
const sprint = (name: string): Sprint => ({ id: name, projectId: 'project-synthetic', name,
  startDate: '', endDate: '', status: 'Planeado', objective: '' });

function harness(failure?: 'list' | 'create' | 'readback' | 'unverified') {
  const events: string[] = [];
  const writes: Sprint[] = [];
  const imports: Functionality[][] = [];
  const notices: Array<{ type: string; content: unknown }> = [];
  const modals: Array<{ content: unknown }> = [];
  const errors: unknown[][] = [];
  const busy: boolean[] = [];
  const stored = [sprint('Sprint existing')];
  let reads = 0;
  let reader: Reader | undefined;
  class Reader {
    onload?: (event: { target: { result: string } }) => Promise<void>;
    file?: File;
    constructor() { reader = this; }
    readAsText(file: File) { this.file = file; }
    readAsArrayBuffer() { assert.fail('TXT fixture must use readAsText'); }
  }
  const refetch = async () => {
    reads += 1;
    events.push(reads === 1 ? 'list' : 'readback');
    if (failure === 'list' || (failure === 'readback' && reads > 1)) {
      return { data: undefined, error: new Error('Synthetic sprint read failed') };
    }
    return { data: stored.map(item => ({ ...item })), error: null };
  };
  const save = async (item: Sprint) => {
    events.push('create');
    writes.push(item);
    if (failure === 'create') throw new Error('Synthetic sprint create failed');
    const created = { ...item, id: 'new-sprint', name: 'Sprint NEW' };
    if (failure !== 'unverified') stored.push(created);
    return created;
  };
  const handleImport = runInNewContext(code, {
    FileReader: Reader, projectId: 'project-synthetic',
    useSprints: (projectId: string) => {
      assert.equal(projectId, 'project-synthetic');
      return { data: [], refetch, save };
    },
    // Deliberately stale hook cache: the handler must use verified fresh names.
    configuredSprintNames: [], allFunctionalities: [],
    ...(hasSyncImport ? { syncImportedSprints } : {}),
    calculateRiskLevel, ImpactLevel, ProbabilityLevel, TestStatus, Priority, RiskLevel, TestType,
    toApiError: (error: Error) => ({ message: error.message }),
    buildNextFunctionalityCode: () => assert.fail('unique synthetic issue keys need no generated IDs'),
    bulkAdd: async (items: Functionality[]) => {
      events.push('bulkAdd');
      imports.push(items);
      return items.length;
    },
    setIsImporting: (value: boolean) => busy.push(value),
    message: {
      open: (notice: { type: string; content: unknown }) => notices.push(notice),
      destroy: () => {},
      warning: (content: unknown) => notices.push({ type: 'warning', content }),
      error: (content: unknown) => notices.push({ type: 'error', content }),
    },
    Modal: { info: (modal: { content: unknown }) => modals.push(modal) },
    React: { createElement: (_type: unknown, _props: unknown, ...children: unknown[]) => ({ children }) },
    console: { error: (...args: unknown[]) => errors.push(args) },
  }) as (file: File) => boolean;
  return {
    events, writes, imports, notices, modals, errors, busy,
    async upload() {
      const file = new File([JSON.stringify(rows)], 'synthetic-sprints.txt', { type: 'text/plain' });
      assert.equal(handleImport(file), false, 'Upload must not submit the file automatically');
      assert.ok(reader?.onload, 'actual handler must register FileReader.onload');
      assert.equal(reader.file, file);
      await reader.onload({ target: { result: await file.text() } });
    },
  };
}

function visibleText(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(visibleText).join(' ');
  if (typeof value === 'object' && 'children' in value) return visibleText(value.children);
  return '';
}

test('actual TXT import lists, creates once and verifies canonical sprints before bulkAdd', async t => {
  const h = harness();
  await h.upload();
  assert.deepEqual(h.events, ['list', 'create', 'readback', 'bulkAdd']);
  assert.equal(h.writes.length, 1, 'case/whitespace variants must create a single sprint');
  assert.equal(h.writes[0].projectId, 'project-synthetic');
  assert.equal(h.imports.length, 1);
  assert.deepEqual(Array.from(h.imports[0], item => item.sprint), ['Sprint NEW', 'Sprint NEW', 'Sprint existing']);
  const summary = h.modals.map(modal => visibleText(modal.content)).join(' ');
  assert.doesNotMatch(summary, /no existe en la configuraci[oó]n|requieren revisi[oó]n manual/i);
  assert.match(summary, /1\s+sprints?\s+cread[oa]s?/i, 'summary must disclose exactly one created sprint');
  assert.equal(h.notices.filter(notice => notice.type === 'warning' || notice.type === 'error').length, 0);
  assert.equal(h.errors.length, 0);
  assert.deepEqual(h.busy, [true, false]);
  t.diagnostic(JSON.stringify({ events: h.events, assignedSprints: h.imports[0].map(item => item.sprint), summary }));
});

for (const failure of ['list', 'create', 'readback', 'unverified'] as const) {
  test(`actual TXT import blocks bulkAdd when sprint sync fails: ${failure}`, async t => {
    const h = harness(failure);
    await h.upload();
    assert.equal(h.imports.length, 0, 'no functionality write is allowed before successful sprint verification');
    assert.deepEqual(h.events, failure === 'list' ? ['list'] : failure === 'create'
      ? ['list', 'create'] : ['list', 'create', 'readback']);
    assert.equal(h.notices.filter(notice => notice.type === 'success').length, 0);
    assert.equal(h.notices.filter(notice => notice.type === 'error').length, 1);
    assert.equal(h.modals.length, 0);
    assert.equal(h.errors.length, 1);
    assert.deepEqual(h.busy, [true, false]);
    t.diagnostic(JSON.stringify({ failure, events: h.events, functionalityWrites: h.imports.length }));
  });
}
