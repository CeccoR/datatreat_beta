#!/usr/bin/env node
/* (b) The keep test: one size against a shape. Loads every run's pre-stage numbers:
   - nulls: the 22 tuning spheres searched as each solid, draw 0 (X1 for the screening spheres, N for
     the others) and fresh draws 1–4 (N);
   - mild shapes (M): tuning truths outside the screening set, extents pulled towards their mean;
   - strong shapes: the 66 screening truths (step 4's S2; their gain after the stage).
   Writes keep5.json (one entry a run) for keep-rules.mjs. node keep5.mjs */
import fs from 'node:fs';
import { SOLIDS, design, fitOf, S2, rec5 } from './lib5.mjs';
const SYS = { '-1': 'tric', '2/m': 'mono', mmm: 'orth', '4/m': 'tetr', '4/mmm': 'tetr', '-3': 'trig', '-3m': 'trig', '6/m': 'hex', '6/mmm': 'hex', 'm-3': 'cub', 'm-3m': 'cub' };
const out = [];
const add = (set, r, solid, fit, extra = {}) => { if (!fit) return;
  const base = design.rows.find(x=> x.key === (r.from || r.key));
  out.push({ set, key: r.key, from: r.from || r.key, solid, truth: r.solid, laue: r.laue, sys: SYS[r.laue], draw: r.draw || 0, counts: r.counts, pb: r.pb, D: r.solid === 'sphere' ? r.D : null,
    dims: r.dims, an: Math.max(...r.dims)/Math.min(...r.dims), error: r.error ? r.error.kind : null, strength: r.error ? r.error.strength : null, screen: !!base.screen,
    kept: fit.kept, early: !!fit.early, held: fit.held, gain: fit.gain, gainFree: fit.gainFree, gainHeld: fit.gainHeld, gainBrief: fit.gainBrief, dP: fit.dP, dPfree: fit.dPfree, dPheld: fit.dPheld,
    N: fit.N, nu: fit.nu, flagKeep: fit.flagKeep, zKeep: fit.zKeep, flagged: fit.flagged, ms: fit.ms, evals: fit.evals, ...extra }); };
for (const r of design.rows){
  if (r.solid === 'sphere' && r.split === 'tuning'){
    for (const s of SOLIDS){
      const rec = (!r.from && r.screen) ? rec5('X1', r.key, s) : rec5('N', r.key, s);
      add('null', r, s, fitOf(rec, s));
    }
  } else if (r.mild) add('mild', r, r.solid, fitOf(rec5('M', r.key), r.solid), { r: r.mild.r });
  else if (r.kind === 'truth' && r.screen && !r.from) add('strong', r, r.solid, fitOf(S2(r.id), r.solid));
}
fs.writeFileSync('keep5.json', JSON.stringify(out));
const c = s => out.filter(o=> o.set === s).length;
console.log(`runs: null ${c('null')}, mild ${c('mild')}, strong ${c('strong')}`);
