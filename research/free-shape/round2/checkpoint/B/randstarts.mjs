// Today's random starts (the fill after 1 + 2 × families) in the classes that have them:
// did a random start's brief end reach the 3 sent to full refinement, was it the best brief,
// and was its basin (sameSolid) new, i.e. not also reached by a deterministic start?
// Also: distinct basins among the 11 brief ends, by class.
import fs from 'node:fs';
import path from 'node:path';
import { sameSolid, readResult } from './h/lib.mjs';
const dir = '../pilot/results/screen';
const det = { '-3m': 9, '6/m': 9, '6/mmm': 9, 'm-3': 7, 'm-3m': 7 };
const byL = {};
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = o.records.find(r=> r.method === 'today');
  const briefs = r.log.filter(e=> e.mi === 8);
  const b = byL[o.laue] = byL[o.laue] || { runs: 0, basins: [], randTop3: 0, randBest: 0, randNew: 0, randNewTop3: 0, early: 0 };
  b.runs++; if (r.early) b.early++;
  const basins = [];
  briefs.forEach((e, i)=> { const g = basins.find(g=> sameSolid(o.phase, e.to, g.to)); if (g) g.members.push(i); else basins.push({ to: e.to, members: [i] }); });
  b.basins.push(basins.length);
  const nd = det[o.laue]; if (!nd) continue;
  const order = briefs.map((e, i)=> ({ c: e.c, i })).sort((x, y)=> x.c - y.c).map(x=> x.i);
  const top3 = order.slice(0, 3);
  if (top3.some(i=> i >= nd)) b.randTop3++;
  if (order[0] >= nd) b.randBest++;
  for (const g of basins) if (g.members.every(i=> i >= nd)){ b.randNew++; if (g.members.some(i=> top3.includes(i))) b.randNewTop3++; }
}
for (const [L, b] of Object.entries(byL)) console.log(L, 'runs', b.runs, 'early', b.early, 'distinct brief basins', b.basins.join(','), det[L] ? `| random in top3: ${b.randTop3}, random best brief: ${b.randBest}, basins only random reached: ${b.randNew} (in top3: ${b.randNewTop3})` : '');
