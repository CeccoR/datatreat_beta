/* =========================================================
   XRPD — the peak analysis (Scherrer).
   A panel of its own on some files: the raw pattern, its smoothing (smooth.js),
   the SNIP baseline and the peaks found on what is left, with their FWHM and, for
   the samples, the Scherrer crystallite size of each. Made for a card (the samples,
   several cards each with its own parameters) or for the instrumental standard (one
   file, its own parameters, and the Caglioti fit of its widths that corrects the
   samples' sizes for the instrument's).
   SPLIT (v552, v561): its calculations, and what its wiring works out (its fields read
   and written, what the plot and the Results draw, the changes to its state), are
   xrd-peaks-model.js's; its words and markup xrd-peaks-html.js's (both tested in Node).
   Here the page: the instance's state (S), its fields, plots, table and add-peak mode, and
   their listeners. Each is a function at module level of S, not a closure inside
   createPeakAnalysis (to v560 one of 908 lines): what a listener holds is what it is handed.
   (v575) Each sample's CIF, chosen among the tab's or read here, names its peaks by its
   phase's reflections, and the Results chart the sizes by species. (v576) At its tube's Kα2
   too, a peak none names at λ; the boxes of one size seen, the reflections by their hkl.
========================================================= */
import { esc, fmtNum, csvLine, linspace, interpLinear, meanArr, stdArr, boxStats, maxArr, minArr, X_SVG, guardNumericInput, guardNumberInputs, fitCsvIcons, barNames, barChipYmax, NORM_OPTIONS, normOf, keeper, boxHtml } from './utils.js';
import { svgEl, Plot, axisReadout } from './plot.js';
import { meanStep, widthText } from './smooth.js';
import { PLOT_DL_ICON, CSV_ICON } from './modcharts.js';
import { snavHtml, snav } from './snav.js';
import { readCifs, notAddedLines, phaseReflections } from './xrd-rv-model.js';
import * as M from './xrd-peaks-model.js';
import * as H from './xrd-peaks-html.js';

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
/* (v575) A phase's reflections over a pattern's range at a wavelength (xrd-rv-model.js
   phaseReflections), kept by the phase (one object for one CIF: prepOf) for each; and a
   sample's assignment (xrd-peaks-model.js sampleAssign), by its processing, under its CIF,
   λ and 2θ (assignOf). */
const reflKept = new WeakMap(), asgKept = new WeakMap();
function reflOf(prep, lam, x0, x1){
  let m = reflKept.get(prep);
  if (!m) reflKept.set(prep, m = new Map());
  const k = lam + '|' + x0 + '|' + x1;
  if (!m.has(k)) m.set(k, phaseReflections(prep, lam, x0, x1));
  return m.get(k);
}
/* utils.js's, modcharts.js's and snav.js's helpers, which need a page to load, as the
   calculations and the markup take them (xrd-peaks-model.js, xrd-peaks-html.js: no page,
   imported by Node's tests too). */
const U = { maxArr, meanArr, stdArr, boxStats, fmtNum, csvLine, esc, X_SVG, linspace, interpLinear, NORM_OPTIONS, PLOT_DL_ICON, CSV_ICON, snavHtml };

// The instructions (xrd-peaks-html.js), over the cards and in the standard's window.
export const PEAKS_INFO = H.PEAKS_INFO;
export const STD_INFO = H.STD_INFO;

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
     cifs()           the tab's CIFs, { file, cif } (samples: every Rietveld card's phases'
                      and every Scherrer card's samples', v575)
   }
   o: { prefix, standard } */
export function createPeakAnalysis(host, root, o){
  const S = makeState(host, root, o);
  guardFields(S);
  wireNotes(S);
  wireModes(S);
  wireFields(S);
  wireNav(S);
  wireCif(S);
  wirePeaks(S);
  return apiOf(S);
}

