#!/usr/bin/env node
/* node fig-null.mjs: figs/null.svg from results/null.json — the χ² gain over the isotropic size
   (in χ²_ν) of the app's search on isotropic truths (each a dot, per body: three widths as the
   box, two as the cylinder), the gain the rejected anisotropic truths' own refinements reach,
   and the thresholds: AIC (2 dPmin), the null's maximum, the app's ΔBIC < −10 on the held
   route (10 + dPmin ln N) and on the free route (10 + dP ln N). Log scale. */
import fs from 'node:fs';
import path from 'node:path';
import { svgDoc, panel, dot, line, text, legend, C } from './svg.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const N = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'null.json'), 'utf8'));
const lnN = N.lnN, body = [];
const bodies = [['box', 'three widths (iso-7 as a box)', 2, 5], ['cylinder', 'two widths (iso-20 as a cylinder)', 1, 3]];
bodies.forEach(([b, title, dPmin, dP], k)=> {
  const B = N.body[b]; if (!B) return;
  const P = panel({ x: 70 + k*470, y: 80, w: 400, h: 220, xr: [0.3, 100], yr: [0, 3], xlog: true, xticks: [0.3, 1, 3, 10, 30, 100], yticks: [], xlabel: 'gain over the isotropic size, (χ²_iso − χ²)/χ²_ν', title });
  body.push(...P.out);
  const vl = (x, col, lab, row, dash = '4 3') => { body.push(line([[P.X(x), P.Y(0)], [P.X(x), P.Y(3)]], col, { w: 1.4, dash }), text(P.X(x) + 3, P.Y(3) + 12 + 12*row, lab, { col, size: 10 })); };
  vl(2*dPmin, C.muted, `AIC ${2*dPmin}`, 0);
  vl(B.max, C.ink2, `null max ${B.max.toFixed(1)}`, 1, '');
  vl(10 + dPmin*lnN, C.s2, `ΔBIC −10 held ${(10 + dPmin*lnN).toFixed(0)}`, 2);
  vl(10 + dP*lnN, C.s2, `free ${(10 + dP*lnN).toFixed(0)}`, 3);
  B.G.forEach((g, i)=> body.push(dot(P.X(Math.max(0.3, g)), P.Y(0.6 + 0.5*((i*0.618) % 1)), C.s1, `null gain ${g.toFixed(2)}`, { r: 3.5 })));
  const nW = b === 'box' ? 3 : 2;
  const alt = N.alt.filter(a=> ({ box: 3, sqbox: 2, ellipsoid: 3, spheroid: 2, cylinder: 2, ellcyl: 3 })[a.shape] === nW);
  alt.forEach((a, i)=> { if (Number.isFinite(a.Gtruth)) body.push(dot(P.X(Math.max(0.3, a.Gtruth)), P.Y(2.0 + 0.6*((i*0.618) % 1)), C.s3, `${a.run} (${a.shape}) truth's gain ${a.Gtruth.toFixed(1)}`, { r: 3.5 })); });
  body.push(text(74 + k*470, P.Y(0.2), `isotropic truths: ${B.G.length}`, { col: C.s1, size: 10 }), text(74 + k*470, P.Y(1.6), `rejected anisotropic truths: ${alt.length}`, { col: C.s3, size: 10 }));
});
body.push(legend(70, 350, [[C.s1, 'isotropic truth: the gain the app\'s search finds (early route)'], [C.s3, 'anisotropic truth the app rejects: the gain of the truth\'s own refinement']]));
const svg = svgDoc(1020, 400, body, 'Is there a shape at all? The gain the search finds on isotropic data, against the thresholds', `Gain in χ²_ν; ln N = ${lnN.toFixed(2)} (5384 points). The app keeps a shape at ΔBIC < −10.`);
fs.mkdirSync(path.join(HERE, 'figs'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'figs', 'null.svg'), svg);
console.log('written figs/null.svg');
