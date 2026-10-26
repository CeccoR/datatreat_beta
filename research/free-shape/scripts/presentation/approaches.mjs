/* The presentation approaches: each turns one run's inputs into ONE solid with intervals
   (95 %) on its dimensions and cones on its axes. Same solid as searched (P0–P3) or across
   the solids (P4, P5: principal column lengths, class-independent).
   Interval conventions: [lo, hi] in nm (hi Infinity: a lower bound only); a cone is a
   half-angle in degrees (180: no direction claimed). */
import { align, alignL, Lprin, Lfactor, mixQuantile, TYPES, ROUND, dimOf } from './plib.mjs';
import { sameSolid } from '../harness/lib.mjs';

const wIxOf = type => ['spheroid', 'cylinder', 'sqbox'].includes(type) ? [0, 0, 1] : [0, 1, 2];
const exp = Math.exp;
const NOCONE = 180;
// a tilt has two directions: its 95 % cone is √5.99 = 2.45 σ (Rayleigh), not 2σ (86 %)
export const KCONE = 2.45;

/* The reported solid and its own resolution, as the app computes them (uniq.app: linear
   esds with the held/free difference, groups, angular esds by profile). */
export function P0_app(R){
  const u = R.uq, rep = u.reported.solid, app = u.app;
  const iv = [0, 1, 2].map(()=> [0, Infinity]), cone = [NOCONE, NOCONE, NOCONE], grp = [-1, -1, -1];
  (app.groups || []).forEach((g, gi)=> g.axes.forEach(i=> { grp[i] = gi; }));
  for (const a of app.axes){
    const i = a.axis;
    if (grp[i] >= 0){ const g = app.groups[grp[i]]; iv[i] = Number.isFinite(g.Desd) ? [Math.max(0, g.D - 2*g.Desd), g.D + 2*g.Desd] : [0, Infinity]; }
    else if (Number.isFinite(a.D) && Number.isFinite(a.Desd)) iv[i] = [Math.max(0, a.D - 2*a.Desd), a.D + 2*a.Desd];
    else if (!Number.isFinite(a.D)) iv[i] = [Number.isFinite(a.Dmin) ? a.Dmin : 0, Infinity];
    else iv[i] = [0, Infinity];
    if (Number.isFinite(a.esdAngle) && a.esdAngle <= 30 && grp[i] < 0) cone[i] = KCONE*a.esdAngle;
  }
  // a body of revolution's round section: no direction (its axis keeps the app's)
  if (ROUND[rep.type]){ cone[0] = cone[1] = NOCONE; }
  return { solid: rep, iv, cone, est: rep.dims.slice() };
}

/* The reported solid with 2σ profile-likelihood intervals of its widths (uniq.profile:
   every other free parameter refined again at each step), cones as the app's. */
function profIv(u, rep){
  const wIx = wIxOf(rep.type);
  return [0, 1, 2].map(i=> {
    const p = u.profile && u.profile[wIx[i]], D = rep.dims[i];
    if (!p || !Number.isFinite(D)) return [Number.isFinite(D) ? D*exp(-0.2) : 0, Infinity];
    const th = p.sides.thinner && p.sides.thinner.s2, lo = p.sides.longer && p.sides.longer.s2;
    return [th == null ? 0 : D*exp(-th), lo == null || lo > 1.6 ? Infinity : D*exp(lo)];
  });
}
export function P1_profile(R){
  const b = P0_app(R), rep = R.uq.reported.solid;
  return { ...b, iv: profIv(R.uq, rep) };
}

/* The minima of the searched solid with Δ (χ²_ν units of the best, floored at 1), the
   reported solid first; minima of the reported one's morphology merged into it. */
