/**
 * @deprecated Legacy service retired from runtime.
 *
 * Do not use this service in new code.
 * Use the module-scoped services under `client/src/modules/.../services`.
 */

function throwLegacyModuleAccessError(moduleName: string, modernServicePath: string): never {
  throw new Error(
    `${moduleName} no debe consumirse desde dataService. Usa ${modernServicePath} como fuente moderna.`
  );
}

export const dataService = {
  getProjects: () =>
    throwLegacyModuleAccessError(
      'Projects',
      'client/src/modules/projects/services/projectsService.ts'
    ),
  saveProject: () =>
    throwLegacyModuleAccessError(
      'Projects',
      'client/src/modules/projects/services/projectsService.ts'
    ),
  deleteProject: () =>
    throwLegacyModuleAccessError(
      'Projects',
      'client/src/modules/projects/services/projectsService.ts'
    ),
  getModules: () =>
    throwLegacyModuleAccessError(
      'Modules',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  saveModule: () =>
    throwLegacyModuleAccessError(
      'Modules',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  deleteModule: () =>
    throwLegacyModuleAccessError(
      'Modules',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  getRoles: () =>
    throwLegacyModuleAccessError(
      'Roles',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  saveRole: () =>
    throwLegacyModuleAccessError(
      'Roles',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  deleteRole: () =>
    throwLegacyModuleAccessError(
      'Roles',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  getSprints: () =>
    throwLegacyModuleAccessError(
      'Sprints',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  saveSprint: () =>
    throwLegacyModuleAccessError(
      'Sprints',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  deleteSprint: () =>
    throwLegacyModuleAccessError(
      'Sprints',
      'client/src/modules/settings/services/settingsService.ts'
    ),
  getFunctionalities: () =>
    throwLegacyModuleAccessError(
      'Functionalities',
      'client/src/modules/functionalities/services/functionalitiesService.ts'
    ),
  saveFunctionality: () =>
    throwLegacyModuleAccessError(
      'Functionalities',
      'client/src/modules/functionalities/services/functionalitiesService.ts'
    ),
  deleteFunctionality: () =>
    throwLegacyModuleAccessError(
      'Functionalities',
      'client/src/modules/functionalities/services/functionalitiesService.ts'
    ),
  bulkUpdateFunctionalities: () =>
    throwLegacyModuleAccessError(
      'Functionalities',
      'client/src/modules/functionalities/services/functionalitiesService.ts'
    ),
  bulkAddFunctionalities: () =>
    throwLegacyModuleAccessError(
      'Functionalities',
      'client/src/modules/functionalities/services/functionalitiesService.ts'
    ),
  getTestCases: () =>
    throwLegacyModuleAccessError(
      'Test cases',
      'client/src/modules/test-cases/services/testCasesService.ts'
    ),
  saveTestCase: () =>
    throwLegacyModuleAccessError(
      'Test cases',
      'client/src/modules/test-cases/services/testCasesService.ts'
    ),
  deleteTestCase: () =>
    throwLegacyModuleAccessError(
      'Test cases',
      'client/src/modules/test-cases/services/testCasesService.ts'
    ),
  getExecutions: () =>
    throwLegacyModuleAccessError(
      'Executions',
      'client/src/modules/test-runs/hooks/useExecutions.ts'
    ),
  saveExecution: () =>
    throwLegacyModuleAccessError(
      'Executions',
      'client/src/modules/test-runs/services/testRunsService.ts'
    ),
  getRegressionCycles: () =>
    throwLegacyModuleAccessError(
      'Regression cycles',
      'client/src/modules/test-cycles/services/testCyclesService.ts'
    ),
  saveRegressionCycle: () =>
    throwLegacyModuleAccessError(
      'Regression cycles',
      'client/src/modules/test-cycles/services/testCyclesService.ts'
    ),
  getSmokeCycles: () =>
    throwLegacyModuleAccessError(
      'Smoke cycles',
      'client/src/modules/test-cycles/services/testCyclesService.ts'
    ),
  saveSmokeCycle: () =>
    throwLegacyModuleAccessError(
      'Smoke cycles',
      'client/src/modules/test-cycles/services/testCyclesService.ts'
    ),
  getTestPlans: () =>
    throwLegacyModuleAccessError(
      'Test plans',
      'client/src/modules/test-plans/services/testPlansService.ts'
    ),
  saveTestPlan: () =>
    throwLegacyModuleAccessError(
      'Test plans',
      'client/src/modules/test-plans/services/testPlansService.ts'
    ),
  deleteTestPlan: () =>
    throwLegacyModuleAccessError(
      'Test plans',
      'client/src/modules/test-plans/services/testPlansService.ts'
    ),
  getTestRuns: () =>
    throwLegacyModuleAccessError(
      'Test runs',
      'client/src/modules/test-runs/services/testRunsService.ts'
    ),
  saveTestRun: () =>
    throwLegacyModuleAccessError(
      'Test runs',
      'client/src/modules/test-runs/services/testRunsService.ts'
    ),
  deleteTestRun: () =>
    throwLegacyModuleAccessError(
      'Test runs',
      'client/src/modules/test-runs/services/testRunsService.ts'
    ),
  getMeetingNotes: () =>
    throwLegacyModuleAccessError(
      'Meeting notes',
      'client/src/modules/meeting-notes/services/meetingNotesService.ts'
    ),
  saveMeetingNote: () =>
    throwLegacyModuleAccessError(
      'Meeting notes',
      'client/src/modules/meeting-notes/services/meetingNotesService.ts'
    ),
  deleteMeetingNote: () =>
    throwLegacyModuleAccessError(
      'Meeting notes',
      'client/src/modules/meeting-notes/services/meetingNotesService.ts'
    ),
  getBugs: () =>
    throwLegacyModuleAccessError(
      'Bugs',
      'client/src/modules/bugs/services/bugsService.ts'
    ),
  saveBug: () =>
    throwLegacyModuleAccessError(
      'Bugs',
      'client/src/modules/bugs/services/bugsService.ts'
    ),
  deleteBug: () =>
    throwLegacyModuleAccessError(
      'Bugs',
      'client/src/modules/bugs/services/bugsService.ts'
    ),
};
