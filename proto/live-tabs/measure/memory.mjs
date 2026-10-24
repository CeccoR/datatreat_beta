/* Memory with N open tabs, today's (HEAD: one live, the others parked) against live tabs
   (one frame each, all live), N = 1, 2, 4, 8, built one tab after the other in one browser
   and measured after tabs 1, 2, 4 and 8 (and at boot, no tab), after a forced GC (lib.mjs mem).
   Scenarios, each tab:
     empty  a blank project, the modules in turn (XRPD, DRS, GC, EPR, SEM, XRPD, DRS, GC);
     xrd    XRPD, the 12 patterns, the SrTiO3 CIF on card 2 (Rietveld), Refine all run to its
            end (12 results; the card's worker kept, as it is after a run);
     sem    SEM, the 8 TIFFs 2048 × 2176, 16-bit.
   node memory.mjs <head|live> <empty|xrd|sem> [Ns, default 1,2,4,8]
   → results/memory-<mode>-<scenario>.json */
import { launch, XRD12, SEM8, med, r1, save, load } from './lib.mjs';
const [mode = 'live', scen = 'empty', ns = '1,2,4,8'] = process.argv.slice(2);
const NS = ns.split(',').map(Number), MAX = Math.max(...NS);
const ROT = ['xrd', 'tauc', 'gc', 'epr', 'sem', 'xrd', 'tauc', 'gc'];
const sem = scen === 'sem' ? await SEM8() : null;
const env = await launch(mode);
const { app, mem } = env;
await app.goto();
await new Promise(r=> setTimeout(r, 1000));
const out = { mode, scenario: scen, load0: load(), boot: await mem(), at: [] , openMs: [] };
console.log(mode, scen, 'boot', JSON.stringify(out.boot));
for (let n = 1; n <= MAX; n++){
  const t0 = Date.now();
  const mod = scen === 'empty' ? ROT[(n - 1) % ROT.length] : scen;
  const i = await app.newTab(mod);
  if (scen === 'xrd'){
    await app.files(i, 'xrd', XRD12);
    await app.cif(i);
    const s = await app.refineAll(i);
    await app.refineDone(s);
    await app.settle(s);
    const k = await app.results(s);
    if (k !== 12) throw new Error('tab ' + n + ': ' + k + ' results');
  } else if (scen === 'sem') await app.files(i, 'sem', sem);
  out.openMs.push(Date.now() - t0);
  if (NS.includes(n)){
    await new Promise(r=> setTimeout(r, 1500));
    const m = await mem();
    out.at.push({ n, ...m });
    console.log(mode, scen, 'N', n, 'heap', r1(m.heap), 'workers', m.workers, r1(m.workerHeap), 'renderer rss/pss', r1(m.renderer.rss), r1(m.renderer.pss), 'all pss', r1(m.allPss), 'dom', m.domNodes);
  }
}
const b = out.boot;
out.perTab = out.at.map(a=> ({ n: a.n, heapPerTab: r1((a.heap - b.heap)/a.n), rssPerTab: r1((a.renderer.rss - b.renderer.rss)/a.n), pssPerTab: r1((a.renderer.pss - b.renderer.pss)/a.n), allPssPerTab: r1((a.allPss - b.allPss)/a.n) }));
out.errors = env.errors; out.load1 = load();
console.log(JSON.stringify(out.perTab));
console.log('errors', env.errors);
save(`memory-${mode}-${scen}.json`, out);
await env.close();
