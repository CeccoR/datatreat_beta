/* =========================================================
   SEM — what the module works out, which touches no page (sem.js wires it to the tab;
   tests/semmodel.test.mjs calls it in Node): the crop's rules (fitted to an image, resized
   by a handle, typed, re-ratioed, dragged, its handles and what a press takes), the
   intensity's settings and curves (the normalisation of an image, its curve's key and its
   levels), the linked crop, the alerts' lines of history, a file read as the list holds it,
   the state saved and read back (the images' bytes, crops and corrections, the settings,
   the groups and figures of every version before, malformed values), the editor's view
   (fitted, zoomed, kept), the groups (an image placed, the groups kept in step, named,
   moved, reset), what the figure takes of an image, the scope of the settings, the CSV.
   Taken out of v557's sem.js with their operations in their order: the same numbers to the
   last bit.

   What it needs of the page is handed in as one object, U = { isObj, fmtNum, csvLine, info,
   statsOf, rawOf } (sem.js U): modkit.js's and utils.js's helpers, which need a page to
   load, and sem.js's own keeping of what the files are made into (info: an image's header,
   null where its bytes do not read; statsOf: its crop's statistics; rawOf: the one RawRef
   of a file's bytes).

   The state is the instance's (sem.js S), of which this reads and writes: allFiles (every
   image in list order, { name, label, raw, crop, aspect, cropDef, linked, clamped, adj,
   adjDef, included?, sq? }), files (the included ones), cur (the one in the editor, its
   index in files), groups ([{ id, name, named, mode, members, keep? }]), figures (by group),
   intensity (all groups' settings), groupInt (a group's own, by its id), line and alertsOf
   (Alerts).
========================================================= */
import { hashBytes, fromB64 } from './sem-read.js';

/* ---- On the page ----
   d significant digits, the point as a point (fmtNum, with the CSV's decimal separator and
   fixed decimals, is for the export). */
export const sig = (v, d) => Number.isFinite(v) ? String(+v.toPrecision(d)) : '—';
export const magText = r => !(r.mag > 0) ? '' : r.mag >= 1000 ? `${(r.mag/1000).toPrecision(3)} kx` : `${r.mag.toPrecision(3)} x`;
// Anything but a reason (sem-read.js SemReadError) said in words: the raw message
// of an allocation that failed said nothing to the user (to v487).
export const faultText = r => /RangeError|allocation|memory/i.test(`${r.kind} ${r.fault}`) ? 'too large for the memory this page has' : `could not be read: ${r.fault}`;

