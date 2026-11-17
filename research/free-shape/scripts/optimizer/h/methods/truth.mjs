/* A reference, not a search: the solid refined from the truth (its widths and orientation,
   every other parameter at the isotropic fit, Y_s at 0) as freeShape refines its best:
   (1) fully with the faces rounded (shapeSoft, 1°), (2) again with the exact solid, its
   orientation free, (3) the exact solid with its orientation held at the truth's. From the
   truth itself, on lattice directions, the exact solid's kinks stop least squares at once
   (RIETVELD.md §10.6): (1) is what lets it move. It locates the minimum next to the truth
   for the "best χ² any run found"; the record's chi2Free and chi2Held are (2) and (3).
   Reads ctx.truth (reference: true). */
export default {
  name: 'truth', reference: true,
  search(model, k, res, free, opts, E, ctx){
    const t = ctx.truth && ctx.truth.P;
    if (!t || !ctx.truth.solid) return null;
    const q = model.phases[k], pf = q.pfx, F = E.fitSettings(opts.fit);
    const lm = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
    const rot = q.iR.map(i=> model.par[i].name);
    const names = free.filter(nm=> nm !== pf + 'Ys').concat(q.iW.map(i=> model.par[i].name), rot);
    const v0 = model.v.slice(); v0[q.iYs] = 0;
    for (const i of [...q.iW, ...q.iQ]) v0[i] = t[model.par[i].name];
    q.iR.forEach(i=> { v0[i] = 0; });
    const fits = [];
    const go = (v, nm, soft) => {
      E.setParams(model, v); model.shapeSoft = soft && E.BODIES[q.shapeType].base !== 'ball' ? { q, soft: E.SHAPE_SOFT } : null;
      try { const r = E.refine(model, { free: nm, ...lm }); return { r, v: model.v.slice() }; }
      catch(e){ return null; } finally { model.shapeSoft = null; }
    };
    const s = go(v0, names, true);
    // the orientation reached becomes the reference (r = 0), as freeShape's rebase
    const rebase = v => { const vv = v.slice(), R = E.bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((x, i)=> { vv[q.iQ[i]] = x; }); return vv; };
    const ex = go(rebase(s ? s.v : v0), names, false); if (ex) fits.push(ex);
    const hd = go(v0, names.filter(n=> !rot.includes(n)), false); if (hd) fits.push(hd);
    if (!fits.length) return null;
    const chi = f => f.r.stats.chi2*Math.max(1, f.r.stats.N - f.r.stats.P);
    const best = fits.sort((a, b)=> chi(a) - chi(b))[0];
    E.setParams(model, best.v);
    return { res: best.r, info: { type: q.shapeType, reference: 'truth', held: best === hd } };
  },
};
