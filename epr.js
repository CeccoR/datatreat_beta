import { fmtNum, fmtData, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, movingAverage, maxArr, minArr, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, X_SVG } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   EPR MODULE
========================================================= */
(function(){
  // Every file loaded, in list order; the analysis sees the included ones, `files`.
  let allFiles = []; // {name, label, b[], a[]}
  let files = [];
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
        removeFileAt(allFiles, i, []);
        if (!allFiles.length) loadAlerts = '';
        rebuildAlerts();
        afterFilesChange();
      },
      onReorder(from, to){ moveFileTo(allFiles, from, to, []); afterFilesChange(); },
      onInclude(i, on){ setIncluded(allFiles, i, on, []); afterFilesChange(); },
      onIncludeAll(on){ allFiles.forEach((_, j)=> setIncluded(allFiles, j, on, [])); afterFilesChange(); },
      onLabelChange(i, v){ allFiles[i].label=v; updateEpr(); hist.commit(); },
      onColorChange(i, v){ allFiles[i].color=v; updateEpr(); hist.commit(); },
      onPaletteChange(colors){ allFiles.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(); },
      onRemoveAll(){ allFiles.length=0; loadAlerts=''; uploadAlerts=''; pendingAlerts=''; rebuildAlerts(); afterFilesChange(); },
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

  // A .DSC value without the quotes it may be written in ('G', 'mT').
  const dscWord = v => String(v || '').replace(/['"]/g, '').trim();
  /* The field axis in mT, rescaled to 9.5 GHz. XMIN/XWID are in the unit XUNI
     names, Gauss unless it says mT; with no MWFQ there is no frequency to rescale
     by, and the field is the one measured. */
  // h·(9.5 GHz)/μ_B, in mT: the field of g = 1 at 9.5 GHz, so that g = G_AT_95 / B.
  const G_AT_95 = 6.62607015e-34 * 9.5e9 / 9.2740100783e-24 * 1e3;
  function buildBAxis(p){
    const npts  = parseInt(p.XPTS);
    const toG   = dscWord(p.XUNI).toLowerCase() === 'mt' ? 10 : 1;
    const xmin  = parseFloat(p.XMIN) * toG;  // Gauss
    const xwid  = parseFloat(p.XWID) * toG;  // Gauss
    const mwfq  = parseFloat(p.MWFQ);        // Hz
    const k     = mwfq > 0 ? 9.5e8 / mwfq : 0.1;
    const b = [];
    for (let i = 0; i < npts; i++)
      b.push((xmin + xwid * i / (npts - 1)) * k);
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
    /* The values as IRFMT stores them (64-bit floats unless it says otherwise), and
       for complex data (IKKF CPLX) the real part of each real/imaginary pair: read
       as plain doubles, those came out as garbage or stretched over twice the axis. */
    const fmt = dscWord(p.IRFMT).split(',')[0].toUpperCase() || 'D';
    const READ = { D: [8, (o, le)=> view.getFloat64(o, le)], F: [4, (o, le)=> view.getFloat32(o, le)],
                   I: [4, (o, le)=> view.getInt32(o, le)],   S: [2, (o, le)=> view.getInt16(o, le)], C: [1, o=> view.getInt8(o)] };
    if (!READ[fmt]) return null;
    const [size, read] = READ[fmt];
    const stride = dscWord(p.IKKF).split(',')[0].toUpperCase() === 'CPLX' ? 2 : 1;
    if (dtaBuf.byteLength < npts * stride * size) return null;
    const s = [];
    for (let i = 0; i < npts; i++)
      s.push(read(i * stride * size, !bigEndian));

    const b = buildBAxis(p);

    // linear baseline correction
    const n = s.length;
    const slope = (s[n-1] - s[0]) / (b[n-1] - b[0] || 1);
    const a = s.map((v, i) => v - (s[0] + slope * (b[i] - b[0])));

    // Whether the field was rescaled to 9.5 GHz: with no MWFQ it is the one measured.
    return { name: stem, label: stem, b, a, rescaled: parseFloat(p.MWFQ) > 0,
             rawFiles: [ { name: dscFile.name, bytes: dscBytes },
                         { name: dtaFile.name, bytes: new Uint8Array(dtaBuf) } ] };
  }

  setupDropzone('eprDropzone', 'eprFiles', async (fileList)=>{
    const existingStems = new Set(allFiles.map(f=>f.name));
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
        if (result){ result.color = nextColor(allFiles); allFiles.push(result); existingStems.add(stem); }
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
    files = includedOf(allFiles);
    setTabLoaded('epr', allFiles.length);
    renderUnifiedFileList('eprFileTableWrap', allFiles, fileCallbacks());
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
      files: allFiles.map(f=>({...f})),
      norm: document.getElementById('eprNorm').value,
      smooth: document.getElementById('eprSmooth').value,
    };
  }
  function eprRestore(s){
    allFiles = s.files.map(f=>({...f}));
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
    /* The field is each spectrum's rescaled to 9.5 GHz (buildBAxis), so the axis says so
       and carries g along the top: g = hν/(μ_B·B) at that ν, 678.753 mT / B. A file
       without its frequency is on its measured field, where g cannot be read. */
    const at95 = files.every(f=> f.rescaled !== false);
    const plot = new Plot(document.getElementById('eprSvg'), {xlabel: at95 ? 'Magnetic Field at 9.5 GHz (mT)' : 'Magnetic Field (mT)', ylabel:'Intensity (a. u.)', noYTickLabels:true,
      ...(at95 ? { topAxis: { label:'g', of: B=> G_AT_95/B, at: g=> G_AT_95/g, fmt: v=> v.toFixed(4) }, margin:{l:55,r:20,t:48,b:40} } : {})});
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
    // The composer gets the CSV's own "Smoothed_" column: moving average, background
    // taken as the first point, divided by the peak-to-peak the chosen normalisation
    // uses. Same numbers as the export, without the stacking offset.
    const sms = files.map(f=>movingAverage(f.a, N));
    const ppks = sms.map(sm => (maxArr(sm)-minArr(sm)) || 1);
    const gPP = Math.max(...ppks);
    Y.forEach((y,k)=>{
      const sm = sms[k], bg = sm[0] ?? 0, div = norm==='local' ? ppks[k] : gPP;
      const csvY = sm.map(v=>(v-bg)/div);
      plot.line(files[k].b, y, files[k].color, 1.3, undefined,
                { raw: { xs: files[k].b, ys: csvY }, label: files[k].label, key: files[k].name });
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
      // Rescaled to 9.5 GHz, which the header says: it is not the field measured.
      cols.push({h:(f.rescaled !== false ? 'Bfield_mT_at_9.5GHz_' : 'Bfield_mT_')+f.label, v:f.b.map(v=>fmtNum(v,6))});
      // Intensities of any scale keep their digits (fmtData): a tiny one is not 0.
      cols.push({h:'Raw_'+f.label,                   v:f.a.map(v=>fmtData(v,6))});
      cols.push({h:`Smoothed_${f.label} (N=${N})`,   v:sm.map(v=>fmtNum((v-bg)/div,6))});
    });
    const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
    let t = csvLine(cols.map(c=>c.h));
    for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
    return [{name:'epr_spectra.csv', text:t}];
  }
  registerCsvExport('epr', exportEprZip);
})();