/* =========================================================
   THE INSTANCE: a card's (the samples') or the standard's; its state S, which every
   function below takes:
     host, root, res, p, std   its host (above), its element, its section of the Results
                          (a card's; the standard's none), its ids' prefix, whether it is
                          the standard's
     $(id)                an element by its id's end, found in the card or its section
                          whether or not they are in the page
     fields               the decimal fields: a setting's key → its input's id's end
     processed            per file: {smoothed, baseline, subtracted, peaks, k1, k2}
     manualPeaks          per file: array of manually added 2θ positions
     removedPeaks         per file: array of removed peaks' detected 2θ positions
     paramMode            per-field mode: 'shared' | 'per' (xrd-peaks-model.js modeDef:
                          peak-search fields per-sample, the rest shared; the standard's
                          all shared)
     shared               shared param values (xrd-peaks-model.js FIELD_DEF; the
                          standard's own start unsmoothed: sharedDef)
     perParams            per-sample param overrides (indexed by file idx): {smoothW, snipW,
                          blOn, pkHeight, pkProm, pkDist, K, lambda}. blOn: the SNIP baseline
                          subtracted (its box ticked, the default) or not; it goes with its
                          width, under the width's all / one (paramMode.blWin). Absent
                          (projects before v463) is on.
     cifs                 per file: its CIF, { file, cif }, or null (v575: its species, whose
                          reflections name its peaks)
     oldGroups            a project of an older version that matched its peaks across
                          samples: its note in the card, until a CIF is chosen
     sizeBy               what the crystallite-size box plot is by: each sample's peaks of its
                          species ('sample'), or each reflection of a species, over its
                          samples ('peak'; to v574 each reflection the samples shared)
     stepNote             the chips a project's conversion turned to one, its patterns'
                          steps differing (restore), whose note shows under the fields until
                          each is shared again or the note dismissed
     heldPts              and, files being left out then, those chips' values in points as
                          v510 shared them ({ N, blWin }): such a file taken back in has them
                          at its own step, as v510 gave it the shared value under all (its
                          own entry, held, not in use), until the chip is shared again
     norm                 the Results' normalisation
     panel                selection/hover state of the peak table and plot: { sel, hov }
     ana, stack           the plot (the pattern on show) and the Results' stacked patterns
     fullView             the plot's next drawing at its full range: the sample on show
                          changed while the card was folded (show), as it is drawn when
                          that happens unfolded (v568; to v567 the card unfolded drew the
                          new sample at the zoom it had on the other); so too a file left
                          out, taken in or removed, or a state loaded (refresh: v569)
     K                    each view's key or markup as last drawn (ana: the plot's, step:
                          the step note's, table, cag: the Caglioti box's, stack, stackLeg:
                          its legend's, size: the size chart's, chips, note: its note's;
                          cif: the CIF selector's options, cifNote: the notes under it)
     cardName             the card's name, its downloads'
     pool, cifSaid        the CIFs its selector offers (xrd-peaks-model.js cifPool), and what
                          the last CIF read said (its refusal), under it
     hoverRaf             the frame a mark's hover is cleared in
     nav                  its sample selector (snav.js; none on the standard's)
     A                    its add-peak mode: { on, idx (the guide's index on the pattern),
                          btn, svg, onKey (its document listener) }
========================================================= */
function makeState(host, root, o){
  const p = o.prefix, std = !!o.standard;
  root.innerHTML = H.cardHtml(p, std, U);
  // A card's section of the Results: the patterns stacked, and the crystallite sizes.
  const res = std ? null : document.createElement('div');
  if (res){
    res.className = 'res-an';
    res.innerHTML = H.resHtml(p, U);
  }
  return {
    host, root, res, p, std,
    $: id => root.querySelector('#' + p + id) || (res && res.querySelector('#' + p + id)),
    fields: M.fieldInputs(std),
    processed: [], manualPeaks: [], removedPeaks: [], perParams: [], cifs: [], oldGroups: false,
    paramMode: { ...M.modeDef(std) }, shared: { ...M.sharedDef(std) },
    sizeBy: 'sample', stepNote: [], heldPts: {}, norm: 'global',
    panel: { sel:null, hov:null }, ana: null, stack: null, fullView: false,
    K: { ana: '', step: '', table: '', cag: '', stack: '', stackLeg: '', size: '', chips: '', note: '', cif: '', cifNote: '' },
    cardName: '', pool: [], cifSaid: '', hoverRaf: null, nav: null, A: null,
  };
}
// What it gives xrd.js.
function apiOf(S){
  return {
    res: S.res,
    // The per-sample arrays, for the file list to keep aligned with the included files.
    slots: key => M.slotsOf(S, key),
    addFile(){ M.addEntry(S); },
    // The standard's file replaced or taken away: its own peaks go with it.
    resetFile(){ M.freshEntries(S, files(S)); },
    clear(){ M.clearEntries(S); },
    refresh: preserveView => refresh(S, preserveView),
    // Another sample on show (the cards share it).
    show(){ setAddMode(S, false); S.panel.sel = S.panel.hov = null; writeStoreToInputs(S); updateView(S); renderTable(S); },
    /* The card folded by its arrow, the standard's window closed: a peak being placed is
       left, as by + Add peak again (its button off, the guide gone). Up to v499 it stayed
       on, unseen, until the next key dropped it: a card unfolded again had it still on. */
    disarm(){ setAddMode(S, false); },
    // The standard changed: the corrected sizes, here and in the Results.
    sizesChanged(){ if (files(S).length){ renderTable(S); renderResults(S); } },
    // A label or a colour changed, the card unfolded, the tab on show again or resized: each
    // view drawn again where what it shows changed.
    redraw(){ if (files(S).length){ updateView(S, true); renderTable(S); renderResults(S); } },
    // What it shows beside its state (xrd.js shows; xrd-peaks-model.js showsOf).
    shows: ()=> M.showsOf(S.panel),
    showNext: v => M.showNext(S.panel, v),
    instrModel: ()=> instrModel(S),
    // Its samples' CIFs, among those of the tab (xrd.js cifPool), and its selector's
    // options made again as they change (v575).
    cifs: ()=> S.cifs.filter(Boolean),
    syncCifs: ()=> syncCif(S),
    // The downloads named after the card ("<name> - peaks.csv"), the size chart's by what it shows.
    setName: n => setName(S, n),
    csvEntries: pre => csvEntries(S, pre),
    destroy: ()=> destroy(S),
    snapshot: ()=> M.stateOf(S),
    restore: s => restore(S, s),
  };
}
const files = S => S.host.files();
const curIdx = S => S.std ? 0 : S.host.idx();
// Get params for a specific file index (respects per-field shared/per mode)
const paramsOf = (S, i)=> M.fileParams(S.perParams[i] || {}, S.paramMode, S.shared);
// Every file's, in order.
const paramsAll = S => files(S).map((_, k)=> paramsOf(S, k));

/* ---- The fields ----
   With no file a field, the box, the chips and the λ preset set the stored values all the
   same, for the files to come, as a step of the history (up to v484 a field and the box
   were not kept: the next refresh put the stored values back in them). */
