import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { CanvasWriteGate } from '../src/modules/canvas/hooks/canvasUiModel';

test('Canvas case editor receives verified organization and blocked state as readonly', () => {
  const source = fs.readFileSync(path.resolve('src/modules/canvas/CanvasWorkspace.tsx'), 'utf8');
  const ast = ts.createSourceFile('CanvasWorkspace.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const props: Record<string, string> = {};
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'TestCaseManagement') {
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.initializer && ts.isJsxExpression(prop.initializer)) {
          props[prop.name.getText(ast)] = prop.initializer.expression!.getText(ast);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(props.organizationDocumentId, 'case editor must receive verified target organization');
  assert.equal(vm.runInNewContext(props.organizationDocumentId, { data: { context: { organizationDocumentId: 'org-b' } } }), 'org-b');
  for (const canEdit of [true, false]) for (const busy of [true, false]) {
    assert.equal(vm.runInNewContext(props.readOnly, { canEdit, busy }), !canEdit || busy);
  }
});

function refreshHandler() {
  const source = fs.readFileSync(path.resolve('src/modules/canvas/CanvasWorkspace.tsx'), 'utf8');
  const ast = ts.createSourceFile('CanvasWorkspace.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration = '';
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'refresh') declaration = node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(declaration);
  return ts.transpileModule(`${declaration}\nrefresh()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

test('failed manual refresh blocks every write until a successful fresh read resets the gate', async () => {
  const gate = new CanvasWriteGate();
  let unavailable = true, pending = false, writes = 0, error = '', notices = 0;
  const context = {
    gate, clearEditors() {}, setError(value: string) { error = value; },
    setPending(value: boolean) { pending = value; }, setNotice() { notices++; },
    async fresh() { if (unavailable) throw new Error('Synthetic unavailable'); },
  };
  const handler = refreshHandler();
  await vm.runInNewContext(handler, context);
  assert.equal(pending, false);
  assert.equal(gate.blocked, true, 'cached catalog must not become writable after a failed refresh');
  await assert.rejects(gate.run(async () => { writes++; }));
  assert.equal(writes, 0);
  assert.ok(error);
  assert.equal(notices, 0);
  await vm.runInNewContext(handler, context);
  assert.equal(gate.blocked, true, 'another failed refresh must not unlock writes');
  unavailable = false;
  await vm.runInNewContext(handler, context);
  assert.equal(gate.blocked, false);
  await gate.run(async () => { writes++; });
  assert.equal(writes, 1);
  assert.equal(notices, 1);
});

test('workspace forwards one stable live-project guard to every mutator and the case editor', () => {
  const source = fs.readFileSync(path.resolve('src/modules/canvas/CanvasWorkspace.tsx'), 'utf8');
  const ast = ts.createSourceFile('CanvasWorkspace.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const mutators = new Set(['saveCanvas', 'saveCanvasModule', 'saveCanvasFunctionality', 'createCanvasCases']);
  const seen = new Set<string>();
  let guard: ts.Expression | undefined, caseGuard = '';
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && mutators.has(node.expression.getText(ast))) {
      const name = node.expression.getText(ast);
      assert.equal(node.arguments.at(-1)?.getText(ast), 'assertWriteActive', `${name} must recheck active project immediately before writing`);
      seen.add(name);
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'assertWriteActive') guard = node.initializer;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'TestCaseManagement') {
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'assertWriteActive' && prop.initializer && ts.isJsxExpression(prop.initializer)) caseGuard = prop.initializer.expression!.getText(ast);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.deepEqual([...seen].sort(), [...mutators].sort());
  assert.equal(caseGuard, 'assertWriteActive');
  assert.ok(guard);
  const gate = new CanvasWriteGate();
  const assertWriteActive = vm.runInNewContext(guard!.getText(ast), { gate, useMemo: (create: () => unknown) => create() });
  assert.doesNotThrow(assertWriteActive);
  gate.dispose();
  assert.throws(assertWriteActive, /proyecto cambió/);
});
