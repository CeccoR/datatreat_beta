/* =========================================================
   The plots' figure composer: what its sidebar's fields and buttons do to the figure (v564,
   out of figure.js wireControls). Plain functions with no page, each on the figure's model F
   (figure.js buildModel) or a series of it: which keys are numbers and which reshape the
   sidebar, a panel placed and spanned, added in the first free cell and removed, a range
   handed over as the automatic one leaves it and carried across a log switch, a setting
   given to every series, a division's own settings, a fill as the picker shows it and as
   it takes it back, the colours a palette would keep, text put into a rich field. figure.js
   reads the fields, refuses what they cannot take and redraws; what the figure draws is
   worked out in figure-layout.js.
========================================================= */
import { newAxes, divsOf, divColor, divTexture, divInv } from './figure-layout.js';

// F's keys a number field sets (data-k), committed on change; the data labels' (data-dl).
export const NUM_KEYS = new Set(['wmm','hmm','dpi','rows','cols','xmin','xmax','ymin','ymax','xStep','yStep','minorX','minorY','legendCols','legendGap','legendFrameAlpha','plotW','plotH','catRot']);
export const DL_NUM = new Set(['rot','off','dec','size']);
/* Settings that change the shape of the sidebar itself. */
export const SHOWS_MORE = new Set(['xAuto','yAuto','shareX','shareY','legendMode','legendFrame',
  'xStepAuto','yStepAuto','minorXAuto','minorYAuto','catRotAuto','xLog','yLog']);

// True if placing panel `i` at r,c with the given span would sit on another panel.
// Panels tile a table: they may leave holes, but they must never overlap.
export function overlaps(F, i, r, c, rs, cs){
  return F.panels.some((q, k)=> k !== i &&
    r < q.r + q.rs && q.r < r + rs && c < q.c + q.cs && q.c < c + cs);
}
/* A panel's place or span typed (k: r or c, from 1, or rs or cs; raw the field's text):
   taken if it lands inside the grid and on no other panel (true), else the panel kept as
   it was (false: the field is to snap back). A span is cut at the grid's edge. */
export function movePanel(F, i, k, raw){
  const p = F.panels[i];
  const want = (k === 'r' || k === 'c') ? Math.max(0, (parseInt(raw, 10) || 1) - 1)
                                        : Math.max(1, parseInt(raw, 10) || 1);
  const cand = { r:p.r, c:p.c, rs:p.rs, cs:p.cs, [k]: want };
  cand.rs = Math.min(cand.rs, F.rows - cand.r);
  cand.cs = Math.min(cand.cs, F.cols - cand.c);
  if (!(cand.r < F.rows && cand.c < F.cols && !overlaps(F, i, cand.r, cand.c, cand.rs, cand.cs))) return false;
  p.r = cand.r; p.c = cand.c; p.rs = cand.rs; p.cs = cand.cs;
  return true;
}
// Where a new panel goes: the first free cell, row by row; none free, a row more under the
// grid (F.rows grown) and its first cell.
export function newPanelCell(F){
  const taken = new Set();
  F.panels.forEach(p=>{ for (let r=p.r;r<p.r+p.rs;r++) for (let c=p.c;c<p.c+p.cs;c++) taken.add(r+','+c); });
  let spot = null;
  for (let r = 0; r < F.rows && !spot; r++) for (let c = 0; c < F.cols && !spot; c++) if (!taken.has(r+','+c)) spot = [r,c];
  if (!spot){ F.rows += 1; spot = [F.rows-1, 0]; }
  return spot;
}
/* Panel i removed, never the last (false): a separate plot's series go with their panel
   (linked panels, figure.js buildModel), the others on it go to the first, those on the
   panels after it follow their panel down. */
export function dropPanel(F, i){
  if (F.panels.length <= 1) return false;
  F.panels.splice(i, 1);
  F.series = F.series.filter(s=> !(s.sep && s.panel === i));
  F.series.forEach(s=>{ if (s.panel === i) s.panel = 0; else if (s.panel > i) s.panel--; });
  return true;
}

