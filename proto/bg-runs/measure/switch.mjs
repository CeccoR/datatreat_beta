/* Switching tabs, today (HEAD) against the prototype (bg), idle and with a refinement going on.
   Tabs: XRPD A and XRPD B (12 patterns, the CIF on card 2, Refine all run to its end), SEM
   (8 TIFFs 2048 × 2176, 16-bit), DRS (1 spectrum), GC (1 run).
   Idle: REPS rounds of the transitions A→B, B→SEM, SEM→A, A→DRS, DRS→GC, GC→A.
   Running (bg only): REPS rounds of Clear all and Refine all in A, its first result waited
   for, then A→B (the running tab left: its run detached, B restored), B→SEM (a run parked
   elsewhere), SEM→A (A restored, its run taken back by its card), and its end waited for.
   Today the first of these asks "Stop it and leave" and stops the run: no such switch.
   Each switch: from the click on the tab (dispatched in the page) to two animation frames
   once the module's loader is gone; the long tasks meanwhile.
   node switch.mjs <head|bg> [reps, default 7]  → results/switch-<mode>.json */
import { launch, timedSwitch, longTasks, med, pct, r1, save, load, sleep, SEM8, DRS, GC, App } from './lib.mjs';
const [mode = 'bg', reps = '7'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
const A = await app.xrdTab(); await app.refineAll(); await app.runEnd(); await app.settle();
const B = await app.xrdTab(); await app.refineAll(); await app.runEnd(); await app.settle();
const SEM = await app.newTab('sem'); await app.files('sem', await SEM8());
const D = await app.newTab('tauc'); await app.files('tauc', DRS);
const G = await app.newTab('gc'); await app.files('gc', GC);
const NAME = { [A]: 'A', [B]: 'B', [SEM]: 'SEM', [D]: 'DRS', [G]: 'GC' };
await app.show(A);
await sleep(1500);
const by = {};
const rec = (k, t, lt)=>{ const v = by[k] || (by[k] = { ms: [], long: [], longMax: [] }); v.ms.push(t.ms); v.long.push(lt.ms); v.longMax.push(lt.max); };
async function sw(to, key){
  const t = await timedSwitch(app, to);
  await sleep(300);
  rec(key, t, await longTasks(page, t.t0, t.t1));
  await sleep(300);
}
const seq = [B, SEM, A, D, G, A];
let cur = A;
for (let r = 0; r < +reps; r++) for (const to of seq){ await sw(to, 'idle ' + NAME[cur] + '→' + NAME[to]); cur = to; }
const runs = [];
if (mode !== 'head'){
  for (let r = 0; r < +reps; r++){
    await app.clearAndRefine();
    await app.liveResults(1);
    await sw(B, 'running: A→B (A left mid-run)');
    const left = await app.tab(A);
    await sleep(700);
    await sw(SEM, 'running: B→SEM (A parked, refining)');
    await sleep(700);
    const parked = await app.tab(A);
    await sw(A, 'running: SEM→A (A shown, its run taken back)');
    const back = { label: await page.textContent('#xrdR2Refine'), n: Object.keys(App.res((await app.tab(A)).state)).length };
    await app.runEnd(); await app.settle();
    const end = Object.keys(App.res((await app.tab(A)).state)).length;
    runs.push({ leftRunning: left.running, leftN: Object.keys(App.res(left.state)).length, parkedN: Object.keys(App.res(parked.state)).length, back, end });
    await sleep(800);
  }
}
const sum = Object.fromEntries(Object.entries(by).map(([k, v])=> [k, { n: v.ms.length, med: r1(med(v.ms)), p90: r1(pct(v.ms, 0.9)), max: r1(Math.max(...v.ms)), longMsMed: med(v.long), longMaxMed: med(v.longMax) }]));
console.log(mode, JSON.stringify(sum, null, 1));
console.log('runs', JSON.stringify(runs));
console.log('errors', env.errors);
save(`switch-${mode}.json`, { mode, sum, raw: by, runs, load: load(), errors: env.errors });
await env.close();
