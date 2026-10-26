/* =========================================================
   OPEN PROJECT TABS
   The nav shows Home, a separator, then one tab per OPEN PROJECT — Chrome/MATLAB
   style. A tab is a project, and its technique is just the page it shows, so any
   number of projects can be open at once, several on the same technique.

   Every module is made per tab (utils.js registerModule, v518): each tab awake has an
   instance of its own — its elements, state, undo history and view — so its tabs are
   independent and live in one page: a switch only takes one instance's section out of
   the page and puts another's in (its ids then the page's), and a job going on in a tab
   left (a refinement) goes on there, hidden. A tab not on show for settings.sleepMin
   minutes SLEEPS: its instance is let go, its state and its whole undo history parked
   in the tab, the tab staying in the bar; shown again it WAKES, a new instance made of
   what was parked. Till then a tab hidden stays as it was left. A tab busy (a job going
   on) never sleeps: its time hidden is counted from the job's end. Any number of tabs may
   be open (to v517 at most 20); at most settings.awakeMax are awake, the one on show
   among them: beyond, the one shown least lately sleeps, whenever it was opened. A tab of
   SEM (utils.js dropsBytes) asleep lets go of its files' bytes too, which the store holds
   by their hashes: read back as it wakes, the loader on show meanwhile (lighten,
   wakeLater). The tab bar repaints first and the tab is put in the page a paint later, so
   the click feels immediate even when a wake or a redraw takes a moment.
========================================================= */
import { MODULES, MODULE_LABELS, goTab, getModuleState, restoreModuleState,
         getModuleHistory, setModuleHistory, confirmBanner, moduleHasData, X_SVG,
         onSectionChange, moduleBusy, stopModule, makeInstance, attachInstance,
         detachInstance, dropKey, settings, saveSettings, onBusyChange, onAnyChange, dropsBytes, asleep, vacate, shownOf, showAgain } from './utils.js';
import { allTabStates, putTabRec, deleteTabRec, uid, encode, park, decode, unload, load, unread, refsIn } from './db.js';

const UNTITLED = 'Untitled project';

/* A module's default state: a new tab restores it, so it starts with empty files and
   default parameters. Taken from the first instance made of the module (wakeTab), or from
   one made for that purpose (defaultState, for isEmpty). */
const DEFAULT_STATE = {};
function defaultState(mod){
  if (!(mod in DEFAULT_STATE)){
    const inst = makeInstance(mod, 'default-' + mod);
    try { DEFAULT_STATE[mod] = encode(getModuleState(inst.key)); }
    finally { try { inst.destroy(); } catch(e){} dropKey(inst.key); }
  }
  return DEFAULT_STATE[mod];
}

/* A tab: { id, module, title, projectId, dirty, state, hist, inst, hidAt, seenAt, view, changed, order, rec, shows }
   `state` / `hist` are only meaningful while the tab is NOT live — a live tab's state is
   its instance's (`inst`). `state` is
   park's form (db.js): its files' bytes the module's own arrays, read back from the store
   before a tab is made of a record (v517), or, a tab asleep of a module that lets go of
   them (SEM), references to them by hash, read as it wakes (lighten). `hidAt`: when an
   awake tab was last left (its time hidden, for its sleep; a busy one's moved on to its
   job's end), 0 while it is on show; `seenAt`: when it was last on show (the tabs awake
   past the limit, the least lately first); `waking`, the read of a wake going on ({ st,
   h, p }: wakeLater); `view`, the window its plots were drawn at as it was left (null while
   on show, '' woken behind a fixed section: drawn at none), and `changed`, its history
   changed since (a job's results): an awake tab to draw again as it is shown (redrawn).
   `order`, its place in the bar as its record keeps it (persistMoved); `rec`, what its
   record holds of its place and of its being on show ({ order, active }: as last written,
   or read; null, to be written), and `recShows` of what it shows (JSON); `shows`, what a
   tab asleep showed beside its state (showsOf), given to the instance that wakes it. */
const TABS = [];
let _activeId = null;      // the tab on show (or that a fixed section came over)
let _onFixed = true;       // a fixed section (home / projects / settings) is showing
let _toFixed = 0;          // the fixed sections put on show so far (showLater)
let _restoring = false;    // true while replaying persisted tabs at startup

const tabById = id => TABS.find(t=> t.id === id) || null;
const activeTab = ()=> tabById(_activeId);
const tabIndex = id => TABS.findIndex(t=> t.id === id);
const tabByProject = pid => (pid ? TABS.find(t=> t.projectId === pid) || null : null);
const isRestoring = ()=> _restoring;
// A tab awake: its instance, keyed in the registries (utils.js) by the tab's id.
const isLive = t => !!t && !!t.inst;
// The tab whose instance holds this element (a plot's, for the figure composer), or the
// tab on show.
function tabOf(node){
  return (node && TABS.find(t=> t.inst && (t.inst.root.contains(node) || t.inst.layer.contains(node)))) || activeTab();
}

/* ---- Naming ---------------------------------------------------------------
   New tabs are called "Untitled project", numbered per technique so three new GC
   tabs don't all carry the same label. The save-time clash check against stored
   projects is unaffected — this only keeps the open tabs distinguishable. */
function untitledName(module){
  const taken = new Set(TABS.filter(t=> t.module===module).map(t=> t.title));
  if (!taken.has(UNTITLED)) return UNTITLED;
  for (let n=2; ; n++){ const c = UNTITLED+' '+n; if (!taken.has(c)) return c; }
}

/* ---- Persistence ----------------------------------------------------------
   Every open tab is stored, saved or not: on the next load the app comes back
   with the same tabs and the same unsaved work. A tab awake comes back asleep, woken
   when it is shown (the one on show at once). A record is written when what it holds
   changes, and only then: its state (the autosave), its name, its mark, its being
   on show (a switch, a close), its place (a move), what it shows (showsOf). The bar's
   order is each record's `order`, a number of its own that the tabs after it in the bar
   exceed: a tab closed leaves a gap, which sorts as before, a tab opened comes after the
   last, one moved takes a number between its new neighbours'; so a close or a move writes
   one record, not every one (to v517 every tab's again, its place in the bar its index). */
