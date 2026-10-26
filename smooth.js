/* =========================================================
   Smoothing by a width on the x axis (°2θ, mT, eV), not by a number of points: one width
   smooths alike data measured at different steps. Pure functions, with no page (Node's
   tests import them as they are).
   The smoothed value at a point is the mean of the line through the points over a window
   w wide centred on it, [x − w/2, x + w/2], cut short at the ends of the data: the box
   convolution of the curve the plot draws, exact on any spacing, x running up or down.
   On an even grid at w = N steps it is the centred moving average of an even N (N + 1
   points, the two ends at half weight: utils.js movingAverage), to rounding; an odd N's
   box edges fall in the middle of the end cells, (⅛, ⅞, 1, …, 1, ⅞, ⅛)/N, a quarter step²
   wider in variance; and the end point, where the line stops, counts half.
========================================================= */

// The mean step of an axis, as the peak search takes it: its span over its intervals.
export function meanStep(x){
  const n = x ? x.length : 0;
  return n > 1 ? Math.abs(x[n-1] - x[0])/(n - 1) : NaN;
}

/* The box mean of y over x at every point (above), from the running area of the line
   (trapezoids): F(t) = ∫ from the first point to t, the mean over [a, b] (F(b) − F(a))/(b − a),
   both ends found by two pointers moving one way, O(n). w ≤ 0 (or no number), or fewer
   than two points: the data as they are. Two points at one x are a cell of no width,
   which weighs nothing. A point whose x or y is no number is left out (the running area
   would carry it to every point after): the line runs through the others, smoothed as
   they would be without it (as a project reopened has them, its pairs that are no
   numbers dropped), and it keeps its value (to v510 the moving average lost the N + 1
   values about it). */
export function boxSmooth(x, y, w){
  const n = y.length;
  if (!(w > 0) || n < 2) return Array.from(y);
  let ok = null;
  for (let k = 0; k < n; k++) if (!(Number.isFinite(x[k]) && Number.isFinite(y[k]))){ ok = []; break; }
  if (ok){
    for (let k = 0; k < n; k++) if (Number.isFinite(x[k]) && Number.isFinite(y[k])) ok.push(k);
    const out = Array.from(y), sm = boxSmooth(ok.map(k=> x[k]), ok.map(k=> y[k]), w);
    ok.forEach((k, j)=>{ out[k] = sm[j]; });
    return out;
  }
  const s = x[n-1] < x[0] ? -1 : 1, u = k => s*x[k];
  const C = new Float64Array(n);
  for (let k = 1; k < n; k++) C[k] = C[k-1] + (y[k-1] + y[k])/2*(u(k) - u(k-1));
  // the area up to t, t in the cell [u_k, u_k+1]
  const F = (t, k)=>{ const d = u(k+1) - u(k), L = d > 0 ? y[k] + (y[k+1] - y[k])*(t - u(k))/d : y[k]; return C[k] + (y[k] + L)/2*(t - u(k)); };
  const lo = u(0), hi = u(n-1), h = w/2, out = new Array(n);
  let ka = 0, kb = 0;
  for (let i = 0; i < n; i++){
    const a = Math.max(lo, u(i) - h), b = Math.min(hi, u(i) + h);
    if (!(b > a)){ out[i] = y[i]; continue; }
    while (ka < n-2 && u(ka+1) <= a) ka++;
    while (kb < n-2 && u(kb+1) <= b) kb++;
    out[i] = (F(b, kb) - F(a, ka))/(b - a);
  }
  return out;
}

/* The weights boxSmooth gives the points at point i: Map index → weight, summing to 1.
   A cell [x_k, x_k+1] the window [a, b] covers over [p, q] gives y_k+1 len·(t_p + t_q)/2 and
   y_k len·(1 − (t_p + t_q)/2), len = q − p and t the fraction of the cell; all over b − a.
   w ≤ 0: the point alone. (For the counting uncertainty of what is read off the smoothed
   curve: the covariance of two smoothed points is Σ_k w_ik·w_jk·var(y_k).) */
export function boxWeights(x, i, w){
  const n = x.length, out = new Map();
  if (!(w > 0) || n < 2){ out.set(i, 1); return out; }
  const s = x[n-1] < x[0] ? -1 : 1, u = k => s*x[k];
  const a = Math.max(u(0), u(i) - w/2), b = Math.min(u(n-1), u(i) + w/2);
  if (!(b > a)){ out.set(i, 1); return out; }
  let k = Math.min(i, n-2);
  while (k > 0 && u(k) > a) k--;
  const add = (j, v)=>{ if (v) out.set(j, (out.get(j) || 0) + v/(b - a)); };
  for (; k < n-1 && u(k) < b; k++){
    const d = u(k+1) - u(k), p = Math.max(a, u(k)), q = Math.min(b, u(k+1));
    if (!(d > 0 && q > p)) continue;
    const t = ((p - u(k)) + (q - u(k)))/(2*d);
    add(k, (q - p)*(1 - t)); add(k+1, (q - p)*t);
  }
  return out;
}

/* ---- A width's field (XRPD, EPR) ----
   A width is shown to 4 significant digits and kept as it is (one converted from points,
   10 × 0.0130039°, stays that); beside it, in its field, what it spans in points of the
   data, the step being that of the file on show. */
export const widthText = v => Number.isFinite(v) ? String(+v.toPrecision(4)) : '';
// A number of points as the field says it: whole from 10, two digits below.
export const ptsNum = p => p >= 9.5 ? String(Math.round(p)) : String(+p.toPrecision(2));
export const ptsText = p => `≈ ${ptsNum(p)} ${ptsNum(p) === '1' ? 'pt' : 'pts'}`;
