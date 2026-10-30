import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const directory = mkdtempSync(join(process.env.QA_SECURITY_SCRATCH!, 'uat-lifecycle-'));
const filename = join(directory, 'service.cjs');
const bundle = buildSync({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
export * from './src/modules/test-runs/services/publicUatSessionsService';
export { Http } from './src/config/http';` }, bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': JSON.stringify({VITE_API_URL:'https://uat.invalid',VITE_USE_SERVICE_AUTH:'false'}) }, logLevel: 'silent' });
writeFileSync(filename, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(filename);
test.after(() => rmSync(directory, {recursive:true,force:true}));
const future = '2099-12-01T10:30:00.000Z';
const session = {documentId:'session1',status:'active',publicUrl:'https://uat.invalid/same-token',expiresAt:future,completedAt:null,completionLocked:false};
function transport(respond: (config:any, index:number)=>any) {
  const calls:any[]=[];
  service.Http.defaults.adapter = async (config:any) => {
    calls.push({method:config.method,url:config.url,body:config.data ? JSON.parse(config.data) : undefined});
    const data = await respond(config,calls.length);
    return {data:{data},status:200,statusText:'OK',config,headers:{}};
  };
  return calls;
}
test('reopen uses encoded run ID, retains link and only resolves after exact status reread', async () => {
  const calls=transport(()=>session);
  assert.equal(typeof service.reopenPublicUatSession,'function');
  const result=await service.reopenPublicUatSession('run/a',{expiresAt:future});
  assert.deepEqual(calls,[
    {method:'put',url:'/api/public-uat-sessions/test-runs/run%2Fa/reopen',body:{data:{expiresAt:future}}},
    {method:'get',url:'/api/public-uat-sessions/test-runs/run%2Fa/status',body:undefined},
  ]);
  assert.equal(result.publicUrl,session.publicUrl);
  assert.equal(result.status,'active');
});
test('reopen rejects stale, missing or different-session readback rather than false success', async () => {
  for (const stale of [null,{...session,status:'completed'}, {...session,completionLocked:true}, {...session,completedAt:'2026-01-01'}, {...session,documentId:'other'}, {...session,publicUrl:'https://uat.invalid/other'}, {...session,expiresAt:'2000-01-01T00:00:00.000Z'}]) {
    transport((_,index)=>index===1 ? session : stale);
    await assert.rejects(()=>service.reopenPublicUatSession('run/a',{expiresAt:future}),/verificar/i);
  }
});
test('expiration rejects mismatched readback and failed verification GET', async () => {
  transport((_,index)=>index===1 ? session : {...session,expiresAt:'2098-01-01T00:00:00.000Z'});
  await assert.rejects(()=>service.changePublicUatSessionExpiration('run/a',future),/verificar/i);
  transport((_,index)=>{if(index===2) throw new Error('Synthetic GET failed'); return session;});
  await assert.rejects(()=>service.changePublicUatSessionExpiration('run/a',future));
});

test('expiration rejects readback that changed lifecycle locks or completion', async () => {
  const completed={...session,status:'completed',completionLocked:true,completedAt:'2026-01-01T00:00:00.000Z'};
  for(const changed of [{...completed,status:'active'},{...completed,completionLocked:false},{...completed,completedAt:null}]) {
    transport((_,index)=>index===1 ? completed : changed);
    await assert.rejects(()=>service.changePublicUatSessionExpiration('run1',future),/verificar/i);
  }
});

test('active elapsed status reads as expired while completed elapsed remains completed', async () => {
  transport(()=>({...session,expiresAt:'2000-01-01T00:00:00.000Z'}));
  assert.equal((await service.getPublicUatSessionStatus('run1')).status,'expired');
  transport(()=>({...session,status:'completed',expiresAt:'2000-01-01T00:00:00.000Z',completionLocked:true}));
  assert.equal((await service.getPublicUatSessionStatus('run1')).status,'completed');
});

test('expiration-only sends exact future instant without reopening a completed session', async () => {
  const completed={...session,status:'completed',completedAt:'2026-01-01T00:00:00.000Z',completionLocked:true};
  const calls=transport(()=>completed);
  assert.equal(typeof service.changePublicUatSessionExpiration,'function');
  const result=await service.changePublicUatSessionExpiration('run/a',future);
  assert.deepEqual(calls,[
    {method:'put',url:'/api/public-uat-sessions/test-runs/run%2Fa/expiration',body:{data:{expiresAt:future}}},
    {method:'get',url:'/api/public-uat-sessions/test-runs/run%2Fa/status',body:undefined},
  ]);
  assert.equal(result.status,'completed');
  assert.equal(result.completionLocked,true);
});
