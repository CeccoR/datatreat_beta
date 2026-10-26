/* The cost of one pattern evaluation of each phase with the free shape active (every
   member drawn with its own width, as in the search) and isotropic (one line per
   reflection, as in the stages before it): ms per calc() of the whole pattern, the
   median of 5 after one warm-up, for a box of 2 × 3 × 5, 5 × 8 × 12 and 15 × 20 × 30 nm
   at a generic orientation, ε 0.1 %, round 1's instrument (Soller model) and profile.
   Grid: --lo 10 --hi 130 --step 0.01 (default). Cells: phases/cif (or --scale s: every
   length times s, to see what a smaller cell saves). Run: nice -n 15 node cost.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { buildModel, calc, setParams, ENG } from '../harness/eng/xrd-rietveld.js';
import { prepPhase } from '../harness/eng/xrd-rv-model.js';
import { PHASES } from './make-phases.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1];
const LO = +(opt.lo || 10), HI = +(opt.hi || 130), STEP = +(opt.step || 0.01), SCALE = +(opt.scale || 1);
const only = opt.only ? opt.only.split(',') : null;
const IRF = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'fs', 'harness', 'data', 'irf.json'), 'utf8'));
const INSTR = { lam1: 1.540598, lam2: 1.544426, ratio: 0.5, radius: 240, soller: { incident: 0.04, diffracted: 0.04 }, focusLength: 12, monochromator: false };
const { D2R, R2D, quatOfMat, quatMat, FS } = ENG;
const x = Array.from({ length: Math.round((HI - LO)/STEP) + 1 }, (_, i)=> +(LO + i*STEP).toFixed(4));
const W = D => 0.9*INSTR.lam1/(D*10)*R2D;
const R = quatMat([0.83, 0.31, -0.27, 0.37]);
const out = [];
for (const P of PHASES){
  if (only && !only.includes(P.id)) continue;
  let text = fs.readFileSync(path.join(HERE, 'cif', P.id + '.cif'), 'utf8');
  if (SCALE !== 1) text = text.replace(/^(_cell_length_[abc]) ([\d.]+)$/mg, (m, k, v)=> `${k} ${(+v*SCALE).toFixed(3)}`);
  const prep = prepPhase(text, P.id + '.cif');
  const ph = { id: 1, name: P.id, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888',
    size: true, shape: 'box', profile: 'lorentz', strain: 'iso', faults: null, adp: 'overall', po: null, occ: null };
  const m = buildModel({ x, y: x.map(()=> 100), instr: INSTR, phases: [ph] }), q = m.phases[0];
  const base = m.v.slice();
  const set = (k, val) => { base[m.index[k]] = val; };
  for (const k of ['U', 'V', 'W', 'X', 'Y', 'axL', 'transp', 'zero']) set(k, IRF[k]);
  set('p1.scale', 1); set('p1.Xs', 0.001*4*R2D); set('bg0', 100);
  const time = v => { setParams(m, v); calc(m, null, { internal: true }); const ts = []; for (let i = 0; i < 5; i++){ const t0 = process.hrtime.bigint(); calc(m, null, { internal: true }); ts.push(Number(process.hrtime.bigint() - t0)/1e6); } return ts.sort((a, b)=> a - b)[2]; };
  const r = { id: P.id, laue: P.laue, refl: q.nRefl, members: q.mv.reduce((t, a)=> t + a.length/3, 0) };
  // isotropic, 5 nm
  { const v = base.slice(); v[m.index['p1.Ys']] = W(5); r.iso5 = +time(v).toFixed(1); }
  for (const dims of [[2, 3, 5], [5, 8, 12], [15, 20, 30]]){
    const v = base.slice(); v[m.index['p1.Ys']] = 0;
    ['Wa', 'Wb', 'Wc'].forEach((n, i)=> { v[m.index['p1.' + n]] = W(dims[i]); });
    quatOfMat(R).forEach((t, i)=> { v[m.index['p1.Q' + i]] = t; });
    r['box' + dims.join('x')] = +time(v).toFixed(1);
  }
  out.push(r);
  console.log(JSON.stringify(r));
}
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify({ grid: { LO, HI, STEP, n: x.length }, scale: SCALE, rows: out }, null, 1));
