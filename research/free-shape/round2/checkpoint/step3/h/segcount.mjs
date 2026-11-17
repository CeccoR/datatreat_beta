// segment counts per row at the truth's isotropic model (quick look; not used for results)
import { buildModel, calc } from './eng/xrd-rietveld.js';
import { phaseOf } from './lib.mjs';
import { segments } from './ck.mjs';
import { drawRow } from '../../gen/gen.mjs';
import fs from 'node:fs';
const design = JSON.parse(fs.readFileSync('../../design/design.json', 'utf8'));
for (const id of process.argv.slice(2)){
  const row = design.rows.find(r=> r.id === id && r.split === 'tuning');
  const pat = drawRow(row, { kernel: 'exact' });
  const m = buildModel({ x: pat.x, y: pat.y, instr: pat.instr, phases: [phaseOf(row.phase, false)] });
  const i = m.index['p1.Ys']; m.v[i] = 0.3;
  const t = calc(m, null, { internal: true }).ticks;
  const s = segments(Array.from(m.x), t, m.lines);
  console.log(id, t.length, s.length, s.slice(0, 5).map(z=> z.nl).join(','));
}
