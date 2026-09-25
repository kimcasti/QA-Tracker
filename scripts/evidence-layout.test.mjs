import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';

test('evidence modal keeps long diagnostics and bug form in two contained columns', { timeout: 120000 }, async () => {
  const project = process.cwd();
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'qa-evidence-layout-')));
  await fs.symlink(path.join(project, 'node_modules'), path.join(root, 'node_modules'), 'junction');
  await fs.writeFile(path.join(root, 'index.html'), '<div id="root"></div><script type="module" src="/main.tsx"></script>');
  const source = await fs.readFile(path.join(project, 'src/components/TestExecutionView.tsx'), 'utf8');
  const modal = source.slice(source.indexOf('{/* Evidence Modal */}'));
  // Exercise the actual modal JSX with isolated form state and representative rich text.
  const jsx = modal.slice(modal.indexOf('<Modal'), modal.indexOf('</Modal>') + 8);
  const asset = file => '/@fs/' + path.join(project, file).replaceAll('\\', '/');
  await fs.writeFile(path.join(root, 'main.tsx'), `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {Modal, Form, Button, Typography, Input, Select, Tooltip} from 'antd';
    import {InfoCircleOutlined} from '@ant-design/icons';
    import EvidenceRichEditorField from ${JSON.stringify(asset('src/components/EvidenceRichEditor.tsx'))};
    import ${JSON.stringify(asset('src/index.css'))};
    const {Text} = Typography;
    const isEvidenceModalOpen = true, isFailureEvidenceRequired = true, isReadOnly = false;
    const currentEvidenceRecord = {id:'r1', testCaseId:'test1'};
    const activeEvidenceTestCase = {id:'test1', title:'Intento de inicio de sesión con contraseña incorrecta'};
    const projectId = 'test-project', activeTestRun = null;
    const Severity = {High:'Alta', Low:'Baja'};
    const restoreEvidenceChanges = () => {}, handleSaveEvidence = () => {};
    function App() {
      const [evidenceForm] = Form.useForm();
      React.useEffect(() => {evidenceForm.setFieldsValue({evidence:'<p>Resultado obtenido</p><pre>' + 'Error: locator.waitFor timeout ' .repeat(200) + '</pre>', bugTitle:'No muestra mensaje de error'});}, []);
      return (${jsx});
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `);
  const server = await createServer({ root, configFile: false, css: { postcss: {} }, plugins: [tailwindcss()],
    esbuild: { jsx: 'automatic' }, logLevel: 'error', server: { host: '127.0.0.1', port: 0, fs: { allow: [root, project] } } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(server.resolvedUrls.local[0]);
    const notes = page.getByRole('region', { name: 'Notas y evidencia' });
    const bug = page.getByRole('region', { name: 'Reporte de Bug' });
    await expect(bug.getByRole('textbox', { name: 'Título del Bug' })).toBeVisible();
    await expect(notes.locator('.ProseMirror')).toContainText('Error: locator.waitFor');
    const help = bug.getByRole('button', { name: 'Información sobre el registro de bugs' });
    await help.focus();
    await expect(page.getByRole('tooltip')).toContainText('Historial de Bugs');
    await bug.getByRole('textbox', { name: 'Título del Bug' }).focus();
    await expect(page.getByRole('tooltip')).not.toBeVisible();
    await expect(notes.getByRole('button', { name: 'Interpretar error con IA', exact: true })).toBeVisible();
    await expect.poll(() => notes.evaluate(el => {
      const ai = el.querySelector('[aria-label="Interpretar error con IA"]').getBoundingClientRect();
      const marker = el.querySelector('[aria-label="Insertar marcador en las notas"]').getBoundingClientRect();
      return ai.bottom <= marker.top;
    })).toBe(true);
    await expect.poll(() => page.locator('.execution-evidence-layout').evaluate(el => {
      const [left, right] = [...el.children].map(child => child.getBoundingClientRect());
      return right.x >= left.right && Math.abs(left.y - right.y) < 2;
    })).toBe(true);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: 'Guardar Evidencia' })).toBeVisible();
      const dialog = page.getByRole('dialog');
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
    }
  } finally { await browser?.close(); await server.close(); }
});
