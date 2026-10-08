import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AutomationStatus, AutomationResultStatus, AutomationTool, ExecutionStatus, TestType, type TestCase } from '../src/types';
import type { AutomationImportHistoryRecord } from '../src/modules/automation-import-history/types/model';
import { buildAutomationReferenceRows } from '../src/modules/test-cases/utils/exportAutomationReferences';

const item = (id: string, reference: string, status = AutomationStatus.AUTOMATED, projectId = 'p') =>
  ({ id, projectId, functionalityId: 'f', title: id, automationReference: reference, automationStatus: status } as TestCase);
const entry = (id: string, reference: string, importedAt: string, projectId = 'p'): AutomationImportHistoryRecord => ({
  id: importedAt, documentId: importedAt, projectId, importedAt, testRunTitle: importedAt,
  testRunId: 'run', testRunStatus: ExecutionStatus.DRAFT, testRunType: TestType.FUNCTIONAL,
  tool: AutomationTool.PLAYWRIGHT, matchedCount: 1, missingReferenceCount: 0,
  unmatchedExecutionCount: 0, unmatchedReportReferenceCount: 0, duplicateReferenceCount: 0,
  matchedCases: [{ testCaseId: id, testCaseTitle: id, reference, status: AutomationResultStatus.FAILED }],
});

test('exports all automated cases, including absent matches and missing references, scoped to project', () => {
  const rows = buildAutomationReferenceRows('p', [
    item('match', 'auth.spec.ts::login'), item('unmatched', 'other'), item('missing', ''),
    item('manual', 'manual', AutomationStatus.NOT_AUTOMATED),
    item('candidate', 'candidate', AutomationStatus.CANDIDATE),
    item('obsolete', 'old', AutomationStatus.OBSOLETE), item('foreign', 'foreign', AutomationStatus.AUTOMATED, 'other'),
    { ...item('legacy', 'legacy'), automationStatus: undefined, isAutomated: true },
  ], [{ id: 'f', name: 'Login', module: 'Auth' }], [entry('match', 'auth.spec.ts::login', '2026-10-08')]);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => row.Match), ['Match registrado', 'Sin match registrado', 'Sin referencia', 'Sin match registrado']);
  assert.equal(rows[0].Funcionalidad, 'Login');
  assert.equal(rows[0]['Resultado del último match'], AutomationResultStatus.FAILED);
  assert.equal(rows[2]['Referencia'], '');
  assert.ok(rows[1]['Acción sugerida']);
});

test('uses the latest match for the current case and reference, ignoring foreign and stale matches', () => {
  const rows = buildAutomationReferenceRows('p', [item('a', ' Current '), item('changed', 'new'), item('foreign', 'ref')], [], [
    entry('a', 'current', '2026-01-01'), entry('a', 'CURRENT', '2026-10-08'),
    entry('changed', 'old', '2026-10-08'), entry('foreign', 'ref', '2026-10-08', 'other'),
  ]);
  assert.equal(rows[0]['Fecha del último match'], '2026-10-08');
  assert.equal(rows[0].Referencia, ' Current ');
  assert.equal(rows[1].Match, 'Sin match registrado');
  assert.equal(rows[2].Match, 'Sin match registrado');
});

test('flags duplicate references without discarding either case or inventing matches', () => {
  const rows = buildAutomationReferenceRows('p', [item('a', 'ref'), item('b', ' REF '), item('c', '')], [], [entry('a', 'ref', '2026-10-08')]);
  assert.deepEqual(rows.map(row => row['Referencia duplicada']), ['Sí', 'Sí', 'No']);
  assert.equal(rows[0].Match, 'Match registrado');
  assert.equal(rows[1].Match, 'Sin match registrado');
});
