import { expect, test, type Page } from '@playwright/test';

// Mount the real modal against Vite with an in-memory persistence boundary.
// No credentials or writes to a shared backend are needed for these scenarios.
async function mount(page: Page, failAt = 0, ambiguous = false, pauseSave = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__bulk-paste-test', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `
    <html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { BulkPasteCasesModal } = await import('/src/modules/test-cases/components/BulkPasteCasesModal.tsx');
      window.saved = []; window.calls = 0;
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(BulkPasteCasesModal, {
        projectId: 'p', functionalityId: 'f', functionalityName: 'Instituciones',
        existingCases: [{ functionalityId: 'f', sortOrder: 90 }],
        onClose: () => root.render(React.createElement('p', {}, 'Modal cerrado')),
        onSave: async (cases, progress) => {
          if (${pauseSave}) await new Promise(resolve => { window.releaseSave = resolve; });
          const confirmed = [];
          for (let i = 0; i < cases.length; i++) {
            window.calls++;
            if (window.calls === ${failAt}) return { confirmed, pending: cases.slice(i), failed: { localId: cases[i].id, message: 'Límite alcanzado', ambiguous: ${ambiguous} } };
            window.saved.push(cases[i]); confirmed.push({ localId: cases[i].id, testCase: cases[i] }); progress(confirmed.length);
          }
          return { confirmed, pending: [] };
        }
      }));
    </script></body></html>`,
    }),
  );
  await page.goto('/__bulk-paste-test');
  await expect
    .poll(
      async () => (errors.length ? errors.join('\n') : await page.getByRole('dialog').count()),
      { timeout: 30_000 },
    )
    .toBe(1);
}

const content = (name: string, result = 'Visible') =>
  `Título: ${name}\nPasos de prueba:\n1. Abrir\n2. Guardar\nResultado esperado: ${result}`;

test('edits, selects, deletes and validates cases before creating records', async ({ page }) => {
  await mount(page);
  await page
    .getByLabel('Contenido de los casos')
    .fill(`${content('Uno')}\n${content('Dos', '')}\n${content('Tres')}`);
  await page.getByRole('button', { name: 'Procesar casos', exact: true }).click();
  await page.getByRole('button', { name: 'Crear 3 casos de prueba' }).click();
  await expect(
    page.getByText('El caso 2 no tiene resultado esperado. Complétalo antes de continuar.'),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).calls)).toBe(0);
  await page.getByRole('checkbox', { name: 'Seleccionar caso 2', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Eliminar caso 3' }).click();
  await page.getByLabel('Título', { exact: true }).first().fill('Caso editado');
  await page.getByRole('button', { name: 'Crear 1 caso de prueba', exact: true }).click();
  await expect(page.getByText('Creado', { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => (window as any).saved);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    title: 'Caso editado',
    projectId: 'p',
    functionalityId: 'f',
    sortOrder: 91,
    isAutomated: false,
  });
  await expect(page.getByRole('button', { name: 'Crear 0 casos de prueba' })).toBeDisabled();
});

test('preserves confirmed cases on failure and resumes only pending cases', async ({ page }) => {
  await mount(page, 2);
  await page
    .getByLabel('Contenido de los casos')
    .fill(`${content('Uno')}\n${content('Dos')}\n${content('Tres')}`);
  await page.getByRole('button', { name: 'Procesar casos', exact: true }).click();
  await page.getByRole('button', { name: 'Crear 3 casos de prueba' }).click();
  await expect(page.getByText(/No se pudo confirmar el caso 2/)).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Seleccionar caso 1', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Crear 2 casos de prueba' }).click();
  await expect(page.getByText('Modal cerrado')).toBeVisible();
  const saved = await page.evaluate(() => (window as any).saved);
  expect(saved.map((record: any) => record.title)).toEqual(['Uno', 'Dos', 'Tres']);
  expect(saved.map((record: any) => record.sortOrder)).toEqual([91, 92, 93]);
});

test('blocks resubmission after an ambiguous response', async ({ page }) => {
  await mount(page, 1, true);
  await page.getByLabel('Contenido de los casos').fill(content('Uno'));
  await page.getByRole('button', { name: 'Procesar casos', exact: true }).click();
  await page.getByRole('button', { name: 'Crear 1 caso de prueba', exact: true }).click();
  await expect(page.getByText(/La respuesta es incierta/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Crear 1 caso de prueba', exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => (window as any).calls)).toBe(1);
});

test('confirms reprocessing edits and allows changing type and priority', async ({ page }) => {
  await mount(page);
  await page.getByLabel('Contenido de los casos').fill(content('Original'));
  await page.getByRole('button', { name: 'Procesar casos', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Editado');
  await page.getByRole('button', { name: 'Ver contenido original' }).click();
  await expect(page.getByLabel('Contenido de los casos')).toHaveValue(content('Original'));
  await page.getByRole('button', { name: 'Procesar casos', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '¿Reemplazar la vista previa?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Volver a la revisión' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Editado');
  await page.getByRole('combobox', { name: 'Tipo de prueba del caso 1' }).click();
  await page.locator('.ant-select-dropdown:visible').getByText('Smoke', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Prioridad del caso 1' }).click();
  await page.locator('.ant-select-dropdown:visible').getByText('Alta', { exact: true }).click();
  await page.getByRole('button', { name: 'Crear 1 caso de prueba', exact: true }).click();
  await expect(page.getByText('Modal cerrado')).toBeVisible();
  expect(await page.evaluate(() => (window as any).saved[0])).toMatchObject({
    title: 'Editado',
    testType: 'Smoke',
    priority: 'Alto',
  });
});

test('disables editing, dismissal and duplicate submits while saving', async ({ page }) => {
  await mount(page, 0, false, true);
  await page.getByLabel('Contenido de los casos').fill(content('Uno'));
  await page.getByRole('button', { name: 'Procesar casos', exact: true }).click();
  await page.getByRole('button', { name: 'Crear 1 caso de prueba', exact: true }).click();
  await expect(page.getByLabel('Título', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cerrar', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).releaseSave());
  await expect(page.getByText('Modal cerrado')).toBeVisible();
  expect(await page.evaluate(() => (window as any).saved)).toHaveLength(1);
});
