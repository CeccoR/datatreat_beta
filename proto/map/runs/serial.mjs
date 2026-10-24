/* One worker, its jobs serial (as xrd-rv.js runs a card's Refine all today): the 12
   fixtures with SrTiO3, CONF's settings. Rep 1 in a new worker (cold: module load, compile,
   empty caches), reps 2..REPS in the same one (warm, as a card keeps its worker); then a
   run with a new worker for each job (perJobFresh). Memory after a forced GC with the warm
   worker alive, and the worker's heap sampled (no GC) during a rep. */
import { open, save, med, load } from './lib.mjs';
const CONF = process.argv[2] || 'default';
const REPS = +(process.argv[3] || 5);
const OVER = { default: null, heavy: { on: { adp: true, occ: true }, dep: { size: 'ellipsoid', adp: 'overall', occ: 'Sr1' } }, wppm: { on: { wppm: true } } }[CONF];
const irf = CONF !== 'default';
const { browser, page, mem, sampler, errors } = await open();
const out = { conf: CONF, over: OVER, irf, load0: load(), mem0: await mem(), reps: [], std: [] };
if (irf){ for (let i = 0; i < REPS; i++){ const s = await page.evaluate(()=> window.refineStd()); out.std.push(s.ms); } out.irfUsed = (await page.evaluate(()=> window.refineStd())).irf; }
for (let r = 0; r < REPS; r++){
  const stop = r === 1 ? sampler(100) : null;
  const res = await page.evaluate(o=> window.bench(o), { k: 1, over: OVER, irf, fresh: r === 0 });
  const peak = stop ? stop() : null;
  out.reps.push({ wall: res.wall, jobs: res.jobs.map(j=> ({ name: j.name, ms: j.ms, engineMs: j.engineMs, nprog: j.nprog, resBytes: j.resBytes, payBytes: j.payBytes, sig: j.sig })), longs: res.longs, peak });
  console.log(CONF, 'rep', r, r === 0 ? 'cold' : 'warm', 'wall', res.wall.toFixed(0), peak ? 'peak worker heap ' + peak.worker.toFixed(1) + ' MB, rss ' + peak.rss.toFixed(0) : '');
}
out.memWarm = await mem();
const fr = await page.evaluate(o=> window.bench(o), { k: 1, over: OVER, irf, perJobFresh: true });
out.perJobFresh = { wall: fr.wall, jobs: fr.jobs.map(j=> ({ name: j.name, ms: j.ms, sig: j.sig })) };
await page.evaluate(()=> window.killAll());
await new Promise(r=> setTimeout(r, 500));
out.memAfterKill = await mem();
out.load1 = load(); out.errors = errors;
// Summary: per pattern the median of the warm reps; cold rep; per-job-fresh.
const names = out.reps[0].jobs.map(j=> j.name);
const warm = names.map((n, i)=> med(out.reps.slice(1).map(r=> r.jobs[i].ms)));
const sum = {
  conf: CONF, wallCold: out.reps[0].wall, wallWarmMed: med(out.reps.slice(1).map(r=> r.wall)), wallPerJobFresh: fr.wall,
  perPatternWarmMed: Object.fromEntries(names.map((n, i)=> [n, Math.round(warm[i])])),
  perPatternCold: Object.fromEntries(names.map((n, i)=> [n, Math.round(out.reps[0].jobs[i].ms)])),
  perPatternFresh: Object.fromEntries(names.map((n, i)=> [n, Math.round(fr.jobs[i].ms)])),
  engineMsWarmMed: med(out.reps.slice(1).flatMap(r=> r.jobs.map(j=> j.engineMs))),
  progressMsgsPerJobMed: med(out.reps.flatMap(r=> r.jobs.map(j=> j.nprog))),
  payBytes: out.reps[0].jobs[0].payBytes, resBytesMed: med(out.reps[0].jobs.map(j=> j.resBytes)),
  stdMsMed: out.std.length ? med(out.std) : null,
  deterministic: names.map((n, i)=> new Set([...out.reps.map(r=> r.jobs[i].sig), fr.jobs[i].sig]).size).every(c=> c === 1),
  mem0: out.mem0, memWarm: out.memWarm, memAfterKill: out.memAfterKill, peakDuringRep: out.reps[1] && out.reps[1].peak, load0: out.load0, load1: out.load1, errors,
};
out.summary = sum;
save(`serial-${CONF}.json`, out);
console.log(JSON.stringify(sum, null, 1));
await browser.close();
