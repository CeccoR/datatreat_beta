#!/usr/bin/env node
/* The narrowest line of each design row, for the step: every member in the range, its
   exact line (the solid's A(L) along it, kernels.mjs, with the row's size distribution when
   it has one) convolved with the rest of the line (the instrument's TCH pseudo-Voigt with
   the row's microstrain, at the standard's refined profile), its FWHM found on the line
   synthesised in d* (line(s) = 2∫A(L)·R̂(L)·cos 2πsL dL, R̂ the pseudo-Voigt's transform)
   and read in 2θ (Δ2θ = Δd*·λ/cosθ). The axial asymmetry and Kα2 are left out: they only
   widen a line, so the FWHM here is a lower bound. Rows: all of the design (their truths
   only, no result is read). Prints the narrowest lines and points per FWHM at each step.
   node narrow.mjs [--lo 10 --hi 130] [--out file.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { body, kernel } from '../gen/kernels.mjs';
import { standardIrf, normRow } from '../gen/gen.mjs';
import { phaseQ } from '../harness/lib.mjs';
import { profileAtTheta } from '../harness/eng/xrd-rietveld.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const LO = +(opt.lo || 10), HI = +(opt.hi || 130), LAM = 1.540598, D2R = Math.PI/180, R2D = 180/Math.PI;
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const irf = standardIrf();
// the FWHM (Å⁻¹) of 2∫₀^T A(L)·R̂(L)·cos(2πsL) dL, R̂ = η e^{−πHL} + (1−η) e^{−(πHL)²/(4 ln 2)}
function fwhm(A, T, H, eta){
  const n = 1500, dL = T/n, w = [];
  for (let i = 0; i <= n; i++){ const L = i*dL, r = eta*Math.exp(-Math.PI*H*L) + (1 - eta)*Math.exp(-((Math.PI*H*L)**2)/(4*Math.LN2)); w.push(A(L)*r*(i === 0 || i === n ? 0.5 : 1)); }
  const f = s => { let t = 0; for (let i = 0; i <= n; i++) t += w[i]*Math.cos(2*Math.PI*s*i*dL); return t; };
  const half = f(0)/2;
  let lo = 0, hi = 1/T; while (f(hi) > half) hi *= 2;
  for (let it = 0; it < 40; it++){ const mid = (lo + hi)/2; if (f(mid) > half) lo = mid; else hi = mid; }
  return lo + hi;          // full width: twice the half width
}
const out = [];
for (const r0 of design.rows){
  const row = normRow(r0), q = phaseQ(r0.phase), sigma = row.error && row.error.kind === 'sizedist' ? 0.1 + 0.4*row.error.strength : 0;
  const b = body(row.solid, row.dims.map(d=> 10*d), row.R, sigma), Xs = 4*row.eps*R2D;
  const cand = [];
  for (let r = 0; r < q.nRefl; r++){
    const h = [q.h[r], q.k[r], q.l[r]], B = q.Bm, g = [B[0]*h[0] + B[1]*h[1] + B[2]*h[2], B[3]*h[0] + B[4]*h[1] + B[5]*h[2], B[6]*h[0] + B[7]*h[1] + B[8]*h[2]];
    const ds = Math.hypot(...g), sth = LAM*ds/2; if (sth >= 1) continue;
    const th = Math.asin(sth), tt = 2*th*R2D; if (tt < LO || tt > HI) continue;
    const pr = profileAtTheta(th, irf.U, irf.V, irf.W, irf.X + Xs, irf.Y), Hs = pr.H*D2R*Math.cos(th)/LAM;
    const mv = q.mv[r];
    for (let i = 0; i < mv.length/3; i++){
      const K = kernel(b, [mv[3*i], mv[3*i + 1], mv[3*i + 2]]);
      cand.push({ r, i, tt, th, Lv: K.Lv, K, Hs, eta: pr.eta, Hrest: pr.H });
    }
  }
  // the narrowest by a quick bound (size FWHM ≈ 0.6/⟨L⟩_V in d*, added in quadrature), then exact for the 6 narrowest
  cand.forEach(c=> { c.est = Math.hypot(0.6/c.Lv, c.Hs)*LAM/Math.cos(c.th)*R2D; });
  cand.sort((x, y)=> x.est - y.est);
  let best = null;
  for (const c of cand.slice(0, 6)){
    const H = fwhm(c.K.A, c.K.T, c.Hs, c.eta)*LAM/Math.cos(c.th)*R2D;
    if (!best || H < best.H) best = { H, tt: c.tt, hkl: [q.h[c.r], q.k[c.r], q.l[c.r]], Lv: c.Lv/10, Hrest: c.Hrest };
  }
  out.push({ id: r0.id, split: r0.split, solid: r0.solid, dims: r0.dims, eps: r0.eps, ...best });
}
out.sort((x, y)=> x.H - y.H);
const f = (x, d = 3) => x.toFixed(d);
console.log('narrowest lines (FWHM °, lower bound):');
for (const o of out.slice(0, 12)) console.log(`${o.id}\t${o.solid}\t${o.dims.map(d=> f(d, 1)).join('×')}\tε ${f(100*o.eps, 2)} %\t2θ ${f(o.tt, 1)}\t⟨L⟩_V ${f(o.Lv, 1)} nm\trest ${f(o.Hrest)}°\tFWHM ${f(o.H)}°\tpoints/FWHM ${f(o.H/0.01, 1)} (0.01) ${f(o.H/0.02, 1)} (0.02)`);
const Hs = out.map(o=> o.H).sort((x, y)=> x - y);
console.log(`rows ${out.length}: narrowest ${f(Hs[0])}°, 1st percentile ${f(Hs[Math.floor(0.01*Hs.length)])}°, median ${f(Hs[Hs.length >> 1])}°; rows under 0.10° (5 points at 0.02): ${Hs.filter(h=> h < 0.10).length}`);
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(out));
