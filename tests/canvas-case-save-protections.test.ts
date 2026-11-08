import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { saveBatch } from '../src/modules/test-cases/utils/saveBatch';

function fixture(saveTestCase: (...args: any[]) => Promise<any>, read = async () => [] as any[]) {
  const source = fs.readFileSync('src/modules/test-cases/hooks/useTestCases.ts', 'utf8');
  const ast = ts.createSourceFile('hook.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'useTestCases')!;
  const cleanups: Array<() => void> = [];
  const context = vm.createContext({
    useEffect: (effect: () => (() => void)) => { cleanups.push(effect()); },
    useRef: (value: any) => ({ current: value }), useState: (value: any) => [value, () => {}],
    useQueryClient: () => ({ invalidateQueries: async () => {}, setQueryData: () => {} }),
    useQuery: () => ({}), useMutation: (options: any) => ({ mutate: options.mutationFn, mutateAsync: options.mutationFn }),
    saveTestCase, getTestCases: read, saveBatch, isAxiosError: (e: any) => e?.isAxiosError,
    markManualCasesAsCandidates: async () => ({}), removeTestCase: async () => {}, reorderTestCases: async () => [], invalidateWorkspaceCache: () => {},
  });
  vm.runInContext(ts.transpileModule(declaration.getText(ast).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return Object.assign(context.useTestCases('PROJECT', 'SAME', 'func-b', () => {}), { unmount: () => cleanups.forEach(cleanup => cleanup?.()) });
}
test('exact editor serializes single and batch writes synchronously', async () => {
  let release!: () => void, writes = 0;
  const h = fixture(async value => { writes++; await new Promise<void>(resolve => { release = resolve; }); return value; });
  const first = h.saveAsync({ id: 'one' });
  await assert.rejects(Promise.race([h.saveAsync({ id: 'two' }), new Promise((_, reject) => setTimeout(() => reject(new Error('duplicate write was not rejected')), 50))]), /pendiente|pending/i);
  await assert.rejects(h.savePastedCases([{ id: 'three' }]), /pendiente|pending/i);
  assert.equal(writes, 1); release(); await first;
});
test('uncertain write blocks until explicit successful reconciliation, never automatic invalidation', async () => {
  let writes = 0, failRead = true;
  const h = fixture(async () => { writes++; throw { isAxiosError: true, response: { status: 409 } }; }, async () => { if (failRead) throw new Error('offline'); return []; });
  await assert.rejects(h.saveAsync({ id: 'one' }));
  await assert.rejects(h.saveAsync({ id: 'two' }), /recarg|reconcil/i);
  await assert.rejects(h.reconcileWrites(), /offline/);
  await assert.rejects(h.saveAsync({ id: 'two' }), /recarg|reconcil/i);
  assert.equal(writes, 1); failRead = false; await h.reconcileWrites();
  await assert.rejects(h.saveAsync({ id: 'two' })); assert.equal(writes, 2);
});

test('editor unmount cancels a save waiting on async preflight even while parent workspace stays active', async () => {
  let release!: () => void, writes = 0;
  const h = fixture(async (_value, _scope, assertActive) => {
    await new Promise<void>(resolve => { release = resolve; });
    assertActive(); writes++;
  });
  const pending = h.saveAsync({ id: 'one' });
  h.unmount(); release();
  await assert.rejects(pending, /cerrad|disposed|activo/i);
  assert.equal(writes, 0);
});

test('known prewrite 403 permits correction; timeout, server and transport errors require reconciliation', async () => {
  for (const status of [403, 408, 500, 503, undefined]) {
    let writes = 0;
    const h = fixture(async value => { if (++writes === 1) throw { isAxiosError: true, response: status ? { status } : undefined }; return value; });
    await assert.rejects(h.saveAsync({ id: 'one' }));
    if (status === 403) await h.saveAsync({ id: 'two' });
    else await assert.rejects(h.saveAsync({ id: 'two' }), /recarg|reconcil/i);
    assert.equal(writes, status === 403 ? 2 : 1);
  }
});
test('ambiguous paste stops before later cases and blocks every save entry point', async () => {
  let writes = 0;
  const h = fixture(async value => { if (++writes === 2) throw new Error('uncertain readback'); return value; });
  const result = await h.savePastedCases([{ id: 'one' }, { id: 'two' }, { id: 'three' }]);
  assert.equal(result.confirmed.length, 1); assert.equal(result.pending.length, 2);
  assert.equal(result.failed.ambiguous, true); assert.equal(writes, 2);
  await assert.rejects(h.saveManyWithSingleRefresh([{ id: 'four' }]), /recarg|reconcil/i);
  await assert.rejects(h.markManualCandidates(['SAME'], ['one']), /recarg|reconcil/i);
  await assert.rejects(h.reorder([{ documentId: 'one', sortOrder: 2 }]), /fuera de Canvas/i);
  await assert.rejects(h.delete('one'), /fuera de Canvas/i);
  assert.equal(writes, 2);
});
