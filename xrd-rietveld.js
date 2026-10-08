/* =========================================================
   XRD RIETVELD — the pattern model and its refinement.
   A Bragg–Brentano powder pattern computed from the phases' structures and refined
   by Levenberg–Marquardt. Pure functions on plain objects: no DOM, importable by the
   page, a module Worker and Node.
   The model, for every point 2θ_i:
     y_c = bg(2θ_i) + Σ_phases S Σ_hkl Σ_{α1,α2} w_j·m·LP·F²·exp(−2ΔB s²)·Φ(2θ_i − 2θ_kj)
   with Φ the Thompson–Cox–Hastings pseudo-Voigt made asymmetric by the axial divergence
   (Finger–Cox–Jephcoat, one parameter (S + H)/L: fcjNodes), the instrument's U, V, W,
   X, Y and asymmetry shared by the phases and each phase's own Lorentzian Xs, Ys on
   top, the background a Chebyshev
   series plus a 1/2θ term, and the weights 1/σ², σ² = max(y,1)·varMul. Weighting by the
   observed counts (as GSAS and FullProf do) pulls the fitted background about one count
   per point below the truth (a point that fluctuates low gets more weight); harmless at
   these count levels, and the scales are unbiased.
   Parameters are named ('zero', 'disp', 'U', 'asym', 'bg0', 'bgInv', 'p1.scale', 'p1.a',
   'p1.B', 'p1.Ys', …: 'p' + the phase's id) and kept in one vector with a registry
   beside it, so a result travels as a plain {name: value} object, and calc() redraws
   it on a model built again from the same inputs.
========================================================= */
import { metric, reflections, latticeNames, latticeParams, cellFrom, cellMass } from './xrd-cryst.js';
import { lineForWavelength, f0, fprime } from './xrd-data.js';

const D2R = Math.PI/180, R2D = 180/Math.PI;
const LN2 = Math.LN2;
const CU = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5 };
const GRAPHITE_D = 3.3539;     // Å, graphite (002): the usual monochromator crystal
/* H_G² never reaches 0, whatever U, V, W do. On this floor the U, V, W derivatives vanish
   (or, from a step off it, follow the step), so refine() keeps the quadratic ≥ 0 over the
   pattern when V is refined, and reports U, V, W as on a bound when the floor is reached. */
const HG2_FLOOR = 1e-8;        // deg²
const K_SCHERRER = 0.9;        // as the Analysis card's Scherrer sizes
/* The profile is evaluated within ±max(WIN_FWHM·H, WIN_MIN) of each peak. A Lorentzian
   still holds 2/π·atan(1/(2·40)) ≈ 0.8 % of its area beyond 40 FWHM, and cutting it there
   would leave a step at both ends of the window. So the Lorentzian part is lowered by its
   own value at the window's edge, which takes it continuously to zero there. It is not
   renormalised: I stays the area of the whole, untruncated peak, as a measured peak has
   it, and what the window leaves out (1.6·η % at 40 FWHM, the far tails and the pedestal
   under the window, slow and almost flat) goes to the background, which follows it as it
   follows the data's own tails. Renormalising inside the window instead made the fitted
   intensities 1.6·η % low, by an η that differs between phases. The Gaussian part is zero
   long before the edge. */
const WIN_FWHM = 40;
const WIN_MIN = 1.5;           // deg
const COARSE_WIN = 10;         // FWHM: the cell search's coarse pass (cellSearch)
const MIN_POINTS = 10;         // fewer weighted points than this: no refinement is possible
// Lattice lengths may move within ±LAT_RANGE of the file's: the reflection list is made
// down to 0.9 of the last d in the pattern, so it holds every reflection a cell up to
// 1/0.9 = 1.11× as large brings into the range.
const LAT_RANGE = 0.1;
// (S + H)/L to start the asymmetry's refinement from: a Bragg–Brentano goniometer with
// Soller slits of a few hundredths of a radian.
const ASYM_START = 0.02;
// Rwp values this close (relative) are a tie on a scan: a flat curve, no minimum there.
const TIE = 1e-9;

/* ---------- small numerics ---------- */
// Chebyshev polynomials T_0..T_N at u ∈ [−1, 1] by the recurrence (stable on the interval).
function chebyshev(u, N, out){
  out[0] = 1; if (N >= 1) out[1] = u;
  for (let k = 2; k <= N; k++) out[k] = 2*u*out[k-1] - out[k-2];
  return out;
}
// First index with x[i] ≥ v (x ascending).
function lowerBound(x, v){
  let lo = 0, hi = x.length;
  while (lo < hi){ const mid = (lo + hi) >> 1; if (x[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}
/* Cholesky factor of a symmetric positive (semi)definite m×m matrix. The matrices here
   are correlation-scaled (unit diagonal), so the pivot tolerance is relative by
   construction: a pivot below `tol` means that parameter is (numerically) a combination
   of the others — its row is dropped (its step is 0, its variance NaN) and listed in `bad`. */
function cholesky(A, m, tol = 1e-10){
  const L = new Float64Array(m*m), bad = [];
  for (let j = 0; j < m; j++){
    let d = A[j*m + j];
    for (let k = 0; k < j; k++) d -= L[j*m + k]*L[j*m + k];
    if (!(d > tol*Math.max(1, A[j*m + j]))){ bad.push(j); continue; }   // row j stays 0
    const ljj = Math.sqrt(d);
    L[j*m + j] = ljj;
    for (let i = j + 1; i < m; i++){
      let s = A[i*m + j];
      for (let k = 0; k < j; k++) s -= L[i*m + k]*L[j*m + k];
      L[i*m + j] = s/ljj;
    }
  }
  return { L, bad };
}
function cholSolve({ L }, b, m){
  const y = new Float64Array(m), x = new Float64Array(m);
  for (let i = 0; i < m; i++){
    const lii = L[i*m + i]; if (!lii) continue;
    let s = b[i]; for (let k = 0; k < i; k++) s -= L[i*m + k]*y[k];
    y[i] = s/lii;
  }
  for (let i = m - 1; i >= 0; i--){
    const lii = L[i*m + i]; if (!lii) continue;
    let s = y[i]; for (let k = i + 1; k < m; k++) s -= L[k*m + i]*x[k];
    x[i] = s/lii;
  }
  return x;
}
// The inverse (as the covariance of a scaled normal matrix); dropped rows give NaN.
function cholInverse(ch, m){
  const inv = new Float64Array(m*m), e = new Float64Array(m);
  for (let j = 0; j < m; j++){
    e.fill(0); e[j] = 1;
    const col = cholSolve(ch, e, m);
    for (let i = 0; i < m; i++) inv[i*m + j] = col[i];
  }
  for (const j of ch.bad) for (let i = 0; i < m; i++){ inv[i*m + j] = NaN; inv[j*m + i] = NaN; }
  return inv;
}

/* ---------- profile ---------- */
// Thompson–Cox–Hastings: the pseudo-Voigt FWHM H and mixing η that best match the Voigt
// of Gaussian FWHM HG and Lorentzian FWHM HL (J. Appl. Cryst. 20 (1987) 79).
function tch(HG, HL){
  const g2 = HG*HG, g3 = g2*HG, g4 = g3*HG, l2 = HL*HL, l3 = l2*HL, l4 = l3*HL;
  const H = Math.pow(g4*HG + 2.69269*g4*HL + 2.42843*g3*l2 + 4.47163*g2*l3 + 0.07842*HG*l4 + l4*HL, 0.2);
  const q = HL/H;
  // η of the cubic reaches 1.00000 at q = 1; the clamp only absorbs rounding.
  return { H, eta: Math.min(1, Math.max(0, 1.36603*q - 0.47719*q*q + 0.11116*q*q*q)), HG, HL };
}
// The profile at a Bragg angle θ (radians) for the values U..Y (X and Y with the phase's
// own Xs, Ys added: Lorentzian widths add under convolution).
function profileAtTheta(th, U, V, W, X, Y){
  const t = Math.tan(th), c = Math.cos(th);
  const HG = Math.sqrt(Math.max(HG2_FLOOR, U*t*t + V*t + W));
  const HL = Math.max(0, X*t + Y/c);
  return tch(HG, HL);
}
// Area-normalised pseudo-Voigt of FWHM H and mixing eta, centred at c, times I, added to
// out over the window (see WIN_FWHM for the Lorentzian's treatment at the edges); `win`
// the window in FWHM (the cell search's coarse pass narrows it).
function addPeak(out, x, c, H, eta, I, win = WIN_FWHM){
  const half = Math.max(win*H, WIN_MIN);
  const i0 = lowerBound(x, c - half), n = x.length;
  const gk = 4*LN2/(H*H), gh = 2*Math.sqrt(LN2/Math.PI)/H;
  const lk = 2/(Math.PI*H), l4 = 4/(H*H);
  const lEdge = lk/(1 + l4*half*half);
  const cl = I*eta, cg = I*(1 - eta)*gh;
  const xe = c + half;
  for (let i = i0; i < n; i++){
    const xi = x[i]; if (xi > xe) break;
    const d = xi - c, d2 = d*d;
    let v = cl*(lk/(1 + l4*d2) - lEdge);
    const ga = gk*d2;
    if (ga < 40) v += cg*Math.exp(-ga);
    out[i] += v;
  }
}

/* addPeak for a peak spread by the axial divergence over the shifts of `nodes`: the sum
   Σ w_k·Φ(x − c − d_k) where it differs from one peak at the mean shift d̄, and that one
   peak beyond. A node per point over the whole window cost the full ±max(40 H, 1.5°)
   per node (a large sharp cell refined 4.5× slower); out there the shifted Lorentzians
   differ from the mean one by ½·var(d)·L″, under 2 % of a wing that is itself under
   0.2 % of the peak, so beyond R = 1.5·spread + 6 H (the Gaussian long gone; the
   profile then within 0.005 % of the peak of the full node sum) the one peak stands
   for them, blended in over 2 H so the profile stays continuous in the parameters. One
   window, about c + d̄ and widened by the spread, for both. */
function addPeakFCJ(out, x, c, H, eta, I, nodes, win = WIN_FWHM){
  // The nodes as sorted arrays: the Gaussian part of a point needs only the nodes within
  // its reach (|Δ| < √(40/gk) ≈ 3.8 H, as addPeak's cut), found by two moving pointers.
  const m = nodes.length, ord = nodes.slice().sort((p, q)=> p.d - q.d);
  const dk = new Float64Array(m), wk = new Float64Array(m);
  let db = 0, sp = 0;
  for (let k = 0; k < m; k++){ dk[k] = ord[k].d; wk[k] = ord[k].w; db += wk[k]*dk[k]; }
  for (let k = 0; k < m; k++){ const a = Math.abs(dk[k] - db); if (a > sp) sp = a; }
  const cm = c + db, half = Math.max(win*H, WIN_MIN) + sp, R = 1.5*sp + 6*H, tau = 2*H;
  const i0 = lowerBound(x, cm - half), n = x.length, xe = cm + half;
  const gk = 4*LN2/(H*H), gh = 2*Math.sqrt(LN2/Math.PI)/H, gReach = Math.sqrt(40/gk);
  const lk = 2/(Math.PI*H), l4 = 4/(H*H);
  const lEdge = lk/(1 + l4*half*half);
  const cl = I*eta, cg = I*(1 - eta)*gh;
  let lo = 0, hi = 0;
  for (let i = i0; i < n; i++){
    const xi = x[i]; if (xi > xe) break;
    const r = Math.abs(xi - cm);
    let wing = 0;
    if (r > R){
      const d = xi - cm, d2 = d*d, ga = gk*d2;
      wing = cl*(lk/(1 + l4*d2) - lEdge);
      if (ga < 40) wing += cg*Math.exp(-ga);
      if (r >= R + tau){ out[i] += wing; continue; }
    }
    // The core: every node's Lorentzian, the Gaussians of the nodes in reach.
    const u = xi - c;
    let sl = 0, sg = 0;
    for (let k = 0; k < m; k++){ const d = u - dk[k]; sl += wk[k]/(1 + l4*d*d); }
    while (lo < m && dk[lo] < u - gReach) lo++;
    if (hi < lo) hi = lo;
    while (hi < m && dk[hi] <= u + gReach) hi++;
    for (let k = lo; k < hi; k++){ const d = u - dk[k]; sg += wk[k]*Math.exp(-gk*d*d); }
    const core = cl*(lk*sl - lEdge) + cg*sg;
    if (r <= R){ out[i] += core; continue; }
    const T = (R + tau - r)/tau;
    out[i] += T*core + (1 - T)*wing;
  }
}

/* Axial divergence: Finger, Cox & Jephcoat, J. Appl. Cryst. 27 (1994) 892, with the
   sample's and the receiving slit's half-heights equal (S = H), so one parameter
   A = (S + H)/L, L the goniometer radius, as GSAS-II's SH/L. A ray that leaves the
   diffraction plane by h·L over L meets the Debye cone of a reflection at 2θ where
   cos 2φ = cos 2θ·√(1 + h²): below 2θ = 90° the peak gains a tail towards low angles,
   above it towards high angles, none at 90°. h runs over [0, A]; FCJ's weight
   W(2φ) = (A − h)/(h·|cos 2φ|) — the overlap of sample and slit heights over the cone's
   spread — is, per unit h, (A − h)/((1 + h²)·sin 2φ): finite at h = 0, where in 2φ it
   has an integrable singularity at the peak, so Gauss–Legendre in h converges fast. The
   shift goes as h², up to ≈ −A²/2·cot 2θ (the centroid −A²/12·cot 2θ, radians).
   → nodes [{ d (deg, 2φ − 2θ), w }] with Σw = 1, enough of them that neighbouring shifts
   lie well within the peak's width H; one node at the mean shift when the whole tail is
   a small part of H (a broad peak, or near 90°). */
const GL_CACHE = new Map();
function gaussLegendre(n){
  let g = GL_CACHE.get(n);
  if (g) return g;
  const t = new Float64Array(n), w = new Float64Array(n);
  for (let i = 0; i < n; i++){
    let z = Math.cos(Math.PI*(i + 0.75)/(n + 0.5)), dp = 1;
    for (let it = 0; it < 100; it++){
      let p0 = 1, p1 = 0;
      for (let j = 1; j <= n; j++){ const p2 = p1; p1 = p0; p0 = ((2*j - 1)*z*p1 - (j - 1)*p2)/j; }
      dp = n*(z*p0 - p1)/(z*z - 1);
      const dz = p0/dp; z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    t[i] = z; w[i] = 2/((1 - z*z)*dp*dp);
  }
  g = { t, w }; GL_CACHE.set(n, g);
  return g;
}
/* Nodes: enough that neighbouring shifts lie within about H/4 of each other (the profile
   then within 0.04 % of the exact one); 300 at most, which only a very sharp peak below
   about 12° (or above 168°) needs. Below 2θ = atan A the cone's tail ends at
   hMax = |tan 2θ| < A, where the weight has a 1/√(hMax − h) singularity: there
   h = hMax·(1 − u²) takes it out. `nForce` holds the count (and the one-node collapse,
   n = 1) fixed: the Jacobian's two displaced points must not differ by a change of
   quadrature (a node more at one of them moved a derivative by 10 %). The count used is
   left on the array as .n. */
const FCJ_MAX_NODES = 300;
function fcjNodes(th, A, H, nForce){
  const tt = 2*th, c2 = Math.cos(tt);
  if (!(A > 0) || Math.abs(c2) < 1e-12) return null;
  const hTan = Math.abs(Math.tan(tt)), cut = hTan < A;
  const hMax = cut ? hTan*(1 - 1e-12) : A;
  const phiOf = h => Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + h*h))));
  const dMax = (phiOf(hMax) - tt)*R2D;
  const collapse = nForce ? nForce === 1 : Math.abs(dMax) < 0.05*H;
  const n = collapse ? 4 : nForce || Math.min(FCJ_MAX_NODES, Math.max(4, Math.ceil(4*Math.abs(dMax)/Math.max(H, 1e-4)) + 2));
  const { t, w } = gaussLegendre(n), out = [];
  let sw = 0, sd = 0;
  for (let i = 0; i < n; i++){
    // h over [0, hMax]: linearly, or through u ∈ [0, 1] with dh = 2·hMax·u·du at the cut.
    const u = 0.5*(t[i] + 1), h = cut ? hMax*(1 - u*u) : hMax*u, jac = cut ? 2*hMax*u : hMax;
    const f = phiOf(h), sf = Math.sin(f);
    if (!(sf > 0)) continue;
    const wi = 0.5*w[i]*jac*(A - h)/((1 + h*h)*sf), d = (f - tt)*R2D;
    out.push({ d, w: wi }); sw += wi; sd += wi*d;
  }
  if (!(sw > 0)) return null;
  if (collapse){ const one = [{ d: sd/sw, w: 1 }]; one.n = 1; return one; }
  for (const o of out) o.w /= sw;
  out.n = n;
  return out;
}

