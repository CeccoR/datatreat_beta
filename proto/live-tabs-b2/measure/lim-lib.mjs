/* The limit's measurements (lim-*.mjs), independent of the builders' lib.mjs: one kit for b2
   (HEAD + b2.patch), today (HEAD, v517) and b1 (HEAD + live-tabs.patch + pool.patch), each a
   tree served on its own port (LIM_B2, LIM_HEAD, LIM_B1) with the fixtures of lim-fx.mjs
   under fx/ (a link), and MAX_TABS raised from 20 to 32 so that 24 tabs and the work tabs fit.
   - Input is real (CDP mouse and keyboard through Playwright). A time runs from the input
     event's own timeStamp (so a main thread busy before the handler counts) to two animation
     frames after the handlers, in the realm that shows the result (b1: the tab's frame).
   - Memory after a forced GC (HeapProfiler.collectGarbage twice, then a memory-pressure
     signal so that the pages freed go back to the system): the page's JS heap and its
     ArrayBuffers (Runtime.getHeapUsage usedSize, backingStorageSize), Blink's DOM nodes, and
     from /proc for every process descended from this node process (browser, renderer, GPU,
     utility): Private (Private_Clean + Private_Dirty of smaps_rollup) summed, the renderer's
     RSS and Private, the GPU process's Private; the workers alive are the renderer's
     threads named DedicatedWorker (the pool's, SEM's reader). Peaks: the same Private sum and
     renderer RSS sampled every 200 ms with no GC.
   - The context: off the record (browser.newContext), unless LIM_PROFILE=disk: a profile on
     disk (launchPersistentContext, a new directory each run), as a real browser has. Off
     the record IndexedDB is kept in the browser process's memory, up to the origin's quota
     of some 980 MB, past which writes fail (idb-mem.mjs, results/idb-mem.json).
   - Long tasks from a PerformanceObserver in every realm, by absolute time. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RESULTS = process.env.LIM_RESULTS || path.resolve(HERE, '../results');
export const BASE = { b2: process.env.LIM_B2 || 'http://127.0.0.1:8960', head: process.env.LIM_HEAD || 'http://127.0.0.1:8961', b1: process.env.LIM_B1 || 'http://127.0.0.1:8962' };
export const sleep = ms => new Promise(r=> setTimeout(r, ms));
export const r1 = x => Number.isFinite(x) ? Math.round(x*10)/10 : x;
export const med = a =>{ const s = a.filter(Number.isFinite).sort((x, y)=> x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
export const stats = a =>{ const s = a.filter(Number.isFinite); return s.length ? { n: s.length, med: r1(med(s)), max: r1(Math.max(...s)), min: r1(Math.min(...s)) } : null; };
export const loadavg = ()=> fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).map(Number);
export function save(name, obj){ fs.mkdirSync(RESULTS, { recursive: true }); const f = path.join(RESULTS, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); return f; }
export const XRD = k => Array.from({ length: 12 }, (_, i)=> `fx/xrd/t${k}/s${String(i).padStart(2, '0')}.xrdml`);
export const SEM = k => Array.from({ length: 8 }, (_, i)=> `fx/sem/t${k}/img${i + 1}.tif`);
export const SMALL = { tauc: ['fx/small/drs1.csv'], gc: ['fx/small/alpha.csv'], epr: ['fx/small/e1.DSC', 'fx/small/e1.DTA'] };

const INIT = ()=>{
  window.__T = ()=> performance.timeOrigin + performance.now();
  window.__lt = []; window.__evt = []; window.__in = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__lt.push([performance.timeOrigin + e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch(e){}
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__evt.push({ name: e.name, t: performance.timeOrigin + e.startTime, dur: e.duration }))).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch(e){}
  for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, e=>{
    const rec = { type, key: e.key || '', t0: performance.timeOrigin + e.timeStamp, h: performance.timeOrigin + performance.now(), t1: null };
    window.__in.push(rec);
    requestAnimationFrame(()=> requestAnimationFrame(()=>{ rec.t1 = performance.timeOrigin + performance.now(); }));
  }, true);
};

/* Every process descended from this node process: its type, Private, PSS and RSS (MB), and
   for a renderer its DedicatedWorker threads. */
