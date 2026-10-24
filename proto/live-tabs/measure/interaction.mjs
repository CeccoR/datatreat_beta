/* Working in the tab on show while other tabs are open: today's (HEAD: the others parked)
   against live tabs (the others live, their frames hidden), and with live tabs while hidden
   XRPD tabs refine. The tab on show: XRPD, 12 patterns, CIF, refined. Interactions (lib.mjs
   interact): the smoothing width changed (12 patterns smoothed again, both cards drawn, a
   commit) and the next sample (→), REPS each, 300 ms apart, from the event to two frames,
   with the long tasks of every realm meanwhile.
   Phases: 0 other tabs; 3 others (SEM 8 images, XRPD refined, DRS); 7 others (+ GC, EPR, SEM,
   XRPD); then, live only, 1, 2, 3 of the hidden XRPD tabs running Refine all (started again
   whenever one ends, so that they run through the phase), and, both modes, the tab on show's
   own Refine all running.
   node interaction.mjs <head|live> [reps, default 9] → results/interaction-<mode>.json */
import { launch, addTab, refineHidden, interact, longTasks, med, pct, r1, save, load, sleep } from './lib.mjs';
const [mode = 'live', reps = '9'] = process.argv.slice(2);
const env = await launch(mode);
const { app, page } = env;
await app.goto();
await addTab(app, 'xrd');                       // 0: the tab on show
const phases = [];
async function phase(label, extra = {}){
  const s = await app.show(0);
  await sleep(1500);
  const out = { label, ...extra };
  for (const what of ['smooth', 'next']){
    const ms = [], lt = [], ltMax = [];
    for (let r = 0; r < +reps; r++){
      const t = await interact(s, what);
      await sleep(300);
      const l = await longTasks(page, t.t0, t.t0 + t.ms);
      ms.push(t.ms); lt.push(l.ms); ltMax.push(l.max);
    }
    out[what] = { med: r1(med(ms)), p90: r1(pct(ms, 0.9)), max: r1(Math.max(...ms)), longMsMed: med(lt), longMax: Math.max(...ltMax), raw: ms.map(r1) };
  }
  out.load = load();
  phases.push(out);
  console.log(mode, label, 'smooth med/p90/max', out.smooth.med, out.smooth.p90, out.smooth.max, '| next', out.next.med, out.next.p90, out.next.max, '| load', out.load.join(' '));
}
await phase('0 others');
for (const k of ['sem', 'xrd', 'drs']) await addTab(app, k);          // 1 sem, 2 xrd, 3 drs
await phase('3 others');
for (const k of ['gc', 'epr', 'sem', 'xrd']) await addTab(app, k);   // 4 gc, 5 epr, 6 sem, 7 xrd
await phase('7 others');
if (app.live){
  await addTab(app, 'xrd');                                           // 8 xrd
  const xrdTabs = [2, 7, 8];
  const frames = [];
  for (const i of xrdTabs) frames.push(await app.frame(i));
  for (const k of [1, 2, 3]){
    await app.show(0);
    // k hidden tabs refining for the whole phase: each started again as it ends
    let on = true; const runs = [];
    const keep = async f=>{ while (on){ const t0 = Date.now(); await refineHidden(f); await f.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 600000, polling: 100 }); runs.push(Date.now() - t0); } };
    const loops = frames.slice(0, k).map(f=> keep(f).catch(e=> console.log('loop ended:', e.message.split('\n')[0])));
    await sleep(2000);
    await phase(k + ' hidden refining', { hiddenRunning: k });
    on = false;
    await Promise.all(loops);
    phases[phases.length - 1].hiddenRunMs = runs;
  }
}
// The tab on show's own Refine all running (both modes: today's only background work).
{
  const s = await app.show(0);
  let on = true;
  const loop = (async ()=>{ while (on){ await refineHidden(s); await s.waitForFunction(()=> document.querySelector('#xrdR2Refine').textContent === 'Refine', null, { timeout: 600000, polling: 100 }); } })().catch(e=> console.log('own loop ended:', e.message.split('\n')[0]));
  await sleep(2000);
  await phase('own tab refining');
  on = false; await loop;
}
console.log('errors', env.errors);
save(`interaction-${mode}.json`, { mode, phases, errors: env.errors });
await env.close();
