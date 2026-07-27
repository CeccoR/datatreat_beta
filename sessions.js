/* =========================================================
   PROJECT MANAGER
   Save/restore a whole module's state (raw data + parameters + fits) to
   IndexedDB as a named "project", with .json export/import and a per-module CSV
   export. A dedicated "Projects" tab lists every saved project, filterable by
   name and module. Each module shows its open project's name (white, with a
   "*" when there are unsaved changes); the Save buttons sit in a green "saved"
   state until the next change.
========================================================= */
import { MODULES, MODULE_LABELS, getModuleState, restoreModuleState,
         moduleHasData, onModuleChangeOnce, onModuleChange, runCsvExport, runWithModuleState, X_SVG, confirmBanner, normalizeProjIcons, refreshProjBar, goTab } from './utils.js';
import { allProjects, putProject, deleteProject, uid, encode, decode } from './db.js';
import { TABS, activeTab, tabById, tabByProject, openTab, closeTab, setTabTitle,
         setTabDirty, setTabProject, onTabActivated, onCloseSave, initTabs,
         persistTab, isRestoring, UNTITLED } from './tabs.js';

// Row action icons: the exact CSV/JSON glyphs used in the module toolbars
// (text over a right-pointing arrow) and the rounded X for delete.
const ROW_DOC = (txt, fs) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><text x="12" y="11" font-size="'+fs+'" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">'+txt+'</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>';
const ROW_CSV = ROW_DOC('CSV', 8.5), ROW_JSON = ROW_DOC('JSON', 8.5), ROW_X = X_SVG(16);
// Trash glyph for delete actions — same visual weight as the X it replaces.
const ROW_TRASH = '<svg class="x-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

