import { settings, fmtNum, csvLine, downloadBlob, makeDownloadLink, setupDropzone, renderUnifiedFileList, linspace, interpLinear, movingAverage, meanArr, stdArr, maxArr, minArr, buildAlertsHtml, nextColor } from './utils.js';
import { svgEl, Plot } from './plot.js';

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
  const CU_KA1 = 1.540598; // Å
  const CU_KA2 = 1.544426; // Å
  const KA2_RATIO = 0.5;   // Iα2 / Iα1
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
      onMoveUp(i){ if(i>0){[files[i-1],files[i]]=[files[i],files[i-1]]; [perParams[i-1],perParams[i]]=[perParams[i],perParams[i-1]]; [processed[i-1],processed[i]]=[processed[i],processed[i-1]]; [manualPeaks[i-1],manualPeaks[i]]=[manualPeaks[i],manualPeaks[i-1]]; [removedPeaks[i-1],removedPeaks[i]]=[removedPeaks[i],removedPeaks[i-1]]; [savedFits[i-1],savedFits[i]]=[savedFits[i],savedFits[i-1]]; afterFilesChange();} },
      onMoveDown(i){ if(i<files.length-1){[files[i],files[i+1]]=[files[i+1],files[i]]; [perParams[i],perParams[i+1]]=[perParams[i+1],perParams[i]]; [processed[i],processed[i+1]]=[processed[i+1],processed[i]]; [manualPeaks[i],manualPeaks[i+1]]=[manualPeaks[i+1],manualPeaks[i]]; [removedPeaks[i],removedPeaks[i+1]]=[removedPeaks[i+1],removedPeaks[i]]; [savedFits[i],savedFits[i+1]]=[savedFits[i+1],savedFits[i]]; afterFilesChange();} },
      onLabelChange(i, v){ files[i].label=v; renderPeakTable(); updateXrdResults(); },
      onColorChange(i, v){ files[i].color=v; updateXrdResults(); },
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
      files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), x, y:yCorr, color:nextColor(files)});
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
  }

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
  function nearestIdx(x, pos){
    if (!x || !x.length) return 0;
    const span = (x[x.length-1]-x[0]) || 1;
    const t = (pos-x[0])/span*(x.length-1);
    return Math.max(0, Math.min(x.length-1, Math.round(t)));
  }


  // Refine to the local maximum within ±win points
  function refineIdx(y, idx, win){
    let best = idx;
    const lo = Math.max(0, idx-win), hi = Math.min(y.length-1, idx+win);
    for (let j=lo; j<=hi; j++) if (y[j] > y[best]) best = j;
    return best;
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
  function pseudoVoigt(xi, x0, fwhm, eta){
    const t = (xi-x0)*(xi-x0) / (fwhm*fwhm);
    const g = Math.exp(-4*Math.LN2*t);
    const l = 1 / (1 + 4*t);
    return eta*l + (1-eta)*g;
  }
  // Kα1/Kα2 separation Δ(2θ) in degrees at a given 2θ position
  function ka2Delta(twoTheta){
    const th = (twoTheta/2)*Math.PI/180;
    return 2*((CU_KA2-CU_KA1)/CU_KA1)*Math.tan(th)*180/Math.PI;
  }
  // params = [A, x0, fwhm, eta, bg]; doublet = A·(pV(Kα1) + ½·pV(Kα2)) + bg
  function doubletModel(par, xi){
    const A=par[0], x0=par[1], fw=par[2], eta=par[3], bg=par[4]||0, d=ka2Delta(x0);
    return A*(pseudoVoigt(xi,x0,fw,eta) + KA2_RATIO*pseudoVoigt(xi,x0+d,fw,eta)) + bg;
  }
  // Solve A·z = b (square, small) by Gaussian elimination with partial pivot
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
  // One Levenberg–Marquardt run from a given start; returns {p, cost}
  function lmRun(xs, ys, p0, step){
    let p=p0.slice();
    const resid = pp => xs.map((xi,k)=>doubletModel(pp,xi)-ys[k]);
    const cost  = r => r.reduce((s,v)=>s+v*v,0);
    let r=resid(p), c=cost(r), lambda=1e-3;
    for (let iter=0; iter<120; iter++){
      const m=p.length, pert=p.map(v=>Math.max(1e-6,Math.abs(v))*1e-4);
      const Jc=[];
      for (let j=0;j<m;j++){ const pp=p.slice(); pp[j]+=pert[j]; const rj=resid(pp); Jc.push(rj.map((v,k)=>(v-r[k])/pert[j])); }
      const JtJ=Array.from({length:m},()=>new Array(m).fill(0)), Jtr=new Array(m).fill(0);
      for (let a=0;a<m;a++){
        for (let b=0;b<m;b++){ let s=0; for (let k=0;k<r.length;k++) s+=Jc[a][k]*Jc[b][k]; JtJ[a][b]=s; }
        let s2=0; for (let k=0;k<r.length;k++) s2+=Jc[a][k]*r[k]; Jtr[a]=s2;
      }
      let stepTaken=false;
      for (let tries=0; tries<8; tries++){
        const Ad=JtJ.map((row,a)=>row.map((v,b)=> a===b ? v*(1+lambda) : v));
        const dp=solveLinear(Ad, Jtr.map(v=>-v));
        if (!dp || dp.some(v=>!isFinite(v))){ lambda*=10; continue; }
        let pn=p.map((v,j)=>v+dp[j]);
        pn[0]=Math.max(0,pn[0]); pn[2]=Math.max(step*0.5,pn[2]); pn[3]=Math.min(1,Math.max(0,pn[3]));
        const rn=resid(pn), cn=cost(rn);
        if (cn<c){ const rel=(c-cn)/(c||1); p=pn; r=rn; c=cn; lambda=Math.max(lambda*0.4,1e-10); stepTaken=true;
          if (rel<1e-7) iter=120; break; }
        lambda*=10;
      }
      if (!stepTaken) break;
    }
    return {p, cost:c};
  }
  // Fit the doublet over a local window with a multi-start over η; returns peak params
  function fitDoublet(x, y, idx0, fwhmGuess){
    const idx = refineIdx(y, idx0, 3);
    const step = x.length>1 ? Math.abs((x[x.length-1]-x[0])/(x.length-1)) : 1;
    const guess = (isFinite(fwhmGuess) && fwhmGuess>0) ? fwhmGuess : Math.max(0.2, step*4);
    const hw = Math.max(guess*4, step*10);
    let lo=idx, hi=idx;
    while (lo>0 && x[idx]-x[lo] < hw) lo--;
    while (hi<x.length-1 && x[hi]-x[idx] < hw) hi++;
    const xs=x.slice(lo,hi+1), ys=y.slice(lo,hi+1);
    if (xs.length < 7) return null;
    const bg0 = Math.min(...ys);
    const amp0 = Math.max(1e-9, y[idx]-bg0);
    let best=null;
    for (const eta0 of [0.2, 0.5, 0.8]){
      const res = lmRun(xs, ys, [amp0, x[idx], guess, eta0, bg0], step);
      if (!best || res.cost < best.cost) best = res;
    }
    const p = best.p;
    if (p[1]<xs[0] || p[1]>xs[xs.length-1] || !isFinite(p[2]) || p[2]<=0) return null;
    // normalised RMS residual as a fit-quality indicator
    const rms = Math.sqrt(best.cost/xs.length) / (amp0||1);
    return {shape:'pv', amp:p[0], pos:p[1], fwhm:p[2], eta:p[3], bg:p[4], rms};
  }

  /* ---------- Global whole-pattern fit: Σ Voigt doublets + polynomial background ---------- */
  // Humlíček w4 complex error function w(x+iy), y>=0  → returns [Re, Im]
  function cdiv(ar,ai,br,bi){ const d=br*br+bi*bi; return [(ar*br+ai*bi)/d,(ai*br-ar*bi)/d]; }
  function cef(x, y){
    const tr=y, ti=-x, s=Math.abs(x)+y;
    if (s>=15){
      const nr=0.5641896*tr, ni=0.5641896*ti, t2r=tr*tr-ti*ti, t2i=2*tr*ti;
      return cdiv(nr,ni,0.5+t2r,t2i);
    } else if (s>=5.5){
      const ur=tr*tr-ti*ti, ui=2*tr*ti, ar=1.410474+0.5641896*ur, ai=0.5641896*ui;
      const nr=tr*ar-ti*ai, ni=tr*ai+ti*ar, u2r=ur*ur-ui*ui, u2i=2*ur*ui;
      return cdiv(nr,ni,0.75+3*ur+u2r,3*ui+u2i);
    } else if (y>=0.195*Math.abs(x)-0.176){
      let Nr=0.5642236,Ni=0; const mac=c=>{ const r=Nr*tr-Ni*ti+c, i=Nr*ti+Ni*tr; Nr=r; Ni=i; };
      mac(3.778987); mac(11.96482); mac(20.20933); mac(16.4955);
      let Dr=1,Di=0; const mad=c=>{ const r=Dr*tr-Di*ti+c, i=Dr*ti+Di*tr; Dr=r; Di=i; };
      mad(6.699398); mad(21.69274); mad(39.27121); mad(38.82363); mad(16.4955);
      return cdiv(Nr,Ni,Dr,Di);
    } else {
      const ur=tr*tr-ti*ti, ui=2*tr*ti;
      let Pr=0.56419,Pi=0; const sp=c=>{ const mr=ur*Pr-ui*Pi, mi=ur*Pi+ui*Pr; Pr=c-mr; Pi=-mi; };
      sp(1.320522); sp(35.76683); sp(219.0313); sp(1540.787); sp(3321.9905); sp(36183.31);
      const nr=tr*Pr-ti*Pi, ni=tr*Pi+ti*Pr;
      let Qr=1,Qi=0; const sq=c=>{ const mr=ur*Qr-ui*Qi, mi=ur*Qi+ui*Qr; Qr=c-mr; Qi=-mi; };
      sq(1.841439); sq(61.57037); sq(364.2191); sq(2186.181); sq(9022.228); sq(24322.84); sq(32066.6);
      const e=Math.exp(ur), er=e*Math.cos(ui), ei=e*Math.sin(ui);
      const [qr,qi]=cdiv(nr,ni,Qr,Qi);
      return [er-qr, ei-qi];
    }
  }
  const INV_SQRT_PI = 1/Math.sqrt(Math.PI);
  // Voigt shape (area·const absorbed into amplitude) value at xi; centre x0, Gaussian σ, Lorentzian γ
  function voigtVal(xi, x0, sigma, gamma){
    const a = sigma*Math.SQRT2; const u=(xi-x0)/a, v=gamma/a;
    return cef(u, v)[0];
  }
  // Voigt value + analytic derivatives wrt (x0, sigma, gamma) via w'(z) = -2z·w + 2i/√π
  function voigtGrad(xi, x0, sigma, gamma){
    const a = sigma*Math.SQRT2; const u=(xi-x0)/a, v=gamma/a;
    const [wr, wi] = cef(u, v);
    const zw_r = u*wr - v*wi, zw_i = u*wi + v*wr;     // z·w
    const wpr = -2*zw_r;                               // Re w'
    const wpi = -2*zw_i + 2*INV_SQRT_PI;               // Im w'
    return {
      val: wr,
      dx0: -wpr/a,
      dgam: -wpi/a,
      dsig: -(Math.SQRT2/a)*(wpr*u - wpi*v)            // Re[w'·z]
    };
  }
  // FWHM (°2θ) of a Voigt from σ,γ — Olivero & Longbothum approximation
  function voigtFWHM(sigma, gamma){
    const fG = 2*sigma*Math.sqrt(2*Math.LN2), fL = 2*gamma;
    return 0.5346*fL + Math.sqrt(0.2166*fL*fL + fG*fG);
  }
  // pseudo-Voigt value + derivatives (used only by the local fallback fit)
  function pvGrad(xi, x0, w, eta){
    const z=(xi-x0)/w, t=z*z, denom=1+4*t;
    const G=Math.exp(-4*Math.LN2*t), L=1/denom;
    return {
      val: eta*L + (1-eta)*G,
      dx0: eta*(8*z/(w*denom*denom)) + (1-eta)*(G*8*Math.LN2*z/w),
      dw:  eta*(8*t/(w*denom*denom)) + (1-eta)*(G*8*Math.LN2*t/w),
      deta: L - G
    };
  }
  // Base symmetric shape value + derivatives, normalised to {val,dx0,d2,d3}
  // (d2 = ∂/∂(first width); d3 = ∂/∂(second param: γ for Voigt, η for pV))
  function baseGrad(profile, xi, c, p2, p3){
    if (profile==='voigt'){ const g=voigtGrad(xi,c,p2,p3); return {val:g.val,dx0:g.dx0,d2:g.dsig,d3:g.dgam}; }
    const g=pvGrad(xi,c,p2,p3); return {val:g.val,dx0:g.dx0,d2:g.dw,d3:g.deta};
  }
  function baseVal(profile, xi, c, p2, p3){
    return profile==='voigt' ? voigtVal(xi,c,p2,p3) : pseudoVoigt(xi,c,p2,p3);
  }
  // FCJ-type axial-divergence kernel offsets (°2θ) + weights for a peak at pos.
  // ε drawn from the convolution of the sample (S/L) and slit (H/L) extents (trapezoid),
  // mapped to apparent angle by cos(2θ')=cos(2θ)/cos²ε (FCJ); folds direction around 90°.
  function fcjOffsets(pos, SL, HL, nq){
    const emax = SL + HL;
    if (!(emax > 0)) return [{d:0,w:1}];
    const cosP = Math.cos(pos*Math.PI/180), plateau = Math.abs(SL-HL);
    const out=[]; let wsum=0;
    for (let q=0;q<nq;q++){
      const eps = emax*(q+0.5)/nq;
      let tw = eps<=plateau ? 1 : (emax-eps)/((emax-plateau)||1); if (tw<0) tw=0;
      const cE=Math.cos(eps); let arg=cosP/(cE*cE); if(arg>1)arg=1; if(arg<-1)arg=-1;
      out.push({d: Math.acos(arg)*180/Math.PI - pos, w:tw}); wsum+=tw;
    }
    if (wsum<=0) return [{d:0,w:1}];
    out.forEach(o=>o.w/=wsum);
    return out;
  }
  // One doublet-component value+grad at centre c, with optional asymmetry. asym={on,mode,SL,HL,nq}
  // returns {val, dc, d2, d3, da}
  function compGrad(profile, asym, xi, c, p2, p3, a){
    if (!asym || !asym.on){ const g=baseGrad(profile,xi,c,p2,p3); return {val:g.val,dc:g.dx0,d2:g.d2,d3:g.d3,da:0}; }
    if (asym.mode==='split'){
      const left = xi < c, s = Math.exp(left ? -a/2 : a/2), dsda = (left?-0.5:0.5)*s;
      const w2 = p2*s, w3 = profile==='voigt' ? p3*s : p3; // pV: η not scaled
      const g = baseGrad(profile, xi, c, w2, w3);
      const d3 = profile==='voigt' ? g.d3*s : g.d3;
      const da = profile==='voigt' ? (g.d2*p2 + g.d3*p3)*dsda : (g.d2*p2)*dsda;
      return {val:g.val, dc:g.dx0, d2:g.d2*s, d3, da};
    }
    // FCJ: convolve base profile (and its gradients) with the kernel
    const offs = fcjOffsets(c, asym.SL, asym.HL, asym.nq);
    let val=0,dc=0,d2=0,d3=0;
    for (const o of offs){ const g=baseGrad(profile, xi-o.d, c, p2, p3); val+=o.w*g.val; dc+=o.w*g.dx0; d2+=o.w*g.d2; d3+=o.w*g.d3; }
    return {val,dc,d2,d3,da:0};
  }
  // Value-only version (for reconstruction) using a stored fit object fp
  function compVal(fp, xi, c){
    const prof=fp.shape, p2=(prof==='voigt'?fp.sigma:fp.fwhm), p3=(prof==='voigt'?fp.gamma:fp.eta);
    if (!fp.asym){ return baseVal(prof,xi,c,p2,p3); }
    if (fp.asym==='split'){
      const left=xi<c, s=Math.exp(left?-fp.a/2:fp.a/2);
      return baseVal(prof, xi, c, p2*s, prof==='voigt'?p3*s:p3);
    }
    const offs=fcjOffsets(c, fp.SL, fp.HL, fp.nq||14); let v=0;
    for (const o of offs) v+=o.w*baseVal(prof, xi-o.d, c, p2, p3);
    return v;
  }

  // Least-squares polynomial (powers of normalised u) fit of yv(x) — for background init
  function polyfitPow(xs, yv, xc, xh, deg){
    const nb=deg+1, A=Array.from({length:nb},()=>new Array(nb).fill(0)), b=new Array(nb).fill(0);
    for (let i=0;i<xs.length;i++){
      const u=(xs[i]-xc)/xh; const pw=new Array(nb); let um=1; for(let m=0;m<nb;m++){pw[m]=um;um*=u;}
      for (let a=0;a<nb;a++){ b[a]+=pw[a]*yv[i]; for(let c=0;c<nb;c++) A[a][c]+=pw[a]*pw[c]; }
    }
    return solveLinear(A,b) || new Array(nb).fill(0);
  }
  // active: [{A0,x0,w0}]; fit raw y with Voigt/pseudo-Voigt doublets (optional asymmetry)
  // + poly background. params per peak = [A, x0, p2, p3] (+ a when split asymmetry).
  async function fitGlobal(x, y, active, snip, hp, onProgress){
    const N=active.length; if (!N) return null;
    const voigt = (hp.profile||'voigt')==='voigt', profile = voigt?'voigt':'pv';
    const asym = { on: !!hp.asym, mode: hp.asymMode||'split', SL: hp.SL, HL: hp.HL, nq: 14 };
    const split = asym.on && asym.mode==='split';
    // Standard-calibration mode: refine the FCJ geometry (S/L, H/L) as two global params
    const calib = asym.on && asym.mode==='fcj' && !!hp.calib;
    const pp_n = split ? 5 : 4;                       // params per peak
    const n=x.length, r=KA2_RATIO, K2=2*Math.sqrt(2*Math.LN2);
    const xc=(x[0]+x[n-1])/2, xh=((x[n-1]-x[0])/2)||1;

    // Stratified deterministic sampling: concentrate points near peaks, fill rest
    // uniformly. Using ALL points makes the FCJ standard fit ~35x slower (≈100 s on
    // a 2000-pt pattern) for negligible accuracy gain, so we decimate.
    const PK_PTS = 100, BG_PER_DEG = 10;
    const BG_TOTAL = Math.round(BG_PER_DEG * (x[n-1] - x[0]));
    const selected = new Uint8Array(n);
    if (hp._allPoints){
      selected.fill(1);                               // final refinement uses every point
    } else {
      for (const pk of active){
        const hw = 2 * Math.max(1e-3, pk.w0);         // ±2·FWHM half-window
        const lo = pk.x0 - hw, hi = pk.x0 + hw;
        selected[nearestIdx(x, pk.x0)] = 1;           // force the peak maximum
        const inWin = [];
        for (let i=0; i<n; i++) if (x[i]>=lo && x[i]<=hi) inWin.push(i);
        if (inWin.length <= PK_PTS){ inWin.forEach(i=>selected[i]=1); }
        else { const step=(inWin.length-1)/(PK_PTS-1); for (let q=0;q<PK_PTS;q++) selected[inWin[Math.round(q*step)]]=1; }
      }
      const already = selected.reduce((s,v)=>s+v, 0);
      const bgBudget = Math.max(0, BG_TOTAL - already);
      if (bgBudget > 0){ const stride=Math.max(1, Math.floor(n/bgBudget)); for (let i=0;i<n;i+=stride) selected[i]=1; }
    }
    const xs=[], ys=[], ws=[], us=[], snipS=[];
    for (let i=0; i<n; i++) if (selected[i]){
      xs.push(x[i]); ys.push(y[i]); ws.push(1/Math.max(y[i],1)); us.push((x[i]-xc)/xh); snipS.push(snip[i]||0);
    }
    // Calibration refines a SINGLE geometry param G = S/L = H/L (the two are
    // degenerate in this kernel; only their sum is identifiable).
    const deg=hp.bgDegree, nb=deg+1, idxG=pp_n*N+nb, P=idxG+(calib?1:0);
    const bgAnchor = Math.max(0, hp.bgAnchor||0); // soft SNIP-anchor strength (0 = off)
    const p=new Float64Array(P);
    const wScale = hp.wScale!==undefined ? hp.wScale : 1; // initial-width multi-start factor
    active.forEach((pk,k)=>{
      const w0=Math.max(1e-3, pk.w0)*wScale, b=pp_n*k;
      p[b]=Math.max(1e-6,pk.A0); p[b+1]=pk.x0;
      if (voigt){ const sf=hp.sigFrac!==undefined?hp.sigFrac:0.6, gf=hp.gamFrac!==undefined?hp.gamFrac:0.2;
                  p[b+2]=Math.max(1e-4, sf*w0/K2); p[b+3]=Math.max(0, gf*w0); }
      else      { p[b+2]=w0;                          p[b+3]=Math.min(1,Math.max(0,hp.etaInit!==undefined?hp.etaInit:0.5)); }
      if (split) p[b+4]=0;
    });
    const c0=polyfitPow(xs, snipS, xc, xh, deg);
    for (let m=0;m<nb;m++) p[pp_n*N+m]=c0[m]||0;
    if (calib){ p[idxG]=Math.max(1e-3, 0.5*((asym.SL||0.02)+(asym.HL||0.02))); }
    // Optional seed: start from a supplied parameter vector (used by the final all-points step)
    if (hp._seedP && hp._seedP.length===P) p.set(hp._seedP);
    const hFD=1e-4; // finite-difference step for the S/L, H/L gradients
    // Per-peak position bounds: stay within a few FWHM of the detected position,
    // and never leave the data range by more than a small margin (edge peaks may
    // be partly cut, but must not run off to absurd 2θ).
    const xLo=x[0], xHi=x[n-1], xMargin=Math.min(5, 0.1*(xHi-xLo));
    const posLo=new Float64Array(N), posHi=new Float64Array(N);
    active.forEach((pk,k)=>{ const win=Math.max(1, 4*Math.max(1e-3,pk.w0));
      posLo[k]=Math.max(xLo-xMargin, pk.x0-win); posHi[k]=Math.min(xHi+xMargin, pk.x0+win); });

    const JtJ=Array.from({length:P},()=>new Float64Array(P)), Jtr=new Float64Array(P), grad=new Float64Array(P);
    const isFCJ = asym.on && asym.mode==='fcj';
    // FCJ value+grad using a PREcomputed offset kernel (offsets depend only on the
    // peak centre and S/L,H/L, so they are constant across all data points).
    function fcjComp(offs, xi, c, p2, p3){
      let val=0,dc=0,d2=0,d3=0;
      for (let j=0;j<offs.length;j++){ const o=offs[j], g=baseGrad(profile, xi-o.d, c, p2, p3);
        val+=o.w*g.val; dc+=o.w*g.dx0; d2+=o.w*g.d2; d3+=o.w*g.d3; }
      return {val,dc,d2,d3};
    }
    // per-peak cached kernels (rebuilt each evalAll, when x0 or G may have changed)
    const kA=isFCJ?new Array(N):null, kB=isFCJ?new Array(N):null, kGA=calib?new Array(N):null, kGB=calib?new Array(N):null;
    function evalAll(pp, accum){
      let cost=0;
      if (calib){ const G=Math.max(1e-3,pp[idxG]); asym.SL=G; asym.HL=G; }
      if (isFCJ){
        for (let k=0;k<N;k++){ const x0=pp[pp_n*k+1], d=ka2Delta(x0);
          kA[k]=fcjOffsets(x0, asym.SL, asym.HL, asym.nq);
          kB[k]=fcjOffsets(x0+d, asym.SL, asym.HL, asym.nq);
          if (calib){ const Gp=asym.SL+hFD; kGA[k]=fcjOffsets(x0, Gp, Gp, asym.nq); kGB[k]=fcjOffsets(x0+d, Gp, Gp, asym.nq); }
        }
      }
      if (accum){ for(let a=0;a<P;a++){ JtJ[a].fill(0); } Jtr.fill(0); }
      for (let q=0;q<xs.length;q++){
        const xi=xs[q]; let m=0; if (accum) grad.fill(0);
        let gG=0;
        for (let k=0;k<N;k++){
          const b=pp_n*k, A=pp[b],x0=pp[b+1],p2=pp[b+2],p3=pp[b+3],a=split?pp[b+4]:0,d=ka2Delta(x0);
          const c1 = isFCJ ? fcjComp(kA[k],xi,x0,p2,p3) : compGrad(profile,asym,xi,x0,p2,p3,a);
          const c2 = isFCJ ? fcjComp(kB[k],xi,x0+d,p2,p3) : compGrad(profile,asym,xi,x0+d,p2,p3,a);
          const shape=c1.val+r*c2.val; m+=A*shape;
          if (accum){
            grad[b]=shape;
            grad[b+1]=A*(c1.dc+r*c2.dc);
            grad[b+2]=A*(c1.d2+r*c2.d2);
            grad[b+3]=A*(c1.d3+r*c2.d3);
            if (split) grad[b+4]=A*(c1.da+r*c2.da);
            if (calib){
              const sG=fcjComp(kGA[k],xi,x0,p2,p3).val + r*fcjComp(kGB[k],xi,x0+d,p2,p3).val;
              gG += A*(sG-shape)/hFD;
            }
          }
        }
        if (accum && calib){ grad[idxG]=gG; }
        let um=1, bgVal=0; for (let mm=0;mm<nb;mm++){ const t=pp[pp_n*N+mm]*um; m+=t; bgVal+=t; if(accum) grad[pp_n*N+mm]=um; um*=us[q]; }
        const res=m-ys[q], wq=ws[q]; cost+=wq*res*res;
        if (accum){ for (let a=0;a<P;a++){ const ga=grad[a]; if(ga===0) continue; Jtr[a]+=wq*ga*res; const gw=wq*ga, row=JtJ[a]; for(let bb=a;bb<P;bb++) row[bb]+=gw*grad[bb]; } }
        // Soft SNIP anchor: penalise the background straying from the SNIP estimate,
        // α·w·(bg−snip)². Only the background (polynomial) columns are involved.
        if (bgAnchor > 0){
          const rp = bgVal - snipS[q], wp = bgAnchor*wq; cost += wp*rp*rp;
          if (accum){
            const b0=pp_n*N;
            for (let a=b0;a<b0+nb;a++){ const ga=grad[a]; Jtr[a]+=wp*ga*rp; const gw=wp*ga, row=JtJ[a]; for(let bb=a;bb<b0+nb;bb++) row[bb]+=gw*grad[bb]; }
          }
        }
      }
      if (accum){ for(let a=0;a<P;a++) for(let bb=0;bb<a;bb++) JtJ[a][bb]=JtJ[bb][a]; }
      return cost;
    }
    let cost=evalAll(p,true), lambda=hp.lambda0, finalCost=cost;
    for (let iter=0; iter<hp.maxIter; iter++){
      let stepTaken=false;
      for (let tries=0; tries<8; tries++){
        const Ad=JtJ.map((row,a)=>{ const nr=Array.from(row); nr[a]*=(1+lambda); return nr; });
        const dp=solveLinear(Ad, Array.from(Jtr,v=>-v));
        if (!dp || dp.some(v=>!isFinite(v))){ lambda*=10; continue; }
        const pn=Float64Array.from(p); for(let a=0;a<P;a++) pn[a]+=dp[a];
        for (let k=0;k<N;k++){ const b=pp_n*k; pn[b]=Math.max(0,pn[b]); pn[b+1]=Math.max(posLo[k],Math.min(posHi[k],pn[b+1])); pn[b+2]=Math.max(1e-4,pn[b+2]); pn[b+3]=voigt?Math.max(0,pn[b+3]):Math.min(1,Math.max(0,pn[b+3])); if(split) pn[b+4]=Math.max(-3,Math.min(3,pn[b+4])); }
        if (calib){ pn[idxG]=Math.max(1e-3,Math.min(0.1,pn[idxG])); }
        const cn=evalAll(pn,false);
        if (cn<cost){ const rel=(cost-cn)/(cost||1); for(let a=0;a<P;a++) p[a]=pn[a]; cost=cn; finalCost=cn; lambda=Math.max(lambda*0.4,1e-12); stepTaken=true; evalAll(p,true); if(rel<hp.tol){iter=hp.maxIter;} break; }
        lambda*=10;
      }
      if (onProgress) onProgress((iter+1)/hp.maxIter);
      if ((iter & 3)===0) await new Promise(r=>setTimeout(r)); // yield so the progress bar repaints
      if (!stepTaken){ if (onProgress) onProgress(1); break; }  // converged → jump to 100%
    }
    if (calib){ const G=Math.max(1e-3,p[idxG]); asym.SL=G; asym.HL=G; }
    const coeffs=[]; for(let m=0;m<nb;m++) coeffs.push(p[pp_n*N+m]);
    const baseline=x.map(xv=>{ const u=(xv-xc)/xh; let um=1,s=0; for(let m=0;m<nb;m++){s+=coeffs[m]*um;um*=u;} return s; });
    const fits=active.map((pk,k)=>{ const b=pp_n*k, a2=p[b+2], a3=p[b+3], a=split?p[b+4]:0;
      const base = voigt ? {shape:'voigt', sigma:a2, gamma:a3, fwhm:voigtFWHM(a2,a3)}
                         : {shape:'pv',    fwhm:a2,  eta:a3};
      const fp = Object.assign({amp:p[b], pos:p[b+1]}, base);
      if (asym.on){ fp.asym=asym.mode; if (split){ fp.a=a; fp.fwhm=fp.fwhm*Math.cosh(a/2); } else { fp.SL=asym.SL; fp.HL=asym.HL; fp.nq=asym.nq; } }
      return fp; });
    if (fits.some(fp=>!isFinite(fp.fwhm)||fp.fwhm<=0||!isFinite(fp.pos))) return null;
    return {baseline, fits, cost:finalCost, calib: calib ? {SL:asym.SL, HL:asym.HL} : null, pRaw: Float64Array.from(p)};
  }

  // Multi-start wrapper: tries several starting configs and returns the lowest-cost result.
  async function multiStartFit(x, y, active, snip, hp, onProgress){
    const voigt = (hp.profile||'voigt')==='voigt';

    // Shape starts: parameterised as (sigFrac, gamFrac) for voigt, etaInit for pV.
    // For voigt, sigFrac/gamFrac scale w₀ → different points on the FWHM iso-curve.
    const shapeStarts = voigt
      ? [{sigFrac:1.0, gamFrac:0.0}, {sigFrac:0.75, gamFrac:0.12}, {sigFrac:0.5, gamFrac:0.25},
         {sigFrac:0.25, gamFrac:0.38}, {sigFrac:0.0, gamFrac:0.5}]
      : [{etaInit:0.0}, {etaInit:0.25}, {etaInit:0.5}, {etaInit:0.75}, {etaInit:1.0}];

    // Width starts: initial peak width at 1..5 × the detected FWHM. In calibration
    // mode each of these runs already refines G from its start, so no separate G grid.
    const widthStarts = [{wScale:1},{wScale:2},{wScale:3},{wScale:4},{wScale:5}];

    const total = shapeStarts.length * widthStarts.length + 1; // +1 final all-points step
    let bestSeed = null, bestScore = Infinity, done = 0;

    // Cheap all-points score of a parameter vector: one forward evaluation, 0 LM steps.
    const scoreAllPoints = async (pRaw)=>{
      const r = await fitGlobal(x, y, active, snip, Object.assign({}, hp, {_seedP:pRaw, _allPoints:true, maxIter:0}), null);
      return r ? r.cost : Infinity;
    };

    for (const sc of shapeStarts){
      for (const wc of widthStarts){
        const hpTry = Object.assign({}, hp, sc, wc);
        const res = await fitGlobal(x, y, active, snip, hpTry, frac=>{
          if (onProgress) onProgress((done + frac) / total);
        });
        // Fix 1: rank candidates by cost on ALL points (the same objective the final
        // step optimises), not by the sub-sampled cost — otherwise the seed handed to
        // the final refinement is chosen against a different objective and the result
        // becomes start-dependent.
        if (res && res.pRaw){
          const s = await scoreAllPoints(res.pRaw);
          if (s < bestScore){ bestScore = s; bestSeed = res.pRaw; }
        }
        done++;
        if (onProgress) onProgress(done / total);
      }
    }
    // Final refinement: one fit on ALL points, seeded from the all-points-best candidate.
    let best = null;
    if (bestSeed){
      const hpFinal = Object.assign({}, hp, {_seedP: bestSeed, _allPoints: true,
        maxIter: Math.min(hp.maxIter||60, 40)});
      best = await fitGlobal(x, y, active, snip, hpFinal, frac=>{ if (onProgress) onProgress((done+frac)/total); });
    }
    if (onProgress) onProgress(1);
    return best;
  }

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

  // Instrumental FWHM (deg) at a given 2θ, linearly interpolated from the
  // selected standard's measured peaks (0 when no standard is set)
  function instrBeta(twoTheta){
    if (!standardName) return 0;
    const si = files.findIndex(f=>f.name===standardName);
    if (si < 0 || !processed[si]) return 0;
    const pts = processed[si].peaks
      .filter(p=>!p.removed && isFinite(p.fwhm))
      .map(p=>({x:p.pos, b:p.fwhm}))
      .sort((a,b)=>a.x-b.x);
    if (!pts.length) return 0;
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
  function reconstructFit(x, fps){
    const full = new Array(x.length).fill(0);
    const ka1  = new Array(x.length).fill(0);
    for (const fp of fps){
      if (!fp) continue;
      const d = ka2Delta(fp.pos);
      for (let j=0;j<x.length;j++){
        const k1 = fp.amp*compVal(fp, x[j], fp.pos);
        ka1[j]  += k1;
        full[j] += k1 + fp.amp*KA2_RATIO*compVal(fp, x[j], fp.pos+d);
      }
    }
    return {full, ka1};
  }

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
    const n = files.length, baseOf = k => -k * 1.1;
    let Y = curves.map(c=>c ? c.slice() : null);
    if (norm === 'local'){
      Y = Y.map((y,k)=> y ? y.map(v=>v/(maxArr(y)||1)+baseOf(k)+0.05) : null);
    } else {
      const gmax = Math.max(1, ...Y.filter(Boolean).map(maxArr));
      Y = Y.map((y,k)=> y ? y.map(v=>v/gmax+baseOf(k)+0.05) : null);
    }
    const plot = new Plot(document.getElementById(svgId), {xlabel:'2θ (°)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = document.getElementById(legendId); legend.innerHTML='';
    const [ux0, ux1] = unionRange();
    plot.setRange(ux0, ux1, baseOf(n-1), baseOf(0)+1.1);
    plot.drawAxes();
    Y.forEach((y,k)=>{
      if (!y) return;
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
    document.getElementById('xrdPkLabel').textContent = files[curIdx].label + (isStd ? ' (standard)' : '');
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
    let html='<table><thead><tr><th>#</th><th>2θ (°)</th><th>Rel. intensity</th><th>FWHM (°)</th><th>Size (nm)</th>'+(showCorr?'<th>Size corr. (nm)</th>':'')+'<th></th></tr></thead><tbody>';
    pks.forEach((pk,i)=>{
      const fwhm = pk.fwhmClassic;
      const sizeRawCell = isStd ? '—' : fmtCell(sizeRaw(fwhm, pk.detPos, fp.K, fp.lambda));
      const corrCell = showCorr ? `<td>${fmtCell(sizeCorr(fwhm, pk.detPos, fp.K, fp.lambda))}</td>` : '';
      const sel = panels.a.sel!=null && Math.abs(pk.pos-panels.a.sel)<1e-9 ? ' selected' : '';
      html+=`<tr class="peak-row${pk.manual?' manual-peak':''}${sel}" data-pos="${pk.pos}" data-det="${pk.detPos}"><td>${i+1}</td><td>${pk.pos.toFixed(3)}</td><td>${(pk.height/maxH*100).toFixed(1)}%</td><td>${isFinite(fwhm)?fwhm.toFixed(3):'—'}</td><td>${sizeRawCell}</td>${corrCell}<td style="text-align:right"><button class="peak-del" data-det="${pk.detPos}" data-manual="${pk.manual?1:0}" title="Remove peak">✕</button></td></tr>`;
    });
    html+='</tbody></table>';
    // Mean ± std crystallite size for this sample, shown right under the peak table
    const st = sampleSizeStats(curIdx);
    if (st.isStd){
      html += '<div class="size-summary">Standard sample — crystallite size not computed.</div>';
    } else {
      html += `<div class="size-summary">Mean crystallite size: <b>${fmtMeanStd(st.rawMean, st.rawStd, st.rawN)} nm</b> <span class="ss-n">(n = ${st.rawN})</span>`;
      if (st.showCorr) html += `<br>Instr.-corrected: <b>${fmtMeanStd(st.corrMean, st.corrStd, st.corrN)} nm</b> <span class="ss-n">(n = ${st.corrN})</span>`;
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
    document.getElementById('xrdFitPkLabel').textContent = files[curIdx].label + (isStd ? ' (standard)' : '');
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
    let html='<table><thead><tr><th>#</th><th>2θ (°)</th><th>Rel. intensity</th><th>FWHM (°)</th><th>Size (nm)</th>'+(showCorr?'<th>Size corr. (nm)</th>':'')+'</tr></thead><tbody>';
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
    let html = '<table><thead><tr><th>Sample</th><th>n</th><th>Size (nm)</th>' + (anyStd?'<th>Size corr. (nm)</th>':'') + '</tr></thead><tbody>';
    files.forEach((f,i)=>{
      const st = sampleSizeStats(i);
      const sizeCell = st.isStd ? '<span style="color:var(--muted)">standard</span>' : fmtMeanStd(st.rawMean, st.rawStd, st.rawN);
      const corrCell = anyStd ? `<td>${st.isStd ? '—' : fmtMeanStd(st.corrMean, st.corrStd, st.corrN)}</td>` : '';
      const nCell = st.isStd ? '—' : st.rawN;
      html += `<tr><td class="fname" title="${f.label.replace(/"/g,'&quot;')}">${f.label}</td><td>${nCell}</td><td>${sizeCell}</td>${corrCell}</tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  // Per-field shared/per-sample toggles (one segmented control per editable field)
  const TOGGLE_FIELD = { xrdModeN:'N', xrdModeBl:'blWin', xrdModeH:'pkHeight', xrdModeP:'pkProm', xrdModeD:'pkDist', xrdModeK:'K', xrdModeL:'lambda' };
  Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{
    document.querySelectorAll('#'+tid+' button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#'+tid+' button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        paramMode[key] = btn.dataset.m;
        // Seed a per-sample override from the current shared value so switching to
        // 'per' doesn't lose the displayed number
        if (btn.dataset.m==='per'){ if(!perParams[curIdx]) perParams[curIdx]={}; if(perParams[curIdx][key]===undefined) perParams[curIdx][key]=shared[key]; }
        writeStoreToInputs();
      });
    });
  });

  // Param change listeners — store then reprocess
  ['xrdNorm'].forEach(id=>{
    document.getElementById(id).addEventListener('input', ()=>{
      saveXrdParams();
      if (files.length){ updateXrdResults(); }
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
  function showProg(frac){
    const w=document.getElementById('xrdFitProgWrap'), b=document.getElementById('xrdFitProgBar');
    if (w) w.style.display=''; if (b) b.style.width=Math.max(0,Math.min(1,frac))*100+'%';
  }
  function hideProg(){ const w=document.getElementById('xrdFitProgWrap'), b=document.getElementById('xrdFitProgBar'); if(w)w.style.display='none'; if(b)b.style.width='0%'; }

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
    const res = await multiStartFit(x, y, init, snipSeed, hp, onProgress);
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
    const btn=document.getElementById(btnId); const lbl=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent=busyLabel||'Fitting…'; }
    showProg(0);
    try {
      const n=indices.length;
      for (let s=0; s<n; s++){
        const calib = await fitOneFile(indices[s], hp, frac=>showProg((s+frac)/n));
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
      fitBusy=false;
      updateXrdFitting(true); updateXrdResults(); renderPeakTable();
    }
  }
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
    if (files.length){ updateStdButtons(); renderPeakTable(); }
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
      if (isSizeOnly){ renderPeakTable(); return; } // only the Scherrer size changes
      // Peak deletions reset only when this peak-search field changes
      if (isPeakSearch){
        if (paramMode[key]==='shared') removedPeaks = removedPeaks.map(()=>[]);
        else removedPeaks[curIdx] = [];
      }
      if (paramMode[key]==='shared') reprocessAll(); else reprocessOne(curIdx);
      updateXrdAnalysis(true);      // analysis is live
      updateXrdFitting(true);       // refresh inherited peaks / initial state (keeps last fit)
      updateXrdResults();
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

  window._xrdRedraw = ()=>{ if (files.length){ updateXrdAnalysis(true); updateXrdFitting(true); updateXrdResults(); } };

  document.getElementById('xrdSave').onclick = ()=>{
    if (!files.length) return;
    const norm = document.getElementById('xrdNorm').value;
    // Main diffraction data CSV (baseline-subtracted, normalised, all samples)
    let Y = processed.map(pr=>pr.subtracted.slice());
    if (norm==='local') Y=Y.map(y=>{ const mx=maxArr(y)||1; return y.map(v=>v/mx); });
    else { const gmax=Math.max(...Y.map(maxArr))||1; Y=Y.map(y=>y.map(v=>v/gmax)); }
    // Each sample keeps its own 2θ axis → one (2Theta, intensity) column pair per sample
    const header=[]; files.forEach(f=>header.push('2Theta_'+f.label, f.label));
    let t=csvLine(header);
    const maxLen=Math.max(...files.map(f=>f.x.length));
    for (let i=0;i<maxLen;i++){
      const row=[];
      files.forEach((f,k)=>{
        if (i<f.x.length) row.push(fmtNum(f.x[i],6), fmtNum(Y[k][i],6));
        else row.push('','');
      });
      t+=csvLine(row);
    }
    downloadBlob('xrd_output.csv', t);
    const wrap=document.getElementById('xrdDownloads'); wrap.innerHTML='';
    makeDownloadLink(wrap,'xrd_output.csv',t,'xrd_output.csv');
    // Per-sample peak list CSVs (excluding peaks removed in the table)
    processed.forEach((pr,k)=>{
      const pks = pr.peaks.filter(pk=>!pk.removed);
      if (!pks.length) return;
      const isStd = files[k].name === standardName;
      const kp = getFileParams(k);
      const maxH=Math.max(...pks.map(pk=>pk.height))||1;
      let pt=csvLine(['2Theta','RelIntensity','FWHM_deg','Size_nm','Size_corr_nm']);
      pks.forEach(pk=>{
        const Draw = isStd ? NaN : sizeRaw(pk.fwhmClassic, pk.detPos, kp.K, kp.lambda);
        const Dcorr= isStd ? NaN : sizeCorr(pk.fwhmClassic, pk.detPos, kp.K, kp.lambda);
        pt+=csvLine([fmtNum(pk.pos,6),fmtNum(pk.height/maxH,6),
                     isFinite(pk.fwhmClassic)?fmtNum(pk.fwhmClassic,5):'',
                     isFinite(Draw)?fmtNum(Draw,3):'', isFinite(Dcorr)?fmtNum(Dcorr,3):'']);
      });
      const fname=files[k].label+'_peaks.csv';
      downloadBlob(fname, pt);
      makeDownloadLink(wrap, fname, pt, fname);
    });
    // Per-sample last-fit CSVs: observed + fit total and its components (bkgnd, Kα1, Kα2)
    files.forEach((f,k)=>{
      const sf = savedFits[k];
      if (!sf || !sf.fits || !sf.fits.length) return;
      const rec = reconstructFit(f.x, sf.fits); // {full, ka1} in raw intensity units
      let ft = csvLine(['2Theta','Observed','Fit_total','Background','Ka1','Ka2']);
      for (let j=0;j<f.x.length;j++){
        const bg=sf.baseline[j]||0, ka1=rec.ka1[j], ka2=rec.full[j]-rec.ka1[j];
        ft += csvLine([fmtNum(f.x[j],6), fmtNum(f.y[j],6), fmtNum(bg+rec.full[j],6),
                       fmtNum(bg,6), fmtNum(ka1,6), fmtNum(ka2,6)]);
      }
      const fn=f.label+'_fit.csv';
      downloadBlob(fn, ft);
      makeDownloadLink(wrap, fn, ft, fn);
    });
  };
})();

