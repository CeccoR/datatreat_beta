/* The uniqueness analysis after the app's search (ENG.freeShape, unchanged: its result is
   the method's result). Counted apart (info.uniq.cost):
   1. app: the app's own report of the kept solid (bodyShapeOf: linear esds of the
      dimensions, the held/free difference, angular esds by profile, turnEsds) — what the
      card shows today, computed by the worker after autoRefine.
   2. minima: the search's refinement ends (brief and converged) within dCand χ²_ν of the
      best, not already represented by a minimum (rule 'res': every paired dimension within
      max(0.1, 3σ) in log and every defined axis within max(5°, 3σ) of a minimum, σ the
      minimum's linear esds; rule 'fixed': 8°, e^0.25), refined to convergence (faces
      rounded) and again exact with the orientation free, at most maxExtra. Optionally
      extraStarts more brief starts (lattice frames: plate, needle, ribbon on each
      low-index family, in-plane x on a lattice direction and turned 45°) join the ends.
      Each minimum: χ², its solid, its linear esds (σ of log W, of the turns), the shape
      block of its covariance (log W, turns in °) and that block's eigenvectors.
   3. profile (opt.): each width of the reported fit stepped in log (±0.05·2^k, and 0 on the
      side of the longer dimension), every other parameter free in it refined again (4
      iterations, as turnEsds): the 1σ and 2σ crossings of √Δχ² (χ²_ν, 4χ²_ν).
   4. boot (opt.): R parametric replicas of the best free exact fit (Poisson on its y_c, the
      weights recomputed as buildModel's), every minimum within bootD refitted from its own
      vector (bootIter iterations, one FCJ pass): χ² of each, the reported dims and axes;
      and the noise-free pattern (y = y_c) refitted likewise: δ, the expected Δ. */
import { solidOf, poisson, rng, sameSolid } from '../../harness/lib.mjs';
import { align, eigSym, R2D, definedAxes } from '../ulib.mjs';

const unit = t => { const n = Math.hypot(...t); return t.map(x=> x/n); };
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const rotation = (n, phi) => { const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
  return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
const mul = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));