// A tab's state as park gives it: its instance's while it is awake, else the one parked
// (a tab asleep, or chosen and not woken yet: loadTabIfActive).
const stateOf = t => isLive(t) ? park(getModuleState(t.id)) : t.state;
/* What a tab shows beside its state (utils.js shownOf), no step of its history: awake,
   its instance's (its plots' zooms, instructions shown, lists' scroll, and its module's own,
   inst.shows(): `own`); asleep, what it showed as it slept, or as its record holds it. */
function showsOf(t){
  if (!t.inst) return t.shows || null;
  const v = shownOf(t.inst);
  try { const own = t.inst.shows ? t.inst.shows() : null; if (own != null) v.own = own; } catch(e){}
  return Object.keys(v).length ? v : null;
}
function tabRec(t){
  return { id:t.id, module:t.module, title:t.title, projectId:t.projectId || null,
           dirty:!!t.dirty, order: t.order, active: t.id===_activeId,
           state: stateOf(t), shows: showsOf(t), updatedAt: Date.now() };
}
// (a tab asleep whose files' bytes are let go: its record holds its history's too, lighten)
const heldOf = t => !isLive(t) && t.hist && dropsBytes(t.module) ? t.hist.states : null;
/* A tab's record written as it is now; its place and its being on show kept as written
   (rec), or forgotten should the write fail, for the next step to write it again. */
function writeRec(t, also){
  const rec = tabRec(t), r = t.rec = { order: rec.order, active: rec.active };
  t.recShows = JSON.stringify(rec.shows);
  return putTabRec(rec, also).catch(e=>{ if (t.rec === r){ t.rec = null; t.recShows = null; } throw e; });
}
function persistTab(t){
  if (_restoring || !t || !tabById(t.id)) return;
  try { writeRec(t, heldOf(t)).catch(()=>{}); } catch(e){}
}
/* The records whose place or being on show changed since they were written (a close, a
   move, a reload, the tabs opened while the records were read), or whose write failed:
   those alone written, the others holding what they held. `views`: those whose view
   changed too (the database closing for another window's upgrade: its last write). */
function persistMoved(views){
  if (_restoring) return;
  TABS.forEach(t=>{ const r = t.rec; if (!r || r.order !== t.order || r.active !== (t.id === _activeId) || (views && JSON.stringify(showsOf(t)) !== t.recShows)) persistTab(t); });
}
// The order a tab opened last takes: past the last tab's (0, the first).
const nextOrder = ()=> TABS.length ? TABS[TABS.length - 1].order + 1 : 0;
/* What the tab on show shows may have changed (a pointer let go, a key, the wheel, a list
   scrolled: a zoom, a sample stepped, a peak picked): looked at a while after the first such
   event, as the autosave's trailing write (sessions.js), its record written if it differs
   from what that holds; meanwhile any write of the record takes it (a switch, the autosave,
   the page hidden). Neither a step of its history nor a change unsaved. */
const SHOWS_MS = 5000;
function viewMoved(){
  const t = activeTab();
  if (!t || _onFixed || !t.inst || t.showsT || _restoring) return;
  t.showsT = setTimeout(()=>{
    t.showsT = 0;
    if (tabById(t.id) && JSON.stringify(showsOf(t)) !== t.recShows) persistTab(t);
  }, SHOWS_MS);
}
['pointerup', 'keyup', 'wheel', 'scroll'].forEach(ev=> document.addEventListener(ev, viewMoved, { capture: true, passive: true }));
/* The page going (a reload, the window closed): what each tab shows that its record does not
   hold yet, kept at once in this window's sessionStorage (a record's write is not done before
   the page is: an IndexedDB write waits on its files' hashes), for this window's next load,
   which takes it over its record's and writes the record (initTabs). Another window has its
   own. */
const SHOWS_KEY = 'datatreat-shows';
let _went = null;    // (what the last load took from it, till the restore has written it)
window.addEventListener('pagehide', ()=>{
  if (_restoring){ try { if (_went) window.sessionStorage.setItem(SHOWS_KEY, JSON.stringify(_went)); } catch(e){} return; }
  const out = {};
  TABS.forEach(t=>{ const v = showsOf(t); if (JSON.stringify(v) !== t.recShows) out[t.id] = v; });
  try { if (Object.keys(out).length) window.sessionStorage.setItem(SHOWS_KEY, JSON.stringify(out)); else window.sessionStorage.removeItem(SHOWS_KEY); } catch(e){}
});
// (the page come back as it was, from the browser's back-forward cache: nothing read again)
window.addEventListener('pageshow', e=>{ if (e.persisted) try { window.sessionStorage.removeItem(SHOWS_KEY); } catch(e2){} });

/* ---- A tab's instance: shown, hidden, asleep, awake ------------------------ */
// The tab's state could not be read: its instance empty, and a banner says so.
function damaged(t, e){
  console.warn('DataTreat: “' + t.title + '” could not be restored:', e);
  confirmBanner('“' + t.title + '” could not be opened: its ' + (MODULE_LABELS[t.module]||t.module)
    + ' project is damaged. The tab shows an empty module; what is saved stays as it is unless you save over it.', 'OK');
}
// A tab asleep woken (wakeTab). (a promise where the wake waits for the files' bytes:
// wakeLater; a fixed section on show stays, the tab woken behind it)
function loadTab(t){
  if (!isLive(t)) return wakeTab(t, _onFixed);
}
/* The tab's instance in the page, on show (the tab is the active one), in its module's
   place: the instance of that module there before taken out at once (utils.js
   attachInstance). An instance stays in the page while another module's tab shows,
   hidden, until another of its module comes in or it sleeps. */
function showTab(t, stay){
  if (t.inst){
    attachInstance(t.inst);
    t.hidAt = 0;
    t.view = stay ? '' : null; t.changed = false;
  }
  // (stay: put in the page, a fixed section left on show: a wake done meanwhile, its plots
  // drawn as it is shown)
  if (!stay) goTab(t.module);
}
/* The tab left: its time hidden counted from now, and its last show now; the window it was
   left at, where it was on show till now (its view null) and its plots followed the window.
   One not on show since it was last left keeps the window it was drawn at: left before for a
   fixed section (onSectionChange), or chosen and left again before its show two frames on
   (showLater), or woken behind a fixed section. */
