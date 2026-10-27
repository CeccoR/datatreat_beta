/* Verifier's independent check of Track A's size lines (no import of A's profiles.mjs, the
   generator or the engine): the exact line of a member from the solid's A(ξ) by Simpson's
   rule on a dense uniform grid, the TCH pseudo-Voigt typed from Thompson, Cox & Hastings
   (1987), and a weighted least-squares fit by a coarse grid then Nelder–Mead. Compared with
   A/lines/tables.json (g, l of the lsq line; its max deviation) at chosen shapes, and the
   Lorentzian's reading of the exact line (FWHM 0.675/<L>_V, scale free, area fixed).
   node indep-line.mjs */
import fs from 'node:fs';
const T = JSON.parse(fs.readFileSync(new URL('../A/lines/tables.json', import.meta.url), 'utf8'));
const NS = 20000;                                      // Simpson intervals on [0, 1]
function line(Afun){
  const h = 1/NS, xi = [], A = [];
  for (let i = 0; i <= NS; i++){ xi.push(i*h); A.push(Math.max(0, Afun(i*h))); }
  const simp = f => { let s = f(0) + f(NS); for (let i = 1; i < NS; i++) s += (i % 2 ? 4 : 2)*f(i); return s*h/3; };
  const Lv = 2*simp(i=> A[i]);
  const p = x => (2/Lv)*simp(i=> A[i]*Math.cos(2*Math.PI*x*xi[i]/Lv));
  return { Lv, p };
}
const ball = x => x >= 1 ? 0 : 1 - 1.5*x + 0.5*x**3;
const box = (b, g) => x => x >= 1 ? 0 : (1 - x)*(1 - b*x)*(1 - g*x);
const cyl = psi => { const c = Math.cos(psi), s = Math.sin(psi), Tt = 1/Math.max(c, s);
  return x => { const l = x*Tt, z = 1 - l*c, d = l*s; if (z <= 0 || d >= 1) return 0; return z*(2/Math.PI)*(Math.acos(d) - d*Math.sqrt(1 - d*d)); }; };
