import { fmtNum, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, movingAverage, maxArr, minArr, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, X_SVG } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   EPR MODULE
========================================================= */
(function(){
  let files = []; // {name, label, b[], a[]}
  let lastY = [];
  let loadAlerts = '';
  let uploadAlerts = '';
  let pendingAlerts = '';   // ephemeral notice about unpaired uploads

  // Delegated click handling for the dynamically generated alert dismiss buttons.
  document.getElementById('tab-epr').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn || !document.getElementById('tab-epr').contains(btn)) return;
    switch (btn.dataset.action){
      case 'epr-dismiss-invalid': loadAlerts=''; rebuildAlerts(); break;
      case 'epr-dismiss-upload':  uploadAlerts=''; rebuildAlerts(); break;
      case 'epr-dismiss-pending': pendingAlerts=''; rebuildAlerts(); break;
    }
  });

  function fileCallbacks(){
    return {
      onRemove(i){
        files.splice(i,1);
        if (!files.length) loadAlerts = '';
        rebuildAlerts();
        afterFilesChange();
      },
      onReorder(from, to){ const [x]=files.splice(from,1); files.splice(to,0,x); afterFilesChange(); },
      onLabelChange(i, v){ files[i].label=v; updateEpr(); hist.commit(); },
      onColorChange(i, v){ files[i].color=v; updateEpr(); hist.commit(); },
      onPaletteChange(colors){ files.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ files.length=0; loadAlerts=''; uploadAlerts=''; pendingAlerts=''; rebuildAlerts(); afterFilesChange(); },
    };
  }

  function rebuildAlerts(){
    document.getElementById('eprAlerts').innerHTML = loadAlerts + uploadAlerts;
    document.getElementById('eprPendingWrap').innerHTML = pendingAlerts;
  }

  // A .DTA/.DSC arriving without its partner in the same drop is simply not loaded —
  // nothing is held back waiting for it. This is just the ephemeral warning saying so.
  function buildPendingAlert(names){
    pendingAlerts = names.length ? buildAlertsHtml([], names,
      'Not loaded — a .DTA and its .DSC must be uploaded together:',
      undefined, 'epr-dismiss-pending') : '';
  }

  function parseDsc(text){
    const p = {};
    for (const line of text.split(/\r?\n/)){
      const m = line.match(/^(\w+)\s+(.*)/);
      if (m) p[m[1]] = m[2].trim();
    }
    return p;
  }

  function buildBAxis(p){
    const npts  = parseInt(p.XPTS);
    const xmin  = parseFloat(p.XMIN);  // Gauss
    const xwid  = parseFloat(p.XWID);  // Gauss
    const mwfq  = parseFloat(p.MWFQ);  // Hz
    const b = [];
    for (let i = 0; i < npts; i++)
      b.push((xmin + xwid * i / (npts - 1)) / mwfq * 9.5e8);
    return b;
  }

  async function processPair(stem, dtaFile, dscFile){
    const dscBytes = new Uint8Array(await dscFile.arrayBuffer());
    const dscText = await dscFile.text();
    const p = parseDsc(dscText);
    const npts = parseInt(p.XPTS);
    if (!npts){ return null; }

    const bigEndian = (p.BSEQ || 'BIG') !== 'LIT';
    const dtaBuf = await dtaFile.arrayBuffer();
    const view = new DataView(dtaBuf);
    const s = [];
    for (let i = 0; i < npts; i++)
      s.push(view.getFloat64(i * 8, !bigEndian));

    const b = buildBAxis(p);

    // linear baseline correction
    const n = s.length;
    const slope = (s[n-1] - s[0]) / (b[n-1] - b[0] || 1);
    const a = s.map((v, i) => v - (s[0] + slope * (b[i] - b[0])));

    return { name: stem, label: stem, b, a,
             rawFiles: [ { name: dscFile.name, bytes: dscBytes },
                         { name: dtaFile.name, bytes: new Uint8Array(dtaBuf) } ] };
  }

  setupDropzone('eprDropzone', 'eprFiles', async (fileList)=>{
    const existingStems = new Set(files.map(f=>f.name));
    const invalidFiles = [];
    const alreadyLoaded = [];

    // Group by stem WITHIN THIS DROP only — nothing is carried over between uploads.
    const groups = {};
    for (const f of fileList){
      const ext  = f.name.split('.').pop().toLowerCase();
      const stem = f.name.replace(/\.[^.]+$/, '');
      if (ext !== 'dta' && ext !== 'dsc'){ invalidFiles.push(f.name); continue; }
      if (existingStems.has(stem)){ alreadyLoaded.push(f.name); continue; }
      if (!groups[stem]) groups[stem] = { dta: null, dsc: null };
      groups[stem][ext] = f;
    }

    // Complete pairs load; a lone half is reported and dropped.
    const unpaired = [];
    for (const [stem, pair] of Object.entries(groups)){
      if (pair.dta && pair.dsc){
        const result = await processPair(stem, pair.dta, pair.dsc);
        if (result){ result.color = nextColor(files); files.push(result); existingStems.add(stem); }
        else { invalidFiles.push(stem); }
      } else {
        unpaired.push((pair.dta || pair.dsc).name);
      }
    }

    loadAlerts = invalidFiles.length ? buildAlertsHtml(invalidFiles, [], undefined, 'epr-dismiss-invalid') : '';
    uploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'epr-dismiss-upload') : '';
    buildPendingAlert(unpaired);
    rebuildAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    setTabLoaded('epr', files.length);
    renderUnifiedFileList('eprFileTableWrap', files, fileCallbacks());
    if (files.length){
      document.getElementById('eprWorkspace').style.display='block';
      updateEpr();
    } else {
      document.getElementById('eprWorkspace').style.display='none';
      rebuildAlerts();
    }
    hist.commit();
  }

  /* ---- Undo/redo: file order/labels/colours + normalization & smoothing ---- */
  function eprSnapshot(){
    return {
      files: files.map(f=>({...f})),
      norm: document.getElementById('eprNorm').value,
      smooth: document.getElementById('eprSmooth').value,
    };
  }
  function eprRestore(s){
    files = s.files.map(f=>({...f}));
    document.getElementById('eprNorm').value = s.norm;
    document.getElementById('eprSmooth').value = s.smooth;
    afterFilesChange();
    // Clear the previous tab's transient alerts, then rebuild.
    loadAlerts = ''; uploadAlerts = ''; pendingAlerts = ''; rebuildAlerts();
  }
  const hist = registerHistory('epr', eprSnapshot, eprRestore);
  registerTabRedraw('epr', ()=>{ if (files.length) updateEpr(true); });

  function updateEpr(preserveView){
    if (!files.length) return;
    const N = +document.getElementById('eprSmooth').value || 1;
    const norm = document.getElementById('eprNorm').value;
    let Y = files.map(f=>movingAverage(f.a, N));
    // A fresh Plot is built each render, so grab the outgoing view first to keep the
    // current zoom on a resize / tab-switch redraw instead of snapping to full range.
    const old = document.getElementById('eprSvg')._plot;
    const prev = (preserveView && old && isFinite(old.xmin)) ? {xmin:old.xmin,xmax:old.xmax,ymin:old.ymin,ymax:old.ymax} : null;
    const plot = new Plot(document.getElementById('eprSvg'), {xlabel:'Magnetic Field (mT)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = document.getElementById('eprLegend'); legend.innerHTML='';
    const n = Y.length;
    const baseOf = k => (n-1-k)*1.1;
    const allB = files.flatMap(f=>f.b);
    if (norm==='local'){
      Y = Y.map((y,k)=>{ const mn=minArr(y),mx=maxArr(y); const sc=mx===mn?0:1.0/(mx-mn); return y.map(v=>(v-mn)*sc+baseOf(k)+0.05); });
    } else {
      Y = Y.map(y=>{ const m=minArr(y); return y.map(v=>v-m); });
      const gmax = Math.max(...Y.map(maxArr));
      Y = Y.map((y,k)=>{ const mid=maxArr(y)/(2*gmax); return y.map(v=>v/gmax+baseOf(k)+0.55-mid); });
    }
    plot.setRange(minArr(allB), maxArr(allB), baseOf(n-1), baseOf(0)+1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    Y.forEach((y,k)=>{
      plot.line(files[k].b, y, files[k].color, 1.3);
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${files[k].color}"></i>${files[k].label}`; legend.appendChild(s);
    });
    lastY = Y;
  }

  // Apply on confirm, not while typing. eprNorm is a <select> (its change is a
  // deliberate pick); eprSmooth is a guarded number field, so its change only
  // fires with a valid value (invalid input shakes + reverts via guardNumberInputs).
  ['eprNorm','eprSmooth'].forEach(id=>{
    document.getElementById(id).addEventListener('change', ()=>{
      if (files.length){ updateEpr(); hist.commit(); }
    });
  });

  function exportEprZip(){
    if (!files.length) return [];
    const N = +document.getElementById('eprSmooth').value || 1;
    const norm = document.getElementById('eprNorm').value;
    // Smoothed column: moving-average (N pts), background subtracted as the first point,
    // then normalised the user's way — divide by the peak-to-peak (local = own,
    // global = largest across samples), matching the on-screen normalisation divisor.
    const sms = files.map(f=>movingAverage(f.a, N));
    const ppks = sms.map(sm => (maxArr(sm)-minArr(sm)) || 1);
    const gPP = Math.max(...ppks);
    // Per sample: the (already g-corrected) field, the raw intensity — already
    // baseline-centred at import — and the processed smoothed trace.
    const cols = [];
    files.forEach((f,k)=>{
      const sm = sms[k], bg = sm[0] ?? 0, div = norm==='local' ? ppks[k] : gPP;
      cols.push({h:'Bfield_mT_'+f.label,             v:f.b.map(v=>fmtNum(v,6))});
      cols.push({h:'Raw_'+f.label,                   v:f.a.map(v=>fmtNum(v,6))});
      cols.push({h:`Smoothed_${f.label} (N=${N})`,   v:sm.map(v=>fmtNum((v-bg)/div,6))});
    });
    const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
    let t = csvLine(cols.map(c=>c.h));
    for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
    return [{name:'epr_spectra.csv', text:t}];
  }
  registerCsvExport('epr', exportEprZip);
})();

