/* Widths-screened starts for the free shape (BACKLOG's 7-step plan, v472 prototype), every
   body type, with the variants to test as options. Outside the app: the frozen engine's
   internals come in through ENG (harness/eng), nothing of the app is changed.

   1. The isotropic fit's peak widths (measureWidths, the rows not unread, overlapped, at
      an edge, weak, flat, or of several reflections).
   2. Candidates: lattice frames (a normal per family of indices up to 2, x on each of the
      6 simplest lattice directions across it; a body of revolution its axis alone) and an
      orientation grid (3000 super-Fibonacci rotations kept 15° apart modulo the crystal's
      proper rotations and the body's), each with templates of widths.
   3. Each candidate screened on the widths alone, its orientation held: its widths (log)
      and a strain X fitted by Nelder–Mead to the rows' corrected FWHMs, the FWHM of a sum
      of equal-area Lorentzians, one per member, (0.75|t|/L(t) + ...)/cosθ + X tanθ. No
      pattern is evaluated.
   4. Picks: the best distinct (10°, e^0.3), or one per normal family.
   5. Brief refinements of the picks from the screened widths, then freeShapeRun's own
      stages (early rejection, the best refined fully, polish, exact faces, held frames).

   Options (makeMethod): picks, sphere (the sphere-like start beside the picks), family
   (one per normal family), briefIter, lean (brief with the shape, X_s and the linear
   parameters alone), full (how many refined fully), dedupe (the full ones from distinct
   brief ends only), budget (stop the briefs after this many without a better basin),
   reject ('base' | 'first': the test after the first brief when the widths say isotropic),
   heldScreen (refine only the best n held frames, ranked by one evaluation each), polish,
   startX ('iso' | 'screen'), side (append the screen's record to process.env.WS_SIDE). */
import fs from 'node:fs';
import { measureWidths, chi2Survival } from '../../harness/eng/xrd-widths.js';
import { sameSolid } from '../../harness/lib.mjs';

const unit = t => { const n = Math.hypot(t[0], t[1], t[2]); return [t[0]/n, t[1]/n, t[2]/n]; };
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
const fromCols = ([x, y, z]) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
const colsOf = R => [[R[0], R[3], R[6]], [R[1], R[4], R[7]], [R[2], R[5], R[8]]];
const mul = (P, Q) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
const tr = P => [P[0], P[3], P[6], P[1], P[4], P[7], P[2], P[5], P[8]];
const angleOf = M => Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1)/2)));
function inv3(M){
  const [a, b, c, d, e, f, g, h, i] = M, A = e*i - f*h, B = -(d*i - f*g), C = d*h - e*g, det = a*A + b*B + c*C;
  return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, B/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det];
}
const K_LAM = (E, lam) => E.K_SCHERRER*lam;

/* ---------- symmetry ---------- */
// The crystal's proper rotations in Cartesian form: q.laue acts on indices as h' = Mᵀh,
// the diffraction vector is Bm·h, so the rotation is Bm·Mᵀ·Bm⁻¹.
function crystalRots(q){
  const Bi = inv3(q.Bm), out = [], seen = new Set();
  for (const M of q.laue){
    const C = mul(mul(q.Bm, tr(M)), Bi);
    const det = C[0]*(C[4]*C[8] - C[5]*C[7]) - C[1]*(C[3]*C[8] - C[5]*C[6]) + C[2]*(C[3]*C[7] - C[4]*C[6]);
    if (det < 0) continue;
    const key = C.map(x=> Math.round(x*1e6)).join();
    if (!seen.has(key)){ seen.add(key); out.push(C); }
  }
  return out;
}
// The body's own proper rotations (on body coordinates): a box's, an ellipsoid's, an
// elliptic cylinder's D2; a square-based box's D4; a body of revolution: null (its axis
// alone counts).
const D2 = [[1,0,0,0,1,0,0,0,1], [1,0,0,0,-1,0,0,0,-1], [-1,0,0,0,1,0,0,0,-1], [-1,0,0,0,-1,0,0,0,1]];
const D4 = [...D2, [0,-1,0,1,0,0,0,0,1], [0,1,0,-1,0,0,0,0,1], [0,1,0,1,0,0,0,0,-1], [0,-1,0,-1,0,0,0,0,-1]];
const bodyRots = type => type === 'sqbox' ? D4 : (type === 'spheroid' || type === 'cylinder') ? null : D2;
// Misorientation (rad) modulo both groups; for a body of revolution the angle between axes.
function misor(R1, R2, Cs, Bs){
  if (!Bs){
    const z1 = [R1[2], R1[5], R1[8]], z2 = [R2[2], R2[5], R2[8]];
    let best = Math.PI;
    for (const C of Cs){ const w = [C[0]*z2[0] + C[1]*z2[1] + C[2]*z2[2], C[3]*z2[0] + C[4]*z2[1] + C[5]*z2[2], C[6]*z2[0] + C[7]*z2[1] + C[8]*z2[2]]; best = Math.min(best, Math.acos(Math.min(1, Math.abs(dot(z1, w))))); }
    return best;
  }
  const R1t = tr(R1);
  let best = Math.PI;
  for (const C of Cs){ const A = mul(R1t, mul(C, R2)); for (const Bm of Bs){ const a = angleOf(mul(A, Bm)); if (a < best) best = a; } }
  return best;
}
// 3000 super-Fibonacci rotations (Alexa 2022), kept when 15° apart modulo the symmetry.
// The test needs only traces: for each kept K, A = KᵀC is stored for every crystal
// rotation C; tr(A·M·b) for a body rotation b = diag or signed permutation is read off A·M.
const gridCache = new Map();
function orientationGrid(q, type, E, n = 3000, sepDeg = 15){
  const key = type + '|' + q.laue.length + '|' + q.Bm.map(x=> x.toFixed(6)).join() + '|' + n + '|' + sepDeg;
  if (gridCache.has(key)) return gridCache.get(key);
  const Cs = crystalRots(q), Bs = bodyRots(type), phi = Math.SQRT2, psi = 1.533751168755204288118041, cmin = Math.cos(sepDeg*E.D2R), kept = [], pre = [];
  // body rotations as (perm, sign) on columns: (A·M·b)_ii = Σ_j (A·M)_ij b_ji
  const bs = (Bs || []).map(b=> b);
  const AM = new Float64Array(9);
  const close = M => {
    if (!Bs){
      const z = [M[2], M[5], M[8]];
      for (const P of pre) for (let c = 0; c < P.length; c += 3){ if (Math.abs(P[c]*z[0] + P[c + 1]*z[1] + P[c + 2]*z[2]) >= cmin) return true; }
      return false;
    }
    // angle < sep ⇔ tr > 1 + 2cos(sep)
    const lim = 1 + 2*cmin;
    for (const P of pre){
      for (let c = 0; c < P.length; c += 9){
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) AM[3*i + j] = P[c + 3*i]*M[j] + P[c + 3*i + 1]*M[3 + j] + P[c + 3*i + 2]*M[6 + j];
        for (const b of bs){ let t = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) t += AM[3*i + j]*b[3*j + i]; if (t >= lim) return true; }
      }
    }
    return false;
  };
  for (let i = 0; i < n; i++){
    const s = i + 0.5, r = Math.sqrt(s/n), R = Math.sqrt(1 - s/n), a = 2*Math.PI*s/phi, b = 2*Math.PI*s/psi;
    const M = E.quatMat([r*Math.sin(a), r*Math.cos(a), R*Math.sin(b), R*Math.cos(b)]);
    if (close(M)) continue;
    kept.push(M);
    if (!Bs){ const z = [M[2], M[5], M[8]], P = new Float64Array(3*Cs.length); Cs.forEach((C, c)=> { P[3*c] = C[0]*z[0] + C[1]*z[1] + C[2]*z[2]; P[3*c + 1] = C[3]*z[0] + C[4]*z[1] + C[5]*z[2]; P[3*c + 2] = C[6]*z[0] + C[7]*z[1] + C[8]*z[2]; }); pre.push(P); }
    else { const Kt = tr(M), P = new Float64Array(9*Cs.length); Cs.forEach((C, c)=> { const A = mul(Kt, C); for (let j = 0; j < 9; j++) P[9*c + j] = A[j]; }); pre.push(P); }
  }
  gridCache.set(key, kept);
  return kept;
}

