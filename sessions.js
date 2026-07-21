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
         moduleHasData, onModuleChangeOnce, onModuleChange, runCsvExport, runWithModuleState, X_SVG } from './utils.js';

// Row action icons: the exact CSV/JSON glyphs used in the module toolbars
// (text over a right-pointing arrow) and the rounded X for delete.
const ROW_DOC = (txt, fs) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><text x="12" y="11" font-size="'+fs+'" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">'+txt+'</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>';
const ROW_CSV = ROW_DOC('CSV', 8.5), ROW_JSON = ROW_DOC('JSON', 8.5), ROW_X = X_SVG(16);

/* ---- IndexedDB tiny wrapper (store kept as 'sessions' for data continuity;
   'drafts' holds one autosave per module for crash recovery) ---- */
const DB_NAME = 'datatreat', STORE = 'sessions', DRAFTS = 'drafts', DB_VER = 2;
function idb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath:'id' });
        os.createIndex('module', 'module', { unique:false });
      }
      if (!db.objectStoreNames.contains(DRAFTS)){
        db.createObjectStore(DRAFTS, { keyPath:'module' });
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror   = ()=> reject(req.error);
  });
}
async function txStore(store, mode, fn){
  const db = await idb();
  return new Promise((resolve, reject)=>{
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let out;
    Promise.resolve(fn(os)).then(v=>{ out = v; });
    t.oncomplete = ()=> resolve(out);
    t.onerror = ()=> reject(t.error);
    t.onabort = ()=> reject(t.error);
  });
}
const tx = (mode, fn)=> txStore(STORE, mode, fn);
const reqP = r => new Promise((res, rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
async function allProjects(){ return tx('readonly', os=> reqP(os.getAll())); }
async function putProject(rec){ return tx('readwrite', os=>{ os.put(rec); }); }
async function deleteProject(id){ return tx('readwrite', os=>{ os.delete(id); }); }
async function putDraft(rec){ return txStore(DRAFTS, 'readwrite', os=>{ os.put(rec); }); }
async function getAllDrafts(){ return txStore(DRAFTS, 'readonly', os=> reqP(os.getAll())); }
async function deleteDraft(mod){ return txStore(DRAFTS, 'readwrite', os=>{ os.delete(mod); }); }

/* ---- helpers ---- */
const uid = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Encode module state into a JSON-safe form: typed arrays → plain arrays, Date
// objects → a tagged marker. Same representation for IndexedDB and .json.
function encode(v){
  if (v instanceof Date) return { __t:'date', v:v.getTime() };
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object'){ const o = {}; for (const k in v) o[k] = encode(v[k]); return o; }
  return v;
}
function decode(v){
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === 'object'){
    if (v.__t === 'date') return new Date(v.v);
    const o = {}; for (const k in v) o[k] = decode(v[k]); return o;
  }
  return v;
}
function fmtDate(ts){ try { return new Date(ts).toLocaleString(); } catch(e){ return ''; } }
function downloadTextFile(name, text, type){
  const url = URL.createObjectURL(new Blob([text], { type: type||'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

/* ---- Per-module open-project state ---- */
const current = {};   // mod -> { id, title }
const dirty = {};     // mod -> bool

/* ---- Autosave (crash-recovery draft) ----
   5 s after the last change, save the module's state to the 'drafts' store whenever
   the module holds data — named or not — so a reload (incl. Chrome's desktop/mobile
   switch, which reloads the page) doesn't wipe unsaved work. Cleared on Save / data
   loss. A draft ≠ a saved project: on restore it comes back as unsaved work that
   still needs an explicit Save. */
const AUTOSAVE_MS = 5000;
const _autosaveTimers = {};
function scheduleAutosave(mod){
  // No data (e.g. all files removed) → drop the module's draft right away so a reload
  // doesn't bring back emptied work.
  if (!moduleHasData(mod)){ clearDraft(mod); return; }
  // Leading edge: save right away on the first change (e.g. as soon as data loads),
  // so an immediate reload is already covered; then debounce the trailing save.
  if (!_autosaveTimers[mod]) saveDraft(mod);
  clearTimeout(_autosaveTimers[mod]);
  _autosaveTimers[mod] = setTimeout(()=>{ _autosaveTimers[mod] = null; saveDraft(mod); }, AUTOSAVE_MS);
}
async function saveDraft(mod){
  if (!moduleHasData(mod)) return;   // autosave any module that still holds data
  const inp = nameInput(mod);
  const title = inp ? inp.value.trim() : '';
  try {
    const rec = { module: mod, title, state: encode(getModuleState(mod)), updatedAt: Date.now() };
    if (current[mod]) rec.id = current[mod].id;  // keep the association so Save updates the right project
    await putDraft(rec);
  } catch(e){}
}
function clearDraft(mod){
  clearTimeout(_autosaveTimers[mod]);
  deleteDraft(mod).catch(()=>{});
}

const CHECK_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const CHECK_SM = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

function saveBtns(mod){ return [...document.querySelectorAll('.proj-save[data-module="'+mod+'"]')]; }
function nameInput(mod){ return document.querySelector('.project-name-input[data-module="'+mod+'"]'); }
function dirtyMark(mod){ return document.querySelector('.pb-dirty[data-module="'+mod+'"]'); }
function restoreSaveBtns(mod){
  saveBtns(mod).forEach(b=>{
    b.classList.remove('is-saved'); b.disabled = false;
    if (b.dataset.origHtml !== undefined) b.innerHTML = b.dataset.origHtml;
  });
}
// Saved state: green non-interactive Save buttons, no unsaved marker; arms a
// one-shot listener so the next change flips back to dirty.
function markSaved(mod){
  dirty[mod] = false;
  // NB: the draft is kept even for saved projects — it is the persistent working
  // state that gets auto-restored on the next load (cleared only when data is gone).
  saveBtns(mod).forEach(b=>{
    if (b.dataset.origHtml === undefined) b.dataset.origHtml = b.innerHTML;
    b.classList.add('is-saved');
    b.disabled = true;
    b.innerHTML = b.classList.contains('proj-icon') ? CHECK_ICON : ('Saved ' + CHECK_SM);
  });
  const dm = dirtyMark(mod); if (dm) dm.style.display = 'none';
  onModuleChangeOnce(mod, ()=> markDirty(mod));
}
// Unsaved changes (data edit or a rename in the field). Losing all data clears
// the project association and the field entirely.
function markDirty(mod){
  if (!moduleHasData(mod)){
    delete current[mod]; dirty[mod] = false;
    const inp = nameInput(mod); if (inp) inp.value = '';
    const dm = dirtyMark(mod); if (dm) dm.style.display = 'none';
    restoreSaveBtns(mod);
    clearDraft(mod);   // no data left → nothing to recover
    return;
  }
  dirty[mod] = true;
  restoreSaveBtns(mod);
  const dm = dirtyMark(mod); if (dm) dm.style.display = current[mod] ? 'inline-block' : 'none';
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
async function doSave(mod, asNew){
  if (!moduleHasData(mod)){ alert('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.'); return; }
  if (asNew){ openSaveAsModal(mod); return; }

  const inp = nameInput(mod);
  const now = Date.now();
  const title = inp ? inp.value.trim() : '';
  if (!title){ flashInvalid(inp); return; }
  const state = encode(getModuleState(mod));
  const all = await allProjects();
  const cur = current[mod];
  if (cur){
    const clash = all.find(s=> s.module===mod && s.id!==cur.id && s.title.toLowerCase()===title.toLowerCase());
    if (clash && !confirm('Another ' + (MODULE_LABELS[mod]||mod) + ' project is named “' + clash.title + '”. Save under this name anyway?')) return;
    const rec = all.find(s=> s.id===cur.id);
    await putProject({ id: cur.id, module: mod, title, createdAt: rec ? rec.createdAt : now, state, updatedAt: now });
    current[mod] = { id: cur.id, title };
  } else {
    const existing = all.find(s=> s.module===mod && s.title.toLowerCase()===title.toLowerCase());
    let id;
    if (existing){
      if (!confirm('A ' + (MODULE_LABELS[mod]||mod) + ' project named “' + existing.title + '” already exists. Overwrite it?')) return;
      id = existing.id; await putProject({ ...existing, title, state, updatedAt: now });
    } else { id = uid(); await putProject({ id, module: mod, title, state, createdAt: now, updatedAt: now }); }
    current[mod] = { id, title };
  }
  markSaved(mod); renderList();
}

/* ---- Export current module as .json ---- */
function exportJson(mod){
  if (!moduleHasData(mod)){ alert('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.'); return; }
  const inp = nameInput(mod);
  const now = Date.now();
  const title = (inp && inp.value.trim()) || (current[mod] ? current[mod].title : (MODULE_LABELS[mod]||mod));
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
    if (!confirm('A ' + (MODULE_LABELS[mod]||mod) + ' project named “' + existing.title + '” already exists. Overwrite it?')) return;
    id = existing.id; await putProject({ ...existing, title, state, updatedAt: now });
  } else { id = uid(); await putProject({ id, module: mod, title, state, createdAt: now, updatedAt: now }); }
  current[mod] = { id, title };
  const fld = nameInput(mod); if (fld) fld.value = title;
  markSaved(mod); renderList();
  closeSaveAsModal();
}

/* ---- Open projects (from the Projects tab) ---- */
async function openProjects(recs){
  const seen = new Set();
  for (const r of recs){
    if (seen.has(r.module)){ alert('You selected more than one ' + (MODULE_LABELS[r.module]||r.module) + ' project. Open only one project per module at a time.'); return; }
    seen.add(r.module);
  }
  for (const r of recs){
    if (moduleHasData(r.module)){
      if (!confirm('The ' + (MODULE_LABELS[r.module]||r.module) + ' module already has data loaded. Replace it with “' + r.title + '”?')) return;
    }
  }
  for (const r of recs){
    restoreModuleState(r.module, decode(r.state));
    current[r.module] = { id: r.id, title: r.title };
    const inp = nameInput(r.module); if (inp) inp.value = r.title;
    markSaved(r.module); // freshly opened → no unsaved changes
  }
  // Never switch tabs on open — the user stays on the Projects page.
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
  catch(e){ alert('Not a valid JSON file.'); return; }
  if (!obj || !obj.datatreat_session || !MODULES.includes(obj.module) || !obj.state){
    alert('This file is not a DataTreat project.'); return;
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
      + '<td class="row-acts"><div class="row-acts-inner">'
        + '<button class="row-ic pr-csv" title="Export .csv">'+ROW_CSV+'</button>'
        + '<button class="row-ic pr-json" title="Export .json">'+ROW_JSON+'</button>'
        + '<button class="row-ic pr-del" title="Delete">'+ROW_X+'</button>'
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
  if (current[rec.module] && current[rec.module].id === rec.id){
    current[rec.module].title = t;
    const inp = nameInput(rec.module); if (inp) inp.value = t;
  }
  renderList();
}
async function deleteProjectRec(rec){
  await deleteProject(rec.id);
  if (current[rec.module] && current[rec.module].id === rec.id){
    delete current[rec.module];
    const inp = nameInput(rec.module); if (inp) inp.value = '';
    const dm = dirtyMark(rec.module); if (dm) dm.style.display = 'none';
    restoreSaveBtns(rec.module);
  }
}

/* ---- Wiring ---- */
// Project action buttons (top icon row + bottom text row), via delegation
document.addEventListener('click', e=>{
  const b = e.target.closest('.proj-save, .proj-saveas, .proj-csv, .proj-json');
  if (!b || b.disabled) return;
  const mod = b.dataset.module;
  if (b.classList.contains('proj-save'))        doSave(mod, false);
  else if (b.classList.contains('proj-saveas')) doSave(mod, true);
  else if (b.classList.contains('proj-csv'))    runCsvExport(mod);
  else if (b.classList.contains('proj-json'))   exportJson(mod);
});
// Editing the project name is an unsaved change (a pending rename); typing also
// clears the red "missing name" state.
document.querySelectorAll('.project-name-input').forEach(inp=>{
  inp.addEventListener('input', ()=>{
    inp.classList.remove('field-invalid');
    if (moduleHasData(inp.dataset.module)){ markDirty(inp.dataset.module); scheduleAutosave(inp.dataset.module); }
  });
});

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
  if (!confirm('Delete '+recs.length+' selected project'+(recs.length>1?'s':'')+'? This cannot be undone.')) return;
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
    if (confirm('Delete project “'+rec.title+'”? This cannot be undone.')){ await deleteProjectRec(rec); renderList(); }
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

/* ---- Autosave subscription + silent session restore ---- */
MODULES.forEach(m=> onModuleChange(m, ()=> scheduleAutosave(m)));

// On load, silently reload every module's draft — no banner, no confirmation. The
// draft is the persistent working state, so the app comes back exactly as it was.
async function initDraftRecovery(){
  let drafts;
  try { drafts = await getAllDrafts(); } catch(e){ return; }
  drafts = (drafts || []).filter(d=> d && d.state);   // title may be empty (unnamed work)
  if (!drafts.length) return;
  drafts.forEach(d=>{
    try {
      restoreModuleState(d.module, decode(d.state));
      const inp = nameInput(d.module); if (inp) inp.value = d.title || '';
      if (d.id) current[d.module] = { id: d.id, title: d.title };
      markDirty(d.module);   // comes back as unsaved work until an explicit Save
    } catch(e){}
  });
  renderList();
}
initDraftRecovery();

// Flush pending drafts immediately when the page is hidden/unloaded (Chrome's
// desktop⇄mobile switch reloads the page, tab close, refresh) so changes made in
// the last few seconds aren't lost to the debounce. Best-effort: visibilitychange
// (hidden) fires early enough for IndexedDB to commit; pagehide is the backstop.
function flushDrafts(){ MODULES.forEach(m=>{ if (moduleHasData(m)) saveDraft(m); }); }
document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') flushDrafts(); });
window.addEventListener('pagehide', flushDrafts);
// No beforeunload nag: the session auto-restores on the next load, so a reload
// never loses work.
