/* What the measurements share: the fixtures, a Chromium on the app (today's tabs, HEAD, or
   the live tabs of the patch), a driver that does the same steps in both (a tab opened, its
   files loaded, shown, refined), memory after a forced GC, and timing inside the page.

   Two servers, started by hand (README): HEAD_BASE (default http://127.0.0.1:8971) serves a
   copy of HEAD, LIVE_BASE (http://127.0.0.1:8972) a copy with live-tabs.patch applied.

   Memory (mem): CDP HeapProfiler.collectGarbage then Runtime.getHeapUsage on the page's
   session (the isolate's heap: same-origin frames share one isolate, so it holds every
   tab's realm), the same in every worker (attached through Target.setAutoAttach), and the
   renderer process's VmRSS and Pss (/proc/<pid>/status, smaps_rollup; the pids from the
   browser's SystemInfo.getProcessInfo). Time (in the page): performance.timeOrigin +
   performance.now(), comparable between the shell and its frames; "done" is two animation
   frames in the realm that shows the result. Long tasks: a PerformanceObserver in every
   realm (an init script), deduplicated by start. */
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
export const BASES = { head: process.env.HEAD_BASE || 'http://127.0.0.1:8971', live: process.env.LIVE_BASE || 'http://127.0.0.1:8972' };

/* ---- Fixtures ----
   XRPD: the 12 XRDML scans (5384 points, SrTiO3-like, the cell 0.035 % smaller per step) and
   the SrTiO3 CIF; DRS: 2 spectra; GC: 2 runs; EPR: a BES3T pair; SEM: 8 Tescan TIFFs of
   2048 × 2176, 16-bit, written once from tests/fixtures.mjs makeTiff (8.9 MB each). */
