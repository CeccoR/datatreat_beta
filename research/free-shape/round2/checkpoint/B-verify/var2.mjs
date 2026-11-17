/* Track B: b9bef5f's freeShapeRun for the bodies, copied with knobs on the search's
   efficiency. make(cfg) → a harness method. With cfg = {} it is today's search, evaluation for
   evaluation (checked against the pilot's records by check-replica.mjs). Knobs:
   - lm: { brief, full, polish, exact, held, refit } or all: refine()'s opts.x per stage
     (make-eng.mjs: noCov, fwd).
   - final: what the returned fit gets once the outcome is decided.
     'none' (today: its own refinement made the covariance);
     'cov': the covariance alone (covOnly, central), when its stage ran with noCov;
     'central': the covariance alone first (recorded as stats.covOnly), then the fit refined
       once more with central differences and a covariance (stats.central; logged as stage
       'central'). The record holds both: stats.pre is the fit before the central pass, so the
       variant without it ("fwd") and with it ("fwdC") come from one run: fwd's cost is the
       whole less the central pass, fwdC's the whole less the covOnly.
   - held: 'all' (today) | 'count' (every frame refined, those whose canonical form repeats
     an earlier one flagged in stats.heldDup with their evaluations) | 'canon' (those not
     refined) | 'signs' (frames equal up to axis signs not refined: round 1's dedupe).
     The canonical form is the harness's canonical(): the class's fundamental zone, the
     frame made canonical as a whole.
   - starts: 'today' (the random fill to shapeStarts + 1) | 'distinct' (only the class's
     distinct low-index starts, no random fill: 1 + 2 × families) | 'fz' (the fill drawn at
     random but kept only when its most telling axis lies at least fzDeg (20°) from every
     earlier start's, modulo the class: the fundamental zone less what the starts already
     cover; the count is what the zone leaves room for, at most today's).
   - fullDedup: 'none' | 'drop' (a brief end among the best nFull that is the same solid as
     a better one, modulo the class and the body, 8° and e^0.25 as sameSolid, is not
     refined fully) | 'replace' (the next distinct brief end instead: round 1's dedupFull).
   stats: search { evals, ms }, stages [{ st, ev, ms, it, chi }], starts (count, random),
   heldDup, covOnly, central, pre (the fit before the central pass: chi, solid, held). */
import { canonical, solidOf, sameSolid } from '../B/h/lib.mjs';

export function make(cfg = {}){
  const stats = {};
  return {
    name: cfg.name || 'var', cfg, stats,
    search(model, k, res, free, opts, E, ctx){
      for (const key of Object.keys(stats)) delete stats[key];
      const q = model.phases[k];
      stats.list = { refl: q.nRefl, members: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, points: model.n };
      stats.stages = [];
      const e0 = E.FS.evals, t0 = Date.now();
      model.shapeSoft = q.iW ? { q, soft: E.SHAPE_SOFT } : null;
      let r;
      try { r = run(model, k, res, free, opts, E, ctx, cfg, stats); }
      finally { model.shapeSoft = null; }
      stats.search = { evals: E.FS.evals - e0, ms: Date.now() - t0 };
      return r;
    },
  };
}
export default make({ name: 'var' });

