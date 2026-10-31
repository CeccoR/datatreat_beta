#!/usr/bin/env node
/* The family bootstrap read (FB records, fam5.json): per row, the T replicas' family margins (runner-up
   family's best member less the winner's, in the data's χ²_ν, over the members bootstrapped), against
   the data's margin. A flip: the data's runner-up family lower on a replica. Fits P(flip) =
   Φ(−m/√(4m + c)) on the data's margin m (step 4's rule) and gives m* at 5 %, without and with a fired
   check; the nested test's null (special truths: Δ = special − general on the replicas).
   node fboot-an.mjs [--rows] */
import fs from 'node:fs';
import path from 'node:path';
import { f, q } from './lib5.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball' }, GEN = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' }, SPEC = { box: 'sqbox', cyl: 'cylinder', ball: 'spheroid' };
const R = JSON.parse(fs.readFileSync(path.join(HERE, 'fam5.json'), 'utf8')).filter(o=> o.solid !== 'sphere');
const Phi = z => { const t = 1/(1 + 0.2316419*Math.abs(z)), d = 0.3989422804014327*Math.exp(-z*z/2), p = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))); return z >= 0 ? 1 - p : p; };
const pairs = [], nests = [];
for (const o of R){
  const fb = {};
  for (const s of Object.keys(FAM)){ const p = path.join(HERE, 'results', 'FB', o.key + '.' + s + '.json'); if (!fs.existsSync(p)) continue; const b = JSON.parse(fs.readFileSync(p, 'utf8')).records[0].fboot; if (b && b.reps) fb[s] = b; }
  if (!Object.keys(fb).length) continue;
  const nu = o.nu, nR = Math.min(...Object.values(fb).map(b=> b.reps.length));
  const famAt = (F, get) => { const v = Object.keys(fb).filter(s=> FAM[s] === F).map(s=> get(fb[s])).filter(Number.isFinite); return v.length ? Math.min(...v) : NaN; };
  const W = o.chi.win, Rn = o.chi.runner;
  const famsHere = [...new Set(Object.keys(fb).map(s=> FAM[s]))];
  if (famsHere.includes(W) && famsHere.includes(Rn)){
    // the margin over every family bootstrapped other than the winner
    const others = famsHere.filter(F=> F !== W);
    const mAt = get => Math.min(...others.map(F=> famAt(F, get))) - famAt(W, get);
    const reps = Array.from({ length: nR }, (_, t)=> mAt(b=> b.reps[t])/nu);
    pairs.push({ key: o.key, error: o.error, flag: !!o.winFlag, right: W === o.trueFam, m: o.chi.margin, mBoot: mAt(b=> b.data)/nu, nf: mAt(b=> b.nf)/nu, reps, flips: reps.filter(x=> x < 0).length });
  }
  for (const F of Object.keys(GEN)) if (fb[GEN[F]] && fb[SPEC[F]] && FAM[o.solid] === F)
    nests.push({ key: o.key, F, truthSpecial: o.solid === SPEC[F], error: o.error, data: o.nest[F], nf: (fb[SPEC[F]].nf - fb[GEN[F]].nf)/nu, reps: Array.from({ length: nR }, (_, t)=> (fb[SPEC[F]].reps[t] - fb[GEN[F]].reps[t])/nu) });
}
const fitC = P => { // max likelihood c over a grid
  let best = null; for (let c = 0.5; c <= 2000; c *= 1.05){ let ll = 0; for (const p of P){ const pf = Math.min(1 - 1e-9, Math.max(1e-9, Phi(-p.m/Math.sqrt(4*Math.max(0, p.m) + c)))); ll += p.flips*Math.log(pf) + (p.reps.length - p.flips)*Math.log(1 - pf); } if (!best || ll > best.ll) best = { c, ll }; }
  let mstar = 0; while (Phi(-mstar/Math.sqrt(4*mstar + best.c)) > 0.05 && mstar < 500) mstar += 0.1; return { c: best.c, mstar }; };
for (const [nm, P] of [['all', pairs], ['clean', pairs.filter(p=> !p.error)], ['error', pairs.filter(p=> p.error)], ['flagged', pairs.filter(p=> p.flag)], ['not flagged', pairs.filter(p=> !p.flag)]]){
  if (!P.length) continue;
  const reps = P.reduce((t, p)=> t + p.reps.length, 0), fl = (lo, hi) => { const S = P.filter(p=> p.m >= lo && p.m < hi); const n = S.reduce((t, p)=> t + p.reps.length, 0); return n ? `${(S.reduce((t, p)=> t + p.flips, 0)/n).toFixed(2)} (${S.length})` : '—'; };
  const { c, mstar } = fitC(P);
  console.log(`| ${nm} | ${P.length} | ${reps} | ${fl(0, 3)} | ${fl(3, 10)} | ${fl(10, 25)} | ${fl(25, 1e9)} | ${f(c)} | ${f(mstar)} |`);
}
if (opt.rows){
  console.log('\n| row | error | flag | winner right | m data | m refit | m noise-free | replicas: median, min | flips |');
  for (const p of pairs) console.log(`| ${p.key} | ${p.error || '—'} | ${p.flag ? 'F' : ''} | ${p.right ? 'yes' : 'no'} | ${f(p.m)} | ${f(p.mBoot)} | ${f(p.nf)} | ${f(q(p.reps, .5))}, ${f(Math.min(...p.reps))} | ${p.flips}/${p.reps.length} |`);
}
console.log('\nnested (the true family\'s special against general on its replicas, χ²_ν):');
for (const F of ['box', 'cyl', 'ball']){
  const N0 = nests.filter(n=> n.F === F && n.truthSpecial), N1 = nests.filter(n=> n.F === F && !n.truthSpecial), r0 = N0.flatMap(n=> n.reps), r1 = N1.flatMap(n=> n.reps);
  console.log(`| ${F} | special truths ${N0.length}: data ${N0.map(n=> f(n.data)).join(', ')}; replicas ${r0.length}: median ${f(q(r0, .5))}, 95 % ${f(q(r0, .95))}, 99 % ${f(q(r0, .99))} | general truths ${N1.length}: data ${N1.map(n=> f(n.data)).join(', ')}; replicas median ${f(q(r1, .5))}, 5 % ${f(q(r1, .05))} |`);
}
fs.writeFileSync(path.join(HERE, 'fboot-an.json'), JSON.stringify({ pairs, nests }));
