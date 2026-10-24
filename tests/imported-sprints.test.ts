import assert from 'node:assert/strict';
import test from 'node:test';
import { syncImportedSprints } from '../src/modules/settings/services/importedSprints';
import type { Sprint } from '../src/types';

const sprint = (name: string, projectId = 'P'): Sprint => ({ id: name, projectId, name, startDate: '', endDate: '', status: 'Planeado', objective: '' });

test('creates a missing imported sprint once, verifies it and reuses its canonical name', async () => {
  const stored = [sprint('Sprint existing')];
  const writes: Sprint[] = [];
  const rows = [{ Sprint: ' Sprint new ' }, { sprint: 'sprint   NEW' }, { Sprint: 'SPRINT EXISTING' }, { Sprint: '' }];
  const io = {
    list: async () => stored.map(item => ({ ...item })),
    save: async (item: Sprint) => { writes.push(item); stored.push({ ...item, id: 'created' }); return stored.at(-1)!; },
  };
  const result = await syncImportedSprints(rows, 'P', io);
  assert.deepEqual(result.createdSprintNames, ['Sprint new']);
  assert.deepEqual(result.sprintNames, ['Sprint existing', 'Sprint new']);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].projectId, 'P');
  assert.equal(writes[0].startDate, '');
  assert.equal(writes[0].endDate, '');
  assert.equal(writes[0].status, 'Planeado');
  assert.deepEqual((await syncImportedSprints(rows, 'P', io)).createdSprintNames, []);
  assert.equal(writes.length, 1);
});

test('reads fresh project sprints, never modifies existing ones or reuses foreign sprints', async () => {
  const stored = [sprint('Sprint other', 'OTHER'), sprint('Sprint existing')];
  const writes: Sprint[] = [];
  await syncImportedSprints([{ Sprint: 'Sprint other' }, { Sprint: 'SPRINT EXISTING' }], 'P', {
    list: async () => stored,
    save: async item => { writes.push(item); stored.push(item); return item; },
  });
  assert.deepEqual(writes.map(item => item.name), ['Sprint other']);
  assert.equal(writes[0].projectId, 'P');
});

test('stops on read failures, save failures and unverifiable saves', async () => {
  let writes = 0;
  await assert.rejects(syncImportedSprints([{ Sprint: 'Sprint new' }], 'P', {
    list: async () => { throw new Error('read failed'); },
    save: async item => { writes++; return item; },
  }), /read failed/);
  assert.equal(writes, 0);
  await assert.rejects(syncImportedSprints([{ Sprint: 'Sprint new' }], 'P', {
    list: async () => [], save: async () => { throw new Error('save failed'); },
  }), /save failed/);
  await assert.rejects(syncImportedSprints([{ Sprint: 'Sprint new' }], 'P', {
    list: async () => [], save: async item => item,
  }), /verificar/);
});

test('requires project context before any effects', async () => {
  let calls = 0;
  await assert.rejects(syncImportedSprints([{ Sprint: 'Sprint new' }], undefined, {
    list: async () => { calls++; return []; },
    save: async item => { calls++; return item; },
  }), /proyecto/);
  assert.equal(calls, 0);
});
