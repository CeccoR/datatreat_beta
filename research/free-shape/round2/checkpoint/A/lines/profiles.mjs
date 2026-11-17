/* Track A's own size lines, written here from the definitions (no import of the generator or
   the engine): the exact size line of a member in reduced units, the TCH pseudo-Voigt the
   engine draws, and least-squares fits of one to the other.

   Reduced units. A member's common-volume function A(L) ends at its support T. With ξ = L/T,
   the solid's shape along the member is a function of ξ ∈ [0, 1] alone, given the reduced
   ratios:
   - ball (sphere, ellipsoid, spheroid; any direction): A = 1 − 3ξ/2 + ξ³/2, no ratio;
   - box: A = (1 − ξ)(1 − βξ)(1 − γξ), with the direction's components in the body's scaled
     axes sorted a ≥ b ≥ c and β = b/a, γ = c/a (two ratios, 1 ≥ β ≥ γ ≥ 0);
   - cylinder (and elliptic cylinder, after the affine map): the direction at ψ from the axis
     in the scaled body (c = cos ψ along it, s = sin ψ across), ℓ in base units,
     A = (1 − ℓc)·(2/π)(acos ℓs − ℓs√(1 − ℓ²s²)), T = 1/max(c, s) (one ratio).
   ⟨L⟩_V = 2∫A dL. The line P(s) = 2∫A cos(2πsL) dL, in x = s·⟨L⟩_V, is p(x) = P/⟨L⟩_V: unit
   area and unit peak (integral breadth 1) for every solid. A pseudo-Voigt of Gaussian and
   Lorentzian FWHM g and l (in 1/⟨L⟩_V) is the engine's line for that size part. */

