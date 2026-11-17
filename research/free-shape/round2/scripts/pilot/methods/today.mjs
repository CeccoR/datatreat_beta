/* Today's search and report (b9bef5f, unchanged): freeShape as autoRefine calls it, then,
   when a solid is kept, the card's report of it, bodyShapeOf (the dimensions' linear esds
   and the axes' angular esds by profile, turnEsds), as the worker's summarise calls it
   through shapeOf. The two are timed apart: `stats` (read by run.mjs after the run) holds
   the search's and the report's evaluations and ms, and the model's list (reflections,
   members, points). The report's refinements are not logged with the search's. */
const stats = {};
const pick = a => ({ role: a.role, axis: a.axis, D: a.D, Desd: a.Desd, Dmin: a.Dmin, label: a.label, uvw: a.uvw, angle: a.angle, esdAngle: a.esdAngle, group: a.group, own: a.own, resolved: a.resolved });
export default {
  name: 'today', stats,
  search(model, k, res, free, opts, E){
    for (const key of Object.keys(stats)) delete stats[key];
    const q = model.phases[k];
    stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
    const e0 = E.FS.evals, t0 = Date.now();
    const r = E.freeShape(model, k, res, free, opts);
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    if (r && r.res){
      const v = model.v.slice(), lg = E.FS.log; E.FS.log = null;
      const e1 = E.FS.evals, t1 = Date.now();
      let rep;
      try {
        const bs = E.bodyShapeOf(model, v, k, { ...r.res, shapes: { [q.id]: r.info } });
        rep = { kind: bs.kind, dims: bs.dims.map(d=> ({ name: d.name, D: d.D, Desd: d.Desd, Dmin: d.Dmin })), groups: bs.groups, axes: bs.axes.map(pick) };
      } catch(e){ rep = { error: String(e && e.stack || e) }; }
      E.setParams(model, v); E.FS.log = lg;
      Object.assign(rep, { evals: E.FS.evals - e1, ms: Date.now() - t1 });
      stats.report = rep;
    }
    return r;
  },
};
