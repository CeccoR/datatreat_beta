/* The app's search (ENG.freeShape, unchanged), and a description of the solid it keeps,
   from the last refinement's own covariance (no extra pattern evaluation): the widths W,
   their covariance with the turns (when the orientation is free), the free vector. Used
   to search each case as every other solid (Occam across solids). */
export default {
  name: 'xc',
  search(model, k, res, free, opts, E){
    const r = E.freeShape(model, k, res, free, opts);
    if (!r || !r.res) return r;
    const q = model.phases[k], rr = r.res;
    const wN = q.iW.map(i=> model.par[i].name), rN = q.iR.map(i=> model.par[i].name);
    const ix = nm => rr.free ? rr.free.indexOf(nm) : -1;
    const names = [...wN, ...rN].filter(n=> ix(n) >= 0);
    const cov = rr.cov ? names.map(a=> names.map(b=> rr.cov[ix(a)][ix(b)])) : null;
    r.info.desc = { names, W: q.iW.map(i=> model.v[i]), R: q.iR.map(i=> model.v[i]), Q: q.iQ.map(i=> model.v[i]), cov, chi2nu: rr.stats.chi2, P: rr.stats.P, N: rr.stats.N };
    return r;
  },
};
