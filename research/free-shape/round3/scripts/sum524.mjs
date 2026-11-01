#!/usr/bin/env node
/* v524's confirmation (V524.md): each tag on the 77 screening runs of round 3's tuning part, reach against the
   best known over every tag listed and the truth references; outcomes, accuracy, the engine's intervals (E), the
   check, the keep test, evaluations.  node sum524.mjs Z,Z1,Z2,N */
import { rowsOf, loadX, intervals, bestOf, reachDelta, accOf, outc, med, qtl, sum, f, pc } from './lib3.mjs';
const tags = (process.argv[2] || 'Z,N').split(','), rows = rowsOf('tuning').filter(r=> r.screen);
const O = { delta: 16, deltaF: 25, kappa: 1.2 };
const X = Object.fromEntries(tags.map(t=> [t, loadX(rows, [t])])), best = bestOf(Object.values(X));
const L = ['| tag | runs | truths held / free / rejected | spheres kept clean / error | reached / judged | clean not reached (Δ χ²_ν) | clean worst extent, median (90 %) | clean axis °, median | clean extents in E | clean principal axes in E | all kept: extents in E, axes in E | flagged | kept: clean / error truths | search evaluations | report evaluations |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const t of tags){
  const A = X[t], T = A.filter(x=> x.truth), S = A.filter(x=> !x.truth), D = T.map(x=> ({ x, d: reachDelta(x, best) })).filter(o=> Number.isFinite(o.d));
  const ck = T.filter(x=> x.clean && x.r.kept).map(x=> ({ x, a: accOf(x) })).filter(o=> o.a);
  const I = T.filter(x=> x.r.kept && x.r.report && !x.r.report.error).map(x=> ({ x, i: intervals(x, O) }));
  const Ic = I.filter(o=> o.x.clean), ext = J => J.flatMap(o=> o.i.ext.filter(e=> !e.inf)), ax = J => J.filter(o=> o.i.ax && o.i.ax.rE != null);
  const cnt = (J, k) => `${k(J).filter(Boolean).length}/${k(J).length}`;
  L.push(`| ${t} | ${A.length} | ${T.filter(x=> outc(x.r) === 'held').length} / ${T.filter(x=> outc(x.r) === 'free').length} / ${T.filter(x=> ['rejected', 'early'].includes(outc(x.r))).length} | ${S.filter(x=> x.clean && x.r.kept).length}/${S.filter(x=> x.clean).length} / ${S.filter(x=> !x.clean && x.r.kept).length}/${S.filter(x=> !x.clean).length} | ${D.filter(o=> o.d <= 1).length} / ${D.length} | ${D.filter(o=> o.d > 1 && o.x.clean).map(o=> `${o.x.row.id} ${f(o.d, 1)}`).join(', ') || '—'} | ${pc(med(ck.map(o=> o.a.worst)))} (${pc(qtl(ck.map(o=> o.a.worst), 0.9))}) | ${f(med(ck.map(o=> o.a.axis)))} | ${cnt(Ic, J=> ext(J).map(e=> e.E))} | ${cnt(Ic, J=> ax(J).map(o=> o.i.ax.E))} | ${cnt(I, J=> ext(J).map(e=> e.E))}, ${cnt(I, J=> ax(J).map(o=> o.i.ax.E))} | ${A.filter(x=> x.flag).length} | ${T.filter(x=> x.clean && x.r.kept).length} / ${T.filter(x=> !x.clean && x.r.kept).length} | ${sum(A.map(x=> x.r.search.evals))} | ${sum(A.map(x=> x.r.report ? x.r.report.evals || 0 : 0))} |`);
}
L.push('', 'Not reached (Δ > 1 χ²_ν against the best known over ' + tags.join(', ') + '), every row:');
for (const t of tags) L.push(`- ${t}: ` + X[t].filter(x=> x.truth).map(x=> ({ x, d: reachDelta(x, best) })).filter(o=> o.d > 1).map(o=> `${o.x.row.id}${o.x.clean ? '' : ' (' + o.x.ek + ')'} ${f(o.d, 1)}`).join(', '));
console.log(L.join('\n'));