function hideTab(t){
  if (t && t.inst){ t.hidAt = t.seenAt = Date.now(); if (t.view == null) t.view = viewNow(); }
}
/* An awake tab shown again draws what changed while it was hidden (its redraw, two frames
   after its show: utils.js goTab): nothing, shown at the size it was left at and unchanged
   (its draw keys: a few ms); all its plots at another size of the window or zoom (an XRPD
   tab of 12 refined patterns 0.15 s, a DRS tab of 10 spectra 0.13 s in two tasks), and its
   results where a job ended meanwhile. So shown: the loader on and a frame drawn first, as
   for a wake, then the tab, the loader off once it is drawn. Its plots follow the window's
   width, not its height. */
const viewNow = ()=> innerWidth + '@' + devicePixelRatio;
const redrawn = t => !!t.inst && (t.changed || (t.view != null && t.view !== viewNow()));
onAnyChange(k =>{ const t = tabById(k); if (t && t.inst && (t.id !== _activeId || _onFixed)) t.changed = true; });
function showLater(t, done){
  const n = _toFixed;
  renderTabs(); markOn(t);
  syncProjectBar(t);
  showModuleLoader();
  afterPaint(()=>{
    if (t.id !== _activeId || !t.inst) return;   // (superseded: the newer step has its own)
    // (Home, Projects or Settings chosen since: it stays on show, the tab as it was left, shown
    // from there under the loader)
    if (n !== _toFixed){ if (done) done(); return; }
    showTab(t);
    if (done) done();
    afterPaint(()=> afterPaint(()=>{ if (t.id === _activeId && !t.waking) hideModuleLoader(); }));
  });
}
/* A tab woken: an instance made for it, put in the page and shown (it is the active
   tab), then its parked state restored into it and its whole history put back; the
   parked copies let go (the instance holds them now). A state it cannot read (a damaged
   or hand-edited project): an empty instance, and a banner says so (to v483 the error was
   swallowed, the module left as far as its restore had got). One whose files' bytes were
   let go (lighten) reads them first (wakeLater); every other wakes at once, as here. */
function wakeTab(t, stay){
  if (dropsBytes(t.module) && (unread(t.state) || (t.hist && unread(t.hist.states)))) return wakeLater(t);
  const key = t.id, mod = t.module;
  const inst = makeInstance(mod, key, true);
  if (!(mod in DEFAULT_STATE)){ try { DEFAULT_STATE[mod] = encode(getModuleState(key)); } catch(e){} }
  t.inst = inst;
  if (t.id === _activeId) showTab(t, stay);
  let hist = t.hist;
  // (a new tab, the default restored: every card drawn)
  const st = t.state != null ? t.state : DEFAULT_STATE[mod];
  // (what it showed: its module's to its restore, the rest as it is drawn, utils.js showAgain)
  if (t.shows){ if (inst.showNext){ try { inst.showNext(t.shows.own); } catch(e){} } showAgain(inst, t.shows); }
  try { if (st != null) restoreModuleState(key, decode(st)); }
  catch(e){
    hist = null;
    t.inst = null; detachInstance(inst);
    try { inst.destroy(); } catch(e2){}
    dropKey(key);
    t.inst = makeInstance(mod, key);
    if (t.id === _activeId) showTab(t, stay);
    try { restoreModuleState(key, decode(DEFAULT_STATE[mod])); } catch(e2){}
    damaged(t, e);
  }
  if (hist) setModuleHistory(key, hist);
  t.state = null; t.hist = null; t.shows = null;
  asleep(mod, key, null);
  return loaded(t);
}
// sessions.js told a tab is live (what it was saved as); a promise where that is read still
// (a project changed and reloaded: its saved record), the load's loader on till then.
function loaded(t){
  let p;
  if (_onLoaded){ try { p = _onLoaded(t); } catch(e){} }
  return p && typeof p.then === 'function' ? p : undefined;
}
/* A tab asleep whose files' bytes were let go wakes once they are read back (db.js load:
   an array another tab holds of them, else the store's), the loader on show meanwhile and
   no instance of its module in the page (utils.js vacate: no key reaches another tab's).
   One read a tab, whatever wakes ask for it meanwhile. Given up should the tab be left
   (another tab shown), closed, or woken otherwise by then: it stays asleep as it was, its
   references kept. A fixed section shown meanwhile (Home) stays on show, the tab woken
   behind it. Files whose bytes are not stored any more (cleared, evicted) come back as
   none, as at a reload, said so: the module shows them so (SEM: out of its list, said in
   its alerts; an undo to a state that held one, the same), the rest of the tab as it was.
   A read that fails as a whole (none of the store's read) gives the wake up: the tab stays
   asleep as it was, its references and its record, Home on show, said so, and its next
   show reads again, as a reload keeps the records it could not read. A promise, done once
   the tab is woken or the wake given up. */
function wakeLater(t){
  const st = t.state, h = t.hist, back = vacate(t.module, t.id);
  if (!t.waking || t.waking.st !== st || t.waking.h !== h) t.waking = { st, h, p: load([st, h && h.states]) };
  const w = t.waking;
  return w.p.then(({ v: [s, states], lost, failed })=>{
    if (t.waking === w) t.waking = null;
    if (t.inst || t.state !== st || t.hist !== h || t.id !== _activeId || !tabById(t.id)){ back(); return; }
    const name = '“' + (t.title || UNTITLED) + '”: ';
    if (failed){
      back();
      if (!_onFixed) goTab('home');
      notice(name + 'its files could not be read from this browser\'s storage. The tab stays as it was: show it again to read them again.');
      return;
    }
    t.state = s; t.hist = h && { ...h, states };
    const p = wakeTab(t, _onFixed);
    const n = [...refsIn(st)].filter(x=> lost.has(x)).length;
    if (n) notice(name + n + (n > 1 ? ' of its files are' : ' of its files is') + ' not stored in this browser any more: it comes back without '
      + (n > 1 ? 'them.' : 'it.'));
    return p;
  });
}
// Its instance let go (a tab closed, one put to sleep), its registries with it.
function dropInst(t){
  const inst = t.inst;
  if (!inst) return;
  t.inst = null;
  detachInstance(inst);
  try { inst.destroy(); } catch(e){ console.warn('DataTreat: an instance did not close cleanly:', e); }
  dropKey(t.id);
}
/* A tab put to sleep: its state and its whole history parked in it (the marks of no job:
   a busy tab never sleeps), its instance let go. Never the tab on show. */
