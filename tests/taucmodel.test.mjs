/* DRS's calculations (tauc-model.js) and its words and markup that need no page
   (tauc-html.js), in Node: no browser (v556). The window scan and its fit on the data
   themselves, E_g from the two Tauc fits and E_U, each error against the delta method
   taken by finite differences, the Tauc baseline's part of the subtracted slope's error
   against its derivatives taken so, the curves over the points that have a value, the
   suggestion's edge; a file read (the standard format, the Cary's %R, a header naming its
   columns, points left out, a file refused) and the reflectance from F(R); a card's
   parameters and lines (all and one, values that are no number, a project's to v514 by its
   fields' ids, v515 to v519's widths in eV as points, a file taken back in, the all/one
   toggle, the fields, the suggestion), the references, the cards of a project from before
   them, the Results' words, series and ranges; the cards' markup and alerts, every label
   escaped. Then the fixtures as v555's page analysed them (its CSVs, every byte, at two
   steps of a session: two spectra and the Tauc card; four and an Urbach card read against
   it), and 36 cases (random spectra, saved states, suggestions, a reference, the CSVs) as
   v555's tauc.js gave them, run from its source on a page of stubs: their digests in
   tests/golden/taucmodel.json (npm run test:update writes them anew after a change meant
   to alter them). utils.js's and modkit.js's helpers, which need a page to load, are taken
   from their source as they stand there. Under two seconds. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { rng, drsCsv, caryCsv } from './fixtures.mjs';
import { decodeText } from '../textdata.js';
import * as M from '../tauc-model.js';
import * as H from '../tauc-html.js';

const UPDATE = !!process.env.UPDATE_GOLDEN || process.env.npm_lifecycle_event === 'test:update';
const GOLDEN = new URL('./golden/taucmodel.json', import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');

// A declaration of the page's modules as it stands there: a function to its closing brace,
// a const to the next line at the margin.
function decl(file, name){
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  let i = src.search(new RegExp(`^(export )?function ${name}\\(`, 'm'));
  if (i >= 0){
    let k = src.indexOf('{', i), d = 0;
    for (; k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    return src.slice(i, k + 1).replace(/^export /, '');
  }
  i = src.search(new RegExp(`^(export )?const ${name} = `, 'm'));
  assert.ok(i >= 0, name + ' in ' + file);
  return src.slice(i, i + src.slice(i).search(/\n(?=\S)/)).replace(/^export /, '');
}
const UN = ['movingAverage', 'gradientArr', 'maxArr', 'minArr', 'fitLinear', 'betacf', 'logGamma', 'betainc', 'tcdf', 'tinv', 'linspace', 'fmtNum', 'csvField', 'csvJoin', 'csvLine', 'esc'];
const KN = ['isObj', 'isArr', 'num', 'ownKey', 'without', 'finitePairs', 'wideCsv'];
// (the CSVs' settings as a fresh page has them)
const PAGE = new Function('settings', UN.map(n=> decl('utils.js', n)).join('\n') + '\n' + KN.map(n=> decl('modkit.js', n)).join('\n') +
  `\nreturn { ${[...UN, ...KN].join(', ')} };`)({ decimal: '.', field: ';' });
const U = Object.fromEntries(['movingAverage', 'gradientArr', 'maxArr', 'minArr', 'fitLinear', 'tinv', 'linspace', 'fmtNum', 'csvLine', 'wideCsv', 'isObj', 'num', 'ownKey', 'without', 'finitePairs'].map(k=> [k, PAGE[k]]));
const HU = { esc: PAGE.esc, plotWrap: (id, o)=> `<div class="plot-wrap"><svg id="${id}"></svg>${o.extra || ''}</div>`, snavHtml: o=> `<span class="snav" id="${o.idx}"></span>` };
const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
const axis = (a, step, n)=> Array.from({ length: n }, (_, i)=> a + i*step);
// A canonical dump: every number by its shortest round-trip string, NaN, ±∞ and −0 too.
const canon = v => JSON.stringify(v, (k, x)=> typeof x === 'number' ? (Object.is(x, -0) ? '#-0' : '#' + x) : x);

/* A card's panel as tauc.js makePanel composes the model, with no page: its state P, a
   sample's parameters and lines, its fits and what its kind makes of them (an Urbach
   card's subtracted fit off its reference `ref`, its suggestion off the reference's Tauc
   region), the suggestion, a file taken back in, the state saved and read back. */
