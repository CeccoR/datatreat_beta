/* What the scripts share: the fixtures, a Chromium on one of the trees, the steps that build
   an XRPD tab and run Refine all in it (on show, parked, or in a live tab's frame), the
   results hashed, the renderer's CPU time, memory after a forced GC, timing in the page.

   The trees, each a copy of HEAD (v517) served by hand (README), the scripts' defaults:
     head      HEAD as it is                                http://127.0.0.1:8970
     pool      HEAD + pool.patch                            http://127.0.0.1:8971
     live      HEAD + live-tabs.patch (option b1)           http://127.0.0.1:8972
     livepool  HEAD + live-tabs.patch + pool.patch          http://127.0.0.1:8973
     bg        HEAD + bg-runs.patch (option A)              http://127.0.0.1:8974
     bgpool    HEAD + bg-runs.patch + pool-on-bg-runs.patch http://127.0.0.1:8975
   (<NAME>_BASE in the environment changes one: POOL_BASE=…). The live trees run with
   localStorage 'datatreat-live-tabs' = 'on' (every tab a frame of its own).

   Time: performance.timeOrigin + performance.now() in the page or the frame (window.__now:
   comparable between them). A run: from the click on 'Refine without the standard' to the
   run seen ended (the card's button back to Refine; a parked run, its tab without jobs;
   polled every 20 ms). Long tasks: a PerformanceObserver in every realm. CPU: the
   renderer's utime + stime (/proc/<pid>/stat, every thread, those ended too), its main
   thread's (/proc/<pid>/task/<pid>/stat) and its DedicatedWorker threads' (alive ones).
   Memory: CDP HeapProfiler.collectGarbage (twice) then Runtime.getHeapUsage on the page and
   on each worker (Target.setAutoAttach), the renderer process's VmRSS and VmHWM (/proc;
   the largest renderer: the page's, its same-origin frames and its workers with it). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FX = path.resolve(HERE, '../fixtures');
export const RESULTS = path.resolve(HERE, '../results');
fs.mkdirSync(RESULTS, { recursive: true });
const PORTS = { head: 8970, pool: 8971, live: 8972, livepool: 8973, bg: 8974, bgpool: 8975 };
export const BASES = Object.fromEntries(Object.entries(PORTS).map(([k, p])=> [k, process.env[k.toUpperCase() + '_BASE'] || 'http://127.0.0.1:' + p]));
export const isLive = mode => mode === 'live' || mode === 'livepool';
export const isBg = mode => mode === 'bg' || mode === 'bgpool';

/* ---- Fixtures: the 12 XRDML scans s00–s11 (5384 points, 10–80°, SrTiO3-like, the cell
   0.035 % smaller a step: tests/fixtures.mjs xrdml), the SrTiO3 CIF, a DRS spectrum. ---- */
export const XRD12 = Array.from({ length: 12 }, (_, i)=> path.join(FX, 'xrd', 's' + String(i).padStart(2, '0') + '.xrdml'));
export const CIF = path.join(FX, 'SrTiO3.cif');
export const DRS = [path.join(FX, 'drs1.csv')];

/* ---- Numbers ---- */
export const med = a =>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
export const pct = (a, p)=>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p*s.length))] : NaN; };
export const r1 = x => Number.isFinite(x) ? Math.round(x*10)/10 : x;
export const r2 = x => Number.isFinite(x) ? Math.round(x*100)/100 : x;
export const load = ()=> os.loadavg().map(x=> +x.toFixed(2));
export function save(name, obj){ if (process.env.TAG) name = name.replace(/\.json$/, '-' + process.env.TAG + '.json'); const f = path.join(RESULTS, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); return f; }
export const sleep = ms => new Promise(r=> setTimeout(r, ms));
// This process's CPUs (a run under taskset sees its own: cores.mjs).
export const cpus = ()=>{ try { const m = fs.readFileSync('/proc/self/status', 'utf8').match(/Cpus_allowed_list:\s*(\S+)/); return m ? m[1] : ''; } catch(e){ return ''; } };

