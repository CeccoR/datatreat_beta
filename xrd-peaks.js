/* =========================================================
   XRPD — the peak analysis (Scherrer).
   A panel of its own on some files: the raw pattern, its smoothing (smooth.js),
   the SNIP baseline and the peaks found on what is left, with their FWHM and, for
   the samples, the Scherrer crystallite size of each. Made for a card (the samples,
   several cards each with its own parameters) or for the instrumental standard (one
   file, its own parameters, and the Caglioti fit of its widths that corrects the
   samples' sizes for the instrument's).
   Its calculations are xrd-peaks-model.js's and its words and markup that need no page
   xrd-peaks-html.js's (both tested in Node, v552): here, the card's wiring.
========================================================= */
import { esc, fmtNum, csvLine, linspace, interpLinear, meanArr, stdArr, boxStats, maxArr, minArr, X_SVG, guardNumericInput, guardNumberInputs, fitCsvIcons, barNames, barChipYmax, NORM_OPTIONS, normOf, keeper } from './utils.js';
import { svgEl, Plot, axisReadout } from './plot.js';
import { meanStep, widthText, ptsText } from './smooth.js';
import { PLOT_DL_ICON, CSV_ICON } from './modcharts.js';
import { snavHtml, snav } from './snav.js';
import { nearestIdx, fwhmGeom, smoothingOf, processingOf, instrModelOf, sampleSizes, sizeReflections, byPeakOk, reflectionRows, sizeSeries, boxTop, sizeTops, topOf,
  modeDef, FIELD_DEF, SHOWN, sharedDef, FIELD_MIN, LEGACY, modeOf, objOf, entryOf, fileParams, stateOf, readState, csvTables } from './xrd-peaks-model.js';
import { stepNoteHtml, peakTableHtml, cagliotiHtml, sizeChipsHtml, sizeNoteHtml } from './xrd-peaks-html.js';

/* A view (a plot, a table, a chart, a legend) is drawn again only when what it is drawn
   from changed: each keeps the key of its inputs as last drawn, the objects among them by
   a number of their own (idOf: the same object, the same number; a pattern's arrays and a
   processing kept, below, stay the same objects), and its size on the page (sizeOf: 0 when
   out of sight, so that a view drawn hidden is drawn again when shown). Up to v490 every
   edit drew every view of the card again, and a label changed or the standard's peaks did
   so in every card: with 12 patterns, 90 ms for a K changed, 160 for a label. A value
   that is no object is there as itself (a WeakMap takes no such key). */
