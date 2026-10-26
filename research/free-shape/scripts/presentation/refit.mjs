#!/usr/bin/env node
/* node refit.mjs --case <id> --seed <n> --bg <degree> [--from baseline] --out file.json
   A model variant's systematic check: the pattern is built as the harness builds it, but
   with a Chebyshev background of degree --bg (the harness: 6), refined by autoRefine to the
   isotropic fit; at the shape stage the solid the baseline search kept for this run is
   refined again from itself (no search): faces rounded, then exact with the orientation
   free, and exact held at that frame (as methods/truth.mjs does from the truth). Records
   the χ², the solids and the evaluations. Same Poisson draw as the harness's (patternOf). */
import fs from 'node:fs';
import path from 'node:path';
import { buildModel, autoRefine, setParams, ENG } from '../harness/eng/xrd-rietveld.js';
import { patternOf, caseById, stoPrep, solidOf, readResult, compareSolids, HERE as HARN } from '../harness/lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const c = caseById(opt.case), seed = +opt.seed, bg = +opt.bg;
const base = readResult(fs.readFileSync(path.join(HARN, 'results', opt.from || 'baseline', `${c.id}-${seed}.json`), 'utf8'));
const rec = base.records[0];
const type = base.shape;
const STO_OPTS = { size: true, profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: ['Sr1'] };
const prep = stoPrep();
const ph = { id: 1, name: prep.name, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888', ...STO_OPTS, shape: type };
const pat = patternOf(c, seed);
const model = buildModel({ x: pat.x, y: pat.y, varMul: pat.varMul, instr: pat.instr, phases: [ph], bgDegree: bg });
const out = { case: c.id, seed, bg, shape: type, from: rec.solid || null, held0: rec.held };
const STOP = { stop: true };
const t0 = Date.now(), e0 = ENG.FS.evals;
const hook = (model, k, res, free, opts) => {
  const E = ENG, q = model.phases[k], pf = q.pfx, F = E.fitSettings(opts.fit), B = E.BODIES[type];
  out.iso = { chi2: res.stats.chi2*Math.max(1, res.stats.N - res.stats.P), chi2nu: res.stats.chi2, N: res.stats.N, P: res.stats.P, Ys: model.v[q.iYs], evals: E.FS.evals - e0, ms: Date.now() - t0 };
  if (!rec.solid){ throw STOP; }
  const ev1 = E.FS.evals, t1 = Date.now();
  const lm = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const rot = q.iR.map(i=> model.par[i].name);
  const names = free.filter(nm=> nm !== pf + 'Ys').concat(q.iW.map(i=> model.par[i].name), rot);
  const s = rec.solid, w = s.dims.map(d=> Number.isFinite(d) ? E.K_SCHERRER*1.540598/(d*10)*E.R2D : 0);
  const W = B.W.length === 2 ? [(w[0] + w[1])/2, w[2]] : w;
  const Rm = [s.axes[0][0], s.axes[1][0], s.axes[2][0], s.axes[0][1], s.axes[1][1], s.axes[2][1], s.axes[0][2], s.axes[1][2], s.axes[2][2]];
  const v0 = model.v.slice(); v0[q.iYs] = 0;
  q.iW.forEach((i, j)=> { v0[i] = W[j]; }); q.iR.forEach(i=> { v0[i] = 0; }); E.quatOfMat(Rm).forEach((t, j)=> { v0[q.iQ[j]] = t; });
  const chi = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
  const go = (v, nm, soft) => {
    E.setParams(model, v); model.shapeSoft = soft && B.base !== 'ball' ? { q, soft: E.SHAPE_SOFT } : null;
    try { const r = E.refine(model, { free: nm, ...lm }); return { r, v: model.v.slice(), chi: chi(r) }; }
    catch(e){ return null; } finally { model.shapeSoft = null; }
  };
  const rebase = v => { const vv = v.slice(), R = E.bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((x, i)=> { vv[q.iQ[i]] = x; }); return vv; };
  const sf = go(v0, names, true);
  const ex = go(rebase(sf ? sf.v : v0), names, false);
  const hd = go(v0, names.filter(n=> !rot.includes(n)), false);
  const desc = x => x && { chi: x.chi, chi2nu: x.r.stats.chi2, P: x.r.stats.P, solid: solidOf(q, type, x.v), occ: x.v[model.index[pf + 'occ_Sr1']], B: x.v[model.index[pf + 'B']], Xs: x.v[model.index[pf + 'Xs']] };
  out.free = desc(ex); out.held = desc(hd);
  out.evals = E.FS.evals - ev1; out.ms = Date.now() - t1;
  throw STOP;
};
try { autoRefine(model, { standard: false, irf: pat.irf, fit: {}, shapeHook: hook }); } catch(e){ if (e !== STOP) throw e; }
// the solid kept by the app's rule: held when its BIC is lower and the free fit is not better than chance (7.81 for 3 turns, 5.99 for 2)
if (out.free && out.held){
  const nR = ENG.BODIES[type].rot, q95 = nR === 3 ? 7.81 : 5.99, nu = Math.max(1, out.free.chi2nu);
  out.keep = (out.held.chi - out.free.chi)/nu <= q95 ? 'held' : 'free';
  const k = out[out.keep];
  if (pat.truth && pat.truth.solid && pat.truth.solid.type === type){ out.truth = pat.truth.solid; out.acc = compareSolids(k.solid, pat.truth.solid); }
}
fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true });
fs.writeFileSync(opt.out, JSON.stringify(out));
const F = (x, d = 2) => x == null || !Number.isFinite(x) ? '∞' : x.toFixed(d);
console.log(`${c.id}-${seed} bg ${bg}: iso χ²_ν ${F(out.iso && out.iso.chi2nu, 3)}; kept ${out.keep} ${out.keep ? out[out.keep].solid.dims.map(d=> F(d)).join('×') : ''} χ²_ν ${out.keep ? F(out[out.keep].chi2nu, 3) : ''} | ${out.evals} evals ${out.ms} ms`);
