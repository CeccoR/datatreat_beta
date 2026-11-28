import { fmtNum, csvLine, includedOf, linspace, movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, fileLine, guardNumberInputs, esc, registerModule, fixed, keeper, objId, exactKey } from './utils.js';
import { Plot } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, isObj, num, ownKey, without, cardList, finitePairs } from './modkit.js';
import { plotWrap, swatchLegend, viewOf, setView, chipRow, toggleChip, valueBars } from './modcharts.js';
import { snavHtml, snav } from './snav.js';
import * as M from './tauc-model.js';
import * as H from './tauc-html.js';

/* =========================================================
   TAUC MODULE

   MADE PER TAB (v518): createTauc is the module's factory (utils.js registerModule), each
   open DRS tab that is awake an instance of its own, made of its copy of index.html's
   section (root) and a layer (the kinds' menu). Its elements are found in root, a card's
   in its card and a Results section's in it, never in the page: its ids are the page's
   only while it is on show. Its registries go by its key, the tab's id (moduleKit). It
   draws only on show: hidden (a state read out for its CSVs, a tab restored while another
   is on show) it draws nothing, and its redraw draws all as it is shown; a tab shown again
   with nothing changed and at the same width draws nothing (its draw key). It has no job
   that runs on while hidden. utils.js registerModule says how a module is made so.

   SPLIT (v556): what the analyses work out, and what the plots and CSVs are made of, in
   tauc-model.js (plain functions, tested in Node); the cards' words and markup in
   tauc-html.js; here the page: the instance's state (S, below), its kit and deck, each
   card's panel (its fields, plot and lines), the Results' plots and charts, the history.
   Each is a function at module level of the instance S (and of a card's panel), not a
   closure inside createTauc: what a listener holds is what it is handed.
========================================================= */
// utils.js's and modkit.js's helpers the model takes (tauc-model.js U), and what the
// markup takes (tauc-html.js u).
const U = { movingAverage, gradientArr, maxArr, minArr, fitLinear, tinv, linspace, fmtNum, csvLine, wideCsv, isObj, num, ownKey, without, finitePairs };
const HU = { esc, plotWrap, snavHtml };
const CARD_INFO = cardInfo(true, true), INFO = { tauc: H.taucInfo(CARD_INFO), urbach: H.urbachInfo(CARD_INFO) };
const cardInfoOf = t => INFO[t];

/* A file's spectrum, which nothing changes once read: fixed (db.js), the same arrays in a
   tab's states and its parked state (and in every tab of the file's bytes: its reading is
   kept by them, tauc-model.js readingOf). */
const fixedSpectrum = f =>{ fixed(f.wl); fixed(f.FR); return f; };
/* What an analysis works out of a spectrum, kept by its F(R) (utils.js keeper: while a
   state, a tab asleep or a history holds the spectrum), each under all it is made from: a
   card's curve as read and smoothed (its kind, the wavelengths, the exponent and the
   smoothing's points) and its derivative (and its points), every fit of a sample and what the card makes of
   them (fitsKept: its kind, its parameters, its lines, and an Urbach card's reference
   Tauc card's own key for the sample), and the Results' reflectance and log F(R). A tab
   woken, an undo, a redraw, the Results and the CSVs take them as made (to v517 every
   redraw made every fit again, three times a sample where an Urbach card read its
   reference). A fit moved by a line dragged
   is made, not kept, till the line is let go. */
const curveKept = keeper('drs-curve', 8), slopeKept = keeper('drs-slope'), fitsKept = keeper('drs-fits', 8),
  reflKept = keeper('drs-reflectance', 1), logKept = keeper('drs-log', 1);

/* =========================================================
   THE INSTANCE
   A DRS tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }) is its
   state S, which every function below takes:
     root, $(id)          its section, an element of it by id; shown(): whether on show
     stale, drawnAt       hidden, nothing is drawn (utils.js registerModule): drawable(S)
                          says whether to draw, and when not marks the instance to be
                          drawn whole as it is shown (stale); drawnAt, the width it was last
                          drawn whole at, its draw key (redrawTab)
     kit, allFiles, files the module (modkit.js): every file loaded, in list order, {name,
                          label, wl[], FR[], warn, read, head, left, hv[]} (each on its own
                          native axis), and the included ones, which the analysis sees,
                          `files`, with which every per-sample list the cards keep is
                          aligned; in the file list, the note right of each label, how the
                          file was read, %R or F(R) (tauc-html.js readNote); the alerts
                          under the drop zone, among them the points left out (to check)
                          and how files of no standard format were read (tauc-model.js
                          fileNotes; each file's until its box's ×: modkit.js notes);
                          every card in the history
     currIndex            the sample every analysis card shows
     sampleNext           the sample a tab woken or reloaded showed: its next restore shows
                          it (showNext)
     resPlot0, resPlotR, resPlotLog   the Results' top plots (created once)
     deck, live           the cards (cards.js): the records, in card order, and their cards;
                          id → { panel, res, resPlots, seen }
     quiet                while set, a settling panel leaves the Results alone: whoever set
                          it redraws them once, rather than once per card (quietly)
     refsMoved            the Urbach cards whose reference a change of the list moved, from
                          the deck's `before` to its `changed` (none kept after: to v555 the
                          last list stayed, closed cards' records with it)
     resList              the Results' list of the cards' sections
========================================================= */
const drawable = S => S.shown() || !(S.stale = true);
const quietly = (S, fn)=>{ const was = S.quiet; S.quiet = true; try { fn(); } finally { S.quiet = was; } };

function createTauc({ key, root, layer, shown }){
  const S = {
    root, shown, $: id => root.querySelector('#' + id), stale: false, drawnAt: '',
    kit: null, allFiles: null, files: null, currIndex: 0, sampleNext: null,
    resPlot0: null, resPlotR: null, resPlotLog: null, deck: null, live: new Map(), quiet: false, refsMoved: [], resList: null,
  };
  S.kit = moduleKit('tauc', kitHooks(S, key, layer));
  S.allFiles = S.kit.all; S.files = S.kit.files;
  S.kit.dropText((text, bytes)=> M.readingOf(bytes, text), had => filesDropped(S, had));
  S.resList = S.$('taucResList');
  S.resList.addEventListener('click', e=> chipClicked(S, e));
  S.deck = S.kit.deck(deckHooks(S));
  // A new project starts with one Tauc card.
  S.deck.start(['tauc']);

  /* ---- The instance (tabs.js) ----
     Its tab, hidden, keeps its plots until it sleeps: they are all it could let go and draw
     again, 0.6 MB of heap for 10 spectra and two cards, and drawing them again takes 0.25 s
     (the analyses made again for every sample; measured at v518). */
  return {
    // Let go (its tab closed or put to sleep; a state read out for its CSVs): the deck's
    // menu and its listeners. Its section and layer are the shell's to take out.
    destroy(){ S.kit.destroy(); },
    /* What it shows beside its state (tabs.js, utils.js shownOf: kept as its tab sleeps and
       in its record): the sample every card shows, by its file's name and its place among
       the included; none, the first. To v517 a tab shown again or reloaded showed the
       first: the sample is no part of the state, so that stepping it is no step of the
       history and no change unsaved (as in v517). */
    shows(){ return S.currIndex > 0 && S.files[S.currIndex] ? { sample: S.currIndex, name: S.files[S.currIndex].name } : null; },
    // (shown by its next restore: a wake's, a reload's)
    showNext(v){ S.sampleNext = isObj(v) ? v : null; },
  };
}