function panel(kind, files, ref = null){
  const base = kind === 'tauc' ? M.TAUC : M.URBACH;
  const spec = kind === 'tauc' ? base : { ...base, suggest: i => M.urbachLines(U, ref ? M.taucWindow(ref.analyze(i).regs, files[i].hv) : null, files[i].hv) };
  const curve = (i, p)=>{ const f = files[i], hv = f.hv, Yraw = f.FR.map((v, k)=> spec.curve(v, hv[k], p)); return { Yraw, Ys: M.smoothY(U, Yraw, p.N) }; };
  const curves = (i, p)=>{ const c = curve(i, p); return { hv: files[i].hv, ...c, dYs: M.slopeOf(U, c.Ys, files[i].hv, p.N2) }; };
  const P = { mode: 'shared', shared: { ...spec.defaults }, sharedVlines: {}, per: [], suggested: false };
  return Object.assign(P, {
    spec,
    params: i => M.paramsOf(spec, P, i),
    vlinesFor: i => M.vlinesFor(U, spec, P, files, i),
    analyze(k){
      const p = P.params(k), vl = P.vlinesFor(k), c = curve(k, p), fits = M.fitsOf(U, spec, p, vl, c, files[k].hv);
      if (kind === 'tauc') return { ...M.taucEg(U, fits[0], fits[1], p.M, p.M2), regs: fits[0], regs2: fits[1], fits };
      let sub = null;
      if (ref && files[k]){ const r = ref.analyze(k).regs2, tp = ref.params(k); sub = M.subtracted(U, r, tp.a, tp.M2, files[k], p, vl); }
      return { ...M.urbachEu(U, fits[0], p.M), regs: fits[0], sub, fits };
    },
    autoSuggestAll: ()=> M.autoSuggestAll(U, spec, P, files, curves),
    suggestAt: i => M.suggestAt(U, spec, P, files, i, curves),
    back: (v, f)=> M.backEntry(U, spec, P, v, f),
    fit: ()=> M.fitPer(P, files),
    snapshot: ()=> M.panelSnapshot(P),
    restore: s => M.restorePanel(U, spec, P, s, files),
    csvs: n =>{ const fits = files.map((f, k)=> P.analyze(k)); return (kind === 'tauc' ? M.taucCsvs : M.urbachCsvs)(U, n, files, k=> P.params(k), fits); },
  });
}
// A file as the page loads it: read from its bytes, named, its energies made.
const loaded = (name, buf)=>{ const d = M.readDrs(decodeText(new Uint8Array(buf))); return M.withHv({ name, label: name.replace(/\.[^.]+$/, ''), ...d }); };

