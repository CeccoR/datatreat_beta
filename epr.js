import { fmtNum, fmtData, setupDropzone, maxArr, minArr, NORM_OPTIONS, normOf, fileLine, NOT_READ, bytesOf, nextColor, guardNumericInput, esc, registerModule, keeper, objId, exactKey } from './utils.js';
import { autoPair } from './filelist-model.js';
import { boxSmooth, widthText } from './smooth.js';
import { Plot } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, num, numStr, finitePairs, cardList } from './modkit.js';
import { plotWrap, swatchLegend, viewOf, setView, viewKey } from './modcharts.js';
import * as M from './epr-model.js';
import * as H from './epr-html.js';

/* =========================================================
   EPR MODULE

   MADE PER TAB (v518): createEpr is the module's factory (utils.js registerModule), each
   open EPR tab that is awake an instance of its own, made of its copy of index.html's
   section (root) and a layer (the kinds' menu). Its elements are found in root, a card's
   in its card, never in the page: its ids are the page's only while it is on show. Its
   registries go by its key, the tab's id (moduleKit). It draws only on show: hidden (a
   state read out for its CSVs) it draws nothing, and its redraw draws all as it is shown;
   a tab shown again with nothing changed and at the same width draws nothing (its draw
   key). It has no job that runs on while hidden. utils.js registerModule says how a module
   is made so.

   SPLIT (v563): what it works out that touches no page (a pair read, the list's rows and
   their records, a spectrum kept, a file and a card as a project holds them, the smoothing's
   width and points, the stacking, the plot's options, the CSV's columns) in
   epr-model.js, its words and markup in epr-html.js, both tested in Node. Here the page:
   the instance's state (S), the drop, the cards, their fields and plots. Each is a
   function at module level of S, not a closure inside createEpr (to v562 one of 245
   lines): what a listener holds is what it is handed.
========================================================= */
// utils.js's and modkit.js's helpers the model takes (epr-model.js U), and what the markup
// takes (epr-html.js u).
const U = { num, numStr, normOf, finitePairs, cardList, maxArr, minArr, fmtNum, fmtData };
const HU = { plotWrap, NORM_OPTIONS };
const EPR_INFO = H.eprInfo(cardInfo(false, false));
const P = H.P;

/* A spectrum smoothed over a card's width, kept by its intensities (utils.js keeper: while
   a state, a tab asleep or a history holds the spectrum) under its field and the width: a
   tab woken, an undo, a redraw and the CSVs take it as made (to v517 every drawing made it
   twice a spectrum, and the CSVs again). */
const smoothKept = keeper('epr-smoothed', 8);
const smoothedOf = (f, w)=> smoothKept(f.a, exactKey([objId(f.b), w]), ()=> boxSmooth(f.b, f.a, w));