function fmtDate(ts){ try { return new Date(ts).toLocaleString(); } catch(e){ return ''; } }
function downloadTextFile(name, text, type){
  const url = URL.createObjectURL(new Blob([text], { type: type||'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

/* ---- Open-project state ----
   A tab IS the open project: its `projectId` is the saved record it belongs to (or
   null when it was never saved) and its `dirty` flag drives the "*". Only the
   active tab is live, so these read straight off it. `mod` arguments are kept for
   readability — they always refer to the active tab's module. */
const curProject = ()=>{ const t = activeTab(); return t && t.projectId ? { id:t.projectId, title:t.title } : null; };
const isDirty = ()=>{ const t = activeTab(); return !!(t && t.dirty); };

/* ---- Autosave ----
   5 s after the last change the active tab's state is written back to the tabs
   store, so a reload (incl. Chrome's desktop/mobile switch, which reloads the
   page) comes back with the same tabs and the same unsaved work. Persisting a tab
   is not saving a project: a tab still needs an explicit Save to become one. */
const AUTOSAVE_MS = 5000;
let _autosaveTimer = null;
function scheduleAutosave(){
  if (isRestoring()) return;   // don't rewrite records while tabs are being replayed
  const t = activeTab(); if (!t) return;
  // Leading edge: persist at once on the first change (e.g. as soon as data loads),
  // so an immediate reload is already covered; then debounce the trailing write.
  if (!_autosaveTimer) persistTab(t);
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(()=>{ _autosaveTimer = null; const a = activeTab(); if (a) persistTab(a); }, AUTOSAVE_MS);
}

const CHECK_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const CHECK_SM = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function saveBtns(mod){ return [...document.querySelectorAll('.proj-save[data-module="'+mod+'"]')]; }
function nameInput(mod){ return document.querySelector('.project-name-input[data-module="'+mod+'"]'); }
// Adaptive width for the project-name field: while it shows the ghost placeholder
// (empty & unfocused) it keeps its default width; once focused/filled it grows with
// the text, from just enough for the caret up to 3/4 of the project bar. Past that
// the width sticks and the text scrolls (blurred → a trailing "…" via CSS ellipsis).
const _nameCtx = document.createElement('canvas').getContext('2d');
function fitNameField(mod){
  const inp = nameInput(mod); if (!inp) return;
  const bar = inp.closest('.project-bar');
  // On a hidden tab the bar has zero width → don't size it (it would collapse to 0
  // and hide the name); it gets sized when its tab is shown.
  if (!bar || !bar.clientWidth) return;
  const focused = document.activeElement === inp;
  if (!inp.value && !focused){ inp.style.width = ''; return; }   // ghost → CSS default width
  const cs = getComputedStyle(inp);
  _nameCtx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  const maxW = bar.clientWidth * 0.75;
  const pad = 24;   // 2×10 padding + 2×1 border + a little caret slack
  inp.style.width = Math.min(Math.max(_nameCtx.measureText(inp.value).width + pad, pad), maxW) + 'px';
}
function fitAllNameFields(){ MODULES.forEach(fitNameField); }
// Save-disk icon with a red asterisk badge (top-right): shown on the project-bar
// Save button when an open project has unsaved changes — this replaces the old
// "*" marker next to the name.
const SAVE_STAR_ICON = '<svg class="proj-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/><g stroke="#ff5050" stroke-width="2.2"><line x1="19" y1="1.9" x2="19" y2="7.1"/><line x1="16.75" y1="3.2" x2="21.25" y2="5.8"/><line x1="16.75" y1="5.8" x2="21.25" y2="3.2"/></g></svg>';
// Put the dirty (asterisk) or clean disk icon on the project-bar Save icon button.
// origHtml is captured pristine at startup, so it is always the plain disk.
function setSaveDirtyIcon(mod, dirtyState){
  saveBtns(mod).forEach(b=>{
    if (!b.classList.contains('proj-icon')) return;
    b.innerHTML = dirtyState ? SAVE_STAR_ICON : (b.dataset.origHtml ?? b.innerHTML);
  });
  normalizeProjIcons(mod);
}
function restoreSaveBtns(mod){
  saveBtns(mod).forEach(b=>{
    b.classList.remove('is-saved'); b.disabled = false;
    if (b.dataset.origHtml !== undefined) b.innerHTML = b.dataset.origHtml;
  });
}
// Saved state: green non-interactive Save buttons, no unsaved marker; arms a
// one-shot listener so the next change flips back to dirty.
function markSaved(mod){
  const t = activeTab();
  // The tab record is kept for saved projects too — it is the persistent working
  // state that comes back on the next load. Re-persist it so it records the saved
  // (not-dirty) status, and drop the "*" from the tab.
  if (t){ setTabDirty(t.id, false); if (!isRestoring()) persistTab(t); }
  saveBtns(mod).forEach(b=>{
    if (b.dataset.origHtml === undefined) b.dataset.origHtml = b.innerHTML;
    b.classList.add('is-saved');
    b.disabled = true;
    b.innerHTML = b.classList.contains('proj-icon') ? CHECK_ICON : ('Saved ' + CHECK_SM);
  });
  fitNameField(mod);
  onModuleChangeOnce(mod, ()=> markDirty(mod));
}
// Unsaved changes (data edit, a file removal, or a rename in the field). Removing
// files is a normal edit — it never clears the project; only deleting it does,
// and that closes the tab.
function markDirty(mod){
  const t = activeTab();
  if (t) setTabDirty(t.id, true);   // "*" on the tab label
  restoreSaveBtns(mod);
  // Badge the Save icon with a red asterisk when an open project has changes.
  setSaveDirtyIcon(mod, !!curProject());
}

/* ---- Save / Save as ----
   Save: writes the current project under the name in the field (renaming it if
   the field was edited); creates it if none is open yet. Save as: prompts for a
   new name and always creates a NEW project, which becomes the open one. */
// Briefly flash a field red + shake (no browser dialog) to signal a missing name
function flashInvalid(inp){
  if (!inp) return;
  inp.classList.remove('field-invalid'); void inp.offsetWidth; // restart the animation
  inp.classList.add('field-invalid');
  inp.focus();
}
// Returns true when the project was actually written, false on any abort (no data,
// missing name, or a declined overwrite) — callers like "New project" rely on this.
async function doSave(mod, asNew){
  if (!moduleHasData(mod)){ await confirmBanner('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.', 'OK'); return false; }
  if (asNew){ openSaveAsModal(mod); return false; }

  const t = activeTab();
  const inp = nameInput(mod);
  const now = Date.now();
  const title = inp ? inp.value.trim() : '';
  if (!title){ flashInvalid(inp); return false; }
  const state = encode(getModuleState(mod));
  const all = await allProjects();
  const cur = curProject();
  if (cur){
    const clash = all.find(s=> s.module===mod && s.id!==cur.id && s.title.toLowerCase()===title.toLowerCase());
    if (clash && !await confirmBanner('Another ' + (MODULE_LABELS[mod]||mod) + ' project is named “' + clash.title + '”. Save under this name anyway?', 'Save')) return false;
    const rec = all.find(s=> s.id===cur.id);
    await putProject({ id: cur.id, module: mod, title, createdAt: rec ? rec.createdAt : now, state, updatedAt: now });
    if (t) setTabProject(t.id, cur.id, title);
  } else {
    const existing = all.find(s=> s.module===mod && s.title.toLowerCase()===title.toLowerCase());
    let id;
    if (existing){
      if (!await confirmBanner('A ' + (MODULE_LABELS[mod]||mod) + ' project named “' + existing.title + '” already exists. Overwrite it?', 'Overwrite')) return false;
      id = existing.id; await putProject({ ...existing, title, state, updatedAt: now });
    } else { id = uid(); await putProject({ id, module: mod, title, state, createdAt: now, updatedAt: now }); }
    if (t) setTabProject(t.id, id, title);
  }
  markSaved(mod); renderList();
  return true;
}

/* ---- Export current module as .json ---- */
async function exportJson(mod){
  if (!moduleHasData(mod)){ await confirmBanner('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.', 'OK'); return; }
  const inp = nameInput(mod);
  const now = Date.now();
  const cur = curProject();
  const title = (inp && inp.value.trim()) || (cur ? cur.title : (MODULE_LABELS[mod]||mod));
  const payload = { datatreat_session: 1, module: mod, title, createdAt: now, updatedAt: now,
                    state: encode(getModuleState(mod)) };
  const safe = title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'project';
  downloadTextFile(mod + '_' + safe + '.json', JSON.stringify(payload));
}

/* ---- Save as… — custom in-page modal (no browser prompt) ---- */
let _saveAsMod = null;
function openSaveAsModal(mod){
  _saveAsMod = mod;
  const modal = document.getElementById('projSaveAsModal');
  const inp = document.getElementById('projSaveAsInput');
  const src = nameInput(mod);
  inp.value = (src && src.value.trim()) || '';
  inp.classList.remove('field-invalid');
  modal.style.display = 'flex';
  setTimeout(()=>{ inp.focus(); inp.select(); }, 0);
}
function closeSaveAsModal(){ document.getElementById('projSaveAsModal').style.display = 'none'; _saveAsMod = null; }
async function commitSaveAs(){
  const mod = _saveAsMod; if (!mod) return;
  const inp = document.getElementById('projSaveAsInput');
  const title = inp.value.trim();
  if (!title){ flashInvalid(inp); return; }
  const now = Date.now();
  const state = encode(getModuleState(mod));
  const all = await allProjects();
  const existing = all.find(s=> s.module===mod && s.title.toLowerCase()===title.toLowerCase());
  let id;
  if (existing){
    if (!await confirmBanner('A ' + (MODULE_LABELS[mod]||mod) + ' project named “' + existing.title + '” already exists. Overwrite it?', 'Overwrite')) return;
    id = existing.id; await putProject({ ...existing, title, state, updatedAt: now });
  } else { id = uid(); await putProject({ id, module: mod, title, state, createdAt: now, updatedAt: now }); }
  renderList();
  closeSaveAsModal();
  // Save as makes a copy: the tab we came from keeps its own project untouched,
  // and the copy opens alongside it in a tab of its own (already saved → clean).
  await openTab({ module: mod, title, projectId: id, state, dirty: false });
}

/* ---- Open projects (from the Projects tab) ----
   Each project opens in its own tab, so any number can be open at once, several on
   the same technique. Nothing is ever replaced, and a project that is already open
   is skipped rather than focused (openTab handles that). */
async function openProjects(recs){
  for (const r of recs){
    // Background: the tab appears in the bar but you stay on the Projects list.
    await openTab({ module: r.module, title: r.title, projectId: r.id, state: r.state, dirty: false, focus: false });
  }
}

/* ---- Export a saved project record / import a .json ---- */
function exportProjectRecord(rec){
  const payload = { datatreat_session: 1, module: rec.module, title: rec.title,
                    createdAt: rec.createdAt, updatedAt: rec.updatedAt, state: rec.state };
  const safe = rec.title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'project';
  downloadTextFile(rec.module + '_' + safe + '.json', JSON.stringify(payload));
}
async function importProjectFile(file){
  let obj;
  try { obj = JSON.parse(await file.text()); }
  catch(e){ await confirmBanner('Not a valid JSON file.', 'OK'); return; }
  if (!obj || !obj.datatreat_session || !MODULES.includes(obj.module) || !obj.state){
    await confirmBanner('This file is not a DataTreat project.', 'OK'); return;
  }
  const now = Date.now();
  await putProject({ id: uid(), module: obj.module, title: (obj.title||'Imported project').trim(),
                     state: obj.state, createdAt: obj.createdAt||now, updatedAt: now });
  renderList();
}

/* ---- Projects list rendering ---- */
let _cache = [];
let _sortKey = 'updatedAt', _sortDir = -1;
function sortRows(rows){
  const k = _sortKey;
  return rows.sort((a,b)=>{
    if (k==='updatedAt'){ return ((a.updatedAt||0) - (b.updatedAt||0)) * _sortDir; }
    let av, bv;
    if (k==='module'){ av=(MODULE_LABELS[a.module]||a.module); bv=(MODULE_LABELS[b.module]||b.module); }
    else { av=a.title||''; bv=b.title||''; }
    return av.localeCompare(bv) * _sortDir;
  });
}
const arrow = key => _sortKey===key ? (_sortDir===1 ? ' ▲' : ' ▼') : '';
function passesFilter(rec){
  const name = (document.getElementById('sessFilterName').value || '').trim().toLowerCase();
  const mod  = document.getElementById('sessFilterModule').value;
  if (mod && rec.module !== mod) return false;
  if (name && !rec.title.toLowerCase().includes(name)) return false;
  return true;
}
function selectedRecs(){
  return [...document.querySelectorAll('#sessListWrap tr.sess-row')]
    .filter(tr=> tr.querySelector('.sess-check') && tr.querySelector('.sess-check').checked)
    .map(tr=> recById(tr.dataset.id)).filter(Boolean);
}
function updateBulkState(){
  const n = selectedRecs().length;
  document.getElementById('sessOpenSelected').disabled = n === 0;
  ['sessDeleteSelected','sessCsvSelected','sessJsonSelected'].forEach(id=>{
    const b = document.getElementById(id); if (b) b.disabled = n === 0;
  });
}
async function renderList(){
  _cache = (await allProjects()).sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
  const wrap = document.getElementById('sessListWrap');
  if (!wrap) return;
  const rows = sortRows(_cache.filter(passesFilter));
  if (!_cache.length){ wrap.innerHTML = '<p class="txt-meta">No saved projects yet. Load data in a module and press “Save project”.</p>'; updateBulkState(); return; }
  if (!rows.length){ wrap.innerHTML = '<p class="txt-meta">No projects match the current filters.</p>'; updateBulkState(); return; }
  // checkbox fixed, actions sized to its icons, the rest split the remaining space equally
  let html = '<div class="table-wrap-box sess-table-box"><table class="sess-table"><colgroup><col style="width:30px"><col><col><col><col style="width:104px"></colgroup>'
    + '<thead><tr><th></th>'
    + '<th class="sess-sort" data-key="title" style="cursor:pointer">NAME'+arrow('title')+'</th>'
    + '<th class="sess-sort" data-key="module" style="cursor:pointer">MODULE'+arrow('module')+'</th>'
    + '<th class="sess-sort" data-key="updatedAt" style="cursor:pointer">SAVED'+arrow('updatedAt')+'</th>'
    + '<th></th></tr></thead><tbody>';
  rows.forEach(r=>{
    html += '<tr class="sess-row" data-id="'+r.id+'" title="Click to open">'
      + '<td><input type="checkbox" class="sess-check" style="width:auto"></td>'
      + '<td><input type="text" class="proj-rename" value="'+r.title.replace(/"/g,'&quot;')+'"></td>'
      + '<td style="white-space:nowrap"><span class="pill">'+(MODULE_LABELS[r.module]||r.module)+'</span></td>'
      + '<td style="color:var(--muted)">'+fmtDate(r.updatedAt)+'</td>'
      + '<td class="row-acts"><div class="row-acts-inner idle-dim">'
        + '<button class="row-ic pr-csv" title="Export .csv">'+ROW_CSV+'</button>'
        + '<button class="row-ic pr-json" title="Export .json">'+ROW_JSON+'</button>'
        + '<button class="row-ic pr-del" title="Delete">'+ROW_TRASH+'</button>'
      + '</div></td></tr>';
  });
  html += '</tbody></table></div>';
  wrap.innerHTML = html;
  updateBulkState();
}
function recById(id){ return _cache.find(s=> s.id === id); }
function exportProjectCsv(rec){ runWithModuleState(rec.module, decode(rec.state), ()=> runCsvExport(rec.module)); }
async function renameProject(rec, t){
  t = (t||'').trim();
  if (!t || t === rec.title) return;
  await putProject({ ...rec, title:t, updatedAt: Date.now() });
  // A renamed project that is open in a tab updates that tab's label (and the name
  // field, when it happens to be the active one).
  const open = tabByProject(rec.id);
  if (open){
    setTabTitle(open.id, t);
    if (open === activeTab()){ const inp = nameInput(rec.module); if (inp) inp.value = t; }
  }
  renderList();
}
// Deleting a stored project closes the tab it is open in, if any — an open tab
// always stands for a project that exists.
async function deleteProjectRec(rec){
  await deleteProject(rec.id);
  const open = tabByProject(rec.id);
  if (open) closeTab(open.id);
}

// Project-bar trash button: delete the project this tab holds, then close the tab.
//  • Saved project → confirm "delete «name»" (Delete + cancel).
//  • Never saved   → nothing is stored yet, so just confirm losing the work.
async function deleteOpenProject(mod){
  const t = activeTab(); if (!t) return;
  const cur = curProject();
  // An empty file list means there is nothing to lose, named or not: delete the
  // stored project (if any) and close the tab without asking.
  if (!moduleHasData(mod)){
    if (cur) await deleteProject(cur.id);
    closeTab(t.id);
    renderList();
    return;
  }
  if (cur){
    if (!await confirmBanner('Are you sure to delete “'+cur.title+'”? This action is permanent.', 'Delete')) return;
    await deleteProject(cur.id);
  } else {
    if (!await confirmBanner('“'+t.title+'” was never saved. Discard it? All work in this tab will be lost.', 'Discard')) return;
  }
  closeTab(t.id);
  renderList();
}
// New project: force a Save / Don't save / cancel choice when there are unsaved
// changes, then start from a clean default module. Saved+clean starts fresh at once.
// New project: pick a technique in the mini-home modal, then open it in a tab of
// its own. Nothing about the current tab changes — the new project sits beside it,
// so there is nothing to save or discard first.
function newProject(){ openTechniqueModal(); }

/* ---- New-project technique picker (mini home) ---- */
function openTechniqueModal(){
  const m = document.getElementById('projNewModal');
  if (m) m.style.display = 'flex';
}
function closeTechniqueModal(){
  const m = document.getElementById('projNewModal');
  if (m) m.style.display = 'none';
}

/* ---- Wiring ---- */
// Capture each Save button's pristine markup once, before any state swap, so the
// disk icon / "Save project" text can always be restored (and never captured
// while showing the check or the dirty-asterisk variant).
document.querySelectorAll('.proj-save').forEach(b=>{ if (b.dataset.origHtml === undefined) b.dataset.origHtml = b.innerHTML; });

// Project action buttons (top icon row + bottom text row), via delegation
document.addEventListener('click', async e=>{
  const b = e.target.closest('.proj-save, .proj-saveas, .proj-csv, .proj-json, .proj-del, .proj-new');
  if (!b || b.disabled) return;
  // The delete / new-project buttons carry no data-module; take it from their project-bar.
  const mod = b.dataset.module || (b.closest('.project-bar') || {}).dataset && b.closest('.project-bar').dataset.module;
  const isExport = b.classList.contains('proj-save') || b.classList.contains('proj-saveas')
                || b.classList.contains('proj-csv')  || b.classList.contains('proj-json');
  // Save / Save as / export need files; with an empty list say so (delete & new are fine).
  if (isExport && !moduleHasData(mod)){ await confirmBanner('Project file list is empty.', 'OK'); return; }
  if (b.classList.contains('proj-save'))        doSave(mod, false);
  else if (b.classList.contains('proj-saveas')) doSave(mod, true);
  else if (b.classList.contains('proj-csv'))    runCsvExport(mod);
  else if (b.classList.contains('proj-json'))   exportJson(mod);
  else if (b.classList.contains('proj-del'))    deleteOpenProject(mod);
  else if (b.classList.contains('proj-new'))    newProject();
});
// Mini-home modal: pick a technique → a blank project opens in a new tab.
(function initTechniqueModal(){
  const modal = document.getElementById('projNewModal');
  if (!modal) return;
  modal.addEventListener('click', async e=>{
    if (e.target === modal || e.target.closest('[data-new-cancel]')){ closeTechniqueModal(); return; }
    const card = e.target.closest('[data-new-module]');
    if (!card) return;
    closeTechniqueModal();
    await openTab({ module: card.dataset.newModule });
  });
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && modal.style.display === 'flex') closeTechniqueModal();
  });
})();
// Editing the project name marks a pending change, clears the red "missing name"
// state, and updates the project-bar visibility (a name alone reveals the buttons).
document.querySelectorAll('.project-name-input').forEach(inp=>{
  const mod = inp.dataset.module;
  inp.addEventListener('input', ()=>{
    inp.classList.remove('field-invalid');
    fitNameField(mod);
    refreshProjBar(mod);
    const t = activeTab();
    if (t) setTabTitle(t.id, inp.value.trim());   // the tab label tracks the field
    if (moduleHasData(mod)){ markDirty(mod); scheduleAutosave(); }
  });
  inp.addEventListener('focus', ()=> fitNameField(mod));   // click triggers adaptivity
  inp.addEventListener('blur',  ()=> fitNameField(mod));   // empty → ghost width; filled → ellipsis
});
window.addEventListener('resize', fitAllNameFields);   // 3/4-width cap tracks the bar

// Save as… modal
document.getElementById('projSaveAsCancel').addEventListener('click', closeSaveAsModal);
document.getElementById('projSaveAsOk').addEventListener('click', commitSaveAs);
document.getElementById('projSaveAsModal').addEventListener('click', e=>{ if (e.target.id==='projSaveAsModal') closeSaveAsModal(); });
document.getElementById('projSaveAsInput').addEventListener('input', e=> e.target.classList.remove('field-invalid'));
document.getElementById('projSaveAsInput').addEventListener('keydown', e=>{
  if (e.key==='Enter'){ e.preventDefault(); commitSaveAs(); }
  else if (e.key==='Escape'){ closeSaveAsModal(); }
});

(function fillModuleFilter(){
  const sel = document.getElementById('sessFilterModule');
  if (!sel) return;
  MODULES.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.textContent=MODULE_LABELS[m]||m; sel.appendChild(o); });
})();
document.getElementById('sessFilterName').addEventListener('input', renderList);
document.getElementById('sessFilterModule').addEventListener('change', renderList);
document.getElementById('sessOpenSelected').addEventListener('click', ()=>{
  const recs = selectedRecs();
  if (recs.length) openProjects(recs);
});
document.getElementById('sessDeleteSelected').addEventListener('click', async ()=>{
  const recs = selectedRecs();
  if (!recs.length) return;
  if (!await confirmBanner('Delete '+recs.length+' selected project'+(recs.length>1?'s':'')+'? This cannot be undone.', 'Delete')) return;
  for (const r of recs) await deleteProjectRec(r);
  renderList();
});
document.getElementById('sessCsvSelected').addEventListener('click', ()=>{ selectedRecs().forEach(exportProjectCsv); });
document.getElementById('sessJsonSelected').addEventListener('click', ()=>{ selectedRecs().forEach(exportProjectRecord); });
document.getElementById('sessImportBtn').addEventListener('click', ()=> document.getElementById('sessImportFile').click());
document.getElementById('sessImportFile').addEventListener('change', async e=>{
  const files = [...(e.target.files||[])];
  for (const f of files) await importProjectFile(f);
  e.target.value = '';
});
// Sort headers, per-row icon actions, and click-row-to-open
document.getElementById('sessListWrap').addEventListener('click', async e=>{
  const th = e.target.closest('.sess-sort');
  if (th){
    const key = th.dataset.key;
    if (_sortKey === key) _sortDir = -_sortDir;
    else { _sortKey = key; _sortDir = (key==='updatedAt') ? -1 : 1; }
    renderList(); return;
  }
  const tr = e.target.closest('tr.sess-row');
  if (!tr) return;
  const rec = recById(tr.dataset.id);
  if (!rec) return;
  if (e.target.closest('.pr-csv'))  { exportProjectCsv(rec); return; }
  if (e.target.closest('.pr-json')) { exportProjectRecord(rec); return; }
  if (e.target.closest('.pr-del'))  {
    if (await confirmBanner('Delete project “'+rec.title+'”? This cannot be undone.', 'Delete')){ await deleteProjectRec(rec); renderList(); }
    return;
  }
  // Clicks on the checkbox, the name field, or a button don't open the project
  if (e.target.closest('input, button, .row-acts')) return;
  openProjects([rec]);
});
// Inline rename (commit on Enter or blur); typing here must not open the row
document.getElementById('sessListWrap').addEventListener('keydown', e=>{
  if (e.target.classList.contains('proj-rename') && e.key==='Enter'){ e.preventDefault(); e.target.blur(); }
});
// Hover (grey) / press (light accent) highlight for the whole row EXCEPT the
// name field. Driven by classes so we can exclude the name input from the trigger.
(function(){
  const wrap = document.getElementById('sessListWrap');
  const overName = t => !!(t && t.closest && t.closest('.proj-rename'));
  wrap.addEventListener('mouseover', e=>{
    const row = e.target.closest && e.target.closest('.sess-row');
    if (!row) return;
    row.classList.toggle('row-hot', !overName(e.target));
    if (overName(e.target)) row.classList.remove('row-press');
  });
  wrap.addEventListener('mouseout', e=>{
    const row = e.target.closest && e.target.closest('.sess-row');
    if (row && !row.contains(e.relatedTarget)) row.classList.remove('row-hot','row-press');
  });
  wrap.addEventListener('mousedown', e=>{
    const row = e.target.closest && e.target.closest('.sess-row');
    // Pressing the name field or the checkbox must not flash the row
    if (row && !overName(e.target) && !e.target.closest('.sess-check')) row.classList.add('row-press');
  });
  document.addEventListener('mouseup', ()=> wrap.querySelectorAll('.sess-row.row-press').forEach(r=>r.classList.remove('row-press')));
})();
document.getElementById('sessListWrap').addEventListener('change', e=>{
  if (e.target.classList.contains('sess-check')){ updateBulkState(); return; }
  if (e.target.classList.contains('proj-rename')){
    const tr = e.target.closest('tr.sess-row'); const rec = recById(tr && tr.dataset.id);
    if (rec) renameProject(rec, e.target.value);
  }
});

