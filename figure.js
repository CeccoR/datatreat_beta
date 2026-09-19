import { svgEl, niceTicks, fmtTick } from './plot.js';
import { colorPickerUI, palettePickerUI, CP_PALETTES } from './utils.js';
import { activeTab, TABS } from './tabs.js';

// Local saver: downloadBlob() in utils is hard-wired to text/csv, and we need
// image mime types (and to save an already-built Blob for PNG).
function saveBlob(filename, data, mime){
  const blob = (data instanceof Blob) ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

/* =========================================================
   ADVANCED FIGURE COMPOSER  (export-only)

   Opens on the plot whose toolbar launched it, takes a snapshot of that plot's
   series, and lets you compose a publication figure from them WITHOUT ever
   touching the plot on the page. Everything here renders into ONE <svg> sized in
   real millimetres, so what you see is what gets exported.

   Layout model: a rows x cols table of panels. Panels are all the same cell size
   and always touch; a panel may span several cells (rowSpan/colSpan) and cells may
   be left empty.

   Ranges: share on -> one range for the whole figure; share off -> every panel gets
   its own, auto from its own data or set by hand. Panels touch, so tick numbers can
   only be drawn on an edge with free space beside it (see sideFree): with sharing
   off, the numbers along a shared border belong to the panel that owns that edge and
   describe that panel alone. Leave a gap in the grid, or turn the numbers on for the
   side you want, when each panel needs its own scale spelled out.
========================================================= */

const PX_MM = 96 / 25.4;      // CSS px per mm at the nominal 96 dpi
const PT_PX = 96 / 72;        // CSS px per typographic point
/* One font for the whole figure. The stack is what both the preview and the export
   use, so what you see is what you get; Inter is the app's own face and is embedded
   in the exported file, the rest are faces every system already has. */
const FONTS = {
  'Inter':      { label: 'Inter',           stack: `Inter, sans-serif`,                       embed: true },
  'Helvetica':  { label: 'Helvetica / Arial', stack: `Helvetica, Arial, sans-serif` },
  'Arial':      { label: 'Arial',           stack: `Arial, Helvetica, sans-serif` },
  'Times':      { label: 'Times New Roman', stack: `'Times New Roman', Times, serif` },
  'Georgia':    { label: 'Georgia',         stack: `Georgia, 'Times New Roman', serif` },
  'Courier':    { label: 'Courier New',     stack: `'Courier New', Courier, monospace` },
};
const fontStack = () => (FONTS[F && F.font && F.font.family] || FONTS.Inter).stack;

const DASHES = { 'none': 'no line', '': 'solid', '5,4': 'dashed', '2,3': 'dotted', '8,3,2,3': 'dash-dot' };

/* How a bar is filled. Colour says which division a bar belongs to; texture says
   which series it is, so the two can be read at once — and a figure printed in grey
   still tells its series apart. Each is drawn as an SVG pattern in the colour of the
   bar, so it exports and rasterises with everything else. */
const TEXTURES = {
  solid:   'solid',
  dots:    'dots',
  fwd:     'diagonal /',
  back:    'diagonal \\',
  cross:   'crosshatch ×',
  grid:    'grid +',
  horiz:   'horizontal lines',
  vert:    'vertical lines',
};
// Point symbols. `-o` is an outline, `-f` is filled; the label carries the glyph so
// the dropdown reads as the shape it draws.
const MARKERS = {
  'none': 'none',
  'circle-o': '○ circle', 'circle-f': '● circle',
  'square-o': '□ square', 'square-f': '■ square',
  'triangle-o': '△ triangle', 'triangle-f': '▲ triangle',
  'star-o': '☆ star', 'star-f': '★ star',
};

// One point symbol centred on (cx, cy), sized so every shape reads at the same
// weight. Returns the tag and attributes for the caller to add().
function markerShape(kind, cx, cy, r, color, width){
  const [shape, fillMode] = String(kind).split('-');
  const filled = fillMode === 'f';
  const paint = filled ? { fill: color, stroke: color, 'stroke-width': width * 0.5 }
                       : { fill: 'none', stroke: color, 'stroke-width': width * 0.9 };
  if (shape === 'circle') return ['circle', { cx, cy, r, ...paint }];
  if (shape === 'square') return ['rect', { x: cx - r, y: cy - r, width: r * 2, height: r * 2, ...paint }];
  if (shape === 'triangle'){
    const h = r * 1.15;
    return ['polygon', { points: `${cx},${cy-h} ${cx-h*0.95},${cy+h*0.72} ${cx+h*0.95},${cy+h*0.72}`, ...paint }];
  }
  // Five-pointed star: alternate outer and inner radii every 36 degrees.
  const pts = [];
  for (let i = 0; i < 10; i++){
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? r * 0.45 : r * 1.25);
    pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
  }
  return ['polygon', { points: pts.join(' '), ...paint }];
}

let F = null;                 // the figure model
let backdrop = null, previewSvg = null, controlsEl = null, dimEl = null, presetBar = null;
let lastInner = { w: 0, h: 0 };   // drawing area of the last pass, in mm
let view = { z: 1, x: 0, y: 0 };  // preview zoom and pan, on top of the fit scale
let srcPlot = null, srcOpts = null;   // what the composer was opened on, for Reset

/* ---- Model ---------------------------------------------------------------- */

// A plot's drawn content, turned into editable series. Curves come straight from
// the stored line/point entries; a bar chart has no such entry — it is a pile of
// individual rectangles — so bars sharing a colour are regrouped into one series,
// with the plot's tick labels kept as the category names for the X axis.
function seriesFromPlot(plot, legendEl){
  const labels = legendEl ? [...legendEl.querySelectorAll('span')].map(s=>s.textContent.trim()) : [];
  const stored = plot._stored || [];
  const out = [];
  const cats = stored.filter(e=> e.type === 'ticklabel')
                     .map(e=>({ x: e.xv, text: e.text, rot: e.rot || 0 }));

  stored.forEach((e, i)=>{
    if (e.type !== 'line' && e.type !== 'points') return;
    if (!e.xs || !e.ys || !e.xs.length) return;
    out.push({
      id: 's' + i,
      kind: 'curve',
      label: e.label || labels[out.length] || ('Series ' + (out.length + 1)),
      panel: 0,
      color: e.color || '#3aa0ff',
      width: e.width || 1.5,
      dash: e.type === 'points' ? 'none' : (e.dash || ''),
      marker: e.type === 'points' ? 'circle-o' : 'none',
      show: true, inLegend: true,
      // Prefer the undisplaced data a module attached to the entry: a stacked
      // overview draws offset/normalised traces, but a figure must carry the same
      // numbers as the exported CSV.
      xs: (e.raw && e.raw.xs) || e.xs,
      ys: (e.raw && e.raw.ys) || e.ys,
    });
  });

  // Bars: one series per colour, in the order the colours first appear. Error bars
  // are matched back to their bar by centre and pixel offset.
  const groups = new Map();
  for (const e of stored){
    if (e.type !== 'bar' && e.type !== 'barpx') continue;
    const color = e.color || '#3aa0ff';
    // Grouped by the name the plot gave the bar when it has one, else by colour.
    const gk = e.label || color;
    if (!groups.has(gk)) groups.set(gk, { color, name: e.label, xs: [], ys: [], errs: [], keys: [] });
    const g = groups.get(gk);
    g.xs.push(e.type === 'barpx' ? e.xc : (e.x0 + e.x1) / 2);
    g.ys.push(e.type === 'barpx' ? e.y1 : e.y1);
    g.errs.push(0);
    g.keys.push(e.type === 'barpx' ? (e.xc + '@' + (e.dx || 0)) : null);
  }
  if (groups.size){
    const errs = new Map();
    for (const e of stored) if (e.type === 'errbar') errs.set(e.xc + '@' + (e.dx || 0), e.yerr);
    let gi = 0;
    for (const g of groups.values()){
      g.keys.forEach((k, j)=>{ if (k != null && errs.has(k)) g.errs[j] = errs.get(k); });
      out.push({
        id: 'b' + gi,
        kind: 'bar',
        label: g.name || labels[out.length] || ('Bars ' + (gi + 1)),
        panel: 0,
        color: g.color,
        width: 0.8,                 // bar width as a fraction of the category slot
        dash: '', marker: 'none',
        // Bars are told apart by their fill, not by a line style or a symbol.
        texture: 'solid', fillOpacity: 1,
        show: true, inLegend: true,
        xs: g.xs, ys: g.ys, errs: g.errs,
      });
      gi++;
    }
  }
  return { series: out, cats };
}

/* ---- Rich axis titles ------------------------------------------------------
   Titles are held as plain text with two markers: ^{...} raises, _{...} lowers.
   That keeps them editable in an ordinary text field — and copy-pasteable — while
   still exporting real tspans. A source plot states its label as SVG, so it is
   translated into this notation on the way in rather than having its tags stripped,
   which is what used to flatten a Tauc exponent onto the baseline. */
const RICH_RE = /([\^_])\{([^}]*)\}/g;

