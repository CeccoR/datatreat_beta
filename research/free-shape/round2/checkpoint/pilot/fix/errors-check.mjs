/* The model errors as drawn, on every design row with one (the pilot's verification of the
   generator's fix): the hump's and the impurity lines' areas within the range against
   their stated share of the strongest line, the air's start against the background.
   node errors-check.mjs → errors-check.json */
import fs from 'node:fs';
import path from 'node:path';
import { drawRow, standardIrf, GRID } from '../../gen/gen.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'design', 'design.json'), 'utf8'));
const irf = standardIrf(), out = { grid: GRID, hump: [], impurity: [], air: [] };
for (const row of design.rows.filter(r=> r.error && ['hump', 'impurity', 'air'].includes(r.error.kind))){
  const p = drawRow(row, { kernel: 'none', noise: false, irf }), step = GRID.step, e = p.parts.error, A = p.info.strongest.area;
  let a = 0; for (const v of e) a += v*step;
  const er = p.truth.error;
  if (er.kind === 'hump') out.hump.push({ id: row.id, spec: er.frac, got: a/A, inRangeOfWhole: er.inRange, centre: er.centre, fwhm: er.fwhm });
  if (er.kind === 'impurity') out.impurity.push({ id: row.id, n: er.lines.length, spec: er.lines.reduce((t, l)=> t + l.frac, 0), got: a/A, inRange: er.lines.map(l=> l.inRange) });
  if (er.kind === 'air') out.air.push({ id: row.id, spec: er.k, got: e[0]/p.parts.bg[0] });
}
const rel = xs => xs.map(x=> Math.abs(x.got/x.spec - 1));
for (const k of ['hump', 'impurity', 'air']) console.log(`${k}: ${out[k].length} rows, |realised/stated − 1| ≤ ${Math.max(...rel(out[k])).toExponential(1)}` + (k === 'hump' ? `; the whole pseudo-Voigt's share within the range ${Math.min(...out.hump.map(x=> x.inRangeOfWhole)).toFixed(3)}–${Math.max(...out.hump.map(x=> x.inRangeOfWhole)).toFixed(3)}` : k === 'impurity' ? `; each line's share within the range ${Math.min(...out.impurity.flatMap(x=> x.inRange)).toFixed(4)}–${Math.max(...out.impurity.flatMap(x=> x.inRange)).toFixed(4)}` : ''));
fs.writeFileSync(path.join(HERE, 'errors-check.json'), JSON.stringify(out, null, 1));
