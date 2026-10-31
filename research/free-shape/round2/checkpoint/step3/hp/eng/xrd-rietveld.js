/* =========================================================
   XRD RIETVELD — the pattern model and its refinement.
   A Bragg–Brentano powder pattern computed from the phases' structures and refined
   by Levenberg–Marquardt. Pure functions on plain objects: no DOM, importable by the
   page, a module Worker and Node.
   The model, for every point 2θ_i:
     y_c = bg(2θ_i) + Σ_phases S Σ_hkl Σ_{α1,α2} w_j·m·LP·F²·exp(−2ΔB s²)·Φ(2θ_i − 2θ_kj)
   with Φ the Thompson–Cox–Hastings pseudo-Voigt made asymmetric by the axial divergence
   (through the Soller slits the file gives, Cheary–Coelho's full axial model with one
   length L: sollerNodes; else Finger–Cox–Jephcoat, one parameter (S + H)/L: fcjNodes),
   the lines at 2θ_kj with the zero, the displacement (cos θ) and a sin 2θ shift, the
   instrument's U, V, W, X, Y and axial divergence shared by the phases and each phase's
   own Lorentzian Xs, Ys on top, the background a Chebyshev
   series plus a 1/2θ term, and Mighell's χ²_γ: the target y + min(y, m), the weights
   1/σ², σ² = (y + m)·m, m = varMul (one count in the units of y). Weighting by the observed
   counts as plain 1/max(y, 1) (GSAS, FullProf) pulls the background about a count per
   point low and, below about 20 counts, biases the scales (+0.5 % at 10, +1.4 % at 5,
   −4.6 % at 2); χ²_γ removes the first and most of the second (buildModel).
   Parameters are named ('zero', 'disp', 'U', 'asym', 'bg0', 'bgInv', 'p1.scale', 'p1.a',
   'p1.B', 'p1.Ys', …: 'p' + the phase's id) and kept in one vector with a registry
   beside it, so a result travels as a plain {name: value} object, and calc() redraws
   it on a model built again from the same inputs.
========================================================= */
import { metric, reflections, latticeNames, latticeParams, cellFrom, cellMass, atomOrbits, siteAdpBasis, adpU, betaOf } from './xrd-cryst.js';
import { lineForWavelength, f0, fprime, atomicMass } from './xrd-data.js';
import { noiseCountScale } from './xrd-instr.js';
import { WPPM_OPT, wppmLine, wppmPair, wppmPoints, WPPM_N_MAX, lineFwhm, addMemberCoef, quarticInvariants, evalQuartic, faultTable, faultKappa } from './xrd-broad.js';
import { gaussLegendre, lowerBound, inv3n, hklText } from './xrd-math.js';
import { SIZE_LINE } from './xrd-sizeline.js';

const D2R = Math.PI/180, R2D = 180/Math.PI;
const LN2 = Math.LN2;
const CU = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5 };
const GRAPHITE_D = 3.3539;     // Å, graphite (002): the usual monochromator crystal
/* H_G² never reaches 0, whatever U, V, W do. On this floor the U, V, W derivatives vanish
   (or, from a step off it, follow the step), so refine() keeps the quadratic ≥ 0 over the
   pattern when V is refined, and reports U, V, W as on a bound when the floor is reached. */
const HG2_FLOOR = 1e-8;        // deg²
const K_SCHERRER = 0.9;        // as the Analysis card's Scherrer sizes
/* The upper bound of a phase's Y_s and of a solid's widths: the width of crystallites
   D_MIN across, K·λ₁/D_MIN (9.9° at Cu Kα₁, 4.6° at Mo, 14.8° at Cr). The fixed 10° of
   v426 meant 0.79 nm at Cu, 0.37 nm at Mo and 1.2 nm at Cr: now one size for every
   anode, under §6.4's plausible limit (max(1 nm, two cells)). */
const D_MIN = 8;               // Å
/* The profile is evaluated within ±max(WIN_FWHM·H, WIN_MIN) of each peak, and further for a
   line whose tail stands above the noise there (lineHalf). A Lorentzian
   still holds 2/π·atan(1/(2·40)) ≈ 0.8 % of its area beyond 40 FWHM, and cutting it there
   would leave a step at both ends of the window. So the Lorentzian part is lowered by its
   own value at the window's edge, which takes it continuously to zero there. It is not
   renormalised: I stays the area of the whole, untruncated peak, as a measured peak has
   it, and what the window leaves out (1.6·η % at 40 FWHM, the far tails and the pedestal
   under the window, slow and almost flat) goes to the background, which follows it as it
   follows the data's own tails. Renormalising inside the window instead made the fitted
   intensities 1.6·η % low, by an η that differs between phases. The Gaussian part is zero
   long before the edge.
   WIN_MIN: synchrotron-sharp lines (H 0.002°, λ 0.4 Å, 10⁵ counts) drawn over 40·H alone
   came out 0.8 % broad (3.8 esd) with the strain 44 % low; over 1.5° within 0.15 esd. It
   costs WPPM's sharpest lines their grid: under H ≈ 0.0006° the window needs more than
   N_MAX points, and the line is 0.15 % of its peak off. */
const WIN_FWHM = 40;
const WIN_MIN = 1.5;           // deg
const COARSE_WIN = 10;         // FWHM: the cell search's coarse pass (cellSearch)
const MIN_POINTS = 10;         // fewer weighted points than this: no refinement is possible
// Lattice lengths may move within ±LAT_RANGE of the file's, angles within ±LAT_ANGLE
// (inside 1–179°): latBounds. The reflection list reaches every d that a cell within
// these bounds brings into the range (latticeStretch). ±10 % holds what the cell search
// reaches (±5 %, with room beyond for the refinement: at ±5 %, a cell the search found 5.5 %
// off ended on the bound; a lone phase's second search, ±10 %); ±15° moves a d about as
// far (d₁₀₁ = a·cos(β/2) for a = c: +12/−14 %). A cellRange setting over 5 % widens the
// lengths' bounds to twice it (buildModel's latRange).
const LAT_RANGE = 0.1;
const LAT_ANGLE = 15;          // deg
const OCC_MAX = 2;             // a refined occupancy's upper bound (occSetup)
const BG_DEGREE = 6;           // the Chebyshev background's degree (a fit setting, bgDegree)
// Whether the background has its 1/2θ term, for a pattern starting at x0 (°) and the fit
// setting bgInv (true, false or 'auto'): automatic, on where air scatter rises, a pattern
// starting below BG_INV_BELOW; never one that reaches 2θ ≤ 0, where 1/2θ is undefined.
// (buildModel, autoRefine and the card's settings; up to v479 each wrote the rule out.)
const BG_INV_BELOW = 20;       // deg
const bgInvOn = (x0, bgInv) => x0 > 0 && (bgInv != null && bgInv !== 'auto' ? !!bgInv : x0 < BG_INV_BELOW);
/* (S + H)/L to start the asymmetry's refinement from (at 0 it has no derivative). Its effect
   grows as A², so a Gauss–Newton step from A₀ aims at about (A₀² + A²)/(2A₀): from above it
   comes down to A, from far below it overshoots. A quarter of its bound (0.2) keeps every
   value the box allows at most 4× above the start. On synthetic LaB6, Si and corundum
   standards (A 0.005–0.2, two profiles, from 10° and 20°) 0.05 and 0.08 ended at the same
   A and χ² in all 38 cases; 0.02, the earlier start, let A fall to 0 on Si at A = 0.2 (the
   zero and the displacement took up the shift, χ²_ν 96–104), and 0.005 also at 0.15. */
const ASYM_START = 0.05;
// The axial length (mm) of the sample and the receiver, equal, that the Soller model's
// refinement starts from (sollerNodes); its bounds.
const AX_START = 15, AX_MIN = 0.5, AX_MAX = 80;
// The source's axial length (mm) when the file gives none: a long-fine-focus tube's 12 mm.
const AX_SOURCE = 12;
// Rwp values this close (relative) are a tie on a scan: a flat curve, no minimum there.
const TIE = 1e-9;

/* ---------- small numerics ---------- */
// Chebyshev polynomials T_0..T_N at u ∈ [−1, 1] by the recurrence (stable on the interval).
function chebyshev(u, N, out){
  out[0] = 1; if (N >= 1) out[1] = u;
  for (let k = 2; k <= N; k++) out[k] = 2*u*out[k-1] - out[k-2];
  return out;
}
/* Cholesky factor of a symmetric positive (semi)definite m×m matrix. The matrices here
   are correlation-scaled (unit diagonal), so the pivot tolerance is relative by
   construction: a pivot below `tol` means that parameter is (numerically) a combination
   of the others — its row is dropped (its step is 0, its variance NaN) and listed in `bad`.
   `tied`: for each dropped j, [j, the kept k it is a combination of]. Its column is
   A_j ≈ Σ c_k A_k with Lᵀc = (row j of L); a k with |c_k| > √tol moves with j along the
   direction the data do not see (√tol is the column's residual off that span, so a
   smaller c_k cannot be told from it). The inverse gives such a k the variance it has
   with j held: conditional, not its own. A zero column ties to nothing. */
const CHOL_TOL = 1e-10;
function cholesky(A, m, tol = CHOL_TOL){
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
  const tied = bad.map(j=>{
    const c = new Float64Array(j), t = [j], cut = Math.sqrt(tol*Math.max(1, A[j*m + j]));
    for (let k = j - 1; k >= 0; k--){
      const lkk = L[k*m + k]; if (!lkk) continue;
      let s = L[j*m + k]; for (let i = k + 1; i < j; i++) s -= L[i*m + k]*c[i];
      c[k] = s/lkk;
      if (Math.abs(c[k]) > cut) t.push(k);
    }
    return t;
  });
  return { L, bad, tied };
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
// The same with a Gaussian size width G (°, before the 1/cosθ, as Y) added in quadrature:
// the free shape's lsq size line (sizeLineKs).
function profileAtThetaG(th, U, V, W, X, Y, G){
  const t = Math.tan(th), c = Math.cos(th), g = G/c;
  const HG = Math.sqrt(Math.max(HG2_FLOOR, U*t*t + V*t + W) + g*g);
  const HL = Math.max(0, X*t + Y/c);
  return tch(HG, HL);
}
/* The half-width (°) a line of FWHM H, mixing eta and area A (in the units of y times
   degrees, the scale included) is drawn over: ±max(WIN_FWHM·H, WIN_MIN), and as far as its
   Lorentzian part, ηA·H/(2π x²) beyond a few H, stays above TAIL_NOISE of the pattern's
   typical noise (model.noise0). What the window leaves out, the step its lowered edge
   leaves inside and the tail beyond, is then under a tenth of the noise wherever it is
   too narrow for the background to take up. Measured on synthetic patterns drawn with
   their lines' whole tails (four two-phase and one-phase cases, 2·10⁴–2·10⁵ counts, lab
   and synchrotron widths): with 40 FWHM alone a sharp pattern of 2·10⁵ counts came out
   with sizes 1.5 % (5.6 esd) and a strain 7 % (3.3 esd) off and χ²_ν 1.18; drawn to a
   tenth of the noise every size, strain, B and weight fraction is within 0.3 esd and χ²_ν
   1.01 (a third: within 0.45 esd; a thirtieth: 0.2). Weak lines keep 40 FWHM. At most the
   pattern's span: a window that covers the whole pattern is lowered by a constant there,
   which the background takes (a 10⁷-count line on 1 count of background had asked for
   2230°). (Not in the cell search's coarse pass, which narrows the window on purpose.) */
const TAIL_NOISE = 0.1;
function lineHalf(model, H, eta, A){
  const half = Math.max(model.win*H, WIN_MIN);
  if (model.win < WIN_FWHM || !(A > 0) || !(eta > 0) || !(model.noise0 > 0)) return half;
  return Math.max(half, Math.min(model.x1 - model.x0, Math.sqrt(eta*A*H/(2*Math.PI*TAIL_NOISE*model.noise0))));
}
// Area-normalised pseudo-Voigt of FWHM H and mixing eta, centred at c, times I, added to
// out over the window (see WIN_FWHM for the Lorentzian's treatment at the edges); `win`
// the window in FWHM (lineHalf's over H; the cell search's coarse pass narrows it).
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
// One line spread by the axial divergence's nodes (lineNodes, axialNodes): none, the one
// peak; one node, the peak at its shift; more, addPeakFCJ over them. (The refinement's
// lines and xrd-widths' single peaks; up to v479 each wrote the three cases out.)
function addLine(out, x, c, H, eta, I, nodes, win = WIN_FWHM){
  if (!nodes) addPeak(out, x, c, H, eta, I, win);
  else if (nodes.length === 1) addPeak(out, x, c + nodes[0].d, H, eta, I, win);
  else addPeakFCJ(out, x, c, H, eta, I, nodes, win);
}

/* Axial divergence: Finger, Cox & Jephcoat, J. Appl. Cryst. 27 (1994) 892, with the
   sample's and the receiving slit's half-heights equal (S = H), so one parameter
   A = (S + H)/L, L the goniometer radius, as GSAS-II's SH/L. (Where they differ the
   standard fits worse and the samples inherit it: at S/H = 0.5, χ²_ν 33 on a synthetic
   LaB6 of 5·10⁴ counts and a monoclinic cell 28 esd off; at 0.82, 1.26 and 3 esd.)
   A ray that leaves the diffraction plane by h·L over L meets the Debye cone of a
   reflection at 2θ where
   cos 2φ = cos 2θ·√(1 + h²): below 2θ = 90° the peak gains a tail towards low angles,
   above it towards high angles, none at 90°. h runs over [0, A]; FCJ's weight
   W(2φ) = (A − h)/(h·|cos 2φ|) — the overlap of sample and slit heights over the cone's
   spread — is, per unit h, (A − h)/((1 + h²)·sin 2φ): finite at h = 0, where in 2φ it
   has an integrable singularity at the peak, so Gauss–Legendre in h converges fast. The
   shift goes as h², up to ≈ −A²/2·cot 2θ (the centroid −A²/12·cot 2θ, radians).
   → nodes [{ d (deg, 2φ − 2θ), w }] with Σw = 1, enough of them that neighbouring shifts
   lie well within the peak's width H; one node at the mean shift when the whole tail is
   a small part of H (a broad peak, or near 90°). */
/* Nodes: n = ⌈4|dMax|/H⌉ + 2, neighbouring shifts H/4 apart on average and at most about
   H/2 (Gauss–Legendre nodes in h, the shift ∝ h²), the profile then within about 0.04 %
   of the peak of the exact one; FCJ_MAX_NODES at most, which only a tail over 1000 H
   long needs. Below 2θ = atan A the cone's tail ends at
   hMax = |tan 2θ| < A, where the weight has a 1/√(hMax − h) singularity: there
   h = hMax·(1 − u²) takes it out. `nForce` holds the count (and the one-node collapse,
   n = 1) fixed: the Jacobian's two displaced points must not differ by a change of
   quadrature (a node more at one of them moved a derivative by 10 %). The count used is
   left on the array as .n, and the count a longer tail would need over it as .short. */
/* The cap is for cost alone: a line's cost grows with its nodes (2.7 → 20 ms for 300 →
   2358 nodes at a step of H/3). Against a dense quadrature, v425's 300 drew lab lines up
   to 1 % of the peak off (2θ = 5°, H 0.02°, A 0.1; 3.8 % at 8° with A 0.15) and
   synchrotron-sharp ones 2–4.5 % (H 0.003–0.005° at 4°, A 0.058). 4000 hold all of them
   within 0.015 %. A tail over 1000 H long would need more: with 1.5 times too few nodes
   it ripples by up to 0.035 % of the peak, 0.15 % at 2, 0.8 % at 3, 2.7 % at 5 (six
   tails 750–3000 H long, 2θ 3–177°, A 0.058–0.15), and autoRefine warns (model.fcjShort). */
const FCJ_MAX_NODES = 4000;
const FCJ_G3 = 0.5;         // |dMax|/H below which three Gauss nodes stand for the tail (within 0.01 % of the peak)
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
/* The n-point Gauss quadrature of a discrete distribution (points x, weights w, Σw = 1):
   Lanczos' recurrence for its orthonormal polynomials, in x centred and scaled by its
   spread, then the Jacobi matrix's eigenvalues and the squares of their eigenvectors'
   first components (Golub–Welsch; implicit QL, as Numerical Recipes' tqli, rotating the
   first row alone). Exact for polynomials in x up to degree 2n − 1. → [{ d, w }] sorted,
   or null where the distribution has fewer than n points or no spread. */
function gaussN(x, w, n){
  const m = x.length;
  let mu = 0, v2 = 0;
  for (let i = 0; i < m; i++) mu += w[i]*x[i];
  for (let i = 0; i < m; i++) v2 += w[i]*(x[i] - mu)*(x[i] - mu);
  const sg = Math.sqrt(v2);
  if (!(sg > 0) || m < n) return null;
  const z = new Float64Array(m); for (let i = 0; i < m; i++) z[i] = (x[i] - mu)/sg;
  let q0 = new Float64Array(m), q1 = new Float64Array(m).fill(1), r = new Float64Array(m);
  const a = new Float64Array(n), e = new Float64Array(n);
  let bPrev = 0;
  for (let k = 0; k < n; k++){
    let ak = 0; for (let i = 0; i < m; i++) ak += w[i]*z[i]*q1[i]*q1[i];
    a[k] = ak;
    if (k === n - 1) break;
    let nb = 0; for (let i = 0; i < m; i++){ r[i] = (z[i] - ak)*q1[i] - bPrev*q0[i]; nb += w[i]*r[i]*r[i]; }
    const b = Math.sqrt(nb);
    if (!(b > 1e-12)) return null;
    e[k] = b; bPrev = b;
    for (let i = 0; i < m; i++) r[i] /= b;
    const t = q0; q0 = q1; q1 = r; r = t;
  }
  // implicit QL on the tridiagonal (a, e), z0 the eigenvectors' first components
  const d = a, z0 = new Float64Array(n); z0[0] = 1;
  for (let l = 0; l < n; l++){
    for (let it = 0; it < 60; it++){
      let mm = l;
      for (; mm < n - 1; mm++){ const dd = Math.abs(d[mm]) + Math.abs(d[mm + 1]); if (Math.abs(e[mm]) <= 1e-15*dd) break; }
      if (mm === l) break;
      let g = (d[l + 1] - d[l])/(2*e[l]), rr = Math.hypot(g, 1);
      g = d[mm] - d[l] + e[l]/(g + (g >= 0 ? rr : -rr));
      let sn = 1, cs = 1, p = 0, i = mm - 1;
      for (; i >= l; i--){
        let f = sn*e[i]; const bb = cs*e[i];
        rr = Math.hypot(f, g); e[i + 1] = rr;
        if (rr === 0){ d[i + 1] -= p; e[mm] = 0; break; }
        sn = f/rr; cs = g/rr; g = d[i + 1] - p; rr = (d[i] - g)*sn + 2*cs*bb; p = sn*rr; d[i + 1] = g + p; g = cs*rr - bb;
        f = z0[i + 1]; z0[i + 1] = sn*z0[i] + cs*f; z0[i] = cs*z0[i] - sn*f;
      }
      if (rr === 0 && i >= l) continue;
      d[l] -= p; e[l] = g; e[mm] = 0;
    }
  }
  const out = [];
  for (let j = 0; j < n; j++) out.push({ d: mu + sg*d[j], w: z0[j]*z0[j] });
  return out.sort((p, q)=> p.d - q.d);
}
function fcjNodes(th, A, H, nForce){
  const tt = 2*th, c2 = Math.cos(tt);
  if (!(A > 0) || Math.abs(c2) < 1e-12) return null;
  const hTan = Math.abs(Math.tan(tt)), cut = hTan < A;
  const hMax = cut ? hTan*(1 - 1e-12) : A;
  const phiOf = h => Math.acos(Math.max(-1, Math.min(1, c2*Math.sqrt(1 + h*h))));
  const dMax = (phiOf(hMax) - tt)*R2D;
  // A tail under 5 % of the width: one node at the mean shift. Its error goes as
  // 15.6·(|dMax|/H)² % of the peak (0.039 % at 5 %, 0.056 % at 6 %): 5 % is the largest that
  // keeps the full count's 0.04 %.
  const collapse = nForce ? nForce === 1 : Math.abs(dMax) < 0.05*H;
  // A tail shorter than the width: three nodes, the Gauss quadrature of the shift's own
  // distribution (exact for its first six moments), instead of one every quarter width or so.
  const gauss3 = !collapse && (nForce ? nForce === 3 : Math.abs(dMax) < FCJ_G3*H);
  const need = Math.max(4, Math.ceil(4*Math.abs(dMax)/Math.max(H, 1e-4)) + 2);
  const n = collapse ? 4 : gauss3 ? 24 : nForce || Math.min(FCJ_MAX_NODES, need);
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
  if (!nForce && need > n) out.short = need/n;     // nodes the tail would need, over those used
  return out;
}

/* The FCJ nodes of one line of one reflection. Under model.fcjFreeze (for the whole of a
   refine(), its Jacobians included) the count is fixed at the line's
   first use, so that χ² is a smooth function of the parameters throughout the
   refinement: a count that changed with U..Y or the asymmetry moved χ² in steps and a
   derivative by up to 10×. refine() checks the counts at its end (model.fcjAudit) and
   runs again when the widths or the asymmetry have outgrown them. The largest shortfall
   of a tail longer than FCJ_MAX_NODES allow is kept in model.fcjShort. */
function lineNodes(model, key, th, A, H, tol, interp){
  // A search for where the peaks are needs only where each one's weight lies: its
  // centroid (cellSearch; the asymmetry costs it nothing then).
  if (model.fcjCentroid) return typeof A === 'object' ? sollerCentroid(th, A) : axialNodes(th, A, H, 1);
  // The Soller model's nodes cost a few thousand angles a line: a line whose θ, width and
  // geometry are those of its last call (most of a Jacobian's columns: the scales, the
  // background, B, the zero) takes them again.
  if (typeof A === 'object'){
    const cache = model.axCache || (model.axCache = new Map()), n0 = model.fcjFreeze ? model.fcjFreeze.get(key) : undefined;
    // (A line first met under a hold goes through lineNodesOf, which records its count:
    // taken from here, the audit after the refinement found none recorded and ran again.)
    const c = cache.get(key);
    if (c && c.th === th && c.H === H && c.tol === tol && c.g === A.key && c.n0 === n0 && c.ip === !!interp && !model.fcjAudit && !(model.fcjFreeze && n0 === undefined)) return c.nodes;
    const nodes = lineNodesOf(model, key, th, A, H, tol, interp);
    cache.set(key, { th, H, tol, g: A.key, n0: model.fcjFreeze ? model.fcjFreeze.get(key) : undefined, ip: !!interp, nodes });
    return nodes;
  }
  return lineNodesOf(model, key, th, A, H);
}
function lineNodesOf(model, key, th, A, H, tol, interp){
  const fz = model.fcjFreeze;
  if (!fz){
    const nd = axialNodes(th, A, H, undefined, tol, interp), au = model.fcjAudit;
    if (nd && nd.short > (model.fcjShort || 1)) model.fcjShort = nd.short;
    // refine()'s check after a refinement: has a line outgrown its held count?
    // (A count down to 1/1.13 of the one needed leaves the profile within 0.1 % of the
    // peak: 0.091 % at worst over 2θ 6–174°, H 0.005–0.3°, A 0.01–0.15, where 1/1.15
    // left 0.106 % and 1/1.25 0.17 %; 1.13 cost no extra pass on seven patterns. The
    // cell moving a line by a node or two is no reason to start again.)
    if (au && nd){ const f = au.get(key); if (f === undefined || f === 0 || (f <= 3 ? nd.n > f : nd.n > 1.13*f)) model.fcjBehind = true; }
    return nd;
  }
  let n = fz.get(key);
  if (n === undefined){
    const nd = axialNodes(th, A, H, undefined, tol, interp);
    n = nd ? nd.n : 0;
    fz.set(key, n);
    if (nd && nd.short > (model.fcjShort || 1)) model.fcjShort = nd.short;
    return nd;
  }
  return axialNodes(th, A, H, n || undefined, tol, interp);
}

/* Axial divergence through Soller slits: the full axial model of Cheary & Coelho, J. Appl.
   Cryst. 31 (1998) 851, 862. FCJ's geometry has no Soller slits: the sample and the slit
   limit the rays alone. An instrument with Sollers on both sides (their acceptance ψ1, ψ2
   in the file: 0.04 rad on the user's) passes rays up to about ψ out of the plane, each
   with the Soller's triangular transmission 1 − |β|/ψ, and FCJ's one parameter could draw
   neither the tail's reach nor its shape: on the user's LaB6 the strong low-angle lines
   kept χ²_ν 185 and 114 in their windows, and their zero, displacement and widths, which
   the whole pattern shares, left the last line 15 % short at its top. A ray from the
   source at z_s (along the axis) to the sample at z_m, out of the plane by
   β1 = (z_m − z_s)/R, is diffracted towards the receiver at z_r, β2 = (z_r − z_m)/R, where
     cos 2φ = (cos 2θ − sin β1 sin β2)/(cos β1 cos β2)
   (to second order 2φ − 2θ = −(β1² + β2²)/2·cot 2θ + β1β2/sin 2θ; the exact form is used:
   with Sollers of 0.04 rad the second order misplaces the widest rays by 0.9° of their 3.0°
   at 5°, 0.007° at 20°). The weight of (β1, β2) is the Sollers'
   transmissions times the length of z_m that the sample, the source seen at β1 and the
   receiver seen at β2 have in common. The source's length Lx is the tube's focus (12 mm
   on a long fine focus); the sample's and the receiver's axial lengths are taken equal, L,
   the one parameter refined, as FCJ takes S = H: on the user's LaB6 the two traded off
   (each with the other refined, χ²_ν 2.20–2.31 for the sample 15–25 mm) and Lx made no
   difference (8 or 12 mm: 2.185, 2.189). The Sollers' acceptances are the file's, not
   refined (0.05 rad would have given 2.06, 0.03 rad 5.3). With the sin 2θ shift beside it
   (autoRefine), the user's LaB6 went from χ²_ν 4.37 to 2.17, its (100) from 185 to 37 and
   its last line from 24.5 to 6.2.
   The grid: SOLLER_N × SOLLER_N cells over β1/ψ1, β2/ψ2 ∈ [−1, 1], each weighed by 4 × 4
   points; a cell's shifts, from its corners, as their mean (with the centre's curvature:
   exact for a quadratic) and their variance (linear across the cell). A line's cells,
   which depend on θ and the geometry alone, are gathered into SOLLER_SUB sub-bins and kept
   (sollerCells); its nodes then, by the spread of its shifts against its width H:
   - under 5 % of H, or where one node's error (4·(σ/H)² of the peak, σ the shifts' spread)
     is within the line's tolerance (sollerTol: a tenth of the noise at its top, at least
     0.04 %), one node at the mean;
   - up to SOLLER_GAUSS_MAX nodes, the distribution's own Gauss quadrature (gaussN): two
     where their error (70·(σ/H)⁴) is within it, three to a spread of one H, three more for
     each H beyond (the rule depends on n alone, and is kept with the cells);
   - beyond, bins H/6 wide: each sub-bin's weight shared between the two bins about its
     mean by its distance from each, and every bin giving two nodes that keep its weight,
     mean and variance, so that the profile has the distribution's first two moments
     exactly (shared as point weights by the same rule, a bin's own spread, h²/6, had been
     added to every line: 3 % on its width at h = H/4).
   Against 300 × 300 points with the exact shift (two Sollers of 0.04 rad, L 10 and 30 mm,
   Lx 12 mm, R 240 mm; H 0.01–1.5°, η 0.5–0.97): within 0.03 % of the peak where Gauss's
   rule is used (from 2θ = 21° to 142°), within 0.07 % binned from 10° (0.66 % at 5°, where
   a line 0.03° wide spreads over 3°). The cells and bins were chosen on these: 48 cells and
   bins of H/4 left 0.11–0.17 %; 96 and H/8, 0.025 % for twice the time; Gauss's rule
   beyond 24 nodes loses the recurrence's orthogonality (0.1–0.25 % at 38–150). The cost, on
   the user's 33A with a free ellipsoid, occupancy and ΔB: the search 32 s and the angular
   esds 13 s (FCJ: 38 and 12 s); 37D 20 and 16 s (26 s); with the tolerance at 0.04 % for
   every line, 58–73 and 24–26 s, the Sollers' spread on both sides needing two or three
   nodes on every line where FCJ's one-sided tail had collapsed to one.
   → nodes [{ d (deg), w }], Σw = 1, with .n the count (SOLLER_BINNED for the bins), which
   lineNodes holds during a refinement. */
const SOLLER_N = 64, SOLLER_BIN = 6, SOLLER_SUB = 400;     // cells per axis; bins per FWHM; a line's sub-bins
const SOLLER_GAUSS = 3, SOLLER_GAUSS_MAX = 24;            // Gauss nodes per FWHM of spread beyond one, at most
const SOLLER_BINNED = 10000;                             // the binned regime's count, for lineNodes' hold
const SOLLER_CACHE = new Map();
function sollerGrid(g){
  const key = g.key;
  let G = SOLLER_CACHE.get(key);
  if (G) return G;
  const N = SOLLER_N, S = 4, { L, Lx, p1, p2, R } = g;
  const tri = t => 1 - Math.abs(t);
  const cells = [];
  let sw = 0, ms = 0, mp = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++){
    let w = 0, s = 0, p = 0;
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++){
      const t1 = -1 + (2*i + (2*a + 1)/S)/N, t2 = -1 + (2*j + (2*b + 1)/S)/N, b1 = p1*t1, b2 = p2*t2;
      const lo = Math.max(-L/2, R*b1 - Lx/2, -R*b2 - L/2), hi = Math.min(L/2, R*b1 + Lx/2, -R*b2 + L/2);
      if (!(hi > lo)) continue;
      const wq = tri(t1)*tri(t2)*(hi - lo);
      w += wq; s += wq*(b1*b1 + b2*b2)/2; p += wq*b1*b2;
    }
    if (w > 0){ cells.push(i, j, w); sw += w; ms += s; mp += p; }
  }
  const nc = cells.length/3, ci = new Int32Array(nc), cj = new Int32Array(nc), cw = new Float64Array(nc);
  for (let c = 0; c < nc; c++){ ci[c] = cells[3*c]; cj[c] = cells[3*c + 1]; cw[c] = cells[3*c + 2]/sw; }
  // the corners' and the centres' sines and cosines, along each axis
  const trig = (p, half) => { const n = half ? N : N + 1, sn = new Float64Array(n), cs = new Float64Array(n);
    for (let i = 0; i < n; i++){ const b = p*(-1 + (2*i + (half ? 1 : 0))/N); sn[i] = Math.sin(b); cs[i] = Math.cos(b); } return { sn, cs }; };
  // (the axial angles themselves at the corners and the centres, for the second order)
  const ang = (p, half) => Float64Array.from({ length: half ? N : N + 1 }, (_, i)=> p*(-1 + (2*i + (half ? 1 : 0))/N));
  G = { ci, cj, cw, ms: ms/sw, mp: mp/sw, c1: trig(p1, false), c2: trig(p2, false), t1c: ang(p1, false), t2c: ang(p2, false), t1m: ang(p1, true), t2m: ang(p2, true), empty: !(sw > 0) };
  if (SOLLER_CACHE.size > 64) SOLLER_CACHE.clear();
  SOLLER_CACHE.set(key, G);
  return G;
}
/* A line's cells: their shifts' means and variances, which depend on θ and the geometry
   alone (the width only bins them): kept for the last SOLLER_LINES_MAX lines, so that a
   refinement recomputes them only where θ or L moved (on the user's samples, refined in
   4–5 s with them computed at every call, against under 1 s with FCJ). The least recently
   used goes first, and 2048 are kept (512 up to round 2's free-shape step 2): a Jacobian's
   column of a cell parameter moves every line's θ, and the oldest dropped first then took
   the lines at v with it, to be computed again at the next column; and WPPM's lines keep two
   cells each (sollerStats), 856 for a triclinic phase's 214 reflections. The same numbers,
   kept longer. */
const SOLLER_LINES = new Map(), SOLLER_LINES_MAX = 2048;
function sollerCells(th, g){
  const key = g.key + '|' + th;
  let C = SOLLER_LINES.get(key);
  if (C){ SOLLER_LINES.delete(key); SOLLER_LINES.set(key, C); return C; }
  const G = sollerGrid(g);
  const tt = 2*th, c2 = Math.cos(tt), s2 = Math.sin(tt);
  if (G.empty || Math.abs(s2) < 1e-9) return null;
  const N = SOLLER_N, ci = G.ci, cj = G.cj, cw = G.cw, nc = cw.length;
  // 2φ − 2θ (deg) at a corner or a centre of the grid. Below 2θ = β1 + β2 (4.6° for two
  // Sollers of 0.04 rad) a ray can miss the cone: it is put at its edge.
  const at = (A, B, i, j) => { const v = (c2 - A.sn[i]*B.sn[j])/(A.cs[i]*B.cs[j]); return (Math.acos(v > 1 ? 1 : v < -1 ? -1 : v) - tt)*R2D; };
  const corner = new Float64Array((N + 1)*(N + 1)).fill(NaN), cAt = (i, j) => { const k = i*(N + 1) + j; let e = corner[k]; if (e !== e){ e = at(G.c1, G.c2, i, j); corner[k] = e; } return e; };
  // A centre's shift: the corners' mean, less the curvature the second order gives the cell
  // (two Sollers of 0.04 rad: within 5·10⁻⁵° of the exact centre from 10°, 3·10⁻³° at 5°;
  // an arccosine a cell fewer).
  const a2 = -c2/s2*R2D/2, b2 = R2D/s2, sec = (x, y) => a2*(x*x + y*y) + b2*x*y;
  const t1c = G.t1c, t2c = G.t2c, t1m = G.t1m, t2m = G.t2m;
  const mu = new Float64Array(nc), va = new Float64Array(nc);
  let lo = Infinity, hi = -Infinity, mean = 0;
  for (let c = 0; c < nc; c++){
    const i = ci[c], j = cj[c], e00 = cAt(i, j), e10 = cAt(i + 1, j), e01 = cAt(i, j + 1), e11 = cAt(i + 1, j + 1);
    const em = (e00 + e10 + e01 + e11)/4 + sec(t1m[i], t2m[j]) - (sec(t1c[i], t2c[j]) + sec(t1c[i + 1], t2c[j]) + sec(t1c[i], t2c[j + 1]) + sec(t1c[i + 1], t2c[j + 1]))/4;
    const m = (2*em + (e00 + e10 + e01 + e11)/4)/3, a = (e10 - e00 + e11 - e01)/2, b = (e01 - e00 + e11 - e10)/2;
    mu[c] = m; va[c] = (a*a + b*b)/12; mean += cw[c]*m;
    const cl = Math.min(e00, e10, e01, e11), ch = Math.max(e00, e10, e01, e11);
    if (cl < lo) lo = cl; if (ch > hi) hi = ch;
  }
  // Gathered into SOLLER_SUB bins across [lo, hi] as the bins below gather them (weight,
  // mean, variance, the cells' own variance in it): binned again at each width, a line
  // costs SOLLER_SUB steps instead of a step a cell (on the user's 33A, a free ellipsoid's
  // members took the search from 44 s with FCJ to 79 s, binned cell by cell).
  const M = SOLLER_SUB, hs = Math.max(hi - lo, 1e-12)/(M - 2), q0 = new Float64Array(M + 1), q1 = new Float64Array(M + 1), q2 = new Float64Array(M + 1);
  for (let c = 0; c < nc; c++){
    const x = (mu[c] - lo)/hs + 0.5, k = Math.floor(x), f = x - k, w = cw[c], m = mu[c], q = m*m + va[c];
    q0[k] += w*(1 - f); q1[k] += w*(1 - f)*m; q2[k] += w*(1 - f)*q;
    q0[k + 1] += w*f; q1[k + 1] += w*f*m; q2[k + 1] += w*f*q;
  }
  const keep = []; for (let k = 0; k <= M; k++) if (q0[k] > 1e-15) keep.push(k);
  const muS = new Float64Array(keep.length), vaS = new Float64Array(keep.length), cwS = new Float64Array(keep.length);
  keep.forEach((k, n)=> { const m = q1[k]/q0[k]; muS[n] = m; vaS[n] = Math.max(0, q2[k]/q0[k] - m*m); cwS[n] = q0[k]; });
  let m2 = 0; for (let c = 0; c < nc; c++) m2 += cw[c]*(mu[c]*mu[c] + va[c]);
  C = { mu: muS, va: vaS, cw: cwS, lo, hi, mean, sd: Math.sqrt(Math.max(0, m2 - mean*mean)) };
  if (SOLLER_LINES.size >= SOLLER_LINES_MAX) SOLLER_LINES.delete(SOLLER_LINES.keys().next().value);
  SOLLER_LINES.set(key, C);
  return C;
}
/* interp (WPPM_OPT.axial, a WPPM line's): where the line takes one node, its shift, spread and
   reach from the cells at the two nearest multiples of SOLLER_DQ in θ, linearly. A Jacobian's
   column of a cell parameter (and a trial step) moves θ by far less than that, and every such
   θ had cost the whole of sollerCells (a few thousand arccosines; on step 1's engine the axial
   nodes took 23 % of a WPPM fit's CPU), now an interpolation between two kept. Linear in θ over
   10⁻⁴ rad: the shift within about 10⁻⁷° of the cells' own at 2θ = 10° (its second derivative
   there ≈ 14°/rad²), continuous in θ; the patterns within 10⁻⁹ of the peak of the cells'
   own (round 2's free-shape step 2). */
