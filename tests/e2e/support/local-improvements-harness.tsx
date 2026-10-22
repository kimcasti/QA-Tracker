// Synthetic component integration harness. No application database or real accounts.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AboutView from '../../../src/components/AboutView';
import Reports from '../../../src/components/Reports';
import type { OrganizationTeamData } from '../../../src/modules/organization-team/types/model';
import {
  AutomationResultStatus, AutomationStatus, AutomationTool, ExecutionMode, ExecutionStatus,
  ImpactLevel, Priority, ProbabilityLevel, ProjectStatus, RiskLevel, TestResult, TestStatus,
  TestType, type Functionality, type Project, type RegressionCycle, type TestCase, type TestRun,
} from '../../../src/types';
import '../../../src/index.css';

const project: Project = {
  id: 'LOCAL-IMPROVEMENTS', documentId: 'localprojectfixture01', name: 'Proyecto de prueba local',
  description: 'Datos sintéticos. No corresponde a un cliente real.', version: '1.0.0',
  status: ProjectStatus.ACTIVE, createdAt: '2026-10-20', teamMembers: ['Participante base de prueba'],
  purpose: 'Verificar reportes, participantes y minutas sin modificar datos reales.',
};
const functionalities: Functionality[] = [
  { id: 'FUNC-A', documentId: 'localfunctionalitya01', name: 'Consultar catálogo', module: 'Catálogo' },
  { id: 'FUNC-B', documentId: 'localfunctionalityb01', name: 'Consultar órdenes', module: 'Órdenes' },
].map(item => ({ ...item, projectId: project.id, roles: [], testTypes: [TestType.REGRESSION],
  isRegression: true, isSmoke: false, deliveryDate: '2026-10-20', status: TestStatus.COMPLETED,
  priority: Priority.MEDIUM, impactLevel: ImpactLevel.LOW, probabilityLevel: ProbabilityLevel.LOW,
  riskLevel: RiskLevel.LOW, sprint: '6' }));
const testCases: TestCase[] = functionalities.flatMap((functionality, index) => [true, false].map((automated, offset) => ({
  id: `CASE-${index}-${offset}`, documentId: `localcasefixture${index}${offset}`, projectId: project.id,
  functionalityId: functionality.id, title: `${functionality.name} ${automated ? 'automático' : 'manual'}`,
  description: 'Caso sintético', preconditions: 'Usar únicamente el fixture local.',
  testSteps: '<p>Ejecutar el paso sintético.</p>', expectedResult: '<p>Mostrar el resultado sintético.</p>',
  testType: TestType.REGRESSION, priority: Priority.MEDIUM, isAutomated: automated,
  automationStatus: automated ? AutomationStatus.AUTOMATED : AutomationStatus.NOT_AUTOMATED,
  automationTool: automated ? AutomationTool.PLAYWRIGHT : undefined,
  lastAutomationStatus: automated ? (index === 0 ? AutomationResultStatus.PASSED : AutomationResultStatus.FAILED) : undefined,
})));
const regression: RegressionCycle = {
  id: 'localcyclefixture01', projectId: project.id, cycleId: 'LOCAL-REG-6', date: '2026-10-20',
  totalTests: 2, passed: 1, failed: 1, blocked: 0, pending: 0, passRate: 50,
  note: 'Ciclo sintético', status: 'FINALIZADA', sprint: '6', type: 'REGRESSION',
  executions: [0, 1].map(index => ({ id: `EXEC-${index}`, functionalityId: functionalities[index].id,
    testCaseId: testCases[index * 2].id, module: functionalities[index].module,
    functionalityName: functionalities[index].name,
    executionMode: ExecutionMode.AUTOMATED, executed: true,
    result: index === 1 ? TestResult.FAILED : TestResult.PASSED, date: '2026-10-20' })),
};
const testRun: TestRun = {
  id: 'localtestrunfixture01', projectId: project.id, title: 'Ejecución sintética de regresión',
  description: 'No corresponde a una sesión UAT real.', executionDate: '2026-10-20',
  status: ExecutionStatus.FINAL, testType: TestType.REGRESSION, sprint: '6',
  priority: Priority.MEDIUM, tester: 'Persona de prueba', selectedModules: ['Catálogo', 'Órdenes'],
  selectedFunctionalities: functionalities.map(item => item.id), results: [0, 1].map(index => ({
    id: `RUN-RESULT-${index}`, functionalityId: functionalities[index].id, testCaseId: testCases[index * 2].id,
    result: index === 0 ? TestResult.PASSED : TestResult.FAILED,
  })), totalResults: 2,
};
const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity,
  refetchOnMount: false, refetchOnWindowFocus: false }, mutations: { retry: false } } });
const role = new URLSearchParams(location.search).get('role') || 'owner';
const automationSource = new URLSearchParams(location.search).get('source') || 'imports';
const organization = { documentId: 'localorganization01', name: 'Organización sintética', plan: 'growth' };
query.setQueryData(['workspace'], {
  user: { id: 1, username: 'persona-sintetica', email: 'owner@example.test', isSuperAdmin: false },
  memberships: [{ documentId: 'localmembership01', organization, role: { code: role, name: role } }],
  projects: [project], projectQuota: { plan: 'growth', effectivePlan: 'growth', features: { ai: false, exports: true },
    aiUsage: { canUse: false }, exportUsage: { canUse: true },
    reports: { qaStatusSummary: true, qaProgress: true, executiveProjectStatus: true, deliveryUnitProgress: true } },
});
query.setQueryData(['projects'], [project]);
query.setQueryData(['functionalities', project.id], functionalities);
query.setQueryData(['test-cases', project.id, 'all'], testCases);
query.setQueryData(['bugs', project.id], []);
query.setQueryData(['meeting-notes', project.id], [{ id: 'localnote01', projectId: project.id,
  title: 'Minuta sintética con el cliente UAT', date: '2026-10-20', time: '10:00',
  participants: 'Persona de prueba, Cliente UAT de prueba', notes: '<p>Acuerdos de prueba.</p>' }]);
