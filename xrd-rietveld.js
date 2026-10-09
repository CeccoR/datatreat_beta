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
import { metric, reflections, latticeNames, latticeParams, cellFrom, cellMass, atomOrbits, siteAdpBasis, betaOf } from './xrd-cryst.js';
import { lineForWavelength, f0, fprime } from './xrd-data.js';
import { wppmLine, addMemberCoef, quarticInvariants, evalQuartic, faultTable, faultKappa } from './xrd-broad.js';

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
const FCJ_G3 = 0.5;         // |dMax|/H below which three Gauss nodes stand for the tail (≤ 0.007 % of the peak)
/* The three-point Gauss quadrature of a discrete distribution {d, w} (Σw = sw, mean
   mu): Stieltjes' recurrence for its orthogonal polynomials, in the shift centred and
   scaled by its spread, then the Jacobi matrix's eigen-decomposition (Golub–Welsch). */
function gaussOf(pts, sw, mu){
  let v2 = 0;
  for (const o of pts) v2 += o.w*(o.d - mu)**2;
  const sg = Math.sqrt(v2/sw);
  if (!(sg > 0)) return null;
  const z = pts.map(o=> (o.d - mu)/sg), w = pts.map(o=> o.w/sw);
  const p0 = z.map(()=> 1), dot = (f, g, wx) => z.reduce((t, zi, i)=> t + w[i]*f[i]*g[i]*(wx ? zi : 1), 0);
  const a0 = dot(p0, p0, true)/dot(p0, p0);
  const p1 = z.map(zi=> zi - a0), n1 = dot(p1, p1), a1 = dot(p1, p1, true)/n1, b1 = n1/dot(p0, p0);
  const p2 = z.map((zi, i)=> (zi - a1)*p1[i] - b1*p0[i]), n2 = dot(p2, p2);
  if (!(n2 > 1e-14)) return null;
  const a2 = dot(p2, p2, true)/n2, b2 = n2/n1;
  const E = eigSym3([a0, Math.sqrt(b1), 0, Math.sqrt(b1), a1, Math.sqrt(b2), 0, Math.sqrt(b2), a2]);
  return E.map(e=> ({ d: mu + sg*e.val, w: e.vec[0]*e.vec[0] })).sort((p, q)=> p.d - q.d);
}
function fcjNodes(th, A, H, nForce){
  const tt = 2*th, c2 = Math.cos(tt);
  if (!(A > 0) || Math.abs(c2) < 1e-12) return null;
  const hTan = Math.abs(Math.tan(tt)), cut = hTan < A;
  const hMax = cut ? hTan*(1 - 1e-12) : A;
  const phiOf = h => Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + h*h))));
  const dMax = (phiOf(hMax) - tt)*R2D;
  const collapse = nForce ? nForce === 1 : Math.abs(dMax) < 0.05*H;
  // A tail shorter than the width: three nodes, the Gauss quadrature of the shift's own
  // distribution (exact for its first six moments), instead of one every quarter width.
  const gauss3 = !collapse && (nForce ? nForce === 3 : Math.abs(dMax) < FCJ_G3*H);
  const n = collapse ? 4 : gauss3 ? 24 : nForce || Math.min(FCJ_MAX_NODES, Math.max(4, Math.ceil(4*Math.abs(dMax)/Math.max(H, 1e-4)) + 2));
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
  if (gauss3){ const g = gaussOf(out, sw, sd/sw); if (g){ g.n = 3; return g; } }
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
    if (au && nd){ const f = au.get(key); if (f === undefined || f === 0 || (f <= 3 ? nd.n > f : nd.n > 1.25*f)) model.fcjBehind = true; }
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

/* ---------- the free crystallite shape ----------
   The crystallites' shape with none assumed: the Lorentzian size width of a reflection
   whose diffraction vector has the unit direction u (Cartesian) follows the solid's
   volume-weighted mean column length along u, <L>_V(u) (Stokes & Wilson: the integral
   breadth of the size profile is λ/(<L>_V·cosθ)). The shape is the crystallite's, not
   the crystal's: a plate normal to one ⟨110⟩ of a cubic phase breaks the cubic
   symmetry, and the members of a family — (110), (1-10), (101)… — then have different
   column lengths. So each member is drawn with its own width and the peak is their sum
   (a sharp part and a broad part): a width per family, as Laue-symmetric models give,
   cannot describe such a shape at all. Friedel mates (u, −u) are one member. The
   members' directions are fixed with the cell's metric at the start: the cell moves by
   tenths of a per cent in a refinement.
   The solids (p.shape, true meaning 'ellipsoid'):
   - ellipsoid, spheroid (two axes equal), cylinder, elliptic cylinder (an ellipse
     translated along the axis), box (a rectangular parallelepiped): the affine image
     of a unit ball, cylinder (diameter and height 1, axis z) or cube,
     body = Rot·diag(D)·base. (v420's ellipsoid, Ys(u) = Ys + |Lᵀu| with S = L·Lᵀ six
     free numbers, stays as 'ellipsoidL' for the results refined with it: its axes' esds
     came from a covariance of L near-singular wherever the axes lie on symmetric
     directions — the user's plate normal ±109° —, and it could not be held on the
     lattice as the other solids are.)
     For such a body <L>_V(u) = <L>_V,base(ŵ)/|w| with w = diag(1/D)·Rotᵀu (the
     covariogram of an affine image is the image's), so one function per base body,
     columnLengthV, serves every proportion. Rot = R(q₀)·exp([r]×): q₀ a reference
     orientation held in each refinement (the start's), r a rotation vector refined
     from 0 — no gimbal lock, and its esds are small turns about the body's own axes;
     a body of revolution refines two components (a turn about its own axis does
     nothing).
   Sizes are read with one calibration throughout: the width a sphere of diameter D
   gets from the isotropic size, D = Kλ/(Ys·cosθ), K = 0.9 as in the Analysis card, so
   a solid's width along u is that of the sphere with the same <L>_V (3D/4): its
   parameters W (°) are the widths of spheres of the solid's diameters, edges or axes,
   which come out as true dimensions (an ellipsoid's principal sizes are its full axes,
   a cylinder's its diameter and height). */
const SHAPE_NAMES = ['L11', 'L21', 'L22', 'L31', 'L32', 'L33'];
const SHAPE_TYPES = ['ellipsoid', 'spheroid', 'cylinder', 'ellcyl', 'box', 'ellipsoidL'];
// The bodies: base solid, width parameters (° — a sphere's width for that dimension;
// each solid's own names, so that a result's parameters say which solid it was) and
// how they map onto the body axes x, y, z, and the rotation components refined.
const BODIES = {
  ellipsoid: { base: 'ball', W: ['Ea', 'Eb', 'Ec'], axes: W=> W, rot: 3 },
  spheroid: { base: 'ball', W: ['Wa', 'Wc'], axes: W=> [W[0], W[0], W[1]], rot: 2 },
  cylinder: { base: 'cylinder', W: ['Wd', 'Wh'], axes: W=> [W[0], W[0], W[1]], rot: 2 },
  ellcyl: { base: 'cylinder', W: ['Wa', 'Wb', 'Wh'], axes: W=> W, rot: 3 },
  box: { base: 'cube', W: ['Wa', 'Wb', 'Wc'], axes: W=> W, rot: 3 },
};
const ROT_NAMES = ['R1', 'R2', 'R3'], QREF_NAMES = ['Q0', 'Q1', 'Q2', 'Q3'];
const shapeTypeOf = p => p === true ? 'ellipsoid' : SHAPE_TYPES.includes(p) ? p : null;

/* columnLengthV(base, w) → <L>_V of the unit base body along the direction of w (any
   length): 'ball' (diameter 1), 'cylinder' (diameter 1, height 1, axis z), 'cube'
   (edge 1). From the covariogram, <L>_V = (2/V)∫₀^T g(t·ŵ) dt, T where the translate
   leaves the body:
   - cube: g = (1 − t|w₁|)(1 − t|w₂|)(1 − t|w₃|), a polynomial; [100] gives 1, [110]
     1/1.0607, [111] 1/1.1547 (Langford & Louër's K_β);
   - cylinder: g = (1 − ct)·A(st), c = |ŵ_z|, s = the rest, A(d) = ½(acos d − d√(1 − d²))
     the overlap of two unit-diameter discs d apart; integrated in closed form (∫acos,
     ∫x·acos, ∫x√(1−x²), ∫x²√(1−x²)); along the axis 1, across it 8/(3π); near the axis
     (s/c < 10⁻³, where the closed form cancels) its series.
   Checked against ray casting of the solids to 10⁻⁷. Smooth where the factor that ends
   the integral changes (it is 0 there), but it kinks — linear in the tilt — wherever ŵ
   lies in a face's plane (some wᵢ = 0) and along the cylinder's axis: shapeWidths
   rounds those off. */
function columnLengthV(base, w){
  const n = Math.hypot(w[0], w[1], w[2]);
  if (base === 'ball' || !(n > 0)) return 0.75;
  const a = Math.abs(w[0])/n, b = Math.abs(w[1])/n, c = Math.abs(w[2])/n;
  if (base === 'cube'){
    const T = 1/Math.max(a, b, c);
    const I = T - (a + b + c)*T*T/2 + (a*b + a*c + b*c)*T*T*T/3 - a*b*c*T*T*T*T/4;
    return 2*I;
  }
  const s = Math.hypot(a, b);
  if (s < 1e-3*c){ const p = s/c; return (1 - 4*p/(3*Math.PI) + p*p*p/(15*Math.PI))/c; }
  const D = Math.min(1, s/Math.max(c, 1e-300)), r = Math.sqrt(Math.max(0, 1 - D*D)), ac = Math.acos(D), as = Math.asin(D);
  // F0 = ∫₀^D A, F1 = ∫₀^D d·A (A as above, in d = s·t).
  const F0 = 0.5*(D*ac - r + 1 - (1 - r*r*r)/3);
  const F1 = 0.5*(D*D/2*ac + (as - D*r)/4 - (as - D*r*(1 - 2*D*D))/8);
  return 8/Math.PI/s*(F0 - c/s*F1);
}

// Quaternions [w, x, y, z]: the reference orientation q₀ (a body axis i is column i of
// the matrix), products, and the rotation of a rotation vector.
function quatMat(q){
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1, [w, x, y, z] = q.map(t=> t/n);
  return [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),  2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),  2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)];
}
function quatMul(p, q){
  return [p[0]*q[0] - p[1]*q[1] - p[2]*q[2] - p[3]*q[3], p[0]*q[1] + p[1]*q[0] + p[2]*q[3] - p[3]*q[2],
          p[0]*q[2] - p[1]*q[3] + p[2]*q[0] + p[3]*q[1], p[0]*q[3] + p[1]*q[2] - p[2]*q[1] + p[3]*q[0]];
}
function quatOfRot(r){
  const th = Math.hypot(r[0], r[1], r[2]);
  if (th < 1e-12) return [1, r[0]/2, r[1]/2, r[2]/2];
  const k = Math.sin(th/2)/th;
  return [Math.cos(th/2), r[0]*k, r[1]*k, r[2]*k];
}
// The quaternion of a rotation matrix (row-major, proper).
function quatOfMat(R){
  const t = R[0] + R[4] + R[8];
  let q;
  if (t > 0){ const S = Math.sqrt(t + 1)*2; q = [S/4, (R[7] - R[5])/S, (R[2] - R[6])/S, (R[3] - R[1])/S]; }
  else if (R[0] > R[4] && R[0] > R[8]){ const S = Math.sqrt(1 + R[0] - R[4] - R[8])*2; q = [(R[7] - R[5])/S, S/4, (R[1] + R[3])/S, (R[2] + R[6])/S]; }
  else if (R[4] > R[8]){ const S = Math.sqrt(1 + R[4] - R[0] - R[8])*2; q = [(R[2] - R[6])/S, (R[1] + R[3])/S, S/4, (R[5] + R[7])/S]; }
  else { const S = Math.sqrt(1 + R[8] - R[0] - R[4])*2; q = [(R[3] - R[1])/S, (R[2] + R[6])/S, (R[5] + R[7])/S, S/4]; }
  const n = Math.hypot(...q);
  return q.map(x=> x/n);
}
// A body's orientation at v: R(q₀)·exp([r]×), the body axes its columns.
function bodyFrame(q, v){
  const r = [0, 1, 2].map(i=> i < q.iR.length ? v[q.iR[i]] : 0);
  return quatMat(quatMul(q.iQ.map(i=> v[i]), quatOfRot(r)));
}

function shapeSetup(q, p, cell, list, add, nextIndex){
  const type = q.shapeType = shapeTypeOf(p.shape);
  if (type === 'ellipsoidL') q.iL = SHAPE_NAMES.map(nm=> { const i = nextIndex(); add(nm, 0, -10, 10); return i; });
  else {
    const B = BODIES[type];
    q.iW = B.W.map(nm=> { const i = nextIndex(); add(nm, 0, 0, 10); return i; });
    q.iR = ROT_NAMES.slice(0, B.rot).map(nm=> { const i = nextIndex(); add(nm, 0, -4, 4, { maxStep: 0.4 }); return i; });
    // The reference orientation: never refined (it only charts where r = 0 is).
    q.iQ = QREF_NAMES.map((nm, j)=> { const i = nextIndex(); add(nm, j ? 0 : 1, -1, 1); return i; });
  }
  memberVectors(q, p, cell, list);
}
// Each reflection's members (its Laue-equivalent hkl, one of each ± pair) as Cartesian
// unit vectors: the free shape draws each with its own width, the texture weighs each.
function memberVectors(q, p, cell, list){
  if (q.mv) return;
  const { Gs } = metric(cell);
  // B, upper-triangular, with Gs = BᵀB: the Cartesian diffraction vector is B·h.
  const b11 = Math.sqrt(Gs[0]), b12 = Gs[1]/b11, b13 = Gs[2]/b11;
  const b22 = Math.sqrt(Gs[4] - b12*b12), b23 = (Gs[5] - b12*b13)/b22, b33 = Math.sqrt(Gs[8] - b13*b13 - b23*b23);
  q.Bm = [b11, b12, b13, 0, b22, b23, 0, 0, b33];
  const laue = [], lk = new Set();
  for (const { R } of (p.ops && p.ops.length ? p.ops : [{ R: [1,0,0, 0,1,0, 0,0,1] }])) for (const M of [R, R.map(t=> -t)]){
    const key = M.join(); if (!lk.has(key)){ lk.add(key); laue.push(M); }
  }
  q.laue = laue;
  q.mv = list.map(r=>{
    const seen = new Set(), out = [];
    for (const M of laue){
      const h = r.h*M[0] + r.k*M[3] + r.l*M[6], k = r.h*M[1] + r.k*M[4] + r.l*M[7], l = r.h*M[2] + r.k*M[5] + r.l*M[8];
      if (seen.has(h + ',' + k + ',' + l) || seen.has(-h + ',' + -k + ',' + -l)) continue;
      seen.add(h + ',' + k + ',' + l);
      const x1 = b11*h + b12*k + b13*l, x2 = b22*k + b23*l, x3 = b33*l, nn = Math.hypot(x1, x2, x3);
      out.push(x1/nn, x2/nn, x3/nn);
    }
    return Float64Array.from(out);
  });
}
/* The preferred orientation's axis from a phase's option: [h, k, l] (the conventional
   cell's indices, as the ticks), '110', '1 -1 0', 'auto', or none (null). */
