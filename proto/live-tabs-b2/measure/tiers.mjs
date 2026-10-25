/* An XRPD tab's three states hidden — awake, trimmed (hidden past tabs.js TRIM_MS: its
   plots and what they are drawn from let go), asleep — each with the memory it holds and
   the time it takes to be shown again: tab A of the 12 patterns refined, tab B blank on
   show. Memory after a forced GC (lib.mjs mem); a switch from the click to two frames
   after the loader is gone, its long tasks with it; the workers' idle time 1 s, so that
   none is left in the numbers. Each state reached again before each switch to it.
   node tiers.mjs [rounds] → results/tiers.json */
import { launch, timedShow, med, save, sleep } from './lib.mjs';
const N = +process.argv[2] || 7;
const { app, page, mem, errors, close } = await launch(process.env.B2_BASE || 'http://127.0.0.1:8993', { knobs: { 'datatreat-rv-idle': '1' } });
await app.xrdRefined();
await app.newTab('xrd');
await sleep(1500);
const out = { memory: {}, show: {}, toB: [] };
out.memory.awake = await mem();
const show = { awake: [], trimmed: [], asleep: [] };
for (let i = 0; i < N; i++){ show.awake.push(await timedShow(page, 0)); out.toB.push(await timedShow(page, 1)); }
await app.tick(61000); out.memory.trimmed = await mem();
for (let i = 0; i < N; i++){ await app.tick(61000); show.trimmed.push(await timedShow(page, 0)); out.toB.push(await timedShow(page, 1)); }
await app.tick(11*60e3); out.memory.asleep = await mem();
for (let i = 0; i < Math.min(N, 5); i++){ await app.tick(11*60e3); show.asleep.push(await timedShow(page, 0)); out.toB.push(await timedShow(page, 1)); }
for (const k in show) out.show[k] = { ms: med(show[k].map(x=> x.ms)), longMs: med(show[k].map(x=> x.longMs)), max: Math.max(...show[k].map(x=> x.ms)), all: show[k] };
out.toB = { ms: med(out.toB.map(x=> x.ms)), max: Math.max(...out.toB.map(x=> x.ms)) };
out.errors = errors;
for (const k in out.memory) console.log(k, JSON.stringify(out.memory[k]), out.show[k].ms, 'ms');
console.log('to B', out.toB, save('tiers.json', out));
await close();
