#!/usr/bin/env node
/* Point 1: the axes' 95 % radius, offline from records made with SHAPE_ANGLE.record (and each). For each kept
   truth's principal axis (the truth's most distinct, lib3 intervals): the engine's reported radius (E), and the
   radius by rule over a grid: 'profile' read at t (Δχ²/χ²_ν; sides: max), 'curv' κ·√5.99·σ (the covariance),
   each without ('B': the minima's largest angle, as round 2) and with the minima's own cones ('U'); a held fit
   at least freeOff; the jackknife's turn where the check fired.
   node ang3.mjs --tags S0 [--part tuning] [--sub screen] [--rows] [--grid] */
import { loadX, rowsOf, intervals, f, med } from './lib3.mjs';
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const tags = arg('tags', 'S0').split(','), part = arg('part', 'tuning'), sub = arg('sub', null);
let rows = rowsOf(part).filter(r=> r.kind === 'truth');
if (sub === 'screen') rows = rows.filter(r=> r.screen); else if (sub === 'new') rows = rows.filter(r=> !r.screen);
const X = loadX(rows, tags).filter(x=> x.r.kept && x.r.report && x.r.report.minima && x.r.report.minima.angle);
export function turnRead(pts, t){ let t0 = 0, r0 = 0; const tg = Math.sqrt(t);
  for (const [deg, d] of pts){ if (!Number.isFinite(d)) return NaN; const r = Math.sqrt(Math.max(0, d)); if (r >= tg) return t0 + (deg - t0)*(tg - r0)/Math.max(1e-12, r - r0); t0 = deg; r0 = r; }
  return NaN; }
