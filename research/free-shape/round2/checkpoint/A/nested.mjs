#!/usr/bin/env node
/* The confusion counts of xconf.json read three ways, per model and criterion (lowest χ², lowest
   BIC): right (the truth's solid); nested (the chosen solid is the truth's own family member one
   step more or less general: box ↔ square box, elliptic cylinder ↔ cylinder, ellipsoid ↔
   spheroid, which the data cannot tell apart where the truth is near the special case); wrong
   (another family). Also, per row, the truth's two section/side ratios, to see whether a nested
   choice is near-legitimate (the truth within ~10 % of the special case).
   node nested.mjs [results/xconf.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const X = JSON.parse(fs.readFileSync(process.argv[2] || path.join(HERE, 'results', 'xconf.json'), 'utf8'));
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball' };
console.log('| model | criterion | right | nested | wrong | rows |');
console.log('|---|---|---|---|---|---|');
const per = [];
for (const m of Object.keys(X)) for (const [crit, key] of [['χ²', 'byChi'], ['BIC', 'byBic']]){
  let r = 0, n = 0, w = 0, k = 0;
  for (const e of X[m]){
    if (e.missing) continue; k++;
    const t = design.rows.find(r=> r.id === e.id).solid, c = e[key][0];
    if (c === t) r++; else if (FAM[c] === FAM[t]) n++; else w++;
    if (crit === 'BIC') per.push({ m, id: e.id, t, chi: e.byChi[0], bic: c });
  }
  console.log(`| ${m} | ${crit} | ${r} | ${n} | ${w} | ${k} |`);
}
console.log('\n| row | truth dims (nm) | ' + Object.keys(X).map(m=> m + ': by χ² / by BIC').join(' | ') + ' |');
console.log('|---|---|' + Object.keys(X).map(()=> '---|').join(''));
for (const id of [...new Set(per.map(p=> p.id))]){
  const row = design.rows.find(r=> r.id === id);
  console.log(`| ${id} | ${row.dims.map(x=> x.toFixed(1)).join(' × ')} | ` + Object.keys(X).map(m=> { const p = per.find(q=> q.m === m && q.id === id); return p ? `${p.chi} / ${p.bic}` : '—'; }).join(' | ') + ' |');
}
