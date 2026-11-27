/* The Custom module's calculations (fig-model.js) and its words and markup that need no page
   (fig-html.js), in Node: no browser (v562, out of v561's fig.js). A file's table read from
   its text (a header with units, a line of titles, ',' decimals, blanks) and kept by its
   bytes; the columns' roles (the defaults, made to hold, an error set where its column has
   one, several x), the series they make, a file's first roles and its columns' names from
   its titles, the roles given to every file; what a series plots (its points with a y and
   an x, a bar's category, its errors) under a plot's normalisation (none, local, global),
   scale and offset, kept by its column; an axis's title; a file as a project holds it (its
   roles, names, colours and series left out, of v534, malformed) and a Plot card
   (malformed), the module's state saved; v583: an old project (a file left out whole, to
   v531; a card's series each normalised and cropped, v527–v528; bytes as arrays), its old
   fields ignored, the defaults in their place; the series of a
   file named (typed, its title's, its header's, "Series M") and coloured (picked, the
   palette's by its place), the trace list's order and rows, a trace included and left out,
   its colour, the palette, moved, renamed, taken out (its column, its error; its file's last:
   the file); the plots' series that still are; the file on show and those with fewer columns;
   a plot's series plotted with names made unique, an operation as typed (refused), the Add
   series window's files and what Done gives; an XY plot's range and error bars, a bar
   chart's categories and digits, a box plot's boxes, labels and layout; a plot's CSV; and
   the markup (a Plot card's body and its series, the legends, the Data card's head, table and
   warning, the Add series window) with every name escaped. Then 40 cases (random files of
   every form, roles, names, colours, series left out, an order, the roles alike or not, Plot
   cards of each kind with their series, normalisations, operations and figures; eight steps
   each, done as fig.js does them: a role set, a name typed, a trace included or left out,
   coloured, the palette, moved, renamed, removed, the roles alike, a file shown, Add series'
   Done, a normalisation, an operation typed, a series taken out, a figure saved; at each,
   the trace list's rows, the Data card's head and warning, each card's list, plot and legend,
   the CSVs, the state and what it shows) as v561's fig.js gave them, run from its source on a
   page of stubs: SHA-256 digests in tests/golden/figmodel.json (npm run test:update writes
   them anew after a change meant to alter them). utils.js's, modkit.js's, modcharts.js's and
   cards.js's helpers, which need a page to load, are taken from their source as they stand
   there (utils.js's isColor, which asks the browser's CSS, stood in for by a hex colour's
   form). Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as M from '../fig-model.js';
import * as H from '../fig-html.js';
import { settleNames, saved } from '../cards-model.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/figmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');

// A declaration of the page's modules as it stands there: a function to its closing brace,
// a const to the next line at the margin (a closing one taken with it).
function decl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let i = src.search(new RegExp(`^(export )?function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = src.indexOf(')', i), d = 0;
    for (k = src.indexOf('{', k); k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    return src.slice(i, k + 1).replace(/^export /, '');
  }
  i = src.search(new RegExp(`^(export )?const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  const rest = src.slice(i), m = /\n(?=\S)/.exec(rest);
  let end = m ? m.index : rest.length;
  if (m && /^[}\])]/.test(rest.slice(end + 1))) end = rest.indexOf('\n', end + 1);
  return rest.slice(0, end).replace(/^export /, '');
}
const UN = ['COLORS', 'colorOf', 'esc', 'X_SVG', 'csvNum', 'csvField', 'csvJoin', 'csvLine', 'meanArr', 'stdArr', 'boxStats', 'BAR_NAME_MAX', 'TILT_MIN', 'cutToWidth', 'tiltFits', 'tiltFor', 'barNames', 'exactKey'];
const PAGE = new Function('settings', [...UN.map(n=> decl('utils.js', n)), decl('modkit.js', 'isObj'), decl('modkit.js', 'ownKey'), decl('modkit.js', 'cardList'), decl('modkit.js', 'wideCsv'),
  decl('modcharts.js', 'PLOT_DL_ICON'), decl('modcharts.js', 'plotWrap'), decl('cards.js', 'cardInfo'), decl('cards.js', 'fileSafe')].join('\n')
  + '\nreturn { colorOf, esc, X_SVG, csvNum, csvLine, meanArr, stdArr, boxStats, barNames, exactKey, isObj, ownKey, cardList, wideCsv, plotWrap, cardInfo, fileSafe };')({ decimal: '.', field: ';' });
const ids = new WeakMap();
let nid = 0;
const objId = o => o == null || typeof o !== 'object' ? String(o) : ids.get(o) || (ids.set(o, ++nid), nid);
// (utils.js keeper's part here: what is kept by the column under its key, counted)
const made = { n: 0, taken: 0 };
const kept = new WeakMap();
const dataKept = (data, key, make)=>{ let m = kept.get(data); if (!m) kept.set(data, m = new Map()); if (m.has(key)){ made.taken++; return m.get(key); } made.n++; const v = make(); m.set(key, v); return v; };
const isColor = c => typeof c === 'string' && c.length < 64 && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
export const U = { isObj: PAGE.isObj, ownKey: PAGE.ownKey, isColor, colorOf: PAGE.colorOf, objId, exactKey: PAGE.exactKey, dataKept,
  csvNum: PAGE.csvNum, boxStats: PAGE.boxStats, meanArr: PAGE.meanArr, stdArr: PAGE.stdArr, barNames: PAGE.barNames };
export const HU = { esc: PAGE.esc, X_SVG: PAGE.X_SVG, plotWrap: PAGE.plotWrap };
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (o instanceof Uint8Array){ let h = 0; for (const b of o) h = (Math.imul(h, 31) + b) >>> 0; return 'U8:' + o.length + ':' + h; }
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  if (typeof o === 'function') return 'fn';
  return x; });
export const dg = a => a == null ? String(a) : sha(canon(Array.from(a))).slice(0, 16);
const bytes = t => new TextEncoder().encode(t);
// A file's record as a drop makes it, its table kept by its bytes.
function dropped(name, text){
  const t = M.readTableText(text);
  const f = { name, label: name.replace(/\.[^.]+$/, ''), roles: M.firstRoles(t), names: {}, table: t, color: '#3aa0ff', rawBytes: bytes(text) };
  M.keepTable(f);
  return f;
}
// A measure as the page's stub gives it: 6 px a character, half a pixel more with a narrow letter.
export const MCTX = { font: '', measureText: t => ({ width: String(t).length*6 + (/[iIl1]/.test(t) ? 0.5 : 0) }) };

const A_CSV = 'Time (s),Signal (mV),err,Ref [mV]\r\n1,11.5,0.1,3.25\r\n2,13,0.2,3.5\r\n3,,0.3,3.75\r\n4,16,n.a.,4\r\n';
const T_CSV = 'series 1,,,series 2,\nTime (s),A,B,Time (s),C\n1,2,3,1,5\n2,3,4,2,6\n';
const C_CSV = 'Sample;Rate / umol h-1;sd\nCat A;12,5;1,2\nCat B;7,25;0,8\n1,0;3;0,1\nCat A;9;\n';

test('the roles: the defaults, made to hold, an error set where its column has one; the series they make; the titles', ()=>{
  assert.deepEqual(M.defRoles(4), ['x', 'y', 'y', 'y']);
  assert.deepEqual(M.fixRoles(['ey', 'x', 'ex', 'ex', 'y', 'ey', 'ey']), ['y', 'x', 'ex', 'y', 'y', 'ey', 'y'], 'an error with no column before it, a second one: y');
  assert.deepEqual(M.setRole(['x', 'y', 'ey', 'y'], 3, 'ey'), ['x', 'y', 'y', 'ey'], 'the error the y had turned into a y');
  assert.deepEqual(M.setRole(['x', 'ex', 'y', 'x', 'y'], 2, 'ex'), ['x', 'y', 'ex', 'x', 'y']);
  assert.deepEqual(M.seriesCols(['x', 'y', 'ey', 'ex', 'x', 'y', '', 'y']), [{ col: 1, x: 0, ey: 2, ex: 3 }, { col: 5, x: 4, ey: -1, ex: -1 }, { col: 7, x: 4, ey: -1, ex: -1 }]);
  assert.deepEqual(M.seriesCols(['y', 'ey', 'y']), [{ col: 0, x: -1, ey: 1, ex: -1 }, { col: 2, x: -1, ey: -1, ex: -1 }], 'no x: the row number');
  assert.deepEqual(M.rolesLike(['x', 'ey', 'y'], 5), ['x', 'y', 'y', 'y', 'y'], 'by position, made to hold');
  assert.deepEqual(M.rolesLike(['x', 'y', 'ey', 'ex', 'y'], 3), ['x', 'y', 'ey']);
  const t = M.readTableText(T_CSV);
  assert.deepEqual(M.firstRoles(t), ['x', 'y', 'y', 'x', 'y']);
  assert.deepEqual([0, 1, 2, 3, 4].map(c=> M.titleName(t, c)), ['series 1 – Time', 'series 1 – A', 'series 1 – B', 'series 2', 'series 2']);
  assert.equal(M.titleName(M.readTableText(A_CSV), 1), '', 'no titles');
  const fs2 = [dropped('p.csv', A_CSV), dropped('q.csv', T_CSV), dropped('r.csv', 'a,b\n1,2\n')];
  fs2[0].roles = ['x', 'y', 'ey', 'ex'];
  M.giveRoles(fs2, fs2[0]);
  assert.deepEqual(fs2.map(f=> f.roles), [['x', 'y', 'ey', 'ex'], ['x', 'y', 'ey', 'ex', 'y'], ['x', 'y']]);
});

test('a file read and kept by its bytes; a file and a card as a project holds them; the state saved', ()=>{
  const t = M.readTableText(A_CSV);
  assert.equal(t.n, 4);
  assert.deepEqual(t.heads, [{ name: 'Time', unit: 's' }, { name: 'Signal', unit: 'mV' }, { name: 'err', unit: '' }, { name: 'Ref', unit: 'mV' }]);
  assert.deepEqual(t.nums[1].map(v=> Number.isNaN(v) ? 'NaN' : v), [11.5, 13, 'NaN', 16]);
  assert.ok(Object.isFrozen(t.nums[1]) || Array.isArray(t.nums[1]));
  assert.equal(M.readTableText('no numbers\nhere\n'), null);
  const c = M.readTableText(C_CSV);
  assert.deepEqual(c.nums[1], [12.5, 7.25, 3, 9]);
  const b = bytes(A_CSV), f = { rawBytes: b };
  assert.equal(M.tableOf(f), M.tableOf({ rawBytes: b }), 'read once, by its bytes');
  assert.equal(M.tableOf({}), null);
  // A file as a restore takes it.
  const g = M.fileIn(U, { name: 'a.csv', rawBytes: b, roles: ['x', 'ey', 'y', 'y'], names: { 1: 'One', 2: '  ', 9: 'x', a: 'b', 3: 5 }, colors: { 1: '#ff0000', 2: 'red', 7: '#00ff00' }, out: [3, 3, -1, 2.5, 9], held: {} });
  assert.deepEqual([g.roles, g.names, g.colors, g.out, 'held' in g], [['x', 'y', 'y', 'y'], { 1: 'One' }, { 1: '#ff0000' }, [3], false]);
  const h = M.fileIn(U, { name: 'a.csv', rawBytes: b, roles: ['x', 'zz', 'y', 'y'], colors: { 2: 'bad' } });
  assert.deepEqual([h.roles, 'out' in h, 'colors' in h], [['x', 'y', 'y', 'y'], false, false]);
  assert.equal(M.fileIn(U, { name: 'x.csv' }), null, 'no bytes: left out');
  assert.equal(M.fileIn(U, { rawBytes: bytes('words\n') }), null);
  // A card: its normalisation, malformed.
  assert.equal(M.normIn(U, { type: 'xy', norm: 'global' }), 'global');
  assert.equal(M.normIn(U, { type: 'xy', norm: 'toString', series: [] }), 'none');
  assert.deepEqual(M.cardIn(U, { series: [{ file: 'a', col: 1, scale: '2', offset: NaN, crop: [0, 1] }, { file: 3, col: 1 }, { file: 'b', col: -1 }, null], norm: 'local', fig: { scalars: {}, series: [] } }),
    { series: [{ file: 'a', col: 1, scale: 1, offset: 0 }], norm: 'local', fig: { scalars: {}, series: [] } });
  assert.equal(M.figIn(U, { scalars: 1, series: [] }), null);
  assert.deepEqual(M.orderIn(['a\n1', 5, null, 'b\n2']), ['a\n1', 'b\n2']);
  assert.deepEqual(M.orderIn('x'), []);
  const recs = [{ id: 2, type: 'bar', base: 'B', nameAuto: false, collapsed: true, name: 'B', series: [{ file: 'a', col: 1, scale: 2, offset: 0 }], norm: 'none', fig: null }];
  const s = M.stateOf(true, [], recs, saved);
  assert.deepEqual(s, { same: true, cards: [{ id: 2, type: 'bar', base: 'B', nameAuto: false, collapsed: true, series: [{ file: 'a', col: 1, scale: 2, offset: 0 }], norm: 'none', fig: null }] });
  assert.notEqual(s.cards[0].series[0], recs[0].series[0], 'its series copied');
  assert.deepEqual(M.stateOf(false, ['k'], [], saved), { same: false, order: ['k'], cards: [] });
  const two = [{ name: 'a.csv' }, { name: 'b.csv' }];
  assert.deepEqual([M.showsOf(two, 'b.csv'), M.showsOf(two, 'a.csv'), M.showsOf(two.slice(0, 1), 'a.csv'), M.showsOf(two, null)], [{ file: 'b.csv' }, null, null, null]);
  assert.deepEqual([M.showNextIn(U, { file: 'x' }), M.showNextIn(U, { file: 3 }), M.showNextIn(U, 'x')], ['x', null, null]);
});

/* v583: an old project opens as this version reads it. Made here as older versions saved it: a
   file left out whole (`included: false`, to v531), a Plot card of v527–v528 (no normalisation
   of its own, each series normalised and cropped), a file's bytes as numbers (to v483). */
