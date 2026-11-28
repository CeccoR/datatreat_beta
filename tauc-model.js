/* =========================================================
   DRS — the analyses' calculations, which touch no page (tauc.js wires them to the cards;
   tests/taucmodel.test.mjs calls them in Node): the energies, a file read and its points
   (the standard format, the columns a header names, the points that are no physical value,
   the notes), the reflectance from F(R); the curves smoothed and differentiated over the
   points that have a value, the window scan and its linear fit, E_g from the two Tauc fits,
   E_U and the Tauc baseline's part of the subtracted one's error, the suggestion's lines;
   a card's parameters and lines (all and one, as the fields take them, a file taken back
   in), the panel's state saved and read back, a file read again from its bytes, the cards'
   references; what the plots and charts draw (the ranges, the traces, a fit's lines, the
   Results' labels and series); the CSVs. Taken out of v555's tauc.js with their operations in their order: the same numbers
   to the last bit.

   utils.js's and modkit.js's helpers, which need a page to load, are handed in as one
   object, U = { movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, linspace,
   fmtNum, csvLine, wideCsv, isObj, num, ownKey, without, finitePairs } (tauc.js U).

   A card's settings are its panel's state P = { mode, shared, sharedVlines, per, suggested }
   (tauc.js makePanel) read through its spec, the pure part of which is TAUC or URBACH here
   (the kind, the parameters' keys and defaults, the curve, the windows and their lines, the
   default and the combined lines); the page adds the rest (its elements, the suggestion and
   the results an Urbach card reads off its reference).
========================================================= */
import { textLines, readXY, readTable, splitFields, parseNum, isNum, SEPS, decodeText } from './textdata.js';
import { heldLine, thrownWhy } from './alerts.js';

/* Energies are hν = hc/λ, hc in eV·nm to the digits a third decimal of E_g needs: 1240 put
   every energy 0.013% high. A spectrum's energies are made once for its array of
   wavelengths and kept by it (`energies`), for every instance and every state that holds
   it, and its file's record has them as no field of its own (withHv): a state of the
   history, a tab asleep and a project saved hold the wavelengths only (to v517 they were
   made again, a new array, at every change of the file list and every undo, and every
   state kept its own, a project saved too). */
export const HC = 1239.842;
const energies = new WeakMap();
export const hvOf = wl =>{ let e = energies.get(wl); if (!e) energies.set(wl, e = wl.map(x=> HC/x)); return e; };
export const withHv = f =>{ if (Array.isArray(f.wl)) Object.defineProperty(f, 'hv', { value: hvOf(f.wl), writable: true, configurable: true, enumerable: false }); return f; };

/* ---- The analyses: how E_g and E_U are read (pure: the module's, for every instance) ---- */
// How Eg is read off the Tauc plot; each Tauc analysis picks which its bar chart shows.
export const EG_METHODS = [
  // Named E_g in plain text: a legend's sub run sits badly beside its swatch.
  { key: 'x', label: 'x-axis',   name: 'E_g (x-axis)',   color: '#3aa0ff' },
  { key: 'b', label: 'baseline', name: 'E_g (baseline)', color: '#ff7a59' },
];

/* The two ways E_U is read, told apart as GC's gases are: from ln F(R) as it is, and
   with the reference Tauc card's baseline taken out of F(R) first (subtracted). Lines
   keep the sample's colour, the subtracted ones long-dashed (their fits dotted); bars
   take the pair's two colours. Each Urbach card's Results show both, each in a plot and a
   bar chart of its own (v536: to v535 chips chose which E_U chart showed). */
// Three line patterns, none used twice: the plain fits dashed (as every fit in the
// Results is), the subtracted curves long-dashed, their fits dotted.
export const URB_METHODS = [
  { key: 'p', label: 'plain',      name: 'E_U',              color: '#3aa0ff' },
  { key: 's', label: 'subtracted', name: 'E_U (subtracted)', color: '#ff7a59' },
];

const clampN = v => Math.max(1, Math.round(v));
const clampM = v => Math.max(2, Math.round(v));
// Two-sided 99% confidence: the 99.5% quantile of Student's t, the factor every
// error reported here (Eg, E_U) is multiplied by.
export const T_Q = 0.995;

/* A curve with points that have no value (F(R) < 0 under a fractional exponent, F(R) ≤ 0
   under the logarithm) is smoothed and differentiated over the points that have one,
   as though the others had not been measured: those stay without a value, and every
   other point is averaged with its nearest neighbours that have one. Run over every
   point (to v478), the moving average spread each missing point to N/2 neighbours on
   either side, the derivative's to N2/2 more, the second derivative's as far again:
   10 points of F(R) < 0 left 279 of 551 values of Y'' without one, which the
   suggestion took for curvature, and no fit window could hold a point the spread had
   reached. `fn(y, x)` runs on the points with a finite y (or those `has(i)` keeps) and
   their x; a curve with none left out goes through it as it is. */
export function onFinite(y, x, fn, has = i=> isFinite(y[i])){
  const ok = []; for (let i=0;i<y.length;i++) if (has(i)) ok.push(i);
  if (ok.length === y.length) return fn(y, x);
  const r = fn(ok.map(i=> y[i]), x && ok.map(i=> x[i])), out = new Array(y.length).fill(NaN);
  ok.forEach((i, j)=> out[i] = r[j]);
  return out;
}
/* The smoothing and the derivative are numbers of points, N and N2: the curve's centred
   moving average over N points, and that over N2 of its central differences (to v520 again:
   v515 to v519 made them widths in eV, smooth.js). */
export const smoothY = (U, y, N)=> onFinite(y, null, v=> U.movingAverage(v, N));
// dy/dx smoothed over N points.
export const slopeOf = (U, y, x, N)=> onFinite(y, x, (v, e)=> U.movingAverage(U.gradientArr(v, e), N));

// Best linear fit inside [x1,x2]: slide an M-point window and pick the one that
// minimises NRMSE/R², where NRMSE = RMSE / (max-min of the window's y). Normalising
// by the y-range makes the criterion robust — it locks onto the steep linear edge
// instead of a flat low-value stretch that merely has a small absolute RMSE.
// `Ys` is the curve as analysed: already smoothed. The window is chosen on it, where
// noise does not pick it, and the line fitted to `Yraw`, the data themselves, inside
// it: fitted to smoothed values its residuals are averaged together, no longer
// independent, and every error came out too small (a "99%" interval held the truth
// 72% of the time at N = 5, 37% at N = 15). `n` is how many points it was fitted on.
// A window is M points that have a value: one without (F(R) at or below zero, see
// onFinite) is left out, and the window reaches past it. One holding such a point was
// passed over (to v478), so a few of F(R) < 0 through the baseline region left it no
// window to fit. With `strict` it still is, and only a point whose energy has no value
// is left out: the subtracted Urbach curve gives none to those of F(R) ≤ 0, which the
// plain curve leaves out, so a point there without a value is one where the Tauc
// baseline lies above F(R), which the card reports. (v515 to v519 slid a window of a
// width in eV; to v520 M points again, as to v514.)
export function scanRegr(U, hv, Ys, M, x1, x2, Yraw, strict){
  const lo = Math.min(x1,x2), hi=Math.max(x1,x2);
  const idxSel = [];
  for (let i=0;i<hv.length;i++) if (hv[i]>=lo && hv[i]<=hi && (strict || isFinite(Ys[i]))) idxSel.push(i);
  let best = {slope:NaN,intercept:NaN,R2:NaN,RMSE:Infinity,NRMSE:Infinity,bestIdx:[],varM:NaN,varB:NaN,covMB:NaN};
  if (idxSel.length < M) return best;
  let bestScore = Infinity;
  for (let s=0; s<=idxSel.length-M; s++){
    const block = idxSel.slice(s, s+M);
    const yb = block.map(i=>Ys[i]);
    if (yb.some(v=>!isFinite(v))) continue;
    const xb = block.map(i=>hv[i]);
    const r = U.fitLinear(xb, yb);
    const range = Math.max(...yb) - Math.min(...yb);
    const nrmse = range>0 ? r.rmse/range : Infinity;
    const score = nrmse / r.R2;
    if (score < bestScore){
      bestScore = score;
      best = {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, NRMSE:nrmse, bestIdx:block, varM:r.varM, varB:r.varB, covMB:r.covMB, n:M};
    }
  }
  if (!Yraw || Yraw === Ys || !best.bestIdx.length) return best;
  const idx = best.bestIdx.filter(i=> isFinite(Yraw[i]));
  if (idx.length < 3) return {...best, slope:NaN, intercept:NaN, R2:NaN, NRMSE:Infinity, varM:NaN, varB:NaN, covMB:NaN, n:idx.length};
  const yr = idx.map(i=> Yraw[i]), r = U.fitLinear(idx.map(i=> hv[i]), yr), range = Math.max(...yr) - Math.min(...yr);
  return {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, NRMSE: range > 0 ? r.rmse/range : Infinity,
          bestIdx:best.bestIdx, varM:r.varM, varB:r.varB, covMB:r.covMB, n:idx.length};
}

