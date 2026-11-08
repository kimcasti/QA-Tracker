import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CanvasBoard } from '../src/modules/canvas/components/CanvasBoard';
import type { BoardProps } from '../src/modules/canvas/components/CanvasBoard';

const props: BoardProps = {
  projectId: 'project-a', canEdit: true, busy: false, expanded: {},
  catalog: { modules: [{ documentId: 'm1', name: 'Accounts' }], functionalities: [{ documentId: 'f1', code: 'F-1', name: 'Register', moduleDocumentId: 'm1' }, { documentId: 'f2', code: 'F-2', name: 'Unlinked' }], cases: [{ documentId: 'c1', title: 'Exact case', functionalityDocumentId: 'f1', functionalityCode: 'F-1', testCase: {} as never }], sprints: [] },
  state: { version: 1, newElementColor: 'default', nodes: {}, notes: [{ id: 'free', html: '<p><strong>Free body</strong></p>' }, { id: 'related', anchorId: 'case:c1', html: '<p>Secret related body</p>' }] },
};
const render = (overrides: Partial<BoardProps> = {}) => renderToStaticMarkup(React.createElement(CanvasBoard, { ...props, ...overrides }));

test('free notes render sanitized rich content; related notes remain behind their exact case badge', () => {
  const html = render({ expanded: { f1: true } });
  assert.match(html, /data-node="note:free"/);
  // The sanitizer safely escapes markup in Node (no DOM); rich rendering is exercised in Chromium.
  assert.match(html, /Free body/);
  assert.doesNotMatch(html, /<script|<img/i);
  assert.doesNotMatch(html, /Secret related body|data-node="note:related"/);
  assert.match(html, /Notas de Exact case \(1\)/);
  assert.match(html, /Eliminar nota/);
  assert.match(html, /Editar nota/);
  assert.match(html, /canvas-note-content/);
});

test('viewer hides mutating actions and zoom uses scaled scroll bounds', () => {
  const html = render({ canEdit: false, zoom: 0.5 });
  assert.doesNotMatch(html, /Editar módulo|Editar funcionalidad|Eliminar nota|Color de/);
  assert.match(html, /transform:scale\(0.5\)/);
  assert.match(html, /class="canvas-world-bounds" style="width:600px/);
});

test('board provides a contained viewport, real relation connectors and editor card actions', () => {
  const html = render();
  assert.match(html, /class="canvas-viewport/);
  assert.equal((html.match(/<path data-connection=/g) || []).length, 1);
  assert.match(html, /Editar módulo Accounts/);
  assert.match(html, /Editar funcionalidad Register/);
  assert.match(html, /Agregar casos de prueba/);
  assert.match(html, /Agregar funcionalidad/);
  assert.match(html, /Color de Accounts/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Exact case|Secret related body/);
});
