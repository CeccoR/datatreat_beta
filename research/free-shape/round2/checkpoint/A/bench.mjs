#!/usr/bin/env node
/* The cost of one pattern evaluation per line model, apart from the search: a row's model at
   its truth (the solid shaped, as in the search; and the isotropic sphere), its phase pattern
   evaluated `--n` times after a warm-up, the median of 5 blocks. Run once per mode in one
   process each (FS2A_LINE, FS2A_PROFILE), the modes one after another under the same load.
   node bench.mjs --rows a,b [--n 40] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, setParams, ENG } from './eng/xrd-rietveld.js';
import { phaseOf } from './harness/lib.mjs';
import { drawRow } from '../gen/gen.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const n = +(opt.n || 40);
const res = [];
for (const id of String(opt.rows).split(',')){
  const row = design.rows.find(r=> r.id === id);
  if (row.split === 'validation') throw new Error('validation row');
  const pat = drawRow(row, { noise: true });
  for (const shaped of [true, false]){
    const model = buildModel({ x: pat.x, y: pat.y, instr: pat.instr, phases: [phaseOf(row.phase, row.solid)] }), q = model.phases[0];
    const v = model.v.slice(), P = { ...pat.truth.P };
    if (!shaped){ for (const k of Object.keys(P)) if (/^p1\.(E|W|Q|R)/.test(k)) delete P[k]; P['p1.Ys'] = 0.9*1.540598/(row.dims[0]*10)*180/Math.PI; }
    for (const k in P){ const i = model.index[k]; if (i != null) v[i] = P[k]; }
    setParams(model, v);
    const out = new Float64Array(model.n);
    for (let i = 0; i < 5; i++) ENG.phasePattern(model, model.v, 0, out);
    const blocks = [];
    for (let b = 0; b < 5; b++){ const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) ENG.phasePattern(model, model.v, 0, out); blocks.push(Number(process.hrtime.bigint() - t0)/1e6/n); }
    blocks.sort((x, y)=> x - y);
    const r = { id, laue: row.laue, shaped, mode: ENG.SIZE_MODE, profile: process.env.FS2A_PROFILE || 'lorentz', ms: blocks[2], refl: q.nRefl, members: q.mv ? q.mv.reduce((s, m)=> s + m.length/3, 0) : null };
    res.push(r);
    console.log(`${r.mode}${r.profile !== 'lorentz' ? '/' + r.profile : ''} ${id.padEnd(24)} ${shaped ? 'shaped' : 'sphere'} ${r.ms.toFixed(2)} ms/eval (list ${r.refl} refl, ${r.members} members)`);
  }
}
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(res));