/* Eg from the two Tauc fits: where the Tauc line crosses the x-axis, and where it
   crosses the baseline. Each error is the fit's own (co)variances carried through
   the formula, every term scaled by the t factor of the fit it comes from. */
export function taucEg(U, regs, regs2, M, M2){
  let EgInt=NaN, EgIntErr=NaN;
  if ([regs.slope,regs.intercept,regs2.slope,regs2.intercept].every(isFinite)){
    const xInt = (regs2.intercept - regs.intercept)/(regs.slope - regs2.slope);
    const dxdb1 = -1/(regs.slope-regs2.slope), dxdb2 = 1/(regs.slope-regs2.slope);
    // x = (b2 − b1)/(m1 − m2), so ∂x/∂m1 = −(b2 − b1)/(m1 − m2)² = −∂x/∂m2. With the
    // sign the other way the slope–intercept covariances, strongly negative this far
    // from hν = 0, added to the variance instead of taking from it.
    const dxdm1 = -(regs2.intercept-regs.intercept)/Math.pow(regs.slope-regs2.slope,2);
    const dxdm2 = -dxdm1;
    const t1 = U.tinv(T_Q, (regs.n || M)-2), t2 = U.tinv(T_Q, (regs2.n || M2)-2);
    const varX = dxdb1*dxdb1*regs.varB*t1*t1 + dxdb2*dxdb2*regs2.varB*t2*t2 +
                 dxdm1*dxdm1*regs.varM*t1*t1 + dxdm2*dxdm2*regs2.varM*t2*t2 +
                 2*dxdb1*dxdm1*regs.covMB*t1*t1 + 2*dxdb2*dxdm2*regs2.covMB*t2*t2;
    EgInt = xInt;
    EgIntErr = varX>0 ? Math.sqrt(varX) : NaN;
  }
  const { x: Eg, err: EgErr } = xCross(U, regs, M);
  return {Eg,EgErr,EgInt,EgIntErr};
}
// Where a fitted line crosses y = 0, −b/m, and its error: the slope and intercept
// variances and their covariance carried through, times the fit's t factor.
export function xCross(U, r, M){
  if (!(r.slope !== 0 && isFinite(r.slope))) return { x: NaN, err: NaN };
  const x = -r.intercept/r.slope;
  if (![r.varM, r.varB, r.covMB].every(isFinite)) return { x, err: NaN };
  const v = (r.intercept**2/r.slope**4)*r.varM + (1/r.slope**2)*r.varB - 2*(r.intercept/r.slope**3)*r.covMB;
  return { x, err: v >= 0 ? Math.sqrt(v)*U.tinv(T_Q, (r.n || M)-2) : NaN };
}
// The inverse of a fit's slope, and its error σ_m/m² times the fit's t factor.
export function invSlope(U, r, M){
  const m = r.slope;
  if (!isFinite(m) || m === 0) return { v: NaN, err: NaN };
  return { v: 1/m, err: isFinite(r.varM) && r.varM >= 0 ? Math.sqrt(r.varM)/(m*m)*U.tinv(T_Q, (r.n || M)-2) : NaN };
}
// The Urbach energy is the inverse of the tail's slope in ln F(R) against hν.
export function urbachEu(U, regs, M){ const s = invSlope(U, regs, M); return { Eu: s.v, EuErr: s.err }; }

export const fmtE = (v, e, unit, k = 3, scale = 1)=> !isFinite(v) ? '-'
  : isFinite(e) ? `${(v*scale).toFixed(k)} ± ${(e*scale).toFixed(k)} ${unit}` : `${(v*scale).toFixed(k)} ${unit}`;

// ---- Auto-suggested Tauc interval lines ----
// Second-derivative method. The Tauc region is the span where Y'' is NON-zero (a
// linear/constant background has zero curvature, so it cancels). The "zero zones"
// are the flat pre-edge (low E) and post-edge (high E) regions, |Y''| < ε with
// ε = 10%·max|Y''|. The outer 10% of the energy range on each side is skimmed off
// first: the tails are where the spectrum is noisiest and the moving averages are
// one-sided, so neither ε nor the bounds are taken from them. The region bounds are
// found from each end of what is kept inward: the first start of a sustained run of
// CONT points with |Y''| >= ε (interpolated). (v515 to v519 asked for a run half the
// derivative's width in eV; to v520 CONT points again.)
const SUGG_THRESH = 0.10;   // ε as a fraction of max|Y''|
const SUGG_CONT   = 25;     // required consecutive points above ε
const SUGG_TAIL   = 0.10;   // fraction of the energy range skimmed off each end
// Read over the points that have a slope (onFinite): one without has no curvature.
// A non-finite |Y''| left (a repeated energy) counts as none: it made ε an absolute 0.1
// (Math.max with NaN is NaN) and stood "above ε" in every run (to v478).
export function curvatureEdge(U, c, p){
  const ok = []; for (let i=0;i<c.hv.length;i++) if (isFinite(c.dYs[i])) ok.push(i);
  const hv = ok.map(i=> c.hv[i]), n = hv.length;
  if (n < 7) return null;
  const d2  = U.movingAverage(U.gradientArr(ok.map(i=> c.dYs[i]), hv), p.N2);      // Y''
  // energy-ascending order of indices, so we can scan by energy regardless of layout
  const ord = [...Array(n).keys()].sort((a,b)=>hv[a]-hv[b]);
  const eLo = hv[ord[0]], eHi = hv[ord[n-1]], cut = SUGG_TAIL * (eHi - eLo);
  let a = 0, b = n-1;                                           // kept span, energy order
  while (a < n && hv[ord[a]] < eLo + cut) a++;
  while (b >= 0 && hv[ord[b]] > eHi - cut) b--;
  if (b - a < 2) return null;
  const ax = j =>{ const v = Math.abs(d2[ord[j]]); return isFinite(v) ? v : 0; };
  let A = 0; for (let j=a;j<=b;j++) A = Math.max(A, ax(j));
  const eps = SUGG_THRESH * (A || 1);
  const cross = (j,k) => { const t=(ax(j)-eps)/((ax(j)-ax(k))||1); return hv[ord[j]] + t*(hv[ord[k]]-hv[ord[j]]); };
  const inR = j => j>=a && j<=b;
  // sustained run of CONT points (from j, stepping dir) all with |Y''| >= eps
  const runGE = (j,dir) => { for (let m=0;m<SUGG_CONT;m++){ const jj=j+dir*m; if (!inR(jj) || ax(jj)<eps) return false; } return true; };
  let v1=hv[ord[a]], v2=hv[ord[b]];
  for (let j=a;j<=b;j++){ if (runGE(j,+1)){ v1 = j>a?cross(j-1,j):hv[ord[j]]; break; } }
  for (let j=b;j>=a;j--){ if (runGE(j,-1)){ v2 = j<b?cross(j+1,j):hv[ord[j]]; break; } }
  return { v1, v2 };
}

/* ---- The parameters ---- */
/* The fields of the parameters, by key: the exponent, A, and the numbers of points, N,
   the curve's smoothing, N2, the derivative's, M and M2, the regression windows (the
   spec's windows say which is whose). */
export const FIELD = { a:'A', N:'N', N2:'N2', M:'M', M2:'M2' };
export const CLAMP = { a: v => v, N: clampN, N2: clampN, M: clampM, M2: clampM };
/* The Tauc exponents, as [F(R)·hν]^a: the transition each stands for (`name`, the
   card's automatic name), and how it is written where it shows (the select, the
   axes); a fraction as such. */
export const EXPONENTS = [
  { a: 0.5, label: '0.5', gap: 'Indirect', name: 'allowed indirect' },
  { a: 2,   label: '2',   gap: 'Direct',   name: 'allowed direct' },
  { a: 2/3, label: '2/3', gap: 'Direct',   name: 'forbidden direct',   forbidden: true },
  { a: 1/3, label: '1/3', gap: 'Indirect', name: 'forbidden indirect', forbidden: true },
];
export const expOf = a => EXPONENTS.find(e=> Math.abs(e.a - a) < 1e-9);
export const fmtA = a =>{ const e = expOf(a); return e ? e.label : String(+(+a).toFixed(4)); };
export const URBACH_COLOR = '#ff7f0e';
// On the Urbach card, the tail with the Tauc baseline subtracted, in colours of its
// own: the curve, and its fit (solid in its window, dashed beyond), as the plain ones
// are drawn.
export const URB_SUB_COLORS = { curve: '#b46cff', fit: '#00acc1' };
export const TAUC_COLORS = { regs: '#ff5050', regs2: '#d050ff' };
/* The defaults, in points (v514's, and from v520 again): no smoothing, the derivative's
   over 20, the Tauc region's window 25, the baseline's 100, the Urbach region's 25. */
export const TAUC_DEF = { a:0.5, N:1, N2:20, M:25, M2:100 }, URB_DEF = { N:1, N2:20, M:25 };
// The analyses' kinds, as the menus list them; the card titles set them in capitals.
export const KINDS = { tauc: 'Tauc Plot', urbach: 'Urbach Energy' };
// Where Urbach lines rest with nothing to go by: a quarter and three quarters in.
export const restLines = (lo, d)=> ({ v1: lo + 0.25*d, v2: lo + 0.75*d });