const ids = new WeakMap();
let nid = 0;
const idOf = o => o == null ? '-' : typeof o !== 'object' && typeof o !== 'function' ? typeof o + ':' + String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
const sizeOf = el => { if (!el) return '-'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
// (a plot at the range it was drawn with: not zoomed nor panned)
const atOrigin = P => P.xmin === P._origXmin && P.xmax === P._origXmax && P.ymin === P._origYmin && P.ymax === P._origYmax;
/* A pattern's processing (reprocessOne), kept by its intensities (utils.js keeper): its
   smoothing and baseline by their widths (k1), its peaks by those and the peak search and
   the peaks added and removed by hand (k2); and the standard's instrumental model by its
   processing (modelOf). A tab woken, an undo to widths used before, a card made again
   take them as made (to v517 a card kept its own, and a tab shown again made all again). */
const smoothKept = keeper('xrd-smoothing'), procKept = keeper('xrd-peaks', 8), modelOf = new WeakMap();
/* utils.js's helpers, which need a page to load, as the calculations and the markup take
   them (xrd-peaks-model.js, xrd-peaks-html.js: no page, imported by Node's tests too). */
const U = { maxArr, meanArr, stdArr, boxStats, fmtNum, csvLine, esc, X_SVG };

// Peak marker colours
const PEAK_BASE = '#3f9d54';   // darker green, base
const PEAK_HOVER = '#5fcf6a';  // brighter green, transient hover
const PEAK_SEL  = '#ffffff';   // white, permanent selection
const FWHM_BASE  = '#b5292c';  // dark red, base (contrasts with the dark background)
const FWHM_HOVER = '#ff5a5a';  // brighter red, transient hover
const FWHM_SEL   = '#ff0000';  // pure red, permanent selection

export const PEAKS_INFO = `Per-sample view. Raw pattern (grey), smoothing (blue), SNIP baseline (orange) and detected peaks (green). The <b>smoothing</b> takes at each point the mean of the line through the points over a window w wide (°2θ) centred on it, a box convolution, cut short at the ends of the pattern; 0 is none. The <b>SNIP</b> (Statistics-sensitive Non-linear Iterative Peak-clipping) baseline iteratively clips each point downward toward the average of the curve on either side at decreasing distances, from half its width W (°2θ) down to one step, so the peaks are cut away and the slowly varying background is left; its box unticked, there is none, and the pattern is read from zero as it is. Both are widths on the 2θ axis, so that one setting treats alike patterns measured at different steps; each field shows beside its value the points it spans at the step of the pattern on show. Peaks are searched on the smoothed pattern with the baseline taken off: a peak must reach the minimum height and stand out by the minimum prominence (both in % of the highest), and two peaks closer than the minimum distance keep the taller. The FWHM is read where the profile crosses half its height, interpolated between points; the crystallite size is Scherrer's, D = Kλ / (β·cosθ). With an instrumental standard (<b>Instrumental standard…</b>), the instrument's width at each angle is taken off in quadrature, β² = β<sub>obs</sub>² − β<sub>instr</sub>², for the corrected size. <b>+ Add peak</b> places a peak by hand on the plot; the × in a row removes one. Use the <b>all / one</b> toggles to share a value across samples or set it per sample.`;
export const STD_INFO = `A measured standard (large, strain-free crystallites — LaB₆, Si…) characterises the instrumental broadening β<sub>instr</sub>(2θ). It is analysed here on its own, always normalised to its highest peak (= 1), with parameters of its own. Its peaks' FWHM are fitted with the Caglioti function, FWHM² = U·tan²θ + V·tanθ + W, which gives the instrument's width at any angle: the samples' corrected sizes take it off in quadrature. One file at a time: a file dropped replaces the one there.`;

/* host: {
     files()          the files analysed (the included samples; the standard's one)
     idx(), step(d)   the sample on show, shared by the cards, and stepping it (samples)
     commit()         a step of the undo history
     instr()          the standard's model { pts, fit } or null (samples)
     changed()        its peaks or sizes changed: the standard's, every card's sizes follow;
                      a card's, its Results section is redrawn by itself
     openStd()        open the standard's modal (samples)
     allFiles()       every file loaded, for the steps of those left out (samples)
     hidden()         the card is folded: nothing is drawn
   }
   o: { prefix, standard } */
export function createPeakAnalysis(host, root, o){
  const p = o.prefix, std = !!o.standard;
  root.innerHTML = cardHtml(p, std);

  // A card's section of the Results: the patterns stacked, and the crystallite sizes.
  const res = std ? null : document.createElement('div');
  if (res){
    res.className = 'res-an';
    res.innerHTML = resHtml(p);
  }
  // The elements, found in the card or its section whether or not they are in the page.
  const $$ = id => root.querySelector('#' + p + id) || (res && res.querySelector('#' + p + id));

  const files = ()=> host.files();
  let processed = []; // per file: {smoothed, baseline, subtracted, peaks}
  let manualPeaks = []; // per file: array of manually added 2θ positions
  let removedPeaks = []; // per file: array of removed peaks' detected 2θ positions
  const curIdx = ()=> std ? 0 : host.idx();
  let nav = null;     // its sample selector (snav.js; none on the standard's)
  // Per-field mode: 'shared' | 'per' (xrd-peaks-model.js modeDef: peak-search fields
  // per-sample, the rest shared; the standard's all shared).
  const MODE_DEF = modeDef(std);
  const paramMode = { ...MODE_DEF };
  // Shared param values (xrd-peaks-model.js FIELD_DEF; the standard's own start
  // unsmoothed: sharedDef).
  const SHARED_DEF = sharedDef(std);
  const shared = { ...SHARED_DEF };
  // Per-sample param overrides (indexed by file idx). blOn: the SNIP baseline subtracted
  // (its box ticked, the default) or not; it goes with its width, under the width's
  // all / one (paramMode.blWin). Absent (projects before v463) is on.
  let perParams = []; // array of {smoothW, snipW, blOn, pkHeight, pkProm, pkDist, K, lambda}
  // What the crystallite-size box plot is by: each sample's peaks ('sample'), or each
  // reflection the samples share, over the samples ('peak').
  let sizeBy = 'sample';
  // The chips a project's conversion turned to one, its patterns' steps differing (restore),
  // whose note shows under the fields until each is shared again or the note dismissed.
  let stepNote = [];
  // And, files being left out then, those chips' values in points as v510 shared them
  // ({ N, blWin }): such a file taken back in has them at its own step, as v510 gave it
  // the shared value under all (its own entry, held, not in use), until the chip is shared again.
  let heldPts = {};
  let norm = 'global';
  // Selection/hover state of the peak table and plot.
  const panel = { sel:null, hov:null };
  let anaPlot = null;

  // input id ↔ stored field key
  const FIELD_INPUT = std ? { smoothW:'Smooth', snipW:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist' }
    : { smoothW:'Smooth', snipW:'BlWin', pkHeight:'PkHeight', pkProm:'PkProm', pkDist:'PkDist', K:'K', lambda:'Lambda' };

  // Validation feedback (shake + auto-correct) for the decimal (type=text) fields;
  // the number fields are guarded as any of the page's. Wired before the fields' own
  // change handlers.
  guardNumberInputs(root);
  [ ['Smooth',0,SHARED_DEF.smoothW], ['BlWin',1e-6,FIELD_DEF.snipW*SHOWN.snipW], ['PkHeight',0,5], ['PkProm',0,3], ['PkDist',0,0.3], ...(std ? [] : [['K',1e-6,0.9], ['Lambda',1e-6,1.540598]]) ]
    .forEach(([id,min,def])=> guardNumericInput($$(id), { min, def }));

  // Get params for a specific file index (respects per-field shared/per mode)
  function getFileParams(i){ return fileParams(perParams[i] || {}, paramMode, shared); }
  // Every file's, in order.
  const paramsAll = ()=> files().map((_, k)=> getFileParams(k));
  // Parse a decimal field tolerant of comma separators; only fall back on a genuinely empty/invalid value
  function numField(id, def){
    const raw = String($$(id).value).trim().replace(',', '.');
    if (raw === '') return def;
    const v = parseFloat(raw);
    return isNaN(v) ? def : v;
  }
  // Read inputs into the appropriate store for the sample on show; with no file, every
  // value into the shared ones, those a file loaded starts from (addFile).
  function readInputsToStore(){
    const k = curIdx(), own = m => paramMode[m]!=='shared' && files().length > 0;
    for (const key in FIELD_INPUT){
      // (a width's field as written, to 4 significant digits, is the value stored, kept
      // exact: only a value typed replaces it)
      const el = $$(FIELD_INPUT[key]);
      const sh = SHOWN[key] || 1;
      const v = key in LEGACY && el.value === el._shown ? el._exact : Math.max(FIELD_MIN[key], numField(FIELD_INPUT[key], FIELD_DEF[key]*sh)/sh);
      if (!own(modeOf(key))) shared[key] = v;
      else { if (!perParams[k]) perParams[k] = {}; perParams[k][key] = v; }
    }
    const on = $$('BlOn').checked;
    if (!own('blWin')) shared.blOn = on;
    else { if (!perParams[k]) perParams[k] = {}; perParams[k].blOn = on; }
  }
  // Push stored values for the sample on show into the input fields
  function writeStoreToInputs(){
    const pr = getFileParams(curIdx());
    for (const key in FIELD_INPUT){
      const el = $$(FIELD_INPUT[key]);
      if (key in LEGACY){ el.value = el._shown = widthText(pr[key]*SHOWN[key]); el._exact = pr[key]; }
      else el.value = pr[key];
    }
    // (disabled, not hidden: the width means nothing with no baseline)
    $$('BlOn').checked = pr.blOn; $$('BlWin').disabled = !pr.blOn;
    if (!std){ $$('Norm').value = norm; syncLambdaSelect(); }
    syncHints();
    syncStepNote();
  }
  /* What each width spans in points of the pattern on show (the standard's: its file),
     in its field after the value, from the value as it is typed: the width over the step
     (the smoothing off at 0; the SNIP's passes on each side, as computeBaseline rounds
     them, in its title; to v515 those, '±K pts', in the field). Nothing with no file, or
     no value. */
  function syncHints(){
    const fs = files(), f = fs[Math.min(curIdx(), fs.length - 1)], st = f ? meanStep(f.x) : NaN;
    for (const id of ['Smooth', 'BlWin']){
      // (the width stored, exact, while the field shows it unchanged: one converted from
      // points is that many steps, not its 4 digits' worth)
      const el = $$(id), sh = id === 'BlWin' ? SHOWN.snipW : 1;
      const v = el.value === el._shown && Number.isFinite(el._exact) ? el._exact*sh : parseFloat(String(el.value).trim().replace(',', '.')), out = $$(id + 'Pts');
      let t = '', tip = '';
      if (st > 0 && v >= 0 && isFinite(v)){
        const at = ` at the step of ${f.label}, ${widthText(st)}°`;
        if (id === 'Smooth'){ t = v ? ptsText(v/st) : 'off'; tip = v ? `${widthText(v/st)} steps${at}` : 'No smoothing'; }
        else if (v > 0){ const K = Math.max(1, Math.round(v/sh/st) || 1); t = ptsText(v/st); tip = `${widthText(v/st)} steps across, ${K} point${K === 1 ? '' : 's'} on each side${at}`; }
      }
      if (out.textContent !== t) out.textContent = t;
      if (out.title !== tip) out.title = tip;
    }
  }
  // (and as it is left: a value refused is set back with no input event)
  for (const id of ['Smooth', 'BlWin']) ['input', 'blur'].forEach(t=> $$(id).addEventListener(t, syncHints));
  // The note of a project to v510 whose patterns' steps differ, with its ×.
  let stepHtml = '';
  function syncStepNote(){
    const el = $$('StepNote');
    if (!el) return;
    const t = stepNoteHtml(stepNote.filter(m=> paramMode[m] === 'per'), U);
    if (t !== stepHtml){ stepHtml = t; el.innerHTML = t; }
  }
  if (!std) $$('StepNote').addEventListener('click', e=>{
    if (!e.target.closest('[data-step-x]')) return;
    stepNote = []; syncStepNote(); host.commit();
  });
  // Keep the wavelength preset selector in step with the numeric λ value: pick the
  // matching source preset (else "Custom"), and lock the value field unless Custom.
  function syncLambdaSelect(){
    const inp = $$('Lambda'), sel = $$('LambdaSel');
    if (!inp || !sel) return;
    const v = parseFloat(String(inp.value).replace(',','.'));
    let matched = 'custom';
    for (const o of sel.options){ if (o.value!=='custom' && Math.abs(parseFloat(o.value)-v) < 5e-5){ matched = o.value; break; } }
    sel.value = matched;
    inp.readOnly = (matched !== 'custom');
  }

  /* A pattern's processing is kept while what it is made from is the same (its arrays
     never change: xrd.js), so that what is drawn from it is not drawn again: the smoothing
     and the baseline by the 2θ, the intensities and their widths (k1; to v510, in points,
     not the 2θ), the peaks by those, the variance factors, the peak search and the peaks
     added and removed by hand (k2).
     Up to v490 every edit made both anew for every pattern it touched or not (a shared
     field, a restore), and a peak-search field the smoothing and the baseline too. */
  function procKeys(i){
    const pr = getFileParams(i), f = files()[i];
    const k1 = [idOf(f.y), idOf(f.x), pr.smoothW, pr.blOn ? pr.snipW : 'off'].join('|');
    return { k1, k2: [k1, idOf(f.varMul), pr.pkHeight, pr.pkProm, pr.pkDist, (manualPeaks[i]||[]).join(), (removedPeaks[i]||[]).join()].join('|') };
  }
  function reprocessOne(i){
    const { k1, k2 } = procKeys(i), f = files()[i];
    processed[i] = procKept(f.y, k2, ()=> processOf(i, f, k1, k2));
  }
  // (xrd-peaks-model.js: the smoothing and the baseline, kept by k1, then the peaks)
  function processOf(i, f, k1, k2){
    const pr = getFileParams(i);
    const sm = smoothKept(f.y, k1, ()=> smoothingOf(f.x, f.y, pr));
    return { ...processingOf(f, sm, pr, manualPeaks[i], removedPeaks[i], U), k1, k2 };
  }
  function reprocessAll(){
    processed = [];
    for (let i=0; i<files().length; i++) reprocessOne(i);
  }

  // The standard's peaks the instrumental width is taken from, in 2θ order, and the
  // Caglioti fit to them (null with fewer than 3; xrd-peaks-model.js instrModelOf). Null
  // with no file. Kept by the standard's processing (modelOf): one object, which the
  // samples' views take among their inputs (up to v490 made anew for each size read, a fit
  // each time).
  function instrModel(){
    if (!std || !files().length || !processed[0]) return null;
    let m = modelOf.get(processed[0]);
    if (m) return m;
    modelOf.set(processed[0], m = instrModelOf(processed[0].peaks));
    return m;
  }
  // The samples' correction, from the standard's model (host.instr).
  const model = ()=> std ? null : host.instr();
  // The classic crystallite sizes of a sample's kept peaks, summarised (xrd-peaks-model.js
  // sampleSizes).
  const sampleSizeStats = i => sampleSizes(processed[i], getFileParams(i), model(), std, U);

  /* ---- The plot: raw, smoothed, SNIP baseline, peaks (no fit). Each pattern is
     normalised to its own smoothed max (= 1). ---- */
  // The plot drawn from the pattern and its processing, as last drawn: the same again, it
  // stays as it is (kept in view, as preserveView keeps it; else only where not zoomed).
  let anaKey = '';
  function drawAnalysisInto(idx, preserveView){
    const f  = files()[idx];
    const pr = processed[idx];
    if (!f || !pr) return;
    const svgNode = $$('Svg');
    const key = [idx, idOf(f.x), idOf(f.y), idOf(pr), sizeOf(svgNode)].join('|');
    if (anaPlot && key === anaKey && (preserveView || atOrigin(anaPlot))){ highlightPanel(); return; }
    anaKey = '';
    const mx = maxArr(pr.smoothed) || 1;
    const prevPlot = anaPlot;
    const prev = (preserveView && prevPlot) ? {xmin:prevPlot.xmin, xmax:prevPlot.xmax, ymin:prevPlot.ymin, ymax:prevPlot.ymax} : null;

    const ndense = Math.min(20000, Math.max(4000, f.x.length*10));
    const dense  = linspace(f.x[0], f.x[f.x.length-1], ndense);
    const baseD  = interpLinear(f.x, pr.baseline, dense);

    const plot  = new Plot(svgNode, {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
    plot.attachTools(svgNode.closest('.plot-wrap'));
    plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
    if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
    plot.drawAxes();
    plot.line(f.x, f.y.map(v=>v/mx),         '#6a7585', 1);
    plot.line(f.x, pr.smoothed.map(v=>v/mx), '#3aa0ff', 1.4);
    const blOn = getFileParams(idx).blOn;
    if (blOn) plot.line(dense, baseD.map(v=>v/mx), '#ff9933', 1.2);
    // (the legend's entry stays, struck through: no baseline on this pattern)
    root.querySelectorAll('.lg-bl').forEach(e=> e.classList.toggle('is-off', !blOn));
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
    plot._onView = ()=>{ buildInteractiveMarks(plot); highlightPanel(); };
    buildInteractiveMarks(plot);
    highlightPanel();
    anaKey = key;
  }

  // The sample on show (the standard's file), its plot and its label.
  function updateView(preserveView){
    const fs = files();
    // (the selector: none on the standard's, its window names it)
    if (nav) nav.update();
    if (!fs.length || !processed.length) return;
    const k = Math.min(curIdx(), fs.length - 1);
    if (host.hidden()) return;
    drawAnalysisInto(k, preserveView);
  }

  const nearestLine = (lines, pos)=>{ let best=null,bd=Infinity; if(pos!=null) for(const el of lines){ const d=Math.abs(el._value-pos); if(d<bd){bd=d;best=el;} } return bd<0.6?best:null; };
  // Recolour the plot's peak vlines AND their FWHM markers from the selection/hover.
  function highlightPanel(){
    const plot = anaPlot; if (!plot) return;
    const all = [...plot.gOverlay.querySelectorAll('line')];
    const peakLines = all.filter(el=>el._value!==undefined && !el._fwhm && !el._hit);
    const fwhmSegs  = all.filter(el=>el._fwhm && !el._hit);
    const selEl = nearestLine(peakLines, panel.sel);
    const hovEl = nearestLine(peakLines, panel.hov);
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

  // Twin invisible thick "hit" line as a hover listener (à la Tauc draggable bars),
  // so peaks and FWHM markers have a fat, responsive target. Scheduled clear on leave
  // is cancelled by any enter within the same frame, avoiding flicker when the pointer
  // slides between a peak's vertical hit line and its horizontal FWHM hit line.
  let markHoverRAF = null;
  function addMarkHover(el, pos){
    el.addEventListener('pointerenter', ()=>{
      const plot = anaPlot;
      if (!plot || plot._mode) return;            // pan/zoom armed
      if (addPeak.isAdding()) return;             // placing a manual peak
      if (markHoverRAF){ cancelAnimationFrame(markHoverRAF); markHoverRAF=null; }
      setHover(pos);
    });
    el.addEventListener('pointerleave', ()=>{
      if (markHoverRAF) cancelAnimationFrame(markHoverRAF);
      markHoverRAF = requestAnimationFrame(()=>{ markHoverRAF=null; setHover(null); });
    });
  }
  // (Re)build the interactive overlay marks for a plot: visible FWHM segments plus the
  // invisible thick hit lines for both peaks and FWHM markers. Called after every
  // axis redraw (via _onView) since gOverlay is cleared on each refresh.
  function buildInteractiveMarks(plot){
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
      addMarkHover(hit, mk.pos);
      g.appendChild(hit);
    });
    // Peak hit lines (invisible, full-height, vertical)
    const {h} = plot.size(); const m = plot.margin;
    (plot._peakMarks || []).forEach(mk=>{
      if (mk.pos < xlo || mk.pos > xhi) return;
      const px = plot.px(mk.pos);
      const hit = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'xrd-mark'});
      hit._hit = true;
      addMarkHover(hit, mk.pos);
      g.appendChild(hit);
    });
  }

  // Toggle the transient 'hovering' class on the row nearest the hover pos.
  function updateRowHover(){
    const wrap = $$('PeakTableWrap'); if (!wrap) return;
    const rows = [...wrap.querySelectorAll('.peak-row')];
    let best=null, bd=Infinity;
    if (panel.hov!=null) for (const r of rows){ const d=Math.abs(parseFloat(r.dataset.pos)-panel.hov); if(d<bd){bd=d;best=r;} }
    rows.forEach(r=>r.classList.toggle('hovering', r===best && bd<0.6));
  }
  // Transient hover (peak + associated row), distinct from selection.
  function setHover(pos){
    if (pos===panel.hov) return;
    panel.hov = pos;
    highlightPanel();
    updateRowHover();
  }
  // Permanent selection toggle.
  function selectPeak(pos){
    panel.sel = (panel.sel!=null && Math.abs(pos-panel.sel)<1e-9) ? null : pos;
    renderTable(); highlightPanel();
  }
  function clearSelection(){ if (panel.sel!=null){ panel.sel=null; renderTable(); highlightPanel(); } }

  /* ---- The peak table ---- */
  // Classic (peak-search) table (xrd-peaks-html.js peakTableHtml): 2θ, rel intensity,
  // classic FWHM, size; with a standard in use, the samples' size both without and with
  // the correction.
  // (as last drawn: the sample, its processing, its K and λ, the standard's model, the peak
  // picked, and whether it was laid out, for its CSV icon, fitted only on the page; the same
  // again, the rows and their handlers stay)
  let tableKey = '';
  function renderTable(){
    const wrap = $$('PeakTableWrap');
    if (!wrap) return;
    if (std) renderCaglioti();
    const fs = files(), idx = Math.min(curIdx(), fs.length - 1);
    const kp = fs.length && processed[idx] && !std ? getFileParams(idx) : null;
    const key = !fs.length || !processed[idx] ? 'none' : [idx, idOf(processed[idx]), ...(kp ? [kp.K, kp.lambda, idOf(model())] : []), panel.sel, wrap.getClientRects().length > 0].join('|');
    if (key === tableKey) return;
    tableKey = key;
    if (!fs.length || !processed[idx]){ wrap.innerHTML=''; const rb = $$('PkReset'); if (rb) rb.style.display = 'none'; fitCsvIcons(root); return; }
    const allPks = processed[idx].peaks;
    const resetBtn = $$('PkReset');
    const hasManual = (manualPeaks[idx]||[]).length > 0;
    const hasRemoved = (removedPeaks[idx]||[]).length > 0;
    if (resetBtn) resetBtn.style.display = (hasRemoved || hasManual) ? '' : 'none';

    const pks = allPks.filter(pk=>!pk.removed);
    if (!pks.length){ wrap.innerHTML='<p style="color:var(--muted);margin:6px 0">No peaks found with current parameters.</p>'; return; }
    wrap.innerHTML = peakTableHtml(pks, { std, m: model(), fp: getFileParams(idx), picked: panel.sel, st: std ? null : sampleSizeStats(idx) }, U);

    wrap.querySelectorAll('.peak-row').forEach(row=>{
      const pos = parseFloat(row.dataset.pos);
      row.addEventListener('mouseenter', ()=> setHover(pos));
      row.addEventListener('mouseleave', ()=> setHover(null));
      row.addEventListener('click', e=>{
        if (e.target.closest('.peak-del')) return;
        selectPeak(pos);
      });
    });
    wrap.querySelectorAll('.peak-del').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const det = parseFloat(btn.dataset.det);
        if (btn.dataset.manual === '1'){
          // Manual peaks are deleted permanently: drop them from manualPeaks so the
          // removal is independent of the peak-search params (which reset removedPeaks).
          if (manualPeaks[idx]) manualPeaks[idx] = manualPeaks[idx].filter(v=>Math.abs(v-det) >= 1e-6);
        } else {
          if (!removedPeaks[idx]) removedPeaks[idx] = [];
          if (!removedPeaks[idx].some(v=>Math.abs(v-det)<1e-6)) removedPeaks[idx].push(det);
        }
        refreshAfterPeakEdit(idx);
      });
    });
    fitCsvIcons(root);
  }

  // The standard's Caglioti fit, in the right-hand column, a curve not physical flagged
  // under it (xrd-peaks-html.js cagliotiHtml).
  let cagKey = '';
  function renderCaglioti(){
    const box = $$('Cag'), alert = $$('CagAlert');
    if (!box || !alert) return;
    const m = instrModel(), key = files().length + '|' + idOf(m);
    if (key === cagKey) return;
    cagKey = key;
    const c = cagliotiHtml(m, files().length);
    alert.innerHTML = '';
    box.innerHTML = c.box;
    if (c.alert) alert.innerHTML = c.alert;
  }

  /* ---- Results (a card's): the patterns stacked, and the crystallite sizes ---- */
  // Stacked, baseline-subtracted overview. `curves[k]` holds each sample's raw
  // (un-offset) trace on its own x axis; null entries (e.g. no fit) are skipped.
  // The plot as last drawn: the patterns, their curves and colours, the normalisation, its
  // size. A label is no part of it: the legend's (written again alone), and the name the
  // figure composer gives its trace (set in place).
  let stackKey = '', stackPlot = null, stackLeg = '';
  function drawStackedResults(curves){
    const fs = files();
    const shown = [];
    fs.forEach((f,k)=>{ if (curves[k]) shown.push(k); });
    const svg = $$('ResSvg'), legend = $$('ResLegend');
    const leg = shown.map(k=> `<span><i style="background:${esc(fs[k].color)}"></i>${esc(fs[k].label)}</span>`).join('');
    if (leg !== stackLeg){ stackLeg = leg; legend.innerHTML = leg; }
    const key = [norm, sizeOf(svg), ...shown.map(k=> [fs[k].name, fs[k].color, idOf(fs[k].x), idOf(curves[k])].join(':'))].join('|');
    if (stackPlot && key === stackKey){
      const lab = new Map(shown.map(k=> [fs[k].name, fs[k].label]));
      stackPlot._stored.forEach(e=>{ if (lab.has(e.key)) e.label = lab.get(e.key); });
      return stackPlot;
    }
    stackKey = '';
    const gmax = topOf(shown.map(k=>maxArr(curves[k])));
    // (none: the curves as they are, spaced by the largest — the plot's unit)
    const unit = norm==='none' ? gmax : 1, n = shown.length, baseOf = j => -j * 1.1 * unit;
    const plot = stackPlot = new Plot(svg, {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
    plot.attachTools(plot.svg.closest('.plot-wrap'));
    let lo=Infinity, hi=-Infinity;
    shown.forEach(k=>{ lo=Math.min(lo, fs[k].x[0]); hi=Math.max(hi, fs[k].x[fs[k].x.length-1]); });
    if (!isFinite(lo)){ lo = 0; hi = 1; }
    plot.setRange(lo, hi, baseOf(Math.max(0,n-1)), baseOf(0)+1.1*unit);
    plot.drawAxes();
    shown.forEach((k, j)=>{
      const raw = curves[k];
      const mx = norm==='local' ? (maxArr(raw)||1) : norm==='none' ? 1 : gmax;
      const norm1 = raw.map(v=> v/mx);            // exactly the CSV's own column
      const y = norm1.map(v=> v + baseOf(j) + 0.05*unit);
      // Draw the stacked trace, but hand the composer the un-offset CSV values.
      plot.line(fs[k].x, y, fs[k].color, 1.3, undefined,
                { raw: { xs: fs[k].x, ys: norm1 }, label: fs[k].label, key: fs[k].name });
    });
    stackKey = key;
    return plot;
  }
  /* Per-sample crystallite size as a box plot of its peaks' sizes — one box per sample,
     two side by side when a standard is in use (size, and corrected) — with the mean ±
     the standard deviation written above (its series and their tops: xrd-peaks-model.js
     sizeSeries, sizeTops). */
  function drawSizeBarChart(rows, chips){
    const svg = $$('SizeBarSvg'); if (!svg) return;
    const wrap = svg.closest('.plot-wrap'), legend = $$('SizeBarLegend');
    const SER = sizeSeries(rows), anyCorr = SER.length > 1;
    const tops = sizeTops(rows, SER);
    if (!files().length || !processed.length || !tops.length){
      svg.style.display='none'; if(wrap)wrap.style.display='none'; if(legend)legend.innerHTML=''; return;
    }
    svg.style.display=''; if(wrap)wrap.style.display='';
    const n = rows.length;
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const brect = svg.getBoundingClientRect();
    const svgW = brect.width || 640, svgH = brect.height || 420;
    // How the names are cut and tilted — see barNames.
    const fit = barNames(mctx, rows.map(r=> r.label), Math.max(60, svgW - 75), 55);
    const labels = fit.labels;
    const labelWs = labels.map(l=>mctx.measureText(l).width);
    let maxLbl=0; labelWs.forEach(w=>maxLbl=Math.max(maxLbl, w));
    const bottom = Math.round(26 + maxLbl*fit.sin);
    const fmtLab = (v,e)=> isFinite(e) ? `${v.toFixed(1)}±${e.toFixed(1)}` : v.toFixed(1);
    let maxValW=0;
    rows.forEach(r=> SER.forEach(m=>{ if (r[m.k+'Box']) maxValW = Math.max(maxValW, mctx.measureText(fmtLab(r[m.k+'Mean'], r[m.k+'Std'])).width); }));
    const mTop=15, gap=6, plotH=svgH-mTop-bottom, reserve=gap+maxValW+6;
    const frac = plotH>reserve ? (1-reserve/plotH) : 0.5;
    // Box geometry as the bars had it: capped at their sizes, shrinking to fit the
    // per-sample spacing so many samples don't overlap; a pair keeps its ±17 px offset
    // unless the slot is too narrow, then the two scale together.
    const pxSlot = (svgW - 75)/(n + 1);
    const sc = Math.min(1, (pxSlot*0.8)/66);   // 66 = full paired span at hw16/dx17
    const hw = anyCorr ? 16*sc : Math.min(16, pxSlot*0.3), dx = anyCorr ? 17*sc : 0;
    const offOf = mi => SER.length > 1 ? (mi ? dx : -dx) : 0;
    // The labels kept clear of the chips in the corner, as on the other bar charts.
    const under = [];
    rows.forEach((r, k)=> SER.forEach((m, mi)=>{ const b = r[m.k+'Box']; if (b) under.push({ x:k+1, dx:offOf(mi), top:boxTop(b), w:mctx.measureText(fmtLab(r[m.k+'Mean'], r[m.k+'Std'])).width }); }));
    const ymax = Math.max(Math.max(...tops)*1.15, Math.max(...tops)/frac,
      barChipYmax(chips, svg, under, { W:svgW, ml:55, mr:20, mTop, plotH, gap, x0:0, x1:n+1 }));
    const plot = new Plot(svg, {xlabel:'', ylabel:'Crystallite size (nm)', noXTickLabels:true, noXGrid:true, yGrid:true, margin:{l:55,r:20,t:mTop,b:bottom}});
    // Fixed at [0, n+1]: the names are made to fit it, not the other way round.
    plot.setRange(0, n+1, 0, ymax||1);
    plot.drawAxes();
    for (let k=0;k<n;k++){
      const xc=k+1, r = rows[k];
      SER.forEach((m, mi)=>{
        const b = r[m.k+'Box'];
        if (!b) return;
        const off = offOf(mi);
        plot.box(xc, { ...b, mean: r[m.k+'Mean'], err: r[m.k+'Std'] }, m.color, hw, off, { label: m.name });
        plot.barLabel(xc, boxTop(b), fmtLab(r[m.k+'Mean'], r[m.k+'Std']), {gap, dx:off});
      });
      plot.tickLabel(xc, labels[k], fit.rot, r.label, r.name);
    }
    plot.attachTools(wrap);
    if (legend) legend.innerHTML = SER.map(m=> `<span><i class="mk-box" style="background:${m.color}"></i>${m.name}</span>`).join('');
  }
  // The reflections the samples share (xrd-peaks-model.js sizeReflections).
  const reflections = ()=> sizeReflections(processed, paramsAll(), model());
  // The chart as last drawn: what it draws (its rows, the chips in its corner) and its size;
  // the chips and the note under it as last written.
  let sizeKey = '', chipsHtml = '', noteHtml = '';
  function renderSizeChart(){
    const chips = $$('SizeBy'), note = $$('SizeByNote'), svg = $$('SizeBarSvg');
    const R = reflections(), ok = byPeakOk(R), by = ok ? sizeBy : 'sample';
    // Two chips, one at a time; with a single sample there is nothing to compare by peak.
    const ch = sizeChipsHtml(R.idxs.length, ok, by);
    if (chips && ch !== chipsHtml){ chipsHtml = ch; chips.innerHTML = ch; }
    const rows = by === 'peak' ? reflectionRows(R, model(), U)
      : files().map((f, k)=>({name:f.name, label:f.label, ...sampleSizeStats(k)}));
    // (shown before it is measured: one hidden measures nothing)
    const hide = !files().length || !processed.length || !sizeTops(rows).length;
    if (svg && !hide){ svg.style.display = ''; svg.closest('.plot-wrap').style.display = ''; }
    const key = hide ? 'none' : JSON.stringify([rows, ch, sizeOf(svg)]);
    if (key !== sizeKey){ sizeKey = ''; drawSizeBarChart(rows, chips); sizeKey = key; }
    // What is left out by peak: the reflections not every sample has, and whose they are.
    const nt = sizeNoteHtml(R, by, files().map(f=> f.label), U);
    if (note && nt !== noteHtml){ noteHtml = nt; note.innerHTML = nt; }
    sizeNames();
  }
  /* The chart's image follows what it shows, its CSVs never (v530): both, by sample and by
     peak (the second where there is one: byPeakOk), whichever the chips show, a view alone
     (v528); to v529 the one on show. Both named after the card. */
  let cardName = '';
  const SIZE_CSVS = ['crystallite_size.csv', 'crystallite_size_by_peak.csv'];
  function sizeNames(){
    if (!res) return;
    const R = reflections(), by = byPeakOk(R) ? sizeBy : 'sample', pre = cardName ? cardName + ' - ' : '';
    const wrap = $$('SizeBarSvg').closest('.plot-wrap');
    wrap.querySelectorAll('.plot-dl-btn, .plot-csv-btn').forEach(b=>{
      b.dataset.csvNames = SIZE_CSVS.map(x=> pre + x).join(',');
      if (b.classList.contains('plot-dl-btn')) b.dataset.dlName = pre + (by === 'peak' ? 'XRPD_crystallite_size_by_peak.svg' : 'XRPD_crystallite_size.svg');
    });
  }
  if (res) res.addEventListener('click', e=>{
    const b = e.target.closest('[data-size-by]');
    if (!b || b.disabled || b.dataset.sizeBy === sizeBy) return;
    sizeBy = b.dataset.sizeBy;
    renderSizeChart();
    host.commit();
  });
  function renderResults(){
    if (!res || !files().length || !processed.length) return;
    // Analysis: smoothed − SNIP baseline
    drawStackedResults(processed.map(pr=>pr.subtracted));
    renderSizeChart();
  }

  // Re-derive everything downstream of a peak edit (add/remove/reset) on file `idx`.
  function refreshAfterPeakEdit(idx){
    reprocessOne(idx);
    updateView(true);
    renderTable();
    renderResults();
    host.changed();
    host.commit();
  }

  /* ---- The fields ----
     With no file a field, the box, the chips and the λ preset set the stored values all the
     same, for the files to come, as a step of the history (up to v484 a field and the box
     were not kept: the next refresh put the stored values back in them). */
  // Per-field shared/per-sample toggles (one segmented control per editable field)
  const TOGGLE_FIELD = { N:'N', Bl:'blWin', H:'pkHeight', P:'pkProm', D:'pkDist', K:'K', L:'lambda' };
  const SIZE_ONLY = new Set(['K','lambda']);
  function syncModeButtons(){
    if (std) return;
    Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{ const c = $$('Mode' + tid); if (c) c.textContent = paramMode[key]==='shared' ? 'all' : 'one'; });
  }
  if (!std) Object.entries(TOGGLE_FIELD).forEach(([tid, key])=>{
    $$('Mode' + tid).addEventListener('click', ()=>{
      const mode = paramMode[key]==='shared' ? 'per' : 'shared';
      // The value currently displayed on the graph for this field (the baseline's
      // width with its box: one chip for both)
      const keys = key==='blWin' ? ['snipW', 'blOn'] : key==='N' ? ['smoothW'] : [key];
      const cur = getFileParams(curIdx());
      paramMode[key] = mode;
      $$('Mode' + tid).textContent = mode==='shared' ? 'all' : 'one';
      if (mode==='shared'){
        // Switching to "all": every sample takes the value of the sample on show
        keys.forEach(k=>{ shared[k] = cur[k]; });
      } else {
        // Switching to "one": every sample starts from the common value, then each is
        // changed on its own
        files().forEach((f, i)=>{ if (!perParams[i]) perParams[i] = {}; keys.forEach(k=>{ perParams[i][k] = cur[k]; }); });
      }
      // (a width shared again: its note, if a project's conversion left one, goes, and the
      // value in points it kept for the files left out)
      if (mode==='shared'){ stepNote = stepNote.filter(m=> m !== key); delete heldPts[key]; if (key === 'blWin') delete heldPts.blOn; }
      writeStoreToInputs();
      if (files().length){
        if (!SIZE_ONLY.has(key)){
          if (mode==='shared') reprocessAll(); else reprocessOne(curIdx());
          updateView(true);
        }
        renderTable(); renderResults();
      }
      host.commit();
    });
  });
  if (!std) $$('Norm').addEventListener('change', e=>{
    norm = normOf(e.target.value);
    if (files().length) renderResults();
    host.commit();
  });
  // The baseline's box: as a change of its window (no peak deletion undone).
  $$('BlOn').addEventListener('change', ()=>{
    readInputsToStore();
    writeStoreToInputs();
    if (!files().length){ host.commit(); return; }
    if (paramMode.blWin==='shared') reprocessAll(); else reprocessOne(curIdx());
    updateView(true);
    renderTable(); renderResults();
    host.changed();
    host.commit();
  });
  Object.entries(FIELD_INPUT).forEach(([key, id])=>{
    const el = $$(id);
    const isSizeOnly = SIZE_ONLY.has(key);   // K/λ don't affect processing
    const isPeakSearch = (key==='pkHeight' || key==='pkProm' || key==='pkDist');
    const apply = ()=>{
      readInputsToStore();
      writeStoreToInputs();
      if (!files().length){ host.commit(); return; }
      if (isSizeOnly){ renderTable(); renderResults(); host.commit(); return; } // only the Scherrer size changes
      // Peak deletions reset only when this peak-search field changes
      if (isPeakSearch){
        if (paramMode[key]==='shared') removedPeaks = removedPeaks.map(()=>[]);
        else removedPeaks[curIdx()] = [];
      }
      if (paramMode[modeOf(key)]==='shared') reprocessAll(); else reprocessOne(curIdx());
      updateView(true);      // the analysis is live
      renderTable(); renderResults();
      host.changed();
      host.commit();
    };
    el.addEventListener('change', apply);
    el.addEventListener('keydown', e=>{ if (e.key==='Enter') el.blur(); });
  });
  // Wavelength preset selector: choosing a source fills + locks the λ value and
  // recomputes; "Custom" unlocks the field for a free value.
  if (!std){
    const sel = $$('LambdaSel'), inp = $$('Lambda');
    sel.addEventListener('change', ()=>{
      if (sel.value === 'custom'){ inp.readOnly = false; inp.focus(); if (inp.select) inp.select(); }
      else { inp.readOnly = true; inp.value = parseFloat(sel.value); inp.dispatchEvent(new Event('change', { bubbles:true })); }
    });
    syncLambdaSelect();
    $$('Prev').onclick = ()=> host.step(-1);
    $$('Next').onclick = ()=> host.step(1);
    $$('Std').onclick = ()=> host.openStd();
    // (its list: any sample, straight; snav.js)
    nav = snav($$('Prev').closest('.snav'), { count: ()=> files().length, index: ()=> curIdx(), label: i=> files()[i].label, go: i=> host.step(i - curIdx()) });
  }

  // Reset peaks: drop manual + removed peaks and re-run the search for the file on show
  $$('PkReset').onclick = ()=>{
    const idx = curIdx();
    if (!files()[idx]) return;
    manualPeaks[idx] = [];
    removedPeaks[idx] = [];
    refreshAfterPeakEdit(idx);
  };

  /* ---------- Add-peak mode ---------- */
  const addPeak = (()=>{
    let addMode = false, addIdx = null;
    const btn = $$('AddPeak');
    const svgNode = $$('Svg');
    const getIdx = ()=> curIdx();
    const clearGuide = ()=> svgNode.querySelectorAll('.add-guide').forEach(e=>e.remove());
    function drawGuide(){
      clearGuide();
      const plot = anaPlot, idx = getIdx();
      if (!addMode || !plot || !processed[idx] || addIdx==null) return;
      const m = plot.margin; const {w,h} = plot.size();
      const pr = processed[idx];
      const mxv = maxArr(pr.smoothed) || 1;
      const xv = files()[idx].x[addIdx];
      const yval = pr.smoothed[addIdx] / mxv;
      const px = plot.px(xv), py = plot.py(yval);
      plot.svg.appendChild(svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'#ffd24a','stroke-width':1.5,'stroke-dasharray':'4,3','pointer-events':'none','class':'add-guide'}));
      plot.svg.appendChild(svgEl('circle',{cx:px,cy:py,r:3.5,fill:'#ffd24a','pointer-events':'none','class':'add-guide'}));
      // Readout follows the drawn vertical guide (flips to the left near the right
      // edge), two lines using the plot's axis names + units:
      // "2θ = 45.123 °" / "Intensity = 0.520 a. u.".
      const flip = px > w - m.r - 130;
      const tx = px + (flip ? -8 : 8);
      const t = svgEl('text',{x:tx,y:m.t+14,'font-size':12,fill:'#ffd24a',stroke:'#0b0f12','stroke-width':3.5,'paint-order':'stroke','font-family':'monospace','text-anchor':flip?'end':'start','pointer-events':'none','class':'add-guide'});
      const l1=svgEl('tspan',{x:tx}); l1.textContent=axisReadout(plot.xlabel||'2θ', xv);
      const l2=svgEl('tspan',{x:tx,dy:16}); l2.textContent=axisReadout(plot.ylabel||'Intensity', yval);
      t.appendChild(l1); t.appendChild(l2);
      plot.svg.appendChild(t);
    }
    function setMode(on){
      addMode = !!on;
      btn.classList.toggle('is-on', addMode);
      // Drop focus once armed so the arrow keys (which nudge the guide) don't put
      // the button into :focus-visible and paint a white selection outline.
      if (addMode) btn.blur();
      svgNode.style.cursor = addMode ? 'crosshair' : '';
      // While armed, suppress the plot's x/y hover readout + crosshair (same as pan/zoom).
      svgNode._suppressReadout = addMode;
      const plot = anaPlot;
      if (addMode && plot){ plot.setMode(null); plot._clearCrosshair(); }
      if (!addMode){ addIdx = null; clearGuide(); }
    }
    function confirmAdd(){
      if (addIdx==null) return;
      const idx = getIdx(), x = files()[idx] && files()[idx].x;
      // (an index past the end of the pattern on show, as a stale one could be, adds nothing)
      if (!x || !Number.isFinite(x[addIdx])){ setMode(false); return; }
      if (!manualPeaks[idx]) manualPeaks[idx] = [];
      manualPeaks[idx].push(x[addIdx]);
      setMode(false);
      refreshAfterPeakEdit(idx);
    }
    const pointToIdx = (e)=>{
      const plot = anaPlot;
      const rect = plot.svg.getBoundingClientRect();
      let xv = plot.invX(e.clientX - rect.left);
      xv = Math.max(plot.xmin, Math.min(plot.xmax, xv));
      return nearestIdx(files()[getIdx()].x, xv);
    };
    btn.onclick = ()=>{ if (files().length && getIdx()>=0) setMode(!addMode); };
    svgNode.addEventListener('pointermove', e=>{
      if (!addMode || !anaPlot || !processed[getIdx()]) return;
      addIdx = pointToIdx(e); drawGuide();
    });
    svgNode.addEventListener('pointerleave', ()=>{ if (addMode) clearGuide(); });
    svgNode.addEventListener('pointerdown', e=>{
      if (!addMode || !anaPlot || e.button!==0) return;
      e.preventDefault(); e.stopPropagation();
      addIdx = pointToIdx(e); confirmAdd();
    }, true);
    /* On show: the panel in the page (a card closed, switched to the other kind or rebuilt
       by an undo is out of it), laid out (its tab on show, the standard's window open, the
       card unfolded) and under no window (the standard's over the cards, a figure composer,
       the calendar, a settings window): a window is any backdrop laid out, as the composers
       and the calendar have no inline display to read. */
    const onShow = ()=> root.isConnected && root.getClientRects().length > 0 && !host.hidden()
      && ![...document.querySelectorAll('.modal-backdrop')].some(m=> m.getClientRects().length > 0 && !m.contains(root));
    // Capture phase + stopImmediatePropagation so that while add-peak is armed
    // it claims the arrow keys before the document-level sample-nav handler
    // (utils.js) can fire — otherwise ← / → would change sample instead of
    // nudging the guide. Only while the panel is on show: off show the mode is dropped
    // and the key goes on (to v473 a card closed, or the standard's window, kept ← / →
    // and Enter page-wide, and Enter added a peak where it was no longer seen).
    function onKey(e){
      if (!addMode) return;
      const plot = anaPlot, idx = getIdx(), f = files()[idx];
      if (!onShow() || !plot || !f){ setMode(false); return; }
      // A key typed in a field is the field's: Enter applies it, the arrows move the caret
      // (up to v484 the armed mode took them there too: Enter placed the peak, the field
      // was not applied).
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      // Enter on a button is the button's: the fold arrow reached by Tab folds the card, and
      // the fold leaves the mode (to v499 Enter placed the peak there, and the card stayed
      // open). The arrows move the guide and take the focus off a button, so a button clicked
      // meanwhile does not keep Enter: it places the peak.
      const onBtn = t && t.closest && t.closest('button, a[href], [role="button"], [role="menuitem"]');
      if (e.key==='Enter' && onBtn) return;
      if (e.key==='Escape'){ e.stopImmediatePropagation(); setMode(false); return; }
      if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
        e.preventDefault(); e.stopImmediatePropagation();
        if (onBtn) t.blur();
        const x = f.x;
        const a = nearestIdx(x, plot.xmin), b = nearestIdx(x, plot.xmax);
        const lo = Math.min(a,b), hi = Math.max(a,b);
        if (addIdx==null) addIdx = nearestIdx(x, (plot.xmin+plot.xmax)/2);
        addIdx = Math.max(lo, Math.min(hi, addIdx + (e.key==='ArrowRight'?1:-1)));
        drawGuide();
      } else if (e.key==='Enter'){ e.preventDefault(); e.stopImmediatePropagation(); confirmAdd(); }
    }
    document.addEventListener('keydown', onKey, true);
    return { isAdding:()=>addMode, setMode, off(){ document.removeEventListener('keydown', onKey, true); setMode(false); } };
  })();

  // Plot-side peak click-to-select (mirror of the table interaction), acting only when
  // no pan/zoom tool is armed and no peak is being placed; the hover is the marks' own.
  // (a click here is the peaks': no trace is picked out on this plot, plot.js pickOff)
  $$('Svg')._noPick = true;
  $$('Svg').addEventListener('click', ()=>{
    const plot = anaPlot; if (!plot || plot._mode || addPeak.isAdding()) return;
    if (panel.hov!=null) selectPeak(panel.hov);  // clicked a peak/FWHM → (de)select it
    else clearSelection();                      // clicked empty area → deselect
  });
  // Deselect when clicking anywhere in the table's box that isn't a peak row
  $$('PeakBox').addEventListener('click', e=>{ if (!e.target.closest('.peak-row')) clearSelection(); });

  /* ---- CSVs ---- */
  // The CSVs, each named after the card (pre: "<name> - "); the standard's in one file
  // (xrd-peaks-model.js csvTables).
  const csvEntries = pre => csvTables(pre, { files: files(), procs: processed, fps: paramsAll(), m: model(), norm, std }, U);

  // Everything again from the files: after a change to them (added, removed, left out,
  // reordered, read again), or a state loaded. A peak being placed is dropped: its index
  // may be on another pattern than the one now on show (to v473 kept while there were
  // files: a standard replaced by a shorter one left it past the end, and Enter threw).
  function refresh(preserveView){
    addPeak.setMode(false);
    // (with no file the fields and the chips too: they show what a file loaded will take)
    if (!files().length){ processed = []; panel.sel = panel.hov = null; writeStoreToInputs(); syncModeButtons(); updateView(); renderTable(); return; }
    reprocessAll();
    writeStoreToInputs();
    syncModeButtons();
    updateView(preserveView);
    renderTable();
    renderResults();
  }

  return {
    res,
    // The per-sample arrays, for the file list to keep aligned with the included files.
    slots: key => std ? [] : [
      // (a file left out keeps its entry as it was: one of a project to v510, in points,
      // takes its widths at the file's step as it comes back, those v510 shared where the
      // conversion turned the chip to one: heldPts)
      { key: key + ':params', arr:perParams, make: (v, f)=> v ? entryOf(objOf(v), f && f.x ? meanStep(f.x) : NaN, heldPts) : {...shared} },
      { key: key + ':manual', arr:manualPeaks, make: v=> v ? v.slice() : [] },
      { key: key + ':removed', arr:removedPeaks, make: v=> v ? v.slice() : [] },
    ],
    addFile(){ perParams.push({...shared}); manualPeaks.push([]); removedPeaks.push([]); },
    // The standard's file replaced or taken away: its own peaks go with it.
    resetFile(){ perParams = files().map(()=> ({...shared})); manualPeaks = files().map(()=> []); removedPeaks = files().map(()=> []); panel.sel = panel.hov = null; },
    clear(){ processed=[]; perParams=[]; manualPeaks=[]; removedPeaks=[]; panel.sel=panel.hov=null; },
    refresh,
    // Another sample on show (the cards share it).
    show(){ addPeak.setMode(false); panel.sel=panel.hov=null; writeStoreToInputs(); updateView(); renderTable(); },
    /* The card folded by its arrow, the standard's window closed: a peak being placed is
       left, as by + Add peak again (its button off, the guide gone). Up to v499 it stayed
       on, unseen, until the next key dropped it: a card unfolded again had it still on. */
    disarm(){ addPeak.setMode(false); },
    // The standard changed: the corrected sizes, here and in the Results.
    sizesChanged(){ if (files().length){ renderTable(); renderResults(); } },
    // A label or a colour changed, the card unfolded, the tab on show again or resized: each
    // view drawn again where what it shows changed.
    redraw(){ if (files().length){ updateView(true); renderTable(); renderResults(); } },
    // What it shows beside its state (xrd.js shows): the peak picked in its table, given
    // back as its tab wakes or the page is reloaded, the state restored (which picks none).
    shows(){ return panel.sel != null ? { sel: panel.sel } : null; },
    showNext(v){ if (v && Number.isFinite(v.sel)) panel.sel = v.sel; },
    instrModel,
    // The downloads named after the card ("<name> - peaks.csv"), the size chart's by what it shows.
    setName(n){
      cardName = n;
      const pre = n ? n + ' - ' : '';
      [root, res].filter(Boolean).forEach(el=>{
        el.querySelectorAll('[data-csv-base]').forEach(b=>{ b.dataset.csvNames = b.dataset.csvBase.split(',').map(x=> pre + x).join(','); });
        el.querySelectorAll('[data-dl-base]').forEach(b=>{ b.dataset.dlName = pre + b.dataset.dlBase; });
        el.querySelectorAll('.plot-wrap').forEach(w=>{ const d = w.querySelector('.plot-dl-btn[data-csv-base]'), c = w.querySelector('.plot-csv-btn'); if (d && c) c.dataset.csvNames = d.dataset.csvNames; });
      });
      sizeNames();
    },
    csvEntries,
    // The card closed, switched to the other kind or rebuilt (xrd.js): its document
    // listener goes, and the add mode with it (to v473 it stayed, and kept the card's
    // closure, its arrays with it, for as long as the page).
    destroy(){ addPeak.off(); if (markHoverRAF){ cancelAnimationFrame(markHoverRAF); markHoverRAF = null; } },
    snapshot(){ return stateOf({ perParams, manualPeaks, removedPeaks, shared, paramMode, sizeBy, norm, stepNote, heldPts }); },
    /* Every setting from the state (xrd-peaks-model.js readState: each set whether the state
       holds it or not, a value that is no number the default, the widths of a project to
       v510, in points, converted at each pattern's step, and those of the files left out
       held), the normalisation made valid; nothing picked. */
    restore(s){
      const fs = files(), st = fs.map(f=> meanStep(f.x));
      // (and the steps of the files left out, which come back with their entries)
      const stAll = st.concat(!std ? host.allFiles().filter(f=> f.included === false).map(f=> meanStep(f.x)) : []);
      const t = readState(s, std, st, stAll);
      Object.assign(shared, t.shared); Object.assign(paramMode, t.paramMode);
      ({ heldPts, perParams, stepNote, manualPeaks, removedPeaks, sizeBy } = t);
      norm = normOf(objOf(s).norm);
      panel.sel = panel.hov = null;
      writeStoreToInputs(); syncModeButtons();
    },
  };
}

