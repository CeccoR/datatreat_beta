#!/usr/bin/env node
/* Step 3, part 2: the jackknife over lines on the kept truths: does D·e^(±2 sd) (and 2·rms turn)
   cover the error against the truth, how wide it makes the clean rows, what it costs; the cheaper
   versions (4 iterations; only the groups holding a flagged segment; one refit without the flagged
   segments, ±2|Δ|). FLAG (a JS expression on x) is the check; flagged segments are those whose
   family-wise z exceeds ZSEG (default 3.09).
   node rep-jack.mjs [--tag C1] [--rows]   (FLAG='x.st.zseg > 3.09' ZSEG=3.09) */
import { load, f, med, jackSpread, truthPairs, localEsd } from './an3.mjs';
import { pOfZ, zOfP } from './ck.mjs';
const FLAG = new Function('x', 'return ' + (process.env.FLAG || 'x.st.zseg > 3.09'));
const ZSEG = +(process.env.ZSEG || 3.09);
const X = load().filter(x=> x.st && x.kept && x.row.kind === 'truth');
const bz = (z, S) => zOfP(Math.min(0.5, S*pOfZ(z)));
export function flaggedSegs(x){ return x.st.segs.filter(s=> bz(s.z, x.st.S) > ZSEG).map(s=> s.i); }
const ONE = new Set(['cylinder', 'spheroid', 'sqbox']);   // a section of two equal extents: counted once
const versions = {
  local: null,
  'jack 12': x=> jackSpread(x.r, x.ck, 's12'),
  'jack 4': x=> jackSpread(x.r, x.ck, 's4'),
  'jack, flagged groups': x=> { const F = new Set(flaggedSegs(x)); return F.size ? jackSpread(x.r, x.ck, 's12', d=> { for (let s = d.segs[0]; s <= d.segs[1]; s++) if (F.has(s)) return true; return false; }) : { sd: [0, 0, 0], rms: [0, 0, 0] }; },
  'refit without flagged': x=> { const F = flaggedSegs(x); if (!F.length || !x.ck.drop) return { sd: [0, 0, 0], rms: [0, 0, 0] };
    const d = x.ck.drop.filter(q=> q.shape).sort((p, q)=> p.k - q.k).find(q=> q.k >= F.length) || x.ck.drop.filter(q=> q.shape).slice(-1)[0];
    const K = x.r.solid, s = d.shape.s;
    return { sd: [0, 1, 2].map(i=> K.dims[i] === Infinity && s.dims[i] === Infinity ? 0 : Math.abs(Math.log(s.dims[i]/K.dims[i]))), rms: [0, 1, 2].map(i=> Math.acos(Math.min(1, Math.abs(K.axes[i].reduce((t, u, j)=> t + u*s.axes[i][j], 0))))*180/Math.PI), k: d.k }; },
};
function score(x, ver){
  const T = truthPairs(x), loc = localEsd(x.r), sp = ver === 'local' ? null : versions[ver](x);
  const out = { ext: [], ax: null };
  for (const [ri, fi] of T.pairs){
    if (ONE.has(x.o.truth.type) && ri === 1) continue;
    const D = x.r.solid.dims[fi], Dt = x.o.truth.dims[ri], e = Math.log(D/Dt);
    const hl = Number.isFinite(loc[fi].Desd) && D < Infinity ? loc[fi].Desd : NaN;
    const covL = D === Infinity ? null : Number.isFinite(hl) ? Math.abs(D - Dt) <= 2*hl : false;
    const wL = D === Infinity || !Number.isFinite(hl) ? NaN : Math.log((D + 2*hl)/Math.max(1e-9, D - 2*hl))/2;   // the local half-width in ln
    let cov = covL, w = wL;
    if (sp){ const s = sp.sd[fi]; const covJ = D === Infinity ? null : s === Infinity ? e <= 2*(sp.sdF ? sp.sdF[fi] : 0) : Math.abs(e) <= 2*s; cov = cov === null ? null : cov || covJ; w = Math.max(Number.isFinite(wL) ? wL : 0, s === Infinity ? Infinity : 2*s); }
    out.ext.push({ ri, fi, e, cov, w, wL, inf: D === Infinity });
  }
  if (T.fprin != null && x.r.acc.principal != null){
    const angL = 2*(Number.isFinite(loc[T.fprin].ang) ? loc[T.fprin].ang : 0), angJ = sp ? 2*sp.rms[T.fprin] : 0, rad = Math.max(angL, angJ);
    out.ax = { e: x.r.acc.principal, cov: x.r.acc.principal <= rad, rad, radL: angL };
  }
  return out;
}
const L = [];
const groups = [['flagged error rows', x=> !x.clean && FLAG(x)], ['flagged clean rows', x=> x.clean && FLAG(x)], ['unflagged error rows', x=> !x.clean && !FLAG(x)], ['all kept error rows', x=> !x.clean], ['all kept clean rows', x=> x.clean]];
L.push(`FLAG: ${process.env.FLAG || 'x.st.zseg > 3.09'}; flagged segments: family-wise z > ${ZSEG}`, '');
L.push('| rows | version | runs | extents covered (unbounded apart) | extents beyond 25 %: covered | axes covered (beyond 10°: covered) | median half-width, ln D (× local) | median axis radius ° |', '|---|---|---|---|---|---|---|---|');
for (const [gn, gf] of groups){
  const G = X.filter(gf);
  for (const ver of Object.keys(versions)){
    const S = G.map(x=> score(x, ver)), E = S.flatMap(s=> s.ext).filter(e=> !e.inf), A = S.map(s=> s.ax).filter(Boolean);
    const big = E.filter(e=> Math.abs(e.e) > Math.log(1.25)), bigA = A.filter(a=> a.e > 10);
    const ratio = E.filter(e=> Number.isFinite(e.wL) && e.wL > 0 && Number.isFinite(e.w)).map(e=> e.w/e.wL);
    L.push(`| ${gn} | ${ver} | ${G.length} | ${E.filter(e=> e.cov).length}/${E.length} (${S.flatMap(s=> s.ext).filter(e=> e.inf).length}) | ${big.filter(e=> e.cov).length}/${big.length} | ${A.filter(a=> a.cov).length}/${A.length} (${bigA.filter(a=> a.cov).length}/${bigA.length}) | ${f(100*med(E.map(e=> e.w)), 1)} % (${f(med(ratio), 1)}×) | ${f(med(A.map(a=> a.rad)), 1)} |`);
  }
}
// cost
const cost = X.filter(x=> x.ck.jack).map(x=> { const r = x.r, fitEv = x.o.iso.evals + r.search.evals + (r.report ? r.report.evals : 0), fitMs = x.o.iso.ms + r.search.ms + (r.report ? r.report.ms : 0);
  const F = new Set(flaggedSegs(x)), fg = x.ck.jack.drops.filter(d=> { for (let s = d.segs[0]; s <= d.segs[1]; s++) if (F.has(s)) return true; return false; });
  return { G: x.ck.jack.G, ev: x.ck.jack.evals, ms: x.ck.jack.ms, ev4: x.ck.jack.drops.reduce((t, d)=> t + (d.ev4 || 0), 0), fitEv, fitMs, evF: fg.reduce((t, d)=> t + d.evals, 0), msF: fg.reduce((t, d)=> t + d.ms, 0),
    evD: (x.ck.drop || []).filter(d=> d.k >= F.size).slice(0, 1).reduce((t, d)=> t + d.evals, 0), it12: x.ck.jack.drops.map(d=> (d.it4 || 0) + (d.it12 || 0)), laue: x.row.laue }; });
