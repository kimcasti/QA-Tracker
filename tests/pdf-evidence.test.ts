import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsPDF } from 'jspdf';
import { normalizePdfEvidenceBody } from '../src/utils/pdfEvidenceText';

test('evidence symbols inside paragraphs do not force invalid UTF-16 PDF text', () => {
  const raw = 'El valor debe guardarse y mostrarse al consultar el reporte. ✅\nEdición correcta ⚠️ Error ❌';
  const pdf = new jsPDF();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(raw, 14, 20);
  assert.ok(pdf.output().includes('\x00'), 'reproduce the original encoding defect');

  const fixed = new jsPDF();
  fixed.setFont('helvetica', 'normal');
  fixed.setFontSize(10);
  const text = normalizePdfEvidenceBody(raw);
  assert.equal(text, 'El valor debe guardarse y mostrarse al consultar el reporte. [Verificado]\nEdición correcta [Advertencia] Error [Error]');
  fixed.text(fixed.splitTextToSize(text, 182), 14, 20);
  assert.ok(!fixed.output().includes('\x00'));
});

test('long evidence and URLs wrap within the available width', () => {
  const pdf = new jsPDF();
  pdf.setFontSize(10);
  const text = normalizePdfEvidenceBody(('Notas: actualización exitosa ✅ https://example.com/' + 'a'.repeat(220) + '\n').repeat(30));
  const lines: string[] = pdf.splitTextToSize(text, 174);
  assert.ok(lines.length > 50);
  for (const line of lines) assert.ok(pdf.getTextWidth(line) <= 174.01);
});

test('preserves Spanish, paragraphs and punctuation while handling invisible or unsupported characters', () => {
  assert.equal(normalizePdfEvidenceBody('Edicio\u0301n “válida”\u200b\nNiñez: pingüino 🧪'), 'Edición “válida”\nNiñez: pingüino [U+1F9EA]');
});
