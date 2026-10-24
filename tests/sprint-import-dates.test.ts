import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/modules/settings/services/settingsService.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('service.ts', source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'saveSprint')!;
const compiled = ts.transpile(declaration.getText(ast).replace('export ', ''), { target: ts.ScriptTarget.ES2022 });

test('mapSprint normalizes absent API dates so dayjs cannot invent today', () => {
  const node = ast.statements.find(item => ts.isFunctionDeclaration(item) && item.name?.text === 'mapSprint')!;
  const code = ts.transpile(node.getText(ast), { target: ts.ScriptTarget.ES2022 });
  const context = vm.createContext({ sprintStatusFromApi: () => 'Planeado' });
  vm.runInContext(code, context);
  for (const missing of [undefined, null]) {
    const mapped = context.mapSprint({ documentId: 's', name: 'Sprint undated', startDate: missing, endDate: missing });
    assert.equal(mapped.startDate, '');
    assert.equal(mapped.endDate, '');
  }
  const dated = context.mapSprint({ documentId: 's', name: 'Sprint dated', startDate: '2026-10-01', endDate: '2026-10-15' });
  assert.equal(dated.startDate, '2026-10-01');
  assert.equal(dated.endDate, '2026-10-15');
});

test('saveSprint omits unavailable dates instead of sending invalid empty API dates', async () => {
  let payload: any;
  const context = vm.createContext({
    findProjectContext: async () => ({ documentId: 'p', organizationDocumentId: 'o' }),
    requireProjectId: (id: string) => id,
    listDocuments: async () => [],
    upsertDocument: async (_url: string, _id: string, data: unknown) => { payload = data; return data; },
    sprintStatusToApi: () => 'planned', relation: (id: string) => id, mapSprint: (item: unknown) => item,
  });
  vm.runInContext(compiled, context);
  await context.saveSprint({ id: '', projectId: 'P', name: 'Sprint new', startDate: '', endDate: '', status: 'Planeado' });
  assert.equal(Object.hasOwn(payload, 'startDate'), false);
  assert.equal(Object.hasOwn(payload, 'endDate'), false);
  await context.saveSprint({ id: '', projectId: 'P', name: 'Sprint dated', startDate: '2026-10-01', endDate: '2026-10-15', status: 'Planeado' });
  assert.equal(payload.startDate, '2026-10-01');
  assert.equal(payload.endDate, '2026-10-15');
});
