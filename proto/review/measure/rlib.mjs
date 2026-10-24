/* Reviewer's own measurement kit (b14 review of proto/live-tabs, proto/bg-runs, proto/workers).
   Independent of the prototypes' lib.mjs: real input (CDP mouse and keyboard through
   Playwright, not events dispatched by script), t0 = the input event's own timeStamp (the
   moment the browser received it, so the time the main thread was busy before handling it
   counts), t1 = two animation frames after the handler in the realm on show; Event Timing
   entries (startTime → next paint) beside it; memory from /proc of every process descended
   from this node process (renderer, GPU, utility), Private and RSS, and the JS heap after
   a forced GC; runs timed by a MutationObserver on the card's button (no polling). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const SP = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad';
export const OUT = SP + '/b14/review/out';
fs.mkdirSync(OUT, { recursive: true });
export const XRD12 = Array.from({ length: 12 }, (_, i)=> `${SP}/e2e/xrd/s${String(i).padStart(2, '0')}.xrdml`);
export const CIF = `${SP}/wf-xrd/rv-busy/SrTiO3.cif`;
export const DRS = [`${SP}/fx/drs1.csv`];
export const GC = [`${SP}/e2e/alpha.csv`];
export const EPR = [`${SP}/fx/e1.DSC`, `${SP}/fx/e1.DTA`];
export const SEM8 = Array.from({ length: 8 }, (_, i)=> `${SP}/b14/review/fx/sem/img${i + 1}.tif`);
export const BASE = { head: 'http://127.0.0.1:8984', live: 'http://127.0.0.1:8985', bg: 'http://127.0.0.1:8986', pool: 'http://127.0.0.1:8987', livepool: 'http://127.0.0.1:8988', bgpool: 'http://127.0.0.1:8989' };
export const sleep = ms => new Promise(r=> setTimeout(r, ms));
export const med = a =>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
export const q = (a, p)=>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p*(s.length - 1) + 0.5))] : NaN; };
export const r0 = x => Math.round(x);
export const stats = a => ({ n: a.length, med: r0(med(a)), p90: r0(q(a, 0.9)), max: r0(Math.max(...a)), min: r0(Math.min(...a)) });
export function save(name, obj){ fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1) + '\n'); }
export const loadavg = ()=> fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).map(Number);

const INIT = ()=>{
  window.__T = ()=> performance.timeOrigin + performance.now();
  window.__lt = [];
  window.__evt = [];
  window.__in = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([performance.timeOrigin + e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__evt.push({ name: e.name, t: performance.timeOrigin + e.startTime, dur: e.duration, delay: e.processingStart - e.startTime, proc: e.processingEnd - e.processingStart }))).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch(e){}
  // every real input: its timestamp (absolute), and two frames after its handlers (absolute)
  for (const type of ['keydown', 'pointerdown']){
    window.addEventListener(type, e=>{
      const rec = { type, key: e.key || '', t0: performance.timeOrigin + e.timeStamp, h: performance.timeOrigin + performance.now(), t1: null };
      window.__in.push(rec);
      requestAnimationFrame(()=> requestAnimationFrame(()=>{ rec.t1 = performance.timeOrigin + performance.now(); }));
    }, true);
  }
};

/* Processes descended from this node process, by type, with RSS and Private (MB). */
function procTree(){
  const kids = new Map();
  for (const d of fs.readdirSync('/proc')){
    if (!/^\d+$/.test(d)) continue;
    try { const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); const pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(+d); } catch(e){}
  }
  const out = [], todo = [process.pid];
  while (todo.length){ const p = todo.pop(); for (const c of kids.get(p) || []){ out.push(c); todo.push(c); } }
  return out.map(pid =>{
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ');
      const type = ((cmd.match(/--type=(\S+)/) || [])[1]) || 'browser';
      const sm = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      const kb = k => +((sm.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;
      const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
      const threads = +((status.match(/^Threads:\s+(\d+)/m) || [])[1] || 0);
      return { pid, type, rss: kb('Rss'), pss: kb('Pss'), priv: kb('Private_Clean') + kb('Private_Dirty'), threads };
    } catch(e){ return null; }
  }).filter(Boolean);
}

