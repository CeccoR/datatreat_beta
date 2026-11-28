import { settings, fmtNum, csvLine, cumtrapz, maxArr, minArr, meanArr, stdArr, createDateTimeField, flashFieldInvalid, guardNumericInput, fitCsvIcons, esc, registerModule, keeper, objId, exactKey } from './utils.js';
import { Plot, svgEl } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, isObj, num, oneOf, dateOf, arrOf, without, cardList } from './modkit.js';
import { CSV_ICON, plotWrap, viewOf, setView, viewKey, chipRow, toggleChip, valueBars } from './modcharts.js';
import { autoPair } from './filelist-model.js';
import { sideOf } from './gc-pair.js';
import { createInteg, INTEG_INFO } from './gc-integ.js';
import * as M from './gc-model.js';
import * as H from './gc-html.js';

/* =========================================================
   GC MODULE

   MADE PER TAB (v518): createGc is the module's factory (utils.js registerModule), each open
   GC tab that is awake an instance of its own, made of its copy of index.html's section
   (root) and a layer (the kinds' menu). Its elements are found in root, a card's in its
   card and in its section of the Results, never in the page: its ids are the page's only
   while it is on show. Its registries go by its key, the tab's id (moduleKit). It draws only
   on show: hidden (a state read out for its CSVs) it works out its tables and rates, which
   the CSVs are made of, and draws nothing; its redraw draws all as it is shown; a tab shown
   again with nothing changed and at the same width draws nothing (its draw key). It has no
   job that runs on while hidden. utils.js registerModule says how a module is made so.

   SPLIT (v557): what the Production Rate cards work out, and what their plots and CSVs are
   made of, in gc-model.js (plain functions, tested in Node); their words and markup in
   gc-html.js; the Integration cards in gc-integ.js, as before; here the page: the
   instance's state (S, below), its kit and deck, each card's state (C: its parameters,
   tables, plots and the sample picked), its fields, plots and Results, the history. Each
   is a function at module level of the instance S (and of a card's C), not a closure inside
   createGc: what a listener holds is what it is handed.
========================================================= */
// utils.js's and modkit.js's helpers the model takes (gc-model.js U), and what the markup
// takes (gc-html.js u).
const U = { settings, fmtNum, csvLine, cumtrapz, maxArr, minArr, meanArr, stdArr, objId, exactKey, num, oneOf, dateOf, arrOf, without, wideCsv };
const HU = { esc, num, plotWrap, CSV_ICON };
const GC_INFO = H.gcInfo(cardInfo(false, true));

/* A sample's tables (gc-model.js tablesOf: each gas's times, readings, flows and their
   integral), kept by its first gas's readings (utils.js keeper: while a state, a tab asleep
   or a history holds the file) under all they are made from (gc-model.js tablesKey): the
   injections' dates, the gases' readings, the light-on instant, the injection delay and the
   flow's rate, temperature, pressure and the mass. A tab woken, an undo, a redraw and the
   CSVs take them as made (to v517 every redraw made them again). The integral from the
   interval's start (FmInt) is the card's own, made at each change of the interval: it lies
   on a copy (gc-model.js dataTable). */
const tablesKept = keeper('gc-tables', 8);

/* =========================================================
   THE INSTANCE
   A GC tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }) is its
   state S, which every function below takes:
     root, key, layer     its section, its key, its layer; $(id): an element of root by id;
                          shown(): whether on show
     stale, drawnAt       hidden, nothing is drawn (utils.js registerModule): drawable(S)
                          says whether to draw, and when not marks the instance to be drawn
                          whole as it is shown (stale); drawnAt, the width it was last drawn
                          whole at, its draw key (redrawTab)
     kit, all, files      the module (modkit.js): every file loaded, in list order, {name,
                          label, injDates:[Date], gas:{h2:[number], o2:[number]} (the gases
                          it has, in %mol), emptyRows, and dayMonth: true, badDates: n,
                          monthNames: true, altExport: true where they apply (gc-model.js
                          readGc), and sample, the file it is a replicate of, where it is one
                          (REPLICATES)}, and the included ones, which the analysis sees,
                          `files`, with which the per-sample arrays each card keeps are
                          aligned; the alerts under the drop zone (gc-html.js fileNotes), the
                          dates read day first or left out, the empty cells skipped, the files
                          read as the alternative export and the pairs to check among them,
                          each box's × marking its files seen (modkit.js notes, v572: `seen`
                          in the record; to v571 marks in memory, S.seen); each card's
                          settings in the history. A gas's values, which nothing
                          changes once read, are fixed (db.js: the same array in a tab's
                          states and its parked state). From v544 a record may also be raw
                          chromatograms ({ name, label, color, rawBytes, tcd: { n } }) or a
                          pair, the first file's record with the second as its `mate` (PAIRS,
                          gc-model.js): only a table heading its row is a sample (`files`)
     walk                 a walk through a Sample select's options (gc-model.js setSample),
                          let go as the list is drawn anew by any other change
                          (afterFilesChange: to v556 it kept the files it named, a file
                          removed too, until the next choice)
     deck, live           the cards (cards.js): the records, in card order, and their
                          analyses, id → a Production Rate card's C (makeCard) or an
                          Integration card's (gc-integ.js)
     integ                the Integration cards' common part (gc-integ.js createInteg)
     resList              the Results' list of the cards' sections
     cardsNext            what the cards of a tab woken or reloaded showed (showNext), by id
========================================================= */
const drawable = S => S.shown() || !(S.stale = true);
const cards = S => S.deck.records;
const each = (S, fn)=> cards(S).forEach(a=> fn(S.live.get(a.id), a));
// Something to show in the cards: a sample, or raw chromatograms (an Integration card's).
const shownAny = S => S.files.length > 0 || S.all.some(f=> f.included !== false && M.hasTcd(f));

