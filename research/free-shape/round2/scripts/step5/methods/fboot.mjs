/* Step 5's family bootstrap (step 4's boot.mjs, across solids): no search; the fit of this solid
   from a record (FBOOT_SRC: a step 5 or step 4 record of the same row and solid; its lowest minimum's
   vector, else none) is refined again (central differences, exact faces, the orientation free, at most
   FBOOT_IT (30) iterations, no covariance) on 'T' replicas: Poisson draws of the generator's own
   expected counts (the truth with its model error), FBOOT_R (16) of them, seeded by the row's key
   alone so that every solid sees the same draws, and on those counts without noise (nf). Each
   replica's target and weights as buildModel makes them (Mighell's χ²_γ). stats.fboot: { src, chi0
   (the record's), nf, reps: [χ²], W: [widths per replica], evals, ms }. */
import fs from 'node:fs';
import { drawRow } from '../../../gen/gen.mjs';
import { rng, hash } from '../lib.mjs';
const stats = {};
const poisson = (l, u) => { if (l < 30){ const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= u(); } while (p > L); return k - 1; }
  const z = Math.sqrt(-2*Math.log(u() || 1e-300))*Math.cos(2*Math.PI*u()); return Math.max(0, Math.round(l + Math.sqrt(l)*z)); };
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E, ctx){
    for (const key of Object.keys(stats)) delete stats[key];
    const q = model.phases[k], src = JSON.parse(fs.readFileSync(process.env.FBOOT_SRC, 'utf8')), rr = src.records[0];
    const mins = rr.v ? [{ v: rr.v, chi2: rr.chi2 }] : rr.info && rr.info.minima;   // the fit returned, else the lowest minimum
    stats.search = { evals: 0, ms: 0 };
    if (!mins || !mins.length){ stats.fboot = { src: process.env.FBOOT_SRC, none: true }; return null; }
    const v0 = Float64Array.from(mins[0].v);
    if (v0.length !== model.v.length) throw new Error('vector length ' + v0.length + ' against ' + model.v.length);
    const lg = E.FS.log; E.FS.log = null;
    const names = [...new Set([...free.filter(nm=> nm !== q.pfx + 'Ys'), ...q.iW.map(i=> model.par[i].name), ...q.iR.map(i=> model.par[i].name)])];
    const F = E.fitSettings(opts.fit), lm = { free: names, maxIter: +(process.env.FBOOT_IT || 30), shiftTol: F.shiftTol, lambda: F.lambda, noCov: true, audit: false };
    const chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
    const y0 = Float64Array.from(model.y), w0 = Float64Array.from(model.w);
    const setY = N => { for (let i = 0; i < model.n; i++){ const c = Math.max(0, N[i]); model.y[i] = N[i] + Math.min(c, 1); model.w[i] = 1/(c + 1); } delete model._bgSums; };
    const fit = () => { E.setParams(model, v0); try { const r = E.refine(model, lm); return { c: chiTot(r), W: q.iW.map(i=> model.v[i]) }; } catch(e){ return { c: NaN, W: null }; } };
    const e1 = E.FS.evals, t1 = Date.now(), R = +(process.env.FBOOT_R || 16);
    const o = { src: process.env.FBOOT_SRC, chi0: mins[0].chi2, reps: [], W: [] };
    try {
      // the record's own data: its fit refined again (a check that the start is the record's minimum)
      { const r0 = fit(); o.data = r0.c; }
      const mu = Float64Array.from(drawRow(ctx.row, { noise: false }).yc);
      if (mu.length !== model.n) throw new Error('grid mismatch');
      setY(mu); o.nf = fit().c;
      for (let t = 0; t < R; t++){ const g = rng(hash(ctx.row.key + '|fboot|' + t)); setY(Array.from(mu, l=> poisson(l, g.u))); const r = fit(); o.reps.push(r.c); o.W.push(r.W); }
    } catch(e){ o.error = String(e && e.stack || e); }
    finally { model.y.set(y0); model.w.set(w0); delete model._bgSums; E.setParams(model, v0); E.FS.log = lg; }
    o.evals = E.FS.evals - e1; o.ms = Date.now() - t1;
    stats.fboot = o;
    return null;
  },
};
