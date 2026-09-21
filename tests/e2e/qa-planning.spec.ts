import { expect, test } from '@playwright/test';
import { createSeededQaFlow, type SeededQaFlow } from './support/qaFlowSeed';

async function selectDropdownOption(
  page: import('@playwright/test').Page,
  optionText: RegExp | string,
) {
  const dropdown = page.locator('.ant-select-dropdown:visible').last();
  await expect(dropdown).toBeVisible();
  await dropdown
    .getByRole('option', { name: optionText, exact: typeof optionText === 'string' })
    .first()
    .evaluate(element => {
      (element as HTMLElement).click();
    });
}

async function loginThroughUi(page: import('@playwright/test').Page, seed: SeededQaFlow) {
  await page.addInitScript(() => localStorage.setItem('qa_lang', 'es'));
  await page.goto('/?mode=login');
  await page.getByLabel(/Correo o usuario/i).fill(seed.auth.user.email);
  await page.getByLabel(/Contrase/i).fill(seed.password);
  await page.getByRole('button', { name: /Entrar a QA Tracker/i }).click();
  await expect(page.getByText(seed.projectName)).toBeVisible({ timeout: 15_000 });
}

async function toggleRowSelection(
  page: import('@playwright/test').Page,
  functionalityName: string,
) {
  const row = page.locator('tr', { hasText: functionalityName }).last();
  await expect(row).toBeVisible();
  await row.locator('input.ant-checkbox-input').evaluate(element => {
    (element as HTMLInputElement).click();
  });
}

