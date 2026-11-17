/* Step 5's likelihood-ratio test by a quick parametric bootstrap from the isotropic fit. The search as
   the app runs it (the gain G recorded, KEEP_SET as fam.mjs); then LRT_B (19) replicas, Poisson draws of
   the isotropic fit's calculated pattern (seeded by the row's key): on each, the isotropic fit refined
   again from itself (central, LRT_ISO_IT 20 iterations) and the shape searched quickly (the class's
   starts, or the sphere-like one alone unless LRT_ALLSTARTS, LRT_FULL (1) full refinement, no check, no
   early rejection, no shape kept: no minima stage); G* = (χ²_iso* − χ²_shape*)/max(1, χ²_ν,iso*). stats.lrt: { G, reps: [G*], p, evals, ms }. */
import fam from './fam.mjs';
import { rng, hash } from '../lib.mjs';
const stats = fam.stats;
const poisson = (l, u) => { if (l < 30){ const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= u(); } while (p > L); return k - 1; }
  const z = Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u()); return Math.max(0, Math.round(l + Math.sqrt(l)*z)); };
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E, ctx){
    const vIso = model.v.slice(), y0 = Float64Array.from(model.y), w0 = Float64Array.from(model.w);
    const r = fam.search(model, k, res, free, opts, E, ctx);
    const kp = stats.keep, nu0 = Math.max(1, res.stats.chi2);
    const gOf = k2 => { const g = [k2.gainFree, k2.gainHeld, k2.gain].map(Number).filter(Number.isFinite); return g.length ? Math.max(...g) : k2.gainBrief; };
    const G = kp ? gOf(kp) : NaN;
    const vEnd = model.v.slice(), lg = E.FS.log; E.FS.log = null;
    const keep = { ...E.SHAPE_KEEP }, minOn = E.SHAPE_MINIMA.on, ckOn = E.SHAPE_CHECK.on, famS = E.SHAPE_FAMILY ? E.SHAPE_FAMILY.solids : null;
    const B = +(process.env.LRT_B || 19), F = E.fitSettings(opts.fit), chiTot = rr => rr.stats.chi2*Math.max(1, rr.stats.N - rr.stats.P);
    const e1 = E.FS.evals, t1 = Date.now(), reps = [];
    try {
      Object.assign(E.SHAPE_KEEP, { rule: 'bic', bic: 1e9, early: 0, record: true }); E.SHAPE_CHECK.on = false; if (famS) E.SHAPE_FAMILY.solids = 'none';   // never kept: no minima stage, the gain recorded
      E.setParams(model, vIso);
      const mu = Float64Array.from(E.evaluate(model, model.v).yc);
      for (let t = 0; t < B; t++){
        const g = rng(hash(ctx.row.key + '|lrt|' + t));
        for (let i = 0; i < model.n; i++){ const c = poisson(mu[i], g.u); model.y[i] = c + Math.min(c, 1); model.w[i] = 1/(c + 1); }
        delete model._bgSums;
        E.setParams(model, vIso);
        let ri; try { ri = E.refine(model, { free, maxIter: +(process.env.LRT_ISO_IT || 20), shiftTol: F.shiftTol, lambda: F.lambda }); } catch(e){ reps.push(NaN); continue; }
        const nu = Math.max(1, ri.stats.chi2), ci = chiTot(ri), vi = model.v.slice();
        let rs = null; try { rs = E.freeShape(model, k, ri, free, { ...opts, sphereStart: !process.env.LRT_ALLSTARTS, fit: { ...(opts.fit || {}), shapeFull: +(process.env.LRT_FULL || 1) } }); } catch(e){ rs = null; }
        const kk = rs ? (rs.info ? rs.info.keep : rs.keep) : null;
        reps.push(kk ? gOf(kk)*kk.nu/nu : NaN);
        E.setParams(model, vi);
      }
    } finally {
      Object.assign(E.SHAPE_KEEP, keep); E.SHAPE_MINIMA.on = minOn; E.SHAPE_CHECK.on = ckOn; if (famS) E.SHAPE_FAMILY.solids = famS;
      model.y.set(y0); model.w.set(w0); delete model._bgSums; E.setParams(model, vEnd); E.FS.log = lg;
    }
    const ok = reps.filter(Number.isFinite);
    stats.lrt = { G, reps, p: (1 + ok.filter(x=> x >= G).length)/(ok.length + 1), evals: E.FS.evals - e1, ms: Date.now() - t1, searchEvals: stats.search.evals };
    return r;
  },
};
