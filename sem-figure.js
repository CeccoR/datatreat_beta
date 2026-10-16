import { colorPickerUI, flashFieldInvalid, dropGap } from './utils.js';
import { FONTS, PX_MM, PT_PX, saveBlob, interFontCss, alignPicker, ALIGN_ICON } from './figure.js';

/* =========================================================
   SEM FIGURE
   The SEM images laid out for a paper, as the figure composer lays out plots
   (figure.js): one drawing in real millimetres, previewed as it will be exported, with
   the composer's page, fonts and export. No axes and no legend: a grid of image panels,
   each with its sample's name, optionally a letter, and the scale bars.

   The page is set freely; with auto margins the images are as large as it allows, what
   lies outside them (names, letters, bars) in the margins, the whole centred; without,
   the plot (the smallest rectangle round the images) is set and aligned by hand. The
   grid is the most compact rectangle for the images (columns ⌈√N⌉, rows ⌈N/cols⌉: 12
   images 4 × 3, not 6 × 2) unless set by hand, in two levels: blocks of panels (2 × 1
   blocks of 2 × 2 panels hold eight), a gap between panels and another between blocks.
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
   back (setFig) on every change.
========================================================= */

const MM_PT = 25.4/72;
/* label: the names. auto places them by row (or column, written upright): the first
   outside above (left), the last outside below (right), the rows between inside, at
   the top for the first half and the middle one, at the bottom for the second. orient
   h (along the image) or v (upright); ha, va where on the image; pos in or out.
   letter and bar: pos in or out, va top or bottom, ha left or right (8 places). */
