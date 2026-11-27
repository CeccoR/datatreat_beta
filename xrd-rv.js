/* =========================================================
   XRPD — the Rietveld card (page side).
   The phases come from CIFs (the standard's LaB6 is built in); the refinement runs in
   a module worker (xrd-rietveld.worker.js) on xrd-rietveld.js, and its result is kept
   per pattern, by file name, so moving, leaving out or reloading files never puts it
   on another pattern. The curves drawn from it are kept by the pattern (curvesKept), made
   again from the refined parameters only where what they are made from changed.
   The calculations, which touch no page, are xrd-rv-model.js's; the words and markup that
   need no page, xrd-rv-html.js's.
   SPLIT (v559): up to v558 one closure (createRietveld, 1204 lines). The card's instance is
   now a state object S (cardState) that the functions at module level take: its run (refine,
   press, cancel), its views (draw: the pattern, the Results' stacked plot and sizes, the
   crystallites' solids, the peak widths and Williamson–Hall, the results, the phases and the
   structure), its settings window, its CIFs in, its buttons; the state's own rules
   (xrd-rv-model.js: what a run takes and says, the keys the views are kept under, the state
   saved and put back) and its markup (xrd-rv-html.js) beside it.
========================================================= */
import { fmtData, csvLine, X_SVG, DL_SVG as DL_ICON, downloadBytes, flashFieldInvalid, settings, fitCsvIcons, maxArr, barNames, barChipYmax, NORM_OPTIONS, normOf, confirmModal, keeper, boxHtml, quickPress, runProgress, wireRowMenu, ctlMenu } from './utils.js';
import { fileSafe } from './cards.js';
import { Plot } from './plot.js';
import { PLOT_DL_ICON, CSV_ICON } from './modcharts.js';
import { snavHtml, snav } from './snav.js';
import { fitSettings } from './xrd-rietveld.js';
import { shapeView } from './xrd-shape3d.js';
import { cellView } from './xrd-cell3d.js';
import * as M from './xrd-rv-model.js';
import * as H from './xrd-rv-html.js';
import { lanes } from './xrd-rv-pool.js';
import { own, setOwn } from './db.js';

// The card's instructions and the standard's window's (xrd-rv-html.js; xrd.js takes them here).
export { RV_INFO, RV_STD_INFO } from './xrd-rv-html.js';

