import { ballA, boxA, cylA, reduce, sample, cost, maxDev, readScale, momentsGL, lsqGL, pvGL } from './profiles.mjs';
const cases = [['ball', ballA()], ['box edge', boxA(0, 0)], ['box face diag', boxA(1, 0)], ['box body diag', boxA(1, 1)], ['box 1:.5:.25', boxA(0.5, 0.25)],
  ['cyl axis', cylA(0)], ['cyl 45', cylA(Math.PI/4)], ['cyl across', cylA(Math.PI/2)], ['cyl 20', cylA(20*Math.PI/180)], ['cyl 70', cylA(70*Math.PI/180)]];
const f = (x, d = 3) => x.toFixed(d);
for (const [nm, sol] of cases){
  const red = reduce(sol), S = sample(red);
  const lor = x => pvGL(x, 0, 0.675), ib = x => pvGL(x, 0, 2/Math.PI);
  const m = momentsGL(red), mo = x => pvGL(x, m.g, m.l);
  const L = lsqGL(red), ls = x => pvGL(x, L.g, L.l);
  const r = sh => { const q = readScale(S, sh); return f(q.read) + ' c' + q.c.toExponential(2) + ' max' + f(maxDev(S, x=> sh(x/q.k)/q.k)); };
  console.log(nm.padEnd(14), 'Lv', f(red.Lv), 'La/Lv', f(red.LaV), 'p(0)', f(red.p(0), 6), '| lor', r(lor), '| ib', r(ib), '| mom g,l', f(m.g), f(m.l), r(mo), 'maxDev@1', f(maxDev(S, mo)), '| lsq g,l', f(L.g), f(L.l), 'max', f(maxDev(S, ls)), 'c', L.c.toExponential(2), 'read', f(readScale(S, ls).read));
}
