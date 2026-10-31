#!/usr/bin/env node
/* ident.mjs <mine dir> <reference dir> [rows]: row by row, whether a run of ours equals a
   reference record bit for bit (the 'today' record of each): the isotropic fit (evaluations,
   χ²), the search's evaluations, the returned χ², the outcome, the dimensions, the report's
   evaluations. Paths relative to this folder; rows default to every record in <mine dir>. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const [md, rd, rowsArg] = process.argv.slice(2);
const dir = d => path.resolve(HERE, d);
const rows = rowsArg ? rowsArg.split(',') : fs.readdirSync(dir(md)).filter(f=> f.endsWith('.json')).map(f=> f.slice(0, -5)).sort();
const rdR = f => fs.existsSync(f) ? readResult(fs.readFileSync(f, 'utf8')) : null;
const out = r => !r ? '—' : r.error ? 'error' : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rej') : 'none';
let n = 0, all = 0;
for (const row of rows){
  const m = rdR(path.join(dir(md), row + '.json')), o = rdR(path.join(dir(rd), row + '.json'));
  if (!m || !o){ console.log(row.padEnd(26), 'missing'); continue; }
  const a = m.records.find(r=> r.method === 'today'), b = o.records.find(r=> r.method === 'today');
  const t = {
    iso: m.iso.evals === o.iso.evals && m.iso.chi2 === o.iso.chi2,
    ev: a.search.evals === b.search.evals, chi2: a.chi2 === b.chi2, out: out(a) === out(b),
    dims: JSON.stringify(a.solid ? a.solid.dims : null) === JSON.stringify(b.solid ? b.solid.dims : null),
    report: (a.report ? a.report.evals : null) === (b.report ? b.report.evals : null)
  };
  n++; const ok = Object.values(t).every(Boolean); if (ok) all++;
  console.log(row.padEnd(26), ok ? 'identical' : 'DIFFERS ' + Object.entries(t).filter(([, v])=> !v).map(([k])=> k).join(','),
    `| iso ${m.iso.evals}, ${m.iso.chi2.toFixed(3)} | search ${a.search.evals}/${b.search.evals} ev | χ² ${a.chi2.toFixed(3)}/${b.chi2.toFixed(3)} | ${out(a)}/${out(b)} | report ${a.report ? a.report.evals : '—'}/${b.report ? b.report.evals : '—'}`);
}
console.log(`${all} of ${n} identical`);