/* ---- The module's kit (modkit.js) ---- */
function kitHooks(S, key, layer){
  return {
    root: S.root, key, layer,
    // (E_g's chart's chips: the view alone, a step but no change unsaved; utils.js VIEW_KEYS. An
    // Urbach card's choice, urbSel, is no more (v536): a project's own is read as nothing.)
    view: ['egSel', 'urbSel'],
    note: f => H.readNote(f, HU),
    notes: ()=> fileNotes(S),
    slots: ()=> slots(S),
    /* The cards stay on the sample they showed when another is removed, moved, left out or
       taken in (`files` holds the ones included before); the one on show removed or left
       out, on the one now in its place (the last, it was the last: setupAnalysis). To v494
       a removal or a move kept the index, and the cards showed another sample. */
    listed: op =>{ if (op !== 'palette' && op !== 'clear') stayOn(S, S.files[S.currIndex]); },
    refresh: ()=> afterFilesChange(S),
    // A label changed: the cards' captions and plots name the sample anew, as the Results do
    // (to v494 the caption kept the old label until the sample was stepped).
    redraw: what =>{ if (what === 'label') quietly(S, ()=> livePanels(S).forEach(p=>{ if (p.hasPlot()) p.update(true); })); renderResView(S); },
    cleared: ()=>{ livePanels(S).forEach(p=> p.clear()); eachKeptState(S, s=>{ s.per = []; s.sharedVlines = {}; }); },
    snapshot: ()=> snapshotOf(S),
    // A file as a restore takes it (tauc-model.js restoredFile), its spectrum fixed and its
    // energies made from its wavelengths.
    file: f =>{ const g = M.restoredFile(U, f); return g && M.withHv(fixedSpectrum(g)); },
    // The notes are the restored files' own, shown again.
    restore: (s, gone)=> restoreState(S, s, gone),
    redrawTab: ()=> redrawTab(S),
    csv: ()=> exportTaucZip(S),
  };
}
/* What the reading of the files said under the drop zone (modkit.js notes): the points left
   out (a warning to check) and how files of no standard format were read (an info), a line a
   file, worked out from the files there are (tauc-model.js fileNotes; to v566 one warning,
   "Verify how these files were read:"); the files a project opened plotted from the spectrum
   it holds, not from their bytes (a warning, U8: heldNote). Each file's until its box's ×
   (v572: to v571 the box's until the next drop, undo or restore). */
const fileNotes = S => [...['check', 'read'].flatMap(what=> S.allFiles.map(f=> [f, M.fileNotes(f)[what]]).filter(([, n])=> n.length)
  .map(([f, n])=> ({ what, line: esc(fileLine(f.name, n.join('; '))), files: [f] }))),
  ...S.allFiles.map(f=> [f, M.heldNote(f)]).filter(([, n])=> n).map(([f, n])=> ({ what: 'opened', line: esc(fileLine(f.name, n)), files: [f] }))];
/* ---- Undo/redo (kit.snapshot): every analysis card, its kind, name, fold, reference,
   and the line positions and parameters of both its kinds, beside the files' records
   (their spectra shared by reference). ---- */
function snapshotOf(S){
  return { analyses: cards(S).map(a=>{
    const states = {};
    Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s) states[k] = M.clone(s); });
    states[a.type] = panelOf(S, a).snapshot();
    return { ...S.deck.saved(a), ref: a.ref, refAuto: a.refAuto, egSel: a.egSel.slice(), states };
  }) };
}
function restoreState(S, s, gone){
  // (a wake's or a reload's: the sample its tab showed, by its file's name, else its place)
  const next = S.sampleNext;
  if (next){ const k = S.files.findIndex(f=> f.name === next.name); S.currIndex = k >= 0 ? k : num(next.sample, 0, Number.isInteger); S.sampleNext = null; }
  /* (a card whose state is a new card's: the one made for a project with no cards, one an
     older version saved with no lines and no flag, as an Urbach card whose lines were common,
     to v568: its lines suggested on its files as a card added's are, the Tauc cards first,
     the Urbach ones placed on their regions; v587: to v586 the one made alone, the others the
     default lines) */
  const list = cardList(s.analyses, M.KINDS);
  loadAnalyses(S, list || [{ id: 1, type: 'tauc' }], gone);
  if (S.files.length) ['tauc', 'urbach'].forEach(t=> cards(S).filter(a=> a.type === t && panelOf(S, a).fresh).forEach(a=> panelOf(S, a).autoSuggestAll()));
}
// A card of a kind there is no more (the debug defect band, taken out) is left out
// (deck.load), as are the settings a card kept for one (readAnalysis). A card kept
// has its panel restored in place.
const loadAnalyses = (S, list, gone)=> S.deck.load(list, s=> M.readAnalysis(U, s, gone), a=> panelOf(S, a).restore(a.states[a.type] || {}));
/* Re-fit at the current size, keeping the zoom; a card not drawn while its tab was not
   on show drawn now. Nothing changed since it was all drawn (nothing left undrawn while
   hidden, the same width): nothing to draw, a tab shown again as it was left. */
function redrawTab(S){
  const at = String(S.root.clientWidth);
  if (!S.stale && at === S.drawnAt) return;
  S.stale = false; S.drawnAt = at;
  if (!S.files.length) return;
  S.deck.fitNames();
  quietly(S, ()=> cards(S).forEach(a=>{ const P = panelOf(S, a); if (P && !isFolded(S, a)){ if (P.hasPlot()) P.update(true); else { P.writeStoreToInputs(); P.initPlot(); } } }));
  renderResView(S);
}

