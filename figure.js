import { svgEl, niceTicks, fmtTick } from './plot.js';
import { colorPickerUI, palettePickerUI, fmtNum } from './utils.js';

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
   be left empty. Because panels touch, tick numbers can only live on the outer
   edges of the table — so the ranges are scoped to match what those numbers
   actually describe:
     shareX on  -> one X range for the whole figure
     shareX off -> one X range per COLUMN   (numbers under each column are correct)
     shareY on  -> one Y range for the whole figure
     shareY off -> one Y range per ROW      (numbers left of each row are correct)
========================================================= */

const PX_MM = 96 / 25.4;      // CSS px per mm at the nominal 96 dpi
const PT_PX = 96 / 72;        // CSS px per typographic point
const DASHES = { '': 'solid', '5,4': 'dashed', '2,3': 'dotted', '8,3,2,3': 'dash-dot' };

let F = null;                 // the figure model
let backdrop = null, previewSvg = null, controlsEl = null;

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
      label: labels[out.length] || ('Series ' + (out.length + 1)),
      panel: 0,
      color: e.color || '#3aa0ff',
      width: e.width || 1.5,
      dash: e.dash || '',
      marker: e.type === 'points' ? 'circle' : 'none',
      show: true,
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
    if (!groups.has(color)) groups.set(color, { color, xs: [], ys: [], errs: [], keys: [] });
    const g = groups.get(color);
    g.xs.push(e.type === 'barpx' ? e.xc : (e.x0 + e.x1) / 2);
    g.ys.push(e.type === 'barpx' ? e.y1 : e.y1);
    g.errs.push(0);
    g.keys.push(e.type === 'barpx' ? (e.xc + '@' + (e.dx || 0)) : null);
  }
  if (groups.size){
    const errs = new Map(), texts = new Map();
    for (const e of stored){
      if (e.type === 'errbar') errs.set(e.xc + '@' + (e.dx || 0), e.yerr);
      // The source plot already formatted "value ± error" for each bar; reuse it.
      if (e.type === 'barlabel') texts.set(e.xv + '@' + (e.dx || 0), e.text);
    }
    let gi = 0;
    for (const g of groups.values()){
      const txt = [];
      g.keys.forEach((k, j)=>{
        if (k != null && errs.has(k)) g.errs[j] = errs.get(k);
        txt[j] = (k != null && texts.has(k)) ? texts.get(k) : null;
      });
      out.push({
        id: 'b' + gi,
        kind: 'bar',
        label: labels[out.length] || ('Bars ' + (gi + 1)),
        panel: 0,
        color: g.color,
        width: 0.8,                 // bar width as a fraction of the category slot
        dash: '', marker: 'none',
        show: true,
        xs: g.xs, ys: g.ys, errs: g.errs, texts: txt,
      });
      gi++;
    }
  }
  return { series: out, cats };
}

/* Per-panel axis configuration. Each of the four sides is independent:
     on     — draw the axis line itself
     major  — major tick marks
     minor  — minor tick marks (4 between each pair of majors)
     dir    — 'out' | 'in' | 'both'
     labels — tick numbers
     title  — the figure's X (bottom/top) or Y (left/right) title next to this side
   Defaults follow the usual convention: a full left+bottom pair, bare right+top. */
const SIDES = ['left', 'bottom', 'right', 'top'];
const newSide = full => ({ on:true, major:true, minor:false, dir:'out', labels:full, title:full });
const newAxes = () => ({ left:newSide(true), bottom:newSide(true), right:newSide(false), top:newSide(false) });

function newPanel(r, c){ return { r, c, rs: 1, cs: 1, title: '', axes: newAxes() }; }

function buildModel(plot, opts){
  const strip = s => String(s || '').replace(/<[^>]*>/g, '');
  const { series, cats } = seriesFromPlot(plot, opts && opts.legendEl);
  return {
    wmm: 160, hmm: 110, dpi: 300,
    rows: 1, cols: 1,
    shareX: true, shareY: true,
    legendMode: 'per-panel',            // 'none' | 'per-panel' | 'global'
    font: { tick: 8, axis: 9, legend: 8, title: 9 },   // points
    xlabel: strip(plot.xlabel) || '',
    ylabel: strip(plot.ylabel) || strip(plot.ylabelSvg) || '',
    xAuto: true, xmin: 0, xmax: 1,
    yAuto: true, ymin: 0, ymax: 1,
    xStep: 0, yStep: 0,                 // major tick interval; 0 = pick a nice one
    minorCount: 4,                      // minor ticks between two majors
    grid: { x:false, y:false, minor:false, dash:'2,3' },
    // Value labels drawn on the data. A bar keeps the text the source plot already
    // formatted (value ± error) when it has one; anything else shows its Y value.
    dataLabels: { on:false, dec:2, pos:'above', rot:0, size:7, off:3 },
    // 'per-panel' = a title beside each panel side that asks for one;
    // 'shared' = one for the whole figure. Set independently for X and Y.
    titleModeX: 'per-panel', titleModeY: 'per-panel',
    palScope: 'series',                 // 'series' = one run of colours across all
                                        // series; 'panel' = every panel restarts it
    panels: [ newPanel(0, 0) ],
    series,
    cats,                               // category labels of a bar chart, if any
    name: (opts && opts.name) || 'figure',
  };
}

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