/* The FCJ nodes of one line of one reflection. Under model.fcjFreeze (for the whole of a
   refine(), and for each Jacobian column outside one) the count is fixed at the line's
   first use, so that χ² is a smooth function of the parameters throughout the
   refinement: a count that changed with U..Y or the asymmetry moved χ² in steps and a
   derivative by up to 10×. refine() checks the counts at its end (model.fcjAudit) and
   runs again when the widths or the asymmetry have outgrown them. */
function lineNodes(model, key, th, A, H){
  // A search for where the peaks are needs only where each one's weight lies: its
  // centroid (cellSearch; the asymmetry costs it nothing then).
  if (model.fcjCentroid) return fcjNodes(th, A, H, 1);
  const fz = model.fcjFreeze;
  if (!fz){
    const nd = fcjNodes(th, A, H), au = model.fcjAudit;
    // refine()'s check after a refinement: has a line outgrown its held count?
    // (A count a quarter short still leaves the profile within about 0.1 % of the peak:
    // the cell moving a line by a node or two is no reason to start again.)
    if (au && nd){ const f = au.get(key); if (f === undefined || f === 0 || (f === 1 ? nd.n > 1 : nd.n > 1.25*f)) model.fcjBehind = true; }
    return nd;
  }
  let n = fz.get(key);
  if (n === undefined){
    const nd = fcjNodes(th, A, H);
    n = nd ? nd.n : 0;
    fz.set(key, n);
    return nd;
  }
  return fcjNodes(th, A, H, n || undefined);
}

/* ---------- the model ---------- */
// The ticks' hkl. For a cell refined through its conventional cell (constraint.basis = M,
// xrd-cryst classify) the conventional indices h·M, so they match the a, c reported:
// anatase's first line is (101), not the primitive cell's (100). The member of the Laue
// orbit read is chosen as reflections() chooses it: fewest negative indices, then the
// largest. null when the cell is its own conventional cell.
function tickLabels(list, ops, M){
  if (!M) return null;
  const laue = [];
  for (const { R } of (ops && ops.length ? ops : [{ R: [1,0,0, 0,1,0, 0,0,1] }])) laue.push(R, R.map(v=> -v));
  const conv = h => [0, 1, 2].map(j=> h[0]*M[j] + h[1]*M[3 + j] + h[2]*M[6 + j]);
  const neg = p => (p[0] < 0) + (p[1] < 0) + (p[2] < 0);
  const better = (p, q) => neg(p) !== neg(q) ? neg(p) < neg(q) : (p[0] !== q[0] ? p[0] > q[0] : p[1] !== q[1] ? p[1] > q[1] : p[2] > q[2]);
  const out = new Int32Array(3*list.length);
  list.forEach((r, i)=>{
    let best = null;
    for (const R of laue){
      const c = conv([r.h*R[0] + r.k*R[3] + r.l*R[6], r.h*R[1] + r.k*R[4] + r.l*R[7], r.h*R[2] + r.k*R[5] + r.l*R[8]]);
      if (!best || better(c, best)) best = c;
    }
    out.set(best, 3*i);
  });
  return out;
}
/* buildModel({ x, y, varMul, instr, phases, prof, bgDegree, bgInv })
   - x, y: the pattern (2θ in degrees, monotonic, every value a number: the windows are
     found by bisection; counts); varMul: per-point variance multiplier (attenuator
     factor, 1/counting time for rates), default 1. Points with a y that is not a number
     get no weight. Throws on a 2θ that is not a number and on fewer than MIN_POINTS
     weighted points, which no refinement can use.
   - instr: readXrdmlInstrument's object, or null (Cu Kα1/Kα2, ratio 0.5, R 240 mm, no
     monochromator).
   - phases: [{ id, name, cell, constraint, ops, atoms (the whole cell), mass? }].
   - prof: starting { zero, disp, U, V, W, X, Y, Xs, Ys } (Xs, Ys: every phase's start).
   - bgDegree: Chebyshev order (default 6); bgInv: use the 1/2θ term (default: when the
     pattern starts below 20°; never when it reaches 2θ ≤ 0, where 1/2θ is undefined).
   - every phase's id (its parameters' prefix, 'p' + id) must be its own.
   The profile is the instrument's U, V, W, X, Y, shared by the phases, with each phase's
   own Lorentzian broadening on top ('p1.Xs', 'p1.Ys'): one instrumental profile, and a
   size and a strain per phase (or per population, with a CIF loaded twice).
   The model owns copies; the phases' objects are not modified. */
