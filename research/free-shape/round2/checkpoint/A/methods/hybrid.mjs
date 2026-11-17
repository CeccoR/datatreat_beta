/* The (b) line for the search, the exact line for the end (Track A's hybrid). Run with
   FS2A_LINE=lsq and the lorentz profile, alone (--method hybrid): it leaves the phase on WPPM.
   1. today's search (freeShape as autoRefine calls it) with the process's tabulated TCH line;
   2. the phase switched to the engine's WPPM profile (q.wppm, read at every evaluation):
      - the isotropic fit refined again from its own state (its free parameters);
      - the search's lowest distinct full-refinement ends (its log: the full, exact, held and
        polish refinements, up to K = 3, distinct when their width tensors Σ W_i² e_i e_iᵀ
        differ by over 5 %, the search's own kept end always among them) each refined again
        from its end with its own free set (a held end stays held), faces exact; the lowest
        WPPM χ² is the result. (One polish of the search's best alone cannot leave its basin:
        where the tabulated line cannot tell an elliptic cylinder's height from another
        extent, the exact line can, but only from the right basin.)
      - the keep criterion made again in WPPM: ΔBIC = (χ² − χ²_iso)/max(1, χ²_ν,iso) + ΔP·ln N
        < −10, as freeShape's;
   3. the card's report (bodyShapeOf) on the kept solid, in WPPM.
   The search's log stays the search's (lsq χ²: rec.chi2Free/Held and reach are in lsq terms);
   rec.chi2, rec.dBIC and the solid (rec.solid, its accuracy) are WPPM's. `stats` holds the
   search's, the end's and the report's evaluations and ms, and the lsq outcome. */