// A GC tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createGc({ key, root, layer, shown }){
  const S = {
    root, key, layer, shown, $: id => root.querySelector('#' + id), stale: false, drawnAt: '',
    kit: null, all: null, files: null,
    walk: null, deck: null, live: new Map(), integ: null, resList: null, cardsNext: null,
  };
  S.kit = moduleKit('gc', kitHooks(S));
  S.all = S.kit.all; S.files = S.kit.files;
  /* Files dropped: tables and raw chromatograms read, paired by their names, placed. The
     first raw chromatograms of a project bring an Integration card, above the first
     Production Rate card; the integration starts (a Stop before it does not hold it). */
  S.kit.dropText((text, bytes)=> M.readGcAny(text, bytes, (b, d)=> S.integ.prime(b, d)), ()=>{ afterFilesChange(S); S.integ.ensure(true); }, {
    names: ()=> S.all.filter(r=> r.mate).map(r=> r.mate.name), none: M.NOT_GC,
    collect: recs => collect(S, recs),
  });
  S.resList = S.$('gcResList');
  S.integ = createInteg(integCtx(S));
  S.deck = S.kit.deck(deckHooks(S));
  // A new project starts with one card.
  S.deck.start(['rate']);

  /* ---- The instance (tabs.js) ----
     A GC tab, hidden, holds little beyond its sleeping form (0.2 MB of heap for 10
     exports), most of it its parameter table and file list, which it shows as they are;
     its plots let go gave back nothing measurable, their tool buttons still holding their
     Plots (measured at v518). */
  return {
    // Let go (its tab closed or put to sleep; a state read out for its CSVs): the deck's
    // menu and its listeners. Its section and layer are the shell's to take out.
    destroy(){ S.integ.destroy(); S.kit.destroy(); },
    /* What it shows beside its state (tabs.js, utils.js shownOf): each card's own, by
       its id (the sample picked), given back as its tab wakes or the page is reloaded, to
       the restore. */
    shows(){
      const out = {};
      each(S, (c, a)=>{ const v = c.shows(); if (v) out[a.id] = v; });
      return Object.keys(out).length ? { cards: out } : null;
    },
    showNext(v){ S.cardsNext = isObj(v) && isObj(v.cards) ? v.cards : null; },
  };
}

/* ---- The module's kit (modkit.js) ---- */
function kitHooks(S){
  return {
    root: S.root, key: S.key, layer: S.layer,
    // (the plots' gas chips, H₂ / O₂: the view alone, a step but no change unsaved; utils.js VIEW_KEYS)
    // (and the Integration cards' run overview: its gases and its y, v544)
    view: ['gasSel', 'ovGas', 'ovY'],
    // (what the reading of the files said, gc-html.js fileNotes; a box's × marking a file in
    // the states that hold it as a pair's second too, gc-model.js inRows)
    notes: ()=> H.fileNotes(S.all, HU), markIn: M.inRows,
    // Only a table heading its row is a sample (raw chromatograms alone, or paired with raw
    // chromatograms, have no injection times: Analysis leaves them out, v544).
    sample: M.isTable,
    // (a record as a state holds it, before the restore takes it: a place among the per-sample
    // arrays unless it is raw chromatograms, so that one left out takes its entries with it)
    rawSample: f => !M.isTcd(f),
    // A pair is one row, its two files in FILE, each with a grip of its own (v544; always, a
    // list of tables alone too: v581).
    pairs: pairsOf(S),
    // Every card's per-sample arrays. An excluded file holds its own values; one with none
    // (never so far, or in a card added since) gets the upload defaults.
    slots: ()=> slotsAll(S),
    // (a head removed: its group stays, headed by its next file, relink)
    listed: op =>{ if (op !== 'palette') each(S, c=> c.unselect()); if (op === 'remove') M.relink(S.all); },
    refresh: ()=> afterFilesChange(S),
    // The Sample column of the file list (REPLICATES, gc-model.js).
    note: (f, i)=> H.sampleCell(S.all, f, i, HU), noteHead: 'SAMPLE', noteChange: (i, name, again)=>{ S.walk = M.setSample(S.all, S.walk, i, name, again); },
    redraw: what => redraw(S, what),
    cleared: ()=> each(S, c=> c.clear()),
    // (and the integrations' results its cards use, where there are any: gc-integ.js)
    snapshot: ()=> snapshotOf(S),
    // A file as a restore takes it (gc-model.js fileIn: tables, raw chromatograms and pairs).
    file: f => M.fileIn(U, f),
    restore: (s, gone)=> restoreState(S, s, gone),
    redrawTab: ()=> redrawTab(S),
    csv: ()=> cards(S).flatMap(a=> S.live.get(a.id).exportEntries(fileSafe(a.name))),
  };
}
// Every card's per-sample arrays (an Integration card has none).
const slotsAll = S => cards(S).flatMap(a=> S.live.get(a.id).slots());
/* A label or a colour changed: the zoom kept (the data are the same), a folded card not
   drawn (to v494 it was, hidden, at no size, and lost its zoom). A file's sample: the
   mean-rate bars alone, the only plot per sample. */
function redraw(S, what){
  if (what === 'note'){ each(S, c=> c.bars()); return; }
  if (what === 'label') sampleNames(S);
  each(S, (c, a)=>{ if (what === 'label') c.renderTable(); if (!S.deck.isFolded(a)) c.compute(true); else c.computeQuiet(); });
}
// The history's own state (kit.snapshot): each card's settings beside its record, and the
// integrations' results its cards use, where there are any (gc-integ.js).
function snapshotOf(S){
  const sv = S.integ.saved();
  return { cards: cards(S).map(a=> ({ ...S.deck.saved(a), ...S.live.get(a.id).snapshot() })), ...(sv ? { integ: sv } : {}) };
}
/* The cards (none, one of the defaults, as a new project starts). A card built afresh takes its
   settings when its analysis is made (init), its per-sample arrays without the entries of the
   files the restore left out (gc-model.js cardsOf, initOf). The files' samples as they should
   be (relink): a project from before them, each file its own. */
function restoreState(S, s, gone){
  M.relink(S.all);
  S.integ.load(s.integ);
  S.deck.load(M.cardsOf(cardList(s.cards, M.KINDS)), src=> ({ init: M.initOf(U, src, gone) }), a=>{ S.live.get(a.id).restore(a.init); delete a.init; });
  // (what its cards showed, given as its tab woke or the page was reloaded: showNext)
  if (S.cardsNext){ const v = S.cardsNext; S.cardsNext = null; each(S, (c, a)=>{ if (isObj(v[a.id])) c.showNext(v[a.id]); }); }
}
/* Re-fit at the current size, keeping the zoom. Nothing changed since it was all drawn
   (nothing left undrawn while hidden, the same width): nothing to draw, a tab shown
   again as it was left. */
function redrawTab(S){
  const at = String(S.root.clientWidth);
  if (!S.stale && at === S.drawnAt) return;
  S.stale = false; S.drawnAt = at;
  fitCsvIcons(S.root);
  if (shownAny(S)){ S.deck.fitNames(); each(S, (c, a)=>{ if (!S.deck.isFolded(a)) c.compute(true); else c.computeQuiet(); }); }
}

