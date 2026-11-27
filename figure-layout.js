/* =========================================================
   FIGURE COMPOSER — what the plots' figure draws, and where (v555).
   drawFigure (figure.js) holds the svg and paints it; this works out, as plain functions
   of their inputs, what it paints: the ranges (each panel's data, its sharing group, a
   manual range), the ticks (linear, the decades of a log axis and its 1-2-5, the minors,
   a tick's words), the sides with room for numbers, the margins and the plot area (the
   numbers and titles measured, the global legend's strip, the cap, a plot area set by
   hand and placed), the tilt of the X names, each panel's frame and scale, the grid, the
   bars and boxes and their error bars, a curve's path and symbols, the value labels and
   their ink, the tick marks, the numbers kept clear of a neighbour's, the category names,
   the axis titles, the legends (a panel's in its corner, the figure's strip in columns),
   the shared titles, the texture tiles and the colours. No DOM: the page and Node import
   it (tests/figlayout.test.mjs). Taken out of v554's drawFigure with its operations in
   their order: the same numbers to the last bit.

   What the page knows and Node cannot load is handed in, with the figure model, as one
   context C = { F, textW, niceTicks, fmtTick, tiltFits }: F the model (figure.js
   buildModel), textW(text, px) a text's width in the figure's font (a canvas measures
   it), plot.js's niceTicks and fmtTick, utils.js's tiltFits.
========================================================= */

export const PX_MM = 96 / 25.4;      // CSS px per mm at the nominal 96 dpi
export const PT_PX = 96 / 72;        // CSS px per typographic point

/* ---- Point symbols, colours, rich text -------------------------------------- */

