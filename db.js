/* =========================================================
   INDEXEDDB + STATE ENCODING
   Shared by the tab manager (open project tabs) and the project manager (saved
   projects). Kept in its own module so neither has to import the other.

   Stores
     sessions — saved projects, keyed by id.
     tabs     — the open project tabs, keyed by id: the working state that comes
                back on the next load. Replaces the old one-draft-per-module
                'drafts' store, whose records are migrated into tabs on upgrade.
     bytes    — the files' own bytes (v517): a Uint8Array each, keyed by its SHA-256 in
                hex, written once whatever number of projects and tabs hold it. A record
                of sessions or tabs holds the hashes in its state, and in refs (indexed:
                what the sweep keeps), and is written in one transaction with the bytes
                the store lacks. To v516 every record held its files' bytes as base64,
                written whole at each autosave, tab switch and save: 92 MB, some 550 ms of
                the page's thread, for eight 2048² 16-bit SEM images.
   Only putRec writes a state holding hashes, its refs with it: a record put any other way
   with {__t:'u8'|'b64', h} in it and no refs loses those bytes at the next sweep. A tab
   asleep may hold such references in the page too, its bytes let go (v518: unload, load). A
   file's bytes are never changed once read (the modules only read them, as utils.js
   bytesKey takes for granted too): their hash is taken once per array and kept.
========================================================= */
const DB_NAME = 'datatreat', STORE = 'sessions', TABS_STORE = 'tabs', BYTES = 'bytes', DB_VER = 4;

/* The origin's storage asked to be kept (v518), once a load, as this module loads, where it
   is not so already: without it a browser short of disk space may clear the origin's
   IndexedDB, the projects saved, the open tabs and, since v518, the only copy of a SEM tab
   asleep's files. Nothing is said either way: Chrome and Edge grant it or not by their own
   measures (an app installed, a site bookmarked or much used), asking nothing; Firefox may
   ask the user, in its own words. A browser without the API (a page not served over https
   or localhost has none) is left as it is. */
function keepStorage(){
  try {
    const s = globalThis.navigator && navigator.storage;
    if (s && typeof s.persisted === 'function' && typeof s.persist === 'function')
      s.persisted().then(p=> p || s.persist()).catch(()=>{});
  } catch(e){}
}
keepStorage();

/* One connection, opened once and kept (to v516 each call opened one of its own, never
   closed, which held back any upgrade until they were collected). Its upgrade waits while
   a window of an older version keeps a connection (onDbBlocked tells this window so); a
   window of a newer version asking for its own has this one write out what it holds
   (onDbClosing: the open tabs; two seconds at most) and close it (onDbClosed). DB_VER is
   one way: an older DataTreat cannot open the database once a newer one has (VersionError:
   it shows no tab and no project, and writes nothing). */
let _db = null, _conn = null, _blocked = false;
const _on = {};
const tell = k =>{ if (_on[k]){ try { _on[k](); } catch(e){} } };
function idb(){
  if (_db) return _db;
  const p = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (ev)=>{
      const db = req.result, t = ev.target.transaction;
      if (!db.objectStoreNames.contains(STORE)){
        const os = db.createObjectStore(STORE, { keyPath:'id' });
        os.createIndex('module', 'module', { unique:false });
      }
      if (!db.objectStoreNames.contains(TABS_STORE)){
        const os = db.createObjectStore(TABS_STORE, { keyPath:'id' });
        // Carry the pre-tabs autosave drafts over as open tabs, so upgrading
        // users find their work where they left it instead of on a blank app.
        if (db.objectStoreNames.contains('drafts')){
          const old = t.objectStore('drafts').getAll();
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
      // (v4: the bytes, and the hashes each record holds indexed; the records already
      // stored are left as they are, read in their own form, written in the new at their
      // next write)
      if (!db.objectStoreNames.contains(BYTES)) db.createObjectStore(BYTES);
      for (const s of [STORE, TABS_STORE]){
        const os = t.objectStore(s);
        if (!os.indexNames.contains('refs')) os.createIndex('refs', 'refs', { unique:false, multiEntry:true });
      }
    };
    req.onblocked = ()=>{ _blocked = true; tell('blocked'); };
    req.onsuccess = ()=>{
      const db = req.result;
      _blocked = false; _conn = db;
      let going = false;
      db.onversionchange = ()=>{
        if (going) return;
        going = true;
        tell('closing');
        Promise.race([_queue, new Promise(r=> setTimeout(r, 2000))]).then(()=>{
          db.close(); if (_conn === db){ _conn = null; _db = null; } tell('closed');
        });
      };
      db.onclose = ()=>{ if (_conn === db){ _conn = null; _db = null; } };
      resolve(db);
    };
    req.onerror = ()=>{ _blocked = false; if (_db === p) _db = null; reject(req.error); };
  });
  _db = p;
  return p;
}
const onDbBlocked = fn =>{ _on.blocked = fn; };
const onDbClosing = fn =>{ _on.closing = fn; };
const onDbClosed = fn =>{ _on.closed = fn; };
// The upgrade still waits on a window of an older version: nothing reads or writes yet.
const dbBlocked = ()=> _blocked;