const SOLLER_DQ = 1e-4;
function sollerStats(th, g){
  const f = th/SOLLER_DQ, k = Math.floor(f), t = f - k, a = sollerCells(k*SOLLER_DQ, g), b = sollerCells((k + 1)*SOLLER_DQ, g);
  if (!a || !b) return null;
  const l = (p, q) => p + t*(q - p);
  return { mean: l(a.mean, b.mean), sd: l(a.sd, b.sd), lo: l(a.lo, b.lo), hi: l(a.hi, b.hi) };
}
function sollerNodes(th, g, H, nForce, tol = SOLLER_TOL, interp = false){
  if (interp && !(nForce > 1)){
    const st = sollerStats(th, g);
    if (st){
      const r = st.sd/H;
      if (nForce ? nForce === 1 : st.hi - st.lo < 0.05*H || 4*r*r <= tol){ const one = [{ d: st.mean, w: 1 }]; one.n = 1; return one; }
    }
  }
  const C = sollerCells(th, g);
  if (!C) return null;
  const { mu, va, cw, lo, hi, mean, sd } = C, nc = cw.length, span = hi - lo, r = sd/H;
  const collapse = nForce ? nForce === 1 : span < 0.05*H || 4*r*r <= tol;
  if (collapse){ const one = [{ d: mean, w: 1 }]; one.n = 1; return one; }
  // Up to SOLLER_GAUSS_MAX nodes: the distribution's own Gauss quadrature, n from its spread:
  // two while 70·(σ/H)⁴ is within tol, three to a spread of one width, three more a width
  // beyond (within 0.03 % of the peak with three at spreads of 0.2–1.0 H, 0.019 % at 1.3 H
  // with four, 0.015 % at 1.7 H with six).
  const nG = 70*r*r*r*r <= tol ? 2 : span <= H ? 3 : 3 + Math.ceil(SOLLER_GAUSS*(span/H - 1));
  const useG = nForce ? nForce >= 2 && nForce <= SOLLER_GAUSS_MAX : nG <= SOLLER_GAUSS_MAX;
  // (the rule depends on n alone, not on the width: kept with the line's cells)
  if (useG){
    const n = nForce || nG, gc = C.gauss || (C.gauss = new Map());
    let g = gc.get(n);
    if (g === undefined){ g = gaussN(mu, cw, n); if (g) g.n = n; gc.set(n, g); }
    if (g) return g;
  }
  // Bins of width h about k·h: each cell's weight shared between the two bins about its
  // mean, with its mean and variance; then two nodes a bin.
  const need = Math.ceil(span/(H/SOLLER_BIN)) + 2, cap = FCJ_MAX_NODES >> 1;
  const h = need > cap ? span/(cap - 2) : H/SOLLER_BIN, k0 = Math.floor(lo/h) - 1, nb = Math.ceil(hi/h) - k0 + 2;
  const bw = new Float64Array(nb), b1 = new Float64Array(nb), b2 = new Float64Array(nb);
  for (let c = 0; c < nc; c++){
    const x = mu[c]/h - k0, k = Math.floor(x), f = x - k, w = cw[c], m = mu[c], q = m*m + va[c];
    bw[k] += w*(1 - f); b1[k] += w*(1 - f)*m; b2[k] += w*(1 - f)*q;
    bw[k + 1] += w*f; b1[k + 1] += w*f*m; b2[k + 1] += w*f*q;
  }
  const out = [];
  for (let k = 0; k < nb; k++){
    const w = bw[k]; if (!(w > 1e-12)) continue;
    const m = b1[k]/w, sd = Math.sqrt(Math.max(0, b2[k]/w - m*m));
    if (sd > 0){ out.push({ d: m - sd, w: w/2 }, { d: m + sd, w: w/2 }); } else out.push({ d: m, w });
  }
  out.n = SOLLER_BINNED;
  if (need > cap) out.short = need/cap;
  return out;
}
// The cell search's one node: the mean shift, to second order.
function sollerCentroid(th, g){
  const G = sollerGrid(g), s2 = Math.sin(2*th);
  if (G.empty || Math.abs(s2) < 1e-9) return null;
  const one = [{ d: (-G.ms*Math.cos(2*th) + G.mp)/s2*R2D, w: 1 }]; one.n = 1; return one;
}
/* The axial divergence of a model: FCJ's A, a number (none at 0), or the Soller model's
   geometry, an object (axialOf); its nodes, and the reach of its shifts (deg). tol: the
   Soller nodes' error allowed, of the peak (sollerTol). */
function axialNodes(th, A, H, nForce, tol, interp){
  if (A && typeof A === 'object') return sollerNodes(th, A, H, nForce, tol, interp);
  return A > 0 ? fcjNodes(th, A, H, nForce) : null;
}
/* The Soller nodes' error allowed for a line of area Sarea (the scale in it), FWHM H and
   mixing η: a tenth of the pattern's noise at its top (TAIL_NOISE, the window's rule for
   the tails), and never less than SOLLER_TOL of it. The node rules' errors were measured
   against the dense profile: one node 3.5–3.9·(σ/H)² of the peak (σ the shifts' spread),
   two 32–62·(σ/H)⁴; taken as 4 and 70. A sample's broad lines, a few thousand counts high
   and 2–3 % noisy at their top, are then drawn with one or two nodes, the standard's sharp
   ones as finely as before: on the user's 33A with a free ellipsoid, a pattern in 3.5 ms
   instead of 8 (FCJ's 5.3), since the Sollers' spread on both sides had needed two or three
   nodes on every line where FCJ's tail alone collapsed to one. */
