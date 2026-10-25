/* What the scripts share: the fixtures, a Chromium on the app (HEAD, or a tree with
   bg-runs.patch applied), the steps that build a project, Refine all and its end, the
   app's own state read from inside the page, memory after a forced GC, timing in the page.

   Servers, started by hand (README): HEAD_BASE (default http://127.0.0.1:8980) serves a
   copy of HEAD, BG_BASE (http://127.0.0.1:8981) a copy with bg-runs.patch applied
   (POOL_BASE, http://127.0.0.1:8982: with bg-runs-pool.patch on top).

   Time: performance.timeOrigin + performance.now() in the page (window.__now); a switch is
   from the click on the tab, dispatched in the page, to two animation frames once the
   tab's loader is gone. Long tasks: a PerformanceObserver (an init script). Main-thread
   work: CDP Performance.getMetrics' TaskDuration, the renderer main thread's busy time.
   IndexedDB: every put on the page timed (the structured clone it makes there and then).
   Memory: CDP HeapProfiler.collectGarbage (twice) then Runtime.getHeapUsage on the page
   and on each worker (Target.setAutoAttach), the renderer process's VmRSS and VmHWM from
   /proc (the largest renderer: the page's). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const FX = path.resolve(HERE, '../fixtures');
export const RESULTS = path.resolve(HERE, '../results');
fs.mkdirSync(RESULTS, { recursive: true });
export const BASES = { head: process.env.HEAD_BASE || 'http://127.0.0.1:8980', bg: process.env.BG_BASE || 'http://127.0.0.1:8981',
  pool: process.env.POOL_BASE || 'http://127.0.0.1:8982' };

/* ---- Fixtures: the 12 XRDML scans (5384 points, 10–80°, SrTiO3-like, the cell 0.035 %
   smaller per step: tests/fixtures.mjs xrdml), the SrTiO3 CIF, a DRS spectrum, a GC run,
   an EPR pair; SEM: 8 Tescan TIFFs of 2048 × 2176, 16-bit (tests/fixtures.mjs makeTiff),
   written once into the system's temporary directory. ---- */
export const XRD12 = Array.from({ length: 12 }, (_, i)=> path.join(FX, 'xrd', 's' + String(i).padStart(2, '0') + '.xrdml'));
export const CIF = path.join(FX, 'SrTiO3.cif');
export const DRS = [path.join(FX, 'drs1.csv')];
export const GC = [path.join(FX, 'alpha.csv')];
export const EPR = [path.join(FX, 'e1.DSC'), path.join(FX, 'e1.DTA')];
let _sem = null;
export async function SEM8(){
  if (_sem) return _sem;
  const { makeTiff } = await import(path.join(ROOT, 'tests/fixtures.mjs'));
  const dir = process.env.SEM_DIR || path.join(os.tmpdir(), 'dt-bg-runs-sem8');
  fs.mkdirSync(dir, { recursive: true });
  _sem = Array.from({ length: 8 }, (_, i)=>{
    const p = path.join(dir, `img${i + 1}.tif`);
    if (!fs.existsSync(p)) fs.writeFileSync(p, makeTiff({ W: 2048, H: 2048 + 128, bits: 16, strip: 128, sign: 'S' + (i + 1), pixelNm: i < 4 ? 25 : 50, mag: i < 4 ? 5000 : 2500, seed: i + 1 }));
    return p;
  });
  return _sem;
}

/* ---- Numbers ---- */
export const med = a =>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
export const pct = (a, p)=>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p*s.length))] : NaN; };
export const r1 = x => Number.isFinite(x) ? Math.round(x*10)/10 : x;
export const load = ()=> os.loadavg().map(x=> +x.toFixed(2));
export function save(name, obj){ if (process.env.TAG) name = name.replace(/\.json$/, '-' + process.env.TAG + '.json'); const f = path.join(RESULTS, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); return f; }
export const sleep = ms => new Promise(r=> setTimeout(r, ms));

