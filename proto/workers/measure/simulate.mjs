/* From the grid of cores × workers measured here (bench.mjs under cores.sh: n = 1..4 CPUs)
   to 8, 12 and 16 cores: a model fitted on the grid, checked against every point of it,
   then run for more cores. No measurement of its own: it reads results/bench-*.json.
   The model, for k workers on n cores and the 12 patterns of a Refine all:
   - each job takes its own time alone (k = 1, its median over the reps: t_j) times a
     slowdown s(k, n) = (1 + c·(min(k, n) − 1)) · max(1, (k + m)/n): c the cost of each
     other worker running at once (shared caches, memory, the clock), m the cores the page's
     own threads take meanwhile (its main thread, the compositor, the GC), so that past
     n − m the workers share the cores. c and m are fitted together on the median job's
     slowdown against k = 1 on the same CPUs, at every point of the grid (least squares of
     its logarithm);
   - the jobs are taken in the patterns' order by min(k, 12) lanes (the pool's lanes), each
     the next as it is free; the wall time is the last end, plus o (the run's own start and
     end, fitted on k = 1).
   Out: the model against each measured point (the error), then the wall time and the
   speed-up for n = 2, 4, 8, 12, 16 with the cap n − 1 (the pool's default), beside: c = 0
   (no contention: the best case), the lanes balanced (the fewest that give the same rounds
   of 12: an optimisation weighed, not built), the cap n, n/2; default and heavy settings
   (heavy jobs' c fitted on their own points: they contend less).
   node simulate.mjs → results/simulate.json (and its text) */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS, med, r2 } from './lib.mjs';
