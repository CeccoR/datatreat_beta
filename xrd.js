import { esc, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, fileAlertHtml, notesHtml, fileLine, NOT_READ, bytesOf, nextColor, colorOf, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, registerBusy, busyChanged, registerModule, X_SVG } from './utils.js';
import { createRietveld, RV_INFO, RV_STD_INFO } from './xrd-rv.js';
import { createPeakAnalysis, PEAKS_INFO, STD_INFO } from './xrd-peaks.js';
import { readXrdmlScans, decodeXml } from './xrd-instr.js';
import { createDeck, cardInfo, fileSafe } from './cards.js';
import { isObj } from './modkit.js';
import * as M from './xrd-model.js';
import * as H from './xrd-html.js';
import { markSeen, inKeys } from './alerts.js';

/* =========================================================
   XRD MODULE
   The samples' files, and the instrumental standard's (one file, of its own: it is no
   sample); the analysis cards (cards.js), each a Scherrer analysis of the peaks
   (xrd-peaks.js) or a Rietveld refinement (xrd-rv.js), on the same samples, the sample
   on show shared by them all; and the standard's two windows, its peak analysis (the
   Caglioti fit that corrects the Scherrer sizes) and its Rietveld refinement (the
   instrumental profile every sample's refinement takes), each opened from its kind of
   card, both on the one standard's file.

   MADE PER TAB (v518): createXrd is the module's factory (utils.js registerModule), each
   open XRPD tab that is awake an instance of its own, made of its copy of index.html's
   section (root) and a layer for its windows (the standard's two, each card's
   settings, the kinds' menu). Its elements are found in root (or in the windows it
   made), never in the page: its ids are the page's only while it is on show, and a
   refinement going on while its tab is not on show writes into its own. Its registries
   go by its key, the tab's id. What it draws is drawn only on show: hidden, a run's
   results are written and drawn as the tab is shown again (its redraw, goTab). utils.js
   registerModule says how a module is made so.

   SPLIT (v563): what the host of the cards works out that touches no page (a file's scans
   made patterns and read again, a project restored and migrated, the cards' per-sample
   slots, what a run wrote patched into the history, the cards' states, what it shows) in
   xrd-model.js, its words and markup (the standard's windows, the alerts) in xrd-html.js,
   both tested in Node. Here the page: the instance's state (S), the drop, the file list,
   the standard's windows, the cards' panels (each a Scherrer card's or a Rietveld card's,
   made by xrd-peaks.js and xrd-rv.js as before), the runs, the history and their
   listeners. Each is a function at module level of S, not a closure inside createXrd (to
   v562 one of 488 lines): what a listener holds is what it is handed.
========================================================= */
// utils.js's and modkit.js's helpers the model takes (xrd-model.js U), with the page's
// reading of a file's bytes, and what the markup takes (xrd-html.js u).
const U = { isObj, colorOf, scansOf };
const HU = { esc, X_SVG, fileAlertHtml, fileLine };

/* A file read (readXrdmlScans, xrd-instr.js): 2θ, the intensities on the unattenuated
   scale (<intensities> as written, the raw <counts> of XRDML 2.x times the attenuation
   factors) and each point's variance, var(y) = y·varMul, for the counting uncertainty of
   the FWHMs and the Rietveld weights. A file it cannot read (wrong format, not
   well-formed, not a 2θ scan, dropped past the file picker's accept filter) gives the
   reason instead. rawBytes keeps the original bytes for byte-exact re-download; the text
   is decoded from them in the file's own encoding (UTF-16 too, which f.text() is not).
   The raw intensities are kept untouched (no minimum subtraction): the constant offset is
   absorbed by the SNIP background, so the whole pipeline — analysis and fit alike — runs
   on the true raw data and stays consistent with the CSVs.
   Every scan of the file is a pattern (xrd-model.js patternsOf); the caller gives each its
   colour. A file whose bytes cannot be read (gone from the disk) is refused with why
   (utils.js NOT_READ; to v566 the browser's own message). */
async function readFile(f){
  const rawBytes = await bytesOf(f);
  if (!rawBytes) return { error: NOT_READ };
  const xml = new DOMParser().parseFromString(decodeXml(rawBytes), 'text/xml');
  const scans = xml.getElementsByTagName('parsererror').length ? [{ error: 'not well-formed XML' }] : readXrdmlScans(xml);
  M.keepScans(rawBytes, scans);
  return M.patternsOf(f.name, rawBytes, scans, sampleName(xml));
}
// A file's bytes, of a project, read again (xrd-model.js readAgain): its scans, or why not.
function scansOf(b){
  const xml = new DOMParser().parseFromString(decodeXml(b), 'text/xml');
  return xml.getElementsByTagName('parsererror').length ? [{ error: 'not well-formed XML' }] : readXrdmlScans(xml);
}
/* The sample's name the file gives (XRDML: <sample>'s <name>, else its <id>), or '': the
   name its traces are loaded under (v532; to v531 the file's, which a file of none still
   gives). */
