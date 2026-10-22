import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { loadPdfInlineImage, validatePdfImageSource, validatePdfImageDimensions } from '../src/utils/pdfInlineImage';
import { TestRunPdfLayout } from '../src/utils/testRunPdfLayout';

// New synthetic RGB stripes (3 x 1 pixels), not user screenshots.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAABCAIAAACUgoPjAAAADklEQVR4nGP4z8DAAMYADvsC/gkcFjQAAAAASUVORK5CYII=';

test('inline images validate only PNG/JPEG data and explicit HTTP(S) URLs', async () => {
  assert.equal(await loadPdfInlineImage(png), png);
  assert.equal(validatePdfImageSource(' https://example.invalid/image.png '), 'https://example.invalid/image.png');
  assert.equal(validatePdfImageSource('http://127.0.0.1:39999/image.jpg'), 'http://127.0.0.1:39999/image.jpg');
  for (const value of ['', '/relative.png', '//example.invalid/a', 'javascript:alert(1)', 'file:///C:/secret.png', 'blob:https://example.invalid/id', 'data:text/html;base64,AAAA', 'data:image/svg+xml;base64,AAAA', 'https://user:password@example.invalid/x']) {
    assert.throws(() => validatePdfImageSource(value), /PDF_IMAGE_/);
  }
  for (const [width, height] of [[0, 1], [-1, 1], [Infinity, 1], [10000, 10000]]) {
    assert.throws(() => validatePdfImageDimensions(width, height), /PDF_IMAGE_INVALID_DIMENSIONS/);
  }
});

test('a failed HTTP image rejects explicitly without real network', async () => {
  const previous = globalThis.Image;
  class FailedImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) { if (value) queueMicrotask(() => this.onerror?.()); }
  }
  globalThis.Image = FailedImage as unknown as typeof Image;
  try { await assert.rejects(loadPdfInlineImage('https://example.invalid/fail.png'), /PDF_IMAGE_LOAD_FAILED/); }
  finally { globalThis.Image = previous; }
});

test('a stalled HTTP image has a bounded explicit timeout', async () => {
  const previousImage = globalThis.Image;
  const previousTimeout = globalThis.setTimeout;
  class StalledImage { src = ''; onload = null; onerror = null; }
  globalThis.Image = StalledImage as unknown as typeof Image;
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    assert.equal(delay, 10_000);
    queueMicrotask(callback);
    return undefined;
  }) as unknown as typeof setTimeout;
  try { await assert.rejects(loadPdfInlineImage('https://example.invalid/stalled.png'), /PDF_IMAGE_LOAD_TIMEOUT/); }
  finally { globalThis.Image = previousImage; globalThis.setTimeout = previousTimeout; }
});

test('real jsPDF embeds an inline PNG and keeps later text and explicit failure', async () => {
  const pdf = new jsPDF();
  const layout = new TestRunPdfLayout(pdf, 'Synthetic unit PDF');
  await layout.richSection('Steps', [
    { kind: 'text', text: 'BEFORE' }, { kind: 'image', source: png, alt: 'Synthetic stripes' },
    { kind: 'text', text: 'AFTER' }, { kind: 'image', source: 'javascript:alert(1)', alt: '' },
    { kind: 'text', text: 'END' },
  ]);
  layout.finish();
  const output = pdf.output();
  assert.ok(output.includes('/Subtype /Image'));
  assert.ok(output.indexOf('BEFORE') < output.indexOf('/I0 Do'));
  assert.ok(output.indexOf('/I0 Do') < output.indexOf('AFTER'));
  assert.ok(output.includes('Imagen no disponible'));
  assert.ok(output.includes('END'));
  assert.ok(!output.includes('javascript:'));
});

test('large images fit below even a long continuation heading', async () => {
  const pdf = new jsPDF();
  const layout = new TestRunPdfLayout(pdf, 'Synthetic long heading PDF');
  layout.startCase('Synthetic long case title '.repeat(55), 'Synthetic metadata', 'Passed');
  layout.y = layout.bottom - 5;
  const addImage = pdf.addImage.bind(pdf);
  const placements: Array<{ y: number; height: number }> = [];
  pdf.addImage = ((data: string, format: string, x: number, y: number, width: number, height: number) => {
    placements.push({ y, height });
    return addImage(data, format, x, y, width, height);
  }) as typeof pdf.addImage;
  // Use a real PNG with a tall declared image size to exercise placement only.
  const properties = pdf.getImageProperties.bind(pdf);
  pdf.getImageProperties = ((data: string) => ({ ...properties(data), width: 180, height: 1600 })) as typeof pdf.getImageProperties;
  await layout.richSection('Inline image', [{ kind: 'image', source: png, alt: '' }]);
  assert.equal(placements.length, 1);
  assert.ok(placements[0].y + placements[0].height <= layout.bottom, JSON.stringify(placements));
});
