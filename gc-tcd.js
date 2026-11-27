/* =========================================================
   GC-TCD PEAK INTEGRATION ENGINE (v544)
   A port, as it is, of the H₂/O₂ part of the Python v2.1 integration of the TCD
   chromatograms (forma_universale.py / reintegra_tcd.py v2.1): the 8-parameter peak shape (two
   equal Gaussians, the second shifted, convolved with two exponential tails), the electrical
   spike finder, the two-pass fit (robust soft-L1 pass to find narrow glitches, then ordinary
   least squares without them, restarted from the generic start when the result looks
   suspicious), scipy's least_squares(method='trf') with bounds, x_scale and the block
   Jacobian. Output only for H2 and O2: the system peak at 310 s and the baseline step after
   O2 are fitted because the fit needs them, and returned for display; they are not gases.
   v2.1's classical trapezoids, a check beside the fit, are left out (from v545), as are N₂,
   the column-order check (trova_ordine: the columns are taken in the table's order) and the
   standards' column alignment (the levels are typed).
   Pure ES module: no DOM, no import; runs in Node, in the page and in a worker.

   Where it departs from scipy/numpy, at the rounding level only: the SVD of the augmented
   Jacobian by Householder QR then one-sided Jacobi, pinv(JᵀJ) by a Jacobi eigen-
   decomposition, sequential dot products, W. J. Cody's erfc/erfcx (relative error ≤ 9e-16 on
   the model's branches), np.sum and np.mean in numpy's own pairwise
   order (checked bit for bit). As in scipy, the soft-L1 loss
   applies to every residual, the priors' too (the Python's comment says the data only), so
   that the same minima are found. transferK leaves non-finite areas out (numpy's median would
   give NaN). The noise is v2.1's (MAD of the differences over the window, peak flanks
   included: on strong synthetic peaks it reads 1.6 × the true noise, so χ²ᵣ reads low); kept,
   since the glitch thresholds and the restart rule are scaled to it.
   Checked against v2.1 on 411 real chromatograms (377 of runs, 34 standards): on the runs the
   areas agree to 5.5e-6 (H₂) and 2.5e-5 (O₂) relative at most, about what v2.1 differs from
   itself by with its data moved by one ulp (1.3e-5, 2.4e-5), the apex times identical, the
   spikes and the glitch zones the same. Some fits of large O₂ standards are fragile in v2.1 itself (the
   robust pass stops at its 100th evaluation and the minimum reached then depends on rounding:
   up to about 2 % in O₂); JS lands on outcomes v2.1 also gives under a one-ulp change. About
   0.16 s a chromatogram in V8, 1.8 × faster than v2.1.
========================================================= */
const SQ2 = Math.SQRT2;                 // np.sqrt(2.0)
const EPS = 2.220446049250313e-16;      // np.finfo(float).eps

