/* What holds a SEM tab's ~42–60 MB in Chromium's browser process (ASSESSMENT.md "Option b2
   built": it grows so with each SEM tab up to about 1 GB, in b2, today and b1 alike, and
   neither sleep, a reload nor a memory-pressure signal gives it back). A minimal page, no
   app: it writes files' bytes into IndexedDB as the app does since v517 (a Uint8Array a
   file, keyed by its hash, one transaction a file), 8 files a "tab", and after each tab
   the memory is read as lim-lib.mjs reads it (two forced GCs, a critical memory-pressure
   signal, 1 s; Private = Private_Clean + Private_Dirty of smaps_rollup, by process type).
   Configurations, each in a browser of its own:
   - otr: an off-the-record context (Playwright's browser.newContext, as every measurement
     and test so far); disk: a profile on disk (launchPersistentContext), as a real browser
     has;
   - tiff: the measurements' own SEM files (lim-fx.mjs: 8 of 8.5 MB a tab, each its own);
     random: as many bytes of noise (nothing to compress).
   Per tab: the browser process's Private, the renderer's, the origin's usage and quota
   (navigator.storage.estimate), a write's error if any. At the end: the bytes read back
   and dropped; the page reloaded; the database deleted; each followed by a reading.
   And apart, files made in the page (new File of fetched bytes, as lim-lib drop does) held
   and then let go, with no IndexedDB at all.
   node idb-mem.mjs <base of a blank page with fx/ beside it> <out.json> [tabs = 20] */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { procTree } from './lim-lib.mjs';

const [base, out, K0 = '20'] = process.argv.slice(2);
const K = +K0, NS = [0, 1, 2, 4, 8, 12, 16, 20, 24].filter(n=> n <= K);
const sleep = ms => new Promise(r=> setTimeout(r, ms));
const r1 = x => Math.round(x*10)/10;
const res = { started: new Date().toISOString(), base, runs: [] };
const du = p =>{ try { const s = fs.statSync(p); return s.isDirectory() ? fs.readdirSync(p).reduce((a, f)=> a + du(path.join(p, f)), 0) : s.size; } catch(e){ return 0; } };

async function mem(page, cdp){
  for (let i = 0; i < 2; i++){ await cdp.send('HeapProfiler.collectGarbage'); await sleep(250); }
  await cdp.send('Memory.simulatePressureNotification', { level: 'critical' }); await sleep(1000);
  const ps = procTree(), sum = t => r1(ps.filter(p=> p.type === t).reduce((a, p)=> a + p.priv, 0));
  const h = await cdp.send('Runtime.getHeapUsage');
  const est = await page.evaluate(async ()=>{ try { const e = await navigator.storage.estimate(); return { usage: e.usage, quota: e.quota }; } catch(e){ return null; } });
  return { browser: sum('browser'), renderer: sum('renderer'), gpu: sum('gpu-process'), utility: sum('utility'), all: r1(ps.reduce((a, p)=> a + p.priv, 0)),
    ab: r1((h.backingStorageSize || 0)/1048576), usageMB: est && r1(est.usage/1048576), quotaMB: est && r1(est.quota/1048576) };
}

// One tab's files into the store: { ms, error }.
const writeTab = (page, k, data)=> page.evaluate(async ([k, data])=>{
  const db = window.__db || (window.__db = await new Promise((res, rej)=>{
    const q = indexedDB.open('probe', 1);
    q.onupgradeneeded = ()=> q.result.createObjectStore('bytes');
    q.onsuccess = ()=> res(q.result); q.onerror = ()=> rej(q.error);
  }));
  const t0 = performance.now();
  try {
    for (let i = 1; i <= 8; i++){
      let b;
      if (data === 'tiff') b = new Uint8Array(await (await fetch(`fx/sem/t${k}/img${i}.tif`)).arrayBuffer());
      else { b = new Uint8Array(8913224); for (let o = 0; o < b.length; o += 65536) crypto.getRandomValues(b.subarray(o, o + 65536)); }
      await new Promise((res, rej)=>{ const t = db.transaction('bytes', 'readwrite'); t.objectStore('bytes').put(b, `t${k}-${i}`); t.oncomplete = res; t.onerror = t.onabort = ()=> rej(t.error); });
    }
    return { ms: Math.round(performance.now() - t0), error: null };
  } catch(e){ return { ms: Math.round(performance.now() - t0), error: String(e && (e.name + ': ' + e.message)) }; }
}, [k, data]);