export const XRD12 = Array.from({ length: 12 }, (_, i)=> path.join(FX, 'xrd', 's' + String(i).padStart(2, '0') + '.xrdml'));
export const CIF = path.join(FX, 'SrTiO3.cif');
export const DRS = [path.join(FX, 'drs1.csv'), path.join(FX, 'drs2.csv')];
export const GC = [path.join(FX, 'alpha.csv'), path.join(FX, 'beta.csv')];
export const EPR = [path.join(FX, 'e1.DSC'), path.join(FX, 'e1.DTA')];
let _sem = null;
export async function SEM8(){
  if (_sem) return _sem;
  const { makeTiff } = await import(path.join(ROOT, 'tests/fixtures.mjs'));
  const dir = process.env.SEM_DIR || path.join(os.tmpdir(), 'dt-live-tabs-sem8');
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
// (TAG=x in the environment: results/<name>-x.json, a variant's numbers beside the default's)
export function save(name, obj){ if (process.env.TAG) name = name.replace(/\.json$/, '-' + process.env.TAG + '.json'); const f = path.join(RESULTS, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); return f; }
export const sleep = ms => new Promise(r=> setTimeout(r, ms));

/* ---- The browser ---- */
const INIT = ()=>{
  window.__lt = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([performance.timeOrigin + e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  window.__now = ()=> performance.timeOrigin + performance.now();
};
// knobs: the live tabs' localStorage settings (eager, max, idle, hide), set before the app starts
// (live tabs are switched on by localStorage 'datatreat-live-tabs' = 'on': the knob 'tabs')
export async function launch(mode, { knobs = {}, viewport = { width: 1400, height: 900 } } = {}){
  if (mode === 'live') knobs = { tabs: 'on', ...knobs };
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', acceptDownloads: true, timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' });
  await ctx.addInitScript(INIT);
  if (Object.keys(knobs).length) await ctx.addInitScript(k=>{ try { for (const [a, b] of Object.entries(k)) localStorage.setItem('datatreat-live-' + a, String(b)); } catch(e){} }, knobs);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  page.on('console', m=>{ if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('crash', ()=> errors.push('CRASH: the renderer died'));
  const cdp = await ctx.newCDPSession(page);
  // Workers, attached as they come (the page's and its frames': all children of the page target).
  const subs = new Map(), pending = new Map(); let mid = 1000;
  cdp.on('Target.attachedToTarget', e=>{ if (e.targetInfo.type === 'worker') subs.set(e.sessionId, e.targetInfo); });
  cdp.on('Target.detachedFromTarget', e=> subs.delete(e.sessionId));
  cdp.on('Target.receivedMessageFromTarget', e=>{ const m = JSON.parse(e.message); const p = pending.get(m.id); if (p){ pending.delete(m.id); p(m); } });
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  const send = (sessionId, method, params = {})=> new Promise(res=>{ const id = ++mid; const t = setTimeout(()=>{ pending.delete(id); res({ error: 'timeout' }); }, 8000);
    pending.set(id, m=>{ clearTimeout(t); res(m); }); cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(()=> res({ error: 'gone' })); });
  const bcdp = await browser.newBrowserCDPSession();
  const procs = async ()=> (await bcdp.send('SystemInfo.getProcessInfo')).processInfo;
  const kb = (txt, k)=> +((txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;
  const procMem = pid =>{ try { const st = fs.readFileSync(`/proc/${pid}/status`, 'utf8'), sm = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
    return { rss: kb(st, 'VmRSS'), hwm: kb(st, 'VmHWM'), pss: kb(sm, 'Pss'), priv: kb(sm, 'Private_Dirty') + kb(sm, 'Private_Clean') }; } catch(e){ return null; } };
  // Memory after a forced GC (MB). renderer: the largest renderer process (the page's; a
  // spare one Chromium keeps is small); all: every process of the browser.
  async function mem(){
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(150);
    await cdp.send('HeapProfiler.collectGarbage');
    const h = await cdp.send('Runtime.getHeapUsage');
    const workers = [];
    for (const sid of subs.keys()){
      await send(sid, 'HeapProfiler.enable'); await send(sid, 'HeapProfiler.collectGarbage');
      const w = await send(sid, 'Runtime.getHeapUsage');
      if (w.result) workers.push(w.result.usedSize/1048576);
    }
    const ps = (await procs()).map(p=> ({ type: p.type, pid: p.id, ...procMem(p.id) })).filter(p=> p.rss != null);
    const rend = ps.filter(p=> p.type === 'renderer').sort((a, b)=> b.rss - a.rss);
    const sum = (a, k)=> a.reduce((t, p)=> t + (p[k] || 0), 0);
    const dom = await page.evaluate(()=>{ let n = document.getElementsByTagName('*').length; for (const f of document.querySelectorAll('iframe')){ try { n += f.contentDocument.getElementsByTagName('*').length; } catch(e){} } return n; }).catch(()=> null);
    return { heap: h.usedSize/1048576, heapTotal: h.totalSize/1048576, workers: workers.length, workerHeap: workers.reduce((a, b)=> a + b, 0),
      renderer: rend[0] ? { rss: rend[0].rss, pss: rend[0].pss, priv: rend[0].priv, hwm: rend[0].hwm } : null, renderers: rend.length,
      rendererRssAll: sum(rend, 'rss'), allPss: sum(ps, 'pss'), allRss: sum(ps, 'rss'), byType: Object.fromEntries([...new Set(ps.map(p=> p.type))].map(t=> [t, Math.round(sum(ps.filter(p=> p.type === t), 'pss'))])), domNodes: dom };
  }
  const app = new App(page, mode, BASES[mode]);
  return { browser, ctx, page, cdp, app, mem, errors, nWorkers: ()=> subs.size, close: ()=> browser.close() };
}

/* ---- Driving the app, the same steps in both ----
   A tab is known by its place in the bar. In HEAD its module is the page's own, live only
   while it is on show (every step on a tab shows it first); with live tabs it is the frame of
   that tab (index.html?embed=<id>). */
const BOOTED = ()=> !document.documentElement.classList.contains('app-booting') && !document.querySelector('.module-loader.show');
export class App {
  constructor(page, mode, base){ this.page = page; this.mode = mode; this.base = base; this.live = mode === 'live'; }
  async goto(){ await this.page.goto(this.base + '/index.html'); await this.page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 }); }
  count(){ return this.page.locator('#tabBar .ptab').count(); }
  async idOf(i){ return this.page.locator('#tabBar .ptab').nth(i).getAttribute('data-id'); }
  // The frame of tab i, once its page is up and its tab restored.
  async frame(i, timeout = 120000){
    const id = await this.idOf(i);
    const h = await this.page.waitForSelector(`.live-frames iframe[src*="embed=${id}"]`, { state: 'attached', timeout });
    const f = await h.contentFrame();
    await f.waitForFunction(BOOTED, null, { timeout });
    return f;
  }
  async scope(i){ return this.live ? this.frame(i) : this.page; }
  async settle(s){
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
  async show(i){
    await this.page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
    const s = await this.scope(i);
    await this.settle(s);
    return s;
  }
  async files(i, mod, files, rows){
    const s = await this.show(i);
    const sel = `#${mod}FileTableWrap tr.file-row`;
    const n0 = await s.locator(sel).count();
    rows = rows ?? (mod === 'epr' ? files.length/2 : files.length);
    await s.setInputFiles(`#${mod}Files`, files);
    await s.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + rows], { timeout: 180000 });
    if (mod === 'sem') await s.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 180000 });
    await this.settle(s);
    return s;
  }
  async cif(i){
    const s = await this.show(i);
    await s.setInputFiles('#xrdR2CifInput', CIF);
    await s.waitForSelector('#xrdR2PhaseList input[data-on]');
    await this.settle(s);
    return s;
  }
  // Refine all on card 2 ('Refine without the standard'); resolves once it runs. s: the
  // tab's scope, not shown first when given (a hidden frame).
  async refineAll(i, s){
    s = s || await this.show(i);
    await s.waitForTimeout(650);   // (a press within 600 ms of the last is not taken)
    await s.click('#xrdR2RefineAll');
    await s.waitForSelector('.confirm-modal');
    await s.click('.confirm-modal .btn:not(.primary)');
    await s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000 });
    return s;
  }
  refineDone(s, timeout = 600000){ return s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout, polling: 50 }); }
  async results(s){ return s.evaluate(async ()=>{ const u = await import('./utils.js'); const st = u.getModuleState('xrd'); const c = st && st.cards.find(c=> c.id === 2); return c ? Object.keys(c.states.rietveld.results || {}).length : -1; }); }
}

