#!/usr/bin/env node
/* node diag.mjs <tag> [variant…]: per variant, the quantities whose verdict disagrees with the
   truth: determined but inaccurate (a wrong claim), and inaccurate and outside their interval
   (a missed one); with the run, the role, the truth, the error and the interval. */
import fs from 'node:fs';
import path from 'node:path';
import { fmt } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [tag = 'main', ...vs] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'results', tag, 'score.json'), 'utf8')).filter(r=> r.iv && r.iv.app.truthQ);
for (const v of vs.length ? vs : ['app', 'prof']){
  console.log(`\n## ${v}`);
  for (const r of rows){
    const Q = r.iv[v].q;
    for (const t of r.iv[v].truthQ){
      const I = Q[t.fi];
      const wrongD = t.detDim && !t.accD, missD = !t.accD && !t.covD, wrongA = t.detAng === true && t.accA === false, missA = t.accA === false && t.covA === false;
      if (!(wrongD || missD || wrongA || missA)) continue;
      console.log(`${r.kind === 'sample' ? 'S' : ' '} ${r.run.padEnd(22)} ${t.role.padEnd(4)} T ${fmt(t.T, 1)} fit ${fmt(r.dims[t.fi], 1)} err ${fmt(100*t.err, 0)}% [${fmt(I.d[0], 1)}, ${fmt(I.d[1], 1)}]${wrongD ? ' DET-WRONG' : ''}${missD ? ' MISS' : ''} | ang ${fmt(t.angErr, 1)}° ±${fmt(I.ang, 1)}${wrongA ? ' ADET-WRONG' : ''}${missA ? ' AMISS' : ''}`);
    }
  }
}
