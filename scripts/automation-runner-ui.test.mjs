import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';

test('automation dialog selects across modules, blocks invalid/offline references and shows progress and evidence', { timeout: 120000 }, async () => {
  const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'qa-runner-ui-')));
  await fs.writeFile(path.join(root, 'package.json'), '{"private":true,"type":"module"}');
  await fs.symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  await fs.writeFile(path.join(root, 'index.html'), '<div id="root"></div><script type="module" src="/main.tsx"></script>');
  const component = '/@fs/' + path.join(project, 'src/modules/automation/components/RunAutomationButton.tsx').replaceAll('\\', '/');
  const stylesheet = '/@fs/' + path.join(project, 'src/index.css').replaceAll('\\', '/');
  await fs.writeFile(path.join(root, 'main.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { RunAutomationButton } from ${JSON.stringify(component)};
    import ${JSON.stringify(stylesheet)};
    createRoot(document.getElementById('root')).render(
      <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
        <RunAutomationButton runId="existing" hasUnsavedChanges={false} onResults={async () => {}} />
      </QueryClientProvider>);
  `);
  const server = await createServer({ root, configFile: false, envDir: root,
    css: { postcss: {} }, plugins: [tailwindcss()],
    esbuild: { jsx: 'automatic' }, logLevel: 'error',
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:9'), 'import.meta.env.VITE_USE_SERVICE_AUTH': 'false' },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root, project] } },
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    await page.addInitScript(() => sessionStorage.setItem('qa_tracker_api_jwt', 'fake-ui-test'));
    const refs = ['users/list.spec.ts::buscar', 'patients/list.spec.ts::crear'];
    const cases = [
      { caseId: 'u', resultId: 'r1', title: 'Buscar usuario', module: 'Usuarios', reference: refs[0] },
      { caseId: 'p', resultId: 'r2', title: 'Crear paciente', module: 'Pacientes', reference: refs[1] },
      { caseId: 'bad', resultId: 'r3', title: 'Caso sin vínculo', module: 'Reportes', reference: 'missing::case' },
    ];
    const inspection = { canRun: true, cases, duplicateReferences: [], jobs: [],
      runners: [{ id: 1, label: 'Equipo local', online: true, busy: false, catalog: refs }] };
    let posted;
    await page.route('**/api/automation-runs/**', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        posted = request.postDataJSON().data;
        inspection.jobs = [{ id: 42, runId: 'existing', runnerId: 1, state: 'running', cases: cases.slice(0, 2), completedCount: 1 }];
        await route.fulfill({ json: { data: inspection.jobs[0] } });
      } else if (request.url().endsWith('/jobs/40')) {
        await route.fulfill({ json: { data: { ...inspection.jobs.find(job => job.id === 40),
          outcomes: refs.map(automationReference => ({ automationReference, status: 'passed' })) } } });
      } else if (request.url().endsWith('/jobs/42')) {
        await route.fulfill({ json: { data: { ...inspection.jobs[0],
          startedAt: '2026-09-25T14:00:00Z', finishedAt: '2026-09-25T14:00:12Z', outcomes: [
          { automationReference: refs[0], status: 'failed', notes: 'Mensaje de fallo',
            evidenceImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=' },
          { automationReference: refs[1], status: 'passed' },
        ] } } });
      } else await route.fulfill({ json: { data: inspection } });
    });
    await page.goto(server.resolvedUrls.local[0], { timeout: 60000 });
    await page.getByRole('button', { name: 'Ejecutar automatizados', exact: true }).click();
    const guidance = page.getByText('Selecciona casos de cualquier módulo de esta ejecución.', { exact: true });
    await expect(guidance).toBeVisible();
    await expect(page.getByText(/Alzheimer|localhost:3001|se conservarán los registros/)).toHaveCount(0);
    await page.getByRole('tab', { name: 'Historial de ejecuciones', exact: true }).click();
    await expect(guidance).not.toBeVisible();
    await expect(page.getByText('Aún no hay ejecuciones automatizadas.', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Casos automatizados', exact: true }).click();
    await expect(guidance).toBeVisible();
    await page.getByRole('combobox', { name: 'Ejecutor' }).click();
    await page.getByText('Equipo local · Disponible', { exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Caso sin vínculo' }).getByRole('checkbox')).toBeDisabled();
    await page.getByRole('row').filter({ hasText: 'Buscar usuario' }).getByRole('checkbox').check();
    await page.getByRole('row').filter({ hasText: 'Crear paciente' }).getByRole('checkbox').check();
    const submit = page.getByRole('button', { name: 'Ejecutar 2 casos', exact: true });
    await expect(submit).toBeEnabled();
    inspection.runners[0].online = false;
    await expect(submit).toBeDisabled({ timeout: 10000 });
    inspection.runners[0].online = true;
    await expect(submit).toBeEnabled({ timeout: 10000 });
    await submit.click();
    assert.deepEqual(posted.caseIds.sort(), ['p', 'u']);
    await expect(page.getByText('Ejecución 42 · Ejecutando', { exact: true })).toBeVisible();
    inspection.jobs[0].state = 'completed';
    inspection.jobs[0].completedCount = 2;
    await expect(page.getByText('Ejecución 42 · Finalizado', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Historial de ejecuciones', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(guidance).not.toBeVisible();
    const summary = page.getByRole('region', { name: 'Resumen de ejecución de Playwright', exact: true });
    await expect(summary).toContainText('[1/2] FAIL  ' + refs[0]);
    await expect(summary).toContainText('[2/2] PASS  ' + refs[1]);
    await expect(summary).toContainText('Tiempo de ejecución: 12 s');
    await expect(page.getByText('2/2 Con fallos', { exact: true })).toBeVisible();
    await expect(page.getByText('2/2 Aprobado', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Aprobado: 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Fallido: 1', { exact: true })).toBeVisible();
    await page.getByRole('button').filter({ hasText: 'Buscar usuario' }).click();
    await expect(page.getByText('Mensaje de fallo', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver captura adjunta', exact: true }).click();
    await expect(page.locator('.ant-image-preview-img')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-image-preview-img')).not.toBeVisible();
    await page.getByRole('button').filter({ hasText: 'Crear paciente' }).click();
    await expect(page.getByText('El ejecutor no envió notas ni diagnóstico adicional para esta prueba.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver captura adjunta', exact: true })).toHaveCount(1);
    await expect(page.getByText('patients/list.spec.ts', { exact: true })).toBeVisible();
    inspection.jobs.push({ id: 41, runId: 'existing', runnerId: 1, state: 'interrupted',
      cases: cases.slice(0, 2), completedCount: 1, message: 'Ejecutor desconectado' });
    await expect(page.getByRole('tab', { name: 'Ejecución 41', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Ejecución 42', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Ejecución 41', exact: true }).click();
    await expect(page.getByText('Ejecución 41 · Interrumpido', { exact: true })).toBeVisible();
    await expect(page.getByText('Ejecución 42 · Finalizado', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Ejecutor desconectado', { exact: true })).toBeVisible();
    inspection.jobs.push({ id: 40, runId: 'existing', runnerId: 1, state: 'completed', cases: cases.slice(0, 2), completedCount: 2 });
    await page.getByRole('tab', { name: 'Ejecución 40', exact: true }).click();
    await expect(page.getByText('2/2 Aprobado', { exact: true })).toBeVisible();
    await expect(page.getByText('Aprobado: 2', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Ejecución 42', exact: true }).click();
    await expect(summary).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(summary).toBeVisible();
    assert.equal(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(root, 'automation-dialog.png'), fullPage: true });
    console.log('Captura de validación: ' + path.join(root, 'automation-dialog.png'));
  } finally {
    await browser?.close();
    await server.close();
  }
});
