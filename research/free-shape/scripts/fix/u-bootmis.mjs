/* The bootstrap under misfit: replicas drawn from the proxies' own generator (the truth plus
   the unmodelled hump, harness patternOf with fresh Poisson seeds 1001…1000+R), not from the
   best fit's y_c as methods/u-boot.mjs draws them (that y_c has no hump, so u-boot's replicas
   never contain the misfit). The minima are the main batch's (UBOOT_DIR/<case>-1.json:
   uniq.minima within 30 χ²_ν, at most 5), each refitted from its own vector on every replica
   exactly as u-boot refits them (every parameter free, the orientation free, 12 iterations,
   one FCJ pass; weights 1/(y + 1), y + min(y, 1) as buildModel's). Per replica: each
   minimum's χ² and solid, and the solid against the truth (compareSolids). Run in the
   degree-6 mirror (the main batch's model). Returns the best's vector. */
import fs from 'node:fs';
import path from 'node:path';
import { solidOf, readResult, patternOf, caseById, compareSolids } from '../../harness/lib.mjs';
const DIR = process.env.UBOOT_DIR, R = +(process.env.UBOOT_R || 12);
export default { name: 'u-bootmis', search(model, k, res, free, opts, E, ctx){
  const f = path.join(DIR, `${ctx.case.id}-${ctx.seed}.json`);
  if (!fs.existsSync(f)) return null;
  const prev = readResult(fs.readFileSync(f, 'utf8')), u = prev.records[0].info && prev.records[0].info.uniq;
  if (!u || !u.minima || u.minima.length < 2) return null;
  const q = model.phases[k], type = q.shapeType, pf = q.pfx, F = E.fitSettings(opts.fit);
  const names = free.filter(n=> n !== pf + 'Ys').concat([...q.iW, ...q.iR].map(i=> model.par[i].name));
  const nu0 = u.nu0, c0 = u.minima[0].chi;
  const comps = u.minima.filter(x=> (x.chi - c0)/nu0 <= 30).slice(0, 5);
  if (comps.length < 2) return null;
  const truth = patternOf(caseById(ctx.case.id), ctx.seed).truth.solid;
  const lmB = { maxIter: 12, shiftTol: F.shiftTol, lambda: F.lambda };
  const chiTot = rr => rr.stats.chi2*Math.max(1, rr.stats.N - rr.stats.P);
  const fit = v => { E.setParams(model, Float64Array.from(v)); try { const rr = E.refine(model, { free: names, ...lmB, audit: false }); const s = solidOf(q, type, model.v); const a = compareSolids(s, truth); return { chi: chiTot(rr), chi2nu: rr.stats.chi2, solid: s, it: rr.iterations, acc: { dimMax: a.dimMax, principal: a.principal, orient: a.orient, dimErr: a.dimErr } }; } catch(e){ return null; } };
  const y0 = model.y, w0 = model.w, n = model.n;
  const out = { from: DIR, comps: comps.map(x=> u.minima.indexOf(x)), D0: comps.map(x=> (x.chi - c0)/nu0), R, data: null, reps: [] };
  const ev0 = E.FS.evals, t0 = Date.now();
  try {
    out.data = comps.map(x=> fit(x.v));
    for (let b = 0; b < R; b++){
      const pat = patternOf(caseById(ctx.case.id), 1000 + b + 1);
      if (pat.x.length !== n || Math.abs(pat.x[0] - model.x[0]) > 1e-9 || Math.abs(pat.x[n - 1] - model.x[n - 1]) > 1e-9) throw new Error('grid mismatch');
      const Y = new Float64Array(n), W = new Float64Array(n);
      for (let i = 0; i < n; i++){ if (w0[i] > 0){ const c = pat.y[i]; Y[i] = c + Math.min(c, 1); W[i] = 1/(c + 1); } }
      model.y = Y; model.w = W;
      out.reps.push(comps.map(x=> fit(x.v)));
    }
  } finally { model.y = y0; model.w = w0; }
  out.evals = E.FS.evals - ev0; out.ms = Date.now() - t0;
  E.setParams(model, Float64Array.from(comps[0].v));
  const st = E.evaluate(model, model.v);
  return { res: { stats: { chi2: st.chi2/Math.max(1, res.stats.N - res.stats.P), N: res.stats.N, P: res.stats.P }, free: names }, info: { type, bootmis: out } };
} };