function svgLabelToRich(html){
  return String(html || '')
    .replace(/<tspan[^>]*baseline-shift\s*=\s*["']?super[^>]*>([\s\S]*?)<\/tspan>/gi, '^{$1}')
    .replace(/<tspan[^>]*baseline-shift\s*=\s*["']?sub[^>]*>([\s\S]*?)<\/tspan>/gi, '_{$1}')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// The pieces of a rich string, in order: {t: text, r: 'super'|'sub'|null}.
function richParts(str){
  const out = [];
  let last = 0;
  String(str || '').replace(RICH_RE, (m, mark, body, i)=>{
    if (i > last) out.push({ t: str.slice(last, i), r: null });
    out.push({ t: body, r: mark === '^' ? 'super' : 'sub' });
    last = i + m.length;
    return m;
  });
  if (last < String(str || '').length) out.push({ t: String(str).slice(last), r: null });
  return out;
}

const RICH_SCALE = 0.72;   // size of a raised/lowered run, relative to the body

// Draws `str` as one <text> with a tspan per run. `at` carries x/y/anchor/transform.
function richText(add, str, at, px, ink){
  const el = add('text', { ...at, 'font-size': px, fill: ink });
  for (const p of richParts(str)){
    if (!p.t) continue;
    const sp = svgEl('tspan', p.r
      ? { 'baseline-shift': p.r, 'font-size': (px * RICH_SCALE).toFixed(2) }
      : {});
    sp.textContent = p.t;
    el.appendChild(sp);
  }
  return el;
}

/* Per-panel axis configuration. Each of the four sides is independent:
     on     — draw the axis line itself
     major  — major tick marks
     minor  — minor tick marks (count set per axis, see minorX / minorY)
     dir    — 'out' | 'in' | 'both'
     labels — tick numbers
     title  — the figure's X (bottom/top) or Y (left/right) title next to this side
   Defaults follow the usual convention: a full left+bottom pair, bare right+top. */
const SIDES = ['left', 'bottom', 'right', 'top'];
const newSide = full => ({ on:true, major:true, minor:false, dir:'out', labels:full, title:full });
const newAxes = () => ({ left:newSide(true), bottom:newSide(true), right:newSide(false), top:newSide(false) });

/* `shareXWith` / `shareYWith` point at the panel this one takes its range from, or
   at itself when it stands alone. They only matter while figure-wide sharing is off:
   that is what lets eight panels be scaled in pairs rather than all together or each
   on its own. */
function newPanel(r, c){ return { r, c, rs: 1, cs: 1, title: '', axes: newAxes(),
                                  shareXWith: null, shareYWith: null,
                                  // Off figure-wide sharing, each panel is on its own
                                  // automatic range until told otherwise.
                                  xAuto: true, yAuto: true }; }

// The panel whose range a panel follows, chasing the links and stopping at a cycle.
function rangeRoot(i, key){
  let k = i;
  for (let guard = 0; guard < F.panels.length + 1; guard++){
    const p = F.panels[k];
    const nxt = p && p[key];
    if (nxt == null || nxt === k || !F.panels[nxt]) return k;
    k = nxt;
  }
  return i;
}
// Every panel that ends up on the same root — the ones scaled together.
const rangeGroup = (i, key)=> F.panels.map((_, k)=> k).filter(k=> rangeRoot(k, key) === rangeRoot(i, key));

function buildModel(plot, opts){
  const strip = svgLabelToRich;
  const { series, cats } = seriesFromPlot(plot, opts && opts.legendEl);
  return {
    wmm: 160, hmm: 110, dpi: 300,
    // The drawing area itself, in mm. On auto it is whatever the margins leave; set
    // it by hand and the page keeps its size while the slack moves to the right and
    // bottom margins, which are the ones no label is pinned to.
    plotAuto: true, plotW: 0, plotH: 0,
    rows: 1, cols: 1,
    shareX: true, shareY: true,
    legendMode: 'per-panel',            // 'none' | 'per-panel' | 'global'
    legendCorner: 'tr',                 // per-panel: which corner it sits in
    legendPlace: 'bottom',              // global: above or below the panels
    legendAlign: 'center',              // global: where along that strip
    legendCols: 0,                      // global: 0 = one row, else wrap into N columns
    legendFrame: false,                 // draw a box behind it
    legendFrameLine: true,              // ... with an outline
    legendFrameAlpha: 1,                // ... and how opaque its background is
    legendGap: 6,                       // distance from the panel corner / panels
    font: { family: 'Inter', tick: 8, axis: 9, legend: 8, title: 9 },   // sizes in points
    xlabel: strip(plot.xlabel) || '',
    ylabel: strip(plot.ylabel) || strip(plot.ylabelSvg) || '',
    // Always the whole data set, whatever the page plot is zoomed to.
    xAuto: true, xmin: 0, xmax: 1,
    yAuto: true, ymin: 0, ymax: 1,
    // With sharing off each panel has its own range, so a manual one is per panel
    // too. Keyed by panel index; missing = that panel stays on its own auto range.
    /* Manual ranges per panel, and which panel the Range column is editing — one
       choice per axis, since X and Y are set independently. While sharing is on the
       figure-wide xAuto/xmin/xmax rule instead, for every panel at once. */
    xMan: {}, yMan: {}, rangePanel: 0, xPanel: 0, yPanel: 0,
    /* Tick spacing. Each has an "automatic" switch of its own: while it is on the
       figure picks the interval and the field only reports what it picked. */
    xStep: 0, yStep: 0, xStepAuto: true, yStepAuto: true,
    minorX: 4, minorY: 4, minorXAuto: true, minorYAuto: true,
    // Where the plot area sits inside the margins when it does not fill them: one of
    // the nine positions, vertical letter then horizontal ('cc' is centred).
    align: 'cc',
    // Tick labels and axis titles are kept off panel edges that face a neighbour,
    // where they would collide with it — unless this is turned off.
    innerClean: true,
    // One colour for everything drawn but the data itself: frame, ticks, numbers,
    // titles, legend text and its frame.
    inkColor: '#000000',
    grid: { x:false, y:false, minor:false, dash:'2,3' },
    // Value labels drawn on the data. A bar keeps the text the source plot already
    // formatted (value ± error) when it has one; anything else shows its Y value.
    dataLabels: { on:false, dec:2, pos:'above', rot:0, size:7, off:3, autoInk:false },
    // 'per-panel' = a title beside each panel side that asks for one;
    // 'shared' = one for the whole figure. Set independently for X and Y.
    titleModeX: 'per-panel', titleModeY: 'per-panel',
    // The palette is part of the model, so any change that shuffles the assignment
    // (scope, order, panel) re-colours everything immediately. Picking a colour by
    // hand clears it, which is what stops the next change from undoing that pick.
    palette: CP_PALETTES[0].colors.slice(),
    palScope: 'panel',                  // 'series' = one run of colours across all
                                        // series; 'panel' = every panel restarts it
    panels: [ newPanel(0, 0) ],
    series,
    cats,                               // category labels of a bar chart, if any
    /* A category name changed here, kept by the category's own x so every bar series
       standing on it reads the same name — it is one sample, drawn several times. */
    catNames: {},
    name: (opts && opts.name) || 'figure',
  };
}

/* What the axes actually use: the automatic switch wins over whatever number the
   field is showing, so nothing has to be zeroed to mean "pick one for me". */
const stepX = ()=> F.xStepAuto ? 0 : F.xStep;
const stepY = ()=> F.yStepAuto ? 0 : F.yStep;
const minorsX = ()=> F.minorXAuto ? 4 : F.minorX;
const minorsY = ()=> F.minorYAuto ? 4 : F.minorY;

// Major ticks for a range: a fixed step when the user set one, else a nice default.
function majorTicks(lo, hi, step){
  if (!(step > 0)) return niceTicks(lo, hi, 4).filter(t=> t >= lo && t <= hi);
  const out = [], first = Math.ceil(lo / step) * step;
  // Snap to the step grid so 0.30000000000000004 never reaches a tick label.
  for (let k = 0; out.length < 400; k++){
    const v = first + k * step;
    if (v > hi + step * 1e-9) break;
    out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  }
  return out;
}

/* ---- Geometry -------------------------------------------------------------- */

// Data extent of the series drawn in `panelIdxs`, or null when there's no data.
function extentOf(panelIdxs){
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, any = false;
  for (const s of F.series){
    if (!s.show || !panelIdxs.includes(s.panel)) continue;
    for (let i = 0; i < s.xs.length; i++){
      const x = s.xs[i], y = s.ys[i];
      if (!isFinite(x) || !isFinite(y)) continue;
      // Error bars are part of the mark, so they must fit inside the range too.
      const e = (s.errs && isFinite(s.errs[i]) && s.errs[i] > 0) ? s.errs[i] : 0;
      any = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y - e < y0) y0 = y - e; if (y + e > y1) y1 = y + e;
    }
  }
  if (!any) return null;
  // Bars stand on a zero baseline and need half a category slot of air either side.
  const bars = F.series.some(s=> s.show && s.kind === 'bar' && panelIdxs.includes(s.panel));
  if (bars){ x0 -= 0.7; x1 += 0.7; y0 = Math.min(0, y0); }
  if (x1 === x0){ x0 -= 0.5; x1 += 0.5; }
  if (y1 === y0){ y0 -= 0.5; y1 += 0.5; }
  const pad = (y1 - y0) * 0.05;
  return { x0, x1, y0: bars ? y0 : y0 - pad, y1: y1 + pad };
}

// True when nothing sits immediately beyond `side` of panel `i` — i.e. there is
// room outside that edge for tick numbers and an axis title. Panels touch, so a
// side facing a neighbour can only carry tick marks.
function sideFree(i){
  const p = F.panels[i];
  const occupied = (r, c) => F.panels.some((q, k)=> k !== i && r >= q.r && r < q.r + q.rs && c >= q.c && c < q.c + q.cs);
  const span = (from, n, fn) => { for (let k = from; k < from + n; k++) if (occupied(...fn(k))) return false; return true; };
  return {
    left:   p.c === 0                 || span(p.r, p.rs, r => [r, p.c - 1]),
    right:  p.c + p.cs >= F.cols      || span(p.r, p.rs, r => [r, p.c + p.cs]),
    top:    p.r === 0                 || span(p.c, p.cs, c => [p.r - 1, c]),
    bottom: p.r + p.rs >= F.rows      || span(p.c, p.cs, c => [p.r + p.rs, c]),
  };
}

// `n` minor ticks between each pair of majors, extended one interval past both ends.
// Positions that land on a major are dropped — a minor tick under a major one is
// invisible except for the shorter mark poking out of it.
function minorTicks(majors, lo, hi, n){
  n = Math.max(0, Math.round(n));
  if (majors.length < 2 || !n) return [];
  const div = n + 1, step = (majors[1] - majors[0]) / div, out = [];
  const first = majors[0];
  for (let k = -div; ; k++){
    const v = first + k * step;
    if (v > hi + step / 2) break;
    if (v > majors[majors.length-1] + div * step) break;
    if (v < lo) continue;
    if (v > hi) continue;
    if (((k % div) + div) % div === 0) continue;   // sits on a major
    out.push(v);
  }
  return out;
}

// The X/Y range of every panel, indexed by panel. Shared means they all get the
// figure-wide one; otherwise each panel resolves its own, manual if it has one set.
function computeRanges(){
  const globalExt = extentOf(F.panels.map((_, i)=> i)) || { x0:0, x1:1, y0:0, y1:1 };
  const xOf = [], yOf = [];
  F.panels.forEach((p, i)=>{
    // Off the figure-wide switch, a panel is scaled with whatever group it shares
    // with — itself alone, unless it was pointed at another panel.
    const exX = F.shareX ? globalExt : (extentOf(rangeGroup(i, 'shareXWith')) || globalExt);
    const exY = F.shareY ? globalExt : (extentOf(rangeGroup(i, 'shareYWith')) || globalExt);
    const ex = exX, ey = exY;
    const manX = F.shareX ? [F.xmin, F.xmax] : F.xMan[rangeRoot(i, 'shareXWith')];
    const manY = F.shareY ? [F.ymin, F.ymax] : F.yMan[rangeRoot(i, 'shareYWith')];
    // Whose automatic switch applies: the figure's while sharing, else the panel
    // the group is rooted on, so panels sharing a range also share that choice.
    const rx = F.panels[rangeRoot(i, 'shareXWith')] || p;
    const ry = F.panels[rangeRoot(i, 'shareYWith')] || p;
    const autoX = F.shareX ? F.xAuto : rx.xAuto !== false;
    const autoY = F.shareY ? F.yAuto : ry.yAuto !== false;
    xOf[i] = (autoX || !manX) ? [ex.x0, ex.x1] : manX.slice();
    yOf[i] = (autoY || !manY) ? [ey.y0, ey.y1] : manY.slice();
  });
  return { xOf, yOf, globalExt };
}

/* ---- Renderer -------------------------------------------------------------- */

// Legend key: a filled box for bars, a stroked line for curves.
function legendMark(add, s, xa, xb, y){
  // A bar's key is a swatch of the very fill the bars carry, texture and all.
  if (s.kind === 'bar'){
    add('rect', { x:xa, y:y-3, width:xb-xa, height:6, fill:barFill(add, s.color, s.texture),
                  'fill-opacity':(s.fillOpacity == null ? 1 : s.fillOpacity) });
    return;
  }
  if (s.dash !== 'none'){
    const e = add('line', { x1:xa, x2:xb, y1:y, y2:y, stroke:s.color, 'stroke-width':s.width });
    if (s.dash) e.setAttribute('stroke-dasharray', s.dash);
  }
  if (s.marker !== 'none'){
    const [tag, at] = markerShape(s.marker, (xa + xb) / 2, y, Math.max(1.2, s.width * 1.3), s.color, s.width);
    add(tag, at);
  }
}

const measCtx = document.createElement('canvas').getContext('2d');
function textW(txt, px, weight){
  // Measured in the very font the figure will be drawn in, so the margins the
  // measurement feeds are right for the chosen face and not just for Inter.
  measCtx.font = `${weight||''} ${px}px ${fontStack()}`;
  return measCtx.measureText(String(txt)).width;
}

/* Black or white, whichever a reader can see against `bg` — the usual relative
   luminance, with the threshold where the two contrast ratios cross. */
function contrastInk(bg){
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(bg || '').trim());
  let r = 255, g = 255, b = 255;
  if (m){
    const h = m[1].length === 3 ? m[1].replace(/./g, c=> c + c) : m[1];
    r = parseInt(h.slice(0,2), 16); g = parseInt(h.slice(2,4), 16); b = parseInt(h.slice(4,6), 16);
  } else {
    const rgb = /rgba?\(([^)]+)\)/i.exec(String(bg || ''));
    if (rgb){ const p = rgb[1].split(',').map(Number); r = p[0]; g = p[1]; b = p[2]; }
  }
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.179 ? '#000000' : '#ffffff';
}

// Draw the whole figure into `svg` at its real size in px. `ink`/`paper` let the
// export force a light, print-ready palette regardless of the app theme.
// One drawing pass. `extra` widens the computed margins — renderInto() uses it to
// feed back what actually stuck out on the previous pass.
function drawFigure(svg, ink, paper, extra){
  // One chosen colour for every line and letter the figure draws around the data.
  if (F.inkColor) ink = F.inkColor;
  patSeen = new Map();
  patDefs = null;
  const W = F.wmm * PX_MM, H = F.hmm * PX_MM;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = '';
  const add = (tag, at, parent)=>{ const e = svgEl(tag, at); (parent||svg).appendChild(e); return e; };
  // Stated on the root rather than inherited, so the preview and the exported file
  // render in the same face instead of each falling back to its own default.
  svg.setAttribute('font-family', fontStack());
  // Patterns live in one defs block at the head of the figure, before anything that
  // might reference them.
  patDefs = add('defs', {});
  add('rect', { x:0, y:0, width:W, height:H, fill: paper });

  const fTick = F.font.tick * PT_PX, fAxis = F.font.axis * PT_PX;
  const fLeg = F.font.legend * PT_PX, fTitle = F.font.title * PT_PX;
  const { xOf, yOf } = computeRanges();

  // Outer margins: room for the Y numbers + title on the left, X numbers + title
  // below, and (for a global legend) a strip under that.
  let maxYNum = 0;
  F.panels.forEach((p, i)=>{
    for (const t of majorTicks(yOf[i][0], yOf[i][1], stepY())) maxYNum = Math.max(maxYNum, textW(fmtTick(t), fTick));
  });
  // How far the X labels stick out sideways and downwards. A number is centred on
  // its tick, so the outermost ones overhang the frame by half their width; tilted
  // category names hang below the axis and lean past its left end.
  let halfX = 0, catDrop = 0, catLean = 0;
  F.panels.forEach((p, i)=>{
    for (const t of majorTicks(xOf[i][0], xOf[i][1], stepX())) halfX = Math.max(halfX, textW(fmtTick(t), fTick) / 2);
  });
  if (F.cats && F.cats.length){
    for (const cat of F.cats){
      const w = textW(catText(cat.x), fTick), rad = (cat.rot || 0) * Math.PI / 180;
      catDrop = Math.max(catDrop, w * Math.sin(rad) + fTick * Math.cos(rad));
      catLean = Math.max(catLean, cat.rot ? w * Math.cos(rad) : w / 2);
    }
    halfX = Math.max(halfX, catLean);
  }
  const xDrop = F.cats && F.cats.length ? Math.max(fTick * 1.7, catDrop + fTick * 0.6) : fTick * 1.7;

  // Only reserve room on a side that some panel actually decorates.
  const anySide = (side, what) => F.panels.some(p => (p.axes || (p.axes = newAxes()))[side][what]);
  const room = (side, vert) =>
    (anySide(side, 'labels') ? (vert ? maxYNum + 8 : xDrop) : 0) +
    (anySide(side, 'title') && (vert ? F.ylabel : F.xlabel) ? fAxis * 1.5 : 0);
  // Whatever the sides ask for, never less than the overhang of the outermost X
  // label — that is what used to spill outside the figure.
  const sideX = (anySide('bottom', 'labels') || anySide('top', 'labels')) ? halfX + 2 : 0;
  const legendItems = legendEntries(F.series.filter(s=> s.show && s.inLegend !== false)).length;
  const legendRows = (F.legendMode === 'global' && legendItems)
    ? Math.ceil(legendItems / Math.max(1, Math.min(Math.round(F.legendCols) || 1e9, legendItems))) : 0;
  const legendH = legendRows ? legendRows * fLeg * 1.35 + F.legendGap + 4 : 0;
  let mL = Math.max(10 + room('left', true), sideX) + extra.L;
  let mR = Math.max(10 + room('right', true), sideX) + extra.R;
  let mT = 10 + room('top', false) + (F.legendPlace === 'top' ? legendH : 0) + extra.T;
  let mB = 10 + room('bottom', false) + (F.legendPlace === 'top' ? 0 : legendH) + extra.B;
  // Margins never eat more than this much of the page. Without the cap, a request
  // that cannot fit (a title longer than the figure) would grow them past the page
  // and push the panels off it; with it, the figure stays sane and the text clips.
  const capW = W * 0.62, capH = H * 0.62;
  if (mL + mR > capW){ const k = capW / (mL + mR); mL *= k; mR *= k; }
  if (mT + mB > capH){ const k = capH / (mT + mB); mT *= k; mB *= k; }

  let innerW = Math.max(20, W - mL - mR), innerH = Math.max(20, H - mT - mB);
  if (!F.plotAuto){
    // Room is still kept for the outward tick marks on the far sides, so a plot area
    // asked bigger than the page can hold stops short of the edge instead of on it.
    innerW = Math.min(Math.max(20, F.plotW * PX_MM), W - mL - 8);
    innerH = Math.min(Math.max(20, F.plotH * PX_MM), H - mT - 8);
  }
  lastInner = { w: +(innerW / PX_MM).toFixed(2), h: +(innerH / PX_MM).toFixed(2) };
  /* A plot area smaller than the space the margins leave has that space to spare,
     and `align` says where in it the area sits — centred unless asked otherwise. */
  const AL = { t:0, l:0, c:0.5, b:1, r:1 };
  const av = String(F.align || 'cc');
  const fy = AL[av[0]] !== undefined ? AL[av[0]] : 0.5;
  const fx = AL[av[1]] !== undefined ? AL[av[1]] : 0.5;
  const oX = mL + Math.max(0, (W - mL - mR) - innerW) * fx;
  const oY = mT + Math.max(0, (H - mT - mB) - innerH) * fy;
  const cw = innerW / F.cols, ch = innerH / F.rows;

  F.panels.forEach((p, pi)=>{
    const px0 = oX + p.c * cw, py0 = oY + p.r * ch;
    const pw = Math.max(4, p.cs * cw), ph = Math.max(4, p.rs * ch);
    const [x0, x1] = xOf[pi] || [0, 1];
    const [y0, y1] = yOf[pi] || [0, 1];
    const X = v => px0 + (v - x0) / (x1 - x0 || 1) * pw;
    const Y = v => py0 + ph - (v - y0) / (y1 - y0 || 1) * ph;

    const clipId = 'fclip' + pi;
    const defs = add('defs', {});
    const cp = svgEl('clipPath', { id: clipId });
    cp.appendChild(svgEl('rect', { x:px0, y:py0, width:pw, height:ph }));
    defs.appendChild(cp);

    // Grid, under everything. Built from the same ticks the axes use, so it always
    // lines up with the numbers whatever the tick step is.
    const gx = majorTicks(x0, x1, stepX()), gy = majorTicks(y0, y1, stepY());
    if (F.grid.x || F.grid.y){
      const gg = add('g', { 'clip-path': `url(#${clipId})` });
      const rule = (a, minor)=> add('line', { ...a, stroke:ink, 'stroke-width': minor ? 0.3 : 0.5,
                                              'stroke-dasharray':F.grid.dash, opacity: minor ? 0.28 : 0.45 }, gg);
      if (F.grid.x){
        for (const t of gx) rule({ x1:X(t), x2:X(t), y1:py0, y2:py0+ph });
        if (F.grid.minor) for (const t of minorTicks(gx, x0, x1, minorsX())) rule({ x1:X(t), x2:X(t), y1:py0, y2:py0+ph }, true);
      }
      if (F.grid.y){
        for (const t of gy) rule({ x1:px0, x2:px0+pw, y1:Y(t), y2:Y(t) });
        if (F.grid.minor) for (const t of minorTicks(gy, y0, y1, minorsY())) rule({ x1:px0, x2:px0+pw, y1:Y(t), y2:Y(t) }, true);
      }
    }

    // Series
    const g = add('g', { 'clip-path': `url(#${clipId})` });
    const DL = F.dataLabels;
    const wantsLabels = () => DL.on;
    // One value label. `pos` is relative to the mark; the text rotates about its own
    // anchor so a tilted label still starts where it points.
    const valueLabel = (s, j, cx, yMark, yTop, yBot, box)=>{
      // Always formatted here, so the decimals setting means something; a series
      // that carries an uncertainty keeps it, at the same number of decimals.
      // A figure always reads with a decimal point, whatever separator the CSV
      // export is set to, so this formats directly instead of going through fmtNum.
      const dec = v => v.toFixed(Math.max(0, Math.min(6, DL.dec | 0)));
      const e = s.errs && s.errs[j];
      const txt = dec(s.ys[j]) + (isFinite(e) && e > 0 ? ' \u00b1 ' + dec(e) : '');
      if (!isFinite(s.ys[j])) return;
      const size = DL.size * PT_PX, o = DL.off;
      let y = yMark, anchor = 'middle', baseline = 'auto';
      // `off` is a plain signed distance from where the position puts the label, so a
      // negative one walks it back the other way — into the bar, typically.
      if (DL.pos === 'above'){ y = yTop - o; }
      else if (DL.pos === 'below'){ y = yBot + o + size * 0.8; }
      else if (DL.pos === 'inside'){ y = yTop + o + size * 0.9; }
      /* Centred sits in the middle of the mark — for a bar, the middle of the bar as
         it is actually drawn: from its top down to wherever it ends on screen, which
         is the baseline, or the bottom of the panel when the range cuts it off. The
         whiskers are no part of the bar, so they do not move its centre. */
      else if (DL.pos === 'center'){
        y = (box ? (box.top + box.bottom) / 2 : (yTop + yBot) / 2) + o;
        baseline = 'central';
      }
      /* With auto contrast on, the label takes black or white against whatever it
         actually lands on: the bar when the text falls inside it, the page otherwise.
         The text box is the cap height around the baseline (or centred on it), which
         is close enough to tell "on the bar" from "off it". */
      let fill = ink;
      if (DL.autoInk){
        const top = baseline === 'central' ? y - size * 0.5 : y - size * 0.72;
        const bot = baseline === 'central' ? y + size * 0.5 : y + size * 0.1;
        const over = box && top < box.bottom && bot > box.top;
        fill = contrastInk(over ? box.color : paper);
      }
      const at = { x:cx, y, 'font-size':size, fill, 'text-anchor':anchor };
      if (baseline !== 'auto') at['dominant-baseline'] = baseline;
      if (DL.rot){
        // Rotating about the anchor sends the text away from the mark, so the anchor
        // becomes the near end (the far end for a label below), and the glyph box is
        // centred on the baseline so the label straddles the mark instead of sitting
        // half a cap-height to one side. At an angle the text still runs off
        // sideways, so the anchor slides back by half the width it projects onto the
        // X axis — which is nothing at 90 degrees and a full half-width at 0, exactly
        // matching the unrotated centred case.
        const rad = DL.rot * Math.PI / 180;
        const back = textW(txt, size) * Math.cos(rad) / 2;
        const ax = cx + (DL.pos === 'below' ? back : -back);
        at.x = ax;
        at['text-anchor'] = DL.pos === 'below' ? 'end' : 'start';
        at['dominant-baseline'] = 'central';
        at.transform = `rotate(-${DL.rot} ${ax} ${y})`;
      }
      add('text', at, g).textContent = txt;
    };
    // Bars of different series sharing a category sit side by side inside the slot.
    const barSeries = F.series.filter(s=> s.show && s.kind === 'bar' && s.panel === pi);
    for (const s of F.series){
      if (!s.show || s.panel !== pi) continue;
      if (s.kind === 'bar'){
        const nb = barSeries.length, bi = barSeries.indexOf(s);
        const slot = Math.abs(X(1) - X(0));           // one category, in px
        const wPx = Math.max(1, slot * s.width / nb);
        const off = (bi - (nb - 1) / 2) * wPx;
        const zero = Y(Math.max(y0, Math.min(y1, 0)));
        s.xs.forEach((xv, j)=>{
          const yv = s.ys[j];
          if (!isFinite(xv) || !isFinite(yv)) return;
          const cx = X(xv) + off, yy = Y(yv);
          add('rect', { x:(cx - wPx/2).toFixed(2), y:Math.min(yy, zero).toFixed(2),
                        width:wPx.toFixed(2), height:Math.abs(zero - yy).toFixed(2),
                        fill:barFill(add, divColor(s, divOfBar(s, j)), s.texture),
                        'fill-opacity':(s.fillOpacity == null ? 1 : s.fillOpacity) }, g);
          const err = s.errs && s.errs[j];
          if (isFinite(err) && err > 0){
            const yA = Y(yv - err), yB = Y(yv + err), cap = Math.min(4, wPx / 3);
            const st = { stroke:ink, 'stroke-width':0.8 };
            add('line', { x1:cx, x2:cx, y1:yA, y2:yB, ...st }, g);
            add('line', { x1:cx-cap, x2:cx+cap, y1:yA, y2:yA, ...st }, g);
            add('line', { x1:cx-cap, x2:cx+cap, y1:yB, y2:yB, ...st }, g);
          }
          if (wantsLabels()){
            // Measure from the whisker when there is one, so a label never sits on it.
            const e = (isFinite(err) && err > 0) ? err : 0;
            // The bar as the reader sees it: clipped to the panel, so a bar running
            // past the top of the range is centred on the part that shows.
            const bTop = Math.min(Math.max(Math.min(yy, zero), py0), py0 + ph);
            const bBot = Math.min(Math.max(Math.max(yy, zero), py0), py0 + ph);
            valueLabel(s, j, cx, yy, Math.min(Y(yv + e), zero), Math.max(Y(yv - e), zero),
                       { color: divColor(s, divOfBar(s, j)), top: bTop, bottom: bBot });
          }
        });
        continue;
      }
      if (s.marker !== 'none'){
        const r = Math.max(0.9, s.width * 1.3);
        for (let i = 0; i < s.xs.length; i++){
          if (!isFinite(s.xs[i]) || !isFinite(s.ys[i])) continue;
          const [tag, at] = markerShape(s.marker, +X(s.xs[i]).toFixed(2), +Y(s.ys[i]).toFixed(2), r, s.color, s.width);
          add(tag, at, g);
        }
      }
      if (s.dash !== 'none'){
        let d = '';
        for (let i = 0; i < s.xs.length; i++){
          if (!isFinite(s.xs[i]) || !isFinite(s.ys[i])) continue;
          d += (d === '' ? 'M' : 'L') + X(s.xs[i]).toFixed(2) + ',' + Y(s.ys[i]).toFixed(2) + ' ';
        }
        const path = add('path', { d, fill:'none', stroke:s.color, 'stroke-width':s.width }, g);
        if (s.dash) path.setAttribute('stroke-dasharray', s.dash);
      }
      if (wantsLabels()){
        for (let i = 0; i < s.xs.length; i++){
          if (!isFinite(s.xs[i]) || !isFinite(s.ys[i])) continue;
          const yy = Y(s.ys[i]);
          valueLabel(s, i, X(s.xs[i]), yy, yy, yy);
        }
      }
    }

    /* Where another panel actually puts its numbers on the same side. A number at a
       shared edge only has to give way when the neighbour draws one within a line of
       it — checking merely "is the edge shared" dropped perfectly clear numbers, e.g.
       the 0 at the foot of every stacked panel but the last. */
    const neighbourMarks = (side, edge, vert)=>{
      const marks = [];
      F.panels.forEach((q, k)=>{
        if (k === pi) return;
        const touches =
          edge === 'top'    ? (q.r + q.rs === p.r && q.c < p.c + p.cs && p.c < q.c + q.cs) :
          edge === 'bottom' ? (q.r === p.r + p.rs && q.c < p.c + p.cs && p.c < q.c + q.cs) :
          edge === 'left'   ? (q.c + q.cs === p.c && q.r < p.r + p.rs && p.r < q.r + q.rs) :
                              (q.c === p.c + p.cs && q.r < p.r + p.rs && p.r < q.r + q.rs);
        if (!touches) return;
        const qa = q.axes || (q.axes = newAxes());
        if (!qa[side].labels) return;
        const qx0 = oX + q.c * cw, qy0 = oY + q.r * ch;
        const qw = Math.max(4, q.cs * cw), qh = Math.max(4, q.rs * ch);
        if (vert){
          const [a, z] = yOf[k] || [0, 1];
          for (const t of majorTicks(a, z, stepY())) marks.push(qy0 + qh - (t - a) / (z - a || 1) * qh);
        } else {
          const [a, z] = xOf[k] || [0, 1];
          for (const t of majorTicks(a, z, stepX())) marks.push({ q: qx0 + (t - a) / (z - a || 1) * qw, w: textW(fmtTick(t), fTick) / 2 });
        }
      });
      return marks;
    };

    // ---- Axes: four independent sides ------------------------------------
    const A = p.axes || (p.axes = newAxes());
    const free = sideFree(pi);
    const xMaj = gx, yMaj = gy;
    // A bar chart's X axis is categorical: the tick labels carried over from the
    // source plot replace the numbers, one per category inside the panel's range.
    const cats = F.cats && F.cats.length ? F.cats.filter(c=> c.x >= x0 && c.x <= x1) : null;
    // Base coordinate of each side, and the outward normal direction along the axis
    // that ticks/labels/titles grow into.
    const GEO = {
      left:   { vert:true,  base:px0,    out:-1 },
      right:  { vert:true,  base:px0+pw, out:+1 },
      top:    { vert:false, base:py0,    out:-1 },
      bottom: { vert:false, base:py0+ph, out:+1 },
    };
    const TICK_MAJ = 4, TICK_MIN = 2.2;

    for (const side of SIDES){
      const a = A[side], g0 = GEO[side];
      if (!a.on && !a.major && !a.minor && !a.labels && !a.title) continue;
      if (a.on){
        const e = g0.vert ? { x1:g0.base, x2:g0.base, y1:py0, y2:py0+ph }
                          : { x1:px0, x2:px0+pw, y1:g0.base, y2:g0.base };
        // Square caps: a stroke is centred on its path, so two lines meeting at a
        // corner with the default butt cap each stop half a width short of filling
        // it, leaving a small notch. A square cap runs the stroke on by exactly that
        // half width, so the corner closes.
        add('line', { ...e, stroke:ink, 'stroke-width':0.8, 'stroke-linecap':'square' });
      }

      // Tick marks. `dir` decides which side of the axis line they stick out of.
      const mark = (pos, len)=>{
        const o = g0.out * len;
        const from = a.dir === 'in' ? 0 : (a.dir === 'both' ? -o : 0);
        const to   = a.dir === 'in' ? -o : o;
        const e = g0.vert ? { x1:g0.base+from, x2:g0.base+to, y1:pos, y2:pos }
                          : { x1:pos, x2:pos, y1:g0.base+from, y2:g0.base+to };
        add('line', { ...e, stroke:ink, 'stroke-width':0.8 });
      };
      const proj = g0.vert ? Y : X;
      const majors = g0.vert ? yMaj : xMaj;
      if (a.major) majors.forEach(t=> mark(proj(t), TICK_MAJ));
      if (a.minor) minorTicks(majors, ...(g0.vert ? [y0, y1, minorsY()] : [x0, x1, minorsX()])).forEach(t=> mark(proj(t), TICK_MIN));

      // Numbers and title only where there is room outside the panel; a side that
      // touches a neighbour can carry tick marks but nothing that would overlap it —
      // unless the figure has been told to label every edge regardless.
      if (!free[side] && F.innerClean) continue;

      if (a.labels && cats && !g0.vert){
        for (const c of cats){
          const q = X(c.x), rot = c.rot || 0;
          const at = side === 'bottom' ? { x:q, y:g0.base + fTick*1.15 } : { x:q, y:g0.base - fTick*0.5 };
          const el = add('text', { ...at, 'font-size':fTick, fill:ink,
                                   'text-anchor': rot ? 'end' : 'middle' });
          if (rot) el.setAttribute('transform', `rotate(-${rot} ${at.x} ${at.y})`);
          el.textContent = catText(c.x);
        }
        continue;
      }
      if (a.labels){
        for (const t of majors){
          const q = proj(t), txt = fmtTick(t);
          let at;
          if (g0.vert){
            const hh = fTick * 0.55;
            const near = e => Math.abs(e - q) < fTick * 1.1;
            if (q - hh < py0 + 1 && !free.top && neighbourMarks(side, 'top', true).some(near)) continue;
            if (q + hh > py0 + ph - 1 && !free.bottom && neighbourMarks(side, 'bottom', true).some(near)) continue;
            at = side === 'left'
              ? { x:g0.base-5, y:q+fTick*0.36, 'text-anchor':'end' }
              : { x:g0.base+5, y:q+fTick*0.36, 'text-anchor':'start' };
          } else {
            const hw = textW(txt, fTick) / 2;
            const clash = m => Math.abs(m.q - q) < m.w + hw + 2;
            if (q - hw < px0 + 1 && !free.left && neighbourMarks(side, 'left', false).some(clash)) continue;
            if (q + hw > px0 + pw - 1 && !free.right && neighbourMarks(side, 'right', false).some(clash)) continue;
            at = { x:q, y: side === 'bottom' ? g0.base+fTick*1.25 : g0.base-fTick*0.5, 'text-anchor':'middle' };
          }
          add('text', { ...at, 'font-size':fTick, fill:ink }).textContent = txt;
        }
      }

      // Axis title, pushed clear of the numbers when they are present. In shared
      // mode the four figure-level titles below replace these.
      const label = g0.vert ? F.ylabel : F.xlabel;
      if (a.title && label && (g0.vert ? F.titleModeY : F.titleModeX) !== 'shared'){
        const clear = a.labels ? (g0.vert ? maxYNum + 8 : xDrop) : 6;
        if (g0.vert){
          const yc = py0 + ph/2, x = g0.base + g0.out * (clear + fAxis*0.9);
          richText(add, label, { x, y:yc, 'text-anchor':'middle',
                                 transform:`rotate(${side === 'left' ? -90 : 90} ${x} ${yc})` }, fAxis, ink);
        } else {
          const y = g0.base + g0.out * (clear + fAxis * (side === 'bottom' ? 1.0 : 0.4));
          richText(add, label, { x:px0+pw/2, y, 'text-anchor':'middle' }, fAxis, ink);
        }
      }
    }

    // Panel title (top-left, inside)
    if (p.title){
      const el = add('text', { x:px0+6, y:py0+fTitle*1.25, 'font-size':fTitle, fill:ink, 'font-weight':'600' });
      el.textContent = p.title;
    }

    // Per-panel legend, in the chosen corner
    if (F.legendMode === 'per-panel'){
      const mine = legendEntries(F.series.filter(s=> s.show && s.inLegend !== false && s.panel === pi));
      if (mine.length){
        const gap = F.legendGap, lw = 14, pad = 4;
        const rowH = fLeg * 1.35;
        const wide = Math.max(...mine.map(s=> textW(s.label, fLeg))) + lw + 6;
        const right = F.legendCorner.endsWith('r'), top = F.legendCorner.startsWith('t');
        const titleDrop = (top && p.title) ? fTitle * 1.2 : 0;
        const boxX = right ? px0 + pw - gap - wide : px0 + gap;
        const boxY = top ? py0 + gap + titleDrop : py0 + ph - gap - mine.length * rowH;
        if (F.legendFrame)
          legendFrameRect(add, boxX-pad, boxY-pad, wide+pad*2, mine.length*rowH+pad*2, ink, paper);
        mine.forEach((s, k)=>{
          const cy = boxY + rowH * (k + 0.5);
          legendMark(add, s, boxX, boxX + lw, cy);
          add('text', { x:boxX + lw + 6, y:cy, 'font-size':fLeg, fill:ink,
                        'dominant-baseline':'central' }).textContent = s.label;
        });
      }
    }
  });

  // Shared titles: one per side for the whole grid, centred on the inner area and
  // sitting in the outer margin. A side gets one when any panel asked for it.
  {
    const want = side => F.panels.some(p=> (p.axes || (p.axes = newAxes()))[side].title);
    const shX = F.titleModeX === 'shared', shY = F.titleModeY === 'shared';
    const cx = oX + innerW / 2, cy = oY + innerH / 2;
    if (shX && F.xlabel && want('bottom'))
      richText(add, F.xlabel, { x:cx, y:H - (F.legendPlace === 'top' ? 0 : legendH) - 4, 'text-anchor':'middle' }, fAxis, ink);
    if (shX && F.xlabel && want('top'))
      richText(add, F.xlabel, { x:cx, y:fAxis, 'text-anchor':'middle' }, fAxis, ink);
    if (shY && F.ylabel && want('left'))
      richText(add, F.ylabel, { x:fAxis*1.1, y:cy, 'text-anchor':'middle',
                                transform:`rotate(-90 ${fAxis*1.1} ${cy})` }, fAxis, ink);
    if (shY && F.ylabel && want('right'))
      richText(add, F.ylabel, { x:W - fAxis*1.1, y:cy, 'text-anchor':'middle',
                                transform:`rotate(90 ${W - fAxis*1.1} ${cy})` }, fAxis, ink);
  }

  // Global legend: a strip above or below the panels, in one row or N columns.
  if (F.legendMode === 'global'){
    const items = legendEntries(F.series.filter(s=> s.show && s.inLegend !== false));
    if (items.length){
      const gap = 14, lw = 16, rowH = fLeg * 1.35;
      const cols = Math.max(1, Math.min(Math.round(F.legendCols) || items.length, items.length));
      const rows = Math.ceil(items.length / cols);
      // Column widths follow the widest label in each column, so entries line up.
      const colW = [];
      for (let c = 0; c < cols; c++){
        let w = 0;
        for (let r = 0; r < rows; r++){
          const s = items[r * cols + c];
          if (s) w = Math.max(w, lw + 4 + textW(s.label, fLeg));
        }
        colW[c] = w;
      }
      const total = colW.reduce((a, b)=> a + b, 0) + gap * (cols - 1);
      const x0 = F.legendAlign === 'left' ? oX
               : F.legendAlign === 'right' ? oX + innerW - total
               : oX + Math.max(0, (innerW - total) / 2);
      const yTop = F.legendPlace === 'top' ? oY - F.legendGap - rows * rowH
                                           : oY + innerH + (H - oY - innerH - rows * rowH) / 2;
      if (F.legendFrame){
        const pad = 4;
        legendFrameRect(add, x0-pad, yTop-pad, total+pad*2, rows*rowH+pad*2, ink, paper);
      }
      items.forEach((s, i)=>{
        const c = i % cols, r = (i / cols) | 0;
        let x = x0; for (let k = 0; k < c; k++) x += colW[k] + gap;
        const cy = yTop + rowH * (r + 0.5);
        legendMark(add, s, x, x + lw, cy);
        add('text', { x:x + lw + 4, y:cy, 'font-size':fLeg, fill:ink,
                      'dominant-baseline':'central' }).textContent = s.label;
      });
    }
  }
}

/* A bar's fill: its colour plainly, or that colour drawn as a pattern when the series
   carries a texture. One pattern per colour-and-texture pair is put in the figure's
   defs and referenced from there, so a hundred bars of one series cost one definition.
   Patterns are part of the document, so they survive export and rasterising. */
let patDefs = null, patSeen = null;
function barFill(add, color, texture){
  if (!texture || texture === 'solid' || !TEXTURES[texture]) return color;
  const key = texture + color;
  if (!patSeen) return color;
  if (!patSeen.has(key)){
    const id = 'ftex' + patSeen.size;
    patSeen.set(key, id);
    const P = 6;                               // pattern tile, in figure px
    const pat = svgEl('pattern', { id, width:P, height:P, patternUnits:'userSpaceOnUse' });
    const put = (tag, at)=> pat.appendChild(svgEl(tag, at));
    // The tile is painted on the bar's own colour, so the texture reads as that colour
    // lightened rather than as a second hue laid over white.
    put('rect', { x:0, y:0, width:P, height:P, fill:color, opacity:0.32 });
    const line = (x1,y1,x2,y2)=> put('line', { x1, y1, x2, y2, stroke:color, 'stroke-width':1.4, 'stroke-linecap':'square' });
    if (texture === 'dots') put('circle', { cx:P/2, cy:P/2, r:1.5, fill:color });
    if (texture === 'fwd'  || texture === 'cross'){ line(-1,P+1,P+1,-1); line(P-1,P+1,P+1,P-1); line(-1,1,1,-1); }
    if (texture === 'back' || texture === 'cross'){ line(-1,-1,P+1,P+1); line(-1,P-1,1,P+1); line(P-1,-1,P+1,1); }
    if (texture === 'horiz' || texture === 'grid') line(0,P/2,P,P/2);
    if (texture === 'vert'  || texture === 'grid') line(P/2,0,P/2,P);
    if (patDefs) patDefs.appendChild(pat);
  }
  return `url(#${patSeen.get(key)})`;
}

/* The box behind a legend. Its outline and how much of the page it hides are set
   separately: a frame can be a plain outline over the figure, a solid block that
   covers whatever it sits on, or anything between. */
function legendFrameRect(add, x, y, w, h, ink, paper){
  const at = { x, y, width:w, height:h, rx:2, fill:paper,
               'fill-opacity': Math.max(0, Math.min(1, F.legendFrameAlpha)) };
  if (F.legendFrameLine){ at.stroke = ink; at['stroke-width'] = 0.5; }
  add('rect', at);
}

/* How far the drawn ink pokes out of the figure box, per side, in figure units.
   Clipped groups are skipped: their contents are cut to the panel by construction,
   and getBoundingClientRect() would report the uncut geometry. Needs the svg to be
   laid out, so a detached one (the export) is parked off-screen first. */
function measureOverflow(svg){
  const detached = !svg.isConnected;
  if (detached){
    svg.style.position = 'fixed'; svg.style.left = '-10000px'; svg.style.top = '0';
    document.body.appendChild(svg);
  }
  const vb = svg.viewBox.baseVal, R = svg.getBoundingClientRect();
  const k = (R.width / vb.width) || 1;
  const o = { L:0, R:0, T:0, B:0 };
  for (const el of svg.querySelectorAll('text,line,rect,path,circle')){
    if (el.closest('defs') || el.closest('[clip-path]')) continue;
    const q = el.getBoundingClientRect();
    if (!q.width && !q.height) continue;
    o.L = Math.max(o.L, (R.left - q.left) / k);
    o.R = Math.max(o.R, (q.right - R.right) / k);
    o.T = Math.max(o.T, (R.top - q.top) / k);
    o.B = Math.max(o.B, (q.bottom - R.bottom) / k);
  }
  if (detached){
    svg.remove();
    svg.style.position = svg.style.left = svg.style.top = '';
  }
  return o;
}

/* Draw, measure what spilled outside the page, widen those margins, draw again.
   The analytic estimate inside drawFigure() gets it right most of the time; this
   catches whatever it can't predict — a long axis title, a tall rotated data
   label, a legend key wider than expected. Two corrective passes are plenty. */
function renderInto(svg, ink, paper){
  let extra = { L:0, R:0, T:0, B:0 }, worst = Infinity;
  for (let pass = 0; pass < 3; pass++){
    drawFigure(svg, ink, paper, extra);
    const o = measureOverflow(svg);
    const now = Math.max(o.L, o.R, o.T, o.B);
    if (now < 0.5) break;
    // Give up rather than thrash when a pass stops helping: that means the content
    // simply cannot fit the page at this size, and the margin cap has kicked in.
    if (now >= worst) break;
    worst = now;
    extra = { L:extra.L + o.L, R:extra.R + o.R, T:extra.T + o.T, B:extra.B + o.B };
  }
}

// Physical size and pixel count of the export, shown in the footer. Driven by the
// redraw rather than by input events: numeric fields commit on 'change', and hanging
// this off the events meant the line reported the value from before the last commit.
function updateDim(){
  if (!dimEl || !F) return;
  dimEl.textContent = `${F.wmm}×${F.hmm} mm (plot ${lastInner.w}×${lastInner.h}) · `
    + `${Math.round(F.wmm / 25.4 * F.dpi)}×${Math.round(F.hmm / 25.4 * F.dpi)} px @ ${F.dpi} dpi`;
}

/* The preview is a fixed-size drawing scaled to fit its pane; this puts a zoom and a
   pan on top of that, purely for looking at it. The figure itself is untouched — the
   transform lives on the element, not in the model, so nothing here reaches an
   export. Zoom keeps the point under the cursor still. */
function applyView(){
  if (!previewSvg) return;
  previewSvg.style.transformOrigin = 'center center';
  previewSvg.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
}

function resetView(){ view = { z: 1, x: 0, y: 0 }; applyView(); }

function wirePreviewView(){
  const host = previewSvg.parentElement;
  // The untransformed drawing is centred in the pane by the layout, so the pane's
  // centre is the fixed point every calculation here is measured from.
  const centre = ()=>{ const r = host.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; };

  host.addEventListener('wheel', e=>{
    // Always swallowed, so the page behind never scrolls or zooms with it.
    e.preventDefault();
    const [cx, cy] = centre();
    const k = Math.exp(-e.deltaY * 0.004);
    const z2 = Math.min(24, Math.max(0.25, view.z * k));
    const sx = (e.clientX - cx - view.x) / view.z, sy = (e.clientY - cy - view.y) / view.z;
    view.x = e.clientX - cx - z2 * sx;
    view.y = e.clientY - cy - z2 * sy;
    view.z = z2;
    applyView();
  }, { passive: false });

  let drag = null;
  host.addEventListener('pointerdown', e=>{
    if (e.button !== 0) return;
    drag = { x: e.clientX - view.x, y: e.clientY - view.y };
    host.setPointerCapture(e.pointerId);
    host.classList.add('is-panning');
  });
  host.addEventListener('pointermove', e=>{
    if (!drag) return;
    view.x = e.clientX - drag.x; view.y = e.clientY - drag.y;
    applyView();
  });
  const end = ()=>{ drag = null; host.classList.remove('is-panning'); };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  host.addEventListener('dblclick', resetView);   // back to fit
}

function renderPreview(){
  renderInto(previewSvg, '#1a2327', '#ffffff');
  // Fit the real-size figure inside the preview pane without distorting it.
  const host = previewSvg.parentElement;
  const availW = host.clientWidth - 24, availH = host.clientHeight - 24;
  const W = F.wmm * PX_MM, H = F.hmm * PX_MM;
  const k = Math.min(availW / W, availH / H, 1);
  previewSvg.style.width = (W * k) + 'px';
  previewSvg.style.height = (H * k) + 'px';
  applyView();
  updateDim();
}

/* ---- Export ---------------------------------------------------------------- */

/* Inter as a base64 @font-face, fetched once. An exported SVG is a standalone
   document and a PNG is rasterised from one inside an <img>: neither can reach the
   page's stylesheet or fetch a font of its own, so without this the file would
   silently fall back to the viewer's default sans and stop matching the preview. */
let _interCss = null;
async function interFontCss(){
  if (_interCss !== null) return _interCss;
  try {
    const buf = await (await fetch('./inter-latin.woff2')).arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    _interCss = `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;`
              + `src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
  } catch(e){ _interCss = ''; }   // no font file: the stack's fallbacks take over
  return _interCss;
}

async function figureSvgString(){
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  renderInto(tmp, '#000000', '#ffffff');
  const face = FONTS[F.font.family] || FONTS.Inter;
  if (face.embed){
    const css = await interFontCss();
    if (css){
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = css;
      tmp.insertBefore(style, tmp.firstChild);
    }
  }
  // Physical size so the file lands at the right scale in Word/Illustrator/LaTeX.
  tmp.setAttribute('width', F.wmm + 'mm');
  tmp.setAttribute('height', F.hmm + 'mm');
  return new XMLSerializer().serializeToString(tmp);
}

async function exportSVG(){
  saveBlob(F.name + '.svg', await figureSvgString(), 'image/svg+xml');
}

// The figure rasterised at the chosen dpi, as a PNG blob — saved to a file or handed
// to the clipboard, which wants the very same bytes.
async function figurePngBlob(){
  const str = await figureSvgString();
  const W = F.wmm * PX_MM, H = F.hmm * PX_MM;
  const scale = F.dpi / 96;                       // px at the requested dpi
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b=> b ? resolve(b) : reject(new Error('no blob')), 'image/png');
    };
    img.onerror = ()=> reject(new Error('render failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
  });
}

async function exportPNG(){
  saveBlob(F.name + '.png', await figurePngBlob());
}

/* Safari only honours a clipboard write made in the same turn as the click, so the
   item is handed the promise of the blob rather than the blob itself where that is
   supported; elsewhere the plain await is fine. */
async function copyPNG(btn){
  if (!(navigator.clipboard && window.ClipboardItem && navigator.clipboard.write)) return;
  const done = txt => { btn.textContent = txt; setTimeout(()=>{ btn.textContent = 'Copy PNG'; }, 1200); };
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': figurePngBlob() })]);
    done('Copied');
  } catch(e){
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': await figurePngBlob() })]);
      done('Copied');
    } catch(e2){ done('Copy failed'); }
  }
}

/* ---- Controls -------------------------------------------------------------- */

const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/* Numeric fields are plain text boxes, not <input type="number">: Chrome renders a
   number input's value with the BROWSER's decimal separator whatever lang says, and
   a figure has to read with a point. Typing a comma is still accepted — it is
   translated on commit — and `data-num` marks the field as commit-on-change, so a
   value only takes effect once confirmed instead of on every keystroke. */
const numField = (attrs, value, min, max)=>
  `<input type="text" inputmode="decimal" data-num="1" data-min="${min}" data-max="${max}" ${attrs} value="${value}">`;
const num = (label, key, min, max)=>
  `<label class="fig-row"><span>${label}</span>${numField(`data-k="${key}"`, F[key], min, max)}</label>`;
const readNum = t=>{
  const v = parseFloat(String(t.value).replace(',', '.'));
  if (!isFinite(v)) return null;
  const lo = parseFloat(t.dataset.min), hi = parseFloat(t.dataset.max);
  return Math.min(isFinite(hi) ? hi : Infinity, Math.max(isFinite(lo) ? lo : -Infinity, v));
};

// Panel whose axes the "Panel axes" section edits. The sentinel 'all' edits every
// panel at once; the fields then show panel 1's settings as the starting point.
/* Undo / redo. A snapshot clones everything except the data arrays, which are
   shared by reference — they never change, and copying them per keystroke would
   cost far more than the whole rest of the model. */
let undoStack = [], redoStack = [], undoTimer = null;
const SHARED = ['xs', 'ys', 'errs'];
function snapshot(){
  const clone = v => JSON.parse(JSON.stringify(v));
  return {
    scalars: clone(Object.fromEntries(Object.entries(F).filter(([k]) => k !== 'series' && k !== 'cats'))),
    series: F.series.map(s=>{
      const o = {}; for (const k in s) if (!SHARED.includes(k)) o[k] = s[k];
      return { keep: SHARED.map(k=> s[k]), rest: clone(o) };
    }),
  };
}
function applySnapshot(snap){
  Object.assign(F, JSON.parse(JSON.stringify(snap.scalars)));
  F.series = snap.series.map(e=>{
    const s = JSON.parse(JSON.stringify(e.rest));
    SHARED.forEach((k, i)=>{ if (e.keep[i] !== undefined) s[k] = e.keep[i]; });
    return s;
  });
}
// Coalesce a burst of edits (dragging a slider, typing in a field) into one step.
function pushUndo(){
  clearTimeout(undoTimer);
  undoTimer = setTimeout(()=>{
    if (!F) return;          // the modal was closed inside the coalescing window
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }, 250);
}
function undo(){
  clearTimeout(undoTimer);
  if (undoStack.length < 2) return;          // the first entry is the opening state
  redoStack.push(undoStack.pop());
  applySnapshot(undoStack[undoStack.length - 1]);
  refresh(true);
}
function redo(){
  clearTimeout(undoTimer);
  const snap = redoStack.pop();
  if (!snap) return;
  undoStack.push(snap);
  applySnapshot(snap);
  refresh(true);
}

/* Named presets: a whole set of figure settings, saved to localStorage so it
   outlives the session and can be applied to any plot in any project. Holds the
   same thing the per-plot memory does — everything but the data itself. */
const PRESET_KEY = 'dt-figure-presets';
let presetSel = '';           // survives the control rebuild an apply triggers
function loadPresets(){
  try { const o = JSON.parse(localStorage.getItem(PRESET_KEY)); return (o && typeof o === 'object') ? o : {}; }
  catch(e){ return {}; }
}
function savePresets(o){ try { localStorage.setItem(PRESET_KEY, JSON.stringify(o)); } catch(e){} }
function settingsSnapshot(){
  const snap = snapshot();
  snap.series = snap.series.map(e=>({ keep: [], rest: e.rest }));
  return snap;
}
/* Applies settings without touching the data: scalars wholesale, per-series looks
   positionally. A plot with more series than the source keeps its own for the rest.
   `kind`, `id`, `label` and the data are never copied — they say what a series IS,
   not how it looks. Letting a preset made on line plots turn a bar series into a
   curve would erase the bars, and carrying names over would show the sample labels
   of whatever plot the settings came from; the names always come from the project's
   own legend, so renaming a sample there shows up here at once.

   A name typed into the composer is the exception: it is a choice about this figure,
   not about the project, so it is kept in `rename` — which is not identity — and put
   back over the label when the settings are applied again. */
const IDENTITY = ['kind', 'id', 'label', 'xs', 'ys', 'errs'];
/* `name` says which plot the figure IS, not how it looks: it is the key the per-plot
   memory is filed under. A preset carrying its origin's name over would make the plot
   save its settings under the other plot's name and find nothing on reopening. */
const SCALAR_IDENTITY = ['name'];
function applySettings(snap){
  if (!snap) return;
  const scalars = JSON.parse(JSON.stringify(snap.scalars));
  for (const k of SCALAR_IDENTITY) delete scalars[k];
  Object.assign(F, scalars);
  F.series.forEach((s, i)=>{
    const rest = snap.series[i] && snap.series[i].rest;
    if (!rest) return;
    for (const k in rest) if (!IDENTITY.includes(k)) s[k] = rest[k];
    if (s.rename) s.label = s.rename;
  });
  clampPanels();
}

/* Last settings used for each plot, so reopening the composer on the same plot picks
   up where you left it. Keyed by tab and plot, so two projects — and two plots in one
   project — never share a memory; tab ids are themselves persisted, so the key still
   points at the same plot after a reload. Kept in localStorage rather than in memory
   for exactly that reason, and pruned of tabs that no longer exist so it cannot grow
   without bound. Reset is the way out of a memory you no longer want. */
const MEM_KEY = 'dt-figure-memory';
const memKey = name => ((activeTab() || {}).id || 'none') + '/' + name;
function loadMemory(){
  try { const o = JSON.parse(localStorage.getItem(MEM_KEY)); return (o && typeof o === 'object') ? o : {}; }
  catch(e){ return {}; }
}
function rememberSettings(){
  if (!F) return;
  const all = loadMemory();
  const snap = settingsSnapshot();
  // Which preset the figure was left on, so reopening it says so instead of coming
  // back with the settings of a preset and no sign of which one.
  snap.preset = presetSel;
  all[memKey(F.name)] = snap;
  const live = new Set(TABS.map(t=>t.id));
  for (const k of Object.keys(all)) if (!live.has(k.slice(0, k.indexOf('/')))) delete all[k];
  try { localStorage.setItem(MEM_KEY, JSON.stringify(all)); } catch(e){}
}
function recallSettings(){
  const snap = loadMemory()[memKey(F.name)];
  applySettings(snap);
  // Only if that preset is still around: one deleted meanwhile names nothing.
  presetSel = (snap && snap.preset && loadPresets()[snap.preset]) ? snap.preset : '';
}

let axSel = 'all';
const axTargets = () => axSel === 'all' ? F.panels.map((_, i)=> i) : [axSel];
const axShown = () => ((F.panels[axSel === 'all' ? 0 : axSel] || {}).axes) || newAxes();

function panelOptions(sel){
  return F.panels.map((p,i)=>`<option value="${i}"${i===sel?' selected':''}>P${i+1}</option>`).join('');
}

/* The divisions of one bar series, and the samples under them. Every sample is listed
   whatever the divisions do — one per row, named where it stands, and dragged by its
   handle into the division it belongs to. A bar chart has no other list of its samples,
   so this one is always on show rather than appearing once a series is divided. */
function divisionsHtml(s, i){
  const divs = divsOf(s);
  const barRow = j => `
    <div class="fig-barrow" data-bar="${i}:${j}">
      <span class="fig-grip" title="Drag into another division">${GRIP}</span>
      <input type="text" data-bark="${i}:${j}" value="${esc(catText(s.xs[j]))}" class="fig-slabel"
             title="The sample's name, on the axis and in every series">
    </div>`;
  const group = (d, k)=>`
    <div class="fig-dgroup" data-dg="${i}:${k}">
      <div class="fig-dgroup-h">
        <button class="color-swatch" data-dsw="${i}:${k}" data-color="${divColor(s,k)}" style="background:${divColor(s,k)}" title="Pick the colour of this division"></button>
        <input type="text" data-dk="${i}:${k}" value="${esc(divName(s,k))}" class="fig-slabel" title="Name shown in the legend">
        ${k ? `<button type="button" class="btn btn-sm fig-divx" data-deldiv="${i}:${k}" title="Remove this division">${'\u00d7'}</button>` : ''}
      </div>
      <div class="fig-dbars">${
        s.xs.map((_, j)=> divOfBar(s, j) === k ? barRow(j) : '').join('')
        || '<span class="txt-meta">drag samples here</span>'}</div>
    </div>`;
  return `<div class="fig-divs">
    ${divs.map(group).join('')}
    ${divs.length < s.xs.length
      ? `<button type="button" class="btn btn-sm fig-divadd" data-adddiv="${i}" title="Another colour group inside this series">+ division</button>`
      : ''}
  </div>`;
}

/* The two per-series toggles say different things — draw it at all, and list it in
   the legend — so they carry different marks instead of being two identical boxes. */
const ICON_DRAW = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2,12 6,7 9,9.5 14,3.5"/></svg>`;
const ICON_LEGEND = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><line x1="2" y1="4.5" x2="5" y2="4.5"/><line x1="7.5" y1="4.5" x2="14" y2="4.5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="7.5" y1="8" x2="14" y2="8"/><line x1="2" y1="11.5" x2="5" y2="11.5"/><line x1="7.5" y1="11.5" x2="14" y2="11.5"/></svg>`;
const figToggle = (attrs, on, icon, title)=>
  `<label class="fig-cbox" title="${title}"><input type="checkbox" ${attrs}${on ? ' checked' : ''}><span class="fig-cbox-i">${icon}</span></label>`;

const GRIP = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;

const chk = (label, key, obj)=>
  `<label class="fig-check"><input type="checkbox" data-${obj||'k'}="${key}"${(obj==='g'?F.grid[key]:obj==='dl'?F.dataLabels[key]:F[key])?' checked':''}> ${label}</label>`;
const sel = (label, key, opts, cur, attr)=>
  `<label class="fig-row"><span>${label}</span><select data-${attr||'k'}="${key}">${
    opts.map(([v,t])=>`<option value="${v}"${String(cur)===String(v)?' selected':''}>${t}</option>`).join('')}</select></label>`;

/* A number the figure works out for itself until you say otherwise: while the
   automatic switch is on the field shows what was chosen and cannot be typed in. */
const autoNum = (label, key, autoKey, min, max, autoVal)=>
  `<label class="fig-row"><span>${label}</span>${F[autoKey]
    ? `<input type="text" value="${autoVal}" disabled title="Chosen automatically">`
    : numField(`data-k="${key}"`, F[key], min, max)}</label>`;

// The interval the automatic ticks are actually landing on, for that field to show.
function autoStepOf(axis){
  const { xOf, yOf } = computeRanges();
  const i = Math.min(Math.max(0, F.rangePanel | 0), F.panels.length - 1);
  const [a, z] = ((axis === 'x' ? xOf : yOf)[i]) || [0, 1];
  const t = majorTicks(a, z, 0);
  return t.length > 1 ? +(t[1] - t[0]).toPrecision(6) : '';
}

/* One column of the Range section, for one axis. The two are laid out side by side
   and read top to bottom: share it across the figure or not; which panel the rest of
   the column is about; which panel that one takes its range from; automatic or not;
   and the two bounds. Each control below the share switch is about one panel while
   sharing is off, and about the whole figure while it is on — so the ones that no
   longer mean anything are shown disabled rather than taken away, and the column
   keeps its shape as the switches move. */
function rangeColHtml(axis){
  const X = axis === 'x';
  const shared = X ? F.shareX : F.shareY;
  const withKey = X ? 'shareXWith' : 'shareYWith';
  const panelKey = X ? 'xPanel' : 'yPanel';
  const i = Math.min(Math.max(0, F[panelKey] | 0), F.panels.length - 1);
  const p = F.panels[i] || F.panels[0];
  /* A panel that shares with another is scaled by that one, so the switch and the
     bounds below belong to the panel at the head of the group, not to this one —
     otherwise a range typed here would be recorded where nothing reads it. */
  const root = shared ? i : rangeRoot(i, withKey);
  const rp = F.panels[root] || p;
  const auto = shared ? (X ? F.xAuto : F.yAuto) : (rp[X ? 'xAuto' : 'yAuto'] !== false);
  const dis = on => on ? '' : ' disabled';
  const A = axis.toUpperCase();
  const r = computeRanges();
  const live = (X ? r.xOf[i] : r.yOf[i]) || [0, 1];
  const man = F[X ? 'xMan' : 'yMan'][root];
  const bound = end => shared
    ? (X ? (end ? F.xmax : F.xmin) : (end ? F.ymax : F.ymin))
    : (man ? man[end] : live[end]);
  const field = end => auto
    ? `<input type="text" value="${+(+live[end]).toPrecision(6)}" disabled title="Chosen automatically">`
    : (shared
        ? numField(`data-k="${X ? (end ? 'xmax' : 'xmin') : (end ? 'ymax' : 'ymin')}"`, +(+bound(end)).toPrecision(6), -1e12, 1e12)
        : numField(`data-man="${X ? 'xMan' : 'yMan'}" data-end="${end}"`, +(+bound(end)).toPrecision(6), -1e12, 1e12));
  return `<div class="fig-rangecol">
    <div class="fig-rangehead">${A} axes</div>
    <label class="fig-check"><input type="checkbox" data-k="${X ? 'shareX' : 'shareY'}"${shared ? ' checked' : ''}> Share across all panels</label>
    <label class="fig-row"><span>Panel</span>
      <select data-k="${panelKey}"${dis(!shared)}>${F.panels.map((q, k)=>
        `<option value="${k}"${k === i ? ' selected' : ''}>P${k+1}</option>`).join('')}</select></label>
    <label class="fig-row"><span>Shares with</span>
      <select data-share="${withKey}" data-p="${i}"${dis(!shared)}>
        <option value="">none</option>
        ${F.panels.map((q, k)=> k === i ? '' :
          `<option value="${k}"${p[withKey] === k ? ' selected' : ''}>P${k+1}</option>`).join('')}
      </select></label>
    <label class="fig-check"><input type="checkbox" data-rauto="${axis}"${auto ? ' checked' : ''}> Automatic range</label>
    <label class="fig-row"><span>Min</span>${field(0)}</label>
    <label class="fig-row"><span>Max</span>${field(1)}</label>
  </div>`;
}

/* The nine placings of the plot area, drawn as a little square with a dot where the
   area would sit. The button shows the one in force; clicking it opens the rest. */
const ALIGN_CELLS = ['tl','tc','tr','cl','cc','cr','bl','bc','br'];
const ALIGN_NAMES = { tl:'top left', tc:'top', tr:'top right', cl:'left', cc:'centred',
                      cr:'right', bl:'bottom left', bc:'bottom', br:'bottom right' };
function ALIGN_ICON(code){
  const v = { t:2.5, c:6.5, b:10.5 }[String(code || 'cc')[0]] ?? 6.5;
  const h = { l:2.5, c:6.5, r:10.5 }[String(code || 'cc')[1]] ?? 6.5;
  return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/>
    <rect x="${h}" y="${v}" width="3" height="3" fill="currentColor"/></svg>`;
}

/* A little square showing exactly what a bar of this series looks like: its colour,
   its texture and its opacity, drawn with the same tile the figure uses. */
function texturePaint(texture, color){
  const P = 6;
  const line = (x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.4" stroke-linecap="square"/>`;
  let marks = '';
  if (texture === 'dots') marks = `<circle cx="${P/2}" cy="${P/2}" r="1.5" fill="${color}"/>`;
  if (texture === 'fwd'  || texture === 'cross') marks += line(-1,P+1,P+1,-1) + line(P-1,P+1,P+1,P-1) + line(-1,1,1,-1);
  if (texture === 'back' || texture === 'cross') marks += line(-1,-1,P+1,P+1) + line(-1,P-1,1,P+1) + line(P-1,-1,P+1,1);
  if (texture === 'horiz' || texture === 'grid') marks += line(0,P/2,P,P/2);
  if (texture === 'vert'  || texture === 'grid') marks += line(P/2,0,P/2,P);
  return { marks, base: texture === 'solid' ? 1 : 0.32 };
}
function fillPreview(s, size){
  const color = s.color || '#888888';
  const tex = s.texture || 'solid';
  const op = s.fillOpacity == null ? 1 : s.fillOpacity;
  const { marks, base } = texturePaint(tex, color);
  const px = size || 17, id = 'tp' + Math.random().toString(36).slice(2, 8);
  return `<svg class="fig-fill-sw" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" aria-hidden="true" style="opacity:${op}">
    <defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${color}" opacity="${base}"/>${marks}</pattern></defs>
    <rect x="0.5" y="0.5" width="${px-1}" height="${px-1}" rx="3" fill="url(#${id})" stroke="rgba(128,128,128,0.45)"/>
  </svg>`;
}

/* How a series' bars are filled, chosen in one place: the texture, the colour it is
   drawn in and how much of the page shows through. Opens under its button and behaves
   like the colour picker — click away to dismiss, follows the button as the page
   scrolls — and every change reaches the figure at once. */
const fillPicker = {
  el: null, anchor: null, state: null, onChange: null,
  open(anchor, state, onChange, opts){
    this.close();
    this.anchor = anchor; this.onChange = onChange;
    this.state = { texture: state.texture || 'solid', color: state.color || '#888888',
                   opacity: state.opacity == null ? 1 : state.opacity };
    this.opts = opts || {};
    const el = document.createElement('div');
    el.className = 'fig-fillpop';
    document.body.appendChild(el);
    this.el = el;
    this._render();
    this._reposition();
    this._onScroll = ()=> this._reposition();
    window.addEventListener('scroll', this._onScroll, true);
    window.addEventListener('resize', this._onScroll);
    setTimeout(()=>{
      this._away = ev=>{
        if (!this.el) return;
        // The colour picker opens on top of this one; a click inside it is not a click away.
        if (this.el.contains(ev.target) || ev.target === anchor || ev.target.closest('.cp-popup')) return;
        this.close();
      };
      document.addEventListener('pointerdown', this._away);
    }, 0);
  },
  _render(){
    const st = this.state;
    this.el.innerHTML = `
      <div class="fig-fillgrid">
        ${Object.entries(TEXTURES).map(([v,n])=>
          `<button type="button" class="fig-filltile${st.texture === v ? ' is-on' : ''}" data-tex="${v}" title="${n}">
             ${fillPreview({ texture:v, color:st.color, fillOpacity:1 }, 22)}</button>`).join('')}
      </div>
      ${this.opts.noColor ? '' : `
      <label class="fig-fillrow"><span>Colour</span>
        <button class="color-swatch fig-fillcol" type="button" data-color="${st.color}" style="background:${st.color}"></button>
      </label>`}
      <label class="fig-fillrow"><span>Opacity</span>
        <input type="range" min="10" max="100" step="5" value="${Math.round(st.opacity * 100)}" class="fig-fillop">
        <b>${Math.round(st.opacity * 100)}%</b>
      </label>`;
    this.el.querySelectorAll('[data-tex]').forEach(b=> b.addEventListener('click', ()=>{
      this.state.texture = b.dataset.tex;
      this._render(); this._emit();
    }));
    const sw = this.el.querySelector('.fig-fillcol');
    if (sw) sw.addEventListener('click', ()=>{
      colorPickerUI.open(sw, this.state.color, color=>{
        this.state.color = color;
        this._render(); this._emit();
      });
    });
    const op = this.el.querySelector('.fig-fillop');
    op.addEventListener('input', ()=>{
      this.state.opacity = (+op.value) / 100;
      this.el.querySelector('.fig-fillrow b').textContent = op.value + '%';
      this._emit();
    });
  },
  _emit(){ if (this.onChange) this.onChange({ ...this.state }); },
  _reposition(){
    if (!this.el || !this.anchor) return;
    const b = this.anchor.getBoundingClientRect();
    const w = this.el.offsetWidth || 190, h = this.el.offsetHeight || 190;
    this.el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, b.left)) + 'px';
    this.el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, b.bottom + 4)) + 'px';
  },
  close(){
    if (this._away) document.removeEventListener('pointerdown', this._away);
    if (this._onScroll){
      window.removeEventListener('scroll', this._onScroll, true);
      window.removeEventListener('resize', this._onScroll);
    }
    this._away = this._onScroll = null;
    if (this.el) this.el.remove();
    this.el = null; this.anchor = null; this.onChange = null; this.state = null;
  },
};

