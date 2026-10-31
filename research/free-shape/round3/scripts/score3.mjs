#!/usr/bin/env node
/* Round 3's scoring of one part (step 6's score6.mjs): round 3's prototype (--p) against round 2's frozen one
   (--q), both on the exact line, reach against the best known over both and their truth references.
     node score3.mjs --part tuning|validation --p P --q Q [--sub screen|new] [--rows] [--out file.md]
   Outcome, spheres kept, reach, accuracy, anisotropy; cost (search, stage, report, isotropic fit); the two
   errors (lib3 intervals; E the engine's own lo–hi and radius); uniqueness; the check; the keep test; the
   minima stage's cap (explored, capped). */
import fs from 'node:fs';
import path from 'node:path';
import { HERE, rowsOf, loadX, byId, intervals, bestOf, reachDelta, accOf, spoiled, outc, med, qtl, sum, f, pc, LAUE, KINDS } from './lib3.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const part = opt.part || 'tuning', rows = rowsOf(part).filter(r=> !opt.sub || (opt.sub === 'screen' ? r.screen : !r.screen));
const O = { delta: 16, deltaF: 25, kappa: 1.2 };
const P = loadX(rows, String(opt.p || 'P').split(',')), Q = opt.q ? loadX(rows, String(opt.q).split(',')) : [];
const best = bestOf([P, Q, ...String(opt.best || '').split(',').filter(Boolean).map(t=> loadX(rows, [t]))]);
const L = [], truths = rows.filter(r=> r.kind === 'truth'), spheres = rows.filter(r=> r.kind === 'sphere');
L.push(`# Round 3: ${part} part${opt.sub ? ' (' + opt.sub + ')' : ''}, ${rows.length} rows (${truths.length} truths, ${spheres.length} spheres); round 3 ${P.length} records, round 2 ${Q.length}`, '');
const M = [['round 2', Q], ['round 3', P]].filter(([, X])=> X.length), D = {};
for (const [nm, X] of M) for (const x of X) (D[nm] ||= {})[x.row.id] = { x, out: outc(x.r), delta: reachDelta(x, best), acc: accOf(x) };
const ref = M[0][0];
L.push('| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× ' + ref + '; per run median) | of which the minima stage | report evaluations | not explored (capped) |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const evRef = sum(rows.map(r=> D[ref][r.id] ? D[ref][r.id].x.r.search.evals : 0));
for (const [nm] of M){
  const g = truths.map(r=> D[nm][r.id]).filter(Boolean), ks = g.filter(d=> d.acc), j = g.filter(d=> Number.isFinite(d.delta));
  const sp = spheres.map(r=> D[nm][r.id]).filter(Boolean), all = rows.map(r=> D[nm][r.id]).filter(Boolean);
  const ev = sum(all.map(d=> d.x.r.search.evals)), rat = rows.filter(r=> D[nm][r.id] && D[ref][r.id]).map(r=> D[nm][r.id].x.r.search.evals/D[ref][r.id].x.r.search.evals);
  const st = all.map(d=> d.x.r.stage || (d.x.r.info && d.x.r.info.minimaStage)).filter(Boolean);
  L.push(`| ${nm} | ${all.length} | ${g.filter(d=> d.out === 'held').length} / ${g.filter(d=> d.out === 'free').length} / ${g.filter(d=> d.out === 'rejected' || d.out === 'early').length} (${g.filter(d=> d.out === 'early').length}) | ${sp.filter(d=> d.x.clean && d.x.r.kept).length}/${sp.filter(d=> d.x.clean).length} / ${sp.filter(d=> !d.x.clean && d.x.r.kept).length}/${sp.filter(d=> !d.x.clean).length} | ${j.filter(d=> d.delta <= 1).length} / ${j.length} | ${ks.filter(d=> d.acc.worst === Infinity).length} | ${pc(med(ks.map(d=> d.acc.worst)))} (${pc(qtl(ks.map(d=> d.acc.worst), 0.9))}) | ${pc(med(ks.map(d=> d.acc.thin)))} | ${f(med(ks.map(d=> d.acc.axis)))} (${f(qtl(ks.map(d=> d.acc.axis), 0.9))}) | ${ev} (${f(ev/evRef, 3)}; ${f(med(rat), 3)}) | ${sum(all.map(d=> d.x.r.min ? d.x.r.min.evals : 0))} (max ${Math.max(0, ...all.map(d=> d.x.r.min ? d.x.r.min.evals : 0))}) | ${sum(all.map(d=> d.x.r.report ? d.x.r.report.evals || 0 : 0))} | ${st.filter(s=> s.explored === false).length} (${st.filter(s=> s.capped).length}) |`);
}
L.push('');
const both = (sel) => truths.filter(sel).filter(r=> M.every(([nm])=> D[nm][r.id] && D[nm][r.id].acc));
for (const [lab, sel] of [['clean', r=> !r.error], ['with an error', r=> !!r.error]]){
  const B = both(sel);
  L.push(`- ${lab} truths kept by ${M.length > 1 ? 'both' : 'it'} (${B.length}): ` + M.map(([nm])=> `${nm} worst ${pc(med(B.map(r=> D[nm][r.id].acc.worst)))} (90 % ${pc(qtl(B.map(r=> D[nm][r.id].acc.worst), 0.9))}), thinnest ${pc(med(B.map(r=> D[nm][r.id].acc.thin)))}, axis ${f(med(B.map(r=> D[nm][r.id].acc.axis)))}°, unbounded ${B.filter(r=> D[nm][r.id].acc.worst === Infinity).length}, anisotropy ${f(med(B.map(r=> D[nm][r.id].acc.aniso)), 2)}`).join('; '));
}
{ const ch = [], nr = {};
  for (const r of rows){ const x = D['round 3'] && D['round 3'][r.id], y = Q.length ? D['round 2'][r.id] : null; if (x && y && x.out !== y.out) ch.push(`${r.id} ${y.out} → ${x.out}`); }
  for (const [nm] of M) nr[nm] = rows.map(r=> D[nm][r.id]).filter(d=> d && Number.isFinite(d.delta) && d.delta > 1).map(d=> `${d.x.row.id}${d.x.clean ? '' : ' (' + d.x.ek + ')'} Δ ${f(d.delta, 1)}`);
  L.push('', `Outcome changed (round 2 → round 3) on ${ch.length}: ${ch.join('; ') || '—'}.`, '', ...M.map(([nm])=> `Not reached, ${nm} (${nr[nm].length}): ${nr[nm].join(', ') || 'none'}.`), ''); }
// the two errors
const groups = [['clean', x=> x.clean && !x.flag], ['clean, flagged', x=> x.clean && x.flag], ['error, not flagged', x=> !x.clean && !x.flag], ['error, flagged', x=> !x.clean && x.flag], ['all kept', x=> true]];
const pcn = (n, d) => `${n}/${d}${d ? ' (' + Math.round(100*n/d) + ' %)' : ''}`;
L.push('**The two errors** (kept truths; E the engine\'s reported interval and radius):', '', '| method | kept truths | runs | extents (unbounded) | E covered | median half-width E | principal axes E covered | median radius E | E radius ÷ error, clean misses |', '|---|---|---|---|---|---|---|---|---|');
for (const [nm, X] of M) for (const [gn, g] of groups){
  const G = X.filter(x=> x.truth && x.r.kept && x.r.report && !x.r.report.error).filter(g); if (!G.length) continue;
  const I = G.map(x=> ({ x, i: intervals(x, O) })), E = I.flatMap(t=> t.i.ext.filter(e=> !e.inf)), A = I.filter(t=> t.i.ax && t.i.ax.rE != null);
  const miss = gn === 'clean' ? A.filter(t=> !t.i.ax.E).map(t=> `${t.x.row.id} ${f(t.i.ax.e, 1)}/${f(t.i.ax.rE, 1)}°`) : [];
  L.push(`| ${nm} | ${gn} | ${G.length} | ${E.length} (${I.flatMap(t=> t.i.ext.filter(e=> e.inf)).length}) | ${pcn(E.filter(e=> e.E).length, E.length)} | ${f(100*med(E.map(e=> e.hE)), 1)} % | ${pcn(A.filter(t=> t.i.ax.E).length, A.length)} | ${f(med(A.map(t=> t.i.ax.rE)), 1)}° | ${miss.join(', ')} |`);
}
L.push('');
// uniqueness (round 3)
L.push('**Uniqueness** (round 3; one minimum within Δ*; covered by E):', '', '| kept truths | unique | unique, covered | several | several, covered |', '|---|---|---|---|---|');
for (const [gn, g] of groups.slice(0, 4)){
  const G = P.filter(x=> x.truth && x.r.kept && x.r.report && !x.r.report.error).filter(g).map(x=> ({ x, i: intervals(x, O) })); if (!G.length) continue;
  const ok = ({ i })=> i.ext.every(e=> e.inf || e.E) && (!i.ax || i.ax.E !== false);
  const U = G.filter(t=> t.i.n <= 1), S = G.filter(t=> t.i.n > 1);
  L.push(`| ${gn} | ${U.length}/${G.length} | ${U.filter(ok).length} | ${S.length} | ${S.filter(ok).length} |`);
}
L.push('');
// the check and the keep test
const zOf = x => x.chk ? Math.max(x.chk.zSeg || 0, x.chk.zBin || 0) : NaN;
L.push('**The per-line check** (round 3; the fit returned, or beside a rejection the isotropic fit):', '', '| rows | runs | flagged | spoiled | spoiled and flagged | z median / max |', '|---|---|---|---|---|---|');
for (const [nm, g] of [['clean truths', x=> x.clean && x.truth], ['clean spheres', x=> x.clean && !x.truth], ...KINDS.map(k=> [k, x=> x.ek === k]), ['all with an error', x=> !x.clean]]){
  const G = P.filter(g); if (!G.length) continue;
  L.push(`| ${nm} | ${G.length} | ${G.filter(x=> x.flag).length} | ${G.filter(spoiled).length} | ${G.filter(x=> spoiled(x) && x.flag).length} | ${f(med(G.map(zOf)), 2)} / ${f(Math.max(...G.map(zOf).filter(Number.isFinite)), 2)} |`);
}
L.push('', `Spoiled and not flagged: ${P.filter(x=> spoiled(x) && !x.flag).map(x=> `${x.row.id} (${x.ek}${x.row.error ? ' ' + f(x.row.error.strength, 2) : ''})`).join(', ') || 'none'}. Clean rows flagged: ${P.filter(x=> x.clean && x.flag).map(x=> x.row.id + ' z ' + f(zOf(x), 2)).join(', ') || 'none'}.`, '');
{ const G = P.filter(x=> x.truth && !x.clean && x.flag && x.r.kept && x.r.report && !x.r.report.error), I = G.map(x=> ({ x, i: intervals(x, O) }));
  L.push('**The jackknife** (round 3, flagged kept truths with an error, by kind: extents E covered / n, axes E covered / n):', '');
  for (const k of KINDS){ const H = I.filter(t=> t.x.ek === k), E = H.flatMap(t=> t.i.ext.filter(e=> !e.inf)), A = H.filter(t=> t.i.ax);
    if (H.length) L.push(`- ${k}: ${H.length} rows, extents ${E.filter(e=> e.E).length}/${E.length} (unbounded ${H.flatMap(t=> t.i.ext.filter(e=> e.inf)).length}), axes ${A.filter(t=> t.i.ax.E).length}/${A.length}`); }
  L.push(''); }
L.push('**The keep test** (shapes kept):', '', `| rows | runs | ${M.map(([nm])=> nm).join(' | ')} |`, `|---|---|${M.map(()=> '---|').join('')}`);
for (const [nm, sel] of [['clean truths', r=> r.kind === 'truth' && !r.error], ['truths with an error', r=> r.kind === 'truth' && !!r.error], ['clean spheres', r=> r.kind === 'sphere' && !r.error], ['spheres with an error', r=> r.kind === 'sphere' && !!r.error]]){
  const rs = rows.filter(sel).filter(r=> M.every(([m])=> D[m][r.id]));
  L.push(`| ${nm} | ${rs.length} | ${M.map(([m])=> rs.filter(r=> D[m][r.id].x.r.kept).length).join(' | ')} |`);
}
{ const k = x => x.r.keep || (x.r.info && x.r.info.keep) || null;
  L.push('', `Truths round 3 rejects: ${P.filter(x=> x.truth && !x.r.kept).map(x=> `${x.row.id} (${x.ek}; G ${f(k(x) && k(x).G, 1)}, need ${f(k(x) && k(x).need, 1)}${outc(x.r) === 'early' ? ', early' : ''})`).join('; ') || 'none'}.`, `Spheres round 3 keeps: ${P.filter(x=> !x.truth && x.r.kept).map(x=> `${x.row.id} (${x.ek}${x.row.error ? ' ' + f(x.row.error.strength, 2) : ''}${x.flag ? ', flagged' : ''})`).join('; ') || 'none'}.`, ''); }
if (opt.rows){
  L.push('| row | class | error | ' + M.map(([nm])=> nm + ': outcome, search evals, stage evals, Δ, worst, axis°, axis radius°').join(' | ') + ' | flag | minima ≤ Δ* | explored |', '|---|---|---|' + M.map(()=> '---|').join('') + '---|---|---|');
  for (const r of rows){
    const cell = nm => { const d = D[nm][r.id]; if (!d) return '—'; const iv = d.x.truth && d.x.r.kept && d.x.r.report && !d.x.r.report.error ? intervals(d.x, O) : null;
      return `${d.out}, ${d.x.r.search.evals}, ${d.x.r.min ? d.x.r.min.evals : 0}, ${f(d.delta, 1)}, ${d.acc ? pc(d.acc.worst) + ', ' + f(d.acc.axis) : '—, —'}, ${iv && iv.ax ? f(iv.ax.rE, 1) : '—'}`; };
    const x = D['round 3'] && D['round 3'][r.id], iv = x && x.x.truth && x.x.r.kept && x.x.r.report && !x.x.r.report.error ? intervals(x.x, O) : null, st = x && (x.x.r.stage || null);
    L.push(`| ${r.id} | ${r.laue} | ${r.error ? r.error.kind + ' ' + f(r.error.strength, 2) : ''} | ${M.map(([nm])=> cell(nm)).join(' | ')} | ${x && x.x.flag ? 'F' : ''} | ${iv ? iv.n : '—'} | ${st ? (st.explored === false ? 'no' + (st.capped ? ' (cap)' : '') : 'yes') : '—'} |`);
  }
}
const text = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(path.resolve(HERE, opt.out), text);
console.log(text);
