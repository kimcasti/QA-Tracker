import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AutomationStatus, type TestCase } from '../src/types';
import { manualCasesForFunctionalities } from '../src/modules/test-cases/utils/automationCandidates';
import { saveBatch } from '../src/modules/test-cases/utils/saveBatch';

const item = (id: string, functionalityId: string, automationStatus?: AutomationStatus, projectId = 'p', isAutomated = false) =>
  ({ id, projectId, functionalityId, automationStatus, isAutomated, title: id } as TestCase);

test('selects only manual cases across selected functionalities in the current project', () => {
  const cases = [item('a', 'one', AutomationStatus.NOT_AUTOMATED), item('b', 'two'),
    item('c', 'one', AutomationStatus.AUTOMATED), item('d', 'two', AutomationStatus.CANDIDATE),
    item('e', 'two', AutomationStatus.OBSOLETE), item('f', 'other'), item('g', 'one', undefined, 'other'),
    item('h', 'one', undefined, 'p', true)];
  assert.deepEqual(manualCasesForFunctionalities(cases, 'p', ['one', 'two', 'empty']).map(row => row.id), ['a', 'b']);
  assert.deepEqual(manualCasesForFunctionalities(cases, 'p', ['empty']), []);
  assert.deepEqual(manualCasesForFunctionalities(cases, 'p', []), []);
  assert.equal(cases[0].automationStatus, AutomationStatus.NOT_AUTOMATED);
});

test('partial writes report confirmed and pending cases; retry omits saved candidates', async () => {
  const cases = [item('a', 'one'), item('b', 'two'), item('c', 'two')];
  const result = await saveBatch(cases, async row => {
    if (row.id === 'b') throw new Error('No disponible');
    row.automationStatus = AutomationStatus.CANDIDATE;
    return row;
  });
  assert.equal(result.confirmed.length, 1);
  assert.equal(result.failed?.localId, 'b');
  assert.deepEqual(result.pending.map(row => row.id), ['b', 'c']);
  assert.deepEqual(manualCasesForFunctionalities(cases, 'p', ['one', 'two']).map(row => row.id), ['b', 'c']);
});