/* =========================================================
   ANALYSIS PANEL
   One card: the current sample's curve against hν, the interval lines that pick
   the regions to fit, the parameters beside it and what the fits give. Built from
   one recipe for every kind of analysis — Tauc on [F(R)hν]^a with a Tauc region
   and a baseline, Urbach on ln F(R) with one region — which the spec passed in
   describes (tauc-model.js TAUC, URBACH, and the page's part: taucSpec, urbachSpec).
   Each card keeps its own parameters, lines and all/one mode (P, tauc-model.js); its
   elements are its prefix plus the same suffixes (an1Svg, an2Svg, ...). A card
   folded out of sight (`hidden`) is not drawn: it is brought up to date when it
   is unfolded.
   Its plot's state is V: the spec, $ (its elements, found in its card, `card`, whether
   or not the card is in the page), the plot, `vlines` (the active interval lines: points
   at the current sample's set), `dragging` (true while an interval line is being
   dragged), the frame its drag's redraw waits for (`throttle`), the sample the plot last
   drew (`shown`) and the sample selector (`nav`).
========================================================= */
function makePanel(S, spec, card){
  const P = { mode: 'shared', shared: { ...spec.defaults }, sharedVlines: {}, per: [], suggested: false };
  const V = { spec, $: id => card.querySelector('#' + spec.prefix + id), plot: null, vlines: {}, dragging: false, throttle: null, shown: -1, nav: null };
  const curves = (i, p)=> curvesOf(S, spec, i, p);
  P.curve = k => curveOf(S, spec, k, P.params(k));
  P.params = i => M.paramsOf(spec, P, i);
  P.vlinesFor = i => M.vlinesFor(U, spec, P, S.files, i);
  // Every fit of sample k, and what the spec makes of them (kept: fitsKept, under keyOf;
  // made, not kept, while a line is dragged).
  P.keyOf = k =>{
    const p = P.params(k), vl = P.vlinesFor(k);
    return exactKey([spec.kind, objId(S.files[k].wl), spec.keys.map(x=> p[x]), spec.lineKeys.map(x=> vl[x]), spec.refKey ? spec.refKey(k) : null]);
  };
  P.analyze = k => analyze(S, P, V, k);
  P.autoSuggestAll = ()=> M.autoSuggestAll(U, spec, P, S.files, curves);
  P.suggestAt = i => M.suggestAt(U, spec, P, S.files, i, curves);
  // Push the current sample's stored params into the input fields
  P.writeStoreToInputs = ()=>{
    const p = P.params(S.currIndex);
    for (const k of spec.keys) V.$(M.FIELD[k]).value = p[k];
    if (V.$('NExp')) V.$('NExp').textContent = spec.fmtA(p.a);
  };
  P.syncModeButton = ()=>{ const c = V.$('ModeAll'); if (c) c.textContent = P.mode==='shared' ? 'all' : 'one'; };
  P.initPlot = ()=> initPlot(S, P, V);
  P.hasPlot = ()=> !!V.plot;
  P.shownIndex = ()=> V.shown;
  P.update = preserveView => drawPanel(S, P, V, preserveView);
  // Per-sample slots follow the file list (added, removed, moved, left out: see slots()).
  P.clear = ()=>{ P.per = []; P.sharedVlines = {}; };
  P.fit = ()=> M.fitPer(P, S.files);
  P.snapshot = ()=> M.panelSnapshot(P);
  // (fresh: the state put back a new card's, tauc-model.js restorePanel: restoreState suggests its lines)
  P.restore = s0 =>{ P.fresh = M.restorePanel(U, spec, P, s0, S.files); P.syncModeButton(); };
  wirePanel(S, P, V);
  return P;
}
// The curve and the derivatives the panel works from, for sample i (kept: curveKept,
// slopeKept; the exponent is no Urbach curve's, its parameters none).
function curveOf(S, spec, i, p){
  const f = S.files[i], hv = f.hv;
  return curveKept(f.FR, exactKey([spec.kind, objId(f.wl), p.a, p.N]), ()=>{
    const Yraw = f.FR.map((v,k)=> spec.curve(v, hv[k], p));
    return { Yraw, Ys: M.smoothY(U, Yraw, p.N) };
  });
}
function curvesOf(S, spec, i, p){
  const f = S.files[i], hv = f.hv, { Yraw, Ys } = curveOf(S, spec, i, p);
  const dYs = slopeKept(f.FR, exactKey([spec.kind, objId(f.wl), p.a, p.N, p.N2]), ()=> M.slopeOf(U, Ys, hv, p.N2));   // Y'
  return { hv, Yraw, Ys, dYs };
}
function analyze(S, P, V, k){
  const spec = V.spec;
  const fit = ()=>{
    const p = P.params(k), vl = P.vlinesFor(k), c = curveOf(S, spec, k, p), hv = S.files[k].hv;
    const fits = M.fitsOf(U, spec, p, vl, c, hv);
    return { ...spec.results(fits, p, k, vl), fits };
  };
  return V.dragging ? fit() : fitsKept(S.files[k].FR, P.keyOf(k), fit);
}

/* ---- The panel's fields, mode, sample and Suggest ---- */
function wirePanel(S, P, V){
  const { spec, $ } = V;
  // Param updates apply on confirm (blur / Enter), not while typing. The exponent is
  // a <select>, so its change already is a deliberate choice; the numeric fields are
  // guarded (invalid input shakes + reverts) by guardNumberInputs, and their change
  // fires only once a valid value is committed. Changing the exponent rescales the
  // y-axis, so it does a full reset; the smoothing/window fields keep the zoom.
  spec.keys.forEach(k=> listenField(S, P, V, k, $(M.FIELD[k])));
  // Single all/one toggle (tauc-model.js switchMode).
  $('ModeAll').addEventListener('click', ()=> modeToggled(S, P, V));
  $('Prev').onclick = ()=>{ if (S.files.length) showSample(S, (S.currIndex-1+S.files.length)%S.files.length); };
  $('Next').onclick = ()=>{ if (S.files.length) showSample(S, (S.currIndex+1)%S.files.length); };
  // (its list: any sample, straight)
  V.nav = snav($('Prev').closest('.snav'), { count: ()=> S.files.length, index: ()=> S.currIndex, label: i=> S.files[i].label, go: i=> showSample(S, i) });
  // Re-propose interval-line positions on demand, for every sample.
  $('Suggest').onclick = ()=>{
    if (!S.files.length) return;
    P.autoSuggestAll();
    P.update(); S.kit.commit();
  };
}
function listenField(S, P, V, k, el){
  el.addEventListener('change', ()=> fieldChanged(S, P, V, k, el));
}
function fieldChanged(S, P, V, k, el){
  const { spec, $ } = V;
  // Read the input fields into the active store (shared, or the current sample): the
  // edit routed to shared or this sample's slot
  M.storeValues(P, S.currIndex, M.fieldValues(spec.keys, x=> $(M.FIELD[x]).value));
  if (k === 'a' && $('NExp')) $('NExp').textContent = spec.fmtA(parseFloat(el.value));
  // A setting that reshapes the curve (`suggestOn`) places the lines again where it
  // applies: for every sample in all mode, for the one on show in one mode.
  if (spec.suggestOn && spec.suggestOn.includes(k) && S.files.length){
    if (P.mode === 'per') P.suggestAt(S.currIndex);
    else P.autoSuggestAll();
  }
  if (V.plot) P.update(k !== 'a');
  if (spec.onParams) spec.onParams();
  if (S.files.length) S.kit.commit();
}
function modeToggled(S, P, V){
  M.switchMode(U, V.spec, P, S.files, S.currIndex);
  P.syncModeButton();
  P.writeStoreToInputs();
  if (V.spec.onParams) V.spec.onParams();
  if (S.files.length){ if (V.plot) P.update(); S.kit.commit(); }
}

/* ---- The panel's plot ---- */
// (a card folded, or its tab not on show: not drawn, brought up to date as it is shown)
const panelOff = (S, spec)=> (spec.hidden && spec.hidden()) || !drawable(S);
function initPlot(S, P, V){
  const { spec, $ } = V;
  if (panelOff(S, spec)){ V.plot = null; return; }
  const plot = V.plot = new Plot($('Svg'), {xlabel:'hν (eV)', ylabelSvg: spec.yLabel(P.params(S.currIndex)), xTickStep:0.5, noYTickLabels:true});
  plot.attachTools(plot.svg.closest('.plot-wrap'));
  // A spec whose lines are each sample's own has no common set to start.
  if (!spec.ownLines && !isFinite(P.sharedVlines.v1)){
    const [lo, hi] = M.unionHv(U, S.files);
    P.sharedVlines = spec.defaultLines(lo, hi - lo);
  }
  P.update();
}
/* The sample on show drawn: its curve (drawCurve), each window's fit and what the card
   says of it (drawFits), what the spec adds, the lines to drag (drawLines); then, the
   lines at rest, what follows a change (the spec's onSettled: the Results, the Urbach
   cards read against a Tauc one). */