function textureOf(po){
  if (po == null || po === false || po === '') return null;
  if (po === 'auto') return 'auto';
  const t = Array.isArray(po) ? po.map(Number) : String(po).trim().match(/-?\d/g) ? (String(po).includes(' ') || String(po).includes(',') ? String(po).split(/[\s,]+/).map(Number) : String(po).match(/-?\d/g).map(Number)) : null;
  return t && t.length === 3 && t.every(Number.isInteger) && t.some(x=> x) ? t : null;
}
// The texture axis as a Cartesian unit vector (the frame of q.mv): the plane normal
// (hkl) of the conventional cell, B·h in the file's basis (h = h_conv·M⁻¹).
function textureAxis(q){
  if (q.poAxisVec && q.poAxisFor === q.poHkl) return q.poAxisVec;
  const hc = q.poHkl, M = q.constraint && q.constraint.basis;
  let h = hc;
  if (M){
    const [a, b, c, d, e, f, g, hh, i] = M, A = e*i - f*hh, Bc = -(d*i - f*g), C = d*hh - e*g, det = a*A + b*Bc + c*C;
    const Mi = [A/det, -(b*i - c*hh)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*hh - b*g)/det, (a*e - b*d)/det];
    h = [0, 1, 2].map(j=> hc[0]*Mi[j] + hc[1]*Mi[3 + j] + hc[2]*Mi[6 + j]);
  }
  const B = q.Bm, x = [B[0]*h[0] + B[1]*h[1] + B[2]*h[2], B[4]*h[1] + B[5]*h[2], B[8]*h[2]], n = Math.hypot(...x);
  q.poAxisVec = x.map(t=> t/n); q.poAxisFor = q.poHkl;
  return q.poAxisVec;
}
// The axes 'auto' tries: the low-index planes, one of each Laue family. The planes are
// the conventional cell's (as the texture axis reads them), so their families are
// found with the Laue group in that cell, M⁻¹·R·M: with the file's own operations on a
// primitive cell's indices (a primitive fcc file), (100) and (111) had been one family
// and (111) was never tried.
function lowIndexPlanes(q){
  const cand = [[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]], seen = new Set(), out = [];
  const M = q.constraint && q.constraint.basis;
  const ops = (q.laue || []).map(R=>{
    if (!M) return R;
    const [a, b, c, d, e, f, g, h, i] = M, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
    const Mi = [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det];
    const mul = (P, Q) => [0, 1, 2].flatMap(r=> [0, 1, 2].map(cc=> P[3*r]*Q[cc] + P[3*r + 1]*Q[3 + cc] + P[3*r + 2]*Q[6 + cc]));
    return mul(mul(Mi, R), M).map(x=> Math.round(x));
  });
  for (const hh of cand){
    if (seen.has(hh.join())) continue;
    out.push(hh);
    for (const R of ops) seen.add([0, 1, 2].map(j=> hh[0]*R[j] + hh[1]*R[3 + j] + hh[2]*R[6 + j]).join());
  }
  return out;
}
const textureCandidates = lowIndexPlanes;
/* The March–Dollase weight of every member of every reflection at r (mean 1 over the
   sphere): (r²·cos²α + sin²α/r)^(−3/2), α between the member and the texture axis — r
   under 1 for plates lying on the axis's planes, over 1 for needles. null at r = 1. */
function textureWeights(q, v){
  if (q.iPO == null || !q.poHkl) return null;
  const r = v[q.iPO];
  if (Math.abs(r - 1) < 1e-12) return null;
  const a = textureAxis(q), r2 = r*r;
  return q.mv.map(mv=>{
    const m = mv.length/3, o = new Float64Array(m);
    for (let i = 0; i < m; i++){ const c = mv[3*i]*a[0] + mv[3*i + 1]*a[1] + mv[3*i + 2]*a[2], c2 = c*c; o[i] = Math.pow(r2*c2 + (1 - c2)/r, -1.5); }
    return o;
  });
}
// Is the free shape in use at v (any L or W ≠ 0)? Until the shape stage it is not, and
// the phase is drawn as an isotropic one.
function shapeActive(q, v){ const ix = q.iL || q.iW; return !!ix && ix.some(i=> v[i] !== 0); }
/* The shape's own Lorentzian width (°, before the 1/cosθ) of every member of every
   reflection at v: |Lᵀu| for the ellipsoid; for a body, ¾·|t|/<L>_V,base(t) with
   t = W∘(Rotᵀu) — the sphere-calibrated width of its column length.
   A flat face makes the column length kink (linear in the tilt) where the direction
   lies in that face, and along a cylinder's axis; every member of a family lying in a
   face is then a V-shaped valley of χ² in the orientation, which least squares cannot
   settle into (a disc on the user's SrTiO3 stopped at χ² from 6364 to 6427 depending on
   where it started). For the search alone (freeShape sets model.shapeSoft, for the
   phase searched) the faces are rounded off over that much of direction — each
   component of Rotᵀu read as √(x² + soft²), before the dimensions scale it. It is not
   the solid's: a thin body's columns in its plane are cut short by any tilt (a
   26 × 2.34 nm disc's by 13 % at 2°), so the result is refined, and every number
   reported, with the exact solid. */
const SHAPE_SOFT = Math.sin(2*D2R);
/* Every member's t = W∘(Rotᵀu) (°: the dimensions as sphere widths along the member's
   direction in the body's axes, the faces rounded off for the search): the size is the
   body's along it, its extent along u being Kλ/(|t|·π/180) times the base body's. */
function shapeTs(model, q, v){
  const B = BODIES[q.shapeType], R = bodyFrame(q, v), [Wx, Wy, Wz] = B.axes(q.iW.map(i=> v[i]));
  // (only the phase searched: another's kept shape is drawn exact meanwhile)
  const sf = B.base === 'ball' || !model.shapeSoft || model.shapeSoft.q !== q ? 0 : model.shapeSoft.soft, e2 = sf*sf, soft = x => e2 ? Math.sqrt(x*x + e2) : x;
  return q.mv.map(mv=>{
    const out = new Float64Array(mv.length);
    for (let i = 0; i < mv.length/3; i++){
      const u1 = mv[3*i], u2 = mv[3*i + 1], u3 = mv[3*i + 2];
      // Rotᵀu: the member's direction in the body's axes, its faces rounded off.
      out[3*i] = Wx*soft(R[0]*u1 + R[3]*u2 + R[6]*u3); out[3*i + 1] = Wy*soft(R[1]*u1 + R[4]*u2 + R[7]*u3); out[3*i + 2] = Wz*soft(R[2]*u1 + R[5]*u2 + R[8]*u3);
    }
    return out;
  });
}
function shapeWidths(model, q, v){
  if (q.iL){
    const [l11, l21, l22, l31, l32, l33] = q.iL.map(i=> v[i]);
    return q.mv.map(mv=>{
      const out = new Float64Array(mv.length/3);
      for (let i = 0; i < out.length; i++){
        const u1 = mv[3*i], u2 = mv[3*i + 1], u3 = mv[3*i + 2];
        out[i] = Math.hypot(l11*u1 + l21*u2 + l31*u3, l22*u2 + l32*u3, l33*u3);
      }
      return out;
    });
  }
  const base = BODIES[q.shapeType].base;
  return shapeTs(model, q, v).map(t=>{
    const out = new Float64Array(t.length/3);
    for (let i = 0; i < out.length; i++){
      const tt = [t[3*i], t[3*i + 1], t[3*i + 2]], n = Math.hypot(tt[0], tt[1], tt[2]);
      out[i] = n > 0 ? 0.75*n/columnLengthV(base, tt) : 0;
    }
    return out;
  });
}
function shapeMatrix(L){
  const [l11, l21, l22, l31, l32, l33] = L;
  return [l11*l11, l11*l21, l11*l31,  l11*l21, l21*l21 + l22*l22, l21*l31 + l22*l32,  l11*l31, l21*l31 + l22*l32, l31*l31 + l32*l32 + l33*l33];
}
// Eigen-decomposition of a symmetric 3×3 (row-major) by Jacobi rotations, largest first.
function eigSym3(S){
  const a = [[S[0], S[1], S[2]], [S[3], S[4], S[5]], [S[6], S[7], S[8]]], V = [[1,0,0],[0,1,0],[0,0,1]];
  for (let sw = 0; sw < 60; sw++){
    let off = 0;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) off += a[p][q]*a[p][q];
    if (off < 1e-30) break;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++){
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = 0.5*Math.atan2(2*a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++){ const x = a[k][p], y = a[k][q]; a[k][p] = c*x - s*y; a[k][q] = s*x + c*y; }
      for (let k = 0; k < 3; k++){ const x = a[p][k], y = a[q][k]; a[p][k] = c*x - s*y; a[q][k] = s*x + c*y; }
      for (let k = 0; k < 3; k++){ const x = V[k][p], y = V[k][q]; V[k][p] = c*x - s*y; V[k][q] = s*x + c*y; }
    }
  }
  return [0, 1, 2].map(i=> ({ val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] })).sort((x, y)=> y.val - x.val);
}
/* The simplest lattice directions (indices up to 3, conventional cell) within tolDeg of
   the plane normal to the unit vector n: { uvw, vec } in the frame op R0 (lattDirection's
   R). count 2: two about perpendicular to each other — the crystal's directions across
   a body of revolution's axis (or a plate's normal), which the drawing shows; more: the
   candidates for a held body's second axis (freeShape). */
function latticeAcross(q, n, R0, tolDeg = 5, count = 2){
  const B = q.Bm, M = q.constraint && q.constraint.basis;
  const inv = m => { const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
    return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det]; };
  const Bi = inv(B), gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a), lim = Math.sin(tolDeg*D2R);
  const cand = [];
  for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) for (let w = -3; w <= 3; w++){
    if ((!u && !v && !w) || gcd(gcd(u, v), w) !== 1) continue;
    const t = M ? [M[0]*u + M[1]*v + M[2]*w, M[3]*u + M[4]*v + M[5]*w, M[6]*u + M[7]*v + M[8]*w] : [u, v, w];
    const c = [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]], cn = Math.hypot(...c);
    const vec = c.map(x=> x/cn);
    if (Math.abs(vec[0]*n[0] + vec[1]*n[1] + vec[2]*n[2]) < lim) cand.push({ tc: [u, v, w], vec, cx: u*u + v*v + w*w });
  }
  cand.sort((a, b)=> a.cx - b.cx);
  const out = [];
  for (const c of cand){
    if (out.length === count) break;
    if (out.length && count === 2 && Math.abs(c.vec[0]*out[0].vec[0] + c.vec[1]*out[0].vec[1] + c.vec[2]*out[0].vec[2]) > lim) continue;
    if (out.some(o=> Math.abs(o.vec[0]*c.vec[0] + o.vec[1]*c.vec[1] + o.vec[2]*c.vec[2]) > 0.999)) continue;
    out.push(c);
  }
  const canon = t => t.find(x=> x !== 0) < 0 ? t.map(x=> -x) : t;
  return out.map(({ tc, vec })=> ({ uvw: '[' + idxText(canon(R0 ? [0, 1, 2].map(r=> R0[3*r]*tc[0] + R0[3*r + 1]*tc[1] + R0[3*r + 2]*tc[2]) : tc)) + ']', vec }));
}
// A turn by phi about the unit axis n (row-major).
function turnAbout(n, phi){
  const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
  return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C];
}
/* turnEsds(model, v, res, about, turn, names) → for each axis b in `about`, the turn
   (rad) of the solid about it that raises χ² by χ²_ν (both senses, averaged; NaN beyond
   60°), with the refined parameters names(b) — the solid's sizes, the scale, the
   background, the strain — refined again at each turn: a profile of χ² in the turn.
   Linear esds do not serve here: where the axes lie on symmetric directions a turn has
   no first-order effect (the members' changes cancel over a family) and the flat faces
   make χ² kink, so (JᵀWJ)⁻¹ gave 30° to 10⁹° for axes the data fix within a few
   degrees; and a turn with the sizes held was too dear — the sizes take up part of it
   (on a synthetic disc ±0.26° held against about 2°, the truth 15 of those σ away).
   Turns of 1, 2, 4… up to 60°: σ where χ² first rises by χ²_ν, interpolated between the
   last two (from the first trial over it alone, by θ·√(χ²_ν/Δ), a broad valley read as
   the narrow notch of χ² at a lattice orientation: esds 1.7× too small). names(b) may
   also free the turns about the other axes: the valley of χ² runs obliquely between
   them, and with those held a solid's axes were found 1.6× further from the truth than
   their esds said (1.15× with them free, over 28 axes of synthetic solids; the rest is
   a second valley nearly as deep, which a profile does not see). An axis i's esd is
   then √((σ_j² + σ_k²)/2) over the turns that tilt it. The model is left as it was. */
