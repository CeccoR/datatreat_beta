/* The Peaks / Scherrer card's calculations (xrd-peaks-model.js) and its words and markup that
   need no page (xrd-peaks-html.js), in Node: no browser. On synthetic peaks: the peak search
   (height, prominence, the minimum distance keeping the taller), the half-maximum FWHM and
   the marker's geometry, the width's counting uncertainty against seeded noise; a pattern
   processed as the card does (the baseline on and off, peaks added and removed by hand, a
   position that is no number skipped). The Caglioti fit (exact data, weighted or not, too
   few peaks), the instrumental width from it or between the peaks, Scherrer's size and the
   instrument taken off in quadrature; the sizes summarised, a sample's (with a CIF, its
   assigned peaks') and by species, by sample and by reflection (v575; to v574 by reflection
   the samples' peaks matched by position), the chart's series, a species each. The settings:
   a sample's own, a malformed state, the standard's, the state saved and read back, the
   samples' CIFs with it; v586: an old project's (its widths in points, to v510; the steps'
   note; no CIFs, to v574), its old fields ignored. A sample's CIF
   (v575): read, its phase's reflections (a cubic cell, a face-centred one, a tetragonal one),
   its peaks assigned (the nearest, several, none, the tolerance's ends), the pool. Then the
   fixture's three samples and its standard, at their defaults, as the page analyses them:
   the CSVs, the peak tables, the Caglioti box, the size chart's chips, each as HEAD v551's
   page wrote them (xrd-peaks.js before the split; from v575 the species and hkl columns
   beside v551's, and with the fixture's CIF the sizes by peak v551's numbers). And the words:
   the warnings, the chips, the note under the chart, the hkl, the CIF selector, every label
   escaped. Then (v561) what the card's
   wiring works out (xrd-peaks-model.js, below THE CARD'S WIRING): a field read and written,
   a width's hint, the λ preset, the processing's keys, the plot's curves, marks and their
   colours, the Results' stack, the size chart's layout, the chips switched, peaks removed
   and placed, the per-sample arrays, a state taken; the card's markup (xrd-peaks-html.js);
   and 60 cases of a card (a sample's, with a standard or none; the standard's), each a
   state of any version or malformed and eight steps done as xrd-peaks.js does them (its
   wiring, in short, below), what the card shows after each step as v560's xrd-peaks.js
   gave it: their digests in tests/golden/peaksmodel.json (npm run test:update writes them
   anew), checked against v560's xrd-peaks.js run from its source on a page of stubs; v575
   wrote the 40 anew with the samples' CIFs (none chosen: what they show otherwise v574's,
   checked so) and added 20 whose steps choose CIFs; v576 wrote 10 of those 20 anew (the
   CIFs' pool, the peaks at Kα2), checked field by field against v575's. And (v576) a peak at
   a reflection's Kα2 alone, named so and out of the sizes; the CIFs' texts saved once each;
   the names under the size chart by peak, the hkl alone. And (v577) which peak is at Kα2: the
   nearest line within its tolerance a reflection's Kα2, a taller peak below at its λ; a resolved
   Kα2 peak whose valley stands above half its height, a cell smaller than its CIF's, a partner
   removed or not taller.
   utils.js's, snav.js's and modcharts.js's helpers, which need a page to load, are taken
   from their source as they stand there. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { xrdml, rng, CIF, TETRA_CIF, PEROV_HI } from './fixtures.mjs';
import { readXrdmlScanText } from '../xrd-instr.js';
import { boxSmooth, meanStep, widthText, ptsText } from '../smooth.js';
import * as M from '../xrd-peaks-model.js';
import * as H from '../xrd-peaks-html.js';
import * as XM from '../xrd-model.js';
import { prepOf, phaseReflections, readCifs } from '../xrd-rv-model.js';

// The page's declarations as they stand there (utils.js, snav.js, modcharts.js need a page to
// load): a function to its closing brace, a const to its line's end; the CSVs' settings as a
// fresh page has them.
function decl(name, file = 'utils.js'){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let i = src.search(new RegExp(`^(export )?function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = src.indexOf('{', src.indexOf(')', i)), d = 0;
    for (; k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    return src.slice(i, k + 1).replace(/^export /, '');
  }
  i = src.search(new RegExp(`^(export )?const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  return src.slice(i, src.indexOf('\n', i)).replace(/^export /, '');
}
const NAMES = ['maxArr', 'minArr', 'meanArr', 'stdArr', 'boxStats', 'fmtNum', 'csvField', 'csvJoin', 'csvLine', 'esc', 'X_SVG', 'linspace', 'interpLinear', 'NORM_OPTIONS',
  'BAR_NAME_MAX', 'TILT_MIN', 'cutToWidth', 'tiltFits', 'tiltFor', 'barNames'];
const U = new Function('settings', NAMES.map(n=> decl(n)).join('\n') + '\n' + decl('snavHtml', 'snav.js') + '\n' + decl('PLOT_DL_ICON', 'modcharts.js') + '\n' + decl('CSV_ICON', 'modcharts.js')
  + '\nreturn { maxArr, minArr, meanArr, stdArr, boxStats, fmtNum, csvLine, esc, X_SVG, linspace, interpLinear, NORM_OPTIONS, barNames, snavHtml, PLOT_DL_ICON, CSV_ICON };')({ decimal: '.', field: ';' });
const sha = s => createHash('sha1').update(s).digest('hex');
// A CSV's column j, its head left out.
const col = (t, j)=> t.split('\n').slice(1, -1).map(r=> r.split(';')[j]);
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

/* v568: the minimum distance on an uneven axis at its local step (2), and a minimum of 0
   honoured (29). The mean step (to v567) took 15 points of 0.01° for 0.3° where a stretch is
   left out (the mean twice that step), and 23 points of 0.1° (2.3°) where the points are
   sparser than the mean; an even axis keeps the mean step's points (its results v567's:
   21000 searches on axes made as a file's are, rounded to 4 and 6 decimals too, compared
   with v567's findPeaks, Object.is equal). A removal with a minimum of 0 took the peaks
   within 0.1° (0.3°'s tolerance) with it. */
test('the minimum distance at the local step of an uneven axis; a minimum distance of 0 (v568)', ()=>{
  const pos = pks => pks.map(pk=> +pk.pos.toFixed(2));
  // Points left out between 20° and 40°: two peaks 0.2° apart, under 0.3°: the taller alone.
  const gap = [...axis(10, 0.01, 1001), ...axis(40, 0.01, 1001)];
  const yg = gap.map(t=> gauss(t, 15, 1000, 0.05) + gauss(t, 15.2, 500, 0.05) + gauss(t, 45, 800, 0.05));
  assert.deepEqual(pos(M.findPeaks(gap, yg, 5, 3, 0.3, U)), [15, 45], 'dense beside the gap: 0.2° is under 0.3°');
  assert.deepEqual(pos(M.findPeaks(gap, yg, 5, 3, 0.1, U)), [15, 15.2, 45], 'and over 0.1°');
  // Dense to 12°, sparse after: two peaks 1° apart, over 0.3°: both.
  const two = [...axis(10, 0.001, 2001), ...axis(12.1, 0.1, 280)];
  const ys = two.map(t=> gauss(t, 30, 1000, 0.5) + gauss(t, 31, 600, 0.5));
  assert.deepEqual(pos(M.findPeaks(two, ys, 5, 3, 0.3, U)), [30, 31], 'sparse: 1° is over 0.3°');
  assert.deepEqual(pos(M.findPeaks(two, ys, 5, 3, 1.05, U)), [30], 'and under 1.05°');
  // An even axis whose positions are written to 4 decimals: a grid still, its mean step's points.
  const rounded = axis(10, 0.0131303, 3001).map(t=> +t.toFixed(4)), yr = rounded.map(t=> gauss(t, 15, 1000, 0.1) + gauss(t, 15.3, 500, 0.1));
  assert.deepEqual(pos(M.findPeaks(rounded, yr, 5, 3, 0.3, U)), [15, 15.3]);
  // A minimum distance of 0: peaks 0.05° apart both found, and a removal takes its own alone.
  const x = axis(10, 0.01, 2001), y = x.map(t=> gauss(t, 15, 1000, 0.02) + gauss(t, 15.05, 800, 0.02) + gauss(t, 25, 600, 0.02));
  const pr = { ...DEF, smoothW: 0, blOn: false, pkDist: 0 }, f = { x, y }, sm = M.smoothingOf(x, y, pr);
  const all = M.processingOf(f, sm, pr, [], [], U).peaks;
  assert.deepEqual(pos(all), [15, 15.05, 25]);
  const one = M.processingOf(f, sm, pr, [], [all[0].detPos], U).peaks;
  assert.deepEqual(one.map(pk=> pk.removed), [true, false, false], 'the one removed alone');
  // (a minimum of 0.3°: its tolerance, 0.1°, as before; none given, 0.3°'s)
  assert.deepEqual(M.processingOf(f, sm, { ...pr, pkDist: 0.3 }, [], [all[0].detPos + 0.05], U).peaks.map(pk=> [+pk.pos.toFixed(2), pk.removed]), [[15, true], [25, false]]);
  assert.deepEqual(M.processingOf(f, sm, { ...pr, pkDist: undefined }, [], [all[0].detPos + 0.05], U).peaks.map(pk=> pk.removed), [true, true, false]);
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
  // With a CIF (v575): its assigned peaks alone, the unassigned one (40°) left out.
  const asg = (sp, p, labels)=> ({ sp, rows: p.peaks.filter(q=> !q.removed).map((q, i)=> ({ pk: q, refl: labels[i] ? [{ tt: q.detPos, hkl: [1, 0, 0] }] : [], label: labels[i] || '' })) });
  const sa = M.sampleSizes(pr, fp, m, false, U, asg('X', pr, ['(100)', '', '(200)', '(111)']));
  assert.deepEqual(sa.rawVals, [st.rawVals[0], st.rawVals[2]]);
  assert.deepEqual([sa.below, sa.outside], [0, 1], 'the one narrower than the instrument was the unassigned one');
  // By sample and by peak (v575; to v574 the samples' peaks matched by position): the samples
  // with a CIF, each its species; by peak, each species' reflections in the species' order
  // then in 2θ, over the samples that have them, a sample's two peaks there their mean.
  const procs = [{ peaks: [pk(30, 0.2), pk(40, 0.2), pk(50, 0.3)] }, { peaks: [pk(30.15, 0.2), pk(50.2, 0.3)] }, { peaks: [pk(30.05, 0.2), pk(49.9, 0.3), pk(49.95, 0.32)] }, { peaks: [pk(35, 0.3)] }];
  const A = [asg('Y', procs[0], ['(110)', '', '(200)']), null, asg('X', procs[2], ['(111)', '(220)', '(220)']), asg('Y', procs[3], ['(111)'])];
  const fs4 = ['a', 'b', 'c', 'd'].map(l=> ({ name: l + '.xrdml', label: l }));
  assert.deepEqual(M.speciesOf(A), ['Y', 'X']);
  const bs = M.sizeRows('sample', fs4, A, procs, [fp, fp, fp, fp], null, U);
  assert.deepEqual(bs.map(r=> [r.label, r.sp, r.species, r.rawN]), [['a', 0, 'Y', 2], ['c', 1, 'X', 3], ['d', 0, 'Y', 1]], 'b, with no CIF, left out');
  const D = (b, tt)=> M.scherrerD(b, tt, 0.9, 1.540598), bp = M.sizeRows('peak', fs4, A, procs, [fp, fp, fp, fp], m, U);
  // (v576) Each its hkl alone under the chart, two species or one: its species its series',
  // its name the whole (to v575 "Y (110)" with two species, cut in the middle where long).
  assert.deepEqual(bp.map(r=> [r.name, r.label, r.sp, r.hkl, r.ps.map(q=> q.k), r.rawN, r.showCorr]), [['Y (110)', '(110)', 0, '(110)', [0], 1, true], ['Y (111)', '(111)', 0, '(111)', [3], 1, true],
    ['Y (200)', '(200)', 0, '(200)', [0], 1, true], ['X (111)', '(111)', 1, '(111)', [2], 1, true], ['X (220)', '(220)', 1, '(220)', [2], 1, true]]);
  assert.deepEqual(bp[4].ps[0].raw, (D(0.3, 49.9) + D(0.32, 49.95))/2, 'two peaks of a sample on one reflection: their mean');
  assert.deepEqual(M.sizeRows('peak', fs4, [A[0], null, null, A[3]], procs, [fp, fp, fp, fp], null, U).map(r=> r.label), ['(110)', '(111)', '(200)'], 'one species: the hkl alone, as ever');
  assert.deepEqual([M.sizeRows('peak', fs4, [null, null, null, null], procs, [fp, fp, fp, fp], null, U), M.sizeRows('sample', fs4, [null, null, null, null], procs, [fp, fp, fp, fp], null, U)], [[], []]);
  // The chart: a series a species, in its colour, and its corrected sizes in a lighter one;
  // each box's top its whisker or an outlier above, of its own species' series.
  assert.equal(M.lighter('#3aa0ff'), '#93cbff');
  assert.deepEqual(M.sizeSeries([{ sp: 0, rawBox: {}, corrBox: null }], ['X']).map(x=> [x.k, x.sp, x.name, x.color]), [['raw', 0, 'X', '#3aa0ff']]);
  const SER2 = M.sizeSeries([{ sp: 0, rawBox: {}, corrBox: {} }, { sp: 1, rawBox: {}, corrBox: null }, { sp: 2, rawBox: null, corrBox: null }], ['X', 'Y', 'Z']);
  assert.deepEqual(SER2.map(x=> [x.k, x.sp, x.name, x.color]), [['raw', 0, 'X', '#3aa0ff'], ['corr', 0, 'X corr.', '#93cbff'], ['raw', 1, 'Y', '#ff7a59']], 'Z, with no box, none');
  assert.deepEqual(M.seriesOf(SER2, { sp: 0 }).map(x=> x.k), ['raw', 'corr']);
  assert.deepEqual([M.boxTop({ hi: 10, out: [] }), M.boxTop({ hi: 10, out: [2, 40] })], [10, 40]);
  const tr = [{ sp: 0, rawBox: { hi: 10, out: [] }, corrBox: { hi: 20, out: [25] } }, { sp: 0, rawBox: null, corrBox: { hi: 0, out: [] } }];
  assert.deepEqual(M.sizeTops(tr, M.sizeSeries(tr, ['X'])), [10, 25]);
  // The largest of the maxima (maxArr's: −∞ for a pattern with none), 1 with none above zero.
  assert.deepEqual([M.topOf([3, 7, -Infinity]), M.topOf([]), M.topOf([-2, 0])], [7, 1, 1]);
});

