import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { AxiosError, isAxiosError, type AxiosAdapter } from 'axios';
import type { TestCase } from '../src/types';

type Service = typeof import('../src/modules/canvas/services/canvasService');
type Runtime = Service & { Http: typeof import('../src/config/http').Http;
  CanvasWriteGate: typeof import('../src/modules/canvas/hooks/canvasUiModel').CanvasWriteGate };
let runtime: Runtime;
function load(): Runtime {
  if (runtime) return runtime;
  assert.ok(process.env.QA_SECURITY_SCRATCH, 'QA_SECURITY_SCRATCH required outside Git');
  const dir = mkdtempSync(join(process.env.QA_SECURITY_SCRATCH, 'canvas-write-guards-'));
  const file = join(dir, 'service.cjs');
  const bundle = buildSync({ stdin: { contents: `export * from './src/modules/canvas/services/canvasService';
    export { Http } from './src/config/http';
    export { CanvasWriteGate } from './src/modules/canvas/hooks/canvasUiModel';`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false,
    logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://canvas.invalid' }) } });
  writeFileSync(file, bundle.outputFiles[0].text);
  runtime = createRequire(import.meta.url)(file);
  test.after(() => rmSync(dir, { recursive: true, force: true }));
  return runtime;
}
const empty = () => ({ version: 1 as const, nodes: {}, notes: [], newElementColor: 'default' as const });
const batch = (): TestCase[] => Array.from({ length: 3 }, (_, i) => ({ id: `draft-${i}`, projectId: 'SYNTHETIC',
  functionalityId: 'MOD-01', title: `Case ${i}`, description: '', preconditions: '', testSteps: '', expectedResult: '',
  testType: 'Funcional', priority: 'Medio' })) as TestCase[];
type Row = Record<string, any>;
function fixture(options: { readbackStatus?: number; preflightStatus?: number; writeStatus?: number;
  badAck?: boolean; badReadback?: boolean; barrier?: (url: string, contextReads: number) => Promise<void> } = {}) {
  const s = load();
  const project = { documentId: 'project-a', key: 'SYNTHETIC' };
  const catalog: Record<string, Row[]> = {
    '/api/project-modules': [{ documentId: 'module-a', name: 'Module', project }],
    '/api/functionalities': [{ documentId: 'func-a', name: 'Function', code: 'MOD-01', project,
      module: { documentId: 'module-a' }, sprint: null }],
    '/api/test-cases': [], '/api/sprints': [],
  };
  let snapshot = { projectDocumentId: 'project-a', revision: 0, state: empty() };
  const writes: Array<{ method: string; url: string; data: Row }> = [];
  let contextReads = 0;
  const adapter: AxiosAdapter = async config => {
    const url = config.url!, method = config.method!;
    const reply = (data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
    const reject = (status: number): never => { throw new AxiosError('verification unavailable', 'ERR_BAD_RESPONSE', config,
      undefined, { ...reply({ error: { message: 'rejected' } }), status }); };
    if (method === 'get') {
      if (url === '/api/me/project-contexts') contextReads++;
      await options.barrier?.(url, contextReads);
      if (!writes.length && options.preflightStatus) reject(options.preflightStatus);
      if (writes.length && options.readbackStatus) reject(options.readbackStatus);
      if (url === '/api/me/project-contexts') return reply({ projects: [{ ...project, organization: { documentId: 'org-a' } }] });
      if (url.endsWith('/canvas')) return reply({ data: options.badReadback ? { ...snapshot, revision: 0 } : snapshot });
      assert.ok(catalog[url], `Unexpected GET ${url}`);
      return reply({ data: options.badReadback && writes.length ? [] : catalog[url],
        meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: catalog[url].length } } });
    }
    const data = JSON.parse(config.data).data;
    writes.push({ method, url, data });
    if (options.writeStatus) reject(options.writeStatus);
    if (url.endsWith('/canvas')) {
      snapshot = { ...snapshot, revision: data.revision + 1, state: data.state };
      return reply({ data: options.badAck ? null : snapshot });
    }
    const endpoint = Object.keys(catalog).find(key => url === key || url.startsWith(`${key}/`));
    assert.ok(endpoint, `Unexpected write ${url}`);
    const id = method === 'put' ? url.slice(endpoint.length + 1) : `created-${writes.length}`;
    let row = catalog[endpoint].find(item => item.documentId === id);
    if (!row) { row = { documentId: id, project }; catalog[endpoint].push(row); }
    Object.assign(row, data);
    if (endpoint === '/api/test-cases') row.functionality = { ...row.functionality, code: 'MOD-01' };
    return reply({ data: options.badAck ? null : row });
  };
  s.Http.defaults.adapter = adapter;
  return { s, writes, catalog };
}
const mutations: Array<{ name: string; run: (s: Service, guard?: () => void) => Promise<unknown> }> = [
  { name: 'snapshot', run: (s: Service, guard?: () => void) => s.saveCanvas('project-a', 0, empty(), guard) },
  { name: 'module create', run: (s: Service, guard?: () => void) => s.saveCanvasModule('project-a', { name: 'Created' }, guard) },
  { name: 'module update', run: (s: Service, guard?: () => void) => s.saveCanvasModule('project-a', { documentId: 'module-a', name: 'Edited' }, guard) },
  { name: 'functionality create', run: (s: Service, guard?: () => void) => s.saveCanvasFunctionality('project-a', { name: 'Created' }, guard) },
  { name: 'functionality update', run: (s: Service, guard?: () => void) => s.saveCanvasFunctionality('project-a', { documentId: 'func-a', name: 'Edited' }, guard) },
];
function barrier() {
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { entered = resolve; });
  return { reached, release, hold: async () => { entered(); await waiting; } };
}
for (const mutation of mutations) {
  test(`${mutation.name}: disposal during preflight prevents any write; active guard permits one`, async () => {
    for (const dispose of [true, false]) {
      const b = barrier();
      const f = fixture({ barrier: async url => {
        if (url === (mutation.name === 'snapshot' ? '/api/me/project-contexts' : '/api/sprints')) await b.hold();
      } });
      const gate = new f.s.CanvasWriteGate();
      let checks = 0;
      const pending = gate.run(() => mutation.run(f.s, () => { checks++; gate.assertActive(); }));
      await b.reached;
      if (dispose) gate.dispose();
      b.release();
      if (dispose) await assert.rejects(pending, /proyecto cambió/);
      else await pending;
      assert.equal(checks, 1);
      assert.equal(f.writes.length, dispose ? 0 : 1);
    }
  });
  for (const status of [403, 429]) test(`${mutation.name}: postcommit ${status} is uncertainty and real gate prevents retry`, async () => {
    const f = fixture({ readbackStatus: status });
    const gate = new f.s.CanvasWriteGate();
    await assert.rejects(gate.run(() => mutation.run(f.s)), error => {
      assert.ok(error instanceof Error);
      assert.equal(isAxiosError(error), false);
      assert.match(error.message, /may have been|uncertain/i);
      return true;
    });
    assert.equal(f.writes.length, 1);
    assert.equal(gate.blocked, true);
    await assert.rejects(gate.run(() => mutation.run(f.s)), /Recarga/);
    assert.equal(f.writes.length, 1, 'no blind retry after committed write');
  });
}
for (const mutation of mutations) {
  for (const option of [{ badAck: true }, { badReadback: true }]) {
    test(`${mutation.name}: ${Object.keys(option)[0]} remains an uncertain committed write`, async () => {
      const f = fixture(option);
      const gate = new f.s.CanvasWriteGate();
      await assert.rejects(gate.run(() => mutation.run(f.s)), /may have been saved.*verification failed/i);
      assert.equal(f.writes.length, 1);
      assert.equal(gate.blocked, true);
    });
  }
  for (const status of [403, 422, 429]) {
    for (const phase of ['preflightStatus', 'writeStatus'] as const) {
      test(`${mutation.name}: actual ${phase} ${status} retains known rejection semantics`, async () => {
        const f = fixture({ [phase]: status });
        const gate = new f.s.CanvasWriteGate();
        await assert.rejects(gate.run(() => mutation.run(f.s)), error => {
          assert.equal(isAxiosError(error), true);
          assert.equal((error as AxiosError).response?.status, status);
          return true;
        });
        assert.equal(f.writes.length, phase === 'preflightStatus' ? 0 : 1);
        assert.equal(gate.blocked, false);
      });
    }
  }
}
for (const status of [403, 429]) test(`case batch: postcommit ${status} preserves ambiguous/pending without retry`, async () => {
  const f = fixture({ readbackStatus: status });
  const progress: number[] = [];
  const result = await f.s.createCanvasCases('project-a', 'func-a', batch(), n => progress.push(n));
  assert.equal(f.writes.length, 1);
  assert.deepEqual(result.confirmed, []);
  assert.deepEqual(result.pending.map(row => row.id), batch().map(row => row.id));
  assert.equal(result.failed?.ambiguous, true);
  assert.match(result.failed!.message, /may have been created/);
  assert.deepEqual(progress, []);
});
for (const stopAt of [2, 3]) test(`case batch: disposal during context read ${stopAt} stops remaining writes`, async () => {
  for (const dispose of [true, false]) {
    const b = barrier();
    const f = fixture({ barrier: async (url, count) => {
      if (url === '/api/me/project-contexts' && count === stopAt) await b.hold();
    } });
    const gate = new f.s.CanvasWriteGate();
    const progress: number[] = [];
    let checks = 0;
    const pending = f.s.createCanvasCases('project-a', 'func-a', batch(), n => progress.push(n),
      () => { checks++; gate.assertActive(); });
    await b.reached;
    if (dispose) gate.dispose();
    b.release();
    const result = await pending;
    const confirmed = dispose ? stopAt - 2 : 3;
    assert.equal(f.writes.length, confirmed);
    assert.equal(checks, dispose ? confirmed + 1 : 3);
    assert.deepEqual(result.confirmed.map(row => row.localId), batch().slice(0, confirmed).map(row => row.id));
    assert.deepEqual(result.pending.map(row => row.id), batch().slice(confirmed).map(row => row.id));
    assert.deepEqual(progress, Array.from({ length: confirmed }, (_, i) => i + 1));
    if (dispose) {
      assert.match(result.failed!.message, /proyecto cambió/);
      assert.equal(result.failed!.ambiguous, true);
    } else assert.equal(result.failed, undefined);
  }
});
