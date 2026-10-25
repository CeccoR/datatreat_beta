/* Switching tabs, today's (HEAD: the state parked, the next one restored) against live tabs
   (a frame hidden, another shown). Five tabs, each loaded first: XRPD (12 patterns, CIF,
   refined), SEM (8 × 2048² 16-bit), DRS (2), GC (2), EPR (1). Then REPS rounds, each showing
   the five in turn; each switch timed from the click on its tab (dispatched in the page) to
   two animation frames in the realm that shows it, its loader gone (lib.mjs timedSwitch),
   with the long tasks of every realm meanwhile.
   node switch.mjs <head|live> [reps, default 7] [hide: display|visibility]
   → results/switch-<mode>[-visibility].json */
import { launch, addTab, timedSwitch, longTasks, med, pct, r1, save, load, sleep } from './lib.mjs';
const [mode = 'live', reps = '7', hide = 'display'] = process.argv.slice(2);
const KINDS = ['xrd', 'sem', 'drs', 'gc', 'epr'];
const env = await launch(mode, { knobs: hide === 'visibility' ? { hide: 'visibility' } : {} });
const { app, page } = env;
await app.goto();
for (const k of KINDS) await addTab(app, k);
await sleep(1500);
const by = Object.fromEntries(KINDS.map(k=> [k, { ms: [], long: [], longMax: [] }]));
let cur = KINDS.length - 1;
for (let r = 0; r < +reps; r++){
  for (let j = 0; j < KINDS.length; j++){
    if (j === cur) continue;
    const t = await timedSwitch(app, j);
    await sleep(400);
    const lt = await longTasks(page, t.t0, t.t1);
    by[KINDS[j]].ms.push(t.ms); by[KINDS[j]].long.push(lt.ms); by[KINDS[j]].longMax.push(lt.max);
    if (t.made) console.log('warning: a frame made by the switch to', KINDS[j]);
    cur = j;
    await sleep(400);
  }
}
const sum = Object.fromEntries(Object.entries(by).map(([k, v])=> [k, { n: v.ms.length, med: r1(med(v.ms)), p90: r1(pct(v.ms, 0.9)), max: r1(Math.max(...v.ms)), longMsMed: med(v.long), longMaxMed: med(v.longMax) }]));
console.log(mode, hide, JSON.stringify(sum));
console.log('errors', env.errors);
save(`switch-${mode}${hide === 'visibility' ? '-visibility' : ''}.json`, { mode, hide, sum, raw: by, load: load(), errors: env.errors });
await env.close();
