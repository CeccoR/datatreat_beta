#!/usr/bin/env node
/* node tsum.mjs X …: the paired wall times of timing.sh (results/t-X): per run the app's and
   X's search time, each the mean of its two positions (first and second method of a
   process), the evaluations, and the ratio of the totals. */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
for (const X of process.argv.slice(2)){
  const dir = path.join(HERE, 'results', 't-' + X);
  const runs = [...new Set(fs.readdirSync(dir).filter(f=> f.endsWith('.json')).map(f=> f.replace(/-[ab]\.json$/, '')))].sort();
  let ta = 0, tx = 0, ea = 0, ex = 0, n = 0, firstA = 0, firstX = 0;
  console.log(`${X}: run, app s (first, second), ${X} s (first, second), evals app/${X}`);
  for (const r of runs){
    const A = JSON.parse(fs.readFileSync(path.join(dir, r + '-a.json'), 'utf8')), B = JSON.parse(fs.readFileSync(path.join(dir, r + '-b.json'), 'utf8'));
    const app1 = A.records[0].ms, x2 = A.records[1].ms, x1 = B.records[0].ms, app2 = B.records[1].ms;
    const app = (app1 + app2)/2, x = (x1 + x2)/2;
    ta += app; tx += x; ea += A.records[0].evals; ex += A.records[1].evals; n++; firstA += app1; firstX += x1;
    console.log(`  ${r.padEnd(18)} ${(app1/1000).toFixed(1)}, ${(app2/1000).toFixed(1)}   ${(x1/1000).toFixed(1)}, ${(x2/1000).toFixed(1)}   ${A.records[0].evals}/${A.records[1].evals}`);
  }
  console.log(`  mean: app ${(ta/n/1000).toFixed(1)} s, ${X} ${(tx/n/1000).toFixed(1)} s, wall ratio ${(tx/ta).toFixed(2)} (first-method only ${(firstX/firstA).toFixed(2)}), evaluation ratio ${(ex/ea).toFixed(2)}; ms per evaluation app ${(ta/ea).toFixed(2)}, ${X} ${(tx/ex).toFixed(2)}`);
}