function buildModel({ x, y, varMul = null, instr = null, phases = [], prof = {}, bgDegree = 6, bgInv } = {}){
  const n = x.length;
  // A scan recorded downwards is held ascending inside (the windows are found by bisection)
  // and handed back in its own order by calc().
  const rev = n > 1 && x[0] > x[n-1], at = i => rev ? n - 1 - i : i;
  const X = Float64Array.from({ length: n }, (_, i)=> +x[at(i)]), Yo = new Float64Array(n), w = new Float64Array(n);
  // A 2θ that is not a number would put NaN in the background's basis (0·NaN is NaN in
  // every sum, whatever its weight) and break the bisection.
  const bad = X.findIndex(v=> !Number.isFinite(v));
  if (bad >= 0) throw new Error(`The pattern has a 2θ value that is not a number (point ${at(bad) + 1}).`);
  let nw = 0;
  for (let i = 0; i < n; i++){
    const yi = y[at(i)] == null ? NaN : +y[at(i)], m = varMul ? +varMul[at(i)] : 1;
    if (Number.isFinite(yi) && m > 0){ Yo[i] = yi; w[i] = 1/(Math.max(yi, 1)*m); nw++; }
  }
  if (nw < MIN_POINTS) throw new Error(`The pattern has too few points (${nw}) for a refinement.`);
  const x0 = X[0], x1 = X[n-1];

  // Wavelengths: the file's, else Cu. A Kα1-only file (ratio 0) has one line.
  const ins = instr || {};
  const lam1 = ins.lam1 > 0 ? ins.lam1 : CU.lam1;
  const lam2 = ins.lam2 > 0 ? ins.lam2 : (instr ? lam1 : CU.lam2);
  // Number.isFinite throughout: a NaN that went through JSON (a saved session, a worker
  // message) comes back as null, which the global isFinite takes for 0.
  const ratio = Number.isFinite(ins.ratio) && ins.ratio >= 0 ? ins.ratio : (instr && ins.lam2 > 0 ? 0.5 : CU.ratio);
  const lines = [{ lam: lam1, w: 1 }];
  if (ratio > 0 && Math.abs(lam2 - lam1) > 1e-6) lines.push({ lam: lam2, w: ratio });
  const lineName = lineForWavelength(lam1);     // for f′, f″; null → none
  // Polarisation: with a monochromator at 2θ_M (graphite 002 at the tube's λ unless the
  // object gives the angle) the factor is (1 + cos²2θ_M·cos²2θ); without, (1 + cos²2θ).
  let cos2M = 1;
  if (ins.monochromator){
    const tm = Number.isFinite(ins.monoAngle) ? ins.monoAngle*D2R : 2*Math.asin(Math.min(1, lam1/(2*GRAPHITE_D)));
    cos2M = Math.cos(tm)**2;
  }
  const radius = ins.radius > 0 ? ins.radius : 240;

  // Background basis: Chebyshev in u ∈ [−1, 1] over the pattern, and 1/2θ (air scatter).
  const N = Math.max(0, Math.round(bgDegree));
  const basis = [];
  for (let k = 0; k <= N; k++) basis.push(new Float64Array(n));
  const inv = new Float64Array(n), T = new Float64Array(N + 1), span = (x1 - x0) || 1;
  for (let i = 0; i < n; i++){
    chebyshev(2*(X[i] - x0)/span - 1, N, T);
    for (let k = 0; k <= N; k++) basis[k][i] = T[k];
    inv[i] = X[i] > 0 ? 1/X[i] : 0;
  }
  basis.push(inv);

  // Parameter registry. step: the central-difference step (in the parameter's units);
  // linear: its Jacobian column is exact (scales, background).
  const par = [];
  const add = (name, value, lo, hi, step, extra) => par.push({ name, value, lo, hi, step, refine: false, linear: false, group: 'global', phase: -1, ...extra });
  const P = Object.assign({ zero: 0, disp: 0, U: 0, V: 0, W: 0.002, X: 0, Y: 0.03, asym: 0, Xs: 0, Ys: 0 }, prof);
  add('zero', P.zero, -2, 2, 1e-5);
  add('disp', P.disp, -3, 3, 1e-5);
  add('U', P.U, 0, 20, 1e-6, { group: 'profile' });
  add('V', P.V, -20, 20, 1e-6, { group: 'profile' });
  add('W', P.W, 0, 20, 1e-6, { group: 'profile' });
  add('X', P.X, 0, 10, 1e-6, { group: 'profile' });
  add('Y', P.Y, 0, 10, 1e-6, { group: 'profile' });
  // (S + H)/L of the axial divergence (fcjNodes). Its effect goes as its square, so at 0
  // its derivative vanishes: a refinement of it starts from a typical value (autoRefine).
  add('asym', P.asym, 0, 0.2, 1e-4, { group: 'profile' });
  // A starting level for the background: the low tail of the counts.
  const sorted = Array.from(Yo).filter((v, i)=> w[i] > 0).sort((a, b)=> a - b);
  const level = sorted.length ? sorted[Math.floor(0.1*sorted.length)] : 0;
  for (let k = 0; k <= N; k++) add('bg' + k, k ? 0 : level, -Infinity, Infinity, 1, { linear: true, group: 'bg', basis: k });
  add('bgInv', 0, -Infinity, Infinity, 1, { linear: true, group: 'bg', basis: N + 1 });

  // Phases: reflections listed once, down to a d well below the pattern's end (the cell
  // may shrink by several % in the search and the refinement), so the hkl list, and the
  // multiplicities with it, stay fixed while the cell moves.
  const lamMax = Math.max(...lines.map(l=> l.lam));
  const thLim = Math.min(89.9, (x1 + 2)/2)*D2R;
  const dmin = 0.9*lamMax/(2*Math.sin(thLim));     // see LAT_RANGE
  const pfxSeen = new Set();
  const ph = phases.map((p, k)=>{
    const id = p.id != null ? p.id : k, pfx = 'p' + id + '.';
    // Two phases under one prefix would share every parameter name: one of them could not
    // be reached by name, and getParams would give it the other's values.
    if (pfxSeen.has(pfx)) throw new Error(`Two phases share the id ${id}.`);
    pfxSeen.add(pfx);
    const cell = { ...p.cell }, names = latticeNames(p.constraint), lat0 = latticeParams(p.constraint, cell);
    const list = reflections(cell, p.ops, dmin);
    const atoms = p.atoms || [];
    const q = { id, name: p.name || '', pfx, cell, constraint: p.constraint, ops: p.ops, atoms,
      mass: Number.isFinite(p.mass) ? p.mass : cellMass(atoms), latNames: names,
      h: Int32Array.from(list, r=> r.h), k: Int32Array.from(list, r=> r.k), l: Int32Array.from(list, r=> r.l),
      lab: tickLabels(list, p.ops, p.constraint && p.constraint.basis),
      mult: Float64Array.from(list, r=> r.mult), nRefl: list.length, f2key: null, f2: null, iScale: -1, iB: -1, iXs: -1, iYs: -1, iLat: [] };
    q.iScale = par.length; add(pfx + 'scale', 1e-3, 0, Infinity, 1, { linear: true, group: 'phase', phase: k, kind: 'scale' });
    // Starting values from latticeParams: the conventional cell's when the constraint
    // refines a non-standard cell through it (xrd-cryst classify).
    names.forEach((nm, i)=>{
      const v0 = lat0[i], ang = nm === 'alpha' || nm === 'beta' || nm === 'gamma';
      q.iLat.push(par.length);
      add(pfx + nm, v0, ang ? Math.max(1, v0 - 15) : (1 - LAT_RANGE)*v0, ang ? Math.min(179, v0 + 15) : (1 + LAT_RANGE)*v0, ang ? 1e-5 : 1e-6*v0, { group: 'phase', phase: k, kind: 'lattice', lat: nm });
    });
    q.iB = par.length; add(pfx + 'B', 0, -2, 10, 1e-4, { group: 'phase', phase: k, kind: 'B' });
    q.iXs = par.length; add(pfx + 'Xs', P.Xs, 0, 10, 1e-6, { group: 'phase', phase: k, kind: 'size' });
    q.iYs = par.length; add(pfx + 'Ys', P.Ys, 0, 10, 1e-6, { group: 'phase', phase: k, kind: 'size' });
    return q;
  });

  const index = {};
  par.forEach((p, i)=> { index[p.name] = i; });
  return {
    x: X, y: Yo, w, n, x0, x1, rev, lines, lineName, cos2M, radius, bgDegree: N, basis,
    phases: ph, par, index, v: Float64Array.from(par, p=> p.value),
    iZero: index.zero, iDisp: index.disp, iProf: ['U','V','W','X','Y'].map(k=> index[k]), iAsym: index.asym,
    iBg: par.map((p, i)=> p.group === 'bg' ? i : -1).filter(i=> i >= 0),
    // The 1/2θ term is used where air scatter rises: patterns that start below 20° (and
    // above 0, where it is defined).
    useInv: x0 > 0 && (bgInv != null ? !!bgInv : x0 < 20),
    win: WIN_FWHM,
    esd: {}, cov: null,
  };
}

// The parameter vector from a {name: value} object (missing names keep the model's
// values; unknown ones, and values that are not numbers — a NaN sent through JSON comes
// back as null — are ignored), a full vector, or nothing (the model's own).
function vectorOf(model, params){
  if (!params) return model.v.slice();
  if (params instanceof Float64Array || Array.isArray(params)) return Float64Array.from(params);
  const v = model.v.slice();
  for (const k in params){
    if (!Object.prototype.hasOwnProperty.call(model.index, k)) continue;
    const val = typeof params[k] === 'string' && params[k].trim() ? +params[k] : params[k];
    if (typeof val === 'number' && Number.isFinite(val)) v[model.index[k]] = val;
  }
  return v;
}
function getParams(model, v = model.v){
  const o = {};
  model.par.forEach((p, i)=> { o[p.name] = v[i]; });
  return o;
}
// Every value into its bounds: a start outside them (a hand-typed or stale value) could
// leave a parameter where it has no effect at all — Ys = −0.2 makes H_L = 0 everywhere —
// and refine() would never bring it back.
function clampInto(model, v){
  model.par.forEach((p, i)=> { if (v[i] < p.lo) v[i] = p.lo; else if (v[i] > p.hi) v[i] = p.hi; });
  return v;
}
function setParams(model, params){
  model.v = clampInto(model, vectorOf(model, params));
  model.par.forEach((p, i)=> { p.value = model.v[i]; });
}
function cellOf(model, v, k){
  const q = model.phases[k];
  return cellFrom(q.constraint, q.iLat.map(i=> v[i]), q.cell);
}
// The profile of phase k (the instrument's plus the phase's own broadening).
function profileOf(model, v, k){
  const [U, V, W, X, Y] = model.iProf.map(i=> v[i]), q = model.phases[k];
  return { U, V, W, X: X + v[q.iXs], Y: Y + v[q.iYs] };
}

/* The parts of F that do not depend on the cell. The atoms' fractional positions do not
   move, so for each scattering type (species, occupancy, B: one amplitude) the geometric
   sum G_t(h) = Σ exp(2πi h·x) over its atoms is made once per listed reflection; then
   F(h) = Σ_t A_t(s)·G_t(h) and F(−h) = Σ_t A_t(s)·conj(G_t(h)), with A_t = occ·exp(−B s²)
   ·(f0 + f′ + i f″) — the same sums as xrd-cryst's F2, grouped by type. A new cell then
   costs the form factors at the new s alone: no trigonometry, which on a 48-atom
   monoclinic cell was most of the time of a cell-search step. */
function phaseGeometry(model, q){
  const types = [], byKey = new Map(), keys = [];
  const tIdx = q.atoms.map(a=>{
    const key = a.key || a.element || a.label, el = a.element || key, occ = a.occ ?? 1, B = a.Biso ?? 0;
    const id = key + '|' + el + '|' + occ + '|' + B;
    let t = types.findIndex(u=> u.id === id);
    if (t < 0){
      if (!byKey.has(key)){ byKey.set(key, keys.length); keys.push(key); }
      const fp = model.lineName ? fprime(el, model.lineName) : [0, 0];
      t = types.push({ id, key: byKey.get(key), occ, B, fpr: fp[0], fpi: fp[1] }) - 1;
    }
    return t;
  });
  const nt = types.length, gr = new Float64Array(q.nRefl*nt), gi = new Float64Array(q.nRefl*nt);
  for (let r = 0; r < q.nRefl; r++){
    const h = q.h[r], k = q.k[r], l = q.l[r];
    q.atoms.forEach((a, j)=>{
      const ph = 2*Math.PI*(h*a.x + k*a.y + l*a.z), o = r*nt + tIdx[j];
      gr[o] += Math.cos(ph); gi[o] += Math.sin(ph);
    });
  }
  q.geo = { types, keys, gr, gi };
}
// F² of every listed reflection for this cell (f0 and the Debye–Waller factor follow s,
// so they move with the cell); recomputed only when the cell changes.
function phaseF2(model, q, cell, Gs){
  const key = cell.a + ',' + cell.b + ',' + cell.c + ',' + cell.alpha + ',' + cell.beta + ',' + cell.gamma;
  if (q.f2key === key) return q.f2;
  if (q.atoms.length && !q.geo) phaseGeometry(model, q);
  const f2 = new Float64Array(q.nRefl), d = new Float64Array(q.nRefl);
  const geo = q.geo, nt = geo ? geo.types.length : 0, f0s = geo ? new Float64Array(geo.keys.length) : null;
  for (let r = 0; r < q.nRefl; r++){
    const h = q.h[r], k = q.k[r], l = q.l[r];
    const Q = h*h*Gs[0] + k*k*Gs[4] + l*l*Gs[8] + 2*(h*k*Gs[1] + h*l*Gs[2] + k*l*Gs[5]);
    d[r] = 1/Math.sqrt(Q);
    if (!geo){ f2[r] = 1; continue; }
    const s = 0.5/d[r], s2 = s*s;
    for (let u = 0; u < f0s.length; u++) f0s[u] = f0(geo.keys[u], s);
    let r1 = 0, i1 = 0, r2 = 0, i2 = 0;
    for (let t = 0; t < nt; t++){
      const T = geo.types[t], w = T.occ*Math.exp(-T.B*s2), ar = w*(f0s[T.key] + T.fpr), ai = w*T.fpi;
      const g = geo.gr[r*nt + t], gs = geo.gi[r*nt + t];
      r1 += ar*g - ai*gs; i1 += ar*gs + ai*g;           // F(h)
      r2 += ar*g + ai*gs; i2 += ai*g - ar*gs;           // F(−h): G conjugated
    }
    f2[r] = 0.5*(r1*r1 + i1*i1 + r2*r2 + i2*i2);
  }
  q.f2key = key; q.f2 = f2; q.d = d;
  return f2;
}

