/* The plots' figure composer's layout in Node, no browser (v555). What drawFigure (figure.js)
   paints, worked out in figure-layout.js out of v554's drawFigure: the ticks (linear with a
   step snapped to its grid, a log axis's decades, its 1-2-5 under two decades, the minors
   on each), the ranges (a panel's data with its error bars and boxes, bars on their zero,
   a log axis's logarithms, the sharing groups and a cycle among them, a manual range), the
   sides with room beyond them, the margins (the numbers and titles measured, a global
   legend's strip, the cap, what spilled out, a plot area set by hand and placed), the tilt
   of the X names, each panel's frame and scales, the bars, boxes and error bars, a curve's
   path and symbols, the value labels and their ink, the tick marks, the numbers that give
   way to a neighbour's, the category names in runs, the axis titles, the legends, the
   shared titles, the texture tiles and the colours. Text is measured a fixed width a
   character (no browser, no fonts); plot.js's niceTicks and fmtTick and utils.js's
   tiltFits, which need a page to load, are taken from their source as they stand there.
   Then drawFigure as a whole, figure.js run from its source on a page that records every
   element, its attributes in the order they were set (every number by its shortest
   round-trip string), its text and its children: 24 figures, each drawn as the preview,
   again with a spill fed back and as the export, their markup, the tilt and plot area they
   settled on and their panels after hashed, as v554's drawFigure drew them:
   tests/golden/figlayout.json, which npm run test:update writes anew after a change meant
   to alter the figure. Under a second. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import * as L from '../figure-layout.js';
import * as FM from '../figure-model.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden', 'figlayout.json');
const sha = s => createHash('sha256').update(s).digest('hex');

// A declaration of the page's modules as it stands there: a function to its closing brace.
function decl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const i = src.search(new RegExp(`^function ${name}\\(`, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
  return src.slice(i, k + 1);
}
const { niceTicks, fmtTick } = new Function(['niceStep', 'niceTicks', 'fmtTick'].map(n => decl('plot.js', n)).join('\n') + '\nreturn { niceTicks, fmtTick };')();
const tiltFits = new Function(decl('utils.js', 'tiltFits') + '\nreturn tiltFits;')();
// A character is 0.55 of the font's size wide.
const textW = (s, px) => String(s).length * 0.55 * px;
const ctx = F => ({ F, textW, niceTicks, fmtTick, tiltFits });
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);

/* ---- A figure as figure.js buildModel makes one, and series as the plots give them ---- */
const panel = (r, c, extra = {}) => ({ r, c, rs: 1, cs: 1, title: '', axes: L.newAxes(), shareXWith: null, shareYWith: null, xAuto: true, yAuto: true, ...extra });
function model(over = {}){
  return {
    wmm: 160, hmm: 110, dpi: 300, plotAuto: true, plotW: 0, plotH: 0, rows: 1, cols: 1, shareX: true, shareY: true,
    legendMode: 'per-panel', legendCorner: 'tr', legendPlace: 'bottom', legendAlign: 'center', legendCols: 0,
    legendFrame: false, legendFrameLine: true, legendFrameAlpha: 1, legendGap: 6,
    font: { family: 'Inter', tick: 8, axis: 9, legend: 8, title: 9 }, xlabel: 'Time (s)', ylabel: 'Signal (mV)',
    xLog: false, yLog: false, xAuto: true, xmin: 0, xmax: 1, yAuto: true, ymin: 0, ymax: 1, xMan: {}, yMan: {},
    rangePanel: 0, xPanel: 0, yPanel: 0, xStep: 0, yStep: 0, xStepAuto: true, yStepAuto: true,
    minorX: 4, minorY: 4, minorXAuto: true, minorYAuto: true, align: 'cc', innerClean: true, inkColor: '#000000',
    grid: { x: false, y: false, minor: false, dash: '2,3' },
    dataLabels: { on: false, dec: 2, pos: 'above', rot: 0, size: 7, off: 3, autoInk: false },
    titleModeX: 'per-panel', titleModeY: 'per-panel', panels: [panel(0, 0)], series: [], cats: [], catNames: {},
    catRot: 0, catRotAuto: true, name: 'figure', ...over,
  };
}
const R = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const X50 = R(51, i => i);
const curve = (label, xs, ys, extra = {}) => ({ id: 's' + label, kind: 'curve', key: label, given: label, label, panel: 0, color: '#1f77b4', width: 1.5,
  dash: '', marker: 'none', show: true, inLegend: true, xs, ys, ...extra });
const bar = (label, xs, ys, extra = {}) => ({ id: 'b' + label, kind: 'bar', key: label, given: label, label, panel: 0, color: '#ff7f0e', width: 0.8,
  dash: '', marker: 'none', texture: 'solid', texInv: false, show: true, inLegend: true, xs, ys, errs: xs.map(() => 0), ...extra });
const cats = names => names.map((text, i) => ({ x: i + 1, text, rot: 0, key: text }));
const LINES = () => [
  curve('Alpha', X50, X50.map(x => 10 + 8 * Math.sin(x / 6))),
  curve('Beta', X50, X50.map(x => 12 + 5 * Math.cos(x / 9)), { color: '#d62728', width: 2, dash: '5,4' }),
  curve('Gamma ray', X50, X50.map(x => 3 + x * 0.3), { color: '#2ca02c', width: 1, marker: 'triangle-f' }),
];
const BARS = () => [
  bar('H2', R(6, i => i + 1), R(6, i => 3 + i * 1.7 - (i === 3 ? 6 : 0)), { errs: R(6, i => i % 2 ? 0.4 + i * 0.1 : 0) }),
  bar('O2', R(6, i => i + 1), R(6, i => 1 + i * 0.6), { color: '#1f77b4', errs: R(6, () => 0.3) }),
];
const BOXES = () => [bar('box', R(4, i => i + 1), R(4, i => 3.2 + i), { color: '#2ca02c', errs: R(4, i => i === 2 ? 0 : 0.4),
  boxes: R(4, i => ({ q1: 2 + i, med: 3 + i, q3: 4.5 + i, lo: 1 + i * 0.8, hi: 6 + i, mean: i === 3 ? NaN : 3.2 + i, out: i % 2 ? [0.2, 9 + i] : [] })) })];
const NAMES = ['alpha', 'beta-long-name', 'C', 'delta sample', 'E5', 'final one'];
const FONTS = (F) => L.fontsOf(F);
const ZERO = { L: 0, R: 0, T: 0, B: 0 };
const page = F => [F.wmm * L.PX_MM, F.hmm * L.PX_MM];
const layout = (C, extra = ZERO) => { const F = C.F, [W, H] = page(F), fonts = FONTS(F), ranges = L.computeRanges(C);
  return { fonts, ranges, lay: L.figureLayout(C, W, H, fonts, ranges, extra) }; };
const frame = (C, pi = 0, extra) => { const { fonts, ranges, lay } = layout(C, extra); return L.panelFrame(C, lay, ranges, fonts, C.F.panels[pi], pi); };

