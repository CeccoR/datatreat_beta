#!/usr/bin/env node
/* Point 4: what the minima stage's cap loses. Each record of --tag (default P) whose stage the cap cut, against
   the same row run uncapped (--x, default PX): the stage's and the search's evaluations, the returned χ² (in
   χ²_ν), the outcome, the minima within Δ*, the reported intervals' coverage (E), and the minima matched.
   Also the stage's cost over all of --tag's rows, flagged and not. node cap3.mjs [--tag P --x PX] [--sel P: the rows that tag's cap cut] */
import { loadX, rowsOf, intervals, outc, f, sum, med, qtl, phaseQ, ENG } from './lib3.mjs';
const arg = (k, d) => process.argv.includes('--' + k) ? process.argv[process.argv.indexOf('--' + k) + 1] : d;
const TAG = arg('tag', 'P'), XT = arg('x', 'PX'), part = arg('part', 'tuning'), SEL = arg('sel', TAG);
const sel = new Set(loadX(rowsOf(part), [SEL]).filter(x=> x.r.stage && x.r.stage.capped).map(x=> x.row.id));
const P = loadX(rowsOf(part), [TAG]), X = Object.fromEntries(loadX(rowsOf(part), [XT]).map(x=> [x.row.id, x]));
const st = P.filter(x=> x.r.stage);
const L = [`cap: ${TAG} (${st.length} stages run) against ${XT} uncapped`, ''];
for (const [nm, g] of [['not flagged', s=> !s.r.stage.flagged], ['flagged', s=> s.r.stage.flagged]]){
  const G = st.filter(g), ev = G.map(x=> x.r.stage.evals);
  L.push(`- ${nm}: ${G.length} stages, evaluations ${sum(ev)} (median ${f(med(ev), 0)}, 90 % ${f(qtl(ev, 0.9), 0)}, max ${Math.max(...ev)}); capped ${G.filter(x=> x.r.stage.capped).length}; not explored ${G.filter(x=> x.r.stage.explored === false).length}`);
}
L.push('', '| row | error | stage evals capped / uncapped | search evals | returned χ² capped − uncapped (χ²_ν) | outcome | minima ≤ Δ*: capped / uncapped (the uncapped ones found) | extents E covered | axis E |', '|---|---|---|---|---|---|---|---|---|');
let T = { ev: 0, evX: 0, sev: 0, sevX: 0, m: 0, mX: 0, found: 0, worse: 0, ext: 0, extX: 0, ax: 0, axX: 0, n: 0 };
for (const x of st.filter(x=> sel.has(x.row.id))){
  const y = X[x.row.id]; if (!y) continue;
  const nu = Math.max(1, y.r.chi2nu || 1), dchi = (x.r.chi2 - y.r.chi2)/nu;
  const DS = x.flag ? 25 : 16, mx = (x.r.info.minima || []).filter(m=> m.delta <= DS), my = (y.r.info.minima || []).filter(m=> m.delta <= DS);
  const q0 = phaseQ(x.row.phase), q = { shapeType: x.r.solid.type, laue: q0.laue, Bm: q0.Bm }, found = my.filter(m=> mx.some(d=> ENG.minimaMatch(q, m, d, true).r <= 1)).length;
  const cov = z => { if (!z.truth || !z.r.kept || !z.r.report || z.r.report.error) return null; const iv = intervals(z); return { e: iv.ext.filter(e=> e.inf || e.E).length, n: iv.ext.length, a: iv.ax ? (iv.ax.E ? 1 : 0) : null }; };
  const cx = cov(x), cy = cov(y);
  T.n++; T.ev += x.r.stage.evals; T.evX += y.r.stage ? y.r.stage.evals : 0; T.sev += x.r.search.evals; T.sevX += y.r.search.evals; T.m += mx.length; T.mX += my.length; T.found += found; if (dchi > 0.5) T.worse++;
  if (cx && cy){ T.ext += cx.e; T.extX += cy.e; T.ax += cx.a || 0; T.axX += cy.a || 0; }
  L.push(`| ${x.row.id} | ${x.row.error ? x.row.error.kind + ' ' + f(x.row.error.strength, 2) : ''} | ${x.r.stage.evals} / ${y.r.stage ? y.r.stage.evals : '—'} | ${x.r.search.evals} / ${y.r.search.evals} | ${f(dchi, 2)} | ${outc(x.r)} / ${outc(y.r)} | ${mx.length} / ${my.length} (${found}) | ${cx ? cx.e + '/' + cx.n : '—'} / ${cy ? cy.e + '/' + cy.n : '—'} | ${cx ? cx.a : '—'} / ${cy ? cy.a : '—'} |`);
}
L.push('', `Over the ${T.n} rows ${SEL} capped: stage ${T.ev} against ${T.evX} evaluations (${f(T.ev/T.evX, 2)}×), search ${T.sev} against ${T.sevX} (${f(T.sev/T.sevX, 2)}×); returned χ² higher by > 0.5 χ²_ν on ${T.worse}; minima within Δ* ${T.m} against ${T.mX}, of the uncapped ones found ${T.found}; extents covered ${T.ext} against ${T.extX}, axes ${T.ax} against ${T.axX}.`);
console.log(L.join('\n'));
