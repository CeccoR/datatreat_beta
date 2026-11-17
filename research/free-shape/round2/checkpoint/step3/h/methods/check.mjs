/* Step 3's method: today's (the pilot's methods/today.mjs: freeShape as autoRefine calls it, then
   the card's report), unchanged, and after it, at the fit returned (the kept shape, else the
   isotropic fit), with the refine log off and model.v and model.w restored at the end:
   1. the per-line check's data: the segments (ck.mjs segments) and their sums, the global χ² and
      Durbin–Watson; the residuals r = √w(y − y_c), the net calculated pattern and the background
      dumped (stats.dump, Float32) for the offline statistics;
   2. on a kept shape, the jackknife over lines: the segments in at most CK_GMAX contiguous groups
      (one each when there are fewer), each group's points weighted 0 and the kept fit refined from
      itself with its own free parameters (a held frame stays held), 4 iterations and then up to 8
      more (CK_JIT = 12 in all), no FCJ audit, no covariance: the solid after 4 and after 12;
   3. on a kept shape, the refit without the k most significant segments (zchi of their χ², k in
      CK_KS): the shape from the kept fit and the isotropic fit from the isotropic one, each to
      convergence (60 iterations at most, no covariance): χ², the parameters, the solid.
   Named 'today' so that step 2's scoring reads its records as today's. */
import today from '../../../pilot/methods/today.mjs';
import { solidOf } from '../lib.mjs';
import { segments, segStats, zchi, b64 } from '../ck.mjs';
const stats = {};
const env = process.env;
const CK = { GMAX: +(env.CK_GMAX || 20), JIT: +(env.CK_JIT || 12), J1: 4, KS: (env.CK_KS || '1,2,3,5').split(',').map(Number), JACK: env.CK_JACK !== '0', DROP: env.CK_DROP !== '0' };
const rnd = (a, d = 6) => a.map(x=> Number.isFinite(x) ? +x.toFixed(d) : x);
const compact = s => ({ dims: rnd(s.dims, 5), axes: s.axes.map(a=> rnd(a, 6)) });
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E, ctx){
    for (const key of Object.keys(stats)) delete stats[key];
    const vIso = model.v.slice();
    const r = today.search(model, k, res, free, opts, E, ctx);
    Object.assign(stats, today.stats);
    const q = model.phases[k], type = q.shapeType, vK = model.v.slice(), kept = !!(r && r.res), F = E.fitSettings(opts.fit);
    const lg = E.FS.log; E.FS.log = null;
    const e0 = E.FS.evals, t0 = Date.now(), w0 = model.w, n = model.n, x = model.x;
    const ck = { kept, CK };
    try {
      // 1. the check's data
      const st = E.evaluate(model, vK), R = new Float64Array(n), net = new Float64Array(n);
      let chi = 0, N = 0, dd = 0, pr = null;
      for (let i = 0; i < n; i++){
        net[i] = st.yc[i] - st.bg[i];
        if (!(w0[i] > 0)){ R[i] = NaN; pr = null; continue; }
        const v = Math.sqrt(w0[i])*(model.y[i] - st.yc[i]); R[i] = v; chi += v*v; N++;
        if (pr != null) dd += (v - pr)**2; pr = v;
      }
      const P = kept ? r.res.stats.P : res.stats.P;
      const ticks = E.calc(model, null, { internal: true }).ticks.filter(t=> t.phase === q.id);
      const segs = segments(Array.from(x), ticks, model.lines);
      const ss = segStats(R, net, segs);
      ck.global = { chi2: chi, N, P, chi2nu: chi/Math.max(1, N - P), dw: dd/chi };
      ck.segs = segs.map((s, i)=> ({ ...s, ...ss[i], z: zchi(ss[i].c, ss[i].n) }));
      stats.dump = { x0: x[0], x1: x[n - 1], n, r: b64(R), net: b64(net), bg: b64(st.bg) };
      const S = ck.segs.length, lmJ = { shiftTol: F.shiftTol, lambda: F.lambda, audit: false, noCov: true };
      const zero = idx => { const W = Float64Array.from(w0); for (const s of idx) for (let i = ck.segs[s].i0; i <= ck.segs[s].i1; i++) W[i] = 0; model.w = W; delete model._bgSums; };
      const restore = () => { model.w = w0; delete model._bgSums; };
      const chiTot = rr => rr.stats.chi2*Math.max(1, rr.stats.N - rr.stats.P);
      // 2. the jackknife over lines
      if (kept && CK.JACK && S >= 3){
        const G = Math.min(S, CK.GMAX), groups = [];
        for (let g = 0; g < G; g++){ const a = Math.floor(g*S/G), b = Math.floor((g + 1)*S/G); groups.push(Array.from({ length: b - a }, (_, j)=> a + j)); }
        ck.jack = { G, drops: [] };
        const ej = E.FS.evals, tj = Date.now();
        for (const [g, idx] of groups.entries()){
          const d = { g, segs: [idx[0], idx[idx.length - 1]] }, e1 = E.FS.evals, t1 = Date.now();
          try {
            zero(idx); E.setParams(model, vK);
            const r4 = E.refine(model, { free: r.res.free, maxIter: CK.J1, ...lmJ });
            Object.assign(d, { c4: chiTot(r4), it4: r4.iterations, ev4: E.FS.evals - e1, s4: compact(solidOf(q, type, model.v)) });
            if (CK.JIT > CK.J1){
              const r12 = E.refine(model, { free: r.res.free, maxIter: CK.JIT - CK.J1, ...lmJ });
              Object.assign(d, { c12: chiTot(r12), it12: r12.iterations, s12: compact(solidOf(q, type, model.v)) });
            }
          } catch(e){ d.error = String(e && e.message || e); }
          finally { restore(); }
          Object.assign(d, { evals: E.FS.evals - e1, ms: Date.now() - t1 });
          ck.jack.drops.push(d);
        }
        Object.assign(ck.jack, { evals: E.FS.evals - ej, ms: Date.now() - tj });
      }
      // 3. the refit without the k most significant segments
      if (kept && CK.DROP && S >= 4){
        const order = ck.segs.map((s, i)=> i).sort((a, b)=> ck.segs[b].z - ck.segs[a].z);
        ck.drop = [];
        for (const kk of CK.KS.filter(kk=> kk <= S - 2)){
          const idx = order.slice(0, kk), d = { k: kk, segs: idx }, e1 = E.FS.evals, t1 = Date.now();
          try {
            zero(idx); E.setParams(model, vK);
            const rs = E.refine(model, { free: r.res.free, maxIter: Math.round(1.5*F.maxIter), ...lmJ });
            Object.assign(d, { shape: { c: chiTot(rs), N: rs.stats.N, P: rs.stats.P, it: rs.iterations, s: compact(solidOf(q, type, model.v)) } });
            E.setParams(model, vIso);
            const ri = E.refine(model, { free, maxIter: Math.round(1.5*F.maxIter), ...lmJ });
            Object.assign(d, { iso: { c: chiTot(ri), N: ri.stats.N, P: ri.stats.P, it: ri.iterations, Ys: model.v[q.iYs] } });
          } catch(e){ d.error = String(e && e.message || e); }
          finally { restore(); }
          Object.assign(d, { evals: E.FS.evals - e1, ms: Date.now() - t1 });
          ck.drop.push(d);
        }
      }
    } catch(e){ ck.error = String(e && e.stack || e); }
    finally { model.w = w0; delete model._bgSums; E.setParams(model, vK); E.FS.log = lg; }
    Object.assign(ck, { evals: E.FS.evals - e0, ms: Date.now() - t0 });
    stats.check = ck;
    return r;
  },
};