test('the window scan and its fit, E_g and E_U and their errors by the delta method, the curves over the points with a value, the edge', ()=>{
  const hv = axis(1, 0.01, 201);
  // An exact line: the fit gives it back, on M points, R² 1.
  const line = hv.map(x=> 2*x - 3), r = M.scanRegr(U, hv, line, 25, 1.5, 2.5);
  near(r.slope, 2, 1e-9, 'slope'); near(r.intercept, -3, 1e-9, 'intercept');
  near(r.R2, 1, 1e-12, 'R²');
  assert.deepEqual([r.n, r.bestIdx.length, hv[r.bestIdx[0]] >= 1.5 - 1e-12], [25, 25, true]);
  assert.equal(M.scanRegr(U, hv, line, 300, 1, 3).bestIdx.length, 0, 'fewer points than the window: none');
  // A flat stretch then a steep edge: the window on the edge (NRMSE over the window's range).
  const kink = hv.map((x, i)=> (x < 2 ? 0.01*x : 5*(x - 2) + 0.02) + (i % 2 ? 0.001 : -0.001));
  assert.ok(hv[M.scanRegr(U, hv, kink, 20, 1, 3).bestIdx[0]] >= 2, 'the steep part');
  // The window chosen on the smoothed curve, the line fitted to the data inside it; a point
  // with no value left out of both (the window reaches past it), or, strict, blocking it.
  const noisy = line.map((v, i)=> v + (i % 2 ? 0.01 : -0.01)), sm = M.smoothY(U, noisy, 3), holed = noisy.slice();
  holed[100] = NaN;
  const g = M.scanRegr(U, hv, M.smoothY(U, holed, 3), 25, 1.8, 2.2, holed);
  assert.ok(!g.bestIdx.includes(100) || g.n === 24, 'the point with no value left out');
  const s1 = M.scanRegr(U, hv, sm, 25, 1.5, 2.5, noisy);
  assert.ok(s1.n === 25 && Math.abs(s1.slope - 2) < 0.01 && s1.varM > 0);
  const st = hv.map((x, i)=> i % 10 === 5 ? NaN : x);
  assert.equal(M.scanRegr(U, hv, st, 12, 1, 3, null, true).bestIdx.length, 0, 'strict: no window of 12 without a point with no value');
  assert.equal(M.scanRegr(U, hv, st, 9, 1, 3, null, true).bestIdx.length, 9);
  // onFinite: the points with no value stay so, the others averaged with their neighbours that have one.
  assert.deepEqual(M.smoothY(U, [1, 2, NaN, 4, 5], 3).map(v=> Number.isNaN(v) ? 'x' : v), [1.5, 7/3, 'x', 11/3, 4.5]);
  assert.deepEqual(M.onFinite([1, NaN, 3], [0, 1, 2], (y, x)=> y.map((v, i)=> v + x[i])).map(v=> Number.isNaN(v) ? 'x' : v), [1, 'x', 5]);

  // E_g and its errors against the delta method (finite differences on the fits' parameters).
  const fitOn = (m, b, a, n, s)=>{ const R = rng(s), xs = axis(a, 0.01, n), ys = xs.map(x=> m*x + b + 0.05*R.n()); return { ...M.scanRegr(U, xs, ys, n, a, a + n), _x: xs }; };
  const t1 = fitOn(4, -8, 2.2, 30, 1), t2 = fitOn(0.3, 0.1, 1.2, 60, 2), eg = M.taucEg(U, t1, t2, 30, 60);
  near(eg.EgInt, (t2.intercept - t1.intercept)/(t1.slope - t2.slope), 1e-12, 'E_g on the baseline');
  near(eg.Eg, -t1.intercept/t1.slope, 1e-12, 'E_g on the x-axis');
  const T = (r, M_)=> U.tinv(M.T_Q, (r.n || M_) - 2);
  const delta = (f, ps, covs)=>{ const h = 1e-6, J = ps.map((p, i)=>{ const a = ps.slice(), b = ps.slice(); a[i] += h; b[i] -= h; return (f(a) - f(b))/(2*h); });
    return Math.sqrt(covs.reduce((t, [i, j, c])=> t + J[i]*J[j]*c, 0)); };
  const cov = (r, o, t)=> [[o, o, r.varM*t*t], [o+1, o+1, r.varB*t*t], [o, o+1, r.covMB*t*t], [o+1, o, r.covMB*t*t]];
  near(eg.EgIntErr, delta(([m1, b1, m2, b2])=> (b2 - b1)/(m1 - m2), [t1.slope, t1.intercept, t2.slope, t2.intercept], [...cov(t1, 0, T(t1, 30)), ...cov(t2, 2, T(t2, 60))]), 1e-7, 'E_g (baseline) error');
  near(eg.EgErr, delta(([m, b])=> -b/m, [t1.slope, t1.intercept], cov(t1, 0, T(t1, 30))), 1e-7, 'E_g (x-axis) error');
  const eu = M.urbachEu(U, t1, 30);
  assert.equal(eu.Eu, 1/t1.slope);
  near(eu.EuErr, Math.sqrt(t1.varM)/(t1.slope**2)*T(t1, 30), 1e-15, 'E_U\'s error');
  assert.deepEqual(M.xCross(U, { slope: 0, intercept: 1 }, 5), { x: NaN, err: NaN });
  assert.deepEqual(M.invSlope(U, { slope: NaN }, 5), { v: NaN, err: NaN });
  assert.equal(M.fmtE(3.14159, 0.0123, 'eV'), '3.142 ± 0.012 eV');
  assert.equal(M.fmtE(0.0761, NaN, 'meV', 1, 1000), '76.1 meV');
  assert.equal(M.fmtE(NaN, 1, 'eV'), '-');

  // The Tauc baseline's part of the subtracted slope's error: its derivatives exact, against
  // finite differences of the slope fitted on the same points.
  const f1 = loaded('drs1.csv', drsCsv({ Eg: 3.2 })), Fh = f1.hv, FR = f1.FR, ta = 0.5;
  const base = { slope: 0.02, intercept: 0.12, varM: 1e-6, varB: 4e-6, covMB: -1.5e-6, n: 100 };
  const sb = M.subtracted(U, base, ta, 100, f1, { N: 1, M: 25 }, { v1: 2.6, v2: 3.15 });
  assert.ok(isFinite(sb.regs.slope) && sb.EuErrBase > 0 && sb.inside > 25 && !sb.blocked);
  const idx = sb.regs.bestIdx.filter(i=> isFinite(sb.Yraw[i]));
  const slopeAt = ([m, b])=> U.fitLinear(idx.map(i=> Fh[i]), idx.map(i=>{ const y = m*Fh[i] + b; return Math.log(FR[i] - (y > 0 ? Math.pow(y, 1/ta)/Fh[i] : 0)); })).slope;
  const want = delta(slopeAt, [base.slope, base.intercept], cov(base, 0, T(base, 100)));
  near(M.subBaselineSlopeErr(U, sb.regs, sb.Yraw, base, ta, Fh, FR, 100), want, 1e-6*want, 'the baseline\'s part');
  near(sb.EuErr, Math.hypot(sb.EuErrFit, sb.EuErrBase), 1e-15, 'in quadrature');
  // A baseline above F(R) between the lines: no fit, the card told why.
  const high = M.subtracted(U, { ...base, intercept: 5 }, ta, 100, f1, { N: 1, M: 25 }, { v1: 2.6, v2: 3.15 });
  assert.ok(high.blocked && high.lost > 0 && !isFinite(high.regs.slope));
  assert.equal(M.subtracted(U, { slope: NaN, intercept: 1 }, ta, 100, f1, { N: 1, M: 25 }, { v1: 2.6, v2: 3.15 }), null);
  // The suggestion's edge (second derivative) on the fixture: inside the absorption edge.
  const p = { N: 1, N2: 20 }, Y = FR.map((v, k)=> Math.pow(v*Fh[k], 0.5)), Ys = M.smoothY(U, Y, 1);
  const e = M.curvatureEdge(U, { hv: Fh, dYs: M.slopeOf(U, Ys, Fh, 20) }, p);
  assert.ok(e.v1 > 2.6 && e.v1 < 3.2 && e.v2 > 3.2 && e.v2 < 4.6, JSON.stringify(e));
  assert.equal(M.curvatureEdge(U, { hv: [1, 2, 3], dYs: [1, 2, 3] }, p), null, 'too few points');
});