/* ---------------------------------------------------------
   The method: windows, peaks, steps, fit settings
   (the numbers of reintegra_tcd.py v2.1, CFG and fit_picchi/_fit defaults)
--------------------------------------------------------- */
const deepFreeze = o =>{ if (o && typeof o === 'object' && !Object.isFrozen(o)){ Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
/* The engine's id (v588), part of the key the app keeps each result under (gc-integ-model.js
   keyOf): a project's result of another engine, or of none (saved to v587), is never taken, its
   chromatogram integrated again as the project opens. A new one with any change to this file or
   to gc-tcd.worker.js (tests/gctcd-engine.test.mjs holds their hash beside it). */
export const ENGINE_ID = 'tcd-1';
/* Frozen throughout: a variant is made from a copy, structuredClone(DEFAULT_METHOD). Its JSON
   is part of the key the app keeps the results under (gc-integ-model.js methodKey): any change
   to it, even of a setting no fit reads, fits every saved project again. */
export const DEFAULT_METHOD = deepFreeze({
  windows: [{ key: 'H2O2', from: 268, to: 326, baseDegree: 1,
    peaks: [{ name: 'H2', t: 287.3, gas: 'h2' }, { name: 'O2', t: 302.3, gas: 'o2' }, { name: 'S310', t: 310.2, gas: null }],
    steps: [{ from: 303, to: 309, prior: { h: -13, hSd: 3, t0: 305.6, t0Sd: 0.6 } }] }],
  // area -> %mol from the GC software's table (esegui): median of area/%mol over the
  // injections whose table value is at least minValue, when there are minCount of them
  transfer: { h2: { minValue: 0.02, minCount: 10 }, o2: { minValue: 0.012, minCount: 10 } },
  fit: {
    shiftAllowance: 1.5,      // larghezza_mu: mu within the local maximum ± this (s)
    priorWeight: 1.0,         // peso_prior
    apexSearch: 1.5,          // start: the local maximum within ± this of the nominal time (s)
    apexSnr: 5,               // ... used when it rises more than this × noise above the start baseline
    maskGlitches: true,       // maschera_disturbi: robust pass + exclusion of narrow glitches
    robustLoss: 'soft_l1', robustFScale: 3.0, maxNfev: 2000, maxNfevRobust: 100,
    glitch: { noiseTimes: 25, localFraction: 0.25, groupGap: 3, maxWidth: 1.4, near: 1.0, nearFraction: 0.5, pad: 0.6 },
    restart: { chi2r: 4.0, stepSds: 3 },
    spikes: { threshold: 10, fraction: 0.25, roundsFit: 6 },
    step: { width: 0.8, widthMin: 0.15, widthMax: 3.0, widthLogSd: 0.5 },
    apexGrid: 0.02,           // t_apice: argmax of the unit-area shape on this grid (s)
  },
});

/* The peak shape's internal parameters after A and mu, their weak priors, limits and
   start (forma_universale.py: INT, PRIOR, LIMITI, INIZIO). ls = ln sigma, dm = dmu/sigma,
   lr1 = ln(tau1/sigma), lr2 = ln((tau2 − tau1)/sigma). */
const SHAPE = deepFreeze({
  internal: ['ls', 'dm', 'fc', 'lr1', 'lr2', 'w2'],
  log: ['ls', 'lr1', 'lr2'],
  prior: { ls: [0.5, 0.5], dm: [0.0, 0.7], fc: [0.0, 0.4], lr1: [1.0, 0.7], lr2: [4.0, 0.5], w2: [0.07, 0.03] },
  limits: { ls: [0.15, 1.2], dm: [-3.0, 3.0], fc: [0.0, 0.9], lr1: [0.05, 3.0], lr2: [0.5, 8.0], w2: [0.0, 0.5] },
  start: { ls: 0.5, dm: 0.9, fc: 0.2, lr1: 0.8, lr2: 1.5, w2: 0.15 },
});
const NP = 8, NPR = 6;
const INT = SHAPE.internal;
const isLog = c => SHAPE.log.includes(c);
const v_ = (c, x)=> isLog(c) ? Math.log(x) : x;
const PRIOR_MEAN = INT.map(c=> v_(c, SHAPE.prior[c][0])), PRIOR_SD = INT.map(c=> SHAPE.prior[c][1]);
const LIM_LO = INT.map(c=> v_(c, SHAPE.limits[c][0])), LIM_HI = INT.map(c=> v_(c, SHAPE.limits[c][1]));
const START = INT.map(c=> v_(c, SHAPE.start[c]));

/* ---------------------------------------------------------
   numpy's reductions, where their order matters
--------------------------------------------------------- */
// np.sum of a float64 array: numpy's pairwise summation (blocks of 8, split above 128).
function pairwise(a, i0, n){
  if (n < 8){ let r = 0; for (let i = 0; i < n; i++) r += a[i0 + i]; return r; }
  if (n <= 128){
    let r0 = a[i0], r1 = a[i0 + 1], r2 = a[i0 + 2], r3 = a[i0 + 3], r4 = a[i0 + 4], r5 = a[i0 + 5], r6 = a[i0 + 6], r7 = a[i0 + 7];
    let i = 8; const e = n - (n % 8);
    for (; i < e; i += 8){
      r0 += a[i0 + i]; r1 += a[i0 + i + 1]; r2 += a[i0 + i + 2]; r3 += a[i0 + i + 3];
      r4 += a[i0 + i + 4]; r5 += a[i0 + i + 5]; r6 += a[i0 + i + 6]; r7 += a[i0 + i + 7];
    }
    let r = ((r0 + r1) + (r2 + r3)) + ((r4 + r5) + (r6 + r7));
    for (; i < n; i++) r += a[i0 + i];
    return r;
  }
  let n2 = Math.floor(n/2); n2 -= n2 % 8;
  return pairwise(a, i0, n2) + pairwise(a, i0 + n2, n - n2);
}
const npSum = a => pairwise(a, 0, a.length);
const npMean = a => pairwise(a, 0, a.length)/a.length;
// np.median: the middle value, or the mean of the two middle values.
function median(a){
  const s = Float64Array.from(a).sort(), n = s.length;
  if (!n) return NaN;
  const h = n >> 1;
  return n % 2 ? s[h] : (s[h - 1] + s[h])/2;
}
// The noise of a trace: MAD of the first differences / √2 (1.4826 MAD = σ).
function diffNoise(y){
  if (y.length < 2) return NaN;
  const d = new Float64Array(y.length - 1);
  for (let i = 0; i < d.length; i++) d[i] = y[i + 1] - y[i];
  const md = median(d);
  for (let i = 0; i < d.length; i++) d[i] = Math.abs(d[i] - md);
  return 1.4826*median(d)/SQ2;
}

/* ---------------------------------------------------------
   erfc, erfcx: W. J. Cody's rational Chebyshev approximations (CALERF, netlib specfun),
   against scipy.special a relative error of 9e-16 at most on the branches the model takes
   (erfcx at x ≥ 0, erfc below 0; 17,000 points from −30 to 1e8), 6e-14 elsewhere, where
   exp(−x²) itself loses as much. The coefficients are Cody's, written in their shortest
   round-trip form (the same doubles).
--------------------------------------------------------- */
const CA = [3.1611237438705655, 113.86415415105016, 377.485237685302, 3209.3775891384694, 0.18577770618460315];
const CB = [23.601290952344122, 244.02463793444417, 1282.6165260773723, 2844.236833439171];
const CC = [0.5641884969886701, 8.883149794388377, 66.11919063714163, 298.6351381974001, 881.952221241769,
  1712.0476126340707, 2051.0783778260716, 1230.3393547979972, 2.1531153547440383e-8];
const CD = [15.744926110709835, 117.6939508913125, 537.1811018620099, 1621.3895745666903, 3290.7992357334597,
  4362.619090143247, 3439.3676741437216, 1230.3393548037495];
const CP = [0.30532663496123236, 0.36034489994980445, 0.12578172611122926, 0.016083785148742275, 0.0006587491615298378, 0.016315387137302097];
const CQ = [2.568520192289822, 1.8729528499234673, 0.5279051029514285, 0.06051834131244132, 0.0023352049762686918];
const SQRPI = 0.5641895835477563;   // 1/sqrt(pi)
const THRESH = 0.46875, XSMALL = 1.11e-16, XBIG = 26.543, XHUGE = 6.71e7, XMAX = 2.53e307, XNEG = -26.628;
// jint 1: erfc, 2: erfcx = exp(x²) erfc(x) (CALERF's 0, erf, the model never needs)
function calerf(x, jint){
  if (Number.isNaN(x)) return NaN;
  const y = Math.abs(x);
  let result, ysq, xnum, xden, del;
  if (y <= THRESH){
    ysq = 0; if (y > XSMALL) ysq = y*y;
    xnum = CA[4]*ysq; xden = ysq;
    for (let i = 0; i < 3; i++){ xnum = (xnum + CA[i])*ysq; xden = (xden + CB[i])*ysq; }
    result = 1 - x*(xnum + CA[3])/(xden + CB[3]);
    if (jint === 2) result = Math.exp(ysq)*result;
    return result;
  }
  if (y <= 4){
    xnum = CC[8]*y; xden = y;
    for (let i = 0; i < 7; i++){ xnum = (xnum + CC[i])*y; xden = (xden + CD[i])*y; }
    result = (xnum + CC[7])/(xden + CD[7]);
    if (jint !== 2){ ysq = Math.trunc(y*16)/16; del = (y - ysq)*(y + ysq); result = Math.exp(-ysq*ysq)*Math.exp(-del)*result; }
  } else {
    result = 0;
    let done = false;
    if (y >= XBIG){
      if (jint !== 2 || y >= XMAX) done = true;
      else if (y >= XHUGE){ result = SQRPI/y; done = true; }
    }
    if (!done){
      ysq = 1/(y*y);
      xnum = CP[5]*ysq; xden = ysq;
      for (let i = 0; i < 4; i++){ xnum = (xnum + CP[i])*ysq; xden = (xden + CQ[i])*ysq; }
      result = ysq*(xnum + CP[4])/(xden + CQ[4]);
      result = (SQRPI - result)/y;
      if (jint !== 2){ ysq = Math.trunc(y*16)/16; del = (y - ysq)*(y + ysq); result = Math.exp(-ysq*ysq)*Math.exp(-del)*result; }
    }
  }
  if (jint === 1){ if (x < 0) result = 2 - result; }
  else if (x < 0){
    if (x < XNEG) result = Infinity;
    else { ysq = Math.trunc(x*16)/16; del = (x - ysq)*(x + ysq); const e = Math.exp(ysq*ysq)*Math.exp(del); result = (e + e) - result; }
  }
  return result;
}
export const erfc = x => calerf(x, 1);
export const erfcx = x => calerf(x, 2);

/* ---------------------------------------------------------
   The peak model
--------------------------------------------------------- */
// Gaussian (centre mu, width s) convolved with a right exponential tail (constant tau), area 1;
// the stable form of forma_universale.emg: the erfcx branch where the exponential would blow up.
function emg1(t, mu, s, tau){
  const x = (t - mu)/s;
  const z = (s/tau - x)/SQ2;
  if (z >= 0) return 0.5/tau*Math.exp(-0.5*x*x)*erfcx(z);
  if (z < 0){ const r = s/tau; return 0.5/tau*Math.exp(0.5*(r*r) - x*s/tau)*erfc(z); }
  return NaN;
}
export function emg(t, mu, s, tau){
  if (typeof t === 'number') return emg1(t, mu, s, tau);
  const out = new Float64Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = emg1(t[i], mu, s, tau);
  return out;
}
// Internal vector [A, mu, ls, dm, fc, lr1, lr2, w2] → physical parameters (parametri).
export function physical(q, o = 0){
  const s = Math.exp(q[o + 2]), t1 = s*Math.exp(q[o + 5]);
  return { A: q[o], mu: q[o + 1], sigma: s, dmu: q[o + 3]*s, fc: q[o + 4], tau1: t1, tau2: t1 + s*Math.exp(q[o + 6]), w2: q[o + 7] };
}
// picco(): area A, two equal Gaussians (the second shifted by dmu, weight fc) × two tails.
function peakInto(out, t, n, A, mu, sigma, dmu, fc, tau1, tau2, w2){
  const a1 = 1.0 - fc, a2 = fc, m2 = mu + dmu, cw = 1.0 - w2;
  let any = false;
  if (a1 > 0){ any = true; for (let i = 0; i < n; i++){ const ti = t[i]; out[i] = a1*(cw*emg1(ti, mu, sigma, tau1) + w2*emg1(ti, mu, sigma, tau2)); } }
  if (a2 > 0){
    if (any) for (let i = 0; i < n; i++){ const ti = t[i]; out[i] = out[i] + a2*(cw*emg1(ti, m2, sigma, tau1) + w2*emg1(ti, m2, sigma, tau2)); }
    else { any = true; for (let i = 0; i < n; i++){ const ti = t[i]; out[i] = a2*(cw*emg1(ti, m2, sigma, tau1) + w2*emg1(ti, m2, sigma, tau2)); } }
  }
  if (!any) for (let i = 0; i < n; i++) out[i] = 0;
  if (A !== 1) for (let i = 0; i < n; i++) out[i] = A*out[i];
  return out;
}
// The peak of physical parameters {A, mu, sigma, dmu, fc, tau1, tau2, w2} on t.
export function peakShape(t, p){
  const tt = typeof t === 'number' ? [t] : t, out = new Float64Array(tt.length);
  peakInto(out, tt, tt.length, p.A, p.mu, p.sigma, p.dmu, p.fc, p.tau1, p.tau2, p.w2);
  return typeof t === 'number' ? out[0] : out;
}
// A baseline step: h / (1 + exp(−(t − t0)/width)).
export const step = (t, h, t0, width)=> h/(1.0 + Math.exp(-(t - t0)/width));

/* ---------------------------------------------------------
   Electrical spikes (trova_spike): a point far from the mean of its neighbours, by much
   more than the noise, the neighbours' own signal and the local slope; one point a round,
   the worst, replaced by its neighbours' mean, and the search repeated.
   Returns a Uint8Array mask (1 = spike).
--------------------------------------------------------- */
export function findSpikes(yIn, noise = null, { threshold = 10, fraction = 0.25, rounds = 3 } = {}){
  const y = Float64Array.from(yIn), n = y.length;
  if (noise == null) noise = diffNoise(y);
  const b = median(y);
  const sp = new Uint8Array(n);
  const lim = threshold*noise;
  for (let r = 0; r < rounds; r++){
    let best = -1, bestAbs = -1;
    for (let i = 1; i < n - 1; i++){
      const d = y[i] - 0.5*(y[i - 1] + y[i + 1]), ad = Math.abs(d);
      const vic = Math.max(Math.abs(y[i - 1] - b), Math.abs(y[i + 1] - b));
      const pend = Math.abs(y[i + 1] - y[i - 1]);
      if (ad > Math.max(lim, fraction*vic) && ad > 1.0*pend && ad > bestAbs){ best = i; bestAbs = ad; }
    }
    if (best < 0) break;
    y[best] = 0.5*(y[best - 1] + y[best + 1]); sp[best] = 1;
  }
  return sp;
}

/* ---------------------------------------------------------
   Linear algebra for the solver
--------------------------------------------------------- */
/* Thin SVD of an M×n matrix (column-major, M ≥ n), and Uᵀb: Householder QR, then one-sided
   Jacobi (Hestenes) on R. Returns { s (descending), V (n×n row-major: V[i*n + j] = V_ij,
   column j the j-th right singular vector), ub = Uᵀb }. */
function svdThin(A, M, n, b){
  A = Float64Array.from(A); b = Float64Array.from(b);
  const R = new Float64Array(n*n);           // column-major n×n
  for (let k = 0; k < n; k++){
    const ck = k*M;
    let nrm = 0;
    for (let i = k; i < M; i++) nrm += A[ck + i]*A[ck + i];
    nrm = Math.sqrt(nrm);
    if (nrm === 0){ for (let j = k; j < n; j++) R[j*n + k] = A[j*M + k]; continue; }
    const alpha = A[ck + k] > 0 ? -nrm : nrm;
    A[ck + k] -= alpha;                        // v = x − alpha e1 (stored in place)
    let vv = 0;
    for (let i = k; i < M; i++) vv += A[ck + i]*A[ck + i];
    if (vv > 0){
      for (let j = k + 1; j < n; j++){
        const cj = j*M; let dt = 0;
        for (let i = k; i < M; i++) dt += A[ck + i]*A[cj + i];
        const f = 2*dt/vv;
        for (let i = k; i < M; i++) A[cj + i] -= f*A[ck + i];
      }
      let dt = 0;
      for (let i = k; i < M; i++) dt += A[ck + i]*b[i];
      const f = 2*dt/vv;
      for (let i = k; i < M; i++) b[i] -= f*A[ck + i];
    }
    R[k*n + k] = alpha;
    for (let j = k + 1; j < n; j++) R[j*n + k] = A[j*M + k];
  }
  // one-sided Jacobi on the columns of R (column-major W), V accumulated (column-major)
  const W = R, V = new Float64Array(n*n);
  for (let i = 0; i < n; i++) V[i*n + i] = 1;
  for (let sweep = 0; sweep < 80; sweep++){
    let rotated = false;
    for (let p = 0; p < n - 1; p++){
      const cp = p*n;
      for (let q = p + 1; q < n; q++){
        const cq = q*n;
        let al = 0, be = 0, ga = 0;
        for (let i = 0; i < n; i++){ const x = W[cp + i], y = W[cq + i]; al += x*x; be += y*y; ga += x*y; }
        if (ga === 0 || Math.abs(ga) <= EPS*Math.sqrt(al*be)) continue;
        rotated = true;
        const zeta = (be - al)/(2*ga);
        const t = zeta >= 0 ? 1/(zeta + Math.sqrt(1 + zeta*zeta)) : -1/(-zeta + Math.sqrt(1 + zeta*zeta));
        const c = 1/Math.sqrt(1 + t*t), s = c*t;
        for (let i = 0; i < n; i++){
          const x = W[cp + i], y = W[cq + i]; W[cp + i] = c*x - s*y; W[cq + i] = s*x + c*y;
          const u = V[cp + i], w = V[cq + i]; V[cp + i] = c*u - s*w; V[cq + i] = s*u + c*w;
        }
      }
    }
    if (!rotated) break;
  }
  const sv = new Float64Array(n), u = new Float64Array(n);
  for (let j = 0; j < n; j++){
    let nn = 0, dt = 0;
    for (let i = 0; i < n; i++){ nn += W[j*n + i]*W[j*n + i]; dt += W[j*n + i]*b[i]; }
    sv[j] = Math.sqrt(nn); u[j] = sv[j] > 0 ? dt/sv[j] : 0;
  }
  const ord = Array.from({ length: n }, (_, i)=> i).sort((a, c)=> sv[c] - sv[a]);
  const s = new Float64Array(n), ub = new Float64Array(n), Vr = new Float64Array(n*n);
  ord.forEach((j, jj)=>{ s[jj] = sv[j]; ub[jj] = u[j]; for (let i = 0; i < n; i++) Vr[i*n + jj] = V[j*n + i]; });
  return { s, V: Vr, ub };
}
/* Diagonal of pinv(G), G symmetric n×n (row-major): cyclic Jacobi eigen-decomposition;
   eigenvalues of |λ| ≤ 1e-15 max|λ| dropped, as numpy's pinv (rcond 1e-15 on the
   singular values, which are |λ| for a symmetric matrix). */
function pinvDiagSym(G, n){
  const A = Float64Array.from(G), V = new Float64Array(n*n);
  for (let i = 0; i < n; i++) V[i*n + i] = 1;
  for (let sweep = 0; sweep < 80; sweep++){
    let rotated = false;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++){
      const apq = A[p*n + q];
      if (apq === 0 || Math.abs(apq) <= EPS*Math.sqrt(Math.abs(A[p*n + p]*A[q*n + q]))) continue;
      rotated = true;
      const theta = (A[q*n + q] - A[p*n + p])/(2*apq);
      const t = (theta >= 0 ? 1 : -1)/(Math.abs(theta) + Math.sqrt(theta*theta + 1));
      const c = 1/Math.sqrt(t*t + 1), s = t*c;
      for (let k = 0; k < n; k++){       // columns p, q
        const akp = A[k*n + p], akq = A[k*n + q];
        A[k*n + p] = c*akp - s*akq; A[k*n + q] = s*akp + c*akq;
      }
      for (let k = 0; k < n; k++){       // rows p, q
        const apk = A[p*n + k], aqk = A[q*n + k];
        A[p*n + k] = c*apk - s*aqk; A[q*n + k] = s*apk + c*aqk;
      }
      for (let k = 0; k < n; k++){
        const vkp = V[k*n + p], vkq = V[k*n + q];
        V[k*n + p] = c*vkp - s*vkq; V[k*n + q] = s*vkp + c*vkq;
      }
    }
    if (!rotated) break;
  }
  let mx = 0;
  for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(A[i*n + i]));
  const cut = 1e-15*mx, d = new Float64Array(n);
  for (let i = 0; i < n; i++){
    const l = A[i*n + i];
    if (!(Math.abs(l) > cut)) continue;
    for (let k = 0; k < n; k++) d[k] += V[k*n + i]*V[k*n + i]/l;
  }
  return d;
}