export function minimaOf(R, { merge = false } = {}){
  const u = R.uq, rep = u.reported, nu0 = Math.max(1, u.nu0 || 1);
  // (the reported free fit is also the uniqueness study's first minimum: once)
  const same = m => Math.abs(m.chi - rep.chi) <= 1e-9*Math.abs(rep.chi) && m.solid.dims.every((d, i)=> d === rep.solid.dims[i] || Math.abs(d/rep.solid.dims[i] - 1) < 1e-9);
  const all = [{ ...rep, isRep: true }, ...u.minima.filter(m=> !same(m)).map(m=> ({ ...m }))];
  const c0 = Math.min(...all.map(m=> m.chi));
  for (const m of all) m.D = (m.chi - c0)/nu0;
  if (!merge) return all;     // a held result's free fit stays a minimum of its own (§10.7: about as likely)
  const out = [all[0]];
  for (const m of all.slice(1)){
    if (sameSolid(m.solid, rep.solid)){ out[0].D = Math.min(out[0].D, m.D); continue; }
    out.push(m);
  }
  return out;
}
// one minimum's 2σ interval on the reported solid's axis it pairs with
function minIv(m, fi, k = 2){
  const D = m.solid.dims[fi], s = m.sLogW ? m.sLogW[fi] : NaN;
  if (!Number.isFinite(D)) return [Number.isFinite(s) ? 0 : 0, Infinity];
  // a linear esd past a factor 2 (2σ in log > 0.7) is no longer a measure (the profile is
  // one-sided there): the minimum then says only "about D or more"
  if (!Number.isFinite(s) || k*s > 0.7) return [D, Infinity];
  return [D*exp(-k*s), D*exp(k*s)];
}
const union = (a, b) => [a[0] == null ? b[0] : b[0] == null ? a[0] : Math.min(a[0], b[0]), Math.max(a[1], b[1])];
function envelopeOver(R, set, { points = false } = {}){
  const b = P1_profile(R), rep = R.uq.reported.solid, iv = b.iv.map(x=> x.slice()), cone = b.cone.slice(), spread = [0, 0, 0];
  for (const m of set){
    if (m.isRep) continue;
    const a = align(m.solid, rep);
    // (a held result's free fit: its own interval, §10.7's "about as likely")
    const own = !points || (points === 'held' && m.src === 'free-of-held');
    a.per.forEach((p, i)=> { const D = m.solid.dims[p.fi]; iv[i] = union(iv[i], own ? minIv(m, p.fi) : [D, D]); if (p.angle != null) spread[i] = Math.max(spread[i], p.angle); });
  }
  for (let i = 0; i < 3; i++) if (cone[i] < NOCONE) cone[i] = Math.min(NOCONE, cone[i] + spread[i]);
  return { ...b, iv, cone, n: set.length, spread };
}
/* P2: every minimum within Δ ≤ τ (τ in χ²_ν units). */
export const P2_envelope = tau => R => envelopeOver(R, minimaOf(R).filter(m=> m.isRep || m.D <= tau));
/* P3: the 95 % credible set of minima, weights e^(−Δ/2), smallest set first by weight. */
export function credible(ms, p = 0.95){
  const w = ms.map(m=> exp(-m.D/2)), W = w.reduce((t, x)=> t + x, 0);
  const ix = ms.map((_, i)=> i).sort((a, b)=> w[b] - w[a]);
  const out = []; let c = 0;
  for (const i of ix){ out.push(ms[i]); c += w[i]/W; if (c >= p) break; }
  return { set: out, w: w.map(x=> x/W) };
}
export function P3_credible(R){ const ms = minimaOf(R), cs = credible(ms); return { ...envelopeOver(R, cs.set.some(m=> m.isRep) ? cs.set : [ms[0], ...cs.set]), weights: cs.w }; }
/* P3m: a likelihood-weighted mixture in log D (the reported: split normal from its profile;
   the others: their linear esds), its 2.5 and 97.5 % quantiles; cones as P3. */
export function P3_mixture(R){
  const ms = minimaOf(R), rep = R.uq.reported.solid, cs = credible(ms), prof = profIv(R.uq, rep);
  const base = P3_credible(R);
  const iv = [0, 1, 2].map(i=> {
    const comps = ms.map((m, j)=> {
      if (m.isRep){ const D = rep.dims[i], [lo, hi] = prof[i];
        return { w: cs.w[j], mu: Math.log(D), sLo: lo > 0 ? Math.log(D/lo)/2 : Infinity, sHi: Number.isFinite(hi) ? Math.log(hi/D)/2 : Infinity }; }
      const a = align(m.solid, rep), fi = a.per[i].fi, D = m.solid.dims[fi], s = m.sLogW ? m.sLogW[fi] : NaN;
      return { w: cs.w[j], mu: Math.log(D), sLo: Number.isFinite(s) ? s : Infinity, sHi: Number.isFinite(s) ? s : Infinity };
    });
    return [mixQuantile(comps, 0.025), mixQuantile(comps, 0.975)];
  });
  return { ...base, iv, est: [0, 1, 2].map(i=> rep.dims[i]) };
}

