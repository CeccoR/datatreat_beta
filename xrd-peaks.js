/* =========================================================
   XRPD — the peak analysis (Scherrer).
   A panel of its own on some files: the raw pattern, its smoothing (smooth.js),
   the SNIP baseline and the peaks found on what is left, with their FWHM and, for
   the samples, the Scherrer crystallite size of each. Made for a card (the samples,
   several cards each with its own parameters) or for the instrumental standard (one
   file, its own parameters, and the Caglioti fit of its widths that corrects the
   samples' sizes for the instrument's).
========================================================= */
import { esc, fmtNum, csvLine, linspace, interpLinear, meanArr, stdArr, maxArr, minArr, X_SVG, guardNumericInput, guardNumberInputs, fitCsvIcons, barNames, barChipYmax, NORM_OPTIONS, normOf, keeper } from './utils.js';
import { svgEl, Plot, axisReadout } from './plot.js';
import { boxSmooth, boxWeights, meanStep, widthText, ptsText } from './smooth.js';
import { PLOT_DL_ICON, CSV_ICON } from './modcharts.js';

/* A view (a plot, a table, a chart, a legend) is drawn again only when what it is drawn
   from changed: each keeps the key of its inputs as last drawn, the objects among them by
   a number of their own (idOf: the same object, the same number; a pattern's arrays and a
   processing kept, below, stay the same objects), and its size on the page (sizeOf: 0 when
   out of sight, so that a view drawn hidden is drawn again when shown). Up to v490 every
   edit drew every view of the card again, and a label changed or the standard's peaks did
   so in every card: with 12 patterns, 90 ms for a K changed, 160 for a label. A value
   that is no object is there as itself (a WeakMap takes no such key). */
