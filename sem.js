import { esc, csvLine, fmtNum, setupDropzone, renderUnifiedFileList, includedOf, setIncluded, removeFileAt, moveFileTo, fileAlertHtml, notesHtml, NOT_READ, bytesOf, setTabLoaded, registerHistory, registerTabRedraw, registerCsvExport, registerBusy, busyChanged, registerModule, onSectionChange, flashFieldInvalid, numRule, confirmBanner, kept, getModuleHistory } from './utils.js';
import { readTescanTiff, readFile, SemReadError, reducedCopy, cropStats, resample, cardKey, cardLevels } from './sem-read.js';
import { snavHtml, snav } from './snav.js';
import { isObj } from './modkit.js';
import * as M from './sem-model.js';
import * as H from './sem-html.js';
import { markSeen } from './alerts.js';

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
   decoding; a project of then is read as it is (sem-model.js restoreInto). Records,
   projects saved and project files hold a RawRef as v517 held its own, { id, b64 } (db.js
   isRaw), so that v517 reads them; db.js reads it back as { id, bytes }.

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
   SPLIT (v558): what the module works out (the crop's rules, the curves, the groups, the
   state saved and read back, the CSV) in sem-model.js, plain functions tested in Node; its
   words and markup in sem-html.js; here the page: what the files are made into, kept by
   file for every instance (below), the reading worker, the canvases, and the instance's
   state (S, THE INSTANCE) with its fields, editor, thumbnails, groups and history, each a
   function at module level of S, not a closure inside createSem.
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
  if (v) asleepIds.set(key, M.idsIn(v)); else { asleepIds.delete(key); adopt(key); }
  if (was) for (const id of was) if (!alive(id) && !heldAsleep(id)) madeGone(id);
}
const gone = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(id =>{
  if (alive(id)) return;   // (made again since)
  raws.delete(id); full.delete(id);
  if (!heldAsleep(id)) madeGone(id);
}) : null;
function rawOf(id, bytes, r0){
  const w = raws.get(id), had = w && w.deref();
  if (had && (had === r0 || M.sameBytes(had.bytes, bytes))) return had;
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
    let r;
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
/* An image's whole curve (sem-model.js makeLut), in the instance S: made once for what it is
   made from (sem-model.js lutKey: its crop's statistics, the reference's, the settings, its
   correction) and kept, the last ones made (to v487 made three or four times an image at
   every edit). The module's, for every tab: the key says all it is made from. */
function lutOf(S, f){
  const key = M.lutKey(S, f);
  let lut = lru(lutCache, key);
  if (lut) return lut;
  lut = M.makeLut(U, S, f);
  lutCache.set(key, lut);
  // (room for two curves an image: a render never makes one twice)
  if (lutCache.size > Math.max(48, 2*S.allFiles.length + 8)) lutCache.delete(lutCache.keys().next().value);
  return lut;
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
/* A file read: { id, r (its header), px (its levels where a copy), small, st, card, bytes },
   or { error } why not: its bytes that cannot be read (gone from the disk: utils.js
   NOT_READ) among them (to v566 the drop ended there, with no word). */
async function readOne(file, job, owner){
  const b0 = await bytesOf(file);
  if (!b0) return { error: NOT_READ };
  // (the worker taken once the bytes are in: one that would not run has said so by then)
  const buf = b0.buffer, w = workerOf();
  if (w){
    const s = ++reader.seq;
    clearTimeout(reader.idle);
    const res = await new Promise(ok=>{ pending.set(s, { ok, owner }); w.postMessage({ seq: s, buf, name: file.name }, [buf]); });
    if (!res.retry || job.stopped) return res.buf ? { ...res, bytes: new Uint8Array(res.buf) } : res;
  }
  await new Promise(ok=> setTimeout(ok, 0));
  if (job.stopped) return { retry: true };
  const b1 = await bytesOf(file);
  if (!b1) return { error: NOT_READ };
  try { const out = readFile(b1, file.name); return { ...out, r: { ...out.r, pixels: null }, px: out.r.view ? null : out.r.pixels }; }
  catch(err){ return err instanceof SemReadError ? { error: err.message } : { fault: String(err && err.message || err), kind: err && err.name }; }
}

const nameCtx = document.createElement('canvas').getContext('2d');

/* ---- The curves into a canvas ---- */
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

/* ---- Groups: the row of images ---- */
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

/* ---- Fields ---- */
// A field's number, or null (the field shakes, its range said under it: v571) where it is
// none or out of lo–hi.
function readField(el, lo, hi){
  const v = parseFloat(String(el.value).trim().replace(',', '.'));
  if (!Number.isFinite(v) || v < lo || v > hi){ flashFieldInvalid(el, numRule({ min: lo, max: hi })); return null; }
  return v;
}

/* =========================================================
   THE INSTANCE
   A SEM tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }) is its
   state S, which every function below takes:
     key, root, layer     its tab's key, its section, its layer (the drag's ghost); $(id): an
                          element of root by id; shown(): whether on show; ac: its listeners
                          on the window, let go with it; dead: let go (destroy)
     allFiles, files, cur every image in list order, { name (the file's), label (the
                          sample's, from the file's Sign), raw (RawRef), crop {x,y,w,h},
                          aspect, cropDef (the default crop, its fields locked), linked,
                          clamped, adj (its own correction), adjDef (none, its fields
                          locked), included?, sq? (an image made of square pixels whose crop
                          is in them: see sem-model.js restoreInto) }; the included ones;
                          the index of the one in the editor among them
     imgNext              the image a tab woken or reloaded showed, by its id: its restore
                          shows it (showNext)
     groups, figures      the groups (Groups and scale: sem-model.js), [{ id, name, named
                          (typed by the user), mode ('common' | 'own'), members (the images'
                          ids) }]; each group's figure settings (sem-figure.js), by the
                          group's id, none until its figure is first opened
     intensity, groupInt  the settings of all groups, and a group's own where it has them
                          (sem-model.js Intensity)
     thumbs, cardsCv      what it drew of its images (thumbOf, cardOf): id → { key (what
                          from), cv }; its editor's image: off
     stale                hidden, nothing is drawn (utils.js registerModule): drawable(S)
                          says whether to draw, and when not marks the instance to be drawn
                          whole as it is shown (stale: its redraw)
     line, lines, lineOf, alertsOf   its line of history and the lines' alerts (Alerts)
     owner, loading, waiting, gen, queue   its reading (Loading)
     hist, nav            its history (utils.js registerHistory), its image selector (snav.js)
     view, off, offKey, imgTimer, canvas, host, ed, tool, drag, zoomBox   the crop editor
     groupFull, groupsBox, groupsCard, gdrag   the groups' box, its height, a drag in it
     figApi, figOpening   the figure composer (sem-figure.js)
   Each is a function at module level of S, not a closure inside createSem: what a listener
   holds is what it is handed.
========================================================= */
// The page's helpers the model takes (sem-model.js U), and what the markup takes
// (sem-html.js u).
const U = { isObj, fmtNum, csvLine, info, statsOf, rawOf };
const HU = { esc, fileAlertHtml, notesHtml };
const drawable = S => S.shown() || !(S.stale = true);

function createSem({ key, root, layer, shown }){
  const S = {
    key, root, layer, shown, $: id => root.querySelector('#' + id), ac: new AbortController(), dead: false,
    allFiles: [], files: [], cur: 0, imgNext: null, groups: [], figures: {}, thumbs: new Map(), cardsCv: new Map(), stale: false,
    intensity: { ...M.INT_DEF }, groupInt: {}, lineOf: new WeakMap(), line: 0, lines: 0, alertsOf: new Map(),
    owner: {}, loading: null, waiting: 0, gen: 0, queue: Promise.resolve(), renderQueued: false, hist: null, nav: null,
    view: { s: 1, ox: 0, oy: 0 }, off: null, offKey: null, imgTimer: 0, canvas: null, host: null, ed: null, tool: null, drag: null, zoomBox: null,
    groupFull: null, groupsBox: null, groupsCard: null, gdrag: null, figApi: null, figOpening: false, me: null,
  };
  // The image selector (snav.js), its markup first: the module finds its arrows by their ids.
  S.$('semNav').innerHTML = snavHtml({ prev: 'semPrev', idx: 'semIdx', next: 'semNext', name: 'semCurName', what: 'image' });
  root.addEventListener('click', e=> alertClicked(S, e));
  wireLoading(S);
  S.hist = registerHistory(key, ()=> snapshot(S), s=> restore(S, s));
  registerTabRedraw(key, ()=> redrawTab(S));
  wireThumbs(S);
  wireEditor(S);
  wireCrop(S);
  window.addEventListener('resize', ()=> windowResized(S), { signal: S.ac.signal });
  wireGroups(S);
  wireIntensity(S);
  registerCsvExport(key, ()=> M.csvOf(U, S));
  S.me = { shown, hide: ()=> hide(S), ids: ()=> S.allFiles.map(f=> f.raw.id), reading: ()=> S.loading ? S.loading.ids : [] };
  insts.add(S.me);
  return {
    /* Let go (its tab closed or put to sleep; a state read out of it): its reading
       stopped (its answers dropped, the worker kept for the other tabs'), its listeners on
       the window, the figure composer where it is this tab's; what the module keeps of its
       files stays while they are held (another tab, a history; a tab asleep till its bytes
       are let go) and some while after (gone). */
    destroy(){ destroy(S); },
    /* What it shows beside its state (tabs.js, utils.js shownOf): the image on show,
       by its id, and the editor's zoom, given back as the tab wakes or the page is reloaded,
       to the restore. The image on show is in its state too (cur, v517: an undo goes back to
       its step's, a project saved reopens on it), but a step is no change, and its record held
       the one before till the next (to v517 a reload showed it). */
    shows(){ return M.showsOf(S); },
    showNext(v){ const n = M.nextOf(v); S.ed = n.ed; S.imgNext = n.img; },
  };
}

/* ---- The instance (tabs.js) ---- */
// Not on show (a section shown: the module's hook, above): the editor's image at full
// size let go, and a drag under way dropped.
function hide(S){
  S.off = null; S.offKey = null; S.drag = null; S.zoomBox = null;
  if (S.gdrag){ clearTimeout(S.gdrag.timer); if (S.gdrag.ghost) S.gdrag.ghost.remove(); S.gdrag = null; }
}
function destroy(S){
  S.dead = true; S.gen++; clearTimeout(S.imgTimer);
  if (S.loading) S.loading.stopped = true;
  stopReads(S.owner);
  S.ac.abort();
  hide(S);
  if (S.figApi && S.figApi.open){ try { S.figApi.close(); } catch(e){} }
  insts.delete(S.me);
  scheduleEvict();
}

/* ---- Alerts ----
   What an upload found (files refused, files already loaded) and the images a project
   opened could not read. They belong to the instance, its tab's, by its line of history:
   each snapshot carries the line it was taken on (lineOf); a state put back from one (an
   undo, a redo) is on that line, any other (a tab's state as it wakes; a project read in
   for its CSV or its saved key, in an instance of its own: utils.js withState) starts a
   new one. Within its tab, each is about files: those it names (the image a file dropped
   is a copy of), or, for the refused and the unreadable, which name files never loaded,
   those in the list when it was made (none: while the list is empty). It shows while
   those files are in the list, and goes when they go: an image removed takes its own
   with it, Remove all all of them. An undo leaves them as they are: to v487 every
   restore wiped them, though they are about the upload, not the state. A line's alerts
   (the last 32 lines'): sem-model.js alertsNow, setAlerts, dropAlertsOf.
   What the reading of an image said (its warning) is worked out from the images in the
   list (sem-html.js fileNotes), each image's until its box's ×, which marks it seen in the
   list and the history (alerts.js markSeen; v572: to v571 a line's, lost as the project
   was reopened or its tab woken). */
const fileNotes = S => H.fileNotes(HU, S.allFiles, info);
function alertClicked(S, e){
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'sem-dismiss-invalid'){ M.setAlerts(S, { bad: null }); rebuildAlerts(S); }
  else if (btn.dataset.action === 'sem-dismiss-upload'){ M.setAlerts(S, { dup: [] }); rebuildAlerts(S); }
  else if (btn.dataset.action === 'sem-dismiss-check'){ markSeen(S.hist, fileNotes(S), 'check', { same: M.sameImage }); rebuildAlerts(S); }
}
function rebuildAlerts(S){
  const here = new Set(S.allFiles.map(f=> f.raw.id));
  S.$('semAlerts').innerHTML = H.alertsHtml(HU, M.alertsNow(S), here, fileNotes(S));
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
function wireLoading(S){
  registerBusy(S.key, {
    busy: ()=> S.loading || S.waiting ? 'The reading of SEM files' : null,
    // (the files waiting their turn go too: they were dropped into the project closed)
    stop: ()=>{ S.gen++; if (S.loading){ S.loading.stopped = true; stopReads(S.owner); } },
  });
  setupDropzone(S.$('semDropzone'), S.$('semFiles'), list=> dropped(S, list));
}
// (each drop's promise: every file dropped so far read, so that the drop zone says it
// is reading until the last one is)
const drained = (S, q)=> q.then(()=> q === S.queue ? null : drained(S, S.queue));
function dropped(S, list){
  const g = S.gen;
  S.waiting++;
  busyChanged(S.key);
  // (its tab's time hidden, for its sleep, counted from the reading's end: tabs.js)
  S.queue = S.queue.then(()=>{ S.waiting--; return g === S.gen ? loadFiles(S, list) : null; }).catch(err=> console.error('SEM files not read', err))
    .then(()=>{ if (!S.dead) busyChanged(S.key); });
  return drained(S, S.queue);
}
async function loadFiles(S, list){
  const job = { ids: new Set(), stopped: false }, said = { bad: [], dup: [] }, add = [], mark = S.hist.hold();
  S.loading = job;
  try {
    for (const file of list){
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      // A .hdr beside its .tif says what the TIFF carries already.
      if (ext === 'hdr') continue;
      if (ext !== 'tif' && ext !== 'tiff'){ said.bad.push(H.fileLine(HU, file.name, 'not a TIFF')); continue; }
      const res = await readOne(file, job, S.owner);
      if (job.stopped) return;
      took(S, file, res, job, said, add);
    }
  } finally { if (S.loading === job) S.loading = null; S.hist.release(mark); }
  // The files read join the list as it is now, one step (an undo meanwhile may have put
  // back one of them: already loaded then).
  const here = new Set(S.allFiles.map(f=> f.raw.id));
  add.forEach(f=>{ if (here.has(f.raw.id)) said.dup.push({ id: f.raw.id, html: esc(f.name) }); else S.allFiles.push(f); });
  M.setAlerts(S, { bad: said.bad.length ? { names: said.bad, ids: S.allFiles.map(f=> f.raw.id) } : null, dup: said.dup });
  afterFilesChange(S);
}
// A file read (res: readOne's): refused, already loaded, or kept and added (add), what the
// reading made of it remembered.
function took(S, file, res, job, said, add){
  if (res.error != null){ said.bad.push(H.fileLine(HU, file.name, res.error)); return; }
  if (res.fault != null){ said.bad.push(H.fileLine(HU, file.name, M.faultText(res))); return; }
  const { id, r } = res;
  if (S.allFiles.some(f=> f.raw.id === id) || job.ids.has(id)){ said.dup.push({ id, html: esc(file.name) }); return; }
  job.ids.add(id);
  remember(id, r, res.small, res.card, res.px);
  statsCache.set(statsKey(id, M.defaultCrop(r)), res.st);
  // (its bytes those another tab holds already, where one does: rawOf)
  add.push(M.newFile(file.name, r, rawOf(id, res.bytes)));
}

/* ---- File list ---- */
function fileCallbacks(S){
  return {
    onRemove(i){ const f = S.allFiles[i]; removeFileAt(S.allFiles, i, []); if (f) M.dropAlertsOf(S, f.raw.id); afterFilesChange(S); },
    onReorder(from, to){ moveFileTo(S.allFiles, from, to, []); afterFilesChange(S); },
    onInclude(i, on){ setIncluded(S.allFiles, i, on, []); afterFilesChange(S); },
    onIncludeAll(on){ S.allFiles.forEach((_, j)=> setIncluded(S.allFiles, j, on, [])); afterFilesChange(S); },
    // Everywhere the label shows: the groups' captions and the Reference menu too (to
    // v474 only the navigator and the thumbnails).
    onLabelChange(i, v){ S.allFiles[i].label = v; renderNav(S); renderThumbs(S); renderGroups(S); renderIntensity(S); S.hist.commit(); },
    onRemoveAll(){ S.allFiles.length = 0; M.setAlerts(S, { bad: null, dup: [] }); afterFilesChange(S); },
  };
}
function afterFilesChange(S){
  filesChanged(S);
  renderAll(S);
  S.hist.commit();
}
// The files changed: the included ones, the list, the groups (state), the alerts.
// (The editor's image is drawn again when its curve differs: the files, and with them
// the reference, may; loadEditorImage.)
function filesChanged(S){
  S.files = includedOf(S.allFiles);
  S.cur = Math.min(S.cur, Math.max(0, S.files.length - 1));
  setTabLoaded(S.key, S.allFiles.length);
  // The list's rows map onto allFiles by index; the download needs the RawRef.
  renderUnifiedFileList(S.$('semFileTableWrap'), M.listView(S), fileCallbacks(S));
  S.$('semWorkspace').style.display = S.files.length ? 'block' : 'none';
  S.$('semGroupsCard').style.display = S.files.length ? 'block' : 'none';
  M.syncGroups(U, S);
  rebuildAlerts(S);
  // (what it drew of images gone from its list let go: an undo draws them again)
  const ids = new Set(S.allFiles.map(f=> f.raw.id));
  for (const m of [S.thumbs, S.cardsCv]) for (const id of [...m.keys()]) if (!ids.has(id)) m.delete(id);
  scheduleEvict();
}

/* ---- Undo / project state ---- */
function snapshot(S){
  const s = M.snapshotOf(S);
  // (its line of history beside it, not in it: neither compared nor saved)
  S.lineOf.set(s, S.line);
  return s;
}
/* A state put back: an undo's, a project's opened or read in (a tab, its CSV, its saved
   key), as the module would have made it (sem-model.js restoreInto). Its line of history
   (Alerts) is the snapshot's, else a new one; images whose bytes no longer read are left
   out of the list, and said so.
   It is drawn after the task (queueRender), and the restore itself decodes none of
   its images (info): a state read in and out again (utils.js withState) is not drawn,
   and its saved key decodes nothing; its CSV decodes the images it includes, for their
   statistics (let go after: evict). */
function restore(S, s){
  S.line = S.lineOf.has(s) ? S.lineOf.get(s) : ++S.lines;
  const { lost, cur } = M.restoreInto(U, S, s);
  // (on this state's line: one read in and out again keeps its own, never shown)
  if (lost.length) M.setAlerts(S, { bad: { names: [esc(H.lostLine(lost.length))], ids: S.allFiles.map(f=> f.raw.id), opened: true } });
  S.cur = cur;
  filesChanged(S);
  // (a wake's or a reload's: the image its tab showed, by its id, over the record's state,
  // which a step writes no sooner than the next change: showNext)
  if (S.imgNext != null){ const k = S.files.findIndex(f=> f.raw.id === S.imgNext); if (k >= 0) S.cur = k; S.imgNext = null; }
  queueRender(S);
}
/* Drawn once the task that restored is over (a microtask, before the page is painted):
   a state read into an instance of its own and out again in one go (utils.js withState:
   a saved project's CSV, the saved key of a tab) is never drawn, that instance let go
   first (dead); to v487 it was, every image of the project read in decoded for it. */
function queueRender(S){
  if (S.renderQueued) return;
  S.renderQueued = true;
  queueMicrotask(()=>{
    S.renderQueued = false;
    // (one let go meanwhile: a state read out of it, withState)
    if (S.dead) return;
    rebuildAlerts(S);
    renderAll(S);
    // An undo with the figure open: it shows the settings now in force.
    if (S.figApi && S.figApi.open) S.figApi.refresh();
  });
}
// Shown (goTab, at each show; a resize): what changed while it was hidden drawn now
// (stale: all of it), else fitted to the page again, the editor's image made again
// where it was let go (hide).
function redrawTab(S){
  if (!S.files.length || S.dead) return;
  if (S.stale){ renderAll(S); return; }
  fitWork(S); sizeGroups(S); loadEditorImage(S); fitView(S); drawEditor(S); drawHist(S);
}

/* ---- Rendering ---- */
function renderAll(S){
  if (!S.files.length) return;
  if (!drawable(S)) return;
  S.stale = false;
  renderNav(S); renderInfo(S); renderFields(S); fitWork(S); renderThumbs(S);
  loadEditorImage(S); fitView(S); drawEditor(S);
  renderIntensity(S); renderGroups(S);
}
// Something that changes the curves (a crop, the normalisation, a correction): every
// view of the images drawn again, each image's only where what it is drawn from has
// changed (thumbOf, cardOf, loadEditorImage).
function refreshLevels(S){
  if (!drawable(S)) return;
  loadEditorImage(S); drawEditor(S);
  renderThumbs(S); renderIntensity(S); renderGroups(S); renderFields(S);
}
const renderNav = S => S.nav.update();
function renderInfo(S){
  const f = S.files[S.cur], r = f && info(f);
  const box = S.$('semInfo');
  if (!r){ box.innerHTML = ''; return; }
  box.innerHTML = H.infoHtml(HU, f, r, M.outOf(U, S, f));
}
// The crop's fields, locked while it is the default.
function renderFields(S){
  const f = S.files[S.cur], e = f && info(f);
  if (!e) return;
  const c = f.crop;
  ['x', 'y', 'w', 'h'].forEach(k=>{ const el = S.$('semCrop' + k.toUpperCase()); if (document.activeElement !== el) el.value = String(c[k]); el.disabled = !!f.cropDef; });
  const asp = S.$('semAspect');
  asp.value = f.aspect; asp.disabled = !!f.cropDef;
  S.$('semCropDef').checked = !!f.cropDef;
  renderInfo(S);
}

/* ---- The thumbnails ----
   Every included image with its crop drawn on it; a press shows it in the editor, its
   chain links its crop to the other linked images'.
   An image's thumbnail: its reduced copy through its curve, its crop drawn on it.
   Drawn again only when its curve or its crop has changed (to v487 every one of them
   at every edit); the same canvas otherwise, put in the new row. */
function thumbOf(S, f){
  const c = f.crop, key = `${M.lutKey(S, f)}|${c.x},${c.y},${c.w},${c.h}`, t = S.thumbs.get(f.raw.id);
  if (t && t.key === key) return t.cv;
  const sm = smallOf(f);
  if (!sm) return null;
  const k = 1/sm.k, cv = toCanvas(sm.px, sm.w, 0, 0, sm.w, sm.h, lutOf(S, f));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.rect(0, 0, cv.width, cv.height); ctx.rect(c.x*k, c.y*k, c.w*k, c.h*k); ctx.fill('evenodd');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(c.x*k + 0.5, c.y*k + 0.5, Math.max(1, c.w*k - 1), Math.max(1, c.h*k - 1));
  S.thumbs.set(f.raw.id, { key, cv });
  return cv;
}
function renderThumbs(S){
  if (!drawable(S)) return;
  const box = S.$('semThumbs');
  box.innerHTML = '';
  S.files.forEach((f, i)=>{
    const cv = info(f) && thumbOf(S, f); if (!cv) return;
    box.appendChild(thumbEl(S, f, i, cv));
  });
}
// A thumbnail's box: the image with its caption, and its chain.
function thumbEl(S, f, i, cv){
  const wrap = document.createElement('div');
  wrap.className = 'sem-thumb-wrap';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'sem-thumb' + (i === S.cur ? ' is-on' : ''); b.title = f.label;
  b.dataset.i = i;
  b.appendChild(cv);
  const cap = document.createElement('span');
  const r = M.isRef(S, f);
  cap.className = 'sem-thumb-cap'; cap.textContent = (r ? '◎ ' : '') + f.label + (f.clamped ? ' ⓘ' : '');
  if (r) b.title = f.label + ': the reference';
  if (f.clamped) b.title += (r ? ', ' : ': ') + 'its crop was narrowed to fit it';
  // Out of the images the selector chose: dimmed (a click on it chooses its group).
  const sc = M.scopeOf(S);
  if (sc !== 'all' && (!M.groupOf(S, f) || M.groupOf(S, f).id !== sc)) wrap.classList.add('is-out');
  b.appendChild(cap);
  const ln = document.createElement('button');
  ln.type = 'button'; ln.className = 'sem-link' + (f.linked ? ' is-on' : ''); ln.dataset.link = i; ln.innerHTML = H.LINK_SVG;
  ln.setAttribute('aria-pressed', String(!!f.linked));
  ln.title = f.linked ? 'Linked: its crop is shared with the other linked images. Click to unlink it' : 'Link its crop to the other linked images';
  wrap.append(b, ln);
  return wrap;
}
function wireThumbs(S){
  S.$('semThumbs').addEventListener('click', e=>{
    const ln = e.target.closest('.sem-link');
    if (ln){ setLinked(S, S.files[+ln.dataset.link], !S.files[+ln.dataset.link].linked); return; }
    const b = e.target.closest('.sem-thumb'); if (!b) return;
    go(S, +b.dataset.i);
  });
  S.$('semPrev').addEventListener('click', ()=> go(S, S.cur - 1));
  S.$('semNext').addEventListener('click', ()=> go(S, S.cur + 1));
  // (its list: any image, straight)
  S.nav = snav(S.$('semNav').querySelector('.snav'), { count: ()=> S.files.length, index: ()=> S.cur, label: i=> S.files[i].label, go: i=> go(S, i) });
}
function go(S, i){
  if (!S.files.length) return;
  S.cur = (i + S.files.length) % S.files.length;
  renderAll(S);
}

/* ---- The crop editor ----
   The image drawn into a canvas with the view (S.view: scale s in CSS px a pixel, and the
   image's top-left at ox, oy); the crop over it, the rest darkened, with eight handles.
   Dragging a handle or a side resizes, inside moves, outside pans; the wheel zooms about
   the pointer, a double click outside the crop fits the image.
   The current image at full size through its curve (off), made again when the image or its
   curve (lutKey: its crop's statistics among what it is made from) has changed since,
   or as its tab is shown again (let go as it was hidden: hide; 17 MB for an image of
   2048², made again in some 30 ms). Its pixels (toCanvas, as much again) are kept for
   the next curve while the image is edited, let go 2 s after the last (a curve then 9
   ms, not 22). */
function loadEditorImage(S){
  if (!drawable(S)) return;
  const f = S.files[S.cur], r = f && info(f), px = r && pixelsOf(f);
  if (!px) return;
  const key = M.lutKey(S, f);
  if (S.off && S.offKey === key) return;
  S.off = toCanvas(px, r.width, 0, 0, r.width, r.imageH, lutOf(S, f), S.off);
  S.offKey = key;
  clearTimeout(S.imgTimer); S.imgTimer = setTimeout(()=>{ if (S.off) S.off._img = null; }, 2000);
}
// The pane's size (sem-model.js paneSize). (Pointer positions are taken on the canvas, which
// fills the pane inside its border: the view's origin.)
function paneSize(S){
  const f = S.files[S.cur], r = f && info(f);
  return M.paneSize(r, S.host.clientWidth, window.innerHeight);
}
/* The editor's zoom, of the image it was set on (S.ed: sem-model.js zoomOf); none, the
   image fitted. Kept as the pane changes size, at a show, a resize or an undo (to v517 each
   of these fitted the image again), and as the tab sleeps or the page is reloaded
   (inst.shows, tabs.js); another image is shown fitted, and Fit (or a double click with a
   tool on) fits it. */
function fitView(S){
  const f = S.files[S.cur], r = f && info(f);
  if (!r) return;
  const [w, h] = paneSize(S);
  S.host.style.height = h + 'px';
  if (S.ed && S.ed.id !== f.raw.id) S.ed = null;
  Object.assign(S.view, M.viewIn(r, w, h, S.ed));
}
// The view moved by hand (a pan, a zoom): kept, against the image fitted.
function keepView(S){
  const f = S.files[S.cur], r = f && info(f);
  if (!r) return;
  const [w, h] = paneSize(S);
  S.ed = M.zoomOf(S.view, r, w, h, f.raw.id);
}
function refit(S){ S.ed = null; fitView(S); drawEditor(S); }
function drawEditor(S){
  const f = S.files[S.cur], r = f && info(f);
  if (!r || !S.off) return;
  const dpr = window.devicePixelRatio || 1, w = S.host.clientWidth, h = S.host.clientHeight, cv = S.canvas;
  if (!w || !h) return;
  if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // Smoothed when shrunk, pixels kept sharp when enlarged.
  ctx.imageSmoothingEnabled = S.view.s < 2;
  drawCrop(S, ctx, f, r);
  // The area being drawn with Zoom area (the plots' colours).
  if (S.zoomBox){
    const z = S.zoomBox, zx = Math.min(z.x0, z.x1), zy = Math.min(z.y0, z.y1), zw = Math.abs(z.x1 - z.x0), zh = Math.abs(z.y1 - z.y0);
    ctx.fillStyle = 'rgba(100,160,255,0.12)'; ctx.fillRect(zx, zy, zw, zh);
    ctx.strokeStyle = 'rgba(100,160,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(zx + 0.5, zy + 0.5, zw, zh);
  }
}
// The image, the crop over it (the rest darkened), the part the figure takes and the handles.
function drawCrop(S, ctx, f, r){
  const view = S.view, W = r.width, H = r.imageH, c = f.crop, X = x => view.ox + x*view.s, Y = y => view.oy + y*view.s;
  ctx.drawImage(S.off, X(0), Y(0), W*view.s, H*view.s);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.rect(X(0), Y(0), W*view.s, H*view.s); ctx.rect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s); ctx.fill('evenodd');
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s);
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.strokeRect(X(c.x), Y(c.y), c.w*view.s, c.h*view.s);
  // Narrowed by its group to the common field: what the figure takes, dashed.
  const o = M.outOf(U, S, f);
  if (o && (o.c.w !== c.w || o.c.h !== c.h)){
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff';
    ctx.strokeRect(X(o.c.x), Y(o.c.y), o.c.w*view.s, o.c.h*view.s); ctx.setLineDash([]);
  }
  for (const [hx, hy] of M.handlePoints(c)){
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
    ctx.fillRect(X(hx) - 4.5, Y(hy) - 4.5, 9, 9); ctx.strokeRect(X(hx) - 4.5, Y(hy) - 4.5, 9, 9);
  }
}
const hitTest = (S, px, py, touch)=> M.hitTest(S.view, S.files[S.cur].crop, px, py, touch);
/* The toolbar on the image, as on the plots: Fit, Pan and Zoom area. With no tool on,
   the image stays fitted and still, the wheel scrolls the page, and a drag works the
   crop; Pan drags the view, Zoom area zooms into the rectangle drawn. With a tool on,
   the wheel zooms about the pointer and a double click fits the image again. */