// The instrumental standard: NIST SRM 660c LaB6, Pm-3m, a = 4.156826 Å at 22.5 °C
// (certificate). B on 6f (x, ½, ½), x = 0.1992 (Eliseev et al., Acta Cryst. C42 (1986)
// 1263). The displacement parameters are typical values, the start of one ΔB refined with
// the profile (the standard's settings' default, stdSettings): held, a B 0.1 Å² off had moved X by 10 esd and the FWHM at 80°
// by 0.7 % (0.2 Å²: 21 esd, 1.4 %), the profile taking up the intensities' fall with
// angle; refined, the profile comes out within 1 esd whatever the B, its esds 10 % wider.
const LAB6_CIF = `data_LaB6_SRM660c
_cell_length_a 4.156826
_cell_length_b 4.156826
_cell_length_c 4.156826
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_chemical_formula_sum 'La1 B6'
_cell_formula_units_Z 1
loop_
_symmetry_equiv_pos_as_xyz
'x, y, z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_B_iso_or_equiv
La1 La 0 0 0 0.25
B1 B 0.1992 0.5 0.5 0.35
B2 B -0.1992 0.5 0.5 0.35
B3 B 0.5 0.1992 0.5 0.35
B4 B 0.5 -0.1992 0.5 0.35
B5 B 0.5 0.5 0.1992 0.35
B6 B 0.5 0.5 -0.1992 0.35
`;
// The name its CIF is downloaded under (the list's download button: cifFile).
const LAB6_FILE = 'LaB6_NIST-SRM-660c.cif';
// A plot's size on the page, in a view's key (xrd-rv-model.js idOf's note): 0 out of sight,
// so one drawn hidden is drawn again when shown.
const sizeOf = el => { if (!el) return '-'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
// (a plot at the range it was drawn with: not zoomed nor panned)
const atOrigin = P => P.xmin === P._origXmin && P.xmax === P._origXmax && P.ymin === P._origYmin && P.ymax === P._origYmax;
/* A refined pattern's curves (the calculated, its background and the reflections' ticks),
   its difference (observed less calculated, under the plot) and its net pattern (observed
   less background, the Results' stacked plot), kept by its intensities (utils.js keeper:
   while a state, a tab asleep or a history holds the pattern) under all they are made
   from (xrd-rv-model.js curveKey): the 2θ and variance factors (the same arrays: fixed,
   xrd.js), the instrument, all the curves take from the result (exactly: a NaN is not a
   null, nor −0 0; a result read back by an undo is a copy, the same), each phase's structure
   (its prep, one object for one CIF text: prepOf; the standard's LaB6, one for the page) and
   colour, and the role. A tab woken, an undo, a redraw or the CSVs take them as drawn
   before: to v517 a card kept the last pattern drawn and the Results' last 64, and a tab
   shown again made all again. */
const curvesKept = keeper('xrd-curves'), diffKept = keeper('xrd-difference'), netKept = keeper('xrd-net');
// (and a pattern not refined, its phases' reflections where its cells put them: tickRows,
// by the 2θ, the instrument and the phases)
const ticksKept = keeper('xrd-ticks');
// The standard's LaB6 as read, one for every card (its curves' key holds it by identity).
let lab6Prep = null;
const LAB6_PREP = ()=> lab6Prep || (lab6Prep = Object.assign(M.prepPhase(LAB6_CIF, 'LaB6 (NIST SRM 660c)'),
  // (written in P1 here only to be short: nothing to report)
  { name: 'LaB₆ (NIST SRM 660c)', notes: [] }));
// The page's helpers the model and the markup take (xrd-rv-model.js stackOf, restoreInto;
// xrd-rv-html.js cardHtml, resHtml).
const U = { maxArr, normOf };
const HU = { snavHtml, PLOT_DL_ICON, CSV_ICON };

/* host: {
     files()        the patterns refined (the included samples; the standard's one)
     allFiles()     every file loaded, for the results of those left out
     idx(), step(d) the sample on show, shared by the cards, and stepping it (samples)
     commit()       a step of the undo history
     irf()          the standard's instrumental profile (samples)
     openStd()      open the standard's window (samples)
     stdLoaded()    a standard's file is loaded (samples)
     refineStd(tell) refine the standard, as its window's Refine (samples, "Refine the
                    standard first"): { own, done }, done resolving to { ok, why }; tell(frac,
                    text) its progress. Its run going on already, that one (own false)
     stopStd(commit) stop the standard's run (samples; commit as cancel's)
     stdRun()       the standard's run, { frac }, or null (samples: Instrumental standard…
                    shows it)
     blocked()      why Refine cannot run now (the standard refining, for the samples; a
                    sample, for the standard), or ''
     onBusy()       a run started or ended here: the others' buttons follow
     hold()         the history held from the state on show (a run's start, a sample's wait
                    for the standard's run): its mark (utils.js UndoStack.hold)
     release(h, wrote, quiet)  the mark closed, with the patterns the run wrote (file name →
                    result) for the history's states (quiet: a commit follows)
     onProgress()   the run here went on (the standard: the samples' Instrumental standard…)
     changed()      the standard's result changed (the standard): the samples' notes follow
     hidden()       the card is folded: nothing is drawn
     unseen()       its module's instance is not on show (a tab left, a run going on in
                    it): nothing is drawn at all, the tab's redraw draws it as it is shown
     placed()       the card is still its deck's, not closed (samples): one waiting for the
                    standard's run starts its own as that ends
     layer          where its settings window goes (the instance's layer)
   }
   o: { prefix, standard } */
export function createRietveld(host, root, o){
  const S = cardState(host, root, o);
  // (the Results' size chart: by sample or by peak)
  if (S.res) S.res.addEventListener('click', e=> sizeByClicked(S, e), { signal: S.ac.signal });
  S.stdTitle = S.std ? '' : S.$('Std').title;
  makeSettings(S);
  wireSettings(S);
  wireCifs(S);
  wirePhaseList(S);
  wireButtons(S);
  return cardApi(S);
}

/* ---- The instance (S) ----
   Its markup in root (and the standard's window's: the same, with one pattern and one phase
   chosen) and, a sample card's, its section of the Results (res: the refined patterns
   stacked, and the crystallite sizes, as the Scherrer card's); its elements found in the
   card or its section whether or not they are in the page ($). */
function cardState(host, root, o){
  const p = o.prefix, std = !!o.standard;
  root.innerHTML = H.cardHtml(p, std, HU);
  const res = std ? null : document.createElement('div');
  if (res){ res.className = 'res-an'; res.innerHTML = H.resHtml(p, HU); }
  return {
    host, root, p, std, res, $: id => root.querySelector('#' + p + id) || (res && res.querySelector('#' + p + id)),
    phases: [],            // [{ id, cif (text), file, color, prep, on, dep (the settings: MODES), off (file name → true: not refined there) }]
    nextId: 1,
    results: {},           // file name → { params, esd, stats, stages, free, held, detected, shapes, isoParams, at, … }
    startFrom: 'cif', hold: M.HOLD_DEFAULT.slice(),   // where Refine starts (HOLDS)
    fit: {},               // the Refinement settings changed from their defaults (FITS)
    busy: false, cur: null, curP: null,   // the run going on (refine's) and its promise
    waiting: null,         // a sample's Refine waiting for the standard's run ("Refine the standard first")
    mark: null, wrote: null,              // the history held by the run or the wait (host.hold), and the patterns the run wrote (name → result)
    gen: 0,                // the states restored so far: a choice outlived by one is dropped
    plot: null, sel: null, // the pattern's plot; the phase whose structure is on show
    gone: false,           // destroyed: nothing is drawn
    csvPre: '',            // the downloads' names: the card's, then the file's
    // The listeners the card registers once (on its own elements, its section of the
    // Results, its settings window and, while that is open, the document) all come off
    // together when it is destroyed.
    ac: new AbortController(),
    // The standard's: the built-in LaB6, its own colour apart from the CIF phases'; the
    // phase its refinement uses (pick).
    lab6: { id: M.LAB6_ID, cif: LAB6_CIF, file: '', color: '#4cc9a0', ...M.stdSettings(), prep: LAB6_PREP(), off: {} }, pick: 0,
    nav: null,             // its pattern selector (snav.js; none on the standard's)
    // What each view was last drawn from (drawPlot, drawStacked, drawSizes, renderSolids,
    // renderWidths) and the markup each box was last given.
    plotKey: '', instrTxt: '', instrNotes: '', stackKey: '', stackPlot: null, stackLeg: '', sizeKey: '', sizeChips: '', sizeLeg: '', sizeNote: '',
    fitSetShown: null, resultsShown: null, phasesShown: null, cellInfoShown: null,
    // resNorm: the stacked patterns' normalisation (Settings…, Results), as the Scherrer card's.
    sizeBy: 'sample', resNorm: 'global',
    // The crystallites' solids in 3D, and how each was last turned (xrd-shape3d getView), by
    // sample and solid: coming back to a sample shows it as it was left.
    solidViews: [], solidsKey: '', solidTurns: new Map(),
    // The Williamson–Hall plot; the peak picked in the widths' table (a click; another click
    // lets it go), as the Scherrer card's: marked on the pattern and on the Williamson–Hall
    // plot until then, the one under the pointer beside it. Of one pattern: another pattern's
    // table has none.
    whPlot: null, pkSel: null, pkHov: null, widthsKey: '',
    // The structure's 3D cell, the key of what it shows, how it was turned as its tab slept or
    // the page went (showNext), the frame its square is checked at (fitSide).
    cellV: null, cellKeyShown: '', cellNext: null, sideRaf: 0,
    pressT: -Infinity, turnT: -Infinity,   // Refine's last press and turn (utils.js quickPress)
    stdTitle: '', stdShown: '',            // Instrumental standard…'s own title, and the run it shows
    // The settings window (makeSettings): its body as last built (its key: null, none; a
    // card with no phase builds one of key ''), a body being rebuilt, a Refinement entry not
    // taken (fitNote, its rule said under its row, fitNoteK: v571).
    setModal: null, setBody: null, setKey: null, rebuilding: false, fitNote: null, fitNoteK: null, fitsHere: null, modesHere: null, holdsHere: null, onSetKey: null,
  };
}
/* What xrd.js holds of the card. refresh: after any change to the files, the card follows
   them; results of files no longer loaded go. redraw: a label or a colour changed, a sample
   stepped to, the card unfolded, the tab on show again or resized, the standard refined:
   each view drawn again where what it shows changed (a table drawn out of sight with its
   plot, whose size is in its key). irf: the standard's profile for the samples (the
   standard's card). running: a run going on here (its own workers': not a wait for the
   standard's), ending it as Cancel does, and the buttons as the other cards' runs leave them
   (host.blocked). progress: the run going on here and how far it is, or null (the
   standard's card: its button on the samples' cards, syncStd). run: the standard refined
   for a sample ("Refine the standard first", host.refineStd). shows, showNext: what it shows
   beside its state (xrd-rv-model.js showsOf, nextInto). The phase on show is in its state
   too (sel: an undo goes back to its step's, a project saved reopens on it), but a click on
   its row is no change, and its record held the one before till the next (to v517 a reload
   showed it). csvEntries: every refined pattern's curves, one row per pattern and phase,
   the peak widths. cifs: its phases' CIFs, for the Scherrer cards' samples (v575). */
function cardApi(S){
  return {
    res: S.res,
    refresh(preserve){ refresh(S, preserve); },
    redraw(){ draw(S, true); },
    irf: ()=> ownIrf(S),
    running: ()=> S.busy,
    progress: ()=> S.busy && S.cur ? { frac: S.cur.frac } : null,
    syncStd: ()=> syncStd(S),
    cancel: commit => cancel(S, commit),
    sync: ()=> syncButtons(S),
    run: tell => runForSample(S, tell),
    destroy(){ destroy(S); },
    shows(){ return M.showsOf(S); },
    showNext(v){ M.nextInto(S, v); },
    snapshot(){ return M.snapshotOf(S); },
    restore(s, step){ restore(S, s, step); },
    csvEntries(pre){ return M.csvTables(pre || '', S.host.files(), S.results, { curves: (f, r)=> curvesOf(S, f, r), stale: (f, r)=> staleOf(S, f, r), std: S.std }, { data: fmtData, line: csvLine, decimal: settings.decimal }); },
    setName(n){ S.csvPre = n ? n + ' - ' : ''; nameFiles(S); },
    cifs: ()=> S.phases.map(q=> ({ file: q.file, cif: q.cif })),
  };
}
function refresh(S, preserve){
  const fs = S.host.files();
  if (!fs.length) closeSettings(S);
  M.keepLoaded(S.results, S.host.allFiles());
  draw(S, preserve);
  renderSettings(S);
}
/* The card closed (or turned into another kind, set aside then dropped): a run going on
   ends as the kind switch ends it (cancel(false): the card goes, its last state is the
   history's), nothing drawn after, the workers of its jobs terminated (the pool lets its
   idle ones go after a while, xrd-rv-pool.js). Up to v483 a card closed mid-run kept
   refining unseen, drew its 3D views on the detached card when it ended, and every card
   that had refined left its worker alive. */
function destroy(S){
  S.gone = true; cancel(S, false);
  closeSettings(S); S.setModal.remove(); if (S.cellV) S.cellV.destroy(); S.solidViews.forEach(({ view })=> view.destroy()); S.solidViews = []; S.ac.abort();
}
/* step: an undo or a redo. One while a run goes on here, or waits for the standard's
   (locked), keeps what the run takes as it starts (the phases with their settings and
   ticks, the standard's settings and choice, the start, the Refinement settings: their
   controls locked meanwhile, the states above the history's mark hold them alike) and the
   patterns it has written (wrote), over the state's results, whose others come in (a file
   brought back brings its own; a during-run state's part of the run's is the release's to
   write); what the views show (the phase on show, the Results' size by and normalisation)
   is the state's (xrd-rv-model.js restoreInto). The panel is not built again: its run, its
   progress, Cancel, the Settings read only, the rows locked (to v508 no step came while a
   run went on). A run going on goes on into the results restored. Nothing running, the last
   run's words go (they were about the state before; to v517 "Stopped…" showed on the next
   project the module's one instance held), and a choice still open is dropped (press). */
function restore(S, s, step){
  s = s || {};
  M.restoreInto(U, S, s, !!step && M.locked(S));
  S.gen++;
  if (!S.busy && !S.waiting) setStatus(S, '');
  syncButtons(S);
}
// The downloads named after the card, in the card and in its Results section.
function nameFiles(S){
  sizeNames(S);
  [S.root, S.res].filter(Boolean).forEach(el=>{
    el.querySelectorAll('[data-csv-base]').forEach(b=>{ b.dataset.csvNames = S.csvPre + b.dataset.csvBase; });
    el.querySelectorAll('.plot-dl-btn[data-dl-base]').forEach(b=> b.dataset.dlName = S.csvPre + b.dataset.dlBase);
    el.querySelectorAll('.plot-wrap').forEach(w=>{ const d = w.querySelector('.plot-dl-btn[data-csv-names]'), c = w.querySelector('.plot-csv-btn'); if (d && c) c.dataset.csvNames = d.dataset.csvNames; });
  });
}

// The pattern on show (the standard's its one file).
const curIdx = S => S.std ? 0 : Math.min(S.host.idx(), Math.max(0, S.host.files().length - 1));
const curFile = S => S.host.files()[curIdx(S)];
// ---- the workers: the page's pool's (xrd-rv-pool.js); a run's jobs, its lanes (run.lanes) ----
// The standard's card's own instrumental profile, from its file's result (irfOf).
function ownIrf(S){ return M.irfOf(S.host.files()[0], S.results); }
const irf = S => S.std ? ownIrf(S) : S.host.irf();
const staleOf = (S, f, r) => !S.std && !!r.irf && !M.sameIrf(r.irf, irf(S));

/* A run: the patterns on the pool's lanes (below), each result written whole once its
   pattern and those before it are done, into the results the card holds then (a module
   read out and in again meanwhile, as a saved project's CSV export from the Projects list
   does, puts back the same; the card set aside by it is taken up again, xrd.js), and only
   for a file still loaded. Cancel, a tab left (the tab manager's stop) or a kind switch
   ends it at once (cancel): it says so, the patterns done are kept (those done behind
   one under way written then), those under way are not, and nothing comes of their
   workers' answers after. Resolves to { ok, why }.
   It holds the history from its start (holdHist; a sample's from its wait for the
   standard's run, press): the steps taken meanwhile are undone and redone around it, and
   as it ends, however it ends, the patterns written go into the states saved meanwhile
   and, a step of their own, after the one it started from (releaseHist). Up to v508 the
   steps taken meanwhile could be neither undone nor redone until it ended, a banner
   saying so, and its results came in as a step at its end. */
async function refine(S, list, tell){
  if (S.busy) return { ok: false, why: 'a refinement is running' };
  // A batch takes one instrumental profile throughout: no sample refines while the
  // standard does, nor the standard while a sample does. (A wait for the standard's run
  // that comes to nothing lets the history go.)
  const why = S.host.blocked();
  if (why){ setStatus(S, why); releaseHist(S); return { ok: false, why }; }
  const todo = list.filter(f=> M.phasesFor(S, f).length);
  if (!todo.length){ const t = M.nothingText(S.std, list.length); setStatus(S, t); releaseHist(S); return { ok: false, why: t }; }
  // (the settings stay open if they are: read only until the run ends, syncSettings)
  S.busy = true; holdHist(S); syncButtons(S);
  const run = S.cur = M.runOf(S, S.std ? null : irf(S), todo.length, tell);
  S.host.onBusy();
  try {
    run.lanes = lanes(todo.length, laneHooks(S, run, todo));
    const { error } = await run.lanes.done;
    if (S.cur !== run) return { ok: false, why: 'stopped' };
    if (error) throw error;
    // (what the run chose for some patterns, an info: v571, X09)
    setStatus(S, M.runEndText(run), 'info');
    return { ok: true };
  } catch(e){
    if (S.cur !== run) return { ok: false, why: 'stopped' };
    // (an error in the status's place: v571, X07; to v570 "⚠ {message}", grey)
    setStatus(S, M.failText(e.message), 'bad');
    return { ok: false, why: e.message };
  } finally {
    if (S.cur === run) endRun(S, true);
  }
}
/* Its patterns on the pool's lanes (xrd-rv-pool.js lanes: several at once, up to the
   pool's cap shared with every run of every page), each payload built as its pattern is
   taken, in order; the results written in the patterns' order, each once those before it
   are, so that the results, the history's step and the file saved are a run of one lane's,
   key order included. An error stops the patterns not taken; those under way end and are
   written. (run.frac: how far the run is, for the standard's button on the samples' cards)
   Up to v517 one worker, the patterns one after the other. */
function laneHooks(S, run, todo){
  const lbl = k => todo[k].label, from = [];
  return {
    payload: k =>{
      const f = todo[k], pay = M.payloadFor(f, run, S.results, S.std), ph = pay.list;
      delete pay.list;
      from[k] = pay.opts.start ? ' from its last result' : '';
      return { pay, ctx: { f, ph } };
    },
    write: (k, res, ctx)=> written(S, run, res, ctx),
    progress: (frac, on, k, stage, what)=> progressed(S, run, { frac, on, k, stage, what, lbl, from }),
  };
}
function written(S, run, res, { f, ph }){
  // (a file taken away meanwhile: its result has no pattern to go with)
  if (!S.host.allFiles().some(g=> g.name === f.name)) return;
  // (by the file's name, its own key: a file named constructor or __proto__ too, v581)
  const rec = setOwn(S.results, f.name, M.resultRecord(res, ph, S.std, Date.now()));
  if (S.wrote) setOwn(S.wrote, f.name, rec);
  run.done++;
  // (by name: a module read out and in again gives the same files as new objects)
  if (f.name === (curFile(S) || {}).name) draw(S);
}
// (one pattern under way: as one lane says it, its stages; several: their names and how many
// are done)
function progressed(S, run, { frac, on, k, stage, what, lbl, from }){
  if (S.cur !== run) return;
  run.frac = frac; showProg(S, frac);
  const st = M.progressStatus(run, on, k, stage, what, lbl, from);
  if (st != null) setStatus(S, st);
  const t = M.progressTell(on, k, stage, lbl);
  if (run.tell && t) run.tell(run.frac, t);
  if (S.host.onProgress) S.host.onProgress();
}
// (the history let go before the run's own commit: the state on show then has the run's
// results, and the commit adds no step; one not committed here is the switch's or the
// close's, which the change listeners hear)
function endRun(S, commit){
  S.cur = null; S.busy = false; hideProg(S); syncButtons(S); draw(S);
  releaseHist(S, !commit);
  if (commit) S.host.commit();
  if (S.std) S.host.changed();
  S.host.onBusy();
}
// The history held from a run's start or a wait's (host.hold), once; let go with what the
// run wrote (host.release), once, whichever way it ends.
function holdHist(S){ if (!S.mark){ S.mark = S.host.hold(); S.wrote = {}; } }
function releaseHist(S, quiet){ const m = S.mark, w = S.wrote; S.mark = S.wrote = null; if (m) S.host.release(m, w, quiet); }
const start = (S, list, tell)=> (S.curP = refine(S, list, tell));
// The standard refined for a sample ("Refine the standard first", host.refineStd): its run
// going on already, that one (own false).
function runForSample(S, tell){
  if (S.busy){ if (S.cur) S.cur.tell = tell; return { own: false, done: S.curP }; }
  const why = S.host.blocked();
  return why ? { why } : { own: true, done: start(S, S.host.files().slice(), tell) };
}
/* Ends the run at once, or a sample's wait for the standard's: Cancel, the tab manager's
   stop (a tab left, xrd.js), a kind switch (commit false: the switch commits). Up to v477
   Cancel let the worker's last answer end the run, and an end that came after a switch
   went to the project then shown. */
function cancel(S, commit = true){
  if (S.waiting){
    const w = S.waiting; S.waiting = null; w.cancelled = true;
    if (w.own) S.host.stopStd(commit);
    releaseHist(S);
    hideProg(S); syncButtons(S);
    setStatus(S, M.waitStopText(w.own));
  }
  const run = S.cur;
  if (!run) return;
  // (the jobs under way cancelled; those done behind them written, in order)
  if (run.lanes) run.lanes.stop();
  endRun(S, commit);
  setStatus(S, M.stoppedText(run, S.std));
}
/* Refine and Refine all on a sample with no refined standard (no result of the standard's
   file to take its profile from, ownIrf) ask first: refine the standard (its window's
   Settings… as they are) and then these, refine without it, or not (×, Escape, a click
   beside it); with no standard loaded, load one (its window) instead of the first. The
   question is a window at the centre of the screen, its primary answer focused, the
   focus back on the button pressed once answered (to v493 a banner at the top, easily
   missed). The patterns are those of the press, found again by name when the choice is
   made. A press with no phase to refine on any of them asks nothing: Refine says so at
   once (asked first, the standard was refined before that was said). */
async function press(S, all){
  const f = curFile(S);
  if (!all && !f) return;
  const names = all ? null : [f.name];
  const list = ()=> all ? S.host.files().slice() : S.host.files().filter(g=> names.includes(g.name));
  if (S.std || irf(S) || !list().some(g=> M.phasesFor(S, g).length)){ start(S, list()); return; }
  const g = S.gen, loaded = S.host.stdLoaded();
  const c = await confirmModal(...M.stdQuestion(loaded), { title: 'Instrumental standard', back: S.$(all ? 'RefineAll' : 'Refine') });
  // (outlived: another state restored in the card, the card closed, a run started meanwhile)
  if (!c || g !== S.gen || !S.root.isConnected || S.busy || S.waiting) return;
  // Answered with the card not on show, it starts nothing: the window covers the tabs,
  // but the browser's Back still leaves for a section the address names (Home, Projects,
  // Settings). The banner, to v493, stayed over any tab left, and the XRPD project might
  // no longer be the live tab, the one the tab manager guards: a run started so went into
  // the next XRPD project opened, unasked, and "Load a standard…" opened its window over
  // the other module. Back on the card, its Refine asks again.
  if (!S.root.closest('.tab.active')){ setStatus(S, 'Nothing refined: the question was answered with the card not on show.'); return; }
  if (c === 'alt' || irf(S)){ start(S, list()); return; }
  if (!loaded){ S.host.openStd(); return; }
  await stdFirst(S, list);
}
// "Refine the standard first": the standard's run (one going on already, this waits for
// it; refused while a sample refines), then the patterns of the press (list).
async function stdFirst(S, list){
  const w = { cancelled: false, own: false };
  const sr = S.host.refineStd((frac, t)=>{ if (S.waiting === w){ showProg(S, frac); setStatus(S, `Refining the standard first: ${t}…`); } });
  if (sr.why){ setStatus(S, sr.why); return; }
  // (the history held from here: the patterns go in after the standard's own step)
  w.own = sr.own; S.waiting = w; holdHist(S);
  setStatus(S, 'Refining the instrumental standard first…'); syncButtons(S);
  const r = await sr.done;
  // (stopped from here, or by the tab manager: cancel said so)
  if (w.cancelled || S.gone || !S.host.placed()){ if (!w.cancelled) releaseHist(S); return; }
  S.waiting = null; hideProg(S); syncButtons(S);
  if (!r.ok || !irf(S)){ releaseHist(S); setStatus(S, M.stdFailText(r), r.why === 'stopped' ? '' : 'bad'); return; }
  start(S, list());
}

/* ---- the plot: observed, calculated, the background, the difference under them,
   and a row of ticks per phase between the two ---- */
// (kept: curvesKept, above. Up to v486 a redraw built and calculated the model twice,
// and an undo or a tab switch again for every refined pattern in the Results: 1.5–2.5 s
// for twelve)
function curvesOf(S, f, r){
  const list = M.resultPhases(r, M.allPhases(S), M.phasesFor(S, f)), key = M.curveKey(f, r, list, S.std);
  return { c: curvesKept(f.y, key, ()=>{ const { yc, bg, ticks } = M.curvesFrom(f, r, list, S.std); return { yc, bg, ticks }; }), list, key };
}
const setText = (S, id, t)=>{ const el = S.$(id); if (el.textContent !== t) el.textContent = t; };
function draw(S, preserve){
  if (S.gone || S.host.unseen()) return;
  const fs = S.host.files();
  syncButtons(S);
  renderPhases(S);
  if (!fs.length){ drawNone(S); return; }
  const f = fs[curIdx(S)], r = own(S.results, f.name);
  if (S.nav) S.nav.update();
  // (the Results show every pattern, the card folded or not)
  renderRes(S);
  if (S.host.hidden()) return;
  const drawn = drawPlot(S, f, r, preserve);
  renderResults(S, f, r);
  // (the picked peak's line again on a plot drawn anew, where the widths' table is there
  // as it was and so did not mark it: its picked peak is this pattern's. With no widths
  // (no result, one cleared, none measured) none is marked, as before: the one picked
  // is another pattern's or the cleared result's)
  if (!renderWidths(S, f, r) && drawn && S.whPlot) markPeaks(S);
  renderSolids(S, f, r);
  fitSide(S);
}
// No pattern: nothing drawn (the standard's plot has no caption: its window names the file).
function drawNone(S){
  if (S.nav) S.nav.update();
  renderRes(S);
  if (S.plot){ S.plot = null; }
  S.$('Svg').replaceChildren(); S.$('Legend').innerHTML = ''; S.$('Instr').textContent = ''; S.$('InstrNotes').innerHTML = ''; S.plotKey = S.instrTxt = S.instrNotes = '';
  renderResults(S, null, null); renderWidths(S, null, null); renderSolids(S, null, null);
}
/* The pattern's plot as last drawn (plotKey, xrd-rv-model.js plotKeyOf). The same again, it
   stays as it is (kept in view, as preserve keeps it; else only where not zoomed): the
   label, which only the figure composer's name of the observed trace has, is set in place.
   Gives whether it was drawn anew. */
function drawPlot(S, f, r, preserve){
  const svg = S.$('Svg');
  const key = M.plotKeyOf(S, f, r, sizeOf(svg));
  const drawn = !(S.plot && key === S.plotKey && (preserve || atOrigin(S.plot)));
  if (drawn){ S.plotKey = ''; drawPattern(S, f, r, svg, preserve); S.plotKey = key; }
  else S.plot._stored.forEach(e=>{ if (e.key === f.name) e.label = f.label; });
  const ins = M.instrOf(f), it = H.instrLine(ins), nt = H.instrNotesHtml(ins, M.bytesHeld(f));
  if (it !== S.instrTxt){ S.instrTxt = it; S.$('Instr').textContent = it; }
  // (what it rests on, under it: v571, X05 and X06)
  if (nt !== S.instrNotes){ S.instrNotes = nt; S.$('InstrNotes').innerHTML = nt; }
  return drawn;
}
// A redraw keeps the 2θ zoom; the height follows what is drawn (a phase's tick row more or
// less, the difference once there is a fit: xrd-rv-model.js patternFrame).
function drawPattern(S, f, r, svg, preserve){
  const prev = preserve && S.plot ? { xmin: S.plot.xmin, xmax: S.plot.xmax } : null;
  const plot = S.plot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (counts)' });
  plot.attachTools(svg.closest('.plot-wrap'));
  const { c, used, key } = patternCurves(S, f, r), ys = f.y;
  const groups = c ? M.groupTicks(c.ticks, used)
    : ticksKept(f.y, M.exactJson([M.idOf(f.x), M.instrOf(f), used.map(q=> [q.id, M.idOf(q.prep), q.color])]), ()=> M.tickRows(f, used));
  const diff = c ? diffKept(ys, key, ()=> ys.map((v, i)=> v - c.yc[i])) : null;
  const fr = M.patternFrame(ys, groups.length, diff, M.scanRange(f));
  plot.setRange(...fr.range);
  if (prev){ plot.xmin = prev.xmin; plot.xmax = prev.xmax; }
  plot.drawAxes();
  plot.line(f.x, ys, 'var(--plot-errbar)', 1, undefined, { label: f.label, key: f.name });
  if (c){
    plot.line(f.x, c.bg, '#ff9933', 1, undefined, { label: 'background', key: 'background' });
    plot.line(f.x, c.yc, '#ff5050', 1.2, undefined, { label: 'calculated', key: 'calculated' });
    plot.line(f.x, diff.map(v=> v + fr.off), '#3aa0ff', 1, undefined, { label: 'difference', key: 'difference' });
  }
  groups.forEach((g, k)=>{ const { xs, yv } = M.tickSegs(g, k, fr); plot.segments(xs, yv, g.color, 1.2, { label: g.name, key: 'ticks/' + g.name }); });
  S.$('Legend').innerHTML = H.patternLegendHtml(!!c, groups);
}
// The curves of a pattern's result, with the phases it was refined with, or none (not
// refined; the phases changed since: drawn as not refined, their ticks where the cells are).
function patternCurves(S, f, r){
  const out = { c: null, used: M.phasesFor(S, f), key: '' };
  if (r && r.params){ try { const cv = curvesOf(S, f, r); out.c = cv.c; out.used = cv.list; out.key = cv.key; } catch(e){ out.c = null; } }
  return out;
}

/* ---- the Results (a card's section): every refined pattern stacked, the observed
   less its refined background, normalised as Settings… say (resNorm); the crystallite sizes by
   sample (each phase's refined size with its esd; a free shape's measured dimensions,
   each with its own) or by peak (each reflection's own size, from the peak widths,
   across the samples). Each drawn again only when what it shows changes. ---- */
// A pattern's observed less its refined background, or null (kept: netKept).
function netOf(S, f, r){
  let list; try { list = M.resultPhases(r, M.allPhases(S), M.phasesFor(S, f)); } catch(e){ return null; }
  return netKept(f.y, M.curveKey(f, r, list, S.std), ()=>{ try { const { c } = curvesOf(S, f, r); return Array.from(f.y, (y, i)=> y - c.bg[i]); } catch(e){ return null; } });
}
const refinedFiles = S => S.host.files().filter(f=> own(S.results, f.name) && own(S.results, f.name).params);
const phaseColor = (S, name) => (M.allPhases(S).find(q=> q.prep.name === name) || {}).color || '#888';
// (up to v490 the section was drawn whole again on any change to it: a label, the
// Results' charts both)
function renderRes(S){
  if (!S.res) return;
  const fs = refinedFiles(S), anyW = fs.some(f=> own(S.results, f.name).widths);
  if (S.sizeBy === 'peak' && !anyW) S.sizeBy = 'sample';
  const row = S.res.querySelector('.res-row'), none = S.$('ResNone'), on = fs.length ? '' : 'none';
  if (row.style.display !== on) row.style.display = on;
  if (none.style.display !== (fs.length ? 'none' : '')) none.style.display = fs.length ? 'none' : '';
  if (!fs.length) return;
  const a = drawStacked(S, fs), b = drawSizes(S, fs, anyW);
  sizeNames(S);
  if (a || b) fitCsvIcons(S.res);
}
/* The stacked plot as last drawn: the patterns, each one's observed less its background
   (one array while what it is made from is the same: netOf), colour and 2θ, the
   normalisation and the plot's size. A label is no part of it: the legend's, written
   again alone, and the figure composer's name of its trace, set in place. */
function drawStacked(S, fs){
  const shown = fs.map(f=> ({ f, y: netOf(S, f, own(S.results, f.name)) })).filter(q=> q.y), svg = S.$('ResSvg');
  const leg = H.legendHtml(shown.map(({ f })=> [f.color, f.label]));
  if (leg !== S.stackLeg){ S.stackLeg = leg; S.$('ResLegend').innerHTML = leg; }
  const key = M.stackKeyOf(S.resNorm, sizeOf(svg), shown);
  if (S.stackPlot && key === S.stackKey){
    const lab = new Map(shown.map(({ f })=> [f.name, f.label]));
    S.stackPlot._stored.forEach(e=>{ if (lab.has(e.key)) e.label = lab.get(e.key); });
    return false;
  }
  S.stackKey = '';
  const plot = S.stackPlot = new Plot(svg, { xlabel: '2θ (°)', ylabel: 'Intensity (a. u.)', noYTickLabels: true });
  plot.attachTools(plot.svg.closest('.plot-wrap'));
  const st = M.stackOf(U, shown, S.resNorm);
  plot.setRange(...st.range);
  plot.drawAxes();
  st.lines.forEach(({ f, norm, ys })=> plot.line(f.x, ys, f.color, 1.3, undefined, { raw: { xs: f.x, ys: norm }, label: f.label, key: f.name }));
  S.stackKey = key;
  return true;
}
/* The sizes as points with their esds, the names under the axis cut and tilted to fit
   (barNames) as the Scherrer card's, the values written above. By sample: a column a
   pattern, a point a phase (beside each other) and a dimension of a free shape; by peak:
   a column a reflection, a point a pattern (xrd-rv-model.js sizeMarks). The chart as last
   drawn (sizeKey): its columns, its points and their values, the chips in its corner and
   its size; the chips, the legend and the note as last written. */
function drawSizes(S, fs, anyW){
  const svg = S.$('SizeSvg'), chips = S.$('SizeBy'), wrap = svg.closest('.plot-wrap');
  const ch = H.sizeChipsHtml(S.sizeBy, anyW);
  if (ch !== S.sizeChips){ S.sizeChips = ch; chips.innerHTML = ch; }
  const { cols, marks, series } = M.sizeMarks(fs, S.results, S.sizeBy, name=> phaseColor(S, name));
  const pts = marks.filter(m=> m.v != null), labs = marks.filter(m=> m.label);
  if (!pts.length){ wrap.style.display = 'none'; S.sizeKey = ''; putSizeText(S, '', M.sizeNoteOf(S.sizeBy, fs, S.results, false)); return false; }
  if (wrap.style.display) wrap.style.display = '';
  putSizeText(S, H.legendHtml(series.map(q=> [q.color, q.name])), M.sizeNoteOf(S.sizeBy, fs, S.results, true));
  const key = JSON.stringify([ch, cols, marks, sizeOf(svg)]);
  if (key === S.sizeKey) return false;
  S.sizeKey = '';
  sizePlot(S, svg, chips, wrap, { cols, pts, labs });
  S.sizeKey = key;
  return true;
}
function putSizeText(S, lg, nt){
  if (lg !== S.sizeLeg){ S.sizeLeg = lg; S.$('SizeLegend').innerHTML = lg; }
  if (nt !== S.sizeNote){ S.sizeNote = nt; S.$('SizeNote').textContent = nt; }
}
// The chart's frame (the names' room under it, the values' above the points, the chips'),
// then the points, their esds and values, and the names (with the whole name's runs too: the
// figure composer draws it, with its bars).
function sizePlot(S, svg, chips, wrap, { cols, pts, labs }){
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const br = svg.getBoundingClientRect(), svgW = br.width || 640, svgH = br.height || 420, n = cols.length;
  const fit = barNames(mctx, cols.map(c=> c.label), Math.max(60, svgW - 75), 55);
  const maxLbl = Math.max(0, ...fit.labels.map(l=> mctx.measureText(l).width));
  const bottom = Math.round(26 + maxLbl*fit.sin), mTop = 15, gap = 8, plotH = svgH - mTop - bottom;
  const maxValW = Math.max(0, ...labs.map(m=> mctx.measureText(m.label).width));
  const reserve = gap + maxValW + 6, frac = plotH > reserve ? 1 - reserve/plotH : 0.5;
  const tops = pts.map(m=> m.v + (Number.isFinite(m.e) ? m.e : 0));
  const ymax = Math.max(Math.max(...tops)*1.15, (labs.length ? Math.max(...labs.map(m=> m.top)) : 0)/frac,
    barChipYmax(chips, svg, labs.map(m=> ({ x: m.x, dx: m.dx, top: m.top, w: mctx.measureText(m.label).width })), { W: svgW, ml: 55, mr: 20, mTop, plotH, gap, x0: 0, x1: n + 1 }));
  const plot = new Plot(svg, { xlabel: '', ylabel: 'Crystallite size (nm)', noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: mTop, b: bottom } });
  plot.setRange(0, n + 1, 0, ymax || 1);
  plot.drawAxes();
  pts.forEach(m=>{ if (Number.isFinite(m.e) && m.e > 0) plot.errbar(m.x, m.v, m.e, m.dx); });
  M.pointGroups(pts, svgW, n).forEach(g=> plot.points(g.xs, g.ys, g.color, 4.5));
  labs.forEach(m=> plot.barLabel(m.x, m.top, m.label, { gap, dx: m.dx }));
  cols.forEach((c, i)=> plot.tickLabel(i + 1, fit.labels[i], fit.rot, c.label, c.name, c.hkl ? M.plotRuns(fit.labels[i], c.hkl) : null, c.hkl ? M.plotRuns(c.label, c.hkl) : null));
  plot.attachTools(wrap);
}
/* The size chart's image follows what it shows, its CSVs never (v530): both, the sizes by
   sample (rietveld_results.csv) and by peak (rietveld_peaks.csv, where any), whichever the
   chips show, a view alone (v528); to v529 the one on show. Both named after the card. */