/* ---- REPLICATES (gc-model.js): the file list's Sample column ---- */
// The Sample column's options after a label renamed: each its file's label again.
function sampleNames(S){
  const { by } = M.byName(S.all);
  S.root.querySelectorAll('#gcFileTableWrap select.file-sample option').forEach(o=>{ const g = by.get(o.value); if (g && o.textContent !== g.label) o.textContent = g.label; });
}

/* ---- PAIRS (gc-model.js) ----
   The trace list's rows (modkit.js pairs): a pair's its record with both files' bytes for its
   download, every row's files in FILE, each with its grip, a list of tables alone too (v581:
   to v580 none while no raw chromatograms and no pair were loaded, as to v543, and two tables
   unpaired by hand could not be paired again). A file dragged by its grip (filelist-model.js
   dropPart): paired, swapped or alone, the samples' values following (regroup; the cards'
   samples picked let go, listed). */
const pairsOf = S => ({
  files: M.rowFiles, parts: M.partsOf,
  row: r => r.mate ? { ...r, rawFiles: [{ name: r.name, bytes: r.rawBytes }, { name: r.mate.name, bytes: r.mate.rawBytes }] } : r,
  regroup(rows){ M.regroup(S.all, S.files, slotsAll(S), rows); M.relink(S.all); },
});
// The records a drop read, paired by their names and placed (modkit dropText's collect).
function collect(S, recs){
  if (!recs.length) return;
  const rows = autoPair(S.all.map(M.rowFiles), recs, sideOf);
  M.regroup(S.all, S.files, slotsAll(S), rows);
  M.relink(S.all);
  if (S.all.some(M.hasTcd) && !cards(S).some(a=> a.type === 'integ')){
    const at = cards(S).findIndex(a=> a.type === 'rate');
    S.deck.add('integ', { at: at < 0 ? 0 : at, quiet: true });
  }
}

// (The alerts are drawn with the list, kit.showFiles: the empty-cell alert follows the files.)
// (all drawn, on show: its draw key, the width it was drawn at)
function afterFilesChange(S){
  // (the list drawn anew: no Sample select walks on, gc-model.js setSample)
  S.walk = null;
  S.kit.showFiles();
  S.$('gcAnalyses').style.display = shownAny(S) ? 'block' : 'none';
  each(S, c=> c.renderTable());
  if (shownAny(S)) each(S, (c, a)=>{ if (!S.deck.isFolded(a)) c.compute(); else c.computeQuiet(); });
  // (nothing to show: the cards hidden, a Production Rate card's tables let go all the same)
  else each(S, (c, a)=>{ if (a.type === 'rate') c.computeQuiet(); });
  syncResults(S);
  if (S.shown()){ S.stale = false; S.drawnAt = String(S.root.clientWidth); }
  S.kit.commit();
  S.integ.ensure();
}

/* =========================================================
   A CARD: one analysis of the samples — its masses, flows, light-on times,
   integration intervals and injection delay, its plot, and its section of the
   Results. `a` is its record (cards.js), `card` its element; its state is C, and goes to
   the history through snapshot / restore:
     a, card, res, $(id)  its record, its card, its section of the Results (kept in card
                          order under the Results' list), an element of either by its id's
                          end, whether or not they are in the page
     P                    its parameters (gc-model.js newParams), one object for the card's
                          life: a restore puts its values in it
     dataTables, costResults   its tables (gc-model.js dataTable) and mean rates
                          (computeRates), the CSVs' and the Results'
     plot1                its Analysis plot
     sel, hov             the sample selected / hovered (interval interaction)
     prevView             the outgoing plot view captured before a resize/tab-switch redraw
                          recreates the plots, so drawData can restore the current zoom
                          instead of snapping to the full range: on the same samples and the
                          same full range only (modcharts setView), so a card unfolded after
                          its files changed shows them all
     hoverRAF             the frame a hover's end waits for
     srcWas               its source of values as it last worked them out (ratesFollow)
   and, for every card of the deck alike (gc.js asks the same of an Integration card),
   slots, clear, unselect, shows, showNext, bars, renderTable, compute, computeQuiet,
   hasResults, exportEntries, snapshot, restore.
========================================================= */
function makeCard(S, a, card){
  const px = 'gc' + a.id;
  // The card's section of the Results, kept in card order under the Results' list.
  const res = document.createElement('div');
  res.className = 'res-an';
  res.dataset.an = a.id;
  res.innerHTML = H.resHtml(a, HU);
  res.style.display = 'none';
  S.resList.appendChild(res);
  // (a card added with samples loaded starts from the upload defaults for each)
  const C = {
    a, card, res, $: id => card.querySelector('#' + px + id) || res.querySelector('#' + px + id),
    P: M.newParams(S.files), dataTables: [], costResults: [], plot1: null, sel: null, hov: null, prevView: null, hoverRAF: null,
  };
  card.addEventListener('click', e=> onGasChip(S, C, e));
  res.addEventListener('click', e=> onGasChip(S, C, e));
  return Object.assign(C, {
    // The per-sample arrays, for the file list (keys the card's own).
    slots: ()=> M.slotsOf(U, C.P, a.id),
    clear(){ const P = C.P; [P.ms,P.As,P.Qs,P.Ts,P.Ps,P.startArr,P.endArr,P.lightOnDates].forEach(x=> x.length=0); C.dataTables=[]; C.costResults=[]; },
    unselect(){ C.sel = C.hov = null; },
    /* What it shows beside its state (the instance's shows): the sample picked in its
       table or on its plot, its interval highlighted (intervals one per sample), by its
       file's name, given back as its tab wakes or the page is reloaded, the card restored,
       where that file is still a sample and the intervals still one per sample. */
    shows(){ return C.sel != null && M.intPerSample(C.P) && S.files[C.sel] ? { sel: S.files[C.sel].name } : null; },
    showNext(v){ const k = v && typeof v.sel === 'string' && M.intPerSample(C.P) ? S.files.findIndex(f=> f.name === v.sel) : -1; if (k >= 0) C.sel = k; },
    // (a file's sample changed: the bars alone are per sample)
    bars(){ if (S.files.length && drawable(S)) drawBarChart(S, C); },
    renderTable: ()=> renderTable(S, C),
    compute: preserveView => compute(S, C, preserveView),
    // A folded card draws nothing; its Results section is drawn all the same.
    computeQuiet: ()=> computeQuiet(S, C),
    hasResults: ()=> C.res.style.display !== 'none',
    // The card's CSVs, named after it (gc-model.js csvEntries).
    exportEntries: n => M.csvEntries(U, C.P, n, C.dataTables, C.costResults, M.samplesOf(S.all, S.files), S.files),
    snapshot: ()=> M.snapshotOf(C.P),
    // (gc-model.js restoreParams: each value as it should be; no sample picked)
    restore(s0){ M.restoreParams(U, C.P, s0, S.files); C.sel = C.hov = null; },
  });
}