/* ---------- the rows ---------- */
// The members of hkl (one of each ± pair) as Cartesian unit vectors, as memberVectors.
function membersOf(q, hkl){
  const seen = new Set(), out = [], [b11, b12, b13, , b22, b23, , , b33] = q.Bm;
  for (const M of q.laue){
    const h = hkl[0]*M[0] + hkl[1]*M[3] + hkl[2]*M[6], k = hkl[0]*M[1] + hkl[1]*M[4] + hkl[2]*M[7], l = hkl[0]*M[2] + hkl[1]*M[5] + hkl[2]*M[8];
    if (seen.has(h + ',' + k + ',' + l) || seen.has(-h + ',' + -k + ',' + -l)) continue;
    seen.add(h + ',' + k + ',' + l);
    out.push(unit([b11*h + b12*k + b13*l, b22*k + b23*l, b33*l]));
  }
  return out;
}
function readRows(model, k, res, opts, E){
  const q = model.phases[k], e0 = E.FS.evals, t0 = Date.now();
  let mw = null, err = null;
  try { mw = measureWidths(model, res, { irf: opts.irf || null }); } catch(e){ err = String(e && e.message || e); }
  const ms = Date.now() - t0, evals = E.FS.evals - e0;
  const ph = mw && mw.phases.find(p=> String(p.id) === String(q.id));
  const all = ph ? ph.rows : [];
  const use = all.filter(r=> !r.unread && !r.edge && !r.weak && !r.flat && !r.overlapped && r.hkl && Number.isFinite(r.Hs) && r.HsEsd > 0);
  const rows = use.map(r=> { const th = r.tt/2*E.D2R; return { label: r.label, tt: r.tt, Hs: r.Hs, esd: r.HsEsd, ic: 1/Math.cos(th), tn: Math.tan(th), mem: membersOf(q, r.hkl), iso: r.model && r.model.iso }; });
  // the isotropic model judged on its widths (measureWidths' own test, its rows capped at 3 esd)
  const isoRows = rows.filter(r=> Number.isFinite(r.iso));
  const chiIsoModel = isoRows.reduce((t, r)=> t + Math.min(9, ((r.Hs - r.iso)/r.esd)**2), 0);
  const isoP = isoRows.length >= 3 ? chi2Survival(chiIsoModel, isoRows.length) : 1;
  return { rows, nAll: all.length, ms, evals, err, isoP };
}

