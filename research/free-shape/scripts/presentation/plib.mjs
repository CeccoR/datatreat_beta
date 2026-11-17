/* The presentation study's library: loading every run's inputs (the baseline's record, the
   uniqueness study's minima with their covariances and profiles, this study's searches as
   the other solids), class-independent quantities (column lengths), intervals and their
   coverage of the truth. Read-only on ../harness and ../uniqueness. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readResult, CASES, ENG, CUBIC, compareSolids, truthOf } from '../harness/lib.mjs';
import { align } from './ulib.mjs';
export { CASES, ENG, align };

export const HERE = path.dirname(fileURLToPath(import.meta.url));
const FS_DIR = path.resolve(HERE, '..');
export const D2R = Math.PI/180, R2D = 180/Math.PI;
const K = ENG.K_SCHERRER, LAM = 1.540598;
export const widthOf = D => Number.isFinite(D) ? K*LAM/(D*10)*R2D : 0;
export const dimOf = W => W > 0 ? K*LAM/(W*D2R)/10 : Infinity;
export const TYPES = ['spheroid', 'cylinder', 'sqbox', 'ellipsoid', 'box', 'ellcyl'];
const BASE = { ellipsoid: 'ball', spheroid: 'ball', cylinder: 'cylinder', ellcyl: 'cylinder', box: 'cube', sqbox: 'cube' };
export const ROUND = { spheroid: true, cylinder: true };     // x, y without a direction

const rd = f => fs.existsSync(f) ? readResult(fs.readFileSync(f, 'utf8')) : null;
/* loadRun(id, seed) → { c, base (baseline record), tref (truth reference), truth (solid),
   iso, uq (uniqueness record's info.uniq or null), uqRec, xc { type: record } } */
export function loadRun(id, seed){
  const c = CASES.find(x=> x.id === id);
  const b = rd(path.join(FS_DIR, 'harness', 'results', 'baseline', `${id}-${seed}.json`));
  const u = rd(path.join(FS_DIR, 'uniqueness', 'results', 'main', `${id}-${seed}.json`));
  const xc = {};
  for (const t of TYPES){ const r = rd(path.join(HERE, 'results', 'xclass', `${id}-${seed}-${t}.json`)); if (r && r.records[0]) xc[t] = { ...r.records[0], iso: r.iso }; }
  const uqRec = u && u.records[0];
  const truth = b && (b.truth || (u && u.truth) || (c.dims && b.shape === c.type ? truthOf(c).solid : null));
  return { c, id, seed, base: b && b.records[0], tref: b && b.records[1], truth, iso: b && b.iso, type: b && b.shape,
    uq: uqRec && uqRec.info && uqRec.info.uniq || null, uqRec, xc };
}

/* ---------- geometry ---------- */
const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const mv = (M, v) => [M[0]*v[0] + M[1]*v[1] + M[2]*v[2], M[3]*v[0] + M[4]*v[1] + M[5]*v[2], M[6]*v[0] + M[7]*v[1] + M[8]*v[2]];
export const angAx = (a, b) => Math.acos(Math.min(1, Math.abs(dot(unit(a), unit(b)))))*R2D;
/* Lcol(solid, u) → the volume-weighted column length ⟨L⟩_V (nm) along the unit vector u
   (crystal Cartesian), in the engine's calibration (a sphere of D: 3D/4; a box's edge: the
   edge): w(u) = 0.75|t|/L_base(t̂), t = W∘(Rotᵀu), L = 0.75·D(w). */
export function Lcol(s, u){
  const W = s.dims.map(widthOf), A = s.axes;
  const t = [0, 1, 2].map(i=> W[i]*dot(A[i], u));
  const n = Math.hypot(...t);
  if (!(n > 0)) return Infinity;
  const w = 0.75*n/ENG.columnLengthV(BASE[s.type], t);
  return 0.75*dimOf(w);
}
// the class factor: ⟨L⟩_V along a body axis over that axis' dimension
export const Lfactor = (type, i) => BASE[type] === 'ball' ? 0.75 : BASE[type] === 'cylinder' && i < 2 ? 8/(3*Math.PI) : 1;
// principal column lengths: ⟨L⟩_V along the body axes
export const Lprin = s => s.dims.map((d, i)=> Number.isFinite(d) ? d*Lfactor(s.type, i) : Infinity);

/* Member directions of a cubic phase's reflections on 10–80° (Cu Kα1, a 3.916 Å):
   families h²+k²+l² ≤ 10, one of each ± pair. */
export const FAMILIES = (()=> {
  const fam = new Map();
  for (let h = -3; h <= 3; h++) for (let k = -3; k <= 3; k++) for (let l = -3; l <= 3; l++){
    const N = h*h + k*k + l*l; if (!N || N > 10) continue;
    const key = [Math.abs(h), Math.abs(k), Math.abs(l)].sort((a, b)=> b - a).join('');
    if (!fam.has(key)) fam.set(key, []);
    const L = fam.get(key);
    if (L.some(v=> (v[0] === -h && v[1] === -k && v[2] === -l))) continue;
    L.push([h, k, l]);
  }
  return [...fam.entries()].map(([k, L])=> ({ hkl: k, N: L[0].reduce((t, x)=> t + x*x, 0), members: L.map(unit) })).sort((a, b)=> a.N - b.N);
})();
export const memberLs = s => FAMILIES.map(f=> f.members.map(u=> Lcol(s, u)));

