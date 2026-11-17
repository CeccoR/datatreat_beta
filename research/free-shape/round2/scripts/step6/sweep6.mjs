#!/usr/bin/env node
/* Δ* and κ on the prototype's kept truths: coverage of C (κ·local, with the minima within Δ*) and J (with the
   jackknife where flagged), the median half-width, the principal axes (κA on the angles' 2·esdAngle) and the
   uniqueness verdicts, over a grid. node sweep6.mjs [--part tuning] [--p P] */
import { rowsOf, loadX, intervals, med, f } from './lib6.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } }
const X = loadX(rowsOf(opt.part || 'tuning').filter(r=> !opt.sub || (opt.sub === 'screen' ? r.screen : !r.screen)), String(opt.p || 'P').split(',')).filter(x=> x.truth && x.r.kept);
const G = [['clean (not flagged)', x=> x.clean && !x.flag], ['error, not flagged', x=> !x.clean && !x.flag], ['flagged', x=> x.flag]];
const L = [];
L.push('| rows | Δ* (flagged) | κ | extents covered C | J | median half-width C | axes C, κA 1 / 1.2 / 1.5 | unique | unique and C covers all |', '|---|---|---|---|---|---|---|---|---|');
for (const [nm, g] of G){
  const S = X.filter(g);
  for (const [d, dF] of [[12.5, 25], [16, 25], [20, 25], [25, 25], [16, 16], [16, 35]]) for (const k of [1, 1.1, 1.2, 1.3, 1.5]){
    if (nm.startsWith('clean') && dF !== 25) continue;
    if (nm === 'flagged' && d !== 16) continue;
    if (nm !== 'flagged' && dF !== 25) continue;
    const I = S.map(x=> intervals(x, { delta: d, deltaF: dF, kappa: k })), E = I.flatMap(i=> i.ext.filter(e=> !e.inf));
    const ax = ka => S.map(x=> intervals(x, { delta: d, deltaF: dF, kappa: k, kappaA: ka }).ax).filter(Boolean);
    const A1 = ax(1), A2 = ax(1.2), A3 = ax(1.5), U = I.filter(i=> i.n <= 1);
    L.push(`| ${nm} (${S.length}) | ${d} (${dF}) | ${k} | ${E.filter(e=> e.C).length}/${E.length} (${f(100*E.filter(e=> e.C).length/E.length, 0)} %) | ${E.filter(e=> e.J).length} | ${f(100*med(E.map(e=> e.hC)), 1)} % | ${A1.filter(t=> t.C).length} / ${A2.filter(t=> t.C).length} / ${A3.filter(t=> t.C).length} of ${A1.length} | ${U.length}/${I.length} | ${U.filter(i=> i.ext.every(e=> e.inf || e.C) && (!i.ax || i.ax.C)).length} |`);
  }
}
console.log(L.join('\n'));
