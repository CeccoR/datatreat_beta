import { colorPickerUI, esc } from './utils.js';
import { FONTS, PX_MM, PT_PX, alignPicker, ALIGN_ICON, GRIP, contrastInk, openComposer, closeComposer, renderPreview, rebuildControls,
  controlsEl, rebuilding, numField, num, chk, sel, autoNum, readNum, wireRowDrag } from './figure.js';

/* =========================================================
   SEM FIGURE
   The SEM images laid out for a paper: a kind of figure of the figure composer
   (figure.js openComposer), as the plots are the other. The composer gives the modal,
   the preview in real millimetres with its zoom and pan, the field kit, the rows
   dragged by their handles, the exports (SVG with the images in it, PNG at the chosen
   dpi on the figure's background, the clipboard) and one composer open at a time; this
   gives the figure: its settings, layout, drawing and controls. No axes and no legend:
   a grid of image panels, each with its sample's name, optionally a letter, and the
   scale bars.

   The page is set freely; with auto margins the images are as large as it allows, what
   lies outside them (names, letters, bars) in the margins, the whole centred; without,
   the plot (the smallest rectangle round the images) is set and aligned by hand. The
   grid is the most compact rectangle for the images (columns ⌈√N⌉, rows ⌈N/cols⌉: 12
   images 4 × 3, not 6 × 2) unless set by hand, in two levels: panels of images (2 × 1
   panels of 2 × 2 images hold eight), a gap between images and another between panels
   (in the code, blocks of panels).
   The panels follow the images' rows, which their handles reorder. Names go where
   there is room (outside above the first row, below the last, inside between) or where
   set; letters and scale bars in 8 places (inside or outside, top or bottom, left or
   right). What is outside goes in bands kept the same along a row or column, so that
   the grid stays aligned. A group at common scale has one scale bar, in its last panel,
   or one a panel; at its own scale every panel has its own. A bar's length is a round
   1, 2 or 5 × 10ⁿ near a fifth of the panel unless typed. The images come in their
   figure's pixels (sem.js outCanvas): a reduced copy for the preview, the full one for
   the export.

   One figure a group (sem.js): its images, and its settings, which are the SEM module's
   (saved with the project, undone with it): the host gives them (getFig) and takes them
   back (setFig) after every change (commit).
========================================================= */

const MM_PT = 25.4/72;
/* label: the names. auto places them by row (or column, written upright): the first
   outside above (left), the last outside below (right), the rows between inside, at
   the top for the first half and the middle one, at the bottom for the second. orient
   h (along the image) or v (upright); ha, va where on the image; pos in or out.
   letter and bar: pos in or out, va top or bottom, ha left or right (8 places). */
const FIG_DEF = {
  file: 'SEM_figure', wmm: 175, hmm: null, dpi: 600, bg: '#ffffff',
  plotAuto: true, plotW: 0, plotH: 0, plotBy: 'w', align: 'cc',
  gridAuto: true, rows: 1, cols: 1, gap: 1, bRows: 1, bCols: 1, bGap: 4,
  order: [], names: {},
  label: { on: true, auto: true, orient: 'h', ha: 'left', va: 'top', pos: 'out', size: 8 },
  letter: { on: false, style: '(a)', link: false, pos: 'in', va: 'top', ha: 'left', size: 9 },
  bar: { each: false, pos: 'in', va: 'bottom', ha: 'right', thick: 0.7, size: 7 },
  bars: {},
  ink: '#ffffff', outline: true, outlineColor: null, font: 'Inter',
};
const CORNER = { tl: ['top', 'left'], tr: ['top', 'right'], bl: ['bottom', 'left'], br: ['bottom', 'right'] };
// The settings filled with the defaults wherever a project lacks them; those of
// v439–v448 (a corner or a side as one position, a height from the layout) read anew.
// (A corner is one of CORNER's own keys: 'toString' or 'constructor' as a position, in
// a damaged project, threw here, and the figure did not open, to v487.)
const isCorner = p => typeof p === 'string' && Object.prototype.hasOwnProperty.call(CORNER, p);
function withDefaults(f){
  const o = { ...FIG_DEF, ...(f || {}) };
  for (const k of ['label', 'letter', 'bar']) o[k] = { ...FIG_DEF[k], ...((f || {})[k] || {}) };
  // (an order that is not a list, 5 or {}, threw on slice, to v487)
  o.order = Array.isArray(f && f.order) ? f.order.slice() : []; o.names = { ...(f && f.names || {}) }; o.bars = { ...(f && f.bars || {}) };
  const old = f && f.label && f.label.pos;
  if (old && !['in', 'out'].includes(old)){
    const L = o.label; L.auto = false; L.orient = 'h';
    if (isCorner(old)){ L.pos = 'in'; [L.va, L.ha] = CORNER[old]; }
    else if (old === 'above' || old === 'below'){ L.pos = 'out'; L.va = old === 'above' ? 'top' : 'bottom'; L.ha = 'left'; }
    else { L.pos = 'out'; L.orient = 'v'; L.ha = old; L.va = 'center'; }
  }
  for (const k of ['letter', 'bar']){
    const p = f && f[k] && f[k].pos;
    if (!p || ['in', 'out'].includes(p)) continue;
    const X = o[k];
    if (isCorner(p)){ X.pos = 'in'; [X.va, X.ha] = CORNER[p]; }
    else { X.pos = 'out'; X.va = p === 'below' ? 'bottom' : 'top'; X.ha = k === 'bar' ? 'right' : 'left'; if (p === 'left' || p === 'right'){ X.va = 'bottom'; X.ha = p; } }
  }
  if (/^m/.test(o.align || '')) o.align = 'c' + o.align[1];   // v449 wrote the middle row as m
  if (f && f.hAuto === false && f.hmm > 0) o.hmm = f.hmm;
  else if (f && 'hAuto' in f) o.hmm = null;
  delete o.hAuto;
  return sane(o);
}
/* The settings as the composer can draw them, whatever a project holds (a file edited
   by hand or damaged): each number a number within its field's range (wider for those
   the layout also sets: the grid's counts, the height, the plot), each choice one of
   its options, each box true or false, else the default; the order, names and bar
   lengths as the controls write them. To v487 they went in as they were: a width that
   was not a number drew the figure as NaN. */
const RANGES = { wmm: [10, 1000], dpi: [50, 4800], plotW: [0, 1e5], plotH: [0, 1e5], rows: [1, 1e4], cols: [1, 1e4], gap: [0, 20], bRows: [1, 1e4], bCols: [1, 1e4], bGap: [0, 40],
  'label.size': [3, 36], 'letter.size': [3, 36], 'bar.thick': [0.1, 5], 'bar.size': [3, 36] };