/* ---- The kinds of analysis: the pure part of each card's spec ----
   Tauc on [F(R)hν]^a with a Tauc region and a baseline, Urbach on ln F(R) with one region.
   `lineKeys`: the lines of its windows. tauc.js adds the page's part (its elements, the
   results, an Urbach card's suggestion off its reference). */
const kindSpec = s => ({ ...s, lineKeys: s.windows.flatMap(w=> [w.lo, w.hi]) });
export const TAUC = kindSpec({
  kind: 'tauc',
  keys: ['a','N','N2','M','M2'],
  defaults: TAUC_DEF,
  curve: (fr, hv, p)=> Math.pow(fr*hv, p.a),
  // The exponent changes the curve the edge is found on, so the lines follow it.
  suggestOn: ['a'],
  fmtA,
  zeroFloor: true,
  windows: [
    { lo:'v1', hi:'v2', M:'M',  color: TAUC_COLORS.regs,  name:'Tauc region', key:'regs',  stats:['RMSE1','R21'] },
    { lo:'v3', hi:'v4', M:'M2', color: TAUC_COLORS.regs2, name:'baseline',    key:'regs2', stats:['RMSE2','R22'] },
  ],
  defaultLines: (lo, d)=> ({ v1: lo+0.6*d, v2: lo+0.8*d, v3: lo+0.2*d, v4: lo+0.4*d }),
  // Real bars use the OUTSIDE bounds (the whole non-zero-curvature span); the
  // baseline is placed just below where the edge starts.
  suggest: (i, p, curves, U)=>{ const e = curvatureEdge(U, curves(), p); return e && { v1: e.v1, v2: e.v2, v3: e.v1-0.85, v4: e.v1-0.1 }; },
  // Linear region [min(v1), max(v2)] over all samples, so every sample's edge lies
  // inside it (the window scan then finds each one's linear part); baseline computed
  // once from min(v1), below every edge.
  combine: ss =>{ const v1 = Math.min(...ss.map(s=>s.v1)), v2 = Math.max(...ss.map(s=>s.v2)); return { v1, v2, v3: v1-0.85, v4: v1-0.1 }; },
});
export const URBACH = kindSpec({
  kind: 'urbach',
  keys: ['N','N2','M'],
  defaults: URB_DEF,
  curve: fr => fr > 0 ? Math.log(fr) : NaN,
  zeroFloor: false,
  windows: [
    { lo:'v1', hi:'v2', M:'M', color: URBACH_COLOR, name:'Urbach region', key:'regs', stats:['RMSE1','R21'] },
  ],
  defaultLines: restLines,
  /* The region is placed under the sample's Tauc linear region in the reference (the
     band on this plot): the window scan inside it then finds the tail's straightest
     stretch by itself. With no reference, or no region in it, the lines go back to rest.
     Each sample's tail sits where its own edge is, so its lines are its own in either
     mode, and all/one is about the parameters only. */
  ownLines: true,
});
/* An Urbach card's lines placed on its reference's Tauc linear region for the sample, `w`
   (taucWindow; none: at rest on its span hv). The tail is below the edge: from 1 eV under
   the middle of that region up to where it starts. Centred on it, half the region lay
   above E_g, and the scan could lock onto the edge itself. */
export function urbachLines(U, w, hv){
  if (!w){ const lo = U.minArr(hv); return restLines(lo, U.maxArr(hv) - lo); }
  return { v1: (w[0] + w[1]) / 2 - 1, v2: w[0] };
}
// A sample's Tauc linear region in eV: the window its Tauc fit `regs` settled on (none: null).
export function taucWindow(regs, hv){
  const idx = regs.bestIdx;
  if (!idx || !idx.length) return null;
  const xs = idx.map(k=> hv[k]);
  return [Math.min(...xs), Math.max(...xs)];
}

/* What the Tauc baseline's own uncertainty adds to the subtracted slope s. With the
   window and its points held, s = Σ w_i·ln(F_i − F_b,i), w_i = (hν_i − mean)/S_xx, is a
   function of the baseline's slope and intercept through F_b = Y_b^(1/a)/hν,
   Y_b = m_b·hν + b_b, so
     J_m = ∂s/∂m_b = −Σ w_i·hν_i·F_b'(Y_i)/(F_i − F_b,i),  J_b = ∂s/∂b_b = −Σ w_i·F_b'(Y_i)/(F_i − F_b,i),
   F_b'(Y) = (1/a)·Y^(1/a − 1)/hν where Y > 0 (F_b is nothing, and so is its change,
   where it is not), and
     Var_b(s) = J Σ_b Jᵀ = J_m² σ²_m + J_b² σ²_b + 2 J_m J_b σ_mb,
   Σ_b the baseline fit's covariance. Its square root is returned times that fit's t
   factor (99%, n_b − 2), as each fit's term is in E_g (baseline). The derivatives are
   exact (no step to take), and finite wherever the window's points have a logarithm. */
export function subBaselineSlopeErr(U, regs, Yraw, rb, ta, hv, FR, Mb){
  if (!isFinite(regs.slope) || !regs.bestIdx || ![rb.varM, rb.varB, rb.covMB].every(isFinite)) return NaN;
  // The fit's own points: those of its window with a logarithm (scanRegr).
  const idx = regs.bestIdx.filter(i=> isFinite(Yraw[i]));
  if (idx.length < 3) return NaN;
  const mx = idx.reduce((t, i)=> t + hv[i], 0)/idx.length;
  const sxx = idx.reduce((t, i)=> t + (hv[i] - mx)**2, 0);
  let Jm = 0, Jb = 0;
  idx.forEach(i=>{
    const e = hv[i], y = rb.slope*e + rb.intercept;
    if (!(y > 0)) return;
    const dF = Math.pow(y, 1/ta - 1)/(ta*e), d = FR[i] - Math.pow(y, 1/ta)/e, w = (e - mx)/sxx;
    Jm -= w*e*dF/d; Jb -= w*dF/d;
  });
  const v = Jm*Jm*rb.varM + Jb*Jb*rb.varB + 2*Jm*Jb*rb.covMB;
  if (!isFinite(v)) return NaN;
  return Math.sqrt(Math.max(0, v))*U.tinv(T_Q, (rb.n || Mb) - 2);
}

/* The Urbach tail with the reference Tauc card's baseline taken out. That baseline is
   a line in the Tauc plot, Y_b = m·hν + b in [F(R)·hν]^a, so in F(R) it is
   F_b = Y_b^(1/a) / hν where Y_b > 0, and nothing where it is not. It is subtracted in
   F(R), where absorptions add up, and what is left goes through the card's own
   treatment: ln (nothing where F(R) − F_b ≤ 0), smoothing over N, the window scan
   between the same lines, the line fitted to the unsmoothed values. `r` the reference's
   baseline fit for the sample f, `ta` its exponent, `Mb` its baseline window; p the
   Urbach card's parameters, vl its lines. Null with no baseline fit. */
export function subtracted(U, r, ta, Mb, f, p, vl){
  if (!(isFinite(r.slope) && isFinite(r.intercept) && ta > 0)) return null;
  const hv = f.hv, FR = f.FR;
  const Fb = hv.map(e=>{ const y = r.slope*e + r.intercept; return y > 0 ? Math.pow(y, 1/ta)/e : 0; });
  const Yraw = FR.map((v, i)=> v - Fb[i] > 0 ? Math.log(v - Fb[i]) : NaN);
  // The points of F(R) ≤ 0 are left out, as in the plain curve, of the smoothing and the
  // scan: without a logarithm in either, they are no sign of the baseline. Counted with
  // those where it lies above F(R) (to v478), they blocked every window holding one,
  // and the card blamed the baseline for them. Those where it does stay in, as they
  // were: there the curve was measured and has no value, nor has an average holding one.
  const Ys = onFinite(Yraw, null, v=> U.movingAverage(v, p.N), i=> FR[i] > 0);
  const regs = scanRegr(U, hv.map((e, i)=> FR[i] > 0 ? e : NaN), Ys, p.M, vl.v1, vl.v2, Yraw, true);
  // How many points of F(R) > 0 between the lines lost their logarithm (F(R) ≤ F_b):
  // with too many there is no window to fit, and the card says why (and, with `neg`
  // of F(R) ≤ 0 there too, that its count is of the others).
  const lo = Math.min(vl.v1, vl.v2), hi = Math.max(vl.v1, vl.v2);
  let inside = 0, lost = 0, neg = 0;
  hv.forEach((e, i)=>{ if (e >= lo && e <= hi){ if (!(FR[i] > 0)) neg++; else { inside++; if (!isFinite(Yraw[i])) lost++; } } });
  // The baseline is to blame only where the region holds a window to fit: with fewer
  // points of F(R) > 0 than M the plain fit fails too, and the card says so already.
  const blocked = !isFinite(regs.slope) && lost > 0 && inside >= p.M;
  // E_U's error: the fit's own and the Tauc baseline's carried through the subtraction,
  // independent, so added in quadrature (each already times its own t factor).
  const fit = urbachEu(U, regs, p.M), m = regs.slope;
  const EuErrBase = subBaselineSlopeErr(U, regs, Yraw, r, ta, hv, FR, Mb)/(m*m);
  return { Fb, Yraw, Ys, regs, inside, lost, neg, blocked, Eu: fit.Eu, EuErr: Math.hypot(fit.EuErr, EuErrBase), EuErrFit: fit.EuErr, EuErrBase };
}

