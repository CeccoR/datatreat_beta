#!/usr/bin/env node
/* node classes.mjs [--set synth|sample]: the six solids on one pattern (seed 1). ΔBIC of each
   against the best (χ² over the best fit's χ²_ν floored at 1, + P ln N), the 95 % set
   (weights e^(−ΔBIC/2)), and for synthetic truths: is the truth's solid the best, in the
   set, the simplest in the set. The searched solid's χ² is the uniqueness study's
   reported fit (the app's search), the others' this study's xclass runs (the app's search
   as that solid). Rejected solids (ΔBIC ≥ −10 against the one size) are listed apart. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, TYPES, fmt, pct, median, HERE } from './plib.mjs';
import { classFits } from './approaches.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const SET = opt.set || 'synth';
const nPar = t => ({ spheroid: 4, cylinder: 4, sqbox: 5, ellipsoid: 6, box: 6, ellcyl: 6 })[t];
const rows = [];
const abbr = { spheroid: 'sph', cylinder: 'cyl', sqbox: 'sqb', ellipsoid: 'ell', box: 'box', ellcyl: 'ecy' };
console.log(`| run | truth | ${TYPES.map(t=> abbr[t]).join(' | ')} | 95 % set | simplest in it |`);
console.log(`|---|---|${TYPES.map(()=> '---').join('|')}|---|---|`);
for (const c of CASES.filter(c=> c.kind === SET)){
  const R = loadRun(c.id, 1);
  if (!R.base || !R.uq || Object.keys(R.xc).length < 5) continue;
  const cf = classFits(R);
  if (!cf.fits || !cf.fits.length) continue;
  const w = cf.fits.map(f=> Math.exp(-f.dBIC/2)), W = w.reduce((t, x)=> t + x, 0);
  const set = []; let acc = 0; for (let i = 0; i < cf.fits.length; i++){ set.push(cf.fits[i]); acc += w[i]/W; if (acc >= 0.95) break; }
  const simplest = [...set].sort((x, y)=> nPar(x.type) - nPar(y.type) || x.dBIC - y.dBIC)[0].type;
  const by = Object.fromEntries(cf.fits.map(f=> [f.type, f.dBIC]));
  const rej = Object.fromEntries((cf.rejected || []).map(f=> [f.type, true]));
  rows.push({ id: c.id, truth: c.type, by, set: set.map(f=> f.type), best: cf.fits[0].type, simplest, rej: Object.keys(rej) });
  console.log(`| ${c.id} | ${c.type} | ${TYPES.map(t=> t in by ? fmt(by[t], 1) : rej[t] ? 'rej.' : '—').join(' | ')} | ${set.map(f=> abbr[f.type]).join(' ')} | ${abbr[simplest]} |`);
}
console.log(`\n${rows.length} runs; solids in the 95 % set: median ${median(rows.map(r=> r.set.length))}, ${rows.filter(r=> r.set.length >= 3).length} with 3 or more; within ΔBIC 10 of the best: median ${median(rows.map(r=> Object.values(r.by).filter(d=> d <= 10).length))}.`);
if (SET === 'synth'){
  console.log(`the truth's solid: best ${pct(rows.filter(r=> r.best === r.truth).length, rows.length)}, in the set ${pct(rows.filter(r=> r.set.includes(r.truth)).length, rows.length)}, the simplest of the set ${pct(rows.filter(r=> r.simplest === r.truth).length, rows.length)}.`);
}
fs.writeFileSync(path.join(HERE, 'results', `classes-${SET}.json`), JSON.stringify(rows));