// LP for Bragg–Brentano, divided by (1 + cos²2θ_M), which is 2 without a monochromator
// (the value at 2θ = 90° is then √2); the constant goes into the scale anyway.
function lpFactor(model, th){
  const c2 = Math.cos(2*th), s = Math.sin(th);
  return (1 + model.cos2M*c2*c2)/((1 + model.cos2M)*s*s*Math.cos(th));
}

/* One phase's pattern at scale 1 into `out` (zeroed here). With `ticks`, the α1 line of
   every reflection in the range is listed there too. */
function phasePattern(model, v, k, out, ticks){
  out.fill(0);
  const q = model.phases[k];
  const cell = cellOf(model, v, k), { Gs } = metric(cell);
  const f2 = phaseF2(model, q, cell, Gs), d = q.d;
  const zero = v[model.iZero], disp = v[model.iDisp], dB = v[q.iB], A = v[model.iAsym];
  const { U, V, W, X, Y } = profileOf(model, v, k);
  const x = model.x, xa = model.x0, xb = model.x1, S = v[q.iScale];
  for (let r = 0; r < q.nRefl; r++){
    const s2 = 0.25/(d[r]*d[r]);
    const base = q.mult[r]*f2[r]*Math.exp(-2*dB*s2);
    for (let j = 0; j < model.lines.length; j++){
      const L = model.lines[j], st = L.lam/(2*d[r]);
      if (st >= 1) continue;
      const th = Math.asin(st);
      const tt = 2*th*R2D + zero + disp*Math.cos(th);
      const pr = profileAtTheta(th, U, V, W, X, Y);
      // The axial divergence spreads the peak over shifts of one sign, up to dMax
      // (fcjNodes): a line out of range by more than that is skipped before its nodes.
      const c2 = Math.cos(2*th);
      const dMax = A > 0 ? (Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + A*A)))) - 2*th)*R2D : 0;
      const half = Math.max(model.win*pr.H, WIN_MIN);
      if (tt + Math.max(0, dMax) + half < xa || tt + Math.min(0, dMax) - half > xb) continue;
      const nodes = A > 0 ? lineNodes(model, (k*65536 + r)*4 + j, th, A, pr.H) : null;
      const I = base*L.w*lpFactor(model, th);
      if (!nodes) addPeak(out, x, tt, pr.H, pr.eta, I, model.win);
      else if (nodes.length === 1) addPeak(out, x, tt + nodes[0].d, pr.H, pr.eta, I, model.win);
      else addPeakFCJ(out, x, tt, pr.H, pr.eta, I, nodes, model.win);
      if (ticks && j === 0 && tt >= xa && tt <= xb)
        ticks.push({ phase: q.id, h: q.lab ? q.lab[3*r] : q.h[r], k: q.lab ? q.lab[3*r + 1] : q.k[r], l: q.lab ? q.lab[3*r + 2] : q.l[r],
                     tt, d: d[r], mult: q.mult[r], F2: f2[r], I: S*I, H: pr.H, eta: pr.eta, j: 0 });
    }
  }
  return out;
}
function background(model, v, out){
  out.fill(0);
  for (const i of model.iBg){
    const c = v[i]; if (!c) continue;
    const b = model.basis[model.par[i].basis];
    for (let p = 0; p < model.n; p++) out[p] += c*b[p];
  }
  return out;
}

// The whole state at v: each phase at scale 1, the background, y_c and Σw(y − y_c)².
function evaluate(model, v, st){
  const n = model.n, np = model.phases.length;
  st = st || { pats: model.phases.map(()=> new Float64Array(n)), bg: new Float64Array(n), yc: new Float64Array(n) };
  for (let k = 0; k < np; k++) phasePattern(model, v, k, st.pats[k]);
  return assemble(model, v, st);
}
// y_c and χ² from the phases already computed in st (only the linear parameters changed).
function assemble(model, v, st){
  const n = model.n, np = model.phases.length;
  background(model, v, st.bg);
  const yc = st.yc; yc.set(st.bg);
  for (let k = 0; k < np; k++){ const S = v[model.phases[k].iScale], P = st.pats[k]; for (let i = 0; i < n; i++) yc[i] += S*P[i]; }
  let c = 0; const y = model.y, w = model.w;
  for (let i = 0; i < n; i++){ const r = y[i] - yc[i]; c += w[i]*r*r; }
  st.chi2 = isFinite(c) ? c : Infinity;
  return st;
}

// Agreement indices. P = the number of refined parameters.
function rStats(model, yc, bg, P = 0){
  const y = model.y, w = model.w;
  let sa = 0, sy = 0, swr = 0, swy = 0, swyb = 0, N = 0;
  for (let i = 0; i < model.n; i++){
    if (!(w[i] > 0)) continue;
    N++;
    const r = y[i] - yc[i];
    sa += Math.abs(r); sy += Math.abs(y[i]);
    swr += w[i]*r*r; swy += w[i]*y[i]*y[i];
    const yb = y[i] - bg[i]; swyb += w[i]*yb*yb;
  }
  const Rwp = Math.sqrt(swr/swy), Rexp = Math.sqrt(Math.max(1, N - P)/swy);
  // cRwp: Rwp with the background taken out of the denominator, which a high background
  // otherwise flatters.
  return { Rp: sa/sy, Rwp, Rexp, chi2: swr/Math.max(1, N - P), cRwp: Math.sqrt(swr/swyb), N, P };
}

/* calc(model, params?) → { yc, bg, perPhase (each phase scaled), ticks }, the curves in
   the order of the x given to buildModel. params: {name: value} (or a full vector); the
   model's own values otherwise. ticks: the Kα1 line of every reflection inside the
   pattern, { phase (its id), h, k, l, tt, d, mult, F2, I (integrated, scaled), H, eta, j: 0 }. */
function calc(model, params){
  const v = vectorOf(model, params), n = model.n;
  const ticks = [], perPhase = [];
  const bg = background(model, v, new Float64Array(n)), yc = Float64Array.from(bg);
  model.phases.forEach((q, k)=>{
    const P = phasePattern(model, v, k, new Float64Array(n), ticks), S = v[q.iScale];
    for (let i = 0; i < n; i++){ P[i] *= S; yc[i] += P[i]; }
    perPhase.push(P);
  });
  ticks.sort((a, b)=> a.tt - b.tt);
  if (model.rev){ yc.reverse(); bg.reverse(); perPhase.forEach(P=> P.reverse()); }
  return { yc, bg, perPhase, ticks };
}

/* ---------- least squares ---------- */
// solveLinear(model, v, st?, which?): weighted linear least squares for the linear
// parameters alone (the scales and the background terms; `which`, parameter indices,
// to choose), everything else held at v: the exact optimum in one solve, written into v
// (setParams to keep it). A scale that comes out negative is set to 0 and the rest
// solved again. Returns the evaluated state at the new v.
function solveLinear(model, v, st, which){
  st = st || evaluate(model, v);
  let idx = which ? which.slice() : [...model.phases.map(q=> q.iScale), ...model.iBg.filter(i=> model.useInv || model.par[i].name !== 'bgInv')];
  const n = model.n, y = model.y, w = model.w;
  const isBg = i => model.par[i].group === 'bg';
  const colOf = i => isBg(i) ? model.basis[model.par[i].basis] : st.pats[model.par[i].phase];
  // The background's own sums do not change from one call to the next: kept on the model.
  const cache = model._bgSums || (model._bgSums = new Map());
  const dot = (ca, cb) => { let t = 0; for (let i = 0; i < n; i++) t += w[i]*ca[i]*cb[i]; return t; };
  const bgDot = (i, j) => {
    const key = i < j ? i + ',' + j : j + ',' + i;
    let t = cache.get(key);
    if (t === undefined){ t = dot(colOf(i), colOf(j)); cache.set(key, t); }
    return t;
  };
  for (let pass = 0; pass < 4; pass++){
    const m = idx.length, cols = idx.map(colOf);
    const A = new Float64Array(m*m), g = new Float64Array(m);
    for (let a = 0; a < m; a++){
      const ca = cols[a];
      const gk = 'y,' + idx[a];
      let s = isBg(idx[a]) ? cache.get(gk) : undefined;
      if (s === undefined){ s = 0; for (let i = 0; i < n; i++) s += w[i]*ca[i]*y[i]; if (isBg(idx[a])) cache.set(gk, s); }
      g[a] = s;
      for (let b = a; b < m; b++) A[a*m + b] = A[b*m + a] = isBg(idx[a]) && isBg(idx[b]) ? bgDot(idx[a], idx[b]) : dot(ca, cols[b]);
    }
    const D = new Float64Array(m);
    for (let a = 0; a < m; a++) D[a] = A[a*m + a] > 0 ? Math.sqrt(A[a*m + a]) : 1;
    for (let a = 0; a < m; a++){ g[a] /= D[a]; for (let b = 0; b < m; b++) A[a*m + b] /= D[a]*D[b]; }
    const sol = cholSolve(cholesky(A, m, 1e-12), g, m);
    idx.forEach((i, a)=> { v[i] = sol[a]/D[a]; });
    const neg = idx.filter(i=> model.par[i].kind === 'scale' && v[i] < 0);
    if (!neg.length) break;
    neg.forEach(i=> { v[i] = 0; });
    idx = idx.filter(i=> !neg.includes(i));
  }
  return assemble(model, v, st);
}

/* The Jacobian columns of the free parameters at v (st the state there): exact for the
   linear ones (∂y/∂S = the phase at scale 1, ∂y/∂c = its basis function), central
   differences for the rest, recomputing only the phases a parameter touches (one-sided
   at a bound, so the model is never evaluated outside it). */