function sizeNames(S){
  if (!S.res) return;
  S.res.querySelectorAll('[data-size-dl]').forEach(b=>{
    b.dataset.csvNames = S.csvPre + 'rietveld_results.csv,' + S.csvPre + 'rietveld_peaks.csv';
    if (b.classList.contains('plot-dl-btn')) b.dataset.dlName = S.csvPre + (S.sizeBy === 'peak' ? 'XRPD_rietveld_size_by_peak.svg' : 'XRPD_rietveld_size.svg');
  });
}
function sizeByClicked(S, e){
  const b = e.target.closest('[data-size-by]');
  if (!b || b.disabled || b.dataset.sizeBy === S.sizeBy) return;
  S.sizeBy = b.dataset.sizeBy === 'peak' ? 'peak' : 'sample';
  renderRes(S);
  S.host.commit();
}

/* ---- the crystallites' shape: each phase's refined solid in 3D (xrd-shape3d), the
   crystal's directions on it with their uncertainty cones; drag to turn it ---- */
/* The solids' views fill their box, square beside the Williamson–Hall plot and as tall
   (the plot's height, the column's width): each the box's height, shared by several,
   less its head and its caption. Stacked on a narrow screen: square, 320 px at most. */
const solidHeight = (S, n) => ()=>{
  const box = S.$('Solids'), cs = getComputedStyle(box);
  if (document.documentElement.classList.contains('narrow-layout')) return Math.min(320, box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  let h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 10*(n - 1);
  box.querySelectorAll('.rv-solid').forEach(w=>{ const c = w.querySelector('canvas'); h -= w.offsetHeight - (c ? c.offsetHeight : 0); });
  return Math.max(120, Math.floor(h/n));
};
// The same solids: the views stay as they were turned. Others: each turned as it was last
// left (solidTurns, the last 50).
function renderSolids(S, f, r){
  const box = S.$('Solids'), list = (r && r.solids) || [];
  const key = M.solidsKeyOf(f, list);
  if (key === S.solidsKey) return;
  S.solidsKey = key;
  S.solidViews.forEach(({ view, turnKey })=>{ if (view.getView) S.solidTurns.set(turnKey, view.getView()); view.destroy(); });
  S.solidViews = [];
  if (S.solidTurns.size > 50) S.solidTurns.delete(S.solidTurns.keys().next().value);
  box.innerHTML = list.length ? '' : H.solidsNoneHtml(r);
  list.forEach(s=> S.solidViews.push(solidView(S, box, f, s, list.length)));
}
function solidView(S, box, f, s, n){
  const color = (M.allPhases(S).find(q=> q.id === s.id) || {}).color;
  const wrap = document.createElement('div');
  wrap.className = 'rv-solid';
  wrap.innerHTML = H.solidHeadHtml(s, n, PLOT_DL_ICON);
  box.appendChild(wrap);
  const view = shapeView(wrap.querySelector('.rv-solid-view'), { color, height: solidHeight(S, n) });
  view.set({ type: s.type, dims: s.dims, frame: s.frame, dirs: s.dirs, cell: s.cell, caption: H.solidCaption(s) });
  const turnKey = M.turnKeyOf(f, s);
  if (view.setView && S.solidTurns.has(turnKey)) view.setView(S.solidTurns.get(turnKey));
  wrap.querySelector('button').onclick = ()=> solidPng(view, f, s);
  return { view, turnKey };
}
function solidPng(view, f, s){
  const a = document.createElement('a');
  a.href = view.png(); a.download = M.solidPngName(f, s);
  document.body.appendChild(a); a.click(); a.remove();
}

/* ---- the peaks' own widths (xrd-widths, run by the worker): the Williamson–Hall plot,
   the tests on them beside it, and the table at the card's foot ---- */
/* The table, the Williamson–Hall plot and the tests as last drawn (widthsKey): the
   pattern, its result, the phases' colours and the plot's size. Drawn again, it says so
   (the picked peak is marked again with it). */
function renderWidths(S, f, r){
  const box = S.$('Widths'), wd = r && r.widths;
  const phs = wd ? wd.phases.filter(ph=> ph.rows.length) : [];
  if (box.style.display !== (phs.length ? '' : 'none')) box.style.display = phs.length ? '' : 'none';
  const wn = S.$('WNote'), wt = H.widthsNote(wd);
  if (wn.textContent !== wt) wn.textContent = wt;
  if (!phs.length){ S.whPlot = null; S.widthsKey = ''; return false; }
  const key = M.widthsKeyOf(f, r, M.allPhases(S), sizeOf(S.$('WhSvg')));
  if (S.whPlot && key === S.widthsKey) return false;
  S.widthsKey = '';
  const colorOf = id => (M.allPhases(S).find(q=> q.id === id) || {}).color || '#888';
  const wrap = S.$('PkWrap');
  wrap.innerHTML = H.widthsTableHtml(phs, wd, colorOf);
  drawWH(S, phs, colorOf);
  S.$('Tests').innerHTML = H.testsHtml(phs);
  wireRows(S, f, wrap, colorOf);
  markPeaks(S);
  fitCsvIcons(S.root);
  S.widthsKey = key;
  return true;
}
// The table's rows: hovered, a peak marked beside the one picked; a click picks it, or lets
// it go. (The one picked stays picked through a redraw of its pattern, while its row is there.)
function wireRows(S, f, wrap, colorOf){
  const pk = tr => M.pkOf(f.name, tr.dataset, colorOf);
  const rows = [...wrap.querySelectorAll('.rv-pk')];
  if (S.pkSel && !rows.some(tr=> M.samePk(pk(tr), S.pkSel))) S.pkSel = null;
  S.pkHov = null;
  rows.forEach(tr=>{
    tr.classList.toggle('selected', M.samePk(pk(tr), S.pkSel));
    tr.addEventListener('mouseenter', ()=>{ S.pkHov = pk(tr); tr.classList.add('hovering'); markPeaks(S); });
    tr.addEventListener('mouseleave', ()=>{ S.pkHov = null; tr.classList.remove('hovering'); markPeaks(S); });
    tr.addEventListener('click', ()=>{
      const k = pk(tr);
      S.pkSel = M.samePk(k, S.pkSel) ? null : k;
      rows.forEach(x=> x.classList.toggle('selected', M.samePk(pk(x), S.pkSel)));
      markPeaks(S);
    });
  });
}
// The picked peak and the one under the pointer: a line at each on the pattern, in its
// phase's colour, and a ring round each on the Williamson–Hall plot (the picked one's
// thicker; drawn again at a zoom or a pan of it).
function markPeaks(S){
  if (S.plot){ S.plot.clearOverlay(); M.markedOf(S.pkSel, S.pkHov).forEach(k=> S.plot.vline(k.tt, k.color, false)); }
  markWH(S);
}
function markWH(S){
  const wh = S.whPlot;
  if (!wh) return;
  wh.gOverlay.querySelectorAll('.wh-hl').forEach(e=> e.remove());
  M.markedOf(S.pkSel, S.pkHov).forEach(k=>{
    const q = (wh._pts || []).find(x=> x.label === k.lab && x.ph === k.ph);
    if (!q) return;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', wh.px(q.x)); c.setAttribute('cy', wh.py(q.y)); c.setAttribute('r', 7);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', k.color); c.setAttribute('stroke-width', k === S.pkSel ? 2.6 : 2); c.setAttribute('class', 'wh-hl');
    wh.gOverlay.appendChild(c);
  });
}
/* Williamson–Hall: the peaks the tests use and the models' own points (xrd-rv-model.js
   whPoints), the weighted line through them (isotropic size + strain), from 4·sinθ = 0,
   where it gives Kλ/D (whRange). */