// Validation feedback (shake + auto-correct) for the decimal (type=text) fields;
// the number fields are guarded as any of the page's. Wired before the fields' own
// change handlers.
function guardFields(S){
  guardNumberInputs(S.root);
  M.guardsOf(S.std).forEach(([id,min,def])=> guardNumericInput(S.$(id), { min, def }));
}
// The widths' hints as they are typed (and as they are left: a value refused is set back
// with no input event); the step note's ×; the size chart's chips.
function wireNotes(S){
  for (const id of ['Smooth', 'BlWin']) ['input', 'blur'].forEach(t=> S.$(id).addEventListener(t, ()=> syncHints(S)));
  if (!S.std) S.$('StepNote').addEventListener('click', e=> onStepX(S, e));
  if (S.res) S.res.addEventListener('click', e=> onSizeBy(S, e));
}
function onStepX(S, e){
  if (!e.target.closest('[data-step-x]')) return;
  S.stepNote = []; syncStepNote(S); S.host.commit();
}
function onSizeBy(S, e){
  const b = e.target.closest('[data-size-by]');
  if (!b || b.disabled || b.dataset.sizeBy === S.sizeBy) return;
  S.sizeBy = b.dataset.sizeBy;
  renderSizeChart(S);
  S.host.commit();
}
// Per-field shared/per-sample toggles (one segmented control per editable field), and
// the Results' normalisation.
function wireModes(S){
  if (S.std) return;
  Object.entries(M.TOGGLES).forEach(([tid, key])=> S.$('Mode' + tid).addEventListener('click', ()=> onMode(S, tid, key)));
  S.$('Norm').addEventListener('change', e=> onNorm(S, e));
}
function syncModeButtons(S){
  if (S.std) return;
  Object.entries(M.TOGGLES).forEach(([tid, key])=>{ const c = S.$('Mode' + tid); if (c) c.textContent = S.paramMode[key]==='shared' ? 'all' : 'one'; });
}
// A chip switched (xrd-peaks-model.js switchMode), from the value currently displayed on
// the graph for its field (the baseline's width with its box: one chip for both).
function onMode(S, tid, key){
  const cur = paramsOf(S, curIdx(S));
  const mode = M.switchMode(S, key, cur, files(S).length);
  S.$('Mode' + tid).textContent = mode==='shared' ? 'all' : 'one';
  writeStoreToInputs(S);
  if (files(S).length){
    if (!M.SIZE_ONLY.has(key)){
      if (mode==='shared') reprocessAll(S); else reprocessOne(S, curIdx(S));
      updateView(S, true);
    }
    renderTable(S); renderResults(S);
  }
  S.host.commit();
}
function onNorm(S, e){
  S.norm = normOf(e.target.value);
  if (files(S).length) renderResults(S);
  S.host.commit();
}
// The baseline's box: as a change of its window (no peak deletion undone); then each field.
function wireFields(S){
  S.$('BlOn').addEventListener('change', ()=> onBlOn(S));
  Object.entries(S.fields).forEach(([key, id])=>{
    const el = S.$(id);
    el.addEventListener('change', ()=> onField(S, key));
    el.addEventListener('keydown', e=>{ if (e.key==='Enter') el.blur(); });
  });
}
function onBlOn(S){
  readInputsToStore(S);
  writeStoreToInputs(S);
  if (!files(S).length){ S.host.commit(); return; }
  rerun(S, 'blWin');
}
function onField(S, key){
  readInputsToStore(S);
  writeStoreToInputs(S);
  if (!files(S).length){ S.host.commit(); return; }
  if (M.SIZE_ONLY.has(key)){ renderTable(S); renderResults(S); S.host.commit(); return; } // only the Scherrer size changes
  // Peak deletions reset only when this peak-search field changes
  if (M.PEAK_SEARCH.has(key)) M.clearRemoved(S, key, curIdx(S));
  rerun(S, M.modeOf(key));
}
// A field's change processed (m: its chip): every sample's under "all", else the one on
// show's; the analysis is live.
function rerun(S, m){
  if (S.paramMode[m]==='shared') reprocessAll(S); else reprocessOne(S, curIdx(S));
  updateView(S, true);
  renderTable(S); renderResults(S);
  S.host.changed();
  S.host.commit();
}
// Read inputs into the appropriate store for the sample on show; with no file, every
// value into the shared ones, those a file loaded starts from (xrd-peaks-model.js
// fieldIn, takeInputs).
function readInputsToStore(S){
  const k = curIdx(S), vals = {};
  for (const key in S.fields){
    const el = S.$(S.fields[key]);
    vals[key] = M.fieldIn(key, el.value, el._shown, el._exact);
  }
  M.takeInputs(S, k, vals, S.$('BlOn').checked, files(S).length);
}
// Push stored values for the sample on show into the input fields
function writeStoreToInputs(S){
  const pr = paramsOf(S, curIdx(S));
  for (const key in S.fields){
    const el = S.$(S.fields[key]);
    if (key in M.LEGACY){ el.value = el._shown = widthText(pr[key]*M.SHOWN[key]); el._exact = pr[key]; }
    else el.value = pr[key];
  }
  // (disabled, not hidden: the width means nothing with no baseline)
  S.$('BlOn').checked = pr.blOn; S.$('BlWin').disabled = !pr.blOn;
  if (!S.std){ S.$('Norm').value = S.norm; syncLambdaSelect(S); syncCif(S); }
  syncHints(S);
  syncStepNote(S);
}
// What each width spans in points of the pattern on show (the standard's: its file), in
// its field after the value (xrd-peaks-model.js widthHint).
function syncHints(S){
  const fs = files(S), f = fs[Math.min(curIdx(S), fs.length - 1)], st = f ? meanStep(f.x) : NaN;
  for (const id of ['Smooth', 'BlWin']){
    const el = S.$(id), out = S.$(id + 'Pts');
    const { t, tip } = M.widthHint(id, el.value, el._shown, el._exact, st, f && f.label);
    if (out.textContent !== t) out.textContent = t;
    if (out.title !== tip) out.title = tip;
  }
}
// The note of a project to v510 whose patterns' steps differ, with its ×.
function syncStepNote(S){
  const el = S.$('StepNote');
  if (!el) return;
  const t = H.stepNoteHtml(S.stepNote.filter(m=> S.paramMode[m] === 'per'), U);
  if (t !== S.K.step){ S.K.step = t; el.innerHTML = t; }
}
// Keep the wavelength preset selector in step with the numeric λ value: pick the
// matching source preset (else "Custom"), and lock the value field unless Custom.
function syncLambdaSelect(S){
  const inp = S.$('Lambda'), sel = S.$('LambdaSel');
  if (!inp || !sel) return;
  const matched = M.presetOf(inp.value, [...sel.options].map(q=> q.value));
  sel.value = matched;
  inp.readOnly = (matched !== 'custom');
}
// The samples' wavelength preset, the arrows, the standard's button and the selector.
function wireNav(S){
  if (S.std) return;
  const sel = S.$('LambdaSel'), inp = S.$('Lambda');
  sel.addEventListener('change', ()=> onPreset(sel, inp));
  syncLambdaSelect(S);
  S.$('Prev').onclick = ()=> S.host.step(-1);
  S.$('Next').onclick = ()=> S.host.step(1);
  S.$('Std').onclick = ()=> S.host.openStd();
  // (its list: any sample, straight; snav.js)
  S.nav = snav(S.$('Prev').closest('.snav'), { count: ()=> files(S).length, index: ()=> curIdx(S), label: i=> files(S)[i].label, go: i=> S.host.step(i - curIdx(S)) });
}
// Wavelength preset selector: choosing a source fills + locks the λ value and
// recomputes; "Custom" unlocks the field for a free value.
function onPreset(sel, inp){
  if (sel.value === 'custom'){ inp.readOnly = false; inp.focus(); if (inp.select) inp.select(); }
  else { inp.readOnly = true; inp.value = parseFloat(sel.value); inp.dispatchEvent(new Event('change', { bubbles:true })); }
}

/* ---- The processing ----
   A pattern's processing is kept while what it is made from is the same (its arrays
   never change: xrd.js), so that what is drawn from it is not drawn again: the smoothing
   and the baseline by the 2θ, the intensities and their widths (k1), the peaks by those,
   the variance factors, the peak search and the peaks added and removed by hand (k2:
   xrd-peaks-model.js procKeys).
   Up to v490 every edit made both anew for every pattern it touched or not (a shared
   field, a restore), and a peak-search field the smoothing and the baseline too. */
