/* Exact common-volume functions A(L) of the solids (A(0) = 1, 2∫A dL = ⟨L⟩_V), written from
   the solid's dimensions and orientation, with the engine's conventions (RIETVELD.md §10.2,
   §10.3; xrd-rietveld.js BODIES):
   - dims (Å) along the body's own axes x, y, z: a box's edges, an ellipsoid's full axes
     (diameters), a cylinder's diameter (x = y) and height (z, the axis), an elliptic
     cylinder's two full section axes (x, y) and height (z). Two-parameter solids
     (sqbox, spheroid, cylinder) have dims[0] = dims[1]; a sphere all three equal.
   - R (row-major 3×3, its columns the body axes in the crystal's Cartesian frame, the
     engine's: x ∥ a*, y in the a*b* plane, z ∥ c): body → Cartesian. A Cartesian
     direction n is m = Rᵀn in the body.
   Forms (ℓ ≥ 0; (·)₊ = max(·, 0)):
   - box: Π (1 − L|mᵢ|/aᵢ)₊;
   - ellipsoid/spheroid/sphere: 1 − 3x/2 + x³/2, x = L·|diag(1/D) m| (0 past x = 1);
   - cylinder/elliptic cylinder: (1 − L|m_z|/H)₊ · (2/π)(acos ρ − ρ√(1 − ρ²)), ρ = L·|(m_x/D_x,
     m_y/D_y)|: the overlap of two (affine) unit-diameter discs ρ apart over the disc's area.
   A size distribution (σ > 0): a log-normal in the solid's scale s, volume-weighted, with
   the number-weighted median e^{−3.5σ²} (volume-weighted ln s ~ N(−σ²/2, σ²), E_V[s] = 1):
   A(L) = E_V[A₁(L/s)], so ⟨L⟩_V is the dims' in every direction (the engine's WPPM reads
   dims so: xrd-rietveld wppmLineOf, toMedian). Pure functions, no engine import. */

export const BASE = { box: 'cube', sqbox: 'cube', ellipsoid: 'ball', spheroid: 'ball', sphere: 'ball', cylinder: 'cylinder', ellcyl: 'cylinder' };

// R as row-major flat 9 from flat or nested [[r00, r01, r02], …]
export const flatR = R => (Array.isArray(R[0]) ? R.flat() : Array.from(R)).map(Number);
const rt = (R, n) => [R[0]*n[0] + R[3]*n[1] + R[6]*n[2], R[1]*n[0] + R[4]*n[1] + R[7]*n[2], R[2]*n[0] + R[5]*n[1] + R[8]*n[2]];

/* body(type, dimsÅ, R, sigma = 0) → { type, base, D, R, sigma } (checks the conventions) */
export function body(type, D, R, sigma = 0){
  const base = BASE[type];
  if (!base) throw new Error('unknown solid ' + type);
  D = (typeof D === 'number' ? [D, D, D] : D.length === 1 ? [D[0], D[0], D[0]] : D).map(Number);
  if (D.length !== 3 || !D.every(d=> d > 0)) throw new Error('dims: three positive lengths');
  const tie = (a, b) => Math.abs(a - b) <= 1e-9*Math.max(a, b);
  if (['sqbox', 'spheroid', 'cylinder'].includes(type) && !tie(D[0], D[1])) throw new Error(type + ': dims[0] must equal dims[1]');
  if (type === 'sphere' && !(tie(D[0], D[1]) && tie(D[0], D[2]))) throw new Error('sphere: three equal dims');
  R = R ? flatR(R) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return { type, base, D, R, sigma: +sigma || 0 };
}

/* along(b, n) → { A(L) (single crystallite, L in the dims' unit), T (where A reaches 0),
   m (direction in the body) } for the unit Cartesian direction n. */
export function along(b, n){
  const nn = Math.hypot(n[0], n[1], n[2]), m = rt(b.R, [n[0]/nn, n[1]/nn, n[2]/nn]), [Dx, Dy, Dz] = b.D;
  if (b.base === 'cube'){
    const p = Math.abs(m[0])/Dx, q = Math.abs(m[1])/Dy, r = Math.abs(m[2])/Dz, T = 1/Math.max(p, q, r);
    return { T, m, A: L => L >= T ? 0 : (1 - L*p)*(1 - L*q)*(1 - L*r) };
  }
  if (b.base === 'ball'){
    const g = Math.hypot(m[0]/Dx, m[1]/Dy, m[2]/Dz), T = 1/g;
    return { T, m, A: L => { const x = L*g; return x >= 1 ? 0 : 1 - 1.5*x + 0.5*x*x*x; } };
  }
  const c = Math.abs(m[2])/Dz, s = Math.hypot(m[0]/Dx, m[1]/Dy), T = 1/Math.max(c, s);
  return { T, m, A: L => {
    const z = 1 - L*c, d = L*s;
    if (z <= 0 || d >= 1) return 0;
    return z*(2/Math.PI)*(Math.acos(d) - d*Math.sqrt(1 - d*d));
  } };
}

