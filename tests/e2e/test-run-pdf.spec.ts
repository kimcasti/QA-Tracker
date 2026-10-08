import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

test('execution PDF paginates long cases and preserves editor text and evidence', async ({ page }) => {
  await page.route('**/__pdf-preview', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>PDF preview</title>' }));
  await page.goto('/__pdf-preview');
  const result = await page.evaluate(async () => {
    const reportModule = '/src/utils/reportUtils.ts';
    const layoutModule = '/src/utils/testRunPdfLayout.ts';
    const { buildTestRunPdf } = await import(reportModule);
    const { pdfReportParagraphs } = await import(layoutModule);
    const mixed = pdfReportParagraphs('<p>Introducción &amp; contexto</p><ol><li><p>Edad ≥ 18 → continuar</p></li><li><p>Ver &lt; y &gt;</p></li></ol><p>Conclusión ✅</p>', true);
    const cases = [
      { id: 'short', title: 'Inicio de sesión exitoso', preconditions: '<p>Cuenta activa y navegador abierto.</p>', testSteps: '<ol><li>Ingresar las credenciales.</li><li>Hacer clic en Iniciar sesión.</li></ol>', expectedResult: '<p>Se muestra la pantalla de inicio.</p>' },
      { id: 'long', title: 'Ver la información clínica de un paciente con un reporte completado', preconditions: '<ul><li>El usuario ha iniciado sesión.</li><li>Existe un paciente con reporte completado.</li></ul>', testSteps: '<p>Revisar todas las secciones del paciente.</p><ol>' + Array.from({ length: 100 }, (_, i) => `<li>Paso ${i + 1}: Verificar que la información clínica del paciente coincide con el reporte registrado. Edad ≥ 18 → mostrar detalle; fecha &quot;10/08/2026&quot;.</li>`).join('') + '</ol><p>FIN DE LOS PASOS</p>', expectedResult: '<ul><li>El diagnóstico principal coincide con el reporte.</li><li>Todos los cambios muestran los valores Antes y Ahora.</li></ul>' },
    ];
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#eaf3ff'; ctx.fillRect(0, 0, 600, 200);
    ctx.fillStyle = '#234'; ctx.font = '24px Arial'; ctx.fillText('Evidencia de ejemplo', 24, 100);
    const pdf = await buildTestRunPdf({
      testRun: { title: 'Vista previa · Pruebas UAT Administrador', testType: 'UAT', executionDate: '2026-10-08', sprint: '6', tester: 'Cliente', buildVersion: '1', environment: 'Test', status: 'Final' },
      results: [
        { testCaseId: 'long', functionalityId: 'patient', moduleName: 'Pacientes', functionalityName: 'Detalle del paciente', result: 'Aprobado', orderIndex: 1, notes: '<p>✅ Revisión completa &amp; correcta.</p>' + '<p>Observación detallada y comprobación de la información registrada.</p>'.repeat(60) + '<p>FIN DE LAS NOTAS</p>', evidenceImage: canvas.toDataURL() },
        { testCaseId: 'short', functionalityId: 'login', moduleName: 'Autenticación', functionalityName: 'Inicio de sesión', result: 'Aprobado', orderIndex: 0 },
      ],
      testCases: cases, functionalities: [],
    });
    return { mixed, pages: pdf.getNumberOfPages(), output: pdf.output(), data: pdf.output('datauristring').split(',')[1] };
  });
  expect(result.mixed).toEqual(['Introducción & contexto', '1. Edad >= 18 -> continuar', '2. Ver < y >', 'Conclusión [Verificado]']);
  expect(result.pages).toBeGreaterThan(4);
  const textObjects = [...result.output.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)].map(match => match[1]).join('\n');
  expect(textObjects).not.toContain('\x00');
  expect(result.output).toContain('FIN DE LOS PASOS');
  expect(result.output).toContain('FIN DE LAS NOTAS');
  expect(result.output.indexOf('1. Inicio')).toBeLessThan(result.output.indexOf('2. Ver la'));
  expect(result.output).not.toContain('&quot;');
  expect(result.output).not.toContain('&amp;');
  expect(result.output).toContain(' de ' + result.pages);
  if (process.env.PDF_PREVIEW_PATH) {
    await mkdir(dirname(process.env.PDF_PREVIEW_PATH), { recursive: true });
    await writeFile(process.env.PDF_PREVIEW_PATH, Buffer.from(result.data, 'base64'));
  }
});