const ids = new WeakMap();
let nid = 0;
const idOf = o => o == null ? '-' : typeof o !== 'object' && typeof o !== 'function' ? typeof o + ':' + String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
const sizeOf = el => { if (!el) return '-'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
// (a plot at the range it was drawn with: not zoomed nor panned)
const atOrigin = P => P.xmin === P._origXmin && P.xmax === P._origXmax && P.ymin === P._origYmin && P.ymax === P._origYmax;
/* A pattern's processing (reprocessOne), kept by its intensities (utils.js keeper): its
   smoothing and baseline by their widths (k1), its peaks by those and the peak search and
   the peaks added and removed by hand (k2); and the standard's instrumental model by its
   processing (modelOf). A tab woken, an undo to widths used before, a card made again
   take them as made (to v517 a card kept its own, and a tab shown again made all again). */
const smoothKept = keeper('xrd-smoothing'), procKept = keeper('xrd-peaks', 8), modelOf = new WeakMap();

// Index of the grid point nearest to a 2θ, by bisection: an axis need not be even (a scan
// with points left out, xrd-instr.js, or listed positions). Up to v484 it was taken as
// even, and an index came out as many points off as were missing before it.
function nearestIdx(x, pos){
  if (!x || !x.length) return 0;
  const n = x.length, s = x[n-1] < x[0] ? -1 : 1;
  if (!(s*pos > s*x[0])) return 0;
  if (!(s*pos < s*x[n-1])) return n-1;
  let lo = 0, hi = n-1;
  while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (s*x[mid] <= s*pos) lo = mid; else hi = mid; }
  return Math.abs(pos - x[lo]) <= Math.abs(x[hi] - pos) ? lo : hi;
}
// The highest point within ±win of idx.
function refineIdx(y, idx, win){
  let best = idx;
  const lo = Math.max(0, idx-win), hi = Math.min(y.length-1, idx+win);
  for (let j=lo; j<=hi; j++) if (y[j] > y[best]) best = j;
  return best;
}
// A small dense linear system by Gauss–Jordan with partial pivoting; null if singular.
function solveLinear(A, b){
  const n=b.length, M=A.map((r,i)=>r.concat(b[i]));
  for (let c=0;c<n;c++){
    let piv=c; for (let r=c+1;r<n;r++) if (Math.abs(M[r][c])>Math.abs(M[piv][c])) piv=r;
    if (Math.abs(M[piv][c])<1e-12) return null;
    [M[c],M[piv]]=[M[piv],M[c]];
    for (let r=0;r<n;r++){ if (r===c) continue; const f=M[r][c]/M[c][c]; for (let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; }
  }
  const z=new Array(n); for (let i=0;i<n;i++) z[i]=M[i][n]/M[i][i];
  return z;
}

/* SNIP baseline: each point clipped down to the mean of the curve k steps either side, k
   from K = W / step (rounded, 1 at least) down to 1: W is the half-width in °2θ over which
   a peak is cut away. Up to v510 it was K itself, in points (blWin): the same K at a step
   twice as large clipped twice as wide. On an even grid the points k away, as then; on
   one with points left out or listed positions (an uneven one), the line through the
   points at x ± k·step. No pass past (n − 1)/2 steps has both sides within the pattern:
   K stops there, which changes nothing. */
function computeBaseline(x, y, W){
  const n = y.length, step = meanStep(x);
  const K = Math.min(Math.floor((n-1)/2), Math.max(1, Math.round(W/step) || 1));
  const z = Float64Array.from(y);
  let even = step > 0;
  for (let i = 1; even && i < n; i++) even = Math.abs(x[i] - x[i-1] - step) <= 1e-6*step;
  if (even){
    for (let w = K; w >= 1; w--){
      for (let i = w; i < n-w; i++){
        const avg = (z[i-w] + z[i+w]) / 2;
        if (avg < z[i]) z[i] = avg;
      }
    }
    return Array.from(z);
  }
  /* The 2θ read once into an array of their own (x running up), the line read in place.
     A pass starts at the first point whose left side is within the pattern, the cell of
     its right side found from the last pass's (both move down as the distance shrinks),
     and both sides' cells move up with the point: each pass costs as the even grid's, its
     points, not its distance (a W of many steps on 20000 listed positions, seconds else). */
  const s = x[n-1] < x[0] ? -1 : 1, u = Float64Array.from(x, v=> s*v), lo = u[0], hi = u[n-1];
  let i0 = n - 1, kb0 = Math.max(0, n - 2);
  for (let w = K; w >= 1; w--){
    const d = w*step;
    while (i0 > 0 && u[i0-1] - d >= lo) i0--;
    while (kb0 > 0 && u[kb0] > u[i0] + d) kb0--;
    let ka = 0, kb = kb0;
    for (let i = i0; i < n; i++){
      const a = u[i] - d, b = u[i] + d;
      if (a < lo) continue;
      if (b > hi) break;
      while (ka < n-2 && u[ka+1] <= a) ka++;
      while (kb < n-2 && u[kb+1] <= b) kb++;
      const da = u[ka+1] - u[ka], db = u[kb+1] - u[kb];
      const avg = ((da > 0 ? z[ka] + (z[ka+1] - z[ka])*(a - u[ka])/da : z[ka]) + (db > 0 ? z[kb] + (z[kb+1] - z[kb])*(b - u[kb])/db : z[kb])) / 2;
      if (avg < z[i]) z[i] = avg;
    }
  }
  return Array.from(z);
}

// Compute prominence of each local maximum
function peakProminence(y, idx){
  const h = y[idx];
  let leftBase = h, rightBase = h;
  for (let i=idx-1; i>=0; i--){ if (y[i]<leftBase) leftBase=y[i]; if (y[i]>h) break; }
  for (let i=idx+1; i<y.length; i++){ if (y[i]<rightBase) rightBase=y[i]; if (y[i]>h) break; }
  return h - Math.max(leftBase, rightBase);
}

// Find peaks with height + prominence thresholds and min-distance NMS
function findPeaks(x, y, minHeightPct, minPromPct, minDistDeg){
  const mx = maxArr(y);
  if (!mx) return [];
  const minH = mx * minHeightPct / 100;
  const minP = mx * minPromPct   / 100;
  const step = x.length > 1 ? (x[x.length-1]-x[0])/(x.length-1) : 1;
  const minDistPts = minDistDeg / step;
  const candidates = [];
  for (let i=1; i<y.length-1; i++){
    if (y[i]>y[i-1] && y[i]>=y[i+1] && y[i]>=minH){
      const prom = peakProminence(y, i);
      if (prom >= minP) candidates.push({pos:x[i], height:y[i], prominence:prom, idx:i});
    }
  }
  candidates.sort((a,b)=>b.height-a.height);
  const used = new Uint8Array(y.length);
  const out = [];
  for (const c of candidates){
    if (used[c.idx]) continue;
    out.push(c);
    // Closer than the minimum distance, not merely within its rounding: a peak
    // 0.315° away stays with a 0.3° minimum.
    const lo = Math.max(0, Math.ceil(c.idx-minDistPts));
    const hi = Math.min(y.length-1, Math.floor(c.idx+minDistPts));
    for (let j=lo; j<=hi; j++) if (Math.abs(j - c.idx) < minDistPts) used[j]=1;
  }
  out.sort((a,b)=>a.pos-b.pos);
  return out;
}

// FWHM (in degrees 2θ) by half-maximum interpolation around a peak
function computeFWHM(x, y, idx0){
  const idx = refineIdx(y, idx0, 3);
  const half = y[idx] / 2;
  if (!(half > 0)) return NaN;
  let l = idx; while (l > 0 && y[l] > half) l--;
  if (y[l] > half) return NaN; // no left crossing in range
  const xl = (y[l+1]===y[l]) ? x[l] : x[l] + (half-y[l])/(y[l+1]-y[l])*(x[l+1]-x[l]);
  let r = idx; while (r < y.length-1 && y[r] > half) r++;
  if (y[r] > half) return NaN; // no right crossing
  const xr = (y[r]===y[r-1]) ? x[r] : x[r-1] + (half-y[r-1])/(y[r]-y[r-1])*(x[r]-x[r-1]);
  return Math.abs(xr - xl);
}

/* The counting uncertainty of computeFWHM's width. Each crossing is interpolated
   between two points of the smoothed, background-subtracted profile, and the half
   level is half the apex: the counts' Poisson variance (raw y·m, m from varMul),
   carried through the box that smoothed them, w wide (the covariances of
   neighbouring smoothed points included) and through those three readings, gives
   the width's to first order. The SNIP background, smooth over many points, counts
   as exact. NaN where the width is, or a crossing is flat. */
function fwhmSigma(x, y, idx0, yraw, w, varMul){
  const idx = refineIdx(y, idx0, 3), half = y[idx] / 2;
  if (!(half > 0)) return NaN;
  let l = idx; while (l > 0 && y[l] > half) l--;
  let r = idx; while (r < y.length-1 && y[r] > half) r++;
  if (y[l] > half || y[r] > half) return NaN;
  const Dl = y[l+1]-y[l], Dr = y[r]-y[r-1];
  if (!(Dl > 0 && Dr < 0)) return NaN;
  const tl = (half-y[l])/Dl, tr = (half-y[r-1])/Dr, dl = x[l+1]-x[l], dr = x[r]-x[r-1];
  // H = x_r − x_l, x_l = x[l] + dl·(h − y_l)/Dl (x_r alike), h = y_apex/2: ∂H/∂y.
  const g = new Map(), add = (k, v)=> g.set(k, (g.get(k) || 0) + v);
  add(l, dl*(1 - tl)/Dl); add(l+1, dl*tl/Dl);
  add(r-1, dr*(tr - 1)/Dr); add(r, -dr*tr/Dr);
  add(idx, 0.5*(dr/Dr - dl/Dl));
  // The box's weights, as boxSmooth takes them, cut short at the ends of the pattern (to
  // v510 the moving average's over N points: at w = N steps, for an even N, the same).
  const vy = k => Math.max(yraw[k], 0)*(varMul ? varMul[k] : 1);
  const ks = [...g.keys()], wins = new Map(ks.map(k=> [k, boxWeights(x, k, w)]));
  let v = 0;
  for (const i of ks) for (const j of ks){
    const a = wins.get(i), b = wins.get(j);
    let c = 0;
    a.forEach((wi, k)=>{ const wj = b.get(k); if (wj) c += wi*wj*vy(k); });
    v += g.get(i)*g.get(j)*c;
  }
  return Math.sqrt(v);
}

// Same half-maximum construction as computeFWHM, but returns the geometry needed
// to draw the horizontal FWHM marker: left/right crossings, half-height and the
// refined apex index. Returns null when no clean crossing exists on both sides.
function fwhmGeom(x, y, idx0){
  const idx = refineIdx(y, idx0, 3);
  const half = y[idx] / 2;
  if (!(half > 0)) return null;
  let l = idx; while (l > 0 && y[l] > half) l--;
  if (y[l] > half) return null;
  const xl = (y[l+1]===y[l]) ? x[l] : x[l] + (half-y[l])/(y[l+1]-y[l])*(x[l+1]-x[l]);
  let r = idx; while (r < y.length-1 && y[r] > half) r++;
  if (y[r] > half) return null;
  const xr = (y[r]===y[r-1]) ? x[r] : x[r-1] + (half-y[r-1])/(y[r]-y[r-1])*(x[r]-x[r-1]);
  return { xl, xr, half, idx };
}

/* Caglioti instrumental resolution: FWHM² = U·tan²θ + V·tanθ + W (θ = Bragg angle).
   Least squares on FWHM² (linear in U, V, W; at least 3 peaks), each peak weighted
   by 1/(2·FWHM·σ)², σ its width's counting uncertainty (fwhmSigma): to first order
   the sum minimised is χ² = Σ((FWHM − fit)/σ)², so a weak peak, whose width is less
   certain, counts for less, and χ²/(n − 3), the reduced χ², says whether the curve
   follows the peaks within their counting errors (≈ 1) or not (well above 1). A
   peak with no σ (a flat crossing) is given the largest of the others'. The
   standard errors are (XᵀWX)⁻¹'s, scaled by √χ²_red where it is above 1, so that a
   curve the peaks do not follow does not get errors as if they did. With no σ at
   all the fit is unweighted, its errors from the residual variance. Also given: R²
   (weighted) and the residuals on the FWHM itself, in degrees. */
const cagAt = (uvw, th)=>{ const t = Math.tan(th); return uvw[0]*t*t + uvw[1]*t + uvw[2]; };
function fitCaglioti(pts){
  const n = pts.length;
  if (n < 3) return null;
  const sv = pts.map(p=> p.s).filter(v=> isFinite(v) && v > 0);
  const weighted = sv.length > 0, sMax = weighted ? Math.max(...sv) : NaN;
  const w = pts.map(p=> weighted ? 1/(2*p.b*(isFinite(p.s) && p.s > 0 ? p.s : sMax))**2 : 1);
  const A=[[0,0,0],[0,0,0],[0,0,0]], b=[0,0,0];
  pts.forEach((p, k)=>{
    const t=Math.tan(p.th), x=[t*t, t, 1], y=p.b*p.b;
    for (let i=0;i<3;i++){ b[i]+=w[k]*x[i]*y; for (let j=0;j<3;j++) A[i][j]+=w[k]*x[i]*x[j]; }
  });
  const uvw = solveLinear(A, b);
  if (!(uvw && uvw.every(isFinite))) return null;
  const ys = pts.map(p=> p.b*p.b), W = w.reduce((a, v)=> a + v, 0);
  const ym = ys.reduce((a, v, k)=> a + w[k]*v, 0)/W;
  const chi2 = pts.reduce((a, p, k)=> a + w[k]*(ys[k] - cagAt(uvw, p.th))**2, 0);
  const tss = ys.reduce((a, v, k)=> a + w[k]*(v - ym)**2, 0);
  const dof = n - 3, red = dof > 0 ? chi2/dof : NaN;
  const scale = weighted ? Math.max(1, red) : red;
  // (XᵀWX)⁻¹, a column at a time
  const inv = [0, 1, 2].map(j=> solveLinear(A, [0, 1, 2].map(i=> i === j ? 1 : 0)));
  const se = [0, 1, 2].map(i=> inv[i] && dof > 0 ? Math.sqrt(Math.max(0, scale*inv[i][i])) : NaN);
  const res = pts.map(p=> p.b - Math.sqrt(Math.max(0, cagAt(uvw, p.th))));
  return { uvw, se, n, dof, weighted, chi2r: weighted ? red : NaN, r2: tss > 0 ? 1 - chi2/tss : NaN,
           s: weighted ? NaN : Math.sqrt(red),
           rms: Math.sqrt(res.reduce((a, v)=> a + v*v, 0)/n), maxRes: Math.max(...res.map(Math.abs)) };
}
// Instrumental FWHM (deg) at any 2θ from the standard's model, via the Caglioti
// fit (evaluable at arbitrary angles, incl. between/beyond the standard's peaks).
// Falls back to piecewise-linear interpolation when fewer than 3 standard peaks.
function instrBetaOf(m, twoTheta){
  if (!m || !m.pts.length) return 0;
  const pts = m.pts;
  if (m.fit) return Math.sqrt(Math.max(0, cagAt(m.fit.uvw, (twoTheta/2)*Math.PI/180)));
  // Fallback (<3 peaks): linear interpolation / clamp
  if (twoTheta <= pts[0].x) return pts[0].b;
  if (twoTheta >= pts[pts.length-1].x) return pts[pts.length-1].b;
  for (let k=0; k<pts.length-1; k++){
    if (twoTheta >= pts[k].x && twoTheta <= pts[k+1].x){
      // Two peaks at one angle (a manual peak on a detected one) span nothing.
      const d = pts[k+1].x - pts[k].x, t = d > 0 ? (twoTheta-pts[k].x)/d : 0;
      return pts[k].b + (pts[k+1].b-pts[k].b)*t;
    }
  }
  return pts[pts.length-1].b;
}
/* The 2θ span of the standard's peaks, each end widened by that peak's FWHM: beyond
   it the instrumental width is extrapolated (the Caglioti curve, or the end peaks'
   widths held), not measured. Within a FWHM of an end peak a sample peak is that
   same reflection, as the peaks are matched across samples, and needs no warning. */
function stdSpanOf(m){
  if (!m || !m.pts.length) return null;
  const a = m.pts[0], b = m.pts[m.pts.length-1];
  return [a.x - a.b, b.x + b.b, a.x, b.x];
}

// Scherrer size (nm) from a FWHM (deg) at 2θ pos, with editable K and λ (Å)
function scherrerD(betaDeg, pos, K, lam){
  if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
  const bRad = betaDeg * Math.PI/180, thRad = (pos/2) * Math.PI/180;
  return (K * lam / (bRad * Math.cos(thRad))) / 10; // nm (λ in Å → /10)
}

/* Tukey's box of some values: the quartiles (interpolated between order statistics),
   whiskers out to the furthest values within 1.5 IQR of the box, the rest outliers. */
function boxStats(vals){
  const v = vals.filter(isFinite).sort((a,b)=>a-b), n = v.length;
  if (!n) return null;
  const q = p =>{ const h = (n-1)*p, i = Math.floor(h); return i+1 < n ? v[i] + (h-i)*(v[i+1]-v[i]) : v[i]; };
  const q1 = q(0.25), med = q(0.5), q3 = q(0.75), f = 1.5*(q3 - q1);
  const inside = v.filter(x=> x >= q1 - f && x <= q3 + f);
  return { q1, med, q3, lo: inside[0], hi: inside[inside.length-1], out: v.filter(x=> x < q1 - f || x > q3 + f) };
}
/* A sample's sizes, one per peak, summarised: their mean and their spread — the
   standard deviation, with n − 1 (the peaks are a sample of the crystallites) — and
   the box of the same spread. */
function sizeSummary(raw, corr, isStd, showCorr){
  const one = (v, k)=>{
    const n = v.length, m = n ? meanArr(v) : NaN;
    return { [k+'N']: n, [k+'Mean']: m, [k+'Std']: n > 1 ? stdArr(v) : NaN, [k+'Box']: boxStats(v), [k+'Vals']: v };
  };
  return { isStd, showCorr, ...one(raw, 'raw'), ...one(corr, 'corr') };
}
// "mean ± std" (or just "mean" for n=1, "—" for none)
function fmtMeanStd(mean, std, n){
  if (!isFinite(mean)) return '—';
  if (n >= 2 && isFinite(std)) return `${mean.toFixed(1)} ± ${std.toFixed(1)}`;
  return mean.toFixed(1);
}
// A fitted value and its standard error, to the error's second significant digit
// (four significant digits when it has none).
function fmtPar(v, se){
  if (!isFinite(v)) return '—';
  if (!(isFinite(se) && se > 0)) return (+v.toPrecision(4)).toString();
  const d = Math.min(10, Math.max(0, 1 - Math.floor(Math.log10(se))));
  return `${v.toFixed(d)} ± ${se.toFixed(d)}`;
}
const fmtCell = v => isFinite(v) ? v.toFixed(1) : '—';
// The largest of some maxima, for a global normalisation: 1 only when there is
// nothing above zero to normalise by (a floor of 1 left data below 1 unnormalised).
function topOf(maxima){ const m = Math.max(-Infinity, ...maxima); return m > 0 ? m : 1; }
// Assemble a "wide" CSV from {h,v} columns, padded to the longest column.
function wideCsv(cols){
  const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
  let t = csvLine(cols.map(c=>c.h));
  for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
  return t;
}

// Peak marker colours
const PEAK_BASE = '#3f9d54';   // darker green, base
const PEAK_HOVER = '#5fcf6a';  // brighter green, transient hover
const PEAK_SEL  = '#ffffff';   // white, permanent selection
const FWHM_BASE  = '#b5292c';  // dark red, base (contrasts with the dark background)
const FWHM_HOVER = '#ff5a5a';  // brighter red, transient hover
const FWHM_SEL   = '#ff0000';  // pure red, permanent selection

const LEGEND = `<div class="legend">
              <span><i style="background:#6a7585"></i>raw</span>
              <span><i style="background:#3aa0ff"></i>smoothed</span>
              <span class="lg-bl"><i style="background:#ff9933"></i>baseline</span>
              <span><i style="background:#5fcf6a"></i>peaks</span>
            </div>`;
// The baseline's box, before its window's title: on (the default), the SNIP baseline.
const BL_TITLE = 'Subtract a SNIP baseline (the background) before the peak search and the FWHM; unticked, none: the pattern is taken as it is, from zero';
const CHIP_TITLE = "Switch all / one: to one, every sample starts from the common value; back to all, the common value is the shown sample's";
const chip = (p, k, mode)=> `<button type="button" class="mode-chip" id="${p}Mode${k}" title="${CHIP_TITLE}">${mode}</button>`;
/* A width's field (the smoothing's, the SNIP's): its value in °2θ and, in the same box after
   it, muted, what it spans in points of the pattern on show (syncHints). The box is a
   label: a click on the points is one in the field. */
const W_TITLE = { Smooth: "The smoothing box's width, in °2θ (0: none); beside it, the points it spans at the step of the pattern on show",
  BlWin: "The SNIP baseline's width, in °2θ: each point is compared with the curve up to half this far on either side; beside it, the points it spans at the step of the pattern on show" };
const wField = (p, id, v)=> `<label class="pg-field wfield" title="${W_TITLE[id]}"><input type="text" inputmode="decimal" id="${p}${id}" value="${v}" autocomplete="off" aria-describedby="${p}${id}Pts"><span class="wf-pts" id="${p}${id}Pts"></span></label>`;

export const PEAKS_INFO = `Per-sample view. Raw pattern (grey), smoothing (blue), SNIP baseline (orange) and detected peaks (green). The <b>smoothing</b> takes at each point the mean of the line through the points over a window w wide (°2θ) centred on it, a box convolution, cut short at the ends of the pattern; 0 is none. The <b>SNIP</b> (Statistics-sensitive Non-linear Iterative Peak-clipping) baseline iteratively clips each point downward toward the average of the curve on either side at decreasing distances, from half its width W (°2θ) down to one step, so the peaks are cut away and the slowly varying background is left; its box unticked, there is none, and the pattern is read from zero as it is. Both are widths on the 2θ axis, so that one setting treats alike patterns measured at different steps; each field shows beside its value the points it spans at the step of the pattern on show. Peaks are searched on the smoothed pattern with the baseline taken off: a peak must reach the minimum height and stand out by the minimum prominence (both in % of the highest), and two peaks closer than the minimum distance keep the taller. The FWHM is read where the profile crosses half its height, interpolated between points; the crystallite size is Scherrer's, D = Kλ / (β·cosθ). With an instrumental standard (<b>Instrumental standard…</b>), the instrument's width at each angle is taken off in quadrature, β² = β<sub>obs</sub>² − β<sub>instr</sub>², for the corrected size. <b>+ Add peak</b> places a peak by hand on the plot; the × in a row removes one. Use the <b>all / one</b> toggles to share a value across samples or set it per sample.`;
export const STD_INFO = `A measured standard (large, strain-free crystallites — LaB₆, Si…) characterises the instrumental broadening β<sub>instr</sub>(2θ). It is analysed here on its own, always normalised to its highest peak (= 1), with parameters of its own. Its peaks' FWHM are fitted with the Caglioti function, FWHM² = U·tan²θ + V·tanθ + W, which gives the instrument's width at any angle: the samples' corrected sizes take it off in quadrature. One file at a time: a file dropped replaces the one there.`;

/* host: {
     files()          the files analysed (the included samples; the standard's one)
     idx(), step(d)   the sample on show, shared by the cards, and stepping it (samples)
     commit()         a step of the undo history
     instr()          the standard's model { pts, fit } or null (samples)
     changed()        its peaks or sizes changed: the standard's, every card's sizes follow;
                      a card's, its Results section is redrawn by itself
     openStd()        open the standard's modal (samples)
     allFiles()       every file loaded, for the steps of those left out (samples)
     hidden()         the card is folded: nothing is drawn
   }
   o: { prefix, standard } */
export function createPeakAnalysis(host, root, o){
  const p = o.prefix, std = !!o.standard;

  // The standard's: one file, named over it in the window, so its plot has no caption;
  // the parameters beside the plot, the Caglioti fit and + Add peak at their foot,
  // ending level with the plot's bottom (the frame of the Rietveld card's, .pside).
  root.innerHTML = std ? `
        <div class="pside">
          <div class="plot-nav-row pside-nav"></div>
          <div class="pside-plot">
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-names="standard.csv" data-dl-name="XRPD_standard.svg">${PLOT_DL_ICON}</button>
            </div>
          </div>
          <div class="pside-under">${LEGEND}</div>
          <div class="pside-col xrd-std-side">
            <div class="txt-mini param-head">Parameters</div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Smooth">Smoothing width (&#176;2&#952;)</label>
              ${wField(p, 'Smooth', 0)}
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP width (&#176;2&#952;)</label></div>
              ${wField(p, 'BlWin', 5)}
              <label class="txt-label" for="${p}PkHeight">Peak min. height (%)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkHeight" value="5">
              <label class="txt-label" for="${p}PkProm">Peak min. prominence (%)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkProm" value="3">
              <label class="txt-label" for="${p}PkDist">Peak min. distance (&#176;2&#952;)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkDist" value="0.3">
            </div>
            <div class="xrd-cag"><div class="pg-result" id="${p}Cag"></div></div>
            <div id="${p}CagAlert" class="cag-alert"></div>
            <button class="btn plot-action-btn" id="${p}AddPeak" title="Add a peak by clicking on the plot">+ Add peak</button>
          </div>
        </div>
        <div class="peak-box" id="${p}PeakBox">
          <div class="peak-box-head">
            <span class="txt-mini">Detected peaks</span>
            <button class="btn nav-arrow peak-reset-btn" id="${p}PkReset" style="display:none" title="Reset peaks">&#8634;</button>
            <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-names="standard.csv" title="Download CSV">${CSV_ICON}</button>
          </div>
          <div class="xrd-peak-wrap" id="${p}PeakTableWrap"></div>
        </div>` : `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">
            <div class="plot-nav-row">
              <div class="plot-nav-left">
                <button class="btn nav-arrow an-prev" id="${p}Prev" aria-label="Previous sample" title="Previous sample (&#8592;)">&#8249;</button>
                <span id="${p}Idx" class="pill nav-count" style="margin:0">1/1</span>
                <button class="btn nav-arrow an-next" id="${p}Next" aria-label="Next sample" title="Next sample (&#8594;)">&#8250;</button>
                <span class="txt-caption" id="${p}CurrentLabel">—</span>
              </div>
            </div>
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="diffractograms.csv,peaks.csv" data-csv-names="diffractograms.csv,peaks.csv" data-dl-base="XRPD_sample.svg" data-dl-name="XRPD_sample.svg">${PLOT_DL_ICON}</button>
            </div>
            ${LEGEND}
          </div>
          <div class="col mw280" style="align-self:flex-start">
            <div class="txt-mini param-head aligned">Parameters</div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Norm">Normalization</label>
              <select id="${p}Norm" class="pg-field">${NORM_OPTIONS}</select>
              <div class="txt-label pg-title">Smoothing width (&#176;2&#952;) ${chip(p, 'N', 'all')}</div>
              ${wField(p, 'Smooth', 0.25)}
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP width (&#176;2&#952;)</label> ${chip(p, 'Bl', 'all')}</div>
              ${wField(p, 'BlWin', 5)}
              <div class="txt-label pg-title">Peak min. height (%) ${chip(p, 'H', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkHeight" value="5">
              <div class="txt-label pg-title">Peak min. prominence (%) ${chip(p, 'P', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkProm" value="3">
              <div class="txt-label pg-title">Peak min. distance (&#176;2&#952;) ${chip(p, 'D', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkDist" value="0.3">
              <div class="txt-label pg-title">Shape factor K ${chip(p, 'K', 'all')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}K" value="0.9">
              <div class="txt-label pg-title">Wavelength &#955; (&#8491;) ${chip(p, 'L', 'all')}</div>
              <div class="pg-field lambda-field">
                <select id="${p}LambdaSel" class="lambda-sel" title="X-ray source / wavelength">
                  <option value="1.540598">Cu Kα1</option>
                  <option value="1.541838">Cu Kα</option>
                  <option value="1.544426">Cu Kα2</option>
                  <option value="0.709317">Mo Kα1</option>
                  <option value="1.789010">Co Kα1</option>
                  <option value="2.289760">Cr Kα1</option>
                  <option value="custom">Custom</option>
                </select>
                <input type="text" inputmode="decimal" class="lambda-val" id="${p}Lambda" value="1.540598" readonly title="Wavelength (Å)">
              </div>
            </div>
            <div id="${p}StepNote"></div>
            <div class="xrd-pk-btns">
              <button class="btn plot-action-btn" id="${p}AddPeak" title="Add a peak by clicking on the plot">+ Add peak</button>
              <button class="btn plot-action-btn" id="${p}Std" aria-haspopup="dialog" title="The instrumental standard: its file, its peaks and the Caglioti fit that corrects the sizes for the instrument's width">Instrumental standard…</button>
            </div>
          </div>
        </div>
        <div class="peak-box" id="${p}PeakBox">
          <div class="peak-box-head">
            <span class="txt-mini">Detected peaks</span>
            <button class="btn nav-arrow peak-reset-btn" id="${p}PkReset" style="display:none" title="Reset peaks">&#8634;</button>
            <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-base="peaks.csv" data-csv-names="peaks.csv" title="Download CSV">${CSV_ICON}</button>
          </div>
          <div class="xrd-peak-wrap" id="${p}PeakTableWrap"></div>
        </div>`;

  // A card's section of the Results: the patterns stacked, and the crystallite sizes.
  const res = std ? null : document.createElement('div');
  if (res){
    res.className = 'res-an';
    res.innerHTML = `
        <h4 class="res-an-title"></h4>
        <div class="row res-row" style="gap:16px">
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Analysis</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}ResSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}ResSvg" data-csv-mod="xrd" data-csv-base="diffractograms.csv" data-csv-names="diffractograms.csv" data-dl-base="XRPD_results_analysis.svg" data-dl-name="XRPD_results_analysis.svg" data-dl-legend="${p}ResLegend">${PLOT_DL_ICON}</button>
            </div>
            <div id="${p}ResLegend" class="legend"></div>
          </div>
          <!-- The crystallite size beside the intensities it is read from. -->
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Crystallite size</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}SizeBarSvg"></svg>
              <span class="plot-chips" id="${p}SizeBy"></span>
              <button class="btn plot-dl-btn" data-dl-svg="${p}SizeBarSvg" data-csv-mod="xrd" data-csv-names="crystallite_size.csv" data-dl-name="XRPD_crystallite_size.svg" data-dl-legend="${p}SizeBarLegend">${PLOT_DL_ICON}</button>
            </div>
            <div id="${p}SizeBarLegend" class="legend"></div>
            <div id="${p}SizeByNote" class="txt-meta"></div>
          </div>
        </div>`;
  }
  // The elements, found in the card or its section whether or not they are in the page.
  const $$ = id => root.querySelector('#' + p + id) || (res && res.querySelector('#' + p + id));

  const files = ()=> host.files();
  let processed = []; // per file: {smoothed, baseline, subtracted, peaks}
  let manualPeaks = []; // per file: array of manually added 2θ positions
  let removedPeaks = []; // per file: array of removed peaks' detected 2θ positions
  const curIdx = ()=> std ? 0 : host.idx();
  // Per-field mode: 'shared' | 'per'. Defaults: peak-search fields per-sample, rest shared.
  // (N is the smoothing's chip, blWin the baseline's: its width and its box.)
  const MODE_DEF = std ? { N:'shared', blWin:'shared', pkHeight:'shared', pkProm:'shared', pkDist:'shared', K:'shared', lambda:'shared' }
    : { N:'shared', blWin:'shared', pkHeight:'per', pkProm:'per', pkDist:'per', K:'shared', lambda:'shared' };
  const paramMode = { ...MODE_DEF };
  /* Shared param values (defaults); the standard's own start unsmoothed, and never
     share anything (one file), nor size anything (K, λ unused). blOn: the baseline's box.
     smoothW, the smoothing's width, and snipW, the SNIP's half-width, are in °2θ: 0.25°
     is about 19 points at a step of 0.013°; 2.5°, its field showing the whole width, 5°
     (SHOWN), about 385 points there, 299 at 0.0167° (to v515 0.13° and 2°, the field the
     half-width; to v510 numbers of points, N 10 and blWin 150, whatever the step: restore
     converts them). */
  const FIELD_DEF = { smoothW:0.25, snipW:2.5, pkHeight:5, pkProm:3, pkDist:0.3, K:0.9, lambda:1.540598, blOn:true };
  // (what a width's field shows of the value stored: the SNIP's, its whole width)
  const SHOWN = { smoothW:1, snipW:2 };
  const SHARED_DEF = std ? { ...FIELD_DEF, smoothW:0 } : FIELD_DEF;
  const shared = { ...SHARED_DEF };
  // Per-sample param overrides (indexed by file idx). blOn: the SNIP baseline subtracted
  // (its box ticked, the default) or not; it goes with its width, under the width's
  // all / one (paramMode.blWin). Absent (projects before v463) is on.
  let perParams = []; // array of {smoothW, snipW, blOn, pkHeight, pkProm, pkDist, K, lambda}
  // What the crystallite-size box plot is by: each sample's peaks ('sample'), or each
  // reflection the samples share, over the samples ('peak').
  let sizeBy = 'sample';
  // The chips a project's conversion turned to one, its patterns' steps differing (restore),
  // whose note shows under the fields until each is shared again or the note dismissed.
  let stepNote = [];
  // And, files being left out then, those chips' values in points as v510 shared them
  // ({ N, blWin }): such a file taken back in has them at its own step, as v510 gave it
  // the shared value under all (its own entry, held, not in use), until the chip is shared again.
  let heldPts = {};
  let norm = 'global';
  // Selection/hover state of the peak table and plot.
  const panel = { sel:null, hov:null };
  let anaPlot = null;

  // input id ↔ stored field key
  const FIELD_INPUT = std ? { smoothW:'Smooth', snipW:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist' }
    : { smoothW:'Smooth', snipW:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist', K:'K', lambda:'Lambda' };
  // (the SNIP's half-width above 0: one step at least, whatever is set)
  const FIELD_MIN   = { smoothW:0, snipW:1e-6, pkHeight:0, pkProm:0, pkDist:0, K:1e-6, lambda:1e-6 };
  // The widths, by the keys of the points they were up to v510; the chip each goes under.
  const LEGACY = { smoothW:'N', snipW:'blWin' };
  const modeOf = k => k === 'smoothW' ? 'N' : k === 'snipW' || k === 'blOn' ? 'blWin' : k;

  // Validation feedback (shake + auto-correct) for the decimal (type=text) fields;
  // the number fields are guarded as any of the page's. Wired before the fields' own
  // change handlers.
  guardNumberInputs(root);
  [ ['Smooth',0,SHARED_DEF.smoothW], ['BlWin',1e-6,FIELD_DEF.snipW*SHOWN.snipW], ['PkHeight',0,5], ['PkProm',0,3], ['PkDist',0,0.3], ...(std ? [] : [['K',1e-6,0.9], ['Lambda',1e-6,1.540598]]) ]
    .forEach(([id,min,def])=> guardNumericInput($$(id), { min, def }));

  /* A state's settings as a restore takes them (a project read in may hold anything): a
     value that is no number, or a width below its least, none (the default, or the shared
     value), another below its least that least. Up to v510 the widths were points (N,
     blWin), each pattern's at its own step: they become widths at that step, the mean as
     the peak search takes it, so that each pattern is smoothed as it was (to rounding, for
     an even N; an odd N's box edges fall mid-cell, a quarter step² wider in variance; the
     end points count half; N = 1, none, is 0) and clipped as it was (K = the points). */
  const objOf = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const numOf = (q, k)=> !Number.isFinite(q[k]) ? undefined : k in LEGACY ? (q[k] >= FIELD_MIN[k] ? q[k] : undefined) : Math.max(FIELD_MIN[k], q[k]);
  const fromPts = (k, v, st)=>{
    if (!Number.isFinite(v)) return undefined;
    const N = Math.max(1, k === 'smoothW' ? Math.round(v) : v);
    return k === 'smoothW' && N === 1 ? 0 : st > 0 ? N*st : undefined;
  };
  // A sample's own settings, a project's to v510 in points at its pattern's step st (those
  // of heldPts, pts, in place of its own: the SNIP's box too, v510's shared one, for an
  // entry not converted yet).
  function entryOf(q, st, pts = {}){
    const o = {};
    for (const k in FIELD_MIN){ const v = k in LEGACY && !(k in q) ? fromPts(k, Number.isFinite(pts[LEGACY[k]]) ? pts[LEGACY[k]] : q[LEGACY[k]], st) : numOf(q, k); if (v !== undefined) o[k] = v; }
    o.blOn = !('snipW' in q) && Number.isFinite(pts.blWin) && typeof pts.blOn === 'boolean' ? pts.blOn : q.blOn !== false;
    return o;
  }
  // Get params for a specific file index (respects per-field shared/per mode)
  function getFileParams(i){
    const pp = perParams[i] || {};
    const g = k => paramMode[modeOf(k)]==='shared' ? shared[k] : (pp[k] ?? shared[k]);
    return { smoothW:g('smoothW'), snipW:g('snipW'), blOn:g('blOn') !== false, pkHeight:g('pkHeight'), pkProm:g('pkProm'), pkDist:g('pkDist'), K:g('K'), lambda:g('lambda') };
  }
  // Parse a decimal field tolerant of comma separators; only fall back on a genuinely empty/invalid value
  function numField(id, def){
    const raw = String($$(id).value).trim().replace(',', '.');
    if (raw === '') return def;
    const v = parseFloat(raw);
    return isNaN(v) ? def : v;
  }
  // Read inputs into the appropriate store for the sample on show; with no file, every
  // value into the shared ones, those a file loaded starts from (addFile).
  function readInputsToStore(){
    const k = curIdx(), own = m => paramMode[m]!=='shared' && files().length > 0;
    for (const key in FIELD_INPUT){
      // (a width's field as written, to 4 significant digits, is the value stored, kept
      // exact: only a value typed replaces it)
      const el = $$(FIELD_INPUT[key]);
      const sh = SHOWN[key] || 1;
      const v = key in LEGACY && el.value === el._shown ? el._exact : Math.max(FIELD_MIN[key], numField(FIELD_INPUT[key], FIELD_DEF[key]*sh)/sh);
      if (!own(modeOf(key))) shared[key] = v;
      else { if (!perParams[k]) perParams[k] = {}; perParams[k][key] = v; }
    }
    const on = $$('BlOn').checked;
    if (!own('blWin')) shared.blOn = on;
    else { if (!perParams[k]) perParams[k] = {}; perParams[k].blOn = on; }
  }
  // Push stored values for the sample on show into the input fields
  function writeStoreToInputs(){
    const pr = getFileParams(curIdx());
    for (const key in FIELD_INPUT){
      const el = $$(FIELD_INPUT[key]);
      if (key in LEGACY){ el.value = el._shown = widthText(pr[key]*SHOWN[key]); el._exact = pr[key]; }
      else el.value = pr[key];
    }
    // (disabled, not hidden: the width means nothing with no baseline)
    $$('BlOn').checked = pr.blOn; $$('BlWin').disabled = !pr.blOn;
    if (!std){ $$('Norm').value = norm; syncLambdaSelect(); }
    syncHints();
    syncStepNote();
  }
  /* What each width spans in points of the pattern on show (the standard's: its file),
     in its field after the value, from the value as it is typed: the width over the step
     (the smoothing off at 0; the SNIP's passes on each side, as computeBaseline rounds
     them, in its title; to v515 those, '±K pts', in the field). Nothing with no file, or
     no value. */
  function syncHints(){
    const fs = files(), f = fs[Math.min(curIdx(), fs.length - 1)], st = f ? meanStep(f.x) : NaN;
    for (const id of ['Smooth', 'BlWin']){
      // (the width stored, exact, while the field shows it unchanged: one converted from
      // points is that many steps, not its 4 digits' worth)
      const el = $$(id), sh = id === 'BlWin' ? SHOWN.snipW : 1;
      const v = el.value === el._shown && Number.isFinite(el._exact) ? el._exact*sh : parseFloat(String(el.value).trim().replace(',', '.')), out = $$(id + 'Pts');
      let t = '', tip = '';
      if (st > 0 && v >= 0 && isFinite(v)){
        const at = ` at the step of ${f.label}, ${widthText(st)}°`;
        if (id === 'Smooth'){ t = v ? ptsText(v/st) : 'off'; tip = v ? `${widthText(v/st)} steps${at}` : 'No smoothing'; }
        else if (v > 0){ const K = Math.max(1, Math.round(v/sh/st) || 1); t = ptsText(v/st); tip = `${widthText(v/st)} steps across, ${K} point${K === 1 ? '' : 's'} on each side${at}`; }
      }
      if (out.textContent !== t) out.textContent = t;
      if (out.title !== tip) out.title = tip;
    }
  }
  // (and as it is left: a value refused is set back with no input event)
  for (const id of ['Smooth', 'BlWin']) ['input', 'blur'].forEach(t=> $$(id).addEventListener(t, syncHints));
  // The note of a project to v510 whose patterns' steps differ, with its ×.
  let stepNoteHtml = '';
  function syncStepNote(){
    const el = $$('StepNote');
    if (!el) return;
    const on = stepNote.filter(m=> paramMode[m] === 'per'), what = on.map(m=> m === 'N' ? 'smoothing' : 'SNIP width').join(' and ');
    const t = on.length ? `<div class="alert warn">⚠ The patterns were measured at different steps: the ${what}, set in points up to v510, ${on.length > 1 ? 'are' : 'is'} kept as ${on.length > 1 ? 'they were' : 'it was'}, a width for each pattern (one). Set one width in all to treat them alike.<button class="alert-dismiss close-x" data-step-x title="Dismiss">${X_SVG(15)}</button></div>` : '';
    if (t !== stepNoteHtml){ stepNoteHtml = t; el.innerHTML = t; }
  }
  if (!std) $$('StepNote').addEventListener('click', e=>{
    if (!e.target.closest('[data-step-x]')) return;
    stepNote = []; syncStepNote(); host.commit();
  });
  // Keep the wavelength preset selector in step with the numeric λ value: pick the
  // matching source preset (else "Custom"), and lock the value field unless Custom.
  function syncLambdaSelect(){
    const inp = $$('Lambda'), sel = $$('LambdaSel');
    if (!inp || !sel) return;
    const v = parseFloat(String(inp.value).replace(',','.'));
    let matched = 'custom';
    for (const o of sel.options){ if (o.value!=='custom' && Math.abs(parseFloat(o.value)-v) < 5e-5){ matched = o.value; break; } }
    sel.value = matched;
    inp.readOnly = (matched !== 'custom');
  }

  /* A pattern's processing is kept while what it is made from is the same (its arrays
     never change: xrd.js), so that what is drawn from it is not drawn again: the smoothing
     and the baseline by the 2θ, the intensities and their widths (k1; to v510, in points,
     not the 2θ), the peaks by those, the variance factors, the peak search and the peaks
     added and removed by hand (k2).
     Up to v490 every edit made both anew for every pattern it touched or not (a shared
     field, a restore), and a peak-search field the smoothing and the baseline too. */
  function procKeys(i){
    const pr = getFileParams(i), f = files()[i];
    const k1 = [idOf(f.y), idOf(f.x), pr.smoothW, pr.blOn ? pr.snipW : 'off'].join('|');
    return { k1, k2: [k1, idOf(f.varMul), pr.pkHeight, pr.pkProm, pr.pkDist, (manualPeaks[i]||[]).join(), (removedPeaks[i]||[]).join()].join('|') };
  }
  function reprocessOne(i){
    const { k1, k2 } = procKeys(i), f = files()[i];
    processed[i] = procKept(f.y, k2, ()=> processOf(i, f, k1, k2));
  }
  function processOf(i, f, k1, k2){
    const pr = getFileParams(i);
    const x = f.x;
    const yraw       = f.y;
    const { smoothed, snip, detSub } = smoothKept(yraw, k1, ()=>{
      const smoothed = boxSmooth(x, yraw, pr.smoothW);   // display + detection
      // SNIP baseline (estimate/fallback/standard); switched off, none: the pattern from zero
      const snip = pr.blOn ? computeBaseline(x, smoothed, pr.snipW) : new Array(smoothed.length).fill(0);
      /* For the peak search and the classic FWHM. The half-maximum walk needs a smooth
         profile — on the raw counts the noise stops it short — and the smoothing, a box
         w wide convolved into every peak, widens them in turn: the width is the
         user's to keep small against the peak widths, the raw pattern drawn beside it. */
      return { smoothed, snip, detSub: smoothed.map((v,j)=>Math.max(0, v-snip[j])) };
    });
    // (to v517 also the raw pattern less the baseline, a fourth array a pattern that nothing read)
    // Peak detection on the smoothed, SNIP-subtracted profile (robust to noise)
    const peaks      = findPeaks(x, detSub, pr.pkHeight, pr.pkProm, pr.pkDist);
    // Re-inject manually added peaks (survive param changes, cleared on reset); one with
    // no position (an add on a stale index could store one, to v473, and a save keep it)
    // is skipped.
    (manualPeaks[i]||[]).filter(Number.isFinite).forEach(pos=>{
      const idx = nearestIdx(x, pos);
      peaks.push({pos, height:detSub[idx], prominence:peakProminence(detSub, idx), idx, manual:true});
    });
    peaks.sort((a,b)=>a.pos-b.pos);
    // detPos = detected position (stable identity, independent of fit on/off)
    peaks.forEach(pk=>{ pk.detPos = pk.pos; });
    // Apply persistent removals (matched by detected position, with a small tolerance) to
    // the detected peaks: a manual one goes by its own ×, out of manualPeaks. (To v473 they
    // took the manual ones too: one placed by a removed peak, as to put it back by hand,
    // was hidden as it was added, and removing a peak by a manual one hid both.)
    const rem = removedPeaks[i] || [];
    const remTol = Math.min(0.1, (pr.pkDist || 0.3) * 0.45);
    peaks.forEach(pk=>{ pk.removed = !pk.manual && rem.some(v=>Math.abs(v-pk.detPos) < remTol); });

    // SNIP baseline and the half-maximum FWHM.
    peaks.forEach(pk=>{
      if (pk.removed){ pk.fwhm=NaN; pk.fwhmClassic=NaN; return; }
      pk.fwhmClassic=computeFWHM(x, detSub, pk.idx); pk.fwhm=pk.fwhmClassic;
      pk.fwhmSig = fwhmSigma(x, detSub, pk.idx, yraw, pr.smoothW, f.varMul);
    });
    const subtracted = detSub;
    return {smoothed, baseline:snip, snip, subtracted, peaks, k1, k2};
  }
  function reprocessAll(){
    processed = [];
    for (let i=0; i<files().length; i++) reprocessOne(i);
  }

  // The standard's peaks the instrumental width is taken from, in 2θ order, and the
  // Caglioti fit to them (null with fewer than 3). Null with no file. Kept by the
  // standard's processing (modelOf): one object, which the samples' views take among their
  // inputs (up to v490 made anew for each size read, a fit each time).
  function instrModel(){
    if (!std || !files().length || !processed[0]) return null;
    let m = modelOf.get(processed[0]);
    if (m) return m;
    const pts = processed[0].peaks
      .filter(pk=>!pk.removed && isFinite(pk.fwhm))
      .map(pk=>({x:pk.pos, th:(pk.pos/2)*Math.PI/180, b:pk.fwhm, s:pk.fwhmSig}))
      .sort((a,b)=>a.x-b.x);
    modelOf.set(processed[0], m = { pts, fit: fitCaglioti(pts) });
    return m;
  }
  // The samples' correction, from the standard's model (host.instr).
  const model = ()=> std ? null : host.instr();
  const instrBeta = tt => instrBetaOf(model(), tt);
  // Size WITHOUT instrumental correction (raw β)
  function sizeRaw(betaDeg, pos, K, lam){ return scherrerD(betaDeg, pos, K, lam); }
  // Size WITH instrumental correction: β² = β_obs² − β_instr²
  function sizeCorr(betaDeg, pos, K, lam){
    if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
    const bInstr = instrBeta(pos);
    return scherrerD(Math.sqrt(Math.max(0, betaDeg*betaDeg - bInstr*bInstr)), pos, K, lam);
  }
  /* A peak narrower than the instrument at its angle leaves no width for the crystallite
     size: physically it cannot happen, so when it does the standard is at fault (its
     peaks wider than they should be, or misread). Such a peak has no corrected size;
     the peak table says so. */
  function belowInstr(betaDeg, pos){
    if (!model() || !isFinite(betaDeg) || betaDeg <= 0) return false;
    return betaDeg <= instrBeta(pos);
  }
  const outsideStdHtml = (n, span)=> `<div class="alert warn">⚠ ${n} peak${n > 1 ? 's lie' : ' lies'} beyond the standard's peaks (${span[2].toFixed(2)}–${span[3].toFixed(2)}°) by more than ${n > 1 ? 'their' : 'its'} width: there the instrumental width is extrapolated, not measured.</div>`;
  const belowInstrHtml = n => `<div class="alert warn">⚠ ${n} peak${n > 1 ? 's are' : ' is'} narrower than the instrumental width at ${n > 1 ? 'their angles' : 'its angle'}, which is not physically possible: the standard is likely unsuitable. ${n > 1 ? 'They are' : 'It is'} left out of the corrected size.</div>`;
  // The classic crystallite sizes of a sample's kept peaks, summarised (sizeSummary).
  function sampleSizeStats(i){
    const pr = processed[i];
    const showCorr = !!model();
    const raw = [], corr = [];
    let below = 0, outside = 0;
    const span = showCorr ? stdSpanOf(model()) : null;
    if (pr && !std){
      const fp = getFileParams(i);
      pr.peaks.filter(pk=>!pk.removed).forEach(pk=>{
        const s = sizeRaw(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda);
        if (isFinite(s)) raw.push(s);
        if (showCorr){ const sc = sizeCorr(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda); if (isFinite(sc)) corr.push(sc); }
        if (showCorr && belowInstr(pk.fwhmClassic, pk.detPos)) below++;
        if (span && isFinite(pk.fwhmClassic) && (pk.detPos < span[0] || pk.detPos > span[1])) outside++;
      });
    }
    return { ...sizeSummary(raw, corr, std, showCorr), below, outside, span };
  }

  /* ---- The plot: raw, smoothed, SNIP baseline, peaks (no fit). Each pattern is
     normalised to its own smoothed max (= 1). ---- */
  // The plot drawn from the pattern and its processing, as last drawn: the same again, it
  // stays as it is (kept in view, as preserveView keeps it; else only where not zoomed).
  let anaKey = '';
  function drawAnalysisInto(idx, preserveView){
    const f  = files()[idx];
    const pr = processed[idx];
    if (!f || !pr) return;
    const svgNode = $$('Svg');
    const key = [idx, idOf(f.x), idOf(f.y), idOf(pr), sizeOf(svgNode)].join('|');
    if (anaPlot && key === anaKey && (preserveView || atOrigin(anaPlot))){ highlightPanel(); return; }
    anaKey = '';
    const mx = maxArr(pr.smoothed) || 1;
    const prevPlot = anaPlot;
    const prev = (preserveView && prevPlot) ? {xmin:prevPlot.xmin, xmax:prevPlot.xmax, ymin:prevPlot.ymin, ymax:prevPlot.ymax} : null;

    const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
    const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
    const baseD  = interpLinear(f.x, pr.baseline, dense);

    const plot  = new Plot(svgNode, {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
    plot.attachTools(svgNode.closest('.plot-wrap'));
    plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    plot.line(f.x, f.y.map(v=>v/mx),         '#6a7585', 1);
    plot.line(f.x, pr.smoothed.map(v=>v/mx), '#3aa0ff', 1.4);
    const blOn = getFileParams(idx).blOn;
    if (blOn) plot.line(dense, baseD.map(v=>v/mx), '#ff9933', 1.2);
    // (the legend's entry stays, struck through: no baseline on this pattern)
    root.querySelectorAll('.lg-bl').forEach(e=> e.classList.toggle('is-off', !blOn));
    const drawnPos = [];
    const peakMarks = [], fwhmMarks = [];
    for (const pk of pr.peaks){
      if (pk.removed) continue;
      if (drawnPos.some(v=>Math.abs(v-pk.pos)<1e-9)) continue;
      drawnPos.push(pk.pos);
      plot.vline(pk.pos, PEAK_BASE, false);
      peakMarks.push({pos:pk.pos});
      // Horizontal FWHM marker at half-maximum height (on the smoothed, baseline-subtracted profile)
      const gm = fwhmGeom(f.x, pr.subtracted, pk.idx);
      if (gm){
        const yDisp = (pr.baseline[gm.idx] + gm.half) / mx;
        fwhmMarks.push({pos:pk.pos, x0:gm.xl, x1:gm.xr, y:yDisp});
      }
    }
    anaPlot = plot;
    plot._peakMarks = peakMarks;
    plot._fwhmMarks = fwhmMarks;
    plot._onView = ()=>{ buildInteractiveMarks(plot); highlightPanel(); };
    buildInteractiveMarks(plot);
    highlightPanel();
    anaKey = key;
  }

  // The sample on show (the standard's file), its plot and its label.
  function updateView(preserveView){
    const fs = files();
    const label = $$('CurrentLabel');     // (none on the standard's: its window names it)
    if (!fs.length || !processed.length){ if (label) label.textContent = '—'; return; }
    const k = Math.min(curIdx(), fs.length - 1);
    if (label && label.textContent !== fs[k].label) label.textContent = fs[k].label;
    if (!std && $$('Idx').textContent !== (k+1)+'/'+fs.length) $$('Idx').textContent = (k+1)+'/'+fs.length;
    if (host.hidden()) return;
    drawAnalysisInto(k, preserveView);
  }

  const nearestLine = (lines, pos)=>{ let best=null,bd=Infinity; if(pos!=null) for(const el of lines){ const d=Math.abs(el._value-pos); if(d<bd){bd=d;best=el;} } return bd<0.6?best:null; };
  // Recolour the plot's peak vlines AND their FWHM markers from the selection/hover.
  function highlightPanel(){
    const plot = anaPlot; if (!plot) return;
    const all = [...plot.gOverlay.querySelectorAll('line')];
    const peakLines = all.filter(el=>el._value!==undefined && !el._fwhm && !el._hit);
    const fwhmSegs  = all.filter(el=>el._fwhm && !el._hit);
    const selEl = nearestLine(peakLines, panel.sel);
    const hovEl = nearestLine(peakLines, panel.hov);
    peakLines.forEach(el=>{
      if (el===selEl){ el.setAttribute('stroke',PEAK_SEL); el.setAttribute('stroke-width',1.8); }
      else if (el===hovEl){ el.setAttribute('stroke',PEAK_HOVER); el.setAttribute('stroke-width',1.8); }
      else { el.setAttribute('stroke',PEAK_BASE); el.setAttribute('stroke-width',1); }
    });
    // FWHM markers mirror the peak state (matched by shared _value = peak position)
    fwhmSegs.forEach(el=>{
      const isSel = selEl && Math.abs(el._value - selEl._value) < 1e-9;
      const isHov = hovEl && Math.abs(el._value - hovEl._value) < 1e-9;
      if (isSel){ el.setAttribute('stroke',FWHM_SEL); el.setAttribute('stroke-width',4); }
      else if (isHov){ el.setAttribute('stroke',FWHM_HOVER); el.setAttribute('stroke-width',4); }
      else { el.setAttribute('stroke',FWHM_BASE); el.setAttribute('stroke-width',2.2); }
    });
  }

  // Twin invisible thick "hit" line as a hover listener (à la Tauc draggable bars),
  // so peaks and FWHM markers have a fat, responsive target. Scheduled clear on leave
  // is cancelled by any enter within the same frame, avoiding flicker when the pointer
  // slides between a peak's vertical hit line and its horizontal FWHM hit line.
  let markHoverRAF = null;
  function addMarkHover(el, pos){
    el.addEventListener('pointerenter', ()=>{
      const plot = anaPlot;
      if (!plot || plot._mode) return;            // pan/zoom armed
      if (addPeak.isAdding()) return;             // placing a manual peak
      if (markHoverRAF){ cancelAnimationFrame(markHoverRAF); markHoverRAF=null; }
      setHover(pos);
    });
    el.addEventListener('pointerleave', ()=>{
      if (markHoverRAF) cancelAnimationFrame(markHoverRAF);
      markHoverRAF = requestAnimationFrame(()=>{ markHoverRAF=null; setHover(null); });
    });
  }
  // (Re)build the interactive overlay marks for a plot: visible FWHM segments plus the
  // invisible thick hit lines for both peaks and FWHM markers. Called after every
  // axis redraw (via _onView) since gOverlay is cleared on each refresh.
  function buildInteractiveMarks(plot){
    if (!plot) return;
    const g = plot.gOverlay;
    g.querySelectorAll('.xrd-mark').forEach(e=>e.remove());
    const xlo = Math.min(plot.xmin, plot.xmax), xhi = Math.max(plot.xmin, plot.xmax);
    // FWHM markers (visible dark-red segment + horizontal hit line)
    (plot._fwhmMarks || []).forEach(mk=>{
      const y  = plot.py(mk.y);
      const xa = plot.px(mk.x0), xb = plot.px(mk.x1);
      const seg = svgEl('line',{x1:xa,x2:xb,y1:y,y2:y,stroke:FWHM_BASE,'stroke-width':2.2,'stroke-linecap':'round','pointer-events':'none','class':'xrd-mark'});
      seg._fwhm = true; seg._value = mk.pos;
      g.appendChild(seg);
      const hit = svgEl('line',{x1:xa,x2:xb,y1:y,y2:y,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'xrd-mark'});
      hit._hit = true;
      addMarkHover(hit, mk.pos);
      g.appendChild(hit);
    });
    // Peak hit lines (invisible, full-height, vertical)
    const {h} = plot.size(); const m = plot.margin;
    (plot._peakMarks || []).forEach(mk=>{
      if (mk.pos < xlo || mk.pos > xhi) return;
      const px = plot.px(mk.pos);
      const hit = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'xrd-mark'});
      hit._hit = true;
      addMarkHover(hit, mk.pos);
      g.appendChild(hit);
    });
  }

  // Toggle the transient 'hovering' class on the row nearest the hover pos.
  function updateRowHover(){
    const wrap = $$('PeakTableWrap'); if (!wrap) return;
    const rows = [...wrap.querySelectorAll('.peak-row')];
    let best=null, bd=Infinity;
    if (panel.hov!=null) for (const r of rows){ const d=Math.abs(parseFloat(r.dataset.pos)-panel.hov); if(d<bd){bd=d;best=r;} }
    rows.forEach(r=>r.classList.toggle('hovering', r===best && bd<0.6));
  }
  // Transient hover (peak + associated row), distinct from selection.
  function setHover(pos){
    if (pos===panel.hov) return;
    panel.hov = pos;
    highlightPanel();
    updateRowHover();
  }
  // Permanent selection toggle.
  function selectPeak(pos){
    panel.sel = (panel.sel!=null && Math.abs(pos-panel.sel)<1e-9) ? null : pos;
    renderTable(); highlightPanel();
  }
  function clearSelection(){ if (panel.sel!=null){ panel.sel=null; renderTable(); highlightPanel(); } }

  /* ---- The peak table ---- */
  // Classic (peak-search) table: 2θ, rel intensity, classic FWHM, size. With a standard
  // in use, the samples show the size both without and with the correction.
  // (as last drawn: the sample, its processing, its K and λ, the standard's model, the peak
  // picked, and whether it was laid out, for its CSV icon, fitted only on the page; the same
  // again, the rows and their handlers stay)
  let tableKey = '';
  function renderTable(){
    const wrap = $$('PeakTableWrap');
    if (!wrap) return;
    if (std) renderCaglioti();
    const fs = files(), idx = Math.min(curIdx(), fs.length - 1);
    const kp = fs.length && processed[idx] && !std ? getFileParams(idx) : null;
    const key = !fs.length || !processed[idx] ? 'none' : [idx, idOf(processed[idx]), ...(kp ? [kp.K, kp.lambda, idOf(model())] : []), panel.sel, wrap.getClientRects().length > 0].join('|');
    if (key === tableKey) return;
    tableKey = key;
    if (!fs.length || !processed[idx]){ wrap.innerHTML=''; const rb = $$('PkReset'); if (rb) rb.style.display = 'none'; fitCsvIcons(root); return; }
    const fp = getFileParams(idx);
    const allPks = processed[idx].peaks;
    const resetBtn = $$('PkReset');
    const hasManual = (manualPeaks[idx]||[]).length > 0;
    const hasRemoved = (removedPeaks[idx]||[]).length > 0;
    if (resetBtn) resetBtn.style.display = (hasRemoved || hasManual) ? '' : 'none';

    const pks = allPks.filter(pk=>!pk.removed);
    if (!pks.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No peaks found with current parameters.</p>'; return; }
    // (only peaks of height 0 left — manual ones on the baseline — none has a relative
    // intensity: a dash; up to v484 0/0 printed NaN%)
    const maxH = Math.max(...pks.map(pk=>pk.height)), relOf = h => maxH > 0 ? (h/maxH*100).toFixed(1) + '%' : '—';
    const showCorr = !!model() && !std;
    const sizeCol = !std;
    // The table scrolls sideways in its own box when the screen is narrower than it;
    // the summary and warnings under it stay put.
    let html='<div class="peak-scroll"><table><thead><tr><th>#</th><th>2θ (°)</th><th>Relative Intensity</th><th>FWHM (°)</th>'+(sizeCol?'<th>Crystallite size (nm)</th>':'')+(showCorr?'<th>Crystallite size corr. (nm)</th>':'')+'<th></th></tr></thead><tbody>';
    pks.forEach((pk,i)=>{
      const fwhm = pk.fwhmClassic;
      const sizeRawCell = sizeCol ? `<td>${fmtCell(sizeRaw(fwhm, pk.detPos, fp.K, fp.lambda))}</td>` : '';
      const below = showCorr && belowInstr(fwhm, pk.detPos);
      const corrCell = showCorr ? (below ? `<td title="Narrower than the instrumental width at this angle">⚠</td>` : `<td>${fmtCell(sizeCorr(fwhm, pk.detPos, fp.K, fp.lambda))}</td>`) : '';
      const sel = panel.sel!=null && Math.abs(pk.pos-panel.sel)<1e-9 ? ' selected' : '';
      html+=`<tr class="peak-row${pk.manual?' manual-peak':''}${sel}" data-pos="${esc(pk.pos)}" data-det="${esc(pk.detPos)}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${relOf(pk.height)}</td><td${std && isFinite(pk.fwhmSig) ? ` title="± ${pk.fwhmSig.toPrecision(2)}° (counting statistics)"` : ''}>${isFinite(fwhm)?fwhm.toFixed(3):'—'}</td>${sizeRawCell}${corrCell}<td style="text-align:center"><button class="peak-del is-danger idle-dim" data-det="${esc(pk.detPos)}" data-manual="${pk.manual?1:0}" title="Remove peak">${X_SVG(13)}</button></td></tr>`;
    });
    html+='</tbody></table></div>';
    if (!std){
      const st = sampleSizeStats(idx);
      html += `<div class="size-summary">Mean crystallite size: <b>${fmtMeanStd(st.rawMean, st.rawStd, st.rawN)} nm</b>`;
      if (st.showCorr) html += `<br>Instr.-corrected: <b>${fmtMeanStd(st.corrMean, st.corrStd, st.corrN)} nm</b>`;
      html += '</div>';
      if (st.below) html += belowInstrHtml(st.below);
      if (st.outside) html += outsideStdHtml(st.outside, st.span);
    }
    wrap.innerHTML=html;

    wrap.querySelectorAll('.peak-row').forEach(row=>{
      const pos = parseFloat(row.dataset.pos);
      row.addEventListener('mouseenter', ()=> setHover(pos));
      row.addEventListener('mouseleave', ()=> setHover(null));
      row.addEventListener('click', e=>{
        if (e.target.closest('.peak-del')) return;
        selectPeak(pos);
      });
    });
    wrap.querySelectorAll('.peak-del').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const det = parseFloat(btn.dataset.det);
        if (btn.dataset.manual === '1'){
          // Manual peaks are deleted permanently: drop them from manualPeaks so the
          // removal is independent of the peak-search params (which reset removedPeaks).
          if (manualPeaks[idx]) manualPeaks[idx] = manualPeaks[idx].filter(v=>Math.abs(v-det) >= 1e-6);
        } else {
          if (!removedPeaks[idx]) removedPeaks[idx] = [];
          if (!removedPeaks[idx].some(v=>Math.abs(v-det)<1e-6)) removedPeaks[idx].push(det);
        }
        refreshAfterPeakEdit(idx);
      });
    });
    fitCsvIcons(root);
  }

  /* The standard's Caglioti fit, in the right-hand column, as the Tauc cards give E_g:
     the formula, then one value a line — U, V, W with their standard errors; R² of the
     fit; the RMS of the FWHM residuals, in degrees like the widths in the table; the
     peaks it rests on and their 2θ span. The residual standard error on FWHM² and the
     largest residual are in the tooltips. A curve that drops to zero inside the
     standard's own range is flagged under the box: the width it gives there is not
     physical. */
  let cagKey = '';
  function renderCaglioti(){
    const box = $$('Cag'), alert = $$('CagAlert');
    if (!box || !alert) return;
    const m = instrModel(), key = files().length + '|' + idOf(m);
    if (key === cagKey) return;
    cagKey = key;
    alert.innerHTML = '';
    let html = `<div class="txt-mini">Caglioti fit</div><div class="pg-stat cag-formula">FWHM² = U·tan²θ + V·tanθ + W</div>`;
    if (!m || !m.pts.length){ box.innerHTML = html + `<div class="pg-stat cag-note">${files().length ? 'No peaks' : 'No standard loaded'}: no instrumental correction.</div>`; return; }
    const n = m.pts.length, lo = m.pts[0].x, hi = m.pts[n-1].x;
    const span = n > 1 ? `, 2θ ${lo.toFixed(2)}–${hi.toFixed(2)}°` : `, 2θ ${lo.toFixed(2)}°`;
    if (!m.fit){
      // What the fit lacks is 3 distinct angles: 3 peaks at 2 (a manual peak put on a
      // detected one) do not make a curve either.
      const nx = new Set(m.pts.map(q=> q.x)).size;
      const lack = nx === n ? `it needs 3 peaks or more` : `it needs peaks at 3 angles or more, and these ${n} lie at ${nx}`;
      box.innerHTML = html + `<div class="pg-stat">Peaks: <b>${n}</b>${span}</div>`
        + `<div class="pg-stat cag-note">Not fitted: ${lack}. The instrumental width is ${nx === 1
          ? "the peak's FWHM at every angle" : 'interpolated between the peaks, and held at the end ones beyond them'}.</div>`;
      return;
    }
    const f = m.fit;
    html += ['U', 'V', 'W'].map((k, i)=> `<div class="pg-stat">${k}: <b>${fmtPar(f.uvw[i], f.se[i])} °²</b></div>`).join('');
    const dofTxt = `${f.dof} degree${f.dof === 1 ? '' : 's'} of freedom`;
    if (f.dof > 0 && f.weighted) html += `<div class="pg-stat" title="χ² = Σ((FWHM − fit)/σ)² over ${dofTxt}, σ each width's counting uncertainty. About 1: the curve follows the peaks within their counting errors. Well above 1: it does not (Kα₂ partly resolved, asymmetry, a peak that is not the standard's), and U, V, W carry errors scaled by its square root.">χ²<sub>red</sub>: <b>${f.chi2r.toPrecision(2)}</b></div>`;
    html += f.dof > 0
      ? `<div class="pg-stat" title="${f.weighted ? 'Weighted as the fit is (1/σ² on each width)' : `Unweighted: no counting uncertainty for the widths. Residual standard error on FWHM²: ${f.s.toPrecision(2)} °² (${dofTxt})`}">R²: <b>${f.r2.toFixed(4)}</b></div>`
      : `<div class="pg-stat cag-note">Exact through its 3 peaks: no degree of freedom left to judge the fit by.</div>`;
    // To two significant digits: a good standard's residuals are tenths of a
    // thousandth of a degree, which three decimals would show as 0.000°.
    if (f.dof > 0) html += `<div class="pg-stat" title="Largest residual: ${f.maxRes.toPrecision(2)}°">FWHM residual (RMS): <b>${f.rms.toPrecision(2)}°</b></div>`;
    html += `<div class="pg-stat">Peaks: <b>${n}</b>${span}</div>`;
    box.innerHTML = html;
    let neg = false;
    for (let k = 0; k <= 100 && !neg; k++) neg = cagAt(f.uvw, ((lo + (hi - lo)*k/100)/2)*Math.PI/180) <= 0;
    if (neg) alert.innerHTML = `<div class="alert warn">⚠ The fitted FWHM² drops to zero inside the standard's range: there the curve is not physical, and no correction is made.</div>`;
  }

  /* ---- Results (a card's): the patterns stacked, and the crystallite sizes ---- */
  // Stacked, baseline-subtracted overview. `curves[k]` holds each sample's raw
  // (un-offset) trace on its own x axis; null entries (e.g. no fit) are skipped.
  // The plot as last drawn: the patterns, their curves and colours, the normalisation, its
  // size. A label is no part of it: the legend's (written again alone), and the name the
  // figure composer gives its trace (set in place).
  let stackKey = '', stackPlot = null, stackLeg = '';
  function drawStackedResults(curves){
    const fs = files();
    const shown = [];
    fs.forEach((f,k)=>{ if (curves[k]) shown.push(k); });
    const svg = $$('ResSvg'), legend = $$('ResLegend');
    const leg = shown.map(k=> `<span><i style="background:${esc(fs[k].color)}"></i>${esc(fs[k].label)}</span>`).join('');
    if (leg !== stackLeg){ stackLeg = leg; legend.innerHTML = leg; }
    const key = [norm, sizeOf(svg), ...shown.map(k=> [fs[k].name, fs[k].color, idOf(fs[k].x), idOf(curves[k])].join(':'))].join('|');
    if (stackPlot && key === stackKey){
      const lab = new Map(shown.map(k=> [fs[k].name, fs[k].label]));
      stackPlot._stored.forEach(e=>{ if (lab.has(e.key)) e.label = lab.get(e.key); });
      return stackPlot;
    }
    stackKey = '';
    const gmax = topOf(shown.map(k=>maxArr(curves[k])));
    // (none: the curves as they are, spaced by the largest — the plot's unit)
    const unit = norm==='none' ? gmax : 1, n = shown.length, baseOf = j => -j * 1.1 * unit;
    const plot = stackPlot = new Plot(svg, {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    let lo=Infinity, hi=-Infinity;
    shown.forEach(k=>{ lo=Math.min(lo, fs[k].x[0]); hi=Math.max(hi, fs[k].x[fs[k].x.length-1]); });
    if (!isFinite(lo)){ lo = 0; hi = 1; }
    plot.setRange(lo, hi, baseOf(Math.max(0,n-1)), baseOf(0)+1.1*unit);
    plot.drawAxes();
    shown.forEach((k, j)=>{
      const raw = curves[k];
      const mx = norm==='local' ? (maxArr(raw)||1) : norm==='none' ? 1 : gmax;
      const norm1 = raw.map(v=> v/mx);            // exactly the CSV's own column
      const y = norm1.map(v=> v + baseOf(j) + 0.05*unit);
      // Draw the stacked trace, but hand the composer the un-offset CSV values.
      plot.line(fs[k].x, y, fs[k].color, 1.3, undefined,
                { raw: { xs: fs[k].x, ys: norm1 }, label: fs[k].label, key: fs[k].name });
    });
    stackKey = key;
    return plot;
  }
  /* Per-sample crystallite size as a box plot of its peaks' sizes — one box per sample,
     two side by side when a standard is in use (size, and corrected) — with the mean ±
     the standard deviation written above. */
  // The series (a standard in use: two), and where each box ends on top: its whisker, or an
  // outlier above it.
  const sizeSeries = rows => [{ k:'raw', name:'size', color:'#3aa0ff' }].concat(rows.some(r=> r.corrBox) ? [{ k:'corr', name:'size corr.', color:'#ff7a59' }] : []);
  const boxTop = b => Math.max(b.hi, ...b.out);
  const sizeTops = (rows, SER = sizeSeries(rows)) => rows.flatMap(r=> SER.map(m=> r[m.k+'Box']).filter(Boolean).map(boxTop)).filter(v=> isFinite(v) && v > 0);
  function drawSizeBarChart(rows, chips){
    const svg = $$('SizeBarSvg'); if (!svg) return;
    const wrap = svg.closest('.plot-wrap'), legend = $$('SizeBarLegend');
    const SER = sizeSeries(rows), anyCorr = SER.length > 1;
    const tops = sizeTops(rows, SER);
    if (!files().length || !processed.length || !tops.length){
      svg.style.display='none'; if(wrap)wrap.style.display='none'; if(legend)legend.innerHTML=''; return;
    }
    svg.style.display=''; if(wrap)wrap.style.display='';
    const n = rows.length;
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const brect = svg.getBoundingClientRect();
    const svgW = brect.width || 640, svgH = brect.height || 420;
    // How the names are cut and tilted — see barNames.
    const fit = barNames(mctx, rows.map(r=> r.label), Math.max(60, svgW - 75), 55);
    const labels = fit.labels;
    const labelWs = labels.map(l=>mctx.measureText(l).width);
    let maxLbl=0; labelWs.forEach(w=>maxLbl=Math.max(maxLbl, w));
    const bottom = Math.round(26 + maxLbl*fit.sin);
    const fmtLab = (v,e)=> isFinite(e) ? `${v.toFixed(1)}±${e.toFixed(1)}` : v.toFixed(1);
    let maxValW=0;
    rows.forEach(r=> SER.forEach(m=>{ if (r[m.k+'Box']) maxValW = Math.max(maxValW, mctx.measureText(fmtLab(r[m.k+'Mean'], r[m.k+'Std'])).width); }));
    const mTop=15, gap=6, plotH=svgH-mTop-bottom, reserve=gap+maxValW+6;
    const frac = plotH>reserve ? (1-reserve/plotH) : 0.5;
    // Box geometry as the bars had it: capped at their sizes, shrinking to fit the
    // per-sample spacing so many samples don't overlap; a pair keeps its ±17 px offset
    // unless the slot is too narrow, then the two scale together.
    const pxSlot = (svgW - 75)/(n + 1);
    const sc = Math.min(1, (pxSlot*0.8)/66);   // 66 = full paired span at hw16/dx17
    const hw = anyCorr ? 16*sc : Math.min(16, pxSlot*0.3), dx = anyCorr ? 17*sc : 0;
    const offOf = mi => SER.length > 1 ? (mi ? dx : -dx) : 0;
    // The labels kept clear of the chips in the corner, as on the other bar charts.
    const under = [];
    rows.forEach((r, k)=> SER.forEach((m, mi)=>{ const b = r[m.k+'Box']; if (b) under.push({ x:k+1, dx:offOf(mi), top:boxTop(b), w:mctx.measureText(fmtLab(r[m.k+'Mean'], r[m.k+'Std'])).width }); }));
    const ymax = Math.max(Math.max(...tops)*1.15, Math.max(...tops)/frac,
      barChipYmax(chips, svg, under, { W:svgW, ml:55, mr:20, mTop, plotH, gap, x0:0, x1:n+1 }));
    const plot = new Plot(svg, {xlabel:'', ylabel:'Crystallite size (nm)', noXTickLabels:true, noXGrid:true, yGrid:true, margin:{l:55,r:20,t:mTop,b:bottom}});
    // Fixed at [0, n+1]: the names are made to fit it, not the other way round.
    plot.setRange(0, n+1, 0, ymax||1);
    plot.drawAxes();
    for (let k=0;k<n;k++){
      const xc=k+1, r = rows[k];
      SER.forEach((m, mi)=>{
        const b = r[m.k+'Box'];
        if (!b) return;
        const off = offOf(mi);
        plot.box(xc, { ...b, mean: r[m.k+'Mean'], err: r[m.k+'Std'] }, m.color, hw, off, { label: m.name });
        plot.barLabel(xc, boxTop(b), fmtLab(r[m.k+'Mean'], r[m.k+'Std']), {gap, dx:off});
      });
      plot.tickLabel(xc, labels[k], fit.rot, r.label, r.name);
    }
    plot.attachTools(wrap);
    if (legend) legend.innerHTML = SER.map(m=> `<span><i class="mk-box" style="background:${m.color}"></i>${m.name}</span>`).join('');
  }
  /* The reflections the samples share: their peaks matched across samples by
     position, each position taken as a value whose uncertainty is the peak's FWHM. Two
     are the same reflection when they lie within one sigma of each other, √(w₁² + w₂²)
     — against a reflection already holding several, its mean position and mean FWHM.
     A reflection holds at most one peak per sample; `common` are those every sample
     has, `extra` the rest. */
  function sizeReflections(){
    const idxs = files().map((_, k)=> k).filter(k=> processed[k]);
    if (!idxs.length) return { idxs, common: [], extra: [] };
    const corrOn = !!model();
    const all = [];
    idxs.forEach(k=>{
      const fp = getFileParams(k);
      processed[k].peaks.filter(pk=> !pk.removed).forEach(pk=>{
        const raw = sizeRaw(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda);
        if (!isFinite(raw)) return;
        all.push({ k, pos: pk.detPos, w: pk.fwhmClassic, raw, corr: corrOn ? sizeCorr(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda) : NaN });
      });
    });
    all.sort((a,b)=> a.pos - b.pos);
    const groups = [];
    for (const q of all){
      const g = groups[groups.length-1];
      if (g && !g.by.has(q.k) && Math.abs(q.pos - g.pos) < Math.hypot(q.w, g.w)){
        g.by.set(q.k, q);
        const ms = [...g.by.values()];
        g.pos = ms.reduce((s, r)=> s + r.pos, 0) / ms.length;
        g.w   = ms.reduce((s, r)=> s + r.w, 0) / ms.length;
      } else groups.push({ pos: q.pos, w: q.w, by: new Map([[q.k, q]]) });
    }
    return { idxs, common: groups.filter(g=> g.by.size === idxs.length), extra: groups.filter(g=> g.by.size < idxs.length) };
  }
  // By peak there is something to show from two samples sharing a reflection on.
  const byPeakOk = R => R.idxs.length >= 2 && R.common.length > 0;
  // One box per reflection, its points the samples' sizes there.
  const reflectionRows = R => R.common.map(g=>{
    const ps = [...g.by.values()];
    return { name: `2θ ${g.pos.toFixed(2)}°`, label: `${g.pos.toFixed(2)}°`, pos: g.pos, ps,
             ...sizeSummary(ps.map(q=> q.raw), ps.map(q=> q.corr).filter(isFinite), false, !!model()) };
  });
  // The chart as last drawn: what it draws (its rows, the chips in its corner) and its size;
  // the chips and the note under it as last written.
  let sizeKey = '', chipsHtml = '', noteHtml = '';
  function renderSizeChart(){
    const chips = $$('SizeBy'), note = $$('SizeByNote'), svg = $$('SizeBarSvg');
    const R = sizeReflections(), ok = byPeakOk(R), by = ok ? sizeBy : 'sample';
    // Two chips, one at a time; with a single sample there is nothing to compare by peak.
    const ch = R.idxs.length < 2 ? '' : [['sample', 'by sample'], ['peak', 'by peak']].map(([k, t])=>
      `<button type="button" class="mode-chip plot-chip${by === k ? ' is-on' : ''}" data-size-by="${k}"`
      + `${k === 'peak' && !ok ? ' disabled title="No reflection is found in every sample"' : ` title="Crystallite size ${t}"`}>${t}</button>`).join('');
    if (chips && ch !== chipsHtml){ chipsHtml = ch; chips.innerHTML = ch; }
    const rows = by === 'peak' ? reflectionRows(R)
      : files().map((f, k)=>({name:f.name, label:f.label, ...sampleSizeStats(k)}));
    // (shown before it is measured: one hidden measures nothing)
    const hide = !files().length || !processed.length || !sizeTops(rows).length;
    if (svg && !hide){ svg.style.display = ''; svg.closest('.plot-wrap').style.display = ''; }
    const key = hide ? 'none' : JSON.stringify([rows, ch, sizeOf(svg)]);
    if (key !== sizeKey){ sizeKey = ''; drawSizeBarChart(rows, chips); sizeKey = key; }
    // What is left out by peak: the reflections not every sample has, and whose they are.
    const nt = by === 'peak' && R.extra.length
      ? `Not in every sample, left out: ${R.extra.map(g=> `${g.pos.toFixed(2)}° (${[...g.by.keys()].map(k=> esc(files()[k].label)).join(', ')})`).join('; ')}.` : '';
    if (note && nt !== noteHtml){ noteHtml = nt; note.innerHTML = nt; }
    sizeNames();
  }
  // The chart's downloads follow what it shows, and the card's name.
  let cardName = '';
  function sizeNames(){
    if (!res) return;
    const R = sizeReflections(), by = byPeakOk(R) ? sizeBy : 'sample', pre = cardName ? cardName + ' - ' : '';
    const wrap = $$('SizeBarSvg').closest('.plot-wrap');
    wrap.querySelectorAll('.plot-dl-btn, .plot-csv-btn').forEach(b=>{
      b.dataset.csvNames = pre + (by === 'peak' ? 'crystallite_size_by_peak.csv' : 'crystallite_size.csv');
      if (b.classList.contains('plot-dl-btn')) b.dataset.dlName = pre + (by === 'peak' ? 'XRPD_crystallite_size_by_peak.svg' : 'XRPD_crystallite_size.svg');
    });
  }
  if (res) res.addEventListener('click', e=>{
    const b = e.target.closest('[data-size-by]');
    if (!b || b.disabled || b.dataset.sizeBy === sizeBy) return;
    sizeBy = b.dataset.sizeBy;
    renderSizeChart();
    host.commit();
  });
  function renderResults(){
    if (!res || !files().length || !processed.length) return;
    // Analysis: smoothed − SNIP baseline
    drawStackedResults(processed.map(pr=>pr.subtracted));
    renderSizeChart();
  }

  // Re-derive everything downstream of a peak edit (add/remove/reset) on file `idx`.
  function refreshAfterPeakEdit(idx){
    reprocessOne(idx);
    updateView(true);
    renderTable();
    renderResults();
    host.changed();
    host.commit();
  }

  /* ---- The fields ----
     With no file a field, the box, the chips and the λ preset set the stored values all the
     same, for the files to come, as a step of the history (up to v484 a field and the box
     were not kept: the next refresh put the stored values back in them). */
  // Per-field shared/per-sample toggles (one segmented control per editable field)
  const TOGGLE_FIELD = { N:'N', Bl:'blWin', H:'pkHeight', P:'pkProm', D:'pkDist', K:'K', L:'lambda' };
  const SIZE_ONLY = new Set(['K','lambda']);
  function syncModeButtons(){
    if (std) return;
    Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{ const c = $$('Mode' + tid); if (c) c.textContent = paramMode[key]==='shared' ? 'all' : 'one'; });
  }
  if (!std) Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{
    $$('Mode' + tid).addEventListener('click', ()=>{
      const mode = paramMode[key]==='shared' ? 'per' : 'shared';
      // The value currently displayed on the graph for this field (the baseline's
      // width with its box: one chip for both)
      const keys = key==='blWin' ? ['snipW', 'blOn'] : key==='N' ? ['smoothW'] : [key];
      const cur = getFileParams(curIdx());
      paramMode[key] = mode;
      $$('Mode' + tid).textContent = mode==='shared' ? 'all' : 'one';
      if (mode==='shared'){
        // Switching to "all": every sample takes the value of the sample on show
        keys.forEach(k=>{ shared[k] = cur[k]; });
      } else {
        // Switching to "one": every sample starts from the common value, then each is
        // changed on its own
        files().forEach((f, i)=>{ if (!perParams[i]) perParams[i] = {}; keys.forEach(k=>{ perParams[i][k] = cur[k]; }); });
      }
      // (a width shared again: its note, if a project's conversion left one, goes, and the
      // value in points it kept for the files left out)
      if (mode==='shared'){ stepNote = stepNote.filter(m=> m !== key); delete heldPts[key]; if (key === 'blWin') delete heldPts.blOn; }
      writeStoreToInputs();
      if (files().length){
        if (!SIZE_ONLY.has(key)){
          if (mode==='shared') reprocessAll(); else reprocessOne(curIdx());
          updateView(true);
        }
        renderTable(); renderResults();
      }
      host.commit();
    });
  });
  if (!std) $$('Norm').addEventListener('change', e=>{
    norm = normOf(e.target.value);
    if (files().length) renderResults();
    host.commit();
  });
  // The baseline's box: as a change of its window (no peak deletion undone).
  $$('BlOn').addEventListener('change', ()=>{
    readInputsToStore();
    writeStoreToInputs();
    if (!files().length){ host.commit(); return; }
    if (paramMode.blWin==='shared') reprocessAll(); else reprocessOne(curIdx());
    updateView(true);
    renderTable(); renderResults();
    host.changed();
    host.commit();
  });
  Object.entries(FIELD_INPUT).forEach(([key, id])=>{
    const el = $$(id);
    const isSizeOnly = SIZE_ONLY.has(key);   // K/λ don't affect processing
    const isPeakSearch = (key==='pkHeight' || key==='pkProm' || key==='pkDist');
    const apply = ()=>{
      readInputsToStore();
      writeStoreToInputs();
      if (!files().length){ host.commit(); return; }
      if (isSizeOnly){ renderTable(); renderResults(); host.commit(); return; } // only the Scherrer size changes
      // Peak deletions reset only when this peak-search field changes
      if (isPeakSearch){
        if (paramMode[key]==='shared') removedPeaks = removedPeaks.map(()=>[]);
        else removedPeaks[curIdx()] = [];
      }
      if (paramMode[modeOf(key)]==='shared') reprocessAll(); else reprocessOne(curIdx());
      updateView(true);      // the analysis is live
      renderTable(); renderResults();
      host.changed();
      host.commit();
    };
    el.addEventListener('change', apply);
    el.addEventListener('keydown', e=>{ if (e.key==='Enter') el.blur(); });
  });
  // Wavelength preset selector: choosing a source fills + locks the λ value and
  // recomputes; "Custom" unlocks the field for a free value.
  if (!std){
    const sel = $$('LambdaSel'), inp = $$('Lambda');
    sel.addEventListener('change', ()=>{
      if (sel.value === 'custom'){ inp.readOnly = false; inp.focus(); if (inp.select) inp.select(); }
      else { inp.readOnly = true; inp.value = parseFloat(sel.value); inp.dispatchEvent(new Event('change', { bubbles:true })); }
    });
    syncLambdaSelect();
    $$('Prev').onclick = ()=> host.step(-1);
    $$('Next').onclick = ()=> host.step(1);
    $$('Std').onclick = ()=> host.openStd();
  }

  // Reset peaks: drop manual + removed peaks and re-run the search for the file on show
  $$('PkReset').onclick = ()=>{
    const idx = curIdx();
    if (!files()[idx]) return;
    manualPeaks[idx] = [];
    removedPeaks[idx] = [];
    refreshAfterPeakEdit(idx);
  };

  /* ---------- Add-peak mode ---------- */
  const addPeak = (()=>{
    let addMode = false, addIdx = null;
    const btn = $$('AddPeak');
    const svgNode = $$('Svg');
    const getIdx = ()=> curIdx();
    const clearGuide = ()=> svgNode.querySelectorAll('.add-guide').forEach(e=>e.remove());
    function drawGuide(){
      clearGuide();
      const plot = anaPlot, idx = getIdx();
      if (!addMode || !plot || !processed[idx] || addIdx==null) return;
      const m = plot.margin; const {w,h} = plot.size();
      const pr = processed[idx];
      const mxv = maxArr(pr.smoothed) || 1;
      const xv = files()[idx].x[addIdx];
      const yval = pr.smoothed[addIdx] / mxv;
      const px = plot.px(xv), py = plot.py(yval);
      plot.svg.appendChild(svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'#ffd24a','stroke-width':1.5,'stroke-dasharray':'4,3','pointer-events':'none','class':'add-guide'}));
      plot.svg.appendChild(svgEl('circle',{cx:px,cy:py,r:3.5,fill:'#ffd24a','pointer-events':'none','class':'add-guide'}));
      // Readout follows the drawn vertical guide (flips to the left near the right
      // edge), two lines using the plot's axis names + units:
      // "2θ = 45.123 °" / "Intensity = 0.520 a. u.".
      const fmt=v=>{ const a=Math.abs(v); return a>=1000?v.toFixed(0):a>=1?v.toFixed(3):v.toPrecision(3); };
      const flip = px > w - m.r - 130;
      const tx = px + (flip ? -8 : 8);
      const t = svgEl('text',{x:tx,y:m.t+14,'font-size':12,fill:'#ffd24a',stroke:'#0b0f12','stroke-width':3.5,'paint-order':'stroke','font-family':'monospace','text-anchor':flip?'end':'start','pointer-events':'none','class':'add-guide'});
      const l1=svgEl('tspan',{x:tx}); l1.textContent=axisReadout(plot.xlabel||'2θ', xv, fmt);
      const l2=svgEl('tspan',{x:tx,dy:16}); l2.textContent=axisReadout(plot.ylabel||'Intensity', yval, fmt);
      t.appendChild(l1); t.appendChild(l2);
      plot.svg.appendChild(t);
    }
    function setMode(on){
      addMode = !!on;
      btn.classList.toggle('is-on', addMode);
      // Drop focus once armed so the arrow keys (which nudge the guide) don't put
      // the button into :focus-visible and paint a white selection outline.
      if (addMode) btn.blur();
      svgNode.style.cursor = addMode ? 'crosshair' : '';
      // While armed, suppress the plot's x/y hover readout + crosshair (same as pan/zoom).
      svgNode._suppressReadout = addMode;
      const plot = anaPlot;
      if (addMode && plot){ plot.setMode(null); plot._clearCrosshair(); }
      if (!addMode){ addIdx = null; clearGuide(); }
    }
    function confirmAdd(){
      if (addIdx==null) return;
      const idx = getIdx(), x = files()[idx] && files()[idx].x;
      // (an index past the end of the pattern on show, as a stale one could be, adds nothing)
      if (!x || !Number.isFinite(x[addIdx])){ setMode(false); return; }
      if (!manualPeaks[idx]) manualPeaks[idx] = [];
      manualPeaks[idx].push(x[addIdx]);
      setMode(false);
      refreshAfterPeakEdit(idx);
    }
    const pointToIdx = (e)=>{
      const plot = anaPlot;
      const rect = plot.svg.getBoundingClientRect();
      let xv = plot.invX(e.clientX - rect.left);
      xv = Math.max(plot.xmin, Math.min(plot.xmax, xv));
      return nearestIdx(files()[getIdx()].x, xv);
    };
    btn.onclick = ()=>{ if (files().length && getIdx()>=0) setMode(!addMode); };
    svgNode.addEventListener('pointermove', e=>{
      if (!addMode || !anaPlot || !processed[getIdx()]) return;
      addIdx = pointToIdx(e); drawGuide();
    });
    svgNode.addEventListener('pointerleave', ()=>{ if (addMode) clearGuide(); });
    svgNode.addEventListener('pointerdown', e=>{
      if (!addMode || !anaPlot || e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      addIdx = pointToIdx(e); confirmAdd();
    }, true);
    /* On show: the panel in the page (a card closed, switched to the other kind or rebuilt
       by an undo is out of it), laid out (its tab on show, the standard's window open, the
       card unfolded) and under no window (the standard's over the cards, a figure composer,
       the calendar, a settings window): a window is any backdrop laid out, as the composers
       and the calendar have no inline display to read. */
    const onShow = ()=> root.isConnected && root.getClientRects().length > 0 && !host.hidden()
      && ![...document.querySelectorAll('.modal-backdrop')].some(m=> m.getClientRects().length > 0 && !m.contains(root));
    // Capture phase + stopImmediatePropagation so that while add-peak is armed
    // it claims the arrow keys before the document-level sample-nav handler
    // (utils.js) can fire — otherwise ← / → would change sample instead of
    // nudging the guide. Only while the panel is on show: off show the mode is dropped
    // and the key goes on (to v473 a card closed, or the standard's window, kept ← / →
    // and Enter page-wide, and Enter added a peak where it was no longer seen).
    function onKey(e){
      if (!addMode) return;
      const plot = anaPlot, idx = getIdx(), f = files()[idx];
      if (!onShow() || !plot || !f){ setMode(false); return; }
      // A key typed in a field is the field's: Enter applies it, the arrows move the caret
      // (up to v484 the armed mode took them there too: Enter placed the peak, the field
      // was not applied).
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      // Enter on a button is the button's: the fold arrow reached by Tab folds the card, and
      // the fold leaves the mode (to v499 Enter placed the peak there, and the card stayed
      // open). The arrows move the guide and take the focus off a button, so a button clicked
      // meanwhile does not keep Enter: it places the peak.
      const onBtn = t && t.closest && t.closest('button, a[href], [role="button"], [role="menuitem"]');
      if (e.key==='Enter' && onBtn) return;
      if (e.key==='Escape'){ e.stopImmediatePropagation(); setMode(false); return; }
      if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
        e.preventDefault(); e.stopImmediatePropagation();
        if (onBtn) t.blur();
        const x = f.x;
        const a = nearestIdx(x, plot.xmin), b = nearestIdx(x, plot.xmax);
        const lo = Math.min(a,b), hi = Math.max(a,b);
        if (addIdx==null) addIdx = nearestIdx(x, (plot.xmin+plot.xmax)/2);
        addIdx = Math.max(lo, Math.min(hi, addIdx + (e.key==='ArrowRight'?1:-1)));
        drawGuide();
      } else if (e.key==='Enter'){ e.preventDefault(); e.stopImmediatePropagation(); confirmAdd(); }
    }
    document.addEventListener('keydown', onKey, true);
    return { isAdding:()=>addMode, setMode, off(){ document.removeEventListener('keydown', onKey, true); setMode(false); } };
  })();

  // Plot-side peak click-to-select (mirror of the table interaction), acting only when
  // no pan/zoom tool is armed and no peak is being placed; the hover is the marks' own.
  $$('Svg').addEventListener('click', ()=>{
    const plot = anaPlot; if (!plot || plot._mode || addPeak.isAdding()) return;
    if (panel.hov!=null) selectPeak(panel.hov);  // clicked a peak/FWHM → (de)select it
    else clearSelection();                      // clicked empty area → deselect
  });
  // Deselect when clicking anywhere in the table's box that isn't a peak row
  $$('PeakBox').addEventListener('click', e=>{ if (!e.target.closest('.peak-row')) clearSelection(); });

  /* ---- CSVs ---- */
  // Diffractogram block: refined (smoothed−SNIP, normalised) + raw + smoothed + SNIP background.
  function diffractoCols(k, refinedNorm){
    const f=files()[k], pr=processed[k], kp=getFileParams(k), mx=refinedNorm(k);
    return [
      {h:'2Theta_'+f.label,                          v:f.x.map(x=>fmtNum(x,6))},
      {h:f.label,                                    v:pr.subtracted.map(v=>fmtNum(v/mx,6))},
      {h:'Raw_'+f.label,                             v:f.y.map(v=>fmtNum(v,6))},
      // (the widths in °2θ, as the fields show them; to v510 the points, N= and win=)
      {h:`Smoothed_${f.label} (w=${widthText(kp.smoothW)}°)`,          v:pr.smoothed.map(v=>fmtNum(v,6))},
      {h:`SNIP_background_${f.label} (${kp.blOn ? 'W=' + widthText(kp.snipW*SHOWN.snipW) + '°' : 'off'})`, v:pr.snip.map(v=>fmtNum(v,6))},
    ];
  }
  // Classic peak-search block: 2θ, rel. intensity, FWHM, crystallite size [, corrected].
  function peakCols(k, withCorr, withSig){
    const f=files()[k], pr=processed[k], kp=getFileParams(k);
    const pks=pr.peaks.filter(pk=>!pk.removed);
    const maxH=Math.max(...pks.map(pk=>pk.height))||1;
    const cols=[
      {h:'Peak_2Theta_'+f.label,       v:pks.map(pk=>fmtNum(pk.pos,6))},
      {h:'Peak_RelIntensity_'+f.label, v:pks.map(pk=>fmtNum(pk.height/maxH,6))},
      {h:'Peak_FWHM_deg_'+f.label,     v:pks.map(pk=>isFinite(pk.fwhmClassic)?fmtNum(pk.fwhmClassic,5):'')},
      // The standard's: each width's counting uncertainty, the Caglioti fit's weights.
      ...(withSig ? [{h:'Peak_FWHM_sigma_deg_'+f.label, v:pks.map(pk=>isFinite(pk.fwhmSig)?fmtNum(pk.fwhmSig,5):'')}] : []),
      {h:'Peak_Size_nm_'+f.label,      v:pks.map(pk=>{const d=sizeRaw(pk.fwhmClassic,pk.detPos,kp.K,kp.lambda);return isFinite(d)?fmtNum(d,3):'';})},
    ];
    if (withCorr) cols.push({h:'Peak_Size_corr_nm_'+f.label, v:pks.map(pk=>{const d=sizeCorr(pk.fwhmClassic,pk.detPos,kp.K,kp.lambda);return isFinite(d)?fmtNum(d,3):'';})});
    return cols;
  }
  // One sample's size columns, as the chart and the table give them.
  const SIZE_COLS = ['nm', 'std_nm', 'n', 'median_nm', 'Q1_nm', 'Q3_nm'];
  const sizeCsvHead = anyStd => ['Sample', ...SIZE_COLS.map(c=> 'Crystallite_size_' + c),
    ...(anyStd ? SIZE_COLS.map(c=> 'Crystallite_size_corr_' + c) : [])];
  function sizeCsvCells(st, k){
    const n = st[k+'N'], b = st[k+'Box'], num = v => isFinite(v) ? fmtNum(v, 2) : '';
    return [num(st[k+'Mean']), n > 1 ? num(st[k+'Std']) : '', String(n), b ? num(b.med) : '', b ? num(b.q1) : '', b ? num(b.q3) : ''];
  }
  // The CSVs, each named after the card (pre: "<name> - "); the standard's in one file.
  function csvEntries(pre){
    const fs = files();
    if (!fs.length || !processed.length) return [];
    if (std){
      // Everything about the standard in one file: diffractogram + peaks (normalised
      // against its own max, as it stands alone).
      const own = () => (maxArr(processed[0].subtracted)||1);
      return [{name:'standard.csv', text:wideCsv([...diffractoCols(0, own), ...peakCols(0, false, true)])}];
    }
    const anyStd = !!model();
    const all = fs.map((f,k)=>k);
    // Normalization factors (match the results plots): local = own max, global = shared
    // max, none = 1 (the counts as they are).
    const gmaxSub = topOf(all.map(k=>maxArr(processed[k].subtracted)));
    const refinedNorm = k => norm==='local' ? (maxArr(processed[k].subtracted)||1) : norm==='none' ? 1 : gmaxSub;
    const entries = [];
    // diffractograms.csv — every sample's refined/raw/smoothed/SNIP columns.
    { const cols=[]; all.forEach(k=>cols.push(...diffractoCols(k, refinedNorm)));
      if (cols.length) entries.push({name:pre + 'diffractograms.csv', text:wideCsv(cols)}); }
    // Crystallite size (classic) — per-sample summary: mean ± std, n, and the box the chart draws.
    { let ct = csvLine(sizeCsvHead(anyStd));
      all.forEach(k=>{
        const st = sampleSizeStats(k);
        const row = [fs[k].label, ...sizeCsvCells(st, 'raw')];
        if (anyStd) row.push(...sizeCsvCells(st, 'corr'));
        ct += csvLine(row);
      });
      entries.push({name:pre + 'crystallite_size.csv', text:ct}); }
    // crystallite_size_by_peak.csv — per reflection the samples share: its 2θ, the
    // summary over the samples, then each sample's size there.
    { const R = sizeReflections();
      if (byPeakOk(R)){
        const rows = reflectionRows(R);
        let ct = csvLine(['Reflection_2theta_deg', ...sizeCsvHead(anyStd).slice(1), ...R.idxs.map(k=> 'Crystallite_size_nm_' + fs[k].label)]);
        rows.forEach(r=>{
          const own = R.idxs.map(k=>{ const q = r.ps.find(x=> x.k === k); return q ? fmtNum(q.raw, 2) : ''; });
          ct += csvLine([fmtNum(r.pos, 3), ...sizeCsvCells(r, 'raw'), ...(anyStd ? sizeCsvCells(r, 'corr') : []), ...own]);
        });
        entries.push({name:pre + 'crystallite_size_by_peak.csv', text:ct});
      } }
    // peaks.csv — classic peaks of every sample.
    { const cols=[]; all.forEach(k=>{ if (processed[k].peaks.some(pk=>!pk.removed)) cols.push(...peakCols(k, anyStd)); });
      if (cols.length) entries.push({name:pre + 'peaks.csv', text:wideCsv(cols)}); }
    return entries;
  }

  // Everything again from the files: after a change to them (added, removed, left out,
  // reordered, read again), or a state loaded. A peak being placed is dropped: its index
  // may be on another pattern than the one now on show (to v473 kept while there were
  // files: a standard replaced by a shorter one left it past the end, and Enter threw).
  function refresh(preserveView){
    addPeak.setMode(false);
    // (with no file the fields and the chips too: they show what a file loaded will take)
    if (!files().length){ processed = []; panel.sel = panel.hov = null; writeStoreToInputs(); syncModeButtons(); updateView(); renderTable(); return; }
    reprocessAll();
    writeStoreToInputs();
    syncModeButtons();
    updateView(preserveView);
    renderTable();
    renderResults();
  }

  return {
    res,
    // The per-sample arrays, for the file list to keep aligned with the included files.
    slots: key => std ? [] : [
      // (a file left out keeps its entry as it was: one of a project to v510, in points,
      // takes its widths at the file's step as it comes back, those v510 shared where the
      // conversion turned the chip to one: heldPts)
      { key: key + ':params', arr:perParams, make: (v, f)=> v ? entryOf(objOf(v), f && f.x ? meanStep(f.x) : NaN, heldPts) : {...shared} },
      { key: key + ':manual', arr:manualPeaks, make: v=> v ? v.slice() : [] },
      { key: key + ':removed', arr:removedPeaks, make: v=> v ? v.slice() : [] },
    ],
    addFile(){ perParams.push({...shared}); manualPeaks.push([]); removedPeaks.push([]); },
    // The standard's file replaced or taken away: its own peaks go with it.
    resetFile(){ perParams = files().map(()=> ({...shared})); manualPeaks = files().map(()=> []); removedPeaks = files().map(()=> []); panel.sel = panel.hov = null; },
    clear(){ processed=[]; perParams=[]; manualPeaks=[]; removedPeaks=[]; panel.sel=panel.hov=null; },
    refresh,
    // Another sample on show (the cards share it).
    show(){ addPeak.setMode(false); panel.sel=panel.hov=null; writeStoreToInputs(); updateView(); renderTable(); },
    /* The card folded by its arrow, the standard's window closed: a peak being placed is
       left, as by + Add peak again (its button off, the guide gone). Up to v499 it stayed
       on, unseen, until the next key dropped it: a card unfolded again had it still on. */
    disarm(){ addPeak.setMode(false); },
    // The standard changed: the corrected sizes, here and in the Results.
    sizesChanged(){ if (files().length){ renderTable(); renderResults(); } },
    // A label or a colour changed, the card unfolded, the tab on show again or resized: each
    // view drawn again where what it shows changed.
    redraw(){ if (files().length){ updateView(true); renderTable(); renderResults(); } },
    // What it shows beside its state (xrd.js shows): the peak picked in its table, given
    // back as its tab wakes or the page is reloaded, the state restored (which picks none).
    shows(){ return panel.sel != null ? { sel: panel.sel } : null; },
    showNext(v){ if (v && Number.isFinite(v.sel)) panel.sel = v.sel; },
    instrModel,
    // The downloads named after the card ("<name> - peaks.csv"), the size chart's by what it shows.
    setName(n){
      cardName = n;
      const pre = n ? n + ' - ' : '';
      [root, res].filter(Boolean).forEach(el=>{
        el.querySelectorAll('[data-csv-base]').forEach(b=>{ b.dataset.csvNames = b.dataset.csvBase.split(',').map(x=> pre + x).join(','); });
        el.querySelectorAll('[data-dl-base]').forEach(b=>{ b.dataset.dlName = pre + b.dataset.dlBase; });
        el.querySelectorAll('.plot-wrap').forEach(w=>{ const d = w.querySelector('.plot-dl-btn[data-csv-base]'), c = w.querySelector('.plot-csv-btn'); if (d && c) c.dataset.csvNames = d.dataset.csvNames; });
      });
      sizeNames();
    },
    csvEntries,
    // The card closed, switched to the other kind or rebuilt (xrd.js): its document
    // listener goes, and the add mode with it (to v473 it stayed, and kept the card's
    // closure, its arrays with it, for as long as the page).
    destroy(){ addPeak.off(); if (markHoverRAF){ cancelAnimationFrame(markHoverRAF); markHoverRAF = null; } },
    snapshot(){
      return { perParams: perParams.map(q=>({...q})), manualPeaks: manualPeaks.map(a=>a.slice()), removedPeaks: removedPeaks.map(a=>a.slice()),
        shared: {...shared}, paramMode: {...paramMode}, sizeBy, norm, ...(stepNote.length ? { stepNote: stepNote.slice() } : {}),
        ...(Object.keys(heldPts).length ? { heldPts: {...heldPts} } : {}) };
    },
    /* Every setting from the state, each set whether the state holds it or not: a value
       it has none of, or one that is no number (a project read in may hold anything), the
       default; a sample's own number only where it is one (the shared value otherwise),
       its baseline's box on unless the state says off. Up to v484 the shared values and
       the modes were merged over those in use: an undo past the box's untick, or a project
       without it, kept the box as it was left (the baseline off, the widths and sizes
       changed), and a list holding something else than lists (a project read in) threw.
       The widths of a project to v510, in points, are converted (fromPts). */
    restore(s){
      const obj = objOf;
      s = obj(s);
      const fs = files(), n = fs.length, st = fs.map(f=> meanStep(f.x));
      // (and the steps of the files left out, which come back with their entries)
      const stAll = st.concat(!std ? host.allFiles().filter(f=> f.included === false).map(f=> meanStep(f.x)) : []);
      const arr = (a, make)=> Array.isArray(a) ? a.slice(0, n).concat(Array.from({ length: Math.max(0, n - a.length) }, make)) : Array.from({ length: n }, make);
      const sh = obj(s.shared), pm = std ? {} : obj(s.paramMode);
      for (const k in FIELD_MIN) shared[k] = numOf(sh, k) ?? SHARED_DEF[k];
      shared.blOn = sh.blOn !== false;
      for (const k in MODE_DEF) paramMode[k] = pm[k] === 'shared' || pm[k] === 'per' ? pm[k] : MODE_DEF[k];
      const hp = obj(s.heldPts);
      heldPts = {};
      for (const m of ['N', 'blWin']) if (Number.isFinite(hp[m])) heldPts[m] = hp[m];
      if (Number.isFinite(heldPts.blWin) && typeof hp.blOn === 'boolean') heldPts.blOn = hp.blOn;
      perParams = arr(s.perParams, ()=> ({})).map((q, i)=> entryOf(obj(q), st[i], heldPts));
      stepNote = Array.isArray(s.stepNote) ? ['N', 'blWin'].filter(m=> s.stepNote.includes(m)) : [];
      /* A shared value in points was as many points on every pattern, those left out as
         they came back included: at one step (to 10⁻⁶), one width; at several, under all,
         as many widths, so its chip turns to one, each pattern its own (the note says so),
         a file left out its own as it comes back (heldPts); under one, each sample's own,
         or this where it had none. The shared value, which a file added takes, at the
         median step of those included. */
      const same = stAll.length > 0 && stAll.every(v=> Math.abs(v - stAll[0]) <= 1e-6*stAll[0]);
      const mid = q => q.slice().sort((a, b)=> a - b)[q.length >> 1];
      const med = same ? stAll[0] : n ? mid(st) : stAll.length ? mid(stAll) : NaN;
      for (const k in LEGACY){
        const v = sh[LEGACY[k]], m = modeOf(k);
        if (k in sh || !Number.isFinite(v)) continue;
        if (paramMode[m] === 'shared' && stAll.length > 1 && !same){
          paramMode[m] = 'per';
          if (!stepNote.includes(m)) stepNote.push(m);
          if (stAll.length > n){ heldPts[m] = v; if (k === 'snipW') heldPts.blOn = shared.blOn; }
          perParams.forEach(o=>{ delete o[k]; if (k === 'snipW') o.blOn = shared.blOn; });
        }
        if (paramMode[m] === 'per') perParams.forEach((o, i)=>{ if (!(k in o)) o[k] = fromPts(k, v, st[i]) ?? SHARED_DEF[k]; });
        shared[k] = fromPts(k, v, med) ?? SHARED_DEF[k];
      }
      const posOf = a => Array.isArray(a) ? a.filter(Number.isFinite) : [];
      manualPeaks = arr(s.manualPeaks, ()=> []).map(posOf);
      removedPeaks = arr(s.removedPeaks, ()=> []).map(posOf);
      sizeBy = s.sizeBy === 'peak' ? 'peak' : 'sample';
      norm = normOf(s.norm);
      panel.sel = panel.hov = null;
      writeStoreToInputs(); syncModeButtons();
    },
  };
}
