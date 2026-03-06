import { Functionality, TestExecution, TestResult, TestStatus, TestType, RegressionCycle } from '../types';

const STORAGE_KEYS = {
  FUNCTIONALITIES: 'qa_tracker_functionalities',
  EXECUTIONS: 'qa_tracker_executions',
  REGRESSION_CYCLES: 'qa_tracker_regression_cycles',
};

// Initial Mock Data if empty
const INITIAL_FUNCTIONALITIES: Functionality[] = [
  { id: 'AUTH-01', module: 'Login', name: 'Inicio de sesión', roles: ['Todos'], testTypes: [TestType.REGRESSION, TestType.SMOKE], isRegression: true, isSmoke: true, deliveryDate: '2025-02-02', status: TestStatus.COMPLETED },
  { id: 'PAT-01', module: 'Pacientes', name: 'Lista de pacientes', roles: ['Todos'], testTypes: [TestType.REGRESSION, TestType.SMOKE], isRegression: true, isSmoke: true, deliveryDate: '2025-02-02', status: TestStatus.COMPLETED },
  { id: 'CLN-06', module: 'Sección-Clínica', name: 'Agregar Cita', roles: ['Manejador'], testTypes: [TestType.REGRESSION], isRegression: true, isSmoke: false, deliveryDate: '2025-02-20', status: TestStatus.FAILED },
];

const INITIAL_EXECUTIONS: TestExecution[] = [
  { id: '1', functionalityId: 'AUTH-01', testType: TestType.SMOKE, executed: true, result: TestResult.PASSED, executionDate: '2025-02-24' },
  { id: '2', functionalityId: 'PAT-01', testType: TestType.REGRESSION, executed: true, result: TestResult.PASSED, executionDate: '2025-02-20' },
  { id: '3', functionalityId: 'CLN-06', testType: TestType.FUNCTIONAL, executed: true, result: TestResult.FAILED, executionDate: '2025-02-20' },
];

const INITIAL_REGRESSION_CYCLES: RegressionCycle[] = [
  { id: '1', cycleId: 'C-48', date: '2024-05-12', totalTests: 240, passed: 215, failed: 18, blocked: 7, pending: 0, approvalRate: 89.5, note: 'Estabilidad en el módulo de autenticación mejorada.', status: 'FINALIZADA', sprint: 'Sprint 24', executions: [] },
  { id: '2', cycleId: 'C-47', date: '2024-04-28', totalTests: 235, passed: 210, failed: 15, blocked: 10, pending: 0, approvalRate: 89.3, note: 'Integración con API de terceros validada.', status: 'FINALIZADA', sprint: 'Sprint 23', executions: [] },
  { id: '3', cycleId: 'C-46', date: '2024-04-14', totalTests: 235, passed: 180, failed: 45, blocked: 10, pending: 0, approvalRate: 76.5, note: 'Bloqueante crítico en pasarela de pagos.', status: 'FINALIZADA', sprint: 'Sprint 22', executions: [] },
  { id: '4', cycleId: 'C-45', date: '2024-03-30', totalTests: 220, passed: 205, failed: 5, blocked: 10, pending: 0, approvalRate: 93.1, note: 'Regresión de hotfix exitosa.', status: 'FINALIZADA', sprint: 'Sprint 21', executions: [] },
];

export const storageService = {
  getFunctionalities: (): Functionality[] => {
    const data = localStorage.getItem(STORAGE_KEYS.FUNCTIONALITIES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(INITIAL_FUNCTIONALITIES));
      return INITIAL_FUNCTIONALITIES;
    }
    return JSON.parse(data);
  },

  saveFunctionality: (func: Functionality) => {
    const functionalities = storageService.getFunctionalities();
    const index = functionalities.findIndex(f => f.id === func.id);
    if (index > -1) {
      functionalities[index] = func;
    } else {
      functionalities.push(func);
    }
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(functionalities));
    console.log('Payload saved (Functionality):', func);
  },

  deleteFunctionality: (id: string) => {
    const functionalities = storageService.getFunctionalities().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(functionalities));
  },

  bulkUpdateFunctionalities: (ids: string[], updates: Partial<Functionality>) => {
    const functionalities = storageService.getFunctionalities();
    const updated = functionalities.map(f => {
      if (ids.includes(f.id)) {
        return { ...f, ...updates };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(updated));
    console.log('Bulk update payload:', { ids, updates });
  },

  bulkAddFunctionalities: (newFuncs: Functionality[]) => {
    const functionalities = storageService.getFunctionalities();
    // Filter out duplicates by ID
    const existingIds = new Set(functionalities.map(f => f.id));
    const uniqueNewFuncs = newFuncs.filter(f => !existingIds.has(f.id));
    
    const updated = [...functionalities, ...uniqueNewFuncs];
    localStorage.setItem(STORAGE_KEYS.FUNCTIONALITIES, JSON.stringify(updated));
    console.log('Bulk add payload:', uniqueNewFuncs);
    return uniqueNewFuncs.length;
  },

  getExecutions: (): TestExecution[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EXECUTIONS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(INITIAL_EXECUTIONS));
      return INITIAL_EXECUTIONS;
    }
    return JSON.parse(data);
  },

  saveExecution: (exec: TestExecution) => {
    const executions = storageService.getExecutions();
    const index = executions.findIndex(e => e.id === exec.id);
    if (index > -1) {
      executions[index] = exec;
    } else {
      executions.push(exec);
    }
    localStorage.setItem(STORAGE_KEYS.EXECUTIONS, JSON.stringify(executions));
    console.log('Payload saved (Execution):', exec);
  },

  getRegressionCycles: (): RegressionCycle[] => {
    const data = localStorage.getItem(STORAGE_KEYS.REGRESSION_CYCLES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(INITIAL_REGRESSION_CYCLES));
      return INITIAL_REGRESSION_CYCLES;
    }
    return JSON.parse(data);
  },

  saveRegressionCycle: (cycle: RegressionCycle) => {
    const cycles = storageService.getRegressionCycles();
    const index = cycles.findIndex(c => c.id === cycle.id);
    if (index > -1) {
      cycles[index] = cycle;
    } else {
      cycles.push(cycle);
    }
    localStorage.setItem(STORAGE_KEYS.REGRESSION_CYCLES, JSON.stringify(cycles));
    console.log('Payload saved (RegressionCycle):', cycle);
  },
};
