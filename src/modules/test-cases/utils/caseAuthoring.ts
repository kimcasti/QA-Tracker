import { AutomationStatus, AutomationTool, TestType } from '../../../types';

const CASE_TYPES = [TestType.FUNCTIONAL, TestType.UAT];

export function caseTypeOptions(original?: TestType) {
  const options = CASE_TYPES.map(value => ({ label: value as string, value }));
  if (original && !CASE_TYPES.includes(original)) {
    options.push({ label: `${original} (histórico)`, value: original });
  }
  return options;
}

// A legacy value is valid only when it is the original value of this edited record.
export function normalizeCaseType(value: unknown, original?: TestType): TestType {
  if (original && value === original) return original;
  return value === TestType.UAT || value === 'uat' ? TestType.UAT : TestType.FUNCTIONAL;
}

export function caseToolOptions(original?: AutomationTool) {
  const options = [{ label: 'Playwright', value: AutomationTool.PLAYWRIGHT }];
  if (original && original !== AutomationTool.PLAYWRIGHT) {
    options.push({ label: `${original} (histórico)`, value: original });
  }
  return options;
}

export function normalizeCaseTool(value: unknown, original?: AutomationTool): AutomationTool | undefined {
  if (original && value === original) return original;
  return value === AutomationTool.PLAYWRIGHT ? AutomationTool.PLAYWRIGHT : undefined;
}

export function validatedCaseTool(
  value: unknown,
  status: AutomationStatus,
  original?: AutomationTool,
  editContext?: { originalAutomationStatus: AutomationStatus },
) {
  const tool = normalizeCaseTool(value, original);
  // Preserve an absent historic tool, never an unsupported replacement or new automation.
  const preservesAbsentTool = value == null && !original &&
    editContext?.originalAutomationStatus === AutomationStatus.AUTOMATED;
  if (status === AutomationStatus.AUTOMATED && !tool && !preservesAbsentTool) {
    throw new Error('Selecciona Playwright para la automatización o cambia el estado a manual/candidata.');
  }
  return tool;
}