function sleepTab(t){
  if (!t || !t.inst || t.id === _activeId || moduleBusy(t.id)) return false;
  let st;
  try { st = park(getModuleState(t.id)); } catch(e){ return false; }
  t.state = st;
  t.hist = getModuleHistory(t.id, true);
  t.shows = showsOf(t);
  dropInst(t);
  held(t);
  lighten(t);
  return true;
}
// A tab asleep's state and history, told to its module (utils.js asleep: SEM keeps what it
// made of the files they hold).
const held = t => asleep(t.module, t.id, [t.state, t.hist && t.hist.states]);
/* A tab asleep of a module whose tabs asleep let go of their files' bytes (utils.js
   dropsBytes: SEM): its record written, holding with its state's the hashes of its
   history's files (their bytes put in the store where it lacks them: db.js putRec's
   `also`), and then, the tab still asleep as it was, every array of bytes so stored taken
   out of its state and history, a reference by its hash in its place (db.js unload), read
   back as it wakes (wakeLater). Nothing else holds them then: what SEM keeps by file it
   keeps weakly, or only for the tabs awake. A file whose bytes are not stored (no
   WebCrypto) keeps them, and a write that fails lets go of none. True when it writes the
   tab's record (its caller then need not). */
function lighten(t){
  if (!dropsBytes(t.module) || isLive(t) || !tabById(t.id) || _restoring) return false;
  const st = t.state, h = t.hist;
  writeRec(t, h && h.states).then(()=>{
    if (isLive(t) || t.state !== st || t.hist !== h || !tabById(t.id)) return;
    const [s, states] = unload([st, h && h.states]);
    t.state = s;
    if (h) t.hist = { ...h, states };
  }, ()=>{});
  return true;
}
/* The rules, at each switch (before the tab shown wakes, and after), each job's end, each
   change of the settings and at the next time a tab is due: a tab hidden past
   settings.sleepMin sleeps (a busy one's time counted from now: from its job's end, at the
   latest); then, beyond settings.awakeMax tabs awake, the one on show among them (counted
   while it wakes), those shown least lately that are not busy, until none is over: one
   opened first but shown often stays awake. A tab is never refused for them: tabs busy stay
   awake past the limit, the excess put to sleep as their jobs end. `now` given: the time it
   is taken to be (the tests'). */
let _timer = 0;
const hiddenAwake = ()=> TABS.filter(t=> t.inst && t.id !== _activeId);
function keepLimits(now = Date.now()){
  clearTimeout(_timer); _timer = 0;
  const X = settings.sleepMin*60000;
  hiddenAwake().forEach(t=>{
    if (moduleBusy(t.id)) t.hidAt = Math.max(t.hidAt, now);
    else if (now - t.hidAt >= X) sleepTab(t);
  });
  let over = hiddenAwake().length - (settings.awakeMax - (activeTab() ? 1 : 0));
  for (const t of hiddenAwake().filter(t=> !moduleBusy(t.id)).sort((a, b)=> a.seenAt - b.seenAt)){
    if (over <= 0) break;
    if (sleepTab(t)) over--;
  }
  const due = hiddenAwake().filter(t=> !moduleBusy(t.id)).map(t=> t.hidAt + X);
  if (due.length){
    // (a browser holds a hidden page's timers back: the next due one is looked at again then)
    const at = Math.min(...due) - Date.now();
    _timer = setTimeout(()=> keepLimits(), Math.max(1000, Math.min(at + 50, 2147483000)));
  }
}
// A job started or ended in an instance (utils.js busyChanged): one ended in a tab hidden
// starts its time hidden now.
onBusyChange(key=>{
  const t = tabById(key);
  if (t && t.inst && t.id !== _activeId && !moduleBusy(key)) t.hidAt = Date.now();
  if (!_restoring) keepLimits();
});
// What the shell holds now, for the tests: each tab's module, whether it is awake, on show,
// busy, its time hidden and its last show.
const tabsNow = ()=> TABS.map(t=> ({ id: t.id, module: t.module, title: t.title, awake: isLive(t), shown: t.id === _activeId,
  busy: !!moduleBusy(t.id), hidAt: t.hidAt || 0, seenAt: t.seenAt || 0, history: !!t.hist, order: t.order }));

// Whatever reads the active tab's instance (a save, an export, a close that saves) calls
// this first: a tab asleep is woken a paint after the click, and read in between it has no
// instance yet. Up to v468 closing an inactive tab with "Save" saved the tab on show into
// the closed one's project.
// (a promise, to be awaited, where the wake reads its files' bytes first: wakeLater)
function ensureLive(){
  const t = activeTab();
  if (t && !isLive(t)) return loadTab(t);
}
// Deferred loader guarded against fast switching: if the user has already moved on
// to another tab by the time this runs, do nothing — only the final tab loads.
function loadTabIfActive(t){
  if (!t || t.id !== _activeId) return;  // superseded — the newer switch owns the loader
  // (the tabs awake past the limit with this one put to sleep before it wakes, not after)
  keepLimits();
  // (Home, Projects or Settings chosen since its module was put on show: it stays on show, the
  // tab asleep till it is shown from there, woken then under the loader, activateTab)
  const p = _onFixed ? undefined : loadTab(t);
  const done = ()=>{
    // (its record, now on show; the tab left wrote its own at the switch: to v517 every
    // tab's, rewritten at each switch; a reload's, only those whose place or being on show
    // it changed)
    persistMoved();
    keepLimits();
    // Charts finish drawing a frame after the restore; drop the loader once they have.
    requestAnimationFrame(()=> requestAnimationFrame(hideModuleLoader));
  };
  // (a wake reading its files' bytes: the loader on till it is done; given up, the tab
  // shown since has its own)
  if (p) p.then(()=>{ if (t.id === _activeId) done(); }); else done();
}

/* ---- Project bar sync -----------------------------------------------------
   The bar is the tab on show's, so its project-name field always shows the active
   tab's title. sessions.js owns everything else about saving. */
let _onActivate = null, _onLoaded = null;
// sessions.js registers what to do once a tab is activated (name field, save button
// state, dirty markers) — it owns that logic, this module owns the tabs — and once it is
// awake (what it was saved as, to compare later changes with).
function onTabActivated(fn){ _onActivate = fn; }
function onTabLoaded(fn){ _onLoaded = fn; }
function syncProjectBar(t){
  if (_onActivate){ try { _onActivate(t); } catch(e){} }
}

