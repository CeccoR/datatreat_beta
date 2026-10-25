/* =========================================================
   PROJECT MANAGER
   Save/restore a whole module's state (raw data + parameters + fits) to
   IndexedDB as a named "project", with .datatreat export/import and a per-module
   CSV export. A dedicated "Projects" tab lists every saved project, filterable by
   name and module. Each module shows its open project's name (white, with a
   "*" when there are unsaved changes); the Save buttons sit in a green "saved"
   state until the next change.
========================================================= */
import { MODULES, MODULE_LABELS, esc, moduleStateKey, getModuleState,
         moduleHasData, runCsvExport, X_SVG, confirmBanner, normalizeProjIcons, refreshProjBar, onSectionChange,
         moduleBusy, onAnyChange, withState } from './utils.js';
import { allProjects, putProject, deleteProject, retitleProject, readProject, exportedProject, uid, encode, decode,
         hydrate, sweepSoon, dbBlocked, onDbBlocked, onDbClosing, onDbClosed } from './db.js';
import { activeTab, tabById, tabByProject, openTab, closeTab, setTabTitle,
         setTabDirty, setTabProject, onTabActivated, onTabLoaded, onCloseSave, initTabs,
         persistTab, persistMoved, isRestoring, isLive, ensureLive, notice, renderTabs,
         keyOf, tabOfKey, stateOf, isEmpty, UNTITLED, underLoader } from './tabs.js';

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
   null when it was never saved) and its `dirty` flag drives the "*". The project bar is
   the active tab's; a save, the autosave and the unsaved marker are each tab's own,
   on show or not (b2: a tab made per tab changes hidden, as its job goes on). */
const curProject = ()=>{ const t = activeTab(); return t && t.projectId ? { id:t.projectId, title:t.title } : null; };
const isDirty = ()=>{ const t = activeTab(); return !!(t && t.dirty); };

/* ---- Autosave ----
   5 s after the last change a tab's state is written back to the tabs store, so a
   reload (incl. Chrome's desktop/mobile switch, which reloads the page) comes back with
   the same tabs and the same unsaved work. Persisting a tab is not saving a project: a
   tab still needs an explicit Save to become one. Each tab its own (to v517 the active
   tab's: one tab changed at a time). */