export function makeUniq(cfg = {}){
  const C = { dCand: 30, maxExtra: 4, rule: 'res', extraStarts: false, profile: false, boot: 0, bootD: 30, bootComp: 3, bootIter: 12, appEsds: true, ...cfg };
  return { name: C.name || 'uniq', search(model, k, res, free, opts, E, ctx){
    const q = model.phases[k], type = q.shapeType, B = E.BODIES[type], pf = q.pfx;
    if (!q.iW) return E.freeShape(model, k, res, free, opts);
    const vIso = model.v.slice(), ev0 = E.FS.evals, t0 = Date.now();
    const r = E.freeShape(model, k, res, free, opts);
    const searchLog = E.FS.log ? E.FS.log.slice() : [];
    const cost = { search: { evals: E.FS.evals - ev0, ms: Date.now() - t0 } };
    if (!r || !r.res) return r;
    const keepLog = E.FS.log; E.FS.log = null;   // the analysis' refinements stay out of the search's log
    const vRep = model.v.slice(), resRep = r.res, info = r.info;
    const F = E.fitSettings(opts.fit), N = res.stats.N;
    const lmFull = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
    const lmBrief = { maxIter: Math.min(8, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
    const wNames = q.iW.map(i=> model.par[i].name), rNames = q.iR.map(i=> model.par[i].name);
    const names = free.filter(n=> n !== pf + 'Ys').concat(wNames, rNames);
    const chiTot = rr => rr.stats.chi2*Math.max(1, rr.stats.N - rr.stats.P);
    const faces = B.base !== 'ball';
    const nW = q.iW.length, nR = q.iR.length, wIx = nW === 2 ? [0, 0, 1] : [0, 1, 2];
    const meter = () => { const e = E.FS.evals, t = Date.now(); return ()=> ({ evals: E.FS.evals - e, ms: Date.now() - t }); };
    const rebase = v => { const vv = v.slice(), R = E.bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((t, j)=> { vv[q.iQ[j]] = t; }); return vv; };
    const withPacked = (vb, to) => { const vv = vb.slice(); q.iW.forEach((i, j)=> { vv[i] = to[j]; }); q.iR.forEach((i, j)=> { vv[i] = to[nW + j]; }); q.iQ.forEach((i, j)=> { vv[i] = to[nW + nR + j]; }); return rebase(vv); };
    const fit = (v, nm, { soft = false, lm = lmFull, audit = true } = {}) => {
      E.setParams(model, v); model.shapeSoft = soft && faces ? { q, soft: E.SHAPE_SOFT } : null;
      try { const rr = E.refine(model, { free: nm, ...lm, ...(audit ? {} : { audit: false }) }); return { res: rr, v: model.v.slice(), chi: chiTot(rr) }; }
      catch(e){ return null; } finally { model.shapeSoft = null; }
    };
    // a minimum's description: solid, linear esds, the shape block of its covariance
    const describe = (x, src) => {
      const s = solidOf(q, type, x.v), rr = x.res, ix = nm => rr.free ? rr.free.indexOf(nm) : -1;
      const cv = (a, b) => { const i = ix(a), j = ix(b); return i >= 0 && j >= 0 && rr.cov ? rr.cov[i][j] : NaN; };
      const W = q.iW.map(i=> x.v[i]);
      const sLogW = wNames.map((nm, j)=> Math.sqrt(cv(nm, nm))/W[j]);
      const rotFree = rNames.length && ix(rNames[0]) >= 0;
      const sR = rNames.map(nm=> rotFree ? Math.sqrt(cv(nm, nm))*R2D : NaN);
      // an axis's tilt: the turns about the other two body axes (a body of revolution: x, y tilt z)
      const sTilt = [0, 1, 2].map(i=> { if (!rotFree) return NaN; const o = [0, 1, 2].filter(j=> j !== i && j < nR); return Math.sqrt(o.reduce((t, j)=> t + sR[j]**2, 0)/Math.max(1, o.length)); });
      const blkNames = [...wNames, ...(rotFree ? rNames : [])], sc = [...W.map(w=> 1/w), ...(rotFree ? rNames.map(()=> R2D) : [])];
      const blk = blkNames.map((a, i)=> blkNames.map((b, j)=> cv(a, b)*sc[i]*sc[j]));
      let eig = null;
      if (blk.every(rw=> rw.every(Number.isFinite))){ const e = eigSym(blk); eig = { sd: e.val.map(t=> Math.sqrt(Math.max(0, t))), vec: e.vec, names: blkNames }; }
      return { src, chi: x.chi, chi2nu: rr.stats.chi2, P: rr.stats.P, solid: s, v: Array.from(x.v), sLogW: B.axes(sLogW), sTilt, sR, rotFree: !!rotFree, blk, eig, held: !rotFree };
    };
    const uniq = { cfg: C, cost };

    // 1. the app's own report of the kept solid
    if (C.appEsds){
      const m = meter();
      try {
        const bs = E.bodyShapeOf(model, vRep, k, { ...resRep, shapes: { [q.id]: info } });
        uniq.app = { kind: bs.kind, groups: bs.groups.map(g=> ({ axes: g.axes, D: g.D, Desd: g.Desd })),
          axes: bs.axes.map(a=> ({ role: a.role, axis: a.axis, D: a.D, Desd: a.Desd, Dmin: a.Dmin, esdAngle: a.esdAngle, group: a.group, own: a.own, resolved: a.resolved, label: a.label, angle: a.angle })) };
      } catch(e){ uniq.app = { error: String(e && e.message || e) }; }
      E.setParams(model, vRep);
      cost.app = m();
    }

    // 2. the minima
    const m2 = meter();
    const reported = describe({ res: resRep, v: vRep, chi: chiTot(resRep) }, info.held ? 'reported-held' : 'reported-free');
    // the best free exact fit: the reported one when free; else refitted from the search's free exact end
    const exactEnd = e => !e.error && e.to && Number.isFinite(e.chi2) && (!e.soft || !faces);
    let M0 = null;
    if (!info.held) M0 = reported;
    else {
      const fe = searchLog.filter(e=> exactEnd(e) && e.rotFree).sort((a, b)=> a.chi2 - b.chi2)[0];
      const mf = meter(), x = fe ? fit(withPacked(vRep, fe.to), names) : null;
      if (x){ M0 = describe(x, 'free-of-held'); cost.freeOfHeld = mf(); }
    }
    const minima = M0 ? [M0] : [];
    const nu0 = Math.max(1, (M0 || reported).chi2nu);
    // the ends to examine
    const ends = searchLog.filter(e=> !e.error && e.to && Number.isFinite(e.chi2)).map(e=> ({ chi: e.chi2, conv: e.maxIter > 8, soft: e.soft && faces, rot: e.rotFree, to: e.to, solid: solidOf(q, type, e.to, true), src: e.maxIter > 8 ? (e.soft && faces ? 'full' : e.rotFree ? 'exact' : 'held') : 'brief' }));
    if (C.extraStarts){
      const m = meter();
      const y0 = Math.max(vIso[q.iYs], 1e-3);
      let kappa = 0;
      for (let i = 0, M = 400; i < M; i++){
        const z = 1 - (2*i + 1)/M, rr = Math.sqrt(1 - z*z), ph = i*2.399963229728653, t = [rr*Math.cos(ph), rr*Math.sin(ph), z];
        kappa += (B.base === 'ball' ? 1 : 0.75/E.columnLengthV(B.base, t))/M;
      }
      const w0 = y0/kappa, Wof = (wx, wy, wz) => nW === 2 ? [(wx + wy)/2, wz] : [wx, wy, wz];
      const axesLow = E.lowIndexAxes(q);
      const T = [[0.5, 0.7, 2.5], [1.2, 1.6, 0.4], [0.4, 1.2, 2.5]];
      for (const e of axesLow) for (const [ti, tw] of T.entries()) for (const turn of [0, 45]){
        if (turn === 0 && ti < 2) continue;   // the search's own plate and needle
        if (nW === 2 && ti === 2) continue;   // no ribbon for a two-width body
        const acr = E.latticeAcross(q, e, null, 0.01, 4)[0];
        const x0 = acr ? acr.vec : unit(cross(e, Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
        const x = unit(x0.map((t, i)=> t - dot(x0, e)*e[i])), y = cross(e, x);
        let R = [x[0], y[0], e[0], x[1], y[1], e[1], x[2], y[2], e[2]];
        if (turn) R = mul(R, rotation([0, 0, 1], turn*Math.PI/180));
        const vv = vIso.slice(); vv[q.iYs] = 0;
        Wof(...tw.map(t=> t*w0)).forEach((t, j)=> { vv[q.iW[j]] = t; });
        q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((t, j)=> { vv[q.iQ[j]] = t; });
        const x2 = fit(vv, names, { soft: true, lm: lmBrief, audit: false });
        if (x2) ends.push({ chi: x2.chi, conv: false, soft: faces, rot: true, to: [...q.iW, ...q.iR, ...q.iQ].map(i=> x2.v[i]), solid: solidOf(q, type, x2.v), src: 'extra' });
      }
      cost.extra = m();
    }
    ends.sort((a, b)=> a.chi - b.chi);
    // is solid s represented by minimum m? (rule 'res': by m's resolution; 'fixed': 8°, e^0.25)
    const represented = (s, m) => {
      if (C.rule === 'fixed') return sameSolid(s, m.solid);
      const a = align(s, m.solid);
      return a.per.every((p, i)=> {
        const sl = Number.isFinite(m.sLogW[i]) ? m.sLogW[i] : 10, okD = !Number.isFinite(p.ratio) || Math.abs(Math.log(p.ratio)) <= Math.max(0.1, 3*sl)
          || (!Number.isFinite(s.dims[p.fi]) && !Number.isFinite(m.solid.dims[i]));
        const st = Number.isFinite(m.sTilt[i]) ? m.sTilt[i] : 0, okA = p.angle == null || p.angle <= Math.max(5, 3*st);
        return okD && okA;
      });
    };
    const tried = [];
    let extra = 0;
    const cBest = () => Math.min(...minima.map(m=> m.chi), M0 ? M0.chi : Infinity);
    for (const e of ends){
      if (extra >= C.maxExtra) break;
      if (e.chi > cBest() + C.dCand*nu0) break;
      if (minima.some(m=> represented(e.solid, m))){ tried.push({ src: e.src, chi: e.chi, skip: 'represented' }); continue; }
      const mc = meter();
      let v = withPacked(vRep, e.to);
      if (!e.conv){ const s = fit(v, names, { soft: true }); if (!s){ tried.push({ src: e.src, fail: 'soft' }); continue; } v = rebase(s.v); }
      const x = fit(v, names);
      extra++;
      if (!x){ tried.push({ src: e.src, fail: 'exact' }); continue; }
      const d = describe(x, e.src);
      const dup = minima.find(m=> represented(d.solid, m) || represented(m.solid, d));
      tried.push({ src: e.src, chi0: e.chi, chi: x.chi, dup: dup ? minima.indexOf(dup) : -1, ...mc() });
      if (dup){ if (x.chi < dup.chi) minima[minima.indexOf(dup)] = { ...d, merged: (dup.merged || 0) + 1 }; else dup.merged = (dup.merged || 0) + 1; continue; }
      minima.push(d);
    }
    minima.sort((a, b)=> a.chi - b.chi);
    cost.minima = m2();
    uniq.reported = reported; uniq.minima = minima; uniq.tried = tried; uniq.nu0 = nu0;
    uniq.ends = ends.map(e=> ({ chi: e.chi, src: e.src, solid: e.solid }));

    // 3. profiles of the widths at the reported fit
    if (C.profile){
      const m = meter();
      const rest0 = resRep.free.slice(), nu = resRep.stats.chi2;
      E.setParams(model, vRep); const c0 = E.evaluate(model, vRep).chi2;
      uniq.profile = q.iW.map((iw, j)=> {
        const nm = wNames[j], rest = rest0.filter(n=> n !== nm), W0 = vRep[iw], out = { W: W0, sides: {} };
        for (const sg of [1, -1]){
          const trials = []; let s0 = 0, r0 = 0, c1 = null, c2 = null;
          const steps = [0.05, 0.1, 0.2, 0.4, 0.8, 1.6]; if (sg < 0) steps.push(Infinity);
          for (const s of steps){
            const vv = vRep.slice(); vv[iw] = s === Infinity ? 0 : W0*Math.exp(sg*s);
            E.setParams(model, vv);
            let c = Infinity; try { E.refine(model, { free: rest, maxIter: 4, audit: false }); c = E.evaluate(model, model.v).chi2; } catch(e){}
            const rr = Math.sqrt(Math.max(0, c - c0)); trials.push([s, rr]);
            const sx = s === Infinity ? 3.2 : s;   // W → 0 put at e^-3.2 for the interpolation
            const cross = tgt => s0 + (sx - s0)*(tgt - r0)/Math.max(1e-12, rr - r0);
            if (c1 == null && rr >= Math.sqrt(nu)) c1 = cross(Math.sqrt(nu));
            if (c2 == null && rr >= 2*Math.sqrt(nu)){ c2 = cross(2*Math.sqrt(nu)); break; }
            s0 = sx; r0 = rr;
          }
          out.sides[sg > 0 ? 'thinner' : 'longer'] = { s1: c1, s2: c2, trials };
        }
        return out;
      });
      E.setParams(model, vRep);
      cost.profile = m();
    }

    // 4. parametric bootstrap from the best free exact fit
    if ((C.boot > 0 || C.noiseFree) && M0){
      const m = meter();
      const comps = minima.filter(x=> (x.chi - minima[0].chi)/nu0 <= C.bootD).slice(0, C.bootComp + 1);
      const best = comps[0];
      E.setParams(model, best.v); const mu = Float64Array.from(E.evaluate(model, best.v).yc);
      const y0 = model.y, w0 = model.w, n = model.n, U = rng(0x5eed + (ctx.seed || 0)*7919 + (ctx.case ? ctx.case.id.length : 0)).u;
      const lmB = { maxIter: C.bootIter, shiftTol: F.shiftTol, lambda: F.lambda };
      const refitAll = () => comps.map(x=> { const z = fit(x.v, names, { lm: lmB, audit: false }); return z ? { chi: z.chi, chi2nu: z.res.stats.chi2, solid: solidOf(q, type, z.v) } : null; });
      try {
        // noise-free: y = μ
        const Y = new Float64Array(n), W = new Float64Array(n);
        for (let i = 0; i < n; i++){ if (w0[i] > 0){ Y[i] = mu[i]; W[i] = 1/(Math.max(mu[i], 0) + 1); } }
        model.y = Y; model.w = W;
        uniq.bootFree = refitAll().map(z=> z && z.chi);
        uniq.boot = [];
        for (let b = 0; b < (C.boot || 0); b++){
          const Yb = new Float64Array(n), Wb = new Float64Array(n);
          for (let i = 0; i < n; i++){ if (w0[i] > 0){ const c = poisson(Math.max(mu[i], 0), U); Yb[i] = c + Math.min(c, 1); Wb[i] = 1/(c + 1); } }
          model.y = Yb; model.w = Wb;
          uniq.boot.push(refitAll());
        }
        uniq.bootComps = comps.map(x=> minima.indexOf(x));
      } finally { model.y = y0; model.w = w0; }
      E.setParams(model, vRep);
      cost.boot = m();
    }

    E.setParams(model, vRep);
    E.FS.log = keepLog;
    return { res: resRep, info: { ...info, uniq } };
  } };
}
