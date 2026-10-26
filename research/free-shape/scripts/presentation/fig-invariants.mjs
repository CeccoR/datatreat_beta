#!/usr/bin/env node
/* node fig-invariants.mjs [--out figs/invariants]
   What the near-equivalent fits share: for each quantity (results/invariants-<set>.json,
   invariants.mjs), its spread over the fits within Δ ≤ τ (max/min − 1, median and 90th
   percentile over the runs with more than one) beside the reported fit's error from the
   truth (median and 90th percentile). Left: synthetic truths; right: sample-like proxies.
   Log axis in per cent. SVG and PNG. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HERE, median, quantile } from './plib.mjs';
import { C, svgDoc, panel, dot, text, line } from './svg.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const out = path.join(HERE, opt.out || 'figs/invariants');
const Q = [
  ['harm', 'size over all directions (harmonic mean: one isotropic size)', r=> [r.harmSpread], r=> [r.harmErr]],
  ['mean', 'mean column length over all directions', r=> [r.meanSpread], r=> [r.meanErr]],
  ['fam', 'each family’s mean column length (10 per run)', r=> r.famSpread, r=> r.famErr],
  ['short', 'the shortest member’s column length (≈ thickness)', r=> [r.shortSpread], r=> [r.shortErr]],
  ['mem', 'each member’s column length, sorted in its family (34)', r=> r.memSpread, r=> r.memErr],
  ['dim', 'the solid’s principal column lengths (3: its dimensions)', r=> r.dimSpread, r=> r.dimErr],
];
const sets = ['synth', 'sample'].map(s=> { const p = path.join(HERE, 'results', `invariants-${s}.json`); return fs.existsSync(p) ? [s, JSON.parse(fs.readFileSync(p, 'utf8'))] : null; }).filter(Boolean);
const PW = 300, RH = 34, X0 = 330, top = 96, body = [];
const XR = [0.1, 300];
sets.forEach(([s, o], j)=> {
  const x0 = X0 + j*(PW + 40), multi = o.rows.filter(r=> r.n + r.nx > 1);
  const P = panel({ x: x0, y: top, w: PW, h: Q.length*RH, xlog: true, xr: XR, yr: [0, 1], xticks: [0.1, 1, 10, 100], yticks: [],
    title: `${s === 'synth' ? 'synthetic truths' : 'sample-like proxies'} (${o.rows.length} runs, τ ${o.tau})`, xlabel: 'per cent (log)' });
  body.push(...P.out);
  Q.forEach(([k, lab, sp, er], i)=> {
    const y = top + i*RH + RH/2;
    const S = multi.flatMap(sp).filter(Number.isFinite).map(x=> 100*(x - 1)), E = o.rows.flatMap(er).filter(Number.isFinite).map(x=> 100*Math.abs(x));
    const cl = v => Math.max(XR[0], Math.min(XR[1], v));
    const s50 = median(S), s90 = quantile(S, 0.9), e50 = median(E), e90 = quantile(E, 0.9);
    body.push(line([[P.X(cl(s50)), y - 5], [P.X(cl(s90)), y - 5]], C.s1, { w: 3, op: 0.5 }), dot(P.X(cl(s50)), y - 5, C.s1, `${lab}: spread over the near-equivalent fits, median ${s50.toFixed(1)} %, 90 % ${s90.toFixed(1)} %`, { r: 4 }));
    body.push(line([[P.X(cl(e50)), y + 6], [P.X(cl(e90)), y + 6]], C.s2, { w: 3, op: 0.5 }), dot(P.X(cl(e50)), y + 6, C.s2, `${lab}: error from the truth, median ${e50.toFixed(1)} %, 90 % ${e90.toFixed(1)} %`, { r: 4 }));
    if (j === 0) body.push(text(X0 - 12, y + 4, lab, { anchor: 'end', col: C.ink }));
  });
});
const ky = top + Q.length*RH + 50;
body.push(dot(X0, ky, C.s1, 'spread'), text(X0 + 10, ky + 4, 'spread over the fits within Δ ≤ τ (same solid and the other solids): dot median, bar to the 90th percentile', { col: C.ink }));
body.push(dot(X0, ky + 18, C.s2, 'error'), text(X0 + 10, ky + 22, 'error of the reported fit from the truth: dot median, bar to the 90th percentile', { col: C.ink }));
const W = X0 + sets.length*(PW + 40) + 10, H = ky + 40;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + '.svg', svgDoc(W, H, body, 'What the data determine: the near-equivalent fits agree on averaged column lengths, not on dimensions',
  'Top rows: averages over directions and over a family’s members; bottom: the solid’s own dimensions, where the near-equivalent fits part.'));
if (!opt.nopng) execFileSync('/opt/node22/bin/node', [path.join(HERE, '..', 'harness', 'svg2png.mjs'), out + '.svg', out + '.png']);
console.log('wrote', out + '.svg');