/* ---------------------------------------------------------
   scipy.optimize.least_squares(method='trf', tr_solver='exact'): the trust-region
   reflective algorithm with bounds (trf_bounds), x_scale, the linear and soft_l1 losses,
   scipy's default tolerances. fun(x) → Float64Array(m) (a fresh array each call);
   jac(x) → Float64Array(m*n), row-major, fresh each call.
--------------------------------------------------------- */
const dot = (a, b)=>{ let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; };
const norm = a => Math.sqrt(dot(a, a));
const allFinite = a =>{ for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false; return true; };
function nextafter(x, toward){
  if (Number.isNaN(x) || Number.isNaN(toward)) return NaN;
  if (x === toward) return toward;
  if (x === 0) return toward > 0 ? 5e-324 : -5e-324;
  const b = new Float64Array([x]), u = new BigInt64Array(b.buffer);
  if ((toward > x) === (x > 0)) u[0] += 1n; else u[0] -= 1n;
  return b[0];
}
function makeStrictlyFeasible(x, lb, ub, rstep){
  const n = x.length, out = Float64Array.from(x), act = new Int8Array(n);
  if (rstep === 0){
    for (let i = 0; i < n; i++){ if (x[i] <= lb[i]) act[i] = -1; if (x[i] >= ub[i]) act[i] = 1; }
  } else {
    for (let i = 0; i < n; i++){
      const ld = x[i] - lb[i], ud = ub[i] - x[i];
      const lt = rstep*Math.max(1, Math.abs(lb[i])), ut = rstep*Math.max(1, Math.abs(ub[i]));
      if (Number.isFinite(lb[i]) && ld <= Math.min(ud, lt)) act[i] = -1;
      if (Number.isFinite(ub[i]) && ud <= Math.min(ld, ut)) act[i] = 1;
    }
  }
  for (let i = 0; i < n; i++){
    if (act[i] === -1) out[i] = rstep === 0 ? nextafter(lb[i], ub[i]) : lb[i] + rstep*Math.max(1, Math.abs(lb[i]));
    else if (act[i] === 1) out[i] = rstep === 0 ? nextafter(ub[i], lb[i]) : ub[i] - rstep*Math.max(1, Math.abs(ub[i]));
    if (out[i] < lb[i] || out[i] > ub[i]) out[i] = 0.5*(lb[i] + ub[i]);
  }
  return out;
}
const inBounds = (x, lb, ub)=>{ for (let i = 0; i < x.length; i++) if (!(x[i] >= lb[i] && x[i] <= ub[i])) return false; return true; };
function stepSizeToBound(x, s, lb, ub){
  const n = x.length, steps = new Float64Array(n).fill(Infinity);
  let mn = Infinity;
  for (let i = 0; i < n; i++){
    if (s[i] !== 0) steps[i] = Math.max((lb[i] - x[i])/s[i], (ub[i] - x[i])/s[i]);
    if (steps[i] < mn) mn = steps[i];
  }
  const hits = new Int8Array(n);
  for (let i = 0; i < n; i++) if (steps[i] === mn) hits[i] = Math.sign(s[i]);
  return [mn, hits];
}
function intersectTrustRegion(x, s, Delta){
  const a = dot(s, s);
  if (a === 0) throw new Error('`s` is zero.');
  const b = dot(x, s), c = dot(x, x) - Delta*Delta;
  if (c > 0) throw new Error('`x` is not within the trust region.');
  const d = Math.sqrt(b*b - a*c);
  const q = -(b + ((b < 0 || Object.is(b, -0)) ? -d : d));
  const t1 = q/a, t2 = c/q;
  return t1 < t2 ? [t1, t2] : [t2, t1];
}
function matVec(J, m, n, s, out){
  for (let i = 0; i < m; i++){ let r = 0; const o = i*n; for (let j = 0; j < n; j++) r += J[o + j]*s[j]; out[i] = r; }
  return out;
}
function buildQuadratic1d(J, m, n, g, s, diag, s0){
  const v = matVec(J, m, n, s, new Float64Array(m));
  let a = dot(v, v);
  if (diag){ let q = 0; for (let i = 0; i < n; i++) q += s[i]*diag[i]*s[i]; a += q; }
  a *= 0.5;
  let b = dot(g, s);
  if (s0){
    const u = matVec(J, m, n, s0, new Float64Array(m));
    b += dot(u, v);
    let c = 0.5*dot(u, u) + dot(g, s0);
    if (diag){
      let q = 0, r = 0;
      for (let i = 0; i < n; i++){ q += s0[i]*diag[i]*s[i]; r += s0[i]*diag[i]*s0[i]; }
      b += q; c += 0.5*r;
    }
    return [a, b, c];
  }
  return [a, b, 0];
}
function minimizeQuadratic1d(a, b, lb, ub, c = 0){
  const t = [lb, ub];
  if (a !== 0){ const e = -0.5*b/a; if (lb < e && e < ub) t.push(e); }
  let best = 0, by = NaN;
  for (let i = 0; i < t.length; i++){
    const y = t[i]*(a*t[i] + b) + c;
    if (Number.isNaN(y)) return [t[i], y];          // np.argmin: the first NaN
    if (i === 0 || y < by){ best = i; by = y; }
  }
  return [t[best], by];
}
function evaluateQuadratic(J, m, n, g, s, diag){
  const Js = matVec(J, m, n, s, new Float64Array(m));
  let q = dot(Js, Js);
  if (diag){ let r = 0; for (let i = 0; i < n; i++) r += s[i]*diag[i]*s[i]; q += r; }
  return 0.5*q + dot(s, g);
}
function solveLsqTrustRegion(n, m, uf, s, V, Delta, initialAlpha){
  const suf = new Float64Array(n);
  for (let i = 0; i < n; i++) suf[i] = s[i]*uf[i];
  const phiAndDerivative = alpha =>{
    let pn = 0, sp = 0;
    for (let i = 0; i < n; i++){ const den = s[i]*s[i] + alpha, q = suf[i]/den; pn += q*q; sp += suf[i]*suf[i]/(den*den*den); }
    pn = Math.sqrt(pn);
    return [pn - Delta, -sp/pn];
  };
  const fullRank = m >= n ? s[n - 1] > EPS*m*s[0] : false;
  const p = new Float64Array(n);
  if (fullRank){
    for (let i = 0; i < n; i++){ let r = 0; for (let j = 0; j < n; j++) r += V[i*n + j]*(uf[j]/s[j]); p[i] = -r; }
    if (norm(p) <= Delta) return [p, 0.0, 0];
  }
  let alphaUpper = norm(suf)/Delta, alphaLower = 0.0;
  if (fullRank){ const [phi, dphi] = phiAndDerivative(0.0); alphaLower = -phi/dphi; }
  let alpha;
  if (initialAlpha == null || (!fullRank && initialAlpha === 0)) alpha = Math.max(0.001*alphaUpper, Math.sqrt(alphaLower*alphaUpper));
  else alpha = initialAlpha;
  let it = 0;
  for (; it < 10; it++){
    if (alpha < alphaLower || alpha > alphaUpper) alpha = Math.max(0.001*alphaUpper, Math.sqrt(alphaLower*alphaUpper));
    const [phi, dphi] = phiAndDerivative(alpha);
    if (phi < 0) alphaUpper = alpha;
    const ratio = phi/dphi;
    alphaLower = Math.max(alphaLower, alpha - ratio);
    alpha -= (phi + Delta)*ratio/Delta;
    if (Math.abs(phi) < 0.01*Delta) break;
  }
  for (let i = 0; i < n; i++){ let r = 0; for (let j = 0; j < n; j++) r += V[i*n + j]*(suf[j]/(s[j]*s[j] + alpha)); p[i] = -r; }
  const k = Delta/norm(p);
  for (let i = 0; i < n; i++) p[i] *= k;
  return [p, alpha, Math.min(it + 1, 10)];
}
function selectStep(x, Jh, m, n, diagH, gH, p, pH, d, Delta, lb, ub, theta){
  const xp = new Float64Array(n);
  for (let i = 0; i < n; i++) xp[i] = x[i] + p[i];
  if (inBounds(xp, lb, ub)) return [p, pH, -evaluateQuadratic(Jh, m, n, gH, pH, diagH)];
  const [pStride, hits] = stepSizeToBound(x, p, lb, ub);
  let rH = Float64Array.from(pH);
  for (let i = 0; i < n; i++) if (hits[i]) rH[i] *= -1;
  let r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = d[i]*rH[i];
  for (let i = 0; i < n; i++){ p[i] *= pStride; pH[i] *= pStride; }
  const xOn = new Float64Array(n);
  for (let i = 0; i < n; i++) xOn[i] = x[i] + p[i];
  const toTr = intersectTrustRegion(pH, rH, Delta)[1];
  const toBound = stepSizeToBound(xOn, r, lb, ub)[0];
  let rStride = Math.min(toBound, toTr), rStrideL, rStrideU;
  if (rStride > 0){
    rStrideL = (1 - theta)*pStride/rStride;
    rStrideU = rStride === toBound ? theta*toBound : toTr;
  } else { rStrideL = 0; rStrideU = -1; }
  let rValue;
  if (rStrideL <= rStrideU){
    const [a, b, c] = buildQuadratic1d(Jh, m, n, gH, rH, diagH, pH);
    const [rs, rv] = minimizeQuadratic1d(a, b, rStrideL, rStrideU, c);
    rStride = rs; rValue = rv;
    for (let i = 0; i < n; i++){ rH[i] = rH[i]*rStride + pH[i]; r[i] = rH[i]*d[i]; }
  } else rValue = Infinity;
  for (let i = 0; i < n; i++){ p[i] *= theta; pH[i] *= theta; }
  const pValue = evaluateQuadratic(Jh, m, n, gH, pH, diagH);
  const agH = new Float64Array(n), ag = new Float64Array(n);
  for (let i = 0; i < n; i++){ agH[i] = -gH[i]; ag[i] = d[i]*agH[i]; }
  const toTr2 = Delta/norm(agH);
  const toBound2 = stepSizeToBound(x, ag, lb, ub)[0];
  let agStride = toBound2 < toTr2 ? theta*toBound2 : toTr2;
  const [a2, b2] = buildQuadratic1d(Jh, m, n, gH, agH, diagH, null);
  const [as, agValue] = minimizeQuadratic1d(a2, b2, 0, agStride);
  agStride = as;
  for (let i = 0; i < n; i++){ agH[i] *= agStride; ag[i] *= agStride; }
  if (pValue < rValue && pValue < agValue) return [p, pH, -pValue];
  if (rValue < pValue && rValue < agValue) return [r, rH, -rValue];
  return [ag, agH, -agValue];
}
function updateTrRadius(Delta, actual, predicted, stepNorm, boundHit){
  let ratio;
  if (predicted > 0) ratio = actual/predicted;
  else if (predicted === actual && actual === 0) ratio = 1;
  else ratio = 0;
  if (ratio < 0.25) Delta = 0.25*stepNorm;
  else if (ratio > 0.75 && boundHit) Delta *= 2.0;
  return [Delta, ratio];
}
function checkTermination(dF, F, dxNorm, xNorm, ratio, ftol, xtol){
  const fOk = dF < ftol*F && ratio > 0.25, xOk = dxNorm < xtol*(xtol + xNorm);
  if (fOk && xOk) return 4;
  if (fOk) return 2;
  if (xOk) return 3;
  return null;
}
// soft_l1 with f_scale C: rho(z) = 2((1 + z)^0.5 − 1), z = (f/C)², scaled as scipy does.
function softL1(fScale){
  const c2 = fScale**2;
  return {
    cost(f){
      const r0 = new Float64Array(f.length);
      for (let i = 0; i < f.length; i++){ const z = (f[i]/fScale)**2; r0[i] = 2*(Math.sqrt(1 + z) - 1); }
      return 0.5*c2*npSum(r0);
    },
    // the cost (0.5 Σ rho0), and J, f scaled in place (scale_for_robust_loss_function)
    scale(J, f, n){
      const r0 = new Float64Array(f.length);
      for (let i = 0; i < f.length; i++){
        const z = (f[i]/fScale)**2, t = 1 + z;
        r0[i] = 2*(Math.sqrt(t) - 1)*c2;
        const r1 = Math.pow(t, -0.5), r2 = -0.5*Math.pow(t, -1.5)/c2;
        let js = r1 + 2*r2*(f[i]*f[i]);
        if (js < EPS) js = EPS;
        js = Math.sqrt(js);
        f[i] *= r1/js;
        const o = i*n;
        for (let j = 0; j < n; j++) J[o + j] *= js;
      }
      return 0.5*npSum(r0);
    },
  };
}
export function leastSquaresTrf(fun, jac, x0, lbIn, ubIn, { xScale = null, loss = 'linear', fScale = 1.0, maxNfev = null, ftol = 1e-8, xtol = 1e-8, gtol = 1e-8 } = {}){
  const n = x0.length, lb = Float64Array.from(lbIn), ub = Float64Array.from(ubIn);
  for (let i = 0; i < n; i++) if (!(lb[i] < ub[i])) throw new Error('Each lower bound must be strictly less than each upper bound.');
  if (!inBounds(x0, lb, ub)) throw new Error('Initial guess is outside of provided bounds');
  const scale = xScale ? Float64Array.from(xScale) : new Float64Array(n).fill(1);
  const scaleInv = scale.map(v=> 1/v);
  let x = makeStrictlyFeasible(x0, lb, ub, 1e-10);
  const xStart = Float64Array.from(x);
  let f = fun(x);
  if (!allFinite(f)) throw new Error('Residuals are not finite in the initial point.');
  let J = jac(x);
  const m = f.length;
  if (maxNfev == null) maxNfev = n*100;
  const lossF = loss === 'soft_l1' ? softL1(fScale) : null;
  if (loss !== 'linear' && loss !== 'soft_l1') throw new Error('loss: linear or soft_l1');
  let nfev = 1, njev = 1, fTrue = Float64Array.from(f), cost;
  if (lossF) cost = lossF.scale(J, f, n); else cost = 0.5*dot(f, f);
  const grad = (J, f)=>{ const g = new Float64Array(n); for (let i = 0; i < m; i++){ const fi = f[i], o = i*n; for (let j = 0; j < n; j++) g[j] += J[o + j]*fi; } return g; };
  let g = grad(J, f);
  const CL = (x, g)=>{
    const v = new Float64Array(n).fill(1), dv = new Float64Array(n);
    for (let i = 0; i < n; i++){
      if (g[i] < 0 && Number.isFinite(ub[i])){ v[i] = ub[i] - x[i]; dv[i] = -1; }
      if (g[i] > 0 && Number.isFinite(lb[i])){ v[i] = x[i] - lb[i]; dv[i] = 1; }
    }
    return [v, dv];
  };
  let [v, dv] = CL(x, g);
  for (let i = 0; i < n; i++) if (dv[i] !== 0) v[i] *= scaleInv[i];
  let Delta;
  { let s = 0; for (let i = 0; i < n; i++){ const q = xStart[i]*scaleInv[i]/Math.sqrt(v[i]); s += q*q; } Delta = Math.sqrt(s); }
  if (Delta === 0) Delta = 1.0;
  let gNorm;
  let alpha = 0.0, status = null, actualReduction, iteration = 0;
  const M = m + n;
  const Jaug = new Float64Array(M*n), fAug = new Float64Array(M), Jh = new Float64Array(m*n);
  const d = new Float64Array(n), diagH = new Float64Array(n), gH = new Float64Array(n);
  for (;;){
    [v, dv] = CL(x, g);
    gNorm = 0;
    for (let i = 0; i < n; i++) gNorm = Math.max(gNorm, Math.abs(g[i]*v[i]));
    if (gNorm < gtol) status = 1;
    if (status !== null || nfev === maxNfev) break;
    for (let i = 0; i < n; i++) if (dv[i] !== 0) v[i] *= scaleInv[i];
    for (let i = 0; i < n; i++){ d[i] = Math.sqrt(v[i])*scale[i]; diagH[i] = g[i]*dv[i]*scale[i]; gH[i] = d[i]*g[i]; }
    for (let i = 0; i < m; i++){ fAug[i] = f[i]; const o = i*n; for (let j = 0; j < n; j++){ const q = J[o + j]*d[j]; Jh[o + j] = q; Jaug[j*M + i] = q; } }
    for (let j = 0; j < n; j++){ fAug[m + j] = 0; for (let k = 0; k < n; k++) Jaug[j*M + m + k] = k === j ? Math.sqrt(diagH[j]) : 0; }
    const { s, V, ub: uf } = svdThin(Jaug, M, n, fAug);
    const theta = Math.max(0.995, 1 - gNorm);
    actualReduction = -1;
    let xNew = null, fNew = null, costNew = 0, stepNorm;
    while (actualReduction <= 0 && nfev < maxNfev){
      const [pH0, al] = solveLsqTrustRegion(n, m, uf, s, V, Delta, alpha);
      alpha = al;
      const p0 = new Float64Array(n);
      for (let i = 0; i < n; i++) p0[i] = d[i]*pH0[i];
      const [st, stH, predicted] = selectStep(x, Jh, m, n, diagH, gH, p0, pH0, d, Delta, lb, ub, theta);
      const xs = new Float64Array(n);
      for (let i = 0; i < n; i++) xs[i] = x[i] + st[i];
      xNew = makeStrictlyFeasible(xs, lb, ub, 0);
      fNew = fun(xNew); nfev++;
      const stepHNorm = norm(stH);
      if (!allFinite(fNew)){ Delta = 0.25*stepHNorm; continue; }
      costNew = lossF ? lossF.cost(fNew) : 0.5*dot(fNew, fNew);
      actualReduction = cost - costNew;
      const [DeltaNew, ratio] = updateTrRadius(Delta, actualReduction, predicted, stepHNorm, stepHNorm > 0.95*Delta);
      stepNorm = norm(st);
      status = checkTermination(actualReduction, cost, stepNorm, norm(x), ratio, ftol, xtol);
      if (status !== null) break;
      alpha *= Delta/DeltaNew;
      Delta = DeltaNew;
    }
    if (actualReduction > 0){
      x = xNew; f = fNew; fTrue = Float64Array.from(f); cost = costNew;
      J = jac(x); njev++;
      if (lossF) lossF.scale(J, f, n);
      g = grad(J, f);
    }
    iteration++;
  }
  if (status === null) status = 0;
  return { x, cost, fun: fTrue, jac: J, m, n, grad: g, optimality: gNorm, nfev, njev, status, success: status > 0, iterations: iteration };
}

