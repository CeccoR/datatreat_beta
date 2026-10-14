import { colorPickerUI, flashFieldInvalid } from './utils.js';
import { FONTS, PX_MM, PT_PX, saveBlob, interFontCss } from './figure.js';

/* =========================================================
   SEM FIGURE
   The SEM images laid out for a paper, as the figure composer lays out plots
   (figure.js): one drawing in real millimetres, previewed as it will be exported, with
   the composer's page, fonts and export. No axes and no legend: a grid of image panels,
   each with its sample's name, optionally a letter, and the scale bars.

   The grid is the most compact rectangle for the images (columns ⌈√N⌉, rows ⌈N/cols⌉:
   12 images 4 × 3, not 6 × 2) unless set by hand; its columns are equal, a row as tall
   as its tallest image at that width, the panels a gap apart. A group at common scale
   (sem.js) has one scale bar, in its last panel in the figure's order; at its own scale
   every panel has its own. A bar's length is a round 1, 2 or 5 × 10ⁿ near a fifth of the
   panel unless typed (any value). The images come in their figure's pixels (sem.js
   outCanvas): a reduced copy for the preview, the full one for the export.

   The settings are the SEM module's (saved with the project, undone with it): the host
   gives them (getFig) and takes them back (setFig) on every change.
========================================================= */