function setTool(S, t){
  S.tool = t;
  S.$('semToolPan').classList.toggle('is-on', t === 'pan');
  S.$('semToolZoom').classList.toggle('is-on', t === 'zoom');
  S.host.closest('.plot-wrap').classList.toggle('tool-armed', !!t);
  S.host.style.cursor = t === 'pan' ? 'move' : t === 'zoom' ? 'crosshair' : '';
}
function wireEditor(S){
  S.canvas = S.$('semCropCanvas'); S.host = S.canvas.parentElement;
  S.$('semToolPan').addEventListener('click', ()=> setTool(S, S.tool === 'pan' ? null : 'pan'));
  S.$('semToolZoom').addEventListener('click', ()=> setTool(S, S.tool === 'zoom' ? null : 'zoom'));
  S.$('semToolFit').addEventListener('click', ()=> refit(S));
  const host = S.host;
  host.addEventListener('pointerdown', e=> pressed(S, e));
  host.addEventListener('pointermove', e=> pointerMoved(S, e));
  host.addEventListener('pointerup', ()=> endDrag(S));
  host.addEventListener('pointercancel', ()=> endDrag(S));
  host.addEventListener('wheel', e=>{
    if (!S.files.length || !S.tool) return;
    e.preventDefault();
    const b = S.canvas.getBoundingClientRect();
    zoomAt(S, e.clientX - b.left, e.clientY - b.top, Math.exp(-e.deltaY*0.004));
  }, { passive: false });
  host.addEventListener('dblclick', ()=>{ if (S.tool) refit(S); });
}
function pressed(S, e){
  if (e.button !== 0 || !S.files.length) return;
  const b = S.canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
  const mode = S.tool || hitTest(S, px, py, e.pointerType === 'touch'), f = S.files[S.cur];
  // Outside the crop with no tool on, nothing: the view does not move unless asked.
  if (mode === 'pan' && !S.tool) return;
  S.drag = { mode, px, py, c0: { ...f.crop }, clamped: f.clamped, def: f.cropDef, ox: S.view.ox, oy: S.view.oy, moved: false };
  S.host.setPointerCapture(e.pointerId);
  if (mode === 'pan') S.host.style.cursor = 'grabbing';
  else if (mode !== 'zoom') S.host.style.cursor = M.CURSOR[mode];
  e.preventDefault();
}
function pointerMoved(S, e){
  const b = S.canvas.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top, d = S.drag, view = S.view;
  if (!d){
    if (S.files.length && !S.tool){ const m = hitTest(S, px, py, e.pointerType === 'touch'); S.host.style.cursor = m === 'pan' ? '' : M.CURSOR[m]; }
    return;
  }
  const f = S.files[S.cur], r = info(f), W = r.width, H = r.imageH;
  const dx = (px - d.px)/view.s, dy = (py - d.py)/view.s;
  d.moved = d.moved || Math.abs(px - d.px) + Math.abs(py - d.py) > 2;
  if (d.mode === 'pan'){ view.ox = d.ox + px - d.px; view.oy = d.oy + py - d.py; }
  else if (d.mode === 'zoom') S.zoomBox = { x0: d.px, y0: d.py, x1: px, y1: py };
  // The crop follows once the pointer has moved more than 2 px, so that a click's
  // jitter leaves it (to v476 it followed at once, and a drag that stayed within the
  // 2 px changed it uncommitted). Back where it started, it is the crop it was, with
  // its flags (sem-model.js dragCrop).
  else if (d.moved){ M.dragCrop(f, d, dx, dy, W, H); renderFields(S); }
  drawEditor(S);
}
function endDrag(S){
  if (!S.drag) return;
  const d = S.drag; S.drag = null;
  S.host.style.cursor = S.tool === 'pan' ? 'move' : S.tool === 'zoom' ? 'crosshair' : '';
  if (d.mode === 'zoom'){
    const z = S.zoomBox; S.zoomBox = null;
    // The rectangle drawn fills the pane (one too small to mean one is ignored).
    if (z && Math.abs(z.x1 - z.x0) > 5 && Math.abs(z.y1 - z.y0) > 5){
      Object.assign(S.view, M.zoomedTo(S.view, z, S.host.clientWidth, S.host.clientHeight));
      keepView(S);
    }
    drawEditor(S);
  // A crop the drag changed is committed (the linked images, statistics and
  // thumbnails with it), whatever the pointer's move; one it left as it was, nothing.
  } else if (d.mode === 'pan'){ if (d.moved) keepView(S); }
  else if (!M.sameCrop(S.files[S.cur].crop, d.c0)) cropChanged(S);
}
function zoomAt(S, px, py, k){
  const f = S.files[S.cur], r = info(f);
  Object.assign(S.view, M.zoomedAt(S.view, r, S.host.clientWidth, S.host.clientHeight, px, py, k));
  keepView(S);
  drawEditor(S);
}

