import { fmtNum, fmtData, csvLine, downloadZip, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, movingAverage, maxArr, minArr, NORM_OPTIONS, normOf, buildAlertsHtml, nextColor, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, X_SVG, guardNumberInputs, esc } from './utils.js';
import { Plot } from './plot.js';
import { createDeck, cardInfo, fileSafe, nameDownloads } from './cards.js';

/* =========================================================
   EPR MODULE
========================================================= */
(function(){
  // Every file loaded, in list order; the analysis sees the included ones, `files`.
  let allFiles = []; // {name, label, b[], a[]}
  let files = [];
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
    pendingAlerts = names.length ? buildAlertsHtml([], names.map(esc),
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

    loadAlerts = invalidFiles.length ? buildAlertsHtml(invalidFiles.map(esc), [], undefined, 'epr-dismiss-invalid') : '';
    uploadAlerts = alreadyLoaded.length ? buildAlertsHtml([], alreadyLoaded.map(esc), 'Already loaded file(s):', '', 'epr-dismiss-upload') : '';
    buildPendingAlert(unpaired);
    rebuildAlerts();
    afterFilesChange();
  });

  function afterFilesChange(){
    files = includedOf(allFiles);
    setTabLoaded('epr', allFiles.length);
    renderUnifiedFileList('eprFileTableWrap', allFiles, fileCallbacks());
    document.getElementById('eprAnalyses').style.display = files.length ? 'block' : 'none';
    if (files.length) updateEpr();
    else rebuildAlerts();
    hist.commit();
  }

  /* ---- The analysis cards (cards.js): each its own normalisation and smoothing of the
     same spectra, stacked on its own plot ---- */
  const KINDS = { spectra: 'Stacked Spectra' };
  const EPR_INFO = `Spectra are stacked for visual comparison, each normalized to the largest peak-to-peak (global) or to its own (local), or left as they are (none: the stacking only spaces them). Adjust the smoothing window and normalization mode as needed. The field axis is each spectrum's field <b>rescaled to 9.5 GHz</b>, B·(9.5 GHz / ν) with ν the microwave frequency of its .DSC (MWFQ), so that spectra recorded at different frequencies line up by g; the CSV gives the field the same way (Bfield_mT_at_9.5GHz). The top axis reads <b>g = hν / (μ<sub>B</sub>·B)</b> at 9.5 GHz. A file without its frequency is shown on the field it was measured at, and then no g axis can be drawn. ${cardInfo(false, false)}`;
  const DEF = { norm: 'global', smooth: 10 };
  const P = a => 'epr' + a.id;
  const DL_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>`;
  const cardBody = a => `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">
            <div class="plot-wrap">
              <svg class="plot" id="${P(a)}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${P(a)}Svg" data-csv-mod="epr" data-csv-names="epr_spectra.csv" data-dl-name="EPR.svg" data-dl-legend="${P(a)}Legend">${DL_ICON}</button>
            </div>
            <div id="${P(a)}Legend" class="legend"></div>
          </div>
          <div class="col mw260" style="align-self:flex-start">
            <div class="txt-mini param-head">Parameters</div>
            <label class="txt-label" for="${P(a)}Norm">Normalization</label>
            <select id="${P(a)}Norm">${NORM_OPTIONS}</select>
            <label class="txt-label" for="${P(a)}Smooth">Smoothing points</label>
            <input type="number" id="${P(a)}Smooth" value="10" min="1">
          </div>
        </div>`;
  // The card's fields show its record; a change is taken on confirm, not while typing
  // (the normalisation a <select>, its change a deliberate pick; the smoothing a guarded number
  // field, whose change only fires with a valid value).
  function buildCard(a, card){
    guardNumberInputs(card);
    const norm = card.querySelector('#' + P(a) + 'Norm'), sm = card.querySelector('#' + P(a) + 'Smooth');
    norm.value = a.norm; sm.value = a.smooth;
    norm.addEventListener('change', ()=>{ a.norm = normOf(norm.value); if (files.length){ drawCard(a); hist.commit(); } });
    sm.addEventListener('change', ()=>{ a.smooth = Math.max(1, Math.round(+sm.value) || 1); if (files.length){ drawCard(a); hist.commit(); } });
  }
  function named(a){
    const card = deck.cardOf(a);
    if (card) nameDownloads(card.querySelector('.plot-wrap'), `${fileSafe(a.name)} - EPR.svg`, `${fileSafe(a.name)} - epr_spectra.csv`);
  }
  const deck = createDeck({
    list: document.getElementById('eprAnalyses'), addBar: document.getElementById('eprAddBar'), addBtn: document.getElementById('eprAddAn'),
    kinds: KINDS, info: ()=> EPR_INFO, body: cardBody, make: ()=> ({ ...DEF }),
    build: buildCard, drop: ()=>{}, autoName: ()=> 'Spectra', named,
    added: a=>{ if (files.length) drawCard(a); },
    wake: a=>{ if (files.length) drawCard(a, true); },
    commit: ()=> hist.commit(),
  });
  const cards = ()=> deck.records;

  /* ---- Undo/redo: file order/labels/colours + each card's normalization & smoothing ---- */
  function eprSnapshot(){
    return {
      files: allFiles.map(f=>({...f})),
      cards: cards().map(a=> ({ ...deck.saved(a), norm: a.norm, smooth: a.smooth })),
    };
  }
  // A project from before the cards had one analysis, its settings at the top level.
  const readCard = s => ({ norm: normOf(s.norm), smooth: Math.max(1, Math.round(+s.smooth) || DEF.smooth) });
  function eprRestore(s){
    allFiles = s.files.map(f=>({...f}));
    files = includedOf(allFiles);
    deck.load(Array.isArray(s.cards) ? s.cards : [{ id: 1, type: 'spectra', norm: s.norm, smooth: s.smooth }], readCard, a=>{
      const card = deck.cardOf(a);
      card.querySelector('#' + P(a) + 'Norm').value = a.norm;
      card.querySelector('#' + P(a) + 'Smooth').value = a.smooth;
    });
    afterFilesChange();
    // Clear the previous tab's transient alerts, then rebuild.
    loadAlerts = ''; uploadAlerts = ''; pendingAlerts = ''; rebuildAlerts();
  }
  const hist = registerHistory('epr', eprSnapshot, eprRestore);
  registerTabRedraw('epr', ()=>{ if (files.length){ deck.fitNames(); updateEpr(true); } });

  // Every card unfolded is drawn; a folded one is drawn as it comes back (wake).
  function updateEpr(preserveView){
    if (!files.length) return;
    cards().forEach(a=>{ if (!deck.isFolded(a)) drawCard(a, preserveView); });
  }
  function drawCard(a, preserveView){
    const N = a.smooth || 1;
    const norm = a.norm;
    let Y = files.map(f=>movingAverage(f.a, N));
    // A fresh Plot is built each render, so grab the outgoing view first to keep the
    // current zoom on a resize / tab-switch redraw instead of snapping to full range.
    const old = document.getElementById(P(a) + 'Svg')._plot;
    const prev = (preserveView && old && isFinite(old.xmin)) ? {xmin:old.xmin,xmax:old.xmax,ymin:old.ymin,ymax:old.ymax} : null;
    /* The field is each spectrum's rescaled to 9.5 GHz (buildBAxis), so the axis says so
       and carries g along the top: g = hν/(μ_B·B) at that ν, 678.753 mT / B. A file
       without its frequency is on its measured field, where g cannot be read. */
    const at95 = files.every(f=> f.rescaled !== false);
    const plot = new Plot(document.getElementById(P(a) + 'Svg'), {xlabel: at95 ? 'Magnetic Field at 9.5 GHz (mT)' : 'Magnetic Field (mT)', ylabel:'Intensity (a. u.)', noYTickLabels:true,
      ...(at95 ? { topAxis: { label:'g', of: B=> G_AT_95/B, at: g=> G_AT_95/g, fmt: v=> v.toFixed(4) }, margin:{l:55,r:20,t:48,b:40} } : {})});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    const legend = document.getElementById(P(a) + 'Legend'); legend.innerHTML='';
    const n = Y.length;
    const allB = files.flatMap(f=>f.b);
    // (none: the spectra as they are, each centred in a slot as tall as the largest
    // peak-to-peak — the plot's unit — as global draws them divided by it)
    const gPP0 = Math.max(...Y.map(y=> maxArr(y) - minArr(y))) || 1, unit = norm==='none' ? gPP0 : 1;
    const baseOf = k => (n-1-k)*1.1*unit;
    if (norm==='local'){
      Y = Y.map((y,k)=>{ const mn=minArr(y),mx=maxArr(y); const sc=mx===mn?0:1.0/(mx-mn); return y.map(v=>(v-mn)*sc+baseOf(k)+0.05); });
    } else if (norm==='none'){
      Y = Y.map((y,k)=>{ const mid=(maxArr(y)+minArr(y))/2; return y.map(v=>v-mid+baseOf(k)+0.55*unit); });
    } else {
      Y = Y.map(y=>{ const m=minArr(y); return y.map(v=>v-m); });
      const gmax = Math.max(...Y.map(maxArr));
      Y = Y.map((y,k)=>{ const mid=maxArr(y)/(2*gmax); return y.map(v=>v/gmax+baseOf(k)+0.55-mid); });
    }
    plot.setRange(minArr(allB), maxArr(allB), baseOf(n-1), baseOf(0)+1.1*unit);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    // The composer gets the CSV's own "Smoothed_" column (smoothedOut): the same numbers
    // as the export, without the stacking offset.
    const sms = files.map(f=>movingAverage(f.a, N));
    const out = smoothedOut(sms, norm);
    Y.forEach((y,k)=>{
      const csvY = out[k];
      plot.line(files[k].b, y, files[k].color, 1.3, undefined,
                { raw: { xs: files[k].b, ys: csvY }, label: files[k].label, key: files[k].name });
      const s=document.createElement('span'); s.innerHTML=`<i style="background:${esc(files[k].color)}"></i>${esc(files[k].label)}`; legend.appendChild(s);
    });
  }

  // One CSV a card, named after it.
  function exportEprZip(){
    if (!files.length) return [];
    return cards().map(a=> ({ name: `${fileSafe(a.name)} - epr_spectra.csv`, text: cardCsv(a) }));
  }
  /* The smoothed column: moving average (N pts), then the user's normalisation — the
     background taken as the first point and divided by the peak-to-peak (local = own,
     global = largest across samples), matching the on-screen divisor; none: the smoothed
     trace as it is, background and all. */
  function smoothedOut(sms, norm){
    if (norm==='none') return sms;
    const ppks = sms.map(sm => (maxArr(sm)-minArr(sm)) || 1);
    const gPP = Math.max(...ppks);
    return sms.map((sm, k)=>{ const bg = sm[0] ?? 0, div = norm==='local' ? ppks[k] : gPP; return sm.map(v=>(v-bg)/div); });
  }
  function cardCsv(a){
    const N = a.smooth || 1;
    const sms = files.map(f=>movingAverage(f.a, N));
    const out = smoothedOut(sms, a.norm);
    // (as they are, intensities of any scale keep their digits, as the raw ones: fmtData)
    const fmt = a.norm==='none' ? fmtData : fmtNum;
    // Per sample: the (already g-corrected) field, the raw intensity — already
    // baseline-centred at import — and the processed smoothed trace.
    const cols = [];
    files.forEach((f,k)=>{
      // Rescaled to 9.5 GHz, which the header says: it is not the field measured.
      cols.push({h:(f.rescaled !== false ? 'Bfield_mT_at_9.5GHz_' : 'Bfield_mT_')+f.label, v:f.b.map(v=>fmtNum(v,6))});
      // Intensities of any scale keep their digits (fmtData): a tiny one is not 0.
      cols.push({h:'Raw_'+f.label,                   v:f.a.map(v=>fmtData(v,6))});
      cols.push({h:`Smoothed_${f.label} (N=${N})`,   v:out[k].map(v=>fmt(v,6))});
    });
    const maxLen = Math.max(0, ...cols.map(c=>c.v.length));
    let t = csvLine(cols.map(c=>c.h));
    for (let i=0;i<maxLen;i++) t += csvLine(cols.map(c=> i<c.v.length ? c.v[i] : ''));
    return t;
  }
  registerCsvExport('epr', exportEprZip);

  // A new project starts with one card.
  deck.start(['spectra']);
})();

