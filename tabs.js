/* =========================================================
   OPEN PROJECT TABS
   The nav shows Home, a separator, then one tab per OPEN PROJECT — Chrome/MATLAB
   style. A tab is a project, and its technique is just the page it shows, so any
   number of projects can be open at once, several on the same technique.

   Only ONE instance of each module exists (each is a singleton closure bound to
   fixed DOM ids), so only the active tab's state is live. Every other tab parks
   its module state and its undo history in its record, and a switch is:
     serialize the outgoing tab → restore the incoming tab into its module.
   The tab bar repaints first and the state loads on the next frame, so the click
   feels immediate even when the restore takes a moment.
========================================================= */
import { MODULES, MODULE_LABELS, goTab, getModuleState, restoreModuleState,
         getModuleHistory, setModuleHistory, confirmBanner, moduleHasData, X_SVG,
         onSectionChange, moduleBusy, stopModule } from './utils.js';
import { allTabStates, putTabRec, deleteTabRec, uid, encode, park, decode } from './db.js';

const MAX_TABS = 20;
const UNTITLED = 'Untitled project';

/* Pristine module states, captured before anything is loaded. A brand-new tab
   restores these, so it starts with empty files AND default parameters rather
   than inheriting whatever the previous tab left in the shared module. */
const DEFAULT_STATE = {};
MODULES.forEach(m=>{ try { DEFAULT_STATE[m] = encode(getModuleState(m)); } catch(e){} });

/* A tab: { id, module, title, projectId, dirty, state, hist }
   `state` / `hist` are only meaningful while the tab is NOT active — the active
   tab's live state is the module itself. `state` is park's form (db.js): its files'
   bytes the module's own arrays, read back from the store before a tab is made of a
   record (v517). */
const TABS = [];
let _activeId = null;      // the tab whose state is live in its module
let _onFixed = true;       // a fixed section (home / projects / settings) is showing
let _restoring = false;    // true while replaying persisted tabs at startup

const tabById = id => TABS.find(t=> t.id === id) || null;
const activeTab = ()=> tabById(_activeId);
const tabIndex = id => TABS.findIndex(t=> t.id === id);
const tabByProject = pid => (pid ? TABS.find(t=> t.projectId === pid) || null : null);
const isRestoring = ()=> _restoring;

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
   with the same tabs and the same unsaved work. */
// The module holds a tab's state only once the tab is live: between a switch and its
// deferred load (loadTabIfActive) the active tab's state is still the one parked.
function tabRec(t, order){
  return { id:t.id, module:t.module, title:t.title, projectId:t.projectId || null,
           dirty:!!t.dirty, order, active: t.id===_activeId,
           state: t.id===_liveId ? park(getModuleState(t.module)) : t.state,
           updatedAt: Date.now() };
}
function persistTab(t){
  if (_restoring || !t) return;
  try { putTabRec(tabRec(t, tabIndex(t.id))).catch(()=>{}); } catch(e){}
}
function persistAll(){
  if (_restoring) return;
  TABS.forEach(t=>{ try { putTabRec(tabRec(t, tabIndex(t.id))).catch(()=>{}); } catch(e){} });
}

/* ---- State swap ---------------------------------------------------------- */
// Which tab's state is actually loaded into its module right now. Tracked so a
// superseded switch (see loadTabIfActive) neither stashes stale data nor reloads a
// tab that is already live.
let _liveId = null;
const isLive = t => !!t && t.id === _liveId;
// Park the live module state (and undo history) of the currently active tab — but
// only if that tab is genuinely the live one. During rapid switching an outgoing
// tab may never have been loaded (its deferred load was skipped); its record is
// still valid on disk, so stashing the module (which holds someone else's data)
// would corrupt it.
function stashActive(){
  const t = activeTab();
  if (!t || t.id !== _liveId) return;
  try { t.state = park(getModuleState(t.module)); } catch(e){}   // (to v516 encode: every file's bytes base64'd again)
  t.hist = getModuleHistory(t.module, true);   // (parked: a job's hold on it ends, utils.js)
}
// Load a tab's parked state into its module. restoreModuleState resets the undo
// stack to a fresh baseline, so the parked history is put back afterwards. If the
// module already holds this tab's state, skip the heavy restore.
function loadTab(t){
  if (_liveId === t.id) return;
  const st = t.state || DEFAULT_STATE[t.module];
  let hist = t.hist;
  try { if (st != null) restoreModuleState(t.module, decode(st)); }
  catch(e){
    // A state its module cannot read (a damaged or hand-edited project): the tab opens
    // empty and says so. To v483 the error was swallowed and the module stayed as far as
    // its restore had got, partly the tab before's data.
    hist = null;
    try { restoreModuleState(t.module, decode(DEFAULT_STATE[t.module])); } catch(e2){}
    console.warn('DataTreat: “' + t.title + '” could not be restored:', e);
    confirmBanner('“' + t.title + '” could not be opened: its ' + (MODULE_LABELS[t.module]||t.module)
      + ' project is damaged. The tab shows an empty module; what is saved stays as it is unless you save over it.', 'OK');
  }
  if (hist) setModuleHistory(t.module, hist);
  _liveId = t.id;
  if (_onLoaded){ try { _onLoaded(t); } catch(e){} }
}
// Whatever reads the active tab's module (a save, an export, a close that saves) calls
// this first: a switch loads the tab a frame or two after the click, and read in between
// the module still holds the tab before it. Up to v468 closing an inactive tab with
// "Save" saved the tab on show into the closed one's project.
function ensureLive(){
  const t = activeTab();
  if (t && _liveId !== t.id) loadTab(t);
}
// Deferred loader guarded against fast switching: if the user has already moved on
// to another tab by the time this runs, do nothing — only the final tab loads.
function loadTabIfActive(t){
  if (!t || t.id !== _activeId) return;  // superseded — the newer switch owns the loader
  loadTab(t);
  persistAll();
  // Charts finish drawing a frame after the restore; drop the loader once they have.
  requestAnimationFrame(()=> requestAnimationFrame(hideModuleLoader));
}

