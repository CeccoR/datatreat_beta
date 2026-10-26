/* The equant pull at the line level: a family of members at one 2θ, half of them with
   ⟨L⟩_V = (1 + δ) and half (1 − δ) (in units of the mean), each drawn with its exact line (the
   ball's, or a box edge's), summed; fitted by the same family drawn with the model's member line
   (today's Lorentzian, or the lsq TCH line) with the mean and the spread free, the area fixed
   (weights 1/(y + 0.2·peak), |x| ≤ 6). Printed: the spread read over the true one, and the mean
   ⟨L⟩_V read. Pure arithmetic. */
import { ballA, boxA, reduce, pvGL } from './profiles.mjs';
import fs from 'node:fs';
const T = JSON.parse(fs.readFileSync(new URL('./tables.json', import.meta.url)));
function nm(f, x0, step, it = 3000){
  const n = x0.length; let S = [x0.slice()]; for (let i = 0; i < n; i++){ const y = x0.slice(); y[i] += step[i]; S.push(y); }
  let F = S.map(f);
  for (let k = 0; k < it; k++){
    const o = F.map((v, i)=> i).sort((p, q)=> F[p] - F[q]); S = o.map(i=> S[i]); F = o.map(i=> F[i]);
    const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j]/n;
    const r = c.map((v, j)=> v + (v - S[n][j])), fr = f(r);
    if (fr < F[0]){ const e = c.map((v, j)=> v + 2*(r[j] - v)), fe = f(e); if (fe < fr){ S[n] = e; F[n] = fe; } else { S[n] = r; F[n] = fr; } }
    else if (fr < F[n - 1]){ S[n] = r; F[n] = fr; }
    else { const cc = c.map((v, j)=> v + 0.5*(S[n][j] - v)), fc = f(cc); if (fc < F[n]){ S[n] = cc; F[n] = fc; } else { for (let i = 1; i <= n; i++){ S[i] = S[i].map((v, j)=> S[0][j] + 0.5*(v - S[0][j])); F[i] = f(S[i]); } } }
  }
  const o = F.map((v, i)=> i).sort((p, q)=> F[p] - F[q]); return { x: S[o[0]], f: F[o[0]] };
}
const xs = Array.from({ length: 601 }, (_, i)=> 6*i/600);
for (const [name, sol, gl] of [['ball', ballA(), T.ball.lsq], ['box edge', boxA(0, 0), T.box.e[0][0].lsq]]){
  const red = reduce(sol);
  const member = L => x => red.p(x*L)*L;                      // exact line of a member of ⟨L⟩_V = L (unit area)
  for (const d of [0.1, 0.2, 0.3, 0.5]){
    const ys = xs.map(x=> 0.5*member(1 + d)(x) + 0.5*member(1 - d)(x)), pk = ys[0], ws = ys.map((y, i)=> (i ? 1 : 0.5)/(y + 0.2*pk));
    const out = [];
    for (const [mname, g, l] of [['lor', 0, 0.675], ['lsq', gl[0], gl[1]]]){
      const fam = (L, s) => x => 0.5*pvGL(x, g/(L*(1 + s)), l/(L*(1 + s))) + 0.5*pvGL(x, g/(L*(1 - s)), l/(L*(1 - s)));
      const cost = p => { const L = Math.exp(p[0]), s = Math.tanh(p[1]); const f = fam(L, s); let c = 0; xs.forEach((x, i)=> { c += ws[i]*(ys[i] - f(x))**2; }); return c; };
      const r = nm(cost, [0, Math.atanh(d)], [0.1, 0.1]);
      out.push(`${mname}: spread read/true ${(Math.abs(Math.tanh(r.x[1]))/d).toFixed(2)}, mean ⟨L⟩_V read ${Math.exp(r.x[0]).toFixed(3)}`);
    }
    console.log(`${name.padEnd(9)} δ ${d.toFixed(1)} | ${out.join(' | ')}`);
  }
}