function turnEsds(model, v, res, about, turn, names){
  if (!res || !res.stats) return about.map(()=> NaN);
  const keep = { v: model.v.slice(), esd: model.esd, cov: model.cov };
  const chiAt = (vv, free) => {
    setParams(model, vv);
    try { refine(model, { free, maxIter: 4, audit: false }); } catch(e){ return Infinity; }
    return evaluate(model, model.v).chi2;
  };
  try {
    const target = Math.max(1, res.stats.chi2);
    const side = (b, sg, c0) => {
      let t0 = 0, d0 = 0;
      for (const deg of [1, 2, 4, 8, 16, 32, 60]){
        const th = deg*D2R, d = chiAt(turn(b, sg*th), names(b)) - c0;
        // Past χ²_ν already at the first turn: as a parabola from 0 (on the safe side
        // if χ² rises as |θ|); later, between the last two turns.
        if (d >= target) return t0 ? t0 + (th - t0)*(target - d0)/Math.max(1e-12, d - d0) : th*Math.sqrt(target/d);
        t0 = th; d0 = Math.max(0, d);
      }
      return NaN;
    };
    return about.map(b=> { const c0 = chiAt(turn(b, 0), names(b)); return (side(b, 1, c0) + side(b, -1, c0))/2; });
  } finally {
    setParams(model, keep.v); model.esd = keep.esd; model.cov = keep.cov;
  }
}
/* shapeOf(model, params, k, res?) → the phase's free shape, or null when not in use:
   for a body (spheroid, cylinder, elliptic cylinder, box) bodyShapeOf's; for the
   ellipsoid { type, kind: 'plate' | 'needle' | 'triaxial' | 'isometric' |
   'anisotropic', axes: [{ D, Desd (nm), dir: [u,v,w], label: '⟨110⟩' | '[001]', uvw,
   angle (° from that direction), vec, e, esdAngle (°), resolved, group }] from the
   shortest to the longest, groups: [{ axes: [i, j(, k)], D, Desd }], across, solid }.
   D = Kλ/(Ys_i·π/180), K = 0.9, along the principal axes of S: the ellipsoid's full
   axes, in the isotropic size's calibration (a sphere's diameter). Angular esds by
   profile (turnEsds).
   esds: the width along a fixed axis e is √(eᵀSe), its variance gᵀ·cov(L)·g with
   g = ∂(eᵀSe)/∂L; blind to a turn of the axes (eᵀ(ΩS − SΩ)e = 0, Ω antisymmetric),
   where a sorted eigenvalue's gradient is not. Where two axes' widths do not differ by
   2σ they are one group: near such a pair (a needle's cross-section, a plate's plane)
   the shape can split the pair or tilt it with no first-order effect on the pattern,
   so those directions of L have esds far beyond the shape's own size (232 against
   |L| = 2.2 on a synthetic needle), and an axis drawn anywhere in the pair's plane takes
   them in: 5.1(25.4) nm for a cross-section scattering by 0.3 nm in repeated draws. The
   group's mean width, ½ or ⅓ of the trace of S over its axes, is unchanged by any turn
   or split within the group: its esd is free of them, and the group is reported as
   that mean (the axes' own D are kept, with no esd and no direction: resolved false).
   The remaining axis is compared with the group's mean. An axis's esd can still be
   large, on the safe side, where the linear propagation does not hold — the longest
   axis is the least bounded, and noise spreading the axes makes it come out long.
   Kind: a plate is one size under half the other two (or under half a group of two), a
   needle one over twice the other two, triaxial each under half the next; sizes within
   20 % are isometric. Directions are lattice directions [uvw] (lattDirection), in one
   frame for the three axes: the Laue operation that makes the most telling axis's
   direction the family's first member is applied to the other two. */
function shapeOf(model, params, k, res){
  const q = model.phases[k], v = vectorOf(model, params);
  if (!shapeActive(q, v)) return null;
  if (!q.iL) return bodyShapeOf(model, v, k, res);
  const lam = model.lines[0].lam;
  const L0 = q.iL.map(i=> v[i]), ys = v[q.iYs];
  const [l11, l21, l22, l31, l32, l33] = L0;
  let C = null;
  if (res && res.cov && res.free){
    const ix = q.iL.map(i=> res.free.indexOf(model.par[i].name));
    if (ix.every(i=> i >= 0)) C = ix.map(a=> ix.map(b=> res.cov[a][b]));
  }
  const Dof = w => K_SCHERRER*lam/(Math.max(w, 1e-10)*D2R)/10;
  // ∂(eᵀSe)/∂L for a fixed e, with Lᵀe = t.
  const LtOf = e => [l11*e[0] + l21*e[1] + l31*e[2], l22*e[1] + l32*e[2], l33*e[2]];
  const gradOf = (e, t) => [2*e[0]*t[0], 2*e[1]*t[0], 2*e[1]*t[1], 2*e[2]*t[0], 2*e[2]*t[1], 2*e[2]*t[2]];
  const sdOf = g => { if (!C) return NaN; let s2 = 0; for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) s2 += g[a]*g[b]*C[a][b]; return Math.sqrt(Math.max(0, s2)); };
  // The isotropic Ys adds to every direction's width: in the principal frame of S too.
  const axes = eigSym3(shapeMatrix(L0)).map(({ vec: e })=>{
    const t = LtOf(e), r = Math.hypot(...t), w = ys + r;
    const wEsd = r > 0 ? sdOf(gradOf(e, t))/(2*r) : NaN, D = Dof(w);
    return { e, w, wEsd, D, Desd: D*wEsd/w };
  }).sort((a, b)=> a.D - b.D);
  // A group's mean width and its esd: from the mean of eᵀSe over its axes.
  const groupOf = idx => {
    let val = 0; const g = [0, 0, 0, 0, 0, 0];
    for (const i of idx){ const e = axes[i].e, t = LtOf(e); val += t[0]*t[0] + t[1]*t[1] + t[2]*t[2]; gradOf(e, t).forEach((x, a)=> { g[a] += x; }); }
    val /= idx.length; g.forEach((x, a)=> { g[a] = x/idx.length; });
    const r = Math.sqrt(val), w = ys + r, wEsd = r > 0 ? sdOf(g)/(2*r) : NaN, D = Dof(w);
    return { axes: idx, w, wEsd, D, Desd: D*wEsd/w };
  };
  // Widths told apart: by 2σ; without esds, by their values alone.
  const z = (x, y) => { const s = Math.hypot(x.wEsd, y.wEsd); return Number.isFinite(s) && s > 0 ? Math.abs(x.w - y.w)/s : Infinity; };
  const groups = [];
  const zab = z(axes[0], axes[1]), zbc = z(axes[1], axes[2]);
  if (Math.min(zab, zbc) < 2){
    const pair = zab <= zbc ? [0, 1] : [1, 2], rest = zab <= zbc ? 2 : 0;
    const G = groupOf(pair);
    groups.push(z(G, axes[rest]) < 2 ? groupOf([0, 1, 2]) : G);
  }
  const inGroup = i => groups.some(g=> g.axes.includes(i));
  // The sizes the kind is read from: a group's mean for each of its axes.
  const Ds = axes.map((a, i)=> { const g = groups.find(g=> g.axes.includes(i)); return g ? g.D : a.D; });
  const [a, b, c] = Ds;
  const kind = groups.some(g=> g.axes.length === 3) || a/c > 0.8 ? 'isometric'
    : a/b < 0.5 && b/c < 0.5 ? 'triaxial'
    : a/b < 0.5 ? 'plate'
    : b/c < 0.5 ? 'needle' : 'anisotropic';
  // The axes' angular esds, linear (the ellipsoid is smooth, with no faces to kink χ²):
  // a principal axis turns towards another by eⱼᵀδS eᵢ/(λᵢ − λⱼ), with ∂(eⱼᵀSeᵢ)/∂L
  // from tⱼ·tᵢ, the variances from the covariance of L — the turn with every other
  // parameter free. As √((σ_j² + σ_k²)/2) over its two tilts; none for an axis in a group
  // (its direction is free).
  const lamOf = x => { const t = LtOf(x.e); return t[0]*t[0] + t[1]*t[1] + t[2]*t[2]; };
  const turnEsd = i => {
    if (!C || inGroup(i)) return NaN;
    const ei = axes[i].e, ti = LtOf(ei), s2 = [];
    for (let j = 0; j < 3; j++){
      if (j === i) continue;
      const ej = axes[j].e, tj = LtOf(ej);
      const g = [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2]].map(([a, b])=> ej[a]*ti[b] + ei[a]*tj[b]);
      s2.push(sdOf(g)**2/(lamOf(axes[i]) - lamOf(axes[j]))**2);
    }
    return Math.sqrt((s2[0] + s2[1])/2)*R2D;
  };
  const dirs = axes.map(x=> lattDirection(q, x.e));
  const e0 = axes[0].e, e1 = axes[1].e;
  // Two axes not told apart: the solid is one of revolution about the third, and the
  // crystal's directions across that axis are drawn for orientation — all in that
  // axis's lattice frame (else a needle's or a plate's, by its telling axis).
  const pair = groups.find(g=> g.axes.length === 2), lone = pair ? [0, 1, 2].find(i=> !pair.axes.includes(i)) : -1;
  const ref = lone >= 0 ? lone : kind === 'needle' ? 2 : 0;
  return { type: 'ellipsoidL', kind, groups: groups.map(g=> ({ axes: g.axes, D: g.D, Desd: g.Desd })),
    across: lone >= 0 ? latticeAcross(q, dirs[lone].vec, dirs[lone].R).map(d=> ({ ...d, esdAngle: turnEsd(lone) })) : [],
    axes: framedAxes(dirs, ref).map((d, i)=>{
      const grouped = inGroup(i);
      return { ...d, D: axes[i].D, Desd: grouped ? NaN : axes[i].Desd, e: axes[i].e, esdAngle: turnEsd(i),
               resolved: !grouped, group: grouped ? groups.findIndex(g=> g.axes.includes(i)) : -1 };
    }),
    // For drawing: the full axes along a right-handed frame of the principal axes.
    solid: { type: 'ellipsoid', dims: axes.map(x=> x.D), frame: [e0, e1, [e0[1]*e1[2] - e0[2]*e1[1], e0[2]*e1[0] - e0[0]*e1[2], e0[0]*e1[1] - e0[1]*e1[0]]], cell: cellAxes(q, dirs[ref].R) } };
}
// The lattice directions of a solid's axes in one frame: the Laue operation that makes
// the reference axis's direction its family's first member, applied to the others too
// (two of one family, a plate's [110] normal and its [1-10] width, then read apart).
function framedAxes(dirs, ref){
  const R0 = dirs[ref].R, canon = t => t.find(x=> x !== 0) < 0 ? t.map(x=> -x) : t;
  return dirs.map((d, i)=>{
    const t = d.tc, dir = i === ref ? d.dir : canon([0, 1, 2].map(r=> R0[3*r]*t[0] + R0[3*r + 1]*t[1] + R0[3*r + 2]*t[2]));
    return { dir, label: d.family ? d.label : '[' + idxText(dir) + ']', uvw: '[' + idxText(dir) + ']', angle: d.angle, vec: d.vec };
  });
}
/* A body's shape (spheroid, cylinder, elliptic cylinder, box): { type, kind, dims:
   [{ name, D, Desd }], axes: [{ role, D?, e, dir, label, uvw, angle, vec, esdAngle,
   resolved }], solid: { type, dims, frame, cell (the cell's a, b, c: cellAxes) } }. Its dimensions D = Kλ/(W·π/180) with
   esds from W's; the axes whose directions it has (a body of revolution only its own
   axis), each with its angular esd (turnEsds). */
