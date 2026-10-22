import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { buildSync } from 'esbuild';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AxiosAdapter } from 'axios';
import type { ExternalContact, ExternalContactScope } from '../src/components/about/projectExternalParticipants';

// Execute the component's actual load declaration, not a replacement transport.
// Only the UI hooks/rendering are omitted; loader, pagination and writes stay real.
const source = ts.createSourceFile('ProjectExternalContacts.tsx', readFileSync(
  new URL('../src/components/about/ProjectExternalContacts.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'ProjectExternalContacts');
assert.ok(component?.body);
const loadStatement = component.body.statements.find(node => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'load'));
assert.ok(loadStatement, 'test must execute the real component load declaration');
const socketGuard = mock.method(Socket.prototype, 'connect', () => {
  throw new Error('EXTERNAL_CONTACT_NETWORK_BLOCKED');
});
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch, 'QA_SECURITY_SCRATCH must point outside the repository');
const directory = mkdtempSync(join(scratch, 'external-pagination-'));
const filename = join(directory, 'loader.cjs');
const bundle = buildSync({
  stdin: {
    contents: `import { getDocument, listDocuments, updateDocument } from './src/modules/shared/services/strapi';
      import { loadProjectExternalContacts } from './src/components/about/projectExternalParticipants';
      export { saveProjectExternalContact } from './src/components/about/projectExternalParticipants';
      export { createExternalParticipant, getExternalParticipants } from './src/modules/participant-directory/services/participantDirectoryService';
      export { Http } from './src/config/http';
      export { listDocuments, updateDocument };
      export function componentLoad(scope) { ${loadStatement.getText(source)} return load; }`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://external-pagination.invalid' }) },
  logLevel: 'silent',
});
writeFileSync(filename, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(filename) as {
  componentLoad: (scope: ExternalContactScope) => () => Promise<{ organizationDocumentId: string; contacts: ExternalContact[] }>;
  saveProjectExternalContact: typeof import('../src/components/about/projectExternalParticipants').saveProjectExternalContact;
  getExternalParticipants: typeof import('../src/modules/participant-directory/services/participantDirectoryService').getExternalParticipants;
  createExternalParticipant: typeof import('../src/modules/participant-directory/services/participantDirectoryService').createExternalParticipant;
  updateDocument: typeof import('../src/modules/shared/services/strapi').updateDocument;
  listDocuments: typeof import('../src/modules/shared/services/strapi').listDocuments;
  Http: typeof import('../src/config/http').Http;
};
const originalAdapter = service.Http.defaults.adapter;
test.after(() => {
  service.Http.defaults.adapter = originalAdapter;
  socketGuard.mock.restore();
  rmSync(directory, { recursive: true, force: true });
});
const scope: ExternalContactScope = { organizationDocumentId: 'org-a', projectDocumentId: 'project-a',
  roleCode: 'manager', membershipStatus: 'active' };
const contact = (index: number): ExternalContact => ({ documentId: `contact-${index}`, name: `Contact ${index}`,
  organization: { documentId: 'org-a', name: 'Synthetic organization' },
  sourceProject: index === 0 ? null : { documentId: 'project-a', name: 'Synthetic project' } });
type Request = { method: string; url: string; page?: number; data?: unknown };
function controllerBoundary(rows: ExternalContact[], projectOrganization = 'org-a', scoped = true) {
  const requests: Request[] = [];
  let listSinceProjectRead = 0;
  const adapter: AxiosAdapter = async config => {
    const request: Request = { method: config.method!, url: config.url! };
    if (config.params?.['pagination[page]']) request.page = config.params['pagination[page]'];
    if (config.data) request.data = JSON.parse(config.data);
    requests.push(request);
    const respond = (data: unknown) => ({ config, status: 200, statusText: 'OK', headers: {}, data });
    if (config.method === 'get' && config.url === '/api/projects/project-a') {
      listSinceProjectRead = 0;
      assert.deepEqual(config.params, { 'populate[0]': 'organization' });
      return respond({ data: { organization: { documentId: projectOrganization } } });
    }
    if (config.method === 'get' && config.url === '/api/external-participants') {
      // The real controller ignores pagination and returns ALL matches, without meta.
      // Abort synchronously on request 2: a regression cannot loop or reach sockets.
      listSinceProjectRead += 1;
      assert.ok(listSinceProjectRead <= 1,
        `BOUNDED_PAGINATION_ABORT: unexpected contact request ${listSinceProjectRead}, page ${request.page}`);
      assert.deepEqual(config.params, {
        ...(scoped ? {
        'filters[organization][documentId][$eq]': 'org-a',
        'filters[$or][0][sourceProject][documentId][$eq]': 'project-a',
        'filters[$or][1][sourceProject][documentId][$null]': true,
        } : {}),
        'pagination[pageSize]': 100, 'pagination[withCount]': true, 'pagination[page]': 1,
      });
      return respond({ data: rows });
    }
    if (config.method === 'post' && config.url === '/api/external-participants') {
      const fields = (request.data as any).data;
      const created = { documentId: 'created-contact', ...fields };
      rows.push(created);
      return respond({ data: created });
    }
    if (config.method === 'put' && config.url?.startsWith('/api/external-participants/contact-')) {
      const existing = rows.find(row => config.url === `/api/external-participants/${row.documentId}`);
      assert.ok(existing);
      Object.assign(existing, (request.data as any).data);
      return respond({ data: existing });
    }
    assert.fail(`Unexpected endpoint (accounts/invites forbidden): ${config.method} ${config.url}`);
  };
  service.Http.defaults.adapter = adapter;
  return requests;
}

for (const count of [99, 100, 137]) {
  test(`component load returns all ${count} contacts once with no pagination metadata`, async t => {
    const rows = Array.from({ length: count }, (_, index) => contact(index));
    const requests = controllerBoundary(rows);
    const snapshot = await service.componentLoad(scope)();
    assert.deepEqual(snapshot.contacts, rows);
    assert.equal(new Set(snapshot.contacts.map(row => row.documentId)).size, count);
    assert.deepEqual(requests, [{ method: 'get', url: '/api/projects/project-a' },
      { method: 'get', url: '/api/external-participants', page: 1 }]);
    t.diagnostic(JSON.stringify({ count, requests, returned: snapshot.contacts.length }));
  });
}

test('100-contact controller reproduction bounds the broken default paginator at page 2', async () => {
  controllerBoundary(Array.from({ length: 100 }, (_, index) => contact(index)));
  await assert.rejects(service.listDocuments('/api/external-participants', {
    'filters[organization][documentId][$eq]': 'org-a',
    'filters[$or][0][sourceProject][documentId][$eq]': 'project-a',
    'filters[$or][1][sourceProject][documentId][$null]': true,
  }), /BOUNDED_PAGINATION_ABORT: unexpected contact request 2, page 2/);
});

test('create and edit reread all >100 contacts before writing, with no accounts or invitations', async t => {
  const rows = Array.from({ length: 137 }, (_, index) => contact(index));
  const requests = controllerBoundary(rows);
  const load = service.componentLoad(scope);
  await load();
  const boundary = { load, create: service.createExternalParticipant,
    update: (id: string, fields: Record<string, unknown>) => service.updateDocument('/api/external-participants', id, fields) };
  await service.saveProjectExternalContact(scope, { name: 'New contact', email: 'new@example.test', role: 'Cliente UAT' }, boundary);
  await service.saveProjectExternalContact(scope, { documentId: 'contact-136', name: 'Edited last contact' }, boundary);
  const snapshot = await load();
  assert.equal(snapshot.contacts.length, 138);
  assert.equal(snapshot.contacts.find(row => row.documentId === 'contact-136')?.name, 'Edited last contact');
  assert.deepEqual(requests.map(request => `${request.method} ${request.url}`), [
    'get /api/projects/project-a', 'get /api/external-participants',
    'get /api/projects/project-a', 'get /api/external-participants', 'post /api/external-participants',
    'get /api/projects/project-a', 'get /api/external-participants', 'put /api/external-participants/contact-136',
    'get /api/projects/project-a', 'get /api/external-participants',
  ]);
  assert.deepEqual(requests[4].data, { data: { name: 'New contact', email: 'new@example.test', role: 'Cliente UAT',
    organization: { documentId: 'org-a' }, sourceProject: { documentId: 'project-a' } } });
  assert.deepEqual(requests[7].data, { data: { name: 'Edited last contact', email: '', role: '' } });
  t.diagnostic(JSON.stringify({ requests, returned: snapshot.contacts.length }));
});

test('reread catches duplicates beyond row 100 and preserves sourceProject and tenant restrictions', async () => {
  const rows = Array.from({ length: 137 }, (_, index) => contact(index));
  rows.push({ ...contact(200), organization: { documentId: 'org-b', name: 'Other' } },
    { ...contact(201), sourceProject: { documentId: 'project-b', name: 'Other' } });
  const requests = controllerBoundary(rows);
  const load = service.componentLoad(scope);
  assert.equal((await load()).contacts.length, 137);
  const boundary = { load, create: service.createExternalParticipant,
    update: (id: string, fields: Record<string, unknown>) => service.updateDocument('/api/external-participants', id, fields) };
  await assert.rejects(service.saveProjectExternalContact(scope, { name: 'Contact 136' }, boundary), /existe/i);
  for (const documentId of ['contact-0', 'contact-200', 'contact-201']) {
    await assert.rejects(service.saveProjectExternalContact(scope, { documentId, name: 'Forbidden' }, boundary), /proyecto/i);
  }
  assert.ok(requests.every(request => request.method === 'get'));
  const mismatchRequests = controllerBoundary(rows, 'org-b');
  await assert.rejects(load(), /organización/i);
  assert.deepEqual(mismatchRequests, [{ method: 'get', url: '/api/projects/project-a' }]);
});

for (const count of [100, 137]) {
  for (const project of [undefined, 'project-a']) {
    test(`UAT directory returns ${count} contacts once and preserves project filter ${project}`, async t => {
      const rows = Array.from({ length: count }, (_, index) => contact(index));
      rows[count - 1].sourceProject = { documentId: 'project-b', name: 'Other project' };
      const requests = controllerBoundary(rows, 'org-a', false);
      const result = await service.getExternalParticipants(project);
      const expected = project ? rows.filter(row => row.sourceProject?.documentId === project) : rows;
      assert.deepEqual(result, expected);
      assert.deepEqual(requests, [{ method: 'get', url: '/api/external-participants', page: 1 }]);
      t.diagnostic(JSON.stringify({ count, project, requests, returned: result.length }));
    });
  }
}

test('pagination harness blocks real socket connections', () => {
  const socket = new Socket();
  try {
    assert.throws(() => socket.connect(9, '127.0.0.1'), /EXTERNAL_CONTACT_NETWORK_BLOCKED/);
  } finally {
    socket.destroy();
  }
});