/* Same manners as the colour picker: a small panel under the button it came from,
   closing on the next click elsewhere and following the button as the page scrolls. */
const alignPicker = {
  el: null, anchor: null, onPick: null,
  open(anchor, onPick){
    this.close();
    this.anchor = anchor; this.onPick = onPick;
    const el = document.createElement('div');
    el.className = 'fig-alignpop';
    el.innerHTML = ALIGN_CELLS.map(c=>
      `<button type="button" class="btn btn-sm${c === F.align ? ' is-on' : ''}" data-al="${c}" title="${ALIGN_NAMES[c]}">${ALIGN_ICON(c)}</button>`).join('');
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener('click', e=>{
      const b = e.target.closest('[data-al]');
      if (!b) return;
      const pick = this.onPick;
      const v = b.dataset.al;
      this.close();
      if (pick) pick(v);
    });
    this._reposition();
    this._onScroll = ()=> this._reposition();
    window.addEventListener('scroll', this._onScroll, true);
    window.addEventListener('resize', this._onScroll);
    setTimeout(()=>{
      this._away = ev=>{ if (this.el && !this.el.contains(ev.target) && ev.target !== anchor) this.close(); };
      document.addEventListener('pointerdown', this._away);
    }, 0);
  },
  _reposition(){
    if (!this.el || !this.anchor) return;
    const b = this.anchor.getBoundingClientRect();
    this.el.style.left = Math.max(6, Math.min(window.innerWidth - 130, b.left)) + 'px';
    this.el.style.top = (b.bottom + 4) + 'px';
  },
  close(){
    if (this._away) document.removeEventListener('pointerdown', this._away);
    if (this._onScroll){
      window.removeEventListener('scroll', this._onScroll, true);
      window.removeEventListener('resize', this._onScroll);
    }
    this._away = this._onScroll = null;
    if (this.el) this.el.remove();
    this.el = null; this.anchor = null; this.onPick = null;
  },
};

