import fs from 'node:fs';
const { readResult } = await import('../harness/lib.mjs');
const o = readResult(fs.readFileSync('results/time/lor/box-P-1-near.json', 'utf8'));
console.log(Object.keys(o), o.cpu, JSON.stringify(o.stages).slice(0, 400), o.wall, o.iso.evals, o.iso.ms);
const r = o.records[0]; console.log(r.method, r.chi2, r.search, r.report && { evals: r.report.evals, ms: r.report.ms });
const p = readResult(fs.readFileSync('../pilot/results/screen/box-P-1-near.json', 'utf8')); const q = p.records.find(x=> x.method === 'today');
console.log('pilot', q.chi2, q.search.evals, q.report.evals, p.iso.evals, p.wall);
