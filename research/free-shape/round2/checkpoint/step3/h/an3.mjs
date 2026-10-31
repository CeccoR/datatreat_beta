#!/usr/bin/env node
/* Step 3's offline scoring of the per-line check, the jackknife and the remedies, from the records
   (results/<tag>/<row>.json, r.check) and the residuals' dumps (<row>.res.json) of methods/check.mjs.
     node an3.mjs [--tag C1] [--json out.json] [--part stats|flag|jack|fix|all]
   Tuning rows of the screening set only (validation rows are never read). Every statistic is at the
   returned fit (the kept shape, else the isotropic fit). */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './lib.mjs';
import { unb64, pOfZ, zOfP } from './ck.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const TAG = opt.tag || 'C1', DIR = path.join(HERE, 'results', TAG);
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const ROWS = design.rows.filter(r=> r.split === 'tuning' && r.screen);
export const f = (x, d = 2) => x === Infinity ? '∞' : x === -Infinity ? '−∞' : x == null || Number.isNaN(x) ? '—' : x.toFixed(d);
const qtl = (xs, p) => { const s = xs.filter(x=> x != null && !Number.isNaN(x)).sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || !Number.isFinite(s[hi]) ? s[lo] : s[lo] + (s[hi] - s[lo])*(i - lo); };
export const med = xs => qtl(xs, 0.5);
const bonf = (z, S, two = false) => zOfP(Math.min(0.5, (two ? 2 : 1)*S*pOfZ(z)));   // the family-wise deviate of the worst of S

/* ---------- the statistics of one row ---------- */
function rowStats(ck, dump){
  const R = unb64(dump.r), n = dump.n, x0 = dump.x0, step = (dump.x1 - dump.x0)/(n - 1);
  const g = ck.global, nu = g.N - g.P, S = ck.segs.length;
  const s = { chi2nu: g.chi2nu, zglob: (g.chi2 - nu)/Math.sqrt(2*nu), dw: g.dw, zdw: (2 - g.dw)*Math.sqrt(g.N)/2, S };
  const segs = ck.segs.map((q, i)=> ({ i, tt: q.tt, hkl: q.hkl[0], n: q.n, c2: q.c/q.n, z: q.z, zd: (2 - q.dd/q.c)*Math.sqrt(q.n)/2, zm: q.s1/Math.sqrt(q.n), ex: q.c - q.n, lo: q.lo, hi: q.hi }));
  const top = [...segs].sort((p, q)=> q.z - p.z);
  s.worstC2 = Math.max(...segs.map(q=> q.c2));                           // round 1's statistic
  s.zseg = bonf(top[0].z, S);                                            // the worst segment's χ², family-wise
  s.zsegDW = bonf(Math.max(...segs.map(q=> q.zd)), S);                   // the worst segment's Durbin–Watson
  s.zsegM = bonf(Math.max(...segs.map(q=> Math.abs(q.zm))), S, true);    // the worst segment's residual sum (two-sided)
  s.top = top.slice(0, 5).map(q=> ({ i: q.i, tt: q.tt, hkl: q.hkl, c2: q.c2, z: q.z, zB: bonf(q.z, S) }));
  // the excess χ² concentrated in few lines: the share of the positive excess in the worst 1 and 3 segments
  const ex = segs.map(q=> Math.max(0, q.ex)).sort((p, q)=> q - p), E = ex.reduce((t, v)=> t + v, 0);
  s.conc1 = E > 0 ? ex[0]/E : 0; s.conc3 = E > 0 ? (ex[0] + (ex[1] || 0) + (ex[2] || 0))/E : 0;
  // the smooth residual: bins of fixed width, z_b = Σr/√n_b; Q = Σ z_b² against χ²_B, and the worst bin
  for (const wdeg of [0.25, 1, 4]){
    const per = Math.max(1, Math.round(wdeg/step)), zb = [];
    for (let i0 = 0; i0 < n; i0 += per){ let t = 0, m = 0; for (let i = i0; i < Math.min(n, i0 + per); i++){ const v = R[i]; if (Number.isFinite(v)){ t += v; m++; } } if (m > per/2) zb.push(t/Math.sqrt(m)); }
    const Q = zb.reduce((t, z)=> t + z*z, 0), B = zb.length;
    s['zQ' + wdeg] = (Q - B)/Math.sqrt(2*B);
    s['zb' + wdeg] = bonf(Math.max(...zb.map(Math.abs)), B, true);
  }
  s.segs = segs;
  return s;
}

