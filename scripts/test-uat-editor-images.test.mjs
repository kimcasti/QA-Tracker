// Real browser integration of the evidence editor, without private UAT sessions or external uploads.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
assert.ok(process.env.QA_MANUAL_CLIENT_ORIGIN && process.env.QA_SECURITY_SCRATCH, 'Explicit local origin and output directory are required.');
const origin = new URL(process.env.QA_MANUAL_CLIENT_ORIGIN);
assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use an isolated loopback origin.');
const output = fs.mkdtempSync(path.join(process.env.QA_SECURITY_SCRATCH, 'uat-images-'));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  let externalUploads = 0;
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.route('https://api.cloudinary.com/**', route => { externalUploads++; return route.abort(); });
  await page.route('**/__uat-image-regression', route => route.fulfill({ contentType: 'text/html', body: `
    <!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div>
    <script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/tests/e2e/support/evidence-checklist-harness.tsx');
    </script></body></html>` }));
  await page.goto(origin.origin + '/__uat-image-regression', { waitUntil: 'networkidle', timeout: 90000 });
  const editor = page.locator('.ProseMirror');
  await editor.waitFor({ state: 'visible', timeout: 30000 });
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#12a8c7'; ctx.fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png');
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'uat-local.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') });
  try { await editor.locator('img').first().waitFor({ state: 'visible', timeout: 7000 }); }
  catch (error) {
    console.log(JSON.stringify({ phase: 'upload', images: await editor.locator('img').count(), consoleErrors }));
    await page.screenshot({ path: path.join(output, 'failure.png') });
    throw error;
  }
  assert.equal(await editor.locator('img').count(), 1);
  await editor.focus();
  await editor.press('Control+End');
  await editor.press('Enter');
  await editor.evaluate((element, image) => {
    const bytes = Uint8Array.from(atob(image.split(',')[1]), char => char.charCodeAt(0));
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([bytes], 'uat-paste.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clipboard }));
  }, dataUrl);
  await page.waitForFunction(() => document.querySelectorAll('.ProseMirror img').length === 2);
  assert.equal(await editor.locator('img').count(), 2);
  for (const image of await editor.locator('img').all()) {
    assert.match(await image.getAttribute('src'), /^data:image\/png;base64,/);
    assert.ok(await image.evaluate(element => element.complete && element.naturalWidth > 0));
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.ProseMirror img').length === 2);
  assert.equal(externalUploads, 0);
  assert.ok(!consoleErrors.some(message => message.includes('Error inserting image')));
  await page.getByRole('button', { name: 'Solo lectura', exact: true }).click();
  assert.equal(await editor.getAttribute('contenteditable'), 'false');
  await page.screenshot({ path: path.join(output, 'success.png'), fullPage: true });
  const result = { file_upload: 'passed', image_paste: 'passed', inline_images: 2, reload_preserves_html: true,
    read_only_preserved: true, external_upload_requests: externalUploads, scope: 'real editor component; no live UAT records changed', output };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
