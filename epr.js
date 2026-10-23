import { fmtNum, fmtData, setupDropzone, maxArr, minArr, NORM_OPTIONS, normOf, buildAlertsHtml, nextColor, guardNumericInput, esc } from './utils.js';
import { boxSmooth, meanStep, widthText, ptsNum, ptsText } from './smooth.js';
import { Plot } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, num, numStr, finitePairs, cardList } from './modkit.js';
import { plotWrap, swatchLegend, viewOf, setView, viewKey } from './modcharts.js';
import { decodeText } from './textdata.js';

/* =========================================================
   EPR MODULE
========================================================= */
(function(){
  /* The module (modkit.js): every file loaded, in list order, {name, label, b[], a[]}, and
     the included ones, which the analysis sees, `files`; the alerts under the drop zone,
     `pending` the halves of a pair dropped alone; the cards' settings in the history. */
  const kit = moduleKit('epr', {
    parts: ['pending'],
    alerts: p =>{
      document.getElementById('eprAlerts').innerHTML = p.invalid + p.upload;
      document.getElementById('eprPendingWrap').innerHTML = p.pending;
    },
    refresh: afterFilesChange,
    // A label or a colour changed: the zoom kept, the data being the same.
    redraw: ()=> updateEpr(true),
    snapshot: ()=> ({ cards: cards().map(a=> ({ ...deck.saved(a), norm: a.norm, smoothW: a.smoothW })) }),
    // A file as a restore takes it (modkit RESTORED): its field and intensities, the points
    // where both are numbers, two at least (else it is left out).
    file: f =>{
      const p = finitePairs(f.b, f.a);
      return p && p[0].length > 1 ? { ...f, b: p[0], a: p[1], rescaled: f.rescaled !== false } : null;
    },
    // A project from before the cards had one analysis, its settings at the top level.
    restore: s => deck.load(cardList(s.cards, KINDS) || [{ id: 1, type: 'spectra', norm: s.norm, smooth: s.smooth }], readCard, a=>{
      const card = deck.cardOf(a);
      card.querySelector('#' + P(a) + 'Norm').value = a.norm;
      showW(a, card);
    }),
    redrawTab: ()=>{ if (files.length){ deck.fitNames(); updateEpr(true); } },
    // One CSV a card, named after it.
    csv: ()=> files.length ? cards().map(a=> ({ name: `${fileSafe(a.name)} - epr_spectra.csv`, text: cardCsv(a) })) : [],
  });
  const { all: allFiles, files } = kit;

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

  /* A pair read: the spectrum, or { error } saying why it cannot be: a field axis needs
     two points at least and its start and width (with XPTS 1 every field was NaN, to
     v483), and the data must be in a format the reader knows and as long as XPTS says. */
  async function processPair(stem, dtaFile, dscFile){
    const dscBytes = new Uint8Array(await dscFile.arrayBuffer());
    const p = parseDsc(decodeText(dscBytes));
    const npts = parseInt(p.XPTS);
    if (!(npts >= 2)) return { error: p.XPTS == null ? 'its .DSC gives no XPTS, the number of points' : `XPTS ${dscWord(p.XPTS)}: a spectrum needs two points at least` };
    if (!isFinite(parseFloat(p.XMIN)) || !isFinite(parseFloat(p.XWID))) return { error: 'its .DSC gives no field axis (XMIN and XWID)' };

    const bigEndian = (p.BSEQ || 'BIG') !== 'LIT';
    const dtaBuf = await dtaFile.arrayBuffer();
    const view = new DataView(dtaBuf);
    /* The values as IRFMT stores them (64-bit floats unless it says otherwise), and
       for complex data (IKKF CPLX) the real part of each real/imaginary pair: read
       as plain doubles, those came out as garbage or stretched over twice the axis. */
    const fmt = dscWord(p.IRFMT).split(',')[0].toUpperCase() || 'D';
    const READ = { D: [8, (o, le)=> view.getFloat64(o, le)], F: [4, (o, le)=> view.getFloat32(o, le)],
                   I: [4, (o, le)=> view.getInt32(o, le)],   S: [2, (o, le)=> view.getInt16(o, le)], C: [1, o=> view.getInt8(o)] };
    if (!READ[fmt]) return { error: `IRFMT ${fmt}: a data format not read` };
    const [size, read] = READ[fmt];
    const stride = dscWord(p.IKKF).split(',')[0].toUpperCase() === 'CPLX' ? 2 : 1;
    if (dtaBuf.byteLength < npts * stride * size) return { error: `its .DTA holds fewer than the ${npts} points its .DSC gives` };
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

    // Complete pairs load; a lone half is not (nothing is held back waiting for its
    // partner), and the alert `pending` says so.
    const unpaired = [];
    for (const [stem, pair] of Object.entries(groups)){
      if (pair.dta && pair.dsc){
        let result;
        try { result = await processPair(stem, pair.dta, pair.dsc); } catch(e){ result = { error: String(e && e.message || e) }; }
        if (!result.error){ result.color = nextColor(allFiles); kit.add(result); existingStems.add(stem); }
        else { invalidFiles.push(`${stem} (${result.error})`); }
      } else {
        unpaired.push((pair.dta || pair.dsc).name);
      }
    }
    kit.said(invalidFiles, alreadyLoaded);
    kit.alerts.pending = unpaired.length ? buildAlertsHtml([], unpaired.map(esc),
      'Not loaded — a .DTA and its .DSC must be uploaded together:', undefined, 'epr-dismiss-pending') : '';
    afterFilesChange();
  });

  function afterFilesChange(){
    kit.showFiles();
    document.getElementById('eprAnalyses').style.display = files.length ? 'block' : 'none';
    // (each card's points at the spectra's steps, folded or not)
    cards().forEach(a=> syncPts(a));
    updateEpr();
    kit.commit();
  }

  /* ---- The analysis cards (cards.js): each its own normalisation and smoothing of the
     same spectra, stacked on its own plot ---- */
  const KINDS = { spectra: 'Stacked Spectra' };
  const EPR_INFO = `Spectra are stacked for visual comparison, each normalized to the largest peak-to-peak (global) or to its own (local), or left as they are (none: the stacking only spaces them). The <b>smoothing</b> takes at each point the mean of the line through the points over a window w wide (mT, on the field as plotted) centred on it, a box convolution, cut short at the ends; 0 is none. Being a width on the field axis, one setting smooths alike spectra recorded at different steps; its field shows beside it the points it spans at their steps (a range when the steps differ). The field axis is each spectrum's field <b>rescaled to 9.5 GHz</b>, B·(9.5 GHz / ν) with ν the microwave frequency of its .DSC (MWFQ), so that spectra recorded at different frequencies line up by g; the CSV gives the field the same way (Bfield_mT_at_9.5GHz). The top axis reads <b>g = hν / (μ<sub>B</sub>·B)</b> at 9.5 GHz. A file without its frequency is shown on the field it was measured at, and then no g axis can be drawn. ${cardInfo(false, false)}`;
  // (the smoothing a width in mT, 0.2 about 10 points of a 1024-point, 20-mT sweep; to v510
  // a number of points, `smooth`, 10: readCard converts it)
  const DEF = { norm: 'global', smoothW: 0.2 };
  const P = a => 'epr' + a.id;
  const cardBody = a => `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">${plotWrap(P(a) + 'Svg', { mod: 'epr', csv: 'epr_spectra.csv', name: 'EPR.svg', legend: P(a) + 'Legend' })}
            <div id="${P(a)}Legend" class="legend"></div>
          </div>
          <div class="col mw260" style="align-self:flex-start">
            <div class="txt-mini param-head">Parameters</div>
            <label class="txt-label" for="${P(a)}Norm">Normalization</label>
            <select id="${P(a)}Norm">${NORM_OPTIONS}</select>
            <label class="txt-label" for="${P(a)}Smooth">Smoothing width (mT)</label>
            <label class="wfield" title="The smoothing box's width, in mT on the plotted field (0: none); beside it, the points it spans at the spectra's steps"><input type="text" inputmode="decimal" id="${P(a)}Smooth" value="${DEF.smoothW}" autocomplete="off" aria-describedby="${P(a)}SmoothPts"><span class="wf-pts" id="${P(a)}SmoothPts"></span></label>
          </div>
        </div>`;
  // The card's fields show its record; a change is taken on confirm, not while typing
  // (the normalisation a <select>, its change a deliberate pick; the smoothing a guarded decimal
  // field, whose change only fires with a value from 0; its points follow what is typed).
  function buildCard(a, card){
    const norm = card.querySelector('#' + P(a) + 'Norm'), sm = card.querySelector('#' + P(a) + 'Smooth');
    guardNumericInput(sm, { min: 0, def: DEF.smoothW });
    norm.value = a.norm; showW(a, card);
    norm.addEventListener('change', ()=>{ a.norm = normOf(norm.value); if (files.length){ drawCard(a); kit.commit(); } });
    sm.addEventListener('change', ()=>{
      if (sm.value !== sm._shown) a.smoothW = Math.max(0, parseFloat(String(sm.value).replace(',', '.')) || 0);
      showW(a, card);
      if (files.length){ drawCard(a); kit.commit(); }
    });
    // (and as it is left: a value refused is set back with no input event)
    ['input', 'blur'].forEach(t=> sm.addEventListener(t, ()=> syncPts(a, card)));
  }
  /* The width in its field to 4 significant digits, kept exact in the record (one converted
     from points stays as it was: only a value typed replaces it), and its points. */
  function showW(a, card = deck.cardOf(a)){
    const sm = card && card.querySelector('#' + P(a) + 'Smooth');
    if (!sm) return;
    sm.value = sm._shown = widthText(a.smoothW);
    syncPts(a, card);
  }
  /* What the width typed spans in points of the card's spectra, at each one's step, after
     it in its field: one number, or the range when the steps differ (off at 0, nothing with
     no spectrum or no value). */
  function syncPts(a, card = deck.cardOf(a)){
    const sm = card && card.querySelector('#' + P(a) + 'Smooth'), out = card && card.querySelector('#' + P(a) + 'SmoothPts');
    if (!sm || !out) return;
    // (the record's width, exact, while the field shows it unchanged)
    const w = sm.value === sm._shown && Number.isFinite(a.smoothW) ? a.smoothW : parseFloat(String(sm.value).trim().replace(',', '.'));
    const ps = files.map(f=> w/meanStep(f.b)).filter(p=> p >= 0 && isFinite(p));
    let t = '', tip = '';
    if (ps.length && ps.length === files.length){
      const lo = Math.min(...ps), hi = Math.max(...ps);
      t = !w ? 'off' : ptsNum(lo) === ptsNum(hi) ? ptsText(lo) : `≈ ${ptsNum(lo)}–${ptsNum(hi)} pts`;
      tip = !w ? 'No smoothing' : files.map((f, k)=> `${f.label}: ${widthText(ps[k])} steps of ${widthText(meanStep(f.b))} mT`).join('\n');
    }
    if (out.textContent !== t) out.textContent = t;
    if (out.title !== tip) out.title = tip;
  }
  function named(a){
    const card = deck.cardOf(a);
    if (card) nameDownloads(card.querySelector('.plot-wrap'), `${fileSafe(a.name)} - EPR.svg`, `${fileSafe(a.name)} - epr_spectra.csv`);
  }
  const deck = kit.deck({
    kinds: KINDS, info: ()=> EPR_INFO, body: cardBody, make: ()=> ({ ...DEF }),
    build: buildCard, drop: ()=>{}, autoName: ()=> 'Spectra', named,
    added: a=>{ if (files.length) drawCard(a); },
    wake: a=>{ if (files.length) drawCard(a, true); },
  });
  const cards = ()=> deck.records;
  /* A card's settings in the history: its normalization and smoothing width (kit.snapshot),
     a number from 0, else the default. Up to v510 the smoothing was a number of points,
     `smooth` (a whole number from 1, a string in a project from before the cards; modkit
     RESTORED): it becomes N times the median step of the spectra, as it was on those at
     that step (to rounding, for an even N; N = 1, none, is 0), the others smoothed by
     the ratio of their steps; with no spectrum, or no such number, the default. */
  const readCard = s =>{
    const st = files.map(f=> meanStep(f.b)).sort((x, y)=> x - y), med = st[st.length >> 1];
    const N = Math.round(num(numStr(s.smooth), NaN, v=> v >= 1));
    const w = 'smoothW' in s ? num(s.smoothW, NaN, v=> v >= 0) : N === 1 ? 0 : N*med;
    return { norm: normOf(s.norm), smoothW: Number.isFinite(w) ? w : DEF.smoothW };
  };

  // Every card unfolded is drawn; a folded one is drawn as it comes back (wake).
  function updateEpr(preserveView){
    if (!files.length) return;
    cards().forEach(a=>{ if (!deck.isFolded(a)) drawCard(a, preserveView); });
  }
  function drawCard(a, preserveView){
    const norm = a.norm;
    let Y = files.map(f=> boxSmooth(f.b, f.a, a.smoothW));
    // A fresh Plot is built each render, so grab the outgoing view first to keep the
    // current zoom on a resize / tab-switch redraw instead of snapping to full range.
    // (only on the same spectra and the same full range: modcharts setView)
    const prev = preserveView ? viewOf(document.getElementById(P(a) + 'Svg')._plot) : null;
    /* The field is each spectrum's rescaled to 9.5 GHz (buildBAxis), so the axis says so
       and carries g along the top: g = hν/(μ_B·B) at that ν, 678.753 mT / B. A file
       without its frequency is on its measured field, where g cannot be read. */
    const at95 = files.every(f=> f.rescaled !== false);
    const plot = new Plot(document.getElementById(P(a) + 'Svg'), {xlabel: at95 ? 'Magnetic Field at 9.5 GHz (mT)' : 'Magnetic Field (mT)', ylabel:'Intensity (a. u.)', noYTickLabels:true,
      ...(at95 ? { topAxis: { label:'g', of: B=> G_AT_95/B, at: g=> G_AT_95/g, fmt: v=> v.toFixed(4) }, margin:{l:55,r:20,t:48,b:40} } : {})});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    document.getElementById(P(a) + 'Legend').innerHTML = swatchLegend(files);
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
      // Spectra all flat have no peak-to-peak to divide by: drawn as they are, each a line
      // in its slot (to v494 0/0 drew nothing).
      const gmax = Math.max(...Y.map(maxArr)), g = gmax > 0 && isFinite(gmax) ? gmax : 1;
      Y = Y.map((y,k)=>{ const mid=maxArr(y)/(2*g); return y.map(v=>v/g+baseOf(k)+0.55-mid); });
    }
    plot.setRange(minArr(allB), maxArr(allB), baseOf(n-1), baseOf(0)+1.1*unit);
    setView(plot, prev, viewKey(files));
    plot.drawAxes();
    // The composer gets the CSV's own "Smoothed_" column (smoothedOut): the same numbers
    // as the export, without the stacking offset.
    const sms = files.map(f=> boxSmooth(f.b, f.a, a.smoothW));
    const out = smoothedOut(sms, norm);
    Y.forEach((y,k)=> plot.line(files[k].b, y, files[k].color, 1.3, undefined,
      { raw: { xs: files[k].b, ys: out[k] }, label: files[k].label, key: files[k].name }));
  }

  /* The smoothed column: the box w wide (smooth.js; to v510 a moving average over N
     points), then the user's normalisation — the background taken as the first point and
     divided by the peak-to-peak (local = own, global = largest across samples), matching
     the on-screen divisor; none: the smoothed trace as it is, background and all. */
  function smoothedOut(sms, norm){
    if (norm==='none') return sms;
    const ppks = sms.map(sm => (maxArr(sm)-minArr(sm)) || 1);
    const gPP = Math.max(...ppks);
    return sms.map((sm, k)=>{ const bg = sm[0] ?? 0, div = norm==='local' ? ppks[k] : gPP; return sm.map(v=>(v-bg)/div); });
  }
  function cardCsv(a){
    const sms = files.map(f=> boxSmooth(f.b, f.a, a.smoothW));
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
      // (the width in mT as its field shows it; to v510 the points, N=)
      cols.push({h:`Smoothed_${f.label} (w=${widthText(a.smoothW)} mT)`,   v:out[k].map(v=>fmt(v,6))});
    });
    return wideCsv(cols);
  }

  // A new project starts with one card.
  deck.start(['spectra']);
})();

