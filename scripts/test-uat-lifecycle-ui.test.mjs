// Offline real TestExecutionView, lifecycle dialogs/hooks/services and intercepted HTTP. No services/dotenv.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const scratch=process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch && !resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()));
await mkdir(scratch,{recursive:true});
const phase=process.env.QA_UAT_PHASE || 'reopen';
const results=[],unexpected=[],errors=[];
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ConfigProvider} from 'antd';
import TestExecutionView from './src/components/TestExecutionView';
import PublicUatSessionPage from './src/modules/test-runs/components/PublicUatSessionPage';
import {MemoryRouter} from 'react-router-dom';
import './src/i18n/i18n';
import {invalidateWorkspaceCache} from './src/modules/workspace/services/workspaceService';
const root=createRoot(document.getElementById('root'));let revision=0;
window.mount=(role='owner',foreign=false)=>{
 window.fixtureRole=role;window.fixtureForeign=foreign;invalidateWorkspaceCache();
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 root.render(<QueryClientProvider key={++revision} client={client}><ConfigProvider theme={{token:{motion:false}}}><TestExecutionView projectId="SYNTHETIC"/></ConfigProvider></QueryClientProvider>);
};
window.mountPublic=()=>{const client=new QueryClient({defaultOptions:{queries:{retry:false}}});root.render(<QueryClientProvider key={++revision} client={client}><ConfigProvider theme={{token:{motion:false}}}><MemoryRouter initialEntries={['/uat/existing-token']}><PublicUatSessionPage/></MemoryRouter></ConfigProvider></QueryClientProvider>);};`},bundle:true,outfile:join(scratch,'uat-lifecycle.js'),write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',
 define:{'import.meta.env':JSON.stringify({VITE_API_URL:'https://uat-lifecycle.invalid',VITE_USE_SERVICE_AUTH:'false',DEV:false})},
 plugins:[{name:'unrelated-fixtures',setup(b){
 b.onLoad({filter:/[\\/]hooks[\\/]use(Functionalities|Modules|Sprints|TestCases|AutomationImportHistories|Bugs|ParticipantDirectoryMembers)\.ts$/},args=>({contents:`export function ${args.path.match(/(use\w+)\.ts$/)[1]}(){return {data:[],save:async()=>{},saveManyWithSingleRefresh:async()=>{}}}`,loader:'ts'}));
 b.onLoad({filter:/[\\/]hooks[\\/]useWorkspaceAccess\.ts$/},()=>({contents:`export function useWorkspaceAccess(){const role=window.fixtureRole;const membership={documentId:'membership',role:{code:role},organization:{documentId:window.fixtureForeign?'foreign':'org1',name:'Synthetic',plan:'enterprise'}};return {data:{memberships:[membership],projects:[{id:'SYNTHETIC',documentId:'project1'}]},activeMembership:membership,isOwner:role==='owner',isViewer:role==='viewer',projectQuota:{plan:'enterprise',features:{exports:true,ai:false},billing:{planStatus:'active'}}}}`,loader:'ts'}));
 }}]});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))?.text || bundle.outputFiles[0].text;
const componentCss=bundle.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n');
const compiler=await compile(await readFile('src/index.css','utf8'),{base:resolve('src'),onDependency:()=>{}});
const scanner=new Scanner({sources:[{base:resolve('src'),pattern:'**/*.{ts,tsx}',negated:false}]});
const css=compiler.build(scanner.scan());
await writeFile(join(scratch,'lifecycle-browser-bundle.js'),js);
const browser=await chromium.launch({channel:'msedge',headless:true});
let session,writes=[],reads=[],readbacks=[],traffic=[],failWrite=false,failRead=false,hold,release;
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(req.isNavigationRequest()&&req.url()==='https://uat-lifecycle.invalid/') return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'});
  if(url.origin==='https://uat-lifecycle.invalid') {
   if(url.pathname==='/api/public-uat/existing-token')return reply({data:{session:{...session,readOnly:session.status!=='active'||session.completionLocked,allowResultEditing:true,allowCommentEditing:true,allowEvidenceUpload:true,participantName:'Synthetic participant'},testRun:{documentId:'run1',title:'Synthetic UAT lifecycle',status:'final',testType:'uat',results:[{documentId:'result1',result:'passed',notes:'<p>Synthetic retained evidence</p>',testCase:{documentId:'case1',title:'Synthetic preserved case',expectedResult:'Synthetic expected'},functionality:{documentId:'feature1',name:'Synthetic feature'}}]}}});
   if(url.pathname==='/api/me/project-contexts')return reply({projects:[{key:'SYNTHETIC',documentId:'project1',organization:{documentId:'org1',name:'Synthetic'}}]});
   if(url.pathname==='/api/test-runs/list-summary')return reply({data:[{documentId:'run1',title:'Synthetic UAT lifecycle',project:{key:'SYNTHETIC'},status:session?.status==='completed'?'final':'draft',testType:'uat',executionDate:'2026-01-01',tester:'Synthetic participant',publicUatSession:session,totalResults:1,executedResults:1,passedResults:1,results:[]}]});
   if(url.pathname==='/api/public-uat-sessions/test-runs/run1/status') {
    reads.push('status');if(failRead)return reply({error:{message:'Synthetic status failed'}},503);
    traffic.push({method:req.method(),path:url.pathname});readbacks.push(structuredClone(session));return reply({data:session});
   }
   if(req.method()==='PUT' && url.pathname==='/api/public-uat-sessions/test-runs/run1/revoke') {
    writes.push({action:'revoke',data:req.postDataJSON()});
    session={...session,status:'revoked',revokedAt:'2026-01-01T00:00:00.000Z'};
    return reply({data:session});
   }
   if(req.method()==='PUT'&&/\/api\/public-uat-sessions\/test-runs\/run1\/(reopen|expiration)$/.test(url.pathname)) {
    const data=req.postDataJSON().data;writes.push({action:url.pathname.split('/').at(-1),data});traffic.push({method:req.method(),path:url.pathname});
    if(hold)await hold;
    if(failWrite)return reply({error:{message:'Synthetic write rejected'}},403);
    session={...session,...data,...(url.pathname.endsWith('/reopen')?{status:'active',completedAt:null,completionLocked:false}:{})};
    return reply({data:session});
   }
  }
  unexpected.push(req.method()+' '+req.url());return route.abort();
 });
 await page.goto('https://uat-lifecycle.invalid/');
 await page.evaluate(()=>{window.copiedLinks=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.copiedLinks.push(value)}});});
 await page.addStyleTag({content:css+'\n'+componentCss});await page.addScriptTag({content:js});
 const reset=async(role='owner',overrides={},foreign=false)=>{
  session=overrides===null?null:{documentId:'session1',status:'completed',expiresAt:'2000-01-01T00:00:00.000Z',completedAt:'2000-01-01T00:00:00.000Z',completionLocked:true,publicUrl:'https://uat.invalid/existing-token',participant:{name:'Synthetic participant',email:'participant@example.invalid'},...overrides};
  writes=[];reads=[];readbacks=[];traffic=[];failWrite=false;failRead=false;hold=undefined;
  await page.evaluate(()=>{window.copiedLinks=[];});
  await page.evaluate(({role,foreign})=>window.mount(role,foreign),{role,foreign});
  await expect(page.locator('tr[data-row-key="run1"]')).toBeVisible();
 };
 const menu=async()=>page.locator('tr[data-row-key="run1"]').getByRole('button',{name:'Más acciones',exact:true}).click();
 const reopen=()=>page.getByRole('menuitem',{name:'Reabrir sesión UAT',exact:true});
 const expiry=()=>page.getByRole('menuitem',{name:'Cambiar fecha de caducidad',exact:true});
 const dialog=page.getByRole('dialog');
 await reset();await menu();
 await expect(reopen().locator('.anticon-reload')).toBeVisible();
 await expect(reopen().locator('.anticon-reload')).toHaveAttribute('aria-hidden', 'true');
 await expect(expiry().locator('.anticon-calendar')).toBeVisible();
 await expect(expiry().locator('.anticon-calendar')).toHaveAttribute('aria-hidden', 'true');
 await expect(reopen(),'Completed sessions expose explicit reopen, not activation').toBeVisible({timeout:3000});
 await reopen().click();await expect(dialog).toContainText('mismo enlace');
 await expect(dialog).toContainText('No se eliminarán');
 assert.ok(reads.length>0,'opening must read fresh status');
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 await expect(dialog).toBeHidden();assert.equal(writes.length,0);
 results.push('completed expired reopen opens fresh confirmation; cancel has zero writes');
 await menu();await reopen().click();
 await dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true}).click();
 await expect(dialog).toContainText('fecha y hora futuras');assert.equal(writes.length,0);
 results.push('expired reopen requires future date and time');
 await page.screenshot({path:join(scratch,`${phase}-dialog.png`),fullPage:true});
 if(phase!=='open') {
  await dialog.getByLabel('Fecha y hora de caducidad').fill('2099-12-01T10:30');
  const readsBefore=reads.length;hold=new Promise(resolve=>{release=resolve;});
  await dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true}).click();
  await expect.poll(()=>writes.length).toBe(1);
  await dialog.locator('.ant-modal-footer button').last().evaluate(el=>{el.click();el.click();});
  assert.equal(writes.length,1);release();hold=undefined;
  await expect(dialog).toBeHidden();
  assert.equal(session.status,'active');assert.equal(session.completedAt,null);assert.equal(session.completionLocked,false);
  assert.equal(session.publicUrl,'https://uat.invalid/existing-token');
  assert.ok(reads.length>readsBefore,'write must independently reread status');
  assert.equal(writes[0].action,'reopen');assert.ok(Date.parse(writes[0].data.expiresAt)>Date.now());
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('Acceso público: Vigente hasta');
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('Edición del cliente: Permitida');
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('En curso');
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('100%');
  results.push('reopen sends one PUT despite repeated clicks; verifies GET; retains same link; shows En curso with 100% answered');
 }
 if(['copy','all'].includes(phase)) {
  for(const [role,overrides,foreign] of [
   ['owner',{status:'expired'},false],
   ['owner',{status:'expired',expiresAt:'2099-01-01T00:00:00.000Z'},false],
   ['qa-lead',{status:'active',completedAt:null,completionLocked:false},false],
   ['viewer',{},false],
   ['owner',{status:'expired',publicUrl:null},true],
  ]) {
   await reset(role,overrides,foreign);const before=structuredClone(session);
   await menu();await page.getByRole('menuitem',{name:/Copiar enlace público/}).click();
   await expect(page.getByText('El enlace público está vencido. Cambia la fecha de caducidad o reabre la sesión antes de copiarlo.',{exact:true})).toBeVisible();
   await expect(page.getByRole('dialog',{name:'Generar enlace público UAT',exact:true})).toHaveCount(0);
   assert.ok(reads.length>0,'Copy reads fresh status rather than activating');
   assert.deepEqual(writes,[]);assert.deepEqual(session,before);
   assert.deepEqual(await page.evaluate(()=>window.copiedLinks),[]);
   await expect(page.getByText('El enlace público está vencido. Cambia la fecha de caducidad o reabre la sesión antes de copiarlo.',{exact:true})).toBeHidden({timeout:8000});
  }
  for(const overrides of [
   {status:'active',expiresAt:'2099-01-01T00:00:00.000Z',publicUrl:null},
   {status:'completed',expiresAt:'2099-01-01T00:00:00.000Z',publicUrl:null},
  ]) {
   await reset('owner',overrides);await menu();await page.getByRole('menuitem',{name:/Copiar enlace público/}).click();
   await expect(page.getByText('Esta ejecución UAT aún no tiene un enlace público disponible.',{exact:true})).toBeVisible();
   await expect(page.getByRole('dialog',{name:'Generar enlace público UAT',exact:true})).toHaveCount(0);
   assert.deepEqual(writes,[]);
   await expect(page.getByText('Esta ejecución UAT aún no tiene un enlace público disponible.',{exact:true})).toBeHidden({timeout:8000});
  }
  results.push('expired Copy uses fresh status and guidance only, never opens activation or writes; missing URL never activates');
  for(const status of ['active','completed']) {
   await reset('owner',{status,expiresAt:'2099-01-01T00:00:00.000Z'});await menu();
   await page.getByRole('menuitem',{name:/Copiar enlace público/}).click();
   await expect.poll(()=>page.evaluate(()=>window.copiedLinks)).toEqual(['https://uat.invalid/existing-token']);
   await expect(page.getByRole('dialog',{name:'Generar enlace público UAT',exact:true})).toHaveCount(0);assert.deepEqual(writes,[]);
  }
  for(const overrides of [null,{status:'draft'},{status:'revoked'}]) {
   await reset('owner',overrides);await menu();await page.getByRole('menuitem',{name:/Generar enlace público/}).click();
   const activation=page.getByRole('dialog',{name:'Generar enlace público UAT',exact:true});await expect(activation).toBeVisible();
   await activation.getByRole('button',{name:'Cancelar',exact:true}).click();assert.deepEqual(writes,[]);
  }
  results.push('usable active/completed Copy retains same link; explicit generation for missing/draft/revoked still opens deliberately');
 }
 if(['revoked','all'].includes(phase)) {
  for(const role of ['owner','qa-lead']) {
   await reset(role,{status:'revoked',revokedAt:'2026-01-02T00:00:00.000Z',deliveryNotes:'Synthetic retained notes',allowResultEditing:false,allowCommentEditing:false,allowEvidenceUpload:false});
   const before=structuredClone(session);
   await menu();await expect(reopen()).toHaveCount(0);await expect(expiry()).toBeVisible();
   await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
   await expect(dialog).toContainText('Acceso público: Revocado');
   await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toHaveCount(0);
   await expect(dialog.getByRole('button',{name:'Cambiar fecha de caducidad',exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Cambiar fecha de caducidad',exact:true}).click();
   await expect(dialog.getByLabel('Fecha y hora de caducidad')).toBeVisible();
   await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toHaveCount(0);
   const readsBefore=reads.length;
   await dialog.getByLabel('Fecha y hora de caducidad').fill('2099-11-01T10:30');
   await dialog.getByRole('button',{name:'Guardar caducidad',exact:true}).click();
   await expect(dialog).toBeHidden();
   assert.deepEqual(writes.map(w=>w.action),['expiration']);
   assert.deepEqual(Object.keys(writes[0].data),['expiresAt']);
   assert.deepEqual(session,{...before,expiresAt:writes[0].data.expiresAt});
   assert.ok(reads.length>readsBefore,'expiry performs exact-target status readback');
   assert.deepEqual(readbacks.at(-1),session);
   assert.deepEqual(traffic.slice(-2),[
    {method:'PUT',path:'/api/public-uat-sessions/test-runs/run1/expiration'},
    {method:'GET',path:'/api/public-uat-sessions/test-runs/run1/status'},
   ]);
   await menu();await expect(reopen()).toHaveCount(0);
   await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
   await expect(dialog).toContainText('Acceso público: Revocado');
   await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toHaveCount(0);
   await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
   await menu();await expiry().click();await expect(dialog.getByLabel('Fecha y hora de caducidad')).toBeVisible();
   await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(writes.length,1);
  }
  for(const [role,foreign] of [['viewer',false],['manager',false],['qa-engineer',false],['owner',true],['qa-lead',true]]) {
   await reset(role,{status:'revoked'},foreign);await menu();
   await expect(reopen()).toHaveCount(0);await expect(expiry()).toHaveCount(0);
   await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
   await expect(dialog).toContainText('Acceso público: Revocado');
   await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toHaveCount(0);
   await expect(dialog.getByRole('button',{name:'Cambiar fecha de caducidad',exact:true})).toHaveCount(0);
   await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();assert.deepEqual(writes,[]);
  }
  results.push('revoked Owner/QA Lead can view status and edit expiry through menu/status; real expiration PUT and exact-target GET retain revocation, link, locks, notes and permissions; never reopen; other/foreign roles have no lifecycle writes');
 }
 if(['expiration','all'].includes(phase)) {
  await reset();await menu();await expect(expiry()).toBeVisible({timeout:3000});await expiry().click();
  await expect(dialog).toContainText('no reabre una sesión completada');
  await dialog.getByRole('button',{name:'Guardar caducidad',exact:true}).click();
  await expect(dialog).toContainText('fecha y hora futuras');assert.equal(writes.length,0);
  await dialog.getByLabel('Fecha y hora de caducidad').fill('2099-11-01T10:30');
  const completedAt=session.completedAt;
  await dialog.getByRole('button',{name:'Guardar caducidad',exact:true}).click();
  await expect(dialog).toBeHidden();
  assert.deepEqual(writes.map(w=>w.action),['expiration']);
  assert.equal(session.status,'completed');assert.equal(session.completionLocked,true);assert.equal(session.completedAt,completedAt);
  assert.equal(session.publicUrl,'https://uat.invalid/existing-token');
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('Edición del cliente: Bloqueada por finalización');
  await page.evaluate(()=>window.mountPublic());
  await expect(page.getByRole('combobox',{name:'Resultado del caso 1'})).toBeDisabled();
  await expect(page.getByRole('button',{name:/Guardar resultado/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Finalizar evaluación UAT/})).toHaveCount(0);
  await expect(page.getByText('Synthetic preserved case',{exact:true}).first()).toBeVisible();
  results.push('expiry-only requires future date and leaves completed session locked, same completion and link; real public page remains readonly');
 }
 if(['revoke-action','all'].includes(phase)) {
  await reset('owner',{status:'active',completionLocked:false,completedAt:null,expiresAt:'2099-12-01T00:00:00.000Z'});
  const before=structuredClone(session);
  await menu();await page.getByRole('menuitem',{name:/Revocar acceso público/}).click();
  await expect(dialog).toContainText('El enlace público dejará de permitir el acceso');
  await expect(dialog).toContainText('no finaliza la ejecución');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toBeHidden();
  assert.deepEqual(writes,[]);assert.deepEqual(session,before);
  await menu();await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialog).toBeHidden();assert.deepEqual(writes,[]);
  await menu();await page.getByRole('menuitem',{name:/Revocar acceso público/}).click();
  await dialog.getByRole('button',{name:'Revocar acceso público',exact:true}).click();await expect(dialog).toBeHidden();
  assert.deepEqual(writes,[{action:'revoke',data:{}}]);
  assert.deepEqual(session,{...before,status:'revoked',revokedAt:'2026-01-01T00:00:00.000Z'});
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('Acceso público: Revocado');
  await expect(page.locator('tr[data-row-key="run1"]')).toContainText('En curso');
  results.push('Revocar acceso público is distinct from modal Cerrar; explicit cancel has zero writes, confirmed action retains lifecycle API and execution/results');
 }
 if(['status','all'].includes(phase)) {
  const future='2099-01-01T00:00:00.000Z';
  const active={status:'active',expiresAt:future,completedAt:null,completionLocked:false,allowResultEditing:true,allowEvidenceUpload:true,allowCommentEditing:true};
  const matrix=[
   [{expiresAt:future},'Finalizada','Vigente hasta','Bloqueada por finalización'],
   [{},'Finalizada','Vencido','Bloqueada por finalización'],
   [active,'En curso','Vigente hasta','Permitida'],
   [{...active,expiresAt:'2000-01-01T00:00:00.000Z'},'En curso','Vencido','No disponible por caducidad'],
   [{...active,completionLocked:true},'En curso','Vigente hasta','Bloqueada por finalización'],
   [{status:'revoked'},'En curso','Revocado','No disponible por revocación'],
   [null,'En curso','Sin activar','No disponible'],
   [{status:'draft'},'En curso','Sin activar','No disponible'],
   [{...active,expiresAt:'invalid'},'En curso','No disponible: caducidad desconocida','No disponible'],
  ];
  for(let flags=0;flags<8;flags++) matrix.push([
   {...active,allowResultEditing:Boolean(flags&1),allowEvidenceUpload:Boolean(flags&2),allowCommentEditing:Boolean(flags&4)},
   'En curso','Vigente hasta',flags===0?'No permitida por configuración':flags===7?'Permitida':'Permitida con permisos limitados'
  ]);
  for(const [overrides,execution,access,editing] of matrix) {
   await reset('owner',overrides);
   const row=page.locator('tr[data-row-key="run1"]');
   await expect(row).toContainText('Acceso público: '+access);
   await expect(row).toContainText('Edición del cliente: '+editing);
   await expect(row).toContainText(execution==='Finalizada'?'Finalizada':'En curso');
   await expect(row).toContainText('100%');
   if(overrides===null || overrides.status==='draft') continue;
   await menu();await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
   await expect(dialog).toContainText('Ejecución: '+execution);
   await expect(dialog).toContainText('Acceso público: '+access);
   await expect(dialog).toContainText('Edición del cliente: '+editing);
   await expect(dialog).toContainText('Caducidad del acceso público:');
   if(session.expiresAt && Number.isFinite(Date.parse(session.expiresAt))) {
    const year=await page.evaluate(value=>new Date(value).getFullYear(),session.expiresAt);
    await expect(dialog.getByText('Caducidad del acceso público:',{exact:true}).locator('..')).toContainText(String(year));
   }
   await expect(dialog).toContainText('Participante:');
   await expect(dialog).toContainText('Activada:');
   await expect(dialog).toContainText('Último acceso:');
   await expect(dialog).toContainText('Ampliar la caducidad recupera el acceso');
   await expect(dialog).toContainText('Reabrir habilita la edición');
   if(overrides.allowResultEditing!==undefined) {
    for(const [label,allowed] of [['Resultados',overrides.allowResultEditing],['Evidencias',overrides.allowEvidenceUpload],['Comentarios',overrides.allowCommentEditing]]) {
     await expect(dialog).toContainText(label+': '+(allowed?'Permitido':'No permitido'));
    }
   }
   await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialog).toBeHidden();
   assert.deepEqual(writes,[]);
  }
  await reset();await page.screenshot({path:join(scratch,'desktop-history.png'),fullPage:true});
  await menu();await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
  await expect(dialog).toContainText('Ejecución: Finalizada');
  await page.screenshot({path:join(scratch,'desktop-status.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialog).toBeHidden();
  await reset('owner',active);await menu();await expect(reopen()).toHaveCount(0);await expect(expiry()).toBeVisible();
  await page.keyboard.press('Escape');
  results.push(matrix.length+'-case real history/modal matrix: independent execution/access/editing; completed valid/expired, active valid/expired/locked, revoked, missing/draft, invalid expiry and all 8 editing flag combinations; 100% remains independent');
 }
 if(['permissions','all'].includes(phase)) {
  for(const role of ['viewer','manager','qa-engineer']) {
   await reset(role);await menu();await expect(reopen()).toHaveCount(0);await expect(expiry()).toHaveCount(0);
   await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();await expect(dialog).toContainText('Edición del cliente: Bloqueada por finalización');
   await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toHaveCount(0);
   await expect(dialog.getByRole('button',{name:'Cambiar fecha de caducidad',exact:true})).toHaveCount(0);
   await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();assert.equal(writes.length,0);
  }
  await reset('owner',{},true);await menu();await expect(reopen()).toHaveCount(0);await expect(expiry()).toHaveCount(0);
  await page.keyboard.press('Escape');
  await reset('qa-lead');await menu();await expect(reopen()).toBeVisible();await expect(expiry()).toBeVisible();
  await page.keyboard.press('Escape');
  results.push('only target-project organization Owner/QA Lead can administer; Viewer/Manager/QA Engineer and foreign Owner cannot');
 }
 if(['failure','all'].includes(phase)) {
  await reset();await menu();await reopen().click();await dialog.getByLabel('Fecha y hora de caducidad').fill('2099-11-01T10:30');
  failWrite=true;await dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true}).click();
  await expect(dialog).toContainText('Synthetic write rejected');
  await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toBeDisabled();
  await expect(page.getByText('Sesión UAT reabierta y verificada.',{exact:true})).toHaveCount(0);
  failWrite=false;await dialog.getByRole('button',{name:'Actualizar estado',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toBeEnabled();
  failRead=true;await dialog.getByLabel('Fecha y hora de caducidad').fill('2099-11-01T10:30');
  await dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true}).click();
  await expect(dialog).toContainText('Actualiza el estado');
  await expect(page.getByText('Sesión UAT reabierta y verificada.',{exact:true})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toBeDisabled();
  failRead=false;await dialog.getByRole('button',{name:'Actualizar estado',exact:true}).click();
  await expect(dialog).toContainText('no se puede reabrir');
  await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toBeDisabled();
  assert.equal(writes.length,2);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await reset();await menu();session={...session,status:'revoked'};await reopen().click();
  await expect(dialog).toContainText('no se puede reabrir');
  await expect(dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})).toBeDisabled();assert.equal(writes.length,0);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  results.push('write rejection and accepted-but-unverified read failure never announce success; fresh refresh required; stale revoked/read-only eligibility blocks writes');
 }
 if(['mobile','all'].includes(phase)) {
  await page.setViewportSize({width:390,height:844});
  await reset();await page.waitForTimeout(350);
  const summary=page.getByTestId('uat-access-editing');
  await expect(summary).toContainText('Acceso público: Vencido');
  await expect(summary).toContainText('Edición del cliente: Bloqueada por finalización');
  assert.ok(await summary.evaluate(el=>el.scrollWidth<=el.clientWidth),'390px summary wraps within its cell');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'table scroll stays container-local at 390px');
  await page.screenshot({path:join(scratch,'mobile-history.png'),fullPage:true,animations:'disabled'});
  await menu();await reopen().click();await expect(dialog.getByLabel('Fecha y hora de caducidad')).toBeVisible();
  await page.waitForTimeout(350);
  for(const locator of [dialog.locator('.ant-modal-container'),dialog.getByLabel('Fecha y hora de caducidad'),dialog.getByRole('button',{name:'Cancelar',exact:true}),dialog.getByRole('button',{name:'Reabrir sesión UAT',exact:true})]) {
   const box=await locator.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=390,'390px dialog and controls fit');
  }
  await page.screenshot({path:join(scratch,'mobile-reopen.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await menu();await page.getByRole('menuitem',{name:/Ver estado de sesión/}).click();
  await expect(dialog.getByRole('button',{name:'Cambiar fecha de caducidad',exact:true})).toBeVisible();
  await expect(dialog).toContainText('Ejecución: Finalizada');
  await expect(dialog).toContainText('Acceso público: Vencido');
  await expect(dialog).toContainText('Edición del cliente: Bloqueada por finalización');
  await page.waitForTimeout(350);
  assert.ok(await dialog.locator('.ant-modal-body').evaluate(el=>el.scrollWidth<=el.clientWidth),'390px status content does not overflow');
  const statusBox=await dialog.locator('.ant-modal-container').boundingBox();
  assert.ok(statusBox && statusBox.x>=0 && statusBox.x+statusBox.width<=390,'390px status dialog fits');
  await page.screenshot({path:join(scratch,'mobile-status.png'),fullPage:true,animations:'disabled'});
  await dialog.getByRole('button',{name:'Cambiar fecha de caducidad',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Estado de sesión pública UAT',exact:true})).toBeHidden();
  await expect(dialog).toContainText('no reabre una sesión completada');
  await page.waitForTimeout(350);await page.screenshot({path:join(scratch,'mobile-expiration.png'),fullPage:true});
  for(const locator of [dialog.locator('.ant-modal-container'),dialog.getByLabel('Fecha y hora de caducidad'),dialog.getByRole('button',{name:'Guardar caducidad',exact:true})]) {
   const box=await locator.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=390,'390px expiry dialog and controls fit');
  }
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(writes.length,0);
  results.push('390px reopen and expiry dialogs with real compiled styles fit; status-modal action launches fresh expiry dialog; both cancel without writes');
 }
 assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({phase,results,writes,reads,unexpected,errors},null,2));
}finally{release?.();await browser.close();await writeFile(join(scratch,`${phase}-browser-results.json`),JSON.stringify({phase,results,writes,reads,unexpected,errors},null,2));}
