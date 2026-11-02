import { esc, registerModule, keeper, fixed, objId, exactKey, colorOf, settings, flashFieldInvalid, boxStats, meanArr, stdArr, barNames, X_SVG } from './utils.js';
import { Plot } from './plot.js';
import { cardInfo, fileSafe, nameDownloads } from './cards.js';
import { moduleKit, wideCsv, isObj, ownKey, cardList } from './modkit.js';
import { plotWrap, viewOf, setView, valueBars } from './modcharts.js';
import { decodeText, textLines, readColumns, parseNum, isNum, nameUnit } from './textdata.js';

/* =========================================================
   CUSTOM MODULE (v527; named Figure to v530: its key, 'fig', and its projects' kept)

   Plots of the user's own tables: CSV and text files of columns, read as DRS and GC read
   theirs (textdata.js: the encoding, the separator, the decimal mark, the quotes and the
   header found from the file). The Data card shows one file's head, the header and its
   first rows, a role over each column (x, y, its errors, or none) as Origin gives them;
   each y is a series, with the x before it and its errors. The Plot cards (cards.js),
   none at first, each an XY plot, a bar chart or a box plot of series of any files, its
   normalisation, each series' scale (and an XY plot's offset), and the plot's figure
   composed (figure.js) kept with the card in the project.
   v529: the Data card as the other modules' analysis cards (the file's arrows, the head on
   the left, the series' names and the roles' box on the right); a file's line of series'
   titles giving its first roles and its names; the Plot cards' series picked in a window
   (Add series), one normalisation a plot (none, local, global) for the per-series one, no
   crop in x.
   v531: the Data card's table whole, in a box of a Plot card's chart's size scrolling both
   ways, under a line of the series' names over their columns; the roles' box on the
   file's line; the lists of series scrolling in their boxes, beside the table or the plot
   from its top to its foot (+ Add series under its list, its bottom on the plot's); a
   series' scale and offset beside its name.

   MADE PER TAB, as every module (utils.js registerModule): createFig is the module's
   factory, each open Custom tab that is awake an instance of its own, made of its copy of
   index.html's section (root) and a layer (the kinds' menu). Its elements are found in
   root, a card's in its card, never in the page. It draws only on show, and its redraw
   draws all as it is shown; a tab shown again with nothing changed and at the same width
   draws nothing (its draw key). It has no job that runs on while hidden.
========================================================= */

/* ---- A file's table (pure: the module's, for every instance) ----
   Read from its bytes, which are all a project keeps of it (beside its roles and its
   series' names): kept by those bytes (the same array in a tab's states, its record and
   another tab holding the file), so an undo, a wake or a project opened reads it once.
   Its columns of numbers (each cell as parseNum reads it, NaN where it is none) fixed
   (db.js): shared, never changed. */
const tables = new WeakMap();
function readTableText(text){
  const t = readColumns(textLines(text));
  if (!t) return null;
  return { ...t, heads: t.head ? t.head.map(nameUnit) : null,
    nums: Array.from({ length: t.n }, (_, c)=> fixed(t.rows.map(r=> parseNum(r[c])))) };
}
function tableOf(f){
  const b = f && f.rawBytes;
  if (!(b instanceof Uint8Array)) return null;
  if (!tables.has(b)) tables.set(b, readTableText(decodeText(b)));
  return tables.get(b);
}

/* ---- The columns' roles (Origin-like) ----
   x, y, an error of x, an error of y, or none (''). Several x may be: each y belongs to the
   x before it (none: the row number is its x), each error of y to the y before it, each
   error of x to the x before it; one error at most a column. By default the first column
   is x and the others y. */
const ROLES = { x: 'x', y: 'y', ex: 'err x', ey: 'err y', '': '—' };
const defRoles = n => Array.from({ length: n }, (_, i)=> i ? 'y' : 'x');
/* Roles made to hold: an error with no column of its own before it, or one past the first
   of its column, a y. */
function fixRoles(r){
  const out = r.slice();
  let hasX = false, hasY = false, exUsed = false, eyUsed = false;
  out.forEach((v, i)=>{
    if (v === 'x'){ hasX = true; exUsed = false; }
    else if (v === 'y'){ hasY = true; eyUsed = false; }
    else if (v === 'ey'){ if (!hasY || eyUsed){ out[i] = 'y'; hasY = true; eyUsed = false; } else eyUsed = true; }
    else if (v === 'ex'){ if (!hasX || exUsed){ out[i] = 'y'; hasY = true; eyUsed = false; } else exUsed = true; }
  });
  return out;
}
/* Column i given role v: an error set where its column already had one turns that one,
   the error it had, into a y (and the roles made to hold: fixRoles). */
function setRole(roles, i, v){
  const r = roles.slice();
  r[i] = v;
  if (v === 'ey' || v === 'ex'){
    const base = v === 'ey' ? 'y' : 'x';
    let o = i - 1;
    while (o >= 0 && r[o] !== base) o--;
    if (o >= 0) for (let j = o + 1; j < r.length && r[j] !== base; j++) if (j !== i && r[j] === v) r[j] = 'y';
  }
  return fixRoles(r);
}
// The series of some roles, one a y: its column, its x (-1: the row number) and errors (-1: none).
// (an x's error is its own wherever it stands after it, before the next x)
function seriesCols(roles){
  const out = [], exOf = new Map();
  let x = -1, last = null;
  roles.forEach((v, i)=>{
    if (v === 'x') x = i;
    else if (v === 'ex'){ if (x >= 0) exOf.set(x, i); }
    else if (v === 'y') out.push(last = { col: i, x, ey: -1 });
    else if (v === 'ey' && last) last.ey = i;
  });
  return out.map(s=> ({ ...s, ex: exOf.has(s.x) ? exOf.get(s.x) : -1 }));
}
// The roles of `src` given to a file of n columns, by position; those beyond it as by default.
const rolesLike = (src, n)=> fixRoles(defRoles(n).map((d, c)=> c < src.length ? src[c] : d));
/* A file's first roles: with a line of series' titles over its header (textdata.js
   readColumns), each title opens a group, its first column the x and the others, up to the
   next title, its y ("series 1",,,"series 2": x y y x); else the defaults. */