test('an old project: old fields ignored, the defaults in their place (v583)', ()=>{
  const b = bytes(A_CSV);
  let f;
  assert.doesNotThrow(()=>{ f = M.fileIn(U, { name: 'a.csv', label: 'a', rawBytes: b, roles: ['x', 'y', 'ey', 'y'], included: false, held: { k: 1 } }); });
  // the file's own inclusion none: every series of it in, as a file loaded now
  assert.deepEqual(['included' in f, 'held' in f, 'out' in f, f.roles], [false, false, false, ['x', 'y', 'ey', 'y']]);
  assert.equal(M.fileIn(U, { name: 'b.csv', rawBytes: [...b] }), null, 'its bytes numbers: none, left out');
  // the card: no normalisation, none; the series' own normalisation and crop ignored
  const c = M.cardIn(U, { type: 'xy', series: [{ file: 'a.csv', col: 1, norm: true, xlo: 2, xhi: 4 }, { file: 'a.csv', col: 3, norm: true }] });
  assert.deepEqual(c, { series: [{ file: 'a.csv', col: 1, scale: 1, offset: 0 }, { file: 'a.csv', col: 3, scale: 1, offset: 0 }], norm: 'none', fig: null });
  // what it plots: its table's points, whole, as a card of now with no normalisation
  const list = M.plotted({ type: 'xy', ...c }, M.seriesMapOf(M.tracesOf(U, [f], [])));
  assert.deepEqual(M.divsOf(U, 'xy', c.norm, list), [1, 1]);
  assert.deepEqual(list.map(e=> M.dataOf(U, 'xy', e.s.t, e.s, e.r).ys), [[11.5, 13, 16], [3.25, 3.5, 3.75, 4]]);
});