// One end of the manual range for the currently selected column / row. Shows the
// resolved auto value when nothing has been typed yet, so the field starts sensible.
function manNum(label, bag, end){
  const i = F.rangePanel | 0;
  const cur = F[bag][i];
  const r = computeRanges();
  const auto = bag === 'xMan' ? (r.xOf[i] || [0,1]) : (r.yOf[i] || [0,1]);
  const v = cur ? cur[end] : auto[end];
  return `<label class="fig-row"><span>${label}</span>${numField(`data-man="${bag}" data-end="${end}"`, +(+v).toPrecision(6), -1e12, 1e12)}</label>`;
}

/* Axis-title editor: an ordinary text field over the ^{}/_{} notation, plus the two
   things that notation is for and a tray of characters a keyboard does not offer. */
const RICH_CHARS = 'α β γ δ ε ζ η θ κ λ μ ν ξ π ρ σ τ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω · × ÷ ± ∓ ° ′ ″ Å ℏ ∞ ≈ ≠ ≤ ≥ → ← ↔ ‰ √ ∫ ∂ ∆ ⟨ ⟩'.split(' ');

/* Character map: an anchored popup that behaves like the colour picker — click the
   same button again to close it, click anywhere else to dismiss, Escape closes it
   without closing the composer behind it. */