function reprocessOne(S, i){
  const f = files(S)[i], { k1, k2 } = M.procKeys(f, paramsOf(S, i), S.manualPeaks[i], S.removedPeaks[i], idOf);
  S.processed[i] = procKept(f.y, k2, ()=> processOf(S, i, f, k1, k2));
}
// (xrd-peaks-model.js: the smoothing and the baseline, kept by k1, then the peaks)
function processOf(S, i, f, k1, k2){
  const pr = paramsOf(S, i);
  const sm = smoothKept(f.y, k1, ()=> M.smoothingOf(f.x, f.y, pr));
  return { ...M.processingOf(f, sm, pr, S.manualPeaks[i], S.removedPeaks[i], U), k1, k2 };
}
function reprocessAll(S){
  S.processed = [];
  for (let i=0; i<files(S).length; i++) reprocessOne(S, i);
}
// The standard's peaks the instrumental width is taken from, in 2θ order, and the
// Caglioti fit to them (null with fewer than 3; xrd-peaks-model.js instrModelOf). Null
// with no file. Kept by the standard's processing (modelOf): one object, which the
// samples' views take among their inputs (up to v490 made anew for each size read, a fit
// each time).
function instrModel(S){
  if (!S.std || !files(S).length || !S.processed[0]) return null;
  let m = modelOf.get(S.processed[0]);
  if (m) return m;
  modelOf.set(S.processed[0], m = M.instrModelOf(S.processed[0].peaks));
  return m;
}
// The samples' correction, from the standard's model (host.instr).
const instrOf = S => S.std ? null : S.host.instr();
// Sample k's assignment (xrd-peaks-model.js sampleAssign: null with no CIF), kept (asgKept).
function assignOf(S, k){
  const pr = S.processed[k], q = S.cifs[k], f = files(S)[k];
  if (S.std || !pr || !q || !f) return null;
  const lam = paramsOf(S, k).lambda, key = [idOf(q), lam, idOf(f.x)].join('|'), c = asgKept.get(pr);
  if (c && c.key === key) return c.A;
  const A = M.sampleAssign(f, pr, lam, q, reflOf);
  asgKept.set(pr, { key, A });
  return A;
}
const assignAll = S => files(S).map((_, k)=> assignOf(S, k));
// The classic crystallite sizes of a sample's kept peaks (with a CIF, those assigned),
// summarised (xrd-peaks-model.js sampleSizes).
const sampleSizeStats = (S, i)=> M.sampleSizes(S.processed[i], paramsOf(S, i), instrOf(S), S.std, U, assignOf(S, i));
// Re-derive everything downstream of a peak edit (add/remove/reset) on file `idx`.
function refreshAfterPeakEdit(S, idx){
  reprocessOne(S, idx);
  updateView(S, true);
  renderTable(S);
  renderResults(S);
  S.host.changed();
  S.host.commit();
}
// Everything again from the files: after a change to them (added, removed, left out,
// reordered, read again), or a state loaded. A peak being placed is dropped: its index
// may be on another pattern than the one now on show (to v473 kept while there were
// files: a standard replaced by a shorter one left it past the end, and Enter threw).
function refresh(S, preserveView){
  setAddMode(S, false);
  // (with no file the fields and the chips too: they show what a file loaded will take)
  if (!files(S).length){ S.processed = []; S.panel.sel = S.panel.hov = null; writeStoreToInputs(S); syncModeButtons(S); updateView(S); renderTable(S); return; }
  reprocessAll(S);
  writeStoreToInputs(S);
  syncModeButtons(S);
  updateView(S, preserveView);
  renderTable(S);
  renderResults(S);
}

/* ---- The plot: raw, smoothed, SNIP baseline, peaks (no fit). Each pattern is
   normalised to its own smoothed max (= 1). ---- */
// The plot drawn from the pattern and its processing, as last drawn: the same again, it
// stays as it is (kept in view, as preserveView keeps it; else only where not zoomed).
function drawAnalysisInto(S, idx, preserveView){
  const f  = files(S)[idx];
  const pr = S.processed[idx];
  if (!f || !pr) return;
  const svgNode = S.$('Svg');
  const key = [idx, idOf(f.x), idOf(f.y), idOf(pr), sizeOf(svgNode)].join('|');
  if (S.ana && key === S.K.ana && (preserveView || atOrigin(S.ana))){ highlightPanel(S); return; }
  S.K.ana = '';
  const prevPlot = S.ana;
  const prev = (preserveView && prevPlot) ? {xmin:prevPlot.xmin, xmax:prevPlot.xmax, ymin:prevPlot.ymin, ymax:prevPlot.ymax} : null;
  const D = M.anaOf(f, pr, paramsOf(S, idx).blOn, U);
  const plot  = new Plot(svgNode, {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
  plot.attachTools(svgNode.closest('.plot-wrap'));
  plot.setRange(minArr(f.x), maxArr(f.x), 0, 1.1);
  if (prev){ plot.xmin=prev.xmin; plot.xmax=prev.xmax; plot.ymin=prev.ymin; plot.ymax=prev.ymax; }
  plot.drawAxes();
  plot.line(f.x, D.raw,      '#6a7585', 1);
  plot.line(f.x, D.smoothed, '#3aa0ff', 1.4);
  if (D.base) plot.line(D.dense, D.base, '#ff9933', 1.2);
  // (the legend's entry stays, struck through: no baseline on this pattern)
  S.root.querySelectorAll('.lg-bl').forEach(e=> e.classList.toggle('is-off', !D.blOn));
  D.peakMarks.forEach(mk=> plot.vline(mk.pos, M.PEAK_BASE, false));
  S.ana = plot;
  plot._peakMarks = D.peakMarks;
  plot._fwhmMarks = D.fwhmMarks;
  plot._onView = ()=>{ buildInteractiveMarks(S, plot); highlightPanel(S); };
  buildInteractiveMarks(S, plot);
  highlightPanel(S);
  S.K.ana = key;
}
// The sample on show (the standard's file), its plot and its label. Folded, not drawn: a
// drawing that keeps no zoom (another sample, the files changed, a state loaded) is owed at
// the full range when it unfolds (fullView).
function updateView(S, preserveView){
  const fs = files(S);
  // (the selector: none on the standard's, its window names it)
  if (S.nav) S.nav.update();
  if (!preserveView && S.host.hidden()) S.fullView = true;
  if (!fs.length || !S.processed.length) return;
  const k = Math.min(curIdx(S), fs.length - 1);
  if (S.host.hidden()) return;
  drawAnalysisInto(S, k, preserveView && !S.fullView);
  S.fullView = false;
}
// Recolour the plot's peak vlines AND their FWHM markers from the selection/hover
// (matched by shared _value = peak position: xrd-peaks-model.js markStyles).
function highlightPanel(S){
  const plot = S.ana; if (!plot) return;
  const all = [...plot.gOverlay.querySelectorAll('line')];
  const peakLines = all.filter(el=>el._value!==undefined && !el._fwhm && !el._hit);
  const fwhmSegs  = all.filter(el=>el._fwhm && !el._hit);
  const st = M.markStyles(peakLines.map(el=> el._value), fwhmSegs.map(el=> el._value), S.panel.sel, S.panel.hov);
  peakLines.forEach((el, i)=>{ el.setAttribute('stroke', st.peaks[i][0]); el.setAttribute('stroke-width', st.peaks[i][1]); });
  fwhmSegs.forEach((el, i)=>{ el.setAttribute('stroke', st.fwhm[i][0]); el.setAttribute('stroke-width', st.fwhm[i][1]); });
}
// (Re)build the interactive overlay marks for a plot: visible FWHM segments plus the
// invisible thick hit lines for both peaks and FWHM markers. Called after every
// axis redraw (via _onView) since gOverlay is cleared on each refresh.
function buildInteractiveMarks(S, plot){
  if (!plot) return;
  const g = plot.gOverlay;
  g.querySelectorAll('.xrd-mark').forEach(e=>e.remove());
  const xlo = Math.min(plot.xmin, plot.xmax), xhi = Math.max(plot.xmin, plot.xmax);
  // FWHM markers (visible dark-red segment + horizontal hit line)
  (plot._fwhmMarks || []).forEach(mk=>{
    const y  = plot.py(mk.y);
    const xa = plot.px(mk.x0), xb = plot.px(mk.x1);
    const seg = svgEl('line',{x1:xa,x2:xb,y1:y,y2:y,stroke:M.FWHM_BASE,'stroke-width':2.2,'stroke-linecap':'round','pointer-events':'none','class':'xrd-mark'});
    seg._fwhm = true; seg._value = mk.pos;
    g.appendChild(seg);
    const hit = svgEl('line',{x1:xa,x2:xb,y1:y,y2:y,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'xrd-mark'});
    hit._hit = true;
    addMarkHover(S, hit, mk.pos);
    g.appendChild(hit);
  });
  // Peak hit lines (invisible, full-height, vertical)
  const {h} = plot.size(); const m = plot.margin;
  (plot._peakMarks || []).forEach(mk=>{
    if (mk.pos < xlo || mk.pos > xhi) return;
    const px = plot.px(mk.pos);
    const hit = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'xrd-mark'});
    hit._hit = true;
    addMarkHover(S, hit, mk.pos);
    g.appendChild(hit);
  });
}
// Twin invisible thick "hit" line as a hover listener (à la Tauc draggable bars),
// so peaks and FWHM markers have a fat, responsive target. Scheduled clear on leave
// is cancelled by any enter within the same frame, avoiding flicker when the pointer
// slides between a peak's vertical hit line and its horizontal FWHM hit line.
function addMarkHover(S, el, pos){
  el.addEventListener('pointerenter', ()=>{
    const plot = S.ana;
    if (!plot || plot._mode) return;            // pan/zoom armed
    if (S.A.on) return;                         // placing a manual peak
    if (S.hoverRaf){ cancelAnimationFrame(S.hoverRaf); S.hoverRaf=null; }
    setHover(S, pos);
  });
  el.addEventListener('pointerleave', ()=>{
    if (S.hoverRaf) cancelAnimationFrame(S.hoverRaf);
    S.hoverRaf = requestAnimationFrame(()=>{ S.hoverRaf=null; setHover(S, null); });
  });
}
// Toggle the transient 'hovering' class on the row nearest the hover pos.
function updateRowHover(S){
  const wrap = S.$('PeakTableWrap'); if (!wrap) return;
  const rows = [...wrap.querySelectorAll('.peak-row')];
  const best = M.nearestOf(rows.map(r=> parseFloat(r.dataset.pos)), S.panel.hov);
  rows.forEach((r, i)=>r.classList.toggle('hovering', i === best));
}
// Transient hover (peak + associated row), distinct from selection.
function setHover(S, pos){
  if (pos===S.panel.hov) return;
  S.panel.hov = pos;
  highlightPanel(S);
  updateRowHover(S);
}
// Permanent selection toggle.
function selectPeak(S, pos){
  S.panel.sel = M.toggled(S.panel.sel, pos);
  renderTable(S); highlightPanel(S);
}
function clearSelection(S){ if (S.panel.sel!=null){ S.panel.sel=null; renderTable(S); highlightPanel(S); } }