test('the series and the trace list: names, colours, order, included, coloured, moved, renamed, taken out', ()=>{
  const a = dropped('a.csv', A_CSV), t = dropped('t.csv', T_CSV), all = [a, t];
  a.roles = ['x', 'y', 'ey', 'y'];
  a.names = { 3: 'Reference' };
  a.colors = { 1: '#123456' };
  const sa = M.seriesOfFile(U, all, a, 0), st = M.seriesOfFile(U, all, t, 1);
  assert.deepEqual(sa.map(s=> [s.key, s.auto, s.cols, s.def, s.name, s.color]), [['a.csv\n1', 'Series 1', 'Cols 1,2', 'Signal', 'Signal', '#123456'], ['a.csv\n3', 'Series 2', 'Cols 1,4', 'Ref', 'Reference', PAGE.colorOf(1)]]);
  assert.deepEqual(st.map(s=> [s.def, s.color]), [['series 1 – A', PAGE.colorOf(2)], ['series 1 – B', PAGE.colorOf(3)], ['series 2', PAGE.colorOf(4)]], 'the palette by the place among all files\' series');
  const bare = dropped('n.csv', '1,2\n3,4\n');
  bare.roles = ['y', 'y'];
  assert.deepEqual(M.seriesOfFile(U, [bare], bare, 0).map(s=> [s.cols, s.def]), [['Col 1', 'Series 1'], ['Col 2', 'Series 2']]);
  // The list: a row a series, a file of none its own; the order by keys, those not in it after.
  const none = dropped('z.csv', 'q\n1\n'); none.roles = [''];
  const files = [a, none, t];
  let ts = M.tracesOf(U, files, []);
  assert.deepEqual(ts.map(x=> x.key), ['a.csv\n1', 'a.csv\n3', 'z.csv\n-1', 't.csv\n1', 't.csv\n2', 't.csv\n4']);
  ts = M.tracesOf(U, files, ['t.csv\n4', 'zz', 'a.csv\n3']);
  assert.deepEqual(ts.map(x=> x.key), ['t.csv\n4', 'a.csv\n3', 'a.csv\n1', 'z.csv\n-1', 't.csv\n1', 't.csv\n2']);
  M.setOut(ts[2], false);
  assert.deepEqual(a.out, [1]);
  assert.deepEqual([...M.seriesMapOf(ts).keys()], ['t.csv\n4', 'a.csv\n3', 't.csv\n1', 't.csv\n2'], 'those included, in the list\'s order');
  assert.deepEqual(M.traceRows(ts).slice(1, 4).map(r=> [r.name, r.src, r.label, r.color, r.included]), [['a.csv (Cols 1,4)', 'a.csv', 'Reference', PAGE.colorOf(1), undefined],
    ['a.csv (Cols 1,2)', 'a.csv', 'Signal', '#123456', false], ['z.csv', 'z.csv', 'z', '', undefined]]);
  M.setOut(ts[2], true);
  assert.equal('out' in a, false, 'none left out: no out');
  M.setOut(ts[3], false);
  assert.equal('out' in none, false, 'a file of no series: nothing');
  M.setColor(ts[0], '#abcdef');
  assert.deepEqual(t.colors, { 4: '#abcdef' });
  M.setPalette(ts, ['#111111', '#222222']);
  assert.deepEqual([a.colors, t.colors], [{ 1: '#111111', 3: '#222222' }, { 1: '#222222', 2: '#111111', 4: '#111111' }]);
  assert.deepEqual(M.reordered(ts, 0, 3), ['a.csv\n3', 'a.csv\n1', 'z.csv\n-1', 't.csv\n4', 't.csv\n1', 't.csv\n2']);
  // Taken out: its column and its error's no longer used; its file's last: the file.
  assert.equal(M.whole(ts[3]), true, 'a file of no series');
  assert.equal(M.whole(ts[1]), false);
  M.setOut(ts[1], false);
  M.dropSeries(ts[2]);
  assert.deepEqual([a.roles, a.out], [['x', '', '', 'y'], [3]], 'its error\'s column too; another left out stays out');
  M.dropSeries(M.tracesOf(U, [a], []).find(x=> x.key === 'a.csv\n3'));
  assert.deepEqual([a.roles, 'out' in a], [['x', '', '', ''], false]);
  // Names typed: empty or as its header names it, back to that name.
  assert.deepEqual(M.namesWith({ 1: 'X' }, 3, '  New ', 'Ref'), { v: 'New', names: { 1: 'X', 3: 'New' } });
  assert.deepEqual(M.namesWith({ 3: 'X' }, 3, 'Ref', 'Ref'), { v: 'Ref', names: {} });
  assert.deepEqual(M.namesWith({ 3: 'X' }, 3, ' ', 'Ref'), { v: '', names: {} });
  // The plots keep the series that still are.
  const recs = [{ series: [{ file: 'a.csv', col: 1 }, { file: 't.csv', col: 4 }, { file: 'gone.csv', col: 1 }] }, { series: [{ file: 't.csv', col: 1 }] }];
  const keep1 = recs[1].series;
  M.pruneCards([a, t], recs);
  assert.deepEqual(recs[0].series, [{ file: 't.csv', col: 4 }]);
  assert.equal(recs[1].series, keep1, 'unchanged: the same array');
  // The file on show; those with fewer columns.
  assert.equal(M.shownFileOf([a, t], 't.csv'), t);
  assert.equal(M.shownFileOf([a, t], 'x'), a);
  assert.equal(M.shownFileOf([], 'x'), null);
  assert.deepEqual(M.shortOf([a, t, bare], t, M.tableOf(t), true), [a, bare]);
  assert.deepEqual(M.shortOf([a, t, bare], t, M.tableOf(t), false), []);
});

