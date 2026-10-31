/* Step 6's readers and intervals (step 4's score4.mjs generalised to any part and any records).
   x = { row, o (the record), r (its 'today' record: the prototype's run or today's search), t (its 'truth'
   reference), clean, ek (the error's kind), flag (the prototype's per-line check of the fit returned or,
   beside a rejection, of the isotropic fit), truth }. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations, phaseQ, ENG, fromCols, dimOf } from './h/lib.mjs';
export const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..');
export const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
export const D5 = JSON.parse(fs.readFileSync(path.join(HERE, 'h', 'design5.json'), 'utf8'));
export const rowsOf = part => design.rows.filter(r=> r.split === part);
export const rd = f => fs.existsSync(f) ? readResult(fs.readFileSync(f, 'utf8')) : null;
const ONE = new Set(['cylinder', 'spheroid', 'sqbox']), REV = new Set(['cylinder', 'spheroid']);
export const outc = r => !r ? null : r.error ? 'error' : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rejected') : 'none';
// A record of row id under a tag (a results/<tag> folder of step 6, or a path)
export const recDir = tag => tag.includes('/') ? path.resolve(HERE, tag) : path.join(HERE, 'results', tag);
export function loadX(rows, dirs){
  const X = [];
  for (const row of rows){
    const fn = dirs.map(d=> path.join(recDir(d), (row.key || row.id) + '.json')).find(f=> fs.existsSync(f));
    if (!fn) continue;
    const o = rd(fn), r = o.records.find(q=> q.method === 'today'), t = o.records.find(q=> q.method === 'truth') || null;
    const chk = r.check || (r.info && r.info.check) || null;
    X.push({ row, o, r, t, clean: !row.error, ek: row.error ? row.error.kind : 'none', flag: !!(chk && chk.flagged), chk, truth: row.kind === 'truth', file: fn });
  }
  return X;
}
export const byId = X => Object.fromEntries(X.map(x=> [x.row.key || x.row.id, x]));
const lg = d => Math.log(Number.isFinite(d) ? d : 1e4);
const hull = (...iv) => [Math.min(...iv.map(i=> i[0])), Math.max(...iv.map(i=> i[1]))];
const qOf = new Map(), qq = (id, type) => { const k = id + type; if (!qOf.has(k)){ const q = phaseQ(id); qOf.set(k, { shapeType: type, laue: q.laue, Bm: q.Bm }); } return qOf.get(k); };
// the minima within Δ* paired with the reported fit (the engine's minimaMatch)
export function pairedMinima(x, dstar){
  const r = x.r, type = r.solid.type, q = qq(x.o.phase, type), fit = { W: r.solid.W, R: fromCols(r.solid.axes) };
  return ((r.info && r.info.minima) || []).filter(m=> m.delta <= dstar).map(m=> ({ m, p: ENG.minimaMatch(q, fit, { W: m.W, R: m.R }, false) }));
}
/* Per truth extent and the principal axis: L the local error (κ·σ), B the minima's range, C both, J with the
   jackknife where the check fired, E the engine's own reported lo–hi; for today's records (no minima) L and
   C alike. o: { delta, deltaF, kappa, kappaA } */
