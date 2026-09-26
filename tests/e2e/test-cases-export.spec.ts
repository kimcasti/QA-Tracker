import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('downloads ordered cases as UTF-8 text with readable rich-text fields', async ({ page }) => {
  await page.route('**/__cases-export', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
    <button id="export" disabled>Exportar</button>
    <script type="module">
      import { downloadCasesText } from '/src/modules/test-cases/utils/exportCasesText.ts';
      const cases = [{ title: 'Transferir conversación', testType: 'Funcional', priority: 'Alto',
        description: '<p>Validar &quot;chat&quot; &amp; atención</p>', preconditions: '<p>Sesión iniciada</p>',
        testSteps: '<ol><li>Abrir chat</li><li>Elegir área</li></ol>', expectedResult: '<p>Transferencia exitosa<br>Mensaje visible</p>' },
        { title: 'Cancelar transferencia', testType: 'Funcional', priority: 'Medio', description: '',
          preconditions: '', testSteps: ['1. Cancelar', '2. Volver'].join(String.fromCharCode(10)), expectedResult: 'Sin cambios' }];
      const button = document.getElementById('export');
      button.onclick = () => downloadCasesText('Transferir / Chat', cases);
      button.disabled = false;
    </script>` }));
  await page.goto('/__cases-export');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('casos-Transferir - Chat.txt');
  const content = await readFile((await download.path())!, 'utf8');
  expect(content).toContain('Total: 2');
  expect(content).toContain('Validar "chat" & atención');
  expect(content).toContain('1. Abrir chat\n2. Elegir área');
  expect(content).toContain('Transferencia exitosa\nMensaje visible');
  expect(content).toContain('Sin precondiciones.');
  expect(content.indexOf('Caso 1 — Transferir conversación')).toBeLessThan(content.indexOf('Caso 2 — Cancelar transferencia'));
  expect(content).not.toMatch(/<\/?(?:p|ol|li|br)>/);
  expect(await download.failure()).toBeNull();
});
