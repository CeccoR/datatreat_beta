#!/usr/bin/env node
/* [fix] The solids with a margin: from xconf.mjs --json, per line model and row, the true family's
   margin over the best other family (families: box + square box, cylinder + elliptic cylinder,
   ellipsoid + spheroid), by χ² (in χ²_ν,iso units) and by BIC; a row counts as the right family only
   when that margin exceeds m, as another family only when the other family wins by more than m, and
   as undetermined in between. Within the right family: the true solid or its nested partner (by χ²
   or BIC as the column). m = 0 is xconf's count.
   node fix/xmargin.mjs results/xconf3.json [--m 0,2,6,10] [--out file.md] */
import fs from 'node:fs';
const a = process.argv.slice(2), opt = {};
for (let i = 1; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1]; i++; } }
const X = JSON.parse(fs.readFileSync(a[0], 'utf8'));
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball' };
const MS = String(opt.m || '0,2,6,10').split(',').map(Number);
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const L = [], J = {};
for (const [name, rows] of Object.entries(X)){
  const per = rows.filter(r=> !r.missing).map(r=> {
    const t = r.id.split('-')[0], ft = FAM[t], sc = r.per[r.have[0]].sc;
    const best = (key, inFam) => Math.min(...r.have.filter(s=> (FAM[s] === ft) === inFam).map(s=> key === 'chi2' ? r.per[s].chi2/sc : r.per[s].bic));
    const o = { id: r.id, truth: t };
    for (const key of ['chi2', 'bic']){
      const mine = best(key, true), other = best(key, false);
      o[key] = { margin: other - mine, pick: (key === 'chi2' ? r.byChi : r.byBic)[0] };
      o[key].otherFam = r.have.filter(s=> FAM[s] !== ft).sort((p, q)=> (key === 'chi2' ? r.per[p].chi2 - r.per[q].chi2 : r.per[p].bic - r.per[q].bic))[0];
    }
    return o;
  });
  J[name] = per;
  L.push(`## ${name}`, '', '| row | truth | margin χ²/χ²_ν (best other family) | pick by χ² | margin BIC (best other family) | pick by BIC |', '|---|---|---|---|---|---|');
  for (const o of per) L.push(`| ${o.id} | ${o.truth} | ${f(o.chi2.margin)} (${o.chi2.otherFam}) | ${o.chi2.pick} | ${f(o.bic.margin)} (${o.bic.otherFam}) | ${o.bic.pick} |`);
  L.push('', '| margin m | by χ²: right solid / nested / undetermined / other family | by BIC: right / nested / undetermined / other |', '|---|---|---|');
  for (const m of MS){
    const cnt = key => { let r = 0, n = 0, u = 0, w = 0; for (const o of per){ const g = o[key].margin; if (m === 0 ? g > 0 : g > m){ if (o[key].pick === o.truth) r++; else n++; } else if (m === 0 ? g < 0 : g < -m) w++; else u++; } return `${r} / ${n} / ${u} / ${w}`; };
    L.push(`| ${m} | ${cnt('chi2')} | ${cnt('bic')} |`);
  }
  L.push('');
}
const text = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, text);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(J));
console.log(text);