/* ---- The crop's fields (sem-model.js typeCrop, setAspect, setCropDef) ---- */
// A crop set (dragged, typed, reset, re-ratioed): the linked images follow, and it
// is one step of the history.
function cropChanged(S){
  const f = S.files[S.cur];
  M.propagate(U, S, f);
  renderFields(S); refreshLevels(S);
  S.hist.commit();
}
function wireCrop(S){
  ['X', 'Y', 'W', 'H'].forEach(K=>{
    const el = S.$('semCrop' + K);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=> cropTyped(S, el, K));
  });
  S.$('semAspect').addEventListener('change', e=>{
    const f = S.files[S.cur]; if (!f) return;
    M.setAspect(f, info(f), e.target.value);
    cropChanged(S);
  });
  S.$('semCropDef').addEventListener('change', e=>{
    const f = S.files[S.cur]; if (!f) return;
    M.setCropDef(U, f, e.target.checked);
    cropChanged(S);
  });
  S.$('semLinkAll').addEventListener('click', ()=> linkAll(S));
}
function cropTyped(S, el, K){
  const f = S.files[S.cur]; if (!f) return;
  const r = info(f), v = Math.round(parseFloat(String(el.value).replace(',', '.')));
  if (!Number.isFinite(v)){ flashFieldInvalid(el); renderFields(S); return; }
  if (M.typeCrop(f, r, K.toLowerCase(), v)) flashFieldInvalid(el);
  cropChanged(S);
}
function setLinked(S, f, on){
  if (!f) return;
  M.setLinked(U, S, f, on);
  renderFields(S); refreshLevels(S);
  S.hist.commit();
}
function linkAll(S){
  const f = S.files[S.cur], fs = M.scopeFiles(S); if (!f || !fs.length) return;
  M.linkAll(U, S, f, fs);
  renderFields(S); refreshLevels(S);
  S.hist.commit();
}
function renderLinkAll(S){
  const fs = M.scopeFiles(S), b = S.$('semLinkAll');
  b.textContent = M.linkAllText(fs);
}