const kbOf = (txt, k)=> +((txt.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1] || 0)/1024;
export function procTree(){
  const kids = new Map();
  for (const d of fs.readdirSync('/proc')){
    if (!/^\d+$/.test(d)) continue;
    try { const st = fs.readFileSync(`/proc/${d}/stat`, 'utf8'); const pp = +st.slice(st.lastIndexOf(')') + 2).split(' ')[1]; if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(+d); } catch(e){}
  }
  const out = [], todo = [process.pid];
  while (todo.length){ const p = todo.pop(); for (const c of kids.get(p) || []){ out.push(c); todo.push(c); } }
  return out.map(pid =>{
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      if (!/chrom/i.test(cmd)) return null;
      const type = ((cmd.match(/--type=([^\0 ]+)/) || [])[1]) || 'browser';
      const sm = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      let workers = 0;
      if (type === 'renderer') for (const t of fs.readdirSync(`/proc/${pid}/task`)){ try { if (fs.readFileSync(`/proc/${pid}/task/${t}/comm`, 'utf8').startsWith('DedicatedWorker')) workers++; } catch(e){} }
      return { pid, type, rss: kbOf(sm, 'Rss'), pss: kbOf(sm, 'Pss'), priv: kbOf(sm, 'Private_Clean') + kbOf(sm, 'Private_Dirty'), workers };
    } catch(e){ return null; }
  }).filter(Boolean);
}
function procSum(){
  const ps = procTree(), sum = (t, k)=> ps.filter(p=> !t || p.type === t).reduce((a, p)=> a + p[k], 0);
  const rend = ps.filter(p=> p.type === 'renderer').sort((a, b)=> b.rss - a.rss)[0] || {};
  return { allPriv: r1(sum(null, 'priv')), allPss: r1(sum(null, 'pss')), rendRss: r1(rend.rss), rendPriv: r1(rend.priv), gpuPriv: r1(sum('gpu-process', 'priv')),
    browserPriv: r1(sum('browser', 'priv')), workers: rend.workers || 0, nProc: ps.length };
}

export async function launch(tree, { knobs = {} } = {}){
  const b1 = tree === 'b1', args = ['--enable-precise-memory-info'];
  const opts = { viewport: { width: 1400, height: 900 }, serviceWorkers: 'block', timezoneId: 'UTC', locale: 'en-US', colorScheme: 'dark' };
  let browser, ctx;
  if (process.env.LIM_PROFILE === 'disk'){
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lim-profile-'));
    ctx = await chromium.launchPersistentContext(dir, { args, ...opts });
    browser = { close: async ()=>{ await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
  } else {
    browser = await chromium.launch({ args });
    ctx = await browser.newContext(opts);
  }
  await ctx.addInitScript(INIT);
  const ls = { ...(b1 ? { 'datatreat-live-tabs': 'on' } : {}), ...knobs };
  await ctx.addInitScript(o=>{ try { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } catch(e){} }, ls);
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=> errors.push('pageerror: ' + e.message));
  page.on('crash', ()=> errors.push('CRASH'));
  page.on('dialog', d=> d.dismiss());
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE[tree] + '/index.html');
  await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !!document.querySelector('#tabBar .ptab-add'), null, { timeout: 60000 });
  const env = { tree, b1, browser, ctx, page, cdp, errors, close: ()=> browser.close().catch(()=>{}) };
  // (the GC, then a critical memory-pressure signal to the renderer, which hands back to the
  // system the pages the GC freed, as it would on its own some seconds later: measured, an
  // XRPD tab put to sleep reads 211 MB at once, 186 MB purged, 183 MB 10 s later)
  env.mem = async ()=>{
    for (let i = 0; i < 2; i++){ await cdp.send('HeapProfiler.collectGarbage'); await sleep(250); }
    await cdp.send('Memory.simulatePressureNotification', { level: 'critical' }); await sleep(1000);
    const h = await cdp.send('Runtime.getHeapUsage'), d = await cdp.send('Memory.getDOMCounters');
    const limit = await page.evaluate(()=> performance.memory ? performance.memory.jsHeapSizeLimit : 0);
    return { heap: r1(h.usedSize/1048576), ab: r1((h.backingStorageSize || 0)/1048576), heapLimit: r1(limit/1048576), nodes: d.nodes, ...procSum() };
  };
  // Peaks: started, sampled every 200 ms, stopped with its maxima.
  env.peak = ()=>{
    const p = { allPriv: 0, rendRss: 0, n: 0 };
    const id = setInterval(()=>{ try { const s = procSum(); p.allPriv = Math.max(p.allPriv, s.allPriv); p.rendRss = Math.max(p.rendRss, s.rendRss); p.n++; } catch(e){} }, 200);
    return ()=>{ clearInterval(id); return p; };
  };
  return env;
}