function bodyShapeOf(model, v, k, res){
  const q = model.phases[k], type = q.shapeType, B = BODIES[type], lam = model.lines[0].lam;
  const Dof = W => W > 0 ? K_SCHERRER*lam/(W*D2R)/10 : Infinity;
  const names = [...q.iW, ...q.iR].map(i=> model.par[i].name);
  const ix = res && res.free ? names.map(nm=> res.free.indexOf(nm)) : null;
  const cov = (a, b) => ix && res.cov && ix[a] >= 0 && ix[b] >= 0 ? res.cov[ix[a]][ix[b]] : NaN;
  const W = q.iW.map(i=> v[i]), nW = W.length;
  // A width on its bound 0 is a dimension with no broadening along it: unbounded, but
  // at least Dmin (from W + 2σ).
  // Held on the lattice (freeShape's info): the free fit's sizes and axes are as
  // likely, so the difference from them is added to the esds — the held refinement's
  // own covariance lacks the orientation (sizes 5–11σ off where the frame was wrong).
  const info = res && res.shapes ? res.shapes[q.id] : null, held = !!(info && info.held);
  const dimsOf = W.map((w, i)=> { const D = Dof(w), s = Math.sqrt(cov(i, i));
    const Dmin = Number.isFinite(D) || !(s > 0) ? NaN : Dof(w + 2*s);
    let Desd = w > 0 ? D*s/w : NaN;
    if (held && info.freeW && Number.isFinite(D)) Desd = Math.hypot(Desd, D - Dof(info.freeW[i]));
    // An unbounded dimension's lower limit, when it says anything (≥ 1 nm).
    return { D, Desd, Dmin: Dmin >= 1 ? Dmin : NaN }; });
  const R = bodyFrame(q, v), col = i => [R[i], R[3 + i], R[6 + i]];
  // The axes' angular esds, by profile (turnEsds): the body turned about its own axes
  // (a body of revolution: not about its own).
  const mulM = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const about = q.iR.length === 2 ? [0, 1] : [0, 1, 2];
  // Refined again at each turn: the sizes, the strain, the scales, the background and
  // a preferred orientation.
  // The turns about the other axes too, from the turned frame (r = 0 there).
  const reopt = res && res.free ? res.free.filter(nm=> { const p = model.par[model.index[nm]]; return p && (p.linear || p.kind === 'texture' || q.iW.includes(model.index[nm]) || nm === q.pfx + 'Xs'); }) : [];
  const sigP = turnEsds(model, v, res, about, (b, phi)=>{
    const vv = v.slice(), e = [0, 0, 0]; e[b] = 1;
    q.iR.forEach(i=> { vv[i] = 0; });
    quatOfMat(mulM(R, turnAbout(e, phi))).forEach((t, i)=> { vv[q.iQ[i]] = t; });
    return vv;
  }, b=> reopt.concat(q.iR.filter((_, j)=> j !== b).map(i=> model.par[i].name)));
  const sig = [0, 1, 2].map(b=> about.includes(b) ? sigP[about.indexOf(b)] : NaN);
  const tiltEsd = i => { const [j, l] = [0, 1, 2].filter(t=> t !== i), e = Math.sqrt((sig[j]**2 + sig[l]**2)/2)*R2D;
    return held && info.freeOff && Number.isFinite(e) ? Math.max(e, info.freeOff[i]) : e; };
  // The body's dimensions along x, y, z, and which axes have directions of their own.
  const [Dx, Dy, Dz] = B.axes(dimsOf.map(d=> d.D));
  const roles = type === 'spheroid' ? [['axis', 2]] : type === 'cylinder' ? [['axis', 2]] : type === 'ellcyl' ? [['axis', 2], ['a', 0], ['b', 1]] : [['a', 0], ['b', 1], ['c', 2]];
  const dimNames = { ellipsoid: ['a', 'b', 'c'], spheroid: ['equatorial', 'polar'], cylinder: ['diameter', 'height'], ellcyl: ['a', 'b', 'height'], box: ['a', 'b', 'c'] }[type];
  const dims = dimsOf.map((d, i)=> ({ name: dimNames[i], ...d }));
  const dimAlong = [Dx, Dy, Dz], dimEsdAlong = B.axes(dimsOf.map(d=> d.Desd)), dimMinAlong = B.axes(dimsOf.map(d=> d.Dmin));
  const widthW = i => B.axes(W)[i];
  // Two dimensions not told apart (widths within 2σ) make a solid of revolution about
  // the third axis: the turn about it is free, and the pair have no directions — an
  // elliptic cylinder's circular cross-section, an ellipsoid's pair, a spheroid or a
  // cylinder as wide as it is long (no axis at all). A box's edges always have theirs
  // (a square turned is another solid): whether the data fix them is its angular
  // esd's to say. An axis is shown with a direction only under 30° of esd.
  // Apart: the difference of two widths over its esd, their covariance included (a
  // body of revolution's two axes across share one width).
  const wIx = B.rot === 2 ? [0, 0, 1] : [0, 1, 2];
  const zr = (i, j) => { const a = wIx[i], b = wIx[j];
    // A width on its bound 0 (no broadening along it) has no curvature there, and its
    // linear esd means nothing (±14606° for a spheroid's unbounded equator in a test fit
    // of the user's 37D SrTiO3, which made a plate 2.5 nm thick a near-sphere): the
    // other's own esd says whether they differ.
    if ((W[a] > 0) !== (W[b] > 0)){ const o = W[a] > 0 ? a : b, so = Math.sqrt(cov(o, o)); return Number.isFinite(so) && so > 0 ? W[o]/so : Infinity; }
    const s = Math.sqrt(cov(a, a) + cov(b, b) - 2*cov(a, b));
    return Number.isFinite(s) && s > 0 ? Math.abs(widthW(i) - widthW(j))/s : Infinity; };
  const apart = (i, j) => zr(i, j) > 2;
  const round = B.rot === 2 && !apart(0, 2);
  // Dimensions not told apart, of a kind the solid can swap (an ellipsoid's axes, a
  // box's edges, an elliptic cylinder's cross-section): their mean is measured, and
  // each alone is not. Swapping them has no first-order effect, so their widths are
  // anticorrelated (−1.0000): a 12 × 12 nm box section on a fourfold axis read 13(107)
  // and 13(106) nm, its mean 12.80(42). The group's mean width and its esd come from
  // the full covariance, as the v420 ellipsoid's groups; the members' own esds are
  // dropped. The closest pair first, then the third against the pair's mean (against
  // each alone, the pair's huge esds had grouped a 4 nm edge with them). (Here a body's
  // axes are its widths', B.axes the identity.)
  const groups = [];
  if (type === 'ellipsoid' || type === 'box' || type === 'ellcyl'){
    const swap = type === 'ellcyl' ? [[0, 1]] : [[0, 1], [0, 2], [1, 2]];
    const near = swap.filter(([i, j])=> W[i] > 0 && W[j] > 0 && !apart(i, j)).sort((x, y)=> zr(...x) - zr(...y));
    if (near.length){
      let g = near[0];
      const k = [0, 1, 2].find(i=> !g.includes(i));
      if (type !== 'ellcyl' && W[k] > 0){
        // the third's width less the pair's mean, and its variance
        const d = W[k] - (W[g[0]] + W[g[1]])/2;
        const v = cov(k, k) + (cov(g[0], g[0]) + cov(g[1], g[1]) + 2*cov(g[0], g[1]))/4 - cov(k, g[0]) - cov(k, g[1]);
        if (!(Math.abs(d) > 2*Math.sqrt(v))) g = [0, 1, 2];
      }
      const n = g.length, w = g.reduce((t, i)=> t + W[i], 0)/n;
      let c = 0; for (const i of g) for (const j of g) c += cov(i, j);
      const D = Dof(w), sd = Math.sqrt(Math.max(0, c))/n;
      let Desd = D*sd/w;
      if (held && info.freeW) Desd = Math.hypot(Desd, D - Dof(g.reduce((t, i)=> t + info.freeW[i], 0)/n));
      for (const i of g){ dims[i].Desd = NaN; dims[i].group = 0; }
      groups.push({ axes: g, D, Desd });
    }
  }
  const groupOf = i => groups.findIndex(g=> g.axes.includes(i));
  // An axis has a direction of its own unless the turn about another is free: a box's
  // edges always have theirs (a square turned is another solid; whether the data fix
  // them is its angular esd's to say).
  const own = i => type === 'ellipsoid' || (type === 'ellcyl' && i < 2) ? groupOf(i) < 0 : type === 'box' || !round;
  // The reference for the lattice frame: the body's axis, an ellipsoid's lone axis, or
  // its (a box's) shortest.
  const shortest = [0, 1, 2].sort((a, b)=> dimAlong[a] - dimAlong[b])[0];
  const refAxis = type === 'box' ? shortest : type === 'ellipsoid' ? ([0, 1, 2].filter(own).length === 1 ? [0, 1, 2].find(own) : shortest) : 2;
  const order = roles.map(([, i])=> i), dirs = order.map(i=> lattDirection(q, col(i), held));
  const refIx = Math.max(0, order.indexOf(refAxis)), framed = framedAxes(dirs, refIx);
  const axes = roles.map(([role, i], n)=> { const esdAngle = tiltEsd(i);
    return { role, axis: i, ...framed[n], D: dimAlong[i], Desd: groupOf(i) >= 0 ? NaN : dimEsdAlong[i], Dmin: dimMinAlong[i], e: col(i), esdAngle, group: groupOf(i), own: own(i),
      resolved: own(i) && Number.isFinite(esdAngle) && esdAngle <= 30 }; });
  // The kind: a body of revolution flat or long; a box like the ellipsoid.
  // A box or an elliptic cylinder by its three dimensions, as the ellipsoid (a thin
  // elliptic cylinder is a plate whichever of its dimensions is the thin one).
  let kind;
  if (type === 'box' || type === 'ellcyl' || type === 'ellipsoid'){
    const [a, b, c] = dimAlong.slice().sort((x, y)=> x - y);
    const same = type === 'ellipsoid' && groups.some(g=> g.axes.length === 3);
    kind = same || a/c > 0.8 ? (type === 'ellipsoid' ? 'isometric' : 'equant') : a/b < 0.5 && b/c < 0.5 ? 'triaxial' : a/b < 0.5 ? 'plate' : b/c < 0.5 ? 'needle' : 'anisotropic';
  } else {
    const same = zr(0, 2) < 2;
    kind = same || Math.min(Dz, Dx)/Math.max(Dz, Dx) > 0.8 ? (type === 'spheroid' ? 'near-sphere' : 'equant') : Dz < Dx ? (type === 'spheroid' ? 'oblate' : 'disc') : (type === 'spheroid' ? 'prolate' : 'rod');
  }
  // Across the axis: the crystal's directions normal to the axis's lattice direction
  // (normal to the axis itself, [1-10] of a disc 7° off [110] fell outside the 5°).
  // (an ellipsoid's lone axis likewise, when its pair is not told apart).
  const lone = type === 'ellipsoid' && [0, 1, 2].filter(own).length === 1 ? [0, 1, 2].find(own) : -1;
  const across = B.rot === 2 && axes[0].resolved ? latticeAcross(q, dirs[0].vec, dirs[0].R).map(d=> ({ ...d, esdAngle: tiltEsd(2) }))
    : lone >= 0 && axes[order.indexOf(lone)].resolved ? latticeAcross(q, dirs[order.indexOf(lone)].vec, dirs[order.indexOf(lone)].R).map(d=> ({ ...d, esdAngle: tiltEsd(lone) })) : [];
  return { type, kind, dims, groups, axes, across, solid: { type, dims: [Dx, Dy, Dz], frame: [col(0), col(1), col(2)], cell: cellAxes(q, dirs[refIx].R) } };
}
const idxText = t => t.map(x=> x < 0 ? '-' + (-x) : String(x)).join('');
/* lattDirection(q, e) → { dir, label, angle, tc, R, family, vec }: the lattice direction
   [uvw] of a Cartesian unit vector e, u ∝ Bᵀe, in the conventional cell when there is
   one. The simplest small-integer direction (least u² + v² + w², indices up to 4)
   within SNAP_DEG of e, else the nearest: an axis found 2–9° from [111] was named
   ⟨433⟩, ⟨332⟩ or ⟨443⟩ by the nearest alone — noise read as a precise high-index
   direction; the angle says how far off it is. dir is the first member of its family
   under the Laue group (fewest negative indices, then the largest), R the operation
   that takes tc (the direction found) to it; vec the direction found, Cartesian.
   exact: an axis held on a lattice direction is named by that direction (a cylinder
   held on [301] had read "held 8.1° off [201]", the simpler one within 10°). */
const SNAP_DEG = 10;
function lattDirection(q, e, exact = false){
  const B = q.Bm;
  // Cartesian of a direction t (file basis): A·t with A = (B⁻¹)ᵀ; the angle is taken there.
  const inv = m => { const [a, b, c, d, e2, f, g, h, i] = m, A = e2*i - f*h, Bc = -(d*i - f*g), C = d*h - e2*g, det = a*A + b*Bc + c*C;
    return [A/det, -(b*i - c*h)/det, (b*f - c*e2)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e2 - b*d)/det]; };
  const Binv = inv(B), cart = t => [Binv[0]*t[0] + Binv[3]*t[1] + Binv[6]*t[2], Binv[1]*t[0] + Binv[4]*t[1] + Binv[7]*t[2], Binv[2]*t[0] + Binv[5]*t[1] + Binv[8]*t[2]];
  const M = q.constraint && q.constraint.basis, Mi = M ? inv(M) : null;
  let near = null, low = null;
  for (let u = -4; u <= 4; u++) for (let w2 = -4; w2 <= 4; w2++) for (let x = -4; x <= 4; x++){
    if (!u && !w2 && !x) continue;
    // a candidate in the conventional cell's indices, taken to the file's basis (t = M·t_c)
    const tc = [u, w2, x], t = M ? [M[0]*u + M[1]*w2 + M[2]*x, M[3]*u + M[4]*w2 + M[5]*x, M[6]*u + M[7]*w2 + M[8]*x] : tc;
    const c = cart(t), n = Math.hypot(...c), cosA = Math.abs(c[0]*e[0] + c[1]*e[1] + c[2]*e[2])/n;
    const angle = Math.acos(Math.min(1, cosA))*R2D, cx = u*u + w2*w2 + x*x;
    if (!near || angle < near.angle - 1e-6 || (Math.abs(angle - near.angle) <= 1e-6 && cx < near.cx)) near = { tc, angle, cx };
    if (angle <= SNAP_DEG && (!low || cx < low.cx || (cx === low.cx && angle < low.angle))) low = { tc, angle, cx };
  }
  const best = exact && near.angle < 0.01 ? near : low || near;
  // The direction found, as a Cartesian unit vector on e's side (for drawing it).
  const bt = M ? [M[0]*best.tc[0] + M[1]*best.tc[1] + M[2]*best.tc[2], M[3]*best.tc[0] + M[4]*best.tc[1] + M[5]*best.tc[2], M[6]*best.tc[0] + M[7]*best.tc[1] + M[8]*best.tc[2]] : best.tc;
  const bc = cart(bt), bn = Math.hypot(...bc), sg = bc[0]*e[0] + bc[1]*e[1] + bc[2]*e[2] < 0 ? -1 : 1, vec = bc.map(x=> sg*x/bn);
  const g = (a, b) => b ? g(b, a % b) : Math.abs(a);
  const d0 = best.tc.reduce((a, b)=> g(a, b)), t0 = best.tc.map(x=> x/d0);
  // The first member of its orbit under the Laue group (ops act on directions as R·t; in
  // the conventional cell's indices the operations are M⁻¹·R·M).
  const mul = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const ops = (q.laue || []).map(R=> M ? mul(mul(Mi, R), M).map(x=> Math.round(x)) : R);
  const orbit = new Map();
  for (const R of (ops.length ? ops : [[1,0,0,0,1,0,0,0,1], [-1,0,0,0,-1,0,0,0,-1]])){
    const r = [R[0]*t0[0] + R[1]*t0[1] + R[2]*t0[2], R[3]*t0[0] + R[4]*t0[1] + R[5]*t0[2], R[6]*t0[0] + R[7]*t0[1] + R[8]*t0[2]];
    if (!orbit.has(r.join())) orbit.set(r.join(), { r, R });
  }
  const nice = [...orbit.values()].sort(({ r: a }, { r: b })=> (a.filter(x=> x < 0).length - b.filter(x=> x < 0).length) || (b[0] - a[0]) || (b[1] - a[1]) || (b[2] - a[2]))[0];
  const family = orbit.size > 2;
  return { dir: nice.r, label: family ? '⟨' + idxText(nice.r) + '⟩' : '[' + idxText(nice.r) + ']', angle: best.angle, tc: t0, R: nice.R, family, vec };
}

// The cell's a, b, c (the conventional cell's, when there is one) as Cartesian unit
// vectors, in the frame of the shape's axes and directions: the 3D view's reference.
// R0: the Laue operation the axes' labels were given in (framedAxes): a direction
// labelled [001] is R0 of the one found, so the c drawn is R0⁻¹ of the cell's own — else
// the triad's c pointed against the solid's "[001]".
function cellAxes(q, R0){
  const B = q.Bm, M = q.constraint && q.constraint.basis;
  const inv = m => { const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
    return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det]; };
  const Bi = inv(B), cart = t => [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]];
  const Ri = R0 ? inv(R0) : null;
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e0=>{
    const tc = Ri ? [0, 1, 2].map(r=> Ri[3*r]*e0[0] + Ri[3*r + 1]*e0[1] + Ri[3*r + 2]*e0[2]) : e0;
    const t = M ? [M[0]*tc[0] + M[1]*tc[1] + M[2]*tc[2], M[3]*tc[0] + M[4]*tc[1] + M[5]*tc[2], M[6]*tc[0] + M[7]*tc[1] + M[8]*tc[2]] : tc;
    const c = cart(t), n = Math.hypot(...c);
    return c.map(x=> x/n);
  });
}

