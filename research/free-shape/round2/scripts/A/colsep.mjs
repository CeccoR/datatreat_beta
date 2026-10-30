#!/usr/bin/env node
/* How far apart the solids lie, without noise: each clean row's pattern drawn without noise
   (exact lines, or the engine's own with --kernel none), and each of the six solids refined to
   it with Track A's model (FS2A_LINE / FS2A_PROFILE) from the start colmatch.mjs found (the
   candidate's best match of the truth's column lengths; the truth's own solid from the truth).
   Freed: the scale, the background, the strain and the solid's widths and turns (the faces
   rounded off first, then exact, as the truth reference). The χ² of a noise-free fit is the
   expected Δχ² a noisy fit would add: with the engine's own lines (in-model) the truth's own
   solid reaches ~0, and another solid's χ² is how far the column lengths (and nothing else) set
   it apart; with exact lines every solid carries the model's line-shape misfit too.
   node colsep.mjs --kernel exact|none [--rows subclean] [--cm results/colmatch.json] --out file.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, setParams, ENG } from './eng/xrd-rietveld.js';
import { phaseOf, truthOf } from './harness/lib.mjs';
import { drawRow } from '../gen/gen.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const CM = JSON.parse(fs.readFileSync(opt.cm || path.join(HERE, 'results', 'colmatch.json'), 'utf8'));
const ids = opt.rows && opt.rows !== 'subclean' ? String(opt.rows).split(',') : CM.map(c=> c.id);
const SOL = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const { refine, BODIES, SHAPE_SOFT, bodyFrame, quatOfMat, evaluate } = ENG;
const out = [];
for (const id of ids){
  const row = design.rows.find(r=> r.id === id);
  if (row.split === 'validation') throw new Error('validation row');
  const pat = drawRow(row, { noise: false, kernel: opt.kernel || 'exact' }), cm = CM.find(c=> c.id === id), T = truthOf(row);
  const res = { id, laue: row.laue, solid: row.solid, counts: row.counts, kernel: opt.kernel || 'exact', line: ENG.SIZE_MODE, profile: process.env.FS2A_PROFILE || 'lorentz', N: pat.x.length, cand: {} };
  for (const c of SOL){
    const model = buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [phaseOf(row.phase, c)] }), q = model.phases[0];
    // Poisson weights at the row's counts: the engine reads noise-free data as not counts
    // (its noise estimate ~0) and would weigh them by that noise
    for (let i = 0; i < model.n; i++) model.w[i] = 1/(model.y[i] + 1);
    model.noise0 = Math.sqrt([...model.y].sort((p, q2)=> p - q2)[model.n >> 1]);
    const v = model.v.slice(), P = { ...pat.truth.P, 'p1.Ys': 0 };
    for (const k in P){ const i = model.index[k]; if (i != null && !/^p1\.(E|W|Q|R)/.test(k)) v[i] = P[k]; }
    const st = c === row.solid ? { W: T.solid.W, Q: [0, 1, 2, 3].map(k=> T.P['p1.Q' + k]) } : cm.cand[c];
    q.iW.forEach((ix, k)=> { v[ix] = st.W[k]; }); q.iQ.forEach((ix, k)=> { v[ix] = st.Q[k]; }); q.iR.forEach(ix=> { v[ix] = 0; });
    setParams(model, v);
    const names = ['p1.scale', ...model.iBg.map(i=> model.par[i].name), 'p1.Xs', ...q.iW.map(i=> model.par[i].name), ...q.iR.map(i=> model.par[i].name)];
    const t0 = Date.now();
    let chi = NaN, r;
    try {
      if (BODIES[c].base !== 'ball'){ model.shapeSoft = { q, soft: SHAPE_SOFT }; try { refine(model, { free: names, maxIter: 40 }); } catch(e){} model.shapeSoft = null;
        const vv = model.v.slice(), R = bodyFrame(q, vv); q.iR.forEach(i=> { vv[i] = 0; }); quatOfMat(R).forEach((x, i)=> { vv[q.iQ[i]] = x; }); setParams(model, vv); }
      r = refine(model, { free: names, maxIter: 60 });
      chi = r.stats.chi2*Math.max(1, r.stats.N - r.stats.P);
    } catch(e){ res.cand[c] = { error: String(e.message || e) }; continue; }
    res.cand[c] = { chi2: chi, W: q.iW.map(i=> model.v[i]), ms: Date.now() - t0 };
  }
  const own = res.cand[row.solid].chi2;
  out.push(res);
  console.log(`${id.padEnd(24)} ${row.laue.padEnd(6)} ${res.kernel}/${res.line}${res.profile !== 'lorentz' ? '/' + res.profile : ''} own χ² ${own.toFixed(1)} | ` + SOL.map(c=> `${c} ${res.cand[c].chi2 != null ? (res.cand[c].chi2 - own).toFixed(1) : 'err'}`).join(' '));
}
fs.writeFileSync(opt.out, JSON.stringify(out));