/* ---- Groups and scale (sem-model.js) ---- */
// (resample: sem-read.js, shared with the worker, which makes each image's card for
// its default crop as it reads it)
// An image as the figure will take it, through its curve, at the figure's pixels or
// brought down to `fit` px across.
function outCanvas(S, f, fit){
  const o = M.outOf(U, S, f), px = o && pixelsOf(f);
  if (!px) return null;
  const k = fit ? Math.min(1, fit/Math.max(o.w, o.h)) : 1, w = Math.max(1, Math.round(o.w*k)), h = Math.max(1, Math.round(o.h*k));
  return toCanvas(resample(px, info(f).width, o.c, w, h), w, 0, 0, w, h, lutOf(S, f));
}
/* Its card in a group: as the figure takes it, brought down to 200 px across, from
   the whole crop as before (sem-read.js cardLevels). Its levels are made only for a
   part of the original or a size not among the last CARDS it took (a file read comes
   with those of its default crop, made by the worker), and put through its curve again
   only when that changes too: to v487 both at every edit, for every image. The levels
   are the module's (imgs), the canvas the instance's. */
function cardOf(S, f){
  const o = M.outOf(U, S, f), e = o && imgOf(f);
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
  const key = `${L.pk}|${M.lutKey(S, f)}`, C = S.cardsCv.get(f.raw.id);
  if (C && C.key === key) return C.cv;
  const cv = toCanvas(L.px, L.w, 0, 0, L.w, L.h, lutOf(S, f));
  S.cardsCv.set(f.raw.id, { key, cv });
  return cv;
}
// A group's name (plain text, a field on hover and while edited) as wide as it is.
function fitGroupName(el){
  // Its room: the head's width less the scale and the figure's button beside it.
  const acts = el.parentElement.querySelector('.sem-group-acts'), cs = getComputedStyle(el);
  const fig = el.parentElement.querySelector('.sem-group-fig'), wraps = getComputedStyle(el.parentElement).flexWrap === 'wrap';
  const room = el.parentElement.clientWidth - (wraps ? fig.offsetWidth : acts.offsetWidth) - 16;
  if (!room) return;
  nameCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  el.style.width = Math.min(nameCtx.measureText(el.value || el.placeholder).width + 24, room + 10) + 'px';
}
// The groups' boxes (sem-html.js groupsHtml), each image's card in it.
function renderGroups(S){
  if (!drawable(S)) return;
  const box = S.$('semGroups');
  if (!box || !S.files.length) return;
  box.innerHTML = H.groupsHtml(HU, S);
  sizeGroups(S);
  box.querySelectorAll('.sem-gimg').forEach(el=>{ const f = M.byId(S, el.dataset.id), cv = f && cardOf(S, f); if (cv) el.querySelector('.sem-gimg-pic').appendChild(cv); });
  box.querySelectorAll('.sem-group-name').forEach(fitGroupName);
  box.querySelectorAll('.sem-group-imgs').forEach(row=>{ row.addEventListener('scroll', ()=> pageArrows(row), { passive: true }); pageArrows(row); });
}
/* The groups' height: a box 4φ : 1 at full screen, kept whatever the window. Full
   screen is the screen's width, at most the page's 1500 px, less what lies around a
   group now (the page's and the card's margins). The images take what the height
   leaves under the head and over their names, never under 80 px (on a phone, where
   4φ : 1 would leave next to nothing, the box grows instead). The full-screen width
   (S.groupFull) is worked out once, at the first layout: resizing the window must not
   change the height. */
