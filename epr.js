import { fmtNum, fmtData, setupDropzone, maxArr, minArr, NORM_OPTIONS, normOf, fileAlertHtml, fileLine, NOT_READ, bytesOf, nextColor, guardNumericInput, esc, registerModule, keeper, objId, exactKey } from './utils.js';
import { boxSmooth, widthText } from './smooth.js';
import { Plot } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, num, numStr, finitePairs, cardList } from './modkit.js';
import { plotWrap, swatchLegend, viewOf, setView, viewKey } from './modcharts.js';
import { decodeText } from './textdata.js';
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

   SPLIT (v563): what it works out that touches no page (a pair read, a drop's files
   grouped, a spectrum kept, a file and a card as a project holds them, the smoothing's
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

/* A pair read, .DTA and .DSC (epr-model.js): the spectrum, or { error } saying why it
   cannot be, or { unread } the file whose bytes cannot be read (gone from the disk: utils.js
   NOT_READ). Its .DSC first, its .DTA only once that gives a field axis. */
async function processPair(stem, dtaFile, dscFile){
  const dscBytes = await bytesOf(dscFile);
  if (!dscBytes) return { unread: dscFile, other: dtaFile };
  const p = M.parseDsc(decodeText(dscBytes));
  const bad = M.dscError(p);
  if (bad) return { error: bad };
  const dta = await bytesOf(dtaFile);
  if (!dta) return { unread: dtaFile, other: dscFile };
  return M.spectrumOf(stem, p, { name: dscFile.name, bytes: dscBytes }, dta.buffer, dtaFile.name);
}

/* =========================================================
   THE INSTANCE: its state S, which every function below takes:
     key, root, layer, shown, $  its context (utils.js makeInstance: shown() whether its tab
                          is on show) and its elements by id, in root
     stale, drawnAt       hidden, nothing is drawn: drawable(S) says whether to draw, and
                          when not marks the instance to be drawn whole as it is shown
                          (stale); drawnAt, the width it was last drawn whole at, its draw
                          key (redrawTab)
     kit, allFiles, files the module (modkit.js): every file loaded, in list order, {name,
                          label, b[], a[]}, and the included ones, which the analysis sees;
                          the alerts under the drop zone; the cards' settings in the history
     deck                 the cards (cards.js), each its own normalisation and smoothing of
                          the same spectra, stacked on its own plot
     readDismissed        how the files were read (epr-model.js readNotes), its alert
                          dismissed, until the next drop, restore or Remove all
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
  return { key, root, layer, shown, $, stale: false, drawnAt: '', kit: null, allFiles: null, files: null, deck: null, readDismissed: false };
}
// Hidden, nothing is drawn (utils.js registerModule): whether to draw, and when not the
// instance marked to be drawn whole as it is shown.
const drawable = S => S.shown() || !(S.stale = true);
// What the module kit is given (modkit.js o).
function kitHooks(S){
  return {
    root: S.root, key: S.key, layer: S.layer,
    // (how the files were read: worked out from those there are, until its ×, which a drop,
    // a restore or Remove all brings back)
    alerts: p =>{ S.$('eprAlerts').innerHTML = p.invalid + fileAlertHtml('read', S.readDismissed ? [] : M.readNotes(S.allFiles).map(esc), 'epr-dismiss-read') + p.upload; },
    dismiss: { read: ()=>{ S.readDismissed = true; } },
    cleared: ()=>{ S.readDismissed = false; },
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
  S.readDismissed = false;
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

/* ---- Files dropped: complete pairs load; a lone half is not (nothing is held back
   waiting for its partner), said with the files not loaded, each with why (utils.js FILE
   ALERTS: v567, to v566 a box of its own, and a pair refused named by its stem); a file
   whose bytes cannot be read (gone from the disk) said, the other pairs loaded. ---- */
async function onDrop(S, fileList){
  const existingStems = new Set(S.allFiles.map(f=>f.name));
  const { groups, invalid, already: alreadyLoaded } = M.groupsOf(fileList, existingStems);
  const bad = invalid.map(n=> fileLine(n, 'not a .DTA or .DSC file'));
  for (const [stem, pair] of Object.entries(groups)){
    if (pair.dta && pair.dsc){
      let result;
      try { result = await processPair(stem, pair.dta, pair.dsc); } catch(e){ result = { error: `could not be read: ${e && e.message || e}` }; }
      if (result.unread) bad.push(fileLine(result.unread.name, NOT_READ), fileLine(result.other.name, `its ${M.extOf(result.unread.name)} could not be read`));
      else if (!result.error){ result.color = nextColor(S.allFiles); S.kit.add(M.keepSpectrum(result)); existingStems.add(stem); }
      else bad.push(fileLine(`${pair.dta.name} + ${pair.dsc.name}`, result.error));
    } else {
      const f = pair.dta || pair.dsc;
      bad.push(fileLine(f.name, `its ${pair.dta ? '.DSC' : '.DTA'} is missing: drop the two together`));
    }
  }
  S.kit.said(bad, alreadyLoaded);
  S.readDismissed = false;
  afterFilesChange(S);
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