/* ---- The peak table ---- */
// Classic (peak-search) table (xrd-peaks-html.js peakTableHtml): 2θ, rel intensity,
// classic FWHM, size; with a standard in use, the samples' size both without and with
// the correction.
// (as last drawn: the sample, its processing, its K and λ, the standard's model, the peak
// picked, and whether it was laid out, for its CSV icon, fitted only on the page; the same
// again, the rows and their handlers stay)
function renderTable(S){
  const wrap = S.$('PeakTableWrap');
  if (!wrap) return;
  if (S.std) renderCaglioti(S);
  const fs = files(S), idx = Math.min(curIdx(S), fs.length - 1);
  const kp = fs.length && S.processed[idx] && !S.std ? paramsOf(S, idx) : null;
  const key = !fs.length || !S.processed[idx] ? 'none' : [idx, idOf(S.processed[idx]), ...(kp ? [kp.K, kp.lambda, idOf(instrOf(S)), idOf(assignOf(S, idx))] : []), S.panel.sel, wrap.getClientRects().length > 0].join('|');
  if (key === S.K.table) return;
  S.K.table = key;
  if (!fs.length || !S.processed[idx]){ wrap.innerHTML=''; const rb = S.$('PkReset'); if (rb) rb.style.display = 'none'; fitCsvIcons(S.root); return; }
  paintTable(S, wrap, idx);
}
// The table of file idx's kept peaks (its reset button shown where it has peaks added or
// removed by hand), its rows' listeners.
function paintTable(S, wrap, idx){
  const resetBtn = S.$('PkReset');
  const hasManual = (S.manualPeaks[idx]||[]).length > 0;
  const hasRemoved = (S.removedPeaks[idx]||[]).length > 0;
  if (resetBtn) resetBtn.style.display = (hasRemoved || hasManual) ? '' : 'none';
  const pks = S.processed[idx].peaks.filter(pk=>!pk.removed);
  if (!pks.length){ wrap.innerHTML = H.NO_PEAKS; return; }
  wrap.innerHTML = H.peakTableHtml(pks, { std: S.std, m: instrOf(S), fp: paramsOf(S, idx), picked: S.panel.sel, st: S.std ? null : sampleSizeStats(S, idx), A: assignOf(S, idx) }, U);
  wireRows(S, wrap, idx);
  fitCsvIcons(S.root);
}
// A row hovered and picked; a peak's × (xrd-peaks-model.js dropPeak).
function wireRows(S, wrap, idx){
  wrap.querySelectorAll('.peak-row').forEach(row=>{
    const pos = parseFloat(row.dataset.pos);
    row.addEventListener('mouseenter', ()=> setHover(S, pos));
    row.addEventListener('mouseleave', ()=> setHover(S, null));
    row.addEventListener('click', e=>{
      if (e.target.closest('.peak-del')) return;
      selectPeak(S, pos);
    });
  });
  wrap.querySelectorAll('.peak-del').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      M.dropPeak(S, idx, parseFloat(btn.dataset.det), btn.dataset.manual === '1');
      refreshAfterPeakEdit(S, idx);
    });
  });
}
// The standard's Caglioti fit, in the right-hand column, a curve not physical flagged
// under it (xrd-peaks-html.js cagliotiHtml).
function renderCaglioti(S){
  const box = S.$('Cag'), alert = S.$('CagAlert');
  if (!box || !alert) return;
  const m = instrModel(S), key = files(S).length + '|' + idOf(m);
  if (key === S.K.cag) return;
  S.K.cag = key;
  const c = H.cagliotiHtml(m, files(S).length);
  alert.innerHTML = '';
  box.innerHTML = c.box;
  if (c.alert) alert.innerHTML = c.alert;
}

