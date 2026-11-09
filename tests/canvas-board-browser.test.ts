import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CanvasBoard} from './src/modules/canvas/components/CanvasBoard';
const catalog={modules:[{documentId:'m1',name:'Accounts'}],functionalities:[{documentId:'f1',code:'F-1',name:'Register',moduleDocumentId:'m1'},{documentId:'f2',code:'F-2',name:'Unlinked'}],cases:[{documentId:'c1',title:'Exact case',functionalityDocumentId:'f1',functionalityCode:'F-1',testCase:{testType:'Funcional'}}],sprints:[]};
const state={version:1,newElementColor:'default',nodes:{},notes:[{id:'free',html:'<p><strong>Free body</strong></p><img src="https://blocked.invalid/image"><script>window.pwned=true</script>'},{id:'related',anchorId:'case:c1',html:'<p>Secret related body</p>'}]};
window.events=[]; window.original=JSON.stringify(state);
const log=(name)=>(...args)=>window.events.push([name,...args]);
let overrides={}; const root=createRoot(document.getElementById('root'));
window.renderBoard=(next={})=>{overrides={...overrides,...next};root.render(<CanvasBoard projectId="project-a" catalog={catalog} state={state} expanded={{f1:true}} canEdit={true} busy={false} onToggle={log('toggle')} onNotes={log('notes')} onEditCase={log('editCase')} onEditModule={log('editModule')} onEditFunctionality={log('editFunctionality')} onCreateFunctionality={log('createFunctionality')} onAddCases={log('addCases')} onEditNote={log('editNote')} onDeleteNote={log('deleteNote')} onColor={log('color')} onMove={log('move')} onDropTool={log('drop')} {...overrides}/>);};
window.getState=()=>JSON.stringify(state);window.renderBoard();
`;

test('offline real board: responsive cards, exact callbacks, safe tool targets and zoom-aware pointer movement', async () => {
  const scratch = process.env.QA_SECURITY_SCRATCH;
  assert.ok(scratch, 'set external QA_SECURITY_SCRATCH');
  await mkdir(scratch, { recursive: true });
  const css = await readFile('src/modules/canvas/components/canvas.css', 'utf8');
  const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser' });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest() && route.request().url() === 'http://canvas.offline/') return route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><main id="root" style="position:relative;min-width:0"></main></body></html>' });
    requests.push(route.request().url()); return route.abort();
  });
  const node = (key: string) => page.locator(`[data-node="${key}"]`);
  const resetEvents = () => page.evaluate('window.events=[]');
  const events = () => page.evaluate('window.events') as Promise<unknown[][]>;
  const drop = async (selector: string, payload: unknown, type = 'application/x-qa-canvas') => {
    await page.locator(selector).evaluate((target, { payload, type }) => {
      const transfer = new DataTransfer(); transfer.setData(type, typeof payload === 'string' ? payload : JSON.stringify(payload));
      target.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true, clientX: 120, clientY: 180 }));
      target.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true, clientX: 120, clientY: 180 }));
    }, { payload, type });
  };
  try {
    await page.goto('http://canvas.offline/'); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await node('note:free').waitFor();
    assert.equal(await page.locator('.canvas-note-content strong').textContent(), 'Free body');
    assert.equal(await page.getByText('Secret related body').count(), 0);
    assert.equal(await page.evaluate('Boolean(window.pwned)'), false);
    assert.equal(await page.locator('.canvas-connectors > path').count(), 1);
    for (const [label, result] of [
      ['Editar módulo Accounts', ['editModule', 'm1']], ['Editar funcionalidad Register', ['editFunctionality', 'f1']],
      ['Color de Accounts', ['color', 'module:m1']], ['Notas de Exact case (1)', ['notes', 'case:c1']],
      ['Editar nota', ['editNote', 'free']], ['Eliminar nota', ['deleteNote', 'free']],
      ['Editar caso Exact case', ['editCase', 'F-1', 'c1']],
    ] as const) {
      await resetEvents(); await page.getByRole('button', { name: label, exact: true }).or(page.getByRole('link', { name: label, exact: true })).click();
      assert.deepEqual(await events(), [result]);
    }
    await resetEvents(); await page.getByText('Agregar funcionalidad', { exact: true }).click(); assert.deepEqual(await events(), [['createFunctionality','m1']]);
    await resetEvents(); await node('functionality:f1').getByText('Agregar casos de prueba', { exact: true }).click(); assert.deepEqual(await events(), [['addCases','f1']]);
    await resetEvents(); await page.getByRole('link', {name:'Exact case',exact:true}).click(); assert.deepEqual(await events(), [['editCase','F-1','c1']]);
    await resetEvents(); await drop('.canvas-world', {kind:'module',projectId:'project-a'}); assert.equal((await events())[0]?.[0], 'drop');
    for (const [selector, kind, anchor] of [['[data-node="module:m1"]','functionality','module:m1'],['[data-node="functionality:f1"]','cases','functionality:f1'],['[data-case="case:c1"]','note','case:c1'],['[data-node="note:free"]','note',undefined]] as const) {
      await resetEvents(); await drop(selector,{kind,projectId:'project-a'}); const rows=await events(); assert.equal(rows.length,1); assert.deepEqual(rows[0].slice(0,3),['drop',kind,anchor]);
    }
    for (const [selector, payload] of [
      ['.canvas-world',{kind:'cases',projectId:'project-a'}],['[data-node="module:m1"]',{kind:'module',projectId:'project-a'}],
      ['[data-case="case:c1"]',{kind:'cases',projectId:'project-a'}],['.canvas-world',{kind:'note',projectId:'other'}],
      ['.canvas-world',{kind:['module'],projectId:'project-a'}],['.canvas-world',{kind:{kind:'module'},projectId:'project-a'}],
      ['.canvas-world',{kind:'functionality',projectId:'project-a'}],['.canvas-world',{kind:'unknown',projectId:'project-a'}],['.canvas-world','{broken'],
    ] as const) { await resetEvents(); await drop(selector,payload); assert.deepEqual(await events(),[]); }
    await resetEvents(); await drop('.canvas-world',{kind:'note',projectId:'project-a'},'text/plain'); assert.deepEqual(await events(),[]);
    await page.evaluate('window.renderBoard({zoom:0.5})'); await page.waitForFunction('document.querySelector(".canvas-world").style.transform==="scale(0.5)"');
    const header=node('module:m1').locator('.canvas-head-copy'); const box=(await header.boundingBox())!;
    await resetEvents(); await page.mouse.move(box.x+10,box.y+10); await page.mouse.down(); await page.mouse.move(box.x+50,box.y+40,{steps:4});
    assert.deepEqual(await events(),[]); assert.equal(await node('module:m1').evaluate(el=>(el as HTMLElement).style.left),'120px');
    await page.mouse.up(); assert.deepEqual(await events(),[['move','module:m1',120,110]]);
    // Cancellation and a project switch must discard transient movement.
    await resetEvents();
    const cancelBox = (await header.boundingBox())!;
    await page.mouse.move(cancelBox.x+10,cancelBox.y+10); await page.mouse.down(); await page.mouse.move(cancelBox.x+35,cancelBox.y+30);
    await page.locator('.canvas-world').dispatchEvent('keydown',{key:'Escape'}); await page.mouse.up(); assert.deepEqual(await events(),[]);
    assert.equal(await node('module:m1').evaluate(el=>(el as HTMLElement).style.left),'40px');
    await page.mouse.move(cancelBox.x+10,cancelBox.y+10); await page.mouse.down(); await page.mouse.move(cancelBox.x+35,cancelBox.y+30);
    await page.evaluate('window.renderBoard({projectId:"project-b"})'); await page.waitForTimeout(50); await page.mouse.up();
    assert.deepEqual(await events(),[]);
    await drop('.canvas-world',{kind:'note',projectId:'project-a'}); assert.deepEqual(await events(),[]);
    await page.evaluate('window.renderBoard({projectId:"project-a"})'); await page.waitForTimeout(50);
    assert.equal(await page.evaluate('window.getState()===window.original'),true);
    await resetEvents(); await drop('.canvas-world',{kind:'note',projectId:'project-a'}); assert.deepEqual((await events())[0]?.slice(3,5),[240,360]);
    await page.evaluate('window.renderBoard({canEdit:false})'); await page.waitForFunction('!document.querySelector(".canvas-card-menu")');
    await resetEvents(); await drop('.canvas-world',{kind:'module',projectId:'project-a'}); assert.deepEqual(await events(),[]);
    await page.evaluate('window.renderBoard({canEdit:true,busy:true})'); await page.waitForFunction('document.querySelector(".canvas-viewport").getAttribute("aria-busy")==="true"');
    await resetEvents(); await drop('.canvas-world',{kind:'note',projectId:'project-a'}); assert.deepEqual(await events(),[]);
    await page.evaluate('window.renderBoard({busy:false,zoom:1})'); await page.waitForFunction('document.querySelector(".canvas-world").style.transform==="scale(1)"');
    await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(100);
    assert.equal(await page.evaluate('document.documentElement.scrollWidth<=390'),true);
    assert.equal(await page.locator('.canvas-viewport').evaluate(el=>el.scrollWidth>el.clientWidth),true);
    assert.equal(await node('functionality:f1').locator('.canvas-case-list').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    assert.ok(await page.getByRole('button',{name:'Color de Accounts',exact:true}).evaluate(el=>el.getBoundingClientRect().height>=44));
    // Real ResizeObserver heights feed arrangeCanvas; expanded content cannot overlap the next card.
    const firstCard = await node('functionality:f1').boundingBox(); const nextCard = await node('functionality:f2').boundingBox();
    assert.ok(firstCard && nextCard && nextCard.y >= firstCard.y + firstCard.height + 28);
    await page.screenshot({path:path.join(scratch,'canvas-board-mobile.png')});
    await page.setViewportSize({width:1280,height:900}); await page.waitForTimeout(100); await page.screenshot({path:path.join(scratch,'canvas-board-desktop.png')});
    assert.deepEqual(errors,[]); assert.deepEqual(requests,[]);
  } finally { await browser.close(); }
});

test('module navigation is zoom-aware, anchored, readonly, responsive and project-local', async () => {
  const scratch = process.env.QA_SECURITY_SCRATCH;
  assert.ok(scratch);
  const css = await readFile('src/modules/canvas/components/canvas.css', 'utf8');
  const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser' });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().isNavigationRequest() && route.request().url() === 'http://canvas.offline/') return route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><main id="root" style="position:relative;min-width:0"></main></body></html>' });
    requests.push(route.request().url()); return route.abort();
  });
  const toggle = page.getByRole('button', { name: 'Módulos del Canvas', exact: true });
  const nav = page.getByRole('navigation', { name: 'Navegación por módulos' });
  const search = page.getByRole('searchbox', { name: 'Buscar módulo' });
  const target = page.locator('[data-node="module:m2"]');
  try {
    await page.goto('http://canvas.offline/'); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(`window.navigationState={version:1,newElementColor:'default',notes:[],nodes:{'module:m2':{x:2000,y:1400,color:'pink'}}};window.navigationOriginal=JSON.stringify(window.navigationState);window.renderBoard({catalog:{modules:[{documentId:'m1',name:'Accounts'},{documentId:'m2',name:'Distant <module>'}],functionalities:[],cases:[],sprints:[]},state:window.navigationState})`);
    await target.waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded', {timeout:1500}), 'false');
    assert.equal(await search.count(), 0);
    for (const zoom of [0.5, 1.5]) {
      await page.evaluate(zoom => (window as any).renderBoard({ zoom, canEdit: false, busy: true }), zoom);
      await page.waitForFunction(zoom => document.querySelector<HTMLElement>('.canvas-world')?.style.transform === `scale(${zoom})`, zoom);
      await toggle.click(); await search.fill('distant');
      assert.equal(await nav.getByRole('button', { name: 'Ir al módulo Accounts', exact: true }).count(), 0);
      const before = await nav.boundingBox(), outer = await page.evaluate(() => window.scrollY);
      await nav.getByRole('button', { name: 'Ir al módulo Distant <module>', exact: true }).click();
      assert.equal(await target.getAttribute('data-navigation-active'), 'true');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.ok(await target.evaluate(el => {
        const card = el.getBoundingClientRect(), view = document.querySelector('.canvas-viewport')!.getBoundingClientRect();
        return card.left >= view.left && card.right <= view.right && card.top >= view.top && card.bottom <= view.bottom;
      }), `visible at zoom ${zoom}`);
      assert.deepEqual(await nav.boundingBox(), before);
      assert.equal(await page.evaluate(() => window.scrollY), outer);
      assert.equal(await target.evaluate(el => (el as HTMLElement).style.left), '2000px');
      await search.fill(''); assert.equal(await nav.getByRole('button', { name: /^Ir al módulo / }).count(), 2);
      await search.press('Escape'); assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate('window.renderBoard({zoom:1,canEdit:true,busy:false})');
    await toggle.click();
    const mobile = (await nav.boundingBox())!;
    assert.ok(mobile.x >= 0 && mobile.x + mobile.width <= 390);
    await nav.getByRole('button', { name: 'Ir al módulo Distant <module>', exact: true }).click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await target.getAttribute('data-navigation-active'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true);
    await toggle.click(); await search.fill('distant');
    await page.evaluate(`window.renderBoard({catalog:{modules:[{documentId:'m1',name:'Accounts'}],functionalities:[],cases:[],sprints:[]}})`);
    await target.waitFor({state:'detached'});
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click(); assert.equal(await search.inputValue(), '');
    assert.equal(await page.locator('[data-navigation-active="true"]').count(), 0);
    await search.fill('accounts');
    await page.evaluate(`window.renderBoard({projectId:'project-other',catalog:{modules:[{documentId:'other',name:'Other project'}],functionalities:[],cases:[],sprints:[]}})`);
    await page.getByRole('article', {name:'Módulo Other project',exact:true}).waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click(); assert.equal(await search.inputValue(), '');
    assert.equal(await nav.getByRole('button', {name:'Ir al módulo Accounts',exact:true}).count(), 0);
    assert.equal(await nav.getByRole('button', {name:'Ir al módulo Other project',exact:true}).count(), 1);
    await search.fill('missing');
    assert.equal(await nav.getByRole('status').textContent(), 'No hay módulos que coincidan.');
    await search.fill('');
    // Exact IDs must not be interpolated into CSS selectors, even without parent callbacks.
    await page.evaluate(() => {
      const callbacks = Object.fromEntries(['onToggle','onNotes','onEditCase','onEditModule','onEditFunctionality','onCreateFunctionality','onAddCases','onEditNote','onDeleteNote','onColor','onMove','onDropTool'].map(key => [key, undefined]));
      (window as any).renderBoard({ ...callbacks, canEdit: false, busy: true, projectId: 'no-callbacks', catalog: { modules: [{ documentId: 'id"[odd]', name: '<Safe & exact>' }], functionalities: [], cases: [], sprints: [] } });
    });
    await page.getByRole('article', {name:'Módulo <Safe & exact>',exact:true}).waitFor();
    await toggle.focus(); await toggle.press('Enter');
    const exact = nav.getByRole('button', {name:'Ir al módulo <Safe & exact>',exact:true});
    await exact.focus(); await exact.press('Enter');
    assert.equal(await page.getByRole('article', {name:'Módulo <Safe & exact>',exact:true}).getAttribute('data-navigation-active'), 'true');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.click();
    assert.deepEqual(await page.evaluate('window.events'), []);
    assert.equal(await page.evaluate('JSON.stringify(window.navigationState)===window.navigationOriginal'), true);
    assert.equal(await page.evaluate('window.getState()===window.original'), true);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    await page.screenshot({path:path.join(scratch,'canvas-module-navigation-mobile.png')});
  } finally { await browser.close(); }
});
