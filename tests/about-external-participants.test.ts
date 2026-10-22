import test from 'node:test';
import assert from 'node:assert/strict';
import * as externalContacts from '../src/components/about/projectExternalParticipants';
const { selectProjectExternalContacts } = externalContacts;
const saveProjectExternalContact = (...args: any[]) => {
  assert.equal(typeof (externalContacts as any).saveProjectExternalContact, 'function', 'contact save workflow must exist');
  return (externalContacts as any).saveProjectExternalContact(...args);
};

const contact = (documentId: string, organization = 'org-a', project: string | null = 'project-a') => ({
  documentId, name: documentId, organization: { documentId: organization },
  sourceProject: project ? { documentId: project } : null,
});

test('external contacts include only this project and its organization directory, never other projects/tenants', () => {
  const contacts = [contact('project-contact'), contact('directory-contact', 'org-a', null),
    contact('other-project', 'org-a', 'project-b'), contact('foreign', 'org-b'),
    { documentId: 'unknown', name: 'Unknown' }];
  assert.deepEqual(selectProjectExternalContacts(contacts, 'org-a', 'project-a').map(c => c.documentId),
    ['project-contact', 'directory-contact']);
  assert.deepEqual(selectProjectExternalContacts(contacts, '', 'project-a'), []);
  assert.deepEqual(selectProjectExternalContacts(contacts, 'org-a', ''), []);
});

test('scoped loader verifies the real project organization before fetching contacts and requests project-or-directory only', async () => {
  assert.equal(typeof (externalContacts as any).loadProjectExternalContacts, 'function', 'scoped loader must exist');
  const calls: unknown[] = [];
  const transport = {
    getProject: async (id: string) => { calls.push(['project', id]); return { organization: { documentId: 'org-a' } }; },
    listContacts: async (params: unknown) => { calls.push(params); return [contact('owned'), contact('foreign', 'org-b')]; },
  };
  const result = await (externalContacts as any).loadProjectExternalContacts('org-a', 'project-a', transport);
  assert.deepEqual(result.contacts.map((c: any) => c.documentId), ['owned']);
  assert.deepEqual(calls, [['project', 'project-a'], {
    'filters[organization][documentId][$eq]': 'org-a',
    'filters[$or][0][sourceProject][documentId][$eq]': 'project-a',
    'filters[$or][1][sourceProject][documentId][$null]': true,
  }]);
  calls.length = 0;
  await assert.rejects((externalContacts as any).loadProjectExternalContacts('org-b', 'project-a', transport), /organización/i);
  assert.deepEqual(calls, [['project', 'project-a']]);
});

const scope = { organizationDocumentId: 'org-a', projectDocumentId: 'project-a',
  roleCode: 'manager', membershipStatus: 'active' };
function boundary(contacts: externalContacts.ExternalContact[] = []) {
  const writes: unknown[] = [];
  return { writes,
    load: async () => ({ organizationDocumentId: 'org-a', contacts }),
    create: async (input: unknown) => { writes.push(input); },
    update: async (id: string, input: unknown) => { writes.push({ id, input }); },
  };
}

test('adding an external uses only the contact boundary, never membership, invitation or authenticated role payloads', async () => {
  const deps = boundary();
  await saveProjectExternalContact(scope, { name: '  Cliente UAT ', email: ' QA@example.test ' }, deps);
  assert.deepEqual(deps.writes, [{ name: 'Cliente UAT', email: 'QA@example.test', role: '',
    organizationDocumentId: 'org-a', sourceProjectDocumentId: 'project-a' }]);
});

test('viewer, unknown/inactive membership and mismatched project organization cannot write', async () => {
  for (const denied of [{ ...scope, roleCode: 'viewer' }, { ...scope, roleCode: '' },
    { ...scope, membershipStatus: 'inactive' }, { ...scope, projectDocumentId: '' }]) {
    const deps = boundary();
    await assert.rejects(saveProjectExternalContact(denied, { name: 'Client' }, deps), /permiso|contexto/i);
    assert.deepEqual(deps.writes, []);
  }
  const deps = boundary();
  deps.load = async () => ({ organizationDocumentId: 'org-b', contacts: [] });
  await assert.rejects(saveProjectExternalContact(scope, { name: 'Client' }, deps), /organización/i);
  assert.deepEqual(deps.writes, []);
});

test('same-project and organization-directory duplicates are rejected; a different project is not moved or reused', async () => {
  for (const existing of [contact('Client'), contact('Client', 'org-a', null)]) {
    const deps = boundary([existing]);
    await assert.rejects(saveProjectExternalContact(scope, { name: ' client ' }, deps), /existe/i);
    assert.deepEqual(deps.writes, []);
  }
  const deps = boundary([contact('Client', 'org-a', 'project-b'), contact('Client', 'org-b')]);
  await saveProjectExternalContact(scope, { name: 'Client' }, deps);
  assert.equal(deps.writes.length, 1);
  assert.equal((deps.writes[0] as any).sourceProjectDocumentId, 'project-a');
});

test('duplicate emails are case insensitive; distinct named contacts with distinct emails remain possible', async () => {
  const deps = boundary([{ ...contact('existing'), name: 'Client', email: 'client@example.test' }]);
  await assert.rejects(saveProjectExternalContact(scope, { name: 'Other name', email: 'CLIENT@example.test' }, deps), /existe/i);
  await saveProjectExternalContact(scope, { name: 'Client', email: 'other@example.test' }, deps);
  assert.equal(deps.writes.length, 1);
});

test('editing changes contact fields only; foreign, directory-wide and missing contacts cannot be edited from project', async () => {
  const deps = boundary([contact('owned'), contact('directory', 'org-a', null), contact('other', 'org-a', 'project-b')]);
  await saveProjectExternalContact(scope, { documentId: 'owned', name: 'Updated', role: 'Cliente UAT' }, deps);
  assert.deepEqual(deps.writes, [{ id: 'owned', input: { name: 'Updated', email: '', role: 'Cliente UAT' } }]);
  for (const documentId of ['directory', 'other', 'missing']) {
    await assert.rejects(saveProjectExternalContact(scope, { documentId, name: 'Updated' }, deps), /proyecto/i);
  }
  assert.equal(deps.writes.length, 1);
});