test('the settings: a sample\'s own, a malformed state, the state saved and read back', ()=>{
  const SH = { smoothW: 0.25, snipW: 2.5, pkHeight: 5, pkProm: 3, pkDist: 0.3, K: 0.9, lambda: 1.540598, blOn: true };
  const PM = { N: 'shared', blWin: 'shared', pkHeight: 'per', pkProm: 'per', pkDist: 'per', K: 'shared', lambda: 'shared' };
  assert.deepEqual([M.sharedDef(false), M.modeDef(false)], [SH, PM]);
  assert.deepEqual([M.sharedDef(true), M.modeDef(true)], [{ ...SH, smoothW: 0 }, Object.fromEntries(Object.keys(PM).map(k=> [k, 'shared']))]);
  assert.deepEqual([M.modeOf('smoothW'), M.modeOf('snipW'), M.modeOf('blOn'), M.modeOf('K')], ['N', 'blWin', 'blWin', 'K']);
  assert.deepEqual([...M.WIDTHS], ['smoothW', 'snipW']);
  // A file's: the shared value under all, its own (else the shared) under one; the box on unless false.
  assert.deepEqual(M.fileParams({ smoothW: 0.1, pkHeight: 9, blOn: false }, PM, SH), { ...SH, pkHeight: 9 });
  assert.deepEqual(M.fileParams({ smoothW: 0.1, pkHeight: 9, blOn: false }, { ...PM, N: 'per', blWin: 'per' }, SH), { ...SH, smoothW: 0.1, pkHeight: 9, blOn: false });
  assert.deepEqual(M.fileParams({}, { ...PM, N: 'per' }, SH), SH);
  // A sample's entry: a value below its least none (a width) or that least, one that is no number none.
  assert.deepEqual(M.entryOf({ smoothW: 0.1, snipW: 1.5, pkHeight: 7, K: -3, pkDist: 'a' }), { smoothW: 0.1, snipW: 1.5, pkHeight: 7, K: 1e-6, blOn: true });
  assert.deepEqual(M.entryOf({ smoothW: -1, snipW: 0, blOn: false }), { blOn: false });
  assert.deepEqual([M.objOf(null), M.objOf([1]), M.objOf(5)], [{}, {}, {}]);
  // Saved and read back.
  const c = { perParams: [{ ...SH, pkHeight: 7 }, { ...SH, blOn: false }], manualPeaks: [[33.3], []], removedPeaks: [[], [40, 41]], cifs: [{ file: 'a.cif', cif: 'data_a' }, null],
    shared: { ...SH, K: 0.95 }, paramMode: { ...PM, blWin: 'per' }, sizeBy: 'peak', norm: 'local' };
  const s = M.stateOf(c);
  assert.deepEqual(s, { perParams: c.perParams, manualPeaks: c.manualPeaks, removedPeaks: c.removedPeaks, cif: [{ file: 'a.cif', ref: 0 }, null], cifTexts: ['data_a'], shared: c.shared, paramMode: c.paramMode, sizeBy: 'peak', norm: 'local' });
  assert.ok(s.perParams[0] !== c.perParams[0] && s.manualPeaks[0] !== c.manualPeaks[0] && s.shared !== c.shared, 'copies');
  assert.equal('cif' in M.stateOf({ ...c, std: true }), false, 'the standard: no CIF');
  const back = M.readState(JSON.parse(JSON.stringify(s)), false, 2);
  assert.deepEqual(back, { shared: c.shared, paramMode: c.paramMode, perParams: c.perParams, manualPeaks: c.manualPeaks, removedPeaks: c.removedPeaks, cifs: c.cifs, sizeBy: 'peak' });
  // A malformed state: every value of another type, the defaults; lists cut or filled to the files.
  const bad = { shared: { smoothW: 'x', snipW: -1, pkHeight: null, K: -3, lambda: 'Mo', blOn: 0 }, paramMode: { N: 'per', blWin: 7, pkHeight: 'shared' },
    perParams: [{ smoothW: 0.3, pkDist: 'a' }, 5, null], manualPeaks: [[30, 'x', null], 'q'], removedPeaks: { a: 1 }, sizeBy: 'peak', norm: 'weird' };
  assert.deepEqual(M.readState(bad, false, 2), { shared: { ...SH, K: 1e-6 }, paramMode: { ...PM, N: 'per', pkHeight: 'shared' },
    perParams: [{ smoothW: 0.3, blOn: true }, { blOn: true }], manualPeaks: [[30], []], removedPeaks: [[], []], cifs: [null, null], sizeBy: 'peak' });
  for (const v of [null, 5, 'x', []]) assert.deepEqual(M.readState(v, false, 1),
    { shared: SH, paramMode: PM, perParams: [{ blOn: true }], manualPeaks: [[]], removedPeaks: [[]], cifs: [null], sizeBy: 'sample' });
  // The standard's: its own defaults, everything shared whatever the state says; no CIF.
  const std = M.readState({ paramMode: { N: 'per', pkHeight: 'per' }, perParams: [{}, {}], cif: [{ file: 'a', cif: 'b' }] }, true, 2);
  assert.deepEqual([std.shared.smoothW, Object.values(std.paramMode).every(v=> v === 'shared'), std.cifs], [0, true, [null, null]]);
});

/* v586: an old project's Scherrer settings as this version reads them. Made here as older
   versions saved them: the widths in points (N, blWin, to v510), the note of patterns at
   different steps and the points held for the files left out (v511-v585), and no samples'
   CIFs, its peaks matched across its samples (to v574). Its old fields ignored: the default
   widths where it has no other, no note, no CIF; its other settings and its peaks by hand
   kept; the state saved holds none of them; a CIF chosen, the sample's. */
test('an old project: widths in points, the steps\' note, no CIFs: the default widths, no note, no CIF (v586)', ()=>{
  const SH = M.sharedDef(false), PM = M.modeDef(false);
  const old = { shared: { N: 10, blWin: 150, pkHeight: 4, pkProm: 3, pkDist: 0.3, K: 0.9, lambda: 1.540598, blOn: false }, paramMode: { ...PM, N: 'per', blWin: 'per' },
    perParams: [{ N: 4, blWin: 100, pkHeight: 7 }, { N: 10, blWin: 150 }, { N: 3 }], manualPeaks: [[30], [], [31]], removedPeaks: [[], [40], []], sizeBy: 'peak', norm: 'global',
    stepNote: ['N', 'blWin'], heldPts: { N: 9, blWin: 120, blOn: false }, oldGroups: true };
  let t;
  assert.doesNotThrow(()=>{ t = M.readState(old, false, 3); });
  assert.deepEqual(t, { shared: { ...SH, pkHeight: 4, blOn: false }, paramMode: { ...PM, N: 'per', blWin: 'per' },
    perParams: [{ pkHeight: 7, blOn: true }, { blOn: true }, { blOn: true }], manualPeaks: [[30], [], [31]], removedPeaks: [[], [40], []], cifs: [null, null, null], sizeBy: 'peak' });
  // Taken: each sample's widths the shared defaults; saved, nothing of the old fields.
  const S = { std: false, shared: {}, paramMode: {}, panel: { sel: 1, hov: 2 } };
  M.takeState(S, t, 'global');
  assert.deepEqual(M.fileParams(S.perParams[0], S.paramMode, S.shared), { ...SH, pkHeight: 7 });
  const s = M.stateOf(S);
  assert.deepEqual(Object.keys(s), ['perParams', 'manualPeaks', 'removedPeaks', 'cif', 'shared', 'paramMode', 'sizeBy', 'norm']);
  assert.deepEqual(s.cif, [null, null, null]);
  // A file left out with its entry in points, taken back in: its numbers, the widths none (the shared ones).
  const [params] = M.slotsOf(S, 'A1');
  assert.deepEqual(params.make({ N: 5, blWin: 80, pkProm: 2 }, { x: [10, 10.02] }), { pkProm: 2, blOn: true });
  // A CIF chosen: the sample's, nothing else said.
  const q = { file: 'SrTiO3.cif', cif: 'data_x' };
  M.setCif(S, 1, { ...q, key: 'k', name: 'n', text: 't' });
  assert.deepEqual([S.cifs, Object.keys(M.stateOf(S)).includes('oldGroups')], [[null, q, null], false]);
});

/* v575: a sample's CIF read back as a file's name and text (anything else none); kept while
   its card is a Rietveld one (xrd-model.js keptState, keptSlots), files left out alike. */
test('the CIFs read back; kept while the card is a Rietveld one', ()=>{
  const q = { file: 'SrTiO3.cif', cif: 'data_x' }, v = { perParams: [{}, {}, {}], manualPeaks: [[], [], []], removedPeaks: [[], [], []], shared: {}, paramMode: {}, sizeBy: 'peak', norm: 'global' };
  assert.deepEqual(M.readState({ cif: [q, { file: 1, cif: 'x' }, 'q', { ...q, extra: 1 }] }, false, 3).cifs, [q, null, null], 'cut to the files, a malformed one none, the rest dropped');
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  assert.deepEqual(XM.keptState({ isObj }, 'scherrer', { ...v, cif: [q, null, q] }, new Set([1])).cif, [q, q]);
  const ks = XM.keptSlots('A1', { ...v, cif: [q] });
  assert.deepEqual([ks.map(x=> x.key).pop(), ks[3].make(undefined), ks[3].out(q)], ['A1:cif', null, q], 'its text in it: held as it is');
});

/* v575: a sample's CIF, read as the Rietveld card reads its phases. Its phase's reflections
   (xrd-rv-model.js phaseReflections, as the Rietveld card's ticks): a primitive cubic cell, a
   face-centred one (its file's cell finer: refined in the primitive one, named by the
   conventional indices, the absent ones out) and a tetragonal one, each at Bragg's angle; a
   peak assigned to those within half its FWHM of its 2θ, 0.1° at least: the nearest alone,
   several together, none (unassigned), the tolerance's ends; the pool of CIFs a selector
   offers. */
const cifOf = (name, [a, c], atoms)=> `data_${name}\n_cell_length_a ${a}\n_cell_length_b ${a}\n_cell_length_c ${c}\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\n`
  + `_chemical_formula_sum '${atoms[0][0]}${atoms.length}'\nloop_\n_symmetry_equiv_pos_as_xyz\n'x, y, z'\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\n`
  + atoms.map(([el, x, y, z], i)=> `${el}${i + 1} ${el} ${x} ${y} ${z}`).join('\n') + '\n';
test('a sample\'s CIF: read, its phase\'s reflections (cubic, face-centred, tetragonal), its peaks assigned, the pool (v575)', async ()=>{
  // Read as the Rietveld card reads its phases (xrd-rv-model.js readCifs): each its text in
  // its encoding (UTF-16 too) and its phase; one that is no CIF, its name and why.
  const rd = await readCifs([new File([STO.cif], 'SrTiO3.cif'), new File(['nothing'], 'b.cif'), new File([Buffer.from('\ufeff' + TETRA_CIF, 'utf16le')], 't.CIF')]);
  assert.deepEqual([rd.got.map(c=> [c.file, c.text === (c.file === 't.CIF' ? TETRA_CIF : STO.cif), c.prep.name]), rd.errs], [[['SrTiO3.cif', true, 'SrTiO3'], ['t.CIF', true, 'BaTiO3']], [['b.cif', 'Not a CIF: no data_ block found.']]]);
  const lam = 1.540598, bragg = d => 2*Math.asin(lam/(2*d))*180/Math.PI;
  const refl = (text, x0, x1)=> phaseReflections(prepOf(text, 'x.cif'), lam, x0, x1);
  // Simple cubic, a = 4 Å (Pm-3m from the atom): each family once, in 2θ order, d = a/√(h²+k²+l²).
  const pc = refl(cifOf('Po', [4, 4], [['Po', 0, 0, 0]]), 10, 60);
  assert.deepEqual(pc.map(r=> r.hkl.join('')), ['100', '110', '111', '200', '210', '211']);
  pc.forEach(r=> near(r.tt, bragg(4/Math.hypot(...r.hkl)), 1e-9, r.hkl.join('')));
  // Face-centred cubic (copper-like, a = 3.615 Å, 4 atoms): (111), (200), (220), (311), (222),
  // its odd-even ones absent; at 2θ 43.3°, 50.4°, 74.1°, 89.9°, 95.1°.
  const fcc = refl(cifOf('Cu', [3.615, 3.615], [['Cu', 0, 0, 0], ['Cu', 0.5, 0.5, 0], ['Cu', 0.5, 0, 0.5], ['Cu', 0, 0.5, 0.5]]), 20, 100);
  assert.deepEqual(fcc.map(r=> r.hkl.join('')), ['111', '200', '220', '311', '222']);
  fcc.forEach(r=> near(r.tt, bragg(3.615/Math.hypot(...r.hkl)), 1e-6, r.hkl.join('')));
  // Tetragonal, a = 4, c = 5 Å (P4/mmm): (001) and (100) apart, 1/d² = (h² + k²)/a² + l²/c².
  const tet = refl(cifOf('Te', [4, 5], [['Te', 0, 0, 0]]), 10, 40);
  assert.deepEqual(tet.map(r=> r.hkl.join('')), ['001', '100', '101', '110', '002', '111']);
  tet.forEach(r=> near(r.tt, bragg(1/Math.sqrt((r.hkl[0]**2 + r.hkl[1]**2)/16 + r.hkl[2]**2/25)), 1e-9, r.hkl.join('')));
  assert.deepEqual(refl(cifOf('Te', [4, 5], [['Te', 0, 0, 0]]), 20, 30).map(r=> r.hkl.join('')), ['100', '101'], 'the range, its ends');
  // The tolerance: half the FWHM, 0.1° at least; a peak with none, 0.1°.
  assert.deepEqual([M.assignTol(0.1), M.assignTol(0.3), M.assignTol(0.2), M.assignTol(NaN), M.assignTol(0)], [0.1, 0.15, 0.1, 0.1, 0.1]);
  const R = [{ tt: 30, hkl: [1, 1, 0] }, { tt: 30.12, hkl: [1, 0, 1] }, { tt: 40, hkl: [1, 1, 1] }, { tt: 50, hkl: [2, -1, 0] }];
  const at = (pos, w)=> M.peakRefl({ detPos: pos, fwhmClassic: w }, R).map(r=> r.hkl.join(''));
  assert.deepEqual(at(29.99, 0.1), ['110'], 'the nearest within 0.1°, the other 0.13° off');
  assert.deepEqual(at(30.06, 0.3), ['110', '101'], 'both within 0.15°: both, in 2θ order');
  assert.deepEqual(at(35, 0.3), [], 'none: unassigned');
  assert.deepEqual([at(40.1, 0.2), at(40.1000001, 0.2), at(39.85, 0.3), at(39.8499999, 0.3), at(40.1, NaN)], [['111'], [], ['111'], [], ['111']], 'the tolerance\'s ends: within, just beyond');
  assert.deepEqual([M.reflLabel([R[0], R[1]]), M.reflLabel([R[3]]), M.reflLabel([])], ['(110)/(101)', '(2-10)', '']);
  // A sample's assignment: its phase, species and peaks; none with no CIF, one that does not
  // read as one, or no processing.
  const f = { x: [20, 40], y: [0, 0] }, pr = { peaks: [{ detPos: 22.21, fwhmClassic: 0.2 }, { detPos: 25, fwhmClassic: 0.2 }, { detPos: 31.6, fwhmClassic: 0.2, removed: true }] };
  const A = M.sampleAssign(f, pr, lam, { file: 'po.cif', cif: cifOf('Po', [4, 4], [['Po', 0, 0, 0]]) });
  assert.deepEqual([A.sp, A.refl.map(r=> r.hkl.join('')), A.rows.map(r=> [r.pk.detPos, r.label])], ['Po', ['100', '110', '111'], [[22.21, '(100)'], [25, '']]]);
  assert.deepEqual([M.sampleAssign(f, pr, lam, null), M.sampleAssign(f, pr, lam, { file: 'b.cif', cif: 'no CIF' }), M.sampleAssign(f, null, lam, STO)], [null, null, null]);
  assert.deepEqual([M.phaseOfCif(null), M.phaseOfCif({ file: 'b.cif', cif: 'data_x' }), M.phaseOfCif(STO).name], [null, null, 'SrTiO3']);
  // The pool: each CIF once (by its file's name and text), those that read, a name two share
  // with its file; a sample's own entry in it.
  const TET = { file: 'BaTiO3_tetra.cif', cif: TETRA_CIF }, STO2 = { file: 'other.cif', cif: STO.cif };
  const pool = M.cifPool([STO, TET, { ...STO }, { file: 'bad.cif', cif: 'x' }, null, 5, STO2]);
  assert.deepEqual(pool.map(p=> [p.file, p.name, p.text]), [['SrTiO3.cif', 'SrTiO3', 'SrTiO3 (SrTiO3.cif)'], ['BaTiO3_tetra.cif', 'BaTiO3', 'BaTiO3'], ['other.cif', 'SrTiO3', 'SrTiO3 (other.cif)']]);
  assert.deepEqual([M.poolAt(pool, { ...TET }), M.poolAt(pool, STO2), M.poolAt(pool, null), M.poolAt(pool, { file: 'x', cif: 'y' })], [1, 2, -1, -1]);
});

