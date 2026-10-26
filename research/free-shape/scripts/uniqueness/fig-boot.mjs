#!/usr/bin/env node
/* node fig-boot.mjs <tag>: figs/boot-<tag>.svg from results/boot-<tag>.json — left: each
   competing minimum's Δ* over the replicas of the best (each replica a small dot, the mean
   a large one) against δ, the Δ of the best's noise-free pattern, with the prediction
   δ ± 2√(4δ + c); right: the flip rate (replicas where the competitor wins) against Δ_obs,
   with Φ(−Δ/√(4Δ + c)) and exp(−Δ/2)/(1 + exp(−Δ/2)) (the likelihood weight). */
import fs from 'node:fs';
import path from 'node:path';
import { svgDoc, panel, dot, line, text, legend, C } from './svg.mjs';
import { pFlip } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'boot';
const B = JSON.parse(fs.readFileSync(path.join(HERE, 'results', `boot-${tag}.json`), 'utf8'));
// c: the value the rules use (8, about the least-squares mean); the fit's mean and median are printed beside it
const c = +(process.argv[3] || 8);
const body = [];
const P1 = panel({ x: 70, y: 70, w: 380, h: 300, xr: [0, 40], yr: [-20, 60], xticks: [0, 10, 20, 30, 40], yticks: [-20, 0, 20, 40, 60], xlabel: 'δ: Δ of the best\'s noise-free pattern (χ²)', ylabel: 'Δ* on replicas of the best', title: 'Δ over replicas of the best' });
const P2 = panel({ x: 540, y: 70, w: 380, h: 300, xr: [0, 30], yr: [0, 0.6], xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xlabel: 'Δ_obs = (χ²_j − χ²_best)/χ²_ν on the data', ylabel: 'share of replicas where j wins', title: 'flip rate' });
body.push(...P1.out, ...P2.out);
const xs = Array.from({ length: 81 }, (_, i)=> i*0.5);
body.push(line(xs.map(d=> [P1.X(d), P1.Y(d)]), C.ink2, { w: 1.5 }));
body.push(line(xs.map(d=> [P1.X(d), P1.Y(d + 2*Math.sqrt(4*d + c))]), C.ink2, { w: 1, dash: '4 3' }));
body.push(line(xs.map(d=> [P1.X(d), P1.Y(d - 2*Math.sqrt(4*d + c))]), C.ink2, { w: 1, dash: '4 3' }));
body.push(line(xs.filter(d=> d <= 30).map(d=> [P2.X(d), P2.Y(pFlip(d, c))]), C.ink2, { w: 1.5 }));
body.push(line(xs.filter(d=> d <= 30).map(d=> [P2.X(d), P2.Y(Math.exp(-d/2)/(1 + Math.exp(-d/2)))]), C.s3, { w: 1.5, dash: '5 3' }));
for (const p of B.pairs){
  if (!Number.isFinite(p.delta)) continue;
  const col = p.kind === 'sample' ? C.s2 : C.s1;
  for (const d of p.Ds) body.push(`<circle cx="${P1.X(Math.max(0, p.delta)).toFixed(1)}" cy="${P1.Y(Math.max(-20, Math.min(60, d))).toFixed(1)}" r="1.6" fill="${col}" opacity="0.45"/>`);
  body.push(dot(P1.X(Math.max(0, p.delta)), P1.Y(Math.max(-20, Math.min(60, p.mean))), col, `${p.run} j${p.j}: δ ${p.delta.toFixed(2)}, Δ* ${p.mean.toFixed(2)} ± ${p.sd.toFixed(2)}, Δ_obs ${p.Dobs.toFixed(2)}`, { r: 4 }));
  if (p.Dobs <= 30) body.push(dot(P2.X(Math.max(0, p.Dobs)), P2.Y(Math.min(0.6, p.flips/p.n)), col, `${p.run} j${p.j}: Δ_obs ${p.Dobs.toFixed(2)}, ${p.flips}/${p.n} flips`, { r: 4 }));
}
body.push(legend(950, 90, [[C.s1, 'synthetic'], [C.s2, 'sample-like']]));
body.push(text(950, 140, `solid: Φ(−Δ/√(4Δ + c)), c ${c.toFixed(1)}`, { col: C.ink }), text(950, 204, `c fitted: mean ${B.c.mean.toFixed(1)}, median ${B.c.median.toFixed(1)}`, { col: C.ink2 }), text(950, 156, 'dashed (left): δ ± 2√(4δ + c)', { col: C.ink }), text(950, 172, 'green dashed: likelihood weight', { col: C.ink }), text(950, 188, '  e^(−Δ/2)/(1 + e^(−Δ/2))', { col: C.ink }));
const svg = svgDoc(1180, 420, body, `Calibrating Δχ² by parametric bootstrap (${tag})`, `${B.pairs.length} pairs (best, competitor) over ${B.cost.runs} runs; replicas: Poisson on the best's y_c, both refitted from their own minima.`);
fs.writeFileSync(path.join(HERE, 'figs', `boot-${tag}.svg`), svg);
console.log('written figs/boot-' + tag + '.svg');