const readP = (prof, t, side) => b => { const p = prof && prof.find(x=> x.b === b); if (!p) return NaN; const a = turnRead(p.plus, t), c = turnRead(p.minus, t); return side === 'mean' ? (a + c)/2 : Math.max(a, c); };
const readC = (sig, k) => b => k*Math.sqrt(5.99)*sig[b];
function one(x, o){
  const iv = intervals(x); if (!iv.ax) return null;
  const A = x.r.report.minima.angle, about = A.about, fp = iv.fp, rep = x.r.report;
  const DS = x.flag ? 25 : 16, inD = A.minima.filter(m=> m.delta <= DS);
  const tilt = (rd, i) => { const r = about.filter(b=> b !== i).map(rd); return r.some(v=> !Number.isFinite(v)) ? NaN : Math.max(0, ...r); };
  const axr = rep.axes.find(a=> a.axis === fp);
  // 'r2' offline: round 2's 2·esdAngle (a held fit's esdAngle at least freeOff), the minima's largest angle
  const rd = o.rule === 'r2' ? null : o.rule === 'profile' ? readP(A.prof, o.t, o.side) : readC(A.sigC, o.k);
  let r = o.rule === 'r2' ? (axr && Number.isFinite(axr.esdAngle) ? 2*axr.esdAngle : 0) : tilt(rd, fp);
  if (!Number.isFinite(r)) r = axr && Number.isFinite(axr.esdAngle) ? axr.esdAngle*(o.rule === 'profile' ? Math.sqrt(o.t) : o.k*Math.sqrt(5.99)) : 0;
  if (A.held && A.freeOff && o.rule !== 'r2') r = Math.max(r, 2*A.freeOff[fp]);   // as round 2: 2·esdAngle with esdAngle ≥ freeOff
  let rm = 0;
  for (const m of inD){ const a = m.ang[fp]; if (a == null) continue;
    if (!o.each || o.rule === 'r2'){ rm = Math.max(rm, a); continue; }
    const j = m.perm[fp], rdm = o.rule === 'profile' ? (m.prof ? readP(m.prof, o.t, o.side) : null) : (m.sigC ? readC(m.sigC, o.k) : null);
    const loc = rdm ? tilt(rdm, j) : NaN; rm = Math.max(rm, a + (Number.isFinite(loc) ? loc : r)); }
  const jt = x.flag && axr && Number.isFinite(axr.jackTurn) ? axr.jackTurn : 0;
  const R = Math.max(r, rm, jt);
  return { e: iv.ax.e, R, cov: iv.ax.e <= R, E: iv.ax.rE, covE: iv.ax.E };
}
const groups = { clean: x=> x.clean && !x.flag, 'clean flagged': x=> x.clean && x.flag, 'error, not flagged': x=> !x.clean && !x.flag, 'error, flagged': x=> !x.clean && x.flag };
const grid = [{ rule: 'r2' }];
for (const t of [4, 5.99, 9, 12, 16, 25]) for (const each of [false, true]) grid.push({ rule: 'profile', t, side: 'max', each });
grid.push({ rule: 'profile', t: 9, side: 'mean', each: false }, { rule: 'profile', t: 12, side: 'mean', each: false });
for (const k of [1, 1.2, 1.5, 2, 2.5, 3]) for (const each of [false, true]) grid.push({ rule: 'curv', k, each });
const L = [`axes: ${tags.join(',')} ${part}${sub ? ' ' + sub : ''}, ${X.length} kept truths with a record`, '', `| rule | ${Object.keys(groups).map(g=> g + ' (covered / n, median radius °)').join(' | ')} | clean: radius ÷ round 2's, median |`, `|---|${Object.keys(groups).map(()=> '---|').join('')}---|`];
for (const o of grid){
  const cells = Object.entries(groups).map(([, sel])=> {
    const ys = X.filter(sel).map(x=> one(x, o)).filter(Boolean);
    return `${ys.filter(y=> y.cov).length}/${ys.length}, ${f(med(ys.map(y=> y.R)), 1)}`;
  });
  const rat = X.filter(groups.clean).map(x=> { const a = one(x, o), b = one(x, { rule: 'r2' }); return a && b && b.R > 0 ? a.R/b.R : NaN; }).filter(Number.isFinite);
  L.push(`| ${o.rule === 'r2' ? 'round 2 (2·esdAngle, betweenDeg), offline' : o.rule === 'profile' ? `profile t ${o.t}${o.side === 'mean' ? ' (sides mean)' : ''}${o.each ? ', each' : ''}` : `curv κ ${o.k}${o.each ? ', each' : ''}`} | ${cells.join(' | ')} | ${f(med(rat), 2)} |`);
}
if (process.argv.includes('--rows')){
  L.push('', '| row | flag | error ° | round 2 | profile 5.99 | profile 9 | curv 1 | curv 1.5 | minima ≤ Δ* |', '|---|---|---|---|---|---|---|---|---|');
  for (const x of X){ const a = one(x, { rule: 'profile', t: 5.99, side: 'max' }); if (!a) continue;
    const b = one(x, { rule: 'profile', t: 9, side: 'max' }), c = one(x, { rule: 'curv', k: 1 }), d = one(x, { rule: 'curv', k: 1.5 });
    L.push(`| ${x.row.id} | ${x.flag ? 'F' : ''}${x.clean ? '' : x.ek} | ${f(a.e, 2)} | ${f(a.E, 2)} | ${f(a.R, 2)} | ${f(b.R, 2)} | ${f(c.R, 2)} | ${f(d.R, 2)} | ${x.r.report.minima.n} |`); }
}
console.log(L.join('\n'));
if (process.argv.includes('--miss')){ const o = JSON.parse(arg('miss', '{}'));
  for (const x of X.filter(groups.clean)){ const a = one(x, o); if (a && !a.cov) console.log('miss', x.row.id, 'error', f(a.e, 2), 'radius', f(a.R, 2), 'engine', f(a.E, 2)); } }
// --check: the engine's own radius (records made at rule 'profile', t 9) against the offline reading
if (process.argv.includes('--check')){ let n = 0, bad = [];
  for (const x of X){ const a = one(x, { rule: 'profile', t: +arg('checkT', 5.99), side: 'max', each: false }); if (!a || a.E == null) continue; n++; if (Math.abs(a.R - a.E) > 1e-6*Math.max(1, a.R)) bad.push(`${x.row.id} ${f(a.R, 4)} ${f(a.E, 4)}`); }
  console.log(`check: engine radius = offline profile t ${arg('checkT', 5.99)} on ${n - bad.length} of ${n}${bad.length ? ': ' + bad.join(', ') : ''}`); }