function jacobian(model, v, st, free, cols){
  const n = model.n, np = model.phases.length;
  const tmpA = new Float64Array(n), tmpB = new Float64Array(n);
  free.forEach((j, a)=>{
    const p = model.par[j], col = cols[a];
    if (p.linear){ col.set(p.group === 'bg' ? model.basis[p.basis] : st.pats[p.phase]); return; }
    col.fill(0);
    let h = p.step;
    if (Math.abs(v[j])*1e-7 > h) h = Math.abs(v[j])*1e-7;
    let up = v[j] + h, dn = v[j] - h;
    if (up > p.hi) up = v[j];
    if (dn < p.lo) dn = v[j];
    if (up === dn) return;
    const vu = v.slice(), vd = v.slice(); vu[j] = up; vd[j] = dn;
    const ks = p.group === 'phase' ? [p.phase] : [...Array(np).keys()];
    for (const k of ks){
      const S = v[model.phases[k].iScale]; if (!S) continue;
      // Both displaced points with the same FCJ node counts (lineNodes): refine()'s, or,
      // outside one, those of this column's first point.
      const own = !model.fcjFreeze;
      if (own) model.fcjFreeze = new Map();
      if (dn === v[j]){ phasePattern(model, v, k, tmpB); phasePattern(model, vu, k, tmpA); }
      else { phasePattern(model, vu, k, tmpA); phasePattern(model, vd, k, tmpB); }
      if (own) model.fcjFreeze = null;
      const f = S/(up - dn);
      for (let i = 0; i < n; i++) col[i] += f*(tmpA[i] - tmpB[i]);
    }
  });
  // The F² caches now hold the last displaced cell: the next evaluation at v recomputes.
  return cols;
}
function normalEq(model, cols, st){
  const m = cols.length, n = model.n, w = model.w, y = model.y, yc = st.yc;
  const A = new Float64Array(m*m), g = new Float64Array(m), wr = new Float64Array(n);
  for (let i = 0; i < n; i++) wr[i] = w[i]*(y[i] - yc[i]);
  for (let a = 0; a < m; a++){
    const ca = cols[a];
    let s = 0; for (let i = 0; i < n; i++) s += ca[i]*wr[i];
    g[a] = s;
    for (let b = a; b < m; b++){
      const cb = cols[b]; let t = 0;
      for (let i = 0; i < n; i++) t += w[i]*ca[i]*cb[i];
      A[a*m + b] = A[b*m + a] = t;
    }
  }
  return { A, g };
}
// Correlation scaling: Â = D⁻¹AD⁻¹ with D² = diag A, so every pivot is relative to its
// own column's size and parameters in Å, degrees and counts mix without trouble.
function scaled(A, g, m, act){
  const k = act.length, As = new Float64Array(k*k), gs = new Float64Array(k), D = new Float64Array(k);
  for (let a = 0; a < k; a++) D[a] = Math.sqrt(A[act[a]*m + act[a]]);
  for (let a = 0; a < k; a++){
    gs[a] = g[act[a]]/D[a];
    for (let b = 0; b < k; b++) As[a*k + b] = A[act[a]*m + act[b]]/(D[a]*D[b]);
  }
  return { As, gs, D, k };
}

/* The lowest V that keeps H_G² = U·t² + V·t + W ≥ 0 for every t = tanθ of the pattern
   (U, W ≥ 0): V ≥ −m, m = min over t of (U·t + W/t), which is 2√(UW) at t = √(W/U) when
   that lies in the range, else the smaller end. Below it the Gaussian width sits on its
   floor at some reflections, where the U, V, W derivatives vanish: a plateau the
   refinement cannot leave (from moderate starts, a third of the LaB6 runs ended there,
   reported as converged at a χ² 12 % too high). */
function vFloor(model, U, W){
  const t0 = Math.tan(Math.max(model.x0, 1e-3)/2*D2R), t1 = Math.tan(Math.min(179.9, model.x1)/2*D2R);
  U = Math.max(0, U); W = Math.max(0, W);
  let m = Math.min(U*t0 + W/t0, U*t1 + W/t1);
  if (U > 0 && W > 0){ const ts = Math.sqrt(W/U); if (ts > t0 && ts < t1) m = 2*Math.sqrt(U*W); }
  return -m;
}
// Is H_G² (nearly) on its floor at a reflection inside the pattern, for a phase that is
// there (scale > 0)? There ∂y/∂(U, V, W) vanish or follow the difference step.
function hgFloored(model, v){
  const [U, V, W] = model.iProf.slice(0, 3).map(i=> v[i]), zero = v[model.iZero], disp = v[model.iDisp];
  for (const q of model.phases){
    if (!(v[q.iScale] > 0) || !q.d) continue;
    for (let r = 0; r < q.nRefl; r++) for (const L of model.lines){
      const st = L.lam/(2*q.d[r]); if (st >= 1) continue;
      const th = Math.asin(st), tt = 2*th*R2D + zero + disp*Math.cos(th);
      if (tt < model.x0 || tt > model.x1) continue;
      const t = Math.tan(th);
      if (U*t*t + V*t + W <= 100*HG2_FLOOR) return true;
    }
  }
  return false;
}

/* refine(model, { free, maxIter, onProgress, lambda }) → Levenberg–Marquardt on the
   free parameters (names; default: those flagged `refine` in the registry), from the
   model's current values (clamped into their bounds first); the model keeps the result.
   Bounds: a step is clamped into them; a parameter sitting on a bound with the gradient
   pushing outwards is held for that iteration, and is listed in atBound at the end. When
   V is refined, its lower bound also follows U and W (vFloor), so the Gaussian width
   stays real over the whole pattern; U, V, W whose quadratic still reaches the floor at a
   reflection (U = V = W = 0) are listed in atBound with esd NaN.
   Converged when no parameter moves by more than 1 % of its esd, or when no step lowers
   χ² any further. esd_j = √((JᵀWJ)⁻¹_jj · χ²_red); a parameter with no effect on the
   pattern (a zero column, e.g. the widths of a phase at scale 0) or numerically a
   combination of others has esd NaN, and is listed in `undetermined`. */
function refine(model, opts = {}){
  // The FCJ node counts held for the whole refinement (lineNodes). When the refinement
  // has carried a line past its held count (the asymmetry, freed from 0.02, went to 0.058
  // on the user's standard: tails 8× longer than the count was made for, and χ² 8 % off
  // at the end), it runs again from there with counts made at the new values.
  if (model.fcjFreeze) return refineHeld(model, opts);
  let res;
  for (let pass = 0; pass < 4; pass++){
    const fz = model.fcjFreeze = new Map();
    try { res = refineHeld(model, opts); }
    finally { model.fcjFreeze = null; }
    model.fcjAudit = fz; model.fcjBehind = false;
    try { for (let k = 0; k < model.phases.length; k++) if (model.v[model.phases[k].iScale]) phasePattern(model, model.v, k, new Float64Array(model.n)); }
    finally { model.fcjAudit = null; }
    if (!model.fcjBehind) break;
  }
  return res;
}
function refineHeld(model, opts){
  const t0 = Date.now();
  const names = opts.free || model.par.filter(p=> p.refine).map(p=> p.name);
  const free = [...new Set(names.map(nm=> model.index[nm]).filter(i=> i != null))];
  const m = free.length, maxIter = opts.maxIter || 40, n = model.n;
  const [iU, iV, iW] = model.iProf;
  const vFree = free.includes(iV);
  // V's lower bound: its box, and with V refined the bound that keeps H_G² ≥ 0.
  const loOf = (j, vv) => j === iV && vFree ? Math.max(model.par[iV].lo, vFloor(model, vv[iU], vv[iW])) : model.par[j].lo;
  const project = vv => { if (vFree){ const lo = loOf(iV, vv); if (vv[iV] < lo) vv[iV] = lo; } return vv; };
  let v = project(clampInto(model, model.v.slice()));
  let st = evaluate(model, v);
  let lam = opts.lambda || 1e-3, it = 0, converged = false, why = '';
  const cols = free.map(()=> new Float64Array(n));
  let trial = null;
  const onBound = (j, g) => { const p = model.par[j]; return (v[j] <= loOf(j, v) && g < 0) || (v[j] >= p.hi && g > 0); };
  const chiRed = c => c/Math.max(1, rStats(model, st.yc, st.bg).N - m);
  for (; m && it < maxIter; it++){
    jacobian(model, v, st, free, cols);
    const { A, g } = normalEq(model, cols, st);
    const act = [];
    for (let a = 0; a < m; a++) if (A[a*m + a] > 0 && !onBound(free[a], g[a])) act.push(a);
    if (!act.length){ converged = true; why = 'nothing to move'; break; }
    const { As, gs, D, k } = scaled(A, g, m, act);
    // esds at this point, for the shift/esd test
    const chInv = cholInverse(cholesky(As, k), k), cr = chiRed(st.chi2);
    let accepted = false, maxRatio = 0;
    for (let tries = 0; tries < 12; tries++){
      const M = As.slice();
      for (let a = 0; a < k; a++) M[a*k + a] += lam;
      const ch = cholesky(M, k), ds = cholSolve(ch, gs, k);
      const vn = v.slice();
      maxRatio = 0;
      for (let a = 0; a < k; a++){
        const j = free[act[a]], p = model.par[j];
        let nv = v[j] + ds[a]/D[a];
        if (nv < p.lo) nv = p.lo; else if (nv > p.hi) nv = p.hi;
        const sig = Math.sqrt(Math.max(0, chInv[a*k + a])*cr)/D[a];
        if (sig > 0) maxRatio = Math.max(maxRatio, Math.abs(nv - v[j])/sig);
        vn[j] = nv;
      }
      project(vn);
      trial = evaluate(model, vn, trial);
      if (trial.chi2 < st.chi2){
        const rel = (st.chi2 - trial.chi2)/trial.chi2;
        v = vn; const t = st; st = trial; trial = t;
        lam = Math.max(lam/10, 1e-9);
        accepted = true;
        if (maxRatio < 0.01 || rel < 1e-9){ converged = true; why = 'shifts below 1 % of the esds'; }
        break;
      }
      lam *= 10;
    }
    if (opts.onProgress) opts.onProgress((it + 1)/maxIter, { iteration: it + 1, chi2: chiRed(st.chi2), lambda: lam });
    if (!accepted){ converged = true; why = 'no step lowers χ²'; break; }
    if (converged){ it++; break; }
  }
  /* Final covariance at the solution, over every free parameter, those on a bound too:
     held there, such a parameter would make the esds of the ones correlated with it
     conditional, too small (in the synthetic tests, the sizes of the runs whose strain
     sat at 0 missed the truth by up to 3.8 of those esds). Kept, it makes them somewhat
     large instead: in Monte Carlo runs where the strain sat on 0 in about half the
     realisations, the size's esd was 1.3× its true scatter — the safe side. A bound
     parameter's own esd is the curvature's, as if the bound were not there: it is listed
     in atBound, for the reader to take the value as a limit. U, V, W with H_G² on its
     floor have no meaningful curvature (∂y/∂W ∝ 1/√W there, the esd follows the
     difference step): esd NaN, and listed in atBound. */
  st = evaluate(model, v, st);
  const esd = {}, atBound = [];
  let corr = null, cov = null;
  if (m){
    jacobian(model, v, st, free, cols);
    const { A, g } = normalEq(model, cols, st);
    const act = [];
    for (let a = 0; a < m; a++){
      const j = free[a], p = model.par[j];
      if ((v[j] <= loOf(j, v) || v[j] >= p.hi) && onBound(j, g[a])) atBound.push(p.name);
      if (A[a*m + a] > 0) act.push(a);
    }
    const { As, D, k } = scaled(A, g, m, act);
    const ch = cholesky(As, k), inv = cholInverse(ch, k);
    const stats = rStats(model, st.yc, st.bg, m);
    corr = Array.from({ length: m }, (_, a)=> Array.from({ length: m }, (_, b)=> a === b ? 1 : NaN));
    cov = Array.from({ length: m }, ()=> new Array(m).fill(NaN));
    act.forEach((a, ia)=> act.forEach((b, ib)=> {
      const c = inv[ia*k + ib];
      cov[a][b] = c/(D[ia]*D[ib])*stats.chi2;
      corr[a][b] = c/Math.sqrt(inv[ia*k + ia]*inv[ib*k + ib]);
    }));
    free.forEach((j, a)=> { esd[model.par[j].name] = Math.sqrt(cov[a][a]); });
    ch.bad.forEach(b=> { const nm = model.par[free[act[b]]].name; esd[nm] = NaN; });
    if ([iU, iV, iW].some(j=> free.includes(j)) && hgFloored(model, v))
      for (const j of [iU, iV, iW]) if (free.includes(j)){ const nm = model.par[j].name; esd[nm] = NaN; if (!atBound.includes(nm)) atBound.push(nm); }
  }
  model.v = v; model.par.forEach((p, i)=> { p.value = v[i]; });
  const stats = rStats(model, st.yc, st.bg, m);
  model.esd = esd;
  model.cov = { names: free.map(j=> model.par[j].name), cov };
  const freeNames = free.map(j=> model.par[j].name);
  return { params: getParams(model), esd, corr, cov, free: freeNames, atBound,
           undetermined: freeNames.filter(nm=> !Number.isFinite(esd[nm]) && !atBound.includes(nm)),
           stats, iterations: it, converged, why, ms: Date.now() - t0 };
}