async function txRun(stores, mode, fn, again = true){
  const db = await idb();
  let t;
  try { t = db.transaction(stores, mode); }
  catch(e){
    // (a connection the browser closed without a word, as WebKit's after a while in the
    // background: let go, and one opened again, once)
    if (again && e && e.name === 'InvalidStateError'){ if (_conn === db){ _conn = null; _db = null; } return txRun(stores, mode, fn, false); }
    throw e;
  }
  return new Promise((resolve, reject)=>{
    let out;
    t.oncomplete = ()=> resolve(out);
    t.onerror = ()=> reject(t.error);
    t.onabort = ()=> reject(t.error);
    try { Promise.resolve(fn(t)).then(v=>{ out = v; }, ()=>{}); }   // (a request's error fails the transaction too)
    catch(e){ try { t.abort(); } catch(e2){} reject(e); }
  });
}
const reqP = r => new Promise((res, rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
/* Every write, delete and sweep in the order called: a write whose bytes are still being
   hashed is not overtaken by a later one of the same record, nor a tab's last write by the
   delete of its close (to v516 each was a transaction of its own at once). Reads are not
   queued: one that must see a write awaits it, as before. */
let _queue = Promise.resolve();
function queued(fn){ const p = _queue.then(fn); _queue = p.catch(()=>{}); return p; }

/* ---- Saved projects ---- */
async function allProjects(){ return txRun(STORE, 'readonly', t=> reqP(t.objectStore(STORE).getAll())); }
const putProject = rec => putRec(STORE, rec);
const deleteProject = id => deleteRec(STORE, id);
// A project renamed in the list: its title alone, on the record as stored now (to v516 the
// list's copy was written back whole, over what another window had saved since). False
// when it is gone.
function retitleProject(id, title, updatedAt){
  return queued(()=> txRun(STORE, 'readwrite', t=> new Promise(res=>{
    const os = t.objectStore(STORE), q = os.get(id);
    q.onsuccess = ()=>{ const r = q.result; if (r) os.put({ ...r, title, updatedAt }); res(!!r); };
  })));
}

/* ---- Open tabs ---- */
const putTabRec = (rec, also)=> putRec(TABS_STORE, rec, also);
const deleteTabRec = id => deleteRec(TABS_STORE, id);

/* A record written with its state as stored (stored), in one transaction with the bytes
   it holds that the store lacks, looked for there and then (a sweep, here or in another
   window, may have taken them since): no record is ever left holding bytes not written,
   and a failure writes neither. The bytes go one file after the other, each from the
   callback of the one before: a task each, not megabytes copied in one. `also`: a value
   whose bytes the record holds too without holding the value (a tab asleep: its undo
   history's), stored with it and kept from the sweep by its refs while it holds them. */
const _wrote = new Map();   // store + id → the hashes this window last wrote in that record
function putRec(store, rec, also){
  return queued(async ()=>{
    let s = await stored(rec.state);
    if (also){
      const x = await stored(also), put = new Map(s.put);
      x.put.forEach((get, h)=>{ if (!put.get(h)) put.set(h, get); });
      s = { state: s.state, refs: [...new Set([...s.refs, ...x.refs])], put };
    }
    await txRun([store, BYTES], 'readwrite', t=>{
      const bs = t.objectStore(BYTES), todo = [...s.put];
      const next = ()=>{
        const it = todo.shift(); if (!it) return;
        const [h, get] = it, q = bs.getKey(h);
        q.onsuccess = ()=>{
          if (q.result !== undefined) return next();
          const b = get && get();
          if (b) bs.put(exact(b), h).onsuccess = next;
          else { console.warn('DataTreat: the bytes ' + h + ' are not stored, and not here to store'); next(); }
        };
      };
      next();
      t.objectStore(store).put({ ...rec, state: s.state, refs: s.refs });
    });
    // A file this record held and holds no more (removed, replaced; or not known, at its
    // first write here): its bytes may be no record's now, swept a while after (to v516
    // they went with the record's next write).
    const k = store + ' ' + rec.id, was = _wrote.get(k);
    _wrote.set(k, s.refs);
    if (!was || was.some(h=> !s.refs.includes(h))) sweepSoon(30000);
  });
}
function deleteRec(store, id){
  _wrote.delete(store + ' ' + id);
  const p = queued(()=> txRun(store, 'readwrite', t=>{ t.objectStore(store).delete(id); }));
  sweepSoon(3000);
  return p;
}
// (the bytes alone, not the whole buffer a view may stand on)
const exact = b => b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? b : b.slice();

/* The bytes no record holds any more (a project deleted, a tab closed, a file removed and
   saved) deleted, in one transaction with both stores' refs indexes (no record read): a
   record written meanwhile, here or in another window, comes either before, and keeps its
   bytes, or after, and writes again those it holds (putRec). A while after the page loads,
   after a delete, and after a write that let go of a file. */
let _sweepTimer = 0, _sweepAt = 0;
function sweepSoon(ms = 3000){
  const at = Date.now() + ms;
  if (_sweepTimer && _sweepAt <= at) return;   // (one sooner already set)
  clearTimeout(_sweepTimer); _sweepAt = at;
  _sweepTimer = setTimeout(()=>{ _sweepTimer = 0; sweep(); }, ms);
}
function sweep(){
  return queued(()=> txRun([STORE, TABS_STORE, BYTES], 'readwrite', t=>{
    const bs = t.objectStore(BYTES), a = t.objectStore(STORE).index('refs'), b = t.objectStore(TABS_STORE).index('refs');
    const q = bs.getAllKeys();
    q.onsuccess = ()=>{
      for (const h of q.result || []){
        const ca = a.count(h);
        ca.onsuccess = ()=>{ if (ca.result) return; const cb = b.count(h); cb.onsuccess = ()=>{ if (!cb.result) bs.delete(h); }; };
      }
    };
  })).catch(()=>{});   // (a later one tries again)
}

/* ---- helpers ---- */
const uid = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Encode module state into a JSON-safe form: bytes (a Uint8Array: a file's own, kept for
// its download) → base64, other typed arrays → plain arrays, Date objects → a tagged
// marker. The form of a project file (from v473 to v483 a .json export wrote bytes as
// plain arrays, for older DataTreats), and of IndexedDB's records to v516. Up to v470
// bytes became plain arrays everywhere, 9 bytes stored for each and read back as an
// Array, not as the Uint8Array the module had; such records still decode, as the arrays
// they hold.
const B64_CHUNK = 0x8000;   // String.fromCharCode over megabytes at once overflows the stack
function toB64(b){
  if (b.toBase64) return b.toBase64();   // (the browser's own, where it has one: the same text, sooner)
  let s = '';
  for (let i = 0; i < b.length; i += B64_CHUNK) s += String.fromCharCode.apply(null, b.subarray(i, i + B64_CHUNK));
  return btoa(s);
}
function fromB64(t){
  const s = atob(t), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
const fromB64Fast = t => Uint8Array.fromBase64 ? Uint8Array.fromBase64(t) : fromB64(t);
/* A byte array held in several places (the scans of one XRDML file are patterns of their
   own, sharing its bytes) is written once: where it is first met, with an id, and as
   {__t:'u8', ref: id} after that; decode gives back one array for all of them. To v484
   each place wrote its own copy, so a 40-scan file was stored 40 times.
   park is encode for a state kept in the page (a tab parked, a state about to be stored):
   the bytes stay the module's own array, and SEM's RawRef (a file's bytes as base64)
   itself, wherever they are, neither copied nor encoded; decode gives them back as they
   are. To v516 a parked tab held them as base64, copied at each switch. An array fixed
   (below) is the module's own too, in park's form and back from decode: to v517 a tab
   parked held a copy of each, beside its history's, which shares them (a tab asleep keeps
   both). */
/* Arrays of numbers (or of anything but objects) that nothing changes once made, fixed by
   the module that makes them: XRPD's patterns (2θ, intensities, variance factors) and its
   results' lists, DRS's and EPR's spectra, GC's gases. park and decode take one as it is,
   shared, not copied, and utils.js stateKey by a hash kept for it (numsKey). To v517
   XRPD's were frozen, which in Chromium holds each double in 16 bytes, not 8 (measured for
   v518), and DRS's and EPR's copied into every state parked. No module writes into one; the tests have each frozen as it is fixed (window.__freezeFixed), so that a write
   throws. */
const _fixed = new WeakSet();
function fixed(a){
  if (Array.isArray(a) && !_fixed.has(a)){ _fixed.add(a); if (globalThis.__freezeFixed) Object.freeze(a); }
  return a;
}
const isFixed = a => _fixed.has(a);
function walk(v, keep){
  const met = new Map();   // a Uint8Array → its encoded form
  let ids = 0;
  const enc = x=>{
    if (x instanceof Date) return { __t:'date', v:x.getTime() };
    if (x instanceof Uint8Array){
      if (keep) return x;
      const first = met.get(x);
      if (first){ if (first.id == null) first.id = ids++; return { __t:'u8', ref:first.id }; }
      const o = { __t:'u8', v:toB64(x) }; met.set(x, o); return o;
    }
    if (keep && isText(x)) return x;
    if (!keep && isRaw(x) && x.bytes instanceof Uint8Array) return { id: x.id, b64: toB64(x.bytes) };
    if (ArrayBuffer.isView(x)) return Array.from(x);
    if (Array.isArray(x)) return keep && isFixed(x) ? x : x.map(enc);
    if (x && typeof x === 'object'){ const o = {}; for (const k in x) o[k] = enc(x[k]); return o; }
    return x;
  };
  return enc(v);
}
const encode = v => walk(v, false);
const park = v => walk(v, true);
const bytesOf = t=>{ try { return fromB64(t); } catch(e){ return new Uint8Array(0); } };
// A stored reference to bytes ({__t:'u8', h}, {__t:'b64', h}): read in its place
// (hydrate, or a record reader) before any restore.
const isRef = x => (x.__t === 'u8' || x.__t === 'b64') && typeof x.h === 'string';
function decode(v){
  const shared = new Map();   // id → the bytes, from where they are written out
  // Decoding walks in the order encoding did, so the bytes come before their references;
  // should a reference come first all the same, the whole state is searched for its id.
  const find = (x, id)=>{
    if (!x || typeof x !== 'object' || x instanceof Uint8Array) return null;
    if (x.__t === 'u8' && x.id === id && typeof x.v === 'string') return x;
    for (const k in x){ const r = find(x[k], id); if (r) return r; }
    return null;
  };
  const dec = x=>{
    if (x instanceof Uint8Array) return x;   // (park's: the array itself)
    if (Array.isArray(x)) return isFixed(x) ? x : x.map(dec);
    if (x && typeof x === 'object'){
      if (isText(x) && Object.getPrototypeOf(x) !== Object.prototype) return x;   // (park's: SEM's RawRef itself)
      if (x.__t === 'date') return new Date(x.v);
      if (x.__t === 'u8' && typeof x.v === 'string'){
        if (x.id != null && shared.has(x.id)) return shared.get(x.id);
        const b = bytesOf(x.v); if (x.id != null) shared.set(x.id, b); return b;
      }
      if (x.__t === 'u8' && x.ref != null){
        if (!shared.has(x.ref)){ const at = find(v, x.ref); shared.set(x.ref, at ? bytesOf(at.v) : new Uint8Array(0)); }
        return shared.get(x.ref);
      }
      // (a reference whose bytes were not read first: a path that missed hydrate)
      if (isRef(x)){ console.error('DataTreat: bytes not read before the restore (' + x.h + ')'); return null; }
      const o = {}; for (const k in x) o[k] = dec(x[k]); return o;
    }
    return x;
  };
  return dec(v);
}

/* ---- The files' bytes in the bytes store ----
   Each array's SHA-256, taken once and kept by the array (SEM's RawRef, which holds a
   file's bytes as base64, by itself), where the browser has WebCrypto (https, localhost):
   without it, or should anything fail, the bytes stay in the record as encode writes
   them, as to v516. A text holder is hashed only where its text is the very one toB64
   writes back, so that a project file gives the same text; a text the page already holds
   under a hash (read back from the store: the module made a RawRef of it) takes that hash.
   SEM's own id (FNV) and bytesKey are never keys here: the one cache not by identity
   compares the whole text. One file a task. */
const _hash = new WeakMap();   // a Uint8Array or a text holder → its hash (false: kept inline)
const _texts = new Map();      // a hash → WeakRef of a text holder of those bytes
const _arrs = new Map();       // a hash → WeakRef of an array of those bytes the page holds (load)
const isObj = x => x !== null && typeof x === 'object';
// (a text holder: an object of an id and a b64 string alone, as SEM's RawRef and its copies to v517)
const isText = x => !!x && typeof x === 'object' && typeof x.b64 === 'string' && !Array.isArray(x)
  && Object.keys(x).length === 2 && Object.prototype.hasOwnProperty.call(x, 'id');
/* A file's bytes and its id alone: SEM's RawRef since v518, and its copies (park's; unload's,
   its bytes a reference by hash). Written as v517 writes its text holder, { id, b64 }: in a
   record and a project saved (stored) its b64 {__t:'b64', h}, under the bytes' SHA-256 as
   the array is stored (nothing stored twice), in a project file (encode) the base64; read
   back (fill) as { id, bytes }. So v517 reads SEM's tabs and projects as its own (a v517
   window, or the app rolled back, would read { id, bytes } as no file, and write the tab's
   record without it, its bytes swept). */
const isRaw = x => !!x && typeof x === 'object' && !Array.isArray(x) && !ArrayBuffer.isView(x) && typeof x.id === 'string'
  && (x.bytes instanceof Uint8Array || (isObj(x.bytes) && x.bytes.__t === 'u8' && typeof x.bytes.h === 'string'))
  && Object.keys(x).length === 2;
const hasCrypto = ()=> !!(globalThis.crypto && globalThis.crypto.subtle);
const hex = buf => [...new Uint8Array(buf)].map(b=> b.toString(16).padStart(2, '0')).join('');
// (a task of its own; a message, which a hidden page does not hold back as it does timers)
const nextTask = ()=> new Promise(r=>{
  if (typeof MessageChannel !== 'function') return setTimeout(r, 0);
  const c = new MessageChannel(); c.port1.onmessage = ()=>{ c.port1.close(); r(); }; c.port2.postMessage(0);
});
function register(h, x, m = _texts){
  if (typeof WeakRef !== 'function') return;
  try { const r = m.get(h); if (!(r && r.deref())) m.set(h, new WeakRef(x)); } catch(e){}
}
// An array of these bytes the page still holds (another tab's, awake), else null.
function liveOf(h){
  const r = _arrs.get(h), a = r && r.deref();
  if (r && !a) _arrs.delete(h);
  return a || null;
}
function textHash(s){
  for (const [k, r] of _texts){ const o = r.deref(); if (!o){ _texts.delete(k); continue; } if (o.b64 === s) return k; }
  return false;
}
async function hashOf(x){
  if (_hash.has(x)) return _hash.get(x);
  let h = false;
  try {
    const text = isText(x);
    if (text) h = textHash(x.b64);
    if (!h && hasCrypto()){
      let b = x;
      if (text){ b = fromB64Fast(x.b64); if (toB64(b) !== x.b64) b = null; }
      if (b){ await nextTask(); h = hex(await globalThis.crypto.subtle.digest('SHA-256', b)); }
    }
    if (h) register(h, x, text ? _texts : _arrs);
  } catch(e){ h = false; }
  if (_hash.has(x)) return _hash.get(x);
  _hash.set(x, h);
  return h;
}
/* A state as IndexedDB holds it (park's form in): { state, refs (the hashes it holds), put
   (hash → its bytes, from what the page holds) }. Bytes become {__t:'u8', h}, with the id
   of encode's at every place of bytes held in several (the later ones too: {__t:'u8', h,
   id}, never encode's ref, which a DataTreat to v516 would take for bytes it cannot find);
   a text holder's b64 {__t:'b64', h}, its keys in their order; bytes not hashed as encode
   writes them. What holds no bytes is park's own, shared, not copied (nothing changes a
   parked state). Cached by the parked state. It never fails: should anything, the state
   is the record of v516, its bytes in it. */
const _stored = new WeakMap();
async function stored(v){
  if (!v || typeof v !== 'object') return { state: v, refs: [], put: new Map() };
  if (_stored.has(v)) return _stored.get(v);
  let out;
  try {
    const todo = new Set();
    (function scan(x){
      if (!x || typeof x !== 'object') return;
      if (x instanceof Uint8Array || isText(x)){ if (!_hash.has(x)) todo.add(x); return; }
      if (Array.isArray(x)){ if (x.some(isObj)) x.forEach(scan); return; }
      for (const k in x) scan(x[k]);
    })(v);
    for (const x of todo) await hashOf(x);
    const refs = new Set(), put = new Map(), met = new Map();
    const want = (h, get)=>{ refs.add(h); if (!put.get(h)) put.set(h, get); };
    let ids = 0;
    const enc = x=>{
      if (x instanceof Uint8Array){
        const first = met.get(x);
        if (first){ if (first.id == null) first.id = ids++; return first.h ? { __t:'u8', h:first.h, id:first.id } : { __t:'u8', ref:first.id }; }
        const h = _hash.get(x), o = h ? { __t:'u8', h } : { __t:'u8', v:toB64(x) };
        if (h) want(h, ()=> x);
        met.set(x, o); return o;
      }
      if (isText(x)){
        const h = _hash.get(x), o = {};
        for (const k in x) o[k] = k === 'b64' && h ? { __t:'b64', h } : x[k];
        if (h) want(h, ()=> fromB64Fast(x.b64));
        return o;
      }
      if (isRaw(x)){
        const b = x.bytes, arr = b instanceof Uint8Array, h = arr ? _hash.get(b) : b.h;
        if (typeof h === 'string'){ want(h, arr ? ()=> b : null); return { id: x.id, b64: { __t:'b64', h } }; }
        if (arr) return { id: x.id, b64: toB64(b) };
      }
      if (Array.isArray(x)){
        // (an array of numbers looked at by the browser's own some: a loop of ours reading
        // it has V8 make its small integers doubles, twice the memory, in a parked state)
        if (!x.some(isObj)) return x;
        let o = null;
        for (let i = 0; i < x.length; i++){ const a = x[i], e = a && typeof a === 'object' ? enc(a) : a; if (e !== a && !o) o = x.slice(0, i); if (o) o.push(e); }
        return o || x;
      }
      if (x && typeof x === 'object'){
        if (isRef(x)){ want(x.h, null); return x; }   // (a stored form met again)
        let o = null;
        for (const k in x){ const a = x[k], e = a && typeof a === 'object' ? enc(a) : a; if (e !== a && !o){ o = {}; for (const j in x){ if (j === k) break; o[j] = x[j]; } } if (o) o[k] = e; }
        return o || x;
      }
      return x;
    };
    out = { state: enc(v), refs: [...refs], put };
  } catch(e){
    console.warn('DataTreat: the files kept in the record, as before:', e);
    return { state: encode(v), refs: [], put: new Map() };
  }
  _stored.set(v, out);
  return out;
}

/* ---- Reading the bytes back ----
   A hash the store lacks, or whose value cannot be read (a large value's file lost), gives
   null: a file whose bytes the project does not hold, which the modules show so. Only
   the transaction failing as a whole throws: the caller restores nothing then, rather
   than without its bytes. */
function getBytes(bs, hs, got){
  hs.forEach(h=>{
    const q = bs.get(h);
    q.onsuccess = ()=>{ got.set(h, q.result instanceof Uint8Array ? q.result : null); };
    q.onerror = e=>{ e.preventDefault(); e.stopPropagation(); got.set(h, null); };
  });
}
async function readBytes(hs){
  const got = new Map();
  if (hs.size) await txRun(BYTES, 'readonly', t=> getBytes(t.objectStore(BYTES), hs, got));
  return got;
}
function refsIn(v, set = new Set()){
  if (!v || typeof v !== 'object' || v instanceof Uint8Array) return set;
  if (Array.isArray(v)){ if (v.some(isObj)) v.forEach(x=> refsIn(x, set)); return set; }
  if (isRef(v)){ set.add(v.h); return set; }
  for (const k in v) refsIn(v[k], set);
  return set;
}
// The records of a store (all, or the one of an id) with the bytes they hold, read in one
// transaction: a record and its bytes as they were written together, whatever another
// window writes or sweeps meanwhile. lazy(rec): a record whose bytes are not read (a tab
// that comes back asleep, its bytes read as it wakes). All of them by a cursor, each record
// read in a task of its own (getAll would read 60 XRPD tabs' records in one task of 0.47 s).
function readRecs(store, id, lazy){
  const out = { recs: [], hs: new Set(), got: new Map(), lost: 0 };   // (lost: the files whose bytes could not be read)
  return txRun([store, BYTES], 'readonly', t=>{
    const q = id == null ? t.objectStore(store).openCursor() : t.objectStore(store).get(id);
    q.onsuccess = ()=>{
      const r = id == null ? q.result && q.result.value : q.result;
      if (r){ out.recs.push(r); if (!(lazy && lazy(r))) refsIn(r.state, out.hs); }
      if (id == null && q.result){ q.result.continue(); return; }
      getBytes(t.objectStore(BYTES), out.hs, out.got);
    };
  }).then(()=>{ out.hs.forEach(h=>{ if (!out.got.get(h)) out.lost++; }); return out; });
}
/* Stored states (or a project file's: fromFile) as park gives them, their bytes put back:
   before any restore (a tab at startup, a project opened, its CSV, its saved key) and
   before a project file's state is stored. Bytes held in several places come back as one
   array, arrays only alike as arrays of their own (as encode saw them); bytes the store
   lacks as null; bytes inline (a record to v516, a project file) as an array. A project
   file's references are taken as no bytes: a file DataTreat writes holds its bytes. */
async function hydrate(states, fromFile){
  const hs = new Set();
  if (!fromFile) states.forEach(s=> refsIn(s, hs));
  const got = await readBytes(hs);
  return states.map(s=> fill(s, got));
}
// Every open tab's record, with its state as park gives it ({ recs, states, missing: the
// files whose bytes could not be read }); those lazy(rec) names as stored, their bytes not
// read (references load reads).
async function allTabStates(lazy){
  const { recs, got, lost } = await readRecs(TABS_STORE, null, lazy);
  return { recs, states: recs.map(r=> lazy && lazy(r) ? r.state || null : fill(r.state || null, got)), missing: lost };
}
// A saved project's record, its state as park gives it ({ rec, state, missing }), or null
// when it is gone.
async function readProject(id){
  const { recs: [rec], got, lost } = await readRecs(STORE, id);
  return rec ? { rec, state: fill(rec.state, got), missing: lost } : null;
}
// A saved project's record, its state as a project file holds it ({ rec, state, missing }),
// or null when it is gone.
async function exportedProject(id){
  const { recs: [rec], got, lost } = await readRecs(STORE, id);
  return rec ? { rec, state: expand(rec.state, got), missing: lost } : null;
}
function fill(v, got){
  if (!v || typeof v !== 'object') return v;
  const byId = new Map(), used = new Set();
  const find = (x, id)=>{
    if (!x || typeof x !== 'object' || x instanceof Uint8Array) return null;
    if (x.__t === 'u8' && x.id === id && (typeof x.v === 'string' || typeof x.h === 'string')) return x;
    for (const k in x){ const r = find(x[k], id); if (r) return r; }
    return null;
  };
  // (an array met a second time, not shared: a copy, for encode to write it twice as before)
  const arr = h=>{
    const b = got.get(h);
    if (!b) return null;
    const c = used.has(h) ? b.slice() : b;
    used.add(h); _hash.set(c, h); register(h, c, _arrs);
    return c;
  };
  const one = x => typeof x.h === 'string' ? arr(x.h) : bytesOf(x.v);
  // An object met again gives the one made for it (unload's value shares an object where
  // the value it was made of did: SEM's RawRef in every step of a history that holds its
  // file, one array of bytes, not a copy of the array at every step but the first). A
  // record shares none: park and encode make an object a place.
  const done = new Map();
  const go = x =>{
    if (!x || typeof x !== 'object' || x instanceof Uint8Array) return x;
    if (!done.has(x)) done.set(x, make(x));
    return done.get(x);
  };
  const make = x=>{
    if (Array.isArray(x)) return x.some(isObj) ? x.map(go) : x;   // (an array of numbers as read)
    if (x.__t === 'u8' && (typeof x.h === 'string' || typeof x.v === 'string')){
      if (x.id != null && byId.has(x.id)) return byId.get(x.id);
      const b = one(x); if (x.id != null) byId.set(x.id, b); return b;
    }
    if (x.__t === 'u8' && x.ref != null){
      if (!byId.has(x.ref)){ const at = find(v, x.ref); byId.set(x.ref, at ? one(at) : new Uint8Array(0)); }
      return byId.get(x.ref);
    }
    if (isRef(x)) return null;   // ({__t:'b64'} out of a text holder)
    // a text holder as stored (SEM's RawRef, v517's and since): its bytes back as { id, bytes }
    // (isRaw), the array known by its hash
    const t = x.b64 && typeof x.b64 === 'object' && x.b64.__t === 'b64' && typeof x.b64.h === 'string' ? x.b64.h : null;
    if (t && got.get(t) && typeof x.id === 'string' && Object.keys(x).length === 2) return { id: x.id, bytes: arr(t) };
    const o = Object.create(Object.getPrototypeOf(x));   // (an object of a class, unload's, one again)
    for (const k in x) o[k] = go(x[k]);
    // (another, none of the app's: its text; bytes not stored, null)
    if (t){
      const b = got.get(t);
      o.b64 = b ? toB64(b) : null;
      if (b){ _hash.set(o, t); register(t, o); }
    }
    return o;
  };
  return go(v);
}
/* A stored state as a project file holds it, byte for byte encode's form: the bytes as
   base64 where encode writes them, ids and refs as encode gives them; those the store
   lacks as null. A state that holds no reference is given back as it is. */
function expand(v, got){
  if (!refsIn(v).size) return v;
  const seen = new Map();
  const go = x=>{
    if (Array.isArray(x)) return x.some(isObj) ? x.map(go) : x;
    if (!x || typeof x !== 'object' || x instanceof Uint8Array) return x;
    if (x.__t === 'u8' && typeof x.h === 'string'){
      if (x.id != null && seen.has(x.id)) return seen.get(x.id) ? { __t:'u8', ref:x.id } : null;
      const b = got.get(x.h);
      if (x.id != null) seen.set(x.id, !!b);
      if (!b) return null;
      const o = { __t:'u8', v:toB64(b) }; if (x.id != null) o.id = x.id; return o;
    }
    if (x.__t === 'b64' && typeof x.h === 'string'){ const b = got.get(x.h); return b ? toB64(b) : null; }
    const o = {}; for (const k in x) o[k] = go(x[k]); return o;
  };
  return go(v);
}

/* ---- A tab asleep without its files' bytes (tabs.js lighten) ----
   unload: a value the page keeps (a tab asleep: its parked state and its undo history, as
   one value) with each array of bytes this page hashed, and so a write put in the store
   with a record that holds it (putRec), in its place as {__t:'u8', h}: one object for one
   array, with an id where it is met more than once, so that fill gives one array back for
   it; a text holder's text as {__t:'b64', h}. Bytes not hashed (no WebCrypto) stay. What
   holds no bytes is the value's own, not copied; an object met twice is copied once, and
   one of a class as one of its class (SEM's RawRef: its JSON, and so a history's
   comparison of states, the same). */
function unload(v){
  const met = new Map(), done = new Map();
  let ids = 0;
  const go = x=>{
    if (!x || typeof x !== 'object') return x;
    if (x instanceof Uint8Array){
      const h = _hash.get(x);
      if (typeof h !== 'string') return x;
      let o = met.get(x);
      if (o){ if (o.id == null) o.id = ids++; return o; }
      o = { __t:'u8', h }; met.set(x, o); return o;
    }
    if (ArrayBuffer.isView(x)) return x;
    if (done.has(x)) return done.get(x);
    let o = null;
    if (isText(x)){ const h = _hash.get(x); if (typeof h === 'string') o = { ...x, b64: { __t:'b64', h } }; }
    else if (Array.isArray(x)){
      if (x.some(isObj)) for (let i = 0; i < x.length; i++){ const e = go(x[i]); if (e !== x[i] && !o) o = x.slice(0, i); if (o) o.push(e); }
    } else {
      for (const k in x){
        const e = go(x[k]);
        if (e !== x[k] && !o){ o = Object.create(Object.getPrototypeOf(x)); for (const j in x){ if (j === k) break; o[j] = x[j]; } }
        if (o) o[k] = e;
      }
    }
    done.set(x, o || x);
    return o || x;
  };
  return go(v);
}
/* load: unload's value with its bytes back, as fill gives them: an array the page still
   holds of a hash (another tab's, awake: one array for both), else the bytes store's, read
   in one transaction. { v, lost: the set of the hashes read as none (not stored any more:
   null in their place, as in a record read), failed: the transaction failed as a whole
   (none of the store's read, all lost) }. */
async function load(v){
  const hs = refsIn(v), got = new Map(), need = new Set();
  hs.forEach(h=>{ const a = liveOf(h); if (a) got.set(h, a); else need.add(h); });
  let failed = false;
  if (need.size){
    try { (await readBytes(need)).forEach((b, h)=> got.set(h, b)); }
    catch(e){ failed = true; console.warn('DataTreat: the files of a tab asleep could not be read:', e); }
  }
  const lost = new Set();
  hs.forEach(h=>{ if (!got.get(h)) lost.add(h); });
  return { v: fill(v, got), lost, failed };
}
// A value holds references to bytes, to be read before it is restored.
const unread = v => refsIn(v).size > 0;

export { allProjects, putProject, deleteProject, retitleProject, readProject, exportedProject,
         allTabStates, putTabRec, deleteTabRec, uid, encode, decode, park, stored,
         hydrate, sweep, sweepSoon, dbBlocked, onDbBlocked, onDbClosing, onDbClosed, unload, load, unread, refsIn, fixed, isFixed };