/* ---------------------------------------------------------
   One fit of a window (_fit): peaks (universal shape) + polynomial + sigmoid steps
--------------------------------------------------------- */
const fitDefaults = fit => ({ ...DEFAULT_METHOD.fit, ...(fit || {}),
  glitch: { ...DEFAULT_METHOD.fit.glitch, ...((fit || {}).glitch || {}) }, restart: { ...DEFAULT_METHOD.fit.restart, ...((fit || {}).restart || {}) },
  spikes: { ...DEFAULT_METHOD.fit.spikes, ...((fit || {}).spikes || {}) }, step: { ...DEFAULT_METHOD.fit.step, ...((fit || {}).step || {}) } });

/* The model of a window on the points tw (polynomial in tw − tc): returns { total, base,
   comp: [peak curves] }. p: the full parameter vector (peaks, then steps, then baseline). */
function windowModel(p, tw, tc, npk, ng, nb, comp = true){
  const N = tw.length, iG = NP*npk, iB = iG + 3*ng;
  const base = new Float64Array(N);
  for (let i = 0; i < N; i++){
    const xx = tw[i] - tc; let yb = 0;
    for (let k = nb - 1; k >= 0; k--) yb = yb*xx + p[iB + k];
    base[i] = yb;
  }
  for (let k = 0; k < ng; k++){
    const h = p[iG + 3*k], t0 = p[iG + 3*k + 1], w = Math.exp(p[iG + 3*k + 2]);
    for (let i = 0; i < N; i++) base[i] = base[i] + h/(1.0 + Math.exp(-(tw[i] - t0)/w));
  }
  const cs = [], sum = new Float64Array(N);
  for (let k = 0; k < npk; k++){
    const q = physical(p, NP*k), c = new Float64Array(N);
    peakInto(c, tw, N, q.A, q.mu, q.sigma, q.dmu, q.fc, q.tau1, q.tau2, q.w2);
    if (k === 0) sum.set(c); else for (let i = 0; i < N; i++) sum[i] = sum[i] + c[i];
    if (comp) cs.push(c);
  }
  const total = new Float64Array(N);
  for (let i = 0; i < N; i++) total[i] = base[i] + sum[i];
  return { total, base, comp: cs };
}

