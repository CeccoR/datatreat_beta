#!/usr/bin/env node
/* Builds xrd-sizeline.js, the size-line tables of the free shape's lsq line (round 2, track A
   (b2): AB.md §3.1), precomputed so that the browser does not spend the 18 s this takes.
   For each reduced shape of a member, the TCH pseudo-Voigt (g, l), Gaussian and Lorentzian
   FWHM in 1/⟨L⟩_V, that best fits the solid's exact size line by weighted least squares:
   x = s·⟨L⟩_V over 0…X (the line is even), weights 1/(p + b) (Poisson over a flat background
   b, the peak 1). The exact lines are track A's own Fourier transforms of A(L)
   (../scripts/A/lines/profiles.mjs: no import of the generator or the engine). Grids:
   - ball (sphere, ellipsoid, spheroid; the isotropic sphere): one entry;
   - cylinder (and elliptic cylinder, after the affine map): ψ, the angle from the axis in the
     scaled body, 0–90° every STEP_PSI (linear in the engine);
   - box: β = b/a, γ = c/a of the sorted scaled direction components a ≥ b ≥ c, 0–1 every
     STEP_BOX (bilinear in the engine); symmetric in β, γ, its lower half (γ ≤ β) written.
   Each fit starts from the previous entry's (g, l) along the grid, as track A's tables did
   (lines/build-tables.mjs): with the defaults the output is A's tables.json (lsq) to the bit.
   The tunables (to be tuned on round 2's tuning runs): X, B (the fit's span and weights),
   STEP_PSI, STEP_BOX.
   node build-sizeline.mjs [--X 6] [--b 0.2] [--psi 0.5] [--box 0.025] [--out <repo>/xrd-sizeline.js]
                           [--check tables.json]   (compare with track A's tables, bit for bit) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ballA, boxA, cylA, reduce, sample, maxDev, lsqGL, pvGL } from '../scripts/A/lines/profiles.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1];
const X = +(opt.X || 6), B = +(opt.b || 0.2), STEP_PSI = +(opt.psi || 0.5), STEP_BOX = +(opt.box || 0.025);
const nPsi = Math.round(90/STEP_PSI) + 1, nBox = Math.round(1/STEP_BOX) + 1;
if (Math.abs((nPsi - 1)*STEP_PSI - 90) > 1e-9 || Math.abs((nBox - 1)*STEP_BOX - 1) > 1e-9) throw new Error('the steps must divide 90° and 1');
const so = { b: B, X };
const t0 = Date.now();
const fit = (sol, p0) => { const red = reduce(sol), L = lsqGL(red, so, p0); return { g: L.g, l: L.l, dev: maxDev(sample(red, so), x=> pvGL(x, L.g, L.l)) }; };
const ball = fit(ballA());
const cyl = [];
let prev = null;
for (let i = 0; i < nPsi; i++){ const e = fit(cylA(i*STEP_PSI*Math.PI/180), prev); cyl.push(e); prev = [e.g, e.l]; }
// the box as A's build ran it: row i (β), j = 0…i (γ), each from its left neighbour, a row's
// first from the row above's first
const box = Array.from({ length: nBox }, ()=> []);
for (let i = 0; i < nBox; i++){
  const pr = i ? [box[i - 1][0].g, box[i - 1][0].l] : null;
  for (let j = 0; j <= i; j++) box[i][j] = fit(boxA(i/(nBox - 1), j/(nBox - 1)), j ? [box[i][j - 1].g, box[i][j - 1].l] : pr);
}
const ms = Date.now() - t0;
const all = [ball, ...cyl, ...box.flat()], dev = [Math.min(...all.map(e=> e.dev)), Math.max(...all.map(e=> e.dev))];

if (opt.check){
  // track A's tables.json: { ball: { lsq }, cyl: { e: [{ lsq }] }, box: { e: [[{ lsq }]] } }
  const T = JSON.parse(fs.readFileSync(opt.check, 'utf8'));
  let n = 0, bad = 0;
  const cmp = (e, t) => { n++; if (e.g !== t.lsq[0] || e.l !== t.lsq[1]) bad++; };
  cmp(ball, T.ball); cyl.forEach((e, i)=> cmp(e, T.cyl.e[i]));
  for (let i = 0; i < nBox; i++) for (let j = 0; j < nBox; j++) cmp(box[Math.max(i, j)][Math.min(i, j)], T.box.e[i][j]);
  console.log(`check against ${opt.check}: ${n - bad} of ${n} entries equal to the bit`);
}

const num = x => String(x);
// [g, l] pairs, six to a line (a box row starting a line of its own)
const pairs = rows => rows.map(list=> { const out = []; for (let i = 0; i < list.length; i += 6) out.push(list.slice(i, i + 6).map(e=> num(e.g) + ', ' + num(e.l)).join(', ')); return out.join(',\n    '); }).join(',\n    ');
const text = `/* The size line of a free shape's members by the lsq line (xrd-rietveld.js SHAPE_MODE.line
   'lsq'; research/free-shape/round2/AB.md §3.1, track A (b2)): for each reduced shape of a
   member, the TCH pseudo-Voigt's Gaussian and Lorentzian FWHM (g, l), in 1/⟨L⟩_V, that best
   fits the solid's exact size line by weighted least squares (x = s·⟨L⟩_V over 0–${X}, weights
   1/(p + ${B}), p the line at peak 1). Max deviation from the exact line ${(100*dev[0]).toFixed(1)}–${(100*dev[1]).toFixed(1)} % of its peak.
   - ball: sphere, ellipsoid, spheroid, and the isotropic sphere: one entry [g, l];
   - cyl: the cylinder and elliptic cylinder by ψ, the angle from the axis in the scaled body,
     0–90° every cylStep°: [g, l] per step, in order;
   - box: by β = b/a, γ = c/a of the sorted scaled direction components a ≥ b ≥ c, 0–1 every
     boxStep: the table is symmetric, its lower half written row by row, [g, l] at
     (β, γ) = (i, j)·boxStep, j ≤ i, at index i(i + 1)/2 + j.
   Written by research/free-shape/round2/proto/build-sizeline.mjs (${(ms/1000).toFixed(0)} s); do not edit. */
export const SIZE_LINE = {
  fit: { X: ${X}, b: ${B} },
  ball: [${num(ball.g)}, ${num(ball.l)}],
  cylStep: ${STEP_PSI},
  cyl: [
    ${pairs([cyl])}],
  boxStep: ${STEP_BOX},
  box: [
    ${pairs(box)}],
};
`;
const out = opt.out || path.resolve(HERE, '..', '..', '..', '..', 'xrd-sizeline.js');
fs.writeFileSync(out, text);
console.log(`${out}: ${nPsi} ψ, ${nBox}×${nBox} (β, γ), ${(text.length/1024).toFixed(1)} kB, built in ${ms} ms; max deviation ${(100*dev[0]).toFixed(2)}–${(100*dev[1]).toFixed(2)} % of the peak`);