test('a file read: the standard format, the Cary\'s %R, a header naming its columns, points left out, refused; the reflectance', ()=>{
  const d = M.readDrs(drsCsv({ Eg: 3.2 }).toString('utf8'));
  assert.deepEqual([d.wl.length, d.warn, d.read, d.head, d.label, d.left], [551, false, undefined, undefined, undefined, undefined]);
  const c = caryCsv({ name: 'S1' }), cr = M.readDrs(c.buffer.toString('utf8'));
  assert.deepEqual([cr.label, cr.read, cr.warn, cr.wl.length], ['S1', 'R%', false, 1201]);
  cr.FR.forEach((F, i)=> near(M.reflOf(F), c.R[i], 1e-9, 'R back'));
  const ns = M.readDrs('Wavelength (nm);R (%)\n350;50\n351;105\n352;0\n353;NaN\n-5;40\n354;60\n');
  assert.deepEqual([ns.wl, ns.warn, ns.read, ns.left], [[350, 354], true, 'R%', { r: 1, zero: 1, inf: 1, wl: 1 }]);
  assert.deepEqual(M.fileNotes(ns), ['not a standard format: its header names the reflectance in %, read as %R', '4 points left out (1 with a wavelength not above 0, 1 with R outside 0–100 %, 1 with R = 0 %, where F(R) is infinite, 1 with a value that is no finite number)']);
  assert.deepEqual(M.readDrs('Wavelength,F(R)\n350,0.5\n351,0.6\n'), { wl: [350, 351], FR: [0.5, 0.6], warn: true, head: true });
  assert.deepEqual(M.readDrs('350,0.5\n351,0.6\n'), { error: 'no header naming its columns: the wavelength in nm, and F(R) or %R' });
  assert.deepEqual(M.readDrs('Wavelength (eV),F(R)\n3.5,0.5\n'), { error: 'its header names the wavelength in another unit than nm (Wavelength (eV))' });
  assert.deepEqual(M.readDrs('Wavelength,F(R),%R\n350,0.5,40\n'), { error: 'which columns to read cannot be told: its header names both F(R) and %R' });
  assert.deepEqual(M.readDrs('Wavelength,F(R)\n350,-1\n'), { error: 'no point with a physical value: 1 point left out (1 with F(R) < 0)' });
  // A file a project holds: its points with a finite number and a wavelength above 0, its
  // notes as they were (a field of no kind left out).
  const g = M.restoredFile(U, { name: 'x', wl: [350, -1, 351, 352], FR: [0.5, 0.4, NaN, 0.6], warn: true, head: true, left: { neg: 2, zz: 3, r: 'x' }, hv: [1] });
  assert.deepEqual(g, { name: 'x', wl: [350, 352], FR: [0.5, 0.6], warn: true, head: true, left: { neg: 2 } });
  assert.equal(M.restoredFile(U, { wl: [-1], FR: [1] }), null);
  assert.ok(Number.isNaN(M.reflOf(-0.1)));
  near(M.reflOf((1 - 0.4)**2/(2*0.4)), 40, 1e-12, 'R of F(R)');
  assert.equal(M.withHv({ wl: [1239.842] }).hv[0], 1);
});

