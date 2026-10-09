/* =========================================================
   XRD LINE BROADENING (Rietveld) — Whole Powder Pattern Modelling and the anisotropic
   broadening terms.
   - WPPM (Scardi & Leoni, Acta Cryst. A58 (2002) 190): a line's profile is the Fourier
     transform of the product of the coefficients of each cause of broadening — the
     instrument's pseudo-Voigt, the crystallites' size (the solid's own common-volume
     function along each member of the reflection's family, averaged over a log-normal
     distribution of sizes), the strain and the planar faults (each a Lorentzian, an
     exponential in L), and the axial divergence's shifts — synthesised on a grid by an
     FFT and read at the pattern's points. wppmLine.
   - Stephens' anisotropic microstrain (J. Appl. Cryst. 32 (1999) 281): the strain's
     square a quartic form of the diffraction vector's direction, invariant under the
     Laue group. quarticInvariants.
   - Planar faults (after Warren): faults on the planes of a family, each shifting the
     crystal on one side by a displacement R; a reflection h loses coherence across
     every fault where h·R is not an integer. faultTable.
   Pure functions: no DOM, importable by the page, a Worker and Node.
========================================================= */

const D2R = Math.PI/180;
const LN2 = Math.LN2;

/* ---------- FFT ---------- */
// Radix-2, in place, with the sign + (Σ x_n e^{+2πi nm/N}): the inverse transform that
// takes Fourier coefficients to the profile. Plans and work arrays are cached per N.
const PLANS = new Map();
function plan(N){
  let p = PLANS.get(N);
  if (p) return p;
  const bits = Math.round(Math.log2(N)), rev = new Uint32Array(N), cs = new Float64Array(N >> 1), sn = new Float64Array(N >> 1);
  for (let i = 0; i < N; i++){ let r = 0, x = i; for (let b = 0; b < bits; b++){ r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
  for (let k = 0; k < N >> 1; k++){ cs[k] = Math.cos(2*Math.PI*k/N); sn[k] = Math.sin(2*Math.PI*k/N); }
  p = { N, rev, cs, sn, re: new Float64Array(N), im: new Float64Array(N) };
  PLANS.set(N, p);
  return p;
}
function fftPlus(p){
  const N = p.N, rev = p.rev, re = p.re, im = p.im, cs = p.cs, sn = p.sn;
  for (let i = 0; i < N; i++){ const j = rev[i]; if (j > i){ let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= N; size <<= 1){
    const half = size >> 1, step = N/size;
    for (let i = 0; i < N; i += size){
      for (let j = 0, k = 0; j < half; j++, k += step){
        const a = i + j, b = a + half, wr = cs[k], wi = sn[k];
        const xr = re[b]*wr - im[b]*wi, xi = re[b]*wi + im[b]*wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
}

/* ---------- quadratures ---------- */
const GL = new Map();
function gaussLegendre(n){
  let g = GL.get(n);
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
  g = { t, w }; GL.set(n, g);
  return g;
}
// The standard normal's tail below −7, Φ(−7): the log-normal's mass below the quadrature's
// range, where every common-volume function is 1.
const PHI_M7 = 1.279812543885835e-12;

/* ---------- the crystallites' common-volume functions ----------
   A(L): the fraction of a crystallite's volume that its copy shifted by L along the
   diffraction vector still overlaps (the covariogram over the volume), whose Fourier
   transform is the size profile; 2∫A dL is the volume-weighted column length, -1/A′(0)
   the area-weighted one. For the unit base bodies (ℓ the shift in their units, along a
   direction whose absolute components are a, b, c, or s across a cylinder's axis and c
   along it):
   - ball (diameter 1): 1 − 3ℓ/2 + ℓ³/2;
   - cube (edge 1): (1 − ℓa)(1 − ℓb)(1 − ℓc);
   - cylinder (diameter 1, height 1): (1 − ℓc)·(2/π)(acos ℓs − ℓs√(1 − ℓ²s²)), the overlap
     of two unit-diameter discs ℓs apart over the disc's area.
   Each is 0 beyond the shift that takes the copy off the body (supportOf). */
function covBase(base, l, a, b, c){
  if (base === 'ball') return l >= 1 ? 0 : 1 - 1.5*l + 0.5*l*l*l;
  if (base === 'cube'){ const p = 1 - l*a, q = 1 - l*b, r = 1 - l*c; return p <= 0 || q <= 0 || r <= 0 ? 0 : p*q*r; }
  // cylinder: a holds s (across the axis), c along it
  const z = 1 - l*c, d = l*a;
  if (z <= 0 || d >= 1) return 0;
  return z*(2/Math.PI)*(Math.acos(d) - d*Math.sqrt(1 - d*d));
}
function supportOf(base, a, b, c){
  if (base === 'ball') return 1;
  if (base === 'cube') return 1/Math.max(a, b, c);
  return 1/Math.max(a, c);
}
/* addMemberCoef(out, n, dL, base, a, b, c, scale, sigma, weight): out[i] += weight·A(L_i),
   L_i = i·dL (Å), for one member: the base body's A along its direction at ℓ = L·scale
   (scale = 1/the body's extent along it, Å⁻¹ — |w| in the shape's terms), averaged over
   a log-normal distribution of sizes of median 1 and width σ (of ln size), volume-
   weighted: a crystallite of relative size s diffracts as s³, so ln s is N(3σ², σ²) over
   the volume and A(L) = ∫ a(L·scale/s) over it. In u = ln ℓ, A = ∫_{−∞}^{ln T} a(e^u)
   φ((u − μ)/σ)/σ du with μ = ln(L·scale) − 3σ² and T the support: smooth on the support,
   so Gauss–Legendre over [μ − 7σ, min(ln T, μ + 7σ)] (24 nodes) converges fast (the
   mass below μ − 7σ, ~10⁻¹², taken as a = 1); the sphere's from a table (ballTable). */
const LN_NODES = 24, LN_STEP = 0.1;
// The log-normal average at ℓ₀ = L·scale (the median crystallite's ℓ).
function lnAverage(base, l0, a, b, c, sigma, lnT){
  const { t, w } = gaussLegendre(LN_NODES);
  const mu = Math.log(l0) - 3*sigma*sigma, lo = mu - 7*sigma, hi = Math.min(lnT, mu + 7*sigma);
  if (hi <= lo) return 0;
  const h = (hi - lo)/2, m = (hi + lo)/2;
  let s = 0;
  for (let k = 0; k < LN_NODES; k++){
    const u = m + h*t[k], z = (u - mu)/sigma;
    s += w[k]*covBase(base, Math.exp(u), a, b, c)*Math.exp(-0.5*z*z);
  }
  return s*h/(sigma*Math.sqrt(2*Math.PI)) + PHI_M7;
}
/* The sphere's log-normal average depends on L·scale alone: tabulated once per σ, on
   2048 points evenly spaced in ln ℓ₀ from 10⁻⁴ to where it is under 10⁻⁹ (ℓ₀ = e^{3σ² +
   6σ}), and read by linear interpolation in ln ℓ₀ (below 10⁻⁴, linearly from 1 at 0). */
const LN_TABLES = new Map();
function ballTable(sigma){
  const key = sigma.toPrecision(12);
  let tb = LN_TABLES.get(key);
  if (tb) return tb;
  const n = 2048, u0 = Math.log(1e-4), u1 = 3*sigma*sigma + 6*sigma, du = (u1 - u0)/(n - 1), A = new Float64Array(n);
  for (let i = 0; i < n; i++) A[i] = lnAverage('ball', Math.exp(u0 + i*du), 0, 0, 0, sigma, 0);
  tb = { u0, du, n, A, l1: Math.exp(u0) };
  if (LN_TABLES.size > 16) LN_TABLES.delete(LN_TABLES.keys().next().value);
  LN_TABLES.set(key, tb);
  return tb;
}
function ballAt(tb, l0){
  if (l0 <= tb.l1) return 1 - (1 - tb.A[0])*l0/tb.l1;
  const f = (Math.log(l0) - tb.u0)/tb.du, i = Math.floor(f);
  if (i >= tb.n - 1) return 0;
  return tb.A[i] + (f - i)*(tb.A[i + 1] - tb.A[i]);
}
function addMemberCoef(out, n, dL, base, a, b, c, scale, sigma, weight){
  if (!(scale > 0)){ for (let i = 0; i < n; i++) out[i] += weight; return; }
  if (!(sigma > 1e-4)){
    for (let i = 0; i < n; i++){ const v = covBase(base, i*dL*scale, a, b, c); if (v <= 0 && i) break; out[i] += weight*v; }
    return;
  }
  if (base === 'ball'){
    const tb = ballTable(sigma);
    for (let i = 0; i < n; i++){ const v = ballAt(tb, i*dL*scale); if (v <= 0 && i) break; out[i] += weight*v; }
    return;
  }
  const lnT = Math.log(supportOf(base, a, b, c)), { t, w } = gaussLegendre(LN_NODES), s2 = sigma*sigma;
  out[0] += weight;
  /* A long line: the average, a function of ℓ₀ = L·scale alone, tabulated even in ln ℓ₀
     every LN_STEP·σ over the line's reach (to where it vanishes) and read by cubic
     (Catmull–Rom) interpolation, when that takes fewer than half the points. Point by
     point, a log-normal of free solids took 15–20 minutes a refinement (thousands of
     points a line, each a 24-node quadrature). */
  const u0 = Math.log(dL*scale), u1 = Math.min(Math.log(Math.max(1, n - 1)*dL*scale), lnT + 3*s2 + 7*sigma);
  const M = u1 > u0 ? Math.ceil((u1 - u0)/(LN_STEP*sigma)) + 1 : 0;
  if (M >= 4 && 2*M < n - 1){
    // (one node more on each side, so the end intervals have their four neighbours)
    const du = (u1 - u0)/(M - 1), tab = new Float64Array(M + 2);
    for (let j = 0; j < M + 2; j++) tab[j] = lnAverage(base, Math.exp(u0 + (j - 1)*du), a, b, c, sigma, lnT);
    for (let i = 1; i < n; i++){
      const f = (Math.log(i*dL*scale) - u0)/du;
      if (f > M - 1 + 1e-9) break;
      const j = Math.min(M - 2, Math.floor(f)) + 1, x = f - (j - 1);
      const p0 = tab[j - 1], p1 = tab[j], p2 = tab[j + 1], p3 = tab[j + 2];
      out[i] += weight*(p1 + 0.5*x*(p2 - p0 + x*(2*p0 - 5*p1 + 4*p2 - p3 + x*(3*(p1 - p2) + p3 - p0))));
    }
    return;
  }
  for (let i = 1; i < n; i++){
    const mu = Math.log(i*dL*scale) - 3*s2, lo = mu - 7*sigma, hi = Math.min(lnT, mu + 7*sigma);
    if (hi <= lo){ if (lnT < lo) break; continue; }
    const h = (hi - lo)/2, m = (hi + lo)/2;
    let s = 0;
    for (let k = 0; k < LN_NODES; k++){
      const u = m + h*t[k], z = (u - mu)/sigma;
      s += w[k]*covBase(base, Math.exp(u), a, b, c)*Math.exp(-0.5*z*z);
    }
    out[i] += weight*(s*h/(sigma*Math.sqrt(2*Math.PI)) + PHI_M7);
  }
}

/* ---------- one line by WPPM ----------
   wppmLine(o) adds I·profile to o.out over the window. The profile is synthesised in
   δ = d* − d*₀ (Å⁻¹, d* = 2 sinθ/λ), where a size profile is symmetric whatever the
   angle, and read at each point 2θ through δ(2θ) = 2(sin θ − sin θ₀)/λ with the
   Jacobian dδ/d2θ, so its area in 2θ is I. Its Fourier coefficients:
     A(L) = [η e^{−πH L} + (1 − η) e^{−(πH L)²/(4 ln 2)}] · e^{−πW L} · A_size(L) · Σ_k w_k e^{−2πi L δ_k}
   — the instrument's pseudo-Voigt (FWHM H, mixing η, as the standard's refinement
   gives it), the Lorentzian terms (FWHM W: strain, faults), the size (o.size fills it)
   and the axial divergence's nodes (shifts δ_k, weights w_k). On a grid of N points
   δ_m = m·Δδ, Δδ an eighth of the narrowest component's width, over one period = the
   window (±max(win·H_est, winMin) and the divergence's spread): L_n = n/(N Δδ), and the
   profile is the inverse FFT. Periodicity folds the tails beyond the window back in, so
   the profile is lowered by its value at the window's edge (the same point on both
   sides) — the same treatment as the pseudo-Voigt's Lorentzian (WIN_FWHM): it goes to 0
   there continuously, and what it leaves out goes to the background. Read between grid
   points by cubic (Catmull–Rom) interpolation. */
const N_MIN = 64, N_MAX = 16384;
function wppmLine(o){
  const { x, out, tt, lam, I } = o;
  const th0 = tt*D2R/2, s0 = Math.sin(th0), c1 = Math.cos(th0)*D2R/lam;   // Å⁻¹ per degree of 2θ near the line
  const nodes = o.nodes || null;
  let lo = 0, hi = 0;
  if (nodes) for (const nd of nodes){ if (nd.d < lo) lo = nd.d; if (nd.d > hi) hi = nd.d; }
  const halfDeg = Math.max(o.win*o.Hest, o.winMin) + Math.max(-lo, hi);
  let dd = Math.max(o.Hmin, 1e-5)*c1/8;
  let N = Math.pow(2, Math.ceil(Math.log2(Math.max(1, 2*halfDeg*c1/dd))));
  N = Math.min(N_MAX, Math.max(N_MIN, N));
  dd = 2*halfDeg*c1/N;                    // one period = the window exactly
  const dL = 1/(N*dd), p = plan(N), re = p.re, im = p.im;
  re.fill(0); im.fill(0);
  // The common factor (instrument, Lorentzian terms), to where it no longer counts.
  const H = o.Hi*c1, eta = o.etai, W = o.WL || 0, gq = Math.PI*Math.PI*H*H/(4*LN2);
  let nL = N >> 1;
  const com = o._com && o._com.length >= nL + 1 ? o._com : new Float64Array(nL + 1);
  for (let i = 0; i <= nL; i++){
    const L = i*dL, v = (eta*Math.exp(-Math.PI*H*L) + (1 - eta)*Math.exp(-gq*L*L))*Math.exp(-Math.PI*W*L);
    com[i] = v;
    if (v < 1e-8 && i > 2){ nL = i; break; }
  }
  const size = new Float64Array(nL + 1);
  if (o.size) o.size(size, nL + 1, dL); else size.fill(1);
  // The divergence's nodes: e^{−2πi L δ_k} by recurrence in L.
  if (nodes && nodes.length){
    const m = nodes.length, cr = new Float64Array(m), ci = new Float64Array(m), er = new Float64Array(m), ei = new Float64Array(m);
    for (let k = 0; k < m; k++){ const a = -2*Math.PI*dL*nodes[k].d*c1; er[k] = Math.cos(a); ei[k] = Math.sin(a); cr[k] = nodes[k].w; ci[k] = 0; }
    for (let i = 0; i <= nL; i++){
      let sr = 0, si = 0;
      for (let k = 0; k < m; k++){
        sr += cr[k]; si += ci[k];
        const r = cr[k]*er[k] - ci[k]*ei[k]; ci[k] = cr[k]*ei[k] + ci[k]*er[k]; cr[k] = r;
      }
      const a = com[i]*size[i]*dL;
      if (i === 0){ re[0] = a*sr; continue; }
      if (i === N >> 1){ re[i] += a*sr; continue; }
      re[i] = a*sr; im[i] = a*si; re[N - i] = a*sr; im[N - i] = -a*si;
    }
  } else {
    for (let i = 0; i <= nL; i++){
      const a = com[i]*size[i]*dL;
      if (i === 0 || i === N >> 1){ re[i] += a; continue; }
      re[i] = a; re[N - i] = a;
    }
  }
  fftPlus(p);
  // re[m]: the profile at δ_m (m ≥ N/2 the negative side). Lowered by its edge value.
  const edge = re[N >> 1], half = (N >> 1)*dd;
  const at = m => re[((m % N) + N) % N];
  const xLo = 2*Math.asin(Math.max(-1, Math.min(1, s0 - half*lam/2)))/D2R, xHi = 2*Math.asin(Math.max(-1, Math.min(1, s0 + half*lam/2)))/D2R;
  let i = lowerBound(x, xLo);
  for (const n = x.length; i < n; i++){
    const xi = x[i];
    if (xi > xHi) break;
    const th = xi*D2R/2, dl = 2*(Math.sin(th) - s0)/lam;
    if (dl < -half || dl > half) continue;
    const f = dl/dd, m = Math.floor(f), u = f - m;
    const p0 = at(m - 1), p1 = at(m), p2 = at(m + 1), p3 = at(m + 2);
    // Catmull–Rom
    const v = p1 + 0.5*u*(p2 - p0 + u*(2*p0 - 5*p1 + 4*p2 - p3 + u*(3*(p1 - p2) + p3 - p0)));
    out[i] += I*(v - edge)*Math.cos(th)*D2R/lam;
  }
}
function lowerBound(x, v){
  let lo = 0, hi = x.length;
  while (lo < hi){ const mid = (lo + hi) >> 1; if (x[mid] < v) lo = mid + 1; else hi = mid; }
  return lo;
}

/* ---------- Stephens' anisotropic microstrain ----------
   The strain of a reflection whose diffraction vector has the Cartesian unit direction
   u: ε(u)² = ε₀² + Σ_j S_j q_j(u), q_j the quartic forms of u invariant under the Laue
   group, less their mean over the sphere and scaled to unit rms (so ε₀ is the strain's
   rms over directions, and S_j each an anisotropic part of ε², in 10⁻⁶ in the engine):
   1 for a cubic phase, 2 hexagonal, 3 for 4/mmm and −3m, 4 for 4/m and −3, 5
   orthorhombic, 8 monoclinic, 14 triclinic (Stephens' counts less the isotropic term). Built
   numerically for any group: each quartic monomial averaged over the group's Cartesian
   operations, their span reduced by Gram–Schmidt in the sphere's inner product (on
   600 points) against the constant and each other. Coefficients over the 15 monomials
   x^a y^b z^c, a + b + c = 4 (MONO). */
const MONO = [];
for (let a = 4; a >= 0; a--) for (let b = 4 - a; b >= 0; b--) MONO.push([a, b, 4 - a - b]);
function monoVals(u, out){
  const [x, y, z] = u, px = [1, x, x*x, x*x*x, x*x*x*x], py = [1, y, y*y, y*y*y, y*y*y*y], pz = [1, z, z*z, z*z*z, z*z*z*z];
  for (let i = 0; i < 15; i++){ const m = MONO[i]; out[i] = px[m[0]]*py[m[1]]*pz[m[2]]; }
  return out;
}
function evalQuartic(coef, u){
  const mv = monoVals(u, new Float64Array(15));
  let s = 0; for (let i = 0; i < 15; i++) s += coef[i]*mv[i];
  return s;
}
function spherePoints(n){
  const pts = [];
  for (let i = 0; i < n; i++){
    const z = 1 - (2*i + 1)/n, r = Math.sqrt(1 - z*z), ph = i*2.399963229728653;
    pts.push([r*Math.cos(ph), r*Math.sin(ph), z]);
  }
  return pts;
}
function solveDense(A, b, n){
  const M = A.map((row, i)=> [...row, b[i]]);
  for (let c = 0; c < n; c++){
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let r = 0; r < n; r++){ if (r === c) continue; const f = M[r][c]/d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f*M[c][k]; }
  }
  return M.map((row, i)=> row[n]/row[i]);
}
/* quarticInvariants(ops): ops the Laue group's Cartesian operations (row-major 3×3,
   acting on Cartesian diffraction vectors). → [coef (15)] of the anisotropic forms. */
function quarticInvariants(ops){
  const pts = spherePoints(600), mv = new Float64Array(15);
  // A monomial averaged over the group, as values on the sphere's points.
  const symVals = j => pts.map(u=>{
    let s = 0;
    for (const C of ops){ const v = [C[0]*u[0] + C[1]*u[1] + C[2]*u[2], C[3]*u[0] + C[4]*u[1] + C[5]*u[2], C[6]*u[0] + C[7]*u[1] + C[8]*u[2]]; s += monoVals(v, mv)[j]; }
    return s/ops.length;
  });
  // Its monomial coefficients: the values at 15 generic points, through the
  // monomials' matrix there.
  const gp = [[0.21,0.67,-0.71],[0.83,-0.12,0.54],[-0.44,0.38,0.81],[0.11,-0.93,0.35],[0.62,0.61,0.49],[-0.71,-0.29,0.64],[0.37,0.12,-0.92],[-0.18,0.84,0.51],[0.95,0.22,-0.2],[-0.55,-0.77,-0.31],[0.29,-0.41,-0.87],[0.73,-0.66,0.18],[-0.09,0.27,-0.96],[0.48,0.83,-0.28],[-0.86,0.47,0.19]].map(u=>{ const n = Math.hypot(...u); return u.map(t=> t/n); });
  const V = gp.map(u=> Array.from(monoVals(u, new Float64Array(15))));
  const symAt = (j, u) => { let s = 0; for (const C of ops){ const v = [C[0]*u[0] + C[1]*u[1] + C[2]*u[2], C[3]*u[0] + C[4]*u[1] + C[5]*u[2], C[6]*u[0] + C[7]*u[1] + C[8]*u[2]]; s += monoVals(v, mv)[j]; } return s/ops.length; };
  const coefOf = j => solveDense(V, gp.map(u=> symAt(j, u)), 15);
  const M = pts.length, dot = (f, g) => { let s = 0; for (let i = 0; i < M; i++) s += f[i]*g[i]; return s/M; };
  // Gram–Schmidt against the constant (the isotropic part: (x²+y²+z²)² is 1 on the sphere).
  const basis = [{ vals: pts.map(()=> 1), coef: null }], out = [];
  for (let j = 0; j < 15; j++){
    let vals = symVals(j), coef = coefOf(j);
    // (against the monomial's own size: one that averages to nothing over the group, x³y
    // in a cubic one, leaves rounding alone, not a form)
    const raw = pts.map(u=> monoVals(u, mv)[j]), n0 = Math.sqrt(dot(raw, raw));
    for (const b of basis){
      const f = dot(vals, b.vals)/dot(b.vals, b.vals);
      vals = vals.map((t, i)=> t - f*b.vals[i]);
      // the constant's coefficients: (x²+y²+z²)² on the sphere
      const bc = b.coef || MONO.map(m=> (m[0] === 4 || m[1] === 4 || m[2] === 4) ? 1 : (m.filter(e=> e === 2).length === 2 ? 2 : 0));
      coef = coef.map((t, i)=> t - f*bc[i]);
    }
    const n = Math.sqrt(dot(vals, vals));
    if (!(n > 1e-7*n0)) continue;
    basis.push({ vals, coef });
    out.push(coef.map(t=> t/n));
  }
  return out;
}

/* ---------- planar faults ----------
   faultTable(geom, plane, disp, refl) → { dLayer, terms: per reflection [[g, c], …] }:
   faults on the lattice planes of the family {plane} (conventional indices), each
   displacing the crystal beyond it by a vector of the family disp = { f, uvw } (f·⟨uvw⟩,
   conventional fractions). For each orientation p of the planes, the displacements are
   those of the family lying in the plane (shears: a stacking fault, an antiphase
   boundary), all of the family if none does; with ±R alike, so the faults broaden but
   do not shift. Across a fault, reflection h's phase jumps by 2πh·R: a column of length
   L along h's direction u crosses L|u·n_p|/d fault-able planes (d their spacing), each a
   fault with probability α, so A_F(L) = Π_p (1 − α(1 − c_p))^{L|u·n_p|/d} with c_p the
   mean of cos 2πh·R over p's displacements: e^{−κL}, a Lorentzian of FWHM κ/π in d*.
   g = |u·n_p|; c = c_p. geom: { Bm (upper-triangular, Cartesian reciprocal = B·h),
   M (conventional basis or null), laue (file-basis R's), trans (centring translations,
   file fractions) }. */
function inv3(m){
  const [a, b, c, d, e, f, g, h, i] = m, A = e*i - f*h, Bc = -(d*i - f*g), C = d*h - e*g, det = a*A + b*Bc + c*C;
  return [A/det, -(b*i - c*h)/det, (b*f - c*e)/det, Bc/det, (a*i - c*g)/det, -(a*f - c*d)/det, C/det, -(a*h - b*g)/det, (a*e - b*d)/det];
}
function faultTable(geom, plane, disp, refl){
  const { Bm, M, laue } = geom, Mi = M ? inv3(M) : null;
  const hRow = (h, R) => [h[0]*R[0] + h[1]*R[3] + h[2]*R[6], h[0]*R[1] + h[1]*R[4] + h[2]*R[7], h[0]*R[2] + h[1]*R[5] + h[2]*R[8]];
  const col = (R, t) => [R[0]*t[0] + R[1]*t[1] + R[2]*t[2], R[3]*t[0] + R[4]*t[1] + R[5]*t[2], R[6]*t[0] + R[7]*t[1] + R[8]*t[2]];
  const key = v => v.map(t=> Math.round(t*1e6)/1e6).join(',');
  // The plane and the displacement in the file's basis: h_f = h_c·M⁻¹, t_f = M·t_c.
  const hf = Mi ? hRow(plane, Mi) : plane.slice();
  const tc = disp.uvw.map(t=> t*disp.f), tf = M ? col(M, tc) : tc;
  // Orbits: planes as h·R⁻¹ (±h one plane), displacements as R·t.
  const planes = [], pk = new Set(), ts = [], tk = new Set();
  for (const R of laue){
    const Ri = inv3(R), hp = hRow(hf, Ri), k1 = key(hp), k2 = key(hp.map(t=> -t));
    if (!pk.has(k1) && !pk.has(k2)){ pk.add(k1); planes.push(hp); }
    const tp = col(R, tf), k3 = key(tp);
    if (!tk.has(k3)){ tk.add(k3); ts.push(tp); }
  }
  for (const t of ts.slice()){ const k = key(t.map(x=> -x)); if (!tk.has(k)){ tk.add(k); ts.push(t.map(x=> -x)); } }
  const B = Bm, cart = h => { const v = [B[0]*h[0] + B[1]*h[1] + B[2]*h[2], B[4]*h[1] + B[5]*h[2], B[8]*h[2]], n = Math.hypot(...v); return v.map(t=> t/n); };
  const per = planes.map(hp=>{
    const inPlane = ts.filter(t=> Math.abs(hp[0]*t[0] + hp[1]*t[1] + hp[2]*t[2]) < 1e-6);
    return { n: cart(hp), R: inPlane.length ? inPlane : ts };
  });
  // The planes' spacing: the smallest non-zero projection of a lattice translation (the
  // cell's, and the centring's) on their normal.
  const Bi = inv3(B), dirCart = t => [Bi[0]*t[0] + Bi[3]*t[1] + Bi[6]*t[2], Bi[1]*t[0] + Bi[4]*t[1] + Bi[7]*t[2], Bi[2]*t[0] + Bi[5]*t[1] + Bi[8]*t[2]];
  const n0 = per[0].n, trans = [[0, 0, 0], ...(geom.trans || [])];
  let dLayer = Infinity;
  for (const c of trans) for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) for (let w = -2; w <= 2; w++){
    const t = dirCart([u + c[0], v + c[1], w + c[2]]), p = Math.abs(t[0]*n0[0] + t[1]*n0[1] + t[2]*n0[2]);
    if (p > 1e-6 && p < dLayer) dLayer = p;
  }
  const terms = refl.map(h=>{
    const u = cart(h), by = new Map();
    for (const { n, R } of per){
      const g = Math.abs(u[0]*n[0] + u[1]*n[1] + u[2]*n[2]);
      if (g < 1e-12) continue;
      let c = 0; for (const t of R) c += Math.cos(2*Math.PI*(h[0]*t[0] + h[1]*t[1] + h[2]*t[2]));
      c /= R.length;
      if (1 - c < 1e-9) continue;
      const k = Math.round(c*1e9)/1e9;
      by.set(k, (by.get(k) || 0) + g);
    }
    return [...by].map(([c, g])=> [g, c]);
  });
  return { dLayer, terms, planes: per.length };
}
// κ(α) of one reflection (Å⁻¹): the exponent of its fault coefficient e^{−κL}.
function faultKappa(table, r, alpha){
  if (!(alpha > 0)) return 0;
  let s = 0;
  for (const [g, c] of table.terms[r]) s -= g*Math.log(Math.max(1e-12, 1 - alpha*(1 - c)));
  return s/table.dLayer;
}

export { wppmLine, addMemberCoef, covBase, supportOf, quarticInvariants, evalQuartic, faultTable, faultKappa, gaussLegendre as glNodes };
