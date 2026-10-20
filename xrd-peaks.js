/* =========================================================
   XRPD — the peak analysis (Scherrer).
   A panel of its own on some files: the raw pattern, its moving-average smoothing,
   the SNIP baseline and the peaks found on what is left, with their FWHM and, for
   the samples, the Scherrer crystallite size of each. Made for a card (the samples,
   several cards each with its own parameters) or for the instrumental standard (one
   file, its own parameters, and the Caglioti fit of its widths that corrects the
   samples' sizes for the instrument's).
========================================================= */
import { esc, fmtNum, csvLine, linspace, interpLinear, movingAverage, meanArr, stdArr, maxArr, minArr, X_SVG, guardNumericInput, guardNumberInputs, fitCsvIcons, barNames, barChipYmax, NORM_OPTIONS, normOf } from './utils.js';
import { svgEl, Plot, axisReadout } from './plot.js';

// Index of the grid point nearest to a 2θ on a uniform axis.
function nearestIdx(x, pos){
  if (!x || !x.length) return 0;
  const span = (x[x.length-1]-x[0]) || 1;
  const t = (pos-x[0])/span*(x.length-1);
  return Math.max(0, Math.min(x.length-1, Math.round(t)));
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

// SNIP baseline: iteratively clip peaks downward
function computeBaseline(y, halfWin){
  const n = y.length;
  const z = Float64Array.from(y);
  for (let w = halfWin; w >= 1; w--){
    for (let i = w; i < n-w; i++){
      const avg = (z[i-w] + z[i+w]) / 2;
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
   carried through the moving average that smoothed them (the covariances of
   neighbouring smoothed points included) and through those three readings, gives
   the width's to first order. The SNIP background, smooth over many points, counts
   as exact. NaN where the width is, or a crossing is flat. */
function fwhmSigma(x, y, idx0, yraw, N, varMul){
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
  // The moving average's weights, as movingAverage takes them: N + 1 points with
  // half-weight ends for an even N, cut short at the ends of the pattern.
  N = Math.max(1, Math.round(N));
  const n = yraw.length, h = Math.floor(N/2), even = N > 1 && N % 2 === 0;
  const win = i =>{
    const w = new Map(); let W = 0;
    for (let k = Math.max(0, i-h); k <= Math.min(n-1, i+h); k++){ const v = even && (k === i-h || k === i+h) ? 0.5 : 1; w.set(k, v); W += v; }
    return { w, W };
  };
  const vy = k => Math.max(yraw[k], 0)*(varMul ? varMul[k] : 1);
  const ks = [...g.keys()], wins = new Map(ks.map(k=> [k, win(k)]));
  let v = 0;
  for (const i of ks) for (const j of ks){
    const a = wins.get(i), b = wins.get(j);
    let c = 0;
    a.w.forEach((wi, k)=>{ const wj = b.w.get(k); if (wj) c += wi*wj*vy(k); });
    v += g.get(i)*g.get(j)*c/(a.W*b.W);
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

const DL_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>`;
const CSV_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="11" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">CSV</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>`;
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

export const PEAKS_INFO = `Per-sample view. Raw pattern (grey), moving-average smoothing (blue), SNIP baseline (orange) and detected peaks (green). The <b>SNIP</b> (Statistics-sensitive Non-linear Iterative Peak-clipping) baseline iteratively clips each point downward toward the average of its two neighbours at decreasing distances, from the window width down to one point, so the peaks are cut away and the slowly varying background is left; its box unticked, there is none, and the pattern is read from zero as it is. Peaks are searched on the smoothed pattern with the baseline taken off: a peak must reach the minimum height and stand out by the minimum prominence (both in % of the highest), and two peaks closer than the minimum distance keep the taller. The FWHM is read where the profile crosses half its height, interpolated between points; the crystallite size is Scherrer's, D = Kλ / (β·cosθ). With an instrumental standard (<b>Instrumental standard…</b>), the instrument's width at each angle is taken off in quadrature, β² = β<sub>obs</sub>² − β<sub>instr</sub>², for the corrected size. <b>+ Add peak</b> places a peak by hand on the plot; the × in a row removes one. Use the <b>all / one</b> toggles to share a value across samples or set it per sample.`;
export const STD_INFO = `A measured standard (large, strain-free crystallites — LaB₆, Si…) characterises the instrumental broadening β<sub>instr</sub>(2θ). It is analysed here on its own, always normalised to its highest peak (= 1), with parameters of its own. Its peaks' FWHM are fitted with the Caglioti function, FWHM² = U·tan²θ + V·tanθ + W, which gives the instrument's width at any angle: the samples' corrected sizes take it off in quadrature. One file at a time: a file dropped replaces the one there.`;

/* host: {
     files()          the files analysed (the included samples; the standard's one)
     idx(), step(d)   the sample on show, shared by the cards, and stepping it (samples)
     commit()         a step of the undo history
     instr()          the standard's model { pts, fit } or null (samples)
     changed()        its peaks or sizes changed: the standard's, every card's sizes follow;
                      a card's, its Results section is redrawn by itself
     openStd()        open the standard's modal (samples)
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
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-names="standard.csv" data-dl-name="XRPD_standard.svg">${DL_ICON}</button>
            </div>
          </div>
          <div class="pside-under">${LEGEND}</div>
          <div class="pside-col xrd-std-side">
            <div class="txt-mini param-head">Parameters</div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Smooth">Smoothing window (pts)</label>
              <input type="number" class="pg-field" id="${p}Smooth" value="1" min="1">
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP window (pts)</label></div>
              <input type="number" class="pg-field" id="${p}BlWin" value="150" min="1">
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
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="diffractograms.csv,peaks.csv" data-csv-names="diffractograms.csv,peaks.csv" data-dl-base="XRPD_sample.svg" data-dl-name="XRPD_sample.svg">${DL_ICON}</button>
            </div>
            ${LEGEND}
          </div>
          <div class="col mw280" style="align-self:flex-start">
            <div class="txt-mini param-head aligned">Parameters</div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Norm">Normalization</label>
              <select id="${p}Norm" class="pg-field">${NORM_OPTIONS}</select>
              <div class="txt-label pg-title">Smoothing window (pts) ${chip(p, 'N', 'all')}</div>
              <input type="number" class="pg-field" id="${p}Smooth" value="10" min="1">
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP window (pts)</label> ${chip(p, 'Bl', 'all')}</div>
              <input type="number" class="pg-field" id="${p}BlWin" value="150" min="1">
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
              <button class="btn plot-dl-btn" data-dl-svg="${p}ResSvg" data-csv-mod="xrd" data-csv-base="diffractograms.csv" data-csv-names="diffractograms.csv" data-dl-base="XRPD_results_analysis.svg" data-dl-name="XRPD_results_analysis.svg" data-dl-legend="${p}ResLegend">${DL_ICON}</button>
            </div>
            <div id="${p}ResLegend" class="legend"></div>
          </div>
          <!-- The crystallite size beside the intensities it is read from. -->
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Crystallite size</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}SizeBarSvg"></svg>
              <span class="plot-chips" id="${p}SizeBy"></span>
              <button class="btn plot-dl-btn" data-dl-svg="${p}SizeBarSvg" data-csv-mod="xrd" data-csv-names="crystallite_size.csv" data-dl-name="XRPD_crystallite_size.svg" data-dl-legend="${p}SizeBarLegend">${DL_ICON}</button>
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
  const paramMode = { N:'shared', blWin:'shared', pkHeight:'per', pkProm:'per', pkDist:'per', K:'shared', lambda:'shared' };
  // Shared param values (defaults); the standard's own start unsmoothed, and never
  // share anything (one file), nor size anything (K, λ unused).
  const FIELD_DEF = { N:10, blWin:150, pkHeight:5, pkProm:3, pkDist:0.3, K:0.9, lambda:1.540598 };
  const shared = std ? { ...FIELD_DEF, N:1 } : { ...FIELD_DEF };
  if (std) Object.keys(paramMode).forEach(k=> paramMode[k] = 'shared');
  // Per-sample param overrides (indexed by file idx). blOn: the SNIP baseline subtracted
  // (its box ticked, the default) or not; it goes with its window, under the window's
  // all / one (paramMode.blWin). Absent (projects before v463) is on.
  let perParams = []; // array of {N, blWin, blOn, pkHeight, pkProm, pkDist, K, lambda}
  // What the crystallite-size box plot is by: each sample's peaks ('sample'), or each
  // reflection the samples share, over the samples ('peak').
  let sizeBy = 'sample';
  let norm = 'global';
  // Selection/hover state of the peak table and plot.
  const panel = { sel:null, hov:null };
  let anaPlot = null;

  // input id ↔ stored field key
  const FIELD_INPUT = std ? { N:'Smooth', blWin:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist' }
    : { N:'Smooth', blWin:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist', K:'K', lambda:'Lambda' };
  const FIELD_MIN   = { N:1, blWin:1, pkHeight:0, pkProm:0, pkDist:0, K:1e-6, lambda:1e-6 };

  // Validation feedback (shake + auto-correct) for the decimal (type=text) fields;
  // the number fields are guarded as any of the page's. Wired before the fields' own
  // change handlers.
  guardNumberInputs(root);
  [ ['PkHeight',0,5], ['PkProm',0,3], ['PkDist',0,0.3], ...(std ? [] : [['K',1e-6,0.9], ['Lambda',1e-6,1.540598]]) ]
    .forEach(([id,min,def])=> guardNumericInput($$(id), { min, def }));

  // Get params for a specific file index (respects per-field shared/per mode)
  function getFileParams(i){
    const pp = perParams[i] || {};
    const g = (k, m = k) => paramMode[m]==='shared' ? shared[k] : (pp[k] ?? shared[k]);
    return { N:g('N'), blWin:g('blWin'), blOn:g('blOn', 'blWin') !== false, pkHeight:g('pkHeight'), pkProm:g('pkProm'), pkDist:g('pkDist'), K:g('K'), lambda:g('lambda') };
  }
  // Parse a decimal field tolerant of comma separators; only fall back on a genuinely empty/invalid value
  function numField(id, def){
    const raw = String($$(id).value).trim().replace(',', '.');
    if (raw === '') return def;
    const v = parseFloat(raw);
    return isNaN(v) ? def : v;
  }
  // Read inputs into the appropriate store for the sample on show
  function readInputsToStore(){
    const k = curIdx();
    for (const key in FIELD_INPUT){
      const v = Math.max(FIELD_MIN[key], numField(FIELD_INPUT[key], FIELD_DEF[key]));
      if (paramMode[key]==='shared') shared[key] = v;
      else { if (!perParams[k]) perParams[k] = {}; perParams[k][key] = v; }
    }
    const on = $$('BlOn').checked;
    if (paramMode.blWin==='shared') shared.blOn = on;
    else { if (!perParams[k]) perParams[k] = {}; perParams[k].blOn = on; }
  }
  // Push stored values for the sample on show into the input fields
  function writeStoreToInputs(){
    const pr = getFileParams(curIdx());
    for (const key in FIELD_INPUT) $$(FIELD_INPUT[key]).value = pr[key];
    // (disabled, not hidden: the window means nothing with no baseline)
    $$('BlOn').checked = pr.blOn; $$('BlWin').disabled = !pr.blOn;
    if (!std){ $$('Norm').value = norm; syncLambdaSelect(); }
  }
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

  function reprocessOne(i){
    const pr = getFileParams(i);
    const f = files()[i];
    const x = f.x;
    const yraw       = f.y;
    const smoothed   = movingAverage(yraw, pr.N);                      // display + detection
    // SNIP baseline (estimate/fallback/standard); switched off, none: the pattern from zero
    const snip       = pr.blOn ? computeBaseline(smoothed, pr.blWin) : new Array(smoothed.length).fill(0);
    /* For the peak search and the classic FWHM. The half-maximum walk needs a smooth
       profile — on the raw counts the noise stops it short — and the smoothing, a box
       N points wide convolved into every peak, widens them in turn: the window is the
       user's to keep small against the peak widths, the raw pattern drawn beside it. */
    const detSub     = smoothed.map((v,j)=>Math.max(0, v-snip[j]));
    const rawSub     = yraw.map((v,j)=>v-snip[j]);
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
      pk.fwhmSig = fwhmSigma(x, detSub, pk.idx, yraw, pr.N, f.varMul);
    });
    const subtracted = detSub;
    processed[i]     = {smoothed, baseline:snip, snip, subtracted, rawSub, peaks};
  }
  function reprocessAll(){
    processed = [];
    for (let i=0; i<files().length; i++) reprocessOne(i);
  }

  // The standard's peaks the instrumental width is taken from, in 2θ order, and the
  // Caglioti fit to them (null with fewer than 3). Null with no file.
  function instrModel(){
    if (!std || !files().length || !processed[0]) return null;
    const pts = processed[0].peaks
      .filter(pk=>!pk.removed && isFinite(pk.fwhm))
      .map(pk=>({x:pk.pos, th:(pk.pos/2)*Math.PI/180, b:pk.fwhm, s:pk.fwhmSig}))
      .sort((a,b)=>a.x-b.x);
    return { pts, fit: fitCaglioti(pts) };
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
  function drawAnalysisInto(idx, preserveView){
    const f  = files()[idx];
    const pr = processed[idx];
    if (!f || !pr) return;
    const mx = maxArr(pr.smoothed) || 1;
    const prevPlot = anaPlot;
    const prev = (preserveView && prevPlot) ? {xmin:prevPlot.xmin, xmax:prevPlot.xmax, ymin:prevPlot.ymin, ymax:prevPlot.ymax} : null;

    const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
    const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
    const baseD  = interpLinear(f.x, pr.baseline, dense);

    const svgNode = $$('Svg');
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
  }

  // The sample on show (the standard's file), its plot and its label.
  function updateView(preserveView){
    const fs = files();
    const label = $$('CurrentLabel');     // (none on the standard's: its window names it)
    if (!fs.length || !processed.length){ if (label) label.textContent = '—'; return; }
    const k = Math.min(curIdx(), fs.length - 1);
    if (label) label.textContent = fs[k].label;
    if (!std) $$('Idx').textContent = (k+1)+'/'+fs.length;
    if (host.hidden && host.hidden()) return;
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
  function renderTable(){
    const wrap = $$('PeakTableWrap');
    if (!wrap) return;
    if (std) renderCaglioti();
    const fs = files(), idx = Math.min(curIdx(), fs.length - 1);
    if (!fs.length || !processed[idx]){ wrap.innerHTML=''; const rb = $$('PkReset'); if (rb) rb.style.display = 'none'; fitCsvIcons(root); return; }
    const fp = getFileParams(idx);
    const allPks = processed[idx].peaks;
    const resetBtn = $$('PkReset');
    const hasManual = (manualPeaks[idx]||[]).length > 0;
    const hasRemoved = (removedPeaks[idx]||[]).length > 0;
    if (resetBtn) resetBtn.style.display = (hasRemoved || hasManual) ? '' : 'none';

    const pks = allPks.filter(pk=>!pk.removed);
    if (!pks.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No peaks found with current parameters.</p>'; return; }
    const maxH = Math.max(...pks.map(pk=>pk.height));
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
      html+=`<tr class="peak-row${pk.manual?' manual-peak':''}${sel}" data-pos="${esc(pk.pos)}" data-det="${esc(pk.detPos)}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${(pk.height/maxH*100).toFixed(1)}%</td><td${std && isFinite(pk.fwhmSig) ? ` title="± ${pk.fwhmSig.toPrecision(2)}° (counting statistics)"` : ''}>${isFinite(fwhm)?fwhm.toFixed(3):'—'}</td>${sizeRawCell}${corrCell}<td style="text-align:center"><button class="peak-del is-danger idle-dim" data-det="${esc(pk.detPos)}" data-manual="${pk.manual?1:0}" title="Remove peak">${X_SVG(13)}</button></td></tr>`;
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
  function renderCaglioti(){
    const box = $$('Cag'), alert = $$('CagAlert');
    if (!box || !alert) return;
    alert.innerHTML = '';
    const m = instrModel();
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
  function drawStackedResults(curves){
    const fs = files();
    const shown = [];
    fs.forEach((f,k)=>{ if (curves[k]) shown.push(k); });
    const gmax = topOf(shown.map(k=>maxArr(curves[k])));
    // (none: the curves as they are, spaced by the largest — the plot's unit)
    const unit = norm==='none' ? gmax : 1, n = shown.length, baseOf = j => -j * 1.1 * unit;
    const plot = new Plot($$('ResSvg'), {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = $$('ResLegend'); legend.innerHTML='';
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
      const s=document.createElement('span');
      s.innerHTML=`<i style="background:${esc(fs[k].color)}"></i>${esc(fs[k].label)}`;
      legend.appendChild(s);
    });
    return plot;
  }
  /* Per-sample crystallite size as a box plot of its peaks' sizes — one box per sample,
     two side by side when a standard is in use (size, and corrected) — with the mean ±
     the standard deviation written above. */
  function drawSizeBarChart(rows, chips){
    const svg = $$('SizeBarSvg'); if (!svg) return;
    const wrap = svg.closest('.plot-wrap'), legend = $$('SizeBarLegend');
    const anyCorr = rows.some(r=> r.corrBox);
    const SER = [{ k:'raw', name:'size', color:'#3aa0ff' }].concat(anyCorr ? [{ k:'corr', name:'size corr.', color:'#ff7a59' }] : []);
    // Where each box ends on top: its whisker, or an outlier above it.
    const boxTop = b => Math.max(b.hi, ...b.out);
    const tops = rows.flatMap(r=> SER.map(m=> r[m.k+'Box']).filter(Boolean).map(boxTop)).filter(v=> isFinite(v) && v > 0);
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
  function renderSizeChart(){
    const chips = $$('SizeBy'), note = $$('SizeByNote');
    const R = sizeReflections(), ok = byPeakOk(R), by = ok ? sizeBy : 'sample';
    // Two chips, one at a time; with a single sample there is nothing to compare by peak.
    if (chips) chips.innerHTML = R.idxs.length < 2 ? '' : [['sample', 'by sample'], ['peak', 'by peak']].map(([k, t])=>
      `<button type="button" class="mode-chip plot-chip${by === k ? ' is-on' : ''}" data-size-by="${k}"`
      + `${k === 'peak' && !ok ? ' disabled title="No reflection is found in every sample"' : ` title="Crystallite size ${t}"`}>${t}</button>`).join('');
    const rows = by === 'peak' ? reflectionRows(R)
      : files().map((f, k)=>({name:f.name, label:f.label, ...sampleSizeStats(k)}));
    drawSizeBarChart(rows, chips);
    // What is left out by peak: the reflections not every sample has, and whose they are.
    if (note) note.innerHTML = by === 'peak' && R.extra.length
      ? `Not in every sample, left out: ${R.extra.map(g=> `${g.pos.toFixed(2)}° (${[...g.by.keys()].map(k=> esc(files()[k].label)).join(', ')})`).join('; ')}.` : '';
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
    if (host.changed) host.changed();
    host.commit();
  }

  /* ---- The fields ---- */
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
      // window with its box: one chip for both)
      const keys = key==='blWin' ? ['blWin', 'blOn'] : [key];
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
      writeStoreToInputs();
      if (files().length){
        if (!SIZE_ONLY.has(key)){
          if (mode==='shared') reprocessAll(); else reprocessOne(curIdx());
          updateView(true);
        }
        renderTable(); renderResults();
        host.commit();
      }
    });
  });
  if (!std) $$('Norm').addEventListener('change', e=>{
    norm = normOf(e.target.value);
    if (files().length){ renderResults(); host.commit(); }
  });
  // The baseline's box: as a change of its window (no peak deletion undone).
  $$('BlOn').addEventListener('change', ()=>{
    if (!files().length){ $$('BlWin').disabled = !$$('BlOn').checked; return; }
    readInputsToStore();
    writeStoreToInputs();
    if (paramMode.blWin==='shared') reprocessAll(); else reprocessOne(curIdx());
    updateView(true);
    renderTable(); renderResults();
    if (host.changed) host.changed();
    host.commit();
  });
  Object.entries(FIELD_INPUT).forEach(([key, id])=>{
    const el = $$(id);
    const isSizeOnly = SIZE_ONLY.has(key);   // K/λ don't affect processing
    const isPeakSearch = (key==='pkHeight' || key==='pkProm' || key==='pkDist');
    const apply = ()=>{
      if (!files().length) return;
      readInputsToStore();
      writeStoreToInputs();
      if (isSizeOnly){ renderTable(); renderResults(); host.commit(); return; } // only the Scherrer size changes
      // Peak deletions reset only when this peak-search field changes
      if (isPeakSearch){
        if (paramMode[key]==='shared') removedPeaks = removedPeaks.map(()=>[]);
        else removedPeaks[curIdx()] = [];
      }
      if (paramMode[key]==='shared') reprocessAll(); else reprocessOne(curIdx());
      updateView(true);      // the analysis is live
      renderTable(); renderResults();
      if (host.changed) host.changed();
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
    const onShow = ()=> root.isConnected && root.getClientRects().length > 0 && !(host.hidden && host.hidden())
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
      if (e.key==='Escape'){ e.stopImmediatePropagation(); setMode(false); return; }
      if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
        e.preventDefault(); e.stopImmediatePropagation();
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
      {h:`Smoothed_${f.label} (N=${kp.N})`,          v:pr.smoothed.map(v=>fmtNum(v,6))},
      {h:`SNIP_background_${f.label} (${kp.blOn ? 'win=' + kp.blWin : 'off'})`, v:pr.snip.map(v=>fmtNum(v,6))},
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
    if (!files().length){ processed = []; panel.sel = panel.hov = null; updateView(); renderTable(); return; }
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
      { key: key + ':params', arr:perParams, make: v=> v ? {...v} : {...shared} },
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
    // The standard changed: the corrected sizes, here and in the Results.
    sizesChanged(){ if (files().length){ renderTable(); renderResults(); } },
    redraw(){ if (files().length){ updateView(true); renderTable(); renderResults(); } },
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
        shared: {...shared}, paramMode: {...paramMode}, sizeBy, norm };
    },
    restore(s){
      s = s || {};
      const n = files().length;
      const arr = (a, make)=> Array.isArray(a) ? a.slice(0, n).concat(Array.from({ length: Math.max(0, n - a.length) }, make)) : Array.from({ length: n }, make);
      if (s.shared) Object.assign(shared, s.shared);
      if (s.paramMode && !std) Object.assign(paramMode, s.paramMode);
      perParams = arr(s.perParams, ()=> ({...shared})).map(q=> ({...q}));
      manualPeaks = arr(s.manualPeaks, ()=> []).map(a=> a.slice());
      removedPeaks = arr(s.removedPeaks, ()=> []).map(a=> a.slice());
      sizeBy = s.sizeBy === 'peak' ? 'peak' : 'sample';
      norm = normOf(s.norm);
      panel.sel = panel.hov = null;
    },
  };
}
