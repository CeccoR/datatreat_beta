// The duplicate full refinements whose end differs from the earlier one's: which was lower.
import fs from 'node:fs';
import path from 'node:path';
import { sameSolid, readResult } from '../harness/lib.mjs';
const dir = '../pilot/results/screen';
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = o.records.find(r=> r.method === 'today');
  const briefs = r.log.filter(e=> e.mi === 8);
  const fulls = r.log.filter(e=> e.mi !== 8 && e.soft && e.rot).slice(0, 3);
  if (!fulls.length) continue;
  const top = briefs.map((e, i)=> ({ e, i })).sort((a, b)=> a.e.c - b.e.c).slice(0, 3);
  const nu = Math.max(1, o.iso.chi2nu);
  const minFull = Math.min(...fulls.map(x=> x.c));
  top.forEach((t, k)=> { const j = top.findIndex(u=> sameSolid(o.phase, t.e.to, u.e.to)); if (j < k && fulls[k] && fulls[j] && !sameSolid(o.phase, fulls[k].to, fulls[j].to))
    console.log(o.row, 'full', j, (fulls[j].c).toFixed(1), 'dup full', k, (fulls[k].c).toFixed(1), 'Δ(dup−first)/χ²ν', ((fulls[k].c - fulls[j].c)/nu).toFixed(2), 'dup is best full:', fulls[k].c === minFull, 'kept', r.kept, r.held ? 'held' : '', 'best exact', r.chi2Best && r.chi2Best.toFixed(1)); });
}