const AUTOSAVE_MS = 5000;
const _autosave = new Map();   // tab id → its trailing write's timer
function scheduleAutosave(t){
  if (isRestoring() || !t) return;   // don't rewrite records while tabs are being replayed
  // Leading edge: persist at once on the first change (e.g. as soon as data loads),
  // so an immediate reload is already covered; then debounce the trailing write.
  if (!_autosave.has(t.id)) persistTab(t);
  clearTimeout(_autosave.get(t.id));
  _autosave.set(t.id, setTimeout(()=>{ _autosave.delete(t.id); persistTab(t); }, AUTOSAVE_MS));
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
/* What a project tab held when it was last saved (or opened), by tab id: its state,
   as JSON, and its name. A change is unsaved only while the state or the name differ
   from these: an edit undone, or a value set back by hand, is not one. */
const _savedKey = new Map();
const _savedRead = new Map();   // tab id → its saved { state, title } read, the key not yet taken (takeSavedKey)
// (of a tab live: its instance's, or its module's)
const stateKey = t => { try { return moduleStateKey(keyOf(t)); } catch(e){ return null; } };
// The changes made in each tab, counted (by tab id): a save tells by them what was changed
// while it was written (markWritten).
const _edits = new Map();
const edits = t => t ? _edits.get(t.id) || 0 : 0;
// After any change: unsaved if the tab was never saved, or now differs from what was.
function recheckDirty(t){
  if (!t || !isLive(t)) return;
  _edits.set(t.id, edits(t) + 1);
  if (!t.projectId){ markDirty(t); return; }
  const base = _savedKey.get(t.id);
  const same = !!base && base.title === (t.title || '') && base.key === stateKey(t);
  if (same){ if (t.dirty) markSaved(t); }
  else markDirty(t);
}
// Saved state: green non-interactive Save buttons, no unsaved marker; what is saved is
// remembered, for later changes to be compared with (recheckDirty). (the bar's buttons
// only for the tab on show)
function markSaved(t){
  // The tab record is kept for saved projects too — it is the persistent working
  // state that comes back on the next load. Re-persist it so it records the saved
  // (not-dirty) status, and drop the "*" from the tab.
  // A tab just activated is not live yet: onTabLoaded below takes what it holds then.
  if (!t) return;
  setTabDirty(t.id, false); if (!isRestoring()) persistTab(t); if (t.projectId && isLive(t)) _savedKey.set(t.id, { key: stateKey(t), title: t.title || '' });
  if (t !== activeTab()) return;
  const mod = t.module;
  saveBtns(mod).forEach(b=>{
    if (b.dataset.origHtml === undefined) b.dataset.origHtml = b.innerHTML;
    b.classList.add('is-saved');
    b.disabled = true;
    b.innerHTML = b.classList.contains('proj-icon') ? CHECK_ICON : ('Saved ' + CHECK_SM);
  });
  fitNameField(mod);
}
// Unsaved changes (data edit, a file removal, or a rename in the field). Removing
// files is a normal edit — it never clears the project; only deleting it does,
// and that closes the tab.
function markDirty(t){
  if (!t) return;
  setTabDirty(t.id, true);   // "*" on the tab label
  if (t !== activeTab()) return;
  restoreSaveBtns(t.module);
  // Badge the Save icon with a red asterisk when an open project has changes.
  setSaveDirtyIcon(t.module, !!t.projectId);
}

/* ---- Save / Save as ----
   Save: writes the current project under the name in the field (renaming it if
   the field was edited); creates it if none is open yet. Save as: prompts for a
   new name and always creates a NEW project, which becomes the open one.
   The state is taken as park gives it (v517): the record holds its files' hashes, and
   only the bytes the store lacks are written with it (to v516 every file's bytes went
   into the record as base64, at each save). */
// While an older DataTreat in another window holds back the database's upgrade nothing is
// read or written yet: a save would wait unseen, and a second press save the project twice.
async function saveHeld(){
  if (!dbBlocked()) return false;
  await confirmBanner('Projects cannot be saved yet: DataTreat is open in another window of an older version. Reload or close that window, then save again.', 'OK');
  return true;
}
// Briefly flash a field red + shake (no browser dialog) to signal a missing name
function flashInvalid(inp){
  if (!inp) return;
  inp.classList.remove('field-invalid'); void inp.offsetWidth; // restart the animation
  inp.classList.add('field-invalid');
  inp.focus();
}
// Returns true when the project was actually written, false on any abort (no data,
// missing name, or a declined overwrite) — callers like "New project" rely on this.
// The tab on show, or any other (its close's Save): awake, its instance's state, asleep
// or parked, the one it holds; its name, the bar's field on show, else its own.
const hasData = t => isLive(t) ? moduleHasData(keyOf(t)) : !isEmpty(t);
async function doSave(t, asNew){
  if (!t) return false;
  const mod = t.module, shown = t === activeTab();
  // (a wake reading its files' bytes waited for: SEM, tabs.js wakeLater)
  if (shown){ const w = ensureLive(); if (w) await w; }
  if (!hasData(t)){ await confirmBanner('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.', 'OK'); return false; }
  if (asNew){ openSaveAsModal(t); return false; }

  const inp = shown ? nameInput(mod) : null;
  const now = Date.now();
  const title = (inp ? inp.value : t.title || '').trim();
  if (!title){ if (inp) flashInvalid(inp); else await confirmBanner('“' + (t.title || UNTITLED) + '” has no name to be saved under: name it in its tab first.', 'OK'); return false; }
  if (await saveHeld()) return false;
  // What is saved is what the tab holds now: its state, that state's key, its changes counted.
  const state = stateOf(t), key = isLive(t) ? stateKey(t) : null, n = edits(t);
  return oneSave(t, key, title, async ()=>{
    const all = await allProjects();
    // (the tab's project as it is now: a save of it before this one may have made it)
    const cur = t && t.projectId ? { id: t.projectId } : null;
    let id;
    if (cur){
      const clash = all.find(s=> s.module===mod && s.id!==cur.id && s.title.toLowerCase()===title.toLowerCase());
      if (clash && !await confirmBanner('Another ' + (MODULE_LABELS[mod]||mod) + ' project is named “' + clash.title + '”. Save under this name anyway?', 'Save')) return false;
      const rec = all.find(s=> s.id===cur.id);
      id = cur.id; await putProject({ id, module: mod, title, createdAt: rec ? rec.createdAt : now, state, updatedAt: now });
    } else {
      const existing = all.find(s=> s.module===mod && s.title.toLowerCase()===title.toLowerCase());
      if (existing){
        if (!await confirmBanner('A ' + (MODULE_LABELS[mod]||mod) + ' project named “' + existing.title + '” already exists. Overwrite it?', 'Overwrite')) return false;
        id = existing.id; await putProject({ ...existing, title, state, updatedAt: now });
      } else { id = uid(); await putProject({ id, module: mod, title, state, createdAt: now, updatedAt: now }); }
    }
    // (a name typed meanwhile is the tab's, not set back to the one saved)
    setTabProject(t.id, id, edits(t) === n ? title : null); markWritten(t, key, title, n);
    renderList();
    return true;
  });
}
/* One save at a time (v517). A save no longer holds the page while it is written, and may
   wait a second or so on the database behind the autosave of files just dropped (eight big
   SEM images' bytes): a second press of Save read the projects before the first was
   written, found none of that name, and made a second project of it (to v516 too, pressed
   within some 0.3 s of the drop). A save reads the projects once the one before is written;
   a save of a tab asked while one of it waits takes that one's answer (one question), and
   writes only what that one did not. */
let _saveQ = Promise.resolve();
const _saveOf = new Map();   // tab id → its save asked last and not done: { p, key, title }
function oneSave(t, key, title, fn){
  const was = t && _saveOf.get(t.id);
  const p = _saveQ.then(async ()=>{
    if (was){
      const ok = await was.p.then(v=> v, ()=> null);
      if (ok === false || (ok && was.key === key && was.title === title)) return ok;   // (declined, or written already)
    }
    return fn();
  });
  _saveQ = p.catch(()=>{});
  if (t){
    const me = { p, key, title };
    _saveOf.set(t.id, me);
    p.finally(()=>{ if (_saveOf.get(t.id) === me) _saveOf.delete(t.id); }).catch(()=>{});
  }
  return p;
}
/* A save written: the tab it was made for, on show or not, is saved as what was written
   (its state's key and the name taken at the press); a change made since keeps it unsaved.
   To v516 the tab on show at the end, as it was then, was marked saved, the page held
   meanwhile, mostly: with the page answering (v517) another tab shown then was marked saved
   with its changes, or an edit made then taken as saved, and closed with no question. */
function markWritten(t, key, title, n){
  if (!tabById(t.id)) return;   // (closed meanwhile)
  const same = edits(t) === n, shown = activeTab() === t;
  if (same && shown){ markSaved(t); return; }
  _savedKey.set(t.id, { key, title });
  if (same) setTabDirty(t.id, false);
  else if (isLive(t)) recheckDirty(t);   // (an edit undone meanwhile is none)
}

/* ---- Project files (.datatreat) ----
   A project file is JSON: a header saying who wrote it, the project, and a signature,
   the SHA-256 of its module and state. The signature does not keep anyone from writing
   such a file (the app is open, its way of signing too): it tells a file DataTreat wrote
   and nobody changed from one that was edited, cut short, or written by something else.
   Its bytes (a file's original, kept for its download) are base64, as IndexedDB held them
   to v516; a saved project's are read from where they are stored and put back in, so the
   file is the one a project of v516 gave, byte for byte (exportProjectRecord).
   Up to v483 the export was a .json with no header, its bytes as arrays of numbers; such
   files still import, after a question. */
const FILE_EXT = '.datatreat', FILE_FORMAT = 'datatreat-project', FILE_VERSION = 2;
const appVersion = ()=>{ const el = document.querySelector('.app-version'); return el ? el.textContent.trim() : ''; };
// null where the browser has no WebCrypto (a page not served over https or localhost)
async function signatureOf(module, state){
  if (!(globalThis.crypto && crypto.subtle)) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([module, state])));
  return [...new Uint8Array(buf)].map(b=> b.toString(16).padStart(2, '0')).join('');
}
async function downloadProject(rec){
  const payload = { datatreat_session: 1, app: 'DataTreat', format: FILE_FORMAT, formatVersion: FILE_VERSION,
                    appVersion: appVersion(), module: rec.module, title: rec.title,
                    createdAt: rec.createdAt, updatedAt: rec.updatedAt, state: rec.state };
  const sig = await signatureOf(rec.module, rec.state);
  if (sig) payload.signature = { alg: 'SHA-256', value: sig };
  const safe = String(rec.title).replace(/[^\w.-]+/g, '_').slice(0, 60) || 'project';
  // octet-stream, so no browser swaps the extension for the one of a JSON type
  downloadTextFile(rec.module + '_' + safe + FILE_EXT, JSON.stringify(payload), 'application/octet-stream');
}
// What makes a file doubtful, in words; empty when it is a project DataTreat signed.
async function doubtsAbout(file, obj){
  const doubts = [];
  if (!file.name.toLowerCase().endsWith(FILE_EXT)) doubts.push('its name does not end in ' + FILE_EXT);
  if (obj.format !== FILE_FORMAT || !obj.signature || typeof obj.signature.value !== 'string'){
    doubts.push('it carries no DataTreat signature (an export from v483 or earlier, or a file written elsewhere)');
  } else {
    if (+obj.formatVersion > FILE_VERSION) doubts.push('it was written by a newer DataTreat (' + String(obj.appVersion || '?') + ')');
    const sig = await signatureOf(obj.module, obj.state);
    if (sig && sig !== obj.signature.value) doubts.push('its content changed after DataTreat signed it');
  }
  return doubts;
}