function drawPanel(S, P, V, preserveView){
  const { spec, $ } = V;
  if (!V.plot || !S.files.length || panelOff(S, spec)) return;
  V.shown = S.currIndex;
  V.vlines = P.vlinesFor(S.currIndex);   // point at the current sample's interval lines
  const p = P.params(S.currIndex);
  const c = curvesOf(S, spec, S.currIndex, p);
  V.nav.update();
  const nm = drawCurve(S, P, V, c, p, preserveView);
  const res = P.analyze(S.currIndex);
  $('Alert').innerHTML = drawFits(V, c, p, res, nm) ? H.TOO_SMALL : '';
  if (spec.extra) spec.extra(V.plot, res, c.hv, nm);
  spec.show($, res);
  drawLines(S, P, V);
  if (!V.dragging && spec.onSettled) spec.onSettled();   // skip the heavy summaries mid-drag
}
// The plot's range, axes and bands, and the curve as read, smoothed and its derivative
// (tauc-model.js curveTraces); the zoom kept (`preserveView`) across the redraw, the full
// range the "home" reset target. → the sample's label, which names its traces.
function drawCurve(S, P, V, c, p, preserveView){
  const { spec } = V, plot = V.plot, hv = c.hv;
  const prev = preserveView ? viewOf(plot) : null;
  const [yLo, yHi] = M.curveRange(U, spec, c.Yraw);
  plot.setRange(minArr(hv), maxArr(hv), yLo, yHi);
  setView(plot, prev, S.files[S.currIndex].name);
  plot.clearData();
  plot.ylabelSvg = spec.yLabel(p) + ' (a. u.)';
  plot.drawAxes();
  if (spec.bands) spec.bands(S.currIndex).forEach(b=> plot.vband(b.x0, b.x1, b.color, b.opacity));
  // Named for the figure composer: this plot has no legend, so without these the
  // traces would reach it as "Series 1..n". Keyed by role, not by sample: the plot
  // shows one sample at a time, and a trace keeps its looks from one to the next.
  const nm = S.files[S.currIndex].label;
  M.curveTraces(U, spec, c).forEach(t=>
    plot.line(hv, t.ys, t.color, t.width, undefined, { label: `${nm} ${t.name}`, key: t.key }));
  return nm;
}
// Each window's NRMSE and R², and its fit drawn (solid in its window, dashed beyond).
// → whether a window had too few points between its lines.
function drawFits(V, c, p, res, nm){
  const { spec, $ } = V, plot = V.plot, hv = c.hv;
  let tooSmall = false;
  spec.windows.forEach((w, wi)=>{
    const reg = M.windowFit(w, V.vlines, hv, c.Ys, p, res.fits[wi]);
    $(w.stats[0]).textContent = M.statText(reg, 'NRMSE');
    $(w.stats[1]).textContent = M.statText(reg, 'R2');
    if (!reg){ tooSmall = true; return; }
    if (reg.bestIdx.length){
      const L = M.fitLines(U, reg, hv);
      plot.line(L.xb, L.yb, w.color, 2.2, undefined, { label: `${nm} ${w.name}`, key: w.key });
      plot.line(L.xe, L.ye, w.color, 1, '5,4', { label: `${nm} ${w.name}, extended`, key: w.key + ' line' });
    }
  });
  return tooSmall;
}
// The interval lines, each draggable. While dragging a line: live-update only the
// interactive plot (throttledUpdate); the summary plots refresh once, on release.
// onDrag sets dragging, onRelease clears it. (Their handlers hold the panel, not the
// redraw that made them: to v555 each kept the curves and fits of the last redraw.)
function drawLines(S, P, V){
  const plot = V.plot;
  V.spec.windows.forEach(w=>{
    plot.vline(V.vlines[w.lo], w.color, true, onDrag(P, V, w.lo), onRelease(S, P, V, w.lo));
    plot.vline(V.vlines[w.hi], w.color, true, onDrag(P, V, w.hi), onRelease(S, P, V, w.hi));
  });
}
const onDrag = (P, V, k)=> v=>{ V.vlines[k]=v; V.dragging=true; throttledUpdate(P, V); };
const onRelease = (S, P, V, k)=> v=>{ V.vlines[k]=v; V.dragging=false; P.update(true); S.kit.commit(); };
function throttledUpdate(P, V){
  if (V.throttle) return;
  V.throttle = requestAnimationFrame(()=>{ V.throttle=null; P.update(true); });
}

/* =========================================================
   ANALYSIS CARDS
   The workspace is a list of analysis cards, each a Tauc plot or an Urbach energy
   analysis, in the order the user put them; every card adds its pair of charts to
   the Results, in the same order. A card is an analysis record (tauc-model.js
   newFields) and a panel built on its own DOM. It keeps the settings of both kinds, so
   switching it back and forth loses nothing. An Urbach card is read against a Tauc one,
   its reference: by default the nearest Tauc card above it, or one chosen by hand, or
   none.
========================================================= */
const cards = S => S.deck ? S.deck.records : [];
const byId = (S, id)=> S.deck.byId(id);
const panelOf = (S, a)=> a && S.live.has(a.id) ? S.live.get(a.id).panel : null;
const refPanel = (S, a)=>{ const r = byId(S, a.ref); return r && r.type === 'tauc' ? panelOf(S, r) : null; };
const livePanels = S => cards(S).map(a=> panelOf(S, a)).filter(Boolean);
const isFolded = (S, a)=> S.deck.isFolded(a);

// A sample's Tauc linear region in eV: the window its Tauc fit settled on.
const taucWindow = (S, tp, i)=> tp ? M.taucWindow(tp.analyze(i).regs, S.files[i].hv) : null;

function taucSpec(S, a){
  return {
    ...M.TAUC,
    prefix: 'an' + a.id,
    yLabel: p => `[F(R)·hν]${H.sup(M.fmtA(p.a))}`,
    results: (f, p)=> ({ ...M.taucEg(U, f[0], f[1], p.M, p.M2), regs: f[0], regs2: f[1] }),
    show: ($, r)=>{ $('Eg').textContent = M.fmtE(r.Eg, r.EgErr, 'eV'); $('EgInt').textContent = M.fmtE(r.EgInt, r.EgIntErr, 'eV'); },
    hidden: ()=> isFolded(S, a),
    // The automatic name carries the exponent.
    onParams: ()=> S.deck.refreshNames(),
    // The Urbach cards read against this one follow its linear region once a change
    // settles (a line released, a parameter confirmed), not while a line is dragged.
    onSettled: ()=>{
      if (S.quiet) return;
      renderAnalysisRes(S, a);
      follow(S, a);
      followers(S, a).forEach(u=> refreshCard(S, u));
    },
  };
}
/* The Urbach tail with the reference Tauc card's baseline taken out (tauc-model.js
   subtracted). Null with no reference, or no baseline fit in it. */
