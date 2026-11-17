#!/usr/bin/env node
/* The family verdicts of runs made with SHAPE_FAMILY.solids 'general' (the engine's familyVerdict, margins
   14 / 35, nested 3.84 / 5.99 / 5.99, 25 flagged): right / not determined / wrong against the truth's family,
   the nested verdict where the winner is the truth's family, and the cost against the chosen solid's run.
   node fam6.mjs --part tuning|validation --tag FAM [--ref P] [--rows] */
import { rowsOf, loadX, byId, f, med, sum } from './lib6.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball', sphere: 'ball' };
const GEN = new Set(['box', 'ellcyl', 'ellipsoid']);
const rows = rowsOf(opt.part || 'tuning').filter(r=> r.kind === 'truth');
const X = loadX(rows, [opt.tag || 'FAM']), R = byId(loadX(rows, [opt.ref || 'P']));
const V = X.map(x=> { const fam = x.r.family || (x.r.info && x.r.info.family) || null; return { x, fam, tf: FAM[x.row.solid] }; }).filter(v=> v.fam);
const sc = v => !v.fam.determined ? 'nd' : v.fam.family === v.tf ? 'right' : 'wrong';
const L = [];
L.push(`${V.length} truths with a verdict (of ${X.length} runs)`, '', '| truths | right | not determined (truth among the named) | wrong |', '|---|---|---|---|');
for (const [nm, g] of [['clean', v=> !v.x.row.error], ['with an error', v=> !!v.x.row.error], ['all', v=> true]]){
  const G = V.filter(g);
  L.push(`| ${nm} (${G.length}) | ${G.filter(v=> sc(v) === 'right').length} | ${G.filter(v=> sc(v) === 'nd').length} (${G.filter(v=> sc(v) === 'nd' && v.fam.within.includes(v.tf)).length}) | ${G.filter(v=> sc(v) === 'wrong').length} |`);
}
const wr = V.filter(v=> sc(v) === 'wrong');
L.push('', `Wrong: ${wr.map(v=> `${v.x.row.id} (${v.x.row.error ? v.x.row.error.kind + ' ' + f(v.x.row.error.strength, 2) : 'clean'}; ${v.fam.family} by ${f(v.fam.margin, 1)}, need ${v.fam.need})`).join('; ') || 'none'}.`);
const nd = V.filter(v=> sc(v) === 'nd'), ndW = nd.filter(v=> v.fam.family !== v.tf);
L.push('', `Not determined: the winner wrong on ${ndW.length} of ${nd.length}; the truth not among the named on ${nd.filter(v=> !v.fam.within.includes(v.tf)).map(v=> v.x.row.id).join(', ') || 'none'}.`);
// the nested verdict where the winner is the truth's family
const N = V.filter(v=> v.fam.family === v.tf && v.fam.nested);
const spec = N.filter(v=> !GEN.has(v.x.row.solid)), gen = N.filter(v=> GEN.has(v.x.row.solid));
L.push('', `Nested, the winner the truth's family (${N.length}): special truths given the special member ${spec.filter(v=> v.fam.solid === v.x.row.solid).length} of ${spec.length}; general truths given the general ${gen.filter(v=> v.fam.solid === v.x.row.solid).length} of ${gen.length} (given the special: ${gen.filter(v=> v.fam.solid !== v.x.row.solid).map(v=> `${v.x.row.id} Δ ${f(v.fam.nested.delta, 1)}`).join(', ') || 'none'}); special truths given the general: ${spec.filter(v=> v.fam.solid !== v.x.row.solid).map(v=> `${v.x.row.id} Δ ${f(v.fam.nested.delta, 1)}`).join(', ') || 'none'}.`);
// cost
const both = V.filter(v=> R[v.x.row.id]);
const cost = both.map(v=> v.x.r.search.evals/R[v.x.row.id].r.search.evals), ms = both.map(v=> v.x.r.search.ms/R[v.x.row.id].r.search.ms);
L.push('', `Cost against the chosen solid's run (${both.length}): search evaluations ${f(sum(both.map(v=> v.x.r.search.evals))/sum(both.map(v=> R[v.x.row.id].r.search.evals)), 2)}× (median ${f(med(cost), 2)}×), wall ${f(sum(both.map(v=> v.x.r.search.ms))/sum(both.map(v=> R[v.x.row.id].r.search.ms)), 2)}× (median ${f(med(ms), 2)}×); the chosen solid's χ² equal to its run's on ${both.filter(v=> Math.abs(v.x.r.chi2 - R[v.x.row.id].r.chi2) < 1e-6*R[v.x.row.id].r.chi2).length}.`);
if (opt.rows){
  L.push('', '| row | error | verdict | family (by) | margin, need | within | solid (nested Δ, need) |', '|---|---|---|---|---|---|---|');
  for (const v of V) L.push(`| ${v.x.row.id} | ${v.x.row.error ? v.x.row.error.kind + ' ' + f(v.x.row.error.strength, 2) : ''} | ${sc(v)} | ${v.fam.family} (${v.fam.by}) | ${f(v.fam.margin, 1)}, ${v.fam.need} | ${v.fam.within.join(' ')} | ${v.fam.solid}${v.fam.nested ? ` (${f(v.fam.nested.delta, 1)}, ${v.fam.nested.need})` : ''} |`);
}
console.log(L.join('\n'));