/* _fit: t, y the chromatogram (finite points), win a window of the method; opts:
   { loss: 'linear' | 'soft_l1', excluded: [[a, b]], p0: a start vector }.
   Returns the fit with its points, its model and residuals (fitPeaks reads them;
   integrateChromatogram keeps a compact copy). */
function fitOnce(t, y, win, fitIn, { loss = 'linear', excluded = [], p0: pStart = null } = {}){
  const fit = fitDefaults(fitIn);
  const idx = [];
  for (let i = 0; i < t.length; i++) if (t[i] >= win.from && t[i] <= win.to && Number.isFinite(y[i])) idx.push(i);
  const tAll = Float64Array.from(idx, i=> t[i]), yAll = Float64Array.from(idx, i=> y[i]);
  let noise = diffNoise(yAll);
  const sp = findSpikes(yAll, noise, { threshold: fit.spikes.threshold, fraction: fit.spikes.fraction, rounds: fit.spikes.roundsFit });
  const spikeT = [];
  for (let i = 0; i < sp.length; i++) if (sp[i]) spikeT.push(tAll[i]);
  const drop = Uint8Array.from(sp);
  for (const [a, b] of excluded) for (let i = 0; i < tAll.length; i++) if (tAll[i] >= a && tAll[i] <= b) drop[i] = 1;
  const keep = [];
  for (let i = 0; i < tAll.length; i++) if (!drop[i]) keep.push(i);
  const tw = Float64Array.from(keep, i=> tAll[i]), yw = Float64Array.from(keep, i=> yAll[i]);
  const tc = npMean(tw);
  noise = Math.max(Number(noise), 1e-6);
  const peaks = win.peaks, stepsC = win.steps || [], npk = peaks.length, ng = stepsC.length, nb = (win.baseDegree == null ? 1 : win.baseDegree) + 1;
  const N = tw.length;
  const base0 = median(yw.subarray(0, 10));
  let p0 = [], lo = [], hi = [];
  for (const pk of peaks){
    const ta = pk.t;
    let any = false, ymax = -Infinity, tmax = ta;
    for (let i = 0; i < N; i++) if (Math.abs(tw[i] - ta) < fit.apexSearch){ if (!any || yw[i] > ymax){ ymax = yw[i]; tmax = tw[i]; } any = true; }
    const h = any ? ymax - base0 : 0.0;
    if (!(any && h > fit.apexSnr*noise)) tmax = ta;
    p0.push(Math.max(h, noise)*2.0, tmax - 0.3, ...START);
    lo.push(-Infinity, tmax - fit.shiftAllowance, ...LIM_LO);
    hi.push(Infinity, tmax + fit.shiftAllowance, ...LIM_HI);
  }
  for (const sg of stepsC){
    p0.push(0.0, 0.5*(sg.from + sg.to), Math.log(fit.step.width));
    lo.push(-Infinity, sg.from, Math.log(fit.step.widthMin)); hi.push(Infinity, sg.to, Math.log(fit.step.widthMax));
  }
  p0.push(base0); for (let k = 1; k < nb; k++) p0.push(0.0);
  for (let k = 0; k < nb; k++){ lo.push(-Infinity); hi.push(Infinity); }
  if (pStart) p0 = Array.from(pStart);
  const nPar = p0.length;
  lo = Float64Array.from(lo); hi = Float64Array.from(hi);
  const x0 = new Float64Array(nPar);
  for (let i = 0; i < nPar; i++) x0[i] = Math.min(Math.max(p0[i], lo[i] + 1e-9), hi[i] - 1e-9);
  const iG = NP*npk, iB = iG + 3*ng, w = fit.priorWeight;
  const stepPriors = stepsC.map((sg, k)=> sg.prior ? { k, ...sg.prior } : null).filter(Boolean);
  const nPrior = npk*NPR + 3*stepPriors.length, m = N + nPrior;
  const logW0 = Math.log(fit.step.width), wSd = fit.step.widthLogSd;

  const residuals = p =>{
    const { total } = windowModel(p, tw, tc, npk, ng, nb, false);
    const r = new Float64Array(m);
    for (let i = 0; i < N; i++) r[i] = (yw[i] - total[i])/noise;
    let o = N;
    for (let k = 0; k < npk; k++) for (let i = 0; i < NPR; i++) r[o++] = w*((p[NP*k + 2 + i] - PRIOR_MEAN[i])/PRIOR_SD[i]);
    for (const sp of stepPriors){
      const h = p[iG + 3*sp.k], t0 = p[iG + 3*sp.k + 1], ll = p[iG + 3*sp.k + 2];
      r[o++] = w*((h - sp.h)/sp.hSd); r[o++] = w*((t0 - sp.t0)/sp.t0Sd); r[o++] = w*((ll - logW0)/wSd);
    }
    return r;
  };
  const forma = new Float64Array(N), f2 = new Float64Array(N);
  const jacobian = p =>{
    const J = new Float64Array(m*nPar);
    for (let k = 0; k < npk; k++){
      const q = Array.from(p.subarray(NP*k, NP*k + NP));
      const ph = physical(q);
      peakInto(forma, tw, N, 1.0, ph.mu, ph.sigma, ph.dmu, ph.fc, ph.tau1, ph.tau2, ph.w2);
      const c0 = NP*k;
      for (let i = 0; i < N; i++) J[i*nPar + c0] = -forma[i]/noise;
      const A = q[0];
      for (let i = 1; i < NP; i++){
        let h = 1e-6*Math.max(1.0, Math.abs(q[i]));
        if (q[i] + h > hi[NP*k + i]) h = -h;
        const q2 = q.slice(); q2[i] += h;
        const p2 = physical(q2);
        peakInto(f2, tw, N, 1.0, p2.mu, p2.sigma, p2.dmu, p2.fc, p2.tau1, p2.tau2, p2.w2);
        const c = c0 + i;
        for (let r = 0; r < N; r++) J[r*nPar + c] = -A*(f2[r] - forma[r])/h/noise;
      }
      for (let i = 0; i < NPR; i++) J[(N + k*NPR + i)*nPar + NP*k + 2 + i] = w/PRIOR_SD[i];
    }
    for (let k = 0; k < ng; k++){
      const h = p[iG + 3*k], t0 = p[iG + 3*k + 1], wd = Math.exp(p[iG + 3*k + 2]), c = iG + 3*k;
      for (let i = 0; i < N; i++){
        const e = 1.0/(1.0 + Math.exp(-(tw[i] - t0)/wd)), de = e*(1 - e);
        J[i*nPar + c] = -e/noise;
        J[i*nPar + c + 1] = h*de/wd/noise;
        J[i*nPar + c + 2] = h*de*(tw[i] - t0)/wd/noise;
      }
    }
    stepPriors.forEach((sp, j)=>{
      const r0 = N + npk*NPR + 3*j, c = iG + 3*sp.k;
      J[r0*nPar + c] = w/sp.hSd; J[(r0 + 1)*nPar + c + 1] = w/sp.t0Sd; J[(r0 + 2)*nPar + c + 2] = w/wSd;
    });
    for (let k = 0; k < nb; k++) for (let i = 0; i < N; i++) J[i*nPar + iB + k] = -(k === 0 ? 1 : Math.pow(tw[i] - tc, k))/noise;
    return J;
  };
  const sc = new Float64Array(nPar);
  const SC = [Math.max(Math.abs(x0[0]), 10*noise), 0.1, 0.3, 0.3, 0.1, 0.3, 0.5, 0.03];
  for (let k = 0; k < npk; k++) for (let i = 0; i < NP; i++) sc[NP*k + i] = SC[i];
  for (let k = 0; k < ng; k++){ sc[iG + 3*k] = 5*noise; sc[iG + 3*k + 1] = 0.3; sc[iG + 3*k + 2] = 0.3; }
  sc[iB] = 10*noise; for (let k = 1; k < nb; k++) sc[iB + k] = noise/10;
  const robust = loss !== 'linear';
  const sol = leastSquaresTrf(residuals, jacobian, x0, lo, hi, { xScale: sc, maxNfev: robust ? fit.maxNfevRobust : fit.maxNfev,
    loss: robust ? loss : 'linear', fScale: robust ? fit.robustFScale : 1.0 });
  const p = sol.x;
  const { total, base } = windowModel(p, tw, tc, npk, ng, nb, false);
  const res = new Float64Array(N), res2 = new Float64Array(N);
  for (let i = 0; i < N; i++){ res[i] = yw[i] - total[i]; res2[i] = res[i]**2; }
  const mse = npMean(res2);
  let sd = new Array(npk).fill(NaN);
  if (!robust){
    try {
      const Jf = sol.jac, G = new Float64Array(nPar*nPar);
      for (let i = 0; i < m; i++){ const o = i*nPar; for (let a = 0; a < nPar; a++){ const va = Jf[o + a]; if (va === 0) continue; for (let b = 0; b < nPar; b++) G[a*nPar + b] += va*Jf[o + b]; } }
      const dg = pinvDiagSym(G, nPar);
      sd = peaks.map((_, k)=> Math.sqrt(Math.max(dg[NP*k], 0)));
    } catch(e){ sd = new Array(npk).fill(NaN); }
  }
  return {
    p: Array.from(p), areas: peaks.map((_, k)=> p[NP*k]), sd, params: peaks.map((_, k)=> physical(p, NP*k)),
    steps: stepsC.map((_, k)=> ({ h: p[iG + 3*k], t0: p[iG + 3*k + 1], width: Math.exp(p[iG + 3*k + 2]) })),
    rms: Math.sqrt(mse), noise, chi2r: mse/noise**2, cost: sol.cost, spikes: spikeT,
    ok: sol.success, nfev: sol.nfev, t: tw, res, mod: total, base, tc,
  };
}