// Run fn only after the browser has painted at least one frame. A tab switch
// toggles .tab.active (shown at once: to v518 a 0.25 s fade, the tab whole only a third
// of a second after the click) and may then have heavy work: a wake, a redraw at a new
// width. In a single rAF that work runs *before* the first paint and freezes the click;
// past one paint the tab, or the loader over it, is on screen first.
function afterPaint(fn){ requestAnimationFrame(()=> requestAnimationFrame(fn)); }

// Module loader: a themed overlay + spinner covering the content below the top bar
// while a tab's charts are (re)built on open / tab switch. Shown synchronously so it
// masks the build; hidden a couple of frames after the restore, once the charts have
// drawn. Never used on resize.
let _loaderEl = null;
function showModuleLoader(){
  if (!_loaderEl){
    _loaderEl = document.createElement('div');
    _loaderEl.className = 'module-loader';
    _loaderEl.innerHTML = '<div class="module-loader-spin"></div>';
    document.body.appendChild(_loaderEl);
  }
  const topbar = document.getElementById('topbar');
  _loaderEl.style.top = (topbar ? Math.max(0, Math.round(topbar.getBoundingClientRect().bottom)) : 0) + 'px';
  _loaderEl.classList.add('show');
}
function hideModuleLoader(){ if (_loaderEl) _loaderEl.classList.remove('show'); }
/* A step that is no tab's and may take a while (a project written to a file, its bytes as
   base64: some 1.7 s for one of 8 SEM images of 2048², one task with no loader to v517):
   the loader on and a frame drawn first, fn, and the loader off once every such step is
   done. */
let _under = 0;
async function underLoader(fn){
  if (!_under++) showModuleLoader();
  await new Promise(r=> afterPaint(r));
  try { return await fn(); }
  finally { if (!--_under) hideModuleLoader(); }
}

// A banner that asks nothing, shown once none is on show: confirmBanner shows one at a
// time, and a new one would answer a question asked (a delete, a close) with no.
function notice(msg){
  const go = ()=>{ if (document.querySelector('.pwa-confirm')) setTimeout(go, 400); else confirmBanner(msg, 'OK'); };
  go();
}

// Fade the app in once its shell is assembled (see index.html head + style.css).
function revealApp(){ document.documentElement.classList.remove('app-booting'); }
// Safety nets so the app can never stay hidden if startup errors out.
window.addEventListener('load', ()=> setTimeout(revealApp, 0));
setTimeout(revealApp, 2500);

/* ---- Open / activate / close --------------------------------------------- */
// Open a project (or a blank technique) in a NEW tab and focus it. Opening a
// project that is already open is a no-op: it never steals focus.
// Any number may be open: only the tabs awake are limited (keepLimits), and one opened in
// the background is asleep. A tab left is left as it is: its job goes on, hidden (to v517
// leaving a tab asked to stop its job). (async: its callers await it)
async function openTab({ module, title, projectId, state, dirty, focus = true }){
  if (!MODULES.includes(module)) return null;
  if (projectId){
    const existing = tabByProject(projectId);
    if (existing) return existing;   // already open → nothing happens
  }
  const t = { id: uid(), module, title: title || untitledName(module), projectId: projectId || null, dirty: !!dirty,
              state: state || null, hist: null, inst: null, hidAt: 0, seenAt: 0, order: nextOrder(), rec: null, shows: null };
  TABS.push(t);
  // focus:false opens the tab in the background — opening a project from the
  // Projects list leaves you on that list. (asleep: woken as it is shown)
  if (focus) activateTab(t.id);
  else { renderTabs(); held(t); if (!lighten(t)) persistTab(t); }
  return t;
}

// The bar and the loader first (so the click reads as instant), then the tab put in the
// page, woken where it sleeps, a paint later; shown once drawn. A tab awake (its
// instance) is only put in the page: nothing to restore.
function activateTab(id){
  const t = tabById(id);
  if (!t) return;
  // Already the active tab (we were just off on a fixed section) → only show it back
  // (its wake reading its files' bytes still: under the loader, which its end takes away;
  // one to draw again, under the loader; a wake given up, its files not read: read again).
  if (_activeId === id){
    if (redrawn(t) || (_onFixed && t.inst)) return showLater(t);
    showTab(t);
    if (t.waking) showModuleLoader();
    else if (!isLive(t)){ showModuleLoader(); afterPaint(()=> loadTabIfActive(t)); }
    return;
  }
  const was = activeTab();
  hideTab(was);
  _activeId = id;
  // The record of the tab left (its `active` changed), once the tab chosen is painted (to
  // v518 at the click: ~20 ms of the press before the tab was on screen); written whatever
  // step comes next, superseded or not (else two records on show, a reload showing the first).
  afterPaint(()=> persistTab(was));
  // Every switch: the tab marked on and the loader on at the press, so that the press is
  // answered at once, the tab put in the page once they are painted, the loader off once it
  // is drawn (to v520 an awake tab was put in the page at the press, the bar and the tab on
  // screen together 55-75 ms after it, the browser laying out the section meanwhile).
  if (isLive(t)) return showLater(t, ()=>{ persistMoved(); keepLimits(); });
  // (asleep: its module put on show and the tab woken a paint after the press, unless Home,
  // Projects or Settings are chosen meanwhile: woken then when shown from there)
  const n = _toFixed;
  renderTabs(); markOn(t);
  syncProjectBar(t);                    // project bar is cheap + data-independent: build it now
  showModuleLoader();                   // mask the chart build until it's ready
  afterPaint(()=>{ if (t.id !== _activeId || n !== _toFixed) return; goTab(t.module); loadTabIfActive(t); });
}
/* The tab chosen marked on in the bar, and Home, Projects and Settings off, at the press
   (renderTabs marks none while a fixed section is on show, as it still is till the tab's
   module is put on show a paint later). */
function markOn(t){
  document.querySelectorAll('#tabBar .ptab').forEach(el=>{ const on = el.dataset.id === t.id; el.classList.toggle('is-on', on); el.setAttribute('aria-selected', on ? 'true' : 'false'); });
  document.querySelectorAll('#nav button.is-on').forEach(b=>{ b.classList.remove('is-on'); if (b.hasAttribute('role')) b.setAttribute('aria-selected', 'false'); });
}