const CHOICES = { bg: ['#ffffff', '#000000'], plotBy: ['w', 'h'], align: ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'],
  'label.orient': ['h', 'v'], 'label.ha': ['left', 'center', 'right'], 'label.va': ['top', 'center', 'bottom'], 'label.pos': ['in', 'out'],
  'letter.style': ['a', '(a)', 'A', '(A)'], 'letter.pos': ['in', 'out'], 'letter.va': ['top', 'bottom'], 'letter.ha': ['left', 'right'],
  'bar.pos': ['in', 'out'], 'bar.va': ['top', 'bottom'], 'bar.ha': ['left', 'right'] };
const FLAGS = ['plotAuto', 'gridAuto', 'outline', 'label.on', 'label.auto', 'letter.on', 'letter.link', 'bar.each'];
const COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
function sane(o){
  const at = p => p.split('.').reduce((x, k)=> x[k], o), def = p => p.split('.').reduce((x, k)=> x[k], FIG_DEF);
  const set = (p, v)=>{ const ks = p.split('.'), last = ks.pop(); ks.reduce((x, k)=> x[k], o)[last] = v; };
  for (const [p, [lo, hi]] of Object.entries(RANGES)){ const v = at(p); if (!(typeof v === 'number' && v >= lo && v <= hi)) set(p, def(p)); }
  for (const k of ['rows', 'cols', 'bRows', 'bCols']) o[k] = Math.round(o[k]);
  if (o.hmm !== null && !(typeof o.hmm === 'number' && o.hmm > 0 && o.hmm <= 1e5)) o.hmm = null;
  for (const [p, opts] of Object.entries(CHOICES)) if (!opts.includes(at(p))) set(p, def(p));
  for (const p of FLAGS) if (typeof at(p) !== 'boolean') set(p, def(p));
  if (typeof o.file !== 'string') o.file = FIG_DEF.file;
  if (!Object.prototype.hasOwnProperty.call(FONTS, o.font)) o.font = FIG_DEF.font;
  if (!COLOR.test(o.ink)) o.ink = FIG_DEF.ink;
  if (o.outlineColor !== null && !COLOR.test(o.outlineColor)) o.outlineColor = null;
  o.order = Array.isArray(o.order) ? o.order.map(id=> typeof id === 'string' ? id : '') : [];
  for (const k of Object.keys(o.names)) if (typeof o.names[k] !== 'string') delete o.names[k];
  for (const [k, b] of Object.entries(o.bars)){
    if (!b || typeof b !== 'object' || typeof b.auto !== 'boolean' || !(typeof b.um === 'number' && b.um > 0 && b.um <= 100000)) delete o.bars[k];
  }
  return o;
}
const clone = v => JSON.parse(JSON.stringify(v));
const sig3 = v => String(+(+v).toPrecision(3));
// A length in µm as the bar reads it: nm under 1 µm.
const lenText = um => um >= 1 ? `${sig3(um)} µm` : `${sig3(um*1000)} nm`;
// The round length (1, 2 or 5 × 10ⁿ µm) nearest, on a log scale, to a fifth of a width.
function niceBar(widthUm){
  const t = widthUm*0.22;
  let best = null;
  for (let e = -4; e <= 4; e++) for (const m of [1, 2, 5]){
    const v = m*10**e, d = Math.abs(Math.log(v/t));
    if (!best || d < best.d) best = { v, d };
  }
  return best.v;
}
const letterOf = (k, style) => { const c = String.fromCharCode(97 + (k % 26)) + (k >= 26 ? Math.floor(k/26) : '');
  return style === 'A' ? c.toUpperCase() : style === '(A)' ? `(${c.toUpperCase()})` : style === 'a' ? c : `(${c})`; };
/* The open figure: its host and its settings, the layout of the last preview, the
   images' PNGs, an edit on its way to the module. At module level, which holds because
   the composer is open on one figure at a time (figure.js openComposer); taken when it
   opens, let go when it closes. */
let host = null, F = null, lastL = null;
let lastPlot = { w: 0, h: 0 };   // the plot of the last drawing (mm), for its locked fields
const urls = new Map();   // id → { key, url }: an image's PNG for the preview, made once while it does not change
let saveTimer = null;     // an edit not yet gone back to the module (commit)

// The images in panel order: the saved order, then any image not in it, in the file
// list's order.
/* The places of the grid in reading order, a panel (block) after another: the images
   in the saved order, null where a panel has room left (an image dragged out of a
   panel leaves its place empty). F.order holds the ids, '' for an empty place; an
   image not in it takes the first empty place, else goes last. */
