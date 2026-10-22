import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {AutomationStatus, AutomationTool, deriveAutomationStatus, type TestCase, type Functionality} from '../src/types';
import {reportHasAutomatedCoverage, reportIdentityMap} from '../src/utils/reportAutomationMetrics';
const filename=new URL('../src/components/QaPlanningPage.tsx',import.meta.url);
const source=ts.createSourceFile('QaPlanningPage.tsx',readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function actualMemo<T=number>(name:string, testCases:TestCase[], functionalities:Functionality[]) {
 let declaration:ts.VariableDeclaration|undefined;
 function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===name)declaration=node;ts.forEachChild(node,visit);}
 visit(source);assert.ok(declaration?.initializer,`Missing real declaration ${name}`);
 const code=ts.transpileModule(`const value=${declaration.initializer.getText(source)};value;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return vm.runInNewContext(code,{React:{useMemo:(fn:()=>unknown)=>fn()},testCases,functionalities,AutomationStatus,deriveAutomationStatus,reportIdentityMap,reportHasAutomatedCoverage}) as Map<string,T>;
}
const funcs=[{id:'FUNC-A',documentId:'function-doc',projectId:'PROJECT-A',module:'Module A'}] as Functionality[];
test('planning denominators resolve documentId aliases to the same functionality as reports',()=>{
 const cases=[{id:'CASE-1',projectId:'PROJECT-A',functionalityId:'function-doc',automationStatus:AutomationStatus.AUTOMATED}] as TestCase[];
 assert.equal(actualMemo('testCaseCountByFunctionality',cases,funcs).get('FUNC-A'),1);
 assert.equal(actualMemo('automatedCaseCountByFunctionality',cases,funcs).get('FUNC-A'),1);
});
test('planning automated coverage follows canonical status precedence and excludes unlinked cases',()=>{
 const cases=[{id:'CASE-1',functionalityId:'FUNC-A',isAutomated:true},{id:'CASE-2',functionalityId:'FUNC-A',isAutomated:true,automationStatus:AutomationStatus.NOT_AUTOMATED},{id:'CASE-3',functionalityId:'unknown',automationStatus:AutomationStatus.AUTOMATED}].map(item=>({...item,projectId:'PROJECT-A'})) as TestCase[];
 const counts=actualMemo('automatedCaseCountByFunctionality',cases,funcs);
 assert.equal(counts.get('FUNC-A'),1);assert.equal(counts.has('unknown'),false);
});
const fixtureCase=(overrides:Partial<TestCase>={})=>({id:'CASE-1',projectId:'PROJECT-A',functionalityId:'function-doc',automationStatus:AutomationStatus.AUTOMATED,...overrides}) as TestCase;
for(const name of ['testCaseCountByFunctionality','automatedCaseCountByFunctionality']) {
 test(`${name} excludes foreign-project cases with a matching functionality alias`,()=>{
  const cases=[fixtureCase(),fixtureCase({id:'FOREIGN',projectId:'PROJECT-B'}),fixtureCase({id:'UNKNOWN',functionalityId:'unknown'})];
  const counts=actualMemo(name,cases,funcs);
  assert.equal(counts.get('FUNC-A'),1);assert.equal(counts.size,1);
 });
}
test('planning tool map resolves aliases and excludes foreign projects and non-automated statuses',()=>{
 const cases=[fixtureCase({automationTool:AutomationTool.PLAYWRIGHT}),fixtureCase({id:'FOREIGN',projectId:'PROJECT-B',automationTool:AutomationTool.CYPRESS}),fixtureCase({id:'OBSOLETE',isAutomated:true,automationStatus:AutomationStatus.OBSOLETE,automationTool:AutomationTool.CYPRESS})];
 const tools=actualMemo<Set<string>>('automatedToolsByFunctionality',cases,funcs);
 assert.deepEqual(Array.from(tools.get('FUNC-A')||[]),[AutomationTool.PLAYWRIGHT]);assert.equal(tools.size,1);
});
test('planning candidate map resolves aliases and excludes foreign projects and other states',()=>{
 const cases=[fixtureCase({automationStatus:AutomationStatus.CANDIDATE}),fixtureCase({id:'FOREIGN',projectId:'PROJECT-B',automationStatus:AutomationStatus.CANDIDATE}),fixtureCase({id:'AUTOMATED'}),fixtureCase({id:'UNKNOWN',functionalityId:'unknown',automationStatus:AutomationStatus.CANDIDATE})];
 const counts=actualMemo('candidateCaseCountByFunctionality',cases,funcs);
 assert.equal(counts.get('FUNC-A'),1);assert.equal(counts.size,1);
});
test('planning case drilldown shares the alias-aware project-scoped denominator',()=>{
 const cases=[fixtureCase(),fixtureCase({id:'FOREIGN',projectId:'PROJECT-B'}),fixtureCase({id:'UNKNOWN',functionalityId:'unknown'})];
 const groups=actualMemo<TestCase[]>('testCasesByFunctionality',cases,funcs);
 assert.deepEqual(Array.from(groups.get('FUNC-A')||[],item=>item.id),['CASE-1']);assert.equal(groups.size,1);
});
