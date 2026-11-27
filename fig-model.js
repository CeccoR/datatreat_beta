/* =========================================================
   CUSTOM — what the module works out that touches no page (fig.js wires it to the Data
   card, the trace list and the Plot cards; tests/figmodel.test.mjs calls it in Node): a
   file's table read from its bytes and kept by them; the columns' roles and the series
   they make, a file's first roles and its columns' names from its titles; what a series
   plots under its plot's normalisation, scale and offset (kept by its column), an axis's
   title; a file and a Plot card as a project holds them (RESTORED) and the module's state
   saved; the series of a file, named and coloured, the trace list's order and rows, a
   series included or left out, coloured, renamed or taken out of the list (its roles, or
   its file); the plots' series that still are; the file on show, the files with fewer
   columns than it, the roles given to every file; a plot's series plotted (their names
   made unique), an operation typed, the Add series window's files and what its Done
   gives; what an XY plot, a bar chart and a box plot draw; a plot's CSV's columns. Taken
   out of v561's fig.js (createFig, one closure of 552 lines, and the functions round it)
   with their operations in their order: the same values to the last bit.

   utils.js's and modkit.js's helpers, which need a page to load, are handed in as one
   object, U = { isObj, ownKey, isColor, colorOf, objId, exactKey, dataKept, csvNum,
   boxStats, meanArr, stdArr, barNames } (fig.js U; dataKept: utils.js keeper's for
   the series, 'fig-series').
========================================================= */
import { decodeText, textLines, readColumns, parseNum, isNum, nameUnit } from './textdata.js';
import { fixed } from './db.js';

/* ---- A file's table (pure: the module's, for every instance) ----
   Read from its bytes, which are all a project keeps of it (beside its roles and its
   series' names): kept by those bytes (the same array in a tab's states, its record and
   another tab holding the file), so an undo, a wake or a project opened reads it once.
   Its columns of numbers (each cell as parseNum reads it, NaN where it is none) fixed
   (db.js): shared, never changed. */
const tables = new WeakMap();
export function readTableText(text){
  const t = readColumns(textLines(text));
  if (!t) return null;
  return { ...t, heads: t.head ? t.head.map(nameUnit) : null,
    nums: Array.from({ length: t.n }, (_, c)=> fixed(t.rows.map(r=> parseNum(r[c])))) };
}
export function tableOf(f){
  const b = f && f.rawBytes;
  if (!(b instanceof Uint8Array)) return null;
  if (!tables.has(b)) tables.set(b, readTableText(decodeText(b)));
  return tables.get(b);
}
// A file just dropped: the table it was read into kept by its bytes, and off its record.
export function keepTable(f){ tables.set(f.rawBytes, f.table); delete f.table; }

/* ---- The columns' roles (Origin-like) ----
   x, y, an error of x, an error of y, or none (''). Several x may be: each y belongs to the
   x before it (none: the row number is its x), each error of y to the y before it, each
   error of x to the x before it; one error at most a column. By default the first column
   is x and the others y. */
export const ROLES = { x: 'x', y: 'y', ex: 'err x', ey: 'err y', '': '—' };
export const defRoles = n => Array.from({ length: n }, (_, i)=> i ? 'y' : 'x');
/* Roles made to hold: an error with no column of its own before it, or one past the first
   of its column, a y. */
