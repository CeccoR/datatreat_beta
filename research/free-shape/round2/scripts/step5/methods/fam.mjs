/* Step 5's method: the search as the app runs it (no report unless FAM_REPORT=1), the keep test's
   numbers (info.keep, or keep beside a rejection: SHAPE_KEEP.record), the per-line check of the fit
   returned, the minima stage's count. Environment: KEEP_SET='rule=all,early=0' SHAPE_KEEP's
   tunables; MIN_OFF=1 the minima stage off; MIN_SET as step 4's; CK_OFF=1 the check off. */
const stats = {};
const num = v => (v === 'true' ? true : v === 'false' ? false : Number.isFinite(+v) ? +v : v);
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E){
    for (const key of Object.keys(stats)) delete stats[key];
    if (process.env.CK_OFF) E.SHAPE_CHECK.on = false;
    if (process.env.MIN_OFF) E.SHAPE_MINIMA.on = false;
    for (const kv of String(process.env.MIN_SET || '').split(',').filter(Boolean)){ const [kk, vv] = kv.split('='); if (!(kk in E.SHAPE_MINIMA)) throw new Error('MIN_SET: no ' + kk); E.SHAPE_MINIMA[kk] = num(vv); }
    for (const kv of String(process.env.KEEP_SET || '').split(',').filter(Boolean)){ const [kk, vv] = kv.split('='); if (!(kk in E.SHAPE_KEEP)) throw new Error('KEEP_SET: no ' + kk); E.SHAPE_KEEP[kk] = num(vv); }
    for (const kv of String(process.env.FAMILY_SET || '').split(',').filter(Boolean)){ const [kk, vv] = kv.split('='); if (!(kk in E.SHAPE_FAMILY)) throw new Error('FAMILY_SET: no ' + kk); E.SHAPE_FAMILY[kk] = num(vv); }
    const q = model.phases[k];
    stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
    stats.settings = { keep: { ...E.SHAPE_KEEP }, minimaOn: E.SHAPE_MINIMA.on };
    const e0 = E.FS.evals, t0 = Date.now(), m0 = { ...E.FS.min };
    const r = E.freeShape(model, k, res, free, opts);
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    stats.min = { evals: E.FS.min.evals - m0.evals, ms: E.FS.min.ms - m0.ms };
    const chk = r ? (r.info ? r.info.check : r.check) : null;
    if (chk) stats.check = { flagged: chk.flagged, zSeg: chk.zSeg, zBin: chk.zBin, S: chk.S };
    stats.keep = r ? (r.info ? r.info.keep : r.keep) || null : null;
    stats.family = r ? (r.info ? r.info.family : r.family) || null : null;
    if (r && r.res) stats.v = Array.from(model.v);   // the fit returned (after the central pass)
    if (r && r.info && r.info.minima) stats.minima = r.info.minima.map(m=> ({ chi2: m.chi2, delta: m.delta, W: m.W, R: m.R }));
    if (r && r.res && process.env.FAM_REPORT){
      const v = model.v.slice(), lg = E.FS.log; E.FS.log = null; const e1 = E.FS.evals, t1 = Date.now();
      try { const bs = E.bodyShapeOf(model, v, k, { ...r.res, shapes: { [q.id]: r.info } }); stats.report = { kind: bs.kind, family: bs.family || null, keep: bs.keep || null, dims: bs.dims.map(d=> ({ name: d.name, D: d.D, lo: d.lo, hi: d.hi })), misfit: bs.misfit, minima: bs.minima ? { n: bs.minima.n, unique: bs.minima.unique } : null }; }
      catch(e){ stats.report = { error: String(e && e.stack || e) }; }
      E.setParams(model, v); Object.assign(stats.report, { evals: E.FS.evals - e1, ms: Date.now() - t1 }); E.FS.log = lg;
    }
    return r;
  },
};
