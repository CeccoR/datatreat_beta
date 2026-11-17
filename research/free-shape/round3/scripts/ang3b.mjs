#!/usr/bin/env node
/* Point 1, details: on clean kept truths, not flagged, whose axis is not on the lattice (error > 0.05°), the
   error over each rule's radius; the trials a profile needs (points read until t, both sides, the turns that
   tilt the principal axis) against round 2's (the default steps until Δχ²/χ²_ν 1).
   node ang3b.mjs --tags S0 [--part tuning] [--sub screen] */
import { loadX, rowsOf, intervals, f, med, qtl } from './lib3.mjs';
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
let rows = rowsOf(arg('part', 'tuning')).filter(r=> r.kind === 'truth' && !r.error);
if (arg('sub', null) === 'screen') rows = rows.filter(r=> r.screen);
const X = loadX(rows, arg('tags', 'S0').split(',')).filter(x=> !x.flag && x.r.kept && x.r.report && x.r.report.minima && x.r.report.minima.angle);
const rd = (pts, t) => { let t0 = 0, r0 = 0; const g = Math.sqrt(t); for (const [deg, d] of pts){ if (!Number.isFinite(d)) return NaN; const r = Math.sqrt(Math.max(0, d)); if (r >= g) return t0 + (deg - t0)*(g - r0)/Math.max(1e-12, r - r0); t0 = deg; r0 = r; } return NaN; };
const nTo = (pts, t, coarse) => { let n = 0; for (const [deg, d] of pts){ if (coarse && ![1, 2, 4, 8, 16, 32, 60].includes(deg)) continue; n++; if (d >= t) break; } return n; };
const out = [];
for (const x of X){
  const iv = intervals(x); if (!iv.ax) continue;
  const A = x.r.report.minima.angle, fp = iv.fp, tb = A.about.filter(b=> b !== fp), P = tb.map(b=> A.prof.find(p=> p.b === b)).filter(Boolean);
  const read = t => Math.max(...P.flatMap(p=> [rd(p.plus, t), rd(p.minus, t)]));
  const unique = x.r.report.minima.n <= 1;
  out.push({ id: x.row.id, e: iv.ax.e, unique, held: A.held, r1: read(1), r6: read(5.99), r9: read(9), E: iv.ax.rE,
    trials: { r2: P.reduce((t, p)=> t + nTo(p.plus, 1, true) + nTo(p.minus, 1, true), 0), t6: P.reduce((t, p)=> t + nTo(p.plus, 5.99) + nTo(p.minus, 5.99), 0), t9: P.reduce((t, p)=> t + nTo(p.plus, 9) + nTo(p.minus, 9), 0) } });
}
const off = out.filter(o=> o.e > 0.05 && !o.held);
console.log(`clean kept, not flagged: ${out.length}; axis off the lattice and free: ${off.length} (unique ${off.filter(o=> o.unique).length})`);
console.log(`error ÷ the profile's 1-σ reading (t 1): median ${f(med(off.map(o=> o.e/o.r1)), 2)}, 90 % ${f(qtl(off.map(o=> o.e/o.r1), 0.9), 2)}, max ${f(Math.max(...off.map(o=> o.e/o.r1)), 2)} (a 2-D normal tilt: median 1.18, 95 % 2.45)`);
console.log(`error ÷ round 2's radius: median ${f(med(off.map(o=> o.e/o.E)), 2)}, max ${f(Math.max(...off.map(o=> o.e/o.E)), 2)}; ÷ profile t 5.99: ${f(med(off.map(o=> o.e/o.r6)), 2)}, ${f(Math.max(...off.map(o=> o.e/o.r6)), 2)}; ÷ t 9: ${f(med(off.map(o=> o.e/o.r9)), 2)}, ${f(Math.max(...off.map(o=> o.e/o.r9)), 2)}`);
console.log(`unique: error beyond round 2's radius ${off.filter(o=> o.unique && o.e > o.E).length}, beyond t 5.99 ${off.filter(o=> o.unique && o.e > o.r6).length}, beyond t 9 ${off.filter(o=> o.unique && o.e > o.r9).length} of ${off.filter(o=> o.unique).length}`);
const s = k => out.reduce((t, o)=> t + o.trials[k], 0);
console.log(`profile trials on the principal axis's turns (sides × turns), sum over ${out.length}: round 2 ${s('r2')}, t 5.99 ${s('t6')} (${f(s('t6')/s('r2'), 2)}×), t 9 ${s('t9')} (${f(s('t9')/s('r2'), 2)}×)`);
if (process.argv.includes('--rows')) for (const o of off) console.log(o.id, o.unique ? 'U' : '', f(o.e, 2), f(o.r1, 2), f(o.E, 2), f(o.r6, 2), f(o.r9, 2));
