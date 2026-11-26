/* The Peaks / Scherrer card's calculations (xrd-peaks-model.js) and its words and markup that
   need no page (xrd-peaks-html.js), in Node: no browser. On synthetic peaks: the peak search
   (height, prominence, the minimum distance keeping the taller), the half-maximum FWHM and
   the marker's geometry, the width's counting uncertainty against seeded noise; a pattern
   processed as the card does (the baseline on and off, peaks added and removed by hand, a
   position that is no number skipped). The Caglioti fit (exact data, weighted or not, too
   few peaks), the instrumental width from it or between the peaks, Scherrer's size and the
   instrument taken off in quadrature; the sizes summarised, a sample's and by reflection (one
   peak a sample, those not in every sample apart), the chart's series. The settings: a
   sample's own, a project's to v510 in points converted at each step (one step, several,
   files left out), a malformed state, the standard's, the state saved and read back. Then
   the fixture's three samples and its standard, at their defaults, as the page analyses
   them: the CSVs, the peak tables, the Caglioti box, the size chart's chips, each as HEAD
   v551's page wrote them (xrd-peaks.js before the split). And the words: the warnings, the
   step note, the chips, the note by peak, every label escaped. utils.js's helpers, which
   need a page to load, are taken from its source as they stand there. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { xrdml, rng } from './fixtures.mjs';
import { readXrdmlScanText } from '../xrd-instr.js';
import { boxSmooth } from '../smooth.js';
import * as M from '../xrd-peaks-model.js';
import * as H from '../xrd-peaks-html.js';

// utils.js's declarations as they stand there (it needs a page to load): a function to its
// closing brace, a const to its line's end; the CSVs' settings as a fresh page has them.
const UTILS = fs.readFileSync(new URL('../utils.js', import.meta.url), 'utf8');
function decl(name){
  let i = UTILS.search(new RegExp(`^function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = UTILS.indexOf('{', i), d = 0;
    for (; k < UTILS.length; k++){ if (UTILS[k] === '{') d++; else if (UTILS[k] === '}' && !--d) break; }
    return UTILS.slice(i, k + 1);
  }
  i = UTILS.search(new RegExp(`^const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in utils.js');
  return UTILS.slice(i, UTILS.indexOf('\n', i));
}
const NAMES = ['maxArr', 'meanArr', 'stdArr', 'boxStats', 'fmtNum', 'csvField', 'csvJoin', 'csvLine', 'esc', 'X_SVG'];
const U = new Function('settings', NAMES.map(decl).join('\n') + '\nreturn { maxArr, meanArr, stdArr, boxStats, fmtNum, csvLine, esc, X_SVG };')({ decimal: '.', field: ';' });
const sha = s => createHash('sha1').update(s).digest('hex');
const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
// A Gaussian peak of height h and full width w at c.
const gauss = (x, c, h, w)=> h*Math.exp(-4*Math.LN2*((x - c)/w)**2);
const axis = (a, step, n)=> Array.from({ length: n }, (_, i)=> a + i*step);
const DEF = M.fileParams({}, M.modeDef(false), M.sharedDef(false));

test('the peak search, the half-maximum FWHM and the marker, the width\'s counting uncertainty', ()=>{
  const x = axis(10, 0.01, 3001);
  // A tall peak with a narrow one on its flank, a broad one, a weak one (3 % of the tallest).
  const y = x.map(t=> gauss(t, 15, 1000, 0.3) + gauss(t, 15.2, 500, 0.1) + gauss(t, 25, 600, 0.5) + gauss(t, 35, 30, 0.4));
  const pos = pks => pks.map(pk=> +pk.pos.toFixed(2));
  assert.deepEqual(pos(M.findPeaks(x, y, 5, 3, 0.3, U)), [15, 25], 'the narrow one within 0.3° of the taller: left out; the weak one under 5 %');
  assert.deepEqual(pos(M.findPeaks(x, y, 2, 2, 0.1, U)), [15, 15.18, 25, 35], 'a shorter distance, a lower height and prominence: all four');
  assert.deepEqual(pos(M.findPeaks(x, y, 2, 20, 0.1, U)), [15, 25], 'the narrow one stands out of the flank by under 20 % of the tallest');
  const pk = M.findPeaks(x, y, 5, 3, 0.3, U)[1];
  assert.deepEqual([pk.idx, pk.height, pk.prominence], [1500, 600, 600]);
  assert.deepEqual(M.findPeaks(x, x.map(()=> 0), 5, 3, 0.3, U), [], 'nothing above zero: none');
  // The FWHM by the half-maximum crossings, and the marker's geometry from the same walk.
  const w = M.computeFWHM(x, y, 1503);
  near(w, 0.5, 2e-4, 'the broad peak\'s FWHM');
  const g = M.fwhmGeom(x, y, 1503);
  assert.deepEqual([g.idx, g.half, g.xr - g.xl], [1500, 300, w]);
  // No crossing on one side (a peak at the end): none.
  const edge = x.map(t=> gauss(t, 40, 100, 0.5));
  assert.ok(Number.isNaN(M.computeFWHM(x, edge, 3000)) && M.fwhmGeom(x, edge, 3000) === null && Number.isNaN(M.fwhmSigma(x, edge, 3000, edge, 0, null)));
  // The counting uncertainty: four times the counts halve it, a variance factor of 2 takes
  // it √2 times; against 400 noisy patterns (seeded), smoothed by a box 0.05° wide, the spread
  // of their FWHMs within 15 % (0.92 of it).
  const clean = x.map(t=> gauss(t, 25, 10000, 0.5) + 100), sm = boxSmooth(x, clean, 0.05), net = sm.map(v=> v - 100);
  const s1 = M.fwhmSigma(x, net, 1500, clean, 0.05, null);
  near(M.fwhmSigma(x, net.map(v=> 4*v), 1500, clean.map(v=> 4*v), 0.05, null)/s1, 0.5, 1e-12, 'four times the counts');
  near(M.fwhmSigma(x, net, 1500, clean, 0.05, clean.map(()=> 2))/s1, Math.SQRT2, 1e-12, 'variance factor 2');
  const rnd = rng(5).n, ws = [];
  for (let k = 0; k < 400; k++){
    const noisy = clean.map(v=> v + Math.sqrt(v)*rnd()), s = boxSmooth(x, noisy, 0.05).map(v=> v - 100);
    ws.push(M.computeFWHM(x, s, 1500));
  }
  const mean = ws.reduce((a, v)=> a + v, 0)/ws.length, sd = Math.sqrt(ws.reduce((a, v)=> a + (v - mean)**2, 0)/(ws.length - 1));
  near(sd/s1, 1, 0.15, `the spread of 400 noisy widths (${sd}) against the propagated one (${s1})`);
  // The nearest grid point to a 2θ, by bisection: an axis running down, one with points left out.
  assert.deepEqual([M.nearestIdx(x, 14.996), M.nearestIdx(x, 15.004), M.nearestIdx(x, 5), M.nearestIdx(x, 99), M.nearestIdx([], 3)], [500, 500, 0, 3000, 0]);
  assert.deepEqual([M.nearestIdx([40, 30, 20, 10], 26), M.nearestIdx([10, 11, 15, 16], 13.2), M.nearestIdx([10, 11, 15, 16], 12.9)], [1, 2, 1]);
});

test('a pattern processed as the card does: the smoothing and baseline, the peaks, those added and removed by hand', ()=>{
  const x = axis(20, 0.02, 1501), y = x.map(t=> gauss(t, 30, 800, 0.4) + gauss(t, 40, 400, 0.6) + 200 - 2*t);
  const f = { x, y };
  const pr = { ...DEF, smoothW: 0.1, snipW: 2 };
  const sm = M.smoothingOf(x, y, pr);
  assert.deepEqual(Object.keys(sm), ['smoothed', 'snip', 'detSub']);
  assert.deepEqual(sm.smoothed, boxSmooth(x, y, 0.1));
  assert.deepEqual(sm.snip, M.computeBaseline(x, sm.smoothed, 2));
  assert.deepEqual(sm.detSub, sm.smoothed.map((v, i)=> Math.max(0, v - sm.snip[i])));
  near(sm.snip[500], 200 - 2*x[500], 1, 'the baseline under the first peak: the slope');
  // The box unticked: no baseline, the pattern read from zero.
  const off = M.smoothingOf(x, y, { ...pr, blOn: false });
  assert.ok(off.snip.every(v=> v === 0) && off.detSub.every((v, i)=> v === Math.max(0, off.smoothed[i])));
  // Found, and with peaks added and removed: a manual one at 35 and its position that is no
  // number skipped (to v473 an add could store one), the detected one at 40 removed (within
  // min(0.1, 0.45·pkDist) of its position), and a manual one on it stays.
  const p0 = M.processingOf(f, sm, pr, [], [], U);
  assert.deepEqual(Object.keys(p0), ['smoothed', 'baseline', 'snip', 'subtracted', 'peaks']);
  assert.ok(p0.smoothed === sm.smoothed && p0.baseline === sm.snip && p0.snip === sm.snip && p0.subtracted === sm.detSub);
  assert.deepEqual(p0.peaks.map(pk=> [pk.pos, pk.detPos, pk.removed, !!pk.manual]), [[30, 30, false, false], [40, 40, false, false]]);
  for (const pk of p0.peaks){
    assert.equal(pk.fwhm, pk.fwhmClassic);
    assert.equal(pk.fwhmClassic, M.computeFWHM(x, sm.detSub, pk.idx));
    assert.equal(pk.fwhmSig, M.fwhmSigma(x, sm.detSub, pk.idx, y, 0.1, undefined));
  }
  const p1 = M.processingOf(f, sm, pr, [35, NaN, 'x', 40.02], [40.05], U);
  assert.deepEqual(p1.peaks.map(pk=> [pk.pos, pk.removed, !!pk.manual]), [[30, false, false], [35, false, true], [40, true, false], [40.02, false, true]]);
  const man = p1.peaks[1], gone = p1.peaks[2];
  assert.deepEqual([man.idx, man.height, man.detPos], [750, sm.detSub[750], 35]);
  assert.ok(Number.isNaN(gone.fwhm) && Number.isNaN(gone.fwhmClassic) && !('fwhmSig' in gone), 'a peak removed has no width');
  // Out of the tolerance (0.1°): kept.
  assert.equal(M.processingOf(f, sm, pr, [], [40.11], U).peaks[1].removed, false);
});

test('the Caglioti fit, the instrumental width from it or between the peaks, Scherrer\'s size', ()=>{
  const uvw = [0.012, -0.004, 0.003], th = tt => tt/2*Math.PI/180;
  const pts = [20, 30, 40, 50, 60, 70, 80].map(tt=> ({ x: tt, th: th(tt), b: Math.sqrt(M.cagAt(uvw, th(tt))), s: 0.002 }));
  const f = M.fitCaglioti(pts);
  f.uvw.forEach((v, i)=> near(v, uvw[i], 1e-9, 'uvw ' + i));
  assert.deepEqual([f.n, f.dof, f.weighted, Number.isNaN(f.s)], [7, 4, true, true]);
  near(f.r2, 1, 1e-9, 'R²'); near(f.chi2r, 0, 1e-9, 'χ²red'); near(f.rms, 0, 1e-9, 'rms');
  // Off the curve by ±σ, alternately: χ²red about the scatter, the errors scaled by it.
  const noisy = pts.map((p, i)=> ({ ...p, b: p.b + (i % 2 ? 0.002 : -0.002) })), fn = M.fitCaglioti(noisy);
  assert.ok(fn.chi2r > 0.3 && fn.chi2r < 3 && fn.se.every(v=> v > 0), JSON.stringify(fn));
  // Unweighted (no σ): its errors from the residuals; a peak with no σ is given the largest.
  const un = M.fitCaglioti(noisy.map(({ s, ...p })=> p));
  assert.deepEqual([un.weighted, Number.isNaN(un.chi2r), un.s > 0], [false, true, true]);
  const one = M.fitCaglioti(noisy.map((p, i)=> i === 3 ? { ...p, s: NaN } : p));
  assert.ok(one.weighted && one.uvw.every(Number.isFinite));
  // Too few: none at 2 peaks; exact at 3, no error.
  assert.equal(M.fitCaglioti(pts.slice(0, 2)), null);
  const three = M.fitCaglioti(pts.slice(0, 3));
  assert.deepEqual([three.dof, three.se.every(Number.isNaN), Number.isNaN(three.chi2r)], [0, true, true]);
  // The standard's model from its peaks: those kept with a width, in 2θ order.
  const peaks = [{ pos: 50, fwhm: 0.2, fwhmSig: 0.01 }, { pos: 30, fwhm: 0.1, fwhmSig: 0.02 }, { pos: 40, fwhm: NaN }, { pos: 45, fwhm: 0.3, removed: true }];
  const m2 = M.instrModelOf(peaks);
  assert.deepEqual(m2, { pts: [{ x: 30, th: th(30), b: 0.1, s: 0.02 }, { x: 50, th: th(50), b: 0.2, s: 0.01 }], fit: null });
  // Its width: from the fit; with fewer than 3 peaks, between them, held at the end ones; none.
  near(M.instrBetaOf({ pts, fit: f }, 35), Math.sqrt(M.cagAt(f.uvw, th(35))), 1e-15, 'from the fit');
  assert.deepEqual([20, 30, 40, 50, 60].map(tt=> M.instrBetaOf(m2, tt)), [0.1, 0.1, 0.15000000000000002, 0.2, 0.2]);
  assert.deepEqual([M.instrBetaOf(null, 40), M.instrBetaOf({ pts: [], fit: null }, 40)], [0, 0]);
  assert.equal(M.instrBetaOf({ pts: [{ x: 30, b: 0.1 }, { x: 30, b: 0.3 }, { x: 50, b: 0.2 }], fit: null }, 30), 0.1, 'two peaks at one angle span nothing');
  assert.deepEqual([M.stdSpanOf(m2), M.stdSpanOf(null)], [[29.9, 50.2, 30, 50], null]);
  // Scherrer: D = Kλ/(β cosθ), in nm; the instrument off in quadrature; narrower than it, flagged.
  const D = 0.9*1.540598/(0.2*Math.PI/180*Math.cos(th(30)))/10;
  assert.equal(M.scherrerD(0.2, 30, 0.9, 1.540598), D);
  assert.ok([0, -1, NaN, Infinity].every(b=> Number.isNaN(M.scherrerD(b, 30, 0.9, 1.540598))));
  assert.equal(M.sizeCorr(0.2, 30, 0.9, 1.540598, m2), M.scherrerD(Math.sqrt(0.2**2 - 0.1**2), 30, 0.9, 1.540598));
  assert.equal(M.sizeCorr(0.2, 30, 0.9, 1.540598, null), D, 'no standard: none taken off');
  assert.ok(Number.isNaN(M.sizeCorr(0.1, 30, 0.9, 1.540598, m2)), 'as narrow as the instrument: no size');
  assert.deepEqual([M.belowInstr(0.1, 30, m2), M.belowInstr(0.11, 30, m2), M.belowInstr(0.05, 30, null), M.belowInstr(NaN, 30, m2)], [true, false, false, false]);
});

test('the sizes summarised: a sample\'s, by reflection; the chart\'s series', ()=>{
  const s = M.sizeSummary([10, 12, 14, 30], [], false, true, U);
  assert.deepEqual(s, { isStd: false, showCorr: true, rawN: 4, rawMean: 16.5, rawStd: U.stdArr([10, 12, 14, 30]), rawBox: U.boxStats([10, 12, 14, 30]), rawVals: [10, 12, 14, 30],
    corrN: 0, corrMean: NaN, corrStd: NaN, corrBox: null, corrVals: [] });
  near(s.rawStd, Math.sqrt(((6.5**2) + (4.5**2) + (2.5**2) + (13.5**2))/3), 1e-12, 'the std over n − 1');
  // A sample's: its kept peaks' sizes, raw and corrected; those narrower than the instrument,
  // and those beyond the standard's peaks by more than their width, counted.
  const m = M.instrModelOf([{ pos: 30, fwhm: 0.1, fwhmSig: 0.01 }, { pos: 50, fwhm: 0.15, fwhmSig: 0.01 }]);
  const pk = (detPos, w, o)=> ({ pos: detPos, detPos, fwhmClassic: w, ...o });
  const pr = { peaks: [pk(32, 0.3), pk(40, 0.12), pk(60, 0.4), pk(45, 0.3, { removed: true }), pk(47, NaN)] };
  const fp = { K: 0.9, lambda: 1.540598 };
  const st = M.sampleSizes(pr, fp, m, false, U);
  assert.deepEqual(st.rawVals, [32, 40, 60].map((tt, i)=> M.scherrerD([0.3, 0.12, 0.4][i], tt, 0.9, 1.540598)));
  assert.deepEqual(st.corrVals, [32, 40, 60].map((tt, i)=> M.sizeCorr([0.3, 0.12, 0.4][i], tt, 0.9, 1.540598, m)).filter(Number.isFinite), 'the one narrower than the instrument has none');
  assert.deepEqual([st.below, st.outside, st.span, st.showCorr], [1, 1, [29.9, 50.15, 30, 50], true]);
  const none = M.sampleSizes(pr, fp, null, false, U);
  assert.deepEqual([none.rawN, none.corrN, none.below, none.outside, none.span, none.showCorr], [3, 0, 0, 0, null, false]);
  assert.equal(M.sampleSizes(undefined, fp, null, false, U).rawN, 0, 'no processing: nothing');
  // By reflection: within √(w₁² + w₂²) of the last one (its mean position and width) the
  // same; those in every sample common, the rest apart.
  const procs = [{ peaks: [pk(30, 0.2), pk(40, 0.2), pk(50, 0.3)] }, { peaks: [pk(30.15, 0.2), pk(50.2, 0.3), pk(70, 0.3)] }, { peaks: [pk(30.05, 0.2), pk(49.9, 0.3)] }];
  const R = M.sizeReflections(procs, [fp, fp, fp], null);
  assert.deepEqual(R.idxs, [0, 1, 2]);
  assert.deepEqual(R.common.map(g=> [+g.pos.toFixed(6), [...g.by.keys()]]), [[30.066667, [0, 2, 1]], [50.033333, [2, 0, 1]]]);
  assert.deepEqual(R.extra.map(g=> [g.pos, [...g.by.keys()]]), [[40, [0]], [70, [1]]]);
  // One peak a sample: a second of the same sample there starts another.
  const two = M.sizeReflections([{ peaks: [pk(30, 0.2), pk(30.1, 0.2)] }, { peaks: [pk(30.05, 0.2)] }], [fp, fp], null);
  assert.deepEqual([two.common.map(g=> [g.pos, [...g.by.keys()]]), two.extra.map(g=> [g.pos, [...g.by.keys()]])], [[[30.025, [0, 1]]], [[30.1, [0]]]]);
  assert.ok(M.byPeakOk(R) && !M.byPeakOk(M.sizeReflections([procs[0]], [fp], null)) && !M.byPeakOk(M.sizeReflections([], [], null)));
  assert.deepEqual(M.sizeReflections([procs[0], undefined], [fp, fp], null).idxs, [0], 'a sample not processed left out');
  const rows = M.reflectionRows(M.sizeReflections(procs, [fp, fp, fp], m), m, U);
  assert.deepEqual(rows.map(r=> [r.name, r.label, r.rawN, r.corrN, r.showCorr, r.isStd]), [['2θ 30.07°', '30.07°', 3, 3, true, false], ['2θ 50.03°', '50.03°', 3, 3, true, false]]);
  assert.deepEqual(rows[0].rawVals, rows[0].ps.map(q=> q.raw));
  // The chart: a series, two with a standard; each box's top its whisker or an outlier above.
  assert.deepEqual(M.sizeSeries([{ corrBox: null }]).map(x=> x.k), ['raw']);
  assert.deepEqual(M.sizeSeries([{ corrBox: null }, { corrBox: {} }]).map(x=> [x.k, x.name, x.color]), [['raw', 'size', '#3aa0ff'], ['corr', 'size corr.', '#ff7a59']]);
  assert.deepEqual([M.boxTop({ hi: 10, out: [] }), M.boxTop({ hi: 10, out: [2, 40] })], [10, 40]);
  assert.deepEqual(M.sizeTops([{ rawBox: { hi: 10, out: [] }, corrBox: { hi: 20, out: [25] } }, { rawBox: null, corrBox: { hi: 0, out: [] } }]), [10, 25]);
  // The largest of the maxima (maxArr's: −∞ for a pattern with none), 1 with none above zero.
  assert.deepEqual([M.topOf([3, 7, -Infinity]), M.topOf([]), M.topOf([-2, 0])], [7, 1, 1]);
});

test('the settings: a sample\'s own, a project\'s to v510 converted, a malformed state, the state saved and read back', ()=>{
  const SH = { smoothW: 0.25, snipW: 2.5, pkHeight: 5, pkProm: 3, pkDist: 0.3, K: 0.9, lambda: 1.540598, blOn: true };
  const PM = { N: 'shared', blWin: 'shared', pkHeight: 'per', pkProm: 'per', pkDist: 'per', K: 'shared', lambda: 'shared' };
  assert.deepEqual([M.sharedDef(false), M.modeDef(false)], [SH, PM]);
  assert.deepEqual([M.sharedDef(true), M.modeDef(true)], [{ ...SH, smoothW: 0 }, Object.fromEntries(Object.keys(PM).map(k=> [k, 'shared']))]);
  assert.deepEqual([M.modeOf('smoothW'), M.modeOf('snipW'), M.modeOf('blOn'), M.modeOf('K')], ['N', 'blWin', 'blWin', 'K']);
  // A file's: the shared value under all, its own (else the shared) under one; the box on unless false.
  assert.deepEqual(M.fileParams({ smoothW: 0.1, pkHeight: 9, blOn: false }, PM, SH), { ...SH, pkHeight: 9 });
  assert.deepEqual(M.fileParams({ smoothW: 0.1, pkHeight: 9, blOn: false }, { ...PM, N: 'per', blWin: 'per' }, SH), { ...SH, smoothW: 0.1, pkHeight: 9, blOn: false });
  assert.deepEqual(M.fileParams({}, { ...PM, N: 'per' }, SH), SH);
  // A sample's entry: a width in points of v510 at its step (N = 1 none), a value below its
  // least none (a width) or that least, one that is no number none; those held in place of its own.
  assert.deepEqual(M.entryOf({ N: 10, blWin: 150, pkHeight: 7, K: -3, pkDist: 'a' }, 0.01), { smoothW: 0.1, snipW: 1.5, pkHeight: 7, K: 1e-6, blOn: true });
  assert.deepEqual(M.entryOf({ N: 1, blWin: 0.2 }, 0.02), { smoothW: 0, snipW: 0.02, blOn: true }, 'N = 1: none; under a point: one');
  assert.deepEqual(M.entryOf({ smoothW: -1, snipW: 0, blOn: false }, 0.01), { blOn: false });
  assert.deepEqual(M.entryOf({ N: 10 }, 0.01, { N: 4, blWin: 100, blOn: false }), { smoothW: 0.04, snipW: 1, blOn: false });
  assert.deepEqual(M.entryOf({ snipW: 2 }, 0.01, { blWin: 100, blOn: false }), { snipW: 2, blOn: true }, 'converted already: its own box');
  assert.deepEqual([M.objOf(null), M.objOf([1]), M.objOf(5)], [{}, {}, {}]);
  // Saved and read back.
  const c = { perParams: [{ ...SH, pkHeight: 7 }, { ...SH, blOn: false }], manualPeaks: [[33.3], []], removedPeaks: [[], [40, 41]], shared: { ...SH, K: 0.95 },
    paramMode: { ...PM, blWin: 'per' }, sizeBy: 'peak', norm: 'local', stepNote: [], heldPts: {} };
  const s = M.stateOf(c);
  assert.deepEqual(s, { perParams: c.perParams, manualPeaks: c.manualPeaks, removedPeaks: c.removedPeaks, shared: c.shared, paramMode: c.paramMode, sizeBy: 'peak', norm: 'local' });
  assert.ok(s.perParams[0] !== c.perParams[0] && s.manualPeaks[0] !== c.manualPeaks[0] && s.shared !== c.shared, 'copies');
  assert.deepEqual(Object.keys(M.stateOf({ ...c, stepNote: ['N'], heldPts: { N: 4 } })).slice(-2), ['stepNote', 'heldPts']);
  const back = M.readState(JSON.parse(JSON.stringify(s)), false, [0.01, 0.01], [0.01, 0.01]);
  assert.deepEqual(back, { shared: c.shared, paramMode: c.paramMode, heldPts: {}, perParams: c.perParams, stepNote: [], manualPeaks: c.manualPeaks, removedPeaks: c.removedPeaks, sizeBy: 'peak' });
  // v510's points: at one step, one width each; at two, under all, a width a pattern (the
  // chip to one, the note), the shared value at the median step; a file left out holds them.
  const old = { shared: { N: 10, blWin: 150, pkHeight: 5, pkProm: 3, pkDist: 0.3, K: 0.9, lambda: 1.540598, blOn: true }, paramMode: PM,
    perParams: [{ N: 10, blWin: 150, pkHeight: 7 }, { N: 10, blWin: 150 }], manualPeaks: [[30], []], removedPeaks: [[], [40]] };
  const one = M.readState(old, false, [0.01, 0.01], [0.01, 0.01]);
  assert.deepEqual([one.shared.smoothW, one.shared.snipW, one.paramMode, one.stepNote, one.heldPts], [0.1, 1.5, PM, [], {}]);
  assert.deepEqual(one.perParams, [{ smoothW: 0.1, snipW: 1.5, pkHeight: 7, blOn: true }, { smoothW: 0.1, snipW: 1.5, blOn: true }]);
  const two = M.readState(old, false, [0.01, 0.02], [0.01, 0.02]);
  assert.deepEqual(two, { shared: { ...SH, smoothW: 0.2, snipW: 3 }, paramMode: { ...PM, N: 'per', blWin: 'per' }, heldPts: {},
    perParams: [{ smoothW: 0.1, snipW: 1.5, pkHeight: 7, blOn: true }, { smoothW: 0.2, snipW: 3, blOn: true }], stepNote: ['N', 'blWin'],
    manualPeaks: [[30], []], removedPeaks: [[], [40]], sizeBy: 'sample' });
  const out = M.readState(old, false, [0.01, 0.02], [0.01, 0.02, 0.04]);
  assert.deepEqual([out.heldPts, out.stepNote, out.shared.smoothW], [{ N: 10, blWin: 150, blOn: true }, ['N', 'blWin'], 0.2]);
  // Under one already: each sample's own, converted at its step.
  const per = M.readState({ ...old, paramMode: { ...PM, N: 'per' }, perParams: [{ N: 4, blWin: 150 }, { blWin: 150 }] }, false, [0.01, 0.02], [0.01, 0.02]);
  assert.deepEqual(per.perParams.map(q=> q.smoothW), [0.04, 0.2]);
  // A malformed state: every value of another type, the defaults; lists cut or filled to the files.
  const bad = { shared: { smoothW: 'x', snipW: -1, pkHeight: null, K: -3, lambda: 'Mo', blOn: 0 }, paramMode: { N: 'per', blWin: 7, pkHeight: 'shared' },
    perParams: [{ smoothW: 0.3, pkDist: 'a' }, 5, null], manualPeaks: [[30, 'x', null], 'q'], removedPeaks: { a: 1 }, sizeBy: 'peak', norm: 'weird',
    heldPts: { N: 4, blWin: 'x', blOn: true }, stepNote: ['N', 'zz'] };
  assert.deepEqual(M.readState(bad, false, [0.01, 0.02], [0.01, 0.02, 0.03]), { shared: { ...SH, K: 1e-6 }, paramMode: { ...PM, N: 'per', pkHeight: 'shared' },
    heldPts: { N: 4 }, perParams: [{ smoothW: 0.3, blOn: true }, { smoothW: 0.08, blOn: true }], stepNote: ['N'], manualPeaks: [[30], []], removedPeaks: [[], []], sizeBy: 'peak' });
  for (const v of [null, 5, 'x', []]) assert.deepEqual(M.readState(v, false, [0.01], [0.01]),
    { shared: SH, paramMode: PM, heldPts: {}, perParams: [{ blOn: true }], stepNote: [], manualPeaks: [[]], removedPeaks: [[]], sizeBy: 'sample' });
  // The standard's: its own defaults, everything shared whatever the state says.
  const std = M.readState({ paramMode: { N: 'per', pkHeight: 'per' } }, true, [0.01], [0.01]);
  assert.deepEqual([std.shared.smoothW, Object.values(std.paramMode).every(v=> v === 'shared')], [0, true]);
});

// The fixture's patterns as xrd.js keeps them (read by xrd-instr.js; x running up already).
const pattern = (k, label)=>{ const sc = readXrdmlScanText(new Uint8Array(xrdml(k))); return { name: label + '.xrdml', label, x: sc.x, y: sc.y, ...(sc.varMul ? { varMul: sc.varMul } : {}) }; };
// The table's rows as cells, and its summary.
const cells = h => [...h.matchAll(/<tr class="([^"]*)"[^>]*>(.*?)<\/tr>/g)].map(r=> [...r[2].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(x=> x[1]));
// Markup as the page serialises it (an element closed by />, an attribute with no value).
const asPage = s => s.replace(/<line([^>]*)\/>/g, '<line$1></line>');

test('the fixture\'s samples and standard as the page analyses them: the CSVs, the tables, the Caglioti fit (HEAD v551\'s)', ()=>{
  const files = [0, 1, 2].map(k=> pattern(k, 's0' + k)), sf = pattern(11, 's11');
  const run = (f, std)=>{ const pr = M.fileParams({}, M.modeDef(std), M.sharedDef(std)); return { pr, proc: M.processingOf(f, M.smoothingOf(f.x, f.y, pr), pr, [], [], U) }; };
  const S = files.map(f=> run(f, false)), T = run(sf, true);
  const view = m => ({ files, procs: S.map(s=> s.proc), fps: S.map(s=> s.pr), m, norm: 'global', std: false });
  // No standard.
  const plain = M.csvTables('Scherrer - ', view(null), U), byName = Object.fromEntries(plain.map(e=> [e.name.replace('Scherrer - ', ''), e.text]));
  assert.deepEqual(Object.keys(byName), ['diffractograms.csv', 'crystallite_size.csv', 'crystallite_size_by_peak.csv', 'peaks.csv']);
  assert.equal(sha(byName['diffractograms.csv']), 'd19ca989e4e6582a2bae3ec183576d432dbe45c4');
  assert.equal(byName['diffractograms.csv'].split('\n').slice(0, 2).join('\n'), '2Theta_s00;s00;Raw_s00;Smoothed_s00 (w=0.25°);SNIP_background_s00 (W=5°);2Theta_s01;s01;Raw_s01;Smoothed_s01 (w=0.25°);SNIP_background_s01 (W=5°);2Theta_s02;s02;Raw_s02;Smoothed_s02 (w=0.25°);SNIP_background_s02 (W=5°)\n'
    + '10.000000;0.000000;232.000000;231.975195;231.975195;10.000000;0.000000;232.000000;232.905039;232.905039;10.000000;0.000000;232.000000;233.187289;233.187289');
  assert.equal(byName['crystallite_size.csv'], 'Sample;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm\n'
    + 's00;26.66;2.33;7;27.24;25.01;28.35\ns01;26.67;2.31;7;27.20;25.02;28.35\ns02;26.65;2.36;7;27.15;25.00;28.39\n');
  assert.equal(byName['crystallite_size_by_peak.csv'], 'Reflection_2theta_deg;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm;Crystallite_size_nm_s00;Crystallite_size_nm_s01;Crystallite_size_nm_s02\n'
    + '22.783;29.46;0.01;3;29.47;29.46;29.47;29.45;29.47;29.47\n32.436;28.76;0.02;3;28.76;28.75;28.78;28.76;28.74;28.79\n40.004;27.97;0.03;3;27.96;27.95;27.98;27.94;27.96;28.00\n'
    + '46.528;27.20;0.05;3;27.20;27.18;27.22;27.24;27.20;27.15\n57.854;25.68;0.03;3;25.67;25.66;25.69;25.71;25.67;25.66\n67.898;24.34;0.03;3;24.34;24.33;24.35;24.31;24.36;24.34\n'
    + '77.256;23.20;0.08;3;23.20;23.16;23.24;23.20;23.27;23.12\n');
  assert.equal(byName['peaks.csv'], 'Peak_2Theta_s00;Peak_RelIntensity_s00;Peak_FWHM_deg_s00;Peak_Size_nm_s00;Peak_2Theta_s01;Peak_RelIntensity_s01;Peak_FWHM_deg_s01;Peak_Size_nm_s01;Peak_2Theta_s02;Peak_RelIntensity_s02;Peak_FWHM_deg_s02;Peak_Size_nm_s02\n'
    + '22.769831;0.152827;0.27517;29.450;22.782835;0.152897;0.27502;29.466;22.795839;0.152348;0.27499;29.471\n'
    + '32.431730;1.000000;0.28762;28.765;32.431730;1.000000;0.28787;28.741;32.444733;1.000000;0.28742;28.786\n'
    + '39.986996;0.306354;0.30259;27.938;40.000000;0.307750;0.30239;27.957;40.026008;0.307387;0.30194;28.001\n'
    + '46.514954;0.514870;0.31740;27.243;46.527958;0.517463;0.31793;27.199;46.540962;0.514011;0.31849;27.153\n'
    + '57.828349;0.408369;0.35300;25.710;57.854356;0.413365;0.35356;25.672;57.880364;0.409601;0.35384;25.655\n'
    + '67.867360;0.240386;0.39387;24.310;67.906372;0.242032;0.39309;24.364;67.919376;0.240981;0.39351;24.340\n'
    + '77.230169;0.137000;0.43827;23.199;77.256177;0.137553;0.43693;23.274;77.282185;0.136494;0.43997;23.118\n');
  // The local and none normalisations: the diffractograms' net column alone changes.
  const col = (t, j)=> t.split('\n').slice(1, -1).map(r=> r.split(';')[j]);
  const loc = M.csvTables('', { ...view(null), norm: 'local' }, U)[0].text, raw = M.csvTables('', { ...view(null), norm: 'none' }, U)[0].text;
  assert.equal(Math.max(...col(loc, 6).map(Number)), 1, 'local: each its own max');
  assert.deepEqual(col(raw, 1).map(Number), S[0].proc.subtracted.map(v=> +v.toFixed(6)), 'none: the counts');
  assert.deepEqual(col(loc, 2), col(byName['diffractograms.csv'], 2), 'the raw column as it was');
  // The standard: its peaks, their widths' σ, the Caglioti fit.
  const m = M.instrModelOf(T.proc.peaks);
  assert.equal(m.pts.length, 7);
  const sc = M.csvTables('Scherrer - ', { files: [sf], procs: [T.proc], fps: [T.pr], m: null, norm: 'global', std: true }, U);
  assert.deepEqual(sc.map(e=> e.name), ['standard.csv']);
  assert.equal(sha(sc[0].text), 'aff3cfbb1e4d7173bbd9dafb644d1f35287162d0');
  assert.equal(sc[0].text.split('\n').slice(0, 3).join('\n'), '2Theta_s11;s11;Raw_s11;Smoothed_s11 (w=0°);SNIP_background_s11 (W=5°);Peak_2Theta_s11;Peak_RelIntensity_s11;Peak_FWHM_deg_s11;Peak_FWHM_sigma_deg_s11;Peak_Size_nm_s11\n'
    + '10.000000;0.000000;237.000000;237.000000;237.000000;22.847854;0.172065;0.15882;0.00624;51.033\n10.013004;0.000160;235.000000;235.000000;234.000000;32.535761;1.000000;0.19288;0.00246;42.907');
  const cag = H.cagliotiHtml(m, 1);
  assert.equal(cag.box, '<div class="txt-mini">Caglioti fit</div><div class="pg-stat cag-formula">FWHM² = U·tan²θ + V·tanθ + W</div>'
    + '<div class="pg-stat">U: <b>0.140 ± 0.047 °²</b></div><div class="pg-stat">V: <b>0.062 ± 0.039 °²</b></div><div class="pg-stat">W: <b>0.0070 ± 0.0075 °²</b></div>'
    + '<div class="pg-stat" title="χ² = Σ((FWHM − fit)/σ)² over 4 degrees of freedom, σ each width\'s counting uncertainty. About 1: the curve follows the peaks within their counting errors. Well above 1: it does not (Kα₂ partly resolved, asymmetry, a peak that is not the standard\'s), and U, V, W carry errors scaled by its square root.">χ²<sub>red</sub>: <b>0.032</b></div>'
    + '<div class="pg-stat" title="Weighted as the fit is (1/σ² on each width)">R²: <b>0.9997</b></div><div class="pg-stat" title="Largest residual: 0.0016°">FWHM residual (RMS): <b>0.00080°</b></div>'
    + '<div class="pg-stat">Peaks: <b>7</b>, 2θ 22.85–77.56°</div>');
  assert.equal(cag.alert, '');
  const stdTable = H.peakTableHtml(T.proc.peaks.filter(pk=> !pk.removed), { std: true, m: null, fp: T.pr, picked: null, st: null }, U);
  assert.equal(sha(asPage(stdTable)), '06803cc4a87466b39b94102841c641d5ef99d949');
  assert.deepEqual(cells(stdTable), [['1', '22.848', '17.2%', '0.159'], ['2', '32.536', '100.0%', '0.193'], ['3', '40.130', '29.0%', '0.219'], ['4', '46.671', '47.0%', '0.245'],
    ['5', '58.036', '35.9%', '0.292'], ['6', '68.127', '21.0%', '0.336'], ['7', '77.555', '12.0%', '0.384']]);
  assert.deepEqual(stdTable.match(/title="± [^"]*"/g), ['0.0062', '0.0025', '0.0055', '0.0055', '0.0072', '0.0088', '0.018'].map(v=> `title="± ${v}° (counting statistics)"`));
  // The samples with it: the corrected sizes.
  const corr = Object.fromEntries(M.csvTables('Scherrer - ', view(m), U).map(e=> [e.name.replace('Scherrer - ', ''), e.text]));
  assert.equal(corr['diffractograms.csv'], byName['diffractograms.csv']);
  assert.equal(corr['crystallite_size.csv'], 'Sample;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm;Crystallite_size_corr_nm;Crystallite_size_corr_std_nm;Crystallite_size_corr_n;Crystallite_size_corr_median_nm;Crystallite_size_corr_Q1_nm;Crystallite_size_corr_Q3_nm\n'
    + 's00;26.66;2.33;7;27.24;25.01;28.35;42.40;4.18;7;42.65;39.64;45.69\ns01;26.67;2.31;7;27.20;25.02;28.35;42.51;4.36;7;42.49;39.64;45.81\ns02;26.65;2.36;7;27.15;25.00;28.39;42.31;4.04;7;42.33;39.78;45.70\n');
  assert.equal(sha(corr['crystallite_size_by_peak.csv']), '0212ccb6eaea2e89d1c4e1e00b33c5a1bd1d2318');
  assert.equal(corr['crystallite_size_by_peak.csv'].split('\n')[1], '22.783;29.46;0.01;3;29.47;29.46;29.47;36.09;0.02;3;36.10;36.08;36.11;29.45;29.47;29.47');
  assert.equal(sha(corr['peaks.csv']), '2832017f1d6a8b928b12d9aabbf9253811ccd488');
  assert.equal(corr['peaks.csv'].split('\n')[1], '22.769831;0.152827;0.27517;29.450;36.066;22.782835;0.152897;0.27502;29.466;36.100;22.795839;0.152348;0.27499;29.471;36.113');
  // The first sample's table, without the standard and with it.
  const pks = S[0].proc.peaks.filter(pk=> !pk.removed);
  const t0 = H.peakTableHtml(pks, { std: false, m: null, fp: S[0].pr, picked: null, st: M.sampleSizes(S[0].proc, S[0].pr, null, false, U) }, U);
  const t1 = H.peakTableHtml(pks, { std: false, m, fp: S[0].pr, picked: null, st: M.sampleSizes(S[0].proc, S[0].pr, m, false, U) }, U);
  assert.deepEqual([sha(asPage(t0)), sha(asPage(t1))], ['a7d21f4f5ca1f31ecea5c57d1e960a073789d80c', '982f38bbbf6da0a87b35f98f5f018b9b67485572']);
  assert.deepEqual(cells(t1)[0], ['1', '22.770', '15.3%', '0.275', '29.5', '36.1']);
  assert.ok(t0.endsWith('<div class="size-summary">Mean crystallite size: <b>26.7 ± 2.3 nm</b></div>'));
  assert.ok(t1.endsWith('<div class="size-summary">Mean crystallite size: <b>26.7 ± 2.3 nm</b><br>Instr.-corrected: <b>42.4 ± 4.2 nm</b></div>'));
  // A peak picked: its row marked.
  const t2 = H.peakTableHtml(pks, { std: false, m: null, fp: S[0].pr, picked: pks[1].pos, st: M.sampleSizes(S[0].proc, S[0].pr, null, false, U) }, U);
  assert.deepEqual([...t2.matchAll(/<tr class="([^"]*)"/g)].map(r=> r[1]), ['peak-row', 'peak-row selected', 'peak-row', 'peak-row', 'peak-row', 'peak-row', 'peak-row']);
  // The size chart's chips (by sample, by peak), as the page wrote them; every reflection common: no note.
  const R = M.sizeReflections(S.map(s=> s.proc), S.map(s=> s.pr), m);
  assert.equal(H.sizeChipsHtml(R.idxs.length, M.byPeakOk(R), 'sample'), '<button type="button" class="mode-chip plot-chip is-on" data-size-by="sample" title="Crystallite size by sample">by sample</button>'
    + '<button type="button" class="mode-chip plot-chip" data-size-by="peak" title="Crystallite size by peak">by peak</button>');
  assert.equal(H.sizeNoteHtml(R, 'peak', files.map(f=> f.label), U), '');
});

test('the words: the warnings under the table, the step note, the chips, the note by peak, labels escaped', ()=>{
  assert.deepEqual([H.fmtMeanStd(12.345, 1.26, 3), H.fmtMeanStd(12.345, 1.26, 1), H.fmtMeanStd(NaN, 1, 3), H.fmtMeanStd(5, NaN, 2)], ['12.3 ± 1.3', '12.3', '—', '5.0']);
  assert.deepEqual([H.fmtPar(0.01234, 0.00056), H.fmtPar(123.4, 12), H.fmtPar(0.012345678, NaN), H.fmtPar(NaN, 1)], ['0.01234 ± 0.00056', '123 ± 12', '0.01235', '—']);
  assert.deepEqual([H.fmtCell(12.34), H.fmtCell(Infinity)], ['12.3', '—']);
  assert.equal(H.belowInstrHtml(1), '<div class="alert warn">⚠ 1 peak is narrower than the instrumental width at its angle, which is not physically possible: the standard is likely unsuitable. It is left out of the corrected size.</div>');
  assert.match(H.belowInstrHtml(2), /2 peaks are narrower .* at their angles, .* They are left out/);
  assert.equal(H.outsideStdHtml(1, [29, 51, 30, 50]), '<div class="alert warn">⚠ 1 peak lies beyond the standard\'s peaks (30.00–50.00°) by more than its width: there the instrumental width is extrapolated, not measured.</div>');
  assert.match(H.outsideStdHtml(3, [29, 51, 30, 50]), /3 peaks lie .* by more than their width/);
  // The table's warnings, from the sample's sizes.
  const st = { rawMean: 20, rawStd: 2, rawN: 3, showCorr: true, corrMean: NaN, corrStd: NaN, corrN: 0, below: 2, outside: 1, span: [29, 51, 30, 50] };
  const pk = { pos: 32, detPos: 32, height: 0, fwhmClassic: 0.3 };
  const t = H.peakTableHtml([pk], { std: false, m: null, fp: { K: 0.9, lambda: 1.540598 }, picked: null, st }, { ...U, X_SVG: n => `[x${n}]` });
  assert.ok(t.includes('<td>—</td>'), 'heights all 0: no relative intensity');
  assert.ok(t.endsWith('<br>Instr.-corrected: <b>— nm</b></div>' + H.belowInstrHtml(2) + H.outsideStdHtml(1, st.span)));
  assert.ok(t.includes('<button class="peak-del is-danger idle-dim" data-det="32" data-manual="0" title="Remove peak">[x13]</button>'));
  // With the standard: the corrected size, ⚠ where the peak is narrower than the instrument.
  const m = M.instrModelOf([{ pos: 30, fwhm: 0.35, fwhmSig: 0.01 }]);
  const tc = H.peakTableHtml([{ ...pk, height: 1, manual: true }, { pos: 50, detPos: 50, height: 2, fwhmClassic: 0.5 }], { std: false, m, fp: { K: 0.9, lambda: 1.540598 }, picked: null, st: { ...st, below: 0, outside: 0 } }, U);
  const D = (b, tt)=> H.fmtCell(M.scherrerD(b, tt, 0.9, 1.540598));
  assert.deepEqual(cells(tc), [['1', '32.000', '50.0%', '0.300', D(0.3, 32), '⚠'], ['2', '50.000', '100.0%', '0.500', D(0.5, 50), D(Math.sqrt(0.5**2 - 0.35**2), 50)]]);
  assert.ok(tc.includes('<td title="Narrower than the instrumental width at this angle">⚠</td>') && tc.includes('<tr class="peak-row manual-peak"'));
  // A project of v510 whose steps differ: the chips its conversion turned to one, with the ×.
  const x = n => `<svg w="${n}"/>`;
  assert.equal(H.stepNoteHtml([], { X_SVG: x }), '');
  assert.equal(H.stepNoteHtml(['N'], { X_SVG: x }), '<div class="alert warn">⚠ The patterns were measured at different steps: the smoothing, set in points up to v510, is kept as it was, a width for each pattern (one). Set one width in all to treat them alike.<button class="alert-dismiss close-x" data-step-x title="Dismiss"><svg w="15"/></button></div>');
  assert.match(H.stepNoteHtml(['N', 'blWin'], { X_SVG: x }), /the smoothing and SNIP width, set in points up to v510, are kept as they were,/);
  // The chips: none for one sample; by peak disabled with no reflection in every sample.
  assert.equal(H.sizeChipsHtml(1, false, 'sample'), '');
  assert.equal(H.sizeChipsHtml(2, false, 'sample'), '<button type="button" class="mode-chip plot-chip is-on" data-size-by="sample" title="Crystallite size by sample">by sample</button>'
    + '<button type="button" class="mode-chip plot-chip" data-size-by="peak" disabled title="No reflection is found in every sample">by peak</button>');
  // The note by peak: the reflections not in every sample, and whose, the labels escaped.
  const evil = `"'><i data-x=1></i>`;
  const R = { extra: [{ pos: 30.1, by: new Map([[0, {}]]) }, { pos: 70, by: new Map([[1, {}], [2, {}]]) }] };
  assert.equal(H.sizeNoteHtml(R, 'peak', ['a', evil, 'c'], U), `Not in every sample, left out: 30.10° (a); 70.00° (&quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt;, c).`);
  assert.equal(H.sizeNoteHtml(R, 'sample', ['a', 'b', 'c'], U), '', 'by sample: none');
  // The Caglioti box with no standard, no peaks, too few peaks, peaks at too few angles, an exact fit, a curve dropping to zero.
  assert.match(H.cagliotiHtml(null, 0).box, /No standard loaded: no instrumental correction/);
  assert.match(H.cagliotiHtml({ pts: [], fit: null }, 1).box, /No peaks: no instrumental correction/);
  assert.match(H.cagliotiHtml(M.instrModelOf([{ pos: 30, fwhm: 0.1 }]), 1).box, /Peaks: <b>1<\/b>, 2θ 30.00°.*it needs 3 peaks or more\. The instrumental width is the peak's FWHM at every angle/);
  assert.match(H.cagliotiHtml({ pts: [{ x: 30, b: 0.1 }, { x: 30, b: 0.2 }, { x: 50, b: 0.2 }], fit: null }, 1).box, /it needs peaks at 3 angles or more, and these 3 lie at 2\. The instrumental width is interpolated between the peaks/);
  const th = tt => tt/2*Math.PI/180, exact = M.instrModelOf([30, 50, 70].map(tt=> ({ pos: tt, fwhm: 0.1 + tt/1000, fwhmSig: 0.01 })));
  assert.match(H.cagliotiHtml(exact, 1).box, /Exact through its 3 peaks: no degree of freedom left/);
  assert.ok(!/R²|χ²<sub>red/.test(H.cagliotiHtml(exact, 1).box));
  const drop = { pts: [20, 40, 60].map(tt=> ({ x: tt, th: th(tt), b: 0.1 })), fit: { uvw: [0.01, -0.01, 0.001], se: [0, 0, 0], dof: 1, weighted: false, s: 0.001, r2: 0.9, rms: 0.001, maxRes: 0.002 } };
  assert.equal(H.cagliotiHtml(drop, 1).alert, '<div class="alert warn">⚠ The fitted FWHM² drops to zero inside the standard\'s range: there the curve is not physical, and no correction is made.</div>');
  assert.match(H.cagliotiHtml(drop, 1).box, /title="Unweighted: no counting uncertainty for the widths\. Residual standard error on FWHM²: 0\.0010 °² \(1 degree of freedom\)"/);
});