const charPicker = {
  el: null, anchor: null, onPick: null,
  build(){
    if (this.el) return;
    const el = document.createElement('div');
    el.className = 'char-popup';
    el.style.display = 'none';
    el.innerHTML = RICH_CHARS.map(c=>`<button type="button" data-ch="${esc(c)}">${esc(c)}</button>`).join('');
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener('click', e=>{
      const b = e.target.closest('[data-ch]');
      if (b && this.onPick) this.onPick(b.dataset.ch);
    });
    document.addEventListener('pointerdown', e=>{
      if (el.style.display === 'none') return;
      if (!el.contains(e.target) && e.target !== this.anchor && !this.anchor?.contains(e.target)) this.close();
    }, true);
    document.addEventListener('keydown', e=>{
      if (e.key === 'Escape' && el.style.display !== 'none'){ e.stopPropagation(); this.close(); }
    }, true);
  },
  open(anchor, onPick){
    this.build();
    if (this.anchor === anchor && this.el.style.display !== 'none'){ this.close(); return; }
    if (this.anchor) this.anchor.classList.remove('cp-anchored');
    this.anchor = anchor; anchor.classList.add('cp-anchored');
    this.onPick = onPick;
    this.el.style.display = 'flex';
    this.reposition();
    if (!this._onScroll) this._onScroll = ()=> this.reposition();
    window.addEventListener('scroll', this._onScroll, true);
    window.addEventListener('resize', this._onScroll);
  },
  reposition(){
    if (!this.anchor) return;
    const r = this.anchor.getBoundingClientRect();
    const pw = this.el.offsetWidth || 240, ph = this.el.offsetHeight || 200;
    let left = r.left, top = r.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
    this.el.style.left = Math.max(8, left) + 'px';
    this.el.style.top = Math.max(8, top) + 'px';
  },
  close(){
    if (!this.el) return;
    this.el.style.display = 'none';
    if (this.anchor) this.anchor.classList.remove('cp-anchored');
    if (this._onScroll){
      window.removeEventListener('scroll', this._onScroll, true);
      window.removeEventListener('resize', this._onScroll);
    }
    this.anchor = null; this.onPick = null;
  },
};

function titleField(label, key){
  return `<div class="fig-titlefield">
    <label class="fig-row"><span>${label}</span><input type="text" data-k="${key}" data-rich="${key}" value="${esc(F[key])}"></label>
    <div class="fig-richbar">
      <button class="btn btn-sm" type="button" data-rich-act="^" data-for="${key}" title="Superscript the selection">x<sup>2</sup></button>
      <button class="btn btn-sm" type="button" data-rich-act="_" data-for="${key}" title="Subscript the selection">x<sub>2</sub></button>
      <button class="btn btn-sm" type="button" data-rich-act="chars" data-for="${key}" title="Insert a special character">&#937;</button>
      <span class="txt-meta">^{ } raises, _{ } lowers</span>
    </div>
  </div>`;
}

/* A figure of bars only. There is no line to style and no symbol to pick, and the
   series list says different things there, so it is asked before the list is built. */
const barMode = ()=> F.series.length > 0 && F.series.every(s=> s.kind === 'bar');

/* What every series says for one property, or null when they disagree — which is
   what the "all series" row shows: a value only where there is one to show, and a
   dash where the series differ, so the row reports as well as sets. */
function commonOf(get){
  if (!F.series.length) return null;
  const first = get(F.series[0]);
  return F.series.every(s=> get(s) === first) ? first : null;
}

/* The head of the series list: the column names, and under them one row that sets
   the same property on every series at once. Both are built to the same measurements
   as a series row, so the columns line up down the whole list. */
