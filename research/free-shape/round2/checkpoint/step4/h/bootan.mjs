#!/usr/bin/env node
/* Step 4: Δ* from the parametric bootstrap (methods/boot.mjs records, results/<tag>). Per pair (the
   lowest minimum, a competitor): the data's Δ (in its χ²_ν, floored at 1), the noise-free δ on the
   replicas' mean (F: the fitted model's pattern; T: the generator's, with the row's model error),
   and each replica's Δ_r (in that replica's χ²_ν of the lowest, floored at 1). A flip: Δ_r < 0.
   Round 1's model: Δ_r ~ N(δ, 4δ + c); c by maximum likelihood over the pairs; the flip probability
   read from the data's Δ, Φ(−Δ/√(4Δ + c)), and its 5 % point Δ*. Also the observed flip rates by
   Δ bin against that rule with c = 8 (round 1) and with the fitted c.
   node bootan.mjs [--tag BT] [--json out] */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const tag = arg('tag', 'BT'), dir = path.join(HERE, 'results', tag);
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'design', 'design.json'), 'utf8'));
const Phi = z => { const t = 1/(1 + 0.2316419*Math.abs(z)), d = 0.3989422804014327*Math.exp(-z*z/2), p = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))); return z >= 0 ? 1 - p : p; };
const P = [];
let evals = 0, ms = 0, searchEv = 0, nRows = 0;
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8')), r = o.records[0], b = r.boot, row = design.rows.find(x=> x.id === o.row);
  if (!b || !b.F || !b.T) continue;
  nRows++; evals += b.evals; ms += b.ms; searchEv += r.search.evals;
  for (let m = 1; m < b.minima.length; m++){
    for (const ty of ['F', 'T']){
      const B = b[ty];
      const d0 = B.nf[m].c - B.nf[0].c;   // noise-free: in χ² (χ²_ν there is far under 1)
      const reps = B.reps.map(rr=> (rr[m].c - rr[0].c)/Math.max(1, rr[0].nu)).filter(Number.isFinite);
      P.push({ id: o.row, clean: !row.error, ek: row.error ? row.error.kind : 'none', ty, m, D: b.minima[m].delta, d0, reps });
    }
  }
}
// c by maximum likelihood (a grid), for a subset of pairs
const fitC = S => { let best = null; for (let c = 0.5; c <= 400; c *= 1.05){ let ll = 0;
  for (const p of S) for (const x of p.reps){ const v = Math.max(1e-6, 4*Math.max(0, p.d0) + c); ll += -0.5*Math.log(v) - (x - p.d0)**2/(2*v); }
  if (!best || ll > best.ll) best = { c, ll }; } return best ? best.c : NaN; };
const dstar = c => (2*1.645**2 + Math.sqrt((2*1.645**2)**2 + 4*1.645**2*c))/2;   // Δ/√(4Δ + c) = 1.645
const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const L = [`tag ${tag}: ${nRows} rows, ${P.length/2} pairs; bootstrap ${evals} evaluations, ${(ms/1000).toFixed(0)} s (${f(evals/searchEv, 1)}× those rows' searches)`, ''];
L.push('| replicas | rows | pairs | replicas | c (ML) | Δ* at 5 % | flips, all | flips Δ<6 obs / pred c=8 / fitted | flips 6–12.5 | flips >12.5 | δ/Δ median |', '|---|---|---|---|---|---|---|---|---|---|---|');
const groups = [['F, clean rows', p=> p.ty === 'F' && p.clean], ['F, error rows', p=> p.ty === 'F' && !p.clean], ['T, clean rows', p=> p.ty === 'T' && p.clean], ['T, error rows', p=> p.ty === 'T' && !p.clean]];
const out = {};
for (const [nm, g] of groups){
  const S = P.filter(g), c = fitC(S); out[nm] = { c, dstar: dstar(c) };
  const bin = (lo, hi) => { const B = S.filter(p=> p.D >= lo && p.D < hi), n = B.reduce((t, p)=> t + p.reps.length, 0), fl = B.reduce((t, p)=> t + p.reps.filter(x=> x < 0).length, 0);
    const pr = cc => B.reduce((t, p)=> t + p.reps.length*Phi(-p.D/Math.sqrt(4*p.D + cc)), 0)/Math.max(1, n);
    return n ? `${fl}/${n} = ${f(fl/n)} / ${f(pr(8))} / ${f(pr(c))}` : '—'; };
  const ratio = S.map(p=> p.d0/Math.max(1e-9, p.D)).sort((a, b)=> a - b);
  L.push(`| ${nm} | ${new Set(S.map(p=> p.id)).size} | ${S.length} | ${S.reduce((t, p)=> t + p.reps.length, 0)} | ${f(c, 1)} | ${f(dstar(c), 1)} | ${bin(0, Infinity)} | ${bin(0, 6)} | ${bin(6, 12.5)} | ${bin(12.5, Infinity)} | ${f(ratio[ratio.length >> 1])} |`);
}
L.push('', '| row | error | pair | Δ data | δ F | flips F | δ T | flips T |', '|---|---|---|---|---|---|---|---|');
for (const p of P.filter(p=> p.ty === 'F')){
  const t = P.find(q=> q.ty === 'T' && q.id === p.id && q.m === p.m);
  L.push(`| ${p.id} | ${p.ek} | 0–${p.m} | ${f(p.D, 1)} | ${f(p.d0, 1)} | ${p.reps.filter(x=> x < 0).length}/${p.reps.length} | ${t ? f(t.d0, 1) : '—'} | ${t ? t.reps.filter(x=> x < 0).length + '/' + t.reps.length : '—'} |`);
}
console.log(L.join('\n'));
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(out));