/* ---- Results (a card's): the patterns stacked, and the crystallite sizes ---- */
function renderResults(S){
  if (!S.res || !files(S).length || !S.processed.length) return;
  // Analysis: smoothed − SNIP baseline
  drawStackedResults(S, S.processed.map(pr=>pr.subtracted));
  renderSizeChart(S);
}
// Stacked, baseline-subtracted overview. `curves[k]` holds each sample's raw
// (un-offset) trace on its own x axis; null entries (e.g. no fit) are skipped.
// The plot as last drawn: the patterns, their curves and colours, the normalisation, its
// size. A label is no part of it: the legend's (written again alone), and the name the
// figure composer gives its trace (set in place).
function drawStackedResults(S, curves){
  const fs = files(S), shown = M.stackShown(fs, curves);
  const svg = S.$('ResSvg'), legend = S.$('ResLegend');
  const leg = H.stackLegendHtml(fs, shown, U);
  if (leg !== S.K.stackLeg){ S.K.stackLeg = leg; legend.innerHTML = leg; }
  const key = [S.norm, sizeOf(svg), ...shown.map(k=> [fs[k].name, fs[k].color, idOf(fs[k].x), idOf(curves[k])].join(':'))].join('|');
  if (S.stack && key === S.K.stack){
    const lab = new Map(shown.map(k=> [fs[k].name, fs[k].label]));
    S.stack._stored.forEach(e=>{ if (lab.has(e.key)) e.label = lab.get(e.key); });
    return;
  }
  S.K.stack = '';
  const St = M.stackOf(fs, curves, shown, S.norm, U);
  const plot = S.stack = new Plot(svg, {xlabel:'2θ (°)', ylabel:'Intensity (a. u.)', noYTickLabels:true});
  plot.attachTools(plot.svg.closest('.plot-wrap'));
  plot.setRange(...St.range);
  plot.drawAxes();
  // Draw the stacked trace, but hand the composer the un-offset CSV values.
  St.traces.forEach(({ k, y, norm1 })=> plot.line(fs[k].x, y, fs[k].color, 1.3, undefined,
    { raw: { xs: fs[k].x, ys: norm1 }, label: fs[k].label, key: fs[k].name }));
  S.K.stack = key;
}
/* What the size chart shows (v575; to v574 every sample, and by peak the reflections the
   samples shared, matched by position): the samples' assignments (A) and how many have a
   CIF (n), its rows by what the chips ask (by peak where a peak is assigned: ok), the
   species and the series (xrd-peaks-model.js sizeRows, speciesOf, sizeSeries). */
function sizeView(S){
  const fs = files(S), A = assignAll(S), fps = paramsAll(S), m = instrOf(S);
  const byPeak = M.sizeRows('peak', fs, A, S.processed, fps, m, U), ok = byPeak.length > 0, by = ok ? S.sizeBy : 'sample';
  const rows = by === 'peak' ? byPeak : M.sizeRows('sample', fs, A, S.processed, fps, m, U);
  return { A, n: A.filter(Boolean).length, ok, by, rows, SER: M.sizeSeries(rows, M.speciesOf(A)) };
}
// The chart as last drawn: what it draws (its rows, series, the chips in its corner) and its
// size; the chips and the note under it as last written.
function renderSizeChart(S){
  const chips = S.$('SizeBy'), note = S.$('SizeByNote'), svg = S.$('SizeBarSvg');
  const V = sizeView(S);
  // Two chips, one at a time; with no sample with a CIF, none.
  const ch = H.sizeChipsHtml(V.n, V.ok, V.by);
  if (chips && ch !== S.K.chips){ S.K.chips = ch; chips.innerHTML = ch; }
  // (shown before it is measured: one hidden measures nothing)
  const hide = !files(S).length || !S.processed.length || !M.sizeTops(V.rows, V.SER).length;
  if (svg && !hide){ svg.style.display = ''; svg.closest('.plot-wrap').style.display = ''; }
  const key = hide ? 'none' : JSON.stringify([V.rows, V.SER, ch, sizeOf(svg)]);
  if (key !== S.K.size){ S.K.size = ''; drawSizeBarChart(S, V.rows, V.SER, chips); S.K.size = key; }
  // What it leaves out: the samples with no CIF.
  const nt = H.sizeNoteHtml(files(S).filter((_, k)=> !V.A[k]).map(f=> f.label), U);
  if (note && nt !== S.K.note){ S.K.note = nt; note.innerHTML = nt; }
  sizeNames(S, V.by);
}
/* The crystallite sizes as box plots — by sample, a box per sample with a CIF over its
   assigned peaks' sizes; by peak, a box per reflection of a species over its samples' — each
   species a series, two boxes side by side when a standard is in use (size, and
   corrected), with the mean ± the standard deviation written above (its series and their
   tops: xrd-peaks-model.js sizeSeries, sizeTops; its layout: barLayout). */
