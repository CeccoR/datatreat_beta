/* A timing, not a search: at the truth reference's minimum and at a start-like point (faces
   rounded, FCJ counts held as in a refinement), the wall time of one phase pattern on all
   points and on every 2nd and 3rd point (opt.mjs's sub-model), and of the shape stage's
   Jacobian by central differences, forward differences, the member pass (+ central or
   forward for the rest). Medians of repeated calls; prints one JSON line (BENCH …). */
import truth from '../h/methods/truth.mjs';
function subModel(model, stride){
  const idx = []; for (let i = 0; i < model.n; i += stride) idx.push(i);
  const pick = a => Float64Array.from(idx, i=> a[i]);
  const m = Object.create(model);
  m.x = pick(model.x); m.y = pick(model.y); m.w = pick(model.w); m.n = idx.length;
  m.basis = model.basis.map(b=> b ? pick(b) : b); m._bgSums = null;
  return m;
}
export default {
  name: 'bench', reference: true,
  search(model, k, res, free, opts, E, ctx){
    const q = model.phases[k], pf = q.pfx;
    truth.search(model, k, res, free, opts, E, ctx);
    const names = free.filter(nm=> nm !== pf + 'Ys').concat([...q.iW, ...q.iR].map(i=> model.par[i].name));
    const idx = names.map(nm=> model.index[nm]);
    const med = xs => xs.sort((a, b)=> a - b)[xs.length >> 1];
    const T = (f, N) => { f(); const ts = []; for (let i = 0; i < N; i++){ const t0 = process.hrtime.bigint(); f(); ts.push(Number(process.hrtime.bigint() - t0)/1e6); } return med(ts); };
    const at = (label, v) => {
      model.shapeSoft = { q, soft: E.SHAPE_SOFT }; model.fcjFreeze = new Map();
      const o = { case: ctx.case.id, at: label };
      try {
        const st = E.evaluate(model, v), cols = idx.map(()=> new Float64Array(model.n));
        o.eval = T(()=> E.phasePattern(model, v, k, new Float64Array(model.n)), 30);
        for (const s of [2, 3]){ const m = subModel(model, s); m.fcjFreeze = model.fcjFreeze; o['evalStride' + s] = T(()=> E.phasePattern(m, v, k, new Float64Array(m.n)), 30); }
        o.jCentral = T(()=> E.jacobian(model, v, st, idx, cols), 5);
        o.jFwd = T(()=> E.jacobianX(model, v, st, idx, cols, { fwd: true }), 5);
        o.jMember = T(()=> E.jacobianX(model, v, st, idx, cols, { member: true }), 5);
        o.jMemberFwd = T(()=> E.jacobianX(model, v, st, idx, cols, { member: true, fwd: true }), 5);
        o.nonlinear = idx.filter(i=> !model.par[i].linear).length;
      } finally { model.fcjFreeze = null; model.shapeSoft = null; }
      console.log('BENCH ' + JSON.stringify(o));
    };
    at('minimum', model.v.slice());
    const v = model.v.slice(), y0 = ctx.iso.Ys;
    q.iW.forEach((i, j)=> { v[i] = y0*[0.6, 0.9, 2.2][j]; }); q.iR.forEach((i, j)=> { v[i] = [0.3, -0.2, 0.5][j]; });
    at('start', v);
    return null;
  },
};
