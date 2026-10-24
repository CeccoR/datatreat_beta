/* The app's own Refine all (HEAD, card 2, SrTiO3, the 12 fixtures, without the standard),
   REPS times in one page (the card's worker kept warm after the first): from the click on
   "Refine without the standard" to Refine back, and the main thread meanwhile — each
   worker message's handling (the listener and its microtasks, to the next task through a
   MessageChannel), long tasks (PerformanceObserver) and the frames. The difference from the
   bench's serial wall (serial.mjs) is the page's own cost of a run. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { save, med, pct, load, BASE } from './lib.mjs';
const REPS = +(process.argv[2] || 5);
const FX = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/e2e/xrd/';
const CIF = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/wf-xrd/rv-busy/SrTiO3.cif';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e=> errors.push(e.message));
await page.addInitScript(()=>{
  window.__msg = []; window.__long = []; window.__frames = [];
  try { new PerformanceObserver(l=> l.getEntries().forEach(e=> window.__long.push({ t: e.startTime, d: e.duration }))).observe({ type: 'longtask' }); } catch(e){}
  const W = window.Worker;
  const ch = new MessageChannel(); let q = [];
  ch.port1.onmessage = ()=>{ const t = performance.now(); q.forEach(r=> window.__msg.push({ type: r.type, d: t - r.t0 })); q = []; };
  window.Worker = class extends W {
    addEventListener(t, fn, o){
      if (t !== 'message') return super.addEventListener(t, fn, o);
      const g = e=>{ const t0 = performance.now(); fn(e); if (e.data && (e.data.type === 'result' || e.data.type === 'progress')){ q.push({ type: e.data.type, t0 }); ch.port2.postMessage(0); } };
      (this.__m || (this.__m = new Map())).set(fn, g); return super.addEventListener(t, g, o);
    }
    removeEventListener(t, fn, o){ return super.removeEventListener(t, (t === 'message' && this.__m && this.__m.get(fn)) || fn, o); }
  };
});
await page.goto(BASE + '/index.html');
await page.waitForFunction(()=> !document.documentElement.classList.contains('app-booting') && document.querySelector('#tabBar .ptab-add'));
await page.click('#nav button[data-tab="home"]');
await page.click('.home-card[data-go="xrd"]');
await page.waitForSelector('#tab-xrd.active');
await page.setInputFiles('#xrdFiles', Array.from({ length: 12 }, (_, i)=> FX + 's' + String(i).padStart(2, '0') + '.xrdml'));
await page.waitForFunction(()=> document.querySelectorAll('#xrdFileTableWrap tr.file-row').length >= 12 && !document.querySelector('.dz-loading'));
await page.setInputFiles('#xrdR2CifInput', CIF);
await page.waitForSelector('#xrdR2PhaseList input[data-on]');
await page.waitForTimeout(800);
const reps = [];
for (let r = 0; r < REPS; r++){
  await page.waitForTimeout(700);
  await page.click('#xrdR2RefineAll');
  await page.waitForSelector('.confirm-modal');
  await page.evaluate(()=>{ window.__msg = []; window.__long = []; window.__frames = [];
    let last = performance.now(); window.__fon = true; const f = ()=>{ if (!window.__fon) return; const t = performance.now(); window.__frames.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const t0 = Date.now();
  await page.click('.confirm-modal .btn:not(.primary)');
  await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
  // to Refine back, then two frames (the end's drawing)
  await page.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 600000, polling: 20 });
  await page.evaluate(()=> new Promise(r=> requestAnimationFrame(()=> requestAnimationFrame(r))));
  const wall = Date.now() - t0;
  const m = await page.evaluate(()=>{ window.__fon = false; return { msg: window.__msg, long: window.__long, frames: window.__frames, hist: null }; });
  const h = await page.evaluate(async ()=>{ const u = await import('./utils.js'); const x = u.getModuleHistory('xrd'); return { n: x.states.length, index: x.index }; });
  const res = m.msg.filter(x=> x.type === 'result').map(x=> x.d), prog = m.msg.filter(x=> x.type === 'progress').map(x=> x.d);
  reps.push({ wall, results: res, progMed: med(prog), progP95: pct(prog, 0.95), nProg: prog.length, long: m.long, frameP95: pct(m.frames, 0.95), frameMax: Math.max(...m.frames), hist: h });
  console.log('rep', r, 'wall', wall, 'result handling ms med/max', med(res).toFixed(1), Math.max(...res).toFixed(1), 'progress med/p95', med(prog).toFixed(2), pct(prog, 0.95).toFixed(2), 'long tasks', m.long.length, m.long.map(l=> Math.round(l.d)).join(','), 'frame p95', pct(m.frames, 0.95).toFixed(1), 'hist', JSON.stringify(h));
}
const sum = { wallFirst: reps[0].wall, wallWarmMed: med(reps.slice(1).map(r=> r.wall)), resultHandlingMed: med(reps.flatMap(r=> r.results)), resultHandlingMax: Math.max(...reps.flatMap(r=> r.results)),
  lastResultMed: med(reps.map(r=> r.results[r.results.length - 1])), progressHandlingMed: med(reps.map(r=> r.progMed)), longTasksPerRun: reps.map(r=> r.long.length), longTaskMsPerRun: reps.map(r=> Math.round(r.long.reduce((t, l)=> t + l.d, 0))), load: load(), errors };
save('inapp.json', { reps, sum });
console.log(JSON.stringify(sum, null, 1));
await browser.close();
