/* The landscape after a search: are the near-equivalent minima distinct, or one valley?
   makeUniq(cfg, u) → a method: the search of opt.mjs make(cfg) (its result is the
   method's result), then, counted apart (info.uniq.evals, ms):
   1. the minima: every refinement's end (cfg.collect), grouped modulo the crystal's and the
      body's symmetry (compareSolids: 8°, e^0.25); a group with no converged end within
      Δ ≤ u.refineWithin (30) of the best gets its best brief end refined to convergence
      (faces rounded, forward differences, no covariance), at most u.maxExtra (6) of them;
   2. for each converged minimum B within Δ ≤ u.within (10) of the best A (Δ in the best
      fit's χ²_ν, floored at 1): B's symmetry-equivalent nearest to A (the 24 proper
      rotations of m-3m on the crystal, the body's own relabellings), then χ² along the
      straight path A → B (widths linear, the frame by slerp, the other non-linear
      parameters linear, the linear ones solved at each point: u.points (5) evaluations):
      the barrier, max χ²(t) − max(χ²_A, χ²_B), in χ²_ν. An upper bound of the lowest
      path's barrier: a straight path that rises can still go round.
   info.uniq = { evals, ms, minima: [{ delta, barrier, stage, solid, vsBest: { dimErr,
   orient } }] }. */
import { make } from './opt.mjs';
import { compareSolids, solidOf, CUBIC } from '../h/lib.mjs';

const unitQ = q => { const n = Math.hypot(...q); return q.map(x=> x/n); };
function slerp(a, b, t){
  let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if (d < 0){ b = b.map(x=> -x); d = -d; }
  if (d > 0.9995) return unitQ(a.map((x, i)=> x + t*(b[i] - x)));
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t)*th)/s, wb = Math.sin(t*th)/s;
  return a.map((x, i)=> wa*x + wb*b[i]);
}
const mm = (A, B) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> A[3*i]*B[j] + A[3*i + 1]*B[3 + j] + A[3*i + 2]*B[6 + j]));
const angleOf = (A, B) => { // rotation angle between two frames (rad)
  const t = A[0]*B[0] + A[3]*B[3] + A[6]*B[6] + A[1]*B[1] + A[4]*B[4] + A[7]*B[7] + A[2]*B[2] + A[5]*B[5] + A[8]*B[8];
  return Math.acos(Math.max(-1, Math.min(1, (t - 1)/2)));
};
// signed permutations with det +1 (the body's relabellings), as [perm, signs]
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
function relabels(type){
  const out = [];
  for (const p of PERMS) for (let s = 0; s < 8; s++){
    const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
    const P = new Array(9).fill(0); p.forEach((j, i)=> { P[3*j + i] = sg[i]; }); // column i of R·P is sg[i]·column p[i] of R
    const det = P[0]*(P[4]*P[8] - P[5]*P[7]) - P[1]*(P[3]*P[8] - P[5]*P[6]) + P[2]*(P[3]*P[7] - P[4]*P[6]);
    if (det < 0) continue;
    // bodies with a distinguished z (two equal widths, or a cylinder's axis): z stays z
    if (['sqbox', 'spheroid', 'cylinder', 'ellcyl'].includes(type) && p[2] !== 2) continue;
    out.push({ P, p });
  }
  return out;
}

