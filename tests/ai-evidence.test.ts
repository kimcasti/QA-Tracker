import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiEvidenceParagraph, replaceEvidenceText } from '../src/utils/aiEvidence';

test('formats screen names and routes while keeping model HTML as literal text', () => {
  const paragraph = aiEvidenceParagraph('Permaneció en **Login** (`/login`). <img src=x onerror=alert(1)>');
  assert.equal(paragraph.type, 'paragraph');
  assert.deepEqual(paragraph.content?.[1], { type: 'text', text: 'Login', marks: [{ type: 'bold' }] });
  assert.deepEqual(paragraph.content?.[3], { type: 'text', text: '/login', marks: [{ type: 'code' }] });
  assert.ok(paragraph.content?.every(node => node.type === 'text'));
  assert.ok(paragraph.content?.at(-1)?.text?.includes('<img'));
});

test('replaces the log with one paragraph and preserves every image including nested images', () => {
  const first = { type: 'image', attrs: { src: 'data:image/png;base64,test', alt: 'captura' } };
  const second = { type: 'image', attrs: { src: 'https://example.test/evidence.png' } };
  const document = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Error original' }, first] },
    second,
  ] };
  const result = replaceEvidenceText(document, 'La prueba falló.');
  assert.deepEqual(result.content, [aiEvidenceParagraph('La prueba falló.'), first, second]);
  assert.equal(document.content.length, 2);
});
