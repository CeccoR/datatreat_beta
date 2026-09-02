import { svgEl, niceTicks, fmtTick } from './plot.js';

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

function seriesFromPlot(plot, legendEl){
  const labels = legendEl ? [...legendEl.querySelectorAll('span')].map(s=>s.textContent.trim()) : [];
  const out = [];
  (plot._stored || []).forEach((e, i)=>{
    if (e.type !== 'line' && e.type !== 'points') return;
    if (!e.xs || !e.ys || !e.xs.length) return;
    out.push({
      id: 's' + i,
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
  return out;
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
    panels: [ newPanel(0, 0) ],
    series: seriesFromPlot(plot, opts && opts.legendEl),
    name: (opts && opts.name) || 'figure',
  };
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
      any = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!any) return null;
  if (x1 === x0){ x0 -= 0.5; x1 += 0.5; }
  if (y1 === y0){ y0 -= 0.5; y1 += 0.5; }
  const pad = (y1 - y0) * 0.05;
  return { x0, x1, y0: y0 - pad, y1: y1 + pad };
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

// 4 minor ticks between each pair of majors, extended one interval past both ends.
function minorTicks(majors, lo, hi){
  if (majors.length < 2) return [];
  const step = (majors[1] - majors[0]) / 5, out = [];
  for (let v = majors[0] - 5 * step; v <= majors[majors.length-1] + 5 * step + step/2; v += step){
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

const measCtx = document.createElement('canvas').getContext('2d');
function textW(txt, px, weight){
  measCtx.font = `${weight||''} ${px}px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
  return measCtx.measureText(String(txt)).width;
}

// Draw the whole figure into `svg` at its real size in px. `ink`/`paper` let the
// export force a light, print-ready palette regardless of the app theme.
function renderInto(svg, ink, paper){
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
    for (const t of niceTicks(yOf[r][0], yOf[r][1], 4)) maxYNum = Math.max(maxYNum, textW(fmtTick(t), fTick));
  // Only reserve room on a side that some panel actually decorates.
  const anySide = (side, what) => F.panels.some(p => (p.axes || (p.axes = newAxes()))[side][what]);
  const room = (side, vert) =>
    (anySide(side, 'labels') ? (vert ? maxYNum + 8 : fTick * 1.7) : 0) +
    (anySide(side, 'title') && (vert ? F.ylabel : F.xlabel) ? fAxis * 1.35 : 0);
  const mL = 6 + room('left', true);
  const mR = 8 + room('right', true);
  const mT = 8 + room('top', false);
  const legendH = (F.legendMode === 'global') ? fLeg * 2.1 : 0;
  const mB = 6 + room('bottom', false) + legendH;

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

    // Series
    const g = add('g', { 'clip-path': `url(#${clipId})` });
    for (const s of F.series){
      if (!s.show || s.panel !== pi) continue;
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
    }

    // ---- Axes: four independent sides ------------------------------------
    const A = p.axes || (p.axes = newAxes());
    const free = sideFree(pi);
    const xMaj = niceTicks(x0, x1, 4).filter(t=> t >= x0 && t <= x1);
    const yMaj = niceTicks(y0, y1, 4).filter(t=> t >= y0 && t <= y1);
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

      // Axis title, pushed clear of the numbers when they are present.
      const label = g0.vert ? F.ylabel : F.xlabel;
      if (a.title && label){
        const clear = a.labels ? (g0.vert ? maxYNum + 8 : fTick * 1.7) : 6;
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
        add('line', { x1:lx-tw-16, x2:lx-tw-4, y1:ly-fLeg*0.32, y2:ly-fLeg*0.32, stroke:s.color, 'stroke-width':s.width });
        const el = add('text', { x:lx, y:ly, 'font-size':fLeg, fill:ink, 'text-anchor':'end' });
        el.textContent = s.label;
      });
    }
  });

  // Axis titles are drawn per panel side (see the axes loop above), so nothing
  // figure-level is left here.

  // Global legend: one centred row under everything
  if (F.legendMode === 'global'){
    const items = F.series.filter(s=>s.show);
    const gap = 14, lw = 16;
    let total = 0;
    items.forEach(s=> total += lw + 4 + textW(s.label, fLeg) + gap);
    let x = mL + Math.max(0, (innerW - (total - gap)) / 2);
    const y = H - fLeg * 0.6;
    items.forEach(s=>{
      add('line', { x1:x, x2:x+lw, y1:y-fLeg*0.32, y2:y-fLeg*0.32, stroke:s.color, 'stroke-width':s.width });
      const el = add('text', { x:x+lw+4, y, 'font-size':fLeg, fill:ink });
      el.textContent = s.label;
      x += lw + 4 + textW(s.label, fLeg) + gap;
    });
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

let axSel = 0;                // panel whose axes the "Panel axes" section edits

function panelOptions(sel){
  return F.panels.map((p,i)=>`<option value="${i}"${i===sel?' selected':''}>P${i+1} (r${p.r+1},c${p.c+1})</option>`).join('');
}

function controlsHtml(){
  return `
  <section class="fig-sec"><h4>Figure</h4>
    ${num('Width (mm)','wmm',20,400)}${num('Height (mm)','hmm',20,400)}${num('Export DPI','dpi',72,1200,1)}
    <label class="fig-row"><span>Name</span><input type="text" data-k="name" value="${esc(F.name)}"></label>
  </section>

  <section class="fig-sec"><h4>Grid</h4>
    ${num('Rows','rows',1,8)}${num('Columns','cols',1,8)}
    <div class="fig-panels">
      ${F.panels.map((p,i)=>`
        <div class="fig-panel" data-p="${i}">
          <b>P${i+1}</b>
          <label>row<input type="number" data-pk="r" data-p="${i}" value="${p.r+1}" min="1" max="${F.rows}"></label>
          <label>col<input type="number" data-pk="c" data-p="${i}" value="${p.c+1}" min="1" max="${F.cols}"></label>
          <label>↕<input type="number" data-pk="rs" data-p="${i}" value="${p.rs}" min="1" max="${F.rows}"></label>
          <label>↔<input type="number" data-pk="cs" data-p="${i}" value="${p.cs}" min="1" max="${F.cols}"></label>
          <input type="text" class="fig-ptitle" data-pk="title" data-p="${i}" value="${esc(p.title)}" placeholder="title">
          <button class="btn is-danger btn-sm" data-del-panel="${i}" title="Remove panel">✕</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-sm" data-add-panel type="button">+ Add panel</button>
  </section>

  <section class="fig-sec"><h4>Series</h4>
    ${F.series.map((s,i)=>`
      <div class="fig-serie" data-s="${i}">
        <input type="checkbox" data-sk="show" data-s="${i}"${s.show?' checked':''} title="Show">
        <input type="color" data-sk="color" data-s="${i}" value="${s.color}">
        <input type="text" data-sk="label" data-s="${i}" value="${esc(s.label)}" class="fig-slabel">
        <select data-sk="panel" data-s="${i}" title="Panel">${panelOptions(s.panel)}</select>
        <input type="number" data-sk="width" data-s="${i}" value="${s.width}" min="0.2" max="6" step="0.1" title="Line width">
        <select data-sk="dash" data-s="${i}" title="Line style">
          ${Object.entries(DASHES).map(([v,n])=>`<option value="${v}"${s.dash===v?' selected':''}>${n}</option>`).join('')}
        </select>
        <select data-sk="marker" data-s="${i}" title="Markers">
          ${['none','circle','both'].map(m=>`<option value="${m}"${s.marker===m?' selected':''}>${m}</option>`).join('')}
        </select>
      </div>`).join('') || '<p class="txt-meta">This plot has no line series.</p>'}
  </section>

  <section class="fig-sec"><h4>Axes</h4>
    <label class="fig-row"><span>X title</span><input type="text" data-k="xlabel" value="${esc(F.xlabel)}"></label>
    <label class="fig-row"><span>Y title</span><input type="text" data-k="ylabel" value="${esc(F.ylabel)}"></label>
    <label class="fig-check"><input type="checkbox" data-k="shareX"${F.shareX?' checked':''}> Share X (off = one range per column)</label>
    <label class="fig-check"><input type="checkbox" data-k="shareY"${F.shareY?' checked':''}> Share Y (off = one range per row)</label>
    <label class="fig-check"><input type="checkbox" data-k="xAuto"${F.xAuto?' checked':''}> X auto range</label>
    ${F.xAuto?'':`${num('X min','xmin',-1e9,1e9,'any')}${num('X max','xmax',-1e9,1e9,'any')}`}
    <label class="fig-check"><input type="checkbox" data-k="yAuto"${F.yAuto?' checked':''}> Y auto range</label>
    ${F.yAuto?'':`${num('Y min','ymin',-1e9,1e9,'any')}${num('Y max','ymax',-1e9,1e9,'any')}`}
  </section>

  <section class="fig-sec"><h4>Panel axes</h4>
    <label class="fig-row"><span>Panel</span>
      <select data-k="axSel">${panelOptions(axSel)}</select></label>
    <div class="fig-axhead"><span></span><span>axis</span><span>major</span><span>minor</span><span>numbers</span><span>title</span><span>ticks</span></div>
    ${SIDES.map(side=>{
      const a = (((F.panels[axSel] || {}).axes) || newAxes())[side];
      const cb = (k)=>`<input type="checkbox" data-ak="${k}" data-side="${side}"${a[k]?' checked':''}>`;
      return `<div class="fig-axrow"><b>${side}</b>
        ${cb('on')}${cb('major')}${cb('minor')}${cb('labels')}${cb('title')}
        <select data-ak="dir" data-side="${side}">
          ${['out','in','both'].map(d=>`<option value="${d}"${a.dir===d?' selected':''}>${d}</option>`).join('')}
        </select></div>`;
    }).join('')}
    <p class="txt-meta">Numbers and titles are drawn only where a panel edge has free space beside it — a side facing a neighbouring panel keeps its tick marks only.</p>
  </section>

  <section class="fig-sec"><h4>Legend &amp; type</h4>
    <label class="fig-row"><span>Legend</span>
      <select data-k="legendMode">
        ${['none','per-panel','global'].map(m=>`<option value="${m}"${F.legendMode===m?' selected':''}>${m}</option>`).join('')}
      </select></label>
    <label class="fig-row"><span>Ticks (pt)</span><input type="number" data-f="tick" value="${F.font.tick}" min="4" max="24" step="0.5"></label>
    <label class="fig-row"><span>Axis titles (pt)</span><input type="number" data-f="axis" value="${F.font.axis}" min="4" max="24" step="0.5"></label>
    <label class="fig-row"><span>Legend (pt)</span><input type="number" data-f="legend" value="${F.font.legend}" min="4" max="24" step="0.5"></label>
    <label class="fig-row"><span>Panel titles (pt)</span><input type="number" data-f="title" value="${F.font.title}" min="4" max="24" step="0.5"></label>
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
  if (axSel >= F.panels.length) axSel = 0;
  F.series.forEach(s=>{ if (s.panel >= F.panels.length) s.panel = 0; });
}

function refresh(rebuild){
  clampPanels();
  if (rebuild) controlsEl.innerHTML = controlsHtml();
  renderPreview();
}

function wireControls(){
  const numKeys = new Set(['wmm','hmm','dpi','rows','cols','xmin','xmax','ymin','ymax']);
  controlsEl.addEventListener('input', e=>{
    const t = e.target;
    let rebuild = false;
    if (t.dataset.k){
      const k = t.dataset.k;
      if (k === 'axSel'){ axSel = +t.value; refresh(true); return; }
      F[k] = t.type === 'checkbox' ? t.checked : (numKeys.has(k) ? parseFloat(t.value) : t.value);
      if (k === 'rows' || k === 'cols'){ F[k] = Math.max(1, Math.round(F[k] || 1)); rebuild = true; }
      if (k === 'xAuto' || k === 'yAuto') rebuild = true;
    } else if (t.dataset.ak){
      const p = F.panels[axSel]; if (!p) return;
      const a = (p.axes || (p.axes = newAxes()))[t.dataset.side]; if (!a) return;
      a[t.dataset.ak] = t.type === 'checkbox' ? t.checked : t.value;
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