/* A manual range is held in the axis's own terms — the logarithms, on a log axis — so
   switching the scale carries it across: the same bounds, the other way of placing
   them. One a log axis cannot take (≤ 0) gives way to the automatic range. */
export function relogRanges(F, ax, on){
  const conv = v => on ? (v > 0 ? Math.log10(v) : NaN) : Math.pow(10, v);
  const pair = r => r && r.map(conv).every(isFinite) ? r.map(conv) : null;
  const g = pair([F[ax + 'min'], F[ax + 'max']]);
  if (g) [F[ax + 'min'], F[ax + 'max']] = g; else F[ax + 'Auto'] = true;
  const man = F[ax + 'Man'];
  for (const k of Object.keys(man)){
    const r = pair(man[k]);
    if (r) man[k] = r;
    else { delete man[k]; if (F.panels[k]) F.panels[k][ax + 'Auto'] = true; }
  }
}
// The panel an axis's range fields are about (F.xPanel or F.yPanel), inside the figure.
export const selPanel = (F, X)=> Math.min(Math.max(0, (X ? F.xPanel : F.yPanel) | 0), F.panels.length - 1);
/* Turning the figure-wide auto range off (k: xAuto or yAuto) must hand you the range you
   are looking at, not the model's placeholder 0..1: the bounds as r (computeRanges, read
   while auto still holds) has them on its axis's panel, or the first. */
export function handOver(F, k, r){
  const i = (k === 'xAuto' ? F.xPanel : F.yPanel) | 0;
  if (k === 'xAuto'){ const [a, z] = r.xOf[i] || r.xOf[0] || [0, 1]; F.xmin = a; F.xmax = z; }
  else { const [a, z] = r.yOf[i] || r.yOf[0] || [0, 1]; F.ymin = a; F.ymax = z; }
}
/* The automatic switch of the range column (an axis, X or not): sharing, the figure's,
   the range on show handed over as it goes off; else that of the group panel i heads,
   whose range by hand starts, where it has none, from the one on show. The ranges
   (computeRanges) asked for only then. False: no such panel. */
export function rangeAuto(F, X, shared, i, on, ranges){
  if (shared){
    const r = ranges();
    if (!on){
      const [a, z] = (X ? r.xOf[i] : r.yOf[i]) || [0, 1];
      if (X){ F.xmin = a; F.xmax = z; } else { F.ymin = a; F.ymax = z; }
    }
    F[X ? 'xAuto' : 'yAuto'] = on;
    return true;
  }
  const p = F.panels[i]; if (!p) return false;
  if (!on && !F[X ? 'xMan' : 'yMan'][i]){
    const r = ranges();
    F[X ? 'xMan' : 'yMan'][i] = ((X ? r.xOf[i] : r.yOf[i]) || [0, 1]).slice();
  }
  p[X ? 'xAuto' : 'yAuto'] = on;
  return true;
}
// The range by hand of the group panel i heads (bag: xMan or yMan) as it stands, or a copy
// of the one on show (r: computeRanges) to start it from.
export const manOf = (F, bag, i, r)=> F[bag][i] || (bag === 'xMan' ? (r.xOf[i] || [0,1]).slice() : (r.yOf[i] || [0,1]).slice());

// One of the panels' axes' settings (a side's key ak) given to the panels edited (targets).
export function setAxes(F, targets, side, ak, v){
  for (const pi of targets){
    const p = F.panels[pi]; if (!p) continue;
    (p.axes || (p.axes = newAxes()))[side][ak] = v;
  }
}
/* The range a series' own width field takes: a bar's a fraction of its category's slot, a
   line's in points. The field for every series takes what each of them takes (v570: to v569
   from 0.1 with lines, under a line's 0.2): the ranges of the series met, [0.2, 1] with lines
   and bars. A bar's width read back (applySettings) is put inside its range: a figure saved
   to v568 could hold one wider than its slot (barWidth). */
