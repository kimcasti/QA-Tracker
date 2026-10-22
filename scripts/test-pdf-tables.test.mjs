// Offline real report/jsPDF integration. Artifacts must remain outside Git.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch, 'QA_SECURITY_SCRATCH must point outside the repository');
assert.ok(!resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()));
await mkdir(scratch, { recursive: true });
const bundle = await build({ stdin: { contents: "export { buildTestRunPdf } from './src/utils/reportUtils'; export * from './src/utils/testRunPdfLayout'; export { jsPDF } from 'jspdf';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'PdfHarness', logLevel: 'silent' });
await writeFile(join(scratch, 'pdf-tables-harness.js'), bundle.outputFiles[0].text);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const requests = [];
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic tables</title>' });
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto('https://pdf-fixture.invalid/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const { jsPDF, pdfReportBlocks, pdfReportParagraphs, buildTestRunPdf } = PdfHarness;
    const events = [];
    jsPDF.API.events.push(['initialized', function() {
      for (const method of ['text', 'rect']) {
        const original = this[method];
        this[method] = function(...args) {
          events.push({ method, args, page: this.getNumberOfPages() });
          return original.apply(this, args);
        };
      }
    }]);
    const html = '<p>BEFORE TABLE</p><table><thead><tr><th>Action</th><th>Expected</th></tr></thead><tbody><tr><td><p>Enter &amp; save</p><p>Next line</p></td><td>Saved ≥ 1</td></tr></tbody></table><p>AFTER TABLE</p>';
    const fixture = { testRun: { title: 'Synthetic tables UAT', testType: 'UAT', executionDate: '2026-10-20', status: 'Final' }, testCases: [{ id: 'table-case', title: 'Table case', testSteps: html }], results: [{ testCaseId: 'table-case', functionalityId: 'synthetic', result: 'Aprobado' }], functionalities: [] };
    const pdf = await buildTestRunPdf(fixture);
    return { blocks: pdfReportBlocks(html), paragraphs: pdfReportParagraphs(html), events, output: pdf.output(), data: pdf.output('datauristring').split(',')[1] };
  });
  await writeFile(join(scratch, 'pdf-tables-basic.pdf'), Buffer.from(result.data, 'base64'));
  assert.deepEqual(result.blocks.map(block => block.kind), ['text', 'table', 'text'], 'Tables must remain structured between surrounding paragraphs');
  assert.deepEqual(result.blocks[1].rows, [
    [{ text: 'Action', header: true }, { text: 'Expected', header: true }],
    [{ text: 'Enter & save\nNext line', header: false }, { text: 'Saved >= 1', header: false }],
  ]);
  assert.ok(result.paragraphs.join(' ').includes('Enter & save'), 'Legacy text API retains table text');
  assert.equal(result.events.filter(event => event.method === 'rect').length, 4, 'Real PDF has bordered cells');
  for (const text of ['BEFORE TABLE', 'Action', 'Expected', 'Enter & save', 'Next line', 'Saved >= 1', 'AFTER TABLE']) assert.ok(result.output.includes(text), text);
  assert.ok(result.output.indexOf('BEFORE TABLE') < result.output.indexOf('(Action)'));
  assert.ok(result.output.indexOf('(Action)') < result.output.indexOf('AFTER TABLE'));
  const cellImages = await page.evaluate(async () => {
    const { jsPDF, buildTestRunPdf, pdfReportBlocks } = PdfHarness;
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e5f4ff'; context.fillRect(0, 0, 480, 160);
    context.fillStyle = '#145'; context.font = '24px sans-serif'; context.fillText('SYNTHETIC CELL PNG 3:1', 12, 85);
    const png = canvas.toDataURL('image/png');
    const events = [];
    jsPDF.API.events.push(['initialized', function() {
      for (const method of ['text', 'addImage']) {
        const original = this[method];
        this[method] = function(...args) {
          events.push({ method, args: method === 'addImage' ? args.slice(1) : args, page: this.getNumberOfPages() });
          return original.apply(this, args);
        };
      }
    }]);
    const html = '<p>BEFORE IMAGE TABLE</p><table><caption>IMAGE CAPTION</caption><tr><th>IMAGE HEADER</th><th>PEER HEADER</th></tr>'
      + `<tr><td><p>CELL BEFORE PNG</p><img src="${png}" alt="First cell PNG"><p>CELL AFTER PNG</p></td><td>PEER BEFORE PNG<img src="${png}" alt="Second cell PNG">PEER AFTER PNG</td></tr>`
      + '<tr><td>BLOCKED BEFORE<img src="javascript:alert(1)" alt="Blocked cell">BLOCKED AFTER</td><td>BROKEN BEFORE<img src="data:image/png;base64,AAAA" alt="Broken cell">BROKEN AFTER</td></tr></table><p>AFTER IMAGE TABLE</p>';
    const fixture = { testRun: { title: 'Synthetic cell images', testType: 'UAT', status: 'Final' }, testCases: [{ id: 'cell-images', title: 'Cell image ordering', testSteps: html }], results: [{ testCaseId: 'cell-images', functionalityId: 'synthetic', result: 'Aprobado' }], functionalities: [] };
    const pdf = await buildTestRunPdf(fixture);
    return { events, blocks: pdfReportBlocks(html), images: Object.keys(pdf.internal.collections.addImage_images || {}).length, output: pdf.output(), data: pdf.output('datauristring').split(',')[1] };
  });
  await writeFile(join(scratch, 'pdf-tables-cell-images.pdf'), Buffer.from(cellImages.data, 'base64'));
  await writeFile(join(scratch, 'pdf-tables-cell-images-verification.json'), JSON.stringify(cellImages, null, 2));
  assert.equal(cellImages.images, 1, 'Valid cell PNG must be embedded as a real jsPDF image object (reused for both cells)');
  const imageDraws = cellImages.events.filter(event => event.method === 'addImage');
  assert.equal(imageDraws.length, 2, 'Every valid cell image must actually draw');
  assert.equal((cellImages.output.match(/\/I\d+ Do/g) || []).length, 2, 'PDF contains both image draw operators');
  assert.deepEqual(cellImages.blocks.filter(block => block.kind === 'image').map(block => block.alt), ['First cell PNG', 'Second cell PNG', 'Blocked cell', 'Broken cell']);
  const ordered = ['BEFORE IMAGE TABLE', 'IMAGE CAPTION', 'IMAGE HEADER', 'PEER HEADER', 'CELL BEFORE PNG', 'IMAGE', 'CELL AFTER PNG', 'PEER BEFORE PNG', 'IMAGE', 'PEER AFTER PNG', 'BLOCKED BEFORE', 'BLOCKED AFTER', 'BROKEN BEFORE', 'BROKEN AFTER', 'AFTER IMAGE TABLE'];
  let previous = -1;
  for (const token of ordered) {
    const index = cellImages.events.findIndex((event, index) => index > previous && (token === 'IMAGE' ? event.method === 'addImage' : event.method === 'text' && event.args[0] === token));
    assert.ok(index > previous, `Cell text/image source order: ${token}`); previous = index;
  }
  for (const label of ['Fila 2, columna 1', 'Fila 2, columna 2']) assert.ok(cellImages.output.includes(label), `Linear image fallback retains cell context: ${label}`);
  for (const { args: [, x, y, width, height] } of imageDraws) {
    assert.ok(x >= 16 && x + width <= 194.01 && y >= 22 && y + height <= 277.01, 'Cell images remain within PDF content bounds');
    assert.ok(Math.abs(width / height - 3) < 0.001, 'Cell PNG retains its 3:1 aspect ratio');
  }
  assert.equal((cellImages.output.match(/Imagen no disponible/g) || []).length, 2, 'Blocked and broken cell images retain visible warning placeholders');
  assert.ok(!cellImages.output.includes('javascript:'), 'Failed cell image sources are not exposed');
  assert.deepEqual(requests, [], 'Cell image regression makes zero external/backend requests');
  console.log(JSON.stringify({ ok: true, cellImageObjects: cellImages.images, cellImageDraws: imageDraws.length, cellImageWarnings: 2, requests: requests.length }));
  const advanced = await page.evaluate(async () => {
    const { jsPDF, buildTestRunPdf } = PdfHarness;
    const events = [];
    jsPDF.API.events.push(['initialized', function() {
      for (const method of ['text', 'rect']) {
        const original = this[method];
        this[method] = function(...args) {
          events.push({ method, args, page: this.getNumberOfPages(), width: method === 'text' && typeof args[0] === 'string' ? this.getTextWidth(args[0]) : 0, bold: this.getFont().fontStyle === 'bold' });
          return original.apply(this, args);
        };
      }
    }]);
    const longLines = Array.from({ length: 180 }, (_, index) => `LONG${String(index).padStart(3, '0')}`);
    const rows = Array.from({ length: 90 }, (_, index) => `<tr><td>ROW${String(index).padStart(3, '0')}</td><td>Expected ${index}</td></tr>`).join('');
    const html = '<p>ADVANCED BEFORE</p><table><tr><th>ACTION HEADER</th><th>EXPECTED HEADER</th></tr>' + rows + `<tr><td>${longLines.join('<br>')}</td><td>GIANT ROW PEER</td></tr></table><p>ADVANCED AFTER</p>`
      + '<table><tr>' + Array.from({ length: 12 }, (_, index) => `<th>C${index}</th>`).join('') + '</tr><tr>' + Array.from({ length: 12 }, (_, index) => `<td>WIDE${index}ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789</td>`).join('') + '</tr></table><p>WIDE AFTER</p>';
    const fixture = { testRun: { title: 'Synthetic multi-page table', testType: 'UAT', executionDate: '2026-10-20', status: 'Final' }, testCases: [{ id: 'table-case', title: 'Case with wrapped continuation title '.repeat(7), testSteps: html }], results: [{ testCaseId: 'table-case', functionalityId: 'synthetic', result: 'Aprobado' }], functionalities: [] };
    const pdf = await buildTestRunPdf(fixture);
    return { events, longLines, pages: pdf.getNumberOfPages(), data: pdf.output('datauristring').split(',')[1] };
  });
  await writeFile(join(scratch, 'pdf-tables-multipage.pdf'), Buffer.from(advanced.data, 'base64'));
  await writeFile(join(scratch, 'pdf-tables-verification.json'), JSON.stringify(advanced, null, 2));
  const rectangles = advanced.events.filter(event => event.method === 'rect');
  for (const event of rectangles) {
    const [x, y, width, height] = event.args;
    assert.ok(y >= 22 && y + height <= 277.01, `Table fragment stays above footer: page ${event.page}, y=${y}, height=${height}`);
    assert.ok(x >= 16 && x + width <= 194.01, 'Table stays within horizontal margins');
  }
  const textEvents = advanced.events.filter(event => event.method === 'text');
  for (const token of [...advanced.longLines, ...Array.from({ length: 90 }, (_, index) => `ROW${String(index).padStart(3, '0')}`)]) {
    assert.equal(textEvents.filter(event => event.args[0] === token).length, 1, `${token} must render exactly once`);
  }
  const tablePages = [...new Set(textEvents.filter(event => /^ROW\d|^LONG\d/.test(event.args[0])).map(event => event.page))];
  assert.ok(tablePages.length >= 5, 'Rows and one over-page row span several pages');
  for (const pageNumber of tablePages) {
    assert.ok(textEvents.some(event => event.page === pageNumber && event.args[0] === 'ACTION HEADER' && event.bold), `Repeat header on table page ${pageNumber}`);
  }
  for (const event of textEvents) {
    const cell = rectangles.find(rectangle => rectangle.page === event.page && event.args[1] >= rectangle.args[0] && event.args[1] < rectangle.args[0] + rectangle.args[2] && event.args[2] > rectangle.args[1] && event.args[2] < rectangle.args[1] + rectangle.args[3]);
    if (cell) assert.ok(event.args[1] + event.width <= cell.args[0] + cell.args[2] - 1.9, `Wrapped cell text stays within its border: ${event.args[0]}`);
  }
  assert.ok(textEvents.findIndex(event => event.args[0] === 'ADVANCED BEFORE') < textEvents.findIndex(event => event.args[0] === 'ROW000'));
  assert.ok(textEvents.findIndex(event => event.args[0] === 'LONG179') < textEvents.findIndex(event => event.args[0] === 'ADVANCED AFTER'));
  assert.ok(textEvents.some(event => event.args[0] === 'WIDE AFTER'));
  const fallback = await page.evaluate(async () => {
    const { pdfReportBlocks, buildTestRunPdf, jsPDF } = PdfHarness;
    const rectangles = [], texts = [];
    jsPDF.API.events.push(['initialized', function() {
      const original = this.rect, originalText = this.text;
      this.rect = function(...args) { rectangles.push(args); return original.apply(this, args); };
      this.text = function(...args) { texts.push(args[0]); return originalText.apply(this, args); };
    }]);
    const merged = '<table><caption>PASTED CAPTION</caption><tr><th colspan="2">MERGED HEADER</th></tr><tr><td rowspan="2">MERGED VALUE</td><td>RIGHT ONE</td></tr><tr><td>RIGHT TWO<script>globalThis.UNSAFE_TABLE = true</script><img src="javascript:alert(1)" onerror="globalThis.UNSAFE_TABLE = true"></td></tr></table>';
    const wide = '<table><tr>' + Array.from({ length: 40 }, (_, i) => `<th>H${i}</th>`).join('') + '</tr><tr>' + Array.from({ length: 40 }, (_, i) => `<td>EXTREME${String(i).padStart(2, '0')}</td>`).join('') + '</tr></table>';
    const fixture = { testRun: { title: 'Synthetic pasted tables', testType: 'UAT', status: 'Final' }, testCases: [{ id: 'fallback', title: 'Pasted tables', testSteps: merged + '<table><tr><td colspan="2">TEXT ONLY MERGED VALUE</td></tr></table>' + wide + '<p>FINAL FALLBACK TEXT</p>' }], results: [{ testCaseId: 'fallback', functionalityId: 'synthetic', result: 'Aprobado' }], functionalities: [] };
    const pdf = await buildTestRunPdf(fixture);
    return { blocks: pdfReportBlocks(merged), rectangles, texts, unsafe: Boolean(globalThis.UNSAFE_TABLE), output: pdf.output(), data: pdf.output('datauristring').split(',')[1] };
  });
  await writeFile(join(scratch, 'pdf-tables-pasted.pdf'), Buffer.from(fallback.data, 'base64'));
  assert.ok(fallback.output.includes('Tabla con celdas combinadas'), 'Merged cells require an explicit visible safe fallback');
  for (const text of ['PASTED CAPTION', 'MERGED HEADER', 'MERGED VALUE', 'RIGHT ONE', 'RIGHT TWO', 'FINAL FALLBACK TEXT']) assert.ok(fallback.output.includes(text), text);
  assert.ok(fallback.output.includes('Tabla con celdas combinadas: vista por filas;'), 'Text-only merged cells retain the existing fallback');
  assert.ok(fallback.output.includes('TEXT ONLY MERGED VALUE'));
  assert.equal((fallback.output.match(/Imagen no disponible/g) || []).length, 1, 'Merged image table retains a validated warning');
  assert.equal(fallback.unsafe, false, 'Table HTML must never execute');
  assert.ok(!fallback.output.includes('globalThis.UNSAFE_TABLE'));
  assert.ok(fallback.rectangles.every(([, , width]) => width >= 14), 'Extreme columns use readable bounded-width panels');
  // Word fragments may wrap: every extreme cell remains present without loss.
  assert.ok(fallback.output.includes('columnas 1-12 de 40'), 'Wide panels identify their column range');
  for (let index = 0; index < 40; index++) assert.ok(fallback.texts.join('').includes(`EXTREME${String(index).padStart(2, '0')}`), `Extreme cell ${index}`);
  const tallHeader = await page.evaluate(async () => {
    const { buildTestRunPdf, jsPDF } = PdfHarness;
    const texts = [], rectangles = [];
    jsPDF.API.events.push(['initialized', function() {
      const text = this.text, rect = this.rect;
      this.text = function(...args) { texts.push({ value: args[0], page: this.getNumberOfPages() }); return text.apply(this, args); };
      this.rect = function(...args) { rectangles.push(args); return rect.apply(this, args); };
    }]);
    const header = Array.from({ length: 140 }, (_, index) => `HEAD${String(index).padStart(3, '0')}`).join('<br>');
    const fixture = { testRun: { title: 'Synthetic oversized header', testType: 'UAT', status: 'Final' }, testCases: [{ id: 'tall-header', title: 'Oversized header', testSteps: `<table><tr><th>${header}</th></tr><tr><td>BODY AFTER TALL HEADER</td></tr></table>` }], results: [{ testCaseId: 'tall-header', functionalityId: 'synthetic', result: 'Aprobado' }], functionalities: [] };
    const pdf = await buildTestRunPdf(fixture);
    return { texts, rectangles, data: pdf.output('datauristring').split(',')[1] };
  });
  await writeFile(join(scratch, 'pdf-tables-tall-header.pdf'), Buffer.from(tallHeader.data, 'base64'));
  assert.ok(tallHeader.texts.filter(event => event.value === 'HEAD000').length >= 2, 'Oversized header still repeats a bounded excerpt on continuation');
  assert.ok(tallHeader.texts.some(event => event.value === '[Encabezado resumido]'), 'Truncated repeated furniture is explicit');
  for (let index = 0; index < 140; index++) assert.ok(tallHeader.texts.some(event => event.value === `HEAD${String(index).padStart(3, '0')}`), `Original header line ${index} retained`);
  assert.ok(tallHeader.rectangles.every(([, y, , height]) => y >= 22 && y + height <= 277.01));
  assert.deepEqual(requests, [], 'No backend or external requests');
  console.log(JSON.stringify({ ok: true, advancedPages: advanced.pages, tablePages: tablePages.length, longRowLines: advanced.longLines.length, pdf: join(scratch, 'pdf-tables-multipage.pdf') }));
  console.log(JSON.stringify({ ok: true, basicCells: 4, pdf: join(scratch, 'pdf-tables-basic.pdf') }));
} finally { await browser.close(); }
