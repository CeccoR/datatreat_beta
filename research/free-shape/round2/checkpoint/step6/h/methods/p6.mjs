/* Step 6's method: the prototype as the app runs it (freeShape, then the card's report, bodyShapeOf),
   the report kept whole (step 4's min.mjs) with the keep test's numbers, the family verdict, the
   per-line check, the minima list and the stage's cost and rounds (step 5's fam.mjs). Named 'today'
   so that the earlier scoring reads its records. Environment (unset: the engine's defaults):
   MIN_SET='max=3,rounds=3' SHAPE_MINIMA's tunables, KEEP_SET='rule=bic' SHAPE_KEEP's, FAMILY_SET=
   'solids=general' SHAPE_FAMILY's, CHECK_SET='retest=true' SHAPE_CHECK's (';' for ',' in a job line). */
const stats = {};
const num = v => (v === 'true' ? true : v === 'false' ? false : Number.isFinite(+v) ? +v : v);
const set = (obj, env, nm) => { for (const kv of String(process.env[env] || '').split(',').filter(Boolean)){ const [kk, vv] = kv.split('='); if (!(kk in obj)) throw new Error(nm + ': no ' + kk); obj[kk] = num(vv); } };
const pick = a => ({ role: a.role, axis: a.axis, D: a.D, Desd: a.Desd, Dmin: a.Dmin, label: a.label, uvw: a.uvw, angle: a.angle, esdAngle: a.esdAngle, group: a.group, own: a.own, resolved: a.resolved,
  jackTurn: a.jackTurn, e: a.e, set: a.set, betweenDeg: a.betweenDeg, radius: a.radius });
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E){
    for (const key of Object.keys(stats)) delete stats[key];
    set(E.SHAPE_MINIMA, 'MIN_SET', 'MIN_SET'); set(E.SHAPE_KEEP, 'KEEP_SET', 'KEEP_SET'); set(E.SHAPE_FAMILY, 'FAMILY_SET', 'FAMILY_SET'); set(E.SHAPE_CHECK, 'CHECK_SET', 'CHECK_SET');
    const q = model.phases[k];
    stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
    stats.settings = { minima: { ...E.SHAPE_MINIMA }, keep: { ...E.SHAPE_KEEP }, family: { ...E.SHAPE_FAMILY }, check: { ...E.SHAPE_CHECK }, fill: process.env.PROTO_FILL || null, y0f: process.env.PROTO_Y0F || null, ysIso: model.v[q.iYs] };
    E.FS.min.rmax = 0;
    const e0 = E.FS.evals, t0 = Date.now(), m0 = { ...E.FS.min };
    const r = E.freeShape(model, k, res, free, opts);
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    stats.min = { evals: E.FS.min.evals - m0.evals, ms: E.FS.min.ms - m0.ms, rmax: E.FS.min.rmax };
    const chk = r ? (r.info ? r.info.check : r.check) : null;
    if (chk) stats.check = { ...chk, cuts: undefined, nCuts: chk.cuts ? chk.cuts.length : null };
    stats.keep = r ? (r.info ? r.info.keep : r.keep) || null : null;
    stats.family = r ? (r.info ? r.info.family : r.family) || null : null;
    if (r && r.info && r.info.minima) stats.minima = r.info.minima.map(m=> ({ chi2: m.chi2, delta: m.delta, W: m.W, R: m.R, n: m.n, kicks: m.kicks }));
    if (r && r.res){
      const v = model.v.slice(), lg = E.FS.log; E.FS.log = null;
      const e1 = E.FS.evals, t1 = Date.now();
      let rep;
      try {
        const bs = E.bodyShapeOf(model, v, k, { ...r.res, shapes: { [q.id]: r.info } });
        rep = { kind: bs.kind, dims: bs.dims.map(d=> ({ name: d.name, D: d.D, Desd: d.Desd, Dmin: d.Dmin, jackLo: d.jackLo, jackHi: d.jackHi, betweenLo: d.betweenLo, betweenHi: d.betweenHi, sLocal: d.sLocal, lo: d.lo, hi: d.hi })),
          groups: bs.groups, axes: bs.axes.map(pick), sets: bs.sets, misfit: bs.misfit, minima: bs.minima, keep: bs.keep || null, family: bs.family || null };
      } catch(e){ rep = { error: String(e && e.stack || e) }; }
      E.setParams(model, v);
      Object.assign(rep, { evals: E.FS.evals - e1, ms: Date.now() - t1 });
      stats.report = rep;
      E.FS.log = lg;
    }
    return r;
  },
};