// Panels overlapping a given column / row (span-aware).
const panelsInCol = c => F.panels.map((p,i)=>i).filter(i=>{ const p=F.panels[i]; return c >= p.c && c < p.c + p.cs; });
const panelsInRow = r => F.panels.map((p,i)=>i).filter(i=>{ const p=F.panels[i]; return r >= p.r && r < p.r + p.rs; });

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
function minorTicks(majors, lo, hi){
  const n = Math.max(0, Math.round(F.minorCount));
  if (majors.length < 2 || !n) return [];
  const div = n + 1, step = (majors[1] - majors[0]) / div, out = [];
  for (let v = majors[0] - div * step; v <= majors[majors.length-1] + div * step + step/2; v += step){
    if (v >= lo && v <= hi) out.push(v);
  }
  return out;
}

// Resolve the X/Y range that applies to each panel, honouring the share toggles.
function computeRanges(){
  const all = F.panels.map((_, i)=> i);
  const globalExt = extentOf(all) || { x0:0, x1:1, y0:0, y1:1 };
  const xOf = [], yOf = [];
  for (let c = 0; c < F.cols; c++){
    const e = F.shareX ? globalExt : (extentOf(panelsInCol(c)) || globalExt);
    xOf[c] = F.xAuto ? [e.x0, e.x1] : [F.xmin, F.xmax];
  }
  for (let r = 0; r < F.rows; r++){
    const e = F.shareY ? globalExt : (extentOf(panelsInRow(r)) || globalExt);
    yOf[r] = F.yAuto ? [e.y0, e.y1] : [F.ymin, F.ymax];
  }
  return { xOf, yOf, globalExt };
}

/* ---- Renderer -------------------------------------------------------------- */

// Legend key: a filled box for bars, a stroked line for curves.
function legendMark(add, s, xa, xb, y){
  if (s.kind === 'bar') add('rect', { x:xa, y:y-3, width:xb-xa, height:6, fill:s.color });
  else {
    const e = add('line', { x1:xa, x2:xb, y1:y, y2:y, stroke:s.color, 'stroke-width':s.width });
    if (s.dash) e.setAttribute('stroke-dasharray', s.dash);
  }
}