/* ---------- starting points ---------- */
// One-dimensional scan with the linear parameters solved at every point: Rwp(value).
// `only` (phase indices): the phases `apply` changes from one value to the next; the
// others are computed at the first value and kept.
function scan(model, apply, values, only){
  const v0 = model.v.slice(), curve = [];
  let best = null, st = null;
  for (const val of values){
    const v = v0.slice(); apply(v, val);
    if (st && only){ for (const k of only) phasePattern(model, v, k, st.pats[k]); assemble(model, v, st); }
    else st = evaluate(model, v, st);
    st = solveLinear(model, v, st);
    const r = rStats(model, st.yc, st.bg).Rwp;
    curve.push({ x: val, Rwp: r });
    if (!best || r < best.Rwp) best = { x: val, Rwp: r, v: v.slice() };
  }
  return { best, curve };
}
/* The grid point of least Rwp. Ties (within TIE, relative) go to the point nearest
   `centre` (the starting value): a phase whose scale solves to 0 everywhere leaves a flat
   curve, whose first point would otherwise win — the edge of the range. -1 when no point
   is a number. */
function bestIndex(curve, centre){
  let k = -1;
  curve.forEach((c, j)=>{
    if (!Number.isFinite(c.Rwp)) return;
    if (k < 0) { k = j; return; }
    const b = curve[k].Rwp, tol = TIE*Math.abs(b);
    if (c.Rwp < b - tol || (Math.abs(c.Rwp - b) <= tol && Math.abs(c.x - centre) < Math.abs(curve[k].x - centre))) k = j;
  });
  return k;
}
// A curve with no dip (all within TIE of each other): nothing in the range changes the
// fit, as for a phase whose scale solves to 0 everywhere.
function flat(curve){
  const r = curve.map(c=> c.Rwp).filter(Number.isFinite);
  return !r.length || Math.max(...r) - Math.min(...r) <= TIE*Math.min(...r);
}
// A minimum on the first or last grid point, or none (a flat curve): no minimum inside
// the range.
const edgeOrFlat = (curve, k) => k <= 0 || k >= curve.length - 1 || flat(curve);
// Parabola through the minimum and its two neighbours on the grid: the minimum between
// grid points, so the found value does not carry the grid's step.
function parabolicMin(curve, k){
  if (k <= 0 || k >= curve.length - 1) return curve[k].x;
  const [a, b, c] = [curve[k-1], curve[k], curve[k+1]];
  const den = (a.Rwp - 2*b.Rwp + c.Rwp);
  if (!(den > 0)) return b.x;
  const h = b.x - a.x, off = 0.5*h*(a.Rwp - c.Rwp)/den;
  return b.x + Math.max(-h, Math.min(h, off));
}

/* cellSearch(model, { range, steps, phase, index }) → { f, found, Rwp, curve:[{f, Rwp}],
   fine, steps, cells }: a common factor f on the cell lengths (angles kept) of one phase
   (`phase`: its id, as in ticks and cells; or `index`: its place in model.phases) or of
   all, scanned over 1 ± range with the scales and the background solved linearly at each
   f. The step keeps the shift of the last peak in the range below a third of its width,
   so the minimum cannot fall between grid points; the minimum is then placed by a
   parabola. Sharp peaks would need a thousand steps that way: the scan is then done in
   two passes, 81 steps over the range with every peak widened (a Gaussian term in W) to
   suit that step, then the fine step around the coarse minimum with the true profile.
   `curve` is the full-range pass (Rwp on widened peaks in the two-pass case), `fine` the
   second. found = false when the least Rwp lies on the edge of the range or the curve is
   flat (ties go to the point nearest f = 1: a phase whose scale solves to 0 everywhere
   would otherwise get the range's first point): no minimum inside the range.
   Then f = 1: the phase's peaks are not where any f in the range puts them — most often
   a candidate phase that is not in the sample, which an edge minimum would only start
   on a walk to its lattice bounds (an absent rutile, anatase or ZnO next to SrTiO3 took
   up to 74 wt % that way). The price: a phase that is there with its file cell beyond
   the range is not placed (autoRefine searches a single phase once more, wider). The
   model keeps f, with the scales and background solved there. */
function cellSearch(model, opts = {}){
  // Peaks at their FCJ centroids for the search (lineNodes): a quarter of its cost on a
  // large sharp cell, and the minimum where the full profile puts it.
  const prev = model.fcjCentroid; model.fcjCentroid = true;
  try { return cellSearchAt(model, opts); } finally { model.fcjCentroid = prev; }
}
function cellSearchAt(model, opts){
  const range = opts.range != null ? opts.range : 0.03;
  let ks;
  if (opts.index != null) ks = [opts.index];
  else if (opts.phase != null){
    const k = model.phases.findIndex(q=> q.id === opts.phase);
    if (k < 0) throw new Error(`No phase with id ${opts.phase}.`);
    ks = [k];
  } else ks = model.phases.map((_, k)=> k);
  if (!model.phases[ks[0]]) throw new Error(`No phase at index ${opts.index}.`);
  const v0 = model.v.slice();
  const lens = [];
  ks.forEach(k=> model.phases[k].iLat.forEach(i=> { if (/\.(a|b|c)$/.test(model.par[i].name)) lens.push(i); }));
  if (!lens.length) return null;
  const thM = Math.min(89, model.x1/2)*D2R, tM = Math.tan(thM);
  const H = Math.min(...ks.map(k=> { const { U, V, W, X, Y } = profileOf(model, v0, k); return profileAtTheta(thM, U, V, W, X, Y).H; }));
  const df = H*D2R/(3*2*tM);                       // f step: a third of the last peak's width
  const grid = (lo, hi, n) => Array.from({ length: n }, (_, s)=> lo + (hi - lo)*s/(n - 1));
  const scale = (v, f) => lens.forEach(i=> { v[i] = v0[i]*f; });
  const only = opts.index != null || opts.phase != null ? ks : null;   // the other phases do not move
  let steps = opts.steps || 2*Math.ceil(range/df) + 1, curve, fine = null, f = 1, found = false;
  if (opts.steps || steps <= 161){
    steps = Math.max(41, steps);
    curve = scan(model, scale, grid(1 - range, 1 + range, steps), only).curve;
    const kb = bestIndex(curve, 1);
    found = kb >= 0 && !edgeOrFlat(curve, kb);
    if (found) f = parabolicMin(curve, kb);
  } else {
    const nC = 81, dfC = 2*range/(nC - 1);
    const Hc = 3*2*tM*dfC*R2D, iW = model.index.W;   // the width that suits the coarse step
    // Only where the minimum lies matters in this pass: windows of ±10 FWHM, not ±40, on
    // peaks this wide (±18° each on a large cell made the pass most of the search).
    model.win = COARSE_WIN;
    try { curve = scan(model, (v, x)=> { scale(v, x); v[iW] = v0[iW] + Hc*Hc; }, grid(1 - range, 1 + range, nC), only).curve; }
    finally { model.win = WIN_FWHM; }
    const kc = bestIndex(curve, 1);
    found = kc >= 0 && !edgeOrFlat(curve, kc);
    if (found){
      const fc = curve[kc].x, nF = 2*Math.ceil(2*dfC/df) + 1;
      fine = scan(model, scale, grid(fc - 2*dfC, fc + 2*dfC, nF), only).curve;
      const kf = bestIndex(fine, fc);
      if (kf >= 0) f = parabolicMin(fine, kf);
      steps = nC + nF;
    } else steps = nC;
  }
  const v = v0.slice(); scale(v, f);
  const st = solveLinear(model, v, evaluate(model, v));
  setParams(model, v);
  const cells = ks.map(k=> ({ phase: model.phases[k].id, cell: cellOf(model, v, k) }));
  const out = c => c.map(p=> ({ f: p.x, Rwp: p.Rwp }));
  return { f, found, Rwp: rStats(model, st.yc, st.bg).Rwp, curve: out(curve), fine: fine && out(fine), steps, cells };
}

// The FWHM of the strongest peak, by half maximum over a local background (the 10th
// percentile within ±4°), the counts lightly smoothed: the profile's starting width.
function widthEstimate(model){
  const { x, y, n } = model;
  const sm = new Float64Array(n);
  for (let i = 0; i < n; i++){ let s = 0, c = 0; for (let j = Math.max(0, i-1); j <= Math.min(n-1, i+1); j++){ s += y[j]; c++; } sm[i] = s/c; }
  let im = 0; for (let i = 1; i < n; i++) if (sm[i] > sm[im]) im = i;
  const loc = [];
  for (let i = 0; i < n; i++) if (Math.abs(x[i] - x[im]) <= 4) loc.push(sm[i]);
  loc.sort((a, b)=> a - b);
  const bg = loc[Math.floor(0.1*loc.length)], half = bg + (sm[im] - bg)/2;
  let l = im, r = im;
  while (l > 0 && sm[l] > half) l--;
  while (r < n - 1 && sm[r] > half) r++;
  const xl = l < im ? x[l] + (half - sm[l])*(x[l+1] - x[l])/(sm[l+1] - sm[l]) : x[im];
  const xr = r > im ? x[r-1] + (sm[r-1] - half)*(x[r] - x[r-1])/(sm[r-1] - sm[r]) : x[im];
  return { H: Math.max(xr - xl, 2*(x[1] - x[0])), tt: x[im], height: sm[im] - bg };
}

// Reflections (α1) of every phase inside the pattern at the model's current values.
function reflectionsInRange(model){
  return calc(model).ticks.length;
}

/* ownEvidence(model, v, chi2) → per phase { under, alone, alpha, esd, own }: what of a
   phase the pattern shows apart from the others. under: the share of its calculated
   intensity that lies under the other phases' (Σ min(y_p, y_others)/Σ y_p); alone: the
   share where it is ≥ 2/3 of the Bragg intensity (and above 2 % of its own maximum);
   alpha ± esd: its scale over those points alone, by a weighted fit of
   y − y_c + y_p = α·y_p + c₀ + c₁(2θ − 2θ̄) — the line takes up what the background could
   — the esd scaled by √χ². own: alone ≥ 5 % and α above 3 esd. A phase present gives
   α ≈ 1 there; one that is not has no such region, or α ≈ 0 in it. The 2/3: on the
   SrTiO3 pattern an absent NaCl has 4 % of its intensity there (at 1/2, 26 %, enough
   for the tails a single size leaves to pass for it), a synthetic 5 wt % rutile 42 %
   at α = 1.05(9); 2 wt % rutile comes out at 0.9(4), not told from 0.
   The same structure twice (twins: two size populations of one phase, as a broad
   sample may need) is one phase here: neither is weighed against the other. */
const twins = (a, b) => a.constraint.kind === b.constraint.kind && a.atoms.length === b.atoms.length
  && Math.abs(a.mass - b.mass) <= 1e-3*a.mass && ['a','b','c'].every(l=> Math.abs(a.cell[l] - b.cell[l]) <= 0.02*a.cell[l]);
