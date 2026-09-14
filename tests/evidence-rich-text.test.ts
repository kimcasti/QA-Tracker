import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeEvidenceContentWithImage, normalizeEvidenceHtml } from '../src/utils/evidenceRichText';

test('preserves literal HTML in automation errors and attaches the screenshot once', () => {
  const notes = '<p><strong>Resultado obtenido:</strong></p><p>Expected &lt;button&gt; &amp; &quot;Save&quot;</p>';
  const image = 'data:image/png;base64,aGVsbG8=';
  assert.equal(normalizeEvidenceHtml(notes), notes);
  const merged = mergeEvidenceContentWithImage(notes, image);
  assert.ok(merged.startsWith(notes));
  assert.equal((merged.match(/<img /g) || []).length, 1);
  assert.equal(mergeEvidenceContentWithImage(merged, image), merged);
});

test('keeps compatibility with legacy encoded HTML and plain notes', () => {
  assert.equal(normalizeEvidenceHtml('&lt;p&gt;Nota&lt;/p&gt;'), '<p>Nota</p>');
  assert.equal(normalizeEvidenceHtml('Primera línea\nSegunda línea'), '<p>Primera línea</p><p>Segunda línea</p>');
});