/* ---- The states: a per-sample entry, a card's settings ---- */
// A per-sample entry copied, its lines too (slots).
export const copyPer = p => p ? {...p, vlines: p.vlines ? {...p.vlines} : undefined} : {};
// A card's settings copied whole (JSON: they are plain data).
export const clone = o => JSON.parse(JSON.stringify(o));

/* ---- Reading a file ---- */
/* A spectrum (textdata.js: its encoding, separator, decimal mark and quotes found from
   the file), read in this order (from v510; the other formats as GC reads its own):
   - the standard format (drsStandard): its first two columns, the wavelength (nm) and
     %R or F(R) as its header says, read with no word, as to v509;
   - any other file: the columns its header names (drsColumns), read with a warning;
   - columns not named, or not one way only: the file is not loaded, and the alert says
     why (the error).
   The points that are no physical value are left out (drsPoints). The file itself is
   kept as it came (rawBytes), for its download, and read again as a project opens
   (restoredFile). One with no point left is not loaded, and the alert says so (one whose rows
   all had an empty cell went without a word, to v494). To v509 every file was read from
   its first two columns, the second as a header above it said: F(R) with no header (two
   bare columns of numbers), %R under a line naming it (a JASCO export's YUNITS,%R), and
   a row with an empty cell between its numbers (350,,0.5) left out, without a word. */
export function readDrs(text){
  const lines = textLines(text), t = readXY(lines), std = t && drsStandard(lines, t), c = std || drsColumns(lines);
  if (c.error) return { error: c.error };
  const { wl, FR, left } = drsPoints(c.t, c.R);
  if (!wl.length) return { error: Object.keys(left).length ? `no point with a physical value: ${leftText(left)}` : NO_DATA };
  const label = std ? sampleName(lines[0], t.sep) : '';
  return { wl, FR, warn: !std, ...(label ? { label } : {}), ...(c.R ? { read: 'R%' } : std ? {} : { head: true }), ...(Object.keys(left).length ? { left } : {}) };
}
/* The sample's name the standard format writes on its first line (the Cary's "S1,,"),
   the trace's name as it is loaded (v532; to v531 the file's, which a line with no name,
   or with more than one field, still gives). */
