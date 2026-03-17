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
    const regressionCard = page.locator('.ant-card').filter({ hasText: 'Pruebas de regresion' }).first();
    const smokeCard = page.locator('.ant-card').filter({ hasText: 'Pruebas de humo' }).first();

    await expect(coverageCard).toContainText('100.0%');
    await expect(bugsCard).toContainText('5');
    await expect(regressionCard).toContainText('Fallidos: 2');
    await expect(smokeCard).toContainText('Bloqueantes: 2');

    await page.goto(`/projects/${seed.projectKey}/coverage`);
    await expect(page.getByRole('heading', { name: 'Matriz de Cobertura' })).toBeVisible();
    await expect(page.getByText('Total Funcionalidades')).toBeVisible();
    await expect(page.getByText('Cobertura de Casos')).toBeVisible();
    await expect(page.getByText('Bugs Activos')).toBeVisible();

    for (const code of seed.functionalityCodes) {
      const row = page.locator('tr', { hasText: code });
      await expect(row).toContainText('2');
      await expect(row).toContainText('100%');
    }
  });
});