/* ---------- the screen ---------- */
// FWHM of a sum of equal-area Lorentzians of FWHMs G (centred alike): its half-maximum
// lies between the narrowest's and the broadest's.
function fwhmSum(G, M = G.length){
  let lo = Infinity, hi = 0;
  for (let i = 0; i < M; i++){ const g = G[i]; if (g < lo) lo = g; if (g > hi) hi = g; }
  if (!(hi > 0)) return 0;
  if (hi - lo < 1e-9*hi) return hi;
  // h(x) = Σ (1/g)/(1 + (2x/g)²) − ½Σ 1/g falls from + at lo/2 to − at hi/2: Newton in x,
  // kept inside the bracket (bisection where a step leaves it)
  let s0 = 0; for (let i = 0; i < M; i++) s0 += 1/G[i];
  let a = lo/2, b = hi/2, x = Math.sqrt(a*b);
  for (let it = 0; it < 30; it++){
    let h = -s0/2, d = 0;
    for (let i = 0; i < M; i++){ const g = G[i], r = 2*x/g, den = 1 + r*r; h += 1/(g*den); d -= 8*x/(g*g*g*den*den); }
    if (h > 0) a = x; else b = x;
    let xn = x - h/d;
    if (!(xn > a && xn < b)) xn = (a + b)/2;
    if (Math.abs(xn - x) < 1e-7*x){ x = xn; break; }
    x = xn;
  }
  return 2*x;
}
function nelderMead(f, x0, steps, maxIt, ftol = 1e-5){
  const n = x0.length;
  let S = [x0.slice()]; for (let i = 0; i < n; i++){ const x = x0.slice(); x[i] += steps[i]; S.push(x); }
  let F = S.map(f), it = 0;
  for (; it < maxIt; it++){
    const o = F.map((v, i)=> i).sort((a, b)=> F[a] - F[b]); S = o.map(i=> S[i]); F = o.map(i=> F[i]);
    if (Math.abs(F[n] - F[0]) <= ftol*(Math.abs(F[0]) + 1)) break;
    const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j]/n;
    const at = t => c.map((cj, j)=> cj + t*(S[n][j] - cj));
    const xr = at(-1), fr = f(xr);
    if (fr < F[0]){ const xe = at(-2), fe = f(xe); if (fe < fr){ S[n] = xe; F[n] = fe; } else { S[n] = xr; F[n] = fr; } }
    else if (fr < F[n - 1]){ S[n] = xr; F[n] = fr; }
    else {
      const xc = fr < F[n] ? at(-0.5) : at(0.5), fc = f(xc);
      if (fc < Math.min(fr, F[n])){ S[n] = xc; F[n] = fc; }
      else { for (let i = 1; i <= n; i++){ S[i] = S[i].map((x, j)=> S[0][j] + 0.5*(x - S[0][j])); F[i] = f(S[i]); } }
    }
  }
  const i0 = F.indexOf(Math.min(...F));
  return { x: S[i0], f: F[i0], it };
}
// The widths-only χ² of a body at orientation R: f(params) with params = [log W..., X].
function screenFn(rows, R, B, E){
  const base = B.base, nW = B.W.length, ball = base === 'ball';
  // the members in the body's axes (Rᵀu), once per candidate, flat
  const body = rows.map(r=> { const o = new Float64Array(3*r.mem.length); r.mem.forEach((u, m)=> { o[3*m] = R[0]*u[0] + R[3]*u[1] + R[6]*u[2]; o[3*m + 1] = R[1]*u[0] + R[4]*u[1] + R[7]*u[2]; o[3*m + 2] = R[2]*u[0] + R[5]*u[1] + R[8]*u[2]; }); return o; });
  const G = new Float64Array(64), t = [0, 0, 0];
  return p => {
    let wx, wy, wz;
    if (nW === 2){ wx = wy = Math.exp(p[0]); wz = Math.exp(p[1]); } else { wx = Math.exp(p[0]); wy = Math.exp(p[1]); wz = Math.exp(p[2]); }
    const X = Math.abs(p[nW]);
    let chi = 0;
    for (let i = 0; i < rows.length; i++){
      const r = rows[i], bm = body[i], M = bm.length/3;
      for (let m = 0; m < M; m++){
        t[0] = wx*bm[3*m]; t[1] = wy*bm[3*m + 1]; t[2] = wz*bm[3*m + 2];
        const n = Math.hypot(t[0], t[1], t[2]);
        const w = ball ? n : n > 0 ? 0.75*n/E.columnLengthV(base, t) : 0;
        G[m] = w*r.ic + X*r.tn;
      }
      const d = (r.Hs - fwhmSum(G, M))/r.esd;
      chi += d*d;
    }
    return chi;
  };
}
// The isotropic size on the widths: H = w/cosθ + X tanθ, weighted least squares (w, X ≥ 0).
function isoWidths(rows){
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (const r of rows){ const wt = 1/(r.esd*r.esd); a11 += wt*r.ic*r.ic; a12 += wt*r.ic*r.tn; a22 += wt*r.tn*r.tn; b1 += wt*r.ic*r.Hs; b2 += wt*r.tn*r.Hs; }
  const det = a11*a22 - a12*a12;
  let w = (a22*b1 - a12*b2)/det, X = (a11*b2 - a12*b1)/det;
  if (!(X >= 0)){ X = 0; w = b1/a11; } if (!(w >= 0)){ w = 0; X = Math.max(0, b2/a22); }
  const chi = rows.reduce((t, r)=> t + ((r.Hs - w*r.ic - X*r.tn)/r.esd)**2, 0);
  return { w, X, chi };
}