function slotsOf(){
  const imgs = host.images(), byId = new Map(imgs.map(m=> [m.id, m]));
  const seen = new Set(), out = [];
  for (const id of F.order){
    if (!id){ out.push(null); continue; }
    if (byId.has(id) && !seen.has(id)){ out.push(byId.get(id)); seen.add(id); }
  }
  for (const m of imgs) if (!seen.has(m.id)){ const hole = out.indexOf(null); if (hole >= 0) out[hole] = m; else out.push(m); }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
// The images in the panels' order (an automatic grid packs them: no empty places).
function ordered(){ return slotsOf().filter(Boolean); }
const placesOf = ()=> F.gridAuto ? ordered() : slotsOf();
/* The grid: blocks (bRows × bCols) of panels (rows × cols each), filled block by block,
   in reading order. Automatic: one block, the most compact rectangle. By hand, blocks
   rows are added where the images would not fit. */
function gridOf(n){
  if (F.gridAuto){ const cols = Math.max(1, Math.ceil(Math.sqrt(n))); return { cols, rows: Math.max(1, Math.ceil(n/cols)), bRows: 1, bCols: 1 }; }
  const cols = Math.max(1, F.cols), rows = Math.max(1, F.rows), bCols = Math.max(1, F.bCols);
  return { cols, rows, bCols, bRows: Math.max(F.bRows, Math.ceil(n/(rows*cols*bCols))) };
}
/* An image's PNG: the preview's (520 px across) kept while it does not change; the
   export's, at the figure's pixels, made for that export and not kept (to b2 kept till
   the composer closed: a PNG of each image at full size, some 3 MB of text for 2048²). */
function urlOf(m, full){
  if (full){ const cv = m.canvas(0); return cv ? cv.toDataURL('image/png') : ''; }
  const c = urls.get(m.id);
  if (c && c.key === m.key) return c.url;
  const cv = m.canvas(520);
  const url = cv ? cv.toDataURL('image/png') : '';
  urls.set(m.id, { key: m.key, url });
  return url;
}

/* ---- Geometry (mm) ----
   The panels are a grid: blocks of panels, as visual rows and columns. What sits
   outside the images goes in bands: above and below each visual row, left and right of
   each column, each band as deep as the deepest thing it holds in that row or column,
   so that the grid stays aligned. The bands at the outer edges are the margins round
   the plot, the plot being the smallest rectangle round all the images.
   Auto margins: the images as large as the page (W × H) allows with the bands round
   them, the whole centred. Off: the plot is plotW × plotH, the images fitted in it,
   placed on the page by `align`. */
const lineOf = pt => pt*MM_PT*1.35;
const BAR_GAP = 0.4;   // between an image and a bar outside it
// The bar's box outside the image: the gap, the bar, its length's line.
const barBox = ()=> BAR_GAP + F.bar.thick + 0.3 + F.bar.size*MM_PT*1.05;
/* The name of the panel in row vr of the R rows of its block holding images, column vc
   of C: { v (upright), pos (in, out), va, ha }, or null. Auto: by row within the block
   (by column when upright). */
function nameAt(vr, R, vc, C){
  const L = F.label;
  if (!L.on && !(F.letter.on && F.letter.link)) return null;
  const v = L.orient === 'v';
  let pos = L.pos, va = L.va, ha = L.ha;
  if (L.auto){
    const i = v ? vc : vr, N = v ? C : R, first = i === 0, last = i === N - 1 && N > 1;
    pos = first || last ? 'out' : 'in';
    const near = first ? true : last ? false : i <= (N - 1)/2;   // the top (left) side
    if (v) ha = near ? 'left' : 'right'; else va = near ? 'top' : 'bottom';
  } else if (pos === 'out'){
    // Outside, a name is beside an edge: never across the middle.
    if (v && ha === 'center') ha = 'left';
    if (!v && va === 'center') va = 'top';
  }
  return { v, pos, va, ha };
}
// The letter, when it is placed on its own (not at the start of the name).
const letterOwn = ()=> F.letter.on && !F.letter.link;
/* What lies in the band on one side (top or bottom) of a panel: the name and letter on
   one line, the bar beside them, or on a line of its own (nearest the image) where it
   would meet them. { depth, text (line depth, 0: none), bar (its own line?) }. */
function bandOf(nm, side, hasBar){
  const name = nm && !nm.v && nm.pos === 'out' && nm.va === side ? nm : null;
  const letter = letterOwn() && F.letter.pos === 'out' && F.letter.va === side;
  const bar = hasBar && F.bar.pos === 'out' && F.bar.va === side;
  const text = Math.max(name ? lineOf(F.label.size) : 0, letter ? lineOf(F.letter.size) : 0);
  if (!bar) return { depth: text, text, bar: false, alone: false };
  const meets = (name && (name.ha === F.bar.ha || name.ha === 'center')) || (letter && F.letter.ha === F.bar.ha);
  const bb = barBox();
  return meets ? { depth: text + bb, text, bar: true, alone: true } : { depth: Math.max(text, bb), text, bar: true, alone: false };
}
function layout(){
  const places = placesOf(), imgs = places.filter(Boolean), G = gridOf(places.length), { rows, cols, bRows, bCols } = G;
  const slotOf = new Map(); places.forEach((m, i)=>{ if (m) slotOf.set(m.id, i); });
  const g = F.gap, bg = F.bGap, W = F.wmm;
  const per = rows*cols, R = rows*bRows, C = cols*bCols;
  const at = i => { const b = Math.floor(i/per), j = i % per, br = Math.floor(b/bCols), bc = b % bCols, r = Math.floor(j/cols), c = j % cols; return { b, r, c, vr: br*rows + r, vc: bc*cols + c }; };
  // Which panels carry a scale bar: every one at own scale or one a panel; else a
  // group's last.
  const lastOf = new Map();
  imgs.forEach(m=>{ lastOf.set(m.group.id, m.id); });
  const hasBar = m => m.group.mode === 'own' || F.bar.each || lastOf.get(m.group.id) === m.id;
  // The rows' depth over the image width, and the bands.
  const asp = new Array(R).fill(0), tb = new Array(R).fill(0), bb = new Array(R).fill(0), lb = new Array(C).fill(0), rb = new Array(C).fill(0);
  const pl = imgs.map(m=>{ const q = at(slotOf.get(m.id)); asp[q.vr] = Math.max(asp[q.vr], m.h/m.w); return q; });
  // First, last and middle count within a block, among its rows and columns that hold
  // images: each block's names are placed as if it stood alone.
  const inBlock = new Map();
  pl.forEach(q=>{ const e = inBlock.get(q.b) || { r: new Set(), c: new Set() }; e.r.add(q.r); e.c.add(q.c); inBlock.set(q.b, e); });
  for (const e of inBlock.values()){ e.r = [...e.r].sort((a, b)=> a - b); e.c = [...e.c].sort((a, b)=> a - b); }
  imgs.forEach((m, i)=>{
    const q = pl[i], e = inBlock.get(q.b), nm = nameAt(e.r.indexOf(q.r), e.r.length, e.c.indexOf(q.c), e.c.length), bar = hasBar(m);
    q.nm = nm; q.bar = bar; q.top = bandOf(nm, 'top', bar); q.bottom = bandOf(nm, 'bottom', bar);
    tb[q.vr] = Math.max(tb[q.vr], q.top.depth); bb[q.vr] = Math.max(bb[q.vr], q.bottom.depth);
    if (nm && nm.v && nm.pos === 'out'){ const d = lineOf(F.label.size); if (nm.ha === 'left') lb[q.vc] = Math.max(lb[q.vc], d); else rb[q.vc] = Math.max(rb[q.vc], d); }
  });
  const used = asp.map((a, r)=> a > 0 ? r : -1).filter(r=> r >= 0);
  const sumAsp = used.reduce((t, r)=> t + asp[r], 0) || 1;
  const xGap = c => c % cols === 0 ? bg : g;                      // before column c > 0
  const yGap = (r0, r1) => Math.floor(r0/rows) === Math.floor(r1/rows) ? g : bg;
  let innerW = 0; for (let c = 0; c < C; c++){ if (c > 0) innerW += lb[c] + xGap(c); if (c < C - 1) innerW += rb[c]; }
  let innerH = 0; used.forEach((r, k)=>{ if (k > 0) innerH += tb[r] + yGap(used[k - 1], r); if (k < used.length - 1) innerH += bb[r]; });
  const oL = lb[0], oR = rb[C - 1], oT = used.length ? tb[used[0]] : 0, oB = used.length ? bb[used[used.length - 1]] : 0;
  // The image width: the page's room (auto), or the plot's.
  const natural = w => oT + oB + innerH + sumAsp*Math.max(1, (w - oL - oR - innerW)/C);
  const H = F.hmm > 0 ? F.hmm : natural(W);
  let iw, boxX, boxY, boxW, boxH;
  if (F.plotAuto){
    iw = Math.max(1, Math.min((W - oL - oR - innerW)/C, (H - oT - oB - innerH)/sumAsp));
    boxW = innerW + C*iw; boxH = innerH + sumAsp*iw;
    boxX = (W - (oL + boxW + oR))/2 + oL; boxY = (H - (oT + boxH + oB))/2 + oT;
  } else {
    /* The images keep their proportions, so the plot's width and height go together:
       the one set last (plotBy) decides, the other follows (and its field shows it,
       commit). Set by hand, the plot may run off the page: it is seen at once. */
    const pw = Math.max(5, F.plotW), ph = Math.max(5, F.plotH);
    iw = Math.max(1, F.plotBy === 'h' ? (ph - innerH)/sumAsp : (pw - innerW)/C);
    const cw = innerW + C*iw, ch = innerH + sumAsp*iw, al = F.align || 'mc';
    const bx = al[1] === 'l' ? oL : al[1] === 'r' ? W - oR - pw : (W - pw)/2;
    const by = al[0] === 't' ? oT : al[0] === 'b' ? H - oB - ph : (H - ph)/2;
    // Where their proportions leave the plot box room, the images go to the same
    // side of it as the box goes on the page.
    const ax = al[1] === 'l' ? 0 : al[1] === 'r' ? 1 : 0.5, ay = al[0] === 't' ? 0 : al[0] === 'b' ? 1 : 0.5;
    boxX = bx + (pw - cw)*ax; boxY = by + (ph - ch)*ay; boxW = cw; boxH = ch;
  }
  // Where each column's image and each row's image band start.
  const colX = [], rowY = [], rowH = [];
  let x = boxX; for (let c = 0; c < C; c++){ if (c > 0) x += rb[c - 1] + xGap(c) + lb[c]; colX[c] = x; x += iw; }
  let y = boxY; used.forEach((r, k)=>{ if (k > 0) y += bb[used[k - 1]] + yGap(used[k - 1], r) + tb[r]; rowY[r] = y; rowH[r] = asp[r]*iw; y += asp[r]*iw; });
  const panels = imgs.map((m, i)=>{
    const q = pl[i], h = iw*m.h/m.w;
    return { m, k: i, ...q, x: colX[q.vc], y: rowY[q.vr] + (rowH[q.vr] - h)/2, w: iw, h, rowTop: rowY[q.vr], rowBot: rowY[q.vr] + rowH[q.vr], tbD: tb[q.vr], bbD: bb[q.vr], lbD: lb[q.vc], rbD: rb[q.vc] };
  });
  return { W, H, panels, grid: G, plot: { x: boxX, y: boxY, w: boxW, h: boxH }, natural };
}

/* ---- Drawing ---- */
function draw(svg, full){
  const L = layout(), px = v => v*PX_MM, NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${px(L.W)} ${px(L.H)}`);
  const add = (tag, at, parent) => { const el = document.createElementNS(NS, tag); for (const k in at) el.setAttribute(k, at[k]); (parent || svg).appendChild(el); return el; };
  add('rect', { x: 0, y: 0, width: px(L.W), height: px(L.H), fill: F.bg });
  /* The outline, unless its colour is picked, and what is drawn on the page are black or
     white by the composer's rule (figure.js contrastInk, WCAG luminance), as the plots'
     labels are. To v480 the figure had its own (YIQ), which gave a white outline where
     this gives black to mid-luminance inks: pure red, magenta, #0099ff, #777. */
  const stack = (FONTS[F.font] || FONTS.Inter).stack, ink = F.ink, out = F.outlineColor || contrastInk(ink), page = contrastInk(F.bg);
  // Text over the images in the chosen colour, with an outline so that it reads on any
  // grey; outside them, on the page, in the colour that reads on it. parts: [[text,
  // pt, bold]]; rot −90 reads up, 90 down.
  const text = (parts, x, y, anchor, onImage, rot) => {
    const fs = parts[0][1]*PT_PX, t = add('text', { x, y, 'font-size': fs, 'font-family': stack, 'text-anchor': anchor, fill: onImage ? ink : page, ...(rot ? { transform: `rotate(${rot} ${x} ${y})` } : {}) });
    if (onImage && F.outline){ t.setAttribute('stroke', out); t.setAttribute('stroke-width', fs*0.12); t.setAttribute('stroke-linejoin', 'round'); t.setAttribute('paint-order', 'stroke'); }
    parts.forEach(([str, pt, bold], i)=>{ const sp = add('tspan', { 'font-size': pt*PT_PX, ...(bold ? { 'font-weight': 700 } : {}) }, t); sp.textContent = (i ? ' ' : '') + str; });
    return t;
  };
  const bar = (x, y, w, h, onImage) => {
    const r = add('rect', { x: px(x), y: px(y), width: px(w), height: px(h), fill: onImage ? ink : page });
    if (onImage && F.outline){ r.setAttribute('stroke', out); r.setAttribute('stroke-width', px(Math.min(w, h))*0.35); r.setAttribute('paint-order', 'stroke'); }
  };
  const margin = 1.5, A = { left: 'start', center: 'middle', right: 'end' };
  for (const p of L.panels){
    const g = add('g', { 'data-i': p.k, class: 'sem-fig-panel' });
    add('image', { x: px(p.x), y: px(p.y), width: px(p.w), height: px(p.h), href: urlOf(p.m, full), preserveAspectRatio: 'none' }, g);
    const nameStr = F.names[p.m.id] != null ? F.names[p.m.id] : p.m.label, nm = p.nm;
    const letter = F.letter.on ? letterOf(p.k, F.letter.style) : '';
    // The name's parts: the letter first when it goes at the start of the name (in
    // the name's size), the name itself when shown.
    const nameParts = [];
    if (letter && F.letter.link) nameParts.push([letter, F.label.size, true]);
    if (F.label.on) nameParts.push([nameStr, F.label.size, false]);
    const imgL = p.x, imgR = p.x + p.w, xOf = ha => ha === 'left' ? imgL : ha === 'right' ? imgR : (imgL + imgR)/2;
    // The bar: its length, and where it is drawn.
    let barU = null;
    if (p.bar){
      const grp = p.m.group, umW = p.m.w*p.m.pxNm/1000, set = F.bars[grp.mode === 'own' ? p.m.id : grp.id];
      const um = set && !set.auto && set.um > 0 ? set.um : niceBar(umW);
      barU = { um, bw: p.w*um/umW, label: lenText(um) };
    }
    const fsBar = F.bar.size*MM_PT, t = F.bar.thick;
    const barText = (bx, ty, onImage) => {
      const tw = barU.label.length*fsBar*0.56, [tx, ta] = tw <= barU.bw ? [bx + barU.bw/2, 'middle'] : F.bar.ha === 'right' ? [bx + barU.bw, 'end'] : [bx, 'start'];
      text([[barU.label, F.bar.size, false]], px(tx), px(ty), ta, onImage);
    };
    // ---- Outside, above and below: the bands' lines (the bar nearest the image).
    for (const side of ['top', 'bottom']){
      const B = p[side];
      if (!B.depth) continue;
      const edge = side === 'top' ? p.rowTop : p.rowBot;
      // The text line: beyond the bar's own line, else next to the image.
      const textFrom = B.alone ? barBox() : 0;
      const lineTop = side === 'top' ? edge - textFrom - B.text : edge + textFrom, base = lineTop + B.text*0.78;
      const nmHere = nm && !nm.v && nm.pos === 'out' && nm.va === side && nameParts.length;
      const ltHere = letterOwn() && F.letter.pos === 'out' && F.letter.va === side;
      if (nmHere && ltHere && (F.letter.ha === nm.ha))
        text([[letter, F.letter.size, true], ...nameParts], px(xOf(nm.ha)), px(base), A[nm.ha], false);
      else {
        if (nmHere) text(nameParts, px(xOf(nm.ha)), px(base), A[nm.ha], false);
        if (ltHere) text([[letter, F.letter.size, true]], px(xOf(F.letter.ha)), px(base), A[F.letter.ha], false);
      }
      if (B.bar && barU){
        const bx = F.bar.ha === 'right' ? imgR - barU.bw : imgL;
        const by = side === 'top' ? edge - BAR_GAP - t : edge + BAR_GAP;
        bar(bx, by, barU.bw, t, false);
        barText(bx, side === 'top' ? by - 0.3 : by + t + 0.3 + fsBar*0.8, false);
      }
    }
    // ---- Outside, at the sides: upright names.
    if (nm && nm.v && nm.pos === 'out' && nameParts.length){
      const lh = lineOf(F.label.size), va = nm.va;
      if (nm.ha === 'left'){
        const y = va === 'top' ? p.y : va === 'bottom' ? p.y + p.h : p.y + p.h/2, an = va === 'top' ? 'end' : va === 'bottom' ? 'start' : 'middle';
        text(nameParts, px(imgL - lh*0.22), px(y), an, false, -90);
      } else {
        const y = va === 'top' ? p.y : va === 'bottom' ? p.y + p.h : p.y + p.h/2, an = va === 'top' ? 'start' : va === 'bottom' ? 'end' : 'middle';
        text(nameParts, px(imgR + lh*0.22), px(y), an, false, 90);
      }
    }
    // ---- Inside: the bar at its corner, then what shares its edge moves a line in.
    let shiftTop = 0, shiftBot = 0;   // per side, on the bar's half (left or right)
    const barIn = barU && F.bar.pos === 'in';
    if (barIn){
      const right = F.bar.ha === 'right', bottom = F.bar.va === 'bottom';
      const bx = right ? imgR - margin - barU.bw : imgL + margin, by = bottom ? p.y + p.h - margin - t : p.y + margin + fsBar*1.15;
      bar(bx, by, barU.bw, t, true);
      barText(bx, by - fsBar*0.3, true);
      if (bottom) shiftBot = t + fsBar*1.3; else shiftTop = t + fsBar*1.3;
    }
    const shiftFor = (va, ha) => !barIn || F.bar.va !== va || (ha !== F.bar.ha && ha !== 'center') ? 0 : (va === 'top' ? shiftTop : shiftBot);
    const yIn = (va, pt, ha) => {
      const fs = pt*MM_PT;
      return va === 'top' ? p.y + margin + fs*0.82 + shiftFor('top', ha) : va === 'bottom' ? p.y + p.h - margin - shiftFor('bottom', ha) : p.y + p.h/2 + fs*0.35;
    };
    const xIn = ha => ha === 'left' ? imgL + margin : ha === 'right' ? imgR - margin : (imgL + imgR)/2;
    const nmIn = nm && nm.pos === 'in' && nameParts.length, ltIn = letterOwn() && F.letter.pos === 'in';
    if (nmIn && !nm.v){
      if (ltIn && F.letter.va === nm.va && F.letter.ha === nm.ha)
        text([[letter, F.letter.size, true], ...nameParts], px(xIn(nm.ha)), px(yIn(nm.va, Math.max(F.label.size, F.letter.size), nm.ha)), A[nm.ha], true);
      else {
        // A letter in the name's corner: the name a line further in.
        const meet = ltIn && F.letter.va === nm.va && nm.va !== 'center' && (nm.ha === 'center');
        const y = yIn(nm.va, F.label.size, nm.ha) + (meet ? (nm.va === 'top' ? 1 : -1)*F.letter.size*MM_PT*1.25 : 0);
        text(nameParts, px(xIn(nm.ha)), px(y), A[nm.ha], true);
        if (ltIn) text([[letter, F.letter.size, true]], px(xIn(F.letter.ha)), px(yIn(F.letter.va, F.letter.size, F.letter.ha)), A[F.letter.ha], true);
      }
    } else {
      if (nmIn){
        // Upright inside: along the left or right edge (or the middle), reading up.
        const fs = F.label.size*MM_PT, xb = nm.ha === 'left' ? imgL + margin + fs*0.82 : nm.ha === 'right' ? imgR - margin - fs*0.22 : (imgL + imgR)/2 + fs*0.35;
        const y = nm.va === 'top' ? p.y + margin : nm.va === 'bottom' ? p.y + p.h - margin : p.y + p.h/2, an = nm.va === 'top' ? 'end' : nm.va === 'bottom' ? 'start' : 'middle';
        text(nameParts, px(xb), px(y), an, true, -90);
      }
      if (ltIn) text([[letter, F.letter.size, true]], px(xIn(F.letter.ha)), px(yIn(F.letter.va, F.letter.size, F.letter.ha)), A[F.letter.ha], true);
    }
  }
  return L;
}

/* ---- Preview (figure.js renderPreview) ---- */
// The footer's line: the page, the plot, the grid, the export's pixels.
function dimText(){
  const L = lastL, G = L.grid, grid = G.bRows*G.bCols > 1 ? `${G.bCols} × ${G.bRows} panels of ${G.cols} × ${G.rows} images` : `${G.cols} × ${G.rows} images`;
  return `${sig3(L.W)} × ${sig3(L.H)} mm (plot ${sig3(L.plot.w)} × ${sig3(L.plot.h)}) · ${grid} · ${Math.round(L.W/25.4*F.dpi)} × ${Math.round(L.H/25.4*F.dpi)} px @ ${F.dpi} dpi`;
}
// The locked fields show what was chosen.
function afterRender(){
  const L = lastL, set = (k, v) => { const el = controlsEl.querySelector(`[data-auto="${k}"]`); if (el) el.value = v; };
  set('rows', L.grid.rows); set('cols', L.grid.cols); set('bRows', L.grid.bRows); set('bCols', L.grid.bCols);
  set('plotW', sig3(L.plot.w)); set('plotH', sig3(L.plot.h));
  lastPlot = L.plot;
}

/* ---- Controls (figure.js's field kit: `p` names a setting by its dotted path) ----
   Disabled, not hidden: a setting that means nothing while another is off stays in
   place, greyed (`off`). */
function get(path){ return path.split('.').reduce((o, k)=> o == null ? undefined : o[k], F); }
function put(path, v){ const ks = path.split('.'), last = ks.pop(); const o = ks.reduce((o, k)=> (o[k] = o[k] || {}), F); o[last] = v; }

const HA = [['left', 'left'], ['center', 'centre'], ['right', 'right']], VA = [['top', 'top'], ['center', 'centre'], ['bottom', 'bottom']];
function controlsHtml(){
  const imgs = ordered(), own = imgs.some(m=> m.group.mode === 'own'), L = F.label, Lt = F.letter, B = F.bar;
  // The bars' lengths: one for the group at common scale (whether one bar or one a
  // panel), one an image at its own.
  const barRows = [], seen = new Set();
  for (const m of imgs){
    const key = m.group.mode === 'own' ? m.id : m.group.id;
    if (seen.has(key)) continue; seen.add(key);
    const set = F.bars[key] || { auto: true, um: 1 }, auto = set.auto !== false, nice = niceBar(m.w*m.pxNm/1000);
    const what = m.group.mode === 'own' ? ` of ${esc(m.label)}` : '';
    barRows.push(`<label class="fig-check"><input type="checkbox" data-bar="${esc(key)}" data-bark="auto"${auto ? ' checked' : ''}> Length${what} chosen automatically</label>
      <label class="fig-row"><span>Length${what} (µm)</span>${auto ? `<input type="text" value="${sig3(nice)}" disabled title="Chosen automatically: a round length near a fifth of the panel">`
        : numField(`data-bar="${esc(key)}" data-bark="um"`, set.um ?? nice, 0.0001, 100000)}</label>`);
  }
  const vName = L.orient === 'v', namesOff = !L.on && !(Lt.on && Lt.link);
  return `
  <section class="fig-sec"><h4>Figure</h4>
    ${num('Width (mm)', 'wmm', 10, 1000, 'p')}
    ${num('Height (mm)', 'hmm', 10, 1000, 'p')}
    ${num('Export DPI', 'dpi', 50, 4800, 'p')}
    ${sel('Background', 'bg', [['#ffffff', 'white'], ['#000000', 'black']], null, 'p')}
    <label class="fig-row"><span>File name</span><input type="text" data-p="file" value="${esc(F.file)}"></label>
    ${chk('Auto margins', 'plotAuto', 'p', 'The images as large as the page allows, the names and bars outside them in the margins, the whole centred')}
    ${F.plotAuto ? `<label class="fig-row"><span>Plot width (mm)</span><input type="text" data-auto="plotW" disabled value="${sig3(lastPlot.w)}" title="Chosen by the auto margins"></label>
      <label class="fig-row"><span>Plot height (mm)</span><input type="text" data-auto="plotH" disabled value="${sig3(lastPlot.h)}" title="Chosen by the auto margins"></label>`
      : `${num('Plot width (mm)', 'plotW', 5, 2000, 'p')}${num('Plot height (mm)', 'plotH', 5, 2000, 'p')}`}
    <label class="fig-row"><span>Alignment</span><button class="btn btn-sm fig-align" type="button" data-align-btn title="Align the plot on the page"${F.plotAuto ? ' disabled' : ''}>${ALIGN_ICON(F.align)}</button></label>
    <p class="txt-meta">The plot is the smallest rectangle round all the images.</p>
  </section>
  <section class="fig-sec"><h4>Layout</h4>
    ${chk('Grid chosen automatically', 'gridAuto', 'p', 'One panel, the most compact rectangle: ⌈√N⌉ columns')}
    <div class="fig-subhead">Panels</div>
    ${autoNum('Rows', 'bRows', 'gridAuto', 1, 20, null, 'p')}
    ${autoNum('Columns', 'bCols', 'gridAuto', 1, 20, null, 'p')}
    ${num('Gap (mm)', 'bGap', 0, 40, 'p')}
    <div class="fig-subhead">Images in a panel</div>
    ${autoNum('Rows', 'rows', 'gridAuto', 1, 40, null, 'p')}
    ${autoNum('Columns', 'cols', 'gridAuto', 1, 40, null, 'p')}
    ${num('Gap (mm)', 'gap', 0, 20, 'p')}
  </section>
  <section class="fig-sec"><div class="sem-fig-sechead"><h4>Images</h4><button class="btn primary btn-sm" type="button" data-act="order" title="The panels back in the file list's order">Restore</button></div>
    <div class="fig-series">${imageGroupsHtml(L)}</div>
  </section>
  <section class="fig-sec"><h4>Names</h4>
    ${chk('Show the names', 'label.on', 'p')}
    ${chk('Placed automatically', 'label.auto', 'p', 'Outside where there is room: above the first row, below the last; inside the rows between, at the top for the first half (and the middle row), at the bottom for the second. Upright names go by columns: left and right.', namesOff)}
    ${sel('Orientation', 'label.orient', [['h', 'horizontal'], ['v', 'vertical']], null, 'p', namesOff)}
    ${sel('Horizontal', 'label.ha', L.auto && vName ? [['auto', 'by column']] : HA, L.auto && vName ? 'auto' : null, 'p', namesOff || (L.auto && vName))}
    ${sel('Vertical', 'label.va', L.auto && !vName ? [['auto', 'by row']] : VA, L.auto && !vName ? 'auto' : null, 'p', namesOff || (L.auto && !vName))}
    ${sel('Position', 'label.pos', L.auto ? [['auto', vName ? 'by column' : 'by row']] : [['in', 'inside'], ['out', 'outside']], L.auto ? 'auto' : null, 'p', namesOff || L.auto)}
    ${num('Size (pt)', 'label.size', 3, 36, 'p', namesOff)}
  </section>
  <section class="fig-sec"><h4>Letters</h4>
    ${chk('Show letters (a, b, c… in the panels\' order)', 'letter.on', 'p')}
    ${sel('Style', 'letter.style', [['a', 'a'], ['(a)', '(a)'], ['A', 'A'], ['(A)', '(A)']], null, 'p', !Lt.on)}
    ${chk('At the start of the name', 'letter.link', 'p', 'Written before the name, where the name is, in its size', !Lt.on)}
    ${sel('Position', 'letter.pos', [['in', 'inside'], ['out', 'outside']], null, 'p', !Lt.on || Lt.link)}
    ${sel('Vertical', 'letter.va', [['top', 'top'], ['bottom', 'bottom']], null, 'p', !Lt.on || Lt.link)}
    ${sel('Horizontal', 'letter.ha', [['left', 'left'], ['right', 'right']], null, 'p', !Lt.on || Lt.link)}
    ${num('Size (pt)', 'letter.size', 3, 36, 'p', !Lt.on || Lt.link)}
  </section>
  <section class="fig-sec"><h4>Scale bars</h4>
    <label class="fig-check" title="${own ? 'At its own scale every image has its own bar' : 'One bar on every panel, rather than one on the last'}"><input type="checkbox" data-p="bar.each"${B.each || own ? ' checked' : ''}${own ? ' disabled' : ''}> One bar per image</label>
    ${sel('Position', 'bar.pos', [['in', 'inside'], ['out', 'outside']], null, 'p')}
    ${sel('Vertical', 'bar.va', [['top', 'top'], ['bottom', 'bottom']], null, 'p')}
    ${sel('Horizontal', 'bar.ha', [['left', 'left'], ['right', 'right']], null, 'p')}
    ${num('Thickness (mm)', 'bar.thick', 0.1, 5, 'p')}
    ${num('Text size (pt)', 'bar.size', 3, 36, 'p')}
    ${barRows.join('')}
  </section>
  <section class="fig-sec"><h4>Type</h4>
    ${sel('Font', 'font', Object.entries(FONTS).map(([k, v])=> [k, v.label]), null, 'p')}
    <div class="fig-row"><span>Colour on the images</span><button class="color-swatch" type="button" data-ink="ink" data-color="${esc(F.ink)}" style="background:${esc(F.ink)}" title="Names, letters and scale bars over the images"></button></div>
    ${chk('Outline, for contrast with the image', 'outline', 'p')}
    <div class="fig-row"><span>Outline colour</span><button class="color-swatch" type="button" data-ink="outlineColor" data-color="${esc(F.outlineColor || contrastInk(F.ink))}" style="background:${esc(F.outlineColor || contrastInk(F.ink))}" title="The outline round what is drawn over the images"${F.outline ? '' : ' disabled'}></button></div>
  </section>`;
}
/* The Images list, as the plots' composer lists series: a group per panel, its images
   in order, each a handle and the name shown on it; an empty panel says where its
   images go. */
function imageGroupsHtml(L){
  const places = placesOf(), G = gridOf(places.length), per = F.gridAuto ? Math.max(1, places.length) : G.rows*G.cols;
  const nP = F.gridAuto ? 1 : G.bRows*G.bCols, out = [];
  for (let b = 0; b < nP; b++){
    const mine = places.slice(b*per, (b + 1)*per).filter(Boolean);
    out.push(`<div class="fig-group" data-pg="${b}">
      <div class="fig-group-h">Panel ${b + 1}${F.gridAuto ? '' : ` <span class="txt-meta">${mine.length}/${per}</span>`}</div>
      ${mine.map(m=> `<div class="fig-serie" data-id="${esc(m.id)}">
        <span class="fig-grip" title="Drag to reorder, or into another panel (where it is full, the two images swap)">${GRIP}</span>
        <input type="text" class="fig-slabel" data-name="${esc(m.id)}" value="${esc(F.names[m.id] != null ? F.names[m.id] : m.label)}" title="Name shown on ${esc(m.label)}"${L.on ? '' : ' disabled'}>
      </div>`).join('') || '<p class="txt-meta fig-group-empty">Drag an image here.</p>'}
    </div>`);
  }
  return out.join('');
}
// The controls drawn again (figure.js rebuildControls), the scroll kept; the pickers
// hanging from their buttons go first, the buttons being replaced.
function renderControls(){
  if (!controlsEl) return;
  colorPickerUI.close(); alignPicker.close();
  const st = controlsEl.scrollTop;
  rebuildControls();
  controlsEl.scrollTop = st;
  renderPreview();
}
/* The images' rows dragged by their handles, as the plots' series are (figure.js
   wireRowDrag): within a panel the gap that lights is where it goes; into another
   panel with room, it moves there (its place in the first left empty); into a full
   one, it swaps with the image it is dropped on, which lights. */
function wireOrderDrag(){
  const places = ()=>{ const p = placesOf(), G = gridOf(p.length), per = F.gridAuto ? Math.max(1, p.length) : G.rows*G.cols, n = (F.gridAuto ? 1 : G.bRows*G.bCols)*per; while (p.length < n) p.push(null); return { p, per }; };
  wireRowDrag('.fig-serie[data-id]', {
    swapIn: (gp, gRows)=> gRows.length >= places().per,
    onDrop(row, t){
      const id = row.dataset.id, tb = +t.gp.dataset.pg;
      const { p, per } = places(), src = p.findIndex(m=> m && m.id === id);
      if (src < 0) return;
      if (t.swap){
        const dst = p.findIndex(m=> m && m.id === t.swap.dataset.id);
        [p[src], p[dst]] = [p[dst], p[src]];
      } else {
        const moved = p[src], sb = Math.floor(src/per);
        // Out of its panel: its place left empty (at the panel's end); into the target
        // panel at the gap, the panel's empty places after its images.
        p[src] = null;
        const block = b => p.slice(b*per, (b + 1)*per).filter(Boolean);
        const put = (b, list)=>{ for (let k = 0; k < per; k++) p[b*per + k] = list[k] || null; };
        if (sb !== tb) put(sb, block(sb));
        const list = block(tb), before = t.g < t.gRows.length ? t.gRows[t.g].dataset.id : null;
        const at = before ? list.findIndex(m=> m.id === before) : list.length;
        list.splice(at < 0 ? list.length : at, 0, moved);
        put(tb, list);
      }
      F.order = p.map(m=> m ? m.id : '');
      commit(true);
    },
  });
}
/* Every change is drawn at once, and goes back to the module (saved, undoable) as one
   step (save): at once, or, for a tick of a drag in the colour picker (`burst`), a
   moment after the last, the drag one step: it made a step of every tick, pushing the
   module's own steps out of its history (to v480). Only a drag waits: a field's edit
   held back would be missing from the tab the page saves as it goes (sessions.js) on
   a reload right after. An undo, an export, closing and the page hidden or left send
   a drag's first (flush). `rebuild` when the controls themselves change (a box that
   locks a field, the order of the names). */
function commit(rebuild, burst){
  if (burst){ clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); } else save();
  if (rebuild) renderControls(); else renderPreview();
}
function save(){ clearTimeout(saveTimer); saveTimer = null; if (host && F) host.setFig(clone(F)); }
const STRUCTURAL = new Set(['wmm', 'hmm', 'plotW', 'plotH', 'plotAuto', 'gridAuto', 'label.on', 'label.auto', 'label.orient', 'letter.on', 'letter.link', 'outline']);
/* A field's number, inside its range (figure.js readNum); outside it the field shakes
   and goes back. The field stays (rebuilt, it would take its shake with it) and goes
   back to the last value it took. */
const numOf = t =>{ const v = readNum(t); if (v != null) t.defaultValue = String(v); return v; };
function wireControls(){
  controlsEl.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input[type="text"]')) e.target.blur(); });
  controlsEl.addEventListener('change', e=>{
    const t = e.target;
    if (rebuilding || !t.isConnected) return;
    if (t.dataset.name != null){ F.names[t.dataset.name] = t.value; commit(false); return; }
    if (t.dataset.bar != null){
      const key = t.dataset.bar, cur = F.bars[key] || { auto: true, um: 1 };
      if (t.dataset.bark === 'auto'){
        // Unticked, the field starts from the length that was chosen.
        const m = ordered().find(m=> (m.group.mode === 'own' ? m.id : m.group.id) === key);
        F.bars[key] = { auto: t.checked, um: t.checked ? cur.um : (m ? niceBar(m.w*m.pxNm/1000) : cur.um) };
        commit(true); return;
      }
      const v = numOf(t); if (v == null) return;
      F.bars[key] = { ...cur, auto: false, um: v }; commit(false); return;
    }
    const path = t.dataset.p; if (!path) return;
    let v;
    if (t.type === 'checkbox') v = t.checked;
    else if (t.dataset.num){ v = numOf(t); if (v == null) return; }
    else v = t.value;
    // Unlocked, a field starts from the value that was being chosen for it.
    if (path === 'plotAuto' && !v){ F.plotW = +sig3(lastPlot.w); F.plotH = +sig3(lastPlot.h); }
    if (path === 'gridAuto' && !v){ const G = layout().grid; F.rows = G.rows; F.cols = G.cols; F.bRows = G.bRows; F.bCols = G.bCols; }
    put(path, v);
    // The plot's other side follows the one just set (the images keep their shape).
    if (path === 'plotW' || path === 'plotH'){ F.plotBy = path === 'plotW' ? 'w' : 'h'; const P = layout().plot; F.plotW = +sig3(P.w); F.plotH = +sig3(P.h); }
    const GRID = ['rows', 'cols', 'bRows', 'bCols'];
    // Too few places for the images: block rows are added.
    if (GRID.includes(path)){ const n = slotsOf().length; F.bRows = Math.max(F.bRows, Math.ceil(n/(F.rows*F.cols*F.bCols))); }
    // Outside, a name is beside an edge: the middle is not offered.
    const POS = ['label.pos', 'label.ha', 'label.va'];
    commit(STRUCTURAL.has(path) || GRID.includes(path) || POS.includes(path) || path === 'letter.pos');
  });
  controlsEl.addEventListener('click', e=>{
    const b = e.target.closest('[data-act="order"]');
    if (b){ F.order = []; commit(true); return; }
    const al = e.target.closest('[data-align-btn]');
    if (al && !al.disabled){ alignPicker.open(al, code=>{ F.align = code; commit(true); }, F.align); return; }
    const sw = e.target.closest('[data-ink]');
    if (sw && !sw.disabled){
      const key = sw.dataset.ink;
      colorPickerUI.open(sw, key === 'ink' ? F.ink : (F.outlineColor || contrastInk(F.ink)), c=>{
        F[key] = c; sw.style.background = c; sw.dataset.color = c;
        // An outline left to follow the ink: its swatch shows the colour it now takes. It
        // went on showing the one for the ink before (to v480).
        const o = controlsEl.querySelector('[data-ink="outlineColor"]');
        if (key === 'ink' && !F.outlineColor && o){ const oc = contrastInk(c); o.style.background = oc; o.dataset.color = oc; }
        commit(false, true);
      });
    }
  });
}

// A page with no height yet (a new figure, or one whose height followed the layout
// before v449): as tall as the images need at its width.
function fillHeight(){ if (!(F.hmm > 0)) F.hmm = Math.max(10, Math.round(layout().natural(F.wmm)*10)/10); }
/* The figure as the module holds it: the defaults filled in, named after its group
   until named otherwise, as tall as its images need until given a height. At opening
   and after an undo alike: an undo used to drop the group's name for SEM_figure (to
   v480). */
function load(){
  const f = host.getFig();
  F = withDefaults(f);
  if (!(f && f.file) && host.title) F.file = 'SEM_' + String(host.title).replace(/[^\w.-]+/g, '_');
  fillHeight();
}

/* ---- Opening ----
   h: { title (the group's name), images() → [{ id, label, group {id, name, mode}, w, h,
        pxNm, key, canvas(fit) }], getFig(), setFig(fig), alive() (its group is still
        there) }. Opens the composer on the group's figure (figure.js openComposer):
   gives { open, refresh, close }, or null while a composer is open. refresh after the
   module's state changed under it (an undo). Undo is the page's: the figure has no
   history of its own. */
export function openSemFigure(h){
  return openComposer({
    open(){ host = h; load(); },
    size(){ const L = layout(); return { W: L.W, H: L.H }; },
    draw(svg, full){ const L = draw(svg, full); if (!full) lastL = L; return { W: L.W, H: L.H }; },
    dimText, afterRender, controlsHtml,
    val: (at, key)=> get(key),
    afterRebuild: wireOrderDrag,
    wire: wireControls,
    flush(){ if (saveTimer !== null) save(); },
    reset(){ F = withDefaults({ file: F.file }); fillHeight(); commit(true); },
    /* The settings now in force, after an undo: an edit not yet sent is dropped, the
       module's state is what holds. With its group gone (an undo past a Reset of the
       groups, which makes them anew), it closes: it showed an empty figure and wrote
       into a group that no longer was (to v480). */
    refresh(){
      clearTimeout(saveTimer); saveTimer = null;
      if (host.alive && !host.alive()){ closeComposer(); return; }
      load(); renderControls();
    },
    closing(){ clearTimeout(saveTimer); saveTimer = null; urls.clear(); host = F = lastL = null; },
    dpi: ()=> F.dpi, file: ()=> F.file || 'SEM_figure', paper: ()=> F.bg, font: ()=> F.font,
    svgClass: 'sem-fig-svg',
    footHtml: '<button class="btn btn-sm fig-reset" type="button" data-fig-reset title="Every setting back to its default">Reset</button>',
    titles: { svg: 'Save the figure as a vector file, with the images in it', png: 'Save the figure as an image at the chosen dpi', copy: 'Copy the figure to the clipboard' },
  });
}

export { FIG_DEF, niceBar, lenText };
