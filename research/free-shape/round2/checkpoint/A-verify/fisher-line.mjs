/* Verifier: how precisely one line's <L>_V can be read, by the line's shape alone (no engine,
   no Track A code). Cramer-Rao bound for <L>_V of one line mu(s) = b + A p(s; Lv), Poisson
   noise, A, Lv and b free (3x3 Fisher matrix), the same area A and background b for both
   lines: (i) the engine's Lorentzian, FWHM 0.675/Lv (the in-model data); (ii) the exact line
   of a solid along a member, 2/Lv * int A(xi) cos(2 pi s Lv xi ...) (Simpson, its own code).
   Prints sigma(Lv)/Lv for each, and the ratio Lorentzian / exact, at several peak-to-background
   ratios r (r = the exact line's peak over b). node fisher-line.mjs */
const NS = 4000;
function exactLine(Afun){             // unit line in x = s*Lv: f(x), area 1, f(0) = 1
  const h = 1/NS; const xi = [], A = [];
  for (let i = 0; i <= NS; i++){ xi.push(i*h); A.push(Math.max(0, Afun(i*h))); }
  const simp = g => { let s = g(0) + g(NS); for (let i = 1; i < NS; i++) s += (i % 2 ? 4 : 2)*g(i); return s*h/3; };
  const T = 2*simp(i=> A[i]);         // <L>_V in units of the support
  // p(s) for Lv = 1: 2 * int_0^1 A(xi) cos(2 pi s xi T') d(xi T') / ... normalise numerically
  const raw = x => 2*simp(i=> A[i]*Math.cos(2*Math.PI*x*xi[i]/T))/T;   // x in units of 1/Lv
  return raw;
}
const ball = x => x >= 1 ? 0 : 1 - 1.5*x + 0.5*x**3;
const edge = x => x >= 1 ? 0 : 1 - x;
const cylAcross = x => { if (x >= 1) return 0; return (2/Math.PI)*(Math.acos(x) - x*Math.sqrt(1 - x*x)); };
const lor = x => { const H = 0.675; return 2/(Math.PI*H)/(1 + 4*(x/H)**2); };
// tabulate each unit line on a fine grid in x, interpolate
const XMAX = 12, DX = 0.002;
function tab(f){ const n = Math.round(XMAX/DX), y = new Float64Array(n + 1); for (let i = 0; i <= n; i++) y[i] = f(i*DX); return x => { x = Math.abs(x); if (x >= XMAX) return 0; const k = Math.floor(x/DX), t = x/DX - k; return y[k]*(1 - t) + y[k + 1]*t; }; }
function crb(f, A, b){
  const S = 8, ds = 0.01, Lv = 1, eps = 1e-4;
  const p = (s, L) => L*f(s*L);
  const F = [[0,0,0],[0,0,0],[0,0,0]];
  for (let s = -S; s <= S + 1e-9; s += ds){
    const mu = b + A*p(s, Lv);
    const g = [p(s, Lv), A*(p(s, Lv*(1 + eps)) - p(s, Lv*(1 - eps)))/(2*eps*Lv), 1];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) F[i][j] += g[i]*g[j]/mu;
  }
  // invert 3x3
  const m = F, det = m[0][0]*(m[1][1]*m[2][2] - m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
  const c11 = (m[0][0]*m[2][2] - m[0][2]*m[2][0])/det;
  return Math.sqrt(c11)/Lv;
}
const lines = { ball: tab(exactLine(ball)), 'box edge / cylinder axis': tab(exactLine(edge)), 'cylinder across': tab(exactLine(cylAcross)) };
const L = tab(lor);
console.log('peak of unit lines: lor', L(0).toFixed(3), Object.entries(lines).map(([k, f])=> k + ' ' + f(0).toFixed(3)).join(', '));
for (const [name, f] of Object.entries(lines)){
  for (const r of [0.3, 1, 3, 10]){
    const b = 1000, A = r*b/f(0);
    const se = crb(f, A, b), sl = crb(L, A, b);
    console.log(`${name.padEnd(26)} r ${String(r).padStart(4)}: sigma(Lv)/Lv exact ${(100*se).toFixed(3)} %, Lorentzian ${(100*sl).toFixed(3)} %, ratio ${(sl/se).toFixed(2)} (variance ${((sl/se)**2).toFixed(2)})`);
  }
}