/* ---- Tabs and their realms (the page; b1: the tab's frame) ---- */
export const nTabs = env => env.page.locator('#tabBar .ptab').count();
export const tabId = (env, i)=> env.page.locator('#tabBar .ptab').nth(i).getAttribute('data-id');
export async function realm(env, i, timeout = 180000){
  if (!env.b1) return env.page;
  const id = await tabId(env, i);
  const h = await env.page.waitForSelector(`.live-frames iframe[src*="embed=${id}"]`, { state: 'attached', timeout });
  const f = await h.contentFrame(); await h.dispose();
  await f.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && !document.querySelector('.module-loader.show'), null, { timeout });
  return f;
}
export async function settle(s){
  await s.waitForFunction(()=> !document.querySelector('.dz-loading, .module-loader.show'), null, { timeout: 300000 });
  await s.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(()=> setTimeout(r, 30)))));
}
export async function newTab(env, mod){
  const page = env.page, n = await nTabs(env);
  await page.click('#nav button[data-tab="home"]');
  await page.click(`.home-card[data-go="${mod}"]`);
  await page.waitForFunction(n=> document.querySelectorAll('#tabBar .ptab').length > n, n);
  const s = await realm(env, n);
  await (await s.waitForSelector(`#tab-${mod}.active`)).dispose();
  await settle(s);
  return n;
}
/* Files dropped on a drop zone: fetched by the page from its own origin and dropped as a
   DragEvent (setInputFiles holds its input, and so a b2 instance, from the GC). */
export async function drop(s, sel, urls){
  await s.evaluate(async ([sel, urls])=>{
    const files = await Promise.all(urls.map(async u=> new File([await (await fetch(u)).blob()], u.split('/').pop())));
    const dt = new DataTransfer(); files.forEach(f=> dt.items.add(f));
    document.querySelector(sel).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [sel, urls]);
}
export async function files(s, mod, urls, rows){
  const sel = `#${mod}FileTableWrap tr.file-row`;
  const n0 = await s.locator(sel).count();
  await drop(s, `#${mod}Dropzone`, urls);
  await s.waitForFunction(([sel, n])=> document.querySelectorAll(sel).length >= n && !document.querySelector('.dz-loading'), [sel, n0 + rows], { timeout: 300000 });
  if (mod === 'sem') await s.waitForFunction(n=> document.querySelectorAll('#semThumbs .sem-thumb canvas').length >= n, rows, { timeout: 300000 });
  await settle(s);
}
// Refine all on card 2, "Refine without the standard", in the realm on show: resolves once it runs.
export async function pressRefineAll(s){
  await s.evaluate(()=> document.querySelector('#xrdR2RefineAll').click());
  // (present, not visible: a hidden b1 frame; a boolean, not the element: a handle kept to the
  // window holds, through its button, the instance's section from the GC)
  await (await s.waitForFunction(()=> !!document.querySelector('.confirm-modal'), null, { timeout: 30000 })).dispose();
  await s.evaluate(()=> document.querySelector('.confirm-modal .btn:not(.primary)').click());
  await s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel', null, { timeout: 30000, polling: 20 });
}
export const refineDone = s => s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 900000, polling: 50 });
// An XRPD tab (fixtures of tab k): the 12 patterns, the CIF on card 2, refined unless asked not.
export async function xrdTab(env, k, refine = true){
  const i = await newTab(env, 'xrd'), s = await realm(env, i);
  await files(s, 'xrd', XRD(k), 12);
  await drop(s, '#xrdR2CifDz', ['fx/small/SrTiO3.cif']);
  await (await s.waitForSelector('#xrdR2PhaseList input[data-on]', { timeout: 60000 })).dispose();
  await settle(s);
  if (refine){ await sleep(650); await pressRefineAll(s); await refineDone(s); await settle(s); }
  return i;
}
export async function semTab(env, k){ const i = await newTab(env, 'sem'); await files(await realm(env, i), 'sem', SEM(k), 8); return i; }
export async function smallTab(env, mod){ const i = await newTab(env, mod); await files(await realm(env, i), mod, SMALL[mod], 1); return i; }