/* ---- The card's parameter table (gc-html.js paramTableHtml) and its fields ---- */
function renderTable(S, C){
  const wrap = C.$('ParamTableWrap');
  // (a refusal said under it holds until the table changes: anything confirmed in it, an
  // all/one chip pressed, the table drawn again)
  clearRule(C);
  if (!wrap.dataset.ruled){ wrap.dataset.ruled = '1'; wrap.addEventListener('change', ()=> clearRule(C), true); wrap.addEventListener('click', e=>{ if (e.target.closest('.gc-toggle')) clearRule(C); }, true); }
  if (!S.files.length){ wrap.innerHTML=''; return; }
  wrap.innerHTML = H.paramTableHtml(C.P, S.files, HU);
  if (drawable(S)) fitCsvIcons();
  wireDelay(S, C, wrap);
  wireUnit(S, C, wrap);
  wireNorm(S, C, wrap);
  // all/one toggles (gc-model.js flipMode), then re-render + recompute.
  wrap.querySelectorAll('.gc-toggle').forEach(btn=> btn.addEventListener('click', ()=> modeToggled(S, C, btn)));
  wireNums(S, C, wrap);
  wireBounds(S, C, wrap);
  wireDates(S, C, wrap);
  wireRows(S, C, wrap);
  refreshRows(C);
}
// The warning beside each row, where light-on is before (or at) its first injection.
function refreshLightOnWarnings(S, C){
  C.$('ParamTableWrap').querySelectorAll('.gc-row').forEach(r=>{
    const wc = r.querySelector('.gc-warn-cell');
    if (wc) wc.innerHTML = H.lightOnWarnHtml(C.P, S.files, +r.dataset.i);
  });
}
// The injection delay: its value, and Auto.
function wireDelay(S, C, wrap){
  const P = C.P, delayIn = wrap.querySelector('.gcDelay'), delayBox = wrap.querySelector('.gcDelayAuto');
  guardNumericInput(delayIn, { min:0 });
  delayIn.addEventListener('change', ()=>{
    P.delayMan = +delayIn.value;
    refreshLightOnWarnings(S, C); compute(S, C); S.kit.commit();
  });
  // Off, the field opens on the value that was in force, ready to be changed.
  delayBox.addEventListener('change', ()=>{
    if (!delayBox.checked && P.delayAuto) P.delayMan = M.INJ_DELAY_AUTO;
    P.delayAuto = delayBox.checked;
    renderTable(S, C); compute(S, C); S.kit.commit();
  });
}
// p's unit: the values shown again in it, the pressure and so the rates as they were.
// The fields in place, not the table drawn anew, which would take the focus off the
// select (an arrow key on it is a change at once).
function wireUnit(S, C, wrap){
  const P = C.P, unitIn = wrap.querySelector('.gc-unit');
  unitIn.addEventListener('change', ()=>{
    P.pUnit = oneOf(unitIn.value, Object.keys(M.P_UNITS));
    wrap.querySelectorAll('input[data-f="p"]').forEach(inp=>{ inp.value = M.inUnit(inp.classList.contains('gcShared') ? P.pShared : M.pOf(P, +inp.dataset.i), P.pUnit); });
    S.kit.commit();
  });
}
// What the rates are normalised by, m, A or none (its header, v581; none v589): the column
// shown again as the one in force (none: — and nothing to type), the rates and their labels
// worked out anew, a step; the focus kept on the select (an arrow key on it is a change at once).
function wireNorm(S, C, wrap){
  const P = C.P, normIn = wrap.querySelector('.gc-norm');
  normIn.addEventListener('change', ()=>{
    P.normBy = oneOf(normIn.value, M.PER);
    renderTable(S, C);
    wrap.querySelector('.gc-norm').focus({ preventScroll: true });
    compute(S, C); S.kit.commit();
  });
}
/* A value the interval refuses (a bound typed, an all/one chip): the field or the chip flashes
   and the rule is said in red under the parameter table until the next change in it (v571,
   ALERTS-REVIEW.md C19, G12: to v570 a banner). */