export function sampleName(line, sep){
  const f = (sep[0] === ' ' ? [line.replace(/"/g, '')] : splitFields(line, sep)).map(v=> v.trim()).filter(Boolean);
  return f.length === 1 ? f[0] : '';
}
/* The standard format, the Cary 5000's export, as the user's own files are: the sample's
   name on the first line, the columns' header on the second, "Wavelength (nm)" then "%R"
   (the reflectance in percent, R = value/100 and F(R) = (1 − R)²/2R) or "F(R)", nothing
   else in either (a unit after F(R), "(a.u.)" say, makes it another format), any case,
   any separators after them, and the data from the third, two columns of numbers
   (readXY), under whatever separator and decimal mark the reader finds (lines as it
   counts them: a blank one is none). Its rows are read from their first two fields: a
   row with an empty cell between its numbers (350,,0.5) gives 350 and nothing, and is
   left out, as to v509; the Cary writes none (each row is "wavelength,%R,"). Under a run
   of spaces, which may split the names too, the header is read whole, its quotes
   dropped. The one place that decides the standard (to v501 any header naming R% or
   F(R), on any line above the data, was standard, with no word).
   → { R: whether the column is %R, t: the two columns (readXY) } or null */
const STD_WL = /^wavelength\s*\(\s*nm\s*\)$/i, STD_R = /^%\s*r$/i, STD_F = /^f\s*\(\s*r\s*\)$/i;
const STD_LINE = /^wavelength\s*\(\s*nm\s*\)\s+(\S.*)$/i;
export function drsStandard(lines, t){
  if (t.rows.findIndex(r=> isFinite(parseNum(r[0])) && isFinite(parseNum(r[1]))) !== 2) return null;
  let h;
  if (t.sep[0] === ' '){ const m = STD_LINE.exec(lines[1].replace(/"/g, '').trim()); h = m && m[1].trim(); }
  else { const f = splitFields(lines[1], t.sep); while (f.length && f[f.length - 1] === '') f.pop(); h = f.length === 2 && STD_WL.test(f[0]) ? f[1] : null; }
  return h && (STD_R.test(h) || STD_F.test(h)) ? { R: STD_R.test(h), t } : null;
}
/* Any other file: its columns found by their names in its header, as GC finds its own
   (textdata.js readTable): the header the first line naming a wavelength column and one
   of F(R) or %R, the data the lines under it, the separator the one under which most
   lines are data (both those columns numbers), each column read by its place in the
   header, so that an empty cell in another column shifts nothing (350,,50 under
   "Wavelength,,%R" is 350 and 50). A first such line with no data under it (a title
   whose words under spaces name them, "Kubelka-Munk F(R) vs wavelength") is no header:
   the one nearest above the first line of data is, as drsReading read up from the data
   to v509. The names, any case:
     the wavelength in nm: Wavelength, λ or nm, with or without its unit, "(nm)", "[nm]",
       "/nm", "nm", "in nm", ", nm", "_nm", "nm." ("Wavelength nm."); a wavelength in
       another unit, Å, µm, eV, cm⁻¹… ("(eV)", "in eV"), is not read: said;
     F(R): F(R) anywhere in the name ("F(R) (a.u.)");
     the reflectance in percent: R%, %R, R %, % R, R (%), R [%], Reflectance (%)…
   Other columns are not read. Under a run of single spaces, which splits names too, the
   header's names are its words, each with the unit after it ('Wavelength (nm) R (%)':
   two; 'Wavelength nm % R': two, as drsReading read such a line whole to v509); under
   runs of two or more, its fields, else its words so.
   Columns named one way only, a wavelength and one of F(R) or %R: read, the second as it
   is named. Two wavelength columns, both F(R) and %R, two of either (a Cary export of
   several samples side by side), no such header: not read, and the error says why (to
   v509 those with two columns of numbers were read, as F(R) when no header named it; the
   others were refused with no reason).
   → { R: whether the column is %R, t: { rows: each line's two cells, x, y } } or { error } */
const R_HEAD = /^(r\s*%|%\s*r|(r|reflectance)\s*(\(\s*%\s*\)|\[\s*%\s*\]))$/i, F_HEAD = /f\s*\(r\)/i;
const WL_HEAD = /^((wavelength|λ)([\s,_]*(in\s+)?(\(\s*nm\.?\s*\)|\[\s*nm\.?\s*\]|\/\s*nm\.?|nm\.?))?|nm\.?)$/i, WL_UNIT = /^(wavelength|λ)([\s,_]*(in\s+)?(\(.*\)|\[.*\]|\/.*)|,?\s+in\s+\S.*)$/i;
const kindOf = s => WL_HEAD.test(s) ? 'wl' : F_HEAD.test(s) ? 'F' : R_HEAD.test(s) ? 'R' : WL_UNIT.test(s) ? 'unit' : '';
/* A line's words, each with what follows it in brackets, a lone '%' or '/unit': "% R" one
   word, its '%' not the word's before it; "Wavelength nm", "Wavelength in eV" one word. */
const WORDS = /((wavelength|λ),?\s+(in\s+[^\s([/]+|nm\.?(?=\s|$))|%\s*r(?![^\s([/])|[^\s([/]+)(\s*(\([^)]*\)|\[[^\]]*\]|%(?=\s|$)(?!\s+r(\s|$))|\/\s*[^\s([]+))*|\S+/gi;
const words = f => f.join(' ').match(WORDS) || [];
// The columns `names` names, when a wavelength and F(R) or %R among them (n: how many).
function columnsOf(names, n){
  const c = { wl: [], F: [], R: [] };
  names.forEach((s, i)=>{ const k = kindOf(s); if (c[k]) c[k].push(i); });
  if (!c.wl.length || !(c.F.length + c.R.length)) return null;
  return { ...c, x: c.wl[0], y: Math.min(...c.F, ...c.R), ...(n ? { n } : {}) };
}
function drsHead(f, sep){
  const c = sep === ' ' ? null : columnsOf(f);
  if (c || sep[0] !== ' ') return c;
  const w = words(f);
  return columnsOf(w, w.length);
}
const NO_HEAD = 'no header naming its columns: the wavelength in nm, and F(R) or %R', NO_DATA = 'no line of data read under its header';
// Whether a line is two numbers (its first two fields not empty) under `sep`.
const twoNums = (l, sep)=>{ const v = splitFields(l, sep).filter(c=> c !== ''); return isNum(v[0]) && isNum(v[1]); };
export function drsColumns(lines){
  const isRow = (r, c)=> isNum(r[c.x]) && isNum(r[c.y]), d = lines.findIndex(l=> SEPS.some(s=> twoNums(l, s)));
  let tb = readTable(lines, drsHead, isRow), h = d;
  // A line naming them with no data under it is no header: read again from the one
  // nearest above the first line of data.
  if (!tb){ while (--h >= 0 && !SEPS.some(s=> drsHead(splitFields(lines[h], s), s))); if (h > 0) tb = readTable(lines.slice(h), drsHead, isRow); }
  if (!tb) return { error: noColumns(lines, d) };
  const c = tb.cols, many = [c.wl.length > 1 && `${c.wl.length} wavelength columns`,
    c.F.length && c.R.length ? 'both F(R) and %R' : c.F.length > 1 ? `${c.F.length} F(R) columns` : c.R.length > 1 && `${c.R.length} %R columns`].filter(Boolean);
  if (many.length) return { error: `which columns to read cannot be told: its header names ${many.join(' and ')}` };
  const rows = tb.rows.map(r=> [r[c.x], r[c.y]]), x = [], y = [];
  for (const r of rows){ const a = parseNum(r[0]), b = parseNum(r[1]); if (isFinite(a) && isFinite(b)){ x.push(a); y.push(b); } }
  return { R: c.R.length > 0, t: { rows, x, y } };
}
/* Why no columns were found: the line nearest above the first line of data `d` (two
   numbers) that names any column of the kinds read is the header, and says what it lacks,
   its names read as the data's separator splits them (one under which that line is two
   numbers) into two or more: of those, the one naming the most kinds, the first so; under
   any other only when none does (a header written with ',' over data with ';', which
   ';' leaves whole). Its names both kinds there: a header with no line of data read under
   it (a ',' both the separator and the decimal mark, a blank cell under a run of spaces,
   more names than the data have fields, the header with one separator and the data with
   another). No such line: no header. */
function noColumns(lines, d){
  const at = d < 0 ? SEPS : SEPS.filter(s=> twoNums(lines[d], s));
  // A line's names under each separator in `ss` (under spaces its fields and its words, as
  // drsHead reads them), `min` or more, the kinds each names: the one naming the most.
  const named = (l, ss, min)=> ss.flatMap(s=>{ const f = splitFields(l, s); return s === '  ' ? [f, words(f)] : [s === ' ' ? words(f) : f]; })
    .filter(ns=> ns.length >= min).map(ns=>{ const k = {}; for (const n of ns){ const t = kindOf(n); if (t && !k[t]) k[t] = n; } return { k, n: !!(k.wl || k.unit) + !!(k.F || k.R) }; })
    .reduce((a, b)=> b.n > (a ? a.n : 0) ? b : a, null);
  for (let i = (d < 0 ? lines.length : d) - 1; i >= 0; i--){
    const { k } = named(lines[i], at, 2) || named(lines[i], SEPS, 1) || {};
    if (!k) continue;
    if (k.wl && (k.F || k.R)) return NO_DATA;
    const u = k.unit && k.unit.length > 40 ? k.unit.slice(0, 39) + '…' : k.unit;
    return 'its header names ' + [!k.wl && (u ? `the wavelength in another unit than nm (${u})` : 'no wavelength column in nm'), !k.F && !k.R && 'no F(R) or %R column'].filter(Boolean).join(' and ');
  }
  return NO_HEAD;
}
/* The points of a spectrum that are physical values, the others left out and counted by
   why: a wavelength not above 0 (wl), a reflectance outside 0–100 % (r) or of 0, where
   F(R) is ∞ (zero), F(R) below 0 (neg), a value that is no finite number (inf: a NaN or
   an Inf written in the file, a number past the doubles' range). To v494 they were kept,
   and the analysis left out of each curve it made the values it could not take (F(R) ≤ 0
   under a logarithm). */
export function drsPoints(t, R){
  const wl = [], FR = [], left = {}, out = k =>{ left[k] = (left[k] || 0) + 1; };
  t.x.forEach((x, i)=>{
    const v = t.y[i], F = R ? (1 - v/100)**2/(2*v/100) : v;
    if (!(x > 0)) out('wl');
    else if (R && !(v >= 0 && v <= 100)) out('r');
    else if (!isFinite(F)) out(R ? 'zero' : 'inf');
    else if (F < 0) out('neg');
    else { wl.push(x); FR.push(F); }
  });
  // (the rows x and y leave out: a wavelength beside a number that is no finite one)
  for (const r of t.rows) if (isFinite(parseNum(r[0])) && (isNum(r[1]) || /^[+-]?(nan|inf(inity)?)$/i.test(String(r[1] || '').trim())) && !isFinite(parseNum(r[1]))) out('inf');
  return { wl, FR, left };
}
// The points left out, said: how many, and why.
export const LEFT = { wl: 'a wavelength not above 0', r: 'R outside 0–100 %', zero: 'R = 0 %, where F(R) is infinite', neg: 'F(R) < 0', inf: 'a value that is no finite number' };
export function leftText(left){
  const ks = Object.keys(LEFT).filter(k=> left[k] > 0), n = ks.reduce((t, k)=> t + left[k], 0);
  return `${n} point${n > 1 ? 's' : ''} left out: ${ks.map(k=> `${left[k]} with ${LEFT[k]}`).join(', ')}`;
}
/* What the alerts say of a file (utils.js FILE ALERTS): how a file of no standard format
   was read (drsColumns), in the info (`read`), and the points left out, in the warning to
   check (`check`; v567: to v566 both in one warning, "Verify how these files were read:").
   To v501 the files of a non-standard format were named, no more. A file in the standard
   format has no word on how it was read: the file list's note says it (to v501 an R% file
   was said here, the Cary's own export as well; to v501 a header naming R% or F(R)
   anywhere above the data was a standard format). */
const WARNS = { R: 'not a standard format: its header names the reflectance in %, read as %R', F: 'not a standard format: its header names F(R), read as F(R)' };
export function fileNotes(f){
  return { read: f.warn ? [WARNS[f.read === 'R%' ? 'R' : 'F']] : [], check: f.left && Object.keys(LEFT).some(k=> f.left[k] > 0) ? [leftText(f.left)] : [] };
}
/* A file's bytes read (readDrs), kept by them: a drop's reading, and the file read again as a
   project opens (restoredFile), once a page. A reader that throws gives why (thrownWhy): the
   drop refuses the file, a project keeps the spectrum it holds (heldNote says so). */
const readings = new WeakMap();
export function readingOf(bytes, text){
  if (!readings.has(bytes)){ let r; try { r = readDrs(text === undefined ? decodeText(bytes) : text); } catch(e){ r = { error: thrownWhy(e) }; } readings.set(bytes, r); }
  return readings.get(bytes);
}
/* A file as a restore takes it (modkit RESTORED): its bytes a Uint8Array, or none (null);
   read again from them (readingOf), what they read as its spectrum and how it was read (READ),
   the rest of the record as it is. Where they read as none (bytes not stored, or ones the
   reader refuses: heldNote says so), the spectrum it holds: its wavelengths and F(R), the
   points with both a finite number and a wavelength above 0 (none: left out, null); how it was
   read (a format not standard, `warn`, with the column read, `read` or `head`), and the points
   left out at its load, as its notes say them. tauc.js fixes its spectrum (fixedSpectrum) and
   makes its energies from its wavelengths (withHv). */
const READ = ['wl', 'FR', 'warn', 'read', 'head', 'left'];
export function restoredFile(U, f0){
  const f = f0.rawBytes != null && !(f0.rawBytes instanceof Uint8Array) ? { ...f0, rawBytes: null } : f0, r = f.rawBytes ? readingOf(f.rawBytes) : null;
  if (r && !r.error){ const g = { ...f }; for (const k of READ) if (k in r) g[k] = r[k]; else delete g[k]; return g; }
  const p = U.finitePairs(f.wl, f.FR, x=> x > 0);
  if (!p || !p[0].length) return null;
  const { read, head, left, ...g } = f, n = U.isObj(left) ? Object.keys(LEFT).filter(k=> U.num(left[k], 0) > 0) : [], col = f.warn === true && read !== 'R%' && head === true;
  return { ...g, wl: p[0], FR: p[1], warn: f.warn === true && (read === 'R%' || col), ...(read === 'R%' ? { read } : {}), ...(col ? { head } : {}),
    ...(n.length ? { left: Object.fromEntries(n.map(k=> [k, left[k]])) } : {}) };
}
/* What a project opened says of a file plotted from the spectrum it holds, not read again from
   its bytes (restoredFile: none stored, or what the reader says of them), or ''. */
export function heldNote(f){
  const b = f.rawBytes instanceof Uint8Array ? f.rawBytes : null, r = b && readingOf(b);
  return r && !r.error ? '' : heldLine(b && r.error);
}

/* The reflectance in percent from F(R), whatever the file's second column was read as:
   the exact inverse of F = (1 − R)²/2R, R = 1 + F − √(F² + 2F), written as
   1/(1 + F + √(F² + 2F)), the same number without the two near-equal terms that cancel
   where F is large. For a file read as R% it gives its own values back, to round-off.
   F(R) < 0 (a project from before the points that are no physical value were left out
   may hold it) has none. */
export const reflOf = F => F >= 0 ? 100/(1 + F + Math.sqrt(F*F + 2*F)) : NaN;

// Union of all files' ranges (for shared overlay axes)
export function unionWl(U, files){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,U.minArr(f.wl)); hi=Math.max(hi,U.maxArr(f.wl)); }); return [lo,hi]; }
export function unionHv(U, files){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,U.minArr(f.hv)); hi=Math.max(hi,U.maxArr(f.hv)); }); return [lo,hi]; }

/* =========================================================
   A CARD'S PARAMETERS AND LINES
   P, the panel's state: `mode` 'shared' (every sample uses one common parameter set AND,
   but for a spec with ownLines, one common set of interval lines) or 'per' (each sample
   fully independent: its own parameters and interval-line positions); `shared`, the
   common parameters; `sharedVlines`, the common lines; `per`, each sample's
   {params..., vlines:{v1..}}; `suggested`, whether lines were placed by a suggestion yet.
   `files` the included files, with which `per` is aligned.
========================================================= */
/* What a parameter can be, and an interval-line set: as the fields take them (the
   exponent above 0, a smoothing window 1 or more, a regression window 2 or more), and
   every line of the spec's windows a number. A sample's own value that is none (a
   project read in may hold anything: modkit RESTORED) gives way to the common one, a
   line set to the default lines (to v494 a value that was no number made the fits NaN,
   an entry that was no object threw as the lines were put in it). */
const PARAM_OK = { a: v=> v > 0, N: v=> v >= 1, N2: v=> v >= 1, M: v=> v >= 2, M2: v=> v >= 2 };
export const okParam = (k, v)=> Number.isFinite(v) && PARAM_OK[k](v);
export const okLines = (U, spec, l)=> U.isObj(l) && spec.lineKeys.every(k=> Number.isFinite(l[k]));
export const paramsIn = (U, spec, o)=>{ const out = {}; if (U.isObj(o)) for (const k of spec.keys) if (okParam(k, o[k])) out[k] = o[k]; return out; };
export const linesIn = (U, spec, l)=> okLines(U, spec, l) ? Object.fromEntries(spec.lineKeys.map(k=> [k, l[k]])) : {};
// A sample's own entry: its parameters and its lines.
function perIn(U, spec, p){
  const o = paramsIn(U, spec, p);
  if (U.isObj(p) && okLines(U, spec, p.vlines)) o.vlines = linesIn(U, spec, p.vlines);
  return o;
}
// Resolve the effective params for a given file index
export function paramsOf(spec, P, i){
  const s = P.shared;
  const src = (P.mode==='per') ? (P.per[i] || {}) : s;
  const out = {};
  for (const k of spec.keys) out[k] = CLAMP[k](okParam(k, src[k]) ? src[k] : s[k]);
  return out;
}
// The default lines on the span of a file f.
export function defaultLinesOf(U, spec, f){
  const hv = f.hv, lo = U.minArr(hv), d = U.maxArr(hv) - lo;
  return spec.defaultLines(lo, d);
}
// The interval-line set used for sample i (shared object, or the sample's own)
// A spec with `ownLines` keeps every sample's lines its own whatever the mode, which
// then decides the parameters alone; a sample with none yet starts from the default lines.
export function vlinesFor(U, spec, P, files, i){
  if (P.mode==='shared' && !spec.ownLines) return P.sharedVlines;
  let pp = P.per[i]; if (!U.isObj(pp)) pp = P.per[i] = {};
  if (!okLines(U, spec, pp.vlines)) pp.vlines = defaultLinesOf(U, spec, files[i]);
  return pp.vlines;
}
// Every fit of a sample: each window's scan on its curve c (Yraw, Ys) over the energies
// hv, with its parameters p and between its lines vl.
export const fitsOf = (U, spec, p, vl, c, hv)=> spec.windows.map(w=> scanRegr(U, hv, c.Ys, p[w.M], vl[w.lo], vl[w.hi], c.Yraw));

// Per-sample slots follow the file list (added, removed, moved, left out: tauc.js slots).
export const fitPer = (P, files)=>{ if (P.per.length !== files.length) P.per = files.map((_,i)=> P.per[i] || {}); };
const clonePer = p => ({...p, vlines: p && p.vlines ? {...p.vlines} : undefined});
export const panelSnapshot = P =>({ mode: P.mode, shared: {...P.shared}, sharedVlines: {...P.sharedVlines}, per: P.per.map(clonePer), suggested: P.suggested });
// Whether a card's lines were placed: the common ones, or a sample's own.
const placedIn = (U, P)=> isFinite(P.sharedVlines.v1) || P.per.some(q=> U.isObj(q) && U.isObj(q.vlines));
/* A card waiting for its lines: none placed, none suggested (a card added, or put back from a
   state of none, while no file was there to suggest from, v589; a new card's state an older
   version saved, v587). tauc.js setupAnalysis suggests them as soon as a file is there, as for
   a card added with files (to v588 a card added with every file left out, or a project's
   opened so, kept the default lines once a file was taken back in). */
export const awaiting = (U, P)=> !P.suggested && !placedIn(U, P);
/* A card's settings put back (each value as paramsIn, linesIn and perIn take it: a
   project read in may hold anything), the per-sample list then fitted to the files. A spec
   whose lines are each sample's own (Urbach) has no common set: one an older state holds (to
   v568 an Urbach card's lines were common) is no parameter any more, not read (v587: to v586
   kept, and counted as lines placed). A state of no lines placed and no flag saying so is a
   new card's (awaiting its lines); one of lines and no flag, the user's (placed, kept). */
export function restorePanel(U, spec, P, s0, files){
  const s = U.isObj(s0) ? s0 : {};
  P.mode = s.mode === 'per' ? 'per' : 'shared';   // older snapshots stored a per-field object
  P.shared = { ...spec.defaults, ...paramsIn(U, spec, s.shared) };
  P.sharedVlines = spec.ownLines ? {} : linesIn(U, spec, s.sharedVlines);
  P.per = Array.isArray(s.per) ? s.per.map(q=> perIn(U, spec, q)) : files.map(()=>({}));
  // A state with no flag: the lines it holds, the common ones or a sample's own, are the
  // user's, placed (kept, not suggested again); none, not placed yet.
  P.suggested = s.suggested != null ? !!s.suggested : placedIn(U, P);
  fitPer(P, files);
}

// The values of the parameters' fields (`raw(k)` a field's text), as they are taken:
// the exponent when it is a number, a window rounded, at least its least.
export function fieldValues(keys, raw){
  const vals = {};
  for (const k of keys){
    const r = raw(k);
    if (k === 'a'){ const v = parseFloat(r); if (isFinite(v)) vals.a = v; }
    else vals[k] = CLAMP[k](+r || 0);
  }
  return vals;
}
// Values put in the store on show: the common one (all), or sample i's own (one).
export function storeValues(P, i, vals){
  if (P.mode==='shared') Object.assign(P.shared, vals);
  else { const pp = P.per[i] || (P.per[i]={}); Object.assign(pp, vals); }
}
/* The all/one toggle: 'all' = one common param set + shared interval lines; 'one' = every
   sample fully independent (params AND interval-line positions). Across the switch
   nothing jumps: to 'one', every sample starts from the common values and lines, each
   then changed on its own; to 'all', the common set becomes the one of the sample on
   show, i. */
export function switchMode(U, spec, P, files, i){
  const mode = P.mode==='shared' ? 'per' : 'shared';
  const seen = files.length ? paramsOf(spec, P, i) : null, seenLines = files.length && !spec.ownLines ? { ...vlinesFor(U, spec, P, files, i) } : null;
  P.mode = mode;
  if (mode==='per'){
    files.forEach((f,j)=>{
      const pp = P.per[j] || (P.per[j]={});
      spec.keys.forEach(k=>{ pp[k] = P.shared[k]; });
      if (!spec.ownLines) pp.vlines = { ...P.sharedVlines };
    });
  } else if (seen){
    spec.keys.forEach(k=>{ P.shared[k] = seen[k]; });
    if (seenLines) P.sharedVlines = seenLines;
  }
}

// ---- Auto-suggested interval-line positions ----
// Where the lines go is the spec's to say: `suggest` places them for one sample (given
// its parameters and its curves, `curves(i, p)`), `combine` makes one set for every
// sample out of theirs (all mode). Either is kept inside the energy range it applies to.
const clampTo = (lo, hi)=> l =>{ const o = {}; for (const k in l) o[k] = Math.max(lo, Math.min(hi, l[k])); return o; };
export function suggestOne(U, spec, P, files, i, curves){
  const p = paramsOf(spec, P, i), l = spec.suggest(i, p, ()=> curves(i, p), U);
  if (!l) return null;
  const hv = files[i].hv, n = hv.length;
  return clampTo(Math.min(hv[0], hv[n-1]), Math.max(hv[0], hv[n-1]))(l);
}
function suggestShared(U, spec, P, files, curves){
  const ss = files.map((f,i)=>suggestOne(U, spec, P, files, i, curves)).filter(Boolean);
  if (!ss.length) return null;
  let lo=Infinity, hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,U.minArr(f.hv)); hi=Math.max(hi,U.maxArr(f.hv)); });
  return clampTo(lo, hi)(spec.combine(ss));
}
// Apply suggestions to the whole workspace: every sample, whatever the mode; the
// mode only decides whether they share one set of lines or each keep its own.
export function autoSuggestAll(U, spec, P, files, curves){
  if (!files.length) return;
  P.suggested = true;
  if (P.mode==='per' || spec.ownLines){ files.forEach((f,i)=>{ const s=suggestOne(U, spec, P, files, i, curves); if (s){ if(!P.per[i]) P.per[i]={}; P.per[i].vlines = s; } }); }
  else { const s = suggestShared(U, spec, P, files, curves); if (s) P.sharedVlines = s; }
}
// One sample's own lines placed again by the suggestion.
export function suggestAt(U, spec, P, files, i, curves){ const s = suggestOne(U, spec, P, files, i, curves); if (s){ if (!P.per[i]) P.per[i] = {}; P.per[i].vlines = s; } }

/* ---- What a card's plot draws ---- */
// The curve's range on the plot: [lo, hi] of the y-axis, from zero for Tauc (a little
// above its top), padded 5 % either way for a log.
export function curveRange(U, spec, Yraw){
  const rLo = spec.zeroFloor ? 0 : U.minArr(Yraw), rHi = U.maxArr(Yraw), pad = spec.zeroFloor ? 0 : 0.05*(rHi - rLo);
  return [rLo - pad, spec.zeroFloor ? rHi*1.05 : rHi + pad];
}
// The curve as read, smoothed, and its derivative. The derivative is drawn rescaled
// onto the curve's own span, from the floor the curve is drawn from: zero for
// Tauc, its own minimum for a log.
export function curveTraces(U, spec, c){
  const yLo = spec.zeroFloor ? 0 : U.minArr(c.Ys), yHi = U.maxArr(c.Ys);
  const onSpan = (arr, lo, hi)=> arr.map(v=> (hi-lo)>0 ? yLo + (v-lo)/(hi-lo)*(yHi-yLo) : v);
  // The grey XRPD draws its raw pattern in: white vanished on the light theme and on
  // the white of every exported image.
  return [
    { ys: c.Yraw, color: '#6a7585', width: 1,   name: 'raw',        key: 'raw' },
    { ys: c.Ys,   color: '#3aa0ff', width: 1.4, name: 'smoothed',   key: 'smoothed' },
    { ys: onSpan(c.dYs, U.minArr(c.dYs), U.maxArr(c.dYs)), color: '#5fcf6a', width: 1, name: 'derivative', key: 'derivative' },
  ];
}
// A window's fit as the card shows it: the fit when the lines hold as many points with a
// value as the window (as scanRegr takes them: counted all, to v478, an interval of F(R)
// ≤ 0 had no fit and the card no word why), else null.
export function windowFit(w, vl, hv, Ys, p, fit){
  const lo = Math.min(vl[w.lo], vl[w.hi]), hi = Math.max(vl[w.lo], vl[w.hi]);
  const sel = hv.filter((v, i)=> v>=lo && v<=hi && isFinite(Ys[i])).length;
  return sel >= p[w.M] ? fit : null;
}
// A fit's NRMSE and R² as the card writes them ('-': none).
export const statText = (reg, k)=> reg && isFinite(reg[k]) ? reg[k].toFixed(4) : '-';
// A fitted line over its window's points (xb, yb), and over the whole span in 100 points
// (xe, ye): the plot draws the one solid and the other dashed.
export function fitLines(U, reg, hv){
  const xb = reg.bestIdx.map(i=>hv[i]), xe = U.linspace(U.minArr(hv), U.maxArr(hv), 100);
  return { xb, yb: xb.map(x=>reg.slope*x+reg.intercept), xe, ye: xe.map(x=>reg.slope*x+reg.intercept) };
}
// An Urbach card's subtracted fit's error, said in its two parts (none: '').
export const subErrTitle = sb => sb && isFinite(sb.EuErrBase)
  ? `± ${(sb.EuErrFit*1000).toFixed(1)} meV from the fit, ± ${(sb.EuErrBase*1000).toFixed(1)} meV from the Tauc baseline, in quadrature` : '';

/* ---- References and names ---- */
/* Point every Urbach card at its reference: one chosen by hand while it is still a Tauc
   analysis, else the nearest Tauc card above it, else none (records: the cards in order;
   byId, a record by its id). Returns the cards whose reference changed. */
export function fixRefs(records, byId){
  let above = null;
  const changed = [];
  records.forEach(a=>{
    if (a.type === 'tauc'){ above = a; return; }
    if (!a.refAuto && a.ref != null && !(byId(a.ref) && byId(a.ref).type === 'tauc')) a.refAuto = true;
    const ref = a.refAuto ? (above ? above.id : null) : a.ref;
    if (ref !== a.ref){ a.ref = ref; changed.push(a); }
  });
  return changed;
}
// A Tauc card's automatic name, from the exponents of its samples `as`: the transition
// they stand for; mixed exponents (one mode) have none.
export function taucName(as){
  const ex = as.every(v=> v === as[0]) && expOf(as[0]);
  return ex ? `Tauc: ${ex.name}` : 'Tauc';
}

/* ---- The states of the cards ---- */
// A record's own fields, beside the deck's: `ref` is the Tauc reference's id, picked
// by the default rule while `refAuto` is on. `states` keeps the settings of the kind
// not on show.
export const newFields = ()=> ({ ref: null, refAuto: true, egSel: EG_METHODS.map(m=>m.key), states: {} });
/* A card's own fields as a state holds them, each as it should be (modkit RESTORED): the
   settings of a kind the module has, each an object, its per-sample list an array (the
   file list keeps a kind's not on show aligned too: slots) without the entries of the
   files the restore left out (`gone`). */
export function readAnalysis(U, s, gone){
  const eg = Array.isArray(s.egSel) ? s.egSel.filter(k=> EG_METHODS.some(m=> m.key === k)) : [];
  // (an Urbach card's urbSel, the E_U chips' choice to v535, is left out: both are shown)
  return {
    ref: Number.isInteger(s.ref) ? s.ref : null, refAuto: s.refAuto !== false,
    egSel: eg.length ? eg : EG_METHODS.map(m=>m.key),
    states: Object.fromEntries(Object.entries(clone(U.isObj(s.states) ? s.states : {})).filter(([k, v])=> U.ownKey(KINDS, k) && U.isObj(v))
      .map(([k, v])=> [k, { ...v, per: Array.isArray(v.per) ? U.without(v.per, gone) : [] }])),
  };
}

/* ---- The Results ---- */
/* A Tauc card's chart's words, from each sample's exponent `aVals`: when uniform, shown
   on the shared Tauc axis (otherwise a generic "a": samples may use different
   exponents); with mixed exponents (one mode) there is no single Direct/Indirect
   qualifier, so it is dropped from the title and the axis label. A forbidden transition
   says so in the title only: the axis has no room for it on a phone. */
export function taucLabels(aVals){
  const aUniform = aVals.every(v=>v===aVals[0]);
  const aLabel = aUniform ? fmtA(aVals[0]) : 'a';
  const ex = aUniform ? expOf(aVals[0]) : null, egLabel = ex ? ex.gap : '';
  return { aLabel, egLabel, title: (egLabel ? (ex.forbidden ? 'Forbidden ' : '') + egLabel + ' ' : '') + 'Energy Band Gap' };
}
// The E_g series on show (egSel), each sample's value and error.
export function egSeries(fits, egSel){
  const vals = { x: fits.map(r=>r.Eg),    b: fits.map(r=>r.EgInt) };
  const errs = { x: fits.map(r=>r.EgErr), b: fits.map(r=>r.EgIntErr) };
  return EG_METHODS.filter(m=> egSel.includes(m.key)).map(m=> ({ ...m, vals: vals[m.key], errs: errs[m.key] }));
}
// An Urbach card's E_U, plain (p) and subtracted (s), in meV as the card shows it: each
// a series of its own.
export function euSeries(fits){
  const vals = { p: fits.map(r=> r.Eu*1000), s: fits.map(r=> r.sub ? r.sub.Eu*1000 : NaN) };
  const errs = { p: fits.map(r=> r.EuErr*1000), s: fits.map(r=> r.sub ? r.sub.EuErr*1000 : NaN) };
  return URB_METHODS.map(m=> ({ ...m, vals: vals[m.key], errs: errs[m.key] }));
}
// Why the subtracted series may be missing (`hasRef`: a Tauc reference), said under its plot.
export const noSubWhy = (hasRef, fits)=> !hasRef ? 'No Tauc reference: nothing to subtract'
  : fits.every(r=> !r.sub) ? "The Tauc reference's baseline has no fit: nothing to subtract"
  : 'No subtracted fit for any sample: the Tauc baseline lies above F(R) in the Urbach region (the card says where)';
/* One of an Urbach card's two plots' y-range: each sample's curve (`ys[k]`; null: none)
   on its energies `hvs[k]`. The plain curves (`plain`) are ranged in full; a subtracted
   curve runs down without end where F(R) − F_b goes to zero, below the tail, so those are
   ranged from each one's Urbach region up (`from(k)`, its lower line), the bottom at
   their 5th percentile there. → [lo, hi], padded 5 % either way. */
export function urbachRange(ys, hvs, plain, from){
  let yLo = Infinity, yHi = -Infinity;
  ys.forEach((y, k)=>{
    if (!y) return;
    const f = plain ? -Infinity : from(k);
    const v = y.filter((t, i)=> isFinite(t) && hvs[k][i] >= f).sort((x, z)=> x - z);
    if (!v.length) return;
    yLo = Math.min(yLo, plain ? v[0] : v[Math.floor(0.05*(v.length - 1))]);
    yHi = Math.max(yHi, v[v.length - 1]);
  });
  if (!(yLo < yHi)){ yLo = 0; yHi = 1; }
  const pad = 0.05*(yHi - yLo);
  return [yLo - pad, yHi + pad];
}
// The Results' log plot: each sample's log10 F(R) (none where F(R) ≤ 0, `logs`), and its
// y-range over them, padded (with none, −1 to 0).
export function logRange(logs){
  let lo = Infinity, hi = -Infinity;
  logs.forEach(a=> a.forEach(v=>{ if (isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
  if (!isFinite(lo)){ lo = -1; hi = 0; }
  const pad = 0.04 * Math.max(hi - lo, 0.1);
  return [lo - pad, hi + pad];
}
export const log10Of = FR => FR.map(v=> v > 0 ? Math.log10(v) : NaN);

/* ---- The CSVs ---- */
// The reflectance once (F(R), R in %, F(R) against the energy), each sample's columns.
export function spectraCsvs(U, files){
  const entries = [];
  // reflectance_FR.csv — (wavelength, F(R)) per sample
  {
    const cols=[];
    files.forEach(f=>{
      cols.push({h:'wavelength_nm_'+f.label, v:f.wl.map(x=>U.fmtNum(x,6))});
      cols.push({h:f.label,                  v:f.FR.map(x=>U.fmtNum(x,6))});
    });
    entries.push({name:'reflectance_FR.csv', text:U.wideCsv(cols)});
  }
  // reflectance_R.csv — (wavelength, R in %) per sample: the Reflectance plot's data
  // (a point with no R, empty)
  {
    const cols=[];
    files.forEach(f=>{
      cols.push({h:'wavelength_nm_'+f.label, v:f.wl.map(x=>U.fmtNum(x,6))});
      cols.push({h:'R_percent_'+f.label,     v:f.FR.map(x=>U.fmtNum(reflOf(x),6))});
    });
    entries.push({name:'reflectance_R.csv', text:U.wideCsv(cols)});
  }
  // FR_vs_energy.csv — (energy, F(R)) per sample: the log-scale plot's data, as values
  {
    const cols=[];
    files.forEach(f=>{
      cols.push({h:'energy_eV_'+f.label, v:f.hv.map(x=>U.fmtNum(x,6))});
      cols.push({h:f.label,              v:f.FR.map(x=>U.fmtNum(x,6))});
    });
    entries.push({name:'FR_vs_energy.csv', text:U.wideCsv(cols)});
  }
  return entries;
}
// A Tauc card's files, prefixed with its name n: `params(k)` and `fits[k]` sample k's.
export function taucCsvs(U, n, files, params, fits){
  const entries = [];
  // tauc_plot.csv — per sample: energy, [F(R)·hν]^a, linear-region regression,
  // baseline regression (both evaluated on the sample's own energy grid)
  {
    const cols=[];
    files.forEach((f,k)=>{
      const r = fits[k];
      cols.push({h:'energy_eV_'+f.label,       v:f.hv.map(x=>U.fmtNum(x,6))});
      // The curve as plotted and fitted: smoothed with the card's window.
      const fp = params(k), Ys = smoothY(U, f.FR.map((v,i)=> Math.pow(v*f.hv[i], fp.a)), fp.N);
      cols.push({h:f.label,                    v:Ys.map(v=> U.fmtNum(v,6))});
      cols.push({h:f.label+'_reg_linear',      v:f.hv.map(hv=> U.fmtNum(r.regs.slope*hv  + r.regs.intercept, 6))});
      cols.push({h:f.label+'_reg_baseline',    v:f.hv.map(hv=> U.fmtNum(r.regs2.slope*hv + r.regs2.intercept, 6))});
    });
    entries.push({name:`${n} - tauc_plot.csv`, text:U.wideCsv(cols)});
  }
  // Eg.csv — bar-plot-like summary (one row per sample), both Eg estimates + errors
  {
    let t = U.csvLine(['Sample','Eg','Eg_err','Eg_baseline','Eg_baseline_err']);
    files.forEach((f,k)=>{
      const r = fits[k];
      t += U.csvLine([f.label, U.fmtNum(r.Eg,6), U.fmtNum(r.EgErr,6), U.fmtNum(r.EgInt,6), U.fmtNum(r.EgIntErr,6)]);
    });
    entries.push({name:`${n} - Eg.csv`, text:t});
  }
  // analysis_info.csv — per-sample regression settings & results (the info that
  // is otherwise only readable off the Analysis plot). Endpoints are in eV, taken
  // from the best-fit window; R²/NRMSE are the fit-quality metrics for each line. (v515
  // to v519 gave widths in eV and the points fitted; to v520 the points again.)
  {
    let t = U.csvLine(['Sample','Tauc Exponent','Smoothing points',
      'Tauc regression points','Tauc start (eV)','Tauc end (eV)','Tauc R^2','Tauc NRMSE',
      'Baseline regression points','Baseline start (eV)','Baseline end (eV)','Baseline R^2','Baseline NRMSE']);
    files.forEach((f,k)=>{
      const fp = params(k), r = fits[k];
      const span = (reg) => {
        const idx = reg && reg.bestIdx;
        if (!idx || !idx.length) return ['',''];
        let lo=Infinity, hi=-Infinity;
        idx.forEach(i=>{ const e=f.hv[i]; if(e<lo)lo=e; if(e>hi)hi=e; });
        return [U.fmtNum(lo,6), U.fmtNum(hi,6)];
      };
      const [ts,te] = span(r.regs), [bs,be] = span(r.regs2);
      t += U.csvLine([f.label, +fp.a.toFixed(6), fp.N, fp.M, ts, te,
        isFinite(r.regs.R2)?U.fmtNum(r.regs.R2,6):'', isFinite(r.regs.NRMSE)?U.fmtNum(r.regs.NRMSE,6):'',
        fp.M2, bs, be,
        isFinite(r.regs2.R2)?U.fmtNum(r.regs2.R2,6):'', isFinite(r.regs2.NRMSE)?U.fmtNum(r.regs2.NRMSE,6):'']);
    });
    entries.push({name:`${n} - analysis_info.csv`, text:t});
  }
  return entries;
}
// An Urbach card's files, prefixed with its name n: `params(k)` and `fits[k]` sample k's.
export function urbachCsvs(U, n, files, params, fits){
  const entries = [];
  // urbach_plot.csv — per sample: energy, ln F(R) and the Urbach regression, on the
  // sample's own grid (F(R) ≤ 0 has no logarithm: left empty)
  {
    const cols=[];
    files.forEach((f,k)=>{
      const r = fits[k].regs;
      cols.push({h:'energy_eV_'+f.label,  v:f.hv.map(x=>U.fmtNum(x,6))});
      // As plotted and fitted: smoothed with the card's window.
      const Ys = smoothY(U, f.FR.map(v=> v > 0 ? Math.log(v) : NaN), params(k).N);
      cols.push({h:f.label,               v:Ys.map(v=> isFinite(v) ? U.fmtNum(v,6) : '')});
      cols.push({h:f.label+'_reg_urbach', v:f.hv.map(hv=> isFinite(r.slope) ? U.fmtNum(r.slope*hv + r.intercept, 6) : '')});
      // With the reference Tauc card's baseline taken out of F(R) (empty with none).
      const sb = fits[k].sub, g = sb && sb.regs;
      cols.push({h:f.label+'_subtracted',            v:f.hv.map((_, i)=> sb && isFinite(sb.Ys[i]) ? U.fmtNum(sb.Ys[i],6) : '')});
      cols.push({h:f.label+'_reg_urbach_subtracted', v:f.hv.map(hv=> g && isFinite(g.slope) ? U.fmtNum(g.slope*hv + g.intercept, 6) : '')});
    });
    entries.push({name:`${n} - urbach_plot.csv`, text:U.wideCsv(cols)});
  }
  // Eu.csv — bar-plot-like summary, E_U and its error in meV as the chart shows them
  {
    // The subtracted E_U's error, then its two parts: the fit's and the Tauc baseline's.
    let t = U.csvLine(['Sample','Eu_meV','Eu_err_meV','Eu_subtracted_meV','Eu_subtracted_err_meV','Eu_subtracted_err_fit_meV','Eu_subtracted_err_baseline_meV']);
    const meV = v => isFinite(v) ? U.fmtNum(v*1000,6) : '';
    files.forEach((f,k)=>{
      const r = fits[k], sb = r.sub || {};
      t += U.csvLine([f.label, meV(r.Eu), meV(r.EuErr), meV(sb.Eu), meV(sb.EuErr), meV(sb.EuErrFit), meV(sb.EuErrBase)]);
    });
    entries.push({name:`${n} - Eu.csv`, text:t});
  }
  return entries;
}