/* fit_picchi: the two passes. 1) robust fit (soft-L1), used only to find narrow glitches:
   groups of residuals > 25 × noise and > 25 % of the local signal, at most 1.4 s wide and
   larger than half the peaks' signal within 1 s; 2) ordinary least squares without them
   (± 0.6 s), from the robust solution. Restarted from the generic start when chi²_r > 4 or
   a step is more than 3 sd from its prior, the lower cost kept. */
function fitPeaks(t, y, win, fitIn){
  const fit = fitDefaults(fitIn);
  if (!fit.maskGlitches){ const r = fitOnce(t, y, win, fit); r.excluded = []; r.nfevTotal = r.nfev; r.restarted = false; r.restartWon = false; return r; }
  const r0 = fitOnce(t, y, win, fit, { loss: fit.robustLoss });
  const G = fit.glitch, N0 = r0.t.length;
  const sig = new Float64Array(N0);
  for (let i = 0; i < N0; i++) sig[i] = r0.mod[i] - r0.base[i];
  const bad = [];
  for (let i = 0; i < N0; i++) if (Math.abs(r0.res[i]) > G.noiseTimes*r0.noise && Math.abs(r0.res[i]) > G.localFraction*Math.abs(sig[i])) bad.push(i);
  const excluded = [];
  if (bad.length){
    const groups = [[bad[0]]];
    for (let j = 1; j < bad.length; j++){ if (bad[j] - bad[j - 1] > G.groupGap) groups.push([]); groups[groups.length - 1].push(bad[j]); }
    for (const g of groups){
      const t1 = r0.t[g[0]], t2 = r0.t[g[g.length - 1]];
      let resMax = 0, sigMax = 0;
      for (const i of g) resMax = Math.max(resMax, Math.abs(r0.res[i]));
      for (let i = 0; i < N0; i++) if (r0.t[i] >= t1 - G.near && r0.t[i] <= t2 + G.near) sigMax = Math.max(sigMax, Math.abs(sig[i]));
      if (t2 - t1 <= G.maxWidth && resMax > G.nearFraction*sigMax) excluded.push([t1 - G.pad, t2 + G.pad]);
    }
  }
  let r = fitOnce(t, y, win, fit, { excluded, p0: r0.p });
  let nfevTotal = r0.nfev + r.nfev, restarted = false, restartWon = false;
  const far = (win.steps || []).some((sg, k)=> sg.prior && Math.abs(r.steps[k].h - sg.prior.h) > fit.restart.stepSds*sg.prior.hSd);
  if (r.chi2r > fit.restart.chi2r || far){
    restarted = true;
    const r2 = fitOnce(t, y, win, fit, { excluded });
    nfevTotal += r2.nfev;
    if (r2.cost < r.cost){ r = r2; restartWon = true; }
  }
  r.excluded = excluded; r.nfevTotal = nfevTotal; r.restarted = restarted; r.restartWon = restartWon;
  return r;
}