function drawWH(S, phs, colorOf){
  const svg = S.$('WhSvg');
  const wh = S.whPlot = new Plot(svg, { xlabel: '4·sinθ', ylabel: 'FWHM·cosθ (10⁻³ rad)' });
  wh.attachTools(svg.closest('.plot-wrap'));
  const { pts, mods } = M.whPoints(phs, colorOf);
  wh._onView = ()=> markWH(S);
  if (!pts.length){ wh.setRange(0, 1, 0, 1); wh.drawAxes(); S.$('WhLegend').innerHTML = ''; return; }
  wh.setRange(...M.whRange(pts, mods, phs));
  wh.drawAxes();
  phs.forEach(ph=>{
    const w = ph.wh;
    if (!Number.isFinite(w.a)) return;
    const xa = wh.xmin, xe = wh.xmax;
    wh.line([xa, xe], [1e3*(w.a + w.b*xa), 1e3*(w.a + w.b*xe)], colorOf(ph.id), 1, '5,4', { label: `${ph.name}: weighted line (isotropic size + strain)`, key: 'wh/' + ph.id });
  });
  const iso = mods.filter(m=> m.kind === 'iso'), shp = mods.filter(m=> m.kind === 'shape');
  if (iso.length) wh.points(iso.map(m=> m.x), iso.map(m=> m.y), '#9aa3ad', 3);
  if (shp.length) wh.points(shp.map(m=> m.x), shp.map(m=> m.y), '#ff5050', 3);
  pts.forEach(q=>{ if (q.e > 0) wh.errbar(q.x, q.y, q.e); });
  phs.forEach(ph=>{ const q = pts.filter(x=> x.ph === ph.id); wh.points(q.map(x=> x.x), q.map(x=> x.y), colorOf(ph.id), 4.5); });
  pts.forEach(q=>{ const t = M.hklShow(q.label); wh.barLabel(q.x, q.y + q.e, t, { rot: 0, gap: 8, size: 10, runs: M.plotRuns(t, t) }); });
  wh._pts = pts;
  S.$('WhLegend').innerHTML = H.whLegendHtml(phs, colorOf, iso.length, shp.length);
}

