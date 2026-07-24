import { fmtNum, csvLine, downloadZip, splitCSVLine, setupDropzone, renderUnifiedFileList, cumtrapz, maxArr, minArr, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, createDateTimeField, flashFieldInvalid, guardNumericInput, fitCsvIcons, truncTiltLabel, barPlotXPad } from './utils.js';
import { Plot, svgEl } from './plot.js';

/* =========================================================
   GC MODULE
========================================================= */
(function(){
  let files=[]; // {name, label, injDates:[Date], h2:[number]}
  let ms=[], Qs=[], startArr=[], endArr=[], lightOnDates=[];
  let dataTables=[];
  let plot1, plot2;
  // all/one per parameter: 'all' = one shared value for every sample; 'one' = per-sample.
  // Each of m, Q, start and end toggles independently. Default: everything shared ('all').
  let mMode='all', qMode='all', startMode='all', endMode='all';
  let mShared=15, qShared=2, startShared=0, endShared=24;
  let costResults=[];
  let gcSel=null, gcHov=null;   // selected / hovered sample index (interval interaction)
  let loadAlerts='';
  let gcUploadAlerts='';
  // Outgoing plot view captured before a resize/tab-switch redraw recreates the plots,
  // so drawGcData can restore the current zoom instead of snapping to the full range.
  let _gcPrev1=null, _gcPrev2=null;

  // Effective per-sample values (respect each parameter's all/one mode).
  const mOf     = k => mMode==='all'     ? mShared     : ms[k];
  const qOf     = k => qMode==='all'     ? qShared     : Qs[k];
  const startOf = k => startMode==='all' ? startShared : startArr[k];
  const endOf   = k => endMode==='all'   ? endShared   : endArr[k];
  // The plot shows per-sample interval lines (interactive) whenever either bound is per-sample.
  const intPerSample = () => startMode==='one' || endMode==='one';

  function rebuildGcAlerts(){ document.getElementById('gcAlerts').innerHTML = loadAlerts + gcUploadAlerts; }

  // Delegated click handling for dynamically generated alert dismiss buttons.
  document.getElementById('tab-gc').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn || !document.getElementById('tab-gc').contains(btn)) return;
    switch (btn.dataset.action){
      case 'gc-dismiss-invalid': loadAlerts=''; rebuildGcAlerts(); break;
      case 'gc-dismiss-upload':  gcUploadAlerts=''; rebuildGcAlerts(); break;
    }
  });

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
        [files,ms,Qs,startArr,endArr,lightOnDates].forEach(a=>a.splice(i,1));
        if (!files.length) loadAlerts = '';
        gcSel=gcHov=null;
        afterFilesChange();
      },
      onReorder(from, to){ [files,ms,Qs,startArr,endArr,lightOnDates].forEach(a=>{ const [x]=a.splice(from,1); a.splice(to,0,x); }); gcSel=gcHov=null; afterFilesChange(); },
      onLabelChange(i, v){ files[i].label=v; renderGcParamTable(); computeAndRenderGc(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; computeAndRenderGc(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ [files,ms,Qs,startArr,endArr,lightOnDates].forEach(a=>a.length=0); gcSel=gcHov=null; loadAlerts=''; gcUploadAlerts=''; rebuildGcAlerts(); afterFilesChange(); },
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
      ms.push(15); Qs.push(2); startArr.push(0); endArr.push(24);
      lightOnDates.push(new Date(sorted[0]));
    }
    loadAlerts = buildAlertsHtml(invalidFiles, [], undefined, 'gc-dismiss-invalid');
    gcUploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'gc-dismiss-upload') : '';
    rebuildGcAlerts();
    afterFilesChange();
  });

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
      ms: ms.slice(), Qs: Qs.slice(), startArr: startArr.slice(), endArr: endArr.slice(),
      lightOnDates: lightOnDates.map(d=> d ? d.getTime() : null),
      mMode, qMode, startMode, endMode, mShared, qShared, startShared, endShared,
    };
  }
  function gcRestore(s){
    files = s.files.map(f=>({...f}));
    ms = s.ms.slice(); Qs = s.Qs.slice();
    lightOnDates = s.lightOnDates.map(t=> t!=null ? new Date(t) : null);
    if (s.mMode !== undefined){
      // Current format: four independent per-parameter modes.
      mMode = s.mMode; qMode = s.qMode; startMode = s.startMode; endMode = s.endMode;
      mShared = s.mShared; qShared = s.qShared; startShared = s.startShared; endShared = s.endShared;
      startArr = (s.startArr||files.map(()=>startShared)).slice();
      endArr   = (s.endArr  ||files.map(()=>endShared)).slice();
    } else if (s.intMode !== undefined){
      // Migrate paired-mode projects (mqMode / intMode) to independent modes.
      mMode = qMode = s.mqMode; startMode = endMode = s.intMode;
      mShared = s.mShared; qShared = s.qShared; startShared = s.startShared; endShared = s.endShared;
      startArr = (s.startArr||files.map(()=>startShared)).slice();
      endArr   = (s.endArr  ||files.map(()=>endShared)).slice();
    } else {
      // Migrate the oldest projects: a single global interval → interval 'all' mode.
      mMode='one'; qMode='one'; startMode='all'; endMode='all';
      mShared=15; qShared=2;
      startShared = s.plateauStart ?? 0; endShared = s.plateauEnd ?? 24;
      startArr = files.map(()=>startShared); endArr = files.map(()=>endShared);
    }
    gcSel=gcHov=null;
    afterFilesChange();
  }
  const hist = registerHistory('gc', gcSnapshot, gcRestore);
  registerTabRedraw('gc', ()=>{ if (files.length) computeAndRenderGc(true); });

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

  // A numeric text cell; `state` = 'on' (editable), 'ro' (read-only) or 'off' (disabled).
  function numCell(cls, attrs, value, state){
    const dis = state==='off' ? 'disabled' : (state==='ro' ? 'readonly' : '');
    return `<input class="${cls}" ${attrs} type="text" inputmode="decimal" value="${value}" ${dis} style="width:100%">`;
  }
  const modeChip = (pair, mode)=> `<button type="button" class="mode-chip gc-toggle" data-pair="${pair}" title="Switch all / one">${mode}</button>`;

  function renderGcParamTable(){
    const wrap = document.getElementById('gcParamTableWrap');
    if (!files.length){ wrap.innerHTML=''; return; }
    const cg = `<colgroup><col style="width:15%"><col style="width:12%"><col style="width:12%"><col style="width:24%"><col style="width:11%"><col style="width:11%"><col style="width:15%"></colgroup>`;
    const shareState = mode => mode==='all' ? 'on'  : 'off';   // shared "All" row cell
    const cellState  = mode => mode==='all' ? 'ro'  : 'on';    // per-sample row cell
    // Column order: Sample | m | Q | Light-on | [Interval: start end] | warnings.
    let html = `<div style="overflow-x:auto"><table style="min-width:860px;width:100%;table-layout:fixed">${cg}<thead>
      <tr><th rowspan="2">Sample</th>
        <th rowspan="2">m (g) ${modeChip('m',mMode)}</th>
        <th rowspan="2">Q (mL/min) ${modeChip('q',qMode)}</th>
        <th rowspan="2">Light-on date/time</th>
        <th colspan="2" class="gc-grp">Interval (h)</th>
        <th rowspan="2"></th></tr>
      <tr><th>start ${modeChip('start',startMode)}</th><th>end ${modeChip('end',endMode)}</th></tr></thead><tbody>`;
    // Shared "all" row
    html += `<tr class="gc-all-row"><td class="fname">All</td>
      <td>${numCell('gcShared','data-f="m"',mShared,shareState(mMode))}</td>
      <td>${numCell('gcShared','data-f="q"',qShared,shareState(qMode))}</td>
      <td></td>
      <td>${numCell('gcShared','data-f="start"',startShared,shareState(startMode))}</td>
      <td>${numCell('gcShared','data-f="end"',endShared,shareState(endMode))}</td>
      <td></td></tr>`;
    // Per-sample rows
    files.forEach((f,i)=>{
      html += `<tr class="gc-row" data-i="${i}">
        <td class="fname" title="${f.label}">${f.label}</td>
        <td>${numCell('gcCell','data-i="'+i+'" data-f="m"',mOf(i),cellState(mMode))}</td>
        <td>${numCell('gcCell','data-i="'+i+'" data-f="q"',qOf(i),cellState(qMode))}</td>
        <td class="gc-date-cell" data-i="${i}"></td>
        <td>${numCell('gcCell','data-i="'+i+'" data-f="start"',startOf(i),cellState(startMode))}</td>
        <td>${numCell('gcCell','data-i="'+i+'" data-f="end"',endOf(i),cellState(endMode))}</td>
        <td class="gc-warn-cell">${lightOnWarnHtml(i)}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    wrap.innerHTML = html;
    fitCsvIcons();

    // all/one toggles: flip a parameter, seeding across the boundary (one→all from
    // sample 0, all→one from the shared value), then re-render + recompute.
    wrap.querySelectorAll('.gc-toggle').forEach(btn=> btn.addEventListener('click', ()=>{
      const flip = (mode, shared, arr, setShared)=>{
        if (mode==='one'){ setShared(arr[0]); return 'all'; }
        files.forEach((f,i)=>{ arr[i]=shared; }); return 'one';
      };
      switch (btn.dataset.pair){
        case 'm':     mMode     = flip(mMode,     mShared,     ms,       v=>mShared=v);     break;
        case 'q':     qMode     = flip(qMode,     qShared,     Qs,       v=>qShared=v);     break;
        case 'start': startMode = flip(startMode, startShared, startArr, v=>startShared=v); gcSel=gcHov=null; break;
        case 'end':   endMode   = flip(endMode,   endShared,   endArr,   v=>endShared=v);   gcSel=gcHov=null; break;
      }
      renderGcParamTable(); computeAndRenderGc(); hist.commit();
    }));

    // m/Q inputs (shared + per-sample) — recompute the whole series on a valid change.
    const wireNum = (inp, apply)=>{
      guardNumericInput(inp, { min:0.001 });
      inp.addEventListener('change', ()=>{ apply(+inp.value); computeAndRenderGc(); hist.commit(); });
    };
    wrap.querySelectorAll('.gcShared[data-f="m"]').forEach(inp=> mMode==='all' && wireNum(inp, v=>mShared=v));
    wrap.querySelectorAll('.gcShared[data-f="q"]').forEach(inp=> qMode==='all' && wireNum(inp, v=>qShared=v));
    wrap.querySelectorAll('.gcCell[data-f="m"]').forEach(inp=>{ if(mMode==='one'){ const i=+inp.dataset.i; wireNum(inp, v=>ms[i]=v); }});
    wrap.querySelectorAll('.gcCell[data-f="q"]').forEach(inp=>{ if(qMode==='one'){ const i=+inp.dataset.i; wireNum(inp, v=>Qs[i]=v); }});

    // start/end inputs — start and end can be in different modes, so each input is wired
    // independently and validated against the effective counterpart (end>start per sample).
    if (startMode==='all') wireBoundInput(wrap.querySelector('.gcShared[data-f="start"]'), 'start', true, 0);
    if (endMode==='all')   wireBoundInput(wrap.querySelector('.gcShared[data-f="end"]'),   'end',   true, 0);
    files.forEach((f,i)=>{
      if (startMode==='one') wireBoundInput(wrap.querySelector(`.gcCell[data-i="${i}"][data-f="start"]`), 'start', false, i);
      if (endMode==='one')   wireBoundInput(wrap.querySelector(`.gcCell[data-i="${i}"][data-f="end"]`),   'end',   false, i);
    });

    wrap.querySelectorAll('.gc-date-cell').forEach(cell=>{
      const i = +cell.dataset.i;
      const field = createDateTimeField(lightOnDates[i], d=>{
        lightOnDates[i] = d;
        const wc = cell.closest('tr').querySelector('.gc-warn-cell');
        if (wc) wc.innerHTML = lightOnWarnHtml(i);
        computeAndRenderGc(); hist.commit();
      });
      cell.appendChild(field.el);
    });

    // Row ↔ plot interaction (interval mode 'one'): hover highlights the sample's lines
    // on both plots; clicking (off the inputs) toggles the selection.
    wrap.querySelectorAll('.gc-row').forEach(row=>{
      const i = +row.dataset.i;
      row.addEventListener('mouseenter', ()=> setGcHover(i));
      row.addEventListener('mouseleave', ()=> setGcHover(null));
      row.addEventListener('click', e=>{ if (e.target.closest('input, button, .gc-date-cell')) return; selectGc(i); });
    });
    refreshGcRows();
  }

  // Wire a single interval-bound input (start or end; shared or per-sample i). Since the
  // two bounds can be in different all/one modes, each input validates against the
  // effective counterpart so that end>start holds for every affected sample. Invalid
  // input shakes the field and reverts.
  function wireBoundInput(inp, which, isShared, i){
    if (!inp) return;
    guardNumericInput(inp, {});
    inp.addEventListener('change', ()=>{
      const cur = isShared ? (which==='start'?startShared:endShared) : (which==='start'?startArr[i]:endArr[i]);
      const v = parseIntervalField(inp.value);
      if (v===null){ inp.value = cur; return; }
      let ok;
      if (which==='start'){
        // A shared start must stay below every sample's end; a per-sample start below its own end.
        const endBound = isShared ? (endMode==='all' ? endShared : Math.min(...endArr)) : endOf(i);
        ok = v < endBound;
      } else {
        const startBound = isShared ? (startMode==='all' ? startShared : Math.max(...startArr)) : startOf(i);
        ok = v > startBound;
      }
      if (!ok){ flashFieldInvalid(inp); inp.value = cur; return; }
      if (isShared){ if (which==='start') startShared=v; else endShared=v; }
      else { if (which==='start') startArr[i]=v; else endArr[i]=v; }
      updateRegression(); hist.commit();
    });
    inp.addEventListener('keydown', e=>{ if (e.key==='Enter') inp.blur(); });
  }

  // Parse a raw field string into a finite number, or null if incomplete/invalid.
  function parseIntervalField(v){
    const s = String(v).trim().replace(',', '.');   // accept comma decimals
    if (s==='' || s==='-' || s==='+' || s==='.' || s==='-.' || s==='+.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function computeAndRenderGc(preserveView){
    if (!files.length) return;
    // Snapshot the current zoom before renderGcPlots() builds fresh Plot instances.
    const o1 = document.getElementById('gcSvg1')._plot, o2 = document.getElementById('gcSvg2')._plot;
    _gcPrev1 = (preserveView && o1 && isFinite(o1.xmin)) ? {xmin:o1.xmin,xmax:o1.xmax,ymin:o1.ymin,ymax:o1.ymax} : null;
    _gcPrev2 = (preserveView && o2 && isFinite(o2.xmin)) ? {xmin:o2.xmin,xmax:o2.xmax,ymin:o2.ymin,ymax:o2.ymax} : null;
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
      const F = qOf(h)/1000*60/22.41396954;
      const h2F = h2pct.map(v=> v/100*F*1e6);
      const h2Fm = h2F.map(v=> v/mOf(h));
      const h2FmInt = cumtrapz(tHours, h2Fm);
      return {t:tHours, h2pct, h2F, h2Fm, h2FmInt, label:f.label, color:f.color};
    });
    document.getElementById('gcAlerts').innerHTML = loadAlerts + gcUploadAlerts;
    renderGcPlots();
  }

  function renderGcPlots(){
    const legend = document.getElementById('gcLegend'); legend.innerHTML='';
    plot1 = new Plot(document.getElementById('gcSvg1'), {xlabel:'Time (h)', ylabel:'H₂ Rate (mmol/h/g)'});
    plot2 = new Plot(document.getElementById('gcSvg2'), {xlabel:'Time (h)', ylabel:'Cumulative H₂ (mmol/g)'});
    dataTables.forEach(d=>{
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${d.color}"></i>${d.label}`; legend.appendChild(s);
    });
    plot1.attachTools(plot1.svg.closest('.plot-wrap'));
    plot2.attachTools(plot2.svg.closest('.plot-wrap'));
    updateRegression();
  }

  // Draw the data lines with an x-range spanning both the data and every interval line
  // (so bars are never clipped). Interval lines are drawn as an overlay, redrawn on
  // pan/zoom via _onView.
  function drawGcData(){
    if (!plot1 || !plot2 || !dataTables.length) return;
    // Restore the pre-redraw zoom captured in computeAndRenderGc (resize/tab-switch),
    // then clear it so a subsequent data-driven redraw snaps back to the full range.
    const prev1 = _gcPrev1, prev2 = _gcPrev2; _gcPrev1 = _gcPrev2 = null;
    const allT = dataTables.flatMap(d=>d.t);
    const intPts = dataTables.flatMap((d,k)=>[startOf(k), endOf(k)]);
    const tmin = Math.min(0, minArr(allT), ...intPts);
    const tmax = Math.max(maxArr(allT), ...intPts);
    const ymax1 = Math.max(...dataTables.map(d=>maxArr(d.h2Fm))), ymin1 = Math.min(...dataTables.map(d=>minArr(d.h2Fm)));
    plot1.setRange(tmin, tmax, ymin1, ymax1*1.05);
    if (prev1){ plot1.xmin=prev1.xmin; plot1.xmax=prev1.xmax; plot1.ymin=prev1.ymin; plot1.ymax=prev1.ymax; }
    plot1.drawAxes(); plot1.clearData();
    dataTables.forEach(d=> plot1.line(d.t, d.h2Fm, d.color, 1.3));
    const ymax2 = Math.max(...dataTables.map(d=>maxArr(d.h2FmInt)));
    plot2.setRange(tmin, tmax, 0, ymax2*1.05);
    if (prev2){ plot2.xmin=prev2.xmin; plot2.xmax=prev2.xmax; plot2.ymin=prev2.ymin; plot2.ymax=prev2.ymax; }
    plot2.drawAxes(); plot2.clearData();
    dataTables.forEach(d=> plot2.line(d.t, d.h2FmInt, d.color, 1.3));
    plot1._onView = ()=> drawGcIntervals(plot1);
    plot2._onView = ()=> drawGcIntervals(plot2);
    drawGcIntervals(plot1); drawGcIntervals(plot2);
  }

  // Integration-interval vertical lines. 'all': one shared pair in the theme-aware
  // grey (--plot-errbar). 'one': a pair per sample in the sample's colour (1px), with
  // an invisible fat hit line for hover/select; hovered/selected lines thicken, the
  // selected pair turns the highlight grey.
  function drawGcIntervals(plot){
    if (!plot) return;
    const g = plot.gOverlay;
    g.querySelectorAll('.gc-int').forEach(e=>e.remove());
    const { h } = plot.size(), m = plot.margin;
    const vline = (xv, o)=>{
      const px = plot.px(xv);
      const ln = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,'stroke-width':o.width,'pointer-events':'none','class':'gc-int'+(o.cls?' '+o.cls:'')});
      if (o.color) ln.setAttribute('stroke', o.color);
      g.appendChild(ln);
      if (o.hit){
        const ht = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'gc-int'});
        ht.addEventListener('pointerenter', ()=> setGcHover(o.k));
        ht.addEventListener('pointerleave', scheduleClearGcHover);
        ht.addEventListener('click', ()=> selectGc(o.k));
        g.appendChild(ht);
      }
    };
    if (!intPerSample()){
      vline(startShared, {width:1.5, cls:'gc-int-hl'});
      vline(endShared,   {width:1.5, cls:'gc-int-hl'});
    } else {
      dataTables.forEach((d,k)=>{
        const sel = gcSel===k, on = sel || gcHov===k;
        const o = { k, hit:true, width: on?2.6:1, cls: sel?'gc-int-hl':'', color: sel?null:d.color };
        vline(startOf(k), o); vline(endOf(k), o);
      });
    }
  }

  // ---- Row ↔ plot1 ↔ plot2 interaction (all three respond in unison) ----
  let gcHoverRAF = null;
  function scheduleClearGcHover(){
    if (gcHoverRAF) cancelAnimationFrame(gcHoverRAF);
    gcHoverRAF = requestAnimationFrame(()=>{ gcHoverRAF=null; setGcHover(null); });
  }
  function setGcHover(k){
    if (!intPerSample()) k = null;
    if (gcHoverRAF){ cancelAnimationFrame(gcHoverRAF); gcHoverRAF=null; }
    if (gcHov === k) return;
    gcHov = k;
    drawGcIntervals(plot1); drawGcIntervals(plot2); refreshGcRows();
  }
  function selectGc(k){
    if (!intPerSample()) return;
    // Clear any transient hover so the green .hovering tint doesn't linger after a
    // click (mirrors the XRD peak table, whose full re-render drops it).
    if (gcHoverRAF){ cancelAnimationFrame(gcHoverRAF); gcHoverRAF=null; }
    gcHov = null;
    gcSel = (gcSel===k) ? null : k;
    drawGcIntervals(plot1); drawGcIntervals(plot2); refreshGcRows();
  }
  function refreshGcRows(){
    document.querySelectorAll('#gcParamTableWrap .gc-row').forEach(r=>{
      const k = +r.dataset.i;
      r.classList.toggle('hovering', k===gcHov);
      r.classList.toggle('selected', k===gcSel);
    });
  }

  function updateRegression(){
    costResults = dataTables.map((d,k)=>{
      const xStart = Math.min(startOf(k), endOf(k)), xEnd = Math.max(startOf(k), endOf(k));
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
    drawGcData();
    drawBarChart();
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
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const rect = svg.getBoundingClientRect();
    const svgW = rect.width || 640, svgH = rect.height || 640;
    const labels = costResults.map(c=>truncTiltLabel(mctx, c.label));
    let maxLbl = 0;
    labels.forEach((lbl,k)=>{ if (isFinite(costResults[k].cost)) maxLbl = Math.max(maxLbl, mctx.measureText(lbl).width); });
    const bottom = Math.min(Math.round(svgH*0.5), Math.round(26 + maxLbl*Math.sin(Math.PI/6)));
    // Value label (vertical) above each bar, with reserved top headroom so it never clips.
    const fmtVal = v => v.toFixed(4);
    let maxValW = 0, maxTop = 0;
    costResults.forEach(c=>{ if (isFinite(c.cost)){ maxValW = Math.max(maxValW, mctx.measureText(fmtVal(c.cost)).width); maxTop = Math.max(maxTop, c.cost); } });
    const mTop = 15, gap = 6, plotH = svgH - mTop - bottom, reserve = gap + maxValW + 6;
    const frac = plotH > reserve ? (1 - reserve/plotH) : 0.5;
    const ymax = Math.max(Math.max(...finite.map(c=>c.cost))*1.2, maxTop/frac);
    const barPlot = new Plot(svg, {xlabel:'', ylabel:'H₂ Rate (mmol/h/g)', noXTickLabels:true, margin:{l:55,r:20,t:mTop,b:bottom}});
    const xpad = barPlotXPad(maxLbl, costResults.length, svgW-75);   // widen x-range when labels would overflow the sides
    barPlot.setRange(-xpad, costResults.length+1+xpad, 0, ymax||1);
    barPlot.drawAxes();
    costResults.forEach((c,k)=>{
      if (!isFinite(c.cost)) return;
      barPlot.barPx(k+1, 0, c.cost, dataTables[k].color, 16);
      barPlot.barLabel(k+1, c.cost, fmtVal(c.cost), {gap});
      barPlot.tickLabel(k+1, labels[k], 30);
    });
    barPlot.attachTools(svg.closest('.plot-wrap'));
  }

  function exportGcZip(){
    if (!dataTables.length) return [];
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
    // gc_info.csv — per-sample inputs + the integration interval used
    const fmtDate = d => d ? new Date(d).toISOString().slice(0,16).replace('T',' ') : '';
    let t3 = csvLine(['Sample','m (g)','Q (mL/min)','Light-on','Interval start (h)','Interval end (h)']);
    dataTables.forEach((d,k)=> t3 += csvLine([d.label, mOf(k), qOf(k), fmtDate(lightOnDates[k]), startOf(k), endOf(k)]));
    entries.push({name:'gc_info.csv', text:t3});
    return entries;
  }
  registerCsvExport('gc', exportGcZip);
})();

