/* The GC-TCD peak integration engine (gc-tcd.js, the Integration card's), in Node: no
   browser. erfc and erfcx against scipy.special's values; the solver, a port of scipy's
   least_squares(method='trf'), on two toy problems with scipy's own answers (bounds,
   x_scale, soft_l1); a synthetic chromatogram drawn from the model itself (H2, O2, the
   system peak at 310 s and the baseline step after O2, Gaussian noise of a seeded generator
   and one electrical spike) integrated back to its areas within their sd, the step and the
   system peak too, the spike found; a window past the data's end NaN; no trapezoid any more
   (v545: neither in the method nor in a result); the curves of a window redrawn from its
   stored parameters; the raw-text reader (decimal comma, a trailing ';', a short column,
   CRLF; '.' decimals and ',' separators); the calibration line with and without intercept;
   the software's factor carried over (median of area/%mol); and the workers' pool
   (gc-tcd-pool.js) on worker_threads made to look like Web Workers: the results of one call
   each, in order, progress said, cancelled by an AbortSignal. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import * as G from '../gc-tcd.js';
import { integrateMany } from '../gc-tcd-pool.js';

const near = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tolerance ${tol})`);
const rel = (a, b, tol, what)=> assert.ok(Math.abs(a - b) <= tol*Math.abs(b), `${what}: ${a} vs ${b} (relative tolerance ${tol})`);

// A seeded generator (LCG) and its normal deviates (Box–Muller).
function normal(seed){
  let s = seed >>> 0;
  const u = ()=>{ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s + 0.5)/4294967296; };
  return ()=> Math.sqrt(-2*Math.log(u()))*Math.cos(2*Math.PI*u());
}
// A synthetic chromatogram from the model: linear baseline, the step after O2, three peaks.
const shape = (A, mu)=> ({ A, mu, sigma: 0.5, dmu: 0.35, fc: 0.25, tau1: 0.7, tau2: 4.0, w2: 0.06 });
function synth({ h2 = 2000, o2 = 800, s310 = 300, stepH = -12, noise = 1, spikeAt = 320, seed = 7, from = 250, to = 340 } = {}){
  const t = [], y = [], z = normal(seed);
  for (let i = from*5; i <= to*5; i++) t.push(i*2/10);
  const P = [shape(h2, 287.0), shape(o2, 302.0), shape(s310, 310.1)];
  const peaks = P.map(p=> G.peakShape(t, p));
  t.forEach((ti, i)=>{
    y.push(-5000 + 0.8*(ti - 297) + G.step(ti, stepH, 305.6, 0.8) + peaks[0][i] + peaks[1][i] + peaks[2][i] + noise*z());
  });
  if (spikeAt != null) y[t.indexOf(spikeAt)] += 150;
  return { t, y };
}

test('erfc and erfcx: scipy.special values, relative error within 1e-15 (1e-14 for erfcx below −1, 1e-13 for erfc past 4)', ()=>{
  const erfc = [[0, 1.0], [0.25, 0.7236736098317631], [0.5, 0.4795001221869535], [1, 0.15729920705028516], [2, 0.004677734981047266],
    [3.5, 7.430983723414129e-07], [5, 1.5374597944280347e-12], [10, 2.0884875837625446e-45], [26, 5.663192408856145e-296],
    [-0.3, 1.3286267594591274], [-1, 1.8427007929497148], [-3, 1.9999779095030015]];
  for (const [x, v] of erfc) rel(G.erfc(x), v, x > 4 ? 1e-13 : 1e-15, `erfc(${x})`);
  const erfcx = [[0, 1.0], [0.25, 0.770346547730997], [0.5, 0.6156903441929258], [1, 0.427583576155807], [3, 0.17900115118138998],
    [4.5, 0.12248480427384142], [10, 0.05614099274382259], [30, 0.018795888861416754], [1e3, 0.0005641893014533876],
    [1e8, 5.641895835477563e-09], [-0.5, 1.952360489182557], [-2, 108.94090438997797], [-5, 144009798674.66104]];
  for (const [x, v] of erfcx) rel(G.erfcx(x), v, x < -1 ? 1e-14 : 1e-15, `erfcx(${x})`);
  assert.equal(G.erfc(-40), 2);
  assert.equal(G.erfc(40), 0);
  assert.ok(Number.isNaN(G.erfcx(NaN)));
});

test('the peak model: each EMG and each peak of area 1 by A; the stable branch where the exponential would overflow', ()=>{
  const t = Array.from({ length: 40001 }, (_, i)=> 250 + i*0.005);
  const trap = y =>{ let s = 0; for (let i = 1; i < y.length; i++) s += (y[i] + y[i - 1])/2*0.005; return s; };
  near(trap(G.emg(t, 280, 0.5, 0.8)), 1, 1e-9, 'EMG area');
  near(trap(G.emg(t, 280, 0.2, 30)), 1 - Math.exp(-170/30 + 0.5*(0.2/30)**2), 1e-6, 'EMG with a long tail, cut at 450 s');
  near(trap(G.peakShape(t, shape(123.4, 290))), 123.4, 1e-6, 'peak area');
  // far left of a narrow peak with a short tail: no NaN, no Infinity
  const v = G.emg([0, 100, 279, 1000], 280, 0.15, 0.01);
  assert.ok(Array.from(v).every(Number.isFinite), String(v));
  const p = G.physical([10, 290, Math.log(0.5), 0.6, 0.2, Math.log(2), Math.log(3), 0.1]);
  assert.deepEqual(Object.keys(p), ['A', 'mu', 'sigma', 'dmu', 'fc', 'tau1', 'tau2', 'w2']);
  near(p.sigma, 0.5, 1e-15, 'sigma'); near(p.dmu, 0.3, 1e-15, 'dmu'); near(p.tau1, 1, 1e-15, 'tau1'); near(p.tau2, 2.5, 1e-15, 'tau2');
});

test('the solver: scipy least_squares(trf) answers on toy problems, with bounds, x_scale and soft_l1', ()=>{
  // Rosenbrock with a lower bound on x2 (scipy's documentation example), analytic Jacobian.
  const f = x=> Float64Array.from([10*(x[1] - x[0]**2), 1 - x[0]]);
  const j = x=> Float64Array.from([-20*x[0], 10, -1, 0]);
  const r = G.leastSquaresTrf(f, j, [2, 2], [-Infinity, 1.5], [Infinity, Infinity]);
  near(r.x[0], 1.2243707490009201, 1e-9, 'x1'); near(r.x[1], 1.5, 1e-9, 'x2');
  rel(r.cost, 0.025213093946805685, 1e-9, 'cost');
  assert.equal(r.nfev, 9); assert.equal(r.status, 2); assert.ok(r.success);
  // An exponential with outliers, bounds and x_scale, ordinary and soft_l1 (f_scale 0.1).
  const t = Array.from({ length: 15 }, (_, i)=> i*10/14);
  const y = [2.5, 1.4790833191139061, 0.9793020728835515, 3.7346383321885015, 0.6148652385352347, 0.556231319497944, 0.5275275734661008,
    0.513475893998171, -1.4934029884881217, 0.5032295119636412, 0.5015809806462399, 0.5007739558892877, 4.500378883650466, 0.500185479331028, 0.500090799859525];
  const g = x=> Float64Array.from(t, (ti, i)=> x[0] + x[1]*Math.exp(x[2]*ti) - y[i]);
  const gj = x=>{ const J = new Float64Array(45); t.forEach((ti, i)=>{ const e = Math.exp(x[2]*ti); J[3*i] = 1; J[3*i + 1] = e; J[3*i + 2] = x[1]*ti*e; }); return J; };
  const opts = { xScale: [1, 2, 0.5], fScale: 0.1 };
  const lin = G.leastSquaresTrf(g, gj, [1, 1, 0], [0, 0, -5], [5, 5, 0], { ...opts, loss: 'linear' });
  [0.7678624507900623, 1.6965399655513116, -0.5937051257536733].forEach((v, i)=> near(lin.x[i], v, 1e-7, 'linear x' + i));
  rel(lin.cost, 13.455108895416467, 1e-9, 'linear cost');
  assert.deepEqual([lin.nfev, lin.status], [26, 2], 'scipy: nfev 26, status 2');
  const rob = G.leastSquaresTrf(g, gj, [1, 1, 0], [0, 0, -5], [5, 5, 0], { ...opts, loss: 'soft_l1' });
  [0.502239448859636, 1.987780629511948, -0.9558431385557129].forEach((v, i)=> near(rob.x[i], v, 1e-7, 'soft_l1 x' + i));
  rel(rob.cost, 0.869453393478017, 1e-8, 'soft_l1 cost');
  assert.deepEqual([rob.nfev, rob.status], [11, 2], 'scipy: nfev 11, status 2');
  assert.throws(()=> G.leastSquaresTrf(f, j, [2, 1], [-Infinity, 1.5], [Infinity, Infinity]), /outside of provided bounds/);
});

test('a synthetic chromatogram: H2, O2, the system peak and the step recovered, the spike found and left out', ()=>{
  const { t, y } = synth();
  const r = G.integrateChromatogram(t, y);
  const w = r.windows[0];
  assert.equal(w.key, 'H2O2');
  assert.ok(w.ok, 'converged');
  assert.deepEqual(w.spikes, [320], 'the spike, by its time');
  assert.deepEqual(w.excluded, []);
  // the noise is the window's (MAD of the differences, peaks' flanks included): above the true 1
  assert.ok(w.noise > 0.8 && w.noise < 2.5, `noise ${w.noise}`);
  near(w.rms, 1, 0.12, 'rms of the residuals'); rel(w.chi2r, (w.rms/w.noise)**2, 1e-12, 'chi2r');
  const [h2, o2, s310] = w.peaks;
  assert.deepEqual(w.peaks.map(p=> [p.name, p.gas]), [['H2', 'h2'], ['O2', 'o2'], ['S310', null]]);
  for (const [pk, A] of [[h2, 2000], [o2, 800], [s310, 300]]){
    assert.ok(pk.sd > 0 && pk.sd < 10, `${pk.name} sd ${pk.sd}`);
    near(pk.area, A, 4*pk.sd, pk.name + ' area');
  }
  // the apex: the argmax of the fitted unit shape on a 0.02 s grid, against the true shape's
  const fine = Array.from({ length: 2001 }, (_, i)=> 280 + i/100), v = G.peakShape(fine, shape(1, 287.0));
  near(h2.tApex, fine[v.indexOf(Math.max(...v))], 0.03, 'H2 apex');
  near(w.steps[0].h, -12, 1.5, 'step height'); near(w.steps[0].t0, 305.6, 0.5, 'step position');
  // the compact result: gases, and nothing long
  assert.deepEqual(Object.keys(r.gases).sort(), ['h2', 'o2']);
  assert.equal(r.gases.h2.area, h2.area); assert.equal(r.gases.o2.sd, o2.sd); assert.equal(r.gases.h2.chi2r, w.chi2r);
  // (v545: the trapezoids gone, from the result and from the method)
  assert.deepEqual(Object.keys(r.gases.h2).sort(), ['area', 'chi2r', 'sd', 'tApex', 'window']);
  assert.ok(!('trapezoid' in G.DEFAULT_METHOD) && !('roundsTrapezoid' in G.DEFAULT_METHOD.fit.spikes) && !('trapezoid' in G));
  const json = JSON.stringify(r);
  assert.ok(json.length < 4000, `compact: ${json.length} characters`);
  assert.deepEqual(JSON.parse(json).windows[0].p, w.p);
  // the curves, redrawn from the stored parameters, on the points the fit used
  const c = G.windowCurves(t, y, G.DEFAULT_METHOD, JSON.parse(json).windows[0]);
  assert.deepEqual(c.dropped, { t: [320], y: [y[t.indexOf(320)]], kind: ['spike'] });
  assert.equal(c.t.length + 1, t.filter(v=> v >= 268 && v <= 326).length);
  const rms = Math.sqrt(c.residual.reduce((s, v)=> s + v*v, 0)/c.residual.length);
  rel(rms, w.rms, 1e-12, 'rms of the redrawn residual');
  c.t.forEach((ti, i)=> near(c.model[i], c.base[i] + c.peaks.H2[i] + c.peaks.O2[i] + c.peaks.S310[i], 1e-9, 'model = base + peaks'));
});

test('no H2, a weak O2: H2 near zero within its sd; a window past the data’s end gives NaN', ()=>{
  const { t, y } = synth({ h2: 0, o2: 60, s310: 250, spikeAt: null, seed: 11 });
  const r = G.integrateChromatogram(t, y);
  assert.ok(Math.abs(r.gases.h2.area) < 5*r.gases.h2.sd + 1, `H2 ${r.gases.h2.area} ± ${r.gases.h2.sd}`);
  near(r.gases.o2.area, 60, 5*r.gases.o2.sd, 'O2');
  const cut = t.findIndex(v=> v > 320);
  const s = G.integrateChromatogram(t.slice(0, cut), y.slice(0, cut));
  assert.ok(Number.isNaN(s.gases.h2.area) && Number.isNaN(s.gases.o2.sd) && Number.isNaN(s.gases.h2.tApex));
  assert.equal(s.windows[0].p, null); assert.equal(s.windows[0].beyondData, true);
  // blanks (NaN) at the end of a column are left out, as the Python does
  const yb = y.slice(); for (let i = cut; i < yb.length; i++) yb[i] = NaN;
  assert.ok(Number.isNaN(G.integrateChromatogram(t, yb).gases.o2.area));
});

test('spikes: one point far from its neighbours is found, a peak’s apex is not', ()=>{
  const z = normal(3);
  const y = Array.from({ length: 300 }, (_, i)=> 2*z() + 400*Math.exp(-0.5*((i - 150)/2.5)**2));
  y[60] += 80;
  const sp = G.findSpikes(y, null, { rounds: 6 });
  assert.deepEqual([...sp.keys()].filter(i=> sp[i]), [60]);
});

test('readTcd: decimal comma, a trailing ";", a short column, CRLF; "." decimals with "," or tab separators', ()=>{
  const text = '0;-7,5;12,25;;\r\n0,2;-7,25;12,5;3;\r\n0,4;-7;12,75;;\r\n0,6;-6,75;;;\r\n';
  const d = G.readTcd(text);
  assert.deepEqual(d.t, [0, 0.2, 0.4, 0.6]);
  assert.equal(d.cols.length, 3, 'the column blank throughout but one value kept; the trailing one dropped');
  assert.deepEqual(d.cols[0], [-7.5, -7.25, -7, -6.75]);
  assert.deepEqual(d.cols[1].slice(0, 3), [12.25, 12.5, 12.75]);
  assert.ok(Number.isNaN(d.cols[1][3]), 'a column ending early: NaN after its end');
  assert.deepEqual(d.cols[2].map(v=> Number.isNaN(v) ? null : v), [null, 3, null, null]);
  const e = G.readTcd('0,-7.5,12.25\n0.2,-7.25,12.5\n');
  assert.deepEqual(e, { t: [0, 0.2], cols: [[-7.5, -7.25], [12.25, 12.5]] });
  assert.deepEqual(G.readTcd('﻿time\tA\n0\t1.5\n0.2\t2.5\n'), { t: [0, 0.2], cols: [[1.5, 2.5]] });
  assert.ok(G.readTcd('').error);
  assert.ok(G.readTcd('a;b\nc;d\n').error);
  assert.match(G.readTcd('0;1\n0,2;2\n0;3\n').error, /does not increase/);
});

test('fitCalibration: least squares with and without intercept, R², the residuals', ()=>{
  const pts = [{ conc: 0.5, area: 5100 }, { conc: 1, area: 10050 }, { conc: 2, area: 20200 }, { conc: 5, area: 49800 }, { conc: 10, area: 100300 }];
  const a = G.fitCalibration(pts);
  const mx = 3.7, my = 37090, Sxx = pts.reduce((s, q)=> s + (q.conc - mx)**2, 0), Sxy = pts.reduce((s, q)=> s + (q.conc - mx)*(q.area - my), 0);
  near(Sxx, 61.8, 1e-9, 'Sxx');
  rel(a.slope, Sxy/Sxx, 1e-12, 'slope'); rel(a.intercept, my - mx*Sxy/Sxx, 1e-9, 'intercept');
  assert.equal(a.n, 5);
  assert.ok(a.r2 > 0.9999 && a.r2 < 1);
  a.residuals.forEach((q, i)=>{ near(q.fitted, a.slope*pts[i].conc + a.intercept, 1e-9, 'fitted'); near(q.relDev, (q.area - q.fitted)/q.fitted, 1e-15, 'relDev'); });
  const z = G.fitCalibration(pts, { zeroIntercept: true });
  const sxy = pts.reduce((s, q)=> s + q.conc*q.area, 0), sxx = pts.reduce((s, q)=> s + q.conc*q.conc, 0);
  rel(z.slope, sxy/sxx, 1e-14, 'slope through 0'); assert.equal(z.intercept, 0);
  assert.ok(z.r2 <= a.r2);
  const exact = G.fitCalibration([{ conc: 1, area: 2 }, { conc: 2, area: 4 }, { conc: 3, area: 6 }, { conc: NaN, area: 1 }], { zeroIntercept: true });
  assert.deepEqual([exact.slope, exact.r2, exact.n], [2, 1, 3]);
  assert.ok(Number.isNaN(G.fitCalibration([{ conc: 1, area: 2 }]).slope), 'one point: no line with an intercept');
});

test('transferK: the median of area/%mol over the injections at or above the threshold, at least minCount of them', ()=>{
  const tab = [0.001, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
  const areas = tab.map((v, i)=> v*67600*(1 + (i % 3 - 1)*0.01));
  const k = G.transferK(areas, tab, { minValue: 0.02, minCount: 10 });
  assert.deepEqual(Object.keys(k), ['k', 'n']);
  assert.equal(k.n, 11);
  const r = tab.map((v, i)=> areas[i]/v).filter((_, i)=> tab[i] >= 0.02).sort((a, b)=> a - b);
  assert.equal(k.k, r[5]);
  assert.equal(G.transferK(areas, tab, { minValue: 0.02, minCount: 12 }), null);
  const withNaN = areas.slice(); withNaN[12] = NaN;
  assert.equal(G.transferK(withNaN, tab, { minValue: 0.02, minCount: 10 }).n, 10, 'a NaN area left out');
});

// worker_threads made to look like a module Web Worker for the pool
const workerUrl = new URL('../gc-tcd.worker.js', import.meta.url).href;
const shim = `const { parentPort, workerData } = require('node:worker_threads');
globalThis.self = { addEventListener(t, f){ if (t === 'message') parentPort.on('message', d=> f({ data: d })); }, postMessage(d){ parentPort.postMessage(d); } };
import(workerData.url);`;
const makeWorker = ()=>{
  const w = new NodeWorker(shim, { eval: true, workerData: { url: workerUrl } }), map = new Map();
  return { postMessage: d=> w.postMessage(d),
    addEventListener(type, fn){ const g = type === 'message' ? d=> fn({ data: d }) : e=> fn({ message: e.message }); map.set(fn, [type, g]); w.on(type, g); },
    removeEventListener(type, fn){ const v = map.get(fn); if (v){ w.off(v[0], v[1]); map.delete(fn); } },
    terminate: ()=> w.terminate() };
};

test('the pool: chromatograms over workers, the results of one call each in order, progress, cancel', async ()=>{
  const runs = [synth({ seed: 1 }), synth({ h2: 500, seed: 2, spikeAt: null }), synth({ h2: 0, o2: 300, seed: 3 }), synth({ o2: 1500, seed: 4, spikeAt: null })];
  const t = runs[0].t, cols = runs.map(r=> r.y);
  const seen = [];
  const out = await integrateMany(t, cols, { workers: 2, makeWorker, onProgress: (done, total, k)=> seen.push([done, total, k]) });
  assert.equal(out.results.length, 4);
  out.results.forEach((res, k)=> assert.deepEqual(res, G.integrateChromatogram(t, cols[k]), 'chromatogram ' + k));
  assert.deepEqual(seen.map(s=> s[0]), [1, 2, 3, 4]); assert.ok(seen.every(s=> s[1] === 4));
  assert.deepEqual(seen.map(s=> s[2]).sort(), [0, 1, 2, 3]);
  const ac = new AbortController();
  const many = Array.from({ length: 12 }, (_, i)=> runs[i % 4].y);
  await assert.rejects(integrateMany(t, many, { workers: 2, makeWorker, signal: ac.signal, onProgress: done=>{ if (done === 1) ac.abort(); } }), e=> e.name === 'AbortError');
  const pre = new AbortController(); pre.abort();
  await assert.rejects(integrateMany(t, many, { makeWorker, signal: pre.signal }), e=> e.name === 'AbortError');
  assert.deepEqual(await integrateMany(t, [], { makeWorker }), { results: [], ms: [], wall: 0 });
});