/* =========================================================
   THE INSTANCE: its state S, which every function below takes:
     key, root, layer, shown, $  its context (utils.js makeInstance: shown() whether its tab
                          is on show) and its elements by id, in root
     stale, drawnAt       hidden, nothing is drawn: drawable(S) says whether to draw, and
                          when not marks the instance to be drawn whole as it is shown
                          (stale); drawnAt, the width it was last drawn whole at, its draw
                          key (redrawTab)
     kit, allFiles, files the module (modkit.js): every row of the list, in list order, {name,
                          label, color, rawFiles (its files: a .DTA and its .DSC, or a half
                          waiting for its partner), and its spectrum b[], a[] where its files
                          read as one}, and the included spectra, which the analysis sees; the
                          alerts under the drop zone; the cards' settings in the history
     deck                 the cards (cards.js), each its own normalisation and smoothing of
                          the same spectra, stacked on its own plot
========================================================= */
// An EPR tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createEpr(ctx){
  const S = makeState(ctx);
  S.kit = moduleKit('epr', kitHooks(S));
  S.allFiles = S.kit.all; S.files = S.kit.files;
  setupDropzone(S.$('eprDropzone'), S.$('eprFiles'), fileList => onDrop(S, fileList));
  S.deck = S.kit.deck(deckHooks(S));
  // A new project starts with one card.
  S.deck.start(['spectra']);
  return apiOf(S);
}
function makeState({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  return { key, root, layer, shown, $, stale: false, drawnAt: '', kit: null, allFiles: null, files: null, deck: null };
}
// Hidden, nothing is drawn (utils.js registerModule): whether to draw, and when not the
// instance marked to be drawn whole as it is shown.
const drawable = S => S.shown() || !(S.stale = true);
// What the module kit is given (modkit.js o).
function kitHooks(S){
  return {
    root: S.root, key: S.key, layer: S.layer,
    // (what is said of the rows not plotted, to check, epr-model.js rowNote, v581; how the files
    // were read, readNote: worked out from those there are, each file's until its box's ×, v572;
    // to v571 the box's until a drop, a restore or Remove all)
    notes: ()=> notesOf(S),
    // Only a row whose files read as a spectrum is plotted (v581: a half waits in the list).
    sample: M.isSpectrum,
    // A row is a .DTA and its .DSC, both in FILE, each with a grip of its own (v581, as GC's).
    pairs: { files: M.rowFiles, parts: M.partsOf, regroup: rows => regroup(S, rows) },
    refresh: ()=> afterFilesChange(S),
    // A label or a colour changed: the zoom kept, the data being the same.
    redraw: ()=> updateEpr(S, true),
    snapshot: ()=> M.stateOf(S.deck.records, S.deck.saved),
    // A file as a restore takes it (epr-model.js fileIn).
    file: f => M.fileIn(U, f),
    restore: s => restore(S, s),
    redrawTab: ()=> redrawTab(S),
    // One CSV a card, named after it.
    csv: ()=> S.files.length ? S.deck.records.map(a=> ({ name: `${fileSafe(a.name)} - epr_spectra.csv`, text: cardCsv(S, a) })) : [],
  };
}
// What the deck is given (cards.js o).
function deckHooks(S){
  return {
    kinds: M.KINDS, info: ()=> EPR_INFO, body: a => H.cardBody(a, HU), make: ()=> ({ ...M.DEF }),
    build: (a, card)=> buildCard(S, a, card), drop: ()=>{}, autoName: ()=> 'Spectra', named: a => named(S, a),
    added: a=>{ if (S.files.length) drawCard(S, a); },
    wake: a=>{ if (S.files.length) drawCard(S, a, true); },
  };
}
/* ---- The instance (tabs.js) ----
   An EPR tab, hidden, holds little beyond its sleeping form (0.4 MB of heap for 10
   spectra); its plots let go gave back 0.1 MB, their tool buttons still holding their
   Plots (measured at v518). */
function apiOf(S){
  return {
    // Let go (its tab closed or put to sleep; a state read out for its CSVs): the deck's
    // menu and its listeners. Its section and layer are the shell's to take out.
    destroy(){ S.kit.destroy(); },
  };
}
// A state put back: its cards (a card kept, its fields showing its record).
function restore(S, s){
  return S.deck.load(M.cardsIn(U, s), c => M.readCard(U, S.files, c), a=>{
    const card = S.deck.cardOf(a);
    card.querySelector('#' + P(a) + 'Norm').value = a.norm;
    showW(S, a, card);
  });
}
/* Re-fit at the current size, keeping the zoom. Nothing changed since it was all drawn
   (nothing left undrawn while hidden, the same width): nothing to draw, a tab shown
   again as it was left. */
function redrawTab(S){
  const at = String(S.root.clientWidth);
  if (!S.stale && at === S.drawnAt) return;
  S.stale = false; S.drawnAt = at;
  if (S.files.length){ S.deck.fitNames(); updateEpr(S, true); }
}

/* ---- Files dropped (v581, as GC's): each .DTA and .DSC loaded, paired by their names with
   each other or with a half waiting in the list (filelist-model.js autoPair, a Map of their
   stems: a file named after an object's own property, constructor or __proto__, pairs as any
   other, bug 23); a row that reads as a spectrum plotted, any other waiting in the list, said
   (epr-model.js rowNote; to v580 a lone half and a pair that could not be read were refused).
   Not loaded, each with why (utils.js FILE ALERTS): a file of another kind, one whose bytes
   cannot be read (gone from the disk); one of a name loaded (any case) is said as loaded
   already. ---- */
async function onDrop(S, fileList){
  const names = new Set(S.allFiles.flatMap(r=> M.rowFiles(r).map(f=> f.name.toLowerCase()))), bad = [], dup = [], got = [];
  for (const f of fileList){
    if (!M.kindOf(f.name)){ bad.push(fileLine(f.name, 'not a .DTA or .DSC file')); continue; }
    if (names.has(f.name.toLowerCase())){ dup.push(f.name); continue; }
    names.add(f.name.toLowerCase());
    const bytes = await bytesOf(f);
    if (bytes) got.push({ name: f.name, bytes }); else bad.push(fileLine(f.name, NOT_READ));
  }
  if (got.length) regroup(S, autoPair(S.allFiles.map(M.rowFiles), got, M.sideOf));
  S.kit.said(bad, dup);
  afterFilesChange(S);
}
// The list's records made of its rows (epr-model.js regroup), a new row its colour after the others'.
const regroup = (S, rows)=> M.regroup(S.allFiles, rows, nextColor);
// What the reading of the rows said: those not plotted, to check; the spectra read on the field measured.
function notesOf(S){
  const out = [];
  S.allFiles.forEach(r=>{ const n = M.rowNote(r); if (n) out.push({ what: 'check', key: n.key, line: esc(n.line), files: [r] }); });
  S.allFiles.forEach(r=>{ const t = M.readNote(r); if (t) out.push({ what: 'read', line: esc(t), files: [r] }); });
  return out;
}
function afterFilesChange(S){
  S.kit.showFiles();
  S.$('eprAnalyses').style.display = S.files.length ? 'block' : 'none';
  // (each card's points at the spectra's steps, folded or not)
  S.deck.records.forEach(a=> syncPts(S, a));
  updateEpr(S);
  S.kit.commit();
}

/* ---- The analysis cards (cards.js) ----
   The card's fields show its record; a change is taken on confirm, not while typing
   (the normalisation a <select>, its change a deliberate pick; the smoothing a guarded
   decimal field, whose change only fires with a value from 0; its points follow what is
   typed). */
function buildCard(S, a, card){
  const norm = card.querySelector('#' + P(a) + 'Norm'), sm = card.querySelector('#' + P(a) + 'Smooth');
  guardNumericInput(sm, { min: 0, def: M.DEF.smoothW });
  norm.value = a.norm; showW(S, a, card);
  norm.addEventListener('change', ()=> onNorm(S, a, norm));
  sm.addEventListener('change', ()=> onSmooth(S, a, card, sm));
  // (and as it is left: a value refused is set back with no input event)
  ['input', 'blur'].forEach(t=> sm.addEventListener(t, ()=> syncPts(S, a, card)));
}
function onNorm(S, a, norm){
  a.norm = normOf(norm.value);
  if (S.files.length){ drawCard(S, a); S.kit.commit(); }
}
function onSmooth(S, a, card, sm){
  if (sm.value !== sm._shown) a.smoothW = M.widthIn(sm.value);
  showW(S, a, card);
  if (S.files.length){ drawCard(S, a); S.kit.commit(); }
}
/* The width in its field to 4 significant digits, kept exact in the record (one converted
   from points stays as it was: only a value typed replaces it), and its points. */
function showW(S, a, card = S.deck.cardOf(a)){
  const sm = card && card.querySelector('#' + P(a) + 'Smooth');
  if (!sm) return;
  sm.value = sm._shown = widthText(a.smoothW);
  syncPts(S, a, card);
}
/* What the width typed spans in points of the card's spectra, at each one's step, after
   it in its field (epr-model.js ptsOf). */
function syncPts(S, a, card = S.deck.cardOf(a)){
  const sm = card && card.querySelector('#' + P(a) + 'Smooth'), out = card && card.querySelector('#' + P(a) + 'SmoothPts');
  if (!sm || !out) return;
  const { t, tip } = M.ptsOf(S.files, M.widthOf(sm.value, sm._shown, a.smoothW));
  if (out.textContent !== t) out.textContent = t;
  if (out.title !== tip) out.title = tip;
}
function named(S, a){
  const card = S.deck.cardOf(a);
  if (card) nameDownloads(card.querySelector('.plot-wrap'), `${fileSafe(a.name)} - EPR.svg`, `${fileSafe(a.name)} - epr_spectra.csv`);
}

// Every card unfolded is drawn; a folded one is drawn as it comes back (wake). (all drawn,
// on show: its draw key, the width it was drawn at)
function updateEpr(S, preserveView){
  if (!S.files.length) return;
  S.deck.records.forEach(a=>{ if (!S.deck.isFolded(a)) drawCard(S, a, preserveView); });
  if (S.shown()){ S.stale = false; S.drawnAt = String(S.root.clientWidth); }
}
// (its tab not on show: not drawn, drawn whole as it is shown)
function drawCard(S, a, preserveView){
  if (!drawable(S)) return;
  const files = S.files, card = S.deck.cardOf(a), svg = card.querySelector('#' + P(a) + 'Svg');
  const norm = a.norm;
  const Y = files.map(f=> smoothedOf(f, a.smoothW));
  // A fresh Plot is built each render, so grab the outgoing view first to keep the
  // current zoom on a resize / tab-switch redraw instead of snapping to full range.
  // (only on the same spectra and the same full range: modcharts setView)
  const prev = preserveView ? viewOf(svg._plot) : null;
  const plot = new Plot(svg, M.plotOpts(files.every(f=> f.rescaled !== false)));
  plot.attachTools(plot.svg.closest('.plot-wrap'));
  card.querySelector('#' + P(a) + 'Legend').innerHTML = swatchLegend(files);
  const allB = files.flatMap(f=>f.b), st = M.stackOf(U, Y, norm);
  plot.setRange(minArr(allB), maxArr(allB), st.lo, st.hi);
  setView(plot, prev, viewKey(files));
  plot.drawAxes();
  // The composer gets the CSV's own "Smoothed_" column (smoothedOut): the same numbers
  // as the export, without the stacking offset.
  const out = M.smoothedOut(U, files.map(f=> smoothedOf(f, a.smoothW)), norm);
  st.Y.forEach((y,k)=> plot.line(files[k].b, y, files[k].color, 1.3, undefined,
    { raw: { xs: files[k].b, ys: out[k] }, label: files[k].label, key: files[k].name }));
}
function cardCsv(S, a){
  const out = M.smoothedOut(U, S.files.map(f=> smoothedOf(f, a.smoothW)), a.norm);
  return wideCsv(M.csvCols(U, S.files, out, a));
}

registerModule('epr', createEpr);