function refuseParam(C, el, why){
  flashFieldInvalid(el);
  const r = C.$('ParamRule');
  r.textContent = why; r.hidden = false;
}
function clearRule(C){ const r = C.$('ParamRule'); if (r && !r.hidden){ r.hidden = true; r.textContent = ''; } }
// An all/one chip: flipped (gc-model.js flipMode), or refused with why, as a value typed is.
function modeToggled(S, C, btn){
  const pair = btn.dataset.pair, why = M.flipMode(C.P, S.files, pair);
  if (why){ refuseParam(C, btn, why); return; }
  if (pair === 'start' || pair === 'end') C.sel = C.hov = null;
  renderTable(S, C); compute(S, C); S.kit.commit();
}
// m/A/Q/T/p inputs (shared + per-sample) — recompute the whole series on a valid change.
function wireNum(S, C, inp, apply, min = 0.001, max = null){
  guardNumericInput(inp, { min, max });
  const shared = inp.classList.contains('gcShared');
  inp.addEventListener('change', ()=>{
    apply(+inp.value);
    if (shared) mirrorShared(C, inp.dataset.f, inp.value);
    compute(S, C); S.kit.commit();
  });
}
function wireNums(S, C, wrap){
  const P = C.P, all = sel => wrap.querySelectorAll(sel);
  /* m, or A where it is in force (v540): at least 0.001, as Q; empty, 0, below or no number
     refused (v585, the user's decision: every sample its value; v581–v584 took empty as none,
     the rates then not normalised). With None (v589) neither has a field: nothing wired. */
  all('.gcShared[data-f="m"]').forEach(inp=> P.mMode==='all' && wireNum(S, C, inp, v=> P.mShared=v));
  all('.gcShared[data-f="q"]').forEach(inp=> P.qMode==='all' && wireNum(S, C, inp, v=> P.qShared=v));
  all('.gcCell[data-f="m"]').forEach(inp=>{ if(P.mMode==='one'){ const i=+inp.dataset.i; wireNum(S, C, inp, v=> P.ms[i]=v); }});
  all('.gcShared[data-f="a"]').forEach(inp=> P.aMode==='all' && wireNum(S, C, inp, v=> P.aShared=v));
  all('.gcCell[data-f="a"]').forEach(inp=>{ if(P.aMode==='one'){ const i=+inp.dataset.i; wireNum(S, C, inp, v=> P.As[i]=v); }});
  all('.gcCell[data-f="q"]').forEach(inp=>{ if(P.qMode==='one'){ const i=+inp.dataset.i; wireNum(S, C, inp, v=> P.Qs[i]=v); }});
  all('.gcShared[data-f="t"]').forEach(inp=> P.tMode==='all' && wireNum(S, C, inp, v=> P.tShared=v, -273));
  all('.gcCell[data-f="t"]').forEach(inp=>{ if(P.tMode==='one'){ const i=+inp.dataset.i; wireNum(S, C, inp, v=> P.Ts[i]=v, -273); }});
  // p typed in its unit, kept in Pa; 0 and below refused (the least min above 0).
  all('.gcShared[data-f="p"]').forEach(inp=> P.pMode==='all' && wireNum(S, C, inp, v=> P.pShared=M.toPa(v, P.pUnit), Number.MIN_VALUE, M.P_MAX));
  all('.gcCell[data-f="p"]').forEach(inp=>{ if(P.pMode==='one'){ const i=+inp.dataset.i; wireNum(S, C, inp, v=> P.Ps[i]=M.toPa(v, P.pUnit), Number.MIN_VALUE, M.P_MAX); }});
}
/* With a parameter set to "all", the per-sample cells are read-only echoes of the
   shared value and nothing redraws them on their own, so they are brought into step
   when the shared field is confirmed — otherwise the rows go on showing the old
   number until the next full render. Not while it is typed: a half-written number
   is not a value the samples have. */
function mirrorShared(C, field, value){
  C.$('ParamTableWrap').querySelectorAll(`.gcCell[data-f="${field}"]`)
    .forEach(inp=>{ inp.value = value; });
}
// start/end inputs — start and end can be in different modes, so each input is wired
// independently and validated against the effective counterpart (end>start per sample).
function wireBounds(S, C, wrap){
  const P = C.P;
  if (P.startMode==='all') wireBound(S, C, wrap.querySelector('.gcShared[data-f="start"]'), 'start', true, 0);
  if (P.endMode==='all')   wireBound(S, C, wrap.querySelector('.gcShared[data-f="end"]'),   'end',   true, 0);
  S.files.forEach((f,i)=>{
    if (P.startMode==='one') wireBound(S, C, wrap.querySelector(`.gcCell[data-i="${i}"][data-f="start"]`), 'start', false, i);
    if (P.endMode==='one')   wireBound(S, C, wrap.querySelector(`.gcCell[data-i="${i}"][data-f="end"]`),   'end',   false, i);
  });
}
// Wire a single interval-bound input (start or end; shared or per-sample i). Since the
// two bounds can be in different all/one modes, each input validates against the
// effective counterpart so that end>start holds for every affected sample. Invalid
// input shakes the field and reverts.
function wireBound(S, C, inp, which, isShared, i){
  if (!inp) return;
  guardNumericInput(inp, {});
  const P = C.P, echo = ()=>{ if (isShared) mirrorShared(C, which, inp.value); };
  inp.addEventListener('change', ()=>{
    const cur = isShared ? (which==='start'?P.startShared:P.endShared) : (which==='start'?P.startArr[i]:P.endArr[i]);
    const v = M.parseIntervalField(inp.value);
    if (v===null){ inp.value = cur; echo(); return; }
    // A shared start must stay below every sample's end; a per-sample start below its own end.
    const why = M.intervalWhy(P, S.files, which, v, isShared, i);
    if (why){ inp.value = cur; echo(); refuseParam(C, inp, why); return; }
    if (isShared){ if (which==='start') P.startShared=v; else P.endShared=v; }
    else { if (which==='start') P.startArr[i]=v; else P.endArr[i]=v; }
    echo();
    updateRegression(S, C); S.kit.commit();
  });
  inp.addEventListener('keydown', e=>{ if (e.key==='Enter') inp.blur(); });
}
// Each sample's light-on date and time (utils.js createDateTimeField).
function wireDates(S, C, wrap){
  wrap.querySelectorAll('.gc-date-cell').forEach(cell=>{
    const i = +cell.dataset.i;
    const field = createDateTimeField(C.P.lightOnDates[i], d=> lightOnSet(S, C, cell, i, d));
    cell.appendChild(field.el);
  });
}
function lightOnSet(S, C, cell, i, d){
  C.P.lightOnDates[i] = d;
  const wc = cell.closest('tr').querySelector('.gc-warn-cell');
  if (wc) wc.innerHTML = H.lightOnWarnHtml(C.P, S.files, i);
  compute(S, C); S.kit.commit();
}
// Row ↔ plot interaction (interval mode 'one'): hover highlights the sample's lines
// on both plots; clicking (off the inputs) toggles the selection.
function wireRows(S, C, wrap){
  wrap.querySelectorAll('.gc-row').forEach(row=>{
    const i = +row.dataset.i;
    row.addEventListener('mouseenter', ()=> setHover(S, C, i));
    row.addEventListener('mouseleave', ()=> setHover(S, C, null));
    row.addEventListener('click', e=>{ if (e.target.closest('input, button, .gc-date-cell')) return; select(S, C, i); });
  });
}

/* ---- The card's tables and rates (gc-model.js) ---- */
// (its tab not on show: the tables and the rates worked out, the CSVs' and the Results'
// own, and nothing drawn: drawn whole as it is shown)
// (no sample: nothing said of its rates either, and nothing kept of the tables it had: blank)
const noSample = (S, C)=>{ if (S.files.length) return false; blank(S, C); return true; };
/* A card with no sample (every table left out or removed, raw chromatograms alone perhaps)
   as one that never had any: no tables and no rates (no CSV of its), its plots, legends,
   gas chips and sources' note empty, its Results hidden (v569: to v568 the last ones stayed,
   in the project's CSVs and on show beside the raw chromatograms). */