// np.arange(start, stop, step) as numpy fills it: start, start + step, then start + i·delta,
// delta = (start + step) − start.
function npArange(start, stop, stepv){
  const len = Math.max(0, Math.ceil((stop - start)/stepv));
  const out = new Float64Array(len);
  if (len > 0) out[0] = start;
  if (len > 1) out[1] = start + stepv;
  const delta = (start + stepv) - start;
  for (let i = 2; i < len; i++) out[i] = start + i*delta;
  return out;
}
// The apex of a peak's unit-area shape: the argmax on a grid of `grid` s over [t0, t1).
function apexTime(par, t0, t1, grid){
  const tf = npArange(t0, t1, grid);
  if (!tf.length) return NaN;
  const v = new Float64Array(tf.length);
  peakInto(v, tf, tf.length, 1.0, par.mu, par.sigma, par.dmu, par.fc, par.tau1, par.tau2, par.w2);
  let k = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[k]) k = i;
  return tf[k];
}

/* ---------------------------------------------------------
   Reading the raw chromatograms (<run>_TCD.csv): ';'-separated, decimal comma, no header,
   time (s) then one column per injection, each line ending with ';', a column possibly
   ending early with blanks. Also ','- or tab-separated with '.' decimals.
   → { t, cols } (cols[j][i] NaN where blank; columns blank throughout dropped), or { error }.
--------------------------------------------------------- */
export function readTcd(text){
  if (typeof text !== 'string') return { error: 'Not a text.' };
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r\n|\n|\r/).filter(l=> l.trim() !== '');
  if (!lines.length) return { error: 'The file is empty.' };
  const probe = lines.slice(0, 20).join('\n');
  const sep = probe.includes(';') ? ';' : probe.includes('\t') ? '\t' : ',';
  const comma = sep !== ',' && /(^|[;\t])\s*[-+]?\d+,\d/.test(probe);
  const num = s =>{
    s = s.trim();
    if (s === '') return NaN;
    if (comma) s = s.replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN;
    return Number(s);
  };
  const rows = [];
  let width = 0;
  for (const l of lines){
    const cells = l.split(sep);
    if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop();
    const r = cells.map(num);
    if (!Number.isFinite(r[0])) continue;          // a header or a line with no time
    rows.push(r); width = Math.max(width, r.length);
  }
  if (rows.length < 2) return { error: 'No numeric data: time in the first column, one column per chromatogram.' };
  if (width < 2) return { error: 'Only one column: no chromatogram after the time.' };
  const t = rows.map(r=> r[0]);
  for (let i = 1; i < t.length; i++) if (!(t[i] > t[i - 1])) return { error: `The time does not increase at line ${i + 1} (${t[i]} s).` };
  const cols = [];
  for (let j = 1; j < width; j++){
    const c = rows.map(r=> j < r.length ? r[j] : NaN);
    if (c.some(Number.isFinite)) cols.push(c);
  }
  if (!cols.length) return { error: 'No chromatogram: the columns after the time are blank.' };
  return { t, cols };
}

