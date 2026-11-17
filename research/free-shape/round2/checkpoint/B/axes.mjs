// lowIndexAxes per class, and the start list composition (deterministic vs random).
import { ENG, phaseQ, PHASES, laueRotations, canonicalDir } from '../harness/lib.mjs';
for (const p of PHASES){
  const q = phaseQ(p.id), ax = ENG.lowIndexAxes(q);
  const labs = ax.map(e=> ENG.lattDirection(q, e).label);
  console.log(p.id, p.laue || '', 'rots', laueRotations(p.id).length, 'axes', ax.length, labs.join(' '), 'starts det', 1 + 2*ax.length, 'random', Math.max(0, 11 - 1 - 2*ax.length));
}
