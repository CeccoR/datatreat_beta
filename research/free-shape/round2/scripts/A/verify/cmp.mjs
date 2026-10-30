// compare two run records: iso and each method's chi2, evaluations, dims
import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map(f=> JSON.parse(fs.readFileSync(f, 'utf8')));
const pick = o => ({ iso: o.iso && { chi2: o.iso.chi2, evals: o.iso.evals, N: o.iso.N, P: o.iso.P }, recs: o.records.map(r=> ({ m: r.method, chi2: r.chi2, chi2Free: r.chi2Free, chi2Held: r.chi2Held, evals: r.search ? r.search.evals : r.evals, rep: r.report ? r.report.evals : null, dims: r.solid ? r.solid.dims : null, dBIC: r.dBIC })) });
const A = pick(a), B = pick(b);
console.log(JSON.stringify(A.iso), '\n', JSON.stringify(B.iso));
for (let i = 0; i < Math.max(A.recs.length, B.recs.length); i++){ console.log('A', JSON.stringify(A.recs[i])); console.log('B', JSON.stringify(B.recs[i])); }
console.log('identical (JSON of picked fields):', JSON.stringify(A) === JSON.stringify(B));
