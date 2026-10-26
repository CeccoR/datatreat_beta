/* Shared helpers of the uniqueness study: aligning two solids modulo the cubic crystal's
   and the body's symmetry with per-axis angles, the normal CDF, a symmetric eigensolver. */
import { CUBIC } from '../harness/lib.mjs';

export const R2D = 180/Math.PI, D2R = Math.PI/180;
const unit = v => { const n = Math.hypot(...v); return v.map(t=> t/n); };
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const mv = (M, v) => [M[0]*v[0] + M[1]*v[1] + M[2]*v[2], M[3]*v[0] + M[4]*v[1] + M[5]*v[2], M[6]*v[0] + M[7]*v[1] + M[8]*v[2]];
export const angAx = (a, b) => Math.acos(Math.min(1, Math.abs(dot(unit(a), unit(b)))))*R2D;
const CLASSES = { box: [[0, 1, 2]], sqbox: [[0, 1, 2]], ellipsoid: [[0, 1, 2]], spheroid: [[0, 1, 2]], cylinder: [[0, 1], [2]], ellcyl: [[0, 1], [2]] };
const CONT = { box: false, sqbox: false, ellipsoid: true, spheroid: true, cylinder: true, ellcyl: true };
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i)=> perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p=> [x, ...p]));
const lg = d => Math.log(Number.isFinite(d) ? d : 1e4);

/* Which of a solid's axes have a direction: not a round section's (cylinder, spheroid x/y),
   nor a ball's or an elliptic section's tied pair (within tie in log). A box's axes always
   (a square turned is another solid), unless all three tie. */
export function definedAxes(s, tie = 0.04){
  const t = s.type, d = s.dims, out = [true, true, true];
  if (t === 'cylinder' || t === 'spheroid'){ out[0] = out[1] = false; if (Math.abs(lg(d[0]) - lg(d[2])) < tie) out[2] = false; return out; }
  if (CONT[t]){
    const idx = t === 'ellcyl' ? [[0, 1]] : [[0, 1], [0, 2], [1, 2]];
    for (const [a, b] of idx) if (Math.abs(lg(d[a]) - lg(d[b])) < tie){ out[a] = out[b] = false; }
    return out;
  }
  if (Math.abs(lg(d[0]) - lg(d[1])) < tie && Math.abs(lg(d[1]) - lg(d[2])) < tie) return [false, false, false];
  return out;
}

/* align(fit, ref) → { G (the crystal rotation applied to ref), per: [for each ref axis ri:
   { fi, ratio fit/ref dim, angle ° (null where the ref axis has no direction) }], orient,
   dimMax }. Dimensions paired by size within the body's axis classes, ties in ref tried in
   every order (a box's) or left without direction (continuous bodies); the pairing and
   rotation minimise 10 × the most distinct axis's angle + the other axes' angles + 100·max
   |dim error| (lib.compareSolids: the worst angle). loose: the
   three extents in one class. */
