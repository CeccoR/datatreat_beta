/* A check, not a search: at the truth's solid (and at a random start), the Jacobian of
   the shape stage's free parameters by the engine's central differences against the
   options of jacobianX (fwd, member): each column's weighted relative difference, the
   evaluations and the time each took. Prints; returns null. */
import truth from '../h/methods/truth.mjs';
export default {
  name: 'checkjac', reference: true,
  search(model, k, res, free, opts, E, ctx){
    const q = model.phases[k], pf = q.pfx;
    const names = free.filter(nm=> nm !== pf + 'Ys').concat([...q.iW, ...q.iR].map(i=> model.par[i].name));
    const idx = names.map(nm=> model.index[nm]);
    const w = model.w, n = model.n;
    const at = (label, soft) => {
      model.shapeSoft = soft ? { q, soft: E.SHAPE_SOFT } : null;
      const v = model.v.slice();
      model.fcjFreeze = new Map();
      try {
        const st = E.evaluate(model, v);
        const mk = () => idx.map(()=> new Float64Array(n));
        const run = (f) => { const e0 = E.FS.evals, t0 = process.hrtime.bigint(); const c = mk(); f(c); return { c, ev: E.FS.evals - e0, ms: Number(process.hrtime.bigint() - t0)/1e6 }; };
        // warm the caches
        E.jacobian(model, v, st, idx, mk());
        const ref = run(c=> E.jacobian(model, v, st, idx, c));
        const fwd = run(c=> E.jacobianX(model, v, st, idx, c, { fwd: true }));
        const mj0 = E.FS.mjMs;
        const mem = run(c=> E.jacobianX(model, v, st, idx, c, { member: true }));
        const memF = run(c=> E.jacobianX(model, v, st, idx, c, { member: true, fwd: true }));
        const one = run(c=> { for (let i = 0; i < 20; i++) E.phasePattern(model, v, k, new Float64Array(n)); });
        const nrm = c => { let t = 0; for (let i = 0; i < n; i++) t += w[i]*c[i]*c[i]; return Math.sqrt(t); };
        const rel = (a, b) => { let t = 0; for (let i = 0; i < n; i++) t += w[i]*(a[i] - b[i])**2; const d = nrm(a); return d > 0 ? Math.sqrt(t)/d : (Math.sqrt(t) > 0 ? Infinity : 0); };
        console.log(`--- ${label} (soft ${!!soft}); one evaluation ${(one.ms/20).toFixed(2)} ms`);
        console.log(`central: ${ref.ev} evals ${ref.ms.toFixed(0)} ms | fwd: ${fwd.ev} evals ${fwd.ms.toFixed(0)} ms | member: ${mem.ev} evals ${mem.ms.toFixed(0)} ms | member+fwd: ${memF.ev} evals ${memF.ms.toFixed(0)} ms`);
        names.forEach((nm, a)=> { if (model.par[idx[a]].linear) return; console.log(`  ${nm.padEnd(12)} |col| ${nrm(ref.c[a]).toExponential(2)}  fwd ${rel(ref.c[a], fwd.c[a]).toExponential(1)}  member ${rel(ref.c[a], mem.c[a]).toExponential(1)}  member+fwd ${rel(ref.c[a], memF.c[a]).toExponential(1)}`); });
      } finally { model.fcjFreeze = null; model.shapeSoft = null; }
    };
    const r = truth.search(model, k, res, free, opts, E, ctx);
    at('at the truth reference\'s minimum', false);
    at('same, faces rounded', true);
    // a start-like point: widths ×(0.5, 0.7, 2.5) of the isotropic, a random turn
    const v = model.v.slice(); const y0 = ctx.iso.Ys;
    q.iW.forEach((i, j)=> { v[i] = y0*[0.6, 0.9, 2.2][j]; }); q.iR.forEach((i, j)=> { v[i] = [0.3, -0.2, 0.5][j]; });
    E.setParams(model, v);
    at('a start (widths 0.6/0.9/2.2 × Y_iso, turned)', true);
    return null;
  },
};
