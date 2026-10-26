#!/usr/bin/env node
/* node fig-forest.mjs [--approach E_app6] [--out figs/forest]
   Forest plot: per run, the one result's value and its 95 % interval for the thinnest,
   middle and longest dimension, each divided by the truth's (log axis; 1 = the truth), and
   the principal axis's angle from the truth against its cone. Top: the 12 sample-like
   proxies, the statistical interval (blue) and the same widened by the background
   variants (orange, results/sys-sample.json); below: the synthetic truths, seed 1. An
   open interval runs to the right edge with an arrow. SVG and PNG. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HERE } from './plib.mjs';
import { C, svgDoc, panel, dot, text, line } from './svg.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const AP = opt.approach || 'E_L6', out = path.join(HERE, opt.out || 'figs/forest');
const ld = f => { const p = path.join(HERE, 'results', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8'), (k, v)=> v === null && (k === 'hi' || k === 'est') ? Infinity : v) : null; };
const ES = ld('eval-sample.json'), EY = ld('eval-synth.json');
const rows = [];
if (ES) for (const r of ES.per){ const s = r.sc[AP]; if (!s || !s.dims) continue; const y = r.sc[AP + 'pick']; rows.push({ lab: r.id, s, sys: y && y.dims ? { ...y.dims, prin: y.ang && y.ang.prin } : null, grp: 'sample' }); }
if (EY) for (const r of EY.per){ if (r.seed !== 1) continue; const s = r.sc[AP]; if (!s || !s.dims) continue; rows.push({ lab: r.id, s, grp: 'synth' }); }
const RH = 13, top = 84, PW = 230, GX = 26, LX = 150;
const nS = rows.filter(r=> r.grp === 'sample').length, gap = 26;
const yOf = i => top + i*RH + (i >= nS ? gap : 0);
const H = yOf(rows.length) + 70;
const body = [];
const cols = [['thin', 'thinnest column length / truth'], ['mid', 'middle / truth'], ['long', 'longest / truth'], ['prin', 'principal axis: angle from the truth (°)']];
const XR = [0.25, 4];
cols.forEach(([k, lab], j)=> {
  const x0 = LX + j*(PW + GX), ang = k === 'prin';
  const P = panel({ x: x0, y: top - 8, w: PW, h: yOf(rows.length) - top + 4, xlog: !ang, xr: ang ? [0, 30] : XR, yr: [0, 1], xticks: ang ? [0, 5, 10, 20, 30] : [0.25, 0.5, 1, 2, 4], yticks: [], title: lab });
  body.push(...P.out);
  if (!ang) body.push(line([[P.X(1), top - 8], [P.X(1), yOf(rows.length) - 4]], C.ink2, { w: 1, dash: '3 3' }));
  rows.forEach((r, i)=> {
    const y = yOf(i) + RH/2;
    if (ang){
      const p = r.s.ang && r.s.ang.prin; if (!p) return;
      const cone = p.claimed ? p.cone : null;
      if (cone != null) body.push(line([[P.X(0), y], [P.X(Math.min(30, cone)), y]], C.s1, { w: 3, op: 0.55 }));
      if (r.sys && r.sys.prin && r.sys.prin.cone < 180 && cone != null && r.sys.prin.cone > cone) body.push(line([[P.X(cone), y], [P.X(Math.min(30, r.sys.prin.cone)), y]], C.s2, { w: 3, op: 0.55 }));
      body.push(dot(P.X(Math.min(30, p.angle)), y, C.ink, `${r.lab}: ${p.angle.toFixed(1)}° from the truth; cone ${cone == null ? 'none' : cone.toFixed(1) + '°'}`, { r: 2.6, hollow: !p.cov }));
      return;
    }
    const d = r.s.dims[k], t = d.truth;
    const seg = (lo, hi, col, op) => { const l = Math.max(XR[0], lo/t), h = Number.isFinite(hi) ? Math.min(XR[1], hi/t) : XR[1];
      body.push(line([[P.X(l), y], [P.X(h), y]], col, { w: 3, op }));
      if (!Number.isFinite(hi)) body.push(`<path d="M${(P.X(XR[1]) - 5).toFixed(1)},${(y - 3).toFixed(1)} L${P.X(XR[1]).toFixed(1)},${y.toFixed(1)} L${(P.X(XR[1]) - 5).toFixed(1)},${(y + 3).toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.2"/>`); };
    if (r.sys){ const z = r.sys[k]; seg(z.lo, z.hi, C.s2, 0.55); }
    seg(d.lo, d.hi, C.s1, 0.7);
    if (r.sys){ const z = r.sys[k]; if (Number.isFinite(z.est)) body.push(dot(P.X(Math.min(XR[1], Math.max(XR[0], z.est/t))), y, C.s2, `${r.lab} ${k} at the picked background: ${z.est.toFixed(2)} nm, interval ${z.lo.toFixed(2)}–${Number.isFinite(z.hi) ? z.hi.toFixed(2) : '∞'} nm`, { r: 2.6, hollow: !z.cov })); }
    const e = Number.isFinite(d.est) ? Math.min(XR[1], Math.max(XR[0], d.est/t)) : XR[1];
    body.push(dot(P.X(e), y, C.ink, `${r.lab} ${k}: value ${Number.isFinite(d.est) ? d.est.toFixed(2) : '∞'} nm, interval ${d.lo.toFixed(2)}–${Number.isFinite(d.hi) ? d.hi.toFixed(2) : '∞'} nm, truth ${t.toFixed(2)} nm`, { r: 2.6, hollow: !d.cov }));
  });
});
rows.forEach((r, i)=> body.push(text(LX - 8, yOf(i) + RH/2 + 4, r.lab, { anchor: 'end', size: 9.5, col: C.ink })));
body.push(text(14, top - 30, `sample-like proxies (${nS})`, { col: C.ink, weight: 600 }), text(14, yOf(nS) - 6, `synthetic truths, seed 1 (${rows.length - nS})`, { col: C.ink, weight: 600 }));
const ky = H - 40;
body.push(line([[LX, ky], [LX + 24, ky]], C.s1, { w: 3, op: 0.7 }), text(LX + 30, ky + 4, `the one result: today's esds in the width, widened to the search's ends within Δ ≤ 6, as column lengths (${AP})`, { col: C.ink }));
body.push(line([[LX, ky + 16], [LX + 24, ky + 16]], C.s2, { w: 3, op: 0.55 }), text(LX + 30, ky + 20, 'the same at the background degree BIC picks (6, 12, 18): the model term', { col: C.ink }));
body.push(dot(LX + 700, ky, C.ink, 'value', { r: 2.6 }), text(LX + 708, ky + 4, 'value, truth inside (orange: at the picked background)', { col: C.ink }), dot(LX + 700, ky + 16, C.ink, 'value', { r: 2.6, hollow: true }), text(LX + 708, ky + 20, 'value, truth outside', { col: C.ink }));
const W = Math.max(LX + 4*(PW + GX) + 10, LX + 1040);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + '.svg', svgDoc(W, H, body, 'The one result against the truth, run by run', 'Each dimension divided by the truth’s (1: the truth; log axis); an arrow: open above. Right: the normal’s (or needle axis’) angle from the truth and its 95 % cone.'));
if (!opt.nopng) execFileSync('/opt/node22/bin/node', [path.join(HERE, '..', 'harness', 'svg2png.mjs'), out + '.svg', out + '.png']);
console.log('wrote', out + '.svg');
