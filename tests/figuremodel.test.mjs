/* The plots' figure composer's sidebar in Node, no browser (v564): what its fields and
   buttons do to the figure, worked out in figure-model.js (out of v563's figure.js
   wireControls). The keys that are numbers and those that reshape the sidebar; a panel placed
   and spanned (inside the grid, on no other, a span cut at its edge, junk typed), added in the
   first free cell (the grid grown when full) and removed (never the last; a linked plot's
   series with it, the others following their panel down); a range carried across a log
   switch (one a log axis cannot take giving way to the automatic one), handed over as the
   automatic one goes off (the figure's, a group's, the one on show), a range by hand as it
   stands or as it starts; the axes' settings for the panels edited (axes made where a panel
   had none); a setting for every series (a dash 'solid' none, any other key the symbol), the
   widths' ranges (a series' own, every series' their meeting, a bar's read back: v570); a
   division's name, colour and fill (the first's colour the series'), the colours a pick
   reaches (a bar's divisions cleared), the divisions' colours and fills cleared as by
   division goes off, the colours a palette would keep, a fill as its picker opens on it and
   takes it back (the series' own stopping the texture palette); text put into a rich field
   (raised, lowered, a character; the caret). Then 40 cases (random figures: panels in grids
   with spans and sharing groups, axes or none, curves and bars with divisions, ranges by
   hand, logs; ten steps each, done as figure.js does them, a field or a button of the
   sidebar each: figure, range, axes, every series, grid, labels, font, panels, categories,
   divisions, sharing, series, colours, by division, rich titles, panels added and removed;
   after each, the figure, the panel the axes are edited for and the sidebar's redraws) as
   v563's figure.js did them, run from its source on a page of stubs, each step's control
   put on its sidebar and used (its redraw recorded, not done): SHA-256 digests in
   tests/golden/figuremodel.json (npm run test:update writes them anew after a change meant to
   alter them). Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as FM from '../figure-model.js';
import * as L from '../figure-layout.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/figuremodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (typeof o === 'number') return Object.is(o, -0) ? '#-0' : '#' + o;
  return x; });
const panel = (r, c, o = {}) => ({ r, c, rs: 1, cs: 1, title: '', axes: L.newAxes(), shareXWith: null, shareYWith: null, xAuto: true, yAuto: true, ...o });
const curve = (label, o = {}) => ({ id: 's' + label, kind: 'curve', key: label, given: label, label, panel: 0, color: '#1f77b4', width: 1.5, dash: '', marker: 'none', show: true, inLegend: true, xs: [1, 2, 3], ys: [2, 4, 1], ...o });
const bar = (label, o = {}) => ({ ...curve(label), id: 'b' + label, kind: 'bar', width: 0.8, texture: 'solid', texInv: false, errs: [0, 0, 0], ...o });
const fig = (o = {}) => ({ rows: 1, cols: 1, panels: [panel(0, 0)], series: [], shareX: true, shareY: true, xLog: false, yLog: false, xAuto: true, yAuto: true,
  xmin: 0, xmax: 1, ymin: 0, ymax: 1, xMan: {}, yMan: {}, xPanel: 0, yPanel: 0, rangePanel: 0, palScope: 'series', palByDiv: true, texScope: 'panel', texByDiv: false, palette: null, texPalette: null, cats: [], ...o });

test('the keys, a panel placed, added and removed', ()=>{
  for (const k of ['wmm', 'rows', 'xmin', 'catRot', 'legendFrameAlpha']) assert.ok(FM.NUM_KEYS.has(k), k);
  assert.ok(!FM.NUM_KEYS.has('xlabel') && FM.DL_NUM.has('dec') && !FM.DL_NUM.has('on'));
  assert.ok(FM.SHOWS_MORE.has('xLog') && FM.SHOWS_MORE.has('legendMode') && !FM.SHOWS_MORE.has('wmm'));
  const F = fig({ rows: 2, cols: 3, panels: [panel(0, 0), panel(0, 1, { cs: 2 }), panel(1, 0)] });
  assert.equal(FM.overlaps(F, 0, 0, 1, 1, 1), true, 'on panel 1');
  assert.equal(FM.overlaps(F, 1, 0, 1, 1, 2), false, 'itself');
  assert.equal(FM.movePanel(F, 2, 'c', '3'), true); assert.deepEqual([F.panels[2].r, F.panels[2].c], [1, 2]);
  assert.equal(FM.movePanel(F, 2, 'c', '2'), true, 'a free cell');
  assert.equal(FM.movePanel(F, 0, 'cs', '2'), false, 'onto panel 1: kept'); assert.equal(F.panels[0].cs, 1);
  assert.equal(FM.movePanel(F, 0, 'rs', '5'), true, 'a span cut at the edge'); assert.equal(F.panels[0].rs, 2);
  assert.equal(FM.movePanel(F, 1, 'r', '3'), false, 'past the grid');
  assert.equal(FM.movePanel(F, 1, 'r', 'x'), true, 'junk: the first row'); assert.equal(F.panels[1].r, 0);
  assert.deepEqual(FM.newPanelCell(F), [1, 2], 'the first free cell'); assert.equal(F.rows, 2);
  const full = fig({ panels: [panel(0, 0)] });
  assert.deepEqual(FM.newPanelCell(full), [1, 0], 'none free: a row more'); assert.equal(full.rows, 2);
  const G = fig({ panels: [panel(0, 0), panel(1, 0), panel(2, 0)], series: [curve('a', { panel: 0, sep: true }), curve('b', { panel: 1, sep: true }), curve('c', { panel: 1 }), curve('d', { panel: 2 })] });
  assert.equal(FM.dropPanel(G, 1), true);
  assert.deepEqual(G.series.map(s => [s.label, s.panel]), [['a', 0], ['c', 0], ['d', 1]], 'its linked series gone, the rest to the first, the next down');
  assert.equal(FM.dropPanel(fig(), 0), false, 'never the last');
});

test('the ranges: a log switch, handed over, a group\'s, by hand', ()=>{
  const F = fig({ xmin: 10, xmax: 1000, xMan: { 0: [1, 100], 1: [-1, 5] }, panels: [panel(0, 0), panel(1, 0)] });
  FM.relogRanges(F, 'x', true);
  assert.deepEqual([F.xmin, F.xmax, F.xMan[0], F.xMan[1], F.panels[1].xAuto], [1, 3, [0, 2], undefined, true], 'one ≤ 0: the automatic range');
  FM.relogRanges(F, 'x', false);
  assert.deepEqual([F.xmin, F.xmax, F.xMan[0]], [10, 1000, [1, 100]]);
  const Y = fig({ ymin: -2, ymax: 3 }); FM.relogRanges(Y, 'y', true); assert.equal(Y.yAuto, true);
  assert.deepEqual([FM.selPanel(fig({ xPanel: 5, panels: [panel(0, 0), panel(1, 0)] }), true), FM.selPanel(fig({ yPanel: -1 }), false), FM.selPanel(fig({ xPanel: '1' }), true)], [1, 0, 0]);
  const r = { xOf: [[0, 5], [1, 9]], yOf: [null, [2, 3]] };
  const H = fig({ xPanel: 1, yPanel: 0 }); FM.handOver(H, 'xAuto', r); FM.handOver(H, 'yAuto', r);
  assert.deepEqual([H.xmin, H.xmax, H.ymin, H.ymax], [1, 9, 0, 1]);
  let asked = 0; const ranges = () => (asked++, r);
  const S = fig(); assert.equal(FM.rangeAuto(S, true, true, 1, false, ranges), true);
  assert.deepEqual([S.xmin, S.xmax, S.xAuto, asked], [1, 9, false, 1]);
  const P = fig({ panels: [panel(0, 0), panel(1, 0)], yMan: { 1: [7, 8] } });
  assert.equal(FM.rangeAuto(P, false, false, 1, false, ranges), true); assert.deepEqual([P.yMan[1], P.panels[1].yAuto, asked], [[7, 8], false, 1], 'a range by hand kept, the ranges not asked');
  assert.equal(FM.rangeAuto(P, true, false, 0, false, ranges), true); assert.deepEqual([P.xMan[0], asked], [[0, 5], 2]);
  assert.notEqual(P.xMan[0], r.xOf[0], 'a copy');
  assert.equal(FM.rangeAuto(P, true, false, 4, true, ranges), false, 'no such panel');
  assert.deepEqual([FM.manOf(P, 'yMan', 1, r), FM.manOf(P, 'yMan', 0, r), FM.manOf(P, 'xMan', 1, r)], [[7, 8], [0, 1], [1, 9]]);
});

/* v570: a width field's range: a bar's [0.1, 1], a line's [0.2, 6]; the field for every series
   their meeting ([0.2, 1] with both: to v569 its least 0.1, a line's 0.2 refused by its own
   field); a bar's width read back put inside its range, one inside it as it was. */
