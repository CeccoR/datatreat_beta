/* [fix] In-model data: a row's pattern computed by this folder's engine itself at the truth (the mode
   of FS2A_LINE / FS2A_PROFILE / FS2A_WPPM_BALL), on the generator's grid, instrument, background and
   truth parameters (drawRow kernel none supplies x, instr, irf and truth.P), every line's tails whole
   (noise0 10⁻³⁰, as the generator draws), the phase scaled as the generator scales it (its strongest
   point at the row's counts), Poisson noise from a seed of the row's id (the generator's rng and
   poisson). The control data for what the line shape adds. */
import { buildModel, setParams, ENG } from '../eng/xrd-rietveld.js';
import { phaseOf } from '../harness/lib.mjs';
import { drawRow, rng, poisson, hash } from '../../gen/gen.mjs';
export function inModelPattern(row, { noise = true, seedTag = 'inmodel' } = {}){
  const pat = drawRow(row, { noise: false, kernel: 'none' });
  const model = buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [phaseOf(row.phase, row.solid)] });
  model.noise0 = 1e-30;
  const v = model.v.slice(), P = { ...pat.truth.P, 'p1.scale': 1 };
  for (const k in P){ const i = model.index[k]; if (i != null) v[i] = P[k]; }
  setParams(model, v);
  const c = ENG.calc(model, null, { internal: true }), net = c.perPhase[0];
  let mx = 0; for (let i = 0; i < net.length; i++) mx = Math.max(mx, net[i]);
  const S = row.counts/mx, yc = Float64Array.from(net, (t, i)=> Math.max(0, S*t + c.bg[i]));
  const nr = rng(hash(row.id + '|' + seedTag) ^ 0x2545F491);
  const y = noise ? Array.from(yc, l=> poisson(l, nr.u)) : Array.from(yc);
  return { x: pat.x, y, yc, instr: pat.instr, irf: pat.irf, truth: { ...pat.truth, P: { ...pat.truth.P, 'p1.scale': S } }, kernel: 'inmodel' };
}