export function fixRoles(r){
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
export function setRole(roles, i, v){
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
export function seriesCols(roles){
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
export const rolesLike = (src, n)=> fixRoles(defRoles(n).map((d, c)=> c < src.length ? src[c] : d));
/* A file's first roles: with a line of series' titles over its header (textdata.js
   readColumns), each title opens a group, its first column the x and the others, up to the
   next title, its y ("series 1",,,"series 2": x y y x); else the defaults. */
export const firstRoles = t => t.titles ? fixRoles(t.titles.map(v=> v !== '' ? 'x' : 'y')) : defRoles(t.n);
/* A column's name from the titles: its group's title, with the column's own name when the
   group has several columns past its x ('' with no titles). */
export function titleName(t, c){
  if (!t.titles) return '';
  let g = c;
  while (g >= 0 && t.titles[g] === '') g--;
  if (g < 0) return '';
  let end = g + 1;
  while (end < t.n && t.titles[end] === '') end++;
  const h = t.heads && t.heads[c] && t.heads[c].name;
  return end - g > 2 ? `${t.titles[g]} – ${h || 'column ' + (c + 1)}` : t.titles[g];
}
// The roles of the file on show (src) given to each of `files` but itself, by position.
export const giveRoles = (files, src)=> files.forEach(g=>{ if (g !== src) g.roles = rolesLike(src.roles, tableOf(g).n); });

/* ---- What a series plots: its values divided by the plot's normalisation (`div`: 1 for
   none, its own largest |y| for local, the largest of the plot's series for global), then
   multiplied by its scale, and, in an XY plot, its offset added. A bar chart's and a box
   plot's have no offset. To v528 each series had its own normalisation, and an XY plot's
   series a crop in x. Kept by the series' column (U.dataKept, utils.js keeper: while a
   state, a tab asleep or a history holds the file) under its other columns and its
   operations: a tab woken, an undo, a redraw and the CSVs take it as made. ---- */
export const OPS = { xy: ['scale', 'offset'], bar: ['scale'], box: ['scale'] };
export const DEF_OPS = { scale: 1, offset: 0 };
export const NORMS = { none: 'None (data as they are)', local: 'Local (max of each)', global: 'Global (max of all)' };
const maxAbs = a =>{ let m = 0; for (const v of a) if (Math.abs(v) > m) m = Math.abs(v); return m; };
export function dataOf(U, kind, t, s, r, div = 1){
  const o = { div, scale: r.scale, offset: kind === 'xy' ? r.offset : 0 };
  return U.dataKept(t.nums[s.col], U.exactKey([kind, U.objId(t), s.x, s.ex, s.ey, o]), ()=> seriesData(kind, t, s, o));
}
// (what dataOf keeps: the points with a y, and in an XY plot an x; a bar's category)
export function seriesData(kind, t, s, o){
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
}
// A plot's series' divisors (dataOf `div`) under its normalisation.
export function divsOf(U, kind, norm, list){
  if (norm !== 'local' && norm !== 'global') return list.map(()=> 1);
  const peaks = list.map(e=> maxAbs(dataOf(U, kind, e.s.t, e.s, DEF_OPS).ys));
  const all = Math.max(0, ...peaks);
  return peaks.map(p=> (norm === 'local' ? p : all) || 1);
}

/* ---- An axis's title: the columns' name and unit when those that have them share them ---- */
export function axisTitle(parts){
  parts = parts.filter(p=> p.name || p.unit);
  const names = [...new Set(parts.map(p=> p.name))], units = [...new Set(parts.map(p=> p.unit))];
  const name = names.length === 1 ? names[0] : '', unit = units.length === 1 ? units[0] : '';
  return name && unit ? `${name} (${unit})` : name || (unit ? `(${unit})` : '');
}
// A value as a plot's label writes it (3 significant digits; a CSV's: csvNum).
export const sig = v => String(+v.toPrecision(3));
export const headOf = (t, c)=> c < 0 ? { name: 'Row', unit: '' } : t.heads && t.heads[c] ? t.heads[c] : { name: '', unit: '' };
// A plot's axes' titles: its series' x columns', their y columns'.
export const xTitle = list => axisTitle(list.map(e=> headOf(e.s.t, e.s.x)));
export const yTitle = list => axisTitle(list.map(e=> headOf(e.s.t, e.s.col)));

/* ---- A card's kinds ---- */
export const KINDS = { xy: 'XY plot', bar: 'Bar chart', box: 'Box plot' };

/* ---- What a state may hold (modkit RESTORED) ---- */
const finiteOr = (v, d)=> Number.isFinite(v) ? v : d;
const refsOk = (U, v)=> Array.isArray(v) ? v.filter(r=> U.isObj(r) && typeof r.file === 'string' && Number.isInteger(r.col) && r.col >= 0) : [];
// (a v527–v528 series' own normalisation and crop let go: refsOk, normIn)
export const refsIn = (U, v)=> refsOk(U, v).map(r=> ({ file: r.file, col: r.col, scale: finiteOr(r.scale, 1), offset: finiteOr(r.offset, 0) }));
/* A plot's normalisation; a v527–v528 card has none, its series theirs: local when every
   one was normalised (an XY plot's or a bar chart's), else none. */
export function normIn(U, c){
  if (U.ownKey(NORMS, c.norm)) return c.norm;
  const rs = refsOk(U, c.series);
  return c.norm === undefined && (c.type === 'xy' || c.type === 'bar') && rs.length && rs.every(r=> r.norm === true) ? 'local' : 'none';
}
export const figIn = (U, v)=> U.isObj(v) && U.isObj(v.scalars) && Array.isArray(v.series) ? v : null;
// A Plot card as a state holds it, read (cards.js load's `read`).
export const cardIn = (U, c)=> ({ series: refsIn(U, c.series), norm: normIn(U, c), fig: figIn(U, c.fig) });
// The trace list's order as a state holds it.
export const orderIn = v => Array.isArray(v) ? v.filter(k=> typeof k === 'string') : [];
/* A file as a restore takes it: its table read from its bytes (none: left out), its
   roles one a column (else the defaults) made to hold, its names by column. */
export function fileIn(U, f){
  const t = tableOf(f);
  if (!t) return null;
  const roles = Array.isArray(f.roles) && f.roles.length === t.n && f.roles.every(r=> U.ownKey(ROLES, r)) ? fixRoles(f.roles) : firstRoles(t);
  const names = {};
  if (U.isObj(f.names)) for (const k of Object.keys(f.names)) if (/^\d+$/.test(k) && +k < t.n && typeof f.names[k] === 'string' && f.names[k].trim()) names[k] = f.names[k];
  // (a file left out by v531, the list's row its own: each of its series left out)
  const out = f.included === false ? seriesCols(roles).map(c=> c.col)
    : Array.isArray(f.out) ? [...new Set(f.out.filter(c=> Number.isInteger(c) && c >= 0 && c < t.n))] : [];
  // (v534: its series' colours, by column, those picked; the others their place's)
  const colors = {};
  if (U.isObj(f.colors)) for (const k of Object.keys(f.colors)) if (/^\d+$/.test(k) && +k < t.n && U.isColor(f.colors[k])) colors[k] = f.colors[k];
  const g = { ...f, roles, names, colors };
  delete g.included; delete g.held; delete g.out;
  if (!Object.keys(colors).length) delete g.colors;
  return out.length ? { ...g, out } : g;
}
// The module's own state (beside its files): the roles alike, the trace list's order, the
// cards (saved: the deck's part of a record, cards.js) with their series, normalisation
// and figure.
export const stateOf = (same, order, recs, saved)=> ({ same, ...(order.length ? { order: order.slice() } : {}), cards: recs.map(a=> ({ ...saved(a), series: a.series.map(r=> ({ ...r })), norm: a.norm, fig: a.fig })) });
// The file the Data card shows, kept as the tab sleeps and in its record (tabs.js), and
// one a wake gives (showNext).
export const showsOf = (all, shownName)=> all.length > 1 && shownName && shownName !== all[0].name ? { file: shownName } : null;
export const showNextIn = (U, v)=> U.isObj(v) && typeof v.file === 'string' ? v.file : null;

/* ---- The series: every y of every file, by its file and column. Its number in its file
   ("Series M (Cols a,b)": its x's column and its own) follows the roles; its name is
   the one typed, else its title's (titleName), its header's, or "Series M". Its colour
   (v534) the one picked in the trace list (its file's `colors`, by column), else the
   palette's at its place among the series of all files, in the files' order. ---- */
export const keyOf = (name, col)=> name + '\n' + col;
export function seriesOfFile(U, all, f, fi){
  const t = tableOf(f);
  let k = 0;
  for (let j = 0; j < fi; j++) k += seriesCols(all[j].roles).length;
  return seriesCols(f.roles).map((s, m)=>{
    const auto = `Series ${m + 1}`, cols = s.x >= 0 ? `Cols ${s.x + 1},${s.col + 1}` : `Col ${s.col + 1}`;
    const given = Object.prototype.hasOwnProperty.call(f.names, s.col) ? f.names[s.col] : '';
    const def = titleName(t, s.col) || headOf(t, s.col).name || auto;
    const color = f.colors && U.ownKey(f.colors, String(s.col)) ? f.colors[s.col] : U.colorOf(k + m);
    return { ...s, f, t, fi, m, key: keyOf(f.name, s.col), auto, cols, def, name: given || def, color };
  });
}
export const isOut = (f, col)=> Array.isArray(f.out) && f.out.includes(col);
/* ---- The trace list: a row a series (its trace), in `order` (the series' keys, set as the
   list is reordered; none: the files' order, each its columns'; a series not in it after
   those that are); a file of none a row of its own (its name: renamed, the file's label).
   A file's series left out of the analysis are its record's `out`, by column. ---- */
export function tracesOf(U, all, order){
  const ts = all.flatMap((f, fi)=>{ const ss = seriesOfFile(U, all, f, fi); return ss.length ? ss.map(s=> ({ f, s, key: s.key })) : [{ f, s: null, key: keyOf(f.name, -1) }]; });
  if (!order.length) return ts;
  const at = new Map(order.map((k, i)=> [k, i])), rank = t => at.has(t.key) ? at.get(t.key) : Infinity;
  return ts.map((t, i)=> [t, i]).sort((a, b)=> rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(e=> e[0]);
}
// The series included in the analysis, by key, in the trace list's order.
export function seriesMapOf(ts){
  const m = new Map();
  ts.forEach(t=>{ if (t.s && !isOut(t.f, t.s.col)) m.set(t.s.key, t.s); });
  return m;
}
// The trace list's rows. (a series' colour its own; a file of none has none, nor a swatch)
export const traceRows = ts => ts.map(({ f, s })=> ({ name: s ? `${f.name} (${s.cols})` : f.name, src: f.name, label: s ? s.name : f.label, color: s ? s.color : '', rawBytes: f.rawBytes,
  ...(s && isOut(f, s.col) ? { included: false } : {}) }));
// A trace included (on) or left out: its file's `out`.
export function setOut(t, on){ if (!t.s) return; const o = new Set(t.f.out || []); if (on) o.delete(t.s.col); else o.add(t.s.col); if (o.size) t.f.out = [...o]; else delete t.f.out; }
// A series' colour picked; the palette's (cs) given to all in the list's order.
export function setColor(t, c){ t.f.colors = { ...(t.f.colors || {}), [t.s.col]: c }; }
export const setPalette = (ts, cs)=> ts.filter(t=> t.s).forEach((t, k)=>{ t.f.colors = { ...(t.f.colors || {}), [t.s.col]: cs[k % cs.length] }; });
// The list's order once a trace is moved from one place to another.
export function reordered(ts, from, to){ const k = ts.map(t=> t.key), [m] = k.splice(from, 1); k.splice(to, 0, m); return k; }
/* A trace removed: its file goes where the trace is its file's last, or the file has none
   (whole); else its column, and its error's, no longer used (the Data card's roles, —). */
export const whole = t => !t.s || seriesCols(t.f.roles).length < 2;
export function dropSeries(t){
  const r = t.f.roles.slice();
  r[t.s.col] = '';
  if (t.s.ey >= 0) r[t.s.ey] = '';
  t.f.roles = fixRoles(r);
  if (isOut(t.f, t.s.col)) setOut(t, true);
}
// A series' name typed (v0): empty, or as its header names it (def), back to that name.
export function namesWith(names0, col, v0, def){
  const v = v0.trim(), names = { ...names0 };
  if (!v || v === def) delete names[col]; else names[col] = v;
  return { v, names };
}
/* A plot keeps the series that still are (a y of a file loaded, included or not) and lets
   the others go, without a word: a file removed, a column no longer a y. */
export function pruneCards(all, recs){
  const ys = new Set(all.flatMap(f=> seriesCols(f.roles).map(s=> keyOf(f.name, s.col))));
  recs.forEach(a=>{ if (a.series.some(r=> !ys.has(keyOf(r.file, r.col)))) a.series = a.series.filter(r=> ys.has(keyOf(r.file, r.col))); });
}

/* ---- The Data card ---- */
// The file on show: the one named, else the first.
export const shownFileOf = (all, name)=> all.find(f=> f.name === name) || all[0] || null;
// The files with fewer columns than the one on show (f, its table t), with the roles alike.
export const shortOf = (all, f, t, same)=> same ? all.filter(g=> g !== f && tableOf(g).n < t.n) : [];

/* ---- The Plot cards: each its kind, its series (by file and column, each with its scale
   and offset), its normalisation and its figure ---- */
// A card's series that are plotted (included in the trace list: map, seriesMapOf), with their
// names made unique in it (a name two files' series share: with the file's label) and their
// colours (v534: the trace list's; to v533 by their place in the plot).
export function plotted(a, map){
  const used = new Set();
  return a.series.map(r=> ({ r, s: map.get(keyOf(r.file, r.col)) })).filter(e=> e.s).map(e=>{
    let name = e.s.name, n = 2;
    if (used.has(name)) name = `${e.s.name} (${e.s.f.label})`;
    while (used.has(name)) name = `${e.s.name} (${n++})`;
    used.add(name);
    return { ...e, name, color: e.s.color };
  });
}
// An operation as it is typed: a number, else null (the field shakes and shows the record's again).
export function opIn(raw){
  const v = parseNum(raw);
  return /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/.test(raw) && Number.isFinite(v) ? v : null;
}
// The Add series window's files: the series included by file, in the trace list's order, a
// file where its first series is.
export function pickGroups(map){
  const by = new Map();
  for (const s of map.values()){ if (!by.has(s.f)) by.set(s.f, []); by.get(s.f).push(s); }
  return by;
}
/* Done: the plot's series those ticked (want) of those the window lists (listed), the ones
   it had in their places, the new after them in the list's order (a series of a file left
   out, not in the window, stays); null where nothing changes. */
export function pickedSeries(series, want, listed, map){
  const set = new Set(want);
  const kept = series.filter(r=>{ const k = keyOf(r.file, r.col); return !listed.has(k) || set.has(k); });
  const had = new Set(kept.map(r=> keyOf(r.file, r.col)));
  const next = [...kept, ...want.filter(k=> !had.has(k) && map.has(k)).map(k=> ({ file: map.get(k).f.name, col: map.get(k).col, ...DEF_OPS }))];
  return next.length === series.length && next.every((r, i)=> r === series[i]) ? null : next;
}

/* ---- What the plots draw ---- */
// An XY plot's range: its points with their errors, 5 % of its height over and under.
export function xyRange(data){
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  data.forEach(d=> d.xs.forEach((x, i)=>{
    const ex = d.exs[i] || 0, ey = d.eys[i] || 0, y = d.ys[i];
    x0 = Math.min(x0, x - ex); x1 = Math.max(x1, x + ex); y0 = Math.min(y0, y - ey); y1 = Math.max(y1, y + ey);
  }));
  if (!Number.isFinite(x0)){ x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
  const pad = (y1 - y0) * 0.05 || Math.abs(y1) * 0.05 || 1;
  return { x0, x1, y0: y0 - pad, y1: y1 + pad };
}
// The view's key (modcharts.js setView): the series with their operations, the normalisation.
export const viewKey = (list, norm)=> list.map(e=> e.s.key + JSON.stringify(e.r)).join('\n') + '\n' + norm;
// A series' error bars, segments: x ± its error, y ± its own.
export function errBars(d){
  const sx = [], sy = [];
  d.xs.forEach((x, i)=>{
    const y = d.ys[i];
    if (d.eys[i] > 0){ sx.push(x, x); sy.push(y - d.eys[i], y + d.eys[i]); }
    if (d.exs[i] > 0){ sx.push(x - d.exs[i], x + d.exs[i]); sy.push(y, y); }
  });
  return { sx, sy };
}
/* Bars: the categories of all the series, in the order they first come, each series' bar
   (the first value of a category, should it come twice) and its error in them; the digits
   of their values (modcharts.js valueBars). */
export function barsOf(list, data){
  const cats = [], at = new Map();
  data.forEach(d=> d.cats.forEach(c=>{ if (!at.has(c)){ at.set(c, cats.length); cats.push(c); } }));
  const series = list.map((e, k)=>{
    const vals = cats.map(()=> NaN), errs = cats.map(()=> NaN), d = data[k];
    d.cats.forEach((c, i)=>{ const j = at.get(c); if (Number.isNaN(vals[j])){ vals[j] = d.ys[i]; errs[j] = d.eys[i]; } });
    return { name: e.name, color: e.color, vals, errs };
  });
  const big = Math.max(...series.flatMap(m=> m.vals).filter(Number.isFinite).map(Math.abs), 0);
  const digits = big > 0 ? Math.max(0, Math.min(6, 2 - Math.floor(Math.log10(big)))) : 2;
  return { cats: cats.map(c=> ({ label: c, name: c })), series, digits };
}
/* Boxes: one a series, its values down the rows, named as the series, with the mean ± the
   standard deviation above it (its label). */
export const boxStatsOf = (U, data)=> data.map(d=>{ const b = U.boxStats(d.ys); return b && { ...b, mean: U.meanArr(d.ys), err: d.ys.length > 1 ? U.stdArr(d.ys) : NaN }; });
export const boxLabel = b => Number.isFinite(b.err) ? `${sig(b.mean)}±${sig(b.err)}` : sig(b.mean);
/* Their layout (mctx: a canvas's measure, its font set; r: the plot's box): the names under
   the boxes (utils.js barNames) and the room they take (bottom), the range with room above
   the tallest box for its label, upright (the plot's height less the label's), a box's
   half-width. */
export function boxLayout(U, list, st, mctx, r){
  const n = list.length, tops = st.filter(Boolean).map(b=> Math.max(b.hi, ...b.out)), bots = st.filter(Boolean).map(b=> Math.min(b.lo, ...b.out));
  const W = r.width || 640;
  const fit = U.barNames(mctx, list.map(e=> e.name), Math.max(60, W - 75), 55);
  const bottom = Math.round(26 + Math.max(0, ...fit.labels.map(l=> mctx.measureText(l).width)) * fit.sin);
  const lo = Math.min(0, ...bots), hi = Math.max(...tops, 0), span = (hi - lo) || 1;
  const plotH = (r.height || 420) - 15 - bottom, reserve = 12 + Math.max(0, ...st.filter(Boolean).map(b=> mctx.measureText(boxLabel(b)).width));
  const y0 = lo < 0 ? lo - 0.08*span : 0, y1 = Math.max(hi + 0.15*span, y0 + (hi - y0) / (plotH > reserve ? 1 - reserve/plotH : 0.5));
  return { n, fit, bottom, y0, y1, hw: Math.min(16, (W - 75)/(n + 1)*0.3) };
}

// A card's CSV's columns: what it plots, a series' columns beside the others' (modkit.js wideCsv).
export function csvCols(U, a, list){
  const cols = [], divs = divsOf(U, a.type, a.norm, list);
  list.forEach((e, k)=>{
    const d = dataOf(U, a.type, e.s.t, e.s, e.r, divs[k]), t = e.s.t;
    if (a.type === 'xy'){
      cols.push({ h: `${e.name} - ${axisTitle([headOf(t, e.s.x)]) || 'x'}`, v: d.xs.map(U.csvNum) }, { h: e.name, v: d.ys.map(U.csvNum) });
      if (e.s.ex >= 0) cols.push({ h: `${e.name} - err x`, v: d.exs.map(U.csvNum) });
      if (e.s.ey >= 0) cols.push({ h: `${e.name} - err y`, v: d.eys.map(U.csvNum) });
    } else if (a.type === 'bar'){
      cols.push({ h: `${e.name} - category`, v: d.cats }, { h: e.name, v: d.ys.map(U.csvNum) });
      if (e.s.ey >= 0) cols.push({ h: `${e.name} - err y`, v: d.eys.map(U.csvNum) });
    } else cols.push({ h: e.name, v: d.ys.map(U.csvNum) });
  });
  return cols;
}