/* ---- The browser ---- */
const INIT = ()=>{
  window.__lt = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([performance.timeOrigin + e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  window.__now = ()=> performance.timeOrigin + performance.now();
};
const TICK = 100;   // clock ticks a second (/proc)
function stat(p){ try { const s = fs.readFileSync(p, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); return (+f[11] + +f[12])/TICK; } catch(e){ return null; } }
const comm = p =>{ try { return fs.readFileSync(p, 'utf8').trim(); } catch(e){ return ''; } };
/* storage: localStorage set before the app starts (the pool's knobs, e.g.
   { 'datatreat-rv-workers': 3 }); the live trees get 'datatreat-live-tabs' = 'on'. */
export async function launch(mode, { storage = {}, viewport = { width: 1400, height: 900 }, url = null } = {}){
  if (isLive(mode)) storage = { 'datatreat-live-tabs': 'on', ...storage };
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' });
  await ctx.addInitScript(INIT);
  if (Object.keys(storage).length) await ctx.addInitScript(kv=>{ try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, String(v)); } catch(e){} }, storage);
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
  let rpid = null;
  async function renderer(){
    const ps = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.filter(p=> p.type === 'renderer').map(p=> ({ pid: p.id, ...procMem(p.id) })).filter(p=> p.rss != null);
    const r = ps.sort((a, b)=> b.rss - a.rss)[0] || null;
    if (r) rpid = r.pid;
    return r;
  }
  /* The renderer's CPU so far (s): every thread's (those ended too), the main thread's, the
     DedicatedWorker threads alive and their number. */
  async function cpu(){
    if (!rpid) await renderer();
    const total = stat(`/proc/${rpid}/stat`), main = stat(`/proc/${rpid}/task/${rpid}/stat`);
    let workers = 0, nw = 0;
    try { for (const t of fs.readdirSync(`/proc/${rpid}/task`)) if (comm(`/proc/${rpid}/task/${t}/comm`).startsWith('DedicatedWorker')){ nw++; workers += stat(`/proc/${rpid}/task/${t}/stat`) || 0; } } catch(e){}
    return { total, main, workers, nw };
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
    return { heap: r2(h.usedSize/1048576), workers: workers.length, workerHeaps: workers.map(r2), workerHeap: r2(workers.reduce((a, b)=> a + b, 0)), rss: r && Math.round(r.rss), hwm: r && Math.round(r.hwm) };
  }
  // The renderer's RSS (MB) and its DedicatedWorker threads, sampled every `every` ms until
  // stopped: the largest of each (no GC: what the machine gives).
  function sampler(every = 100){
    let on = true, peak = 0, nw = 0;
    const loop = (async ()=>{ while (on){ const r = await renderer(); if (r && r.rss > peak) peak = r.rss; const c = await cpu(); if (c.nw > nw) nw = c.nw; await sleep(every); } })();
    return async ()=>{ on = false; await loop; const r = await renderer(); return { peak: Math.round(peak), hwm: r && Math.round(r.hwm), threads: nw }; };
  }
  // The renderer main thread's busy time so far (s): CDP's TaskDuration (the page's thread,
  // its same-origin frames' with it).
  const taskTime = async ()=> (await cdp.send('Performance.getMetrics')).metrics.find(m=> m.name === 'TaskDuration').value;
  const app = new App(page, mode, BASES[mode]);
  if (url) { await page.goto(url); }
  return { browser, ctx, page, cdp, app, mem, cpu, sampler, renderer, taskTime, errors, nWorkers: ()=> subs.size, close: ()=> browser.close() };
}

/* ---- Driving the app, the same steps in every tree ----
   A tab is known by its place in the bar. In head, pool, bg and bgpool its module is the
   page's own (live while on show; bg: a run goes on parked); in live and livepool it is the
   frame of that tab (index.html?embed=<id>), live while hidden. Clicks inside a realm are
   dispatched there (a hidden frame's elements cannot be clicked by Playwright). */