test('a card\'s parameters and lines: all and one, values that are no number, v514\'s fields, v515 to v519\'s widths in eV, a file taken back in, the toggle, the fields, the suggestion', ()=>{
  const files = [loaded('drs1.csv', drsCsv({ Eg: 3.2 })), loaded('drs2.csv', drsCsv({ Eg: 2.9, A: 45, seed: 4 }))];
  const T = panel('tauc', files);
  T.restore({ mode: 'per', shared: { a: 2, N: 'x', M: 1 }, sharedVlines: { v1: 2, v2: 3, v3: 1.5, v4: 1.9 }, per: [{ N: 4, M2: 1e9, vlines: { v1: 2.5 } }, 'q'] });
  assert.deepEqual(T.snapshot(), { mode: 'per', shared: { a: 2, N: 1, N2: 20, M: 25, M2: 100 }, sharedVlines: { v1: 2, v2: 3, v3: 1.5, v4: 1.9 }, per: [{ N: 4, M2: 1e9, vlines: undefined }, { vlines: undefined }], suggested: true });
  assert.deepEqual([T.params(0), T.params(1)], [{ a: 2, N: 4, N2: 20, M: 25, M2: 1e9 }, { a: 2, N: 1, N2: 20, M: 25, M2: 100 }]);
  assert.deepEqual(Object.keys(T.vlinesFor(0)), ['v1', 'v2', 'v3', 'v4'], 'one mode: the sample\'s own default lines');
  // To all: the common set the sample's on show; to one: each sample from it.
  M.switchMode(U, T.spec, T, files, 0);
  assert.equal(T.mode, 'shared'); assert.equal(T.shared.N, 4); assert.equal(T.sharedVlines, T.vlinesFor(1));
  M.switchMode(U, T.spec, T, files, 1);
  assert.deepEqual([T.per[1].N, T.per[1].vlines], [4, T.sharedVlines]);
  M.storeValues(T, 1, M.fieldValues(T.spec.keys, k=> ({ a: '0.5', N: '2.6', N2: 'x', M: '1', M2: '80' })[k]));
  assert.deepEqual(T.params(1), { a: 0.5, N: 3, N2: 1, M: 2, M2: 80 });
  // v514's fields by their ids (a project from before all/one).
  T.restore({ params: { A: '2', N: '4', N2: 'x', M: '30', M2: '-1' } });
  assert.deepEqual(T.shared, { a: 2, N: 4, N2: 20, M: 30, M2: 100 });
  // v515 to v519's widths in eV: v515's defaults v514's, a smoothing over the middle step.
  T.restore({ shared: { a: 0.5, w: 0, w2: 0.15, W: 0.2, W2: 0.5 } });
  assert.deepEqual(T.shared, M.TAUC_DEF);
  const midStep = f =>{ const E = f.hv.slice().sort((a, b)=> a - b), m = E.length >> 1; return (E[m+1] - E[m-1])/2; };
  T.restore({ shared: { w: 0.03, w2: 0.15, W: 0.25, W2: 0.5 }, sharedVlines: { v1: 2.95, v2: 3.6, v3: 2.1, v4: 2.85 } });
  assert.equal(T.shared.N, Math.max(1, Math.round(M.median(files.map(f=> 0.03/midStep(f))))));
  assert.ok(Number.isInteger(T.shared.M) && T.shared.M >= 2 && T.shared.N2 === 20 && T.shared.M2 === 100, JSON.stringify(T.shared));
  // A file taken back in: its entry, in eV, as points at its spectrum in one mode, dropped in all.
  assert.deepEqual(T.back({ N: 3, W: 0.2, vlines: { v1: 1 } }, files[0]), { N: 3, vlines: { v1: 1 } });
  T.mode = 'per';
  assert.deepEqual(Object.keys(T.back({ W: 0.25 }, files[0])).sort(), ['M', 'vlines']);
  // The suggestion: one set for all (the edges' union, the baseline below the lowest), each its own in one.
  const A = panel('tauc', files);
  A.autoSuggestAll();
  const own = files.map((f, i)=> M.suggestOne(U, A.spec, A, files, i, (j, p)=>{ const c = { Yraw: f.FR.map((v, k)=> Math.pow(v*f.hv[k], p.a)) }; c.Ys = M.smoothY(U, c.Yraw, p.N); return { hv: f.hv, ...c, dYs: M.slopeOf(U, c.Ys, f.hv, p.N2) }; }));
  assert.deepEqual(A.sharedVlines, { v1: Math.min(own[0].v1, own[1].v1), v2: Math.max(own[0].v2, own[1].v2), v3: Math.min(own[0].v1, own[1].v1) - 0.85, v4: Math.min(own[0].v1, own[1].v1) - 0.1 });
  assert.equal(A.suggested, true);
  // An Urbach card's lines: from 1 eV under the middle of its reference's region to its start; none, at rest.
  const W = panel('urbach', files, A);
  W.autoSuggestAll();
  const w0 = M.taucWindow(A.analyze(0).regs, files[0].hv);
  assert.deepEqual(W.per[0].vlines, { v1: (w0[0] + w0[1])/2 - 1, v2: w0[0] });
  assert.deepEqual(M.urbachLines(U, null, [1, 2, 3]), { v1: 1.5, v2: 2.5 });
  assert.equal(M.taucWindow({ bestIdx: [] }, [1]), null);
});