/* ---------- across the solids ---------- */
/* The fits of every solid on one pattern: the searched one's reported fit (uniq) and the
   others' (xclass), each with χ², P, its solid and log-width esds; Δ BIC against the best. */
export function classFits(R){
  const out = [];
  const N = R.iso.N;
  if (R.uq){ const r = R.uq.reported, Dmin = [0, 1, 2].map(i=> { const a = (R.uq.app.axes || []).find(a=> a.axis === i); return a && Number.isFinite(a.Dmin) ? a.Dmin : NaN; });
    out.push({ type: r.solid.type, chi: r.chi, P: r.P, solid: r.solid, sLogW: r.sLogW, Dmin, prof: profIv(R.uq, r.solid), held: !!R.base.held, own: true, chi2nu: r.chi2nu }); }
  for (const t of TYPES){
    if (t === R.type) continue;
    const x = R.xc[t]; if (!x) continue;
    if (!x.kept){ out.push({ type: t, rejected: true, dBIC: x.dBIC }); continue; }
    const d = x.info.desc, wN = d.names.filter(n=> /\.(W|E)[a-z]$/.test(n));
    const sWa = d.W.map((w, j)=> d.cov && d.cov[j] ? Math.sqrt(Math.max(0, d.cov[j][j])) : NaN), sW = sWa.map((s, j)=> s/d.W[j]);
    const wIx = wIxOf(t);
    // an unbounded dimension's lower limit, as the app gives it: D of 2σ_W
    // (a face's width only: a ball's axis or an elliptic section's on 0 has no meaningful esd, §10.9)
    const face = i => ({ box: true, sqbox: true, cylinder: i === 2, ellcyl: i === 2 })[t] || false;
    const Dmin = [0, 1, 2].map(i=> face(i) && Number.isFinite(sWa[wIx[i]]) && sWa[wIx[i]] > 0 ? dimOf(2*sWa[wIx[i]]) : NaN);
    out.push({ type: t, chi: x.chi2, P: x.P, solid: x.solid, sLogW: [0, 1, 2].map(i=> sW[wIx[i]]), Dmin, held: x.held, chi2nu: d.chi2nu, nW: wN.length });
  }
  const ok = out.filter(f=> !f.rejected);
  if (!ok.length) return { fits: out, N };
  const nu0 = Math.max(1, Math.min(...ok.map(f=> f.chi2nu)));
  for (const f of ok) f.bic = f.chi/nu0 + f.P*Math.log(N);
  const b0 = Math.min(...ok.map(f=> f.bic));
  for (const f of ok) f.dBIC = f.bic - b0;
  ok.sort((a, b)=> a.dBIC - b.dBIC);
  return { fits: ok, rejected: out.filter(f=> f.rejected), N, nu0 };
}
const Liv = (f, i) => {
  // the 2σ interval of a fit's principal column length along its axis i; an unbounded one:
  // over the app's limit (D of 2σ_W) where known, else null below (no lower limit known:
  // the union then keeps the others')
  const L = Lprin(f.solid)[i], D = f.solid.dims[i];
  if (!Number.isFinite(L)){ const dm = f.Dmin && f.Dmin[i]; return [Number.isFinite(dm) ? dm*Lfactor(f.solid.type, i) : null, Infinity]; }
  if (f.prof){ const [lo, hi] = f.prof[i]; return [L*lo/D, Number.isFinite(hi) ? L*hi/D : Infinity]; }
  const s = f.sLogW[i];
  if (!Number.isFinite(s) || 2*s > 0.7) return [L, Infinity];
  return [L*exp(-2*s), L*exp(2*s)];
};
/* P4: the BIC-weighted credible set of solids (95 %), intervals on the principal column
   lengths of the most probable one, the union over the set; its axes' cones widened by the
   others' angles, and no direction where a solid of the set has none (a disc beside a box:
   the in-plane edges). cone0: the searched solid's angular esds (profile, P0) × 2. */