function allSeriesHtml(){
  const w = commonOf(s=> s.width);
  const dash = commonOf(s=> s.dash);
  const marker = commonOf(s=> s.marker);
  const texture = commonOf(s=> s.texture || 'solid');
  const DASH_MIX = dash === null, MARK_MIX = marker === null, TEX_MIX = texture === null;
  const bars = barMode();
  return `
    <div class="fig-serie fig-serie-caps">
      <span class="fig-grip fig-grip-off"></span>
      <span class="fig-cap fig-cap-box"></span>
      <span class="fig-cap fig-cap-box"></span>
      <span class="fig-cap fig-cap-box"></span>
      <span class="fig-cap fig-cap-name">name</span>
      <span class="fig-cap fig-cap-num">width</span>
      <span class="fig-cap fig-cap-sel">${bars ? 'texture' : 'line'}</span>
      ${bars ? '' : '<span class="fig-cap fig-cap-sel">symbol</span>'}
    </div>
    <div class="fig-serie fig-serie-all">
      <span class="fig-grip fig-grip-off"></span>
      ${figToggle('data-all="show"', F.series.every(s=>s.show), ICON_DRAW, 'Draw all / draw none')}
      ${figToggle('data-all="inLegend"', F.series.every(s=>s.inLegend!==false), ICON_LEGEND, 'List all in the legend / none')}
      <button class="palette-pick-btn fig-pal" type="button" title="Apply a colour palette to every series"></button>
      <button type="button" class="btn btn-sm primary fig-restore" data-restore
              title="Drop the names typed here and take the project's own again">Restore</button>
      <input type="text" inputmode="decimal" data-num="1" data-all="width" data-min="0.1" data-max="6"
             value="${w === null ? '' : w}" placeholder="—" title="Line / bar width for every series">
      ${bars ? `
        <button type="button" class="fig-fill" data-fill="all" title="Fill for every series">
          ${TEX_MIX ? '<span class="fig-fill-sw"></span><span>—</span>'
                    : `${fillPreview({ texture, color:'#888888', fillOpacity: commonOf(s=> s.fillOpacity == null ? 1 : s.fillOpacity) })}<span>${TEXTURES[texture]}</span>`}
        </button>` : `
        <select data-all="dash" title="Line style for every series">
          ${DASH_MIX ? '<option value="" selected>—</option>' : ''}
          ${Object.entries(DASHES).map(([v,n])=>
            `<option value="${v||'solid'}"${!DASH_MIX && dash === v ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
        <select data-all="marker" title="Symbol for every series">
          ${MARK_MIX ? '<option value="" selected>—</option>' : ''}
          ${Object.entries(MARKERS).map(([v,n])=>
            `<option value="${v}"${!MARK_MIX && marker === v ? ' selected' : ''}>${n}</option>`).join('')}
        </select>`}
    </div>`;
}

/* One series row. Which panel it is in is said by the group it sits in, so the row
   itself carries no panel selector: a series moves by being dragged into another
   group, the way a bar moves between divisions. */
function serieRowHtml(s, i){
  return `
    <div class="fig-serie" data-s="${i}">
      <span class="fig-grip" title="Drag to reorder, or into another panel">${GRIP}</span>
      ${figToggle(`data-sk="show" data-s="${i}"`, s.show, ICON_DRAW, 'Draw this series')}
      ${figToggle(`data-sk="inLegend" data-s="${i}"`, s.inLegend !== false, ICON_LEGEND, 'List it in the legend')}
      ${s.kind === 'bar'
        ? `<button class="palette-pick-btn fig-spal" type="button" data-spal="${i}" title="Apply a colour palette to this series' divisions"></button>`
        : `<button class="color-swatch" data-sw="${i}" data-color="${s.color}" style="background:${s.color}" title="Pick color"></button>`}
      <input type="text" data-sk="label" data-s="${i}" value="${esc(s.label)}" class="fig-slabel">
      ${s.kind === 'bar'
        ? `${numField(`data-sk="width" data-s="${i}" title="Bar width (fraction of the category slot)"`, s.width, 0.1, 1)}
           <button type="button" class="fig-fill" data-fill="${i}" title="How this series' bars are filled">
             ${fillPreview(s)}<span>${TEXTURES[s.texture || 'solid']}</span>
           </button>
           ${barMode() ? '' : '<span class="fig-cap fig-cap-sel"></span>'}`
        : `${numField(`data-sk="width" data-s="${i}" title="Line width"`, s.width, 0.2, 6)}
           <select data-sk="dash" data-s="${i}" title="Line style">
             ${Object.entries(DASHES).map(([v,n])=>`<option value="${v}"${s.dash===v?' selected':''}>${n}</option>`).join('')}
           </select>
           <select data-sk="marker" data-s="${i}" title="Symbol">
             ${Object.entries(MARKERS).map(([v,n])=>`<option value="${v}"${s.marker===v?' selected':''}>${n}</option>`).join('')}
           </select>`}
    </div>
    ${s.kind === 'bar' ? divisionsHtml(s, i) : ''}`;
}

// The series listed under the panel they are drawn in, one titled group per panel.
function panelGroupsHtml(){
  return F.panels.map((p, pi)=>`
    <div class="fig-group" data-pg="${pi}">
      <div class="fig-group-h">P${pi+1}${p.title ? ' — ' + esc(p.title) : ''}</div>
      ${F.series.map((s, i)=> s.panel === pi ? serieRowHtml(s, i) : '').join('')
        || '<p class="txt-meta fig-group-empty">Drag a series here.</p>'}
    </div>`).join('');
}

function controlsHtml(){
  const DL = F.dataLabels;
  return `
  <section class="fig-sec"><h4>Figure</h4>
    ${num('Width (mm)','wmm',5,2000)}${num('Height (mm)','hmm',5,2000)}${num('Export DPI','dpi',1,20000)}
    ${chk('Plot area fills what the margins leave','plotAuto')}
    ${F.plotAuto ? '' : `${num('Plot width (mm)','plotW',5,2000)}${num('Plot height (mm)','plotH',5,2000)}
      <label class="fig-row"><span>Where the plot area sits</span>
        <button class="btn btn-sm fig-align" type="button" data-align-btn title="Align the plot area inside the margins">${ALIGN_ICON(F.align)}</button></label>`}
    <label class="fig-row"><span>File name</span><input type="text" data-k="name" value="${esc(F.name)}"></label>
  </section>

  <section class="fig-sec"><h4>Layout</h4>
    ${num('Rows','rows',1,8)}${num('Columns','cols',1,8)}
    <div class="fig-panels">
      ${F.panels.map((p,i)=>`
        <div class="fig-panel" data-p="${i}">
          <b>P${i+1}</b>
          <label>row${numField(`data-pk="r" data-p="${i}"`, p.r+1, 1, F.rows)}</label>
          <label>col${numField(`data-pk="c" data-p="${i}"`, p.c+1, 1, F.cols)}</label>
          <label>&#8597;${numField(`data-pk="rs" data-p="${i}"`, p.rs, 1, F.rows)}</label>
          <label>&#8596;${numField(`data-pk="cs" data-p="${i}"`, p.cs, 1, F.cols)}</label>
          <input type="text" class="fig-ptitle" data-pk="title" data-p="${i}" value="${esc(p.title)}" placeholder="panel title">
          <button class="btn is-danger btn-sm" data-del-panel="${i}" title="Remove panel">&#10005;</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-sm" data-add-panel type="button">+ Add panel</button>
    <p class="txt-meta">Panels tile the grid and always touch. Adding one deals the series out evenly.</p>
  </section>

  <section class="fig-sec">
    <div class="fig-sechead">
      <h4>Series</h4>
    </div>
    <div class="fig-series">
      ${F.series.length ? allSeriesHtml() : ''}
      ${F.series.length ? panelGroupsHtml() : '<p class="txt-meta">This plot has no series to compose.</p>'}
    </div>
    <p class="txt-meta">Drag a series by its handle to reorder it, or into another panel's group to move it there.</p>
  </section>

  <section class="fig-sec"><h4>Axes &amp; scale</h4>
    ${titleField('X title', 'xlabel')}
    ${titleField('Y title', 'ylabel')}
    ${sel('X title placing','titleModeX',[['per-panel','one per panel'],['shared','shared by all panels']],F.titleModeX)}
    ${sel('Y title placing','titleModeY',[['per-panel','one per panel'],['shared','shared by all panels']],F.titleModeY)}
    <div class="fig-subhead">Range</div>
    <div class="fig-rangecols">${rangeColHtml('x')}${rangeColHtml('y')}</div>
    <div class="fig-subhead">Ticks</div>
    ${chk('X major step chosen automatically','xStepAuto')}
    ${autoNum('X major step','xStep','xStepAuto',0,1e9, autoStepOf('x'))}
    ${chk('Y major step chosen automatically','yStepAuto')}
    ${autoNum('Y major step','yStep','yStepAuto',0,1e9, autoStepOf('y'))}
    ${chk('X minors per major chosen automatically','minorXAuto')}
    ${autoNum('X minors per major','minorX','minorXAuto',0,20, 4)}
    ${chk('Y minors per major chosen automatically','minorYAuto')}
    ${autoNum('Y minors per major','minorY','minorYAuto',0,20, 4)}
    <div class="fig-subhead">Grid</div>
    ${chk('Vertical lines (X ticks)','x','g')}
    ${chk('Horizontal lines (Y ticks)','y','g')}
    ${chk('Include minor ticks','minor','g')}
    ${sel('Line style','dash',Object.entries(DASHES),F.grid.dash,'g')}
  </section>

  <section class="fig-sec"><h4>Panel axes</h4>
    <label class="fig-row"><span>Panel</span>
      <select data-k="axSel">
        <option value="all"${axSel==='all'?' selected':''}>All panels</option>
        ${panelOptions(axSel)}
      </select></label>
    <div class="fig-axhead"><span></span><span>Axis</span><span>Major</span><span>Minor</span><span>Labels</span><span>Title</span><span>Ticks</span></div>
    ${SIDES.map(side=>{
      const a = axShown()[side];
      const cb = (k)=>`<input type="checkbox" data-ak="${k}" data-side="${side}"${a[k]?' checked':''}>`;
      return `<div class="fig-axrow"><b>${side}</b>
        ${cb('on')}${cb('major')}${cb('minor')}${cb('labels')}${cb('title')}
        <select data-ak="dir" data-side="${side}">
          ${['out','in','both'].map(d=>`<option value="${d}"${a.dir===d?' selected':''}>${d}</option>`).join('')}
        </select></div>`;
    }).join('')}
    ${chk('Keep labels and titles off edges that face another panel','innerClean')}
    <p class="txt-meta">With that on, a side facing a neighbouring panel keeps its tick marks only — which is what stops two panels' numbers from running into each other.</p>
  </section>

  <section class="fig-sec"><h4>Data labels</h4>
    ${chk('Show a value on every data point','on','dl')}
    ${!DL.on ? '' : `
      ${sel('Position','pos',[['above','above the mark'],['inside','inside, at the top'],['center','centred'],['below','below the mark']],DL.pos,'dl')}
      <label class="fig-row"><span>Rotation (&deg;)</span>${numField('data-dl="rot"', DL.rot, 0, 90)}</label>
      <label class="fig-row"><span>Distance (px)</span>${numField('data-dl="off"', DL.off, -100, 100)}</label>
      <label class="fig-row"><span>Decimals</span>${numField('data-dl="dec"', DL.dec, 0, 6)}</label>
      <label class="fig-row"><span>Size (pt)</span>${numField('data-dl="size"', DL.size, 3, 24)}</label>
      ${chk('Colour each label for contrast with what is behind it','autoInk','dl')}
      <p class="txt-meta">Bars keep the text the source plot formatted (value &plusmn; error); everything else shows its Y value.</p>`}
  </section>

  <section class="fig-sec"><h4>Legend &amp; type</h4>
    ${sel('Legend','legendMode',[['none','none'],['per-panel','one per panel'],['global','one for the figure']],F.legendMode)}
    ${F.legendMode === 'per-panel' ? sel('Corner','legendCorner',
        [['tl','top left'],['tr','top right'],['bl','bottom left'],['br','bottom right']],F.legendCorner) : ''}
    ${F.legendMode === 'global' ? `
      ${sel('Placing','legendPlace',[['bottom','below the panels'],['top','above the panels']],F.legendPlace)}
      ${sel('Alignment','legendAlign',[['left','left'],['center','centred'],['right','right']],F.legendAlign)}
      ${num('Columns (0 = one row)','legendCols',0,12)}` : ''}
    ${F.legendMode === 'none' ? '' : `${num('Distance (px)','legendGap',0,40)}${chk('Draw a frame behind it','legendFrame')}
      ${F.legendFrame ? `${chk('Outline around the frame','legendFrameLine')}
        ${num('Frame background opacity (0–1)','legendFrameAlpha',0,1)}` : ''}`}
    <div class="fig-subhead">Type</div>
    ${sel('Font','family', Object.entries(FONTS).map(([k,v])=>[k, v.label]), F.font.family, 'f')}
    <label class="fig-row"><span>Colour of every line and letter</span>
      <button class="color-swatch" data-inksw data-color="${F.inkColor}" style="background:${F.inkColor}" title="Frame, ticks, numbers, titles, legend — everything but the data"></button></label>
    <div class="fig-subhead">Font sizes (pt)</div>
    <label class="fig-row"><span>Tick numbers</span>${numField('data-f="tick"', F.font.tick, 4, 24)}</label>
    <label class="fig-row"><span>Axis titles</span>${numField('data-f="axis"', F.font.axis, 4, 24)}</label>
    <label class="fig-row"><span>Legend</span>${numField('data-f="legend"', F.font.legend, 4, 24)}</label>
    <label class="fig-row"><span>Panel titles</span>${numField('data-f="title"', F.font.title, 4, 24)}</label>
  </section>`;
}

// True if placing panel `i` at r,c with the given span would sit on another panel.
// Panels tile a table: they may leave holes, but they must never overlap.
function overlaps(i, r, c, rs, cs){
  return F.panels.some((q, k)=> k !== i &&
    r < q.r + q.rs && q.r < r + rs && c < q.c + q.cs && q.c < c + cs);
}

// Keep every panel inside the current grid after rows/cols change, and collapse
// any span that a shrunken grid turned into an overlap.
function clampPanels(){
  F.panels.forEach((p, i)=>{
    p.r = Math.min(Math.max(0, p.r), F.rows - 1);
    p.c = Math.min(Math.max(0, p.c), F.cols - 1);
    p.rs = Math.min(Math.max(1, p.rs), F.rows - p.r);
    p.cs = Math.min(Math.max(1, p.cs), F.cols - p.c);
    if (overlaps(i, p.r, p.c, p.rs, p.cs)){ p.rs = 1; p.cs = 1; }
    if (!p.axes) p.axes = newAxes();
  });
  if (axSel !== 'all' && axSel >= F.panels.length) axSel = 0;
  if (F.rangePanel >= F.panels.length) F.rangePanel = 0;
  if (F.xPanel >= F.panels.length) F.xPanel = 0;
  if (F.yPanel >= F.panels.length) F.yPanel = 0;
  F.series.forEach(s=>{ if (s.panel >= F.panels.length) s.panel = 0; });
}

// Deal the series out over the panels in order, as evenly as the counts allow —
// 8 series over 3 panels give 3 / 3 / 2. Run whenever a panel is added, so a new
// panel arrives with its share of the data instead of empty.
function distributeSeries(){
  const n = F.series.length, P = F.panels.length;
  if (!n || !P) return;
  F.series.forEach((s, i)=>{ s.panel = Math.floor(i * P / n); });
}

/* The series a colour change reaches. By series, that is the one picked; by panel, it
   is that one plus whichever series sits at the same place in every other panel. */
function samePositionSeries(i){
  const picked = F.series[i];
  if (!picked) return [];
  if (F.palScope !== 'panel') return [picked];
  const seen = new Map();
  const posOf = [];
  F.series.forEach((s, k)=>{
    const n = seen.get(s.panel) || 0;
    posOf[k] = n;
    seen.set(s.panel, n + 1);
  });
  return F.series.filter((_, k)=> posOf[k] === posOf[i]);
}

// A category's name: the one typed into the composer, else the one the plot came with.
function catText(x){
  const own = F.catNames && F.catNames[x];
  if (own != null && own !== '') return own;
  const cat = F.cats && F.cats.find(c=> c.x === x);
  return cat ? cat.text : '';
}

/* The name of one bar: the category it stands on, failing that its place in the series.
   Where several bar series share those categories — raw against corrected, H2 against
   O2 — the category alone would name two different bars the same, so the series it
   came from is kept alongside it. */
function barName(s, j){
  const cat = F.cats && F.cats.find(c=> c.x === s.xs[j]);
  if (!cat) return `${s.label} ${j + 1}`;
  const txt = catText(s.xs[j]);
  const many = F.series.some(t=> t.kind === 'bar' && t.id !== s.id);
  return many ? `${txt} ${s.label}` : txt;
}

/* Divisions: colour groups inside one bar series. A bar chart draws one quantity per
   series — a gas, a gap, a size — and the bars of a series are all the same colour
   because they are all the same quantity. A division re-colours part of them under a
   name of its own, to set apart samples that share some feature, and it is what the
   legend lists: the series says what is measured, the divisions say what is worth
   seeing. Bars keep their places whatever the divisions do, so a chart does not
   change shape when one is added — which is the whole difference from making the
   parts series of their own.

   Every bar series has at least one division, and that first one follows the series'
   own name and colour until it is given ones of its own — so a plot nobody has divided
   behaves exactly as before and a palette still reaches it, while a series and its
   first division can still be named apart where that reads better. */
const divsOf = s => (s.divs && s.divs.length) ? s.divs : [{}];
const divName = (s, k)=> (divsOf(s)[k] && divsOf(s)[k].name) || s.label;
const divColor = (s, k)=> (divsOf(s)[k] && divsOf(s)[k].color) || s.color;
const divOfBar = (s, j)=> Math.min(Math.max((s.divOf && s.divOf[j]) || 0, 0), divsOf(s).length - 1);

// A new division takes an even share of the bars, the way a new panel takes an even
// share of the series; from there each bar can be moved by hand.
function spreadDivs(s){
  const n = divsOf(s).length, m = s.xs.length;
  s.divOf = s.xs.map((_, j)=> Math.min(n - 1, Math.floor(j * n / m)));
}

function addDiv(i){
  const s = F.series[i];
  // One division per bar at most: past that there is nothing left to divide.
  if (!s || s.kind !== 'bar' || divsOf(s).length >= s.xs.length) return false;
  // Avoid every colour already on the figure, not just this series' own: a division
  // that repeated a neighbouring series' colour would read as that series.
  const taken = new Set();
  F.series.forEach(t=> divsOf(t).forEach((_, k)=> taken.add(divColor(t, k))));
  const pool = F.palette || CP_PALETTES[0].colors;
  const k = divsOf(s).length;
  s.divs = divsOf(s).slice();
  s.divs.push({ name: `${s.label} ${k + 1}`,
                color: pool.find(c=> !taken.has(c)) || pool[k % pool.length] });
  spreadDivs(s);
  return true;
}

function delDiv(i, k){
  const s = F.series[i];
  if (!s || k === 0 || !s.divs || k >= s.divs.length) return false;
  s.divs.splice(k, 1);
  spreadDivs(s);
  return true;
}

/* A series is one legend entry — a bar series is one per division, since the legend
   speaks of divisions. With a single division that comes to the same thing, because
   it carries the series' own name and colour. */
function legendEntries(list){
  const out = [];
  for (const s of list){
    if (s.kind === 'bar')
      divsOf(s).forEach((_, k)=> out.push({ ...s, color: divColor(s, k), label: divName(s, k) }));
    else out.push(s);
  }
  return out;
}

// Spread a palette over the series. 'series' scope walks every series once, so no
// two share a colour; 'panel' scope restarts the palette inside each panel, so the
// same colours repeat panel by panel — useful when panels compare like with like.
function applyPalette(colors){
  colors = colors || F.palette;
  if (!colors || !colors.length) return;
  F.palette = colors.slice();
  const lines = F.series.filter(s=> s.kind !== 'bar');
  if (F.palScope === 'panel'){
    const seen = new Map();
    lines.forEach(s=>{
      const k = seen.get(s.panel) || 0;
      s.color = colors[k % colors.length];
      seen.set(s.panel, k + 1);
    });
  } else {
    lines.forEach((s, i)=>{ s.color = colors[i % colors.length]; });
  }
  // A bar series is read by division, not by series — the series is told apart by its
  // texture — so the palette runs across its divisions, and every bar series takes the
  // same run. One palette applied to the figure therefore colours like with like.
  F.series.filter(s=> s.kind === 'bar').forEach(s=> paletteOnSeries(s, colors));
}

// The same spread over one series' divisions, for the palette button on its own row.
function paletteOnSeries(s, colors){
  if (!colors || !colors.length) return;
  s.color = colors[0];
  if (s.divs && s.divs.length)
    s.divs = s.divs.map((d, k)=> k === 0 ? { ...d, color: null } : { ...d, color: colors[k % colors.length] });
}

/* True while the sidebar is being replaced. Throwing away a focused field makes the
   browser fire one last 'change' on it, carrying the value the rebuild has just
   superseded — applying that would quietly undo whatever caused the rebuild (loading
   a preset, say). Those events are ignored. */
let rebuilding = false;

/* The names this plot's project gives, back over the ones typed into the composer —
   the first division's included, since that is the series' name said twice. Anything
   a series does not get from the project, like the name of a second division, is left
   alone: there is nothing to put back. */
function restoreNames(){
  if (!srcPlot) return;
  const fresh = seriesFromPlot(srcPlot, srcOpts && srcOpts.legendEl).series;
  F.series.forEach((s, i)=>{
    const src = fresh.find(t=> t.id === s.id) || fresh[i];
    if (src) s.label = src.label;
    delete s.rename;
    if (s.divs && s.divs[0]) s.divs[0] = { ...s.divs[0], name: '' };
  });
}

function refresh(rebuild){
  clampPanels();
  if (rebuild){
    rebuilding = true;
    try { controlsEl.innerHTML = controlsHtml(); } finally { rebuilding = false; }
    wireSeriesDrag();
  }
  markMixedToggles();
  renderPreview();
}

/* The all-series row reports as well as sets, so it is brought back into line with
   the series after every change — including the ones that do not rebuild the sidebar.
   A field the pointer is typing in is left alone. "Neither on nor off" can only be
   said to the DOM: there is no markup for an indeterminate checkbox. */
function markMixedToggles(){
  if (!controlsEl || !F.series.length) return;
  const el = sel => controlsEl.querySelector('.fig-serie-all ' + sel);
  const box = (sel, get)=>{
    const e = el(sel); if (!e) return;
    const on = F.series.filter(get).length;
    e.checked = on === F.series.length;
    e.indeterminate = on > 0 && on < F.series.length;
  };
  box('input[data-all="show"]', s=> s.show);
  box('input[data-all="inLegend"]', s=> s.inLegend !== false);

  const field = (sel, value, mixedText)=>{
    const e = el(sel);
    if (!e || e === document.activeElement) return;
    if (e.tagName === 'SELECT'){
      const opt = [...e.options].find(o=> o.value === '');
      if (value === null){
        if (!opt) e.insertBefore(new Option(mixedText, ''), e.firstChild);
        e.value = '';
      } else {
        if (opt) opt.remove();
        e.value = value === '' ? 'solid' : value;
      }
    } else e.value = value === null ? '' : value;
  };
  /* Always in its place, live only when there is something to put back — so the row
     keeps its shape and the button says whether any name has been typed over. Typing
     one does not rebuild the sidebar, which would take the caret away mid-word, so it
     is enabled and disabled from here with the rest of what this row reports. */
  const restore = controlsEl.querySelector('[data-restore]');
  if (restore) restore.disabled =
    !F.series.some(s=> s.rename || (s.divs && s.divs[0] && s.divs[0].name));

  // Swatches show a colour the popup may have just changed; they are redrawn in place
  // for the same reason the fill button is.
  syncSwatches();

  field('input[data-all="width"]', commonOf(s=> s.width));
  field('select[data-all="dash"]', commonOf(s=> s.dash), '—');
  field('select[data-all="marker"]', commonOf(s=> s.marker), '—');
}

// Every colour square in the sidebar, brought back to the colour it stands for.
function syncSwatches(){
  if (!controlsEl) return;
  controlsEl.querySelectorAll('.color-swatch[data-dsw]').forEach(b=>{
    const [i, k] = b.dataset.dsw.split(':').map(Number);
    const s = F.series[i]; if (!s) return;
    const c = divColor(s, k);
    b.dataset.color = c; b.style.background = c;
  });
  controlsEl.querySelectorAll('.color-swatch[data-sw]').forEach(b=>{
    const s = F.series[+b.dataset.sw]; if (!s) return;
    b.dataset.color = s.color; b.style.background = s.color;
  });
  controlsEl.querySelectorAll('.fig-fill').forEach(b=>{
    if (b.dataset.fill === 'all') return;
    const s = F.series[+b.dataset.fill]; if (!s) return;
    const sw = b.querySelector('.fig-fill-sw');
    if (sw) sw.outerHTML = fillPreview(s);
  });
}

// Drag-to-reorder over the series rows, same grip-and-drop feel as the file list:
// press the handle, move over the row you want the series to land on, release.
function wireSeriesDrag(){
  const rows = [...controlsEl.querySelectorAll('.fig-serie')];
  const groups = [...controlsEl.querySelectorAll('.fig-group')];
  const at = (sel, list) => (x, y)=> list.find(el=>{
    const b = el.getBoundingClientRect();
    return y >= b.top && y <= b.bottom && x >= b.left && x <= b.right;
  }) || null;
  const rowAt = y => rows.find(r=>{ const b = r.getBoundingClientRect(); return y >= b.top && y <= b.bottom; }) || null;
  const groupAt = at('.fig-group', groups);
  let from = null;
  rows.forEach(row=>{
    const handle = row.querySelector('.fig-grip');
    if (!handle) return;
    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      from = +row.dataset.s;
      row.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch(_){}
    });
    handle.addEventListener('pointermove', e=>{
      if (from == null) return;
      const t = rowAt(e.clientY), gp = groupAt(e.clientX, e.clientY);
      rows.forEach(r=> r.classList.toggle('drag-over', r === t && +r.dataset.s !== from));
      groups.forEach(g=> g.classList.toggle('drag-into', g === gp));
    });
    const finish = e=>{
      if (from == null) return;
      const t = rowAt(e.clientY), gp = groupAt(e.clientX, e.clientY);
      const f = from; from = null;
      rows.forEach(r=> r.classList.remove('drag-over', 'dragging'));
      groups.forEach(g=> g.classList.remove('drag-into'));
      const moved = F.series[f];
      if (!moved) return;
      // Dropped on a row: take its place. Dropped anywhere else in a group: join that
      // panel at the end. Either way the panel is the group the pointer ended over.
      const panel = gp ? +gp.dataset.pg : moved.panel;
      const to = t ? +t.dataset.s : null;
      if (panel === moved.panel && (to == null || to === f)) return;
      moved.panel = panel;
      if (to != null && to !== f){
        F.series.splice(f, 1);
        F.series.splice(to, 0, moved);
      }
      applyPalette();
      pushUndo(); refresh(true);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', ()=>{
      from = null;
      rows.forEach(r=> r.classList.remove('drag-over','dragging'));
      groups.forEach(g=> g.classList.remove('drag-into'));
    });
  });
  wireBarDrag();
}

