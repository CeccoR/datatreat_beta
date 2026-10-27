/* Verifier's method: a rival solid refined from a given start, as the harness's truth
   reference refines the truth (../../harness/methods/truth.mjs, copied and changed only in
   where the start comes from): the widths W and quaternion Q from FS2V_START (JSON
   {"W": [...], "Q": [...]}, e.g. colmatch.json's best column-length match of that solid),
   every other parameter at the isotropic fit, Ys at 0; (1) faces rounded, (2) exact free,
   (3) exact held at the start's orientation. Used with run.mjs --shape <rival>. */
export default {
  name: 'rival', reference: false,
  search(model, k, res, free, opts, E, ctx){
    const st = JSON.parse(process.env.FS2V_START);
    const q = model.phases[k], pf = q.pfx, F = E.fitSettings(opts.fit);
    const lm = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
    const rot = q.iR.map(i=> model.par[i].name);
    const names = free.filter(nm=> nm !== pf + 'Ys').concat(q.iW.map(i=> model.par[i].name), rot);
    const v0 = model.v.slice(); v0[q.iYs] = 0;
    q.iW.forEach((i, j)=> { v0[i] = st.W[j]; });
    q.iQ.forEach((i, j)=> { v0[i] = st.Q[j]; });
    q.iR.forEach(i=> { v0[i] = 0; });
    const fits = [];
    const go = (v, nm, soft) => {
      E.setParams(model, v); model.shapeSoft = soft && E.BODIES[q.shapeType].base !== 'ball' ? { q, soft: E.SHAPE_SOFT } : null;
      try { const r = E.refine(model, { free: nm, ...lm }); return { r, v: model.v.slice() }; }
      catch(e){ return null; } finally { model.shapeSoft = null; }
    };
    const s = go(v0, names, true);
    const rebase = v => { const vv = v.slice(), R = E.bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((x, i)=> { vv[q.iQ[i]] = x; }); return vv; };
    const ex = go(rebase(s ? s.v : v0), names, false); if (ex) fits.push(ex);
    const hd = go(v0, names.filter(n=> !rot.includes(n)), false); if (hd) fits.push(hd);
    if (!fits.length) return null;
    const chi = f => f.r.stats.chi2*Math.max(1, f.r.stats.N - f.r.stats.P);
    const best = fits.sort((a, b)=> chi(a) - chi(b))[0];
    E.setParams(model, best.v);
    return { res: best.r, info: { type: q.shapeType, reference: 'rival', held: best === hd } };
  },
};
