/* =========================================================
   SESSION MANAGER
   Save/restore a whole module's state (raw data + parameters + fits) to
   IndexedDB, with .json export/import. A dedicated "Sessions" tab lists every
   saved session, filterable by name and module, and can open several at once
   provided they belong to different modules.
========================================================= */
import { MODULES, MODULE_LABELS, getModuleState, restoreModuleState,
         moduleHasData, goTab, onModuleChangeOnce } from './utils.js';

/* ---- IndexedDB tiny wrapper ---- */
const DB_NAME = 'datatreat', STORE = 'sessions', DB_VER = 1;
function idb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath:'id' });
        os.createIndex('module', 'module', { unique:false });
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror   = ()=> reject(req.error);
  });
}
async function tx(mode, fn){
  const db = await idb();
  return new Promise((resolve, reject)=>{
    const t = db.transaction(STORE, mode);
    const os = t.objectStore(STORE);
    let out;
    Promise.resolve(fn(os)).then(v=>{ out = v; });
    t.oncomplete = ()=> resolve(out);
    t.onerror = ()=> reject(t.error);
    t.onabort = ()=> reject(t.error);
  });
}
const reqP = r => new Promise((res, rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });

async function allSessions(){ return tx('readonly', os=> reqP(os.getAll())); }
async function putSession(rec){ return tx('readwrite', os=>{ os.put(rec); }); }
async function deleteSession(id){ return tx('readwrite', os=>{ os.delete(id); }); }

