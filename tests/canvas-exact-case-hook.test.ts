import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { canManageCanvas } from '../src/modules/canvas/hooks/canvasUiModel';
import { saveBatch } from '../src/modules/test-cases/utils/saveBatch';

function hook(scope?: string) {
  const source = fs.readFileSync(path.resolve('src/modules/test-cases/hooks/useTestCases.ts'), 'utf8');
  const ast = ts.createSourceFile('hook.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'useTestCases')!;
  const code = ts.transpileModule(declaration.getText(ast).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const reads: any[] = [], saves: any[] = [], candidates: any[] = [], queries: any[] = [];
  const ctx = vm.createContext({
    useRef: (value: any) => ({ current: value }),
    useState: (value: any) => [value, () => {}],
    useEffect: (effect: () => unknown) => { effect(); },
    isAxiosError: (error: any) => error?.isAxiosError === true,
    useQueryClient: () => ({ invalidateQueries: async () => {}, setQueryData: () => {} }),
    useQuery: (options: any) => { queries.push(options); return {}; },
    useMutation: (options: any) => ({ mutate: options.mutationFn, mutateAsync: options.mutationFn }),
    getTestCases: async (...args: any[]) => { reads.push(args); return []; },
    saveTestCase: async (...args: any[]) => { saves.push(args); return args[0]; },
    markManualCasesAsCandidates: async (...args: any[]) => { candidates.push(args); return []; },
    removeTestCase: () => {}, reorderTestCases: () => {}, invalidateWorkspaceCache: () => {}, saveBatch,
  });
  vm.runInContext(code, ctx);
  const result = ctx.useTestCases('PROJECT-A', 'SAME', scope);
  return { result, reads, saves, candidates, queries };
}
test('exact hook isolates query cache and passes exact scope through every save entry point', async () => {
  const h = hook('func-b');
  await h.queries[0].queryFn();
  assert.equal(h.reads[0][2], 'func-b');
  assert.ok(h.queries[0].queryKey.includes('func-b'));
  await h.result.save({ id: 'one' });
  await h.result.saveAsync({ id: 'two' });
  await h.result.savePastedCases([{ id: 'three' }]);
  await h.result.saveManyWithSingleRefresh([{ id: 'four' }]);
  assert.equal(h.saves.length, 4);
  for (const args of h.saves) assert.equal(args[1], 'func-b');
  await h.result.markManualCandidates(['SAME'], ['one']);
  assert.equal(h.candidates[0][3], 'func-b');
});
test('legacy hook keeps its existing query key and unscoped saves', async () => {
  const h = hook();
  assert.deepEqual(Array.from(h.queries[0].queryKey), ['test-cases', 'PROJECT-A', 'SAME']);
  await h.result.saveAsync({ id: 'one' });
  assert.equal(h.saves[0][1], undefined);
});
test('real case editor forwards exact parent and false readOnly cannot escalate a viewer', () => {
  const source = fs.readFileSync(path.resolve('src/components/TestCaseManagement.tsx'), 'utf8');
  const ast = ts.createSourceFile('editor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let call: ts.CallExpression | undefined, viewer: ts.Expression | undefined;
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === 'useTestCases') call = n;
    if (ts.isVariableDeclaration(n) && n.name.getText(ast) === 'isViewer') viewer = n.initializer;
    ts.forEachChild(n, visit);
  }
  visit(ast);
  assert.equal(call?.arguments[2]?.getText(ast), 'functionalityDocumentId');
  assert.ok(source.includes('functionalityDocumentId?: string'));
  for (const [workspaceIsViewer, readOnly, expected] of [[true, false, true], [true, undefined, true], [false, true, true], [false, false, false]]) {
    assert.equal(Boolean(vm.runInNewContext(viewer!.getText(ast), { workspaceIsViewer, readOnly, organizationDocumentId: undefined })), expected);
  }
  for (const [role, workspaceIsViewer, readOnly, workspaceIsError, expected] of [
    ['viewer', false, false, false, true],
    ['owner', true, false, false, false],
    ['owner', false, true, false, true],
    ['owner', false, false, true, true],
  ] as const) {
    const workspaceData = { memberships: [
      { organization: { documentId: 'unrelated-org' }, role: { code: 'owner' } },
      { organization: { documentId: 'target-org' }, role: { code: role } },
    ] };
    assert.equal(Boolean(vm.runInNewContext(viewer!.getText(ast), {
      workspaceIsViewer, readOnly, workspaceIsError, organizationDocumentId: 'target-org', workspaceData, canManageCanvas,
    })), expected);
  }
});
