/* A refinement's speed where it runs, and several at once.
   speed: Refine all (12 patterns, SrTiO3, card 2, without the standard) REPS times in an XRPD
     tab on show (HEAD; live), and with live tabs in that tab hidden behind a DRS tab (its frame
     display:none; with hide=visibility, visibility:hidden and laid out): from the confirm to
     the button back to Refine, in the tab's realm. While hidden, the frame's animation frames
     and setTimeout(0) per second are counted (is a hidden frame throttled?).
   concurrent (live): K XRPD tabs (refined once) each running Refine all at once, K = 1..4
     (the 4 CPUs), REPS rounds: each run's time and the round's; one worker per tab.
   node refine.mjs speed <head|live> [reps, default 5] [display|visibility]
   node refine.mjs concurrent [reps, default 3] [maxK, default 4]
   → results/refine-speed-<mode>[-visibility].json, results/refine-concurrent.json */
import { launch, addTab, refineHidden, runEnd, now, med, r1, save, load, sleep } from './lib.mjs';
const [what = 'speed', ...rest] = process.argv.slice(2);

if (what === 'speed'){
  const [mode = 'live', reps = '5', hide = 'display'] = rest;
  const env = await launch(mode, { knobs: hide === 'visibility' ? { hide: 'visibility' } : {} });
  const { app } = env;
  await app.goto();
  await addTab(app, 'xrd');      // 0 (refined once: warm)
  await addTab(app, 'drs');      // 1
  const out = { mode, hide, shown: [], hidden: [], hiddenRates: [] };
  for (let r = 0; r < +reps; r++){
    const s = await app.show(0);
    await refineHidden(s);
    const t0 = await now(s);
    out.shown.push((await runEnd(s)) - t0);
    await sleep(500);
  }
  if (app.live){
    for (let r = 0; r < +reps; r++){
      await app.show(1);
      const f = await app.frame(0);
      await refineHidden(f);
      const t0 = await now(f);
      // (rates in the hidden frame while it runs: one second each)
      const rates = await f.evaluate(()=> new Promise(res=>{ let a = 0, b = 0; const t = performance.now();
        const fa = ()=>{ a++; if (performance.now() - t < 1000) requestAnimationFrame(fa); }; requestAnimationFrame(fa);
        const fb = ()=>{ b++; if (performance.now() - t < 1000) setTimeout(fb, 0); }; setTimeout(fb, 0);
        setTimeout(()=> res({ raf: a, timeout0: b }), 1100); }));
      out.hiddenRates.push(rates);
      out.hidden.push((await runEnd(f)) - t0);
      await sleep(500);
    }
  }
  out.sum = { shownMed: r1(med(out.shown)), hiddenMed: r1(med(out.hidden)), shown: out.shown.map(r1), hidden: out.hidden.map(r1), rates: out.hiddenRates };
  out.load = load(); out.errors = env.errors;
  console.log(mode, hide, JSON.stringify(out.sum));
  save(`refine-speed-${mode}${hide === 'visibility' ? '-visibility' : ''}.json`, out);
  await env.close();
} else {
  const [reps = '3', maxK = '4'] = rest;
  const env = await launch('live');
  const { app } = env;
  await app.goto();
  for (let k = 0; k < +maxK; k++) await addTab(app, 'xrd');
  await addTab(app, 'drs');     // on show: every XRPD tab hidden
  const frames = [];
  for (let k = 0; k < +maxK; k++) frames.push(await app.frame(k));
  const out = { rounds: [] };
  for (let K = 1; K <= +maxK; K++){
    for (let r = 0; r < +reps; r++){
      await sleep(800);
      const fs = frames.slice(0, K);
      const starts = await Promise.all(fs.map(async f=>{ await refineHidden(f); return now(f); }));
      const ends = await Promise.all(fs.map(f=> runEnd(f)));
      const each = ends.map((e, j)=> e - starts[j]), round = Math.max(...ends) - Math.min(...starts);
      out.rounds.push({ K, rep: r, each: each.map(r1), round: r1(round), load: load() });
      console.log('K', K, 'rep', r, 'each', each.map(x=> Math.round(x)).join(' '), 'round', Math.round(round));
    }
  }
  const byK = {};
  for (const x of out.rounds) (byK[x.K] = byK[x.K] || []).push(x);
  const one = med(byK[1].map(x=> x.round));
  out.sum = Object.entries(byK).map(([K, xs])=> ({ K: +K, roundMed: r1(med(xs.map(x=> x.round))), eachMed: r1(med(xs.flatMap(x=> x.each))),
    throughput: r1(+K*one/med(xs.map(x=> x.round))) }));
  out.errors = env.errors;
  console.table(out.sum);
  save('refine-concurrent.json', out);
  await env.close();
}
