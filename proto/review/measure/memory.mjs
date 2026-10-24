/* Memory as tabs are added: XRPD refined, XRPD refined, SEM 8 images, DRS, GC, EPR, SEM 8,
   XRPD refined (the user's five modules, two of the heavy ones twice). After each, the tab
   on show is the last one; 2 s idle, then a forced GC (HeapProfiler.collectGarbage ×2) and:
   the JS heap (Runtime.getHeapUsage: the page's isolate, every same-origin frame), the
   renderer's RSS and Private (Private_Clean + Private_Dirty, /proc smaps_rollup: what the
   process alone holds; workers are threads in it), the GPU process's Private, and the sum of
   Private and of PSS over every Chromium process descended from this node process.
   node memory.mjs <tree> */
import { launch, xrdTab, plainTab, sleep, save, DRS, GC, EPR, SEM8 } from './rlib.mjs';
const tree = process.argv[2];
const env = await launch(tree);
const steps = [['none', null], ['xrd', ()=> xrdTab(env)], ['xrd', ()=> xrdTab(env)], ['sem', ()=> plainTab(env, 'sem', SEM8)], ['drs', ()=> plainTab(env, 'tauc', DRS)],
  ['gc', ()=> plainTab(env, 'gc', GC)], ['epr', ()=> plainTab(env, 'epr', EPR)], ['sem', ()=> plainTab(env, 'sem', SEM8)], ['xrd', ()=> xrdTab(env)]];
const rows = [];
for (const [k, fn] of steps){
  if (fn) await fn();
  await sleep(2000);
  const m = await env.mem();
  rows.push({ added: k, ...m });
  console.log(tree, k.padEnd(5), Object.entries(m).map(([a, b])=> a + ' ' + (typeof b === 'number' ? Math.round(b) : b)).join(', '));
}
console.log('errors', env.errors);
save(`memory-${tree}${process.env.TAG ? '-' + process.env.TAG : ''}.json`, { tree, rows, errors: env.errors });
await env.close();