function urbachSub(S, a, k, p, vl){
  const T = refPanel(S, a);
  if (!T || !S.files[k]) return null;
  const r = T.analyze(k).regs2, tp = T.params(k);
  return M.subtracted(U, r, tp.a, tp.M2, S.files[k], p, vl);
}
function urbachSpec(S, a){
  return {
    ...M.URBACH,
    prefix: 'an' + a.id,
    yLabel: ()=> 'ln[F(R)]',
    // Placed under the sample's Tauc linear region in the reference (tauc-model.js
    // urbachLines).
    suggest: i => M.urbachLines(U, taucWindow(S, refPanel(S, a), i), S.files[i].hv),
    results: (f, p, k, vl)=> ({ ...M.urbachEu(U, f[0], p.M), regs: f[0], sub: urbachSub(S, a, k, p, vl) }),
    // (the subtracted fit is made from the reference's for the sample: its key)
    refKey: k =>{ const T = refPanel(S, a); return T ? T.keyOf(k) : null; },
    extra: drawSubtracted,
    show: showUrbach,
    hidden: ()=> isFolded(S, a),
    onSettled: ()=>{ if (!S.quiet) renderAnalysisRes(S, a); },
    // The reference's linear region for the sample, shaded in the Tauc region's red
    // behind the curves: the tail is read against where the edge is, and below it.
    bands: i =>{
      const w = taucWindow(S, refPanel(S, a), i);
      return w ? [{ x0: w[0], x1: w[1], color: M.TAUC_COLORS.regs, opacity: 0.18 }] : [];
    },
  };
}
// The tail with the Tauc baseline taken out, on the same plot, drawn as the plain
// traces are but in colours of its own (URB_SUB_COLORS): its smoothed curve solid,
// its fit solid and thick in its window, dashed and thin beyond.
function drawSubtracted(plot, r, hv, nm){
  const sb = r.sub;
  if (!sb) return;
  plot.line(hv, sb.Ys, M.URB_SUB_COLORS.curve, 1.4, undefined, { label: `${nm} smoothed, subtracted`, key: 'smoothed subtracted' });
  const g = sb.regs;
  if (!g.bestIdx.length || !isFinite(g.slope)) return;
  const L = M.fitLines(U, g, hv);
  plot.line(L.xb, L.yb, M.URB_SUB_COLORS.fit, 2.2, undefined, { label: `${nm} Urbach region, subtracted`, key: 'regs subtracted' });
  plot.line(L.xe, L.ye, M.URB_SUB_COLORS.fit, 1, '5,4', { label: `${nm} Urbach region, subtracted, extended`, key: 'regs subtracted line' });
}
// What an Urbach card says of its fits: E_U, and the subtracted fit's NRMSE, R², E_U and
// the two parts of its error, or why there is none.
function showUrbach($, r){
  $('Eu').textContent = M.fmtE(r.Eu, r.EuErr, 'meV', 1, 1000);
  const sb = r.sub, g = sb && sb.regs;
  $('RMSE1s').textContent = M.statText(g, 'NRMSE');
  $('R21s').textContent = M.statText(g, 'R2');
  $('EuS').textContent = sb ? M.fmtE(sb.Eu, sb.EuErr, 'meV', 1, 1000) : '-';
  $('EuS').parentElement.title = M.subErrTitle(sb);
  $('LegSub').style.display = sb ? '' : 'none';
  $('LegSubFit').style.display = g && isFinite(g.slope) ? '' : 'none';
  if (sb && sb.blocked) $('Alert').insertAdjacentHTML('beforeend', H.blockedHtml(sb));
}

const SPECS = { tauc: taucSpec, urbach: urbachSpec };

// Every card shows the same sample, so stepping in one steps them all. The Results
// do not depend on which sample is on show.
function showSample(S, k){
  S.currIndex = k;
  quietly(S, ()=> livePanels(S).forEach(p=>{ p.writeStoreToInputs(); p.update(); }));
}

/* ---- Cards: the panel on each (the deck builds, folds and moves the cards) ---- */
function deckHooks(S){
  return {
    kinds: M.KINDS, info: cardInfoOf, body: a => H.cardBody(a, HU), make: M.newFields,
    build: (a, card, prev)=> buildPanel(S, a, card, prev), drop: a => dropPanel(S, a), autoName: a => autoName(S, a), named: a => named(S, a),
    afterNames: ()=> syncRefSelects(S),
    /* What follows a change to their list: the references first (an Urbach card's
       automatic name carries its reference's), then the names, then the Results in card
       order and the Urbach cards given a new reference placed on it. A state loaded keeps
       the references it has and moves no lines. */
    before: ()=>{ S.refsMoved = fixRefs(S); },
    changed: ()=>{ placeRes(S); const moved = S.refsMoved; S.refsMoved = []; moved.forEach(u=> syncRefView(S, u)); },
    loaded: ()=>{ S.refsMoved = []; placeRes(S); },
    added: a => added(S, a), switched: a => switched(S, a), wake: a => wake(S, a),
  };
}
// The card is in the page: the panel finds its elements there by id. Number fields are
// guarded before the panel listens to them, so an invalid entry never reaches it. On a
// kind switch (prev, the kind left) that kind's settings are kept for a switch back.
function buildPanel(S, a, card, prev){
  const was = S.live.get(a.id);
  if (prev && was) a.states[prev] = was.panel.snapshot();
  guardNumberInputs(card);
  const panel = makePanel(S, SPECS[a.type](S, a), card);
  // (a kind it has no settings of yet: a new card's, the defaults, fitted to the files)
  panel.restore(a.states[a.type] || {});
  S.live.set(a.id, { panel, res: was ? was.res : null, resPlots: was ? was.resPlots : null });
  const ref = card.querySelector('.an-ref');
  if (ref) listenRef(S, a, ref);
}
const listenRef = (S, a, ref)=> ref.addEventListener('change', ()=> chooseRef(S, a, ref.value));
function dropPanel(S, a){
  const e = S.live.get(a.id);
  if (!e) return;
  if (e.res) e.res.remove();
  S.live.delete(a.id);
}
// A card out of sight was not drawn: bring it up to date as it comes back, with
// the zoom it had if it is still on the same sample.
function wake(S, a){
  const P = panelOf(S, a);
  if (!S.files.length || !P) return;
  P.writeStoreToInputs();
  quietly(S, ()=> P.hasPlot() ? P.update(P.shownIndex() === S.currIndex) : P.initPlot());
}

/* ---- References and names ---- */
// Every Urbach card pointed at its reference (tauc-model.js fixRefs). Returns the cards
// whose reference changed.
const fixRefs = S => M.fixRefs(cards(S), id=> byId(S, id));
/* The Urbach region follows its reference: a sample whose Tauc linear region moves
   (a line released, parameters, Suggest, all/one) gets its Urbach lines placed on it
   again, and a new reference re-centres them all. Lines moved by hand stay until
   then. What each Tauc card's regions were is kept by file name, and taken afresh
   (`see`) whenever a state is loaded rather than edited, so loading moves nothing. */
const followers = (S, a)=> cards(S).filter(u=> u.type === 'urbach' && u.ref === a.id && S.live.has(u.id));
function regionsSeen(S, a){ const e = S.live.get(a.id); return e.seen || (e.seen = new Map()); }
const regionKey = (S, a, i)=>{ const w = taucWindow(S, panelOf(S, a), i); return w ? w.join() : ''; };
function see(S, a){
  if (a.type !== 'tauc' || !S.files.length) return;
  const seen = regionsSeen(S, a);
  S.files.forEach((f, i)=> seen.set(f.name, regionKey(S, a, i)));
}
// Re-centre the followers on the samples whose region moved.
function follow(S, a){
  const seen = regionsSeen(S, a), moved = [];
  S.files.forEach((f, i)=>{
    const k = regionKey(S, a, i), was = seen.get(f.name);
    seen.set(f.name, k);
    if (was !== undefined && was !== k && k) moved.push(i);
  });
  if (moved.length) followers(S, a).forEach(u=> moved.forEach(i=> panelOf(S, u).suggestAt(i)));
}
// A card's view and its Results, after something outside it changed its data.
function refreshCard(S, u){
  const P = panelOf(S, u);
  if (P.hasPlot() && !isFolded(S, u)) P.update(true);
  else renderAnalysisRes(S, u);
}
// An Urbach card given a new reference: placed on it (None leaves the lines be).
function syncRefView(S, u){
  if (!S.files.length) return;
  if (refPanel(S, u)) panelOf(S, u).autoSuggestAll();
  refreshCard(S, u);
}
// What follows any change to the list of cards: references, names, Results order.
function afterCardsChange(S){
  const changed = fixRefs(S);
  S.deck.refreshNames();
  placeRes(S);
  changed.forEach(u=> syncRefView(S, u));
}