const firstRoles = t => t.titles ? fixRoles(t.titles.map(v=> v !== '' ? 'x' : 'y')) : defRoles(t.n);
/* A column's name from the titles: its group's title, with the column's own name when the
   group has several columns past its x ('' with no titles). */
function titleName(t, c){
  if (!t.titles) return '';
  let g = c;
  while (g >= 0 && t.titles[g] === '') g--;
  if (g < 0) return '';
  let end = g + 1;
  while (end < t.n && t.titles[end] === '') end++;
  const h = t.heads && t.heads[c] && t.heads[c].name;
  return end - g > 2 ? `${t.titles[g]} – ${h || 'column ' + (c + 1)}` : t.titles[g];
}

/* ---- What a series plots: its values divided by the plot's normalisation (`div`: 1 for
   none, its own largest |y| for local, the largest of the plot's series for global), then
   multiplied by its scale, and, in an XY plot, its offset added. A bar chart's and a box
   plot's have no offset. To v528 each series had its own normalisation, and an XY plot's
   series a crop in x. Kept by the series' column (utils.js keeper: while a state, a tab
   asleep or a history holds the file) under its other columns and its operations: a tab
   woken, an undo, a redraw and the CSVs take it as made. ---- */
const OPS = { xy: ['scale', 'offset'], bar: ['scale'], box: ['scale'] };
const DEF_OPS = { scale: 1, offset: 0 };
const NORMS = { none: 'None (data as they are)', local: 'Local (max of each)', global: 'Global (max of all)' };
const dataKept = keeper('fig-series', 8);
const maxAbs = a =>{ let m = 0; for (const v of a) if (Math.abs(v) > m) m = Math.abs(v); return m; };
function dataOf(kind, t, s, r, div = 1){
  const o = { div, scale: r.scale, offset: kind === 'xy' ? r.offset : 0 };
  return dataKept(t.nums[s.col], exactKey([kind, objId(t), s.x, s.ex, s.ey, o]), ()=>{
    const Y = t.nums[s.col], X = s.x >= 0 ? t.nums[s.x] : null, EX = s.ex >= 0 ? t.nums[s.ex] : null, EY = s.ey >= 0 ? t.nums[s.ey] : null;
    const xs = [], ys = [], exs = [], eys = [], cats = [];
    for (let i = 0; i < Y.length; i++){
      const y = Y[i], x = X ? X[i] : i + 1;
      if (!Number.isFinite(y)) continue;
      if (kind === 'xy' && !Number.isFinite(x)) continue;
      xs.push(x); ys.push(y);
      exs.push(EX && Number.isFinite(EX[i]) ? Math.abs(EX[i]) : NaN);
      eys.push(EY && Number.isFinite(EY[i]) ? Math.abs(EY[i]) : NaN);
      if (kind === 'bar') cats.push(s.x < 0 ? String(i + 1) : Number.isFinite(X[i]) && isNum(t.rows[i][s.x]) ? String(X[i]) : String(t.rows[i][s.x]).trim());
    }
    const m = o.scale / o.div;
    return { xs, ys: ys.map(v=> v*m + o.offset), exs, eys: eys.map(e=> e*Math.abs(m)), cats };
  });
}
// A plot's series' divisors (dataOf `div`) under its normalisation.
function divsOf(kind, norm, list){
  if (norm !== 'local' && norm !== 'global') return list.map(()=> 1);
  const peaks = list.map(e=> maxAbs(dataOf(kind, e.s.t, e.s, DEF_OPS).ys));
  const all = Math.max(0, ...peaks);
  return peaks.map(p=> (norm === 'local' ? p : all) || 1);
}

/* ---- An axis's title: the columns' name and unit when those that have them share them ---- */
function axisTitle(parts){
  parts = parts.filter(p=> p.name || p.unit);
  const names = [...new Set(parts.map(p=> p.name))], units = [...new Set(parts.map(p=> p.unit))];
  const name = names.length === 1 ? names[0] : '', unit = units.length === 1 ? units[0] : '';
  return name && unit ? `${name} (${unit})` : name || (unit ? `(${unit})` : '');
}
// A value as a plot's label writes it (3 significant digits), and as a CSV does (12, and
// the decimal mark of the Settings).
const sig = v => String(+v.toPrecision(3));
const num = v => Number.isFinite(v) ? String(+v.toPrecision(12)).replace('.', settings.decimal) : '';
const headOf = (t, c)=> c < 0 ? { name: 'Row', unit: '' } : t.heads && t.heads[c] ? t.heads[c] : { name: '', unit: '' };