test('the widths\' ranges: a series\' own, every series\' (their meeting), a bar\'s read back (v570)', ()=>{
  assert.deepEqual([FM.widthRange(curve('a')), FM.widthRange(bar('b'))], [[0.2, 6], [0.1, 1]]);
  assert.deepEqual(FM.everyWidthRange([curve('a'), curve('b')]), [0.2, 6], 'lines alone');
  assert.deepEqual(FM.everyWidthRange([bar('a'), bar('b')]), [0.1, 1], 'bars alone');
  assert.deepEqual(FM.everyWidthRange([curve('a'), bar('b')]), [0.2, 1], 'both');
  assert.deepEqual([3, 1.0001, 1, 0.8, 0.1, 0.05, 0].map(FM.barWidth), [1, 1, 1, 0.8, 0.1, 0.1, 0.1]);
  assert.ok(Number.isNaN(FM.barWidth(NaN)));
  // (v571: a line's width read back put inside 0.2–6, its own field's range: one of 0.1–0.19
  // could be saved from the field for every series to v569)
  assert.deepEqual([0.1, 0.15, 0.19, 0.2, 1.5, 6, 7].map(w=> FM.seriesWidth({ ...curve('a'), width: w })), [0.2, 0.2, 0.2, 0.2, 1.5, 6, 6]);
  assert.deepEqual([0.05, 0.5, 3].map(w=> FM.seriesWidth({ ...bar('a'), width: w })), [0.1, 0.5, 1]);
  assert.ok([undefined, NaN].every(w=> !Number.isFinite(FM.seriesWidth({ ...curve('a'), width: w }))), 'no number: as it is');
});

