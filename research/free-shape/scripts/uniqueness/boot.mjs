#!/usr/bin/env node
/* node boot.mjs <tag>: the parametric bootstrap (methods/u-boot.mjs records, info.boot).
   For each competing minimum j of a run: Δ_obs (the data, both refitted as the replicas
   are), δ (the best's noise-free pattern, j refitted: the expected Δ under the best),
   over the R replicas of the best Δ*_j (mean, sd, flips: Δ* < 0), and over the RJ replicas
   of j itself Δ'_j = χ²_best − χ²_j (how often the best still wins when j is the truth).
   The prediction: Δ* ~ N(δ, 4δ + c); c fitted by least squares on the replicas' variance.
   And the best's own spread over its replicas against its linear esds. Writes
   results/boot-<tag>.json; prints the table. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from '../harness/lib.mjs';
import { align, fmt, Phi, median } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'boot';
const dir = path.join(HERE, 'results', tag);
const pairs = [], prec = [];
let cost = { evals: 0, ms: 0, runs: 0 };
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json')).sort()){
  const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8')); if (!r.records) continue;
  const b = r.records[0].info && r.records[0].info.boot; if (!b) continue;
  cost.evals += b.evals; cost.ms += b.ms; cost.runs++;
  const nuOf = z => Math.max(1, z.chi2nu);
  for (let j = 1; j < b.comps.length; j++){
    if (!b.data[0] || !b.data[j]) continue;
    const Dobs = (b.data[j].chi - b.data[0].chi)/nuOf(b.data[0]);
    const delta = b.free0[0] && b.free0[j] ? b.free0[j].chi - b.free0[0].chi : NaN;
    const Ds = b.fromBest.map(x=> x[0] && x[j] ? (x[j].chi - x[0].chi)/nuOf(x[0]) : NaN).filter(Number.isFinite);
    const m = Ds.reduce((t, x)=> t + x, 0)/Ds.length, sd = Math.sqrt(Ds.reduce((t, x)=> t + (x - m)**2, 0)/Math.max(1, Ds.length - 1));
    const fc = b.fromComp.find(x=> x.j === j);
    const Dr = fc ? fc.rows.map(([a, c])=> a && c ? (a.chi - c.chi)/nuOf(c) : NaN).filter(Number.isFinite) : [];
    const deltaRev = fc && fc.free[0] && fc.free[1] ? fc.free[0].chi - fc.free[1].chi : NaN;
    const al = align(b.data[j].solid, b.data[0].solid, { loose: true });
    pairs.push({ run: `${r.case}#${r.seed}`, kind: r.kind, type: r.shape, j, Dobs, delta, n: Ds.length, mean: m, sd, flips: Ds.filter(x=> x < 0).length, Ds,
      deltaRev, nRev: Dr.length, revWins: Dr.filter(x=> x < 0).length, Dr, worst: al.orient, maxLog: Math.max(...al.per.map(p=> Number.isFinite(p.ratio) ? Math.abs(Math.log(p.ratio)) : 9)) });
  }
  const b0 = b.fromBest.map(x=> x[0]).filter(Boolean);
  if (b0.length >= 3 && b.data[0]){
    const al = b0.map(z=> align(z.solid, b.data[0].solid, { loose: true }));
    prec.push({ run: `${r.case}#${r.seed}`, n: b0.length, per: [0, 1, 2].map(i=> {
      const lr = al.map(a=> Math.log(a.per[i].ratio)).filter(Number.isFinite), ang = al.map(a=> a.per[i].angle).filter(x=> x != null);
      const mm = lr.reduce((t, x)=> t + x, 0)/Math.max(1, lr.length);
      return { D: b.data[0].solid.dims[i], sdLog: Math.sqrt(lr.reduce((t, x)=> t + (x - mm)**2, 0)/Math.max(1, lr.length - 1)), rmsAng: ang.length ? Math.sqrt(ang.reduce((t, x)=> t + x*x, 0)/ang.length) : null }; }) });
  }
}
// c: Var(Δ*) = 4δ + c, by least squares on the pairs with δ ≥ 0
const ok = pairs.filter(p=> Number.isFinite(p.delta) && p.n >= 5);
const cfit = ok.length ? ok.reduce((t, p)=> t + (p.sd*p.sd - 4*Math.max(0, p.delta)), 0)/ok.length : NaN;
const cmed = median(ok.map(p=> p.sd*p.sd - 4*Math.max(0, p.delta)));
// the mean of Δ* against δ and Δ_obs (bias of the expectation)
const out = { tag, cost, c: { mean: cfit, median: cmed }, pairs, prec };
fs.writeFileSync(path.join(HERE, 'results', `boot-${tag}.json`), JSON.stringify(out, null, 1));
console.log(`${cost.runs} runs, ${pairs.length} pairs; bootstrap cost ${cost.evals} evaluations, ${(cost.ms/1000).toFixed(0)} s; c (Var Δ* − 4δ): mean ${fmt(cfit, 1)}, median ${fmt(cmed, 1)}`);
console.log('| run | j | Δ_obs | δ | Δ* mean | Δ* sd | √(4δ+8) | flips | j true: δ′ | best wins | |ln| | worst ° |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const p of pairs.sort((a, b)=> a.Dobs - b.Dobs)) console.log(`| ${p.run} | ${p.j} | ${fmt(p.Dobs, 2)} | ${fmt(p.delta, 2)} | ${fmt(p.mean, 2)} | ${fmt(p.sd, 2)} | ${fmt(Math.sqrt(4*Math.max(0, p.delta) + 8), 2)} | ${p.flips}/${p.n} | ${fmt(p.deltaRev, 2)} | ${p.revWins}/${p.nRev} | ${fmt(p.maxLog, 2)} | ${fmt(p.worst, 1)} |`);
console.log('\nthe best over its replicas: sd(ln D) per extent, rms axis angle');
for (const p of prec) console.log(p.run, p.n, p.per.map(x=> `${fmt(x.D, 1)}: ${fmt(x.sdLog, 3)} ${fmt(x.rmsAng, 1)}°`).join(' | '));