/* ---------- candidates ---------- */
// The families of lattice directions with indices up to 2, one normal each (Cartesian).
function normalFamilies(q, E){
  const B = q.Bm, Bi = inv3(B), M = q.constraint && q.constraint.basis;
  const cart = t => unit([Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]]);
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a), out = [], fams = new Set(), cand = [];
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) for (let w = -2; w <= 2; w++){
    if ((!u && !v && !w) || gcd(gcd(u, v), w) !== 1) continue;
    cand.push({ tc: [u, v, w], cx: u*u + v*v + w*w, neg: (u < 0) + (v < 0) + (w < 0) });
  }
  cand.sort((a, b)=> a.cx - b.cx || a.neg - b.neg);
  for (const c of cand){
    const t = M ? [M[0]*c.tc[0] + M[1]*c.tc[1] + M[2]*c.tc[2], M[3]*c.tc[0] + M[4]*c.tc[1] + M[5]*c.tc[2], M[6]*c.tc[0] + M[7]*c.tc[1] + M[8]*c.tc[2]] : c.tc;
    const e = cart(t), lab = E.lattDirection(q, e).label;
    if (fams.has(lab)) continue;
    fams.add(lab); out.push({ label: lab, n: e });
  }
  return out;
}
// Templates of widths along x, y, z (× w0), as each body's own W parameters.
function templates(type){
  const three = { plate: [0.5, 0.7, 2.5], needle: [1.2, 1.6, 0.4], ribbon: [0.4, 1.2, 2.5] };
  if (type === 'box' || type === 'ellipsoid') return { grid: three, frames: { ...three, ribbon2: [1.2, 0.4, 2.5] } };
  // an elliptic cylinder's axis z is its own class: a ribbon along its axis too
  if (type === 'ellcyl') return { grid: { ...three, ribbonAx: [2.5, 1.2, 0.4] }, frames: { ...three, ribbon2: [1.2, 0.4, 2.5], ribbonAx: [2.5, 1.2, 0.4] } };
  // two widths: a square-based box, a spheroid, a cylinder (no ribbon)
  return { grid: { plate: [0.6, 0.6, 2.5], needle: [1.4, 1.4, 0.4] }, frames: { plate: [0.6, 0.6, 2.5], needle: [1.4, 1.4, 0.4] } };
}

/* The sphere-curvature candidates: the widths χ² of an ellipsoid S = w0²·exp(E) (E
   symmetric, 6 components; a ball's width √(uᵀSu)) has, at the sphere, no first-order
   change along a traceless E on a cubic crystal; its Hessian there (central differences,
   no pattern evaluated) says which deformations lower χ² most. The k lowest eigen-
   deformations (the isotropic one left out) each give a frame (E's eigenvectors) and two
   starts, ±: widths w0·exp(±a·λ_i/max|λ|), a = ln 2.5. */
function eigSym(A, n){
  const a = A.map(r=> r.slice()), V = Array.from({ length: n }, (_, i)=> Array.from({ length: n }, (_, j)=> +(i === j)));
  for (let sw = 0; sw < 100; sw++){
    let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q]*a[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++){
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = 0.5*Math.atan2(2*a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < n; k++){ const x = a[k][p], y = a[k][q]; a[k][p] = c*x - s*y; a[k][q] = s*x + c*y; }
      for (let k = 0; k < n; k++){ const x = a[p][k], y = a[q][k]; a[p][k] = c*x - s*y; a[q][k] = s*x + c*y; }
      for (let k = 0; k < n; k++){ const x = V[k][p], y = V[k][q]; V[k][p] = c*x - s*y; V[k][q] = s*x + c*y; }
    }
  }
  return Array.from({ length: n }, (_, i)=> ({ val: a[i][i], vec: V.map(r=> r[i]) })).sort((x, y)=> x.val - y.val);
}
function curvatureCands(rows, w0, X0, B, k = 3){
  const sym = e => [[e[0], e[3], e[4]], [e[3], e[1], e[5]], [e[4], e[5], e[2]]];
  // the ellipsoid's widths χ² at S = w0²·exp(E): exp of a symmetric matrix by its eigen-decomposition
  const f = e => {
    const ev = eigSym(sym(e), 3), S = [0, 1, 2].map(i=> [0, 1, 2].map(j=> ev.reduce((t, x)=> t + Math.exp(x.val)*x.vec[i]*x.vec[j], 0)*w0*w0));
    let chi = 0;
    for (const r of rows){
      const G = r.mem.map(u=> { let q = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) q += u[i]*S[i][j]*u[j]; return Math.sqrt(q)*r.ic + X0*r.tn; });
      const d = (r.Hs - fwhmSum(G))/r.esd; chi += d*d;
    }
    return chi;
  };
  const h = 0.05, n = 6, z = new Array(n).fill(0), f0 = f(z), H = Array.from({ length: n }, ()=> new Array(n).fill(0));
  const at = (i, si, j, sj) => { const e = z.slice(); e[i] += si*h; if (j != null) e[j] += sj*h; return f(e); };
  for (let i = 0; i < n; i++){
    H[i][i] = (at(i, 1) - 2*f0 + at(i, -1))/(h*h);
    for (let j = i + 1; j < n; j++) H[i][j] = H[j][i] = (at(i, 1, j, 1) - at(i, 1, j, -1) - at(i, -1, j, 1) + at(i, -1, j, -1))/(4*h*h);
  }
  // off-diagonal components count twice in E·E (metric): scale so that the eigenproblem is in E's own norm
  const m = [1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  const Hm = H.map((r, i)=> r.map((x, j)=> x/(m[i]*m[j])));
  const eig = eigSym(Hm, n).map(x=> ({ val: x.val, e: x.vec.map((t, i)=> t/m[i]) }))
    // the isotropic deformation (trace) left out: the one most along the identity
    .filter(x=> Math.abs(x.e[0] + x.e[1] + x.e[2])/Math.hypot(...x.e.map((t, i)=> t*m[i])) < 0.9);
  const out = [];
  for (const x of eig.slice(0, k)){
    const d = eigSym(sym(x.e), 3), lam = d.map(t=> t.val), mx = Math.max(...lam.map(Math.abs)) || 1;
    // the most distinct eigen-axis on body z
    const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lam[i] - lam[j])));
    const iz = [0, 1, 2].sort((p, q)=> gap(q) - gap(p))[0], ix = [0, 1, 2].filter(i=> i !== iz);
    const zc = d[iz].vec, xc = d[ix[0]].vec, yc = cross(zc, xc);
    const R = fromCols([xc, yc, zc]);
    for (const sg of [1, -1]){
      const w = [ix[0], ix[1], iz].map(i=> w0*Math.exp(sg*Math.log(2.5)*lam[i]/mx));
      out.push({ R, W0: B.W.length === 2 ? [(w[0] + w[1])/2, w[2]] : w, tpl: sg > 0 ? 'curv+' : 'curv-', src: 'curv', fam: null, hval: x.val });
    }
  }
  return out;
}