test('every series, the axes, the divisions, the colours and fills, a rich field', ()=>{
  const F = fig({ panels: [panel(0, 0), { r: 1, c: 0, rs: 1, cs: 1 }], series: [curve('a'), bar('b', { divs: [{ name: 'x', color: '#111111', texture: 'dots' }, { color: '#222222' }] })] });
  FM.setAxes(F, [0, 1, 7], 'left', 'minor', true);
  assert.equal(F.panels[0].axes.left.minor, true); assert.deepEqual(F.panels[1].axes.left, { ...L.newSide(true), minor: true }, 'axes made');
  FM.setEvery(F, 'dash', 'solid'); FM.setEvery(F, 'width', 3); FM.setEvery(F, 'circle-f', 'square-o'); FM.setEvery(F, 'show', false);
  assert.deepEqual(F.series.map(s => [s.dash, s.width, s.marker, s.show]), [['', 3, 'square-o', false], ['', 3, 'square-o', false]]);
  FM.setEvery(F, 'dash', '5,4'); assert.equal(F.series[0].dash, '5,4');
  const b = F.series[1];
  FM.setDiv(b, 2, { name: 'third' }); assert.deepEqual(b.divs[2], { name: 'third' });
  FM.setDivColor(b, 0, '#abcdef'); FM.setDivColor(b, 1, '#fedcba');
  assert.deepEqual([b.color, b.divs[0].color, b.divs[1].color], ['#abcdef', '#111111', '#fedcba'], 'the first division\'s colour is the series\'');
  assert.deepEqual(FM.divColors(b), ['#111111', '#fedcba', '#abcdef']);
  assert.deepEqual(FM.colorsInUse(F), ['#1f77b4', '#111111', '#fedcba', '#abcdef']);
  assert.deepEqual(FM.colorsInUse({ ...F, palByDiv: false }), ['#1f77b4', '#abcdef']);
  assert.deepEqual(FM.fillOf(b), { texture: 'solid', inv: false });
  assert.deepEqual(FM.fillOf(b, 0), { texture: 'dots', inv: false });
  FM.setFill(F, b, 1, { texture: 'grid', inv: true }); assert.deepEqual([b.divs[1].texture, b.divs[1].texInv], ['grid', true]);
  F.texPalette = ['solid'];
  FM.setFill(F, b, undefined, { texture: 'cross', inv: false });
  assert.deepEqual([b.texture, b.texInv, b.divs.map(d => d.texture), F.texPalette], ['cross', false, [null, null, null], null], 'the series\' own over every division\'s');
  FM.setColors([F.series[0], b], '#000000');
  assert.deepEqual([F.series[0].color, b.color, b.divs.map(d => d.color)], ['#000000', '#000000', [null, null, null]]);
  const c = bar('c', { divs: [{ color: '#1', texture: 't' }] });
  FM.clearBarColors({ series: [c, curve('d', { divs: [{ color: '#2' }] })] }); FM.clearBarTex({ series: [c] });
  assert.deepEqual(c.divs, [{ color: null, texture: null, texInv: null }]);
  assert.deepEqual(FM.richInsert('E gap', 2, 5, null, '_'), { value: 'E _{gap}', caret: 8 });
  assert.deepEqual(FM.richInsert('x', 1, 1, null, '^'), { value: 'x^{}', caret: 3 }, 'an empty selection: inside the braces');
  assert.deepEqual(FM.richInsert('ab', 1, 2, 'α', null), { value: 'aα', caret: 2 });
});