/* ---- Export current module as .datatreat ---- */
async function exportJson(t){
  const w = ensureLive(); if (w) await w;
  if (!t) return;
  const mod = t.module;
  if (!moduleHasData(keyOf(t))){ await confirmBanner('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.', 'OK'); return; }
  const inp = nameInput(mod);
  const now = Date.now();
  const cur = curProject();
  const title = (inp && inp.value.trim()) || (cur ? cur.title : (MODULE_LABELS[mod]||mod));
  // (under the loader: its files' bytes written as base64, a task of 1.7 s for 8 SEM images)
  await underLoader(()=> downloadProject({ module: mod, title, createdAt: now, updatedAt: now, state: encode(getModuleState(keyOf(t))) }));
}

/* ---- Save as… — custom in-page modal (no browser prompt) ---- */
let _saveAsTab = null;
function openSaveAsModal(t){
  _saveAsTab = t;
  const modal = document.getElementById('projSaveAsModal');
  const inp = document.getElementById('projSaveAsInput');
  const src = t === activeTab() ? nameInput(t.module) : null;
  inp.value = (src ? src.value.trim() : (t.title || '').trim()) || '';
  inp.classList.remove('field-invalid');
  modal.style.display = 'flex';
  setTimeout(()=>{ inp.focus(); inp.select(); }, 0);
}
function closeSaveAsModal(){ document.getElementById('projSaveAsModal').style.display = 'none'; _saveAsTab = null; }
// (a second press of OK, or Enter, while the copy is written does nothing: v517)
let _saveAsBusy = false;
async function commitSaveAs(){
  const t = _saveAsTab; if (!t || !tabById(t.id) || _saveAsBusy) return;
  const mod = t.module;
  const inp = document.getElementById('projSaveAsInput');
  const title = inp.value.trim();
  if (!title){ flashInvalid(inp); return; }
  if (await saveHeld()) return;
  const now = Date.now();
  const state = stateOf(t);
  _saveAsBusy = true;
  let id;
  try {
    id = await oneSave(null, null, title, async ()=>{
      const all = await allProjects();
      const existing = all.find(s=> s.module===mod && s.title.toLowerCase()===title.toLowerCase());
      if (existing){
        if (!await confirmBanner('A ' + (MODULE_LABELS[mod]||mod) + ' project named “' + existing.title + '” already exists. Overwrite it?', 'Overwrite')) return null;
        await putProject({ ...existing, title, state, updatedAt: now }); return existing.id;
      }
      const nid = uid(); await putProject({ id: nid, module: mod, title, state, createdAt: now, updatedAt: now }); return nid;
    });
  } finally { _saveAsBusy = false; }
  if (!id) return;
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
    if (tabByProject(r.id)) continue;   // (already open: nothing to read)
    // The record as stored now, with its files' bytes, read together (v517: to v516 the
    // list's copy, which held them, was opened as it was)
    let got;
    try { got = await readProject(r.id); }
    catch(e){ notice('“' + r.title + '” could not be opened: its files could not be read from this browser\'s storage.'); continue; }
    if (!got){ goneProject(r); continue; }
    if (got.missing) notice(lostSay(got.rec.title, got.missing) + ' it opens without them.');
    // Background: the tab appears in the bar but you stay on the Projects list.
    await openTab({ module: r.module, title: got.rec.title, projectId: r.id, state: got.state, dirty: false, focus: false });
  }
}
// A project of the list that another window has deleted since the list was drawn.
function goneProject(r){
  notice('“' + r.title + '” is no longer among your projects: it was deleted in another window.');
  renderList();
}
const lostSay = (title, n)=> '“' + title + '”: ' + n + (n > 1 ? ' of its files are' : ' of its files is') + ' not stored in this browser any more;';

