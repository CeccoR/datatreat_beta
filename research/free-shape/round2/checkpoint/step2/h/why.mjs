#!/usr/bin/env node
/* why.mjs <row> <dir> [<dir> ...]: the search's refinements of one run in each record, stage
   by stage (brief: 8 iterations; full, polish, exact, held, refit and v2's central pass: 60),
   with iterations, evaluations, exact χ² and the solid reached, to find where two searches
   part. Paths relative to this folder. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [row, ...dirs] = process.argv.slice(2);
const f = (x, d = 2) => typeof x === 'number' ? (Number.isFinite(x) ? x.toFixed(d) : '∞') : x === 'Infinity' ? '∞' : String(x);
for (const d of dirs){
  const file = path.resolve(HERE, d, row + '.json');
  if (!fs.existsSync(file)){ console.log(d, 'missing'); continue; }
  const o = readResult(fs.readFileSync(file, 'utf8')), r = o.records.find(x=> x.method === 'today');
  console.log(`== ${d}: ${JSON.stringify(o.mode || o.line || {})} ${r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' : '?'} χ² ${f(r.chi2, 2)} best ${f(r.chi2Best, 2)} ev ${r.search.evals}; iso χ²_ν ${f(o.iso.chi2nu, 3)}`);
  let k = 0;
  for (const e of r.log){
    const st = e.mi === 8 ? 'brief' : e.soft ? 'full' : e.rot ? 'exact/refit' : 'held';
    const s = e.to ? `${e.to.dims.map(x=> f(x)).join('×')}` : '';
    console.log(`  ${String(k++).padStart(2)} ${st.padEnd(11)} it ${String(e.it).padStart(3)} ev ${String(e.ev).padStart(4)} χ² ${f(e.c, 1).padStart(10)} ${s}${e.err ? ' ERROR ' + e.err : ''}`);
  }
}