export async function launch(mode, { knobs = {}, rv = {} } = {}){
  const live = mode === 'live' || mode === 'livepool';
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block', timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' });
  await ctx.addInitScript(INIT);
  const ls = { ...(live ? { 'datatreat-live-tabs': 'on' } : {}), ...Object.fromEntries(Object.entries(knobs).map(([k, v])=> ['datatreat-live-' + k, String(v)])), ...Object.fromEntries(Object.entries(rv).map(([k, v])=> ['datatreat-rv-' + k, String(v)])) };
  if (Object.keys(ls).length) await ctx.addInitScript(o=>{ try { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } catch(e){} }, ls);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  page.on('crash', ()=> errors.push('CRASH'));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE[mode] + '/index.html');
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 });
  const env = { mode, live, browser, ctx, page, cdp, errors, close: ()=> browser.close() };
  env.mem = async ()=>{
    await cdp.send('HeapProfiler.collectGarbage'); await sleep(200); await cdp.send('HeapProfiler.collectGarbage'); await sleep(300);
    const h = await cdp.send('Runtime.getHeapUsage');
    const ps = procTree();
    const sum = (t, k)=> ps.filter(p=> !t || p.type === t).reduce((a, p)=> a + p[k], 0);
    const rend = ps.filter(p=> p.type === 'renderer').sort((a, b)=> b.rss - a.rss)[0] || {};
    return { heap: h.usedSize/1048576, rendRss: rend.rss, rendPriv: rend.priv, rendThreads: rend.threads, gpuPriv: sum('gpu-process', 'priv'), allPss: sum(null, 'pss'), allPriv: sum(null, 'priv'), nProc: ps.length };
  };
  return env;
}

/* ---- Driving: tab i's realm (the page, or its frame with live tabs) ---- */
export const nTabs = page => page.locator('#tabBar .ptab').count();
export const tabId = (page, i)=> page.locator('#tabBar .ptab').nth(i).getAttribute('data-id');
export async function realm(env, i, timeout = 120000){
  if (!env.live) return env.page;
  const id = await tabId(env.page, i);
  const h = await env.page.waitForSelector(`.live-frames iframe[src*="embed=${id}"]`, { state: 'attached', timeout });
  const f = await h.contentFrame();
  await f.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !document.querySelector('.module-loader.show'), null, { timeout });
  return f;
}
export async function settle(s){
  await s.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 180000 });
  await s.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 30)))));
}
export async function show(env, i){
  await env.page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').click();
  const s = await realm(env, i);
  await settle(s);
  return s;
}
export async function newTab(env, mod){
  const page = env.page;
  await page.click('#nav button[data-tab="home"]');
  const n = await nTabs(page);
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
  const s = await realm(env, n);
  await s.waitForSelector(`#tab-${mod}.active`);
  await settle(s);
  return n;
}
export async function loadFiles(s, mod, files, wait = true){
  const sel = `#${mod}FileTableWrap tr.file-row`;
  const n0 = await s.locator(sel).count();
  const rows = mod === 'epr' ? files.length/2 : files.length;
  await s.setInputFiles(`#${mod}Files`, files);
  if (!wait) return;
  await s.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + rows], { timeout: 180000 });
  if (mod === 'sem') await s.waitForFunction(()=> document.querySelectorAll('#semThumbs .sem-thumb').length === document.querySelectorAll('#semFileTableWrap .file-incl:checked').length, null, { timeout: 180000 });
  await settle(s);
}
/* Refine all on card 2 without the standard, by script clicks in its realm (a hidden frame
   cannot take Playwright's clicks). Returns the absolute time of the click that starts it. */
export async function startRefine(s){
  await s.waitForTimeout(700);
  await s.evaluate(()=> document.querySelector('#xrdR2RefineAll').click());
  await s.waitForFunction(()=> document.querySelector('.confirm-modal'));
  return s.evaluate(()=>{
    // the end: the button's text back to Refine, seen by a MutationObserver
    window.__runEnd = new Promise(res=>{
      const b = document.querySelector('#xrdR2Refine');
      let started = false;
      const mo = new MutationObserver(()=>{ const t = b.textContent; if (t === 'Cancel') started = true; else if (started && t === 'Refine'){ mo.disconnect(); res(window.__T()); } });
      mo.observe(b, { childList: true, characterData: true, subtree: true });
    });
    const t0 = window.__T();
    document.querySelector('.confirm-modal .btn:not(.primary)').click();
    return t0;
  });
}
export const runEnd = s => s.evaluate(()=> window.__runEnd);
/* Card 2's results (file → result), hashed without the worker's times. */
export const resHash = s => s.evaluate(async ()=>{
  const u = await import('./utils.js');
  const st = u.getModuleState('xrd'); const c = st && st.cards.find(c=> c.id === 2);
  const r = (c && c.states.rietveld && c.states.rietveld.results) || {};
  return { keys: Object.keys(r), json: JSON.stringify(r, (k, v)=> k === 'at' || k === 'ms' ? undefined : v) };
}).then(o=> ({ n: o.keys.length, order: o.keys.join(','), hash: createHash('sha256').update(o.json).digest('hex').slice(0, 16), len: o.json.length }));

