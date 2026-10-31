/* Step 4's parametric bootstrap of the threshold Δ* (round 1's §5.3 and §5.3b, redone on the exact
   line with the minima stage). The search and the stage with the engine's defaults; then, when at
   least two minima lie within BOOT_KEEP (30) of the lowest, at most BOOT_M (4) of them, the lowest
   first, are each refined again (central differences, exact faces, the orientation free, at most 30
   iterations, no covariance) from their own vector on
   - 'F' replicas: Poisson draws of the lowest minimum's calculated pattern (the fitted model as the
     truth), BOOT_R (16) of them, and that pattern itself without noise (δ);
   - 'T' replicas: Poisson draws of the generator's own expected counts (the truth with its model
     error, if any), BOOT_R of them, and those counts without noise.
   Each replica's target and weights as buildModel makes them (Mighell's χ²_γ: N + min(N, 1), 1/(N + 1)),
   the model's own restored after. Records stats.boot: { minima: [{ delta, chi2 }], F: { nf: [χ²...],
   reps: [[χ²...]] }, T: {...}, evals, ms }; each refit's χ², χ²_ν and widths W. BOOT_ALL=1: a single
   minimum too (the local error's check). */
import { drawRow } from '../../../gen/gen.mjs';
import { rng, hash } from '../lib.mjs';
const stats = {};
const poisson = (l, u) => { if (l < 30){ const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= u(); } while (p > L); return k - 1; }
  // normal approximation with continuity, fine above 30 counts
  const z = Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u()); return Math.max(0, Math.round(l + Math.sqrt(l)*z)); };
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E, ctx){
    for (const key of Object.keys(stats)) delete stats[key];
    const q = model.phases[k];
    const e0 = E.FS.evals, t0 = Date.now(), m0 = { ...E.FS.min };
    const r = E.freeShape(model, k, res, free, opts);
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    stats.min = { evals: E.FS.min.evals - m0.evals, ms: E.FS.min.ms - m0.ms };
    if (!r || !r.res || !r.info.minima) return r;
    const KEEP = +(process.env.BOOT_KEEP || 30), MM = +(process.env.BOOT_M || 4), R = +(process.env.BOOT_R || 16);
    const mins = r.info.minima.filter(m=> m.delta <= KEEP).slice(0, MM);
    stats.boot = { minima: mins.map(m=> ({ delta: m.delta, chi2: m.chi2, n: m.n, W: m.W })) };
    if (mins.length < 2 && !process.env.BOOT_ALL) return r;
    const lg = E.FS.log; E.FS.log = null;
    const v0 = model.v.slice(), y0 = Float64Array.from(model.y), w0 = Float64Array.from(model.w), keep = { esd: model.esd, cov: model.cov };
    const names = [...new Set([...r.res.free, ...q.iR.map(i=> model.par[i].name)])];
    const F = E.fitSettings(opts.fit), lm = { free: names, maxIter: 30, shiftTol: F.shiftTol, lambda: F.lambda, noCov: true, audit: false };
    const chiTot = rr => rr.stats.chi2*Math.max(1, rr.stats.N - rr.stats.P);
    const e1 = E.FS.evals, t1 = Date.now();
    const fitAll = () => mins.map(m=> { E.setParams(model, Float64Array.from(m.v)); try { const rr = E.refine(model, lm); return { c: chiTot(rr), nu: rr.stats.chi2, W: q.iW.map(i=> model.v[i]) }; } catch(e){ return { c: NaN, nu: NaN }; } });
    const setY = N => { for (let i = 0; i < model.n; i++){ const c = Math.max(0, N[i]); model.y[i] = N[i] + Math.min(c, 1); model.w[i] = 1/(c + 1); } delete model._bgSums; };
    try {
      E.setParams(model, Float64Array.from(mins[0].v));
      const muF = Float64Array.from(E.evaluate(model, model.v).yc);
      const pat = drawRow(ctx.row, { noise: false }), muT = Float64Array.from(pat.yc);
      if (muT.length !== model.n) throw new Error('grid mismatch');
      for (const [nm, mu] of [['F', muF], ['T', muT]]){
        const g = rng(hash(ctx.row.id + '|boot|' + nm)), o = { nf: null, reps: [] };
        setY(mu); o.nf = fitAll();
        for (let t = 0; t < R; t++){ setY(Array.from(mu, l=> poisson(l, g.u))); o.reps.push(fitAll()); }
        stats.boot[nm] = o;
      }
    } catch(e){ stats.boot.error = String(e && e.stack || e); }
    finally { model.y.set(y0); model.w.set(w0); delete model._bgSums; E.setParams(model, v0); model.esd = keep.esd; model.cov = keep.cov; E.FS.log = lg; }
    stats.boot.evals = E.FS.evals - e1; stats.boot.ms = Date.now() - t1;
    return r;
  },
};