/* ---- Export a saved project record / import a project file ---- */
// The record as stored now, its bytes read with it and put back where encode writes them:
// the same file, signature included, as the project's export from its bar (to v516 the
// record held them as such); under the loader, as that one.
function exportProjectRecord(rec){ return underLoader(()=> exportRecord(rec)); }
async function exportRecord(rec){
  let got;
  try { got = await exportedProject(rec.id); }
  catch(e){ notice('“' + rec.title + '” could not be exported: its files could not be read from this browser\'s storage.'); return; }
  if (!got){ goneProject(rec); return; }
  if (got.missing) notice(lostSay(got.rec.title, got.missing) + ' the file holds them without their bytes.');
  return downloadProject({ ...got.rec, state: got.state });
}
async function importProjectFile(file){
  let obj;
  try { obj = JSON.parse(await file.text()); }
  catch(e){ await confirmBanner('“' + file.name + '” is not a DataTreat project: it cannot be read as one.', 'OK'); return; }
  if (!obj || typeof obj !== 'object' || !obj.datatreat_session || !MODULES.includes(obj.module)
      || !obj.state || typeof obj.state !== 'object' || Array.isArray(obj.state)){
    await confirmBanner('“' + file.name + '” is not a DataTreat project.', 'OK'); return;
  }
  const doubts = await doubtsAbout(file, obj);
  if (doubts.length && !await confirmBanner('“' + file.name + '”: ' + doubts.join('; ') + '. Import it anyway?', 'Import anyway')) return;
  const now = Date.now();
  // (its bytes to the store, the record holding their hashes: v517)
  const [state] = await hydrate([obj.state], true);
  await putProject({ id: uid(), module: obj.module, title: String(obj.title||'').trim().slice(0, 200) || 'Imported project',
                     state, createdAt: +obj.createdAt || now, updatedAt: now });
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
    html += '<tr class="sess-row" data-id="'+esc(r.id)+'" title="Click to open">'
      + '<td><input type="checkbox" class="sess-check" style="width:auto"></td>'
      + '<td><input type="text" class="proj-rename" value="'+esc(r.title)+'"></td>'
      + '<td style="white-space:nowrap"><span class="pill">'+esc(MODULE_LABELS[r.module]||r.module)+'</span></td>'
      + '<td style="color:var(--muted)">'+fmtDate(r.updatedAt)+'</td>'
      + '<td class="row-acts"><div class="row-acts-inner idle-dim">'
        + '<button class="row-ic pr-csv" title="Export .csv">'+ROW_CSV+'</button>'
        + '<button class="row-ic pr-json" title="Export .datatreat">'+ROW_JSON+'</button>'
        + '<button class="row-ic pr-del" title="Delete">'+ROW_TRASH+'</button>'
      + '</div></td></tr>';
  });
  html += '</tbody></table></div>';
  wrap.innerHTML = html;
  updateBulkState();
}
function recById(id){ return _cache.find(s=> s.id === id); }
// (the record and its files' bytes read first, v517: to v516 the list's copy held them)
async function exportProjectCsv(rec){
  let got;
  try { got = await readProject(rec.id); }
  catch(e){ notice('“' + rec.title + '”: its files could not be read from this browser\'s storage.'); return; }
  if (!got){ goneProject(rec); return; }
  // (a module made per tab: in an instance of its own, the tabs' left as they are)
  withState(rec.module, decode(got.state), k=> runCsvExport(k));
}
async function renameProject(rec, t){
  t = (t||'').trim();
  if (!t || t === rec.title) return;
  if (!await retitleProject(rec.id, t, Date.now())){ goneProject(rec); return; }
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
async function deleteOpenProject(){
  const w = ensureLive(); if (w) await w;
  const t = activeTab(); if (!t) return;
  const cur = curProject();
  // An empty file list means there is nothing to lose, named or not: delete the
  // stored project (if any) and close the tab without asking.
  if (!moduleHasData(keyOf(t))){
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
  // (the bar is the active tab's: its buttons act on it)
  // the module holds the active tab's state, not the one before a switch (a wake reading
  // its files' bytes waited for)
  const w = ensureLive(); if (w) await w;
  const t = activeTab();
  const isExport = b.classList.contains('proj-save') || b.classList.contains('proj-saveas')
                || b.classList.contains('proj-csv')  || b.classList.contains('proj-json');
  // Save / Save as / export need files; with an empty list say so (delete & new are fine).
  if (isExport && !(t && moduleHasData(keyOf(t)))){ await confirmBanner('Project file list is empty.', 'OK'); return; }
  if (b.classList.contains('proj-save'))        doSave(t, false);
  else if (b.classList.contains('proj-saveas')) doSave(t, true);
  else if (b.classList.contains('proj-csv'))    runCsvExport(keyOf(t));
  else if (b.classList.contains('proj-json'))   exportJson(t);
  else if (b.classList.contains('proj-del'))    deleteOpenProject();
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
  // The "+" at the tail of the tab bar is a shortcut to the same picker.
  document.addEventListener('click', e=>{ if (e.target.closest('.ptab-add')) openTechniqueModal(); });
})();
// Editing the project name marks a pending change, clears the red "missing name"
// state, and updates the project-bar visibility (a name alone reveals the buttons).
// One name field, rebound to the active module — read data-module at event time,
// never captured, since the bar switches module under it.
document.querySelectorAll('.project-name-input').forEach(inp=>{
  const modOf = ()=> inp.dataset.module;
  inp.addEventListener('input', ()=>{
    const mod = modOf();
    inp.classList.remove('field-invalid');
    fitNameField(mod);
    refreshProjBar(mod);
    const t = activeTab();
    if (t) setTabTitle(t.id, inp.value.trim());   // the tab label tracks the field
    if (t && isLive(t) && moduleHasData(keyOf(t))){ recheckDirty(t); scheduleAutosave(t); }
  });
  inp.addEventListener('focus', ()=> fitNameField(modOf()));   // click triggers adaptivity
  inp.addEventListener('blur',  ()=> fitNameField(modOf()));   // empty → ghost width; filled → ellipsis
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
// Every history's change, by its key: the tab whose instance (or module) changed, on show
// or not (a job's end in a tab hidden). A state read in and out for its CSVs is none.
onAnyChange(k=>{
  const t = tabOfKey(k);
  if (!t) return;
  scheduleAutosave(t);
  // A tab that was never saved is unsaved by definition; a saved one only while it
  // differs from what was saved.
  recheckDirty(t);
});

/* ---- The single project bar ----
   One bar serves every module: only one tab is live, so its selectors (name field,
   Save buttons) are bound to the active module by rewriting the data-module of the
   bar and its buttons. The bar hides on the fixed sections. */
const TECH_INFO = {
  tauc: 'Diffuse Reflectance Spectroscopy in the UV-Vis range. Used to assess light absorption of powdered samples. Semiconductor band gaps (E<sub>g</sub>) can be inferred through Tauc Plot analysis.',
  xrd:  'X-Ray Powder Diffraction. Diffractograms comparison, smoothing and normalization, with peak detection, Scherrer crystallite-size estimation and whole-pattern profile fitting.',
  gc:   'Gas Chromatography for H₂ and O₂ production-rate assessment. Computes mean H₂ and O₂ production rates over a chosen integration interval from time-resolved injection measurements.',
  epr:  'Electron Paramagnetic Resonance. Spectra comparison, smoothing and normalization.',
  sem:  'Scanning Electron Microscopy. Tescan images read with their metadata (pixel size, magnification, beam, detector), cropped, normalised in intensity, grouped by scale and laid out into figures with scale bars.',
};
const projectBar = document.getElementById('projectBar');
const barInfoBtn = projectBar.querySelector('.pbar-info');
const barInfoPanel = projectBar.querySelector('.pbar-info-panel');
// Point the bar (and the data-module save/export buttons) at the active module.
function bindProjectBar(mod){
  projectBar.dataset.module = mod;
  projectBar.querySelectorAll('.proj-save, .proj-saveas, .proj-csv, .proj-json').forEach(b=> b.dataset.module = mod);
  const inp = projectBar.querySelector('.project-name-input'); if (inp) inp.dataset.module = mod;
  projectBar.querySelector('.pbar-tech').textContent = MODULE_LABELS[mod] || mod;
  barInfoPanel.innerHTML = TECH_INFO[mod] || '';
}
// Info toggle: opens the technique description inside the bar, below the main row.
barInfoBtn.addEventListener('click', ()=>{
  const open = barInfoPanel.hasAttribute('hidden');
  barInfoPanel.toggleAttribute('hidden', !open);
  barInfoBtn.setAttribute('aria-expanded', String(open));
});

// Called by the tab manager once a tab's state is live in its module: point the
// bar at that module and put it in the tab's shape (name, saved/dirty buttons).
onTabActivated(tab=>{
  if (!tab) return;
  const mod = tab.module;
  projectBar.classList.add('no-anim');   // snap Save/name state on switch, no 140ms fade
  bindProjectBar(mod);
  projectBar.style.display = '';
  const inp = nameInput(mod);
  if (inp) inp.value = tab.title || '';
  for (const id of _savedRead.keys()) if (id !== tab.id) _savedRead.delete(id);
  if (tab.projectId && !tab.dirty) markSaved(tab);
  else {
    restoreSaveBtns(mod); setSaveDirtyIcon(mod, !!tab.projectId && tab.dirty);
    // A tab that came back with unsaved changes (a reload): what was saved is the
    // project's record, read into the module and out again without touching it (the read
    // going on, _savedReading: the tab's load waits for it under the loader, onTabLoaded).
    if (tab.projectId && !_savedKey.has(tab.id) && !_savedRead.has(tab.id) && !_savedReading.has(tab.id)){
      const p = readProject(tab.projectId).then(got=>{
        if (!got || !got.rec.state || _savedKey.has(tab.id) || activeTab() !== tab) return;
        _savedRead.set(tab.id, { state: got.state, title: got.rec.title || '' });
        takeSavedKey(tab);
      }).catch(()=>{}).finally(()=> _savedReading.delete(tab.id));
      _savedReading.set(tab.id, p);
    }
  }
  refreshProjBar(mod);
  normalizeProjIcons(mod);
  requestAnimationFrame(()=>{ fitNameField(mod); projectBar.classList.remove('no-anim'); });
});
// The bar belongs to a live tab only — hide it (and close its info panel) whenever
// a fixed section shows.
onSectionChange(tab=>{
  if (!MODULES.includes(tab)){
    projectBar.style.display = 'none';
    barInfoPanel.setAttribute('hidden', '');
    barInfoBtn.setAttribute('aria-expanded', 'false');
  } else {
    projectBar.style.display = '';
  }
});
// A saved, unchanged tab is what was saved: once its state is live, that is what later
// changes are compared with. One changed whose saved record is being read: the read, which
// its load waits for, the loader on (tabs.js), so that its key is taken there.
const _savedReading = new Map();   // tab id → the read of its saved record going on
onTabLoaded(tab=>{
  if (tab.projectId && !tab.dirty) _savedKey.set(tab.id, { key: stateKey(tab), title: tab.title || '' });
  else { takeSavedKey(tab); return _savedReading.get(tab.id); }
});
/* The saved record of a tab that came back with unsaved changes is read with its files'
   bytes (v517: to v516 the list's copy held them, and the key was taken at once), and its
   key taken once that tab is live and no job runs in its module: else at its next load.
   Until then a change is unsaved, as one made before the list was read. The key is a
   state's as its module gives it back: of a module made per tab, read out of an instance
   of its own, which draws nothing (utils.js withState; to b2v3 the tab's own, which drew
   the saved state and its own again after a reload, 0.47 s for an XRPD tab of 12 refined
   patterns, the loader gone); of one that is not, its one instance's, as in v517. */
function takeSavedKey(tab){
  const r = _savedRead.get(tab.id);
  if (!r) return;
  if (_savedKey.has(tab.id) || !tabById(tab.id)){ _savedRead.delete(tab.id); return; }
  if (!isLive(tab) || moduleBusy(keyOf(tab))) return;
  _savedRead.delete(tab.id);
  let key = null;
  try { key = withState(tab.module, decode(r.state), k=> moduleStateKey(k)); } catch(e){}
  if (key) _savedKey.set(tab.id, { key, title: r.title });
}
// Closing a tab may offer to save it first; the tab manager has no access to the
// project store, so it calls back in here.
onCloseSave(tab=> doSave(tab, false));

initTabs();
// The bytes no record holds any more, a while after the page loads (v517); what the
// database says of other windows.
sweepSoon(30000);
// (the bar drawn meanwhile, its + included: tabs can be opened while the restore waits)
onDbBlocked(()=>{ renderTabs(); notice('DataTreat is open in another window of an older version: reload or close that window for this one to read and save your projects.'); });
// (what it holds that its records do not: the tab on show, those with a write to come, those
// moved, those whose view changed; to b2v4 every record, written again)
onDbClosing(()=>{ try { flushTabs(); persistMoved(true); } catch(e){} });
onDbClosed(()=> notice('DataTreat was updated in another window: reload this one to go on saving your work.'));

// Flush the active tab immediately when the page is hidden/unloaded (Chrome's
// desktop⇄mobile switch reloads the page, tab close, refresh) so changes made in
// the last few seconds aren't lost to the debounce. Best-effort: visibilitychange
// (hidden) fires early enough for IndexedDB to commit; pagehide is the backstop.
// (and every tab whose trailing write is still to come: a tab hidden changes too, b2)
function flushTabs(){
  const t = activeTab(); if (t) persistTab(t);
  for (const [id, timer] of _autosave){ clearTimeout(timer); _autosave.delete(id); const u = tabById(id); if (u && u !== t) persistTab(u); }
}
document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') flushTabs(); });
window.addEventListener('pagehide', flushTabs);
// No beforeunload nag: the open tabs come back on the next load, so a reload
// never loses work.
