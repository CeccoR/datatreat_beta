#!/usr/bin/env node
/* node classes2.mjs: model selection across the solids, seed 1 of every case, from the
   presentation study's cross-class runs (../presentation/results/xclass/<case>-1-<solid>.json:
   the app's search as that solid, read only) and this study's main runs (the truth's solid).
   Per run: each kept solid's χ² (total), P; ν0 = max(1, the lowest χ²_ν); Δ = (χ² − χ²_min)/ν0;
   ΔBIC = Δ + ΔP ln N, ΔAIC = Δ + 2ΔP. Which solid each criterion ranks first (the truth's?),
   how many lie within the indistinguishable range: the calibrated flip probability
   Φ(−Δ/√(4Δ + c)) ≥ 5 % on χ² alone (Δ ≤ D5), and ΔBIC ≤ 2 / 6 / 10. And whether the
   plausible solids agree on the extents: each plausible solid's three extents paired by size
   with the best's, the largest |ln ratio|, and against the truth (loose pairing). Writes
   results/classes2.json and prints the tables. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, CASES } from '../harness/lib.mjs';
import { align, fmt, median, pFlip } from './ulib.mjs';
import { widthsOf } from './obs.mjs';
// what the pattern measures, modulo m-3m: the members' widths per d-spacing, rank-paired; max |ln ratio|
const obsMax = (a, b) => { const A = widthsOf(a), B = widthsOf(b); let m = 0; A.forEach((ws, i)=> ws.forEach((w, j)=> { m = Math.max(m, Math.abs(Math.log(Math.max(w, 1e-4)/Math.max(B[i][j], 1e-4)))); })); return m; };
const HERE = path.dirname(new URL(import.meta.url).pathname);
const XC = path.join(HERE, '..', 'presentation', 'results', 'xclass');
const SOLIDS = ['spheroid', 'cylinder', 'sqbox', 'ellipsoid', 'box', 'ellcyl'];
const c = +(process.argv[2] || 8);
let D5 = 0; while (pFlip(D5, c) >= 0.05) D5 += 0.01;
const rows = [];
for (const cs of CASES.filter(x=> x.kind === 'synth' || x.kind === 'sample' || x.kind === 'control')){
  const own = path.join(HERE, 'results', 'main', `${cs.id}-1.json`);
  if (!fs.existsSync(own)) continue;
  const fits = [], rej = [];
  const add = (type, r, src) => {
    const m = r.records[0];
    if (!m.kept){ rej.push({ type, dBICiso: m.dBIC, early: m.early }); return; }
    fits.push({ type, chi: m.chi2, chi2nu: m.chi2nu, P: m.P, solid: m.solid, held: m.held, dBICiso: m.dBIC, src });
  };
  const ro = readResult(fs.readFileSync(own, 'utf8')), N = ro.iso.N;
  add(ro.shape, ro, 'main');
  let n = 1;
  for (const s of SOLIDS){ if (s === ro.shape) continue; const f = path.join(XC, `${cs.id}-1-${s}.json`); if (fs.existsSync(f)){ add(s, readResult(fs.readFileSync(f, 'utf8')), 'xclass'); n++; } }
  if (n < SOLIDS.length) continue;       // only runs with every solid tried
  const row = { run: `${cs.id}#1`, kind: cs.kind, truth: cs.kind === 'synth' ? cs.type : null, truthSolid: ro.truth || null, N, rej, fits: [] };
  if (fits.length){
    const nu0 = Math.max(1, Math.min(...fits.map(f=> f.chi2nu))), cmin = Math.min(...fits.map(f=> f.chi)), Pmin = Math.min(...fits.map(f=> f.P));
    for (const f of fits){ f.D = (f.chi - cmin)/nu0; f.bic = f.D + (f.P - Pmin)*Math.log(N); f.aic = f.D + 2*(f.P - Pmin); }
    const bb = Math.min(...fits.map(f=> f.bic)), ab = Math.min(...fits.map(f=> f.aic));
    for (const f of fits){ f.dBIC = f.bic - bb; f.dAIC = f.aic - ab; f.pf = pFlip(f.D, c); }
    const byChi = [...fits].sort((a, b)=> a.D - b.D), best = byChi[0];
    for (const f of fits){
      const al = align(f.solid, best.solid, { loose: true });
      f.vsBest = Math.max(...al.per.map(p=> Number.isFinite(p.ratio) ? Math.abs(Math.log(p.ratio)) : (Number.isNaN(p.ratio) ? 0 : 9)));
      f.vsBestAng = al.orient;
      // what the pattern measures: each member's width, rank-paired within its d-spacing
      f.colVsBest = obsMax(f.solid, best.solid);
      if (row.truthSolid){ f.colVsTruth = obsMax(f.solid, row.truthSolid); const at = align(f.solid, row.truthSolid, { loose: true }); f.vsTruth = Math.max(...at.per.map(p=> Number.isFinite(p.ratio) ? Math.abs(Math.log(p.ratio)) : 9)); f.vsTruthAng = at.per.map(p=> p.angle).filter(x=> x != null); }
    }
    row.fits = byChi;
    row.firstChi = byChi[0].type;
    row.firstBIC = [...fits].sort((a, b)=> a.dBIC - b.dBIC)[0].type;
    row.firstAIC = [...fits].sort((a, b)=> a.dAIC - b.dAIC)[0].type;
    row.plaus = fits.filter(f=> f.D <= D5).map(f=> f.type);
    row.bic2 = fits.filter(f=> f.dBIC <= 2).map(f=> f.type); row.bic10 = fits.filter(f=> f.dBIC <= 10).map(f=> f.type);
    row.spread = Math.max(...fits.filter(f=> f.D <= D5).map(f=> f.vsBest)); row.colSpread = Math.max(...fits.filter(f=> f.D <= D5).map(f=> f.colVsBest));
  }
  rows.push(row);
}
fs.writeFileSync(path.join(HERE, 'results', 'classes2.json'), JSON.stringify({ c, D5, rows }, null, 1));
const ab = { spheroid: 'sph', cylinder: 'cyl', sqbox: 'sqb', ellipsoid: 'ell', box: 'box', ellcyl: 'ecy' };
console.log(`c = ${c}: flip probability ≥ 5 % for Δ ≤ ${D5.toFixed(2)}\n`);
console.log('| run | truth | Δχ² by solid (r: rejected against the isotropic size) | first by χ², BIC, AIC | plausible (flip ≥ 5 %) | their extents\' spread, max |ln| | truth\'s solid: Δ, ΔBIC |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows){
  const by = Object.fromEntries(r.fits.map(f=> [f.type, f]));
  const cells = SOLIDS.map(s=> by[s] ? `${ab[s]} ${fmt(by[s].D, 1)}` : r.rej.find(x=> x.type === s) ? `${ab[s]} r` : '').filter(Boolean).join(', ');
  const t = r.truth && by[r.truth];
  console.log(`| ${r.run} | ${r.truth ? ab[r.truth] : '—'} | ${cells} | ${r.fits.length ? [r.firstChi, r.firstBIC, r.firstAIC].map(s=> ab[s]).join(', ') : '—'} | ${(r.plaus || []).map(s=> ab[s]).join(' ')} | ${fmt(r.spread, 2)} | ${t ? fmt(t.D, 1) + ', ' + fmt(t.dBIC, 1) : r.truth ? 'rejected' : '—'} |`);
}
const S = rows.filter(r=> r.kind === 'synth' && r.fits.length && r.fits.some(f=> f.type === r.truth));
const cnt = k => S.filter(r=> r[k] === r.truth).length;
console.log(`\nsynthetic, seed 1, truth's solid kept: ${S.length} runs. First: by χ² ${cnt('firstChi')}, by BIC ${cnt('firstBIC')}, by AIC ${cnt('firstAIC')}.`);
console.log(`plausible solids (Δ ≤ ${D5.toFixed(2)}): median ${median(S.map(r=> r.plaus.length))}, 1 alone in ${S.filter(r=> r.plaus.length === 1).length}; truth's among them ${S.filter(r=> r.plaus.includes(r.truth)).length}/${S.length}; within ΔBIC 2: median ${median(S.map(r=> r.bic2.length))}; ΔBIC 10: median ${median(S.map(r=> r.bic10.length))}`);
console.log(`extents across the plausible solids: max |ln| against the best, median ${fmt(median(S.map(r=> r.spread)), 2)}; runs where every plausible solid's extents lie within 25 % of the best's: ${S.filter(r=> r.spread <= Math.log(1.25)).length}/${S.length}`);
const P = S.flatMap(r=> r.fits.filter(f=> f.D <= D5 && f.vsTruth != null)), Pn = S.flatMap(r=> r.fits.filter(f=> f.D > D5 && f.vsTruth != null));
console.log(`extents against the truth (max |ln|): plausible solids median ${fmt(median(P.map(f=> f.vsTruth)), 2)} (${P.filter(f=> f.vsTruth <= Math.log(1.25)).length}/${P.length} within 25 %); the others ${fmt(median(Pn.map(f=> f.vsTruth)), 2)} (${Pn.filter(f=> f.vsTruth <= Math.log(1.25)).length}/${Pn.length})`);
console.log(`the members' widths (rank-paired per d-spacing) across the plausible solids: max |ln| median ${fmt(median(S.map(r=> r.colSpread)), 3)}, 90th ${fmt([...S.map(r=> r.colSpread)].sort((a, b)=> a - b)[Math.floor(0.9*(S.length - 1))], 3)}; within 10 %: ${S.filter(r=> r.colSpread <= Math.log(1.1)).length}/${S.length}`);
console.log(`the members' widths against the truth's: plausible solids median max |ln| ${fmt(median(P.map(f=> f.colVsTruth)), 3)} (${P.filter(f=> f.colVsTruth <= Math.log(1.25)).length}/${P.length} within 25 %); the others ${fmt(median(Pn.map(f=> f.colVsTruth)), 3)}`);
const U = rows.filter(r=> r.kind === 'sample' && r.fits.length);
console.log(`sample-like members' widths across the plausible solids: max |ln| median ${fmt(median(U.map(r=> r.colSpread)), 3)}`);
console.log(`\nsample-like: ${U.length} runs; first by χ²: ${U.map(r=> ab[r.firstChi]).join(' ')}; by BIC: ${U.map(r=> ab[r.firstBIC]).join(' ')}; plausible: median ${median(U.map(r=> r.plaus.length))}`);
