import fs from 'node:fs';
import { drawRow } from '../../gen/gen.mjs';
const design = JSON.parse(fs.readFileSync('../design/design.json', 'utf8'));
for (const id of ['box-P4m-near', 'cylinder-P6m-on']){
  const a = JSON.parse(fs.readFileSync(`tmp/ballcheck-${id}-0.json`)), b = JSON.parse(fs.readFileSync(`tmp/ballcheck-${id}-1.json`));
  const g = drawRow(design.rows.find(r=> r.id === id), { noise: false }).yc;
  let pk = 0, dab = 0, dag = 0, chab = 0, chag = 0; for (let i = 0; i < a.length; i++){ pk = Math.max(pk, a[i]); dab = Math.max(dab, Math.abs(a[i] - b[i])); dag = Math.max(dag, Math.abs(a[i] - g[i])); chab += (a[i]-b[i])**2/(a[i]+1); chag += (a[i]-g[i])**2/(a[i]+1); }
  console.log(id, 'wppm vs wppm-ball: max', (100*dab/pk).toFixed(2), '% of peak, chi2', chab.toFixed(1), '| wppm (in-model) vs generator exact: max', (100*dag/pk).toFixed(2), '%, chi2', chag.toFixed(1));
}