function sizeGroups(S){
  const box = S.$('semGroups'), g = box.querySelector('.sem-group');
  if (!g || !box.clientWidth) return;
  const main = document.querySelector('main'), mcs = getComputedStyle(main);
  const pad = parseFloat(mcs.paddingLeft) + parseFloat(mcs.paddingRight);
  const around = main.clientWidth - pad - g.offsetWidth;
  const scr = screen.availWidth || window.innerWidth;
  if (!S.groupFull) S.groupFull = { scr, w: Math.min(Math.max(scr, window.innerWidth), parseFloat(mcs.maxWidth) || Infinity) - pad - around };
  const full = S.groupFull.w;
  const gcs = getComputedStyle(g), head = g.querySelector('.sem-group-head').offsetHeight;
  const cap = 4 + 16;   // the gap and the name under an image
  const chrome = parseFloat(gcs.paddingTop) + parseFloat(gcs.paddingBottom) + parseFloat(gcs.borderTopWidth) + parseFloat(gcs.borderBottomWidth) + head + parseFloat(gcs.rowGap || 8) + cap;
  const H = Math.round(full/M.PHI4), img = Math.max(80, Math.floor(H - chrome));
  box.style.setProperty('--sem-img', img + 'px');
  box.style.setProperty('--sem-group-h', Math.max(H, Math.ceil(chrome + img)) + 'px');
}
function windowResized(S){
  if (!S.shown()) return;
  sizeGroups(S); S.root.querySelectorAll('#semGroups .sem-group-imgs').forEach(pageArrows); fitWork(S);
}
/* Crop and intensity in three columns, until a field's name would be cut short ("…"), or
   a field (two fifths of the settings' column, v531) narrower than 90 px: then one
   column, the image on top, the thumbnails, the settings under them. Tried in three
   columns at every resize (synchronously, so nothing is painted between). */