const measCtx = document.createElement('canvas').getContext('2d');
function textW(txt, px, weight){
  measCtx.font = `${weight||''} ${px}px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
  return measCtx.measureText(String(txt)).width;
}

// Draw the whole figure into `svg` at its real size in px. `ink`/`paper` let the
// export force a light, print-ready palette regardless of the app theme.
// One drawing pass. `extra` widens the computed margins — renderInto() uses it to
// feed back what actually stuck out on the previous pass.
function drawFigure(svg, ink, paper, extra){
  const W = F.wmm * PX_MM, H = F.hmm * PX_MM;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = '';
  const add = (tag, at, parent)=>{ const e = svgEl(tag, at); (parent||svg).appendChild(e); return e; };
  add('rect', { x:0, y:0, width:W, height:H, fill: paper });

  const fTick = F.font.tick * PT_PX, fAxis = F.font.axis * PT_PX;
  const fLeg = F.font.legend * PT_PX, fTitle = F.font.title * PT_PX;
  const { xOf, yOf } = computeRanges();

  // Outer margins: room for the Y numbers + title on the left, X numbers + title
  // below, and (for a global legend) a strip under that.
  let maxYNum = 0;
  for (let r = 0; r < F.rows; r++)
    for (const t of majorTicks(yOf[r][0], yOf[r][1], F.yStep)) maxYNum = Math.max(maxYNum, textW(fmtTick(t), fTick));
  // How far the X labels stick out sideways and downwards. A number is centred on
  // its tick, so the outermost ones overhang the frame by half their width; tilted
  // category names hang below the axis and lean past its left end.
  let halfX = 0, catDrop = 0, catLean = 0;
  for (let c = 0; c < F.cols; c++)
    for (const t of majorTicks(xOf[c][0], xOf[c][1], F.xStep)) halfX = Math.max(halfX, textW(fmtTick(t), fTick) / 2);
  if (F.cats && F.cats.length){
    for (const cat of F.cats){
      const w = textW(cat.text, fTick), rad = (cat.rot || 0) * Math.PI / 180;
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
  const legendH = (F.legendMode === 'global') ? fLeg * 2.1 : 0;
  let mL = Math.max(10 + room('left', true), sideX) + extra.L;
  let mR = Math.max(10 + room('right', true), sideX) + extra.R;
  let mT = 10 + room('top', false) + extra.T;
  let mB = 10 + room('bottom', false) + legendH + extra.B;
  // Margins never eat more than this much of the page. Without the cap, a request
  // that cannot fit (a title longer than the figure) would grow them past the page
  // and push the panels off it; with it, the figure stays sane and the text clips.
  const capW = W * 0.62, capH = H * 0.62;
  if (mL + mR > capW){ const k = capW / (mL + mR); mL *= k; mR *= k; }
  if (mT + mB > capH){ const k = capH / (mT + mB); mT *= k; mB *= k; }

  const innerW = Math.max(20, W - mL - mR), innerH = Math.max(20, H - mT - mB);
  const cw = innerW / F.cols, ch = innerH / F.rows;

  F.panels.forEach((p, pi)=>{
    const px0 = mL + p.c * cw, py0 = mT + p.r * ch;
    const pw = Math.max(4, p.cs * cw), ph = Math.max(4, p.rs * ch);
    const [x0, x1] = xOf[Math.min(p.c, F.cols-1)] || [0,1];
    const [y0, y1] = yOf[Math.min(p.r, F.rows-1)] || [0,1];
    const X = v => px0 + (v - x0) / (x1 - x0 || 1) * pw;
    const Y = v => py0 + ph - (v - y0) / (y1 - y0 || 1) * ph;

    const clipId = 'fclip' + pi;
    const defs = add('defs', {});
    const cp = svgEl('clipPath', { id: clipId });
    cp.appendChild(svgEl('rect', { x:px0, y:py0, width:pw, height:ph }));
    defs.appendChild(cp);

    // Grid, under everything. Built from the same ticks the axes use, so it always
    // lines up with the numbers whatever the tick step is.
    const gx = majorTicks(x0, x1, F.xStep), gy = majorTicks(y0, y1, F.yStep);
    if (F.grid.x || F.grid.y){
      const gg = add('g', { 'clip-path': `url(#${clipId})` });
      const rule = (a, minor)=> add('line', { ...a, stroke:ink, 'stroke-width': minor ? 0.3 : 0.5,
                                              'stroke-dasharray':F.grid.dash, opacity: minor ? 0.28 : 0.45 }, gg);
      if (F.grid.x){
        for (const t of gx) rule({ x1:X(t), x2:X(t), y1:py0, y2:py0+ph });
        if (F.grid.minor) for (const t of minorTicks(gx, x0, x1)) rule({ x1:X(t), x2:X(t), y1:py0, y2:py0+ph }, true);
      }
      if (F.grid.y){
        for (const t of gy) rule({ x1:px0, x2:px0+pw, y1:Y(t), y2:Y(t) });
        if (F.grid.minor) for (const t of minorTicks(gy, y0, y1)) rule({ x1:px0, x2:px0+pw, y1:Y(t), y2:Y(t) }, true);
      }
    }

    // Series
    const g = add('g', { 'clip-path': `url(#${clipId})` });
    const DL = F.dataLabels;
    const wantsLabels = () => DL.on;
    // One value label. `pos` is relative to the mark; the text rotates about its own
    // anchor so a tilted label still starts where it points.
    const valueLabel = (s, j, cx, yMark, yTop, yBot)=>{
      const txt = (s.texts && s.texts[j]) != null ? s.texts[j] : fmtNum(s.ys[j], DL.dec);
      if (txt == null || txt === '') return;
      const size = DL.size * PT_PX, o = DL.off;
      let y = yMark, anchor = 'middle', baseline = 'auto';
      if (DL.pos === 'above'){ y = yTop - o; }
      else if (DL.pos === 'below'){ y = yBot + o + size * 0.8; }
      else if (DL.pos === 'inside'){ y = yTop + o + size * 0.9; }
      else if (DL.pos === 'center'){ y = (yTop + yBot) / 2; baseline = 'central'; }
      const at = { x:cx, y, 'font-size':size, fill:ink, 'text-anchor':anchor };
      if (baseline !== 'auto') at['dominant-baseline'] = baseline;
      if (DL.rot){ at['text-anchor'] = 'start'; at.transform = `rotate(-${DL.rot} ${cx} ${y})`; }
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
                        width:wPx.toFixed(2), height:Math.abs(zero - yy).toFixed(2), fill:s.color }, g);
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
            valueLabel(s, j, cx, yy, Math.min(Y(yv + e), zero), Math.max(Y(yv - e), zero));
          }
        });
        continue;
      }
      if (s.marker !== 'none'){
        for (let i = 0; i < s.xs.length; i++){
          if (!isFinite(s.xs[i]) || !isFinite(s.ys[i])) continue;
          add('circle', { cx:X(s.xs[i]).toFixed(2), cy:Y(s.ys[i]).toFixed(2), r:Math.max(0.8, s.width),
                          fill:'none', stroke:s.color, 'stroke-width':s.width*0.8 }, g);
        }
      }
      if (s.marker === 'none' || s.marker === 'both'){
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
        add('line', { ...e, stroke:ink, 'stroke-width':0.8 });
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
      if (a.minor) minorTicks(majors, ...(g0.vert ? [y0, y1] : [x0, x1])).forEach(t=> mark(proj(t), TICK_MIN));

      // Numbers and title only where there is room outside the panel; a side that
      // touches a neighbour can carry tick marks but nothing that would overlap it.
      if (!free[side]) continue;

      if (a.labels && cats && !g0.vert){
        for (const c of cats){
          const q = X(c.x), rot = c.rot || 0;
          const at = side === 'bottom' ? { x:q, y:g0.base + fTick*1.15 } : { x:q, y:g0.base - fTick*0.5 };
          const el = add('text', { ...at, 'font-size':fTick, fill:ink,
                                   'text-anchor': rot ? 'end' : 'middle' });
          if (rot) el.setAttribute('transform', `rotate(-${rot} ${at.x} ${at.y})`);
          el.textContent = c.text;
        }
        continue;
      }
      if (a.labels){
        for (const t of majors){
          const q = proj(t), txt = fmtTick(t);
          let at;
          if (g0.vert){
            // Drop a number that would spill past an edge shared with a neighbour.
            const hh = fTick * 0.55;
            if ((!free.top && q - hh < py0 + 1) || (!free.bottom && q + hh > py0 + ph - 1)) continue;
            at = side === 'left'
              ? { x:g0.base-5, y:q+fTick*0.36, 'text-anchor':'end' }
              : { x:g0.base+5, y:q+fTick*0.36, 'text-anchor':'start' };
          } else {
            const hw = textW(txt, fTick) / 2;
            if ((!free.left && q - hw < px0 + 1) || (!free.right && q + hw > px0 + pw - 1)) continue;
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
          add('text', { x, y:yc, 'font-size':fAxis, fill:ink, 'text-anchor':'middle',
                        transform:`rotate(${side === 'left' ? -90 : 90} ${x} ${yc})` }).textContent = label;
        } else {
          const y = g0.base + g0.out * (clear + fAxis * (side === 'bottom' ? 1.0 : 0.4));
          add('text', { x:px0+pw/2, y, 'font-size':fAxis, fill:ink, 'text-anchor':'middle' }).textContent = label;
        }
      }
    }

    // Panel title (top-left, inside)
    if (p.title){
      const el = add('text', { x:px0+6, y:py0+fTitle*1.25, 'font-size':fTitle, fill:ink, 'font-weight':'600' });
      el.textContent = p.title;
    }

    // Per-panel legend, top-right inside
    if (F.legendMode === 'per-panel'){
      const mine = F.series.filter(s=> s.show && s.panel === pi);
      mine.forEach((s, k)=>{
        const ly = py0 + fLeg * (1.3 + k * 1.35) + (p.title ? fTitle*1.2 : 0);
        const lx = px0 + pw - 6;
        const tw = textW(s.label, fLeg);
        legendMark(add, s, lx-tw-16, lx-tw-4, ly-fLeg*0.32);
        const el = add('text', { x:lx, y:ly, 'font-size':fLeg, fill:ink, 'text-anchor':'end' });
        el.textContent = s.label;
      });
    }
  });

  // Shared titles: one per side for the whole grid, centred on the inner area and
  // sitting in the outer margin. A side gets one when any panel asked for it.
  {
    const want = side => F.panels.some(p=> (p.axes || (p.axes = newAxes()))[side].title);
    const shX = F.titleModeX === 'shared', shY = F.titleModeY === 'shared';
    const cx = mL + innerW / 2, cy = mT + innerH / 2;
    if (shX && F.xlabel && want('bottom'))
      add('text', { x:cx, y:H - legendH - 4, 'font-size':fAxis, fill:ink, 'text-anchor':'middle' }).textContent = F.xlabel;
    if (shX && F.xlabel && want('top'))
      add('text', { x:cx, y:fAxis, 'font-size':fAxis, fill:ink, 'text-anchor':'middle' }).textContent = F.xlabel;
    if (shY && F.ylabel && want('left'))
      add('text', { x:fAxis*1.1, y:cy, 'font-size':fAxis, fill:ink, 'text-anchor':'middle',
                    transform:`rotate(-90 ${fAxis*1.1} ${cy})` }).textContent = F.ylabel;
    if (shY && F.ylabel && want('right'))
      add('text', { x:W - fAxis*1.1, y:cy, 'font-size':fAxis, fill:ink, 'text-anchor':'middle',
                    transform:`rotate(90 ${W - fAxis*1.1} ${cy})` }).textContent = F.ylabel;
  }

  // Global legend: one centred row under everything
  if (F.legendMode === 'global'){
    const items = F.series.filter(s=>s.show);
    const gap = 14, lw = 16;
    let total = 0;
    items.forEach(s=> total += lw + 4 + textW(s.label, fLeg) + gap);
    let x = mL + Math.max(0, (innerW - (total - gap)) / 2);
    const y = H - fLeg * 0.6;
    items.forEach(s=>{
      legendMark(add, s, x, x+lw, y-fLeg*0.32);
      const el = add('text', { x:x+lw+4, y, 'font-size':fLeg, fill:ink });
      el.textContent = s.label;
      x += lw + 4 + textW(s.label, fLeg) + gap;
    });
  }
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

