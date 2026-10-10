import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';

test('catalog drawer discovers, suggests without selecting, reviews replacements and saves only chosen links', { timeout: 120000 }, async () => {
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const scratch = path.join(process.env.LOCALAPPDATA || os.homedir(), 'hermes', 'cache', 'scratch');
  await fs.mkdir(scratch, { recursive: true });
  const root = await fs.realpath(await fs.mkdtemp(path.join(scratch, 'qa-catalog-ui-')));
  await fs.writeFile(path.join(root, 'package.json'), '{"private":true,"type":"module"}');
  await fs.symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  await fs.writeFile(path.join(root, 'index.html'), '<div id="root"></div><script type="module" src="/main.tsx"></script>');
  const component = '/@fs/' + path.join(project, 'src/modules/automation/components/CatalogComparisonDrawer.tsx').replaceAll('\\', '/');
  const stylesheet = '/@fs/' + path.join(project, 'src/index.css').replaceAll('\\', '/');
  await fs.writeFile(path.join(root, 'main.tsx'), `
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import CatalogComparisonDrawer from ${JSON.stringify(component)}; import ${JSON.stringify(stylesheet)};
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
      <CatalogComparisonDrawer projectId="p" onClose={() => {}} /></QueryClientProvider>);
  `);
  const server = await createServer({ root, configFile: false, envDir: root, css: { postcss: {} }, plugins: [tailwindcss()],
    esbuild: { jsx: 'automatic' }, logLevel: 'error',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:9'), 'import.meta.env.VITE_USE_SERVICE_AUTH': 'false' },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root, project] } },
  });
  let browser;
  try {
    await server.listen(); browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem('qa_tracker_api_jwt', 'fake-catalog-test'));
    const refs = ['auth/login.spec.ts::Iniciar sesión', 'auth/logout.spec.ts::Cerrar sesión', 'old::login', 'auth::duplicada', 'auth::duplicada'];
    const cases = [
      { id: 'c1', title: 'Iniciar sesión', reference: 'old::login', status: 'not_automated', tool: 'cypress', type: '', snapshot: 's1', module: 'Auth', functionality: 'Acceso' },
      { id: 'c2', title: 'Cerrar sesión', reference: '', status: 'automated', tool: 'playwright', type: 'ui', snapshot: 's2', module: 'Auth', functionality: 'Salida' },
    ];
    let saved; let requested; let detailsCount = 0; let conflict = false;
    const connections = [{ id: 1, runnerId: 1, label: 'Mi carpeta', compatible: true, online: true, busy: false, environments: ['local', 'test'] }];
    let catalog = { id: 10, runnerId: 1, environment: 'local', state: 'running', references: [], cases: [], requestedAt: '2026-10-08T12:00:00Z' };
    await page.route('**/api/automation-projects/**', async route => {
      const request = route.request();
      if (request.url().endsWith('catalog-connections')) return route.fulfill({ json: { data: connections } });
      if (request.url().endsWith('/assignments')) {
        if (conflict) return route.fulfill({ status: 409, json: { error: { message: 'Uno de los casos cambió. Actualiza la comparación antes de guardar.' } } });
        saved = request.postDataJSON().data;
        cases[0] = { ...cases[0], reference: saved.assignments[0].reference, status: 'automated', tool: 'playwright', type: 'ui', snapshot: 's3' };
        catalog.cases = cases;
        return route.fulfill({ json: { data: { saved: ['c1'] } } });
      }
      if (request.method() === 'POST') {
        requested = request.postDataJSON().data;
        catalog.environment = requested.environment;
        return route.fulfill({ json: { data: catalog } });
      }
      detailsCount++;
      if (detailsCount > 1) catalog = { ...catalog, state: 'completed', references: refs, cases,
        catalogHash: 'catalog-hash', finishedAt: '2026-10-08T12:00:02Z' };
      return route.fulfill({ json: { data: catalog } });
    });
    await page.goto(server.resolvedUrls.local[0], { timeout: 60000 });
    const detect = page.getByRole('button', { name: 'Obtener y comparar referencias' });
    await expect(detect).toBeEnabled();
    await expect(page.getByRole('heading', { name: '1. Detecta tus pruebas' })).toBeVisible();
    await expect(page.getByText('Detecta, vincula y revisa. Tus cambios solo se guardan al confirmar.')).toBeVisible();
    await page.getByRole('combobox', { name: 'Ambiente de detección' }).click();
    await page.getByText('Test', { exact: true }).click();
    await detect.click();
    await expect(page.getByText('Detectando referencias en la carpeta conectada…')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sin asignar (2)' })).toBeVisible();
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('Pruebas que aún necesitan un caso');
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('Seleccionar no guarda el vínculo');
    await page.getByRole('tab', { name: 'Registradas (1)' }).click();
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('Referencias ya vinculadas');
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('no indica que la prueba haya pasado');
    await page.getByRole('tab', { name: 'Casos por revisar (1)' }).click();
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('Casos automatizados que necesitan revisión');
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('No significa que la ejecución haya fallado');
    await page.getByRole('tab', { name: 'Duplicadas (1)' }).click();
    await expect(page.getByRole('tabpanel').getByRole('note')).toContainText('Referencias con más de una coincidencia');
    await page.getByRole('tab', { name: 'Sin asignar (2)' }).click();
    assert.equal(requested.environment, 'test');
    await page.screenshot({ path: path.join(root, 'catalog-comparison-desktop.png'), fullPage: true, animations: 'disabled' });
    console.log('Captura de escritorio: ' + path.join(root, 'catalog-comparison-desktop.png'));
    await expect(page.getByRole('button', { name: 'Revisar vínculos' })).toBeDisabled();
    assert.equal(await page.getByRole('button', { name: 'Revisar vínculos' }).evaluate(element => getComputedStyle(element).backgroundImage), 'none');
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toHaveCount(0);
    const loginCase = page.getByRole('combobox', { name: 'Caso para auth/login.spec.ts::Iniciar sesión', exact: true });
    await loginCase.fill('Iniciar sesión');
    await page.locator('.ant-select-item-option').filter({ hasText: 'Auth · Acceso · Iniciar sesión' }).click();
    await expect(page.getByText('Este caso ya tiene una referencia')).toBeVisible();
    await page.getByRole('button', { name: 'Revisar vínculos' }).click();
    const modal = page.getByRole('dialog').filter({ hasText: 'Revisar asignaciones de referencias' });
    await expect(modal).toContainText('La referencia anterior volverá a Sin asignar');
    assert.equal(await modal.locator('.ant-modal-container').evaluate(element => getComputedStyle(element).padding), '0px');
    await expect(modal.getByRole('region', { name: 'Referencia anterior' })).toContainText('old');
    await expect(modal.getByRole('region', { name: 'Referencia nueva' })).toContainText('auth/login.spec.ts');
    await expect(modal.getByText('Resumen de cambios', { exact: true })).toBeVisible();
    await expect(modal).toContainText('Manual → Automatizada');
    await expect(modal).toContainText('cypress → Playwright');
    await page.screenshot({ path: path.join(root, 'catalog-review-desktop.png'), fullPage: true, animations: 'disabled' });
    console.log('Modal escritorio: ' + path.join(root, 'catalog-review-desktop.png'));
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => modal.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= -1 && rect.right <= window.innerWidth + 1 && element.scrollWidth <= element.clientWidth; })).toBe(true);
    await expect(modal.getByRole('button', { name: 'Guardar vínculos' })).toBeInViewport();
    await page.screenshot({ path: path.join(root, 'catalog-review-mobile.png'), fullPage: true, animations: 'disabled' });
    console.log('Modal móvil: ' + path.join(root, 'catalog-review-mobile.png'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await modal.getByRole('button', { name: 'Guardar vínculos' }).click();
    await expect(page.getByText('1 vínculos guardados', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sin asignar (2)' })).toBeVisible();
    const unassignedPanel = page.getByRole('tabpanel');
    await expect(unassignedPanel.getByText('auth/login.spec.ts', { exact: true })).toHaveCount(0);
    await expect(unassignedPanel.getByText('old', { exact: true })).toBeVisible();
    assert.equal(saved.assignments.length, 1); assert.equal(saved.assignments[0].caseId, 'c1');
    assert.equal(saved.assignments[0].snapshot, 's1');
    await page.getByRole('tab', { name: 'Duplicadas (1)' }).click();
    await expect(page.getByText('2 tests en catálogo · 0 casos registrados')).toBeVisible();
    conflict = true;
    await page.getByRole('tab', { name: 'Sin asignar (2)' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.getByRole('button', { name: 'Revisar vínculos' }).click();
    await modal.getByRole('button', { name: 'Guardar vínculos' }).click();
    await expect(page.getByText('Uno de los casos cambió. Actualiza la comparación antes de guardar.', { exact: true }).first()).toBeVisible();
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Actualizar comparación', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Revisar vínculos' })).toBeDisabled();
    connections[0].compatible = false;
    await expect(page.getByText('Actualiza tu ejecutor', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(detect).toBeDisabled();
    connections[0].online = false;
    await expect(page.getByText('Ejecutor desconectado', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(async () => page.getByRole('dialog').evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= -1 && rect.right <= window.innerWidth + 1; })).toBe(true);
    assert.equal(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(root, 'catalog-comparison.png'), fullPage: true, animations: 'disabled' });
    console.log('Captura de validación: ' + path.join(root, 'catalog-comparison.png'));
  } finally { await browser?.close(); await server.close(); }
});