// The fixture's patterns as xrd.js keeps them (read by xrd-instr.js; x running up already).
const pattern = (k, label)=>{ const sc = readXrdmlScanText(new Uint8Array(xrdml(k))); return { name: label + '.xrdml', label, x: sc.x, y: sc.y, ...(sc.varMul ? { varMul: sc.varMul } : {}) }; };
// The table's rows as cells, and its summary.
const cells = h => [...h.matchAll(/<tr class="([^"]*)"[^>]*>(.*?)<\/tr>/g)].map(r=> [...r[2].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(x=> x[1]));
// Markup as the page serialises it (an element closed by />, an attribute with no value).
const asPage = s => s.replace(/<line([^>]*)\/>/g, '<line$1></line>');

// A CSV's columns whose heads match re left out (its cells ';'-separated, none quoted here).
function dropCols(text, re){
  const rows = text.split('\n'), out = rows[0].split(';').map(h=> !re.test(h));
  return rows.map(r=> r ? r.split(';').filter((_, j)=> out[j]).join(';') : r).join('\n');
}
// v551's crystallite sizes by peak, the samples' peaks matched by position (its first column,
// their mean 2θ, the group the matching made: to v574).
const BY_PEAK_V551 = 'Reflection_2theta_deg;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm;Crystallite_size_nm_s00;Crystallite_size_nm_s01;Crystallite_size_nm_s02\n'
  + '22.783;29.46;0.01;3;29.47;29.46;29.47;29.45;29.47;29.47\n32.436;28.76;0.02;3;28.76;28.75;28.78;28.76;28.74;28.79\n40.004;27.97;0.03;3;27.96;27.95;27.98;27.94;27.96;28.00\n'
  + '46.528;27.20;0.05;3;27.20;27.18;27.22;27.24;27.20;27.15\n57.854;25.68;0.03;3;25.67;25.66;25.69;25.71;25.67;25.66\n67.898;24.34;0.03;3;24.34;24.33;24.35;24.31;24.36;24.34\n'
  + '77.256;23.20;0.08;3;23.20;23.16;23.24;23.20;23.27;23.12\n';
// And with the standard's correction (its digest v551's: below).
const BY_PEAK_V551_CORR = 'Reflection_2theta_deg;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm;Crystallite_size_corr_nm;Crystallite_size_corr_std_nm;Crystallite_size_corr_n;Crystallite_size_corr_median_nm;Crystallite_size_corr_Q1_nm;Crystallite_size_corr_Q3_nm;Crystallite_size_nm_s00;Crystallite_size_nm_s01;Crystallite_size_nm_s02\n'
  + '22.783;29.46;0.01;3;29.47;29.46;29.47;36.09;0.02;3;36.10;36.08;36.11;29.45;29.47;29.47\n32.436;28.76;0.02;3;28.76;28.75;28.78;38.68;0.06;3;38.68;38.65;38.71;28.76;28.74;28.79\n'
  + '40.004;27.97;0.03;3;27.96;27.95;27.98;40.70;0.11;3;40.67;40.63;40.74;27.94;27.96;28.00\n46.528;27.20;0.05;3;27.20;27.18;27.22;42.49;0.16;3;42.49;42.41;42.57;27.24;27.20;27.15\n'
  + '57.854;25.68;0.03;3;25.67;25.66;25.69;44.97;0.13;3;44.93;44.90;45.02;25.71;25.67;25.66\n67.898;24.34;0.03;3;24.34;24.33;24.35;46.50;0.21;3;46.53;46.40;46.61;24.31;24.36;24.34\n'
  + '77.256;23.20;0.08;3;23.20;23.16;23.24;47.44;0.66;3;47.42;47.10;47.76;23.20;23.27;23.12\n';
// The fixture's SrTiO₃ (Pm-3m, a = 3.905 Å), a sample's CIF as a state holds it.
const STO = { file: 'SrTiO3.cif', cif: fs.readFileSync(CIF, 'utf8') };

test('the fixture\'s samples and standard as the page analyses them: the CSVs, the tables, the Caglioti fit (HEAD v551\'s; v575 the CIFs\')', ()=>{
  const files = [0, 1, 2].map(k=> pattern(k, 's0' + k)), sf = pattern(11, 's11');
  const run = (f, std)=>{ const pr = M.fileParams({}, M.modeDef(std), M.sharedDef(std)); return { pr, proc: M.processingOf(f, M.smoothingOf(f.x, f.y, pr), pr, [], [], U) }; };
  const S = files.map(f=> run(f, false)), T = run(sf, true);
  const none = [null, null, null], sto = files.map((f, k)=> M.sampleAssign(f, S[k].proc, S[k].pr.lambda, STO));
  const view = (m, asg = none)=> ({ files, procs: S.map(s=> s.proc), fps: S.map(s=> s.pr), asg, m, norm: 'global', std: false });
  // No standard, no CIF: v551's columns as they were, the species and hkl empty, no sizes by peak.
  const plain = M.csvTables('Scherrer - ', view(null), U), byName = Object.fromEntries(plain.map(e=> [e.name.replace('Scherrer - ', ''), e.text]));
  assert.deepEqual(Object.keys(byName), ['diffractograms.csv', 'crystallite_size.csv', 'peaks.csv']);
  assert.equal(sha(byName['diffractograms.csv']), 'd19ca989e4e6582a2bae3ec183576d432dbe45c4');
  assert.equal(byName['diffractograms.csv'].split('\n').slice(0, 2).join('\n'), '2Theta_s00;s00;Raw_s00;Smoothed_s00 (w=0.25°);SNIP_background_s00 (W=5°);2Theta_s01;s01;Raw_s01;Smoothed_s01 (w=0.25°);SNIP_background_s01 (W=5°);2Theta_s02;s02;Raw_s02;Smoothed_s02 (w=0.25°);SNIP_background_s02 (W=5°)\n'
    + '10.000000;0.000000;232.000000;231.975195;231.975195;10.000000;0.000000;232.000000;232.905039;232.905039;10.000000;0.000000;232.000000;233.187289;233.187289');
  assert.equal(dropCols(byName['crystallite_size.csv'], /^Species$/), 'Sample;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm\n'
    + 's00;26.66;2.33;7;27.24;25.01;28.35\ns01;26.67;2.31;7;27.20;25.02;28.35\ns02;26.65;2.36;7;27.15;25.00;28.39\n');
  assert.deepEqual(col(byName['crystallite_size.csv'], 1), ['', '', ''], 'no species');
  assert.deepEqual(byName['peaks.csv'].split('\n')[0].split(';').slice(0, 3), ['Peak_2Theta_s00', 'Peak_Species_s00', 'Peak_hkl_s00']);
  assert.deepEqual([1, 2, 7, 8].map(j=> col(byName['peaks.csv'], j).join()), ['', '', '', ''].map(()=> ',,,,,,'), 'no species, no hkl');
  assert.equal(dropCols(byName['peaks.csv'], /^Peak_(Species|hkl)_/), 'Peak_2Theta_s00;Peak_RelIntensity_s00;Peak_FWHM_deg_s00;Peak_Size_nm_s00;Peak_2Theta_s01;Peak_RelIntensity_s01;Peak_FWHM_deg_s01;Peak_Size_nm_s01;Peak_2Theta_s02;Peak_RelIntensity_s02;Peak_FWHM_deg_s02;Peak_Size_nm_s02\n'
    + '22.769831;0.152827;0.27517;29.450;22.782835;0.152897;0.27502;29.466;22.795839;0.152348;0.27499;29.471\n'
    + '32.431730;1.000000;0.28762;28.765;32.431730;1.000000;0.28787;28.741;32.444733;1.000000;0.28742;28.786\n'
    + '39.986996;0.306354;0.30259;27.938;40.000000;0.307750;0.30239;27.957;40.026008;0.307387;0.30194;28.001\n'
    + '46.514954;0.514870;0.31740;27.243;46.527958;0.517463;0.31793;27.199;46.540962;0.514011;0.31849;27.153\n'
    + '57.828349;0.408369;0.35300;25.710;57.854356;0.413365;0.35356;25.672;57.880364;0.409601;0.35384;25.655\n'
    + '67.867360;0.240386;0.39387;24.310;67.906372;0.242032;0.39309;24.364;67.919376;0.240981;0.39351;24.340\n'
    + '77.230169;0.137000;0.43827;23.199;77.256177;0.137553;0.43693;23.274;77.282185;0.136494;0.43997;23.118\n');
  // The local and none normalisations: the diffractograms' net column alone changes.
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
  assert.equal(dropCols(corr['crystallite_size.csv'], /^Species$/), 'Sample;Crystallite_size_nm;Crystallite_size_std_nm;Crystallite_size_n;Crystallite_size_median_nm;Crystallite_size_Q1_nm;Crystallite_size_Q3_nm;Crystallite_size_corr_nm;Crystallite_size_corr_std_nm;Crystallite_size_corr_n;Crystallite_size_corr_median_nm;Crystallite_size_corr_Q1_nm;Crystallite_size_corr_Q3_nm\n'
    + 's00;26.66;2.33;7;27.24;25.01;28.35;42.40;4.18;7;42.65;39.64;45.69\ns01;26.67;2.31;7;27.20;25.02;28.35;42.51;4.36;7;42.49;39.64;45.81\ns02;26.65;2.36;7;27.15;25.00;28.39;42.31;4.04;7;42.33;39.78;45.70\n');
  assert.equal(corr['crystallite_size_by_peak.csv'], undefined, 'no CIF: none by peak');
  assert.equal(sha(dropCols(corr['peaks.csv'], /^Peak_(Species|hkl)_/)), '2832017f1d6a8b928b12d9aabbf9253811ccd488');
  assert.equal(dropCols(corr['peaks.csv'], /^Peak_(Species|hkl)_/).split('\n')[1], '22.769831;0.152827;0.27517;29.450;36.066;22.782835;0.152897;0.27502;29.466;36.100;22.795839;0.152348;0.27499;29.471;36.113');
  // Each sample given the fixture's SrTiO₃ (v575): every peak assigned, (100) to (310); the
  // sizes by sample those of v551, of the species; by peak, by species and hkl, the numbers
  // v551's matching across samples gave (the same peaks, here), its mean 2θ dropped.
  const HKL = ['(100)', '(110)', '(111)', '(200)', '(211)', '(220)', '(310)'];
  assert.deepEqual(sto.map(a=> [a.sp, a.rows.map(r=> r.label)]), files.map(()=> ['SrTiO3', HKL]));
  const withSto = mm => Object.fromEntries(M.csvTables('', view(mm, sto), U).map(e=> [e.name, e.text]));
  const C = withSto(null), CM = withSto(m);
  assert.deepEqual(Object.keys(C), ['diffractograms.csv', 'crystallite_size.csv', 'crystallite_size_by_peak.csv', 'peaks.csv']);
  assert.equal(dropCols(C['crystallite_size.csv'], /^Species$/), dropCols(byName['crystallite_size.csv'], /^Species$/));
  assert.deepEqual(col(C['crystallite_size.csv'], 1), ['SrTiO3', 'SrTiO3', 'SrTiO3']);
  assert.equal(dropCols(C['crystallite_size_by_peak.csv'], /^(Species|hkl)$/), dropCols(BY_PEAK_V551, /^Reflection_2theta_deg$/));
  assert.deepEqual([col(C['crystallite_size_by_peak.csv'], 0), col(C['crystallite_size_by_peak.csv'], 1)], [HKL.map(()=> 'SrTiO3'), HKL]);
  assert.deepEqual([col(C['peaks.csv'], 1), col(C['peaks.csv'], 2)], [HKL.map(()=> 'SrTiO3'), HKL]);
  assert.equal(dropCols(C['peaks.csv'], /^Peak_(Species|hkl)_/), dropCols(byName['peaks.csv'], /^Peak_(Species|hkl)_/));
  assert.equal(dropCols(CM['crystallite_size.csv'], /^Species$/), dropCols(corr['crystallite_size.csv'], /^Species$/));
  assert.equal(sha(dropCols(CM['peaks.csv'], /^Peak_(Species|hkl)_/)), '2832017f1d6a8b928b12d9aabbf9253811ccd488');
  // (v551's, the same once its first column is dropped and the two put in its place)
  assert.equal(sha(BY_PEAK_V551_CORR), '0212ccb6eaea2e89d1c4e1e00b33c5a1bd1d2318');
  assert.equal(CM['crystallite_size_by_peak.csv'].split('\n')[1], 'SrTiO3;(100);29.46;0.01;3;29.47;29.46;29.47;36.09;0.02;3;36.10;36.08;36.11;29.45;29.47;29.47');
  assert.equal(dropCols(CM['crystallite_size_by_peak.csv'], /^(Species|hkl)$/), dropCols(BY_PEAK_V551_CORR, /^Reflection_2theta_deg$/));
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
  // With its CIF (v575): the hkl after the 2θ, the mean the species', the rule under it.
  const t3 = H.peakTableHtml(pks, { std: false, m, fp: S[0].pr, picked: null, st: M.sampleSizes(S[0].proc, S[0].pr, m, false, U, sto[0]), A: sto[0] }, U);
  assert.deepEqual(cells(t3).map(r=> r[2]), HKL);
  assert.deepEqual(cells(t3)[0], ['1', '22.770', '(100)', '15.3%', '0.275', '29.5', '36.1']);
  assert.ok(t3.includes('<th>2θ (°)</th><th>hkl</th><th>Relative Intensity</th>') && t3.includes('<td title="Calculated 2θ: 22.754°">(100)</td>'));
  assert.ok(t3.endsWith('<div class="size-summary">Mean crystallite size, SrTiO3: <b>26.7 ± 2.3 nm</b><br>Instr.-corrected: <b>42.4 ± 4.2 nm</b></div>'
    + '<p class="txt-meta xrd-hkl-rule">hkl: the reflections of SrTiO3 at λ 1.540598 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least.</p>'));
  // The size chart's chips (by sample, by peak), as the page wrote them, once a sample has a
  // CIF (v575; to v574 with two samples); none charted without one.
  const rows = M.sizeRows('sample', files, sto, S.map(s=> s.proc), S.map(s=> s.pr), m, U);
  assert.deepEqual(rows.map(r=> [r.label, r.species, r.rawMean, r.corrMean]), [0, 1, 2].map(k=>{ const st = M.sampleSizes(S[k].proc, S[k].pr, m, false, U); return ['s0' + k, 'SrTiO3', st.rawMean, st.corrMean]; }));
  assert.equal(H.sizeChipsHtml(rows.length, true, 'sample'), '<button type="button" class="mode-chip plot-chip is-on" data-size-by="sample" title="Crystallite size by sample">by sample</button>'
    + '<button type="button" class="mode-chip plot-chip" data-size-by="peak" title="Crystallite size by peak">by peak</button>');
  assert.equal(H.sizeNoteHtml([], U), '');
});

