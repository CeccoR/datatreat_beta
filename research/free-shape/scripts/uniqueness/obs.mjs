/* What the pattern sees of a solid: each reflection's members, one Lorentzian each, whose
   widths follow the solid's column length along the member's normal (RIETVELD.md §10.2–3);
   members of one d-spacing sit at one 2θ, so only the multiset of their widths per
   d-spacing is observed (any permutation of members leaves the pattern as it is). Here
   for the cubic cell of the cases (SrTiO₃ on 10–80°: h² + k² + l² ≤ 10).
   widthsOf(solid) → per d-spacing the sorted relative widths (1/nm units, ∝ the
   Lorentzian's); obsDist(a, b) → the rms of log(width ratio) over every member, members
   paired by rank within each d-spacing: 0 when the two solids draw the same pattern
   whatever their shapes. */
import { ENG } from '../harness/lib.mjs';
const { BODIES, columnLengthV } = ENG;
const unit = v => { const n = Math.hypot(...v); return v.map(x=> x/n); };
export const MEMBERS = (()=> {
  const byN = new Map(), seen = new Set();
  for (let h = -3; h <= 3; h++) for (let k = -3; k <= 3; k++) for (let l = -3; l <= 3; l++){
    const N = h*h + k*k + l*l; if (!N || N > 10) continue;
    const key = [h, k, l].join(','), neg = [-h, -k, -l].join(',');
    if (seen.has(neg)) continue; seen.add(key);
    if (!byN.has(N)) byN.set(N, []);
    byN.get(N).push(unit([h, k, l]));
  }
  return [...byN.entries()].sort((a, b)=> a[0] - b[0]).map(([N, us])=> ({ N, us }));
})();
// a solid's relative width along u (∝ the member's Lorentzian width; 1/nm)
export function widthAlong(s, u){
  const B = BODIES[s.type], t = s.axes.map((ax, i)=> (Number.isFinite(s.dims[i]) ? 1/s.dims[i] : 0)*(ax[0]*u[0] + ax[1]*u[1] + ax[2]*u[2]));
  const n = Math.hypot(...t); if (!(n > 0)) return 0;
  return B.base === 'ball' ? n : 0.75*n/columnLengthV(B.base, t.map(x=> x/n));
}
export const widthsOf = s => MEMBERS.map(f=> f.us.map(u=> widthAlong(s, u)).sort((a, b)=> a - b));
export function obsDist(a, b){
  const A = widthsOf(a), Bw = widthsOf(b); let s = 0, n = 0;
  A.forEach((ws, i)=> ws.forEach((w, j)=> { const v = Bw[i][j]; s += Math.log(Math.max(w, 1e-4)/Math.max(v, 1e-4))**2; n++; }));
  return Math.sqrt(s/n);
}
