#!/usr/bin/env node
/* node bootflip.mjs [bootTag=boot]: which cheap number predicts how often a competing minimum
   would win on a fresh pattern? From results/boot-<tag>.json (boot.mjs): for each pair the
   observed flip rate over 20 replicas of the best, and the predictions
     calΔ  Φ(−Δ/√(4Δ + c)), Δ the data's χ² difference (in χ²_ν)
     calδ  the same with δ, the best's noise-free pattern refitted by the competitor
     likΔ  the likelihood weight e^(−Δ/2)/(1 + e^(−Δ/2))
     fix10 1 if Δ ≤ 10 else 0 (the fixed threshold)
   by set (synthetic, sample-like) and by bins of the predictor's own Δ; the score is the
   binomial log-likelihood of the observed flips (higher is better) and the mean |predicted −
   observed|. c from --c (default 8; boot.mjs prints the fitted value). */
import fs from 'node:fs';
import path from 'node:path';
import { Phi, fmt } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'boot', c = +(process.argv[3] || 8);
const B = JSON.parse(fs.readFileSync(path.join(HERE, 'results', `boot-${tag}.json`), 'utf8'));
const cal = (D) => D <= 0 ? 0.5 : Phi(-D/Math.sqrt(4*D + c));
const P = { calΔ: p=> cal(p.Dobs), calδ: p=> cal(p.delta), likΔ: p=> Math.exp(-Math.max(0, p.Dobs)/2)/(1 + Math.exp(-Math.max(0, p.Dobs)/2)), fix10: p=> p.Dobs <= 10 ? 0.5 : 0.0 };
const ll = (pp, k, n) => { const q = Math.min(1 - 1e-3, Math.max(1e-3, pp)); return k*Math.log(q) + (n - k)*Math.log(1 - q); };
const out = {};
for (const set of ['synth', 'sample']){
  const X = B.pairs.filter(p=> p.kind === set && Number.isFinite(p.delta) && p.n);
  out[set] = {};
  console.log(`\n## ${set}: ${X.length} pairs, ${X.reduce((t, p)=> t + p.n, 0)} replicas, ${X.reduce((t, p)=> t + p.flips, 0)} flips`);
  console.log('| predictor | log-likelihood | mean abs error | flips where predicted < 5 % |');
  console.log('|---|---|---|---|');
  for (const [nm, f] of Object.entries(P)){
    const L = X.reduce((t, p)=> t + ll(f(p), p.flips, p.n), 0), E = X.reduce((t, p)=> t + Math.abs(f(p) - p.flips/p.n), 0)/X.length;
    const lo = X.filter(p=> f(p) < 0.05), lof = lo.reduce((t, p)=> t + p.flips, 0), lon = lo.reduce((t, p)=> t + p.n, 0);
    out[set][nm] = { L, E, lowFlips: lof, lowN: lon };
    console.log(`| ${nm} | ${fmt(L, 1)} | ${fmt(E, 3)} | ${lof}/${lon} (${lo.length} pairs) |`);
  }
  console.log('| Δ bin | pairs | observed flip rate | calΔ | likΔ | δ: observed, calδ |');
  console.log('|---|---|---|---|---|---|');
  for (const [a, b] of [[0, 1], [1, 3], [3, 6], [6, 12], [12, 99]]){
    const Y = X.filter(p=> p.Dobs >= a && p.Dobs < b), Z = X.filter(p=> p.delta >= a && p.delta < b);
    const rate = W => W.length ? W.reduce((t, p)=> t + p.flips, 0)/W.reduce((t, p)=> t + p.n, 0) : NaN;
    const mean = (W, f) => W.length ? W.reduce((t, p)=> t + f(p), 0)/W.length : NaN;
    console.log(`| ${a}–${b} | ${Y.length} | ${fmt(rate(Y), 2)} | ${fmt(mean(Y, P.calΔ), 2)} | ${fmt(mean(Y, P.likΔ), 2)} | ${Z.length}: ${fmt(rate(Z), 2)}, ${fmt(mean(Z, P.calδ), 2)} |`);
  }
}
fs.writeFileSync(path.join(HERE, 'results', `bootflip-${tag}.json`), JSON.stringify({ c, out }, null, 1));
