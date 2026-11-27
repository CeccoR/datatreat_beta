/* =========================================================
   CUSTOM — its words and markup that need no page (fig.js puts them in the Data card, the
   Plot cards and the Add series window; tests/figmodel.test.mjs reads them in Node): a
   Plot card's instructions and body, a series' row with its operations, the Data card's
   head (the series' names over their columns, the roles, the header) and table, its
   warning, the legends, the Add series window and its files. Taken out of v561's fig.js
   as they were: the same markup to the byte.
   What they need from the page is handed in, u = { esc, X_SVG, plotWrap } (utils.js's esc
   and close icon, modcharts.js's plot box: fig.js HU), and the cards' own instructions
   (cards.js cardInfo) where a card's end with them.
========================================================= */
import { ROLES, NORMS, tableOf } from './fig-model.js';

/* ---- A Plot card's instructions (ending with the cards' own: `tail`, cards.js cardInfo) ---- */
export const figInfo = tail => `A plot of the series chosen under <b>Series</b>, from any of the files: <b>+ Add series</b> opens the list of the series included in the trace list (each y the Data card sets is a trace), by file, each named as the Data card names it: those ticked are in the plot (a file's box ticks or clears all its series). <b>Normalization</b> is the plot's: <b>none</b>, <b>local</b> (each series divided by its own largest |y|) or <b>global</b> (all divided by the largest of them); then each series is multiplied by its scale (×) and, in an XY plot, its offset (+) added. An <b>XY plot</b> draws each series against its x (the row number where it has none), with its error bars. A <b>bar chart</b> takes the series' x as categories (text, or numbers as they read: 1,0 is 1), its y as the bar and its error of y as the error bar; a category shared by series has their bars side by side. A <b>box plot</b> takes each series as a group, its values down the rows (its x not used), named as the series. A series whose file is removed, or whose column is no longer a y, leaves the plot. The figure composer of the plot's toolbar composes its figure, kept with the card in the project. ${tail}`;
// A card's elements' ids' prefix.
export const P = a => 'fig' + a.id;
/* (v531: as the Data card, a .pside: the plot on the left under its row of tools, the column
   beside it spanning the plot's height exactly: its head and normalisation at the top, the
   series scrolling in their box, + Add series at the foot, its bottom on the plot's; with
   no series yet, an empty box of the plot's size in its place) */
export const cardBody = (a, u)=> `
      <div class="pside fig-pside">
        <div class="plot-nav-row pside-nav"></div>
        <div class="pside-plot" id="${P(a)}Box">${u.plotWrap(P(a) + 'Svg', { mod: 'fig', csv: 'fig_plot.csv', name: 'Plot.svg', legend: P(a) + 'Legend' })}
          <div class="txt-meta fig-empty" id="${P(a)}Empty">No series in this plot yet: + Add series picks them.</div>
        </div>
        <div class="pside-under"><div id="${P(a)}Legend" class="legend"></div></div>
        <div class="pside-col fig-side">
          <div class="txt-mini param-head cap-title"><span>Series</span></div>
          <div class="param-grid">
            <label class="txt-label" for="${P(a)}Norm">Normalization</label>
            <select id="${P(a)}Norm" class="pg-field" title="none: the data as they are; local: each series divided by its own largest |y|; global: all by the largest of them">${Object.entries(NORMS).map(([k, l])=> `<option value="${k}">${l}</option>`).join('')}</select>
          </div>
          <div class="fig-scroll fig-ser-list" id="${P(a)}List"></div>
          <button type="button" class="btn plot-action-btn" id="${P(a)}Add" title="Choose the series of this plot, by file">+ Add series</button>
        </div>
      </div>`;
// A field of an operation, its value as the record holds it.
const opField = (k, label, v, title, u)=> `<label class="fig-op" title="${title}"><span>${label}</span><input type="text" inputmode="decimal" autocomplete="off" data-op="${k}" value="${u.esc(String(v))}"></label>`;
/* A card's series (list: fig-model.js plotted), a row each, as the parameters': the name on
   three fifths, the scale and offset (ops, its kind's) on two; those of its series left out
   of the analysis counted under them. */
export const serListHtml = (a, list, ops, u)=> list.map(({ r, s, name })=> `
          <div class="fig-ser" data-key="${u.esc(s.key)}">
            <div class="fig-ser-head"><button type="button" class="an-ic fig-ser-x" data-act="del" title="Take this series out of the plot" aria-label="Take ${u.esc(name)} out of the plot">${u.X_SVG(13)}</button>
              <span class="fig-ser-name" title="${u.esc(`${s.f.label}: ${s.auto} (${s.cols})`)}">${u.esc(name)}</span></div>
            <div class="fig-ops">${ops.includes('scale') ? opField('scale', '×', r.scale, 'Scale: every value multiplied by it, after the normalization', u) : ''}${
              ops.includes('offset') ? opField('offset', '+', r.offset, 'Offset: added to every y, after the scale', u) : ''}</div>
          </div>`).join('') + (a.series.length > list.length ? `<div class="txt-meta fig-ser-out">${a.series.length - list.length} series left out of the analysis not shown.</div>` : '');