/* ---------- the method ---------- */
export function makeMethod(o = {}){
  const opt = { picks: 6, sphere: false, family: false, briefIter: 8, lean: false, full: 3, dedupe: false, budget: 0, reject: 'base', heldScreen: 0, polish: true, startX: 'iso', gridN: 3000, gridSep: 15, screenShort: 60, screenTop: 24, ...o };
  return { name: opt.name || 'ws', opt, search(model, k, res, free, opts, E, ctx){
    const q = model.phases[k];
    model.shapeSoft = q.iW ? { q, soft: E.SHAPE_SOFT } : null;
    try { return run(model, k, res, free, opts, E, ctx, opt); }
    finally { model.shapeSoft = null; }
  } };
}

function run(model, k, res, free, opts, E, ctx, opt){
  const q = model.phases[k], pf = q.pfx, vIso = model.v.slice(), B = E.BODIES[q.shapeType], type = q.shapeType;
  if (!B) throw new Error('ws: bodies only');
  const F = E.fitSettings(opts.fit), nFull = opt.full;
  const lmBrief = { maxIter: Math.min(opt.briefIter, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const lmFull = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const N = res.stats.N, chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P), nu = Math.max(1, res.stats.chi2);
  const y0 = Math.max(vIso[q.iYs], 1e-3);
  const side = { case: ctx.case && ctx.case.id, seed: ctx.seed, method: opt.name, type };
  // seeded as freeShapeRun (the polish's turns)
  let seed = 0x9e3779b9 >>> 0;
  const rnd = ()=> { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const gauss = ()=> Math.sqrt(-2*Math.log(rnd() || 1e-12))*Math.cos(2*Math.PI*rnd());
  const rotation = (n, phi) => { const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
    return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
  const tilt = e => unit([e[0] + 0.08*gauss(), e[1] + 0.08*gauss(), e[2] + 0.08*gauss()]);
  const Wof = (wx, wy, wz) => B.W.length === 2 ? [(wx + wy)/2, wz] : [wx, wy, wz];
  let kappa = 0;
  for (let i = 0, M = 400; i < M; i++){
    const z = 1 - (2*i + 1)/M, rr = Math.sqrt(1 - z*z), ph = i*2.399963229728653, t = [rr*Math.cos(ph), rr*Math.sin(ph), z];
    kappa += (B.base === 'ball' ? 1 : 0.75/E.columnLengthV(B.base, t))/M;
  }
  const w0 = y0/kappa;
  const put = (W, R, X) => v => {
    W.forEach((t, i)=> { v[q.iW[i]] = t; });
    q.iR.forEach(i=> { v[i] = 0; });
    E.quatOfMat(R).forEach((t, i)=> { v[q.iQ[i]] = t; });
    if (X != null && Number.isFinite(X)) v[q.iXs] = X;
  };
  const lam = model.lines[0].lam, dimOf = W => W > 0 ? E.K_SCHERRER*lam/(W*E.D2R)/10 : Infinity;
  const solid = (W, R) => ({ type, W, dims: B.axes(W).map(dimOf), axes: colsOf(R) });

  /* 1–3: rows, candidates, screen */
  const t0 = Date.now();
  const rd = readRows(model, k, res, opts, E);
  Object.assign(side, { rows: rd.rows.length, rowsAll: rd.nAll, msWidths: rd.ms, evWidths: rd.evals, widthsErr: rd.err, isoP: rd.isoP });
  let cands = [];
  const ts = Date.now();
  const iso = rd.rows.length ? isoWidths(rd.rows) : null;
  const nW = B.W.length;
  if (rd.rows.length >= 3){
    const T = templates(type), fams = normalFamilies(q, E);
    const X0 = opt.startX === 'screen' ? Math.max(0.02, iso.X) : Math.max(0.02, vIso[q.iXs] || 0);
    const add = (R, tpl, src, fam) => { for (const nm in tpl){ cands.push({ R, W0: Wof(...tpl[nm].map(t=> t*w0)), tpl: nm, src, fam }); } };
    for (const f of fams){
      const z = f.n;
      if (B.rot === 2){ const x = unit(cross(z, Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); add(fromCols([x, cross(z, x), z]), T.frames, 'frame', f.label); continue; }
      const xs = E.latticeAcross(q, z, null, 0.01, 6);
      for (const { vec } of xs){ const x = unit(vec.map((t, i)=> t - dot(vec, z)*z[i])); add(fromCols([x, cross(z, x), z]), T.frames, 'frame', f.label); }
    }
    if (opt.source !== 'curv') for (const R of orientationGrid(q, type, E, opt.gridN, opt.gridSep)) add(R, T.grid, 'grid', null);
    if (opt.source === 'curv') cands = curvatureCands(rd.rows, w0, X0, B, opt.curvK || 3);
    else if (opt.curv) cands.push(...curvatureCands(rd.rows, w0, X0, B, opt.curvK || 3));
    // two stages: a short Nelder–Mead on every candidate, the best opt.screenTop carried on
    // to convergence (250 iterations in all, as the prototype)
    let nm = 0;
    for (const c of cands){
      c.f = screenFn(rd.rows, c.R, B, E);
      const x0 = [...(nW === 2 ? [c.W0[0], c.W0[1]] : c.W0).map(Math.log), X0], st = [...x0.slice(0, nW).map(()=> 0.35), 0.05];
      const r = nelderMead(c.f, x0, st, opt.screenShort, 1e-4); nm += r.it;
      c.x = r.x; c.chi = r.f;
    }
    cands.sort((a, b)=> a.chi - b.chi);
    for (const c of cands.slice(0, opt.screenTop)){
      const st = [...c.x.slice(0, nW).map(()=> 0.1), 0.02];
      const r = nelderMead(c.f, c.x, st, 250 - opt.screenShort, 1e-6); nm += r.it;
      c.x = r.x; c.chi = r.f;
    }
    for (const c of cands){ c.W = c.x.slice(0, nW).map(Math.exp); c.X = Math.abs(c.x[nW]); c.solid = solid(c.W, c.R); delete c.f; }
    cands.sort((a, b)=> a.chi - b.chi);
    side.nmIters = nm;
  }
  Object.assign(side, { msScreen: Date.now() - ts, nCand: cands.length, chiIsoW: iso && iso.chi, chiBestW: cands.length ? cands[0].chi : null });

  /* 4: picks */
  const picks = [];
  const distinct = c => !picks.some(p=> sameSolid(c.solid, p.solid, { deg: 10, ratio: Math.exp(0.3) - 1 }));
  // the family of a candidate's most distinct axis (its normal or needle axis)
  const famOf = c => {
    const w = B.axes(c.W).map(Math.log), gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(w[i] - w[j])));
    const i = B.rot === 2 ? 2 : [0, 1, 2].sort((a, b)=> gap(b) - gap(a))[0];
    const d = E.lattDirection(q, colsOf(c.R)[i]);
    return d.angle <= 10 ? d.label : 'off';
  };
  const maxPicks = opt.budget ? Math.max(opt.picks, 12) : opt.picks;
  if (opt.family){
    const seen = new Set();
    for (const c of cands){ const f = famOf(c); if (seen.has(f) || !distinct(c)) continue; seen.add(f); picks.push(c); }
    picks.sort((a, b)=> a.chi - b.chi);
    if (opt.picks && picks.length > opt.picks) picks.length = opt.picks;
  } else for (const c of cands){ if (picks.length >= maxPicks) break; if (distinct(c)) picks.push(c); }
  // adapt: the first opt.adapt picks are refined briefly; the rest (more picks, then the
  // best of each normal family unlike any pick) only when the best brief misfits
  let extra = [];
  if (opt.adapt && picks.length > opt.adapt){ extra = picks.splice(opt.adapt); }
  if (opt.adapt && opt.adaptFam){
    const seen = new Set([...picks, ...extra].map(famOf));
    for (const c of cands){ const f = famOf(c); if (seen.has(f)) continue; seen.add(f); if (![...picks, ...extra].some(p=> sameSolid(c.solid, p.solid, { deg: 10, ratio: Math.exp(0.3) - 1 }))) extra.push(c); }
    if (opt.adaptMax) extra = extra.slice(0, opt.adaptMax);
  }
  side.picks = picks.map(p=> ({ chi: p.chi, tpl: p.tpl, src: p.src, fam: famOf(p), dims: p.solid.dims, axes: p.solid.axes, X: p.X }));
  side.extra = extra.length;
  if (opt.screenOnly){
    // the pilot: the screen alone, its best per family too (no pattern evaluated beyond the widths' reading)
    const fb = new Map(); for (const c of cands){ const f = famOf(c); if (!fb.has(f)) fb.set(f, c); }
    side.byFam = [...fb.entries()].map(([f, c])=> ({ fam: f, chi: c.chi, tpl: c.tpl, dims: c.solid.dims, axes: c.solid.axes }));
    side.msPre = Date.now() - t0; writeSide(opt, side); E.setParams(model, vIso); return null;
  }

  /* the starts: the picks from their screened widths; the sphere-like start beside them */
  const axesLow = E.lowIndexAxes(q);
  const frameAlong = e => {
    const z = tilt(e), x0 = axesLow.find(a=> Math.abs(a[0]*e[0] + a[1]*e[1] + a[2]*e[2]) < 0.1) || cross(e, Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
    const xd = x0.map((t, i)=> t - dot(x0, z)*z[i]), x = tilt(unit(xd)), xo = unit(x.map((t, i)=> t - dot(x, z)*z[i])), y = cross(z, xo);
    return [xo[0], y[0], z[0],  xo[1], y[1], z[1],  xo[2], y[2], z[2]];
  };
  const starts = picks.map(p=> ({ put: put(p.W, p.R, opt.startX === 'screen' ? p.X : null), from: 'pick' }));
  // no rows to screen on (too few read): the app's sphere-like start and its plates/needles
  if (!picks.length){
    starts.push({ put: put(Wof(w0, w0, w0), frameAlong(axesLow[0] || [0, 0, 1])), from: 'sphere' });
    for (const e of axesLow){ starts.push({ put: put(Wof(0.5*w0, 0.7*w0, 2.5*w0), frameAlong(e)), from: 'plate' }); starts.push({ put: put(Wof(1.2*w0, 1.6*w0, 0.4*w0), frameAlong(e)), from: 'needle' }); }
    side.fallback = true;
  } else if (opt.sphere) starts.splice(opt.sphereFirst ? 0 : starts.length, 0, { put: put(Wof(w0, w0, w0), frameAlong(axesLow[0] || [0, 0, 1])), from: 'sphere' });
  side.msPre = Date.now() - t0;

  const rebase = v => { const vv = v.slice(), R = E.bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); E.quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
  const turned = v => { const vv = rebase(v), R = mul(E.bodyFrame(q, v), rotation(unit([gauss(), gauss(), gauss()]), 0.02)); E.quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
  const snaps = makeSnaps(q, B, E);

  const shapeNames = [...q.iW, ...q.iR].map(i=> model.par[i].name);
  const names = free.filter(nm=> nm !== pf + 'Ys').concat(shapeNames);
  const briefNames = opt.lean ? free.filter(nm=> nm !== pf + 'Ys' && (model.par[model.index[nm]].linear || nm === pf + 'Xs')).concat(shapeNames) : names;

  /* 5: briefs (budget stop: after opt.budget briefs in a row without a better basin) */
  const brief = [];
  const dP = names.length - free.length, dPmin = dP - q.iR.length, need = (10 + dPmin*Math.log(N))/2;
  const gainOf = c => (chiTot(res) - c)/nu;
  let since = 0, bestC = Infinity, stop = null;
  for (let s = 0; s < starts.length; s++){
    const vv = vIso.slice(); vv[q.iYs] = 0;
    starts[s].put(vv);
    E.setParams(model, vv);
    try { const r = E.refine(model, { free: briefNames, ...lmBrief, audit: false }); brief.push({ v: model.v.slice(), chi: chiTot(r), nu: r.stats.chi2, dof: Math.max(1, r.stats.N - r.stats.P), from: starts[s].from }); } catch(e){}
    if (opt.adapt && s === Math.min(opt.adapt, starts.length) - 1 && extra.length && brief.length){
      // the model's misfit: the best brief's χ²_ν beyond 1 + k·√(2/ν)
      const b = brief.reduce((x, y)=> y.chi < x.chi ? y : x), lim = 1 + (opt.adaptSigma ?? 3)*Math.sqrt(2/b.dof);
      side.briefNu = b.nu; side.adaptLim = lim;
      if (b.nu > lim){ for (const p of extra) starts.push({ put: put(p.W, p.R, opt.startX === 'screen' ? p.X : null), from: 'extra' }); side.widened = true; }
    }
    const c = brief.length ? Math.min(...brief.map(b=> b.chi)) : Infinity;
    // first-brief rejection: the widths read isotropic and the first brief gains too little
    if (opt.reject === 'first' && s === 0 && rd.isoP >= (opt.rejectP ?? 1e-3) && !(gainOf(c) > need)){ stop = 'reject-first'; break; }
    if (c < bestC - nu){ bestC = c; since = 0; } else since++;
    if (opt.budget && s + 1 >= opt.picks && since >= opt.budget){ stop = 'budget'; break; }
    if (!opt.budget && s + 1 >= starts.length) break;
  }
  side.briefs = brief.map(b=> ({ chi: b.chi, from: b.from })); side.stop = stop;
  brief.sort((a, b)=> a.chi - b.chi);
  if (!brief.length){ E.setParams(model, vIso); writeSide(opt, side); return null; }
  const gain = gainOf(brief[0].chi);
  if (!(gain > need)){ E.setParams(model, vIso); side.out = 'rejected early'; writeSide(opt, side); return { rejected: true, dBIC: dPmin*Math.log(N) - gain, early: true }; }

  /* full, polish */
  let best = null;
  const finals = [];
  const full = v => {
    E.setParams(model, rebase(v));
    let r; try { r = E.refine(model, { free: names, ...lmFull }); } catch(e){ return null; }
    if (!best || chiTot(r) < chiTot(best.res)) best = { res: r, v: model.v.slice() };
    return chiTot(r);
  };
  let toFull = brief;
  if (opt.dedupe){
    const sol = b => solid(q.iW.map(i=> b.v[i]), E.bodyFrame(q, b.v));
    const reps = [];
    for (const b of brief){ const s = sol(b); if (!reps.some(r=> sameSolid(s, r.s))) reps.push({ b, s }); }
    toFull = reps.map(r=> r.b);
    side.distinctBriefs = reps.length;
  }
  for (const b of toFull.slice(0, nFull)){ const c = full(b.v); if (c != null) finals.push(c); }
  if (best && opt.polish){
    for (let p = 0; p < 2; p++){
      const before = chiTot(best.res);
      full(turned(best.v));
      if (before - chiTot(best.res) < 0.5*nu) break;
    }
  }
  if (!best){ E.setParams(model, vIso); writeSide(opt, side); return null; }
  const bic = r => (chiTot(r) - chiTot(res))/nu + (r.stats.P - res.stats.P)*Math.log(N);
  let held = false, dBICfree = NaN, dBICheld = NaN, freeOff = null, freeW = null;
  model.shapeSoft = null;
  const refineFrom = (v, nm) => { E.setParams(model, rebase(v)); try { const r = E.refine(model, { free: nm, ...lmFull }); return { res: r, v: model.v.slice() }; } catch(e){ return null; } };
  // heldFirst: the held frames first; the exact free fit then from the best held frame
  // turned (as the refit below), and from the soft fit as well only when that lies more
  // than heldFirstDeg from the frame (an off-lattice minimum)
  const soft = best;
  if (B.base !== 'ball' && !opt.heldFirst){ const ex = refineFrom(best.v, names); if (ex) best = ex; }
  dBICfree = bic(best.res);
  let sn = null, cand = snaps(best.v);
  if (opt.heldScreen && cand.length > opt.heldScreen){
    // ranked by one evaluation each, at the frame with the free fit's other parameters
    const sc = cand.map(vs=> { const vv = rebase(vs); const st = E.evaluate(model, vv); return { vs, c: st.chi2 }; }).sort((a, b)=> a.c - b.c);
    cand = sc.slice(0, opt.heldScreen).map(s=> s.vs);
  }
  if (opt.heldDedupe){
    // the same frame reached twice (in a plate's plane two perpendicular lattice directions
    // give one frame, x and y swapped): refined once
    const kept = [];
    for (const vs of cand){ const R = E.bodyFrame(q, vs); if (!kept.some(K=> [0, 1, 2].every(i=> Math.abs(Math.abs(K.R[i]*R[i] + K.R[3 + i]*R[3 + i] + K.R[6 + i]*R[6 + i]) - 1) < 1e-9))) kept.push({ vs, R }); }
    side.heldDup = cand.length - kept.length; cand = kept.map(k=> k.vs);
  }
  const heldNames = names.filter(nm=> !q.iR.some(i=> model.par[i].name === nm));
  for (const vs of cand){
    const r = refineFrom(vs, heldNames);
    if (r && (!sn || chiTot(r.res) < chiTot(sn.res))) sn = r;
  }
  if (opt.heldFirst && B.base !== 'ball'){
    const frameOff = v => { const Rf = E.bodyFrame(q, v), Rh = E.bodyFrame(q, sn.v); return Math.max(...[0, 1, 2].map(i=> Math.acos(Math.min(1, Math.abs(Rf[i]*Rh[i] + Rf[3 + i]*Rh[3 + i] + Rf[6 + i]*Rh[6 + i])))*E.R2D)); };
    let ex = null;
    if (sn) ex = refineFrom(turned(sn.v), names);
    if (!sn || !ex || frameOff(soft.v) > (opt.heldFirstDeg ?? 2)){ const e2 = refineFrom(soft.v, names); if (e2 && (!ex || chiTot(e2.res) < chiTot(ex.res))) ex = e2; side.heldFirstBoth = true; }
    if (ex) best = ex;
    dBICfree = bic(best.res);
  }
  if (sn){
    if ((!opt.heldFirst || B.base === 'ball') && chiTot(sn.res) < chiTot(best.res)){
      const fr = refineFrom(turned(sn.v), names);
      if (fr && chiTot(fr.res) < chiTot(best.res)){ best = fr; dBICfree = bic(best.res); }
    }
    dBICheld = bic(sn.res);
    const g = (chiTot(sn.res) - chiTot(best.res))/Math.max(1, best.res.stats.chi2);
    if (dBICheld < dBICfree && g <= (q.iR.length === 2 ? 5.99 : 7.81)){
      const Rf = E.bodyFrame(q, best.v), Rh = E.bodyFrame(q, sn.v);
      freeOff = [0, 1, 2].map(i=> Math.acos(Math.min(1, Math.abs(Rf[i]*Rh[i] + Rf[3 + i]*Rh[3 + i] + Rf[6 + i]*Rh[6 + i])))*E.R2D);
      freeW = q.iW.map(i=> best.v[i]);
      best = sn; held = true;
    }
  }
  const cb = chiTot(best.res), dBIC = bic(best.res);
  side.out = dBIC < -10 ? (held ? 'held' : 'free') : 'rejected';
  writeSide(opt, side);
  if (!(dBIC < -10)){ E.setParams(model, vIso); return { rejected: true, dBIC }; }
  E.setParams(model, best.v);
  return { res: best.res, info: { type, starts: starts.length, full: finals.length, chi2Iso: chiTot(res), chi2: cb, Piso: res.stats.P, P: best.res.stats.P, N, chi2redIso: res.stats.chi2, held, dBICfree, dBICheld, freeOff, freeW } };
}

function writeSide(opt, side){
  const f = process.env.WS_SIDE;
  if (!f) return;
  try { fs.appendFileSync(f, JSON.stringify(side, (k, v)=> v === Infinity ? 1e9 : v) + '\n'); } catch(e){}
}

/* freeShapeRun's held frames, as there (the body's best-placed axis on its lattice
   direction, a body with three axes its next one on the simplest directions across). */
function makeSnaps(q, B, E){
  const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  return v => {
    const R = E.bodyFrame(q, v), col = i => [R[i], R[3 + i], R[6 + i]];
    const Wx = B.axes(q.iW.map(i=> v[i])), gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(Wx[i] - Wx[j])));
    const cand = (B.rot === 2 ? [2] : [0, 1, 2]).map(i=> ({ i, ...E.lattDirection(q, col(i)) })).filter(c=> c.angle <= E.SNAP_DEG).sort((a, b)=> gap(b.i) - gap(a.i));
    if (!cand.length) return [];
    const p = cand[0].i, cp = cand[0].vec.map(t=> t*Math.sign(dot3(cand[0].vec, col(p)) || 1));
    const frameOf = (s, ds) => {
      let cs = unit(ds.map((t, j)=> t - dot3(ds, cp)*cp[j]));
      if (dot3(cs, col(s)) < 0) cs = cs.map(t=> -t);
      const t = 3 - p - s, cyc = (s - p + 3) % 3 === 1, ct = cyc ? cross(cp, cs) : cross(cs, cp);
      const C = []; C[p] = cp; C[s] = cs; C[t] = ct;
      const vv = v.slice();
      q.iR.forEach(i=> { vv[i] = 0; });
      E.quatOfMat([C[0][0], C[1][0], C[2][0], C[0][1], C[1][1], C[2][1], C[0][2], C[1][2], C[2][2]]).forEach((x, i)=> { vv[q.iQ[i]] = x; });
      return vv;
    };
    if (B.rot === 2) return [frameOf(p === 2 ? 0 : 2, col(p === 2 ? 0 : 2))];
    const others = [0, 1, 2].filter(i=> i !== p), all = E.latticeAcross(q, cp, null, 0.01, 64), pick = all.slice(0, 3);
    for (const s of others){
      const c = all.find(c=> Math.abs(dot3(c.vec, col(s))) >= Math.cos(E.SNAP_DEG*E.D2R));
      if (c && !pick.includes(c)) pick.push(c);
    }
    return pick.map(({ vec })=>{
      const s = Math.abs(dot3(vec, col(others[0]))) >= Math.abs(dot3(vec, col(others[1]))) ? others[0] : others[1];
      return frameOf(s, vec);
    });
  };
}