test('the references, a project from before the cards, the Results\' words, series and ranges', ()=>{
  const recs = [{ id: 1, type: 'urbach', ref: 3, refAuto: false }, { id: 2, type: 'tauc' }, { id: 3, type: 'urbach', ref: null, refAuto: true },
    { id: 4, type: 'urbach', ref: 2, refAuto: false }, { id: 5, type: 'tauc' }, { id: 6, type: 'urbach', ref: 2, refAuto: true }];
  const by = id => recs.find(a=> a.id === id) || null;
  assert.deepEqual(M.fixRefs(recs, by).map(a=> a.id), [1, 3, 6]);
  assert.deepEqual(recs.map(a=> [a.ref, a.refAuto]), [[null, true], [undefined, undefined], [2, true], [2, false], [undefined, undefined], [5, true]]);
  assert.deepEqual(M.legacyAnalyses({ params: { taucA: '2', taucUN: '9' }, mode: 'per', egSel: ['b'], urbachOn: true }),
    [{ id: 1, type: 'tauc', egSel: ['b'], states: { tauc: { mode: 'per', shared: undefined, sharedVlines: undefined, vlines: undefined, per: undefined, suggested: undefined, params: { A: '2' } } } },
     { id: 2, type: 'urbach', states: { urbach: {} } }]);
  assert.deepEqual(M.readAnalysis(U, { egSel: ['z'], ref: 2.5, refAuto: 0, states: { tauc: { per: [1, 2, 3] }, urbach: 5, gone: {}, constructor: {} } }, new Set([1])),
    { ref: null, refAuto: true, egSel: ['x', 'b'], states: { tauc: { per: [1, 3] } } });
  assert.equal(M.taucName([2, 2]), 'Tauc: allowed direct');
  assert.equal(M.taucName([2, 0.5]), 'Tauc');
  assert.deepEqual(M.taucLabels([2/3, 2/3]), { aLabel: '2/3', egLabel: 'Direct', title: 'Forbidden Direct Energy Band Gap' });
  assert.deepEqual(M.taucLabels([2, 0.5]), { aLabel: 'a', egLabel: '', title: 'Energy Band Gap' });
  const fits = [{ Eg: 3, EgErr: 0.1, EgInt: 3.1, EgIntErr: 0.2, Eu: 0.05, EuErr: 0.001, sub: null }, { Eg: -1, EgErr: NaN, EgInt: NaN, EgIntErr: NaN, Eu: 0.08, EuErr: 0.002, sub: { Eu: 0.07, EuErr: 0.003 } }];
  assert.deepEqual(M.egSeries(fits, ['b']).map(s=> [s.key, s.vals, s.errs]), [['b', [3.1, NaN], [0.2, NaN]]]);
  assert.deepEqual(M.euSeries(fits).map(s=> [s.key, s.vals.map(v=> +v.toFixed(9))]), [['p', [50, 80]], ['s', [NaN, 70]]]);
  assert.equal(M.noSubWhy(false, fits), 'No Tauc reference: nothing to subtract');
  assert.equal(M.noSubWhy(true, [{ sub: null }]), "The Tauc reference's baseline has no fit: nothing to subtract");
  // The plain curves ranged in full, the subtracted from their regions up, at the 5th percentile.
  const ys = [axis(0, 1, 101), null], hvs = [axis(1, 0.01, 101)];
  assert.deepEqual(M.urbachRange(ys, hvs, true, ()=> 0), [-5, 105]);
  const from = M.urbachRange(ys, hvs, false, ()=> 1.5), v = ys[0].filter((y, i)=> hvs[0][i] >= 1.5);
  near(from[0], v[Math.floor(0.05*(v.length - 1))] - 0.05*(100 - v[Math.floor(0.05*(v.length - 1))]), 1e-12, 'from the region up, its 5th percentile');
  assert.deepEqual(M.urbachRange([null], [], true, ()=> 0), [-0.05, 1.05]);
  assert.deepEqual(M.logRange([[NaN]]), [-1.04, 0.04]);
  assert.deepEqual(M.curveRange(U, M.TAUC, [0, 2, NaN]), [0, 2.1]);
  assert.deepEqual(M.curveRange(U, M.URBACH, [-1, 1]), [-1.1, 1.1]);
  assert.deepEqual(M.curveTraces(U, M.TAUC, { Yraw: [0, 1], Ys: [0, 2], dYs: [5, 7] }).map(t=> t.ys), [[0, 1], [0, 2], [0, 2]]);
  assert.equal(M.windowFit(M.TAUC.windows[0], { v1: 1, v2: 2 }, [1, 1.5, 2, 3], [0, NaN, 1, 1], { M: 2 }, 'fit'), 'fit');
  assert.equal(M.windowFit(M.TAUC.windows[0], { v1: 2, v2: 1 }, [1, 1.5, 2, 3], [0, NaN, 1, 1], { M: 3 }, 'fit'), null);
  assert.equal(M.statText({ R2: 0.98765 }, 'R2'), '0.9877'); assert.equal(M.statText(null, 'R2'), '-');
});