const BOOTED = ()=> !document.documentElement.classList.contains('app-booting') && !document.querySelector('.module-loader.show');
export class App {
  constructor(page, mode, base){ this.page = page; this.mode = mode; this.base = base; this.live = isLive(mode); this.bg = isBg(mode); }
  async goto(){ await this.page.goto(this.base + '/index.html'); await this.page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 }); await this.mods(this.page); }
  // The app's modules on window, for predicates that cannot wait (waitForFunction's).
  mods(s){ return s.evaluate(async ()=>{ window.__u = await import('./utils.js'); window.__T = await import('./tabs.js'); window.__db = await import('./db.js'); }); }
  count(){ return this.page.locator('#tabBar .ptab').count(); }
  idOf(i){ return this.page.locator('#tabBar .ptab').nth(i).getAttribute('data-id'); }
  // The frame of tab i (live trees), once its page is up and its tab restored.
  async frame(i, timeout = 120000){
    const id = await this.idOf(i);
    const h = await this.page.waitForSelector(`.live-frames iframe[src*="embed=${id}"]`, { state: 'attached', timeout });
    const f = await h.contentFrame();
    await f.waitForFunction(BOOTED, null, { timeout });
    if (!await f.evaluate(()=> !!window.__u)) await this.mods(f);
    return f;
  }
  async scope(i){ return this.live ? this.frame(i) : this.page; }
  async settle(s = this.page){
    await s.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 120000 });
    await s.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 20)))));
  }
  // A blank project of the module in a new tab, on show; its index.
  async newTab(mod){
    await this.page.click('#nav button[data-tab="home"]');
    const n = await this.count();
    await this.page.click(`.home-card[data-go="${mod}"]`);
    await this.page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
    const s = await this.scope(n);
    await s.waitForSelector(`#tab-${mod}.active`);
    await this.settle(s);
    return n;
  }
  async show(i){ await this.page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click(); const s = await this.scope(i); await this.settle(s); return s; }
  async files(i, mod, files){
    const s = await this.show(i), sel = `#${mod}FileTableWrap tr.file-row`, n0 = await s.locator(sel).count();
    await s.setInputFiles(`#${mod}Files`, files);
    await s.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + files.length], { timeout: 180000 });
    await this.settle(s);
    return s;
  }
  // An XRPD tab of the 12 patterns and the CIF on card 2, on show; its index.
  async xrdTab(){
    const i = await this.newTab('xrd'), s = await this.files(i, 'xrd', XRD12);
    await s.setInputFiles('#xrdR2CifInput', CIF);
    await s.waitForSelector('#xrdR2PhaseList input[data-on]');
    await this.settle(s);
    return i;
  }
  async drsTab(){ const i = await this.newTab('tauc'); await this.files(i, 'tauc', DRS); return i; }
  /* Clear all (when there is anything), then Refine all on card 2 of scope s (the page, or
     a frame, hidden or not), 'Refine without the standard': the absolute time of that
     click; resolves once it runs. (A press within 600 ms of the last is not taken.) */
  async clearAndRefine(s = this.page){
    if (await s.evaluate(()=> !document.querySelector('#xrdR2ClearAll').disabled)){
      await s.waitForTimeout(650); await s.evaluate(()=> document.querySelector('#xrdR2ClearAll').click()); await this.settle(s);
    }
    await s.waitForTimeout(650);
    await s.evaluate(()=> document.querySelector('#xrdR2RefineAll').click());
    await s.waitForFunction(()=> document.querySelector('.confirm-modal'));
    const t0 = await s.evaluate(()=>{ const t = window.__now(); document.querySelector('.confirm-modal .btn:not(.primary)').click(); return t; });
    await s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000 });
    return t0;
  }
  // The card in scope s idle again: the absolute time it was seen so (polled every 20 ms).
  runEnd(s = this.page, timeout = 900000){ return s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine' && window.__now(), null, { timeout, polling: 20 }).then(h=> h.jsonValue()); }
  // (bg trees) Tab i's job ended, parked: the absolute time it was seen so.
  parkedEnd(i, timeout = 900000){ return this.page.waitForFunction(i=>{ const t = window.__T.TABS[i]; return !!t && !(t.jobs && t.jobs.length) && window.__now(); }, i, { timeout, polling: 20 }).then(h=> h.jsonValue()); }
  /* Card 2's results in tab i: a hash of everything the worker gave (its times left out),
     their number and their keys in order (the patterns'). The same refinement gives the
     same hash, bit for bit. */
  async resHash(i){
    const s = await this.scope(i);
    return s.evaluate(([i, live])=>{
      const T = window.__T, u = window.__u, t = live ? null : T.TABS[i];
      const st = !t || T.isLive(t) || !t.state ? u.getModuleState('xrd') : window.__db.decode(t.state);
      const c = st.cards.find(c=> c.id === 2), r = (c && c.states.rietveld && c.states.rietveld.results) || {};
      const txt = JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v);
      let h1 = 0x811c9dc5, h2 = 0x9747b28c;
      for (let j = 0; j < txt.length; j++){ const ch = txt.charCodeAt(j); h1 = Math.imul(h1 ^ ch, 0x01000193); h2 = Math.imul(h2 ^ ch, 0x5bd1e995); h2 ^= h2 >>> 15; }
      return { n: Object.keys(r).length, keys: Object.keys(r), hash: (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36), len: txt.length };
    }, [i, this.live]);
  }
}

/* ---- Timing ---- */
// Long tasks of every realm (the page and its frames) that started between t0 and t1.
export async function longTasks(page, t0, t1 = Infinity){
  const all = [];
  for (const f of page.frames()){ try { all.push(...await f.evaluate(()=> window.__lt || [])); } catch(e){} }
  const seen = new Set(), out = [];
  for (const [t, d] of all.sort((a, b)=> a[0] - b[0])){ const k = Math.round(t*10); if (seen.has(k) || t < t0 - 1 || t > t1) continue; seen.add(k); out.push(d); }
  return { n: out.length, ms: Math.round(out.reduce((a, b)=> a + b, 0)), max: out.length ? Math.round(Math.max(...out)) : 0 };
}
export const now = s => s.evaluate(()=> window.__now());
/* An interaction in the XRPD tab on show (scope s): the next sample (→: both cards drawn),
   or the smoothing width of card 1 set to the other of 0.25 and 0.30° (the 12 patterns
   smoothed again, both cards drawn, a commit); from the event to two frames. */
export function interact(s, what = 'next'){
  return s.evaluate(what=> new Promise(r=>{
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