function autoName(S, a){
  if (a.type === 'tauc'){
    const P = panelOf(S, a);
    if (!P) return 'Tauc';
    return M.taucName(S.files.length ? S.files.map((f, i)=> P.params(i).a) : [P.params(0).a]);
  }
  const r = byId(S, a.ref);
  return r ? `Urbach · ${r.name}` : 'Urbach';
}
// The downloads follow the card's name, and so does its section of the Results.
function named(S, a){
  const card = S.deck.cardOf(a), e = S.live.get(a.id);
  if (!card || !e) return;
  const n = fileSafe(a.name), t = a.type === 'tauc';
  nameDownloads(card.querySelector('.plot-wrap'), `${n} - sample.svg`, t ? `${n} - analysis_info.csv` : '');
  if (e.res && e.res.dataset.kind === a.type){
    e.res.querySelector('.res-an-title').textContent = a.name;
    const w = id => e.res.querySelector('#an' + a.id + id).closest('.plot-wrap');
    nameDownloads(w('R1'), `${n} - ${t ? 'Tauc' : 'Urbach'}_plot.svg`, `${n} - ${t ? 'tauc' : 'urbach'}_plot.csv`);
    nameDownloads(w('R2'), `${n} - ${t ? 'Eg' : 'Eu'}_bar_chart.svg`, `${n} - ${t ? 'Eg' : 'Eu'}.csv`);
    if (!t){
      nameDownloads(w('R3'), `${n} - Urbach_subtracted_plot.svg`, `${n} - urbach_plot.csv`);
      nameDownloads(w('R4'), `${n} - Eu_subtracted_bar_chart.svg`, `${n} - Eu.csv`);
    }
  }
}
function syncRefSelects(S){
  const taucs = cards(S).filter(a=> a.type === 'tauc');
  cards(S).forEach(u=>{
    if (u.type !== 'urbach' || !S.live.has(u.id)) return;
    const p = 'an' + u.id, card = S.deck.cardOf(u), sel = card.querySelector('#' + p + 'Ref');
    sel.replaceChildren(new Option('None', ''), ...taucs.map(t=> new Option(t.name, String(t.id))));
    sel.value = u.ref != null ? String(u.ref) : '';
    card.querySelector('#' + p + 'LegBand').style.display = refPanel(S, u) ? '' : 'none';
  });
}

/* ---- Adding, closing, switching, choosing the reference ---- */
// Bring a card's panel up to the files on show: inputs, plot, its Results.
function startPanel(S, a){
  const P = panelOf(S, a);
  P.fit(); P.writeStoreToInputs(); P.syncModeButton();
  quietly(S, ()=> P.initPlot());
  see(S, a);
  renderAnalysisRes(S, a);
}
// A card just added: placed on the files there are.
function added(S, a){
  if (S.files.length){ panelOf(S, a).autoSuggestAll(); startPanel(S, a); }
}
// A card turned into the other kind, with that kind's settings if it has had them;
// its first time as that kind, the lines are suggested.
function switched(S, a){
  if (S.files.length){ const P = panelOf(S, a); P.fit(); if (!P.suggested) P.autoSuggestAll(); startPanel(S, a); }
  // A card that becomes a Tauc one may become the reference of Urbach cards below it
  // (fixRefs): it had no lines yet when they were placed on it, so they are
  // placed again now that it has (its region, its baseline to subtract).
  if (S.files.length && a.type === 'tauc') followers(S, a).forEach(u=> syncRefView(S, u));
}
// A reference chosen by hand stays, wherever the cards are moved, while it is a Tauc card.
function chooseRef(S, a, v){
  a.refAuto = false;
  a.ref = v === '' ? null : +v;
  afterCardsChange(S);
  syncRefView(S, a);
  S.kit.commit();
}

// Per-sample lists follow the file list: the panels', and the ones each card keeps
// for the kind it is not showing.
function eachKeptState(S, fn){
  cards(S).forEach(a=> Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s) fn(s); }));
}
// The same lists, each named by its card and kind, for the file list to keep
// aligned with the included files. A file brought back in gets the parameters and
// lines it left with, in each card that was there then; in a card added since, it
// starts from the card's defaults, as a file uploaded into it does.
function slots(S){
  const out = [];
  cards(S).forEach(a=>{
    Object.entries(a.states).forEach(([k, s])=>{ if (k !== a.type && s && s.per) out.push({ key: a.id + ':' + k, arr: s.per, make: M.copyPer }); });
    const P = panelOf(S, a);
    if (P) out.push({ key: a.id + ':' + a.type, arr: P.per, make: M.copyPer });
  });
  return out;
}
// The cards stay on the sample they showed when another is removed, moved, left out or
// taken in (kit.listed).
function stayOn(S, f){ const k = includedOf(S.allFiles).indexOf(f); if (k >= 0) S.currIndex = k; }

/* ---- The files ---- */
function filesDropped(S, had){
  S.allFiles.slice(had).forEach(fixedSpectrum);
  afterFilesChange(S);
  // Once, when the first data lands: propose optimal interval-line positions. The
  // Tauc cards go first: the Urbach ones are placed on their regions.
  if (!had && S.files.length){
    quietly(S, ()=> ['tauc', 'urbach'].forEach(t=> cards(S).filter(a=> a.type === t).forEach(a=>{
      const P = panelOf(S, a); P.autoSuggestAll(); P.writeStoreToInputs(); P.update();
    })));
    cards(S).forEach(a=> see(S, a));
    S.deck.refreshNames();
    renderResView(S);
    S.kit.commit();
  }
}

const SHOWN = ['taucAnalyses','taucResults'];
function afterFilesChange(S){
  S.kit.showFiles();
  if (S.files.length) setupAnalysis(S);
  else { SHOWN.forEach(id=> S.$(id).style.display='none'); S.deck.refreshNames(); }
  S.kit.commit(); // baseline + file add/remove/reorder/palette
}

// Energy axis is hc/λ (tauc-model.js HC, hvOf) — each file stays on its own native grid.
function setupAnalysis(S){
  S.allFiles.forEach(M.withHv);
  if (S.currIndex >= S.files.length) S.currIndex = S.files.length-1;
  if (S.currIndex < 0) S.currIndex = 0;
  SHOWN.forEach(id=> S.$(id).style.display='block');
  // Every panel fitted to the files before any is drawn: an Urbach card's band is
  // read off its reference, which may sit below it.
  livePanels(S).forEach(p=> p.fit());
  quietly(S, ()=> livePanels(S).forEach(p=>{
    p.writeStoreToInputs();      // reflect the current sample's params in the inputs
    p.syncModeButton();
    p.initPlot();
  }));
  cards(S).forEach(a=> see(S, a));
  S.deck.refreshNames();
  renderResView(S);
  // (all drawn, on show: its draw key, the width it was drawn at; a card folded is drawn
  // as it is unfolded, deck wake)
  if (S.shown()){ S.stale = false; S.drawnAt = String(S.root.clientWidth); }
}

