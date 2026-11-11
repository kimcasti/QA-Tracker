import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

assert.ok(process.env.QA_SECURITY_SCRATCH);
mkdirSync(process.env.QA_SECURITY_SCRATCH, { recursive: true });
const directory = mkdtempSync(join(process.env.QA_SECURITY_SCRATCH, 'stitch-service-'));
const file = join(directory, 'service.cjs');
const bundle = buildSync({ stdin: { contents: `export {Http} from './src/config/http'; export * from './src/services/stitchService';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://stitch-fixture.invalid' }) }, logLevel: 'silent' });
writeFileSync(file, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(file);
test.after(() => rmSync(directory, { recursive: true, force: true }));
const version = { id: 'version-a', status: 'completed', createdAt: '2026-01-01T12:00:00Z', screens: [{ id: 'screen-a', title: 'Inicio' }] };
function response(data: unknown) {
  service.Http.defaults.adapter = async (config: unknown) => ({ config, status: 200, statusText: 'OK', headers: {}, data: { data } });
}

test('gallery transport rejects malformed nested records rather than crashing render', async () => {
  for (const invalid of [null, {}, { ...version, screens: null }, { ...version, screens: [null] }, { ...version, status: 'invented' }, { ...version, createdAt: 'not-a-date' }, { ...version, screens: [{ id: 'x' }] }]) {
    response({ configured: true, versions: [invalid] });
    await assert.rejects(service.loadWireframes('project-a'), /inválida/);
  }
});

test('valid gallery projection preserves only declared fields', async () => {
  response({ configured: true, versions: [{ ...version, privateMetadata: 'not-for-ui', screens: [{ id: 'screen-a', title: 'Inicio', secret: 'not-for-ui' }] }] });
  const gallery = await service.loadWireframes('project-a');
  assert.deepEqual(gallery, { configured: true, versions: [version] });
});

test('history remains readable beyond one hundred saved versions', async () => {
  const versions = Array.from({ length: 101 }, (_, index) => ({ ...version, id: `version-${index}` }));
  response({ configured: true, versions });
  assert.equal((await service.loadWireframes('project-a')).versions.length, 101);
});

test('generation validates full acknowledgement before confirming it', async () => {
  response({ id: 'version-a', screens: [] });
  await assert.rejects(service.generateWireframe('project-a', 'request-a'));
});

test('link and image helpers reject external or active content', () => {
  assert.equal(service.safeStitchUrl('https://stitch.withgoogle.com/projects/123'), 'https://stitch.withgoogle.com/projects/123');
  assert.equal(service.safeStitchUrl('https://stitch.withgoogle.com/projects/alpha_123-xyz'), 'https://stitch.withgoogle.com/projects/alpha_123-xyz');
  for (const url of ['javascript:alert(1)', 'https://stitch.withgoogle.com.evil.invalid/projects/123', 'https://stitch.withgoogle.com/projects/123?secret=1']) assert.equal(service.safeStitchUrl(url), undefined);
  assert.equal(service.safeWireframeImage('https://external.invalid/image.png'), undefined);
  assert.equal(service.safeWireframeImage('data:image/svg+xml;base64,PHN2Zz4='), undefined);
});


test('multi-screen versions retain proposed journey and ordered allowlisted screens beside legacy versions',async()=>{
 const flow={...version,id:'flow',flowSummary:'Elegir → Revisar → Confirmar',screens:[{id:'a',title:'1. Elegir',secret:'private'},{id:'b',title:'2. Revisar'},{id:'c',title:'3. Confirmar'}]};
 response({configured:true,versions:[flow,version]});
 const gallery=await service.loadWireframes('project-a');
 assert.equal(gallery.versions[0].flowSummary,flow.flowSummary);
 assert.deepEqual(gallery.versions[0].screens.map((s:any)=>s.id),['a','b','c']);assert.equal(gallery.versions[0].screens[0].secret,undefined);
 assert.deepEqual(gallery.versions[1],version);
});
test('oversized or duplicated screen sets and non-text journey metadata fail closed',async()=>{
 for(const invalid of [{...version,screens:Array.from({length:13},(_,i)=>({id:String(i),title:'Step'}))},{...version,screens:[{id:'a',title:'One'},{id:'a',title:'Duplicate'}]},{...version,flowSummary:{secret:'hidden'}}]) {
  response({configured:true,versions:[invalid]});await assert.rejects(service.loadWireframes('project-a'),/inválida/);
 }
});
