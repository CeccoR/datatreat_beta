/* =========================================================
   INDEXEDDB + STATE ENCODING
   Shared by the tab manager (open project tabs) and the project manager (saved
   projects). Kept in its own module so neither has to import the other.

   Stores
     sessions — saved projects, keyed by id.
     tabs     — the open project tabs, keyed by id: the working state that comes
                back on the next load. Replaces the old one-draft-per-module
                'drafts' store, whose records are migrated into tabs on upgrade.
========================================================= */
const DB_NAME = 'datatreat', STORE = 'sessions', TABS_STORE = 'tabs', DB_VER = 3;

function idb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (ev)=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath:'id' });
        os.createIndex('module', 'module', { unique:false });
      }
      if (!db.objectStoreNames.contains(TABS_STORE)){
        const os = db.createObjectStore(TABS_STORE, { keyPath:'id' });
        // Carry the pre-tabs autosave drafts over as open tabs, so upgrading
        // users find their work where they left it instead of on a blank app.
        if (db.objectStoreNames.contains('drafts')){
          const old = ev.target.transaction.objectStore('drafts').getAll();
          old.onsuccess = ()=>{
            (old.result||[]).forEach((d, i)=>{
              if (!d || !d.state) return;
              os.put({ id: 'migrated-' + d.module, module: d.module, title: d.title || '',
                       projectId: d.id || null, dirty: !!d.dirty, order: i,
                       state: d.state, updatedAt: d.updatedAt || Date.now() });
            });
          };
        }
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
const reqP = r => new Promise((res, rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });

/* ---- Saved projects ---- */
const tx = (mode, fn)=> txStore(STORE, mode, fn);
async function allProjects(){ return tx('readonly', os=> reqP(os.getAll())); }
async function putProject(rec){ return tx('readwrite', os=>{ os.put(rec); }); }
async function deleteProject(id){ return tx('readwrite', os=>{ os.delete(id); }); }

/* ---- Open tabs ---- */
async function allTabRecs(){ return txStore(TABS_STORE, 'readonly', os=> reqP(os.getAll())); }
async function putTabRec(rec){ return txStore(TABS_STORE, 'readwrite', os=>{ os.put(rec); }); }
async function deleteTabRec(id){ return txStore(TABS_STORE, 'readwrite', os=>{ os.delete(id); }); }

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

export { allProjects, putProject, deleteProject, allTabRecs, putTabRec, deleteTabRec, uid, encode, decode };
