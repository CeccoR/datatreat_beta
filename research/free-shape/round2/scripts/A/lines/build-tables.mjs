/* The size-line tables of Track A (b): for each reduced shape, the TCH line's (g, l) in
   1/⟨L⟩_V, by the two moments (mom) and by weighted least squares (lsq: |x| ≤ 6, b = 0.2),
   and the max deviation of each from the exact line (peak = 1). Grids: ball (one), cylinder
   ψ = 0…90° every 0.5°, box β, γ = 0…1 every 0.025 (symmetric, filled both ways).
   node build-tables.mjs [--b 0.2 --X 6 --out tables.json] */
import fs from 'node:fs';
import { ballA, boxA, cylA, reduce, sample, maxDev, momentsGL, lsqGL, pvGL } from './profiles.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1];
const so = { b: +(opt.b || 0.2), X: +(opt.X || 6) };
const t0 = Date.now();
function entry(sol, p0){
  const red = reduce(sol), S = sample(red, so), m = momentsGL(red), L = lsqGL(red, so, p0);
  return { Lv: red.Lv, LaV: red.LaV, mom: [m.g, m.l], lsq: [L.g, L.l], devMom: maxDev(S, x=> pvGL(x, m.g, m.l)), devLsq: maxDev(S, x=> pvGL(x, L.g, L.l)), c: L.c };
}
const out = { sampling: so, ball: entry(ballA()), cyl: { stepDeg: 0.5, n: 181, e: [] }, box: { step: 0.025, n: 41, e: [] } };
let prev = null;
for (let i = 0; i < 181; i++){ const e = entry(cylA(i*0.5*Math.PI/180), prev); out.cyl.e.push(e); prev = e.lsq; }
const n = 41, B = Array.from({ length: n }, ()=> new Array(n));
for (let i = 0; i < n; i++){
  let pr = i ? B[i - 1][0].lsq : null;
  for (let j = 0; j <= i; j++){ const e = entry(boxA(i/(n - 1), j/(n - 1)), j ? B[i][j - 1].lsq : pr); B[i][j] = e; B[j][i] = e; }
}
out.box.e = B;
const ms = Date.now() - t0;
fs.writeFileSync(opt.out || 'tables.json', JSON.stringify(out));
const all = [out.ball, ...out.cyl.e, ...B.flat()];
const rng = k => [Math.min(...all.map(e=> e[k])), Math.max(...all.map(e=> e[k]))].map(x=> x.toFixed(3)).join('–');
console.log(`tables in ${ms} ms; devMom ${rng('devMom')}, devLsq ${rng('devLsq')}; Lv ${rng('Lv')}, La/Lv ${rng('LaV')}`);
console.log('ball', JSON.stringify(out.ball));
for (const d of [0, 10, 20, 30, 40, 44, 45, 46, 50, 60, 70, 80, 90]){ const e = out.cyl.e[d*2]; console.log('cyl', d, e.lsq.map(x=> x.toFixed(4)).join(' '), e.mom.map(x=> x.toFixed(4)).join(' '), e.devLsq.toFixed(3)); }
for (const [i, j] of [[0, 0], [10, 0], [20, 0], [40, 0], [20, 20], [40, 20], [40, 40], [30, 10]]){ const e = B[i][j]; console.log('box', i/40, j/40, e.lsq.map(x=> x.toFixed(4)).join(' '), e.mom.map(x=> x.toFixed(4)).join(' '), e.devLsq.toFixed(3)); }