function blank(S, C){
  C.dataTables = []; C.costResults = []; C.plot1 = null; C.prevView = null;
  ['Svg1', 'SvgRate', 'SvgCum', 'SvgBar'].forEach(id=> unplot(C.$(id)));
  ['Legend', 'ResLegend', 'BarLegend', 'Src'].forEach(id=>{ C.$(id).innerHTML = ''; });
  gasEls(C).forEach(el=>{ el.innerHTML = ''; });
  showRates(S, C);
}
// A plot's box as the page gave it: nothing drawn, no toolbar, its download button back in
// its place (plot.js attachTools takes it into the toolbar it builds).
function unplot(svg){
  svg.innerHTML = ''; svg._plot = null; svg.removeAttribute('style');
  const col = svg.closest('.plot-wrap').querySelector('.plot-btn-col'), dl = col && col.querySelector('.plot-dl-btn');
  if (dl) col.replaceWith(dl);
}
function compute(S, C, preserveView){
  if (noSample(S, C)) return;
  // Snapshot the current zoom before renderPlots() builds fresh Plot instances.
  C.prevView = preserveView ? viewOf(C.$('Svg1')._plot) : null;
  computeTables(S, C);
  renderGasSel(S, C);
  if (drawable(S)) renderPlots(S, C); else updateRegression(S, C);
}
// The data, from the card's parameters and each sample's source of values (srcFor), kept
// (tablesKept); where they came from said at the card's top.
function computeTables(S, C){
  const P = C.P;
  C.dataTables = S.files.map((f,h)=>{
    const src = srcFor(S, C.a, f), G = src && src.gas ? src.gas : f.gas;
    const ks = Object.keys(G), lightOn = P.lightOnDates[h];
    const key = M.tablesKey(U, P, f, h, G, lightOn);
    const made = tablesKept(ks.length ? G[ks[0]] : null, key, ()=> M.tablesOf(U, P, f, h, lightOn, G));
    return M.dataTable(made, f, src);
  });
  paintSrc(S, C);
}
// (gc-html.js srcAlertsHtml, naming the Integration card above)
function paintSrc(S, C){
  const box = C.$('Src');
  if (!box) return;
  const above = integAbove(S, C.a), name = above ? (cards(S).find(x=> S.live.get(x.id) === above) || {}).name : '';
  box.innerHTML = H.srcAlertsHtml(C.dataTables, name, HU);
}
// A folded card draws nothing; its Results section is drawn all the same.
function computeQuiet(S, C){
  if (noSample(S, C)) return;
  computeTables(S, C); renderGasSel(S, C); C.costResults = M.computeRates(C.P, C.dataTables);
  showRates(S, C);
  if (drawable(S)){ drawResultPlots(S, C); drawBarChart(S, C); }
  C.$('ResLegend').innerHTML = C.dataTables.map(d=> H.gasLegendHtml(d, M.shownGases(C.P, S.files, 'r'), HU)).join('');
}
// The mean rates, and what shows them: the Analysis plot's lines, the Results.
function updateRegression(S, C){
  C.costResults = M.computeRates(C.P, C.dataTables);
  const draw = drawable(S);
  if (draw) drawData(S, C);
  // Show the Results section before drawing into it: plots sized from a hidden element
  // would measure 0. It stays hidden while no sample has a valid integration interval.
  showRates(S, C);
  if (draw){ drawResultPlots(S, C); drawBarChart(S, C); }
}

/* ---- The gas chips ---- */
// The plots' gas chips, the card's and its section's.
const gasEls = C => [...C.card.querySelectorAll('.gc-gas-sel'), ...C.res.querySelectorAll('.gc-gas-sel')];
/* The gas selector, rendered into the card and its Results section and driving one
   state each. Options the loaded files cannot supply are disabled rather than hidden,
   so the control does not change shape from one data set to the next. */
function renderGasSel(S, C){
  // A gas no included sample carries cannot be chosen, and is off while it is not
  // there; the chips show what is drawn (shownGases), the choice stays untouched. The
  // last one standing cannot be switched off — the plot would be empty.
  gasEls(C).forEach(el=>{
    const sec = el.dataset.gasSec;
    el.innerHTML = chipRow(M.GASES, M.shownGases(C.P, S.files, sec).map(g=> g.key), { cls: 'gc-gas-chip', data: g=> `data-gas="${g.key}" data-sec="${sec}"`,
      name: g=> g.csv, can: g=> M.gasPresent(S.files, g.key), why: g=> `No ${g.csv} in the included files` });
  });
}
function onGasChip(S, C, e){
  const b = e.target.closest('.gc-gas-chip');
  if (!b || b.disabled) return;
  // Switched off, what was on show stays chosen (a fallback included); a gas chosen
  // but not loaded now stays chosen too, for when a file brings it (toggleChip).
  const sec = b.dataset.sec, sel = toggleChip(M.GASES.map(g=> g.key), C.P.gasSel[sec], M.shownGases(C.P, S.files, sec).map(g=> g.key), b.dataset.gas);
  if (!sel) return;    // never leave a section with none
  // Switching changes how tall the legend is, which would shift everything below it
  // under the pointer. Hold the clicked chip still and let the page move around it.
  // The chips are rebuilt, so the one to measure afterwards is found by which group
  // it belongs to, not by its selector — every plot in the section has a matching
  // chip and the first one is metres away from the one under the pointer.
  const groups = gasEls(C);
  const gi = groups.indexOf(b.parentElement);
  const before = b.getBoundingClientRect().top;
  C.P.gasSel[sec] = sel;
  renderGasSel(S, C);
  compute(S, C, false);     // ranges are rescaled to the gases now on show
  // Corrected in the same task, not on a later frame: reading the chip's box forces
  // the layout, so the final position is known before anything is painted and the
  // page never shows the shifted state on its way back.
  const grp = gasEls(C)[gi];
  const after = grp && grp.querySelector('.gc-gas-chip');
  if (after) window.scrollBy({ top: after.getBoundingClientRect().top - before, behavior: 'instant' });
  S.kit.commit();
}

/* ---- The card's plots ---- */
// What the card's rates are in (gc-model.js NORM): by mass, by area or as measured (none).
const units = C => M.NORM[C.P.normBy];
/* One line per sample per gas, the sample's colour throughout and the gas told by
   the dash pattern, so a sample stays recognisable across both gases. The name
   carries the gas only when more than one is on show (gc-model.js seriesName). */