/* =========================================================
   40 CASES, done as figure.js's sidebar does them (its wiring, in short, below): a figure,
   then ten steps, each a field or a button; after each, the figure, axSel and the redraws
   asked for. Their digests are those of v563's figure.js, run from its source on a page of
   stubs, each step's control put on its sidebar and used, its redraw recorded and not done.
========================================================= */
function rnd(seed){ let s = seed >>> 0 || 1; return ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const NUMS = ['', 'abc', '1,5', '0', '-3', '10', '1e3', '250', '0.001', '2', '7.5', '45'];
export function caseOf(seed){
  const r = rnd(seed * 7907 + 3), pick = a => a[Math.floor(r()*a.length)], chance = p => r() < p, int = n => Math.floor(r()*n);
  const rows = 1 + int(2), cols = 1 + int(3), panels = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (!panels.length || chance(0.7))
    panels.push(chance(0.2) ? { r: i, c: j, rs: 1, cs: 1 } : panel(i, j, { ...(panels.length && chance(0.3) ? { shareXWith: 0 } : {}), ...(chance(0.2) ? { yAuto: false } : {}) }));
  const series = Array.from({ length: 1 + int(4) }, (_, k)=> chance(0.5)
    ? curve('c' + k, { panel: int(panels.length), ...(chance(0.2) ? { sep: true } : {}) })
    : bar('b' + k, { panel: int(panels.length), ...(chance(0.5) ? { divs: [{ name: 'd0', color: '#123456' }, { name: 'd1', texture: 'dots' }], divOf: [0, 1, 1] } : {}) }));
  const F = fig({ rows, cols, panels, series, shareX: chance(0.6), shareY: chance(0.6), xLog: chance(0.15), xmin: pick([0, 2]), xmax: pick([1, 50]),
    xMan: chance(0.4) ? { 0: [1, 3] } : {}, yMan: chance(0.3) ? { 1: [-1, 4] } : {}, palScope: pick(['series', 'panel']), palByDiv: chance(0.6), texByDiv: chance(0.3),
    xlabel: pick(['Time (s)', 'E_{g}', '']), ylabel: 'Signal', grid: { x: false, y: false, minor: false, dash: '2,3' }, font: { family: 'Inter', tick: 8, axis: 9, legend: 8, title: 9 },
    dataLabels: { on: false, dec: 2, pos: 'above', rot: 0, size: 7, off: 3, autoInk: false }, catNames: {}, catRot: 0, catRotAuto: true, plotAuto: true, plotW: 0, plotH: 0 });
  const ns = series.length, np = panels.length;
  const steps = Array.from({ length: 10 }, ()=>{
    const k = pick(['knum', 'knum', 'kcheck', 'kcheck', 'ksel', 'rauto', 'ak', 'man', 'all', 'g', 'dl', 'f', 'pk', 'pk', 'bark', 'dk', 'share', 'sk', 'dsw', 'sw', 'bydiv', 'texbydiv', 'rich', 'addpanel', 'delpanel']);
    switch (k){
      case 'knum': return ['k', pick(['wmm', 'rows', 'cols', 'xmin', 'xmax', 'ymax', 'catRot', 'legendFrameAlpha', 'dpi', 'plotW', 'minorX']), pick(NUMS), 'num', pick(['1', '0', '-1e12']), pick(['8', '2000', '1e12', '90'])];
      case 'kcheck': return ['k', pick(['plotAuto', 'catRotAuto', 'xLog', 'yLog', 'xAuto', 'yAuto', 'shareX', 'shareY', 'xStepAuto', 'legendFrame', 'innerClean']), chance(0.5), 'check'];
      case 'ksel': return ['k', ...pick([['axSel', pick(['all', '0', String(np - 1)])], ['rangePanel', String(int(np + 1))], ['xPanel', String(int(np))], ['yPanel', '0'], ['legendMode', pick(['none', 'global'])], ['palScope', pick(['series', 'panel'])], ['xlabel', pick(['k_{B}T', ''])]]), 'sel'];
      case 'rauto': return ['rauto', pick(['x', 'y']), chance(0.5)];
      case 'ak': return chance(0.7) ? ['ak', pick(L.SIDES), pick(['on', 'major', 'minor', 'labels', 'title']), chance(0.5), 'check'] : ['ak', pick(L.SIDES), 'dir', pick(['in', 'out', 'both']), 'sel'];
      case 'man': return ['man', pick(['xMan', 'yMan']), int(2), pick(NUMS)];
      case 'all': return pick([['all', 'show', chance(0.5), 'check'], ['all', 'inLegend', chance(0.5), 'check'], ['all', 'width', pick(NUMS), 'num', '0.1', '10'], ['all', 'dash', pick(['solid', '5,4', '']), 'sel'], ['all', 'marker', pick(['none', 'circle-f', '']), 'sel']]);
      case 'g': return pick([['g', pick(['x', 'y', 'minor']), chance(0.5), 'check'], ['g', 'dash', pick(['', '2,3']), 'sel']]);
      case 'dl': return pick([['dl', 'on', chance(0.5), 'check'], ['dl', pick(['rot', 'off', 'dec', 'size']), pick(NUMS), 'num', '0', '24'], ['dl', 'pos', pick(['above', 'center']), 'sel']]);
      case 'f': return pick([['f', 'family', pick(['Inter', 'Arial']), 'sel'], ['f', pick(['tick', 'axis']), pick(NUMS), 'num', '4', '24']]);
      case 'pk': return pick([['pk', int(np + 1), pick(['title', 'ylabel']), pick(['P', '<b>']), 'text'], ['pk', int(np), pick(['r', 'c', 'rs', 'cs']), pick(['1', '2', '3', 'x', '0']), 'num']]);
      case 'bark': return ['bark', int(ns + 1), int(3), pick(['A', '']), 'text'];
      case 'dk': return ['dk', int(ns), int(3), pick(['first', 'n<2>']), 'text'];
      case 'share': return ['share', int(np + 1), pick(['shareXWith', 'shareYWith']), pick(['', '0', '1']), 'sel'];
      case 'sk': return pick([['sk', int(ns + 1), pick(['show', 'inLegend']), chance(0.5), 'check'], ['sk', int(ns), 'width', pick(NUMS), 'num', '0.2', '6'], ['sk', int(ns), 'label', pick(['L', '']), 'text'], ['sk', int(ns), pick(['dash', 'marker']), pick(['5,4', 'circle-o']), 'sel']]);
      case 'dsw': return ['dsw', int(ns + 1), int(3), pick(['#abcdef', '#000000'])];
      case 'sw': return ['sw', int(ns + 1), pick(['#aaaaaa', '#ff0000'])];
      case 'bydiv': return ['bydiv', chance(0.5)];
      case 'texbydiv': return ['texbydiv', chance(0.5)];
      case 'rich': return ['rich', pick(['xlabel', 'ylabel']), pick(['^', '_']), int(3), 3 + int(3)];
      case 'addpanel': return ['addpanel'];
      default: return ['delpanel', int(np)];
    }
  });
  return { F, steps, inner: { w: 120 + int(10), h: 80 }, catRot: pick([30, 45]) };
}

/* ---- figure.js's sidebar, in short: a control as its wiring takes it, through figure-model.js.
   S: the figure, axSel, the last drawing's plot area and tilt, the redraws asked for. ---- */
const readNum = (raw, min, max)=>{
  const v = parseFloat(String(raw).replace(',', '.')), lo = parseFloat(min), hi = parseFloat(max);
  return !isFinite(v) || (isFinite(lo) && v < lo) || (isFinite(hi) && v > hi) ? null : v;
};
function applyK(S, k, v, how, min, max){
  const F = S.F, C = { F }, checked = how === 'check' && v;
  if (k === 'axSel'){ S.axSel = v === 'all' ? 'all' : +v; S.redraws.push(true); return null; }
  if (k === 'palScope'){ F.palScope = v; S.redraws.push(true); return null; }      // (no palette to deal: F.palette none)
  if (k === 'rangePanel'){ F.rangePanel = +v; S.redraws.push(true); return null; }
  if (k === 'xPanel' || k === 'yPanel'){ F[k] = +v; F.rangePanel = +v; S.redraws.push(true); return null; }
  let rebuild = false;
  if (k === 'plotAuto' && !checked){ F.plotW = S.inner.w; F.plotH = S.inner.h; rebuild = true; }
  if (k === 'plotAuto' && checked) rebuild = true;
  if (k === 'catRotAuto' && !checked) F.catRot = S.catRot;
  if (k === 'xLog' || k === 'yLog') FM.relogRanges(F, k[0], checked);
  if ((k === 'xAuto' || k === 'yAuto') && !checked) FM.handOver(F, k, L.computeRanges(C));
  if (FM.NUM_KEYS.has(k)){
    let n = readNum(v, min, max); if (n === null) return null;
    if (/^[xy]m(in|ax)$/.test(k)){ n = L.takenOf(C, k[0], n); if (n === null) return null; }
    F[k] = n;
  } else F[k] = how === 'check' ? checked : v;
  if (k === 'rows' || k === 'cols'){ F[k] = Math.max(1, Math.round(F[k] || 1)); rebuild = true; }
  if (FM.SHOWS_MORE.has(k)) rebuild = true;
  return rebuild;
}
function control(S, st){
  const F = S.F, C = { F }, [kind, a, b, c, d, e] = st;
  if (kind === 'k') return applyK(S, a, b, c, d, e);
  if (kind === 'rauto'){
    const X = a === 'x', shared = X ? F.shareX : F.shareY, sel = FM.selPanel(F, X);
    const i = shared ? sel : L.rangeRoot(C, sel, X ? 'shareXWith' : 'shareYWith');
    return FM.rangeAuto(F, X, shared, i, b, () => L.computeRanges(C)) ? true : null;
  }
  if (kind === 'ak'){ FM.setAxes(F, S.axSel === 'all' ? F.panels.map((_, i)=> i) : [S.axSel], a, b, c); return false; }
  if (kind === 'man'){
    const i = L.rangeRoot(C, FM.selPanel(F, a === 'xMan'), a === 'xMan' ? 'shareXWith' : 'shareYWith'), cur = FM.manOf(F, a, i, L.computeRanges(C));
    let v = readNum(c, '-1e12', '1e12'); if (v === null) return null;
    v = L.takenOf(C, a[0], v); if (v === null) return null;
    cur[b] = v; F[a][i] = cur; return false;
  }
  if (kind === 'all'){
    if (a === 'show' || a === 'inLegend') FM.setEvery(F, a, b);
    else if (b === '') return null;
    else if (a === 'width'){ const w = readNum(b, d, e); if (w === null) return null; FM.setEvery(F, a, w); }
    else FM.setEvery(F, a, b);
    return true;
  }
  if (kind === 'g'){ F.grid[a] = b; return false; }
  if (kind === 'dl'){ if (FM.DL_NUM.has(a)){ const v = readNum(b, d, e); if (v === null) return null; F.dataLabels[a] = v; } else F.dataLabels[a] = b; return a === 'on'; }
  if (kind === 'f'){ if (a === 'family') F.font.family = b; else { const v = readNum(b, d, e); if (v === null) return null; F.font[a] = v; } return false; }
  if (kind === 'pk'){ const p = F.panels[a]; if (!p) return null; if (b === 'title' || b === 'ylabel'){ p[b] = c; return false; } return !FM.movePanel(F, a, b, c); }
  if (kind === 'bark'){ const s = F.series[a]; if (!s) return null; F.catNames = { ...F.catNames, [s.xs[b]]: c }; return false; }
  if (kind === 'dk'){ const s = F.series[a]; if (!s) return null; FM.setDiv(s, b, { name: c }); return false; }
  if (kind === 'share'){ const p = F.panels[a]; if (!p) return null; p[b] = c === '' ? null : +c; return true; }
  if (kind === 'sk'){
    const s = F.series[a]; if (!s) return null;
    if (b === 'show' || b === 'inLegend') s[b] = c;
    else if (b === 'width'){ const v = readNum(c, e, st[6]); if (v === null) return null; s.width = v; }
    else if (b === 'label') s.label = s.rename = c;
    else s[b] = c;
    return false;
  }
  return null;
}
// figure.js samePositionSeries: by panel, the series at the same place in every panel.
function samePosition(F, i){
  const picked = F.series[i];
  if (F.palScope !== 'panel') return [picked];
  const seen = new Map(), posOf = [];
  F.series.forEach((s, k)=>{ const n = seen.get(s.panel) || 0; posOf[k] = n; seen.set(s.panel, n + 1); });
  return F.series.filter((_, k)=> posOf[k] === posOf[i]);
}
function click(S, st){
  const F = S.F, [kind, a, b, c] = st;
  if (kind === 'dsw'){ const s = F.series[a]; if (!s) return; FM.setDivColor(s, b, c); F.palette = null; S.redraws.push(false); }
  else if (kind === 'sw'){ if (!F.series[a]) return; FM.setColors(samePosition(F, a), b); F.palette = null; S.redraws.push(false); }
  else if (kind === 'bydiv'){ F.palByDiv = a; if (!a) FM.clearBarColors(F); S.redraws.push(true); S.colors = FM.colorsInUse(F); }
  else if (kind === 'texbydiv'){ F.texByDiv = a; if (!a) FM.clearBarTex(F); S.redraws.push(true); }
  else if (kind === 'rich'){ const { value } = FM.richInsert(F[a], c, st[4], null, b); F[a] = value; S.redraws.push(false); }
  else if (kind === 'addpanel'){
    const spot = FM.newPanelCell(F);
    F.panels.push(panel(spot[0], spot[1]));
    const n = F.series.length, P = F.panels.length;
    if (n) F.series.forEach((s, i)=>{ s.panel = Math.floor(i * P / n); });
    S.redraws.push(true);
  } else if (kind === 'delpanel'){ if (FM.dropPanel(F, a)) S.redraws.push(true); }
}
export function runCase(c){
  const S = { F: structuredClone(c.F), axSel: 'all', inner: c.inner, catRot: c.catRot, redraws: [], colors: null }, out = [];
  for (const st of c.steps){
    S.redraws = []; S.colors = null;
    if (['dsw', 'sw', 'bydiv', 'texbydiv', 'rich', 'addpanel', 'delpanel'].includes(st[0])) click(S, st);
    else { const rebuild = control(S, st); if (rebuild !== null) S.redraws.push(rebuild); }
    out.push(canon([S.F, String(S.axSel), S.redraws, S.colors]));
  }
  return out.join('\n');
}
export const CASES = 40;

/* v580: the words for a tick fault (figure-layout.js tickFaults): why an edit was refused,
   before what became of it, and the note under the Ticks while a setting by hand is not drawn
   as set. ALERTS-REVIEW.md R4: what, a colon, why; no "!", no "—", no version; a full stop. */
test('the words for ticks a setting by hand cannot have: an edit refused, the note (v580)', ()=>{
  const f = (ax, code, step = 10)=> ({ ax, code, step });
  assert.equal(FM.tickRefused(f('y', 'many'), '1e14 not taken; 10 kept.'), 'Too many Y ticks for this range: 1e14 not taken; 10 kept.');
  assert.equal(FM.tickRefused(f('x', 'same'), 'left ticked.'), 'X ticks too close to tell apart at these values: left ticked.');
  assert.equal(FM.tickRefused(f('y', 'narrow', ''), '1e12 not taken; 20 kept.'), 'Y range too narrow for its values: 1e12 not taken; 20 kept.');
  assert.equal(FM.tickNote(f('y', 'many')), 'Y step 10: too many ticks for this range: the automatic ticks drawn.');
  assert.equal(FM.tickNote(f('x', 'same', 1e-4)), 'X step 0.0001: ticks too close to tell apart at these values: the automatic ticks drawn.');
  assert.equal(FM.tickNote(f('x', 'narrow', '')), 'X range: too narrow for its values: only some ticks drawn.');
  assert.equal(FM.tickNote(f('y', 'fine', '')), 'Y minor ticks: too close to tell apart at these values: none drawn.');
  assert.equal(FM.tickNote(f('y', 'step', null)), 'Y step: not a number of 0 or more: the automatic ticks drawn.', 'a malformed project\'s step');
  for (const code of ['step', 'range', 'many', 'same', 'narrow', 'decades', 'minors', 'fine'])
    for (const t of [FM.tickRefused(f('y', code), 'left ticked.'), FM.tickNote(f('y', code))]){
      assert.match(t, /^[A-Z][^!—]*: [^!—]+\.$/, t);
      assert.doesNotMatch(t, /v\d{3}|undefined/, t);
    }
});

test('40 cases as v563\'s figure.js did them (golden digests)', ()=>{
  const got = { cases: Array.from({ length: CASES }, (_, i)=> sha(runCase(caseOf(i + 1)))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
