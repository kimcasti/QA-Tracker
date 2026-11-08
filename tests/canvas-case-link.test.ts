import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { canManageCanvas } from '../src/modules/canvas/hooks/canvasUiModel';

function viewerExpression() {
  const source = fs.readFileSync(path.resolve('src/components/TestCaseManagement.tsx'), 'utf8');
  const ast = ts.createSourceFile('TestCaseManagement.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'isViewer') expression = node.initializer!.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(expression);
  return ts.transpileModule(`(${expression})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}

const membership = (org: string, code: string) => ({ organization: { documentId: org }, role: { code } });

test('Canvas owner in target B can edit regardless of viewer A membership order', () => {
  const js = viewerExpression();
  for (const memberships of [
    [membership('org-a', 'viewer'), membership('org-b', 'owner')],
    [membership('org-b', 'owner'), membership('org-a', 'viewer')],
  ]) {
    const isViewer = vm.runInNewContext(js, {
      organizationDocumentId: 'org-b', workspaceData: { memberships }, workspaceIsError: false,
      workspaceIsViewer: memberships[0].role.code === 'viewer', readOnly: false, canManageCanvas,
    });
    assert.equal(isViewer, false, 'unrelated viewer membership must not override target owner');
    const ctx = context({ isViewer }); vm.runInNewContext(initialCaseEffect(), ctx);
    assert.equal(ctx.opened.length, 1);
  }
});

test('target viewer, missing membership, missing organization and failed access remain readonly', () => {
  const js = viewerExpression();
  const base = { organizationDocumentId: 'org-b', workspaceData: { memberships: [membership('org-b', 'owner')] },
    workspaceIsError: false, workspaceIsViewer: false, readOnly: false, canManageCanvas };
  for (const changes of [
    { workspaceData: { memberships: [membership('org-a', 'owner'), membership('org-b', 'viewer')] } },
    { workspaceData: { memberships: [membership('org-b', 'viewer'), membership('org-a', 'owner')] }, workspaceIsViewer: true },
    { workspaceData: { memberships: [membership('org-a', 'owner')] } },
    { workspaceData: undefined }, { organizationDocumentId: '' }, { workspaceIsError: true }, { readOnly: true },
  ]) {
    const isViewer = vm.runInNewContext(js, { ...base, ...changes });
    assert.equal(isViewer, true);
    const ctx = context({ isViewer }); vm.runInNewContext(initialCaseEffect(), ctx);
    assert.equal(ctx.opened.length, 0);
  }
});

test('non-Canvas editor retains legacy viewer behavior and explicit readonly cannot elevate', () => {
  const js = viewerExpression();
  for (const workspaceIsViewer of [false, true]) for (const readOnly of [undefined, false, true]) {
    assert.equal(vm.runInNewContext(js, { organizationDocumentId: undefined, workspaceIsViewer, readOnly }),
      workspaceIsViewer || readOnly === true);
  }
});

function initialCaseEffect() {
  const source = fs.readFileSync(path.resolve('src/components/TestCaseManagement.tsx'), 'utf8');
  const ast = ts.createSourceFile('TestCaseManagement.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect = '';
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
        node.arguments[0]?.getText(ast).includes('initialCaseId')) {
      effect = node.arguments[0].getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(effect, 'Initial Canvas case link must open the existing case editor');
  return ts.transpileModule(`(${effect})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
function context(overrides: Record<string, unknown> = {}) {
  const opened: unknown[] = [];
  return {
    initialCaseId: 'case1', initialCaseOpened: { current: false }, projectId: 'PROJECT-A',
    functionalityId: 'FUNC-1', isViewer: false, isLoading: false, isError: false,
    testCases: [{ id: 'case1', documentId: 'case1', projectId: 'PROJECT-A', functionalityId: 'FUNC-1' }],
    openCaseForm: (item: unknown) => opened.push(item), opened, ...overrides,
  };
}
test('Canvas case link opens the exact persisted case once through the existing editor', () => {
  const js = initialCaseEffect(), ctx = context();
  vm.runInNewContext(js, ctx); vm.runInNewContext(js, ctx);
  assert.equal(ctx.opened.length, 1);
  assert.equal((ctx.opened[0] as { documentId: string }).documentId, 'case1');
});
test('Case link cannot open a foreign project, foreign functionality, viewer, loading or failed case', () => {
  const js = initialCaseEffect();
  for (const changes of [
    { isViewer: true }, { isLoading: true }, { isError: true },
    { projectId: 'PROJECT-B' }, { functionalityId: 'FUNC-2' }, { initialCaseId: 'missing' },
  ]) {
    const ctx = context(changes); vm.runInNewContext(js, ctx);
    assert.equal(ctx.opened.length, 0);
  }
});
