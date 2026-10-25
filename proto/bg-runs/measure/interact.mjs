/* Working in the XRPD tab on show while refinements go on: today (HEAD) against the
   prototype (bg). Tabs: A, B, C (XRPD: 12 patterns, the CIF on card 2, refined), B on show.
   Conditions: none (nothing runs); own (B's own Refine all, on show: today's only way);
   parked1 (A refining, parked); parked2 (A and C refining, parked; bg only).
   Interactions in B, alternately: the next sample (→: both cards drawn) and the smoothing
   width of card 1 set to the other of 0.25 and 0.30° (the 12 patterns smoothed again, both
   cards drawn, a commit); each from the event to two animation frames, its long tasks;
   N of each, 300 ms apart, only while every run of the condition goes on (a run ended is
   started again, Clear all then Refine all, its tab shown for that and B again after).
   node interact.mjs <head|bg> [n, default 12]  → results/interact-<mode>.json */
import { launch, interact, longTasks, med, pct, r1, save, load, sleep } from './lib.mjs';
const [mode = 'bg', N = '12'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
const A = await app.xrdTab(); await app.refineAll(); await app.runEnd();
const C = await app.xrdTab(); await app.refineAll(); await app.runEnd();
const B = await app.xrdTab(); await app.refineAll(); await app.runEnd(); await app.settle();
await sleep(1500);
const RUNS = { none: [], own: [B], parked1: [A], parked2: [A, C] };
const going = async cond => page.evaluate(([own, parked, B])=>{
  if (own && document.querySelector('#xrdR2Refine').textContent !== 'Cancel') return false;
  return parked.every(i=>{ const t = window.__T.TABS[i]; return t && t.jobs && t.jobs.length; });
}, [RUNS[cond].includes(B), RUNS[cond].filter(i=> i !== B), B]);
async function startRuns(cond){
  for (const i of RUNS[cond]){ await app.show(i); await app.clearAndRefine(); }
  const live = await app.tab(B);
  if (!live.live) await app.show(B);
  await sleep(500);
}
const out = {};
const conds = mode === 'head' ? ['none', 'own'] : ['none', 'own', 'parked1', 'parked2'];
for (const cond of conds){
  const v = out[cond] = { next: [], smooth: [], longNext: [], longSmooth: [], restarts: 0 };
  while (v.next.length < +N || v.smooth.length < +N){
    if (RUNS[cond].length && !await going(cond)){ v.restarts++; await startRuns(cond); continue; }
    const what = v.next.length <= v.smooth.length ? 'next' : 'smooth';
    const t = await interact(page, what);
    await sleep(120);
    // (a run that ended meanwhile: the sample is not of this condition)
    if (RUNS[cond].length && !await going(cond)) continue;
    const lt = await longTasks(page, t.t0, t.t0 + t.ms);
    v[what].push(t.ms); v[what === 'next' ? 'longNext' : 'longSmooth'].push(lt.ms);
    await sleep(300);
  }
  console.log(cond, 'next', r1(med(v.next)), r1(pct(v.next, 0.9)), r1(Math.max(...v.next)), 'smooth', r1(med(v.smooth)), r1(pct(v.smooth, 0.9)), r1(Math.max(...v.smooth)), 'restarts', v.restarts);
}
const sum = Object.fromEntries(Object.entries(out).map(([k, v])=> [k, { next: { n: v.next.length, med: r1(med(v.next)), p90: r1(pct(v.next, 0.9)), max: r1(Math.max(...v.next)), longMed: med(v.longNext) },
  smooth: { n: v.smooth.length, med: r1(med(v.smooth)), p90: r1(pct(v.smooth, 0.9)), max: r1(Math.max(...v.smooth)), longMed: med(v.longSmooth) } }]));
console.log('errors', env.errors);
save(`interact-${mode}.json`, { mode, sum, raw: out, load: load(), errors: env.errors });
await env.close();
