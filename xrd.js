import { settings, fmtNum, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, linspace, interpLinear, movingAverage, meanArr, stdArr, maxArr, minArr, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, X_SVG } from './utils.js';
import { svgEl, Plot } from './plot.js';
import { nearestIdx, refineIdx, fitDoublet, reconstructFit, solveLinear } from './xrd-fit-core.js';

/* =========================================================
   XRD MODULE
========================================================= */
(function(){
  let files = []; // {name, label, x[], y[], color}
  let curIdx = 0;  // shared navigator index (analysis + peaks table)
  let processed = []; // per file: {smoothed, baseline, subtracted, peaks}
  let manualPeaks = []; // per file: array of manually added 2θ positions
  let removedPeaks = []; // per file: array of removed peaks' detected 2θ positions
  // Persistent last fit per file: {fits:[fp...], baseline:[...over native x], rwp}.
  // Survives smoothing/baseline/peak-search changes and navigation; only cleared by
  // deleting that file or running a new fit on it.
  let savedFits = [];
  // Peak marker colours
  const PEAK_BASE = '#3f9d54';   // darker green, base
  const PEAK_HOVER = '#5fcf6a';  // brighter green, transient hover
  const PEAK_SEL  = '#ffffff';   // white, permanent selection
  const FWHM_BASE  = '#b5292c';  // dark red, base (contrasts with the dark background)
  const FWHM_HOVER = '#ff5a5a';  // brighter red, transient hover
  const FWHM_SEL   = '#ff0000';  // pure red, permanent selection
  // Per-panel selection/hover state — the Analysis table talks only to the Analysis
  // plot, the Fitting table only to the Fitting plot.
  const panels = {
    a: { wrap:'xrdPeakTableWrap', box:'xrdPeakBox',    sel:null, hov:null, plot:()=>anaPlot },
    f: { wrap:'xrdFitTableWrap',  box:'xrdFitPeakBox', sel:null, hov:null, plot:()=>fitPlot },
  };
  let resPlot;
  let xrdUploadAlerts = '';

  // Per-field mode: 'shared' | 'per'. Defaults: peak-search fields per-sample, rest shared.
  const paramMode = { N:'shared', blWin:'shared', pkHeight:'per', pkProm:'per', pkDist:'per', K:'shared', lambda:'shared' };
  // Which mode key controls each stored field
  const FIELD_MODE = { N:'N', blWin:'blWin', pkHeight:'pkHeight', pkProm:'pkProm', pkDist:'pkDist', K:'K', lambda:'lambda' };

  // Shared param values (defaults)
  const shared = { N:10, blWin:150, pkHeight:5, pkProm:3, pkDist:0.3, K:0.9, lambda:1.540598 };

  // Persist only these XRD analysis defaults across sessions (per user's choice):
  // normalization, smoothing, SNIP baseline window, K and λ — NOT the peak-search fields.
  const XRD_STORE_KEY = 'datatreat-xrd-params';
  const XRD_PERSIST_FIELDS = ['N','blWin','K','lambda'];
  function saveXrdParams(){
    try {
      const data = { norm: document.getElementById('xrdNorm').value };
      XRD_PERSIST_FIELDS.forEach(k=>{ data[k] = shared[k]; });
      localStorage.setItem(XRD_STORE_KEY, JSON.stringify(data));
    } catch(e){}
  }
  function loadXrdParams(){
    let data = null;
    try { data = JSON.parse(localStorage.getItem(XRD_STORE_KEY) || 'null'); } catch(e){}
    if (!data) return;
    XRD_PERSIST_FIELDS.forEach(k=>{ if (typeof data[k]==='number' && isFinite(data[k])) shared[k] = data[k]; });
    const normSel = document.getElementById('xrdNorm');
    if (normSel && (data.norm==='global' || data.norm==='local')) normSel.value = data.norm;
    // Reflect the restored defaults in the (still empty) input fields
    XRD_PERSIST_FIELDS.forEach(k=>{ const el = document.getElementById(FIELD_INPUT[k]); if (el) el.value = shared[k]; });
  }

  // Per-sample param overrides (indexed by file idx)
  let perParams = []; // array of {N, blWin, pkHeight, pkProm, pkDist, K, lambda}

  // Crystallite-size / Scherrer constants and state
  const SCHERRER_K = 0.9;
  let standardName = '';    // file.name selected as instrumental standard ('' = none)

  window.dismissXrdUpload = function(){ xrdUploadAlerts=''; rebuildXrdAlerts(); };

  // Global-fit hyperparameters (editable in the modal)
  const fitHP = { profile:'pv', asym:false, asymMode:'split', SL:0.02, HL:0.02, calib:false, bgDegree:4, maxIter:80, tol:1e-12, lambda0:1e-3, bgAnchor:0.3 };
  // Dedicated hyperparameters for the instrumental-standard fit (FCJ + calibration always on)
  const stdHP = { profile:'voigt', asym:true, asymMode:'fcj', calib:true, SL:0.02, HL:0.02, bgDegree:4, maxIter:60, tol:1e-12, lambda0:1e-3, bgAnchor:0.3 };

  function rebuildXrdAlerts(){
    document.getElementById('xrdAlerts').innerHTML = xrdUploadAlerts;
  }

  function fileCallbacks(){
    return {
      onRemove(i){ files.splice(i,1); perParams.splice(i,1); processed.splice(i,1); manualPeaks.splice(i,1); removedPeaks.splice(i,1); savedFits.splice(i,1); afterFilesChange(); },
      onReorder(from, to){ [files,perParams,processed,manualPeaks,removedPeaks,savedFits].forEach(a=>{ const [x]=a.splice(from,1); a.splice(to,0,x); }); afterFilesChange(); },
      onLabelChange(i, v){ files[i].label=v; renderPeakTable(); updateXrdResults(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; updateXrdResults(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; processed=[]; perParams=[]; manualPeaks=[]; removedPeaks=[]; savedFits=[]; panels.a.sel=panels.a.hov=panels.f.sel=panels.f.hov=null; xrdUploadAlerts=''; rebuildXrdAlerts(); afterFilesChange(); },
    };
  }

  setupDropzone('xrdDropzone', 'xrdFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const alreadyLoaded = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
      // f.text() auto-detects encoding (incl. UTF-16 via BOM); rawBytes keeps the
      // original bytes for byte-exact re-download.
      const rawBytes = new Uint8Array(await f.arrayBuffer());
      const text = await f.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const positions = xml.getElementsByTagName('positions');
      let start=null, end=null;
      for (const pos of positions){
        if (pos.getAttribute('axis')==='2Theta'){
          start = parseFloat(pos.getElementsByTagName('startPosition')[0].textContent);
          end   = parseFloat(pos.getElementsByTagName('endPosition')[0].textContent);
          break;
        }
      }
      const intensNode = xml.getElementsByTagName('intensities')[0];
      if (!intensNode || start===null) continue;
      const y = intensNode.textContent.trim().split(/\s+/).map(Number);
      const ymin = minArr(y);
      const yCorr = y.map(v=>v-ymin);
      const x = linspace(start, end, y.length);
      // Keep each file on its own native 2θ axis — no resampling
      files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), x, y:yCorr, color:nextColor(files), rawBytes});
      perParams.push({...shared});
      manualPeaks.push([]);
      removedPeaks.push([]);
    }
    xrdUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissXrdUpload()') : '';
    rebuildXrdAlerts();
    afterFilesChange();
  });

  // Union of all files' 2θ ranges (for shared plot axes)
  function unionRange(){
    let lo = Infinity, hi = -Infinity;
    for (const f of files){ lo = Math.min(lo, f.x[0]); hi = Math.max(hi, f.x[f.x.length-1]); }
    return [isFinite(lo)?lo:0, isFinite(hi)?hi:1];
  }

  // Rebuild the instrumental-standard dropdown from the current file list
  function populateStandardSelect(){
    const sel = document.getElementById('xrdStandard');
    if (!sel) return;
    if (standardName && !files.some(f=>f.name===standardName)) standardName = '';
    sel.innerHTML = '<option value="">None</option>' +
      files.map(f=>`<option value="${f.name.replace(/"/g,'&quot;')}">${f.label}</option>`).join('');
    sel.value = standardName;
  }

  function afterFilesChange(){
    setTabLoaded('xrd', files.length);
    renderUnifiedFileList('xrdFileTableWrap', files, fileCallbacks());
    if (files.length){
      document.getElementById('xrdWorkspace').style.display='block';
      document.getElementById('xrdFitCard').style.display='block';
      document.getElementById('xrdResults').style.display='block';
      document.getElementById('xrdExportCard').style.display='block';
      if (curIdx >= files.length) curIdx = files.length-1;
      populateStandardSelect();
      reprocessAll();
      writeStoreToInputs();
      updateXrdAnalysis();
      updateXrdFitting();
      updateXrdResults();
    } else {
      ['xrdWorkspace','xrdFitCard','xrdResults','xrdExportCard'].forEach(id=>{ document.getElementById(id).style.display='none'; });
    }
    hist.commit(); // baseline + file add/remove/reorder/palette
  }

  /* ---- Undo/redo: snapshot the reversible analysis state. Raw patterns (x/y)
     are shared by reference; the per-file params, peaks, order, labels, colours,
     standard and fits are captured so any change can be stepped back. ---- */
  function xrdSnapshot(){
    return {
      files: files.map(f=>({...f})),
      perParams: perParams.map(p=>({...p})),
      manualPeaks: manualPeaks.map(a=>a.slice()),
      removedPeaks: removedPeaks.map(a=>a.slice()),
      savedFits: savedFits.map(sf=> sf ? {fits:sf.fits, baseline:sf.baseline, rwp:sf.rwp} : null),
      shared: {...shared},
      paramMode: {...paramMode},
      standardName, curIdx,
      norm: document.getElementById('xrdNorm').value,
    };
  }
  function xrdRestore(s){
    files = s.files.map(f=>({...f}));
    perParams = s.perParams.map(p=>({...p}));
    manualPeaks = s.manualPeaks.map(a=>a.slice());
    removedPeaks = s.removedPeaks.map(a=>a.slice());
    savedFits = s.savedFits.map(sf=> sf ? {fits:sf.fits, baseline:sf.baseline, rwp:sf.rwp} : null);
    Object.assign(shared, s.shared);
    Object.assign(paramMode, s.paramMode);
    standardName = s.standardName;
    curIdx = Math.min(s.curIdx, Math.max(0, files.length-1));
    document.getElementById('xrdNorm').value = s.norm;
    syncModeButtons();
    afterFilesChange();
  }
  function syncModeButtons(){
    Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{
      document.querySelectorAll('#'+tid+' button').forEach(btn=> btn.classList.toggle('active', btn.dataset.m === paramMode[key]));
    });
  }
  const hist = registerHistory('xrd', xrdSnapshot, xrdRestore);

  // Get params for a specific file index (respects per-field shared/per mode)
  function getFileParams(i){
    const pp = perParams[i] || {};
    const g = k => paramMode[k]==='shared' ? shared[k] : (pp[k] ?? shared[k]);
    return { N:g('N'), blWin:g('blWin'), pkHeight:g('pkHeight'), pkProm:g('pkProm'), pkDist:g('pkDist'), K:g('K'), lambda:g('lambda') };
  }

  // Read inputs into the appropriate store for curIdx
  // Parse a decimal field tolerant of comma separators; only fall back on a genuinely empty/invalid value
  function numField(id, def){
    const raw = String(document.getElementById(id).value).trim().replace(',', '.');
    if (raw === '') return def;
    const v = parseFloat(raw);
    return isNaN(v) ? def : v;
  }

  // input id ↔ stored field key
  const FIELD_INPUT = { N:'xrdSmooth', blWin:'xrdBlWin', pkHeight:'xrdPkHeight', pkProm:'xrdPkProm', pkDist:'xrdPkDist', K:'xrdK', lambda:'xrdLambda' };
  const FIELD_MIN   = { N:1, blWin:1, pkHeight:0, pkProm:0, pkDist:0, K:1e-6, lambda:1e-6 };
  const FIELD_DEF   = { N:10, blWin:150, pkHeight:5, pkProm:3, pkDist:0.3, K:0.9, lambda:1.540598 };

  function readInputsToStore(){
    for (const key in FIELD_INPUT){
      const v = Math.max(FIELD_MIN[key], numField(FIELD_INPUT[key], FIELD_DEF[key]));
      if (paramMode[key]==='shared') shared[key] = v;
      else { if (!perParams[curIdx]) perParams[curIdx] = {}; perParams[curIdx][key] = v; }
    }
  }

  // Push stored values for curIdx into the input fields
  function writeStoreToInputs(){
    const p = getFileParams(curIdx);
    for (const key in FIELD_INPUT) document.getElementById(FIELD_INPUT[key]).value = p[key];
  }

  // Restore persisted XRD analysis defaults (norm, smoothing, baseline, K, λ) at startup
  loadXrdParams();

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
      const lo = Math.max(0, Math.round(c.idx-minDistPts));
      const hi = Math.min(y.length-1, Math.round(c.idx+minDistPts));
      for (let j=lo; j<=hi; j++) used[j]=1;
    }
    out.sort((a,b)=>a.pos-b.pos);
    return out;
  }

  // Nearest data-grid index for a 2θ position on the given axis


  // Refine to the local maximum within ±win points

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

  /* ---------- True Kα1/Kα2 doublet deconvolution (pseudo-Voigt profile fit) ---------- */
  // pseudo-Voigt: η·Lorentzian + (1-η)·Gaussian, both with the same FWHM
  // Kα1/Kα2 separation Δ(2θ) in degrees at a given 2θ position
  // params = [A, x0, fwhm, eta, bg]; doublet = A·(pV(Kα1) + ½·pV(Kα2)) + bg
  // Solve A·z = b (square, small) by Gaussian elimination with partial pivot
  // One Levenberg–Marquardt run from a given start; returns {p, cost}
  // Fit the doublet over a local window with a multi-start over η; returns peak params

  /* ---------- Global whole-pattern fit: Σ Voigt doublets + polynomial background ---------- */
  // Humlíček w4 complex error function w(x+iy), y>=0  → returns [Re, Im]
  // Voigt shape (area·const absorbed into amplitude) value at xi; centre x0, Gaussian σ, Lorentzian γ
  // Voigt value + analytic derivatives wrt (x0, sigma, gamma) via w'(z) = -2z·w + 2i/√π
  // FWHM (°2θ) of a Voigt from σ,γ — Olivero & Longbothum approximation
  // pseudo-Voigt value + derivatives (used only by the local fallback fit)
  // Base symmetric shape value + derivatives, normalised to {val,dx0,d2,d3}
  // (d2 = ∂/∂(first width); d3 = ∂/∂(second param: γ for Voigt, η for pV))
  // FCJ-type axial-divergence kernel offsets (°2θ) + weights for a peak at pos.
  // ε drawn from the convolution of the sample (S/L) and slit (H/L) extents (trapezoid),
  // mapped to apparent angle by cos(2θ')=cos(2θ)/cos²ε (FCJ); folds direction around 90°.
  // One doublet-component value+grad at centre c, with optional asymmetry. asym={on,mode,SL,HL,nq}
  // returns {val, dc, d2, d3, da}
  // Value-only version (for reconstruction) using a stored fit object fp

  // Least-squares polynomial (powers of normalised u) fit of yv(x) — for background init
  // active: [{A0,x0,w0}]; fit raw y with Voigt/pseudo-Voigt doublets (optional asymmetry)
  // + poly background. params per peak = [A, x0, p2, p3] (+ a when split asymmetry).

  // Multi-start wrapper: tries several starting configs and returns the lowest-cost result.

  function reprocessOne(i){
    const p = getFileParams(i);
    const x = files[i].x;
    const yraw       = files[i].y;
    const smoothed   = movingAverage(yraw, p.N);                       // display + detection
    const snip       = computeBaseline(smoothed, p.blWin);             // SNIP baseline (estimate/fallback/standard)
    const detSub     = smoothed.map((v,j)=>Math.max(0, v-snip[j]));    // for peak search + classic FWHM
    // Peak detection on the smoothed, SNIP-subtracted profile (robust to noise)
    const peaks      = findPeaks(x, detSub, p.pkHeight, p.pkProm, p.pkDist);
    // Re-inject manually added peaks (survive param changes, cleared on reset)
    (manualPeaks[i]||[]).forEach(pos=>{
      const idx = nearestIdx(x, pos);
      peaks.push({pos, height:detSub[idx], prominence:peakProminence(detSub, idx), idx, manual:true});
    });
    peaks.sort((a,b)=>a.pos-b.pos);
    // detPos = detected position (stable identity, independent of fit on/off)
    peaks.forEach(pk=>{ pk.detPos = pk.pos; });
    // Apply persistent removals (matched by detected position, with a small tolerance)
    const rem = removedPeaks[i] || [];
    const remTol = Math.min(0.1, (p.pkDist || 0.3) * 0.45);
    peaks.forEach(pk=>{ pk.removed = rem.some(v=>Math.abs(v-pk.detPos) < remTol); });

    // Classic analysis only (SNIP baseline, half-maximum FWHM). The Voigt/pV global
    // fit is applied on top, on demand, by runFit() when the Fit button is pressed.
    peaks.forEach(pk=>{
      if (pk.removed){ pk.fit=null; pk.fwhm=NaN; pk.fwhmClassic=NaN; pk.fwhmFit=undefined; pk.fitPos=undefined; return; }
      pk.fit=null; pk.fwhmClassic=computeFWHM(x, detSub, pk.idx); pk.fwhmFit=undefined; pk.fwhm=pk.fwhmClassic; pk.fitPos=undefined;
    });
    const subtracted = detSub;
    const rawSub     = yraw.map((v,j)=>v-snip[j]);
    processed[i]     = {smoothed, baseline:snip, snip, subtracted, rawSub, peaks};
  }

  // Caglioti instrumental resolution: FWHM² = U·tan²θ + V·tanθ + W (θ = Bragg angle).
  // Least-squares fit [U,V,W] to the standard's measured peaks (needs ≥3 peaks).
  function fitCaglioti(pts){
    if (pts.length < 3) return null;
    const A=[[0,0,0],[0,0,0],[0,0,0]], b=[0,0,0];
    for (const p of pts){
      const t=Math.tan(p.th), x=[t*t, t, 1], y=p.b*p.b;
      for (let i=0;i<3;i++){ b[i]+=x[i]*y; for (let j=0;j<3;j++) A[i][j]+=x[i]*x[j]; }
    }
    const uvw = solveLinear(A, b);
    return (uvw && uvw.every(isFinite)) ? uvw : null;
  }
  // Instrumental FWHM (deg) at any 2θ from the selected standard, via the Caglioti
  // fit (evaluable at arbitrary angles, incl. between/beyond the standard's peaks).
  // Falls back to piecewise-linear interpolation when fewer than 3 standard peaks.
  function instrBeta(twoTheta){
    if (!standardName) return 0;
    const si = files.findIndex(f=>f.name===standardName);
    if (si < 0 || !processed[si]) return 0;
    const pts = processed[si].peaks
      .filter(p=>!p.removed && isFinite(p.fwhm))
      .map(p=>({x:p.pos, th:(p.pos/2)*Math.PI/180, b:p.fwhm}))
      .sort((a,b)=>a.x-b.x);
    if (!pts.length) return 0;
    const uvw = fitCaglioti(pts);
    if (uvw){
      const t = Math.tan((twoTheta/2)*Math.PI/180);
      return Math.sqrt(Math.max(0, uvw[0]*t*t + uvw[1]*t + uvw[2]));
    }
    // Fallback (<3 peaks): linear interpolation / clamp
    if (twoTheta <= pts[0].x) return pts[0].b;
    if (twoTheta >= pts[pts.length-1].x) return pts[pts.length-1].b;
    for (let k=0; k<pts.length-1; k++){
      if (twoTheta >= pts[k].x && twoTheta <= pts[k+1].x){
        const t = (twoTheta-pts[k].x)/(pts[k+1].x-pts[k].x);
        return pts[k].b + (pts[k+1].b-pts[k].b)*t;
      }
    }
    return pts[pts.length-1].b;
  }

  // Scherrer size (nm) from a FWHM (deg) at 2θ pos, with editable K and λ (Å)
  function scherrerD(betaDeg, pos, K, lam){
    if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
    const bRad = betaDeg * Math.PI/180, thRad = (pos/2) * Math.PI/180;
    return (K * lam / (bRad * Math.cos(thRad))) / 10; // nm (λ in Å → /10)
  }
  // Size WITHOUT instrumental correction (raw β)
  function sizeRaw(betaDeg, pos, K, lam){ return scherrerD(betaDeg, pos, K, lam); }
  // Size WITH instrumental correction: β² = β_obs² − β_instr²
  function sizeCorr(betaDeg, pos, K, lam){
    if (!isFinite(betaDeg) || betaDeg <= 0) return NaN;
    const bInstr = instrBeta(pos);
    return scherrerD(Math.sqrt(Math.max(0, betaDeg*betaDeg - bInstr*bInstr)), pos, K, lam);
  }

  function reprocessAll(){
    processed = [];
    for (let i=0; i<files.length; i++) reprocessOne(i);
  }

  let anaPlot = null;
  let fitPlot = null;   // fitting-tab main plot
  let residPlot = null; // short plot of fit − signal residual (in the fitting card)

  // Reconstruct the full doublet model and the Kα1-only component over an axis,
  // from a plain list of fit objects (fp).

  // ---- ANALYSIS plot: raw, smoothed, SNIP baseline, peaks (no fit) ----
  function updateXrdAnalysis(preserveView){
    if (!files.length || !processed.length) return;
    if (curIdx >= files.length) curIdx = files.length-1;
    document.getElementById('xrdCurrentLabel').textContent = files[curIdx].label;
    document.getElementById('xrdIdx').textContent = (curIdx+1)+'/'+files.length;

    const prev = (preserveView && anaPlot) ? {xmin:anaPlot.xmin, xmax:anaPlot.xmax, ymin:anaPlot.ymin, ymax:anaPlot.ymax} : null;
    const f  = files[curIdx];
    const pr = processed[curIdx];
    const mx = maxArr(pr.smoothed) || 1;

    const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
    const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
    const baseD  = interpLinear(f.x, pr.baseline, dense);

    const svgEl = document.getElementById('xrdSvg');
    const plot  = new Plot(svgEl, {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(svgEl.closest('.plot-wrap'));
    plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    plot.line(f.x, f.y.map(v=>v/mx),         '#6a7585', 1);
    plot.line(f.x, pr.smoothed.map(v=>v/mx), '#3aa0ff', 1.4);
    plot.line(dense, baseD.map(v=>v/mx),     '#ff9933', 1.2);
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
    plot._onView = ()=>{ refreshMarks(plot,'a'); applySelectionHighlight(); };
    refreshMarks(plot,'a');
    applySelectionHighlight();
  }

  // ---- FITTING plot: raw as open circles + peaks; with a saved fit → baseline,
  // Kα components and residual. Independent of the Analysis live view. ----
  function updateXrdFitting(preserveView){
    if (!files.length || !processed.length) return;
    if (curIdx >= files.length) curIdx = files.length-1;
    document.getElementById('xrdFitLabel').textContent = files[curIdx].label;
    document.getElementById('xrdFitIdx').textContent = (curIdx+1)+'/'+files.length;
    updateStdButtons();

    const prev = (preserveView && fitPlot) ? {xmin:fitPlot.xmin, xmax:fitPlot.xmax, ymin:fitPlot.ymin, ymax:fitPlot.ymax} : null;
    const f  = files[curIdx];
    const pr = processed[curIdx];
    const mx = maxArr(pr.smoothed) || 1;
    const sf = savedFits[curIdx];
    const doFit = !!(sf && sf.fits && sf.fits.length);

    const svgEl = document.getElementById('xrdFitSvg');
    const plot  = new Plot(svgEl, {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(svgEl.closest('.plot-wrap'));
    plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    // Raw data as unconnected open circles
    plot.points(f.x, f.y.map(v=>v/mx), '#6a7585', 1.7);
    if (doFit){
      const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
      const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
      const baseD  = interpLinear(f.x, sf.baseline, dense);
      const recD = reconstructFit(dense, sf.fits);
      plot.line(dense, baseD.map(v=>v/mx),                                 '#ff9933', 1.2);
      plot.line(dense, recD.full.map((v,j)=>(v+baseD[j])/mx),              '#ff5050', 1);
      plot.line(dense, recD.ka1.map((v,j)=>(v+baseD[j])/mx),               '#b07cff', 1.4);
      plot.line(dense, recD.full.map((v,j)=>(v-recD.ka1[j]+baseD[j])/mx),  '#5fb0d0', 1.1);
    }
    // Peak markers: fitted positions once a fit exists, otherwise the inherited
    // Analysis peak-search positions (initial state).
    const markPos = doFit ? sf.fits.map(fp=>fp.pos) : pr.peaks.filter(pk=>!pk.removed).map(pk=>pk.pos);
    const drawnPos = [];
    const peakMarks = [];
    for (const pos of markPos){
      if (drawnPos.some(v=>Math.abs(v-pos)<1e-9)) continue;
      drawnPos.push(pos);
      plot.vline(pos, PEAK_BASE, false);
      peakMarks.push({pos});
    }
    fitPlot = plot;
    plot._peakMarks = peakMarks;
    plot._fwhmMarks = [];
    plot._onView = ()=>{ if (residPlot){ residPlot.xmin=plot.xmin; residPlot.xmax=plot.xmax; residPlot._refresh(); } refreshMarks(plot,'f'); applySelectionHighlight(); };
    refreshMarks(plot,'f');
    applySelectionHighlight();

    ['xrdLegBl','xrdLegFit','xrdLegKa1','xrdLegKa2'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display=doFit?'':'none'; });
    const residBlock = document.getElementById('xrdResidBlock');
    if (residBlock) residBlock.style.display = doFit ? '' : 'none';
    if (!doFit){ residPlot = null; return; }

    const recX = reconstructFit(f.x, sf.fits);
    let rwpN=0, rwpD=0;
    for (let j=0;j<f.x.length;j++){
      const w = 1/Math.max(f.y[j], 1);
      const d = f.y[j] - (recX.full[j] + sf.baseline[j]);
      rwpN += w*d*d; rwpD += w*f.y[j]*f.y[j];
    }
    const rwp = rwpD>0 ? Math.sqrt(rwpN/rwpD)*100 : NaN;
    sf.rwp = rwp;
    const capEl = document.getElementById('xrdResidCaption');
    if (capEl) capEl.textContent = 'Fit residual (doublet fit − signal)' + (isFinite(rwp) ? ` — Rwp = ${rwp.toFixed(1)}%` : '');

    const resid = recX.full.map((v,j)=>(v - (f.y[j]-sf.baseline[j]))/mx);
    let rmax = 0; for (const v of resid) rmax = Math.max(rmax, Math.abs(v));
    rmax = rmax>0 ? rmax*1.1 : 1;
    const rp = new Plot(document.getElementById('xrdResidSvg'), {xlabel:'2θ (°)', ylabel:'', noYTickLabels:true, noInteraction:true, margin:{l:55,r:20,t:8,b:30}});
    rp.setRange(minArr(f.x), maxArr(f.x), -rmax, rmax);
    rp.xmin = plot.xmin; rp.xmax = plot.xmax;
    rp.drawAxes();
    rp.line([f.x[0], f.x[f.x.length-1]], [0,0], '#5b6472', 1);
    rp.line(f.x, resid, '#ff5050', 1);
    residPlot = rp;
  }

  // Enable the standard-fit buttons only when the current sample is the chosen standard
  function updateStdButtons(){
    const isStd = files.length && files[curIdx] && files[curIdx].name===standardName;
    ['xrdFitStdBtn','xrdStdSettings'].forEach(id=>{ const b=document.getElementById(id); if(b){ b.disabled=!isStd; b.style.opacity=isStd?'':'0.5'; b.style.cursor=isStd?'':'not-allowed'; } });
  }

  const nearestLine = (lines, pos)=>{ let best=null,bd=Infinity; if(pos!=null) for(const el of lines){ const d=Math.abs(el._value-pos); if(d<bd){bd=d;best=el;} } return bd<0.6?best:null; };

  // Recolour one panel's peak vlines AND their FWHM markers from its selection/hover.
  function highlightPanel(key){
    const P = panels[key], plot = P.plot(); if (!plot) return;
    const all = [...plot.gOverlay.querySelectorAll('line')];
    const peakLines = all.filter(el=>el._value!==undefined && !el._fwhm && !el._hit);
    const fwhmSegs  = all.filter(el=>el._fwhm && !el._hit);
    const selEl = nearestLine(peakLines, P.sel);
    const hovEl = nearestLine(peakLines, P.hov);
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
  // Refresh both plots' highlights (used after a full redraw)
  function applySelectionHighlight(){ highlightPanel('a'); highlightPanel('f'); }

  // Twin invisible thick "hit" line as a hover listener (à la Tauc draggable bars),
  // so peaks and FWHM markers have a fat, responsive target. Scheduled clear on leave
  // is cancelled by any enter within the same frame, avoiding flicker when the pointer
  // slides between a peak's vertical hit line and its horizontal FWHM hit line.
  let markHoverRAF = null;
  function addMarkHover(el, key, pos){
    el.addEventListener('pointerenter', ()=>{
      const plot = panels[key].plot();
      if (!plot || plot._mode) return;            // pan/zoom armed
      if (key==='a' && addMode) return;           // placing a manual peak
      if (markHoverRAF){ cancelAnimationFrame(markHoverRAF); markHoverRAF=null; }
      setHoverPanel(key, pos);
    });
    el.addEventListener('pointerleave', ()=>{
      if (markHoverRAF) cancelAnimationFrame(markHoverRAF);
      markHoverRAF = requestAnimationFrame(()=>{ markHoverRAF=null; setHoverPanel(key, null); });
    });
  }
  // (Re)build the interactive overlay marks for a plot: visible FWHM segments plus the
  // invisible thick hit lines for both peaks and FWHM markers. Called after every
  // axis redraw (via _onView) since gOverlay is cleared on each refresh.
  function buildInteractiveMarks(plot, key){
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
      addMarkHover(hit, key, mk.pos);
      g.appendChild(hit);
    });
    // Peak hit lines (invisible, full-height, vertical)
    const {h} = plot.size(); const m = plot.margin;
    (plot._peakMarks || []).forEach(mk=>{
      if (mk.pos < xlo || mk.pos > xhi) return;
      const px = plot.px(mk.pos);
      const hit = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'xrd-mark'});
      hit._hit = true;
      addMarkHover(hit, key, mk.pos);
      g.appendChild(hit);
    });
  }
  function refreshMarks(plot, key){ buildInteractiveMarks(plot, key); }

  // Toggle the transient 'hovering' class on the row nearest that panel's hover pos.
  function updateRowHoverPanel(key){
    const P = panels[key], wrap = document.getElementById(P.wrap); if (!wrap) return;
    const rows = [...wrap.querySelectorAll('.peak-row')];
    let best=null, bd=Infinity;
    if (P.hov!=null) for (const r of rows){ const d=Math.abs(parseFloat(r.dataset.pos)-P.hov); if(d<bd){bd=d;best=r;} }
    rows.forEach(r=>r.classList.toggle('hovering', r===best && bd<0.6));
  }

  // Transient hover for a panel (peak + associated row), distinct from selection.
  function setHoverPanel(key, pos){
    const P = panels[key];
    if (pos===P.hov) return;
    P.hov = pos;
    highlightPanel(key);
    updateRowHoverPanel(key);
  }
  // Permanent selection toggle for a panel.
  function selectPanel(key, pos){
    const P = panels[key];
    P.sel = (P.sel!=null && Math.abs(pos-P.sel)<1e-9) ? null : pos;
    renderPeakTable(); applySelectionHighlight();
  }

  // Stacked, baseline-subtracted overview. `curves[k]` holds each sample's raw
  // (un-offset) trace on its own x axis; null entries (e.g. no fit) are skipped.
  function drawStackedResults(svgId, legendId, curves){
    const norm = document.getElementById('xrdNorm').value;
    // The instrumental standard is excluded from the results entirely and from the
    // global/local normalization; only non-standard samples with a curve are shown.
    const shown = [];
    files.forEach((f,k)=>{ if (f.name!==standardName && curves[k]) shown.push(k); });
    const n = shown.length, baseOf = j => -j * 1.1;
    const gmax = Math.max(1, ...shown.map(k=>maxArr(curves[k])));
    const plot = new Plot(document.getElementById(svgId), {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = document.getElementById(legendId); legend.innerHTML='';
    let lo=Infinity, hi=-Infinity;
    shown.forEach(k=>{ lo=Math.min(lo, files[k].x[0]); hi=Math.max(hi, files[k].x[files[k].x.length-1]); });
    if (!isFinite(lo)){ [lo,hi]=unionRange(); }
    plot.setRange(lo, hi, baseOf(Math.max(0,n-1)), baseOf(0)+1.1);
    plot.drawAxes();
    shown.forEach((k, j)=>{
      const raw = curves[k];
      const mx = norm==='local' ? (maxArr(raw)||1) : gmax;
      const y = raw.map(v=> v/mx + baseOf(j) + 0.05);
      plot.line(files[k].x, y, files[k].color, 1.3);
      const s=document.createElement('span');
      s.innerHTML=`<i style="background:${files[k].color}"></i>${files[k].label}`;
      legend.appendChild(s);
    });
    return plot;
  }

  function updateXrdResults(){
    if (!files.length || !processed.length) return;
    // Analysis: smoothed − SNIP baseline
    resPlot = drawStackedResults('xrdResSvg', 'xrdResLegend', processed.map(pr=>pr.subtracted));
    // Fitting: reconstructed Kα doublet above the fit baseline (samples with a fit)
    const fitCurves = files.map((f,k)=>{
      const sf = savedFits[k];
      if (!sf || !sf.fits || !sf.fits.length) return null;
      return reconstructFit(f.x, sf.fits).full;
    });
    drawStackedResults('xrdResFitSvg', 'xrdResFitLegend', fitCurves);
    renderPeakTable();
  }

  function renderPeakTable(){ renderAnalysisTable(); renderFitTable(); renderXrdSizeTable(); }

  // Classic (peak-search) table: 2θ, rel intensity, prominence, classic FWHM, size.
  // With a standard selected, size is shown both without and with correction.
  function renderAnalysisTable(){
    if (!files.length || !processed.length) return;
    const isStd = files[curIdx].name === standardName;
    const fp = getFileParams(curIdx);
    const allPks = processed[curIdx] ? processed[curIdx].peaks : [];
    const wrap = document.getElementById('xrdPeakTableWrap');
    const resetBtn = document.getElementById('xrdPkReset');
    const hasManual = (manualPeaks[curIdx]||[]).length > 0;
    const hasRemoved = (removedPeaks[curIdx]||[]).length > 0;
    resetBtn.style.display = (hasRemoved || hasManual) ? '' : 'none';

    const pks = allPks.filter(p=>!p.removed);
    if (!pks.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No peaks found with current parameters.</p>'; return; }
    const maxH = Math.max(...pks.map(p=>p.height));
    const showCorr = !!standardName && !isStd;
    let html='<table><thead><tr><th>#</th><th>2θ (°)</th><th>Rel. intensity</th><th>FWHM (°)</th><th>Crystallite size (nm)</th>'+(showCorr?'<th>Crystallite size corr. (nm)</th>':'')+'<th></th></tr></thead><tbody>';
    pks.forEach((pk,i)=>{
      const fwhm = pk.fwhmClassic;
      const sizeRawCell = isStd ? '—' : fmtCell(sizeRaw(fwhm, pk.detPos, fp.K, fp.lambda));
      const corrCell = showCorr ? `<td>${fmtCell(sizeCorr(fwhm, pk.detPos, fp.K, fp.lambda))}</td>` : '';
      const sel = panels.a.sel!=null && Math.abs(pk.pos-panels.a.sel)<1e-9 ? ' selected' : '';
      html+=`<tr class="peak-row${pk.manual?' manual-peak':''}${sel}" data-pos="${pk.pos}" data-det="${pk.detPos}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${(pk.height/maxH*100).toFixed(1)}%</td><td>${isFinite(fwhm)?fwhm.toFixed(3):'—'}</td><td>${sizeRawCell}</td>${corrCell}<td style="text-align:right"><button class="peak-del" data-det="${pk.detPos}" data-manual="${pk.manual?1:0}" title="Remove peak">${X_SVG(13)}</button></td></tr>`;
    });
    html+='</tbody></table>';
    // Mean ± std crystallite size for this sample, shown right under the peak table
    const st = sampleSizeStats(curIdx);
    if (st.isStd){
      html += '<div class="size-summary">Standard sample — crystallite size not computed.</div>';
    } else {
      html += `<div class="size-summary">Mean crystallite size: <b>${fmtMeanStd(st.rawMean, st.rawStd, st.rawN)} nm</b>`;
      if (st.showCorr) html += `<br>Instr.-corrected: <b>${fmtMeanStd(st.corrMean, st.corrStd, st.corrN)} nm</b>`;
      html += '</div>';
    }
    wrap.innerHTML=html;

    wrap.querySelectorAll('.peak-row').forEach(row=>{
      const pos = parseFloat(row.dataset.pos);
      row.addEventListener('mouseenter', ()=> setHoverPanel('a', pos));
      row.addEventListener('mouseleave', ()=> setHoverPanel('a', null));
      row.addEventListener('click', e=>{
        if (e.target.closest('.peak-del')) return;
        selectPanel('a', pos);
      });
    });
    wrap.querySelectorAll('.peak-del').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const det = parseFloat(btn.dataset.det);
        if (btn.dataset.manual === '1'){
          // Manual peaks are deleted permanently: drop them from manualPeaks so the
          // removal is independent of the peak-search params (which reset removedPeaks).
          if (manualPeaks[curIdx]) manualPeaks[curIdx] = manualPeaks[curIdx].filter(v=>Math.abs(v-det) >= 1e-6);
        } else {
          if (!removedPeaks[curIdx]) removedPeaks[curIdx] = [];
          if (!removedPeaks[curIdx].some(v=>Math.abs(v-det)<1e-6)) removedPeaks[curIdx].push(det);
        }
        reprocessOne(curIdx); updateXrdAnalysis(true); updateXrdFitting(true); renderPeakTable();
        hist.commit();
      });
    });
  }

  // Fitted table (fitting card): everything derived from the last fit's peaks.
  function renderFitTable(){
    if (!files.length) return;
    const wrap = document.getElementById('xrdFitTableWrap');
    if (!wrap) return;
    const isStd = files[curIdx].name === standardName;
    const fp = getFileParams(curIdx);
    const sf = savedFits[curIdx];
    if (!sf || !sf.fits || !sf.fits.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No fit yet — press Fit sample.</p>'; return; }
    const f = files[curIdx];
    // Reconstruct the fitted model on the native axis to get heights/prominences
    const rec = reconstructFit(f.x, sf.fits);
    const fits = sf.fits.map(fpk=>{
      // Snap to the actual crest near the fitted position: nearestIdx often lands one
      // grid point off the true maximum, which makes the uphill neighbour exceed it and
      // yields a spurious prominence of 0.
      let idx = nearestIdx(f.x, fpk.pos);
      const win = Math.max(2, Math.round((fpk.fwhm||0.2) / ((f.x[f.x.length-1]-f.x[0])/(f.x.length-1)) ));
      for (let s=-win; s<=win; s++){ const j=idx+s; if (j>=0 && j<rec.full.length && rec.full[j] > rec.full[idx]) idx=j; }
      return { pos:fpk.pos, fwhm:fpk.fwhm, idx, height:rec.full[idx] };
    }).sort((a,b)=>a.pos-b.pos);
    const maxH = Math.max(...fits.map(p=>p.height)) || 1;
    const showCorr = !!standardName && !isStd;
    // Which fitted row is closest to the current selection (for highlight parity with analysis)
    let selIdx=-1, selBd=Infinity;
    if (panels.f.sel!=null) fits.forEach((pk,i)=>{ const d=Math.abs(pk.pos-panels.f.sel); if(d<selBd){selBd=d;selIdx=i;} });
    if (selBd>=0.6) selIdx=-1;
    let html='<table><thead><tr><th>#</th><th>2θ (°)</th><th>Rel. intensity</th><th>FWHM (°)</th><th>Crystallite size (nm)</th>'+(showCorr?'<th>Crystallite size corr. (nm)</th>':'')+'</tr></thead><tbody>';
    fits.forEach((pk,i)=>{
      const sizeRawCell = isStd ? '—' : fmtCell(sizeRaw(pk.fwhm, pk.pos, fp.K, fp.lambda));
      const corrCell = showCorr ? `<td>${fmtCell(sizeCorr(pk.fwhm, pk.pos, fp.K, fp.lambda))}</td>` : '';
      html+=`<tr class="peak-row${i===selIdx?' selected':''}" data-pos="${pk.pos}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${(pk.height/maxH*100).toFixed(1)}%</td><td>${isFinite(pk.fwhm)?pk.fwhm.toFixed(3):'—'}</td><td>${sizeRawCell}</td>${corrCell}</tr>`;
    });
    html+='</tbody></table>';
    if (isFinite(sf.rwp)) html+=`<p style="color:var(--muted);font-size:11px;margin:4px 0 0">Rwp = ${sf.rwp.toFixed(1)}%</p>`;
    wrap.innerHTML=html;
    // Same click-to-select mechanic as the analysis table (no delete here)
    wrap.querySelectorAll('.peak-row').forEach(row=>{
      const pos = parseFloat(row.dataset.pos);
      row.addEventListener('mouseenter', ()=> setHoverPanel('f', pos));
      row.addEventListener('mouseleave', ()=> setHoverPanel('f', null));
      row.addEventListener('click', ()=> selectPanel('f', pos));
    });
  }
  const fmtCell = v => isFinite(v) ? v.toFixed(1) : '—';

  // Mean / sample-std of the classic crystallite sizes across a sample's kept peaks.
  // Returns {rawN, rawMean, rawStd, corrN, corrMean, corrStd, isStd, showCorr}.
  function sampleSizeStats(i){
    const pr = processed[i];
    const isStd = files[i] && files[i].name === standardName;
    const showCorr = !!standardName && !isStd;
    const raw = [], corr = [];
    if (pr && !isStd){
      const fp = getFileParams(i);
      pr.peaks.filter(p=>!p.removed).forEach(pk=>{
        const s = sizeRaw(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda);
        if (isFinite(s)) raw.push(s);
        if (showCorr){ const sc = sizeCorr(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda); if (isFinite(sc)) corr.push(sc); }
      });
    }
    return {
      isStd, showCorr,
      rawN: raw.length,  rawMean: raw.length?meanArr(raw):NaN,  rawStd: raw.length>1?stdArr(raw):NaN,
      corrN: corr.length, corrMean: corr.length?meanArr(corr):NaN, corrStd: corr.length>1?stdArr(corr):NaN,
    };
  }
  // "mean ± std" (or just "mean" for n=1, "—" for none)
  function fmtMeanStd(mean, std, n){
    if (!isFinite(mean)) return '—';
    if (n >= 2 && isFinite(std)) return `${mean.toFixed(1)} ± ${std.toFixed(1)}`;
    return mean.toFixed(1);
  }

  // Results card: per-sample mean crystallite size (classic method), half-page width.
  function renderXrdSizeTable(){
    const wrap = document.getElementById('xrdSizeTableWrap');
    if (!wrap) return;
    if (!files.length || !processed.length){ wrap.innerHTML=''; return; }
    const anyStd = !!standardName;
    // Sample 70%, the size column(s) share the remaining 30%
    const cg = anyStd
      ? '<colgroup><col style="width:70%"><col style="width:15%"><col style="width:15%"></colgroup>'
      : '<colgroup><col style="width:70%"><col style="width:30%"></colgroup>';
    let html = '<table>'+cg+'<thead><tr><th>Sample</th><th>Crystallite size (nm)</th>' + (anyStd?'<th>Crystallite size corr. (nm)</th>':'') + '</tr></thead><tbody>';
    files.forEach((f,i)=>{
      if (f.name === standardName) return; // standard excluded from results
      const st = sampleSizeStats(i);
      const sizeCell = fmtMeanStd(st.rawMean, st.rawStd, st.rawN);
      const corrCell = anyStd ? `<td>${fmtMeanStd(st.corrMean, st.corrStd, st.corrN)}</td>` : '';
      html += `<tr><td class="fname" title="${f.label.replace(/"/g,'&quot;')}">${f.label}</td><td>${sizeCell}</td>${corrCell}</tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    // Match the table width to the analysis plot's svg (which is narrower than the
    // column by the plot's button gutter). Measure after layout so it stays exact.
    requestAnimationFrame(()=>{
      const svg = document.getElementById('xrdResSvg');
      if (svg && svg.clientWidth) wrap.style.width = svg.clientWidth + 'px';
    });
  }

  // Per-field shared/per-sample toggles (one segmented control per editable field)
  const TOGGLE_FIELD = { xrdModeN:'N', xrdModeBl:'blWin', xrdModeH:'pkHeight', xrdModeP:'pkProm', xrdModeD:'pkDist', xrdModeK:'K', xrdModeL:'lambda' };
  const SIZE_ONLY = new Set(['K','lambda']);
  Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{
    document.querySelectorAll('#'+tid+' button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (btn.classList.contains('active')) return; // no-op if already in this mode
        document.querySelectorAll('#'+tid+' button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        // The value currently displayed on the graph for this field
        const cur = getFileParams(curIdx)[key];
        paramMode[key] = btn.dataset.m;
        if (btn.dataset.m==='shared'){
          // Switching to "all": every sample takes the currently displayed value
          shared[key] = cur;
        } else {
          // Switching to "one": keep the displayed value on this sample only;
          // other samples' per-sample values are left untouched
          if(!perParams[curIdx]) perParams[curIdx]={};
          perParams[curIdx][key] = cur;
        }
        writeStoreToInputs();
        if (files.length){
          if (!SIZE_ONLY.has(key)){
            if (btn.dataset.m==='shared') reprocessAll(); else reprocessOne(curIdx);
            updateXrdAnalysis(true);
            updateXrdFitting(true);
          }
          updateXrdResults();
          renderPeakTable();
          hist.commit();
        }
      });
    });
  });

  // Param change listeners — store then reprocess
  ['xrdNorm'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{
      saveXrdParams();
      if (files.length){ updateXrdResults(); hist.commit(); }
    });
  });
  // Fit hyperparameters modal
  const numOr = (id, def)=>{ const v=parseFloat(String(document.getElementById(id).value).replace(',','.')); return isFinite(v)?v:def; };
  document.getElementById('xrdFitSettings').onclick = ()=>{ document.getElementById('xrdHpFromCurrent').checked = !!fitHP.fromCurrent; document.getElementById('xrdHpBgAnchor').value = fitHP.bgAnchor; document.getElementById('xrdFitModal').style.display='flex'; syncAsymUI(); };
  document.getElementById('xrdHpClose').onclick    = ()=>{ document.getElementById('xrdFitModal').style.display='none'; };
  // Standard fit settings modal
  document.getElementById('xrdStdSettings').onclick = ()=>{
    document.getElementById('xrdStdProfile').value = stdHP.profile;
    document.getElementById('xrdStdG').value = (0.5*(stdHP.SL+stdHP.HL)).toFixed(4);
    document.getElementById('xrdStdBgAnchor').value = stdHP.bgAnchor;
    document.getElementById('xrdStdFromCurrent').checked = !!stdHP.fromCurrent;
    document.getElementById('xrdStdModal').style.display='flex';
  };
  document.getElementById('xrdStdClose').onclick = ()=>{ document.getElementById('xrdStdModal').style.display='none'; };
  document.getElementById('xrdStdApply').onclick = ()=>{
    stdHP.profile  = document.getElementById('xrdStdProfile').value;
    stdHP.bgDegree = Math.max(0, Math.min(12, Math.round(numOr('xrdStdDeg',4))));
    stdHP.maxIter  = Math.max(5, Math.min(2000, Math.round(numOr('xrdStdIter',60))));
    stdHP.tol      = Math.max(1e-12, numOr('xrdStdTol',1e-12));
    stdHP.lambda0  = Math.max(1e-12, numOr('xrdStdLambda',1e-3));
    stdHP.bgAnchor = Math.max(0, numOr('xrdStdBgAnchor',0.3));
    stdHP.fromCurrent = document.getElementById('xrdStdFromCurrent').checked;
    document.getElementById('xrdStdModal').style.display='none';
  };
  document.getElementById('xrdFitModal').addEventListener('click', e=>{ if (e.target.id==='xrdFitModal') e.currentTarget.style.display='none'; });
  // Asymmetry model options are always visible; the checkbox just enables them,
  // and the FCJ geometry fields show only for the FCJ model
  const syncAsymUI = ()=>{
    const on = document.getElementById('xrdHpAsym').checked;
    document.getElementById('xrdHpAsymOpts').style.opacity = on ? '1' : '0.45';
    document.getElementById('xrdHpAsymMode').disabled = !on;
    document.getElementById('xrdHpFcj').style.display = (document.getElementById('xrdHpAsymMode').value==='fcj') ? '' : 'none';
  };
  document.getElementById('xrdHpAsym').addEventListener('change', syncAsymUI);
  document.getElementById('xrdHpAsymMode').addEventListener('change', syncAsymUI);
  document.getElementById('xrdHpApply').onclick = ()=>{
    fitHP.profile  = document.getElementById('xrdHpProfile').value;
    fitHP.asym     = document.getElementById('xrdHpAsym').checked;
    fitHP.asymMode = document.getElementById('xrdHpAsymMode').value;
    fitHP.SL       = Math.max(0, numOr('xrdHpSL',0.02));
    fitHP.HL       = Math.max(0, numOr('xrdHpHL',0.02));
    fitHP.calib    = false; // calibration is done via the dedicated standard fit
    fitHP.bgDegree = Math.max(0, Math.min(12, Math.round(numOr('xrdHpDeg',4))));
    fitHP.maxIter  = Math.max(5, Math.min(2000, Math.round(numOr('xrdHpIter',80))));
    fitHP.tol      = Math.max(1e-12, numOr('xrdHpTol',1e-12));
    fitHP.lambda0  = Math.max(1e-12, numOr('xrdHpLambda',1e-3));
    fitHP.bgAnchor = Math.max(0, numOr('xrdHpBgAnchor',0.3));
    fitHP.fromCurrent = document.getElementById('xrdHpFromCurrent').checked;
    document.getElementById('xrdFitModal').style.display='none';
    // Settings are only saved; the fit runs when the Fit button is pressed.
  };

  /* ---------- Fit button + progress bar ---------- */
  let fitBusy = false;
  let fitCancelled = false;   // set by the Cancel button; stops the fit loop
  let _fitCanceller = null;   // aborts the in-flight worker job (resolves it null)
  function showProg(frac){
    const w=document.getElementById('xrdFitProgWrap'), b=document.getElementById('xrdFitProgBar');
    if (w) w.style.display=''; if (b) b.style.width=Math.max(0,Math.min(1,frac))*100+'%';
  }
  function hideProg(){ const w=document.getElementById('xrdFitProgWrap'), b=document.getElementById('xrdFitProgBar'); if(w)w.style.display='none'; if(b)b.style.width='0%'; }

  // ---- Fit Web Worker: run the (heavy) multi-start Levenberg–Marquardt off the main
  // thread so the UI stays responsive; progress arrives as messages. Falls back to a
  // main-thread run if Workers are unavailable or the worker fails to load. ----
  let _fitWorker = null; // null=untried, Worker=live, undefined=unavailable
  function getFitWorker(){
    if (_fitWorker === undefined) return null;
    if (_fitWorker) return _fitWorker;
    try { _fitWorker = new Worker(new URL('./xrd-fit.worker.js', import.meta.url), { type:'module' }); }
    catch(e){ _fitWorker = undefined; return null; }
    return _fitWorker;
  }
  let _fitJobId = 0;
  function runFitInWorker(x, y, active, snip, hp, onProgress){
    const w = getFitWorker();
    if (!w) return import('./xrd-fit-core.js').then(m=>m.multiStartFit(x, y, active, snip, hp, onProgress));
    return new Promise(resolve=>{
      const id = ++_fitJobId;
      const cleanup = ()=>{ w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); _fitCanceller = null; };
      const onMsg = (e)=>{
        const d = e.data; if (!d || d.id !== id) return;
        if (d.type === 'progress'){ if (onProgress) onProgress(d.frac); return; }
        cleanup();
        resolve(d.type === 'result' ? d.res : null);
      };
      const onErr = ()=>{ cleanup(); _fitWorker = undefined; // worker died → fall back to main thread
        resolve(import('./xrd-fit-core.js').then(m=>m.multiStartFit(x, y, active, snip, hp, onProgress))); };
      // Cancel: terminate the worker (recreated next run) and resolve this job null
      _fitCanceller = ()=>{ cleanup(); try { w.terminate(); } catch(e){} _fitWorker = null; resolve(null); };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr, { once:true });
      w.postMessage({ id, x, y, active, snip, hp });
    });
  }

  // Fit one file index with the given hyperparameters; returns the calib G if any.
  async function fitOneFile(i, hp, onProgress){
    const x=files[i].x, y=files[i].y, pr=processed[i];
    if (!pr) return null;
    const sf = savedFits[i];
    let init, snipSeed;
    if (hp.fromCurrent && sf && sf.fits && sf.fits.length){
      // Continue from the last fit: seed peaks from the fitted positions/widths + its baseline
      init = sf.fits.map(fp=>({A0:Math.max(1e-6, fp.amp), x0:fp.pos, w0:(isFinite(fp.fwhm)&&fp.fwhm>0)?fp.fwhm:0.2}));
      snipSeed = sf.baseline;
    } else {
      // Default: restart from the SNIP baseline and the current peak search (manual kept)
      const active = pr.peaks.filter(pk=>!pk.removed);
      if (!active.length) return null;
      init = active.map(pk=>{ const g=computeFWHM(x, pr.subtracted, pk.idx); return {A0:Math.max(1e-6, pr.subtracted[pk.idx]||1), x0:pk.pos, w0:(isFinite(g)&&g>0)?g:0.2}; });
      snipSeed = pr.snip;
    }
    if (!init.length) return null;
    // The fit result lives only in savedFits — the Analysis pr stays SNIP-based & live.
    const res = await runFitInWorker(x, y, init, snipSeed, hp, onProgress);
    if (fitCancelled) return null; // aborted mid-flight → keep the previous fit
    if (res){
      saveFit(i, res.fits, res.baseline);
      return res.calib || null;
    }
    // fallback: per-peak local pseudo-Voigt fit on the SNIP-subtracted raw
    const rawSubSnip=y.map((v,j)=>v-snipSeed[j]);
    const fbFits=[];
    init.forEach(pk=>{ const idx=nearestIdx(x, pk.x0); const fit=fitDoublet(x, rawSubSnip, idx, pk.w0); if(fit) fbFits.push(fit); });
    if (fbFits.length) saveFit(i, fbFits, snipSeed);
    return null;
  }

  // Persist the last fit for a file (deep copy so later param changes can't mutate it)
  function saveFit(i, fits, baseline){
    savedFits[i] = { fits: fits.map(fp=>Object.assign({}, fp)), baseline: Array.from(baseline) };
  }

  // Generic driver: fit a list of file indices with hp, manage button/progress UI.
  async function runFit(indices, hp, btnId, busyLabel){
    if (fitBusy || !files.length || !indices.length) return;
    fitBusy = true;
    fitCancelled = false;
    const btn=document.getElementById(btnId); const lbl=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent=busyLabel||'Fitting…'; }
    const cancelBtn=document.getElementById('xrdFitCancelBtn');
    if(cancelBtn) cancelBtn.style.display='';
    showProg(0);
    try {
      const n=indices.length;
      for (let s=0; s<n; s++){
        if (fitCancelled) break;
        const calib = await fitOneFile(indices[s], hp, frac=>showProg((s+frac)/n));
        if (fitCancelled) break;
        // propagate a calibrated geometry to the sample hyperparameters + both modals
        if (calib){
          fitHP.SL=calib.SL; fitHP.HL=calib.HL; stdHP.SL=calib.SL; stdHP.HL=calib.HL;
          ['xrdHpSL','xrdStdG'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=calib.SL.toFixed(4); });
          const hl=document.getElementById('xrdHpHL'); if(hl) hl.value=calib.HL.toFixed(4);
        }
        showProg((s+1)/n);
      }
      showProg(1);
    } finally {
      setTimeout(hideProg, 250);
      if(btn){ btn.disabled=false; btn.textContent=lbl; }
      if(cancelBtn) cancelBtn.style.display='none';
      fitBusy=false; fitCancelled=false; _fitCanceller=null;
      updateXrdFitting(true); updateXrdResults(); renderPeakTable();
      hist.commit(); // a completed (or cancelled) fit is an undoable step
    }
  }
  document.getElementById('xrdFitCancelBtn').onclick = ()=>{
    if (!fitBusy) return;
    fitCancelled = true;
    if (_fitCanceller) _fitCanceller(); // abort the in-flight worker job now
    hideProg();
  };
  const standardIdx = ()=> files.findIndex(f=>f.name===standardName);
  document.getElementById('xrdFitSampleBtn').onclick = ()=> runFit([curIdx], fitHP, 'xrdFitSampleBtn', 'Fitting…');
  document.getElementById('xrdFitAllBtn').onclick    = ()=> runFit(files.map((_,i)=>i), fitHP, 'xrdFitAllBtn', 'Fitting…');
  document.getElementById('xrdFitStdBtn').onclick    = ()=>{
    const si=standardIdx();
    if (si<0){ alert('Select an instrumental standard first (Instrumental standard dropdown).'); return; }
    runFit([si], stdHP, 'xrdFitStdBtn', 'Calibrating…');
  };
  // Instrumental standard changes size columns + enables the standard-fit buttons
  document.getElementById('xrdStandard').addEventListener('change', e=>{
    standardName = e.target.value;
    if (files.length){ updateStdButtons(); renderPeakTable(); hist.commit(); }
  });
  ['xrdSmooth','xrdBlWin','xrdPkHeight','xrdPkProm','xrdPkDist','xrdK','xrdLambda'].forEach(id=>{
    const el = document.getElementById(id);
    const isSizeOnly = (id==='xrdK' || id==='xrdLambda'); // K/λ don't affect processing
    const isPeakSearch = (id==='xrdPkHeight' || id==='xrdPkProm' || id==='xrdPkDist');
    const key = { xrdSmooth:'N', xrdBlWin:'blWin', xrdPkHeight:'pkHeight', xrdPkProm:'pkProm', xrdPkDist:'pkDist', xrdK:'K', xrdLambda:'lambda' }[id];
    const apply = ()=>{
      if (!files.length) return;
      readInputsToStore();
      saveXrdParams(); // persist the whitelisted analysis defaults (norm/N/blWin/K/λ)
      writeStoreToInputs();
      if (isSizeOnly){ renderPeakTable(); hist.commit(); return; } // only the Scherrer size changes
      // Peak deletions reset only when this peak-search field changes
      if (isPeakSearch){
        if (paramMode[key]==='shared') removedPeaks = removedPeaks.map(()=>[]);
        else removedPeaks[curIdx] = [];
      }
      if (paramMode[key]==='shared') reprocessAll(); else reprocessOne(curIdx);
      updateXrdAnalysis(true);      // analysis is live
      updateXrdFitting(true);       // refresh inherited peaks / initial state (keeps last fit)
      updateXrdResults();
      hist.commit();
    };
    el.addEventListener('change', apply);
    el.addEventListener('keydown', e=>{ if (e.key==='Enter') el.blur(); });
  });

  // Run fn while keeping the card the user is currently looking at fixed in the
  // viewport: if a redraw (e.g. a table with a different row count) shifts the
  // layout, compensate the scroll so the viewed content stays put.
  function withScrollAnchor(fn){
    const vh = window.innerHeight, cy = vh/2;
    const cards = ['xrdWorkspace','xrdFitCard','xrdResults'].map(id=>document.getElementById(id)).filter(el=>el && el.offsetParent!==null);
    let anchor = cards.find(c=>{ const r=c.getBoundingClientRect(); return r.top<=cy && r.bottom>=cy; })
              || cards.find(c=>{ const r=c.getBoundingClientRect(); return r.bottom>0 && r.top<vh; });
    const before = anchor ? anchor.getBoundingClientRect().top : null;
    fn();
    if (anchor && before!=null){ const d = anchor.getBoundingClientRect().top - before; if (Math.abs(d)>0.5) window.scrollBy(0, d); }
  }

  function navigate(delta){
    if (!files.length) return;
    setAddMode(false);
    panels.a.sel=panels.a.hov=panels.f.sel=panels.f.hov=null;
    curIdx = (curIdx + delta + files.length) % files.length;
    writeStoreToInputs();
    withScrollAnchor(()=>{ updateXrdAnalysis(); updateXrdFitting(); renderPeakTable(); });
  }

  document.getElementById('xrdPrev').onclick = ()=> navigate(-1);
  document.getElementById('xrdNext').onclick = ()=> navigate(1);
  document.getElementById('xrdFitPrev').onclick = ()=> navigate(-1);
  document.getElementById('xrdFitNext').onclick = ()=> navigate(1);

  // Reset peaks: drop manual + removed peaks and re-run the search for the current file
  document.getElementById('xrdPkReset').onclick = ()=>{
    if (!files.length) return;
    manualPeaks[curIdx] = [];
    removedPeaks[curIdx] = [];
    reprocessOne(curIdx);
    updateXrdAnalysis(true);
    updateXrdFitting(true);
    renderPeakTable();
    hist.commit();
  };

  /* ---------- Add-peak mode ---------- */
  let addMode = false;
  let addIdx = null; // current data-grid index of the guide
  const addBtn  = document.getElementById('xrdAddPeak');
  const xrdSvgEl = document.getElementById('xrdSvg');

  function clearAddGuide(){ xrdSvgEl.querySelectorAll('.add-guide').forEach(e=>e.remove()); }

  // Range of grid indices currently visible in the analysis plot
  function visibleIdxRange(){
    const x = files[curIdx].x;
    const a = nearestIdx(x, anaPlot.xmin), b = nearestIdx(x, anaPlot.xmax);
    return [Math.min(a,b), Math.max(a,b)];
  }

  // Draw the guide line/marker/label at the current addIdx
  function drawAddGuide(){
    clearAddGuide();
    if (!addMode || !anaPlot || !processed[curIdx] || addIdx==null) return;
    const m = anaPlot.margin; const {w,h} = anaPlot.size();
    const pr = processed[curIdx];
    const mxv = maxArr(pr.smoothed) || 1;
    const xv = files[curIdx].x[addIdx];
    const yval = pr.smoothed[addIdx] / mxv;     // value of the (blue) smoothed curve
    const px = anaPlot.px(xv), py = anaPlot.py(yval);
    anaPlot.svg.appendChild(svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'#ffd24a','stroke-width':1.5,'stroke-dasharray':'4,3','pointer-events':'none','class':'add-guide'}));
    anaPlot.svg.appendChild(svgEl('circle',{cx:px,cy:py,r:3.5,fill:'#ffd24a','pointer-events':'none','class':'add-guide'}));
    const flip = px > w - m.r - 110;
    const t = svgEl('text',{x:px+(flip?-8:8),y:m.t+14,'font-size':11,fill:'#ffd24a','text-anchor':flip?'end':'start','pointer-events':'none','class':'add-guide'});
    t.textContent = `2θ=${xv.toFixed(3)}, y=${yval.toFixed(3)}`;
    anaPlot.svg.appendChild(t);
  }

  function setAddMode(on){
    addMode = !!on;
    addBtn.classList.toggle('active', addMode);
    xrdSvgEl.style.cursor = addMode ? 'crosshair' : '';
    if (addMode && anaPlot) anaPlot.setMode(null); // disable pan/zoom while placing
    if (!addMode){ addIdx = null; clearAddGuide(); }
  }

  function confirmAdd(){
    if (addIdx==null) return;
    if (!manualPeaks[curIdx]) manualPeaks[curIdx] = [];
    manualPeaks[curIdx].push(files[curIdx].x[addIdx]);
    setAddMode(false);
    reprocessOne(curIdx);
    updateXrdAnalysis(true);
    updateXrdFitting(true);
    renderPeakTable();
    hist.commit();
  }

  addBtn.onclick = ()=>{ if (files.length) setAddMode(!addMode); };

  xrdSvgEl.addEventListener('pointermove', e=>{
    if (!addMode || !anaPlot || !processed[curIdx]) return;
    const rect = anaPlot.svg.getBoundingClientRect();
    let xv = anaPlot.invX(e.clientX - rect.left);
    xv = Math.max(anaPlot.xmin, Math.min(anaPlot.xmax, xv));
    addIdx = nearestIdx(files[curIdx].x, xv);
    drawAddGuide();
  });

  xrdSvgEl.addEventListener('pointerleave', ()=>{ if (addMode) clearAddGuide(); });

  xrdSvgEl.addEventListener('pointerdown', e=>{
    if (!addMode || !anaPlot || e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    const rect = anaPlot.svg.getBoundingClientRect();
    let xv = anaPlot.invX(e.clientX - rect.left);
    xv = Math.max(anaPlot.xmin, Math.min(anaPlot.xmax, xv));
    addIdx = nearestIdx(files[curIdx].x, xv);
    confirmAdd();
  }, true); // capture: run before the Plot's own pointerdown handler

  document.addEventListener('keydown', e=>{
    if (!addMode) return;
    if (e.key==='Escape'){ setAddMode(false); return; }
    if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
      e.preventDefault();
      const [lo,hi] = visibleIdxRange();
      if (addIdx==null) addIdx = nearestIdx((anaPlot.xmin+anaPlot.xmax)/2);
      addIdx = Math.max(lo, Math.min(hi, addIdx + (e.key==='ArrowRight'?1:-1)));
      drawAddGuide();
    } else if (e.key==='Enter'){
      e.preventDefault();
      confirmAdd();
    }
  });

  // Plot-side peak hover + click-to-select (mirror of the table interaction).
  // Bound once per SVG; acts only when no pan/zoom tool is armed and not adding a peak.
  // Peak/FWHM hover is handled by per-mark invisible hit lines (see buildInteractiveMarks);
  // here we only bind click-to-(de)select, which reads the current hover position.
  function attachPeakInteractions(svgEl, key){
    const isAnalysis = key==='a';
    const blocked = (plot)=> !plot || plot._mode || (isAnalysis && addMode);
    svgEl.addEventListener('click', ()=>{
      const plot = svgEl._plot; if (blocked(plot)) return;
      if (panels[key].hov!=null) selectPanel(key, panels[key].hov); // clicked a peak/FWHM → (de)select it
      else clearSelection(key);                                     // clicked empty area → deselect
    });
  }
  // Deselect when clicking anywhere in the table's dark container box that isn't a peak row
  function attachTableDeselect(key){
    const box = document.getElementById(panels[key].box);
    if (box) box.addEventListener('click', e=>{ if (!e.target.closest('.peak-row')) clearSelection(key); });
  }
  function clearSelection(key){ if (panels[key].sel!=null){ panels[key].sel=null; renderPeakTable(); applySelectionHighlight(); } }
  attachPeakInteractions(xrdSvgEl, 'a');
  attachPeakInteractions(document.getElementById('xrdFitSvg'), 'f');
  attachTableDeselect('a');
  attachTableDeselect('f');

  window._xrdRedraw = ()=>{ if (files.length){ updateXrdAnalysis(true); updateXrdFitting(true); updateXrdResults(); renderPeakTable(); } };
  registerTabRedraw('xrd', window._xrdRedraw);

  function exportXrdZip(){
    if (!files.length) return;
    const norm = document.getElementById('xrdNorm').value;
    // Main diffraction data CSV (baseline-subtracted, normalised). The standard is
    // excluded here — it has its own dedicated CSV — and never participates in the
    // global/local normalization: non-standard samples share the global max.
    const cols = files.map((f,k)=>({f,k})).filter(o=>o.f.name!==standardName);
    const gmax = Math.max(1, ...cols.map(o=>maxArr(processed[o.k].subtracted)));
    const Ycol = cols.map(o=>{
      const y = processed[o.k].subtracted;
      const mx = norm==='local' ? (maxArr(y)||1) : gmax;
      return y.map(v=>v/mx);
    });
    // Each sample keeps its own 2θ axis → one (2Theta, intensity) column pair per sample
    const header=[]; cols.forEach(o=>header.push('2Theta_'+o.f.label, o.f.label));
    let t=csvLine(header);
    const maxLen = cols.length ? Math.max(...cols.map(o=>o.f.x.length)) : 0;
    for (let i=0;i<maxLen;i++){
      const row=[];
      cols.forEach((o,c)=>{
        if (i<o.f.x.length) row.push(fmtNum(o.f.x[i],6), fmtNum(Ycol[c][i],6));
        else row.push('','');
      });
      t+=csvLine(row);
    }
    const entries = [];              // {name, text} collected into a single zip
    entries.push({name:'diffractograms.csv', text:t});
    // Crystallite size (classic) — per-sample summary (mean ± std, matching the table)
    {
      const anyStd = !!standardName;
      const head = ['Sample','Crystallite_size_nm','Crystallite_size_std_nm'].concat(anyStd ? ['Crystallite_size_corr_nm','Crystallite_size_corr_std_nm'] : []);
      let ct = csvLine(head);
      files.forEach((f,k)=>{
        const st = sampleSizeStats(k);
        const row = [
          f.label,
          st.isStd ? 'standard' : (isFinite(st.rawMean) ? fmtNum(st.rawMean,2) : ''),
          (!st.isStd && st.rawN>1 && isFinite(st.rawStd)) ? fmtNum(st.rawStd,2) : '',
        ];
        if (anyStd) row.push(
          st.isStd ? '' : (isFinite(st.corrMean) ? fmtNum(st.corrMean,2) : ''),
          (!st.isStd && st.corrN>1 && isFinite(st.corrStd)) ? fmtNum(st.corrStd,2) : ''
        );
        ct += csvLine(row);
      });
      entries.push({name:'crystallite_size.csv', text:ct});
    }
    // Dedicated standard CSV: its peaks and measured FWHM (instrumental profile).
    // Crystallite size is meaningless for the standard, so only the FWHM is listed.
    if (standardName){
      const si = files.findIndex(f=>f.name===standardName);
      const pr = si>=0 ? processed[si] : null;
      if (pr){
        const pks = pr.peaks.filter(pk=>!pk.removed);
        const maxH=Math.max(...pks.map(pk=>pk.height))||1;
        let st=csvLine(['2Theta','RelIntensity','FWHM_deg']);
        pks.forEach(pk=>{
          st+=csvLine([fmtNum(pk.pos,6), fmtNum(pk.height/maxH,6),
                       isFinite(pk.fwhmClassic)?fmtNum(pk.fwhmClassic,5):'']);
        });
        entries.push({name:'standard_'+files[si].label+'.csv', text:st});
      }
    }
    // peaks.csv — each sample's kept peaks as its own independent columns
    // (standard excluded, it has its dedicated CSV)
    {
      const cols=[];
      processed.forEach((pr,k)=>{
        if (files[k].name === standardName) return;
        const pks = pr.peaks.filter(pk=>!pk.removed);
        if (!pks.length) return;
        const kp = getFileParams(k), lbl = files[k].label;
        const maxH=Math.max(...pks.map(pk=>pk.height))||1;
        cols.push({h:'2Theta_'+lbl,        v:pks.map(pk=>fmtNum(pk.pos,6))});
        cols.push({h:'RelIntensity_'+lbl,  v:pks.map(pk=>fmtNum(pk.height/maxH,6))});
        cols.push({h:'FWHM_deg_'+lbl,      v:pks.map(pk=>isFinite(pk.fwhmClassic)?fmtNum(pk.fwhmClassic,5):'')});
        cols.push({h:'Size_nm_'+lbl,       v:pks.map(pk=>{const d=sizeRaw(pk.fwhmClassic,pk.detPos,kp.K,kp.lambda);return isFinite(d)?fmtNum(d,3):'';})});
        cols.push({h:'Size_corr_nm_'+lbl,  v:pks.map(pk=>{const d=sizeCorr(pk.fwhmClassic,pk.detPos,kp.K,kp.lambda);return isFinite(d)?fmtNum(d,3):'';})});
      });
      if (cols.length){
        const maxLen=Math.max(0,...cols.map(c=>c.v.length));
        let pt=csvLine(cols.map(c=>c.h));
        for (let i=0;i<maxLen;i++) pt+=csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
        entries.push({name:'peaks.csv', text:pt});
      }
    }
    // fits.csv — each sample's last fit as its own independent columns (own 2θ axis)
    {
      const cols=[];
      files.forEach((f,k)=>{
        const sf = savedFits[k];
        if (!sf || !sf.fits || !sf.fits.length) return;
        const rec = reconstructFit(f.x, sf.fits); // {full, ka1} in raw intensity units
        const lbl=f.label;
        cols.push({h:'2Theta_'+lbl,     v:f.x.map(x=>fmtNum(x,6))});
        cols.push({h:'Observed_'+lbl,   v:f.y.map(x=>fmtNum(x,6))});
        cols.push({h:'Fit_total_'+lbl,  v:f.x.map((_,j)=>fmtNum((sf.baseline[j]||0)+rec.full[j],6))});
        cols.push({h:'Background_'+lbl,  v:f.x.map((_,j)=>fmtNum(sf.baseline[j]||0,6))});
        cols.push({h:'Ka1_'+lbl,        v:f.x.map((_,j)=>fmtNum(rec.ka1[j],6))});
        cols.push({h:'Ka2_'+lbl,        v:f.x.map((_,j)=>fmtNum(rec.full[j]-rec.ka1[j],6))});
      });
      if (cols.length){
        const maxLen=Math.max(0,...cols.map(c=>c.v.length));
        let ft=csvLine(cols.map(c=>c.h));
        for (let i=0;i<maxLen;i++) ft+=csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
        entries.push({name:'fits.csv', text:ft});
      }
    }
    // Bundle every CSV into a single downloadable zip
    downloadZip('xrd_export.zip', entries);
  }
  registerCsvExport('xrd', exportXrdZip);
})();

