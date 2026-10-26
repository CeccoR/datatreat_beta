import { csvLine, fmtNum, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, buildAlertsHtml, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, registerBusy, busyChanged, registerModule, onSectionChange, flashFieldInvalid, kept, getModuleHistory } from './utils.js';
import { readTescanTiff, readFile, SemReadError, hashBytes, fromB64, reducedCopy, cropStats, resample, cardKey, cardLevels } from './sem-read.js';

/* =========================================================
   SEM MODULE
   Tescan images (sem-read.js): each one's metadata, and its crop. The crop is kept as
   a rectangle in the original's pixels, inside the image (the info bar is never in
   it); the image itself is never changed.

   A file's bytes live in the module state as they are, a Uint8Array in a RawRef: the
   undo stack compares snapshots by JSON.stringify on every edit, and a RawRef
   serialises in JSON as its id alone (toJSON), so a snapshot compares at the cost of its
   crops. db.js keeps the array itself in a tab parked and in its history, and stores it
   once, by its hash, in the bytes store; a project file holds it as base64. To v517 the
   module kept the base64 (11.9 MB for a file of 8.9 MB), read into bytes again at every
   decoding; a project of then is read as it is (semRestore). Records, projects saved and
   project files hold a RawRef as v517 held its own, { id, b64 } (db.js isRaw), so that
   v517 reads them; db.js reads it back as { id, bytes }.

   MADE PER TAB (v518): createSem is the module's factory (utils.js registerModule), each
   open SEM tab that is awake an instance of its own, made of its copy of index.html's
   section (root) and a layer (for the drag's ghost). Its elements are found in root,
   never in the page: its ids are the page's only while it is on show, and a reading
   going on while its tab is hidden writes into its own. What the files are made into is
   the module's, for every instance, keyed by the file (its id, a hash of its bytes, see
   The files): its bytes, one array a file whichever tabs hold it; its header, reduced
   copy and card (imgs); its image at full size, a view of its bytes where they are its
   levels (full); its crops' statistics and its curves (statsCache, lutCache). What an
   instance draws of them is its own: the editor's image at full size, let go as its tab
   is hidden and drawn again as it is shown. A tab asleep lets go of its files' bytes, its
   state and history holding references by hash, read back from the store as it wakes
   (registerModule's dropBytes, tabs.js lighten): what the module keeps by file holds no
   bytes (imgs) or holds them weakly (raws) or only for the tabs awake (full).
========================================================= */
class RawRef {
  constructor(id, bytes){ this.id = id; this.bytes = bytes; }
  toJSON(){ return 'raw:' + this.id; }
}
// (hashBytes, fromB64: sem-read.js, shared with the worker that reads the files)

/* ---- The files ----
   A file is known by its id (sem-read.js hashBytes: FNV-1a and its length). Its bytes
   are one array whichever tabs hold it: a file read or restored in a tab while another
   tab, a history or a tab asleep holds it takes the array held (rawOf), its own let go;
   the same id, length and bytes (compared: the id is a 32-bit hash). A RawRef given (a
   state restored, a history woken: db.js load's copy of the one it held) is the one kept
   where none is, else the one kept is taken in its place (adopt, at the wake). Its last
   RawRef gone (gone), its image at full size goes; what else it is made into (imgs: its
   header, reduced copy and cards, no bytes, some 0.15 MB an image of 2048²)
   stays while a tab asleep holds the file (heldAsleep: its state or history names it, its
   bytes let go, tabs.js lighten), which, woken, draws its thumbnails and cards from them
   without making them again (measured at v518, 20 tabs of 8 images 2048 × 2176: woken
   in 0.30–0.56 s, the longest task 56–118 ms; where they were made again, 0.67–0.93 s and
   368–551 ms), and goes with the last tab asleep that holds it (woken, its RawRef holds it
   again; closed). Its statistics and curves go with them, if their caches still hold
   them. */