export const LN2 = Math.LN2;
// Gauss–Legendre, 16 nodes
const GL = (()=> {
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
// nodes and weights on [0, T] (panels × 16)
export function nodes(T, panels = 48){
  const u = [], w = [], h = T/panels;
  for (let p = 0; p < panels; p++){ const m = p*h + h/2; for (let k = 0; k < 16; k++){ u.push(m + h/2*GL.t[k]); w.push(GL.w[k]*h/2); } }
  return { u, w };
}

/* The reduced solid along a member: { A(ξ) on [0, 1], dA0 (A′(0) in ξ), kind, ratios } */
export function ballA(){ return { kind: 'ball', A: x => x >= 1 ? 0 : 1 - 1.5*x + 0.5*x*x*x, dA0: -1.5 }; }
export function boxA(beta, gamma){
  return { kind: 'box', beta, gamma, A: x => x >= 1 ? 0 : (1 - x)*(1 - beta*x)*(1 - gamma*x), dA0: -(1 + beta + gamma) };
}
export function cylA(psi){
  const c = Math.cos(psi), s = Math.sin(psi), T = 1/Math.max(c, s);
  const A = x => { const l = x*T, z = 1 - l*c, d = l*s; if (z <= 0 || d >= 1) return 0; return z*(2/Math.PI)*(Math.acos(d) - d*Math.sqrt(1 - d*d)); };
  return { kind: 'cyl', psi, A, dA0: -T*(c + 4*s/Math.PI) };
}

/* reduce(sol) → { Lv (⟨L⟩_V in T), La (⟨L⟩_A = −1/A′(0), in T), p(x) (the unit line in
   x = s·⟨L⟩_V), coefficients }: the Fourier transform by Gauss–Legendre over the support. */
export function reduce(sol, panels = 48){
  const { u, w } = nodes(1, panels);
  const Au = u.map(sol.A);
  let I = 0; for (let k = 0; k < u.length; k++) I += w[k]*Au[k];
  const Lv = 2*I, La = -1/sol.dA0;
  // in reduced length v = ξ/Lv: p(x) = 2∫ A cos(2πxv) dv = (2/Lv)∫ A(ξ) cos(2πxξ/Lv) dξ
  const vv = u.map(x=> x/Lv), ww = w.map((t, k)=> 2*t*Au[k]/Lv);
  const p = x => { let s = 0; const k2 = 2*Math.PI*x; for (let k = 0; k < vv.length; k++) s += ww[k]*Math.cos(k2*vv[k]); return s; };
  return { Lv, La, LaV: La/Lv, p, sol };
}

/* The TCH pseudo-Voigt (Thompson, Cox & Hastings 1987), as published: FWHM H and mixing η of
   the Voigt with Gaussian and Lorentzian FWHM G and L; and the unit-area pV at x. */
export function tch(G, L){
  const g2 = G*G, g3 = g2*G, g4 = g3*G, l2 = L*L, l3 = l2*L, l4 = l3*L;
  const H = Math.pow(g4*G + 2.69269*g4*L + 2.42843*g3*l2 + 4.47163*g2*l3 + 0.07842*G*l4 + l4*L, 0.2);
  const q = L/H;
  return { H, eta: Math.min(1, Math.max(0, 1.36603*q - 0.47719*q*q + 0.11116*q*q*q)) };
}
export function pv(x, H, eta){
  const d = x/H;
  return eta*2/(Math.PI*H)/(1 + 4*d*d) + (1 - eta)*2*Math.sqrt(LN2/Math.PI)/H*Math.exp(-4*LN2*d*d);
}
export const pvGL = (x, g, l) => { const { H, eta } = tch(g, l); return pv(x, H, eta); };

/* The sampling of a fit: x from 0 to X (the line is even), weights 1/(p + b) (Poisson over a
   flat background b, the peak being 1), the end points halved. */
export function sample(red, { X = 6, n = 600, b = 0.2 } = {}){
  const xs = [], ys = [], ws = [];
  for (let i = 0; i <= n; i++){ const x = X*i/n, y = red.p(x); xs.push(x); ys.push(y); ws.push((i === 0 ? 0.5 : 1)/(Math.max(y, 0) + b)); }
  return { xs, ys, ws };
}
export const cost = (S, f) => { let c = 0; for (let i = 0; i < S.xs.length; i++){ const r = S.ys[i] - f(S.xs[i]); c += S.ws[i]*r*r; } return c; };
export const maxDev = (S, f) => { let m = 0; for (let i = 0; i < S.xs.length; i++) m = Math.max(m, Math.abs(S.ys[i] - f(S.xs[i]))); return m; };

/* Least squares in two parameters (Levenberg–Marquardt, numeric Jacobian, bounds ≥ lo). */
export function lm2(S, model, p0, { lo = [0, 0], iters = 200 } = {}){
  let p = p0.slice(), c = cost(S, x=> model(x, p)), lam = 1e-3;
  for (let it = 0; it < iters; it++){
    const J = [], r = [];
    const f0 = S.xs.map(x=> model(x, p));
    for (let j = 0; j < 2; j++){
      const h = 1e-6*Math.max(1e-3, Math.abs(p[j])), q = p.slice(); q[j] += h;
      J.push(S.xs.map((x, i)=> (model(x, q) - f0[i])/h));
    }
    for (let i = 0; i < S.xs.length; i++) r.push(S.ys[i] - f0[i]);
    let A = [[0, 0], [0, 0]], g = [0, 0];
    for (let i = 0; i < r.length; i++) for (let a = 0; a < 2; a++){ g[a] += S.ws[i]*J[a][i]*r[i]; for (let b2 = 0; b2 < 2; b2++) A[a][b2] += S.ws[i]*J[a][i]*J[b2][i]; }
    let improved = false;
    for (let t = 0; t < 30; t++){
      const M = [[A[0][0]*(1 + lam), A[0][1]], [A[1][0], A[1][1]*(1 + lam)]], det = M[0][0]*M[1][1] - M[0][1]*M[1][0];
      const d = [(g[0]*M[1][1] - g[1]*M[0][1])/det, (M[0][0]*g[1] - M[1][0]*g[0])/det];
      const q = [Math.max(lo[0], p[0] + d[0]), Math.max(lo[1], p[1] + d[1])], cq = cost(S, x=> model(x, q));
      if (cq < c){ const rel = (c - cq)/c; p = q; c = cq; lam = Math.max(1e-9, lam/5); improved = true; if (rel < 1e-13) it = iters; break; }
      lam *= 5;
    }
    if (!improved) break;
  }
  return { p, c };
}
/* One-parameter fit of the width scale k of a fixed line shape f(x/k)/k (area 1): what that
   line reads, ⟨L⟩_V read/true = 1/k. Golden section on ln k. */
export function readScale(S, shape){
  const f = k => cost(S, x=> shape(x/k)/k);
  let a = Math.log(0.5), b = Math.log(2), gr = (Math.sqrt(5) - 1)/2;
  let c = b - gr*(b - a), d = a + gr*(b - a), fc = f(Math.exp(c)), fd = f(Math.exp(d));
  for (let i = 0; i < 80; i++){
    if (fc < fd){ b = d; d = c; fd = fc; c = b - gr*(b - a); fc = f(Math.exp(c)); }
    else { a = c; c = d; fc = fd; d = a + gr*(b - a); fd = f(Math.exp(d)); }
  }
  const k = Math.exp((a + b)/2);
  return { k, read: 1/k, c: f(k) };
}

/* The size line's (g, l) by the two moments (b1): the Lorentzian part from the Porod tail
   (−A′(0) = 1/⟨L⟩_A: P(s) → 1/(2π²⟨L⟩_A s²), a Lorentzian of FWHM l → l/(2πs²)), so
   l = ⟨L⟩_V/(π⟨L⟩_A); the Gaussian part so that the TCH line's peak is 1 (integral breadth
   1/⟨L⟩_V, the exact line's). */
export function momentsGL(red){
  const l = 1/(Math.PI*red.LaV);
  let lo = 0, hi = 3;
  if (pvGL(0, 0, l) < 1) return { g: 0, l, short: true };     // a Lorentzian of that l is already broader
  for (let it = 0; it < 100; it++){ const m = (lo + hi)/2; if (pvGL(0, m, l) > 1) lo = m; else hi = m; }
  return { g: (lo + hi)/2, l };
}
/* The best TCH line of unit area (b2): (g, l) by weighted least squares. */
export function lsqGL(red, opts = {}, p0 = null){
  const S = sample(red, opts);
  const m = momentsGL(red);
  const f = lm2(S, (x, p)=> pvGL(x, p[0], p[1]), p0 || [Math.max(0.05, m.g), m.l]);
  return { g: f.p[0], l: f.p[1], c: f.c };
}
