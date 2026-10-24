/* The pool on its bench (bench/: the app's xrd-rv-pool.js lanes, worker and payloads, no
   card): Refine all of the 12 patterns on k workers, for settings the page scripts cannot
   reach (heavy: a free ellipsoid, ΔB and Sr1's occupancy, with the standard's profile; or
   default: the card's), and for the grid of cores × workers (cores.sh runs this under
   taskset). For each k a browser of its own (localStorage 'datatreat-rv-workers' = k):
   a warm-up run (the k workers made, their code compiled, their caches filled), then REPS
   runs with those workers kept: the wall time (from the first job's payload to the last
   result written, in the page), each job's time (from its payload to its result), the
   renderer's CPU (every thread; its DedicatedWorker threads), the main thread meanwhile (a
   fixed 10 ms piece of work every 200 ms: its duration, and the intervals between animation
   frames), the long tasks; memory after a forced GC with the k workers idle, and the RSS
   sampled every 100 ms during the first timed run. The results' signatures (params, esd,
   stats, the CSV table, the widths, the shapes) compared with k = 1's, pattern by pattern.
   Served from the pool tree with this folder's bench/ and fixtures/ copied in as bench/
   (README): BENCH (default http://127.0.0.1:8971/bench/bench.html).
   node bench.mjs [default|heavy] [ks, default 1,2,3,4] [reps, default 5]
     → results/bench-<conf>.json (TAG=cpus2 … : bench-<conf>-cpus2.json) */
import { launch, med, pct, r1, r2, save, load, sleep, cpus } from './lib.mjs';
const [CONF = 'default', KS = '1,2,3,4', REPS = '5'] = process.argv.slice(2);
const URL_ = process.env.BENCH || 'http://127.0.0.1:8971/bench/bench.html';
const all = { conf: CONF, cpus: cpus(), runs: [], method: 'see the head of bench.mjs' };
let ref = null, N = null;
for (const k of KS.split(',').map(Number)){
  const env = await launch('pool', { storage: { 'datatreat-rv-workers': k }, url: URL_ });
  const { page } = env;
  await page.waitForFunction(()=> window.benchReady);
  const hc = await page.evaluate(()=> navigator.hardwareConcurrency);
  if (N == null) N = await page.evaluate(()=> window.calibrate());
  const setup = await page.evaluate(c=> window.setup(c), CONF);
  const mem0 = await env.mem();
  await page.evaluate(n=> window.probeStart(n), N); await sleep(3000);
  const idle = await page.evaluate(()=> window.probeStop());
  const warm = await page.evaluate(()=> window.run());
  const memIdleK = await env.mem();
  const reps = [];
  for (let r = 0; r < +REPS; r++){
    const stop = r === 0 ? env.sampler(100) : null;
    const c0 = await env.cpu();
    await page.evaluate(n=> window.probeStart(n), N);
    const res = await page.evaluate(()=> window.run());
    const pr = await page.evaluate(()=> window.probeStop());
    const c1 = await env.cpu();
    const peak = stop ? await stop() : null;
    reps.push({ wall: Math.round(res.wall), jobs: res.jobs.map(j=> ({ name: j.name, start: Math.round(j.start), ms: Math.round(j.ms), engineMs: j.engineMs, busy: j.busyAtStart, sig: j.sig })),
      order: res.order, longs: res.longs.map(Math.round), peak, cpu: { total: r2(c1.total - c0.total), main: r2(c1.main - c0.main), workers: r2(c1.workers - c0.workers), threads: c1.nw },
      probe: { workMed: r1(med(pr.work)), workP95: r1(pct(pr.work, 0.95)), workMax: r1(Math.max(...pr.work)), frameMed: r1(med(pr.frames)), frameP95: r1(pct(pr.frames, 0.95)), n: pr.work.length } });
    console.log(CONF, all.cpus, 'k', k, 'rep', r, 'wall', Math.round(res.wall), 'cpu', reps[r].cpu.total, 'work med/p95', reps[r].probe.workMed, reps[r].probe.workP95, 'longs', res.longs.length, peak ? 'peak rss ' + peak.peak : '');
  }
  const sigs = warm.jobs.map(j=> j.sig);
  if (!ref) ref = sigs;
  const same = reps.every(r=> r.jobs.every((j, i)=> j.sig === ref[i])) && sigs.every((s, i)=> s === ref[i]);
  const inOrder = reps.every(r=> r.order.join() === [...Array(12).keys()].join());
  reps.forEach(r=> r.jobs.forEach(j=>{ delete j.sig; }));
  const run = { k, hc, setup, warmupWall: Math.round(warm.wall), wallMed: med(reps.map(r=> r.wall)), walls: reps.map(r=> r.wall),
    jobMsMed: med(reps.flatMap(r=> r.jobs.map(j=> j.ms))), jobMs: Object.fromEntries(ref.map((_, i)=> [i, med(reps.map(r=> r.jobs[i].ms))])),
    cpuMed: med(reps.map(r=> r.cpu.total)), cpuWorkersMed: med(reps.map(r=> r.cpu.workers)), cpuMainMed: med(reps.map(r=> r.cpu.main)),
    sameAsK1: same, inOrder, workMed: med(reps.map(r=> r.probe.workMed)), workP95: med(reps.map(r=> r.probe.workP95)), workMax: Math.max(...reps.map(r=> r.probe.workMax)), frameP95: med(reps.map(r=> r.probe.frameP95)),
    idleWorkMed: r1(med(idle.work)), idleFrameP95: r1(pct(idle.frames, 0.95)), longTasks: reps.map(r=> r.longs.length),
    mem0, memIdleK, peak: reps[0].peak, errors: env.errors, reps };
  all.runs.push(run);
  console.log(JSON.stringify({ k, hc, wallMed: run.wallMed, jobMsMed: run.jobMsMed, cpuMed: run.cpuMed, sameAsK1: same, inOrder, workMed: run.workMed, workP95: run.workP95, idleWorkMed: run.idleWorkMed,
    workerHeapsIdle: memIdleK.workerHeaps, rssIdleK: memIdleK.rss, rss0: mem0.rss, peak: run.peak }));
  await env.close();
  await sleep(1500);
}
all.N = N; all.load = load();
const k1 = all.runs[0].wallMed;
all.table = all.runs.map(r=> ({ k: r.k, wall: r.wallMed, speedup: r2(k1/r.wallMed), jobMs: r.jobMsMed, cpu: r.cpuMed, cpuWorkers: r.cpuWorkersMed, use: r2(r.cpuWorkersMed/(r.wallMed/1000)),
  same: r.sameAsK1, inOrder: r.inOrder, workMed: r.workMed, workP95: r.workP95, longTasks: r.longTasks.reduce((a, b)=> a + b, 0), rssIdle: r.memIdleK.rss, rss0: r.mem0.rss, rssPeak: r.peak && r.peak.peak }));
console.table(all.table);
save(`bench-${CONF}.json`, all);