function run(model, k, res, free, opts, E, ctx, cfg, S){
  const { refine, setParams, bodyFrame, BODIES, quatMat, quatOfMat, lowIndexAxes, lattDirection, latticeAcross, columnLengthV, fitSettings, SNAP_DEG, D2R, R2D } = E;
  const q = model.phases[k], pf = q.pfx, vIso = model.v.slice(), type = q.shapeType, id = ctx.id;
  if (q.iL) throw new Error('var: bodies only');
  const F = fitSettings(opts.fit), nStarts = F.shapeStarts, nFull = F.shapeFull;
  const lmBrief = { maxIter: Math.min(8, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const lmFull = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const N = res.stats.N, chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
  const y0 = Math.max(vIso[q.iYs], 1e-3);
  let seed = 0x9e3779b9 >>> 0;
  const rnd = ()=> { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const gauss = ()=> Math.sqrt(-2*Math.log(rnd() || 1e-12))*Math.cos(2*Math.PI*rnd());
  const unit = t => { const n = Math.hypot(...t); return t.map(x=> x/n); };
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const rotation = (n, phi) => { const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
    return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
  const mul = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const randomTurn = ()=> quatMat(unit([gauss(), gauss(), gauss(), gauss()]));
  const tilt = e => unit([e[0] + 0.08*gauss(), e[1] + 0.08*gauss(), e[2] + 0.08*gauss()]);
  const axesLow = lowIndexAxes(q);
  const B = BODIES[type];
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
  // the starts' most telling axes (for the 'fz' fill): a plate's normal, a needle's axis
  const princ = [];
  const princOf = (W, R) => { const w = B.axes(W); if (B.rot === 2) return [R[2], R[5], R[8]];
    const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(w[i] - w[j])));
    let p = 0; for (const i of [1, 2]) if (gap(i) > gap(p)*(1 + 1e-9)) p = i; return [R[p], R[3 + p], R[6 + p]]; };
  const addStart = (W, R, telling = true) => { starts.push(put(W, R)); if (telling) princ.push(princOf(W, R)); };
  addStart(Wof(w0, w0, w0), frameAlong(axesLow[0] || [0, 0, 1]), false);
  for (const e of axesLow){
    addStart(Wof(0.5*w0, 0.7*w0, 2.5*w0), frameAlong(e));
    addStart(Wof(1.2*w0, 1.6*w0, 0.4*w0), frameAlong(e));
  }
  const nDet = starts.length;
  const mode = cfg.starts || 'today';
  if (mode === 'today'){
    while (starts.length < nStarts + 1) starts.push(put(Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))), randomTurn()));
  } else if (mode === 'distinctSameRng'){
    // [B-verify] symA's starts, but the fill's random numbers drawn and thrown away, so that
    // the later random turns (polish, refit) see the same stream as today's and fwdH's
    for (let c = starts.length; c < nStarts + 1; c++){ Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))); randomTurn(); }
  } else if (mode === 'fz'){
    // the fill: random, but at least fzDeg from every earlier start's telling axis modulo the
    // class's rotations (axes without sign); 200 draws a slot, then the zone has no room left
    const lim = Math.cos((cfg.fzDeg ?? 20)*D2R), rots = ctx.rots;
    const near = (a, b) => rots.some(G=> Math.abs(dot([G[0]*a[0] + G[1]*a[1] + G[2]*a[2], G[3]*a[0] + G[4]*a[1] + G[5]*a[2], G[6]*a[0] + G[7]*a[1] + G[8]*a[2]], b)) > lim);
    let draws = 0;
    while (starts.length < nStarts + 1){
      let ok = false;
      for (let t = 0; t < 200 && !ok; t++){
        draws++;
        const W = Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))), R = randomTurn(), a = princOf(W, R);
        if (!princ.some(b=> near(a, b))){ addStart(W, R); ok = true; }
      }
      if (!ok) break;
    }
    S.fzDraws = draws;
  }
  S.starts = { n: starts.length, det: nDet, random: starts.length - nDet, mode };
  const rebase = v => { const vv = v.slice(), R = bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
  const turned = v => { const vv = rebase(v), R = mul(bodyFrame(q, v), rotation(unit([gauss(), gauss(), gauss()]), 0.02)); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
  const snaps = v => {
    const R = bodyFrame(q, v), col = i => [R[i], R[3 + i], R[6 + i]];
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
  // a refinement of stage st, with that stage's opts.x, logged in S.stages
  const xOf = st => (cfg.lm && cfg.lm[st]) || cfg.all || null;
  const R = (o, st) => {
    const x = xOf(st), e0 = E.FS.evals, t0 = Date.now();
    let r = null;
    try { r = refine(model, x ? { ...o, x } : o); return r; }
    finally { S.stages.push({ st, ev: E.FS.evals - e0, ms: Date.now() - t0, it: r ? r.iterations : null, chi: r ? chiTot(r) : null }); }
  };
  const steps = starts.length + nFull + 2;
  let done = 0;
  const tick = ()=> { done++; if (opts.onShape) opts.onShape(Math.min(1, done/steps)); };
  const brief = [];
  for (const putS of starts){
    const vv = vIso.slice(); vv[q.iYs] = 0;
    putS(vv);
    setParams(model, vv);
    try { const r = R({ free: names, ...lmBrief, audit: false }, 'brief'); brief.push({ v: model.v.slice(), chi: chiTot(r) }); } catch(e){}
    tick();
  }
  brief.sort((a, b)=> a.chi - b.chi);
  if (!brief.length){ setParams(model, vIso); return null; }
  const dP = names.length - free.length, dPmin = dP - (q.iR ? q.iR.length : 0), gain = brief.length ? (chiTot(res) - brief[0].chi)/Math.max(1, res.stats.chi2) : -Infinity;
  if (!(gain > (10 + dPmin*Math.log(N))/2)){ setParams(model, vIso); return { rejected: true, dBIC: dPmin*Math.log(N) - gain, early: true }; }
  let best = null;
  const finals = [];
  const full = (v, st) => {
    setParams(model, rebase(v));
    let r; try { r = R({ free: names, ...lmFull }, st); } catch(e){ return null; }
    if (!best || chiTot(r) < chiTot(best.res)) best = { res: r, v: model.v.slice(), st, nm: names };
    tick();
    return chiTot(r);
  };
  // the full refinements: the best nFull brief ends, or distinct ones (fullDedup)
  let picks = brief.slice(0, nFull);
  const fd = cfg.fullDedup || 'none';
  if (fd !== 'none'){
    const sol = b => b.sol || (b.sol = solidOf(q, type, b.v));
    const dup = (b, list) => list.some(p=> sameSolid(id, sol(b), sol(p)));
    const out = [];
    if (fd === 'drop'){ for (const b of picks) if (!dup(b, out)) out.push(b); }
    else for (const b of brief){ if (out.length >= nFull) break; if (!dup(b, out)) out.push(b); }
    S.fullPicks = { n: out.length, dropped: fd === 'drop' ? picks.length - out.length : null, ranks: out.map(b=> brief.indexOf(b)) };
    picks = out;
  }
  for (const b of picks){ const c = full(b.v, 'full'); if (c != null) finals.push(c); }
  if (best){
    for (let p = 0; p < 2; p++){
      const before = chiTot(best.res);
      full(turned(best.v), 'polish');
      if (before - chiTot(best.res) < 0.5*Math.max(1, res.stats.chi2)) break;
    }
  }
  if (!best){ setParams(model, vIso); return null; }
  const bic = r => (chiTot(r) - chiTot(res))/Math.max(1, res.stats.chi2) + (r.stats.P - res.stats.P)*Math.log(N);
  let held = false, dBICfree = NaN, dBICheld = NaN, freeOff = null, freeW = null;
  model.shapeSoft = null;
  const refineFrom = (v, nm, st) => { setParams(model, rebase(v)); try { const r = R({ free: nm, ...lmFull }, st); return { res: r, v: model.v.slice(), st, nm }; } catch(e){ return null; } };
  if (B.base !== 'ball'){ const ex = refineFrom(best.v, names, 'exact'); if (ex) best = ex; }
  dBICfree = bic(best.res);
  let sn = null;
  const heldNames = names.filter(nm=> !q.iR.some(i=> model.par[i].name === nm));
  const hd = cfg.held || 'all';
  const seen = [];
  S.heldDup = []; S.heldN = 0;
  for (const vs of snaps(best.v)){
    let dupOf = -1;
    if (hd !== 'all'){
      const so = solidOf(q, type, vs);
      if (hd === 'signs'){
        dupOf = seen.findIndex(t=> t.axes.every((c, i)=> Math.abs(Math.abs(dot(c, so.axes[i])) - 1) < 1e-9));
        if (dupOf < 0) seen.push(so);
      } else {
        const c = canonical(id, so);
        dupOf = seen.findIndex(t=> t.R.every((x, i)=> Math.abs(x - c.R[i]) < 1e-6) && t.dims.every((d, i)=> Math.abs(d - c.dims[i]) <= 1e-9*Math.abs(d)));
        if (dupOf < 0) seen.push(c);
      }
      if (dupOf >= 0 && hd !== 'count'){ S.heldDup.push({ dupOf, skipped: true }); continue; }
    }
    const e0 = E.FS.evals;
    const r = refineFrom(vs, heldNames, 'held');
    S.heldN++;
    if (dupOf >= 0) S.heldDup.push({ dupOf, ev: E.FS.evals - e0, chi: r ? chiTot(r.res) : null });
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
  let cb = chiTot(best.res);
  const dBIC = bic(best.res);
  if (!(dBIC < -10)){ setParams(model, vIso); return { rejected: true, dBIC }; }
  setParams(model, best.v);
  // the returned fit's covariance, once, when its stage made none; then (final 'central') the
  // fit refined once more with central differences
  const fin = cfg.final || 'none', xs = xOf(best.st);
  if ((fin === 'cov' || fin === 'central') && xs && xs.noCov){
    const e0 = E.FS.evals, t0 = Date.now();
    const r = refine(model, { free: best.nm || names, ...lmFull, x: { covOnly: true } });
    S.covOnly = { ev: E.FS.evals - e0, ms: Date.now() - t0, chi: chiTot(r) };
    best.res = { ...r, stats: best.res.stats };
    best.v = model.v.slice();
  }
  if (fin === 'central'){
    S.pre = { chi: cb, held, solid: solidOf(q, type, model.v), v: model.v.slice() };
    const e0 = E.FS.evals, t0 = Date.now();
    let r = null;
    try { r = R({ free: best.nm || names, ...lmFull }, 'central'); } catch(e){ S.central = { error: String(e) }; }
    if (r){
      S.central = { ev: E.FS.evals - e0, ms: Date.now() - t0, it: r.iterations, chi: chiTot(r), dChi: chiTot(r) - cb, chi2nu: r.stats.chi2 };
      best = { ...best, res: r, v: model.v.slice() };
      cb = chiTot(r);
    } else setParams(model, best.v);
  }
  return { res: best.res, info: { type, starts: starts.length, full: finals.length,
    chi2Iso: chiTot(res), chi2: cb, Piso: res.stats.P, P: best.res.stats.P, N, chi2redIso: res.stats.chi2, held, dBICfree, dBICheld, freeOff, freeW } };
}
