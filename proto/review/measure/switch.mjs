/* Switching, by real mouse clicks on the tab bar: from the pointerdown's timestamp to two
   frames in the realm shown (rlib timedSwitch), and the long tasks of every realm meanwhile.
   Tabs: A, B XRPD (12 patterns, CIF, refined), C SEM (8 × 2048×2176 16-bit), D DRS.
   Each round: A→B, B→C, C→A, A→D, D→B, B→A. node switch.mjs <tree> [rounds=7] */
import { launch, xrdTab, plainTab, timedSwitch, longTasks, show, sleep, stats, save, loadavg, DRS, SEM8 } from './rlib.mjs';
const [tree, rounds = '7'] = process.argv.slice(2);
const env = await launch(tree);
const A = await xrdTab(env), B = await xrdTab(env), C = await plainTab(env, 'sem', SEM8), D = await plainTab(env, 'tauc', DRS);
const name = { [A]: 'A', [B]: 'B', [C]: 'C', [D]: 'D' };
const kind = { A: 'xrd', B: 'xrd', C: 'sem', D: 'drs' };
await show(env, A);   // every frame made, A on show
await sleep(1500);
const seq = [B, C, A, D, B, A];
let cur = A;
const by = {};
for (let r = 0; r < +rounds; r++){
  for (const to of seq){
    const t = await timedSwitch(env, to);
    await sleep(500);
    const lt = await longTasks(env.page, t.t0, t.t1);
    const key = kind[name[cur]] + '→' + kind[name[to]] + (name[cur] === 'A' && name[to] === 'B' || name[cur] === 'B' && name[to] === 'A' ? ' (other XRPD)' : '');
    (by[key] = by[key] || { ms: [], lt: [], ltMax: [] });
    by[key].ms.push(t.ms); by[key].lt.push(lt.sum); by[key].ltMax.push(lt.max);
    cur = to;
    await sleep(400);
  }
}
const sum = Object.fromEntries(Object.entries(by).map(([k, v])=> [k, { ...stats(v.ms), longSumMed: stats(v.lt).med, longMaxMax: Math.max(...v.ltMax) }]));
for (const [k, v] of Object.entries(sum)) console.log(tree, k.padEnd(22), JSON.stringify(v));
console.log('errors', env.errors, 'load', loadavg());
save(`switch-${tree}.json`, { tree, sum, raw: by, errors: env.errors });
await env.close();