/* ---- A card's kinds, instructions and markup ---- */
const KINDS = { xy: 'XY plot', bar: 'Bar chart', box: 'Box plot' };
const FIG_INFO = `A plot of the series chosen under <b>Series</b>, from any of the files: <b>+ Add series</b> opens the list of the series of every file included (the Data card sets which columns are y), by file, each named as the Data card names it: those ticked are in the plot (a file's box ticks or clears all its series). <b>Normalization</b> is the plot's: <b>none</b>, <b>local</b> (each series divided by its own largest |y|) or <b>global</b> (all divided by the largest of them); then each series is multiplied by its scale (×) and, in an XY plot, its offset (+) added. An <b>XY plot</b> draws each series against its x (the row number where it has none), with its error bars. A <b>bar chart</b> takes the series' x as categories (text, or numbers as they read: 1,0 is 1), its y as the bar and its error of y as the error bar; a category shared by series has their bars side by side. A <b>box plot</b> takes each series as a group, its values down the rows (its x not used), named as the series. A series whose file is removed, or whose column is no longer a y, leaves the plot. The figure composer of the plot's toolbar composes its figure, kept with the card in the project. ${cardInfo(true, false)}`;
const P = a => 'fig' + a.id;
/* (v531: as the Data card, a .pside: the plot on the left under its row of tools, the column
   beside it spanning the plot's height exactly: its head and normalisation at the top, the
   series scrolling in their box, + Add series at the foot, its bottom on the plot's; with
   no series yet, an empty box of the plot's size in its place) */
const cardBody = a => `
      <div class="pside fig-pside">
        <div class="plot-nav-row pside-nav"></div>
        <div class="pside-plot" id="${P(a)}Box">${plotWrap(P(a) + 'Svg', { mod: 'fig', csv: 'fig_plot.csv', name: 'Plot.svg', legend: P(a) + 'Legend' })}
          <div class="txt-meta fig-empty" id="${P(a)}Empty">No series in this plot yet: + Add series picks them.</div>
        </div>
        <div class="pside-under"><div id="${P(a)}Legend" class="legend"></div></div>
        <div class="pside-col fig-side">
          <div class="txt-mini param-head">Series</div>
          <div class="param-grid">
            <label class="txt-label" for="${P(a)}Norm">Normalization</label>
            <select id="${P(a)}Norm" class="pg-field" title="none: the data as they are; local: each series divided by its own largest |y|; global: all by the largest of them">${Object.entries(NORMS).map(([k, l])=> `<option value="${k}">${l}</option>`).join('')}</select>
          </div>
          <div class="fig-scroll fig-ser-list" id="${P(a)}List"></div>
          <button type="button" class="btn plot-action-btn" id="${P(a)}Add" title="Choose the series of this plot, by file">+ Add series</button>
        </div>
      </div>`;
// A field of an operation, its value as the record holds it.
const opField = (k, label, v, title)=> `<label class="fig-op" title="${title}"><span>${label}</span><input type="text" inputmode="decimal" autocomplete="off" data-op="${k}" value="${esc(String(v))}"></label>`;

/* ---- What a state may hold (modkit RESTORED) ---- */
const finiteOr = (v, d)=> Number.isFinite(v) ? v : d;
const refsOk = v => Array.isArray(v) ? v.filter(r=> isObj(r) && typeof r.file === 'string' && Number.isInteger(r.col) && r.col >= 0) : [];
// (a v527–v528 series' own normalisation and crop let go: refsOk, normIn)
const refsIn = v => refsOk(v).map(r=> ({ file: r.file, col: r.col, scale: finiteOr(r.scale, 1), offset: finiteOr(r.offset, 0) }));
/* A plot's normalisation; a v527–v528 card has none, its series theirs: local when every
   one was normalised (an XY plot's or a bar chart's), else none. */
function normIn(c){
  if (ownKey(NORMS, c.norm)) return c.norm;
  const rs = refsOk(c.series);
  return c.norm === undefined && (c.type === 'xy' || c.type === 'bar') && rs.length && rs.every(r=> r.norm === true) ? 'local' : 'none';
}
const figIn = v => isObj(v) && isObj(v.scalars) && Array.isArray(v.series) ? v : null;

