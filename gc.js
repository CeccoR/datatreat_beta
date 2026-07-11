import { fmtNum, csvLine, downloadZip, splitCSVLine, setupDropzone, renderUnifiedFileList, cumtrapz, maxArr, minArr, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   GC MODULE
========================================================= */
(function(){
  let files=[]; // {name, label, injDates:[Date], h2:[number]}
  let ms=[], Qs=[], lightOnDates=[];
  let dataTables=[];
  let plot1, plot2;
  let plateauStart=0, plateauEnd=24;
  let costResults=[];
  let loadAlerts='';
  let gcUploadAlerts='';

  function rebuildGcAlerts(){ document.getElementById('gcAlerts').innerHTML = loadAlerts + gcUploadAlerts; }

  window.dismissGcInvalid = function(){ loadAlerts=''; rebuildGcAlerts(); };
  window.dismissGcUpload  = function(){ gcUploadAlerts=''; rebuildGcAlerts(); };

  function parseGCDate(str){
    const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let [_, mo, da, yr, hh, mi, se, ap] = m;
    hh = +hh; if (/pm/i.test(ap) && hh<12) hh+=12; if (/am/i.test(ap) && hh===12) hh=0;
    return new Date(+yr, +mo-1, +da, hh, +mi, +se);
  }

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1); ms.splice(i,1); Qs.splice(i,1); lightOnDates.splice(i,1);
        if (!files.length) loadAlerts = '';
        afterFilesChange();
      },
      onReorder(from, to){ [files,ms,Qs,lightOnDates].forEach(a=>{ const [x]=a.splice(from,1); a.splice(to,0,x); }); afterFilesChange(); },
      onLabelChange(i, v){ files[i].label=v; renderGcParamTable(); computeAndRenderGc(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; computeAndRenderGc(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; ms.length=0; Qs.length=0; lightOnDates.length=0; loadAlerts=''; gcUploadAlerts=''; rebuildGcAlerts(); afterFilesChange(); },
    };
  }

  setupDropzone('gcDropzone', 'gcFiles', async (fileList)=>{
    const existing = new Set(files.map(f=>f.name));
    const invalidFiles=[];
    const alreadyLoaded=[];
    for (const f of fileList){
      if (existing.has(f.name)){ alreadyLoaded.push(f.name); continue; }
      existing.add(f.name);
      // f.text() auto-detects the encoding (incl. UTF-16 via BOM, as some GC
      // instruments export); rawBytes keeps the original for byte-exact re-download.
      const rawBytes = new Uint8Array(await f.arrayBuffer());
      const text = await f.text();
      const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
      if (!lines.length){ invalidFiles.push(f.name); continue; }
      const delim = lines[0].includes(';') ? ';' : (lines[0].includes(',')? ',' : '\t');
      const header = splitCSVLine(lines[0], delim);
      const idxDate = header.findIndex(h=>h.toLowerCase().includes('injection date'));
      const idxH2   = header.findIndex(h=>{ const lo=h.toLowerCase(); return lo.includes('h2') && lo.includes('%mol'); });
      if (idxDate<0 || idxH2<0){ invalidFiles.push(f.name); continue; }
      const injDates=[], h2=[];
      for (let i=1;i<lines.length;i++){
        const parts = splitCSVLine(lines[i], delim);
        const d = parseGCDate(parts[idxDate]||'');
        const v = parseFloat((parts[idxH2]||'').replace(',','.'));
        if (d && isFinite(v)){ injDates.push(d); h2.push(v); }
      }
      if (!injDates.length){ invalidFiles.push(f.name); continue; }
      const sorted = injDates.slice().sort((a,b)=>a-b);
      files.push({name:f.name, label:f.name.replace(/\.[^.]+$/,''), injDates, h2, color:nextColor(files), rawBytes});
      ms.push(15); Qs.push(2);
      lightOnDates.push(new Date(sorted[0]));
    }
    loadAlerts = buildAlertsHtml(invalidFiles, [], undefined, 'dismissGcInvalid()');
    gcUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'dismissGcUpload()') : '';
    rebuildGcAlerts();
    afterFilesChange();
  });

  function toLocalInputValue(d){
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function afterFilesChange(){
    setTabLoaded('gc', files.length);
    renderUnifiedFileList('gcFileTableWrap', files, fileCallbacks());
    renderGcParamTable();
    if (files.length){
      document.getElementById('gcResults').style.display='block';
      document.getElementById('gcExportCard').style.display='block';
      computeAndRenderGc();
    } else {
      document.getElementById('gcResults').style.display='none';
      document.getElementById('gcResultsBar').style.display='none';
      document.getElementById('gcExportCard').style.display='none';
      rebuildGcAlerts();
    }
    hist.commit();
  }

  /* ---- Undo/redo: file order/labels/colours, per-sample m/Q/light-on and the
     integration interval. Injection data arrays are shared by reference. ---- */
  function gcSnapshot(){
    return {
      files: files.map(f=>({...f})),
      ms: ms.slice(), Qs: Qs.slice(),
      lightOnDates: lightOnDates.map(d=> d ? d.getTime() : null),
      plateauStart, plateauEnd,
    };
  }
  function gcRestore(s){
    files = s.files.map(f=>({...f}));
    ms = s.ms.slice(); Qs = s.Qs.slice();
    lightOnDates = s.lightOnDates.map(t=> t!=null ? new Date(t) : null);
    plateauStart = s.plateauStart; plateauEnd = s.plateauEnd;
    document.getElementById('gcPlateauStart').value = plateauStart;
    document.getElementById('gcPlateauEnd').value = plateauEnd;
    afterFilesChange();
  }
  const hist = registerHistory('gc', gcSnapshot, gcRestore);
  registerTabRedraw('gc', ()=>{ if (files.length) computeAndRenderGc(); });

  // Warning when a sample's light-on time is before (or at) its first injection
  function lightOnWarn(i){
    const f = files[i], lo = lightOnDates[i];
    if (!f || !lo || isNaN(+lo)) return false;
    return !f.injDates.some(d => d < lo);
  }
  function lightOnWarnHtml(i){
    return lightOnWarn(i)
      ? '<div class="alert warn" style="margin:0;padding:6px 8px;font-size:11px">⚠ Light-on time is before first injection</div>'
      : '';
  }

  function renderGcParamTable(){
    const wrap = document.getElementById('gcParamTableWrap');
    if (!files.length){ wrap.innerHTML=''; return; }
    // Columns: Label 40%, m 10%, Q 10%, date 20%, warning 20%
    const cg = `<colgroup><col style="width:40%"><col style="width:10%"><col style="width:10%"><col style="width:20%"><col style="width:20%"></colgroup>`;
    let html = `<div class="table-wrap-box"><table>${cg}<thead><tr><th>Sample</th><th>m (g)</th><th>Q (mL/min)</th><th>Light-on date/time</th><th></th></tr></thead><tbody>`;
    files.forEach((f,i)=>{
      html += `<tr>
        <td class="fname" title="${f.label}">${f.label}</td>
        <td><input data-i="${i}" class="gcM" type="number" min="0.001" step="0.1" value="${ms[i]}" style="width:100%"></td>
        <td><input data-i="${i}" class="gcQ" type="number" min="0.001" step="0.1" value="${Qs[i]}" style="width:100%"></td>
        <td><div class="date-input-wrap"><input data-i="${i}" class="gcDate" type="datetime-local" value="${toLocalInputValue(lightOnDates[i])}" style="width:100%"><button class="date-pick-btn" tabindex="-1" aria-label="Open calendar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2.5"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg></button></div></td>
        <td class="gc-warn-cell">${lightOnWarnHtml(i)}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    wrap.innerHTML = html;
    const commit = ()=>{ if (files.length) hist.commit(); };
    wrap.querySelectorAll('.gcM').forEach(inp=>{
      inp.addEventListener('input', e=>{ const v=+e.target.value; if (v>=0.001) ms[+e.target.dataset.i]=v; computeAndRenderGc(); });
      inp.addEventListener('change', commit);
    });
    wrap.querySelectorAll('.gcQ').forEach(inp=>{
      inp.addEventListener('input', e=>{ const v=+e.target.value; if (v>=0.001) Qs[+e.target.dataset.i]=v; computeAndRenderGc(); });
      inp.addEventListener('change', commit);
    });
    wrap.querySelectorAll('.gcDate').forEach(inp=>{
      inp.addEventListener('input', e=>{
        const i = +e.target.dataset.i;
        lightOnDates[i] = new Date(e.target.value);
        const cell = e.target.closest('tr').querySelector('.gc-warn-cell');
        if (cell) cell.innerHTML = lightOnWarnHtml(i); // update warning live without re-rendering the input
        computeAndRenderGc();
      });
      inp.addEventListener('change', commit);
    });
    wrap.querySelectorAll('.date-pick-btn').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        const inp = btn.closest('.date-input-wrap').querySelector('.gcDate');
        if (document.activeElement === inp){ inp.blur(); }
        else { inp.focus(); inp.showPicker?.(); }
      });
    });
  }

  ['gcPlateauStart','gcPlateauEnd'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('input', ()=>{
      plateauStart = +document.getElementById('gcPlateauStart').value;
      plateauEnd   = +document.getElementById('gcPlateauEnd').value;
      if (dataTables.length) updateRegression();
    });
    el.addEventListener('change', ()=>{ if (files.length) hist.commit(); });
  });

  function computeAndRenderGc(){
    if (!files.length) return;
    plateauStart = +document.getElementById('gcPlateauStart').value;
    plateauEnd   = +document.getElementById('gcPlateauEnd').value;
    dataTables = files.map((f,h)=>{
      const pairs = f.injDates.map((d,i)=>({d, v:f.h2[i]})).sort((a,b)=>a.d-b.d);
      const lightOn = lightOnDates[h];
      let idxBefore = -1;
      for (let i=0;i<pairs.length;i++) if (pairs[i].d < lightOn) idxBefore = i;
      let h2New;
      if (idxBefore<0){ h2New=0; } else h2New = pairs[idxBefore].v;
      pairs.push({d: lightOn, v: h2New});
      pairs.sort((a,b)=>a.d-b.d);
      const tHours = pairs.map(p=>(p.d - lightOn)/3600000);
      const h2pct = pairs.map(p=>p.v);
      const F = Qs[h]/1000*60/22.41396954;
      const h2F = h2pct.map(v=> v/100*F*1e6);
      const h2Fm = h2F.map(v=> v/ms[h]);
      const h2FmInt = cumtrapz(tHours, h2Fm);
      return {t:tHours, h2pct, h2F, h2Fm, h2FmInt, label:f.label, color:f.color};
    });
    document.getElementById('gcAlerts').innerHTML = loadAlerts + gcUploadAlerts;
    renderGcPlots();
  }

  function renderGcPlots(){
    const legend = document.getElementById('gcLegend'); legend.innerHTML='';
    let allT = dataTables.flatMap(d=>d.t);
    const tmin = Math.min(0, minArr(allT)), tmax = maxArr(allT);

    plot1 = new Plot(document.getElementById('gcSvg1'), {xlabel:'Time (h)', ylabel:'H₂ Rate (mmol/h/g)'});
    let ymax1 = Math.max(...dataTables.map(d=>maxArr(d.h2Fm))), ymin1 = Math.min(...dataTables.map(d=>minArr(d.h2Fm)));
    plot1.setRange(tmin, tmax, ymin1, ymax1*1.05);
    plot1.drawAxes();
    dataTables.forEach((d,k)=>{
      plot1.line(d.t, d.h2Fm, d.color, 1.3);
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${d.color}"></i>${d.label}`; legend.appendChild(s);
    });
    plot1.attachTools(plot1.svg.closest('.plot-wrap'));

    plot2 = new Plot(document.getElementById('gcSvg2'), {xlabel:'Time (h)', ylabel:'Cumulative H₂ (mmol/g)'});
    let ymax2 = Math.max(...dataTables.map(d=>maxArr(d.h2FmInt)));
    plot2.setRange(tmin, tmax, 0, ymax2*1.05);  // tmin already ≤ 0
    plot2.drawAxes();
    dataTables.forEach(d=> plot2.line(d.t, d.h2FmInt, d.color, 1.3));
    plot2.attachTools(plot2.svg.closest('.plot-wrap'));

    updateRegression();
  }

  function drawGcVlines(){
    [plot1, plot2].forEach(p=>{
      if (!p) return;
      p.clearOverlay();
      p.vline(plateauStart, '#fff', false);
      p.vline(plateauEnd,   '#fff', false);
    });
  }

  window._gcRedraw = ()=>{ if (dataTables.length) renderGcPlots(); };

  function updateRegression(){
    const xStart = Math.min(plateauStart, plateauEnd);
    const xEnd   = Math.max(plateauStart, plateauEnd);
    costResults = dataTables.map(d=>{
      // Find first index with t >= xStart and last index with t <= xEnd
      let startIdx = -1, endIdx = -1;
      for (let i=0;i<d.t.length;i++){
        if (d.t[i] >= xStart && startIdx < 0) startIdx = i;
        if (d.t[i] <= xEnd) endIdx = i;
      }
      if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) return {label:d.label, cost:NaN, dt:NaN};
      const dt = d.t[endIdx] - d.t[startIdx];
      if (dt === 0) return {label:d.label, cost:NaN, dt:NaN};
      const rate = (d.h2FmInt[endIdx] - d.h2FmInt[startIdx]) / dt;
      return {label:d.label, cost:rate, dt};
    });
    // Redraw data lines then overlay vlines
    plot1.clearData(); dataTables.forEach(d=> plot1.line(d.t, d.h2Fm, d.color, 1.3));
    plot2.clearData(); dataTables.forEach(d=> plot2.line(d.t, d.h2FmInt, d.color, 1.3));
    drawGcVlines();
    renderPlateauTable();
    drawBarChart();
  }

  function renderPlateauTable(){
    const wrap = document.getElementById('gcPlateauTableWrap');
    let html = '<table><thead><tr><th>Sample</th><th>Mean integral rate (mmol/h/g)</th></tr></thead><tbody>';
    costResults.forEach(c=> html += `<tr><td>${c.label}</td><td>${isFinite(c.cost)?c.cost.toFixed(4):'-'}</td></tr>`);
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function drawBarChart(){
    const barCard = document.getElementById('gcResultsBar');
    const finite = costResults.filter(c=>isFinite(c.cost));
    if (!finite.length){ barCard.style.display='none'; return; }
    barCard.style.display='block';
    const svg = document.getElementById('gcSvgBar');
    // Bottom margin adapts to the longest (30°-tilted) label so names fit without
    // changing the chart's footprint — the data area shrinks instead.
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '10px -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    let maxLbl = 0;
    costResults.forEach(c=>{ if (isFinite(c.cost)) maxLbl = Math.max(maxLbl, mctx.measureText(c.label).width); });
    const svgH = svg.getBoundingClientRect().height || 640;
    const bottom = Math.min(Math.round(svgH*0.5), Math.round(26 + maxLbl*Math.sin(Math.PI/6)));
    const barPlot = new Plot(svg, {xlabel:'', ylabel:'H₂ Rate (mmol/h/g)', noXTickLabels:true, margin:{l:55,r:20,t:15,b:bottom}});
    const ymax = Math.max(...finite.map(c=>c.cost))*1.2;
    barPlot.setRange(0, costResults.length+1, 0, ymax||1);
    barPlot.drawAxes();
    costResults.forEach((c,k)=>{
      if (!isFinite(c.cost)) return;
      barPlot.bar(k+1-0.16, k+1+0.16, 0, c.cost, dataTables[k].color);
      barPlot.tickLabel(k+1, c.label, 30);
    });
    barPlot.attachTools(svg.closest('.plot-wrap'));
  }

  function exportGcZip(){
    if (!dataTables.length) return;
    const entries = [];
    // gc_timeseries.csv — each sample keeps its own independent columns (own time axis)
    const cols=[];
    dataTables.forEach(d=>{
      cols.push({h:'Time_h_'+d.label,        v:d.t.map(x=>fmtNum(x,5))});
      cols.push({h:'H2_molpct_'+d.label,     v:d.h2pct.map(x=>fmtNum(x,5))});
      cols.push({h:'H2_umol_h_'+d.label,     v:d.h2F.map(x=>fmtNum(x,5))});
      cols.push({h:'H2_mmol_h_g_'+d.label,   v:d.h2Fm.map(x=>fmtNum(x,5))});
      cols.push({h:'H2_cumulative_'+d.label, v:d.h2FmInt.map(x=>fmtNum(x,5))});
    });
    const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
    let t = csvLine(cols.map(c=>c.h));
    for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
    entries.push({name:'gc_timeseries.csv', text:t});
    // h2_rates.csv — bar-plot-like summary (one row per sample)
    let t2 = csvLine(['Sample','Mean integral rate (mmol/h/g)','Interval duration (h)']);
    costResults.forEach(c=> t2 += csvLine([c.label, fmtNum(c.cost,6), fmtNum(c.dt,4)]));
    entries.push({name:'h2_rates.csv', text:t2});
    downloadZip('gc_export.zip', entries);
  }
  registerCsvExport('gc', exportGcZip);
})();

