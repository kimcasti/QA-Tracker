import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const boardModule = await import('../src/modules/canvas/components/CanvasBoard.tsx').catch(() => null);

const model = await import('../src/modules/canvas/hooks/canvasUiModel.ts').catch(() => null);

test('Canvas serializes writes and publishes only a verified readback', async () => {
  assert.ok(model?.CanvasWriteGate, 'CanvasWriteGate must exist');
  const gate = new model.CanvasWriteGate();
  let release!: () => void;
  let writes = 0;
  const pending = gate.run(async () => { writes++; await new Promise<void>(resolve => { release = resolve; }); return 'verified'; });
  await assert.rejects(gate.run(async () => { writes++; }), /guardado/i);
  assert.equal(gate.pending, true);
  assert.equal(writes, 1);
  release();
  assert.equal(await pending, 'verified');
  assert.equal(gate.pending, false);
});

test('conflicts and uncertain transport lock all writes until explicit refresh', async () => {
  for (const error of [{ response: { status: 409 } }, new Error('transport'), { response: { status: 503 } }]) {
    const gate = new model!.CanvasWriteGate();
    await assert.rejects(gate.run(async () => { throw error; }));
    assert.equal(gate.blocked, true);
    let repeated = false;
    await assert.rejects(gate.run(async () => { repeated = true; }), /recarga/i);
    assert.equal(repeated, false);
    gate.reset();
    assert.equal(await gate.run(async () => 'fresh'), 'fresh');
  }
});

test('disposed project callbacks cannot issue a write', async () => {
  const gate = new model!.CanvasWriteGate();
  gate.dispose();
  let wrote = false;
  await assert.rejects(gate.run(async () => { wrote = true; }), /proyecto/i);
  assert.equal(wrote, false);
});

const catalog: any = { modules: [{ documentId: 'm1', name: 'Accounts' }], functionalities: [{ documentId: 'f1', code: 'F-1', name: 'Register', moduleDocumentId: 'm1' }], cases: [{ documentId: 'c1', title: 'Exact case', functionalityDocumentId: 'f1', functionalityCode: 'F-1' }], sprints: [] };
const state: any = { version: 1, nodes: {}, notes: [], newElementColor: 'default' };
function renderBoard(changes: any = {}) {
  assert.ok(boardModule?.CanvasBoard, 'CanvasBoard must exist');
  return renderToStaticMarkup(React.createElement(boardModule.CanvasBoard, { projectId: 'project-a', catalog, state, canEdit: false, busy: false, expanded: {}, ...changes }));
}
test('real board renders project records with cases initially collapsed', () => {
  const html = renderBoard();
  assert.match(html, /Accounts/);
  assert.match(html, /Register/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /1 caso/);
  assert.doesNotMatch(html, /Exact case/);
  assert.doesNotMatch(html, /Editar funcionalidad|Color de|draggable="true"/);
});
test('expanded case links address the exact project functionality and case', () => {
  const html = renderBoard({ expanded: { f1: true } });
  assert.match(html, /Exact case/);
  assert.match(html, /\/projects\/project-a\/canvas\?case=c1&amp;functionality=F-1/);
});

test('only free notes become cards and related notes expose a count icon', () => {
  const html = renderBoard({ state: { ...state, notes: [{ id: 'n1', html: '<p>Free body</p>' }, { id: 'n2', html: '<p>Hidden body</p>', anchorId: 'functionality:f1' }] } });
  assert.match(html, /Free body/);
  assert.doesNotMatch(html, /Hidden body/);
  assert.match(html, /Notas de Register \(1\)/);
});
test('editor cards retain explicit actions and independent pastel visual headers', () => {
  const html = renderBoard({ canEdit: true, state: { ...state, nodes: { 'module:m1': { x: 40, y: 50, color: 'pink' }, 'functionality:f1': { x: 410, y: 50, color: 'green' } } } });
  assert.match(html, /Editar funcionalidad Register/);
  assert.match(html, /Color de Accounts/);
  assert.match(html, /Agregar casos de prueba/);
  assert.match(html, /data-color="pink"/);
  assert.match(html, /data-color="green"/);
  assert.match(html, /<path/);
});
test('permissions use exact target organization rather than the first membership', () => {
  assert.equal(model!.canManageCanvas('b', [{ organization: { documentId: 'a' }, role: { code: 'owner' } }, { organization: { documentId: 'b' }, role: { code: 'viewer' } }]), false);
  assert.equal(model!.canManageCanvas('b', [{ organization: { documentId: 'a' }, role: { code: 'viewer' } }, { organization: { documentId: 'b' }, role: { code: 'qa-engineer' } }]), true);
});
test('arrange respects measured expanded card heights and module membership', () => {
  const positions = model!.arrangeCanvas(catalog, state, { 'functionality:f1': 600 });
  assert.equal(positions['functionality:f1'].x > positions['module:m1'].x, true);
  const withSecond = { ...catalog, functionalities: [...catalog.functionalities, { documentId: 'f2', name: 'Second', code: 'F-2', moduleDocumentId: 'm1' }] };
  const arranged = model!.arrangeCanvas(withSecond, state, { 'functionality:f1': 600 });
  assert.equal(arranged['functionality:f2'].y >= arranged['functionality:f1'].y + 628, true);
});