export function P4_classes(R, { p = 0.95, cone0 = null } = {}){
  const { fits } = classFits(R);
  if (!fits || !fits.length || fits.every(f=> f.rejected)) return null;
  const w = fits.map(f=> exp(-f.dBIC/2)), W = w.reduce((t, x)=> t + x, 0);
  const set = []; let c = 0;
  for (let i = 0; i < fits.length; i++){ set.push(fits[i]); c += w[i]/W; if (c >= p) break; }
  const ref = set[0];
  const iv = [0, 1, 2].map(i=> Liv(ref, i)), spread = [0, 0, 0], undef = [false, false, false];
  if (ROUND[ref.type]){ undef[0] = undef[1] = true; }
  for (const f of set.slice(1)){
    const a = alignL(f.solid, ref.solid);
    a.per.forEach((q, i)=> { iv[i] = union(iv[i], Liv(f, q.fi)); if (q.angle != null) spread[i] = Math.max(spread[i], q.angle); else if (ROUND[f.type] && q.fi < 2) undef[i] = true; });
  }
  // cones: the searched solid's own (mapped onto ref's axes) where known, else 2×10°
  let c0 = [20, 20, 20];
  if (cone0 && R.uq){ const a = alignL(R.uq.reported.solid, ref.solid); c0 = a.per.map(q=> cone0[q.fi]); }
  const cone = [0, 1, 2].map(i=> undef[i] || c0[i] >= NOCONE ? NOCONE : Math.min(NOCONE, c0[i] + spread[i]));
  return { solid: ref.solid, iv: iv.map(([lo, hi])=> [lo ?? 0, hi]), cone, est: Lprin(ref.solid), set: set.map(f=> ({ type: f.type, dBIC: f.dBIC, held: f.held })), L: true };
}
/* P5: Occam: the solid with the fewest parameters among those within ΔBIC ≤ tau of the
   best (ties: the lower ΔBIC), its own intervals (2σ: the searched solid's profile, the
   others' linear esds); cones as P4 for that one solid alone. */
export function P5_occam(R, { tau = 10, cone0 = null } = {}){
  const { fits } = classFits(R);
  if (!fits || !fits.length) return null;
  const nPar = t => ({ spheroid: 4, cylinder: 4, sqbox: 5, ellipsoid: 6, box: 6, ellcyl: 6 })[t];
  const cand = fits.filter(f=> f.dBIC <= tau).sort((a, b)=> nPar(a.type) - nPar(b.type) || a.dBIC - b.dBIC);
  const f = cand[0];
  let c0 = [20, 20, 20];
  if (cone0 && R.uq){ const a = alignL(R.uq.reported.solid, f.solid); c0 = a.per.map(q=> cone0[q.fi]); }
  const cone = [0, 1, 2].map(i=> ROUND[f.type] && i < 2 ? NOCONE : c0[i]);
  return { solid: f.solid, iv: [0, 1, 2].map(i=> Liv(f, i)).map(([lo, hi])=> [lo ?? 0, hi]), cone, est: Lprin(f.solid), chosen: f.type, dBIC: f.dBIC, L: true };
}

/* P6: one credible set over every minimum found, of every solid: the searched solid's
   minima (the uniqueness study's, with their linear esds; the reported one with its
   profile) and the other solids' kept fits, BIC weights e^(−ΔBIC/2), 95 %. The intervals
   of the principal column lengths are the union over the set, on the axes of a reference
   member: the most probable (P6) or the simplest in the set (P6o, Occam: the one drawn).
   Cones as P4: the searched solid's profile cones widened by the set's angles; no
   direction where a member of the set has none (a round section). */
