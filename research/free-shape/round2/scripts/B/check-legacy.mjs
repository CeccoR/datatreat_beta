// After the random-stream fix in var.mjs: the legacy modes reproduce the first records. For each
// record of a method <name>0 (symA0, symC0, cuts0) in <dir>, the record of <name> in the old
// tags (sub2s, sym25, full, fullsub) on the same row must agree in every refinement's
// evaluations and χ², the outcome and the χ². (The replica 'today' is checked by check-replica.mjs.)
// node check-legacy.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './h/lib.mjs';
const dir = process.argv[2];
let n = 0, bad = 0;
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const A of o.records.filter(r=> /0$/.test(r.method))){
    const nm = A.method.slice(0, -1);
    let P = null;
    for (const t of ['sub2s', 'sym25', 'fullsub', 'full']){ const pf = path.join('results', t, f); if (!fs.existsSync(pf)) continue; P = readResult(fs.readFileSync(pf, 'utf8')).records.find(r=> r.method === nm); if (P) break; }
    if (!P) continue;
    n++;
    const same = A.search.evals === P.search.evals && A.log.length === P.log.length && A.log.every((e, i)=> e.ev === P.log[i].ev && e.c === P.log[i].c)
      && A.kept === P.kept && A.held === P.held && A.rejected === P.rejected && A.chi2 === P.chi2;
    if (!same){ bad++; console.log('DIFF', o.row, A.method, A.search.evals, P.search.evals, A.chi2, P.chi2); }
    else console.log('same', o.row, A.method, A.search.evals);
  }
}
console.log(`legacy: ${n - bad} of ${n} identical to the first records`);