function drawSizeBarChart(S, rows, SER, chips){
  const svg = S.$('SizeBarSvg'); if (!svg) return;
  const wrap = svg.closest('.plot-wrap'), legend = S.$('SizeBarLegend');
  const tops = M.sizeTops(rows, SER);
  if (!files(S).length || !S.processed.length || !tops.length){
    svg.style.display='none'; if(wrap)wrap.style.display='none'; if(legend)legend.innerHTML=''; return;
  }
  svg.style.display=''; if(wrap)wrap.style.display='';
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const brect = svg.getBoundingClientRect();
  const svgW = brect.width || 640, svgH = brect.height || 420;
  // How the names are cut and tilted — see barNames.
  const fit = barNames(mctx, rows.map(r=> r.label), Math.max(60, svgW - 75), 55);
  const L = M.barLayout(rows, SER, fit, t=> mctx.measureText(t).width, svgW, svgH);
  // The labels kept clear of the chips in the corner, as on the other bar charts.
  const ymax = M.barYmax(tops, L.frac, barChipYmax(chips, svg, L.under, { W:svgW, ml:55, mr:20, mTop:L.mTop, plotH:L.plotH, gap:L.gap, x0:0, x1:L.n+1 }));
  const plot = new Plot(svg, {xlabel:'', ylabel:'Crystallite size (nm)', noXTickLabels:true, noXGrid:true, yGrid:true, margin:{l:55,r:20,t:L.mTop,b:L.bottom}});
  // Fixed at [0, n+1]: the names are made to fit it, not the other way round.
  plot.setRange(0, L.n+1, 0, ymax||1);
  plot.drawAxes();
  drawBoxes(plot, rows, SER, L, fit);
  plot.attachTools(wrap);
  if (legend) legend.innerHTML = H.sizeLegendHtml(SER, U);
}
// Each row's boxes (its species' series, a pair: size and corrected), their labels, and its
// name under them. A box no shorter than its mean's cross (v576: plot.js minBox), so that one
// of a single size, as a reflection of one sample by peak, shows its series' colour.
function drawBoxes(plot, rows, SER, L, fit){
  for (let k=0;k<L.n;k++){
    const xc=k+1, r = rows[k];
    M.seriesOf(SER, r).forEach((m, mi)=>{
      const b = r[m.k+'Box'];
      if (!b) return;
      const off = L.offOf(mi);
      plot.box(xc, { ...b, mean: r[m.k+'Mean'], err: r[m.k+'Std'] }, m.color, L.hw, off, { label: m.name, minBox: true });
      plot.barLabel(xc, M.boxTop(b), M.sizeLab(r[m.k+'Mean'], r[m.k+'Std']), {gap:L.gap, dx:off});
    });
    plot.tickLabel(xc, fit.labels[k], fit.rot, r.label, r.name);
  }
}
// The chart's image follows what it shows (by: sizeView's), its CSVs never
// (xrd-peaks-model.js sizeDlNames). Both named after the card.
function sizeNames(S, by){
  const N = M.sizeDlNames(S.cardName ? S.cardName + ' - ' : '', by);
  const wrap = S.$('SizeBarSvg').closest('.plot-wrap');
  wrap.querySelectorAll('.plot-dl-btn, .plot-csv-btn').forEach(b=>{
    b.dataset.csvNames = N.csv;
    if (b.classList.contains('plot-dl-btn')) b.dataset.dlName = N.svg;
  });
}
// The downloads named after the card ("<name> - peaks.csv"), the size chart's by what it shows.
function setName(S, n){
  S.cardName = n;
  const pre = n ? n + ' - ' : '';
  [S.root, S.res].filter(Boolean).forEach(el=>{
    el.querySelectorAll('[data-csv-base]').forEach(b=>{ b.dataset.csvNames = b.dataset.csvBase.split(',').map(x=> pre + x).join(','); });
    el.querySelectorAll('[data-dl-base]').forEach(b=>{ b.dataset.dlName = pre + b.dataset.dlBase; });
    el.querySelectorAll('.plot-wrap').forEach(w=>{ const d = w.querySelector('.plot-dl-btn[data-csv-base]'), c = w.querySelector('.plot-csv-btn'); if (d && c) c.dataset.csvNames = d.dataset.csvNames; });
  });
  if (S.res) sizeNames(S, sizeView(S).by);
}
// The CSVs, each named after the card (pre: "<name> - "); the standard's in one file
// (xrd-peaks-model.js csvTables).
const csvEntries = (S, pre)=> M.csvTables(pre, { files: files(S), procs: S.processed, fps: paramsAll(S), asg: assignAll(S), m: instrOf(S), norm: S.norm, std: S.std }, U);

/* ---- The sample's CIF (v575) ----
   Its selector: none, the tab's CIFs (host.cifs: every Rietveld card's phases' and every
   Scherrer card's samples', each once: xrd-peaks-model.js cifPool), and Add CIF…, which reads
   one for the sample on show as the Rietveld card reads its phases (xrd-rv-model.js
   readCifs). Its options made again as the card is drawn, as another card's change is
   committed (xrd.js syncCifs) and as it is focused or pressed; under it, what the last CIF
   read said (its refusal, until the next CIF chosen or read, or a state put back) and an
   older version's note (readState's oldGroups). */
function wireCif(S){
  if (S.std) return;
  const sel = S.$('Cif'), inp = S.$('CifInput');
  ['focus', 'pointerdown'].forEach(t=> sel.addEventListener(t, ()=> syncCif(S)));
  sel.addEventListener('change', ()=> onCif(S));
  inp.addEventListener('change', ()=>{ const fl = [...inp.files]; inp.value = ''; if (fl.length) addCif(S, fl, files(S)[curIdx(S)]); });
}
function syncCif(S){
  const sel = S.$('Cif');
  if (!sel) return;
  S.pool = M.cifPool(S.host.cifs());
  const opts = H.cifOptionsHtml(S.pool, U), k = curIdx(S), at = files(S)[k] ? M.poolAt(S.pool, S.cifs[k]) : -1;
  if (opts !== S.K.cif){ S.K.cif = opts; sel.innerHTML = opts; }
  sel.value = at >= 0 ? String(at) : '';
  sel.disabled = !files(S).length;
  const note = (S.oldGroups ? H.OLD_GROUPS : '') + S.cifSaid;
  if (note !== S.K.cifNote){ S.K.cifNote = note; S.$('CifNote').innerHTML = note; }
}
// A choice: none, one of the pool's, or Add CIF… (the selector set back to the sample's own
// until one is read).
function onCif(S){
  const v = S.$('Cif').value, k = curIdx(S);
  if (v === 'add'){ syncCif(S); S.$('CifInput').click(); return; }
  if (!files(S)[k]) return;
  M.setCif(S, k, v === '' ? null : S.pool[+v]);
  S.cifSaid = '';
  cifChanged(S);
}
// CIFs read (the first that reads, for the sample f on show as they were picked; one not read
// said in a compact box under the selector, "Not added: …", as the Rietveld card says it).
async function addCif(S, fl, f){
  const { got, errs } = await readCifs(fl);
  S.cifSaid = errs.length ? boxHtml('bad', notAddedLines(errs).map(esc)) : '';
  const k = files(S).indexOf(f);
  if (got.length && k >= 0){ M.setCif(S, k, { file: got[0].file, cif: got[0].text }); cifChanged(S); }
  else syncCif(S);
}
// A sample's CIF changed: the views that show it, a step of the history.
function cifChanged(S){ syncCif(S); renderTable(S); renderResults(S); S.host.commit(); }