export const widthRange = s => s.kind === 'bar' ? [0.1, 1] : [0.2, 6];
export const everyWidthRange = list => list.map(widthRange).reduce(([lo, hi], [a, b])=> [Math.max(lo, a), Math.min(hi, b)], [0.1, 6]);
export const barWidth = w =>{ const [lo, hi] = widthRange({ kind: 'bar' }); return Number.isFinite(w) ? Math.min(Math.max(w, lo), hi) : w; };
// One setting given to every series at once (the all-series row): shown, in the legend,
// the line's width, its dash ('solid': none) or, any other key, the symbol.
export function setEvery(F, k, v){
  const key = k === 'show' || k === 'inLegend' || k === 'width' || k === 'dash' ? k : 'marker';
  const val = k === 'dash' && v === 'solid' ? '' : v;
  F.series.forEach(s=>{ s[key] = val; });
}
// A division's own settings (its name, colour or fill), the divisions copied first.
export function setDiv(s, k, o){
  s.divs = divsOf(s).slice();
  s.divs[k] = { ...s.divs[k], ...o };
}
// A division with no colour of its own draws in the series' — which is what "one
// colour per series" means once the divisions are there. Same for its texture.
export const clearDivColors = s=>{ if (s.divs) s.divs = s.divs.map(d=> ({ ...d, color: null })); };
export const clearDivTex = s=>{ if (s.divs) s.divs = s.divs.map(d=> ({ ...d, texture: null, texInv: null })); };
// The colour of a division (k) picked: the first division IS the series' colour, so
// re-colouring it re-colours the series — anything else would leave the row's own swatch
// saying otherwise.
export function setDivColor(s, k, color){
  if (k === 0) s.color = color;
  else setDiv(s, k, { color });
}
// A series' colour picked, on every series it reaches (figure.js samePositionSeries): a bar
// reaches it only where colour says series rather than division, so its divisions take
// the colour with it.
export function setColors(list, color){
  for (const t of list){
    t.color = color;
    if (t.kind === 'bar') clearDivColors(t);
  }
}
// The bars' divisions with no colour (or no fill) of their own: by division turned off.
export const clearBarColors = F=> F.series.forEach(s=>{ if (s.kind === 'bar') clearDivColors(s); });
export const clearBarTex = F=> F.series.forEach(s=>{ if (s.kind === 'bar') clearDivTex(s); });
// A series' divisions' colours, in order; the figure's as the palette would keep them (a
// bar read by division its divisions', the rest their series').
export const divColors = s=> divsOf(s).map((_, k)=> divColor(s, k));
export const colorsInUse = F=> F.series.flatMap(s=> s.kind === 'bar' && F.palByDiv ? divColors(s) : [s.color]);

// A fill as its picker opens on it: the series' own (dk none) or a division's.
export const fillOf = (s, dk)=> dk == null
  ? { texture: s.texture || 'solid', inv: !!s.texInv }
  : { texture: divTexture(s, dk), inv: divInv(s, dk) };
// A fill picked (st): the series' own takes it over every division's (and stops the
// texture palette re-spreading over it: picked by hand); a division's is its own.
export function setFill(F, s, dk, st){
  if (dk == null){
    s.texture = st.texture; s.texInv = st.inv;
    clearDivTex(s);
    F.texPalette = null;
  } else setDiv(s, dk, { texture: st.texture, texInv: st.inv });
}

/* A rich field's text (value) with the selection a..b replaced by text, or wrapped as
   wrap{…} (^ raised, _ lowered): the new text, and the caret after what went in —
   inside the braces when an empty selection was wrapped, ready to type. */
export function richInsert(value, a, b, text, wrap){
  const sel = value.slice(a, b);
  const ins = wrap ? `${wrap}{${sel}}` : text;
  return { value: value.slice(0, a) + ins + value.slice(b), caret: a + ins.length - (wrap && !sel ? 1 : 0) };
}