// Cartesian unit vectors of the low-index lattice directions [100], [110], [111] and
// their kin (all permutations, in the conventional cell when there is one), one per Laue
// family: the axes a plate's normal or a needle most often takes.
function lowIndexAxes(q){
  const B = q.Bm, M = q.constraint && q.constraint.basis;
  const inv = m => { const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
    return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det]; };
  const Bi = inv(B), cart = t => [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]];
  const cand = [[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,-1,0],[1,0,-1],[0,1,-1],[1,1,1]];
  const out = [], fams = new Set();
  for (const tc of cand){
    const t = M ? [M[0]*tc[0] + M[1]*tc[1] + M[2]*tc[2], M[3]*tc[0] + M[4]*tc[1] + M[5]*tc[2], M[6]*tc[0] + M[7]*tc[1] + M[8]*tc[2]] : tc;
    const c = cart(t), n = Math.hypot(...c), e = c.map(x=> x/n);
    const fam = lattDirection(q, e).label;
    if (fams.has(fam)) continue;
    fams.add(fam); out.push(e);
  }
  return out.slice(0, 5);
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
/* ---------- the phase's broadening and displacement options ----------
   p.profile: 'lorentz' (the size a Lorentzian of the right breadth, Scherrer's K = 0.9:
   the default), 'wppm' (Whole Powder Pattern Modelling: the solid's own profile, one
   size) or 'lognormal' (WPPM over a log-normal distribution of sizes, its width σ the
   parameter LS). p.strain: 'iso' or 'aniso' (Stephens: S1… the anisotropic parts of ε²,
   in 10⁻⁶). p.faults: '111:1/6<112>' — the fault planes' family and the displacement
   (FA the fault probability per plane). p.adp: 'cif' (the CIF's B, held), 'overall'
   (one ΔB, p.B), 'site' (B per crystallographic site, B_<label>) or 'aniso' (U^ij per
   site within its symmetry, U11_<label> …). */
const PROFILES = ['lorentz', 'wppm', 'lognormal'];
function faultOf(spec){
  const m = typeof spec === 'string' && spec.trim().match(/^(-?\d)\s*(-?\d)\s*(-?\d)\s*:\s*(\d+)\s*\/\s*(\d+)\s*<\s*(-?\d)\s*(-?\d)\s*(-?\d)\s*>$/);
  if (!m) return null;
  const plane = [+m[1], +m[2], +m[3]], f = +m[4]/+m[5], uvw = [+m[6], +m[7], +m[8]];
  if (!plane.some(x=> x) || !uvw.some(x=> x) || !(f > 0)) return null;
  return { plane, disp: { f, uvw }, text: spec.trim() };
}
// A Laue operation (file basis, on reflections as rows) as it acts on Cartesian
// diffraction vectors x = B·h: C = B·Rᵀ·B⁻¹.
function cartOp(B, R){
  const [b11, b12, b13, , b22, b23, , , b33] = B;
  const Bi = [1/b11, -b12/(b11*b22), (b12*b23 - b13*b22)/(b11*b22*b33), 0, 1/b22, -b23/(b22*b33), 0, 0, 1/b33];
  const Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
  const mul = (P, Q) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  return mul(mul(B, Rt), Bi);
}
function broadeningSetup(q, p, cell, list, add, nextIndex){
  const prof = PROFILES.includes(p.profile) ? p.profile : 'lorentz';
  q.wppm = prof !== 'lorentz';
  if (prof === 'lognormal'){ q.iLS = nextIndex(); add('LS', 0, 0, 1.5, 1e-4, { kind: 'dist' }); }
  if (p.strain === 'aniso'){
    memberVectors(q, p, cell, list);
    q.strainForms = quarticInvariants(q.laue.map(R=> cartOp(q.Bm, R)));
    q.iS = q.strainForms.map((_, j)=> { const i = nextIndex(); add('S' + (j + 1), 0, -1e4, 1e4, 1e-3, { kind: 'strain' }); return i; });
    // each reflection's forms, at its direction (fixed with the starting cell, as the members')
    const B = q.Bm;
    q.strainQ = list.map(r=> { const x = [B[0]*r.h + B[1]*r.k + B[2]*r.l, B[4]*r.k + B[5]*r.l, B[8]*r.l], n = Math.hypot(...x); return q.strainForms.map(c=> evalQuartic(c, x.map(t=> t/n))); });
  }
  const fs = faultOf(p.faults);
  if (fs){
    memberVectors(q, p, cell, list);
    const trans = (p.ops || []).filter(o=> o.R.every((x, i)=> x === [1,0,0, 0,1,0, 0,0,1][i]) && o.t.some(x=> x)).map(o=> o.t);
    q.faultSpec = fs;
    q.faultTab = faultTable({ Bm: q.Bm, M: p.constraint && p.constraint.basis, laue: q.laue, trans }, fs.plane, fs.disp, list.map(r=> [r.h, r.k, r.l]));
    q.iFA = nextIndex(); add('FA', 0, 0, 0.45, 1e-5, { kind: 'faults' });
  }
}
// Parameter labels from the atoms' (letters and digits only, each its own).
function siteLabels(atoms, refs){
  const used = new Set();
  return refs.map(j=>{
    const base = String(atoms[j].label || atoms[j].element || 'X').replace(/[^A-Za-z0-9]/g, '') || 'X';
    let lab = base, n = 2;
    while (used.has(lab)) lab = base + '_' + n++;
    used.add(lab);
    return lab;
  });
}
function adpSetup(q, p, cell, add, nextIndex){
  q.adp = ['overall', 'site', 'aniso'].includes(p.adp) ? p.adp : 'cif';
  if (q.adp !== 'site' && q.adp !== 'aniso') return;
  const atoms = q.atoms, orb = atomOrbits(cell, atoms, p.ops);
  q.orbit = orb.orbit; q.orbR = orb.R;
  const labels = siteLabels(atoms, orb.ref), { Gs } = metric(cell), Ns = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  q.sites = orb.ref.map((j, o)=>{
    const members = atoms.map((_, i)=> i).filter(i=> orb.orbit[i] === o);
    const Bs = members.map(i=> atoms[i].Biso).filter(Number.isFinite), B0 = Bs.length ? Bs.reduce((a, b)=> a + b, 0)/Bs.length : 0.5;
    const site = { label: labels[o], ref: j, members, element: atoms[j].element };
    if (q.adp === 'site'){ site.iB = nextIndex(); add('B_' + labels[o], B0, -2, 20, 1e-4, { kind: 'adp', site: o }); return site; }
    const a = atoms[j], basis = siteAdpBasis(cell, p.ops, [a.x, a.y, a.z]);
    // The isotropic start, U^ij = U·(a*_i·a*_j)/(a*_i a*_j), within the site's constraints
    // (least squares on its basis; it lies in it exactly).
    const Ui = B0/(8*Math.PI*Math.PI), U0 = [0, 1, 2, [0, 1], [0, 2], [1, 2]].map(c=> Array.isArray(c) ? Ui*Gs[3*c[0] + c[1]]/(Ns[c[0]]*Ns[c[1]]) : Ui);
    const m = basis.vecs.length, G = basis.vecs.map(u=> basis.vecs.map(w=> u.reduce((t, x, i)=> t + x*w[i], 0))), rhs = basis.vecs.map(u=> u.reduce((t, x, i)=> t + x*U0[i], 0));
    const c0 = solveSmall(G, rhs, m);
    site.vecs = basis.vecs; site.names = basis.names;
    site.iU = basis.names.map((nm, i)=> { const ix = nextIndex(); add(nm + '_' + labels[o], c0[i], -0.5, 0.5, 1e-6, { kind: 'adp', site: o }); return ix; });
    return site;
  });
}
function solveSmall(A, b, n){
  const M = A.map((row, i)=> [...row, b[i]]);
  for (let c = 0; c < n; c++){
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++){ if (r === c) continue; const f = M[r][c]/M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f*M[c][k]; }
  }
  return M.map((row, i)=> row[n]/row[i]);
}
// A site's U (6-vector, U11 … U23) at v.
function siteU(site, v){
  const U = [0, 0, 0, 0, 0, 0];
  site.iU.forEach((ix, m)=> { const c = v[ix]; site.vecs[m].forEach((x, i)=> { U[i] += c*x; }); });
  return U;
}
// The strain of reflection r at v: ε₀ = Xs·(π/180)/4 (the isotropic Lorentzian's,
// H_L = 4ε·tanθ) with, for Stephens, the anisotropic part: ε² = ε₀² + 10⁻⁶ Σ S_j q_j(u).
function strainOf(q, v, r){
  const e0 = v[q.iXs]*D2R/4;
  if (!q.iS) return e0;
  let e2 = e0*e0;
  const qs = q.strainQ[r];
  for (let j = 0; j < q.iS.length; j++) e2 += 1e-6*v[q.iS[j]]*qs[j];
  return Math.sqrt(Math.max(0, e2));
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
    if (shapeTypeOf(p.shape)) shapeSetup(q, p, cell, list, (nm, value, lo, hi, extra)=> add(pfx + nm, value, lo, hi, 1e-6, { group: 'phase', phase: k, kind: 'shape', ...extra }), ()=> par.length);
    // A preferred orientation (March–Dollase): its axis (hkl, or 'auto': autoRefine picks
    // it), its r refined from the texture stage on (1, none, until then).
    const po = textureOf(p.po);
    if (po){
      memberVectors(q, p, cell, list);
      q.poSpec = po; q.poHkl = po === 'auto' ? null : po;
      q.iPO = par.length; add(pfx + 'PO', 1, 0.2, 5, 1e-4, { group: 'phase', phase: k, kind: 'texture' });
    }
    broadeningSetup(q, p, cell, list, (nm, value, lo, hi, step, extra)=> add(pfx + nm, value, lo, hi, step, { group: 'phase', phase: k, ...extra }), ()=> par.length);
    adpSetup(q, p, cell, (nm, value, lo, hi, step, extra)=> add(pfx + nm, value, lo, hi, step, { group: 'phase', phase: k, ...extra }), ()=> par.length);
    return q;
  });

  const index = {};
  par.forEach((p, i)=> { index[p.name] = i; });
  return {
    x: X, y: Yo, w, n, x0, x1, rev, lines, lineName, cos2M, radius, bgDegree: N, basis, instrMissing: !instr,
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
  const types = [], byKey = new Map(), keys = [], tid = new Map();
  // With B per site the type is the site (its B a parameter); anisotropic, the site and
  // the rotation that takes its first atom there (β turns with it): atoms related by a
  // centring translation share one.
  const tIdx = q.atoms.map((a, j)=>{
    const key = a.key || a.element || a.label, el = a.element || key, occ = a.occ ?? 1, B = a.Biso ?? 0;
    const o = q.orbit ? q.orbit[j] : -1;
    const grp = q.adp === 'site' ? 'o' + o : q.adp === 'aniso' ? 'o' + o + '|' + q.orbR[j].join() : 'B' + B;
    const id = key + '|' + el + '|' + occ + '|' + grp;
    let t = tid.get(id);
    if (t === undefined){
      if (!byKey.has(key)){ byKey.set(key, keys.length); keys.push(key); }
      const fp = model.lineName ? fprime(el, model.lineName) : [0, 0];
      t = types.push({ id, key: byKey.get(key), occ, B, fpr: fp[0], fpi: fp[1], site: o, R: q.adp === 'aniso' ? q.orbR[j] : null }) - 1;
      tid.set(id, t);
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
// so they move with the cell) and these displacement parameters; recomputed only when
// either changes.
function phaseF2(model, q, cell, Gs, v){
  const adpKey = q.adp === 'site' ? q.sites.map(st=> v[st.iB]).join() : q.adp === 'aniso' ? q.sites.map(st=> st.iU.map(i=> v[i]).join(':')).join() : '';
  const key = cell.a + ',' + cell.b + ',' + cell.c + ',' + cell.alpha + ',' + cell.beta + ',' + cell.gamma + '|' + adpKey;
  if (q.f2key === key) return q.f2;
  if (q.atoms.length && !q.geo) phaseGeometry(model, q);
  const f2 = new Float64Array(q.nRefl), d = new Float64Array(q.nRefl);
  const geo = q.geo, nt = geo ? geo.types.length : 0, f0s = geo ? new Float64Array(geo.keys.length) : null;
  // Per type: B (isotropic), or β (anisotropic: the site's, turned by the type's R).
  let Bt = null, betas = null;
  if (geo && q.adp === 'site') Bt = geo.types.map(T=> v[q.sites[T.site].iB]);
  if (geo && q.adp === 'aniso'){
    const Ns = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
    const bs = q.sites.map(st=> betaOf(siteU(st, v), Ns));
    betas = geo.types.map(T=>{
      const b = bs[T.site], R = T.R;
      // R β Rᵀ
      return [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=>{ let t = 0; for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) t += R[3*i + a]*b[3*a + c]*R[3*j + c]; return t; }));
    });
  }
  for (let r = 0; r < q.nRefl; r++){
    const h = q.h[r], k = q.k[r], l = q.l[r];
    const Q = h*h*Gs[0] + k*k*Gs[4] + l*l*Gs[8] + 2*(h*k*Gs[1] + h*l*Gs[2] + k*l*Gs[5]);
    d[r] = 1/Math.sqrt(Q);
    if (!geo){ f2[r] = 1; continue; }
    const s = 0.5/d[r], s2 = s*s;
    for (let u = 0; u < f0s.length; u++) f0s[u] = f0(geo.keys[u], s);
    let r1 = 0, i1 = 0, r2 = 0, i2 = 0;
    for (let t = 0; t < nt; t++){
      const T = geo.types[t];
      let dw;
      if (betas){ const b = betas[t]; dw = Math.exp(-(h*h*b[0] + k*k*b[4] + l*l*b[8] + 2*(h*k*b[1] + h*l*b[2] + k*l*b[5]))); }
      else dw = Math.exp(-(Bt ? Bt[t] : T.B)*s2);
      const w = T.occ*dw, ar = w*(f0s[T.key] + T.fpr), ai = w*T.fpi;
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
/* A line beyond the pattern, toward 2θ = 180°: its widths and the Lorentz factor go as
   1/cosθ, so near 180° it is a level over the whole pattern, and that level went at once
   as the cell carried the line past 180° (λ/2d ≥ 1). On a synthetic ZnO pattern (to
   130°) the refinement stopped on that step, the cell 20 esd from the truth and χ² 1.16
   where the truth gives 1.02. Such lines fade out between 170° and 175° (or just beyond
   the pattern, when it reaches further), smoothly in 2θ, so the pattern stays continuous
   in the cell. */
function backFade(model, tt){
  const a = Math.max(170, model.x1 + 1), b = Math.min(179.9, a + 5);
  if (tt <= a) return 1;
  if (tt >= b) return 0;
  const s = (tt - a)/(b - a);
  return 1 - s*s*(3 - 2*s);
}

// One line of one reflection with the free shape: a peak per member of the family, its
// Lorentzian width Y (the instrument's and the phase's isotropic Ys, and the faults') +
// the shape's own (shapeWidths: wv, one per member), each a 1/m share of the intensity
// (times its texture weight). The FCJ counts are held per member (their keys negative,
// apart from the isotropic lines').
function shapeLine(model, k, r, j, th, tt, I, wv, prof, out, ticks, S, f2, d, tw){
  const q = model.phases[k], m = wv.length, x = model.x, xa = model.x0, xb = model.x1;
  const { U, V, W, X, Y, A } = prof;
  const c2 = Math.cos(2*th), dMax = A > 0 ? (Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + A*A)))) - 2*th)*R2D : 0;
  let sw = 0, sH = 0, sE = 0, tSum = 0;
  for (let i = 0; i < m; i++){
    const pr = profileAtTheta(th, U, V, W, X, Y + wv[i]), ti = tw ? tw[i] : 1;
    sw += ti; sH += ti*pr.H; sE += ti*pr.eta; tSum += ti;
    const half = Math.max(model.win*pr.H, WIN_MIN);
    if (tt + Math.max(0, dMax) + half < xa || tt + Math.min(0, dMax) - half > xb) continue;
    const nodes = A > 0 ? lineNodes(model, -1 - ((k*65536 + r)*64 + i)*4 - j, th, A, pr.H) : null;
    const Im = I/m*ti;
    if (!nodes) addPeak(out, x, tt, pr.H, pr.eta, Im, model.win);
    else if (nodes.length === 1) addPeak(out, x, tt + nodes[0].d, pr.H, pr.eta, Im, model.win);
    else addPeakFCJ(out, x, tt, pr.H, pr.eta, Im, nodes, model.win);
  }
  // The tick: the line's intensity with its texture, its width the members' mean
  // (weighed as their intensities).
  if (ticks && sw > 0 && tt >= xa && tt <= xb)
    ticks.push({ phase: q.id, h: q.lab ? q.lab[3*r] : q.h[r], k: q.lab ? q.lab[3*r + 1] : q.k[r], l: q.lab ? q.lab[3*r + 2] : q.l[r],
                 tt, d: d[r], mult: q.mult[r], F2: f2[r], I: S*I*tSum/m, H: sH/sw, eta: sE/sw, j: 0, pk: k, r });
}

/* One line of one reflection by WPPM (xrd-broad.js wppmLine): the instrument's pseudo-
   Voigt (U..Y alone) in Fourier space, times the strain's and the faults' Lorentzians
   (FWHM in d*: 2ε·d* and κ/π) and the size's coefficients — the isotropic sphere's
   (diameter Kλ/(Ys·π/180), the same reading as the Lorentzian model's) or each member's
   solid along its direction (shapeTs), over the log-normal distribution when there is
   one — and the axial divergence's nodes. The grid follows two widths, estimated as
   Lorentzians of the same breadth: the line's whole (the window) and its narrowest part
   (the step: the instrument's and the largest crystallites' sharpest member). */
function wppmLineOf(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw){
  const q = model.phases[k], L = model.lines[j], lam1 = model.lines[0].lam, c = Math.cos(th);
  const { U, V, W, X, Y, A } = inst, pr = profileAtTheta(th, U, V, W, X, Y);
  // The solid's base body for its members; the isotropic size (no shape, or the shape's
  // widths still 0 before its search) is a sphere whatever solid the phase asks for.
  const sigma = q.iLS != null ? ext.sigma : 0, base = ts && q.iW ? BODIES[q.shapeType].base : 'ball';
  const kScale = D2R/(K_SCHERRER*lam1);          // Å⁻¹ per degree of a dimension's width
  const dstar = 1/d[r], eps = ext.eps, kap = ext.kappa;
  const WL = 2*eps*dstar + kap/Math.PI;          // Å⁻¹
  // Lorentzian-equivalent widths (°): strain, faults, the size's mean and narrowest.
  const strDeg = 4*eps*Math.tan(th)*R2D, fltDeg = L.lam*kap/Math.PI/c*R2D;
  /* Over a distribution the dimensions read are the volume-weighted mean crystallite's,
     the median's times e^{3.5σ²} (a sphere's ⟨D⁴⟩/⟨D³⟩): the integral breadth, which
     ⟨L⟩_V sets, then stays with them while σ changes the profile's shape — with the
     median instead, σ and the size traded one for the other along the breadth. The
     largest crystallites (+3σ over the volume) are e^{3σ − σ²/2} times as large. */
  const toMedian = Math.exp(3.5*sigma*sigma), grow = Math.exp(-3*sigma + 0.5*sigma*sigma);
  let sizeMean = 0, sizeMin = Infinity, members = null;
  if (ts){
    const m = ts.length/3; members = [];
    let wsum = 0;
    for (let i = 0; i < m; i++){
      const t = [ts[3*i], ts[3*i + 1], ts[3*i + 2]], n = Math.hypot(t[0], t[1], t[2]), wi = tw ? tw[i]/m : 1/m;
      const w = n > 0 ? 0.75*n/columnLengthV(base, t) : 0;
      sizeMean += wi*w; wsum += wi; sizeMin = Math.min(sizeMin, w);
      const a = Math.abs(t[0])/(n || 1), b = Math.abs(t[1])/(n || 1), cc = Math.abs(t[2])/(n || 1);
      members.push(base === 'cylinder' ? [Math.hypot(a, b), 0, cc, n*kScale*toMedian, wi] : [a, b, cc, n*kScale*toMedian, wi]);
    }
    sizeMean /= wsum || 1;
  } else {
    const ys = ext.Ys;
    sizeMean = sizeMin = ys > 0 ? 1.23*ys : 0;   // a sphere's FWHM is 1.23× the Lorentzian reading
    members = ys > 0 ? [[0, 0, 0, ys*kScale*toMedian, 1]] : null;
  }
  const lorTot = pr.HL + sizeMean/c + strDeg + fltDeg;
  const Hest = tch(pr.HG, lorTot).H, Hmin = tch(pr.HG, pr.HL + sizeMin*grow/c + strDeg + fltDeg).H;
  const half = Math.max(model.win*Hest, WIN_MIN);
  const c2 = Math.cos(2*th), dMax = A > 0 ? (Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + A*A)))) - 2*th)*R2D : 0;
  const xa = model.x0, xb = model.x1;
  if (tt + Math.max(0, dMax) + half < xa || tt + Math.min(0, dMax) - half > xb) return;
  // The divergence's node count from the narrowest component the line can hold (a thin
  // plate's sharp in-plane members inside a broad line): counted from the whole line's
  // width, 3 nodes 0.1° apart drew separate bumps, 8 % of the peak.
  const nodes = A > 0 ? lineNodes(model, (k*65536 + r)*4 + j, th, A, Hmin) : null;
  const size = members ? (arr, n, dL)=> { for (const [a, b, cc, sc, wi] of members) addMemberCoef(arr, n, dL, base, a, b, cc, sc, sigma, wi); } : null;
  // (The texture's weights are in the members' weights; without a shape, in I already.)
  wppmLine({ x: model.x, out, tt, lam: L.lam, I, Hi: pr.H, etai: pr.eta, WL, Hest, Hmin, size, nodes, win: model.win, winMin: WIN_MIN });
  if (ticks && tt >= xa && tt <= xb){
    const tq = tch(pr.HG, lorTot);
    const tSum = ts && tw ? tw.reduce((a, b)=> a + b, 0)/tw.length : 1;
    ticks.push({ phase: q.id, h: q.lab ? q.lab[3*r] : q.h[r], k: q.lab ? q.lab[3*r + 1] : q.k[r], l: q.lab ? q.lab[3*r + 2] : q.l[r],
                 tt, d: d[r], mult: q.mult[r], F2: f2[r], I: S*I*tSum, H: tq.H, eta: tq.eta, j: 0, pk: k, r });
  }
}

