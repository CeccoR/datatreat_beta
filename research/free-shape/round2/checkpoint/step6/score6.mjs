#!/usr/bin/env node
/* Step 6's scoring of one part, the prototype against today's search, as the confirmation and the validation
   read it:
     node score6.mjs --part tuning|validation --p P --t ../pilot/results/screen,T [--best extra tags]
                     [--delta 16 --deltaF 25 --kappa 1.2] [--rows] [--out file.md] [--json file.json]
   - outcome (held / free / rejected, early apart), spheres kept, reach (Δ ≤ 1 against the best known exact χ²
     of the same line: the run's own and its truth reference's chi2Best, and --best's records of the row's own
     solid), accuracy of the kept truths (worst |extent error|, +∞ unbounded; the thinnest's signed error; the
     most distinct axis), anisotropy (longest/thinnest read ÷ true) on the clean truths both kept;
   - cost: evaluations and walls of the isotropic fit, the search and the report;
   - the two errors (lib6 intervals): coverage and half-width of L (κ·local), C (with the minima), J (with the
     jackknife where the check fired), E (the engine's own lo–hi), and today's esds (L at κ 1);
   - uniqueness verdicts; the per-line check's false alarms and detections; the keep test's outcomes. */
import fs from 'node:fs';
import path from 'node:path';
import { HERE, rowsOf, loadX, byId, intervals, bestOf, reachDelta, accOf, spoiled, outc, med, qtl, sum, f, pc, LAUE, KINDS } from './lib6.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const part = opt.part || 'tuning', rows = rowsOf(part);
const O = { delta: +(opt.delta || 16), deltaF: +(opt.deltaF || 25), kappa: +(opt.kappa || 1.2) };
const P = loadX(rows, String(opt.p || 'P').split(',')), T = loadX(rows, String(opt.t || '../pilot/results/screen,T').split(','));
const extraP = String(opt.best || '').split(',').filter(Boolean).map(t=> loadX(rows, [t]));
const bestP = bestOf([P, ...extraP]), bestT = bestOf([T]);
const PI = byId(P), TI = byId(T), L = [];
const truths = rows.filter(r=> r.kind === 'truth'), spheres = rows.filter(r=> r.kind === 'sphere');
L.push(`# Step 6: ${part} part, ${rows.length} rows (${truths.length} truths, ${spheres.length} spheres); prototype ${P.length} records, today ${T.length}`, '');
L.push(`Δ* ${O.delta} (flagged ${O.deltaF}), κ ${O.kappa}. Reach against the best known exact χ² of the same line (prototype: exact line, its runs${extraP.length ? ' and ' + opt.best : ''} with their truth references; today: Lorentzian, its run and truth reference).`, '');
// 1. overall
const M = [['today', T, TI, bestT], ['prototype', P, PI, bestP]];
const D = {};
for (const [nm, X, I, best] of M) for (const x of X){ (D[nm] ||= {})[x.row.id] = { x, out: outc(x.r), delta: reachDelta(x, best), acc: accOf(x) }; }
L.push('| method | runs | truths: held / free / rejected (early) | spheres kept: clean / error | reached / judged | unbounded | worst, median (90 %) | thinnest | axis °, median (90 %) | search evaluations (× today; per run median) | report evaluations | isotropic fit evaluations |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
const evT = sum(rows.map(r=> D.today && D.today[r.id] ? D.today[r.id].x.r.search.evals : 0));
for (const [nm] of M){
  const g = truths.map(r=> D[nm] && D[nm][r.id]).filter(Boolean), ks = g.filter(d=> d.acc), j = g.filter(d=> Number.isFinite(d.delta));
  const sp = spheres.map(r=> D[nm] && D[nm][r.id]).filter(Boolean), all = rows.map(r=> D[nm] && D[nm][r.id]).filter(Boolean);
  const ev = sum(all.map(d=> d.x.r.search.evals)), rat = rows.filter(r=> D[nm][r.id] && D.today[r.id]).map(r=> D[nm][r.id].x.r.search.evals/D.today[r.id].x.r.search.evals);
  L.push(`| ${nm} | ${all.length} | ${g.filter(d=> d.out === 'held').length} / ${g.filter(d=> d.out === 'free').length} / ${g.filter(d=> d.out === 'rejected' || d.out === 'early').length} (${g.filter(d=> d.out === 'early').length}) | ${sp.filter(d=> d.x.clean && d.x.r.kept).length}/${sp.filter(d=> d.x.clean).length} / ${sp.filter(d=> !d.x.clean && d.x.r.kept).length}/${sp.filter(d=> !d.x.clean).length} | ${j.filter(d=> d.delta <= 1).length} / ${j.length} | ${ks.filter(d=> d.acc.worst === Infinity).length} | ${pc(med(ks.map(d=> d.acc.worst)))} (${pc(qtl(ks.map(d=> d.acc.worst), 0.9))}) | ${pc(med(ks.map(d=> d.acc.thin)))} | ${f(med(ks.map(d=> d.acc.axis)))} (${f(qtl(ks.map(d=> d.acc.axis), 0.9))}) | ${ev} (${f(ev/evT, 3)}; ${f(med(rat), 3)}) | ${sum(all.map(d=> d.x.r.report ? d.x.r.report.evals || 0 : 0))} | ${sum(all.map(d=> d.x.o.iso.evals))} |`);
}
L.push('');
// accuracy split by clean / error, kept by both
for (const [lab, sel] of [['clean', r=> !r.error], ['with an error', r=> !!r.error]]){
  const both = truths.filter(sel).filter(r=> D.today[r.id] && D.prototype[r.id] && D.today[r.id].acc && D.prototype[r.id].acc);
  L.push(`- ${lab} truths kept by both (${both.length}): worst ${pc(med(both.map(r=> D.today[r.id].acc.worst)))} → ${pc(med(both.map(r=> D.prototype[r.id].acc.worst)))} (90 %: ${pc(qtl(both.map(r=> D.today[r.id].acc.worst), 0.9))} → ${pc(qtl(both.map(r=> D.prototype[r.id].acc.worst), 0.9))}), thinnest ${pc(med(both.map(r=> D.today[r.id].acc.thin)))} → ${pc(med(both.map(r=> D.prototype[r.id].acc.thin)))}, axis ${f(med(both.map(r=> D.today[r.id].acc.axis)))}° → ${f(med(both.map(r=> D.prototype[r.id].acc.axis)))}°; unbounded ${both.filter(r=> D.today[r.id].acc.worst === Infinity).length} → ${both.filter(r=> D.prototype[r.id].acc.worst === Infinity).length}`);
}
const clean = truths.filter(r=> !r.error && D.today[r.id] && D.prototype[r.id] && D.today[r.id].acc && D.prototype[r.id].acc);
L.push('', `Anisotropy (longest/thinnest read ÷ true) on the ${clean.length} clean truths both kept: median, median |ln|, outside 0.9–1.1:`);
for (const [nm] of M){ const xs = clean.map(r=> D[nm][r.id].acc.aniso); L.push(`- ${nm}: ${f(med(xs), 2)}, ${f(med(xs.map(y=> Math.abs(Math.log(y)))), 3)}, ${xs.filter(y=> y < 0.9 || y > 1.1).length}`); }
L.push('');
// changes row by row
{ const ch = [], lost = [], gained = [];
  for (const r of rows){ const x = D.prototype[r.id], y = D.today[r.id]; if (!x || !y) continue;
    if (x.out !== y.out) ch.push(`${r.id} ${y.out} → ${x.out}`);
    if (Number.isFinite(x.delta) && x.delta > 1) lost.push(`${r.id} (Δ ${f(x.delta, 1)})`);
    if (Number.isFinite(y.delta) && y.delta > 1) gained.push(`${r.id} (Δ ${f(y.delta, 1)})`); }
  L.push(`Outcome prototype ≠ today on ${ch.length}: ${ch.join('; ')}.`, '', `Not reached, prototype: ${lost.join(', ') || 'none'}. Today: ${gained.join(', ') || 'none'}.`, ''); }
// 2. cost
L.push('**Cost** (sums; walls in s; the prototype\'s report includes the jackknife where the check fired):', '', '| method | search evaluations | report | isotropic fit | wall: search | report | isotropic fit | ms an evaluation, search (median) |', '|---|---|---|---|---|---|---|---|');
for (const [nm] of M){ const g = rows.map(r=> D[nm][r.id]).filter(Boolean).map(d=> d.x);
  L.push(`| ${nm} | ${sum(g.map(x=> x.r.search.evals))} | ${sum(g.map(x=> x.r.report ? x.r.report.evals || 0 : 0))} | ${sum(g.map(x=> x.o.iso.evals))} | ${f(sum(g.map(x=> x.r.search.ms))/1000, 0)} | ${f(sum(g.map(x=> x.r.report ? x.r.report.ms || 0 : 0))/1000, 0)} | ${f(sum(g.map(x=> x.o.iso.ms))/1000, 0)} | ${f(med(g.map(x=> x.r.search.ms/x.r.search.evals)), 2)} |`); }
{ const g = rows.filter(r=> D.prototype[r.id] && D.prototype[r.id].x.r.min).map(r=> D.prototype[r.id].x.r);
  L.push('', `The minima stage: ${sum(g.map(r=> r.min.evals))} of the prototype's search evaluations (${f(sum(g.map(r=> r.min.evals))/sum(g.map(r=> r.search.evals - r.min.evals)), 2)}× the rest of the search).`); }
L.push('', '| class | ' + LAUE.join(' | ') + ' |', '|---|' + LAUE.map(()=> '---|').join(''));
L.push('| search evaluations, prototype ÷ today | ' + LAUE.map(l=> { const rs = rows.filter(r=> r.laue === l && D.prototype[r.id] && D.today[r.id]); return f(sum(rs.map(r=> D.prototype[r.id].x.r.search.evals))/sum(rs.map(r=> D.today[r.id].x.r.search.evals)), 2); }).join(' | ') + ' |', '');
// 3. the two errors
const groups = [['clean', x=> x.clean && !x.flag], ['clean, flagged', x=> x.clean && x.flag], ['error, not flagged', x=> !x.clean && !x.flag], ['error, flagged', x=> !x.clean && x.flag], ['all kept', x=> true]];
const keptP = P.filter(x=> x.truth && x.r.kept);
L.push('**The two errors** (prototype; kept truths; extents in ln D; an unbounded extent apart):', '', '| kept truths | runs | extents (unbounded) | L κ local | B minima alone | C both | J with the jackknife | E engine lo–hi | median half-width L / C / J | principal axes L / C / J / E | median radius L / C / J |', '|---|---|---|---|---|---|---|---|---|---|---|');
const pcn = (n, d) => `${n}/${d}${d ? ' (' + Math.round(100*n/d) + ' %)' : ''}`;
for (const [nm, g] of groups){
  const G = keptP.filter(g); if (!G.length) continue;
  const I = G.map(x=> intervals(x, O)), E = I.flatMap(i=> i.ext.filter(e=> !e.inf)), A = I.map(i=> i.ax).filter(Boolean), c = k => E.filter(e=> e[k]).length;
  L.push(`| ${nm} | ${G.length} | ${E.length} (${I.flatMap(i=> i.ext.filter(e=> e.inf)).length}) | ${pcn(c('L'), E.length)} | ${pcn(c('B'), E.length)} | ${pcn(c('C'), E.length)} | ${pcn(c('J'), E.length)} | ${pcn(c('E'), E.length)} | ${f(100*med(E.map(e=> e.hL)), 1)} / ${f(100*med(E.map(e=> e.hC)), 1)} / ${f(100*med(E.map(e=> e.hJ)), 1)} % | ${A.filter(t=> t.L).length} / ${A.filter(t=> t.C).length} / ${A.filter(t=> t.J).length} / ${A.filter(t=> t.E).length} of ${A.length} | ${f(med(A.map(t=> t.rL)), 1)} / ${f(med(A.map(t=> t.rC)), 1)} / ${f(med(A.map(t=> t.rJ)), 1)}° |`);
}
const keptT = T.filter(x=> x.truth && x.r.kept && x.r.report && !x.r.report.error);
L.push('', '| today\'s esds (κ 1) | runs | extents (unbounded) | covered | median half-width | principal axes covered (2·esdAngle) | median radius |', '|---|---|---|---|---|---|---|');
for (const [nm, g] of [['clean', x=> x.clean], ['with an error', x=> !x.clean], ['all kept', x=> true]]){
  const G = keptT.filter(g), I = G.map(x=> intervals(x, { kappa: 1 })), E = I.flatMap(i=> i.ext.filter(e=> !e.inf)), A = I.map(i=> i.ax).filter(Boolean);
  L.push(`| ${nm} | ${G.length} | ${E.length} (${I.flatMap(i=> i.ext.filter(e=> e.inf)).length}) | ${pcn(E.filter(e=> e.L).length, E.length)} | ${f(100*med(E.map(e=> e.hL)), 1)} % | ${A.filter(t=> t.L).length} of ${A.length} | ${f(med(A.map(t=> t.rL)), 1)}° |`);
}
{ const Ez = keptP.filter(x=> x.clean && !x.flag).flatMap(x=> intervals(x, O).ext.filter(e=> !e.inf && Number.isFinite(e.z))), zs = Ez.map(e=> Math.abs(e.z)).sort((p, q)=> p - q), z5 = zs.filter(z=> z < 5);
  L.push('', `Local z (D's error over the curvature's σ, κ 1) on the clean kept truths, not flagged (${zs.length} extents): median |z| ${f(med(zs), 2)} (normal 0.67), rms of |z| < 5 ${f(Math.sqrt(sum(z5.map(z=> z*z))/z5.length), 2)}, beyond 2: ${zs.filter(z=> z > 2).length}, 3: ${zs.filter(z=> z > 3).length}, 5: ${zs.filter(z=> z > 5).length}.`, ''); }
// 4. uniqueness
L.push('**Uniqueness** (one minimum within Δ*):', '', '| kept truths | unique | unique, L covers all | several | several: L covers | only C | neither | with J: unique / several covered |', '|---|---|---|---|---|---|---|---|');
for (const [nm, g] of groups){
  const G = keptP.filter(g).map(x=> ({ x, i: intervals(x, O) })); if (!G.length) continue;
  const ok = k => ({ i })=> i.ext.every(e=> e.inf || e[k]) && (!i.ax || i.ax[k]);
  const U = G.filter(t=> t.i.n <= 1), S = G.filter(t=> t.i.n > 1);
  L.push(`| ${nm} | ${U.length}/${G.length} | ${U.filter(ok('L')).length} | ${S.length} | ${S.filter(ok('L')).length} | ${S.filter(t=> !ok('L')(t) && ok('C')(t)).length} | ${S.filter(t=> !ok('C')(t)).length} | ${U.filter(ok('J')).length}/${U.length} / ${S.filter(ok('J')).length}/${S.length} |`);
}
L.push('');
// 5. the per-line check
L.push('**The per-line check** (prototype: the fit returned, or beside a rejection the isotropic fit):', '', '| rows | runs | flagged | spoiled | spoiled and flagged | z (worst of the two), median / max |', '|---|---|---|---|---|---|');
const zOf = x => x.chk ? Math.max(x.chk.zSeg || 0, x.chk.zBin || 0) : NaN;
for (const [nm, g] of [['clean truths', x=> x.clean && x.truth], ['clean spheres', x=> x.clean && !x.truth], ...KINDS.map(k=> [k, x=> x.ek === k]), ['all with an error', x=> !x.clean]]){
  const G = P.filter(g); if (!G.length) continue;
  L.push(`| ${nm} | ${G.length} | ${G.filter(x=> x.flag).length} | ${G.filter(spoiled).length} | ${G.filter(x=> spoiled(x) && x.flag).length} | ${f(med(G.map(zOf)), 2)} / ${f(Math.max(...G.map(zOf).filter(Number.isFinite)), 2)} |`);
}
{ const miss = P.filter(x=> spoiled(x) && !x.flag); L.push('', `Spoiled and not flagged: ${miss.map(x=> `${x.row.id} (${x.ek}${x.row.error ? ' ' + f(x.row.error.strength, 2) : ''})`).join(', ') || 'none'}. Clean rows flagged: ${P.filter(x=> x.clean && x.flag).map(x=> x.row.id + ' z ' + f(zOf(x), 2)).join(', ') || 'none'}.`, ''); }
// 6. the keep test
L.push('**The keep test** (shapes kept):', '', '| rows | runs | today | prototype |', '|---|---|---|---|');
for (const [nm, sel] of [['clean truths', r=> r.kind === 'truth' && !r.error], ['truths with an error', r=> r.kind === 'truth' && !!r.error], ['clean spheres', r=> r.kind === 'sphere' && !r.error], ['spheres with an error', r=> r.kind === 'sphere' && !!r.error]]){
  const rs = rows.filter(sel).filter(r=> D.today[r.id] && D.prototype[r.id]);
  L.push(`| ${nm} | ${rs.length} | ${rs.filter(r=> D.today[r.id].x.r.kept).length} | ${rs.filter(r=> D.prototype[r.id].x.r.kept).length} |`);
}
{ const rej = P.filter(x=> x.truth && !x.r.kept), sk = P.filter(x=> !x.truth && x.r.kept), k = x => x.r.keep || (x.r.info && x.r.info.keep) || null;
  L.push('', `Truths the prototype rejects: ${rej.map(x=> `${x.row.id} (${x.ek}; G ${f(k(x) && k(x).G, 1)}, need ${f(k(x) && k(x).need, 1)}${k(x) && k(x).flagged ? ', flagged' : ''}${outc(x.r) === 'early' ? ', early' : ''}; today ${D.today[x.row.id] ? D.today[x.row.id].out : '—'})`).join('; ') || 'none'}.`);
  L.push('', `Spheres the prototype keeps: ${sk.map(x=> `${x.row.id} (${x.ek}${x.row.error ? ' ' + f(x.row.error.strength, 2) : ''}, ${f(x.row.D, 1)} nm; G ${f(k(x) && k(x).G, 1)}, need ${f(k(x) && k(x).need, 1)}${x.flag ? ', flagged' : ''}; today ${D.today[x.row.id] ? D.today[x.row.id].out : '—'})`).join('; ') || 'none'}. Today keeps: ${T.filter(x=> !x.truth && x.r.kept).map(x=> x.row.id).join(', ') || 'none'}.`, ''); }
// 7. per row
if (opt.rows){
  L.push('| row | class | error | today: outcome, evals, Δ, worst, thinnest, axis | prototype: outcome, evals, Δ, worst, thinnest, axis | flag | minima ≤ Δ* | extents covered (C/J) |', '|---|---|---|---|---|---|---|---|');
  for (const r of rows){
    const cell = nm => { const d = D[nm] && D[nm][r.id]; return !d ? '—' : `${d.out}, ${d.x.r.search.evals}, ${f(d.delta, 2)}, ${d.acc ? pc(d.acc.worst) + ', ' + pc(d.acc.thin) + ', ' + f(d.acc.axis) + '°' : '—'}`; };
    const x = PI[r.id], iv = x && x.truth && x.r.kept ? intervals(x, O) : null;
    L.push(`| ${r.id} | ${r.laue} | ${r.error ? r.error.kind + ' ' + f(r.error.strength, 2) : ''} | ${cell('today')} | ${cell('prototype')} | ${x && x.flag ? 'F' : ''} | ${iv ? iv.n : '—'} | ${iv ? iv.ext.filter(e=> e.inf || e.C).length + '/' + iv.ext.filter(e=> e.inf || e.J).length + ' of ' + iv.ext.length : '—'} |`);
  }
  L.push('');
}
const text = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(path.resolve(HERE, opt.out), text);
if (opt.json) fs.writeFileSync(path.resolve(HERE, opt.json), JSON.stringify(Object.fromEntries(Object.entries(D).map(([k, m])=> [k, Object.fromEntries(Object.entries(m).map(([id, d])=> [id, { out: d.out, delta: d.delta, acc: d.acc, evals: d.x.r.search.evals, flag: d.x.flag }]))])), (k, v)=> typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));
console.log(text);