/* ---- the results, across the card under the pattern: the statistics, then what the
   worker made of the result — the standard's instrument, or each phase's cell, size,
   strain (and weight fraction with several phases), a value a line — and beside each
   phase what its CIF gave and how it is refined ---- */
/* By the box's title, what the result was refined with — each phase's models (refinedOf)
   and the Refinement settings that are not the defaults —, or, not refined yet, what
   Refine will refine (the settings); a phase's name before its line when there are
   several. (each box of markup written again only when its markup changed: up to v490 at
   every draw) */
function renderFitSet(S, f, r, shown){
  const el = S.$('FitSet'), done = !!(r && r.params), list = f ? shown : [];
  const used = done ? M.fitUsed(r, S.std) : [];
  const html = H.fitLineHtml(list, r, done, used, S.std);
  if (html !== S.fitSetShown){ S.fitSetShown = html; el.innerHTML = html; }
  const t = M.fitSetTitle(done, list.length);
  if (el.title !== t) el.title = t;
  el.classList.toggle('is-next', !done);
}
// The results' box (xrd-rv-html.js resultsHtml), the phases shown those the result was
// refined with.
// (a result whose curve cannot be drawn, its phases changed since, says so: lost; v571, X14:
// to v570 the curve went with no word)
function renderResults(S, f, r){
  if (!f){ renderFitSet(S, null, null, []); putResults(S, H.noPatternHtml(S.std)); return; }
  let lost = false;
  const shown = r && r.params ? (()=>{ try { return curvesOf(S, f, r).list; } catch(e){ lost = true; return M.phasesFor(S, f); } })() : M.phasesFor(S, f);
  renderFitSet(S, f, r, shown);
  putResults(S, H.resultsHtml({ r, std: S.std, shown, n: M.phasesFor(S, f).length, any: S.phases.length, irf: ()=> irf(S), stale: ()=> staleOf(S, f, r), lost }));
}
function putResults(S, h){ if (h !== S.resultsShown){ S.resultsShown = h; S.$('Results').innerHTML = h; } }