// A Custom tab's instance (utils.js makeInstance: ctx { key, root, layer, shown }).
function createFig({ key, root, layer, shown }){
  const $ = id => root.querySelector('#' + id);
  // Hidden, nothing is drawn: `stale` marks it to be drawn whole as it is shown, `drawnAt`
  // the width it was last drawn whole at (its draw key).
  let stale = false, drawnAt = '';
  const drawable = ()=> shown() || !(stale = true);
  /* The module (modkit.js): every file loaded, in list order, { name, label, color,
     rawBytes, roles (a role a column), names (the series' names typed, by column) }, and
     the included ones, `files`; the cards' series and figures in the history, and whether
     the roles of the file on show go to every file (`same`). */
  let same = false;
  let shownName = null, fileNext = null;   // the file the Data card shows (and a wake's: showNext)
  const kit = moduleKit('fig', {
    root, key, layer,
    // (a file's colour is no series': the list keeps its place, empty)
    noColor: true,
    alerts: p =>{ $('figAlerts').innerHTML = p.invalid + p.upload; },
    refresh: afterFilesChange,
    // A label or a colour changed: the Data card's list and the series' files say it anew.
    redraw: ()=>{ renderData(); cards().forEach(a=> paintPanel(a)); updateAll(true); },
    cleared: ()=>{ shownName = null; },
    snapshot: ()=> ({ same, cards: cards().map(a=> ({ ...deck.saved(a), series: a.series.map(r=> ({ ...r })), norm: a.norm, fig: a.fig })) }),
    // A file as a restore takes it: its table read from its bytes (none: left out), its
    // roles one a column (else the defaults) made to hold, its names by column.
    file: f =>{
      const t = tableOf(f);
      if (!t) return null;
      const roles = Array.isArray(f.roles) && f.roles.length === t.n && f.roles.every(r=> ownKey(ROLES, r)) ? fixRoles(f.roles) : firstRoles(t);
      const names = {};
      if (isObj(f.names)) for (const k of Object.keys(f.names)) if (/^\d+$/.test(k) && +k < t.n && typeof f.names[k] === 'string' && f.names[k].trim()) names[k] = f.names[k];
      return { ...f, roles, names };
    },
    restore: s =>{
      same = s.same === true;
      if (fileNext){ if (allFiles.some(f=> f.name === fileNext)) shownName = fileNext; fileNext = null; }
      deck.load(cardList(s.cards, KINDS) || [], c=> ({ series: refsIn(c.series), norm: normIn(c), fig: figIn(c.fig) }), a=> paintPanel(a));
    },
    redrawTab: ()=>{
      const at = String(root.clientWidth);
      if (!stale && at === drawnAt) return;
      stale = false; drawnAt = at;
      if (allFiles.length){ deck.fitNames(); updateAll(true); }
    },
    // One CSV a plot with series, named after it: what it plots.
    csv: ()=> cards().map(a=> ({ a, text: cardCsv(a) })).filter(c=> c.text).map(({ a, text })=> ({ name: `${fileSafe(a.name)} - fig_plot.csv`, text })),
  });
  const { all: allFiles, files } = kit;

  // Files dropped: each read as a table (textdata.js), its roles its titles' or the
  // defaults (firstRoles), or the file on show's with `same`; the table kept by the file's bytes.
  kit.dropText(text =>{
    const t = readTableText(text);
    return t ? { roles: firstRoles(t), names: {}, table: t } : { error: 'no column of numbers found' };
  }, had =>{
    allFiles.slice(had).forEach(f=>{ tables.set(f.rawBytes, f.table); delete f.table; });
    const src = shownFile();
    if (same && src) allFiles.slice(had).forEach(f=>{ if (f !== src) f.roles = rolesLike(src.roles, tableOf(f).n); });
    afterFilesChange();
  });

  function afterFilesChange(){
    kit.showFiles();
    $('figAnalyses').style.display = allFiles.length ? 'block' : 'none';
    prune();
    renderData();
    cards().forEach(a=> paintPanel(a));
    updateAll();
    kit.commit();
  }

  /* ---- The series: every y of every file, by its file and column. Its number in its file
     ("Series M (Cols a,b)": its x's column and its own) follows the roles; its name is
     the one typed, else its title's (titleName), its header's, or "Series M". ---- */
  const keyOf = (name, col)=> name + '\n' + col;
  function seriesOfFile(f, fi){
    const t = tableOf(f);
    return seriesCols(f.roles).map((s, m)=>{
      const auto = `Series ${m + 1}`, cols = s.x >= 0 ? `Cols ${s.x + 1},${s.col + 1}` : `Col ${s.col + 1}`;
      const given = Object.prototype.hasOwnProperty.call(f.names, s.col) ? f.names[s.col] : '';
      const def = titleName(t, s.col) || headOf(t, s.col).name || auto;
      return { ...s, f, t, fi, m, key: keyOf(f.name, s.col), auto, cols, def, name: given || def };
    });
  }
  // The series of the files included, by key.
  function seriesMap(){
    const m = new Map();
    allFiles.forEach((f, fi)=>{ if (files.includes(f)) seriesOfFile(f, fi).forEach(s=> m.set(s.key, s)); });
    return m;
  }
  /* A plot keeps the series that still are (a y of a file loaded, included or not) and lets
     the others go, without a word: a file removed, a column no longer a y. */
  function prune(){
    const ys = new Set(allFiles.flatMap(f=> seriesCols(f.roles).map(s=> keyOf(f.name, s.col))));
    cards().forEach(a=>{ if (a.series.some(r=> !ys.has(keyOf(r.file, r.col)))) a.series = a.series.filter(r=> ys.has(keyOf(r.file, r.col))); });
  }

  /* ---- The Data card: the file on show (its arrows, as the other modules' samples: a view,
     no step of the history), its head with a role over each column, and beside it its
     series' names and the roles of all files alike ---- */
  /* The line of the series' names over the head: each series' name over its columns (its
     x, its y, their errors), one cell across them; a column no series has, or an x (or its
     error) that several share, blank. A series whose columns another's split has its name
     over each of its runs. */
  function nameCells(ss, n){
    const by = Array.from({ length: n }, ()=> new Set());
    ss.forEach((s, k)=> [s.x, s.ex, s.col, s.ey].forEach(c=>{ if (c >= 0 && c < n) by[c].add(k); }));
    const own = by.map(b=> b.size === 1 ? [...b][0] : -1), out = [];
    for (let c = 0; c < n;){
      let e = c + 1;
      while (e < n && own[e] === own[c]) e++;
      const span = e - c > 1 ? ` colspan="${e - c}"` : '';
      if (own[c] < 0) out.push(`<th${span}></th>`);
      else { const s = ss[own[c]]; out.push(`<th${span} class="fig-name" title="${esc(`${s.auto} (${s.cols})`)}">${esc(s.name)}</th>`); }
      c = e;
    }
    return out.join('');
  }
  const shownFile = ()=> allFiles.find(f=> f.name === shownName) || allFiles[0] || null;
  function renderData(){
    const card = $('figDataCard');
    card.style.display = allFiles.length ? '' : 'none';
    const f = shownFile();
    if (!f) return;
    shownName = f.name;
    const fi = allFiles.indexOf(f), t = tableOf(f);
    $('figFileIdx').textContent = `${fi + 1}/${allFiles.length}`;
    $('figFileName').textContent = f.label;
    $('figFileName').title = f.name;
    $('figSame').checked = same;
    const roleSel = (r, c)=> `<select data-col="${c}" aria-label="Role of column ${c + 1}">${Object.entries(ROLES).map(([k, l])=> `<option value="${k}"${k === r ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const ss = seriesOfFile(f, fi);
    // The head: the series' names over their columns, the roles, the header. The rows, all
    // of them, built once a file shown (its table's), its scroll kept while it stays.
    const head = `<tr class="fig-names">${nameCells(ss, t.n)}</tr><tr class="fig-roles">${f.roles.map((r, c)=> `<th>${roleSel(r, c)}</th>`).join('')}</tr>`
      + (t.head ? `<tr class="fig-hd">${t.head.map(h=> `<th>${esc(h)}</th>`).join('')}</tr>` : '');
    const box = $('figHead');
    if (box._t === t && box.querySelector('thead')) box.querySelector('thead').innerHTML = head;
    else {
      box._t = t;
      box.innerHTML = `<table class="fig-cols"><thead>${head}</thead><tbody>`
        + t.rows.map(r=> `<tr>${r.map(c=> `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + `</tbody></table>`;
      box.scrollTop = 0; box.scrollLeft = 0;
    }
    $('figSeries').innerHTML = ss.length ? `<div class="param-grid">${ss.map(s=> `<label class="txt-label" for="figSN${s.col}" title="${esc(s.x >= 0 ? `x: column ${s.x + 1}, y: column ${s.col + 1}` : `y: column ${s.col + 1}, x: the row number`)}">${esc(`${s.auto} (${s.cols})`)}</label>`
      + `<input type="text" class="pg-field" id="figSN${s.col}" data-col="${s.col}" value="${esc(s.name)}" placeholder="${esc(s.def)}" autocomplete="off" spellcheck="false">`).join('')}</div>`
      : '<div class="txt-meta">No column of this file is a y: it has no series.</div>';
    // (the roles of all files alike: a file with fewer columns than the one on show said)
    const short = same ? allFiles.filter(g=> g !== f && tableOf(g).n < t.n) : [];
    $('figWarn').innerHTML = short.length ? `<div class="alert warn">⚠ Same roles for all files: ${short.map(g=> esc(`${g.label} has ${tableOf(g).n} column${tableOf(g).n > 1 ? 's' : ''}`)).join(', ')}, fewer than the ${t.n} of ${esc(f.label)}; the roles of the columns past its own do not apply to it.</div>` : '';
  }
  // The roles changed: given to every file (same), the plots' series that are gone let go.
  function rolesChanged(){
    const src = shownFile();
    if (same && src) allFiles.forEach(g=>{ if (g !== src) g.roles = rolesLike(src.roles, tableOf(g).n); });
    prune();
    renderData();
    cards().forEach(a=> paintPanel(a));
    updateAll(true);
    kit.commit();
  }
  // (the file on show: a view, no step)
  const stepFile = d =>{ const n = allFiles.length, f = shownFile(); if (n && f){ shownName = allFiles[(allFiles.indexOf(f) + d + n) % n].name; renderData(); } };
  $('figFilePrev').addEventListener('click', ()=> stepFile(-1));
  $('figFileNext').addEventListener('click', ()=> stepFile(1));
  $('figSame').addEventListener('change', e=>{ same = e.target.checked; rolesChanged(); });
  $('figHead').addEventListener('change', e=>{
    const sel = e.target.closest('select[data-col]'), f = shownFile();
    if (!sel || !f || !ownKey(ROLES, sel.value)) return;
    f.roles = setRole(f.roles, +sel.dataset.col, sel.value);
    rolesChanged();
  });
  // A series renamed: empty, or as its header names it, it goes back to that name.
  $('figSeries').addEventListener('change', e=>{
    const inp = e.target.closest('input[data-col]'), f = shownFile();
    if (!inp || !f) return;
    const col = +inp.dataset.col, v = inp.value.trim(), def = inp.placeholder, names = { ...f.names };
    if (!v || v === def) delete names[col]; else names[col] = v;
    f.names = names;
    renderData();
    cards().forEach(a=> paintPanel(a));
    updateAll(true);
    kit.commit();
  });
  $('figSeries').addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });

  /* ---- The Plot cards (cards.js): each its kind, its series (by file and column, each with
     its scale and offset), its normalisation and its figure ---- */
  // A card's series that are plotted (their files included), with their names made unique
  // in it (a name two files' series share: with the file's label) and their colours.
  function plotted(a, map = seriesMap()){
    const used = new Set();
    return a.series.map(r=> ({ r, s: map.get(keyOf(r.file, r.col)) })).filter(e=> e.s).map((e, k)=>{
      let name = e.s.name, n = 2;
      if (used.has(name)) name = `${e.s.name} (${e.s.f.label})`;
      while (used.has(name)) name = `${e.s.name} (${n++})`;
      used.add(name);
      return { ...e, name, color: colorOf(k) };
    });
  }
  // The card's normalisation and list of series (drawn whether or not on show).
  function paintPanel(a, card = deck.cardOf(a)){
    if (!card) return;
    const list = plotted(a), ops = OPS[a.type];
    card.querySelector('#' + P(a) + 'Norm').value = a.norm;
    card.querySelector('#' + P(a) + 'Add').disabled = !files.some(f=> seriesCols(f.roles).length);
    // (a row each, as the parameters': the name on three fifths, the scale and offset on two)
    card.querySelector('#' + P(a) + 'List').innerHTML = list.map(({ r, s, name })=> `
          <div class="fig-ser" data-key="${esc(s.key)}">
            <div class="fig-ser-head"><button type="button" class="an-ic fig-ser-x" data-act="del" title="Take this series out of the plot" aria-label="Take ${esc(name)} out of the plot">${X_SVG(13)}</button>
              <span class="fig-ser-name" title="${esc(`${s.f.label}: ${s.auto} (${s.cols})`)}">${esc(name)}</span></div>
            <div class="fig-ops">${ops.includes('scale') ? opField('scale', '×', r.scale, 'Scale: every value multiplied by it, after the normalization') : ''}${
              ops.includes('offset') ? opField('offset', '+', r.offset, 'Offset: added to every y, after the scale') : ''}</div>
          </div>`).join('') + (a.series.length > list.length ? `<div class="txt-meta fig-ser-out">${a.series.length - list.length} series of files left out not shown.</div>` : '');
  }
  function buildCard(a, card){
    const list = card.querySelector('#' + P(a) + 'List');
    card.querySelector('#' + P(a) + 'Add').addEventListener('click', ()=> openPick(a));
    card.querySelector('#' + P(a) + 'Norm').addEventListener('change', e=>{
      if (!ownKey(NORMS, e.target.value) || e.target.value === a.norm) return;
      a.norm = e.target.value;
      drawCard(a); kit.commit();
    });
    const refOf = el =>{ const row = el.closest('.fig-ser'); return row ? a.series.find(r=> keyOf(r.file, r.col) === row.dataset.key) : null; };
    list.addEventListener('click', e=>{
      const b = e.target.closest('[data-act="del"]'), r = b && refOf(b);
      if (!r) return;
      a.series = a.series.filter(x=> x !== r);
      paintPanel(a); drawCard(a); kit.commit();
    });
    // An operation taken as it is confirmed: a number; else the field shakes and shows the
    // record's value again.
    list.addEventListener('change', e=>{
      const el = e.target.closest('[data-op]'), r = el && refOf(el);
      if (!r) return;
      const k = el.dataset.op, raw = el.value.trim(), v = parseNum(raw);
      if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(v)){
        flashFieldInvalid(el); el.value = String(r[k]); return;
      }
      el.value = String(v);
      if (Object.is(r[k], v)) return;
      a.series = a.series.map(x=> x === r ? { ...r, [k]: v } : x);
      drawCard(a); kit.commit();
    });
    list.addEventListener('keydown', e=>{ if (e.key === 'Enter' && e.target.matches('input[type="text"]')) e.target.blur(); });
    paintPanel(a, card);
  }

  /* ---- Add series: a window of the series of every file included, by file, those of the
     plot ticked; a file's box ticks or clears all its own, and shows a square when some
     are ticked. Done gives the plot those ticked (the ones it had in their places, the new
     after them in the list's order), a step; Cancel, Escape or a click outside, nothing. ---- */
  const pick = document.createElement('div');
  pick.className = 'modal-backdrop fig-pick';
  pick.style.display = 'none';
  pick.innerHTML = `<div class="modal-box fig-pick-box" role="dialog" aria-modal="true" aria-label="Add series" tabindex="-1">
      <h3 class="txt-head" style="margin:0 0 4px">Add series</h3>
      <p class="txt-meta fig-pick-for" style="margin:0 0 8px"></p>
      <div class="fig-pick-body"></div>
      <div class="dt-modal-foot"><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-done>Done</button></div>
    </div>`;
  layer.appendChild(pick);
  const pickBody = pick.querySelector('.fig-pick-body');
  let pickFor = null, pickFrom = null;
  function openPick(a){
    if (pickFor) return;
    pickFor = a; pickFrom = document.activeElement;
    const on = new Set(a.series.map(r=> keyOf(r.file, r.col)));
    pick.querySelector('.fig-pick-for').textContent = `Ticked: the series of ${a.name}.`;
    pickBody.innerHTML = allFiles.map((f, fi)=> files.includes(f) ? [f, seriesOfFile(f, fi)] : null).filter(g=> g && g[1].length).map(([f, ss])=> `
        <div class="fig-pick-file">
          <label class="fig-pick-row fig-pick-head"><input type="checkbox" data-file aria-label="All the series of ${esc(f.label)}"><b>${esc(f.label)}</b></label>
          ${ss.map(s=> `<label class="fig-pick-row"><input type="checkbox" data-key="${esc(s.key)}"${on.has(s.key) ? ' checked' : ''}><span>${esc(s.auto)} <span class="txt-meta">(${esc(s.cols)})</span></span><span class="fig-pick-name">${esc(s.name)}</span></label>`).join('')}
        </div>`).join('');
    pickBody.querySelectorAll('.fig-pick-file').forEach(syncPickFile);
    pick.style.display = 'flex';
    document.addEventListener('keydown', onPickKey, true);
    pick.querySelector('.modal-box').focus();
  }
  // A file's box: ticked with all its series, empty with none, the square with some.
  function syncPickFile(box){
    const ss = [...box.querySelectorAll('input[data-key]')], n = ss.filter(c=> c.checked).length, all = box.querySelector('input[data-file]');
    all.checked = n === ss.length;
    all.indeterminate = n > 0 && n < ss.length;
  }
  function closePick(done){
    const a = pickFor;
    if (!a) return;
    pickFor = null;
    pick.style.display = 'none';
    document.removeEventListener('keydown', onPickKey, true);
    if (pickFrom && pickFrom.isConnected) pickFrom.focus();
    pickFrom = null;
    if (!done || !cards().includes(a)) return;
    const want = [...pickBody.querySelectorAll('input[data-key]')].filter(c=> c.checked).map(c=> c.dataset.key), set = new Set(want);
    const listed = new Set([...pickBody.querySelectorAll('input[data-key]')].map(c=> c.dataset.key)), map = seriesMap();
    // (a series of a file left out, not in the window, stays)
    const kept = a.series.filter(r=>{ const k = keyOf(r.file, r.col); return !listed.has(k) || set.has(k); });
    const had = new Set(kept.map(r=> keyOf(r.file, r.col)));
    const next = [...kept, ...want.filter(k=> !had.has(k) && map.has(k)).map(k=> ({ file: map.get(k).f.name, col: map.get(k).col, ...DEF_OPS }))];
    if (next.length === a.series.length && next.every((r, i)=> r === a.series[i])) return;
    a.series = next;
    paintPanel(a); drawCard(a); kit.commit();
  }
  function onPickKey(e){ if (e.key === 'Escape' && pick.isConnected){ e.stopPropagation(); closePick(false); } }
  pickBody.addEventListener('change', e=>{
    const box = e.target.closest('.fig-pick-file');
    if (!box) return;
    if (e.target.matches('input[data-file]')) box.querySelectorAll('input[data-key]').forEach(c=>{ c.checked = e.target.checked; });
    syncPickFile(box);
  });
  pick.addEventListener('click', e=>{
    if (e.target === pick || e.target.closest('[data-cancel]')) closePick(false);
    else if (e.target.closest('[data-done]')) closePick(true);
  });

  function named(a){
    const card = deck.cardOf(a);
    if (card) nameDownloads(card.querySelector('.plot-wrap'), `${fileSafe(a.name)}.svg`, `${fileSafe(a.name)} - fig_plot.csv`);
  }
  const deck = kit.deck({
    kinds: KINDS, title: '', info: ()=> FIG_INFO, body: cardBody, make: ()=> ({ series: [], norm: 'none', fig: null }),
    build: buildCard, drop: ()=>{}, autoName: a=> `Plot ${a.id}`, named,
    added: a=> drawCard(a),
    switched: a=>{ paintPanel(a); drawCard(a); },
    wake: a=> drawCard(a, true),
  });
  const cards = ()=> deck.records;

  // Every card unfolded drawn; a folded one as it comes back (wake).
  function updateAll(preserveView){
    cards().forEach(a=>{ if (!deck.isFolded(a)) drawCard(a, preserveView); });
    if (shown()){ stale = false; drawnAt = String(root.clientWidth); }
  }
  // (its tab not on show: not drawn, drawn whole as it is shown)
  function drawCard(a, preserveView){
    const card = deck.cardOf(a);
    if (!card || !drawable()) return;
    const list = plotted(a), svg = card.querySelector('#' + P(a) + 'Svg'), legend = card.querySelector('#' + P(a) + 'Legend');
    card.querySelector('#' + P(a) + 'Empty').style.display = list.length ? 'none' : '';
    svg.closest('.plot-wrap').style.display = list.length ? '' : 'none';
    if (!list.length){ legend.innerHTML = ''; return; }
    const prev = preserveView ? viewOf(svg._plot) : null;
    const divs = divsOf(a.type, a.norm, list), data = list.map((e, k)=> dataOf(a.type, e.s.t, e.s, e.r, divs[k]));
    if (a.type === 'xy') drawXY(svg, list, data, prev, a.norm);
    else if (a.type === 'bar') drawBars(svg, list, data, legend);
    else drawBoxes(svg, list, data);
    if (a.type !== 'bar') legend.innerHTML = list.map(e=> `<span><i${a.type === 'box' ? ' class="mk-box"' : ''} style="background:${e.color}"></i>${esc(e.name)}</span>`).join('');
    // The composer's figure kept with the card (figure.js recallKept): its closing a step.
    if (svg._plot) svg._plot.figure = {
      load: ()=> a.fig,
      save: snap =>{ if (JSON.stringify(snap) !== JSON.stringify(a.fig)){ a.fig = snap; kit.commit(); } },
    };
  }
  function drawXY(svg, list, data, prev, norm){
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    data.forEach(d=> d.xs.forEach((x, i)=>{
      const ex = d.exs[i] || 0, ey = d.eys[i] || 0, y = d.ys[i];
      x0 = Math.min(x0, x - ex); x1 = Math.max(x1, x + ex); y0 = Math.min(y0, y - ey); y1 = Math.max(y1, y + ey);
    }));
    if (!Number.isFinite(x0)){ x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
    const pad = (y1 - y0) * 0.05 || Math.abs(y1) * 0.05 || 1;
    const plot = new Plot(svg, { xlabel: axisTitle(list.map(e=> headOf(e.s.t, e.s.x))), ylabel: axisTitle(list.map(e=> headOf(e.s.t, e.s.col))) });
    plot.setRange(x0, x1, y0 - pad, y1 + pad);
    setView(plot, prev, list.map(e=> e.s.key + JSON.stringify(e.r)).join('\n') + '\n' + norm);
    plot.drawAxes();
    list.forEach((e, k)=>{
      const d = data[k], sx = [], sy = [];
      // (the error bars, segments in the series' colour: x ± its error, y ± its own)
      d.xs.forEach((x, i)=>{
        const y = d.ys[i];
        if (d.eys[i] > 0) sx.push(x, x), sy.push(y - d.eys[i], y + d.eys[i]);
        if (d.exs[i] > 0) sx.push(x - d.exs[i], x + d.exs[i]), sy.push(y, y);
      });
      if (sx.length) plot.segments(sx, sy, e.color, 1, { label: e.name + ' (errors)', key: e.s.key + '\nerr' });
      plot.line(d.xs, d.ys, e.color, 1.5, undefined, { label: e.name, key: e.s.key });
    });
    plot.attachTools(svg.closest('.plot-wrap'));
  }
  /* Bars: the categories of all the series, in the order they first come, each series' bar
     (the first value of a category, should it come twice) and its error in them. */
  function drawBars(svg, list, data, legend){
    const cats = [], at = new Map();
    data.forEach(d=> d.cats.forEach(c=>{ if (!at.has(c)){ at.set(c, cats.length); cats.push(c); } }));
    const series = list.map((e, k)=>{
      const vals = cats.map(()=> NaN), errs = cats.map(()=> NaN), d = data[k];
      d.cats.forEach((c, i)=>{ const j = at.get(c); if (Number.isNaN(vals[j])){ vals[j] = d.ys[i]; errs[j] = d.eys[i]; } });
      return { name: e.name, color: e.color, vals, errs };
    });
    const big = Math.max(...series.flatMap(m=> m.vals).filter(Number.isFinite).map(Math.abs), 0);
    const digits = big > 0 ? Math.max(0, Math.min(6, 2 - Math.floor(Math.log10(big)))) : 2;
    valueBars(svg, { cats: cats.map(c=> ({ label: c, name: c })), series, digits, yLabel: esc(axisTitle(list.map(e=> headOf(e.s.t, e.s.col)))), legend });
  }
  /* Boxes: one a series, its values down the rows, named as the series, with the mean ± the
     standard deviation above it. */
  function drawBoxes(svg, list, data){
    const st = data.map(d=>{ const b = boxStats(d.ys); return b && { ...b, mean: meanArr(d.ys), err: d.ys.length > 1 ? stdArr(d.ys) : NaN }; });
    const n = list.length, tops = st.filter(Boolean).map(b=> Math.max(b.hi, ...b.out)), bots = st.filter(Boolean).map(b=> Math.min(b.lo, ...b.out));
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = "10px 'Inter', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
    const r = svg.getBoundingClientRect(), W = r.width || 640;
    const fit = barNames(mctx, list.map(e=> e.name), Math.max(60, W - 75), 55);
    const bottom = Math.round(26 + Math.max(0, ...fit.labels.map(l=> mctx.measureText(l).width)) * fit.sin);
    const lo = Math.min(0, ...bots), hi = Math.max(...tops, 0), span = (hi - lo) || 1;
    // (room above the tallest box for its label, upright: the plot's height less the label's)
    const label = b => Number.isFinite(b.err) ? `${sig(b.mean)}±${sig(b.err)}` : sig(b.mean);
    const plotH = (r.height || 420) - 15 - bottom, reserve = 12 + Math.max(0, ...st.filter(Boolean).map(b=> mctx.measureText(label(b)).width));
    const y0 = lo < 0 ? lo - 0.08*span : 0, y1 = Math.max(hi + 0.15*span, y0 + (hi - y0) / (plotH > reserve ? 1 - reserve/plotH : 0.5));
    const plot = new Plot(svg, { xlabel: '', ylabel: axisTitle(list.map(e=> headOf(e.s.t, e.s.col))), noXTickLabels: true, noXGrid: true, yGrid: true, margin: { l: 55, r: 20, t: 15, b: bottom } });
    plot.setRange(0, n + 1, y0, y1);
    plot.drawAxes();
    const hw = Math.min(16, (W - 75)/(n + 1)*0.3);
    list.forEach((e, k)=>{
      const b = st[k];
      if (b){
        plot.box(k + 1, b, e.color, hw, 0, { label: e.name });
        plot.barLabel(k + 1, Math.max(b.hi, ...b.out), label(b), { gap: 6 });
      }
      plot.tickLabel(k + 1, fit.labels[k], fit.rot, e.name, e.s.key);
    });
    plot.attachTools(svg.closest('.plot-wrap'));
  }

  // A card's CSV: what it plots, a series' columns beside the others' ('' with none).
  function cardCsv(a){
    const list = plotted(a);
    if (!list.length) return '';
    const cols = [], divs = divsOf(a.type, a.norm, list);
    list.forEach((e, k)=>{
      const d = dataOf(a.type, e.s.t, e.s, e.r, divs[k]), t = e.s.t;
      if (a.type === 'xy'){
        cols.push({ h: `${e.name} - ${axisTitle([headOf(t, e.s.x)]) || 'x'}`, v: d.xs.map(num) }, { h: e.name, v: d.ys.map(num) });
        if (e.s.ex >= 0) cols.push({ h: `${e.name} - err x`, v: d.exs.map(num) });
        if (e.s.ey >= 0) cols.push({ h: `${e.name} - err y`, v: d.eys.map(num) });
      } else if (a.type === 'bar'){
        cols.push({ h: `${e.name} - category`, v: d.cats }, { h: e.name, v: d.ys.map(num) });
        if (e.s.ey >= 0) cols.push({ h: `${e.name} - err y`, v: d.eys.map(num) });
      } else cols.push({ h: e.name, v: d.ys.map(num) });
    });
    return wideCsv(cols);
  }

  // A new project starts with no plot: + adds one, of the kind chosen.
  deck.start([]);

  return {
    // The file the Data card shows: kept as the tab sleeps and in its record (tabs.js).
    shows(){ return allFiles.length > 1 && shownName && shownName !== allFiles[0].name ? { file: shownName } : null; },
    showNext(v){ fileNext = isObj(v) && typeof v.file === 'string' ? v.file : null; },
    destroy(){ closePick(false); pick.remove(); kit.destroy(); },
  };
}
registerModule('fig', createFig);