function fitWork(S){
  const work = S.root.querySelector('.sem-work');
  if (!work || !work.offsetWidth) return;
  const was = work.classList.contains('sem-stacked');
  work.classList.remove('sem-stacked');
  const cut = [...work.querySelectorAll('.sem-pg > .txt-label')].some(l=> l.scrollWidth > l.clientWidth + 0.5)
    || [...work.querySelectorAll('.sem-pg > .pg-field')].some(f=> f.offsetWidth && f.offsetWidth < 90);
  work.classList.toggle('sem-stacked', cut);
  // The editor and the histogram are sized to their column: redrawn when it changes.
  if (cut !== was && S.files.length){ fitView(S); drawEditor(S); drawHist(S); }
}
function groupsChanged(S){
  renderGroups(S); renderFields(S); renderIntensity(S); drawEditor(S);
  S.hist.commit();
}
function wireGroups(S){
  const box = S.groupsBox = S.$('semGroups');
  S.groupsCard = S.$('semGroupsCard');
  box.addEventListener('input', e=>{ if (e.target.classList.contains('sem-group-name')) fitGroupName(e.target); });
  box.addEventListener('change', e=> groupEdited(S, e.target));
  // + Group: an empty group, to drag images into.
  S.$('semAddGroup').addEventListener('click', ()=>{ M.addGroup(S); groupsChanged(S); });
  wireGroupDrag(S, box);
  box.addEventListener('click', e=> groupsClicked(S, e));
  box.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.classList.contains('sem-group-name')) e.target.blur(); });
  // Reset: the groups made again from the pixel sizes (sem-model.js regroup).
  S.$('semRegroup').addEventListener('click', ()=>{ M.regroup(U, S); groupsChanged(S); });
}
function groupEdited(S, t){
  if (t.classList.contains('sem-group-name')){
    const g = S.groups.find(g=> g.id === t.dataset.g); if (!g) return;
    M.renameGroup(U, S, g, t.value);
  } else if (t.classList.contains('sem-group-mode')){
    const g = S.groups.find(g=> g.id === t.dataset.g); if (!g) return;
    g.mode = t.value;
  } else return;
  groupsChanged(S);
}
function groupsClicked(S, e){
  const pg = e.target.closest('[data-page]');
  if (pg){ const row = pg.parentElement.querySelector('.sem-group-imgs'); row.scrollBy({ left: +pg.dataset.page*row.clientWidth, behavior: 'smooth' }); return; }
  const b = e.target.closest('[data-fig]'); if (b){ openFigure(S, b.dataset.fig); return; }
  const d = e.target.closest('[data-del]');
  if (d){ M.dropGroup(U, S, d.dataset.del); groupsChanged(S); }
}
/* Dragging an image between groups (pointer events: a mouse and a finger alike): a
   copy of it follows the pointer, the group under it lights (or + Group, for a new
   one), and the drop moves it there (sem-model.js moveImage). A press without a move does
   nothing. A finger first holds the image still a moment: a swipe over the images scrolls
   the page. */
