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
// Encode module state into a JSON-safe form: bytes (a Uint8Array: a file's own, kept for
// its download) → base64, other typed arrays → plain arrays, Date objects → a tagged
// marker. Same representation for IndexedDB and project files (from v473 to v483 a .json
// export wrote bytes as plain arrays, for older DataTreats). Up to v470 bytes became
// plain arrays everywhere, 9 bytes stored for each and read back as an Array, not as the
// Uint8Array the module had; such records still decode, as the arrays they hold.
const B64_CHUNK = 0x8000;   // String.fromCharCode over megabytes at once overflows the stack
function toB64(b){
  let s = '';
  for (let i = 0; i < b.length; i += B64_CHUNK) s += String.fromCharCode.apply(null, b.subarray(i, i + B64_CHUNK));
  return btoa(s);
}
function fromB64(t){
  const s = atob(t), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
// A byte array held in several places (the scans of one XRDML file are patterns of their
// own, sharing its bytes) is written once: where it is first met, with an id, and as
// {__t:'u8', ref: id} after that; decode gives back one array for all of them. To v484
// each place wrote its own copy, so a 40-scan file was stored 40 times.
function encode(v){
  const met = new Map();   // a Uint8Array → its encoded form
  let ids = 0;
  const enc = x=>{
    if (x instanceof Date) return { __t:'date', v:x.getTime() };
    if (x instanceof Uint8Array){
      const first = met.get(x);
      if (first){ if (first.id == null) first.id = ids++; return { __t:'u8', ref:first.id }; }
      const o = { __t:'u8', v:toB64(x) }; met.set(x, o); return o;
    }
    if (ArrayBuffer.isView(x)) return Array.from(x);
    if (Array.isArray(x)) return x.map(enc);
    if (x && typeof x === 'object'){ const o = {}; for (const k in x) o[k] = enc(x[k]); return o; }
    return x;
  };
  return enc(v);
}
const bytesOf = t=>{ try { return fromB64(t); } catch(e){ return new Uint8Array(0); } };
function decode(v){
  const shared = new Map();   // id → the bytes, from where they are written out
  // Decoding walks in the order encoding did, so the bytes come before their references;
  // should a reference come first all the same, the whole state is searched for its id.
  const find = (x, id)=>{
    if (!x || typeof x !== 'object') return null;
    if (x.__t === 'u8' && x.id === id && typeof x.v === 'string') return x;
    for (const k in x){ const r = find(x[k], id); if (r) return r; }
    return null;
  };
  const dec = x=>{
    if (Array.isArray(x)) return x.map(dec);
    if (x && typeof x === 'object'){
      if (x.__t === 'date') return new Date(x.v);
      if (x.__t === 'u8' && typeof x.v === 'string'){
        if (x.id != null && shared.has(x.id)) return shared.get(x.id);
        const b = bytesOf(x.v); if (x.id != null) shared.set(x.id, b); return b;
      }
      if (x.__t === 'u8' && x.ref != null){
        if (!shared.has(x.ref)){ const at = find(v, x.ref); shared.set(x.ref, at ? bytesOf(at.v) : new Uint8Array(0)); }
        return shared.get(x.ref);
      }
      const o = {}; for (const k in x) o[k] = dec(x[k]); return o;
    }
    return x;
  };
  return dec(v);
}

export { allProjects, putProject, deleteProject, allTabRecs, putTabRec, deleteTabRec, uid, encode, decode };