/* ---- Project bar sync -----------------------------------------------------
   Only one module is live, so its project-name field always shows the active
   tab's title. sessions.js owns everything else about saving. */
let _onActivate = null, _onLoaded = null;
// sessions.js registers what to do once a tab is activated (name field, save button
// state, dirty markers) — it owns that logic, this module owns the tabs — and once its
// state is live in its module (what it was saved as, to compare later changes with).
function onTabActivated(fn){ _onActivate = fn; }
function onTabLoaded(fn){ _onLoaded = fn; }
function syncProjectBar(t){
  if (_onActivate){ try { _onActivate(t); } catch(e){} }
}

// Run fn only after the browser has painted at least one frame. A tab switch
// toggles .tab.active (starting the 0.25s tab-fade) and then must restore the
// module's state — a heavy, synchronous recompute + redraw on large projects. In a
// single rAF that work runs *before* the fade's first paint and freezes the switch.
// Deferring past one paint lets the fade start (opacity/transform animate on the
// compositor, so they keep running while the main thread does the restore), then the
// charts fill in a moment later instead of the click feeling stuck.
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
/* A job running in the live tab's module (a Rietveld refinement: moduleBusy) belongs to
   that tab's project: once another tab takes the module, or this one is parked, its
   result has nowhere right to go. So before the live tab is left the user chooses: stop
   the job, or stay. True when nothing runs, or it was stopped. */
async function mayLeaveLive(){
  const t = tabById(_liveId);
  const running = t && moduleBusy(t.module);
  if (!running) return true;
  if (!await confirmBanner(running + ' is running in “' + (t.title || UNTITLED) + '”: leaving this tab stops it.', 'Stop it and leave')) return false;
  stopModule(t.module);
  return true;
}
// A tab chosen in the bar: shown at once, unless leaving the live one would stop a job.
async function switchTo(id){
  if (id !== _liveId && !await mayLeaveLive()) return;
  activateTab(id);
}
// Open a project (or a blank technique) in a NEW tab and focus it. Opening a
// project that is already open is a no-op: it never steals focus.
async function openTab({ module, title, projectId, state, dirty, focus = true }){
  if (!MODULES.includes(module)) return null;
  if (projectId){
    const existing = tabByProject(projectId);
    if (existing) return existing;   // already open → nothing happens
  }
  if (TABS.length >= MAX_TABS){
    await confirmBanner('You already have '+MAX_TABS+' tabs open. Close one before opening another.', 'OK');
    return null;
  }
  // Shown at once only if leaving the live tab stops nothing (or the user stops it);
  // otherwise it opens beside it, as from the Projects list.
  if (focus && !await mayLeaveLive()) focus = false;
  const t = { id: uid(), module, title: title || untitledName(module),
              projectId: projectId || null, dirty: !!dirty, state: state || null, hist: null };
  TABS.push(t);
  // focus:false opens the tab in the background — opening a project from the
  // Projects list leaves you on that list.
  if (focus) activateTab(t.id);
  else { renderTabs(); persistTab(t); }
  return t;
}

// Repaint the bar first (so the click reads as instant), then swap the state in
// on the next frame — the restore plus redraw can take a beat on large projects.
function activateTab(id){
  const t = tabById(id);
  if (!t) return;
  // Already the live tab (we were just off on a fixed section) → only show it back.
  if (_activeId === id){ goTab(t.module); return; }
  stashActive();
  _activeId = id;
  renderTabs();
  goTab(t.module);
  syncProjectBar(t);                    // project bar is cheap + data-independent: build it now
  showModuleLoader();                   // mask the chart build until it's ready
  afterPaint(()=> loadTabIfActive(t));  // heavy restore after paint, skipped if superseded
}