/* v576: a peak at a reflection's Kα2 alone. The Kα2 of the tube the sample's λ names (its Kα1
   or its Kα mean, to K2_TOL: the λ selector's presets among them); none for any other λ. The
   fixture's perovskite from 115° to 140°, each Kα2 peak resolved from its Kα1 one: those named
   "(hkl) Kα2" (to v575 unassigned), at the Kα2's Bragg angle, out of the sizes, by sample and by
   peak, the rule in grey saying so, peaks.csv's hkl with them; λ naming no tube, as before. */
test('a peak at a reflection\'s Kα2 alone: named so, out of the sizes, the rule saying so; none where λ names no tube (v576)', ()=>{
  const KA2 = { '1.540598': 1.544426, '1.541838': 1.544426, '0.709317': 0.713590, '1.789010': 1.792850, '2.289760': 2.293606, '1.936042': 1.939980, '0.559407': 0.563798 };
  for (const [lam, k2] of Object.entries(KA2)) assert.equal(M.kAlpha2Of(+lam), k2, 'λ ' + lam);
  assert.deepEqual([M.kAlpha2Of(1.544426), M.kAlpha2Of(1.5), M.kAlpha2Of(1.540598 + 0.0009), M.kAlpha2Of(NaN)], [NaN, NaN, NaN, NaN], 'a Kα2 itself, a λ of one\'s own: none');
  assert.deepEqual([M.K2_TOL, M.kAlpha2Of(1.540598 + 0.99*M.K2_TOL), M.kAlpha2Of(1.540598 - 1.01*M.K2_TOL)], [2e-4, 1.544426, NaN], 'the tolerance\'s ends');
  const sc = readXrdmlScanText(new Uint8Array(xrdml(0, { lo: 115, hi: 140, n: 1924, refl: PEROV_HI }))), f = { name: 'h.xrdml', label: 'h', x: sc.x, y: sc.y, varMul: sc.varMul };
  const run = lam =>{ const fp = { ...DEF, lambda: lam }, pr = M.processingOf(f, M.smoothingOf(f.x, f.y, fp), fp, [], [], U); return { fp, pr, A: M.sampleAssign(f, pr, lam, STO) }; };
  const { fp, pr, A } = run(1.540598), d = hkl => 3.905/Math.hypot(...hkl), bragg = (lam, hkl)=> 2*Math.asin(lam/(2*d(hkl)))*180/Math.PI;
  assert.deepEqual(A.rows.map(r=> r.label), ['(331)', '(331) Kα2', '(420)', '(420) Kα2', '(421)', '(421) Kα2', '(332)', '(332) Kα2']);
  assert.deepEqual([A.lam2, A.rows.map(r=> [r.refl.length, r.k2.length])], [1.544426, [[1, 0], [0, 1], [1, 0], [0, 1], [1, 0], [0, 1], [1, 0], [0, 1]]]);
  A.rows.filter(r=> r.k2.length).forEach(r=> near(r.k2[0].tt, bragg(1.544426, r.k2[0].hkl), 1e-6, r.label));
  A.rows.forEach(r=> assert.ok(Math.abs((r.refl[0] || r.k2[0]).tt - r.pk.detPos) <= M.assignTol(r.pk.fwhmClassic), r.label));
  // Out of the sizes: by sample the Kα1 peaks' alone, by peak their reflections alone.
  const k1 = A.rows.filter(r=> r.refl.length).map(r=> r.pk), st = M.sampleSizes(pr, fp, null, false, U, A);
  assert.deepEqual(st.rawVals, k1.map(pk=> M.scherrerD(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda)));
  assert.deepEqual(M.sizeRows('peak', [f], [A], [pr], [fp], null, U).map(r=> [r.label, r.rawN]), [['(331)', 1], ['(420)', 1], ['(421)', 1], ['(332)', 1]]);
  // The table: each in its row, its size there, its Kα2's 2θ in its title; the rule in grey.
  const pks = pr.peaks.filter(pk=> !pk.removed), t = H.peakTableHtml(pks, { std: false, m: null, fp, picked: null, st, A }, U);
  assert.deepEqual(cells(t).map(r=> r[2]), ['(331)', '(331) Kα2', '(420)', '(420) Kα2', '(421)', '(421) Kα2', '(332)', '(332) Kα2']);
  assert.ok(t.includes(`<td title="Calculated 2θ at Kα2: ${A.rows[7].k2[0].tt.toFixed(3)}°">(332) Kα2</td>`) && t.includes(`<td title="Calculated 2θ: ${A.rows[6].refl[0].tt.toFixed(3)}°">(332)</td>`));
  assert.deepEqual(cells(t).map(r=> r[5]), pks.map(pk=> H.fmtCell(M.scherrerD(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda))), 'each its size in the table, as ever');
  const rule = t.match(/<p class="txt-meta xrd-hkl-rule">(.*)<\/p>$/)[1];
  assert.equal(rule, 'hkl: the reflections of SrTiO3 at λ 1.540598 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least; 4 of 8 peaks at a reflection\'s Kα2 (λ 1.544426 Å), the nearest line within their tolerance, with a taller peak below at that reflection\'s λ: named so and left out of its sizes, as each repeats its Kα1 peak.');
  assert.ok(!/[!—]|v\d{3}/.test(rule));
  const one = { ...A, rows: A.rows.map((r, i)=> i === 1 ? { ...r, k2: [], label: '' } : i % 2 ? { ...r, refl: r.k2, k2: [], label: r.label.replace(' Kα2', '') } : r).slice(0, 4) };
  assert.match(H.peakTableHtml(pks.slice(0, 4), { std: false, m: null, fp, picked: null, st, A: one }, U), /0\.1° at least; 1 of 4 peaks unassigned, left out of its sizes\.<\/p>$/, 'none at Kα2: the rule as it was');
  const mix = { ...A, rows: A.rows.slice(0, 3).concat({ ...A.rows[3], k2: [], label: '' }) };
  assert.match(H.peakTableHtml(pks.slice(0, 4), { std: false, m: null, fp, picked: null, st, A: mix }, U), /; 1 of 4 peaks unassigned, left out of its sizes; 1 of 4 peaks at a reflection's Kα2 \(λ 1\.544426 Å\), the nearest line within its tolerance, with a taller peak below at that reflection's λ: named so and left out of its sizes, as it repeats its Kα1 peak\.<\/p>$/);
  // peaks.csv: the hkl, Kα2 with them.
  const pk = M.csvTables('', { files: [f], procs: [pr], fps: [fp], asg: [A], m: null, norm: 'global', std: false }, U).find(e=> e.name === 'peaks.csv').text;
  assert.deepEqual(col(pk, pk.split('\n')[0].split(';').indexOf('Peak_hkl_h')), A.rows.map(r=> r.label));
  // λ the Kα mean: the Kα2 too; a Kα2 itself or a λ of one's own: none, the peaks named at λ alone.
  // (v577: those with a partner, a Kα1 peak named at that λ; (421)'s and (332)'s Kα1 peaks are
  // not, beyond its tolerance of the line at the Kα mean)
  const mean = run(1.541838).A;
  assert.deepEqual([mean.lam2, mean.rows.map(r=> r.label)], [1.544426, ['(331)', '(331) Kα2', '(420)', '(420) Kα2', '', '(421)', '', '']]);
  for (const lam of [1.544426, 1.5]){
    const B = run(lam).A;
    assert.deepEqual([B.lam2, B.refl2, B.rows.some(r=> r.k2.length || /Kα2/.test(r.label))], [NaN, [], false], 'λ ' + lam);
  }
});

/* v577: which peak is at a reflection's Kα2: one whose nearest line within its tolerance is a
   reflection's Kα2, with a peak below it, taller, assigned to that reflection at λ (its
   partner); any other, its lines at λ alone. The fixture's perovskite from 100° to 140°
   (PEROV_HI, (411) among its lines), at Cu Kα1. */
const K2_LAM = 1.540598;
const hiPat = o =>{ const sc = readXrdmlScanText(new Uint8Array(xrdml(0, { lo: 100, hi: 140, n: 3078, refl: PEROV_HI, ...o }))); return { name: 'h.xrdml', label: 'h', x: sc.x, y: sc.y, varMul: sc.varMul }; };
const hiRun = (f, removed = [])=>{ const fp = { ...DEF, lambda: K2_LAM }, pr = M.processingOf(f, M.smoothingOf(f.x, f.y, fp), fp, [], removed, U); return { fp, pr, A: M.sampleAssign(f, pr, K2_LAM, STO) }; };
// The rule in grey under its table.
const hklRule = ({ fp, pr, A })=> H.peakTableHtml(pr.peaks.filter(pk=> !pk.removed), { std: false, m: null, fp, picked: null, st: M.sampleSizes(pr, fp, null, false, U, A), A }, U).match(/<p class="txt-meta xrd-hkl-rule">(.*)<\/p>$/)[1];
const HI_HKL = ['(400)', '(410)/(322)', '(411)/(330)', '(411)/(330) Kα2', '(331)', '(331) Kα2', '(420)', '(420) Kα2', '(421)', '(421) Kα2', '(332)', '(332) Kα2'];
const hklOf = rs => rs.map(r=> r.hkl.join(''));

/* (b) (411)'s Kα2 peak: the valley between it and its Kα1 peak above half its height, it is
   measured so wide that its tolerance reaches (411)'s line at λ; its nearest line (411)'s Kα2,
   its Kα1 peak below and taller: "(411)/(330) Kα2", out of the sizes (to v576 named by the
   line at λ and sized, its sample's and its reflection's). */
test('a resolved Kα2 peak whose valley stands above half its height: its tolerance reaching its line at λ, named at Kα2 all the same, out of the sizes (v577)', ()=>{
  const f = hiPat({}), R = hiRun(f), { fp, pr, A } = R;
  assert.deepEqual(A.rows.map(r=> r.label), HI_HKL);
  const [p1, p2] = [A.rows[2].pk, A.rows[3].pk], valley = Math.min(...pr.subtracted.slice(p1.idx, p2.idx + 1));
  assert.ok(valley > p2.height/2 && p2.fwhmClassic > 2*p1.fwhmClassic, `the valley ${valley} over half ${p2.height}; FWHM ${p2.fwhmClassic} against ${p1.fwhmClassic}`);
  assert.deepEqual([hklOf(M.peakRefl(p2, A.refl)), hklOf(A.rows[3].refl), hklOf(A.rows[3].k2), p1.height > p2.height], [['411', '330'], [], ['411', '330'], true], 'its line at λ within its tolerance; named at Kα2');
  assert.ok(Math.abs(A.rows[3].k2[0].tt - p2.detPos) < Math.abs(M.peakRefl(p2, A.refl)[0].tt - p2.detPos), 'its Kα2 line the nearer');
  // Out of the sizes: by sample the Kα1 peaks' alone, by peak (411)/(330) its Kα1 peak's.
  const k1 = A.rows.filter(r=> r.refl.length).map(r=> r.pk), st = M.sampleSizes(pr, fp, null, false, U, A);
  assert.deepEqual([k1.length, st.rawVals], [7, k1.map(pk=> M.scherrerD(pk.fwhmClassic, pk.detPos, fp.K, fp.lambda))]);
  const by = M.sizeRows('peak', [f], [A], [pr], [fp], null, U).find(r=> r.label === '(411)/(330)');
  assert.deepEqual([by.rawN, by.rawMean], [1, M.scherrerD(p1.fwhmClassic, p1.detPos, fp.K, fp.lambda)]);
  const t = H.peakTableHtml(pr.peaks.filter(pk=> !pk.removed), { std: false, m: null, fp, picked: null, st, A }, U);
  assert.ok(t.includes(`<td title="Calculated 2θ at Kα2: ${A.rows[3].k2.map(q=> q.tt.toFixed(3)).join(', ')}°">(411)/(330) Kα2</td>`));
  assert.equal(hklRule(R), 'hkl: the reflections of SrTiO3 at λ 1.540598 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least; 5 of 12 peaks at a reflection\'s Kα2 (λ 1.544426 Å), the nearest line within their tolerance, with a taller peak below at that reflection\'s λ: named so and left out of its sizes, as each repeats its Kα1 peak.');
});

/* A genuine Kα2 peak, (420)'s, named so with its partner; its partner removed by hand, or not
   taller, unassigned (to v576 "(420) Kα2" all the same). */
test('a genuine Kα2 peak named so with its partner, a taller peak below at its reflection\'s λ; with none, unassigned (v577)', ()=>{
  const f = hiPat({}), { pr, A } = hiRun(f), [p1, p2] = [A.rows[6].pk, A.rows[7].pk];
  assert.deepEqual([A.rows[7].label, hklOf(A.rows[7].k2), hklOf(A.rows[6].refl), p1.detPos < p2.detPos && p1.height > p2.height], ['(420) Kα2', ['420'], ['420'], true]);
  const its = B => B.rows.filter(r=> r.pk.detPos === p2.detPos).map(r=> [r.label, r.refl.length, r.k2.length]);
  assert.deepEqual(its(hiRun(f, [p1.detPos]).A), [['', 0, 0]], 'its partner removed by hand');
  assert.deepEqual(its(M.sampleAssign(f, { peaks: pr.peaks.map(pk=> pk === p1 ? { ...pk, height: p2.height/2 } : pk) }, K2_LAM, STO)), [['', 0, 0]], 'its partner not taller');
});

/* (a) The same perovskite with a cell 0.18 % smaller than its CIF's: its Kα1 peaks from (411) on
   fall on their lines' Kα2 alone, no partner below: unassigned (to v576 "(hkl) Kα2"); (400),
   within its tolerance of its line at λ too, though nearer its Kα2, named by it. */
test('a Kα1 peak of a cell smaller than its CIF\'s on its line\'s Kα2, no partner: unassigned, not named at Kα2 (v577)', ()=>{
  const R = hiRun(hiPat({ a: 3.898 })), { A } = R, rows = A.rows;
  assert.deepEqual(rows.map(r=> r.label), ['(400)', '(410)/(322)', ...Array(10).fill('')]);
  assert.ok(rows.slice(2).every(r=> !r.refl.length && !r.k2.length && !M.peakRefl(r.pk, A.refl).length), 'none at λ');
  assert.deepEqual([2, 4, 6, 8, 10].map(i=> hklOf(M.peakRefl(rows[i].pk, A.refl2))), [['411', '330'], ['331'], ['420'], ['421'], ['332']], 'each Kα1 peak on its line\'s Kα2');
  assert.ok(Math.abs(M.peakRefl(rows[0].pk, A.refl2)[0].tt - rows[0].pk.detPos) < Math.abs(rows[0].refl[0].tt - rows[0].pk.detPos), '(400) nearer its Kα2, no partner: named at λ');
  assert.equal(hklRule(R), 'hkl: the reflections of SrTiO3 at λ 1.540598 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least; 10 of 12 peaks unassigned, left out of its sizes.');
});

