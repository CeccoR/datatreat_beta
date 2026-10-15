import { colorPickerUI, flashFieldInvalid, dropGap } from './utils.js';
import { FONTS, PX_MM, PT_PX, saveBlob, interFontCss } from './figure.js';

/* =========================================================
   SEM FIGURE
   The SEM images laid out for a paper, as the figure composer lays out plots
   (figure.js): one drawing in real millimetres, previewed as it will be exported, with
   the composer's page, fonts and export. No axes and no legend: a grid of image panels,
   each with its sample's name, optionally a letter, and the scale bars.

   The grid is the most compact rectangle for the images (columns ⌈√N⌉, rows ⌈N/cols⌉:
   12 images 4 × 3, not 6 × 2) unless set by hand, the panels in the order of the images'
   rows, which their handles reorder. By hand it has two levels: blocks of panels (2 × 1
   blocks of 2 × 2 panels hold eight images), with a gap between panels and another
   between blocks. Names and scale bars go in a corner of the image or outside it (above,
   below, left, right), in bands kept the same for every panel so that the grid stays
   aligned. A group at common scale
   (sem.js) has one scale bar, in its last panel in the figure's order; at its own scale
   every panel has its own. A bar's length is a round 1, 2 or 5 × 10ⁿ near a fifth of the
   panel unless typed (any value). The images come in their figure's pixels (sem.js
   outCanvas): a reduced copy for the preview, the full one for the export.

   One figure a group (sem.js): its images, and its settings, which are the SEM module's
   (saved with the project, undone with it): the host gives them (getFig) and takes them
   back (setFig) on every change.
========================================================= */