const dropTargets = S => S.groupsCard.querySelectorAll('[data-drop]');
function wireGroupDrag(S, box){
  box.addEventListener('pointerdown', e=>{
    const card = e.target.closest('.sem-gimg');
    if (!card || e.button !== 0) return;
    const touch = e.pointerType === 'touch';
    S.gdrag = { id: card.dataset.id, card, x0: e.clientX, y0: e.clientY, ghost: null, over: null, held: !touch, timer: 0 };
    if (touch) S.gdrag.timer = setTimeout(()=>{ if (S.gdrag && S.gdrag.card === card){ S.gdrag.held = true; card.classList.add('is-held'); } }, HOLD_MS);
    else { card.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  box.addEventListener('pointermove', e=> groupDragged(S, e));
  // Held, the finger drags the image, not the page.
  box.addEventListener('touchmove', e=>{ if (S.gdrag && S.gdrag.held && e.cancelable) e.preventDefault(); }, { passive: false });
  box.addEventListener('contextmenu', e=>{ if (S.gdrag) e.preventDefault(); });
  box.addEventListener('pointerup', ()=> endGroupDrag(S));
  box.addEventListener('pointercancel', ()=> endGroupDrag(S));
}
function groupDragged(S, e){
  const d = S.gdrag;
  if (!d) return;
  const moved = Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0);
  // A finger that moves before the hold is a scroll: no drag.
  if (!d.held){ if (moved > 8) endGroupDrag(S); return; }
  if (!d.ghost){
    if (moved < 5) return;
    const pic = d.card.querySelector('canvas'), g = document.createElement('canvas');
    g.width = pic.width; g.height = pic.height; g.getContext('2d').drawImage(pic, 0, 0);
    g.className = 'sem-drag-ghost'; S.layer.appendChild(g);
    d.ghost = g; d.card.classList.add('is-dragged');
  }
  d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px';
  const under = document.elementFromPoint(e.clientX, e.clientY), t = under && under.closest('[data-drop]');
  const to = t && S.groupsCard.contains(t) ? t.dataset.drop : null;
  if (to !== d.over){ dropTargets(S).forEach(el=> el.classList.toggle('is-drop', el.dataset.drop === to)); d.over = to; }
}
function endGroupDrag(S){
  if (!S.gdrag) return;
  const d = S.gdrag; S.gdrag = null;
  clearTimeout(d.timer);
  if (d.ghost) d.ghost.remove();
  d.card.classList.remove('is-dragged', 'is-held');
  dropTargets(S).forEach(el=> el.classList.remove('is-drop'));
  if (d.ghost && d.over && M.moveImage(U, S, d.id, d.over)) groupsChanged(S);
}

/* ---- The figure (sem-figure.js, loaded when first opened) ----
   It gets the images in the figure, in the file list's order, each as the figure
   takes it (sem-model.js figureImages), so that it is drawn again only when its pixels
   would change.
   One composer at a time: a click while the figure is loading is ignored, and none
   opens over a composer already open (figure.js refuses it too; the open one keeps
   its refresh). A double click before sem-figure.js had loaded opened two, the first
   left with no way to close (to v480). */
async function openFigure(S, gid){
  const g = S.groups.find(g=> g.id === gid);
  if (!g || S.figOpening || document.querySelector('.fig-backdrop')) return;
  S.figOpening = true;
  try {
    let mod;
    // (not served: offline with an old cache, say; said as the plots' composer says it, v571:
    // to v570 in the console alone)
    try { mod = await import('./sem-figure.js'); }
    catch(err){ console.error('SEM figure failed to load', err); confirmBanner('The figure composer could not be loaded: reload the page.', 'OK'); return; }
    const api = mod.openSemFigure({ title: g.name, images: ()=> M.figureImages(U, S, gid, (f, fit)=> outCanvas(S, f, fit)), getFig: ()=> S.figures[gid] || null,
      setFig: f=>{ S.figures[gid] = f; S.hist.commit(); }, alive: ()=> S.groups.some(x=> x.id === gid) });
    if (api) S.figApi = api;
  } catch(err){ console.error('SEM figure failed to open', err); }
  finally { S.figOpening = false; }
}

/* ---- Intensity (the Crop and intensity card) ----
   The settings the selector over the thumbnails chose (sem-model.js scopeOf, edited,
   setScope), and the image's own correction. */
function renderIntensity(S){
  const f = S.files[S.cur];
  if (!f) return;
  const sc = M.scopeOf(S), scope = S.$('semIntScope');
  scope.innerHTML = H.scopeHtml(HU, S.groups.filter(g=> M.inGroup(U, S, g).length));
  scope.value = sc;
  renderLinkAll(S);
  const I = M.edited(S), a = f.adj || M.ADJ_DEF, setv = (id, v) => { const el = S.$(id); if (document.activeElement !== el) el.value = String(+(+v).toPrecision(6)); };
  S.$('semNorm').value = I.mode;
  for (const [id, [k]] of Object.entries(M.INT_FIELDS)) setv(id, I[k]);
  for (const [id, [k]] of Object.entries(M.ADJ_FIELDS)) setv(id, a[k]);
  const rf = M.refFile(S, I);
  S.$('semRef').innerHTML = H.refHtml(HU, S.allFiles);
  if (rf) S.$('semRef').value = rf.raw.id;
  S.$('semIntDef').checked = !!I.def;
  S.$('semAdjDef').checked = f.adjDef !== false;
  // Disabled, not hidden: everything while Default is ticked, and what the
  // normalisation does not use.
  S.$('semNorm').disabled = S.$('semB').disabled = S.$('semC').disabled = S.$('semG').disabled = !!I.def;
  S.$('semPLo').disabled = S.$('semPHi').disabled = !!I.def || I.mode !== 'percentile';
  S.$('semRef').disabled = !!I.def || !M.usesRef(I);
  for (const id of Object.keys(M.ADJ_FIELDS)) S.$(id).disabled = f.adjDef !== false;
  drawHist(S);
}
// The crop's histogram (256 bins, heights as the square root of the counts), the
// curve over it (level → grey), and where a linear normalisation puts black and white.
function drawHist(S){
  const f = S.files[S.cur], cv = S.$('semHist'), box = cv.parentElement;
  if (!(f && info(f)) || !box.clientWidth) return;
  const dpr = window.devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight;
  cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement), muted = css.getPropertyValue('--muted').trim() || '#888', accent = css.getPropertyValue('--accent').trim() || '#fb5';
  const bins = M.histBins(statsOf(f));
  const top = Math.sqrt(Math.max(1, ...bins));
  ctx.globalAlpha = 0.45; ctx.fillStyle = muted;
  for (let i = 0; i < 256; i++){ const bh = Math.sqrt(bins[i])/top*(h - 6); ctx.fillRect(i*w/256, h - bh, Math.max(1, w/256 - 0.3), bh); }
  ctx.globalAlpha = 1;
  const nm = M.normOf(U, S, f), lut = lutOf(S, f);
  if (!nm.table){
    ctx.setLineDash([3, 3]); ctx.strokeStyle = muted; ctx.lineWidth = 1;
    for (const L of [nm.lo, nm.hi]) if (L >= 0 && L <= 65535){ const x = L/65535*w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let x = 0; x <= w; x++){ const y = h - 3 - lut[Math.min(65535, Math.round(x/w*65535))]/255*(h - 6); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
}
function wireIntensity(S){
  S.$('semIntScope').addEventListener('change', e=>{ M.setScope(S, e.target.value); renderAll(S); refreshLevels(S); S.hist.commit(); });
  for (const [id, [k, lo, hi]] of Object.entries(M.INT_FIELDS)){
    const el = S.$(id);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const v = readField(el, lo, hi), E = M.edited(S);
      if (v == null || !S.files.length || !E){ renderIntensity(S); return; }
      E[k] = v; refreshLevels(S); S.hist.commit();
    });
  }
  for (const [id, [k, lo, hi]] of Object.entries(M.ADJ_FIELDS)){
    const el = S.$(id);
    el.addEventListener('keydown', e=>{ if (e.key === 'Enter') el.blur(); });
    el.addEventListener('change', ()=>{
      const f = S.files[S.cur], v = readField(el, lo, hi);
      if (v == null || !f){ renderIntensity(S); return; }
      f.adj = { ...(f.adj || M.ADJ_DEF), [k]: v }; refreshLevels(S); S.hist.commit();
    });
  }
  wireIntChoices(S);
}
function wireIntChoices(S){
  S.$('semNorm').addEventListener('change', e=>{ const E = M.edited(S); E.mode = e.target.value; refreshLevels(S); S.hist.commit(); });
  S.$('semRef').addEventListener('change', e=>{ const E = M.edited(S); E.ref = e.target.value; refreshLevels(S); S.hist.commit(); });
  // Default: the settings at their defaults (the reference kept), their fields locked;
  // unticked, the fields open on them.
  S.$('semIntDef').addEventListener('change', e=>{
    const E = M.edited(S);
    if (e.target.checked) Object.assign(E, { ...M.INT_DEF, ref: E.ref });
    E.def = e.target.checked;
    refreshLevels(S); S.hist.commit();
  });
  S.$('semAdjDef').addEventListener('change', e=>{
    const f = S.files[S.cur]; if (!f) return;
    if (e.target.checked) f.adj = { ...M.ADJ_DEF };
    f.adjDef = e.target.checked;
    refreshLevels(S); S.hist.commit();
  });
}
registerModule('sem', createSem, { dropBytes: true, asleep: asleepHolds });
