#!/usr/bin/env node
/* Step 3, part 3 on the prototype's runs (results/P1: the engine's check, its flagged segments and
   methods/proto.mjs's refits without them). Rules on a kept fit whose check fired:
   R0 nothing; R1 marked 'affected by misfit'; R2 the shape refitted without the flagged segments
   (a: all of them, where 2 segments are left; t: at most a third, the worst first) and reported so;
   R3 the keep test again without them (ΔBIC as the search's, on the points left; kept below −10);
   R4 R2 and R3 together; R5 not supported (the isotropic size reported).
   Also the coverage of the prototype's report (esds alone; with jackLo, jackHi, jackTurn) on the
   kept truths. node rep-fixP.mjs [--tag P1] [--rows] */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const tag = process.argv.includes('--tag') ? process.argv[process.argv.indexOf('--tag') + 1] : 'P1';
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const f = (x, d = 2) => x === Infinity ? '∞' : x == null || Number.isNaN(x) ? '—' : x.toFixed(d);
const med = a => { const s = a.filter(x=> x != null && !Number.isNaN(x)).sort((p, q)=> p - q); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1])/2 : NaN; };
const X = [];
for (const row of design.rows.filter(r=> r.split === 'tuning' && r.screen)){
  const fn = path.join(HERE, 'results', tag, row.id + '.json'); if (!fs.existsSync(fn)) continue;
  const o = readResult(fs.readFileSync(fn, 'utf8')), r = o.records[0];
  X.push({ row, o, r, ek: row.error ? row.error.kind : 'none', es: row.error ? row.error.strength : 0, clean: !row.error, flag: !!(r.check && r.check.flagged) });
}
const dBIC = d => { const rI = d.iso.c/Math.max(1, d.iso.N - d.iso.P); return (d.shape.c - d.iso.c)/Math.max(1, rI) + (d.shape.P - d.iso.P)*Math.log(d.shape.N); };
function apply(x, rule){
  const base = { kept: x.r.kept, solid: x.r.kept ? x.r.solid : null, marked: false };
  if (!x.r.kept || !x.flag) return base;
  const D = x.r.drop || {}, d = rule.endsWith('a') ? D.all : D.third, ok = d && d.shape && d.iso;
  switch (rule.slice(0, 2)){
    case 'R1': return { ...base, marked: true };
    case 'R2': return ok ? { kept: true, solid: d.shape.s, marked: true } : { ...base, marked: true };
    case 'R3': return ok && !(dBIC(d) < -10) ? { kept: false, marked: true } : { ...base, marked: true };
    case 'R4': return ok ? (dBIC(d) < -10 ? { kept: true, solid: d.shape.s, marked: true } : { kept: false, marked: true }) : { ...base, marked: true };
    case 'R5': return { kept: false, marked: true };
    default: return base;
  }
}
function evalRow(x, st){
  if (x.row.kind === 'sphere') return { falseShape: st.kept, marked: st.marked };
  if (!st.kept) return { lost: true, marked: st.marked };
  const acc = compareSolids({ ...st.solid, type: x.o.truth.type }, x.o.truth, { rots: laueRotations(x.o.phase) });
  return { lost: false, unb: st.solid.dims.some(d=> d === Infinity), worst: acc.dimMax, axis: acc.principal, harm: !(acc.dimMax <= 0.25) || (acc.principal != null && acc.principal > 10), marked: st.marked };
}
const L = ['| rule | spheres: false shapes (marked) | error truths kept / lost | unbounded | harmful kept (marked) | harmless kept, marked | harmless lost | clean truths kept / lost | clean marked |', '|---|---|---|---|---|---|---|---|---|'];
const base = new Map(X.map(x=> [x.row.id, evalRow(x, apply(x, 'R0'))]));
for (const R of ['R0', 'R1', 'R2a', 'R2t', 'R3a', 'R3t', 'R4a', 'R4t', 'R5']){
  const E = X.map(x=> ({ x, e: evalRow(x, apply(x, R)), b: base.get(x.row.id) }));
  const sp = E.filter(z=> z.x.row.kind === 'sphere'), et = E.filter(z=> z.x.row.kind === 'truth' && !z.x.clean), ct = E.filter(z=> z.x.row.kind === 'truth' && z.x.clean);
  const k = a => a.filter(z=> !z.e.lost);
  L.push(`| ${R} | ${sp.filter(z=> z.e.falseShape).length}/${sp.length} (${sp.filter(z=> z.e.falseShape && z.e.marked).length}) | ${k(et).length} / ${et.filter(z=> z.e.lost).length} | ${k(et).filter(z=> z.e.unb).length} | ${k(et).filter(z=> z.e.harm).length} (${k(et).filter(z=> z.e.harm && z.e.marked).length}) | ${k(et).filter(z=> !z.e.harm && z.e.marked).length} | ${et.filter(z=> z.e.lost && !z.b.lost && !z.b.harm).length} | ${k(ct).length} / ${ct.filter(z=> z.e.lost).length} | ${ct.filter(z=> z.e.marked).length} |`);
}
console.log(L.join('\n'));
// the coverage of the prototype's report on the kept truths
const ONE = new Set(['cylinder', 'spheroid', 'sqbox']), REV = new Set(['cylinder', 'spheroid']);
function cover(x, jack){
  const T = x.o.truth, acc = compareSolids(x.r.solid, T, { rots: laueRotations(x.o.phase) }), rep = x.r.report, nW = rep.dims.length;
  const slotDim = i => nW === 2 ? rep.dims[i === 2 ? 1 : 0] : rep.dims[i];
  const out = { ext: [], ax: null };
  for (const [ri, fi] of acc.pairs){
    if (ONE.has(T.type) && ri === 1) continue;
    const d = slotDim(fi), D = x.r.solid.dims[fi], Dt = T.dims[ri];
    if (D === Infinity){ out.ext.push({ inf: true }); continue; }
    let lo = Number.isFinite(d.Desd) ? D - 2*d.Desd : D, hi = Number.isFinite(d.Desd) ? D + 2*d.Desd : D;
    if (jack && d.jackLo != null && Number.isFinite(d.jackLo)){ lo = Math.min(lo, d.jackLo); hi = Math.max(hi, d.jackHi); }
    out.ext.push({ cov: Dt >= lo && Dt <= hi, w: Math.log(hi/Math.max(1e-9, lo))/2, e: Math.log(D/Dt) });
  }
  // the truth's most distinct axis and its paired slot (lib.mjs compareSolids' rule)
  const lg = d => Math.log(Number.isFinite(d) ? d : 1e4), und = new Set();
  if (REV.has(T.type)) [0, 1].forEach(i=> und.add(i));
  if (T.type !== 'box' && T.type !== 'sqbox') for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j && Math.abs(lg(T.dims[i]) - lg(T.dims[j])) < 0.04) und.add(i);
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(T.dims[i]) - lg(T.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !und.has(i)).sort((p, q)=> gap(q) - gap(p))[0];
  if (prin != null && acc.principal != null){
    const fp = acc.pairs.find(p=> p[0] === prin)[1], ax = rep.axes.find(a=> a.axis === fp);
    const radL = ax && Number.isFinite(ax.esdAngle) ? 2*ax.esdAngle : 0, rad = Math.max(radL, jack && ax && Number.isFinite(ax.jackTurn) ? ax.jackTurn : 0);
    out.ax = { e: acc.principal, cov: acc.principal <= rad, rad };
  }
  return out;
}
const L2 = ['', '| kept truths | report | runs | extents covered (unbounded apart) | beyond 25 %: covered | axes covered (beyond 10°: covered) | median half-width, ln D | median axis radius ° |', '|---|---|---|---|---|---|---|---|'];
for (const [gn, gf] of [['flagged, with an error', x=> x.flag && !x.clean], ['flagged, clean', x=> x.flag && x.clean], ['not flagged, with an error', x=> !x.flag && !x.clean], ['not flagged, clean', x=> !x.flag && x.clean]]){
  const G = X.filter(x=> x.r.kept && x.row.kind === 'truth' && gf(x));
  for (const jack of [false, true]){
    if (jack && !G.some(x=> x.flag)) continue;
    const S = G.map(x=> cover(x, jack)), E = S.flatMap(s=> s.ext).filter(e=> !e.inf), A = S.map(s=> s.ax).filter(Boolean);
    const big = E.filter(e=> Math.abs(e.e) > Math.log(1.25)), bigA = A.filter(a=> a.e > 10);
    L2.push(`| ${gn} | ${jack ? 'esds and jackknife' : 'esds alone'} | ${G.length} | ${E.filter(e=> e.cov).length}/${E.length} (${S.flatMap(s=> s.ext).filter(e=> e.inf).length}) | ${big.filter(e=> e.cov).length}/${big.length} | ${A.filter(a=> a.cov).length}/${A.length} (${bigA.filter(a=> a.cov).length}/${bigA.length}) | ${f(100*med(E.map(e=> e.w)), 1)} % | ${f(med(A.map(a=> a.rad)), 1)} |`);
  }
}
console.log(L2.join('\n'));
if (process.argv.includes('--rows')){
  console.log('\n| row | error | outcome | flagged segments (S) | z seg, z bin | ΔBIC → without all, a third | worst, axis → refit all, a third |');
  console.log('|---|---|---|---|---|---|---|');
  for (const x of X.filter(x=> x.r.kept && x.flag)){
    const D = x.r.drop || {}, show = e => !e ? '—' : e.falseShape != null ? (e.falseShape ? 'shape' : 'sphere') : e.lost ? 'lost' : `${f(100*e.worst, 0)} %, ${f(e.axis, 1)}°`;
    const ra = D.all && D.all.shape ? evalRow(x, { kept: true, solid: D.all.shape.s }) : null, rt = D.third && D.third.shape ? evalRow(x, { kept: true, solid: D.third.shape.s }) : null;
    console.log(`| ${x.row.id} | ${x.ek}${x.clean ? '' : ' ' + f(x.es)} | ${x.r.held ? 'held' : 'free'} | ${x.r.check.segs.length} (${x.r.check.S}) | ${f(x.r.check.zSeg, 1)}, ${f(x.r.check.zBin, 1)} | ${f(x.r.dBIC, 0)} → ${D.all && D.all.iso ? f(dBIC(D.all), 0) : '—'}, ${D.third && D.third.iso ? f(dBIC(D.third), 0) : '—'} | ${show(evalRow(x, apply(x, 'R0')))} → ${show(ra)}, ${show(rt)} |`);
  }
}
