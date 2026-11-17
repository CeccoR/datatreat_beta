// the step 3 records against step 2's W4 (the same fits: iso, search, outcome, χ², solid, report)
import fs from 'node:fs';
import { readResult } from './lib.mjs';
const [a, b] = process.argv.slice(2); let same = 0, diff = [];
for (const fn of fs.readdirSync(a).filter(f=> f.endsWith('.json') && !f.endsWith('.res.json'))){
  const o = readResult(fs.readFileSync(a + '/' + fn, 'utf8')), p = readResult(fs.readFileSync(b + '/' + fn, 'utf8'));
  const r = o.records[0], q = p.records[0];
  const k = x => JSON.stringify([x.kept, x.held, x.rejected, x.early, x.chi2, x.search.evals, x.report && x.report.evals, x.solid && x.solid.dims, x.dBIC]);
  if (k(r) === k(q) && o.iso.chi2 === p.iso.chi2 && o.iso.evals === p.iso.evals) same++; else diff.push(fn);
}
console.log(`${same} identical; differ: ${diff.join(', ') || 'none'}`);
