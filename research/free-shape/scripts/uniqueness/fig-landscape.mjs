#!/usr/bin/env node
/* node fig-landscape.mjs <tag>: figs/landscape-<tag>.svg — every other minimum a run's
   analysis found, at its Δ (χ² above the best, in χ²_ν), against how far it lies from the
   reported solid: the largest extent ratio (|log|, extents paired by size) and the worst
   axis angle (modulo m-3m). Blue synthetic, orange sample-like. The dashed line: Δ where the
   flip probability falls to 5 % (c = 8). */
import fs from 'node:fs';
import path from 'node:path';
import { svgDoc, panel, dot, line, text, legend, C } from './svg.mjs';
import { pFlip } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'main';
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'results', tag, 'score.json'), 'utf8')).filter(r=> r.others);
let D5 = 0; while (pFlip(D5, 8) >= 0.05) D5 += 0.05;
const body = [];
const P1 = panel({ x: 70, y: 70, w: 360, h: 260, xr: [0, 30], yr: [0.01, 10], ylog: true, xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0.01, 0.1, 1, 10], xlabel: 'Δ = (χ² − χ²_best)/χ²_ν', ylabel: 'largest extent ratio, |ln|', title: 'how far in extent' });
const P2 = panel({ x: 520, y: 70, w: 360, h: 260, xr: [0, 30], yr: [0, 90], xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [0, 15, 30, 45, 60, 75, 90], xlabel: 'Δ = (χ² − χ²_best)/χ²_ν', ylabel: 'worst axis angle (°)', title: 'how far in orientation' });
body.push(...P1.out, ...P2.out);
for (const P of [P1, P2]) body.push(line([[P.X(D5), P.Y(P === P1 ? 0.01 : 0)], [P.X(D5), P.Y(P === P1 ? 10 : 90)]], C.ink2, { w: 1, dash: '4 3' }));
let n = { synth: 0, sample: 0 };
for (const r of rows) for (const o of r.others){
  if (!(o.D <= 30)) continue;
  const col = r.kind === 'sample' ? C.s2 : C.s1; n[r.kind] = (n[r.kind] || 0) + 1;
  const tip = `${r.run} Δ ${o.D.toFixed(2)} (${o.src}) extents ${o.dims.map(d=> d == null ? '∞' : d.toFixed(1)).join('×')} |ln| ${o.maxRatio.toFixed(2)} worst ${o.worst.toFixed(1)}°`;
  body.push(dot(P1.X(Math.max(0, o.D)), P1.Y(Math.max(0.01, Math.min(10, o.maxRatio))), col, tip, { r: 3.5 }));
  body.push(dot(P2.X(Math.max(0, o.D)), P2.Y(Math.min(90, o.worst)), col, tip, { r: 3.5 }));
}
body.push(text(P1.X(D5) + 4, P1.Y(10) + 12, `flip 5 % (Δ ${D5.toFixed(1)})`));
body.push(legend(910, 90, [[C.s1, `synthetic (${n.synth} minima)`], [C.s2, `sample-like (${n.sample})`]]));
const svg = svgDoc(1100, 390, body, `The other minima the analysis found (${tag}), within Δ 30 of the best`, 'Each dot: one converged minimum other than the best, refined exact with its orientation free; compared with the reported solid modulo m-3m.');
fs.mkdirSync(path.join(HERE, 'figs'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'figs', `landscape-${tag}.svg`), svg);
console.log('written figs/landscape-' + tag + '.svg', n);