const MM_PT = 25.4/72;
const FIG_DEF = {
  file: 'SEM_figure', wmm: 175, hmm: 120, hAuto: true, dpi: 600, bg: '#ffffff',
  gridAuto: true, rows: 1, cols: 1, gap: 1, bRows: 1, bCols: 1, bGap: 4,
  order: [], names: {},
  label: { on: true, pos: 'tl', size: 8 },
  letter: { on: false, style: '(a)', pos: 'tl', link: false, size: 9 },
  bar: { pos: 'br', thick: 0.7, size: 7 },
  bars: {},
  ink: '#ffffff', outline: true, font: 'Inter',
};
// The settings filled with the defaults wherever a project lacks them.
function withDefaults(f){
  const o = { ...FIG_DEF, ...(f || {}) };
  for (const k of ['label', 'letter', 'bar']) o[k] = { ...FIG_DEF[k], ...((f || {})[k] || {}) };
  o.order = (f && f.order || []).slice(); o.names = { ...(f && f.names || {}) }; o.bars = { ...(f && f.bars || {}) };
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
   Each panel is a cell: the image with bands around it for what is drawn outside it
   (names, letters above, scale bars), the same for every panel so that the grid stays
   aligned. Next to the image a scale bar's band, outside it the name's. The columns
   are equal; an image row is as tall as the tallest image in it across its block row.
   { W, H, grid, bands, panels: [{ m, k, x, y, w, h (the image), cx, cy (its cell's
   top left), rowH (its image row's height) }] }. */
const lineOf = pt => pt*MM_PT*1.35;
function bandsOf(){
  const lp = F.label.on ? F.label.pos : null, bp = F.bar.pos;
  const letterAbove = F.letter.on && !F.letter.link && F.letter.pos === 'above';
  const bar = F.bar.thick + lineOf(F.bar.size) + 0.6, name = lineOf(F.label.size);
  return {
    bar, name,
    top: Math.max(lp === 'above' ? name : 0, letterAbove ? lineOf(F.letter.size) : 0) + (bp === 'above' ? bar : 0),
    bottom: (lp === 'below' ? name : 0) + (bp === 'below' ? bar : 0),
    left: (lp === 'left' ? name : 0) + (bp === 'left' ? bar : 0),
    right: (lp === 'right' ? name : 0) + (bp === 'right' ? bar : 0),
  };
}
function layout(){
  const imgs = ordered(), n = imgs.length, G = gridOf(n), { rows, cols, bRows, bCols } = G;
  const g = F.gap, bg = F.bGap, W = F.wmm, B = bandsOf();
  const per = rows*cols, at = i => { const b = Math.floor(i/per), j = i % per; return { br: Math.floor(b/bCols), bc: b % bCols, r: Math.floor(j/cols), c: j % cols }; };
  // Each image row's height over the image width: its tallest image's.
  const asp = Array.from({ length: bRows }, ()=> new Array(rows).fill(0));
  imgs.forEach((m, i)=>{ const q = at(i); asp[q.br][q.r] = Math.max(asp[q.br][q.r], m.h/m.w); });
  const used = asp.map(rr=> rr.filter(a=> a > 0).length);
  let iw = Math.max(1, (W - (bCols - 1)*bg - bCols*(cols - 1)*g)/(bCols*cols) - B.left - B.right);
  const fixed = asp.reduce((t, rr, br)=> t + used[br]*(B.top + B.bottom) + Math.max(0, used[br] - 1)*g, 0) + Math.max(0, asp.filter((_, br)=> used[br]).length - 1)*bg;
  const sumAsp = asp.flat().reduce((a, b)=> a + b, 0);
  let H = fixed + sumAsp*iw;
  // A height set by hand: the images narrowed to fit it (never widened), centred.
  if (!F.hAuto){ H = F.hmm; if (sumAsp > 0) iw *= Math.min(1, Math.max(0.05, (H - fixed)/(sumAsp*iw))); }
  const cellW = B.left + iw + B.right, blockW = cols*cellW + (cols - 1)*g, usedW = bCols*blockW + (bCols - 1)*bg;
  const x0 = (W - usedW)/2, y0 = F.hAuto ? 0 : Math.max(0, (H - fixed - sumAsp*iw)/2);
  // Where each image row starts.
  const rowY = [], rowH = [];
  let y = y0;
  for (let br = 0; br < bRows; br++){
    rowY.push([]); rowH.push([]);
    if (!used[br]) continue;
    for (let r = 0; r < rows; r++){
      rowY[br][r] = y; rowH[br][r] = asp[br][r]*iw;
      if (asp[br][r] > 0) y += B.top + asp[br][r]*iw + B.bottom + g;
    }
    y += bg - g;
  }
  const panels = imgs.map((m, i)=>{
    const q = at(i), cx = x0 + q.bc*(blockW + bg) + q.c*(cellW + g), cy = rowY[q.br][q.r], rh = rowH[q.br][q.r], h = iw*m.h/m.w;
    return { m, k: i, x: cx + B.left, y: cy + B.top + (rh - h)/2, w: iw, h, cx, cy, rowH: rh };
  });
  return { W, H, panels, grid: G, bands: B };
}

/* ---- Drawing ---- */
function draw(svg, full){
  const L = layout(), B = L.bands, px = v => v*PX_MM, NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${px(L.W)} ${px(L.H)}`);
  const add = (tag, at, parent) => { const el = document.createElementNS(NS, tag); for (const k in at) el.setAttribute(k, at[k]); (parent || svg).appendChild(el); return el; };
  add('rect', { x: 0, y: 0, width: px(L.W), height: px(L.H), fill: F.bg });
  const stack = (FONTS[F.font] || FONTS.Inter).stack, ink = F.ink, out = contrastOf(ink), page = contrastOf(F.bg);
  // Text over the images in the chosen colour, with an outline so that it reads on any
  // grey; outside them, on the page, in the colour that reads on it. rot: −90 reads up,
  // 90 down.
  const text = (str, x, y, pt, anchor, bold, onImage, rot) => {
    const fs = pt*PT_PX, t = add('text', { x, y, 'font-size': fs, 'font-family': stack, 'text-anchor': anchor, fill: onImage ? ink : page, ...(bold ? { 'font-weight': 700 } : {}), ...(rot ? { transform: `rotate(${rot} ${x} ${y})` } : {}) });
    if (onImage && F.outline){ t.setAttribute('stroke', out); t.setAttribute('stroke-width', fs*0.12); t.setAttribute('stroke-linejoin', 'round'); t.setAttribute('paint-order', 'stroke'); }
    t.textContent = str;
    return t;
  };
  const inside = pos => pos.length === 2;
  // Which panels carry a scale bar: a group at common scale its last panel, else each.
  const lastOf = new Map();
  L.panels.forEach(p=>{ if (p.m.group.mode !== 'own') lastOf.set(p.m.group.id, p); });
  const margin = 1.5;
  for (const p of L.panels){
    const g = add('g', { 'data-i': p.k, class: 'sem-fig-panel' });
    add('image', { x: px(p.x), y: px(p.y), width: px(p.w), height: px(p.h), href: urlOf(p.m, full), preserveAspectRatio: 'none' }, g);
    const name = F.names[p.m.id] != null ? F.names[p.m.id] : p.m.label;
    const letter = F.letter.on ? letterOf(p.k, F.letter.style) : '';
    const lab = F.label.on ? (letter && F.letter.link ? `${letter} ${name}` : name) : (letter && F.letter.link ? letter : '');
    const rowBottom = p.cy + B.top + p.rowH, imgL = p.x, imgR = p.x + p.w;
    // A corner of the image: its text's x, anchor and the baseline of line `line`.
    const corner = (pos, pt, line) => {
      const fs = px(pt*MM_PT), right = pos[1] === 'r', bottom = pos[0] === 'b';
      const x = right ? px(p.x + p.w - margin) : px(p.x + margin), a = right ? 'end' : 'start';
      const y = bottom ? px(p.y + p.h - margin) - line*fs*1.2 : px(p.y + margin) + fs*0.82 + line*fs*1.2;
      return { x, y, a };
    };
    let labelEl = null;
    const letterAbove = letter && !F.letter.link && F.letter.pos === 'above';
    if (lab){
      const pos = F.label.pos, nb = B.name, bp = F.bar.pos;
      // Above, with the letter above too: one line, the letter (bold, its size) then the
      // name, on one baseline, so that no width has to be guessed.
      if (pos === 'above' && letterAbove){
        const t = text('', px(imgL), px(p.cy + Math.max(nb, lineOf(F.letter.size))*0.78), F.label.size, 'start', false, false);
        add('tspan', { 'font-weight': 700, 'font-size': F.letter.size*PT_PX }, t).textContent = letter;
        add('tspan', {}, t).textContent = ' ' + lab;
        labelEl = t;
      }
      else if (pos === 'above') labelEl = text(lab, px(imgL), px(p.cy + nb*0.78), F.label.size, 'start', false, false);
      else if (pos === 'below') labelEl = text(lab, px(imgL), px(rowBottom + (bp === 'below' ? B.bar : 0) + nb*0.78), F.label.size, 'start', false, false);
      // At the sides, along the image, reading up on the left and down on the right.
      else if (pos === 'left') labelEl = text(lab, px(p.cx + nb*0.78), px(p.y + p.h/2), F.label.size, 'middle', false, false, -90);
      else if (pos === 'right') labelEl = text(lab, px(imgR + (bp === 'right' ? B.bar : 0) + nb*0.22), px(p.y + p.h/2), F.label.size, 'middle', false, false, 90);
      else { const c = corner(pos, F.label.size, 0); labelEl = text(lab, c.x, c.y, F.label.size, c.a, false, true); }
    }
    if (letter && !F.letter.link){
      const pos = F.letter.pos, lfs = px(F.letter.size*MM_PT);
      if (pos === 'above'){
        // The name above too: written with it, on its line.
        if (!(labelEl && F.label.pos === 'above')) text(letter, px(imgL), px(p.cy + lineOf(F.letter.size)*0.78), F.letter.size, 'start', true, false);
      } else {
        // In the name's corner: the letter at the corner, the name a line further in.
        if (labelEl && F.label.pos === pos) labelEl.setAttribute('y', +labelEl.getAttribute('y') + (pos[0] === 'b' ? -1 : 1)*lfs*1.2);
        const c = corner(pos, F.letter.size, 0);
        text(letter, c.x, c.y, F.letter.size, c.a, true, true);
      }
    }
    const grp = p.m.group;
    if (grp.mode === 'own' || lastOf.get(grp.id) === p){
      const umW = p.m.w*p.m.pxNm/1000, set = F.bars[grp.mode === 'own' ? p.m.id : grp.id];
      const um = set && !set.auto && set.um > 0 ? set.um : niceBar(umW);
      const bw = p.w*um/umW, t = F.bar.thick, fs = F.bar.size*MM_PT, pos = F.bar.pos, label = lenText(um), tw = label.length*fs*0.56;
      const bar = (x, y, w, h, onImage) => {
        const r = add('rect', { x: px(x), y: px(y), width: px(w), height: px(h), fill: onImage ? ink : page });
        if (onImage && F.outline){ r.setAttribute('stroke', out); r.setAttribute('stroke-width', px(Math.min(w, h))*0.35); r.setAttribute('paint-order', 'stroke'); }
      };
      if (inside(pos)){
        const right = pos[1] === 'r', bottom = pos[0] === 'b';
        const bx = right ? p.x + p.w - margin - bw : p.x + margin, by = bottom ? p.y + p.h - margin - t : p.y + margin + fs*1.15;
        bar(bx, by, bw, t, true);
        // The length centred over the bar, or, wider than a short bar, flush with its
        // outer end, so that it stays inside the panel.
        const [tx, ta] = tw <= bw ? [bx + bw/2, 'middle'] : right ? [bx + bw, 'end'] : [bx, 'start'];
        text(label, px(tx), px(by) - px(fs)*0.3, F.bar.size, ta, false, true);
      } else if (pos === 'above' || pos === 'below'){
        // Outside, next to the image, flush with its right edge: the length above the
        // bar over the image, under it below.
        const bx = imgR - bw, by = pos === 'above' ? p.y - 0.4 - t : rowBottom + 0.4;
        bar(bx, by, bw, t, false);
        const [tx, ta] = tw <= bw ? [bx + bw/2, 'middle'] : [imgR, 'end'];
        text(label, px(tx), pos === 'above' ? px(by) - px(fs)*0.3 : px(by + t) + px(fs)*0.95, F.bar.size, ta, false, false);
      } else {
        // At a side, upright along the image from its bottom, the length along it.
        const bx = pos === 'left' ? imgL - 0.4 - t : imgR + 0.4, by = p.y + p.h - bw;
        bar(bx, by, t, bw, false);
        const fits = tw <= bw, ty = fits ? p.y + p.h - bw/2 : p.y + p.h;
        if (pos === 'left') text(label, px(bx - fs*0.3), px(ty), F.bar.size, fits ? 'middle' : 'start', false, false, -90);
        else text(label, px(bx + t + fs*0.3), px(ty), F.bar.size, fits ? 'middle' : 'end', false, false, 90);
      }
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
  if (dimEl) dimEl.textContent = `${sig3(L.W)} × ${sig3(L.H)} mm · ${grid} · ${Math.round(L.W/25.4*F.dpi)} × ${Math.round(L.H/25.4*F.dpi)} px @ ${F.dpi} dpi`;
  // The locked fields show what was chosen.
  if (controlsEl){
    const set = (k, v) => { const el = controlsEl.querySelector(`[data-auto="${k}"]`); if (el) el.value = v; };
    set('rows', L.grid.rows); set('cols', L.grid.cols); set('bRows', L.grid.bRows); set('bCols', L.grid.bCols); set('hmm', sig3(L.H));
  }
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

/* ---- Controls (figure.js's rows, fields and checks) ---- */
const numField = (attrs, value, min, max) => `<input type="text" inputmode="decimal" data-num="1" data-min="${min}" data-max="${max}" ${attrs} value="${esc(value)}">`;
const num = (label, path, min, max) => `<label class="fig-row"><span>${label}</span>${numField(`data-p="${path}"`, get(path), min, max)}</label>`;
const chk = (label, path, title) => `<label class="fig-check"${title ? ` title="${esc(title)}"` : ''}><input type="checkbox" data-p="${path}"${get(path) ? ' checked' : ''}> ${label}</label>`;
const sel = (label, path, opts) => `<label class="fig-row"><span>${label}</span><select data-p="${path}">${opts.map(([v, t])=> `<option value="${v}"${String(get(path)) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
// A value worked out until set by hand: the field shows it, locked, while its box is ticked.
const autoNum = (label, path, autoPath, min, max) => `<label class="fig-row"><span>${label}</span>${get(autoPath)
  ? `<input type="text" data-auto="${path}" disabled title="Chosen automatically">` : numField(`data-p="${path}"`, get(path), min, max)}</label>`;
function get(path){ return path.split('.').reduce((o, k)=> o == null ? undefined : o[k], F); }
function put(path, v){ const ks = path.split('.'), last = ks.pop(); const o = ks.reduce((o, k)=> (o[k] = o[k] || {}), F); o[last] = v; }

const CORNERS = [['tl', 'top left'], ['tr', 'top right'], ['bl', 'bottom left'], ['br', 'bottom right']];
const OUTSIDE = [['above', 'outside, above'], ['below', 'outside, below'], ['left', 'outside, left'], ['right', 'outside, right']];
const GRIP = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;
function controlsHtml(){
  const imgs = ordered();
  // The groups, each with its bar's length: one for a group at common scale, one per
  // image at its own.
  const barRows = [];
  const seen = new Set();
  for (const m of imgs){
    const g = m.group, key = g.mode === 'own' ? m.id : g.id;
    if (seen.has(key)) continue; seen.add(key);
    const set = F.bars[key] || { auto: true, um: 1 }, auto = set.auto !== false;
    const nice = niceBar(m.w*m.pxNm/1000);
    barRows.push(`<div class="fig-subhead">${esc(g.mode === 'own' ? `${g.name}: ${m.label}` : g.name)}</div>
      <label class="fig-check"><input type="checkbox" data-bar="${esc(key)}" data-bark="auto"${auto ? ' checked' : ''}> Length chosen automatically</label>
      <label class="fig-row"><span>Length (µm)</span>${auto ? `<input type="text" value="${sig3(nice)}" disabled title="Chosen automatically: a round length near a fifth of the panel">`
        : numField(`data-bar="${esc(key)}" data-bark="um"`, set.um ?? nice, 0.0001, 100000)}</label>`);
  }
  return `
  <section class="fig-sec"><h4>Figure</h4>
    ${num('Width (mm)', 'wmm', 10, 1000)}
    ${chk('Height from the layout', 'hAuto', 'The images at the width, one under another as the grid puts them')}
    ${autoNum('Height (mm)', 'hmm', 'hAuto', 10, 1000)}
    ${num('Export DPI', 'dpi', 50, 4800)}
    ${sel('Background', 'bg', [['#ffffff', 'white'], ['#000000', 'black']])}
    <label class="fig-row"><span>File name</span><input type="text" data-p="file" value="${esc(F.file)}"></label>
  </section>
  <section class="fig-sec"><h4>Layout</h4>
    ${chk('Grid chosen automatically', 'gridAuto', 'One block, the most compact rectangle: ⌈√N⌉ columns')}
    <div class="fig-subhead">Panels in a block</div>
    ${autoNum('Rows', 'rows', 'gridAuto', 1, 40)}
    ${autoNum('Columns', 'cols', 'gridAuto', 1, 40)}
    ${num('Gap (mm)', 'gap', 0, 20)}
    <div class="fig-subhead">Blocks</div>
    ${autoNum('Rows', 'bRows', 'gridAuto', 1, 20)}
    ${autoNum('Columns', 'bCols', 'gridAuto', 1, 20)}
    ${num('Gap (mm)', 'bGap', 0, 40)}
    <p class="txt-meta">The images fill one block after another, each row by row: 2 × 1 blocks of 2 × 2 panels hold eight.</p>
  </section>
  <section class="fig-sec"><h4>Images</h4>
    <div class="fig-series">${imgs.map((m, i)=> `<div class="fig-serie" data-s="${i}">
      <span class="fig-grip" title="Drag to reorder">${GRIP}</span>
      <input type="text" class="fig-slabel" data-name="${esc(m.id)}" value="${esc(F.names[m.id] != null ? F.names[m.id] : m.label)}" title="Name shown on ${esc(m.label)}">
    </div>`).join('')}</div>
    <label class="fig-row"><span>Order</span><button class="btn btn-sm" type="button" data-act="order">As the file list</button></label>
    <p class="txt-meta">Drag an image by its handle to reorder the panels; its field is the name shown on it.</p>
  </section>
  <section class="fig-sec"><h4>Names</h4>
    ${chk('Show the names', 'label.on')}
    ${sel('Position', 'label.pos', [...CORNERS, ...OUTSIDE])}
    ${num('Size (pt)', 'label.size', 3, 36)}
  </section>
  <section class="fig-sec"><h4>Letters</h4>
    ${chk('Show letters (a, b, c… in the panels\' order)', 'letter.on')}
    ${sel('Style', 'letter.style', [['a', 'a'], ['(a)', '(a)'], ['A', 'A'], ['(A)', '(A)']])}
    ${chk('At the start of the name', 'letter.link', 'The letter written before the sample\'s name, where the name is')}
    ${sel('Position', 'letter.pos', [...CORNERS, ['above', 'above the image']])}
    ${num('Size (pt)', 'letter.size', 3, 36)}
  </section>
  <section class="fig-sec"><h4>Scale bars</h4>
    ${sel('Position', 'bar.pos', [...CORNERS, ...OUTSIDE])}
    ${num('Thickness (mm)', 'bar.thick', 0.1, 5)}
    ${num('Text size (pt)', 'bar.size', 3, 36)}
    ${barRows.join('')}
  </section>
  <section class="fig-sec"><h4>Type</h4>
    ${sel('Font', 'font', Object.entries(FONTS).map(([k, v])=> [k, v.label]))}
    <label class="fig-row"><span>Colour on the images</span><button class="color-swatch" type="button" data-ink data-color="${esc(F.ink)}" style="background:${esc(F.ink)}" title="Names, letters and scale bars over the images"></button></label>
    ${chk('Outline, for contrast with the image', 'outline')}
  </section>`;
}
function renderControls(){
  if (!controlsEl) return;
  rebuilding = true;
  const st = controlsEl.scrollTop;
  controlsEl.innerHTML = controlsHtml();
  controlsEl.scrollTop = st;
  // Disabled, not hidden: a letter's own position means nothing while it is written
  // with the name; nor the names' settings while they are off.
  const dis = (path, off) => controlsEl.querySelectorAll(`[data-p="${path}"]`).forEach(el=> { el.disabled = off; });
  dis('letter.pos', !F.letter.on || F.letter.link); dis('letter.style', !F.letter.on); dis('letter.link', !F.letter.on); dis('letter.size', !F.letter.on);
  dis('label.pos', !F.label.on); dis('label.size', !F.label.on);
  controlsEl.querySelectorAll('[data-name]').forEach(el=>{ el.disabled = !F.label.on; });
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
const STRUCTURAL = new Set(['hAuto', 'gridAuto', 'label.on', 'letter.on', 'letter.link']);
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
    if (path === 'hAuto' && !v) F.hmm = +sig3(layout().H);
    if (path === 'gridAuto' && !v){ const G = layout().grid; F.rows = G.rows; F.cols = G.cols; F.bRows = G.bRows; F.bCols = G.bCols; }
    put(path, v);
    const GRID = ['rows', 'cols', 'bRows', 'bCols'];
    // Too few places for the images: block rows are added.
    if (GRID.includes(path)){ const n = ordered().length; F.bRows = Math.max(F.bRows, Math.ceil(n/(F.rows*F.cols*F.bCols))); }
    commit(STRUCTURAL.has(path) || GRID.includes(path));
  });
  controlsEl.addEventListener('click', e=>{
    const b = e.target.closest('[data-act="order"]');
    if (b){ F.order = []; commit(true); return; }
    const sw = e.target.closest('[data-ink]');
    if (sw){ e.stopPropagation(); colorPickerUI.open(sw, F.ink, c=>{ F.ink = c; sw.style.background = c; sw.dataset.color = c; commit(false); }); }
  });
}
// A field's number, inside its range; outside it the field shakes and goes back.
function readNum(t){
  const v = parseFloat(String(t.value).replace(',', '.')), lo = +t.dataset.min, hi = +t.dataset.max;
  if (!Number.isFinite(v) || v < lo || v > hi){ flashFieldInvalid(t); renderControls(); return null; }
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

/* ---- Opening ----
   h: { title (the group's name), images() → [{ id, label, group {id, name, mode}, w, h,
        pxNm, key, canvas(fit) }], getFig(), setFig(fig) }. Returns { refresh, close }: refresh after the module's
   state changed under it (an undo). */
export function openSemFigure(h){
  host = h; F = withDefaults(h.getFig());
  // A group's figure is named after it until named otherwise.
  if (!(h.getFig() && h.getFig().file) && h.title) F.file = 'SEM_' + String(h.title).replace(/[^\w.-]+/g, '_');
  view = { z: 1, x: 0, y: 0 };
  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fig-backdrop';
  backdrop.lang = 'en';
  backdrop.innerHTML = `
    <div class="fig-box">
      <div class="fig-head">
        <h3 class="txt-head" style="margin:0">SEM figure${h.title ? ` — ${esc(h.title)}` : ''}</h3>
        <span class="txt-meta">The group's images as cropped, normalised and scaled in the module.</span>
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
    colorPickerUI.close();
    backdrop.remove(); backdrop = svgEl = controlsEl = dimEl = null; F = null; host = null; urls.clear();
    api.open = false;
  };
  const onKey = e=>{ if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', renderPreview);
  backdrop.querySelector('.fig-x').addEventListener('click', close);
  backdrop.addEventListener('click', e=>{ if (e.target === backdrop) close(); });
  backdrop.querySelector('[data-fig-reset]').addEventListener('click', ()=>{ F = withDefaults({ file: F.file }); commit(true); });
  backdrop.querySelector('[data-fig-svg]').addEventListener('click', async ()=>{ saveBlob((F.file || 'SEM_figure') + '.svg', (await svgString()).str, 'image/svg+xml'); });
  backdrop.querySelector('[data-fig-png]').addEventListener('click', async ()=>{ saveBlob((F.file || 'SEM_figure') + '.png', await pngBlob()); });
  const copyBtn = backdrop.querySelector('[data-fig-copy]');
  if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) copyBtn.addEventListener('click', ()=> copyPng(copyBtn));
  else { copyBtn.remove(); backdrop.querySelector('[data-fig-png]').classList.replace('btn-sm', 'primary'); }
  requestAnimationFrame(renderControls);
  const api = { open: true, refresh(){ if (!backdrop) return; F = withDefaults(host.getFig()); renderControls(); }, close };
  return api;
}

export { FIG_DEF, niceBar, lenText };