/* One phase's pattern at scale 1 into `out` (zeroed here). With `ticks`, the α1 line of
   every reflection in the range is listed there too. */
function phasePattern(model, v, k, out, ticks){
  out.fill(0);
  const q = model.phases[k];
  const cell = cellOf(model, v, k), { Gs } = metric(cell);
  const f2 = phaseF2(model, q, cell, Gs, v), d = q.d;
  const zero = v[model.iZero], disp = v[model.iDisp], dB = v[q.iB], A = v[model.iAsym];
  const [Ui, Vi, Wi, Xi, Yi] = model.iProf.map(i=> v[i]);
  const { U, V, W, X, Y } = profileOf(model, v, k);
  const x = model.x, xa = model.x0, xb = model.x1, S = v[q.iScale];
  // The free shape: each member of a family with its own size width (shapeSetup).
  const act = shapeActive(q, v);
  const wppm = q.wppm && !q.iL;
  const shp = act && !wppm ? shapeWidths(model, q, v) : null, ts = act && wppm ? shapeTs(model, q, v) : null;
  const tw = textureWeights(q, v);
  const fa = q.iFA != null ? v[q.iFA] : 0, sigma = q.iLS != null ? v[q.iLS] : 0;
  const sk = model.skip, skip = sk && sk.k === k ? sk.rs : null;
  if (sk && sk.only && sk.k !== k) return out;
  for (let r = 0; r < q.nRefl; r++){
    if (skip && (sk.only ? !skip.has(r) : skip.has(r))) continue;
    const s2 = 0.25/(d[r]*d[r]);
    let base = q.mult[r]*f2[r]*Math.exp(-2*dB*s2);
    // the texture: each member weighed (a shaped phase's, one by one in shapeLine)
    if (tw && !shp && !ts){ const o = tw[r]; let t = 0; for (let i = 0; i < o.length; i++) t += o[i]; base *= t/o.length; }
    // Stephens' strain and the faults: this reflection's own (none: the phase's Xs, 0).
    const eps = q.iS ? strainOf(q, v, r) : v[q.iXs]*D2R/4;
    const kappa = fa > 0 ? faultKappa(q.faultTab, r, fa) : 0;
    const Xr = q.iS ? Xi + 4*eps*R2D : X;
    for (let j = 0; j < model.lines.length; j++){
      const L = model.lines[j], st = L.lam/(2*d[r]);
      if (st >= 1) continue;
      const th = Math.asin(st);
      const tt = 2*th*R2D + zero + disp*Math.cos(th);
      const fade = backFade(model, tt);
      if (!fade) continue;
      const I = base*L.w*lpFactor(model, th)*fade;
      if (wppm){
        wppmLineOf(model, k, r, j, th, tt, I, { U: Ui, V: Vi, W: Wi, X: Xi, Y: Yi, A }, { eps, kappa, sigma, Ys: v[q.iYs] }, out, ticks && j === 0 ? ticks : null, S, f2, d, ts ? ts[r] : null, ts && tw ? tw[r] : null);
        continue;
      }
      // The faults' Lorentzian, as a width ∝ 1/cosθ: FWHM κ/π in d* is λκ/π/cosθ in 2θ.
      const Yr = kappa > 0 ? Y + L.lam*kappa/Math.PI*R2D : Y;
      if (shp){ shapeLine(model, k, r, j, th, tt, I, shp[r], { U, V, W, X: Xr, Y: Yr, A }, out, ticks && j === 0 ? ticks : null, S, f2, d, tw ? tw[r] : null); continue; }
      const pr = profileAtTheta(th, U, V, W, Xr, Yr);
      // The axial divergence spreads the peak over shifts of one sign, up to dMax
      // (fcjNodes): a line out of range by more than that is skipped before its nodes.
      const c2 = Math.cos(2*th);
      const dMax = A > 0 ? (Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + A*A)))) - 2*th)*R2D : 0;
      const half = Math.max(model.win*pr.H, WIN_MIN);
      if (tt + Math.max(0, dMax) + half < xa || tt + Math.min(0, dMax) - half > xb) continue;
      const nodes = A > 0 ? lineNodes(model, (k*65536 + r)*4 + j, th, A, pr.H) : null;
      if (!nodes) addPeak(out, x, tt, pr.H, pr.eta, I, model.win);
      else if (nodes.length === 1) addPeak(out, x, tt + nodes[0].d, pr.H, pr.eta, I, model.win);
      else addPeakFCJ(out, x, tt, pr.H, pr.eta, I, nodes, model.win);
      if (ticks && j === 0 && tt >= xa && tt <= xb)
        ticks.push({ phase: q.id, h: q.lab ? q.lab[3*r] : q.h[r], k: q.lab ? q.lab[3*r + 1] : q.k[r], l: q.lab ? q.lab[3*r + 2] : q.l[r],
                     tt, d: d[r], mult: q.mult[r], F2: f2[r], I: S*I, H: pr.H, eta: pr.eta, j: 0, pk: k, r });
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
function calc(model, params, opts = {}){
  const v = vectorOf(model, params), n = model.n;
  const ticks = [], perPhase = [];
  const bg = background(model, v, new Float64Array(n)), yc = Float64Array.from(bg);
  // opts.skip = { k, rs: Set of reflection indices }: those reflections of phase k left
  // out; opts.only = { k, rs }: those alone, with the background (xrd-widths: one peak);
  // opts.internal: the curves in the model's own (ascending) order.
  model.skip = opts.only ? { ...opts.only, only: true } : opts.skip || null;
  try {
    model.phases.forEach((q, k)=>{
      const P = phasePattern(model, v, k, new Float64Array(n), ticks), S = v[q.iScale];
      for (let i = 0; i < n; i++){ P[i] *= S; yc[i] += P[i]; }
      perPhase.push(P);
    });
  } finally { model.skip = null; }
  ticks.sort((a, b)=> a.tt - b.tt);
  if (model.rev && !opts.internal){ yc.reverse(); bg.reverse(); perPhase.forEach(P=> P.reverse()); }
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
  // opts.audit === false: one pass (the free shape's brief trial refinements, which only
  // rank the starting shapes).
  for (let pass = 0; pass < (opts.audit === false ? 1 : 4); pass++){
    const fz = model.fcjFreeze = new Map();
    try { res = refineHeld(model, opts); }
    finally { model.fcjFreeze = null; }
    model.fcjAudit = fz; model.fcjBehind = false;
    try { for (let k = 0; k < model.phases.length; k++) if (model.v[model.phases[k].iScale]) phasePattern(model, model.v, k, new Float64Array(model.n)); }
    finally { model.fcjAudit = null; }
    if (!model.fcjBehind || opts.audit === false) break;
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
  let trial = null, trialZ = null;
  const onBound = (j, g) => { const p = model.par[j]; return (v[j] <= loOf(j, v) && g < 0) || (v[j] >= p.hi && g > 0); };
  const chiRed = c => c/Math.max(1, rStats(model, st.yc, st.bg).N - m);
  /* The free linear parameters (scales, background) solved exactly, the rest held, when
     the steps have stopped. The 1/2θ term and the Chebyshev terms are nearly collinear:
     along such a direction a damped step is cut to almost nothing while its shift is
     still far under 1 % of its (large) esd, and the refinement stopped with χ² up to 17
     above its minimum on synthetic plates, all of it in the background. When the solve
     gains more than a hundredth of χ²_ν the steps go on from there (at most 3 times). */
  const lin = free.filter(j=> model.par[j].linear);
  const linSt = { pats: null, bg: new Float64Array(n), yc: new Float64Array(n) };
  let linLeft = lin.length ? 3 : 0;
  const linSolve = () => {
    linLeft--;
    linSt.pats = st.pats;
    const vl = v.slice(), before = st.chi2;
    solveLinear(model, vl, linSt, lin);
    if (!(linSt.chi2 < before)) return false;
    v = vl; st.bg.set(linSt.bg); st.yc.set(linSt.yc); st.chi2 = linSt.chi2;
    return before - linSt.chi2 > 0.01*chiRed(before);
  };
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
      let vn = v.slice(), maxRatioZ = 0;
      const clamped = [];
      maxRatio = 0;
      // A parameter with a largest step (a body's turn, maxStep: where a turn has no
      // first-order effect — an axis on a symmetric direction — the Gauss–Newton step is
      // unbounded, and a first step of 4 rad threw the axis anywhere) is held to it, on
      // its own: shortening the whole step instead froze every other parameter with a
      // turn whose column was numerical noise (a sphere's sizes stopped 30 % off).
      for (let a = 0; a < k; a++){
        const j = free[act[a]], p = model.par[j];
        let d = ds[a]/D[a];
        if (p.maxStep && Math.abs(d) > p.maxStep){ d = Math.sign(d)*p.maxStep; clamped.push(j); }
        let nv = v[j] + d;
        if (nv < p.lo) nv = p.lo; else if (nv > p.hi) nv = p.hi;
        const sig = Math.sqrt(Math.max(0, chInv[a*k + a])*cr)/D[a], r = sig > 0 ? Math.abs(nv - v[j])/sig : 0;
        maxRatio = Math.max(maxRatio, r);
        if (clamped[clamped.length - 1] !== j) maxRatioZ = Math.max(maxRatioZ, r);
        vn[j] = nv;
      }
      project(vn);
      trial = evaluate(model, vn, trial);
      // Rejected with a clamped turn: the same step without it. At a kink of χ² (a
      // faceted body exactly on a symmetric orientation) a turn's column is noise, its
      // step stays far over maxStep however large λ, and every trial carried it: the
      // refinement stopped there with every other parameter frozen (a cylinder's sizes
      // 30 % off, and the angular profiles of held solids 3–5× too narrow).
      let next = trial.chi2 < st.chi2 ? trial : null;
      if (!next && clamped.length){
        const vz = vn.slice();
        for (const j of clamped) vz[j] = v[j];
        project(vz);
        trialZ = evaluate(model, vz, trialZ);
        if (trialZ.chi2 < st.chi2){ next = trialZ; vn = vz; maxRatio = maxRatioZ; }
      }
      if (next){
        const rel = (st.chi2 - next.chi2)/next.chi2;
        v = vn; const t = st; st = next;
        if (next === trial) trial = t; else trialZ = t;
        lam = Math.max(lam/10, 1e-9);
        accepted = true;
        if (maxRatio < 0.01 || rel < 1e-9){ converged = true; why = 'shifts below 1 % of the esds'; }
        break;
      }
      lam *= 10;
    }
    if (opts.onProgress) opts.onProgress((it + 1)/maxIter, { iteration: it + 1, chi2: chiRed(st.chi2), lambda: lam });
    if (!accepted){ converged = true; why = 'no step lowers χ²'; }
    if (converged && linLeft > 0 && linSolve()){ converged = false; why = ''; lam = Math.max(lam, 1e-3); continue; }
    if (converged){ if (accepted) it++; break; }
  }
  if (!converged && linLeft > 0) linSolve();
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
   6. the phases' optional stages, each on top of what is free: the anisotropic strain
      (Stephens' S_j), the planar faults (FA), the size distribution (σ, LS), the
      displacement parameters (ΔB, B per site or Uⁱʲ per site: the phase's adp, or
      'overall' for all with opts.refineB, the v419–v423 card option), the texture.
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
   warnings: [string], textures, models: {id: {profile, strain, faults, adp}} (what each
   phase was refined with: without the standard's profile, WPPM, the anisotropic strain
   and the faults are not), reflectionsInRange, converged, ms }. */