export function P6_all(R, { p = 0.95, cone0 = null, occam = false, union: useUnion = true } = {}){
  const cf = classFits(R);
  if (!cf.fits || !cf.fits.length) return null;
  const N = cf.N, nu0 = cf.nu0;
  const comps = cf.fits.filter(f=> !f.own).map(f=> ({ ...f }));
  // the searched solid's minima (not merged: a held result's free fit is its own member)
  const own = cf.fits.find(f=> f.own);
  if (own && R.uq){
    for (const m of minimaOf(R)){
      comps.push({ type: own.type, chi: m.chi, P: m.P, solid: m.solid, sLogW: m.sLogW, prof: m.isRep ? own.prof : null, own: true, isRep: !!m.isRep });
    }
  }
  for (const f of comps) f.bic = f.chi/nu0 + f.P*Math.log(N);
  const b0 = Math.min(...comps.map(f=> f.bic));
  for (const f of comps) f.dBIC = f.bic - b0;
  comps.sort((a, b)=> a.dBIC - b.dBIC);
  const w = comps.map(f=> exp(-f.dBIC/2)), W = w.reduce((t, x)=> t + x, 0);
  const set = []; let c = 0;
  for (let i = 0; i < comps.length; i++){ set.push(comps[i]); c += w[i]/W; if (c >= p) break; }
  const nPar = t => ({ spheroid: 4, cylinder: 4, sqbox: 5, ellipsoid: 6, box: 6, ellcyl: 6 })[t];
  const ref = occam ? [...set].sort((a, b)=> nPar(a.type) - nPar(b.type) || a.dBIC - b.dBIC)[0] : set[0];
  const iv = [0, 1, 2].map(i=> Liv(ref, i)), spread = [0, 0, 0], undef = [false, false, false];
  if (ROUND[ref.type]){ undef[0] = undef[1] = true; }
  for (const f of set){
    if (f === ref) continue;
    const a = alignL(f.solid, ref.solid);
    a.per.forEach((q, i)=> { if (useUnion) iv[i] = union(iv[i], Liv(f, q.fi)); if (q.angle != null) spread[i] = Math.max(spread[i], q.angle); else if (ROUND[f.type] && q.fi < 2) undef[i] = true; });
  }
  let c0 = [20, 20, 20];
  if (cone0 && R.uq){ const a = alignL(R.uq.reported.solid, ref.solid); c0 = a.per.map(q=> cone0[q.fi]); }
  const cone = [0, 1, 2].map(i=> undef[i] || c0[i] >= NOCONE ? NOCONE : Math.min(NOCONE, c0[i] + spread[i]));
  return { solid: ref.solid, iv: iv.map(([lo, hi])=> [lo ?? 0, hi]), cone, est: Lprin(ref.solid), set: set.map(f=> ({ type: f.type, dBIC: f.dBIC, own: !!f.own, rep: !!f.isRep })), ref: ref.type, L: true, nComps: comps.length };
}

/* P3p: the reported fit's profile interval widened to the other credible minima's values
   (their points, not their own intervals). */
export function P3_points(R){ const ms = minimaOf(R), cs = credible(ms); return { ...envelopeOver(R, cs.set.some(m=> m.isRep) ? cs.set : [ms[0], ...cs.set], { points: true }), weights: cs.w }; }
export function P3_pointsH(R){ const ms = minimaOf(R), cs = credible(ms); return { ...envelopeOver(R, cs.set.some(m=> m.isRep) ? cs.set : [ms[0], ...cs.set], { points: 'held' }), weights: cs.w }; }

/* ---------- from the search's own ends: no pattern evaluated beyond the search ---------- */
/* The search's refinement ends (R.base.log: every brief, full, polish, exact and held
   refinement, its χ² at the end and the solid it ended at). Δ in χ²_ν units of the reported
   fit (floored at 1) from the lowest exact end. A rounded-face end's χ² is approximate (the
   faces change a width by ≤ 1.1 %); a brief end's is not converged (its Δ is too large, so
   the set within τ is a subset of the converged one's). conv: ends of refinements past 8
   iterations only (full, polish, exact, held). */
