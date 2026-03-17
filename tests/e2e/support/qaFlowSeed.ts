type SeededAuth = {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
};

export type SeededQaFlow = {
  auth: SeededAuth;
  password: string;
  projectKey: string;
  projectName: string;
  regressionCode: string;
  smokeCode: string;
  generalBugTitle: string;
  regressionBugTitles: string[];
  smokeBugTitles: string[];
  functionalityCodes: string[];
};

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:1337';
const TODAY = '2026-03-16';

function relation(documentId?: string | null) {
  return documentId ? { documentId } : undefined;
}

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    params?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  } = {},
) {
  const url = new URL(path, API_URL);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}

async function createDocument<T>(path: string, token: string, data: Record<string, unknown>) {
  const response = await apiRequest<{ data: T }>(path, {
    method: 'POST',
    token,
    body: { data },
  });

  return response.data;
}

async function updateDocument<T>(
  path: string,
  documentId: string,
  token: string,
  data: Record<string, unknown>,
) {
  const response = await apiRequest<{ data: T }>(`${path}/${documentId}`, {
    method: 'PUT',
    token,
    body: { data },
  });

  return response.data;
}

export async function createSeededQaFlow(): Promise<SeededQaFlow> {
  const suffix = uniqueSuffix();
  const password = 'Qa123456!';
  const signup = await apiRequest<{
    jwt: string;
    user: { id: number; username: string; email: string };
    organization: { documentId: string };
  }>('/api/auth/signup', {
    method: 'POST',
    body: {
        username: `pw_${suffix}`,
        email: `pw_${suffix}@mailinator.com`,
        password,
        organizationName: `Playwright Org ${suffix}`,
      },
    });

  const token = signup.jwt;
  const orgId = signup.organization.documentId;
  const projectKey = `PW${suffix}`;
  const tester = signup.user.username;

  const projectName = `Playwright Flow ${suffix}`;
  const project = await createDocument<{ documentId: string; key: string }>(
    '/api/projects',
    token,
    {
      name: projectName,
      key: projectKey,
      description: 'Datos temporales para pruebas E2E visuales',
      version: 'v1.0.0',
      status: 'active',
      organization: orgId,
    },
  );

  const sprint = await createDocument<{ documentId: string }>(
    '/api/sprints',
    token,
    {
      name: 'Legacy',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      status: 'planned',
      objective: 'Sprint Playwright',
      organization: relation(orgId),
      project: relation(project.documentId),
    },
  );

  const patientsModule = await createDocument<{ documentId: string }>(
    '/api/project-modules',
    token,
    {
      name: 'Pacientes',
      description: 'Modulo pacientes',
      organization: relation(orgId),
      project: relation(project.documentId),
    },
  );

  const usersModule = await createDocument<{ documentId: string }>(
    '/api/project-modules',
    token,
    {
      name: 'Usuarios',
      description: 'Modulo usuarios',
      organization: relation(orgId),
      project: relation(project.documentId),
    },
  );

  const functionalityA = await createDocument<{ documentId: string; code: string; name: string }>(
    '/api/functionalities',
    token,
    {
      code: `PACI-${suffix}`,
      name: 'Agregar plan medico',
      testTypes: ['functional', 'regression', 'smoke'],
      isRegression: true,
      isSmoke: true,
      deliveryDate: TODAY,
      status: 'in_progress',
      priority: 'medium',
      riskLevel: 'medium',
      organization: relation(orgId),
      project: relation(project.documentId),
      module: relation(patientsModule.documentId),
      sprint: relation(sprint.documentId),
    },
  );

  const functionalityB = await createDocument<{ documentId: string; code: string; name: string }>(
    '/api/functionalities',
    token,
    {
      code: `USUA-${suffix}`,
      name: 'Desactivar y activar usuario',
      testTypes: ['functional', 'regression', 'smoke'],
      isRegression: true,
      isSmoke: true,
      deliveryDate: TODAY,
      status: 'in_progress',
      priority: 'medium',
      riskLevel: 'medium',
      organization: relation(orgId),
      project: relation(project.documentId),
      module: relation(usersModule.documentId),
      sprint: relation(sprint.documentId),
    },
  );

  const cases = [];
  for (const cfg of [
    { functionality: functionalityA, title: 'Registro exitoso plan medico', priority: 'medium' },
    { functionality: functionalityA, title: 'Prevencion duplicidad planes activos', priority: 'high' },
    { functionality: functionalityB, title: 'Desactivar usuario activo', priority: 'medium' },
    { functionality: functionalityB, title: 'Validar acceso usuario inactivo', priority: 'high' },
  ]) {
    cases.push(
      await createDocument<{
        documentId: string;
        title: string;
        functionality: { documentId: string; code: string; name: string };
      }>('/api/test-cases', token, {
        title: cfg.title,
        description: 'Caso generado para Playwright',
        preconditions: 'Datos listos',
        testSteps: 'Paso 1',
        expectedResult: 'OK',
        testType: 'functional',
        priority: cfg.priority,
        isAutomated: false,
        organization: relation(orgId),
        project: relation(project.documentId),
        functionality: relation(cfg.functionality.documentId),
      }),
    );
  }

  const selectedCases = [cases[1], cases[2]];
  const selectedFunctionalities = [...new Set(selectedCases.map((item) => item.functionality.code))];

  const testRun = await createDocument<{ documentId: string }>(
    '/api/test-runs',
    token,
    {
      title: 'Playwright Happy Path',
      description: 'Seleccion parcial para UI',
      executionDate: TODAY,
      status: 'final',
      testType: 'functional',
      priority: 'medium',
      tester,
      buildVersion: 'Build UI',
      environment: 'test',
      selectedModules: ['Pacientes', 'Usuarios'],
      selectedFunctionalities,
      organization: relation(orgId),
      project: relation(project.documentId),
      sprint: relation(sprint.documentId),
    },
  );

  const runResults = [];
  for (const [index, testCase] of selectedCases.entries()) {
    runResults.push(
      await createDocument<{
        documentId: string;
        functionality: { documentId: string; code: string; name: string };
        testCase: { documentId: string; title: string };
      }>('/api/test-run-results', token, {
        result: index === 0 ? 'failed' : 'passed',
        notes: index === 0 ? 'Falla despues de execute all' : 'OK',
        organization: relation(orgId),
        project: relation(project.documentId),
        testRun: relation(testRun.documentId),
        functionality: relation(testCase.functionality.documentId),
        testCase: relation(testCase.documentId),
      }),
    );
  }

  const generalBugTitle = 'Bug luego de Execute All';
  const generalBug = await createDocument<{ documentId: string; internalBugId: string; bugLink: string; title: string; severity: string }>(
    '/api/bugs',
    token,
    {
      internalBugId: `BUG-${suffix}-GEN`,
      externalBugId: `LPAS-${suffix}`,
      title: generalBugTitle,
      description: 'Cambio de aprobado a fallido',
      severity: 'critical',
      bugLink: `https://jira.local/LPAS-${suffix}`,
      origin: 'general_execution',
      functionalityName: runResults[0].functionality.name,
      moduleName: 'Pacientes',
      detectedAt: `${TODAY}T10:00:00.000Z`,
      reportedBy: tester,
      status: 'pending',
      testCaseTitle: runResults[0].testCase.title,
      linkedSourceId: runResults[0].documentId,
      organization: relation(orgId),
      project: relation(project.documentId),
      functionality: relation(runResults[0].functionality.documentId),
      sprint: relation(sprint.documentId),
      testCase: relation(runResults[0].testCase.documentId),
      testRun: relation(testRun.documentId),
    },
  );

  await updateDocument(
    '/api/test-run-results',
    runResults[0].documentId,
    token,
    {
      result: 'failed',
      notes: 'Falla despues de execute all',
      bugTitle: generalBug.title,
      bugLink: generalBug.bugLink,
      severity: generalBug.severity,
      linkedBugId: generalBug.internalBugId,
      organization: relation(orgId),
      project: relation(project.documentId),
      testRun: relation(testRun.documentId),
      functionality: relation(runResults[0].functionality.documentId),
      testCase: relation(runResults[0].testCase.documentId),
      bug: relation(generalBug.documentId),
    },
  );

  const regressionCode = `REG-${suffix}`;
  const smokeCode = `SMK-${suffix}`;

  const regressionCycle = await createDocument<{ documentId: string }>(
    '/api/test-cycles',
    token,
    {
      code: regressionCode,
      cycleType: 'regression',
      date: TODAY,
      totalTests: 2,
      passed: 0,
      failed: 2,
      blocked: 0,
      pending: 0,
      passRate: 0,
      note: 'Regresion visual',
      status: 'completed',
      tester,
      buildVersion: 'Build R',
      environment: 'test',
      organization: relation(orgId),
      project: relation(project.documentId),
      sprint: relation(sprint.documentId),
    },
  );

  const smokeCycle = await createDocument<{ documentId: string }>(
    '/api/test-cycles',
    token,
    {
      code: smokeCode,
      cycleType: 'smoke',
      date: TODAY,
      totalTests: 2,
      passed: 0,
      failed: 2,
      blocked: 0,
      pending: 0,
      passRate: 0,
      note: 'Smoke visual',
      status: 'completed',
      tester,
      buildVersion: 'Build S',
      environment: 'test',
      organization: relation(orgId),
      project: relation(project.documentId),
      sprint: relation(sprint.documentId),
    },
  );

  const regressionBugTitles = ['Regression bug 1', 'Regression bug 2'];
  const smokeBugTitles = ['Smoke bug 1', 'Smoke bug 2'];

  for (const [index, cfg] of [
    {
      title: regressionBugTitles[0],
      functionality: functionalityA,
      testCase: cases[0],
      cycle: regressionCycle,
      code: `BUG-${suffix}-REG-1`,
      ext: `LPAS-${suffix}-R1`,
      origin: 'regression_cycle',
      moduleName: 'Pacientes',
      severity: 'critical',
    },
    {
      title: regressionBugTitles[1],
      functionality: functionalityB,
      testCase: cases[2],
      cycle: regressionCycle,
      code: `BUG-${suffix}-REG-2`,
      ext: `LPAS-${suffix}-R2`,
      origin: 'regression_cycle',
      moduleName: 'Usuarios',
      severity: 'medium',
    },
    {
      title: smokeBugTitles[0],
      functionality: functionalityA,
      testCase: cases[1],
      cycle: smokeCycle,
      code: `BUG-${suffix}-SMK-1`,
      ext: `LPAS-${suffix}-S1`,
      origin: 'smoke_cycle',
      moduleName: 'Pacientes',
      severity: 'low',
    },
    {
      title: smokeBugTitles[1],
      functionality: functionalityB,
      testCase: cases[3],
      cycle: smokeCycle,
      code: `BUG-${suffix}-SMK-2`,
      ext: `LPAS-${suffix}-S2`,
      origin: 'smoke_cycle',
      moduleName: 'Usuarios',
      severity: 'low',
    },
  ].entries()) {
    const execution = await createDocument<{
      documentId: string;
      moduleName: string;
      functionality: { documentId: string; code: string; name: string };
      testCase: { documentId: string; title: string };
    }>('/api/test-cycle-executions', token, {
      moduleName: cfg.moduleName,
      functionalityName: cfg.functionality.name,
      testCaseTitle: cfg.testCase.title,
      executed: true,
      date: TODAY,
      result: 'failed',
      evidence: cfg.origin === 'regression_cycle' ? 'Falla regresion' : 'Falla smoke',
      organization: relation(orgId),
      project: relation(project.documentId),
      testCycle: relation(cfg.cycle.documentId),
      functionality: relation(cfg.functionality.documentId),
      testCase: relation(cfg.testCase.documentId),
    });

    const bug = await createDocument<{
      documentId: string;
      internalBugId: string;
      bugLink: string;
      title: string;
      severity: string;
    }>('/api/bugs', token, {
      internalBugId: cfg.code,
      externalBugId: cfg.ext,
      title: cfg.title,
      description: 'Bug generado para validacion visual',
      severity: cfg.severity,
      bugLink: `https://jira.local/${cfg.ext}`,
      origin: cfg.origin,
      functionalityName: cfg.functionality.name,
      moduleName: cfg.moduleName,
      detectedAt: `${TODAY}T1${1 + Math.floor(index / 2)}:0${index % 2}:00.000Z`,
      reportedBy: tester,
      status: 'pending',
      testCaseTitle: cfg.testCase.title,
      linkedSourceId: execution.documentId,
      organization: relation(orgId),
      project: relation(project.documentId),
      functionality: relation(cfg.functionality.documentId),
      sprint: relation(sprint.documentId),
      testCase: relation(cfg.testCase.documentId),
      testCycle: relation(cfg.cycle.documentId),
    });

    await updateDocument('/api/test-cycle-executions', execution.documentId, token, {
      moduleName: cfg.moduleName,
      functionalityName: cfg.functionality.name,
      testCaseTitle: cfg.testCase.title,
      executed: true,
      date: TODAY,
      result: 'failed',
      evidence: cfg.origin === 'regression_cycle' ? 'Falla regresion' : 'Falla smoke',
      bugTitle: bug.title,
      bugLink: bug.bugLink,
      severity: bug.severity,
      linkedBugId: bug.internalBugId,
      organization: relation(orgId),
      project: relation(project.documentId),
      testCycle: relation(cfg.cycle.documentId),
      functionality: relation(cfg.functionality.documentId),
      testCase: relation(cfg.testCase.documentId),
      bug: relation(bug.documentId),
    });
  }

  return {
    auth: {
      token,
      user: signup.user,
    },
    password,
    projectKey,
    projectName,
    regressionCode,
    smokeCode,
    generalBugTitle,
    regressionBugTitles,
    smokeBugTitles,
    functionalityCodes: [functionalityA.code, functionalityB.code],
  };
}