function autoRefine(model, opts = {}){
  const t0 = Date.now(), stages = [], warnings = [];
  const irf = opts.irf || null, std = !!opts.standard;
  // With a free shape to refine, its trial refinements take most of the time: the
  // stages before it fill the first half of the progress.
  const progRaw = opts.onProgress || (()=>{});
  const share = irf && model.phases.some(q=> q.shapeType) ? 0.5 : 1;
  const prog = (f, stage) => progRaw(f*share, stage);
  // Options that need the standard's instrumental profile: without it the instrument's
  // broadening and the sample's are one and the same.
  const needIrf = [];
  if (!irf) model.phases.forEach(q=>{
    const what = [q.wppm && 'WPPM', q.iS && 'anisotropic strain', q.faultTab && 'planar faults'].filter(Boolean);
    if (what.length) needIrf.push(`${q.name || 'Phase ' + q.id}: ${what.join(', ')}`);
    q.wppm = false; q.noIrf = true;
  });
  // What the model had to assume about the instrument, said once with the results.
  if (model.instrMissing) warnings.push('No instrument description could be read from the file: Cu Kα₁/Kα₂ (ratio 0.5), a 240 mm goniometer and no monochromator are assumed.');
  if (!model.lineName) warnings.push(`λ = ${model.lines[0].lam.toFixed(5)} Å is not one of the lines the anomalous scattering factors are tabulated at (Cu, Co, Mo, Cr, Fe, Ag Kα₁): f′ and f″ are taken as 0.`);
  if (needIrf.length) warnings.push(`${needIrf.join('; ')}: need the standard's instrumental profile (refine the standard first), else the instrument's broadening and the sample's are one and the same; refined without.`);
  const adpOf = q => q.adp !== 'cif' ? q.adp : opts.refineB ? 'overall' : 'cif';
  const optStages = [
    model.phases.some(q=> q.iS && !q.noIrf) && 'anisotropic strain',
    model.phases.some(q=> q.iFA != null && !q.noIrf) && 'planar faults',
    model.phases.some(q=> q.iLS != null && q.wppm) && 'size distribution',
    model.phases.some(q=> adpOf(q) !== 'cif') && 'displacement parameters',
  ].filter(Boolean);
  const nStages = 5 + optStages.length;
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
    // (By WPPM the sphere's own profile is 1.23× as wide as the Lorentzian reading of Ys.)
    model.phases.forEach(q=> { v[q.iYs] = Math.max(0, est.H - Hi)*Math.cos(thE)/(q.wppm ? 1.23 : 1); v[q.iXs] = 0; });
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
  let res, nIn, lastFree = [];
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
    // The optional stages, each on top of what is free already.
    let kSt = 5;
    const live0 = k => !out.has(k);
    if (optStages.includes('anisotropic strain')){
      // Stephens: ε² = ε₀² + Σ S q; from ε₀ = 0 the square root has no derivative.
      const vv = model.v.slice();
      model.phases.forEach((q, k)=> { if (q.iS && !q.noIrf && live0(k) && vv[q.iXs] < 0.02) vv[q.iXs] = 0.02; });
      setParams(model, vv);
      free = free.concat(model.phases.flatMap((q, k)=> q.iS && !q.noIrf && live0(k) ? q.iS.map(i=> model.par[i].name) : []));
      res = run(kSt++, 'anisotropic strain', free);
    }
    if (optStages.includes('planar faults')){
      free = free.concat(model.phases.flatMap((q, k)=> q.iFA != null && !q.noIrf && live0(k) ? [q.pfx + 'FA'] : []));
      res = run(kSt++, 'planar faults', free);
    }
    if (optStages.includes('size distribution')){
      /* The log-normal width: σ enters to second order (a distribution and its mirror in
         ln size differ only beyond), so from σ = 0 it has no derivative; refined from 0.3
         and from 0.6, the lower χ² kept. */
      tS = Date.now();
      prog(kSt/nStages, 'size distribution');
      for (const k of model.phases.map((_, k)=> k).filter(k=> model.phases[k].iLS != null && model.phases[k].wppm && live0(k))){
        const q = model.phases[k], v0 = model.v.slice();
        let best = null;
        for (const s0 of [0.3, 0.6]){
          const vv = v0.slice(); vv[q.iLS] = s0; setParams(model, vv);
          let r; try { r = refine(model, { free: [...free, q.pfx + 'LS'], maxIter: opts.maxIter || 40 }); } catch(e){ continue; }
          if (!best || r.stats.chi2 < best.r.stats.chi2) best = { r, v: model.v.slice() };
        }
        if (best){ setParams(model, best.v); res = best.r; free = free.concat(q.pfx + 'LS'); }
        else setParams(model, v0);
      }
      stageStats('size distribution', res);
      kSt++;
    }
    if (optStages.includes('displacement parameters')){
      free = free.concat(keep(model.phases.flatMap(q=>{
        const a = adpOf(q);
        return a === 'overall' ? [q.pfx + 'B'] : a === 'site' ? q.sites.map(st=> model.par[st.iB].name) : a === 'aniso' ? q.sites.flatMap(st=> st.iU.map(i=> model.par[i].name)) : [];
      })));
      res = run(kSt++, 'displacement parameters', free);
    }
    /* A preferred orientation (March–Dollase), for the phases that ask for one. For a
       cubic phase its r has no first-order effect at 1 (the members of a family weigh
       out evenly to first order), so it is refined from 0.8 and from 1.25 (plates and
       needles) and the lower χ² kept; for 'auto', on each low-index axis
       (textureCandidates) in turn. */
    const poKs = model.phases.map((_, k)=> k).filter(k=> model.phases[k].iPO != null && !out.has(k));
    if (poKs.length){
      tS = Date.now();
      prog(Math.min(nStages - 0.5, kSt)/nStages, 'preferred orientation');
      for (const k of poKs){
        const q = model.phases[k], v0 = model.v.slice(), cands = q.poSpec === 'auto' ? textureCandidates(q) : [q.poSpec];
        let best = null;
        for (const hkl of cands) for (const r0 of [0.8, 1.25]){
          q.poHkl = hkl;
          const vv = v0.slice(); vv[q.iPO] = r0; setParams(model, vv);
          let r; try { r = refine(model, { free: [...free, q.pfx + 'PO'], maxIter: opts.maxIter || 40 }); } catch(e){ continue; }
          if (!best || r.stats.chi2 < best.r.stats.chi2) best = { r, v: model.v.slice(), hkl };
        }
        if (best){ q.poHkl = best.hkl; setParams(model, best.v); res = best.r; free = free.concat(q.pfx + 'PO'); }
        else { q.poHkl = q.poSpec === 'auto' ? null : q.poSpec; setParams(model, v0); }
      }
      stageStats('preferred orientation', res);
    }
    lastFree = free;
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
  // The free shape of the phases that ask for it (p.shape), on top of everything else.
  const shapes = {};
  let isoParams = null;
  const shapeKs = model.phases.map((_, k)=> k).filter(k=> model.phases[k].shapeType && !out.has(k));
  if (shapeKs.length && !irf) warnings.push(`Free shape: needs the standard's instrumental profile (refine the standard first), else the shape's widths and the instrument's are one and the same; ${shapeKs.map(nm).join(', ')} refined with an isotropic size.`);
  else if (shapeKs.length){
    isoParams = res.params;
    for (const k of shapeKs){
      const j = shapeKs.indexOf(k), part = (1 - share)/shapeKs.length;
      progRaw(share + j*part, `free shape of ${nm(k)}`);
      const r = freeShape(model, k, res, lastFree, { ...opts, onShape: f=> progRaw(share + (j + f)*part, `free shape of ${nm(k)}`) });
      if (r && r.res){ res = r.res; shapes[model.phases[k].id] = r.info; lastFree = r.res.free; }
      else if (r && r.rejected) warnings.push(`${nm(k)}: the free shape (${model.phases[k].shapeType}) is not supported by the data (ΔBIC ${r.early ? 'about ' : ''}${r.dBIC >= 0 ? '+' : ''}${r.dBIC.toFixed(0)}${r.early ? ' from the trial shapes' : ''}, needs under −10): the isotropic size is kept.`);
      else warnings.push(`${nm(k)}: the free shape (${model.phases[k].shapeType}) could not be refined; the isotropic size is kept.`);
    }
    // No shape kept: nothing to compare the isotropic model with. And the covariance the
    // model holds is the last trial's: it is set back to the kept result's (the weight
    // fractions' esds read it).
    if (!Object.keys(shapes).length) isoParams = null;
  }
  // The covariance the model holds is the last trial's (a texture's or a size
  // distribution's starts, the shape's trials): set back to the kept result's, which the
  // weight fractions' esds read.
  model.cov = { names: res.free, cov: res.cov }; model.esd = res.esd;
  progRaw(1, 'done');
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
    shapes, isoParams,
    // the preferred orientations: each phase's axis (the conventional cell's hkl) and r
    textures: Object.fromEntries(model.phases.filter(q=> q.iPO != null && q.poHkl).map(q=> [q.id, { hkl: q.poHkl, r: res.params[q.pfx + 'PO'], esd: (res.esd || {})[q.pfx + 'PO'] }])),
    // the models each phase was refined with (calc() needs them to draw the result again)
    models: Object.fromEntries(model.phases.map(q=> [q.id, { profile: q.wppm ? (q.iLS != null ? 'lognormal' : 'wppm') : 'lorentz',
      strain: q.iS && !q.noIrf ? 'aniso' : 'iso', faults: q.faultSpec && !q.noIrf ? q.faultSpec.text : null, adp: adpOf(q) }])),
    reflectionsInRange: nIn, converged: res.converged, ms: Date.now() - t0,
  };
}

