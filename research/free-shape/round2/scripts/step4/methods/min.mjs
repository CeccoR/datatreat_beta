/* Step 4's method on the prototype with the minima stage (SHAPE_MINIMA in xrd-rietveld.js): the search
   and the card's report (bodyShapeOf) with the engine's defaults, the report kept whole (the local
   errors Desd, esdAngle; the second errors betweenLo, betweenHi, betweenDeg; the sets; minima), the
   check (stats.check) and the stage's cost (stats.min: FS.min, make-eng.mjs). Environment:
   MIN_OFF=1 the stage off (step 3's prototype); MIN_SET='max=20,collect=50' tunables of SHAPE_MINIMA;
   FIT_STARTS, FIT_FULL the search's shapeStarts and shapeFull (autoRefine's fit settings: the dense
   reference); CK_OFF=1 the check off. Named 'today' so that the earlier scoring reads its records. */
const stats = {};
const pick = a => ({ role: a.role, axis: a.axis, D: a.D, Desd: a.Desd, Dmin: a.Dmin, label: a.label, uvw: a.uvw, angle: a.angle, esdAngle: a.esdAngle, group: a.group, own: a.own, resolved: a.resolved,
  jackTurn: a.jackTurn, e: a.e, set: a.set, betweenDeg: a.betweenDeg, radius: a.radius });
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E){
    for (const key of Object.keys(stats)) delete stats[key];
    if (process.env.CK_OFF) E.SHAPE_CHECK.on = false;
    if (process.env.MIN_OFF) E.SHAPE_MINIMA.on = false;
    for (const kv of String(process.env.MIN_SET || '').split(',').filter(Boolean)){ const [kk, vv] = kv.split('='); if (!(kk in E.SHAPE_MINIMA)) throw new Error('MIN_SET: no ' + kk); E.SHAPE_MINIMA[kk] = +vv; }
    const fit = { ...(opts.fit || {}) };
    if (process.env.FIT_STARTS) fit.shapeStarts = +process.env.FIT_STARTS;
    if (process.env.FIT_FULL) fit.shapeFull = +process.env.FIT_FULL;
    const q = model.phases[k];
    stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
    stats.settings = { minima: { ...E.SHAPE_MINIMA }, fit, turnSeed: process.env.PROTO_TURNSEED || null };
    const e0 = E.FS.evals, t0 = Date.now(), m0 = { ...E.FS.min };
    const r = E.freeShape(model, k, res, free, { ...opts, fit });
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    stats.min = { evals: E.FS.min.evals - m0.evals, ms: E.FS.min.ms - m0.ms };
    const chk = r ? (r.info ? r.info.check : r.check) : null;
    if (chk) stats.check = { ...chk, cuts: undefined, S: chk.S, nCuts: chk.cuts.length };
    if (r && r.res){
      const v = model.v.slice(), lg = E.FS.log; E.FS.log = null;
      const e1 = E.FS.evals, t1 = Date.now();
      let rep;
      try {
        const bs = E.bodyShapeOf(model, v, k, { ...r.res, shapes: { [q.id]: r.info } });
        rep = { kind: bs.kind, dims: bs.dims.map(d=> ({ name: d.name, D: d.D, Desd: d.Desd, Dmin: d.Dmin, jackLo: d.jackLo, jackHi: d.jackHi, betweenLo: d.betweenLo, betweenHi: d.betweenHi, sLocal: d.sLocal, lo: d.lo, hi: d.hi })),
          groups: bs.groups, axes: bs.axes.map(pick), sets: bs.sets, misfit: bs.misfit, minima: bs.minima };
      } catch(e){ rep = { error: String(e && e.stack || e) }; }
      E.setParams(model, v);
      Object.assign(rep, { evals: E.FS.evals - e1, ms: Date.now() - t1 });
      stats.report = rep;
      E.FS.log = lg;
    }
    return r;
  },
};