test('what the plots draw: the series plotted, their data, normalisations, ranges, bars, boxes, the CSVs', ()=>{
  const a = dropped('a.csv', A_CSV), c = dropped('c.csv', C_CSV), t = dropped('t.csv', T_CSV);
  a.roles = ['x', 'y', 'ey', 'y'];
  c.roles = ['x', 'y', 'ey'];
  a.label = 'Same'; c.label = 'Same';
  a.names = { 1: 'Name' }; c.names = { 1: 'Name' }; t.names = { 1: 'Name', 2: 'Name' };
  const all = [a, c, t], map = M.seriesMapOf(M.tracesOf(U, all, []));
  const card = { type: 'xy', norm: 'none', series: [{ file: 'a.csv', col: 1, scale: 2, offset: 1 }, { file: 'c.csv', col: 1, scale: 1, offset: 0 }, { file: 't.csv', col: 1, scale: 1, offset: 0 },
    { file: 't.csv', col: 2, scale: 1, offset: 0 }, { file: 'gone', col: 1, scale: 1, offset: 0 }] };
  const list = M.plotted(card, map);
  assert.deepEqual(list.map(e=> e.name), ['Name', 'Name (Same)', 'Name (t)', 'Name (2)'], 'names made unique: the file\'s label, then a number');
  // An XY plot: points with a y and an x; errors as |e| times the scale; the range with its errors, 5 % over and under.
  made.n = made.taken = 0;
  const d = M.dataOf(U, 'xy', list[0].s.t, list[0].s, list[0].r);
  assert.deepEqual(d, { xs: [1, 2, 4], ys: [24, 27, 33], exs: [NaN, NaN, NaN], eys: [0.2, 0.4, NaN], cats: [] });
  assert.equal(M.dataOf(U, 'xy', list[0].s.t, list[0].s, { ...list[0].r }), d, 'kept by its column and operations');
  assert.deepEqual([made.n, made.taken], [1, 1]);
  assert.deepEqual(M.divsOf(U, 'xy', 'none', list), [1, 1, 1, 1]);
  assert.deepEqual(M.divsOf(U, 'xy', 'local', list), [16, 3, 3, 4], 'c.csv in an XY plot: its one point with a numeric x');
  assert.deepEqual(M.divsOf(U, 'xy', 'global', list), [16, 16, 16, 16]);
  assert.deepEqual(M.dataOf(U, 'xy', list[0].s.t, list[0].s, list[0].r, 16).ys, [11.5/8 + 1, 13/8 + 1, 16/8 + 1]);
  const R = M.xyRange([d]);
  assert.deepEqual(R, { x0: 1, x1: 4, y0: 23.8 - (33 - 23.8)*0.05, y1: 33 + (33 - 23.8)*0.05 });
  assert.deepEqual(M.xyRange([{ xs: [], ys: [], exs: [], eys: [] }]), { x0: 0, x1: 1, y0: -0.05, y1: 1.05 });
  assert.deepEqual(M.xyRange([{ xs: [2], ys: [5], exs: [0], eys: [0] }]), { x0: 2, x1: 2, y0: 4.75, y1: 5.25 }, 'one point: 5 % of |y|');
  assert.deepEqual(M.errBars({ xs: [1, 2], ys: [5, 6], exs: [0.5, NaN], eys: [1, 0] }), { sx: [1, 1, 0.5, 1.5], sy: [4, 6, 5, 5] });
  assert.equal(M.xTitle(list.slice(0, 1)), 'Time (s)');
  assert.equal(M.yTitle(list), '', 'names that differ: none');
  assert.equal(M.yTitle(list.slice(0, 1)), 'Signal (mV)');
  assert.deepEqual([M.axisTitle([{ name: '', unit: 's' }, { name: 'x', unit: '' }]), M.axisTitle([{ name: 'x', unit: 's' }, { name: '', unit: '' }, { name: 'x', unit: 's' }]), M.axisTitle([{ name: '', unit: 's' }]), M.axisTitle([{ name: 'Row', unit: '' }])],
    ['', 'x (s)', '(s)', 'Row'], 'names or units that differ: none; a column of neither left out');
  assert.equal(M.viewKey(list.slice(0, 1), 'none'), 'a.csv\n1{"file":"a.csv","col":1,"scale":2,"offset":1}\nnone');
  // A bar chart: categories as they come (a number as it reads), the first value of one twice.
  const bars = { type: 'bar', series: [{ file: 'c.csv', col: 1, scale: 1, offset: 5 }] }, bl = M.plotted(bars, map);
  const bd = M.dataOf(U, 'bar', bl[0].s.t, bl[0].s, bl[0].r);
  assert.deepEqual(bd.cats, ['Cat A', 'Cat B', '1', 'Cat A']);
  assert.deepEqual(bd.ys, [12.5, 7.25, 3, 9], 'no offset in a bar chart');
  const B = M.barsOf(bl, [bd]);
  assert.deepEqual(B, { cats: [{ label: 'Cat A', name: 'Cat A' }, { label: 'Cat B', name: 'Cat B' }, { label: '1', name: '1' }], series: [{ name: 'Name', color: bl[0].color, vals: [12.5, 7.25, 3], errs: [1.2, 0.8, 0.1] }], digits: 1 });
  assert.equal(M.barsOf(bl, [{ cats: ['a'], ys: [0.004], eys: [NaN] }]).digits, 5);
  assert.equal(M.barsOf(bl, [{ cats: ['a'], ys: [NaN], eys: [NaN] }]).digits, 2);
  // A box plot: its stats, its label, its layout.
  const st = M.boxStatsOf(U, [{ ys: [1, 2, 3, 4, 100] }, { ys: [5] }, { ys: [] }]);
  assert.equal(st[0].mean, 22);
  assert.ok(Number.isNaN(st[1].err));
  assert.equal(st[2], PAGE.boxStats([]), 'no value: no box');
  assert.deepEqual([M.boxLabel(st[0]), M.boxLabel(st[1])], [`22±${M.sig(PAGE.stdArr([1, 2, 3, 4, 100]))}`, '5']);
  const L = M.boxLayout(U, [{ name: 'one' }, { name: 'two' }, { name: 'three' }], st, MCTX, { width: 700, height: 400 });
  assert.equal(L.n, 3);
  assert.equal(L.hw, 16);
  assert.ok(L.y1 > 100 && L.y0 === 0 && L.bottom > 26);
  assert.equal(M.boxLayout(U, [{ name: 'a' }], [st[1]], MCTX, { width: 0, height: 0 }).hw, Math.min(16, (640 - 75)/2*0.3), 'no box: 640 × 420');
  // The CSV: a series' columns beside the others'.
  const cols = M.csvCols(U, { ...card, series: card.series.slice(0, 2) }, list.slice(0, 2));
  assert.deepEqual(cols.map(x=> x.h), ['Name - Time (s)', 'Name', 'Name - err y', 'Name (Same) - Sample', 'Name (Same)', 'Name (Same) - err y']);
  assert.deepEqual(cols[2].v, ['0.2', '0.4', '']);
  assert.deepEqual(M.csvCols(U, bars, bl).map(x=> x.h), ['Name - category', 'Name', 'Name - err y']);
  assert.deepEqual(M.csvCols(U, { type: 'box', norm: 'none', series: bars.series }, bl).map(x=> [x.h, x.v.length]), [['Name', 4]]);
  // An operation typed; Add series' files and what Done gives.
  assert.deepEqual(['2', '0,5', '-1e2', '.5', '1.', ' 3', 'abc', '', '1e', '1,2,3'].map(M.opIn), [2, 0.5, -100, 0.5, 1, null, null, null, null, null]);
  assert.deepEqual([...M.pickGroups(map)].map(([f, ss])=> [f.name, ss.map(s=> s.col)]), [['a.csv', [1, 3]], ['c.csv', [1]], ['t.csv', [1, 2, 4]]]);
  const ser = [{ file: 'a.csv', col: 1 }, { file: 'x.csv', col: 1 }, { file: 't.csv', col: 4 }];
  const listed = new Set(map.keys());
  assert.equal(M.pickedSeries(ser, ['a.csv\n1', 't.csv\n4'], listed, map), null, 'nothing changed');
  assert.deepEqual(M.pickedSeries(ser, ['c.csv\n1', 'a.csv\n1'], listed, map), [ser[0], ser[1], { file: 'c.csv', col: 1, scale: 1, offset: 0 }], 'kept in place, a file left out stays, the new after');
});

