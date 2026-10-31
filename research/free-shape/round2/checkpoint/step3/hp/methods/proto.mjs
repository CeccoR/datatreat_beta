/* Step 3's verification method on the prototype's engine (SHAPE_CHECK in xrd-rietveld.js): today's
   search and report (the pilot's methods/today.mjs) with the engine's defaults, the report kept whole
   (the dimensions' jackLo, jackHi, the axes' jackTurn, misfit), and the check (info.check, or check
   beside a rejection) in stats.check. With CK_MEASURE (default on), on a kept shape whose check fired:
   the shape refitted without the flagged segments from the kept fit and the isotropic fit from its own
   (60 iterations at most, no covariance), all the flagged segments ('all', when at least 2 segments are
   left) and at most a third of the segments, the worst first ('third'): χ², N, P, the solid; model.v,
   the weights, the esds and the covariance restored. CK_RETEST=1 sets SHAPE_CHECK.retest. Named
   'today' so that step 2's scoring reads its records. */
import { solidOf } from '../lib.mjs';
const stats = {};
const pick = a => ({ role: a.role, axis: a.axis, D: a.D, Desd: a.Desd, Dmin: a.Dmin, label: a.label, uvw: a.uvw, angle: a.angle, esdAngle: a.esdAngle, group: a.group, own: a.own, resolved: a.resolved, jackTurn: a.jackTurn });
const rnd = (a, d = 6) => a.map(x=> Number.isFinite(x) ? +x.toFixed(d) : x);
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E){
    for (const key of Object.keys(stats)) delete stats[key];
    if (process.env.CK_RETEST) E.SHAPE_CHECK.retest = true;
    const q = model.phases[k], vIso = model.v.slice();
    stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
    const e0 = E.FS.evals, t0 = Date.now();
    const r = E.freeShape(model, k, res, free, opts);
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    const chk = r ? (r.info ? r.info.check : r.check) : null;
    if (chk) stats.check = { ...chk, cuts: undefined, S: chk.S, nCuts: chk.cuts.length };
    if (r && r.res){
      const v = model.v.slice(), lg = E.FS.log; E.FS.log = null;
      const e1 = E.FS.evals, t1 = Date.now();
      let rep;
      try {
        const bs = E.bodyShapeOf(model, v, k, { ...r.res, shapes: { [q.id]: r.info } });
        rep = { kind: bs.kind, dims: bs.dims.map(d=> ({ name: d.name, D: d.D, Desd: d.Desd, Dmin: d.Dmin, jackLo: d.jackLo, jackHi: d.jackHi })), groups: bs.groups, axes: bs.axes.map(pick), misfit: bs.misfit };
      } catch(e){ rep = { error: String(e && e.stack || e) }; }
      E.setParams(model, v);
      Object.assign(rep, { evals: E.FS.evals - e1, ms: Date.now() - t1 });
      stats.report = rep;
      // the refits without the flagged segments
      if (chk && chk.flagged && process.env.CK_MEASURE !== '0'){
        const F = E.fitSettings(opts.fit), lm = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda, audit: false, noCov: true };
        const worst = [...chk.segs].sort((a, b)=> Math.max(b.zSeg, b.zBin) - Math.max(a.zSeg, a.zBin));
        const sets = { all: chk.segs.length <= chk.S - 2 ? chk.segs : null, third: worst.slice(0, Math.max(1, Math.floor(chk.S/3))) };
        stats.drop = {};
        const e2 = E.FS.evals, t2 = Date.now();
        for (const [nm, set] of Object.entries(sets)){
          if (!set) continue;
          if (nm === 'third' && set.length === chk.segs.length && stats.drop.all){ stats.drop.third = stats.drop.all; continue; }
          const w0 = model.w, keep = { esd: model.esd, cov: model.cov }, W = Float64Array.from(w0);
          for (const sg of set) for (let i = sg.i0; i <= sg.i1; i++) W[i] = 0;
          const d = { segs: set.map(sg=> sg.s), ev0: E.FS.evals };
          try {
            model.w = W; delete model._bgSums;
            E.setParams(model, v);
            const rs = E.refine(model, { free: r.res.free, ...lm });
            d.shape = { c: rs.stats.chi2*Math.max(1, rs.stats.N - rs.stats.P), N: rs.stats.N, P: rs.stats.P, it: rs.iterations, s: (s=> ({ dims: rnd(s.dims, 5), axes: s.axes.map(a=> rnd(a)) }))(solidOf(q, q.shapeType, model.v)) };
            d.evShape = E.FS.evals - d.ev0;
            E.setParams(model, vIso);
            const ri = E.refine(model, { free, ...lm });
            d.iso = { c: ri.stats.chi2*Math.max(1, ri.stats.N - ri.stats.P), N: ri.stats.N, P: ri.stats.P, it: ri.iterations };
          } catch(e){ d.error = String(e && e.message || e); }
          finally { model.w = w0; delete model._bgSums; E.setParams(model, v); model.esd = keep.esd; model.cov = keep.cov; }
          d.evals = E.FS.evals - d.ev0; delete d.ev0;
          stats.drop[nm] = d;
        }
        stats.drop.evals = E.FS.evals - e2; stats.drop.ms = Date.now() - t2;
      }
      E.FS.log = lg;
    }
    return r;
  },
};
