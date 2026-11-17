import fs from 'node:fs';
const { readResult } = await import('../harness/lib.mjs');
const o = readResult(fs.readFileSync('results/s-mom/box-P-1-near.json', 'utf8'));
for (const r of o.records) console.log(r.method, r.chi2, r.chi2Best, r.P, r.dBIC);
const p = readResult(fs.readFileSync('results/s-lsq/box-P-1-near.json', 'utf8'));
for (const r of p.records) console.log('lsq', r.method, r.chi2, r.chi2Best, r.P);
