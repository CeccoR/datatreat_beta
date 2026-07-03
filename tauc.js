import { fmtNum, csvLine, downloadBlob, makeDownloadLink, setupDropzone, renderUnifiedFileList, linspace, movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, buildAlertsHtml, nextColor, setTabLoaded, registerHistory } from './utils.js';
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
  // per-upload invalid names (files that were skipped); persists until all files are removed
  let invalidUploadNames = [];
  let taucUploadAlerts = '';
  let taucWarnDismissed = false;

  window.dismissTaucInvalid = function(){ invalidUploadNames=[]; rebuildTaucAlerts(); };
  window.dismissTaucWarn    = function(){ taucWarnDismissed=true; rebuildTaucAlerts(); };
  window.dismissTaucUpload  = function(){ taucUploadAlerts=''; rebuildTaucAlerts(); };

  function rebuildTaucAlerts(){
    const warnNames = taucWarnDismissed ? [] : files.filter(f=>f.warn).map(f=>f.name);
    document.getElementById('taucAlerts').innerHTML =
      buildAlertsHtml(invalidUploadNames, warnNames, undefined, 'dismissTaucInvalid()', 'dismissTaucWarn()') + taucUploadAlerts;
  }

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1);
        if (!files.length) invalidUploadNames = [];
        rebuildTaucAlerts();
        afterFilesChange();
      },
      onMoveUp(i){ if(i>0){[files[i-1],files[i]]=[files[i],files[i-1]]; rebuildTaucAlerts(); afterFilesChange();} },
      onMoveDown(i){ if(i<files.length-1){[files[i],files[i+1]]=[files[i+1],files[i]]; rebuildTaucAlerts(); afterFilesChange();} },
      onLabelChange(i, v){ files[i].label=v; updateTaucResults(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; updateTaucResults(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; invalidUploadNames=[]; taucUploadAlerts=''; taucWarnDismissed=false; vlines={}; rebuildTaucAlerts(); afterFilesChange(); },
    };
  }

  /* ---- Undo/redo: snapshot the reversible state (file order/labels/colors,
     the draggable line positions and the analysis parameters). Raw spectra
     arrays are shared by reference; only metadata is cloned. ---- */
  const TAUC_PARAM_IDS = ['taucA','taucN','taucN2','taucM','taucM2'];
  function taucSnapshot(){
    return {
      files: files.map(f=>({...f})),
      vlines: {...vlines},
      params: TAUC_PARAM_IDS.reduce((o,id)=>{ o[id]=document.getElementById(id).value; return o; }, {}),
    };
  }
  function taucRestore(s){
    files = s.files.map(f=>({...f}));
    vlines = {...s.vlines};
    for (const id of TAUC_PARAM_IDS) document.getElementById(id).value = s.params[id];
    document.getElementById('taucNExp').textContent = document.getElementById('taucA').value;
    afterFilesChange();
  }
  const hist = registerHistory('tauc', taucSnapshot, taucRestore);

  setupDropzone('taucDropzone', 'taucFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const newInvalid = [];
    const alreadyLoaded = [];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
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
      if (wl.length) files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), wl, FR:fr, warn, color:nextColor(files)});
    }
    invalidUploadNames = newInvalid;
    taucWarnDismissed = false;
    taucUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissTaucUpload()') : '';
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

  function curParams(){
    return {
      a: parseFloat(document.getElementById('taucA').value),
      N: Math.max(1, Math.round(+document.getElementById('taucN').value||1)),
      N2: Math.max(1, Math.round(+document.getElementById('taucN2').value||1)),
      M: Math.max(2, Math.round(+document.getElementById('taucM').value||2)),
      M2: Math.max(2, Math.round(+document.getElementById('taucM2').value||2)),
    };
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

  function processAll(p){
    bestRegsAll = files.map((f,k)=>{
      const r = analyzeOneFile(f.hv, f.FR, p.a, p.N, p.M, vlines.v1, vlines.v2, p.M2, vlines.v3, vlines.v4);
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
    const p = curParams();
    processAll(p);
    renderResView(p);
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
      if (id==='taucA') document.getElementById('taucNExp').textContent = el.value;
      if(plot) updateTaucView(id!=='taucA');
    });
    // Commit one undo step per completed edit (on change/blur, not each keystroke)
    el.addEventListener('change', ()=>{ if (files.length) hist.commit(); });
  });

  document.getElementById('taucPrev').onclick = ()=>{ if (!files.length) return; currIndex=(currIndex-1+files.length)%files.length; updateTaucView(); };
  document.getElementById('taucNext').onclick = ()=>{ if (!files.length) return; currIndex=(currIndex+1)%files.length; updateTaucView(); };
  window._taucRedraw = ()=>{ if (plot && files.length) updateTaucView(true); };

  function renderEgTable(){
    const wrap = document.getElementById('taucEgTableWrap');
    let html = '<table><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup><thead><tr><th rowspan="2">Label</th><th colspan="2" style="text-align:center">E<sub>g</sub> (eV)</th></tr><tr><th style="text-align:center">x-axis</th><th style="text-align:center">baseline</th></tr></thead><tbody>';
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

  function renderResView(p){
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
    const plot1 = new Plot(document.getElementById('taucResSvg1'), {xlabel:'Energy (eV)', ylabelSvg:`[F(R)·hν]<tspan baseline-shift="super" font-size="8">${p.a}</tspan> (a.u.)`, xTickStep:0.5, noYTickLabels:true});
    const leg1 = document.getElementById('taucResLegend1'); leg1.innerHTML='';
    const Ys_all = files.map((f,k)=>{
      const Yraw = f.FR.map((v,i)=>Math.pow(v*f.hv[i], p.a));
      return movingAverage(Yraw, p.N);
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
    const aVal = document.getElementById('taucA').value;
    const egLabel = aVal === '2' ? 'Direct' : 'Indirect';
    const barTitleEl = document.getElementById('taucBarTitle');
    if (barTitleEl) barTitleEl.textContent = egLabel + ' Energy Band Gap';
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

  document.getElementById('taucExportBtn').onclick = ()=>{
    const p = curParams();
    const wrap = document.getElementById('taucDownloads'); wrap.innerHTML='';
    const maxLen = Math.max(...files.map(f=>f.wl.length));
    // FR.csv — one (wavelength, F(R)) column pair per sample (native axes)
    let h1=[]; files.forEach(f=>h1.push('wavelength_nm_'+f.label, f.label));
    let t1 = csvLine(h1);
    for (let i=0;i<maxLen;i++){
      const row=[];
      files.forEach(f=>{ if (i<f.wl.length) row.push(fmtNum(f.wl[i],6), fmtNum(f.FR[i],6)); else row.push('',''); });
      t1 += csvLine(row);
    }
    downloadBlob('FR.csv', t1);
    makeDownloadLink(wrap, 'FR.csv', t1, 'FR.csv');
    // FRhva.csv — one (energy, [F(R)·hν]^a) column pair per sample
    let h2=[]; files.forEach(f=>h2.push('energy_eV_'+f.label, f.label));
    let t2 = csvLine(h2);
    for (let i=0;i<maxLen;i++){
      const row=[];
      files.forEach(f=>{ if (i<f.hv.length) row.push(fmtNum(f.hv[i],6), fmtNum(Math.pow(f.FR[i]*f.hv[i], p.a),6)); else row.push('',''); });
      t2 += csvLine(row);
    }
    downloadBlob('FRhva.csv', t2);
    makeDownloadLink(wrap, 'FRhva.csv', t2, 'FRhva.csv');
    // regressions.csv
    let t3 = csvLine(['Label','m1','Var_m1','m2','Var_m2','q1','Var_q1','q2','Var_q2','Cov_mq1','Cov_mq2']);
    bestRegsAll.forEach(r=>{
      t3 += csvLine([r.label, fmtNum(r.regs.slope,8), fmtNum(r.regs.varM,8), fmtNum(r.regs2.slope,8), fmtNum(r.regs2.varM,8), fmtNum(r.regs.intercept,8), fmtNum(r.regs.varB,8), fmtNum(r.regs2.intercept,8), fmtNum(r.regs2.varB,8), fmtNum(r.regs.covMB,8), fmtNum(r.regs2.covMB,8)]);
    });
    downloadBlob('regressions.csv', t3);
    makeDownloadLink(wrap, 'regressions.csv', t3, 'regressions.csv');
    // Eg_values.csv
    let t4 = csvLine(['Label','Eg','Eg_err','Eg_int','Eg_int_err']);
    bestRegsAll.forEach(r=>{ t4 += csvLine([r.label, fmtNum(r.Eg,6), fmtNum(r.EgErr,6), fmtNum(r.EgInt,6), fmtNum(r.EgIntErr,6)]); });
    downloadBlob('Eg_values.csv', t4);
    makeDownloadLink(wrap, 'Eg_values.csv', t4, 'Eg_values.csv');
  };
})();