const stats = {};
const K = 3;
const pick = a => ({ role: a.role, axis: a.axis, D: a.D, Desd: a.Desd, label: a.label, uvw: a.uvw, angle: a.angle, esdAngle: a.esdAngle, group: a.group });
export default {
  name: 'hybrid', stats,
  search(model, k, res, free, opts, E){
    for (const key of Object.keys(stats)) delete stats[key];
    const q = model.phases[k], vIso = model.v.slice(), B = E.BODIES[q.shapeType];
    if (q.wppm) throw new Error('hybrid: run with the lorentz profile (FS2A_PROFILE unset) and FS2A_LINE=lsq');
    stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
    const e0 = E.FS.evals, t0 = Date.now(), log0 = E.FS.log ? E.FS.log.length : 0;
    const r = E.freeShape(model, k, res, free, opts);
    stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
    stats.lsq = r ? (r.res ? { kept: true, held: r.info.held, dBIC: (r.info.chi2 - r.info.chi2Iso)/Math.max(1, r.info.chi2redIso) + (r.info.P - r.info.Piso)*Math.log(r.info.N), chi2: r.info.chi2 } : { kept: false, rejected: !!r.rejected, early: !!r.early, dBIC: r.dBIC }) : null;
    // (a rejected solid ends here, unless the early rejection is off (FS2A_NOEARLY, the
    // cross-solid fits): then its search's ends are polished too, for its WPPM minimum)
    if (!r || (!r.res && !(E.NO_EARLY && r.rejected && !r.early))) return r;
    const vS = model.v.slice(), lg = E.FS.log; E.FS.log = null;
    const F = E.fitSettings(opts.fit), lm = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
    const chiTot = x => x.stats.chi2*Math.max(1, x.stats.N - x.stats.P);
    const nW = q.iW.length, nR = q.iR.length;
    // an end's shape parameters ([...iW, ...iR, ...iQ]) on the search's final state; its width tensor
    const put = to => { const v = vS.slice(); q.iW.forEach((i, j)=> { v[i] = to[j]; }); q.iR.forEach((i, j)=> { v[i] = to[nW + j]; }); q.iQ.forEach((i, j)=> { v[i] = to[nW + nR + j]; }); return v; };
    const tensor = v => { const R = E.bodyFrame(q, v), w = B.axes(q.iW.map(i=> v[i])), M = new Array(9).fill(0);
      for (let a = 0; a < 3; a++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3*i + j] += w[a]*w[a]*R[3*i + a]*R[3*j + a];
      return M; };
    const dist = (A, Bm) => Math.sqrt(A.reduce((s, x, i)=> s + (x - Bm[i])**2, 0)/Math.max(1e-30, A.reduce((s, x)=> s + x*x, 0)));
    const ends = r.res ? [{ v: vS, held: !!r.info.held, chi2: r.info.chi2, own: true }] : [];
    for (const e of (lg || []).slice(log0)) if (!e.error && e.maxIter > 8 && Number.isFinite(e.chi2) && e.to) ends.push({ v: put(e.to), held: !e.rotFree, chi2: e.chi2 });
    ends.sort((a, b)=> (b.own ? 1 : 0) - (a.own ? 1 : 0) || a.chi2 - b.chi2);
    const pickd = [];
    for (const e of ends[0] && ends[0].own ? [ends[0], ...ends.slice(1).sort((a, b)=> a.chi2 - b.chi2)] : ends.slice().sort((a, b)=> a.chi2 - b.chi2)){
      const M = tensor(e.v);
      if (pickd.some(p=> p.held === e.held && dist(p.M, M) < 0.05)) continue;
      pickd.push({ ...e, M }); if (pickd.length >= K) break;
    }
    const e1 = E.FS.evals, t1 = Date.now();
    q.wppm = true; model.shapeSoft = null;
    try {
      E.setParams(model, vIso); const isoW = E.refine(model, { free, ...lm });
      const vIsoW = model.v.slice();
      const rot = q.iR.map(i=> model.par[i].name), base = free.filter(nm=> nm !== q.pfx + 'Ys').concat(q.iW.map(i=> model.par[i].name));
      let best = null, bestFree = null, bestHeld = null;
      stats.ends = [];
      for (const p of pickd){
        E.setParams(model, p.v);
        let rr; try { rr = E.refine(model, { free: p.held ? base : base.concat(rot), ...lm }); } catch(e){ continue; }
        stats.ends.push({ lsqChi2: p.chi2, held: p.held, own: !!p.own, wppmChi2: chiTot(rr) });
        if (!best || chiTot(rr) < chiTot(best.res)) best = { res: rr, v: model.v.slice(), held: p.held };
        if (p.held){ if (bestHeld == null || chiTot(rr) < bestHeld) bestHeld = chiTot(rr); } else if (bestFree == null || chiTot(rr) < bestFree) bestFree = chiTot(rr);
      }
      stats.end = { evals: E.FS.evals - e1, ms: Date.now() - t1, polished: pickd.length };
      if (!best){ q.wppm = false; E.setParams(model, vS); E.FS.log = lg; return r; }   // (nothing polished: the search's result stands)
      const shW = best.res, N = shW.stats.N, dBIC = (chiTot(shW) - chiTot(isoW))/Math.max(1, isoW.stats.chi2) + (shW.stats.P - isoW.stats.P)*Math.log(N);
      stats.wppm = { dBIC, chi2: chiTot(shW), chi2Iso: chiTot(isoW), chi2nuIso: isoW.stats.chi2, Piso: isoW.stats.P, N, held: best.held, chi2Free: bestFree, chi2Held: bestHeld };
      if (!r.res){ E.setParams(model, vIsoW); E.FS.log = lg; return { rejected: true, dBIC: Math.min(dBIC, r.dBIC), lsqRejected: true }; }
      if (!(dBIC < -10)){ E.setParams(model, vIsoW); E.FS.log = lg; return { rejected: true, dBIC, late: true }; }
      E.setParams(model, best.v);
      const v = model.v.slice(), info = { ...r.info, held: best.held, chi2: chiTot(shW), chi2Iso: chiTot(isoW), chi2redIso: isoW.stats.chi2, P: shW.stats.P, Piso: isoW.stats.P, N, polished: 'wppm' };
      const e2 = E.FS.evals, t2 = Date.now();
      let rep;
      try { const bs = E.bodyShapeOf(model, v, k, { ...shW, shapes: { [q.id]: info } }); rep = { kind: bs.kind, dims: bs.dims.map(d=> ({ name: d.name, D: d.D, Desd: d.Desd })), axes: bs.axes.map(pick) }; }
      catch(e){ rep = { error: String(e && e.stack || e) }; }
      E.setParams(model, v);
      stats.report = { ...rep, evals: E.FS.evals - e2, ms: Date.now() - t2 };
      E.FS.log = lg;
      return { res: shW, info };
    } catch(e){
      stats.endError = String(e && e.stack || e); E.FS.log = lg; q.wppm = false; E.setParams(model, vS); return r;
    }
  },
};
