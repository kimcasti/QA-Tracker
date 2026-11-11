import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Execute the actual AboutView declarations and real AI HTTP transport; no provider calls.
const source = ts.createSourceFile('AboutView.tsx', readFileSync('src/components/AboutView.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const view = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AboutView') as ts.FunctionDeclaration;
assert.ok(view?.body);
const declarations = ['buildProjectAiInput', 'handleGenerateWireframeBrief'].map(name => {
  const statement = view.body!.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(source) === name));
  assert.ok(statement, `Real AboutView declaration ${name} must remain exercised`);
  return statement.getText(source);
}).join('\n');
assert.ok(process.env.QA_SECURITY_SCRATCH);
mkdirSync(process.env.QA_SECURITY_SCRATCH, { recursive: true });
const dir = mkdtempSync(join(process.env.QA_SECURITY_SCRATCH, 'brief-flow-'));
const file = join(dir, 'flow.cjs');
const bundle = buildSync({ stdin: { contents: `export {Http} from '../config/http'; export function flow({project,ensureAiProvider,saveProject,setActiveAiAction,message}) { ${declarations}; return handleGenerateWireframeBrief(); }`, resolveDir: join(process.cwd(), 'src/components'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://brief-fixture.invalid' }) }, logLevel: 'silent' });
writeFileSync(file, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(file);
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('AboutView uses project metadata and persistence identity without manual confirmations', async () => {
  const sent: any[] = [], saved: any[] = [], messages: string[] = [];
  const project = { id: 'BUSINESS-PROJECT', documentId: 'persisted-project', name: 'Biblioteca ficticia', description: 'Préstamos internos', purpose: 'Registrar devoluciones', coreRequirements: ['Buscar libro'], businessRules: 'Solo libros disponibles', aiProjectInsights: 'Sugerencia: avisar vencimientos' };
  service.Http.defaults.adapter = async (config: any) => { sent.push(JSON.parse(config.data).data); return { config, status: 200, statusText: 'OK', headers: {}, data: { data: 'Brief lo-fi con pendientes separados' } }; };
  await service.flow({ project, confirmedConclusionsText: 'La búsqueda está confirmada.\n\nLa búsqueda está confirmada.', ensureAiProvider: async () => true, saveProject: async (p: any) => saved.push(p), setActiveAiAction() {}, message: { success: (text: string) => messages.push(text), error: assert.fail } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].confirmedConclusions, undefined);
  assert.equal(sent[0].projectId, project.documentId);
  assert.deepEqual(sent[0].coreRequirements, project.coreRequirements);
  assert.equal(sent[0].businessRules, project.businessRules);
  assert.equal(sent[0].purpose, project.purpose);
  assert.equal(sent[0].aiProjectInsights, undefined, 'Server must obtain authorized persisted analysis, not trust a client copy');
  assert.equal(saved[0].aiProjectInsights, project.aiProjectInsights);
  assert.equal(saved[0].aiWireframeBrief, 'Brief lo-fi con pendientes separados');
  assert.equal(messages.length, 1);
});

test('AboutView does not ask users to manually confirm analysis conclusions', () => {
  assert.equal(/wireframe-confirmed-conclusions|Conclusiones del análisis confirmadas por ti/.test(source.getFullText()), false);
});

test('brief can be generated without previous AI analysis', async () => {
  let writes = 0;
  service.Http.defaults.adapter = async (config: any) => { writes++; return { config, status: 200, statusText: 'OK', headers: {}, data: { data: 'Brief desde requisitos' } }; };
  await service.flow({ project: { id: 'project-a', name: 'Reservas', coreRequirements: ['Crear reserva'], businessRules: 'Sin solapamientos' }, confirmedConclusionsText: '', ensureAiProvider: async () => true, saveProject: async () => {}, setActiveAiAction() {}, message: { success() {}, error: assert.fail } });
  assert.equal(writes, 1);
});

test('provider availability denial sends no HTTP request or save', async () => {
  service.Http.defaults.adapter = () => assert.fail('No HTTP expected');
  await service.flow({ project: { id: 'project-a' }, confirmedConclusionsText: '', ensureAiProvider: async () => false, saveProject: assert.fail, setActiveAiAction: assert.fail, message: { success: assert.fail, error: assert.fail } });
});