function renderPreview(){
  renderInto(previewSvg, '#1a2327', '#ffffff');
  // Fit the real-size figure inside the preview pane without distorting it.
  const host = previewSvg.parentElement;
  const availW = host.clientWidth - 24, availH = host.clientHeight - 24;
  const W = F.wmm * PX_MM, H = F.hmm * PX_MM;
  const k = Math.min(availW / W, availH / H, 1);
  previewSvg.style.width = (W * k) + 'px';
  previewSvg.style.height = (H * k) + 'px';
}

/* ---- Export ---------------------------------------------------------------- */

function figureSvgString(){
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tmp.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  renderInto(tmp, '#000000', '#ffffff');
  // Physical size so the file lands at the right scale in Word/Illustrator/LaTeX.
  tmp.setAttribute('width', F.wmm + 'mm');
  tmp.setAttribute('height', F.hmm + 'mm');
  return new XMLSerializer().serializeToString(tmp);
}

function exportSVG(){
  saveBlob(F.name + '.svg', figureSvgString(), 'image/svg+xml');
}

function exportPNG(){
  const str = figureSvgString();
  const W = F.wmm * PX_MM, H = F.hmm * PX_MM;
  const scale = F.dpi / 96;                       // px at the requested dpi
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = ()=>{
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(b=>{ if (b) saveBlob(F.name + '.png', b); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
}

/* ---- Controls -------------------------------------------------------------- */

const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num = (label, key, min, max, step)=>
  `<label class="fig-row"><span>${label}</span><input type="number" data-k="${key}" value="${F[key]}" min="${min}" max="${max}" step="${step||1}"></label>`;

// Panel whose axes the "Panel axes" section edits. The sentinel 'all' edits every
// panel at once; the fields then show panel 1's settings as the starting point.
let axSel = 0;
const axTargets = () => axSel === 'all' ? F.panels.map((_, i)=> i) : [axSel];
const axShown = () => ((F.panels[axSel === 'all' ? 0 : axSel] || {}).axes) || newAxes();

function panelOptions(sel){
  return F.panels.map((p,i)=>`<option value="${i}"${i===sel?' selected':''}>P${i+1} (r${p.r+1},c${p.c+1})</option>`).join('');
}

const GRIP = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="2.5" y1="5" x2="13.5" y2="5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11" x2="13.5" y2="11"/></svg>`;

const chk = (label, key, obj)=>
  `<label class="fig-check"><input type="checkbox" data-${obj||'k'}="${key}"${(obj==='g'?F.grid[key]:obj==='dl'?F.dataLabels[key]:F[key])?' checked':''}> ${label}</label>`;
const sel = (label, key, opts, cur, attr)=>
  `<label class="fig-row"><span>${label}</span><select data-${attr||'k'}="${key}">${
    opts.map(([v,t])=>`<option value="${v}"${String(cur)===String(v)?' selected':''}>${t}</option>`).join('')}</select></label>`;

function controlsHtml(){
  const DL = F.dataLabels;
  return `
  <section class="fig-sec"><h4>Figure</h4>
    ${num('Width (mm)','wmm',20,400)}${num('Height (mm)','hmm',20,400)}${num('Export DPI','dpi',72,1200,1)}
    <label class="fig-row"><span>File name</span><input type="text" data-k="name" value="${esc(F.name)}"></label>
  </section>

  <section class="fig-sec"><h4>Layout</h4>
    ${num('Rows','rows',1,8)}${num('Columns','cols',1,8)}
    <div class="fig-panels">
      ${F.panels.map((p,i)=>`
        <div class="fig-panel" data-p="${i}">
          <b>P${i+1}</b>
          <label>row<input type="number" data-pk="r" data-p="${i}" value="${p.r+1}" min="1" max="${F.rows}"></label>
          <label>col<input type="number" data-pk="c" data-p="${i}" value="${p.c+1}" min="1" max="${F.cols}"></label>
          <label>&#8597;<input type="number" data-pk="rs" data-p="${i}" value="${p.rs}" min="1" max="${F.rows}"></label>
          <label>&#8596;<input type="number" data-pk="cs" data-p="${i}" value="${p.cs}" min="1" max="${F.cols}"></label>
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
      <button class="palette-pick-btn fig-pal" type="button" title="Apply color palette"></button>
      <select data-k="palScope" title="How a palette is spread">
        <option value="series"${F.palScope==='series'?' selected':''}>palette by series</option>
        <option value="panel"${F.palScope==='panel'?' selected':''}>palette by panel</option>
      </select>
    </div>
    <div class="fig-series">
      ${F.series.map((s,i)=>`
        <div class="fig-serie" data-s="${i}">
          <span class="fig-grip" title="Drag to reorder">${GRIP}</span>
          <input type="checkbox" data-sk="show" data-s="${i}"${s.show?' checked':''} title="Show">
          <button class="color-swatch" data-sw="${i}" data-color="${s.color}" style="background:${s.color}" title="Pick color"></button>
          <input type="text" data-sk="label" data-s="${i}" value="${esc(s.label)}" class="fig-slabel">
          <select data-sk="panel" data-s="${i}" title="Panel">${panelOptions(s.panel)}</select>
          ${s.kind === 'bar'
            ? `<input type="number" data-sk="width" data-s="${i}" value="${s.width}" min="0.1" max="1" step="0.05" title="Bar width (fraction of the category slot)">
               <span class="fig-kind">bars</span>`
            : `<input type="number" data-sk="width" data-s="${i}" value="${s.width}" min="0.2" max="6" step="0.1" title="Line width">
               <select data-sk="dash" data-s="${i}" title="Line style">
                 ${Object.entries(DASHES).map(([v,n])=>`<option value="${v}"${s.dash===v?' selected':''}>${n}</option>`).join('')}
               </select>
               <select data-sk="marker" data-s="${i}" title="Markers">
                 ${['none','circle','both'].map(m=>`<option value="${m}"${s.marker===m?' selected':''}>${m}</option>`).join('')}
               </select>`}
        </div>`).join('') || '<p class="txt-meta">This plot has no series to compose.</p>'}
    </div>
  </section>

  <section class="fig-sec"><h4>Axes &amp; scale</h4>
    <label class="fig-row"><span>X title</span><input type="text" data-k="xlabel" value="${esc(F.xlabel)}"></label>
    <label class="fig-row"><span>Y title</span><input type="text" data-k="ylabel" value="${esc(F.ylabel)}"></label>
    ${sel('X title placing','titleModeX',[['per-panel','one per panel'],['shared','shared by all panels']],F.titleModeX)}
    ${sel('Y title placing','titleModeY',[['per-panel','one per panel'],['shared','shared by all panels']],F.titleModeY)}
    <div class="fig-subhead">Range</div>
    ${chk('Share X across panels (off: one range per column)','shareX')}
    ${chk('Share Y across panels (off: one range per row)','shareY')}
    ${chk('X auto range','xAuto')}
    ${F.xAuto?'':`${num('X min','xmin',-1e9,1e9,'any')}${num('X max','xmax',-1e9,1e9,'any')}`}
    ${chk('Y auto range','yAuto')}
    ${F.yAuto?'':`${num('Y min','ymin',-1e9,1e9,'any')}${num('Y max','ymax',-1e9,1e9,'any')}`}
    <div class="fig-subhead">Ticks</div>
    ${num('X major step','xStep',0,1e9,'any')}${num('Y major step','yStep',0,1e9,'any')}
    ${num('Minors per major','minorCount',0,20,1)}
    <p class="txt-meta">A major step of 0 picks a round interval automatically.</p>
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
    <div class="fig-axhead"><span></span><span>axis</span><span>major</span><span>minor</span><span>numbers</span><span>title</span><span>ticks</span></div>
    ${SIDES.map(side=>{
      const a = axShown()[side];
      const cb = (k)=>`<input type="checkbox" data-ak="${k}" data-side="${side}"${a[k]?' checked':''}>`;
      return `<div class="fig-axrow"><b>${side}</b>
        ${cb('on')}${cb('major')}${cb('minor')}${cb('labels')}${cb('title')}
        <select data-ak="dir" data-side="${side}">
          ${['out','in','both'].map(d=>`<option value="${d}"${a.dir===d?' selected':''}>${d}</option>`).join('')}
        </select></div>`;
    }).join('')}
    <p class="txt-meta">Numbers and titles are drawn only where a panel edge has free space beside it — a side facing a neighbouring panel keeps its tick marks only.</p>
  </section>

  <section class="fig-sec"><h4>Data labels</h4>
    ${chk('Show a value on every data point','on','dl')}
    ${!DL.on ? '' : `
      ${sel('Position','pos',[['above','above the mark'],['inside','inside, at the top'],['center','centred'],['below','below the mark']],DL.pos,'dl')}
      <label class="fig-row"><span>Rotation (&deg;)</span><input type="number" data-dl="rot" value="${DL.rot}" min="0" max="90" step="5"></label>
      <label class="fig-row"><span>Distance (px)</span><input type="number" data-dl="off" value="${DL.off}" min="0" max="40" step="1"></label>
      <label class="fig-row"><span>Decimals</span><input type="number" data-dl="dec" value="${DL.dec}" min="0" max="6" step="1"></label>
      <label class="fig-row"><span>Size (pt)</span><input type="number" data-dl="size" value="${DL.size}" min="3" max="24" step="0.5"></label>
      <p class="txt-meta">Bars keep the text the source plot formatted (value &plusmn; error); everything else shows its Y value.</p>`}
  </section>

  <section class="fig-sec"><h4>Legend &amp; type</h4>
    ${sel('Legend','legendMode',[['none','none'],['per-panel','one per panel'],['global','one for the figure']],F.legendMode)}
    <div class="fig-subhead">Font sizes (pt)</div>
    <label class="fig-row"><span>Tick numbers</span><input type="number" data-f="tick" value="${F.font.tick}" min="4" max="24" step="0.5"></label>
    <label class="fig-row"><span>Axis titles</span><input type="number" data-f="axis" value="${F.font.axis}" min="4" max="24" step="0.5"></label>
    <label class="fig-row"><span>Legend</span><input type="number" data-f="legend" value="${F.font.legend}" min="4" max="24" step="0.5"></label>
    <label class="fig-row"><span>Panel titles</span><input type="number" data-f="title" value="${F.font.title}" min="4" max="24" step="0.5"></label>
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

// Spread a palette over the series. 'series' scope walks every series once, so no
// two share a colour; 'panel' scope restarts the palette inside each panel, so the
// same colours repeat panel by panel — useful when panels compare like with like.
function applyPalette(colors){
  if (!colors || !colors.length) return;
  if (F.palScope === 'panel'){
    const seen = new Map();
    F.series.forEach(s=>{
      const k = seen.get(s.panel) || 0;
      s.color = colors[k % colors.length];
      seen.set(s.panel, k + 1);
    });
  } else {
    F.series.forEach((s, i)=>{ s.color = colors[i % colors.length]; });
  }
  refresh(true);
}

function refresh(rebuild){
  clampPanels();
  if (rebuild){ controlsEl.innerHTML = controlsHtml(); wireSeriesDrag(); }
  renderPreview();
}

// Drag-to-reorder over the series rows, same grip-and-drop feel as the file list:
// press the handle, move over the row you want the series to land on, release.
function wireSeriesDrag(){
  const rows = [...controlsEl.querySelectorAll('.fig-serie')];
  const rowAt = y => rows.find(r=>{ const b = r.getBoundingClientRect(); return y >= b.top && y <= b.bottom; }) || null;
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
      const t = rowAt(e.clientY);
      rows.forEach(r=> r.classList.toggle('drag-over', r === t && +r.dataset.s !== from));
    });
    const finish = e=>{
      if (from == null) return;
      const t = rowAt(e.clientY), to = t ? +t.dataset.s : null;
      const f = from; from = null;
      rows.forEach(r=> r.classList.remove('drag-over', 'dragging'));
      if (to == null || to === f) return;
      const [moved] = F.series.splice(f, 1);
      F.series.splice(to, 0, moved);
      refresh(true);
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', ()=>{
      from = null; rows.forEach(r=> r.classList.remove('drag-over','dragging'));
    });
  });
}

function wireControls(){
  const numKeys = new Set(['wmm','hmm','dpi','rows','cols','xmin','xmax','ymin','ymax','xStep','yStep','minorCount']);
  const dlNum = new Set(['rot','off','dec','size']);
  controlsEl.addEventListener('input', e=>{
    const t = e.target;
    let rebuild = false;
    if (t.dataset.k){
      const k = t.dataset.k;
      if (k === 'axSel'){ axSel = t.value === 'all' ? 'all' : +t.value; refresh(true); return; }
      F[k] = t.type === 'checkbox' ? t.checked : (numKeys.has(k) ? parseFloat(t.value) : t.value);
      if (k === 'rows' || k === 'cols'){ F[k] = Math.max(1, Math.round(F[k] || 1)); rebuild = true; }
      if (k === 'xAuto' || k === 'yAuto') rebuild = true;
    } else if (t.dataset.ak){
      const v = t.type === 'checkbox' ? t.checked : t.value;
      for (const pi of axTargets()){
        const p = F.panels[pi]; if (!p) continue;
        (p.axes || (p.axes = newAxes()))[t.dataset.side][t.dataset.ak] = v;
      }
    } else if (t.dataset.g){
      F.grid[t.dataset.g] = t.type === 'checkbox' ? t.checked : t.value;
    } else if (t.dataset.dl){
      const k = t.dataset.dl;
      F.dataLabels[k] = t.type === 'checkbox' ? t.checked
                      : dlNum.has(k) ? (parseFloat(t.value) || 0) : t.value;
      if (k === 'on') rebuild = true;         // the rest of the section appears/hides
    } else if (t.dataset.f){
      F.font[t.dataset.f] = parseFloat(t.value) || 8;
    } else if (t.dataset.pk){
      const i = +t.dataset.p, p = F.panels[i]; if (!p) return;
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
    } else if (t.dataset.sk){
      const s = F.series[+t.dataset.s]; if (!s) return;
      const k = t.dataset.sk;
      if (k === 'show') s.show = t.checked;
      else if (k === 'panel') s.panel = +t.value;
      else if (k === 'width') s.width = parseFloat(t.value) || 1;
      else s[k] = t.value;
    } else return;
    refresh(rebuild);
  });
  controlsEl.addEventListener('change', e=>{ if (e.target.tagName === 'SELECT') refresh(false); });
  controlsEl.addEventListener('click', e=>{
    const sw = e.target.closest('.color-swatch');
    if (sw){
      const s = F.series[+sw.dataset.sw]; if (!s) return;
      colorPickerUI.open(sw, s.color, color=>{
        s.color = color; sw.dataset.color = color; sw.style.background = color;
        refresh(false);
      });
      return;
    }
    if (e.target.closest('.fig-pal')){
      palettePickerUI.open(e.target.closest('.fig-pal'), colors=> applyPalette(colors));
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
      refresh(true);
    } else if (delB){
      const i = +delB.dataset.delPanel;
      if (F.panels.length <= 1) return;
      F.panels.splice(i, 1);
      F.series.forEach(s=>{ if (s.panel === i) s.panel = 0; else if (s.panel > i) s.panel--; });
      refresh(true);
    }
  });
}

/* ---- Modal ----------------------------------------------------------------- */

export function openFigureEditor(plot, opts){
  if (!plot) return;
  F = buildModel(plot, opts || {});
  axSel = 0;
  if (!F.series.length){ /* still open — the user may only want axes/labels */ }

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fig-backdrop';
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
        <button class="btn" type="button" data-fig-svg>Export SVG</button>
        <button class="btn primary" type="button" data-fig-png>Export PNG</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  previewSvg = backdrop.querySelector('.fig-svg');
  controlsEl = backdrop.querySelector('.fig-controls');
  controlsEl.innerHTML = controlsHtml();
  wireControls();
  wireSeriesDrag();

  const close = ()=>{
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    backdrop.remove(); backdrop = null; F = null;
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const onResize = ()=> renderPreview();
  backdrop.querySelector('.fig-x').addEventListener('click', close);
  backdrop.addEventListener('click', e=>{ if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  backdrop.querySelector('[data-fig-svg]').addEventListener('click', exportSVG);
  backdrop.querySelector('[data-fig-png]').addEventListener('click', exportPNG);

  requestAnimationFrame(()=>{
    renderPreview();
    const dim = backdrop.querySelector('.fig-dim');
    const upd = ()=>{ dim.textContent = `${F.wmm}×${F.hmm} mm · ${Math.round(F.wmm/25.4*F.dpi)}×${Math.round(F.hmm/25.4*F.dpi)} px @ ${F.dpi} dpi`; };
    upd();
    controlsEl.addEventListener('input', upd);
  });
}
