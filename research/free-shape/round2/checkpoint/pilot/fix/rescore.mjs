/* The first baseline (results/screen-c3: the C3 cells and 10–100°) scored again with the
   fixed harness, no run repeated: the accuracy fields (acc, accLoose, accFree) recomputed
   from each record's stored solids against its truth with the current compareSolids (a
   spheroid and a square box paired by role), and the records written with writeResult
   (unbounded extents as "Infinity"). The directions are the same on the scaled cells (a
   uniform scale turns no lattice direction), and so are the class's rotations.
   node rescore.mjs [--from screen-c3] [--to screen-c3-rescored] */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, writeResult, accuracy, compareSolids, laueRotations } from '../../harness/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), arg = (k, d) => a.includes('--' + k) ? a[a.indexOf('--' + k) + 1] : d;
const from = path.join(HERE, '..', 'results', arg('from', 'screen-c3')), to = path.join(HERE, '..', 'results', arg('to', 'screen-c3-rescored'));
fs.mkdirSync(to, { recursive: true });
let n = 0, changed = 0;
for (const f of fs.readdirSync(from).filter(f=> f.endsWith('.json'))){
  const o = readResult(fs.readFileSync(path.join(from, f), 'utf8'));
  if (!o || !Array.isArray(o.records)) continue;
  const truth = o.truth && o.truth.type ? o.truth : null;
  for (const r of o.records){
    if (!truth) continue;
    const before = JSON.stringify([r.acc, r.accFree]);
    if (r.solid){ r.acc = accuracy(o.phase, r.solid, truth); r.accLoose = compareSolids(r.solid, truth, { rots: laueRotations(o.phase), loose: true }); }
    if (r.freeSolid) r.accFree = accuracy(o.phase, r.freeSolid, truth);
    if (JSON.stringify([r.acc, r.accFree]) !== before) changed++;
  }
  o.rescored = { at: new Date().toISOString(), by: 'pilot/fix/rescore.mjs' };
  fs.writeFileSync(path.join(to, f), writeResult(o)); n++;
}
if (fs.existsSync(path.join(from, 'batch.log'))) fs.copyFileSync(path.join(from, 'batch.log'), path.join(to, 'batch.log'));
console.log(`${n} runs rescored into ${path.relative(HERE, to)}; ${changed} records' accuracy changed`);