/* ---- The browser ---- */
const INIT = ()=>{
  window.__lt = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([performance.timeOrigin + e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  window.__now = ()=> performance.timeOrigin + performance.now();
  // Every IndexedDB put timed where it is made (its structured clone): [absolute start, ms, store].
  window.__puts = [];
  try {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...a){ const t0 = performance.now(); try { return put.apply(this, a); } finally { window.__puts.push([performance.timeOrigin + t0, performance.now() - t0, this.name]); } };
  } catch(e){}
};
// storage: localStorage set before the app starts (the pool's knobs: { 'datatreat-rv-workers': k }).
export async function launch(mode, { viewport = { width: 1400, height: 900 }, storage = null } = {}){
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' });
  await ctx.addInitScript(INIT);
  if (storage) await ctx.addInitScript(kv=>{ try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, String(v)); } catch(e){} }, storage);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  page.on('console', m=>{ if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('crash', ()=> errors.push('CRASH: the renderer died'));
  page.on('dialog', d=> d.dismiss());
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const subs = new Map(), pending = new Map(); let mid = 1000;
  cdp.on('Target.attachedToTarget', e=>{ if (e.targetInfo.type === 'worker') subs.set(e.sessionId, e.targetInfo); });
  cdp.on('Target.detachedFromTarget', e=> subs.delete(e.sessionId));
  cdp.on('Target.receivedMessageFromTarget', e=>{ const m = JSON.parse(e.message); const p = pending.get(m.id); if (p){ pending.delete(m.id); p(m); } });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  const send = (sessionId, method, params = {})=> new Promise(res=>{ const id = ++mid; const t = setTimeout(()=>{ pending.delete(id); res({ error: 'timeout' }); }, 8000);
    pending.set(id, m=>{ clearTimeout(t); res(m); }); cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(()=> res({ error: 'gone' })); });
  const bcdp = await browser.newBrowserCDPSession();
  const kb = (txt, k)=> +((txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;
  const procMem = pid =>{ try { const st = fs.readFileSync(`/proc/${pid}/status`, 'utf8'); return { rss: kb(st, 'VmRSS'), hwm: kb(st, 'VmHWM') }; } catch(e){ return null; } };
  async function renderer(){
    const ps = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p=> p.type === 'renderer').map(p=> ({ pid: p.id, ...procMem(p.id) })).filter(p=> p.rss != null);
    return ps.sort((a, b)=> b.rss - a.rss)[0] || null;
  }
  async function mem(){
    await cdp.send('HeapProfiler.collectGarbage'); await sleep(150); await cdp.send('HeapProfiler.collectGarbage');
    const h = await cdp.send('Runtime.getHeapUsage');
    const workers = [];
    for (const sid of subs.keys()){
      await send(sid, 'HeapProfiler.enable'); await send(sid, 'HeapProfiler.collectGarbage');
      const w = await send(sid, 'Runtime.getHeapUsage');
      if (w.result) workers.push(w.result.usedSize/1048576);
    }
    const r = await renderer();
    return { heap: h.usedSize/1048576, workers: workers.length, workerHeap: workers.reduce((a, b)=> a + b, 0), rss: r && r.rss, hwm: r && r.hwm };
  }
  // The renderer main thread's busy time so far (s): CDP's TaskDuration.
  const taskTime = async ()=> (await cdp.send('Performance.getMetrics')).metrics.find(m=> m.name === 'TaskDuration').value;
  const app = new App(page, BASES[mode]);
  return { browser, ctx, page, cdp, app, mem, renderer, taskTime, errors, nWorkers: ()=> subs.size, close: ()=> browser.close() };
}

/* ---- Driving the app ----
   A tab is known by its place in the bar. Every step on a module acts on the tab on show. */
const BOOTED = ()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add');
export class App {
  constructor(page, base){ this.page = page; this.base = base; }
  async goto(){ await this.page.goto(this.base + '/index.html'); await this.page.waitForFunction(BOOTED, null, { timeout: 60000 }); await this.mods(); await this.settle(); }
  // The app's modules on window, for predicates that cannot wait (waitForFunction's).
  mods(){ return this.page.evaluate(async ()=>{ window.__u = await import('./utils.js'); window.__T = await import('./tabs.js'); window.__db = await import('./db.js'); }); }
  // Until card 2 of the live XRPD module has n results.
  liveResults(n, timeout = 120000){ return this.page.waitForFunction(n=>{ const s = window.__u.getModuleState('xrd'), c = s && s.cards.find(c=> c.id === 2);
    return c && Object.keys((c.states.rietveld || {}).results || {}).length >= n; }, n, { polling: 20, timeout }); }
  // Until tab i (parked) has n results in its state, or (n null) has no job going on.
  parkedResults(i, n, timeout = 120000){ return this.page.waitForFunction(([i, n])=>{ const t = window.__T.TABS[i]; if (!t) return false;
    if (n == null) return !(t.jobs && t.jobs.length);
    const c = t.state && t.state.cards.find(c=> c.id === 2); return c && Object.keys((c.states.rietveld || {}).results || {}).length >= n; }, [i, n], { polling: 20, timeout }); }
  count(){ return this.page.locator('#tabBar .ptab').count(); }
  idOf(i){ return this.page.locator('#tabBar .ptab').nth(i).getAttribute('data-id'); }
  async settle(){
    await this.page.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 120000 });
    await this.page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 20)))));
  }
  // A blank project of the module in a new tab, on show; its index.
  async newTab(mod){
    await this.page.click('#nav button[data-tab="home"]');
    const n = await this.count();
    await this.page.click(`.home-card[data-go="${mod}"]`);
    await this.page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
    await this.page.waitForSelector(`#tab-${mod}.active`);
    await this.settle();
    return n;
  }
  async show(i){ await this.page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); await this.settle(); }
  async files(mod, files, rows){
    const sel = `#${mod}FileTableWrap tr.file-row`, n0 = await this.page.locator(sel).count();
    rows = rows ?? (mod === 'epr' ? files.length/2 : files.length);
    await this.page.setInputFiles(`#${mod}Files`, files);
    await this.page.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + rows], { timeout: 180000 });
    if (mod === 'sem') await this.page.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 180000 });
    await this.settle();
  }
  async cif(){ await this.page.setInputFiles('#xrdR2CifInput', CIF); await this.page.waitForSelector('#xrdR2PhaseList input[data-on]'); await this.settle(); }
  // An XRPD tab of the 12 patterns and the CIF on card 2, on show; its index.
  async xrdTab(){ const i = await this.newTab('xrd'); await this.files('xrd', XRD12); await this.cif(); return i; }
  // Refine all on card 2, 'Refine without the standard'; resolves once it runs.
  async refineAll(){
    await this.page.waitForTimeout(650);   // (a press within 600 ms of the last is not taken)
    await this.page.click('#xrdR2RefineAll');
    await this.page.waitForSelector('.confirm-modal');
    await this.page.click('.confirm-modal .btn:not(.primary)');
    await this.page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000 });
  }
  // Clear all then Refine all on card 2 of the tab on show, without the standard: the
  // absolute time of the click on 'Refine without the standard'; resolves once it runs.
  async clearAndRefine(){
    if (await this.page.isEnabled('#xrdR2ClearAll')){ await this.page.waitForTimeout(650); await this.page.click('#xrdR2ClearAll'); await this.settle(); }
    await this.page.waitForTimeout(650);
    await this.page.click('#xrdR2RefineAll');
    await this.page.waitForSelector('.confirm-modal');
    const t0 = await this.page.evaluate(()=>{ const t = window.__now(); document.querySelector('.confirm-modal .btn:not(.primary)').click(); return t; });
    await this.page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000 });
    return t0;
  }
  // Tab i's job ended, parked: the absolute time it was seen so (polled every 20 ms).
  parkedEnd(i, timeout = 600000){ return this.page.waitForFunction(i=>{ const t = window.__T.TABS[i]; return !!t && !(t.jobs && t.jobs.length) && window.__now(); }, i, { timeout, polling: 20 }).then(h=> h.jsonValue()); }
  // Card 2's results in tab i, as a hash of what the worker gave (its times left out) and
  // their number: the same refinement gives the same hash, bit for bit.
  resHash(i){ return this.page.evaluate(i=>{
    const T = window.__T, u = window.__u, t = T.TABS[i], st = T.isLive(t) ? u.getModuleState(t.module) : window.__db.decode(t.state);
    const c = st.cards.find(c=> c.id === 2), r = (c && c.states.rietveld && c.states.rietveld.results) || {};
    const txt = JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v);
    let h1 = 0x811c9dc5, h2 = 0x9747b28c;
    for (let j = 0; j < txt.length; j++){ const ch = txt.charCodeAt(j); h1 = Math.imul(h1 ^ ch, 0x01000193); h2 = Math.imul(h2 ^ ch, 0x5bd1e995); h2 ^= h2 >>> 15; }
    return { n: Object.keys(r).length, hash: (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36), len: txt.length };
  }, i); }
  // The card on show idle again: the absolute time it was seen so (polled every 20 ms).
  runEnd(timeout = 600000){ return this.page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine' && window.__now(), null, { timeout, polling: 20 }).then(h=> h.jsonValue()); }
  // A tab's state as the app holds it: the live module's for the tab live, else its parked
  // state; and whether it is live, running parked, dirty.
  tab(i){ return this.page.evaluate(async i=>{
    const T = await import('./tabs.js'), u = await import('./utils.js'), db = await import('./db.js');
    const t = T.TABS[i]; if (!t) return null;
    const live = T.isLive(t), st = live ? u.getModuleState(t.module) : t.state ? db.decode(t.state) : null;
    // (the files' arrays and bytes left out, theirs alone)
    const lean = f => { if (!f || typeof f !== 'object') return f; const { rawBytes, x, y, varMul, ...g } = f; return g; };
    const out = st && { ...st, files: (st.files || []).map(lean), std: lean(st.std) };
    return { id: t.id, live, running: !!(t.jobs && t.jobs.length), dirty: !!t.dirty, title: t.title, projectId: t.projectId, state: out && JSON.parse(JSON.stringify(out)) };
  }, i); }
  // Card 2's results (file name → result) in a state.
  static res(st, id = 2){ const c = st && (st.cards || []).find(c=> c.id === id); return (c && c.states && c.states.rietveld && c.states.rietveld.results) || {}; }
}