/* ---- helpers ---- */
const uid = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Encode module state into a JSON-safe form: typed arrays → plain arrays, and
// Date objects → a tagged marker (GC's injection timestamps are Dates). This one
// representation is used for BOTH IndexedDB and .json export/import; decode()
// reverses it (reviving Dates) before handing state back to the module.
function encode(v){
  if (v instanceof Date) return { __t:'date', v:v.getTime() };
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (Array.isArray(v)) return v.map(encode);
  if (v && typeof v === 'object'){
    const o = {}; for (const k in v) o[k] = encode(v[k]); return o;
  }
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
function fmtDate(ts){
  try { return new Date(ts).toLocaleString(); } catch(e){ return ''; }
}

/* ---- Save ---- */
async function saveModuleSession(mod){
  if (!moduleHasData(mod)){ alert('No data loaded in ' + (MODULE_LABELS[mod]||mod) + '.'); return; }
  const title = (prompt('Session title:', '') || '').trim();
  if (!title) return;
  const state = encode(getModuleState(mod));
  const all = await allSessions();
  const existing = all.find(s=> s.module===mod && s.title.toLowerCase()===title.toLowerCase());
  const now = Date.now();
  if (existing){
    if (!confirm('A ' + (MODULE_LABELS[mod]||mod) + ' session named “' + existing.title + '” already exists. Overwrite it?')) return;
    await putSession({ ...existing, title, state, updatedAt: now });
  } else {
    await putSession({ id: uid(), module: mod, title, state, createdAt: now, updatedAt: now });
  }
  renderList();
  markSaved(mod);
}

/* Turn both of a module's save buttons into a non-interactive green "Saved ✓"
   state (without changing their box), reverting on the module's next change. */
function markSaved(mod){
  const btns = [...document.querySelectorAll('.session-save-btn[data-module="'+mod+'"]')];
  btns.forEach(b=>{
    if (b.dataset.origHtml === undefined) b.dataset.origHtml = b.innerHTML;
    b.classList.add('saved-ok');
    b.disabled = true;
    b.innerHTML = b.classList.contains('icon-save')
      ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
      : 'Saved <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  });
  onModuleChangeOnce(mod, ()=>{
    btns.forEach(b=>{
      b.classList.remove('saved-ok');
      b.disabled = false;
      if (b.dataset.origHtml !== undefined) b.innerHTML = b.dataset.origHtml;
    });
  });
}

/* ---- Open ---- */
async function openSessions(recs){
  // Guard: no two of the same module in one batch
  const seen = new Set();
  for (const r of recs){
    if (seen.has(r.module)){ alert('You selected more than one ' + (MODULE_LABELS[r.module]||r.module) + ' session. Open only one session per module at a time.'); return; }
    seen.add(r.module);
  }
  // Confirm replacement for any module that currently holds data
  for (const r of recs){
    if (moduleHasData(r.module)){
      if (!confirm('The ' + (MODULE_LABELS[r.module]||r.module) + ' module already has data loaded. Replace it with “' + r.title + '”?')) return;
    }
  }
  for (const r of recs) restoreModuleState(r.module, decode(r.state));
  if (recs.length) goTab(recs[0].module);
}

/* ---- Export / Import ---- */
function exportSession(rec){
  const payload = { datatreat_session: 1, module: rec.module, title: rec.title,
                    createdAt: rec.createdAt, updatedAt: rec.updatedAt, state: rec.state };
  const blob = new Blob([JSON.stringify(payload)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = rec.title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'session';
  a.href = url; a.download = rec.module + '_' + safe + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}
async function importSessionFile(file){
  let obj;
  try { obj = JSON.parse(await file.text()); }
  catch(e){ alert('Not a valid JSON file.'); return; }
  if (!obj || !obj.datatreat_session || !MODULES.includes(obj.module) || !obj.state){
    alert('This file is not a DataTreat session.'); return;
  }
  const now = Date.now();
  await putSession({ id: uid(), module: obj.module, title: (obj.title||'Imported session').trim(),
                     state: obj.state, createdAt: obj.createdAt||now, updatedAt: now });
  renderList();
}

/* ---- Rendering ---- */
let _cache = [];
let _sortKey = 'updatedAt', _sortDir = -1; // default: most-recent first
function sortRows(rows){
  const k = _sortKey;
  return rows.sort((a,b)=>{
    let av, bv;
    if (k==='updatedAt'){ av=a.updatedAt||0; bv=b.updatedAt||0; return (av-bv)*_sortDir; }
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
function updateOpenSelectedState(){
  const n = document.querySelectorAll('#sessListWrap .sess-check:checked').length;
  const btn = document.getElementById('sessOpenSelected');
  btn.disabled = n === 0;
  btn.textContent = n > 1 ? ('Open selected ('+n+')') : 'Open selected';
}
async function renderList(){
  _cache = (await allSessions()).sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
  const wrap = document.getElementById('sessListWrap');
  if (!wrap) return;
  const rows = sortRows(_cache.filter(passesFilter));
  if (!_cache.length){ wrap.innerHTML = '<p class="hint">No saved sessions yet. Load data in a module and press “Save session”.</p>'; updateOpenSelectedState(); return; }
  if (!rows.length){ wrap.innerHTML = '<p class="hint">No sessions match the current filters.</p>'; updateOpenSelectedState(); return; }
  let html = '<div class="table-wrap-box sess-table-box"><table class="sess-table"><colgroup><col style="width:30px"><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>'
    + '<thead><tr><th></th>'
    + '<th class="sess-sort" data-key="title" style="cursor:pointer">TITLE'+arrow('title')+'</th>'
    + '<th class="sess-sort" data-key="module" style="cursor:pointer">MODULE'+arrow('module')+'</th>'
    + '<th class="sess-sort" data-key="updatedAt" style="cursor:pointer">SAVED'+arrow('updatedAt')+'</th>'
    + '<th></th></tr></thead><tbody>';
  rows.forEach(r=>{
    html += '<tr data-id="'+r.id+'">'
      + '<td><input type="checkbox" class="sess-check" style="width:auto"></td>'
      + '<td class="fname" title="'+r.title.replace(/"/g,'&quot;')+'">'+r.title+'</td>'
      + '<td style="white-space:nowrap"><span class="pill">'+(MODULE_LABELS[r.module]||r.module)+'</span></td>'
      + '<td style="color:var(--muted)">'+fmtDate(r.updatedAt)+'</td>'
      + '<td style="text-align:right;white-space:nowrap">'
        + '<button class="btn small sess-open">Open</button> '
        + '<button class="btn secondary small sess-rename">Rename</button> '
        + '<button class="btn secondary small sess-export">Export</button> '
        + '<button class="btn secondary small sess-delete">Delete</button>'
      + '</td></tr>';
  });
  html += '</tbody></table></div>';
  wrap.innerHTML = html;
  updateOpenSelectedState();
}

function recById(id){ return _cache.find(s=> s.id === id); }

/* ---- Wiring ---- */
document.querySelectorAll('.session-save-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> saveModuleSession(btn.dataset.module));
});

// Module filter options
(function fillModuleFilter(){
  const sel = document.getElementById('sessFilterModule');
  if (!sel) return;
  MODULES.forEach(m=>{
    const o = document.createElement('option'); o.value = m; o.textContent = MODULE_LABELS[m]||m; sel.appendChild(o);
  });
})();

document.getElementById('sessFilterName').addEventListener('input', renderList);
document.getElementById('sessFilterModule').addEventListener('change', renderList);

document.getElementById('sessOpenSelected').addEventListener('click', ()=>{
  const ids = [...document.querySelectorAll('#sessListWrap tr')]
    .filter(tr=> tr.querySelector('.sess-check') && tr.querySelector('.sess-check').checked)
    .map(tr=> tr.dataset.id);
  const recs = ids.map(recById).filter(Boolean);
  if (recs.length) openSessions(recs);
});

document.getElementById('sessImportBtn').addEventListener('click', ()=> document.getElementById('sessImportFile').click());
document.getElementById('sessImportFile').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0];
  if (f) importSessionFile(f);
  e.target.value = '';
});

// Row action / checkbox delegation
document.getElementById('sessListWrap').addEventListener('click', async e=>{
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const rec = recById(tr.dataset.id);
  if (!rec) return;
  if (e.target.classList.contains('sess-open'))   openSessions([rec]);
  else if (e.target.classList.contains('sess-export')) exportSession(rec);
  else if (e.target.classList.contains('sess-delete')){
    if (confirm('Delete session “'+rec.title+'”? This cannot be undone.')){ await deleteSession(rec.id); renderList(); }
  } else if (e.target.classList.contains('sess-rename')){
    const t = (prompt('New title:', rec.title) || '').trim();
    if (t && t !== rec.title){ await putSession({ ...rec, title:t, updatedAt: Date.now() }); renderList(); }
  }
});
document.getElementById('sessListWrap').addEventListener('change', e=>{
  if (e.target.classList.contains('sess-check')) updateOpenSelectedState();
});
// Sortable headers: click toggles direction (or picks a new column)
document.getElementById('sessListWrap').addEventListener('click', e=>{
  const th = e.target.closest('.sess-sort');
  if (!th) return;
  const key = th.dataset.key;
  if (_sortKey === key) _sortDir = -_sortDir;
  else { _sortKey = key; _sortDir = (key==='updatedAt') ? -1 : 1; }
  renderList();
});

// Refresh the list whenever the Sessions tab is opened
document.querySelector('#nav button[data-tab="sessions"]').addEventListener('click', renderList);
renderList();
