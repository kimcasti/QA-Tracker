import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';

test('evidence modal keeps long diagnostics and bug form in two contained columns', { timeout: 180000 }, async () => {
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
    const isEvidenceModalOpen = true, isReadOnly = false;
    let isFailureEvidenceRequired = true;
    const currentEvidenceRecord = {id:'r1', testCaseId:'test1'};
    const activeEvidenceTestCase = {id:'test1', title:'Intento de inicio de sesión con contraseña incorrecta'};
    const projectId = 'test-project', activeTestRun = null;
    const Severity = {High:'Alta', Low:'Baja'};
    const restoreEvidenceChanges = () => {}, handleSaveEvidence = () => {};
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eaf3fb';ctx.fillRect(0,0,1600,900);
    ctx.fillStyle='#123047';ctx.font='48px sans-serif';ctx.fillText('Synthetic screenshot',80,160);
    const evidence='<p>Resultado obtenido</p><img src="'+canvas.toDataURL()+'" alt="Synthetic screenshot"/><pre>'+'Error: locator.waitFor timeout '.repeat(200)+'</pre>';
    function App() {
      const [evidenceForm] = Form.useForm();
      React.useEffect(() => {evidenceForm.setFieldsValue({evidence, bugTitle:'No muestra mensaje de error'});}, []);
      return (${jsx});
    }
    const root=createRoot(document.getElementById('root'));let revision=0;
    window.mount=failed=>{isFailureEvidenceRequired=failed;root.render(<App key={++revision}/>);};
    window.mount(false);
  `);
  const server = await createServer({ root, configFile: false, envDir: false,
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('https://evidence-layout.invalid'), 'import.meta.env.VITE_USE_SERVICE_AUTH': 'false' },
    css: { postcss: {} }, plugins: [tailwindcss()],
    esbuild: { jsx: 'automatic' }, logLevel: 'error', server: { host: '127.0.0.1', port: 0, fs: { allow: [root, project] } } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1872, height: 1000 } });
    const outbound=[];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === new URL(server.resolvedUrls.local[0]).origin) return route.continue();
      outbound.push(route.request().url());return route.abort();
    });
    await page.goto(server.resolvedUrls.local[0], { timeout: 90000 });
    await expect.poll(async()=> (await page.getByRole('dialog').boundingBox())?.width,
      {timeout:3000,message:'nonfailed evidence uses the enlarged modal'}).toBeGreaterThanOrEqual(1438);
    await page.evaluate(()=>window.mount(true));
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
    for (const failed of [false,true]) {
     await page.evaluate(failed=>window.mount(failed),failed);
     for (const {width,height} of [{width:1872,height:1000},{width:1440,height:900},{width:1280,height:600},{width:390,height:844}]) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole('button', { name: 'Guardar Evidencia' })).toBeVisible();
      const dialog = page.getByRole('dialog');
      await expect.poll(async()=> (await dialog.boundingBox())?.width).toBeGreaterThanOrEqual(Math.min(1440,width-32)-2);
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.ok(box.y>=0 && box.y+box.height<=height+1,'modal fits vertically');
      assert.ok(box.height>=height-60,'modal uses available height');
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
      const save=await page.getByRole('button',{name:'Guardar Evidencia'}).boundingBox();
      assert.ok(save.y>=0 && save.y+save.height<=height,'save stays in viewport');
      const image=dialog.getByAltText('Synthetic screenshot');
      await expect(image).toBeVisible();
      const imageBox=await image.boundingBox();
      const notesBox=await dialog.getByRole('region',{name:'Notas y evidencia'}).boundingBox();
      assert.ok(imageBox.width>0 && imageBox.width<=notesBox.width,'image fits the evidence column');
      assert.equal(await dialog.locator('.ant-modal-body').evaluate(el=>getComputedStyle(el).overflowY),'auto');
      if ((!failed&&width===1872)||(failed&&width===390)) await page.screenshot({path:path.join(root,failed?'evidence-mobile.png':'evidence-desktop.png'),animations:'disabled'});
     }
    }
    assert.deepEqual(outbound,[]);console.log('8 modal geometries verified; evidence screenshots: '+root);
  } finally { await browser?.close(); await server.close(); }
});
