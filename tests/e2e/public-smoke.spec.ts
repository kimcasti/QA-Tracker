import { expect, test } from '@playwright/test';

test.describe('public smoke', () => {
  test('renders public landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Operación QA con trazabilidad real')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Probar gratis' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' }).first()).toBeVisible();
  });

  test('renders login screen', async ({ page }) => {
    await page.goto('/auth?mode=login');

    await expect(page.getByText('Acceso QA Tracker')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar a QA Tracker' })).toBeVisible();
    await expect(page.getByLabel(/Correo o usuario/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
  });
});
