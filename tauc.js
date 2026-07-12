import { fmtNum, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, linspace, movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   TAUC MODULE
========================================================= */
(function(){
  let files = []; // {name,label,wl[],FR[],hv[]}  (each on its own native axis)
  let currIndex=0;
  let plot;
  let vlines = {};
  let bestRegsAll = [];

  // ---- Per-sample analysis parameters (all/one, mirroring the XRD module) ----
  // Togglable fields: a (direct/indirect exponent) and the two smoothing windows.
  // M/M2 (regression windows) are always shared — no toggle.
  const taucMode = { a:'shared', N:'shared', N2:'shared' };   // 'shared' | 'per'
  const taucShared = { a:0.5, N:1, N2:10, M:50, M2:50 };      // shared values / defaults
  let   taucPer = [];                                          // per-sample overrides: {a?,N?,N2?}
  const TAUC_TOGGLE = { taucModeA:'a', taucModeN:'N', taucModeN2:'N2' }; // toggle id -> field

  // Resolve the effective params for a given file index (respects shared/per mode)
  function getFileParams(i){
    const pp = taucPer[i] || {};
    const g = k => (taucMode[k]==='per') ? (pp[k] ?? taucShared[k]) : taucShared[k];
    return {
      a:  g('a'),
      N:  Math.max(1, Math.round(g('N'))),
      N2: Math.max(1, Math.round(g('N2'))),
      M:  Math.max(2, Math.round(taucShared.M)),
      M2: Math.max(2, Math.round(taucShared.M2)),
    };
  }
  function curParams(){ return getFileParams(currIndex); }

  // Store one field's value into the appropriate slot for the current sample
  function setField(k, v){
    if (taucMode[k]==='per'){ if (!taucPer[currIndex]) taucPer[currIndex]={}; taucPer[currIndex][k]=v; }
    else taucShared[k]=v;
  }
  // Read the input fields into the store (for the current sample)
  function readInputsToStore(){
    const aVal  = parseFloat(document.getElementById('taucA').value);
    const nVal  = Math.max(1, Math.round(+document.getElementById('taucN').value  || 1));
    const n2Val = Math.max(1, Math.round(+document.getElementById('taucN2').value || 1));
    if (isFinite(aVal)) setField('a', aVal);
    setField('N', nVal); setField('N2', n2Val);
    taucShared.M  = Math.max(2, Math.round(+document.getElementById('taucM').value  || 2));
    taucShared.M2 = Math.max(2, Math.round(+document.getElementById('taucM2').value || 2));
  }
  // Push the current sample's stored params into the input fields
  function writeStoreToInputs(){
    const p = getFileParams(currIndex);
    document.getElementById('taucA').value  = p.a;
    document.getElementById('taucN').value  = p.N;
    document.getElementById('taucN2').value = p.N2;
    document.getElementById('taucM').value  = p.M;
    document.getElementById('taucM2').value = p.M2;
    document.getElementById('taucNExp').textContent = p.a;
  }
  function syncTaucModeButtons(){
    Object.entries(TAUC_TOGGLE).forEach(([tid, key])=>{
      document.querySelectorAll('#'+tid+' button').forEach(btn=> btn.classList.toggle('active', btn.dataset.m===taucMode[key]));
    });
  }

  // per-upload invalid names (files that were skipped); persists until all files are removed
  let invalidUploadNames = [];
  let taucUploadAlerts = '';
  let taucWarnDismissed = false;

  // Delegated click handling for dynamically generated alert dismiss buttons.
  document.getElementById('tab-tauc').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn || !document.getElementById('tab-tauc').contains(btn)) return;
    switch (btn.dataset.action){
      case 'tauc-dismiss-invalid': invalidUploadNames=[]; rebuildTaucAlerts(); break;
      case 'tauc-dismiss-warn':    taucWarnDismissed=true; rebuildTaucAlerts(); break;
      case 'tauc-dismiss-upload':  taucUploadAlerts=''; rebuildTaucAlerts(); break;
    }
  });

  function rebuildTaucAlerts(){
    const warnNames = taucWarnDismissed ? [] : files.filter(f=>f.warn).map(f=>f.name);
    document.getElementById('taucAlerts').innerHTML =
      buildAlertsHtml(invalidUploadNames, warnNames, undefined, 'tauc-dismiss-invalid', 'tauc-dismiss-warn') + taucUploadAlerts;
  }

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1);
        taucPer.splice(i,1);            // keep per-sample params aligned with files
        if (!files.length) invalidUploadNames = [];
        rebuildTaucAlerts();
        afterFilesChange();
      },
      onReorder(from, to){ [files,taucPer].forEach(a=>{ const [x]=a.splice(from,1); a.splice(to,0,x); }); rebuildTaucAlerts(); afterFilesChange(); },
      onLabelChange(i, v){ files[i].label=v; updateTaucResults(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; updateTaucResults(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; taucPer=[]; invalidUploadNames=[]; taucUploadAlerts=''; taucWarnDismissed=false; vlines={}; rebuildTaucAlerts(); afterFilesChange(); },
    };
  }

  /* ---- Undo/redo: snapshot the reversible state (file order/labels/colors,
     the draggable line positions and the analysis parameters). Raw spectra
     arrays are shared by reference; only metadata is cloned. ---- */
  function taucSnapshot(){
    return {
      files: files.map(f=>({...f})),
      vlines: {...vlines},
      mode: {...taucMode},
      shared: {...taucShared},
      per: taucPer.map(p=>({...p})),
    };
  }
  function taucRestore(s){
    files = s.files.map(f=>({...f}));
    vlines = {...s.vlines};
    if (s.mode)   Object.assign(taucMode, s.mode);
    if (s.shared) Object.assign(taucShared, s.shared);
    taucPer = s.per ? s.per.map(p=>({...p})) : files.map(()=>({}));
    // Backward compatibility with pre-all/one snapshots (params stored by input id)
    if (s.params){
      taucShared.a  = parseFloat(s.params.taucA);
      taucShared.N  = +s.params.taucN;  taucShared.N2 = +s.params.taucN2;
      taucShared.M  = +s.params.taucM;  taucShared.M2 = +s.params.taucM2;
    }
    if (taucPer.length !== files.length) taucPer = files.map((_,i)=>taucPer[i] || {});
    syncTaucModeButtons();
    afterFilesChange();
  }
  const hist = registerHistory('tauc', taucSnapshot, taucRestore);
  // Redraw on tab-visible/resize: re-fit at the current size, keeping the zoom.
  registerTabRedraw('tauc', ()=>{ if (plot && files.length) updateTaucView(true); });

  setupDropzone('taucDropzone', 'taucFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const newInvalid = [];
    const alreadyLoaded = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
      // f.text() auto-detects encoding (incl. UTF-16 via BOM); rawBytes keeps the
      // original bytes for byte-exact re-download.
      const rawBytes = new Uint8Array(await f.arrayBuffer());
      const text = await f.text();
      const rawLines = text.split(/\r?\n/).filter(l=>l.trim().length);
      if (!rawLines.length){ newInvalid.push(f.name); continue; }

      // Detect delimiter
      const sample = rawLines[0] + (rawLines[1]||'');
      const delim = sample.includes(';') ? ';' : sample.includes('\t') ? '\t' : ',';

      // Validate: all data rows must have exactly 2 non-empty columns
      let tooManyColumns = false, parsedCount = 0;
      for (const line of rawLines){
        const parts = line.split(delim).map(s=>s.trim());
        const nonEmpty = parts.filter(s=>s!=='');
        const a = parseFloat(nonEmpty[0]||''), b = parseFloat((nonEmpty[1]||'').replace(',','.'));
        if (isFinite(a) && isFinite(b)){
          parsedCount++;
          if (nonEmpty.length > 2){ tooManyColumns = true; break; }
        }
      }
      if (tooManyColumns || parsedCount === 0){ newInvalid.push(f.name); continue; }

      // Check standard header on second line
      const hp = (rawLines[1]||'').split(delim).map(s=>s.trim());
      const warn = !(hp.length >= 2 && /wavelength.*nm/i.test(hp[0]) && /f\s*\(r\)/i.test(hp[1]));

      // Parse data
      let wl=[], fr=[];
      for (const line of rawLines){
        const parts = line.split(delim).map(s=>s.trim());
        if (parts.length<2) continue;
        const a = parseFloat(parts[0].replace(',','.'));
        const b = parseFloat(parts[1].replace(',','.'));
        if (isFinite(a) && isFinite(b)){ wl.push(a); fr.push(b); }
      }
      if (wl.length){ files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), wl, FR:fr, warn, color:nextColor(files), rawBytes}); taucPer.push({}); }
    }
    invalidUploadNames = newInvalid;
    taucWarnDismissed = false;
    taucUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'tauc-dismiss-upload') : '';
    rebuildTaucAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    setTabLoaded('tauc', files.length);
    renderUnifiedFileList('taucFileTableWrap', files, fileCallbacks());
    if (files.length) setupAnalysis();
    else {
      document.getElementById('taucWorkspace').style.display='none';
      document.getElementById('taucResults').style.display='none';
      document.getElementById('taucExportCard').style.display='none';
    }
    hist.commit(); // baseline + file add/remove/reorder/palette
  }

  // Energy axis is just 1240/λ — each file stays on its own native grid
  function setupAnalysis(){
    files.forEach(f=>{ f.hv = f.wl.map(wl=>1240/wl); });
    if (currIndex >= files.length) currIndex = files.length-1;
    bestRegsAll = files.map(()=>null);
    if (currIndex < 0) currIndex = 0;
    if (taucPer.length !== files.length) taucPer = files.map((_,i)=>taucPer[i] || {});
    writeStoreToInputs();      // reflect the current sample's params in the inputs
    syncTaucModeButtons();
    document.getElementById('taucWorkspace').style.display='block';
    document.getElementById('taucResults').style.display='block';
    document.getElementById('taucExportCard').style.display='block';
    initTaucPlot();
  }

  // Union of all files' ranges (for shared overlay axes)
  function unionWl(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.wl)); hi=Math.max(hi,maxArr(f.wl)); }); return [lo,hi]; }
  function unionHv(){ let lo=Infinity,hi=-Infinity; files.forEach(f=>{ lo=Math.min(lo,minArr(f.hv)); hi=Math.max(hi,maxArr(f.hv)); }); return [lo,hi]; }

  function initTaucPlot(){
    plot = new Plot(document.getElementById('taucSvg'), {xlabel:'hν (eV)', ylabelSvg:'[F(R)·hν]<tspan baseline-shift="super" font-size="8">a</tspan>', xTickStep:0.5, noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const [hvMin, hvMax] = unionHv();
    if (!isFinite(vlines.v1)){
      vlines.v1 = hvMin + 0.6*(hvMax-hvMin);
      vlines.v2 = hvMin + 0.8*(hvMax-hvMin);
      vlines.v3 = hvMin + 0.2*(hvMax-hvMin);
      vlines.v4 = hvMin + 0.4*(hvMax-hvMin);
    }
    updateTaucView();
  }


  function scanRegr(hv, frArr, a, N, M, x1, x2){
    const Yraw = frArr.map((v,i)=>Math.pow(v*hv[i], a));
    const Ys = movingAverage(Yraw, N);
    const lo = Math.min(x1,x2), hi=Math.max(x1,x2);
    const idxSel = [];
    for (let i=0;i<hv.length;i++) if (hv[i]>=lo && hv[i]<=hi) idxSel.push(i);
    let best = {slope:NaN,intercept:NaN,R2:NaN,RMSE:Infinity,bestIdx:[],varM:NaN,varB:NaN,covMB:NaN};
    if (idxSel.length < M) return best;
    let bestScore = Infinity;
    for (let s=0; s<=idxSel.length-M; s++){
      const block = idxSel.slice(s, s+M);
      const yb = block.map(i=>Ys[i]);
      if (yb.some(v=>!isFinite(v))) continue;
      const xb = block.map(i=>hv[i]);
      const r = fitLinear(xb, yb);
      const score = r.rmse / r.R2;
      if (score < bestScore){
        bestScore = score;
        best = {slope:r.slope, intercept:r.intercept, R2:r.R2, RMSE:r.rmse, bestIdx:block, varM:r.varM, varB:r.varB, covMB:r.covMB};
      }
    }
    return best;
  }

  function analyzeOneFile(hv, frArr, a,N,M,x1,x2,M2,x3,x4){
    const regs = scanRegr(hv, frArr, a, N, M, x1, x2);
    const regs2 = scanRegr(hv, frArr, a, N, M2, x3, x4);
    let Eg=NaN, EgErr=NaN, EgInt=NaN, EgIntErr=NaN;
    if ([regs.slope,regs.intercept,regs2.slope,regs2.intercept].every(isFinite)){
      const xInt = (regs2.intercept - regs.intercept)/(regs.slope - regs2.slope);
      const dxdb1 = -1/(regs.slope-regs2.slope), dxdb2 = 1/(regs.slope-regs2.slope);
      const dxdm1 = (regs2.intercept-regs.intercept)/Math.pow(regs.slope-regs2.slope,2);
      const dxdm2 = -dxdm1;
      const t1 = tinv(0.995, M-2), t2 = tinv(0.995, M2-2);
      const varX = dxdb1*dxdb1*regs.varB*t1*t1 + dxdb2*dxdb2*regs2.varB*t2*t2 +
                   dxdm1*dxdm1*regs.varM*t1*t1 + dxdm2*dxdm2*regs2.varM*t2*t2 +
                   2*dxdb1*dxdm1*regs.covMB*t1*t1 + 2*dxdb2*dxdm2*regs2.covMB*t2*t2;
      EgInt = xInt;
      EgIntErr = varX>0 ? Math.sqrt(varX) : NaN;
    }
    if (regs.slope !== 0 && isFinite(regs.slope)){
      Eg = -regs.intercept/regs.slope;
      if ([regs.varM,regs.varB,regs.covMB].every(isFinite)){
        const varEg = (regs.intercept**2/regs.slope**4)*regs.varM + (1/regs.slope**2)*regs.varB - 2*(regs.intercept/regs.slope**3)*regs.covMB;
        EgErr = varEg>=0 ? Math.sqrt(varEg)*tinv(0.995, M-2) : NaN;
      }
    }
    return {Eg,EgErr,EgInt,EgIntErr,regs,regs2};
  }

  function processAll(){
    bestRegsAll = files.map((f,k)=>{
      const fp = getFileParams(k);
      const r = analyzeOneFile(f.hv, f.FR, fp.a, fp.N, fp.M, vlines.v1, vlines.v2, fp.M2, vlines.v3, vlines.v4);
      return {label:f.label, ...r};
    });
  }

  function updateTaucView(preserveView){
    if (!plot || !files.length) return;
    const p = curParams();
    const hv = files[currIndex].hv, frArr = files[currIndex].FR;
    document.getElementById('taucCurrentLabel').textContent = files[currIndex].label;
    document.getElementById('taucIdx').textContent = (currIndex+1)+'/'+files.length;

    const Yraw = frArr.map((v,i)=>Math.pow(v*hv[i], p.a));
    const Ys = movingAverage(Yraw, p.N);
    let dY = gradientArr(Ys, hv);
    let dYs = movingAverage(dY, p.N2);
    const dmin = minArr(dYs), dmax = maxArr(dYs), ymax = maxArr(Ys);
    dYs = dYs.map(v=> (dmax-dmin)>0 ? (v-dmin)/(dmax-dmin)*ymax : v);

    // Capture current zoom so it can be kept across redraws (the full range
    // set below stays as the "home" reset target)
    const prev = (preserveView && isFinite(plot.xmin)) ? {xmin:plot.xmin, xmax:plot.xmax, ymin:plot.ymin, ymax:plot.ymax} : null;
    plot.setRange(minArr(hv), maxArr(hv), 0, maxArr(Yraw)*1.05);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.clearData();
    plot.ylabelSvg = `[F(R)·hν]<tspan baseline-shift="super" font-size="8">${p.a}</tspan> (a.u.)`;
    plot.drawAxes();
    plot.line(hv, Yraw, '#ffffff', 1);
    plot.line(hv, Ys, '#3aa0ff', 1.4);
    plot.line(hv, dYs, '#5fcf6a', 1);

    const lo1=Math.min(vlines.v1,vlines.v2), hi1=Math.max(vlines.v1,vlines.v2);
    const lo2=Math.min(vlines.v3,vlines.v4), hi2=Math.max(vlines.v3,vlines.v4);
    const sel1 = hv.filter(v=>v>=lo1&&v<=hi1).length;
    const sel2 = hv.filter(v=>v>=lo2&&v<=hi2).length;
    const alertDiv = document.getElementById('taucAlert');
    alertDiv.innerHTML='';

    if (sel1>=p.M){
      const regs = scanRegr(hv, frArr, p.a, p.N, p.M, vlines.v1, vlines.v2);
      document.getElementById('taucRMSE1').textContent = isFinite(regs.RMSE)? regs.RMSE.toExponential(3): '-';
      document.getElementById('taucR21').textContent = isFinite(regs.R2)? regs.R2.toFixed(3): '-';
      if (regs.bestIdx.length){
        const xb = regs.bestIdx.map(i=>hv[i]);
        const yb = xb.map(x=>regs.slope*x+regs.intercept);
        plot.line(xb, yb, '#ff5050', 2.2);
        const xExt = linspace(minArr(hv), maxArr(hv), 100);
        plot.line(xExt, xExt.map(x=>regs.slope*x+regs.intercept), '#ff5050', 1, '5,4');
      }
    } else {
      document.getElementById('taucRMSE1').textContent='-'; document.getElementById('taucR21').textContent='-';
      alertDiv.innerHTML = '<div class="alert warn">⚠ Interval too small: too few points for the regression!</div>';
    }
    if (sel2>=p.M2){
      const regs2 = scanRegr(hv, frArr, p.a, p.N, p.M2, vlines.v3, vlines.v4);
      document.getElementById('taucRMSE2').textContent = isFinite(regs2.RMSE)? regs2.RMSE.toExponential(3): '-';
      document.getElementById('taucR22').textContent = isFinite(regs2.R2)? regs2.R2.toFixed(3): '-';
      if (regs2.bestIdx.length){
        const xb = regs2.bestIdx.map(i=>hv[i]);
        const yb = xb.map(x=>regs2.slope*x+regs2.intercept);
        plot.line(xb, yb, '#d050ff', 2.2);
        const xExt = linspace(minArr(hv), maxArr(hv), 100);
        plot.line(xExt, xExt.map(x=>regs2.slope*x+regs2.intercept), '#d050ff', 1, '5,4');
      }
    } else {
      document.getElementById('taucRMSE2').textContent='-'; document.getElementById('taucR22').textContent='-';
      if (!alertDiv.innerHTML) alertDiv.innerHTML = '<div class="alert warn">⚠ Interval too small: too few points for the regression!</div>';
    }

    const res = analyzeOneFile(hv, frArr, p.a, p.N, p.M, vlines.v1, vlines.v2, p.M2, vlines.v3, vlines.v4);
    document.getElementById('taucEg').textContent = isFinite(res.Eg) ? (isFinite(res.EgErr) ? `${res.Eg.toFixed(3)} ± ${res.EgErr.toFixed(3)} eV` : `${res.Eg.toFixed(3)} eV`) : '-';
    document.getElementById('taucEgInt').textContent = isFinite(res.EgInt) ? (isFinite(res.EgIntErr) ? `${res.EgInt.toFixed(3)} ± ${res.EgIntErr.toFixed(3)} eV` : `${res.EgInt.toFixed(3)} eV`) : '-';

    plot.vline(vlines.v1, '#ff5050', true, v=>{vlines.v1=v; throttledUpdate();}, v=>{vlines.v1=v; updateTaucView(true); hist.commit();});
    plot.vline(vlines.v2, '#ff5050', true, v=>{vlines.v2=v; throttledUpdate();}, v=>{vlines.v2=v; updateTaucView(true); hist.commit();});
    plot.vline(vlines.v3, '#d050ff', true, v=>{vlines.v3=v; throttledUpdate();}, v=>{vlines.v3=v; updateTaucView(true); hist.commit();});
    plot.vline(vlines.v4, '#d050ff', true, v=>{vlines.v4=v; throttledUpdate();}, v=>{vlines.v4=v; updateTaucView(true); hist.commit();});

    updateTaucResults();
  }

  function updateTaucResults(){
    if (!files.length) return;
    processAll();
    renderResView();
    renderEgTable();
  }

  let throttle=null;
  function throttledUpdate(){
    if (throttle) return;
    throttle = requestAnimationFrame(()=>{ throttle=null; updateTaucView(true); });
  }

  // Live param updates — keep the current zoom (except when changing the
  // exponent, which rescales the y-axis, so a full reset is clearer there)
  ['taucA','taucN','taucN2','taucM','taucM2'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('input', ()=>{
      readInputsToStore();  // route the edit to shared or this sample's slot
      if (id==='taucA') document.getElementById('taucNExp').textContent = el.value;
      if(plot) updateTaucView(id!=='taucA');
    });
    // Commit one undo step per completed edit (on change/blur, not each keystroke)
    el.addEventListener('change', ()=>{ if (files.length) hist.commit(); });
  });

  // Per-field shared/per (all/one) toggles for a, N and N2
  Object.entries(TAUC_TOGGLE).forEach(([tid, key])=>{
    document.querySelectorAll('#'+tid+' button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (btn.classList.contains('active')) return;
        document.querySelectorAll('#'+tid+' button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const cur = getFileParams(currIndex)[key];   // value currently shown
        taucMode[key] = btn.dataset.m;
        if (btn.dataset.m==='shared') taucShared[key] = cur;               // "all": adopt shown value everywhere
        else { if (!taucPer[currIndex]) taucPer[currIndex]={}; taucPer[currIndex][key] = cur; } // "one": keep on this sample only
        writeStoreToInputs();
        if (files.length){ if (plot) updateTaucView(true); hist.commit(); }
      });
    });
  });

  document.getElementById('taucPrev').onclick = ()=>{ if (!files.length) return; currIndex=(currIndex-1+files.length)%files.length; writeStoreToInputs(); updateTaucView(); };
  document.getElementById('taucNext').onclick = ()=>{ if (!files.length) return; currIndex=(currIndex+1)%files.length; writeStoreToInputs(); updateTaucView(); };

  function renderEgTable(){
    const wrap = document.getElementById('taucEgTableWrap');
    let html = '<table><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup><thead><tr><th rowspan="2">Sample</th><th colspan="2" style="text-align:center">E<sub>g</sub> (eV)</th></tr><tr><th style="text-align:center">x-axis</th><th style="text-align:center">baseline</th></tr></thead><tbody>';
    bestRegsAll.forEach(r=>{
      const egNeg = isFinite(r.Eg) && r.Eg < 0;
      const egiNeg = isFinite(r.EgInt) && r.EgInt < 0;
      const eg = isFinite(r.Eg)
        ? (egNeg
            ? `<span style="color:var(--warn)">⚠ ${r.Eg.toFixed(3)}</span>`
            : (isFinite(r.EgErr) ? `${r.Eg.toFixed(3)} ± ${r.EgErr.toFixed(3)}` : r.Eg.toFixed(3)))
        : '—';
      const egi = isFinite(r.EgInt)
        ? (egiNeg
            ? `<span style="color:var(--warn)">⚠ ${r.EgInt.toFixed(3)}</span>`
            : (isFinite(r.EgIntErr) ? `${r.EgInt.toFixed(3)} ± ${r.EgIntErr.toFixed(3)}` : r.EgInt.toFixed(3)))
        : '—';
      html += `<tr><td>${r.label}</td><td>${eg}</td><td>${egi}</td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function renderResView(){
    // Effective exponent per file; when uniform, show it on the shared Tauc axis,
    // otherwise fall back to a generic "a" (samples may use different exponents).
    const aVals = files.map((f,k)=>getFileParams(k).a);
    const aUniform = aVals.every(v=>v===aVals[0]);
    const aLabel = aUniform ? aVals[0] : 'a';
    // Plot 0: F(R) vs λ
    const plot0 = new Plot(document.getElementById('taucResSvg0'), {xlabel:'Wavelength (nm)', ylabel:'F(R) (a.u.)', xTickStep:50, noYTickLabels:true});
    const leg0 = document.getElementById('taucResLegend0'); leg0.innerHTML='';
    let ymax0=-Infinity;
    files.forEach((f,k)=>{ ymax0=Math.max(ymax0,maxArr(f.FR)); });
    const [wl0, wl1] = unionWl();
    plot0.setRange(wl0, wl1, 0, ymax0);
    plot0.drawAxes();
    files.forEach((f,k)=>{
      plot0.line(f.wl, f.FR, f.color, 1.3);
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg0.appendChild(s);
    });
    plot0.attachTools(plot0.svg.closest('.plot-wrap'));

    // Plot 1: Tauc + regressions
    const plot1 = new Plot(document.getElementById('taucResSvg1'), {xlabel:'Energy (eV)', ylabelSvg:`[F(R)·hν]<tspan baseline-shift="super" font-size="8">${aLabel}</tspan> (a.u.)`, xTickStep:0.5, noYTickLabels:true});
    const leg1 = document.getElementById('taucResLegend1'); leg1.innerHTML='';
    const Ys_all = files.map((f,k)=>{
      const fp = getFileParams(k);
      const Yraw = f.FR.map((v,i)=>Math.pow(v*f.hv[i], fp.a));
      return movingAverage(Yraw, fp.N);
    });
    const ymax1 = Math.max(...Ys_all.map(maxArr));
    const [hv0, hv1] = unionHv();
    plot1.setRange(hv0, hv1, 0, ymax1);
    plot1.drawAxes();
    files.forEach((f,k)=>{
      plot1.line(f.hv, Ys_all[k], f.color, 1.1);
      const r = bestRegsAll[k];
      if (r && isFinite(r.regs.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs.slope*x+r.regs.intercept), f.color, 1, '5,4');
      }
      if (r && isFinite(r.regs2.slope)){
        const xExt = linspace(hv0, hv1, 100);
        plot1.line(xExt, xExt.map(x=>r.regs2.slope*x+r.regs2.intercept), f.color, 1, '2,3');
      }
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${f.color}"></i>${f.label}`; leg1.appendChild(s);
    });
    plot1.attachTools(plot1.svg.closest('.plot-wrap'));

    // Plot 2: Eg bar chart
    const barTitleEl = document.getElementById('taucBarTitle');
    if (barTitleEl) barTitleEl.textContent = (aUniform ? (aVals[0]===2 ? 'Direct ' : 'Indirect ') : '') + 'Energy Band Gap';
    const leg2 = document.getElementById('taucResLegend2'); leg2.innerHTML='';
    const barAlertDiv = document.getElementById('taucBarAlert'); barAlertDiv.innerHTML='';
    const egs = bestRegsAll.map(r=>r.Eg), egErrs = bestRegsAll.map(r=>r.EgErr);
    const egInts = bestRegsAll.map(r=>r.EgInt), egIntErrs = bestRegsAll.map(r=>r.EgIntErr);
    const n = files.length;
    // Collect negative Eg warnings
    const negWarns = [];
    for (let k=0;k<n;k++){
      if (isFinite(egs[k]) && egs[k]<0) negWarns.push(`⚠ Eg (x-axis) is negative for "${files[k].label}"!`);
      if (isFinite(egInts[k]) && egInts[k]<0) negWarns.push(`⚠ Eg (baseline) is negative for "${files[k].label}"!`);
    }
    const posVals = egs.concat(egInts).filter(v=>isFinite(v)&&v>0);
    const noChart = !posVals.length;
    if (negWarns.length) barAlertDiv.innerHTML = negWarns.map((w,i)=>`<div class="alert warn"${noChart&&!i?' style="margin-top:0"':''}>${w}</div>`).join('');
    const barSvg = document.getElementById('taucResSvg2');
    const barWrap = barSvg.closest('.plot-wrap');
    if (noChart){
      barSvg.style.display='none'; barWrap.style.display='none';
    } else {
      barSvg.style.display=''; barWrap.style.display='';
      const plot2 = new Plot(barSvg, {xlabel:'', ylabelSvg:`${egLabel} Band Gap E<tspan baseline-shift="sub" font-size="8">g</tspan> (eV)`, noXTickLabels:true});
      const ymax2 = Math.max(...posVals)*1.3;
      plot2.setRange(0, n+1, 0, ymax2||1);
      plot2.drawAxes();
      for (let k=0;k<n;k++){
        const xc = k+1;
        if (isFinite(egs[k])&&egs[k]>0){
          const x0=xc-0.18, x1=xc-0.02;
          drawBar(plot2,x0,x1,egs[k],'#3aa0ff');
          if (isFinite(egErrs[k])) drawErrBar(plot2,(x0+x1)/2,egs[k],egErrs[k]);
        }
        if (isFinite(egInts[k])&&egInts[k]>0){
          const x0=xc+0.02, x1=xc+0.18;
          drawBar(plot2,x0,x1,egInts[k],'#ff7a59');
          if (isFinite(egIntErrs[k])) drawErrBar(plot2,(x0+x1)/2,egInts[k],egIntErrs[k]);
        }
        plot2.tickLabel(xc, files[k].label);
      }
      plot2.attachTools(barSvg.closest('.plot-wrap'));
      leg2.innerHTML=`<span><i class="mk-box" style="background:#3aa0ff"></i>Eg (x-axis)</span><span><i class="mk-box" style="background:#ff7a59"></i>Eg (baseline)</span>`;
    }
    // Align the table panel with the first visible content in the left col
    const _leftCol = barSvg.closest('.col');
    const _rightCol = _leftCol && _leftCol.nextElementSibling;
    if (_rightCol) requestAnimationFrame(()=>{
      const rowTop = _leftCol.parentElement.getBoundingClientRect().top;
      let targetTop = rowTop;
      for (const child of _leftCol.children){
        const r = child.getBoundingClientRect();
        if (r.height > 0){ targetTop = r.top; break; }
      }
      _rightCol.style.marginTop = Math.max(0, Math.round(targetTop - rowTop)) + 'px';
    });
  }
  function drawBar(plot, x0, x1, val, color){ plot.bar(x0, x1, 0, val, color); }
  function drawErrBar(plot, xc, val, err){ plot.errbar(xc, val, err); }

  // Assemble a "wide" CSV: each column is {h:header, v:[values]}, padded to the
  // longest so every sample keeps its own independent columns (no shared axis).
  function wideCsv(cols){
    const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
    let t = csvLine(cols.map(c=>c.h));
    for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
    return t;
  }
  function exportTaucZip(){
    if (!files.length) return;
    const entries = [];
    // reflectance_FR.csv — (wavelength, F(R)) per sample
    {
      const cols=[];
      files.forEach(f=>{
        cols.push({h:'wavelength_nm_'+f.label, v:f.wl.map(x=>fmtNum(x,6))});
        cols.push({h:f.label,                  v:f.FR.map(x=>fmtNum(x,6))});
      });
      entries.push({name:'reflectance_FR.csv', text:wideCsv(cols)});
    }
    // tauc_plot.csv — per sample: energy, [F(R)·hν]^a, linear-region regression,
    // baseline regression (both evaluated on the sample's own energy grid)
    {
      const cols=[];
      files.forEach((f,k)=>{
        const r = bestRegsAll[k];
        cols.push({h:'energy_eV_'+f.label,       v:f.hv.map(x=>fmtNum(x,6))});
        cols.push({h:f.label,                    v:f.hv.map((hv,i)=>fmtNum(Math.pow(f.FR[i]*hv, getFileParams(k).a),6))});
        cols.push({h:f.label+'_reg_linear',      v:f.hv.map(hv=> (r&&r.regs)  ? fmtNum(r.regs.slope*hv  + r.regs.intercept, 6)  : '')});
        cols.push({h:f.label+'_reg_baseline',    v:f.hv.map(hv=> (r&&r.regs2) ? fmtNum(r.regs2.slope*hv + r.regs2.intercept, 6) : '')});
      });
      entries.push({name:'tauc_plot.csv', text:wideCsv(cols)});
    }
    // Eg.csv — bar-plot-like summary (one row per sample), both Eg estimates + errors
    {
      let t = csvLine(['Sample','Eg','Eg_err','Eg_baseline','Eg_baseline_err']);
      files.forEach((f,k)=>{
        const r = bestRegsAll[k];
        t += csvLine([f.label,
          r?fmtNum(r.Eg,6):'', r?fmtNum(r.EgErr,6):'', r?fmtNum(r.EgInt,6):'', r?fmtNum(r.EgIntErr,6):'']);
      });
      entries.push({name:'Eg.csv', text:t});
    }
    downloadZip('tauc_export.zip', entries);
  }
  registerCsvExport('tauc', exportTaucZip);
})();

