// The replica (variant 'today', var.mjs with cfg {}) against the pilot's records of the
// engine's own freeShape: every refinement's evaluations and χ², the outcome, the solid.
// node check-replica.mjs <tag-dir> [<tag-dir>…]
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './h/lib.mjs';
let n = 0, bad = 0;
for (const dir of process.argv.slice(2)) for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  const A = o.records.find(r=> r.method === 'today'); if (!A) continue;
  const pf = path.join('..', 'pilot', 'results', 'screen', f); if (!fs.existsSync(pf)) continue;
  const P = readResult(fs.readFileSync(pf, 'utf8')).records.find(r=> r.method === 'today');
  n++;
  const same = A.search.evals === P.search.evals && A.log.length === P.log.length && A.log.every((e, i)=> e.ev === P.log[i].ev && e.c === P.log[i].c)
    && A.kept === P.kept && A.held === P.held && A.rejected === P.rejected && A.chi2 === P.chi2;
  if (!same){ bad++; console.log('DIFF', o.row, A.search.evals, P.search.evals, A.log.length, P.log.length, A.chi2, P.chi2); }
}
console.log(`replica: ${n - bad} of ${n} identical to the pilot (every refinement's evaluations and χ², outcome, χ²)`);