const read = n =>{ try { return JSON.parse(fs.readFileSync(path.join(RESULTS, n), 'utf8')); } catch(e){ return null; } };
const grid = {};
for (const n of [1, 2, 3, 4]){ const b = read(`bench-default-cpus${n}.json`); if (b) grid[n] = b; }
const heavy = read('bench-heavy.json');
if (!grid[4]) throw new Error('results/bench-default-cpus4.json is needed (cores.sh)');
const kOf = (b, k)=> b.runs.find(r=> r.k === k);
const jobs = b => Object.values(kOf(b, 1).jobMs);           // t_j at k = 1, in the patterns' order
const mOf = b =>{ const r = kOf(b, 1); return (r.cpuMed - r.cpuWorkersMed)/(r.wallMed/1000); };
function makespan(t, lanes){
  const free = Array(lanes).fill(0);
  for (const x of t){ let i = 0; for (let j = 1; j < lanes; j++) if (free[j] < free[i]) i = j; free[i] += x; }
  return Math.max(...free);
}
// (t measured with one worker on n0 CPUs: the slowdown relative to that)
const model = (t, o, c, m, n0 = 4)=> (k, n)=>{ const sl = slow(k, n, c, m)/slow(1, n0, c, m); return makespan(t.map(x=> x*sl), Math.min(k, t.length)) + o; };
// The fit: c and m on every point's median job against its k = 1 (a grid search), o from
// k = 1 on 4 CPUs.
const slow = (k, n, c, m)=> (1 + c*(Math.min(k, n) - 1))*Math.max(1, (k + m)/n);
const t4 = jobs(grid[4]);
const o = kOf(grid[4], 1).wallMed - t4.reduce((a, b)=> a + b, 0);
const pts = [];
for (const [n, b] of Object.entries(grid)) for (const r of b.runs) if (r.k > 1) pts.push({ n: +n, k: r.k, s: r.jobMsMed/kOf(b, 1).jobMsMed });
let best = null;
for (let c = 0; c <= 0.4; c += 0.005) for (let m = 0; m <= 1.5; m += 0.01){
  const e = pts.reduce((a, p)=> a + Math.log(slow(p.k, p.n, c, m)/slow(1, p.n, c, m)/p.s)**2, 0);
  if (!best || e < best.e) best = { c, m, e };
}
const c = best.c, m = best.m;
const mMeasured = med(Object.values(grid).map(mOf));
const f = model(t4, o, c, m);
const check = [];
for (const [n, b] of Object.entries(grid)) for (const r of b.runs){
  // (on n CPUs the jobs alone are those of k = 1 there: a slower or faster core shows in t)
  const tn = jobs(b), on = kOf(b, 1).wallMed - tn.reduce((a, x)=> a + x, 0);
  const p = model(tn, on, c, m, +n)(r.k, +n), p4 = f(r.k, +n);
  check.push({ n: +n, k: r.k, measured: r.wallMed, predicted: Math.round(p), err: r2((p - r.wallMed)/r.wallMed*100), fromN4: Math.round(p4), errFromN4: r2((p4 - r.wallMed)/r.wallMed*100) });
}
const lines = [];
const fmt = x => (x/1000).toFixed(2) + ' s';
lines.push(`Fitted on the grid (default settings, ${pts.length} points k > 1): c = ${r2(c)} (each job's slowdown per other worker running), m = ${r2(m)} core (the page's own threads; measured on the bench page at k = 1: ${r2(mMeasured)}), o = ${Math.round(o)} ms. The jobs' slowdown, measured / model: ${pts.map(p=> `${p.n}:${p.k} ${r2(p.s)}/${r2(slow(p.k, p.n, c, m)/slow(1, p.n, c, m))}`).join(', ')} (CPUs:k).`);
lines.push('', '| CPUs | k | measured | model (fitted on that n\'s k = 1) | error | model from 4 CPUs\' jobs | error |', '|---|---|---|---|---|---|---|');
for (const x of check) lines.push(`| ${x.n} | ${x.k} | ${fmt(x.measured)} | ${fmt(x.predicted)} | ${x.err} % | ${fmt(x.fromN4)} | ${x.errFromN4} % |`);
// The lanes a run of 12 takes under a cap: the cap (xrd-rv-pool.js), or (balanced, weighed
// here only) the fewest that give the same number of rounds, ceil(12/ceil(12/cap)): 7 → 6,
// 11 → 6, 5 → 4.
const balanced = cap => Math.ceil(12/Math.ceil(12/Math.min(cap, 12)));
const pred = (t, oo, cc, label)=>{
  const M = model(t, oo, cc, m), Z = model(t, oo, 0, m), one = M(1, 4);
  lines.push('', `${label}: one worker ${fmt(one)}; c = ${r2(cc)}.`, '',
    '| cores n | cap n − 1 = lanes | rounds of 12 | wall, speed-up (c as fitted) | c = 0 (no contention) | lanes balanced (fewest for the same rounds) | cap n | cap n/2 |', '|---|---|---|---|---|---|---|---|');
  const out = [];
  for (const n of [2, 4, 8, 12, 16]){
    const cap = Math.max(1, n - 1), k = Math.min(cap, 12), a = M(k, n), z = Z(k, n), bl = M(balanced(cap), n), bn = M(Math.min(n, 12), n), h = M(Math.min(Math.max(1, n/2), 12), n);
    out.push({ n, cap, k, rounds: Math.ceil(12/k), wall: Math.round(a), speedup: r2(one/a), wallC0: Math.round(z), speedupC0: r2(one/z), balancedLanes: balanced(cap), balanced: Math.round(bl), capN: Math.round(bn), capHalf: Math.round(h) });
    lines.push(`| ${n} | ${k} | ${Math.ceil(12/k)} | ${fmt(a)}, ${r2(one/a)}× | ${fmt(z)}, ${r2(one/z)}× | ${balanced(cap)}: ${fmt(bl)} | ${fmt(bn)}, ${r2(one/bn)}× | ${fmt(h)}, ${r2(one/h)}× |`);
  }
  return out;
};
const out = { m, c, o, mMeasured, pts, check, default: pred(t4, o, c, 'Default settings (12 jobs of ' + Math.round(Math.min(...t4)) + '–' + Math.round(Math.max(...t4)) + ' ms alone)') };
if (heavy){
  // (heavy jobs contend less: their c fitted on their own 4-CPU points, m as above)
  const th = jobs(heavy), oh = kOf(heavy, 1).wallMed - th.reduce((a, b)=> a + b, 0);
  const hp = heavy.runs.filter(r=> r.k > 1).map(r=> ({ k: r.k, s: r.jobMsMed/kOf(heavy, 1).jobMsMed }));
  let bh = null;
  for (let cc = 0; cc <= 0.4; cc += 0.005){ const e = hp.reduce((a, p)=> a + Math.log(slow(p.k, 4, cc, m)/p.s)**2, 0); if (!bh || e < bh.e) bh = { c: cc, e }; }
  out.cHeavy = bh.c;
  lines.push('', `Heavy, its jobs' slowdown on 4 CPUs, measured / model with c = ${r2(bh.c)}: ${hp.map(p=> `k ${p.k} ${r2(p.s)}/${r2(slow(p.k, 4, bh.c, m))}`).join(', ')}; the wall time, measured / model: ` +
    heavy.runs.map(r=>{ const pw = model(th, oh, bh.c, m)(r.k, 4); return `k ${r.k} ${fmt(r.wallMed)}/${fmt(pw)} (${r2((pw - r.wallMed)/r.wallMed*100)} %)`; }).join(', ') + '.');
  out.heavy = pred(th, oh, bh.c, 'Heavy settings (12 jobs of ' + (Math.min(...th)/1000).toFixed(1) + '–' + (Math.max(...th)/1000).toFixed(1) + ' s alone)');
}
out.text = lines.join('\n');
console.log(out.text);
fs.writeFileSync(path.join(RESULTS, 'simulate.json'), JSON.stringify(out, null, 1) + '\n');
