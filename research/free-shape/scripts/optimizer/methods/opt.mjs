/* The app's freeShapeRun (bf228ee) for the bodies, copied with knobs on the optimiser.
   make(cfg) → a harness method. With cfg = {} it is the app's search, evaluation for
   evaluation (checked against the baseline). Knobs:
   - x: { brief, full, polish, exact, held, refit }: refine()'s opts.x per stage (make-opt.mjs:
     noCov, fwd, member, broyden, logW); finalCov: the covariance of the fit returned,
     once (covOnly), when its stage ran without one.
   - briefFree: 'all' (the app: everything free in the isotropic fit) | 'shapeXs' (the shape,
     X_s and the linear ones) | 'shape' (the shape and the linear ones).
   - briefIter (8); halving: { rungs: [2, 4, 8], keep: [6, 3], dedup, rebase } — successive
     halving: every start refined to the first rung, the best keep[0] on to the next, …;
     dedup: at each cut a candidate that is the same solid as a better one (modulo
     symmetry, 8°, e^0.25) goes first; rebase: each rung from r = 0 (the chart re-set);
     rank: 'pred' — cut on the Gauss–Newton model's predicted minimum (refine's predMin).
   - starts: the starts besides the sphere-like one (the setting shapeStarts, 10); more draw
     more random shapes from the same seeded sequence (the first 11 are the app's).
   - nFull (3), fullIter (1.5 × maxIter), polish (2), polishTol (0.5 χ²_ν).
   - dedupFull: a brief end that is the same solid (modulo symmetry, 8°, e^0.25) as a better
     one is not refined fully; the next distinct one is.
   - logW: the widths stepped in log in every stage.
   - stride: the brief refinements on every stride-th point of the pattern (a sub-model:
     x, y, w, the background's basis), the rest on all points.
   - heldBrief: { iter: 6, keep: 1 } — the lattice frames refined briefly (x.heldBrief), the
     best keep of them to convergence.
   - collect: an array: every refinement's end pushed there ({ stage, v, chi, soft }).
   - surrogate: { iter: 30 } — multi-fidelity: the peak widths of the isotropic fit read
     once (measureWidths), and each start first fitted to them (the widths, turns and X_s;
     a peak's FWHM that of its members' equal-area Lorentzians, X_s·tanθ + w/cosθ), no
     pattern evaluated; then the brief refinements from there. */
import { compareSolids, solidOf } from '../h/lib.mjs';
import { measureWidths } from '../h/eng/xrd-widths.js';

export function make(cfg = {}){
  return {
    name: cfg.name || 'opt',
    search(model, k, res, free, opts, E){
      model.shapeSoft = model.phases[k].iW ? { q: model.phases[k], soft: E.SHAPE_SOFT } : null;
      try { return run(model, k, res, free, opts, E, cfg); }
      finally { model.shapeSoft = null; }
    },
  };
}
export default make({ name: 'opt' });

/* A sub-model on every stride-th point: x, y, w, n and the background's basis are its
   own, the rest (parameters, phases, caches keyed by line) the model's. */
function subModel(model, stride){
  const idx = []; for (let i = 0; i < model.n; i += stride) idx.push(i);
  const pick = a => Float64Array.from(idx, i=> a[i]);
  const m = Object.create(model);
  m.x = pick(model.x); m.y = pick(model.y); m.w = pick(model.w); m.n = idx.length;
  m.basis = Array.isArray(model.basis) ? model.basis.map(b=> b ? pick(b) : b) : Object.fromEntries(Object.entries(model.basis).map(([k, b])=> [k, b ? pick(b) : b]));
  m._bgSums = null; m.fcjFreeze = null; m.fcjAudit = null;
  m.x0 = model.x0; m.x1 = model.x1;
  return m;
}