/* =========================================================
   RESULTS
   F(R) and R (%) against λ side by side, F(R) against hν on a log axis under them across
   the card (2φ : 1), then each card's pair of charts under its name, in card order. To
   v497 the top was a pair, F(R) against λ and the log plot.
========================================================= */
// A card's section of the Results, made for its kind (again, if the kind changed;
// tauc-html.js resHtml). Named before anything is drawn in it: the plots' CSV buttons
// are built from the names their download buttons carry.
function ensureRes(S, a){
  const e = S.live.get(a.id);
  if (e.res && e.res.dataset.kind === a.type) return e.res;
  if (e.res) e.res.remove();
  const sec = document.createElement('div');
  sec.className = 'res-an';
  sec.dataset.an = a.id;
  sec.dataset.kind = a.type;
  sec.innerHTML = H.resHtml(a, HU);
  e.res = sec;
  e.resPlots = null;
  placeRes(S);
  named(S, a);
  return sec;
}
const placeRes = S => cards(S).forEach(a=>{ const e = S.live.get(a.id); if (e && e.res) S.resList.appendChild(e.res); });

function renderResView(S){
  if (!S.files.length || !drawable(S)) return;
  // Plot 0: F(R) vs λ — reuse one Plot instance (create + attach tools once).
  if (!S.resPlot0){
    S.resPlot0 = new Plot(S.$('taucResSvg0'), {xlabel:'Wavelength (nm)', ylabel:'F(R) (a. u.)', xTickStep:50, noYTickLabels:true});
    S.resPlot0.attachTools(S.resPlot0.svg.closest('.plot-wrap'));
  }
  const plot0 = S.resPlot0; plot0.clearData();
  S.$('taucResLegend0').innerHTML = swatchLegend(S.files);
  let ymax0=-Infinity;
  S.files.forEach(f=>{ ymax0=Math.max(ymax0,maxArr(f.FR)); });
  const [wl0, wl1] = M.unionWl(U, S.files);
  plot0.setRange(wl0, wl1, 0, ymax0);
  plot0.drawAxes();
  S.files.forEach(f=> plot0.line(f.wl, f.FR, f.color, 1.3, undefined, { label: f.label, key: f.name }));
  renderReflView(S);
  renderLogView(S);
  cards(S).forEach(a=> renderAnalysisRes(S, a));
}
// R (%) against λ, every sample's, on 0–100 %, all R can be.
function renderReflView(S){
  if (!S.resPlotR){
    S.resPlotR = new Plot(S.$('taucResSvgR'), {xlabel:'Wavelength (nm)', ylabel:'R (%)', xTickStep:50});
    S.resPlotR.attachTools(S.resPlotR.svg.closest('.plot-wrap'));
  }
  const p = S.resPlotR; p.clearData();
  S.$('taucResLegendR').innerHTML = swatchLegend(S.files);
  const [wl0, wl1] = M.unionWl(U, S.files);
  p.setRange(wl0, wl1, 0, 100);
  p.drawAxes();
  S.files.forEach(f=> p.line(f.wl, reflKept(f.FR, '', ()=> f.FR.map(M.reflOf)), f.color, 1.3, undefined, { label: f.label, key: f.name }));
}
// F(R) against hν on a log y-axis: the absorption edge and the tail below it, over
// the decades they span, on the energy axis the analyses work on. The plot draws
// log10 F(R); a point with F(R) ≤ 0 has none and is left out.
function renderLogView(S){
  if (!S.resPlotLog){
    // A wider left margin than the default 55: powers of ten are wider tick labels
    // than numbers, and in an export (type ×1.6) they reached the axis title.
    S.resPlotLog = new Plot(S.$('taucResSvgLog'), {xlabel:'Energy (eV)', ylabel:'F(R) (a. u.)', xTickStep:0.5, yLog:true, margin:{l:66,r:20,t:15,b:40}});
    S.resPlotLog.attachTools(S.resPlotLog.svg.closest('.plot-wrap'));
  }
  const p = S.resPlotLog; p.clearData();
  S.$('taucResLegendLog').innerHTML = swatchLegend(S.files);
  const logs = S.files.map(f=> logKept(f.FR, '', ()=> M.log10Of(f.FR)));
  const [yLo, yHi] = M.logRange(logs), [hv0, hv1] = M.unionHv(U, S.files);
  p.setRange(hv0, hv1, yLo, yHi);
  p.drawAxes();
  // The composer takes F(R) itself and draws it on a log axis of its own, which can
  // then be switched off like any other.
  S.files.forEach((f,k)=> p.line(f.hv, logs[k], f.color, 1.3, undefined, { label: f.label, key: f.name, raw: { xs: f.hv, ys: f.FR } }));
}
// (an element of a card's section of the Results, found in it)
const resEl = (S, a, id)=> S.live.get(a.id).res.querySelector('#an' + a.id + id);
function renderAnalysisRes(S, a){
  if (!S.files.length || !S.live.has(a.id) || !drawable(S)) return;
  ensureRes(S, a);
  if (a.type === 'tauc') drawTaucRes(S, a); else drawUrbachRes(S, a);
}
// A plot of the section's (reused while the section lasts): R1, and an Urbach
// card's subtracted one, R3.
function resPlotOf(S, a, opts, which = 'R1'){
  const e = S.live.get(a.id), svg = resEl(S, a, which);
  e.resPlots = e.resPlots || {};
  if (!e.resPlots[which] || e.resPlots[which].svg !== svg){
    e.resPlots[which] = new Plot(svg, opts);
    e.resPlots[which].attachTools(svg.closest('.plot-wrap'));
  }
  return e.resPlots[which];
}

