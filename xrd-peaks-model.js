/* =========================================================
   XRPD — the peak analysis's calculations (Scherrer), which touch no page (xrd-peaks.js
   wires them to the cards; tests/peaksmodel.test.mjs calls them in Node): the SNIP
   baseline, the peak search, the half-maximum FWHM and its counting uncertainty, a
   pattern's processing from its settings; the standard's Caglioti fit and the
   instrumental width from it; the Scherrer sizes, a sample's and by reflection, and what
   the size chart draws; a sample's settings, the card's state saved and read back (a
   project's to v510, in points, converted); the CSVs. And (v561) what the card's wiring
   works out: its fields, the plot's curves and marks, the Results' stack and the size
   chart's layout, the changes to its state (below: THE CARD'S WIRING, WORKED OUT).
   utils.js's helpers (maxArr, meanArr, stdArr, boxStats, fmtNum, csvLine, linspace,
   interpLinear), which need a page to load, are handed in (u: xrd-peaks.js U).
========================================================= */
import { boxSmooth, boxWeights, meanStep, widthText, ptsText } from './smooth.js';

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
function findPeaks(x, y, minHeightPct, minPromPct, minDistDeg, { maxArr }){
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

/* ---- A pattern's processing ----
   Its smoothing and its baseline from its settings pr (fileParams), the box smoothing of
   its intensities y over its 2θ x and the SNIP baseline under it (none, the box unticked):
   the card keeps them by their widths (xrd-peaks.js k1). */
function smoothingOf(x, yraw, pr){
  const smoothed = boxSmooth(x, yraw, pr.smoothW);   // display + detection
  // SNIP baseline (estimate/fallback/standard); switched off, none: the pattern from zero
  const snip = pr.blOn ? computeBaseline(x, smoothed, pr.snipW) : new Array(smoothed.length).fill(0);
  /* For the peak search and the classic FWHM. The half-maximum walk needs a smooth
     profile — on the raw counts the noise stops it short — and the smoothing, a box
     w wide convolved into every peak, widens them in turn: the width is the
     user's to keep small against the peak widths, the raw pattern drawn beside it. */
  return { smoothed, snip, detSub: smoothed.map((v,j)=>Math.max(0, v-snip[j])) };
}
/* Its peaks on that smoothing and baseline (sm: smoothingOf's), the processing the card
   keeps (with its keys): those the peak search finds, those added by hand (manual, their
   2θ) and the detected ones removed (removed, their detected 2θ) marked so, each with its
   FWHM and that width's counting uncertainty (f.varMul: the counts' variance factors). */
function processingOf(f, sm, pr, manual, removed, u){
  const x = f.x;
  const yraw       = f.y;
  const { smoothed, snip, detSub } = sm;
  // (to v517 also the raw pattern less the baseline, a fourth array a pattern that nothing read)
  // Peak detection on the smoothed, SNIP-subtracted profile (robust to noise)
  const peaks      = findPeaks(x, detSub, pr.pkHeight, pr.pkProm, pr.pkDist, u);
  // Re-inject manually added peaks (survive param changes, cleared on reset); one with
  // no position (an add on a stale index could store one, to v473, and a save keep it)
  // is skipped.
  (manual||[]).filter(Number.isFinite).forEach(pos=>{
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
  const rem = removed || [];
  const remTol = Math.min(0.1, (pr.pkDist || 0.3) * 0.45);
  peaks.forEach(pk=>{ pk.removed = !pk.manual && rem.some(v=>Math.abs(v-pk.detPos) < remTol); });

  // SNIP baseline and the half-maximum FWHM.
  peaks.forEach(pk=>{
    if (pk.removed){ pk.fwhm=NaN; pk.fwhmClassic=NaN; return; }
    pk.fwhmClassic=computeFWHM(x, detSub, pk.idx); pk.fwhm=pk.fwhmClassic;
    pk.fwhmSig = fwhmSigma(x, detSub, pk.idx, yraw, pr.smoothW, f.varMul);
  });
  const subtracted = detSub;
  return {smoothed, baseline:snip, snip, subtracted, peaks};
}

/* ---- The standard: the Caglioti fit, the instrumental width ----
   Caglioti instrumental resolution: FWHM² = U·tan²θ + V·tanθ + W (θ = Bragg angle).
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
// The standard's peaks the instrumental width is taken from (its processing's, those kept
// with a width), in 2θ order, and the Caglioti fit to them (null with fewer than 3): the
// standard's model, which the card keeps by its processing (xrd-peaks.js modelOf).
function instrModelOf(peaks){
  const pts = peaks
    .filter(pk=>!pk.removed && isFinite(pk.fwhm))
    .map(pk=>({x:pk.pos, th:(pk.pos/2)*Math.PI/180, b:pk.fwhm, s:pk.fwhmSig}))
    .sort((a,b)=>a.x-b.x);
  return { pts, fit: fitCaglioti(pts) };
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

/* ---- The sizes ---- */
// Scherrer size (nm) from a FWHM (deg) at 2θ pos, with editable K and λ (Å): the size
// WITHOUT instrumental correction (raw β)
function scherrerD(betaDeg, pos, K, lam){
  if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
  const bRad = betaDeg * Math.PI/180, thRad = (pos/2) * Math.PI/180;
  return (K * lam / (bRad * Math.cos(thRad))) / 10; // nm (λ in Å → /10)
}
// Size WITH instrumental correction: β² = β_obs² − β_instr² (m: the standard's model)
function sizeCorr(betaDeg, pos, K, lam, m){
  if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
  const bInstr = instrBetaOf(m, pos);
  return scherrerD(Math.sqrt(Math.max(0, betaDeg*betaDeg - bInstr*bInstr)), pos, K, lam);
}
/* A peak narrower than the instrument at its angle leaves no width for the crystallite
   size: physically it cannot happen, so when it does the standard is at fault (its
   peaks wider than they should be, or misread). Such a peak has no corrected size;
   the peak table says so. */
function belowInstr(betaDeg, pos, m){
  if (!m || !isFinite(betaDeg) || betaDeg <= 0) return false;
  return betaDeg <= instrBetaOf(m, pos);
}

/* A sample's sizes, one per peak, summarised: their mean and their spread — the
   standard deviation, with n − 1 (the peaks are a sample of the crystallites) — and
   the box of the same spread. */
function sizeSummary(raw, corr, isStd, showCorr, { meanArr, stdArr, boxStats }){
  const one = (v, k)=>{
    const n = v.length, m = n ? meanArr(v) : NaN;
    return { [k+'N']: n, [k+'Mean']: m, [k+'Std']: n > 1 ? stdArr(v) : NaN, [k+'Box']: boxStats(v), [k+'Vals']: v };
  };
  return { isStd, showCorr, ...one(raw, 'raw'), ...one(corr, 'corr') };
}
// The classic crystallite sizes of a sample's kept peaks (pr: its processing, fp: its
// settings, m: the standard's model or null), summarised (sizeSummary), with how many are
// narrower than the instrument and how many lie beyond the standard's peaks (span).
function sampleSizes(pr, fp, m, std, u){
  const showCorr = !!m;
  const raw = [], corr = [];
  let below = 0, outside = 0;
  const span = showCorr ? stdSpanOf(m) : null;
  if (pr && !std){
    pr.peaks.filter(pk=>!pk.removed).forEach(pk=>{
      const s = scherrerD(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda);
      if (isFinite(s)) raw.push(s);
      if (showCorr){ const sc = sizeCorr(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda, m); if (isFinite(sc)) corr.push(sc); }
      if (showCorr && belowInstr(pk.fwhmClassic, pk.detPos, m)) below++;
      if (span && isFinite(pk.fwhmClassic) && (pk.detPos < span[0] || pk.detPos > span[1])) outside++;
    });
  }
  return { ...sizeSummary(raw, corr, std, showCorr, u), below, outside, span };
}
/* The reflections the samples share: their peaks matched across samples by
   position, each position taken as a value whose uncertainty is the peak's FWHM. Two
   are the same reflection when they lie within one sigma of each other, √(w₁² + w₂²)
   — against a reflection already holding several, its mean position and mean FWHM.
   A reflection holds at most one peak per sample; `common` are those every sample
   has, `extra` the rest. procs: the samples' processings, fps: their settings (one per
   sample), m: the standard's model or null. */
function sizeReflections(procs, fps, m){
  const idxs = fps.map((_, k)=> k).filter(k=> procs[k]);
  if (!idxs.length) return { idxs, common: [], extra: [] };
  const corrOn = !!m;
  const all = [];
  idxs.forEach(k=>{
    const fp = fps[k];
    procs[k].peaks.filter(pk=> !pk.removed).forEach(pk=>{
      const raw = scherrerD(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda);
      if (!isFinite(raw)) return;
      all.push({ k, pos: pk.detPos, w: pk.fwhmClassic, raw, corr: corrOn ? sizeCorr(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda, m) : NaN });
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
const reflectionRows = (R, m, u) => R.common.map(g=>{
  const ps = [...g.by.values()];
  return { name: `2θ ${g.pos.toFixed(2)}°`, label: `${g.pos.toFixed(2)}°`, pos: g.pos, ps,
           ...sizeSummary(ps.map(q=> q.raw), ps.map(q=> q.corr).filter(isFinite), false, !!m, u) };
});
/* Per-sample crystallite size as a box plot of its peaks' sizes — one box per sample,
   two side by side when a standard is in use (size, and corrected) — with the mean ±
   the standard deviation written above. */
// The series (a standard in use: two), and where each box ends on top: its whisker, or an
// outlier above it.
const sizeSeries = rows => [{ k:'raw', name:'size', color:'#3aa0ff' }].concat(rows.some(r=> r.corrBox) ? [{ k:'corr', name:'size corr.', color:'#ff7a59' }] : []);
const boxTop = b => Math.max(b.hi, ...b.out);
const sizeTops = (rows, SER = sizeSeries(rows)) => rows.flatMap(r=> SER.map(m=> r[m.k+'Box']).filter(Boolean).map(boxTop)).filter(v=> isFinite(v) && v > 0);
// The largest of some maxima, for a global normalisation: 1 only when there is
// nothing above zero to normalise by (a floor of 1 left data below 1 unnormalised).
function topOf(maxima){ const m = Math.max(-Infinity, ...maxima); return m > 0 ? m : 1; }

/* ---- The settings ----
   Per-field mode: 'shared' | 'per'. Defaults: peak-search fields per-sample, rest shared.
   (N is the smoothing's chip, blWin the baseline's: its width and its box.) */
const modeDef = std => std ? { N:'shared', blWin:'shared', pkHeight:'shared', pkProm:'shared', pkDist:'shared', K:'shared', lambda:'shared' }
  : { N:'shared', blWin:'shared', pkHeight:'per', pkProm:'per', pkDist:'per', K:'shared', lambda:'shared' };
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
const sharedDef = std => std ? { ...FIELD_DEF, smoothW:0 } : FIELD_DEF;
// (the SNIP's half-width above 0: one step at least, whatever is set)
const FIELD_MIN   = { smoothW:0, snipW:1e-6, pkHeight:0, pkProm:0, pkDist:0, K:1e-6, lambda:1e-6 };
// The widths, by the keys of the points they were up to v510; the chip each goes under.
const LEGACY = { smoothW:'N', snipW:'blWin' };
const modeOf = k => k === 'smoothW' ? 'N' : k === 'snipW' || k === 'blOn' ? 'blWin' : k;

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
// A file's params (pp: its own entry; respects per-field shared/per mode)
function fileParams(pp, paramMode, shared){
  const g = k => paramMode[modeOf(k)]==='shared' ? shared[k] : (pp[k] ?? shared[k]);
  return { smoothW:g('smoothW'), snipW:g('snipW'), blOn:g('blOn') !== false, pkHeight:g('pkHeight'), pkProm:g('pkProm'), pkDist:g('pkDist'), K:g('K'), lambda:g('lambda') };
}

// The card's state as saved (c: its settings, its peaks added and removed by hand, what the
// size chart is by, the normalisation, a project's conversion's note and points).
function stateOf({ perParams, manualPeaks, removedPeaks, shared, paramMode, sizeBy, norm, stepNote, heldPts }){
  return { perParams: perParams.map(q=>({...q})), manualPeaks: manualPeaks.map(a=>a.slice()), removedPeaks: removedPeaks.map(a=>a.slice()),
    shared: {...shared}, paramMode: {...paramMode}, sizeBy, norm, ...(stepNote.length ? { stepNote: stepNote.slice() } : {}),
    ...(Object.keys(heldPts).length ? { heldPts: {...heldPts} } : {}) };
}
/* Every setting from the state s (the card's restore), each set whether the state holds
   it or not: a value it has none of, or one that is no number (a project read in may
   hold anything), the default; a sample's own number only where it is one (the shared
   value otherwise), its baseline's box on unless the state says off. Up to v484 the
   shared values and the modes were merged over those in use: an undo past the box's
   untick, or a project without it, kept the box as it was left (the baseline off, the
   widths and sizes changed), and a list holding something else than lists (a project
   read in) threw. The widths of a project to v510, in points, are converted (fromPts).
   st: the steps of the files included, stAll: those and the steps of the files left out
   (which come back with their entries). The normalisation is the card's to read (utils.js
   normOf). */
function readState(s, std, st, stAll){
  const obj = objOf;
  s = obj(s);
  const n = st.length;
  const SHARED_DEF = sharedDef(std), MODE_DEF = modeDef(std);
  const arr = (a, make)=> Array.isArray(a) ? a.slice(0, n).concat(Array.from({ length: Math.max(0, n - a.length) }, make)) : Array.from({ length: n }, make);
  const sh = obj(s.shared), pm = std ? {} : obj(s.paramMode);
  const shared = {}, paramMode = {};
  for (const k in FIELD_MIN) shared[k] = numOf(sh, k) ?? SHARED_DEF[k];
  shared.blOn = sh.blOn !== false;
  for (const k in MODE_DEF) paramMode[k] = pm[k] === 'shared' || pm[k] === 'per' ? pm[k] : MODE_DEF[k];
  const hp = obj(s.heldPts);
  const heldPts = {};
  for (const m of ['N', 'blWin']) if (Number.isFinite(hp[m])) heldPts[m] = hp[m];
  if (Number.isFinite(heldPts.blWin) && typeof hp.blOn === 'boolean') heldPts.blOn = hp.blOn;
  const perParams = arr(s.perParams, ()=> ({})).map((q, i)=> entryOf(obj(q), st[i], heldPts));
  const stepNote = Array.isArray(s.stepNote) ? ['N', 'blWin'].filter(m=> s.stepNote.includes(m)) : [];
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
  const manualPeaks = arr(s.manualPeaks, ()=> []).map(posOf);
  const removedPeaks = arr(s.removedPeaks, ()=> []).map(posOf);
  const sizeBy = s.sizeBy === 'peak' ? 'peak' : 'sample';
  return { shared, paramMode, heldPts, perParams, stepNote, manualPeaks, removedPeaks, sizeBy };
}

/* ---- The CSVs ---- */
// Assemble a "wide" CSV from {h,v} columns, padded to the longest column.
function wideCsv(cols, { csvLine }){
  const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
  let t = csvLine(cols.map(c=>c.h));
  for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
  return t;
}
// Diffractogram block: refined (smoothed−SNIP, normalised by mx) + raw + smoothed + SNIP background.
function diffractoCols(f, pr, kp, mx, { fmtNum }){
  return [
    {h:'2Theta_'+f.label,                          v:f.x.map(x=>fmtNum(x,6))},
    {h:f.label,                                    v:pr.subtracted.map(v=>fmtNum(v/mx,6))},
    {h:'Raw_'+f.label,                             v:f.y.map(v=>fmtNum(v,6))},
    // (the widths in °2θ, as the fields show them; to v510 the points, N= and win=)
    {h:`Smoothed_${f.label} (w=${widthText(kp.smoothW)}°)`,          v:pr.smoothed.map(v=>fmtNum(v,6))},
    {h:`SNIP_background_${f.label} (${kp.blOn ? 'W=' + widthText(kp.snipW*SHOWN.snipW) + '°' : 'off'})`, v:pr.snip.map(v=>fmtNum(v,6))},
  ];
}
// Classic peak-search block: 2θ, rel. intensity, FWHM, crystallite size [, corrected by m].
function peakCols(f, pr, kp, withCorr, withSig, m, { fmtNum }){
  const pks=pr.peaks.filter(pk=>!pk.removed);
  const maxH=Math.max(...pks.map(pk=>pk.height))||1;
  const cols=[
    {h:'Peak_2Theta_'+f.label,       v:pks.map(pk=>fmtNum(pk.pos,6))},
    {h:'Peak_RelIntensity_'+f.label, v:pks.map(pk=>fmtNum(pk.height/maxH,6))},
    {h:'Peak_FWHM_deg_'+f.label,     v:pks.map(pk=>isFinite(pk.fwhmClassic)?fmtNum(pk.fwhmClassic,5):'')},
    // The standard's: each width's counting uncertainty, the Caglioti fit's weights.
    ...(withSig ? [{h:'Peak_FWHM_sigma_deg_'+f.label, v:pks.map(pk=>isFinite(pk.fwhmSig)?fmtNum(pk.fwhmSig,5):'')}] : []),
    {h:'Peak_Size_nm_'+f.label,      v:pks.map(pk=>{const d=scherrerD(pk.fwhmClassic,pk.detPos,kp.K,kp.lambda);return isFinite(d)?fmtNum(d,3):'';})},
  ];
  if (withCorr) cols.push({h:'Peak_Size_corr_nm_'+f.label, v:pks.map(pk=>{const d=sizeCorr(pk.fwhmClassic,pk.detPos,kp.K,kp.lambda,m);return isFinite(d)?fmtNum(d,3):'';})});
  return cols;
}
// One sample's size columns, as the chart and the table give them.
const SIZE_COLS = ['nm', 'std_nm', 'n', 'median_nm', 'Q1_nm', 'Q3_nm'];
const sizeCsvHead = anyStd => ['Sample', ...SIZE_COLS.map(c=> 'Crystallite_size_' + c),
  ...(anyStd ? SIZE_COLS.map(c=> 'Crystallite_size_corr_' + c) : [])];
function sizeCsvCells(st, k, { fmtNum }){
  const n = st[k+'N'], b = st[k+'Box'], num = v => isFinite(v) ? fmtNum(v, 2) : '';
  return [num(st[k+'Mean']), n > 1 ? num(st[k+'Std']) : '', String(n), b ? num(b.med) : '', b ? num(b.q1) : '', b ? num(b.q3) : ''];
}
/* The CSVs, each named after the card (pre: "<name> - "); the standard's in one file. The
   card's files, their processings (procs) and settings (fps), the standard's model (m, or
   null), the Results' normalisation. */
function csvTables(pre, { files: fs, procs: processed, fps, m, norm, std }, u){
  const { maxArr, csvLine, fmtNum } = u;
  if (!fs.length || !processed.length) return [];
  if (std){
    // Everything about the standard in one file: diffractogram + peaks (normalised
    // against its own max, as it stands alone).
    const own = maxArr(processed[0].subtracted)||1;
    return [{name:'standard.csv', text:wideCsv([...diffractoCols(fs[0], processed[0], fps[0], own, u), ...peakCols(fs[0], processed[0], fps[0], false, true, m, u)], u)}];
  }
  const anyStd = !!m;
  const all = fs.map((f,k)=>k);
  // Normalization factors (match the results plots): local = own max, global = shared
  // max, none = 1 (the counts as they are).
  const gmaxSub = topOf(all.map(k=>maxArr(processed[k].subtracted)));
  const refinedNorm = k => norm==='local' ? (maxArr(processed[k].subtracted)||1) : norm==='none' ? 1 : gmaxSub;
  const entries = [];
  // diffractograms.csv — every sample's refined/raw/smoothed/SNIP columns.
  { const cols=[]; all.forEach(k=>cols.push(...diffractoCols(fs[k], processed[k], fps[k], refinedNorm(k), u)));
    if (cols.length) entries.push({name:pre + 'diffractograms.csv', text:wideCsv(cols, u)}); }
  // Crystallite size (classic) — per-sample summary: mean ± std, n, and the box the chart draws.
  { let ct = csvLine(sizeCsvHead(anyStd));
    all.forEach(k=>{
      const st = sampleSizes(processed[k], fps[k], m, std, u);
      const row = [fs[k].label, ...sizeCsvCells(st, 'raw', u)];
      if (anyStd) row.push(...sizeCsvCells(st, 'corr', u));
      ct += csvLine(row);
    });
    entries.push({name:pre + 'crystallite_size.csv', text:ct}); }
  // crystallite_size_by_peak.csv — per reflection the samples share: its 2θ, the
  // summary over the samples, then each sample's size there.
  { const R = sizeReflections(processed, fps, m);
    if (byPeakOk(R)){
      const rows = reflectionRows(R, m, u);
      let ct = csvLine(['Reflection_2theta_deg', ...sizeCsvHead(anyStd).slice(1), ...R.idxs.map(k=> 'Crystallite_size_nm_' + fs[k].label)]);
      rows.forEach(r=>{
        const own = R.idxs.map(k=>{ const q = r.ps.find(x=> x.k === k); return q ? fmtNum(q.raw, 2) : ''; });
        ct += csvLine([fmtNum(r.pos, 3), ...sizeCsvCells(r, 'raw', u), ...(anyStd ? sizeCsvCells(r, 'corr', u) : []), ...own]);
      });
      entries.push({name:pre + 'crystallite_size_by_peak.csv', text:ct});
    } }
  // peaks.csv — classic peaks of every sample.
  { const cols=[]; all.forEach(k=>{ if (processed[k].peaks.some(pk=>!pk.removed)) cols.push(...peakCols(fs[k], processed[k], fps[k], anyStd, false, m, u)); });
    if (cols.length) entries.push({name:pre + 'peaks.csv', text:wideCsv(cols, u)}); }
  return entries;
}

/* =========================================================
   THE CARD'S WIRING, WORKED OUT (v561; to v560 inside xrd-peaks.js's closure)
   What xrd-peaks.js's functions decide, as plain functions of plain values or of the
   instance's state S (its settings, peaks and choices: xrd-peaks.js makeState), with no
   page: the fields read and written, a width's hint, the λ preset, the processing's keys,
   what the plot draws (its curves, its marks and their colours), the Results' stacked
   patterns and the size chart's layout, the chips switched, peaks removed and placed by
   hand, the per-sample arrays the file list keeps aligned, the state taken back.
========================================================= */
// The decimal fields: a setting's key → its input's id's end (the standard has no K, λ).
const fieldInputs = std => std ? { smoothW:'Smooth', snipW:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist' }
  : { smoothW:'Smooth', snipW:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist', K:'K', lambda:'Lambda' };
// Each one's guard (utils.js guardNumericInput: shake and set back): [its id's end, its least
// value, its default].
const guardsOf = std => [ ['Smooth',0,sharedDef(std).smoothW], ['BlWin',1e-6,FIELD_DEF.snipW*SHOWN.snipW], ['PkHeight',0,5], ['PkProm',0,3], ['PkDist',0,0.3], ...(std ? [] : [['K',1e-6,0.9], ['Lambda',1e-6,1.540598]]) ];
// Per-field shared/per-sample toggles (one segmented control per editable field): a chip's
// id's end → its mode's key; the fields that change the sizes alone (K, λ: no processing),
// and those of the peak search (a change of one brings its removed peaks back).
const TOGGLES = { N:'N', Bl:'blWin', H:'pkHeight', P:'pkProm', D:'pkDist', K:'K', L:'lambda' };
const SIZE_ONLY = new Set(['K','lambda']);
const PEAK_SEARCH = new Set(['pkHeight','pkProm','pkDist']);

// A decimal field's text as a number, tolerant of comma separators; only a genuinely
// empty or invalid value is def.
function numIn(text, def){
  const raw = String(text).trim().replace(',', '.');
  if (raw === '') return def;
  const v = parseFloat(raw);
  return isNaN(v) ? def : v;
}
// A field's value as stored (key: its setting): a width's field as written (shown), to 4
// significant digits, is the value stored, kept exact; else the value typed, at least
// its least.
function fieldIn(key, text, shown, exact){
  const sh = SHOWN[key] || 1;
  return key in LEGACY && text === shown ? exact : Math.max(FIELD_MIN[key], numIn(text, FIELD_DEF[key]*sh)/sh);
}
/* The fields read into the store (vals: each setting's value, in the fields' order; on: the
   baseline's box): for the sample on show (k), its own where its chip is one, else the
   shared; with no file (n: the files), every value into the shared ones, those a file
   loaded starts from. */
function takeInputs(S, k, vals, on, n){
  const own = m => S.paramMode[m]!=='shared' && n > 0;
  for (const key in vals){
    if (!own(modeOf(key))) S.shared[key] = vals[key];
    else { if (!S.perParams[k]) S.perParams[k] = {}; S.perParams[k][key] = vals[key]; }
  }
  if (!own('blWin')) S.shared.blOn = on;
  else { if (!S.perParams[k]) S.perParams[k] = {}; S.perParams[k].blOn = on; }
}
/* What a width's field (id: Smooth, BlWin) spans in points of the pattern on show, at its
   step st (label: the pattern's), from the value as it is typed (text; the width stored,
   exact, while the field shows it unchanged: one converted from points is that many steps,
   not its 4 digits' worth): the width over the step (the smoothing off at 0; the SNIP's
   passes on each side, as computeBaseline rounds them, in its title; to v515 those, '±K
   pts', in the field). Nothing with no file, or no value. → { t, tip } */
function widthHint(id, text, shown, exact, st, label){
  const sh = id === 'BlWin' ? SHOWN.snipW : 1;
  const v = text === shown && Number.isFinite(exact) ? exact*sh : parseFloat(String(text).trim().replace(',', '.'));
  let t = '', tip = '';
  if (st > 0 && v >= 0 && isFinite(v)){
    const at = ` at the step of ${label}, ${widthText(st)}°`;
    if (id === 'Smooth'){ t = v ? ptsText(v/st) : 'off'; tip = v ? `${widthText(v/st)} steps${at}` : 'No smoothing'; }
    else if (v > 0){ const K = Math.max(1, Math.round(v/sh/st) || 1); t = ptsText(v/st); tip = `${widthText(v/st)} steps across, ${K} point${K === 1 ? '' : 's'} on each side${at}`; }
  }
  return { t, tip };
}
// The wavelength preset the λ field's text matches (values: the selector's options'), else
// "custom".
function presetOf(text, values){
  const v = parseFloat(String(text).replace(',','.'));
  for (const o of values){ if (o!=='custom' && Math.abs(parseFloat(o)-v) < 5e-5) return o; }
  return 'custom';
}

/* A pattern's processing's keys (xrd-peaks.js keeps it by them): the smoothing and the
   baseline by the 2θ, the intensities and their widths (k1; to v510, in points, not the
   2θ), the peaks by those, the variance factors, the peak search and the peaks added and
   removed by hand (k2). pr: its settings (fileParams); idOf: an object's own number. */
function procKeys(f, pr, manual, removed, idOf){
  const k1 = [idOf(f.y), idOf(f.x), pr.smoothW, pr.blOn ? pr.snipW : 'off'].join('|');
  return { k1, k2: [k1, idOf(f.varMul), pr.pkHeight, pr.pkProm, pr.pkDist, (manual||[]).join(), (removed||[]).join()].join('|') };
}

/* ---- The plot: raw, smoothed, SNIP baseline, peaks (no fit), each pattern normalised to
   its own smoothed max (= 1) ---- */
// Peak marker colours
const PEAK_BASE = '#3f9d54';   // darker green, base
const PEAK_HOVER = '#5fcf6a';  // brighter green, transient hover
const PEAK_SEL  = '#ffffff';   // white, permanent selection
const FWHM_BASE  = '#b5292c';  // dark red, base (contrasts with the dark background)
const FWHM_HOVER = '#ff5a5a';  // brighter red, transient hover
const FWHM_SEL   = '#ff0000';  // pure red, permanent selection
/* What the plot draws of pattern f and its processing pr (blOn: its baseline subtracted):
   the raw and smoothed curves and the baseline (on a dense grid; none, off) over the
   smoothed max mx; and the marks: each kept peak's line once (peakMarks) and its FWHM's
   horizontal marker at half-maximum height, on the smoothed, baseline-subtracted profile
   (fwhmMarks). u: utils.js's maxArr, linspace, interpLinear. */
function anaOf(f, pr, blOn, { maxArr, linspace, interpLinear }){
  const mx = maxArr(pr.smoothed) || 1;
  const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
  const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
  const baseD  = interpLinear(f.x, pr.baseline, dense);
  const drawnPos = [], peakMarks = [], fwhmMarks = [];
  for (const pk of pr.peaks){
    if (pk.removed) continue;
    if (drawnPos.some(v=>Math.abs(v-pk.pos)<1e-9)) continue;
    drawnPos.push(pk.pos);
    peakMarks.push({pos:pk.pos});
    const gm = fwhmGeom(f.x, pr.subtracted, pk.idx);
    if (gm){
      const yDisp = (pr.baseline[gm.idx] + gm.half) / mx;
      fwhmMarks.push({pos:pk.pos, x0:gm.xl, x1:gm.xr, y:yDisp});
    }
  }
  return { mx, blOn, raw: f.y.map(v=>v/mx), smoothed: pr.smoothed.map(v=>v/mx), dense, base: blOn ? baseD.map(v=>v/mx) : null, peakMarks, fwhmMarks };
}
// The index of the value nearest pos within 0.6° (-1: none, or no pos).
function nearestOf(vals, pos){
  let best = -1, bd = Infinity;
  if (pos != null) vals.forEach((v, i)=>{ const d = Math.abs(v-pos); if (d < bd){ bd = d; best = i; } });
  return bd < 0.6 ? best : -1;
}
/* The marks' colours and widths ([stroke, width]) from the selection (sel) and the hover
   (hov): the peaks' lines (peakVals: their 2θ) and their FWHM markers (fwhmVals), which
   mirror the peak they share their 2θ with. */
function markStyles(peakVals, fwhmVals, sel, hov){
  const s = nearestOf(peakVals, sel), h = nearestOf(peakVals, hov);
  const peaks = peakVals.map((_, i)=> i === s ? [PEAK_SEL, 1.8] : i === h ? [PEAK_HOVER, 1.8] : [PEAK_BASE, 1]);
  const fwhm = fwhmVals.map(v=> s >= 0 && Math.abs(v - peakVals[s]) < 1e-9 ? [FWHM_SEL, 4]
    : h >= 0 && Math.abs(v - peakVals[h]) < 1e-9 ? [FWHM_HOVER, 4] : [FWHM_BASE, 2.2]);
  return { peaks, fwhm };
}
// The peak picked anew: the one picked again, none.
const toggled = (sel, pos)=> (sel!=null && Math.abs(pos-sel)<1e-9) ? null : pos;
// The guide of a peak being placed moved one point by an arrow (d: ±1) on the pattern's 2θ
// x, within the plot's range (xmin, xmax); from the middle, where it was nowhere (idx null).
function nudge(x, xmin, xmax, idx, d){
  const a = nearestIdx(x, xmin), b = nearestIdx(x, xmax);
  const lo = Math.min(a,b), hi = Math.max(a,b);
  if (idx==null) idx = nearestIdx(x, (xmin+xmax)/2);
  return Math.max(lo, Math.min(hi, idx + d));
}

/* ---- The Results: the patterns stacked, and the crystallite sizes ---- */
// The patterns the stack draws: those with a curve (curves[k]: its baseline-subtracted
// trace; null, none).
function stackShown(fs, curves){
  const shown = [];
  fs.forEach((f,k)=>{ if (curves[k]) shown.push(k); });
  return shown;
}
/* The stack: its range, and each pattern's trace (k: its file) normalised (norm1, exactly
   the CSV's own column; norm: 'global' the largest of all, 'local' its own, 'none' the
   curves as they are, spaced by the largest — the plot's unit) and offset (y). */
function stackOf(fs, curves, shown, norm, { maxArr }){
  const gmax = topOf(shown.map(k=>maxArr(curves[k])));
  const unit = norm==='none' ? gmax : 1, n = shown.length, baseOf = j => -j * 1.1 * unit;
  let lo=Infinity, hi=-Infinity;
  shown.forEach(k=>{ lo=Math.min(lo, fs[k].x[0]); hi=Math.max(hi, fs[k].x[fs[k].x.length-1]); });
  if (!isFinite(lo)){ lo = 0; hi = 1; }
  const traces = shown.map((k, j)=>{
    const raw = curves[k];
    const mx = norm==='local' ? (maxArr(raw)||1) : norm==='none' ? 1 : gmax;
    const norm1 = raw.map(v=> v/mx);
    return { k, norm1, y: norm1.map(v=> v + baseOf(j) + 0.05*unit) };
  });
  return { range: [lo, hi, baseOf(Math.max(0,n-1)), baseOf(0)+1.1*unit], traces };
}
// A size box's label: its mean ± its standard deviation (the mean alone, with none).
const sizeLab = (v,e)=> isFinite(e) ? `${v.toFixed(1)}±${e.toFixed(1)}` : v.toFixed(1);
/* The size chart's layout, one box per row (rows: its samples or reflections; SER: its
   series, size and corrected) in an svg W × H: the names (fit: utils.js barNames') under
   it, the room the labels over the boxes need (measure(text): its width in px), the boxes'
   half-width and offsets as the bars had them — capped at their sizes, shrinking to fit
   the per-sample spacing so many samples don't overlap; a pair keeps its ±17 px offset
   unless the slot is too narrow, then the two scale together — and the labels under the
   chips in the corner (under: utils.js barChipYmax's bars). */
function barLayout(rows, SER, fit, measure, W, H){
  const n = rows.length, lab = (r, m)=> sizeLab(r[m.k+'Mean'], r[m.k+'Std']);
  let maxLbl=0; fit.labels.map(measure).forEach(w=>maxLbl=Math.max(maxLbl, w));
  const bottom = Math.round(26 + maxLbl*fit.sin);
  let maxValW=0;
  rows.forEach(r=> SER.forEach(m=>{ if (r[m.k+'Box']) maxValW = Math.max(maxValW, measure(lab(r, m))); }));
  const mTop=15, gap=6, plotH=H-mTop-bottom, reserve=gap+maxValW+6;
  const frac = plotH>reserve ? (1-reserve/plotH) : 0.5;
  const pxSlot = (W - 75)/(n + 1), anyCorr = SER.length > 1;
  const sc = Math.min(1, (pxSlot*0.8)/66);   // 66 = full paired span at hw16/dx17
  const hw = anyCorr ? 16*sc : Math.min(16, pxSlot*0.3), dx = anyCorr ? 17*sc : 0;
  const offOf = mi => SER.length > 1 ? (mi ? dx : -dx) : 0;
  const under = [];
  rows.forEach((r, k)=> SER.forEach((m, mi)=>{ const b = r[m.k+'Box']; if (b) under.push({ x:k+1, dx:offOf(mi), top:boxTop(b), w:measure(lab(r, m)) }); }));
  return { n, bottom, mTop, gap, plotH, frac, hw, offOf, under };
}
// Its y range's top: over the tallest box, room for its label (frac: barLayout's), clear
// of the chips (chipY: barChipYmax's).
const barYmax = (tops, frac, chipY)=> Math.max(Math.max(...tops)*1.15, Math.max(...tops)/frac, chipY);
/* Its downloads' names, after the card (pre: "<name> - "): its image by what it shows (by),
   its CSVs never (v530), both, by sample and by peak (the second where there is one:
   byPeakOk), whichever the chips show, a view alone (v528); to v529 the one on show. */
const sizeDlNames = (pre, by)=> ({ csv: ['crystallite_size.csv', 'crystallite_size_by_peak.csv'].map(x=> pre + x).join(','),
  svg: pre + (by === 'peak' ? 'XRPD_crystallite_size_by_peak.svg' : 'XRPD_crystallite_size.svg') });

/* ---- The state S's changes ---- */
/* A chip switched (key: its mode's) from the settings shown, cur (the sample on show's):
   to "all", every sample takes the value of the sample on show; to "one", every sample (n:
   the files) starts from the common value, then each is changed on its own. One chip for
   the baseline's width and its box. A width shared again: its note, if a project's
   conversion left one, goes, and the value in points it kept for the files left out.
   → the mode. */
function switchMode(S, key, cur, n){
  const mode = S.paramMode[key]==='shared' ? 'per' : 'shared';
  const keys = key==='blWin' ? ['snipW', 'blOn'] : key==='N' ? ['smoothW'] : [key];
  S.paramMode[key] = mode;
  if (mode==='shared') keys.forEach(k=>{ S.shared[k] = cur[k]; });
  else for (let i = 0; i < n; i++){ if (!S.perParams[i]) S.perParams[i] = {}; keys.forEach(k=>{ S.perParams[i][k] = cur[k]; }); }
  if (mode==='shared'){ S.stepNote = S.stepNote.filter(m=> m !== key); delete S.heldPts[key]; if (key === 'blWin') delete S.heldPts.blOn; }
  return mode;
}
// A peak-search field changed (key) with the sample k on show: the peaks removed come back,
// every sample's under "all".
function clearRemoved(S, key, k){
  if (S.paramMode[key]==='shared') S.removedPeaks = S.removedPeaks.map(()=>[]);
  else S.removedPeaks[k] = [];
}
/* A peak's × on file idx (det: its detected 2θ). One added by hand is deleted for good:
   dropped from manualPeaks, so the removal is independent of the peak-search params (which
   reset removedPeaks); a detected one is removed (once). */
function dropPeak(S, idx, det, manual){
  if (manual){
    if (S.manualPeaks[idx]) S.manualPeaks[idx] = S.manualPeaks[idx].filter(v=>Math.abs(v-det) >= 1e-6);
  } else {
    if (!S.removedPeaks[idx]) S.removedPeaks[idx] = [];
    if (!S.removedPeaks[idx].some(v=>Math.abs(v-det)<1e-6)) S.removedPeaks[idx].push(det);
  }
}
/* The per-sample arrays, for the file list to keep aligned with the included files (key:
   the card's). A file left out keeps its entry as it was: one of a project to v510, in
   points, takes its widths at the file's step as it comes back, those v510 shared where the
   conversion turned the chip to one (heldPts). None: the standard's. */
const slotsOf = (S, key)=> S.std ? [] : [
  { key: key + ':params', arr:S.perParams, make: (v, f)=> v ? entryOf(objOf(v), f && f.x ? meanStep(f.x) : NaN, S.heldPts) : {...S.shared} },
  { key: key + ':manual', arr:S.manualPeaks, make: v=> v ? v.slice() : [] },
  { key: key + ':removed', arr:S.removedPeaks, make: v=> v ? v.slice() : [] },
];
// A file added: its entries, the shared settings and no peak by hand.
function addEntry(S){ S.perParams.push({...S.shared}); S.manualPeaks.push([]); S.removedPeaks.push([]); }
// The standard's file replaced or taken away (fs: its files now): its own peaks go with it.
function freshEntries(S, fs){
  S.perParams = fs.map(()=> ({...S.shared})); S.manualPeaks = fs.map(()=> []); S.removedPeaks = fs.map(()=> []);
  S.panel.sel = S.panel.hov = null;
}
// Every file gone.
function clearEntries(S){ S.processed=[]; S.perParams=[]; S.manualPeaks=[]; S.removedPeaks=[]; S.panel.sel=S.panel.hov=null; }
/* A state read (readState's t) taken: every setting, the peaks by hand, the chart's choice,
   the normalisation (norm, made valid by the card); nothing picked. */
function takeState(S, t, norm){
  Object.assign(S.shared, t.shared); Object.assign(S.paramMode, t.paramMode);
  ({ heldPts: S.heldPts, perParams: S.perParams, stepNote: S.stepNote, manualPeaks: S.manualPeaks, removedPeaks: S.removedPeaks, sizeBy: S.sizeBy } = t);
  S.norm = norm;
  S.panel.sel = S.panel.hov = null;
}
/* What the card shows beside its state (xrd.js shows): the peak picked in its table (panel:
   S's), given back as its tab wakes or the page is reloaded, the state restored (which
   picks none). */
const showsOf = panel => panel.sel != null ? { sel: panel.sel } : null;
function showNext(panel, v){ if (v && Number.isFinite(v.sel)) panel.sel = v.sel; }

export { nearestIdx, computeBaseline, findPeaks, computeFWHM, fwhmSigma, fwhmGeom, smoothingOf, processingOf,
  cagAt, fitCaglioti, instrModelOf, instrBetaOf, stdSpanOf, scherrerD, sizeCorr, belowInstr, sizeSummary, sampleSizes,
  sizeReflections, byPeakOk, reflectionRows, sizeSeries, boxTop, sizeTops, topOf,
  modeDef, FIELD_DEF, SHOWN, sharedDef, FIELD_MIN, LEGACY, modeOf, objOf, entryOf, fileParams, stateOf, readState,
  csvTables,
  fieldInputs, guardsOf, TOGGLES, SIZE_ONLY, PEAK_SEARCH, numIn, fieldIn, takeInputs, widthHint, presetOf, procKeys,
  PEAK_BASE, PEAK_HOVER, PEAK_SEL, FWHM_BASE, FWHM_HOVER, FWHM_SEL, anaOf, nearestOf, markStyles, toggled, nudge,
  stackShown, stackOf, sizeLab, barLayout, barYmax, sizeDlNames,
  switchMode, clearRemoved, dropPeak, slotsOf, addEntry, freshEntries, clearEntries, takeState, showsOf, showNext };
