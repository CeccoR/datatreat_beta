/* Working in the XRPD tab while its own Refine all runs on k workers (pool.patch), against
   HEAD (one worker) and against nothing running. The tab: the 12 patterns, the CIF on card
   2, refined once (the workers warm). Interactions, alternately: the next sample (→: both
   cards drawn) and the smoothing width of card 1 set to the other of 0.25 and 0.30° (the
   12 patterns smoothed again, both cards drawn, a commit); each from the event to two
   animation frames, with the long tasks that started in it; N of each, 300 ms apart, and
   for 'run' only while the run goes on (one that ended is started again: Clear all,
   Refine all). A browser of its own for each tree and k.
   node interact.mjs [n, default 12] [list, default head,1,2,3,4] → results/interact.json */
import { launch, interact, longTasks, med, pct, r1, save, load, sleep } from './lib.mjs';
const [N = '12', list = 'head,1,2,3,4'] = process.argv.slice(2);
const out = {};
const running = page => page.evaluate(()=> document.querySelector('#xrdR2Refine').textContent === 'Cancel');
for (const key of list.split(',')){
  const mode = key === 'head' ? 'head' : 'pool', k = key === 'head' ? 1 : +key;
  const env = await launch(mode, { storage: mode === 'pool' ? { 'datatreat-rv-workers': k } : {} });
  const { app, page } = env;
  await app.goto();
  await app.xrdTab();
  await app.clearAndRefine(); await app.runEnd(); await app.settle();
  await sleep(1500);
  for (const cond of ['none', 'run']){
    const v = out[key + ' ' + cond] = { next: [], smooth: [], longNext: [], longSmooth: [], restarts: 0 };
    while (v.next.length < +N || v.smooth.length < +N){
      if (cond === 'run' && !await running(page)){ v.restarts++; await app.clearAndRefine(); await sleep(300); continue; }
      const what = v.next.length <= v.smooth.length ? 'next' : 'smooth';
      const t = await interact(page, what);
      await sleep(120);
      // (a run that ended meanwhile: the sample is not of this condition)
      if (cond === 'run' && !await running(page)) continue;
      const lt = await longTasks(page, t.t0, t.t0 + t.ms);
      v[what].push(t.ms); v[what === 'next' ? 'longNext' : 'longSmooth'].push(lt.ms);
      await sleep(300);
    }
    console.log(key, cond, 'next', r1(med(v.next)), r1(pct(v.next, 0.9)), r1(Math.max(...v.next)), 'smooth', r1(med(v.smooth)), r1(pct(v.smooth, 0.9)), r1(Math.max(...v.smooth)), 'restarts', v.restarts);
  }
  if (await running(page)) await app.runEnd();
  out[key + ' errors'] = env.errors;
  await env.close();
  await sleep(1500);
}
const sum = Object.fromEntries(Object.entries(out).filter(([, v])=> v.next).map(([k, v])=> [k, { next: { n: v.next.length, med: r1(med(v.next)), p90: r1(pct(v.next, 0.9)), max: r1(Math.max(...v.next)), longMed: med(v.longNext) },
  smooth: { n: v.smooth.length, med: r1(med(v.smooth)), p90: r1(pct(v.smooth, 0.9)), max: r1(Math.max(...v.smooth)), longMed: med(v.longSmooth) }, restarts: v.restarts }]));
console.log(JSON.stringify(sum, null, 1));
save('interact.json', { sum, raw: out, load: load() });
