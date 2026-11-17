#!/usr/bin/env node
/* node fig-cover.mjs [--out figs/cover]
   Coverage against tightness: for each approach, how often its 95 % interval holds the
   truth (y) against its median width hi/lo over the closed intervals (x, log), per role of
   the truth's dimension (thinnest, middle, longest), and for the principal axis (a plate's
   normal, a needle's axis) the coverage of the stated cones against their median
   half-angle. Top row: the synthetic truths (results/eval-synth.json); bottom: the 12
   sample-like proxies (results/eval-sample.json), where the misfit, not the noise, sets
   the error. Colour: what the approach costs beyond the app's search (four tiers); every
   point carries its code, the key lists them. SVG and PNG. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HERE } from './plib.mjs';
import { C, svgDoc, panel, dot, text, line } from './svg.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const out = path.join(HERE, opt.out || 'figs/cover');
const T = { a: [C.s1, 'no evaluation beyond today’s report'], b: [C.s2, '+ width profiles (≈ 1000 evaluations)'], c: [C.s3, '+ refined minima (≈ 5600)'], d: ['#eda100', '+ the other five solids (≈ 19 000)'] };
const AP = [
  ['P0_app', 'A', 'a', 'today’s report: linear esds, held/free difference, angular profiles'],
  ['E_L6', 'L6', 'a', 'recommended: today’s, in the width, widened to the search’s ends within Δ ≤ 6, in column lengths'],
  ['E_L6pick', 'L6p', 'a', 'L6 at the background degree BIC picks among 6, 12, 18 (≈ 1800 evaluations; proxies’ row)'],
  ['E_L6bg', 'L6+bg', 'a', 'L6 widened to the three background degrees’ values (proxies’ row)'],
  ['E_L6mis', 'L6+m', 'a', 'L6 + the misfit bound σ·√((χ²_ν − 1)(N − P)) when χ²_ν is past the noise'],
  ['P1_profile', 'F', 'b', 'width profiles (2σ) of the reported fit'],
  ['P2_env2', 'M2', 'c', 'union over the refined minima within Δ ≤ 2, their own 2σ'],
  ['P3_credible', 'MC', 'c', 'union over the 95 % credible set of minima (weights e^−Δ/2)'],
  ['P3_mixture', 'MX', 'c', 'likelihood-weighted mixture of the minima, 2.5–97.5 %'],
  ['P3_points', 'MP', 'c', 'profile interval widened to the credible minima’s values'],
  ['P4_classes', 'S', 'd', 'BIC-weighted 95 % set of the six solids, union of column lengths'],
  ['P5_occam', 'O', 'd', 'the simplest solid within ΔBIC 10, its own intervals'],
  ['P6_occam', 'SO', 'd', 'every minimum of every solid, 95 % set, on the simplest one'],
];
const ld = f => { const p = path.join(HERE, 'results', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const rowsOf = [['synthetic truths', ld('eval-synth.json')], ['sample-like proxies (unmodelled hump)', ld('eval-sample.json')]].filter(r=> r[1]);
const PW = 220, PH = 170, GX = 70, GY = 92, X0 = 70, Y0 = 92;
const body = [];
rowsOf.forEach(([title, E], r)=> {
  const yb = Y0 + r*(PH + GY + 20);
  body.push(text(14, yb - 34, `${title}: ${Object.values(E.summary)[0] ? Object.values(E.summary)[0].n : 0} runs scored${r ? '' : ' (kept a solid)'}`, { col: C.ink, weight: 600, size: 12 }));
  const roles = [['thin', 'thinnest dimension'], ['mid', 'middle dimension'], ['long', 'longest dimension'], ['prin', 'principal axis (normal or needle axis)']];
  roles.forEach(([k, lab], j)=> {
    const ang = k === 'prin', XR = ang ? [0, 30] : k === 'thin' ? [1, 2] : [1, 6];
    const P = panel({ x: X0 + j*(PW + GX), y: yb, w: PW, h: PH, xlog: !ang, xr: XR, yr: [r ? 0 : 50, 100],
      xticks: ang ? [0, 10, 20, 30] : k === 'thin' ? [1, 1.1, 1.25, 1.5, 2] : [1, 1.5, 2, 3, 6], yticks: r ? [0, 25, 50, 75, 95] : [50, 60, 70, 80, 90, 95],
      xlabel: ang ? 'median 95 % cone half-angle (°)' : 'median interval width, hi/lo (closed ones)', ylabel: j ? '' : 'truth inside (%)', title: lab });
    body.push(...P.out, line([[P.X(XR[0]), P.Y(95)], [P.X(XR[1]), P.Y(95)]], C.ink2, { w: 1, dash: '4 3' }));
    const placed = [], dots = [];
    const pts = [];
    for (const [nm, code, tier] of AP){
      const s = E.summary[nm]; if (!s) continue;
      if (!r && (nm === 'E_L6bg' || nm === 'E_L6pick')) continue;      // seed 1 only on the synthetic set
      const q = s[k]; if (!q || !q.n) continue;
      const x = ang ? q.cmed : q.fmed, y = ang ? (q.claimed ? 100*q.cov/q.claimed : NaN) : 100*q.cov/q.n;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const px = P.X(x), py = P.Y(y);
      body.push(dot(px, py, T[tier][0], `${code}: ${nm} — ${y.toFixed(0)} % inside, ${ang ? x.toFixed(1) + '°' : 'hi/lo ' + x.toFixed(2)}${!ang && q.open ? `, ${q.open} open` : ''}; ${q.n} runs`));
      dots.push([px, py]); pts.push([px, py, x > XR[1] ? code + ' ›' : code]);
    }
    // the codes beside their dots: the first of 12 spots free of the dots and of the codes placed
    for (const [px, py, code] of pts){
      const w = 6.2*code.length + 2, hit = (x, y) => dots.some(([u, v])=> u > x - 5 && u < x + w + 5 && v > y - 13 && v < y + 4) || placed.some(([u, v, ww])=> x < u + ww && u < x + w && Math.abs(v - y) < 11);
      const spots = [[7, 4], [-7 - w, 4], [-w/2, -8], [-w/2, 16], [7, -6], [7, 14], [-7 - w, -6], [-7 - w, 14], [12, 24], [-w - 12, 24], [12, -16], [-w - 12, -16]];
      let sp = spots.find(([dx, dy])=> !hit(px + dx, py + dy)) || spots[0];
      placed.push([px + sp[0], py + sp[1], w]);
      body.push(text(px + sp[0], py + sp[1], code, { col: C.ink, size: 10 }));
    }
  });
});
// the key
const ky = Y0 + rowsOf.length*(PH + GY + 20) - 40;
Object.values(T).forEach(([col, lab], i)=> { body.push(dot(X0 + 6, ky + 16*i, col, lab), text(X0 + 16, ky + 16*i + 4, lab, { col: C.ink })); });
AP.forEach(([nm, code, tier, desc], i)=> { const cx = X0 + 330, cy = ky + 16*i; body.push(text(cx, cy + 4, code, { col: C.ink, weight: 600 }), text(cx + 40, cy + 4, desc, { col: C.ink2 })); });
const W = X0 + 4*(PW + GX), H = ky + 16*AP.length + 16;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + '.svg', svgDoc(W, H, body, 'Does the one result contain the truth? Coverage of the stated 95 % intervals against their width',
  'Each dot an approach; dashed: the nominal 95 %. Width: median hi/lo of the closed intervals (open ones counted in the tables; › past the axis). Cones: coverage of those stated.'));
if (!opt.nopng) execFileSync('/opt/node22/bin/node', [path.join(HERE, '..', 'harness', 'svg2png.mjs'), out + '.svg', out + '.png']);
console.log('wrote', out + '.svg', out + '.png');