test.describe.serial('QA planning detail and bulk editing', () => {
  let seed: SeededQaFlow;

  test.beforeAll(async () => {
    seed = await createSeededQaFlow();
  });

  test('opens linked test cases in another tab and refreshes counts on return', async ({ page, context }) => {
    await loginThroughUi(page, seed);
    // Simulate the original tab before cases have been created.
    await page.route('**/api/test-cases?*', route => route.fulfill({
      json: { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } },
    }));
    await page.goto(`/projects/${seed.projectKey}/qa-planning`);
    await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();
    const list = page.getByTestId('qa-bulk-selected-list');
    const createLink = list.getByRole('link', { name: 'Crear caso para Agregar plan medico (abre otra pestaña)' });
    await expect(createLink).toBeVisible();
    const popupPromise = context.waitForEvent('page');
    await createLink.click();
    const popup = await popupPromise;
    await expect(popup.locator('.qa-test-case-drawer')).toBeVisible();
    await expect(popup.locator('.qa-test-case-drawer')).toContainText(/Casos de prueba.*Agregar plan medico/i);
    await page.unroute('**/api/test-cases?*');
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(createLink).toHaveCount(0);
    await expect(list.getByText(/\d+ casos? de prueba/).first()).toBeVisible();
    await expect(list).toBeVisible();
    await popup.close();
  });

  test('explores module tabs without losing checkbox choices', async ({ page }) => {
    await loginThroughUi(page, seed);
    await page.goto(`/projects/${seed.projectKey}/qa-planning`);
    await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();
    const list = page.getByTestId('qa-bulk-selected-list');
    const header = page.getByTestId('qa-bulk-drawer-header');
    await expect(list.getByRole('tab', { name: /^Todas/ })).toBeVisible();
    const notice = header.getByRole('alert');
    await expect(notice).toBeVisible();
    await notice.getByRole('button').click();
    await expect(notice).toHaveCount(0);

    const moduleSelect = page.getByRole('combobox', { name: 'Filtrar por módulos en edición masiva' });
    await moduleSelect.click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText('Pacientes', { exact: true }).click();
    await page.keyboard.press('Escape');
    const patient = list.getByRole('checkbox', { name: 'Seleccionar Agregar plan medico' });
    await expect(patient).toBeChecked();
    await patient.uncheck();
    await expect(header).toBeVisible();

    await moduleSelect.click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText('Usuarios', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(list.getByRole('tab', { name: /^Usuarios/ })).toHaveAttribute('aria-selected', 'true');
    await expect(list.getByRole('checkbox', { name: 'Seleccionar Desactivar y activar usuario' })).toBeChecked();
    await list.getByRole('tab', { name: /^Pacientes/ }).click();
    await expect(patient).not.toBeChecked();

    const search = list.getByRole('textbox', { name: 'Buscar funcionalidades en edición masiva' });
    await search.fill('Agregar');
    await list.getByRole('tab', { name: /^Usuarios/ }).click();
    await expect(search).toHaveValue('Agregar');
    await expect(list.getByText('No hay funcionalidades que coincidan con los filtros.')).toBeVisible();
    await search.clear();
    await expect(list.getByRole('checkbox', { name: 'Seleccionar Desactivar y activar usuario' })).toBeChecked();

    await header.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();
    await expect(notice).toBeVisible();
    await expect(notice).toHaveCount(0, { timeout: 12_000 });
  });

  test('applies a coverage change to every selected module', async ({ page }) => {
    await loginThroughUi(page, seed);
    await page.goto(`/projects/${seed.projectKey}/qa-planning`);
    await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();

    const moduleSelect = page.getByRole('combobox', { name: 'Filtrar por módulos en edición masiva' });
    await moduleSelect.click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content')
      .getByText('Pacientes', { exact: true }).evaluate(element => (element as HTMLElement).click());
    await moduleSelect.click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content')
      .getByText('Usuarios', { exact: true }).evaluate(element => (element as HTMLElement).click());
    await page.keyboard.press('Escape');

    const list = page.getByTestId('qa-bulk-selected-list');
    await expect(list.getByRole('tab', { name: /^Pacientes \(1\/1\)/ })).toBeVisible();
    await expect(list.getByRole('tab', { name: /^Usuarios \(1\/1\)/ })).toBeVisible();
    await expect(page.getByTestId('qa-bulk-summary')).toContainText('a 2 funcionalidades');

    const core = page.getByTestId('qa-bulk-edit-fields').getByRole('group', { name: 'Core business', exact: true });
    await core.getByRole('button', { name: 'Incluir', exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar cambios', exact: true }).click();
    await expect(page.getByText('Cambios masivos aplicados correctamente.')).toBeVisible();

    for (const name of ['Agregar plan medico', 'Desactivar y activar usuario']) {
      await page.getByRole('button', { name: `Ver detalle de ${name}` }).click();
      await page.getByRole('button', { name: 'Ver y editar clasificación QA', exact: true }).click();
      await expect(page.getByTestId('qa-detail-coverage')).toContainText('Core');
      await page.getByTestId('qa-detail-header').getByRole('button', { name: 'Cerrar', exact: true }).click();
    }
  });

  test('edits a single functionality and applies bulk changes only to configured fields', async ({
    page,
  }) => {
    await loginThroughUi(page, seed);

    await page.goto(`/projects/${seed.projectKey}/qa-planning`);
    await expect(page.getByRole('heading', { name: 'Estrategia QA' })).toBeVisible();

    const firstFunctionalityName = 'Agregar plan medico';
    const secondFunctionalityName = 'Desactivar y activar usuario';

    await page.getByRole('button', { name: `Ver detalle de ${firstFunctionalityName}` }).click();

    const detailHeader = page.getByTestId('qa-detail-header');
    await expect(detailHeader).toContainText(firstFunctionalityName);

    const detailCases = page.getByTestId('qa-detail-cases');
    await detailCases.getByRole('button', { name: /^(Ver casos|Crear caso)/ }).click();

    const testCaseDrawer = page.locator('.qa-test-case-drawer');
    await expect(testCaseDrawer).toBeVisible();
    await expect(testCaseDrawer).toContainText(`Casos de prueba · ${firstFunctionalityName}`);
    await testCaseDrawer.getByRole('button', { name: 'Cerrar casos de prueba' }).click();
    await expect(testCaseDrawer).toBeHidden();
    await expect(detailHeader).toBeVisible();

    await page.getByRole('button', { name: 'Ver y editar clasificación QA', exact: true }).click();
    const detailClassification = page.getByTestId('qa-detail-classification');
    const detailSelects = detailClassification.locator('.ant-select');

    await detailSelects.nth(0).click();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(detailClassification).toContainText('Alto');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(detailClassification).toContainText('Alto');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('qa-detail-header')).toHaveCount(0);
    await expect(page.locator('.ant-drawer-mask')).toHaveCount(0);

    await toggleRowSelection(page, firstFunctionalityName);
    await page.getByTestId('qa-bulk-selected-list')
      .getByRole('checkbox', { name: `Seleccionar ${secondFunctionalityName}`, exact: true }).check();

    const bulkDrawer = page.getByTestId('qa-bulk-drawer-header');
    await expect(bulkDrawer).toBeVisible();
    await expect(bulkDrawer).toContainText('Alcance de la evaluación');

    const bulkFields = page.getByTestId('qa-bulk-edit-fields');
    const bulkSelects = bulkFields.locator('.ant-select');

    await bulkSelects.nth(0).click();
    await page.keyboard.press('Enter');
    await expect(bulkFields).toContainText('Crítico');

    const coreCoverage = bulkFields.getByRole('group', { name: 'Core business', exact: true });
    await coreCoverage.getByText('Incluir', { exact: true }).click();

    await bulkSelects.nth(1).click();
    await page.keyboard.press('Enter');
    await expect(bulkFields).toContainText('Backlog');

    await expect(page.getByTestId('qa-bulk-summary')).toContainText('3 cambios configurados');

    await page.getByRole('button', { name: 'Aplicar cambios' }).click();
    await expect(page.getByText('Cambios masivos aplicados correctamente.')).toBeVisible();
    await expect(page.getByTestId('qa-bulk-drawer-header')).toHaveCount(0);

    await page.getByRole('button', { name: `Ver detalle de ${secondFunctionalityName}` }).click();
    await page.getByRole('button', { name: 'Ver y editar clasificación QA', exact: true }).click();
    const secondDetailHeader = page.getByTestId('qa-detail-header');
    const secondDetailClassification = page.getByTestId('qa-detail-classification');
    await expect(secondDetailHeader).toContainText(secondFunctionalityName);
    await expect(secondDetailClassification).toContainText('Crítico');

    await expect(page.getByTestId('qa-detail-coverage')).toContainText('Core');
    await expect(secondDetailClassification).toContainText('Backlog');
  });

  test('shows saved coverage counts and keeps category choices independent', async ({ page }) => {
    await loginThroughUi(page, seed);
    await page.goto(`/projects/${seed.projectKey}/qa-planning`);
    await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();
    const fields = page.getByTestId('qa-bulk-edit-fields');
    const smoke = fields.getByRole('group', { name: 'Smoke', exact: true });
    const regression = fields.getByRole('group', { name: 'Regresión', exact: true });
    await expect(fields.getByText('Selecciona funcionalidades para evaluar su cobertura')).toBeVisible();
    await expect(smoke.getByRole('button', { name: 'Incluir', exact: true })).toBeDisabled();

    const list = page.getByTestId('qa-bulk-selected-list');
    await list.getByRole('checkbox', { name: 'Seleccionar Agregar plan medico', exact: true }).check();
    const smokeCard = smoke.locator('..');
    await expect(smokeCard).toContainText('1 de 1 incluidas');
    await smoke.getByText('Excluir', { exact: true }).click();
    await expect(smokeCard).toContainText('1 de 1 incluidas');
    await expect(regression.getByRole('button', { name: 'Incluir', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await smoke.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Aplicar cambios', exact: true })).toBeDisabled();

    await list.getByRole('checkbox', { name: 'Seleccionar Desactivar y activar usuario', exact: true }).check();
    await expect(smokeCard).toContainText('2 de 2 incluidas');
    await smoke.getByRole('button', { name: 'Incluir', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(smoke.getByRole('button', { name: 'Incluir', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(regression.getByRole('button', { name: 'Incluir', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(smoke).toBeVisible();
    const bounds = await smoke.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  });
});