const FIG_DEF = {
  file: 'SEM_figure', wmm: 175, hmm: null, dpi: 600, bg: '#ffffff',
  plotAuto: true, plotW: 0, plotH: 0, align: 'cc',
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
function withDefaults(f){
  const o = { ...FIG_DEF, ...(f || {}) };
  for (const k of ['label', 'letter', 'bar']) o[k] = { ...FIG_DEF[k], ...((f || {})[k] || {}) };
  o.order = (f && f.order || []).slice(); o.names = { ...(f && f.names || {}) }; o.bars = { ...(f && f.bars || {}) };
  const old = f && f.label && f.label.pos;
  if (old && !['in', 'out'].includes(old)){
    const L = o.label; L.auto = false; L.orient = 'h';
    if (CORNER[old]){ L.pos = 'in'; [L.va, L.ha] = CORNER[old]; }
    else if (old === 'above' || old === 'below'){ L.pos = 'out'; L.va = old === 'above' ? 'top' : 'bottom'; L.ha = 'left'; }
    else { L.pos = 'out'; L.orient = 'v'; L.ha = old; L.va = 'center'; }
  }
  for (const k of ['letter', 'bar']){
    const p = f && f[k] && f[k].pos;
    if (!p || ['in', 'out'].includes(p)) continue;
    const X = o[k];
    if (CORNER[p]){ X.pos = 'in'; [X.va, X.ha] = CORNER[p]; }
    else { X.pos = 'out'; X.va = p === 'below' ? 'bottom' : 'top'; X.ha = k === 'bar' ? 'right' : 'left'; if (p === 'left' || p === 'right'){ X.va = 'bottom'; X.ha = p; } }
  }
  if (/^m/.test(o.align || '')) o.align = 'c' + o.align[1];   // v449 wrote the middle row as m
  if (f && f.hAuto === false && f.hmm > 0) o.hmm = f.hmm;
  else if (f && 'hAuto' in f) o.hmm = null;
  delete o.hAuto;
  return o;
}
const clone = v => JSON.parse(JSON.stringify(v));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
// Black or white, whichever stands out against a colour (for the outline).
function contrastOf(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#000';
  const n = parseInt(m[1], 16), L = (0.299*(n >> 16) + 0.587*(n >> 8 & 255) + 0.114*(n & 255))/255;
  return L > 0.5 ? '#000' : '#fff';
}

let host = null, F = null, backdrop = null, svgEl = null, controlsEl = null, dimEl = null;
let view = { z: 1, x: 0, y: 0 };
let lastPlot = { w: 0, h: 0 };   // the plot of the last drawing (mm), for its locked fields
const urls = new Map();   // id|full → { key, url }: an image's PNG, made once while it does not change
let rebuilding = false;

// The images in panel order: the saved order, then any image not in it, in the file
// list's order.
function ordered(){
  const imgs = host.images(), byId = new Map(imgs.map(m=> [m.id, m]));
  const seen = new Set(), out = [];
  for (const id of F.order) if (byId.has(id) && !seen.has(id)){ out.push(byId.get(id)); seen.add(id); }
  for (const m of imgs) if (!seen.has(m.id)) out.push(m);
  return out;
}
/* The grid: blocks (bRows × bCols) of panels (rows × cols each), filled block by block,
   in reading order. Automatic: one block, the most compact rectangle. By hand, blocks
   rows are added where the images would not fit. */
function gridOf(n){
  if (F.gridAuto){ const cols = Math.max(1, Math.ceil(Math.sqrt(n))); return { cols, rows: Math.max(1, Math.ceil(n/cols)), bRows: 1, bCols: 1 }; }
  const cols = Math.max(1, F.cols), rows = Math.max(1, F.rows), bCols = Math.max(1, F.bCols);
  return { cols, rows, bCols, bRows: Math.max(F.bRows, Math.ceil(n/(rows*cols*bCols))) };
}
function urlOf(m, full){
  const k = m.id + (full ? '|full' : '|prev'), c = urls.get(k);
  if (c && c.key === m.key) return c.url;
  const cv = m.canvas(full ? 0 : 520);
  const url = cv ? cv.toDataURL('image/png') : '';
  urls.set(k, { key: m.key, url });
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
  const imgs = ordered(), n = imgs.length, G = gridOf(n), { rows, cols, bRows, bCols } = G;
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
  const pl = imgs.map((m, i)=>{ const q = at(i); asp[q.vr] = Math.max(asp[q.vr], m.h/m.w); return q; });
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
    // Never larger than the page (a page made smaller since takes the plot down with it).
    const pw = Math.min(W, Math.max(5, F.plotW)), ph = Math.min(H, Math.max(5, F.plotH));
    iw = Math.max(1, Math.min((pw - innerW)/C, (ph - innerH)/sumAsp));
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
  const stack = (FONTS[F.font] || FONTS.Inter).stack, ink = F.ink, out = F.outlineColor || contrastOf(ink), page = contrastOf(F.bg);
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

/* ---- Preview: fitted to its pane, with a zoom and a pan on top (figure.js) ---- */
function applyView(){ svgEl.style.transformOrigin = 'center center'; svgEl.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`; }
function renderPreview(){
  if (!svgEl) return;
  const L = draw(svgEl, false), pane = svgEl.parentElement;
  const W = L.W*PX_MM, H = L.H*PX_MM, k = Math.min((pane.clientWidth - 24)/W, (pane.clientHeight - 24)/H, 1);
  svgEl.style.width = W*k + 'px'; svgEl.style.height = H*k + 'px';
  applyView();
  const G = L.grid, grid = G.bRows*G.bCols > 1 ? `${G.bCols} × ${G.bRows} blocks of ${G.cols} × ${G.rows} panels` : `${G.cols} × ${G.rows} panels`;
  if (dimEl) dimEl.textContent = `${sig3(L.W)} × ${sig3(L.H)} mm (plot ${sig3(L.plot.w)} × ${sig3(L.plot.h)}) · ${grid} · ${Math.round(L.W/25.4*F.dpi)} × ${Math.round(L.H/25.4*F.dpi)} px @ ${F.dpi} dpi`;
  // The locked fields show what was chosen.
  if (controlsEl){
    const set = (k, v) => { const el = controlsEl.querySelector(`[data-auto="${k}"]`); if (el) el.value = v; };
    set('rows', L.grid.rows); set('cols', L.grid.cols); set('bRows', L.grid.bRows); set('bCols', L.grid.bCols);
    set('plotW', sig3(L.plot.w)); set('plotH', sig3(L.plot.h));
  }
  lastPlot = L.plot;
}
function wireView(){
  const pane = svgEl.parentElement;
  const centre = ()=>{ const r = pane.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; };
  pane.addEventListener('wheel', e=>{
    e.preventDefault();
    const [cx, cy] = centre(), z2 = Math.min(24, Math.max(0.25, view.z*Math.exp(-e.deltaY*0.004)));
    const sx = (e.clientX - cx - view.x)/view.z, sy = (e.clientY - cy - view.y)/view.z;
    view.x = e.clientX - cx - z2*sx; view.y = e.clientY - cy - z2*sy; view.z = z2;
    applyView();
  }, { passive: false });
  let drag = null;
  pane.addEventListener('pointerdown', e=>{
    if (e.button !== 0) return;
    drag = { x: e.clientX - view.x, y: e.clientY - view.y };
    pane.setPointerCapture(e.pointerId); pane.classList.add('is-panning');
  });
  pane.addEventListener('pointermove', e=>{ if (!drag) return; view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; applyView(); });
  const end = ()=>{ drag = null; pane.classList.remove('is-panning'); };
  pane.addEventListener('pointerup', end);
  pane.addEventListener('pointercancel', end);
  pane.addEventListener('dblclick', ()=>{ view = { z: 1, x: 0, y: 0 }; applyView(); });
}

/* ---- Controls (figure.js's rows, fields and checks) ----
   Disabled, not hidden: a setting that means nothing while another is off stays in
   place, greyed (`off`). */
const numField = (attrs, value, min, max, off) => `<input type="text" inputmode="decimal" data-num="1" data-min="${min}" data-max="${max}" ${attrs} value="${esc(value)}"${off ? ' disabled' : ''}>`;
const num = (label, path, min, max, off) => `<label class="fig-row"><span>${label}</span>${numField(`data-p="${path}"`, get(path), min, max, off)}</label>`;
const chk = (label, path, title, off) => `<label class="fig-check"${title ? ` title="${esc(title)}"` : ''}><input type="checkbox" data-p="${path}"${get(path) ? ' checked' : ''}${off ? ' disabled' : ''}> ${label}</label>`;
const sel = (label, path, opts, off, shown) => `<label class="fig-row"><span>${label}</span><select data-p="${path}"${off ? ' disabled' : ''}>${opts.map(([v, t])=> `<option value="${v}"${String(shown ?? get(path)) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
// A value worked out until set by hand: the field shows it, locked, while its box is ticked.
const autoNum = (label, path, autoPath, min, max) => `<label class="fig-row"><span>${label}</span>${get(autoPath)
  ? `<input type="text" data-auto="${path}" disabled title="Chosen automatically">` : numField(`data-p="${path}"`, get(path), min, max)}</label>`;
function get(path){ return path.split('.').reduce((o, k)=> o == null ? undefined : o[k], F); }
function put(path, v){ const ks = path.split('.'), last = ks.pop(); const o = ks.reduce((o, k)=> (o[k] = o[k] || {}), F); o[last] = v; }

const HA = [['left', 'left'], ['center', 'centre'], ['right', 'right']], VA = [['top', 'top'], ['center', 'centre'], ['bottom', 'bottom']];
const GRIP = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;
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
    ${num('Width (mm)', 'wmm', 10, 1000)}
    ${num('Height (mm)', 'hmm', 10, 1000)}
    ${num('Export DPI', 'dpi', 50, 4800)}
    ${sel('Background', 'bg', [['#ffffff', 'white'], ['#000000', 'black']])}
    <label class="fig-row"><span>File name</span><input type="text" data-p="file" value="${esc(F.file)}"></label>
    ${chk('Auto margins', 'plotAuto', 'The images as large as the page allows, the names and bars outside them in the margins, the whole centred')}
    ${F.plotAuto ? `<label class="fig-row"><span>Plot width (mm)</span><input type="text" data-auto="plotW" disabled value="${sig3(lastPlot.w)}" title="Chosen by the auto margins"></label>
      <label class="fig-row"><span>Plot height (mm)</span><input type="text" data-auto="plotH" disabled value="${sig3(lastPlot.h)}" title="Chosen by the auto margins"></label>`
      : `<label class="fig-row"><span>Plot width (mm)</span>${numField('data-p="plotW"', F.plotW, 5, F.wmm)}</label><label class="fig-row"><span>Plot height (mm)</span>${numField('data-p="plotH"', F.plotH, 5, F.hmm)}</label>`}
    <label class="fig-row"><span>Alignment</span><button class="btn btn-sm fig-align" type="button" data-align-btn title="Align the plot on the page"${F.plotAuto ? ' disabled' : ''}>${ALIGN_ICON(F.align)}</button></label>
    <p class="txt-meta">The plot is the smallest rectangle round all the images.</p>
  </section>
  <section class="fig-sec"><h4>Layout</h4>
    ${chk('Grid chosen automatically', 'gridAuto', 'One block, the most compact rectangle: ⌈√N⌉ columns')}
    <div class="fig-subhead">Blocks</div>
    ${autoNum('Rows', 'bRows', 'gridAuto', 1, 20)}
    ${autoNum('Columns', 'bCols', 'gridAuto', 1, 20)}
    ${num('Gap (mm)', 'bGap', 0, 40)}
    <div class="fig-subhead">Panels in a block</div>
    ${autoNum('Rows', 'rows', 'gridAuto', 1, 40)}
    ${autoNum('Columns', 'cols', 'gridAuto', 1, 40)}
    ${num('Gap (mm)', 'gap', 0, 20)}
    <p class="txt-meta">The images fill one block after another, each row by row: 2 × 1 blocks of 2 × 2 panels hold eight.</p>
  </section>
  <section class="fig-sec"><div class="sem-fig-sechead"><h4>Images</h4><button class="btn primary btn-sm" type="button" data-act="order" title="The panels back in the file list's order">Restore</button></div>
    <div class="fig-series">${imgs.map((m, i)=> `<div class="fig-serie" data-s="${i}">
      <span class="fig-grip" title="Drag to reorder">${GRIP}</span>
      <input type="text" class="fig-slabel" data-name="${esc(m.id)}" value="${esc(F.names[m.id] != null ? F.names[m.id] : m.label)}" title="Name shown on ${esc(m.label)}"${L.on ? '' : ' disabled'}>
    </div>`).join('')}</div>
  </section>
  <section class="fig-sec"><h4>Names</h4>
    ${chk('Show the names', 'label.on')}
    ${chk('Placed automatically', 'label.auto', 'Outside where there is room: above the first row, below the last; inside the rows between, at the top for the first half (and the middle row), at the bottom for the second. Upright names go by columns: left and right.', namesOff)}
    ${sel('Orientation', 'label.orient', [['h', 'horizontal'], ['v', 'vertical']], namesOff)}
    ${sel('Horizontal', 'label.ha', L.auto && vName ? [['auto', 'by column']] : HA, namesOff || (L.auto && vName), L.auto && vName ? 'auto' : null)}
    ${sel('Vertical', 'label.va', L.auto && !vName ? [['auto', 'by row']] : VA, namesOff || (L.auto && !vName), L.auto && !vName ? 'auto' : null)}
    ${sel('Position', 'label.pos', L.auto ? [['auto', vName ? 'by column' : 'by row']] : [['in', 'inside'], ['out', 'outside']], namesOff || L.auto, L.auto ? 'auto' : null)}
    ${num('Size (pt)', 'label.size', 3, 36, namesOff)}
  </section>
  <section class="fig-sec"><h4>Letters</h4>
    ${chk('Show letters (a, b, c… in the panels\' order)', 'letter.on')}
    ${sel('Style', 'letter.style', [['a', 'a'], ['(a)', '(a)'], ['A', 'A'], ['(A)', '(A)']], !Lt.on)}
    ${chk('At the start of the name', 'letter.link', 'Written before the name, where the name is, in its size', !Lt.on)}
    ${sel('Position', 'letter.pos', [['in', 'inside'], ['out', 'outside']], !Lt.on || Lt.link)}
    ${sel('Vertical', 'letter.va', [['top', 'top'], ['bottom', 'bottom']], !Lt.on || Lt.link)}
    ${sel('Horizontal', 'letter.ha', [['left', 'left'], ['right', 'right']], !Lt.on || Lt.link)}
    ${num('Size (pt)', 'letter.size', 3, 36, !Lt.on || Lt.link)}
  </section>
  <section class="fig-sec"><h4>Scale bars</h4>
    <label class="fig-check" title="${own ? 'At its own scale every image has its own bar' : 'One bar on every panel, rather than one on the last'}"><input type="checkbox" data-p="bar.each"${B.each || own ? ' checked' : ''}${own ? ' disabled' : ''}> One bar per image</label>
    ${sel('Position', 'bar.pos', [['in', 'inside'], ['out', 'outside']])}
    ${sel('Vertical', 'bar.va', [['top', 'top'], ['bottom', 'bottom']])}
    ${sel('Horizontal', 'bar.ha', [['left', 'left'], ['right', 'right']])}
    ${num('Thickness (mm)', 'bar.thick', 0.1, 5)}
    ${num('Text size (pt)', 'bar.size', 3, 36)}
    ${barRows.join('')}
  </section>
  <section class="fig-sec"><h4>Type</h4>
    ${sel('Font', 'font', Object.entries(FONTS).map(([k, v])=> [k, v.label]))}
    <label class="fig-row"><span>Colour on the images</span><button class="color-swatch" type="button" data-ink="ink" data-color="${esc(F.ink)}" style="background:${esc(F.ink)}" title="Names, letters and scale bars over the images"></button></label>
    ${chk('Outline, for contrast with the image', 'outline')}
    <label class="fig-row"><span>Outline colour</span><button class="color-swatch" type="button" data-ink="outlineColor" data-color="${esc(F.outlineColor || contrastOf(F.ink))}" style="background:${esc(F.outlineColor || contrastOf(F.ink))}" title="The outline round what is drawn over the images"${F.outline ? '' : ' disabled'}></button></label>
  </section>`;
}
function renderControls(){
  if (!controlsEl) return;
  rebuilding = true;
  colorPickerUI.close(); alignPicker.close();   // their buttons are about to be replaced
  const st = controlsEl.scrollTop;
  controlsEl.innerHTML = controlsHtml();
  controlsEl.scrollTop = st;
  rebuilding = false;
  wireOrderDrag();
  renderPreview();
}
/* The images' rows reordered by their handles, as the plots' series are (figure.js):
   what lights is the gap a row would land in (dropGap); the two beside it would leave
   it where it is, and never light. */
function wireOrderDrag(){
  const rows = [...controlsEl.querySelectorAll('.fig-serie[data-s]')];
  let from = null;
  const gapOf = e =>{ const g = dropGap(rows, e.clientY); return g === from || g === from + 1 ? null : g; };
  const clear = ()=> rows.forEach(r=> r.classList.remove('drop-before', 'drop-after', 'dragging'));
  rows.forEach(row=>{
    const handle = row.querySelector('.fig-grip');
    handle.addEventListener('pointerdown', e=>{ e.preventDefault(); from = +row.dataset.s; row.classList.add('dragging'); try { handle.setPointerCapture(e.pointerId); } catch(_){} });
    handle.addEventListener('pointermove', e=>{
      if (from == null) return;
      rows.forEach(r=> r.classList.remove('drop-before', 'drop-after'));
      const g = gapOf(e);
      if (g == null) return;
      if (g < rows.length) rows[g].classList.add('drop-before'); else rows[rows.length - 1].classList.add('drop-after');
    });
    handle.addEventListener('pointerup', e=>{
      if (from == null) return;
      const g = gapOf(e), f = from;
      from = null; clear();
      if (g == null) return;
      const ids = ordered().map(m=> m.id), [id] = ids.splice(f, 1);
      ids.splice(g > f ? g - 1 : g, 0, id);
      F.order = ids; commit(true);
    });
    handle.addEventListener('pointercancel', ()=>{ from = null; clear(); });
  });
}
// Every change goes back to the module (saved, undoable), then is drawn; `rebuild` when
// the controls themselves change (a box that locks a field, the order of the names).
function commit(rebuild){
  host.setFig(clone(F));
  if (rebuild) renderControls(); else renderPreview();
}
const STRUCTURAL = new Set(['wmm', 'hmm', 'plotAuto', 'gridAuto', 'label.on', 'label.auto', 'label.orient', 'letter.on', 'letter.link', 'outline']);
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
      const v = readNum(t); if (v == null) return;
      F.bars[key] = { ...cur, auto: false, um: v }; commit(false); return;
    }
    const path = t.dataset.p; if (!path) return;
    let v;
    if (t.type === 'checkbox') v = t.checked;
    else if (t.dataset.num){ v = readNum(t); if (v == null) return; }
    else v = t.value;
    // Unlocked, a field starts from the value that was being chosen for it.
    if (path === 'plotAuto' && !v){ F.plotW = +sig3(lastPlot.w); F.plotH = +sig3(lastPlot.h); }
    if (path === 'gridAuto' && !v){ const G = layout().grid; F.rows = G.rows; F.cols = G.cols; F.bRows = G.bRows; F.bCols = G.bCols; }
    put(path, v);
    const GRID = ['rows', 'cols', 'bRows', 'bCols'];
    // Too few places for the images: block rows are added.
    if (GRID.includes(path)){ const n = ordered().length; F.bRows = Math.max(F.bRows, Math.ceil(n/(F.rows*F.cols*F.bCols))); }
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
      colorPickerUI.open(sw, key === 'ink' ? F.ink : (F.outlineColor || contrastOf(F.ink)), c=>{ F[key] = c; sw.style.background = c; sw.dataset.color = c; commit(false); });
    }
  });
}
// A field's number, inside its range; outside it the field shakes and goes back.
// The field stays (rebuilt, it would take its shake with it) and goes back to the last
// value it took.
function readNum(t){
  const v = parseFloat(String(t.value).replace(',', '.')), lo = +t.dataset.min, hi = +t.dataset.max;
  if (!Number.isFinite(v) || v < lo || v > hi){ flashFieldInvalid(t); t.value = t.defaultValue; return null; }
  t.defaultValue = String(v);
  return v;
}