const SOLLER_TOL = 4e-4;
function sollerTol(model, Sarea, H, eta){
  const top = Sarea*(eta*2/(Math.PI*H) + (1 - eta)*2*Math.sqrt(LN2/Math.PI)/H);
  return model.noise0 > 0 && top > 0 ? Math.max(SOLLER_TOL, TAIL_NOISE*model.noise0/top) : SOLLER_TOL;
}
const axialOn = A => !!A && (typeof A === 'object' ? !(A.L <= 0) : A > 0);
function axialReach(th, A){
  if (!axialOn(A)) return [0, 0];
  const tt = 2*th;
  if (typeof A === 'object'){
    // the second order's bound, and a tenth more for the exact form
    const B = 1.1*(Math.abs(Math.cos(tt)/Math.sin(tt))*(A.p1*A.p1 + A.p2*A.p2)/2 + A.p1*A.p2/Math.abs(Math.sin(tt)))*R2D;
    return [-B, B];
  }
  const d = (Math.acos(Math.max(-1, Math.min(1, Math.cos(tt)*Math.sqrt(1 + A*A)))) - tt)*R2D;
  return [Math.min(0, d), Math.max(0, d)];
}
// The model's axial divergence at the parameters v: the Soller model where the file gives
// both Sollers (buildModel's model.axial) and it is in use, else FCJ's A.
function axialOf(model, v){
  const ax = model.axial;
  if (!ax || model.axialOff || model.iAx == null) return v[model.iAsym];
  const L = v[model.iAx];
  return { L, Lx: ax.Lx, p1: ax.p1, p2: ax.p2, R: model.radius, key: `${L}|${ax.Lx}|${ax.p1}|${ax.p2}|${model.radius}` };
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
   members' directions are fixed with the cell's metric at the start (idealCell): a
   change of scale leaves them, one of c/a by 1 % moved a cylinder's height by 0.36 %
   (1.9 esd at 3·10⁴ counts).
   The solids (p.shape, true meaning 'ellipsoid'):
   - ellipsoid, spheroid (two axes equal), cylinder, elliptic cylinder (an ellipse
     translated along the axis), box (a rectangular parallelepiped), square box (a box
     with two edges equal, its square turned with it): the affine image
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
   read as the isotropic size is (an ellipsoid's principal sizes are its full axes, a
   cylinder's its diameter and height). With this profile those are Scherrer readings,
   not true dimensions: a least-squares Lorentzian follows a crystallite's line, tails
   and all, and spheres of one size read 1.0–1.7 times their diameter (RIETVELD.md
   §7.2). WPPM reads them as the true ones. */
const SHAPE_NAMES = ['L11', 'L21', 'L22', 'L31', 'L32', 'L33'];
const SHAPE_TYPES = ['ellipsoid', 'spheroid', 'cylinder', 'ellcyl', 'box', 'sqbox', 'ellipsoidL'];
// The bodies: base solid, width parameters (° — a sphere's width for that dimension;
// each solid's own names, so that a result's parameters say which solid it was) and
// how they map onto the body axes x, y, z, and the rotation components refined.
const BODIES = {
  ellipsoid: { base: 'ball', W: ['Ea', 'Eb', 'Ec'], axes: W=> W, rot: 3 },
  spheroid: { base: 'ball', W: ['Wa', 'Wc'], axes: W=> [W[0], W[0], W[1]], rot: 2 },
  cylinder: { base: 'cylinder', W: ['Wd', 'Wh'], axes: W=> [W[0], W[0], W[1]], rot: 2 },
  ellcyl: { base: 'cylinder', W: ['Wa', 'Wb', 'Wh'], axes: W=> W, rot: 3 },
  box: { base: 'cube', W: ['Wa', 'Wb', 'Wc'], axes: W=> W, rot: 3 },
  // A box with a square base (side s, height h along z): two widths, but three turns —
  // a square turned about its normal is another solid.
  sqbox: { base: 'cube', W: ['Ws', 'Wh'], axes: W=> [W[0], W[0], W[1]], rot: 3 },
};
const ROT_NAMES = ['R1', 'R2', 'R3'], QREF_NAMES = ['Q0', 'Q1', 'Q2', 'Q3'];
const shapeTypeOf = p => p === true ? 'ellipsoid' : SHAPE_TYPES.includes(p) ? p : null;
/* shapeNamed(P, pfx) → the solid a result was refined with, from its parameters' names
   (P {name: value}, pfx the phase's 'p' + id + '.'): the one whose widths they name, each
   solid having its own (v420's ellipsoid SHAPE_NAMES), when in use (a width not 0); else
   false. autoRefine's start from the last result and the card's redraw of a result (up
   to v479 the card's own copy named the widths itself, and took a v420 ellipsoid by its
   diagonal alone and a width saved as null, a NaN, for one there). */
const SHAPE_WN = [...new Set([...SHAPE_NAMES, ...Object.values(BODIES).flatMap(B=> B.W)])];
function shapeNamed(P, pfx){
  const on = SHAPE_WN.filter(n=> Object.prototype.hasOwnProperty.call(P, pfx + n) && Number.isFinite(P[pfx + n]));
  const t = SHAPE_TYPES.find(t=> { const W = t === 'ellipsoidL' ? SHAPE_NAMES : BODIES[t].W; return W.length === on.length && W.every(n=> on.includes(n)); });
  return t && on.some(n=> P[pfx + n]) ? t : false;
}

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

function shapeSetup(q, p, cell, list, add, nextIndex, wMax){
  const type = q.shapeType = shapeTypeOf(p.shape);
  if (type === 'ellipsoidL') q.iL = SHAPE_NAMES.map(nm=> { const i = nextIndex(); add(nm, 0, -10, 10); return i; });
  else {
    const B = BODIES[type];
    q.iW = B.W.map(nm=> { const i = nextIndex(); add(nm, 0, 0, wMax); return i; });
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
   cell's indices, as the ticks), '110', '1 -1 0', '1,-1,0', '[1 1 0]', '(110)', '{110}',
   'auto', or none (null: buildModel reports one given but not readable). */
function textureOf(po){
  if (po == null || po === false || String(po).trim() === '') return null;
  if (String(po).trim().toLowerCase() === 'auto') return 'auto';
  let t = null;
  if (Array.isArray(po)) t = po.map(Number);
  else {
    // in brackets or not; separated (by spaces or commas) or one digit each
    const s0 = String(po).trim(), br = s0.match(/^\[(.*)\]$|^\((.*)\)$|^\{(.*)\}$/), s = br ? (br[1] ?? br[2] ?? br[3]).trim() : s0;
    t = /[\s,]/.test(s) ? s.split(/[\s,]+/).map(Number) : /^(-?\d)+$/.test(s) ? s.match(/-?\d/g).map(Number) : null;
  }
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
// The Laue group's operations on the conventional cell's indices, M⁻¹·R·M: the planes the
// texture axis and the strain's directions are named by are that cell's. With the file's
// own operations on a primitive cell's indices (a primitive fcc file), (100) and (111)
// had been one family and (111) was never tried.
function conventionalLaue(q){
  const M = q.constraint && q.constraint.basis;
  return (q.laue || []).map(R=>{
    if (!M) return R;
    const [a, b, c, d, e, f, g, h, i] = M, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
    const Mi = [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det];
    const mul = (P, Q) => [0, 1, 2].flatMap(r=> [0, 1, 2].map(cc=> P[3*r]*Q[cc] + P[3*r + 1]*Q[3 + cc] + P[3*r + 2]*Q[6 + cc]));
    return mul(mul(Mi, R), M).map(x=> Math.round(x));
  });
}
// Adds a plane to a list unless its Laue family is there already (`seen`: every image).
function addFamily(out, seen, ops, hh){
  if (seen.has(hh.join())) return false;
  out.push(hh);
  for (const R of ops) seen.add([0, 1, 2].map(j=> hh[0]*R[j] + hh[1]*R[3 + j] + hh[2]*R[6 + j]).join());
  return true;
}
// The low-index planes, one of each Laue family.
function lowIndexPlanes(q){
  const ops = conventionalLaue(q), seen = new Set(), out = [];
  for (const hh of [[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]]) addFamily(out, seen, ops, hh);
  return out;
}
/* The axes 'auto' tries: the low-index planes, then the planes of the phase's largest
   spacings in the pattern (lines with intensity, indices made coprime), up to
   TEXTURE_BFDH more families. By Bravais–Friedel–Donnay–Harker the faces a crystal shows
   most, on which its plates lie, are those of the largest spacing the extinctions leave:
   corundum's (012) and (104), calcite's (104), none of them low-index. Textured along
   (104), a corundum tried on the low-index planes alone took (101) or (111), χ²_ν 2.2–3.8
   against the truth's 1.04; a quartz along (102), a monoclinic cell along (10-2) and a
   triclinic one along (1-10) took others at χ²_ν 1.07–15.9. */
const TEXTURE_BFDH = 3;
function textureCandidates(model, k){
  const q = model.phases[k], ops = conventionalLaue(q), seen = new Set(), out = [];
  lowIndexPlanes(q).forEach(hh=> addFamily(out, seen, ops, hh));
  const ticks = calc(model).ticks.filter(t=> t.phase === q.id), Imax = Math.max(0, ...ticks.map(t=> t.I));
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  let added = 0;
  for (const t of ticks.filter(t=> t.I > 1e-3*Imax).sort((a, b)=> b.d - a.d)){
    if (added >= TEXTURE_BFDH) break;
    const g = gcd(Math.abs(t.h), gcd(Math.abs(t.k), Math.abs(t.l))) || 1;
    if (addFamily(out, seen, ops, [t.h/g, t.k/g, t.l/g])) added++;
  }
  return out;
}
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
/* Round 2 of the free-shape research (a prototype after v522: research/free-shape/round2/
   AB.md §1, its two results adopted), each behind a switch that keeps v522's behaviour
   reachable for comparison (a test or a script sets it before building a model):
   - line, the size line of a free shape's members and of its phase's isotropic sphere:
     'exact', the solid's own line by WPPM (§7.3): a phase with a body for its free shape is
     built as a WPPM phase (read when the model is built), each member's line the transform
     of the solid's common-volume function along it, its isotropic sphere the ball's;
     'lsq', in the Lorentzian profile the engine's TCH pseudo-Voigt with the Gaussian and
     Lorentzian FWHM that best fit the solid's exact line along the member (sizeLineKs; AB
     §3); or 'lor', v522's Lorentzian of FWHM 0.675/⟨L⟩_V (a WPPM phase reads neither). The
     Lorentzian is 11.5–21 % of the peak off every solid's exact line, reads ⟨L⟩_V 13–25 %
     long, and pulls a solid toward equant the more members a reflection has (m−3m read a
     quarter of the anisotropy); lsq is 2.5–8 % off at the same cost and puts two of 11
     clean rows in the wrong family of solid in expectation; the exact line none. With
     WPPM_OPT's shortcuts (xrd-broad.js: the read-out from tables, a reflection's two lines
     by one FFT, the axial shift interpolated in θ) a fit by the exact line cost 0.42× v522's
     CPU on the 22 sub-screen rows (lsq 0.74×, WPPM before them 2.13×), with WPPM's outcome,
     reach and accuracy (STEP2.md);
   - search, freeShapeRun's: 'v2' (AB §4, STEP1.md: forward differences in the brief
     trials, no covariance in the search's refinements, the returned fit refined once more
     by central differences with its covariance, a held frame refined once per orbit of the
     class, the class's distinct starts alone, the turns on a stream of their own) or
     'today', v522's. On the 77 screening runs v2 made 0.62× v522's evaluations with the
     lsq line (0.80× the CPU of a fit on 22 of them) and with WPPM (0.75×), the outcome the
     same on 76 and 75.
   The tunables, all to be tuned on round 2's tuning runs: SHAPE_FILL, SHAPE_CENTRAL and
   SHAPE_FWD below; the tables' steps and their fit's span and weights (xrd-sizeline.js, written by
   research/free-shape/round2/proto/build-sizeline.mjs); the starts' families (lowIndexAxes,
   at most 5). */
const SHAPE_MODE = { line: 'exact', search: 'v2' };
/* Search v2: random starts beside the class's distinct ones (the sphere-like one, a plate
   and a needle per low-index family: 11 in the six lower classes, 9 in −3m, 6/m and 6/mmm,
   7 in cubic), plus one for each start the setting shapeStarts asks above its default.
   0: none (AB §4.2, symA: where v522 filled up with random starts, 35 of the 77 runs, they
   cost 15 % of the evaluations and changed no outcome with the Lorentzian line; with the
   lsq line one: an ellipsoid whose isotropic fit read no size, all the class's starts
   stopping at once at w0's floor, which one of v522's random starts had escaped; STEP1.md). */
const SHAPE_FILL = 0;
/* Search v2: the returned fit refined once more by central differences, its covariance
   from that pass (true), or its covariance alone (false). The pass costs an iteration (44
   evaluations, median) against 18 for the covariance alone, and lowered χ² by 0.0003 χ²_ν
   (median), at most 0.61, where forward differences had stopped short in a flat valley. */
const SHAPE_CENTRAL = true;
/* Search v2: which of the search's refinements take their Jacobian by forward differences:
   'briefs' (the brief trials alone; the full refinements, the polish, the exact faces, the
   held frames and the refit by central differences, still without a covariance) or 'all'.
   On the 77 screening runs with the lsq line, 'all' made 0.48× v522's evaluations but a
   full refinement could stall short in a flat valley: a true 18.7 × 3.7 nm cylinder ended an
   unbounded disc 1693 χ²_ν above v522's fit, and the reach fell to 61 of 65 runs against
   64; 'briefs' made 0.62× (1.11× the CPU of 'all') and lost neither (STEP1.md). */
const SHAPE_FWD = process.env.PROTO_FWD || 'briefs';   // [step1]
/* The per-line check (STEP3.md), always made at the fit freeShape returns (the kept shape,
   else the isotropic fit; info.check, or check beside a rejection). The range is cut into
   one segment per line or group of overlapping lines: the phase's reflections above 1e-4 of
   the strongest at their Kα centroids, a line within max(minsep°, the mean FWHM of it and
   the group's last) joining the group, the cuts at the midpoints. Of the normalised
   residuals r = √w(y − y_c) two statistics, each made family-wise (Bonferroni) over the
   pattern: the worst segment's χ² (its upper tail as a normal deviate, Wilson–Hilferty)
   and the worst sum of r over bin° (two-sided, which a line's intensity misfit shows and
   its χ²_ν may not). It fires (flagged) when either exceeds z, 3.09 (p = 0.001 each).
   On the 77 screening runs (exact lines) it fired on none of the 39 clean rows (the worst
   2.08) and on 29 of the 38 with a model error, 14 of the 15 whose result the error had
   spoiled (an extent beyond 25 % or unbounded, an axis beyond 10°, a sphere given a shape);
   it missed weak air, size distributions and texture, and a strong size distribution that
   a held spheroid took up whole (χ²_ν 1.003). Round 1's worst segment χ²_ν > 1.25 fired on
   2 clean rows and 23 error rows. Where it fires, the report (bodyShapeOf) runs the
   jackknife over lines (jack): the segments in at most `groups` contiguous groups, each
   weighted 0 in turn and the fit refined from itself (iter iterations, its own free
   parameters, so a held frame stays held), and gives each dimension D·e^(±2 sd) and each
   axis 2·rms turn (sd and rms over the groups, (G − 1)/G) beside its esds, with the check
   as misfit: on the 24 flagged error rows 51 of 56 extents covered against 28 by the esds
   alone, at 0.27× the fit's evaluations (12 iterations: the same coverage, 0.44×).
   retest: the keep test made again without the flagged segments (the shape refitted from
   the kept fit, the isotropic fit from its own; ΔBIC as the search's on the points left),
   a shape it no longer supports rejected; off: on the screening runs it removed 1 of the
   2 false shapes and none of the 4 unbounded extents. */
const SHAPE_CHECK = { on: true, z: 3.09, bin: 1, minsep: 0.3, jack: true, groups: 20, iter: 4, retest: false };
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
   phase searched) the faces are rounded off over 1° (soft = sin 1°) of the base body's
   direction: each component of t read as √(t_i² + soft²·|t|²), |t| kept. Rounded after
   the dimensions scale it, a width changes by at most 1.1 % whatever the proportions;
   rounded before (v425, over 2°, each component of Rotᵀu as √(x² + sin²2°)), a thin
   body's widths in its plane grew with its aspect, ×1.13 at 11:1 and ×1.95 at 50:1,
   and a needle's along its axis ×3.3 at 50:1. It is not the solid's (those 1.1 %, near
   a face), so the result is refined, and every number reported, with the exact solid.
   1°: it reached the minima a refinement from the truth reaches on synthetic discs of
   5:1 to 100:1 (cubic, tetragonal, hexagonal), and those of 2° on plates, rods, boxes
   and monoclinic and triclinic bodies; 2° ended a 100:1 disc in another valley at
   three seeds of three (twice as a rod, 2700 χ²_ν above), and 4° a 50:1 disc. */
const SHAPE_SOFT = Math.sin(1*D2R);
/* Every member's t = W∘(Rotᵀu) (°: the dimensions as sphere widths along the member's
   direction in the body's axes, the faces rounded off for the search): the size is the
   body's along it, its extent along u being Kλ/(|t|·π/180) times the base body's. */
function shapeTs(model, q, v){
  const B = BODIES[q.shapeType], R = bodyFrame(q, v), [Wx, Wy, Wz] = B.axes(q.iW.map(i=> v[i]));
  // (only the phase searched: another's kept shape is drawn exact meanwhile)
  const sf = B.base === 'ball' || !model.shapeSoft || model.shapeSoft.q !== q ? 0 : model.shapeSoft.soft, e2 = sf*sf, k = 1/Math.sqrt(1 + 3*e2);
  return q.mv.map(mv=>{
    const out = new Float64Array(mv.length);
    for (let i = 0; i < mv.length/3; i++){
      const u1 = mv[3*i], u2 = mv[3*i + 1], u3 = mv[3*i + 2];
      // W∘(Rotᵀu): the member's direction in the body's axes, scaled by its dimensions.
      const t1 = Wx*(R[0]*u1 + R[3]*u2 + R[6]*u3), t2 = Wy*(R[1]*u1 + R[4]*u2 + R[7]*u3), t3 = Wz*(R[2]*u1 + R[5]*u2 + R[8]*u3);
      if (!e2){ out[3*i] = t1; out[3*i + 1] = t2; out[3*i + 2] = t3; continue; }
      // its faces rounded off
      const s2 = e2*(t1*t1 + t2*t2 + t3*t3);
      out[3*i] = k*Math.sqrt(t1*t1 + s2); out[3*i + 1] = k*Math.sqrt(t2*t2 + s2); out[3*i + 2] = k*Math.sqrt(t3*t3 + s2);
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
/* The lsq size line (SHAPE_MODE.line 'lsq'): a member's Gaussian and Lorentzian FWHM as
   multipliers kg, kl on its width w (shapeWidths: the sphere-calibrated Lorentzian's,
   0.675/⟨L⟩_V in d*), the line drawn as the TCH of H_G² + (kg·w/cosθ)² and H_L + kl·w/cosθ:
   the TCH line that best fits the solid's exact line along the member (xrd-sizeline.js),
   read off the reduced shape along it, t its direction in the scaled base body (shapeTs):
   the ball's one entry; the cylinder's angle ψ from its axis, linear between the table's
   steps; the cube's ratios β = b/a, γ = c/a of t's sorted components, bilinear.
   out[o], out[o + 1] = kg, kl. */
const SL_K = (()=> {
  const T = SIZE_LINE, k = x => x/0.675;
  return { ball: T.ball.map(k), cyl: Float64Array.from(T.cyl, k), cylStep: T.cylStep, nCyl: T.cyl.length/2,
           box: Float64Array.from(T.box, k), boxStep: T.boxStep, nBox: Math.round(1/T.boxStep) + 1 };
})();
function sizeLineKs(base, t1, t2, t3, out, o){
  const T = SL_K;
  if (base === 'ball'){ out[o] = T.ball[0]; out[o + 1] = T.ball[1]; return; }
  const a1 = Math.abs(t1), a2 = Math.abs(t2), a3 = Math.abs(t3);
  if (base === 'cylinder'){
    const c = T.cyl, f = Math.min(T.nCyl - 1 - 1e-9, Math.atan2(Math.hypot(a1, a2), a3)*180/Math.PI/T.cylStep), i = Math.floor(f), u = f - i;
    out[o] = c[2*i] + u*(c[2*i + 2] - c[2*i]); out[o + 1] = c[2*i + 1] + u*(c[2*i + 3] - c[2*i + 1]);
    return;
  }
  let a = a1, b = a2, cc = a3, t;
  if (b > a){ t = a; a = b; b = t; } if (cc > a){ t = a; a = cc; cc = t; } if (cc > b){ t = b; b = cc; cc = t; }
  if (!(a > 0)){ out[o] = T.ball[0]; out[o + 1] = T.ball[1]; return; }
  const n = T.nBox, fb = Math.min(n - 1 - 1e-9, b/a/T.boxStep), fc = Math.min(n - 1 - 1e-9, cc/a/T.boxStep);
  const i = Math.floor(fb), j = Math.floor(fc), u = fb - i, w = fc - j, B = T.box;
  // (the table's lower half, γ ≤ β; the upper by symmetry)
  const at = (p, r) => 2*(p >= r ? p*(p + 1)/2 + r : r*(r + 1)/2 + p);
  const p00 = at(i, j), p10 = at(i + 1, j), p01 = at(i, j + 1), p11 = at(i + 1, j + 1);
  for (let k = 0; k < 2; k++) out[o + k] = (1 - u)*(1 - w)*B[p00 + k] + u*(1 - w)*B[p10 + k] + (1 - u)*w*B[p01 + k] + u*w*B[p11 + k];
}
// Every member's kg, kl at v (a body's), in pairs, as shapeWidths gives their widths.
function shapeLineKs(model, q, v){
  const base = BODIES[q.shapeType].base;
  return shapeTs(model, q, v).map(t=>{
    const m = t.length/3, out = new Float64Array(2*m);
    for (let i = 0; i < m; i++) sizeLineKs(base, t[3*i], t[3*i + 1], t[3*i + 2], out, 2*i);
    return out;
  });
}
function shapeMatrix(L){
  const [l11, l21, l22, l31, l32, l33] = L;
  return [l11*l11, l11*l21, l11*l31,  l11*l21, l21*l21 + l22*l22, l21*l31 + l22*l32,  l11*l31, l21*l31 + l22*l32, l31*l31 + l32*l32 + l33*l33];
}
// Eigen-decomposition of a symmetric 3×3 (row-major) by Jacobi rotations, largest first.
// The matrix is scaled to its largest entry (by a power of 2, exactly), so that the stop
// (off-diagonal² under 1e-30, as rounding leaves it) is relative: absolute, it had left
// matrices of entries under 1e-15 undiagonalised.
function eigSym3(S){
  const mx = Math.max(...S.map(Math.abs)), sc = mx > 0 ? 2**Math.round(Math.log2(mx)) : 1;
  const a = [[S[0]/sc, S[1]/sc, S[2]/sc], [S[3]/sc, S[4]/sc, S[5]/sc], [S[6]/sc, S[7]/sc, S[8]/sc]], V = [[1,0,0],[0,1,0],[0,0,1]];
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
  return [0, 1, 2].map(i=> ({ val: a[i][i]*sc, vec: [V[0][i], V[1][i], V[2][i]] })).sort((x, y)=> y.val - x.val);
}
/* The simplest lattice directions (indices up to 3, conventional cell) within tolDeg of
   the plane normal to the unit vector n: { uvw, vec } in the frame op R0 (lattDirection's
   R). count 2: two about perpendicular to each other — the crystal's directions across
   a body of revolution's axis (or a plate's normal), which the drawing shows; more: the
   candidates for a held body's second axis (freeShape). */
function latticeAcross(q, n, R0, tolDeg = 5, count = 2){
  const B = q.Bm, M = q.constraint && q.constraint.basis;
  const Bi = inv3n(B), gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a), lim = Math.sin(tolDeg*D2R);
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
  return out.map(({ tc, vec })=>{
    const dir = canon(R0 ? [0, 1, 2].map(r=> R0[3*r]*tc[0] + R0[3*r + 1]*tc[1] + R0[3*r + 2]*tc[2]) : tc);
    return { uvw: '[' + hklText(dir) + ']', vec: alongLabel(q, R0, dir, vec) };
  });
}
// A turn by phi about the unit axis n (row-major).
function turnAbout(n, phi){
  const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
  return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C];
}
/* turnEsds(model, v, res, about, turn, names) → for each axis b in `about`, the turn
   (rad) of the solid about it that raises χ² by χ²_ν (both senses, averaged; NaN beyond
   60°), with the refined parameters names(b) — every one free in the fit but the turn
   itself — refined again at each turn: a profile of χ² in the turn.
   Linear esds do not serve here: where the axes lie on symmetric directions a turn has
   no first-order effect (the members' changes cancel over a family) and the flat faces
   make χ² kink, so (JᵀWJ)⁻¹ gave 30° to 10⁹° for axes the data fix within a few
   degrees; and a turn with the sizes held was too dear — the sizes take up part of it
   (on a synthetic disc ±0.26° held against about 2°, the truth 15 of those σ away).
   The threshold χ²_ν is the linear esds' own convention, (JᵀWJ)⁻¹·χ²_ν with no floor:
   where χ² is quadratic, the profile with the others refined again rises by
   δ²/[(JᵀWJ)⁻¹]_jj, χ²_ν exactly at the linear esd.
   Turns of 1, 2, 4… up to 60°: σ where χ² first rises by χ²_ν, √Δχ² interpolated
   linearly between the last two (from 0 before the first): exact where χ² is a parabola
   in the turn, on the safe side where it rises as |θ|. (Δχ² itself interpolated had
   made the esds up to 6 % small; the first trial over it alone, a broad valley read as
   the narrow notch of χ² at a lattice orientation: 1.7× too small.) The turns about the
   other axes are refined again too: the valley of χ² runs obliquely between them, and
   with those held a solid's axes were found 1.6× further from the truth than their esds
   said (1.15× with them free, over 28 axes of synthetic solids, by v425's rules; the
   rest is a second valley nearly as deep, which a profile does not see). An axis i's
   esd is then √((σ_j² + σ_k²)/2) over the turns that tilt it. The model is left as it
   was. */
function turnEsds(model, v, res, about, turn, names){
  if (!res || !res.stats) return about.map(()=> NaN);
  const keep = { v: model.v.slice(), esd: model.esd, cov: model.cov };
  const chiAt = (vv, free) => {
    setParams(model, vv);
    try { refine(model, { free, maxIter: 4, audit: false }); } catch(e){ return Infinity; }
    return evaluate(model, model.v).chi2;
  };
  try {
    const target = Math.sqrt(res.stats.chi2);
    const side = (b, sg, c0) => {
      let t0 = 0, r0 = 0;
      for (const deg of [1, 2, 4, 8, 16, 32, 60]){
        const th = deg*D2R, r = Math.sqrt(Math.max(0, chiAt(turn(b, sg*th), names(b)) - c0));
        // (a trial that could not be refined leaves the esd unknown)
        if (!Number.isFinite(r)) return NaN;
        if (r >= target) return t0 + (th - t0)*(target - r0)/Math.max(1e-12, r - r0);
        t0 = th; r0 = r;
      }
      return NaN;
    };
    return about.map(b=> { const c0 = chiAt(turn(b, 0), names(b)); return Number.isFinite(c0) ? (side(b, 1, c0) + side(b, -1, c0))/2 : NaN; });
  } finally {
    setParams(model, keep.v); model.esd = keep.esd; model.cov = keep.cov;
  }
}
/* shapeOf(model, params, k, res?) → the phase's free shape, or null when not in use:
   for a body (spheroid, cylinder, elliptic cylinder, box, square box) bodyShapeOf's; for the
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
    const t = LtOf(e), r = Math.hypot(...t), w = ys + r, gw = gradOf(e, t).map(x=> x/(2*r));
    const wEsd = r > 0 ? sdOf(gw) : NaN, D = Dof(w);
    return { e, w, wEsd, gw, D, Desd: D*wEsd/w };
  }).sort((a, b)=> a.D - b.D);
  // A group's mean width and its esd: from the mean of eᵀSe over its axes.
  const groupOf = idx => {
    let val = 0; const g = [0, 0, 0, 0, 0, 0];
    for (const i of idx){ const e = axes[i].e, t = LtOf(e); val += t[0]*t[0] + t[1]*t[1] + t[2]*t[2]; gradOf(e, t).forEach((x, a)=> { g[a] += x; }); }
    val /= idx.length; g.forEach((x, a)=> { g[a] = x/idx.length; });
    const r = Math.sqrt(val), w = ys + r, gw = g.map(x=> x/(2*r)), wEsd = r > 0 ? sdOf(gw) : NaN, D = Dof(w);
    return { axes: idx, w, wEsd, gw, D, Desd: D*wEsd/w };
  };
  // Widths told apart: by 2σ of their difference, its variance from the full covariance
  // of L, (g_x − g_y)ᵀ·C·(g_x − g_y) (near-equal axes are anticorrelated, ρ ≈ −0.9 on
  // synthetic plates: without it z had come out 1.4× too large); without esds, by their
  // values alone.
  const z = (x, y) => { const s = sdOf(x.gw.map((t, a)=> t - y.gw[a])); return Number.isFinite(s) && s > 0 ? Math.abs(x.w - y.w)/s : Infinity; };
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
    axes: framedAxes(q, dirs, ref).map((d, i)=>{
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
// Each axis's vector is turned to point along the direction its label names in that
// frame, as the cell's a, b, c drawn in it (cellAxes) do: on the side of the axis found,
// half of the arrows had pointed against the triad's own [001].
function framedAxes(q, dirs, ref){
  const R0 = dirs[ref].R, canon = t => t.find(x=> x !== 0) < 0 ? t.map(x=> -x) : t;
  return dirs.map((d, i)=>{
    const t = d.tc, dir = i === ref ? d.dir : canon([0, 1, 2].map(r=> R0[3*r]*t[0] + R0[3*r + 1]*t[1] + R0[3*r + 2]*t[2]));
    return { dir, label: d.family ? d.label : '[' + hklText(dir) + ']', uvw: '[' + hklText(dir) + ']', angle: d.angle, vec: alongLabel(q, R0, dir, d.vec) };
  });
}
// A Laue operation made proper: −1 is in every Laue group, and an improper frame drew the
// cell's a, b, c left-handed (half the time, as the first operation of an orbit came).
function properOp(R){
  const det = R[0]*(R[4]*R[8] - R[5]*R[7]) - R[1]*(R[3]*R[8] - R[5]*R[6]) + R[2]*(R[3]*R[7] - R[4]*R[6]);
  return det < 0 ? R.map(x=> -x) : R;
}
// vec (a Cartesian unit vector along ± the crystal direction labelled dir in the frame
// R0, conventional indices) turned onto dir's own sense: the crystal direction R0⁻¹·dir.
function alongLabel(q, R0, dir, vec){
  if (!R0 || !vec) return vec;
  const B = q.Bm, M = q.constraint && q.constraint.basis, Ri = inv3n(R0), Bi = inv3n(B);
  const tc = [0, 1, 2].map(r=> Ri[3*r]*dir[0] + Ri[3*r + 1]*dir[1] + Ri[3*r + 2]*dir[2]);
  const t = M ? [M[0]*tc[0] + M[1]*tc[1] + M[2]*tc[2], M[3]*tc[0] + M[4]*tc[1] + M[5]*tc[2], M[6]*tc[0] + M[7]*tc[1] + M[8]*tc[2]] : tc;
  const c = [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]];
  return c[0]*vec[0] + c[1]*vec[1] + c[2]*vec[2] < 0 ? vec.map(x=> -x) : vec;
}
/* A body's shape (spheroid, cylinder, elliptic cylinder, box, square box): { type, kind, dims:
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
  // Refined again at each turn: every parameter free in the fit (the sizes, the strain
  // and its Stephens terms, a size distribution, faults, the ADPs, the cell, the
  // scales, the background, a preferred orientation…; with the Stephens terms held, the
  // tilt esds of synthetic SrTiO3 and rutile discs had come out 4–29 % small, the cell
  // and the rest adding 0.2 % at most), and the turns about the other axes, from the
  // turned frame (r = 0 there).
  const reopt = res && res.free ? res.free.filter(nm=> model.index[nm] != null && !q.iR.includes(model.index[nm])) : [];
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
  const roles = type === 'spheroid' ? [['axis', 2]] : type === 'cylinder' ? [['axis', 2]] : type === 'ellcyl' || type === 'sqbox' ? [['axis', 2], ['a', 0], ['b', 1]] : [['a', 0], ['b', 1], ['c', 2]];
  const dimNames = { ellipsoid: ['a', 'b', 'c'], spheroid: ['equatorial', 'polar'], cylinder: ['diameter', 'height'], ellcyl: ['a', 'b', 'height'], box: ['a', 'b', 'c'], sqbox: ['side', 'height'] }[type];
  const dims = dimsOf.map((d, i)=> ({ name: dimNames[i], ...d }));
  const dimAlong = [Dx, Dy, Dz], dimEsdAlong = B.axes(dimsOf.map(d=> d.Desd)), dimMinAlong = B.axes(dimsOf.map(d=> d.Dmin));
  // Two dimensions not told apart (widths within 2σ) make a solid of revolution about
  // the third axis: the turn about it is free, and the pair have no directions — an
  // elliptic cylinder's circular cross-section, an ellipsoid's pair, a spheroid or a
  // cylinder as wide as it is long (no axis at all). A box's edges always have theirs
  // (a square turned is another solid): whether the data fix them is its angular
  // esd's to say. An axis is shown with a direction only under 30° of esd.
  // Apart: the difference of two widths over its esd, their covariance included (a
  // body of revolution's two axes across share one width).
  // A ball's axes (an ellipsoid's, a spheroid's) and an elliptic cylinder's cross-section
  // set a member's width as √(W_a²u_a² + W_b²u_b² …): two equal leave the turn between
  // them without effect, and their difference over its linear esd misreads the pattern,
  // by an amount that goes with the crystal: on synthetic plates and needles with two
  // equal axes it told them apart in 13 of 62 draws on rutile and ZnO (8 of 28 rutile
  // ellipsoids, mean z² 3.0), in none of 40 on SrTiO3 (mean z² 0.5). Where the smaller
  // width's linear esd exceeds the width, its ±σ reaches the bound 0, where such a width
  // has no curvature, and the esd means nothing at all (20–840° on synthetic ellipsoids
  // and elliptic cylinders; ±14606° for a spheroid's equator in a test fit of the user's
  // 37D SrTiO3, which had made a plate 2.5 nm thick a near-sphere; ±0.9° for a 150 nm
  // ellipsoid axis at 0.0005°, 2.2σ from a 4 nm thickness). For these pairs the pattern
  // decides, as a profile: the two set to one common width w, every other parameter free
  // in the fit refined again there (4 iterations, as the angular esds' profile; 20 moved
  // z by 0.02 at most), Δχ² from the fit to the profile's least χ² (6 of the 62 apart).
  // The group's width and esd are the linear ones where those hold (over the 28 rutile
  // ellipsoids mean (error/esd)² 0.95, 1.7 from the profile's curvature), else the
  // profile's least χ² and curvature (with the rest held instead of refined again, the
  // common width of equal 150 nm axes had come out up to 14 esd off; refined, 0.97 rms
  // over 16 synthetic plates). A face's width (a box's, a cylinder's, an elliptic
  // cylinder's height) acts to first order, through the kink of the column length, and its
  // esd holds on 0 (a box's, 0.03–0.05° beside 0.02° for the others): the full covariance
  // decides there (on synthetic boxes the profile had told equal edges apart at 3.2 where
  // the covariance gives 2.0, and put a pair's mean 3.3 esd off).
  // Either way z is set against the 2σ (95.45 %) quantile of χ² with as many degrees of
  // freedom as equal widths take away: the difference, and the turns it leaves without
  // effect where the fit has them free (held on the lattice, none) — an ellipsoid's or an
  // elliptic section's about the third axis, both of a spheroid's (a sphere then), a box's
  // about its third edge, which equal edges leave only the square's fourfold to act
  // through (the linear z of equal box edges, mean z² 1.9 over 62 draws on rutile, ZnO,
  // corundum and an orthorhombic phase, as two degrees of freedom give, had told 9 apart;
  // now 3). z = 2 there. A square box as high as it is wide is a cube, whose turns all
  // still act, as a cylinder's as high as it is wide: none taken away.
  // Up to v426 the linear z decided every pair at 2, and where one width was on 0 the
  // other's own esd alone: on synthetic 150 × 150 × 4 nm boxes, ellipsoids and elliptic
  // cylinders the two equal in-plane widths were told apart in all 9 draws of 32 where one
  // fell on 0.
  const Q2S = [4, 6.18, 8.02];
  const turnsFree = !!(res && res.free) && q.iR.some(i=> res.free.includes(model.par[i].name));
  const freedOf = (a, b) => !turnsFree ? 0 : type === 'spheroid' ? 2 : type === 'ellipsoid' || type === 'box' || (type === 'ellcyl' && a + b === 1) ? 1 : 0;
  // Each body axis's width: two widths (a body of revolution, a square box) put the first
  // on x and y.
  const wIx = nW === 2 ? [0, 0, 1] : [0, 1, 2];
  const nu = res && res.stats ? res.stats.chi2 : NaN, pairs = new Map();
  let chiFit = NaN;
  const pairOf = (a, b) => {
    const key = Math.min(a, b) + ',' + Math.max(a, b);
    if (pairs.has(key)) return pairs.get(key);
    const sm = W[a] <= W[b] ? a : b, wl = Math.max(W[a], W[b]), ss = Math.sqrt(cov(sm, sm));
    const second = B.base === 'ball' || (type === 'ellcyl' && sm < 2), linear = ss <= W[sm], q2 = Q2S[freedOf(a, b)];
    const s = Math.sqrt(cov(a, a) + cov(b, b) - 2*cov(a, b));
    let out = { z: Number.isFinite(s) && s > 0 ? 2*Math.abs(W[a] - W[b])/(s*Math.sqrt(q2)) : Infinity, w: (W[a] + W[b])/2, sd: Math.sqrt(Math.max(0, cov(a, a) + cov(b, b) + 2*cov(a, b)))/2 };
    if (second && Number.isFinite(nu) && wl > 0 && res.free){
      const at = w => { const vv = Float64Array.from(v); vv[q.iW[a]] = w; vv[q.iW[b]] = w; return vv; };
      const f = w => evaluate(model, at(w)).chi2;
      if (!Number.isFinite(chiFit)) chiFit = evaluate(model, v).chi2;
      // Where to start: the best common width with the rest held (golden section over
      // [0, 1.5·the larger]).
      const g = (Math.sqrt(5) - 1)/2;
      let lo = 0, hi = 1.5*wl, x1 = hi - g*(hi - lo), x2 = lo + g*(hi - lo), f1 = f(x1), f2 = f(x2);
      for (let it = 0; it < 24; it++){
        if (f1 < f2){ hi = x2; x2 = x1; f2 = f1; x1 = hi - g*(hi - lo); f1 = f(x1); }
        else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g*(hi - lo); f2 = f(x2); }
      }
      // The profile: three points h apart, a parabola through them, again around its
      // vertex while that lies outside them (at most 4 times).
      const rest = res.free.filter(nm=> nm !== model.par[q.iW[a]].name && nm !== model.par[q.iW[b]].name);
      const keep = { v: model.v.slice(), esd: model.esd, cov: model.cov }, prof = new Map();
      const P = w => { if (prof.has(w)) return prof.get(w);
        let c = f(w);
        try { setParams(model, at(w)); refine(model, { free: rest, maxIter: 4, audit: false }); c = Math.min(c, evaluate(model, model.v).chi2); } catch(e){}
        prof.set(w, c); return c; };
      let w = (lo + hi)/2, sd = NaN;
      try {
        const h = Math.max(0.1*w, 0.02*wl);
        // Already 10σ apart there (a plate's thickness against its breadth): told apart,
        // and no group to measure.
        for (let it = P(w) - chiFit > 100*nu ? 4 : 0; it < 4; it++){
          const x1 = Math.max(0, w - h), x2 = x1 + h, x3 = x2 + h, p1 = P(x1), p2 = P(x2), p3 = P(x3);
          const d1 = (p2 - p1)/h, c = ((p3 - p2)/h - d1)/h;
          if (!(c > 0)){ w = p3 < p1 ? x3 + h : Math.max(0, x1 - h); continue; }
          sd = Math.sqrt(2*nu/c);
          const xv = Math.max(0, (x1 + x2)/2 - d1/c);
          if (xv >= x1 && xv <= x3){ P(xv); break; }
          w = Math.max(x1 - 2*h, Math.min(xv, x3 + 2*h));
        }
      } finally { setParams(model, keep.v); model.esd = keep.esd; model.cov = keep.cov; }
      let pm = Infinity;
      for (const [x, p] of prof) if (p < pm){ pm = p; w = x; }
      const z = 2*Math.sqrt(Math.max(0, pm - chiFit)/(nu*q2));
      out = linear ? { ...out, z } : { z, w, sd, scan: true };
    }
    pairs.set(key, out);
    return out;
  };
  const zr = (i, j) => wIx[i] === wIx[j] ? 0 : pairOf(wIx[i], wIx[j]).z;
  const apart = (i, j) => zr(i, j) > 2;
  const round = B.rot === 2 && !apart(0, 2);
  // Dimensions not told apart, of a kind the solid can swap (an ellipsoid's axes, a
  // box's edges, an elliptic cylinder's cross-section): their mean is measured, and
  // each alone is not. Swapping them has no first-order effect, so their widths are
  // anticorrelated (−1.0000): a 12 × 12 nm box section on a fourfold axis read 13 ± 107
  // and 13 ± 106 nm, its mean 12.80(42). The group's mean width and its esd come from
  // the full covariance, as the v420 ellipsoid's groups; the members' own esds are
  // dropped. The closest pair first, then the third against the pair's mean (against
  // each alone, the pair's huge esds had grouped a 4 nm edge with them). (Here a body's
  // axes are its widths', B.axes the identity.) A pair with a width on 0 is one too when
  // not told apart; where its esds cannot say (above), its common width is the profile's.
  const groups = [];
  if (type === 'ellipsoid' || type === 'box' || type === 'ellcyl'){
    const swap = type === 'ellcyl' ? [[0, 1]] : [[0, 1], [0, 2], [1, 2]];
    const near = swap.filter(([i, j])=> (W[i] > 0 || W[j] > 0) && pairOf(i, j).w > 0 && !apart(i, j)).sort((x, y)=> zr(...x) - zr(...y));
    if (near.length){
      let g = near[0];
      const k = [0, 1, 2].find(i=> !g.includes(i)), P = pairOf(g[0], g[1]);
      if (type !== 'ellcyl' && W[k] > 0){
        // the third's width less the pair's mean, and its variance (with the pair's own
        // covariance with it where the linear esds hold)
        const d = W[k] - P.w, cx = P.scan ? 0 : cov(k, g[0]) + cov(k, g[1]);
        const vd = cov(k, k) + P.sd*P.sd - (Number.isFinite(cx) ? cx : 0);
        if (!(Math.abs(d) > 2*Math.sqrt(vd))) g = [0, 1, 2];
      }
      const n = g.length, w = n === 2 ? P.w : g.reduce((t, i)=> t + W[i], 0)/n;
      let c = 0; for (const i of g) for (const j of g) c += cov(i, j);
      const D = Dof(w), sd = n === 2 ? P.sd : Math.sqrt(Math.max(0, c))/n;
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
  const own = i => type === 'ellipsoid' || (type === 'ellcyl' && i < 2) ? groupOf(i) < 0 : type === 'box' || type === 'sqbox' || !round;
  // The reference for the lattice frame: the body's axis, an ellipsoid's lone axis, or
  // its (a box's) shortest.
  const shortest = [0, 1, 2].sort((a, b)=> dimAlong[a] - dimAlong[b])[0];
  const refAxis = type === 'box' ? shortest : type === 'ellipsoid' ? ([0, 1, 2].filter(own).length === 1 ? [0, 1, 2].find(own) : shortest) : 2;
  const order = roles.map(([, i])=> i), dirs = order.map(i=> lattDirection(q, col(i), held));
  const refIx = Math.max(0, order.indexOf(refAxis)), framed = framedAxes(q, dirs, refIx);
  const axes = roles.map(([role, i], n)=> { const esdAngle = tiltEsd(i);
    return { role, axis: i, ...framed[n], D: dimAlong[i], Desd: groupOf(i) >= 0 ? NaN : dimEsdAlong[i], Dmin: dimMinAlong[i], e: col(i), esdAngle, group: groupOf(i), own: own(i),
      resolved: own(i) && Number.isFinite(esdAngle) && esdAngle <= 30 }; });
  // The kind: a body of revolution flat or long; a box like the ellipsoid.
  // A box or an elliptic cylinder by its three dimensions, as the ellipsoid (a thin
  // elliptic cylinder is a plate whichever of its dimensions is the thin one).
  // Dimensions not told apart count as their group's mean, as the v420 ellipsoid's do (a
  // synthetic 150 × 150 × 4 nm box whose edges read 99 and 488 nm, not told apart, had been
  // called triaxial).
  let kind;
  if (type === 'box' || type === 'sqbox' || type === 'ellcyl' || type === 'ellipsoid'){
    const [a, b, c] = dimAlong.map((d, i)=> groupOf(i) >= 0 ? groups[groupOf(i)].D : d).sort((x, y)=> x - y);
    // (a square box: its side and height not told apart, a cube)
    const same = groups.some(g=> g.axes.length === 3) || (type === 'sqbox' && !apart(0, 2));
    kind = same || a/c > 0.8 ? (type === 'ellipsoid' ? 'isometric' : 'equant') : a/b < 0.5 && b/c < 0.5 ? 'triaxial' : a/b < 0.5 ? 'plate' : b/c < 0.5 ? 'needle' : 'anisotropic';
  } else {
    const same = zr(0, 2) < 2;
    kind = same || Math.min(Dz, Dx)/Math.max(Dz, Dx) > 0.8 ? (type === 'spheroid' ? 'near-sphere' : 'equant') : Dz < Dx ? (type === 'spheroid' ? 'oblate' : 'disc') : (type === 'spheroid' ? 'prolate' : 'rod');
  }
  // Across the axis: the crystal's directions normal to the axis's lattice direction
  // (normal to the axis itself, [1-10] of a disc 7° off [110] fell outside the 5°).
  // (the lone axis likewise of an ellipsoid whose pair, or an elliptic cylinder whose
  // cross-section, is not told apart: a body of revolution too; a box always has three).
  const lone = B.rot === 3 && [0, 1, 2].filter(own).length === 1 ? [0, 1, 2].find(own) : -1;
  const across = B.rot === 2 && axes[0].resolved ? latticeAcross(q, dirs[0].vec, dirs[0].R).map(d=> ({ ...d, esdAngle: tiltEsd(2) }))
    : lone >= 0 && axes[order.indexOf(lone)].resolved ? latticeAcross(q, dirs[order.indexOf(lone)].vec, dirs[order.indexOf(lone)].R).map(d=> ({ ...d, esdAngle: tiltEsd(lone) })) : [];
  // The per-line check (freeShape's info.check, SHAPE_CHECK) as misfit; where it fired, the
  // jackknife over lines: each dimension D·e^(±2 sd) (jackLo, jackHi; an infinite sd opens the
  // upper end alone, an unbounded dimension keeps its own), each axis 2·rms turn (jackTurn).
  const chk = info && info.check;
  let misfit = null;
  if (chk){
    misfit = { flagged: chk.flagged, zSeg: chk.zSeg, zBin: chk.zBin, segs: chk.segs.map(sg=> ({ lo: sg.lo, hi: sg.hi, hkl: sg.hkl, chi2nu: sg.chi2nu, zSeg: sg.zSeg, zBin: sg.zBin })) };
    if (chk.flagged && SHAPE_CHECK.jack && res && res.free){
      const jk = misfit.jack = lineJack(model, k, v, res.free, chk);
      dims.forEach((d, i)=> { d.jackLo = Number.isFinite(d.D) ? d.D*Math.exp(-2*jk.sdF[i]) : NaN; d.jackHi = Number.isFinite(d.D) ? d.D*Math.exp(2*jk.sd[i]) : Infinity; });
      axes.forEach(ax=> { ax.jackTurn = 2*jk.turn[ax.axis]; });
    }
  }
  return { type, kind, dims, groups, axes, across, misfit, solid: { type, dims: [Dx, Dy, Dz], frame: [col(0), col(1), col(2)], cell: cellAxes(q, dirs[refIx].R) } };
}
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
  const Binv = inv3n(B), cart = t => [Binv[0]*t[0] + Binv[3]*t[1] + Binv[6]*t[2], Binv[1]*t[0] + Binv[4]*t[1] + Binv[7]*t[2], Binv[2]*t[0] + Binv[5]*t[1] + Binv[8]*t[2]];
  const M = q.constraint && q.constraint.basis, Mi = M ? inv3n(M) : null;
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
  return { dir: nice.r, label: family ? '⟨' + hklText(nice.r) + '⟩' : '[' + hklText(nice.r) + ']', angle: best.angle, tc: t0, R: properOp(nice.R), family, vec };
}

// The cell's a, b, c (the conventional cell's, when there is one) as Cartesian unit
// vectors, in the frame of the shape's axes and directions: the 3D view's reference.
// R0: the Laue operation the axes' labels were given in (framedAxes): a direction
// labelled [001] is R0 of the one found, so the c drawn is R0⁻¹ of the cell's own — else
// the triad's c pointed against the solid's "[001]".
function cellAxes(q, R0){
  const B = q.Bm, M = q.constraint && q.constraint.basis;
  const Bi = inv3n(B), cart = t => [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]];
  const Ri = R0 ? inv3n(R0) : null;
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
  const Bi = inv3n(B), cart = t => [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]];
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
   site within its symmetry, U11_<label> …). p.occ: a site's label (phaseSites), or a
   list of them, whose occupancy is refined (occ_<label>; occSetup). */
const PROFILES = ['lorentz', 'wppm', 'lognormal'];
// The refined sites as one key (a result's models.occ against the options now).
const occText = a => (Array.isArray(a) ? a : a ? [a] : []).map(String).sort().join(',');
// A phase parameter's kind → the group it is held in (opts.hold; autoRefine's start from
// the last result, and the worker's "held at the last result"): Ys, Xs, S_j and σ the
// size and strain, ΔB, B and Uⁱʲ the displacements. (Up to v479 both listed the kinds.)
const KIND_GROUP = { lattice: 'cell', size: 'sizestrain', strain: 'sizestrain', dist: 'sizestrain', shape: 'shape', faults: 'faults', B: 'adp', adp: 'adp', occ: 'occ', texture: 'texture' };
function faultOf(spec){
  const m = typeof spec === 'string' && spec.trim().match(/^(-?\d)\s*(-?\d)\s*(-?\d)\s*:\s*(\d+)\s*\/\s*(\d+)\s*<\s*(-?\d)\s*(-?\d)\s*(-?\d)\s*>$/);
  if (!m) return null;
  const plane = [+m[1], +m[2], +m[3]], f = +m[4]/+m[5], uvw = [+m[6], +m[7], +m[8]];
  if (!plane.some(x=> x) || !uvw.some(x=> x) || !(f > 0 && f < Infinity)) return null;
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
/* The frame Stephens' forms are built in: the conventional cell's Cartesian frame (its
   own B: a* along x, b* in the x–y plane), so the S_j do not depend on how the file sets
   the cell. A unit vector u of the file's frame is T·u there, T = B_c·Mᵀ·B⁻¹ (orthogonal:
   B_cᵀB_c = M⁻¹G*M⁻ᵀ), M the conventional cell's axes in the file's fractions (columns):
   classify's (a primitive file of a centred lattice, a non-standard setting), the obverse
   hexagonal cell of rhombohedral axes (a reverse hexagonal cell turned about c into it);
   where the symmetry leaves the axes open, the reduced ones: an orthorhombic cell's in
   order of length, a monoclinic cell's with the 2-fold along b and the a–c pair reduced,
   β ≥ 90°, and a triclinic cell's Buerger cell. null: the file's cell is that cell. (A
   primitive fcc file had given S1 the opposite sign of a conventional one; a primitive
   C2/c or Cmmm file, or Pbnm for Pnma, other S_j altogether.) Left open, as only the
   atoms tell them apart: (b, a, −c) for 4/m and −3, (−a, −b, c) for −3 and −3m on a
   primitive lattice; one or two forms change sign.
   trans: the centring translations, in the file's fractions. */
function strainFrame(q, cell, trans){
  const c = q.constraint || {}, mul = (P, Q) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const tr = P => [P[0], P[3], P[6], P[1], P[4], P[7], P[2], P[5], P[8]], I = [1, 0, 0, 0, 1, 0, 0, 0, 1], turn = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
  let M = c.basis || null;
  if (!M && c.kind === 'rhombohedral') M = [1, 0, 1, -1, 1, 1, 0, -1, 1];
  if (!M && c.kind === 'monoclinic') M = c.unique === 'a' ? [0, 1, 0, 0, 0, 1, 1, 0, 0] : c.unique === 'c' ? [0, 0, 1, 1, 0, 0, 0, 1, 0] : I;
  const { G, Gs } = metric(cell);
  // M's columns (lattice vectors in the file's fractions), their dot products and det
  const cols = P => [0, 1, 2].map(j=> [P[j], P[3 + j], P[6 + j]]), fromCols = ([u, v, w]) => [u[0], v[0], w[0], u[1], v[1], w[1], u[2], v[2], w[2]];
  const dot = (u, v) => u[0]*(G[0]*v[0] + G[1]*v[1] + G[2]*v[2]) + u[1]*(G[3]*v[0] + G[4]*v[1] + G[5]*v[2]) + u[2]*(G[6]*v[0] + G[7]*v[1] + G[8]*v[2]);
  const det = P => P[0]*(P[4]*P[8] - P[5]*P[7]) - P[1]*(P[3]*P[8] - P[5]*P[6]) + P[2]*(P[3]*P[7] - P[4]*P[6]);
  const neg = u => u.map(t=> -t), sub = (u, v, m) => u.map((t, i)=> t - m*v[i]);
  if (c.kind === 'orthorhombic'){
    // The 2-fold axes in order of length: the order a file (Pnma, Pbnm) or classify (a
    // centred lattice given primitive) leaves open. The forms are even in each axis: a
    // sign only keeps the cell right-handed.
    const v = cols(M || I).sort((u, w)=> dot(u, u) - dot(w, w));
    if (det(fromCols(v)) < 0) v[2] = neg(v[2]);
    M = fromCols(v);
  }
  if (c.kind === 'monoclinic'){
    // The a–c pair reduced (Lagrange–Gauss: a the shorter, |a·c| ≤ a²/2), whatever cell
    // choice the file made (C2/c, I2/a, a primitive file), then β ≥ 90° (a and b turned
    // over together). b's sign is free (the 2-fold and the inversion), so it keeps the
    // cell right-handed.
    let [a, b, cc] = cols(M);
    for (let it = 0; it < 64; it++){
      if (dot(cc, cc) < dot(a, a)){ [a, cc] = [cc, a]; b = neg(b); }
      const m = Math.round(dot(a, cc)/dot(a, a));
      if (!m) break;
      cc = sub(cc, a, m);
    }
    if (dot(a, cc) > 1e-9*Math.sqrt(dot(a, a)*dot(cc, cc))){ a = neg(a); b = neg(b); }
    M = fromCols([a, b, cc]);
  }
  if (c.kind === 'triclinic'){
    // Buerger's cell: the shortest lattice vector, the shortest off its line, the shortest
    // off their plane (among small combinations of the pairwise-reduced axes), signed so
    // that the three angles are all acute or all obtuse, right-handed (−1 holds the
    // inversion).
    const v = cols(I);
    for (let it = 0, moved = true; moved && it < 64; it++){
      moved = false;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++){
        if (i === j) continue;
        const m = Math.round(dot(v[i], v[j])/dot(v[i], v[i]));
        if (m){ v[j] = sub(v[j], v[i], m); moved = true; }
      }
    }
    const cand = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++)
      if (i || j || k) cand.push([0, 1, 2].map(r=> i*v[0][r] + j*v[1][r] + k*v[2][r]));
    cand.sort((u, w)=> dot(u, u) - dot(w, w));
    const a = cand[0], off = u => Math.abs(a[1]*u[2] - a[2]*u[1]) + Math.abs(a[2]*u[0] - a[0]*u[2]) + Math.abs(a[0]*u[1] - a[1]*u[0]) > 0.5;
    const b = cand.find(off), cc = cand.find(u=> Math.abs(det(fromCols([a, b, u]))) > 0.5);
    const sg = x => x < 0 ? -1 : 1, acute = dot(a, b)*dot(a, cc)*dot(b, cc) > 0;
    const sb = acute ? sg(dot(a, b)) : -sg(dot(a, b)), sc = acute ? sg(dot(a, cc)) : -sg(dot(a, cc));
    let w = [a, b.map(t=> sb*t), cc.map(t=> sc*t)];
    if (det(fromCols(w)) < 0) w = w.map(neg);
    M = fromCols(w);
  }
  if (c.kind === 'hexagonal' || c.kind === 'rhombohedral'){
    // A rhombohedral lattice in the reverse cell (lattice points at 1/3, 2/3, 1/3 and
    // 2/3, 1/3, 2/3 of the hexagonal cell; a primitive file's axes may hold either one
    // alone): −a, −b make it the obverse one (2/3, 1/3, 1/3). The trigonal groups' forms
    // change sign with that turn (it is not in −3 or −3m).
    const Mi = inv3n(M || I), fr = t => [0, 1, 2].map(i=> { const x = Mi[3*i]*t[0] + Mi[3*i + 1]*t[1] + Mi[3*i + 2]*t[2]; return x - Math.floor(x + 1e-9); });
    const at = (f, p) => f.every((x, i)=> Math.abs(x - p[i]) < 1e-6);
    const rev = [[1, 0, 0], [0, 1, 0], [0, 0, 1], ...(trans || [])].some(t=> { const f = fr(t); return at(f, [1/3, 2/3, 1/3]) || at(f, [2/3, 1/3, 2/3]); });
    if (rev) M = mul(M || I, turn);
  }
  if (!M || M.every((x, i)=> x === I[i])) return null;
  const Mi = inv3n(M), S = mul(mul(Mi, Gs), tr(Mi));
  const b11 = Math.sqrt(S[0]), b12 = S[1]/b11, b13 = S[2]/b11, b22 = Math.sqrt(S[4] - b12*b12), b23 = (S[5] - b12*b13)/b22, b33 = Math.sqrt(S[8] - b13*b13 - b23*b23);
  return mul(mul([b11, b12, b13, 0, b22, b23, 0, 0, b33], tr(M)), inv3n(q.Bm));
}
// Stephens' forms at the direction of the reflection h (the file's indices).
function strainFormsAt(q, h){
  const B = q.Bm, T = q.strainT, x = [B[0]*h[0] + B[1]*h[1] + B[2]*h[2], B[4]*h[1] + B[5]*h[2], B[8]*h[2]], n = Math.hypot(...x);
  const u = T ? [0, 1, 2].map(i=> (T[3*i]*x[0] + T[3*i + 1]*x[1] + T[3*i + 2]*x[2])/n) : x.map(t=> t/n);
  return q.strainForms.map(c=> evalQuartic(c, u));
}
/* The central-difference step of a Stephens S_j: it moves ε² by 10⁻⁶·h·|q_j|, set to
   10⁻⁴ of the phase's mean ε² over its reflections (ε by 5·10⁻⁵ of itself, as X_s's
   10⁻⁶° moves it at the stage's 0.02°), where the square root's curvature leaves the
   difference within δ²/8ε⁴ ≈ 10⁻⁹. A fixed 10⁻³ was a third of ε² at the stage's start
   (X_s 0.02°, S = 0), the column 1 % off. */
function strainStep(model, p, v){
  const q = model.phases[p.phase], e0 = v[q.iXs]*D2R/4;
  let s = 0, qMax = 0;
  for (const qs of q.strainQ){
    let e2 = e0*e0;
    for (let j = 0; j < q.iS.length; j++) e2 += 1e-6*v[q.iS[j]]*qs[j];
    s += Math.max(0, e2); qMax = Math.max(qMax, Math.abs(qs[p.sj]));
  }
  const m = s/q.strainQ.length;
  return m > 0 && qMax > 0 ? 1e-4*m*1e6/qMax : p.step;
}
/* The central-difference step of U, V or W (k = 2, 1, 0: the power of t = tanθ it
   multiplies in H_G²): 10⁻⁶ deg², or less where H_G² is small, so that it moves H_G² by
   at most 10⁻³ of itself anywhere in the pattern. On a high-resolution beamline (H about
   0.001°, W = 3·10⁻⁷ deg²) the fixed 10⁻⁶ was three times W: W's column was 46 % off and
   V's 4 %; now within 10⁻⁵. Laboratory profiles (H_G² ≥ 10⁻³) keep 10⁻⁶. Where H_G² is
   on its floor the derivative is 0 whatever the step: those points do not count, and
   with every point there (U = V = W = 0) the step stays 10⁻⁶, which steps off the floor
   (a step of 10⁻¹¹ gave W a zero column there: dropped from the covariance, as v426 did
   not, and unable to leave 0). */
function uvwStep(model, p, v, k){
  const [U, V, W] = model.iProf.slice(0, 3).map(i=> v[i]);
  const t0 = Math.tan(Math.max(model.x0, 1e-3)/2*D2R), t1 = Math.tan(Math.min(179.9, model.x1)/2*D2R);
  let g = Infinity;
  for (let i = 0; i <= 32; i++){ const t = t0*Math.pow(t1/t0, i/32), h2 = U*t*t + V*t + W; if (h2 > HG2_FLOOR) g = Math.min(g, h2/Math.pow(t, k)); }
  return Math.min(p.step, 1e-3*g);
}
function broadeningSetup(q, p, cell, list, add, nextIndex){
  const prof = PROFILES.includes(p.profile) ? p.profile : 'lorentz';
  // (SHAPE_MODE.line 'exact': a phase with a body for its free shape is a WPPM phase)
  q.wppm = prof !== 'lorentz' || (SHAPE_MODE.line === 'exact' && !!BODIES[shapeTypeOf(p.shape)]);
  if (prof === 'lognormal'){ q.iLS = nextIndex(); add('LS', 0, 0, 1.5, 1e-4, { kind: 'dist' }); }
  const trans = (p.ops || []).filter(o=> o.R.every((x, i)=> x === [1,0,0, 0,1,0, 0,0,1][i]) && o.t.some(x=> x)).map(o=> o.t);
  if (p.strain === 'aniso'){
    memberVectors(q, p, cell, list);
    const T = q.strainT = strainFrame(q, cell, trans), tr = P => [P[0], P[3], P[6], P[1], P[4], P[7], P[2], P[5], P[8]];
    const mul = (P, Q) => [0, 1, 2].flatMap(i=> [0, 1, 2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
    q.strainForms = quarticInvariants(q.laue.map(R=> T ? mul(mul(T, cartOp(q.Bm, R)), tr(T)) : cartOp(q.Bm, R)));
    q.iS = q.strainForms.map((_, j)=> { const i = nextIndex(); add('S' + (j + 1), 0, -1e4, 1e4, 1e-3, { kind: 'strain', sj: j }); return i; });
    // each reflection's forms, at its direction (fixed with the starting cell, as the members')
    q.strainQ = list.map(r=> strainFormsAt(q, [r.h, r.k, r.l]));
  }
  const fs = faultOf(p.faults), warn = t => (q.specWarn = q.specWarn || []).push(t);
  if (!fs && p.faults && String(p.faults).trim()) warn(`the planar faults ${JSON.stringify(p.faults)} cannot be used (planes:fraction<direction>, as '111:1/6<112>'): refined without`);
  if (fs){
    memberVectors(q, p, cell, list);
    const tab = faultTable({ Bm: q.Bm, M: p.constraint && p.constraint.basis, laue: q.laue, trans }, fs.plane, fs.disp, list.map(r=> [r.h, r.k, r.l]));
    // A displacement by a lattice translation (6/6<112>, or ½⟨110⟩ in an fcc cell)
    // broadens nothing: its probability would be a parameter with no effect.
    if (tab.terms.every(t=> !t.length)) warn(`the planar faults ${JSON.stringify(fs.text)} broaden none of its reflections (h·R is an integer for each: the displacement is a translation of its lattice): refined without`);
    else {
      q.faultSpec = fs; q.faultTab = tab;
      q.iFA = nextIndex(); add('FA', 0, 0, 0.45, 1e-5, { kind: 'faults' });
    }
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
/* The crystallographic sites of a phase, as every per-site option names them (B per site,
   Uⁱʲ, the occupancy): the orbits of the cell's atoms under its operations (atomOrbits:
   one species and occupancy each), labelled after their first atom's CIF label. The card
   lists a phase's sites with it, so the names it offers are the parameters' own. */
function phaseSites(cell, atoms, ops){
  const orb = atomOrbits(cell, atoms, ops), labels = siteLabels(atoms, orb.ref);
  return { orbit: orb.orbit, R: orb.R, labels, sites: orb.ref.map((j, o)=> ({ label: labels[o], ref: j, element: atoms[j].element, occ: atoms[j].occ ?? 1,
    members: atoms.map((_, i)=> i).filter(i=> orb.orbit[i] === o) })) };
}
function adpSetup(q, p, cell, add, nextIndex){
  q.adp = ['overall', 'site', 'aniso'].includes(p.adp) ? p.adp : 'cif';
  if (q.adp !== 'site' && q.adp !== 'aniso') return;
  const atoms = q.atoms, orb = phaseSites(cell, atoms, p.ops);
  q.orbit = orb.orbit; q.orbR = orb.R;
  const labels = orb.labels, { Gs } = metric(cell), Ns = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
  q.sites = orb.sites.map(({ ref: j }, o)=>{
    const members = orb.sites[o].members;
    const Bs = members.map(i=> atoms[i].Biso).filter(Number.isFinite), B0 = Bs.length ? Bs.reduce((a, b)=> a + b, 0)/Bs.length : 0.5;
    const site = { label: labels[o], ref: j, members, element: atoms[j].element };
    if (q.adp === 'site'){ site.iB = nextIndex(); add('B_' + labels[o], B0, -2, 20, 1e-4, { kind: 'adp', site: o }); return site; }
    const a = atoms[j], basis = siteAdpBasis(cell, p.ops, [a.x, a.y, a.z]);
    // The isotropic start, U^ij = U·(a*_i·a*_j)/(a*_i a*_j), within the site's constraints
    // (least squares on its basis; it lies in it exactly).
    const Ui = B0/(8*Math.PI*Math.PI), U0 = [0, 1, 2, [0, 1], [0, 2], [1, 2]].map(c=> Array.isArray(c) ? Ui*Gs[3*c[0] + c[1]]/(Ns[c[0]]*Ns[c[1]]) : Ui);
    const m = basis.vecs.length, G = basis.vecs.map(u=> basis.vecs.map(w=> u.reduce((t, x, i)=> t + x*w[i], 0))), rhs = basis.vecs.map(u=> u.reduce((t, x, i)=> t + x*U0[i], 0));
    const c0 = solveSmall(G, rhs, m);
    site.vecs = basis.vecs; site.names = basis.names; site.bvecs = basis.bvecs; site.free = basis.free;
    site.iU = basis.names.map((nm, i)=> { const ix = nextIndex(); add(nm + '_' + labels[o], c0[i], -0.5, 0.5, 1e-6, { kind: 'adp', site: o }); return ix; });
    return site;
  });
}
/* Site occupancies refined (p.occ: a site's label, or a list of them): each its own
   parameter occ_<label>, the occupancy of every atom of the site, starting from the CIF's.
   It scales the site's scattering at every angle alike, where a B lowers it more the
   higher the angle: on a nanocrystalline SrTiO3 the Sr site scattering 0.7 of a full one
   (a Sr-poor surface) had been read as a negative B, a texture and B per site of +4 and
   −2 Å². Every site free is the scale again — one common factor, which the pattern cannot
   tell from it — and is refused. Bounds 0 … OCC_MAX: over 1 the site holds more electrons
   than the CIF's species (a heavier one beside it), which the results say. */
function occSetup(q, p, cell, add, nextIndex){
  const want = [...new Set((Array.isArray(p.occ) ? p.occ : p.occ ? [p.occ] : []).map(String))];
  q.occSites = [];
  if (!want.length || !q.atoms.length) return;
  const ps = phaseSites(cell, q.atoms, p.ops), names = ps.sites.map(s=> s.label);
  const unknown = want.filter(l=> !names.includes(l));
  if (unknown.length) q.specWarn.push(`no site ${unknown.join(', ')} among its sites (${names.join(', ')}): ${unknown.length > 1 ? 'their occupancies are' : 'its occupancy is'} not refined`);
  const chosen = ps.sites.filter(s=> want.includes(s.label));
  if (chosen.length && chosen.length === ps.sites.length){
    q.specWarn.push(`the occupancy of every site at once is the scale again (one common factor the pattern cannot tell from it): ${ps.sites.length > 1 ? 'leave one site out' : 'a phase of one site has no occupancy to refine'}; not refined`);
    return;
  }
  q.occOrbit = ps.orbit;
  q.occSites = chosen.map(s=> { const o = ps.sites.indexOf(s), iOcc = nextIndex(); add('occ_' + s.label, s.occ, 0, OCC_MAX, 1e-4, { kind: 'occ', site: o }); return { ...s, o, iOcc }; });
}
// The cell's mass with the refined occupancies (the Hill–Howard weight fractions'): the
// CIF's, and each refined site's atoms at their occupancy now instead of the file's.
function phaseMass(q, v){
  let m = q.mass;
  for (const s of q.occSites || []){ const a = q.atoms[s.ref]; m += (v[s.iOcc] - s.occ)*s.members.length*atomicMass(a.massEl || a.element); }
  return m;
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
// A site's U (6-vector, U11 … U23) at v, on the axes of a cell with reciprocal lengths Ns: the
// parameters are its free Uⁱʲ there, and the others follow through β, whose site relations do
// not move with the cell (siteAdpBasis). Without Ns, the starting cell's.
function siteU(site, v, Ns){
  if (Ns && site.bvecs) return adpU(site, site.iU.map(ix=> v[ix]), Ns);
  const U = [0, 0, 0, 0, 0, 0];
  site.iU.forEach((ix, m)=> { const c = v[ix]; site.vecs[m].forEach((x, i)=> { U[i] += c*x; }); });
  return U;
}
// The strain of reflection r at v: ε₀ = Xs·(π/180)/4 (the isotropic Lorentzian's, on
// its FWHM: H_L = 4ε·tanθ) with, for Stephens, the anisotropic part: ε² = ε₀² + 10⁻⁶
// Σ S_j q_j(u).
function strainOf(q, v, r){
  const e0 = v[q.iXs]*D2R/4;
  if (!q.iS) return e0;
  let e2 = e0*e0;
  const qs = q.strainQ[r];
  for (let j = 0; j < q.iS.length; j++) e2 += 1e-6*v[q.iS[j]]*qs[j];
  return Math.sqrt(Math.max(0, e2));
}

/* The file's cell as its symmetry has it: the lengths the constraint ties equal, the angles
   it fixes exactly 90° or 120° (60° for a hexagonal cell given with b′ = a + b, which
   classify keeps as it is; a conventional basis's cell is classify's, already so).
   A CIF's digits may break them by their rounding (b 3.24981 beside a 3.2498, γ
   119.99998), which findSymmetry accepts; the Cartesian Laue operations built on such a
   cell then miss orthogonality by as much, and from 10⁻⁷ on Stephens' forms gained a
   spurious one (a cubic phase 2 for 1, ZnO 3 for 2). It is also the template the refined
   cell keeps its fixed angles from (cellOf). */
function idealCell(constraint, cell){
  const c = typeof constraint === 'string' ? { kind: constraint } : (constraint || {}), T = { ...cell };
  if (!(c.basis && c.conv)){
    if (['cubic', 'tetragonal', 'orthorhombic', 'hexagonal'].includes(c.kind)){ T.alpha = T.beta = 90; T.gamma = c.kind === 'hexagonal' ? (T.gamma < 90 ? 60 : 120) : 90; }
    else if (c.kind === 'monoclinic'){ const u = latticeNames(c)[3]; for (const k of ['alpha', 'beta', 'gamma']) if (k !== u) T[k] = 90; }
  }
  return cellFrom(constraint, latticeParams(constraint, cell), T);
}
// A lattice value's bounds: lengths ±LAT_RANGE (or the model's wider latRange: buildModel),
// angles ±LAT_ANGLE within 1–179°.
const isAngleName = nm => nm === 'alpha' || nm === 'beta' || nm === 'gamma';
const latBounds = (nm, v0, r = LAT_RANGE) => isAngleName(nm) ? [Math.max(1, v0 - LAT_ANGLE), Math.min(179, v0 + LAT_ANGLE)] : [(1 - r)*v0, (1 + r)*v0];
/* The most any d can grow while the cell stays within its bounds. max over h of d/d₀ is
   max over real vectors t of |t|/|t|₀ in the direct metrics: √ of the largest eigenvalue
   of G relative to G₀ (L⁻¹GL⁻ᵀ, G₀ = LLᵀ). tᵀGt is a quadratic with a positive leading
   term in each length and linear in each angle's cosine, so its largest value over the
   bounds' box lies at a vertex, whatever t: the 2ⁿ vertices suffice. An angle moved 15°
   from 105° stretches d(101) of a monoclinic cell by 16 %, beyond the lengths' 10 %. */
function latticeStretch(constraint, cell, names, lat0, r){
  const G0 = metric(cellFrom(constraint, lat0, cell)).G;
  const l00 = Math.sqrt(G0[0]), l10 = G0[3]/l00, l20 = G0[6]/l00, l11 = Math.sqrt(G0[4] - l10*l10);
  const l21 = (G0[7] - l20*l10)/l11, l22 = Math.sqrt(G0[8] - l20*l20 - l21*l21);
  const i00 = 1/l00, i11 = 1/l11, i22 = 1/l22, i10 = -l10*i00/l11, i21 = -l21*i11/l22, i20 = -(l20*i00 + l21*i10)/l22;
  const Li = [i00, 0, 0, i10, i11, 0, i20, i21, i22];
  if (!Li.every(Number.isFinite)) return 1;
  const box = names.map((nm, i)=> latBounds(nm, lat0[i], r));
  let s2 = 1;
  for (let mask = 0; mask < 1 << names.length; mask++){
    const G = metric(cellFrom(constraint, box.map((b, i)=> b[(mask >> i) & 1]), cell)).G;
    // M = Li·G·Liᵀ
    const T = [0, 1, 2].map(r=> [0, 1, 2].map(c=> Li[3*r]*G[c] + Li[3*r + 1]*G[3 + c] + Li[3*r + 2]*G[6 + c]));
    const M = [0, 1, 2].flatMap(r=> [0, 1, 2].map(c=> T[r][0]*Li[3*c] + T[r][1]*Li[3*c + 1] + T[r][2]*Li[3*c + 2]));
    s2 = Math.max(s2, eigSym3(M)[0].val);
  }
  return Math.sqrt(s2);
}

/* buildModel({ x, y, varMul, instr, phases, prof, bgDegree, bgInv, cellRange })
   - x, y: the pattern (2θ in degrees, monotonic, every value a number: the windows are
     found by bisection; counts); varMul: per-point variance multiplier (attenuator
     factor, 1/counting time for rates), default 1. Points with a y that is not a number
     get no weight. Throws on a 2θ that is not a number and on fewer than MIN_POINTS
     weighted points, which no refinement can use.
   - instr: readXrdmlInstrument's object, or null (Cu Kα1/Kα2, ratio 0.5, R 240 mm, no
     monochromator).
   - phases: [{ id, name, cell, constraint, ops, atoms (the whole cell), mass? }].
   - prof: starting { zero, disp, U, V, W, X, Y, Xs, Ys } (Xs, Ys: every phase's start).
   - bgDegree: Chebyshev order (default 6); bgInv: use the 1/2θ term (default, or 'auto':
     when the pattern starts below 20°; never when it reaches 2θ ≤ 0, where 1/2θ is
     undefined). Both are fit settings (fitSettings), as is cellRange: the cell search's
     range the model is made for (default CELL_RANGE). The lengths' bounds are ±LAT_RANGE,
     or twice cellRange when that is wider: the lone phase's second search reaches 2×, and
     the reflection list must reach the cells it may place (latticeStretch). A model drawn
     again from a result is built with the result's fit (its background terms, its list).
   - every phase's id (its parameters' prefix, 'p' + id) must be its own.
   The profile is the instrument's U, V, W, X, Y, shared by the phases, with each phase's
   own Lorentzian broadening on top ('p1.Xs', 'p1.Ys'): one instrumental profile, and a
   size and a strain per phase (or per population, with a CIF loaded twice).
   The model owns copies; the phases' objects are not modified. */
function buildModel({ x, y, varMul = null, instr = null, phases = [], prof = {}, bgDegree = BG_DEGREE, bgInv, cellRange } = {}){
  const n = x.length, latRange = Math.max(LAT_RANGE, 2*fitSettings({ cellRange }).cellRange);
  // A scan recorded downwards is held ascending inside (the windows are found by bisection)
  // and handed back in its own order by calc().
  const rev = n > 1 && x[0] > x[n-1], at = i => rev ? n - 1 - i : i;
  const X = Float64Array.from({ length: n }, (_, i)=> +x[at(i)]), Yo = new Float64Array(n), w = new Float64Array(n);
  // A 2θ that is not a number would put NaN in the background's basis (0·NaN is NaN in
  // every sum, whatever its weight) and break the bisection.
  const bad = X.findIndex(v=> !Number.isFinite(v));
  if (bad >= 0) throw new Error(`The pattern has a 2θ value that is not a number (point ${at(bad) + 1}).`);
  /* The weights: Mighell's χ²_γ (ApJ 518 (1999) 380). In counts N = y/m (m: one count in
     the units of y) the target is N + min(N, 1) and the variance N + 1; in the units of y,
     y + min(y, m) and m·(y + m), so the floor is one count in any unit (a rate's 1/t, not
     1 cps). At the true mean μ its residual (N + min(N, 1) − μ)/(N + 1) averages exactly 0
     over Poisson N, whatever μ. With 1/max(y, 1) a point that fluctuates low weighs more:
     the background came out 1.0–1.2 counts per point low (22 esd on a 5-count pattern),
     a peak's scale +0.5 % at 10 counts, +1.4 % at 5 and −4.6 % at 2 (Monte Carlo, one
     peak of 500, 200 and 100 counts); with χ²_γ the background is at the truth and the
     scale +0.25 %, +0.6 % and +0.8 %, and on a whole two-phase pattern at 5 counts no
     bias is resolved (−0.1 % and +0.3 %; 1/max(y, 1): +0.4 % and +1.0 %).
     Weights from the model remove the scale bias too, but a peak the model lacks then pulls
     the scale harder: 2× at 30 % of the modelled peak's area, 4–5× at 100 %. E[χ²_γ] is
     within 14 % of 1 per point from one count up (1/max(y, 1): 1.64 at 5 counts). Yo holds
     the target.
     The target's shift needs m right: with one count taken k times too large it moves the
     background by about k − 1 counts wherever the counts exceed k (+11 at k = 12, a rate
     with no counting time), where 1/max(y, 1) stays about a count low. So m is checked
     against the noise (noiseCountScale of y/m: 0.82–13 on Poisson counts over 225 synthetic
     patterns, the high end from sharp peaks at coarse steps); below 1/2 the data are not
     counts in the units given (a rate with no time, averaged, rescaled or smoothed counts)
     and the noise's unit is taken (countScale, warned in autoRefine), which bounds the bias
     to about a count. */
  const okPts = [], mOf = new Float64Array(n);
  for (let i = 0; i < n; i++){
    const yi = y[at(i)] == null ? NaN : +y[at(i)], m = varMul ? +varMul[at(i)] : 1;
    if (Number.isFinite(yi) && m > 0){ mOf[i] = m; okPts.push(i); }
  }
  const noise = noiseCountScale(okPts.map(i=> +y[at(i)]/mOf[i])), countScale = noise > 0 && noise < 0.5 ? noise : 1;
  for (const i of okPts){
    const yi = +y[at(i)], m = mOf[i]*countScale, c = Math.max(yi, 0);
    Yo[i] = yi + Math.min(c, m); w[i] = 1/((c + m)*m);
  }
  const nw = okPts.length;
  if (nw < MIN_POINTS) throw new Error(`The pattern has too few points (${nw}) for a refinement.`);
  // The typical point's noise (the median σ, in the units of y): how far a line's tail is
  // drawn (lineHalf).
  const sig = okPts.map(i=> 1/Math.sqrt(w[i])).sort((a, b)=> a - b), noise0 = sig[sig.length >> 1];
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
  // Each line its own f′, f″ (Kα2 its own column; a λ2 not tabulated takes λ1's).
  for (const L of lines) L.fp = lineName && (lineForWavelength(L.lam) || lineName);
  // Polarisation: with a monochromator the factor is (1 + K·cos²2θ), K = I_π/I_σ of its
  // crystal (xrd-instr.js: cos²2θ_M mosaic, |cos2θ_M| perfect); an object that gives only
  // the angle 2θ_M, cos²2θ_M; neither, graphite (002) at the tube's λ. Without one,
  // (1 + cos²2θ). (cos2M holds K.)
  let cos2M = 1;
  if (ins.monochromator){
    const tm = Number.isFinite(ins.monoAngle) ? ins.monoAngle*D2R : 2*Math.asin(Math.min(1, lam1/(2*GRAPHITE_D)));
    cos2M = ins.monoK > 0 && ins.monoK <= 1 ? ins.monoK : Math.cos(tm)**2;
  }
  const radius = ins.radius > 0 ? ins.radius : 240;
  // The widest a size may make a line: crystallites of D_MIN, whatever the wavelength.
  const ysMax = K_SCHERRER*lam1/D_MIN*R2D;

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
  /* A shift of 2θ as sin 2θ (°), the form of the sample's transparency (−90/(π·μ·R)°):
     refined on the standard with its zero and displacement, held at the standard's on a
     sample, as its zero (autoRefine). On the user's LaB6, with the Soller model, each
     line's position against the model's (one shift a line, fitted to its residual) ran
     +4.5 m° at 21°, −3 m° at 60–90° and +11 m° at 142°: the zero and displacement left
     3.0 m° rms, with a sin 2θ term 0.5 m° (sin θ, or 2θ and 2θ², about as well; tan θ, a
     cell or λ off, 1.9). It refines to −0.017°, where LaB₆'s own absorption (μ about
     600–1100 cm⁻¹ as packed) gives −0.001 to −0.002°: the rest is the instrument's, of
     that form, and the samples share it. Alone, with FCJ, it took the standard's χ²_ν from
     4.37 to 3.43. */
  add('transp', P.transp || 0, -1, 1, 1e-5);
  add('U', P.U, 0, 20, 1e-6, { group: 'profile' });
  add('V', P.V, -20, 20, 1e-6, { group: 'profile' });
  add('W', P.W, 0, 20, 1e-6, { group: 'profile' });
  add('X', P.X, 0, 10, 1e-6, { group: 'profile' });
  add('Y', P.Y, 0, 10, 1e-6, { group: 'profile' });
  // (S + H)/L of the axial divergence (fcjNodes). Its effect goes as its square, so at 0
  // its derivative vanishes: a refinement of it starts from a typical value (autoRefine).
  add('asym', P.asym, 0, 0.2, 1e-4, { group: 'profile' });
  // The Soller model of the axial divergence where the file gives both Sollers (sollerNodes):
  // their acceptances, the source's length, and the sample's and receiver's, refined.
  const sol = ins.soller || {}, p1 = +sol.incident, p2 = +sol.diffracted, Lx = ins.focusLength > 0 ? ins.focusLength : AX_SOURCE;
  const axial = p1 > 0 && p2 > 0 && p1 < 0.5 && p2 < 0.5 ? { p1, p2, Lx, LxAssumed: !(ins.focusLength > 0) } : null;
  if (axial) add('axL', P.axL > 0 ? P.axL : AX_START, AX_MIN, AX_MAX, 1e-3, { group: 'profile' });
  // A starting level for the background: the low tail of the counts.
  const sorted = Array.from(Yo).filter((v, i)=> w[i] > 0).sort((a, b)=> a - b);
  const level = sorted.length ? sorted[Math.floor(0.1*sorted.length)] : 0;
  for (let k = 0; k <= N; k++) add('bg' + k, k ? 0 : level, -Infinity, Infinity, 1, { linear: true, group: 'bg', basis: k });
  add('bgInv', 0, -Infinity, Infinity, 1, { linear: true, group: 'bg', basis: N + 1 });

  // Phases: reflections listed once, so the hkl list, and the multiplicities with it, stay
  // fixed while the cell moves. A growing cell brings lines from beyond the end into the
  // range (a shrinking one only takes lines out): the list goes down to the end's d over
  // the most the bounds let a d grow (latticeStretch), and never stops above dFull, 0.9 of
  // it (1 − LAT_RANGE: lines just beyond the end reach in with their tails). Those below
  // dFull at the file's cell are drawn only once the cell has grown them to it (growFade).
  const lamMax = Math.max(...lines.map(l=> l.lam));
  const thLim = Math.min(89.9, (x1 + 2)/2)*D2R;
  const dLim = lamMax/(2*Math.sin(thLim)), dFull = (1 - LAT_RANGE)*dLim;
  const pfxSeen = new Set();
  const ph = phases.map((p, k)=>{
    const id = p.id != null ? p.id : k, pfx = 'p' + id + '.';
    // Two phases under one prefix would share every parameter name: one of them could not
    // be reached by name, and getParams would give it the other's values.
    if (pfxSeen.has(pfx)) throw new Error(`Two phases share the id ${id}.`);
    pfxSeen.add(pfx);
    const cell = idealCell(p.constraint, p.cell), names = latticeNames(p.constraint), lat0 = latticeParams(p.constraint, cell);
    const dmin = Math.min(dFull, dLim/latticeStretch(p.constraint, cell, names, lat0, latRange)), list = reflections(cell, p.ops, dmin);
    const nFull = list.filter(r=> r.d >= dFull).length;     // (sorted by d, largest first)
    const atoms = p.atoms || [];
    const q = { id, name: p.name || '', pfx, cell, constraint: p.constraint, ops: p.ops, atoms,
      mass: Number.isFinite(p.mass) ? p.mass : cellMass(atoms), latNames: names,
      h: Int32Array.from(list, r=> r.h), k: Int32Array.from(list, r=> r.k), l: Int32Array.from(list, r=> r.l),
      lab: tickLabels(list, p.ops, p.constraint && p.constraint.basis),
      mult: Float64Array.from(list, r=> r.mult), nRefl: list.length, nFull, dFull, dmin, f2key: null, f2: null, iScale: -1, iB: -1, iXs: -1, iYs: -1, iLat: [],
      // options given but not usable, said with the results (autoRefine)
      specWarn: [] };
    q.iScale = par.length; add(pfx + 'scale', 1e-3, 0, Infinity, 1, { linear: true, group: 'phase', phase: k, kind: 'scale' });
    // Starting values from latticeParams: the conventional cell's when the constraint
    // refines a non-standard cell through it (xrd-cryst classify).
    names.forEach((nm, i)=>{
      const v0 = lat0[i], [lo, hi] = latBounds(nm, v0, latRange);
      q.iLat.push(par.length);
      add(pfx + nm, v0, lo, hi, isAngleName(nm) ? 1e-5 : 1e-6*v0, { group: 'phase', phase: k, kind: 'lattice', lat: nm });
    });
    q.iB = par.length; add(pfx + 'B', 0, -2, 10, 1e-4, { group: 'phase', phase: k, kind: 'B' });
    q.iXs = par.length; add(pfx + 'Xs', P.Xs, 0, 10, 1e-6, { group: 'phase', phase: k, kind: 'size' });
    q.iYs = par.length; add(pfx + 'Ys', P.Ys, 0, ysMax, 1e-6, { group: 'phase', phase: k, kind: 'size' });
    /* Size or strain broadening switched off (p.size false, p.strain 'off'): autoRefine
       holds its Ys or Xs at 0. The free shape and WPPM are models of the size: with it
       off there is nothing for them to model, and they are not set up. */
    q.sizeOff = p.size === false; q.strainOff = p.strain === 'off';
    if (q.sizeOff){
      const what = [shapeTypeOf(p.shape) && `the free shape (${shapeTypeOf(p.shape)})`, PROFILES.includes(p.profile) && p.profile !== 'lorentz' && `WPPM${p.profile === 'lognormal' ? ' (log-normal sizes)' : ''}`].filter(Boolean);
      if (what.length) q.specWarn.push(`${what.join(' and ')} ${what.length > 1 ? 'need' : 'needs'} the crystallite size, which is switched off: ignored`);
      p = { ...p, shape: false, profile: 'lorentz' };
    }
    if (shapeTypeOf(p.shape)) shapeSetup(q, p, cell, list, (nm, value, lo, hi, extra)=> add(pfx + nm, value, lo, hi, 1e-6, { group: 'phase', phase: k, kind: 'shape', ...extra }), ()=> par.length, ysMax);
    // A preferred orientation (March–Dollase): its axis (hkl, or 'auto': autoRefine picks
    // it), its r refined from the texture stage on (1, none, until then).
    const po = textureOf(p.po);
    if (!po && p.po != null && p.po !== false && String(p.po).trim() !== '') q.specWarn.push(`the preferred orientation ${JSON.stringify(p.po)} cannot be read (an axis as '110', '1 -1 0' or '[1 1 0]', or 'auto'): refined without`);
    if (po){
      memberVectors(q, p, cell, list);
      q.poSpec = po; q.poHkl = po === 'auto' ? null : po;
      q.iPO = par.length; add(pfx + 'PO', 1, 0.2, 5, 1e-4, { group: 'phase', phase: k, kind: 'texture' });
    }
    broadeningSetup(q, p, cell, list, (nm, value, lo, hi, step, extra)=> add(pfx + nm, value, lo, hi, step, { group: 'phase', phase: k, ...extra }), ()=> par.length);
    adpSetup(q, p, cell, (nm, value, lo, hi, step, extra)=> add(pfx + nm, value, lo, hi, step, { group: 'phase', phase: k, ...extra }), ()=> par.length);
    occSetup(q, p, cell, (nm, value, lo, hi, step, extra)=> add(pfx + nm, value, lo, hi, step, { group: 'phase', phase: k, ...extra }), ()=> par.length);
    return q;
  });

  const index = {};
  par.forEach((p, i)=> { index[p.name] = i; });
  return {
    x: X, y: Yo, w, n, x0, x1, rev, lines, lineName, cos2M, radius, bgDegree: N, basis, instrMissing: !instr,
    countScale: countScale < 1 ? countScale : null,
    phases: ph, par, index, v: Float64Array.from(par, p=> p.value),
    iZero: index.zero, iDisp: index.disp, iTr: index.transp, iProf: ['U','V','W','X','Y'].map(k=> index[k]), iAsym: index.asym,
    axial, iAx: index.axL,
    iBg: par.map((p, i)=> p.group === 'bg' ? i : -1).filter(i=> i >= 0),
    useInv: bgInvOn(x0, bgInv),
    win: WIN_FWHM, noise0, latRange,
    // The FCJ counts' keys (lineNodes): (k·rStride + r)·4 + j, a member's ·64 (at most 24 a
    // family, Friedel mates merged). A fixed 65536 shared keys between two phases once one
    // listed more reflections (a triclinic cell over about 1.6·10⁴ Å³ to 150° in Cu Kα).
    rStride: Math.max(1, ...ph.map(q=> q.nRefl)),
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
// The profile of phase k (the instrument's plus the phase's own broadening), at Kα1.
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
    // A site whose occupancy is refined: its atoms a type of their own, the occupancy theirs.
    const so = q.occOrbit ? q.occSites.find(s=> s.o === q.occOrbit[j]) : null;
    const id = key + '|' + el + '|' + occ + '|' + grp + (so ? '|q' + so.o : '');
    let t = tid.get(id);
    if (t === undefined){
      if (!byKey.has(key)){ byKey.set(key, keys.length); keys.push(key); }
      // f′, f″ at each line (fp2: the Kα2 line's, Kα1's when there is none)
      const fp = model.lines.map(L=> L.fp ? fprime(el, L.fp) : [0, 0]), fp2 = fp[fp.length - 1];
      t = types.push({ id, key: byKey.get(key), occ, B, fpr: fp[0][0], fpi: fp[0][1], fpr2: fp2[0], fpi2: fp2[1], site: o, R: q.adp === 'aniso' ? q.orbR[j] : null, iOcc: so ? so.iOcc : -1 }) - 1;
      tid.set(id, t);
    }
    return t;
  });
  // A second F² only where the Kα2 line's f′, f″ differ from Kα1's.
  const two = types.some(T=> T.fpr2 !== T.fpr || T.fpi2 !== T.fpi);
  const nt = types.length, gr = new Float64Array(q.nRefl*nt), gi = new Float64Array(q.nRefl*nt);
  for (let r = 0; r < q.nRefl; r++){
    const h = q.h[r], k = q.k[r], l = q.l[r];
    q.atoms.forEach((a, j)=>{
      const ph = 2*Math.PI*(h*a.x + k*a.y + l*a.z), o = r*nt + tIdx[j];
      gr[o] += Math.cos(ph); gi[o] += Math.sin(ph);
    });
  }
  q.geo = { types, keys, gr, gi, two };
}
// F² of every listed reflection for this cell (f0 and the Debye–Waller factor follow s,
// so they move with the cell) and these displacement parameters; recomputed only when
// either changes. q.f2b: the Kα2 line's, with its own f′, f″ (q.f2 itself when they are
// Kα1's).
function phaseF2(model, q, cell, Gs, v){
  const adpKey = q.adp === 'site' ? q.sites.map(st=> v[st.iB]).join() : q.adp === 'aniso' ? q.sites.map(st=> st.iU.map(i=> v[i]).join(':')).join() : '';
  const occKey = q.occSites && q.occSites.length ? q.occSites.map(s=> v[s.iOcc]).join() : '';
  const key = cell.a + ',' + cell.b + ',' + cell.c + ',' + cell.alpha + ',' + cell.beta + ',' + cell.gamma + '|' + adpKey + '|' + occKey;
  if (q.f2key === key) return q.f2;
  if (q.atoms.length && !q.geo) phaseGeometry(model, q);
  const f2 = new Float64Array(q.nRefl), d = new Float64Array(q.nRefl);
  const geo = q.geo, nt = geo ? geo.types.length : 0, f0s = geo ? new Float64Array(geo.keys.length) : null;
  const two = !!(geo && geo.two), f2b = two ? new Float64Array(q.nRefl) : f2;
  // Per type: B (isotropic), or β (anisotropic: the site's, turned by the type's R).
  let Bt = null, betas = null;
  if (geo && q.adp === 'site') Bt = geo.types.map(T=> v[q.sites[T.site].iB]);
  if (geo && q.adp === 'aniso'){
    const Ns = [Math.sqrt(Gs[0]), Math.sqrt(Gs[4]), Math.sqrt(Gs[8])];
    const bs = q.sites.map(st=> betaOf(siteU(st, v, Ns), Ns));
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
    let r1 = 0, i1 = 0, r2 = 0, i2 = 0, r3 = 0, i3 = 0, r4 = 0, i4 = 0;
    for (let t = 0; t < nt; t++){
      const T = geo.types[t];
      let dw;
      if (betas){ const b = betas[t]; dw = Math.exp(-(h*h*b[0] + k*k*b[4] + l*l*b[8] + 2*(h*k*b[1] + h*l*b[2] + k*l*b[5]))); }
      else dw = Math.exp(-(Bt ? Bt[t] : T.B)*s2);
      const w = (T.iOcc >= 0 ? v[T.iOcc] : T.occ)*dw, ar = w*(f0s[T.key] + T.fpr), ai = w*T.fpi;
      const g = geo.gr[r*nt + t], gs = geo.gi[r*nt + t];
      r1 += ar*g - ai*gs; i1 += ar*gs + ai*g;           // F(h)
      r2 += ar*g + ai*gs; i2 += ai*g - ar*gs;           // F(−h): G conjugated
      if (two){
        const br = w*(f0s[T.key] + T.fpr2), bi = w*T.fpi2;
        r3 += br*g - bi*gs; i3 += br*gs + bi*g; r4 += br*g + bi*gs; i4 += bi*g - br*gs;
      }
    }
    f2[r] = 0.5*(r1*r1 + i1*i1 + r2*r2 + i2*i2);
    if (two) f2b[r] = 0.5*(r3*r3 + i3*i3 + r4*r4 + i4*i4);
  }
  q.f2key = key; q.f2 = f2; q.f2b = f2b; q.d = d;
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
/* A reflection listed only for a cell that may grow (its d at the file's cell below dFull,
   0.9 of the end's, where the list stops otherwise) is drawn once the cell has grown it
   past dFull, faded in over the next 2 % of d, smoothly in the cell. So at the file's cell
   the pattern and its cost are as with the shorter list: drawn at once, the lines of a
   monoclinic cell between 152° and 170° (pattern to 120°) reached in with their tails and
   made autoRefine 1.5 times as long. */
function growFade(d, dFull){
  const b = 1.02*dFull;
  if (d <= dFull) return 0;
  if (d >= b) return 1;
  const s = (d - dFull)/(b - dFull);
  return s*s*(3 - 2*s);
}

// One line of one reflection with the free shape: a peak per member of the family, its
// Lorentzian width Y (the instrument's and the faults', and the legacy ellipsoid's
// isotropic Ys) + the shape's own (shapeWidths: wv, one per member, times prof.ws, the
// line's λ/λ1), each a 1/m share of the intensity (times its texture weight). With the lsq
// line (prof.ks: shapeLineKs) the shape's width w enters as kl·w in the Lorentzian and
// kg·w in the Gaussian, in quadrature. The FCJ counts are held per member (their keys
// negative, apart from the isotropic lines').
function shapeLine(model, k, r, j, th, tt, I, wv, prof, out, ticks, S, f2, d, tw){
  const q = model.phases[k], m = wv.length, x = model.x, xa = model.x0, xb = model.x1;
  const { U, V, W, X, Y, A, ws = 1, ks = null } = prof;
  const [dLo, dHi] = axialReach(th, A);
  let sw = 0, sH = 0, sE = 0, tSum = 0;
  for (let i = 0; i < m; i++){
    const pr = ks ? profileAtThetaG(th, U, V, W, X, Y + ws*wv[i]*ks[2*i + 1], ws*wv[i]*ks[2*i]) : profileAtTheta(th, U, V, W, X, Y + ws*wv[i]), ti = tw ? tw[i] : 1;
    sw += ti; sH += ti*pr.H; sE += ti*pr.eta; tSum += ti;
    const Im = I/m*ti, half = lineHalf(model, pr.H, pr.eta, S*Im), win = half/pr.H;
    if (tt + dHi + half < xa || tt + dLo - half > xb) continue;
    const nodes = axialOn(A) ? lineNodes(model, -1 - ((k*model.rStride + r)*64 + i)*4 - j, th, A, pr.H, sollerTol(model, S*Im, pr.H, pr.eta)) : null;
    addLine(out, x, tt, pr.H, pr.eta, Im, nodes, win);
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
function wppmLineOf(model, k, r, j, th, tt, I, inst, ext, out, ticks, S, f2, d, ts, tw, pend){
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
      members.push(base === 'cylinder' ? [Math.hypot(a, b), 0, cc, n*kScale*toMedian, wi, w] : [a, b, cc, n*kScale*toMedian, wi, w]);
    }
    sizeMean /= wsum || 1;
  } else {
    const ys = ext.Ys;
    sizeMean = sizeMin = ys > 0 ? 1.23*ys : 0;   // a sphere's FWHM is 1.23× the Lorentzian reading
    members = ys > 0 ? [[0, 0, 0, ys*kScale*toMedian, 1]] : null;
  }
  const lorTot = pr.HL + sizeMean/c + strDeg + fltDeg;
  // A line's widths from its size's mean (the window) and narrowest (the step)
  const widths = (wMean, wMin)=> [tch(pr.HG, pr.HL + wMean/c + strDeg + fltDeg).H, tch(pr.HG, pr.HL + wMin*grow/c + strDeg + fltDeg).H];
  const [Hest, Hmin] = widths(sizeMean, sizeMin);
  // (the window's least half-width: lineHalf's, from the line as a pseudo-Voigt)
  const tq = tch(pr.HG, lorTot), halfT = lineHalf(model, Hest, tq.eta, S*I);
  const [dLo, dHi] = axialReach(th, A);
  const xa = model.x0, xb = model.x1;
  if (tt + dHi + halfT < xa || tt + dLo - halfT > xb) return;
  // The divergence's node count from the narrowest component the line can hold (a thin
  // plate's sharp in-plane members inside a broad line): counted from the whole line's
  // width, 3 nodes 0.1° apart drew separate bumps, 8 % of the peak.
  // (the error allowed at the top of its narrowest component)
  const nodes = axialOn(A) ? lineNodes(model, (k*model.rStride + r)*4 + j, th, A, Hmin, sollerTol(model, S*I, Hmin, tq.eta), WPPM_OPT.axial) : null;
  const spread = nodes ? nodes.reduce((s, nd)=> Math.max(s, Math.abs(nd.d)), 0) : 0;
  /* The tail rule draws no further than the grid holds at its step (an eighth of Hmin):
     a step grown for the tail costs the line's top more than the tail gains. On Si spheres
     at 10⁷ counts it had grown 4–5×, and with the divergence's nodes the line went
     negative by 2·10⁻⁴ of its peak. */
  const half = Math.max(Math.max(model.win*Hest, WIN_MIN), Math.min(halfT, WPPM_N_MAX*Math.max(Hmin, 1e-5)/16 - spread));
  const sizeOf = list => list ? (arr, n, dL)=> { for (const [a, b, cc, sc, wi] of list) addMemberCoef(arr, n, dL, base, a, b, cc, sc, sigma, wi); } : null;
  // (The texture's weights are in the members' weights; without a shape, in I already.)
  const tick = ticks && tt >= xa && tt <= xb, fw = tick ? {} : null;
  const line = { x: model.x, out, tt, lam: L.lam, I, Hi: pr.H, etai: pr.eta, WL, nodes, win: model.win, winMin: half };
  /* A solid whose members differ in width by more than one grid can hold (a thin plate's
     sharp in-plane members in a broad line: the window follows the mean, the step the
     sharpest): its members in groups of like width, from the sharpest, each group on its
     own grid. The profile is linear in the members, so the groups add up to the line.
     (On one grid past the cap the step grew: 1 nm sheets 500 nm across were drawn 1–9 %
     of the peak off.) */
  const fits = ([He, Hm])=> wppmPoints(He, Hm, spread, model.win, half) <= WPPM_N_MAX;
  if (ts && members.length > 1 && !fits([Hest, Hmin])){
    let g = null;
    const draw = ()=> { if (g.sw > 0){ const [He, Hm] = widths(g.swx/g.sw, g.list[0][5]); wppmLine({ ...line, Hest: He, Hmin: Hm, size: sizeOf(g.list), fwhm: fw }); } };
    for (const mb of members.slice().sort((p, s)=> p[5] - s[5])){
      if (g){
        const sw = g.sw + mb[4], swx = g.swx + mb[4]*mb[5];
        if (fits(widths(sw > 0 ? swx/sw : mb[5], g.list[0][5]))){ g.list.push(mb); g.sw = sw; g.swx = swx; continue; }
        draw();
      }
      g = { list: [mb], sw: mb[4], swx: mb[4]*mb[5] };
    }
    draw();
  } else if (pend && !fw) pend.push({ ...line, Hest, Hmin, size: sizeOf(members) });   // (drawn with its pair: phasePattern)
  else wppmLine({ ...line, Hest, Hmin, size: sizeOf(members), fwhm: fw });
  if (tick){
    /* The tick's FWHM (xrd-widths' expected width; the phase detection's reach of a
       line), measured on the line as drawn. 1.23·Ys, the single sphere's, had been 1.6
       times a log-normal line's at σ = 0.94 and 2.2 at 1.2: its breadth stays with the
       volume-weighted mean while its top sharpens. (The estimate, should it fail.) */
    const Hm = lineFwhm(fw);
    const tSum = ts && tw ? tw.reduce((a, b)=> a + b, 0)/tw.length : 1;
    ticks.push({ phase: q.id, h: q.lab ? q.lab[3*r] : q.h[r], k: q.lab ? q.lab[3*r + 1] : q.k[r], l: q.lab ? q.lab[3*r + 2] : q.l[r],
                 tt, d: d[r], mult: q.mult[r], F2: f2[r], I: S*I*tSum, H: Hm > 0 ? Hm : tq.H, eta: tq.eta, j: 0, pk: k, r });
  }
}

/* One phase's pattern at scale 1 into `out` (zeroed here). With `ticks`, the α1 line of
   every reflection in the range is listed there too. */
const FS = { evals: 0, log: null, k: -1, t0: 0 };
function phasePattern(model, v, k, out, ticks){ FS.evals++; return phasePattern_(model, v, k, out, ticks); }
function phasePattern_(model, v, k, out, ticks){
  out.fill(0);
  const q = model.phases[k];
  const cell = cellOf(model, v, k), { Gs } = metric(cell);
  const f2 = phaseF2(model, q, cell, Gs, v), f2b = q.f2b, d = q.d;
  const zero = v[model.iZero], disp = v[model.iDisp], tr = v[model.iTr], dB = v[q.iB], A = axialOf(model, v);
  const [Ui, Vi, Wi, Xi, Yi] = model.iProf.map(i=> v[i]);
  const { U, V, W, X } = profileOf(model, v, k), Ys = v[q.iYs], lam1 = model.lines[0].lam;
  const x = model.x, xa = model.x0, xb = model.x1, S = v[q.iScale];
  // The free shape: each member of a family with its own size width (shapeSetup).
  const act = shapeActive(q, v);
  const wppm = q.wppm && !q.iL;
  const shp = act && !wppm ? shapeWidths(model, q, v) : null, ts = act && wppm ? shapeTs(model, q, v) : null;
  // (with the lsq line, each member's kg, kl: sizeLineKs; and below the isotropic sphere's)
  const lsq = SHAPE_MODE.line === 'lsq' && !!q.iW, shk = shp && lsq ? shapeLineKs(model, q, v) : null;
  const tw = textureWeights(q, v);
  const fa = q.iFA != null ? v[q.iFA] : 0, sigma = q.iLS != null ? v[q.iLS] : 0;
  /* The faults' layer spacing at this cell: the table's is the starting cell's, and κ goes
     as 1/d. Held there, α came out a_start/a_true times the truth (2.2 esd for a cell 0.5 %
     off, 8 esd for 2 %, on synthetic fcc patterns of 3·10⁴ counts); now within 0.1 esd.
     (|B·h| = √(hᵀG*h).) */
  let fScale = 1;
  if (fa > 0 && q.faultTab.gB > 0){
    const h = q.faultTab.hp;
    let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += h[i]*Gs[3*i + j]*h[j];
    fScale = Math.sqrt(s)/q.faultTab.gB;
  }
  const sk = model.skip, skip = sk && sk.k === k ? sk.rs : null;
  if (sk && sk.only && sk.k !== k) return out;
  // WPPM_OPT.pair: a reflection's two lines drawn together (wppmPair), but for the ticks' calc
  const pend = wppm && WPPM_OPT.pair && !ticks && model.lines.length === 2 ? [] : null;
  for (let r = 0; r < q.nRefl; r++){
    if (skip && (sk.only ? !skip.has(r) : skip.has(r))) continue;
    const gf = r < q.nFull ? 1 : growFade(d[r], q.dFull);
    if (!gf) continue;
    const s2 = 0.25/(d[r]*d[r]);
    // (base2: the Kα2 line's, with its own F²)
    const dw = Math.exp(-2*dB*s2)*gf;
    let base = q.mult[r]*f2[r]*dw, base2 = f2b === f2 ? base : q.mult[r]*f2b[r]*dw;
    // the texture: each member weighed (a shaped phase's, one by one in shapeLine)
    if (tw && !shp && !ts){ const o = tw[r]; let t = 0; for (let i = 0; i < o.length; i++) t += o[i]; base *= t/o.length; base2 *= t/o.length; }
    // Stephens' strain and the faults: this reflection's own (none: the phase's Xs, 0).
    const eps = q.iS ? strainOf(q, v, r) : v[q.iXs]*D2R/4;
    const kappa = fa > 0 ? fScale*faultKappa(q.faultTab, r, fa) : 0;
    const Xr = q.iS ? Xi + 4*eps*R2D : X;
    for (let j = 0; j < model.lines.length; j++){
      const L = model.lines[j], st = L.lam/(2*d[r]);
      if (st >= 1) continue;
      const th = Math.asin(st);
      const tt = 2*th*R2D + zero + disp*Math.cos(th) + tr*Math.sin(2*th);
      const fade = backFade(model, tt);
      if (!fade) continue;
      const I = (j ? base2 : base)*L.w*lpFactor(model, th)*fade;
      if (wppm){
        wppmLineOf(model, k, r, j, th, tt, I, { U: Ui, V: Vi, W: Wi, X: Xi, Y: Yi, A }, { eps, kappa, sigma, Ys: v[q.iYs] }, out, ticks && j === 0 ? ticks : null, S, f2, d, ts ? ts[r] : null, ts && tw ? tw[r] : null, pend);
        continue;
      }
      // The size (Ys, read as D = Kλ1/Ys, and the shape's widths) and the faults broaden
      // in d*, alike for both lines: in 2θ a line's λ/λ1 times Kα1's width, over its own
      // cosθ — FWHM κ/π in d* is λκ/π/cosθ (WPPM has them so). The instrument's Y is the
      // standard's, as refined. A body's free shape is the whole size: its widths stand for
      // Ys (held at 0 in its search), left out as WPPM leaves it; the legacy ellipsoid's
      // widths add to Ys (shapeOf).
      const lr = L.lam/lam1, Yr = Yi + lr*(shp && q.iW ? 0 : Ys) + (kappa > 0 ? L.lam*kappa/Math.PI*R2D : 0);
      if (shp){ shapeLine(model, k, r, j, th, tt, I, shp[r], { U, V, W, X: Xr, Y: Yr, A, ws: lr, ks: shk ? shk[r] : null }, out, ticks && j === 0 ? ticks : null, S, f2, d, tw ? tw[r] : null); continue; }
      // The isotropic sphere of a phase whose free shape is asked for, with the lsq line: the
      // ball's (SL_K), so that the shape is kept or not against its like (§10.8); a phase
      // without one keeps the Lorentzian Ys.
      const pr = lsq && Ys > 0 ? profileAtThetaG(th, U, V, W, Xr, Yr - lr*Ys*(1 - SL_K.ball[1]), lr*Ys*SL_K.ball[0]) : profileAtTheta(th, U, V, W, Xr, Yr);
      // The axial divergence spreads the peak over shifts within [dLo, dHi] (axialReach): a
      // line out of range by more than that is skipped before its nodes.
      const [dLo, dHi] = axialReach(th, A);
      const half = lineHalf(model, pr.H, pr.eta, S*I), win = half/pr.H;
      if (tt + dHi + half < xa || tt + dLo - half > xb) continue;
      const nodes = axialOn(A) ? lineNodes(model, (k*model.rStride + r)*4 + j, th, A, pr.H, sollerTol(model, S*I, pr.H, pr.eta)) : null;
      addLine(out, x, tt, pr.H, pr.eta, I, nodes, win);
      if (ticks && j === 0 && tt >= xa && tt <= xb)
        ticks.push({ phase: q.id, h: q.lab ? q.lab[3*r] : q.h[r], k: q.lab ? q.lab[3*r + 1] : q.k[r], l: q.lab ? q.lab[3*r + 2] : q.l[r],
                     tt, d: d[r], mult: q.mult[r], F2: f2[r], I: S*I, H: pr.H, eta: pr.eta, j: 0, pk: k, r });
    }
    if (pend && pend.length){ if (pend.length === 2) wppmPair(pend[0], pend[1]); else wppmLine(pend[0]); pend.length = 0; }
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
// to choose), everything else held at v, the scales kept ≥ 0: the exact optimum, written
// into v (setParams to keep it). One solve when no scale comes out negative; else
// Lawson and Hanson's active set (Solving Least Squares Problems, 1974, ch. 23) on the
// normal equations: a scale that would go negative is stopped at 0 along the step, and
// one at 0 comes back when the gradient there favours it. (Zeroing the negative ones and
// solving again, never readmitting one, ended up to 0.4 % of χ² above the optimum on
// strongly overlapping phases.) Returns the evaluated state at the new v.
function solveLinear(model, v, st, which){
  st = st || evaluate(model, v);
  const idx = which ? which.slice() : [...model.phases.map(q=> q.iScale), ...model.iBg.filter(i=> model.useInv || model.par[i].name !== 'bgInv')];
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
  // The linear parameters held (not solved for) stay in y_c (assemble): their part comes
  // off the data first, else the solve was the optimum with them at 0, not at their values.
  const allLin = [...model.phases.map(q=> q.iScale), ...model.iBg];
  const m = idx.length, cols = idx.map(colOf);
  const A = new Float64Array(m*m), g = new Float64Array(m);
  const held = allLin.filter(i=> !idx.includes(i) && v[i]);
  let yr = y;
  if (held.length){ yr = Float64Array.from(y); for (const k of held){ const c = colOf(k), vk = v[k]; for (let i = 0; i < n; i++) yr[i] -= vk*c[i]; } }
  for (let a = 0; a < m; a++){
    const ca = cols[a];
    const gk = 'y,' + idx[a], useCache = isBg(idx[a]) && !held.length;
    let s = useCache ? cache.get(gk) : undefined;
    if (s === undefined){ s = 0; for (let i = 0; i < n; i++) s += w[i]*ca[i]*yr[i]; if (useCache) cache.set(gk, s); }
    g[a] = s;
    for (let b = a; b < m; b++) A[a*m + b] = A[b*m + a] = isBg(idx[a]) && isBg(idx[b]) ? bgDot(idx[a], idx[b]) : dot(ca, cols[b]);
  }
  const D = new Float64Array(m);
  for (let a = 0; a < m; a++) D[a] = A[a*m + a] > 0 ? Math.sqrt(A[a*m + a]) : 1;
  for (let a = 0; a < m; a++){ g[a] /= D[a]; for (let b = 0; b < m; b++) A[a*m + b] /= D[a]*D[b]; }
  // The optimum with the parameters `on` free and the others at 0.
  const solveOn = on => {
    const a = [];
    for (let k = 0; k < m; k++) if (on[k]) a.push(k);
    const k = a.length, M = new Float64Array(k*k), b = new Float64Array(k), x = new Float64Array(m);
    a.forEach((p, r)=> { b[r] = g[p]; a.forEach((q, c)=> { M[r*k + c] = A[p*m + q]; }); });
    const s = cholSolve(cholesky(M, k, 1e-12), b, k);
    a.forEach((p, r)=> { x[p] = s[r]; });
    return x;
  };
  const isS = idx.map(i=> model.par[i].kind === 'scale'), on = idx.map(()=> true);
  const x = solveOn(on);
  if (isS.some((s, k)=> s && x[k] < 0)){
    // From the point with those scales at 0 (feasible). Each pass readmits one scale;
    // the bound only guards against a cycle on rounding.
    for (let k = 0; k < m; k++) if (isS[k] && !(x[k] > 0)){ x[k] = 0; on[k] = false; }
    const skip = new Set();
    for (let pass = 0, entered = -1; pass <= 3*m; pass++){
      let z = solveOn(on);
      // A scale just readmitted that the solve sends to 0 or below: the gradient's sign
      // was rounding. It stays out until x moves, and the next best is tried.
      if (entered >= 0 && !(z[entered] > 0)){ on[entered] = false; skip.add(entered); }
      else {
        skip.clear();
        for (;;){
          let t = 1, kt = -1;
          for (let k = 0; k < m; k++) if (on[k] && isS[k] && z[k] <= 0){ const tk = x[k]/(x[k] - z[k]); if (tk < t){ t = tk; kt = k; } }
          for (let k = 0; k < m; k++) x[k] += t*(z[k] - x[k]);
          if (kt < 0) break;
          for (let k = 0; k < m; k++) if (on[k] && isS[k] && (k === kt || !(x[k] > 0))){ x[k] = 0; on[k] = false; }
          z = solveOn(on);
        }
      }
      // The scale at 0 whose rise lowers χ² the most comes back (none: the optimum).
      let best = -1, gb = 0;
      for (let k = 0; k < m; k++) if (!on[k] && !skip.has(k)){ let gk = g[k]; for (let j = 0; j < m; j++) gk -= A[k*m + j]*x[j]; if (gk > gb){ gb = gk; best = k; } }
      if (best < 0) break;
      on[best] = true; entered = best;
    }
  }
  idx.forEach((i, a)=> { v[i] = x[a]/D[a]; });
  return assemble(model, v, st);
}

// The difference step of parameter j at v: its own (Stephens' from the phase's strain, U, V
// and W's from H_G²), at least 10⁻⁷ of its value. (jacobian, and hgFloored, which must see the same points.)
function diffStep(model, j, v){
  const p = model.par[j], uvw = model.iProf.indexOf(j);
  const h = p.kind === 'strain' ? strainStep(model, p, v) : uvw >= 0 && uvw < 3 ? uvwStep(model, p, v, 2 - uvw) : p.step;
  return Math.abs(v[j])*1e-7 > h ? Math.abs(v[j])*1e-7 : h;
}
/* The Jacobian columns of the free parameters at v (st the state there): exact for the
   linear ones (∂y/∂S = the phase at scale 1, ∂y/∂c = its basis function), central
   differences for the rest, recomputing only the phases a parameter touches (one-sided
   at a bound, so the model is never evaluated outside it). fwd (refine()'s opts.forward):
   forward differences, one displaced point a column, the pattern at v st's (this
   refinement's, with its FCJ counts); at the upper bound the point below. Half the
   evaluations of a column; on the free shape's search the iterations a refinement took
   did not change (round 2, AB §4.2). */
function jacobian(model, v, st, free, cols, fwd = false){
  const n = model.n, np = model.phases.length;
  const tmpA = new Float64Array(n), tmpB = new Float64Array(n);
  free.forEach((j, a)=>{
    const p = model.par[j], col = cols[a];
    if (p.linear){ col.set(p.group === 'bg' ? model.basis[p.basis] : st.pats[p.phase]); return; }
    col.fill(0);
    const h = diffStep(model, j, v);
    let up = v[j] + h, dn = v[j] - h;
    if (fwd){ dn = v[j]; if (up > p.hi){ up = v[j]; dn = Math.max(p.lo, v[j] - h); } }
    else { if (up > p.hi) up = v[j]; if (dn < p.lo) dn = v[j]; }
    if (up === dn) return;
    const vu = v.slice(), vd = v.slice(); vu[j] = up; vd[j] = dn;
    const ks = p.group === 'phase' ? [p.phase] : [...Array(np).keys()];
    for (const k of ks){
      const S = v[model.phases[k].iScale]; if (!S) continue;
      // Both displaced points with the same FCJ node counts (lineNodes): refine()'s, held
      // over the whole refinement (a Jacobian is taken only inside one; up to v479 a
      // column taken outside one held counts of its own, a case that never arose).
      let pu = tmpA, pd = tmpB;
      if (fwd){ if (up === v[j]){ pu = st.pats[k]; phasePattern(model, vd, k, tmpB); } else { phasePattern(model, vu, k, tmpA); pd = st.pats[k]; } }
      else if (dn === v[j]){ phasePattern(model, v, k, tmpB); phasePattern(model, vu, k, tmpA); }
      else { phasePattern(model, vu, k, tmpA); phasePattern(model, vd, k, tmpB); }
      const f = S/(up - dn);
      for (let i = 0; i < n; i++) col[i] += f*(pu[i] - pd[i]);
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
/* Is H_G² on its floor at a reflection inside the pattern, for a phase that is there
   (scale > 0), or does the lower difference point of a free U, V or W take it there
   (jacobian's step, diffStep, one-sided at a bound)? Then ∂y/∂(U, V, W) follow the floor,
   not the data. A fixed margin (100× the floor, H_G ≤ 10⁻³°, up to v426) reported
   resolved synchrotron widths (H_G 0.0006–0.0009° at a 0.0002° step, refined within 2 %)
   as on a bound with esd NaN, though no difference point reached the floor. */
function hgFloored(model, v, free){
  const iP = model.iProf.slice(0, 3), [U, V, W] = iP.map(i=> v[i]), zero = v[model.iZero], disp = v[model.iDisp], tr = v[model.iTr];
  const [hU, hV, hW] = iP.map(j=>{
    if (!free.includes(j)) return 0;
    const h = diffStep(model, j, v);
    return v[j] - h < model.par[j].lo ? 0 : h;
  });
  for (const q of model.phases){
    if (!(v[q.iScale] > 0) || !q.d) continue;
    for (let r = 0; r < q.nRefl; r++) for (const L of model.lines){
      const st = L.lam/(2*q.d[r]); if (st >= 1) continue;
      const th = Math.asin(st), tt = 2*th*R2D + zero + disp*Math.cos(th) + tr*Math.sin(2*th);
      if (tt < model.x0 || tt > model.x1) continue;
      const t = Math.tan(th);
      if (U*t*t + V*t + W - Math.max(hU*t*t, hV*t, hW) <= HG2_FLOOR) return true;
    }
  }
  return false;
}

/* refine(model, { free, maxIter, onProgress, lambda, shiftTol }) → Levenberg–Marquardt on
   the free parameters (names; default: those flagged `refine` in the registry), from the
   model's current values (clamped into their bounds first); the model keeps the result.
   Bounds: a step is clamped into them; a parameter sitting on a bound with the gradient
   pushing outwards is held for that iteration, and is listed in atBound at the end. When
   V is refined, its lower bound also follows U and W (vFloor), so the Gaussian width
   stays real over the whole pattern; U, V, W whose quadratic still reaches the floor at a
   reflection (U = V = W = 0) are listed in atBound with esd NaN.
   Converged when no parameter moves by more than 1 % of its esd (shiftTol, 0.01), or when
   no step lowers χ² any further; stopped after maxIter iterations (40); λ starts at
   lambda (10⁻³; a start above that has its shifts tested at the size its extra damping
   cut them from: LAM_START). esd_j = √((JᵀWJ)⁻¹_jj · χ²_red); a parameter with no
   effect on the pattern (a zero column, e.g. the widths of a phase at scale 0) or
   numerically a combination of others has esd NaN, and is listed in `undetermined` — and so are the
   others of that combination (X with a phase's Xs: the profile has X + Xs), whose
   inverse holds the variance each would have with it held. `tied` lists each such set
   (names), `esdHeld` those conditional esds. iterations and ms: over all the passes
   (passes: how many), why: the last pass's; fcjBehind: the last pass still left a line
   behind its held FCJ count. For the free shape's search (v2): forward, forward
   differences in the iterations (jacobian; the covariance stays central); noCov, no
   covariance at the end (esd {}, cov null: a refinement whose esds nobody reads, 10 % of
   a brief one's evaluations); covOnly, no iterations, the covariance alone (after the
   linear parameters' solve). */
/* refine()'s passes with fresh FCJ counts run until no line has outgrown its count. On
   synthetic standards (LaB6, Si; (S + H)/L 0.01–0.2 started from 0.005, 0.02, 0.05 and
   0.08, two profiles) at most 6 were needed, 4 from ASYM_START. The cap of 4 that the
   user's LaB6 had suggested stopped one pass short from 0.005 at A = 0.15: the asymmetry
   3 esd off and χ²_ν 0.3 % high (8.6 esd and 0.3 % on Si). FCJ_PASSES only stops a cycle. */
const FCJ_PASSES = 10;
function refine(model, opts = {}){
  if (!FS.log) return refine_(model, opts);
  const q = model.phases[FS.k], e0 = FS.evals, t0 = Date.now(), idx = q ? [...(q.iW || q.iL || []), ...(q.iR || []), ...(q.iQ || [])] : [];
  const at = () => idx.map(i=> model.v[i]);
  const rec = { maxIter: opts.maxIter, audit: opts.audit !== false, nFree: (opts.free || []).length, soft: !!model.shapeSoft, rotFree: !!(q && q.iR && q.iR.some(i=> (opts.free || []).includes(model.par[i].name))), from: at() };
  try {
    const r = refine_(model, opts);
    Object.assign(rec, { iterations: r.iterations, evals: FS.evals - e0, ms: Date.now() - t0, chi2: r.stats.chi2*Math.max(1, r.stats.N - r.stats.P), chi2nu: r.stats.chi2, P: r.stats.P, to: at(), evalsAt: FS.evals, tAt: Date.now() - FS.t0 });
    return r;
  } catch(e){ Object.assign(rec, { error: String(e && e.message || e), evals: FS.evals - e0, ms: Date.now() - t0, evalsAt: FS.evals, tAt: Date.now() - FS.t0 }); throw e; }
  finally { FS.log.push(rec); }
}
function refine_(model, opts = {}){
  // The FCJ node counts held for the whole refinement (lineNodes). When the refinement
  // has carried a line past its held count (the asymmetry, freed from 0.02, went to 0.058
  // on the user's standard: tails 8× longer than the count was made for, and χ² 8 % off
  // at the end), it runs again from there with counts made at the new values.
  if (model.fcjFreeze) return refineHeld(model, opts);
  const t0 = Date.now();
  let res, iterations = 0, passes = 0;
  // opts.audit === false: one pass (the free shape's brief trial refinements, which only
  // rank the starting shapes). Otherwise passes until no line has outgrown its count
  // (FCJ_PASSES only stops a cycle; a last pass still behind is returned as fcjBehind).
  for (let pass = 0; pass < (opts.audit === false ? 1 : FCJ_PASSES); pass++){
    const fz = model.fcjFreeze = new Map();
    try { res = refineHeld(model, opts); }
    finally { model.fcjFreeze = null; }
    iterations += res.iterations; passes++;
    model.fcjAudit = fz; model.fcjBehind = false;
    try { for (let k = 0; k < model.phases.length; k++) if (model.v[model.phases[k].iScale]) phasePattern(model, model.v, k, new Float64Array(model.n)); }
    finally { model.fcjAudit = null; }
    if (!model.fcjBehind || opts.audit === false) break;
  }
  return { ...res, iterations, passes, fcjBehind: opts.audit !== false && !!model.fcjBehind, ms: Date.now() - t0 };
}
/* The least damping: a tenth of the Cholesky pivot tolerance, so that a direction the
   factorisation keeps (pivot ≥ 10⁻¹⁰) takes at least 9/10 of its Gauss–Newton step. At
   10⁻⁹ a direction with a pivot of 10⁻¹¹–10⁻⁹ took 1–50 % of it per iteration: the 1/2θ
   term beside T₀…T₁₆ (bgDegree 16) crawled to the 80-iteration cap unconverged (χ²_ν
   1.039 in the last iterations, 1.036696 after the final linear re-solve) where 10⁻¹¹
   converges in 12 (1.036659); well-conditioned refinements are unchanged. */
const LAM_MIN = CHOL_TOL/10;
/* λ's start (the setting lambda, 10⁻³ by default). A start above it must not end a
   refinement by itself: a step damped by λ is about 1/(1 + λ) of Gauss–Newton's on the
   correlation-scaled matrix, and from 10³ the first step passed the shift test at once,
   30 esd short of the minimum (synthetic SrTiO₃, χ²_ν 1.24 against 1.01). So its shifts
   count at the size that damping beyond the default start cut them from (gnScale): 1 for
   any start up to 10⁻³, and for the damping that rejections add, as before. */
const LAM_START = 1e-3;
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
  const lam0 = opts.lambda || LAM_START, tol = opts.shiftTol > 0 ? opts.shiftTol : 0.01;
  const gnScale = l => Math.max(1, (1 + Math.min(l, lam0))/(1 + LAM_START));
  let lam = lam0, it = 0, converged = false, why = '';
  const cols = free.map(()=> new Float64Array(n));
  let trial = null, trialZ = null;
  const onBound = (j, g) => { const p = model.par[j]; return (v[j] <= loOf(j, v) && g < 0) || (v[j] >= p.hi && g > 0); };
  const chiRed = c => c/Math.max(1, rStats(model, st.yc, st.bg).N - m);
  /* The free linear parameters (scales, background) solved exactly, the rest held, when
     the steps have stopped. The 1/2θ term and the Chebyshev terms are nearly collinear:
     along such a direction a damped step is cut to almost nothing while its shift is
     still far under 1 % of its (large) esd, and the refinement stopped with χ² up to 17
     above its minimum on synthetic plates, all of it in the background. When the solve
     gains more than a hundredth of χ²_ν the steps go on from there (at most 3 times),
     with λ back at its start: after 'no step lowers χ²' twelve rejections had left it
     at 10³ or more, a step a thousandth of Gauss–Newton's passed the shift test at once,
     and the refinement stopped 5–10 esd short of the minimum. */
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
  for (; m && !opts.covOnly && it < maxIter; it++){
    jacobian(model, v, st, free, cols, !!opts.forward);
    const { A, g } = normalEq(model, cols, st);
    const act = [];
    for (let a = 0; a < m; a++) if (A[a*m + a] > 0 && !onBound(free[a], g[a])) act.push(a);
    if (!act.length){ converged = true; why = 'nothing to move'; break; }
    const { As, gs, D, k } = scaled(A, g, m, act);
    // esds at this point, for the shift/esd test
    const chInv = cholInverse(cholesky(As, k), k), cr = chiRed(st.chi2);
    let accepted = false, maxRatio = 0;
    /* 12 tries, and on until λ reaches 10k: a correlation-scaled matrix of k parameters
       has no eigenvalue above k, so from there the step is a short one down the gradient,
       which lowers χ² unless the gradient is rounding. (From LAM_MIN, 12 tries alone
       reach only λ = 10; from v426's floor of 10⁻⁹ they reached 10³.) */
    for (let tries = 0; tries < 12 || (lam < 10*k && tries < 30); tries++){
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
        const lamUsed = lam;
        lam = Math.max(lam/10, LAM_MIN);
        accepted = true;
        if (maxRatio*gnScale(lamUsed) < tol || rel < 1e-9){ converged = true; why = `shifts below ${+(tol*100).toPrecision(2)} % of the esds`; }
        break;
      }
      lam *= 10;
    }
    if (opts.onProgress) opts.onProgress((it + 1)/maxIter, { iteration: it + 1, chi2: chiRed(st.chi2), lambda: lam });
    if (!accepted){ converged = true; why = 'no step lowers χ²'; }
    if (converged && linLeft > 0 && linSolve()){ converged = false; why = ''; lam = lam0; continue; }
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
  if (!opts.noCov) st = evaluate(model, v, st);
  const esd = {}, atBound = [], esdHeld = {};
  let corr = null, cov = null, tied = [];
  if (m && !opts.noCov){
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
    // The others of each dropped combination: not determined either, only the combination
    // is (their rows are conditional on the dropped one held: kept as esdHeld).
    ch.tied.forEach(t=> {
      if (t.length < 2) return;
      tied.push(t.map(b=> model.par[free[act[b]]].name));
      for (const b of t.slice(1)){
        const a = act[b], nm = model.par[free[a]].name;
        if (!(nm in esdHeld)) esdHeld[nm] = esd[nm];
        esd[nm] = NaN;
        for (let c = 0; c < m; c++){ cov[a][c] = cov[c][a] = NaN; if (c !== a) corr[a][c] = corr[c][a] = NaN; }
      }
    });
    if ([iU, iV, iW].some(j=> free.includes(j)) && hgFloored(model, v, free))
      for (const j of [iU, iV, iW]) if (free.includes(j)){ const nm = model.par[j].name; esd[nm] = NaN; if (!atBound.includes(nm)) atBound.push(nm); }
  }
  model.v = v; model.par.forEach((p, i)=> { p.value = v[i]; });
  const stats = rStats(model, st.yc, st.bg, m);
  /* No more weighted points than free parameters: the fit can pass through every point,
     and χ² (then 0) says nothing of the scatter. With N = m the esds came out 10⁻¹⁴–10⁻¹⁶
     of the values (11 points, a cell 'known' to 7·10⁻¹⁶ Å), with N < m NaN: none is given.
     (buildModel's MIN_POINTS only refuses a pattern no model can use.) */
  if (m && stats.N <= m){
    for (const j of free) esd[model.par[j].name] = NaN;
    for (const nm in esdHeld) esdHeld[nm] = NaN;   // the detection test reads these too
    if (cov) cov.forEach((r, a)=> { r.fill(NaN); corr[a].fill(NaN); corr[a][a] = 1; });
  }
  model.esd = esd;
  model.cov = { names: free.map(j=> model.par[j].name), cov };
  const freeNames = free.map(j=> model.par[j].name);
  return { params: getParams(model), esd, corr, cov, free: freeNames, atBound,
           undetermined: opts.noCov ? [] : freeNames.filter(nm=> !Number.isFinite(esd[nm]) && !atBound.includes(nm)), tied, esdHeld,
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
// A scan's grid over a range, with one more step beyond each end (`beyond`): a minimum
// inside the range then has its nearest grid point inside the grid, not on its last point,
// where edgeOrFlat reads it as none (within half a step of the end, the range searched was
// ±(range − h/2)). The minimum found counts when it lies within the range.
const grid = (lo, hi, n) => Array.from({ length: n }, (_, s)=> lo + (hi - lo)*s/(n - 1));
const beyond = g => { const h = g[1] - g[0]; return [g[0] - h, ...g, g[g.length - 1] + h]; };
// Parabola through the minimum and its two neighbours on the grid: the minimum between
// grid points, so the found value does not carry the grid's step. Fitted to χ² (∝ Rwp²),
// the quantity that is quadratic about its minimum: a parabola in Rwp = √χ² put it nearer
// the grid point (5·10⁻⁵ in a cell factor, against 6·10⁻⁶, on a step of 1.5·10⁻³). With b
// the least of the three it lies within h/2 of b.
function parabolicMin(curve, k){
  if (k <= 0 || k >= curve.length - 1) return curve[k].x;
  const [a, b, c] = [curve[k-1], curve[k], curve[k+1]].map(p=> p.Rwp*p.Rwp);
  const den = a - 2*b + c, x = curve[k].x;
  if (!(den > 0)) return x;
  const h = x - curve[k-1].x, off = 0.5*h*(a - c)/den;
  return x + Math.max(-h/2, Math.min(h/2, off));
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
   `curve` is the full-range pass (Rwp on widened peaks in the two-pass case; one step
   beyond each end, `beyond`), `fine` the second. found = false when the least Rwp lies
   on the edge of that grid, or the minimum placed lies outside 1 ± range, or the curve is
   flat (ties go to the point nearest f = 1: a phase whose scale solves to 0 everywhere
   would otherwise get the range's first point): no minimum inside the range.
   Then f = 1: the phase's peaks are not where any f in the range puts them — most often
   a candidate phase that is not in the sample, which an edge minimum would only start
   on a walk to its lattice bounds (an absent rutile, anatase or ZnO next to SrTiO3 took
   up to 74 wt % that way). The price: a phase that is there with its file cell beyond
   the range is not placed (autoRefine searches a single phase once more, wider). The
   model keeps f, with the scales and background solved there. */
/* The default range, ±CELL_RANGE: a file's cell against the sample's (a doped or solid-
   solution phase, a DFT cell: PBE's are 1–3 % long, a temperature). Over ±3 % (up to v426)
   a corundum 4 % off beside ZnO was not placed and was left out (2 runs of 2), as were a
   rutile, an anatase (60 wt %) and a quartz 4–4.5 % off (6 of 6); over ±5 % they are, the
   other 17 of 18 multi-phase searches, the 18 absent-candidate samples and 7 absent copies
   4–4.5 % off a present phase give the same verdicts, and the search takes the same time
   (median ratio 0.96). */
const CELL_RANGE = 0.05;
function cellSearch(model, opts = {}){
  // Peaks at their FCJ centroids for the search (lineNodes): a quarter of its cost on a
  // large sharp cell, and the minimum where the full profile puts it.
  const prev = model.fcjCentroid; model.fcjCentroid = true;
  try { return cellSearchAt(model, opts); } finally { model.fcjCentroid = prev; }
}
function cellSearchAt(model, opts){
  const range = opts.range != null ? opts.range : CELL_RANGE;
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
  const scale = (v, f) => lens.forEach(i=> { v[i] = v0[i]*f; });
  const only = opts.index != null || opts.phase != null ? ks : null;   // the other phases do not move
  let steps = opts.steps || 2*Math.ceil(range/df) + 1, curve, fine = null, f = 1, found = false;
  if (opts.steps || steps <= 161){
    steps = Math.max(41, steps);
    curve = scan(model, scale, beyond(grid(1 - range, 1 + range, steps)), only).curve;
    const kb = bestIndex(curve, 1);
    found = kb >= 0 && !edgeOrFlat(curve, kb);
    if (found) f = parabolicMin(curve, kb);
    steps += 2;
  } else {
    const nC = 81, dfC = 2*range/(nC - 1);
    const Hc = 3*2*tM*dfC*R2D, iW = model.index.W;   // the width that suits the coarse step
    // Only where the minimum lies matters in this pass: windows of ±10 FWHM, not ±40, on
    // peaks this wide (±18° each on a large cell made the pass most of the search).
    model.win = COARSE_WIN;
    try { curve = scan(model, (v, x)=> { scale(v, x); v[iW] = v0[iW] + Hc*Hc; }, beyond(grid(1 - range, 1 + range, nC)), only).curve; }
    finally { model.win = WIN_FWHM; }
    const kc = bestIndex(curve, 1);
    found = kc >= 0 && !edgeOrFlat(curve, kc);
    if (found){
      const fc = curve[kc].x, nF = 2*Math.ceil(2*dfC/df) + 1;
      fine = scan(model, scale, grid(fc - 2*dfC, fc + 2*dfC, nF), only).curve;
      const kf = bestIndex(fine, fc);
      if (kf >= 0) f = parabolicMin(fine, kf);
      steps = nC + 2 + nF;
    } else steps = nC + 2;
  }
  if (found && Math.abs(f - 1) > range*(1 + 1e-9)){ found = false; f = 1; }
  const v = v0.slice(); scale(v, f);
  const st = solveLinear(model, v, evaluate(model, v));
  setParams(model, v);
  const cells = ks.map(k=> ({ phase: model.phases[k].id, cell: cellOf(model, v, k) }));
  const out = c => c.map(p=> ({ f: p.x, Rwp: p.Rwp }));
  return { f, found, Rwp: rStats(model, st.yc, st.bg).Rwp, curve: out(curve), fine: fine && out(fine), steps, cells };
}

/* widthSearch(model, k, irf, th) → { ys, found, steps }: phase k's starting Ys, scanned
   with the scales and the background solved at each value and the other phases held. The
   grid: the profile's width at θ (the instrument's with Y + Ys, TCH) from the
   instrument's own up, each step √2 wider (a change of about a third of the width, as the
   cell search's step), to the crystallites autoRefine takes as implausible (max(1 nm, two
   cells) across). found = false when the least Rwp lies on that upper end or the curve is
   flat: the start is kept. The model keeps the Ys found, with the scales and background
   solved there. */
function widthSearch(model, k, irf, th){
  const q = model.phases[k], v0 = model.v.slice(), w = q.wppm ? 1.23 : 1;
  const Hof = ys => profileAtTheta(th, irf.U || 0, irf.V || 0, irf.W || 0, irf.X || 0, (irf.Y || 0) + ys*w).H;
  const c = cellOf(model, v0, k), ysMax = K_SCHERRER*model.lines[0].lam/Math.max(10, 2*Math.max(c.a, c.b, c.c))*R2D;
  const ysAt = H => { let lo = 0, hi = ysMax; for (let it = 0; it < 50; it++){ const mid = (lo + hi)/2; if (Hof(mid) > H) hi = mid; else lo = mid; } return (lo + hi)/2; };
  const ys = [0];
  for (let H = Hof(0)*Math.SQRT2; H < Hof(ysMax); H *= Math.SQRT2) ys.push(ysAt(H));
  ys.push(ysMax);
  const { curve } = scan(model, (v, y)=> { v[q.iYs] = y; }, ys, [k]);
  const kb = bestIndex(curve, v0[q.iYs]), found = kb >= 0 && kb < curve.length - 1 && !flat(curve);
  const v = v0.slice(); if (found) v[q.iYs] = ys[kb];
  solveLinear(model, v, evaluate(model, v));
  setParams(model, v);
  return { ys: v[q.iYs], found, steps: ys.length };
}

/* The Kα₁ FWHM of the most prominent peak: the profile's starting width. The peak: the
   local maximum of the counts (lightly smoothed, 3 points) that stands highest above the
   higher of the lowest counts within ±4° on either side (the highest count instead was
   the 1/2θ rise at 5° on a strong air-scatter background). Its FWHM by half maximum over
   a local background (the 10th percentile within ±4°); then the smoothing's widening
   taken off (a 3-point boxcar adds a variance of 2s²/3: 16 ln2·s²/3 to a Gaussian's
   FWHM²), and the Kα₂ shoulder (the doublet's width read back to its Kα₁ line's,
   doubletFwhm). On synthetic lines (six structures, steps 0.0084–0.05°, peaks of
   50–20000 counts, flat and 1/2θ backgrounds) it reads the Kα₁ line's own FWHM, its
   axial-divergence tail included, at a median 1.03 (10–90 %: 0.90–1.79; the high end is
   the floor of two steps, for lines narrower than that), where the full width of the
   smoothed doublet read 1.22 (0.95–2.45) and took a background maximum 9 times in 270. */
function widthEstimate(model){
  const { x, y, n } = model;
  const sm = new Float64Array(n);
  for (let i = 0; i < n; i++){ let s = 0, c = 0; for (let j = Math.max(0, i-1); j <= Math.min(n-1, i+1); j++){ s += y[j]; c++; } sm[i] = s/c; }
  let im = -1, best = -Infinity;
  for (let i = 1; i < n - 1; i++){
    if (!(sm[i] >= sm[i-1] && sm[i] > sm[i+1])) continue;
    let lo = Infinity, hi = Infinity;
    for (let j = i - 1; j >= 0 && x[i] - x[j] <= 4; j--) if (sm[j] < lo) lo = sm[j];
    for (let j = i + 1; j < n && x[j] - x[i] <= 4; j++) if (sm[j] < hi) hi = sm[j];
    if (sm[i] - Math.max(lo, hi) > best){ best = sm[i] - Math.max(lo, hi); im = i; }
  }
  if (im < 0){ im = 0; for (let i = 1; i < n; i++) if (sm[i] > sm[im]) im = i; }
  const loc = [];
  for (let i = 0; i < n; i++) if (Math.abs(x[i] - x[im]) <= 4) loc.push(sm[i]);
  loc.sort((a, b)=> a - b);
  const bg = loc[Math.floor(0.1*loc.length)], half = bg + (sm[im] - bg)/2;
  let l = im, r = im;
  while (l > 0 && sm[l] > half) l--;
  while (r < n - 1 && sm[r] > half) r++;
  const xl = l < im ? x[l] + (half - sm[l])*(x[l+1] - x[l])/(sm[l+1] - sm[l]) : x[im];
  const xr = r > im ? x[r-1] + (sm[r-1] - half)*(x[r] - x[r-1])/(sm[r-1] - sm[r]) : x[im];
  const s = (x[n-1] - x[0])/(n - 1);
  let H = Math.sqrt(Math.max(0, (xr - xl)**2 - 16*LN2/3*s*s));
  const th = x[im]/2*D2R, L2 = model.lines && model.lines[1], s2 = L2 ? L2.lam/model.lines[0].lam*Math.sin(th) : 2;
  if (s2 < 1 && H > 0){
    // The doublet's width rises with its lines' (doubletFwhm): bisected for the reading.
    const D = 2*(Math.asin(s2) - th)*R2D;
    if (doubletFwhm(H, D, L2.w) > H){
      let lo = 0, hi = H;
      for (let it = 0; it < 40; it++){ const mid = (lo + hi)/2; if (doubletFwhm(mid, D, L2.w) > H) hi = mid; else lo = mid; }
      H = (lo + hi)/2;
    }
  }
  return { H: Math.max(H, 2*s), tt: x[im], height: sm[im] - bg };
}
// The FWHM of a Kα₁ + Kα₂ doublet of pseudo-Voigts, each of FWHM H with the starting
// profile's mixing (H_G = H_L), the second r times as high and D further up, read as
// widthEstimate reads one: from its top down to half its height on either side.
const ETA_START = tch(1, 1).eta;
function doubletFwhm(H, D, r){
  const pv = t => { const q = 4*t*t/(H*H); return ETA_START/(1 + q) + (1 - ETA_START)*Math.exp(-LN2*q); };
  const f = t => pv(t) + r*pv(t - D);
  // the top: on a grid over [0, D] (one line, or the two merged), then by golden section
  let xm = 0, fm = f(0);
  for (let k = 1; k <= 200; k++){ const t = D*k/200, v = f(t); if (v > fm){ fm = v; xm = t; } }
  let a = Math.max(0, xm - D/200), b = Math.min(D, xm + D/200);
  for (let k = 0; k < 40; k++){ const c = b - 0.618034*(b - a), d = a + 0.618034*(b - a); if (f(c) > f(d)) b = d; else a = c; }
  xm = (a + b)/2; fm = Math.max(fm, f(xm));
  // the half-height crossings: stepped out by H/50, then bisected in the last step
  const cross = dir => {
    let t = xm, dt = dir*H/50;
    while (f(t + dt) > fm/2) t += dt;
    let p = t, q = t + dt;
    for (let k = 0; k < 40; k++){ const m = (p + q)/2; if (f(m) > fm/2) p = m; else q = m; }
    return (p + q)/2;
  };
  return cross(1) - cross(-1);
}

// Reflections (α1) inside the pattern at the model's current values, of the phases there
// (scale > 0: a phase left out has its ticks too, but no lines in the fit) and with an
// intensity (F² of a special-position extinction is rounding, 10⁻¹⁰ of the strongest):
// n, and the distinct places their lines stand at (`positions`: reflections closer than
// the FWHM there make one line, as the cubic (300) and (221)), the widths' sampling.
function reflectionsInRange(model){
  const ticks = calc(model).ticks, Imax = Math.max(0, ...ticks.map(t=> t.I));
  const ts = ticks.filter(t=> t.I > 1e-10*Imax);
  let positions = 0;
  ts.forEach((t, i)=> { if (!i || t.tt - ts[i - 1].tt > t.H) positions++; });
  return { n: ts.length, positions };
}
/* U, V and the asymmetry are freed with X from this many line positions: the Gaussian
   width H_G² = U tan²θ + V tanθ + W is a quadratic in tanθ, which three angles determine.
   Held at 0 instead, the other terms and the zero take up what they model: on LaB6, Si
   and corundum standards cut to 3–7 positions, under four instrumental profiles, the
   instrument's FWHM came out 17–23 % off in range (30 % over 10–140°) and the zero
   0.02–0.45° off, χ²_ν 2–3; freed, 0.7–1 % in range (3–5 % over 10–140°) and the zero
   within 0.003°, χ²_ν 1.03. Below three both fail. (Up to v426: 8 reflections.) */
const UV_POSITIONS = 3;
/* The standard's zero scan runs over ±ZERO_RANGE degrees. It sees the zero and the
   standard's displacement together (2s·cosθ/R: 0.48° at low angles for a standard 1 mm off
   the focusing circle of a 240 mm goniometer, 0.57° at 200 mm), so it covers a zero of
   ±0.3° with that. Over ±0.3° (up to v426), LaB6, Si and corundum standards whose lines
   stood 0.37–0.68° off were not found, or found at a false minimum near the edge, in 20 of
   45 tests, the sharp ones all (χ²_ν 19–153 after); over ±1° all 90 were found, those
   within ±0.3° unchanged. The same on YAG, quartz, NaCl, LaB6 under Mo and a synchrotron-
   sharp Si (40 tests, zeros to ±0.8°). The standard's refinement takes 1.05–1.5× as long. */
const ZERO_RANGE = 1;

/* fitSettings(fit) → the fit's settings (opts.fit, the card's Refinement settings; every
   key optional) with the engine's own value for each one not given, the others clamped
   into their ranges (the page checks them too): maxIter (each refinement's iterations, 1–
   1000: refine's 40), shiftTol (converged when no shift is over this fraction of its esd,
   10⁻⁴–1: 0.01), lambda (λ to start each refinement from, 10⁻⁸–10³: 10⁻³), bgDegree (the
   Chebyshev terms T₀…Tₙ, 0–20: BG_DEGREE), bgInv (the 1/2θ term: true, false or 'auto',
   buildModel's rule), cellRange (0.005–0.2: CELL_RANGE), zeroRange (0.05–5°: ZERO_RANGE),
   shapeStarts (1–100: SHAPE_STARTS) and shapeFull (1–20: SHAPE_FULL). Integers are
   rounded. A number or a numeric string is read; anything else (null, a blank string,
   a boolean) is the default: +' ' and +true are numbers, 0 and 1, and had set the shift
   test to 10⁻⁴ or one iteration. With nothing given, or every key at its default, a
   refinement is the one before they were settings. */
function fitSettings(fit){
  const f = fit || {}, out = {};
  const keys = { maxIter: [40, 1, 1000, true], shiftTol: [0.01, 1e-4, 1], lambda: [1e-3, 1e-8, 1e3], bgDegree: [BG_DEGREE, 0, 20, true],
    cellRange: [CELL_RANGE, 0.005, 0.2], zeroRange: [ZERO_RANGE, 0.05, 5], shapeStarts: [SHAPE_STARTS, 1, 100, true], shapeFull: [SHAPE_FULL, 1, 20, true] };
  for (const k in keys){
    const [def, lo, hi, int] = keys[k], s = f[k], x = typeof s === 'number' || (typeof s === 'string' && s.trim()) ? +s : NaN;
    out[k] = Number.isNaN(x) ? def : Math.min(hi, Math.max(lo, int ? Math.round(x) : x));
  }
  out.bgInv = f.bgInv === true || f.bgInv === false ? f.bgInv : 'auto';
  return out;
}

/* ownEvidence(model, v, chi2) → per phase { under, alone, pts, alpha, esd, own }: what of
   a phase the pattern shows apart from the others. under: the share of its calculated
   intensity that lies under the other phases' (Σ min(y_p, y_others)/Σ y_p). alone: the
   share of its intensity in lines that stand clear of the other phases' — no line of
   theirs at least a tenth as high within 1.5 FWHM of either (Kα₂ included) — over its
   lines above 2 % of its strongest. alpha ± esd: its scale over the pts points of those
   lines alone (±1.5 FWHM), by a weighted fit of y − y_c + y_p = α·y_p + c₀ + c₁(2θ − 2θ̄)
   with a line of its own for each stretch: the line takes up what the background and the
   others' tails could (NaN when those points do not determine α). The esd is scaled by
   √χ². own: alone ≥ 5 % and α above 3 esd. A
   phase present gives α ≈ 1 there; one that is not has no such line, or α ≈ 0 at them.
   Clear of the others' lines, not ≥ 2/3 of the intensity (v419–v424): beside a broad
   phase's Lorentzian tails a minority phase rarely holds 2/3 even at its own peaks, and a
   5 wt % rutile at 36 esd (10 nm, beside 7 nm SrTiO3) was left out; an absent broad NaCl
   whose lines sit within 0.6° of SrTiO3's has none clear and still goes.
   The same structure twice (twins: two size populations of one phase, as a broad
   sample may need) is one phase here: neither is weighed against the other. */
const twins = (a, b) => a.constraint.kind === b.constraint.kind && a.atoms.length === b.atoms.length
  && Math.abs(a.mass - b.mass) <= 1e-3*a.mass && ['a','b','c'].every(l=> Math.abs(a.cell[l] - b.cell[l]) <= 0.02*a.cell[l]);
const CLEAR_FWHM = 1.5, CLEAR_HEIGHT = 0.1;
// A phase ownEvidence left out goes back when χ² without it is over OWN_KEEP times χ² with
// it and the rise over OWN_SHARE of its Σ w·y_p² (autoRefine, where the numbers are).
const OWN_KEEP = 2, OWN_SHARE = 0.25;
function ownEvidence(model, v, chi2){
  const st = evaluate(model, v), n = model.n, y = model.y, w = model.w, x = model.x;
  const yp = model.phases.map((q, k)=> st.pats[k].map(t=> t*v[q.iScale]));
  // Each phase's lines in range (the α₁ ticks, scaled): centre, FWHM, height, and the
  // reach of the line with its Kα₂.
  const lam1 = model.lines[0].lam, lam2 = model.lines.length > 1 ? model.lines[1].lam : null;
  const lines = model.phases.map((q, k)=>{
    const tk = [];
    phasePattern(model, v, k, new Float64Array(n), tk);
    return tk.map(t=>{
      const s2 = lam2 ? lam2/(2*t.d) : 2, d2 = s2 < 1 ? 2*(Math.asin(s2) - Math.asin(lam1/(2*t.d)))*R2D : 0;
      return { I: t.I, h: t.I/Math.max(t.H, 1e-6), lo: t.tt - CLEAR_FWHM*t.H, hi: t.tt + d2 + CLEAR_FWHM*t.H };
    });
  });
  return model.phases.map((q, k)=>{
    const P = yp[k], O = new Float64Array(n), rivals = [];
    yp.forEach((Q, j)=> { if (j !== k && !twins(q, model.phases[j])){ for (let i = 0; i < n; i++) O[i] += Q[i]; rivals.push(...lines[j]); } });
    let sp = 0, sm = 0;
    for (let i = 0; i < n; i++){ sp += P[i]; sm += Math.min(P[i], O[i]); }
    const under = sp > 0 ? sm/sp : 1;
    const mine = lines[k], Imax = Math.max(0, ...mine.map(L=> L.I)), mark = new Uint8Array(n);
    let sI = 0, sClear = 0;
    for (const L of mine){
      if (!(L.I > 0.02*Imax)) continue;
      sI += L.I;
      if (rivals.some(M=> M.h >= CLEAR_HEIGHT*L.h && M.hi > L.lo && M.lo < L.hi)) continue;
      sClear += L.I;
      for (let i = lowerBound(x, L.lo); i < n && x[i] <= L.hi; i++) mark[i] = 1;
    }
    const alone = sI > 0 ? sClear/sI : 0;
    // the stretches of marked points, each with its own line
    const runs = [];
    for (let i = 0; i < n; i++){
      if (!mark[i] || !(w[i] > 0)) continue;
      if (runs.length && runs[runs.length - 1].end === i - 1) runs[runs.length - 1].end = i, runs[runs.length - 1].idx.push(i);
      else runs.push({ end: i, idx: [i] });
    }
    const pts = runs.reduce((a, r)=> a + r.idx.length, 0);
    let alpha = NaN, esd = NaN;
    // Fitted whenever those points determine α (Cholesky keeps its pivot, untied): a
    // stretch of one or two points only takes its own line. (More than 10 points were
    // asked for up to v425, a limit no derivation gave: a 1.3 wt % rutile with 5.5 % of
    // its intensity clear, over 4 points, was then left out as having no clear line.)
    if (runs.length){
      const m = 1 + 2*runs.length, A = new Float64Array(m*m), b = new Float64Array(m);
      runs.forEach((r, ir)=>{
        const xm = r.idx.reduce((a, i)=> a + x[i], 0)/r.idx.length, c0 = 1 + 2*ir, c1 = c0 + 1;
        for (const i of r.idx){
          const f = [[0, P[i]], [c0, 1], [c1, x[i] - xm]], res = y[i] - st.yc[i] + P[i];
          for (const [a, fa] of f){ b[a] += w[i]*fa*res; for (const [c, fc] of f) A[a*m + c] += w[i]*fa*fc; }
        }
      });
      // correlation-scaled, as everywhere here
      const sc = Array.from({ length: m }, (_, a)=> A[a*m + a] > 0 ? 1/Math.sqrt(A[a*m + a]) : 0);
      const As = A.map((t, ij)=> t*sc[Math.floor(ij/m)]*sc[ij%m]), bs = b.map((t, a)=> t*sc[a]);
      const ch = cholesky(As, m);
      if (!ch.tied.some(t=> t.includes(0))){
        alpha = cholSolve(ch, bs, m)[0]*sc[0];
        esd = Math.sqrt(cholInverse(ch, m)[0]*Math.max(chi2, 1e-12))*sc[0];
      }
    }
    return { under, alone, pts, alpha, esd, own: alone >= 0.05 && alpha > 3*esd };
  });
}

/* autoRefine(model, opts) → the staged strategy, each stage a refine():
   1. sample: cell search (common factor on the lengths) with the linear scale and
      background; standard (opts.standard): its cell is fixed at the certified value, so
      a zero-shift scan takes this place.
   2. scales + background;
   3. + lattice + displacement (sample) | + zero + displacement (standard);
   4. + W, Y (with opts.irf: each phase's Ys instead);
   5. + X, and U, V and the asymmetry (S + H)/L when the reflections in range stand at
      ≥ UV_POSITIONS places (with irf: each phase's Xs instead);
   6. the phases' optional stages, each on top of what is free: the anisotropic strain
      (Stephens' S_j), the planar faults (FA), the size distribution (σ, LS), the
      displacement parameters (ΔB, B per site or Uⁱʲ per site: the phase's adp, or
      'overall' for all with opts.refineB, the v419–v423 card option), the site
      occupancies (the phase's occ), the texture.
   With opts.irf = { U, V, W, X, Y, asym?, zero?, lam1?, radius? } (the standard's refined
   profile, and its λ1 and radius), the instrument's U..Y and asymmetry are held at those
   values and each phase's broadening goes to its Xs, Ys, which add to X and Y (Lorentzian
   widths add under convolution): size and strain then come from the sample alone. The
   zero, when given, is the instrument's and is held too. Without irf the phases share one
   total profile (their Xs, Ys stay 0). An irf of another λ1 is not used, one of another
   radius is, with a warning.
   A phase not detected — its scale not above 3 esd, or significant only under another
   phase's peaks (see the stage loop) — is a candidate that is not in the sample: it is
   left out (scale 0, all of it held at the file's cell), since, freed, it would take
   whatever misfit is left (an absent rutile took 74 wt % of a SrTiO3 pattern as a broad
   hump at its cell bounds), and it is reported with detected: false, its size and
   strain NaN, its weight fraction 0. A phase the cell search found no minimum for keeps
   the cell it started that search from throughout: the file's, or for a phase found in
   the first round but not in the second, the first round's.
   Other options: fit (fitSettings: maxIter, shiftTol and lambda go to every refine() made
   here, the trials' and the free shape's too; cellRange, zeroRange, shapeStarts,
   shapeFull; bgInv true or false sets the 1/2θ term, bgDegree is buildModel's), and as
   before fit was: bgInv (default true when the pattern starts below 20°), range (cell
   search, default CELL_RANGE), maxIter, which fit's keys override; onProgress(frac,
   stageName); start, hold: from a previous result of this pattern instead of the CIF, the
   groups in hold held at it (fromLast below). A phase whose size is switched off (size:
   false) keeps Ys at 0, one whose strain is ('off') Xs (buildModel).
   Returns { params, esd, corr, cov, free, atBound, undetermined, tied, esdHeld (refine's),
   held (the names held at opts.start), stats, stages:[{name,
   Rwp, Rexp, chi2, Rp, cRwp, free, iterations (over its FCJ passes), passes, converged,
   ms}], cellSearch:{f, Rwp,
   curve, fine, steps, phases:[{id, f, found, Rwp, curve, fine, steps}]} (f, curve: the
   first phase's), sizeStrain, weightFractions (each with `detected`), detected: [ids],
   warnings: [string], textures (each {hkl, r, esd, spec}), models: {id: {profile, strain
   ('off', 'iso', 'aniso'), faults, adp, occ (the sites whose occupancy is refined, or null),
   size, shape (the solid asked for and searched)}}
   (what each phase was refined with: without the standard's profile, WPPM, the
   anisotropic strain, the faults and the shape are not), irf (the one used, or null), reflectionsInRange, linePositions
   (reflectionsInRange's n and positions after the widths stage), converged, fit (the
   settings used, defaults filled in, bgDegree the model's), ms }. */
function autoRefine(model, opts = {}){
  const t0 = Date.now(), stages = [], warnings = [];
  const F = fitSettings({ maxIter: opts.maxIter || undefined, cellRange: opts.range, bgInv: opts.bgInv == null ? undefined : !!opts.bgInv, ...opts.fit });
  // What every refinement here is given (the trials' and the free shape's too).
  const lm = { maxIter: F.maxIter, shiftTol: F.shiftTol, lambda: F.lambda };
  let irf = opts.irf || null;
  const std = !!opts.standard;
  // The standard's profile is in degrees at its own wavelength and on its goniometer:
  // from another anode it does not apply and is not used; from another radius it is, with
  // a note (a file without a radius reads 240 mm). The tolerances part one anode's
  // tabulated λ1 (Cu 1.540562–1.540598 Å: 2·10⁻⁵ apart) from the next anode's (over 10 %
  // apart), and one goniometer's radius as files give it from another's (200–320 mm).
  if (irf && Number.isFinite(irf.lam1) && Math.abs(irf.lam1/model.lines[0].lam - 1) > 1e-4){
    warnings.push(`The standard was measured at λ = ${irf.lam1} Å, this pattern at ${model.lines[0].lam} Å: its instrumental profile, in degrees at its own wavelength, does not apply here, and the pattern is refined without it (its widths include the instrument's).`);
    irf = null;
  } else if (irf && Number.isFinite(irf.radius) && Math.abs(irf.radius/model.radius - 1) > 1e-3)
    warnings.push(`The standard was measured on a goniometer of radius ${irf.radius} mm, this pattern on one of ${model.radius} mm: its instrumental profile and asymmetry, used here, may not be this instrument's, and the sizes and strains take up the difference.`);
  // With a free shape to refine, its trial refinements take most of the time: the
  // stages before it fill the first half of the progress.
  const progRaw = opts.onProgress || (()=>{});
  let share = irf && model.phases.some(q=> q.shapeType) ? 0.5 : 1;
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
  if (model.countScale) warnings.push(`The pattern is ${(1/model.countScale).toPrecision(2)}× less noisy than counts in its own units would be (a rate with no counting time, or averaged, rescaled or smoothed counts): the weights take one count as ${+model.countScale.toPrecision(2)} of the file's unit, as its noise says.`);
  if (!model.lineName) warnings.push(`λ = ${model.lines[0].lam.toFixed(5)} Å is not one of the lines the anomalous scattering factors are tabulated at (Cu, Co, Mo, Cr, Fe, Ag Kα₁ and Kα₂): f′ and f″ are taken as 0.`);
  if (needIrf.length) warnings.push(`${needIrf.join('; ')}: need the standard's instrumental profile (refine the standard first), else the instrument's broadening and the sample's are one and the same; refined without.`);
  model.phases.forEach(q=> (q.specWarn || []).forEach(t=> warnings.push(`${q.name || 'Phase ' + q.id}: ${t}.`)));
  const adpOf = q => q.adp !== 'cif' ? q.adp : opts.refineB ? 'overall' : 'cif';
  const optStages = [
    model.phases.some(q=> q.iS && !q.noIrf) && 'anisotropic strain',
    model.phases.some(q=> q.iFA != null && !q.noIrf) && 'planar faults',
    model.phases.some(q=> q.iLS != null && q.wppm) && 'size distribution',
    model.phases.some(q=> adpOf(q) !== 'cif') && 'displacement parameters',
    model.phases.some(q=> q.occSites && q.occSites.length) && 'site occupancy',
  ].filter(Boolean);
  const nStages = 5 + optStages.length;
  const lin = ['bg' + 0];
  for (let k = 1; k <= model.bgDegree; k++) lin.push('bg' + k);
  if (F.bgInv !== 'auto') model.useInv = bgInvOn(model.x0, F.bgInv);
  if (model.useInv) lin.push('bgInv'); else model.v[model.index.bgInv] = 0;
  const scales = model.phases.map(q=> q.pfx + 'scale');
  const lattice = std ? [] : model.phases.flatMap(q=> q.latNames.map(nm=> q.pfx + nm));
  const linIdx = [...scales, ...lin].map(nm=> model.index[nm]);
  // The zero's bounds (±2°) hold the scan's range with 1° to spare, and the standard's zero
  // that a sample takes: a zeroRange setting over 1° may place it beyond 2°.
  const zB = Math.max(F.zeroRange + 1, irf && Number.isFinite(irf.zero) ? Math.abs(irf.zero) : 0), pz = model.par[model.iZero];
  if (zB > pz.hi){ pz.lo = -zB; pz.hi = zB; }
  const v = model.v;

  // Starting profile.
  const est = widthEstimate(model), thE = est.tt/2*D2R;
  // The asymmetry: the standard's with irf (0 in an irf from before it was modelled);
  // without one, refined (the standard's, or a sample's own), from ASYM_START,
  // since at 0 it has no derivative. Whether stage 4 frees it, with U and V, is decided
  // after stage 3 from the line positions then in range; the count at the file's cell
  // here only chooses the starting value.
  const asym0 = Number.isFinite(opts.asym0) ? opts.asym0 : ASYM_START;
  /* The Soller model (sollerNodes) where the file gives both Sollers: its L, refined on the
     standard, held at the standard's on a sample, and at AX_START on a sample refined
     without one (the Sollers alone set most of the tail; freed with the profile there, on
     the user's 33A its broad lines took L to its 0.5 mm bound, χ²_ν unchanged). A sample
     whose standard was refined with FCJ (its file without Sollers, or a result from before
     v432) is drawn with that standard's A. */
  model.axialOff = !!(model.axial && irf && !Number.isFinite(irf.axL));
  const AS = model.axial && !model.axialOff ? 'axL' : 'asym';
  // (what the profile's refinement without a standard frees: A, or nothing of the Soller's)
  const asFree = AS === 'asym' || std ? [AS] : [];
  if (!model.axial && irf && Number.isFinite(irf.axL))
    warnings.push(`The standard's axial divergence was modelled through its Soller slits, which this pattern's file does not give: it is refined with no axial divergence.`);
  if (AS === 'axL' && irf && (Math.abs(irf.axP1/model.axial.p1 - 1) > 1e-3 || Math.abs(irf.axP2/model.axial.p2 - 1) > 1e-3))
    warnings.push(`The standard was measured with Soller slits of ${irf.axP1} and ${irf.axP2} rad, this pattern with ${model.axial.p1} and ${model.axial.p2} rad: the axial divergence is drawn with this pattern's, and the standard's sample and receiver lengths.`);
  v[model.iAsym] = AS !== 'asym' ? 0 : irf ? (Number.isFinite(irf.asym) ? irf.asym : 0) : reflectionsInRange(model).positions >= UV_POSITIONS ? asym0 : 0;
  if (AS === 'axL') v[model.iAx] = irf ? irf.axL : AX_START;
  // The sin 2θ shift: the standard's on a sample, as its zero (none from a standard refined
  // before v432); refined on the standard from 0.
  v[model.iTr] = irf && Number.isFinite(irf.transp) ? irf.transp : 0;
  if (irf){
    ['U','V','W','X','Y'].forEach(k=> { if (Number.isFinite(irf[k])) v[model.index[k]] = irf[k]; });
    if (Number.isFinite(irf.zero)) v[model.iZero] = irf.zero;
    /* The sample's width above the instrument's, all of it Lorentzian to start with: the
       Ys that gives the profile the estimate's width at θ_E (TCH, bisected; the width
       rises with Ys). Ys = (H_est − H_inst)·cosθ_E, up to v425, started it up to 7 %
       narrow: widths do not add linearly. With several phases each placed phase's own
       start is then scanned (widthSearch, after the cell search). */
    const Hof = ys => profileAtTheta(thE, irf.U || 0, irf.V || 0, irf.W || 0, irf.X || 0, (irf.Y || 0) + ys).H;
    let lo = 0, hi = est.H*Math.cos(thE);
    if (!(Hof(0) < est.H)) hi = 0;
    else for (let it = 0; it < 50; it++){ const mid = (lo + hi)/2; if (Hof(mid) > est.H) hi = mid; else lo = mid; }
    // (By WPPM the sphere's own profile is 1.23× as wide as the Lorentzian reading of Ys.)
    // (A phase whose size is switched off keeps Ys at 0 throughout.)
    model.phases.forEach(q=> { v[q.iYs] = q.sizeOff ? 0 : (lo + hi)/2/(q.wppm ? 1.23 : 1); v[q.iXs] = 0; });
  } else {
    const h = est.H/1.635;      // H_G = H_L = h gives H = 1.635 h under TCH
    v[model.index.U] = 0; v[model.index.V] = 0; v[model.index.X] = 0;
    v[model.index.W] = h*h; v[model.index.Y] = h*Math.cos(thE);
    model.phases.forEach(q=> { v[q.iYs] = 0; v[q.iXs] = 0; });
  }
  setParams(model, v);
  const stageStats = (name, r, extra) => {
    const st = evaluate(model, model.v), s = rStats(model, st.yc, st.bg, r ? r.free.length : linIdx.length);
    const row = { name, Rwp: s.Rwp, Rexp: s.Rexp, chi2: s.chi2, Rp: s.Rp, cRwp: s.cRwp, free: r ? r.free : [], iterations: r ? r.iterations : 0, passes: r ? r.passes || 1 : 0, converged: r ? r.converged : true, ms: Date.now() - tS, ...extra };
    stages.push(row);
    return row;
  };
  let tS = Date.now();
  const run = (k, name, free) => {
    tS = Date.now();
    prog(k/nStages, name);
    const r = refine(model, { free, ...lm, onProgress: (f)=> prog((k + Math.min(1, f))/nStages, name) });
    stageStats(name, r);
    return r;
  };
  const nm = k => model.phases[k].name || 'Phase ' + model.phases[k].id;
  const pfxOf = k => model.phases[k].pfx;
  // Optional stages whose every trial refinement threw (said in the warnings, and the
  // models report what was used instead).
  const lsFailed = new Set(), poFailed = new Set();
  /* The log-normal width of the phases ks: σ enters to second order (a distribution and
     its mirror in ln size differ only beyond), so from σ = 0 it has no derivative;
     refined from 0.3 and from 0.6, the lower χ² kept. → { res, free }: LS added to free
     for each phase refined (res as given when none was). */
  const sizeDistTrials = (ks, free, res) => {
    for (const k of ks){
      const q = model.phases[k], v0 = model.v.slice();
      let best = null;
      for (const s0 of [0.3, 0.6]){
        const vv = v0.slice(); vv[q.iLS] = s0; setParams(model, vv);
        let r; try { r = refine(model, { free: [...free, q.pfx + 'LS'], ...lm }); } catch(e){ continue; }
        if (!best || r.stats.chi2 < best.r.stats.chi2) best = { r, v: model.v.slice() };
      }
      if (best){ setParams(model, best.v); res = best.r; free = free.concat(q.pfx + 'LS'); lsFailed.delete(k); }
      else { setParams(model, v0); lsFailed.add(k); }
    }
    return { res, free };
  };
  /* A preferred orientation (March–Dollase) for the phases ks. For a cubic phase its r has
     no first-order effect at 1 (the members of a family weigh out evenly to first order),
     so it is refined from 0.8 and from 1.25 (plates and needles) and the lower χ² kept;
     for 'auto', on each axis textureCandidates gives (the low-index planes and those of
     the largest spacings) in turn. → { res, free }, as sizeDistTrials. */
  const textureTrials = (ks, free, res) => {
    for (const k of ks){
      const q = model.phases[k], v0 = model.v.slice(), cands = q.poSpec === 'auto' ? textureCandidates(model, k) : [q.poSpec];
      let best = null;
      for (const hkl of cands) for (const r0 of [0.8, 1.25]){
        q.poHkl = hkl;
        const vv = v0.slice(); vv[q.iPO] = r0; setParams(model, vv);
        let r; try { r = refine(model, { free: [...free, q.pfx + 'PO'], ...lm }); } catch(e){ continue; }
        if (!best || r.stats.chi2 < best.r.stats.chi2) best = { r, v: model.v.slice(), hkl };
      }
      if (best){ q.poHkl = best.hkl; setParams(model, best.v); res = best.r; free = free.concat(q.pfx + 'PO'); poFailed.delete(k); }
      // No trial refined (each threw): no texture, rather than an axis listed at r = 1.
      else { q.poHkl = null; setParams(model, v0); poFailed.add(k); }
    }
    return { res, free };
  };
  // What phase k is refined with: what `models` reports, and what a start from the last
  // result compares with the models there. (A log-normal whose σ could not be refined
  // was refined at σ = 0: a single size.) shape: the solid asked for and searched (with
  // the standard's profile), kept or not: a start from this result tells by it a solid
  // the data rejected from one not asked for, which the parameters (all 0) do not.
  const modelOf = (q, k) => ({ profile: q.wppm ? (q.iLS != null && !lsFailed.has(k) ? 'lognormal' : 'wppm') : 'lorentz',
    strain: q.strainOff ? 'off' : q.iS && !q.noIrf ? 'aniso' : 'iso', faults: q.faultSpec && !q.noIrf ? q.faultSpec.text : null, adp: adpOf(q), size: !q.sizeOff,
    occ: q.occSites && q.occSites.length ? q.occSites.map(s=> s.label) : null, shape: irf && q.shapeType || false });
  /* What both starts end with, the full refinement and the one from the last result: the
     warnings on what could not be refined and on overlapping phases, the free shape
     (searched for the phases that ask for one, but for those in `carried`, kept from
     opts.start), the sizes, strains, fractions and models, and the result. out: the
     phases left out; lastFree: the free list the shape search starts from; held: the
     names held at the last result (none in a full refinement); iso0: the carried
     shapes' isotropic fit; keptIso: the phases whose solid the last result rejected, held
     so (not searched again). */
  const finish = ({ res, out, lastFree, nIn, cs, carried = [], held = [], iso0 = null, keptIso = [] }) => {
    lsFailed.forEach(k=> { if (!out.has(k)) warnings.push(`${nm(k)}: the size distribution could not be refined (the refinements from σ = 0.3 and 0.6 both failed): a single size is reported (σ = 0).`); });
    poFailed.forEach(k=> { if (!out.has(k)){ const s = model.phases[k].poSpec; warnings.push(`${nm(k)}: the preferred orientation ${s === 'auto' ? 'on its trial axes' : '(' + hklText(s) + ')'} could not be refined (every trial failed): none is applied.`); } });
    const live = model.phases.map((_, k)=> k).filter(k=> !out.has(k));
    if (live.length > 1){
      const ev = ownEvidence(model, model.v, res.stats.chi2);
      if (live.every(k=> !ev[k].own)) warnings.push(`${live.map(nm).join(', ')}: their peaks overlap throughout, with no line of any one clear of the others': the pattern tells neither whether each is there nor their fractions (a candidate can take up the others' tails or the background: refine without it to compare).`);
      else live.forEach(k=> { if (ev[k].own && ev[k].alpha < 0.5) warnings.push(`${nm(k)}: where it is alone it shows ${Math.round(ev[k].alpha*100)} % of the intensity the fit gives it — its fraction rests mostly on peaks it shares.`); });
    }
    // The free shape of the phases that ask for it (p.shape), on top of everything else.
    const shapes = {};
    let isoParams = null;
    const shapeKs = model.phases.map((_, k)=> k).filter(k=> model.phases[k].shapeType && !out.has(k));
    if (shapeKs.length && !irf) warnings.push(`Free shape: needs the standard's instrumental profile (refine the standard first), else the shape's widths and the instrument's are one and the same; ${shapeKs.map(nm).join(', ')} refined with an isotropic size.`);
    else if (shapeKs.length){
      /* A shape carried from the last result keeps that search's record and isotropic fit
         (the peak widths are read with it, xrd-widths): no search, no new ΔBIC. Its
         isotropic fit's values first, this refinement's for the names it lacks, and for
         a phase searched here all of its own (its isotropic fit is this one). */
      const S0 = opts.start, searchKs = shapeKs.filter(k=> !carried.includes(k) && !keptIso.includes(k));
      isoParams = res.params;
      if (carried.length){
        isoParams = { ...res.params, ...iso0 };
        for (const k of searchKs) for (const n in res.params) if (n.startsWith(model.phases[k].pfx)) isoParams[n] = res.params[n];
      }
      for (const k of carried){
        const q = model.phases[k], info = S0.shapes[q.id];
        shapes[q.id] = { ...info, carried: true };
        const dBIC = (info.chi2 - info.chi2Iso)/Math.max(1, info.chi2redIso) + (info.P - info.Piso)*Math.log(info.N);
        const kept = held.some(n=> n.startsWith(q.pfx) && model.par[model.index[n]].kind === 'shape');
        warnings.push(`${nm(k)}: the free shape (${q.shapeType}) is the last result's, ${kept ? 'held at its values' : 'refined from there'} and not searched again${Number.isFinite(dBIC) ? `; its ΔBIC against the isotropic size, ${dBIC.toFixed(0)}, is that search's` : ''}.`);
      }
      for (const k of keptIso) warnings.push(`${nm(k)}: the free shape (${model.phases[k].shapeType}) was not supported by the data in the last result, which kept the isotropic size: held so (the shape ticked), not searched again.`);
      for (const k of searchKs){
        const j = searchKs.indexOf(k), part = (1 - share)/searchKs.length;
        progRaw(share + j*part, `free shape of ${nm(k)}`);
        const r = (opts.shapeHook || freeShape)(model, k, res, lastFree, { ...opts, fit: F, onShape: f=> progRaw(share + (j + f)*part, `free shape of ${nm(k)}`) });
        if (r && r.res){ res = r.res; shapes[model.phases[k].id] = r.info; lastFree = r.res.free; }
        else if (r && r.rejected) warnings.push(`${nm(k)}: the free shape (${model.phases[k].shapeType}) is not supported by the data (ΔBIC ${r.early ? 'about ' : ''}${r.dBIC >= 0 ? '+' : ''}${r.dBIC.toFixed(0)}${r.early ? ' from the trial shapes' : ''}, needs under −10): the isotropic size is kept.`);
        else warnings.push(`${nm(k)}: the free shape (${model.phases[k].shapeType}) could not be refined; the isotropic size is kept.`);
      }
      // No shape kept: nothing to compare the isotropic model with.
      if (!Object.keys(shapes).length) isoParams = null;
    }
    // The covariance the model holds is the last trial's (a texture's or a size
    // distribution's starts, the shape's trials): set back to the kept result's, which the
    // weight fractions' esds read.
    model.cov = { names: res.free, cov: res.cov }; model.esd = res.esd;
    progRaw(1, 'done');
    const detected = model.phases.map((_, k)=> !out.has(k));
    const phasesNow = model.phases.map((q, k)=> ({ id: q.id, name: q.name, cell: cellOf(model, model.v, k), mass: phaseMass(q, model.v) }));
    const scl = model.phases.map(q=> model.v[q.iScale]);
    const cov = model.cov && model.cov.cov ? scales.map(a=> scales.map(b=> {
      const ia = model.cov.names.indexOf(a), ib = model.cov.names.indexOf(b);
      return ia >= 0 && ib >= 0 ? model.cov.cov[ia][ib] : 0;
    })) : null;
    // A phase not detected has no size or strain to report (its widths are its start's).
    const ss = sizeStrain(model, irf, res).map((s, k)=> detected[k] ? { ...s, detected: true }
      : { ...s, D: NaN, Desd: NaN, strain: NaN, strainEsd: NaN, detected: false });
    const wf = weightFractions(phasesNow, scl, cov).map((w, k)=> ({ ...w, detected: detected[k] }));
    // A line whose axial-divergence tail is longer than FCJ_MAX_NODES draw smoothly, at the
    // result (lineNodes keeps the shortfall). The ripple of such a tail (over 1000 H long)
    // against a dense quadrature, by how many times too few nodes it has, is under the
    // profile's own 0.04 % up to 1.5, then up to FCJ_RIPPLE's (% of the peak, the largest of
    // six tails at 2θ 3–177°, A 0.058–0.15), linear between.
    model.fcjShort = 0;
    model.phases.forEach((q, k)=> { if (detected[k] && model.v[q.iScale]) phasePattern(model, model.v, k, new Float64Array(model.n)); });
    if (model.fcjShort > 1.5){
      const FCJ_RIPPLE = [[1.5, 0.04], [2, 0.15], [3, 0.8], [5, 2.7]], s = model.fcjShort;
      const j = FCJ_RIPPLE.findIndex(([r])=> r >= s), [r0, e0] = FCJ_RIPPLE[Math.max(0, j - 1)], [r1, e1] = FCJ_RIPPLE[j < 0 ? FCJ_RIPPLE.length - 1 : j];
      const e = j < 0 ? null : e0 + (e1 - e0)*(s - r0)/(r1 - r0 || 1);
      warnings.push(`Axial divergence: the tails of the sharpest lines (at the lowest or highest angles) would need ${s.toFixed(1)} times the ${FCJ_MAX_NODES} quadrature nodes used, so they ripple, by up to ${e == null ? 'over 3' : 'about ' + e.toPrecision(1)} % of the peak.`);
    }
    if (res.stats.N <= res.free.length)
      warnings.push(`The pattern has ${res.stats.N} points for ${res.free.length} refined parameters: with no more points than parameters nothing is determined (no esd). A refinement needs many more points than parameters.`);
    if (res.fcjBehind) warnings.push(`Axial divergence: after ${FCJ_PASSES} passes the last refinement still moved some lines' tails past the quadrature nodes counted for them; the result may be slightly off (refine again from it).`);
    return {
      params: res.params, esd: res.esd, corr: res.corr, cov: res.cov, free: res.free, atBound: res.atBound, undetermined: res.undetermined, tied: res.tied, esdHeld: res.esdHeld,
      held, stats: res.stats, stages, cellSearch: cs,
      sizeStrain: ss, weightFractions: wf, detected: model.phases.filter((_, k)=> detected[k]).map(q=> q.id), warnings,
      shapes, isoParams,
      // the preferred orientations: each phase's axis (the conventional cell's hkl), r, and
      // the option it was refined with ('auto' or that axis: whether a start from this
      // result has the same texture)
      textures: Object.fromEntries(model.phases.filter(q=> q.iPO != null && q.poHkl).map(q=> [q.id, { hkl: q.poHkl, r: res.params[q.pfx + 'PO'], esd: (res.esd || {})[q.pfx + 'PO'], spec: q.poSpec }])),
      // the models each phase was refined with (calc() needs them to draw the result again)
      models: Object.fromEntries(model.phases.map((q, k)=> [q.id, modelOf(q, k)])),
      // the standard's profile as used (null: none given, or not applicable)
      irf,
      reflectionsInRange: nIn && nIn.n, linePositions: nIn && nIn.positions, converged: res.converged, ms: Date.now() - t0,
      // the settings used (a model drawn again from the result needs its background terms)
      fit: { ...F, bgDegree: model.bgDegree },
    };
  };
  /* From the last result instead of the CIF (opts.start: a previous autoRefine's output;
     opts.hold: the groups held at it). A result refined with other phases is not one to
     start from: the CIF then, said in the warnings. */
  const S0 = opts.start && opts.start.params ? opts.start : null;
  // (a phase of the model missing there, or one of there missing here: removed since)
  if (S0 && (model.phases.some(q=> !Number.isFinite(S0.params[q.pfx + 'scale']) || q.iLat.some(i=> !Number.isFinite(S0.params[model.par[i].name])))
    || Object.keys(S0.params).some(n=> /^p[^.]*\.scale$/.test(n) && !(n in model.index))))
    warnings.push('The last result was refined with other phases: this pattern is refined from the CIF.');
  else if (S0) return fromLast(S0);
  /* The refinement from the last result. Each parameter belongs to a group, which
     opts.hold may hold: 'linear' (scales, background), 'cell' (lattice and displacement;
     the standard's zero and displacement), 'instrument' (U … Y and the asymmetry, where
     they are refined: no standard's profile), and per phase 'sizestrain' (Ys, Xs, S_j,
     σ), 'shape', 'faults', 'adp' (ΔB, B or Uⁱʲ per site), 'occ' (the refined site
     occupancies), 'texture' (r and its axis).
     A phase's group is unchanged when its option is the one the last result was refined
     with (start.models, start.textures, the solid its parameters name, or the one asked
     for there and rejected: start.models' shape). Values: the last result's, but for a
     changed group's parameters, which take their usual start (Ys and Xs carry over: Ys
     ×1.23 or ÷1.23 between the Lorentzian and WPPM readings, from the isotropic fit when
     a shape is dropped or changed; Xs raised to 0.02 for a new Stephens strain). Free:
     what a full refinement with these options would end with free, but for the held —
     group held and unchanged, and refined there (start.free, or start.held: held there
     at the one before). Then one refinement, and for what is new only, the trials of the
     log-normal σ and of the texture and the shape search (a solid the last result
     rejected, ticked, is not searched again). No cell search, zero scan or detection
     passes: the phases left out there stay out. */
  function fromLast(S0){
    const P0 = S0.params, hold = new Set(opts.hold || []);
    const has = n => Object.prototype.hasOwnProperty.call(P0, n) && Number.isFinite(P0[n]);
    const wasRef = Array.isArray(S0.free) ? new Set([...S0.free, ...(S0.held || [])]) : null, was = n => !wasRef || wasRef.has(n);
    const M0 = S0.models || {}, T0 = S0.textures || {}, SH0 = S0.shapes || {};
    // Out there, out here (a result without `detected`: scale 0 is out).
    const det = Array.isArray(S0.detected) ? new Set(S0.detected.map(String)) : null;
    const out = new Set(model.phases.map((_, k)=> k).filter(k=> det ? !det.has(String(model.phases[k].id)) : !(P0[pfxOf(k) + 'scale'] > 0)));
    const liveK = model.phases.map((_, k)=> k).filter(k=> !out.has(k));
    // A result with the standard's profile and one without differ in what Ys, Xs and the
    // profile mean (start.irf, when given, says which it was).
    const irfSame = !('irf' in S0) || !!S0.irf === !!irf;
    // Another refinement of the standard since, its profile changed: the sample's
    // broadening was fitted above another instrumental profile, and is refined from its
    // values rather than held. (Its zero moved: the cell, below.)
    const irfMoved = irfSame && !!irf && !!S0.irf && ['U', 'V', 'W', 'X', 'Y', 'asym', 'axL', 'transp'].some(k=> (+irf[k] || 0) !== (+S0.irf[k] || 0));
    const BROAD = ['sizestrain', 'shape', 'faults'];
    // The solid of the last result (shapeNamed).
    const shapeThen = q => shapeNamed(P0, q.pfx);
    const sameAxis = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === 3 && a.every((x, i)=> x === +b[i]);
    const chg = model.phases.map((q, k)=> {
      const m0 = M0[q.id] || null, m1 = modelOf(q, k), t0 = T0[q.id], sh0 = shapeThen(q), sh1 = irf && q.shapeType || false;
      const texSame = !!(t0 && t0.hkl) && (t0.spec == null ? q.poSpec === 'auto' || sameAxis(q.poSpec, t0.hkl) : t0.spec === 'auto' ? q.poSpec === 'auto' : sameAxis(q.poSpec, t0.spec));
      // The size profile there and here: WPPM's reading of a width is 1/1.23 of the
      // Lorentzian's (Ys, and a body's widths alike).
      const w0 = !!m0 && (m0.profile || 'lorentz') !== 'lorentz', w1 = m1.profile !== 'lorentz';
      /* A body's search under the other size profile (Lorentzian ↔ WPPM; the v420
         ellipsoid is drawn Lorentzian under WPPM too: phasePattern) is not this one's: its
         solid is searched again. Carried, its widths rescaled ÷1.23 as Ys and refined, a
         synthetic WPPM disc (30 × 8 nm) whose Lorentzian search had ended on a wrong solid
         (χ²_ν 4.05) stayed there (χ²_ν 2.61); searched again, χ²_ν 0.997 and the truth
         within 1 esd, in 26 s (from the CIF, the same in 41 s). */
      const sameRead = !q.iW || w0 === w1;
      // The solid asked for there too and rejected by its ΔBIC (no width in use): the same
      // option, its values the isotropic size's. (A result without models' shape: v428's.)
      const rej0 = !!sh1 && !sh0 && !!m0 && m0.shape === sh1 && sameRead;
      // A solid in use there is carried with that search's record and isotropic fit (the
      // widths' isotropic model): a result without them (v428's) has it searched again.
      const rec = !!(SH0[q.id] && Number.isFinite(SH0[q.id].chi2) && S0.isoParams);
      return { m0, m1, sh0, sh1, rej0, w0, w1,
        sizestrain: !m0 || !irfSame || (m0.size !== false) !== m1.size || (m0.strain || 'iso') !== m1.strain || (m0.profile || 'lorentz') !== m1.profile,
        shape: rej0 ? false : sh0 !== sh1 || (!!sh1 && !(rec && sameRead)), faults: !m0 || (m0.faults || null) !== m1.faults, adp: !m0 || (m0.adp || 'cif') !== m1.adp,
        occ: !m0 || occText(m0.occ) !== occText(m1.occ),
        texture: q.iPO == null ? !!t0 : !texSame };
    });
    const groupOf = i => { const p = model.par[i];
      return p.linear ? 'linear' : p.kind === 'lattice' || p.name === 'zero' || p.name === 'disp' || p.name === 'transp' ? 'cell' : p.group === 'profile' ? 'instrument'
        : KIND_GROUP[p.kind] || null; };
    /* The background's terms there and here (the degree and the 1/2θ term, fit settings):
       held across a change, the terms left had been fitted beside the others (degree 12
       → 6 on 33A, 'linear' held: χ²_ν 135, the background up to 424 counts off), so the
       scales and background are refined then. Read from the parameters there: its highest
       Chebyshev term, and the 1/2θ term refined (or, without free, not 0). */
    let deg0 = -1; while (has('bg' + (deg0 + 1))) deg0++;
    const inv0 = wasRef ? wasRef.has('bgInv') : !!P0.bgInv;
    const bgChanged = deg0 !== model.bgDegree || inv0 !== !!model.useInv;
    const changed = i => { const p = model.par[i], g = groupOf(i); return g === 'linear' ? bgChanged : g === 'instrument' ? !irfSame : p.phase >= 0 && !!chg[p.phase][g]; };

    // Values: the usual starts are in model.v (buildModel's, and the starting profile's).
    const vv = model.v.slice(), take = n => { if (has(n)) vv[model.index[n]] = P0[n]; };
    [...lin, 'disp'].forEach(take);
    // A sample's zero is the standard's (set above), or the file's: held, as the last
    // result's when that was too (no standard's profile then and now).
    if (std || (!irf && irfSame)) take('zero');
    if (std) take('transp');
    if (!irf && irfSame) ['U', 'V', 'W', 'X', 'Y', ...asFree].forEach(take);
    model.phases.forEach((q, k)=> {
      const c = chg[k], pf = q.pfx;
      if (out.has(k)){ model.par.forEach((p, i)=> { if (p.phase === k) take(p.name); }); vv[q.iScale] = 0; return; }
      take(pf + 'scale'); q.iLat.forEach(i=> take(model.par[i].name));
      // Size and strain: with the standard's profile only (without, they stay 0: the
      // profile is the whole width).
      if (irf && irfSame){
        const { m0, m1, w0, w1 } = c;
        const ys0 = c.sh0 && c.shape ? (S0.isoParams || {})[pf + 'Ys'] : P0[pf + 'Ys'];
        if (m0 && m0.size !== false && !q.sizeOff && Number.isFinite(ys0)) vv[q.iYs] = w0 === w1 ? ys0 : w1 ? ys0/1.23 : ys0*1.23;
        if (m0 && m0.strain !== 'off' && !q.strainOff) take(pf + 'Xs');
        if (q.iS && m1.strain === 'aniso'){
          if (m0 && m0.strain === 'aniso') q.iS.forEach(i=> take(model.par[i].name));
          else if (vv[q.iXs] < 0.02) vv[q.iXs] = 0.02;
        }
        if (q.iLS != null && m1.profile === 'lognormal' && m0 && m0.profile === 'lognormal') take(pf + 'LS');
      }
      // The other groups: the last values when unchanged (a solid's reference orientation
      // with them), else their usual start.
      model.par.forEach((p, i)=> { const g = groupOf(i); if (p.phase === k && (g === 'shape' || g === 'faults' || g === 'adp' || g === 'occ' || g === 'texture') && !c[g]) take(p.name); });
      if (q.iPO != null && !c.texture) q.poHkl = T0[q.id].hkl.map(Number);
    });
    setParams(model, vv);
    const nIn = reflectionsInRange(model), uvFree = !irf && nIn.positions >= UV_POSITIONS;
    // A sample's zero not the one its cell and displacement were fitted at (the standard
    // refined again, or its profile added or removed since): those are refined, not held.
    const zeroMoved = !std && has('zero') && P0.zero !== model.v[model.iZero];
    /* The last result drawn with another model of the axial divergence (FCJ's A there, the
       Soller model's L here, or the reverse), or a standard's without the sin 2θ shift
       (both v432's): its profile, zero, displacement and cell were fitted to lines drawn
       otherwise, and are refined from its values rather than held. Held, the user's LaB6
       refined from its v431 result kept χ²_ν 3.79 where from the CIF it reaches 2.17 (the
       shift took −0.003° instead of −0.017°, the zero and displacement held at FCJ's). */
    const axChanged = has('axL') !== (AS === 'axL') || (std && !has('transp'));

    // Free: a full refinement's final list, in its order. The free shapes: carried from
    // the last result, kept isotropic (rejected there, the shape ticked), or searched.
    const keptIso = liveK.filter(k=> chg[k].rej0 && hold.has('shape') && !irfMoved);
    const carried = liveK.filter(k=> chg[k].sh1 && !chg[k].shape && !chg[k].rej0), search = liveK.filter(k=> chg[k].sh1 && !carried.includes(k) && !keptIso.includes(k));
    const F = [...liveK.map(k=> scales[k]), ...lin];
    // (a lattice the last result did not refine: its cell search found no minimum there)
    if (std) F.push('zero', 'disp', 'transp');
    else { liveK.forEach(k=> model.phases[k].iLat.forEach(i=> { if (was(model.par[i].name)) F.push(model.par[i].name); })); F.push('disp'); }
    if (irf) liveK.forEach(k=> { if (!model.phases[k].sizeOff && !carried.includes(k)) F.push(pfxOf(k) + 'Ys'); }); else F.push('W', 'Y');
    if (irf) liveK.forEach(k=> { if (!model.phases[k].strainOff) F.push(pfxOf(k) + 'Xs'); }); else F.push(...(uvFree ? ['X', 'U', 'V', ...asFree] : ['X']));
    liveK.forEach(k=> { const q = model.phases[k]; if (q.iS && !q.noIrf) F.push(...q.iS.map(i=> model.par[i].name)); });
    liveK.forEach(k=> { const q = model.phases[k]; if (q.iFA != null && !q.noIrf) F.push(q.pfx + 'FA'); });
    liveK.forEach(k=> { const q = model.phases[k]; if (q.iLS != null && q.wppm) F.push(q.pfx + 'LS'); });
    liveK.forEach(k=> { const q = model.phases[k], a = adpOf(q);
      F.push(...(a === 'overall' ? [q.pfx + 'B'] : a === 'site' ? q.sites.map(st=> model.par[st.iB].name) : a === 'aniso' ? q.sites.flatMap(st=> st.iU.map(i=> model.par[i].name)) : [])); });
    liveK.forEach(k=> { F.push(...(model.phases[k].occSites || []).map(s=> model.par[s.iOcc].name)); });
    liveK.forEach(k=> { const q = model.phases[k]; if (q.iPO != null) F.push(q.pfx + 'PO'); });
    // A carried solid: its widths and the turns its search refined (none for a body held
    // on the lattice; never the reference orientation).
    carried.forEach(k=> { const q = model.phases[k], info = (S0.shapes || {})[q.id];
      (q.iL || [...q.iW, ...(info && info.held && !wasRef ? [] : q.iR)]).forEach(i=> { if (was(model.par[i].name)) F.push(model.par[i].name); }); });
    const held = F.filter(n=> { const i = model.index[n], p = model.par[i], g = groupOf(i);
      // (not a parameter the last result did not have: a new one, as a background term
      // added; Ys where the solid changed or is searched: a solid's 0 there is no isotropic
      // size to hold, and a search replaces it — freeShape sets it to 0)
      return hold.has(g) && !changed(i) && was(n) && has(n) && !(p.phase >= 0 && i === model.phases[p.phase].iYs && (chg[p.phase].shape || search.includes(p.phase)))
        && !(irfMoved && BROAD.includes(g)) && !(zeroMoved && g === 'cell') && !(axChanged && (g === 'instrument' || g === 'cell')); });
    // What is new: σ and the texture by their trials, after the refinement.
    const lsNew = liveK.filter(k=> { const q = model.phases[k], m0 = chg[k].m0; return q.iLS != null && q.wppm && !(m0 && m0.profile === 'lognormal' && irfSame); });
    const poNew = liveK.filter(k=> model.phases[k].iPO != null && chg[k].texture);
    const trial = new Set([...lsNew.map(k=> pfxOf(k) + 'LS'), ...poNew.map(k=> pfxOf(k) + 'PO')]);
    let free = F.filter(n=> !held.includes(n) && !trial.has(n));
    // The asymmetry freed from a typical value (at 0 it has no derivative), as stage 4 does.
    if (free.includes('asym') && !(model.v[model.iAsym] > 0)){ const v1 = model.v.slice(); v1[model.iAsym] = asym0; setParams(model, v1); }

    share = search.length ? 0.5 : 1;
    const nT = 1 + (lsNew.length ? 1 : 0) + (poNew.length ? 1 : 0);
    tS = Date.now();
    prog(0, 'from the last result');
    const linFree = free.filter(n=> model.par[model.index[n]].linear).map(n=> model.index[n]);
    if (linFree.length){ const v1 = model.v.slice(); solveLinear(model, v1, evaluate(model, v1), linFree); setParams(model, v1); }
    stageStats('linear start', null);
    tS = Date.now();
    let res = refine(model, { free, ...lm, onProgress: f=> prog(Math.min(1, f)/nT, 'from the last result') });
    // (everything held: nothing to converge, and nothing that failed to)
    if (!free.length) res = { ...res, converged: true };
    stageStats('from the last result', res);
    let kT = 1;
    if (lsNew.length){ tS = Date.now(); prog(kT++/nT, 'size distribution'); ({ res, free } = sizeDistTrials(lsNew, free, res)); stageStats('size distribution', res); }
    if (poNew.length){ tS = Date.now(); prog(kT++/nT, 'preferred orientation'); ({ res, free } = textureTrials(poNew, free, res)); stageStats('preferred orientation', res); }

    // What was held, refined from the last values, and new.
    out.forEach(k=> warnings.push(`${nm(k)}: not detected in the last result, so left out here too (scale 0); a refinement from the CIF tests it again.`));
    /* New faults beside a held size and strain take only the broadening those left: the
       size had taken the faults' share in the last result. On synthetic Pt (D 40 nm,
       α 0.03 on {111}) the faults came out at 0.0055(2), χ²_ν 5.1, with the size and
       strain held; refined with them, 0.0297(2), χ²_ν 0.99. */
    liveK.forEach(k=> { const q = model.phases[k];
      if (q.iFA != null && !q.noIrf && chg[k].faults && held.some(n=> n.startsWith(q.pfx) && ['sizestrain', 'shape'].includes(groupOf(model.index[n]))))
        warnings.push(`${nm(k)}: the planar faults are new, and refined with the size and strain${held.some(n=> n.startsWith(q.pfx) && groupOf(model.index[n]) === 'shape') ? ' and the shape' : ''} held: they take only the broadening those left, which took the faults' share before. Refined together (not held), the faults get their own.`); });
    /* The occupancies changed (switched on, off or to another site) beside displacements
       held: those were fitted beside the other occupancies, and both scale the sites'
       scattering. On 33A (SrTiO3, the Sr site at 0.69) a ΔB held at its 0.63 Å² and the
       occupancy switched off left χ²_ν at 1.73, where refined together they give 1.70. */
    liveK.forEach(k=> { const q = model.phases[k];
      if (chg[k].occ && chg[k].m0 && held.some(n=> n.startsWith(q.pfx) && groupOf(model.index[n]) === 'adp'))
        warnings.push(`${nm(k)}: the site occupancies changed since, and the displacement parameters are held at values fitted beside the former ones: both scale the sites' scattering. Refined together (not held), each takes its own share.`); });
    const LABEL = { linear: 'scales and background', cell: std ? 'zero and displacement' : 'cell and displacement', instrument: 'instrumental profile', size: 'size', strain: 'strain',
      shape: 'free shape', faults: 'planar faults', adp: 'displacement parameters', occ: 'site occupancy', texture: 'preferred orientation' };
    // (the size and the strain apart: a new solid frees Y_s and leaves X_s held)
    const labelOf = i => { const g = groupOf(i), p = model.par[i]; return g !== 'sizestrain' ? g : p.kind === 'strain' || i === model.phases[p.phase].iXs ? 'strain' : 'size'; };
    const lists = { held: new Map(), kept: new Map(), fresh: new Map() };
    const note = (which, g, k) => { const m = lists[which]; if (!m.has(g)) m.set(g, new Set()); if (k >= 0 && g !== 'linear' && g !== 'cell') m.get(g).add(nm(k)); };
    held.forEach(n=> { const i = model.index[n]; note('held', labelOf(i), model.par[i].phase); });
    res.free.forEach(n=> { const i = model.index[n]; note(changed(i) || trial.has(n) || !was(n) || !has(n) ? 'fresh' : 'kept', labelOf(i), model.par[i].phase); });
    search.forEach(k=> note('fresh', 'shape', k));
    const axNote = axChanged && (hold.has('instrument') || hold.has('cell')) && `The last result was refined with ${has('axL') ? 'the Soller model of the axial divergence' : 'FCJ\u2019s axial divergence'}${std && !has('transp') ? ' and without the sin 2θ shift' : ''} (before v432, or another standard), this one with ${AS === 'axL' ? 'the Soller model' : 'FCJ\u2019s'}: the profile, zero, displacement and cell, fitted to lines drawn otherwise, are refined from its values rather than held.`;
    const zeroNote = zeroMoved && hold.has('cell') && `The zero is not the one the last result was refined at (the standard refined again, or its profile added or removed: ${P0.zero.toFixed(4)}° then, ${model.v[model.iZero].toFixed(4)}° now): the cell and displacement, fitted at that zero, are refined rather than held.`;
    const say = m => {
      const same = m.has('size') && m.has('strain') && [...m.get('size')].join() === [...m.get('strain')].join();
      return Object.keys(LABEL).filter(g=> m.has(g) && !(same && g === 'strain')).map(g=> (same && g === 'size' ? 'size and strain' : LABEL[g]) + (m.get(g).size ? ' of ' + [...m.get(g)].join(' and ') : '')).join('; ');
    };
    warnings.push(['Refined from the last result.', irfMoved && BROAD.some(g=> hold.has(g)) && 'The standard has been refined again since: the size, strain, shape and faults, fitted above its former profile, are refined rather than held.', axNote, zeroNote, lists.held.size && `Held at its values: ${say(lists.held)} (with no esds here: they are that refinement's; what is refined here is conditional on them, and a last refinement with nothing held gives values and esds free of that).`,
      lists.kept.size && `Refined from its values: ${say(lists.kept)}.`, lists.fresh.size && `New or changed since, refined from their usual start: ${say(lists.fresh)}.`].filter(Boolean).join(' '));
    return finish({ res, out, lastFree: free, nIn, cs: null, carried, held, iso0: carried.length ? S0.isoParams : null, keptIso });
  }

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
    // Over ±cellRange (a setting), within the lattice bounds the model was built with
    // (buildModel's cellRange: twice it, LAT_RANGE at least).
    const latR = model.latRange || LAT_RANGE, range = Math.min(F.cellRange, latR), per = [];
    if (F.cellRange > latR) warnings.push(`The cell search covers ±${+(latR*100).toFixed(1)} %, not the ±${+(F.cellRange*100).toFixed(1)} % set: the model's lattice bounds stop there (it was built for a narrower range).`);
    const rounds = model.phases.length > 1 ? 2 : 1;
    for (let r = 0; r < rounds; r++) model.phases.forEach((q, k)=> {
      if (r && !(per[k] && per[k].found)) return;
      const c = cellSearch(model, { index: k, range });
      if (c) per[k] = { id: q.id, found: c.found, Rwp: c.Rwp, curve: c.curve, fine: c.fine, steps: (per[k] ? per[k].steps : 0) + c.steps, round: r };
    });
    // A single phase not found: no other phase to be confused with, so the search may go
    // wider at no risk (its file cell may be a few % off: a doped or computed cell).
    let wide = range;
    if (model.phases.length === 1 && per[0] && !per[0].found && Math.min(2*range, latR) > range){
      wide = Math.min(2*range, latR);
      const c = cellSearch(model, { index: 0, range: wide });
      per[0] = { ...per[0], found: c.found, Rwp: c.Rwp, curve: c.curve, fine: c.fine, steps: per[0].steps + c.steps };
    }
    per.forEach((p, k)=> { if (!p) return; const q = model.phases[k], i = q.iLat.findIndex(j=> /\.(a|b|c)$/.test(model.par[j].name)); p.f = model.v[q.iLat[i]]/len0[k][i]; });
    // Not found in the second round, the cell stays where the first put it, not the file's.
    per.forEach((p, k)=> { if (p && !p.found){
      notFound.add(k);
      const pct = x => +(x*100).toFixed(1), off = pct(p.f - 1), name = model.phases[k].name || 'Phase ' + p.id;
      warnings.push(p.round ? `${name}: the cell search's second round (the other phases placed) found no minimum within ±${pct(range)} % of the cell its first round found (${off < 0 ? '−' : '+'}${Math.abs(off)} % from the file's), which is kept.`
        : `${name}: the cell search found no minimum within ±${pct(model.phases.length === 1 ? wide : range)} % of the file's cell, which is kept.`);
    } });
    /* Then each placed phase's own starting width (widthSearch): the estimate is one
       peak's, so one phase's. A sharp perovskite at 5 wt % beside 8 nm SrTiO3, started at
       SrTiO3's width, came out of the widths stage at scale 0 in 9 of 24 runs (v425; 16
       with a start 1 % wider), and was left out. A phase not placed keeps the start. */
    if (irf && model.phases.length > 1) per.forEach((p, k)=> { if (p && p.found && !model.phases[k].sizeOff){ const w = widthSearch(model, k, irf, thE); p.Ys = w.ys; p.YsFound = w.found; } });
    const first = per.find(p=> p);
    const st = evaluate(model, model.v), Rwp = rStats(model, st.yc, st.bg).Rwp;
    cs = first ? { f: first.f, Rwp, curve: first.curve, fine: first.fine, steps: first.steps, phases: per.filter(p=> p) } : null;
    stageStats('cell search', null, { f: cs ? cs.f : 1 });
  } else if (std){
    // ±zeroRange (a setting, ZERO_RANGE by default) in steps of at most H/4, both ends on
    // the grid (stepping from −0.3 by H/4 had stopped at +0.2° for H = 0.5°), and a step
    // beyond each (beyond).
    const ZR = F.zeroRange, H = Math.max(est.H, 0.02), zs = beyond(grid(-ZR, ZR, 2*Math.ceil(ZR/(H/4)) + 1));
    // The same rule as the cell search: a minimum on the edge of the range (or none) leaves
    // the zero where it was.
    const z0 = model.v[model.iZero];
    // Peaks at their FCJ centroids, as in the cell search.
    const prevC = model.fcjCentroid; model.fcjCentroid = true;
    let sc;
    try { sc = scan(model, (vv, z)=> { vv[model.iZero] = z; }, zs); } finally { model.fcjCentroid = prevC; }
    const kmin = bestIndex(sc.curve, z0);
    let found = kmin >= 0 && !edgeOrFlat(sc.curve, kmin), z = found ? parabolicMin(sc.curve, kmin) : z0;
    if (found && Math.abs(z) > ZR*(1 + 1e-9)){ found = false; z = z0; }
    const vv = model.v.slice(); vv[model.iZero] = z;
    if (!found) warnings.push(`The zero-shift scan found no minimum within ±${ZR}°: the zero is left at its start.`);
    solveLinear(model, vv, evaluate(model, vv), linIdx);
    setParams(model, vv);
    stageStats('zero search', null, { zero: z, found });
  } else {
    const vv = model.v.slice(); solveLinear(model, vv, evaluate(model, vv), linIdx); setParams(model, vv);
    stageStats('linear start', null);
  }
  // Detected: a scale above 3 esd (zScale: scale/esd). A scale tied to another (the same
  // pattern twice: two copies of a CIF at one cell and width) is judged with that one
  // held, the pair as one: the first listed carries it.
  const zScale = r => model.phases.map(q=> {
    const nm = q.pfx + 'scale', e = Number.isFinite(r.esd[nm]) ? r.esd[nm] : (r.esdHeld || {})[nm];
    return r.params[nm] > 0 ? r.params[nm]/e : 0;
  });
  // A phase the cell search placed nowhere keeps the cell it had there (the file's, or the
  // first round's), as the warning says: freed, its lattice walks to wherever a misfit
  // pulls it (an absent LaB6 went 5.7 % off its cell to sit under SrTiO3's peaks).
  const latHeld = name => [...notFound].some(k=> name.startsWith(pfxOf(k)));
  /* A phase not detected is left out: its scale 0, everything of it held, its cell the
     file's (for its ticks). With its scale left free it still took what misfit its
     peaks could reach — an absent LaB6, held at its cell with the starting widths, came
     out at 2.9 esd yet 35(8) wt % — and bent the others' results. Not detected:
     - its scale not above 3 esd after the scales and background (stage 1): out at once;
     - not above 3 esd at the end: the least significant of those out, and the stages run
       again without it (and with it once more, when that cost χ² beyond a BIC: keptBIC);
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
  // What makes a significant phase implausible as a crystalline phase (null: nothing).
  const implausible = k => {
    const q = model.phases[k], v = model.v, at = (i, side) => side > 0 ? v[i] >= model.par[i].hi*(1 - 1e-9) : v[i] <= model.par[i].lo*(1 + 1e-9);
    if (q.iLat.some(i=> /\.(a|b|c)$/.test(model.par[i].name) && (at(i, 1) || at(i, -1)))) return `its cell runs to the ±${+((model.latRange || LAT_RANGE)*100).toFixed(1)} % bound`;
    if (!irf) return null;
    if (at(q.iYs, 1) || at(q.iXs, 1)) return `its ${at(q.iYs, 1) ? 'size' : 'strain'} broadening runs to its bound: it takes up a broad hump or the background`;
    const ys = v[q.iYs], c = cellOf(model, v, k), edge = Math.max(c.a, c.b, c.c);
    const D = ys > 0 ? K_SCHERRER*model.lines[0].lam/(ys*D2R) : Infinity;
    return D < Math.max(10, 2*edge) ? `its crystallites come out ${(D/10).toFixed(1)} nm across, under two cells: it takes up a broad hump or the background` : null;
  };
  /* The 3-esd test is weak where a phase's scale correlates with its widths (very broad
     lines) or with another phase's (two populations of one phase): the scale's esd is
     large. A phase the last test leaves out is judged again by what leaving it out cost,
     from the stages run again without it (weakOut): the rise of χ² (over χ²_ν, as the
     shape's ΔBIC) against its dP parameters. Above dP·ln N + 10 (ΔBIC under −10, as the
     shape's test) it is put back, its 3-esd tests waived (keptBIC); below, it stays out
     and the warning gives the rise. Not a bar at what noise gives (dP + 3√(2dP)): the
     search placed its cell and width where they gain most, so an absent phase gains more
     than χ²(dP). 2 nm rutile at 8 wt % beside 80 nm SrTiO3 (lines 9 counts high and 4°
     wide on 150) stood at 1.9–2.9 esd while leaving it out raised χ² by 24–48 for its 5
     parameters: more than noise gives, short of the BIC's 53. */
  const chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
  // (2.99 esd reads 2.9, not 3.0: "not above 3")
  const weakWhy = (z, after) => `its scale is not above 3 esd${after ? ' once the cells and widths are refined' : ''}${z > 0 ? ` (${(Math.floor(z*10)/10).toFixed(1)} esd)` : ''}`;
  let res, nIn, lastFree = [], weakOut = null, ownOut = null;
  const keptBIC = new Map(), keptOwn = new Map();
  for (;;){
    let free = [...scales.filter((_, k)=> !out.has(k)), ...lin];
    res = run(1, 'scales and background', free);
    const z1 = zScale(res), vv = model.v.slice();
    model.phases.forEach((_, k)=> { if (!out.has(k) && !keptBIC.has(k) && !(z1[k] > 3)) leaveOut(k, weakWhy(z1[k], false), vv); });
    setParams(model, vv);
    free = free.filter(name=> !out.has(scales.indexOf(name)));
    const keep = list => list.filter(name=> !model.phases.some((_, k)=> out.has(k) && name.startsWith(pfxOf(k))));
    free = free.concat(std ? ['zero', 'disp', 'transp'] : [...keep(lattice).filter(name=> !latHeld(name)), 'disp']);
    res = run(2, std ? 'zero and displacement' : 'lattice and displacement', free);
    free = free.concat(irf ? keep(model.phases.filter(q=> !q.sizeOff).map(q=> q.pfx + 'Ys')) : ['W', 'Y']);
    res = run(3, 'widths', free);
    nIn = reflectionsInRange(model);
    /* Without the standard's profile the whole profile is refined, on a sample as on the
       standard (a sample's is then the instrument's and its own in one; up to v426 its U,
       V and asymmetry were held at 0 unless opts.instrumentalProfileFree). Held, the
       asymmetry went into the cell and the displacement, U and V into the rest of the
       profile: on SrTiO3, corundum, ZnO and a monoclinic cell of 8–200 nm under three
       instrumental profiles (A = 0.02–0.08) the cell came out 0.2–10·10⁻⁴ off at 2–45
       esd, χ²_ν up to 2.0 (the truth's 1.04); refined, 0.01–0.9·10⁻⁴, within 2.2 esd,
       χ²_ν 1.04, for an esd 0.8–2.3× as large and about twice the time. */
    const uvFree = !irf && nIn.positions >= UV_POSITIONS;
    // Freed from a typical value (at 0 it has no derivative); held, none.
    if (!irf && AS === 'asym' && (uvFree ? !(model.v[model.iAsym] > 0) : model.v[model.iAsym] !== 0)){ const vv = model.v.slice(); vv[model.iAsym] = uvFree ? asym0 : 0; setParams(model, vv); }
    free = free.concat(irf ? keep(model.phases.filter(q=> !q.strainOff).map(q=> q.pfx + 'Xs')) : uvFree ? ['X', 'U', 'V', ...asFree] : ['X']);
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
      tS = Date.now();
      prog(kSt/nStages, 'size distribution');
      ({ res, free } = sizeDistTrials(model.phases.map((_, k)=> k).filter(k=> model.phases[k].iLS != null && model.phases[k].wppm && live0(k)), free, res));
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
    // The occupancies after the displacements, beside them: both scale a site's
    // scattering, the one alike at every angle, the other more at high angle.
    if (optStages.includes('site occupancy')){
      free = free.concat(keep(model.phases.flatMap(q=> (q.occSites || []).map(s=> model.par[s.iOcc].name))));
      res = run(kSt++, 'site occupancy', free);
    }
    // A preferred orientation (March–Dollase), for the phases that ask for one.
    const poKs = model.phases.map((_, k)=> k).filter(k=> model.phases[k].iPO != null && !out.has(k));
    if (poKs.length){
      tS = Date.now();
      prog(Math.min(nStages - 0.5, kSt)/nStages, 'preferred orientation');
      ({ res, free } = textureTrials(poKs, free, res));
      stageStats('preferred orientation', res);
    }
    lastFree = free;
    // What the phase the 3-esd test left out in the last pass was worth: χ² without it, with
    // nothing else left out since, against χ² with it (scaled by that fit's χ²_ν, as the
    // shape's ΔBIC), for its dP parameters. Fitting noise gives χ²(dP): dP ± √(2dP).
    if (weakOut){
      const w = weakOut; weakOut = null;
      const dchi = (chiTot(res) - w.chi)/Math.max(1, w.chi2), dP = w.P - res.stats.P, need = dP*Math.log(res.stats.N);
      if (out.size === w.out && dP > 0 && dchi > need + 10){
        // Put back: the stages from the search's state with it again give the fit it had.
        out.delete(w.k); outWarn.splice(w.idx, 1); keptBIC.set(w.k, { z: w.z, dchi, dP, need });
        const v2 = vSearch.slice();
        out.forEach(k=> { v2[model.phases[k].iScale] = 0; model.phases[k].iLat.forEach((i, m)=> { v2[i] = len0[k][m]; }); });
        setParams(model, v2);
        stages.length = nSearch;
        continue;
      }
      if (out.size === w.out && dP > 0)
        outWarn[w.idx] = `${nm(w.k)}: not detected — ${weakWhy(w.z, true)}. Leaving it out raises χ² by ${Math.max(0, dchi).toFixed(0)} for its ${dP} parameters (fitting noise gives about ${dP}; a BIC would keep it above ${(need + 10).toFixed(0)}): ${dchi > dP + 3*Math.sqrt(2*dP) ? 'more than noise gives, too little to tell' : 'within what noise gives'}.`;
    }
    /* What the phase the own-intensity test left out in the last pass was worth: χ²
       without it, nothing else left out since, against χ² with it. A candidate that is not
       there takes up only what the others' model leaves, and when it goes they take most
       of it back: on synthetic samples χ² rose by 0.4–10 % (absent NaCl, LaB6, quartz,
       corundum, Mg beside hosts with a size distribution, anisotropic strain or two
       populations), or, where it had held a whole second population of an isostructural
       host (Mg and ZnO), ×3.1–3.9 with 87 % of its Σ w·y_p² taken up again. A phase that
       is there carries intensity no other can take: in crowded patterns of broad lines
       (two or three phases of 6–15 nm, 5–50 wt %), where none of its lines stands clear,
       leaving it out multiplied χ² by 2.8–300, the others taking up 24–53 % of it. It is
       put back, its own-intensity test waived (keptOwn), when χ² more than doubles and
       the rise is over a quarter of its Σ w·y_p² (what leaving it out would cost if they
       took none of it): a quarter is the geometric middle of the 13 % left by the absent
       and the 47 % by the present. Up to v426 it stayed out: a present phase of 30–50 wt %
       was lost in all 7 runs of four such samples (χ²_ν 37–313). The doubling is a ratio
       of χ² totals: where noise is most of χ² (600 counts at the top) a present phase must
       add more than that noise, and 2 of 11 such phases stayed out (χ² ×1.3, ×1.7); at ten
       times the counts the absent candidates' ratios stayed at 1.006–1.16. */
    if (ownOut){
      const w = ownOut; ownOut = null;
      const rise = chiTot(res) - w.chi;
      if (out.size === w.out && chiTot(res) > OWN_KEEP*w.chi && rise > OWN_SHARE*w.sig){
        out.delete(w.k); outWarn.splice(w.idx, 1); keptOwn.set(w.k, { chi2: w.chi2, without: res.stats.chi2, why: w.why });
        const v2 = vSearch.slice();
        out.forEach(k=> { v2[model.phases[k].iScale] = 0; model.phases[k].iLat.forEach((i, m)=> { v2[i] = len0[k][m]; }); });
        setParams(model, v2);
        stages.length = nSearch;
        continue;
      }
    }
    const zs = zScale(res), live = model.phases.map((_, k)=> k).filter(k=> !out.has(k));
    // Of the phases not above 3 esd, the least significant goes, one per pass (backward
    // elimination): phases whose lines overlap have correlated scales, and leaving one out
    // changes the others' esds. All at once (up to v425), a broad and a sharp population
    // of one SrTiO3 had both fallen under 3 esd and both gone, leaving no phase at all.
    const zOf = k => Number.isFinite(zs[k]) ? zs[k] : -Infinity;
    const failing = live.filter(k=> !keptBIC.has(k) && !(zs[k] > 3)), lost = failing.sort((a, b)=> zOf(a) - zOf(b)).slice(0, 1);
    // Beside other phases, one that only takes up a broad hump or the background, however
    // significant: its size or strain width run to their bounds, its crystallites under two
    // cells across, or its cell to the ±10 % bound (an absent NaCl or quartz beside a
    // SrTiO3 with an amorphous hump came out at 46–48(6) wt %, 0.8 nm, Ys on its bound).
    const odd = live.length > 1 ? live.filter(k=> !failing.includes(k) && implausible(k)) : [];
    let drop = null;
    if (!failing.length && !odd.length && live.length > 1){
      const ev = ownEvidence(model, model.v, res.stats.chi2);
      const weak = live.filter(k=> !ev[k].own && !keptOwn.has(k)).sort((a, b)=> ev[a].alone - ev[b].alone || ev[b].under - ev[a].under);
      if (weak.length && weak.length < live.length){
        const k = weak[0], e = ev[k], others = live.filter(j=> j !== k && !twins(model.phases[k], model.phases[j])).map(nm).join(', ');
        drop = { k, why: `${Math.round(e.under*100)} % of its calculated intensity lies under ${others}'s peaks, and ${!(e.alone > 0)
          ? 'none of its lines stands clear of theirs'
          : e.alone < 0.05 ? `its lines clear of theirs hold only ${(e.alone*100).toFixed(1)} % of it (under 5 %)`
          : !Number.isFinite(e.alpha) ? `its lines clear of theirs (${Math.round(e.alone*100)} % of it) have too few points (${e.pts}) to fit its intensity there`
          : `at its lines clear of theirs (${Math.round(e.alone*100)} % of it) the pattern shows ${Math.round(e.alpha*100)} ± ${Math.round(e.esd*100)} % of the intensity calculated: not told from none`}` };
      }
    }
    if (!lost.length && !odd.length && !drop) break;
    // Again from the search's state, without them.
    const v2 = vSearch.slice();
    out.forEach(k=> { v2[model.phases[k].iScale] = 0; model.phases[k].iLat.forEach((i, m)=> { v2[i] = len0[k][m]; }); });
    // (The rise is read from the next pass, which runs anyway; a scale at 0 costs nothing.)
    if (lost.length === 1 && !odd.length && zs[lost[0]] > 0)
      weakOut = { k: lost[0], z: zs[lost[0]], idx: outWarn.length, chi: chiTot(res), chi2: res.stats.chi2, P: res.stats.P, out: out.size + 1 };
    if (drop){
      // its calculated intensity in χ²'s terms, Σ w·y_p²: what leaving it out would cost if
      // no other phase took any of it up (at the optimum its residual is orthogonal to y_p)
      const st = evaluate(model, model.v), q = model.phases[drop.k], P = st.pats[drop.k], s = model.v[q.iScale];
      let sig = 0; for (let i = 0; i < model.n; i++) sig += model.w[i]*(s*P[i])**2;
      ownOut = { k: drop.k, idx: outWarn.length, chi: chiTot(res), chi2: res.stats.chi2, sig, why: drop.why, out: out.size + 1 };
    }
    lost.forEach(k=> leaveOut(k, weakWhy(zs[k], true), v2));
    odd.forEach(k=> leaveOut(k, implausible(k), v2));
    if (drop) leaveOut(drop.k, drop.why, v2);
    setParams(model, v2);
    stages.length = nSearch;
  }
  warnings.push(...outWarn);
  keptOwn.forEach((b, k)=> { if (!out.has(k)) warnings.push(`${nm(k)}: ${b.why}; but leaving it out raises χ²_ν from ${b.chi2.toFixed(2)} to ${b.without.toFixed(2)}, more than twice: the other phases cannot take up its intensity, and it is kept.`); });
  keptBIC.forEach((b, k)=> { if (!out.has(k)) warnings.push(`${nm(k)}: its scale stands at only ${(Math.floor(b.z*10)/10).toFixed(1)} esd (it correlates with its widths or another phase's), but leaving it out raises χ² by ${b.dchi.toFixed(0)} for its ${b.dP} parameters, above the ${(b.need + 10).toFixed(0)} at which a BIC keeps it: kept, with a large esd on its fraction.`); });
  return finish({ res, out, lastFree, nIn, cs });
}

/* sameFrame(q, v) → (Ra, Rb) → whether two frames of phase q's body (rotation matrices,
   the body's axes their columns), at v's widths, are one under the Laue class: a rotation
   of the class takes each axis of Rb onto Ra's (axes without sign), or onto another of
   Ra's of equal width where the body lets them swap (a square box's edges; any equal axes
   of a box or an ellipsoid, never an elliptic cylinder's height). Round 2's harness decides
   alike by the canonical form, the class's fundamental zone (AB §4.2 (3): 29 of the 124
   held refinements on the 77 runs repeated one, in the eight classes with a 3-, 4- or
   6-fold axis). A body of revolution has one held frame, none to compare. */
function sameFrame(q, v){
  const B = BODIES[q.shapeType], Wx = B.axes(q.iW.map(i=> v[i]));
  const swaps = (i, j) => i === j || (Wx[i] === Wx[j] && (B.base !== 'cylinder' || (i < 2 && j < 2)));
  const perms = [[0, 1, 2], [1, 0, 2], [0, 2, 1], [2, 1, 0], [1, 2, 0], [2, 0, 1]].filter(p=> p.every((j, i)=> swaps(i, j)));
  const rots = q.laue.map(R=> cartOp(q.Bm, R));
  return (Ra, Rb) => rots.some(C=> perms.some(p=> [0, 1, 2].every(i=>{
    const x = Rb[i], y = Rb[3 + i], z = Rb[6 + i], j = p[i];
    return Math.abs((C[0]*x + C[1]*y + C[2]*z)*Ra[j] + (C[3]*x + C[4]*y + C[5]*z)*Ra[3 + j] + (C[6]*x + C[7]*y + C[8]*z)*Ra[6 + j]) > 1 - 1e-9;
  })));
}

/* freeShape(model, k, res, free, opts) → { res, info }, { rejected, dBIC } or null: the
   free shape of phase k (shapeSetup), from the isotropic refinement res. By the cubic
   symmetry the pattern does not change to first order when a sphere is deformed (Σ over
   a family of uᵀδS u is the trace alone); in a lower symmetry only the part of the
   deformation that the Laue group averages to does (a tetragonal or hexagonal phase's c
   against a, not its a against b; a monoclinic phase's both). So a refinement started
   from the sphere goes nowhere, or only along that part: it starts instead from plates
   and needles on the low-index directions and from shapes drawn at random (seeded: the
   same data give the same result), each refined briefly, and the best few to
   convergence, then polished. The sphere-like solid is one of the starts (for the
   ellipsoid and the spheroid the sphere itself, so their fit never ends above the
   isotropic one). Each full refinement of a body starts with its orientation as the
   reference, r = 0. It is kept if it beats the isotropic fit by ΔBIC < −10 ({ rejected,
   dBIC, early } otherwise; early: decided on the brief refinements). A body with faces
   is refined again with them exact, and every body with its axes held on the lattice
   (kept when better: see the final stage). info: { type, starts, full, chi2Iso, chi2,
   Piso, P, N, chi2redIso, held, dBICfree, dBICheld, freeOff (the free axes' angles from
   the held ones, °), freeW (the free fit's widths) }. */
/* The normal's upper tail and its inverse (Acklam's quantile), and the family-wise deviate of
   the worst of m (Bonferroni; in logs for a large z). */
function normTail(z){ const t = 1/(1 + 0.2316419*Math.abs(z)), d = 0.3989422804014327*Math.exp(-z*z/2);
  const p = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))); return z >= 0 ? p : 1 - p; }
function normTailInv(p){
  if (!(p > 0)) return Infinity; if (p >= 1) return -Infinity;
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const lowerQ = u => { if (u < 0.02425){ const q = Math.sqrt(-2*Math.log(u)); return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5])/((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1); }
    const q = u - 0.5, r = q*q; return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5])*q/(((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1); };
  return p <= 0.5 ? -lowerQ(p) : lowerQ(1 - p);
}
const familyZ = (z, m) => z > 8 ? Math.sqrt(Math.max(0, z*z - 2*Math.log(m))) : normTailInv(Math.min(0.5, m*normTail(z)));
/* lineCheck(model, k, v, P) → SHAPE_CHECK's check of phase k's fit at v (model.v; P refined
   parameters): { S, B, zSeg, zBin, flagged, cuts (each segment's first point, then n),
   segs (the flagged segments: { s, i0, i1, lo, hi, hkl (the strongest line), chi2nu, zSeg,
   zBin }) }. */
function lineCheck(model, k, v, P){
  const q = model.phases[k], n = model.n, x = model.x, w = model.w, y = model.y, C = SHAPE_CHECK;
  const yc = evaluate(model, v).yc, r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = w[i] > 0 ? Math.sqrt(w[i])*(y[i] - yc[i]) : NaN;
  // the lines at their Kα centroids (Kα1 and a 2:1 Kα2: a third of the split)
  const L2 = model.lines.length > 1 ? model.lines[1] : null;
  const cen = tt => { if (!L2) return tt; const th = tt/2*Math.PI/180, s = L2.lam/model.lines[0].lam*Math.sin(th);
    return s < 1 ? tt + 2*(Math.asin(s) - th)*180/Math.PI*(L2.w/(model.lines[0].w + L2.w)) : tt; };
  const ticks = calc(model, v, { internal: true }).ticks.filter(t=> t.phase === q.id), Imax = Math.max(0, ...ticks.map(t=> t.I));
  const Ls = ticks.filter(t=> t.I > 1e-4*Imax && t.tt >= x[0] && t.tt <= x[n - 1])
    .map(t=> ({ c: cen(t.tt), H: t.H > 0 ? t.H : 0.1, I: t.I, hkl: [t.h, t.k, t.l] })).sort((a, b)=> a.c - b.c);
  const G = [];
  for (const l of Ls){ const g = G[G.length - 1]; if (g && l.c - g.last.c < Math.max(C.minsep, (l.H + g.last.H)/2)){ g.ls.push(l); g.last = l; } else G.push({ ls: [l], last: l, first: l }); }
  const cut = G.length ? [x[0] - 1e-9, ...G.slice(1).map((g, i)=> (G[i].last.c + g.first.c)/2), x[n - 1] + 1e-9] : [x[0] - 1e-9, x[n - 1] + 1e-9];
  const segs = []; let i = 0;
  for (let s = 0; s < cut.length - 1; s++){
    const i0 = i; while (i < n && x[i] < cut[s + 1]) i++;
    if (i - 1 < i0) continue;
    let m = 0, c2 = 0; for (let j = i0; j < i; j++) if (Number.isFinite(r[j])){ m++; c2 += r[j]*r[j]; }
    const a2 = 2/(9*Math.max(1, m)), top = G[s] ? G[s].ls.reduce((p, l)=> l.I > p.I ? l : p) : null;
    segs.push({ i0, i1: i - 1, lo: x[i0], hi: x[i - 1], hkl: top ? top.hkl : null, chi2nu: c2/Math.max(1, m), z: m ? (Math.cbrt(c2/m) - (1 - a2))/Math.sqrt(a2) : 0 });
  }
  // the bins (bin°), by their centres
  const per = Math.max(1, Math.round(C.bin/((x[n - 1] - x[0])/(n - 1)))), bins = [];
  for (let i0 = 0; i0 < n; i0 += per){ let t = 0, m = 0; for (let j = i0; j < Math.min(n, i0 + per); j++) if (Number.isFinite(r[j])){ t += r[j]; m++; }
    if (m > per/2) bins.push({ c: Math.min(n - 1, i0 + (per >> 1)), z: Math.abs(t)/Math.sqrt(m) }); }
  const S = segs.length, B = bins.length;
  for (const sg of segs){ sg.zSeg = familyZ(sg.z, S); sg.zBin = familyZ(Math.max(0, ...bins.filter(b=> b.c >= sg.i0 && b.c <= sg.i1).map(b=> b.z)), 2*B); }
  const zSeg = Math.max(...segs.map(sg=> sg.zSeg)), zBin = familyZ(Math.max(0, ...bins.map(b=> b.z)), 2*B);
  return { S, B, P, zSeg, zBin, flagged: zSeg > C.z || zBin > C.z, cuts: [...segs.map(sg=> sg.i0), n],
    segs: segs.map((sg, s)=> ({ s, ...sg })).filter(sg=> sg.zSeg > C.z || sg.zBin > C.z).map(({ z, ...sg })=> sg) };
}
// The fit at v refined again (noCov, no FCJ audit) with the points of segments `drop` (index
// ranges [i0, i1]) weighted 0, and whatever `then` reads from it; the weights, v, the esds and
// the covariance as they were after.
function refitWithout(model, v, drop, opts, then){
  const w0 = model.w, keep = { v: model.v.slice(), esd: model.esd, cov: model.cov }, W = Float64Array.from(w0);
  for (const [i0, i1] of drop) for (let i = i0; i <= i1; i++) W[i] = 0;
  model.w = W; delete model._bgSums;
  try { setParams(model, v); const r = refine(model, { audit: false, noCov: true, ...opts }); return then(r); }
  catch(e){ return null; }
  finally { model.w = w0; delete model._bgSums; setParams(model, keep.v); model.esd = keep.esd; model.cov = keep.cov; }
}
/* lineJack(model, k, v, free, check) → { groups, done, sd (ln D of each width's dimension;
   sdF the finite drops alone), turn (rms °, each body axis) }: the jackknife over lines of
   SHAPE_CHECK (the check's segments in at most `groups` contiguous groups). */
function lineJack(model, k, v, free, check){
  const q = model.phases[k], C = SHAPE_CHECK, S = check.cuts.length - 1, G = Math.min(S, C.groups), F = fitSettings();
  const W0 = q.iW.map(i=> v[i]), R0 = bodyFrame(q, v), dl = W0.map(()=> 0), dF = W0.map(()=> 0), turn = [0, 0, 0];
  let done = 0;
  for (let g = 0; g < G; g++){
    const a = Math.floor(g*S/G), b = Math.floor((g + 1)*S/G);
    const o = refitWithout(model, v, [[check.cuts[a], check.cuts[b] - 1]], { free, maxIter: C.iter, shiftTol: F.shiftTol, lambda: F.lambda }, ()=> ({ W: q.iW.map(i=> model.v[i]), R: bodyFrame(q, model.v) }));
    if (!o) continue;
    W0.forEach((w, i)=> { const t = w === o.W[i] ? 0 : Math.log(w/o.W[i]); dl[i] += t*t; if (Number.isFinite(t)) dF[i] += t*t; });
    for (let j = 0; j < 3; j++) turn[j] += Math.acos(Math.min(1, Math.abs(R0[j]*o.R[j] + R0[3 + j]*o.R[3 + j] + R0[6 + j]*o.R[6 + j])))**2;
    done++;
  }
  const f = (G - 1)/G;
  return { groups: G, done, sd: dl.map(t=> Math.sqrt(f*t)), sdF: dF.map(t=> Math.sqrt(f*t)), turn: turn.map(t=> Math.sqrt(f*t)*R2D) };
}
const SHAPE_STARTS = 10, SHAPE_FULL = 3;
function freeShape(model, k, res, free, opts){
  // The search with a body's faces rounded off (shapeWidths); never beyond it.
  model.shapeSoft = model.phases[k].iW ? { q: model.phases[k], soft: SHAPE_SOFT } : null;
  try { return freeShapeRun(model, k, res, free, opts); }
  finally { model.shapeSoft = null; }
}
function freeShapeRun(model, k, res, free, opts){
  const q = model.phases[k], pf = q.pfx, vIso = model.v.slice();
  // A rejection carries the per-line check of the isotropic fit (SHAPE_CHECK).
  const rejectWith = o => SHAPE_CHECK.on ? { ...o, check: lineCheck(model, k, vIso, res.stats.P) } : o;
  /* The settings (autoRefine's opts.fit): the starts and how many go to convergence; the
     brief refinements' 8 iterations, or maxIter when fewer; the full ones' 1.5 × maxIter
     (60 by default: a body's turns take longer than a stage), λ and the shift test as
     everywhere. */
  const F = fitSettings(opts.fit), nStarts = F.shapeStarts, nFull = F.shapeFull;
  /* Search v2 (SHAPE_MODE): the brief trials by forward differences (SHAPE_FWD 'all':
     every refinement), no refinement of the search with a covariance (lmX), the returned
     fit refined once more as v522 refined it (lmCentral), held frames once per orbit of the
     class, the class's distinct starts. The legacy ellipsoid keeps v522's search. */
  const v2 = SHAPE_MODE.search === 'v2' && !q.iL, lmX = v2 ? { forward: true, noCov: true } : null;
  const lmBrief = { maxIter: Math.min(8, F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda, ...lmX };
  const lmCentral = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda };
  const lmFull = { ...lmCentral, ...lmX, ...(v2 && SHAPE_FWD === 'briefs' ? { forward: false } : null) };
  const N = res.stats.N, chiTot = r => r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
  const y0 = Math.max(vIso[q.iYs], 1e-3);
  // A seeded generator (mulberry32) of Gaussian deviates.
  // (The same sequence for every phase: a result must not change with the phases'
  // ids, which follow the order they were added in.)
  const mulberry = s0 => {
    let seed = s0 >>> 0;
    const rnd = ()=> { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
    return ()=> Math.sqrt(-2*Math.log(rnd() || 1e-12))*Math.cos(2*Math.PI*rnd());
  };
  const gauss = mulberry(0x9e3779b9);
  const unit = t => { const n = Math.hypot(...t); return t.map(x=> x/n); };
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  // A turn by phi about the unit axis n (row-major), a product, a random turn.
  const rotation = (n, phi) => { const c = Math.cos(phi), s = Math.sin(phi), C = 1 - c, [x, y, z] = n;
    return [c + x*x*C, x*y*C - z*s, x*z*C + y*s,  y*x*C + z*s, c + y*y*C, y*z*C - x*s,  z*x*C - y*s, z*y*C + x*s, c + z*z*C]; };
  const mul = (P, Q) => [0,1,2].flatMap(i=> [0,1,2].map(j=> P[3*i]*Q[j] + P[3*i + 1]*Q[3 + j] + P[3*i + 2]*Q[6 + j]));
  const randomTurn = (g = gauss)=> quatMat(unit([g(), g(), g(), g()]));
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
    while (starts.length < nStarts + 1){
      // S's eigenvalues are squared widths: widths y0·e^{0.8g}, spread as the bodies'.
      const lam = [0, 1, 2].map(()=> y0*y0*Math.exp(1.6*gauss()));
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
    if (!v2) while (starts.length < nStarts + 1) starts.push(put(Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*gauss()))), randomTurn()));
    else {
      /* v2: the class's distinct starts, and SHAPE_FILL random ones beside them (plus the
         setting's starts above its default) from a stream of their own. The main stream,
         which feeds the turns before the polish and the refit next, skips v522's random
         starts (7 deviates each), so the turns are v522's whatever the starts: in a flat
         valley the turn alone decides which free minimum is returned (up to 7.5 χ²_ν on a
         synthetic cylinder, AB §4.6), and one stream for both had made the start cut look
         like it lost minima the shifted turns lost (§5.2, B1). */
      for (let c = starts.length; c < nStarts + 1; c++) for (let d = 0; d < 7; d++) gauss();
      const g = mulberry(0x85ebca6b), nFill = SHAPE_FILL + Math.max(0, nStarts - SHAPE_STARTS);
      for (let c = 0; c < nFill; c++) starts.push(put(Wof(...[0, 1, 2].map(()=> w0*Math.exp(0.8*g()))), randomTurn(g)));
    }
    // The orientation reached becomes the reference, r = 0: the chart is fresh at the
    // start of each full refinement, far from |r| = π.
    rebase = v => { const vv = v.slice(), R = bodyFrame(q, v); q.iR.forEach(i=> { vv[i] = 0; }); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
    turned = v => { const vv = rebase(v), R = mul(bodyFrame(q, v), rotation(unit([gauss(), gauss(), gauss()]), 0.02)); quatOfMat(R).forEach((t, i)=> { vv[q.iQ[i]] = t; }); return vv; };
    // The body set on the lattice: its best-placed axis exactly on its lattice
    // direction; a body with three axes, its next one on each of the simplest lattice
    // directions exactly normal to the first, and on those nearest its own (a projection
    // of its own nearest direction had left a held axis 7° off its label, and the free
    // fit's in-plane frame had held a plate on [1-13]); a body of revolution, its axis
    // alone. [] when no axis is within SNAP_DEG of a lattice direction.
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
      // The 3 simplest, and the simplest within SNAP_DEG of each of the other two axes,
      // as the first axis is chosen (a box whose edges lay on [120] and [-210] about
      // [001] had been tried on [100], [010] and [110] alone, and stayed free). Each
      // candidate goes to whichever of the other two axes it is nearer.
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
  }
  names = free.filter(nm=> nm !== pf + 'Ys').concat(names);
  const steps = starts.length + nFull + 2;
  let done = 0;
  const tick = ()=> { done++; if (opts.onShape) opts.onShape(Math.min(1, done/steps)); };
  const brief = [];
  for (const put of starts){
    const vv = vIso.slice(); vv[q.iYs] = 0;
    put(vv);
    setParams(model, vv);
    try { const r = refine(model, { free: names, ...lmBrief, audit: false }); brief.push({ v: model.v.slice(), chi: chiTot(r) }); } catch(e){}
    tick();
  }
  brief.sort((a, b)=> a.chi - b.chi);
  // Every brief refinement threw: nothing was refined (not a ΔBIC of +∞).
  if (!brief.length){ setParams(model, vIso); return null; }
  // The brief refinements already reach the shape's gain (the best one's χ² within
  // 0.2 χ²_ν of the converged fit on synthetic plates, needles and spheres): when it is
  // under half of what ΔBIC < −10 needs by the cheaper route, a body held on the
  // lattice (its nR turns fewer), the full refinements are not run — on isotropic
  // samples they were most of the time, for a shape then rejected. (Half the free
  // orientation's need is the held one's less 5 − ½·ln N, as dP = 2nR − 1: a margin of
  // 0.7 at N = 5251, none above N = e¹⁰, where a shape the held route keeps could be
  // rejected.) The ΔBIC given is that route's: the lowest the trial shapes allow.
  const dP = names.length - free.length, dPmin = dP - (q.iR ? q.iR.length : 0), gain = brief.length ? (chiTot(res) - brief[0].chi)/Math.max(1, res.stats.chi2) : -Infinity;
  if (!(gain > (10 + dPmin*Math.log(N))/2)){ setParams(model, vIso); return rejectWith({ rejected: true, dBIC: dPmin*Math.log(N) - gain, early: true }); }
  let best = null;
  const finals = [];
  // A full refinement from v; kept as the best when it is.
  const full = v => {
    setParams(model, rebase(v));
    let r; try { r = refine(model, { free: names, ...lmFull }); } catch(e){ return null; }
    if (!best || chiTot(r) < chiTot(best.res)) best = { res: r, v: model.v.slice() };
    tick();
    return chiTot(r);
  };
  for (const b of brief.slice(0, nFull)){ const c = full(b.v); if (c != null) finals.push(c); }
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
    // search; an ellipsoid's or a spheroid's ball has none, and is never rounded), its
    // axes free; then set on the lattice, its orientation held — a crystallite's faces
    // are lattice planes more often than not, and a held axis is two or three
    // parameters fewer. The lower ΔBIC is kept.
    model.shapeSoft = null;
    const refineFrom = (v, nm) => { setParams(model, rebase(v)); try { const r = refine(model, { free: nm, ...lmFull }); return { res: r, v: model.v.slice() }; } catch(e){ return null; } };
    if (BODIES[q.shapeType].base !== 'ball'){ const ex = refineFrom(best.v, names); if (ex) best = ex; }
    dBICfree = bic(best.res);
    // The held candidates: the best of the lattice frames near the free fit. (v2: a frame a
    // rotation of the class takes onto one tried already ends where that one did, the
    // refinement being equivariant, and is not refined again: sameFrame.)
    let sn = null;
    const tried = [], same = v2 && snaps ? sameFrame(q, best.v) : null;
    for (const vs of (snaps ? snaps(best.v) : [])){
      if (same){ const R = bodyFrame(q, vs); if (tried.some(T=> same(T, R))) continue; tried.push(R); }
      const r = refineFrom(vs, names.filter(nm=> !q.iR.some(i=> model.par[i].name === nm)));
      if (r && (!sn || chiTot(r.res) < chiTot(sn.res))) sn = r;
    }
    if (sn){
      // Held below the free fit in χ²: the free orientation includes the held one, so the
      // free search ended in a worse valley (on the user's 33A a box's edges 45° off in its
      // plate, 35 χ²_ν above). The free fit is then refined again from the held frame,
      // turned a little as in the polish — from the frame itself, on lattice directions,
      // the refinement stops at once (0.2 χ²_ν higher than turned on a synthetic plate) —
      // so that freeOff and freeW measure a free fit at least as good.
      if (chiTot(sn.res) < chiTot(best.res)){
        const fr = refineFrom(turned(sn.v), names);
        if (fr && chiTot(fr.res) < chiTot(best.res)){ best = fr; dBICfree = bic(best.res); }
      }
      dBICheld = bic(sn.res);
      // Held only where the data allow it as well: the free orientation no better than
      // the held one by more than a 95 % χ² for its 2 or 3 turns. The BIC alone gave
      // three turns' discount (25) to boxes whose true faces were 8° off ⟨111⟩. Δχ² in the
      // free fit's own noise, χ²_ν floored at 1: the isotropic fit's, which the misfit the
      // shape removes inflates (3.2 for a synthetic 16 × 12 × 2.4 nm box, 9–16 for thinner
      // bodies), had held that box with its faces 4° off the frame in 3 draws of 3 (Δχ²
      // 10–23 over its three turns), and every on-lattice case is held either way.
      const gain = (chiTot(sn.res) - chiTot(best.res))/Math.max(1, best.res.stats.chi2);
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
  let cb = chiTot(best.res);
  const dBIC = bic(best.res);
  if (!(dBIC < -10)){ setParams(model, vIso); return rejectWith({ rejected: true, dBIC }); }
  setParams(model, best.v);
  // v2: the search's refinements made no covariance, and (with SHAPE_FWD 'all') forward
  // differences can stop a little short in a flat valley: the fit kept is refined once
  // more by central differences, its covariance from there (SHAPE_CENTRAL), else, or should
  // that throw, given its covariance alone. (Its ΔBIC and outcome are the search's.)
  if (v2){
    let r = null;
    if (SHAPE_CENTRAL) try { r = refine(model, { free: best.res.free, ...lmCentral }); } catch(e){ setParams(model, best.v); }
    if (!r) try { r = refine(model, { free: best.res.free, ...lmCentral, covOnly: true }); } catch(e){ setParams(model, best.v); }
    if (r){ best = { res: r, v: model.v.slice() }; cb = chiTot(r); }
  }
  // The per-line check of the fit kept (SHAPE_CHECK); with retest, where it fires, the keep
  // test again without the flagged segments.
  const check = SHAPE_CHECK.on ? lineCheck(model, k, best.v, best.res.stats.P) : null;
  if (check && check.flagged && SHAPE_CHECK.retest && check.segs.length <= check.S - 2){
    const F = fitSettings(opts.fit), lm = { maxIter: Math.round(1.5*F.maxIter), shiftTol: F.shiftTol, lambda: F.lambda }, drop = check.segs.map(sg=> [sg.i0, sg.i1]);
    const sh = refitWithout(model, best.v, drop, { free: best.res.free, ...lm }, r=> r.stats), is = refitWithout(model, vIso, drop, { free, ...lm }, r=> r.stats);
    if (sh && is){
      const c = st => st.chi2*Math.max(1, st.N - st.P);
      check.retest = { dBIC: (c(sh) - c(is))/Math.max(1, is.chi2) + (sh.P - is.P)*Math.log(sh.N) };
      if (!(check.retest.dBIC < -10)){ setParams(model, vIso); return { rejected: true, dBIC: check.retest.dBIC, misfit: true, check }; }
    }
  }
  return { res: best.res, info: { type: q.shapeType, starts: starts.length, full: finals.length,
    chi2Iso: chiTot(res), chi2: cb, Piso: res.stats.P, P: best.res.stats.P, N, chi2redIso: res.stats.chi2, held, dBICfree, dBICheld, freeOff, freeW, check } };
}

/* ---------- derived quantities ---------- */
/* sizeStrain(model, irf, result?) → per phase:
   { id, name, Ys, Xs (deg), YsEsd, XsEsd, D (nm), Desd, strain, strainEsd, instrumentSubtracted }.
   The phase's Lorentzian widths above the instrument's: Y_s = (Y + Ys_phase) − Y_irf,
   X_s = (X + Xs_phase) − X_irf (without irf the whole width: the size then includes the
   instrument). Size: D = Kλ/(Y_s·π/180), K = 0.9 (Scherrer, as the Analysis card), λ the
   Kα1; strain on the FWHM too: H_L = 4ε·tanθ → ε = X_s·(π/180)/4 (Stokes and Wilson's
   e = β/(4 tanθ), on the integral breadth, is π/2 times it). esds from the refinement's
   covariance (result, else the model's last one); the irf's own uncertainty is not
   included. A width at or below zero means no measurable broadening: D = Infinity, ε = 0. */
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

export { buildModel, calc, refine, cellSearch, autoRefine, fitSettings, sizeStrain, weightFractions, shapeOf, columnLengthV, SHAPE_TYPES, shapeTypeOf,
         solveLinear, getParams, setParams, rStats, tch, profileAtTheta, displacementMm,
         fcjNodes, addPeak, addPeakFCJ, addLine, shapeActive, HG2_FLOOR, K_SCHERRER, cellOf, siteU, lowIndexPlanes, strainFormsAt, PROFILES, faultOf, lpFactor,
         phaseSites, phaseMass, OCC_MAX, axialNodes, axialOf, axialOn, axialReach, bgInvOn, KIND_GROUP, shapeNamed, SHAPE_MODE, WPPM_OPT, SHAPE_CHECK, lineCheck, lineJack };

const ENG = { FS, freeShape, freeShapeRun, ...(typeof SHAPE_CHECK === 'undefined' ? {} : { SHAPE_CHECK, lineCheck, lineJack }),   // [step3]
  refine, setParams, getParams, evaluate, calc, rStats, bodyFrame, BODIES, quatMat, quatOfMat, quatMul, quatOfRot,
  lowIndexAxes, lattDirection, latticeAcross, shapeWidths, shapeTs, columnLengthV, SHAPE_SOFT, SHAPE_STARTS, SHAPE_FULL, fitSettings, shapeOf, turnEsds,
  bodyShapeOf, SNAP_DEG, D2R, R2D, K_SCHERRER, lowIndexPlanes, memberVectors, phasePattern, cartOp, properOp, SHAPE_FWD, SHAPE_MODE: typeof SHAPE_MODE === 'undefined' ? null : SHAPE_MODE };
export { ENG };