query.setQueryData(['participant-directory-members'], []);
query.setQueryData(['organization-team', 'about-view'], {
  organization: { documentId: organization.documentId, name: organization.name },
  currentMembership: { documentId: 'localmembership01', roleCode: role }, canManage: role === 'owner',
  availableRoles: [{ documentId: 'localroleowner01', code: 'owner', name: 'Owner' }], invitations: [],
  members: [{ documentId: 'localmembership01', name: 'Miembro con cuenta de prueba', email: 'owner@example.test',
    status: 'active', isCurrentUser: role === 'owner',
    role: { documentId: 'localroleowner01', code: 'owner', name: 'Owner' } }],
} satisfies OrganizationTeamData);
query.setQueryData(['test-runs', project.id], [testRun]);
query.setQueryData(['test-runs', 'summary', project.id], [testRun]);
query.setQueryData(['automation-import-history', project.id], ['runner-only', 'read-error'].includes(automationSource) ? [] : [{
  id: 'localimporthistory01', documentId: 'localimporthistory01', projectId: project.id,
  testRunId: testRun.id, testRunTitle: testRun.title, testRunStatus: testRun.status, testRunType: testRun.testType,
  tool: AutomationTool.PLAYWRIGHT, importedAt: '2026-10-20T12:00:00Z', matchedCount: 2,
  missingReferenceCount: 0, unmatchedExecutionCount: 0, unmatchedReportReferenceCount: 0, duplicateReferenceCount: 0,
  matchedCases: [0, 1].map(index => ({ testCaseId: testCases[index * 2].id,
    testCaseTitle: testCases[index * 2].title, reference: `local-test-${index}`,
    status: automationSource === 'runner-newer' ? AutomationResultStatus.FAILED :
      index === 0 ? AutomationResultStatus.PASSED : AutomationResultStatus.FAILED })),
}]);
query.setQueryData(['test-cycles', 'regression', project.id], [regression]);
query.setQueryData(['test-cycles', 'smoke', project.id], []);
query.setQueryData(['settings', 'sprints', project.id], [{ id: 'localsprint6', projectId: project.id,
  name: '6', startDate: '2026-10-01', endDate: '2026-10-30', status: 'En Progreso', objective: 'Fixture local' }]);
query.setQueryData(['delivery-units', project.id], []);
query.setQueryData(['project-proposals', project.id], []);

function images() {
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 280;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#e0f2fe'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#075985'; context.lineWidth = 6; context.strokeRect(8, 8, 704, 264);
  context.fillStyle = '#075985'; context.font = 'bold 34px sans-serif';
  context.fillText('IMAGEN SINTÉTICA DE PRUEBA', 32, 80);
  context.font = '26px sans-serif'; context.fillText('PNG / JPG / imagen local', 32, 140);
  context.fillText('Sin datos ni credenciales reales', 32, 200);
  const png = canvas.toDataURL('image/png'); const jpeg = canvas.toDataURL('image/jpeg', .9);
  canvas.width = 600; canvas.height = 2300;
  context.fillStyle = '#f0fdfa'; context.fillRect(0, 0, 600, 2300);
  context.fillStyle = '#115e59'; context.font = 'bold 28px sans-serif';
  for (let index = 0; index < 20; index++) context.fillText(`IMAGEN ALTA - FILA ${index + 1}`, 24, 55 + index * 112);
  return { png, jpeg, tall: canvas.toDataURL('image/png') };
}
async function generatePdf(includeBroken = false) {
  const { buildTestRunPdf } = await import('../../../src/utils/reportUtils');
  const data = images();
  const steps = `<ol><li>PASO_ANTES_PNG<img src="${data.png}" alt="Imagen sintética PNG"/>PASO_DESPUES_PNG</li>` +
    `<li>PASO_ANTES_JPG<img src="${data.jpeg}" alt="Imagen sintética JPEG"/>PASO_DESPUES_JPG</li>` +
    `<li>PASO_ANTES_URL<img src="${location.origin}/__qa_fixture_image.png" alt="Imagen local HTTP"/>PASO_DESPUES_URL</li>` +
    `<li>PASO_ANTES_ALTA<img src="${data.tall}" alt="Imagen alta sintética"/>PASO_DESPUES_ALTA</li>` +
    (includeBroken ? `<li>PASO_IMAGEN_FALLIDA<img src="${location.origin}/__qa_missing_image.png" alt="Imagen no disponible"/></li>` : '') +
    '</ol><p>FINAL_DE_LOS_PASOS</p>';
  const oneCase = { ...testCases[0], testSteps: steps };
  const result = { id: 'pdfresult01', functionalityId: oneCase.functionalityId, testCaseId: oneCase.id,
    result: TestResult.PASSED, testSteps: steps };
  const pdf = await buildTestRunPdf({ testRun: { ...testRun, title: 'Validación local PDF con imágenes',
    testType: TestType.UAT, results: [result] }, results: [result], functionalities,
    testCases: [oneCase] });
  return pdf.output('datauristring');
}

declare global {
  interface Window {
    __qaLocalImprovements: { query: QueryClient; project: Project; images: typeof images;
      generatePdf: typeof generatePdf };
  }
}
window.__qaLocalImprovements = { query, project, images, generatePdf };
const view = new URLSearchParams(location.search).get('view');
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={query}>
    <main style={{ padding: 20, maxWidth: 1300 }}>
      {view === 'reports' ? <Reports projectId={project.id} /> : <AboutView project={project} />}
    </main>
  </QueryClientProvider>,
);