/* The log-normal average, tabulated: E_V[A₁(L/s)], ln s ~ N(−σ²/2, σ²), by the trapezoid
   rule in z = (ln s + σ²/2)/σ over ±7 (NZ points), on NL points of L from 0 to T·e^{−σ²/2 + 6.5σ}
   (beyond: under 10⁻¹⁰), read by cubic (Catmull–Rom) interpolation. */
const NZ = 281, NL = 800, ZMAX = 7, ZL = 6.5;
function mixTable(a, sigma){
  const zs = [], ws = [];
  for (let k = 0; k < NZ; k++){ const z = -ZMAX + 2*ZMAX*k/(NZ - 1); zs.push(Math.exp(-(-0.5*sigma*sigma + sigma*z))); ws.push(Math.exp(-0.5*z*z)*(k === 0 || k === NZ - 1 ? 0.5 : 1)); }
  const wsum = ws.reduce((t, w)=> t + w, 0);
  const Lmax = a.T*Math.exp(-0.5*sigma*sigma + ZL*sigma), dL = Lmax/(NL - 1), tab = new Float64Array(NL + 3);
  for (let i = 0; i < NL + 3; i++){
    const L = (i - 1)*dL;
    if (L <= 0){ tab[i] = 1; continue; }
    let t = 0; for (let k = 0; k < NZ; k++) t += ws[k]*a.A(L*zs[k]);
    tab[i] = t/wsum;
  }
  tab[0] = 2*tab[1] - tab[2];   // (an even function's mirror is not smooth at 0: linear)
  return L => {
    if (L >= Lmax) return 0;
    const f = L/dL, j = Math.floor(f) + 1, u = f - (j - 1);
    const p0 = tab[j - 1], p1 = tab[j], p2 = tab[j + 1], p3 = tab[j + 2];
    return p1 + 0.5*u*(p2 - p0 + u*(2*p0 - 5*p1 + 4*p2 - p3 + u*(3*(p1 - p2) + p3 - p0)));
  };
}
/* kernel(b, n) → { A(L), T (support, ∞-safe bound), Lv } for the body (its σ included):
   the size line's Fourier coefficients along n, and its ⟨L⟩_V = 2∫A dL by quadrature. */
export function kernel(b, n){
  const a = along(b, n);
  const A = b.sigma > 1e-6 ? mixTable(a, b.sigma) : a.A;
  const T = b.sigma > 1e-6 ? a.T*Math.exp(-0.5*b.sigma*b.sigma + ZL*b.sigma) : a.T;
  return { A, T, m: a.m, Lv: 2*integrate(A, T) };
}
// ∫₀^T f by Gauss–Legendre, 64 panels of 16 nodes (a cylinder's (1 − ρ)^{3/2} end in a few)
const GL16 = (()=> {
  const n = 16, t = [], w = [];
  for (let i = 1; i <= n; i++){
    let x = Math.cos(Math.PI*(i - 0.25)/(n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++){
      let p0 = 1, p1 = x;
      for (let k = 2; k <= n; k++){ const p2 = ((2*k - 1)*x*p1 - (k - 1)*p0)/k; p0 = p1; p1 = p2; }
      dp = n*(x*p1 - p0)/(x*x - 1);
      const dx = p1/dp; x -= dx; if (Math.abs(dx) < 1e-16) break;
    }
    t.push(x); w.push(2/((1 - x*x)*dp*dp));
  }
  return { t, w };
})();
export function integrate(f, T, panels = 64){
  let s = 0; const h = T/panels;
  for (let p = 0; p < panels; p++){
    const a = p*h, m = a + h/2;
    for (let k = 0; k < 16; k++) s += GL16.w[k]*f(m + h/2*GL16.t[k]);
  }
  return s*h/2;
}

/* ---------- an independent check: the common volume by Monte Carlo ----------
   mcCommon(type, D, m, L, N, U) → the fraction of N points drawn uniformly in the body
   (rejection from its bounding box, in the body's own frame, half-dims from D) whose
   translate by L·m (m a unit vector in the body frame) is still inside; with its standard
   error. The bodies' inside tests are written here from their definitions, not from the
   forms above. */
export function mcCommon(type, D, m, L, N, U){
  const h = D.map(d=> d/2), base = BASE[type];
  const inside = base === 'cube' ? (x, y, z)=> Math.abs(x) <= h[0] && Math.abs(y) <= h[1] && Math.abs(z) <= h[2]
    : base === 'ball' ? (x, y, z)=> (x/h[0])**2 + (y/h[1])**2 + (z/h[2])**2 <= 1
    : (x, y, z)=> (x/h[0])**2 + (y/h[1])**2 <= 1 && Math.abs(z) <= h[2];
  let n = 0, hit = 0;
  while (n < N){
    const x = (2*U() - 1)*h[0], y = (2*U() - 1)*h[1], z = (2*U() - 1)*h[2];
    if (!inside(x, y, z)) continue;
    n++;
    if (inside(x + L*m[0], y + L*m[1], z + L*m[2])) hit++;
  }
  const p = hit/N;
  return { A: p, se: Math.sqrt(Math.max(p*(1 - p), 1/N)/N) };
}
