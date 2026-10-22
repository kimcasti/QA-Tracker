// Real components, synthetic loopback API only. Never loads dotenv or a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
assert.ok(process.env.QA_SECURITY_SCRATCH);
const root=fileURLToPath(new URL('../',import.meta.url));
const output=fs.mkdtempSync(path.join(process.env.QA_SECURITY_SCRATCH,'automation-clarity-ui-'));
for(const key of Object.keys(process.env))if(key.startsWith('VITE_'))delete process.env[key];
const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="root"></div><script type="module">'+"import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/tests/e2e/support/automation-clarity-harness.tsx');"+'</script></body></html>';
const server=await createServer({root,envDir:false,cacheDir:path.join(output,'vite-cache'),define:{'import.meta.env.VITE_API_URL':JSON.stringify('/__clarity_api'),'import.meta.env.VITE_USE_SERVICE_AUTH':JSON.stringify('false')},server:{host:'127.0.0.1',port:0,strictPort:true,hmr:false},plugins:[{name:'clarity-synthetic-page',configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.startsWith('/__clarity_fixture')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}next();});}}]});
let browser;const cases=[],errors=[],consoleErrors=[],unexpected=[],writes=[];
try{
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>sessionStorage.setItem('qa_tracker_api_jwt','synthetic-clarity-only'));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==origin){unexpected.push('External origin');return route.abort();}
  if(!url.pathname.startsWith('/__clarity_api/api/'))return route.continue();
  const apiPath=url.pathname.slice('/__clarity_api'.length);
  const reply=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(apiPath==='/api/me/project-contexts'&&request.method()==='GET')return reply({projects:[{documentId:'clarityproject01',key:'CLARITY-FIXTURE',name:'Proyecto sintético de métricas',organization:{documentId:'clarityorg01',name:'Organización sintética',plan:'growth'}}]});
  if(apiPath==='/api/plan-access/report'&&request.method()==='POST'){writes.push(apiPath);return reply({data:{allowed:true,plan:'growth',report:'executiveProjectStatus'}});}
  if(apiPath==='/api/test-runs/clarityrun01/automation-report-jobs'&&request.method()==='GET')return reply({data:{jobs:[],pagination:{page:1,pageSize:100,total:0,pageCount:0}}});
  unexpected.push(request.method()+' '+apiPath);return route.fulfill({status:501,body:'Missing synthetic boundary'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.goto(origin+'/__clarity_fixture?view=reports',{waitUntil:'networkidle',timeout:120000});
 await page.getByText('Estado del Proyecto',{exact:true}).first().click();await page.getByRole('combobox').first().click();
 await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({hasText:/^6$/}).click();
 await page.getByRole('button',{name:/Generar Reporte/i}).click();
 const title=page.getByText('Métricas de automatización',{exact:true});await title.waitFor({timeout:30000});
 const card=title.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," ant-card ")][1]');
 assert.match(await card.innerText(),/Funcionalidades entregadas en Sprint 6/,'Delivery scope must be explicit');
 assert.match(await card.innerText(),/Ejecuciones finalizadas en Sprint 6/,'Execution scope must be explicit');
 const reportModules=card.getByTestId('automation-module-coverage');assert.equal(await reportModules.locator('[data-module-name]').count(),7);
 assert.equal(await reportModules.locator('[data-module-name="Entrega anterior"]').count(),0);
 assert.match(await card.innerText(),/1\/1 resultados automáticos concluyentes/);
 await card.screenshot({path:path.join(output,'report-sprint-scope.png'),animations:'disabled'});cases.push('Report distinguishes delivery and execution sprint, includes all seven delivery modules and older-delivery automatic result');
 const reportCounts=await reportModules.locator('[data-module-name="Inventario"]').innerText();assert.match(reportCounts,/1\s*(?:\/|de)\s*2/);
 await page.goto(origin+'/__clarity_fixture',{waitUntil:'networkidle'});const modules=page.getByTestId('automation-module-coverage');await modules.waitFor();
 assert.equal(await modules.locator('[data-module-name]').count(),8);assert.match(await modules.innerText(),/Todo el proyecto · Estado actual/);
 assert.match(await modules.locator('[data-module-name="Solo manual"]').innerText(),/0%/);assert.match(await modules.locator('[data-module-name="Sin pruebas"]').innerText(),/Sin casos/);
 assert.match(await modules.locator('[data-module-name="Inventario"]').innerText(),/1\s*(?:\/|de)\s*2/);cases.push('Dashboard shows all eight modules, aliases and same denominators, true zero and no-case distinctions');
 const countBefore=writes.length;await modules.getByRole('button',{name:'Ver casos de Inventario',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();assert.match(await dialog.innerText(),/Caso sintético Inventario 1/);assert.match(await dialog.innerText(),/Caso sintético Inventario 2/);assert.doesNotMatch(await dialog.innerText(),/Caso sintético Catálogo/);assert.equal(writes.length,countBefore);cases.push('Readonly module drilldown lists exact alias-linked cases without writes');
 await dialog.getByRole('button',{name:/Close|Cerrar/i}).last().click();
 for(const width of [1280,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);const bounds=await modules.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1);await modules.screenshot({path:path.join(output,`modules-${width}.png`),animations:'disabled'});cases.push(`Module comparison fits ${width}px viewport`);}
 await modules.getByRole('button',{name:'Ver casos de Inventario',exact:true}).click();
 await dialog.waitFor();await page.waitForTimeout(350);
 const modalBounds=await dialog.boundingBox();assert.ok(modalBounds&&modalBounds.x>=0&&modalBounds.x+modalBounds.width<=391);
 assert.match(await dialog.innerText(),/TITULO_SINTETICO_EXTENSO_/);assert.match(await dialog.innerText(),/IDENTIFICADOR-LARGO/);
 assert.equal(await dialog.locator('tbody tr').count(),2);
 assert.ok(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Long content must not expand mobile dialog');
 await dialog.screenshot({path:path.join(output,'module-modal-390.png'),animations:'disabled'});
 await dialog.getByRole('button',{name:/Close|Cerrar/i}).last().click();cases.push('Mobile dialog contains long case identifiers and titles within 390px viewport');
 await modules.getByRole('button',{name:'Ver casos de Solo manual',exact:true}).click();await dialog.waitFor();
 assert.equal(await dialog.locator('tbody tr').count(),2);assert.match(await dialog.innerText(),/Candidata/);assert.match(await dialog.innerText(),/Obsoleta/);assert.match(await dialog.innerText(),/0 de 2 casos automatizados/);
 await dialog.getByRole('button',{name:/Close|Cerrar/i}).last().click();cases.push('Candidate and obsolete cases remain in denominator without legacy automated promotion');
 await modules.getByRole('button',{name:'Ver casos de Sin pruebas',exact:true}).click();await dialog.waitFor();assert.match(await dialog.innerText(),/Sin casos en este módulo/);assert.equal(await dialog.locator('tbody tr').count(),0);assert.equal(writes.length,countBefore);cases.push('Empty module drilldown distinguishes no cases and all drilldowns remain readonly');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 const known=['Warning: [antd: Tag] `bordered={false}` is deprecated. Please use `variant="filled"` instead.','Warning: [antd: Tooltip] `overlayClassName` is deprecated. Please use `classNames.root` instead.','Warning: [antd: Progress] `trailColor` is deprecated. Please use `railColor` instead.','Warning: Instance created by `useForm` is not connected to any Form element. Forget to pass `form` prop?'];
 assert.deepEqual(consoleErrors.filter(text=>!known.includes(text)),[]);
 const result={passed:true,count:cases.length,cases,output,writes,unexpected,pageErrors:errors};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:String(error),errors,consoleErrors,unexpected,writes},null,2));console.error(JSON.stringify({errors,consoleErrors,unexpected,writes,output}));throw error;}finally{await browser?.close();await server.close();}