/* ---- Timing inside the page ---- */
// Long tasks of every realm (the shell and its frames) that started at or after t (absolute ms).
export async function longTasks(page, t0, t1 = Infinity){
  const all = [];
  for (const f of page.frames()){ try { all.push(...await f.evaluate(()=> window.__lt || [])); } catch(e){} }
  const seen = new Set(), out = [];
  for (const [t, d] of all.sort((a, b)=> a[0] - b[0])){ const k = Math.round(t); if (seen.has(k) || t < t0 - 1 || t > t1) continue; seen.add(k); out.push(d); }
  return { n: out.length, ms: Math.round(out.reduce((a, b)=> a + b, 0)), max: out.length ? Math.round(Math.max(...out)) : 0 };
}
export const now = s => s.evaluate(()=> window.__now());
// Two frames in a realm from now: the absolute time they end.
export const twoFrames = s => s.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> r(window.__now())))));

/* A tab switch, from the click (dispatched in the page, at t0) to two frames in the realm
   that shows the tab once its loader is gone (HEAD: the restore; live: the frame shown).
   The shown frame's timing loop starts before the click, so a frame made by the click (a
   tab first shown) is waited for. */
export async function timedSwitch(app, i){
  const page = app.page;
  const id = await app.idOf(i);
  if (!app.live){
    const t = await page.evaluate(id=> new Promise(r=>{
      const el = document.querySelector(`#tabBar .ptab[data-id="${id}"] .ptab-label`);
      const t0 = window.__now();
      el.click();
      const loop = ()=>{ if (document.querySelector('.module-loader.show')) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> r({ t0, t1: window.__now() }))); };
      requestAnimationFrame(loop);
    }), id);
    return { ms: t.t1 - t.t0, ...t, made: false };
  }
  const had = await page.locator(`.live-frames iframe[src*="embed=${id}"]`).count();
  if (!had){
    // (a frame made by this click: its boot and restore, up to two frames once its loader is gone)
    const t0 = await page.evaluate(id=>{ const t0 = window.__now(); document.querySelector(`#tabBar .ptab[data-id="${id}"] .ptab-label`).click(); return t0; }, id);
    const f = await app.frame(i);
    const t1 = await twoFrames(f);
    return { ms: t1 - t0, t0, t1, made: true };
  }
  const f = await app.frame(i);
  const p = f.evaluate(()=> new Promise(r=>{ window.__sw = ()=>{ const loop = ()=>{ if (document.querySelector('.module-loader.show')) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> r(window.__now()))); }; requestAnimationFrame(loop); }; }));
  const t0 = await page.evaluate(([id])=>{
    const fr = document.querySelector(`.live-frames iframe[src*="embed=${id}"]`);
    const t0 = window.__now();
    document.querySelector(`#tabBar .ptab[data-id="${id}"] .ptab-label`).click();
    fr.contentWindow.__sw();
    return t0;
  }, [id]);
  const t1 = await p;
  return { ms: t1 - t0, t0, t1, made: false };
}

/* An interaction in a realm: the XRPD smoothing width (card 1) set to the other of 0.25 and
   0.30 ° (a change: the 12 patterns smoothed again, both cards drawn, a commit), or the next
   sample (→: both cards drawn); from the event to two frames. */
export function interact(s, what = 'smooth'){
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

/* ---- Tabs of the scenarios ----
   xrd: XRPD, 12 patterns, the CIF on card 2, Refine all run to its end; sem: SEM, the 8
   TIFFs; drs, gc, epr: their 2, 2 and 1 files; blank: a module with no file. */
export async function addTab(app, kind){
  const mod = { xrd: 'xrd', sem: 'sem', drs: 'tauc', gc: 'gc', epr: 'epr' }[kind] || kind;
  const i = await app.newTab(mod);
  if (kind === 'xrd'){
    await app.files(i, 'xrd', XRD12);
    await app.cif(i);
    const s = await app.refineAll(i);
    await app.refineDone(s);
    await app.settle(s);
  } else if (kind === 'sem') await app.files(i, 'sem', await SEM8());
  else if (kind === 'drs') await app.files(i, 'tauc', DRS);
  else if (kind === 'gc') await app.files(i, 'gc', GC);
  else if (kind === 'epr') await app.files(i, 'epr', EPR);
  return i;
}
// Refine all started in a frame not on show (no click by Playwright: it clicks only what is
// shown): its button, then the question's 'Refine without the standard'.
export async function refineHidden(f){
  await f.waitForTimeout(650);
  await f.evaluate(()=> document.querySelector('#xrdR2RefineAll').click());
  await f.waitForFunction(()=> document.querySelector('.confirm-modal'));
  await f.evaluate(()=> document.querySelector('.confirm-modal .btn:not(.primary)').click());
  await f.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000 });
}
// The time a run takes in its realm: from now to the button back to Refine (absolute ms).
export const runEnd = (s, timeout = 600000)=> s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine' && window.__now(), null, { timeout, polling: 20 }).then(h=> h.jsonValue());
