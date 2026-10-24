/* The pool of Rietveld workers in the app (bg-runs-pool.patch): Refine all of the 12
   patterns (default settings, no standard) on k = 1..4 workers (localStorage
   'datatreat-rv-workers' = k, a page of its own for each k), on show, parked (its tab left
   at once for a DRS tab), and two tabs at once parked (A and B, the DRS tab on show: the k
   workers shared by both runs).
   Time, main thread, memory and results as speed.mjs (from the click on 'Refine without the
   standard' to the run seen ended; results hashed, compared with k = 1 on show's).
   node pool.mjs [reps, default 5] [ks, default 1,2,3,4]  → results/pool.json */
import { launch, longTasks, med, r1, save, load, sleep, DRS } from './lib.mjs';
const [reps = '5', ksArg = '1,2,3,4'] = process.argv.slice(2);
const ks = ksArg.split(',').map(Number);
const out = {};
let ref = null;
for (const k of ks){
  const env = await launch('pool', { storage: { 'datatreat-rv-workers': k } });
  const { app, page } = env;
  await app.goto();
  const A = await app.xrdTab(), B = await app.xrdTab();
  const D = await app.newTab('tauc'); await app.files('tauc', DRS);
  await sleep(1500);
  const sampler = ()=>{ let on = true, peak = 0; const loop = (async ()=>{ while (on){ const r = await env.renderer(); if (r && r.rss > peak) peak = r.rss; await sleep(100); } })();
    return async ()=>{ on = false; await loop; return Math.round(peak); }; };
  async function one(kind, keep = true){
    const tabs = kind === 'two' ? [A, B] : [A];
    const stop = sampler();
    const t0s = [];
    for (const i of tabs){ await app.show(i); t0s.push(await app.clearAndRefine()); }
    if (kind !== 'shown') await app.show(D);
    const task0 = await env.taskTime(), tRun0 = await page.evaluate(()=> window.__now());
    const t1s = [];
    for (const i of tabs) t1s.push(kind === 'shown' ? await app.runEnd() : await app.parkedEnd(i));
    const peak = await stop(), task1 = await env.taskTime();
    const lt = await longTasks(page, tRun0, Math.max(...t1s));
    const hs = []; for (const i of tabs) hs.push(await app.resHash(i));
    if (!ref && k === 1 && kind === 'shown' && keep) ref = hs[0];
    const v = { each: t0s.map((t, j)=> Math.round(t1s[j] - t)), wall: Math.round(Math.max(...t1s) - Math.min(...t0s)), mainRunS: +(task1 - task0).toFixed(3), long: lt, rssPeak: peak,
      results: hs.map(h=> h.n), identical: hs.map(h=> !!ref && h.hash === ref.hash && h.len === ref.len) };
    if (keep) (out[k + ' ' + kind] || (out[k + ' ' + kind] = [])).push(v);
    console.log(k, kind, JSON.stringify(v));
    await app.show(D); await sleep(1000);
  }
  await one('shown', false);   // (a warm-up: the code compiled, the workers made)
  for (let r = 0; r < +reps; r++) for (const kind of ['shown', 'parked', 'two']) await one(kind);
  out[k + ' workers'] = await env.mem();
  if (env.errors.length) console.log('errors', k, env.errors);
  out[k + ' errors'] = env.errors;
  await env.close();
}
const sum = Object.fromEntries(Object.entries(out).filter(([, v])=> Array.isArray(v) && v.length && v[0].each).map(([key, v])=> [key, { n: v.length, eachMed: med(v.flatMap(x=> x.each)), wallMed: med(v.map(x=> x.wall)),
  mainRunSMed: med(v.map(x=> x.mainRunS)), longMaxMed: med(v.map(x=> x.long.max)), rssPeakMed: med(v.map(x=> x.rssPeak)), allIdentical: v.every(x=> x.identical.every(Boolean)) }]));
console.log(JSON.stringify(sum, null, 1));
save('pool.json', { sum, raw: out, ref, load: load() });