// The same gesture for the samples of a bar series: pick a row up by its handle and
// drop it in the division it belongs to.
function wireBarDrag(){
  const chips = [...controlsEl.querySelectorAll('.fig-barrow')];
  const groups = [...controlsEl.querySelectorAll('.fig-dgroup')];
  const groupAt = (x, y)=> groups.find(el=>{
    const b = el.getBoundingClientRect();
    return y >= b.top && y <= b.bottom && x >= b.left && x <= b.right;
  }) || null;
  chips.forEach(chip=>{
    const handle = chip.querySelector('.fig-grip') || chip;
    let dragging = false;
    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      dragging = true;
      chip.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch(_){}
    });
    handle.addEventListener('pointermove', e=>{
      if (!dragging) return;
      const gp = groupAt(e.clientX, e.clientY);
      groups.forEach(g=> g.classList.toggle('drag-into', g === gp));
    });
    const finish = e=>{
      if (!dragging) return;
      dragging = false;
      chip.classList.remove('dragging');
      const gp = groupAt(e.clientX, e.clientY);
      groups.forEach(g=> g.classList.remove('drag-into'));
      if (!gp) return;
      const [i, j] = chip.dataset.bar.split(':').map(Number);
      const [gi, k] = gp.dataset.dg.split(':').map(Number);
      const s = F.series[i];
      if (!s || gi !== i || divOfBar(s, j) === k) return;
      s.divOf = s.xs.map((_, n)=> divOfBar(s, n));
      s.divOf[j] = k;
      pushUndo(); refresh(true);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', ()=>{
      dragging = false;
      chip.classList.remove('dragging');
      groups.forEach(g=> g.classList.remove('drag-into'));
    });
  });
}

/* The preset bar sits in the footer, beside the export buttons: a picker that
   applies, "Save" to write these settings back into the preset you are on, and
   "Save as" to make a new one. Rebuilt whenever the stored list changes. */
/* Back to square one: the model is rebuilt from the source plot, so the data and the
   names come from the project as they are now, and every setting returns to its
   default — no remembered state, no preset applied. Undoable like any other edit. */
function resetFigure(){
  if (!srcPlot) return;
  F = buildModel(srcPlot, srcOpts);
  axSel = 'all'; presetSel = '';
  applyPalette();
  resetView();
  pushUndo();
  refresh(true);
  renderPresetBar();
}

function renderPresetBar(){
  if (!presetBar) return;
  const names = Object.keys(loadPresets()).sort();
  presetBar.querySelector('[data-preset="load"]').innerHTML =
    `<option value="">preset…</option>` +
    names.map(n=>`<option value="${esc(n)}"${n === presetSel ? ' selected' : ''}>${esc(n)}</option>`).join('');
  presetBar.querySelector('[data-preset="save"]').disabled = !presetSel;
  presetBar.querySelector('[data-preset="del"]').disabled = !presetSel;
}

function wirePresetBar(){
  const nameIn = presetBar.querySelector('[data-preset="name"]');
  presetBar.addEventListener('click', e=>{
    const btn = e.target.closest('[data-preset]');
    if (!btn || btn.tagName !== 'BUTTON') return;
    const presets = loadPresets();
    const act = btn.dataset.preset;
    if (act === 'saveas'){
      const name = (nameIn.value || '').trim();
      if (!name){ nameIn.focus(); return; }
      presets[name] = settingsSnapshot();
      presetSel = name;
      nameIn.value = '';
    } else if (act === 'save'){
      if (!presetSel) return;
      presets[presetSel] = settingsSnapshot();
      btn.classList.add('is-saved');
      setTimeout(()=> btn.classList.remove('is-saved'), 700);
    } else if (act === 'del'){
      if (!presetSel) return;
      delete presets[presetSel];
      presetSel = '';
    } else return;
    savePresets(presets);
    renderPresetBar();
  });
  presetBar.addEventListener('change', e=>{
    if (e.target.dataset.preset !== 'load') return;
    presetSel = e.target.value;
    const snap = loadPresets()[presetSel];
    if (snap){ applySettings(snap); pushUndo(); refresh(true); }
    renderPresetBar();
  });
}

/* Settings that change the shape of the sidebar itself. */
const SHOWS_MORE = new Set(['xAuto','yAuto','shareX','shareY','legendMode','legendFrame',
  'xStepAuto','yStepAuto','minorXAuto','minorYAuto']);