/* An XRPD tab: 12 patterns, the CIF on card 2, Refine all run to its end. */
export async function xrdTab(env){
  const i = await newTab(env, 'xrd');
  const s = await realm(env, i);
  await loadFiles(s, 'xrd', XRD12);
  await s.setInputFiles('#xrdR2CifInput', CIF);
  await s.waitForSelector('#xrdR2PhaseList input[data-on]');
  await settle(s);
  await startRefine(s);
  await runEnd(s);
  await settle(s);
  return i;
}
export async function plainTab(env, mod, files){
  const i = await newTab(env, mod);
  const s = await realm(env, i);
  await loadFiles(s, mod, files);
  return i;
}

/* A switch by a real mouse click on tab i's label: from the pointerdown's timestamp (shell)
   to two frames, in the realm that shows it, after its loader is gone and its tab is the
   one on show. The waiter is set before the click. */
export async function timedSwitch(env, i){
  const page = env.page, id = await tabId(page, i);
  const s = env.live ? await realm(env, i) : page;
  await s.evaluate(id=>{
    window.__sw = new Promise(res=>{
      const ok = ()=> !document.querySelector('.module-loader.show') && (window.frameElement ? !window.frameElement.classList.contains('off') && !window.frameElement.parentElement.hidden : !!document.querySelector(`#tabBar .ptab.is-on[data-id="${id}"]`));
      const loop = ()=>{ if (!ok()) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> res(window.__T()))); };
      requestAnimationFrame(loop);
    });
  }, id);
  const box = await page.locator('#tabBar .ptab').nth(i).locator('.ptab-label').boundingBox();
  const n0 = await page.evaluate(()=> window.__in.length);
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  const t1 = await s.evaluate(()=> window.__sw);
  const inp = await page.evaluate(n0=> window.__in.slice(n0).find(e=> e.type === 'pointerdown'), n0);
  return { ms: t1 - inp.t0, t0: inp.t0, t1 };
}
/* Long tasks of every realm between two absolute times (deduplicated by start). */
export async function longTasks(page, t0, t1){
  const all = [];
  for (const f of page.frames()){ try { all.push(...await f.evaluate(()=> window.__lt || [])); } catch(e){} }
  const seen = new Set(), out = [];
  for (const [t, d] of all.sort((a, b)=> a[0] - b[0])){ const k = Math.round(t); if (seen.has(k) || t + d < t0 || t > t1) continue; seen.add(k); out.push(d); }
  return { n: out.length, sum: r0(out.reduce((a, b)=> a + b, 0)), max: out.length ? r0(Math.max(...out)) : 0 };
}
/* Real keys in realm s (it must hold the focus): '→' (next sample) or a smoothing width typed
   in card 1's field and Enter. Returns ms from the key's timestamp to two frames after its
   handlers, the input delay (handler start − timestamp), and the Event Timing duration. */
export async function key(env, s, what){
  const n0 = await s.evaluate(()=> ({ i: window.__in.length, e: window.__evt.length }));
  if (what === 'next'){
    await s.evaluate(()=>{ const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); window.focus(); });
    await env.page.keyboard.press('ArrowRight');
  } else {
    const v = await s.evaluate(()=>{ const el = document.querySelector('#xrdA1Smooth'); el.focus(); el.select(); return el.value === '0.25' ? '0.3' : '0.25'; });
    await env.page.keyboard.type(v);
    await sleep(30);
    await env.page.keyboard.press('Enter');
  }
  const k = what === 'next' ? 'ArrowRight' : 'Enter';
  const rec = await s.waitForFunction(([n, k])=>{ const r = window.__in.slice(n).find(e=> e.type === 'keydown' && e.key === k); return r && r.t1 ? r : null; }, [n0.i, k], { timeout: 30000, polling: 10 }).then(h=> h.jsonValue());
  await sleep(60);
  const ev = await s.evaluate(([t0])=> window.__evt.filter(e=> e.name === 'keydown' && Math.abs(e.t - t0) < 2), [rec.t0]);
  return { ms: rec.t1 - rec.t0, delay: rec.h - rec.t0, evDur: ev.length ? ev[0].dur : null, t0: rec.t0, t1: rec.t1 };
}