/* ---- Export ---- */
async function svgString(){
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const L = draw(tmp, true);
  if ((FONTS[F.font] || FONTS.Inter).embed){
    const css = await interFontCss();
    if (css){ const st = document.createElementNS('http://www.w3.org/2000/svg', 'style'); st.textContent = css; tmp.insertBefore(st, tmp.firstChild); }
  }
  tmp.setAttribute('width', L.W + 'mm'); tmp.setAttribute('height', L.H + 'mm');
  return { str: new XMLSerializer().serializeToString(tmp), L };
}
// The figure at the chosen dpi. Through a blob URL: the drawing holds the images at
// full size, too long a string for a data URL.
async function pngBlob(){
  const { str, L } = await svgString();
  const scale = F.dpi/25.4, cv = document.createElement('canvas');
  cv.width = Math.round(L.W*scale); cv.height = Math.round(L.H*scale);
  const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((res, rej)=>{ img.onload = res; img.onerror = ()=> rej(new Error('render failed')); img.src = url; });
    const ctx = cv.getContext('2d');
    ctx.fillStyle = F.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
  } finally { URL.revokeObjectURL(url); }
  return new Promise((res, rej)=> cv.toBlob(b=> b ? res(b) : rej(new Error('no blob')), 'image/png'));
}
async function copyPng(btn){
  const done = txt => { btn.textContent = txt; setTimeout(()=>{ btn.textContent = 'Copy PNG'; }, 1200); };
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })]); done('Copied'); }
  catch(e){ try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await pngBlob() })]); done('Copied'); } catch(e2){ done('Copy failed'); } }
}

