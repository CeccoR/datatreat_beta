/* How far apart the exact size lines of different solids lie, at the same ⟨L⟩_V (unit area and
   peak, x = s·⟨L⟩_V): max |Δp| over |x| ≤ 6, the lines as this folder's reduce() draws them.
   Also each against today's Lorentzian (FWHM 0.675) and the lsq table's TCH line. Pure arithmetic.
   node linediff.mjs */
import fs from 'node:fs';
import { ballA, boxA, cylA, reduce, pvGL } from './profiles.mjs';
const T = JSON.parse(fs.readFileSync(new URL('./tables.json', import.meta.url)));
const C = [['ball', ballA(), T.ball], ['box edge', boxA(0, 0), T.box.e[0][0]], ['box face diag', boxA(1, 0), T.box.e[40][0]], ['box body diag', boxA(1, 1), T.box.e[40][40]],
  ['box (1, .5, .25)', boxA(0.5, 0.25), T.box.e[20][10]], ['cyl axis', cylA(0), T.cyl.e[0]], ['cyl 45°', cylA(Math.PI/4), T.cyl.e[90]], ['cyl across', cylA(Math.PI/2), T.cyl.e[180]]];
const R = C.map(([n, s, e])=> ({ n, r: reduce(s), e }));
const xs = Array.from({ length: 1201 }, (_, i)=> -6 + i*0.01);
const md = (f, g) => Math.max(...xs.map(x=> Math.abs(f(x) - g(x))));
console.log('| line | ' + R.map(o=> o.n).join(' | ') + ' | Lorentzian 0.675 | lsq TCH |');
console.log('|---|' + R.map(()=> '---|').join('') + '---|---|');
for (const a of R){
  const cells = R.map(b=> (100*md(x=> a.r.p(Math.abs(x)), x=> b.r.p(Math.abs(x)))).toFixed(1));
  console.log(`| ${a.n} | ${cells.join(' | ')} | ${(100*md(x=> a.r.p(Math.abs(x)), x=> pvGL(x, 0, 0.675))).toFixed(1)} | ${(100*md(x=> a.r.p(Math.abs(x)), x=> pvGL(x, a.e.lsq[0], a.e.lsq[1]))).toFixed(1)} |`);
}