function ownEvidence(model, v, chi2){
  const st = evaluate(model, v), n = model.n, y = model.y, w = model.w, x = model.x;
  const yp = model.phases.map((q, k)=> st.pats[k].map(t=> t*v[q.iScale]));
  return model.phases.map((q, k)=>{
    const P = yp[k], O = new Float64Array(n);
    yp.forEach((Q, j)=> { if (j !== k && !twins(q, model.phases[j])) for (let i = 0; i < n; i++) O[i] += Q[i]; });
    let sp = 0, sm = 0, mx = 0;
    for (let i = 0; i < n; i++){ sp += P[i]; sm += Math.min(P[i], O[i]); if (P[i] > mx) mx = P[i]; }
    const idx = [];
    let su = 0, xm = 0;
    for (let i = 0; i < n; i++) if (w[i] > 0 && P[i] > 0.02*mx && 3*P[i] >= 2*(P[i] + O[i])){ idx.push(i); su += P[i]; xm += x[i]; }
    const under = sp > 0 ? sm/sp : 1, alone = sp > 0 ? su/sp : 0;
    let alpha = NaN, esd = NaN;
    if (idx.length > 10){
      xm /= idx.length;
      const A = new Float64Array(9), b = new Float64Array(3);
      for (const i of idx){
        const f = [P[i], 1, x[i] - xm], r = y[i] - st.yc[i] + P[i];
        for (let a = 0; a < 3; a++){ b[a] += w[i]*f[a]*r; for (let c = 0; c < 3; c++) A[3*a + c] += w[i]*f[a]*f[c]; }
      }
      // correlation-scaled, as everywhere here
      const sc = [0, 1, 2].map(a=> A[4*a] > 0 ? 1/Math.sqrt(A[4*a]) : 0);
      const As = A.map((t, ij)=> t*sc[Math.floor(ij/3)]*sc[ij%3]), bs = b.map((t, a)=> t*sc[a]);
      const ch = cholesky(As, 3);
      if (!ch.bad.includes(0)){
        alpha = cholSolve(ch, bs, 3)[0]*sc[0];
        esd = Math.sqrt(cholInverse(ch, 3)[0]*Math.max(chi2, 1e-12))*sc[0];
      }
    }
    return { under, alone, alpha, esd, own: alone >= 0.05 && alpha > 3*esd };
  });
}

/* autoRefine(model, opts) → the staged strategy, each stage a refine():
   1. sample: cell search (common factor on the lengths) with the linear scale and
      background; standard (opts.standard): its cell is fixed at the certified value, so
      a zero-shift scan takes this place.
   2. scales + background;
   3. + lattice + displacement (sample) | + zero + displacement (standard);
   4. + W, Y (with opts.irf: each phase's Ys instead);
   5. + X, and U, V and the asymmetry (S + H)/L when the instrumental profile is free
      (the standard, or opts.instrumentalProfileFree) and ≥ 8 reflections lie in the
      range (with irf: each phase's Xs instead);
   6. + ΔB per phase (opts.refineB).
   With opts.irf = { U, V, W, X, Y, asym?, zero? } (the standard's refined profile), the
   instrument's U..Y and asymmetry are held at those values and each phase's broadening
   goes to its Xs, Ys, which add to X and Y (Lorentzian widths add under convolution): size and
   strain then come from the sample alone. The zero, when given, is the instrument's and
   is held too. Without irf the phases share one total profile (their Xs, Ys stay 0).
   A phase not detected — its scale not above 3 esd, or significant only under another
   phase's peaks (see the stage loop) — is a candidate that is not in the sample: it is
   left out (scale 0, all of it held at the file's cell), since, freed, it would take
   whatever misfit is left (an absent rutile took 74 wt % of a SrTiO3 pattern as a broad
   hump at its cell bounds), and it is reported with detected: false, its size and
   strain NaN, its weight fraction 0. A phase the cell search found no minimum for keeps
   the file's cell throughout.
   Other options: bgInv (default true when the pattern starts below 20°), range (cell
   search, default 0.03), maxIter, onProgress(frac, stageName).
   Returns { params, esd, corr, cov, free, atBound, undetermined, stats, stages:[{name,
   Rwp, Rexp, chi2, Rp, cRwp, free, iterations, converged, ms}], cellSearch:{f, Rwp,
   curve, fine, steps, phases:[{id, f, found, Rwp, curve, fine, steps}]} (f, curve: the
   first phase's), sizeStrain, weightFractions (each with `detected`), detected: [ids],
   warnings: [string], reflectionsInRange, converged, ms }. */
