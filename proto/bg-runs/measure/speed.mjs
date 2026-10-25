/* A refinement's speed where it runs: Refine all of the 12 patterns (default settings, no
   standard) on show, today and in the prototype; in the prototype also with its tab left at
   once for another XRPD tab or for a SEM tab (the run parked to its end), and two or three
   XRPD tabs refining at once, parked, a DRS tab on show.
   Tabs: A, B, C (XRPD: 12 patterns, the CIF on card 2), SEM (8 TIFFs 2048 × 2176, 16-bit),
   DRS (1 spectrum). Each run starts with Clear all.
   Time: from the click on 'Refine without the standard' to the run seen ended (its card
   back to Refine on show; parked, its tab without jobs, polled every 20 ms), in the page's
   clock. Main thread: CDP TaskDuration (the renderer's main thread busy, s) over it all
   (mainS: the switches' restores in it) and from the last switch to the end (mainRunS:
   the runs alone, nothing else done), the long tasks over the latter, the IndexedDB puts
   (each one's synchronous part: its structured clone).
   Memory: the renderer's VmRSS sampled every 100 ms during the run (peak), VmHWM.
   Results: card 2's results hashed (lib.mjs resHash: everything the worker gave, its times
   left out), compared with the first run on show's.
   node speed.mjs <head|bg> [reps, default 5]  → results/speed-<mode>.json */
import { launch, longTasks, puts, med, r1, save, load, sleep, SEM8, DRS } from './lib.mjs';
const [mode = 'bg', reps = '5'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
const A = await app.xrdTab(), B = await app.xrdTab(), C = await app.xrdTab();
const SEM = await app.newTab('sem'); await app.files('sem', await SEM8());
const D = await app.newTab('tauc'); await app.files('tauc', DRS);
await sleep(1500);

// RSS sampled meanwhile (MB), every 100 ms until stopped.
function sampler(){
  let on = true, peak = 0;
  const loop = (async ()=>{ while (on){ const r = await env.renderer(); if (r && r.rss > peak) peak = r.rss; await sleep(100); } })();
  return async ()=>{ on = false; await loop; const r = await env.renderer(); return { peak: Math.round(peak), hwm: r && Math.round(r.hwm) }; };
}
const out = {};
let ref = null;
const put = (k, v)=> (out[k] || (out[k] = [])).push(v);
async function one(kind){
  const tabs = kind === 'two' ? [A, B] : kind === 'three' ? [A, B, C] : [A];
  const away = kind === 'shown' ? null : kind === 'parked-sem' ? SEM : kind === 'parked-xrd' ? B : D;
  const task0 = await env.taskTime(), stop = sampler();
  const t0s = [];
  for (const i of tabs){ await app.show(i); t0s.push(await app.clearAndRefine()); }
  if (away != null) await app.show(away);
  const taskRun0 = await env.taskTime(), tRun0 = await page.evaluate(()=> window.__now());
  const t1s = [];
  for (const i of tabs) t1s.push(away == null ? await app.runEnd() : await app.parkedEnd(i));
  const m = await stop(), task1 = await env.taskTime();
  const T0 = Math.min(...t0s), T1 = Math.max(...t1s);
  const lt = await longTasks(page, tRun0, T1), ps = (await puts(page, T0, T1)).filter(p=> p[2] === 'tabs');
  const hs = [];
  for (const i of tabs) hs.push(await app.resHash(i));
  if (!ref && kind === 'shown') ref = hs[0];
  const v = { each: t0s.map((t, j)=> Math.round(t1s[j] - t)), wall: Math.round(T1 - T0), mainS: +(task1 - task0).toFixed(3), mainRunS: +(task1 - taskRun0).toFixed(3), runS: +((T1 - tRun0)/1000).toFixed(2), long: lt, puts: { n: ps.length, ms: +ps.reduce((a, p)=> a + p[1], 0).toFixed(1), max: +Math.max(0, ...ps.map(p=> p[1])).toFixed(1) },
    rss: m, results: hs.map(h=> h.n), identical: hs.map(h=> !!ref && h.hash === ref.hash && h.len === ref.len) };
  put(kind, v);
  console.log(kind, JSON.stringify(v));
  await app.show(D); await sleep(1000);
}
const kinds = mode === 'head' ? ['shown'] : ['shown', 'parked-xrd', 'parked-sem', 'two', 'three'];
await one('shown');   // (a warm-up: the code compiled, the worker's caches made; not kept)
delete out.shown; ref = null;
for (let r = 0; r < +reps; r++) for (const k of kinds) await one(k);
const sum = Object.fromEntries(Object.entries(out).map(([k, v])=> [k, { n: v.length, eachMed: med(v.flatMap(x=> x.each)), wallMed: med(v.map(x=> x.wall)), mainSMed: med(v.map(x=> x.mainS)),
  mainRunSMed: med(v.map(x=> x.mainRunS)), runSMed: med(v.map(x=> x.runS)),
  longMsMed: med(v.map(x=> x.long.ms)), longMaxMed: med(v.map(x=> x.long.max)), putsNMed: med(v.map(x=> x.puts.n)), putsMsMed: med(v.map(x=> x.puts.ms)), putMaxMed: med(v.map(x=> x.puts.max)),
  rssPeakMed: med(v.map(x=> x.rss.peak)), allIdentical: v.every(x=> x.identical.every(Boolean)), results: [...new Set(v.flatMap(x=> x.results))] }]));
console.log(mode, JSON.stringify(sum, null, 1));
console.log('errors', env.errors);
save(`speed-${mode}.json`, { mode, sum, raw: out, ref, load: load(), errors: env.errors });
await env.close();