/* ---- The files' bytes ---- */
// The ids of every file's bytes a state or a history holds (a RawRef, or its copy: { id,
// bytes } or { id, b64 }).
export function idsIn(v, out = new Set(), seen = new Set()){
  if (!v || typeof v !== 'object' || ArrayBuffer.isView(v) || seen.has(v)) return out;
  seen.add(v);
  if (typeof v.id === 'string' && ('bytes' in v || 'b64' in v)) out.add(v.id);
  else for (const k in v) idsIn(v[k], out, seen);
  return out;
}
export function sameBytes(a, b){
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  const n = a.byteOffset % 4 || b.byteOffset % 4 ? 0 : a.length >> 2;
  if (n){ const x = new Uint32Array(a.buffer, a.byteOffset, n), y = new Uint32Array(b.buffer, b.byteOffset, n); for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false; }
  for (let i = 4*n; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* ---- Crop rules ---- */
// The smallest crop side (px); an image smaller than it is taken whole.
export const MIN_CROP = 64;
// The crop's width:height when locked.
export const ASPECTS = { '1:1': 1, '4:3': 4/3, '3:2': 3/2, free: null };
// The ratio named by a crop of w × h, if it is one of the locks (within 1 %).
export const aspectOf = (w, h) => Object.keys(ASPECTS).find(k=> ASPECTS[k] && Math.abs(w/h/ASPECTS[k] - 1) < 0.01) || 'free';
// A rectangle made to fit an image W × H: whole pixels, sides at least MIN_CROP (or
// the image's), inside it, and at ratio r when locked (the longer side shortened).
export function fitCrop(c, W, H, r){
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
export const sameCrop = (a, b) => ['x', 'y', 'w', 'h'].every(k=> a[k] === b[k]);
export const defaultCrop = r => ({ x: 0, y: 0, w: r.width, h: r.imageH });
export const isDefaultCrop = (U, f) =>{ const r = U.info(f), d = r && defaultCrop(r); return !!d && ['x', 'y', 'w', 'h'].every(k=> f.crop[k] === d[k]); };
// A crop as the rules make it: whole pixels, inside the image, its sides at least
// MIN_CROP (or the image's).
export const validCrop = (c, r) => ['x', 'y', 'w', 'h'].every(k=> Number.isInteger(c[k])) && c.x >= 0 && c.y >= 0
  && c.w >= Math.min(MIN_CROP, r.width) && c.h >= Math.min(MIN_CROP, r.imageH) && c.x + c.w <= r.width && c.y + c.h <= r.imageH;
// Set a file's crop from another's (a copy, the linked crop): narrowed to fit where
// its image is smaller, and marked so.
export function takeCrop(U, f, c, aspect){
  const r = U.info(f); if (!r) return;
  const got = fitCrop(c, r.width, r.imageH, ASPECTS[aspect]);
  f.crop = got; f.aspect = aspect;
  f.clamped = got.x !== c.x || got.y !== c.y || got.w !== c.w || got.h !== c.h;
  f.cropDef = isDefaultCrop(U, f);
}
/* A resize from c0 by the pointer's move (dx, dy, image pixels) with handle hd: the
   opposite side or corner stays; with a locked ratio a corner scales both sides by
   the mean of the two moves, a side the other dimension about its middle. */
export function resized(c0, hd, dx, dy, W, H, r){
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
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export function handlePoints(c){
  const xs = { w: c.x, m: c.x + c.w/2, e: c.x + c.w }, ys = { n: c.y, m: c.y + c.h/2, s: c.y + c.h };
  return HANDLES.map(hd=> [xs[hd.includes('w') ? 'w' : hd.includes('e') ? 'e' : 'm'], ys[hd.includes('n') ? 'n' : hd.includes('s') ? 's' : 'm']]);
}
export const CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move', pan: 'grab' };

/* ---- A crop set by hand (the editor's fields and its drag) ---- */
// A side or corner typed (k: 'x', 'y', 'w' or 'h', v its whole number): locked, a typed
// side sets the other from the ratio; a size that would run past the image's edge moves
// the crop back inside it. Whether the crop took another value than the one typed.
export function typeCrop(f, r, k, v){
  const c = { ...f.crop, [k]: v }, ar = ASPECTS[f.aspect];
  if (ar && k === 'w') c.h = v/ar;
  if (ar && k === 'h') c.w = v*ar;
  f.crop = fitCrop(c, r.width, r.imageH, ar);
  f.clamped = false; f.cropDef = false;
  return f.crop[k] !== v;
}
// A new ratio keeps the crop's width and middle where it can, else its height.
export function setAspect(f, r, a){
  const ar = ASPECTS[a], c = f.crop;
  f.aspect = a;
  if (ar){
    let w = c.w, h = w/ar;
    if (h > r.imageH){ h = r.imageH; w = h*ar; }
    if (w > r.width){ w = r.width; h = w/ar; }
    f.crop = fitCrop({ x: c.x + c.w/2 - w/2, y: c.y + c.h/2 - h/2, w, h }, r.width, r.imageH, ar);
  }
  f.clamped = false; f.cropDef = false;
}
// Default: the whole image less its bar, its fields locked; unticked, the fields open
// on it.
export function setCropDef(U, f, on){
  f.cropDef = on;
  if (f.cropDef){ const r = U.info(f); f.crop = defaultCrop(r); f.aspect = aspectOf(f.crop.w, f.crop.h); f.clamped = false; }
}
/* The crop as a drag (sem.js: { mode, c0, clamped, def }) by (dx, dy) image pixels leaves
   it: back where it started, it is the crop it was, with its flags; moved by hand, no longer
   the default. */
export function dragCrop(f, d, dx, dy, W, H){
  const c = !dx && !dy ? d.c0 : d.mode === 'move' ? fitCrop({ ...d.c0, x: d.c0.x + dx, y: d.c0.y + dy }, W, H, null)
    : resized(d.c0, d.mode, dx, dy, W, H, ASPECTS[f.aspect]);
  const same = sameCrop(c, d.c0);
  f.crop = { ...c };
  f.clamped = same && d.clamped; f.cropDef = same && d.def;
}

/* ---- The editor's view ----
   view: { s (CSS px an image pixel), ox, oy (the image's top-left in the pane) }; its zoom,
   of the image it was set on: ed { id, k (its scale against the image fitted), cx, cy (the
   image's point at the pane's centre) }, or null, the image fitted. */
// The pane's size: as wide as its column (cw), as tall as the image at that width, at
// most 70 % of the window's height (ih).
export function paneSize(r, cw, ih){
  const w = Math.max(1, cw), ar = r ? r.imageH/r.width : 1;
  return [w, Math.max(160, Math.min(Math.round(w*ar), Math.round(ih*0.7)))];
}
// The view of an image in a pane w × h: fitted, or at its zoom.
export function viewIn(r, w, h, ed){
  const fit = Math.min(w/r.width, h/r.imageH);
  if (!ed) return { s: fit, ox: (w - fit*r.width)/2, oy: (h - fit*r.imageH)/2 };
  const s = Math.min(32, Math.max(fit*0.5, ed.k*fit));
  return { s, ox: w/2 - ed.cx*s, oy: h/2 - ed.cy*s };
}
// The view moved by hand (a pan, a zoom): its zoom, against the image fitted.
export function zoomOf(view, r, w, h, id){
  const fit = Math.min(w/r.width, h/r.imageH);
  return { id, k: view.s/fit, cx: (w/2 - view.ox)/view.s, cy: (h/2 - view.oy)/view.s };
}
// The wheel: zoomed by k about the pane's point (px, py), in a pane cw × ch.
export function zoomedAt(view, r, cw, ch, px, py, k){
  const fit = Math.min(cw/r.width, ch/r.imageH);
  const s2 = Math.min(32, Math.max(fit*0.5, view.s*k));
  return { ox: px - (px - view.ox)*s2/view.s, oy: py - (py - view.oy)*s2/view.s, s: s2 };
}
// Zoom area: the rectangle drawn z ({ x0, y0, x1, y1 }) filling the pane cw × ch.
export function zoomedTo(view, z, cw, ch){
  const w = Math.abs(z.x1 - z.x0), h = Math.abs(z.y1 - z.y0), x = Math.min(z.x0, z.x1), y = Math.min(z.y0, z.y1);
  const k = Math.min(cw/w, ch/h), s2 = Math.min(32, view.s*k);
  const ix = (x + w/2 - view.ox)/view.s, iy = (y + h/2 - view.oy)/view.s;
  return { s: s2, ox: cw/2 - ix*s2, oy: ch/2 - iy*s2 };
}
// What a press at (px, py) in the pane takes of crop c: a handle, a side anywhere along it,
// the crop ('move') or the rest ('pan'); a finger's reach the wider.
export function hitTest(view, c, px, py, touch){
  const rad = touch ? 18 : 9;
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

/* ---- Intensity: the settings' defaults and fields ---- */
export const INT_DEF = { mode: 'percentile', pLo: 0.5, pHi: 99.5, ref: null, b: 0, c: 1, g: 1, def: true };
// Settings at their defaults (the reference aside, which they do not reset).
export const isIntDef = I => ['mode', 'pLo', 'pHi', 'b', 'c', 'g'].every(k=> I[k] === INT_DEF[k]);
export const isAdjDef = a => !a || ['b', 'c', 'g'].every(k=> a[k] === ADJ_DEF[k]);
export const ADJ_DEF = { b: 0, c: 1, g: 1 };
// The fields, with the range each takes; a value outside it is refused (the field
// shakes and shows the last good one).
export const INT_FIELDS = { semPLo: ['pLo', 0, 49.9], semPHi: ['pHi', 50.1, 100], semB: ['b', -100, 100], semC: ['c', 0.05, 20], semG: ['g', 0.05, 20] };
export const ADJ_FIELDS = { semBi: ['b', -100, 100], semCi: ['c', 0.05, 20], semGi: ['g', 0.05, 20] };
// The level below which a share q of the crop's pixels lie.
export function levelAt(st, q){
  const t = q*st.n; let acc = 0;
  for (let v = 0; v < 65535; v++){ acc += st.hist[v]; if (acc > t) return v; }
  return 65534;
}
// The crop's histogram in 256 bins (the editor's, under its curve).
export function histBins(st){
  const bins = new Float64Array(256);
  for (let v = 0; v < 65535; v++) bins[v >> 8] += st.hist[v];
  return bins;
}

/* ---- Intensity: the curve of an image ----
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
export const usesRef = I => I.mode === 'meansd' || I.mode === 'hist';
// The reference: the image chosen, else the first loaded.
export const refFile = (S, I = S.intensity) => S.allFiles.find(f=> f.raw.id === I.ref) || S.allFiles[0] || null;
// The settings an image goes through: its group's own, else those of all groups.
export const intOf = (S, f) => { const g = groupOf(S, f); return g && S.groupInt[g.id] || S.intensity; };
// An image that is the reference of settings in use (all groups', or a group's own)
// that use one (marked ◎ on its thumbnail).
export const isRef = (S, f) => [S.intensity, ...Object.values(S.groupInt)].some(I=> usesRef(I) && refFile(S, I) === f);
/* The normalisation of an image: { lo, hi }, the levels taken to black and white
   (linear), or { table }, each level's value on 0–1 (the histogram's). */
export function normOf(U, S, f){
  const I = intOf(S, f), m = I.mode;
  if (m === 'none') return { lo: 0, hi: 65535 };
  const st = U.statsOf(f);
  if (m === 'percentile'){
    const lo = levelAt(st, I.pLo/100), hi = levelAt(st, I.pHi/100);
    return { lo, hi: hi > lo ? hi : lo + 1 };
  }
  const rf = refFile(S, I), rs = rf ? U.statsOf(rf) : st;
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
/* The whole curve of an image, as the 8-bit grey of each of its levels, is made once for
   what it is made from, its key (lutKey: its crop's statistics, the reference's, the
   settings, its correction), and kept (sem.js lutOf). */
export function lutKey(S, f){
  const I = intOf(S, f), a = f.adj || ADJ_DEF, c = f.crop, rf = usesRef(I) ? refFile(S, I) : null;
  return `${f.raw.id}|${I.mode === 'none' ? '' : `${c.x},${c.y},${c.w},${c.h}`}|${I.mode}|${I.mode === 'percentile' ? `${I.pLo},${I.pHi}` : ''}|`
    + `${rf ? `${rf.raw.id}:${rf.crop.x},${rf.crop.y},${rf.crop.w},${rf.crop.h}` : ''}|${I.b},${I.c},${I.g}|${a.b},${a.c},${a.g}`;
}
export function makeLut(U, S, f){
  const nm = normOf(U, S, f), a = f.adj || ADJ_DEF, I = intOf(S, f);
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

/* ---- The scope of the settings ----
   The images the settings apply to (the selector over the thumbnails): All, every image
   alike (`intensity`); or the groups, each its own (groupInt), the one shown being the
   group of the image in the editor. Going from All to the groups, every group starts from
   All's settings; going back, All takes the settings of the group on show. Nothing jumps
   either way. */
export const scopeOf = S =>{
  if (!Object.keys(S.groupInt).length) return 'all';
  const g = S.files[S.cur] && groupOf(S, S.files[S.cur]);
  return g ? g.id : 'all';
};
// The images the selector chose (Link all's).
export const scopeFiles = S =>{ const sc = scopeOf(S); return S.files.filter(f=> sc === 'all' || (groupOf(S, f) && groupOf(S, f).id === sc)); };
// The settings the fields edit (a group made since the switch starts from All's).
export function edited(S){
  const sc = scopeOf(S);
  if (sc === 'all') return S.intensity;
  return S.groupInt[sc] || (S.groupInt[sc] = { ...S.intensity });
}
// The selector set to `to` ('all' or a group's id). Shown: the group's image nearest in the
// list, the one in the editor if it is in it.
export function setScope(S, to){
  const sc = scopeOf(S);
  if (to === 'all'){
    if (sc !== 'all'){ S.intensity = { ...edited(S) }; S.groupInt = {}; }
  } else {
    if (sc === 'all') S.groups.forEach(g=>{ S.groupInt[g.id] = { ...S.intensity }; });
    const g = S.groups.find(g=> g.id === to), i = S.files.findIndex(f=> g && groupOf(S, f) === g);
    if (i >= 0 && groupOf(S, S.files[S.cur]) !== g) S.cur = i;
  }
}

/* ---- The linked crop ---- */
// Every linked image takes the one just set.
export function propagate(U, S, f){
  if (!f.linked) return;
  S.allFiles.forEach(g=>{ if (g !== f && g.linked) takeCrop(U, g, f.crop, f.aspect); });
}
// Linking an image: it takes the crop the linked ones share, if any; else it is the
// first, and the others will take its. Unlinked, it keeps the crop it has.
export function setLinked(U, S, f, on){
  f.linked = on;
  if (f.linked){
    const lead = S.allFiles.find(g=> g !== f && g.linked);
    if (lead) takeCrop(U, f, lead.crop, lead.aspect);
  } else f.clamped = false;
}
// Link all: the images the selector chose (fs), around the crop of the one in the editor
// (f, it leads); all of them linked already, it unlinks them.
export function linkAll(U, S, f, fs){
  if (fs.every(g=> g.linked)) fs.forEach(g=>{ g.linked = false; g.clamped = false; });
  else {
    // Others linked outside the chosen images follow the lead too: one linked crop.
    S.allFiles.forEach(g=>{ if (g.linked && !fs.includes(g)) g.linked = false; });
    f.linked = true;
    fs.forEach(g=>{ if (g !== f){ g.linked = true; takeCrop(U, g, f.crop, f.aspect); } });
  }
}
export const linkAllText = fs => fs.length && fs.every(g=> g.linked) ? 'Unlink all' : 'Link all';

/* ---- Alerts ----
   A line's alerts (sem.js: by its line of history, the last 32 lines'): { bad: { names
   (markup), ids } | null, dup: [{ id, html }], warn: [{ id, html }] }. */
export const NO_ALERTS = { bad: null, dup: [], warn: [] };
export const alertsNow = S => S.alertsOf.get(S.line) || NO_ALERTS;
export function setAlerts(S, a){
  const now = { ...alertsNow(S), ...a };
  S.alertsOf.delete(S.line);
  if (now.bad || now.dup.length || now.warn.length) S.alertsOf.set(S.line, now);
  if (S.alertsOf.size > 32) S.alertsOf.delete(S.alertsOf.keys().next().value);
}
// An image removed from the list: what was said about it goes.
export function dropAlertsOf(S, id){
  const A = alertsNow(S), ids = A.bad ? A.bad.ids.filter(x=> x !== id) : [];
  setAlerts(S, { dup: A.dup.filter(a=> a.id !== id), warn: A.warn.filter(a=> a.id !== id), bad: ids.length ? { ...A.bad, ids } : null });
}

/* ---- The list ---- */
// A file read (r: its header; raw: its RawRef) as the list holds it: its default crop.
export function newFile(name, r, raw){
  const crop = defaultCrop(r);
  return { name, label: r.name, raw, crop, aspect: aspectOf(crop.w, crop.h), cropDef: true, linked: false, clamped: false, adjDef: true, ...(r.squared ? { sq: true } : {}) };
}
// The list's rows: its download gives a file's bytes (rawBytes).
export const listView = S => S.allFiles.map(f=> ({ name: f.name, label: f.label, included: f.included, get rawBytes(){ return f.raw.bytes; } }));

/* ---- Groups and scale: the rules ---- */
// Two images within 10 % of pixel size are in one group.
export const GROUP_TOL = 1.10;
// The reference is always one of the figure's images (v442: no reference kept out).
export const inFigure = f => f.included !== false;
export const pixelOf = (U, f) => { const r = U.info(f); return r ? r.pixelNm : NaN; };
// The groups' box is 4φ : 1 at full screen (sem.js sizeGroups).
export const PHI4 = 4*(1 + Math.sqrt(5))/2;

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
export const byId = (S, id) => S.allFiles.find(f=> f.raw.id === id);
export const groupOf = (S, f) => S.groups.find(g=> g.members.includes(f.raw.id)) || null;
// A group's images in the figure: they alone decide its name, its scale, its place
// and where a new image goes. An excluded image stays a member, so that it comes back
// where it was when included again, but decides nothing while the group has images in
// the figure (to v476 it still named the group, ordered it, and kept out of it a new
// image the others had room for).
export const inGroup = (U, S, g) => g.members.map(id=> byId(S, id)).filter(f=> f && inFigure(f) && U.info(f));
// A group's name: the magnification of its image in the figure with the largest
// pixel size, the one its common scale brings the others to (a group whose images are
// all excluded, not shown, by theirs).
export function groupName(U, S, ids){
  const fs = ids.map(id=> byId(S, id)).filter(f=> f && U.info(f)), inc = fs.filter(inFigure);
  const r = (inc.length ? inc : fs).map(f=> U.info(f)).sort((a, b)=> b.pixelNm - a.pixelNm)[0];
  return r ? magText(r) || `${sig(r.pixelNm, 3)} nm/px` : 'group';
}
export const newGroupId = S =>{ let k = 1; while (S.groups.some(g=> g.id === 'g' + k)) k++; return 'g' + k; };
// An image into the group whose pixel sizes (its images' in the figure) it stays
// within 10 % of, else one whose images are all excluded, by theirs, so that images
// near in scale stay together when those come back, else a new one (never into an
// empty group: it has no pixel size to be near).
export function placeImage(U, S, f){
  const p = pixelOf(U, f), fits = m =>{ const ps = m.map(x=> pixelOf(U, x)).concat(p); return Math.max(...ps)/Math.min(...ps) <= GROUP_TOL; };
  const g = S.groups.find(g=>{ const m = inGroup(U, S, g); return m.length && fits(m); })
    || S.groups.find(g=>{ const m = g.members.map(id=> byId(S, id)).filter(m=> m && U.info(m)); return !inGroup(U, S, g).length && m.length && fits(m); });
  if (g) g.members.push(f.raw.id);
  else S.groups.push({ id: newGroupId(S), name: '', named: false, mode: 'common', members: [f.raw.id] });
}
// The groups kept in step with the images: gone ones dropped, new ones placed, groups
// left empty removed unless made with + Group (and not filled since) or emptied by
// dragging, unnamed ones named after their images.
export function syncGroups(U, S){
  const ids = new Set(S.allFiles.map(f=> f.raw.id));
  S.groups.forEach(g=>{ g.members = g.members.filter(id=> ids.has(id)); });
  const placed = new Set(S.groups.flatMap(g=> g.members));
  // The included first: an excluded image never decides where they go.
  [...S.allFiles.filter(inFigure), ...S.allFiles.filter(f=> !inFigure(f))].forEach(f=>{ if (!placed.has(f.raw.id) && U.info(f)) placeImage(U, S, f); });
  // With no image left in the list (Remove all, or the last one removed) the groups
  // made or emptied by hand go too: unseen while there is none, they came back empty
  // with the next files (to v476).
  S.groups = S.groups.filter(g=> g.members.length || g.keep && ids.size);
  tidyGroups(U, S);
  // Lowest magnification first (by the images in the figure, else, for a group of
  // excluded ones, by theirs); empty groups last, in the order they were made.
  const px = g =>{ const m = inGroup(U, S, g); return m.length ? pixelOf(U, m[0]) : g.members.length ? pixelOf(U, byId(S, g.members[0])) : -1; };
  S.groups.sort((a, b)=> px(b) - px(a));
}
// Names, and what goes with a group that is gone (its figure, its intensity).
export function tidyGroups(U, S){
  S.groups.forEach(g=>{ if (!g.named && g.members.length) g.name = groupName(U, S, g.members); });
  for (const o of [S.figures, S.groupInt]) for (const k of Object.keys(o)) if (!S.groups.some(g=> g.id === k)) delete o[k];
}
// A group's name typed: emptied, it goes back to the images' magnification.
export function renameGroup(U, S, g, value){
  const v = value.trim();
  g.named = !!v; g.name = v || (g.members.length ? groupName(U, S, g.members) : 'New group');
}
// + Group: an empty group, to drag images into.
export const addGroup = S => S.groups.push({ id: newGroupId(S), name: 'New group', named: false, mode: 'common', members: [], keep: true });
// An empty group removed (one that holds images is not).
export function dropGroup(U, S, id){
  S.groups = S.groups.filter(g=> g.id !== id || g.members.length);
  tidyGroups(U, S);
}
/* An image into another group, or into a new one ('new'). A group it leaves empty
   stays, with its name and figure, until removed; one it goes into holds images now,
   and goes when they are removed from the file list (to v476 a group made with
   + Group, or emptied by dragging, stayed for good). Whether it moved. */
export function moveImage(U, S, id, to){
  const from = S.groups.find(g=> g.members.includes(id));
  if (!from || from.id === to) return false;
  // Alone in its group's figure (an excluded image beside it decides nothing), it
  // would only make the same group again.
  if (to === 'new' && inGroup(U, S, from).length === 1) return false;
  const into = to === 'new' ? { id: newGroupId(S), name: '', named: false, mode: 'common', members: [] } : S.groups.find(g=> g.id === to);
  if (!into) return false;
  from.members = from.members.filter(m=> m !== id);
  if (!from.members.length) from.keep = true;
  delete into.keep;
  into.members.push(id);
  if (to === 'new') S.groups.push(into);
  tidyGroups(U, S);
  return true;
}
// Reset: the groups made again from the pixel sizes. A group made again with the same
// images keeps its figure and its intensity.
export function regroup(U, S){
  const key = g => g.members.slice().sort().join('|');
  const oldFig = new Map(S.groups.map(g=> [key(g), S.figures[g.id]])), oldInt = new Map(S.groups.map(g=> [key(g), S.groupInt[g.id]]));
  S.groups = [];
  const keptFig = {}, keptInt = {};
  syncGroups(U, S);
  S.groups.forEach(g=>{ const f = oldFig.get(key(g)), i = oldInt.get(key(g)); if (f) keptFig[g.id] = f; if (i) keptInt[g.id] = i; });
  S.figures = keptFig; S.groupInt = keptInt;
}
/* What the figure takes from an image (null when it is not in the figure):
   { c (the crop, narrowed to the group's field), px (nm a pixel), w, h (its size in
   the figure's pixels) }. */
export function outOf(U, S, f){
  if (!inFigure(f)) return null;
  const g = groupOf(S, f), r = U.info(f);
  if (!g || !r) return null;
  if (g.mode === 'own') return { c: { ...f.crop }, px: r.pixelNm, w: f.crop.w, h: f.crop.h };
  const mem = g.members.map(id=> byId(S, id)).filter(m=> m && inFigure(m) && U.info(m));
  const pT = Math.max(...mem.map(m=> pixelOf(U, m)));
  const fovW = Math.min(...mem.map(m=> m.crop.w*pixelOf(U, m))), fovH = Math.min(...mem.map(m=> m.crop.h*pixelOf(U, m)));
  const p = r.pixelNm, w = Math.min(f.crop.w, Math.round(fovW/p)), h = Math.min(f.crop.h, Math.round(fovH/p));
  const c = { x: f.crop.x + Math.floor((f.crop.w - w)/2), y: f.crop.y + Math.floor((f.crop.h - h)/2), w, h };
  return { c, px: pT, w: Math.max(1, Math.round(fovW/pT)), h: Math.max(1, Math.round(fovH/pT)) };
}
/* A group's images in its figure (sem-figure.js), in the file list's order, each as the
   figure takes it: its group, its size in the figure's pixels, and a key that changes
   whenever its pixels would (its narrowed crop, the curve and what the curve is computed
   from), so that it is drawn again only then; its canvas drawn by canvasOf(f, fit). */
export function figureImages(U, S, gid, canvasOf){
  return S.files.filter(f=> inFigure(f) && groupOf(S, f) && groupOf(S, f).id === gid).map(f=>{
    const o = outOf(U, S, f), g = groupOf(S, f), I = intOf(S, f), rf = refFile(S, I), refKey = usesRef(I) && rf ? `${rf.raw.id}:${JSON.stringify(rf.crop)}` : '';
    if (!o || !g) return null;
    return { id: f.raw.id, label: f.label, group: { id: g.id, name: g.name, mode: g.mode }, w: o.w, h: o.h, pxNm: o.px,
      key: JSON.stringify([o, I, f.adj || ADJ_DEF, refKey]), canvas: fit => canvasOf(f, fit) };
  }).filter(Boolean);
}

/* ---- The state saved ---- */
export function snapshotOf(S){
  return { files: S.allFiles.map(f=> ({ ...f, crop: { ...f.crop }, adj: { ...(f.adj || ADJ_DEF) } })), cur: S.cur, intensity: { ...S.intensity },
    groupInt: JSON.parse(JSON.stringify(S.groupInt)),
    groups: S.groups.map(g=> ({ ...g, members: g.members.slice() })), figures: JSON.parse(JSON.stringify(S.figures)) };
}

/* ---- A state put back: what it is checked against ---- */
export const MODES = ['none', 'percentile', 'meansd', 'hist'];
export const ID_RE = /^[0-9a-f]{8}-\d+$/;
export const isNum = v => typeof v === 'number' && Number.isFinite(v);
export const inRange = (v, lo, hi, d) => isNum(v) && v >= lo && v <= hi ? v : d;
export const isKey = k => typeof k === 'string' && k !== '' && !(k in Object.prototype);
const str = (v, d) => typeof v === 'string' ? v : d;
// Settings: those saved before the Default boxes (v442) are default where their
// values are; a Default ticked over other values is unticked.
export function intensityOf(U, v){
  const o = U.isObj(v) ? v : {}, I = { ...INT_DEF };
  if (MODES.includes(o.mode)) I.mode = o.mode;
  for (const [k, lo, hi] of Object.values(INT_FIELDS)) I[k] = inRange(o[k], lo, hi, INT_DEF[k]);
  I.ref = typeof o.ref === 'string' ? o.ref : null;
  I.def = typeof o.def === 'boolean' ? o.def && isIntDef(I) : isIntDef(I);
  return I;
}
/* A state put back (sem.js restore: an undo's, a project's opened or read in): what it
   holds taken as the module would have made it, whatever the project says (a project file
   edited by hand or damaged): to v487 a crop, an index or a setting that was not a number
   went in as it was, and the views drew NaN.
   - an image: its bytes (an array; the base64 of a project of v517 or before, read
     into one) and an id of the form hashBytes gives for bytes of their length (else
     made from them), once (a second entry of one id is dropped), its bytes those
     another tab holds where one does (U.rawOf); strings for its name and label; its
     crop whole pixels inside the image, at least MIN_CROP a side, else the default
     one; its ratio one of the locks; its correction within the fields' ranges; its
     Default boxes ticked only where the crop and correction are the defaults;
   - the settings: a normalisation of the four, numbers within the fields' ranges,
     else the defaults;
   - the groups: ids that are names (no key of a plain object's own), once, each image
     in one group, a scale of the two; the index of the image shown at least 0.
   Written into S in this order: allFiles, intensity, groupInt, groups, figures. Gives the
   names of the images whose bytes no longer read (left out of the list), and the index of
   the image shown. It decodes none of the images (U.info: their headers). */
export function restoreInto(U, S, s){
  if (!U.isObj(s)) s = {};
  const seen = new Set(), lost = [];
  S.allFiles = [];
  for (const f0 of Array.isArray(s.files) ? s.files : []){
    if (!U.isObj(f0)) continue;
    const name = str(f0.name, 'image'), raw0 = f0.raw, raw = rawIn(U, raw0);
    if (raw === null){ lost.push(name); continue; }
    if (seen.has(raw.id)) continue;
    const f = { ...f0, name, label: str(f0.label, name), raw: U.rawOf(raw.id, raw.bytes, raw0) };
    const r = U.info(f);
    if (!r){ lost.push(name); continue; }
    seen.add(raw.id);
    fileIn(U, f, f0, r);
    S.allFiles.push(f);
  }
  S.intensity = intensityOf(U, s.intensity);
  S.groupInt = {};
  if (U.isObj(s.groupInt)) for (const [k, v] of Object.entries(s.groupInt)) if (isKey(k)) S.groupInt[k] = intensityOf(U, v);
  S.groups = [];
  groupsIn(U, s.groups, S.groups);
  S.figures = {};
  figuresIn(U, s, S.groups, S.figures);
  return { lost, cur: Number.isInteger(s.cur) && s.cur > 0 ? s.cur : 0 };
}
// A file's bytes and their id as a state holds them ({ id, bytes }, or { id, b64 } to
// v517), the id made from them where it is not one of theirs; null where there are none.
function rawIn(U, raw0){
  let bytes = null;
  if (U.isObj(raw0)){
    if (raw0.bytes instanceof Uint8Array) bytes = raw0.bytes;
    else if (typeof raw0.b64 === 'string'){ try { bytes = fromB64(raw0.b64); } catch(err){ bytes = null; } }
  }
  let id = bytes ? raw0.id : null;
  if (bytes && !(typeof id === 'string' && ID_RE.test(id) && +id.slice(9) === bytes.length)) id = hashBytes(bytes);
  return id === null ? null : { id, bytes };
}
// An image's flags, crop, ratio and correction (f: f0 with its name, label and bytes; r
// its header).
function fileIn(U, f, f0, r){
  for (const k of ['linked', 'clamped']) f[k] = f0[k] === true;
  if (f0.included !== false) delete f.included;
  if ('held' in f && !U.isObj(f.held)) delete f.held;
  // The crop: in the image's pixels; one saved (to v487) on an image whose pixels are
  // made square now was in the pixels as acquired: brought to the square ones.
  const c0 = U.isObj(f0.crop) ? f0.crop : {};
  let crop = ['x', 'y', 'w', 'h'].every(k=> isNum(c0[k])) ? { x: c0.x, y: c0.y, w: c0.w, h: c0.h } : defaultCrop(r);
  if (r.squared && f0.sq !== true){
    const q = r.squared, kx = r.width/q.width, ky = r.imageH/q.imageH;
    crop = f0.cropDef === true ? defaultCrop(r) : { x: crop.x*kx, y: crop.y*ky, w: crop.w*kx, h: crop.h*ky };
    f.aspect = null;
  }
  if (r.squared) f.sq = true; else delete f.sq;
  f.crop = validCrop(crop, r) ? crop : fitCrop(crop, r.width, r.imageH, null);
  if (!Object.keys(ASPECTS).includes(f.aspect)) f.aspect = aspectOf(f.crop.w, f.crop.h);
  const a0 = U.isObj(f0.adj) ? f0.adj : {};
  f.adj = { b: inRange(a0.b, -100, 100, 0), c: inRange(a0.c, 0.05, 20, 1), g: inRange(a0.g, 0.05, 20, 1) };
  f.cropDef = typeof f0.cropDef === 'boolean' ? f0.cropDef && isDefaultCrop(U, f) : isDefaultCrop(U, f);
  f.adjDef = typeof f0.adjDef === 'boolean' ? f0.adjDef && isAdjDef(f.adj) : isAdjDef(f.adj);
}
// The groups (into `groups`): ids that are names, once; each image in one group.
function groupsIn(U, list, groups){
  const gids = new Set(), placed = new Set();
  for (const g0 of Array.isArray(list) ? list : []){
    if (!U.isObj(g0) || !isKey(g0.id) || gids.has(g0.id)) continue;
    gids.add(g0.id);
    const members = (Array.isArray(g0.members) ? g0.members : []).filter(m=> typeof m === 'string' && !placed.has(m) && !!placed.add(m));
    const g = { ...g0, name: str(g0.name, ''), named: g0.named === true, mode: g0.mode === 'own' ? 'own' : 'common', members };
    // Only an empty group is kept by hand: a state saved to v476 also kept, for good,
    // one filled since (made with + Group, or emptied by dragging, then filled).
    if (g0.keep === true && !members.length) g.keep = true; else delete g.keep;
    groups.push(g);
  }
}
// The figures, by group (into `figures`). A project saved before v440 had one figure for
// all the groups: each group starts from it, its file named after the group.
function figuresIn(U, s, groups, figures){
  if (U.isObj(s.figures)) for (const [k, v] of Object.entries(JSON.parse(JSON.stringify(s.figures)))) if (isKey(k) && U.isObj(v)) figures[k] = v;
  if (!s.figures && U.isObj(s.figure)) for (const g of groups){ const f = JSON.parse(JSON.stringify(s.figure)); delete f.file; figures[g.id] = f; }
}

/* ---- What it shows beside its state (sem.js shows, showNext) ---- */
// The image on show, by its id, and the editor's zoom.
export function showsOf(S){
  const f = S.files[S.cur], ed = S.ed;
  return f || ed ? { ...(f ? { img: f.raw.id } : {}), ...(ed ? { ed: { ...ed } } : {}) } : null;
}
// Given back as the tab wakes or the page is reloaded: { ed, img }, each null where none.
export function nextOf(v){
  const e = v && v.ed;
  const ed = e && typeof e.id === 'string' && [e.k, e.cx, e.cy].every(Number.isFinite) && e.k > 0 ? { id: e.id, k: e.k, cx: e.cx, cy: e.cy } : null;
  return { ed, img: v && typeof v.img === 'string' ? v.img : null };
}

/* ---- CSV: each image's metadata and crop ---- */
const CSV_HEAD = ['file', 'sample', 'magnification', 'pixel_size_nm', 'field_of_view_um', 'HV_kV', 'WD_mm', 'detector', 'detector_gain', 'detector_offset', 'date', 'time',
  'image_width_px', 'image_height_px', 'info_bar_rows', 'crop_x_px', 'crop_y_px', 'crop_width_px', 'crop_height_px', 'crop_width_um', 'crop_height_um',
  'crop_mean_level', 'crop_sd_level', 'crop_saturated_pct', 'intensity_settings', 'normalisation', 'reference', 'black_level', 'white_level', 'brightness_pct', 'contrast', 'gamma',
  'group', 'scale', 'figure_x_px', 'figure_y_px', 'figure_width_px', 'figure_height_px', 'figure_pixel_nm', 'figure_out_width_px', 'figure_out_height_px'];
export function csvOf(U, S){
  if (!S.files.length) return [];
  let t = U.csvLine(CSV_HEAD);
  S.files.forEach(f=>{
    const r = U.info(f); if (!r) return;
    t += U.csvLine(csvRow(U, S, f, r));
  });
  return [{ name: 'sem_images.csv', text: t }];
}
function csvRow(U, S, f, r){
  const { fmtNum } = U;
  const c = f.crop, um = v => fmtNum(v*r.pixelNm/1000, 6);
  // The curve as applied: the levels a linear normalisation takes to black and white
  // (none for the histogram's), and brightness, contrast and gamma with the image's
  // correction in them.
  const st = U.statsOf(f), nm = normOf(U, S, f), a = f.adj || ADJ_DEF, I = intOf(S, f), rf = refFile(S, I), g = groupOf(S, f);
  return [f.name, f.label, fmtNum(r.mag, 6), fmtNum(r.pixelNm, 6), fmtNum(r.fovUm, 6), fmtNum(r.kV, 4), fmtNum(r.wdMm, 4), r.detector, fmtNum(r.gain, 5), fmtNum(r.offset, 5), r.date, r.time,
    r.width, r.imageH, r.strip, c.x, c.y, c.w, c.h, um(c.w), um(c.h),
    fmtNum(st.mean, 1), fmtNum(st.sd, 1), fmtNum(100*(c.w*c.h - st.n)/(c.w*c.h), 3), g && S.groupInt[g.id] ? 'group' : 'all groups', I.mode, usesRef(I) && rf ? rf.label : '',
    nm.table ? '' : fmtNum(nm.lo, 1), nm.table ? '' : fmtNum(nm.hi, 1), fmtNum(I.b + a.b, 3), fmtNum(I.c*a.c, 4), fmtNum(I.g*a.g, 4),
    // In its group: the part of the original the figure takes, and its size there
    // (empty for a reference kept out of the figure).
    ...(()=>{ const o = outOf(U, S, f), g = groupOf(S, f); return o ? [g.name, g.mode, o.c.x, o.c.y, o.c.w, o.c.h, fmtNum(o.px, 6), o.w, o.h] : ['', '', '', '', '', '', '', '', '']; })()];
}
