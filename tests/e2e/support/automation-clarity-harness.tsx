// Synthetic query-cache fixtures for real dashboard and report components.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import Dashboard from '../../../src/components/Dashboard';
import Reports from '../../../src/components/Reports';
import {AutomationResultStatus,AutomationStatus,AutomationTool,ExecutionStatus,TestResult,TestType,TestStatus,Priority,ImpactLevel,ProbabilityLevel,RiskLevel,ProjectStatus,type Functionality,type TestCase,type TestRun,type Project} from '../../../src/types';
import '../../../src/index.css';
const project:Project={id:'CLARITY-FIXTURE',documentId:'clarityproject01',name:'Proyecto sintético de métricas',description:'Pruebas sin registros reales',version:'1',status:ProjectStatus.ACTIVE,createdAt:'2026-10-20',teamMembers:[]};
const names=['Catálogo','Órdenes','Inventario','Agenda','Facturación','Solo manual','Sin pruebas','Entrega anterior'];
const functionalities:Functionality[]=names.map((module,index)=>({id:`FUNC-${index}`,documentId:`func-doc-${index}`,projectId:project.id,name:`Funcionalidad de ${module}`,module,roles:[],testTypes:[TestType.REGRESSION],isRegression:true,isSmoke:false,status:TestStatus.COMPLETED,priority:Priority.MEDIUM,impactLevel:ImpactLevel.LOW,probabilityLevel:ProbabilityLevel.LOW,riskLevel:RiskLevel.LOW,deliveryDate:'2026-10-20',sprint:index===7?'2':'6'}));
const testCases:TestCase[]=functionalities.flatMap((f,index)=>index===6?[]:[0,1].map(offset=>({id:`CASE-${index}-${offset}`,documentId:`case-doc-${index}-${offset}`,projectId:project.id,functionalityId:index===2?f.documentId!:f.id,title:`Caso sintético ${moduleName(index)} ${offset+1}`,description:'Prueba sintética',preconditions:'',testSteps:'<p>Consultar el fixture</p>',expectedResult:'<p>Mostrar el fixture</p>',testType:TestType.REGRESSION,priority:Priority.MEDIUM,isAutomated:offset===0&&index!==5,automationStatus:offset===0&&index!==5?AutomationStatus.AUTOMATED:AutomationStatus.NOT_AUTOMATED,automationTool:offset===0&&index!==5?AutomationTool.PLAYWRIGHT:undefined,lastAutomationStatus:offset===0&&index!==5?(index===1?AutomationResultStatus.FAILED:AutomationResultStatus.PASSED):undefined,lastAutomationRunAt:offset===0&&index!==5?'2026-10-20T10:00:00Z':undefined})));
const longCase=testCases.find(item=>item.documentId==='case-doc-2-0')!;
longCase.id+='-IDENTIFICADOR-LARGO'.repeat(8);
longCase.title+=' '+ 'TITULO_SINTETICO_EXTENSO_'.repeat(12);
for(const [index,item] of testCases.filter(item=>item.functionalityId==='FUNC-5').entries()) {
 item.isAutomated=true;
 item.automationStatus=index===0?AutomationStatus.CANDIDATE:AutomationStatus.OBSOLETE;
}
function moduleName(index:number){return names[index];}
const oldCase=testCases.find(tc=>tc.functionalityId==='FUNC-7')!;
const run:TestRun={id:'clarityrun01',projectId:project.id,title:'Regresión sintética Sprint6',description:'',executionDate:'2026-10-20',priority:Priority.MEDIUM,tester:'Persona sintética',selectedModules:[],selectedFunctionalities:['FUNC-7'],status:ExecutionStatus.FINAL,testType:TestType.REGRESSION,sprint:'6',results:[{id:'RESULT-OLD',functionalityId:'FUNC-7',testCaseId:oldCase.documentId!,result:TestResult.PASSED}]};
const query=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,refetchOnMount:false,refetchOnWindowFocus:false}}});
const organization={documentId:'clarityorg01',name:'Organización sintética',plan:'growth'};
query.setQueryData(['workspace'],{user:{id:1,username:'synthetic',email:'synthetic@example.test',isSuperAdmin:false},memberships:[{documentId:'claritymember01',organization,role:{code:'owner',name:'Owner'}}],projects:[project],projectQuota:{plan:'growth',effectivePlan:'growth',features:{ai:false,exports:true},aiUsage:{canUse:false},exportUsage:{canUse:true},reports:{qaStatusSummary:true,qaProgress:true,executiveProjectStatus:true,deliveryUnitProgress:true}}});
query.setQueryData(['projects'],[project]);query.setQueryData(['functionalities',project.id],functionalities);query.setQueryData(['test-cases',project.id,'all'],testCases);
for(const key of [['bugs',project.id],['test-cycles','regression',project.id],['test-cycles','smoke',project.id],['test-cycles','regression','summary',project.id],['test-cycles','smoke','summary',project.id],['delivery-units',project.id],['project-proposals',project.id]])query.setQueryData(key,[]);
query.setQueryData(['settings','sprints',project.id],[{id:'sprint6',projectId:project.id,name:'6',startDate:'2026-10-01',endDate:'2026-10-30',status:'En Progreso',objective:'Sintético'}]);
query.setQueryData(['test-runs',project.id],[run]);query.setQueryData(['test-runs','summary',project.id],[run]);
query.setQueryData(['automation-import-history',project.id],[{id:'clarityimport01',projectId:project.id,testRunId:run.id,testRunStatus:run.status,testRunType:run.testType,tool:AutomationTool.PLAYWRIGHT,importedAt:'2026-10-20T12:00:00Z',matchedCases:[{testCaseId:oldCase.id,testCaseTitle:oldCase.title,reference:'synthetic.spec.ts::old',status:AutomationResultStatus.PASSED}]}]);
declare global{interface Window{__clarityFixture:{query:QueryClient,project:Project,functionalities:Functionality[],testCases:TestCase[]}}}
window.__clarityFixture={query,project,functionalities,testCases};
const view=new URLSearchParams(location.search).get('view');
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={query}><main style={{padding:16}}>{view==='reports'?<Reports projectId={project.id}/>:<Dashboard projectId={project.id}/>}</main></QueryClientProvider>);