function tchPV(x, G, L){
  const H = Math.pow(G**5 + 2.69269*G**4*L + 2.42843*G**3*L**2 + 4.47163*G**2*L**3 + 0.07842*G*L**4 + L**5, 0.2);
  const q = L/H, eta = Math.min(1, Math.max(0, 1.36603*q - 0.47719*q*q + 0.11116*q**3));
  const lor = 2/(Math.PI*H)/(1 + 4*(x/H)**2), gau = 2*Math.sqrt(Math.LN2/Math.PI)/H*Math.exp(-4*Math.LN2*(x/H)**2);
  return eta*lor + (1 - eta)*gau;
}
const XS = Array.from({ length: 601 }, (_, i)=> 6*i/600);
function nelder(f, x0, step){
  let S = [x0.slice(), [x0[0] + step, x0[1]], [x0[0], x0[1] + step]], F = S.map(f);
  for (let it = 0; it < 2000; it++){
    const o = [0, 1, 2].sort((a, b)=> F[a] - F[b]); S = o.map(i=> S[i]); F = o.map(i=> F[i]);
    if (Math.abs(F[2] - F[0]) < 1e-16*Math.max(1e-30, Math.abs(F[0]))) break;
    const c = [(S[0][0] + S[1][0])/2, (S[0][1] + S[1][1])/2];
    const r = [2*c[0] - S[2][0], 2*c[1] - S[2][1]], fr = f(r);
    if (fr < F[0]){ const e = [3*c[0] - 2*S[2][0], 3*c[1] - 2*S[2][1]], fe = f(e); if (fe < fr){ S[2] = e; F[2] = fe; } else { S[2] = r; F[2] = fr; } }
    else if (fr < F[1]){ S[2] = r; F[2] = fr; }
    else { const k = [(c[0] + S[2][0])/2, (c[1] + S[2][1])/2], fk = f(k);
      if (fk < F[2]){ S[2] = k; F[2] = fk; } else { for (const i of [1, 2]){ S[i] = [(S[0][0] + S[i][0])/2, (S[0][1] + S[i][1])/2]; F[i] = f(S[i]); } } }
  }
  const o = [0, 1, 2].sort((a, b)=> F[a] - F[b]); return { x: S[o[0]], f: F[o[0]] };
}
function fit(p){
  const ys = XS.map(p), ws = ys.map((y, i)=> (i ? 1 : 0.5)/(Math.max(0, y) + 0.2));
  const cost = q => { const G = Math.abs(q[0]) + 1e-12, L = Math.abs(q[1]); let c = 0; XS.forEach((x, i)=> { c += ws[i]*(ys[i] - tchPV(x, G, L))**2; }); return c; };
  let best = null;
  for (let G = 0.01; G <= 1.2; G += 0.05) for (let L = 0.01; L <= 1.0; L += 0.05){ const c = cost([G, L]); if (!best || c < best.c) best = { c, q: [G, L] }; }
  const r = nelder(cost, best.q, 0.02);
  const G = Math.abs(r.x[0]), L = Math.abs(r.x[1]);
  let dev = 0; XS.forEach((x, i)=> { dev = Math.max(dev, Math.abs(ys[i] - tchPV(x, G, L))); });
  // the Lorentzian of FWHM 0.675·k (k free) read: <L>_V read/true = 1/k
  const lc = k => { let c = 0; XS.forEach((x, i)=> { c += ws[i]*(ys[i] - tchPV(x, 0, 0.675*k))**2; }); return c; };
  let a = 0.5, b = 2; for (let i = 0; i < 100; i++){ const m1 = a + (b - a)/3, m2 = b - (b - a)/3; if (lc(m1) < lc(m2)) b = m2; else a = m1; }
  let ldev = 0; const k = (a + b)/2; XS.forEach((x, i)=> { ldev = Math.max(ldev, Math.abs(ys[i] - tchPV(x, 0, 0.675*k))); });
  return { G, L, dev, lorRead: 1/k, lorDev: ldev };
}
const out = [];
const cases = [['ball', ball, T.ball],
  ['box β0 γ0 (edge)', box(0, 0), T.box.e[0][0]], ['box β.5 γ0', box(0.5, 0), T.box.e[20][0]], ['box β1 γ0 (face diag)', box(1, 0), T.box.e[40][0]],
  ['box β.5 γ.25', box(0.5, 0.25), T.box.e[20][10]], ['box β1 γ1 (body diag)', box(1, 1), T.box.e[40][40]],
  ['cyl ψ0 (axis)', cyl(0), T.cyl.e[0]], ['cyl ψ30', cyl(30*Math.PI/180), T.cyl.e[60]], ['cyl ψ45', cyl(45*Math.PI/180), T.cyl.e[90]], ['cyl ψ60', cyl(60*Math.PI/180), T.cyl.e[120]], ['cyl ψ90 (across)', cyl(Math.PI/2), T.cyl.e[180]]];
for (const [name, Af, e] of cases){
  const ln = line(Af), r = fit(ln.p);
  out.push({ name, mine: { g: r.G, l: r.L, dev: r.dev, lorRead: r.lorRead, lorDev: r.lorDev }, table: { g: e.lsq[0], l: e.lsq[1], dev: e.devLsq } });
  console.log(`${name.padEnd(24)} mine g ${r.G.toFixed(4)} l ${r.L.toFixed(4)} dev ${(100*r.dev).toFixed(2)} % | table g ${e.lsq[0].toFixed(4)} l ${e.lsq[1].toFixed(4)} dev ${(100*e.devLsq).toFixed(2)} % | Lorentzian read ${r.lorRead.toFixed(3)} dev ${(100*r.lorDev).toFixed(1)} %`);
}
fs.writeFileSync(new URL('./results/indep-line.json', import.meta.url), JSON.stringify(out, null, 1));