/* ---- The peaks by hand: reset, the add-peak mode, the plot's and the table's clicks ---- */
function wirePeaks(S){
  // Reset peaks: drop manual + removed peaks and re-run the search for the file on show
  S.$('PkReset').onclick = ()=> resetPeaks(S);
  wireAdd(S);
  // Plot-side peak click-to-select (mirror of the table interaction), acting only when
  // no pan/zoom tool is armed and no peak is being placed; the hover is the marks' own.
  // (a click here is the peaks': no trace is picked out on this plot, plot.js pickOff)
  S.$('Svg')._noPick = true;
  S.$('Svg').addEventListener('click', ()=> onPlotClick(S));
  // Deselect when clicking anywhere in the table's box that isn't a peak row
  S.$('PeakBox').addEventListener('click', e=>{ if (!e.target.closest('.peak-row')) clearSelection(S); });
}
function resetPeaks(S){
  const idx = curIdx(S);
  if (!files(S)[idx]) return;
  S.manualPeaks[idx] = [];
  S.removedPeaks[idx] = [];
  refreshAfterPeakEdit(S, idx);
}
function onPlotClick(S){
  const plot = S.ana; if (!plot || plot._mode || S.A.on) return;
  if (S.panel.hov!=null) selectPeak(S, S.panel.hov);  // clicked a peak/FWHM → (de)select it
  else clearSelection(S);                             // clicked empty area → deselect
}
/* ---------- Add-peak mode (S.A) ---------- */
function wireAdd(S){
  const A = S.A = { on: false, idx: null, btn: S.$('AddPeak'), svg: S.$('Svg'), onKey: null };
  A.btn.onclick = ()=>{ if (files(S).length && curIdx(S)>=0) setAddMode(S, !A.on); };
  A.svg.addEventListener('pointermove', e=>{
    if (!A.on || !S.ana || !S.processed[curIdx(S)]) return;
    A.idx = pointToIdx(S, e); drawGuide(S);
  });
  A.svg.addEventListener('pointerleave', ()=>{ if (A.on) clearGuide(A); });
  A.svg.addEventListener('pointerdown', e=>{
    if (!A.on || !S.ana || e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    A.idx = pointToIdx(S, e); confirmAdd(S);
  }, true);
  // Capture phase + stopImmediatePropagation so that while add-peak is armed
  // it claims the arrow keys before the document-level sample-nav handler
  // (utils.js) can fire (onAddKey).
  A.onKey = e=> onAddKey(S, e);
  document.addEventListener('keydown', A.onKey, true);
}
const clearGuide = A => A.svg.querySelectorAll('.add-guide').forEach(e=>e.remove());
function drawGuide(S){
  const A = S.A;
  clearGuide(A);
  const plot = S.ana, idx = curIdx(S);
  if (!A.on || !plot || !S.processed[idx] || A.idx==null) return;
  const m = plot.margin; const {w,h} = plot.size();
  const pr = S.processed[idx];
  const mxv = maxArr(pr.smoothed) || 1;
  const xv = files(S)[idx].x[A.idx];
  const yval = pr.smoothed[A.idx] / mxv;
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
function setAddMode(S, on){
  const A = S.A;
  A.on = !!on;
  A.btn.classList.toggle('is-on', A.on);
  // Drop focus once armed so the arrow keys (which nudge the guide) don't put
  // the button into :focus-visible and paint a white selection outline.
  if (A.on) A.btn.blur();
  A.svg.style.cursor = A.on ? 'crosshair' : '';
  // While armed, suppress the plot's x/y hover readout + crosshair (same as pan/zoom).
  A.svg._suppressReadout = A.on;
  const plot = S.ana;
  if (A.on && plot){ plot.setMode(null); plot._clearCrosshair(); }
  if (!A.on){ A.idx = null; clearGuide(A); }
}
function confirmAdd(S){
  const A = S.A;
  if (A.idx==null) return;
  const idx = curIdx(S), x = files(S)[idx] && files(S)[idx].x;
  // (an index past the end of the pattern on show, as a stale one could be, adds nothing)
  if (!x || !Number.isFinite(x[A.idx])){ setAddMode(S, false); return; }
  if (!S.manualPeaks[idx]) S.manualPeaks[idx] = [];
  S.manualPeaks[idx].push(x[A.idx]);
  setAddMode(S, false);
  refreshAfterPeakEdit(S, idx);
}
function pointToIdx(S, e){
  const plot = S.ana;
  const rect = plot.svg.getBoundingClientRect();
  let xv = plot.invX(e.clientX - rect.left);
  xv = Math.max(plot.xmin, Math.min(plot.xmax, xv));
  return M.nearestIdx(files(S)[curIdx(S)].x, xv);
}
/* On show: the panel in the page (a card closed, switched to the other kind or rebuilt
   by an undo is out of it), laid out (its tab on show, the standard's window open, the
   card unfolded) and under no window (the standard's over the cards, a figure composer,
   the calendar, a settings window): a window is any backdrop laid out, as the composers
   and the calendar have no inline display to read. */
const onShow = S => S.root.isConnected && S.root.getClientRects().length > 0 && !S.host.hidden()
  && ![...document.querySelectorAll('.modal-backdrop')].some(m=> m.getClientRects().length > 0 && !m.contains(S.root));
// While add-peak is armed, ← / → nudge the guide instead of changing sample (otherwise
// the document-level sample-nav handler would). Only while the panel is on show: off show
// the mode is dropped and the key goes on (to v473 a card closed, or the standard's
// window, kept ← / → and Enter page-wide, and Enter added a peak where it was no longer
// seen).
function onAddKey(S, e){
  const A = S.A;
  if (!A.on) return;
  const plot = S.ana, idx = curIdx(S), f = files(S)[idx];
  if (!onShow(S) || !plot || !f){ setAddMode(S, false); return; }
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
  if (e.key==='Escape'){ e.stopImmediatePropagation(); setAddMode(S, false); return; }
  if (e.key==='ArrowLeft' || e.key==='ArrowRight'){
    e.preventDefault(); e.stopImmediatePropagation();
    if (onBtn) t.blur();
    A.idx = M.nudge(f.x, plot.xmin, plot.xmax, A.idx, e.key==='ArrowRight'?1:-1);
    drawGuide(S);
  } else if (e.key==='Enter'){ e.preventDefault(); e.stopImmediatePropagation(); confirmAdd(S); }
}

/* ---- The state ---- */
// The card closed, switched to the other kind or rebuilt (xrd.js): its document
// listener goes, and the add mode with it (to v473 it stayed, and kept the card's
// closure, its arrays with it, for as long as the page).
function destroy(S){
  document.removeEventListener('keydown', S.A.onKey, true); setAddMode(S, false);
  if (S.hoverRaf){ cancelAnimationFrame(S.hoverRaf); S.hoverRaf = null; }
}
/* Every setting from the state (xrd-peaks-model.js readState: each set whether the state
   holds it or not, a value that is no number the default, the widths of a project to
   v510, in points, converted at each pattern's step, and those of the files left out
   held), the normalisation made valid; nothing picked. */
function restore(S, s){
  const fs = files(S), st = fs.map(f=> meanStep(f.x));
  // (and the steps of the files left out, which come back with their entries)
  const stAll = st.concat(!S.std ? S.host.allFiles().filter(f=> f.included === false).map(f=> meanStep(f.x)) : []);
  M.takeState(S, M.readState(s, S.std, st, stAll), normOf(M.objOf(s).norm));
  S.cifSaid = '';
  writeStoreToInputs(S); syncModeButtons(S);
}
