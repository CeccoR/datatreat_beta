/* The smoothing by a width (smooth.js), in Node, no browser: the box mean of the line through
   the points against today's moving average (utils.js movingAverage, read from its source:
   utils.js needs a page to load) — the same for an even N at w = N steps, an odd N's
   ⅛ / ⅞ end weights, the ends cut short; against the integral itself on uneven x, x
   running down, points at one x; w = 0 the data as they are; the weights the FWHM's
   uncertainty is carried through (boxWeights) as the box's, and as the moving average's for
   an even N; the field's texts; a value that is no number left out of the line, the others
   smoothed as without it. And XRPD's SNIP by its half-width (xrd-peaks.js computeBaseline, read from
   its source): on an uneven grid the line at x ± k·step, as the definition reads it, point
   for point, the 2θ read once, at the cost of the even grid's passes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxSmooth, boxWeights, meanStep, widthText, ptsNum, ptsText } from '../smooth.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UTILS = fs.readFileSync(path.join(ROOT, 'utils.js'), 'utf8');
// A function of utils.js as it stands there.
const fromUtils = name =>{
  const m = UTILS.match(new RegExp(`function ${name}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`));
  assert.ok(m, `${name} in utils.js`);
  return new Function(`return ${m[0]}`)();
};
const movingAverage = fromUtils('movingAverage');
// XRPD's SNIP as xrd-peaks.js has it (a module of a page: its function cut out by its braces).
const computeBaseline = (()=>{
  const src = fs.readFileSync(path.join(ROOT, 'xrd-peaks.js'), 'utf8'), i = src.indexOf('function computeBaseline(');
  assert.ok(i >= 0, 'computeBaseline in xrd-peaks.js');
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++){ if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
  return new Function('meanStep', `${src.slice(i, k + 1)}\nreturn computeBaseline;`)(meanStep);
})();

// Seeded noise, a peak on a slope: 2000 points at 0.013°, as an XRPD scan.
function rng(seed){ let x = seed; return ()=> (x = (x*1103515245 + 12345) % 2147483648)/2147483648; }
function pattern(n = 2000, step = 0.013, seed = 7){
  const r = rng(seed), x = Array.from({ length: n }, (_, i)=> 10 + i*step);
  return { x, step, y: x.map(t=> 1000*Math.exp(-(((t - 20)/0.2)**2)) + 50 - 0.5*t + 30*r()) };
}
const maxDiff = (a, b, from = 0, to = a.length)=>{ let m = 0; for (let i = from; i < to; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
// The mean of the line through the points over [a, b], by brute force (many trapezoids).
function lineMean(x, y, a, b){
  const s = x[x.length-1] < x[0] ? -1 : 1, X = x.map(v=> s*v);
  const at = t =>{ let k = 0; while (k < X.length - 2 && X[k+1] <= t) k++; const d = X[k+1] - X[k]; return d > 0 ? y[k] + (y[k+1] - y[k])*(t - X[k])/d : y[k]; };
  const M = 4000; let sum = 0;
  for (let j = 0; j < M; j++) sum += at(a + (b - a)*(j + 0.5)/M);
  return sum/M;
}

test('an even N: the moving average of N + 1 points, half-weight ends, at w = N steps (to rounding); the ends cut short', ()=>{
  const { x, y, step } = pattern();
  for (const N of [2, 4, 10, 20, 40]){
    const ma = movingAverage(y, N), bx = boxSmooth(x, y, N*step), h = N/2;
    assert.ok(maxDiff(ma, bx, h, y.length - h) < 1e-9, `N ${N}: interior ${maxDiff(ma, bx, h, y.length - h)}`);
    // Within w/2 of an end the line stops at the end point, which counts half: they differ there.
    assert.ok(maxDiff(ma, bx, 0, h) > 1e-6, `N ${N}: the start differs`);
  }
});

test('an odd N: the box edges mid-cell, weights (1/8, 7/8, 1, …, 1, 7/8, 1/8)/N', ()=>{
  const { x, y, step } = pattern();
  for (const N of [3, 5, 9, 11]){
    const i = 1000, w = boxWeights(x, i, N*step), h = (N - 1)/2;
    assert.equal(w.size, N + 2, `N ${N}: N + 2 points`);
    for (let k = i - h - 1; k <= i + h + 1; k++){
      const want = (Math.abs(k - i) === h + 1 ? 1/8 : Math.abs(k - i) === h ? 7/8 : 1)/N;
      assert.ok(Math.abs(w.get(k) - want) < 1e-9, `N ${N}, point ${k - i}: ${w.get(k)} against ${want}`);
    }
    // and so not the moving average of N points: it differs in the interior
    assert.ok(maxDiff(movingAverage(y, N), boxSmooth(x, y, N*step), N, y.length - N) > 1e-3, `N ${N} differs`);
  }
});

test('any spacing: the mean of the line over [x − w/2, x + w/2] cut to the data, on uneven x', ()=>{
  const r = rng(3), x = [0];
  for (let i = 1; i < 300; i++) x.push(x[i-1] + 0.002 + 0.03*r());
  const y = x.map(t=> Math.sin(3*t) + 0.2*r());
  for (const w of [0.01, 0.07, 0.5, 30]){
    const s = boxSmooth(x, y, w);
    for (const i of [0, 1, 7, 150, 298, 299]){
      const a = Math.max(x[0], x[i] - w/2), b = Math.min(x[299], x[i] + w/2);
      assert.ok(Math.abs(s[i] - lineMean(x, y, a, b)) < 1e-5, `w ${w}, point ${i}: ${s[i]} against ${lineMean(x, y, a, b)}`);
    }
  }
});

test('x running down: the same smoothing, point for point; two points at one x weigh nothing', ()=>{
  const { x, y } = pattern(500);
  const up = boxSmooth(x, y, 0.13), down = boxSmooth(x.slice().reverse(), y.slice().reverse(), 0.13).reverse();
  assert.ok(maxDiff(up, down) < 1e-9);
  const xs = [0, 1, 1, 2, 3], ys = [0, 1, 5, 2, 3], s = boxSmooth(xs, ys, 1);
  assert.ok(s.every(Number.isFinite), JSON.stringify(s));
  // the window round x = 0.5 covers the cell [0, 1] alone: the line from 0 to 1
  assert.ok(Math.abs(boxSmooth([0, 1, 1, 2], [0, 1, 5, 2], 0.5)[0] - 0.125) < 1e-12);
});

test('w = 0 (or below, or no number): the data as they are, in an array of their own', ()=>{
  const { x, y } = pattern(100);
  for (const w of [0, -1, NaN, undefined]){
    const s = boxSmooth(x, y, w);
    assert.deepEqual(s, y);
    assert.notEqual(s, y);
    assert.deepEqual([...boxWeights(x, 5, w)], [[5, 1]]);
  }
  assert.deepEqual(boxSmooth([1], [4], 1), [4]);
});

test('the weights (fwhmSigma\'s): summing to 1, giving boxSmooth\'s value, and the moving average\'s for an even N', ()=>{
  const { x, y, step } = pattern(400);
  const r = rng(5), xu = [0]; for (let i = 1; i < 400; i++) xu.push(xu[i-1] + 0.005 + 0.02*r());
  for (const [X, w] of [[x, 0.13], [x, 0.05], [xu, 0.1], [xu.slice().reverse(), 0.1], [x, 100]]){
    const s = boxSmooth(X, y, w);
    for (const i of [0, 1, 3, 200, 398, 399]){
      const W = boxWeights(X, i, w);
      let sum = 0, v = 0;
      W.forEach((wt, k)=>{ sum += wt; v += wt*y[k]; assert.ok(wt > 0); });
      assert.ok(Math.abs(sum - 1) < 1e-12, `sum ${sum}`);
      assert.ok(Math.abs(v - s[i]) < 1e-9, `point ${i}: ${v} against ${s[i]}`);
    }
  }
  // N = 10 (0.13° at a 0.013° step): N + 1 points, the ends at half weight, over N
  const W = boxWeights(x, 200, 10*step);
  assert.equal(W.size, 11);
  for (let k = 195; k <= 205; k++) assert.ok(Math.abs(W.get(k) - (Math.abs(k - 200) === 5 ? 0.5 : 1)/10) < 1e-9);
});

test('the step and the field\'s texts', ()=>{
  assert.equal(meanStep([10, 10.5, 11, 12]), 2/3);
  assert.equal(meanStep([3, 2, 1]), 1);
  assert.ok(Number.isNaN(meanStep([1])));
  assert.equal(widthText(10*70/5383), '0.13');
  assert.equal(widthText(150*70/5383), '1.951');
  assert.equal(widthText(0), '0');
  assert.equal(widthText(NaN), '');
  assert.equal(ptsNum(9.997), '10');
  assert.equal(ptsNum(3.846), '3.8');
  assert.equal(ptsNum(154.2), '154');
  assert.equal(ptsText(10.23), '≈ 10 pts');
  assert.equal(ptsText(1.02), '≈ 1 pt');
  assert.equal(ptsText(0.38), '≈ 0.38 pts');
});

test('a value that is no number: left out of the line, the others smoothed as without it, itself as it is', ()=>{
  const x = Array.from({ length: 40 }, (_, i)=> i), y = x.map(t=> Math.sin(t/4)), w = 4;
  for (const [bx, by] of [[x, y.map((v, i)=> i === 10 ? NaN : v)], [x.map((v, i)=> i === 10 ? NaN : v), y], [x, y.map((v, i)=> i === 10 ? Infinity : v)]]){
    const s = boxSmooth(bx, by, w), keep = x.map((_, i)=> i).filter(i=> i !== 10), ref = boxSmooth(keep.map(i=> x[i]), keep.map(i=> y[i]), w);
    assert.ok(Object.is(s[10], by[10]), `the point itself: ${s[10]}`);
    keep.forEach((i, j)=> assert.ok(Math.abs(s[i] - ref[j]) < 1e-12, `point ${i}: ${s[i]} against ${ref[j]}`));
  }
  // (the moving average of 4 lost the 5 values about it)
  assert.equal(movingAverage(y.map((v, i)=> i === 10 ? NaN : v), 4).filter(v=> !Number.isFinite(v)).length, 5);
  assert.deepEqual(boxSmooth([0, 1, 2], [NaN, NaN, 3], 1), [NaN, NaN, 3]);
});

test('the SNIP by a half-width: on an uneven grid the line at x ± k·step, as defined, the 2θ read once, at the even grid\'s cost', ()=>{
  // The definition: k from K down to 1, each point (in order) clipped down to the mean of
  // the line, as clipped so far, at x ± k·step, where both are within the pattern (none
  // past n steps).
  function snipRef(x, y, W){
    const n = y.length, step = meanStep(x), K = Math.min(n, Math.max(1, Math.round(W/step) || 1)), z = Float64Array.from(y);
    const s = x[n-1] < x[0] ? -1 : 1, u = x.map(v=> s*v);
    const cell = t =>{ let lo = 0, hi = n - 2; while (lo < hi){ const m = (lo + hi + 1) >> 1; if (u[m] <= t) lo = m; else hi = m - 1; } return lo; };
    const L = t =>{ const k = cell(t), d = u[k+1] - u[k]; return d > 0 ? z[k] + (z[k+1] - z[k])*(t - u[k])/d : z[k]; };
    for (let k = K; k >= 1; k--) for (let i = 0; i < n; i++){
      const a = u[i] - k*step, b = u[i] + k*step;
      if (a < u[0] || b > u[n-1]) continue;
      const avg = (L(a) + L(b))/2;
      if (avg < z[i]) z[i] = avg;
    }
    return Array.from(z);
  }
  const r = rng(11), grids = [];
  for (const n of [3, 4, 9, 60, 701]){
    const x = Array.from({ length: n }, (_, i)=> 10 + 0.013*i);
    grids.push(['listed', x.map(v=> +v.toFixed(2))], ['a point out', x.filter((_, i)=> i !== (n >> 1))], ['running down', x.slice().reverse().map(v=> +v.toFixed(3))], ['uneven', x.map((v, i)=> v + 0.005*r()*(i % 3))]);
  }
  for (const [what, x] of grids){
    const y = x.map(t=> 100 + 900*Math.exp(-(((t - x[x.length >> 1])/0.05)**2)) + 30*r());
    for (const W of [0.01, 0.05, 0.3, 2, 1e6]){
      const z = computeBaseline(x, y, W), ref = snipRef(x, y, W);
      assert.ok(z.every((v, i)=> Object.is(v, ref[i])), `${what}, ${x.length} points, W ${W}`);
    }
  }
  // 5384 listed positions (to 1e-4), the half-width 150°: the 2θ read once, not in every
  // pass, and about the time of the even grid's passes (not 40 times it: every pass reading
  // the 2θ again and running from the first point, up to K = n passes).
  const n = 5384, st = 70/(n - 1), xe = Array.from({ length: n }, (_, i)=> 10 + st*i), xl = xe.map(v=> +v.toFixed(4));
  const y = xe.map(t=> 100 + 1000*Math.exp(-(((t - 40)/0.2)**2)) + 30*r());
  let reads = 0;
  const xp = new Proxy(xl, { get(t, k, rc){ if (typeof k === 'string' && /^\d+$/.test(k)) reads++; return Reflect.get(t, k, rc); } });
  assert.deepEqual(computeBaseline(xp, y, 150), computeBaseline(xl, y, 150));
  assert.ok(reads <= 2*n + 8, `the 2θ read ${reads} times`);
  const time = (x, rep = 3)=>{ let best = Infinity; for (let k = 0; k < rep; k++){ const t0 = performance.now(); computeBaseline(x, y, 150); best = Math.min(best, performance.now() - t0); } return best; };
  const te = time(xe), tl = time(xl);
  assert.ok(tl < 12*te + 20, `listed positions ${tl.toFixed(0)} ms, an even grid ${te.toFixed(0)} ms`);
});