export function intervals(x, o = {}){
  const DS = x.flag ? (o.deltaF ?? 25) : (o.delta ?? 16), KAP = o.kappa ?? 1.2, KAPA = o.kappaA ?? 1;
  const r = x.r, T = x.o.truth, type = r.solid.type, rep = r.report, nW = rep.dims.length, wIx = nW === 2 ? [0, 0, 1] : [0, 1, 2];
  const acc = compareSolids(r.solid, T, { rots: laueRotations(x.o.phase) });
  const PM = r.info && r.info.minima ? pairedMinima(x, DS) : [], out = { ext: [], ax: null, n: PM.length };
  for (const [ri, fi] of acc.pairs){
    if (ONE.has(T.type) && ri === 1) continue;
    const j = wIx[fi], d = rep.dims[j], D = r.solid.dims[fi], Dt = T.dims[ri];
    if (D === Infinity){ out.ext.push({ inf: true, Dt }); continue; }
    const g = rep.groups && rep.groups.find(g=> g.axes.includes(j));
    const s0 = Number.isFinite(d.Desd) ? d.Desd/D : g && Number.isFinite(g.Desd) ? g.Desd/g.D : 0, s = KAP*s0;
    const L = Number.isFinite(d.Desd) || !g ? [D*Math.exp(-2*s), D*Math.exp(2*s)] : hull([g.D*Math.exp(-2*s), g.D*Math.exp(2*s)], ...g.axes.map(i=> [rep.dims[i].D, rep.dims[i].D]));
    const pts = PM.map(({ p })=> dimOf(p.Wb[fi]));
    const B = hull([D, D], ...pts.map(t=> [t, t]));
    const C = hull(L, B);
    const J = x.flag && Number.isFinite(d.jackLo) ? hull(C, [d.jackLo, d.jackHi]) : C;
    const E = Number.isFinite(d.lo) && Number.isFinite(d.hi) ? [d.lo, d.hi] : null;
    const cov = iv => Dt >= iv[0] && Dt <= iv[1], hw = iv => Math.log(iv[1]/Math.max(1e-9, iv[0]))/2;
    out.ext.push({ Dt, D, e: Math.log(D/Dt), s, s0, z: s0 > 0 ? Math.log(D/Dt)/s0 : NaN, L: cov(L), B: cov(B), C: cov(C), J: cov(J), E: E ? cov(E) : null, hL: hw(L), hC: hw(C), hJ: hw(J), hE: E ? hw(E) : NaN, sp: hw(B) });
  }
  // the truth's most distinct axis (step 3's rule)
  const und = new Set();
  if (REV.has(T.type)) [0, 1].forEach(i=> und.add(i));
  if (T.type !== 'box' && T.type !== 'sqbox') for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j && Math.abs(lg(T.dims[i]) - lg(T.dims[j])) < 0.04) und.add(i);
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(T.dims[i]) - lg(T.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !und.has(i)).sort((p, q)=> gap(q) - gap(p))[0];
  if (prin != null && acc.principal != null){
    const fp = acc.pairs.find(p=> p[0] === prin)[1], ax = rep.axes.find(a=> a.axis === fp);
    const rL = ax && Number.isFinite(ax.esdAngle) ? 2*KAPA*ax.esdAngle : 0;
    const sp = Math.max(0, ...PM.map(({ p })=> p.ang[fp]).filter(Number.isFinite))*180/Math.PI;
    const rC = Math.max(rL, sp), rJ = Math.max(rC, x.flag && ax && Number.isFinite(ax.jackTurn) ? ax.jackTurn : 0);
    const rE = ax && Number.isFinite(ax.radius) ? ax.radius : null;
    out.ax = { e: acc.principal, rL, sp, rC, rJ, rE, L: acc.principal <= rL, C: acc.principal <= rC, J: acc.principal <= rJ, E: rE == null ? null : acc.principal <= rE };
  }
  out.acc = acc;
  return out;
}
// The best known exact χ² of a row on one line, over records (today's and truth's chi2Best) of the row's own solid
export function bestOf(lists){
  const best = {};
  for (const X of lists) for (const x of X){
    const id = x.row.key || x.row.id;
    if (x.o.shape !== (x.row.search || x.row.solid)) continue;
    for (const r of [x.r, x.t]) if (r && Number.isFinite(r.chi2Best) && (!best[id] || r.chi2Best < best[id].chi2)) best[id] = { chi2: r.chi2Best, P: r.P, N: x.o.iso.N };
  }
  return best;
}
export const reachDelta = (x, best) => { const b = best[x.row.key || x.row.id]; if (!b || !x.truth || outc(x.r) === 'early' || !Number.isFinite(x.r.chi2Best)) return NaN; return (x.r.chi2Best - b.chi2)/Math.max(1, b.chi2/Math.max(1, b.N - b.P)); };
// Accuracy of a kept truth: per truth extent sorted thinnest first; worst, thinnest, axis, anisotropy read ÷ true
export function accOf(x){
  if (!x.truth || !x.r.kept || !x.r.acc) return null;
  const ord = [0, 1, 2].sort((p, q)=> x.row.dims[p] - x.row.dims[q]), dim = ord.map(i=> x.r.acc.dimErr[i]);
  return { dim, worst: x.r.acc.dimMax, thin: dim[0], axis: x.r.acc.principal, aniso: (1 + dim[2])/(1 + dim[0]) };
}
// "Spoiled" (step 3): an extent beyond 25 % or unbounded, the most distinct axis beyond 10°, or a sphere kept
export const spoiled = x => x.row.kind === 'sphere' ? !!x.r.kept : !!(x.r.kept && x.r.acc && (!(x.r.acc.dimMax <= 0.25) || x.r.acc.principal > 10));
export const qtl = (xs, p) => { const s = xs.filter(v=> typeof v === 'number' && !Number.isNaN(v)).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? (i - lo < 1e-12 ? s[lo] : s[hi]) : s[lo] + (s[hi] - s[lo])*(i - lo); };
export const med = xs => qtl(xs, 0.5);
export const sum = xs => xs.reduce((t, v)=> t + v, 0);
export const f = (x, d = 1) => x === Infinity ? '∞' : x == null || !Number.isFinite(x) ? '—' : (+x).toFixed(d);
export const pc = (x, d = 0) => x === Infinity ? '+∞' : x == null || !Number.isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(d) + ' %';
export const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
export const KINDS = ['hump', 'sizedist', 'impurity', 'air', 'po'];