L.push('', `Cost on ${cost.length} kept truths (median, range; × the fit's own iso + search + report in the same process): groups ${f(med(cost.map(c=> c.G)), 0)} (${Math.min(...cost.map(c=> c.G))}–${Math.max(...cost.map(c=> c.G))}); `
  + `full jackknife ${f(med(cost.map(c=> c.ev)), 0)} evaluations (${f(med(cost.map(c=> c.ev/c.fitEv)), 2)}×, ${f(Math.min(...cost.map(c=> c.ev/c.fitEv)), 2)}–${f(Math.max(...cost.map(c=> c.ev/c.fitEv)), 2)}), ${f(med(cost.map(c=> c.ms))/1000, 1)} s wall (${f(med(cost.map(c=> c.ms/c.fitMs)), 2)}×); `
  + `4 iterations ${f(med(cost.map(c=> c.ev4/c.fitEv)), 2)}×; refits reaching 12 iterations ${cost.flatMap(c=> c.it12).filter(i=> i >= 12).length}/${cost.flatMap(c=> c.it12).length}; `
  + `flagged groups only (flagged rows) ${f(med(cost.filter(c=> c.evF).map(c=> c.evF/c.fitEv)), 2)}×; one refit without the flagged ${f(med(cost.filter(c=> c.evD).map(c=> c.evD/c.fitEv)), 2)}×.`);
console.log(L.join('\n'));
if (process.argv.includes('--rows')){
  console.log('\n| row | error | flag | flagged segments | worst | extents: error / local hw / jack 2sd (ln) | axis: error / local / jack ° |');
  console.log('|---|---|---|---|---|---|---|');
  for (const x of X.filter(x=> FLAG(x) || !x.clean)){
    const sl = score(x, 'local'), sj = score(x, 'jack 12'), sp = jackSpread(x.r, x.ck, 's12');
    console.log(`| ${x.row.id} | ${x.ek} ${f(x.es)} | ${FLAG(x) ? 'yes' : ''} | ${flaggedSegs(x).length}/${x.st.S} | ${x.why} | ${sl.ext.map((e, j)=> `${f(e.e)}/${f(e.wL)}/${f(sp ? 2*sp.sd[e.fi] : NaN)}`).join(', ')} | ${sl.ax ? `${f(sl.ax.e, 1)}/${f(sl.ax.radL, 1)}/${f(sj.ax.rad, 1)}` : '—'} |`);
  }
}