export function endsOf(R, { conv = false } = {}){
  const L = (R.base.log || []).filter(l=> l.to && Number.isFinite(l.c) && (!conv || l.mi > 8));
  const ex = L.filter(l=> !l.soft || ['ellipsoid', 'spheroid'].includes(l.to.type));
  const c0 = Math.min(...(ex.length ? ex : L).map(l=> l.c), R.base.chi2Best ?? Infinity);
  const nu0 = Math.max(1, R.base.chi2nu || 1);
  return L.map(l=> ({ solid: l.to, D: (l.c - c0)/nu0, soft: !!l.soft, brief: l.mi <= 8 }));
}
function envelopeEnds(R, base, ends){
  const rep = base.solid, iv = base.iv.map(x=> x.slice()), cone = base.cone.slice(), spread = [0, 0, 0];
  for (const e of ends){
    if (e.solid.type !== rep.type) continue;
    const a = align(e.solid, rep);
    a.per.forEach((p, i)=> { const D = e.solid.dims[p.fi]; iv[i] = union(iv[i], [D, D]); if (p.angle != null) spread[i] = Math.max(spread[i], p.angle); });
  }
  for (let i = 0; i < 3; i++) if (cone[i] < NOCONE) cone[i] = Math.min(NOCONE, cone[i] + spread[i]);
  return { ...base, iv, cone, n: ends.length + 1, spread };
}
/* E_app(τ): the app's own intervals (P0) widened to the points of the search's ends within
   Δ ≤ τ; E_prof(τ): the profile intervals (P1) likewise. */
export const E_app = (tau, o = {}) => R => envelopeEnds(R, P0_app(R), endsOf(R, o).filter(e=> e.D <= tau));
export const E_prof = (tau, o = {}) => R => envelopeEnds(R, P1_profile(R), endsOf(R, o).filter(e=> e.D <= tau));

/* P0w: today's report with its intervals taken in the width, where the fit is linear: W ± 2σ_W
   gives D/(1 + 2r) to D/(1 − 2r), r = σ_D/D (= σ_W/W), open above when 2r ≥ 1 (a linear
   esd of 28 on 30 nm: over 10.6 nm, not 0–87). Where the app gives no esd for an axis (a
   spheroid's or a cylinder's section, a ball's axis on 0), the reported fit's own linear
   esd of log W (its covariance: no evaluation). Cones as P0. */
export function P0w(R){
  const u = R.uq, rep = u.reported.solid, app = u.app, b = P0_app(R);
  const wIx = wIxOf(rep.type), sLog = u.reported.sLogW || [];
  const grp = [-1, -1, -1]; (app.groups || []).forEach((g, gi)=> g.axes.forEach(i=> { grp[i] = gi; }));
  const wiv = (D, r) => !Number.isFinite(r) ? null : [D/(1 + 2*r), 2*r < 1 ? D/(1 - 2*r) : Infinity];
  const iv = [0, 1, 2].map(i=> {
    const D = rep.dims[i], a = app.axes.find(x=> x.axis === i);
    if (!Number.isFinite(D)) return [a && Number.isFinite(a.Dmin) ? a.Dmin : 0, Infinity];
    if (grp[i] >= 0){ const g = app.groups[grp[i]]; const w = Number.isFinite(g.Desd) ? wiv(D, g.Desd/g.D) : null; if (w) return w; }
    else if (a && Number.isFinite(a.Desd)){ const w = wiv(D, a.Desd/D); if (w) return w; }
    const s = sLog[wIx[i]];
    return wiv(D, s) || [0, Infinity];
  });
  return { ...b, iv };
}
export const E_appW = (tau, o = {}) => R => envelopeEnds(R, P0w(R), endsOf(R, o).filter(e=> e.D <= tau));

/* E_L(τ): the same in column lengths ⟨L⟩_V along the reported solid's axes (a box's edge,
   a cylinder's height, 8/(3π) of its diameter, 3/4 of an ellipsoid's axis), each end of
   the search within Δ ≤ τ paired with the reported solid by its column lengths' sizes and
   orientation (alignL), not by the solid's axis classes: an elliptic cylinder whose axis
   lies on the thin extent and one whose axis lies on the middle extent then say the same
   thing (thin, middle, long), as they do to the data. No evaluation beyond today's. */