/* ---------- load ---------- */
export function load(tag = TAG){
  const dir = path.join(HERE, 'results', tag), out = [];
  for (const row of ROWS){
    const fn = path.join(dir, row.id + '.json'); if (!fs.existsSync(fn)) continue;
    const o = readResult(fs.readFileSync(fn, 'utf8')), r = o.records[0], ck = r.check;
    if (!ck || ck.error || !ck.segs){ out.push({ row, o, r, err: ck ? ck.error : 'no check' }); continue; }
    const dump = JSON.parse(fs.readFileSync(path.join(dir, row.id + '.res.json'), 'utf8'));
    const st = rowStats(ck, dump);
    const kept = !!r.kept, ek = row.error ? row.error.kind : 'none', es = row.error ? row.error.strength : 0;
    // harm: a truth lost, or kept with an extent beyond 25 % (or unbounded) or its most distinct axis beyond 10°;
    // a sphere kept with a shape
    let harm = false, why = '';
    if (row.kind === 'sphere'){ harm = kept; why = kept ? 'false shape' : ''; }
    else if (!kept){ harm = true; why = 'lost'; }
    else { const acc = r.acc; const w = acc.dimMax; harm = !(w <= 0.25) || (acc.principal != null && acc.principal > 10); why = w === Infinity ? 'unbounded' : w > 0.25 ? `extent ${f(100*w, 0)} %` : acc.principal > 10 ? `axis ${f(acc.principal, 1)}°` : ''; }
    out.push({ row, o, r, ck, st, kept, ek, es, harm, why, clean: ek === 'none' });
  }
  return out;
}

/* ---------- the jackknife ---------- */
// the spread of each kept slot over the drops (version 's4' or 's12'): sd of ln D and rms turn, (G−1)/G scaled
export function jackSpread(r, ck, ver = 's12', pick = null){
  const K = r.solid, drops = (ck.jack ? ck.jack.drops : []).filter(d=> d[ver] && (!pick || pick(d)));
  const G = ck.jack ? ck.jack.G : 0, fct = (G - 1)/G;
  if (!drops.length) return null;
  const sd = [0, 1, 2].map(i=> { let t = 0; for (const d of drops){ const a = K.dims[i], b = d[ver].dims[i]; const v = a === Infinity && b === Infinity ? 0 : Math.log(b/a); if (!Number.isFinite(v)) return Infinity; t += v*v; } return Math.sqrt(fct*t); });
  const rms = [0, 1, 2].map(i=> { let t = 0; for (const d of drops){ const u = K.axes[i], v = d[ver].axes[i]; const c = Math.min(1, Math.abs(u[0]*v[0] + u[1]*v[1] + u[2]*v[2])); t += (Math.acos(c)*180/Math.PI)**2; } return Math.sqrt(fct*t); });
  const sdF = [0, 1, 2].map(i=> { let t = 0; for (const d of drops){ const a = K.dims[i], b = d[ver].dims[i]; const v = a === Infinity && b === Infinity ? 0 : Math.log(b/a); if (Number.isFinite(v)) t += v*v; } return Math.sqrt(fct*t); });   // the finite drops alone (an infinite sd opens the upper end only)
  const maxd = [0, 1, 2].map(i=> Math.max(...drops.map(d=> { const v = Math.log(d[ver].dims[i]/K.dims[i]); return K.dims[i] === Infinity && d[ver].dims[i] === Infinity ? 0 : Math.abs(v); })));
  return { sd, sdF, rms, maxd, n: drops.length };
}
// the truth's pairing and principal axis for a kept solid
const REV = new Set(['cylinder', 'spheroid']), CONT = new Set(['ellipsoid', 'spheroid', 'cylinder', 'ellcyl']);
export function truthPairs(x, solid = x.r.solid){
  const T = x.o.truth, acc = compareSolids(solid, T, { rots: laueRotations(x.o.phase) });
  const lg = d => Math.log(Number.isFinite(d) ? d : 1e4), und = new Set();
  if (REV.has(T.type)) [0, 1].forEach(i=> und.add(i));
  if (CONT.has(T.type)) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j && Math.abs(lg(T.dims[i]) - lg(T.dims[j])) < 0.04) und.add(i);
  if (T.type === 'spheroid' && Math.abs(lg(T.dims[2]) - lg(T.dims[0])) < 0.04) und.add(2);
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(T.dims[i]) - lg(T.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !und.has(i)).sort((p, q)=> gap(q) - gap(p))[0];
  return { acc, pairs: acc.pairs, prin, fprin: prin == null ? null : acc.pairs.find(p=> p[0] === prin)[1] };
}
// the report's local esds by slot: Desd (linear), esdAngle (°)
export function localEsd(r){
  const rep = r.report || {}, out = [0, 1, 2].map(()=> ({ Desd: NaN, ang: NaN }));
  for (const ax of rep.axes || []) if (ax.axis != null){ out[ax.axis].Desd = ax.Desd; out[ax.axis].ang = ax.esdAngle; }
  for (let i = 0; i < 3; i++) if (!Number.isFinite(out[i].Desd)){ const d = (rep.dims || []).find(q=> Math.abs(q.D - r.solid.dims[i]) <= 1e-9*Math.max(1, r.solid.dims[i])); if (d) out[i].Desd = d.Desd; }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`){
  const X = load();
  console.log(`${X.length} rows read from results/${TAG}; ${X.filter(x=> x.err).length} without a check`);
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(X.map(x=> ({ id: x.row.id, kind: x.row.kind, ek: x.ek, es: x.es, kept: x.kept, harm: x.harm, why: x.why, st: x.st && { ...x.st, segs: undefined } })), null, 1));
}
