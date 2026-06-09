import { expect, test } from '@playwright/test';
import { createSeededQaFlow, type SeededQaFlow } from './support/qaFlowSeed';

async function loginThroughUi(page: import('@playwright/test').Page, seed: SeededQaFlow) {
  await page.goto('/?mode=login');
  await page.getByLabel(/Correo o usuario/i).fill(seed.auth.user.email);
  await page.getByLabel(/Contraseña/i).fill(seed.password);
  await page.getByRole('button', { name: /Entrar a QA Tracker/i }).click();
  await expect(page.getByText(seed.projectName)).toBeVisible({ timeout: 15_000 });
}

test.describe.serial('QA Tracker seeded visual flow', () => {
  let seed: SeededQaFlow;

  test.beforeAll(async () => {
    seed = await createSeededQaFlow();
  });

  test('shows bug history with general, regression and smoke origins', async ({ page }) => {
    await loginThroughUi(page, seed);
    await page.goto(`/projects/${seed.projectKey}/testing`);

    await expect(page.getByRole('heading', { name: 'Ejecución de Pruebas' })).toBeVisible();
    const bugHistoryTab = page.getByRole('tab', { name: 'Historial de Bugs' });
    await bugHistoryTab.click();
    await expect(bugHistoryTab).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByText(seed.generalBugTitle)).toBeVisible();
    await expect(page.getByText(seed.regressionBugTitles[0])).toBeVisible();
    await expect(page.getByText(seed.regressionBugTitles[1])).toBeVisible();
    await expect(page.getByText(seed.smokeBugTitles[0])).toBeVisible();
    await expect(page.getByText(seed.smokeBugTitles[1])).toBeVisible();
    await expect(page.getByText(`Regression Cycle - ${seed.regressionCode}`)).toHaveCount(2);
    await expect(page.getByText(`Smoke Cycle - ${seed.smokeCode}`)).toHaveCount(2);
    await expect(page.getByText('General Execution')).toHaveCount(1);
  });

  test('shows seeded dashboard and coverage metrics', async ({ page }) => {
    await loginThroughUi(page, seed);

    await page.goto(`/projects/${seed.projectKey}/dashboard`);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const coverageCard = page.locator('.ant-card').filter({ hasText: 'Cobertura de casos' }).first();
    const bugsCard = page.locator('.ant-card').filter({ hasText: 'Bugs activos' }).first();
    const regressionCoverageCard = page
      .locator('.ant-card')
      .filter({ hasText: 'Cobertura regression' })
      .first();
    const smokeCoverageCard = page.locator('.ant-card').filter({ hasText: 'Cobertura smoke' }).first();

    await expect(coverageCard).toContainText('100.0%');
    await expect(bugsCard).toContainText('5');
    await expect(regressionCoverageCard).toContainText('2');
    await expect(smokeCoverageCard).toContainText('2');

    await page.goto(`/projects/${seed.projectKey}/testing`);
    await expect(page.getByRole('heading', { name: 'Ejecución de Pruebas' })).toBeVisible();
    const coverageTab = page.getByRole('tab', { name: 'Cobertura de Casos' });
    await coverageTab.click();
    await expect(coverageTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Total Funcionalidades')).toBeVisible();
    const coverageSummaryCard = page
      .locator('.ant-card')
      .filter({ hasText: 'Cobertura de Casos' })
      .first();
    await expect(coverageSummaryCard).toBeVisible();
    await expect(page.getByText('Bugs Activos')).toBeVisible();

    for (const code of seed.functionalityCodes) {
      const row = page.locator('tr', { hasText: code });
      await expect(row).toContainText('2');
      await expect(row).toContainText('50%');
    }
  });

  test('shows seeded functionalities and summary cards', async ({ page }) => {
    await loginThroughUi(page, seed);

    await page.goto(`/projects/${seed.projectKey}/functionalities`);
    await expect(page.getByRole('heading', { name: 'Gestión de Funcionalidades' })).toBeVisible();
    await expect(page.getByText('Listado de Funcionalidades')).toBeVisible();

    await expect(page.locator('main')).toContainText('Total');
    await expect(page.locator('main')).toContainText('En Desarrollo');
    await expect(page.locator('main')).toContainText('Backlog');

    for (const functionalityName of ['Agregar plan medico', 'Desactivar y activar usuario']) {
      const row = page.locator('tr', { hasText: functionalityName });
      await expect(row).toBeVisible();
      await expect(row).toContainText('En desarrollo');
    }

    await expect(page.locator('tr').filter({ hasText: 'Pacientes' })).toHaveCount(1);
    await expect(page.locator('tr').filter({ hasText: 'Usuarios' })).toHaveCount(1);
  });

  test('shows seeded execution history in the testing view', async ({ page }) => {
    await loginThroughUi(page, seed);

    await page.goto(`/projects/${seed.projectKey}/testing`);
    await expect(page.getByRole('heading', { name: 'Ejecución de Pruebas' })).toBeVisible();

    const executionsTab = page.getByRole('tab', { name: 'Historial de Ejecuciones' });
    await executionsTab.click();
    await expect(executionsTab).toHaveAttribute('aria-selected', 'true');

    const executionsCard = page.locator('.ant-card').filter({ hasText: 'Historial de Ejecuciones' }).first();
    await expect(executionsCard).toContainText(seed.testRunTitle);
    await expect(executionsCard).toContainText('Legacy');
    await expect(executionsCard).toContainText('2/2');
    await expect(executionsCard).toContainText('100%');
  });
});