const MM_PT = 25.4/72;
const FIG_DEF = {
  file: 'SEM_figure', wmm: 175, hmm: 120, hAuto: true, dpi: 600, bg: '#ffffff',
  gridAuto: true, rows: 1, cols: 1, gap: 1,
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
function gridOf(n){
  if (F.gridAuto){ const cols = Math.max(1, Math.ceil(Math.sqrt(n))); return { cols, rows: Math.max(1, Math.ceil(n/cols)) }; }
  const cols = Math.max(1, F.cols);
  return { cols, rows: Math.max(F.rows, Math.ceil(n/cols)) };
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
   { W, H, panels: [{ m, k (its index), x, y, w, h (the image), cx, cw (its cell) }],
     bandA, bandB (the text bands above and below each row) }. */
function layout(){
  const imgs = ordered(), n = imgs.length, { rows, cols } = gridOf(n), g = F.gap, W = F.wmm;
  const lineMm = pt => pt*MM_PT*1.35;
  const outsideL = F.label.on && (F.label.pos === 'above' || F.label.pos === 'below') ? F.label.pos : null;
  const outsideT = F.letter.on && !F.letter.link && F.letter.pos === 'above' ? 'above' : null;
  const bandA = Math.max(outsideL === 'above' ? lineMm(F.label.size) : 0, outsideT ? lineMm(F.letter.size) : 0);
  const bandB = outsideL === 'below' ? lineMm(F.label.size) : 0;
  let cellW = (W - (cols - 1)*g)/cols;
  const rowAsp = [];
  for (let r = 0; r < rows; r++){ const row = imgs.slice(r*cols, (r + 1)*cols); rowAsp.push(row.length ? Math.max(...row.map(m=> m.h/m.w)) : 0); }
  const fixed = rows*(bandA + bandB) + (rows - 1)*g, imgH = rowAsp.reduce((a, b)=> a + b, 0)*cellW;
  let H = fixed + imgH, k = 1;
  // A height set by hand: the images narrowed to fit it (never widened), the grid centred.
  if (!F.hAuto){ H = F.hmm; if (imgH > 0) k = Math.min(1, Math.max(0.05, (H - fixed)/imgH)); }
  const cw = cellW*k, x0 = (W - (cols*cw + (cols - 1)*g))/2;
  const used = fixed + imgH*k, y00 = F.hAuto ? 0 : Math.max(0, (H - used)/2);
  const panels = [];
  let y = y00;
  for (let r = 0; r < rows; r++){
    const rh = rowAsp[r]*cw;
    for (let c = 0; c < cols; c++){
      const i = r*cols + c, m = imgs[i];
      if (!m) continue;
      const w = cw, h = cw*m.h/m.w, cx = x0 + c*(cw + g);
      panels.push({ m, k: i, x: cx, y: y + bandA + (rh - h)/2, w, h, cx, cw, rowY: y, rowH: rh });
    }
    y += bandA + rh + bandB + g;
  }
  return { W, H, panels, rows, cols, bandA, bandB };
}

/* ---- Drawing ---- */
function draw(svg, full){
  const L = layout(), px = v => v*PX_MM, NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${px(L.W)} ${px(L.H)}`);
  const add = (tag, at, parent) => { const el = document.createElementNS(NS, tag); for (const k in at) el.setAttribute(k, at[k]); (parent || svg).appendChild(el); return el; };
  add('rect', { x: 0, y: 0, width: px(L.W), height: px(L.H), fill: F.bg });
  const stack = (FONTS[F.font] || FONTS.Inter).stack, ink = F.ink, out = contrastOf(ink);
  // Text drawn over the images, with an outline under it so that it reads on any grey.
  const text = (str, x, y, pt, anchor, bold, onImage) => {
    // (Outside the images, on the page, the text takes the colour that reads on it.)
    const fs = pt*PT_PX, t = add('text', { x, y, 'font-size': fs, 'font-family': stack, 'text-anchor': anchor, fill: onImage ? ink : contrastOf(F.bg), ...(bold ? { 'font-weight': 700 } : {}) });
    if (onImage && F.outline){ t.setAttribute('stroke', out); t.setAttribute('stroke-width', fs*0.12); t.setAttribute('stroke-linejoin', 'round'); t.setAttribute('paint-order', 'stroke'); }
    t.textContent = str;
    return t;
  };
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
    // A corner of the image: its text's x, anchor and the baseline of line `line`.
    const corner = (pos, pt, line) => {
      const fs = px(pt*MM_PT), right = pos[1] === 'r', bottom = pos[0] === 'b';
      const x = right ? px(p.x + p.w - margin) : px(p.x + margin), a = right ? 'end' : 'start';
      const y = bottom ? px(p.y + p.h - margin) - line*fs*1.2 : px(p.y + margin) + fs*0.82 + line*fs*1.2;
      return { x, y, a };
    };
    let labelEl = null;
    if (lab){
      const pos = F.label.pos;
      if (pos === 'above' || pos === 'below'){
        const fs = px(F.label.size*MM_PT), y = pos === 'above' ? px(p.rowY + L.bandA) - fs*0.3 : px(p.rowY + L.bandA + p.rowH) + fs*1.05;
        labelEl = text(lab, px(p.x), y, F.label.size, 'start', false, false);
      } else { const c = corner(pos, F.label.size, 0); labelEl = text(lab, c.x, c.y, F.label.size, c.a, false, true); }
    }
    if (letter && !F.letter.link){
      const pos = F.letter.pos, lfs = px(F.letter.size*MM_PT);
      if (pos === 'above'){
        text(letter, px(p.x), px(p.rowY + L.bandA) - lfs*0.3, F.letter.size, 'start', true, false);
        // The name above too: after the letter, on its line.
        if (labelEl && F.label.pos === 'above') labelEl.setAttribute('x', px(p.x) + lfs*0.62*(letter.length + 1));
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
      const bw = p.w*um/umW, t = F.bar.thick, fs = F.bar.size*MM_PT, right = F.bar.pos[1] === 'r', bottom = F.bar.pos[0] === 'b';
      const bx = right ? p.x + p.w - margin - bw : p.x + margin;
      const by = bottom ? p.y + p.h - margin - t : p.y + margin + fs*1.15;
      const r = add('rect', { x: px(bx), y: px(by), width: px(bw), height: px(t), fill: ink });
      if (F.outline){ r.setAttribute('stroke', out); r.setAttribute('stroke-width', px(t)*0.35); r.setAttribute('paint-order', 'stroke'); }
      // The length centred over the bar, or, wider than a short bar, flush with its outer
      // end, so that it stays inside the panel.
      const label = lenText(um), tw = label.length*fs*0.56;
      const [tx, ta] = tw <= bw ? [bx + bw/2, 'middle'] : right ? [bx + bw, 'end'] : [bx, 'start'];
      text(label, px(tx), px(by) - px(fs)*0.3, F.bar.size, ta, false, true);
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
  if (dimEl) dimEl.textContent = `${sig3(L.W)} × ${sig3(L.H)} mm · ${L.cols} × ${L.rows} panels · ${Math.round(L.W/25.4*F.dpi)} × ${Math.round(L.H/25.4*F.dpi)} px @ ${F.dpi} dpi`;
  // The locked fields show what was chosen.
  if (controlsEl){
    const set = (k, v) => { const el = controlsEl.querySelector(`[data-auto="${k}"]`); if (el) el.value = v; };
    set('rows', L.rows); set('cols', L.cols); set('hmm', sig3(L.H));
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
  // A press on a panel drags it onto another (where it goes, the others moving along);
  // anywhere else it pans.
  let drag = null;
  const panelAt = (x, y) => { const el = document.elementFromPoint(x, y), g = el && el.closest && el.closest('.sem-fig-panel'); return g && svgEl.contains(g) ? +g.dataset.i : null; };
  const mark = i => svgEl.querySelectorAll('.sem-fig-panel').forEach(g=> g.classList.toggle('is-target', +g.dataset.i === i));
  pane.addEventListener('pointerdown', e=>{
    if (e.button !== 0) return;
    const i = panelAt(e.clientX, e.clientY);
    drag = i != null ? { panel: i, to: null } : { x: e.clientX - view.x, y: e.clientY - view.y };
    pane.setPointerCapture(e.pointerId);
    if (i == null) pane.classList.add('is-panning');
    else svgEl.querySelector(`.sem-fig-panel[data-i="${i}"]`).classList.add('is-dragged');
  });
  pane.addEventListener('pointermove', e=>{
    if (!drag) return;
    if (drag.panel != null){ const i = panelAt(e.clientX, e.clientY); drag.to = i; mark(i != null && i !== drag.panel ? i : null); return; }
    view.x = e.clientX - drag.x; view.y = e.clientY - drag.y; applyView();
  });
  const end = ()=>{
    if (drag && drag.panel != null && drag.to != null && drag.to !== drag.panel){
      const ids = ordered().map(m=> m.id), [id] = ids.splice(drag.panel, 1);
      ids.splice(drag.to, 0, id);
      F.order = ids; commit(true);
    } else if (drag && drag.panel != null) renderPreview();
    drag = null; pane.classList.remove('is-panning');
  };
  pane.addEventListener('pointerup', end);
  pane.addEventListener('pointercancel', end);
  pane.addEventListener('dblclick', e=>{ if (panelAt(e.clientX, e.clientY) == null){ view = { z: 1, x: 0, y: 0 }; applyView(); } });
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
    ${chk('Grid chosen automatically', 'gridAuto', 'The most compact rectangle: ⌈√N⌉ columns')}
    ${autoNum('Rows', 'rows', 'gridAuto', 1, 40)}
    ${autoNum('Columns', 'cols', 'gridAuto', 1, 40)}
    ${num('Gap (mm)', 'gap', 0, 20)}
    <label class="fig-row"><span>Order</span><button class="btn btn-sm" type="button" data-act="order">As the file list</button></label>
    <p class="txt-meta">Drag a panel in the preview onto another to move it there.</p>
  </section>
  <section class="fig-sec"><h4>Names</h4>
    ${chk('Show the names', 'label.on')}
    ${sel('Position', 'label.pos', [...CORNERS, ['above', 'above the image'], ['below', 'below the image']])}
    ${num('Size (pt)', 'label.size', 3, 36)}
    ${imgs.map(m=> `<label class="fig-row"><span title="${esc(m.label)}">${esc(m.label)}</span><input type="text" data-name="${esc(m.id)}" value="${esc(F.names[m.id] != null ? F.names[m.id] : m.label)}"></label>`).join('')}
  </section>
  <section class="fig-sec"><h4>Letters</h4>
    ${chk('Show letters (a, b, c… in the panels\' order)', 'letter.on')}
    ${sel('Style', 'letter.style', [['a', 'a'], ['(a)', '(a)'], ['A', 'A'], ['(A)', '(A)']])}
    ${chk('At the start of the name', 'letter.link', 'The letter written before the sample\'s name, where the name is')}
    ${sel('Position', 'letter.pos', [...CORNERS, ['above', 'above the image']])}
    ${num('Size (pt)', 'letter.size', 3, 36)}
  </section>
  <section class="fig-sec"><h4>Scale bars</h4>
    ${sel('Position', 'bar.pos', CORNERS)}
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
  renderPreview();
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
    if (path === 'gridAuto' && !v){ const L = layout(); F.rows = L.rows; F.cols = L.cols; }
    put(path, v);
    if (path === 'cols' || path === 'rows'){ const n = ordered().length; if (F.cols*F.rows < n){ F.rows = Math.ceil(n/F.cols); } }
    commit(STRUCTURAL.has(path) || path === 'cols' || path === 'rows');
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
   h: { images() → [{ id, label, group {id, name, mode}, w, h, pxNm, key, canvas(fit) }],
        getFig(), setFig(fig) }. Returns { refresh, close }: refresh after the module's
   state changed under it (an undo). */
export function openSemFigure(h){
  host = h; F = withDefaults(h.getFig());
  view = { z: 1, x: 0, y: 0 };
  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fig-backdrop';
  backdrop.lang = 'en';
  backdrop.innerHTML = `
    <div class="fig-box">
      <div class="fig-head">
        <h3 class="txt-head" style="margin:0">SEM figure</h3>
        <span class="txt-meta">The images as cropped, normalised and scaled above; drag a panel to move it.</span>
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