const LEGEND = `<div class="legend">
              <span><i style="background:#6a7585"></i>raw</span>
              <span><i style="background:#3aa0ff"></i>smoothed</span>
              <span class="lg-bl"><i style="background:#ff9933"></i>baseline</span>
              <span><i style="background:#5fcf6a"></i>peaks</span>
            </div>`;
// The baseline's box, before its window's title: on (the default), the SNIP baseline.
const BL_TITLE = 'Subtract a SNIP baseline (the background) before the peak search and the FWHM; unticked, none: the pattern is taken as it is, from zero';
const CHIP_TITLE = "Switch all / one: to one, every sample starts from the common value; back to all, the common value is the shown sample's";
const chip = (p, k, mode)=> `<button type="button" class="mode-chip" id="${p}Mode${k}" title="${CHIP_TITLE}">${mode}</button>`;
/* A width's field (the smoothing's, the SNIP's): its value in °2θ and, in the same box after
   it, muted, what it spans in points of the pattern on show (syncHints). The box is a
   label: a click on the points is one in the field. */
const W_TITLE = { Smooth: "The smoothing box's width, in °2θ (0: none); beside it, the points it spans at the step of the pattern on show",
  BlWin: "The SNIP baseline's width, in °2θ: each point is compared with the curve up to half this far on either side; beside it, the points it spans at the step of the pattern on show" };
