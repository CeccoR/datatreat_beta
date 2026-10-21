import { esc, barNames, barChipYmax } from './utils.js';
import { Plot } from './plot.js';

/* =========================================================
   MODULE CHARTS
   The plot pieces the analysis modules (DRS, GC, EPR) share: a plot's box with its
   download button, the legends, the zoom kept across a redraw, the chips that choose
   which series a chart shows, and the chart of one value per sample (GC's mean rates,
   DRS's E_g and E_U), each written once.
========================================================= */
// The download glyph of a plot's button, and the CSV one of a table's (utils' DL_SVG is
// the file list's: another class, which fitPlotIcons does not size).
export const PLOT_DL_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="15"/><polyline points="7 10.5 12 15.5 17 10.5"/><line x1="5" y1="20" x2="19" y2="20"/></svg>`;
export const CSV_ICON = `<svg class="plot-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="11" font-size="8.5" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" style="font-family:sans-serif">CSV</text><line x1="6" y1="18" x2="15" y2="18"/><polyline points="12.5 15.5 16 18 12.5 20.5"/></svg>`;
/* A plot's box: its svg (`id`, classes beside "plot" in `cls`), what goes over it
   (`extra`: chips), and its download button, which names the SVG `name` (the id's own by
   default) with the legend `legend` and, given `csv`, offers the module's CSV of that
   name (renamed after the card by nameDownloads). */
export const plotWrap = (id, { legend, mod, csv, name = id + '.svg', cls = '', extra = '' })=> `
            <div class="plot-wrap">
              <svg class="plot${cls ? ' ' + cls : ''}" id="${id}"></svg>${extra}
              <button class="btn plot-dl-btn" data-dl-svg="${id}"${csv ? ` data-csv-mod="${mod}" data-csv-names="${csv}"` : ''} data-dl-name="${name}" data-dl-legend="${legend}">${PLOT_DL_ICON}</button>
            </div>`;
// A legend of the samples: each one's colour and label.
export const swatchLegend = list => list.map(f=> `<span><i style="background:${esc(f.color)}"></i>${esc(f.label)}</span>`).join('');

/* The zoom a plot is at, to keep across a redraw that builds it anew or sets its range
   again (null with no plot drawn yet), and that zoom put back after the range is set: only
   on the data it was set on, `key` naming them (the files shown, in order) and the full
   range just set the one the plot had. Else the plot shows the full range: to v494 a card
   unfolded kept the zoom it had folded, on files since removed, moved, left out or
   changed. */
const homeOf = p => [p._origXmin, p._origXmax, p._origYmin, p._origYmax];
export const viewOf = p => p && isFinite(p.xmin) ? { xmin: p.xmin, xmax: p.xmax, ymin: p.ymin, ymax: p.ymax, home: homeOf(p), key: p._viewKey } : null;
export function setView(p, v, key = ''){
  const home = homeOf(p);
  p._viewKey = key;
  if (v && v.key === key && v.home.every((x, i)=> x === home[i])) Object.assign(p, { xmin: v.xmin, xmax: v.xmax, ymin: v.ymin, ymax: v.ymax });
}
// The key of a plot's data (setView): the files it shows, in order.
export const viewKey = list => list.map(f=> f.name).join('\n');

/* The chips over a chart choosing which of its series it shows (GC's gases, DRS's two
   E_g and two E_U): a chip per option, on while its series is shown (`shown`, keys),
   disabled while the data cannot give it (`can`, the title then `why`). The only one on
   cannot be switched off: its title says so. `cls` the chips' own class, `data` their
   data attributes, `name` an option as the titles write it. */
export function chipRow(opts, shown, { cls, data, name = o=> o.label, can = ()=> true, why = ()=> '' }){
  return opts.map(o=>{
    const on = shown.includes(o.key), ok = can(o);
    const title = !ok ? why(o) : on && shown.length === 1 ? `${name(o)} — the only one shown` : `Show / hide ${name(o)}`;
    return `<button type="button" class="mode-chip ${cls}${on ? ' is-on' : ''}" ${data(o)} title="${esc(title)}"${ok ? '' : ' disabled'}>${o.label}</button>`;
  }).join('');
}
/* A chip clicked: the choice `sel` (keys, of all of them `keys`) with `key` switched, from
   what is on show (`shown`); null when it is the only one on, which stays. Switched off,
   what was on show stays chosen (a fallback the chart showed included), and so does a
   choice the data cannot give now, for when they can. */
export function toggleChip(keys, sel, shown, key){
  const on = shown.includes(key);
  if (on && shown.length === 1) return null;
  return keys.filter(k=> on ? k !== key && (sel.includes(k) || shown.includes(k)) : k === key || sel.includes(k));
}

/* A chart of a value per sample (`cats`, each { label, name }) ± its error, its series
   (`series`: { name, color, vals[], errs[] }) side by side in each sample's slot: GC's
   mean rates and DRS's E_g and E_U, which were two copies of it. A value is drawn when
   `ok` takes it, with its label ("v±e", `digits` decimals) above it, clear of the plot's
   chips (`chips`, their element, if it has one); a sample with none has no name under the
   axis. The names are cut and tilted to fit (barNames), the bottom margin made for them
   (the data area shrinks, the chart keeps its size), the top for the labels. Nothing to
   draw draws nothing: returns whether it drew, and then writes the series' legend. */
export function valueBars(svg, { cats, series, ok = v=> isFinite(v), digits, yLabel, chips, legend }){
  const n = cats.length, vals = series.flatMap(m=> m.vals).filter(ok);
  if (!vals.length) return false;
  const has = k => series.some(m=> ok(m.vals[k]));
  const errOf = (m, k)=> m.errs ? m.errs[k] : NaN;
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const rect = svg.getBoundingClientRect();
  const svgW = rect.width || 640, svgH = rect.height || 640;
  const fit = barNames(mctx, cats.map(c=> c.label), Math.max(60, svgW - 75), 55, cats.map((c, k)=> has(k)));
  let maxLbl = 0;
  fit.labels.forEach((lbl, k)=>{ if (has(k)) maxLbl = Math.max(maxLbl, mctx.measureText(lbl).width); });
  const bottom = Math.round(26 + maxLbl*fit.sin);
  // The value's label, vertical above its bar (and error), with headroom kept for it.
  const label = (v, e)=> isFinite(e) ? `${v.toFixed(digits)}±${e.toFixed(digits)}` : v.toFixed(digits);
  const topOf = (v, e)=> v + (isFinite(e) ? e : 0);
  let maxValW = 0, maxTop = 0;
  for (const m of series) for (let k = 0; k < n; k++){
    const v = m.vals[k], e = errOf(m, k);
    if (ok(v)){ maxValW = Math.max(maxValW, mctx.measureText(label(v, e)).width); maxTop = Math.max(maxTop, topOf(v, e)); }
  }
  const mTop = 15, gap = 6, plotH = svgH - mTop - bottom, reserve = gap + maxValW + 6;
  const frac = plotH > reserve ? (1 - reserve/plotH) : 0.5;
  // Fixed at [0, n+1]: the names are made to fit it, not the other way round. Widths
  // shrink so a pair still fits its slot.
  const x0 = 0, x1 = n + 1, pair = series.length > 1, pxSlot = (svgW - 75) / (x1 - x0);
  const hw = pair ? Math.min(11, pxSlot*0.22) : Math.min(16, pxSlot*0.3);
  const dx = pair ? Math.min(12, pxSlot*0.24) : 0;
  const offOf = mi => (mi - (series.length - 1)/2) * dx * 2;
  const underChips = [];
  for (let k = 0; k < n; k++) series.forEach((m, mi)=>{ const v = m.vals[k], e = errOf(m, k);
    if (ok(v)) underChips.push({ x: k+1, dx: offOf(mi), top: topOf(v, e), w: mctx.measureText(label(v, e)).width }); });
  const ymax = Math.max(Math.max(...vals)*1.2, maxTop/frac,
    barChipYmax(chips, svg, underChips, { W: svgW, ml: 55, mr: 20, mTop, plotH, gap, x0, x1 }));
  const bp = new Plot(svg, { xlabel: '', ylabelSvg: yLabel, noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: mTop, b: bottom } });
  bp.setRange(x0, x1, 0, ymax || 1);
  bp.drawAxes();
  for (let k = 0; k < n; k++){
    if (!has(k)) continue;
    series.forEach((m, mi)=>{
      const v = m.vals[k], e = errOf(m, k);
      if (!ok(v)) return;
      const off = offOf(mi);
      // Named by its series, as the legend names it: the figure composer sees one series
      // of bars, the samples told apart by their place on the axis.
      bp.barPx(k+1, 0, v, m.color, hw, off, { label: m.name });
      if (isFinite(e)) bp.errbar(k+1, v, e, off);
      bp.barLabel(k+1, topOf(v, e), label(v, e), { gap, dx: off });
    });
    bp.tickLabel(k+1, fit.labels[k], fit.rot, cats[k].label, cats[k].name);
  }
  bp.attachTools(svg.closest('.plot-wrap'));
  if (legend) legend.innerHTML = series.map(m=> `<span><i class="mk-box" style="background:${esc(m.color)}"></i>${esc(m.name)}</span>`).join('');
  return true;
}