/* ---- The shell's own state ---- */
// b2: tabs.js tabsNow (awake, busy, bytes); others: null.
export const tabsNow = env => env.tree === 'b2' ? env.page.evaluate(async ()=> (await import('./tabs.js')).tabsNow()) : null;
// Runs going on: b2 its tabs busy; b1 the frames whose card 2 runs; today the one module.
export async function busyCount(env){
  if (env.tree === 'b2') return (await tabsNow(env)).filter(t=> t.busy).length;
  let n = 0;
  for (const f of env.b1 ? env.page.frames().filter(f=> f !== env.page.mainFrame()) : [env.page]){
    try { if (await f.evaluate(()=>{ const b = document.querySelector('#xrdR2Refine'); return !!b && b.textContent === 'Cancel'; })) n++; } catch(e){}
  }
  return n;
}
// b2's settings, in the page only (not saved): the limit by number and the minutes to sleep.
export const setLimits = (env, o)=> env.tree === 'b2' && env.page.evaluate(async o=>{ const u = await import('./utils.js'); Object.assign(u.settings, o); (await import('./tabs.js')).sleepTick(); }, o);

/* ---- Timed input ---- */
/* A switch by a real click on tab i's label: from the pointerdown's timestamp to two frames,
   in the realm that shows it, after its loader is gone and it is the tab on show. */
export async function timedSwitch(env, i){
  const page = env.page, id = await tabId(env, i);
  const s = env.b1 ? await realm(env, i) : page;
  await s.evaluate(id=>{
    window.__sw = new Promise(res=>{
      const ok = ()=> !document.querySelector('.module-loader.show') && (window.frameElement ? !window.frameElement.classList.contains('off') && !window.frameElement.parentElement.hidden : !!document.querySelector(`#tabBar .ptab.is-on[data-id="${id}"]`));
      const loop = ()=>{ if (!ok()) return requestAnimationFrame(loop); requestAnimationFrame(()=> requestAnimationFrame(()=> res(window.__T()))); };
      requestAnimationFrame(loop);
    });
  }, id);
  // (the bar scrolls once its tabs no longer fit: the label brought into view, and the point
  // clicked checked to be on it, before the click)
  const lab = page.locator('#tabBar .ptab').nth(i).locator('.ptab-label');
  // (the bar drawn again meanwhile, its label replaced: tried again)
  for (let k = 0; ; k++){ try { await lab.scrollIntoViewIfNeeded({ timeout: 5000 }); break; } catch(e){ if (k > 4) throw e; await sleep(200); } }
  const box = await lab.boundingBox(), x = box.x + box.width/2, y = box.y + box.height/2;
  if (!await page.evaluate(([x, y, i])=>{ const e = document.elementFromPoint(x, y); return !!e && e.closest('.ptab') === document.querySelectorAll('#tabBar .ptab')[i]; }, [x, y, i])) throw new Error('timedSwitch: tab ' + i + ' not under the pointer');
  const n0 = await page.evaluate(()=> window.__in.length);
  await page.mouse.click(x, y);
  const t1 = await s.evaluate(()=> Promise.race([window.__sw, new Promise((_, no)=> setTimeout(()=> no(new Error('switch not seen in 60 s')), 60000))]));
  const inp = await page.evaluate(n0=> window.__in.slice(n0).find(e=> e.type === 'pointerdown'), n0);
  await settle(s);
  return { ms: r1(t1 - inp.t0), t0: inp.t0, t1 };
}
// Long tasks of every realm between two absolute times (deduplicated by start).
export async function longTasks(env, t0, t1){
  const all = [];
  for (const f of env.page.frames()){ try { all.push(...await f.evaluate(()=> window.__lt || [])); } catch(e){} }
  const seen = new Set(), out = [];
  for (const [t, d] of all.sort((a, b)=> a[0] - b[0])){ const k = Math.round(t); if (seen.has(k) || t + d < t0 || t > t1) continue; seen.add(k); out.push(r1(d)); }
  return { n: out.length, sum: Math.round(out.reduce((a, b)=> a + b, 0)), max: out.length ? Math.max(...out) : 0, over200: out.filter(d=> d > 200).length };
}
/* The long tasks between two absolute times that overlap none of the windows given (the
   script's own actions: a key, a click, a GC asked for), within `pad` ms: those of whatever
   the page did by itself, the background tabs' work and the GC's. */