function autoRefine(model, opts = {}){
  const t0 = Date.now(), stages = [], warnings = [];
  const irf = opts.irf || null, std = !!opts.standard;
  const prog = opts.onProgress || (()=>{});
  const nStages = opts.refineB ? 6 : 5;
  const lin = ['bg' + 0];
  for (let k = 1; k <= model.bgDegree; k++) lin.push('bg' + k);
  if (opts.bgInv != null) model.useInv = !!opts.bgInv && model.x0 > 0;
  if (model.useInv) lin.push('bgInv'); else model.v[model.index.bgInv] = 0;
  const scales = model.phases.map(q=> q.pfx + 'scale');
  const lattice = std ? [] : model.phases.flatMap(q=> q.latNames.map(nm=> q.pfx + nm));
  const linIdx = [...scales, ...lin].map(nm=> model.index[nm]);
  const v = model.v;

  // Starting profile.
  const est = widthEstimate(model), thE = est.tt/2*D2R;
  // The asymmetry: the standard's with irf (0 in an irf from before it was modelled);
  // refined where the instrument's profile is (the standard), from a typical (S + H)/L,
  // since at 0 it has no derivative; else none. Whether stage 4 frees it, with U and V,
  // is decided after stage 3 from the reflections then in range; the count at the
  // file's cell here only chooses the starting value.
  const instrFree = (std || opts.instrumentalProfileFree) && !irf;
  const asym0 = Number.isFinite(opts.asym0) ? opts.asym0 : ASYM_START;
  v[model.iAsym] = irf ? (Number.isFinite(irf.asym) ? irf.asym : 0) : instrFree && reflectionsInRange(model) >= 8 ? asym0 : 0;
  if (irf){
    ['U','V','W','X','Y'].forEach(k=> { if (Number.isFinite(irf[k])) v[model.index[k]] = irf[k]; });
    if (Number.isFinite(irf.zero)) v[model.iZero] = irf.zero;
    // The sample's width above the instrument's, all of it Lorentzian to start with.
    const Hi = profileAtTheta(thE, irf.U || 0, irf.V || 0, irf.W || 0, irf.X || 0, irf.Y || 0).H;
    model.phases.forEach(q=> { v[q.iYs] = Math.max(0, est.H - Hi)*Math.cos(thE); v[q.iXs] = 0; });
  } else {
    const h = est.H/1.635;      // H_G = H_L = h gives H = 1.635 h under TCH
    v[model.index.U] = 0; v[model.index.V] = 0; v[model.index.X] = 0;
    v[model.index.W] = h*h; v[model.index.Y] = h*Math.cos(thE);
    model.phases.forEach(q=> { v[q.iYs] = 0; v[q.iXs] = 0; });
  }
  setParams(model, v);
  const stageStats = (name, r, extra) => {
    const st = evaluate(model, model.v), s = rStats(model, st.yc, st.bg, r ? r.free.length : linIdx.length);
    const row = { name, Rwp: s.Rwp, Rexp: s.Rexp, chi2: s.chi2, Rp: s.Rp, cRwp: s.cRwp, free: r ? r.free : [], iterations: r ? r.iterations : 0, converged: r ? r.converged : true, ms: Date.now() - tS, ...extra };
    stages.push(row);
    return row;
  };
  let tS = Date.now();

  // 1. where the peaks are
  prog(0, std ? 'zero search' : 'cell search');
  let cs = null;
  const notFound = new Set(), len0 = model.phases.map(q=> q.iLat.map(i=> model.v[i]));
  if (!std && lattice.length){
    // One factor per phase, each scanned with the others held; with several phases twice
    // round, since a phase scanned while another still sits at its CIF cell can be drawn
    // to that one's peaks.
    // The second round only for the phases the first found: one not found is not
    // searched again (twice round, an edge minimum compounded to 0.97² = 0.94).
    const range = opts.range != null ? opts.range : 0.03, per = [];
    const rounds = model.phases.length > 1 ? 2 : 1;
    for (let r = 0; r < rounds; r++) model.phases.forEach((q, k)=> {
      if (r && !(per[k] && per[k].found)) return;
      const c = cellSearch(model, { index: k, range });
      if (c) per[k] = { id: q.id, found: c.found, Rwp: c.Rwp, curve: c.curve, fine: c.fine, steps: (per[k] ? per[k].steps : 0) + c.steps };
    });
    // A single phase not found: no other phase to be confused with, so the search may go
    // wider at no risk (its file cell may be a few % off: a doped or computed cell).
    let wide = range;
    if (model.phases.length === 1 && per[0] && !per[0].found){
      wide = 2*range;
      const c = cellSearch(model, { index: 0, range: wide });
      per[0] = { ...per[0], found: c.found, Rwp: c.Rwp, curve: c.curve, fine: c.fine, steps: per[0].steps + c.steps };
    }
    per.forEach((p, k)=> { if (p && !p.found){ notFound.add(k); warnings.push(`${model.phases[k].name || 'Phase ' + p.id}: the cell search found no minimum within ±${+((model.phases.length === 1 ? wide : range)*100).toFixed(1)} % of the file's cell, which is kept.`); } });
    per.forEach((p, k)=> { if (!p) return; const q = model.phases[k], i = q.iLat.findIndex(j=> /\.(a|b|c)$/.test(model.par[j].name)); p.f = model.v[q.iLat[i]]/len0[k][i]; });
    const first = per.find(p=> p);
    const st = evaluate(model, model.v), Rwp = rStats(model, st.yc, st.bg).Rwp;
    cs = first ? { f: first.f, Rwp, curve: first.curve, fine: first.fine, steps: first.steps, phases: per.filter(p=> p) } : null;
    stageStats('cell search', null, { f: cs ? cs.f : 1 });
  } else if (std){
    const H = Math.max(est.H, 0.02), zs = [];
    for (let z = -0.3; z <= 0.3 + 1e-9; z += H/4) zs.push(z);
    // The same rule as the cell search: a minimum on the edge of ±0.3° (or none) leaves
    // the zero where it was.
    const z0 = model.v[model.iZero];
    // Peaks at their FCJ centroids, as in the cell search.
    const prevC = model.fcjCentroid; model.fcjCentroid = true;
    let sc;
    try { sc = scan(model, (vv, z)=> { vv[model.iZero] = z; }, zs); } finally { model.fcjCentroid = prevC; }
    const kmin = bestIndex(sc.curve, z0), found = kmin >= 0 && !edgeOrFlat(sc.curve, kmin);
    const z = found ? parabolicMin(sc.curve, kmin) : z0, vv = model.v.slice(); vv[model.iZero] = z;
    if (!found) warnings.push('The zero-shift scan found no minimum within ±0.3°: the zero is left at its start.');
    solveLinear(model, vv, evaluate(model, vv), linIdx);
    setParams(model, vv);
    stageStats('zero search', null, { zero: z, found });
  } else {
    const vv = model.v.slice(); solveLinear(model, vv, evaluate(model, vv), linIdx); setParams(model, vv);
    stageStats('linear start', null);
  }
  const run = (k, name, free) => {
    tS = Date.now();
    prog(k/nStages, name);
    const r = refine(model, { free, maxIter: opts.maxIter || 40, onProgress: (f)=> prog((k + Math.min(1, f))/nStages, name) });
    stageStats(name, r);
    return r;
  };
  // Detected: a scale above 3 esd.
  const significant = r => model.phases.map(q=> r.params[q.pfx + 'scale'] > 3*r.esd[q.pfx + 'scale']);
  const nm = k => model.phases[k].name || 'Phase ' + model.phases[k].id;
  const pfxOf = k => model.phases[k].pfx;
  // A phase the cell search placed nowhere keeps the file's cell, as the warning says:
  // freed, its lattice walks to wherever a misfit pulls it (an absent LaB6 went 5.7 %
  // off its cell to sit under SrTiO3's peaks).
  const latHeld = name => [...notFound].some(k=> name.startsWith(pfxOf(k)));
  /* A phase not detected is left out: its scale 0, everything of it held, its cell the
     file's (for its ticks). With its scale left free it still took what misfit its
     peaks could reach — an absent LaB6, held at its cell with the starting widths, came
     out at 2.9 esd yet 35(8) wt % — and bent the others' results. Not detected:
     - its scale not above 3 esd after the scales and background (stage 1): out at once;
     - not above 3 esd at the end: out, and the stages run again without it;
     - significant only through intensity under another phase's peaks, with no part of
       the pattern its own (ownEvidence): a broad absent NaCl, its strong lines within
       0.6° of SrTiO3's, took 40 wt % of a SrTiO3 pattern by fitting the tails a single
       crystallite size leaves. The one with the least of its own goes, the stages run
       again, and so on; when none of the phases has a part of its own, nothing tells
       which is there and none goes (a warning says so). */
  const vSearch = model.v.slice(), nSearch = stages.length, out = new Set(), outWarn = [];
  const leaveOut = (k, why, vv)=> {
    out.add(k); outWarn.push(`${nm(k)}: not detected — ${why}.`);
    vv[model.phases[k].iScale] = 0; model.phases[k].iLat.forEach((i, m)=> { vv[i] = len0[k][m]; });
  };
  let res, nIn;
  for (;;){
    let free = [...scales.filter((_, k)=> !out.has(k)), ...lin];
    res = run(1, 'scales and background', free);
    const s1 = significant(res), vv = model.v.slice();
    model.phases.forEach((_, k)=> { if (!out.has(k) && !s1[k]) leaveOut(k, 'its scale is not above 3 esd', vv); });
    setParams(model, vv);
    free = free.filter(name=> !out.has(scales.indexOf(name)));
    const keep = list => list.filter(name=> !model.phases.some((_, k)=> out.has(k) && name.startsWith(pfxOf(k))));
    free = free.concat(std ? ['zero', 'disp'] : [...keep(lattice).filter(name=> !latHeld(name)), 'disp']);
    res = run(2, std ? 'zero and displacement' : 'lattice and displacement', free);
    free = free.concat(irf ? keep(model.phases.map(q=> q.pfx + 'Ys')) : ['W', 'Y']);
    res = run(3, 'widths', free);
    nIn = reflectionsInRange(model);
    const uvFree = instrFree && nIn >= 8;
    // Freed from a typical value (at 0 it has no derivative); held, none.
    if (instrFree && (uvFree ? !(model.v[model.iAsym] > 0) : model.v[model.iAsym] !== 0)){ const vv = model.v.slice(); vv[model.iAsym] = uvFree ? asym0 : 0; setParams(model, vv); }
    free = free.concat(irf ? keep(model.phases.map(q=> q.pfx + 'Xs')) : uvFree ? ['X', 'U', 'V', 'asym'] : ['X']);
    res = run(4, irf ? 'size and strain' : uvFree ? 'full profile' : 'profile shape', free);
    if (opts.refineB){
      free = free.concat(keep(model.phases.map(q=> q.pfx + 'B')));
      res = run(5, 'displacement parameters', free);
    }
    const sig = significant(res), live = model.phases.map((_, k)=> k).filter(k=> !out.has(k));
    const lost = live.filter(k=> !sig[k]);
    let drop = null;
    if (!lost.length && live.length > 1){
      const ev = ownEvidence(model, model.v, res.stats.chi2);
      const weak = live.filter(k=> !ev[k].own).sort((a, b)=> ev[a].alone - ev[b].alone || ev[b].under - ev[a].under);
      if (weak.length && weak.length < live.length){
        const k = weak[0], e = ev[k], others = live.filter(j=> j !== k && !twins(model.phases[k], model.phases[j])).map(nm).join(', ');
        drop = { k, why: `${Math.round(e.under*100)} % of its calculated intensity lies under ${others}'s peaks, and ${e.alone < 0.05 || !Number.isFinite(e.alpha)
          ? 'no part of the pattern is its own'
          : `where it is alone (${Math.round(e.alone*100)} % of it) the pattern shows ${Math.round(e.alpha*100)} ± ${Math.round(e.esd*100)} % of the intensity calculated: not told from none`}` };
      }
    }
    if (!lost.length && !drop) break;
    // Again from the search's state, without them.
    const v2 = vSearch.slice();
    out.forEach(k=> { v2[model.phases[k].iScale] = 0; model.phases[k].iLat.forEach((i, m)=> { v2[i] = len0[k][m]; }); });
    lost.forEach(k=> leaveOut(k, 'its scale is not above 3 esd once the cells and widths are refined', v2));
    if (drop) leaveOut(drop.k, drop.why, v2);
    setParams(model, v2);
    stages.length = nSearch;
  }
  warnings.push(...outWarn);
  const live = model.phases.map((_, k)=> k).filter(k=> !out.has(k));
  if (live.length > 1){
    const ev = ownEvidence(model, model.v, res.stats.chi2);
    if (live.every(k=> !ev[k].own)) warnings.push(`${live.map(nm).join(', ')}: their peaks overlap throughout, with no part of the pattern any one's own: their fractions are not told apart.`);
    else live.forEach(k=> { if (ev[k].own && ev[k].alpha < 0.5) warnings.push(`${nm(k)}: where it is alone it shows ${Math.round(ev[k].alpha*100)} % of the intensity the fit gives it — its fraction rests mostly on peaks it shares.`); });
  }
  prog(1, 'done');
  const detected = model.phases.map((_, k)=> !out.has(k));
  const phasesNow = model.phases.map((q, k)=> ({ id: q.id, name: q.name, cell: cellOf(model, model.v, k), mass: q.mass }));
  const scl = model.phases.map(q=> model.v[q.iScale]);
  const cov = model.cov && model.cov.cov ? scales.map(a=> scales.map(b=> {
    const ia = model.cov.names.indexOf(a), ib = model.cov.names.indexOf(b);
    return ia >= 0 && ib >= 0 ? model.cov.cov[ia][ib] : 0;
  })) : null;
  // A phase not detected has no size or strain to report (its widths are its start's).
  const ss = sizeStrain(model, irf, res).map((s, k)=> detected[k] ? { ...s, detected: true }
    : { ...s, D: NaN, Desd: NaN, strain: NaN, strainEsd: NaN, detected: false });
  const wf = weightFractions(phasesNow, scl, cov).map((w, k)=> ({ ...w, detected: detected[k] }));
  return {
    params: res.params, esd: res.esd, corr: res.corr, cov: res.cov, free: res.free, atBound: res.atBound, undetermined: res.undetermined,
    stats: res.stats, stages, cellSearch: cs,
    sizeStrain: ss, weightFractions: wf, detected: model.phases.filter((_, k)=> detected[k]).map(q=> q.id), warnings,
    reflectionsInRange: nIn, converged: res.converged, ms: Date.now() - t0,
  };
}

/* ---------- derived quantities ---------- */
/* sizeStrain(model, irf, result?) → per phase:
   { id, name, Ys, Xs (deg), YsEsd, XsEsd, D (nm), Desd, strain, strainEsd, instrumentSubtracted }.
   The phase's Lorentzian widths above the instrument's: Y_s = (Y + Ys_phase) − Y_irf,
   X_s = (X + Xs_phase) − X_irf (without irf the whole width: the size then includes the
   instrument). Size: D = Kλ/(Y_s·π/180), K = 0.9 (Scherrer, as the Analysis card), λ the
   Kα1; strain: H_L = 4ε·tanθ → ε = X_s·(π/180)/4. esds from the refinement's covariance
   (result, else the model's last one); the irf's own uncertainty is not included. A
   width at or below zero means no measurable broadening: D = Infinity, ε = 0. */
function sizeStrain(model, irf, result){
  const v = model.v;
  const names = result && result.free ? result.free : (model.cov ? model.cov.names : []);
  const cov = result && result.cov ? result.cov : (model.cov ? model.cov.cov : null);
  // A parameter that was not refined adds nothing; one refined but left without an esd
  // (on its bound) leaves the result without one.
  const c = (a, b)=> {
    const i = names.indexOf(a), j = names.indexOf(b);
    if (i < 0 || j < 0 || !cov) return 0;
    return cov[i][j];
  };
  const lam = model.lines[0].lam;
  const Yi = irf && Number.isFinite(irf.Y) ? irf.Y : 0, Xi = irf && Number.isFinite(irf.X) ? irf.X : 0;
  return model.phases.map(q=> {
    const ys = q.pfx + 'Ys', xs = q.pfx + 'Xs';
    const Ysam = v[model.index.Y] + v[q.iYs] - Yi, Xsam = v[model.index.X] + v[q.iXs] - Xi;
    const sY = Math.sqrt(c('Y','Y') + c(ys, ys) + 2*c('Y', ys));
    const sX = Math.sqrt(c('X','X') + c(xs, xs) + 2*c('X', xs));
    const D = Ysam > 0 ? K_SCHERRER*lam/(Ysam*D2R)/10 : Infinity;   // nm
    return { id: q.id, name: q.name, Ys: Ysam, Xs: Xsam, YsEsd: sY, XsEsd: sX,
             D, Desd: Ysam > 0 ? D*sY/Ysam : NaN, strain: Xsam > 0 ? Xsam*D2R/4 : 0, strainEsd: sX*D2R/4,
             instrumentSubtracted: !!irf };
  });
}

/* weightFractions(phases, scales, cov?) → [{ id, name, W, esd }], Hill & Howard
   (J. Appl. Cryst. 20 (1987) 467): W_p = S_p·(ZMV)_p / Σ S_q·(ZMV)_q, ZM the cell's mass
   (cellMass of its atoms) and V its volume. esd from the scales' covariance (an n×n
   array), by the gradient of W. */
function weightFractions(phases, scales, cov){
  const kz = phases.map(p=> (Number.isFinite(p.mass) ? p.mass : cellMass(p.atoms || []))*metric(p.cell).V);
  const t = phases.reduce((s, p, i)=> s + scales[i]*kz[i], 0);
  return phases.map((p, i)=> {
    const W = t > 0 ? scales[i]*kz[i]/t : NaN;
    let v = 0;
    if (cov && t > 0){
      // ∂W_i/∂S_j = (δ_ij·k_i − W_i·k_j)/T
      const gr = phases.map((_, j)=> ((i === j ? kz[i] : 0) - W*kz[j])/t);
      for (let a = 0; a < gr.length; a++) for (let b = 0; b < gr.length; b++) v += gr[a]*gr[b]*(cov[a][b] || 0);
    }
    return { id: p.id, name: p.name, W, esd: cov ? Math.sqrt(Math.max(0, v)) : NaN };
  });
}

// Sample displacement in mm from the refined `disp` (deg): Δ2θ = −(2s/R)·cosθ.
function displacementMm(model, disp){ return -disp*D2R*model.radius/2; }

export { buildModel, calc, refine, cellSearch, autoRefine, sizeStrain, weightFractions,
         solveLinear, getParams, setParams, rStats, tch, profileAtTheta, displacementMm };