const wField = (p, id, v)=> `<label class="pg-field wfield" title="${W_TITLE[id]}"><input type="text" inputmode="decimal" id="${p}${id}" value="${v}" autocomplete="off" aria-describedby="${p}${id}Pts"><span class="wf-pts" id="${p}${id}Pts"></span></label>`;
// The card's markup: the samples' card, or the standard's (std).
function cardHtml(p, std){
  // The standard's: one file, named over it in the window, so its plot has no caption;
  // the parameters beside the plot, the Caglioti fit and + Add peak at their foot,
  // ending level with the plot's bottom (the frame of the Rietveld card's, .pside).
  return std ? `
        <div class="pside">
          <div class="plot-nav-row pside-nav"></div>
          <div class="pside-plot">
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-names="standard.csv" data-dl-name="XRPD_standard.svg">${PLOT_DL_ICON}</button>
            </div>
          </div>
          <div class="pside-under">${LEGEND}</div>
          <div class="pside-col xrd-std-side">
            <div class="txt-mini param-head cap-title"><span>Parameters</span></div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Smooth">Smoothing width (&#176;2&#952;)</label>
              ${wField(p, 'Smooth', 0)}
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP width (&#176;2&#952;)</label></div>
              ${wField(p, 'BlWin', 5)}
              <label class="txt-label" for="${p}PkHeight">Peak min. height (%)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkHeight" value="5">
              <label class="txt-label" for="${p}PkProm">Peak min. prominence (%)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkProm" value="3">
              <label class="txt-label" for="${p}PkDist">Peak min. distance (&#176;2&#952;)</label>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkDist" value="0.3">
            </div>
            <div class="xrd-cag"><div class="pg-result" id="${p}Cag"></div></div>
            <div id="${p}CagAlert" class="cag-alert"></div>
            <button class="btn plot-action-btn" id="${p}AddPeak" title="Add a peak by clicking on the plot">+ Add peak</button>
          </div>
        </div>
        <div class="peak-box" id="${p}PeakBox">
          <div class="peak-box-head">
            <span class="txt-mini">Detected peaks</span>
            <button class="btn nav-arrow peak-reset-btn" id="${p}PkReset" style="display:none" title="Reset peaks">&#8634;</button>
            <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-names="standard.csv" title="Download CSV">${CSV_ICON}</button>
          </div>
          <div class="xrd-peak-wrap" id="${p}PeakTableWrap"></div>
        </div>` : `
        <div class="row" style="align-items:flex-start">
          <div class="col mw520" style="flex:2">
            <div class="plot-nav-row">
              <div class="plot-nav-left">
                ${snavHtml({ prev: p + 'Prev', idx: p + 'Idx', next: p + 'Next', name: p + 'CurrentLabel', prevCls: 'an-prev', nextCls: 'an-next' })}
              </div>
            </div>
            <div class="plot-wrap">
              <svg class="plot" id="${p}Svg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}Svg" data-csv-mod="xrd" data-csv-base="diffractograms.csv,peaks.csv" data-csv-names="diffractograms.csv,peaks.csv" data-dl-base="XRPD_sample.svg" data-dl-name="XRPD_sample.svg">${PLOT_DL_ICON}</button>
            </div>
            ${LEGEND}
          </div>
          <div class="col mw280" style="align-self:flex-start">
            <div class="txt-mini param-head aligned cap-title"><span>Parameters</span></div>
            <div class="param-grid">
              <label class="txt-label" for="${p}Norm">Normalization</label>
              <select id="${p}Norm" class="pg-field">${NORM_OPTIONS}</select>
              <div class="txt-label pg-title">Smoothing width (&#176;2&#952;) ${chip(p, 'N', 'all')}</div>
              ${wField(p, 'Smooth', 0.25)}
              <div class="txt-label pg-title"><label class="pg-on" title="${BL_TITLE}"><input type="checkbox" id="${p}BlOn" checked> Baseline SNIP width (&#176;2&#952;)</label> ${chip(p, 'Bl', 'all')}</div>
              ${wField(p, 'BlWin', 5)}
              <div class="txt-label pg-title">Peak min. height (%) ${chip(p, 'H', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkHeight" value="5">
              <div class="txt-label pg-title">Peak min. prominence (%) ${chip(p, 'P', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkProm" value="3">
              <div class="txt-label pg-title">Peak min. distance (&#176;2&#952;) ${chip(p, 'D', 'one')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}PkDist" value="0.3">
              <div class="txt-label pg-title">Shape factor K ${chip(p, 'K', 'all')}</div>
              <input type="text" inputmode="decimal" class="pg-field" id="${p}K" value="0.9">
              <div class="txt-label pg-title">Wavelength &#955; (&#8491;) ${chip(p, 'L', 'all')}</div>
              <div class="pg-field lambda-field">
                <select id="${p}LambdaSel" class="lambda-sel" title="X-ray source / wavelength">
                  <option value="1.540598">Cu Kα1</option>
                  <option value="1.541838">Cu Kα</option>
                  <option value="1.544426">Cu Kα2</option>
                  <option value="0.709317">Mo Kα1</option>
                  <option value="1.789010">Co Kα1</option>
                  <option value="2.289760">Cr Kα1</option>
                  <option value="custom">Custom</option>
                </select>
                <input type="text" inputmode="decimal" class="lambda-val" id="${p}Lambda" value="1.540598" readonly title="Wavelength (Å)">
              </div>
            </div>
            <div id="${p}StepNote"></div>
            <div class="xrd-pk-btns">
              <button class="btn plot-action-btn" id="${p}AddPeak" title="Add a peak by clicking on the plot">+ Add peak</button>
              <button class="btn plot-action-btn" id="${p}Std" aria-haspopup="dialog" title="The instrumental standard: its file, its peaks and the Caglioti fit that corrects the sizes for the instrument's width">Instrumental standard…</button>
            </div>
          </div>
        </div>
        <div class="peak-box" id="${p}PeakBox">
          <div class="peak-box-head">
            <span class="txt-mini">Detected peaks</span>
            <button class="btn nav-arrow peak-reset-btn" id="${p}PkReset" style="display:none" title="Reset peaks">&#8634;</button>
            <button class="btn table-csv-btn" data-csv-mod="xrd" data-csv-base="peaks.csv" data-csv-names="peaks.csv" title="Download CSV">${CSV_ICON}</button>
          </div>
          <div class="xrd-peak-wrap" id="${p}PeakTableWrap"></div>
        </div>`;
}
// A card's section of the Results: the patterns stacked, and the crystallite sizes.
function resHtml(p){
  return `
        <h4 class="res-an-title"></h4>
        <div class="row res-row" style="gap:16px">
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Analysis</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}ResSvg"></svg>
              <button class="btn plot-dl-btn" data-dl-svg="${p}ResSvg" data-csv-mod="xrd" data-csv-base="diffractograms.csv" data-csv-names="diffractograms.csv" data-dl-base="XRPD_results_analysis.svg" data-dl-name="XRPD_results_analysis.svg" data-dl-legend="${p}ResLegend">${PLOT_DL_ICON}</button>
            </div>
            <div id="${p}ResLegend" class="legend"></div>
          </div>
          <!-- The crystallite size beside the intensities it is read from. -->
          <div class="col mw320" style="flex:1">
            <p class="txt-caption">Crystallite size</p>
            <div class="plot-wrap">
              <svg class="plot" id="${p}SizeBarSvg"></svg>
              <span class="plot-chips" id="${p}SizeBy"></span>
              <button class="btn plot-dl-btn" data-dl-svg="${p}SizeBarSvg" data-csv-mod="xrd" data-csv-names="crystallite_size.csv,crystallite_size_by_peak.csv" data-dl-name="XRPD_crystallite_size.svg" data-dl-legend="${p}SizeBarLegend">${PLOT_DL_ICON}</button>
            </div>
            <div id="${p}SizeBarLegend" class="legend"></div>
            <div id="${p}SizeByNote" class="txt-meta"></div>
          </div>
        </div>`;
}
