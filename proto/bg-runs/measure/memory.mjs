/* Memory while refinements go on in tabs left (bg), against one on show (head and bg).
   Tabs: A, B, C (XRPD: 12 patterns, the CIF on card 2), D (DRS) on show for the parked runs.
   For k = 0..3 runs (bg; head: 0 and 1 on show): Clear all and Refine all in k XRPD tabs,
   D shown (head: A's run on show), 2 s on, then after a forced GC (twice) the page's JS heap,
   the workers alive and their heaps, the renderer's VmRSS; the RSS sampled every 100 ms to
   the runs' end (peak); after the end, the same again.
   node memory.mjs <head|bg> [reps, default 3]  → results/memory-<mode>.json */
import { launch, med, r1, save, load, sleep, DRS } from './lib.mjs';
const [mode = 'bg', reps = '3'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
const A = await app.xrdTab(), B = await app.xrdTab(), C = await app.xrdTab();
const D = await app.newTab('tauc'); await app.files('tauc', DRS);
await sleep(1500);
const out = {};
const ks = mode === 'head' ? [0, 1] : [0, 1, 2, 3];
for (let r = 0; r < +reps; r++) for (const k of ks){
  const tabs = [A, B, C].slice(0, k);
  for (const i of tabs){ await app.show(i); await app.clearAndRefine(); }
  const onShow = mode === 'head' && k === 1;
  if (!onShow) await app.show(D);
  await sleep(2000);
  const during = await env.mem();
  let peak = during.rss, on = true;
  const loop = (async ()=>{ while (on){ const x = await env.renderer(); if (x && x.rss > peak) peak = x.rss; await sleep(100); } })();
  for (const i of tabs){ if (onShow) await app.runEnd(); else await app.parkedEnd(i); }
  on = false; await loop;
  await sleep(1000);
  const after = await env.mem();
  const v = { during: { heap: r1(during.heap), workers: during.workers, workerHeap: r1(during.workerHeap), rss: Math.round(during.rss) }, peak: Math.round(peak),
    after: { heap: r1(after.heap), workers: after.workers, rss: Math.round(after.rss), hwm: Math.round(after.hwm) } };
  (out[k] || (out[k] = [])).push(v);
  console.log(k, JSON.stringify(v));
  await app.show(D); await sleep(800);
}
const sum = Object.fromEntries(Object.entries(out).map(([k, v])=> [k, { rssDuring: med(v.map(x=> x.during.rss)), heapDuring: med(v.map(x=> x.during.heap)), workersDuring: med(v.map(x=> x.during.workers)),
  workerHeapDuring: med(v.map(x=> x.during.workerHeap)), rssPeak: med(v.map(x=> x.peak)), rssAfter: med(v.map(x=> x.after.rss)), workersAfter: med(v.map(x=> x.after.workers)) }]));
console.log(mode, JSON.stringify(sum, null, 1));
console.log('errors', env.errors);
save(`memory-${mode}.json`, { mode, sum, raw: out, load: load(), errors: env.errors });
await env.close();