/* v576: the samples' CIFs saved once each. A state holds each distinct text once (cifTexts) and
   each sample its file's name and its text's place there; read back whole, v575's states
   (each sample its text) too, a reference to no text none. A Rietveld card keeping the
   Scherrer state (xrd-model.js keptSlots): a file left out holds its CIF whole, one coming back
   goes into the pool (once), a pool made where there is none. */
test('the samples\' CIFs saved once each: the pool, read back, v575\'s states, a card switched to Rietveld (v576)', ()=>{
  const TET = { file: 'BaTiO3_tetra.cif', cif: TETRA_CIF }, OTHER = { file: 'other.cif', cif: STO.cif };
  const c = { perParams: [{}, {}, {}, {}, {}], manualPeaks: [[], [], [], [], []], removedPeaks: [[], [], [], [], []], cifs: [STO, TET, null, { ...STO }, OTHER],
    shared: { ...M.FIELD_DEF }, paramMode: M.modeDef(false), sizeBy: 'sample', norm: 'global' };
  const s = M.stateOf(c), json = JSON.stringify(s);
  assert.deepEqual([s.cif, s.cifTexts], [[{ file: 'SrTiO3.cif', ref: 0 }, { file: 'BaTiO3_tetra.cif', ref: 1 }, null, { file: 'SrTiO3.cif', ref: 0 }, { file: 'other.cif', ref: 0 }], [STO.cif, TETRA_CIF]]);
  assert.equal(json.split('data_SrTiO3').length - 1, 1, 'SrTiO3\'s text once, given three samples');
  const back = M.readState(JSON.parse(json), false, 5);
  assert.deepEqual(back.cifs, [STO, TET, null, STO, OTHER]);
  assert.deepEqual(Object.keys(M.stateOf({ ...c, cifs: [null, null, null, null, null] })).filter(k=> /^cif/.test(k)), ['cif'], 'no CIF, no pool');
  // v575's (each sample its text), read whole and saved pooled; a reference to no text, none.
  const v575 = { ...JSON.parse(json), cif: [STO, TET, null, STO, OTHER], cifTexts: undefined };
  assert.deepEqual(M.readState(v575, false, 5).cifs, [STO, TET, null, STO, OTHER]);
  const S = { std: false, shared: {}, paramMode: {}, panel: { sel: null, hov: null } };
  M.takeState(S, M.readState(v575, false, 5), 'global');
  const again = M.stateOf(S);
  assert.deepEqual([again.cif, again.cifTexts], [s.cif, s.cifTexts], 'saved again as this version saves it');
  assert.deepEqual(M.readState({ cif: [{ file: 'a', ref: 0 }, { file: 'b', ref: 2 }, { file: 'c', ref: '0' }, { file: 4, ref: 0 }, STO], cifTexts: ['data_a'] }, false, 5).cifs,
    [{ file: 'a', cif: 'data_a' }, null, null, null, STO], 'beyond the pool, not a place, no name: none');
  assert.deepEqual(M.readState({ cif: [{ file: 'a', ref: 0 }], cifTexts: 'data_a' }, false, 1).cifs, [null], 'a pool that is none');
  // Kept by a Rietveld card: held whole, back into the pool once; a pool made where it has none.
  const kept = JSON.parse(json), ks = XM.keptSlots('A1', kept)[3];
  assert.deepEqual([ks.out(kept.cif[1]), ks.out(null), ks.out(STO)], [TET, null, STO]);
  assert.deepEqual([ks.make(TET), ks.make({ ...STO, file: 'new.cif' }), ks.make(undefined), kept.cifTexts.length], [{ file: 'BaTiO3_tetra.cif', ref: 1 }, { file: 'new.cif', ref: 0 }, null, 2]);
  assert.deepEqual(ks.make({ file: 'q.cif', cif: 'data_q' }), { file: 'q.cif', ref: 2 });
  assert.deepEqual(kept.cifTexts, [STO.cif, TETRA_CIF, 'data_q']);
  const bare = { ...v575, cif: [null] }, kb = XM.keptSlots('A1', bare)[3];
  assert.deepEqual([kb.make(TET), bare.cifTexts], [{ file: 'BaTiO3_tetra.cif', ref: 0 }, [TETRA_CIF]]);
  assert.deepEqual(M.readState({ ...bare, cif: [kb.make(TET)] }, false, 1).cifs, [TET]);
});

/* v576: the names under the size chart by peak, the hkl alone, whole where v575's, the species
   before them, were cut in the middle ("BaTiO3 (101)/(110)" over the 80 px a name keeps). */
test('the size chart by peak: each reflection by its hkl alone, whole; its species its boxes\' colour (v576)', ()=>{
  const pk = (detPos, w)=> ({ pos: detPos, detPos, fwhmClassic: w });
  const procs = [{ peaks: [pk(32.4, 0.2), pk(46.5, 0.25)] }, { peaks: [pk(31.6, 0.2), pk(45.4, 0.25)] }];
  const lab = (p, l)=> ({ sp: p, rows: [0, 1].map(i=> ({ refl: [{ tt: 30 + 15*i, hkl: [1, 1, 0] }], label: l[i] })) });
  const A = [lab('SrTiO3', ['(110)', '(200)']), lab('BaTiO3', ['(101)/(110)', '(002)/(200)'])];
  A.forEach((a, k)=> a.rows.forEach((r, i)=> { r.pk = procs[k].peaks[i]; }));
  const fp = { K: 0.9, lambda: 1.540598 }, rows = M.sizeRows('peak', [{ name: 'a', label: 'a' }, { name: 'b', label: 'b' }], A, procs, [fp, fp], null, U);
  assert.deepEqual(rows.map(r=> [r.label, r.name, r.sp]), [['(110)', 'SrTiO3 (110)', 0], ['(200)', 'SrTiO3 (200)', 0], ['(101)/(110)', 'BaTiO3 (101)/(110)', 1], ['(002)/(200)', 'BaTiO3 (002)/(200)', 1]]);
  const mctx = { measureText: t => ({ width: t.length*5.5 }) }, fit = U.barNames(mctx, rows.map(r=> r.label), 445, 55);
  assert.deepEqual(fit.labels, rows.map(r=> r.label), 'none cut');
  assert.deepEqual(M.sizeSeries(rows, M.speciesOf(A)).map(m=> [m.name, m.color]), [['SrTiO3', '#3aa0ff'], ['BaTiO3', '#ff7a59']], 'the species, a colour each, in the legend');
});