// Home / Projects / Settings belong to no tab, so none is highlighted while one of
// them shows. The live tab is unchanged — clicking it back is instant.
onSectionChange(tab=>{
  const fixed = !MODULES.includes(tab);
  if (fixed) hideModuleLoader();   // never leave the loader hanging over a fixed section
  if (_onFixed === fixed) return;
  _onFixed = fixed;
  renderTabs();
});

// Close a tab and land on the one before it; failing that the one after; failing
// that Home. Closing the active tab loads the neighbour's state.
function closeTab(id){
  const i = tabIndex(id);
  if (i < 0) return;
  const wasActive = TABS[i].id === _activeId;
  // Its job goes with it (a deleted project, a close the user agreed to).
  if (id === _liveId && moduleBusy(TABS[i].module)) stopModule(TABS[i].module);
  TABS.splice(i, 1);
  deleteTabRec(id).catch(()=>{});
  if (!wasActive){ renderTabs(); persistAll(); return; }
  _activeId = null;
  const next = TABS[i-1] || TABS[i] || null;
  if (!next){ renderTabs(); goTab('home'); persistAll(); return; }
  _activeId = next.id;
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
    switchTo(el.dataset.id);
  });
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
// Move a tab to a new index in the bar order, then persist the new order.
function moveTab(id, to){
  const from = tabIndex(id);
  if (from < 0 || to === from){ renderTabs(); return; }
  const [t] = TABS.splice(from, 1);
  TABS.splice(to, 0, t);
  renderTabs();
  persistAll();
}

// Is there any work in this tab to lose? For the active tab the module answers
// directly; a parked one is empty when its state still matches the pristine
// default (a typed name lives on the record, not in the module state).
function isEmpty(t){
  if (t.id === _liveId) return !moduleHasData(t.module);
  if (!t.state) return true;
  // (a parked state's bytes are arrays, which JSON would write a key a byte: none in a default)
  try { return JSON.stringify(t.state, (k, x)=> x instanceof Uint8Array ? 0 : x) === JSON.stringify(DEFAULT_STATE[t.module]); }
  catch(e){ return false; }
}

/* Closing prompts to save unless the tab is already saved and unchanged.
   sessions.js supplies the save routine (it owns the project store). */
let _saveForClose = null;
function onCloseSave(fn){ _saveForClose = fn; }
async function requestClose(id){
  const t = tabById(id);
  if (!t) return;
  // Closing the live tab leaves it: a job running there stops only if the user says so.
  if (t.id === _liveId && !await mayLeaveLive()) return;
  // Nothing to lose: an empty file list (whatever the name says) or a saved project
  // with no pending change closes straight away.
  if (isEmpty(t) || (t.projectId && !t.dirty)){ closeTab(id); return; }
  const res = await confirmBanner('Save “'+t.title+'” before closing?', 'Save', "Don't save");
  if (res === false) return;                               // cancel
  if (res === true){
    if (!_saveForClose) return;
    if (t.id !== _liveId && !await mayLeaveLive()) return; // saving another tab shows it
    if (t.id !== _activeId) activateTab(t.id);             // save acts on the live module:
    ensureLive();                                          // the tab's, loaded now
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
  try { ({ recs, states, missing } = await allTabStates()); }
  catch(e){ recs = []; notice('Your open tabs could not be read from this browser\'s storage: they are kept as they are for the next load.'); }
  if (missing) notice(missing + (missing > 1 ? ' files' : ' file') + ' of your open tabs ' + (missing > 1 ? 'are' : 'is')
    + ' not stored in this browser any more: ' + (missing > 1 ? 'they come' : 'it comes') + ' back without the original bytes.');
  const made = recs.map((r, i)=> r && MODULES.includes(r.module) && { r, t: { id:r.id, module:r.module, title:r.title || UNTITLED,
    projectId:r.projectId || null, dirty:!!r.dirty, state:states[i] || null, hist:null } })
    .filter(x=> x && !tabById(x.r.id)).sort((a,b)=> (a.r.order||0) - (b.r.order||0));
  if (!made.length){ renderTabs(); afterPaint(revealApp); return; }
  // Tabs opened while the records were being read (an upgrade held back by a window of an
  // older version, which can last): they stay as they are, the one on show live, and the
  // tabs restored are put before them, parked. To v516 the restore took the module from
  // the tab on show, whose work was then lost.
  if (TABS.length){ TABS.unshift(...made.map(x=> x.t)); renderTabs(); persistAll(); afterPaint(revealApp); return; }
  _restoring = true;
  made.forEach(x=> TABS.push(x.t));
  recs = made.map(x=> x.r);
  const wanted = recs.find(r=> r.active) || recs[0];
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
    requestAnimationFrame(()=>{ loadTabIfActive(at); _restoring = false; });
  });
}

export { TABS, MAX_TABS, UNTITLED, activeTab, tabById, tabByProject, openTab, activateTab,
         closeTab, requestClose, setTabTitle, setTabDirty, setTabProject, renderTabs,
         onTabActivated, onTabLoaded, onCloseSave, initTabs, persistTab, persistAll, isRestoring,
         isLive, ensureLive, untitledName, notice };