// Home / Projects / Settings belong to no tab, so none is highlighted while one of
// them shows. The live tab is unchanged — clicking it back is instant.
onSectionChange(tab=>{
  const fixed = !MODULES.includes(tab);
  if (fixed){ hideModuleLoader(); _toFixed++; }   // never leave the loader hanging over a fixed section
  // (the tab on show left for it: the window it was left at; one not on show yet keeps its own, hideTab)
  if (fixed && !_onFixed){ const a = activeTab(); if (a && a.inst && a.view == null) a.view = viewNow(); }
  if (_onFixed === fixed) return;
  _onFixed = fixed;
  renderTabs();
});

// Close a tab and land on the one before it; failing that the one after; failing
// that Home. Closing the active tab loads the neighbour's state.
function closeTab(id){
  const i = tabIndex(id);
  if (i < 0) return;
  const t = TABS[i], wasActive = t.id === _activeId;
  // Its job goes with it (a deleted project, a close the user agreed to).
  if (isLive(t) && moduleBusy(t.id)) stopModule(t.id);
  TABS.splice(i, 1);
  deleteTabRec(id).catch(()=>{});
  asleep(t.module, t.id, null);
  // (a gap in the orders, which sorts as before: no other record written)
  clearTimeout(t.showsT); t.showsT = 0;
  if (!wasActive){ dropInst(t); renderTabs(); persistMoved(); keepLimits(); return; }
  _activeId = null;
  const next = TABS[i-1] || TABS[i] || null;
  if (!next){ dropInst(t); renderTabs(); goTab('home'); return; }
  _activeId = next.id;
  // (the record of the tab now on show at once: a step superseded within its frames writes
  // nothing after)
  persistMoved();
  // (one awake: shown before the closed one's instance goes, the page's scroll kept; the
  // loader of a wake the closed one was waiting on taken away)
  if (isLive(next) && redrawn(next)){ dropInst(t); showLater(next, keepLimits); return; }
  if (isLive(next)){ hideModuleLoader(); showTab(next); dropInst(t); renderTabs(); syncProjectBar(next); keepLimits(); return; }
  dropInst(t);
  renderTabs();
  goTab(next.module);
  syncProjectBar(next);
  showModuleLoader();
  afterPaint(()=> loadTabIfActive(next));
}

// Rename / dirty / project-association updates coming from sessions.js.
function setTabTitle(id, title){
  const t = tabById(id); if (!t) return;
  t.title = title; renderTabs(); persistTab(t);
}
function setTabDirty(id, dirty){
  const t = tabById(id); if (!t || t.dirty === !!dirty) return;
  t.dirty = !!dirty; renderTabs(); persistTab(t);
}
function setTabProject(id, projectId, title){
  const t = tabById(id); if (!t) return;
  t.projectId = projectId || null;
  if (title != null) t.title = title;
  renderTabs(); persistTab(t);
}

/* ---- Rendering ------------------------------------------------------------
   Label is "Technique · Project name": the technique never truncates, the name
   ellipsises. The "*" marks unsaved changes; the close button sits at 50%
   opacity, reaches full opacity on tab hover and lights up on its own hover
   (all in CSS). The native title attribute carries the full label. */
function renderTabs(){
  const bar = document.getElementById('tabBar');
  if (!bar) return;
  bar.innerHTML = '';
  TABS.forEach(t=>{
    const tech = MODULE_LABELS[t.module] || t.module;
    const el = document.createElement('div');
    const on = !_onFixed && t.id === _activeId;
    el.className = 'ptab' + (on ? ' is-on' : '');
    el.dataset.id = t.id;
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', on ? 'true' : 'false');
    el.title = tech + ' · ' + t.title + (t.dirty ? ' *' : '');
    const label = document.createElement('span');
    label.className = 'ptab-label';
    const techEl = document.createElement('span');
    techEl.className = 'ptab-tech'; techEl.textContent = tech + ' · ';
    const nameEl = document.createElement('span');
    // An emptied name field still needs a readable tab; the record keeps ''.
    nameEl.className = 'ptab-name'; nameEl.textContent = t.title || UNTITLED;
    label.append(techEl, nameEl);
    if (t.dirty){
      const star = document.createElement('span');
      star.className = 'ptab-star'; star.textContent = '*';
      label.appendChild(star);
    }
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'ptab-x';
    x.setAttribute('aria-label', 'Close ' + t.title);
    x.innerHTML = X_SVG(14);   // the same X the file list and the banners use
    el.append(label, x);
    bar.appendChild(el);
  });
  // A "+" at the tail (or on its own when no tabs are open) is a shortcut to the
  // new-project technique picker. sessions.js handles the click (it owns the modal).
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'ptab-add';
  add.setAttribute('aria-label', 'New project'); add.title = 'New project';
  add.textContent = '+';
  bar.appendChild(add);
  // The tab on show is scrolled into the strip where the strip is narrower than the tabs (a
  // phone): up to v505 the strip stayed where it was, on the first tab whatever was on.
  const cur = bar.querySelector('.ptab.is-on');
  if (cur && bar.scrollWidth > bar.clientWidth){
    const b = bar.getBoundingClientRect(), r = cur.getBoundingClientRect();
    // (its start shown first: a tab wider than the strip shows its technique)
    if (r.left < b.left || r.width > b.width) bar.scrollLeft += r.left - b.left;
    else if (r.right > b.right) bar.scrollLeft += r.right - b.right;
  }
}