/* ---- The pieces ---- */
test('the ticks: a step snapped to its grid, the nice ones, a log axis\'s decades and its 1-2-5, the minors, the words', ()=>{
  const C = ctx(model());
  assert.deepEqual(L.majorTicks(C, 0, 0.5, 0.1), [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  assert.deepEqual(L.majorTicks(C, -0.25, 0.3, 0.1), [-0.2, -0.1, 0, 0.1, 0.2, 0.3]);
  assert.deepEqual(L.majorTicks(C, 0.3, 9.7, 0), [2, 4, 6, 8]);
  // at most 400: a step that makes more is not followed, the automatic ticks instead (v566)
  assert.deepEqual(L.majorTicks(C, 0, 399, 1), R(400, i => i));
  assert.deepEqual(L.majorTicks(C, 0, 400, 1), L.majorTicks(C, 0, 400, 0));
  assert.deepEqual(L.majorTicks(C, 0, 400, 0).map(t => t + 0), [0, 100, 200, 300, 400]);
  assert.deepEqual(L.majorTicks(C, 0, 1e6, 1), L.majorTicks(C, 0, 1e6, 0));
  // the switch wins over the field
  assert.deepEqual(L.axisTicks(ctx(model({ xStep: 7 })), 'x', 0, 30).map(t => t + 0), [0, 10, 20, 30]);
  assert.deepEqual(L.axisTicks(ctx(model({ xStep: 7, xStepAuto: false })), 'x', 0, 30), [0, 7, 14, 21, 28]);
  // a log axis: the decades, every k-th with a step, the 1-2-5 under two, else nice values
  const LC = ctx(model({ yLog: true }));
  const dec = L.axisTicks(LC, 'y', -2.3, 3.1);
  assert.deepEqual([...dec], [-2, -1, 0, 1, 2, 3]); assert.equal(dec.dec, true);
  assert.deepEqual([...L.axisTicks(ctx(model({ yLog: true, yStepAuto: false, yStep: 2 })), 'y', -2.3, 3.1)], [-2, 0, 2]);
  assert.deepEqual(L.axisTicks(LC, 'y', 0.25, 1.2).map(t => +t.toFixed(6)), [0.30103, 0.69897, 1]);
  assert.deepEqual(L.axisTicks(LC, 'y', 0.75, 0.9).map(t => +Math.pow(10, t).toFixed(6)), [6, 6.5, 7, 7.5]);
  assert.equal(L.axisTicks(LC, 'y', 0.25, 1.2).dec, undefined);
  // a category axis has no log scale
  assert.equal(L.isLog(ctx(model({ xLog: true, cats: cats(['a']) })), 'x'), false);
  assert.equal(L.isLog(ctx(model({ xLog: true })), 'x'), true);
  // the minors: 4 by default, a decade's 2…9, the decades between steps of several, a count set by hand
  assert.equal(L.minorsOf(C, 'x', [0, 1, 2]), 4);
  assert.equal(L.minorsOf(LC, 'y', dec), 8);
  assert.equal(L.minorsOf(LC, 'y', Object.assign([-3, 0, 3], { dec: true })), 2);
  assert.equal(L.minorsOf(ctx(model({ minorYAuto: false, minorY: 3, yLog: true })), 'y', dec), 3);
  assert.deepEqual(L.minorTicks([0, 10, 20], 0, 25, 4), [2, 4, 6, 8, 12, 14, 16, 18, 22, 24]);
  assert.deepEqual(L.minorTicks([0, 10], 0, 10, 0), []);
  assert.deepEqual(L.axisMinors(LC, 'y', Object.assign([0, 1], { dec: true }), 0, 1).map(t => +Math.pow(10, t).toFixed(9)), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(L.axisMinors(LC, 'y', Object.assign([-3, 0, 3], { dec: true }), -3, 3), [-2, -1, 1, 2]);
  // the words: a number, a decade's 10 and its exponent (a true minus), a 1-2-5 value
  assert.deepEqual(L.tickParts(C, 'x', 0.30000000000000004, [0]), { base: '0.3' });
  assert.deepEqual(L.tickParts(LC, 'y', -2, dec), { base: '10', sup: '−2' });
  assert.deepEqual(L.tickParts(LC, 'y', Math.log10(5), [0]), { base: '5' });
  assert.equal(L.tickW(LC, 'y', -2, dec, 10), 2 * 5.5 + 2 * 0.55 * 7.2);
  assert.deepEqual([L.shownOf(LC, 'y', 2), L.takenOf(LC, 'y', 100), L.takenOf(LC, 'y', -1), L.shownOf(C, 'y', 2)], [100, 2, null, 2]);
});

/* What hung the tab to v565, run in a worker stopped after 10 s, so that a loop that never ends
   fails the test and not the run: `cases` gets figure-layout.js (L) and plot.js's niceTicks and
   fixedTicks (T), and its source is all that reaches the worker. */
function inWorker(cases){
  const plot = ['niceStep', 'niceTicks', 'fixedTicks'].map(n => decl('plot.js', n)).join('\n');
  const src = `const { parentPort, workerData: w } = require('node:worker_threads');
import(w.url).then(L => { const T = new Function(w.plot + '\\nreturn { niceTicks, fixedTicks };')();
  const t0 = performance.now(), out = new Function('return ' + w.cases)()(L, T);
  parentPort.postMessage({ out, ms: performance.now() - t0 }); });`;
  const url = new URL('../figure-layout.js', import.meta.url).href;
  return new Promise((ok, fail) => {
    const wk = new Worker(src, { eval: true, workerData: { url, plot, cases: String(cases) } });
    const timer = setTimeout(() => { wk.terminate(); fail(new Error('still running after 10 s: a loop that never ends')); }, 10000);
    wk.once('message', m => { clearTimeout(timer); wk.terminate(); ok(m); });
    wk.once('error', e => { clearTimeout(timer); fail(e); });
  });
}

test('the ticks never hang: a step too fine for its values, none, below zero, no number, too many minors (v566)', async ()=>{
  const { out, ms } = await inWorker((L, T) => {
    const C = F => ({ F: { xLog: false, yLog: false, cats: [], xStepAuto: true, xStep: 0, yStepAuto: true, yStep: 0,
      minorXAuto: true, minorX: 4, minorYAuto: true, minorY: 4, ...F }, niceTicks: T.niceTicks });
    const A = C({}), lo = 0.95e14, hi = 1.55e14;
    // The report: values about 1e14, a Y step of 10 by hand, the minors on.
    const M = C({ yStepAuto: false, yStep: 10 }), maj = L.axisTicks(M, 'y', lo, hi);
    return {
      reported: [maj, L.axisMinors(M, 'y', maj, lo, hi)], auto: [L.axisTicks(A, 'y', lo, hi), L.axisMinors(A, 'y', L.axisTicks(A, 'y', lo, hi), lo, hi)],
      // the majors v565 gave for it: 400, up to ten at a time the same twelve digits
      dupMinors: L.minorTicks([lo, lo, lo, lo, lo, lo + 100], lo, hi, 4),
      // a step under the values' float spacing: 1e17 + 1 is 1e17
      e17: L.majorTicks(A, 1e17, 1.5e17, 1), e17auto: L.majorTicks(A, 1e17, 1.5e17, 0),
      e17minors: [L.minorTicks([1e17, 1e17], 1e17, 1.5e17, 4), L.minorTicks([1e17, 1e17 + 16, 1e17 + 32], 1e17, 1.5e17, 4)],
      // a range a few float spacings wide: niceTicks' and fixedTicks' steps leave v where it is
      nice: [T.niceTicks(1e17, 1e17 + 16, 4), T.niceTicks(-1e17 - 16, -1e17, 5)], fixed: T.fixedTicks(1e17, 1e17 + 1600, 5),
      // no step, one below zero, majors that run down
      zero: [L.majorTicks(A, 0, 10, 0), L.minorTicks([5, 5, 5], 0, 10, 4), T.fixedTicks(0, 10, 0)],
      neg: [L.majorTicks(A, 0, 10, -1), L.minorTicks([10, 0], 0, 10, 4), T.fixedTicks(0, 10, -1)],
      // no number, or no end
      nan: [L.majorTicks(A, NaN, 1, 1), L.majorTicks(A, 0, NaN, 1), L.minorTicks([0, NaN], 0, 1, 4), L.minorTicks([0, 1], NaN, 1, 4), T.niceTicks(NaN, 1, 4)],
      inf: [L.majorTicks(A, 0, Infinity, 1), L.majorTicks(A, -Infinity, 0, 1), T.niceTicks(0, Infinity, 4), T.niceTicks(-Infinity, Infinity, 4)],
      infBounds: L.minorTicks([0, 1, 2], -Infinity, Infinity, 4),
      // a log axis over more decades than finite numbers span, or to no end
      log: [L.axisTicks(C({ yLog: true }), 'y', 0, 1e300), L.axisTicks(C({ yLog: true }), 'y', -Infinity, 2), L.axisTicks(C({ yLog: true }), 'y', NaN, 2)],
      // minors by the billion (a malformed project's count)
      many: [L.minorTicks([0, 1, 2], 0, 2, 1e9), L.axisMinors(C({ yLog: true, minorYAuto: false, minorY: 1e9 }), 'y', [0, 1, 2], 0, 2)],
    };
  });
  assert.ok(ms < 2000, `the cases took ${ms} ms`);
  // the step is not followed: the automatic ticks and their minors, as with the switch on
  assert.deepEqual(out.reported, out.auto);
  assert.deepEqual(out.auto[0], [1e14, 1.2e14, 1.4e14]);
  assert.deepEqual(out.auto[1], [96, 104, 108, 112, 116, 124, 128, 132, 136, 144, 148, 152].map(v => v * 1e12));
  assert.deepEqual(out.dupMinors, []);
  assert.deepEqual(out.e17, out.e17auto);
  assert.deepEqual(out.e17minors, [[], []]);
  assert.deepEqual(out.nice, [[1e17], [-1e17 - 16]]);
  assert.ok(out.fixed.length >= 1 && out.fixed.length <= 2, 'stopped where the step no longer moves');
  assert.deepEqual(out.zero.map(a => a.map(t => t + 0)), [[0, 2, 4, 6, 8, 10], [], [0, 2, 4, 6, 8, 10]]);
  assert.deepEqual(out.neg, out.zero);
  assert.deepEqual(out.nan, [[], [], [], [], []]);
  assert.deepEqual(out.inf, [[], [], [], []]);
  // bounds with no end: the minors of the majors' span and an interval past each end, as ever
  assert.deepEqual(out.infBounds, L.minorTicks([0, 1, 2], -1, 3, 4));
  assert.equal(out.infBounds.length, 16);
  assert.deepEqual(out.log, [[], [], []]);
  assert.deepEqual(out.many, [[], []]);
});

test('the ticks of a step that fits, as v565 had them: 400 majors and 20 minors to each, 1e14 in steps of 1000', ()=>{
  const C = ctx(model());
  const maj = L.majorTicks(C, 0, 399, 1), minors = L.minorTicks(maj, 0, 399, 20);
  assert.equal(minors.length, 399 * 20);
  assert.deepEqual([minors[0], minors[19], minors[20], minors.at(-1)], [0.047619047619047616, 0.9523809523809523, 1.0476190476190474, 398.9523809523809]);
  // the range narrower than the majors: only the minors inside it
  assert.deepEqual(L.minorTicks([0, 10, 20], 3, 17, 4), [4, 6, 8, 12, 14, 16]);
  // twelve digits at 1e14 are a thousand apart: a step of 1000 is followed, its minors with it
  const big = L.majorTicks(C, 1e14, 1e14 + 1e4, 1000);
  assert.deepEqual(big, R(11, i => 1e14 + i * 1000));
  assert.deepEqual(L.minorTicks(big, 1e14, 1e14 + 1e4, 4), R(50, i => 1e14 + (i + 1) * 200).filter((_, i) => (i + 1) % 5));
  assert.deepEqual(L.axisTicks(ctx(model({ yStepAuto: false, yStep: 1000 })), 'y', 1e14, 1e14 + 1e4), big);
});

test('the ranges: the data with its error bars and boxes, bars on zero, logs, sharing groups, manual ones', ()=>{
  const F = model({ series: [curve('a', [0, 1, 2], [1, 3, 2]), curve('b', [0, 1], [5, NaN], { panel: 1 })], panels: [panel(0, 0), panel(1, 0)], rows: 2 });
  const C = ctx(F);
  const e = L.extentOf(C, [0]);
  assert.deepEqual([e.x0, e.x1], [0, 2]); near(e.y0, 0.9, 1e-12, 'padded'); near(e.y1, 3.1, 1e-12, 'padded');
  assert.equal(L.extentOf(C, [5]), null);
  // a single point: half a unit either side
  assert.deepEqual(L.extentOf(ctx(model({ series: [curve('one', [2], [5])] })), [0]), { x0: 1.5, x1: 2.5, y0: 4.45, y1: 5.55 });
  // bars: ±0.7 of a slot, standing on zero (no padding under them); an error bar widens the range
  const B = ctx(model({ series: BARS(), cats: cats(NAMES) }));
  const eb = L.extentOf(B, [0]);
  assert.deepEqual([eb.x0, eb.x1, eb.y0], [1 - 0.7, 6.7, 0]);
  near(eb.y1, 12.4 * 1.05, 1e-12, 'the tallest bar and its error, padded');
  // boxes: their outliers in; a log axis: the logarithms, a value ≤ 0 left out
  const eo = L.extentOf(ctx(model({ series: BOXES() })), [0]);
  assert.equal(eo.y0, 0); near(eo.y1, 12 + 12 * 0.05, 1e-12, 'the outlier at 12');
  const el = L.extentOf(ctx(model({ yLog: true, series: [curve('l', [1, 2, 3], [0.01, 0, 1000])] })), [0]);
  near(el.y0, -2 - 0.25, 1e-12, 'log foot'); near(el.y1, 3 + 0.25, 1e-12, 'log top');
  // shared: one range; not: each its own, a group by its root, a cycle stopping, a manual range of the root
  const r = L.computeRanges(C);
  assert.deepEqual(r.xOf[0], r.xOf[1]);
  F.shareY = false; F.shareX = false;
  F.panels[1].shareXWith = 0; F.panels[0].shareXWith = 1;
  assert.equal(L.rangeRoot(C, 0, 'shareXWith'), 0, 'a cycle stops');
  F.panels[0].shareXWith = null;
  assert.deepEqual(L.rangeGroup(C, 1, 'shareXWith'), [0, 1]);
  F.xMan = { 0: [-1, 9] }; F.panels[0].xAuto = false;
  const q = L.computeRanges(C);
  assert.deepEqual([q.xOf[0], q.xOf[1]], [[-1, 9], [-1, 9]], 'the group takes its root\'s manual range');
  assert.notDeepEqual(q.yOf[0], q.yOf[1], 'each its own Y');
  F.panels[0].xAuto = true;
  assert.deepEqual(L.computeRanges(C).xOf[1], [0, 2]);
});

test('the page: sides with room, margins, the cap, a plot area by hand, the tilt of the names', ()=>{
  // 2 × 2 with a gap: the panel at (0,0) has room below (the gap) and to the left
  const G = ctx(model({ rows: 2, cols: 2, panels: [panel(0, 0), panel(0, 1, { rs: 2 })] }));
  assert.deepEqual(L.sideFree(G, 0), { left: true, right: false, top: true, bottom: true });
  assert.deepEqual(L.sideFree(G, 1), { left: false, right: true, top: true, bottom: true });
  // the margins on a default figure: the widest Y number + 8 + a title's 1.5 lines; 10 more each side
  const F = model({ series: LINES() }), C = ctx(F);
  const { fonts, lay } = layout(C);
  const fT = 8 * L.PT_PX, fA = 9 * L.PT_PX;
  assert.equal(lay.maxYNum, textW('20', fT));
  near(lay.mL, 10 + lay.maxYNum + 8 + fA * 1.5, 1e-9, 'left');
  near(lay.mB, 10 + fT * 1.7 + fA * 1.5, 1e-9, 'bottom');
  assert.equal(lay.mR, 10, 'a bare side: the last number\'s overhang is less');
  const big = layout(ctx(model({ series: LINES(), font: { family: 'Inter', tick: 30, axis: 9, legend: 8, title: 9 } }))).lay;
  near(big.mR, textW('50', 30 * L.PT_PX) / 2 + 2, 1e-9, 'right: the last number\'s overhang');
  assert.equal(lay.xRot, 0);
  near(lay.innerW, F.wmm * L.PX_MM - lay.mL - lay.mR, 1e-9, 'the plot area');
  assert.deepEqual([lay.oX, lay.oY], [lay.mL, lay.mT]);
  assert.equal(fonts.fLeg, 8 * L.PT_PX);
  // what spilled out widens its side
  const wide = layout(C, { L: 5, R: 0, T: 2, B: 0 }).lay;
  near(wide.mL - lay.mL, 5, 1e-9, 'extra left'); near(wide.mT - lay.mT, 2, 1e-9, 'extra top');
  // a global legend's strip: its rows under the panels
  F.legendMode = 'global'; F.legendCols = 2;
  near(layout(C).lay.mB - lay.mB, 2 * fonts.fLeg * 1.35 + 6 + 4, 1e-9, 'two rows of legend');
  F.legendPlace = 'top';
  near(layout(C).lay.mT - lay.mT, 2 * fonts.fLeg * 1.35 + 6 + 4, 1e-9, 'above');
  // the cap: a title too long for the page
  const T = ctx(model({ series: LINES(), wmm: 40, hmm: 30, font: { family: 'Inter', tick: 30, axis: 30, legend: 8, title: 9 } }));
  const t = layout(T).lay;
  near(t.mL + t.mR, 40 * L.PX_MM * 0.62, 1e-9, 'at most 62 % of the width'); near(t.mT + t.mB, 30 * L.PX_MM * 0.62, 1e-9, 'and height');
  // a plot area set by hand, placed by `align` (larger than the page: over its edges)
  const P = model({ series: LINES(), plotAuto: false, plotW: 100, plotH: 70, align: 'br' });
  const p = layout(ctx(P)).lay;
  assert.deepEqual([p.innerW, p.innerH], [100 * L.PX_MM, 70 * L.PX_MM]);
  near(p.oX + p.innerW, 160 * L.PX_MM - p.mR, 1e-9, 'right'); near(p.oY + p.innerH, 110 * L.PX_MM - p.mB, 1e-9, 'bottom');
  P.plotW = 300; P.align = 'tl';
  assert.equal(layout(ctx(P)).lay.oX, p.mL);
  // the names' tilt: the least from 30° that keeps them in and apart; 90 failing that; by hand, clamped
  const N = model({ series: BARS(), cats: cats(NAMES) });
  assert.equal(layout(ctx(N)).lay.xRot, 30);
  N.cats = cats(NAMES.map(n => n + ' and a long tail'));
  assert.equal(layout(ctx(N)).lay.xRot, 65, 'longer, steeper');
  N.wmm = 30;
  assert.equal(layout(ctx(N)).lay.xRot, 90, 'none fits: upright');
  N.catRotAuto = false; N.catRot = 120;
  assert.equal(layout(ctx(N)).lay.xRot, 90);
  N.catRot = -5;
  assert.equal(layout(ctx(N)).lay.xRot, 0);
  // panels made without their axes are given them
  const bare = model({ panels: [{ r: 0, c: 0, rs: 1, cs: 1 }] });
  layout(ctx(bare));
  assert.deepEqual(bare.panels[0].axes, L.newAxes());
});

test('a panel: its scales, bars, boxes, error bars, curves, value labels and their ink', ()=>{
  const F = model({ series: BARS(), cats: cats(NAMES) }), C = ctx(F);
  const fr = frame(C);
  assert.equal(fr.XT(fr.x0), fr.px0); assert.equal(fr.XT(fr.x1), fr.px0 + fr.pw);
  assert.equal(fr.YT(fr.y0), fr.py0 + fr.ph); assert.equal(fr.YT(fr.y1), fr.py0);
  assert.deepEqual(fr.cats.map(c => c.text), NAMES);
  assert.equal(fr.free.bottom, true);
  // two series side by side in a slot; the zero line
  const bs = F.series;
  const a = L.barSlot(C, fr, bs[0], bs), b = L.barSlot(C, fr, bs[1], bs);
  near(a.wPx, (fr.XT(1) - fr.XT(0)) * 0.8 / 2, 1e-9, 'width'); near(b.off, -a.off, 1e-12, 'either side'); near(b.off, a.wPx / 2, 1e-12, 'by half');
  assert.equal(a.zero, fr.YT(0));
  assert.deepEqual(L.barRect(10.004, 20, 50, 6), { x: '7.00', y: '20.00', width: '6.00', height: '30.00' });
  assert.deepEqual(L.barRect(10, 60, 50, 6).y, '50.00', 'a negative bar hangs from zero');
  assert.equal(L.errorBar(fr, 10, 5, 0, 6), null); assert.equal(L.errorBar(fr, 10, 5, NaN, 6), null);
  const eb = L.errorBar(fr, 10, 5, 1, 30);
  assert.deepEqual([eb[0].y1, eb[0].y2, eb[1].x1, eb[1].x2], [fr.Yc(4), fr.Yc(6), 6, 14], 'cap at most 4');
  // a log axis: the bars rise from the foot; a value ≤ 0 is past the foot
  const LC = ctx(model({ yLog: true, series: BARS(), cats: cats(NAMES) }));
  const lf = frame(LC);
  assert.equal(L.barSlot(LC, lf, LC.F.series[0], LC.F.series).zero, lf.py0 + lf.ph);
  assert.equal(lf.Yc(-1), lf.py0 + lf.ph + 2); assert.equal(lf.Yc(10), lf.YT(1));
  // value labels: each position, the decimals and the ±, the ink against the bar or the page, the turn
  const s = { ys: [2.345, NaN], errs: [0.1, 0] };
  F.dataLabels = { on: true, dec: 1, pos: 'above', rot: 0, size: 6, off: 3, autoInk: false };
  assert.deepEqual(L.valueLabel(C, s, 0, 50, 40, 30, 60, null, '#111', '#fff'), { txt: '2.3 ± 0.1', at: { x: 50, y: 27, 'font-size': 8, fill: '#111', 'text-anchor': 'middle' } });
  assert.equal(L.valueLabel(C, s, 1, 50, 40, 30, 60, null, '#111', '#fff'), null);
  F.dataLabels.pos = 'below';
  assert.equal(L.valueLabel(C, s, 0, 50, 40, 30, 60, null, '#111', '#fff').at.y, 60 + 3 + 8 * 0.8);
  F.dataLabels.pos = 'inside'; F.dataLabels.autoInk = true;
  const box = { color: '#102030', top: 30, bottom: 90 };
  assert.deepEqual(L.valueLabel(C, s, 0, 50, 40, 30, 60, box, '#111', '#ffffff').at.fill, '#ffffff', 'white on the dark bar');
  F.dataLabels.pos = 'above';
  assert.deepEqual(L.valueLabel(C, s, 0, 50, 40, 30, 60, box, '#111', '#ffffff').at.fill, '#000000', 'black on the page');
  F.dataLabels.pos = 'center'; F.dataLabels.off = 0;
  assert.deepEqual(L.valueLabel(C, s, 0, 50, 40, 30, 60, box, '#111', '#fff').at, { x: 50, y: 60, 'font-size': 8, fill: '#ffffff', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  F.dataLabels.rot = 90; F.dataLabels.pos = 'below';
  const r = L.valueLabel(C, s, 0, 50, 40, 30, 60, null, '#111', '#fff').at;
  assert.deepEqual([r['text-anchor'], r['dominant-baseline'], r.transform], ['end', 'central', `rotate(-90 ${r.x} ${r.y})`]);
  near(r.x, 50, 1e-12, 'straight up: no slide');
  // a bar's label from the whisker and on the bar as it shows; a box's marks and label
  const bl = L.barLabel(C, fr, bs[0], 1, 100, fr.Y(4.7), 4.7, a.zero, 0.5, '#000', '#fff');
  assert.equal(bl.txt, '4.7 ± 0.5');
  const X = ctx(model({ series: BOXES(), dataLabels: { on: true, dec: 2, pos: 'above', rot: 0, size: 7, off: 3, autoInk: false } }));
  const xf = frame(X), bx = X.F.series[0];
  const k = L.boxMarks(xf, bx, 1, bx.boxes[1], 200, 20);
  assert.equal(k.whiskers.length, 4); assert.equal(k.mean.length, 2); assert.equal(k.outliers.length, 2);
  assert.deepEqual([k.rect.width, k.whiskers[2].x2 - k.whiskers[2].x1, k.outliers[0].r], ['20.00', 8, 2]);
  assert.equal(L.boxMarks(xf, bx, 3, bx.boxes[3], 200, 20).mean.length, 0, 'no mean, no cross');
  // (v576) a box of one value: its quartiles one, no height; marked minBox (XRPD's sizes, as
  // plot.js drew it), the cross's height about it; a box taller, as it is
  const one = { q1: 3, med: 3, q3: 3, lo: 3, hi: 3, mean: 3, out: [] }, y3 = xf.Yc(3);
  assert.deepEqual([L.boxMarks(xf, bx, 1, one, 200, 20).rect.height, L.boxMarks(xf, bx, 1, { ...one, minBox: true }, 200, 20).rect], ['0.00', { x: '190.00', y: (y3 - 2.5).toFixed(2), width: '20.00', height: '5.00' }]);
  assert.deepEqual(L.boxMarks(xf, bx, 1, { ...bx.boxes[1], minBox: true }, 200, 20).rect, k.rect);
  const lab = L.boxLabel(X, xf, bx, 1, bx.boxes[1], 200, k, '#000', '#fff');
  assert.equal(lab.txt, '4.20 ± 0.40'); near(lab.at.y, Math.min(k.yhi, ...bx.boxes[1].out.map(xf.Yc)) - 3, 1e-12, 'over the highest outlier');
  // a curve: the points with a place, its symbols at 2 decimals
  const cv = curve('c', [0, 1, NaN, 3, 4], [1, 2, 3, Infinity, 5], { marker: 'circle-o' });
  const cf = frame(ctx(model({ series: [cv] })));
  const d = L.curvePath(cf, cv);
  assert.equal(d.split(' ').filter(Boolean).length, 3); assert.ok(d.startsWith('M') && d.includes('L'));
  const ms = L.curveMarkers(cf, cv);
  assert.equal(ms.length, 3); assert.equal(ms[0][0], 'circle'); near(ms[0][1].r, 1.95, 1e-12, 'r');
  assert.equal(L.curveLabels(ctx(model({ series: [cv], dataLabels: { on: true, dec: 0, pos: 'above', rot: 0, size: 7, off: 3, autoInk: false } })), cf, cv, '#000', '#fff').length, 3);
});

test('the axes: lines, tick marks each way, numbers that give way to a neighbour\'s, category names, titles', ()=>{
  const F = model({ series: LINES(), rows: 2, panels: [panel(0, 0), panel(1, 0)], yAuto: false, ymin: 0, ymax: 20 }), C = ctx(F);
  const top = frame(C, 0), low = frame(C, 1);
  assert.deepEqual(L.axisLine(top, 'left'), { x1: top.px0, x2: top.px0, y1: top.py0, y2: top.py0 + top.ph });
  // the marks: out, in, both; minors after the majors
  const A = top.p.axes.left;
  const out = L.tickMarks(C, top, 'left');
  assert.equal(out.length, top.gy.length); assert.deepEqual([out[0].x1, out[0].x2], [top.px0, top.px0 - 4]);
  A.dir = 'in'; A.minor = true;
  const inn = L.tickMarks(C, top, 'left');
  assert.deepEqual([inn[0].x1, inn[0].x2], [top.px0, top.px0 + 4]); assert.ok(inn.length > top.gy.length);
  near(inn[inn.length - 1].x2 - inn[inn.length - 1].x1, 2.2, 1e-12, 'a minor');
  A.dir = 'both';
  assert.deepEqual([L.tickMarks(C, top, 'left')[0].x1, L.tickMarks(C, top, 'left')[0].x2], [top.px0 + 4, top.px0 - 4]);
  // stacked, one range 0–20: of the numbers at the edge they share (the upper panel's 0, the
  // lower one's 20) the upper one's gives way and the lower one keeps its 20 (v569: to v568
  // both went); with the lower one's off, the upper keeps its 0
  assert.equal(top.free.bottom, false);
  assert.deepEqual(top.gy.map(t => t + 0), [0, 5, 10, 15, 20]);
  const nums = fr => L.tickNumbers(C, fr, 'left').map(n => n.parts.base);
  assert.deepEqual([nums(top), nums(low)], [['5', '10', '15', '20'], ['0', '5', '10', '15', '20']]);
  assert.equal(L.neighbourMarks(C, top, 'left', 'bottom', true).length, low.gy.length);
  assert.equal(L.neighbourMarks(C, low, 'left', 'top', true).length, top.gy.length - 1, 'less the 0 the upper one gives up');
  low.p.axes.left.labels = false;
  assert.deepEqual(nums(top), ['0', '5', '10', '15', '20']);
  assert.deepEqual(L.neighbourMarks(C, top, 'left', 'bottom', true), []);
  low.p.axes.left.labels = true;
  // side by side, one range 0–50: the left panel's 50 gives way, the right one keeps its 0
  const S = ctx(model({ series: LINES(), cols: 2, panels: [panel(0, 0), panel(0, 1)] }));
  const lf = frame(S, 0), rt = frame(S, 1);
  const xs = fr => L.tickNumbers(S, fr, 'bottom').map(n => n.parts.base);
  assert.deepEqual(lf.gx.map(t => t + 0), [0, 10, 20, 30, 40, 50]);
  assert.deepEqual([xs(lf), xs(rt)], [['0', '10', '20', '30', '40'], ['0', '10', '20', '30', '40', '50']]);
  // numbers below, centred, tilted with the names; above, raised
  const nb = L.tickNumbers(C, low, 'bottom');
  assert.deepEqual(nb[0].at, { x: low.XT(low.gx[0]), y: low.py0 + low.ph + low.fonts.fTick * 1.25, 'text-anchor': 'middle' });
  assert.equal(nb[0].rot, 0);
  // titles: a panel's own Y title wins; clear of the numbers; none when shared
  low.p.ylabel = 'own';
  assert.equal(L.axisTitle(C, low, 'left').text, 'own');
  assert.equal(L.axisTitle(C, top, 'left').text, 'Signal (mV)');
  const tt = L.axisTitle(C, top, 'left');
  near(tt.at.x, top.px0 - (top.lay.maxYNum + 8 + top.fonts.fAxis * 0.9), 1e-9, 'clear of the numbers');
  assert.equal(tt.at.transform, `rotate(-90 ${tt.at.x} ${tt.at.y})`);
  assert.equal(L.axisTitle(C, top, 'right'), null, 'a bare side');
  F.titleModeY = 'shared';
  assert.equal(L.axisTitle(C, top, 'left'), null);
  assert.deepEqual(L.sharedTitles(C, top.lay, top.fonts).map(t => t.text), ['Signal (mV)']);
  assert.deepEqual(L.panelTitleAt(top), { x: top.px0 + 6, y: top.py0 + top.fonts.fTitle * 1.25 });
  // category names: where they stand, tilted with the layout; in runs with an overline's gap
  const B = ctx(model({ series: BARS(), cats: [...cats(NAMES.slice(0, 2)), { x: 3, text: '-1-10', key: '-1-10', rot: 0, runs: [['1', true], ['1', true], ['0', false]] }] }));
  const bf = frame(B);
  const names = L.catNames(bf, 'bottom');
  assert.deepEqual(names.map(n => [n.x, n.rot]), [[1, 30], [2, 30], [3, 30]]);
  assert.equal(names[0].at.y, bf.py0 + bf.ph + bf.fonts.fTick * 1.15);
  assert.equal(L.catText(B, 3), '-1-10'); assert.deepEqual(L.catRuns(B, 3), [['1', true], ['1', true], ['0', false]]);
  assert.equal(L.catW(B, 3, 10), textW('110', 10) + 1, 'a gap between two overlines');
  assert.equal(L.catW(B, 1, 10), textW('alpha', 10));
  assert.deepEqual([0, 1, 2].map(i => L.barGap([['1', false], ['1', true], ['1', false]], i, 10)), [0, 0, 1], 'after an overline (taken by an overlined run only)');
  B.F.catNames = { 3: 'typed' };
  assert.deepEqual([L.catText(B, 3), L.catRuns(B, 3), L.catW(B, 3, 10)], ['typed', null, textW('typed', 10)]);
});

test('the legends, the shared titles, the tiles, the colours, the symbols, the rich text', ()=>{
  // a bar series is an entry a division
  const bs = BARS();
  bs[0].divs = [{ name: 'first', color: '#123456' }, { texture: 'dots', texInv: true }];
  bs[0].divOf = [0, 1, 1, 9, -1, 0];
  const ent = L.legendEntries([bs[0], LINES()[0]]);
  assert.deepEqual(ent.map(e => [e.label, e.color, e.texture, e.texInv]), [['first', '#123456', 'solid', false], ['H2', '#ff7f0e', 'dots', true], ['Alpha', '#1f77b4', undefined, undefined]]);
  assert.deepEqual(bs[0].xs.map((_, j) => L.divOfBar(bs[0], j)), [0, 1, 1, 1, 0, 0]);
  // a panel's legend in each corner, under the panel's title when at the top
  const F = model({ series: LINES(), panels: [panel(0, 0, { title: 'A' })] }), C = ctx(F);
  const fr = frame(C), fLeg = fr.fonts.fLeg, rowH = fLeg * 1.35, wide = textW('Gamma ray', fLeg) + 14 + 6;
  let lg = L.panelLegend(C, fr);
  assert.equal(lg.frame, null); assert.equal(lg.rows.length, 3);
  near(lg.rows[0].xa, fr.px0 + fr.pw - 6 - wide, 1e-9, 'right'); near(lg.rows[0].cy, fr.py0 + 6 + fr.fonts.fTitle * 1.2 + rowH / 2, 1e-9, 'under the title');
  assert.equal(lg.rows[0].tx, lg.rows[0].xa + 14 + 6);
  F.legendCorner = 'bl'; F.legendFrame = true;
  lg = L.panelLegend(C, fr);
  assert.equal(lg.rows[0].xa, fr.px0 + 6); near(lg.rows[2].cy + rowH / 2, fr.py0 + fr.ph - 6, 1e-9, 'its foot');
  assert.deepEqual(lg.frame, [fr.px0 + 2, lg.rows[0].cy - rowH / 2 - 4, wide + 8, 3 * rowH + 8]);
  F.series.forEach(s => { s.inLegend = false; });
  assert.equal(L.panelLegend(C, fr), null);
  F.series.forEach(s => { s.inLegend = true; });
  // the figure's legend: columns as wide as their widest, aligned, above or below
  F.legendMode = 'global'; F.legendCols = 2; F.legendAlign = 'left';
  assert.equal(L.panelLegend(C, fr), null);
  const { lay, fonts } = layout(C);
  const g = L.globalLegend(C, lay, fonts);
  const col0 = 16 + 4 + textW('Gamma ray', fLeg);
  assert.deepEqual(g.rows.map(r => r.xa), [lay.oX, lay.oX + col0 + 14, lay.oX]);
  near(g.rows[2].cy - g.rows[0].cy, rowH, 1e-12, 'a row down');
  F.legendAlign = 'right'; F.legendCols = 0;
  const g2 = L.globalLegend(C, layout(C).lay, fonts), last = g2.rows[2];
  near(last.tx + textW('Gamma ray', fLeg), layout(C).lay.oX + layout(C).lay.innerW, 1e-9, 'flush right');
  assert.deepEqual(L.legendFrameAttrs({ legendFrameAlpha: 7, legendFrameLine: true }, 1, 2, 3, 4, '#000', '#fff'),
    { x: 1, y: 2, width: 3, height: 4, rx: 2, fill: '#fff', 'fill-opacity': 1, stroke: '#000', 'stroke-width': 0.5 });
  assert.deepEqual(Object.keys(L.legendFrameAttrs({ legendFrameAlpha: -1, legendFrameLine: false }, 1, 2, 3, 4, '#000', '#fff')), ['x', 'y', 'width', 'height', 'rx', 'fill', 'fill-opacity']);
  // shared titles: one a side asked for, in the outer margin, clear of the legend's strip
  F.titleModeX = 'shared'; F.legendPlace = 'bottom';
  const L2 = layout(C).lay;
  const st = L.sharedTitles(C, L2, fonts);
  assert.deepEqual(st.map(t => t.text), ['Time (s)']);
  assert.equal(st[0].at.y, L2.oY + L2.innerH + L2.mB - L2.legendH - 4);
  // the tiles, the colours
  assert.deepEqual(L.textureTile('dots', '#ff0000', false), [['rect', { x: 0, y: 0, width: 6, height: 6, fill: '#ffadad' }], ['circle', { cx: 3, cy: 3, r: 1.5, fill: '#ff0000' }]]);
  assert.deepEqual(L.textureTile('cross', '#000000', true).map(([t, a]) => t + (a.stroke || a.fill)), ['rect#000000', ...Array(6).fill('line#adadad')]);
  assert.deepEqual(L.textureTile('grid', '#000', false).length, 3);
  assert.deepEqual([L.rgbOf('#abc'), L.rgbOf('rgba(1, 2, 3, 0.5)'), L.rgbOf('nope')], [[170, 187, 204], [1, 2, 3], [136, 136, 136]]);
  assert.deepEqual([L.contrastInk('#ffff00'), L.contrastInk('#000080'), L.contrastInk('rgb(20, 20, 20)'), L.contrastInk('')], ['#000000', '#ffffff', '#ffffff', '#000000']);
  assert.equal(L.lightShade('#000000'), '#adadad');
  // the symbols: each shape's tag, filled or outlined
  assert.deepEqual(['circle-o', 'square-f', 'triangle-o', 'star-f'].map(k => L.markerShape(k, 10, 10, 2, '#123', 1)[0]), ['circle', 'rect', 'polygon', 'polygon']);
  assert.deepEqual(L.markerShape('square-f', 10, 10, 2, '#123', 1)[1], { x: 8, y: 8, width: 4, height: 4, fill: '#123', stroke: '#123', 'stroke-width': 0.5 });
  assert.equal(L.markerShape('star-o', 0, 0, 2, '#123', 1)[1].points.split(' ').length, 10);
  // rich text: raised and lowered runs
  assert.deepEqual(L.richParts('k_{B}T^{2} x'), [{ t: 'k', r: null }, { t: 'B', r: 'sub' }, { t: 'T', r: null }, { t: '2', r: 'super' }, { t: ' x', r: null }]);
  assert.deepEqual(L.richParts(''), []);
});

/* ---- drawFigure as a whole, on a page that records what it is given ----
   figure.js needs a page to load (utils.js, plot.js), so its source is run here as it
   stands, its imports handed in: figure-layout.js and figure-model.js themselves, plot.js's
   svgEl, niceTicks, fmtTick, SUB_DROP and TILT_DY and utils.js's tiltFits, CP_PALETTES, esc
   and X_SVG from their source, the rest (pickers, the tabs) inert. The page: elements that
   keep their attributes in the order they were set, their text and their children, and a
   canvas that measures text a fixed width a character. */
class El {
  constructor(tag){ this.tag = tag; this.attrs = new Map(); this.kids = []; this.text = ''; }
  setAttribute(k, v){ this.attrs.set(k, String(v)); }
  appendChild(c){ this.kids.push(c); return c; }
  set textContent(t){ this.text = String(t); this.kids = []; }
  set innerHTML(h){ assert.equal(h, '', 'only emptied'); this.kids = []; this.text = ''; }
  get style(){ return {}; }
  toString(){ return '<' + this.tag + [...this.attrs].map(([k, v]) => ` ${k}="${v}"`).join('') + '>' + this.text + this.kids.join('') + '</' + this.tag + '>'; }
}
const PAGE = {
  createElementNS: (ns, tag) => new El(tag),
  createElement: tag => (assert.equal(tag, 'canvas'), { getContext: () => ({ font: '10px sans-serif',
    measureText(s){ return { width: String(s).length * 0.55 * parseFloat(/([\d.]+)px/.exec(this.font)[1]) }; } }) }),
};
// A const of the page's modules as it stands there: to its line's end, or a list to its "];".
function constDecl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const i = src.search(new RegExp(`^const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  return src.slice(i, src[src.indexOf('=', i) + 2] === '[' ? src.indexOf('\n];', i) + 3 : src.indexOf('\n', i));
}
const PLOT = new Function('document', ['niceStep', 'niceTicks', 'fmtTick', 'svgEl'].map(n => decl('plot.js', n)).join('\n') + '\n'
  + ['SUB_DROP', 'TILT_DY'].map(n => constDecl('plot.js', n)).join('\n') + '\nreturn { niceTicks, fmtTick, svgEl, SUB_DROP, TILT_DY };')(PAGE);
const UTIL = new Function(decl('utils.js', 'tiltFits') + '\n' + ['esc', 'CP_PALETTES', 'X_SVG'].map(n => constDecl('utils.js', n)).join('\n')
  + '\nreturn { tiltFits, esc, CP_PALETTES, X_SVG, colorPickerUI: {}, palettePickerUI: {}, flashFieldInvalid(){}, numRule(){ return \'\'; }, boxHtml(){ return \'\'; }, dropGap(){}, saveBlob(){} };')();
/* figure.js's source (or another's: an older version's, given as text), run with its imports
   handed in; gives its drawFigure and the model's setter. */
function loadFigure(src = fs.readFileSync(new URL('../figure.js', import.meta.url), 'utf8')){
  const from = { './plot.js': PLOT, './utils.js': UTIL, './tabs.js': { tabOf: () => null, TABS: [] }, './figure-layout.js': L, './figure-model.js': FM };
  const names = [], values = [];
  src = src.replace(/^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';\n/gm, (m, ns, list, mod) => {
    if (ns){ names.push(ns); values.push(from[mod]); }
    else for (const n of list.split(',').map(x => x.trim()).filter(Boolean)){ assert.ok(n in from[mod], n); names.push(n); values.push(from[mod][n]); }
    return '';
  }).replace(/^export \{[^}]*\};\n/m, '').replace(/^export function/gm, 'function');
  return new Function('document', ...names, src + '\nreturn { drawFigure, setF(v){ F = v; }, get last(){ return { rot: lastCatRot, inner: lastInner }; } };')(PAGE, ...values);
}
// A figure drawn as the preview draws it (the page's ink), again with what spilled out of
// that pass fed back, and as the export draws it (black ink): its markup, the tilt and the
// plot area it settled on, and its panels after (a panel made without its axes is given them).
function drawn(fig, F){
  const out = [];
  fig.setF(F);
  for (const [ink, extra] of [['#1a2327', ZERO], ['#1a2327', { L: 3.5, R: 1.25, T: 0, B: 7 }], ['#000000', { L: 0, R: 0, T: 0.6, B: 0 }]]){
    const svg = new El('svg');
    fig.drawFigure(svg, ink, '#ffffff', extra);
    out.push(String(svg), JSON.stringify(fig.last));
  }
  out.push(JSON.stringify(F.panels));
  return out.join('\n');
}
const AXES = o => ({ left: { ...L.newSide(true), ...o }, bottom: { ...L.newSide(true), ...o }, right: { ...L.newSide(false), ...o }, top: { ...L.newSide(false), ...o } });
const FIGS = {
  lines: () => model({ series: LINES() }),
  'lines-corner-framed': () => model({ series: LINES(), inkColor: '', legendCorner: 'bl', legendFrame: true, legendFrameAlpha: 0.4, legendFrameLine: false, panels: [panel(0, 0, { title: 'Panel A' })] }),
  'lines-global-top': () => model({ series: LINES(), legendMode: 'global', legendPlace: 'top', legendAlign: 'left', legendCols: 2, legendFrame: true }),
  'lines-grid-minors': () => model({ series: LINES(), grid: { x: true, y: true, minor: true, dash: '' }, panels: [panel(0, 0, { axes: AXES({ minor: true, dir: 'both', labels: true, title: true }) })], minorXAuto: false, minorX: 3 }),
  'lines-steps-range': () => model({ series: LINES(), xStepAuto: false, xStep: 7, yStepAuto: false, yStep: 2.5, xAuto: false, xmin: -5, xmax: 60 }),
  'lines-plot-by-hand': () => model({ series: LINES(), plotAuto: false, plotW: 300, plotH: 60, align: 'bc' }),
  'lines-shared-titles': () => model({ series: LINES(), titleModeX: 'shared', titleModeY: 'shared', legendMode: 'global', panels: [panel(0, 0, { axes: AXES({ title: true }) })] }),
  'lines-spilled': () => model({ series: LINES(), wmm: 60, hmm: 40 }),
  'lines-xrot': () => model({ series: LINES(), catRotAuto: false, catRot: 40 }),
  'lines-labels': () => model({ series: LINES().map(s => ({ ...s, marker: 'star-o' })), dataLabels: { on: true, dec: 1, pos: 'below', rot: 45, size: 6, off: 1, autoInk: true } }),
  'scatter-loglog': () => model({ xLog: true, yLog: true, series: [curve('p', R(30, i => 0.5 + i * 3), R(30, i => 0.01 * Math.pow(1.4, i)), { dash: 'none', marker: 'circle-f' })] }),
  'log-125': () => model({ yLog: true, series: [curve('n', R(20, i => 2 + i * 0.35), R(20, i => 2 + i * 0.3))], panels: [panel(0, 0, { axes: AXES({ minor: true }) })] }),
  'log-nonpositive': () => model({ yLog: true, series: [...BARS(), curve('neg', [1, 2, 3], [-1, 0, 2])], cats: cats(NAMES) }),
  bars: () => model({ series: BARS(), cats: cats(NAMES) }),
  'bars-labels': () => model({ series: BARS(), cats: cats(NAMES), inkColor: '', dataLabels: { on: true, dec: 2, pos: 'center', rot: 90, size: 7, off: 2, autoInk: true }, legendMode: 'global', legendCols: 3 }),
  'bars-tilt-by-hand': () => model({ series: BARS(), cats: cats(NAMES), catRotAuto: false, catRot: 60, wmm: 70 }),
  'bars-runs': () => model({ series: [bar('size', [1, 2, 3], [20, 27, 34])], cats: [{ x: 1, text: '1-11', key: 'a', runs: [['1', false], ['1', true], ['1', false]] }, { x: 2, text: '-1-10', key: 'b', runs: [['1', true], ['1', true], ['0', false]] }, { x: 3, text: '200', key: 'c' }], catNames: { 3: 'typed' } }),
  boxes: () => model({ series: BOXES(), cats: cats(['g1', 'g2', 'g3', 'g4']), dataLabels: { on: true, dec: 1, pos: 'above', rot: 0, size: 7, off: 3, autoInk: false } }),
  grid2x2: () => model({ series: LINES().map((s, i) => ({ ...s, panel: [0, 1, 3][i] })), rows: 2, cols: 2, panels: [panel(0, 0, { title: 'a' }), panel(0, 1), panel(1, 0), panel(1, 1, { title: 'd' })] }),
  'grid-groups': () => model({ series: LINES().map((s, i) => ({ ...s, panel: i })), rows: 2, cols: 2, shareX: false, shareY: false, innerClean: false, xMan: { 0: [5, 25] }, yMan: { 3: [0, 40] },
    panels: [panel(0, 0), panel(0, 1, { shareYWith: 0 }), panel(1, 0, { shareXWith: 0, xAuto: false }), panel(1, 1, { yAuto: false })] }),
  'grid-span-gap': () => model({ series: LINES().map((s, i) => ({ ...s, panel: i })), rows: 2, cols: 3, shareY: false, panels: [panel(0, 0, { rs: 2 }), panel(0, 1, { cs: 2 }), { r: 1, c: 2, rs: 1, cs: 1 }] }),
  linked: () => model({ series: [...LINES(), curve('residual', X50, X50.map(x => Math.sin(x) * 0.3), { panel: 1 })], rows: 2, shareY: false,
    panels: [panel(0, 0, { ylabel: 'Signal' }), panel(1, 0, { ylabel: 'Residual' })], legendMode: 'global', legendPlace: 'top' }),
  'bars-textures': () => { const bs = BARS(); bs[0].texture = 'cross'; bs[1].texture = 'dots'; bs[1].texInv = true;
    bs[0].divs = [{ name: 'first', color: '#123456' }, { name: 'second', color: '#abcdef', texture: 'fwd', texInv: true }, { texture: 'grid' }]; bs[0].divOf = [0, 1, 2, 2, 1, 0];
    return model({ series: [...bs, ...BOXES().map(b => ({ ...b, texture: 'horiz', panel: 0 }))], cats: cats(NAMES), legendMode: 'global', legendFrame: true }); },
  'rich-bare': () => model({ series: LINES(), xlabel: 'k_{B}T / E^{2}_{gap}', ylabel: 'σ^{-1}', panels: [{ r: 0, c: 0, rs: 1, cs: 1, title: 'no axes kept' }], legendMode: 'none' }),
};
test('drawFigure, figure by figure, as v554 drew it (golden digests)', ()=>{
  const fig = loadFigure(), got = {};
  for (const [name, make] of Object.entries(FIGS)){
    const markup = drawn(fig, make());
    got[name] = { digest: sha(markup), elements: (markup.match(/<[a-z]/gi) || []).length };
  }
  for (const n of Object.keys(FIGS)) assert.ok(got[n].elements > 30, n + ': drawn');
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(got), Object.keys(want));
  for (const n of Object.keys(FIGS)) assert.deepEqual(got[n], want[n], n);
});