// One point symbol centred on (cx, cy), sized so every shape reads at the same
// weight. Returns the tag and attributes for the caller to add().
export function markerShape(kind, cx, cy, r, color, width){
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

export function rgbOf(c){
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (m){
    const h = m[1].length === 3 ? m[1].replace(/./g, ch=> ch + ch) : m[1];
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(String(c || ''));
  if (rgb){ const p = rgb[1].split(',').map(Number); return [p[0]||0, p[1]||0, p[2]||0]; }
  return [136, 136, 136];
}
/* The pale companion of a colour: the same hue mixed towards white, which is what a
   texture is drawn on — or in, the other way round. Being a colour rather than a thin
   veil, it holds up over a grid line or a neighbouring bar. */
export function lightShade(color){
  const k = 0.68;
  const [r, g, b] = rgbOf(color);
  const mix = v => Math.round(v + (255 - v) * k);
  return '#' + [mix(r), mix(g), mix(b)].map(v=> v.toString(16).padStart(2, '0')).join('');
}

/* Black or white, whichever a reader can see against `bg` — the usual relative
   luminance, with the threshold where the two contrast ratios cross. The SEM figure's
   outline takes it too. */
export function contrastInk(bg){
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

/* The tile a textured bar is filled with (figure.js barFill makes it a pattern): its
   ground and its marks, both in the one colour, [tag, attributes] each. Two ways round:
   the marks in the colour over its pale shade, or its pale shade over the colour. Which
   reads better depends on the colour, so it is a choice rather than a rule. */
export const TILE = 6;                       // pattern tile, in figure px
export function textureTile(texture, color, inv){
  const P = TILE, out = [];
  const put = (tag, at)=> out.push([tag, at]);
  // The tile is painted on the bar's own colour, so the texture reads as that colour
  // lightened rather than as a second hue laid over white.
  const pale = lightShade(color);
  const ground = inv ? color : pale;
  const markCol = inv ? pale : color;
  put('rect', { x:0, y:0, width:P, height:P, fill:ground });
  const line = (x1,y1,x2,y2)=> put('line', { x1, y1, x2, y2, stroke:markCol, 'stroke-width':1.4, 'stroke-linecap':'square' });
  if (texture === 'dots') put('circle', { cx:P/2, cy:P/2, r:1.5, fill:markCol });
  if (texture === 'fwd'  || texture === 'cross'){ line(-1,P+1,P+1,-1); line(P-1,P+1,P+1,P-1); line(-1,1,1,-1); }
  if (texture === 'back' || texture === 'cross'){ line(-1,-1,P+1,P+1); line(-1,P-1,1,P+1); line(P-1,-1,P+1,1); }
  if (texture === 'horiz' || texture === 'grid') line(0,P/2,P,P/2);
  if (texture === 'vert'  || texture === 'grid') line(P/2,0,P/2,P);
  return out;
}

/* Titles are held as plain text with two markers: ^{...} raises, _{...} lowers
   (figure.js richText draws them). */
export const RICH_RE = /([\^_])\{([^}]*)\}/g;
export const RICH_SCALE = 0.72;   // size of a raised/lowered run, relative to the body
// The pieces of a rich string, in order: {t: text, r: 'super'|'sub'|null}.
export function richParts(str){
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

/* ---- Panels, sides, divisions, legend entries ------------------------------- */

/* Per-panel axis configuration. Each of the four sides is independent:
     on     — draw the axis line itself
     major  — major tick marks
     minor  — minor tick marks (count set per axis, see minorX / minorY)
     dir    — 'out' | 'in' | 'both'
     labels — tick numbers
     title  — the figure's X (bottom/top) or Y (left/right) title next to this side
   Defaults follow the usual convention: a full left+bottom pair, bare right+top. */
export const SIDES = ['left', 'bottom', 'right', 'top'];
export const newSide = full => ({ on:true, major:true, minor:false, dir:'out', labels:full, title:full });
export const newAxes = () => ({ left:newSide(true), bottom:newSide(true), right:newSide(false), top:newSide(false) });
// A panel's axes, given it the defaults where it has none yet (a panel made by hand or
// from older settings): the model is written, as the drawing always did.
export const axesOf = p => p.axes || (p.axes = newAxes());

/* Divisions: colour groups inside one bar series (figure.js, at addDiv, says what they
   are). Every bar series has at least one division, and that first one follows the
   series' own colour and name until it is given its own. */
export const divsOf = s => (s.divs && s.divs.length) ? s.divs : [{}];
export const divName = (s, k)=> (divsOf(s)[k] && divsOf(s)[k].name) || (k === 0 && s.given) || s.label;
export const divColor = (s, k)=> (divsOf(s)[k] && divsOf(s)[k].color) || s.color;
export const divTexture = (s, k)=> (divsOf(s)[k] && divsOf(s)[k].texture) || s.texture || 'solid';
export const divInv = (s, k)=>{
  const d = divsOf(s)[k];
  return (d && d.texInv != null) ? d.texInv : !!s.texInv;
};
export const divOfBar = (s, j)=> Math.min(Math.max((s.divOf && s.divOf[j]) || 0, 0), divsOf(s).length - 1);

/* A series is one legend entry — a bar series is one per division, since the legend
   speaks of divisions. With a single division that comes to the same thing, because
   it carries the series' own name and colour. */
export function legendEntries(list){
  const out = [];
  for (const s of list){
    if (s.kind === 'bar')
      divsOf(s).forEach((_, k)=> out.push({ ...s, color: divColor(s, k), label: divName(s, k),
                                            texture: divTexture(s, k), texInv: divInv(s, k) }));
    else out.push(s);
  }
  return out;
}

// The panel whose range a panel follows, chasing the links and stopping at a cycle.
export function rangeRoot(C, i, key){
  const F = C.F;
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
export const rangeGroup = (C, i, key)=> C.F.panels.map((_, k)=> k).filter(k=> rangeRoot(C, k, key) === rangeRoot(C, i, key));

/* ---- Ticks and log scales ----------------------------------------------------
   On a log axis the figure works in the log10 of the data: ranges, ticks and the
   placing of everything are linear there, and only the series are carried over
   (TX/TY). A category axis has no scale to change, so a bar chart's X stays linear. */

/* What the axes actually use: the automatic switch wins over whatever number the
   field is showing, so nothing has to be zeroed to mean "pick one for me". */
export const stepX = C => C.F.xStepAuto ? 0 : C.F.xStep;
export const stepY = C => C.F.yStepAuto ? 0 : C.F.yStep;

/* How many ticks an axis can have (v566). A step set by hand that would put more than
   MAX_TICKS majors in the range, or majors its values' twelve digits cannot tell apart
   (1e14 in steps of 10), is not followed: the axis takes its automatic ticks, as
   plot.js's fixedTicks does past 1000. Minors that would be more than MAX_MINORS, or
   that have no step (majors that coincide, or that run down) or one too fine for the
   values' floats, are left out. A log axis wider than MAX_DECADES (finite numbers span
   632) has no ticks. To v565 the majors were cut at the first 400, and the minors walked
   to one at a time from below, which a step of 0 or one under the values' float spacing
   never got past: the tab hung. */
export const MAX_TICKS = 400, MAX_MINORS = 20000, MAX_DECADES = 1000;

// Major ticks for a range: a fixed step when the user set one, else a nice default.
export function majorTicks(C, lo, hi, step){
  const nice = ()=> C.niceTicks(lo, hi, 4).filter(t=> t >= lo && t <= hi);
  if (!(step > 0)) return nice();
  const out = [], first = Math.ceil(lo / step) * step;
  // Snap to the step grid so 0.30000000000000004 never reaches a tick label.
  for (let k = 0; k <= MAX_TICKS; k++){
    const v = first + k * step;
    if (v > hi + step * 1e-9) break;
    out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  }
  // One too many, or two that coincide (a NaN, which never compares, too).
  return out.length > MAX_TICKS || out.some((t, i)=> i && !(t > out[i-1])) ? nice() : out;
}

export const xLog = C => !!C.F.xLog && !(C.F.cats && C.F.cats.length);
export const yLog = C => !!C.F.yLog;
export const isLog = (C, ax) => ax === 'x' ? xLog(C) : yLog(C);
export const lg = v => v > 0 ? Math.log10(v) : NaN;
export const TX = (C, v) => xLog(C) ? lg(v) : v;
export const TY = (C, v) => yLog(C) ? lg(v) : v;
export const pow10 = t => +Math.pow(10, t).toPrecision(12);

/* The major ticks of an axis. On a log one they are the whole decades in view, every
   step-th one when a step is set (in decades). Under two decades in view there are
   too few of those, and the ticks fall on the 1, 2 and 5 of each decade instead, or
   failing three of those on nice values of the data, as a linear axis would pick
   them. `dec` marks the decade kind, whose labels are powers of ten, not numbers. */
export function axisTicks(C, ax, lo, hi){
  const step = ax === 'x' ? stepX(C) : stepY(C);
  if (!isLog(C, ax)) return majorTicks(C, lo, hi, step);
  if (!(hi - lo <= MAX_DECADES)) return [];
  const k = Math.max(1, Math.round(step) || 1), dec = [];
  for (let n = Math.ceil(lo - 1e-9); n <= hi + 1e-9; n++) if (n % k === 0) dec.push(n);
  if (dec.length >= 2){ dec.dec = true; return dec; }
  const out = [];
  for (let n = Math.floor(lo); n <= Math.ceil(hi); n++)
    for (const m of [1, 2, 5]){ const t = Math.log10(m) + n; if (t >= lo - 1e-9 && t <= hi + 1e-9) out.push(t); }
  if (out.length >= 3) return out;
  return C.niceTicks(Math.pow(10, lo), Math.pow(10, hi), 4).map(lg).filter(t=> t >= lo && t <= hi);
}
// How many minor ticks each major interval gets. Automatic on a log axis: a decade
// apart, the 2…9 of the decade; several decades apart, the decades in between.
export function minorsOf(C, ax, majors){
  const F = C.F;
  const auto = ax === 'x' ? F.minorXAuto : F.minorYAuto;
  if (!auto) return ax === 'x' ? F.minorX : F.minorY;
  if (!isLog(C, ax) || !majors.dec) return 4;
  const k = majors.length > 1 ? majors[1] - majors[0] : 1;
  return k > 1 ? k - 1 : 8;
}
/* The minor ticks of an axis. On a log one, the n minors of an interval stand where
   they would on a linear scale — at equal steps of the value from one major to the
   next — and so crowd towards its top end: with n = 8 over a decade they are 2…9. */
export function axisMinors(C, ax, majors, lo, hi){
  const F = C.F;
  const n = Math.max(0, Math.round(minorsOf(C, ax, majors)));
  if (!isLog(C, ax)) return minorTicks(majors, lo, hi, n);
  if (majors.length < 2 || !n) return [];
  // Automatic over several decades: the decades themselves.
  const auto = ax === 'x' ? F.minorXAuto : F.minorYAuto;
  const at = (a, b, j)=> majors.dec && auto && b - a > 1 ? a + j
    : Math.log10(Math.pow(10, a) + j * (Math.pow(10, b) - Math.pow(10, a)) / (n + 1));
  const ends = [majors[0] - (majors[1] - majors[0]), ...majors,
                majors[majors.length-1] + (majors[majors.length-1] - majors[majors.length-2])];
  const out = [];
  if ((ends.length - 1) * n > MAX_MINORS) return out;
  for (let i = 0; i + 1 < ends.length; i++)
    for (let j = 1; j <= n; j++){ const t = at(ends[i], ends[i+1], j); if (t >= lo && t <= hi) out.push(t); }
  return out;
}
/* `n` minor ticks between each pair of majors, extended one interval past both ends.
   Positions that land on a major are dropped — a minor tick under a major one is
   invisible except for the shorter mark poking out of it. The k of the first and the
   last one in [lo, hi] are worked out, two either side for the rounding, and only
   those tried (to v565 every k from -div up, see MAX_TICKS). */
export function minorTicks(majors, lo, hi, n){
  n = Math.max(0, Math.round(n));
  if (majors.length < 2 || !n) return [];
  const div = n + 1, step = (majors[1] - majors[0]) / div, out = [];
  const first = majors[0], end = majors[majors.length-1] + div * step;
  const k0 = Math.max(-div, Math.floor((lo - first) / step) - 2);
  const k1 = Math.ceil((Math.min(hi, end) - first) / step) + 2;
  // Too fine for the values' floats: under 2^-49 of them, a few float spacings apart.
  const fine = step < Math.max(Math.abs(first), Math.abs(end)) * Math.pow(2, -49);
  if (!(step > 0) || fine || !Number.isSafeInteger(k0) || !Number.isSafeInteger(k1) || k1 - k0 > MAX_MINORS) return out;
  for (let k = k0; k <= k1; k++){
    const v = first + k * step;
    if (v > hi + step / 2) break;
    if (v > end) break;
    if (v < lo) continue;
    if (v > hi) continue;
    if (((k % div) + div) % div === 0) continue;   // sits on a major
    out.push(v);
  }
  return out;
}
// A tick's label: its number, or on a log axis's decades a 10 and its raised exponent.
export const SUP_K = 0.72;
export function tickParts(C, ax, t, majors){
  if (!isLog(C, ax)) return { base: C.fmtTick(t) };
  if (majors && majors.dec) return { base: '10', sup: t < 0 ? '−' + (-t) : String(t) };
  return { base: C.fmtTick(pow10(t)) };
}
export const tickW = (C, ax, t, majors, f)=>{ const p = tickParts(C, ax, t, majors); return C.textW(p.base, f) + (p.sup ? C.textW(p.sup, f * SUP_K) : 0); };
// The bounds as the Range fields show and take them: on a log axis, the data's own
// values rather than their logarithms (a bound ≤ 0 has none).
export const shownOf = (C, ax, v)=> isLog(C, ax) ? Math.pow(10, v) : v;
export const takenOf = (C, ax, v)=> isLog(C, ax) ? (v > 0 ? Math.log10(v) : null) : v;

/* ---- Ranges ------------------------------------------------------------------ */

// Data extent of the series drawn in `panelIdxs`, or null when there's no data. On a
// log axis it is the extent of the logarithms, which is what that axis is ranged in.
export function extentOf(C, panelIdxs){
  const F = C.F;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, any = false;
  for (const s of F.series){
    if (!s.show || !panelIdxs.includes(s.panel)) continue;
    for (let i = 0; i < s.xs.length; i++){
      const x = TX(C, s.xs[i]), y = TY(C, s.ys[i]);
      if (!isFinite(x) || !isFinite(y)) continue;
      // Error bars are part of the mark, so they must fit inside the range too — but a
      // whisker running down to a value a log axis cannot show cannot stretch it.
      const e = (s.errs && isFinite(s.errs[i]) && s.errs[i] > 0) ? s.errs[i] : 0;
      let lo = TY(C, s.ys[i] - e), hi = TY(C, s.ys[i] + e);
      // A box reaches from its lowest to its highest value shown, outliers included.
      const b = s.boxes && s.boxes[i];
      if (b){ lo = TY(C, Math.min(b.lo, ...b.out)); hi = TY(C, Math.max(b.hi, ...b.out)); }
      any = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (isFinite(lo) && lo < y0) y0 = lo; if (y < y0) y0 = y;
      if (isFinite(hi) && hi > y1) y1 = hi; if (y > y1) y1 = y;
    }
  }
  if (!any) return null;
  // Bars stand on a zero baseline and need half a category slot of air either side.
  // A log axis has no zero: its bars rise from the foot of whatever range is shown.
  const bars = F.series.some(s=> s.show && s.kind === 'bar' && panelIdxs.includes(s.panel));
  if (bars){ x0 -= 0.7; x1 += 0.7; if (!yLog(C)) y0 = Math.min(0, y0); }
  if (x1 === x0){ x0 -= 0.5; x1 += 0.5; }
  if (y1 === y0){ y0 -= 0.5; y1 += 0.5; }
  const pad = (y1 - y0) * 0.05;
  // (So there the shortest bar keeps the padding under it, or it would have no height.)
  return { x0, x1, y0: bars && !yLog(C) ? y0 : y0 - pad, y1: y1 + pad };
}

// The X/Y range of every panel, indexed by panel. Shared means they all get the
// figure-wide one; otherwise each panel resolves its own, manual if it has one set.
export function computeRanges(C){
  const F = C.F;
  const globalExt = extentOf(C, F.panels.map((_, i)=> i)) || { x0:0, x1:1, y0:0, y1:1 };
  const xOf = [], yOf = [];
  F.panels.forEach((p, i)=>{
    // Off the figure-wide switch, a panel is scaled with whatever group it shares
    // with — itself alone, unless it was pointed at another panel.
    const exX = F.shareX ? globalExt : (extentOf(C, rangeGroup(C, i, 'shareXWith')) || globalExt);
    const exY = F.shareY ? globalExt : (extentOf(C, rangeGroup(C, i, 'shareYWith')) || globalExt);
    const ex = exX, ey = exY;
    const manX = F.shareX ? [F.xmin, F.xmax] : F.xMan[rangeRoot(C, i, 'shareXWith')];
    const manY = F.shareY ? [F.ymin, F.ymax] : F.yMan[rangeRoot(C, i, 'shareYWith')];
    // Whose automatic switch applies: the figure's while sharing, else the panel
    // the group is rooted on, so panels sharing a range also share that choice.
    const rx = F.panels[rangeRoot(C, i, 'shareXWith')] || p;
    const ry = F.panels[rangeRoot(C, i, 'shareYWith')] || p;
    const autoX = F.shareX ? F.xAuto : rx.xAuto !== false;
    const autoY = F.shareY ? F.yAuto : ry.yAuto !== false;
    xOf[i] = (autoX || !manX) ? [ex.x0, ex.x1] : manX.slice();
    yOf[i] = (autoY || !manY) ? [ey.y0, ey.y1] : manY.slice();
  });
  return { xOf, yOf, globalExt };
}

// True when nothing sits immediately beyond `side` of panel `i` — i.e. there is
// room outside that edge for tick numbers and an axis title. Panels touch, so a
// side facing a neighbour can only carry tick marks.
export function sideFree(C, i){
  const F = C.F;
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

/* ---- Category names (a bar chart's X axis) ------------------------------------ */

// A category's name: the one typed into the composer, else the one the plot came with.
export function catText(C, x){
  const F = C.F;
  const own = F.catNames && F.catNames[x];
  if (own != null && own !== '') return own;
  const cat = F.cats && F.cats.find(c=> c.x === x);
  return cat ? cat.text : '';
}
/* The plot's name of a category in runs, [[text, over], …], where some are overlined (a
   negative Miller index's bar: the size by peak, xrd-rv.js), or null: a name typed into
   the composer, plain text there, and any other is drawn as text. Up to v493 the bar was
   lost here, the minus drawn. */
export function catRuns(C, x){
  const F = C.F;
  const own = F.catNames && F.catNames[x];
  if (own != null && own !== '') return null;
  const cat = F.cats && F.cats.find(c=> c.x === x);
  return cat && Array.isArray(cat.runs) && cat.runs.some(r=> r[1]) ? cat.runs : null;
}
// Two overlined runs side by side kept a tenth of the font apart, each its own bar.
export const barGap = (runs, i, px)=> i && runs[i - 1][1] ? px / 10 : 0;
// A category's width as drawn: its runs' text (each minus hidden) and the gaps between bars.
export function catW(C, x, px){
  const r = catRuns(C, x);
  return r ? C.textW(r.map(q=> q[0]).join(''), px) + r.reduce((s, q, i)=> s + (q[1] ? barGap(r, i, px) : 0), 0) : C.textW(catText(C, x), px);
}

/* ---- The page: margins, plot area, the X names' tilt ------------------------- */

// The font sizes, in figure px.
export const fontsOf = F => ({ fTick: F.font.tick * PT_PX, fAxis: F.font.axis * PT_PX,
                               fLeg: F.font.legend * PT_PX, fTitle: F.font.title * PT_PX });

// The widest Y number of any panel, which is what the side margins leave room for.
export function maxYNumber(C, ranges, fTick){
  const F = C.F;
  let maxYNum = 0;
  F.panels.forEach((p, i)=>{
    const ts = axisTicks(C, 'y', ranges.yOf[i][0], ranges.yOf[i][1]);
    for (const t of ts) maxYNum = Math.max(maxYNum, tickW(C, 'y', t, ts, fTick));
  });
  return maxYNum;
}

/* Outer margins and placing for a given tilt of the X labels: room for the Y numbers +
   title on the left, X numbers + title below, and (for a global legend) a strip under
   that. `lean` reserves room for names that hang past their panel's left side. `fig`
   is the page in figure px, the fonts, the ranges, the numbers' and names' widths
   (maxYNum, catWs), and what spilled out of the last pass (`extra`). */
export function marginsFor(C, fig, xRot, lean){
  const F = C.F;
  const { W, H, fonts, ranges, extra, maxYNum, catWs } = fig;
  const { fTick, fAxis, fLeg } = fonts;
  const { xOf } = ranges;
  // How far the X labels stick out sideways and downwards. A number is centred on
  // its tick, so the outermost ones overhang the frame by half their width; tilted
  // category names hang below the axis and lean past its left end.
  let halfX = 0, catDrop = 0, catLean = 0;
  const xRad = xRot * Math.PI / 180;
  // A category axis draws its names, never numbers: those take no room of their own.
  if (!catWs.length) F.panels.forEach((p, i)=>{
    const ts = axisTicks(C, 'x', xOf[i][0], xOf[i][1]);
    for (const t of ts){
      const w = tickW(C, 'x', t, ts, fTick);
      halfX = Math.max(halfX, xRot ? w * Math.cos(xRad) : w / 2);
      if (xRot) catDrop = Math.max(catDrop, w * Math.sin(xRad) + fTick * Math.cos(xRad));
    }
  });
  if (F.cats && F.cats.length){
    F.cats.forEach((cat, k)=>{
      const w = catWs[k], rad = xRad;
      catDrop = Math.max(catDrop, w * Math.sin(rad) + fTick * Math.cos(rad));
      catLean = Math.max(catLean, xRot ? w * Math.cos(rad) : w / 2);
    });
    // Names tilted to stay inside their panel need no margin to lean into.
    if (lean) halfX = Math.max(halfX, catLean);
  }
  const xDrop = (F.cats && F.cats.length) || xRot
    ? Math.max(fTick * 1.7, catDrop + fTick * 0.6) : fTick * 1.7;

  // Only reserve room on a side that some panel actually decorates.
  const anySide = (side, what) => F.panels.some(p => axesOf(p)[side][what]);
  const room = (side, vert) =>
    (anySide(side, 'labels') ? (vert ? maxYNum + 8 : xDrop) : 0) +
    (anySide(side, 'title') && (vert ? (F.ylabel || F.panels.some(p=> p.ylabel)) : F.xlabel) ? fAxis * 1.5 : 0);
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
  // Set by hand, the plot area is the size asked, whatever the page: one larger than
  // the page runs off it, which is seen at once (no limit hides the mistake).
  if (!F.plotAuto){
    innerW = Math.max(20, F.plotW * PX_MM);
    innerH = Math.max(20, F.plotH * PX_MM);
  }
  /* A plot area other than the space the margins leave is placed in it by `align`,
     centred unless asked otherwise: to spare where it is smaller, over the edges
     where it is larger. */
  const AL = { t:0, l:0, c:0.5, b:1, r:1 };
  const av = String(F.align || 'cc');
  const fy = AL[av[0]] !== undefined ? AL[av[0]] : 0.5;
  const fx = AL[av[1]] !== undefined ? AL[av[1]] : 0.5;
  const oX = mL + ((W - mL - mR) - innerW) * fx;
  const oY = mT + ((H - mT - mB) - innerH) * fy;
  const cw = innerW / F.cols, ch = innerH / F.rows;
  return { xRot, xDrop, legendH, mL, mR, mT, mB, innerW, innerH, oX, oY, cw, ch };
}

// Whether every panel's names, tilted by `rot` on the layout `L`, stay between its
// sides and clear of one another (a panel that draws none passes).
export function namesFit(C, fig, L, rot){
  const F = C.F;
  const { fonts: { fTick }, ranges: { xOf }, catWs } = fig;
  return F.panels.every((p, pi)=>{
    const ax = axesOf(p), fr = sideFree(C, pi);
    const drawn = ['bottom', 'top'].some(sd => ax[sd].labels && (fr[sd] || !F.innerClean));
    if (!drawn) return true;
    const px0 = L.oX + p.c * L.cw, pw = Math.max(4, p.cs * L.cw), [x0, x1] = xOf[pi] || [0, 1];
    const inRange = F.cats.map(c=> c.x >= x0 && c.x <= x1);
    const qs = F.cats.map(c=> px0 + (c.x - x0) / (x1 - x0 || 1) * pw);
    return C.tiltFits(catWs.map((w, k)=> inRange[k] ? w : 0), qs, px0, px0 + pw, fTick * 1.2, rot);
  });
}

/* The figure's layout on a W × H px page: its margins and plot area (marginsFor), at the
   tilt of the X names. Chosen automatically, the tilt is the least, from 30° to 90° in
   5° steps, at which every panel's names stay between its sides and clear of one
   another; failing that 90°. It is chosen on the X axis as it stands: kept inside, the
   names ask nothing of the side margins, so no angle tried moves the panels it is tried
   against, and only a change of range or layout changes the tilt. Also gives the widest
   Y number (maxYNum), which the Y titles stand clear of. */
export function figureLayout(C, W, H, fonts, ranges, extra){
  const F = C.F;
  const maxYNum = maxYNumber(C, ranges, fonts.fTick);
  // The category names, measured once: whole, as the figure always draws them.
  const catWs = (F.cats || []).map(cat=> catW(C, cat.x, fonts.fTick));
  const fig = { W, H, fonts, ranges, extra, maxYNum, catWs };
  let lay;
  if (F.catRotAuto && catWs.length){
    const here = marginsFor(C, fig, 30, false);
    let rot = 90;
    for (let r = 30; r <= 90; r += 5) if (namesFit(C, fig, here, r)){ rot = r; break; }
    lay = marginsFor(C, fig, rot, false);
  } else lay = marginsFor(C, fig, Math.max(0, Math.min(90, F.catRot || 0)), true);
  lay.maxYNum = maxYNum;
  return lay;
}

/* ---- A panel ------------------------------------------------------------------- */

/* Panel `pi` (p) on the layout: its box in figure px, its range, the scales (XT/YT
   place a value of the axis itself — a tick, a bound — and X/Y a value of the data,
   which on a log axis is first taken to its logarithm; Yc puts a data value a log axis
   has no place for, ≤ 0, past the panel's foot, where the clip cuts it: a whisker or a
   bar running down to it ends there), its major ticks (gx, gy, which the grid, the marks
   and the numbers share), the sides with room beyond them (free), each side's base line
   and outward direction (geo), and the categories in its range (cats; null when the X
   axis has none). The rest of the figure's parts take this frame. */
export function panelFrame(C, lay, ranges, fonts, p, pi){
  const F = C.F;
  const { oX, oY, cw, ch } = lay;
  const px0 = oX + p.c * cw, py0 = oY + p.r * ch;
  const pw = Math.max(4, p.cs * cw), ph = Math.max(4, p.rs * ch);
  const [x0, x1] = ranges.xOf[pi] || [0, 1];
  const [y0, y1] = ranges.yOf[pi] || [0, 1];
  const XT = v => px0 + (v - x0) / (x1 - x0 || 1) * pw;
  const YT = v => py0 + ph - (v - y0) / (y1 - y0 || 1) * ph;
  const X = v => XT(TX(C, v)), Y = v => YT(TY(C, v));
  const Yc = v =>{ const q = Y(v); return isFinite(q) ? q : py0 + ph + 2; };
  // Base coordinate of each side, and the outward normal direction along the axis
  // that ticks/labels/titles grow into.
  const geo = {
    left:   { vert:true,  base:px0,    out:-1 },
    right:  { vert:true,  base:px0+pw, out:+1 },
    top:    { vert:false, base:py0,    out:-1 },
    bottom: { vert:false, base:py0+ph, out:+1 },
  };
  // A bar chart's X axis is categorical: the tick labels carried over from the
  // source plot replace the numbers, one per category inside the panel's range.
  const cats = F.cats && F.cats.length ? F.cats.filter(c=> c.x >= x0 && c.x <= x1) : null;
  return { p, pi, lay, ranges, fonts, px0, py0, pw, ph, x0, x1, y0, y1, XT, YT, X, Y, Yc,
           gx: axisTicks(C, 'x', x0, x1), gy: axisTicks(C, 'y', y0, y1), free: sideFree(C, pi), geo, cats };
}

// The grid's rules, under everything: { at, minor } each, from the same ticks the axes
// use, so it always lines up with the numbers whatever the tick step is.
export function gridRules(C, fr){
  const F = C.F;
  const { px0, py0, pw, ph, x0, x1, y0, y1, XT, YT, gx, gy } = fr;
  const out = [];
  const rule = (at, minor)=> out.push({ at, minor: !!minor });
  if (F.grid.x){
    for (const t of gx) rule({ x1:XT(t), x2:XT(t), y1:py0, y2:py0+ph });
    if (F.grid.minor) for (const t of axisMinors(C, 'x', gx, x0, x1)) rule({ x1:XT(t), x2:XT(t), y1:py0, y2:py0+ph }, true);
  }
  if (F.grid.y){
    for (const t of gy) rule({ x1:px0, x2:px0+pw, y1:YT(t), y2:YT(t) });
    if (F.grid.minor) for (const t of axisMinors(C, 'y', gy, y0, y1)) rule({ x1:px0, x2:px0+pw, y1:YT(t), y2:YT(t) }, true);
  }
  return out;
}

/* ---- The data ------------------------------------------------------------------ */

/* One value label: { at, txt }, or null for a value that is no number. `pos` is
   relative to the mark; the text rotates about its own anchor so a tilted label still
   starts where it points. `box` is the bar (its colour, its top and bottom as drawn)
   when there is one. */
export function valueLabel(C, s, j, cx, yMark, yTop, yBot, box, ink, paper){
  const DL = C.F.dataLabels;
  // Always formatted here, so the decimals setting means something; a series
  // that carries an uncertainty keeps it, at the same number of decimals.
  // A figure always reads with a decimal point, whatever separator the CSV
  // export is set to, so this formats directly instead of going through fmtNum.
  const dec = v => v.toFixed(Math.max(0, Math.min(6, DL.dec | 0)));
  const e = s.errs && s.errs[j];
  const txt = dec(s.ys[j]) + (isFinite(e) && e > 0 ? ' ± ' + dec(e) : '');
  if (!isFinite(s.ys[j])) return null;
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
    const back = C.textW(txt, size) * Math.cos(rad) / 2;
    const ax = cx + (DL.pos === 'below' ? back : -back);
    at.x = ax;
    at['text-anchor'] = DL.pos === 'below' ? 'end' : 'start';
    at['dominant-baseline'] = 'central';
    at.transform = `rotate(-${DL.rot} ${ax} ${y})`;
  }
  return { at, txt };
}

/* Bars of different series sharing a category sit side by side inside the slot: this
   series' bar width and offset in px, and the line its bars stand on (on a log axis
   there is no zero to stand on: bars rise from the panel's foot). */
export function barSlot(C, fr, s, barSeries){
  const { XT, YT, y0, y1 } = fr;
  const nb = barSeries.length, bi = barSeries.indexOf(s);
  const slot = Math.abs(XT(1) - XT(0));         // one category, in px
  const wPx = Math.max(1, slot * s.width / nb);
  const off = (bi - (nb - 1) / 2) * wPx;
  const zero = YT(yLog(C) ? y0 : Math.max(y0, Math.min(y1, 0)));
  return { wPx, off, zero };
}
// A bar's rectangle, its centre at cx, from its value's y to the line it stands on.
export const barRect = (cx, yy, zero, wPx)=> ({ x:(cx - wPx/2).toFixed(2), y:Math.min(yy, zero).toFixed(2),
                                                width:wPx.toFixed(2), height:Math.abs(zero - yy).toFixed(2) });
// A bar's error bar, its three lines (the whisker, a cap at each end), or null for none.
export function errorBar(fr, cx, yv, err, wPx){
  if (!(isFinite(err) && err > 0)) return null;
  const yA = fr.Yc(yv - err), yB = fr.Yc(yv + err), cap = Math.min(4, wPx / 3);
  return [{ x1:cx, x2:cx, y1:yA, y2:yB }, { x1:cx-cap, x2:cx+cap, y1:yA, y2:yA }, { x1:cx-cap, x2:cx+cap, y1:yB, y2:yB }];
}
// A bar's value label: measured from the whisker when there is one, so a label never
// sits on it, and centred on the bar as the reader sees it: clipped to the panel, so a
// bar running past the top of the range is centred on the part that shows.
export function barLabel(C, fr, s, j, cx, yy, yv, zero, err, ink, paper){
  const { py0, ph, Yc } = fr;
  const e = (isFinite(err) && err > 0) ? err : 0;
  const bTop = Math.min(Math.max(Math.min(yy, zero), py0), py0 + ph);
  const bBot = Math.min(Math.max(Math.max(yy, zero), py0), py0 + ph);
  return valueLabel(C, s, j, cx, yy, Math.min(Yc(yv + e), zero), Math.max(Yc(yv - e), zero),
                    { color: divColor(s, divOfBar(s, j)), top: bTop, bottom: bBot }, ink, paper);
}

/* One box of a box plot, in its bar's slot: the box from the first to the third
   quartile, the median across it, whiskers to the furthest values within 1.5 IQR with
   caps, each value beyond a circle, the mean a cross (none when it is no number); a box
   marked minBox (as plot.js box drew it: v576 XRPD's crystallite sizes, v577 every box
   plot) no shorter than the cross, about its middle. The lines and shapes as { x1, x2, y1,
   y2 } and the like; its division (d) and colour. */
export function boxMarks(fr, s, j, b, cx, wPx){
  const { Yc } = fr;
  const hw = wPx/2, cap = Math.min(4, hw/2), r = Math.min(2.5, hw*0.4);
  const yq1 = Yc(b.q1), yq3 = Yc(b.q3), ylo = Yc(b.lo), yhi = Yc(b.hi), ym = Yc(b.med);
  const whiskers = [{ x1:cx, x2:cx, y1:ylo, y2:yq1 }, { x1:cx, x2:cx, y1:yq3, y2:yhi },
                    { x1:cx-cap, x2:cx+cap, y1:ylo, y2:ylo }, { x1:cx-cap, x2:cx+cap, y1:yhi, y2:yhi }];
  const d = divOfBar(s, j), color = divColor(s, d);
  const h0 = Math.abs(yq1 - yq3), grow = b.minBox ? Math.max(0, 2*r - h0) : 0;
  const rect = { x:(cx - hw).toFixed(2), y:(Math.min(yq1, yq3) - grow/2).toFixed(2), width:wPx.toFixed(2), height:(h0 + grow).toFixed(2) };
  const median = { x1:cx-hw, x2:cx+hw, y1:ym, y2:ym };
  let mean = [];
  if (isFinite(b.mean)){
    const yv = Yc(b.mean);
    mean = [{ x1:cx-r, x2:cx+r, y1:yv-r, y2:yv+r }, { x1:cx-r, x2:cx+r, y1:yv+r, y2:yv-r }];
  }
  const outliers = b.out.map(v=> ({ cx, cy:Yc(v), r:Math.max(1, Math.min(2, hw/3)) }));
  return { hw, yq1, yq3, ylo, yhi, d, color, whiskers, rect, median, mean, outliers };
}
// A box's value label: the mean ± what the plot gave, above whatever of it reaches
// highest, centred on the box as it shows inside the panel.
export function boxLabel(C, fr, s, j, b, cx, k, ink, paper){
  const { py0, ph, Yc } = fr;
  const { yq1, yq3, ylo, yhi, color } = k;
  const top = Math.min(yhi, ...b.out.map(Yc)), bot = Math.max(ylo, ...b.out.map(Yc));
  return valueLabel(C, s, j, cx, Yc(b.mean), top, bot,
                    { color, top: Math.min(Math.max(Math.min(yq1, yq3), py0), py0 + ph), bottom: Math.min(Math.max(Math.max(yq1, yq3), py0), py0 + ph) }, ink, paper);
}

// A curve's symbols, [tag, attributes] each, at the points that have a place.
export function curveMarkers(fr, s){
  const r = Math.max(0.9, s.width * 1.3), out = [];
  for (let i = 0; i < s.xs.length; i++){
    const qx = fr.X(s.xs[i]), qy = fr.Y(s.ys[i]);
    if (!isFinite(qx) || !isFinite(qy)) continue;
    out.push(markerShape(s.marker, +qx.toFixed(2), +qy.toFixed(2), r, s.color, s.width));
  }
  return out;
}
// A curve's line: the path through the points that have a place.
export function curvePath(fr, s){
  let d = '';
  for (let i = 0; i < s.xs.length; i++){
    const qx = fr.X(s.xs[i]), qy = fr.Y(s.ys[i]);
    if (!isFinite(qx) || !isFinite(qy)) continue;
    d += (d === '' ? 'M' : 'L') + qx.toFixed(2) + ',' + qy.toFixed(2) + ' ';
  }
  return d;
}
// A curve's value labels, one a point that has a place.
export function curveLabels(C, fr, s, ink, paper){
  const out = [];
  for (let i = 0; i < s.xs.length; i++){
    const qx = fr.X(s.xs[i]), yy = fr.Y(s.ys[i]);
    if (!isFinite(qx) || !isFinite(yy)) continue;
    const v = valueLabel(C, s, i, qx, yy, yy, yy, undefined, ink, paper);
    if (v) out.push(v);
  }
  return out;
}

/* ---- The axes ------------------------------------------------------------------- */

export const TICK_MAJ = 4, TICK_MIN = 2.2;

// The axis line of a side.
export function axisLine(fr, side){
  const g0 = fr.geo[side];
  return g0.vert ? { x1:g0.base, x2:g0.base, y1:fr.py0, y2:fr.py0+fr.ph }
                 : { x1:fr.px0, x2:fr.px0+fr.pw, y1:g0.base, y2:g0.base };
}
// The tick marks of a side, the majors then the minors, as the side asks for them.
// `dir` decides which side of the axis line they stick out of.
export function tickMarks(C, fr, side){
  const a = axesOf(fr.p)[side], g0 = fr.geo[side], out = [];
  const mark = (pos, len)=>{
    const o = g0.out * len;
    const from = a.dir === 'in' ? 0 : (a.dir === 'both' ? -o : 0);
    const to   = a.dir === 'in' ? -o : o;
    out.push(g0.vert ? { x1:g0.base+from, x2:g0.base+to, y1:pos, y2:pos }
                     : { x1:pos, x2:pos, y1:g0.base+from, y2:g0.base+to });
  };
  const proj = g0.vert ? fr.YT : fr.XT;
  const majors = g0.vert ? fr.gy : fr.gx;
  if (a.major) majors.forEach(t=> mark(proj(t), TICK_MAJ));
  if (a.minor) (g0.vert ? axisMinors(C, 'y', majors, fr.y0, fr.y1) : axisMinors(C, 'x', majors, fr.x0, fr.x1)).forEach(t=> mark(proj(t), TICK_MIN));
  return out;
}

/* Where another panel actually puts its numbers on the same side. A number at a
   shared edge only has to give way when the neighbour draws one within a line of
   it — checking merely "is the edge shared" dropped perfectly clear numbers, e.g.
   the 0 at the foot of every stacked panel but the last. Of two that clash there,
   the upper (left) panel's gives way and the lower (right) one keeps its own: past
   its top (left) edge a panel's neighbour draws none of the numbers at its own
   bottom (right) edge that clash with this one's (v569; to v568 both gave way, as
   each counted the other's). Vertical: the y of each; else the x of each and its
   half width. */
export function neighbourMarks(C, fr, side, edge, vert){
  const F = C.F;
  const { p, pi, lay: { oX, oY, cw, ch }, ranges: { xOf, yOf }, fonts: { fTick } } = fr;
  // The neighbour gives up its numbers at the edge it shares with this panel.
  const yields = edge === 'top' || edge === 'left';
  const marks = [];
  F.panels.forEach((q, k)=>{
    if (k === pi) return;
    const touches =
      edge === 'top'    ? (q.r + q.rs === p.r && q.c < p.c + p.cs && p.c < q.c + q.cs) :
      edge === 'bottom' ? (q.r === p.r + p.rs && q.c < p.c + p.cs && p.c < q.c + q.cs) :
      edge === 'left'   ? (q.c + q.cs === p.c && q.r < p.r + p.rs && p.r < q.r + q.rs) :
                          (q.c === p.c + p.cs && q.r < p.r + p.rs && p.r < q.r + q.rs);
    if (!touches) return;
    const qa = axesOf(q);
    if (!qa[side].labels) return;
    const qx0 = oX + q.c * cw, qy0 = oY + q.r * ch;
    const qw = Math.max(4, q.cs * cw), qh = Math.max(4, q.rs * ch);
    if (vert){
      const [a, z] = yOf[k] || [0, 1];
      for (const t of axisTicks(C, 'y', a, z)){
        const e = qy0 + qh - (t - a) / (z - a || 1) * qh;
        if (!(yields && e + fTick * 0.55 > qy0 + qh - 1)) marks.push(e);
      }
    } else {
      const [a, z] = xOf[k] || [0, 1];
      const ts = axisTicks(C, 'x', a, z);
      for (const t of ts){
        const m = { q: qx0 + (t - a) / (z - a || 1) * qw, w: tickW(C, 'x', t, ts, fTick) / 2 };
        if (!(yields && m.q + m.w > qx0 + qw - 1)) marks.push(m);
      }
    }
  });
  return marks;
}

/* The category names along a side, { x, at, rot } each: the category's x, where its
   text stands and its tilt (it turns about the middle of its last character, as on
   the page). */
export function catNames(fr, side){
  const g0 = fr.geo[side], fTick = fr.fonts.fTick, out = [];
  for (const c of fr.cats){
    const q = fr.XT(c.x), rot = fr.lay.xRot;
    const at = side === 'bottom' ? { x:q, y:g0.base + fTick*1.15 } : { x:q, y:g0.base - fTick*0.5 };
    out.push({ x: c.x, at, rot });
  }
  return out;
}

/* The numbers along a side, { at, parts, rot } each (parts: tickParts'; rot: numbers
   tilt with the category names, around the point they label). One at a panel's
   corner gives way where the neighbour past it draws one close by (neighbourMarks: of
   two, the upper or left panel's). */
export function tickNumbers(C, fr, side){
  const { px0, py0, pw, ph, free, fonts: { fTick } } = fr;
  const g0 = fr.geo[side], out = [];
  const proj = g0.vert ? fr.YT : fr.XT;
  const majors = g0.vert ? fr.gy : fr.gx;
  for (const t of majors){
    const parts = tickParts(C, g0.vert ? 'y' : 'x', t, majors);
    const q = proj(t);
    let at;
    if (g0.vert){
      const hh = fTick * 0.55;
      const near = e => Math.abs(e - q) < fTick * 1.1;
      if (q - hh < py0 + 1 && !free.top && neighbourMarks(C, fr, side, 'top', true).some(near)) continue;
      if (q + hh > py0 + ph - 1 && !free.bottom && neighbourMarks(C, fr, side, 'bottom', true).some(near)) continue;
      at = side === 'left'
        ? { x:g0.base-5, y:q+fTick*0.36, 'text-anchor':'end' }
        : { x:g0.base+5, y:q+fTick*0.36, 'text-anchor':'start' };
    } else {
      const hw = tickW(C, 'x', t, majors, fTick) / 2;
      const clash = m => Math.abs(m.q - q) < m.w + hw + 2;
      if (q - hw < px0 + 1 && !free.left && neighbourMarks(C, fr, side, 'left', false).some(clash)) continue;
      if (q + hw > px0 + pw - 1 && !free.right && neighbourMarks(C, fr, side, 'right', false).some(clash)) continue;
      at = { x:q, y: side === 'bottom' ? g0.base+fTick*1.25 : g0.base-fTick*0.5, 'text-anchor':'middle' };
    }
    out.push({ at, parts, rot: g0.vert ? 0 : fr.lay.xRot });
  }
  return out;
}

/* The axis title beside a side, { text, at }, or null: pushed clear of the numbers when
   they are present. In shared mode the figure-level titles (sharedTitles) replace these.
   A panel's own Y title (linked panels': figure.js buildModel) wins over the figure's. */
export function axisTitle(C, fr, side){
  const F = C.F;
  const { p, px0, py0, pw, ph, lay: { maxYNum, xDrop }, fonts: { fAxis } } = fr;
  const a = axesOf(p)[side], g0 = fr.geo[side];
  const label = g0.vert ? (p.ylabel != null ? p.ylabel : F.ylabel) : F.xlabel;
  if (!(a.title && label && (g0.vert ? F.titleModeY : F.titleModeX) !== 'shared')) return null;
  const clear = a.labels ? (g0.vert ? maxYNum + 8 : xDrop) : 6;
  if (g0.vert){
    const yc = py0 + ph/2, x = g0.base + g0.out * (clear + fAxis*0.9);
    return { text: label, at: { x, y:yc, 'text-anchor':'middle',
                                transform:`rotate(${side === 'left' ? -90 : 90} ${x} ${yc})` } };
  }
  const y = g0.base + g0.out * (clear + fAxis * (side === 'bottom' ? 1.0 : 0.4));
  return { text: label, at: { x:px0+pw/2, y, 'text-anchor':'middle' } };
}

// A panel's title: top-left, inside.
export const panelTitleAt = fr => ({ x:fr.px0+6, y:fr.py0+fr.fonts.fTitle*1.25 });

/* ---- Legends and shared titles ------------------------------------------------------ */

/* A legend's box: its outline and how much of the page it hides are set separately:
   a frame can be a plain outline over the figure, a solid block that covers whatever
   it sits on, or anything between. */
export function legendFrameAttrs(F, x, y, w, h, ink, paper){
  const at = { x, y, width:w, height:h, rx:2, fill:paper,
               'fill-opacity': Math.max(0, Math.min(1, F.legendFrameAlpha)) };
  if (F.legendFrameLine){ at.stroke = ink; at['stroke-width'] = 0.5; }
  return at;
}

/* The legend of a panel, in the chosen corner, or null when it has none: its box
   (frame: [x, y, w, h], null unframed) and its rows, { s, xa, xb, cy, tx } each: the
   entry, where its key runs, its middle line and where its words start. */
export function panelLegend(C, fr){
  const F = C.F;
  if (F.legendMode !== 'per-panel') return null;
  const { p, pi, px0, py0, pw, ph, fonts: { fLeg, fTitle } } = fr;
  const mine = legendEntries(F.series.filter(s=> s.show && s.inLegend !== false && s.panel === pi));
  if (!mine.length) return null;
  const gap = F.legendGap, lw = 14, pad = 4;
  const rowH = fLeg * 1.35;
  const wide = Math.max(...mine.map(s=> C.textW(s.label, fLeg))) + lw + 6;
  const right = F.legendCorner.endsWith('r'), top = F.legendCorner.startsWith('t');
  const titleDrop = (top && p.title) ? fTitle * 1.2 : 0;
  const boxX = right ? px0 + pw - gap - wide : px0 + gap;
  const boxY = top ? py0 + gap + titleDrop : py0 + ph - gap - mine.length * rowH;
  const frame = F.legendFrame ? [boxX-pad, boxY-pad, wide+pad*2, mine.length*rowH+pad*2] : null;
  const rows = mine.map((s, k)=>{
    const cy = boxY + rowH * (k + 0.5);
    return { s, xa: boxX, xb: boxX + lw, cy, tx: boxX + lw + 6 };
  });
  return { frame, rows };
}

/* Shared titles: one per side for the whole grid, centred on the inner area and
   sitting in the outer margin, { text, at } each (bottom, top, left, right). A side
   gets one when any panel asked for it. The margin is measured from the plot, not the
   page: with the plot set by hand (it may run off the page) the titles go with it, as
   the tick numbers do; with auto margins the two are the same. */
export function sharedTitles(C, lay, fonts){
  const F = C.F;
  const { oX, oY, innerW, innerH, mL, mR, mT, mB, legendH } = lay;
  const { fAxis } = fonts;
  const out = [];
  const want = side => F.panels.some(p=> axesOf(p)[side].title);
  const shX = F.titleModeX === 'shared', shY = F.titleModeY === 'shared';
  const cx = oX + innerW / 2, cy = oY + innerH / 2;
  const outL = oX - mL, outR = oX + innerW + mR, outT = oY - mT, outB = oY + innerH + mB;
  if (shX && F.xlabel && want('bottom'))
    out.push({ text: F.xlabel, at: { x:cx, y:outB - (F.legendPlace === 'top' ? 0 : legendH) - 4, 'text-anchor':'middle' } });
  if (shX && F.xlabel && want('top'))
    out.push({ text: F.xlabel, at: { x:cx, y:outT + fAxis, 'text-anchor':'middle' } });
  if (shY && F.ylabel && want('left'))
    out.push({ text: F.ylabel, at: { x:outL + fAxis*1.1, y:cy, 'text-anchor':'middle',
                                     transform:`rotate(-90 ${outL + fAxis*1.1} ${cy})` } });
  if (shY && F.ylabel && want('right'))
    out.push({ text: F.ylabel, at: { x:outR - fAxis*1.1, y:cy, 'text-anchor':'middle',
                                     transform:`rotate(90 ${outR - fAxis*1.1} ${cy})` } });
  return out;
}

/* The figure's legend: a strip above or below the panels, in one row or N columns,
   or null when there is none; as panelLegend's. Column widths follow the widest label
   in each column, so entries line up. */
export function globalLegend(C, lay, fonts){
  const F = C.F;
  if (F.legendMode !== 'global') return null;
  const { oX, oY, innerW, innerH, mB } = lay;
  const { fLeg } = fonts;
  const items = legendEntries(F.series.filter(s=> s.show && s.inLegend !== false));
  if (!items.length) return null;
  const gap = 14, lw = 16, rowH = fLeg * 1.35;
  const cols = Math.max(1, Math.min(Math.round(F.legendCols) || items.length, items.length));
  const rows = Math.ceil(items.length / cols);
  const colW = [];
  for (let c = 0; c < cols; c++){
    let w = 0;
    for (let r = 0; r < rows; r++){
      const s = items[r * cols + c];
      if (s) w = Math.max(w, lw + 4 + C.textW(s.label, fLeg));
    }
    colW[c] = w;
  }
  const total = colW.reduce((a, b)=> a + b, 0) + gap * (cols - 1);
  const x0 = F.legendAlign === 'left' ? oX
           : F.legendAlign === 'right' ? oX + innerW - total
           : oX + Math.max(0, (innerW - total) / 2);
  const yTop = F.legendPlace === 'top' ? oY - F.legendGap - rows * rowH
                                       : oY + innerH + (mB - rows * rowH) / 2;
  let frame = null;
  if (F.legendFrame){
    const pad = 4;
    frame = [x0-pad, yTop-pad, total+pad*2, rows*rowH+pad*2];
  }
  const out = items.map((s, i)=>{
    const c = i % cols, r = (i / cols) | 0;
    let x = x0; for (let k = 0; k < c; k++) x += colW[k] + gap;
    const cy = yTop + rowH * (r + 0.5);
    return { s, xa: x, xb: x + lw, cy, tx: x + lw + 4 };
  });
  return { frame, rows: out };
}
