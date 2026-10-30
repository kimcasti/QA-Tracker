import test from 'node:test';
import assert from 'node:assert/strict';
import * as lifecycle from '../src/modules/test-runs/utils/publicUatSessionLifecycle';
import { ExecutionStatus, type PublicUatSessionSummary } from '../src/types';

const current = { documentId: 'synthetic', status: 'completed', completionLocked: true,
  expiresAt: '2099-01-01T00:00:00.000Z' } satisfies PublicUatSessionSummary;
const presentation = (session: PublicUatSessionSummary | null, status = ExecutionStatus.FINAL) => {
  assert.equal(typeof lifecycle.describePublicUatSession, 'function', 'independent public UAT presentation is available');
  return lifecycle.describePublicUatSession(session, status);
};
test('active sessions distinguish expiry, completion locks and individual editing permissions', () => {
  const active = { ...current, status: 'active' as const, completionLocked: false,
    allowResultEditing: true, allowEvidenceUpload: true, allowCommentEditing: true };
  assert.equal(presentation(active, ExecutionStatus.DRAFT).editing, 'Permitida');
  assert.equal(presentation(active, ExecutionStatus.DRAFT).execution, 'En curso');
  assert.equal(presentation({ ...active, expiresAt: '2000-01-01T00:00:00.000Z' }).editing, 'No disponible por caducidad');
  assert.equal(presentation({ ...active, completionLocked: true }).editing, 'Bloqueada por finalización');
  assert.equal(presentation({ ...active, allowEvidenceUpload: false }).editing, 'Permitida con permisos limitados');
  assert.equal(presentation({ ...active, allowResultEditing: false, allowEvidenceUpload: false, allowCommentEditing: false }).editing, 'No permitida por configuración');
});

test('revocation, missing activation and unknown expiry never claim usable access', () => {
  assert.equal(presentation({ ...current, status: 'revoked' }).access, 'Revocado');
  assert.equal(presentation({ ...current, status: 'revoked' }).editing, 'No disponible por revocación');
  assert.equal(presentation({ ...current, status: 'active', revokedAt: '2026-01-01' }).access, 'Revocado');
  for (const absent of [null, { ...current, status: 'draft' as const }]) {
    assert.equal(presentation(absent).access, 'Sin activar');
    assert.equal(presentation(absent).editing, 'No disponible');
  }
  for (const status of ['active', 'expired'] as const) {
    for (const expiresAt of [null, '', 'invalid', '1', '2099-02-31T00:00:00.000Z', '2099-01-01T24:00:00Z']) {
      const invalid = presentation({ ...current, status, completionLocked: false, expiresAt });
      assert.equal(invalid.access, 'No disponible: caducidad desconocida');
      assert.equal(invalid.editing, 'No disponible');
    }
  }
  assert.equal(presentation({ ...current, status: 'expired' }).access, 'Vencido');
});

test('completion locks editing independently of link expiration and execution progress', () => {
  const valid = presentation(current);
  assert.equal(valid.execution, 'Finalizada');
  assert.match(valid.access, /^Vigente hasta /);
  assert.equal(valid.editing, 'Bloqueada por finalización');
  const expired = presentation({ ...current, expiresAt: '2000-01-01T00:00:00.000Z' });
  assert.equal(expired.access, 'Vencido');
  assert.equal(expired.editing, 'Bloqueada por finalización');
});
