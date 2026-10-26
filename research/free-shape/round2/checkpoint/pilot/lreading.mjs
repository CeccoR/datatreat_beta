#!/usr/bin/env node
/* What the model's Lorentzian reads from one exact size line, alone (no instrument, no
   strain, no overlap): the line P(s) = 2∫A(L)cos(2πsL)dL of a solid along one direction
   (kernels.mjs A(L), unit area), and the Lorentzian of the same area whose FWHM Γ best fits
   it by weighted least squares over |s| ≤ 6/⟨L⟩_V, the weights Poisson-like, 1/(P + b) with b
   a flat background at a fifth of the peak. The model's reading is ⟨L⟩_V = 0.675/Γ (the
   engine's FWHM convention); the ratio to the true ⟨L⟩_V is printed per solid and
   direction. With the area left free too, the second column. Pure arithmetic: no engine. */
import { body, along } from '../gen/kernels.mjs';
const cases = [
  ['box, along an edge', 'box', [100, 100, 100], [1, 0, 0]],
  ['box, along a face diagonal', 'box', [100, 100, 100], [1, 1, 0]],
  ['box, along a body diagonal', 'box', [100, 100, 100], [1, 1, 1]],
  ['box 1:2:4, generic direction', 'box', [100, 200, 400], [0.6, 0.5, 0.62]],
  ['ball (sphere, ellipsoid, spheroid), any direction', 'ellipsoid', [100, 100, 100], [1, 0, 0]],
  ['cylinder D = H, along the axis', 'cylinder', [100, 100, 100], [0, 0, 1]],
  ['cylinder D = H, across the axis', 'cylinder', [100, 100, 100], [1, 0, 0]],
  ['cylinder D = H, 45° to the axis', 'cylinder', [100, 100, 100], [1, 0, 1]],
];
const n = 2000;
function line(A, T){
  const dL = T/n, w = []; for (let i = 0; i <= n; i++) w.push(A(i*dL)*(i === 0 || i === n ? 0.5 : 1)*dL);
  return s => { let t = 0; for (let i = 0; i <= n; i++) t += w[i]*Math.cos(2*Math.PI*s*i*dL); return 2*t; };
}
for (const [name, type, D, dir] of cases){
  const b = body(type, D, null), k = along(b, dir), P = line(k.A, k.T);
  let Lv = 0; { const dL = k.T/n; for (let i = 0; i <= n; i++) Lv += k.A(i*dL)*(i === 0 || i === n ? 0.5 : 1)*dL; Lv *= 2; }
  const S = 6/Lv, m = 1200, ss = Array.from({ length: m + 1 }, (_, i)=> -S + 2*S*i/m), ys = ss.map(P), pk = Math.max(...ys), bg = pk/5;
  const lor = (s, G, a) => a*(G/(2*Math.PI))/(s*s + G*G/4);
  const cost = (G, a) => ys.reduce((t, y, i)=> t + (y - lor(ss[i], G, a))**2/(y + bg), 0);
  const best = free => { let bestG = null, bestC = Infinity, bestA = 1;
    for (let j = 0; j <= 400; j++){ const G = (0.2 + 2.3*j/400)/Lv;
      let a = 1;
      if (free){ let num = 0, den = 0; ys.forEach((y, i)=> { const f = lor(ss[i], G, 1); num += y*f/(y + bg); den += f*f/(y + bg); }); a = num/den; }
      const c = cost(G, a); if (c < bestC){ bestC = c; bestG = G; bestA = a; } }
    return { G: bestG, a: bestA }; };
  const f1 = best(false), f2 = best(true);
  console.log(`${name.padEnd(48)} ⟨L⟩_V read/true: ${(0.675/f1.G/Lv).toFixed(2)} (area fixed), ${(0.675/f2.G/Lv).toFixed(2)} (area free, ${f2.a.toFixed(2)} of it)`);
}
