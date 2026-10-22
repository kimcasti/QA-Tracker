// Offline real editor test: no Vite, dotenv, API or external requests.
// QA_SECURITY_SCRATCH=<outside repository> node scripts/test-editor-tables.test.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch, 'QA_SECURITY_SCRATCH must point outside the repository');
assert.ok(!resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()), 'Artifacts must stay outside the repository');
await mkdir(scratch, { recursive: true });
const css = (await readFile('src/index.css', 'utf8')).replace(/@import[^;]+;/g, '');
const bundle = await build({ stdin: { contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import EvidenceRichEditor from './src/components/EvidenceRichEditor';
const root = createRoot(document.getElementById('root'));
let revision = 0;
window.mountEditor = (props = {}) => {
  window.changes = [];
  flushSync(() => root.render(<EvidenceRichEditor key={++revision} aria-label="Pasos de prueba" showMarkers={false} showImageUpload={false} showTables {...props} onChange={html => { window.savedHtml = html; window.changes.push(html); }} />));
};`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent' });
await writeFile(join(scratch, 'editor-tables-harness.js'), bundle.outputFiles[0].text);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>Synthetic editor tables</title><div id="root"></div>' });
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto('https://editor-fixture.invalid/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const mount = async (props = {}) => {
    await page.addStyleTag({ content: css });
    await page.evaluate(props => window.mountEditor(props), props);
    await expect(page.getByRole('textbox', { name: 'Pasos de prueba' })).toBeVisible();
  };
  const table = page.locator('.tiptap table');
  const tableMenu = page.getByRole('button', { name: 'Opciones de tabla', exact: true });
  const chooseTableAction = async name => {
    await tableMenu.click({ timeout: 3000 });
    await page.getByRole('menuitem', { name, exact: true }).click({ timeout: 3000 });
  };
  await mount();
  await expect(page.getByRole('button', { name: 'Añadir fila debajo', exact: true })).toHaveCount(0);
  await chooseTableAction('Insertar tabla');
  await page.getByRole('spinbutton', { name: 'Filas', exact: true }).fill('3');
  await page.getByRole('spinbutton', { name: 'Columnas', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Crear tabla', exact: true }).click();
  await expect(table.locator('tr')).toHaveCount(3);
  await expect(table.locator('tr').first().locator('td, th')).toHaveCount(2);
  await table.locator('td, th').first().click();
  await page.keyboard.type('Paso sintetico');
  await expect(table).toContainText('Paso sintetico');
  assert.match(await page.evaluate(() => window.savedHtml), /<table/);
  results.push('insert chosen 3x2 table and edit cell');
  const persisted = await page.evaluate(() => window.savedHtml);
  await writeFile(join(scratch, 'editor-tables-saved.html'), persisted);
  await page.reload();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await mount({ value: persisted });
  await expect(table.locator('tr')).toHaveCount(3);
  await expect(table).toContainText('Paso sintetico');
  await table.locator('td, th').first().click();
  await page.keyboard.press('Tab');
  await page.keyboard.type('Segunda celda');
  await expect(table.locator('tr').first().locator('td').nth(1)).toContainText('Segunda celda');
  results.push('onChange HTML survives page reload; Tab navigates cells');
  await expect(page.getByRole('button', { name: 'Añadir fila debajo', exact: true })).toHaveCount(0);
  const beforeMenu = await page.evaluate(() => window.savedHtml);
  await tableMenu.focus();
  await tableMenu.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Añadir fila debajo', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Añadir fila debajo', exact: true })).not.toBeVisible();
  assert.equal(await page.evaluate(() => window.savedHtml), beforeMenu, 'Opening/dismissing the menu must not edit content');
  results.push('one compact table control, keyboard menu opens and dismisses safely');
  for (const [name, rows, cols] of [
    ['Añadir fila debajo', 4, 2], ['Añadir fila encima', 5, 2],
    ['Añadir columna a la derecha', 5, 3], ['Añadir columna a la izquierda', 5, 4],
    ['Eliminar fila', 4, 4], ['Eliminar columna', 4, 3],
  ]) {
    await chooseTableAction(name);
    await expect(table.locator('tr')).toHaveCount(rows);
    await expect(table.locator('tr').first().locator('td, th')).toHaveCount(cols);
  }
  await chooseTableAction('Eliminar tabla');
  await expect(table).toHaveCount(0);
  assert.ok(!(await page.evaluate(() => window.savedHtml)).includes('<table'));
  results.push('add/remove rows and columns, delete table');
  await mount({ value: persisted, disabled: true });
  await expect(table).toContainText('Paso sintetico');
  await expect(page.getByRole('textbox', { name: 'Pasos de prueba' })).toHaveAttribute('contenteditable', 'false');
  await expect(tableMenu).toBeDisabled();
  await table.locator('td').first().click();
  await page.keyboard.type('NO ESCRIBIR');
  await expect(table).not.toContainText('NO ESCRIBIR');
  assert.deepEqual(await page.evaluate(() => window.changes), []);
  results.push('read-only preserves table and blocks updates');
  await mount({ value: persisted, showTables: false });
  await expect(table).toContainText('Paso sintetico');
  await expect(tableMenu).toHaveCount(0);
  results.push('hidden toolbar still preserves tables');
  await page.setViewportSize({ width: 375, height: 812 });
  await mount();
  await chooseTableAction('Insertar tabla');
  await page.getByRole('spinbutton', { name: 'Filas', exact: true }).fill('0');
  await expect(page.getByRole('button', { name: 'Crear tabla', exact: true })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Filas', exact: true }).fill('21');
  await expect(page.getByRole('button', { name: 'Crear tabla', exact: true })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Filas', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Columnas', exact: true }).fill('1.5');
  await expect(page.getByRole('button', { name: 'Crear tabla', exact: true })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Columnas', exact: true }).fill('2');
  await expect(page.getByRole('button', { name: 'Crear tabla', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(table).toHaveCount(0);
  await chooseTableAction('Insertar tabla');
  await expect(page.locator('.ant-modal-container')).toBeVisible();
  await page.waitForTimeout(400);
  for (const selector of ['.ant-modal-container', 'input[aria-label="Filas"]', 'input[aria-label="Columnas"]']) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 375, `${selector} fits narrow viewport`);
  }
  for (const label of ['Filas', 'Columnas']) {
    const style = await page.getByRole('spinbutton', { name: label, exact: true }).evaluate(element => ({
      border: parseFloat(getComputedStyle(element).borderTopWidth), height: element.getBoundingClientRect().height,
    }));
    assert.ok(style.border >= 1 && style.height >= 36, 'Dimension fields must look editable and be touch usable');
  }
  await page.screenshot({ path: join(scratch, 'editor-tables-dialog-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Crear tabla', exact: true }).click();
  await expect(table.locator('tr')).toHaveCount(2);
  results.push('dimensions validated, cancel safe, mobile dialog usable');
  await table.locator('td').first().click();
  await tableMenu.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await page.waitForTimeout(250);
  const menuBox = await menu.boundingBox();
  assert.ok(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 375 && menuBox.y >= 0 && menuBox.y + menuBox.height <= 812, 'Table options fit the mobile viewport');
  for (const item of await page.getByRole('menuitem').all()) {
    const box = await item.boundingBox();
    assert.ok(box && box.height >= 44, 'Menu items retain touch-friendly hit targets');
  }
  await page.screenshot({ path: join(scratch, 'editor-tables-menu-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape');
  results.push('grouped table menu fits mobile with touch-friendly actions');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(scratch, 'editor-tables.png'), fullPage: true });
  await writeFile(join(scratch, 'editor-tables-verification.json'), JSON.stringify({ ok: true, results, errors, blockedRequests: requests }, null, 2));
  console.log(JSON.stringify({ ok: true, results, scratch }));
} finally { await browser.close(); }
