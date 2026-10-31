#!/usr/bin/env node
/* Step 3, part 3: what the check can do beyond widening, on every kept fit (truths and spheres):
   R0 nothing (today); R1 'affected by misfit' marked where the flag fires; R2 the shape refitted
   without the flagged segments and reported so; R3 the keep test made again without the flagged
   segments (the shape refitted from the kept fit, the isotropic fit from the isotropic one: ΔBIC as
   freeShape's, χ²_ν floored at 1, P and N of the reduced data; kept below −10); R4 R2 and R3
   together; R5 a shape under a fired flag not supported (reported as the isotropic size).
   node rep-fix.mjs [--tag C1] [--rows]   (FLAG, ZSEG as rep-jack.mjs) */
import { load, f, truthPairs } from './an3.mjs';
import { pOfZ, zOfP } from './ck.mjs';
import { compareSolids, laueRotations } from './lib.mjs';
const FLAG = new Function('x', 'return ' + (process.env.FLAG || 'x.st.zseg > 3.09'));
const ZSEG = +(process.env.ZSEG || 3.09);
const bz = (z, S) => zOfP(Math.min(0.5, S*pOfZ(z)));
const flaggedSegs = x => x.st.segs.filter(s=> bz(s.z, x.st.S) > ZSEG).map(s=> s.i);
const X = load().filter(x=> x.st);
function dropFor(x){
  const F = flaggedSegs(x), D = (x.ck.drop || []).filter(q=> q.shape && q.iso);
  if (!F.length || !D.length) return null;
  return D.sort((p, q)=> p.k - q.k).find(q=> q.k >= F.length) || D[D.length - 1];
}
const dBIC = d => { const rI = d.iso.c/Math.max(1, d.iso.N - d.iso.P); return (d.shape.c - d.iso.c)/Math.max(1, rI) + (d.shape.P - d.iso.P)*Math.log(d.shape.N); };
// the state of a row under a rule: { kept, solid, marked }
function apply(x, rule){
  const fl = x.kept && FLAG(x), d = fl ? dropFor(x) : null;
  const base = { kept: x.kept, solid: x.kept ? x.r.solid : null, marked: false };
  if (!x.kept || !fl) return base;
  switch (rule){
    case 'R1': return { ...base, marked: true };
    case 'R2': return d ? { kept: true, solid: d.shape.s, marked: true } : { ...base, marked: true };
    case 'R3': return d && !(dBIC(d) < -10) ? { kept: false, solid: null, marked: true } : { ...base, marked: true };
    case 'R4': return d ? (dBIC(d) < -10 ? { kept: true, solid: d.shape.s, marked: true } : { kept: false, solid: null, marked: true }) : { ...base, marked: true };
    case 'R5': return { kept: false, solid: null, marked: true };
    default: return base;
  }
}
const evalRow = (x, st) => {
  if (x.row.kind === 'sphere') return { falseShape: st.kept, marked: st.marked };
  if (!st.kept) return { lost: true, marked: st.marked };
  const s = { ...st.solid, type: x.o.truth.type };
  const acc = compareSolids(s, x.o.truth, { rots: laueRotations(x.o.phase) });
  return { lost: false, unb: s.dims.some(d=> d === Infinity), worst: acc.dimMax, axis: acc.principal, harm: !(acc.dimMax <= 0.25) || (acc.principal != null && acc.principal > 10), marked: st.marked };
};
const RULES = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'];
const L = [`FLAG: ${process.env.FLAG || 'x.st.zseg > 3.09'}; flagged segments: family-wise z > ${ZSEG}`, ''];
L.push('| rule | spheres: false shapes (marked) | error truths: kept / lost | unbounded | harmful kept (marked) | harmless kept, marked | clean truths: kept / lost | clean harmful kept (marked) | clean marked |', '|---|---|---|---|---|---|---|---|---|');
for (const R of RULES){
  const sp = X.filter(x=> x.row.kind === 'sphere').map(x=> evalRow(x, apply(x, R)));
  const et = X.filter(x=> x.row.kind === 'truth' && !x.clean).map(x=> evalRow(x, apply(x, R)));
  const ct = X.filter(x=> x.row.kind === 'truth' && x.clean).map(x=> evalRow(x, apply(x, R)));
  const k = a => a.filter(e=> !e.lost);
  L.push(`| ${R} | ${sp.filter(e=> e.falseShape).length}/${sp.length} (${sp.filter(e=> e.falseShape && e.marked).length}) | ${k(et).length} / ${et.filter(e=> e.lost).length} | ${k(et).filter(e=> e.unb).length} | ${k(et).filter(e=> e.harm).length} (${k(et).filter(e=> e.harm && e.marked).length}) | ${k(et).filter(e=> !e.harm && e.marked).length} | ${k(ct).length} / ${ct.filter(e=> e.lost).length} | ${k(ct).filter(e=> e.harm).length} (${k(ct).filter(e=> e.harm && e.marked).length}) | ${ct.filter(e=> e.marked).length} |`);
}
console.log(L.join('\n'));
if (process.argv.includes('--rows')){
  console.log('\n| row | error | outcome | flag | flagged | k | ΔBIC kept → without flagged | worst, axis kept → refit | change ln D max, axis ° |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const x of X.filter(x=> x.kept && (FLAG(x) || !x.clean))){
    const d = dropFor(x), fl = FLAG(x), e0 = evalRow(x, apply(x, 'R0')), e2 = d ? evalRow(x, { kept: true, solid: d.shape.s }) : null;
    const ch = d ? [Math.max(...[0, 1, 2].map(i=> x.r.solid.dims[i] === Infinity && d.shape.s.dims[i] === Infinity ? 0 : Math.abs(Math.log(d.shape.s.dims[i]/x.r.solid.dims[i])))), Math.max(...[0, 1, 2].map(i=> Math.acos(Math.min(1, Math.abs(x.r.solid.axes[i].reduce((t, u, j)=> t + u*d.shape.s.axes[i][j], 0))))*180/Math.PI))] : null;
    const show = e => !e ? '—' : e.falseShape != null ? 'shape' : `${f(100*e.worst, 0)} %, ${f(e.axis, 1)}°`;
    console.log(`| ${x.row.id} | ${x.ek} ${x.ek !== 'none' ? f(x.es) : ''} | ${x.r.held ? 'held' : 'free'} | ${fl ? 'yes' : ''} | ${flaggedSegs(x).length}/${x.st.S} | ${d ? d.k : ''} | ${f(x.r.dBIC, 0)} → ${d ? f(dBIC(d), 0) : '—'} | ${show(e0)} → ${show(e2)} | ${ch ? f(ch[0]) + ', ' + f(ch[1], 1) : '—'} |`);
  }
}
