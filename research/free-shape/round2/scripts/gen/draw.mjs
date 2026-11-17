/* Draws the design's patterns: one JSON per row (savePattern: x, y, instr, irf, truth, info).
   node draw.mjs --design ../design/design.json [--out patterns] [--ids a,b] [--part i/n] [--kernel exact|lorentz|none]
   A row whose file exists is skipped (a batch resumes). --part i/n takes every n-th row
   from the i-th (0-based): to split a batch over processes (at most 2, under nice -n 15). */
import fs from 'node:fs';
import path from 'node:path';
import { drawRow, savePattern, standardIrf, HERE } from './gen.mjs';
const a = process.argv.slice(2), arg = (k, d) => a.includes('--' + k) ? a[a.indexOf('--' + k) + 1] : d;
const design = JSON.parse(fs.readFileSync(arg('design', path.join(HERE, '..', 'design', 'design.json')), 'utf8'));
let rows = Array.isArray(design) ? design : design.rows || design.truths;
const ids = arg('ids', null), part = arg('part', null), kernel = arg('kernel', 'exact'), out = path.resolve(arg('out', path.join(HERE, 'patterns')));
if (ids) rows = rows.filter(r=> ids.split(',').includes(String(r.id)));
if (part){ const [i, n] = part.split('/').map(Number); rows = rows.filter((_, k)=> k % n === i); }
const irf = standardIrf();
let n = 0, ms = 0;
for (const row of rows){
  const f = path.join(out, row.id + '.json');
  if (fs.existsSync(f)) continue;
  const p = drawRow(row, { irf, kernel });
  savePattern(f, p); n++; ms += p.info.ms;
  console.log(row.id, row.solid, row.phase, row.error && row.error.kind || '-', p.info.ms.toFixed(0) + ' ms');
}
console.log(`${n} patterns drawn, ${(ms/1000).toFixed(1)} s (${n ? (ms/n).toFixed(0) : 0} ms each) → ${out}`);
