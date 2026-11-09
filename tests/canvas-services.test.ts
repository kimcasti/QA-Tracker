import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import type { AxiosAdapter } from 'axios';

const path = resolve('src/modules/canvas/services/canvasService.ts');
let service: typeof import('../src/modules/canvas/services/canvasService') & { Http: typeof import('../src/config/http').Http };
function loadService() {
  assert.ok(existsSync(path), 'Canvas data service must exist');
  if (service) return service;
  const scratch = process.env.QA_SECURITY_SCRATCH;
  assert.ok(scratch, 'QA_SECURITY_SCRATCH required outside Git');
  const dir = mkdtempSync(join(scratch, 'canvas-services-'));
  const filename = join(dir, 'service.cjs');
  const bundle = buildSync({ stdin: { contents: `export * from './src/modules/canvas/services/canvasService'; export { Http } from './src/config/http';`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://canvas.invalid' }) } });
  writeFileSync(filename, bundle.outputFiles[0].text);
  service = createRequire(import.meta.url)(filename);
  test.after(() => rmSync(dir, { recursive: true, force: true }));
  return service;
}
const empty = () => ({ version: 1 as const, nodes: {}, notes: [], newElementColor: 'default' as const });
const project = { documentId: 'project-a', key: 'SYNTHETIC' };
const rows = (): Record<string, Row[]> => ({
  '/api/project-modules': [{ documentId: 'module-a', name: 'Module', description: 'Keep description', project }],
  '/api/sprints': [{ documentId: 'sprint-a', name: 'Sprint', project }],
  '/api/functionalities': [{ documentId: 'func-a', code: 'MOD-01', name: 'Function', project,
    module: { documentId: 'module-a' }, sprint: null, status: null, priority: null,
    impactLevel: null, probabilityLevel: null, deliveryDate: null, isRegression: true, jiraIssueKey: 'KEEP-1' }],
  '/api/test-cases': [{ documentId: 'case-a', title: 'Historical case', project,
    functionality: { documentId: 'func-a', code: 'MOD-01' }, testType: 'integration', automationTool: 'cypress', automationStatus: 'automated' }],
});
type Row = Record<string, any>;
function fixture(options: { projects?: Row[]; catalog?: Record<string, Row[]>; readError?: boolean; putError?: Error; staleReadback?: boolean; snapshot?: Row; failCaseAt?: number; failCaseStatus?: number; failRefresh?: boolean; failRefreshStatus?: number } = {}) {
  const s = loadService();
  const requests: Array<{ method: string; url: string; params: any; data: any }> = [];
  const catalog: Record<string, Row[]> = options.catalog || rows();
  let snapshot = Object.hasOwn(options, 'snapshot') ? options.snapshot as any : { projectDocumentId: 'project-a', revision: 0, state: empty() };
  let caseWrites = 0, writes = 0;
  const adapter: AxiosAdapter = async config => {
    const method = config.method!, url = config.url!, data = config.data ? JSON.parse(config.data) : undefined;
    requests.push({ method, url, params: config.params, data });
    const reply = (body: unknown) => ({ config, data: body, status: 200, statusText: 'OK', headers: {} });
    if (url === '/api/me/project-contexts') return reply({ projects: options.projects ?? [{ ...project, organization: { documentId: 'org-a' } }] });
    if (url === '/api/projects/project-a/canvas') {
      if (method === 'put') {
        if (options.putError) throw options.putError;
        if (!options.staleReadback) snapshot = { ...snapshot, revision: data.data.revision + 1, state: data.data.state };
        return reply({ data: { ...snapshot, revision: data.data.revision + 1, state: data.data.state } });
      }
      if (options.readError) throw new Error('readback unavailable');
      return reply({ data: snapshot });
    }
    const endpoint = Object.keys(catalog).find(key => url === key || url.startsWith(`${key}/`));
    assert.ok(endpoint, `Unexpected HTTP: ${method} ${url}`);
    if (method === 'get') {
      if (options.failRefresh && writes) {
        if (options.failRefreshStatus) throw { isAxiosError: true, message: 'refresh unavailable', response: { status: options.failRefreshStatus } };
        throw new Error('refresh unavailable');
      }
      const items = catalog[endpoint];
      const page = Number(config.params?.['pagination[page]'] || 1);
      const size = 2;
      return reply({ data: items.slice((page - 1) * size, page * size),
        meta: { pagination: { page, pageSize: size, total: items.length, pageCount: Math.ceil(items.length / size) } } });
    }
    writes++;
    if (endpoint === '/api/test-cases' && ++caseWrites === options.failCaseAt) {
      if (options.failCaseStatus) throw { isAxiosError: true, message: 'write rejected', response: { status: options.failCaseStatus, data: { error: { message: 'write rejected' } } } };
      throw new Error('connection lost');
    }
    const id = url.slice(endpoint.length + 1) || (caseWrites > 1 ? `created-${caseWrites}` : 'created-a');
    let target = catalog[endpoint].find(row => row.documentId === id);
    if (!target) { target = { documentId: id, project }; catalog[endpoint].push(target); }
    Object.assign(target, data.data);
    if (endpoint === '/api/test-cases' && target.functionality?.documentId) {
      target.functionality = { ...target.functionality,
        code: catalog['/api/functionalities'].find(row => row.documentId === target!.functionality.documentId)?.code };
    }
    return reply({ data: target });
  };
  s.Http.defaults.adapter = adapter;
  return { s, requests, catalog };
}

test('load Canvas uses fresh exact scope, raw nullable metadata and document relations', async () => {
  const { s, requests } = fixture();
  const result = await s.loadCanvas('SYNTHETIC');
  assert.deepEqual(result.context, { documentId: 'project-a', organizationDocumentId: 'org-a' });
  assert.equal(result.snapshot.revision, 0);
  assert.equal(result.catalog.functionalities[0].status, null);
  assert.equal(result.catalog.functionalities[0].priority, null);
  assert.equal(result.catalog.cases[0].functionalityDocumentId, 'func-a');
  assert.equal(result.catalog.cases[0].testCase.automationTool, 'Cypress');
  assert.equal(result.catalog.cases[0].testCase.testType, 'Integración');
  for (const request of requests.filter(r => Object.keys(rows()).includes(r.url))) {
    assert.equal(request.params['filters[project][documentId][$eq]'], 'project-a');
  }
  const before = requests.filter(r => r.url === '/api/me/project-contexts').length;
  await s.loadCanvas('SYNTHETIC');
  assert.ok(requests.filter(r => r.url === '/api/me/project-contexts').length > before);
});

test('existing Canvas catalogs load paginated unassigned cases without writes or input mutation', async () => {
  const baseline = fixture();
  const linked = (await baseline.s.loadCanvas('project-a')).catalog.cases;
  const catalog = rows();
  catalog['/api/functionalities'].push({ ...catalog['/api/functionalities'][0], documentId: 'func-b' });
  catalog['/api/test-cases'].push(
    { ...catalog['/api/test-cases'][0], documentId: 'unassigned-null', title: 'No parent', functionality: null },
    { ...catalog['/api/test-cases'][0], documentId: 'case-b', title: 'Sibling case', functionality: { documentId: 'func-b', code: 'MOD-01' } },
    { ...catalog['/api/test-cases'][0], documentId: 'unassigned-undefined', title: 'Absent parent', functionality: undefined },
    { ...catalog['/api/test-cases'][0], documentId: 'unassigned-omitted', title: 'Omitted parent' },
  );
  delete catalog['/api/test-cases'][4].functionality;
  const original = structuredClone(catalog);
  const { s, requests } = fixture({ catalog });
  const result = await s.loadCanvas('project-a');
  assert.deepEqual(result.catalog.modules.map(row => row.documentId), ['module-a']);
  assert.deepEqual(result.catalog.functionalities.map(row => row.documentId), ['func-a', 'func-b']);
  assert.deepEqual(result.catalog.cases.map(row => row.documentId), ['case-a', 'case-b']);
  assert.deepEqual(result.catalog.cases[0], linked[0], 'the linked case retains its complete mapped domain fields');
  assert.equal(result.catalog.cases[1].functionalityDocumentId, 'func-b');
  assert.deepEqual(result.catalog.unassignedCases, [
    { documentId: 'unassigned-null', title: 'No parent' },
    { documentId: 'unassigned-undefined', title: 'Absent parent' },
    { documentId: 'unassigned-omitted', title: 'Omitted parent' },
  ], 'unassigned DTOs expose identity/title only, without an invented parent or exact editor data');
  assert.deepEqual(catalog, original);
  assert.ok(requests.every(request => request.method === 'get'), 'loading never writes or repairs records');
  assert.deepEqual(requests.filter(r => r.url === '/api/test-cases').map(r => r.params['pagination[page]']), [1, 2, 3]);
});

test('unassigned cases still require valid project provenance, identity and every domain field', async () => {
  const invalidFields: Array<[string, unknown]> = [
    ['project', null], ['project', { documentId: 'foreign', key: 'SYNTHETIC' }],
    ['project', { ...project, key: 'FOREIGN' }], ['organization', { documentId: 'foreign' }],
    ['documentId', '../case-a'], ['documentId', 5], ['title', {}],
    ...['description', 'preconditions', 'testSteps', 'expectedResult', 'automationReference', 'automationOwner', 'lastAutomationRunAt']
      .map(field => [field, {}] as [string, unknown]),
    ['sortOrder', '1'], ['isAutomated', 'true'], ['testType', 'invented'], ['priority', 'invented'],
    ...['automationStatus', 'automationType', 'automationTool', 'lastAutomationStatus']
      .map(field => [field, 'invented'] as [string, unknown]),
  ];
  for (const functionality of [null, undefined]) {
    for (const [field, value] of invalidFields) {
      const catalog = rows();
      catalog['/api/test-cases'].push({ ...catalog['/api/test-cases'][0], documentId: 'unassigned', functionality, [field]: value });
      const original = structuredClone(catalog);
      const f = fixture({ catalog });
      await assert.rejects(f.s.loadCanvas('project-a'), /Canvas/, `${field} must not bypass validation without a parent`);
      await assert.rejects(f.s.saveCanvasModule('project-a', { documentId: 'module-a', name: 'No write' }), /Canvas/);
      assert.ok(f.requests.every(r => r.method === 'get'));
      assert.deepEqual(catalog, original);
    }
    const catalog = rows();
    catalog['/api/test-cases'].push({ ...catalog['/api/test-cases'][0], functionality });
    const f = fixture({ catalog });
    await assert.rejects(f.s.loadCanvas('project-a'), /Canvas/, 'duplicate IDs remain invalid across linked and unassigned rows');
    assert.ok(f.requests.every(r => r.method === 'get'));
  }
});

test('non-null malformed or foreign functionality relations never become unassigned cases', async () => {
  for (const functionality of [false, 0, '', 'func-a', [], {}, { documentId: 'func-a' },
    { documentId: '../func-a', code: 'MOD-01' }, { documentId: 5, code: 'MOD-01' },
    { documentId: 'func-a', code: 5 }, { documentId: 'func-a', code: 'WRONG' },
    { documentId: 'foreign-function', code: 'MOD-01' }]) {
    const catalog = rows();
    catalog['/api/test-cases'].push({ ...catalog['/api/test-cases'][0], documentId: 'invalid-parent', functionality });
    const f = fixture({ catalog });
    await assert.rejects(f.s.loadCanvas('project-a'), /Canvas.*functionality/);
    await assert.rejects(f.s.saveCanvasModule('project-a', { documentId: 'module-a', name: 'No write' }), /Canvas/);
    assert.ok(f.requests.every(r => r.method === 'get'));
  }
});

test('catalog rejects foreign/missing project and cross-project same-code relations; failed reads stay visible', async () => {
  for (const mutate of [
    (c: Record<string, Row[]>) => { c['/api/project-modules'][0].project = { documentId: 'foreign', key: 'SYNTHETIC' }; },
    (c: Record<string, Row[]>) => { delete c['/api/sprints'][0].project; },
    (c: Record<string, Row[]>) => { c['/api/functionalities'][0].module = { documentId: 'foreign-module' }; },
    (c: Record<string, Row[]>) => { c['/api/functionalities'][0].sprint = { documentId: 'foreign-sprint' }; },
    (c: Record<string, Row[]>) => { c['/api/test-cases'][0].functionality = { documentId: 'foreign-function', code: 'MOD-01' }; },
    (c: Record<string, Row[]>) => { c['/api/test-cases'][0].functionality = { documentId: 'func-a', code: 'WRONG' }; },
    (c: Record<string, Row[]>) => { c['/api/functionalities'][0].status = 'invented'; },
  ]) {
    const catalog = rows(); mutate(catalog);
    const { s } = fixture({ catalog });
    await assert.rejects(s.loadCanvas('SYNTHETIC'), /Canvas/i);
  }
  for (const projects of [[], [{ ...project }], [{ ...project, organization: null }]]) {
    const { s, requests } = fixture({ projects });
    await assert.rejects(s.loadCanvas('SYNTHETIC'), /Canvas/i);
    assert.equal(requests.length, 1);
  }
  const { s } = fixture({ readError: true });
  await assert.rejects(s.loadCanvas('SYNTHETIC'), /unavailable/);
});

test('Canvas rejects ambiguous or malformed fresh contexts before reading or mutating records', async () => {
  for (const projects of [
    [{ ...project, organization: { documentId: 'org-a' } }, { ...project, documentId: 'project-b', organization: { documentId: 'org-a' } }],
    [{ ...project, documentId: '../project-a', organization: { documentId: 'org-a' } }],
    [{ ...project, organization: { documentId: 5 } }], [null],
  ]) {
    const f = fixture({ projects: projects as any });
    await assert.rejects(f.s.loadCanvas('SYNTHETIC'), /Canvas/);
    assert.equal(f.requests.length, 1);
  }
  const f = fixture();
  await assert.rejects(f.s.saveCanvasModule('SYNTHETIC', { name: 'Do not write by key' }), /Canvas/);
  assert.equal(f.requests.length, 1);
});

test('Canvas snapshot save requires explicit PUT and matching verified GET', async () => {
  const { s, requests } = fixture();
  assert.equal(typeof s.saveCanvas, 'function');
  const state = { ...empty(), nodes: { 'module:module-a': { x: 12, y: 24 } } };
  const saved = await s.saveCanvas('project-a', 0, state);
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.state, state);
  assert.deepEqual(requests.map(r => [r.method, r.url]), [
    ['get', '/api/me/project-contexts'], ['put', '/api/projects/project-a/canvas'], ['get', '/api/projects/project-a/canvas'],
  ]);
  assert.deepEqual(requests[1].data, { data: { revision: 0, state } });
  for (const options of [{ staleReadback: true }, { readError: true }, { putError: new Error('conflict') }]) {
    const { s, requests } = fixture(options);
    await assert.rejects(s.saveCanvas('project-a', 0, state), /Canvas|conflict|unavailable/);
    assert.equal(requests.filter(r => r.method === 'put').length, 1);
  }
});

test('Canvas module mutations preserve unrelated fields and verify exact refreshed IDs', async () => {
  const { s, requests, catalog } = fixture();
  assert.equal(typeof s.saveCanvasModule, 'function');
  assert.deepEqual(await s.saveCanvasModule('project-a', { documentId: 'module-a', name: 'Renamed' }),
    { documentId: 'module-a', name: 'Renamed', description: 'Keep description' });
  const update = requests.find(r => r.method === 'put')!;
  assert.equal(update.url, '/api/project-modules/module-a');
  assert.deepEqual(update.data, { data: { name: 'Renamed' } });
  assert.equal(catalog['/api/project-modules'][0].description, 'Keep description');
  assert.ok(requests.slice(requests.indexOf(update) + 1).some(r => r.url === '/api/project-modules' && r.method === 'get'));
  const created = await s.saveCanvasModule('project-a', { name: 'New module' });
  assert.equal(created.documentId, 'created-a');
  const create = requests.find(r => r.method === 'post')!;
  assert.deepEqual(create.data, { data: { name: 'New module', project: { documentId: 'project-a' }, organization: { documentId: 'org-a' } } });
  for (const input of [{ documentId: 'foreign', name: 'Bad' }, { name: '   ' }]) {
    const f = fixture();
    await assert.rejects(f.s.saveCanvasModule('project-a', input), /Canvas/);
    assert.equal(f.requests.filter(r => r.method !== 'get').length, 0);
  }
});

test('Canvas functionality uses nullable creates and partial edits without touching QA fields', async () => {
  const { s, requests, catalog } = fixture();
  assert.equal(typeof s.saveCanvasFunctionality, 'function');
  const original = { ...catalog['/api/functionalities'][0] };
  const edited = await s.saveCanvasFunctionality('project-a', { documentId: 'func-a', name: 'Edited', priority: 'high', sprintDocumentId: null });
  assert.equal(edited.priority, 'high');
  assert.deepEqual(requests.find(r => r.method === 'put')!.data, { data: { name: 'Edited', priority: 'high', sprint: null } });
  assert.equal(catalog['/api/functionalities'][0].isRegression, original.isRegression);
  assert.equal(catalog['/api/functionalities'][0].jiraIssueKey, original.jiraIssueKey);
  const created = await s.saveCanvasFunctionality('project-a', { name: 'Only name' });
  assert.equal(created.code, 'CANV-01');
  const payload = requests.find(r => r.method === 'post')!.data.data;
  assert.deepEqual(payload, { code: 'CANV-01', name: 'Only name', module: null, sprint: null,
    deliveryDate: null, status: null, priority: null, impactLevel: null, probabilityLevel: null,
    project: { documentId: 'project-a' }, organization: { documentId: 'org-a' } });
  assert.equal(created.status, null);
  for (const input of [{ name: 'Bad', moduleDocumentId: 'foreign' }, { name: 'Bad', sprintDocumentId: 'foreign' },
    { name: 'Bad', documentId: 'foreign' }, { name: 'Bad', status: 'invented' }, { name: 'Bad', deliveryDate: '2026-02-30' }]) {
    const f = fixture();
    await assert.rejects(f.s.saveCanvasFunctionality('project-a', input as any), /Canvas/);
    assert.equal(f.requests.filter(r => r.method !== 'get').length, 0);
  }
});

test('valid Canvas mutations preserve unassigned cases and never write their assignment', async () => {
  for (const operation of ['module', 'functionality', 'case'] as const) {
    const catalog = rows();
    catalog['/api/test-cases'].push(
      { ...catalog['/api/test-cases'][0], documentId: 'unassigned-null', title: 'New case', functionality: null },
      { ...catalog['/api/test-cases'][0], documentId: 'unassigned-undefined', functionality: undefined },
    );
    const originalCases = structuredClone(catalog['/api/test-cases']);
    const f = fixture({ catalog });
    if (operation === 'module') {
      await f.s.saveCanvasModule('project-a', { documentId: 'module-a', name: 'Renamed' });
    } else if (operation === 'functionality') {
      await f.s.saveCanvasFunctionality('project-a', { documentId: 'func-a', name: 'Renamed' });
    } else {
      const draft = { id: 'draft-new', projectId: 'SYNTHETIC', functionalityId: 'MOD-01', title: 'New case',
        description: '', preconditions: '', testSteps: '', expectedResult: '', testType: 'Funcional', priority: 'Medio' } as any;
      await assert.rejects(f.s.createCanvasCases('project-a', 'func-a', [{ ...draft, id: 'unassigned-null' }]), /Canvas.*persisted/i);
      assert.ok(f.requests.every(r => r.method === 'get'), 'unassigned persisted IDs remain reserved');
      const result = await f.s.createCanvasCases('project-a', 'func-a', [draft]);
      assert.equal(result.confirmed.length, 1);
      assert.deepEqual(result.pending, []);
      assert.equal(result.confirmed[0].testCase.functionalityId, 'MOD-01');
    }
    assert.deepEqual(catalog['/api/test-cases'].slice(0, originalCases.length), originalCases);
    const writes = f.requests.filter(r => r.method !== 'get');
    assert.equal(writes.length, 1, `${operation} writes only its intended target`);
    assert.equal(writes[0].url, operation === 'module' ? '/api/project-modules/module-a' :
      operation === 'functionality' ? '/api/functionalities/func-a' : '/api/test-cases');
    if (operation !== 'case') assert.deepEqual(writes[0].data, { data: { name: 'Renamed' } });
    else assert.deepEqual(writes[0].data.data.functionality, { documentId: 'func-a' });
    const refreshed = await f.s.loadCanvas('project-a');
    assert.deepEqual(refreshed.catalog.unassignedCases, originalCases.slice(1).map(({ documentId, title }) => ({ documentId, title })));
    assert.equal(refreshed.catalog.cases.length, operation === 'case' ? 2 : 1);
  }
});

test('Canvas bulk creates preflight the entire batch, preserve case content and confirm refresh before progress', async () => {
  const catalog = rows();
  catalog['/api/functionalities'].push({ ...catalog['/api/functionalities'][0], documentId: 'func-b' });
  const { s, requests } = fixture({ catalog });
  assert.equal(typeof s.createCanvasCases, 'function');
  const cases = [{ id: 'draft-1', projectId: 'SYNTHETIC', functionalityId: 'MOD-01', title: 'New case',
    description: '<p>Description</p>', preconditions: '<p>Given</p>', testSteps: '<p>When</p>', expectedResult: '<p>Then</p>',
    testType: 'UAT', priority: 'Alto', sortOrder: 4, isAutomated: false, automationStatus: 'No automatizado' }] as any;
  const progress: number[] = [];
  const result = await s.createCanvasCases('project-a', 'func-b', cases, n => progress.push(n));
  assert.equal(result.confirmed.length, 1);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(progress, [1]);
  assert.equal(result.confirmed[0].testCase.documentId, 'created-a');
  const post = requests.find(r => r.method === 'post')!;
  assert.equal(post.url, '/api/test-cases');
  assert.equal(post.data.data.functionality.documentId, 'func-b');
  assert.equal(post.data.data.testType, 'uat');
  for (const field of ['description', 'preconditions', 'testSteps', 'expectedResult', 'sortOrder'])
    assert.equal(post.data.data[field], cases[0][field]);
  assert.ok(requests.slice(requests.indexOf(post) + 1).some(r => r.url === '/api/test-cases'));
  for (const mutate of [
    (c: any[]) => { c[1].projectId = 'foreign'; }, (c: any[]) => { c[1].functionalityId = 'foreign'; },
    (c: any[]) => { c[1].testType = 'Integración'; }, (c: any[]) => { c[1].title = ''; },
    (c: any[]) => { c[1].documentId = 'case-a'; }, (c: any[]) => { c[1].id = c[0].id; },
  ]) {
    const f = fixture(); const batch = [{ ...cases[0] }, { ...cases[0], id: 'draft-2' }]; mutate(batch);
    await assert.rejects(f.s.createCanvasCases('project-a', 'func-a', batch), /Canvas/);
    assert.equal(f.requests.filter(r => r.method !== 'get').length, 0);
  }
  const f = fixture();
  await assert.rejects(f.s.createCanvasCases('project-a', 'foreign', cases), /Canvas/);
  assert.equal(f.requests.filter(r => r.method !== 'get').length, 0);
});

test('Canvas bulk rejects normalized duplicate titles against exact parent and incoming batch', async () => {
  const item = { id: 'draft-1', projectId: 'SYNTHETIC', functionalityId: 'MOD-01', title: ' New   Case ',
    description: '', preconditions: '', testSteps: '', expectedResult: '', testType: 'Funcional', priority: 'Medio' } as any;
  for (const batch of [[item, { ...item, id: 'draft-2', title: 'new case' }], [{ ...item, title: ' HISTORICAL case ' }]]) {
    const f = fixture();
    await assert.rejects(f.s.createCanvasCases('project-a', 'func-a', batch), /Canvas.*duplicate/i);
    assert.equal(f.requests.filter(r => r.method !== 'get').length, 0);
  }
});

test('Canvas bulk reports confirmed, ambiguous and pending without retrying uncertain writes', async () => {
  const batch = Array.from({ length: 3 }, (_, i) => ({ id: `draft-${i}`, projectId: 'SYNTHETIC', functionalityId: 'MOD-01', title: `Case ${i}`,
    description: '', preconditions: '', testSteps: '', expectedResult: '', testType: 'Funcional', priority: 'Medio' })) as any;
  for (const status of [undefined, 422, 500]) {
    const f = fixture({ failCaseAt: 2, failCaseStatus: status });
    const progress: number[] = [];
    const result = await f.s.createCanvasCases('project-a', 'func-a', batch, n => progress.push(n));
    assert.deepEqual(result.confirmed.map(row => row.localId), ['draft-0']);
    assert.deepEqual(result.pending.map(row => row.id), ['draft-1', 'draft-2']);
    assert.equal(result.failed?.ambiguous, status !== 422);
    assert.deepEqual(progress, [1]);
    assert.equal(f.requests.filter(r => r.method === 'post').length, 2);
  }
  for (const failRefreshStatus of [undefined, 404]) {
    const f = fixture({ failRefresh: true, failRefreshStatus });
    const result = await f.s.createCanvasCases('project-a', 'func-a', batch);
    assert.equal(result.failed?.ambiguous, true, 'a failed GET cannot prove the preceding POST did not persist');
    assert.equal(result.confirmed.length, 0);
    assert.equal(result.pending.length, 3);
    assert.equal(f.requests.filter(r => r.method === 'post').length, 1);
  }
});

test('Canvas load rejects invalid snapshot provenance/revision and malformed domain DTOs', async () => {
  for (const snapshot of [null, { projectDocumentId: 'foreign', revision: 0, state: empty() },
    ...[-1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1].map(revision => ({ projectDocumentId: 'project-a', revision, state: empty() })),
    { projectDocumentId: 'project-a', revision: 0, state: empty(), secret: 'do not expose' }]) {
    const f = fixture({ snapshot: snapshot as any });
    await assert.rejects(f.s.loadCanvas('SYNTHETIC'), /Canvas/);
  }
  for (const [endpoint, field, value] of [
    ['/api/project-modules', 'name', 5], ['/api/sprints', 'name', null], ['/api/test-cases', 'title', {}],
    ['/api/test-cases', 'description', {}], ['/api/test-cases', 'testType', 'invented'],
    ['/api/functionalities', 'deliveryDate', '2026-02-30'], ['/api/test-cases', 'documentId', '../case-a'],
  ] as const) {
    const catalog = rows(); catalog[endpoint][0][field] = value;
    const f = fixture({ catalog });
    await assert.rejects(f.s.loadCanvas('SYNTHETIC'), /Canvas/);
  }
});

test('raw catalog pagination collects every row without merging duplicate business codes', async () => {
  const catalog = rows();
  catalog['/api/functionalities'].push({ ...catalog['/api/functionalities'][0], documentId: 'func-b' });
  catalog['/api/test-cases'] = Array.from({ length: 5 }, (_, i) => ({ ...catalog['/api/test-cases'][0],
    documentId: `case-${i}`, functionality: { documentId: i % 2 ? 'func-b' : 'func-a', code: 'MOD-01' } }));
  const { s, requests } = fixture({ catalog });
  const result = await s.loadCanvas('project-a');
  assert.equal(result.catalog.cases.length, 5);
  assert.deepEqual(result.catalog.cases.map(c => c.functionalityDocumentId), ['func-a', 'func-b', 'func-a', 'func-b', 'func-a']);
  assert.ok(requests.some(r => r.url === '/api/test-cases' && r.params['pagination[page]'] === 3));
});
