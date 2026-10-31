#!/usr/bin/env node
/* Step 4: the local error (curvature) against the bootstrap (results/BT, BOOT_ALL): for the lowest
   minimum of each kept row, each extent's ln D on the replicas against its claimed σ (σ_W/W, the
   stage's covariance: S1's info.minima[0].s). F: Poisson draws of the fitted pattern: sd of
   (ln D_r − ln D_nf)/σ measures the noise calibration. T: draws of the generator's own counts: the
   mean of (ln D_r − ln D_truth)/σ is the bias in σ, its sd the noise again. node esdboot.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations, ENG, dimOf, cols } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'design', 'design.json'), 'utf8'));
const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const sdv = a => { const m = a.reduce((t, x)=> t + x, 0)/a.length; return Math.sqrt(a.reduce((t, x)=> t + (x - m)**2, 0)/Math.max(1, a.length - 1)); };
const rmsv = a => Math.sqrt(a.reduce((t, x)=> t + x*x, 0)/a.length);
const rowsOut = [], agg = { clean: { F: [], Tb: [], Ts: [] }, error: { F: [], Tb: [], Ts: [] } };
for (const fn of fs.readdirSync(path.join(HERE, 'results', 'BT')).filter(x=> x.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(HERE, 'results', 'BT', fn), 'utf8')), r = o.records[0], b = r.boot;
  const s1 = readResult(fs.readFileSync(path.join(HERE, 'results', 'S1', fn), 'utf8')).records[0];
  if (!b || !b.F || !s1.info || !s1.info.minima || !o.truth) continue;
  const row = design.rows.find(x=> x.id === o.row), m0 = s1.info.minima[0], B = ENG.BODIES[s1.solid.type];
  const Wx = w => B.axes(w), sol = w => ({ type: s1.solid.type, dims: Wx(w).map(dimOf), axes: cols(m0.R) });
  const acc = compareSolids(sol(m0.W), o.truth, { rots: laueRotations(o.phase) });
  const one = new Set(['cylinder', 'spheroid', 'sqbox']).has(o.truth.type);
  const pairs = acc.pairs.filter(([ri])=> !(one && ri === 1)), g = agg[row.error ? 'error' : 'clean'];
  for (const [ri, fi] of pairs){
    const W0 = Wx(m0.W)[fi], s = m0.s.w[fi]/W0;   // σ of ln W = σ of ln D
    if (!(s > 0) || !(W0 > 0)) continue;
    const z = (B_, ref) => B_.reps.map(rr=> rr[0].W ? (Math.log(Wx(rr[0].W)[fi]) - ref)/s : NaN).filter(Number.isFinite);
    const zF = z(b.F, Math.log(Wx(b.F.nf[0].W)[fi])), lnWt = -Math.log(o.truth.dims[ri]/dimOf(1));
    const zT2 = b.T.reps.map(rr=> rr[0].W ? (Math.log(Wx(rr[0].W)[fi]) - lnWt)/s : NaN).filter(Number.isFinite);
    if (!zF.length) continue;
    g.F.push(sdv(zF)); g.Tb.push(zT2.reduce((t, x)=> t + x, 0)/zT2.length); g.Ts.push(sdv(zT2));
    rowsOut.push({ id: o.row, err: row.error ? row.error.kind : '', fi, s, sdF: sdv(zF), biasT: zT2.reduce((t, x)=> t + x, 0)/zT2.length, sdT: sdv(zT2) });
  }
}
const L = ['| rows | extents | sd of z, F replicas: median, rms | T replicas: bias in σ, median |bias|, rms | |bias| > 2 | sd of z, T |', '|---|---|---|---|---|---|'];
for (const k of ['clean', 'error']){ const g = agg[k], ab = g.Tb.map(Math.abs).sort((a, b)=> a - b);
  L.push(`| ${k} | ${g.F.length} | ${f([...g.F].sort((a, b)=> a - b)[g.F.length >> 1])}, ${f(rmsv(g.F))} | ${f(ab[ab.length >> 1])}, ${f(rmsv(g.Tb))} | ${ab.filter(x=> x > 2).length} | ${f([...g.Ts].sort((a, b)=> a - b)[g.Ts.length >> 1])} |`); }
console.log(L.join('\n'));
if (process.argv.includes('--rows')) for (const x of rowsOut.sort((a, b)=> Math.abs(b.biasT) - Math.abs(a.biasT)).slice(0, 25)) console.log(JSON.stringify(x, (k, v)=> typeof v === 'number' ? +v.toFixed(3) : v));
