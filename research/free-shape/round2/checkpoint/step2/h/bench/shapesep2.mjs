#!/usr/bin/env node
/* [step2: track A's fix/shapesep.mjs on step 2's engines, exact data; ENGDIR, PROTO_PROFILE, PROTO_WPPM] [fix] What sets the families apart without noise, and whether it is the lines' direction-dependent
   shape: colsep.mjs's noise-free fits on chosen data, per clean sub-screen row: the true solid (from
   the truth) and the general member of each other family (box; elliptic cylinder; ellipsoid), from
   colmatch.json's best column-length start; Poisson weights at the row's counts. Freed as colsep: the
   scale, the background, the strain, the widths and the turns (faces rounded off first, then exact).
   --data inmodel: the pattern this process's own model draws at the truth (fix/inmodel-lib.mjs), so
     the true solid's χ² is ~0 and a rival's χ² is the separation that model's lines allow:
     FS2A_PROFILE=wppm the exact lines (shape by direction); with FS2A_WPPM_BALL=1 every member the
     ball's line at its own ⟨L⟩_V (the same shape in every direction: only the ⟨L⟩_V and the line's
     compactness); FS2A_LINE=lor the Lorentzian.
   --data exact: the generator's exact pattern; a rival's χ² less the true solid's is the margin this
     model would show on average (the noisy margin scatters about it by ~2√Δ).
   node fix/shapesep.mjs --data inmodel|exact [--rows a,b] --out file.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { buildModel, setParams, ENG } = await import(process.env.ENGDIR ? '../' + process.env.ENGDIR + '/xrd-rietveld.js' : '../eng/xrd-rietveld.js');
import { phaseOf, truthOf } from '../lib.mjs';
import { drawRow } from '../../../gen/gen.mjs';
const inModelPattern = null;   // [step2] exact data only
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'A');   // [step2] track A's folder (colmatch.json, ../design)
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const CM = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'colmatch.json'), 'utf8'));
const ids = opt.rows ? String(opt.rows).split(',') : CM.map(c=> c.id);
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball' }, GEN = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' };
const { refine, BODIES, SHAPE_SOFT, bodyFrame, quatOfMat } = ENG;
const tag = `${opt.data}/${process.env.PROTO_PROFILE || 'lorentz'}/${process.env.PROTO_WPPM || '-'}/${process.env.ENGDIR || 'eng'}`;   // [step2]
const out = [];
for (const id of ids){
  const row = design.rows.find(r=> r.id === id);
  if (!row || row.split === 'validation') throw new Error('unknown or validation row ' + id);
  const pat = opt.data === 'inmodel' ? inModelPattern(row, { noise: false }) : drawRow(row, { noise: false }), cm = CM.find(c=> c.id === id), T = truthOf(row);
  const cands = [row.solid, ...Object.keys(GEN).filter(f=> f !== FAM[row.solid]).map(f=> GEN[f])];
  const res = { id, laue: row.laue, solid: row.solid, counts: row.counts, data: opt.data, mode: tag, N: pat.x.length, cand: {} };
  for (const c of cands){
    const model = buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [phaseOf(row.phase, c)] }), q = model.phases[0];
    for (let i = 0; i < model.n; i++) model.w[i] = 1/(model.y[i] + 1);
    model.noise0 = Math.sqrt([...model.y].sort((p, q2)=> p - q2)[model.n >> 1]);
    const v = model.v.slice(), P = { ...pat.truth.P, 'p1.Ys': 0 };
    for (const k in P){ const i = model.index[k]; if (i != null && !/^p1\.(E|W|Q|R)/.test(k)) v[i] = P[k]; }
    const st = c === row.solid ? { W: T.solid.W, Q: [0, 1, 2, 3].map(k=> T.P['p1.Q' + k]) } : cm.cand[c];
    q.iW.forEach((ix, k)=> { v[ix] = st.W[k]; }); q.iQ.forEach((ix, k)=> { v[ix] = st.Q[k]; }); q.iR.forEach(ix=> { v[ix] = 0; });
    setParams(model, v);
    const names = ['p1.scale', ...model.iBg.map(i=> model.par[i].name), 'p1.Xs', ...q.iW.map(i=> model.par[i].name), ...q.iR.map(i=> model.par[i].name)];
    const t0 = Date.now();
    try {
      let at0 = null;
      if (c === row.solid){ const yc = ENG.calc(model, null, { internal: true }).yc; at0 = 0; for (let i = 0; i < model.n; i++) at0 += model.w[i]*(model.y[i] - yc[i])**2; }
      if (BODIES[c].base !== 'ball' && c !== row.solid){ model.shapeSoft = { q, soft: SHAPE_SOFT }; try { refine(model, { free: names, maxIter: 40 }); } catch(e){} model.shapeSoft = null;
        const vv = model.v.slice(), R = bodyFrame(q, vv); q.iR.forEach(i=> { vv[i] = 0; }); quatOfMat(R).forEach((x, i)=> { vv[q.iQ[i]] = x; }); setParams(model, vv); }
      const r = refine(model, { free: names, maxIter: 60 });
      res.cand[c] = { chi2: r.stats.chi2*Math.max(1, r.stats.N - r.stats.P), at0, W: q.iW.map(i=> model.v[i]), ms: Date.now() - t0 };
    } catch(e){ res.cand[c] = { error: String(e.message || e), ms: Date.now() - t0 }; }
  }
  const own = res.cand[row.solid].chi2;
  out.push(res);
  fs.writeFileSync(opt.out, JSON.stringify(out));
  console.log(`${id.padEnd(24)} ${row.laue.padEnd(6)} ${tag} own χ² ${own != null ? own.toFixed(2) : 'err'} (at truth ${res.cand[row.solid].at0 != null ? res.cand[row.solid].at0.toFixed(2) : '—'}) | ` + cands.slice(1).map(c=> `${c} ${res.cand[c].chi2 != null ? (res.cand[c].chi2 - own).toFixed(1) : 'err'} (${(res.cand[c].ms/1000).toFixed(0)} s)`).join(' '));
}
