/* Runs in several tabs at once, on each prototype: Refine all (12 patterns, default
   settings, no standard) in K = 1, 2, 3 XRPD tabs at once, a DRS tab on show.
   - bg (option A, bg-runs.patch): each run parked, a worker of its own (no cap);
   - bgpool (bg-runs.patch + pool-on-bg-runs.patch): the pool's cap (3 here) shared by the
     tabs' runs (one realm, one pool), each run's lanes taking what is free;
   - live (option b1, live-tabs.patch): each tab a frame, its run a worker of its own;
   - livepool (live-tabs.patch + pool.patch): each frame its own pool, the cap shared
     between them through Web Locks ('shared'), or each frame its own cap of 3 ('local':
     localStorage 'datatreat-rv-shared' = 'off', so 3 frames make up to 9 workers).
   bg: every tab cleared first, then each shown and its Refine all started in turn (a
   switch parks it, its run going on), the DRS tab shown. live: every frame's Refine all
   started at once from the script (the frames hidden), the DRS tab on show throughout.
   Time: each run from the click on 'Refine without the standard' to its end seen (bg: its
   tab without jobs; live: its card back to Refine, in its frame), in the page's clock;
   'all': from the first click to the last end. One run alone is the K = 1 line. Also the
   renderer's CPU (all threads, its main thread) over the round, the most DedicatedWorker
   threads alive at once and the RSS peak (sampled every 100 ms), the long tasks, and each
   run's results hashed against the first run's (every mode, every round).
   Setup: three XRPD tabs (the 12 patterns, the CIF on card 2), each refined once (warm),
   and a DRS tab. REPS rounds for each K.
   node tabs.mjs [reps, default 5] [modes, default bg,bgpool,live,livepool,livelocal]
     → results/tabs.json */
import { launch, longTasks, med, r2, save, load, sleep, isLive } from './lib.mjs';
const [REPS = '5', MODES = 'bg,bgpool,live,livepool,livelocal'] = process.argv.slice(2);
const out = { runs: {}, method: 'see the head of tabs.mjs' };
let ref = null;
for (const key of MODES.split(',')){
  const mode = key === 'livelocal' ? 'livepool' : key;
  const storage = key === 'livelocal' ? { 'datatreat-rv-shared': 'off' } : {};
  const env = await launch(mode, { storage });
  const { app, page } = env;
  await app.goto();
  const X = [];
  for (let j = 0; j < 3; j++){ const i = await app.xrdTab(); const s = await app.scope(i); await app.clearAndRefine(s); await app.runEnd(s); X.push(i); }
  const D = await app.drsTab();
  await sleep(1500);
  const o = out.runs[key] = { mode, storage, rounds: [] };
  for (const K of [1, 2, 3]){
    for (let r = 0; r < +REPS; r++){
      const tabs = X.slice(0, K);
      const stop = env.sampler(100), c0 = await env.cpu(), task0 = await env.taskTime();
      let t0s, t1s;
      if (isLive(mode)){
        const fs = await Promise.all(tabs.map(i=> app.frame(i)));
        // (cleared first, all of them, then every Refine all at once)
        await Promise.all(fs.map(async f=>{ if (await f.evaluate(()=> !document.querySelector('#xrdR2ClearAll').disabled)){ await f.waitForTimeout(650); await f.evaluate(()=> document.querySelector('#xrdR2ClearAll').click()); } }));
        t0s = await Promise.all(fs.map(f=> app.clearAndRefine(f)));
        t1s = await Promise.all(fs.map(f=> app.runEnd(f)));
      } else {
        for (const i of tabs){ await app.show(i); if (await page.evaluate(()=> !document.querySelector('#xrdR2ClearAll').disabled)){ await page.waitForTimeout(650); await page.evaluate(()=> document.querySelector('#xrdR2ClearAll').click()); await app.settle(); } }
        t0s = [];
        for (const i of tabs){ await app.show(i); t0s.push(await app.clearAndRefine()); }
        await app.show(D);
        t1s = [];
        for (const i of tabs) t1s.push(await app.parkedEnd(i));
      }
      const c1 = await env.cpu(), task1 = await env.taskTime(), m = await stop();
      const T0 = Math.min(...t0s), T1 = Math.max(...t1s);
      const lt = await longTasks(page, T0, T1);
      const hs = [];
      for (const i of tabs) hs.push(await app.resHash(i));
      if (!ref) ref = hs[0];
      const v = { K, each: t0s.map((t, j)=> Math.round(t1s[j] - t)), starts: t0s.map(t=> Math.round(t - T0)), all: Math.round(T1 - T0),
        cpu: { total: r2(c1.total - c0.total), main: r2(c1.main - c0.main) }, mainTask: r2(task1 - task0), threads: m.threads, rssPeak: m.peak, long: lt,
        n: hs.map(h=> h.n), identical: hs.map(h=> h.hash === ref.hash && h.len === ref.len), inOrder: hs.map(h=> h.keys.join() === ref.keys.join()) };
      o.rounds.push(v);
      console.log(key, JSON.stringify(v));
      if (!isLive(mode)) await sleep(300);
      await sleep(1000);
    }
  }
  o.errors = env.errors;
  o.memEnd = await env.mem();
  o.sum = [1, 2, 3].map(K=>{ const rs = o.rounds.filter(v=> v.K === K);
    return { K, eachMed: med(rs.flatMap(v=> v.each)), allMed: med(rs.map(v=> v.all)), staggerMed: med(rs.map(v=> Math.max(...v.starts))), cpuMed: med(rs.map(v=> v.cpu.total)), mainMed: med(rs.map(v=> v.cpu.main)),
      threadsMax: Math.max(...rs.map(v=> v.threads)), rssPeakMed: med(rs.map(v=> v.rssPeak)), longMaxMax: Math.max(...rs.map(v=> v.long.max)),
      identical: rs.every(v=> v.identical.every(Boolean)), inOrder: rs.every(v=> v.inOrder.every(Boolean)) }; });
  console.log(key, 'SUM'); console.table(o.sum);
  if (env.errors.length) console.log('errors', env.errors);
  await env.close();
  await sleep(1500);
}
out.load = load();
save('tabs.json', out);