/* freeShape(model, k, res, free, opts) → { res, info }, { rejected, dBIC } or null: the
   free shape of phase k (shapeSetup), from the isotropic refinement res. By the cubic
   (or any) symmetry the pattern does not change to first order when a sphere is
   deformed (Σ over a family of uᵀδS u is the trace alone), so a refinement started from
   the sphere goes nowhere: it starts instead from plates and needles on the low-index
   directions and from shapes drawn at random (seeded: the same data give the same
   result), each refined briefly, and the best few to convergence, then polished. The
   sphere-like solid is one of the starts (for the ellipsoid and the spheroid the sphere
   itself, so their fit never ends above the isotropic one). Each full refinement of a
   body starts with its orientation as the reference, r = 0. It is kept if it beats the
   isotropic fit by ΔBIC < −10 ({ rejected, dBIC, early } otherwise; early: decided on
   the brief refinements). A body is refined again with exact faces, and with its axes
   held on the lattice (kept when better: see the final stage). info: { type, starts,
   full, chi2Iso, chi2, Piso, P, N, chi2redIso, held, dBICfree, dBICheld, freeOff (the
   free axes' angles from the held ones, °), freeW (the free fit's widths) }. */
const SHAPE_STARTS = 10, SHAPE_FULL = 3;
function freeShape(model, k, res, free, opts){
  // The search with a body's faces rounded off (shapeWidths); never beyond it.
  model.shapeSoft = model.phases[k].iW ? { q: model.phases[k], soft: SHAPE_SOFT } : null;
  try { return freeShapeRun(model, k, res, free, opts); }
  finally { model.shapeSoft = null; }
}
function freeShapeRun(model, k, res, free, opts){
  const q = model.phases[k], pf = q.pfx, vIso = model.v.slice();
  const N = res.stats.N, chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
  const y0 = Math.max(vIso[q.iYs], 1e-3);
  // A seeded generator (mulberry32) and Gaussian deviates.
  // (The same sequence for every phase: a result must not change with the phases'
  // ids, which follow the order they were added in.)
  let seed = 0x9e3779b9 >>> 0;
  const rnd = ()=> { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  const gauss = ()=> Math.sqrt(-2*Math.log(rnd() || 1e-12))*Math.cos(2*Math.PI*rnd());
  const unit = t => { const n = Math.hypot(...t); return t.map(x=> x/n); };
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  // A turn by phi about the unit axis n (row-major), a product, a random turn.
  const rotation = (n, phi) => { const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
    return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
  const mul = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const randomTurn = ()=> quatMat(unit([gauss(), gauss(), gauss(), gauss()]));
  // Tilted a few degrees, so that no symmetry holds the axes where they start.
  const tilt = e => unit([e[0] + 0.08*gauss(), e[1] + 0.08*gauss(), e[2] + 0.08*gauss()]);
  const axesLow = lowIndexAxes(q);
  // Each solid's own parameters, its starts (functions that write one into v), how a
  // start is charted afresh before its full refinement, and a small turn of the best.
  let names, starts = [], rebase = v => v, turned, snaps = null;
  if (q.iL){
    const cholL = S => { const l11 = Math.sqrt(S[0]), l21 = S[3]/l11, l31 = S[6]/l11, l22 = Math.sqrt(Math.max(1e-30, S[4] - l21*l21)), l32 = (S[7] - l31*l21)/l22, l33 = Math.sqrt(Math.max(1e-30, S[8] - l31*l31 - l32*l32)); return [l11, l21, l22, l31, l32, l33]; };
    // S turned by R: R·S·Rᵀ.
    const turnS = (S, R) => [0,1,2].flatMap(i=> [0,1,2].map(j=> { let t = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) t += R[3*i + a]*S[3*a + b]*R[3*j + b]; return t; }));
    const axisS = (e, along, across) => [0,1,2].flatMap(i=> [0,1,2].map(j=> (i === j ? across*across : 0) + (along*along - across*across)*e[i]*e[j]));
    const put = L => v => { L.forEach((t, i)=> { v[q.iL[i]] = t; }); };
    names = SHAPE_NAMES.map(n=> pf + n);
    starts.push(put([y0, 0, y0, 0, 0, y0]));
    for (const e of axesLow){ starts.push(put(cholL(axisS(tilt(e), 2.5*y0, 0.6*y0)))); starts.push(put(cholL(axisS(tilt(e), 0.4*y0, 1.4*y0)))); }
    while (starts.length < SHAPE_STARTS + 1){
      const lam = [0, 1, 2].map(()=> y0*y0*Math.exp(0.8*gauss()));
      starts.push(put(cholL(turnS([lam[0], 0, 0, 0, lam[1], 0, 0, 0, lam[2]], randomTurn()))));
    }
    turned = v => { const vv = v.slice(), ax = unit([gauss(), gauss(), gauss()]);
      put(cholL(turnS(shapeMatrix(q.iL.map(i=> v[i])), rotation(ax, 0.02))))(vv); return vv; };
  } else {
    const B = BODIES[q.shapeType];
    names = [...q.iW, ...q.iR].map(i=> model.par[i].name);
    // The body's widths along x, y, z as its own W parameters.
    const Wof = (wx, wy, wz) => B.W.length === 2 ? [(wx + wy)/2, wz] : [wx, wy, wz];
    // Its mean width with every W = 1 (over the sphere of directions): the sphere-like
    // start has the isotropic fit's width y0 on average.
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
    // The frame with z along e and x along a low-index direction across it (else any).
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
    while (starts.length < SHAPE_STARTS + 1) starts.push(put(Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))), randomTurn()));
    // The orientation reached becomes the reference, r = 0: the chart is fresh at the
    // start of each full refinement, far from |r| = π.
    rebase = v => { const vv = v.slice(), R = bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
    turned = v => { const vv = rebase(v), R = mul(bodyFrame(q, v), rotation(unit([gauss(), gauss(), gauss()]), 0.02)); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
    // The body set on the lattice: its best-placed axis exactly on its lattice
    // direction; a body with three axes, its next one on each of the simplest lattice
    // directions exactly normal to the first (a projection of its own nearest direction
    // had left a held axis 7° off its label, and the free fit's in-plane frame had held
    // a plate on [1-13]); a body of revolution, its axis alone. [] when no axis is within
    // SNAP_DEG of a lattice direction.
    snaps = v => {
      const R = bodyFrame(q, v), col = i => [R[i], R[3 + i], R[6 + i]], dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
      // The first axis held: the most telling (its width the farthest from the other
      // two: a plate's normal), not merely the nearest to a lattice direction — an
      // in-plane axis 0.5° from [1-13] had held a plate's whole frame there.
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
      // Each candidate goes to whichever of the other two axes it is nearer.
      return latticeAcross(q, cp, null, 0.01, 3).map(({ vec })=>{
        const others = [0, 1, 2].filter(i=> i !== p), s = Math.abs(dot(vec, col(others[0]))) >= Math.abs(dot(vec, col(others[1]))) ? others[0] : others[1];
        return frameOf(s, vec);
      });
    };
  }
  names = free.filter(nm=> nm !== pf + 'Ys').concat(names);
  const steps = starts.length + SHAPE_FULL + 2;
  let done = 0;
  const tick = ()=> { done++; if (opts.onShape) opts.onShape(Math.min(1, done/steps)); };
  const brief = [];
  for (const put of starts){
    const vv = vIso.slice(); vv[q.iYs] = 0;
    put(vv);
    setParams(model, vv);
    try { const r = refine(model, { free: names, maxIter: 8, audit: false }); brief.push({ v: model.v.slice(), chi: chiTot(r) }); } catch(e){}
    tick();
  }
  brief.sort((a, b)=> a.chi - b.chi);
  // The brief refinements already reach the shape's gain (the best one's χ² within
  // 0.2 χ²_ν of the converged fit on synthetic plates, needles and spheres): when it is
  // under half of what ΔBIC < −10 needs, the full refinements are not run — on
  // isotropic samples they were most of the time, for a shape then rejected.
  const dP = names.length - free.length, gain = brief.length ? (chiTot(res) - brief[0].chi)/Math.max(1, res.stats.chi2) : -Infinity;
  if (!(gain > (10 + dP*Math.log(N))/2)){ setParams(model, vIso); return { rejected: true, dBIC: dP*Math.log(N) - gain, early: true }; }
  let best = null;
  const finals = [];
  // A full refinement from v; kept as the best when it is.
  const full = v => {
    setParams(model, rebase(v));
    let r; try { r = refine(model, { free: names, maxIter: opts.maxIter || 60 }); } catch(e){ return null; }
    if (!best || chiTot(r) < chiTot(best.res)) best = { res: r, v: model.v.slice() };
    tick();
    return chiTot(r);
  };
  for (const b of brief.slice(0, SHAPE_FULL)){ const c = full(b.v); if (c != null) finals.push(c); }
  if (best){
    // Polish: refine() stops where the axes sit on a symmetric orientation (the first-
    // order effects of a turn cancel over a family, the esds blow up and the shift test
    // passes at once). Again from the best turned a little, until χ² stops falling.
    for (let p = 0; p < 2; p++){
      const before = chiTot(best.res);
      full(turned(best.v));
      if (before - chiTot(best.res) < 0.5*Math.max(1, res.stats.chi2)) break;
    }
  }
  if (!best){ setParams(model, vIso); return null; }
  // ΔBIC against the isotropic fit, with χ² divided by its χ²_ν (so that the model's own
  // misfit is not taken for evidence).
  const bic = r => (chiTot(r) - chiTot(res))/Math.max(1, res.stats.chi2) + (r.stats.P - res.stats.P)*Math.log(N);
  let held = false, dBICfree = NaN, dBICheld = NaN, freeOff = null, freeW = null;
  if (q.iW){
    // A body: refined again with its exact faces (the rounded ones only steered the
    // search), its axes free; then set on the lattice, its orientation held — a
    // crystallite's faces are lattice planes more often than not, and a held axis is
    // two or three parameters fewer. The lower ΔBIC is kept.
    model.shapeSoft = null;
    const refineFrom = (v, nm) => { setParams(model, rebase(v)); try { const r = refine(model, { free: nm, maxIter: opts.maxIter || 60 }); return { res: r, v: model.v.slice() }; } catch(e){ return null; } };
    const ex = refineFrom(best.v, names);
    if (ex) best = ex;
    dBICfree = bic(best.res);
    // The held candidates: the best of the lattice frames near the free fit.
    let sn = null;
    for (const vs of (snaps ? snaps(best.v) : [])){
      const r = refineFrom(vs, names.filter(nm=> !q.iR.some(i=> model.par[i].name === nm)));
      if (r && (!sn || chiTot(r.res) < chiTot(sn.res))) sn = r;
    }
    if (sn){
      dBICheld = bic(sn.res);
      // Held only where the data allow it as well: the free orientation no better than
      // the held one by more than a 95 % χ² for its 2 or 3 turns. The BIC alone gave
      // three turns' discount (25) to boxes whose true faces were 8° off ⟨111⟩.
      const gain = (chiTot(sn.res) - chiTot(best.res))/Math.max(1, res.stats.chi2);
      if (dBICheld < dBICfree && gain <= (q.iR.length === 2 ? 5.99 : 7.81)){
        // How far the free orientation's axes were from the held ones (°).
        const Rf = bodyFrame(q, best.v), Rh = bodyFrame(q, sn.v);
        freeOff = [0, 1, 2].map(i=> Math.acos(Math.min(1, Math.abs(Rf[i]*Rh[i] + Rf[3 + i]*Rh[3 + i] + Rf[6 + i]*Rh[6 + i])))*R2D);
        freeW = q.iW.map(i=> best.v[i]);
        best = sn; held = true;
      }
    }
  }
  // Kept only when the data support it: ΔBIC under −10 — five more parameters always
  // lower χ² a little, and on an isotropic sample the shape was kept in 7 of 12 noise
  // draws with ΔBIC near +40.
  const cb = chiTot(best.res), dBIC = bic(best.res);
  if (!(dBIC < -10)){ setParams(model, vIso); return { rejected: true, dBIC }; }
  setParams(model, best.v);
  return { res: best.res, info: { type: q.shapeType, starts: starts.length, full: finals.length,
    chi2Iso: chiTot(res), chi2: cb, Piso: res.stats.P, P: best.res.stats.P, N, chi2redIso: res.stats.chi2, held, dBICfree, dBICheld, freeOff, freeW } };
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
    // With the free shape there is no one size: shapeOf gives its three.
    const shape = shapeActive(q, v);
    return { id: q.id, name: q.name, Ys: Ysam, Xs: Xsam, YsEsd: sY, XsEsd: sX,
             D: shape ? NaN : D, Desd: shape ? NaN : Ysam > 0 ? D*sY/Ysam : NaN, strain: Xsam > 0 ? Xsam*D2R/4 : 0, strainEsd: sX*D2R/4,
             instrumentSubtracted: !!irf, shape };
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

export { buildModel, calc, refine, cellSearch, autoRefine, sizeStrain, weightFractions, shapeOf, columnLengthV, SHAPE_TYPES, shapeTypeOf,
         solveLinear, getParams, setParams, rStats, tch, profileAtTheta, displacementMm,
         fcjNodes, addPeak, addPeakFCJ, shapeActive, HG2_FLOOR, K_SCHERRER, cellOf, siteU, lowIndexPlanes, PROFILES, faultOf };