export function makeUniq(cfg = {}, u = {}){
  const within = u.within ?? 10, refineWithin = u.refineWithin ?? 30, maxExtra = u.maxExtra ?? 6, points = u.points ?? 5;
  return {
    name: cfg.name || 'uniq',
    search(model, k, res, free, opts, E, ctx){
      const collect = [];
      const out = make({ ...cfg, collect }).search(model, k, res, free, opts, E, ctx);
      if (!out || !out.res) return out;
      const q = model.phases[k], type = q.shapeType, B = E.BODIES[type], vRes = model.v.slice();
      const e0 = E.FS.evals, t0 = Date.now();
      const nu = Math.max(1, out.res.stats.chi2);
      const names = [...free.filter(nm=> nm !== q.pfx + 'Ys'), ...[...q.iW, ...q.iR].map(i=> model.par[i].name)];
      const sol = v => solidOf(q, type, v);
      const same = (a, b) => { const c = compareSolids(a, b); return (c.orient == null || c.orient <= 8) && c.dimErr.every(e=> !Number.isFinite(e) || Math.abs(e) <= Math.exp(0.25) - 1); };
      model.shapeSoft = { q, soft: E.SHAPE_SOFT };
      const rebase = v => { const vv = v.slice(), R = E.bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
      // 1. converged minima (the faces rounded, as the search's landscape)
      const conv = collect.filter(c=> c.stage === 'full' || c.stage === 'polish').map(c=> ({ ...c, s: sol(c.v) }));
      const groups = [];
      for (const c of collect.filter(c=> c.stage === 'brief').map(c=> ({ ...c, s: sol(c.v) })).sort((a, b)=> a.chi - b.chi)){
        if (conv.some(m=> same(c.s, m.s)) || groups.some(g=> same(c.s, g.s))) continue;
        groups.push(c);
      }
      const best0 = Math.min(...conv.map(c=> c.chi));
      let extra = 0;
      for (const g of groups){
        if (extra >= maxExtra || (g.chi - best0)/nu > refineWithin) break;
        E.setParams(model, rebase(g.v));
        try { const r = E.refine(model, { free: names, maxIter: 60, x: { noCov: true, fwd: true } }); const v = model.v.slice(); conv.push({ stage: 'extra', v, chi: r.stats.chi2*Math.max(1, r.stats.N - r.stats.P), s: sol(v) }); } catch(e){}
        extra++;
      }
      // merge the converged ends into minima
      conv.sort((a, b)=> a.chi - b.chi);
      const minima = [];
      for (const c of conv) if (!minima.some(m=> same(c.s, m.s))) minima.push(c);
      const A = minima[0];
      // 2. barriers along straight paths
      const RA = E.bodyFrame(q, A.v), WA = B.axes(q.iW.map(i=> A.v[i]));
      const rel = relabels(type);
      const chiAt = v => { const st = E.evaluate(model, v); E.solveLinear(model, v, st); return st.chi2; };
      const report = [];
      for (const m of minima){
        const delta = (m.chi - A.chi)/nu;
        if (m !== A && delta > within) continue;
        const r = { delta, stage: m.stage, solid: m.s, vsBest: m === A ? null : compareSolids(m.s, A.s), barrier: 0 };
        if (m !== A){
          // B's equivalent nearest to A: G·R_B·P
          const RB = E.bodyFrame(q, m.v), WB = B.axes(q.iW.map(i=> m.v[i]));
          let bestEq = null;
          for (const G of CUBIC) for (const { P, p } of rel){
            const R = mm(mm(G, RB), P), W = [WB[p[0]], WB[p[1]], WB[p[2]]];
            const sc = angleOf(RA, R) + 0.5*W.reduce((t, w, i)=> t + Math.abs(Math.log((w + 1e-3)/(WA[i] + 1e-3))), 0);
            if (!bestEq || sc < bestEq.sc) bestEq = { sc, R, W };
          }
          const qa = E.quatOfMat(RA), qb = E.quatOfMat(bestEq.R);
          let top = -Infinity;
          for (let i = 1; i <= points; i++){
            const t = i/(points + 1), v = A.v.slice();
            for (const j of names.map(nm=> model.index[nm])) if (!model.par[j].linear) v[j] = (1 - t)*A.v[j] + t*m.v[j];
            const Wt = WA.map((w, a)=> (1 - t)*w + t*bestEq.W[a]);
            const Wp = B.W.length === 2 ? [(Wt[0] + Wt[1])/2, Wt[2]] : Wt;
            q.iW.forEach((j, a)=> { v[j] = Wp[a]; });
            q.iR.forEach(j=> { v[j] = 0; });
            slerp(qa, qb, t).forEach((x, a)=> { v[q.iQ[a]] = x; });
            top = Math.max(top, chiAt(v));
          }
          r.barrier = (top - Math.max(A.chi, m.chi))/nu;
          r.turn = bestEq.sc;
        }
        report.push(r);
      }
      model.shapeSoft = null;
      E.setParams(model, vRes);
      out.info.uniq = { evals: E.FS.evals - e0, ms: Date.now() - t0, extra, nMinima: minima.length, minima: report };
      return out;
    },
  };
}