// A Tauc card's pair: every sample's Tauc curve with its two fits, and the gaps.
function drawTaucRes(S, a){
  const P = panelOf(S, a), $ = id => resEl(S, a, id), files = S.files;
  const fits = files.map((f,k)=> P.analyze(k));
  // Effective exponent per file, and the words it gives (tauc-model.js taucLabels).
  const L = M.taucLabels(files.map((f,k)=> P.params(k).a));

  const plot1 = resPlotOf(S, a, {xlabel:'Energy (eV)', xTickStep:0.5, noYTickLabels:true});
  plot1.clearData();
  plot1.ylabelSvg = `[F(R)·hν]${H.sup(L.aLabel)} (a. u.)`;
  $('RL1').innerHTML = swatchLegend(files);
  // (the card's own curves, kept: the same numbers)
  const Ys_all = files.map((f,k)=> P.curve(k).Ys);
  const ymax1 = Math.max(...Ys_all.map(maxArr));
  const [hv0, hv1] = M.unionHv(U, files);
  plot1.setRange(hv0, hv1, 0, ymax1);
  plot1.drawAxes();
  files.forEach((f,k)=>{
    plot1.line(f.hv, Ys_all[k], f.color, 1.1, undefined, { label: f.label, key: f.name });
    const r = fits[k];
    // regs fits the steep edge between the red lines (the Tauc region: its x-axis
    // intercept is Eg), regs2 the flat stretch between the magenta ones (the
    // baseline: where the two cross is Eg from the baseline).
    if (isFinite(r.regs.slope)){
      const xExt = linspace(hv0, hv1, 100);
      plot1.line(xExt, xExt.map(x=>r.regs.slope*x+r.regs.intercept), f.color, 1, '5,4',
                 { label: `${f.label} Tauc`, key: `${f.name}/regs line` });
    }
    if (isFinite(r.regs2.slope)){
      const xExt = linspace(hv0, hv1, 100);
      plot1.line(xExt, xExt.map(x=>r.regs2.slope*x+r.regs2.intercept), f.color, 1, '2,3',
                 { label: `${f.label} baseline`, key: `${f.name}/regs2 line` });
    }
  });

  // The Eg bar chart.
  $('BarTitle').textContent = L.title;
  // The two ways Eg is read, as GC's gases are: a chip each, never both off.
  $('EgSel').innerHTML = chipRow(M.EG_METHODS, a.egSel, { cls: 'plot-chip', data: m=> `data-eg="${m.key}"`, name: m=> m.name });
  const shown = M.egSeries(fits, a.egSel);
  $('RA').innerHTML = shown.map(m=> H.negWarnHtml(files, m.vals, `E<sub>g</sub> (${m.label})`, HU)).join('');
  resBars(S, a, 'R2', shown, $('EgSel'), `${L.egLabel ? L.egLabel+' ' : ''}Band Gap E<tspan baseline-shift="sub" font-size="8">g</tspan> (eV)`, 3);
}

// An Urbach card's Results: every sample's ln F(R) with its Urbach fit, drawn as the
// Tauc plot is, plain on one plot and with the Tauc baseline subtracted on another
// beside it, each with its own axes; and under each its E_U, as the gaps are.
function drawUrbachRes(S, a){
  const P = panelOf(S, a), $ = id => resEl(S, a, id), files = S.files;
  const fits = files.map((f,k)=> P.analyze(k));
  // (the card's own curves, kept: the same numbers)
  const curves = files.map((f,k)=> ({
    p: P.curve(k).Ys,
    s: fits[k].sub ? fits[k].sub.Ys : null,
  }));
  const series = M.euSeries(fits);
  // Why the subtracted series may be missing, said under its plot.
  const why = M.noSubWhy(!!refPanel(S, a), fits);

  const [hv0, hv1] = M.unionHv(U, files), xExt = linspace(hv0, hv1, 100);
  // One of the two plots: each sample's curve, and its Urbach fit dashed over the whole
  // span; its range tauc-model.js urbachRange's.
  const drawOne = (which, key, ylabelSvg, fitOf, tag, legendId)=>{
    const plot = resPlotOf(S, a, {xlabel:'Energy (eV)', ylabelSvg, xTickStep:0.5, noYTickLabels:true}, which);
    plot.clearData();
    const [yLo, yHi] = M.urbachRange(curves.map(c=> c[key]), files.map(f=> f.hv), key === 'p', k=> Math.min(P.vlinesFor(k).v1, P.vlinesFor(k).v2));
    plot.setRange(hv0, hv1, yLo, yHi);
    plot.drawAxes();
    files.forEach((f,k)=>{
      const ys = curves[k][key];
      if (!ys) return;
      plot.line(f.hv, ys, f.color, 1.1, undefined, { label: f.label, key: f.name + tag });
      const r = fitOf(k);
      if (r && isFinite(r.slope))
        plot.line(xExt, xExt.map(x=>r.slope*x+r.intercept), f.color, 1, '5,4',
                  { label: `${f.label} Urbach`, key: `${f.name}${tag}/regs line` });
    });
    $(legendId).innerHTML = swatchLegend(files);
  };
  drawOne('R1', 'p', 'ln[F(R)] (a. u.)', k=> fits[k].regs, '', 'RL1');
  drawOne('R3', 's', 'ln[F(R) − F<tspan baseline-shift="sub" font-size="8">b</tspan>] (a. u.)', k=> fits[k].sub && fits[k].sub.regs, '/sub', 'RL3');
  // With no subtracted curve at all, the subtracted plot says why it is empty.
  const noSub = !curves.some(c=> c.s && c.s.some(isFinite));
  $('RS').textContent = noSub ? why + '.' : ''; $('RS').hidden = !noSub;

  // The E_U bar charts, in meV as the Urbach card shows it: the plain one under the
  // plain plot, the subtracted one under the subtracted plot.
  const yLab = 'Urbach Energy E<tspan baseline-shift="sub" font-size="8">U</tspan> (meV)';
  series.forEach(m=>{
    const pl = m.key === 'p';
    $(pl ? 'RA' : 'RA4').innerHTML = H.negWarnHtml(files, m.vals, pl ? 'E<sub>U</sub>' : 'E<sub>U</sub> (subtracted)', HU);
    resBars(S, a, pl ? 'R2' : 'R4', [m], null, yLab, 1);
  });
}
/* A chip of a Tauc card's chart clicked (E_g's two): its card's choice switched, a click
   never leaving the chart with nothing (toggleChip; what is on show is what the chips
   show), each card its own. */
function chipClicked(S, e){
  const b = e.target.closest('.plot-chip[data-eg]'), sec = b && b.closest('.res-an');
  const a = sec && byId(S, +sec.dataset.an);
  if (!a || b.disabled) return;
  const on = [...b.parentElement.querySelectorAll('.plot-chip.is-on')].map(x=> x.dataset.eg);
  const sel = toggleChip(M.EG_METHODS.map(m=> m.key), a.egSel, on, b.dataset.eg);
  if (!sel) return;
  a.egSel = sel;
  renderAnalysisRes(S, a);
  S.kit.commit();
}

/* A card's chart of a value per sample ± its error (`which`: R2, an Urbach card's R4 too), as GC's mean rates are drawn
   (modcharts.js valueBars): `shown` the series side by side in each sample's slot,
   {name, color, vals[], errs[]}, `chips` the plot's chip row, which the value labels
   keep clear of. Only positive values are drawn; with none the chart is hidden. */
function resBars(S, a, which, shown, chips, yLabel, digits){
  const svg = resEl(S, a, which), wrap = svg.closest('.plot-wrap'), legend = resEl(S, a, 'RL' + which.slice(1));
  svg.style.display = wrap.style.display = '';
  if (valueBars(svg, { cats: S.files, series: shown, ok: v=> isFinite(v) && v > 0, digits, yLabel, chips, legend })) return;
  svg.style.display = wrap.style.display = 'none';
  legend.innerHTML = '';
}
// The reflectance once, then each card's files, prefixed with its name (tauc-model.js
// spectraCsvs, taucCsvs, urbachCsvs).
function exportTaucZip(S){
  if (!S.files.length) return [];
  const entries = M.spectraCsvs(U, S.files);
  cards(S).forEach(a=>{
    const P = panelOf(S, a);
    if (!P) return;
    const n = fileSafe(a.name), fits = S.files.map((f,k)=> P.analyze(k));
    if (a.type === 'tauc') entries.push(...M.taucCsvs(U, n, S.files, k=> P.params(k), fits));
    else entries.push(...M.urbachCsvs(U, n, S.files, k=> P.params(k), fits));
  });
  return entries;
}

registerModule('tauc', createTauc);
