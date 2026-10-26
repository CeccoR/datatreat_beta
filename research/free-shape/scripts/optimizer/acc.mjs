#!/usr/bin/env node
/* node acc.mjs tag … : accuracy and precision of full batches (table.mjs's summary.json;
   'baseline' is harness/results/baseline) on the synthetic runs that kept a solid and the
   sample-like ones: the largest dimension error (median, 90th percentile), the smallest
   dimension's error, the truth's most distinct axis (median, 90th, worst), and per case
   the precision over the 3 noise realisations (mean over cases of the largest sd of a
   dimension's error, of the mean pairwise misorientation). */
import fs from 'node:fs';
import path from 'node:path';
import { CASES } from './h/cases.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const q = (xs, p) => { const v = xs.filter(Number.isFinite).sort((a, b)=> a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(p*(v.length - 1) + 0.5))] : NaN; };
const mean = xs => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((s, x)=> s + x, 0)/v.length : NaN; };
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
console.log('| tag | set | runs with a solid | max dim err median / 90th | thinnest dim err median / 90th | normal ° median / 90th / worst | precision: dim sd (median over cases) | precision: misorientation ° (median over cases) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const tag of process.argv.slice(2)){
  const S = JSON.parse(fs.readFileSync(tag === 'baseline' ? path.join(HERE, '..', 'harness', 'results', 'baseline', 'summary.json') : path.join(HERE, 'results', tag, 'summary.json'), 'utf8'));
  for (const kind of ['synth', 'sample']){
    const rs = S.rows.filter(r=> r.kind === kind && r.acc);
    // the truth's smallest dimension (a plate's thickness, a needle's section)
    const thin = rs.map(r=> { const c = CASES.find(c=> c.id === r.case); if (!c || !c.dims) return NaN; const i = c.dims.indexOf(Math.min(...c.dims)); return Math.abs(r.acc.dimErr[i]); });
    const cs = S.cases.filter(c=> c.kind === kind);
    console.log(`| ${tag} | ${kind} | ${rs.length} | ${f(100*q(rs.map(r=> r.acc.dimMax), 0.5), 0)} % / ${f(100*q(rs.map(r=> r.acc.dimMax), 0.9), 0)} % | ${f(100*q(thin, 0.5), 1)} % / ${f(100*q(thin, 0.9), 1)} % | ${f(q(rs.map(r=> r.acc.principal), 0.5))} / ${f(q(rs.map(r=> r.acc.principal), 0.9))} / ${f(Math.max(...rs.map(r=> r.acc.principal).filter(Number.isFinite)))} | ${f(100*q(cs.map(c=> c.precDim), 0.5), 1)} % | ${f(q(cs.map(c=> c.precOrient), 0.5))} |`);
  }
}