/* ---- the phases: a short list beside the pattern (formula and space group), each
   ticked for the pattern on show (the standard's: one chosen), and the structure of the
   one selected ---- */
// (the list and the details written again only when their markup changed: up to v490 at
// every draw; its handlers are the list's own, delegated)
function renderPhases(S){
  const el = S.$('PhaseList'), list = M.allPhases(S), f = curFile(S);
  if (!list.some(q=> q.id === S.sel)) S.sel = list.length ? (S.std ? S.pick : list[0].id) : null;
  const html = H.phaseRowsHtml(list, { p: S.p, std: S.std, pick: S.pick, sel: S.sel, f, lab6: S.lab6, dlIcon: DL_ICON, xIcon: X_SVG });
  if (html !== S.phasesShown){ S.phasesShown = html; el.innerHTML = html; }
  lockRows(S);
  /* No phase: the drop zone in the list's place; with one, the list and + CIF, a drop zone
     of one line, at the box's foot (to v498 "No phase yet: + CIF adds one…" and + CIF, a
     button, in the box's head). A zone hidden with the focus in it gives it to the other. */
  const none = !list.length, dz = S.$('CifDz'), mini = S.$('AddCif'), had = [dz, mini].find(z=> z.contains(document.activeElement));
  if (el.hidden !== none) el.hidden = none;
  if (dz.hidden === none) dz.hidden = !none;
  if (mini.hidden !== none) mini.hidden = none;
  if (had && had.hidden) (none ? dz : mini).focus({ preventScroll: true });
  renderCell(S);
}
/* A row's × and tick (the standard's: its choice) are locked while a run goes on here (in
   the standard's window, while the standard refines), which took the phases as it started
   (run.ph), or waits for the standard's run to start after it (locked): at once as it
   starts and until it ends, is stopped or fails (syncButtons), titled why, the pointer
   'not-allowed' over them (.is-locked). The × disabled; the tick and the choice
   aria-disabled, not disabled, so that they keep their accent and a ticked phase or the
   one chosen reads as such (the browser's disabled look draws ticked and not alike, one
   grey), a click on them cancelled (the list's click). To v505 they kept their
   look until the list was next drawn, which a run did only once the pattern on show was
   refined: never in a run of one pattern, the standard's, or Refine all with a later
   pattern on show; a click was refused unsaid. The list's markup leaves this out, so that a
   run starting or ending does not write it again. The download stays enabled (a run
   changes nothing of a CIF); the built-in LaB6's × is disabled for good, with its own title
   (data-built). A sample's card does not lock its rows while the standard refines, unless
   it waits for that run, nor the standard's window while samples do: their runs took the
   phases they refine as they started. (xrd-rv-model.js rowLock) */
function lockRows(S){
  const f = curFile(S), lock = M.locked(S);
  S.$('PhaseList').querySelectorAll('[data-del]:not([data-built]), [data-on], [data-pick]').forEach(c=>{
    const k = c.dataset.del != null ? 'del' : c.dataset.on != null ? 'on' : 'pick', { off, title } = M.rowLock(k, lock, f);
    if (c.disabled !== off) c.disabled = off;
    if (k !== 'del' && c.hasAttribute('aria-disabled') !== lock){ if (lock) c.setAttribute('aria-disabled', 'true'); else c.removeAttribute('aria-disabled'); }
    if (c.title !== title) c.title = title;
    if (c.classList.contains('is-locked') !== lock) c.classList.toggle('is-locked', lock);
  });
}
/* The selected phase's cell in 3D (xrd-cell3d) and its details under it; no phase, none
   of either, the box saying so (to v498 the 3D view kept the cell drawn last on show:
   xrd-cell3d set). */
function renderCell(S){
  const q = M.allPhases(S).find(x=> x.id === S.sel) || null, info = S.$('CellInfo');
  const put = h =>{ if (h !== S.cellInfoShown){ S.cellInfoShown = h; info.innerHTML = h; } };
  setText(S, 'CellName', q ? q.prep.name : '');
  if (!q){ if (S.cellV) S.cellV.set(null); S.cellKeyShown = ''; S.cellNext = null; put(H.CELL_NONE); return; }
  if (!S.cellV) S.cellV = cellView(S.$('Cell'), { side: ()=> cellSide(S) });
  const k = M.cellKeyOf(q);
  if (k !== S.cellKeyShown){ S.cellKeyShown = k; S.cellV.set({ name: q.id + q.prep.name, cell: q.prep.cell, atoms: q.prep.atoms }); }
  // (the turn it had, given back on the same cell only, at its first drawing since)
  if (S.cellNext){ if (S.cellNext.key === k) S.cellV.setView(S.cellNext); S.cellNext = null; }
  put(H.cellDetailsHtml(q, q === S.lab6));
}
// The square's side: the shorter of the box's width and what is left of its height
// under the details (fitSide sets the box's height to end with the plot).
function cellSide(S){
  const box = S.$('Cell').closest('.rv-cellbox');
  if (!box) return 0;
  const cs = getComputedStyle(box), w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - box.querySelector('.peak-box-head').offsetHeight - 8;
  return Math.max(80, Math.min(w, h > 0 ? h : w));
}
// The column beside the pattern ends where the plot does: its boxes take the height the
// buttons leave (set by the grid; on a narrow screen, where it sits under the pattern,
// their own). The cell is drawn again, next frame, only when its square is no longer the
// one drawn (up to v490 at every draw).
function fitSide(S){
  if (!S.cellV || S.sideRaf) return;
  S.sideRaf = requestAnimationFrame(()=>{
    S.sideRaf = 0;
    const cv = S.$('Cell').querySelector('canvas'), s = Math.round(cellSide(S));
    if (S.gone || !cv || cv.hidden || (cv.style.width === s + 'px' && cv.width === Math.round(s*(window.devicePixelRatio || 1)))) return;
    S.cellV.redraw();
  });
}
// CIFs read (xrd-rv-model.js readCifs, as a Scherrer card reads its samples') into phases
// (newPhase), the first of them shown.
async function addCifs(S, fileList){
  if (M.locked(S)) return;
  const { got, errs } = await M.readCifs(fileList);
  got.forEach(c=> S.phases.push(M.newPhase(S.nextId++, c.text, c.file, c.prep, S.phases.length, S.std)));
  if (got.length) S.sel = S.phases[S.phases.length - got.length].id;
  draw(S, true); renderSettings(S); S.host.commit();
  // (an error in the status's place, "Not added: {file}: {why}.": v571, X07; to v570 grey,
  // "⚠ {file}: {message} · …")
  if (errs.length) setStatus(S, M.notAddedLines(errs), 'bad');
}