export function align(fit, ref, { loose = false, tie = 0.04 } = {}){
  const type = ref.type, cls = loose ? [[0, 1, 2]] : CLASSES[type];
  const undef = new Set(definedAxes(ref, tie).map((d, i)=> d ? -1 : i).filter(i=> i >= 0));
  let pairsets = [[]];
  for (const c of cls){
    const rs = [...c].sort((a, b)=> ref.dims[a] - ref.dims[b]), fs = [...c].sort((a, b)=> fit.dims[a] - fit.dims[b]);
    const groups = []; for (const i of rs){ const g = groups[groups.length - 1]; if (g && Math.abs(lg(ref.dims[i]) - lg(ref.dims[g[g.length - 1]])) < tie) g.push(i); else groups.push([i]); }
    let pos = 0, opts = [[]];
    for (const g of groups){
      const fpart = fs.slice(pos, pos + g.length); pos += g.length;
      const ps = g.length > 1 && !CONT[type] ? perms(fpart) : [fpart];
      const next = []; for (const o of opts) for (const p of ps) next.push([...o, ...g.map((ri, j)=> [ri, p[j]])]);
      opts = next;
    }
    const nxt = []; for (const ps of pairsets) for (const o of opts) nxt.push([...ps, ...o]);
    pairsets = nxt;
  }
  // the ref's most distinct defined axis (a plate's normal, a needle's axis): aligned first
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(ref.dims[i]) - lg(ref.dims[j]))));
  const prin = [0, 1, 2].filter(i=> !undef.has(i)).sort((x, y)=> gap(y) - gap(x))[0];
  let best = null;
  for (const pairs of pairsets){
    const dimErr = pairs.map(([ri, fi])=> fit.dims[fi]/ref.dims[ri] - 1);
    const dimMax = Math.max(...dimErr.map(e=> Number.isFinite(e) ? Math.abs(e) : 1e3));
    for (const G of CUBIC){
      let worst = 0, sum = 0; const ang = [];
      for (const [ri, fi] of pairs){
        if (undef.has(ri)){ ang[ri] = null; continue; }
        const a = angAx(fit.axes[fi], mv(G, ref.axes[ri])); ang[ri] = a; worst = Math.max(worst, a); sum += a*(ri === prin ? 10 : 1);
      }
      // the most distinct axis first (weight 10), then the others: with the worst angle a
      // plate whose in-plane edges are off would be aligned by tilting its normal (56° on
      // all three axes beats 6°, 90°, 90°)
      const score = sum + 100*dimMax;
      if (!best || score < best.score) best = { score, G, prin, orient: worst, dimMax, per: [0, 1, 2].map(ri=> { const p = pairs.find(p=> p[0] === ri); return { fi: p[1], ratio: fit.dims[p[1]]/ref.dims[ri], angle: ang[ri] }; }) };
    }
  }
  return best;
}

// Φ, the standard normal CDF (Abramowitz–Stegun 7.1.26 on erf, |error| < 1.5e-7).
export function Phi(z){
  const s = z < 0 ? -1 : 1, x = Math.abs(z)/Math.SQRT2, t = 1/(1 + 0.3275911*x);
  const y = 1 - (((((1.061405429*t - 1.453152027)*t) + 1.421413741)*t - 0.284496736)*t + 0.254829592)*t*Math.exp(-x*x);
  return 0.5*(1 + s*y);
}
// The flip probability of a competing minimum Δ above the best (Δ in χ²_ν units): under
// the best as truth, Δ* ~ N(Δ, 4Δ + c) (the noncentral part 2d·ε and the refits' share).
export const pFlip = (D, c = 0) => D <= 0 ? 0.5 : Phi(-D/Math.sqrt(4*D + c));

/* Jacobi eigenvalues of a symmetric n×n (array of rows) → { val [desc], vec [columns] }. */
export function eigSym(A){
  const n = A.length, a = A.map(r=> r.slice()), V = Array.from({ length: n }, (_, i)=> Array.from({ length: n }, (_, j)=> i === j ? 1 : 0));
  for (let sweep = 0; sweep < 60; sweep++){
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j]*a[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++){
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = (a[q][q] - a[p][p])/(2*a[p][q]), t = Math.sign(th || 1)/(Math.abs(th) + Math.sqrt(th*th + 1)), c = 1/Math.sqrt(t*t + 1), s = t*c;
      for (let k = 0; k < n; k++){ const akp = a[k][p], akq = a[k][q]; a[k][p] = c*akp - s*akq; a[k][q] = s*akp + c*akq; }
      for (let k = 0; k < n; k++){ const apk = a[p][k], aqk = a[q][k]; a[p][k] = c*apk - s*aqk; a[q][k] = s*apk + c*aqk; }
      for (let k = 0; k < n; k++){ const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c*vkp - s*vkq; V[k][q] = s*vkp + c*vkq; }
    }
  }
  const idx = [...Array(n).keys()].sort((i, j)=> a[j][j] - a[i][i]);
  return { val: idx.map(i=> a[i][i]), vec: idx.map(i=> V.map(r=> r[i])) };
}

export const quantile = (xs, p) => { const s = xs.filter(Number.isFinite).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo])*(i - lo); };
export const median = xs => quantile(xs, 0.5);
export const fmt = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