function drawGasLines(plot, tables, shown, key){
  tables.forEach(d=>{
    shown.forEach(g=>{
      const q = d.gas[g.key];
      if (!q) return;
      // On the gas's own times: an injection it has no value for is not one of its points.
      plot.line(q.t, q[key], d.color, 1.3, g.dash, { label: M.seriesName(d.label, g, shown), key: d.name + '/' + g.key });
    });
  });
}
function renderPlots(S, C){
  const legend = C.$('Legend'); legend.innerHTML='';
  C.plot1 = new Plot(C.$('Svg1'), {xlabel:'Time (h)', ylabelSvg:units(C).rateSvg});
  const resLegend = C.$('ResLegend'); resLegend.innerHTML='';
  legend.innerHTML   = C.dataTables.map(d=> H.gasLegendHtml(d, M.shownGases(C.P, S.files, 'a'), HU)).join('');
  resLegend.innerHTML = C.dataTables.map(d=> H.gasLegendHtml(d, M.shownGases(C.P, S.files, 'r'), HU)).join('');
  C.plot1.attachTools(C.plot1.svg.closest('.plot-wrap'));
  updateRegression(S, C);
}
// Draw the data lines over the range gc-model.js dataRange gives (the data and every
// interval line, y from 0 to the data from light-on on). Interval lines are drawn as an
// overlay, redrawn on pan/zoom via _onView.
function drawData(S, C){
  const plot = C.plot1;
  if (!plot || !C.dataTables.length) return;
  // Restore the pre-redraw zoom captured in compute (resize/tab-switch), then clear it so
  // a subsequent data-driven redraw snaps back to the full range.
  const prev = C.prevView; C.prevView = null;
  const shown = M.shownGases(C.P, S.files, 'a'), range = M.dataRange(U, C.P, C.dataTables, shown);
  if (!range) return;
  plot.setRange(...range);
  setView(plot, prev, viewKey(C.dataTables));
  plot.drawAxes(); plot.clearData();
  drawGasLines(plot, C.dataTables, shown, 'Fm');
  plot._onView = ()=> drawIntervals(S, C, C.plot1);
  drawIntervals(S, C, plot);
}
// The integration-interval vertical lines (gc-model.js intervalLines), each sample's with
// an invisible fat hit line for hover/select where they are one per sample.
function drawIntervals(S, C, plot){
  if (!plot) return;
  const g = plot.gOverlay;
  g.querySelectorAll('.gc-int').forEach(e=>e.remove());
  const { h } = plot.size(), m = plot.margin;
  M.intervalLines(C.P, C.dataTables, C.sel, C.hov).forEach(({ x, o })=>{
    const px = plot.px(x);
    const ln = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,'stroke-width':o.width,'pointer-events':'none','class':'gc-int'+(o.cls?' '+o.cls:'')});
    if (o.color) ln.setAttribute('stroke', o.color);
    g.appendChild(ln);
    if (o.hit){
      const ht = svgEl('line',{x1:px,x2:px,y1:m.t,y2:h-m.b,stroke:'transparent','stroke-width':16,'cursor':'pointer','class':'gc-int'});
      ht.addEventListener('pointerenter', ()=> setHover(S, C, o.k));
      ht.addEventListener('pointerleave', ()=> scheduleClearHover(S, C));
      ht.addEventListener('click', ()=> select(S, C, o.k));
      g.appendChild(ht);
    }
  });
}
// ---- Row ↔ plot interaction (both respond in unison) ----
function scheduleClearHover(S, C){
  if (C.hoverRAF) cancelAnimationFrame(C.hoverRAF);
  C.hoverRAF = requestAnimationFrame(()=>{ C.hoverRAF=null; setHover(S, C, null); });
}
function setHover(S, C, k){
  if (!M.intPerSample(C.P)) k = null;
  if (C.hoverRAF){ cancelAnimationFrame(C.hoverRAF); C.hoverRAF=null; }
  if (C.hov === k) return;
  C.hov = k;
  drawIntervals(S, C, C.plot1); refreshRows(C);
}
function select(S, C, k){
  if (!M.intPerSample(C.P)) return;
  // Clear any transient hover so the green .hovering tint doesn't linger after a
  // click (mirrors the XRD peak table, whose full re-render drops it).
  if (C.hoverRAF){ cancelAnimationFrame(C.hoverRAF); C.hoverRAF=null; }
  C.hov = null;
  C.sel = (C.sel===k) ? null : k;
  drawIntervals(S, C, C.plot1); refreshRows(C);
}
function refreshRows(C){
  C.$('ParamTableWrap').querySelectorAll('.gc-row').forEach(r=>{
    const k = +r.dataset.i;
    r.classList.toggle('hovering', k===C.hov);
    r.classList.toggle('selected', k===C.sel);
  });
}
// The two Results plots: same quantities as Analysis, between the interval's lines and
// without the interval overlay (Results shows the retained data only), y from 0 to
// the data from light-on on, as there (gc-model.js cutTables, cutRange).
function drawResultPlots(S, C){
  const cut = M.cutTables(C.P, C.dataTables), x = M.cutRange(U, cut);
  if (!x) return;
  const shown = M.shownGases(C.P, S.files, 'r'), N = units(C);
  resultPlot(C, 'SvgRate', N.rateSvg, 'Fm', cut, shown, x);
  resultPlot(C, 'SvgCum',  N.cumSvg,  'FmInt', cut, shown, x);
}
function resultPlot(C, id, ylabelSvg, key, cut, shown, [tmin, tmax]){
  const svg = C.$(id);
  const p = new Plot(svg, {xlabel:'Time (h)', ylabelSvg});
  const arrs = cut.flatMap(d=> shown.filter(g=>d.gas[g.key]).map(g=> d.gas[g.key][key]));
  if (!arrs.length) return;
  p.setRange(tmin, tmax, 0, M.yTop(cut, shown, key)*1.05);
  p.drawAxes(); p.clearData();
  drawGasLines(p, cut, shown, key);
  p.attachTools(svg.closest('.plot-wrap'));
}
/* The mean rates (modcharts.js valueBars), a bar per sample (gc-model.js sampleRates), each
   shown gas a series of its own beside the others in each sample's slot, the way the XRPD
   size chart pairs raw and corrected: coloured by gas (the samples are told apart by their
   place on the axis, the gases would not be) and named by it, as the legend under the
   chart is; its error bar the ± of the sample's replicates; its label the value and its ±
   to 2 decimals, by mass or by area (v543: to v542, 4; the CSVs keep theirs). Nothing to
   show draws nothing: the section's visibility is updateRegression's. */