/* ---- Timing ---- */
export async function longTasks(page, t0, t1 = Infinity){
  const all = await page.evaluate(()=> window.__lt || []).catch(()=> []);
  const out = all.filter(([t])=> t >= t0 - 1 && t <= t1).map(([, d])=> d);
  return { n: out.length, ms: Math.round(out.reduce((a, b)=> a + b, 0)), max: out.length ? Math.round(Math.max(...out)) : 0 };
}
export const puts = (page, t0, t1 = Infinity)=> page.evaluate(([t0, t1])=> window.__puts.filter(([t])=> t >= t0 && t <= t1), [t0, t1]);
export const now = page => page.evaluate(()=> window.__now());
/* A tab switch, from the click (dispatched in the page, at t0) to two frames once the
   module's loader is gone (the restore done). */
export async function timedSwitch(app, i){
  const id = await app.idOf(i);
  const t = await app.page.evaluate(id=> new Promise(r=>{
    const el = document.querySelector(`#tabBar .ptab[data-id="${id}"] .ptab-label`);
    const t0 = window.__now();
    el.click();
    const loop = ()=>{ if (document.querySelector('.module-loader.show')) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> r({ t0, t1: window.__now() }))); };
    requestAnimationFrame(loop);
  }), id);
  return { ms: t.t1 - t.t0, ...t };
}
/* An interaction in the XRPD tab on show: the next sample (→: both cards drawn), or the
   smoothing width of card 1 set to the other of 0.25 and 0.30° (the 12 patterns smoothed
   again, both cards drawn, a commit); from the event to two frames. */
export function interact(page, what = 'next'){
  return page.evaluate(what=> new Promise(r=>{
    const t0 = window.__now();
    if (what === 'smooth'){
      const inp = document.querySelector('#xrdA1Smooth');
      inp.value = inp.value === '0.25' ? '0.3' : '0.25';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    } else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    requestAnimationFrame(()=> requestAnimationFrame(()=> r({ t0, ms: window.__now() - t0 })));
  }), what);
}
/* Results compared: everything the worker gave, the time it took (ms, at) left out. */
export function strip(res){
  return JSON.parse(JSON.stringify(res, (k, v)=> k === 'at' || k === 'ms' ? undefined : v));
}