test('the cards\' markup and alerts, every label escaped', ()=>{
  const t = H.cardBody({ id: 4, type: 'tauc' }, HU), u = H.cardBody({ id: 5, type: 'urbach' }, HU);
  for (const id of ['an4Svg', 'an4A', 'an4N', 'an4N2', 'an4M', 'an4M2', 'an4ModeAll', 'an4Eg', 'an4EgInt', 'an4Alert', 'an4Suggest', 'an4NExp', 'an4Idx']) assert.ok(t.includes(`id="${id}"`), id);
  assert.equal((t.match(/<option /g) || []).length, 4);
  for (const id of ['an5Ref', 'an5EuS', 'an5LegSub', 'an5LegSubFit', 'an5LegBand', 'an5RMSE1s']) assert.ok(u.includes(`id="${id}"`), id);
  assert.ok(!u.includes('an5A"') && !u.includes('an5M2'));
  const rt = H.resHtml({ id: 4, type: 'tauc' }, HU), ru = H.resHtml({ id: 5, type: 'urbach' }, HU);
  assert.ok(rt.includes('id="an4EgSel"') && rt.includes('id="an4BarTitle"') && !rt.includes('an4R3'));
  assert.ok(['R1', 'R2', 'R3', 'R4', 'RS', 'RA4'].every(k=> ru.includes(`id="an5${k}"`)) && ru.includes('cap-row'));
  assert.ok(H.taucInfo('<b>x</b>').endsWith(' <b>x</b>') && H.urbachInfo('Y').includes('E<sub>U</sub> = 1 / slope'));
  assert.equal(H.readNote({ read: 'R%', warn: false }, HU), '<span title="second column read as the reflectance in %, converted to F(R)">%R</span>');
  assert.equal(H.readNote({ warn: true }, HU), '<span title="second column read as F(R), with no header naming it">F(R)</span>');
  assert.equal(H.readNote({ warn: true, head: true }, HU), '<span title="the F(R) column its header names, read as F(R); not a standard format">F(R)</span>');
  assert.equal(H.negWarnHtml([{ label: '<i>a' }, { label: 'b' }], [-1, 2], 'E<sub>g</sub>', HU), '<div class="alert warn">⚠ Negative E<sub>g</sub> for:<br>&lt;i&gt;a</div>');
  assert.equal(H.negWarnHtml([{ label: 'b' }], [NaN], 'x', HU), '');
  assert.match(H.blockedHtml({ lost: 3, inside: 40, neg: 1 }), /at 3 of the 40 points between the lines with F\(R\) > 0,/);
  assert.match(H.TOO_SMALL, /Interval too small/);
  assert.equal(H.sup('2/3'), '<tspan baseline-shift="super" font-size="8">2/3</tspan>');
});

/* ---- The fixtures as v555's page analysed them ----
   Two spectra dropped (the Tauc card's lines suggested on both), then the Cary's %R export
   and a file of no standard format with points left out, then an Urbach card added (its
   lines suggested on the Tauc card's regions): every CSV the page wrote, as v555 wrote it
   (golden.page: their SHA-256, taken on v555's page). */
function nonStandard(){
  const d = drsCsv({ Eg: 3.0, A: 50, seed: 9 }).toString('utf8').split('\n'), rows = ['Wavelength (nm);R (%)'];
  d.slice(2).filter(Boolean).forEach((r, i)=>{
    const [w, f] = r.split(','), F = +f, R = 100/(1 + F + Math.sqrt(F*F + 2*F));
    let v = R.toFixed(6).replace('.', ',');
    if (i === 10) v = '105'; if (i === 20) v = '0'; if (i === 30) v = 'NaN';
    rows.push((i === 40 ? '-5' : w) + ';' + v);
  });
  return Buffer.from(rows.join('\n') + '\n');
}
function pageSession(){
  const files = [loaded('drs1.csv', drsCsv({ Eg: 3.2 })), loaded('drs2.csv', drsCsv({ Eg: 2.9, A: 45, seed: 4 }))];
  const T = panel('tauc', files), out = {};
  T.fit(); T.autoSuggestAll();
  const name = 'Tauc allowed indirect', all = ()=> [...M.spectraCsvs(U, files), ...T.csvs(name)];
  out.two = all();
  files.push(loaded('cary.csv', caryCsv({ name: 'Cary S1', Eg: 3.05 }).buffer), loaded('nonstd.csv', nonStandard()));
  T.fit();
  const W = panel('urbach', files, T);
  W.fit(); W.autoSuggestAll();
  out.four = [...all(), ...W.csvs('Urbach · ' + name)];
  return out;
}

/* ---- Cases as v555's tauc.js gave them ----
   Random spectra (steps of 0.5 to 2 nm, either way, a point of F(R) ≤ 0 now and then), a
   saved state (all or one, values that are no number, widths in eV), the suggestion or a
   sample's, a reference for the Urbach card, a file taken back in: every state, fit and
   CSV, each case's digest (tests/golden/taucmodel.json). `mk(kind, files, ref)` a card's
   panel (here panel() above). */