function wireControls(){
  const numKeys = new Set(['wmm','hmm','dpi','rows','cols','xmin','xmax','ymin','ymax','xStep','yStep','minorX','minorY','legendCols','legendGap','legendFrameAlpha','plotW','plotH']);
  const dlNum = new Set(['rot','off','dec','size']);

  /* Routes one control to the model and says whether the sidebar has to be rebuilt.
     Numeric fields (data-num) reach this from 'change', i.e. on blur or Enter, so a
     half-typed value never redraws and a rebuild can never steal the caret; every
     other control reaches it from 'input' and stays immediate. */
  const applyControl = t=>{
    let rebuild = false;
    if (t.dataset.k){
      const k = t.dataset.k;
      if (k === 'axSel'){ axSel = t.value === 'all' ? 'all' : +t.value; refresh(true); return null; }
      if (k === 'palScope'){ F.palScope = t.value; applyPalette(); pushUndo(); refresh(true); return null; }
      if (k === 'rangePanel'){ F.rangePanel = +t.value; refresh(true); return null; }
      // Which panel the Range column is about: nothing in the model changes, only
      // what the column shows, so it rebuilds and stops there.
      if (k === 'xPanel' || k === 'yPanel'){ F[k] = +t.value; F.rangePanel = +t.value; refresh(true); return null; }
      // Turning an auto range off must hand you the range you are looking at, not
      // the model's placeholder 0..1, so the bounds are read while auto still holds.
      if (k === 'plotAuto' && !t.checked){ F.plotW = lastInner.w; F.plotH = lastInner.h; rebuild = true; }
      if (k === 'plotAuto' && t.checked) rebuild = true;
      if ((k === 'xAuto' || k === 'yAuto') && !t.checked){
        const r = computeRanges(), i = (k === 'xAuto' ? F.xPanel : F.yPanel) | 0;
        if (k === 'xAuto'){ const [a, z] = r.xOf[i] || r.xOf[0] || [0, 1]; F.xmin = a; F.xmax = z; }
        else { const [a, z] = r.yOf[i] || r.yOf[0] || [0, 1]; F.ymin = a; F.ymax = z; }
      }
      if (numKeys.has(k)){ const v = readNum(t); if (v === null) return null; F[k] = v; }
      else F[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'rows' || k === 'cols'){ F[k] = Math.max(1, Math.round(F[k] || 1)); rebuild = true; }
      // Keys that decide which controls are on show have to redraw the sidebar, not
      // just the figure — the fields they reveal or lock are part of their effect.
      if (SHOWS_MORE.has(k)) rebuild = true;
    } else if (t.dataset.rauto){
      const X = t.dataset.rauto === 'x';
      const shared = X ? F.shareX : F.shareY;
      const sel = Math.min(Math.max(0, (X ? F.xPanel : F.yPanel) | 0), F.panels.length - 1);
      // The panel at the head of the group this one is scaled with.
      const i = shared ? sel : rangeRoot(sel, X ? 'shareXWith' : 'shareYWith');
      if (shared){
        // Same as the figure-wide switch: hand over the range on screen, so turning
        // it off starts from what is drawn rather than from a placeholder.
        const r = computeRanges();
        if (!t.checked){
          const [a, z] = (X ? r.xOf[i] : r.yOf[i]) || [0, 1];
          if (X){ F.xmin = a; F.xmax = z; } else { F.ymin = a; F.ymax = z; }
        }
        F[X ? 'xAuto' : 'yAuto'] = t.checked;
      } else {
        const p = F.panels[i]; if (!p) return null;
        if (!t.checked && !F[X ? 'xMan' : 'yMan'][i]){
          const r = computeRanges();
          F[X ? 'xMan' : 'yMan'][i] = ((X ? r.xOf[i] : r.yOf[i]) || [0, 1]).slice();
        }
        p[X ? 'xAuto' : 'yAuto'] = t.checked;
      }
      rebuild = true;
    } else if (t.dataset.ak){
      const v = t.type === 'checkbox' ? t.checked : t.value;
      for (const pi of axTargets()){
        const p = F.panels[pi]; if (!p) continue;
        (p.axes || (p.axes = newAxes()))[t.dataset.side][t.dataset.ak] = v;
      }
    } else if (t.dataset.man){
      const bag = t.dataset.man;
      const selP = Math.min(Math.max(0, (bag === 'xMan' ? F.xPanel : F.yPanel) | 0), F.panels.length - 1);
      const i = rangeRoot(selP, bag === 'xMan' ? 'shareXWith' : 'shareYWith');
      const r = computeRanges();
      const cur = F[bag][i] || (bag === 'xMan' ? (r.xOf[i] || [0,1]).slice() : (r.yOf[i] || [0,1]).slice());
      const v = readNum(t); if (v === null) return null;
      cur[+t.dataset.end] = v;
      F[bag][i] = cur;
    } else if (t.dataset.all){
      // One control, applied to every series at once.
      const k = t.dataset.all, v = t.value;
      if (k === 'show') F.series.forEach(s=>{ s.show = t.checked; });
      else if (k === 'inLegend') F.series.forEach(s=>{ s.inLegend = t.checked; });
      else if (v === '') return null;
      else if (k === 'width'){ const w = readNum(t); if (w === null) return null; F.series.forEach(s=>{ s.width = w; }); }
      else if (k === 'dash') F.series.forEach(s=>{ s.dash = (v === 'solid' ? '' : v); });
      else F.series.forEach(s=>{ s.marker = v; });
      rebuild = true;
    } else if (t.dataset.g){
      F.grid[t.dataset.g] = t.type === 'checkbox' ? t.checked : t.value;
    } else if (t.dataset.dl){
      const k = t.dataset.dl;
      if (dlNum.has(k)){ const v = readNum(t); if (v === null) return null; F.dataLabels[k] = v; }
      else F.dataLabels[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'on') rebuild = true;         // the rest of the section appears/hides
    } else if (t.dataset.f){
      if (t.dataset.f === 'family'){ F.font.family = t.value; }
      else { const v = readNum(t); if (v === null) return null; F.font[t.dataset.f] = v; }
    } else if (t.dataset.pk){
      const i = +t.dataset.p, p = F.panels[i]; if (!p) return null;
      const k = t.dataset.pk;
      if (k === 'title'){ p.title = t.value; }
      else {
        // Try the new position/span; if it would land on another panel, keep the
        // old value and put it back in the field.
        const want = (k === 'r' || k === 'c') ? Math.max(0, (parseInt(t.value, 10) || 1) - 1)
                                              : Math.max(1, parseInt(t.value, 10) || 1);
        const cand = { r:p.r, c:p.c, rs:p.rs, cs:p.cs, [k]: want };
        cand.rs = Math.min(cand.rs, F.rows - cand.r);
        cand.cs = Math.min(cand.cs, F.cols - cand.c);
        if (cand.r < F.rows && cand.c < F.cols && !overlaps(i, cand.r, cand.c, cand.rs, cand.cs)){
          p.r = cand.r; p.c = cand.c; p.rs = cand.rs; p.cs = cand.cs;
        } else {
          rebuild = true;   // reject: re-render the controls so the field snaps back
        }
      }
    } else if (t.dataset.bark){
      const [i, j] = t.dataset.bark.split(':').map(Number);
      const s = F.series[i]; if (!s) return null;
      // Held by the category, so every series standing on that sample reads it.
      F.catNames = { ...F.catNames, [s.xs[j]]: t.value };
    } else if (t.dataset.dk){
      const [i, k] = t.dataset.dk.split(':').map(Number);
      const s = F.series[i]; if (!s) return null;
      // Every division holds its own name, the first one included: until it is typed
      // in it shows the series' name, and from then on the two are free to differ.
      s.divs = divsOf(s).slice();
      s.divs[k] = { ...s.divs[k], name: t.value };
    } else if (t.dataset.share){
      const p = F.panels[+t.dataset.p]; if (!p) return null;
      p[t.dataset.share] = t.value === '' ? null : +t.value;
      rebuild = true;
    } else if (t.dataset.sk){
      const s = F.series[+t.dataset.s]; if (!s) return null;
      const k = t.dataset.sk;
      if (k === 'show') s.show = t.checked;
      else if (k === 'inLegend') s.inLegend = t.checked;
      else if (k === 'width'){ const v = readNum(t); if (v === null) return null; s.width = v; }
      else if (k === 'label'){ s.label = s.rename = t.value; }
      else s[k] = t.value;
    } else return null;
    return rebuild;
  };

  /* The first division's box shows the series' name for as long as it has none of
     its own, so renaming the series shows there at once. Done by hand rather than by
     rebuilding the sidebar, which would take the caret out of the field mid-word. */
  const mirrorName = (i, v)=>{
    const s = F.series[i];
    if (!s || (s.divs && s.divs[0] && s.divs[0].name)) return;
    const el = controlsEl.querySelector(`[data-dk="${i}:0"]`);
    if (el && el.value !== v) el.value = v;
  };

  const run = t=>{
    if (rebuilding || !t.isConnected) return;
    const rebuild = applyControl(t);
    if (rebuild === null) return;
    // While the first division is still borrowing the series' name, its box follows
    // what is typed in the series row. Once it has a name of its own it keeps it.
    if (t.dataset.sk === 'label') mirrorName(+t.dataset.s, t.value);
    // Echo the committed value back with a decimal point, so a comma typed by hand
    // is accepted but never left standing in the field.
    if (t.dataset.num && !rebuild){
      const v = readNum(t);
      if (v !== null) t.value = String(v);
    }
    pushUndo();
    refresh(rebuild);
  };

  // Live for everything that is a single decisive act; deferred to 'change' for the
  // fields you type a number into, so the figure follows the value you confirmed.
  controlsEl.addEventListener('input', e=>{ if (!e.target.dataset.num) run(e.target); });
  controlsEl.addEventListener('change', e=>{ if (e.target.dataset.num) run(e.target); });
  // Enter commits without leaving the field.
  controlsEl.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && e.target.dataset.num){ e.preventDefault(); run(e.target); }
  });
  controlsEl.addEventListener('change', e=>{ if (e.target.tagName === 'SELECT') refresh(false); });
  controlsEl.addEventListener('click', e=>{
    const rb = e.target.closest('[data-rich-act]');
    if (rb){
      const key = rb.dataset.for;
      const input = controlsEl.querySelector(`input[data-rich="${key}"]`);
      // Where the caret was before the button took focus, so an insert lands there.
      const insertAt = (text, wrap)=>{
        const a = input.selectionStart ?? input.value.length;
        const b = input.selectionEnd ?? a;
        const sel = input.value.slice(a, b);
        const ins = wrap ? `${wrap}{${sel}}` : text;
        input.value = input.value.slice(0, a) + ins + input.value.slice(b);
        // Wrapping an empty selection leaves the caret inside the braces, ready to type.
        const caret = a + ins.length - (wrap && !sel ? 1 : 0);
        input.focus(); input.setSelectionRange(caret, caret);
        F[key] = input.value;
        pushUndo(); refresh(false);
      };
      if (rb.dataset.richAct === 'chars') charPicker.open(rb, ch=> insertAt(ch, null));
      else insertAt(null, rb.dataset.richAct);
      return;
    }
    if (e.target.closest('[data-restore]')){
      restoreNames();
      pushUndo(); refresh(true);
      return;
    }
    const alignB = e.target.closest('[data-align-btn]');
    if (alignB){
      alignPicker.open(alignB, code=>{ F.align = code; pushUndo(); refresh(true); });
      return;
    }
    const inkB = e.target.closest('.color-swatch[data-inksw]');
    if (inkB){
      colorPickerUI.open(inkB, F.inkColor, color=>{ F.inkColor = color; pushUndo(); refresh(true); });
      return;
    }
    const fillB = e.target.closest('[data-fill]');
    if (fillB){
      const all = fillB.dataset.fill === 'all';
      const s0 = all ? null : F.series[+fillB.dataset.fill];
      if (!all && !s0) return;
      const bars = ()=> all ? F.series.filter(t=> t.kind === 'bar') : [s0];
      const cur = all
        ? { texture: commonOf(t=> t.texture || 'solid') || 'solid', color: '#888888',
            opacity: commonOf(t=> t.fillOpacity == null ? 1 : t.fillOpacity) ?? 1 }
        : { texture: s0.texture || 'solid', color: divColor(s0, 0), opacity: s0.fillOpacity == null ? 1 : s0.fillOpacity };
      fillPicker.open(fillB, cur, st=>{
        bars().forEach(t=>{ t.texture = st.texture; t.fillOpacity = st.opacity; });
        // A colour set here is the series' own — its first division's, which is the
        // same thing — so picking one stops a palette from spreading over it again.
        if (!all && st.color !== cur.color){ s0.color = st.color; F.palette = null; }
        pushUndo();
        refresh(false);
        // The button carries a picture of the fill, so it is redrawn where it stands
        // rather than by rebuilding the row out from under the open popup.
        const sw = fillB.querySelector('.fig-fill-sw');
        const txt = fillB.querySelector('span:last-child');
        const paint = all ? { texture: st.texture, color: '#888888', fillOpacity: st.opacity } : s0;
        if (sw) sw.outerHTML = fillPreview(paint);
        if (txt) txt.textContent = TEXTURES[st.texture];
        syncSwatches();
      }, { noColor: all });
      return;
    }
    const spal = e.target.closest('[data-spal]');
    if (spal){
      const s = F.series[+spal.dataset.spal]; if (!s) return;
      palettePickerUI.open(spal, colors=>{
        paletteOnSeries(s, colors);
        F.palette = null;     // one series coloured by hand: stop re-spreading over it
        pushUndo(); refresh(true);
      }, { colors: ()=> divsOf(s).map((_, k)=> divColor(s, k)) });
      return;
    }
    const dsw = e.target.closest('.color-swatch[data-dsw]');
    if (dsw){
      const [i, k] = dsw.dataset.dsw.split(':').map(Number);
      const s = F.series[i]; if (!s) return;
      colorPickerUI.open(dsw, divColor(s, k), color=>{
        // The first division IS the series' colour, so re-colouring it re-colours the
        // series — anything else would leave the row's own swatch saying otherwise.
        if (k === 0) s.color = color;
        else { s.divs = divsOf(s).slice(); s.divs[k] = { ...s.divs[k], color }; }
        F.palette = null;
        pushUndo(); refresh(true);
      });
      return;
    }
    const sw = e.target.closest('.color-swatch');
    if (sw){
      const i = +sw.dataset.sw, s = F.series[i]; if (!s) return;
      colorPickerUI.open(sw, s.color, color=>{
        // Under "palette by panel" the panels are meant to read alike, so a colour is
        // a property of a position within a panel, not of one series: every series
        // holding that position in its own panel takes the new colour too.
        for (const t of samePositionSeries(i)) t.color = color;
        F.palette = null;         // hand-picked: stop re-applying a palette over it
        pushUndo(); refresh(true);
      });
      return;
    }
    if (e.target.closest('.fig-pal')){
      palettePickerUI.open(e.target.closest('.fig-pal'),
        colors=>{ applyPalette(colors); pushUndo(); refresh(true); },
        {
          // Only the composer spreads a palette two ways, so only it offers the choice.
          scope: F.palScope,
          onScope: v=>{
            F.palScope = v; applyPalette(); pushUndo(); refresh(true);
            palettePickerUI.reanchor(controlsEl.querySelector('.fig-pal'));
          },
          colors: ()=> F.series.map(s=> s.color),
        });
      return;
    }
    const divB = e.target.closest('[data-adddiv], [data-deldiv]');
    if (divB){
      const done = divB.dataset.adddiv !== undefined
        ? addDiv(+divB.dataset.adddiv)
        : delDiv(...divB.dataset.deldiv.split(':').map(Number));
      if (!done) return;
      pushUndo(); refresh(true);
      return;
    }
    const addB = e.target.closest('[data-add-panel]');
    const delB = e.target.closest('[data-del-panel]');
    if (addB){
      // Drop the new panel in the first free cell, growing the grid if needed.
      const taken = new Set();
      F.panels.forEach(p=>{ for (let r=p.r;r<p.r+p.rs;r++) for (let c=p.c;c<p.c+p.cs;c++) taken.add(r+','+c); });
      let spot = null;
      for (let r = 0; r < F.rows && !spot; r++) for (let c = 0; c < F.cols && !spot; c++) if (!taken.has(r+','+c)) spot = [r,c];
      if (!spot){ F.rows += 1; spot = [F.rows-1, 0]; }
      F.panels.push(newPanel(spot[0], spot[1]));
      distributeSeries();
      applyPalette();
      pushUndo(); refresh(true);
    } else if (delB){
      const i = +delB.dataset.delPanel;
      if (F.panels.length <= 1) return;
      F.panels.splice(i, 1);
      F.series.forEach(s=>{ if (s.panel === i) s.panel = 0; else if (s.panel > i) s.panel--; });
      applyPalette();
      pushUndo(); refresh(true);
    }
  });
}

/* ---- Modal ----------------------------------------------------------------- */

export function openFigureEditor(plot, opts){
  if (!plot) return;
  srcPlot = plot; srcOpts = opts || {};
  F = buildModel(plot, srcOpts);
  axSel = 'all'; presetSel = '';
  recallSettings();
  applyPalette();
  undoStack = [snapshot()]; redoStack = [];
  if (!F.series.length){ /* still open — the user may only want axes/labels */ }

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fig-backdrop';
  // Force an English locale inside the modal: number inputs then use a decimal
  // point everywhere, whatever the browser's locale would otherwise render.
  backdrop.lang = 'en';
  backdrop.innerHTML = `
    <div class="fig-box">
      <div class="fig-head">
        <h3 class="txt-head" style="margin:0">Figure composer</h3>
        <span class="txt-meta">Export only — the plot on the page is never changed.</span>
        <button class="fig-x close-x" type="button" aria-label="Close">✕</button>
      </div>
      <div class="fig-body">
        <div class="fig-preview"><svg class="fig-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
        <div class="fig-controls"></div>
      </div>
      <div class="fig-foot">
        <span class="txt-meta fig-dim"></span>
        <span style="flex:1"></span>
        <button class="btn btn-sm fig-reset" type="button" data-fig-reset title="Back to the defaults, as if this plot's composer had just been opened">Reset</button>
        <div class="fig-presets">
          <select data-preset="load" title="Apply a saved preset"></select>
          <button class="btn btn-sm" type="button" data-preset="save" title="Save these settings into the selected preset">Save</button>
          <input type="text" data-preset="name" placeholder="new preset name">
          <button class="btn btn-sm" type="button" data-preset="saveas" title="Save these settings as a new preset">Save as</button>
          <button class="btn is-danger btn-sm" type="button" data-preset="del" title="Delete the selected preset">&#10005;</button>
        </div>
        <button class="btn btn-sm" type="button" data-fig-svg title="Save the figure as a vector file">Export SVG</button>
        <button class="btn btn-sm" type="button" data-fig-png title="Save the figure as an image file">Export PNG</button>
        <button class="btn primary" type="button" data-fig-copy title="Copy the figure to the clipboard, ready to paste">Copy PNG</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  previewSvg = backdrop.querySelector('.fig-svg');
  controlsEl = backdrop.querySelector('.fig-controls');
  presetBar = backdrop.querySelector('.fig-presets');
  controlsEl.innerHTML = controlsHtml();
  markMixedToggles();
  wireControls();
  wireSeriesDrag();
  wirePreviewView();
  resetView();
  wirePresetBar();
  renderPresetBar();

  const close = ()=>{
    clearTimeout(undoTimer);   // nothing left to record once the model is gone
    rememberSettings();
    window.removeEventListener('resize', onResize);
    charPicker.close();
    alignPicker.close();
    fillPicker.close();
    document.removeEventListener('keydown', onKey);
    backdrop.remove(); backdrop = null; F = null; dimEl = null; presetBar = null;
    srcPlot = null; srcOpts = null;
  };
  const onKey = e => {
    if (e.key === 'Escape'){ close(); return; }
    const z = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
    const y = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y';
    if (!z && !y) return;
    e.preventDefault(); e.stopPropagation();
    (y || e.shiftKey) ? redo() : undo();
  };
  const onResize = ()=> renderPreview();
  backdrop.querySelector('.fig-x').addEventListener('click', close);
  backdrop.addEventListener('click', e=>{ if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  backdrop.querySelector('[data-fig-reset]').addEventListener('click', resetFigure);
  backdrop.querySelector('[data-fig-svg]').addEventListener('click', exportSVG);
  backdrop.querySelector('[data-fig-png]').addEventListener('click', exportPNG);
  const copyBtn = backdrop.querySelector('[data-fig-copy]');
  // Without clipboard images there is nothing the button could do, so PNG export
  // takes its place as the main action rather than leaving a button that fails.
  if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write)
    copyBtn.addEventListener('click', ()=> copyPNG(copyBtn));
  else { copyBtn.remove(); backdrop.querySelector('[data-fig-png]').classList.replace('btn-sm', 'primary'); }

  dimEl = backdrop.querySelector('.fig-dim');
  requestAnimationFrame(renderPreview);
}
