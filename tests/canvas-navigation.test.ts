import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function declaration(name: string): string {
  let result = '';
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      result = `const ${node.getText(ast)};`;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, `Missing actual App declaration ${name}`);
  return result;
}
function run(code: string, context: Record<string, unknown> = {}) {
  const javascript = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  return vm.runInNewContext(javascript, context);
}

test('Canvas is a real project route, without changing existing routes', () => {
  const result = run([
    declaration('WORKSPACE_VIEW_TO_PATH'), declaration('SCENE_TO_WORKSPACE_VIEW'),
    declaration('routeForProjectWorkspace'), declaration('decodePathSegment'), declaration('parseRoute'),
    `({ path: routeForProjectWorkspace('PROJ A', 'canvas'), scene: SCENE_TO_WORKSPACE_VIEW.canvas,
      oldPath: routeForProjectWorkspace('PROJ A', 'functionalities'),
      parsed: parseRoute('/projects/PROJ%20A/canvas') })`,
  ].join('\n'));
  assert.equal(result.path, '/projects/PROJ%20A/canvas');
  assert.equal(result.scene, 'canvas');
  assert.equal(result.oldPath, '/projects/PROJ%20A/functionalities');
  assert.equal(result.parsed.projectId, 'PROJ A');
});

test('Canvas exists exactly once under Más after Configuración and Acerca de', () => {
  const React = { createElement: () => ({}) };
  const icons = ['AppstoreOutlined', 'ClipboardList', 'CheckCircleOutlined', 'ListTree',
    'BarChartOutlined', 'HistoryOutlined', 'ThunderboltOutlined', 'SettingOutlined',
    'InfoCircleOutlined', 'LayoutOutlined', 'ClusterOutlined'];
  for (const canAccessSettings of [true, false]) {
    const context = {
      React, useMemo: (callback: () => unknown) => callback(), t: (key: string) => key,
      canAccessSettings, hasRegressionLegacy: false, hasSmokeLegacy: false,
      ...Object.fromEntries(icons.map(name => [name, () => null])),
    };
    const menu = run(`${declaration('workspaceMenuItems')}\nworkspaceMenuItems`, context);
    assert.equal(menu.filter((entry: { key: string }) => entry.key === 'canvas').length, 0);
    const more = menu.find((entry: { key: string }) => entry.key === 'more');
    assert.ok(more);
    assert.equal(more.children.filter((entry: { key: string }) => entry.key === 'canvas').length, 1);
    const keys = more.children.map((entry: { key: string }) => entry.key);
    assert.ok(keys.indexOf('canvas') > keys.indexOf('about'));
    if (canAccessSettings) assert.ok(keys.indexOf('canvas') > keys.indexOf('config'));
  }
});