// A plot's legend (a bar chart's is valueBars'): a box plot's marks boxes.
export const legendHtml = (type, list, u)=> list.map(e=> `<span><i${type === 'box' ? ' class="mk-box"' : ''} style="background:${e.color}"></i>${u.esc(e.name)}</span>`).join('');

/* ---- The Data card ----
   The line of the series' names over the head: each series' name over its columns (its
   x, its y, their errors), one cell across them, a field where it is typed over (v534:
   to v533 the names were also listed beside the table); a column no series has, or an x
   (or its error) that several share, blank. A series whose columns another's split has
   its name over each of its runs. */
export function nameCells(ss, n, u){
  const by = Array.from({ length: n }, ()=> new Set());
  ss.forEach((s, k)=> [s.x, s.ex, s.col, s.ey].forEach(c=>{ if (c >= 0 && c < n) by[c].add(k); }));
  const own = by.map(b=> b.size === 1 ? [...b][0] : -1), out = [];
  for (let c = 0; c < n;){
    let e = c + 1;
    while (e < n && own[e] === own[c]) e++;
    const span = e - c > 1 ? ` colspan="${e - c}"` : '';
    if (own[c] < 0) out.push(`<th${span}></th>`);
    else {
      const s = ss[own[c]], tip = `${s.auto} (${s.cols})`;
      out.push(`<th${span} class="fig-name"><input type="text" class="fig-name-in" data-col="${s.col}" value="${u.esc(s.name)}" placeholder="${u.esc(s.def)}" title="${u.esc(tip)}" aria-label="${u.esc(`Name of ${tip}`)}" autocomplete="off" spellcheck="false"></th>`);
    }
    c = e;
  }
  return out.join('');
}
const roleSel = (r, c)=> `<select data-col="${c}" aria-label="Role of column ${c + 1}">${Object.entries(ROLES).map(([k, l])=> `<option value="${k}"${k === r ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
// The head: the series' names over their columns (ss: the file's series), the roles, the header.
export const headHtml = (ss, roles, t, u)=> `<tr class="fig-names">${nameCells(ss, t.n, u)}</tr><tr class="fig-roles">${roles.map((r, c)=> `<th>${roleSel(r, c)}</th>`).join('')}</tr>`
  + (t.head ? `<tr class="fig-hd">${t.head.map(h=> `<th>${u.esc(h)}</th>`).join('')}</tr>` : '');
// The table: the head over every row of the file's.
export const tableHtml = (t, head, u)=> `<table class="fig-cols"><thead>${head}</thead><tbody>`
  + t.rows.map(r=> `<tr>${r.map(c=> `<td>${u.esc(c)}</td>`).join('')}</tr>`).join('') + `</tbody></table>`;
// (the roles of all files alike: a file with fewer columns (short) than the one on show (f, its table t) said)
export const warnHtml = (short, f, t, u)=> short.length ? `<div class="alert warn">⚠ Same roles for all files: ${short.map(g=> u.esc(`${g.label} has ${tableOf(g).n} column${tableOf(g).n > 1 ? 's' : ''}`)).join(', ')}, fewer than the ${t.n} of ${u.esc(f.label)}; the roles of the columns past its own do not apply to it.</div>` : '';

/* ---- Add series: a window of the series of every file included, by file (by: fig-model.js
   pickGroups), those of the plot (on, by key) ticked ---- */
export const PICK_HTML = `<div class="modal-box fig-pick-box" role="dialog" aria-modal="true" aria-label="Add series" tabindex="-1">
      <h3 class="txt-head" style="margin:0 0 4px">Add series</h3>
      <p class="txt-meta fig-pick-for" style="margin:0 0 8px"></p>
      <div class="fig-pick-body"></div>
      <div class="dt-modal-foot"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-done>Done</button></div>
    </div>`;
export const pickFor = name => `Ticked: the series of ${name}.`;
export const pickBodyHtml = (by, on, u)=> [...by].map(([f, ss])=> `
        <div class="fig-pick-file">
          <label class="fig-pick-row fig-pick-head"><input type="checkbox" data-file aria-label="All the series of ${u.esc(f.label)}"><b>${u.esc(f.label)}</b></label>
          ${ss.map(s=> `<label class="fig-pick-row"><input type="checkbox" data-key="${u.esc(s.key)}"${on.has(s.key) ? ' checked' : ''}><span>${u.esc(s.auto)} <span class="txt-meta">(${u.esc(s.cols)})</span></span><span class="fig-pick-name">${u.esc(s.name)}</span></label>`).join('')}
        </div>`).join('');