function sampleName(xml){
  const s = [...(xml.documentElement ? xml.documentElement.children : [])].find(e=> e.localName === 'sample');
  const t = k => { const e = s && [...s.children].find(c=> c.localName === k); return e ? e.textContent.trim() : ''; };
  return t('name') || t('id');
}

/* =========================================================
   THE INSTANCE: its state S, which every function below takes:
     key, root, layer, shown, $  its context (utils.js makeInstance: shown() whether its tab
                          is on show) and its elements by id, in root
     allFiles, files      every file loaded, in list order ({name, label, x[], y[], color}),
                          and the included ones, which the analysis sees: the per-file
                          arrays the cards keep are aligned with those
     curIdx               the sample every card shows
     stdFile              the instrumental standard's file, or none
     loadAlerts, leftOut, uploadAlerts   the alerts under the drop zone (utils.js FILE
                          ALERTS, in this order): the files refused (the last drop's), what
                          the reading of the files in the list said (xrd-html.js fileNotes:
                          to check, what a project opened found, how they were read; each
                          box's × marks its files seen, v572), with what a project opened
                          left out (its line), those already loaded (to v566 the caveats in
                          one box)
     peaksModal, rvModal  the standard's two windows ({ el, box, body }), and the one open
     openModal, onStdKey  (none: null), its Escape (a document listener while it is open)
     stdSaid              what the last drop on a window said ({ at: that window's element,
                          bad: its file refused, the box's markup; read: the files dropped
                          beside it, a line }), under that window's drop zone with what the
                          reading of the standard's file said (xrd-html.js stdNotes, in both
                          windows: v573, to v572 the drop's words)
     stdPeaks, stdRv      the standard's peak analysis and its Rietveld refinement
     live                 the cards' panels, by id: { inst, el }
     cardsNext, patNext, stdNext   what the cards of a tab woken or reloaded showed
                          (showNext), by id; the pattern on show, by its name; the
                          standard's two, its window's (its Scherrer's and its Rietveld's)
     resList              the Results' list, each card's section in it
     deck                 the cards (cards.js), made once their callbacks exist
     hist                 its history (utils.js registerHistory)
========================================================= */
// An XRPD tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createXrd(ctx){
  const S = makeState(ctx);
  // Delegated click handling for dynamically generated alert dismiss buttons.
  S.root.addEventListener('click', e=> onDismiss(S, e));
  setupDropzone(S.$('xrdDropzone'), S.$('xrdFiles'), fileList => onDrop(S, fileList));
  makeStd(S);
  registerBusy(S.key, busyOf(S));
  S.resList = S.$('xrdResList');
  S.deck = createDeck(deckHooks(S));
  // (the size charts' by sample / by peak, a Scherrer card's and a Rietveld card's: the view
  // alone, a step but no change unsaved; utils.js VIEW_KEYS)
  S.hist = registerHistory(S.key, ()=> snapshot(S), (s0, step)=> restore(S, s0, step), { view: ['sizeBy'] });
  registerTabRedraw(S.key, ()=> redrawTab(S));
  registerCsvExport(S.key, ()=> exportXrdZip(S));
  // A new project starts with a Scherrer card and a Rietveld one.
  S.deck.start(['scherrer', 'rietveld']);
  return apiOf(S);
}
function makeState({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  const S = { key, root, layer, shown, $, allFiles: [], files: [], curIdx: 0, stdFile: null, deck: null, loadAlerts: '', leftOut: '', uploadAlerts: '',
    peaksModal: null, rvModal: null, openModal: null, stdSaid: NO_SAID, stdPeaks: null, stdRv: null, live: new Map(), cardsNext: null, patNext: null, stdNext: null, resList: null, hist: null };
  S.onStdKey = e => onStdKey(S, e);
  return S;
}
/* ---- The instance (tabs.js) ---- */
function apiOf(S){
  return {
    /* Let go (its tab closed or put to sleep; a state read out for its CSVs): every run
       stopped as Cancel does (the patterns done kept in the state the tab parks first; a
       tab asleep was idle), every card's panel destroyed (their workers' jobs cancelled,
       their windows, 3D views and listeners let go), the standard's two, the deck's menu,
       the window's key listener. Its section and layer are the shell's to take out. */
    destroy(){ destroy(S); },
    /* What it shows beside its state (tabs.js, utils.js shownOf): the pattern on show,
       by its name, each card's own, by its id (a Scherrer card's peak picked; a Rietveld
       card's peak picked, its crystallites' turns, its phase on show and its cell's turn),
       and the standard's window's two alike (std), given back as its tab wakes or the page
       is reloaded, to the restore. The pattern on show is in its state too (curIdx, v517:
       an undo goes back to its step's, a project saved reopens on it), but a step is no
       change, and its record held the one before till the next (to v517 a reload showed it). */
    shows(){ return shows(S); },
    showNext(v){ const n = M.showNextIn(U, v); S.cardsNext = n.cards; S.patNext = n.pattern; S.stdNext = n.std; },
  };
}
function destroy(S){
  [...rvCards(S)].forEach(i=>{ try { i.cancel(false); } catch(e){} });
  try { S.stdRv.cancel(false); } catch(e){}
  closeStd(S);
  [...S.live.values()].forEach(e=>{ try { e.inst.destroy(); } catch(err){} });
  S.live.clear();
  [S.stdPeaks, S.stdRv].forEach(i=>{ try { i.destroy(); } catch(e){} });
  S.deck.destroy();
}
function shows(S){
  const out = {}, std = {};
  eachCard(S, (e, a)=>{ const v = e.inst.shows(); if (v) out[a.id] = v; });
  [['peaks', S.stdPeaks], ['rv', S.stdRv]].forEach(([k, i])=>{ const v = i.shows(); if (v) std[k] = v; });
  return M.showsOf(S.files[S.curIdx], out, std);
}
// What the reading of the files said (xrd-html.js fileNotes), the standard's what a project
// opened found in it too.
const fileNotes = S => H.fileNotes(S.allFiles, S.stdFile, M.keptScans, HU);
// What the reading of the standard's file said, in its windows (xrd-html.js stdNotes).
const stdNotes = S => H.stdNotes(S.stdFile, M.keptScans, HU);
// A box's ×: a drop's emptied; one of the notes', its files marked seen in the list, the
// standard and the history (alerts.js markSeen), a project opened's line with them.
function onDismiss(S, e){
  const btn = e.target.closest('[data-action]'), act = btn && S.root.contains(btn) ? btn.dataset.action : '';
  if (!act.startsWith('xrd-dismiss-')) return;
  const what = act.slice('xrd-dismiss-'.length);
  if (what === 'upload') S.uploadAlerts = '';
  else if (what === 'invalid') S.loadAlerts = '';
  else { markSeen(S.hist, fileNotes(S), what, { put: inKeys(['files', 'std']) }); if (what === 'opened') S.leftOut = ''; }
  rebuildXrdAlerts(S);
}
// Every alert of the files: under the samples' drop zone, and under the standard's windows'.
function rebuildXrdAlerts(S){
  S.$('xrdAlerts').innerHTML = S.loadAlerts + notesHtml(fileNotes(S), w=> 'xrd-dismiss-' + w, { opened: S.leftOut ? [S.leftOut] : [] }) + S.uploadAlerts;
  const notes = stdNotes(S), D = S.stdSaid;
  [S.peaksModal, S.rvModal].forEach(w=>{
    const at = w.el === D.at;
    w.el.querySelector('.xrd-std-alerts').innerHTML = (at ? D.bad : '') + notesHtml(notes, x=> 'xrd-std-dismiss-' + x, {}, { read: at && D.read ? [D.read] : [] });
  });
}

/* ---- The samples ---- */
const cards = S => S.deck ? S.deck.records : [];
const eachCard = (S, fn)=> cards(S).forEach(a=>{ const e = S.live.get(a.id); if (e) fn(e, a); });
// Every card's per-sample arrays (a Scherrer card's, and those it keeps while it is a
// Rietveld one), for the file list to keep aligned with the included files. A file left
// out holds its entries under the card's keys, the same whichever kind the card is, so
// they come back with it after a switch.
function slots(S){
  const out = [];
  cards(S).forEach(a=>{
    const e = S.live.get(a.id), key = 'A' + a.id;
    if (a.type === 'scherrer' && e) out.push(...e.inst.slots(key));
    const s = a.states.scherrer;
    if (a.type !== 'scherrer' && s) out.push(...M.keptSlots(key, s));
  });
  return out;
}
// The cards stay on the sample they showed when another is left out, taken in, removed or
// moved; the one on show removed, on the one now in its place (or the last, it was the
// last). Up to v484 a removal or a move kept the index: the cards showed another sample.
function stayOn(S, f){ const k = includedOf(S.allFiles).indexOf(f); if (k >= 0) S.curIdx = k; }
function fileCallbacks(S){
  return {
    onRemove(i){ const was = S.files[S.curIdx]; removeFileAt(S.allFiles, i, slots(S)); stayOn(S, was); afterFilesChange(S); },
    onReorder(from, to){ const was = S.files[S.curIdx]; moveFileTo(S.allFiles, from, to, slots(S)); stayOn(S, was); afterFilesChange(S); },
    onInclude(i, on){ const was = S.files[S.curIdx]; setIncluded(S.allFiles, i, on, slots(S)); stayOn(S, was); afterFilesChange(S); },
    onIncludeAll(on){ const was = S.files[S.curIdx]; S.allFiles.forEach((_, j)=> setIncluded(S.allFiles, j, on, slots(S))); stayOn(S, was); afterFilesChange(S); },
    onLabelChange(i, v){ S.allFiles[i].label=v; eachCard(S, e=> e.inst.redraw()); S.hist.commit(); },
    onColorChange(i, v){ S.allFiles[i].color=v; eachCard(S, e=> e.inst.redraw()); S.hist.commit(); },
    onPaletteChange(colors){ S.allFiles.forEach((f,i)=>{ f.color=colors[i%colors.length]; }); afterFilesChange(S); },
    onRemoveAll(){ removeAll(S); },
  };
}
function removeAll(S){
  S.allFiles.length=0;
  cards(S).forEach(a=>{ const e = S.live.get(a.id); if (a.type === 'scherrer' && e) e.inst.clear(); const s = a.states.scherrer; if (a.type !== 'scherrer' && s){ s.perParams = []; s.manualPeaks = []; s.removedPeaks = []; if (Array.isArray(s.cif)){ s.cif = []; delete s.cifTexts; } } });
  S.loadAlerts = ''; S.leftOut = ''; S.uploadAlerts = ''; afterFilesChange(S);
}

/* Files dropped. Each file on its own: one that cannot be read at all (its bytes gone from
   the disk, anything thrown) is refused with why, the others loaded. Up to v484 a throw
   ended the batch: the files read before it were in the list, unseen, no card drawn. What
   the drop says (xrd-html.js dropAlerts) replaces what the last one said; what the reading
   of the files said is the files' (fileNotes). */
async function onDrop(S, fileList){
  // (by the patterns' names: a file of several scans is tested scan by scan, below)
  const existing = new Set(S.allFiles.map(f=> f.name));
  const alreadyLoaded = [], invalidFiles = [];
  for (const f of fileList){
    if (existing.has(f.name)){ alreadyLoaded.push(esc(f.name)); continue; }
    let r;
    try { r = await readFile(f); } catch (e){ r = { error: `could not be read: ${e && e.message || e}` }; }
    if (r.error){ invalidFiles.push(esc(fileLine(f.name, r.error))); continue; }
    // A scan whose name is in the list stays as it is (xrd-model.js freshOf), the others
    // load; every scan there, the file is already loaded.
    const fresh = M.freshOf(r, existing);
    if (!fresh.length){ alreadyLoaded.push(esc(f.name)); continue; }
    existing.add(f.name);
    for (const q of r.pats) if (!fresh.includes(q)) alreadyLoaded.push(esc(q.f.name));
    for (const q of fresh) addPattern(S, q.f, existing);
  }
  const A = H.dropAlerts(invalidFiles, alreadyLoaded, HU);
  S.loadAlerts = A.load; S.uploadAlerts = A.upload;
  afterFilesChange(S);
}
// A pattern loaded: its colour and its entry in every card's per-sample arrays. A new file
// comes in included, so it goes last among the included as well.
function addPattern(S, p, existing){
  p.color = nextColor(S.allFiles);
  existing.add(p.name);
  S.allFiles.push(p); S.files.push(p);
  cards(S).forEach(a=>{
    const e = S.live.get(a.id);
    if (a.type === 'scherrer' && e) e.inst.addFile();
    const s = a.states.scherrer;
    if (a.type !== 'scherrer' && s){ s.perParams.push({...s.shared}); s.manualPeaks.push([]); s.removedPeaks.push([]); if (Array.isArray(s.cif)) s.cif.push(null); }
  });
}

// (the alerts too: what the reading of the files said is theirs, v572)
function afterFilesChange(S){
  S.files = includedOf(S.allFiles);
  setTabLoaded(S.key, S.allFiles.length || S.stdFile ? 1 : 0);
  renderUnifiedFileList(S.$('xrdFileTableWrap'), S.allFiles, fileCallbacks(S));
  rebuildXrdAlerts(S);
  if (S.curIdx >= S.files.length) S.curIdx = Math.max(0, S.files.length-1);
  S.$('xrdAnalyses').style.display = S.files.length ? 'block' : 'none';
  syncResults(S);
  eachCard(S, e=> e.inst.refresh());
  S.hist.commit(); // baseline + file add/remove/reorder/palette
}
// The sample on show, stepped by any card's arrows, for every card.
function step(S, d){
  const n = S.files.length;
  if (!n) return;
  S.curIdx = (S.curIdx + d + n) % n;
  eachCard(S, (e, a)=> a.type === 'scherrer' ? e.inst.show() : e.inst.redraw());
}

/* ---- The instrumental standard: one file, in two windows ---- */
const stdFiles = S => S.stdFile ? [S.stdFile] : [];
function makeStd(S){
  S.peaksModal = stdModal(S, 'xrdStdPeaks', 'Instrumental standard', STD_INFO);
  S.rvModal = stdModal(S, 'xrdStdRv', 'Instrumental standard: Rietveld', RV_STD_INFO);
  S.openModal = null;
  S.stdPeaks = createPeakAnalysis(stdPeaksHost(S), S.peaksModal.body, { prefix: 'xrdStdA', standard: true });
  S.stdRv = createRietveld(stdRvHost(S), S.rvModal.body, { prefix: 'xrdStdR', standard: true });
  S.stdRv.setName('standard');
}
// The standard's peak analysis's host (xrd-peaks.js host).
function stdPeaksHost(S){
  return {
    files: ()=> stdFiles(S), idx: ()=> 0, step: ()=>{}, commit: ()=> S.hist.commit(), instr: ()=> null,
    // The standard's peaks are the samples' correction: every Scherrer card follows.
    changed: ()=> eachCard(S, (e, a)=>{ if (a.type === 'scherrer') e.inst.sizesChanged(); }),
    hidden: ()=> S.openModal !== S.peaksModal || !S.shown(),
  };
}
// The standard's Rietveld refinement's host (xrd-rv.js host).
function stdRvHost(S){
  const files = ()=> stdFiles(S);
  return {
    files, allFiles: files, idx: ()=> 0, step: ()=>{}, commit: ()=> S.hist.commit(),
    // Refined again or cleared: the samples' results say whether theirs rest on it.
    changed: ()=> eachCard(S, (e, a)=>{ if (a.type === 'rietveld') e.inst.redraw(); }),
    hidden: ()=> S.openModal !== S.rvModal, unseen: ()=> !S.shown(), layer: S.layer,
    blocked: ()=> rvCards(S).some(i=> i.running()) ? 'A sample refinement is running: the standard can be refined once it ends (a batch takes one instrumental profile throughout).' : '',
    onBusy: ()=> syncRv(S), ...holder(S, null),
    // (its run's progress on every Rietveld card's Instrumental standard…)
    onProgress: ()=> rvCards(S).forEach(i=> i.syncStd()),
  };
}
function stdModal(S, id, title, info){
  const m = document.createElement('div');
  m.id = id;
  m.className = 'modal-backdrop xrd-std-modal';
  m.style.display = 'none';
  m.innerHTML = H.stdModalHtml(id, title, info, HU);
  S.layer.appendChild(m);
  const box = m.querySelector('.xrd-std-box'), info0 = m.querySelector('.instr-info'), instr = m.querySelector('.xrd-std-instr');
  info0.addEventListener('click', ()=> toggleInstr(info0, instr));
  m.addEventListener('click', e=>{ if (e.target === m) closeStd(S); });
  m.querySelector('.xrd-std-x').onclick = ()=> closeStd(S);
  m.querySelector('.xrd-std-file').addEventListener('click', e=>{ if (e.target.closest('[data-std-del]')) setStd(S, null); });
  m.querySelector('.xrd-std-alerts').addEventListener('click', e=> onStdDismiss(S, e));
  setupDropzone(m.querySelector('#' + id + 'Dz'), m.querySelector('#' + id + 'Files'), fl => onStdDrop(S, m, fl));
  return { el: m, box, body: m.querySelector('.xrd-std-body') };
}
function toggleInstr(info0, instr){
  const open = instr.style.display === 'none';
  instr.style.display = open ? '' : 'none';
  info0.classList.toggle('is-on', open);
  info0.setAttribute('aria-expanded', String(open));
}
// One file: of several dropped, the first; it replaces the one loaded. One pattern: of a
// file of several scans, the first that can be read. What the drop said replaces what the
// last said, a drop that loads nothing too (utils.js FILE ALERTS).
async function onStdDrop(S, m, fl){
  const f = fl[0];
  if (!f) return;
  let r;
  try { r = await readFile(f); } catch (e){ r = { error: `could not be read: ${e && e.message || e}` }; }
  if (r.error){ S.stdSaid = { at: m, bad: fileAlertHtml('bad', [esc(fileLine(f.name, r.error))], 'xrd-std-dismiss-bad'), read: '' }; rebuildXrdAlerts(S); return; }
  const p = r.pats[0].f;
  p.color = '#d4a72c';
  setStd(S, p);
  // (after setStd, which lets the last drop's words go: these are the new file's)
  S.stdSaid = { at: m, bad: '', read: H.stdDropLine(fl.length, f.name, HU) };
  rebuildXrdAlerts(S);
}
// A box's × in a window: the drop's refusal let go; one of the notes', the standard marked
// seen in its record and the history (alerts.js markSeen), the drop's line of its box with it.
function onStdDismiss(S, e){
  const btn = e.target.closest('[data-action^="xrd-std-dismiss-"]');
  if (!btn) return;
  const what = btn.dataset.action.slice('xrd-std-dismiss-'.length);
  if (what === 'bad') S.stdSaid = { ...S.stdSaid, bad: '' };
  else { markSeen(S.hist, stdNotes(S), what, { put: inKeys(['std']) }); if (what === 'read') S.stdSaid = { ...S.stdSaid, read: '' }; }
  rebuildXrdAlerts(S);
}
// The standard's file in both windows (xrd-html.js stdFileHtml).
function syncStdFile(S){
  [S.peaksModal, S.rvModal].forEach(w=>{
    w.el.querySelector('.xrd-std-file').innerHTML = H.stdFileHtml(S.stdFile, HU);
  });
}
// What the last drop on a window said goes with the standard, replaced or removed, and on
// a restore (up to v484 it stayed, on another standard, on none, in another project); what
// the reading of the standard's file said is the file's (stdNotes, rebuildXrdAlerts).
const NO_SAID = { at: null, bad: '', read: '' };
function setStd(S, f){
  S.stdFile = f;
  S.stdSaid = NO_SAID;
  S.stdPeaks.resetFile();
  syncStdFile(S);
  S.stdPeaks.refresh();
  S.stdRv.refresh();
  // Every card takes the standard's correction (or loses it); what a project opened found in
  // the standard it had goes with it.
  eachCard(S, (e, a)=> a.type === 'scherrer' ? e.inst.sizesChanged() : e.inst.redraw());
  setTabLoaded(S.key, S.allFiles.length || S.stdFile ? 1 : 0);
  rebuildXrdAlerts(S);
  S.hist.commit();
}
function openStd(S, which){
  const w = which === 'rv' ? S.rvModal : S.peaksModal;
  if (S.openModal === w) return;
  if (S.openModal) closeStd(S);
  S.openModal = w;
  w.el.style.display = 'flex';
  document.addEventListener('keydown', S.onStdKey);
  // Drawn as it opens: closed, nothing in it was laid out.
  if (which === 'rv') S.stdRv.refresh(); else S.stdPeaks.refresh();
  w.box.focus({ preventScroll: true });
}
// Closed, the standard's peak analysis leaves a peak being placed (to v499 on until a key).
function closeStd(S){
  if (!S.openModal) return;
  if (S.openModal === S.peaksModal) S.stdPeaks.disarm();
  S.openModal.el.style.display = 'none';
  S.openModal = null;
  document.removeEventListener('keydown', S.onStdKey);
}
// (its tab on show: an Escape in another tab is that tab's)
function onStdKey(S, e){ if (e.key === 'Escape' && S.shown()) closeStd(S); }

/* ---- The refinements running: the samples' (each Rietveld card's) and the standard's ----
   A run belongs to its tab: closing the tab asks first (tabs.js), and stop ends every
   run as Cancel does (registerBusy). A sample and the standard never refine at once
   (host.blocked): a batch takes one instrumental profile. Each run holds the history (host.hold, UndoStack.hold) from the state on show as it
   starts (a sample's, as it starts waiting for the standard's run): undo goes no lower
   while it runs, silently, and above it goes as ever, the running card's panel kept as it
   is (xrd-rv.js restore). As it ends (finished, stopped, failed, its card closed or
   switched) the patterns it wrote go into the states saved meanwhile and, as a step of
   their own, after the one it started from (xrd-model.js runPatch): undoing a step taken
   meanwhile keeps them. Up to v508 undo and redo waited for every run to end. */
// (the Rietveld cards' panels)
const rvCards = S => [...S.live.values()].map(e=> e.inst).filter(i=> i.running);
// A run started or ended: every Rietveld panel's buttons follow.
function syncRv(S){
  rvCards(S).forEach(i=> i.sync());
  S.stdRv.sync();
  // (the tab's time hidden, for its sleep, counted from a job's end: tabs.js)
  busyChanged(S.key);
}
function busyOf(S){
  return {
    busy: ()=> rvCards(S).some(i=> i.running()) ? 'A Rietveld refinement' : S.stdRv.running() ? 'The standard\'s refinement' : null,
    // (the samples first: one waiting for the standard's run stops with it)
    stop: ()=>{ rvCards(S).forEach(i=> i.cancel()); S.stdRv.cancel(); },
  };
}
// A run's host: its mark in the history, and its release with what it wrote (a card's, by
// its id; the standard's, none). A run that wrote nothing leaves the history as it was.
function holder(S, id){
  return { hold: ()=> S.hist.hold(), release: (h, wrote, quiet)=> S.hist.release(h, wrote && Object.keys(wrote).length ? M.runPatch(U, id, wrote, S.allFiles, stdFiles(S)) : null, quiet) };
}

/* ---- The cards (cards.js) ---- */
// What the deck is given (cards.js o).
function deckHooks(S){
  return {
    list: S.$('xrdAnalyses'), addBar: S.$('xrdAddBar'), addBtn: S.$('xrdAddAn'), layer: S.layer,
    kinds: M.KINDS, info: t=> (t === 'scherrer' ? PEAKS_INFO : RV_INFO) + ' ' + cardInfo(true, true),
    body: ()=> '<div class="xrd-card"></div>', make: ()=> ({ states: {} }),
    build: (a, card, prev)=> buildCard(S, a, card, prev), drop: a => dropCard(S, a), autoName: a=> M.KINDS[a.type], named: a => named(S, a),
    changed: ()=>{ placeRes(S); syncResults(S); }, loaded: ()=>{ placeRes(S); syncResults(S); },
    added: a=>{ if (S.files.length) S.live.get(a.id).inst.refresh(); },
    switched: a=>{ if (S.files.length) S.live.get(a.id).inst.refresh(); },
    wake: a=>{ if (S.files.length) S.live.get(a.id).inst.redraw(); },
    // (a Scherrer card folded: its + Add peak left)
    folded: a=>{ const e = S.live.get(a.id); if (e && e.inst.disarm) e.inst.disarm(); },
    commit: ()=> S.hist.commit(),
  };
}
// The card's panel: made on the samples, with the settings its kind had (a.states),
// the one it leaves kept for a switch back.
function buildCard(S, a, card, prev){
  const was = S.live.get(a.id);
  // (a run going on stops first, as Cancel: the patterns done go with the kind's settings
  // kept; up to v477 it went on unseen, its results lost)
  if (prev && was){ if (was.inst.cancel) was.inst.cancel(false); a.states[prev] = was.inst.snapshot(); was.inst.destroy(); if (was.inst.res) was.inst.res.remove(); }
  const el = card.querySelector('.xrd-card');
  const inst = a.type === 'scherrer' ? createPeakAnalysis(cardHost(S, a, el), el, { prefix: M.prefixOf(a) }) : createRietveld(cardHost(S, a, el), el, { prefix: M.prefixOf(a) });
  if (a.states[a.type]) inst.restore(a.states[a.type]);
  else if (a.type === 'scherrer') inst.restore({});
  S.live.set(a.id, { inst, el });
  placeRes(S);
}
/* The tab's CIFs (v575), for the Scherrer cards' samples: every Rietveld card's phases' and
   every Scherrer card's samples', in the cards' order (xrd-peaks-model.js cifPool takes each
   once); and each Scherrer card's selector made again, as a step committed may have changed
   them (a phase added or removed, a sample's CIF chosen). */
function cifPool(S){
  const out = [];
  eachCard(S, e=> out.push(...e.inst.cifs()));
  return out;
}
const syncCifs = S => eachCard(S, (e, a)=>{ if (a.type === 'scherrer') e.inst.syncCifs(); });
// A card's panel's host (xrd-peaks.js's and xrd-rv.js's host).
function cardHost(S, a, el){
  return { files: ()=> S.files, allFiles: ()=> S.allFiles, idx: ()=> S.curIdx, step: d => step(S, d), commit: ()=>{ S.hist.commit(); syncCifs(S); }, cifs: ()=> cifPool(S),
    instr: ()=> S.stdPeaks.instrModel(), irf: ()=> S.stdRv.irf(), hidden: ()=> S.deck.isFolded(a) || !S.shown(),
    // (its tab not on show: nothing drawn, the tab's redraw draws it as it is shown; the
    // card still the one of its deck, not closed)
    unseen: ()=> !S.shown(), layer: S.layer, placed: ()=> !!S.live.get(a.id) && S.live.get(a.id).el === el,
    openStd: ()=> openStd(S, a.type === 'rietveld' ? 'rv' : 'peaks'),
    stdLoaded: ()=> !!S.stdFile, refineStd: tell=> S.stdRv.run(tell), stopStd: commit=> S.stdRv.cancel(commit), stdRun: ()=> S.stdRv.progress(),
    blocked: ()=> S.stdRv.running() ? 'The standard is being refined: the samples can be refined once it ends (a batch takes one instrumental profile throughout).' : '',
    onBusy: ()=> syncRv(S), ...holder(S, a.id),
    changed: ()=>{} };
}
function dropCard(S, a){
  const e = S.live.get(a.id);
  if (!e) return;
  S.live.delete(a.id);
  e.inst.destroy();
  if (e.inst.res) e.inst.res.remove();
  syncResults(S);
}
const placeRes = S => eachCard(S, e=>{ if (e.inst.res) S.resList.appendChild(e.inst.res); });
// The Results: each card's section (a Scherrer card's, a Rietveld card's), under its
// name, in card order; the card is there while one is.
function syncResults(S){
  const on = cards(S).filter(a=> S.live.has(a.id) && S.live.get(a.id).inst.res);
  S.$('xrdResults').style.display = S.files.length && on.length ? 'block' : 'none';
  on.forEach((a, i)=> S.live.get(a.id).inst.res.classList.toggle('is-first', i === 0));
}
function named(S, a){
  const e = S.live.get(a.id);
  if (!e) return;
  e.inst.setName(fileSafe(a.name));
  if (e.inst.res) e.inst.res.querySelector('.res-an-title').textContent = a.name;
}

/* ---- Undo/redo: snapshot the reversible state. Raw patterns (x/y) are shared by
   reference; the cards' settings, peaks and results, the standard's and the files'
   order, labels and colours are captured so any change can be stepped back. ---- */
function snapshot(S){
  const s = {
    v: 2,
    files: S.allFiles.map(f=>({...f})),
    std: S.stdFile ? {...S.stdFile} : null,
    stdPeaks: S.stdPeaks.snapshot(), stdRv: S.stdRv.snapshot(),
    curIdx: S.curIdx,
    cards: cards(S).map(a=>{
      const states = M.otherStates(a);
      states[a.type] = S.live.get(a.id).inst.snapshot();
      return { ...S.deck.saved(a), states };
    }),
  };
  // (a file left out holding a sample's CIF: its text in its card's pool, v577)
  M.heldOut(U, s.files, s.cards);
  return s;
}
// step: an undo or a redo (UndoStack), which a run going on keeps its own panel through
// (xrd-rv.js restore). (xrd-model.js: the state migrated, its files read again, the
// sample on show, the cards' records.)
function restore(S, s0, step){
  const s = M.stateIn(U, s0), R = M.readsOf(U, s);
  S.allFiles = R.reads.filter(Boolean);
  S.files = includedOf(S.allFiles);
  S.stdFile = R.stdRead;
  S.curIdx = M.curIdxOf(s, R.gone, S.files.length);
  // (a wake's or a reload's: the pattern its tab showed, by its name, over the record's state,
  // which a step writes no sooner than the next change: showNext)
  if (S.patNext != null){ const k = S.files.findIndex(f=> f.name === S.patNext); if (k >= 0) S.curIdx = k; S.patNext = null; }
  restoreStd(S, s, step);
  S.deck.load(M.cardsIn(U, s), src=> M.cardIn(U, src, R.gone), a=> S.live.get(a.id).inst.restore(a.states[a.type] || {}, step));
  // (what its cards showed, given as its tab woke or the page was reloaded: showNext)
  if (S.cardsNext){ const v = S.cardsNext; S.cardsNext = null; eachCard(S, (e, a)=>{ if (isObj(v[a.id])) e.inst.showNext(v[a.id]); }); }
  S.stdSaid = NO_SAID;
  syncStdFile(S);
  S.stdPeaks.refresh();
  S.stdRv.refresh();
  // A drop's alerts are the drop's, not the state's (nor another tab's); what the reading of
  // the files said is theirs, as a project opened left out is the restore's.
  S.loadAlerts = ''; S.uploadAlerts = '';
  S.leftOut = H.leftOutLine(R.lost, !!s.std, R.stdRead, HU);
  afterFilesChange(S);
}
function restoreStd(S, s, step){
  S.stdPeaks.restore(isObj(s.stdPeaks) ? s.stdPeaks : {});
  S.stdRv.restore(isObj(s.stdRv) ? s.stdRv : {}, step);
  if (S.stdNext){ const v = S.stdNext; S.stdNext = null; if (isObj(v.peaks)) S.stdPeaks.showNext(v.peaks); if (isObj(v.rv)) S.stdRv.showNext(v.rv); }
}

function redrawTab(S){
  S.deck.fitNames();
  if (S.files.length) eachCard(S, (e, a)=>{ if (!S.deck.isFolded(a)) e.inst.redraw(); });
  if (S.openModal === S.peaksModal) S.stdPeaks.redraw();
  if (S.openModal === S.rvModal) S.stdRv.redraw();
}
// The CSVs: every card's, named after it, and the standard's.
function exportXrdZip(S){
  const out = [];
  eachCard(S, (e, a)=> out.push(...e.inst.csvEntries(fileSafe(a.name) + ' - ')));
  out.push(...S.stdPeaks.csvEntries(''), ...S.stdRv.csvEntries('standard - '));
  return out;
}

registerModule('xrd', createXrd);