async function run(ctxKind, data){
  let browser = null, ctx, dir = null;
  const args = ['--enable-precise-memory-info'];
  if (ctxKind === 'disk'){
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idbmem-'));
    ctx = await chromium.launchPersistentContext(dir, { args, viewport: { width: 1000, height: 700 } });
  } else {
    browser = await chromium.launch({ args });
    ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  }
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(base + '/index.html');
  const cdp = await ctx.newCDPSession(page);
  const r = { ctx: ctxKind, data, rows: [] };
  const log = (...a)=> console.log(`[${ctxKind} ${data}]`, ...a);
  for (let k = 0; k <= K; k++){
    let w = null;
    if (k > 0) w = await writeTab(page, k - 1, data);
    if (NS.includes(k) || (w && w.error)){
      const m = await mem(page, cdp);
      r.rows.push({ tabs: k, write: w, ...m, ...(dir ? { idbDirMB: r1(du(path.join(dir, 'Default', 'IndexedDB'))/1048576) } : {}) });
      log(k, JSON.stringify(w), JSON.stringify(m));
    }
  }
  // Read back whole, dropped: values read and then let go.
  await page.evaluate(()=> new Promise(res=>{ const q = window.__db.transaction('bytes').objectStore('bytes').getAll(); q.onsuccess = ()=> res(q.result.length); }));
  r.readBack = await mem(page, cdp); log('read back', JSON.stringify(r.readBack));
  await page.reload(); await sleep(500);
  r.reload = await mem(page, cdp); log('reload', JSON.stringify(r.reload));
  await page.evaluate(()=> new Promise(res=>{ const q = indexedDB.deleteDatabase('probe'); q.onsuccess = q.onerror = q.onblocked = ()=> res(); }));
  await sleep(2000);
  r.deleted = await mem(page, cdp); log('deleted', JSON.stringify(r.deleted));
  // (on disk: what the profile's IndexedDB holds, before and after the delete)
  if (dir) r.idbDirMB = r1(du(path.join(dir, 'Default', 'IndexedDB'))/1048576);
  await ctx.close(); if (browser) await browser.close();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

// Files made in the page (no IndexedDB): 8 a tab held, then let go.
async function files(){
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] }), ctx = await browser.newContext(), page = await ctx.newPage();
  await page.goto(base + '/index.html');
  const cdp = await ctx.newCDPSession(page);
  const r = { ctx: 'otr', data: 'files held', rows: [] };
  r.rows.push({ tabs: 0, ...await mem(page, cdp) });
  for (let k = 0; k < 4; k++){
    await page.evaluate(async k=>{ (window.__f || (window.__f = [])).push(...await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(async i=> new File([await (await fetch(`fx/sem/t${k}/img${i}.tif`)).blob()], 'img' + i + '.tif')))); }, k);
    r.rows.push({ tabs: k + 1, ...await mem(page, cdp) });
    console.log('[files]', k + 1, JSON.stringify(r.rows.at(-1)));
  }
  await page.evaluate(()=>{ window.__f = null; });
  r.dropped = await mem(page, cdp); console.log('[files] let go', JSON.stringify(r.dropped));
  await browser.close();
  return r;
}

for (const [c, d] of [['otr', 'tiff'], ['otr', 'random'], ['disk', 'tiff'], ['disk', 'random']]) res.runs.push(await run(c, d));
res.runs.push(await files());
res.ended = new Date().toISOString();
fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
console.log('saved', out);
