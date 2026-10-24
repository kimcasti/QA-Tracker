import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { TestType, AutomationTool, AutomationStatus } from '../src/types';

test('absent-tool compatibility requires automated edit context and never allows clearing a stored tool', async () => {
  const { validatedCaseTool } = await import(policyPath);
  for (const originalAutomationStatus of Object.values(AutomationStatus)) {
    const editContext = { originalAutomationStatus };
    for (const value of [undefined, null, '', AutomationTool.CYPRESS]) {
      if (originalAutomationStatus === AutomationStatus.AUTOMATED && value == null) {
        assert.equal(validatedCaseTool(value, AutomationStatus.AUTOMATED, undefined, editContext), undefined);
      } else {
        assert.throws(() => validatedCaseTool(value, AutomationStatus.AUTOMATED, undefined, editContext), /Selecciona Playwright/);
      }
    }
    assert.throws(() => validatedCaseTool(undefined, AutomationStatus.AUTOMATED, AutomationTool.CYPRESS, editContext), /Selecciona Playwright/);
  }
  assert.throws(() => validatedCaseTool(undefined, AutomationStatus.AUTOMATED), /Selecciona Playwright/);
});

const policyPath = '../src/modules/test-cases/utils/caseAuthoring';

test('new tool authoring allows Playwright only, clears unsupported tools without relabelling, and validates automated cases', async () => {
  const policy = await import(policyPath);
  assert.equal(typeof policy.caseToolOptions, 'function', 'case tool policy missing');
  assert.deepEqual(policy.caseToolOptions(), [{ label: 'Playwright', value: AutomationTool.PLAYWRIGHT }]);
  for (const original of Object.values(AutomationTool)) {
    for (const incoming of [...Object.values(AutomationTool), undefined]) {
      const expected = incoming === AutomationTool.PLAYWRIGHT ? incoming : undefined;
      assert.equal(policy.normalizeCaseTool(incoming), expected);
      assert.equal(policy.normalizeCaseTool(incoming, original), incoming === original ? original : expected);
    }
    if (original !== AutomationTool.PLAYWRIGHT) {
      assert.deepEqual(policy.caseToolOptions(original)[1], { label: `${original} (histórico)`, value: original });
      assert.throws(() => policy.validatedCaseTool(original, AutomationStatus.AUTOMATED), /Selecciona Playwright/);
      assert.equal(policy.validatedCaseTool(original, AutomationStatus.NOT_AUTOMATED), undefined);
      assert.equal(policy.validatedCaseTool(original, AutomationStatus.AUTOMATED, original), original);
    }
  }
});

test('case authoring allows only Funcional/UAT plus the exact original historic type on edits', async () => {
  assert.ok(existsSync(new URL(`${policyPath}.ts`, import.meta.url)), 'case authoring policy is missing');
  const { caseTypeOptions, normalizeCaseType } = await import(policyPath);
  assert.deepEqual(caseTypeOptions(), [
    { label: 'Funcional', value: TestType.FUNCTIONAL }, { label: 'UAT', value: TestType.UAT },
  ]);
  for (const original of Object.values(TestType)) {
    for (const incoming of [...Object.values(TestType), undefined, 'invalid', 'smoke', 'uat']) {
      const expected = incoming === TestType.UAT || incoming === 'uat' ? TestType.UAT : TestType.FUNCTIONAL;
      assert.equal(normalizeCaseType(incoming), expected);
      assert.equal(normalizeCaseType(incoming, original), incoming === original ? original : expected);
    }
    const options = caseTypeOptions(original);
    const historic = ![TestType.FUNCTIONAL, TestType.UAT].includes(original);
    assert.equal(options.length, historic ? 3 : 2);
    if (historic) assert.deepEqual(options[2], { label: `${original} (histórico)`, value: original });
  }
});
