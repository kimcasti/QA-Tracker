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

test('deleting an owned contact rereads scope, deletes exactly once and verifies exact target absence', async () => {
  const calls: string[] = [];
  let contacts = [contact('owned'), contact('other')];
  const remove = (externalContacts as any).deleteProjectExternalContact;
  assert.equal(typeof remove, 'function', 'scoped contact delete workflow must exist');
  await remove(scope, 'owned', {
    load: async () => { calls.push('load'); return { organizationDocumentId: 'org-a', contacts }; },
    remove: async (id: string) => { calls.push(`DELETE ${id}`); contacts = contacts.filter(c => c.documentId !== id); },
  });
  assert.deepEqual(calls, ['load', 'DELETE owned', 'load']);
  assert.deepEqual(contacts.map(c => c.documentId), ['other']);
});

test('lost DELETE response after commit reconciles fresh absence instead of leaving a stale editable contact', async () => {
  let contacts = [contact('owned'), contact('other')];
  const calls: string[] = [];
  const verified = await externalContacts.deleteProjectExternalContact(scope, 'owned', {
    load: async () => { calls.push('load'); return { organizationDocumentId: 'org-a', contacts }; },
    remove: async id => {
      calls.push(`DELETE ${id}`);
      contacts = contacts.filter(c => c.documentId !== id);
      throw new Error('DELETE response lost after server commit');
    },
  });
  assert.deepEqual(calls, ['load', 'DELETE owned', 'load']);
  assert.deepEqual(verified.contacts.map(c => c.documentId), ['other']);
});

test('lost DELETE response with failed reconciliation enters an honest unknown-outcome lock', async () => {
  let contacts = [contact('owned')];
  let loads = 0; let deletes = 0;
  await assert.rejects(externalContacts.deleteProjectExternalContact(scope, 'owned', {
    load: async () => {
      if (++loads > 1) throw new Error('Reconciliation offline');
      return { organizationDocumentId: 'org-a', contacts };
    },
    remove: async () => {
      deletes++;
      contacts = [];
      throw new Error('DELETE response lost after server commit');
    },
  }), (error: unknown) => {
    assert.ok(error instanceof externalContacts.ExternalContactDeletionUnverifiedError);
    assert.equal(error.message, 'No pudimos verificar el resultado de la eliminación. Actualiza la lista antes de reintentar.');
    assert.doesNotMatch(error.message, /aceptada|eliminado/i);
    return true;
  });
  assert.equal(loads, 2);
  assert.equal(deletes, 1);
  assert.deepEqual(contacts, []);
});

test('delete denies viewer/inactive/missing context and fresh shared, foreign, missing or moved targets without any DELETE', async () => {
  const remove = (externalContacts as any).deleteProjectExternalContact;
  for (const denied of [{ ...scope, roleCode: 'viewer' }, { ...scope, membershipStatus: 'inactive' },
    { ...scope, projectDocumentId: '' }, { ...scope, roleCode: '' }]) {
    let loads = 0; const writes: string[] = [];
    await assert.rejects(remove(denied, 'owned', {
      load: async () => { loads++; return { organizationDocumentId: 'org-a', contacts: [contact('owned')] }; },
      remove: async (id: string) => { writes.push(id); },
    }), /permiso|contexto/i);
    assert.equal(loads, 0); assert.deepEqual(writes, []);
  }
  for (const snapshot of [
    { organizationDocumentId: 'org-b', contacts: [contact('owned')] },
    { organizationDocumentId: 'org-a', contacts: [contact('owned', 'org-a', null)] },
    { organizationDocumentId: 'org-a', contacts: [contact('owned', 'org-b')] },
    { organizationDocumentId: 'org-a', contacts: [contact('owned', 'org-a', 'project-b')] },
    { organizationDocumentId: 'org-a', contacts: [] },
  ]) {
    const writes: string[] = [];
    await assert.rejects(remove(scope, 'owned', { load: async () => snapshot,
      remove: async (id: string) => { writes.push(id); } }), /organización|proyecto/i);
    assert.deepEqual(writes, []);
  }
});

test('delete failures propagate; unverified completed DELETE has a distinct warning and never reports success', async () => {
  const remove = (externalContacts as any).deleteProjectExternalContact;
  for (const after of ['read-fails', 'still-present', 'foreign-snapshot']) {
    let loads = 0; let deletes = 0;
    await assert.rejects(remove(scope, 'owned', {
      load: async () => {
        if (++loads === 1) return { organizationDocumentId: 'org-a', contacts: [contact('owned')] };
        if (after === 'read-fails') throw new Error('Transport offline');
        return { organizationDocumentId: after === 'foreign-snapshot' ? 'org-b' : 'org-a',
          contacts: after === 'still-present' ? [contact('owned')] : [] };
      },
      remove: async () => { deletes++; },
    }), /No pudimos verificar el resultado de la eliminación/i);
    assert.equal(deletes, 1);
  }
  let reads = 0;
  const rejected = new Error('DELETE forbidden');
  await assert.rejects(remove(scope, 'owned', {
    load: async () => { reads++; return { organizationDocumentId: 'org-a', contacts: [contact('owned')] }; },
    remove: async () => { throw rejected; },
  }), error => error === rejected);
  assert.equal(reads, 2, 'Even a rejected DELETE is reconciled before restoring edit controls');
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
