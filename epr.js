import { fmtNum, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, movingAverage, maxArr, minArr, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, X_SVG } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   EPR MODULE
========================================================= */
(function(){
  let files = []; // {name, label, b[], a[]}
  let lastY = [];
  // pending unpaired files: stem → {dta: File|null, dsc: File|null}
  let pending = {};
  let loadAlerts = '';
  let uploadAlerts = '';

  // Delegated click handling for dynamically generated buttons (alerts + pending
  // table), so no per-button global onclick handlers are needed.
  document.getElementById('tab-epr').addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if (!btn || !document.getElementById('tab-epr').contains(btn)) return;
    switch (btn.dataset.action){
      case 'epr-dismiss-invalid': loadAlerts=''; rebuildAlerts(); break;
      case 'epr-dismiss-upload':  uploadAlerts=''; rebuildAlerts(); break;
      case 'epr-remove-pending':  delete pending[btn.dataset.stem]; renderPendingTable(); break;
      case 'epr-remove-all-pending': for (const k of Object.keys(pending)) delete pending[k]; renderPendingTable(); break;
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
      onRemoveAll(){ files.length=0; pending={}; loadAlerts=''; uploadAlerts=''; rebuildAlerts(); afterFilesChange(); },
    };
  }

  function rebuildAlerts(){
    document.getElementById('eprAlerts').innerHTML = loadAlerts + uploadAlerts;
    renderPendingTable();
  }

  function renderPendingTable(){
    const wrap = document.getElementById('eprPendingWrap');
    const entries = Object.entries(pending);
    if (!entries.length){ wrap.innerHTML = ''; return; }
    const phantoms = `<button style="opacity:0;pointer-events:none">↑</button><button style="opacity:0;pointer-events:none">↓</button>`;
    const rows = entries.map(([stem, pair]) => {
      const dtaCell = pair.dta ? `<span style="color:var(--good)">✓ .DTA</span>` : `<span style="color:var(--bad)">✗ .DTA</span>`;
      const dscCell = pair.dsc ? `<span style="color:var(--good)">✓ .DSC</span>` : `<span style="color:var(--bad)">✗ .DSC</span>`;
      const esc = stem.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      return `<tr class="pending-row"><td class="fname">${stem}</td><td>${dtaCell}</td><td>${dscCell}</td><td><div class="file-actions">${phantoms}<button class="pending-del" data-stem="${esc}" data-action="epr-remove-pending">${X_SVG(13)}</button></div></td></tr>`;
    }).join('');
    const colgroup = `<colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>`;
    const header = `<tr><th>FILE</th><th>.DTA</th><th>.DSC</th><th><div class="file-actions" style="display:flex;gap:4px;align-items:center;visibility:visible;white-space:nowrap">${phantoms}<button class="pending-del-all" data-action="epr-remove-all-pending">${X_SVG(13)}</button></div></th></tr>`;
    wrap.innerHTML = `<div style="background:#3a2c0f;border:1px solid #5a430f;border-radius:8px;padding:0 8px 8px;margin-top:10px"><div style="padding:8px 0 6px;font-size:12px;color:var(--warn)">⚠ Waiting for pair:</div><table class="pending-table" style="table-layout:fixed;width:100%">${colgroup}<thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
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

    for (const f of fileList){
      const ext  = f.name.split('.').pop().toLowerCase();
      const stem = f.name.replace(/\.[^.]+$/, '');
      if (ext !== 'dta' && ext !== 'dsc'){ invalidFiles.push(f.name); continue; }
      if (existingStems.has(stem)){ alreadyLoaded.push(f.name); continue; }
      if (!pending[stem]) pending[stem] = {dta: null, dsc: null};
      if (ext === 'dta') pending[stem].dta = f;
      else               pending[stem].dsc = f;
    }

    // Try to process complete pairs
    for (const [stem, pair] of Object.entries(pending)){
      if (pair.dta && pair.dsc){
        const result = await processPair(stem, pair.dta, pair.dsc);
        if (result){ result.color = nextColor(files); files.push(result); existingStems.add(stem); }
        else { invalidFiles.push(stem); }
        delete pending[stem];
      }
    }

    loadAlerts = invalidFiles.length ? buildAlertsHtml(invalidFiles, [], undefined, 'epr-dismiss-invalid') : '';
    uploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded, 'Already loaded file(s):', '', 'epr-dismiss-upload') : '';
    rebuildAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    setTabLoaded('epr', files.length);
    renderUnifiedFileList('eprFileTableWrap', files, fileCallbacks());
    if (files.length){
      document.getElementById('eprWorkspace').style.display='block';
      document.getElementById('eprExportCard').style.display='block';
      updateEpr();
    } else {
      document.getElementById('eprWorkspace').style.display='none';
      document.getElementById('eprExportCard').style.display='none';
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
    const plot = new Plot(document.getElementById('eprSvg'), {xlabel:'Magnetic Field (mT)', ylabel:'Intensity (a.u.)', noYTickLabels:true});
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