/* ---------- aligning two solids of any classes on their principal column lengths ---------- */
const lg = d => Math.log(Number.isFinite(d) ? d : 1e4);
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i)=> perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p=> [x, ...p]));
/* alignL(fit, ref) → per ref axis ri: { fi, ratio (fit L / ref L), angle (null where either
   axis has no direction) }, prin (the ref's most distinct axis). Pairing by size of the
   principal column lengths; the ref's ties (4 %) tried in every order; round sections and
   ties of a continuous body have no direction. */
export function alignL(fit, ref, tie = 0.04){
  const Lf = Lprin(fit), Lr = Lprin(ref);
  const undefOf = (s, L) => { const o = new Set(); if (ROUND[s.type]){ o.add(0); o.add(1); }
    const cont = BASE[s.type] !== 'cube';
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(lg(L[a]) - lg(L[b])) < tie && cont){ o.add(a); o.add(b); }
    if (Math.abs(lg(L[0]) - lg(L[1])) < tie && Math.abs(lg(L[1]) - lg(L[2])) < tie){ o.add(0); o.add(1); o.add(2); }
    return o; };
  const ur = undefOf(ref, Lr), uf = undefOf(fit, Lf);
  const rs = [0, 1, 2].sort((a, b)=> Lr[a] - Lr[b]), fsrt = [0, 1, 2].sort((a, b)=> Lf[a] - Lf[b]);
  const groups = []; for (const i of rs){ const g = groups[groups.length - 1]; if (g && Math.abs(lg(Lr[i]) - lg(Lr[g[g.length - 1]])) < tie) g.push(i); else groups.push([i]); }
  let opts = [[]], pos = 0;
  for (const g of groups){ const fp = fsrt.slice(pos, pos + g.length); pos += g.length;
    const ps = g.length > 1 ? perms(fp) : [fp]; const nx = []; for (const o of opts) for (const p of ps) nx.push([...o, ...g.map((ri, j)=> [ri, p[j]])]); opts = nx; }
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(Lr[i]) - lg(Lr[j]))));
  const prin = [0, 1, 2].filter(i=> !ur.has(i)).sort((a, b)=> gap(b) - gap(a))[0];
  let best = null;
  for (const pairs of opts) for (const G of CUBIC){
    let sc = 0; const ang = [];
    for (const [ri, fi] of pairs){
      if (ur.has(ri) || uf.has(fi)){ ang[ri] = null; continue; }
      const a = angAx(fit.axes[fi], mv(G, ref.axes[ri])); ang[ri] = a; sc += a*(ri === prin ? 10 : 1);
    }
    if (!best || sc < best.sc) best = { sc, prin, per: [0, 1, 2].map(ri=> { const p = pairs.find(p=> p[0] === ri); return { fi: p[1], ratio: Lf[p[1]]/Lr[ri], angle: ang[ri] }; }) };
  }
  return best;
}

/* ---------- intervals ---------- */
// a mixture of split normals in log: comps [{ w, mu, sLo, sHi }] (s = Infinity: open) →
// quantile p (exp of it; Infinity when open)
export function mixQuantile(comps, p){
  const W = comps.reduce((t, c)=> t + c.w, 0);
  const Phi = z => 0.5*(1 + erf(z/Math.SQRT2));
  const cdf = x => comps.reduce((t, c)=> {
    if (!Number.isFinite(c.mu)) return t;                    // all mass at +∞
    const s = x < c.mu ? c.sLo : c.sHi;
    // a split normal with equal heights at μ: mass sLo/(sLo+sHi) below
    const fl = Number.isFinite(c.sLo) ? c.sLo : 1e6, fh = Number.isFinite(c.sHi) ? c.sHi : 1e6, lo = fl/(fl + fh);
    if (x < c.mu) return t + c.w*(Number.isFinite(c.sLo) ? 2*lo*Phi((x - c.mu)/c.sLo) : lo);
    return t + c.w*(lo + (Number.isFinite(c.sHi) ? 2*(1 - lo)*(Phi((x - c.mu)/c.sHi) - 0.5) : 0));
  }, 0)/W;
  let a = Math.log(0.05), b = Math.log(1e5);
  if (cdf(b) < p) return Infinity;
  if (cdf(a) > p) return Math.exp(a);
  for (let i = 0; i < 60; i++){ const m = (a + b)/2; if (cdf(m) < p) a = m; else b = m; }
  return Math.exp((a + b)/2);
}
function erf(x){ const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1/(1 + 0.3275911*x);
  return s*(1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t*Math.exp(-x*x)); }
export const inside = (x, [lo, hi], tol = 1e-9) => x >= lo*(1 - tol) && x <= hi*(1 + tol);
export const quantile = (xs, p) => { const s = xs.filter(x=> !Number.isNaN(x)).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i); const hi = Math.min(lo + 1, s.length - 1); if (!Number.isFinite(s[hi]) || !Number.isFinite(s[lo])) return s[i - lo < 0.5 ? lo : hi]; return s[lo] + (s[hi] - s[lo])*(i - lo); };
export const median = xs => quantile(xs, 0.5);
export const fmt = (x, d = 1) => x == null || Number.isNaN(x) ? '—' : !Number.isFinite(x) ? '∞' : x.toFixed(d);
export const pct = (a, n) => n ? `${a}/${n} (${Math.round(100*a/n)} %)` : '—';
