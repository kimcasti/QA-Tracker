import { expect, test } from '@playwright/test';
import { createSeededQaFlow } from './support/qaFlowSeed';

test('marks manual cases from Pacientes and Usuarios and preserves other states', async ({ page, request }) => {
  test.setTimeout(120_000);
  const seed = await createSeededQaFlow();
  const api = process.env.PLAYWRIGHT_API_URL || 'http://localhost:1337';
  const headers = { Authorization: `Bearer ${seed.auth.token}` };
  const url = `${api}/api/test-cases?filters[project][key][$eq]=${seed.projectKey}&populate=functionality`;
  const readCases = async () => {
    const response = await request.get(url, { headers });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).data as Array<{ documentId: string; title: string; automationStatus: string; isAutomated: boolean; description: string; preconditions: string; testSteps: string; expectedResult: string; priority: string; testType: string }>;
  };
  const cases = await readCases();
  expect(cases).toHaveLength(4);
  const automated = cases.find(row => row.title === 'Prevencion duplicidad planes activos')!;
  const obsolete = cases.find(row => row.title === 'Validar acceso usuario inactivo')!;
  for (const [row, status] of [[automated, 'automated'], [obsolete, 'obsolete']] as const) {
    const response = await request.put(`${api}/api/test-cases/${row.documentId}`, {
      headers, data: { data: { title: row.title, automationStatus: status, isAutomated: status === 'automated' } },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.addInitScript(() => localStorage.setItem('qa_lang', 'es'));
  await page.goto('/?mode=login');
  await page.getByLabel(/Correo o usuario/i).fill(seed.auth.user.email);
  await page.getByLabel(/Contrase/i).fill(seed.password);
  await page.getByRole('button', { name: /Entrar a QA Tracker/i }).click();
  await expect(page.getByText(seed.projectName)).toBeVisible({ timeout: 15_000 });
  await page.goto(`/projects/${seed.projectKey}/qa-planning`);
  await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();
  const list = page.getByTestId('qa-bulk-selected-list');
  await list.getByRole('checkbox', { name: 'Seleccionar Agregar plan medico', exact: true }).check();
  await list.getByRole('checkbox', { name: 'Seleccionar Desactivar y activar usuario', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Candidatas a automatización', exact: true }).check();
  const picker = page.getByTestId('automation-candidate-picker');
  await expect(page.getByRole('button', { name: 'Aplicar cambios', exact: true })).toBeDisabled();
  await expect(picker.getByRole('checkbox', { name: automated.title, exact: true })).toBeDisabled();
  await expect(picker.getByRole('checkbox', { name: obsolete.title, exact: true })).toBeDisabled();
  await picker.getByRole('checkbox', { name: 'Seleccionar todos de Agregar plan medico', exact: true }).check();
  await picker.getByRole('checkbox', { name: 'Desactivar usuario activo', exact: true }).check();
  await expect(page.getByTestId('qa-bulk-summary')).toContainText('2 de 2');
  await picker.getByRole('checkbox', { name: 'Desactivar usuario activo', exact: true }).uncheck();
  await expect(page.getByTestId('qa-bulk-summary')).toContainText('1 de 2');
  await page.getByRole('button', { name: 'Aplicar cambios', exact: true }).click();
  await expect(list).not.toBeVisible();
  const saved = await readCases();
  expect(saved.filter(row => row.automationStatus === 'candidate').map(row => row.title).sort()).toEqual([
    'Registro exitoso plan medico',
  ]);
  expect(saved.find(row => row.title === 'Desactivar usuario activo')?.automationStatus).not.toBe('candidate');
  expect(saved.find(row => row.documentId === automated.documentId)?.automationStatus).toBe('automated');
  expect(saved.find(row => row.documentId === obsolete.documentId)?.automationStatus).toBe('obsolete');
  for (const row of saved.filter(row => row.automationStatus === 'candidate')) {
    const original = cases.find(item => item.documentId === row.documentId)!;
    for (const field of ['title', 'description', 'preconditions', 'testSteps', 'expectedResult', 'priority', 'testType'] as const) {
      expect(row[field], `Preserve ${field} for ${original.title}`).toEqual(original[field]);
    }
  }
  await page.reload();
  await page.getByRole('button', { name: 'Evaluar candidatas', exact: true }).click();
  await list.getByRole('checkbox', { name: 'Seleccionar Agregar plan medico', exact: true }).check();
  await list.getByRole('checkbox', { name: 'Seleccionar Desactivar y activar usuario', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Candidatas a automatización', exact: true }).check();
  await expect(page.getByTestId('qa-bulk-summary')).toContainText('0 de 1');
  await expect(picker.getByRole('checkbox', { name: 'Registro exitoso plan medico', exact: true })).toBeDisabled();
  await picker.getByRole('checkbox', { name: 'Desactivar usuario activo', exact: true }).check();
  await page.getByRole('button', { name: 'Aplicar cambios', exact: true }).click();
  await expect(list).not.toBeVisible();
  expect((await readCases()).filter(row => row.automationStatus === 'candidate')).toHaveLength(2);
});