// A page with no height yet (a new figure, or one whose height followed the layout
// before v449): as tall as the images need at its width.
function fillHeight(){ if (!(F.hmm > 0)) F.hmm = Math.max(10, Math.round(layout().natural(F.wmm)*10)/10); }

/* ---- Opening ----
   h: { title (the group's name), images() → [{ id, label, group {id, name, mode}, w, h,
        pxNm, key, canvas(fit) }], getFig(), setFig(fig) }. Returns { refresh, close }: refresh after the module's
   state changed under it (an undo). */
export function openSemFigure(h){
  host = h; F = withDefaults(h.getFig());
  // A group's figure is named after it until named otherwise.
  if (!(h.getFig() && h.getFig().file) && h.title) F.file = 'SEM_' + String(h.title).replace(/[^\w.-]+/g, '_');
  fillHeight();
  view = { z: 1, x: 0, y: 0 };
  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fig-backdrop';
  backdrop.lang = 'en';
  backdrop.innerHTML = `
    <div class="fig-box">
      <div class="fig-head">
        <h3 class="txt-head" style="margin:0">Figure composer</h3>
        <button class="fig-x close-x" type="button" aria-label="Close">✕</button>
      </div>
      <div class="fig-body">
        <div class="fig-preview"><svg class="fig-svg sem-fig-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
        <div class="fig-controls"></div>
      </div>
      <div class="fig-foot">
        <span class="txt-meta fig-dim"></span>
        <span style="flex:1"></span>
        <button class="btn btn-sm" type="button" data-fig-reset title="Every setting back to its default">Reset</button>
        <button class="btn btn-sm" type="button" data-fig-svg title="Save the figure as a vector file, with the images in it">Export SVG</button>
        <button class="btn btn-sm" type="button" data-fig-png title="Save the figure as an image at the chosen dpi">Export PNG</button>
        <button class="btn primary" type="button" data-fig-copy title="Copy the figure to the clipboard">Copy PNG</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  svgEl = backdrop.querySelector('.fig-svg'); controlsEl = backdrop.querySelector('.fig-controls'); dimEl = backdrop.querySelector('.fig-dim');
  wireControls(); wireView();
  const close = ()=>{
    document.removeEventListener('keydown', onKey); window.removeEventListener('resize', renderPreview);
    colorPickerUI.close(); alignPicker.close();
    backdrop.remove(); backdrop = svgEl = controlsEl = dimEl = null; F = null; host = null; urls.clear();
    api.open = false;
  };
  const onKey = e=>{ if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', renderPreview);
  backdrop.querySelector('.fig-x').addEventListener('click', close);
  backdrop.addEventListener('click', e=>{ if (e.target === backdrop) close(); });
  backdrop.querySelector('[data-fig-reset]').addEventListener('click', ()=>{ F = withDefaults({ file: F.file }); fillHeight(); commit(true); });
  backdrop.querySelector('[data-fig-svg]').addEventListener('click', async ()=>{ saveBlob((F.file || 'SEM_figure') + '.svg', (await svgString()).str, 'image/svg+xml'); });
  backdrop.querySelector('[data-fig-png]').addEventListener('click', async ()=>{ saveBlob((F.file || 'SEM_figure') + '.png', await pngBlob()); });
  const copyBtn = backdrop.querySelector('[data-fig-copy]');
  if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) copyBtn.addEventListener('click', ()=> copyPng(copyBtn));
  else { copyBtn.remove(); backdrop.querySelector('[data-fig-png]').classList.replace('btn-sm', 'primary'); }
  requestAnimationFrame(renderControls);
  const api = { open: true, refresh(){ if (!backdrop) return; F = withDefaults(host.getFig()); fillHeight(); renderControls(); }, close };
  return api;
}

export { FIG_DEF, niceBar, lenText };
