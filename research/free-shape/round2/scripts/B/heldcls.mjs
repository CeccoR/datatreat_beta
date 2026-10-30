// per Laue class: held refinements and repeated held frames in the fwd records (held 'count')
import fs from 'node:fs';
import { readResult } from './h/lib.mjs';
const design = JSON.parse(fs.readFileSync('../design/design.json', 'utf8'));
const by = {}; let n = 0, d = 0, ev = 0;
for (const tag of ['sub1', 'full']) for (const f of fs.readdirSync('results/' + tag).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(`results/${tag}/${f}`, 'utf8')), row = design.rows.find(r=> r.id === f.slice(0, -5));
  const r = o.records.find(r=> r.method === 'fwd'); if (!r) continue;
  const b = by[row.laue] = by[row.laue] || { runs: 0, held: 0, dup: 0, ev: 0 };
  b.runs++; b.held += r.var.heldN || 0; b.dup += (r.var.heldDup || []).length; b.ev += (r.var.heldDup || []).reduce((t, x)=> t + (x.ev || 0), 0);
}
for (const [k, b] of Object.entries(by)){ n += b.held; d += b.dup; ev += b.ev; console.log(k, JSON.stringify(b)); }
console.log('total held', n, 'dup', d, 'ev', ev);
