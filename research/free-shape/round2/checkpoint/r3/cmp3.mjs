#!/usr/bin/env node
/* Two records of a row side by side: node cmp3.mjs <tagA> <tagB> [rows...] (all rows both have) */
import fs from 'node:fs';
import path from 'node:path';
import { rd, outc, f } from './lib3.mjs';
const [A, B, ...ids] = process.argv.slice(2);
const dir = t => path.join(path.dirname(new URL(import.meta.url).pathname), 'results', t);
const rows = ids.length ? ids : fs.readdirSync(dir(A)).filter(x=> x.endsWith('.json') && fs.existsSync(path.join(dir(B), x))).map(x=> x.slice(0, -5));
for (const id of rows){
  const a = rd(path.join(dir(A), id + '.json')), b = rd(path.join(dir(B), id + '.json'));
  const s = o => { const r = o.records.find(q=> q.method === 'today'), rep = r.report || {}; return { iso: o.iso.evals + '/' + f(o.iso.chi2, 3), out: outc(r), chi: f(r.chi2, 3), sev: r.search.evals, mev: r.min && r.min.evals, rev: rep.evals, dims: r.solid ? r.solid.dims.map(d=> f(d, 3)).join('x') : '', rad: rep.axes ? rep.axes.map(x=> f(x.radius, 3)).join(',') : '', esdA: rep.axes ? rep.axes.map(x=> f(x.esdAngle, 4)).join(',') : '', lo: rep.dims ? rep.dims.map(d=> f(d.lo, 3) + '-' + f(d.hi, 3)).join(' ') : '' }; };
  const x = s(a), y = s(b);
  console.log(id); for (const k of Object.keys(x)) console.log(`  ${k}: ${x[k]} | ${y[k]}${x[k] === y[k] ? '' : '   <<'}`);
}