function drawBarChart(S, C){
  const svg = C.$('SvgBar'), sm = M.sampleRates(U, C.costResults, M.samplesOf(S.all, S.files));
  valueBars(svg, { cats: sm, digits: 2, yLabel: units(C).rateSvg, legend: C.$('BarLegend'),
    series: M.barSeries(M.shownGases(C.P, S.files, 'r'), sm),
    chips: svg.closest('.plot-wrap').querySelector('.gc-gas-sel') });
}

/* ---- The cards (cards.js), and the Results: each card's section under its name ---- */
const placeRes = S => cards(S).forEach(a=>{ const c = S.live.get(a.id); if (c && c.res) S.resList.appendChild(c.res); });
// The Results card is there while some card has a result to show.
// The card's Results shown where there is a rate; with samples and none, the card says why.
function showRates(S, C){
  const on = M.hasResults(C.costResults), why = C.$('NoRate');
  C.res.style.display = on ? '' : 'none';
  if (why){ why.textContent = H.NO_RATE; why.style.display = on || !S.files.length ? 'none' : ''; }
  syncResults(S);
}
function syncResults(S){
  const on = cards(S).filter(a=> S.live.has(a.id) && S.live.get(a.id).hasResults());
  S.$('gcResultsBar').style.display = S.files.length && on.length ? 'block' : 'none';
  cards(S).forEach(a=>{ const c = S.live.get(a.id); if (c && c.res) c.res.classList.toggle('is-first', a === on[0]); });
}
function named(S, a){
  const card = S.deck.cardOf(a), c = S.live.get(a.id);
  if (!card || !c) return;
  const n = fileSafe(a.name);
  if (a.type === 'integ'){
    // (the chromatogram over its residuals, one toolbar; the run overview)
    nameDownloads(card.querySelector('.gci-pair'), `${n} - GC_chromatogram.svg`, `${n} - chromatogram.csv`);
    nameDownloads(card.querySelector('svg.gci-over').closest('.plot-wrap'), `${n} - GC_run_overview.svg`, `${n} - integration.csv`);
    return;
  }
  card.querySelector('.table-csv-btn').dataset.csvNames = `${n} - gc_info.csv`;
  nameDownloads(card.querySelector('.plot-wrap'), `${n} - GC_rate.svg`, `${n} - gc_raw.csv`);
  c.res.querySelector('.res-an-title').textContent = a.name;
  const w = c.res.querySelectorAll('.plot-wrap');
  nameDownloads(w[0], `${n} - GC_results_rate.svg`, `${n} - gc_results.csv`);
  nameDownloads(w[1], `${n} - GC_results_cumulative.svg`, `${n} - gc_results.csv`);
  nameDownloads(w[2], `${n} - GC_results.svg`, `${n} - mean_rates.csv`);
}
/* The Integration cards' common part: the raw chromatograms read, the results kept and
   written into the history, the job (gc-integ.js). Results that came in, a method or a
   calibration changed: the Production Rate cards below follow (ratesFollow). */
function integCtx(S){
  return {
    kit: S.kit, all: S.all, gases: M.GASES.map(g=> ({ key: g.key, label: g.label, txt: M.gasTxt(g), csv: g.csv, color: g.bar })),
    cards: ()=> cards(S), inst: id => S.live.get(id), layer: S.layer, isTcd: M.isTcd,
    drawable: ()=> drawable(S), shown: S.shown, changed: ()=> ratesFollow(S, true), folded: a => S.deck.isFolded(a),
    // (v549: a calibration's table, read as any GC table, with its injections' names)
    readTable: text => M.readGc(text, true),
  };
}
/* A Production Rate card's source of values (v544): the nearest Integration card above it,
   or none (the tables, as to v543). What it reads of it (`srcSig`): which card, its method
   and calibration, its results; a card whose source changed (a card moved, added, closed,
   results come in) is worked out again, and only those (`force`: every card with one). */
function integAbove(S, a){
  const list = cards(S);
  for (let i = list.indexOf(a) - 1; i >= 0; i--) if (list[i].type === 'integ') return S.live.get(list[i].id) || null;
  return null;
}
// A sample's values (gc-integ.js valuesFor), or null: its table's.
const srcFor = (S, a, f)=>{ const c = integAbove(S, a); return c ? c.valuesFor(f) : null; };
const srcSig = (S, a)=>{ const c = integAbove(S, a); return c ? cards(S).find(x=> S.live.get(x.id) === c).id + ':' + c.sig() : ''; };
function ratesFollow(S, force){
  each(S, (c, a)=>{
    if (a.type !== 'rate') return;
    const s = srcSig(S, a);
    if (!(force ? s : s !== c.srcWas)) return;
    c.srcWas = s;
    if (!S.files.length) return;
    if (!S.deck.isFolded(a)) c.compute(true); else c.computeQuiet();
  });
}
function deckHooks(S){
  return {
    kinds: M.KINDS, info: t => t === 'integ' ? INTEG_INFO : GC_INFO, body: a => a.type === 'integ' ? '<div class="gci-body"></div>' : H.cardBody(a, HU),
    // ("+" offers Integration while raw chromatograms are loaded; a card keeps its kind)
    offer: ()=> S.all.some(M.hasTcd) || cards(S).some(a=> a.type === 'integ') ? ['rate', 'integ'] : ['rate'], fixedKinds: true,
    build: (a, card)=>{ const c = a.type === 'integ' ? S.integ.card(a, card) : makeCard(S, a, card); S.live.set(a.id, c); if (a.init){ c.restore(a.init); delete a.init; } },
    drop: a=>{ const c = S.live.get(a.id); if (c){ if (c.res) c.res.remove(); if (c.destroy) c.destroy(); S.live.delete(a.id); } syncResults(S); },
    autoName: a => M.KINDS[a.type] || M.KINDS.rate, named: a => named(S, a),
    changed: ()=>{ placeRes(S); syncResults(S); ratesFollow(S); S.integ.ensure(); },
    loaded: ()=> placeRes(S),
    added: a=>{ const c = S.live.get(a.id); c.renderTable(); if (a.type === 'integ'){ c.compute(); S.integ.ensure(); } else if (S.files.length) c.compute(); },
    wake: a=>{ if (a.type === 'integ' || S.files.length) S.live.get(a.id).compute(true); },
  };
}
registerModule('gc', createGc);
