// For each held frame that repeats an earlier one modulo the class (canonical), the two
// refinements' χ² (they should end alike).
import fs from 'node:fs';
import path from 'node:path';
import { canonical, readResult } from '../harness/lib.mjs';
const dir = '../pilot/results/screen';
const sameR = (A, B) => A.every((x, i)=> Math.abs(x - B[i]) < 1e-6);
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = o.records.find(r=> r.method === 'today');
  const seen = [];
  for (const e of r.log.filter(e=> !e.rot && e.from)){
    const c = canonical(o.phase, e.from);
    const t = seen.find(t=> sameR(c.R, t.c.R));
    if (t) console.log(o.row, o.laue, o.shape, 'dup: χ²', t.e.c.toFixed(2), e.c.toFixed(2), 'ev', t.e.ev, e.ev, c.labels.join(' '));
    else seen.push({ c, e });
  }
}
