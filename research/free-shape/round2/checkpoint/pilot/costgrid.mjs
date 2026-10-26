#!/usr/bin/env node
/* What one pattern evaluation costs inside a refinement, by grid and cell, to choose them
   (the pilot's decision). For each row: the pattern drawn by the generator (exact lines)
   on the variant's grid, with the phase's CIF or its cell scaled (every length × s, the
   atoms' fractional coordinates kept); the model built as the harness builds it, set at
   the truth, and refined briefly (maxIter 3, no audit; after an untimed warm-up of one iteration) with what the search frees: the
   scale, the background, X_s, the cell, the solid's widths and turns. Then the same with
   the isotropic size (the stages before the search: scale, background, cell, Ys, Xs).
   Reports ms per evaluation (FS.evals), members in range and in the model's list.
   node costgrid.mjs --rows a,b --variants 10-130-0.01,10-110-0.01,… [--scales 1,0.9]
                     [--cif-dir dir] [--out file.json]
   The pilot's profiles (results/costgrid/) ran on the first cells, now ../phases/cif-v1
   (--cif-dir ../phases/cif-v1 to repeat them).   (one process, nice 15; the pilot's: results/costgrid/) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawRow } from '../gen/gen.mjs';
import { buildModel, setParams, refine, ENG } from '../harness/eng/xrd-rietveld.js';
import { prepPhase } from '../harness/eng/xrd-rv-model.js';
import { PHASE_OPTS } from '../harness/lib.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const rows = String(opt.rows).split(',').map(id=> design.rows.find(r=> r.id === id));
const variants = String(opt.variants || '10-130-0.01').split(',').map(s=> { const [lo, hi, step] = s.split('-').map(Number); return { lo, hi, step }; });
const scales = String(opt.scales || '1').split(',').map(Number);
const { FS, BODIES } = ENG;
const cifOf = (id, s) => {
  const src = path.join(path.resolve(opt['cif-dir'] || path.join(HERE, '..', 'phases', 'cif')), id + '.cif');
  if (s === 1) return src;
  const dir = path.join(HERE, 'tmp', 'cif-' + s); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, id + '.cif');
  fs.writeFileSync(f, fs.readFileSync(src, 'utf8').replace(/^(_cell_length_[abc]) ([\d.]+)$/mg, (m, k, v)=> `${k} ${(+v*s).toFixed(4)}`));
  return f;
};
const out = [];
for (const row of rows) for (const s of scales) for (const g of variants){
  const cif = cifOf(row.phase, s);
  const pat = drawRow({ ...row, phase: cif }, { kernel: 'exact', grid: g });
  const prep = prepPhase(fs.readFileSync(cif, 'utf8'), path.basename(cif));
  const res = { row: row.id, laue: row.laue, scale: s, grid: g, n: pat.x.length, inRange: pat.info.nMembers, refl: pat.info.nRefl };
  for (const shaped of [true, false]){
    const type = shaped ? row.solid : false;
    const ph = { id: 1, name: row.phase, cell: prep.cell, constraint: prep.constraint, ops: prep.ops, atoms: prep.atoms, mass: prep.mass, color: '#888', ...PHASE_OPTS, shape: type };
    const m = buildModel({ x: pat.x, y: pat.y, instr: pat.instr, phases: [ph] }), q = m.phases[0];
    const v = m.v.slice();
    for (const [k, val] of Object.entries(pat.truth.P)){ const i = m.index[k]; if (i != null) v[i] = val; }
    if (!shaped) v[m.index['p1.Ys']] = 0.9*1.540598/(10*Math.cbrt(row.dims[0]*row.dims[1]*row.dims[2]))*180/Math.PI;
    setParams(m, v);
    const lat = q.iLat.map(i=> m.par[i].name);
    const names = ['p1.scale', 'bg0', 'bg1', 'bg2', 'bgInv', 'p1.Xs', ...lat, ...(shaped ? [...q.iW, ...q.iR].map(i=> m.par[i].name) : ['p1.Ys'])];
    // a warm-up refinement (untimed: the JIT), then the measured one from the same start
    try { refine(m, { free: names, maxIter: 1, audit: false }); } catch(e){}
    setParams(m, v);
    const e0 = FS.evals, t0 = process.hrtime.bigint();
    try { refine(m, { free: names, maxIter: 3, audit: false }); } catch(e){ res.err = String(e.message); }
    const ms = Number(process.hrtime.bigint() - t0)/1e6, ev = FS.evals - e0;
    res[shaped ? 'shape' : 'iso'] = { evals: ev, ms: +ms.toFixed(0), msEv: +(ms/ev).toFixed(2), list: q.mv ? q.mv.reduce((t, a)=> t + a.length/3, 0) : null, listRefl: q.nRefl, free: names.length };
  }
  out.push(res);
  console.log(JSON.stringify(res));
}
if (opt.out) fs.writeFileSync(opt.out, JSON.stringify(out, null, 1));