// ---- small UI pieces ----
/* The status under the phases: grey words (a run's progress, a stop, why Refine cannot), or a
   compact box of a kind (v571, ALERTS-REVIEW.md X07, X09): 'bad' a run or a CIF that failed,
   'info' what a run chose; `t` plain text, or its lines. */
function setStatus(S, t, kind){
  const el = S.$('Status'), ls = [].concat(t || []).filter(Boolean);
  if (kind && ls.length) el.innerHTML = boxHtml(kind, ls.map(H.esc));
  else el.textContent = ls.join(' ');
}
function showProg(S, frac){ runProgress(S.$('ProgWrap'), frac); }
function hideProg(S){ runProgress(S.$('ProgWrap'), null); }
// (a press of Refine or Refine all within a moment of the last, or one of Refine within a
// moment of its turning into Cancel or back, not taken: utils.js quickPress)
function syncButtons(S){
  const fs = S.host.files(), f = fs[curIdx(S)], on = M.locked(S);
  // Not now (host.blocked): a sample while the standard refines, the standard while a sample does.
  const why = on ? '' : S.host.blocked(), b = S.$('Refine'), label = on ? 'Cancel' : 'Refine';
  if (b.textContent !== label){ b.textContent = label; S.turnT = performance.now(); }
  b.disabled = !on && (!f || !!why);
  b.title = M.refineTitle(S.waiting, why);
  if (!S.std){ S.$('RefineAll').disabled = on || !fs.length || !!why; S.$('RefineAll').title = why; }
  S.$('Clear').disabled = on || !(f && own(S.results, f.name));
  if (!S.std) S.$('ClearAll').disabled = on || !Object.keys(S.results).length;
  // (the phases are read when a run starts: one added meanwhile would not be in it) The
  // drop zones as + CIF was, a button disabled then; the box refuses a drop then (cifDragged).
  const off = String(on);
  [S.$('CifDz'), S.$('AddCif')].forEach(z=>{ if (z.getAttribute('aria-disabled') !== off) z.setAttribute('aria-disabled', off); });
  // (the rows' × and tick with them, at once: lockRows)
  lockRows(S);
  syncStd(S);
  syncSettings(S);
}
/* The standard's refinement on every sample card's Instrumental standard… (one standard
   for all), its window open or not: a spinner before the label, as the drop zones' while
   they read, the run's progress as a bar along the button's foot, as the card's own
   (xrd-rv-model.js stdRunView), and its name and title saying so; until the run ends, is
   stopped or fails. To v492 a run went on unseen once its window was closed. */
function syncStd(S){
  if (S.std) return;
  const run = S.host.stdRun(), b = S.$('Std'), v = M.stdRunView(run);
  if (v.key === S.stdShown) return;
  S.stdShown = v.key;
  b.classList.toggle('rv-std-run', !!run);
  if (!run){ b.removeAttribute('aria-busy'); b.removeAttribute('aria-label'); b.style.removeProperty('--rv-std-prog'); b.title = S.stdTitle; return; }
  b.setAttribute('aria-busy', 'true');
  b.setAttribute('aria-label', v.label);
  b.style.setProperty('--rv-std-prog', v.prog);
  b.title = v.title;
}

/* ---- the settings (a modal from Settings…, beside Refine): each phase's fitting modes,
   a row each (MODES), and where Refine starts (HOLDS). A change applies at once, to the
   next refinements (the results there keep theirs), and is a step of the undo history.
   The standard's card has its own: its phases', its start and its Refinement. ---- */
function makeSettings(S){
  const m = S.setModal = document.createElement('div');
  m.className = 'modal-backdrop';
  m.style.display = 'none';
  m.innerHTML = H.settingsModalHtml(S.p, S.std);
  S.host.layer.appendChild(m);
  S.setBody = m.querySelector('.rvs-body');
  // The settings, the modes and the start's groups this card shows (rowsFor).
  const { fits, modes, holds } = M.rowsFor(S.std);
  S.fitsHere = fits; S.modesHere = modes; S.holdsHere = holds;
  // (its window in the page: one of a tab not on show leaves the key to the page)
  S.onSetKey = e =>{ if (e.key === 'Escape' && S.setModal.isConnected){ e.stopPropagation(); closeSettings(S); } };
}
function wireSettings(S){
  const sig = { signal: S.ac.signal }, body = S.setBody;
  body.addEventListener('change', e=> settingChanged(S, e), sig);
  body.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && e.target.dataset.fit && e.target.type === 'text'){ e.preventDefault(); commitFit(S, e.target); }
  }, sig);
  body.addEventListener('click', e=> settingClicked(S, e), sig);
  S.setModal.addEventListener('click', e=>{ if (e.target === S.setModal) closeSettings(S); }, sig);
  S.setModal.querySelector('[data-done]').onclick = ()=> closeSettings(S);
  S.$('Settings').onclick = ()=> setOpen(S) ? closeSettings(S) : openSettings(S);
}
const setOpen = S => S.setModal.style.display === 'flex';
const phaseOf = (S, id) => M.allPhases(S).find(q=> q.id === id);
// Open while a run goes on too, to see what it refines: read only then (syncSettings). Its
// body built anew (no key: to v567 '', the key of no phase, which left the window of a card
// with none empty).
function openSettings(S){
  if (setOpen(S)) return;
  S.setModal.style.display = 'flex'; S.$('Settings').classList.add('is-on');
  S.setKey = null; S.fitNote = null; renderSettings(S);
  // (capture, and stopped there: a window under this one, the standard's, closes on its own Escape)
  document.addEventListener('keydown', S.onSetKey, { capture: true, signal: S.ac.signal });
  S.setModal.querySelector('.modal-box').focus();
}
function closeSettings(S){
  if (!setOpen(S)) return;
  // (the focus back on the button, when it was in the box: a keyboard user goes on from there)
  const inBox = S.setModal.contains(document.activeElement);
  S.setModal.style.display = 'none'; S.$('Settings').classList.remove('is-on');
  document.removeEventListener('keydown', S.onSetKey, true);
  if (inBox && !S.$('Settings').disabled) S.$('Settings').focus();
}
// Built again only when the phases on show change (one added or removed by an undo);
// otherwise the inputs are set in place, keeping the focus.
function renderSettings(S){
  if (!setOpen(S)) return;
  const list = M.allPhases(S), key = M.settingsKeyOf(list);
  if (key !== S.setKey){
    S.setKey = key;
    const html = H.settingsBodyHtml(list, { p: S.p, std: S.std, lab6: S.lab6, modes: S.modesHere, holds: S.holdsHere, fits: S.fitsHere, normOptions: NORM_OPTIONS });
    // (a field focused while the body is rebuilt fires a last change on its way out: ignored)
    S.rebuilding = true; S.setBody.innerHTML = html; S.rebuilding = false;
  }
  syncSettings(S);
}
function syncSettings(S){
  if (!setOpen(S)) return;
  const lock = M.locked(S), body = S.setBody;
  S.setModal.querySelector('.rvs-busy').hidden = !lock;
  body.querySelectorAll('[data-sec]').forEach(secEl=>{ const q = phaseOf(S, +secEl.dataset.sec); if (q) syncModes(S, secEl, q, lock); });
  body.querySelectorAll('[data-start]').forEach(b=>{ const on = b.dataset.start === S.startFrom; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); b.disabled = lock; });
  body.querySelectorAll('[data-hold]').forEach(cb=>{ cb.checked = S.hold.includes(cb.dataset.hold); cb.disabled = lock || S.startFrom !== 'last'; });
  body.querySelectorAll('.rvs-hold').forEach(r=> r.classList.toggle('is-off', S.startFrom !== 'last'));
  const rn = body.querySelector('[data-res-norm]');
  if (rn){ rn.value = S.resNorm; rn.disabled = lock; }
  syncFit(S);
}
// A phase's section: each mode's box and depth as its settings are, those that do not apply
// to it disabled and saying why (xrd-rv-model.js naOf, modeTitle).
function syncModes(S, secEl, q, lock){
  S.modesHere.forEach(m=>{
    const row = secEl.querySelector(`[data-row="${m.k}"]`), cb = row.querySelector('input'), sl = row.querySelector('select'), na = M.naOf(q, m.k);
    cb.checked = !!q.on[m.k]; sl.value = M.depOf(q, m.k);
    cb.disabled = lock || !!na; sl.disabled = lock || !!na || !q.on[m.k];
    row.classList.toggle('is-na', !!na);
    row.title = cb.title = sl.title = M.modeTitle(m, na, S.std);
  });
}
// What the automatic 1/2θ term gives for the pattern on show (autoInvOf).
const autoInv = S => M.autoInvOf(curFile(S));
// The Refinement section as the settings are: each field its value (the default when
// not set), a field being typed in left as it is.
function syncFit(S){
  const fs = fitSettings(S.fit), ai = autoInv(S), lock = M.locked(S);
  S.fitsHere.forEach(m=>{
    const row = S.setBody.querySelector(`[data-fit-row="${m.k}"]`);
    if (row) syncFitRow(S, m, row, { fs, ai, lock });
  });
  const def = S.setBody.querySelector('[data-fit-def]');
  if (def) def.disabled = lock || !M.fitShown(S.fit, S.std, S.fitsHere);
  const note = S.setBody.querySelector('[data-fit-note]');
  if (note) note.textContent = M.fitNoteText(null);
  /* An entry not taken: the rule, in red under its field's row, until the next entry (v571,
     ALERTS-REVIEW.md C19, X17: to v570 in amber in the note at the section's foot). */
  S.setBody.querySelectorAll('[data-fit-rule]').forEach(e=> e.remove());
  const row = S.fitNote && S.setBody.querySelector(`[data-fit-row="${S.fitNoteK}"]`);
  if (row) row.insertAdjacentHTML('afterend', `<p class="field-rule rvs-rule" data-fit-rule role="alert">${H.esc(S.fitNote)}</p>`);
}
// A setting's row: the 1/2θ term's value and its "automatic" (the value locked, showing what
// automatic gives), a choice's list, a number's field.
function syncFitRow(S, m, row, { fs, ai, lock }){
  const el = row.querySelector('[data-fit]');
  if (m.bool){
    const auto = !(m.k in S.fit), a = row.querySelector('[data-fit-auto]');
    a.checked = auto; a.disabled = lock;
    el.checked = auto ? ai.on : S.fit[m.k]; el.disabled = lock || auto;
    row.title = el.title = a.title = m.title + ai.why;
    row.querySelector('label').title = row.title;
    return;
  }
  if (m.choice){ el.value = fs[m.k]; el.disabled = lock; row.title = el.title = m.full; return; }
  const txt = M.fitTxt(m.pct ? fs[m.k]*100 : fs[m.k]);
  if (el !== document.activeElement || el.value === el.dataset.shown) el.value = txt;
  el.dataset.shown = txt; el.disabled = lock;
  row.title = m.full;
}
// A Refinement setting changed (on change or Enter): kept when allowed — a value back at
// its default dropped — else the field shakes, goes back to the value it had, and the
// note says what is allowed (xrd-rv-model.js fitEntry).
function commitFit(S, t){
  if (M.locked(S) || S.rebuilding || !t.isConnected) return;
  const k = t.dataset.fit || t.dataset.fitAuto, m = M.FIT[k]; if (!m) return;
  const e = M.fitEntry(S.fit, m, { auto: !!t.dataset.fitAuto, checked: t.checked, value: t.value, shown: t.dataset.shown }, ()=> autoInv(S).on);
  if (!e) return;
  if (e.refused){ S.fitNote = e.refused; S.fitNoteK = k; t.value = t.dataset.shown; flashFieldInvalid(t); syncFit(S); return; }
  if (e.same){ t.value = t.dataset.shown; if (S.fitNote){ S.fitNote = null; syncFit(S); } return; }
  S.fit = e.fit;
  S.fitNote = null;
  S.host.commit(); syncFit(S);
  // The field as taken, though still focused after Enter ("0,5" is 0.5; "1e2", 100).
  if (!m.bool && !m.choice) t.value = t.dataset.shown;
}
// A mode's box or depth, a group held, the Results' normalisation, a Refinement setting.
function settingChanged(S, e){
  const t = e.target, d = t.dataset;
  if (d.fit || d.fitAuto){ commitFit(S, t); return; }
  if (d.resNorm != null){ if (M.locked(S)) return; S.resNorm = normOf(t.value); renderRes(S); S.host.commit(); return; }
  if (M.locked(S) || !(d.on || d.depth || d.hold)) return;
  if (d.hold) S.hold = M.holdWith(S.hold, d.hold, t.checked);
  else {
    const q = phaseOf(S, +d.ph); if (!q) return;
    if (d.on) q.on[d.on] = t.checked;
    else if (M.listOf(q, M.MODE[d.depth]).some(([v])=> v === t.value)) q.dep[d.depth] = t.value;
  }
  S.host.commit(); draw(S, true); syncSettings(S);
}
// Defaults (every Refinement setting back to the engine's), or where Refine starts.
function settingClicked(S, e){
  if (e.target.closest('[data-fit-def]')){
    if (M.locked(S) || !M.fitShown(S.fit, S.std, S.fitsHere)) return;
    S.fit = {}; S.fitNote = null; S.host.commit(); syncFit(S);
    return;
  }
  const b = e.target.closest('[data-start]');
  if (!b || M.locked(S) || b.dataset.start === S.startFrom) return;
  S.startFrom = b.dataset.start === 'last' ? 'last' : 'cif';
  S.host.commit(); syncSettings(S);
}

