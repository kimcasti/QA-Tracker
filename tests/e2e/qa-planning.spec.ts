import { expect, test } from '@playwright/test';
import { createSeededQaFlow, type SeededQaFlow } from './support/qaFlowSeed';

async function loginThroughUi(page: import('@playwright/test').Page, seed: SeededQaFlow) {
  await page.goto('/?mode=login');
  await page.getByLabel(/Correo o usuario/i).fill(seed.auth.user.email);
  await page.getByLabel(/Contrase/i).fill(seed.password);
  await page.getByRole('button', { name: /Entrar a QA Tracker/i }).click();
  await expect(page.getByText(seed.projectName)).toBeVisible({ timeout: 15_000 });
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
    await page.getByRole('option', { name: 'Alta' }).click();

    const sprintInput = detailClassification.getByPlaceholder('Sprint 5');
    await sprintInput.fill('Sprint QA E2E');

    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Funcionalidad actualizada correctamente.')).toBeVisible();
    await expect(detailClassification).toContainText('Alta');
    await expect(sprintInput).toHaveValue('Sprint QA E2E');

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('qa-detail-header')).toHaveCount(0);

    const tableCheckboxes = page.locator('.ant-table-tbody .ant-checkbox-input');
    await tableCheckboxes.nth(0).check();
    await tableCheckboxes.nth(1).check();

    const bulkDrawer = page.getByTestId('qa-bulk-drawer-header');
    await expect(bulkDrawer).toBeVisible();
    await expect(bulkDrawer).toContainText('2 funcionalidades');

    const bulkFields = page.getByTestId('qa-bulk-edit-fields');
    const bulkSelects = bulkFields.locator('.ant-select');

    await bulkSelects.nth(0).click();
    await page.getByRole('option', { name: 'Crítico' }).click();

    const coreCoverageRow = bulkFields.locator('div').filter({ hasText: 'Core business' }).first();
    await coreCoverageRow.getByRole('button', { name: 'Marcar' }).click();

    await bulkSelects.nth(1).click();
    await page.getByRole('option', { name: 'Backlog' }).click();

    await expect(page.getByTestId('qa-bulk-summary')).toContainText('3 cambios configurados');

    await page.getByRole('button', { name: 'Aplicar cambios' }).click();
    await expect(page.getByText('Cambios masivos aplicados correctamente.')).toBeVisible();
    await expect(page.getByTestId('qa-bulk-drawer-header')).toHaveCount(0);

    await page.getByRole('button', { name: `Ver detalle de ${secondFunctionalityName}` }).click();
    const secondDetail = page.getByTestId('qa-detail-header');
    await expect(secondDetail).toContainText(secondFunctionalityName);
    await expect(secondDetail).toContainText('Crítico');

    await expect(page.getByTestId('qa-detail-coverage')).toContainText('Core');
    await expect(secondDetail).toContainText('Backlog');
  });
});
