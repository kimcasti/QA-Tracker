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
    await toggleRowSelection(page, secondFunctionalityName);

    const bulkDrawer = page.getByTestId('qa-bulk-drawer-header');
    await expect(bulkDrawer).toBeVisible();
    await expect(bulkDrawer).toContainText('2 funcionalidades');

    const bulkFields = page.getByTestId('qa-bulk-edit-fields');
    const bulkSelects = bulkFields.locator('.ant-select');

    await bulkSelects.nth(0).click();
    await page.keyboard.press('Enter');
    await expect(bulkFields).toContainText('Crítico');

    const bulkCoverageRows = bulkFields.locator(
      'div.rounded-2xl.border.border-slate-100.bg-slate-50.px-3.py-3',
    );
    await bulkCoverageRows.nth(0).getByRole('button', { name: 'Marcar' }).click();

    await bulkSelects.nth(1).click();
    await page.keyboard.press('Enter');
    await expect(bulkFields).toContainText('Backlog');

    await expect(page.getByTestId('qa-bulk-summary')).toContainText('3 cambios configurados');

    await page.getByRole('button', { name: 'Aplicar cambios' }).click();
    await expect(page.getByText('Cambios masivos aplicados correctamente.')).toBeVisible();
    await expect(page.getByTestId('qa-bulk-drawer-header')).toHaveCount(0);

    await page.getByRole('button', { name: `Ver detalle de ${secondFunctionalityName}` }).click();
    const secondDetailHeader = page.getByTestId('qa-detail-header');
    const secondDetailClassification = page.getByTestId('qa-detail-classification');
    await expect(secondDetailHeader).toContainText(secondFunctionalityName);
    await expect(secondDetailClassification).toContainText('Crítico');

    await expect(page.getByTestId('qa-detail-coverage')).toContainText('Core');
    await expect(secondDetailClassification).toContainText('Backlog');
  });
});
