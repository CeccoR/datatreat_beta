/* The pool in the app (pool.patch on HEAD): Refine all of the 12 patterns (default
   settings, no standard), on show, on k workers (localStorage 'datatreat-rv-workers' = k;
   a browser of its own for each k), against HEAD (today: the card's one worker).
   For each tree and k, in one XRPD tab (the 12 patterns, the CIF on card 2) and a DRS tab:
   - a first run (cold: the workers made, their code compiled), then a probe run, untimed,
     whose progress is sampled every 100 ms (the bar, the status line, the results written
     and their keys: the patterns' order at every instant, never a gap), then REPS runs
     (Clear all, Refine all) timed: from the click on 'Refine without the standard' to the
     card's button back to Refine; the renderer's CPU over each run (every thread, its main
     thread, its DedicatedWorker threads); the main thread's busy time (CDP TaskDuration);
     the long tasks; the results hashed and their keys, against HEAD's first run;
   - memory after a forced GC with the workers idle (each worker's heap, the renderer's
     RSS) and the RSS sampled every 100 ms during the first timed run (peak).
   node pool.mjs [reps, default 5] [list, default head,1,2,3,4] → results/pool.json */
import { launch, longTasks, med, r1, r2, save, load, sleep } from './lib.mjs';
const [reps = '5', list = 'head,1,2,3,4'] = process.argv.slice(2);
const out = { runs: {}, method: 'see the head of pool.mjs' };
let ref = null;
const NAMES = Array.from({ length: 12 }, (_, i)=> 's' + String(i).padStart(2, '0') + '.xrdml');
for (const key of list.split(',')){
  const mode = key === 'head' ? 'head' : 'pool', k = key === 'head' ? 1 : +key;
  const env = await launch(mode, { storage: mode === 'pool' ? { 'datatreat-rv-workers': k } : {} });
  const { app, page } = env;
  await app.goto();
  await app.drsTab();
  const A = await app.xrdTab();
  await sleep(1000);
  const o = out.runs[key] = { mode, k, runs: [] };
  async function one(kind){
    const c0 = await env.cpu(), task0 = await env.taskTime(), stop = kind === 'rep0' ? env.sampler(100) : null;
    let samples = null;
    if (kind === 'probe') await page.evaluate(()=>{ window.__prog = []; window.__progIv = setInterval(()=>{
      const st = window.__u.getModuleState('xrd'), c = st.cards.find(c=> c.id === 2), r = (c.states.rietveld || {}).results || {};
      window.__prog.push({ t: window.__now(), bar: parseFloat(document.querySelector('#xrdR2ProgBar').style.width) || 0, status: document.querySelector('#xrdR2Status').textContent, keys: Object.keys(r) });
    }, 100); });
    const t0 = await app.clearAndRefine();
    const t1 = await app.runEnd();
    if (kind === 'probe') samples = await page.evaluate(()=>{ clearInterval(window.__progIv); return window.__prog; });
    const c1 = await env.cpu(), task1 = await env.taskTime(), peak = stop ? await stop() : null;
    const lt = await longTasks(page, t0, t1), h = await app.resHash(A);
    if (!ref && kind === 'cold') ref = h;
    const wall = t1 - t0;
    const v = { kind, wall: Math.round(wall), cpu: { total: r2(c1.total - c0.total), main: r2(c1.main - c0.main), workers: r2(c1.workers - c0.workers), threads: c1.nw },
      mainTask: r2(task1 - task0), long: lt, n: h.n, inOrder: h.keys.join() === NAMES.slice(0, h.n).join(), identical: !!ref && h.hash === ref.hash && h.len === ref.len, peak };
    if (samples){
      // (the progress bar never goes back; the results written are always the first m of the patterns)
      // (while it runs: from the first sample with the bar shown to the last; the bar goes as the run ends)
      const on = samples.map(x=> x.bar), a = on.findIndex(b=> b > 0), b = on.length - 1 - [...on].reverse().findIndex(b=> b > 0), bars = a < 0 ? [] : on.slice(a, b + 1);
      v.progress = { n: samples.length, monotonic: bars.every((b, i)=> i === 0 || b >= bars[i - 1] - 1e-9), prefix: samples.every(x=> x.keys.join() === NAMES.slice(0, x.keys.length).join()),
        statuses: [...new Set(samples.map(x=> x.status.replace(/\d+ of 12 done/, 'N of 12 done').replace(/s\d\d/g, 'sNN')))].slice(0, 12),
        sample: samples.filter((x, i)=> i % 5 === 0).map(x=> ({ t: Math.round(x.t - t0), bar: r1(x.bar), status: x.status, written: x.keys.length })) };
    }
    o.runs.push(v);
    console.log(key, kind, JSON.stringify({ ...v, progress: v.progress && { ...v.progress, sample: undefined } }));
    await sleep(800);
  }
  await one('cold');
  await one('probe');
  for (let r = 0; r < +reps; r++) await one('rep' + r);
  o.memIdle = await env.mem();
  o.errors = env.errors;
  const reps_ = o.runs.filter(x=> x.kind.startsWith('rep'));
  o.sum = { k, cold: o.runs[0].wall, wallMed: med(reps_.map(x=> x.wall)), walls: reps_.map(x=> x.wall), cpuTotalMed: med(reps_.map(x=> x.cpu.total)), cpuMainMed: med(reps_.map(x=> x.cpu.main)),
    cpuWorkersMed: med(reps_.map(x=> x.cpu.workers)), mainTaskMed: med(reps_.map(x=> x.mainTask)), longMsMed: med(reps_.map(x=> x.long.ms)), longMaxMax: Math.max(...reps_.map(x=> x.long.max)),
    allIdentical: o.runs.every(x=> x.identical), allInOrder: o.runs.every(x=> x.inOrder), progress: o.runs[1].progress && { monotonic: o.runs[1].progress.monotonic, prefix: o.runs[1].progress.prefix },
    rssIdle: o.memIdle.rss, workersIdle: o.memIdle.workers, workerHeaps: o.memIdle.workerHeaps, peak: reps_[0].peak };
  console.log(key, 'SUM', JSON.stringify(o.sum));
  if (env.errors.length) console.log('errors', env.errors);
  await env.close();
  await sleep(1500);
}
const k1 = out.runs['1'] ? out.runs['1'].sum.wallMed : null, hd = out.runs.head ? out.runs.head.sum.wallMed : null;
out.table = Object.values(out.runs).map(r=> ({ key: r.mode === 'head' ? 'head' : r.k, wall: r.sum.wallMed, cold: r.sum.cold, speedupVsHead: hd && r2(hd/r.sum.wallMed), speedupVsK1: k1 && r2(k1/r.sum.wallMed),
  cpu: r.sum.cpuTotalMed, cpuWorkers: r.sum.cpuWorkersMed, cpuMain: r.sum.cpuMainMed, workerUse: r2(r.sum.cpuWorkersMed/(r.sum.wallMed/1000)), mainTask: r.sum.mainTaskMed, longMs: r.sum.longMsMed, longMax: r.sum.longMaxMax,
  rssIdle: r.sum.rssIdle, workersIdle: r.sum.workersIdle, rssPeak: r.sum.peak && r.sum.peak.peak, identical: r.sum.allIdentical, inOrder: r.sum.allInOrder, progress: r.sum.progress }));
console.table(out.table);
out.load = load();
save('pool.json', out);