export async function longTasksBut(env, t0, t1, wins, pad = 30){
  const all = [];
  for (const f of env.page.frames()){ try { all.push(...await f.evaluate(()=> window.__lt || [])); } catch(e){} }
  const seen = new Set(), out = [];
  for (const [t, d] of all.sort((a, b)=> a[0] - b[0])){
    const k = Math.round(t);
    if (seen.has(k) || t + d < t0 || t > t1) continue;
    seen.add(k);
    if (wins.some(([a, b])=> t < b + pad && t + d > a - pad)) continue;
    out.push(r1(d));
  }
  return { n: out.length, sum: Math.round(out.reduce((a, b)=> a + b, 0)), max: out.length ? Math.max(...out) : 0, over200: out.filter(d=> d > 200).length, all: out.filter(d=> d > 100) };
}
export const now = env => env.page.evaluate(()=> window.__T());
/* The work in the tab on show, by real keys in realm s (it holds the focus):
   next: → (XRPD's next sample); smooth: a smoothing width typed in card 1 and Enter;
   crop: SEM's crop X typed and Enter (the crop of 1024 px moved by 40 px);
   fig: the SEM figure composer's gap typed and Enter (the preview drawn again).
   Returns ms from the key's timestamp to two frames after its handlers. */
const FIELD = { smooth: ['#xrdA1Smooth', '0.25', '0.3'], crop: ['#semCropX', '400', '440'], fig: ['.fig-backdrop input[data-p="gap"]', '1', '2'] };
export async function key(env, s, what){
  const n0 = await s.evaluate(()=> window.__in.length);
  if (what === 'next'){
    await s.evaluate(()=>{ const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); window.focus(); });
    await env.page.keyboard.press('ArrowRight');
  } else {
    const [sel, a, b] = FIELD[what];
    const v = await s.evaluate(([sel, a, b])=>{ const el = document.querySelector(sel); el.focus(); el.select(); return el.value === a ? b : a; }, [sel, a, b]);
    await env.page.keyboard.type(v);
    await sleep(30);
    await env.page.keyboard.press('Enter');
  }
  const k = what === 'next' ? 'ArrowRight' : 'Enter';
  const h = await s.waitForFunction(([n, k])=>{ const r = window.__in.slice(n).find(e=> e.type === 'keydown' && e.key === k); return r && r.t1 ? r : null; }, [n0, k], { timeout: 60000, polling: 10 });
  const rec = await h.jsonValue(); await h.dispose();
  return { ms: r1(rec.t1 - rec.t0), delay: r1(rec.h - rec.t0), t0: rec.t0, t1: rec.t1 };
}
// SEM on show: its crop made editable, 1024 px wide (not the default), for `crop`.
export async function semCropReady(env, s){
  if (await s.evaluate(()=> document.querySelector('#semCropDef').checked)){ await s.evaluate(()=> document.querySelector('#semCropDef').click()); await settle(s); }
  if (await s.evaluate(()=> document.querySelector('#semCropW').value) !== '1024'){
    await s.evaluate(()=>{ const el = document.querySelector('#semCropW'); el.focus(); el.select(); });
    await env.page.keyboard.type('1024'); await env.page.keyboard.press('Enter'); await settle(s);
  }
}
export async function figOpen(s){
  await s.evaluate(()=> document.querySelector('#semGroups .sem-group-fig:not([disabled])').click());
  await (await s.waitForSelector('.fig-backdrop .fig-svg image', { timeout: 60000 })).dispose();
  await settle(s);
}
export async function figClose(env, s){
  await env.page.keyboard.press('Escape');
  await s.waitForFunction(()=> !document.querySelector('.fig-backdrop'), null, { timeout: 30000 });
  await settle(s);
}
