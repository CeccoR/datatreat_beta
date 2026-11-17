#!/usr/bin/env node
/* Step 4: the directions of the reported fit against the truth, modulo the class, (a) each axis on its
   own (today: the axes paired by size within their classes, lib.mjs compareSolids), (b) with the set
   rule: the axes of a reported set (rep.sets: a box's edges not told apart, a square box's sides)
   matched within the set, modulo the swap. Coverage: the error within max(2·esd, betweenDeg) (an
   axis: its tilt's esd; a set: the turn's about its normal). The axes scored: the truth's defined
   axes (a body of revolution's axis; an ellipsoid's or elliptic section's axes whose extents differ
   by more than 4 %; every box edge) that the report gives a direction for (own).
   node dirs4.mjs [--tag S1] [--delta 12.5] [--rows] */
import { load } from './score4.mjs';
import { laueRotations, compareSolids, mv, unit } from './lib.mjs';
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const tag = arg('tag', 'S1');
const X = load(tag).filter(x=> x.truth && x.r.kept && x.r.report && x.r.report.axes);
const R2D = 180/Math.PI, lg = d => Math.log(Number.isFinite(d) ? d : 1e4);
const ang = (a, b) => Math.acos(Math.min(1, Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2])))*R2D;
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i)=> perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p=> [x, ...p]));
const med = a => { const s = a.filter(x=> Number.isFinite(x)).sort((p, q)=> p - q); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1])/2 : NaN; };
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
const rows = [];
for (const x of X){
  const T = x.o.truth, fit = x.r.solid, rep = x.r.report, rots = laueRotations(x.o.phase);
  const acc = compareSolids(fit, T, { rots }), pairs = acc.pairs;
  // the truth's defined axes
  const def = i => T.type === 'cylinder' || T.type === 'spheroid' ? i === 2 : T.type === 'box' || T.type === 'sqbox' ? true
    : [0, 1, 2].every(j=> j === i || (T.type === 'ellcyl' && (j === 2) !== (i === 2)) || Math.abs(lg(T.dims[i]) - lg(T.dims[j])) >= 0.04);
  const fa = fi => rep.axes.find(a=> a.axis === fi);
  const scored = pairs.filter(([ri, fi])=> def(ri) && fa(fi) && fa(fi).own);
  if (!scored.length) continue;
  const sets = (rep.sets || []).map(S=> ({ ...S, fis: S.axes.filter(fi=> scored.some(p=> p[1] === fi)) })).filter(S=> S.fis.length >= 2);
  const inSet = fi => sets.find(S=> S.fis.includes(fi));
  const errAt = (G, useSets) => {
    const e = new Map();
    for (const [ri, fi] of scored) if (!(useSets && inSet(fi))) e.set(fi, ang(fit.axes[fi], mv(G, T.axes[ri])));
    if (useSets) for (const S of sets){
      const tr = S.fis.map(fi=> scored.find(p=> p[1] === fi)[0]);
      let best = Infinity; for (const p of perms(tr)){ const m = Math.max(...S.fis.map((fi, k)=> ang(fit.axes[fi], mv(G, T.axes[p[k]])))); best = Math.min(best, m); }
      for (const fi of S.fis) e.set(fi, best);
    }
    return e;
  };
  const bestOf = useSets => { let b = null; for (const G of rots){ const e = errAt(G, useSets), m = Math.max(...e.values()); if (!b || m < b.m) b = { m, e }; } return b.e; };
  const e0 = bestOf(false), e1 = bestOf(true);
  for (const [ri, fi] of scored){
    const a = fa(fi), S = inSet(fi);
    const r0 = Math.max(Number.isFinite(a.esdAngle) ? 2*a.esdAngle : 0, a.betweenDeg || 0);
    const r1 = S ? Math.max(Number.isFinite(S.esdAngle) ? 2*S.esdAngle : 0, S.betweenDeg || 0) : r0;
    rows.push({ id: x.row.id, type: T.type, clean: x.clean, flag: x.flag, fi, inSet: !!S, resolved: a.resolved, e0: e0.get(fi), e1: e1.get(fi), r0, r1, c0: e0.get(fi) <= r0, c1: e1.get(fi) <= r1 });
  }
}
const L = [];
const sumUp = (nm, R) => {
  const S = R.filter(r=> r.inSet);
  L.push(`| ${nm} | ${R.length} | ${R.filter(r=> r.c0).length} | ${R.filter(r=> r.c1).length} | ${f(med(R.map(r=> r.e0)))} / ${f(med(R.map(r=> r.e1)))} | ${R.filter(r=> r.e0 > 10).length} / ${R.filter(r=> r.e1 > 10).length} | ${S.length} | ${S.filter(r=> r.c0).length} / ${S.filter(r=> r.c1).length} | ${f(med(S.map(r=> r.e0)))} / ${f(med(S.map(r=> r.e1)))} | ${f(med(S.map(r=> r.r0)))} / ${f(med(S.map(r=> r.r1)))} |`);
};
L.push(`tag ${tag}: directions of the kept truths (axes the report gives a direction for, the truth's defined ones)`, '',
  '| axes | n | covered, each alone | covered, set rule | median error ° alone / set | beyond 10° alone / set | in a set | in a set: covered alone / set | in a set: median error / | median radius alone / set |', '|---|---|---|---|---|---|---|---|---|---|');
sumUp('all', rows);
sumUp('box, square box', rows.filter(r=> r.type === 'box' || r.type === 'sqbox'));
sumUp('clean', rows.filter(r=> r.clean));
sumUp('resolved (esd ≤ 30°)', rows.filter(r=> r.resolved));
if (process.argv.includes('--rows')){
  L.push('', '| row | axis | set | error alone / set ° | radius alone / set ° |', '|---|---|---|---|---|');
  for (const r of rows.filter(r=> r.inSet || !r.c1)) L.push(`| ${r.id} | ${r.fi} | ${r.inSet ? 'yes' : ''} | ${f(r.e0)} / ${f(r.e1)} | ${f(r.r0)} / ${f(r.r1)} |`);
}
console.log(L.join('\n'));