test('the markup: a card\'s body, its series, the legends, the Data card\'s head and table, Add series, every name escaped', ()=>{
  const P = '"><i x=1>&';
  assert.ok(H.figInfo('TAIL').endsWith(' TAIL') && H.figInfo('').startsWith('A plot of the series chosen under <b>Series</b>'));
  const body = H.cardBody({ id: 7 }, HU);
  for (const id of ['fig7Box', 'fig7Svg', 'fig7Empty', 'fig7Legend', 'fig7Norm', 'fig7List', 'fig7Add']) assert.equal(body.split(`id="${id}"`).length, 2, id + ' once');
  assert.match(body, /data-csv-names="fig_plot\.csv" data-dl-name="Plot\.svg" data-dl-legend="fig7Legend"/);
  assert.equal((body.match(/<option value="/g) || []).length, 3);
  const s = { key: 'a.csv\n1' + P, f: { label: P }, auto: 'Series 1', cols: 'Cols 1,2' };
  const list = [{ r: { scale: 2, offset: P }, s, name: P }];
  const xy = H.serListHtml({ series: [1, 2, 3] }, list, M.OPS.xy, HU), box = H.serListHtml({ series: [1] }, list, M.OPS.box, HU);
  assert.ok(!xy.includes('<i x=1>') && xy.includes('&quot;&gt;&lt;i x=1&gt;&amp;'));
  assert.match(xy, /data-op="scale" value="2"/);
  assert.match(xy, /data-op="offset" value="&quot;&gt;/);
  assert.match(xy, /2 series left out of the analysis not shown\./);
  assert.ok(!box.includes('data-op="offset"') && !box.includes('left out'));
  assert.equal(H.legendHtml('box', [{ color: '#fff', name: P }], HU), '<span><i class="mk-box" style="background:#fff"></i>&quot;&gt;&lt;i x=1&gt;&amp;</span>');
  assert.equal(H.legendHtml('xy', [{ color: '#fff', name: 'a' }], HU), '<span><i style="background:#fff"></i>a</span>');
  // The names over their columns: a series' x, y and errors one cell; a shared x, none blank.
  const ss = [{ col: 1, x: 0, ex: -1, ey: 2, name: P, def: 'D', auto: 'Series 1', cols: 'Cols 1,2' }, { col: 4, x: 3, ex: -1, ey: -1, name: 'B', def: 'B', auto: 'Series 2', cols: 'Cols 4,5' }];
  const cells = H.nameCells(ss, 6, HU);
  assert.equal(cells.match(/<th[^>]*>/g).join(''), '<th colspan="3" class="fig-name"><th colspan="2" class="fig-name"><th>');
  assert.ok(!cells.includes('<i x=1>'));
  assert.equal(H.nameCells([ss[0], { ...ss[1], x: 0 }], 5, HU).match(/<th[^>]*>/g).join(''), '<th><th colspan="2" class="fig-name"><th><th class="fig-name">', 'an x two series share: blank');
  const t = M.readTableText(A_CSV);
  const head = H.headHtml([], ['x', 'y', 'ey', ''], t, HU);
  assert.match(head, /<option value="ey" selected>err y<\/option>/);
  assert.match(head, /<tr class="fig-hd"><th>Time \(s\)<\/th>/);
  assert.equal(H.tableHtml({ rows: [['<a>', '1']] }, 'H', HU), '<table class="fig-cols"><thead>H</thead><tbody><tr><td>&lt;a&gt;</td><td>1</td></tr></tbody></table>');
  const g = dropped('g.csv', '1\n2\n');
  assert.equal(H.warnHtml([{ ...g, label: P }], { label: '<f>' }, { n: 4 }, HU), '<div class="alert warn">⚠ Same roles for all files: &quot;&gt;&lt;i x=1&gt;&amp; has 1 column, fewer than the 4 of &lt;f&gt;; the roles of the columns past its own do not apply to it.</div>');
  assert.equal(H.warnHtml([], {}, {}, HU), '');
  assert.match(H.PICK_HTML, /role="dialog" aria-modal="true" aria-label="Add series"/);
  assert.equal(H.pickFor('Plot 1'), 'Ticked: the series of Plot 1.');
  const pb = H.pickBodyHtml(new Map([[{ label: P }, [{ key: 'k' + P, auto: 'Series 1', cols: 'Cols 1,2', name: P }]]]), new Set(['k' + P]), HU);
  assert.ok(!pb.includes('<i x=1>') && / checked>/.test(pb) && /data-file aria-label="All the series of &quot;/.test(pb));
});

/* =========================================================
   40 CASES, done as fig.js does them (its wiring, in short, below): a Custom tab's state
   (files, the roles alike, the order, the cards) put back as modkit.js and fig.js restore
   it, then eight steps; after each, what the page shows (out). Their digests are those of
   v561's fig.js, run from its source on a page of stubs with the same steps done through
   its page (the selects, fields and buttons, the trace list's callbacks).
========================================================= */
function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function csvOf(r){
  const pick = a => a[Math.floor(r()*a.length)];
  const comma = r() < 0.35, sep = comma ? ';' : pick([',', '\t']), n = 2 + Math.floor(r()*4), rows = 2 + Math.floor(r()*7);
  const head = r() < 0.75 ? Array.from({ length: n }, ()=> pick(['Time (s)', 'Signal [mV]', 'err', 'Ref / K', 'A', 'B', 'Cat', '<b>"q"</b>', ''])) : null;
  const titles = head && r() < 0.3 ? Array.from({ length: n }, (_, c)=> c === 0 || r() < 0.3 ? pick(['series 1', 'series 2', 'S & T']) : '') : null;
  const cell = ()=>{ const q = r(); if (q < 0.05) return ''; if (q < 0.1) return pick(['n.a.', 'Cat A', 'Cat B']); const v = +(r()*100 - 20).toFixed(pick([0, 1, 2])); return comma ? String(v).replace('.', ',') : String(v); };
  const lines = [];
  if (titles) lines.push(titles.join(sep));
  if (head) lines.push(head.join(sep));
  for (let i = 0; i < rows; i++) lines.push(Array.from({ length: n }, (_, c)=> c === 0 && r() < 0.5 ? String(i + 1) : cell()).join(sep));
  return lines.join('\n') + '\n';
}
export function caseOf(seed){
  const r = rnd(seed * 7919 + 13), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p;
  const nf = 1 + Math.floor(r()*3), files = [];
  for (let i = 0; i < nf; i++){
    const name = `f${i + 1}.csv`, text = csvOf(r), t = M.readTableText(text);
    if (!t) continue;
    const roles = chance(0.5) ? M.fixRoles(Array.from({ length: t.n }, (_, c)=> c ? pick(['y', 'y', 'ey', 'ex', 'x', '']) : 'x')) : undefined;
    files.push({ name, text, ...(roles ? { roles } : {}), ...(chance(0.3) ? { names: { 1: pick(['Typed', 'a<b>', 'Name']) } } : {}), ...(chance(0.2) ? { colors: { 1: '#123456' } } : {}), ...(chance(0.2) ? { out: [1] } : {}) });
  }
  const keysOf = ()=> files.flatMap(f=> M.seriesCols(f.roles || M.firstRoles(M.readTableText(f.text))).map(s=> [f.name, s.col]));
  const ks = keysOf();
  const cards = Array.from({ length: Math.floor(r()*3) }, (_, i)=> ({ id: i + 1, type: pick(['xy', 'bar', 'box']), base: chance(0.2) ? 'Named: <x>' : '', nameAuto: true, collapsed: false,
    series: ks.filter(()=> chance(0.5)).map(([file, col])=> ({ file, col, scale: chance(0.2) ? -2 : 1, offset: chance(0.2) ? 0.5 : 0 })), norm: pick(['none', 'local', 'global']), fig: chance(0.2) ? { scalars: { w: 3 }, series: [] } : null }));
  const order = chance(0.3) ? ks.map(([f, c])=> f + '\n' + c).reverse() : undefined;
  const steps = Array.from({ length: 8 }, ()=>{
    const k = pick(['role', 'role', 'name', 'include', 'color', 'palette', 'reorder', 'label', 'remove', 'same', 'show', 'pick', 'pick', 'norm', 'op', 'op', 'del', 'figure']);
    const fi = Math.floor(r()*Math.max(1, files.length)), i = Math.floor(r()*8), ci = Math.floor(r()*Math.max(1, cards.length));
    switch (k){
      case 'role': return [k, fi, Math.floor(r()*5), pick(['x', 'y', 'ex', 'ey', ''])];
      case 'name': return [k, fi, Math.floor(r()*3), pick(['', 'Volt', 'x <y>', '  '])];
      case 'include': return [k, i, chance(0.5)];
      case 'color': return [k, i, pick(['#abcdef', 'nope'])];
      case 'palette': return [k, pick([['#111111', '#222222', '#333333'], ['bad'], ['#444444', 'bad']])];
      case 'reorder': return [k, i, Math.floor(r()*8)];
      case 'label': return [k, i, pick(['', 'Renamed', 'a<b>'])];
      case 'remove': return [k, i];
      case 'same': return [k, chance(0.6)];
      case 'show': return [k, fi];
      case 'pick': return [k, ci, Array.from({ length: 8 }, ()=> chance(0.4))];
      case 'norm': return [k, ci, pick(['none', 'local', 'global'])];
      case 'op': return [k, ci, Math.floor(r()*4), pick(['scale', 'offset']), pick(['2', '0,5', 'abc', '-1e1', '1'])];
      case 'del': return [k, ci, Math.floor(r()*4)];
      default: return [k, ci, pick([{ scalars: { w: 5 }, series: [1] }, { scalars: { w: 3 }, series: [] }])];
    }
  });
  return { files, same: chance(0.3), order, cards, shown: chance(0.4) ? files.length - 1 : 0, steps };
}
// The state a case starts from, as a project holds it (its files' bytes from their text).
export function stateOf(c){
  return { files: c.files.map(f=>{ const g = { name: f.name, label: f.name.replace(/\.[^.]+$/, ''), color: PAGE.colorOf(0), rawBytes: bytes(f.text) };
    for (const k of ['roles', 'names', 'colors', 'out']) if (f[k]) g[k] = structuredClone(f[k]);
    return g; }), same: c.same, ...(c.order ? { order: c.order.slice() } : {}), cards: c.cards.map(x=> structuredClone(x)) };
}

/* ---- fig.js's wiring, in short ---- */
const autoName = a => `Plot ${a.id}`;
function restoreCase(s0){
  const S = { all: [], same: false, order: [], recs: [], shownName: null };
  S.all = s0.files.map(f=> M.fileIn(U, { ...f })).filter(Boolean);
  S.same = s0.same === true;
  S.order = M.orderIn(s0.order);
  S.recs = (PAGE.cardList(s0.cards, M.KINDS) || []).map(c=> ({ base: typeof c.base === 'string' ? c.base : '', nameAuto: c.nameAuto !== false, name: '', collapsed: c.collapsed === true, ...M.cardIn(U, c), id: c.id, type: c.type }));
  settleNames(S.recs, Object.keys(M.KINDS), autoName);
  changed(S);
  return S;
}
const traces = S => M.tracesOf(U, S.all, S.order);
const seriesMap = S => M.seriesMapOf(traces(S));
const shown = S => M.shownFileOf(S.all, S.shownName);
function changed(S){ M.pruneCards(S.all, S.recs); const f = shown(S); if (f) S.shownName = f.name; }
function stepCase(S, st){
  const [k, a, b, c, d] = st, ts = traces(S), rec = S.recs[a], f = S.all[a];
  if (k === 'role'){ if (!f) return; S.shownName = f.name; if (b >= M.tableOf(f).n) return; f.roles = M.setRole(f.roles, b, c); if (S.same) M.giveRoles(S.all, f); changed(S); }
  else if (k === 'name'){ if (!f) return; S.shownName = f.name; const s = M.seriesOfFile(U, S.all, f, a)[b]; if (!s || s.name === c) return; f.names = M.namesWith(f.names, s.col, c, s.def).names; }
  else if (k === 'include'){ if (ts[a]){ M.setOut(ts[a], b); changed(S); } }
  else if (k === 'color'){ const t = ts[a]; if (t && t.s && U.isColor(b)) M.setColor(t, b); }
  else if (k === 'palette'){ const cs = a.filter(U.isColor); if (cs.length) M.setPalette(ts, cs); }
  else if (k === 'reorder'){ if (ts.length > 1 && a < ts.length && b < ts.length){ S.order = M.reordered(ts, a, b); changed(S); } }
  else if (k === 'label'){ const t = ts[a]; if (!t) return; if (!t.s){ t.f.label = b; changed(S); return; } t.f.names = M.namesWith(t.f.names, t.s.col, b, t.s.def).names; }
  else if (k === 'remove'){ const t = ts[a]; if (!t) return; if (M.whole(t)){ S.all.splice(S.all.indexOf(t.f), 1); if (!S.all.length){ S.shownName = null; S.order = []; } } else M.dropSeries(t); changed(S); }
  else if (k === 'same'){ S.same = a; const src = shown(S); if (S.same && src) M.giveRoles(S.all, src); changed(S); }
  else if (k === 'show'){ if (f){ S.shownName = f.name; } }
  else if (k === 'pick'){ if (!rec) return; const map = seriesMap(S), box = [...M.pickGroups(map).values()].flat().map(s=> s.key), on = new Set(rec.series.map(r=> M.keyOf(r.file, r.col)));
    const want = box.filter((key, i)=> b[i] === undefined ? on.has(key) : b[i] !== on.has(key)), next = M.pickedSeries(rec.series, want, new Set(box), map); if (next) rec.series = next; }
  else if (k === 'norm'){ if (rec && PAGE.ownKey(M.NORMS, b) && b !== rec.norm) rec.norm = b; }
  else if (k === 'op'){ const e = rec && M.plotted(rec, seriesMap(S))[b]; if (!e || !M.OPS[rec.type].includes(c)) return; const r = rec.series.find(x=> M.keyOf(x.file, x.col) === e.s.key), v = M.opIn(d.trim());
    if (v === null || Object.is(r[c], v)) return; rec.series = rec.series.map(x=> x === r ? { ...r, [c]: v } : x); }
  else if (k === 'del'){ const e = rec && M.plotted(rec, seriesMap(S))[b]; if (!e) return; const r = rec.series.find(x=> M.keyOf(x.file, x.col) === e.s.key); rec.series = rec.series.filter(x=> x !== r); }
  else if (k === 'figure'){ if (rec && M.plotted(rec, seriesMap(S)).length && JSON.stringify(b) !== JSON.stringify(rec.fig)) rec.fig = b; }
}
// What the page shows: the trace list, the Data card's head and warning, each card's list and plot, the CSVs, the state.
export function outOf(S){
  const ts = traces(S), map = M.seriesMapOf(ts), f = shown(S);
  const o = { rows: M.traceRows(ts).map(r=> [r.name, r.src, r.label, r.color, r.included]) };
  if (f){ const t = M.tableOf(f); o.head = H.headHtml(M.seriesOfFile(U, S.all, f, S.all.indexOf(f)), f.roles, t, HU); o.warn = H.warnHtml(M.shortOf(S.all, f, t, S.same), f, t, HU); }
  o.cards = S.recs.map(a=>{
    const list = M.plotted(a, map), c = { list: H.serListHtml(a, list, M.OPS[a.type], HU), add: !map.size, norm: a.norm };
    if (!list.length){ c.plot = 'empty'; return c; }
    const divs = M.divsOf(U, a.type, a.norm, list), data = list.map((e, k)=> M.dataOf(U, a.type, e.s.t, e.s, e.r, divs[k]));
    if (a.type === 'xy'){
      const R = M.xyRange(data), calls = [];
      list.forEach((e, k)=>{ const E = M.errBars(data[k]); if (E.sx.length) calls.push(['seg', dg(E.sx), dg(E.sy), e.color, e.name + ' (errors)', e.s.key + '\nerr']); calls.push(['line', dg(data[k].xs), dg(data[k].ys), e.color, e.name, e.s.key]); });
      c.plot = [M.xTitle(list), M.yTitle(list), [R.x0, R.x1, R.y0, R.y1], calls];
    } else if (a.type === 'bar'){
      const B = M.barsOf(list, data);
      c.plot = [B.cats, B.series.map(s=> [s.name, s.color, dg(s.vals), dg(s.errs)]), B.digits, HU.esc(M.yTitle(list))];
    } else {
      const st = M.boxStatsOf(U, data), L = M.boxLayout(U, list, st, MCTX, { width: 700, height: 400 });
      c.plot = [M.yTitle(list), L.bottom, [0, L.n + 1, L.y0, L.y1], list.map((e, k)=> [st[k] ? [canon(st[k]), e.color, L.hw, Math.max(st[k].hi, ...st[k].out), M.boxLabel(st[k])] : null, L.fit.labels[k], L.fit.rot, e.name, e.s.key])];
    }
    if (a.type !== 'bar') c.legend = H.legendHtml(a.type, list, HU);
    return c;
  });
  o.csv = S.recs.map(a=>{ const list = M.plotted(a, map); return list.length ? [`${PAGE.fileSafe(a.name)} - fig_plot.csv`, PAGE.wideCsv(M.csvCols(U, a, list))] : null; }).filter(Boolean);
  o.state = canon(M.stateOf(S.same, S.order, S.recs, saved));
  o.files = canon(S.all.map(g=> [g.name, g.label, g.roles, g.names, g.colors, g.out]));
  o.shows = canon(M.showsOf(S.all, S.shownName));
  return o;
}
export function runCase(c){
  const S = restoreCase(stateOf(c)), out = [];
  if (c.shown && S.all[c.shown]) S.shownName = S.all[c.shown].name;
  out.push(outOf(S));
  for (const st of c.steps){ stepCase(S, st); out.push(outOf(S)); }
  return canon(out);
}
export const CASES = 40;

test('40 cases as v561\'s fig.js gave them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