function cases(){
  const R = rng(556), u = R.u, n = R.n, pick = a => a[Math.floor(u()*a.length)], ri = (a, b)=> a + Math.floor(u()*(b - a + 1));
  const spectrum = k =>{
    const step = pick([1, 2, 0.5, 1.5]), w0 = pick([200, 250, 300]), w1 = pick([700, 800]), Eg = 2.4 + u()*1.2, A = 20 + u()*60, Eu = 0.04 + u()*0.12;
    const base = pick([0.05, 0.002, 0.3]), noise = pick([0.0005, 0.005, 0.02]), wl = [], FR = [];
    for (let w = w0; w <= w1; w += step){ const e = 1239.842/w; let F = base + (e > Eg ? A*(e - Eg)**2/e : 0) + 0.02*Math.exp(Math.min(0, e - Eg)/Eu) + noise*n(); if (u() < 0.01) F = -0.01; wl.push(w); FR.push(F); }
    if (u() < 0.3){ wl.reverse(); FR.reverse(); }
    return { name: 's' + k + '.csv', label: 's' + k, wl, FR };
  };
  const params = keys => Object.fromEntries(keys.filter(()=> u() < 0.8).map(k=> [k, k === 'a' ? pick([0.5, 2, 2/3, 1/3, 'x']) : pick([ri(1, 9), ri(2, 60), ri(2, 150), 0, 'y', null])]));
  const ev = keys => Object.fromEntries(keys.filter(k=> k !== 'a' && u() < 0.5).map(k=> [M.EV[k], pick([0, 0.03, 0.15, 0.2, 0.5, 0.1, -1])]));
  const lines = (keys, f)=>{ if (u() < 0.15) return pick([null, {}]); const lo = Math.min(...f.wl.map(x=> 1239.842/x)), hi = Math.max(...f.wl.map(x=> 1239.842/x)); return Object.fromEntries(keys.map(k=> [k, lo + u()*(hi - lo)])); };
  const state = (S, files)=> ({ mode: pick(['shared', 'per']), shared: { ...params(S.keys), ...(u() < 0.4 ? ev(S.keys) : {}) }, sharedVlines: lines(S.lineKeys, files[0]),
    per: files.map(f=> u() < 0.1 ? null : { ...params(S.keys), ...(u() < 0.3 ? ev(S.keys) : {}), vlines: lines(S.lineKeys, f) }), suggested: pick([true, false, undefined]) });
  return Array.from({ length: 36 }, (_, c)=>{
    const files = Array.from({ length: ri(1, 3) }, (_, k)=> spectrum(c*10 + k));
    return { files, tauc: state(M.TAUC, files), urbach: state(M.URBACH, files), suggest: pick(['all', 'one', 'none']), at: ri(0, files.length - 1), ref: u() < 0.75,
      back: { ...params(M.TAUC.keys), ...ev(M.TAUC.keys), vlines: { v1: 2.5, v2: 3, v3: 1.8, v4: 2.2 } }, backFile: spectrum(c*10 + 9) };
  });
}
function runCase(c, mk){
  const files = c.files.map(f=> M.withHv({ ...f })), out = [];
  const T = mk('tauc', files), W = mk('urbach', files, c.ref ? T : null);
  T.restore(JSON.parse(JSON.stringify(c.tauc))); W.restore(JSON.parse(JSON.stringify(c.urbach)));
  const look = ()=> out.push([T.snapshot(), W.snapshot(), files.map((f, k)=> [T.params(k), T.vlinesFor(k), T.analyze(k), W.params(k), W.vlinesFor(k), W.analyze(k)])]);
  look();
  if (c.suggest === 'all'){ T.autoSuggestAll(); W.autoSuggestAll(); }
  else if (c.suggest === 'one'){ T.suggestAt(c.at); W.suggestAt(c.at); }
  look();
  const bf = M.withHv({ ...c.backFile });
  out.push(T.back(JSON.parse(JSON.stringify(c.back)), bf), W.back(JSON.parse(JSON.stringify(c.back)), bf));
  out.push(T.csvs('t'), W.csvs('u'));
  return canon(out);
}

test('the fixtures as v555\'s page analysed them, and 36 cases as v555\'s tauc.js gave them (golden digests)', ()=>{
  const s = pageSession(), page = {};
  for (const [k, list] of Object.entries(s)) page[k] = list.map(e=> [e.name, sha(e.text)]);
  const got = { page, cases: cases().map(c=> sha(runCase(c, (kind, files, ref)=> panel(kind, files, ref)))) };
  // (the session's first Eg.csv to the digit, as tests/drspoints.test.mjs has it from v514)
  assert.equal(s.two.find(e=> e.name.endsWith(' - Eg.csv')).text, 'Sample;Eg;Eg_err;Eg_baseline;Eg_baseline_err\ndrs1;3.158072;0.007588;3.218936;0.005341\ndrs2;2.888253;0.000516;2.946766;0.000525\n');
  if (UPDATE){ fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); return; }
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(got.page, want.page, 'the CSVs as v555\'s page wrote them');
  const off = got.cases.map((h, i)=> h === want.cases[i] ? null : i).filter(i=> i !== null);
  assert.deepEqual(off, [], 'cases whose digest differs');
  assert.equal(got.cases.length, want.cases.length);
});
