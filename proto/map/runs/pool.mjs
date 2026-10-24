/* A pool of k workers over the 12 fixtures (a queue, each worker taking the next pattern
   as it is free: what a pooled Refine all would do), CONF's settings. For each k a new
   browser: a warm-up rep (the k workers made, their code compiled, caches filled), then
   REPS reps with those workers kept (warm), the main thread probed meanwhile (a fixed
   10 ms piece of work every 200 ms, and the intervals between frames). Memory after a
   forced GC with the k workers alive, the workers' heaps sampled during a rep, and the
   renderer's peak RSS. Results compared with k = 1's, bit for bit (params, esd, stats,
   the table, the widths, the shapes). */
import { open, save, med, pct, load } from './lib.mjs';
const CONF = process.argv[2] || 'default';
const KS = (process.argv[3] || '1,2,3,4,6,8').split(',').map(Number);
const REPS = +(process.argv[4] || 5);
const OVER = { default: null, heavy: { on: { adp: true, occ: true }, dep: { size: 'ellipsoid', adp: 'overall', occ: 'Sr1' } } }[CONF];
const irf = CONF !== 'default';
const all = { conf: CONF, ks: KS, reps: REPS, runs: [] };
let ref = null, N = null;
for (const k of KS){
  const { browser, page, mem, sampler, errors } = await open();
  if (N == null) N = await page.evaluate(()=> window.calibrate());
  if (irf) await page.evaluate(()=> window.refineStd());
  const mem0 = await mem();
  // idle probe (no job), 3 s
  await page.evaluate(n=> window.probeStart(n), N); await page.waitForTimeout(3000);
  const idle = await page.evaluate(()=> window.probeStop());
  const warm = await page.evaluate(o=> window.bench(o), { k, over: OVER, irf, fresh: true });
  const memIdleK = await mem();
  const reps = [];
  for (let r = 0; r < REPS; r++){
    const stop = r === 0 ? sampler(100) : null;
    await page.evaluate(n=> window.probeStart(n), N);
    const res = await page.evaluate(o=> window.bench(o), { k, over: OVER, irf });
    const pr = await page.evaluate(()=> window.probeStop());
    const peak = stop ? stop() : null;
    reps.push({ wall: res.wall, jobs: res.jobs.map(j=> ({ name: j.name, lane: j.lane, start: j.start, ms: j.ms, sig: j.sig })), longs: res.longs, peak,
      probe: { workMed: med(pr.work), workP95: pct(pr.work, 0.95), frameMed: med(pr.frames), frameP95: pct(pr.frames, 0.95), frameMax: Math.max(...pr.frames), n: pr.work.length } });
    console.log(CONF, 'k', k, 'rep', r, 'wall', res.wall.toFixed(0), 'work med/p95', med(pr.work).toFixed(1), pct(pr.work, 0.95).toFixed(1), 'frame p95', pct(pr.frames, 0.95).toFixed(1), peak ? 'peak heap/worker ' + peak.worker.toFixed(1) + ' sum ' + peak.sumWorkers.toFixed(1) + ' rss ' + peak.rss.toFixed(0) : '');
  }
  const memAfter = await mem();
  const sigs = reps[0].jobs.map(j=> j.sig);
  if (!ref) ref = sigs;
  const same = reps.every(r=> r.jobs.every((j, i)=> j.sig === ref[i])) && warm.jobs.every((j, i)=> j.sig === ref[i]);
  const run = { k, warmupWall: warm.wall, wallMed: med(reps.map(r=> r.wall)), walls: reps.map(r=> r.wall),
    jobMsMed: med(reps.flatMap(r=> r.jobs.map(j=> j.ms))), sameAsK1: same,
    workMed: med(reps.map(r=> r.probe.workMed)), workP95: med(reps.map(r=> r.probe.workP95)), frameP95: med(reps.map(r=> r.probe.frameP95)), frameMax: Math.max(...reps.map(r=> r.probe.frameMax)),
    idleWorkMed: med(idle.work), idleFrameP95: pct(idle.frames, 0.95),
    longTasks: reps.map(r=> r.longs.length),
    mem0, memIdleK, memAfter, peak: reps[0].peak, load: load(), errors, reps };
  all.runs.push(run);
  console.log(JSON.stringify({ k, wallMed: Math.round(run.wallMed), jobMsMed: Math.round(run.jobMsMed), sameAsK1: same, workMed: +run.workMed.toFixed(1), workP95: +run.workP95.toFixed(1), idleWorkMed: +run.idleWorkMed.toFixed(1),
    frameP95: +run.frameP95.toFixed(1), workerHeapsIdle: memIdleK.workerHeaps.map(x=> +x.toFixed(1)), rssIdleK: Math.round(memIdleK.rss), rss0: Math.round(mem0.rss), hwm: Math.round(memAfter.hwm), peak: run.peak }));
  await browser.close();
}
all.N = N;
save(`pool-${CONF}.json`, all);
const k1 = all.runs[0].wallMed;
console.log('k wallMed speedup jobMsMed');
all.runs.forEach(r=> console.log(r.k, Math.round(r.wallMed), (k1/r.wallMed).toFixed(2), Math.round(r.jobMsMed)));
