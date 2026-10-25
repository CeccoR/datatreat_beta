/* Optimisations of live tabs, measured.
   free: SEM tabs that let their decoded images go while hidden (the knob free = seconds
     hidden first; 0 here) against the default (kept): 4 SEM tabs (8 images each), then a DRS
     tab on show; memory 4 s after (lib.mjs mem); then REPS switches to a SEM tab and back,
     the switch to it timed (lib.mjs timedSwitch: its images read again from their bytes and
     drawn, when let go).
   max: at most MAX frames kept (the knob max; the ones shown longest ago let go: their
     state written, the frame removed, made again when shown), against no limit: 8 tabs
     (XRPD refined, SEM, DRS, GC, EPR, XRPD refined, SEM, DRS) opened one after the other,
     then memory and the frames left.
   idle: the CPU time the renderer and the GPU process spend in 20 s with nothing done, 8
     tabs open (as in max; the last, DRS, on show), today's against live tabs: what hidden
     live tabs cost while idle (SystemInfo.getProcessInfo cpuTime).
   node opt.mjs free [reps, default 5] | node opt.mjs max [MAX, default 3] | node opt.mjs idle <head|live>
   → results/opt-free.json, results/opt-max.json, results/opt-idle-<mode>.json */
import { launch, addTab, timedSwitch, med, r1, save, load, sleep } from './lib.mjs';
const [what = 'free', arg] = process.argv.slice(2);
const pick = m => ({ heap: r1(m.heap), rss: r1(m.renderer.rss), pss: r1(m.renderer.pss), workers: m.workers, allPss: r1(m.allPss) });
const out = { what, runs: [] };
if (what === 'free'){
  const reps = +(arg || 5);
  for (const knobs of [{}, { free: 0 }]){
    const env = await launch('live', { knobs });
    const { app, mem } = env;
    await app.goto();
    for (let k = 0; k < 4; k++) await addTab(app, 'sem');
    await addTab(app, 'drs');
    await sleep(4000);
    const m = await mem();
    const ms = [];
    for (let r = 0; r < reps; r++){
      const i = r % 4;
      const t = await timedSwitch(app, i);
      ms.push(t.ms);
      await sleep(600);
      await app.show(4);
      await sleep(1500);
    }
    const run = { knobs, mem: pick(m), switchToSemMed: r1(med(ms)), switchToSem: ms.map(r1), errors: env.errors, load: load() };
    out.runs.push(run);
    console.log('free', JSON.stringify(knobs), JSON.stringify(run));
    await env.close();
  }
} else if (what === 'idle'){
  const mode = arg || 'live';
  const env = await launch(mode);
  const { app, mem } = env;
  await app.goto();
  for (const k of ['xrd', 'sem', 'drs', 'gc', 'epr', 'xrd', 'sem', 'drs']) await addTab(app, k);
  await sleep(5000);
  const bcdp = await env.browser.newBrowserCDPSession();
  const cpu = async ()=> Object.fromEntries((await bcdp.send('SystemInfo.getProcessInfo')).processInfo.map(p=> [p.type + ':' + p.id, p.cpuTime]));
  const a = await cpu(); await sleep(20000); const b = await cpu();
  const by = {};
  for (const k of Object.keys(b)){ const t = k.split(':')[0]; by[t] = r1(((by[t] || 0) + (b[k] - (a[k] || 0)))); }
  const run = { mode, cpuSecondsIn20s: by, mem: pick(await mem()), errors: env.errors, load: load() };
  out.runs.push(run);
  console.log('idle', mode, JSON.stringify(run));
  await env.close();
  save(`opt-idle-${mode}.json`, out);
  process.exit(0);
} else {
  const MAX = +(arg || 3);
  for (const knobs of [{}, { max: MAX }]){
    const env = await launch('live', { knobs });
    const { app, mem, page } = env;
    await app.goto();
    for (const k of ['xrd', 'sem', 'drs', 'gc', 'epr', 'xrd', 'sem', 'drs']) await addTab(app, k);
    await sleep(3000);
    const m = await mem();
    const frames = await page.locator('.live-frames iframe').count();
    const run = { knobs, frames, mem: pick(m), errors: env.errors, load: load() };
    out.runs.push(run);
    console.log('max', JSON.stringify(knobs), JSON.stringify(run));
    await env.close();
  }
}
save(`opt-${what}.json`, out);
