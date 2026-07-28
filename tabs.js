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
         onSectionChange } from './utils.js';
import { allTabRecs, putTabRec, deleteTabRec, uid, encode, decode } from './db.js';

const MAX_TABS = 20;
const UNTITLED = 'Untitled project';

/* Pristine module states, captured before anything is loaded. A brand-new tab
   restores these, so it starts with empty files AND default parameters rather
   than inheriting whatever the previous tab left in the shared module. */
const DEFAULT_STATE = {};
MODULES.forEach(m=>{ try { DEFAULT_STATE[m] = encode(getModuleState(m)); } catch(e){} });

/* A tab: { id, module, title, projectId, dirty, state, hist }
   `state` / `hist` are only meaningful while the tab is NOT active — the active
   tab's live state is the module itself. */
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
function tabRec(t, order){
  return { id:t.id, module:t.module, title:t.title, projectId:t.projectId || null,
           dirty:!!t.dirty, order, active: t.id===_activeId,
           state: t.id===_activeId ? encode(getModuleState(t.module)) : t.state,
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
// Park the live module state (and undo history) of the currently active tab — but
// only if that tab is genuinely the live one. During rapid switching an outgoing
// tab may never have been loaded (its deferred load was skipped); its record is
// still valid on disk, so stashing the module (which holds someone else's data)
// would corrupt it.
function stashActive(){
  const t = activeTab();
  if (!t || t.id !== _liveId) return;
  try { t.state = encode(getModuleState(t.module)); } catch(e){}
  t.hist = getModuleHistory(t.module);
}
// Load a tab's parked state into its module. restoreModuleState resets the undo
// stack to a fresh baseline, so the parked history is put back afterwards. If the
// module already holds this tab's state, skip the heavy restore.
function loadTab(t){
  if (_liveId === t.id) return;
  const st = t.state || DEFAULT_STATE[t.module];
  try { if (st != null) restoreModuleState(t.module, decode(st)); } catch(e){}
  if (t.hist) setModuleHistory(t.module, t.hist);
  _liveId = t.id;
}
// Deferred loader guarded against fast switching: if the user has already moved on
// to another tab by the time this runs, do nothing — only the final tab loads.
function loadTabIfActive(t){
  if (!t || t.id !== _activeId) return;
  loadTab(t);
  persistAll();
}

/* ---- Project bar sync -----------------------------------------------------
   Only one module is live, so its project-name field always shows the active
   tab's title. sessions.js owns everything else about saving. */
let _onActivate = null;
// sessions.js registers what to do once a tab's state is live (name field, save
// button state, dirty markers) — it owns that logic, this module owns the tabs.
function onTabActivated(fn){ _onActivate = fn; }
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

// Fade the app in once its shell is assembled (see index.html head + style.css).
function revealApp(){ document.documentElement.classList.remove('app-booting'); }
// Safety nets so the app can never stay hidden if startup errors out.
window.addEventListener('load', ()=> setTimeout(revealApp, 0));
setTimeout(revealApp, 2500);

/* ---- Open / activate / close --------------------------------------------- */
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
  afterPaint(()=> loadTabIfActive(t));  // heavy restore after paint, skipped if superseded
}

// Home / Projects / Settings belong to no tab, so none is highlighted while one of
// them shows. The live tab is unchanged — clicking it back is instant.
onSectionChange(tab=>{
  const fixed = !MODULES.includes(tab);
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
    activateTab(el.dataset.id);
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
  if (t.id === _activeId) return !moduleHasData(t.module);
  if (!t.state) return true;
  try { return JSON.stringify(t.state) === JSON.stringify(DEFAULT_STATE[t.module]); }
  catch(e){ return false; }
}

/* Closing prompts to save unless the tab is already saved and unchanged.
   sessions.js supplies the save routine (it owns the project store). */
let _saveForClose = null;
function onCloseSave(fn){ _saveForClose = fn; }
async function requestClose(id){
  const t = tabById(id);
  if (!t) return;
  // Nothing to lose: an empty file list (whatever the name says) or a saved project
  // with no pending change closes straight away.
  if (isEmpty(t) || (t.projectId && !t.dirty)){ closeTab(id); return; }
  const res = await confirmBanner('Save “'+t.title+'” before closing?', 'Save', "Don't save");
  if (res === false) return;                               // cancel
  if (res === true){
    if (!_saveForClose) return;
    if (t.id !== _activeId) activateTab(t.id);             // save acts on the live module
    if (!await _saveForClose(t)) return;                   // save aborted → keep the tab
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
  let recs;
  try { recs = await allTabRecs(); } catch(e){ recs = []; }
  recs = (recs || []).filter(r=> r && MODULES.includes(r.module))
                     .sort((a,b)=> (a.order||0) - (b.order||0));
  if (!recs.length){ renderTabs(); afterPaint(revealApp); return; }
  _restoring = true;
  recs.forEach(r=>{
    TABS.push({ id:r.id, module:r.module, title:r.title || UNTITLED, projectId:r.projectId || null,
                dirty:!!r.dirty, state:r.state || null, hist:null });
  });
  const wanted = recs.find(r=> r.active) || recs[0];
  _activeId = wanted.id;
  const at = tabById(_activeId);
  renderTabs();                          // tab bar + titles
  goTab(at.module);                      // build the (empty) module shell
  syncProjectBar(at);                    // project bar built now, not piecemeal after
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
         onTabActivated, onCloseSave, initTabs, persistTab, persistAll, isRestoring, untitledName };
