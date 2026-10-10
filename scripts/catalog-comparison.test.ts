import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareCatalog, suggestCatalogCases } from '../src/modules/automation/utils/catalogComparison';
import type { CatalogCase } from '../src/modules/automation/services/catalogService';
const item = (id: string, title: string, reference = '', status = 'automated') => ({ id, title, reference, status } as CatalogCase);
test('compares exact references and includes owners in any status, missing cases and duplicates', () => {
  const cases = [item('a', 'Login', 'Auth::Login', 'not_automated'), item('b', 'Login duplicate', 'Auth::Login', 'obsolete'),
    item('c', 'Missing'), item('d', 'Old', 'old::test'), item('e', 'Candidate', '', 'candidate')];
  const result = compareCatalog(['Auth::Login', 'auth::login', 'new::test', 'duplicate::test', 'duplicate::test'], cases);
  assert.deepEqual(result.unassigned, ['auth::login', 'new::test']);
  assert.deepEqual(result.missing.map(item => item.id), ['c', 'd']);
  assert.equal(result.registered[0].cases.length, 2);
  assert.deepEqual(result.duplicated.map(item => item.reference), ['Auth::Login', 'duplicate::test']);
});
test('does not suggest an already linked case and displace its existing test', () => {
  const reference = 'patients/emergency.spec.ts::Registro de actividad en seguimiento';
  const cases = [item('linked', 'Registro de actividad en seguimiento', 'follow-up/note.spec.ts::Agregar nota'),
    item('free', 'Registro de actividad en seguimiento', '', 'not_automated')];
  assert.deepEqual(suggestCatalogCases(reference, cases).map(item => item.id), ['free']);
  assert.deepEqual(suggestCatalogCases(reference, cases.slice(0, 1)), []);
  assert.equal(cases[0].reference, 'follow-up/note.spec.ts::Agregar nota');
});

test('suggests at most three cases using title tokens, accents and threshold without altering selection', () => {
  const cases = [item('a', 'INICIAR SESIÓN válida'), item('b', 'Iniciar sesión'), item('c', 'Iniciar sesión con credenciales'),
    item('d', 'Iniciar sesión usuario'), item('e', 'Cerrar cuenta'), item('f', 'Inicio')];
  const copy = structuredClone(cases);
  assert.deepEqual(suggestCatalogCases('auth/login.spec.ts::iniciar sesion', cases).map(item => item.id), ['b', 'd', 'a']);
  assert.deepEqual(suggestCatalogCases('auth::ir a', cases), []);
  assert.deepEqual(cases, copy);
});