function run(model, k, res, free, opts, E, cfg){
  const { refine, setParams, bodyFrame, BODIES, quatMat, quatOfMat, lowIndexAxes, lattDirection, latticeAcross, columnLengthV, fitSettings, SNAP_DEG, D2R, R2D } = E;
  const X = cfg.x || {};
  const q = model.phases[k], pf = q.pfx, vIso = model.v.slice();
  const F = fitSettings(opts.fit), nStarts = cfg.starts ?? F.shapeStarts, nFull = cfg.nFull ?? F.shapeFull;
  const lmBrief = { maxIter: Math.min(cfg.briefIter ?? 8, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const lmFull = { maxIter: cfg.fullIter ?? Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const N = res.stats.N, chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
  const y0 = Math.max(vIso[q.iYs], 1e-3);
  let seed = 0x9e3779b9 >>> 0;
  const rnd = ()=> { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const gauss = ()=> Math.sqrt(-2*Math.log(rnd() || 1e-12))*Math.cos(2*Math.PI*rnd());
  const unit = t => { const n = Math.hypot(...t); return t.map(x=> x/n); };
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  const rotation = (n, phi) => { const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
    return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
  const mul = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const randomTurn = ()=> quatMat(unit([gauss(), gauss(), gauss(), gauss()]));
  const tilt = e => unit([e[0] + 0.08*gauss(), e[1] + 0.08*gauss(), e[2] + 0.08*gauss()]);
  const axesLow = lowIndexAxes(q);
  if (q.iL) throw new Error('opt: bodies only');
  const B = BODIES[q.shapeType];
  let names = [...q.iW, ...q.iR].map(i=> model.par[i].name);
  const starts = [];
  const Wof = (wx, wy, wz) => B.W.length === 2 ? [(wx + wy)/2, wz] : [wx, wy, wz];
  let kappa = 0;
  for (let i = 0, M = 400; i < M; i++){
    const z = 1 - (2*i + 1)/M, rr = Math.sqrt(1 - z*z), ph = i*2.399963229728653, t = [rr*Math.cos(ph), rr*Math.sin(ph), z];
    kappa += (B.base === 'ball' ? 1 : 0.75/columnLengthV(B.base, t))/M;
  }
  const w0 = y0/kappa;
  const put = (W, R) => v => {
    W.forEach((t, i)=> { v[q.iW[i]] = t; });
    q.iR.forEach(i=> { v[i] = 0; });
    quatOfMat(R).forEach((t, i)=> { v[q.iQ[i]] = t; });
  };
  const frameAlong = e => {
    const z = tilt(e), x0 = axesLow.find(a=> Math.abs(a[0]*e[0] + a[1]*e[1] + a[2]*e[2]) < 0.1) || cross(e, Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
    const xd = x0.map((t, i)=> t - (x0[0]*z[0] + x0[1]*z[1] + x0[2]*z[2])*z[i]), x = tilt(unit(xd)), xo = unit(x.map((t, i)=> t - (x[0]*z[0] + x[1]*z[1] + x[2]*z[2])*z[i])), y = cross(z, xo);
    return [xo[0], y[0], z[0],  xo[1], y[1], z[1],  xo[2], y[2], z[2]];
  };
  starts.push(put(Wof(w0, w0, w0), frameAlong(axesLow[0] || [0, 0, 1])));
  for (const e of axesLow){
    starts.push(put(Wof(0.5*w0, 0.7*w0, 2.5*w0), frameAlong(e)));
    starts.push(put(Wof(1.2*w0, 1.6*w0, 0.4*w0), frameAlong(e)));
  }
  while (starts.length < nStarts + 1) starts.push(put(Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))), randomTurn()));
  const rebase = v => { const vv = v.slice(), R = bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
  const turned = v => { const vv = rebase(v), R = mul(bodyFrame(q, v), rotation(unit([gauss(), gauss(), gauss()]), 0.02)); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
  const snaps = v => {
    const R = bodyFrame(q, v), col = i => [R[i], R[3 + i], R[6 + i]], dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const Wx = B.axes(q.iW.map(i=> v[i])), gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(Wx[i] - Wx[j])));
    const cand = (B.rot === 2 ? [2] : [0, 1, 2]).map(i=> ({ i, ...lattDirection(q, col(i)) })).filter(c=> c.angle <= SNAP_DEG).sort((a, b)=> gap(b.i) - gap(a.i));
    if (!cand.length) return [];
    const p = cand[0].i, cp = cand[0].vec.map(t=> t*Math.sign(dot(cand[0].vec, col(p)) || 1));
    const frameOf = (s, ds) => {
      let cs = unit(ds.map((t, j)=> t - dot(ds, cp)*cp[j]));
      if (dot(cs, col(s)) < 0) cs = cs.map(t=> -t);
      const t = 3 - p - s, cyc = (s - p + 3) % 3 === 1, ct = cyc ? cross(cp, cs) : cross(cs, cp);
      const C = []; C[p] = cp; C[s] = cs; C[t] = ct;
      const vv = v.slice();
      q.iR.forEach(i=> { vv[i] = 0; });
      quatOfMat([C[0][0], C[1][0], C[2][0], C[0][1], C[1][1], C[2][1], C[0][2], C[1][2], C[2][2]]).forEach((x, i)=> { vv[q.iQ[i]] = x; });
      return vv;
    };
    if (B.rot === 2) return [frameOf(p === 2 ? 0 : 2, col(p === 2 ? 0 : 2))];
    const others = [0, 1, 2].filter(i=> i !== p), all = latticeAcross(q, cp, null, 0.01, 64), pick = all.slice(0, 3);
    for (const s of others){
      const c = all.find(c=> Math.abs(dot(c.vec, col(s))) >= Math.cos(SNAP_DEG*D2R));
      if (c && !pick.includes(c)) pick.push(c);
    }
    return pick.map(({ vec })=>{
      const s = Math.abs(dot(vec, col(others[0]))) >= Math.abs(dot(vec, col(others[1]))) ? others[0] : others[1];
      return frameOf(s, vec);
    });
  };
  names = free.filter(nm=> nm !== pf + 'Ys').concat(names);
  // the brief refinements' free names
  const shapeNames = [...q.iW, ...q.iR].map(i=> model.par[i].name);
  const linNames = free.filter(nm=> model.par[model.index[nm]].linear);
  const briefNames = cfg.briefFree === 'shape' ? linNames.concat(shapeNames) : cfg.briefFree === 'shapeXs' ? linNames.concat([pf + 'Xs'], shapeNames) : names;
  const logW = cfg.logW ? q.iW.slice() : null;
  const xOf = st => { const o = { ...(X[st] || (st === 'heldBrief' ? X.held : null) || {}) };   // (the held frames' brief refinements: as the held ones)
  if (logW) o.logW = logW; return Object.keys(o).length ? o : undefined; };
  const R = (m, o, st) => { const x = xOf(st); return refine(m, x ? { ...o, x } : o); };
  // the brief stage's model (all points, or a sub-model)
  const mb = cfg.stride > 1 ? subModel(model, cfg.stride) : model;
  const briefOne = (v, iters) => {
    setParams(mb, v);
    try { const r = R(mb, { free: briefNames, ...lmBrief, maxIter: iters, audit: false }, 'brief'); return { v: mb.v.slice(), r }; } catch(e){ return null; }
  };
  const same = (va, vb) => { const a = solidOf(q, q.shapeType, va), b = solidOf(q, q.shapeType, vb), c = compareSolids(a, b);
    return (c.orient == null || c.orient <= 8) && c.dimErr.every(e=> !Number.isFinite(e) || Math.abs(e) <= Math.exp(0.25) - 1); };
  let brief = [];
  const cands = starts.map(put=> { const vv = vIso.slice(); vv[q.iYs] = 0; put(vv); return { v: vv }; });
  if (cfg.surrogate){
    // (its wall time, the peak fits and the surrogate fits, counted as FS.mjMs: work
    // that is not a pattern evaluation, turned into evaluation-equivalents by cmp.mjs)
    const t0 = Date.now(), e0 = E.FS.evals;
    const sur = surrogateOf(model, k, res, opts, E, vIso);
    if (sur) for (const c of cands){ c.v = rebase(sur.fit(c.v, cfg.surrogate.iter ?? 30)); }
    setParams(model, vIso);
    E.FS.mjMs += Math.max(0, Date.now() - t0 - 6*(E.FS.evals - e0));
  }
  if (cfg.halving){
    // successive halving: all to the first rung, the best keep[i] on to the next
    const { rungs, keep } = cfg.halving;
    let live = cands, done = 0;
    rungs.forEach((it, ri)=> {
      const step = it - done; done = it;
      live = live.map(c=> { const b = briefOne(ri && cfg.halving.rebase ? rebase(c.v) : c.v, step); return b ? { v: b.v, r: b.r } : null; }).filter(Boolean);
      // the ranking at a cut: χ² reached, or (rank 'pred') the minimum the Gauss–Newton model
      // of the last iteration predicts, floored at N − P (a start still falling fast is not cut
      // for being slow); the last rung by χ² itself
      const key = r => cfg.halving.rank === 'pred' && ri < rungs.length - 1 && Number.isFinite(r.predMin) ? Math.max(r.predMin, r.stats.N - r.stats.P) : chiTot(r);
      live.sort((a, b)=> key(a.r) - key(b.r));
      if (cfg.collect && ri < rungs.length - 1) for (const c of live) cfg.collect.push({ stage: 'brief', v: c.v.slice(), chi: chiTot(c.r), soft: true, rung: it });
      // (dedup: a candidate that is already the same solid as a better one, modulo the
      // crystal's and the body's symmetry, is dropped: one morphology, one candidate)
      if (cfg.halving.dedup && ri < rungs.length - 1){ const kept = []; for (const c of live) if (!kept.some(p=> same(c.v, p.v))) kept.push(c); live = kept; }
      if (ri < rungs.length - 1) live = live.slice(0, keep[ri]);
    });
    brief = live.map(c=> ({ v: c.v, r: c.r }));
  } else {
    for (const c of cands){ const b = briefOne(c.v, lmBrief.maxIter); if (b) brief.push(b); }
  }
  // the χ² on all points (a sub-model's χ² is on its own points)
  if (mb !== model){
    for (const b of brief){ const st = E.evaluate(model, b.v); E.solveLinear(model, b.v, st); b.chi = st.chi2; }
    setParams(model, vIso);
  } else brief.forEach(b=> { b.chi = chiTot(b.r); });
  if (cfg.collect) for (const b of brief) cfg.collect.push({ stage: 'brief', v: b.v.slice(), chi: b.chi, soft: true });
  brief.sort((a, b)=> a.chi - b.chi);
  if (!brief.length){ setParams(model, vIso); return null; }
  const dP = names.length - free.length, dPmin = dP - (q.iR ? q.iR.length : 0), gain = (chiTot(res) - brief[0].chi)/Math.max(1, res.stats.chi2);
  if (!(gain > (10 + dPmin*Math.log(N))/2)){ setParams(model, vIso); return { rejected: true, dBIC: dPmin*Math.log(N) - gain, early: true }; }
  let best = null;
  const finals = [];
  const full = (v, st) => {
    setParams(model, rebase(v));
    let r; try { r = R(model, { free: names, ...lmFull }, st); } catch(e){ return null; }
    if (!best || chiTot(r) < chiTot(best.res)) best = { res: r, v: model.v.slice(), st };
    if (cfg.collect) cfg.collect.push({ stage: st, v: model.v.slice(), chi: chiTot(r), nu: r.stats.chi2, soft: true });
    return chiTot(r);
  };
  // the full refinements: the best nFull brief ends (distinct ones with dedupFull)
  let picks = brief.slice(0, nFull);
  if (cfg.dedupFull){
    const type = q.shapeType, sol = b => solidOf(q, type, b.v);
    picks = [];
    for (const b of brief){ if (picks.length >= nFull) break; const s = sol(b); if (!picks.some(p=> { const c = compareSolids(s, sol(p)); return (c.orient == null || c.orient <= 8) && c.dimErr.every(e=> !Number.isFinite(e) || Math.abs(e) <= Math.exp(0.25) - 1); })) picks.push(b); }
  }
  for (const b of picks){ const c = full(b.v, 'full'); if (c != null) finals.push(c); }
  if (best){
    for (let p = 0; p < (cfg.polish ?? 2); p++){
      const before = chiTot(best.res);
      full(turned(best.v), 'polish');
      if (before - chiTot(best.res) < (cfg.polishTol ?? 0.5)*Math.max(1, res.stats.chi2)) break;
    }
  }
  if (!best){ setParams(model, vIso); return null; }
  const bic = r => (chiTot(r) - chiTot(res))/Math.max(1, res.stats.chi2) + (r.stats.P - res.stats.P)*Math.log(N);
  let held = false, dBICfree = NaN, dBICheld = NaN, freeOff = null, freeW = null;
  model.shapeSoft = null;
  const refineFrom = (v, nm, st) => { setParams(model, rebase(v)); try { const r = R(model, { free: nm, ...lmFull }, st); if (cfg.collect) cfg.collect.push({ stage: st, v: model.v.slice(), chi: chiTot(r), nu: r.stats.chi2, soft: false }); return { res: r, v: model.v.slice(), st, nm }; } catch(e){ return null; } };
  if (B.base !== 'ball'){ const ex = refineFrom(best.v, names, 'exact'); if (ex) best = ex; }
  if (!best.nm) best.nm = names;
  dBICfree = bic(best.res);
  let sn = null;
  const heldNames = names.filter(nm=> !q.iR.some(i=> model.par[i].name === nm));
  const frames = snaps(best.v);
  if (cfg.heldBrief && frames.length > (cfg.heldBrief.keep ?? 1)){
    // each lattice frame refined briefly, the best keep of them to convergence
    const tried = [];
    for (const vs of frames){
      setParams(model, rebase(vs));
      try { const r = R(model, { free: heldNames, ...lmFull, maxIter: cfg.heldBrief.iter ?? 6 }, 'heldBrief'); tried.push({ v: model.v.slice(), c: chiTot(r) }); } catch(e){}
    }
    tried.sort((a, b)=> a.c - b.c);
    for (const t of tried.slice(0, cfg.heldBrief.keep ?? 1)){
      const r = refineFrom(t.v, heldNames, 'held');
      if (r && (!sn || chiTot(r.res) < chiTot(sn.res))) sn = r;
    }
  } else for (const vs of frames){
    const r = refineFrom(vs, heldNames, 'held');
    if (r && (!sn || chiTot(r.res) < chiTot(sn.res))) sn = r;
  }
  if (sn){
    if (chiTot(sn.res) < chiTot(best.res)){
      const fr = refineFrom(turned(sn.v), names, 'refit');
      if (fr && chiTot(fr.res) < chiTot(best.res)){ best = fr; dBICfree = bic(best.res); }
    }
    dBICheld = bic(sn.res);
    const g2 = (chiTot(sn.res) - chiTot(best.res))/Math.max(1, best.res.stats.chi2);
    if (dBICheld < dBICfree && g2 <= (q.iR.length === 2 ? 5.99 : 7.81)){
      const Rf = bodyFrame(q, best.v), Rh = bodyFrame(q, sn.v);
      freeOff = [0, 1, 2].map(i=> Math.acos(Math.min(1, Math.abs(Rf[i]*Rh[i] + Rf[3 + i]*Rh[3 + i] + Rf[6 + i]*Rh[6 + i])))*R2D);
      freeW = q.iW.map(i=> best.v[i]);
      best = sn; held = true;
    }
  }
  const cb = chiTot(best.res), dBIC = bic(best.res);
  if (!(dBIC < -10)){ setParams(model, vIso); return { rejected: true, dBIC }; }
  setParams(model, best.v);
  // the esds of the fit returned, once, when its stage had none
  if (cfg.finalCov && X[best.st] && X[best.st].noCov){
    const r = refine(model, { free: best.nm || names, ...lmFull, x: { covOnly: true } });
    best.res = { ...r, stats: best.res.stats };
  }
  return { res: best.res, info: { type: q.shapeType, starts: starts.length, full: finals.length,
    chi2Iso: chiTot(res), chi2: cb, Piso: res.stats.P, P: best.res.stats.P, N, chi2redIso: res.stats.chi2, held, dBICfree, dBICheld, freeOff, freeW } };
}

/* The width surrogate (multi-fidelity): rows of measureWidths on the isotropic fit, each
   matched to its reflection; fit(v, iter) → v with the shape's widths, turns and X_s
   fitted to them by damped Gauss–Newton (forward differences), no pattern evaluated. */
function surrogateOf(model, k, res, opts, E, vIso){
  const q = model.phases[k];
  const mw = measureWidths(model, res, { irf: opts.irf });
  const ph = mw.phases.find(p=> String(p.id) === String(q.id)); if (!ph) return null;
  E.setParams(model, vIso);
  const ticks = E.calc(model, null, { internal: true }).ticks.filter(t=> t.pk === k);
  const rows = [];
  for (const r of ph.rows){
    if (!(r.Hs > 0) || !(r.HsEsd > 0) || r.unread || r.overlapped || r.edge || r.weak || r.flat || !r.hkl) continue;
    const t = ticks.find(t=> Math.abs(t.tt - r.ttCalc) < 0.02); if (!t) continue;
    const th = t.tt/2*E.D2R;
    rows.push({ r: t.r, H: r.Hs, s: r.HsEsd, sec: 1/Math.cos(th), tan: Math.tan(th) });
  }
  if (rows.length < 3) return null;
  const idx = [...q.iW, ...q.iR, q.iXs];
  const fwhm = ls => {
    // the FWHM of equal-area Lorentzians of FWHM ls, one centre
    let f0 = 0; for (const l of ls) f0 += 2/l;
    let lo = Math.min(...ls)/2, hi = Math.max(...ls)/2;
    const f = x => { let t = 0; for (const l of ls){ const g = l/2; t += g/(g*g + x*x); } return t; };
    for (let i = 0; i < 50; i++){ const m = (lo + hi)/2; if (f(m) > f0/2) lo = m; else hi = m; }
    return lo + hi;
  };
  const resid = v => {
    const W = E.shapeWidths(model, q, v), Xs = v[q.iXs];
    return rows.map(o=> { const ls = Array.from(W[o.r], w=> Math.max(1e-6, Xs*o.tan + w*o.sec)); return (o.H - fwhm(ls))/o.s; });
  };
  const chi = rr => rr.reduce((t, x)=> t + x*x, 0);
  const fit = (v0, iter) => {
    let v = v0.slice(), r0 = resid(v), c0 = chi(r0), lam = 1e-2;
    for (let it = 0; it < iter; it++){
      const J = idx.map(j=> { const h = Math.max(1e-6, 1e-4*Math.abs(v[j])), vv = v.slice(); vv[j] += h; const rr = resid(vv); return rr.map((x, i)=> (x - r0[i])/h); });
      const m = idx.length, A = Array.from({ length: m }, (_, a)=> Array.from({ length: m }, (_, b)=> J[a].reduce((t, x, i)=> t + x*J[b][i], 0))), g = J.map(c=> -c.reduce((t, x, i)=> t + x*r0[i], 0));
      let ok = false;
      for (let tries = 0; tries < 10 && !ok; tries++){
        const M = A.map((row, a)=> row.map((x, b)=> a === b ? x*(1 + lam) + 1e-12 : x));
        const d = solve(M, g); if (!d){ lam *= 10; continue; }
        const vn = v.slice();
        idx.forEach((j, a)=> { let x = d[a]; if (q.iR.includes(j)) x = Math.max(-0.4, Math.min(0.4, x)); vn[j] = v[j] + x; if (!q.iR.includes(j) && vn[j] < 0) vn[j] = 0; });
        const rn = resid(vn), cn = chi(rn);
        if (cn < c0){ v = vn; r0 = rn; ok = (c0 - cn) > 1e-6*c0 ? true : 'stop'; c0 = cn; lam = Math.max(1e-6, lam/10); }
        else lam *= 10;
      }
      if (ok !== true) break;
    }
    return v;
  };
  return { rows, fit };
}
function solve(A, b){
  const n = b.length, M = A.map((r, i)=> [...r, b[i]]);
  for (let c = 0; c < n; c++){
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (!(Math.abs(M[p][c]) > 1e-300)) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++){ const f = M[r][c]/M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f*M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--){ let t = M[r][n]; for (let j = r + 1; j < n; j++) t -= M[r][j]*x[j]; x[r] = t/M[r][r]; }
  return x;
}
