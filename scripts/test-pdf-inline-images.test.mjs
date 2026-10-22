// Offline browser integration: no Vite, API, dotenv, credentials or external requests.
// Run from client: QA_SECURITY_SCRATCH=<owned scratch> node scripts/test-pdf-inline-images.test.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch, 'QA_SECURITY_SCRATCH must point outside the repository');
assert.ok(!resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()), 'Artifacts must stay outside the repository');
await mkdir(join(scratch, 'logs'), { recursive: true });
const bundle = await build({ stdin: { contents: "export { buildTestRunPdf } from './src/utils/reportUtils'; export * from './src/utils/testRunPdfLayout'; export { jsPDF } from 'jspdf';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'PdfHarness', logLevel: 'silent' });
await writeFile(join(scratch, 'pdf-inline-harness.js'), bundle.outputFiles[0].text);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Synthetic PDF test</title>' })
    : route.abort());
  await page.goto('https://pdf-fixture.invalid/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e5f4ff'; ctx.fillRect(0, 0, 480, 160);
    ctx.fillStyle = '#145'; ctx.font = '24px sans-serif'; ctx.fillText('SYNTHETIC INLINE IMAGE 3:1', 12, 85);
    const png = canvas.toDataURL('image/png');
    const jpeg = canvas.toDataURL('image/jpeg');
    const fixture = {
      testRun: { title: 'Synthetic inline images UAT', testType: 'UAT', executionDate: '2026-10-20', status: 'Final' },
      testCases: [{ id: 'synthetic', title: 'Synthetic ordered steps', testSteps: `<p>BEFORE PNG</p><ol start="3"><li><p>STEP THREE</p><img src="${png}" alt="Synthetic PNG"><p>AFTER PNG</p></li><li>STEP FOUR<img src="${jpeg}">AFTER JPEG</li></ol><p>END OF STEPS</p>` }],
      results: [{ testCaseId: 'synthetic', functionalityId: 'synthetic', result: 'Aprobado', notes: '<p>Existing notes &amp; text.</p>' }], functionalities: [],
    };
    const pdf = await PdfHarness.buildTestRunPdf(fixture);
    return { data: pdf.output('datauristring').split(',')[1], output: pdf.output(), fixture, images: Object.keys(pdf.internal.collections.addImage_images || {}).length, pages: pdf.getNumberOfPages() };
  });
  await writeFile(join(scratch, 'pdf-inline-fixture.json'), JSON.stringify(result.fixture, null, 2));
  await writeFile(join(scratch, 'pdf-inline-images.pdf'), Buffer.from(result.data, 'base64'));
  assert.equal(result.images, 2, 'Both inline PNG and JPEG must be real PDF image objects');
  for (const text of ['BEFORE PNG', '3. STEP THREE', 'AFTER PNG', '4. STEP FOUR', 'AFTER JPEG', 'END OF STEPS', 'Existing notes & text.']) assert.ok(result.output.includes(text), text);
  const extra = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 1600;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffd790'; ctx.fillRect(0, 0, 180, 1600);
    ctx.fillStyle = '#532'; ctx.font = '18px sans-serif';
    for (let y = 30; y < 1600; y += 100) ctx.fillText(`SYNTHETIC ${y}`, 8, y);
    return canvas.toDataURL('image/png');
  });
  const requests = [];
  // A permitted HTTP loopback URL is fulfilled in the browser: zero listener,
  // zero API access, but the real anonymous Image -> canvas CORS path executes.
  await page.route('http://127.0.0.1:39999/synthetic-image.png', async route => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(extra.split(',')[1], 'base64') });
  });
  const advanced = await page.evaluate(async ({ fixture, portrait }) => {
    const { jsPDF, buildTestRunPdf, pdfReportParagraphs, pdfReportBlocks } = PdfHarness;
    const events = [];
    const addImage = jsPDF.API.addImage;
    jsPDF.API.addImage = function(...args) {
      const [data, format, x, y, width, height] = args;
      const dimensions = this.getImageProperties(data);
      events.push({ x, y, width, height, ratio: dimensions.width / dimensions.height, page: this.getNumberOfPages() });
      return addImage.apply(this, args);
    };
    const mixed = pdfReportParagraphs('<p>Intro &amp; context</p><ol><li><p>Value ≥ 18 → continue</p></li></ol><p>Done ✅</p>', true);
    const src = 'http://127.0.0.1:39999/synthetic-image.png';
    const steps = fixture.testCases[0].testSteps
      + '<p>SYNTHETIC long text before large image.</p>'.repeat(70)
      + `<p>BEFORE TALL</p><img src="${portrait}"><p>AFTER TALL</p><img src="${src}"><p>AFTER REMOTE</p>`
      + '<img src="javascript:alert(1)"><p>AFTER BLOCKED SOURCE</p><img src="https://pdf-fixture.invalid/missing.png"><p>AFTER FAILED LOAD</p>'
      + '<img src="data:image/png;base64,AAAA"><p>AFTER INVALID DATA</p>';
    const advancedFixture = structuredClone(fixture);
    advancedFixture.testCases[0].testSteps = steps;
    advancedFixture.results[0].evidenceImage = fixture.testCases[0].testSteps.match(/src="([^"]+)"/)[1];
    try {
      const pdf = await buildTestRunPdf(advancedFixture);
      return { mixed, events, pages: pdf.getNumberOfPages(), output: pdf.output(), data: pdf.output('datauristring').split(',')[1], fixture: advancedFixture,
        blocks: pdfReportBlocks('<p>BEFORE<img src="data:image/png;base64,AAAA">AFTER</p>').map(block => block.kind) };
    } finally { jsPDF.API.addImage = addImage; }
  }, { fixture: result.fixture, portrait: extra });
  await writeFile(join(scratch, 'pdf-inline-complete-fixture.json'), JSON.stringify(advanced.fixture, null, 2));
  await writeFile(join(scratch, 'pdf-inline-complete.pdf'), Buffer.from(advanced.data, 'base64'));
  assert.deepEqual(advanced.mixed, ['Intro & context', '1. Value >= 18 -> continue', 'Done [Verificado]']);
  assert.deepEqual(advanced.blocks, ['text', 'image', 'text']);
  assert.equal(requests.length, 1, 'Only the routed loopback image is loaded');
  assert.equal(advanced.events.length, 5, 'Four inline draws plus legacy attached evidence');
  assert.ok(advanced.pages >= 4);
  for (const image of advanced.events) {
    assert.ok(image.x >= 16 && image.x + image.width <= 194.01, 'Horizontal margins');
    assert.ok(image.y >= 22 && image.y + image.height <= 277.01, 'No header/footer overlap');
    assert.ok(Math.abs(image.width / image.height - image.ratio) < 0.001, 'Aspect ratio');
  }
  assert.equal((advanced.output.match(/Imagen no disponible/g) || []).length, 3, 'Blocked, failed and corrupt sources must be visible');
  for (const text of ['AFTER TALL', 'AFTER REMOTE', 'AFTER BLOCKED SOURCE', 'AFTER FAILED LOAD', 'AFTER INVALID DATA', 'Evidencia adjunta']) assert.ok(advanced.output.includes(text), text);
  assert.ok(!advanced.output.includes('javascript:'), 'Do not leak failed sources into PDF');
  assert.ok(result.output.indexOf('BEFORE PNG') < result.output.indexOf('/I0 Do'));
  assert.ok(result.output.indexOf('/I0 Do') < result.output.indexOf('AFTER PNG'));
  assert.ok(result.output.indexOf('4. STEP FOUR') < result.output.indexOf('/I1 Do'));
  assert.ok(result.output.indexOf('/I1 Do') < result.output.indexOf('AFTER JPEG'));
  await writeFile(join(scratch, 'pdf-inline-verification.json'), JSON.stringify({ images: advanced.events, pages: advanced.pages, warnings: 3, requests }, null, 2));
  console.log(JSON.stringify({ ok: true, images: result.images, pages: result.pages, advancedPages: advanced.pages, imageDraws: advanced.events.length, warnings: 3, pdf: join(scratch, 'pdf-inline-complete.pdf') }));
} finally { await browser.close(); }