export const E_L = (tau, o = {}) => R => {
  const b = P0w(R), rep = b.solid, f = [0, 1, 2].map(i=> Lfactor(rep.type, i));
  const iv = b.iv.map(([lo, hi], i)=> [lo*f[i], hi*f[i]]), cone = b.cone.slice(), spread = [0, 0, 0];
  for (const e of endsOf(R, o).filter(e=> e.D <= tau)){
    const a = alignL(e.solid, rep), Le = Lprin(e.solid);
    a.per.forEach((p, i)=> { iv[i] = union(iv[i], [Le[p.fi], Le[p.fi]]); if (p.angle != null) spread[i] = Math.max(spread[i], p.angle); });
  }
  for (let i = 0; i < 3; i++) if (cone[i] < NOCONE) cone[i] = Math.min(NOCONE, cone[i] + spread[i]);
  return { ...b, iv, cone, est: Lprin(rep), L: true, spread };
};

/* ---------- model terms (on a column-length result such as E_L) ---------- */
/* withSys: widened to the background-degree variants' values and angles (sys.mjs rows:
   each variant's kept solid aligned to the reported one, dims per reported axis). */
export function withSys(res, sysRow){
  if (!sysRow) return null;
  const f = [0, 1, 2].map(i=> Lfactor(res.solid.type, i)), iv = res.iv.map(x=> x.slice()), cone = res.cone.slice();
  for (const v of sysRow.vs) v.mapped.forEach((p, i)=> { const L = p.D*f[i]; iv[i] = [Math.min(iv[i][0], L), Math.max(iv[i][1], L)]; if (p.angle != null && cone[i] < NOCONE) cone[i] = Math.max(cone[i], res.cone[i] + p.angle); });
  return { ...res, iv, cone };
}
/* withMisfit: widened by the misfit bound σ·√((χ²_ν − 1)(N − P)) when χ²_ν is past the
   noise's 2σ (oneresult.mjs explains it). */
export function withMisfit(res, R, nuGiven){
  const nu = nuGiven ?? R.base.chi2nu, dof = R.iso.N - R.base.P;
  if (!(nu > 1 + 2*Math.sqrt(2/dof))) return res;
  const r = Math.sqrt((nu - 1)*dof), iv = res.iv.map(x=> x.slice());
  for (let i = 0; i < 3; i++){ const e = res.est[i], [lo, hi] = iv[i]; if (!Number.isFinite(e)) continue;
    iv[i] = [lo*Math.exp(-r*Math.log(e/lo)/1.96), Number.isFinite(hi) ? hi*Math.exp(r*Math.log(hi/e)/1.96) : Infinity]; }
  return { ...res, iv, cone: res.cone.map(c=> c < NOCONE ? c*(1 + r/KCONE) : c) };
}
/* withPick: the background degree chosen by BIC at the shape stage (sys.mjs rows: the kept
   solid refined again from itself at each degree): its values become the result, with the
   base result's relative intervals moved onto them (no covariance was kept for the refits);
   union: also widened to the other degrees' values (the model term). */
export function withPick(res, sysRow, { union: un = false } = {}){
  if (!sysRow) return null;
  const pick = sysRow.vs.find(v=> v.dBIC === 0), f = [0, 1, 2].map(i=> Lfactor(res.solid.type, i));
  // a measured length (hi/lo ≤ 1.5) moves with the pick; a poorly bound one takes the pick's value in
  const est = pick.mapped.map((p, i)=> p.D*f[i]), iv = res.iv.map(([lo, hi], i)=> { const k = est[i]/res.est[i]; return Number.isFinite(k) && k > 0 && hi/lo <= 1.5 ? [lo*k, hi*k] : [Math.min(lo, est[i]), Math.max(hi, est[i])]; });
  if (un) for (const v of sysRow.vs) v.mapped.forEach((p, i)=> { const L = p.D*f[i]; iv[i] = [Math.min(iv[i][0], L), Math.max(iv[i][1], L)]; });
  const dims = pick.mapped.map(p=> p.D);
  return { ...res, solid: { ...res.solid, dims }, est, iv, pickBg: pick.bg };
}