// One delegated handler for the whole bar: the close button first, then the tab.
// A drag that actually moved swallows the click that follows it, so a reorder
// never doubles as an activation.
function initBar(){
  const bar = document.getElementById('tabBar');
  if (!bar) return;
  bar.addEventListener('click', e=>{
    const x = e.target.closest('.ptab-x');
    const el = e.target.closest('.ptab');
    if (!el) return;
    if (x){ e.stopPropagation(); requestClose(el.dataset.id); return; }
    if (_dragMoved){ _dragMoved = false; return; }
    // (a tab other than the one on show taken a microtask after the click, as to v521 behind
    // the check of a job in a module's one instance: clicks dispatched in one task each act on
    // the bar they were found in, not on the one the first drew anew)
    const id = el.dataset.id;
    if (id === _activeId) activateTab(id); else queueMicrotask(()=> activateTab(id));
  });
  // Tabs past the strip's width scroll in it, its scrollbar hidden: the wheel scrolls it
  // sideways too (a mouse had no way along it; a trackpad's sideways swipe is the
  // browser's own), and at its end the page as before.
  bar.addEventListener('wheel', e=>{
    if (e.ctrlKey || bar.scrollWidth <= bar.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const was = bar.scrollLeft;
    bar.scrollLeft += e.deltaY*(e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? bar.clientWidth : 1);
    if (bar.scrollLeft !== was) e.preventDefault();
  }, { passive: false });
  initDrag(bar);
}

/* ---- Drag to reorder (Chrome-style) ----------------------------------------
   Pointer-driven: the grabbed tab follows the cursor while the others slide to
   open a gap; on release the array is reordered and persisted. Only reorders
   within the bar — no cross-window drag. */
const TAB_GAP = 6;   // matches .tab-bar gap
let _drag = null;
let _dragMoved = false;
function initDrag(bar){
  bar.addEventListener('pointerdown', e=>{
    if (e.button !== 0) return;
    const el = e.target.closest('.ptab');
    if (!el || e.target.closest('.ptab-x')) return;
    const tabs = [...bar.querySelectorAll('.ptab')];
    const idx = tabs.indexOf(el);
    _drag = { pointerId: e.pointerId, el, startX: e.clientX, tabs,
              rects: tabs.map(t=> t.getBoundingClientRect()), idx, target: idx, moved: false, captured: false };
    _dragMoved = false;
  });
  bar.addEventListener('pointermove', e=>{
    const d = _drag; if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 4) return;
    if (!d.moved){
      d.moved = true;
      d.el.classList.add('ptab-dragging');
      // Capture only once a real drag begins — capturing on pointerdown would
      // redirect the click after a plain tap to the bar, breaking activation.
      try { bar.setPointerCapture(d.pointerId); d.captured = true; } catch(err){}
    }
    d.el.style.transform = `translateX(${dx}px)`;
    const w = d.rects[d.idx].width;
    // Symmetric by construction: a neighbour steps aside as soon as the drag passes
    // half a slot towards it, the same distance left as right (comparing against the
    // neighbours' own centres would instead need a full slot in each direction).
    const slot = w + TAB_GAP;
    const target = Math.max(0, Math.min(d.tabs.length - 1, d.idx + Math.round(dx / slot)));
    d.target = target;
    d.tabs.forEach((t, i)=>{
      if (i === d.idx) return;
      let shift = 0;
      if (target > d.idx && i > d.idx && i <= target) shift = -(w + TAB_GAP);
      else if (target < d.idx && i >= target && i < d.idx) shift = w + TAB_GAP;
      t.style.transition = 'transform .15s';
      t.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  });
  const finish = ()=>{
    const d = _drag; if (!d) return;
    _drag = null;
    if (d.captured){ try { bar.releasePointerCapture(d.pointerId); } catch(err){} }
    // Inline transforms are cleared here directly, so a plain click (no move) needs
    // no re-render — re-rendering would detach the element the click then fires on.
    d.tabs.forEach(t=>{ t.style.transform = ''; t.style.transition = ''; t.classList.remove('ptab-dragging'); });
    if (d.moved && d.target !== d.idx){ _dragMoved = true; moveTab(d.el.dataset.id, d.target); }
  };
  bar.addEventListener('pointerup', finish);
  bar.addEventListener('pointercancel', finish);
}
// Move a tab to a new index in the bar order, then persist the new order: its record alone,
// its order a number between its new neighbours' (should none be left between them, every
// tab numbered by its place again, and those changed written).
function moveTab(id, to){
  const from = tabIndex(id);
  if (from < 0 || to === from){ renderTabs(); return; }
  const [t] = TABS.splice(from, 1);
  TABS.splice(to, 0, t);
  const a = TABS[to-1], b = TABS[to+1], o = a && b ? (a.order + b.order)/2 : a ? a.order + 1 : b ? b.order - 1 : t.order;
  if ((a && !(o > a.order)) || (b && !(o < b.order))) TABS.forEach((x, k)=>{ x.order = k; });
  else t.order = o;
  renderTabs();
  persistMoved();
}

// Is there any work in this tab to lose? For a tab awake its instance answers
// directly; a parked one is empty when its state still matches the pristine
// default (a typed name lives on the record, not in the module state).
function isEmpty(t){
  if (isLive(t)) return !moduleHasData(t.id);
  if (!t.state) return true;
  // (a parked state's bytes are arrays, which JSON would write a key a byte: none in a default)
  try { return JSON.stringify(t.state, (k, x)=> x instanceof Uint8Array ? 0 : x) === JSON.stringify(defaultState(t.module)); }
  catch(e){ return false; }
}

/* Closing prompts to save unless the tab is already saved and unchanged.
   sessions.js supplies the save routine (it owns the project store), which saves the
   tab whether it is on show or not, awake or asleep (to v517 the tab was shown first, its
   state loaded into its module). A job going on in it stops only if the user says so. */
let _saveForClose = null;
function onCloseSave(fn){ _saveForClose = fn; }
async function requestClose(id){
  const t = tabById(id);
  if (!t) return;
  // (the tab on show a microtask after the click, as to v521: a close of another tab
  // dispatched in the same task still finds its button in the bar)
  if (t.id === _activeId) await null;
  const running = t.inst && moduleBusy(t.id);
  if (running && !await confirmBanner(running + ' is running in “' + (t.title || UNTITLED) + '”: closing this tab stops it.', 'Stop it and close')) return;
  // Nothing to lose: an empty file list (whatever the name says) or a saved project
  // with no pending change closes straight away.
  if (isEmpty(t) || (t.projectId && !t.dirty)){ closeTab(id); return; }
  const res = await confirmBanner('Save “'+t.title+'” before closing?', 'Save', "Don't save");
  if (res === false) return;                               // cancel
  if (res === true){
    if (!_saveForClose) return;
    if (t.id === _activeId){ const w = ensureLive(); if (w) await w; }   // (its deferred load, now)
    if (!await _saveForClose(t)) return;                   // save aborted → keep the tab
    if (t.dirty) return;   // (changed while it was written, v517: the change is kept, unsaved)
  }
  closeTab(id);
}

// Home technique cards: each opens a blank project of that technique in a new tab.
function initHomeCards(){
  document.querySelectorAll('.home-card[data-go]').forEach(c=>{
    c.addEventListener('click', ()=> openTab({ module: c.dataset.go }));
  });
}

/* ---- Startup restore ------------------------------------------------------ */
async function initTabs(){
  initBar();
  initHomeCards();
  // The records with their files' bytes, read together (v517); none at all should they
  // not read: the records stay as they are, for the next load. A file whose bytes are not
  // stored any more comes back without them (its module says so where they are needed).
  let recs = [], states = [], missing = 0;
  // (a tab of SEM not on show comes back asleep holding its files' references, not their
  // bytes: read as it wakes, lighten; its files not stored are said then)
  try { ({ recs, states, missing } = await allTabStates(r=> dropsBytes(r.module) && !r.active)); }
  catch(e){ recs = []; notice('Your open tabs could not be read from this browser\'s storage: they are kept as they are for the next load.'); }
  if (missing) notice(missing + (missing > 1 ? ' files' : ' file') + ' of your open tabs ' + (missing > 1 ? 'are' : 'is')
    + ' not stored in this browser any more: ' + (missing > 1 ? 'they come' : 'it comes') + ' back without the original bytes.');
  // (each its order and what it showed as its record holds them, or as this window kept it as
  // it went, newer, and what its record holds of its place, its being on show and what it
  // shows: rec, recShows, the records written again only where those change)
  let went = {};
  try { went = JSON.parse(window.sessionStorage.getItem(SHOWS_KEY)) || {}; window.sessionStorage.removeItem(SHOWS_KEY); } catch(e){ went = {}; }
  if (!went || typeof went !== 'object') went = {};
  _went = went;
  const made = recs.map((r, i)=>{
    if (!r || !MODULES.includes(r.module)) return null;
    const own = r.shows === undefined ? null : r.shows, v = Object.prototype.hasOwnProperty.call(went, r.id) ? went[r.id] : own;
    const shows = v && typeof v === 'object' && !Array.isArray(v) ? v : null, recShows = JSON.stringify(own);
    return { r, t: { id:r.id, module:r.module, title:r.title || UNTITLED, projectId:r.projectId || null, dirty:!!r.dirty, state:states[i] || null,
      hist:null, inst:null, hidAt:0, seenAt:0, order: r.order, shows, recShows,
      rec: JSON.stringify(shows) === recShows ? { order: r.order, active: !!r.active } : null } };
  })
    .filter(x=> x && !tabById(x.r.id)).sort((a,b)=> (a.r.order||0) - (b.r.order||0));
  if (!made.length){ renderTabs(); afterPaint(revealApp); return; }
  // (an order that does not rise from the tab before it, or is no number: one past that tab's,
  // and written; two windows' tabs opened at once, or a record of another hand: v517's rise
  // one by one)
  made.forEach((x, k)=>{ const o = x.t.order, p = k ? made[k-1].t.order : 0; if (!Number.isFinite(o) || (k && !(o > p))) x.t.order = k ? p + 1 : 0; });
  // Tabs opened while the records were being read (an upgrade held back by a window of an
  // older version, which can last): they stay as they are, the one on show live, and the
  // tabs restored are put before them, parked. To v516 the restore took the module from
  // the tab on show, whose work was then lost. (theirs numbered past the last restored, and
  // written; a record restored on show, written so no longer)
  if (TABS.length){
    let o = made[made.length - 1].t.order;
    TABS.forEach(t=>{ t.order = ++o; });
    TABS.unshift(...made.map(x=> x.t)); made.forEach(x=> held(x.t)); renderTabs(); persistMoved(); afterPaint(revealApp); return;
  }
  _restoring = true;
  made.forEach(x=>{ TABS.push(x.t); held(x.t); });
  recs = made.map(x=> x.r);
  // (two records on show, only of two windows of the app on one database (each writes its
  // own): the one written last, the tab on show last in either; one window keeps one)
  const wanted = recs.filter(r=> r.active).sort((a, b)=> (b.updatedAt||0) - (a.updatedAt||0))[0] || recs[0];
  _activeId = wanted.id;
  const at = tabById(_activeId);
  renderTabs();                          // tab bar + titles
  goTab(at.module);                      // build the (empty) module shell
  syncProjectBar(at);                    // project bar built now, not piecemeal after
  showModuleLoader();                    // spinner over the content area while it loads
  // Reveal the fully-assembled shell in one fade, THEN run the heavy restore a paint
  // later — so the user sees a complete shell appear at once (not built piecemeal),
  // and the charts fill in after, without freezing the boot.
  requestAnimationFrame(()=>{
    revealApp();
    // (then the records whose place or being on show the restore changed, those alone)
    requestAnimationFrame(()=>{ loadTabIfActive(at); _restoring = false; persistMoved(); _went = null; });
  });
}

/* ---- Settings › Tabs in the background ---------------------------------------
   The minutes a tab is left awake hidden, and the number of tabs awake at most, the one on
   show among them. A change applies at once. */
(function initTabSettings(){
  const $ = id => document.getElementById(id);
  const min = $('settingSleepMin'), max = $('settingAwakeMax');
  if (!min || !max) return;
  const show = ()=>{ min.value = settings.sleepMin; max.value = settings.awakeMax; };
  const num = (el, lo, hi, int)=>{ const v = parseFloat(String(el.value).replace(',', '.')); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, int ? Math.round(v) : v)) : null; };
  const apply = ()=>{
    const a = num(min, 0.1, 1440), b = num(max, 1, 1000, true);
    if (a != null) settings.sleepMin = a;
    if (b != null) settings.awakeMax = b;
    saveSettings(); show(); keepLimits();
  };
  [min, max].forEach(el=> el.addEventListener('change', apply));
  show();
})();

export { TABS, UNTITLED, activeTab, tabById, tabByProject, openTab, activateTab,
         closeTab, setTabTitle, setTabDirty, setTabProject, renderTabs,
         onTabActivated, onTabLoaded, onCloseSave, initTabs, persistTab, persistMoved, isRestoring,
         isLive, ensureLive, notice, tabOf, stateOf, isEmpty,
         keepLimits as sleepTick, tabsNow, underLoader };