test('the words: the warnings under the table, the chips, the note under the chart, a sample\'s CIF, labels escaped', ()=>{
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
  assert.equal(cells(t)[0][2], '0.0%', 'heights all 0: 0 %, as peaks.csv writes them (v568; a dash to v567)');
  assert.ok(t.endsWith('<br>Instr.-corrected: <b>— nm</b></div>' + H.belowInstrHtml(2) + H.outsideStdHtml(1, st.span)));
  assert.ok(t.includes('<button class="peak-del is-danger idle-dim" data-det="32" data-manual="0" title="Remove peak">[x13]</button>'));
  // With the standard: the corrected size, ⚠ where the peak is narrower than the instrument.
  const m = M.instrModelOf([{ pos: 30, fwhm: 0.35, fwhmSig: 0.01 }]);
  const tc = H.peakTableHtml([{ ...pk, height: 1, manual: true }, { pos: 50, detPos: 50, height: 2, fwhmClassic: 0.5 }], { std: false, m, fp: { K: 0.9, lambda: 1.540598 }, picked: null, st: { ...st, below: 0, outside: 0 } }, U);
  const D = (b, tt)=> H.fmtCell(M.scherrerD(b, tt, 0.9, 1.540598));
  assert.deepEqual(cells(tc), [['1', '32.000', '50.0%', '0.300', D(0.3, 32), '⚠'], ['2', '50.000', '100.0%', '0.500', D(0.5, 50), D(Math.sqrt(0.5**2 - 0.35**2), 50)]]);
  assert.ok(tc.includes('<td title="Narrower than the instrumental width at this angle">⚠</td>') && tc.includes('<tr class="peak-row manual-peak"'));
  // The chips (v575): none with no sample with a CIF; by peak disabled with no peak assigned.
  assert.equal(H.sizeChipsHtml(0, false, 'sample'), '');
  assert.equal(H.sizeChipsHtml(1, false, 'sample'), '<button type="button" class="mode-chip plot-chip is-on" data-size-by="sample" title="Crystallite size by sample">by sample</button>'
    + '<button type="button" class="mode-chip plot-chip" data-size-by="peak" disabled title="No peak is assigned to a reflection of its sample\'s CIF">by peak</button>');
  // The note under the chart: the samples with no CIF, not charted, the labels escaped.
  const evil = `"'><i data-x=1></i>`;
  assert.equal(H.sizeNoteHtml(['a', evil], U), `Not charted, no CIF: a, &quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt;.`);
  assert.equal(H.sizeNoteHtml([], U), '', 'every sample with a CIF: none');
  // A sample's CIF in the table: each peak's hkl (several together; a negative index barred),
  // unassigned where none; the mean its species', the rule and the peaks it leaves out in grey.
  const A = { sp: evil, rows: [{ refl: [{ tt: 31.99 }, { tt: 32.04 }], label: '(110)/(101)' }, { refl: [{ tt: 50 }], label: '(1-10)' }] };
  const ta = H.peakTableHtml([pk, { ...pk, pos: 50, detPos: 50 }], { std: false, m: null, fp: { K: 0.9, lambda: 1.5406 }, picked: null, st: { ...st, below: 0, outside: 0 }, A: { ...A, rows: [A.rows[0], { refl: [], label: '' }] } }, U);
  assert.deepEqual(cells(ta).map(r=> r[2]), ['(110)/(101)', 'unassigned']);
  assert.ok(ta.includes('<td title="Calculated 2θ: 31.990, 32.040°">(110)/(101)</td>') && ta.includes('<td class="xrd-unassigned">unassigned</td>'));
  assert.ok(ta.includes('Mean crystallite size, &quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt;: <b>'));
  assert.ok(ta.endsWith('<p class="txt-meta xrd-hkl-rule">hkl: the reflections of &quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt; at λ 1.5406 Å within 0.5 FWHM of a peak\'s 2θ, 0.1° at least; 1 of 2 peaks unassigned, left out of its sizes.</p>'));
  const tb = H.peakTableHtml([pk, { ...pk, pos: 50, detPos: 50 }], { std: false, m: null, fp: { K: 0.9, lambda: 1.5406 }, picked: null, st: { ...st, below: 0, outside: 0 }, A }, U);
  assert.ok(tb.includes('<td title="Calculated 2θ: 50.000°">(1<span class="hkl-bar"><span class="hkl-sign">-</span>1</span>0)</td>'));
  assert.ok(/at least\.<\/p>$/.test(tb), 'every peak assigned: no count');
  // The CIF selector's options (none, the pool's by name, their files in the titles, Add
  // CIF…), escaped.
  assert.equal(H.cifOptionsHtml([{ file: 'a<b>.cif', text: 'SrTiO3' }, { file: 'x.cif', text: evil }], U), '<option value="">none</option><option value="0" title="a&lt;b&gt;.cif">SrTiO3</option>'
    + '<option value="1" title="x.cif">&quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt;</option><option value="add">Add CIF…</option>');
  // The Caglioti box with no standard, no peaks, too few peaks, peaks at too few angles, an exact fit, a curve dropping to zero.
  assert.match(H.cagliotiHtml(null, 0).box, /No standard loaded: no instrumental correction/);
  assert.match(H.cagliotiHtml({ pts: [], fit: null }, 1).box, /No peaks: no instrumental correction/);
  // (not fitted: a compact warning, v571: to v570 a grey note, X15)
  assert.match(H.cagliotiHtml(M.instrModelOf([{ pos: 30, fwhm: 0.1 }]), 1).box, /<div class="alert warn compact">⚠ Not fitted: it needs 3 peaks or more\./);
  assert.match(H.cagliotiHtml(M.instrModelOf([{ pos: 30, fwhm: 0.1 }]), 1).box, /Peaks: <b>1<\/b>, 2θ 30.00°.*it needs 3 peaks or more\. The instrumental width is the peak's FWHM at every angle/);
  assert.match(H.cagliotiHtml({ pts: [{ x: 30, b: 0.1 }, { x: 30, b: 0.2 }, { x: 50, b: 0.2 }], fit: null }, 1).box, /it needs peaks at 3 angles or more, and these 3 lie at 2\. The instrumental width is interpolated between the peaks/);
  const th = tt => tt/2*Math.PI/180, exact = M.instrModelOf([30, 50, 70].map(tt=> ({ pos: tt, fwhm: 0.1 + tt/1000, fwhmSig: 0.01 })));
  assert.match(H.cagliotiHtml(exact, 1).box, /Exact through its 3 peaks: no degree of freedom left/);
  assert.ok(!/R²|χ²<sub>red/.test(H.cagliotiHtml(exact, 1).box));
  const drop = { pts: [20, 40, 60].map(tt=> ({ x: tt, th: th(tt), b: 0.1 })), fit: { uvw: [0.01, -0.01, 0.001], se: [0, 0, 0], dof: 1, weighted: false, s: 0.001, r2: 0.9, rms: 0.001, maxRes: 0.002 } };
  assert.equal(H.cagliotiHtml(drop, 1).alert, '<div class="alert warn">⚠ The fitted FWHM² drops to zero inside the standard\'s range: there the curve is not physical, and no correction is made.</div>');
  assert.match(H.cagliotiHtml(drop, 1).box, /title="Unweighted: no counting uncertainty for the widths\. Residual standard error on FWHM²: 0\.0010 °² \(1 degree of freedom\)"/);
});

/* =========================================================
   THE CARD'S WIRING, WORKED OUT (v561)
========================================================= */
const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/peaksmodel.json', import.meta.url);
const show = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v;
export const canon = v => JSON.stringify(v, function(k, x){ const o = this[k];
  if (typeof o === 'number') return '#' + show(o);
  if (typeof o === 'function') return 'fn';
  if (ArrayBuffer.isView(o)) return Array.from(o, show);
  return x; });
// An array by a digest of its numbers, as a page of stubs records a plot's.
export const dg = a => a == null ? String(a) : sha(canon(Array.from(a))).slice(0, 16);
const normOf = v => v === 'local' || v === 'none' ? v : 'global';

test('the fields: a value typed and a width as written, the store, a width\'s hint, the λ preset', ()=>{
  assert.deepEqual(Object.values(M.fieldInputs(true)), ['Smooth', 'BlWin', 'PkHeight', 'PkProm', 'PkDist']);
  assert.deepEqual(Object.keys(M.fieldInputs(false)), ['smoothW', 'snipW', 'pkHeight', 'pkProm', 'pkDist', 'K', 'lambda']);
  assert.deepEqual(M.guardsOf(true), [['Smooth', 0, 0], ['BlWin', 1e-6, 5], ['PkHeight', 0, 5], ['PkProm', 0, 3], ['PkDist', 0, 0.3]]);
  assert.deepEqual(M.guardsOf(false).slice(-3), [['PkDist', 0, 0.3], ['K', 1e-6, 0.9], ['Lambda', 1e-6, 1.540598]]);
  assert.deepEqual([M.numIn(' 0,5 ', 9), M.numIn('', 9), M.numIn('x', 9), M.numIn('2abc', 9), M.numIn(-1, 9)], [0.5, 9, 9, 2, -1]);
  // A width as its field shows it (4 digits) is the value stored, exact; typed, the field's
  // value (the SNIP's shown whole: half stored), at its least; a field emptied: the default.
  assert.equal(M.fieldIn('snipW', '5', '5', 2.50004), 2.50004);
  assert.deepEqual([M.fieldIn('snipW', '6', '5', 2.5), M.fieldIn('snipW', '0', undefined, 2.5), M.fieldIn('snipW', '', '5', 2.5)], [3, 1e-6, 2.5]);
  assert.deepEqual([M.fieldIn('smoothW', '0,1', '0.25', 0.25), M.fieldIn('pkHeight', '-3', '-3', 7), M.fieldIn('K', 'x', undefined, undefined)], [0.1, 0, 0.9]);
  // Into the store: the shared value under all, the sample's own under one; with no file,
  // every value shared (those a file loaded takes); the box with its width.
  const S = { paramMode: M.modeDef(false), shared: { ...M.FIELD_DEF }, perParams: [] };
  const vals = { smoothW: 0.1, snipW: 2, pkHeight: 4, pkProm: 2, pkDist: 0.2, K: 1, lambda: 1.5 };
  M.takeInputs(S, 1, vals, false, 2);
  assert.deepEqual([0 in S.perParams, S.perParams[1]], [false, { pkHeight: 4, pkProm: 2, pkDist: 0.2 }]);
  assert.deepEqual([S.shared.smoothW, S.shared.snipW, S.shared.K, S.shared.blOn, S.shared.pkHeight], [0.1, 2, 1, false, 5]);
  S.paramMode.blWin = 'per'; M.takeInputs(S, 0, vals, true, 2);
  assert.deepEqual(S.perParams[0], { snipW: 2, pkHeight: 4, pkProm: 2, pkDist: 0.2, blOn: true });
  M.takeInputs(S, 0, { ...vals, pkHeight: 9 }, false, 0);
  assert.deepEqual([S.shared.pkHeight, S.shared.blOn, S.perParams[0].pkHeight], [9, false, 4], 'no file: the shared values');
  // The hints: the points a width spans at the step on show; the stored width while the field
  // shows it; off, none, nothing with no step.
  assert.deepEqual(M.widthHint('Smooth', '0.1', '0.1', 0.1, 0.01, 'a<b'), { t: ptsText(10), tip: '10 steps at the step of a<b, 0.01°' });
  assert.deepEqual(M.widthHint('Smooth', '0', '0', 0, 0.01, 'a'), { t: 'off', tip: 'No smoothing' });
  assert.deepEqual(M.widthHint('BlWin', '5', '5', 2.5, 0.02, 'a'), { t: ptsText(250), tip: '250 steps across, 125 points on each side at the step of a, 0.02°' });
  assert.deepEqual(M.widthHint('BlWin', '0,03', '5', 2.5, 0.02, 'a'), { t: ptsText(1.5), tip: '1.5 steps across, 1 point on each side at the step of a, 0.02°' });
  assert.deepEqual([M.widthHint('BlWin', '0', '5', 2.5, 0.02, 'a'), M.widthHint('Smooth', 'x', '', NaN, 0.02, 'a'), M.widthHint('Smooth', '1', '1', 1, NaN, undefined)],
    [{ t: '', tip: '' }, { t: '', tip: '' }, { t: '', tip: '' }]);
  const OPTS = ['1.540598', '1.541838', '1.544426', '0.709317', '1.789010', '2.289760', 'custom'];
  assert.deepEqual(['1.540598', '1,5406', '1.78901', '1.6', '', 'x'].map(t=> M.presetOf(t, OPTS)), ['1.540598', '1.540598', '1.789010', 'custom', 'custom', 'custom']);
  // The processing's keys: by the arrays' own numbers, the widths (the SNIP's none when off),
  // the peak search and the peaks by hand.
  const ids = new Map(), idOf = o => o == null ? '-' : ids.get(o) || (ids.set(o, ids.size + 1), ids.size);
  const f = { x: [1, 2], y: [3, 4] }, pr = { ...DEF, blOn: false };
  assert.deepEqual(M.procKeys(f, pr, [30.5], null, idOf), { k1: '1|2|0.25|off', k2: '1|2|0.25|off|-|5|3|0.3|30.5|' });
  assert.equal(M.procKeys({ ...f, varMul: [1] }, DEF, [], [20, 21], idOf).k2, '1|2|0.25|2.5|3|5|3|0.3||20,21');
});

test('the plot: its curves and marks and their colours; the Results\' stack, the size chart\'s layout', ()=>{
  const x = axis(20, 0.02, 1001), y = x.map(t=> gauss(t, 30, 800, 0.4) + gauss(t, 30.005, 1, 0.4) + gauss(t, 35, 400, 0.6) + 100);
  const f = { x, y }, pr = { ...DEF, smoothW: 0.06 };
  const proc = M.processingOf(f, M.smoothingOf(x, y, pr), pr, [30, 33], [35], U);
  const D = M.anaOf(f, proc, true, U), mx = U.maxArr(proc.smoothed);
  assert.equal(D.mx, mx);
  assert.deepEqual([D.raw, D.smoothed], [y.map(v=> v/mx), proc.smoothed.map(v=> v/mx)]);
  assert.deepEqual([D.dense.length, D.dense[0], D.dense[D.dense.length - 1]], [10010, 20, x[1000]]);
  assert.deepEqual(D.base, U.interpLinear(x, proc.baseline, D.dense).map(v=> v/mx));
  assert.equal(M.anaOf(f, proc, false, U).base, null, 'no baseline drawn with its box off');
  // Each kept peak once (the manual one at the detected 30 drawn once), the removed one none;
  // its FWHM's marker at half its height over the baseline.
  assert.deepEqual(D.peakMarks, [{ pos: 30 }, { pos: 33 }]);
  const gm = M.fwhmGeom(x, proc.subtracted, proc.peaks[0].idx);
  assert.deepEqual(D.fwhmMarks[0], { pos: 30, x0: gm.xl, x1: gm.xr, y: (proc.baseline[gm.idx] + gm.half)/mx });
  // The colours: the peak picked white, hovered bright, the others green; their FWHM markers red alike.
  assert.deepEqual([M.nearestOf([30, 33], 30.5), M.nearestOf([30, 33], 31.6), M.nearestOf([30, 33], null), M.nearestOf([], 3), M.nearestOf([30, NaN, 30.2], 30.15)], [0, -1, -1, -1, 2]);
  assert.deepEqual(M.markStyles([30, 33, 36], [30, 36], 33.1, 36), { peaks: [[M.PEAK_BASE, 1], [M.PEAK_SEL, 1.8], [M.PEAK_HOVER, 1.8]], fwhm: [[M.FWHM_BASE, 2.2], [M.FWHM_HOVER, 4]] });
  assert.deepEqual(M.markStyles([30], [30], 30, 30), { peaks: [[M.PEAK_SEL, 1.8]], fwhm: [[M.FWHM_SEL, 4]] });
  assert.deepEqual([M.toggled(null, 30), M.toggled(30, 30), M.toggled(30, 31)], [30, null, 31]);
  // The guide of a peak being placed: from the middle, a point a key, within the plot's range.
  assert.deepEqual([M.nudge(x, 20, 40, null, 1), M.nudge(x, 20, 40, 1000, 1), M.nudge(x, 25, 30, 0, -1), M.nudge(x, 30, 25, 400, 1), M.nudge(x, 30, 25, 600, -1)], [501, 1000, 250, 401, 500]);
  // The stack: each pattern over the largest (global), its own (local), none; offset down.
  const fs = [{ x: [1, 2, 3] }, { x: [2, 3, 4, 5] }, { x: [0, 9] }], curves = [[1, 4, 2], [2, 8, 1, 0], null];
  assert.deepEqual(M.stackShown(fs, curves), [0, 1]);
  const g = M.stackOf(fs, curves, [0, 1], 'global', U);
  assert.deepEqual(g.range, [1, 5, -1.1, 1.1]);
  assert.deepEqual(g.traces.map(t=> [t.k, t.norm1, t.y]), [[0, [0.125, 0.5, 0.25], [0.125 + 0 + 0.05, 0.5 + 0.05, 0.25 + 0.05]], [1, [0.25, 1, 0.125, 0], [0.25 - 1.1 + 0.05, 1 - 1.1 + 0.05, 0.125 - 1.1 + 0.05, 0 - 1.1 + 0.05]]]);
  assert.deepEqual(M.stackOf(fs, curves, [0, 1], 'local', U).traces[0].norm1, [0.25, 1, 0.5]);
  const none = M.stackOf(fs, curves, [0, 1], 'none', U);
  assert.deepEqual([none.range, none.traces[1].y[1]], [[1, 5, -8.8, 8.8], 8 - 8.8 + 0.4]);
  assert.deepEqual(M.stackOf(fs, curves, [], 'global', U).range, [0, 1, -0, 1.1]);
  // The size chart: its labels, the room over the boxes, the pair's offsets, those under the chips.
  assert.deepEqual([M.sizeLab(12.345, 1.26), M.sizeLab(12.345, NaN)], ['12.3±1.3', '12.3']);
  const box = { q1: 10, med: 11, q3: 12, lo: 9, hi: 13, out: [20] };
  const rows = [{ label: 'a', sp: 0, rawBox: box, rawMean: 11, rawStd: 1, corrBox: box, corrMean: 15, corrStd: NaN }, { label: 'bb', sp: 0, rawBox: null }];
  const SER = M.sizeSeries(rows, ['X']), measure = t => t.length*6;
  const L = M.barLayout(rows, SER, { labels: ['a', 'bb'], sin: 0.5 }, measure, 520, 340);
  assert.deepEqual([L.n, L.bottom, L.mTop, L.gap, L.plotH, L.hw, L.offOf(0), L.offOf(1)], [2, 32, 15, 6, 293, 16, -17, 17]);
  assert.equal(L.frac, 1 - (6 + 48 + 6)/293);
  assert.deepEqual(L.under, [{ x: 1, dx: -17, top: 20, w: 48 }, { x: 1, dx: 17, top: 20, w: 24 }]);
  const one = M.barLayout(rows.slice(0, 1).map(r=> ({ ...r, corrBox: null })), M.sizeSeries([{ sp: 0, rawBox: box }], ['X']), { labels: ['a'], sin: 0 }, measure, 120, 100);
  assert.deepEqual([one.hw, one.offOf(0), one.frac], [Math.min(16, (120 - 75)/2*0.3), 0, 0.5]);
  // Two species (v575): each row its own species' pair, at the same offsets.
  const two = [rows[0], { label: 'c', sp: 1, rawBox: box, rawMean: 12, rawStd: NaN, corrBox: box, corrMean: 16, corrStd: NaN }];
  const L2 = M.barLayout(two, M.sizeSeries(two, ['X', 'Y']), { labels: ['a', 'c'], sin: 0 }, measure, 520, 340);
  assert.deepEqual(L2.under.map(u=> [u.x, u.dx]), [[1, -17], [1, 17], [2, -17], [2, 17]]);
  assert.deepEqual([M.barYmax([20, 10], 0.8, 0), M.barYmax([20], 0.5, 0), M.barYmax([20], 0.9, 99)], [25, 40, 99]);
  assert.deepEqual(M.sizeDlNames('C - ', 'peak'), { csv: 'C - crystallite_size.csv,C - crystallite_size_by_peak.csv', svg: 'C - XRPD_crystallite_size_by_peak.svg' });
  assert.equal(M.sizeDlNames('', 'sample').svg, 'XRPD_crystallite_size.svg');
});

test('the state changed: a chip switched, peaks removed and placed, the per-sample arrays, a state taken', ()=>{
  const Q = { file: 'a.cif', cif: 'data_a' };
  const mk = ()=> ({ std: false, paramMode: M.modeDef(false), shared: { ...M.FIELD_DEF }, perParams: [{ snipW: 1 }, undefined, {}],
    manualPeaks: [[30], [], [40, 41]], removedPeaks: [[], [33], []], cifs: [Q, null, null], panel: { sel: 3, hov: 4 }, processed: [1] });
  // To one: every sample from the value on show; to all, theirs the one on show's (the
  // baseline's box with its width).
  const S = mk(), cur = { ...DEF, snipW: 3, blOn: false };
  assert.equal(M.switchMode(S, 'blWin', cur, 3), 'per');
  assert.deepEqual(S.perParams, [{ snipW: 3, blOn: false }, { snipW: 3, blOn: false }, { snipW: 3, blOn: false }]);
  assert.equal(M.switchMode(S, 'blWin', { ...cur, snipW: 4 }, 3), 'shared');
  assert.deepEqual([S.shared.snipW, S.shared.blOn], [4, false]);
  M.switchMode(S, 'pkHeight', { ...cur, pkHeight: 7 }, 3);
  assert.deepEqual([S.paramMode.pkHeight, S.shared.pkHeight], ['shared', 7]);
  M.switchMode(S, 'N', { ...cur, smoothW: 0.5 }, 2);
  assert.deepEqual([S.perParams[0].smoothW, S.perParams[1].smoothW, S.perParams[2].smoothW], [0.5, 0.5, undefined], 'one per file (n)');
  // The peak search's fields bring back the removed peaks: the sample's, or every one's under all.
  const T = mk(); M.clearRemoved(T, 'pkHeight', 1);
  assert.deepEqual(T.removedPeaks, [[], [], []]);
  const V = mk(); V.paramMode.pkProm = 'shared'; V.removedPeaks = [[1]]; V.removedPeaks[2] = [2]; M.clearRemoved(V, 'pkProm', 0);
  assert.deepEqual([V.removedPeaks.length, 1 in V.removedPeaks, V.removedPeaks[2]], [3, false, []], 'every one (a hole kept)');
  // A peak's ×: one by hand gone for good (by its 2θ, to 10⁻⁶), a detected one removed once.
  const W = mk();
  M.dropPeak(W, 2, 40.0000001, true); M.dropPeak(W, 0, 33, false); M.dropPeak(W, 1, 33.0000005, false); M.dropPeak(W, 5, 20, false); M.dropPeak(W, 6, 20, true);
  assert.deepEqual([W.manualPeaks[2], W.removedPeaks[0], W.removedPeaks[1], W.removedPeaks[5], W.manualPeaks[6]], [[41], [33], [33], [20], undefined]);
  // The per-sample arrays the file list keeps aligned: a file taken back in takes its entry
  // (its numbers), or the shared values; none for the standard.
  const X = mk(), sl = M.slotsOf(X, 'A3');
  assert.deepEqual(sl.map(q=> q.key), ['A3:params', 'A3:manual', 'A3:removed', 'A3:cif']);
  assert.ok(sl[0].arr === X.perParams && sl[1].arr === X.manualPeaks && sl[2].arr === X.removedPeaks && sl[3].arr === X.cifs);
  assert.deepEqual([sl[3].make(Q), sl[3].make(undefined), sl[3].make({ file: 'a' })], [Q, null, null], 'a CIF held (v575), a copy');
  assert.notEqual(sl[3].make(Q), Q);
  assert.deepEqual(sl[0].make(undefined), X.shared); assert.notEqual(sl[0].make(undefined), X.shared);
  assert.deepEqual(sl[0].make({ smoothW: 0.5, pkHeight: 'x', blOn: false }), { smoothW: 0.5, blOn: false });
  assert.deepEqual([sl[1].make([3]), sl[2].make(null)], [[3], []]);
  assert.deepEqual(M.slotsOf({ ...X, std: true }, 'S'), []);
  const Y = mk(); M.addEntry(Y);
  assert.deepEqual([Y.perParams[3], Y.manualPeaks[3], Y.removedPeaks[3], Y.cifs[3]], [M.FIELD_DEF, [], [], null]);
  M.freshEntries(Y, [{}, {}]);
  assert.deepEqual([Y.perParams, Y.manualPeaks, Y.removedPeaks, Y.cifs, Y.panel], [[M.FIELD_DEF, M.FIELD_DEF], [[], []], [[], []], [null, null], { sel: null, hov: null }]);
  M.clearEntries(Y);
  assert.deepEqual([Y.processed, Y.perParams, Y.manualPeaks, Y.removedPeaks, Y.cifs, Y.panel], [[], [], [], [], [], { sel: null, hov: null }]);
  // A state read, taken: the objects of S kept (its shared and modes), the rest replaced; nothing picked.
  const Z = mk(), sh = Z.shared, t = M.readState({ shared: { pkHeight: 2 }, sizeBy: 'peak', manualPeaks: [[30.5]], cif: [Q] }, false, 1);
  M.takeState(Z, t, 'none');
  assert.ok(Z.shared === sh && Z.perParams === t.perParams && Z.manualPeaks === t.manualPeaks && Z.cifs === t.cifs);
  assert.deepEqual([Z.shared.pkHeight, Z.sizeBy, Z.norm, Z.manualPeaks, Z.cifs, Z.panel], [2, 'peak', 'none', [[30.5]], [Q], { sel: null, hov: null }]);
  assert.deepEqual(M.stateOf(Z), { perParams: [{ blOn: true }], manualPeaks: [[30.5]], removedPeaks: [[]], cif: [{ file: 'a.cif', ref: 0 }], cifTexts: ['data_a'], shared: Z.shared, paramMode: M.modeDef(false), sizeBy: 'peak', norm: 'none' });
  M.setCif(Z, 0, null);
  assert.deepEqual(M.stateOf(Z).cif, [null]);
  const P = { sel: null };
  assert.equal(M.showsOf(P), null);
  M.showNext(P, { sel: 'x' }); M.showNext(P, null); assert.equal(P.sel, null);
  M.showNext(P, { sel: 32.4 }); assert.deepEqual(M.showsOf(P), { sel: 32.4 });
});

test('the card\'s markup: the samples\' and the standard\'s, the Results\' section, the legends, every name escaped', ()=>{
  const ids = h => [...h.matchAll(/ id="([^"]+)"/g)].map(m=> m[1]);
  const card = H.cardHtml('xrdA4', false, U), std = H.cardHtml('xrdStdA', true, U), res = H.resHtml('xrdA4', U);
  // Every element the wiring looks up, once each.
  for (const id of ['Svg', 'Prev', 'Next', 'CurrentLabel', 'Norm', 'Smooth', 'SmoothPts', 'BlOn', 'BlWin', 'BlWinPts', 'PkHeight', 'PkProm', 'PkDist', 'K', 'LambdaSel', 'Lambda',
    'Cif', 'CifInput', 'CifNote', 'AddPeak', 'Std', 'PeakBox', 'PkReset', 'PeakTableWrap', ...Object.keys(M.TOGGLES).map(k=> 'Mode' + k)]) assert.equal(ids(card).filter(x=> x === 'xrdA4' + id).length, 1, id);
  for (const id of ['Svg', 'Smooth', 'BlOn', 'BlWin', 'PkHeight', 'PkProm', 'PkDist', 'Cag', 'CagAlert', 'AddPeak', 'PeakBox', 'PkReset', 'PeakTableWrap']) assert.ok(ids(std).includes('xrdStdA' + id), id);
  assert.ok(!/Norm|Lambda|Mode|Prev|Cif/.test(ids(std).join()), 'the standard: no normalisation, no λ, no chips, no selector, no CIF');
  // The CIF's row (v575): its name and its field, a row of the grid as the others, the last.
  assert.match(card, /<label class="txt-label" for="xrdA4Cif" title="[^"]+">CIF<\/label>\s*<select id="xrdA4Cif" class="pg-field" title="[^"]+"><\/select>\s*<\/div>/);
  assert.deepEqual(ids(res), ['xrdA4ResSvg', 'xrdA4ResLegend', 'xrdA4SizeBarSvg', 'xrdA4SizeBy', 'xrdA4SizeBarLegend', 'xrdA4SizeByNote']);
  // The fields' values as the store's defaults write them; the chips as modeDef sets them.
  assert.match(card, /id="xrdA4Smooth" value="0\.25"/); assert.match(std, /id="xrdStdASmooth" value="0"/);
  assert.match(card, /id="xrdA4BlWin" value="5"/);
  assert.deepEqual([...card.matchAll(/id="xrdA4Mode(\w+)"[^>]*>(\w+)</g)].map(m=> m[1] + ':' + m[2]), Object.entries(M.TOGGLES).map(([k, m])=> k + ':' + (M.modeDef(false)[m] === 'shared' ? 'all' : 'one')));
  assert.ok(card.includes('data-csv-base="peaks.csv" data-csv-names="peaks.csv"') && std.includes('data-csv-names="standard.csv" title="Download CSV"'));
  // (in the notes' grey, v571: to v570 a style of its own, X16)
  assert.equal(H.NO_PEAKS, '<p class="txt-meta xrd-no-peaks">No peaks found with current parameters.</p>');
  const evil = `"'><i data-x=1></i>`;
  assert.equal(H.stackLegendHtml([{ color: evil, label: evil }, { color: 'red', label: 'b' }], [1, 0], U),
    '<span><i style="background:red"></i>b</span><span><i style="background:&quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt;"></i>&quot;&#39;&gt;&lt;i data-x=1&gt;&lt;/i&gt;</span>');
  assert.equal(H.sizeLegendHtml(M.sizeSeries([{ sp: 0, rawBox: {}, corrBox: {} }], [evil]), U), `<span><i class="mk-box" style="background:#3aa0ff"></i>${U.esc(evil)}</span><span><i class="mk-box" style="background:#93cbff"></i>${U.esc(evil)} corr.</span>`);
  assert.ok(H.PEAKS_INFO.startsWith('Per-sample view.') && H.STD_INFO.startsWith('A measured standard'));
});

/* ---- Cases as v560's xrd-peaks.js gave them (v575: with the samples' CIFs) ----
   A card (a sample's, its patterns 0 to 4, with the standard's correction or none; or the
   standard's, its file or none) with a state of any version or malformed, then eight steps
   each, done as xrd-peaks.js does them (its wiring, in short, below: the fields and their
   guards, the chips, the λ preset, the selector, peaks removed, placed by the keys and
   reset, picked and hovered, the size chart's chips, a state put back, showNext), after the
   state and each step what the card shows (outputs). Their digests:
   tests/golden/peaksmodel.json. v575: the 40 cases as they were, what they show with the
   samples' CIFs (none chosen: the size chart charts none, its chips none, the CSVs' species
   and hkl columns empty, the state's CIFs and an older version's note; the rest as v574
   gave it, checked so as they were written anew), and 20 more whose steps choose a sample's
   CIF too (none, the fixture's SrTiO₃, the tetragonal one) from states that have some.
   v576 wrote 10 of the 20 anew, checked field by field against v575's: the 40 the same; of
   the 20, the state's CIFs in its pool (cif: { file, ref }, cifTexts), the same read back
   (58 states), and a peak unassigned to v575 named "(hkl) Kα2" at a reflection's Kα2 (11
   tables, their rule saying so; 18 peaks.csv, its hkl): nothing else (sizes, charts, the
   other CSVs) changed. v577 wrote 8 of the 20 anew (the peaks at Kα2: peakRow), checked field
   by field against v576's: in 22 tables and 29 peaks.csv, a Kα1 peak on a line's Kα2 with no
   partner below (a cell smaller than its CIF's, or the tetragonal CIF given a cubic pattern: at
   (110), (111), (211)) unassigned again (11 tables), and a faint peak placed by hand above
   (200), so wide that its tolerance takes (200)'s line at λ and at Kα2, named "(200) Kα2" (the
   nearer, the (200) peak below and taller) and left out of the sizes (12 steps of 4 cases:
   there the size chart and both size CSVs too), the rule's words where some are at Kα2;
   nothing else (the states, the plots, the fields, the CIFs' selector, the other CSVs)
   changed. v586: the states of an older version (the widths in points, the steps' note and
   the points held, the note of the matching across samples) read as this version reads them,
   their old fields ignored: the step note and that note gone from what the card shows (the
   step note's ×, stepX, a step of nothing, kept so that the cases' random numbers stay as
   they were); checked field by field against v584's. */
// The patterns: the fixture's, shorter (one at another step, one labelled with markup), and a standard.
const casePat = (k, n, label, color)=>{ const sc = readXrdmlScanText(new Uint8Array(xrdml(k, { n }))); return { name: 's' + k + '.xrdml', label, color, x: sc.x, y: sc.y, ...(sc.varMul ? { varMul: sc.varMul } : {}) }; };
export const CASE_PATS = [casePat(0, 900, 's0', '#3aa0ff'), casePat(1, 900, 's1', '#ff7a59'), casePat(2, 700, 'S<2> & "b"', 'red<"'), casePat(5, 900, 's5', '#5fcf6a'), casePat(11, 900, 's11', '#d4a72c')];
export const STD_PAT = 4;
const STATES = [{}, null, 'x', [], { perParams: 5, manualPeaks: 'x', removedPeaks: [5, 'x'] }, { shared: { N: 10, blWin: 150 } }, { shared: { N: 1, blWin: 40, blOn: false } },
  { shared: { N: 7, blWin: 100 }, paramMode: { N: 'per' }, perParams: [{ N: 5, blWin: 80 }, {}] }, { manualPeaks: [[30.3, 'x', null], [46.5]], removedPeaks: [[32.4]], sizeBy: 'peak', norm: 'zz' },
  { stepNote: ['N', 'q', 'blWin'], heldPts: { N: 9, blWin: 120, blOn: false }, paramMode: { N: 'per', blWin: 'per' } },
  { shared: { smoothW: -1, snipW: 0, pkHeight: 'x', pkProm: -3, pkDist: 0, K: 0, lambda: null }, sizeBy: 'x', norm: 'local' },
  { paramMode: { N: 'per', blWin: 'x', K: 'per', lambda: 'per', pkDist: 'shared' }, perParams: [{ K: 1.1, lambda: 0.709317 }, { blOn: false, snipW: 0.8 }, 7] },
  { shared: { smoothW: 0.05, snipW: 1.2, blOn: true, pkHeight: 2, pkProm: 1, pkDist: 0.1 }, norm: 'none', sizeBy: 'peak', paramMode: { pkHeight: 'shared' } }];
const TEXTS = ['0', '0.1', '0,2', '0.05', '1', '2.5', '5', '', 'abc', '-1', '1e-7', '0.3', '3', ' 0.5 ', '0.9', '1.1', '1.540598', '2,28976', '1.5406'];
const OPS = ['field', 'field', 'field', 'blon', 'chip', 'chip', 'norm', 'preset', 'step', 'del', 'del', 'add', 'add', 'reset', 'pick', 'hover', 'sizeBy', 'stepX', 'restore', 'showNext'];
// (v575) The CIFs a step gives the sample on show, and the states of the cases that choose
// them: some CIFs already, one malformed, one an older version's note held.
const TETRA = { file: 'BaTiO3_tetra.cif', cif: TETRA_CIF }, CASE_CIFS = [null, STO, TETRA];
const CIF_STATES = [...STATES, { cif: [STO, TETRA, null, STO] }, { cif: [TETRA, { file: 3 }], sizeBy: 'peak' }, { cif: [null, STO], oldGroups: true, norm: 'local' },
  { perParams: [{}, {}, {}], sizeBy: 'peak' }];
export function caseOf(n){
  const R = rng(5610 + n), u = R.u, pick = a => a[Math.floor(u()*a.length)], int = (a, b)=> a + Math.floor(u()*(b - a + 1));
  const cifs = n >= 40, ops = cifs ? [...OPS, 'cif', 'cif', 'cif', 'cif', 'sizeBy'] : OPS, states = cifs ? CIF_STATES : STATES;
  const std = u() < 0.2;
  const files = std ? (u() < 0.85 ? [STD_PAT] : []) : [0, 1, 2, 3].filter(()=> u() < 0.6).sort(()=> u() - 0.5);
  const ids = std ? ['Smooth', 'BlWin', 'PkHeight', 'PkProm', 'PkDist'] : ['Smooth', 'BlWin', 'PkHeight', 'PkProm', 'PkDist', 'K', 'Lambda'];
  const steps = Array.from({ length: 8 }, ()=>{
    const op = pick(ops);
    if (op === 'field') return [op, pick(ids), pick(TEXTS)];
    if (op === 'chip') return [op, pick(Object.keys(M.TOGGLES))];
    if (op === 'norm') return [op, pick(['global', 'local', 'none'])];
    if (op === 'preset') return [op, pick(['1.540598', '0.709317', 'custom', '1.789010'])];
    if (op === 'step') return [op, pick([-1, 1])];
    if (op === 'del' || op === 'pick') return [op, int(0, 9)];
    if (op === 'add') return [op, int(0, 40)];
    if (op === 'hover') return [op, int(0, 9), u() < 0.7];
    if (op === 'sizeBy') return [op, pick(['peak', 'sample'])];
    if (op === 'restore') return [op, pick(states)];
    if (op === 'showNext') return [op, pick([{ sel: 32.4 }, { sel: 'x' }, null])];
    if (op === 'cif') return [op, int(0, 2)];
    return [op];
  });
  return { std, files, instr: !std && u() < 0.5, state: pick(states), steps };
}
export const allCases = ()=> Array.from({ length: 60 }, (_, n)=> caseOf(n));

/* xrd-peaks.js's wiring of a case, in short: the instance's S, the fields' texts (T, with a
   width's text as written and its value, shown and exact, and each guard's last value),
   the box, the selects, the add-peak mode, the sample on show; the standard's model. */
const LAMBDA_OPTS = ['1.540598', '1.541838', '1.544426', '0.709317', '1.789010', '2.289760', 'custom'];
let caseIds = new WeakMap(), caseN = 0;
const caseId = o => o == null ? '-' : typeof o !== 'object' && typeof o !== 'function' ? typeof o + ':' + String(o) : caseIds.get(o) || (caseIds.set(o, ++caseN), caseN);
const kept = new Map();
function stdModel(){
  const f = CASE_PATS[STD_PAT], pr = M.fileParams({}, M.modeDef(true), M.sharedDef(true));
  return M.instrModelOf(M.processingOf(f, M.smoothingOf(f.x, f.y, pr), pr, [], [], U).peaks);
}
export function caseEnv(c){
  const std = c.std, fs = c.files.map(i=> CASE_PATS[i]);
  const S = { std, fields: M.fieldInputs(std), processed: [], manualPeaks: [], removedPeaks: [], perParams: [], cifs: [], paramMode: { ...M.modeDef(std) }, shared: { ...M.sharedDef(std) },
    sizeBy: 'sample', norm: 'global', panel: { sel: null, hov: null } };
  const T = { Smooth: std ? '0' : '0.25', BlWin: '5', PkHeight: '5', PkProm: '3', PkDist: '0.3', ...(std ? {} : { K: '0.9', Lambda: '1.540598' }) };
  const E = { std, fs, S, idx: 0, T, shown: {}, exact: {}, last: Object.fromEntries(Object.entries(T).map(([k, v])=> [k, parseFloat(v)])),
    blOn: true, blWinOff: false, norm: 'global', preset: '1.540598', ro: true, on: false, at: null, instr: c.instr ? stdModel() : null };
  if (!std) lambdaSync(E);
  return E;
}
const cur = E => E.std ? 0 : E.idx;
const fpOf = (E, i)=> M.fileParams(E.S.perParams[i] || {}, E.S.paramMode, E.S.shared);
function lambdaSync(E){ E.preset = M.presetOf(E.T.Lambda, LAMBDA_OPTS); E.ro = E.preset !== 'custom'; }
function writeStore(E){
  const pr = fpOf(E, cur(E));
  for (const key in E.S.fields){
    const id = E.S.fields[key];
    if (M.WIDTHS.has(key)){ E.T[id] = E.shown[id] = widthText(pr[key]*M.SHOWN[key]); E.exact[id] = pr[key]; } else E.T[id] = String(pr[key]);
  }
  E.blOn = pr.blOn; E.blWinOff = !pr.blOn;
  if (!E.std){ E.norm = E.S.norm; lambdaSync(E); }
}
function readInputs(E){
  const vals = {};
  for (const key in E.S.fields){ const id = E.S.fields[key]; vals[key] = M.fieldIn(key, E.T[id], E.shown[id], E.exact[id]); }
  M.takeInputs(E.S, cur(E), vals, E.blOn, E.fs.length);
}
// A pattern processed (kept by its keys, as the card keeps it).
function reprocessOne(E, i){
  const f = E.fs[i], { k1, k2 } = M.procKeys(f, fpOf(E, i), E.S.manualPeaks[i], E.S.removedPeaks[i], caseId), k = caseId(f.y) + '#' + k2;
  if (!kept.has(k)){ const pr = fpOf(E, i); kept.set(k, { ...M.processingOf(f, M.smoothingOf(f.x, f.y, pr), pr, E.S.manualPeaks[i], E.S.removedPeaks[i], U), k1, k2 }); }
  E.S.processed[i] = kept.get(k);
}
function reprocessAll(E){ E.S.processed = []; for (let i = 0; i < E.fs.length; i++) reprocessOne(E, i); }
function refresh(E){
  E.on = false; E.at = null;
  if (!E.fs.length){ E.S.processed = []; E.S.panel.sel = E.S.panel.hov = null; writeStore(E); return; }
  reprocessAll(E); writeStore(E);
}
function rerun(E, m){ if (E.S.paramMode[m] === 'shared') reprocessAll(E); else reprocessOne(E, cur(E)); }
function restore(E, s){
  M.takeState(E.S, M.readState(s, E.std, E.fs.length), normOf(M.objOf(s).norm));
  writeStore(E);
}
// The kept peaks of the table on show (none: no table).
function rowsOf(E){ const n = E.fs.length, i = Math.min(cur(E), n - 1), pr = E.S.processed[i]; return n && pr ? pr.peaks.filter(pk=> !pk.removed) : []; }
const GUARD = { Smooth: 0, BlWin: 1e-6, PkHeight: 0, PkProm: 0, PkDist: 0, K: 1e-6, Lambda: 1e-6 };
// A field focused (its guard takes its value), typed and applied: refused by the guard (set
// back), or stored (its text the number), then processed as the field's change does.
function typeIn(E, id, text){
  const v0 = parseFloat(String(E.T[id]).trim().replace(',', '.'));
  if (isFinite(v0)) E.last[id] = v0;
  const raw = String(text).trim().replace(',', '.'), v = parseFloat(raw);
  if (raw === '' || !isFinite(v) || v < GUARD[id]){ E.T[id] = String(E.last[id]); return; }
  E.last[id] = v; E.T[id] = String(v);
  const key = Object.keys(E.S.fields).find(k=> E.S.fields[k] === id);
  readInputs(E); writeStore(E);
  if (!E.fs.length || M.SIZE_ONLY.has(key)) return;
  if (M.PEAK_SEARCH.has(key)) M.clearRemoved(E.S, key, cur(E));
  rerun(E, M.modeOf(key));
}
export function step(E, [op, a, b]){
  const S = E.S, n = E.fs.length;
  const edited = i =>{ reprocessOne(E, i); };
  if (op === 'field') typeIn(E, a, b);
  else if (op === 'blon'){ E.blOn = !E.blOn; readInputs(E); writeStore(E); if (n) rerun(E, 'blWin'); }
  else if (op === 'chip' && !E.std){
    const key = M.TOGGLES[a], mode = M.switchMode(S, key, fpOf(E, cur(E)), n);
    writeStore(E);
    if (n && !M.SIZE_ONLY.has(key)){ if (mode === 'shared') reprocessAll(E); else reprocessOne(E, cur(E)); }
  }
  else if (op === 'norm' && !E.std){ E.norm = a; S.norm = normOf(a); }
  else if (op === 'preset' && !E.std){
    if (a === 'custom'){ E.preset = 'custom'; E.ro = false; }
    else { E.preset = a; E.ro = true; E.T.Lambda = String(parseFloat(a)); typeIn(E, 'Lambda', E.T.Lambda); }
  }
  else if (op === 'step' && !E.std && n){ E.idx = (E.idx + a + n) % n; E.on = false; E.at = null; S.panel.sel = S.panel.hov = null; writeStore(E); }
  else if (op === 'del'){ const pks = rowsOf(E); if (pks.length){ const pk = pks[a % pks.length], i = Math.min(cur(E), n - 1); M.dropPeak(S, i, pk.detPos, !!pk.manual); edited(i); } }
  else if (op === 'add'){
    // + Add peak (armed or left), a arrows from the middle of the plot's range, Enter.
    if (n && cur(E) >= 0){ E.on = !E.on; if (!E.on) E.at = null; }
    const i = cur(E), f = E.fs[i];
    if (!E.on || !f || !S.processed.length) return;
    for (let k = 0; k < a; k++) E.at = M.nudge(f.x, U.minArr(f.x), U.maxArr(f.x), E.at, 1);
    if (E.at == null) return;
    (S.manualPeaks[i] = S.manualPeaks[i] || []).push(f.x[E.at]);
    E.on = false; E.at = null; edited(i);
  }
  // (↺ is in the table's box: the click goes on to it, and the peak picked is left)
  else if (op === 'reset'){ const i = cur(E); if (E.fs[i]){ S.manualPeaks[i] = []; S.removedPeaks[i] = []; edited(i); } S.panel.sel = null; }
  else if (op === 'pick'){ const pks = rowsOf(E); if (pks.length) S.panel.sel = M.toggled(S.panel.sel, pks[a % pks.length].pos); }
  else if (op === 'hover'){ const pks = rowsOf(E); if (pks.length){ const pos = b ? pks[a % pks.length].pos : null; if (pos !== S.panel.hov) S.panel.hov = pos; } }
  else if (op === 'sizeBy' && !E.std && n && S.processed.length){
    // (a chip there is: a sample with a CIF, by peak a peak assigned)
    const V = sizeView(E, E.instr);
    if (V.A.some(Boolean) && (a === 'sample' || V.ok) && a !== S.sizeBy) S.sizeBy = a;
  }
  else if (op === 'cif' && !E.std && n) M.setCif(S, cur(E), CASE_CIFS[a]);
  else if (op === 'restore'){ restore(E, a && typeof a === 'object' ? JSON.parse(JSON.stringify(a)) : a); refresh(E); }
  else if (op === 'showNext'){ M.showNext(S.panel, a); refresh(E); }
}
/* What the card shows: its fields, their hints, the chips; the plot (its range,
   curves, marks, their colours), the table, the Caglioti box (the standard's); the Results'
   stack and its legend, the size chart (its chips, note, range, boxes, labels, names,
   legend); its CSVs, state, what it shows beside it, the add-peak mode. */
const CHART = { W: 520, H: 340, measure: t => String(t).length*5.7 + (/[iIl1]/.test(t) ? 0.3 : 0) };
export function outputs(E){
  const S = E.S, fs = E.fs, n = fs.length, ci = Math.min(cur(E), n - 1), f = fs[ci], o = {};
  o.fields = [{ ...E.T }, E.blOn, E.blWinOff, ...(E.std ? [] : [E.norm, E.preset, E.ro])];
  o.hints = ['Smooth', 'BlWin'].map(id=> M.widthHint(id, E.T[id], E.shown[id], E.exact[id], f ? meanStep(f.x) : NaN, f && f.label));
  o.chips = E.std ? null : Object.values(M.TOGGLES).map(k=> S.paramMode[k] === 'shared' ? 'all' : 'one');
  const pr = n ? S.processed[ci] : null, instr = E.std ? null : E.instr, A = n ? asgOf(E, ci) : null;
  if (!E.std){ const pool = M.cifPool(S.cifs.filter(Boolean)); o.cif = [H.cifOptionsHtml(pool, U), n ? M.poolAt(pool, S.cifs[ci]) : -1]; }
  if (pr){
    const D = M.anaOf(f, pr, fpOf(E, ci).blOn, U), pos = D.peakMarks.map(m=> m.pos);
    o.plot = [[U.minArr(f.x), U.maxArr(f.x)], dg(f.x), dg(D.raw), dg(D.smoothed), D.base ? [dg(D.dense), dg(D.base)] : null, pos, D.fwhmMarks, M.markStyles(pos, D.fwhmMarks.map(m=> m.pos), S.panel.sel, S.panel.hov)];
    const pks = pr.peaks.filter(pk=> !pk.removed);
    o.table = [(S.manualPeaks[ci] || []).length > 0 || (S.removedPeaks[ci] || []).length > 0,
      pks.length ? H.peakTableHtml(pks, { std: E.std, m: instr, fp: fpOf(E, ci), picked: S.panel.sel, st: E.std ? null : M.sampleSizes(pr, fpOf(E, ci), instr, false, U, A), A }, U) : H.NO_PEAKS];
  } else { o.plot = null; o.table = [false, '']; }
  if (E.std){ const m = n && S.processed[0] ? M.instrModelOf(S.processed[0].peaks) : null, c = H.cagliotiHtml(m, n); o.cag = [c.box, c.alert]; }
  else o.res = n && S.processed.length ? results(E, instr) : null;
  o.csv = M.csvTables('C - ', { files: fs, procs: S.processed, fps: fs.map((_, k)=> fpOf(E, k)), asg: fs.map((_, k)=> asgOf(E, k)), m: instr, norm: S.norm, std: E.std }, U).map(e=> [e.name, sha(e.text)]);
  o.state = M.stateOf(S);
  o.shows = M.showsOf(S.panel);
  o.adding = E.on;
  return o;
}
// A sample's assignment (v575: xrd-peaks.js assignOf), and what the size chart shows (sizeView).
const asgOf = (E, k)=> E.std || !E.S.processed[k] ? null : M.sampleAssign(E.fs[k], E.S.processed[k], fpOf(E, k).lambda, E.S.cifs[k]);
function sizeView(E, instr){
  const S = E.S, fs = E.fs, fps = fs.map((_, k)=> fpOf(E, k)), A = fs.map((_, k)=> asgOf(E, k));
  const byPeak = M.sizeRows('peak', fs, A, S.processed, fps, instr, U), ok = byPeak.length > 0, by = ok ? S.sizeBy : 'sample';
  const rows = by === 'peak' ? byPeak : M.sizeRows('sample', fs, A, S.processed, fps, instr, U);
  return { A, ok, by, rows, SER: M.sizeSeries(rows, M.speciesOf(A)) };
}
// A card's Results: the stack (its legend, range and traces), the size chart.
function results(E, instr){
  const S = E.S, fs = E.fs, curves = S.processed.map(pr=> pr.subtracted), shown = M.stackShown(fs, curves);
  const St = M.stackOf(fs, curves, shown, S.norm, U);
  const stack = [H.stackLegendHtml(fs, shown, U), St.range, St.traces.map(t=> [dg(fs[t.k].x), dg(t.y), fs[t.k].color, fs[t.k].label, fs[t.k].name, dg(t.norm1)])];
  const { A, ok, by, rows, SER } = sizeView(E, instr), tops = M.sizeTops(rows, SER);
  let chart = null;
  if (tops.length){
    const fit = U.barNames({ measureText: t => ({ width: CHART.measure(t) }) }, rows.map(r=> r.label), Math.max(60, CHART.W - 75), 55);
    const L = M.barLayout(rows, SER, fit, CHART.measure, CHART.W, CHART.H), ymax = M.barYmax(tops, L.frac, 0), calls = [];
    for (let k = 0; k < L.n; k++){
      const r = rows[k];
      M.seriesOf(SER, r).forEach((m, mi)=>{ const b = r[m.k + 'Box']; if (!b) return; const off = L.offOf(mi);
        calls.push(['box', k + 1, { ...b, mean: r[m.k + 'Mean'], err: r[m.k + 'Std'] }, m.color, L.hw, off, m.name], ['barLabel', k + 1, M.boxTop(b), M.sizeLab(r[m.k + 'Mean'], r[m.k + 'Std']), L.gap, off]); });
      calls.push(['tickLabel', k + 1, fit.labels[k], fit.rot, r.label, r.name]);
    }
    chart = [[0, L.n + 1, 0, ymax || 1], [L.mTop, L.bottom], calls, H.sizeLegendHtml(SER, U)];
  }
  return { stack, size: [H.sizeChipsHtml(A.filter(Boolean).length, ok, by), H.sizeNoteHtml(fs.filter((_, k)=> !A[k]).map(f=> f.label), U), chart] };
}
export function runCase(c){
  const E = caseEnv(c), out = [];
  restore(E, c.state && typeof c.state === 'object' ? JSON.parse(JSON.stringify(c.state)) : c.state);
  refresh(E);
  out.push(outputs(E));
  for (const s of c.steps){ step(E, s); out.push(outputs(E)); }
  return canon(out);
}

test('60 cases: 40 as v560\'s xrd-peaks.js gave them (v575: with the samples\' CIFs), 20 choosing CIFs (golden digests)', ()=>{
  const got = { cases: allCases().map(c=> sha(runCase(c))) };
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