/* ---------------------------------------------------------
   One chromatogram: every window fitted, the gases' areas.
   Compact and JSON-serialisable (no long arrays). A window past the data's end gives NaN.
   (JSON writes NaN as null: read null back as NaN.)
--------------------------------------------------------- */
export function integrateChromatogram(tIn, yIn, method = DEFAULT_METHOD){
  const tt = [], yy = [];
  for (let i = 0; i < tIn.length; i++) if (Number.isFinite(tIn[i]) && Number.isFinite(yIn[i])){ tt.push(tIn[i]); yy.push(yIn[i]); }
  const t = Float64Array.from(tt), y = Float64Array.from(yy);
  const fit = fitDefaults(method.fit);
  const windows = [], gases = {};
  for (const win of method.windows){
    const nan = { key: win.key, p: null, noise: NaN, chi2r: NaN, rms: NaN, cost: NaN, nfev: 0, nfevTotal: 0, ok: false, spikes: [], excluded: [], restarted: false, restartWon: false, tc: NaN,
      peaks: win.peaks.map(pk=> ({ name: pk.name, gas: pk.gas, area: NaN, sd: NaN, tApex: NaN, params: null })),
      steps: (win.steps || []).map(()=> ({ h: NaN, t0: NaN, width: NaN })), beyondData: true };
    if (!t.length || t[t.length - 1] < win.to){ windows.push(nan); continue; }
    let r;
    try { r = fitPeaks(t, y, win, fit); }
    catch(e){ windows.push({ ...nan, beyondData: false, error: String(e && e.message || e) }); continue; }
    const t0 = r.t[0], t1 = r.t[r.t.length - 1];
    const peaks = win.peaks.map((pk, k)=> ({ name: pk.name, gas: pk.gas, area: r.areas[k], sd: r.sd[k], tApex: apexTime(r.params[k], t0, t1, fit.apexGrid), params: r.params[k] }));
    windows.push({ key: win.key, p: r.p, noise: r.noise, chi2r: r.chi2r, rms: r.rms, cost: r.cost, nfev: r.nfev, nfevTotal: r.nfevTotal, ok: r.ok,
      spikes: r.spikes, excluded: r.excluded, restarted: r.restarted, restartWon: r.restartWon, tc: r.tc, peaks, steps: r.steps });
  }
  windows.forEach((w, wi)=> w.peaks.forEach(pk=>{
    if (pk.gas) gases[pk.gas] = { area: pk.area, sd: pk.sd, tApex: pk.tApex, chi2r: w.chi2r, window: method.windows[wi].key };
  }));
  return { gases, windows };
}

/* The curves of a fitted window, recomputed from its stored parameters, on the points the fit
   used (spikes and excluded points taken out exactly as it did): { t, y, model, base,
   peaks: { name: curve }, residual, dropped: { t, y, kind } } (kind 'spike' or 'excluded').
   windowResult: an entry of integrateChromatogram's windows (its key names the window). */
export function windowCurves(tIn, yIn, method, windowResult){
  const win = method.windows.find(w=> w.key === windowResult.key);
  if (!win || !windowResult.p) return null;
  const spikes = new Set(windowResult.spikes || []), excl = windowResult.excluded || [];
  const T = [], Y = [], dropped = { t: [], y: [], kind: [] };
  for (let i = 0; i < tIn.length; i++){
    const ti = tIn[i], yi = yIn[i];
    if (!(Number.isFinite(ti) && Number.isFinite(yi)) || ti < win.from || ti > win.to) continue;
    const isSp = spikes.has(ti), isEx = excl.some(([a, b])=> ti >= a && ti <= b);
    if (isSp || isEx){ dropped.t.push(ti); dropped.y.push(yi); dropped.kind.push(isSp ? 'spike' : 'excluded'); continue; }
    T.push(ti); Y.push(yi);
  }
  const tw = Float64Array.from(T), p = Float64Array.from(windowResult.p);
  const npk = win.peaks.length, ng = (win.steps || []).length, nb = (win.baseDegree == null ? 1 : win.baseDegree) + 1;
  const tc = Number.isFinite(windowResult.tc) ? windowResult.tc : npMean(tw);
  const { total, base, comp } = windowModel(p, tw, tc, npk, ng, nb, true);
  const peaks = {};
  win.peaks.forEach((pk, k)=>{ peaks[pk.name] = Array.from(comp[k]); });
  return { t: T, y: Y, model: Array.from(total), base: Array.from(base), peaks, residual: Y.map((v, i)=> v - total[i]), dropped };
}

/* ---------------------------------------------------------
   Calibration
--------------------------------------------------------- */
/* Least-squares line area = slope·conc + intercept (or through the origin), over the points
   with both values finite. r2 = 1 − SSres/SStot, SStot about the mean area in both cases
   (so the two are comparable; through the origin it can be negative). relDev = (area −
   fitted)/fitted. */
export function fitCalibration(points, { zeroIntercept = false } = {}){
  const P = (points || []).filter(q=> Number.isFinite(q.conc) && Number.isFinite(q.area));
  const n = P.length;
  const out = { slope: NaN, intercept: NaN, r2: NaN, n, residuals: [] };
  if (n < (zeroIntercept ? 1 : 2)) return out;
  let slope, intercept;
  if (zeroIntercept){
    let sxy = 0, sxx = 0;
    for (const q of P){ sxy += q.conc*q.area; sxx += q.conc*q.conc; }
    slope = sxy/sxx; intercept = 0;
  } else {
    let mx = 0, my = 0;
    for (const q of P){ mx += q.conc; my += q.area; }
    mx /= n; my /= n;
    let sxy = 0, sxx = 0;
    for (const q of P){ sxy += (q.conc - mx)*(q.area - my); sxx += (q.conc - mx)**2; }
    slope = sxy/sxx; intercept = my - slope*mx;
  }
  let my = 0;
  for (const q of P) my += q.area;
  my /= n;
  let ssr = 0, sst = 0;
  const residuals = P.map(q=>{
    const fitted = slope*q.conc + intercept;
    ssr += (q.area - fitted)**2; sst += (q.area - my)**2;
    return { conc: q.conc, area: q.area, fitted, relDev: (q.area - fitted)/fitted };
  });
  return { slope, intercept, r2: sst > 0 ? 1 - ssr/sst : NaN, n, residuals };
}

/* The software's calibration carried over (esegui): k = median of area/value over the
   injections whose table value is ≥ minValue (both finite), when there are at least
   minCount; else null. → { k, n } */
export function transferK(areas, tableValues, { minValue = 0, minCount = 10 } = {}){
  const r = [];
  const n = Math.min(areas.length, tableValues.length);
  for (let i = 0; i < n; i++){
    const a = areas[i], v = tableValues[i];
    if (Number.isFinite(a) && Number.isFinite(v) && v >= minValue && v !== 0) r.push(a/v);
  }
  if (r.length < minCount) return null;
  return { k: median(r), n: r.length };
}