/* CIFs in: a click, Enter or Space on the drop zone (no phase yet) or on + CIF (the
   zone of one line at the box's foot) selects them; files dropped anywhere on the Phases
   box are taken, several at once, the box lit while they are dragged over it. While a run
   goes on neither selects, and a drop is refused (the pointer says so), as + CIF was
   disabled then. Up to v498 only + CIF, a button, took CIFs in. */
function wireCifs(S){
  const sig = { signal: S.ac.signal }, pickCifs = ()=>{ if (!M.locked(S)) S.$('CifInput').click(); };
  [S.$('CifDz'), S.$('AddCif')].forEach(z=>{
    z.addEventListener('click', pickCifs, sig);
    z.addEventListener('keydown', e=>{ if ((e.key === 'Enter' || e.key === ' ') && !e.altKey && !e.ctrlKey && !e.metaKey){ e.preventDefault(); if (!e.repeat) pickCifs(); } }, sig);
  });
  const box = S.$('Cifs');
  ['dragenter', 'dragover'].forEach(t=> box.addEventListener(t, e=> cifDragged(S, box, e), sig));
  box.addEventListener('dragleave', e=>{ if (!box.contains(e.relatedTarget)) box.classList.remove('dragover'); }, sig);
  box.addEventListener('drop', e=> cifDropped(S, box, e), sig);
  S.$('CifInput').addEventListener('change', e=>{ const fl = [...e.target.files]; e.target.value = ''; if (fl.length) addCifs(S, fl); }, sig);
}
const withFiles = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
function cifDragged(S, box, e){
  if (!withFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = M.locked(S) ? 'none' : 'copy';
  box.classList.toggle('dragover', !M.locked(S));
}
function cifDropped(S, box, e){
  if (!withFiles(e)) return;
  e.preventDefault();
  box.classList.remove('dragover');
  const fl = [...e.dataTransfer.files];
  if (!M.locked(S) && fl.length) addCifs(S, fl);
}
/* A phase's CIF downloaded (its button left of its ×; up to v502 none): its text as the
   card read it, which is the file's in UTF-8 whatever its encoding (decodeText: a UTF-16
   file comes out in UTF-8, a UTF-8 one's mark dropped), under its file's name, else its
   name's; the built-in LaB6's as written here (LAB6_CIF). As bytes, as the file list gives
   a file's: as text (downloadBlob, typed CSV) the browser adds '.csv' to a name with no
   extension. Nothing changes: no step of the history, a run going on or not; the row is
   not selected. */
const cifFile = (S, q) => q === S.lab6 ? LAB6_FILE : q.file || fileSafe(q.prep.name || 'phase') + '.cif';
/* A row's menu (v585, utils.js wireRowMenu): its tick (the standard's: its choice), its
   download and its × in red, read off the row's own controls (locked while a run goes on, as
   they are: lockRows), named by its phase. */
function wirePhaseList(S){
  const sig = { signal: S.ac.signal }, el = S.$('PhaseList');
  el.addEventListener('click', e=> phaseClicked(S, e), sig);
  el.addEventListener('change', e=> phaseChanged(S, e), sig);
  wireRowMenu(el, { rows: '.rv-cif', ...ctlMenu('input, button'), signal: S.ac.signal,
    label: r =>{ const q = M.allPhases(S).find(x=> x.id === +r.dataset.sel); return q ? q.prep.name : ''; } });
}
function phaseClicked(S, e){
  const dl = e.target.closest('[data-dl]');
  if (dl){ const q = M.allPhases(S).find(x=> x.id === +dl.dataset.dl); if (q && typeof q.cif === 'string') downloadBytes(cifFile(S, q), new TextEncoder().encode(q.cif)); return; }
  const del = e.target.closest('[data-del]');
  if (del){
    if (M.locked(S) || del.disabled) return;
    M.dropPhase(S, +del.dataset.del);
    draw(S, true); renderSettings(S); S.host.commit();
    if (S.std) S.host.changed();
    return;
  }
  /* A tick or choice locked (lockRows): its click cancelled, which puts its state back,
     a click's, Space's or an arrow key's between the choices, and no change follows. */
  if (e.target.closest('input')){ if (M.locked(S)) e.preventDefault(); return; }
  const row = e.target.closest('[data-sel]');
  if (!row || +row.dataset.sel === S.sel) return;
  S.sel = +row.dataset.sel;
  renderPhases(S);
}
// A phase ticked or not for the pattern on show; the standard's chosen.
function phaseChanged(S, e){
  const t = e.target;
  if (M.locked(S)) return;
  if (t.dataset.pick != null){ S.pick = +t.dataset.pick; draw(S, true); S.host.commit(); return; }
  if (t.dataset.on != null){
    const q = S.phases.find(x=> x.id === +t.dataset.on), f = curFile(S);
    if (!q || !f) return;
    if (t.checked) delete q.off[f.name]; else setOwn(q.off, f.name, true);
    draw(S, true); S.host.commit();
  }
}
// Refine (Cancel while a run goes on or waits), Clear; a sample's card's Refine all, Clear
// all (every pattern's result, those of the files left out too: an undo brings them back),
// its arrows, its list of patterns (snav.js: any pattern, straight) and Instrumental
// standard…. (the standard is one pattern: its window has neither)
function wireButtons(S){
  S.$('Refine').onclick = ()=>{
    if (quickPress(S, true)) return;
    if (M.locked(S)){ cancel(S); return; }
    press(S, false);
  };
  S.$('Clear').onclick = ()=>{ const f = curFile(S); if (!f || M.locked(S) || !own(S.results, f.name)) return; delete S.results[f.name]; draw(S, true); S.host.commit(); if (S.std) S.host.changed(); };
  if (S.std) return;
  S.$('RefineAll').onclick = ()=>{ if (!quickPress(S) && !M.locked(S)) press(S, true); };
  S.$('ClearAll').onclick = ()=>{ if (M.locked(S) || !Object.keys(S.results).length) return; S.results = {}; draw(S, true); S.host.commit(); };
  S.$('Prev').onclick = ()=> S.host.step(-1);
  S.$('Next').onclick = ()=> S.host.step(1);
  S.$('Std').onclick = ()=> S.host.openStd();
  S.nav = snav(S.$('Prev').closest('.snav'), { count: ()=> S.host.files().length, index: ()=> curIdx(S), label: i=> S.host.files()[i].label, go: i=> S.host.step(i - curIdx(S)) });
}
