import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { Priority, TestType } from '../src/types';
import {
  countSteps,
  draftErrors,
  draftToTestCase,
  literalTextHtml,
  parseBulkPaste,
} from '../src/modules/test-cases/utils/bulkPaste';
import { saveBatch } from '../src/modules/test-cases/utils/saveBatch';

const example = `Título:
Registro exitoso de una institución
Descripción:
Objetivo de la prueba.
Precondiciones:
- Sesión iniciada.
Pasos de prueba:
1. Acceder al módulo.
2. Hacer clic en Crear.
3. Completar los campos.
4. Guardar.
Resultado esperado:
La institución aparece en el listado.`;

test('parses multiple cases and counts four steps without requiring optional fields', () => {
  const { drafts } = parseBulkPaste(
    `${example}\nTítulo: Segundo\nPasos de prueba: Abrir\nResultado esperado: Visible`,
  );
  assert.equal(drafts.length, 2);
  assert.equal(countSteps(drafts[0].testSteps), 4);
  assert.equal(countSteps(drafts[1].testSteps), 0);
  assert.equal(drafts[1].description, '');
  assert.deepEqual(draftErrors(drafts[1]), []);
  assert.equal(drafts[1].testType, TestType.FUNCTIONAL);
  assert.equal(drafts[1].priority, Priority.MEDIUM);
  assert.notEqual(drafts[0].id, drafts[1].id);
});

test('recognizes accents, case, both bold styles, inline and multiline values and priority aliases', () => {
  const { drafts } = parseBulkPaste(
    '**TITULO:** Caso\r\n**Descripción**: Primera\r\nSegunda\r\n\r\nTercera\r\n__Pasos de prueba:__\r\n- Abrir\r\n* Guardar\r\nRESULTADO ESPERADO: Visible\r\nTipo de prueba: integracion\r\nPrioridad: Alta',
  );
  assert.equal(drafts[0].title, 'Caso');
  assert.equal(drafts[0].description, 'Primera\nSegunda\n\nTercera');
  assert.equal(drafts[0].testType, TestType.INTEGRATION);
  assert.equal(drafts[0].priority, Priority.HIGH);
  assert.equal(countSteps(drafts[0].testSteps), 2);
});

test('keeps repeated and unrecognized text with warnings and handles missing fields', () => {
  const result = parseBulkPaste(
    'Introducción\nTítulo: \nDescripción: Uno\nDescripción: Dos\nOtro: Tres\nTipo de prueba: Magia\nPrioridad: Urgente',
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(result.drafts[0].warnings.length, 3);
  assert.equal(result.drafts[0].description, 'Uno\nDos\nOtro: Tres');
  assert.deepEqual(draftErrors(result.drafts[0]), ['title', 'testSteps', 'expectedResult']);
  assert.equal(parseBulkPaste('Sin encabezados').drafts.length, 0);
  assert.equal(parseBulkPaste('').drafts.length, 0);
  assert.equal(parseBulkPaste('Título: **Texto literal**').drafts[0].title, '**Texto literal**');
});

test('preserves colons inside steps without header warnings', () => {
  const steps = 'Completar los campos de dirección:\n- Calle.\n9. Completar los campos de contacto:\n- Teléfono.';
  const { drafts } = parseBulkPaste(`Título: Registro\nPasos de prueba:\n${steps}\nResultado esperado: Institución creada.`);
  assert.equal(drafts[0].testSteps, steps);
  assert.deepEqual(drafts[0].warnings, []);
  assert.equal(drafts[0].expectedResult, 'Institución creada.');
});

test('escapes literal HTML, preserves blank lines, associations and automation defaults', () => {
  const draft = parseBulkPaste(example).drafts[0];
  draft.testSteps = '<img src=x onerror="alert(1)">\n\n& <button>';
  const record = draftToTestCase(draft, 'project', 'functionality', 42);
  assert.equal(record.projectId, 'project');
  assert.equal(record.functionalityId, 'functionality');
  assert.equal(record.sortOrder, 42);
  assert.equal(record.isAutomated, false);
  assert.ok(record.testSteps.includes('&lt;img'));
  assert.ok(record.testSteps.includes('<p><br></p>'));
  assert.ok(!record.testSteps.includes('<img'));
  assert.equal(literalTextHtml('  '), '');
});

test('batch stops on quota error and retries only pending records', async () => {
  const cases = parseBulkPaste(`${example}\n${example}\n${example}`).drafts.map((draft, index) =>
    draftToTestCase(draft, 'p', 'f', index),
  );
  const calls: string[] = [];
  const progress: number[] = [];
  const result = await saveBatch(
    cases,
    async record => {
      calls.push(record.id);
      if (calls.length === 2)
        throw new AxiosError('Quota', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 403,
          data: { error: { message: 'Límite alcanzado' } },
        } as any);
      return { ...record, id: 'saved' };
    },
    count => progress.push(count),
  );
  assert.equal(result.confirmed.length, 1);
  assert.equal(result.failed?.message, 'Límite alcanzado');
  assert.equal(result.failed?.ambiguous, false);
  assert.equal(result.pending.length, 2);
  assert.deepEqual(progress, [1]);
  await saveBatch(result.pending, async record => {
    calls.push(record.id);
    return record;
  });
  assert.equal(calls.filter(id => id === cases[0].id).length, 1);
});

test('network and server errors are ambiguous and never retried automatically', async () => {
  const record = draftToTestCase(parseBulkPaste(example).drafts[0], 'p', 'f', 0);
  let calls = 0;
  const result = await saveBatch([record], async () => {
    calls++;
    throw new AxiosError('Network Error');
  });
  assert.equal(result.failed?.ambiguous, true);
  assert.equal(calls, 1);
  assert.equal(result.pending.length, 1);
});
