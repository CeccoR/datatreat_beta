import fs from 'node:fs';
import { buildModel, setParams, ENG } from '../eng/xrd-rietveld.js';
import { phaseOf, truthOf } from '../harness/lib.mjs';
import { drawRow } from '../../gen/gen.mjs';
const design = JSON.parse(fs.readFileSync('../design/design.json', 'utf8'));
const CM = JSON.parse(fs.readFileSync('results/colmatch.json', 'utf8'));
const row = design.rows.find(r=> r.id === 'cylinder-P6m-on'), cm = CM.find(c=> c.id === row.id);
const pat = drawRow(row, { noise: false, kernel: 'none' });
for (const c of ['cylinder', 'box']){
  const model = buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [phaseOf(row.phase, c)] }), q = model.phases[0];
  const v = model.v.slice(), P = { ...pat.truth.P, 'p1.Ys': 0 };
  for (const k in P){ const i = model.index[k]; if (i != null && !/^p1\.(E|W|Q|R)/.test(k)) v[i] = P[k]; }
  const T = truthOf(row);
  const st = c === row.solid ? { W: T.solid.W, Q: [0, 1, 2, 3].map(k=> T.P['p1.Q' + k]) } : cm.cand[c];
  console.log(c, 'start W', st.W, 'Q', st.Q);
  q.iW.forEach((ix, k)=> { v[ix] = st.W[k]; }); q.iQ.forEach((ix, k)=> { v[ix] = st.Q[k]; }); q.iR.forEach(ix=> { v[ix] = 0; });
  setParams(model, v);
  const s0 = ENG.evaluate(model, model.v); console.log(' chi2 at start', s0.chi2, 'scale', model.v[model.index['p1.scale']], 'Ys', model.v[q.iYs], 'Wnames', q.iW.map(i=> model.par[i].name));
  console.log(' keys missing', Object.keys(P).filter(k=> model.index[k] == null));
}
{
  const { calc } = await import('../eng/xrd-rietveld.js');
  for (const c of ['cylinder', 'box']){
    const model = buildModel({ x: pat.x, y: Array.from(pat.yc), instr: pat.instr, phases: [phaseOf(row.phase, c)] }), q = model.phases[0];
    const v = model.v.slice(), P = { ...pat.truth.P, 'p1.Ys': 0 };
    for (const k in P){ const i = model.index[k]; if (i != null && !/^p1\.(E|W|Q|R)/.test(k)) v[i] = P[k]; }
    const T = truthOf(row), st = c === row.solid ? { W: T.solid.W, Q: [0, 1, 2, 3].map(k=> T.P['p1.Q' + k]) } : cm.cand[c];
    q.iW.forEach((ix, k)=> { v[ix] = st.W[k]; }); q.iQ.forEach((ix, k)=> { v[ix] = st.Q[k]; }); q.iR.forEach(ix=> { v[ix] = 0; });
    setParams(model, v);
    const r = calc(model, null, { internal: true }); const ev = ENG.evaluate(model, model.v); let c2 = 0, c3 = 0; for (let i = 0; i < r.yc.length; i++){ c2 += (pat.yc[i] - r.yc[i])**2/(pat.yc[i] + 1); c3 += model.w[i]*(model.y[i] - ev.yc[i])**2; } console.log(c, 'chi2 calc', c2, 'eval', ev.chi2, c3, 'w0', model.w[0], 'y0', model.y[0], pat.yc[0], 'ev.yc0', ev.yc[0], r.yc[0]); let mx = 0, sm = 0, smd = 0; for (let i = 0; i < r.yc.length; i++){ mx = Math.max(mx, r.yc[i]); sm += r.yc[i]; smd += pat.yc[i]; }
    console.log(c, 'model max', mx.toFixed(0), 'sum', sm.toExponential(3), 'data sum', smd.toExponential(3), 'bg0', model.v[model.index.bg0], 'n', model.n, r.yc.length, 'rev', model.rev);
  }
}
