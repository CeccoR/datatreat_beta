import { ballA, boxA, cylA, reduce, sample, cost, maxDev, pvGL, lsqGL } from './profiles.mjs';
// where the TCH line misses, and what a sum of two TCH lines reaches (Nelder–Mead on 5 params)
function nm(f, x0, step, it = 4000){
  const n = x0.length; let S = [x0.slice()]; for (let i = 0; i < n; i++){ const x = x0.slice(); x[i] += step[i]; S.push(x); }
  let F = S.map(f);
  for (let k = 0; k < it; k++){
    const o = F.map((v, i)=> i).sort((a, b)=> F[a] - F[b]); S = o.map(i=> S[i]); F = o.map(i=> F[i]);
    const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j]/n;
    const r = c.map((v, j)=> v + (v - S[n][j])), fr = f(r);
    if (fr < F[0]){ const e = c.map((v, j)=> v + 2*(r[j] - v)), fe = f(e); if (fe < fr){ S[n] = e; F[n] = fe; } else { S[n] = r; F[n] = fr; } }
    else if (fr < F[n - 1]){ S[n] = r; F[n] = fr; }
    else { const cc = c.map((v, j)=> v + 0.5*(S[n][j] - v)), fc = f(cc); if (fc < F[n]){ S[n] = cc; F[n] = fc; } else { for (let i = 1; i <= n; i++){ S[i] = S[i].map((v, j)=> S[0][j] + 0.5*(v - S[0][j])); F[i] = f(S[i]); } } }
  }
  const o = F.map((v, i)=> i).sort((a, b)=> F[a] - F[b]); return { x: S[o[0]], f: F[o[0]] };
}
for (const [name, sol] of [['ball', ballA()], ['box edge', boxA(0, 0)], ['box body', boxA(1, 1)], ['cyl across', cylA(Math.PI/2)]]){
  const red = reduce(sol), S = sample(red), L = lsqGL(red);
  // deviations along x
  const dev = S.xs.filter((x, i)=> i % 50 === 0).map(x=> (red.p(x) - pvGL(x, L.g, L.l)).toFixed(3));
  console.log(name, 'pV dev at x=0,.5,..', dev.join(' '));
  const two = p => { const [g1, l1, g2, l2, fr] = p; if (g1 < 0 || l1 < 0 || g2 < 0 || l2 < 0 || fr < 0 || fr > 1) return 1e9; return cost(S, x=> fr*pvGL(x, g1, l1) + (1 - fr)*pvGL(x, g2, l2)); };
  let best = null;
  for (const start of [[L.g*0.8, 0.01, L.g*1.5, L.l*2, 0.6], [L.g, L.l*0.3, L.g*0.5, L.l*2, 0.7], [L.g*1.2, 0.05, 0.2, 0.8, 0.8]]){
    const r = nm(two, start, start.map(v=> Math.max(0.05, 0.3*v))); if (!best || r.f < best.f) best = r; }
  const [g1, l1, g2, l2, fr] = best.x;
  console.log('   1 pV cost', L.c.toExponential(2), 'max', maxDev(S, x=> pvGL(x, L.g, L.l)).toFixed(3), '| 2 pV cost', best.f.toExponential(2), 'max', maxDev(S, x=> fr*pvGL(x, g1, l1) + (1 - fr)*pvGL(x, g2, l2)).toFixed(3), best.x.map(v=> v.toFixed(3)).join(' '));
}