document.querySelector('#nav button[data-tab="projects"]').addEventListener('click', renderList);
renderList();

/* ---- Tab wiring ---- */
MODULES.forEach(m=> onModuleChange(m, ()=>{
  scheduleAutosave();
  // A tab that was never saved is unsaved by definition, so any edit marks it —
  // for saved projects the one-shot listener armed by markSaved does the job.
  const t = activeTab();
  if (t && !t.projectId) markDirty(m);
}));

// Called by the tab manager once a tab's state is live in its module: put the
// project bar in that tab's shape (name, saved/dirty buttons).
onTabActivated(tab=>{
  if (!tab) return;
  const mod = tab.module;
  const inp = nameInput(mod);
  if (inp) inp.value = tab.title || '';
  if (tab.projectId && !tab.dirty) markSaved(mod);
  else { restoreSaveBtns(mod); setSaveDirtyIcon(mod, !!tab.projectId && tab.dirty); }
  refreshProjBar(mod);
  normalizeProjIcons(mod);
  requestAnimationFrame(()=> fitNameField(mod));
});
// Closing a tab may offer to save it first; the tab manager has no access to the
// project store, so it calls back in here.
onCloseSave(tab=> doSave(tab.module, false));

initTabs();

// Flush the active tab immediately when the page is hidden/unloaded (Chrome's
// desktop⇄mobile switch reloads the page, tab close, refresh) so changes made in
// the last few seconds aren't lost to the debounce. Best-effort: visibilitychange
// (hidden) fires early enough for IndexedDB to commit; pagehide is the backstop.
function flushTabs(){ const t = activeTab(); if (t) persistTab(t); }
document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') flushTabs(); });
window.addEventListener('pagehide', flushTabs);
// No beforeunload nag: the open tabs come back on the next load, so a reload
// never loses work.
