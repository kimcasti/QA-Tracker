// Offline real case editor + hook + services; no listener, DB or dotenv.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch && !resolve(scratch).toLowerCase().startsWith(resolve('.').toLowerCase()));
await mkdir(scratch, { recursive: true });
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import {App,ConfigProvider} from 'antd';
import TestCaseManagement from './src/components/TestCaseManagement'; import './src/i18n/i18n';
const root=createRoot(document.getElementById('root')); let generation=0;
window.mount=()=>root.render(<QueryClientProvider key={++generation} client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ConfigProvider><App><TestCaseManagement projectId="P" functionalityId="SAME" functionalityDocumentId="b" organizationDocumentId="o" functionalityName="Synthetic" moduleName="Module" initialCaseId="case" /></App></ConfigProvider></QueryClientProvider>);
` }, outdir: join(scratch, 'case-save-bundle'), write: false, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'https://case-save.invalid', DEV: false }) }, plugins: [{ name: 'workspace-role', setup(b) { b.onLoad({ filter: /[\\/]hooks[\\/]useWorkspaceAccess\.ts$/ }, () => ({ loader: 'ts', contents: `export function useWorkspaceAccess(){return {isViewer:false,data:{memberships:[{organization:{documentId:'o'},role:{code:'owner'}}]}}}` })); } }] });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
const project = { documentId: 'p', key: 'P', organization: { documentId: 'o' } };
const parent = { documentId: 'b', code: 'SAME', project };
let row = { documentId: 'case', title: 'Synthetic case', project, functionality: parent, testType: 'functional', priority: 'medium', description: '', testSteps: '<p>Steps</p>', expectedResult: '<p>Expected</p>' };
let writes = 0, hold, release, failRead = false, committed = false, failAck = false;
const unexpected = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
await page.route('**/*', async route => {
 const req=route.request(), url=new URL(req.url());
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(req.isNavigationRequest() && url.href==='https://case-save.invalid/') return route.fulfill({contentType:'text/html',body:'<html><div id="root"></div></html>'});
 if(url.origin!=='https://case-save.invalid'){unexpected.push(url.href);return route.abort();}
 if(url.pathname==='/api/me/project-contexts')return reply({projects:[project]});
 if(url.pathname==='/api/me/workspace')return reply({projects:[project],memberships:[]});
 if(url.pathname==='/api/functionalities/b')return reply({data:parent});
 if(url.pathname==='/api/test-cases/case'){
   if(req.method()==='GET')return failRead&&committed?reply({error:{message:'Readback unavailable'}},403):reply({data:row});
   writes++;const data=req.postDataJSON().data;row={...row,...data,project,functionality:parent};committed=true;
   if(hold)await hold;
   if(failAck)return route.abort('failed');
   return reply({data:row});
 }
 if(url.pathname==='/api/test-cases')return failRead&&committed?reply({error:{message:'Reload unavailable'}},503):reply({data:[row]});
 if(url.pathname==='/api/test-case-templates'||url.pathname==='/api/project-modules')return reply({data:[]});
 unexpected.push(req.method()+' '+url.href);return route.abort();
});
await page.goto('https://case-save.invalid/');
for(const css of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:css.text});
await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});await page.evaluate(()=>window.mount());
const title=page.getByRole('textbox',{name:/Título/});await expect(title).toHaveValue('Synthetic case');
await title.fill('Changed exactly'); hold=new Promise(resolve=>{release=resolve;});failRead=true;
const submit=page.locator('button[type="submit"]');
await submit.evaluate(button=>{button.click();button.click();});
await expect.poll(()=>writes).toBe(1);await expect(submit).toBeDisabled();
release();hold=null;
const reload=page.getByRole('button',{name:/Recargar casos/});await expect(reload).toBeVisible();
await expect(submit).toBeDisabled();assert.equal(writes,1);
await reload.click();await expect(reload).toBeEnabled();await expect(submit).toBeDisabled();assert.equal(writes,1);
failRead=false;await reload.click();await expect(title).toBeHidden();
assert.equal(writes,1);assert.equal(row.title,'Changed exactly');assert.equal(row.functionality.documentId,'b');
// A lost acknowledgement after commit must not allow another PUT, even if ordinary reads succeed.
committed=false;failAck=true;await page.evaluate(()=>window.mount());
await expect(title).toHaveValue('Changed exactly');await title.fill('Lost ack committed');
await submit.click();await expect(reload).toBeVisible();await expect(submit).toBeDisabled();
assert.equal(writes,2);assert.equal(row.title,'Lost ack committed');
await reload.click();await expect(title).toBeHidden();assert.equal(writes,2);
assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
console.log('PASS actual form double-submit: one PUT; postcommit readback403 locks writes; failed explicit reload stays locked; successful reload discards stale form; exact sibling preserved.');
} finally { await writeFile(join(scratch,'case-save-browser-evidence.json'),JSON.stringify({writes,row,unexpected,errors},null,2));await browser.close(); }
