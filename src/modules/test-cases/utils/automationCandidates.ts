import { AutomationStatus, deriveAutomationStatus, type TestCase } from '../../../types';

export function manualCasesForFunctionalities(cases: TestCase[], projectId: string, functionalityIds: string[]) {
  const selected = new Set(functionalityIds);
  return cases.filter(item => item.projectId === projectId && selected.has(item.functionalityId) &&
    deriveAutomationStatus(item) === AutomationStatus.NOT_AUTOMATED);
}
