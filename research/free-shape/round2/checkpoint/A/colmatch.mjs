#!/usr/bin/env node
/* What the column lengths alone tell apart. For a truth (a design row) and a candidate solid:
   the candidate's dimensions and orientation that best reproduce the truth's volume-weighted
   column lengths ⟨L⟩_V over the members the pattern measures, and how far it stays.
   - The members are the phase's reflections in 10–110° (Kα1), each with its intensity at the
     truth (the engine's ticks) and its members (q.mv).
   - Within a reflection the members lie at one 2θ: the line is their sum, so only the
     multiset of their ⟨L⟩_V counts, not which member carries which. The match is made on the
     sorted ln ⟨L⟩_V within each reflection.
   - The mismatch is the intensity-weighted rms of ln ⟨L⟩_V (cand) − ln ⟨L⟩_V (truth) over the
     members: ~0 means the candidate's Lorentzian lines are the truth's own, so no fit with a
     line that reads ⟨L⟩_V alone can tell the two apart; only the lines' shapes can.
   Nelder–Mead in ln W and a rotation vector, from the truth's frame and 16 random frames
   (seeded). Also per row: reflections, members, distinct ⟨L⟩_V values (to 1 %).
   node colmatch.mjs --rows subclean|id,id [--out results/colmatch.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, calc, setParams } from './eng/xrd-rietveld.js';
import { phaseOf, truthOf, ENG } from './harness/lib.mjs';
import { INSTR } from '../gen/gen.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/));
const ids = opt.rows === 'subclean' || !opt.rows ? sub.filter(s=> s[4] === 'none').map(s=> s[0]) : opt.rows === 'subscreen' ? sub.map(s=> s[0]) : String(opt.rows).split(',');
const { BODIES, quatMul, quatOfRot, shapeWidths } = ENG;
const SOLIDS = opt.cands ? String(opt.cands).split(',') : ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const x = Array.from({ length: 2001 }, (_, i)=> 10 + i*0.05);
let seed = 7;
const U = ()=> { seed = (seed*1103515245 + 12345) % 2147483648; return seed/2147483648; };
const N = ()=> Math.sqrt(-2*Math.log(U() || 1e-12))*Math.cos(2*Math.PI*U());
function nm(f, x0, step, it = 1500){
  const n = x0.length; let S = [x0.slice()]; for (let i = 0; i < n; i++){ const y = x0.slice(); y[i] += step[i]; S.push(y); }
  let F = S.map(f);
  for (let k = 0; k < it; k++){
    const o = F.map((v, i)=> i).sort((p, q)=> F[p] - F[q]); S = o.map(i=> S[i]); F = o.map(i=> F[i]);
    if (F[n] - F[0] < 1e-12) break;
    const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j]/n;
    const r = c.map((v, j)=> v + (v - S[n][j])), fr = f(r);
    if (fr < F[0]){ const e = c.map((v, j)=> v + 2*(r[j] - v)), fe = f(e); if (fe < fr){ S[n] = e; F[n] = fe; } else { S[n] = r; F[n] = fr; } }
    else if (fr < F[n - 1]){ S[n] = r; F[n] = fr; }
    else { const cc = c.map((v, j)=> v + 0.5*(S[n][j] - v)), fc = f(cc); if (fc < F[n]){ S[n] = cc; F[n] = fc; } else { for (let i = 1; i <= n; i++){ S[i] = S[i].map((v, j)=> S[0][j] + 0.5*(v - S[0][j])); F[i] = f(S[i]); } } }
  }
  const o = F.map((v, i)=> i).sort((p, q)=> F[p] - F[q]); return { x: S[o[0]], f: F[o[0]] };
}
const out = [];
for (const id of ids){
  const row = design.rows.find(r=> r.id === id);
  if (row.split === 'validation') throw new Error('validation row');
  const T = truthOf(row);
  const mk = type => { const m = buildModel({ x, y: x.map(()=> 1), instr: INSTR, phases: [phaseOf(row.phase, type)] }); return m; };
  const set = (m, P) => { const v = m.v.slice(); for (const k in P){ const i = m.index[k]; if (i != null) v[i] = P[k]; } setParams(m, v); return v; };
  const mt = mk(row.solid), qt = mt.phases[0];
  const vt = set(mt, { ...T.P, 'p1.scale': 1, 'p1.Ys': 0 });
  const ticks = calc(mt).ticks.filter(t=> t.tt >= 10 && t.tt <= 110);
  const wT = shapeWidths(mt, qt, vt);
  const refl = ticks.map(t=> ({ r: t.r, I: t.I, m: qt.mv[t.r].length/3 }));
  const Itot = refl.reduce((s, t)=> s + t.I, 0);
  const lnT = refl.map(t=> Array.from(wT[t.r]).map(w=> -Math.log(w)).sort((p, q)=> p - q));   // ln ⟨L⟩_V up to a constant
  // distinct ⟨L⟩_V (1 %) over all members, and per reflection
  const allL = lnT.flat().sort((p, q)=> p - q); let distinct = 0, last = -Infinity; for (const l of allL){ if (l - last > 0.01){ distinct++; last = l; } }
  const res = { id, laue: row.laue, solid: row.solid, dims: row.dims, refl: refl.length, members: refl.reduce((s, t)=> s + t.m, 0), distinct,
    perRefl: lnT.map(l=> { let d = 0, z = -Infinity; for (const v of l){ if (v - z > 0.01){ d++; z = v; } } return d; }), cand: {} };
  for (const cand of SOLIDS){
    const mc = mk(cand), qc = mc.phases[0], B = BODIES[cand], v0 = set(mc, { 'p1.scale': 1, 'p1.Ys': 0 });
    const nW = B.W.length;
    const f = p => {
      const v = v0.slice();
      for (let i = 0; i < nW; i++) v[qc.iW[i]] = Math.exp(p[i]);
      const Q = quatMul(cur.q0, quatOfRot([p[nW], p[nW + 1], p[nW + 2]]));
      qc.iQ.forEach((ix, k)=> { v[ix] = Q[k]; }); qc.iR.forEach(ix=> { v[ix] = 0; });
      const w = shapeWidths(mc, qc, v);
      let s = 0, sw = 0;
      refl.forEach((t, k)=> { const l = Array.from(w[t.r]).map(x=> -Math.log(x)).sort((p2, q2)=> p2 - q2), lt = lnT[k]; for (let i = 0; i < l.length; i++){ s += t.I*(l[i] - lt[i])**2; sw += t.I; } });
      return s/sw;
    };
    // starts: the truth's frame and widths where the candidate has the same parameters, else
    // the truth's mean width; and 16 random frames with widths spread about it
    const wMean = Math.exp(-lnT.flat().reduce((s, l)=> s + l, 0)/lnT.flat().length);
    const q0s = [], cur = { q0: null };
    const tq = [0, 1, 2, 3].map(k=> T.P['p1.Q' + k]);
    q0s.push({ q0: tq, W: cand === row.solid ? T.solid.W.map(Math.log) : new Array(nW).fill(Math.log(wMean)) });
    for (let s = 0; s < 16; s++){ const qq = [N(), N(), N(), N()], n = Math.hypot(...qq); q0s.push({ q0: qq.map(t=> t/n), W: new Array(nW).fill(0).map(()=> Math.log(wMean) + 0.7*N()) }); }
    let best = null;
    for (const st of q0s){
      cur.q0 = st.q0;
      const r = nm(f, [...st.W, 0, 0, 0], [...st.W.map(()=> 0.4), 0.3, 0.3, 0.3]);
      const r2 = nm(f, r.x, [...st.W.map(()=> 0.1), 0.08, 0.08, 0.08]);
      if (!best || r2.f < best.f) best = { f: r2.f, W: r2.x.slice(0, nW).map(Math.exp), Q: quatMul(cur.q0, quatOfRot([r2.x[nW], r2.x[nW + 1], r2.x[nW + 2]])) };
    }
    res.cand[cand] = { rms: Math.sqrt(best.f), W: best.W, Q: best.Q };
  }
  out.push(res);
  console.log(`${id.padEnd(24)} ${row.laue.padEnd(6)} refl ${res.refl} members ${res.members} distinct ⟨L⟩_V ${res.distinct} | ` + SOLIDS.map(c=> `${c} ${(100*res.cand[c].rms).toFixed(2)}%`).join(' '));
}
fs.writeFileSync(opt.out || path.join(HERE, 'results', 'colmatch.json'), JSON.stringify(out));
