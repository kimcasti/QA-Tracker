import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedBriefConclusions } from '../src/utils/wireframeBriefReview';

test('only explicitly reviewed nonempty lines become confirmed conclusions', () => {
  assert.deepEqual(confirmedBriefConclusions('  El usuario confirma el flujo.\n\nEl usuario confirma el flujo.\n Se requiere búsqueda. '), ['El usuario confirma el flujo.', 'Se requiere búsqueda.']);
  assert.deepEqual(confirmedBriefConclusions(''), []);
});

test('oversized confirmation cannot silently truncate approval', () => {
  assert.throws(() => confirmedBriefConclusions('x'.repeat(8001)), /8000/);
  assert.throws(() => confirmedBriefConclusions(Array.from({length:31},(_,i)=>`Punto ${i}`).join('\n')), /20/);
  assert.throws(() => confirmedBriefConclusions(Array.from({length:21},(_,i)=>`Punto ${i}`).join('\n')), /20/);
  assert.throws(() => confirmedBriefConclusions('x'.repeat(1001)), /1000/);
});
