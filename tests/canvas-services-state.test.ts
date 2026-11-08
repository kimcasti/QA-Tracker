import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const statePath = resolve('src/modules/canvas/utils/canvasState.ts');
test('Canvas state enforces server bounds, identifier shape and note positions', async () => {
  const { parseCanvasState, emptyCanvasState } = await import('../src/modules/canvas/utils/canvasState');
  for (const bad of [
    { nodes: { 'module:m': { x: 100001, y: 0 } } },
    { nodes: { 'case:c': { x: 0, y: 0 } } }, { nodes: { 'note:missing': { x: 0, y: 0 } } },
    { nodes: { ['module:' + 'x'.repeat(129)]: { x: 0, y: 0 } } },
    { nodes: Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`module:m${i}`, { x: 0, y: 0 }])) },
    { notes: Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, html: '' })) },
    { notes: [{ id: 'n', html: 'é'.repeat(10001) }] }, { notes: [{ id: 'n.', html: '' }] },
    { notes: Array.from({ length: 15 }, (_, i) => ({ id: `n${i}`, html: 'a'.repeat(20000) })) },
    { nodes: JSON.parse('{"__proto__":{"x":0,"y":0}}') },
  ]) assert.throws(() => parseCanvasState({ ...emptyCanvasState(), ...bad }), /Canvas/);
  const state = { ...emptyCanvasState(), notes: [{ id: 'n', html: 'ok' }], nodes: { 'note:n': { x: 100000, y: -100000 } } };
  assert.deepEqual(parseCanvasState(state), state);
});

test('Canvas notes are safe without DOM and sanitized in actual browser DOM', async () => {
  const notePath = resolve('src/modules/canvas/utils/noteHtml.ts');
  assert.ok(existsSync(notePath), 'Canvas note sanitizer must exist');
  const { sanitizeCanvasNoteHtml, canvasNoteText } = await import('../src/modules/canvas/utils/noteHtml');
  const hostile = '<p onclick="alert(1)">Hello <strong>world</strong><img src=x onerror=alert(1)></p><script>alert(1)</script>';
  const ssr = sanitizeCanvasNoteHtml(hostile);
  assert.ok(!ssr.includes('<'));
  assert.ok(!canvasNoteText(hostile).includes('<'), 'SSR text helper must also fail closed');
  assert.equal(sanitizeCanvasNoteHtml(ssr), ssr);
  const script = buildSync({ stdin: { contents: `import * as notes from './src/modules/canvas/utils/noteHtml'; import {parseCanvasState} from './src/modules/canvas/utils/canvasState'; globalThis.canvasTest = {...notes, parseCanvasState};`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife' }).outputFiles[0].text;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: script });
    const result = await page.evaluate(({ hostile }) => {
      const u = (globalThis as any).canvasTest;
      const html = u.sanitizeCanvasNoteHtml(hostile + '<a href="https://example.test/a" target="_blank" style="color:red">Safe</a><a href="javascript:alert(1)">Bad</a><a href="https://user:pass@example.test">Credentials</a><svg><a onmouseover="alert(1)">SVG</a></svg>');
      const root = document.createElement('div'); root.innerHTML = html;
      return { html, text: u.canvasNoteText(html), unsafe: root.querySelectorAll('script,img,svg,[onclick],[onerror],[style]').length,
        hrefs: [...root.querySelectorAll('a')].map(a => a.getAttribute('href')),
        rel: root.querySelector('a')?.rel,
        stateHtml: u.parseCanvasState({ version: 1, nodes: {}, notes: [{ id: 'n', html: hostile }], newElementColor: 'default' }).notes[0].html };
    }, { hostile });
    assert.equal(result.unsafe, 0);
    assert.match(result.html, /<strong>world<\/strong>/);
    assert.deepEqual(result.hrefs, ['https://example.test/a', null, null]);
    assert.equal(result.rel, 'noopener noreferrer');
    assert.ok(!result.stateHtml.includes('onclick'));
    assert.match(result.text, /Hello world/);
    assert.ok(!result.text.includes('alert(1)'));
  } finally { await browser.close(); }
});
test('Canvas visual state has independent empty defaults and stable typed keys', async () => {
  assert.ok(existsSync(statePath), 'Canvas state utility must exist');
  const { emptyCanvasState, canvasKey } = await import('../src/modules/canvas/utils/canvasState');
  const a = emptyCanvasState();
  assert.deepEqual(a, { version: 1, nodes: {}, notes: [], newElementColor: 'default' });
  a.notes.push({ id: 'n', html: 'Hello' });
  assert.equal(emptyCanvasState().notes.length, 0);
  assert.equal(canvasKey('functionality', 'doc-a'), 'functionality:doc-a');
});

test('Canvas metadata rejects malformed or QA-bearing shapes rather than hiding corruption', async () => {
  const utility = await import('../src/modules/canvas/utils/canvasState');
  assert.equal(typeof utility.parseCanvasState, 'function', 'state parser must exist');
  const { parseCanvasState, emptyCanvasState } = utility;
  const state = { ...emptyCanvasState(), nodes: { 'module:m': { x: -20, y: 12, color: 'pink' as const } },
    notes: [{ id: 'n', html: 'Note', anchorId: 'case:c' }] };
  assert.deepEqual(parseCanvasState(state), state);
  for (const bad of [null, { ...state, version: 2 }, { ...state, newElementColor: 'red' },
    { ...state, nodes: { 'module:m': { x: Infinity, y: 0 } } },
    { ...state, nodes: { 'module:m': { x: 1, y: 0, status: 'completed' } } },
    { ...state, notes: [{ id: 'n', html: 'ok', anchorId: 'note:n' }] },
    { ...state, notes: [{ id: 'n', html: 'a' }, { id: 'n', html: 'b' }] },
    { ...state, nodes: { 'random:x': { x: 1, y: 2 } } }, { ...state, jiraIssueKey: 'not metadata' }]) {
    assert.throws(() => parseCanvasState(bad), /Canvas/i);
  }
  const copy = parseCanvasState(state);
  copy.nodes['module:m'].x = 999;
  assert.equal(state.nodes['module:m'].x, -20);
});
