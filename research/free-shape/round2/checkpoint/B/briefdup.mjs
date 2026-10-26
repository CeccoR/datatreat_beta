// Today's brief ends: how often the 3 best (sent to full refinement) hold the same solid
// twice modulo the class and the body (sameSolid: 8°, e^0.25), and what the full
// refinements from them reached.
import fs from 'node:fs';
import path from 'node:path';
import { sameSolid, readResult } from '../harness/lib.mjs';
const dir = '../pilot/results/screen';
let runs = 0, withDup = 0, dupFulls = 0, evDup = 0, sameEnd = 0;
const byL = {};
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = o.records.find(r=> r.method === 'today');
  const briefs = r.log.filter(e=> e.mi === 8);
  const fulls = r.log.filter(e=> e.mi !== 8 && e.soft && e.rot).slice(0, 3);
  if (!fulls.length) continue;
  runs++;
  const top = briefs.map((e, i)=> ({ e, i })).sort((a, b)=> a.e.c - b.e.c).slice(0, 3);
  let d = 0; const b = byL[o.laue] = byL[o.laue] || { runs: 0, dup: 0 }; b.runs++;
  top.forEach((t, k)=> { if (top.slice(0, k).some(u=> sameSolid(o.phase, t.e.to, u.e.to))){ d++; dupFulls++; evDup += fulls[k] ? fulls[k].ev : 0;
    // did its full refinement end at the same solid as the earlier one's?
    const j = top.findIndex(u=> sameSolid(o.phase, t.e.to, u.e.to)); if (fulls[k] && fulls[j] && sameSolid(o.phase, fulls[k].to, fulls[j].to)) sameEnd++; } });
  if (d){ withDup++; b.dup += d; }
}
console.log({ runs, withDup, dupFulls, evDup, evDupPerRun: evDup/runs, sameEnd });
console.log(byL);