const raws = new Map();   // id → WeakRef of the RawRef of its bytes
const alive = id =>{ const w = raws.get(id); return !!(w && w.deref()); };
// The files of each tab asleep, by its key (registerModule's asleep, from tabs.js): the ids
// of every RawRef (or its copy, its bytes a reference; as its record holds it, a tab come
// back asleep at a reload: { id, b64 }) its state and history hold.
const asleepIds = new Map();
const heldAsleep = id =>{ for (const s of asleepIds.values()) if (s.has(id)) return true; return false; };
function idsIn(v, out = new Set(), seen = new Set()){
  if (!v || typeof v !== 'object' || ArrayBuffer.isView(v) || seen.has(v)) return out;
  seen.add(v);
  if (typeof v.id === 'string' && ('bytes' in v || 'b64' in v)) out.add(v.id);
  else for (const k in v) idsIn(v[k], out, seen);
  return out;
}
function madeGone(id){
  imgs.delete(id);
  for (const m of [statsCache, lutCache]) for (const k of [...m.keys()]) if (k.startsWith(id + '|')) m.delete(k);
}
// A tab woken (or closed): the RawRefs its history holds, db.js load's copies of those it
// held asleep (one a file), kept as the files' own (rawOf), or the one kept taken in their
// place, so that a file its history alone holds is held as before its sleep, what it is
// made into with it, and goes with its last step (gone).
function adopt(key){
  const h = getModuleHistory(key);
  if (h) for (const s of h.states) for (const f of s && Array.isArray(s.files) ? s.files : [])
    if (f && f.raw instanceof RawRef && f.raw.bytes instanceof Uint8Array) f.raw = rawOf(f.raw.id, f.raw.bytes, f.raw);
}
function asleepHolds(key, v){
  const was = asleepIds.get(key);
  if (v) asleepIds.set(key, idsIn(v)); else { asleepIds.delete(key); adopt(key); }
  if (was) for (const id of was) if (!alive(id) && !heldAsleep(id)) madeGone(id);
}
const gone = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(id =>{
  if (alive(id)) return;   // (made again since)
  raws.delete(id); full.delete(id);
  if (!heldAsleep(id)) madeGone(id);
}) : null;
function sameBytes(a, b){
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  const n = a.byteOffset % 4 || b.byteOffset % 4 ? 0 : a.length >> 2;
  if (n){ const x = new Uint32Array(a.buffer, a.byteOffset, n), y = new Uint32Array(b.buffer, b.byteOffset, n); for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false; }
  for (let i = 4*n; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function rawOf(id, bytes, r0){
  const w = raws.get(id), had = w && w.deref();
  if (had && (had === r0 || sameBytes(had.bytes, bytes))) return had;
  const r = r0 instanceof RawRef && r0.id === id && r0.bytes === bytes ? r0 : new RawRef(id, bytes);
  if (typeof WeakRef === 'function' && !had){ raws.set(id, new WeakRef(r)); if (gone) gone.register(r, id); }
  return r;
}

/* ---- What the files are made into ----
   imgs: id → { r (readTescanTiff's header: its numbers and warning, no pixels), small
   (sem-read.js reducedCopy, some 160 px across, for the thumbnails), cards (its group
   card's levels, sem-read.js cardLevels, by the part of the image they take and their
   size: the last CARDS made or used, some 0.08 MB each, so that an undo or a redo of a
   crop takes them; to v517 the last one alone, an undo making a group's again) }, null
   where its bytes do not read:
   some 0.15 MB an image of 2048², kept while the file is held, by a tab awake or asleep
   (gone), so that a tab woken draws its thumbnails without reading its images whole (to
   v517 the last 512 at most).
   full: id → { px (its levels at full size), size (bytes beyond its file's: none for a
   view of them), used }. For a file of 16 bits in this machine's order (Tescan's) the
   levels are a view of its bytes, made at once and costing nothing (sem-read.js view);
   for another (8 bits, the other order, pixels made square) a copy, 2 bytes a pixel,
   read again in some 11 ms (2048², 8 bits). Kept: those of the files of the instance on
   show and of a reading, the copies within DEC_BUDGET (three such images; the one in the
   editor, the latest used, among them), the least recently used let go first; the others
   let go after the task (evict), read again from the bytes when asked for. To v517 every
   image of the list was kept decoded, a copy, whatever its tab did, and others to
   128 MB (to v487 every image ever loaded, till the page was reloaded). */
const DEC_BUDGET = 32*2**20, CARDS = 4;
const imgs = new Map(), full = new Map();
let used = 0, evictTimer = 0;
function imgOf(f){
  const id = f.raw.id;
  let e = imgs.get(id);
  if (e === undefined){
    let r = null;
    try { r = f.raw.bytes ? readTescanTiff(f.raw.bytes, f.name, { head: true }) : null; } catch(err){ r = null; }
    e = r && { r, small: null, cards: new Map() };
    imgs.set(id, e);
  }
  return e;
}
// What a file's header says (readTescanTiff's numbers, its pixels unread), null where its
// bytes do not read: a restore learns which images still read, and their sizes.
const info = f =>{ const e = imgOf(f); return e ? e.r : null; };
// Its levels at full size, null where they do not read.
function pixelsOf(f){
  const id = f.raw.id, e = full.get(id);
  if (e){ e.used = ++used; return e.px; }
  if (!info(f)) return null;
  let r;
  try { r = readTescanTiff(f.raw.bytes, f.name, { view: true }); } catch(err){ imgs.set(id, null); return null; }
  full.set(id, { px: r.pixels, size: r.view ? 0 : r.pixels.byteLength, used: ++used });
  scheduleEvict();
  return r.pixels;
}
// The image whole ({ width, imageH, pixels… }: what sem-read.js reads from), or null.
function decoded(f){ const r = info(f), px = r && pixelsOf(f); return px ? { ...r, pixels: px } : null; }
function smallOf(f){
  const e = imgOf(f);
  if (e && !e.small){ const d = decoded(f); if (d){ e.small = reducedCopy(d); kept.made['sem-reduced'] = (kept.made['sem-reduced'] || 0) + 1; } }
  return e && e.small;
}
// A file read: what the reading made of it, kept; added to what was kept of it, a file read
// again (in another tab, or after its removal), its reduced copy and its cards kept.
function remember(id, r, small, card, px){
  const was = imgs.get(id), cards = was ? was.cards : new Map();
  if (card){ cards.delete(card.pk); cards.set(card.pk, card); if (cards.size > CARDS) cards.delete(cards.keys().next().value); }
  imgs.set(id, { r, small: was && was.small || small, cards });
  if (px) full.set(id, { px, size: px.byteLength, used: ++used });
  scheduleEvict();
}
// The instances awake: { shown(), ids() (its files'), reading() (the files being read), hide() }.
const insts = new Set();
function scheduleEvict(){ if (!evictTimer) evictTimer = setTimeout(evict, 0); }
function evict(){
  evictTimer = 0;
  const keep = new Set();
  for (const i of insts){ i.reading().forEach(id=> keep.add(id)); if (i.shown()) i.ids().forEach(id=> keep.add(id)); }
  let total = 0;
  for (const [id, e] of full){ if (keep.has(id)) total += e.size; else full.delete(id); }
  if (total <= DEC_BUDGET) return;
  for (const [id, e] of [...full].sort((a, b)=> a[1].used - b[1].used)){
    if (total <= DEC_BUDGET) break;
    full.delete(id); total -= e.size;
  }
}
// A section shown: an instance no longer on show lets go of the editor's image (hide), and
// of the images at full size that only it held.
onSectionChange(()=>{ insts.forEach(i=>{ if (!i.shown()) i.hide(); }); scheduleEvict(); });

/* An image's crop as a histogram of its levels with their count, mean and spread, the
   last 64 crops' of every tab (a file read comes with its default crop's: the worker
   computes them); an image's whole curve as the 8-bit grey of each of its levels, the
   last ones made (lutOf). Both keyed by what they are made from, the file's id first. */
const statsCache = new Map(), lutCache = new Map();
const statsKey = (id, c) => `${id}|${c.x},${c.y},${c.w},${c.h}`;
const lru = (m, k)=>{ const v = m.get(k); if (v !== undefined){ m.delete(k); m.set(k, v); } return v; };
function statsOf(f){
  const key = statsKey(f.raw.id, f.crop);
  let st = lru(statsCache, key);
  if (st) return st;
  st = cropStats(pixelsOf(f), info(f).width, f.crop);
  statsCache.set(key, st);
  if (statsCache.size > 64) statsCache.delete(statsCache.keys().next().value);
  return st;
}

/* ---- Loading: the reading worker, one for every SEM tab ----
   Each file is read off the page's thread, by sem-read.worker.js (sem-read.js
   readFile), one after another, whichever tab sent it: its bytes go there and come
   back. A tab's reading stopped (its tab closed) drops its answers; the worker goes on
   for the other tabs' readings, else is let go at once. Idle IDLE_MS, it is let go (a
   few MB), made again for the next file. Where none runs (a browser without module
   workers), the files are read on the page's thread, a frame let through between two. */
const reader = { w: null, failed: false, answered: false, seq: 0, idle: 0 };
const pending = new Map();   // seq → { ok, owner }
const IDLE_MS = 20000;
function workerOf(){
  if (reader.w || reader.failed) return reader.w;
  try {
    const w = new Worker(new URL('./sem-read.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = e =>{ reader.answered = true; const p = pending.get(e.data.seq); if (p){ pending.delete(e.data.seq); p.ok(e.data); } idleSoon(); };
    // One that never answered will not run here (the file not found, no module
    // workers): from then on the files are read on the page's thread.
    w.onerror = e =>{ e.preventDefault(); dropWorker(!reader.answered); };
    reader.w = w;
  } catch(err){ reader.failed = true; reader.w = null; }
  return reader.w;
}
function idleSoon(){ clearTimeout(reader.idle); reader.idle = pending.size ? 0 : setTimeout(()=>{ if (!pending.size) dropWorker(false); }, IDLE_MS); }
// The worker let go (idle, a reading stopped, or it failed): what it had yet to answer
// is read again, here or by the next one.
function dropWorker(failed){
  clearTimeout(reader.idle);
  if (reader.w) reader.w.terminate();
  reader.w = null; reader.answered = false;
  if (failed) reader.failed = true;
  const ps = [...pending.values()]; pending.clear();
  ps.forEach(p=> p.ok({ retry: true }));
}
// A tab's reading stopped: its answers dropped; the worker let go if no other waits on it.
function stopReads(owner){
  let had = false;
  for (const [s, p] of [...pending]) if (p.owner === owner){ pending.delete(s); p.ok({ retry: true }); had = true; }
  if (had && !pending.size) dropWorker(false);
}
// A file read: { id, r (its header), px (its levels where a copy), small, st, card, bytes }.
async function readOne(file, job, owner){
  // (the worker taken once the bytes are in: one that would not run has said so by then)
  const buf = await file.arrayBuffer(), w = workerOf();
  if (w){
    const s = ++reader.seq;
    clearTimeout(reader.idle);
    const res = await new Promise(ok=>{ pending.set(s, { ok, owner }); w.postMessage({ seq: s, buf, name: file.name }, [buf]); });
    if (!res.retry || job.stopped) return res.buf ? { ...res, bytes: new Uint8Array(res.buf) } : res;
  }
  await new Promise(ok=> setTimeout(ok, 0));
  if (job.stopped) return { retry: true };
  try { const out = readFile(new Uint8Array(await file.arrayBuffer()), file.name); return { ...out, r: { ...out.r, pixels: null }, px: out.r.view ? null : out.r.pixels }; }
  catch(err){ return err instanceof SemReadError ? { error: err.message } : { fault: String(err && err.message || err), kind: err && err.name }; }
}

const nameCtx = document.createElement('canvas').getContext('2d');

/* ---- What every instance draws and checks with: pure, the module's ---- */
// File names and what a file says about itself go into the page as text, never as markup.
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// On the page: d significant digits, the point as a point (fmtNum, with the CSV's
// decimal separator and fixed decimals, is for the export).
const sig = (v, d) => Number.isFinite(v) ? String(+v.toPrecision(d)) : '—';

/* ---- Crop rules ---- */
// The smallest crop side (px); an image smaller than it is taken whole.
const MIN_CROP = 64;
// The crop's width:height when locked.
const ASPECTS = { '1:1': 1, '4:3': 4/3, '3:2': 3/2, free: null };
// The ratio named by a crop of w × h, if it is one of the locks (within 1 %).
const aspectOf = (w, h) => Object.keys(ASPECTS).find(k=> ASPECTS[k] && Math.abs(w/h/ASPECTS[k] - 1) < 0.01) || 'free';
// A rectangle made to fit an image W × H: whole pixels, sides at least MIN_CROP (or
// the image's), inside it, and at ratio r when locked (the longer side shortened).
function fitCrop(c, W, H, r){
  let w = Math.round(Math.min(Math.max(c.w, Math.min(MIN_CROP, W)), W));
  let h = Math.round(Math.min(Math.max(c.h, Math.min(MIN_CROP, H)), H));
  if (r){
    if (w/h > r) w = Math.max(Math.min(MIN_CROP, W), Math.round(h*r));
    else h = Math.max(Math.min(MIN_CROP, H), Math.round(w/r));
    w = Math.min(w, W); h = Math.min(h, H);
  }
  const x = Math.round(Math.min(Math.max(0, c.x), W - w)), y = Math.round(Math.min(Math.max(0, c.y), H - h));
  return { x, y, w, h };
}
const sameCrop = (a, b) => ['x', 'y', 'w', 'h'].every(k=> a[k] === b[k]);
const defaultCrop = r => ({ x: 0, y: 0, w: r.width, h: r.imageH });
const isDefaultCrop = f =>{ const r = info(f), d = r && defaultCrop(r); return !!d && ['x', 'y', 'w', 'h'].every(k=> f.crop[k] === d[k]); };
// A crop as the rules make it: whole pixels, inside the image, its sides at least
// MIN_CROP (or the image's).
const validCrop = (c, r) => ['x', 'y', 'w', 'h'].every(k=> Number.isInteger(c[k])) && c.x >= 0 && c.y >= 0
  && c.w >= Math.min(MIN_CROP, r.width) && c.h >= Math.min(MIN_CROP, r.imageH) && c.x + c.w <= r.width && c.y + c.h <= r.imageH;
// Set a file's crop from another's (a copy, the linked crop): narrowed to fit where
// its image is smaller, and marked so.
function takeCrop(f, c, aspect){
  const r = info(f); if (!r) return;
  const got = fitCrop(c, r.width, r.imageH, ASPECTS[aspect]);
  f.crop = got; f.aspect = aspect;
  f.clamped = got.x !== c.x || got.y !== c.y || got.w !== c.w || got.h !== c.h;
  f.cropDef = isDefaultCrop(f);
}
/* A resize from c0 by the pointer's move (dx, dy, image pixels) with handle hd: the
   opposite side or corner stays; with a locked ratio a corner scales both sides by
   the mean of the two moves, a side the other dimension about its middle. */
function resized(c0, hd, dx, dy, W, H, r){
  const L = hd.includes('w'), R = hd.includes('e'), T = hd.includes('n'), B = hd.includes('s');
  let x0 = c0.x, x1 = c0.x + c0.w, y0 = c0.y, y1 = c0.y + c0.h;
  const minW = Math.min(MIN_CROP, W), minH = Math.min(MIN_CROP, H);
  if (!r){
    if (L) x0 = Math.min(Math.max(0, x0 + dx), x1 - minW);
    if (R) x1 = Math.max(Math.min(W, x1 + dx), x0 + minW);
    if (T) y0 = Math.min(Math.max(0, y0 + dy), y1 - minH);
    if (B) y1 = Math.max(Math.min(H, y1 + dy), y0 + minH);
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  }
  let w, h;
  if ((L || R) && (T || B)){
    const sw = (c0.w + (R ? dx : -dx))/c0.w, sh = (c0.h + (B ? dy : -dy))/c0.h, k = (sw + sh)/2;
    w = c0.w*k;
    // room from the corner that stays
    const roomW = R ? W - x0 : x1, roomH = B ? H - y0 : y1;
    w = Math.max(Math.max(minW, minH*r), Math.min(w, roomW, roomH*r)); h = w/r;
    return fitCrop({ x: R ? x0 : x1 - w, y: B ? y0 : y1 - h, w, h }, W, H, r);
  }
  const cx = c0.x + c0.w/2, cy = c0.y + c0.h/2;
  if (L || R){
    w = c0.w + (R ? dx : -dx);
    const room = R ? W - x0 : x1;
    w = Math.max(Math.max(minW, minH*r), Math.min(w, room, H*r)); h = w/r;
    return fitCrop({ x: R ? x0 : x1 - w, y: cy - h/2, w, h }, W, H, r);
  }
  h = c0.h + (B ? dy : -dy);
  const room = B ? H - y0 : y1;
  h = Math.max(Math.max(minH, minW/r), Math.min(h, room, W/r)); w = h*r;
  return fitCrop({ x: cx - w/2, y: B ? y0 : y1 - h, w, h }, W, H, r);
}
// The handles, in image pixels: corners and the middle of each side.
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
function handlePoints(c){
  const xs = { w: c.x, m: c.x + c.w/2, e: c.x + c.w }, ys = { n: c.y, m: c.y + c.h/2, s: c.y + c.h };
  return HANDLES.map(hd=> [xs[hd.includes('w') ? 'w' : hd.includes('e') ? 'e' : 'm'], ys[hd.includes('n') ? 'n' : hd.includes('s') ? 's' : 'm']]);
}
const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move', pan: 'grab' };

/* ---- Intensity: the settings' defaults and fields, the curves into a canvas ---- */
const INT_DEF = { mode: 'percentile', pLo: 0.5, pHi: 99.5, ref: null, b: 0, c: 1, g: 1, def: true };
// Settings at their defaults (the reference aside, which they do not reset).
const isIntDef = I => ['mode', 'pLo', 'pHi', 'b', 'c', 'g'].every(k=> I[k] === INT_DEF[k]);
const isAdjDef = a => !a || ['b', 'c', 'g'].every(k=> a[k] === ADJ_DEF[k]);
const ADJ_DEF = { b: 0, c: 1, g: 1 };
// The fields, with the range each takes; a value outside it is refused (the field
// shakes and shows the last good one).
const INT_FIELDS = { semPLo: ['pLo', 0, 49.9], semPHi: ['pHi', 50.1, 100], semB: ['b', -100, 100], semC: ['c', 0.05, 20], semG: ['g', 0.05, 20] };
const ADJ_FIELDS = { semBi: ['b', -100, 100], semCi: ['c', 0.05, 20], semGi: ['g', 0.05, 20] };
// The level below which a share q of the crop's pixels lie.
function levelAt(st, q){
  const t = q*st.n; let acc = 0;
  for (let v = 0; v < 65535; v++){ acc += st.hist[v]; if (acc > t) return v; }
  return 65534;
}
// A region of 16-bit levels (row length W) through a curve, into a canvas (`into`, the
// editor's, drawn over where it is the size: its memory kept); a large one through a
// table of each level's whole pixel, a row at a time (the same pixels, sooner).
function toCanvas(px, W, x0, y0, w, h, lut, into){
  const cv = into && into.width === w && into.height === h ? into : document.createElement('canvas');
  if (cv !== into){ cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d'), img = cv._img || ctx.createImageData(w, h), d = new Uint32Array(img.data.buffer);
  if (w*h > 65536){
    const t = new Uint32Array(65536);
    for (let v = 0; v < 65536; v++){ const g = lut[v]; t[v] = 0xff000000 | g << 16 | g << 8 | g; }
    for (let y = 0; y < h; y++) levelsRow(px, (y0 + y)*W + x0, t, d, y*w, w);
    cv._img = img;
  } else for (let y = 0; y < h; y++){
    const row = (y0 + y)*W + x0, o = y*w;
    for (let x = 0; x < w; x++){ const g = lut[px[row + x]]; d[o + x] = 0xff000000 | g << 16 | g << 8 | g; }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
function levelsRow(px, row, t, d, o, w){ for (let x = 0; x < w; x++) d[o + x] = t[px[row + x]]; }

/* ---- Groups and scale: the rules ---- */
// Two images within 10 % of pixel size are in one group.
const GROUP_TOL = 1.10;
// The reference is always one of the figure's images (v442: no reference kept out).
const inFigure = f => f.included !== false;
const pixelOf = f => { const r = info(f); return r ? r.pixelNm : NaN; };
// The groups' box is 4φ : 1 at full screen (sizeGroups).
const PHI4 = 4*(1 + Math.sqrt(5))/2;
/* A group's row of images, wider than the box: an arrow at each end where there is
   more, boxed, as tall as the images and outside the row, turns a page — the row
   slides by what it shows, landing on an image's edge (scroll snap). A finger can
   also swipe it. */
function pageArrows(row){
  const strip = row.parentElement, more = row.scrollWidth - row.clientWidth;
  strip.querySelector('.sem-page-prev').hidden = !(more > 1 && row.scrollLeft > 1);
  strip.querySelector('.sem-page-next').hidden = !(more > 1 && row.scrollLeft < more - 1);
}
// A finger holds an image this long (ms) before it drags it.
const HOLD_MS = 300;

/* ---- Files and fields ---- */
// Anything but a reason (sem-read.js SemReadError) said in words: the raw message
// of an allocation that failed said nothing to the user (to v487).
const faultText = r => /RangeError|allocation|memory/i.test(`${r.kind} ${r.fault}`) ? 'too large for the memory this page has' : `not read (${r.fault})`;
const magText = r => !(r.mag > 0) ? '' : r.mag >= 1000 ? `${(r.mag/1000).toPrecision(3)} kx` : `${r.mag.toPrecision(3)} x`;
// The chain on a thumbnail: its crop linked to the other linked images'.
const LINK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';
// A field's number, or null (the field shakes) where it is none or out of lo–hi.
function readField(el, lo, hi){
  const v = parseFloat(String(el.value).trim().replace(',', '.'));
  if (!Number.isFinite(v) || v < lo || v > hi){ flashFieldInvalid(el); return null; }
  return v;
}

/* ---- A state put back: what it is checked against (semRestore) ---- */
const MODES = ['none', 'percentile', 'meansd', 'hist'];
const ID_RE = /^[0-9a-f]{8}-\d+$/;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const inRange = (v, lo, hi, d) => isNum(v) && v >= lo && v <= hi ? v : d;
const isKey = k => typeof k === 'string' && k !== '' && !(k in Object.prototype);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
// Settings: those saved before the Default boxes (v442) are default where their
// values are; a Default ticked over other values is unticked.
function intensityOf(v){
  const o = isObj(v) ? v : {}, I = { ...INT_DEF };
  if (MODES.includes(o.mode)) I.mode = o.mode;
  for (const [k, lo, hi] of Object.values(INT_FIELDS)) I[k] = inRange(o[k], lo, hi, INT_DEF[k]);
  I.ref = typeof o.ref === 'string' ? o.ref : null;
  I.def = typeof o.def === 'boolean' ? o.def && isIntDef(I) : isIntDef(I);
  return I;
}

// A SEM tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createSem({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  // (its listeners on the window, let go with it)
  const ac = new AbortController();
  let dead = false;

  /* ---- State ----
     allFiles: every image in list order, { name (the file's), label (the sample's,
     from the file's Sign), raw (RawRef), crop {x,y,w,h}, aspect, cropDef (the default
     crop, its fields locked), linked, clamped, adj (its own correction), adjDef (none,
     its fields locked), included?, sq? (an image made of square pixels whose crop is
     in them: see semRestore) }. files: the included ones; cur indexes them. */
  let allFiles = [];
  let files = [];
  let cur = 0;
  let imgNext = null;   // (the image a tab woken or reloaded showed, by its id: its restore shows it, showNext)
  // The groups (Groups and scale): [{ id, name, named (typed by the user), mode
  // ('common' | 'own'), members (the images' ids) }].
  let groups = [];
  // Each group's figure settings (sem-figure.js), by the group's id; a group has none
  // until its figure is first opened.
  let figures = {};
  // What it drew of its images (thumbOf, cardOf): id → { key (what from), cv }; its
  // editor's image (off).
  const thumbs = new Map(), cardsCv = new Map();
  /* Hidden, nothing is drawn (utils.js registerModule): `drawable()` says whether to draw,
     and when not marks the instance to be drawn whole as it is shown (stale: its redraw). */
  let stale = false;
  const drawable = ()=> shown() || !(stale = true);

  /* ---- Intensity ----
     Each image's grey levels go through one curve, a table of its 65536 levels:
       1. the normalisation, one for every image of its group: none (the levels as
          acquired), a stretch between two percentiles of the image's own levels, the
          mean and standard deviation of the reference image, or its histogram;
       2. contrast about mid-grey and brightness, then gamma (above 1 brightening the
          mid-tones): the global values, with each image's own correction on top
          (brightness added, contrast and gamma multiplied).
     The statistics are the crop's, its saturated pixels (65535) left out: what is
     shown is what is normalised, and a saturated edge does not set the white. The
     reference's own levels are its levels as acquired, so with "none" it looks as the
     others are made to.
     The settings (normalisation, reference, contrast, brightness, gamma) are those of
     all groups, `intensity`, unless a group has its own (groupInt). */
  let intensity = { ...INT_DEF };
  // A group's own settings, by the group's id, where it has them.
  let groupInt = {};
  const usesRef = (I = intensity) => I.mode === 'meansd' || I.mode === 'hist';
  // The reference: the image chosen, else the first loaded.
  const refFile = (I = intensity) => allFiles.find(f=> f.raw.id === I.ref) || allFiles[0] || null;
  // The settings an image goes through: its group's own, else those of all groups.
  const intOf = f => { const g = groupOf(f); return g && groupInt[g.id] || intensity; };
  // An image that is the reference of settings in use (all groups', or a group's own)
  // that use one (marked ◎ on its thumbnail).
  const isRef = f => [intensity, ...Object.values(groupInt)].some(I=> usesRef(I) && refFile(I) === f);
  // (an image's crop's statistics: statsOf, the module's)
  /* The normalisation of an image: { lo, hi }, the levels taken to black and white
     (linear), or { table }, each level's value on 0–1 (the histogram's). */
  function normOf(f){
    const I = intOf(f), m = I.mode;
    if (m === 'none') return { lo: 0, hi: 65535 };
    const st = statsOf(f);
    if (m === 'percentile'){
      const lo = levelAt(st, I.pLo/100), hi = levelAt(st, I.pHi/100);
      return { lo, hi: hi > lo ? hi : lo + 1 };
    }
    const rf = refFile(I), rs = rf ? statsOf(rf) : st;
    if (m === 'meansd'){
      // v → μ_ref + (v − μ)·σ_ref/σ, on the reference's levels: the levels that land on
      // 0 and 65535 there.
      const k = st.sd > 0 && rs.sd > 0 ? st.sd/rs.sd : 1;
      return { lo: st.mean - rs.mean*k, hi: st.mean + (65535 - rs.mean)*k };
    }
    // The histogram: a level at the share F of the image's crop (its bin's middle) goes
    // to the reference's level at the same share.
    const table = new Float32Array(65536), n = st.n || 1, nr = rs.n || 1;
    let ci = 0, cr = 0, u = 0;
    for (let v = 0; v < 65535; v++){
      const F = (ci + st.hist[v]/2)/n; ci += st.hist[v];
      while (u < 65534 && (cr + rs.hist[u])/nr < F){ cr += rs.hist[u]; u++; }
      table[v] = u/65535;
    }
    table[65535] = 1;
    return { table };
  }
  /* The whole curve of an image, as the 8-bit grey of each of its levels: made once for
     what it is made from (lutKey: its crop's statistics, the reference's, the settings,
     its correction) and kept, the last ones made (to v487 made three or four times an
     image at every edit). The module's (lutCache), for every tab: the key says all it is
     made from. */
  function lutKey(f){
    const I = intOf(f), a = f.adj || ADJ_DEF, c = f.crop, rf = usesRef(I) ? refFile(I) : null;
    return `${f.raw.id}|${I.mode === 'none' ? '' : `${c.x},${c.y},${c.w},${c.h}`}|${I.mode}|${I.mode === 'percentile' ? `${I.pLo},${I.pHi}` : ''}|`
      + `${rf ? `${rf.raw.id}:${rf.crop.x},${rf.crop.y},${rf.crop.w},${rf.crop.h}` : ''}|${I.b},${I.c},${I.g}|${a.b},${a.c},${a.g}`;
  }
  function lutOf(f){
    const key = lutKey(f);
    let lut = lru(lutCache, key);
    if (lut) return lut;
    lut = makeLut(f);
    lutCache.set(key, lut);
    // (room for two curves an image: a render never makes one twice)
    if (lutCache.size > Math.max(48, 2*allFiles.length + 8)) lutCache.delete(lutCache.keys().next().value);
    return lut;
  }
  function makeLut(f){
    const nm = normOf(f), a = f.adj || ADJ_DEF, I = intOf(f);
    const b = (I.b + a.b)/100, k = I.c*a.c, ig = 1/(I.g*a.g);
    const lut = new Uint8ClampedArray(65536), span = nm.table ? 0 : 1/(nm.hi - nm.lo);
    for (let v = 0; v < 65536; v++){
      let y = nm.table ? nm.table[v] : (v - nm.lo)*span;
      y = y < 0 ? 0 : y > 1 ? 1 : y;
      y = (y - 0.5)*k + 0.5 + b;
      y = y < 0 ? 0 : y > 1 ? 1 : y;
      lut[v] = Math.round(Math.pow(y, ig)*255);
    }
    return lut;
  }

  /* ---- The linked crop ---- */
  // Every linked image takes the one just set.
  function propagate(f){
    if (!f.linked) return;
    allFiles.forEach(g=>{ if (g !== f && g.linked) takeCrop(g, f.crop, f.aspect); });
  }

  /* ---- Alerts ----
     What an upload found (files refused, files already loaded, files loaded with a
     warning) and the images a project opened could not read. They belong to the
     instance, its tab's, by its line of history: each snapshot carries the line it was
     taken on (lineOf); a state put back from one (an undo, a redo) is on that line, any
     other (a tab's state as it wakes; a project read in for its CSV or its saved key, in
     an instance of its own: utils.js withState) starts a new one. Within its tab, each is
     about files: those it names (an image loaded with a warning, the image a file dropped
     is a copy of), or, for the refused and the unreadable, which name files never loaded,
     those in the list when it was made (none: while the list is empty). It shows while
     those files are in the list, and goes when they go: an image removed takes its own
     with it, Remove all all of them. An undo leaves them as they are: to v487 every
     restore wiped them, though they are about the upload, not the state. */
  const lineOf = new WeakMap();
  let line = 0, lines = 0;
  // A line's alerts, the last 32 lines': { bad: { names (markup), ids } | null, dup, warn: [{ id, html }] }.
  const alertsOf = new Map(), NO_ALERTS = { bad: null, dup: [], warn: [] };
  const alerts = ()=> alertsOf.get(line) || NO_ALERTS;
  function setAlerts(a){
    const now = { ...alerts(), ...a };
    alertsOf.delete(line);
    if (now.bad || now.dup.length || now.warn.length) alertsOf.set(line, now);
    if (alertsOf.size > 32) alertsOf.delete(alertsOf.keys().next().value);
  }
  root.addEventListener('click', e=>{
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'sem-dismiss-invalid'){ setAlerts({ bad: null }); rebuildAlerts(); }
    else if (btn.dataset.action === 'sem-dismiss-upload'){ setAlerts({ dup: [] }); rebuildAlerts(); }
    else if (btn.dataset.action === 'sem-dismiss-warn'){ setAlerts({ warn: [] }); rebuildAlerts(); }
  });
  function rebuildAlerts(){
    const here = new Set(allFiles.map(f=> f.raw.id)), A = alerts();
    const dup = A.dup.filter(a=> here.has(a.id)), warn = A.warn.filter(a=> here.has(a.id));
    const bad = A.bad && (A.bad.ids.length ? A.bad.ids.some(id=> here.has(id)) : !here.size);
    $('semAlerts').innerHTML = (bad ? buildAlertsHtml(A.bad.names, [], undefined, 'sem-dismiss-invalid') : '')
      + (dup.length ? buildAlertsHtml([], dup.map(a=> a.html), 'Already loaded:', '', 'sem-dismiss-upload') : '')
      + (warn.length ? buildAlertsHtml([], warn.map(a=> a.html), 'Loaded, but check:', '', 'sem-dismiss-warn') : '');
  }
  // An image removed from the list: what was said about it goes.
  function dropAlertsOf(id){
    const A = alerts(), ids = A.bad ? A.bad.ids.filter(x=> x !== id) : [];
    setAlerts({ dup: A.dup.filter(a=> a.id !== id), warn: A.warn.filter(a=> a.id !== id), bad: ids.length ? { ...A.bad, ids } : null });
  }

  /* ---- Loading ----
     Each file is read off the page's thread (readOne, the module's worker: its id, the
     image, its reduced copy, its default crop's statistics, its bytes back), one after
     another, the page answering meanwhile; the files read join the list together, one
     step of the history. To v487 all of it ran on the page's thread: 8 images of 2048²
     froze the page a frame a file, then most of a second (1.4–1.8 s in all here; the
     review measured 13 s to load them); now one frame of some 0.2 s, the list drawn
     (SEM.md §6.3). While files are read the tab is busy (registerBusy, busyChanged): it
     is not let go while hidden (tabs.js), and the reading goes on there, into its own
     list, drawn as it is shown; closing the tab stops it. To v517 a tab switch asked
     first, and stopped it. A reading holds the history from the state on show as it starts
     (UndoStack.hold), let go as it ends or is stopped: undo goes no lower meanwhile,
     silently, and above it undo and redo go as ever, the reading going on (to v508 both
     waited for its end, a banner saying so). Files dropped meanwhile are read after. */
  const owner = {};   // (its readings', in the worker's queue)
  let loading = null, waiting = 0, gen = 0;
  let queue = Promise.resolve();
  registerBusy(key, {
    busy: ()=> loading || waiting ? 'The reading of SEM files' : null,
    // (the files waiting their turn go too: they were dropped into the project closed)
    stop: ()=>{ gen++; if (loading){ loading.stopped = true; stopReads(owner); } },
  });
  // (each drop's promise: every file dropped so far read, so that the drop zone says it
  // is reading until the last one is)
  const drained = q => q.then(()=> q === queue ? null : drained(queue));
  setupDropzone($('semDropzone'), $('semFiles'), list=>{
    const g = gen;
    waiting++;
    busyChanged(key);
    // (its tab's time hidden, for its sleep, counted from the reading's end: tabs.js)
    queue = queue.then(()=>{ waiting--; return g === gen ? loadFiles(list) : null; }).catch(err=> console.error('SEM files not read', err))
      .then(()=>{ if (!dead) busyChanged(key); });
    return drained(queue);
  });
  async function loadFiles(list){
    const job = { ids: new Set(), stopped: false }, bad = [], dup = [], warn = [], add = [], mark = hist.hold();
    loading = job;
    try {
      for (const file of list){
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        // A .hdr beside its .tif says what the TIFF carries already.
        if (ext === 'hdr') continue;
        if (ext !== 'tif' && ext !== 'tiff'){ bad.push(`${esc(file.name)} — not a TIFF`); continue; }
        const res = await readOne(file, job, owner);
        if (job.stopped) return;
        if (res.error != null){ bad.push(`${esc(file.name)} — ${esc(res.error)}`); continue; }
        if (res.fault != null){ bad.push(`${esc(file.name)} — ${esc(faultText(res))}`); continue; }
        const { id, r } = res;
        if (allFiles.some(f=> f.raw.id === id) || job.ids.has(id)){ dup.push({ id, html: esc(file.name) }); continue; }
        job.ids.add(id);
        remember(id, r, res.small, res.card, res.px);
        statsCache.set(statsKey(id, defaultCrop(r)), res.st);
        if (r.warning) warn.push({ id, html: `${esc(file.name)} — ${esc(r.warning)}` });
        const crop = defaultCrop(r);
        // (its bytes those another tab holds already, where one does: rawOf)
        add.push({ name: file.name, label: r.name, raw: rawOf(id, res.bytes), crop, aspect: aspectOf(crop.w, crop.h), cropDef: true, linked: false, clamped: false, adjDef: true, ...(r.squared ? { sq: true } : {}) });
      }
    } finally { if (loading === job) loading = null; hist.release(mark); }
    // The files read join the list as it is now, one step (an undo meanwhile may have put
    // back one of them: already loaded then).
    const here = new Set(allFiles.map(f=> f.raw.id));
    add.forEach(f=>{ if (here.has(f.raw.id)) dup.push({ id: f.raw.id, html: esc(f.name) }); else allFiles.push(f); });
    setAlerts({ bad: bad.length ? { names: bad, ids: allFiles.map(f=> f.raw.id) } : null, dup, warn });
    afterFilesChange();
  }

  /* ---- File list ---- */
  // The list's rows: its download gives a file's bytes (rawBytes).
  const listView = ()=> allFiles.map(f=> ({ name: f.name, label: f.label, included: f.included, get rawBytes(){ return f.raw.bytes; } }));
  function fileCallbacks(){
    return {
      onRemove(i){ const f = allFiles[i]; removeFileAt(allFiles, i, []); if (f) dropAlertsOf(f.raw.id); afterFilesChange(); },
      onReorder(from, to){ moveFileTo(allFiles, from, to, []); afterFilesChange(); },
      onInclude(i, on){ setIncluded(allFiles, i, on, []); afterFilesChange(); },
      onIncludeAll(on){ allFiles.forEach((_, j)=> setIncluded(allFiles, j, on, [])); afterFilesChange(); },
      // Everywhere the label shows: the groups' captions and the Reference menu too (to
      // v474 only the navigator and the thumbnails).
      onLabelChange(i, v){ allFiles[i].label = v; renderNav(); renderThumbs(); renderGroups(); renderIntensity(); hist.commit(); },
      onRemoveAll(){ allFiles.length = 0; setAlerts({ bad: null, dup: [], warn: [] }); afterFilesChange(); },
    };
  }

  function afterFilesChange(){
    filesChanged();
    renderAll();
    hist.commit();
  }
  // The files changed: the included ones, the list, the groups (state), the alerts.
  // (The editor's image is drawn again when its curve differs: the files, and with them
  // the reference, may; loadEditorImage.)
  function filesChanged(){
    files = includedOf(allFiles);
    cur = Math.min(cur, Math.max(0, files.length - 1));
    setTabLoaded(key, allFiles.length);
    // The list's rows map onto allFiles by index; the download needs the RawRef.
    renderUnifiedFileList($('semFileTableWrap'), listView(), fileCallbacks());
    $('semWorkspace').style.display = files.length ? 'block' : 'none';
    $('semGroupsCard').style.display = files.length ? 'block' : 'none';
    syncGroups();
    rebuildAlerts();
    // (what it drew of images gone from its list let go: an undo draws them again)
    const ids = new Set(allFiles.map(f=> f.raw.id));
    for (const m of [thumbs, cardsCv]) for (const id of [...m.keys()]) if (!ids.has(id)) m.delete(id);
    scheduleEvict();
  }

  /* ---- Undo / project state ---- */
  function semSnapshot(){
    const s = { files: allFiles.map(f=> ({ ...f, crop: { ...f.crop }, adj: { ...(f.adj || ADJ_DEF) } })), cur, intensity: { ...intensity },
      groupInt: JSON.parse(JSON.stringify(groupInt)),
      groups: groups.map(g=> ({ ...g, members: g.members.slice() })), figures: JSON.parse(JSON.stringify(figures)) };
    // (its line of history beside it, not in it: neither compared nor saved)
    lineOf.set(s, line);
    return s;
  }
  /* A state put back: an undo's, a project's opened or read in (a tab, its CSV, its
     saved key). What it holds is taken as the module would have made it, whatever the
     project says (a project file edited by hand or damaged): to v487 a crop, an index or a
     setting that was not a number went in as it was, and the views drew NaN.
     - an image: its bytes (an array; the base64 of a project of v517 or before, read
       into one) and an id of the form hashBytes gives for bytes of their length (else
       made from them), once (a second entry of one id is dropped), its bytes those
       another tab holds where one does (rawOf); strings for its name and label; its
       crop whole pixels inside the image, at least MIN_CROP a side, else the default
       one; its ratio one of the locks; its correction within the fields' ranges; its
       Default boxes ticked only where the crop and correction are the defaults;
     - the settings: a normalisation of the four, numbers within the fields' ranges,
       else the defaults;
     - the groups: ids that are names (no key of a plain object's own), once, each image
       in one group, a scale of the two; the index of the image shown at least 0.
     Its line of history (Alerts) is the snapshot's, else a new one.
     It is drawn after the task (queueRender), and the restore itself decodes none of
     its images (info): a state read in and out again (utils.js withState) is not drawn,
     and its saved key decodes nothing; its CSV decodes the images it includes, for their
     statistics (let go after: evict). */
  function semRestore(s){
    line = lineOf.has(s) ? lineOf.get(s) : ++lines;
    if (!isObj(s)) s = {};
    const str = (v, d) => typeof v === 'string' ? v : d;
    // Images whose bytes no longer read are left out of the list, and said so.
    const seen = new Set(), lost = [];
    allFiles = [];
    for (const f0 of Array.isArray(s.files) ? s.files : []){
      if (!isObj(f0)) continue;
      const name = str(f0.name, 'image'), raw0 = f0.raw;
      let bytes = null;
      if (isObj(raw0)){
        if (raw0.bytes instanceof Uint8Array) bytes = raw0.bytes;
        else if (typeof raw0.b64 === 'string'){ try { bytes = fromB64(raw0.b64); } catch(err){ bytes = null; } }
      }
      let id = bytes ? raw0.id : null;
      if (bytes && !(typeof id === 'string' && ID_RE.test(id) && +id.slice(9) === bytes.length)) id = hashBytes(bytes);
      if (id === null){ lost.push(name); continue; }
      if (seen.has(id)) continue;
      const f = { ...f0, name, label: str(f0.label, name), raw: rawOf(id, bytes, raw0) };
      const r = info(f);
      if (!r){ lost.push(name); continue; }
      seen.add(id);
      for (const k of ['linked', 'clamped']) f[k] = f0[k] === true;
      if (f0.included !== false) delete f.included;
      if ('held' in f && !isObj(f.held)) delete f.held;
      // The crop: in the image's pixels; one saved (to v487) on an image whose pixels are
      // made square now was in the pixels as acquired: brought to the square ones.
      const c0 = isObj(f0.crop) ? f0.crop : {};
      let crop = ['x', 'y', 'w', 'h'].every(k=> isNum(c0[k])) ? { x: c0.x, y: c0.y, w: c0.w, h: c0.h } : defaultCrop(r);
      if (r.squared && f0.sq !== true){
        const q = r.squared, kx = r.width/q.width, ky = r.imageH/q.imageH;
        crop = f0.cropDef === true ? defaultCrop(r) : { x: crop.x*kx, y: crop.y*ky, w: crop.w*kx, h: crop.h*ky };
        f.aspect = null;
      }
      if (r.squared) f.sq = true; else delete f.sq;
      f.crop = validCrop(crop, r) ? crop : fitCrop(crop, r.width, r.imageH, null);
      if (!Object.keys(ASPECTS).includes(f.aspect)) f.aspect = aspectOf(f.crop.w, f.crop.h);
      const a0 = isObj(f0.adj) ? f0.adj : {};
      f.adj = { b: inRange(a0.b, -100, 100, 0), c: inRange(a0.c, 0.05, 20, 1), g: inRange(a0.g, 0.05, 20, 1) };
      f.cropDef = typeof f0.cropDef === 'boolean' ? f0.cropDef && isDefaultCrop(f) : isDefaultCrop(f);
      f.adjDef = typeof f0.adjDef === 'boolean' ? f0.adjDef && isAdjDef(f.adj) : isAdjDef(f.adj);
      allFiles.push(f);
    }
    intensity = intensityOf(s.intensity);
    groupInt = {};
    if (isObj(s.groupInt)) for (const [k, v] of Object.entries(s.groupInt)) if (isKey(k)) groupInt[k] = intensityOf(v);
    groups = [];
    const gids = new Set(), placed = new Set();
    for (const g0 of Array.isArray(s.groups) ? s.groups : []){
      if (!isObj(g0) || !isKey(g0.id) || gids.has(g0.id)) continue;
      gids.add(g0.id);
      const members = (Array.isArray(g0.members) ? g0.members : []).filter(m=> typeof m === 'string' && !placed.has(m) && !!placed.add(m));
      const g = { ...g0, name: str(g0.name, ''), named: g0.named === true, mode: g0.mode === 'own' ? 'own' : 'common', members };
      // Only an empty group is kept by hand: a state saved to v476 also kept, for good,
      // one filled since (made with + Group, or emptied by dragging, then filled).
      if (g0.keep === true && !members.length) g.keep = true; else delete g.keep;
      groups.push(g);
    }
    figures = {};
    if (isObj(s.figures)) for (const [k, v] of Object.entries(JSON.parse(JSON.stringify(s.figures)))) if (isKey(k) && isObj(v)) figures[k] = v;
    // A project saved before v440 had one figure for all the groups: each group starts
    // from it, its file named after the group.
    if (!s.figures && isObj(s.figure)) for (const g of groups){ const f = JSON.parse(JSON.stringify(s.figure)); delete f.file; figures[g.id] = f; }
    // (on this state's line: one read in and out again keeps its own, never shown)
    if (lost.length) setAlerts({ bad: { names: lost.map(n=> `${esc(n)} — its stored bytes no longer read as a Tescan TIFF`), ids: allFiles.map(f=> f.raw.id) } });
    cur = Number.isInteger(s.cur) && s.cur > 0 ? s.cur : 0;
    filesChanged();
    // (a wake's or a reload's: the image its tab showed, by its id, over the record's state,
    // which a step writes no sooner than the next change: showNext)
    if (imgNext != null){ const k = files.findIndex(f=> f.raw.id === imgNext); if (k >= 0) cur = k; imgNext = null; }
    queueRender();
  }
  /* Drawn once the task that restored is over (a microtask, before the page is painted):
     a state read into an instance of its own and out again in one go (utils.js withState:
     a saved project's CSV, the saved key of a tab) is never drawn, that instance let go
     first (dead); to v487 it was, every image of the project read in decoded for it. */
  let renderQueued = false;
  function queueRender(){
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(()=>{
      renderQueued = false;
      // (one let go meanwhile: a state read out of it, withState)
      if (dead) return;
      rebuildAlerts();
      renderAll();
      // An undo with the figure open: it shows the settings now in force.
      if (figApi && figApi.open) figApi.refresh();
    });
  }
  const hist = registerHistory(key, semSnapshot, semRestore);
  // Shown (goTab, at each show; a resize): what changed while it was hidden drawn now
  // (stale: all of it), else fitted to the page again, the editor's image made again
  // where it was let go (hide).
  registerTabRedraw(key, ()=>{
    if (!files.length || dead) return;
    if (stale){ renderAll(); return; }
    fitWork(); sizeGroups(); loadEditorImage(); fitView(); drawEditor(); drawHist();
  });

  /* ---- Rendering ---- */
  function renderAll(){
    if (!files.length) return;
    if (!drawable()) return;
    stale = false;
    renderNav(); renderInfo(); renderFields(); fitWork(); renderThumbs();
    loadEditorImage(); fitView(); drawEditor();
    renderIntensity(); renderGroups();
  }
  // Something that changes the curves (a crop, the normalisation, a correction): every
  // view of the images drawn again, each image's only where what it is drawn from has
  // changed (thumbOf, cardOf, loadEditorImage).
  function refreshLevels(){
    if (!drawable()) return;
    loadEditorImage(); drawEditor();
    renderThumbs(); renderIntensity(); renderGroups(); renderFields();
  }
  function renderNav(){
    const f = files[cur];
    $('semIdx').textContent = files.length ? `${cur + 1}/${files.length}` : '0/0';
    $('semCurName').textContent = f ? f.label : '—';
  }
  function renderInfo(){
    const f = files[cur], r = f && info(f);
    const box = $('semInfo');
    if (!r){ box.innerHTML = ''; return; }
    const q = r.squared;
    // Pixels made square (sem-read.js squarePixels): the image as it is now, and as acquired.
    const rows = [
      ['Image', `${r.width} × ${r.imageH} px${q ? `, ${q.width} × ${q.imageH} px as acquired` : ''}${r.strip ? ` (info bar of ${r.strip} rows left out)` : ''}`],
      ['Pixel size', `${sig(r.pixelNm, 4)} nm${q ? `, square: resampled from ${sig(q.pixelNmX, 4)} × ${sig(q.pixelNmY, 4)} nm pixels` : ''}`],
      ['Field of view', `${sig(r.fovUm, 4)} µm`],
      ['Magnification', magText(r) || '—'],
      ['Beam', `${sig(r.kV, 3)} kV · WD ${sig(r.wdMm, 3)} mm`],
      ['Detector', `${esc(r.detector || '—')} · gain ${sig(r.gain, 4)}, offset ${sig(r.offset, 4)}`],
      ['Acquired', esc(`${r.date} ${r.time}`.trim() || '—') + (r.device ? ` · ${esc(r.device)}` : '')],
    ];
    // The crop, and what the figure takes of it in its group (narrowed, at its pixel).
    const c = f.crop, um = v => sig(v*r.pixelNm/1000, 4), o = outOf(f);
    rows.push(['Crop', `${esc(c.w)} × ${esc(c.h)} px, ${um(c.w)} × ${um(c.h)} µm${f.clamped ? ' ⚠ narrowed to fit' : ''}`]);
    if (o) rows.push(['In the figure', `${esc(o.w)} × ${esc(o.h)} px at ${sig(o.px, 4)} nm${o.c.w !== c.w || o.c.h !== c.h ? `, ${um(o.c.w)} × ${um(o.c.h)} µm of the crop` : ''}`]);
    box.innerHTML = rows.map(([k, v])=> `<div class="sem-info-row"><span class="txt-meta">${k}</span><span>${v}</span></div>`).join('')
      + (r.warning ? `<div class="alert warn" style="margin-top:8px">⚠ ${esc(r.warning)}</div>` : '');
  }
  // The crop's fields, locked while it is the default.
  function renderFields(){
    const f = files[cur], e = f && info(f);
    if (!e) return;
    const c = f.crop;
    ['x', 'y', 'w', 'h'].forEach(k=>{ const el = $('semCrop' + k.toUpperCase()); if (document.activeElement !== el) el.value = String(c[k]); el.disabled = !!f.cropDef; });
    const asp = $('semAspect');
    asp.value = f.aspect; asp.disabled = !!f.cropDef;
    $('semCropDef').checked = !!f.cropDef;
    renderInfo();
  }
  // Every included image with its crop drawn on it; a press shows it in the editor, its
  // chain links its crop to the other linked images'.
  // An image's thumbnail: its reduced copy through its curve, its crop drawn on it.
  // Drawn again only when its curve or its crop has changed (to v487 every one of them
  // at every edit); the same canvas otherwise, put in the new row.
  function thumbOf(f){
    const c = f.crop, key = `${lutKey(f)}|${c.x},${c.y},${c.w},${c.h}`, t = thumbs.get(f.raw.id);
    if (t && t.key === key) return t.cv;
    const sm = smallOf(f);
    if (!sm) return null;
    const k = 1/sm.k, cv = toCanvas(sm.px, sm.w, 0, 0, sm.w, sm.h, lutOf(f));
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(c.x*k, c.y*k, c.w*k, c.h*k); ctx.fill('evenodd');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(c.x*k + 0.5, c.y*k + 0.5, Math.max(1, c.w*k - 1), Math.max(1, c.h*k - 1));
    thumbs.set(f.raw.id, { key, cv });
    return cv;
  }
  function renderThumbs(){
    if (!drawable()) return;
    const box = $('semThumbs');
    box.innerHTML = '';
    files.forEach((f, i)=>{
      const cv = info(f) && thumbOf(f); if (!cv) return;
      const wrap = document.createElement('div');
      wrap.className = 'sem-thumb-wrap';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sem-thumb' + (i === cur ? ' is-on' : ''); b.title = f.label;
      b.dataset.i = i;
      b.appendChild(cv);
      const cap = document.createElement('span');
      const r = isRef(f);
      cap.className = 'sem-thumb-cap'; cap.textContent = (r ? '◎ ' : '') + f.label + (f.clamped ? ' ⚠' : '');
      if (r) b.title = f.label + ' — the reference';
      if (f.clamped) b.title += ' — its crop was narrowed to fit it';
      // Out of the images the selector chose: dimmed (a click on it chooses its group).
      const sc = scopeOf();
      if (sc !== 'all' && (!groupOf(f) || groupOf(f).id !== sc)) wrap.classList.add('is-out');
      b.appendChild(cap);
      const ln = document.createElement('button');
      ln.type = 'button'; ln.className = 'sem-link' + (f.linked ? ' is-on' : ''); ln.dataset.link = i; ln.innerHTML = LINK_SVG;
      ln.setAttribute('aria-pressed', String(!!f.linked));
      ln.title = f.linked ? 'Linked: its crop is shared with the other linked images. Click to unlink it' : 'Link its crop to the other linked images';
      wrap.append(b, ln);
      box.appendChild(wrap);
    });
  }
  $('semThumbs').addEventListener('click', e=>{
    const ln = e.target.closest('.sem-link');
    if (ln){ setLinked(files[+ln.dataset.link], !files[+ln.dataset.link].linked); return; }
    const b = e.target.closest('.sem-thumb'); if (!b) return;
    go(+b.dataset.i);
  });
  function go(i){
    if (!files.length) return;
    cur = (i + files.length) % files.length;
    renderAll();
  }
  $('semPrev').addEventListener('click', ()=> go(cur - 1));
  $('semNext').addEventListener('click', ()=> go(cur + 1));

  /* ---- The crop editor ----
     The image drawn into a canvas with the view (scale s in CSS px a pixel, and the
     image's top-left at ox, oy); the crop over it, the rest darkened, with eight
     handles. Dragging a handle or a side resizes, inside moves, outside pans; the
     wheel zooms about the pointer, a double click outside the crop fits the image. */
  const view = { s: 1, ox: 0, oy: 0 };
  // The current image at full size through its curve, made again when the image or its
  // curve (lutKey: its crop's statistics among what it is made from) has changed since,
  // or as its tab is shown again (let go as it was hidden: hide; 17 MB for an image of
  // 2048², made again in some 30 ms). Its pixels (toCanvas, as much again) are kept for
  // the next curve while the image is edited, let go 2 s after the last (a curve then 9
  // ms, not 22).
  let off = null, offKey = null, imgTimer = 0;
  function loadEditorImage(){
    if (!drawable()) return;
    const f = files[cur], r = f && info(f), px = r && pixelsOf(f);
    if (!px) return;
    const key = lutKey(f);
    if (off && offKey === key) return;
    off = toCanvas(px, r.width, 0, 0, r.width, r.imageH, lutOf(f), off);
    offKey = key;
    clearTimeout(imgTimer); imgTimer = setTimeout(()=>{ if (off) off._img = null; }, 2000);
  }
  // (Pointer positions are taken on the canvas, which fills the pane inside its border:
  // the view's origin.)
  const canvas = $('semCropCanvas'), host = canvas.parentElement;
  // The pane's size: as wide as its column, as tall as the image at that width, at
  // most 70 % of the window's height.
  function paneSize(){
    const f = files[cur], r = f && info(f);
    const w = Math.max(1, host.clientWidth), ar = r ? r.imageH/r.width : 1;
    return [w, Math.max(160, Math.min(Math.round(w*ar), Math.round(window.innerHeight*0.7)))];
  }
  /* The editor's zoom, of the image it was set on: { id, k (its scale against the image
     fitted), cx, cy (the image's point at the pane's centre) }; none, the image fitted. Kept
     as the pane changes size, at a show, a resize or an undo (to v517 each of these fitted
     the image again), and as the tab sleeps or the page is reloaded (inst.shows, tabs.js);
     another image is shown fitted, and Fit (or a double click with a tool on) fits it. */
  let ed = null;
  function fitView(){
    const f = files[cur], r = f && info(f);
    if (!r) return;
    const [w, h] = paneSize();
    host.style.height = h + 'px';
    const fit = Math.min(w/r.width, h/r.imageH);
    if (ed && ed.id !== f.raw.id) ed = null;
    if (!ed){ Object.assign(view, { s: fit, ox: (w - fit*r.width)/2, oy: (h - fit*r.imageH)/2 }); return; }
    const s = Math.min(32, Math.max(fit*0.5, ed.k*fit));
    Object.assign(view, { s, ox: w/2 - ed.cx*s, oy: h/2 - ed.cy*s });
  }
  // The view moved by hand (a pan, a zoom): kept, against the image fitted.
  function keepView(){
    const f = files[cur], r = f && info(f);
    if (!r) return;
    const [w, h] = paneSize(), fit = Math.min(w/r.width, h/r.imageH);
    ed = { id: f.raw.id, k: view.s/fit, cx: (w/2 - view.ox)/view.s, cy: (h/2 - view.oy)/view.s };
  }
  const refit = ()=>{ ed = null; fitView(); drawEditor(); };
  function drawEditor(){
    const f = files[cur], r = f && info(f);
    if (!r || !off) return;
    const dpr = window.devicePixelRatio || 1, w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)){ canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Smoothed when shrunk, pixels kept sharp when enlarged.
    ctx.imageSmoothingEnabled = view.s < 2;
    const W = r.width, H = r.imageH, c = f.crop, X = x => view.ox + x*view.s, Y = y => view.oy + y*view.s;
    ctx.drawImage(off, X(0), Y(0), W*view.s, H*view.s);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.rect(X(0), Y(0), W*view.s, H*view.s); ctx.rect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s); ctx.fill('evenodd');
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.strokeRect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s);
    // Narrowed by its group to the common field: what the figure takes, dashed.
    const o = outOf(f);
    if (o && (o.c.w !== c.w || o.c.h !== c.h)){
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff';
      ctx.strokeRect(X(o.c.x), Y(o.c.y), o.c.w*view.s, o.c.h*view.s); ctx.setLineDash([]);
    }
    for (const [hx, hy] of handlePoints(c)){
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
      ctx.fillRect(X(hx) - 4.5, Y(hy) - 4.5, 9, 9); ctx.strokeRect(X(hx) - 4.5, Y(hy) - 4.5, 9, 9);
    }
    // The area being drawn with Zoom area (the plots' colours).
    if (zoomBox){
      const zx = Math.min(zoomBox.x0, zoomBox.x1), zy = Math.min(zoomBox.y0, zoomBox.y1), zw = Math.abs(zoomBox.x1 - zoomBox.x0), zh = Math.abs(zoomBox.y1 - zoomBox.y0);
      ctx.fillStyle = 'rgba(100,160,255,0.12)'; ctx.fillRect(zx, zy, zw, zh);
      ctx.strokeStyle = 'rgba(100,160,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(zx + 0.5, zy + 0.5, zw, zh);
    }
  }
  function hitTest(px, py, touch){
    const f = files[cur], c = f.crop, rad = touch ? 18 : 9;
    const pts = handlePoints(c);
    for (let k = 0; k < 8; k++){
      const sx = view.ox + pts[k][0]*view.s, sy = view.oy + pts[k][1]*view.s;
      if (Math.abs(px - sx) <= rad && Math.abs(py - sy) <= rad) return HANDLES[k];
    }
    // Then the sides anywhere along them, not only at their middle handle.
    const X0 = view.ox + c.x*view.s, X1 = X0 + c.w*view.s, Y0 = view.oy + c.y*view.s, Y1 = Y0 + c.h*view.s;
    const alongX = px > X0 && px < X1, alongY = py > Y0 && py < Y1;
    if (alongY && Math.abs(px - X0) <= rad) return 'w';
    if (alongY && Math.abs(px - X1) <= rad) return 'e';
    if (alongX && Math.abs(py - Y0) <= rad) return 'n';
    if (alongX && Math.abs(py - Y1) <= rad) return 's';
    return px >= X0 && px <= X1 && py >= Y0 && py <= Y1 ? 'move' : 'pan';
  }
  /* The toolbar on the image, as on the plots: Fit, Pan and Zoom area. With no tool on,
     the image stays fitted and still, the wheel scrolls the page, and a drag works the
     crop; Pan drags the view, Zoom area zooms into the rectangle drawn. With a tool on,
     the wheel zooms about the pointer and a double click fits the image again. */
  let tool = null, drag = null, zoomBox = null;
  function setTool(t){
    tool = t;
    $('semToolPan').classList.toggle('is-on', t === 'pan');
    $('semToolZoom').classList.toggle('is-on', t === 'zoom');
    host.closest('.plot-wrap').classList.toggle('tool-armed', !!t);
    host.style.cursor = t === 'pan' ? 'move' : t === 'zoom' ? 'crosshair' : '';
  }
  $('semToolPan').addEventListener('click', ()=> setTool(tool === 'pan' ? null : 'pan'));
  $('semToolZoom').addEventListener('click', ()=> setTool(tool === 'zoom' ? null : 'zoom'));
  $('semToolFit').addEventListener('click', refit);
  host.addEventListener('pointerdown', e=>{
    if (e.button !== 0 || !files.length) return;
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    const mode = tool || hitTest(px, py, e.pointerType === 'touch'), f = files[cur];
    // Outside the crop with no tool on, nothing: the view does not move unless asked.
    if (mode === 'pan' && !tool) return;
    drag = { mode, px, py, c0: { ...f.crop }, clamped: f.clamped, def: f.cropDef, ox: view.ox, oy: view.oy, moved: false };
    host.setPointerCapture(e.pointerId);
    if (mode === 'pan') host.style.cursor = 'grabbing';
    else if (mode !== 'zoom') host.style.cursor = CURSOR[mode];
    e.preventDefault();
  });
  host.addEventListener('pointermove', e=>{
    const b = canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
    if (!drag){
      if (files.length && !tool){ const m = hitTest(px, py, e.pointerType === 'touch'); host.style.cursor = m === 'pan' ? '' : CURSOR[m]; }
      return;
    }
    const f = files[cur], r = info(f), W = r.width, H = r.imageH;
    const dx = (px - drag.px)/view.s, dy = (py - drag.py)/view.s;
    drag.moved = drag.moved || Math.abs(px - drag.px) + Math.abs(py - drag.py) > 2;
    if (drag.mode === 'pan'){ view.ox = drag.ox + px - drag.px; view.oy = drag.oy + py - drag.py; }
    else if (drag.mode === 'zoom') zoomBox = { x0: drag.px, y0: drag.py, x1: px, y1: py };
    // The crop follows once the pointer has moved more than 2 px, so that a click's
    // jitter leaves it (to v476 it followed at once, and a drag that stayed within the
    // 2 px changed it uncommitted). Back where it started, it is the crop it was, with
    // its flags.
    else if (drag.moved){
      const c = !dx && !dy ? drag.c0 : drag.mode === 'move' ? fitCrop({ ...drag.c0, x: drag.c0.x + dx, y: drag.c0.y + dy }, W, H, null)
        : resized(drag.c0, drag.mode, dx, dy, W, H, ASPECTS[f.aspect]);
      const same = sameCrop(c, drag.c0);
      f.crop = { ...c };
      // The frame moved by hand: no longer the default (its box unticks).
      f.clamped = same && drag.clamped; f.cropDef = same && drag.def; renderFields();
    }
    drawEditor();
  });
  const endDrag = ()=>{
    if (!drag) return;
    const d = drag; drag = null;
    host.style.cursor = tool === 'pan' ? 'move' : tool === 'zoom' ? 'crosshair' : '';
    if (d.mode === 'zoom'){
      const z = zoomBox; zoomBox = null;
      // The rectangle drawn fills the pane (one too small to mean one is ignored).
      if (z && Math.abs(z.x1 - z.x0) > 5 && Math.abs(z.y1 - z.y0) > 5){
        const w = Math.abs(z.x1 - z.x0), h = Math.abs(z.y1 - z.y0), x = Math.min(z.x0, z.x1), y = Math.min(z.y0, z.y1);
        const k = Math.min(host.clientWidth/w, host.clientHeight/h), s2 = Math.min(32, view.s*k);
        const ix = (x + w/2 - view.ox)/view.s, iy = (y + h/2 - view.oy)/view.s;
        view.s = s2; view.ox = host.clientWidth/2 - ix*s2; view.oy = host.clientHeight/2 - iy*s2;
        keepView();
      }
      drawEditor();
    // A crop the drag changed is committed (the linked images, statistics and
    // thumbnails with it), whatever the pointer's move; one it left as it was, nothing.
    } else if (d.mode === 'pan'){ if (d.moved) keepView(); }
    else if (!sameCrop(files[cur].crop, d.c0)) cropChanged();
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('wheel', e=>{
    if (!files.length || !tool) return;
    e.preventDefault();
    const b = canvas.getBoundingClientRect();
    zoomAt(e.clientX - b.left, e.clientY - b.top, Math.exp(-e.deltaY*0.004));
  }, { passive: false });
  host.addEventListener('dblclick', ()=>{ if (tool) refit(); });
  function zoomAt(px, py, k){
    const f = files[cur], r = info(f);
    const fit = Math.min(host.clientWidth/r.width, host.clientHeight/r.imageH);
    const s2 = Math.min(32, Math.max(fit*0.5, view.s*k));
    view.ox = px - (px - view.ox)*s2/view.s; view.oy = py - (py - view.oy)*s2/view.s; view.s = s2;
    keepView();
    drawEditor();
  }

  // A crop set (dragged, typed, reset, re-ratioed): the linked images follow, and it
  // is one step of the history.
  function cropChanged(){
    const f = files[cur];
    propagate(f);
    renderFields(); refreshLevels();
    hist.commit();
  }

  /* ---- Fields ---- */
  ['X', 'Y', 'W', 'H'].forEach(K=>{
    const el = $('semCrop' + K);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const f = files[cur]; if (!f) return;
      const r = info(f), v = Math.round(parseFloat(String(el.value).replace(',', '.')));
      if (!Number.isFinite(v)){ flashFieldInvalid(el); renderFields(); return; }
      const k = K.toLowerCase(), c = { ...f.crop, [k]: v }, ar = ASPECTS[f.aspect];
      // Locked: a typed side sets the other from the ratio.
      if (ar && k === 'w') c.h = v/ar;
      if (ar && k === 'h') c.w = v*ar;
      // A size that would run past the image's edge moves the crop back inside it.
      f.crop = fitCrop(c, r.width, r.imageH, ar);
      f.clamped = false; f.cropDef = false;
      if (f.crop[k] !== v) flashFieldInvalid(el);
      cropChanged();
    });
  });
  // A new ratio keeps the crop's width and middle where it can, else its height.
  $('semAspect').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    const r = info(f), ar = ASPECTS[e.target.value], c = f.crop;
    f.aspect = e.target.value;
    if (ar){
      let w = c.w, h = w/ar;
      if (h > r.imageH){ h = r.imageH; w = h*ar; }
      if (w > r.width){ w = r.width; h = w/ar; }
      f.crop = fitCrop({ x: c.x + c.w/2 - w/2, y: c.y + c.h/2 - h/2, w, h }, r.width, r.imageH, ar);
    }
    f.clamped = false; f.cropDef = false;
    cropChanged();
  });
  // Default: the whole image less its bar, its fields locked; unticked, the fields open
  // on it.
  $('semCropDef').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    f.cropDef = e.target.checked;
    if (f.cropDef){ const r = info(f); f.crop = defaultCrop(r); f.aspect = aspectOf(f.crop.w, f.crop.h); f.clamped = false; }
    cropChanged();
  });
  // Linking an image: it takes the crop the linked ones share, if any; else it is the
  // first, and the others will take its. Unlinked, it keeps the crop it has.
  function setLinked(f, on){
    if (!f) return;
    f.linked = on;
    if (f.linked){
      const lead = allFiles.find(g=> g !== f && g.linked);
      if (lead) takeCrop(f, lead.crop, lead.aspect);
    } else f.clamped = false;
    renderFields(); refreshLevels();
    hist.commit();
  }
  // Link all: the images the selector chose, around the crop of the one in the editor
  // (it leads); all of them linked already, it unlinks them.
  const scopeFiles = ()=>{ const sc = scopeOf(); return files.filter(f=> sc === 'all' || (groupOf(f) && groupOf(f).id === sc)); };
  $('semLinkAll').addEventListener('click', ()=>{
    const f = files[cur], fs = scopeFiles(); if (!f || !fs.length) return;
    if (fs.every(g=> g.linked)) fs.forEach(g=>{ g.linked = false; g.clamped = false; });
    else {
      // Others linked outside the chosen images follow the lead too: one linked crop.
      allFiles.forEach(g=>{ if (g.linked && !fs.includes(g)) g.linked = false; });
      f.linked = true;
      fs.forEach(g=>{ if (g !== f){ g.linked = true; takeCrop(g, f.crop, f.aspect); } });
    }
    renderFields(); refreshLevels();
    hist.commit();
  });
  function renderLinkAll(){
    const fs = scopeFiles(), b = $('semLinkAll');
    b.textContent = fs.length && fs.every(g=> g.linked) ? 'Unlink all' : 'Link all';
  }

  /* ---- Groups and scale ----
     The images in the figure (included, and not a reference kept out of it) are
     grouped by pixel size, two within 10 % in one group, each named by its
     magnification; a group's images share one scale bar. A group at common scale
     brings its images to its largest pixel size (the others reduced by averaging over
     the pixels each new one covers, never enlarged: nothing is invented) and to its
     smallest field of view, each crop narrowed about its middle; at its own scale an
     image keeps its pixels and its crop. Groups can be renamed, an image moved to
     another or to a new one, and empty groups added (kept, as one emptied by hand, until
     removed); Reset starts again. */
  const byId = id => allFiles.find(f=> f.raw.id === id);
  const groupOf = f => groups.find(g=> g.members.includes(f.raw.id)) || null;
  // A group's images in the figure: they alone decide its name, its scale, its place
  // and where a new image goes. An excluded image stays a member, so that it comes back
  // where it was when included again, but decides nothing while the group has images in
  // the figure (to v476 it still named the group, ordered it, and kept out of it a new
  // image the others had room for).
  const inGroup = g => g.members.map(byId).filter(f=> f && inFigure(f) && info(f));
  // A group's name: the magnification of its image in the figure with the largest
  // pixel size, the one its common scale brings the others to (a group whose images are
  // all excluded, not shown, by theirs).
  function groupName(ids){
    const fs = ids.map(id=> byId(id)).filter(f=> f && info(f)), inc = fs.filter(inFigure);
    const r = (inc.length ? inc : fs).map(info).sort((a, b)=> b.pixelNm - a.pixelNm)[0];
    return r ? magText(r) || `${sig(r.pixelNm, 3)} nm/px` : 'group';
  }
  const newGroupId = ()=>{ let k = 1; while (groups.some(g=> g.id === 'g' + k)) k++; return 'g' + k; };
  // An image into the group whose pixel sizes (its images' in the figure) it stays
  // within 10 % of, else one whose images are all excluded, by theirs, so that images
  // near in scale stay together when those come back, else a new one (never into an
  // empty group: it has no pixel size to be near).
  function placeImage(f){
    const p = pixelOf(f), fits = m =>{ const ps = m.map(pixelOf).concat(p); return Math.max(...ps)/Math.min(...ps) <= GROUP_TOL; };
    const g = groups.find(g=>{ const m = inGroup(g); return m.length && fits(m); })
      || groups.find(g=>{ const m = g.members.map(byId).filter(m=> m && info(m)); return !inGroup(g).length && m.length && fits(m); });
    if (g) g.members.push(f.raw.id);
    else groups.push({ id: newGroupId(), name: '', named: false, mode: 'common', members: [f.raw.id] });
  }
  // The groups kept in step with the images: gone ones dropped, new ones placed, groups
  // left empty removed unless made with + Group (and not filled since) or emptied by
  // dragging, unnamed ones named after their images.
  function syncGroups(){
    const ids = new Set(allFiles.map(f=> f.raw.id));
    groups.forEach(g=>{ g.members = g.members.filter(id=> ids.has(id)); });
    const placed = new Set(groups.flatMap(g=> g.members));
    // The included first: an excluded image never decides where they go.
    [...allFiles.filter(inFigure), ...allFiles.filter(f=> !inFigure(f))].forEach(f=>{ if (!placed.has(f.raw.id) && info(f)) placeImage(f); });
    // With no image left in the list (Remove all, or the last one removed) the groups
    // made or emptied by hand go too: unseen while there is none, they came back empty
    // with the next files (to v476).
    groups = groups.filter(g=> g.members.length || g.keep && ids.size);
    tidyGroups();
    // Lowest magnification first (by the images in the figure, else, for a group of
    // excluded ones, by theirs); empty groups last, in the order they were made.
    const px = g =>{ const m = inGroup(g); return m.length ? pixelOf(m[0]) : g.members.length ? pixelOf(byId(g.members[0])) : -1; };
    groups.sort((a, b)=> px(b) - px(a));
  }
  // Names, and what goes with a group that is gone (its figure, its intensity).
  function tidyGroups(){
    groups.forEach(g=>{ if (!g.named && g.members.length) g.name = groupName(g.members); });
    for (const o of [figures, groupInt]) for (const k of Object.keys(o)) if (!groups.some(g=> g.id === k)) delete o[k];
  }
  /* What the figure takes from an image (null when it is not in the figure):
     { c (the crop, narrowed to the group's field), px (nm a pixel), w, h (its size in
     the figure's pixels) }. */
  function outOf(f){
    if (!inFigure(f)) return null;
    const g = groupOf(f), r = info(f);
    if (!g || !r) return null;
    if (g.mode === 'own') return { c: { ...f.crop }, px: r.pixelNm, w: f.crop.w, h: f.crop.h };
    const mem = g.members.map(byId).filter(m=> m && inFigure(m) && info(m));
    const pT = Math.max(...mem.map(pixelOf));
    const fovW = Math.min(...mem.map(m=> m.crop.w*pixelOf(m))), fovH = Math.min(...mem.map(m=> m.crop.h*pixelOf(m)));
    const p = r.pixelNm, w = Math.min(f.crop.w, Math.round(fovW/p)), h = Math.min(f.crop.h, Math.round(fovH/p));
    const c = { x: f.crop.x + Math.floor((f.crop.w - w)/2), y: f.crop.y + Math.floor((f.crop.h - h)/2), w, h };
    return { c, px: pT, w: Math.max(1, Math.round(fovW/pT)), h: Math.max(1, Math.round(fovH/pT)) };
  }
  // (resample: sem-read.js, shared with the worker, which makes each image's card for
  // its default crop as it reads it)
  // An image as the figure will take it, through its curve, at the figure's pixels or
  // brought down to `fit` px across.
  function outCanvas(f, fit){
    const o = outOf(f), px = o && pixelsOf(f);
    if (!px) return null;
    const k = fit ? Math.min(1, fit/Math.max(o.w, o.h)) : 1, w = Math.max(1, Math.round(o.w*k)), h = Math.max(1, Math.round(o.h*k));
    return toCanvas(resample(px, info(f).width, o.c, w, h), w, 0, 0, w, h, lutOf(f));
  }
  /* Its card in a group: as the figure takes it, brought down to 200 px across, from
     the whole crop as before (sem-read.js cardLevels). Its levels are made only for a
     part of the original or a size not among the last CARDS it took (a file read comes
     with those of its default crop, made by the worker), and put through its curve again
     only when that changes too: to v487 both at every edit, for every image. The levels
     are the module's (imgs), the canvas the instance's. */
  function cardOf(f){
    const o = outOf(f), e = o && imgOf(f);
    if (!e) return null;
    const pk = cardKey(o.c, o.w, o.h).pk;
    let L = e.cards.get(pk);
    if (L) e.cards.delete(pk);   // (the last used, last)
    else {
      const d = decoded(f); if (!d) return null;
      L = cardLevels(d, o.c, o.w, o.h); kept.made['sem-card'] = (kept.made['sem-card'] || 0) + 1;
      if (e.cards.size >= CARDS) e.cards.delete(e.cards.keys().next().value);
    }
    e.cards.set(pk, L);
    const key = `${L.pk}|${lutKey(f)}`, C = cardsCv.get(f.raw.id);
    if (C && C.key === key) return C.cv;
    const cv = toCanvas(L.px, L.w, 0, 0, L.w, L.h, lutOf(f));
    cardsCv.set(f.raw.id, { key, cv });
    return cv;
  }
  /* A group's box: its name (plain text, a field on hover and while edited, as the
     project's name), its scale and its figure on one side; its images in one row on
     the other, scrolling sideways when they do not fit, each with its name under it.
     An empty group says where its images go, its figure disabled. A group whose images
     are all out of the figure (unticked, or the reference only) is not shown. */
  function fitGroupName(el){
    // Its room: the head's width less the scale and the figure's button beside it.
    const acts = el.parentElement.querySelector('.sem-group-acts'), cs = getComputedStyle(el);
    const fig = el.parentElement.querySelector('.sem-group-fig'), wraps = getComputedStyle(el.parentElement).flexWrap === 'wrap';
    const room = el.parentElement.clientWidth - (wraps ? fig.offsetWidth : acts.offsetWidth) - 16;
    if (!room) return;
    nameCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    el.style.width = Math.min(nameCtx.measureText(el.value || el.placeholder).width + 24, room + 10) + 'px';
  }
  function renderGroups(){
    if (!drawable()) return;
    const box = $('semGroups');
    if (!box || !files.length) return;
    box.innerHTML = groups.map(g=>{
      const mem = g.members.map(byId).filter(m=> m && inFigure(m));
      if (!mem.length && g.members.length) return '';
      const empty = !mem.length;
      return `<div class="sem-group${empty ? ' is-empty' : ''}" data-g="${esc(g.id)}" data-drop="${esc(g.id)}">
        <div class="sem-group-head">
          <input type="text" class="sem-group-name" data-g="${esc(g.id)}" value="${esc(g.name)}" placeholder="Group name" spellcheck="false" aria-label="Group name" title="The group's name, on its figure and its file. Emptied, it goes back to the magnification">
          <div class="sem-group-acts">
            <div class="sem-scale" role="radiogroup" aria-label="Scale">${[['common', 'common scale', 'One scale for the group: its images brought to its largest pixel size and smallest field, one scale bar'], ['own', 'own scale', 'Each image its own pixels and crop, and its own scale bar']].map(([v, t, tip])=>
              `<label class="sem-radio" title="${tip}"><input type="radio" class="sem-group-mode" name="semScale-${esc(g.id)}" data-g="${esc(g.id)}" value="${v}"${g.mode === v ? ' checked' : ''}> ${t}</label>`).join('')}</div>
            <button class="btn primary btn-sm sem-group-fig" type="button" data-fig="${esc(g.id)}"${empty ? ' disabled title="No images in this group yet"' : ' title="Lay this group\'s images out into a figure"'}>Figure composer</button>
          </div>
        </div>
        <div class="sem-strip">
          <button class="sem-page sem-page-prev" type="button" data-page="-1" aria-label="Previous images" hidden>&#8249;</button>
          <div class="sem-group-imgs">${empty
            ? `<div class="sem-group-hint txt-meta">Empty: drag images here. <button class="btn btn-sm" type="button" data-del="${esc(g.id)}" title="Remove this empty group">Remove</button></div>`
            : mem.map(m=> `<div class="sem-gimg" data-id="${esc(m.raw.id)}" title="${esc(m.label)}"><div class="sem-gimg-pic"></div><span class="sem-thumb-cap">${esc(m.label)}</span></div>`).join('')}</div>
          <button class="sem-page sem-page-next" type="button" data-page="1" aria-label="Next images" hidden>&#8250;</button>
        </div>
      </div>`;
    }).join('');
    sizeGroups();
    box.querySelectorAll('.sem-gimg').forEach(el=>{ const f = byId(el.dataset.id), cv = f && cardOf(f); if (cv) el.querySelector('.sem-gimg-pic').appendChild(cv); });
    box.querySelectorAll('.sem-group-name').forEach(fitGroupName);
    box.querySelectorAll('.sem-group-imgs').forEach(row=>{ row.addEventListener('scroll', ()=> pageArrows(row), { passive: true }); pageArrows(row); });
  }
  /* The groups' height: a box 4φ : 1 at full screen, kept whatever the window. Full
     screen is the screen's width, at most the page's 1500 px, less what lies around a
     group now (the page's and the card's margins). The images take what the height
     leaves under the head and over their names, never under 80 px (on a phone, where
     4φ : 1 would leave next to nothing, the box grows instead). */
  // The full-screen width, worked out once, at the first layout: resizing the window
  // must not change the height.
  let groupFull = null;
  function sizeGroups(){
    const box = $('semGroups'), g = box.querySelector('.sem-group');
    if (!g || !box.clientWidth) return;
    const main = document.querySelector('main'), mcs = getComputedStyle(main);
    const pad = parseFloat(mcs.paddingLeft) + parseFloat(mcs.paddingRight);
    const around = main.clientWidth - pad - g.offsetWidth;
    const scr = screen.availWidth || window.innerWidth;
    if (!groupFull) groupFull = { scr, w: Math.min(Math.max(scr, window.innerWidth), parseFloat(mcs.maxWidth) || Infinity) - pad - around };
    const full = groupFull.w;
    const gcs = getComputedStyle(g), head = g.querySelector('.sem-group-head').offsetHeight;
    const cap = 4 + 16;   // the gap and the name under an image
    const chrome = parseFloat(gcs.paddingTop) + parseFloat(gcs.paddingBottom) + parseFloat(gcs.borderTopWidth) + parseFloat(gcs.borderBottomWidth) + head + parseFloat(gcs.rowGap || 8) + cap;
    const H = Math.round(full/PHI4), img = Math.max(80, Math.floor(H - chrome));
    box.style.setProperty('--sem-img', img + 'px');
    box.style.setProperty('--sem-group-h', Math.max(H, Math.ceil(chrome + img)) + 'px');
  }
  window.addEventListener('resize', ()=>{ if (!shown()) return; sizeGroups(); root.querySelectorAll('#semGroups .sem-group-imgs').forEach(pageArrows); fitWork(); }, { signal: ac.signal });
  /* Crop and intensity in three columns, until a field's name would be cut short ("…"):
     then one column, the image on top, the thumbnails, the settings under them. Tried
     in three columns at every resize (synchronously, so nothing is painted between). */
  function fitWork(){
    const work = root.querySelector('.sem-work');
    if (!work || !work.offsetWidth) return;
    const was = work.classList.contains('sem-stacked');
    work.classList.remove('sem-stacked');
    const cut = [...work.querySelectorAll('.sem-fr .txt-label')].some(l=> l.scrollWidth > l.clientWidth + 0.5);
    work.classList.toggle('sem-stacked', cut);
    // The editor and the histogram are sized to their column: redrawn when it changes.
    if (cut !== was && files.length){ fitView(); drawEditor(); drawHist(); }
  }
  const groupsBox = $('semGroups'), groupsCard = $('semGroupsCard');
  groupsBox.addEventListener('input', e=>{ if (e.target.classList.contains('sem-group-name')) fitGroupName(e.target); });
  groupsBox.addEventListener('change', e=>{
    const t = e.target;
    if (t.classList.contains('sem-group-name')){
      const g = groups.find(g=> g.id === t.dataset.g); if (!g) return;
      const v = t.value.trim();
      // Emptied, a name goes back to the images' magnification.
      g.named = !!v; g.name = v || (g.members.length ? groupName(g.members) : 'New group');
    } else if (t.classList.contains('sem-group-mode')){
      const g = groups.find(g=> g.id === t.dataset.g); if (!g) return;
      g.mode = t.value;
    } else return;
    groupsChanged();
  });
  function groupsChanged(){
    renderGroups(); renderFields(); renderIntensity(); drawEditor();
    hist.commit();
  }
  // An image into another group, or into a new one ('new'). A group it leaves empty
  // stays, with its name and figure, until removed; one it goes into holds images now,
  // and goes when they are removed from the file list (to v476 a group made with
  // + Group, or emptied by dragging, stayed for good).
  function moveImage(id, to){
    const from = groups.find(g=> g.members.includes(id));
    if (!from || from.id === to) return;
    // Alone in its group's figure (an excluded image beside it decides nothing), it
    // would only make the same group again.
    if (to === 'new' && inGroup(from).length === 1) return;
    const into = to === 'new' ? { id: newGroupId(), name: '', named: false, mode: 'common', members: [] } : groups.find(g=> g.id === to);
    if (!into) return;
    from.members = from.members.filter(m=> m !== id);
    if (!from.members.length) from.keep = true;
    delete into.keep;
    into.members.push(id);
    if (to === 'new') groups.push(into);
    tidyGroups();
    groupsChanged();
  }
  // + Group: an empty group, to drag images into.
  $('semAddGroup').addEventListener('click', ()=>{
    groups.push({ id: newGroupId(), name: 'New group', named: false, mode: 'common', members: [], keep: true });
    groupsChanged();
  });
  /* Dragging an image between groups (pointer events: a mouse and a finger alike): a
     copy of it follows the pointer, the group under it lights (or + Group, for a new
     one), and the drop moves it there. A press without a move does nothing. A finger
     first holds the image still a moment: a swipe over the images scrolls the page. */
  let gdrag = null;
  const dropTargets = ()=> groupsCard.querySelectorAll('[data-drop]');
  groupsBox.addEventListener('pointerdown', e=>{
    const card = e.target.closest('.sem-gimg');
    if (!card || e.button !== 0) return;
    const touch = e.pointerType === 'touch';
    gdrag = { id: card.dataset.id, card, x0: e.clientX, y0: e.clientY, ghost: null, over: null, held: !touch, timer: 0 };
    if (touch) gdrag.timer = setTimeout(()=>{ if (gdrag && gdrag.card === card){ gdrag.held = true; card.classList.add('is-held'); } }, HOLD_MS);
    else { card.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  groupsBox.addEventListener('pointermove', e=>{
    if (!gdrag) return;
    const moved = Math.abs(e.clientX - gdrag.x0) + Math.abs(e.clientY - gdrag.y0);
    // A finger that moves before the hold is a scroll: no drag.
    if (!gdrag.held){ if (moved > 8) endGroupDrag(); return; }
    if (!gdrag.ghost){
      if (moved < 5) return;
      const pic = gdrag.card.querySelector('canvas'), g = document.createElement('canvas');
      g.width = pic.width; g.height = pic.height; g.getContext('2d').drawImage(pic, 0, 0);
      g.className = 'sem-drag-ghost'; layer.appendChild(g);
      gdrag.ghost = g; gdrag.card.classList.add('is-dragged');
    }
    gdrag.ghost.style.left = e.clientX + 'px'; gdrag.ghost.style.top = e.clientY + 'px';
    const under = document.elementFromPoint(e.clientX, e.clientY), t = under && under.closest('[data-drop]');
    const to = t && groupsCard.contains(t) ? t.dataset.drop : null;
    if (to !== gdrag.over){ dropTargets().forEach(el=> el.classList.toggle('is-drop', el.dataset.drop === to)); gdrag.over = to; }
  });
  // Held, the finger drags the image, not the page.
  groupsBox.addEventListener('touchmove', e=>{ if (gdrag && gdrag.held && e.cancelable) e.preventDefault(); }, { passive: false });
  groupsBox.addEventListener('contextmenu', e=>{ if (gdrag) e.preventDefault(); });
  const endGroupDrag = ()=>{
    if (!gdrag) return;
    const d = gdrag; gdrag = null;
    clearTimeout(d.timer);
    if (d.ghost) d.ghost.remove();
    d.card.classList.remove('is-dragged', 'is-held');
    dropTargets().forEach(el=> el.classList.remove('is-drop'));
    if (d.ghost && d.over) moveImage(d.id, d.over);
  };
  groupsBox.addEventListener('pointerup', endGroupDrag);
  groupsBox.addEventListener('pointercancel', endGroupDrag);
  groupsBox.addEventListener('click', e=>{
    const pg = e.target.closest('[data-page]');
    if (pg){ const row = pg.parentElement.querySelector('.sem-group-imgs'); row.scrollBy({ left: +pg.dataset.page*row.clientWidth, behavior: 'smooth' }); return; }
    const b = e.target.closest('[data-fig]'); if (b){ openFigure(b.dataset.fig); return; }
    const d = e.target.closest('[data-del]');
    if (d){ groups = groups.filter(g=> g.id !== d.dataset.del || g.members.length); tidyGroups(); groupsChanged(); }
  });
  groupsBox.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.classList.contains('sem-group-name')) e.target.blur(); });
  // Reset: the groups made again from the pixel sizes. A group made again with the same
  // images keeps its figure and its intensity.
  $('semRegroup').addEventListener('click', ()=>{
    const key = g => g.members.slice().sort().join('|');
    const oldFig = new Map(groups.map(g=> [key(g), figures[g.id]])), oldInt = new Map(groups.map(g=> [key(g), groupInt[g.id]]));
    groups = [];
    const keptFig = {}, keptInt = {};
    syncGroups();
    groups.forEach(g=>{ const f = oldFig.get(key(g)), i = oldInt.get(key(g)); if (f) keptFig[g.id] = f; if (i) keptInt[g.id] = i; });
    figures = keptFig; groupInt = keptInt;
    groupsChanged();
  });

  /* ---- The figure (sem-figure.js, loaded when first opened) ----
     It gets the images in the figure, in the file list's order, each as the figure
     takes it: its group, its size in the figure's pixels, and a key that changes
     whenever its pixels would (its narrowed crop, the curve and what the curve is
     computed from), so that it is drawn again only then. */
  let figApi = null;
  // A group's images in its figure, in the file list's order.
  function figureImages(gid){
    return files.filter(f=> inFigure(f) && groupOf(f) && groupOf(f).id === gid).map(f=>{
      const o = outOf(f), g = groupOf(f), I = intOf(f), rf = refFile(I), refKey = usesRef(I) && rf ? `${rf.raw.id}:${JSON.stringify(rf.crop)}` : '';
      if (!o || !g) return null;
      return { id: f.raw.id, label: f.label, group: { id: g.id, name: g.name, mode: g.mode }, w: o.w, h: o.h, pxNm: o.px,
        key: JSON.stringify([o, I, f.adj || ADJ_DEF, refKey]), canvas: fit => outCanvas(f, fit) };
    }).filter(Boolean);
  }
  /* One composer at a time: a click while the figure is loading is ignored, and none
     opens over a composer already open (figure.js refuses it too; the open one keeps
     its refresh). A double click before sem-figure.js had loaded opened two, the first
     left with no way to close (to v480). */
  let figOpening = false;
  async function openFigure(gid){
    const g = groups.find(g=> g.id === gid);
    if (!g || figOpening || document.querySelector('.fig-backdrop')) return;
    figOpening = true;
    try {
      const mod = await import('./sem-figure.js');
      const api = mod.openSemFigure({ title: g.name, images: ()=> figureImages(gid), getFig: ()=> figures[gid] || null,
        setFig: f=>{ figures[gid] = f; hist.commit(); }, alive: ()=> groups.some(x=> x.id === gid) });
      if (api) figApi = api;
    } catch(err){ console.error('SEM figure failed to open', err); }
    finally { figOpening = false; }
  }

  /* ---- Intensity (the Crop and intensity card) ---- */
  /* The images the settings apply to (the selector over the thumbnails): All, every
     image alike (`intensity`); or the groups, each its own (groupInt), the one shown
     being the group of the image in the editor. Going from All to the groups, every
     group starts from All's settings; going back, All takes the settings of the group on
     show. Nothing jumps either way. */
  const scopeOf = ()=>{
    if (!Object.keys(groupInt).length) return 'all';
    const g = files[cur] && groupOf(files[cur]);
    return g ? g.id : 'all';
  };
  // The settings the fields edit (a group made since the switch starts from All's).
  function edited(){
    const sc = scopeOf();
    if (sc === 'all') return intensity;
    return groupInt[sc] || (groupInt[sc] = { ...intensity });
  }
  $('semIntScope').addEventListener('change', e=>{
    const to = e.target.value, sc = scopeOf();
    if (to === 'all'){
      if (sc !== 'all'){ intensity = { ...edited() }; groupInt = {}; }
    } else {
      if (sc === 'all') groups.forEach(g=>{ groupInt[g.id] = { ...intensity }; });
      // Shown: the group's image nearest in the list, the one in the editor if it is in it.
      const g = groups.find(g=> g.id === to), i = files.findIndex(f=> g && groupOf(f) === g);
      if (i >= 0 && groupOf(files[cur]) !== g) cur = i;
    }
    renderAll(); refreshLevels(); hist.commit();
  });
  function renderIntensity(){
    const f = files[cur];
    if (!f) return;
    const sc = scopeOf(), scope = $('semIntScope');
    // The groups shown, those with images in the figure (to v476 also one whose images
    // were all excluded: hidden, and its choice went back at once).
    scope.innerHTML = `<option value="all">All</option>` + groups.filter(g=> inGroup(g).length).map(g=> `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
    scope.value = sc;
    renderLinkAll();
    const I = edited(), a = f.adj || ADJ_DEF, setv = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = String(+(+v).toPrecision(6)); };
    $('semNorm').value = I.mode;
    for (const [id, [k]] of Object.entries(INT_FIELDS)) setv(id, I[k]);
    for (const [id, [k]] of Object.entries(ADJ_FIELDS)) setv(id, a[k]);
    const rf = refFile(I);
    $('semRef').innerHTML = allFiles.map(g=> `<option value="${esc(g.raw.id)}">${esc(g.label)}</option>`).join('');
    if (rf) $('semRef').value = rf.raw.id;
    $('semIntDef').checked = !!I.def;
    $('semAdjDef').checked = f.adjDef !== false;
    // Disabled, not hidden: everything while Default is ticked, and what the
    // normalisation does not use.
    $('semNorm').disabled = $('semB').disabled = $('semC').disabled = $('semG').disabled = !!I.def;
    $('semPLo').disabled = $('semPHi').disabled = !!I.def || I.mode !== 'percentile';
    $('semRef').disabled = !!I.def || !usesRef(I);
    for (const id of Object.keys(ADJ_FIELDS)) $(id).disabled = f.adjDef !== false;
    drawHist();
  }
  // The crop's histogram (256 bins, heights as the square root of the counts), the
  // curve over it (level → grey), and where a linear normalisation puts black and white.
  function drawHist(){
    const f = files[cur], cv = $('semHist'), box = cv.parentElement;
    if (!(f && info(f)) || !box.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight;
    cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement), muted = css.getPropertyValue('--muted').trim() || '#888', accent = css.getPropertyValue('--accent').trim() || '#fb5';
    const st = statsOf(f), bins = new Float64Array(256);
    for (let v = 0; v < 65535; v++) bins[v >> 8] += st.hist[v];
    const top = Math.sqrt(Math.max(1, ...bins));
    ctx.globalAlpha = 0.45; ctx.fillStyle = muted;
    for (let i = 0; i < 256; i++){ const bh = Math.sqrt(bins[i])/top*(h - 6); ctx.fillRect(i*w/256, h - bh, Math.max(1, w/256 - 0.3), bh); }
    ctx.globalAlpha = 1;
    const nm = normOf(f), lut = lutOf(f);
    if (!nm.table){
      ctx.setLineDash([3, 3]); ctx.strokeStyle = muted; ctx.lineWidth = 1;
      for (const L of [nm.lo, nm.hi]) if (L >= 0 && L <= 65535){ const x = L/65535*w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = 0; x <= w; x++){ const y = h - 3 - lut[Math.min(65535, Math.round(x/w*65535))]/255*(h - 6); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  for (const [id, [k, lo, hi]] of Object.entries(INT_FIELDS)){
    const el = $(id);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const v = readField(el, lo, hi), E = edited();
      if (v == null || !files.length || !E){ renderIntensity(); return; }
      E[k] = v; refreshLevels(); hist.commit();
    });
  }
  for (const [id, [k, lo, hi]] of Object.entries(ADJ_FIELDS)){
    const el = $(id);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const f = files[cur], v = readField(el, lo, hi);
      if (v == null || !f){ renderIntensity(); return; }
      f.adj = { ...(f.adj || ADJ_DEF), [k]: v }; refreshLevels(); hist.commit();
    });
  }
  $('semNorm').addEventListener('change', e=>{ const E = edited(); E.mode = e.target.value; refreshLevels(); hist.commit(); });
  $('semRef').addEventListener('change', e=>{ const E = edited(); E.ref = e.target.value; refreshLevels(); hist.commit(); });
  // Default: the settings at their defaults (the reference kept), their fields locked;
  // unticked, the fields open on them.
  $('semIntDef').addEventListener('change', e=>{
    const E = edited();
    if (e.target.checked) Object.assign(E, { ...INT_DEF, ref: E.ref });
    E.def = e.target.checked;
    refreshLevels(); hist.commit();
  });
  $('semAdjDef').addEventListener('change', e=>{
    const f = files[cur]; if (!f) return;
    if (e.target.checked) f.adj = { ...ADJ_DEF };
    f.adjDef = e.target.checked;
    refreshLevels(); hist.commit();
  });

  /* ---- CSV: each image's metadata and crop ---- */
  registerCsvExport(key, ()=>{
    if (!files.length) return [];
    let t = csvLine(['file', 'sample', 'magnification', 'pixel_size_nm', 'field_of_view_um', 'HV_kV', 'WD_mm', 'detector', 'detector_gain', 'detector_offset', 'date', 'time',
      'image_width_px', 'image_height_px', 'info_bar_rows', 'crop_x_px', 'crop_y_px', 'crop_width_px', 'crop_height_px', 'crop_width_um', 'crop_height_um',
      'crop_mean_level', 'crop_sd_level', 'crop_saturated_pct', 'intensity_settings', 'normalisation', 'reference', 'black_level', 'white_level', 'brightness_pct', 'contrast', 'gamma',
      'group', 'scale', 'figure_x_px', 'figure_y_px', 'figure_width_px', 'figure_height_px', 'figure_pixel_nm', 'figure_out_width_px', 'figure_out_height_px']);
    files.forEach(f=>{
      const r = info(f); if (!r) return;
      const c = f.crop, um = v => fmtNum(v*r.pixelNm/1000, 6);
      // The curve as applied: the levels a linear normalisation takes to black and white
      // (none for the histogram's), and brightness, contrast and gamma with the image's
      // correction in them.
      const st = statsOf(f), nm = normOf(f), a = f.adj || ADJ_DEF, I = intOf(f), rf = refFile(I), g = groupOf(f);
      t += csvLine([f.name, f.label, fmtNum(r.mag, 6), fmtNum(r.pixelNm, 6), fmtNum(r.fovUm, 6), fmtNum(r.kV, 4), fmtNum(r.wdMm, 4), r.detector, fmtNum(r.gain, 5), fmtNum(r.offset, 5), r.date, r.time,
        r.width, r.imageH, r.strip, c.x, c.y, c.w, c.h, um(c.w), um(c.h),
        fmtNum(st.mean, 1), fmtNum(st.sd, 1), fmtNum(100*(c.w*c.h - st.n)/(c.w*c.h), 3), g && groupInt[g.id] ? 'group' : 'all groups', I.mode, usesRef(I) && rf ? rf.label : '',
        nm.table ? '' : fmtNum(nm.lo, 1), nm.table ? '' : fmtNum(nm.hi, 1), fmtNum(I.b + a.b, 3), fmtNum(I.c*a.c, 4), fmtNum(I.g*a.g, 4),
        // In its group: the part of the original the figure takes, and its size there
        // (empty for a reference kept out of the figure).
        ...(()=>{ const o = outOf(f), g = groupOf(f); return o ? [g.name, g.mode, o.c.x, o.c.y, o.c.w, o.c.h, fmtNum(o.px, 6), o.w, o.h] : ['', '', '', '', '', '', '', '', '']; })()]);
    });
    return [{ name: 'sem_images.csv', text: t }];
  });

  /* ---- The instance (tabs.js) ---- */
  // Not on show (a section shown: the module's hook, above): the editor's image at full
  // size let go, and a drag under way dropped.
  function hide(){
    off = null; offKey = null; drag = null; zoomBox = null;
    if (gdrag){ clearTimeout(gdrag.timer); if (gdrag.ghost) gdrag.ghost.remove(); gdrag = null; }
  }
  const me = { shown, hide, ids: ()=> allFiles.map(f=> f.raw.id), reading: ()=> loading ? loading.ids : [] };
  insts.add(me);
  return {
    /* Let go (its tab closed or put to sleep; a state read out of it): its reading
       stopped (its answers dropped, the worker kept for the other tabs'), its listeners on
       the window, the figure composer where it is this tab's; what the module keeps of its
       files stays while they are held (another tab, a history; a tab asleep till its bytes
       are let go) and some while after (gone). */
    destroy(){
      dead = true; gen++; clearTimeout(imgTimer);
      if (loading) loading.stopped = true;
      stopReads(owner);
      ac.abort();
      hide();
      if (figApi && figApi.open){ try { figApi.close(); } catch(e){} }
      insts.delete(me);
      scheduleEvict();
    },
    /* What it shows beside its state (tabs.js, utils.js shownOf): the image on show,
       by its id, and the editor's zoom, given back as the tab wakes or the page is reloaded,
       to the restore. The image on show is in its state too (cur, v517: an undo goes back to
       its step's, a project saved reopens on it), but a step is no change, and its record held
       the one before till the next (to v517 a reload showed it). */
    shows(){
      const f = files[cur];
      return f || ed ? { ...(f ? { img: f.raw.id } : {}), ...(ed ? { ed: { ...ed } } : {}) } : null;
    },
    showNext(v){
      const e = v && v.ed;
      ed = e && typeof e.id === 'string' && [e.k, e.cx, e.cy].every(Number.isFinite) && e.k > 0 ? { id: e.id, k: e.k, cx: e.cx, cy: e.cy } : null;
      imgNext = v && typeof v.img === 'string' ? v.img : null;
    },
  };
}
registerModule('sem', createSem, { dropBytes: true, asleep: asleepHolds });
