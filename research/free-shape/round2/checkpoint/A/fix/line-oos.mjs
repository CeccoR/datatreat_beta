/* [fix] lines/line-errors.mjs scored out of sample: the same members (same seed), each line scored
   and read with another sampling than the one lsq's tables were fitted with (X = 6, b = 0.2):
   node fix/line-oos.mjs --n 200 --X 10 --b 0.02 --out results/line-oos-b002.json
   The original's header follows. */
/* The size line as a line: per variant, against the exact line of members drawn like the
   design's (random solids in its ranges, random directions), alone (no instrument): the max
   |Δ| over the peak and what the variant reads, ⟨L⟩_V read/true (its own shape, width free,
   area fixed; weights 1/(p + 0.2), |s| ≤ 6/⟨L⟩_V). The exact line here is this folder's
   reduce(); it is checked first against the generator's own A(L) (gen/kernels.mjs along(),
   transformed here) at the same members. Variants: lor, ib, mom, lsq (tables.json).
   node line-errors.mjs [--n 400] */
import fs from 'node:fs';
import { body, along } from '../../gen/kernels.mjs';
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const SOPT = { X: +(arg('X') || 6), n: Math.round(100*(+(arg('X') || 6))), b: +(arg('b') || 0.2) };
import { ballA, boxA, cylA, reduce, sample, maxDev, readScale, pvGL, nodes } from '../lines/profiles.mjs';
const T = JSON.parse(fs.readFileSync(new URL('../lines/tables.json', import.meta.url), 'utf8'));
const n = +(process.argv[process.argv.indexOf('--n') + 1] || 300);
let s = 12345; const U = ()=> { s = (s*1103515245 + 12345) % 2147483648; return s/2147483648; };
const N = ()=> Math.sqrt(-2*Math.log(U() || 1e-12))*Math.cos(2*Math.PI*U());
const unit = v => { const k = Math.hypot(...v); return v.map(x=> x/k); };
// the variants' (g, l) for a reduced shape, by the same lookup the engine uses (bilinear / linear)
const lookup = (key, kind, r) => {
  if (key === 'lor') return [0, 0.675]; if (key === 'ib') return [0, 2/Math.PI];
  if (kind === 'ball') return T.ball[key];
  if (kind === 'cyl'){ const f = Math.min(179.999999, r.psi*180/Math.PI/0.5), i = Math.floor(f), u = f - i; return [0, 1].map(k=> T.cyl.e[i][key][k]*(1 - u) + T.cyl.e[i + 1][key][k]*u); }
  const fb = Math.min(39.999999, r.beta/0.025), fc = Math.min(39.999999, r.gamma/0.025), i = Math.floor(fb), j = Math.floor(fc), u = fb - i, v = fc - j, B = T.box.e;
  return [0, 1].map(k=> (1 - u)*(1 - v)*B[i][j][key][k] + u*(1 - v)*B[i + 1][j][key][k] + (1 - u)*v*B[i][j + 1][key][k] + u*v*B[i + 1][j + 1][key][k]);
};
const SOL = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const out = {}, check = [];
for (const type of SOL){
  out[type] = { lor: [], ib: [], mom: [], lsq: [] };
  for (let k = 0; k < n; k++){
    // dims like the design's: smallest 2–15 nm, ratios 1–6 (two-extent: 1/6–6)
    const a0 = 20*Math.pow(7.5, U()), r1 = Math.pow(6, U()), r2 = Math.pow(6, U()), rr = Math.pow(6, 2*U() - 1);
    let D = type === 'box' || type === 'ellipsoid' || type === 'ellcyl' ? [a0, a0*r1, a0*r1*r2] : [a0, a0, a0*rr];
    const b = body(type, D, null), m = unit([N(), N(), N()]);
    // the reduced shape along m (body frame = Cartesian: R = I)
    const t = [m[0]/D[0], m[1]/D[1], m[2]/D[2]], tn = Math.hypot(...t);
    let sol, kind;
    if (b.base === 'ball'){ sol = ballA(); kind = 'ball'; }
    else if (b.base === 'cube'){ const s3 = t.map(Math.abs).sort((x, y)=> y - x); sol = boxA(s3[1]/s3[0], s3[2]/s3[0]); kind = 'box'; }
    else { sol = cylA(Math.atan2(Math.hypot(t[0], t[1]), Math.abs(t[2]))); kind = 'cyl'; }
    const red = reduce(sol), S = sample(red, SOPT);
    if (k < 20){
      // the generator's A(L) (Å), transformed here, against reduce()'s line, both in x = s·⟨L⟩_V
      const g = along(b, m), q = nodes(g.T), Ag = q.u.map(g.A); let Lv = 0; q.u.forEach((u, i)=> { Lv += 2*q.w[i]*Ag[i]; });
      let dev = 0; for (const x of [0, 0.3, 0.7, 1.2, 2, 3.5, 5]){ let P = 0; const k2 = 2*Math.PI*x/Lv; q.u.forEach((u, i)=> { P += 2*q.w[i]*Ag[i]*Math.cos(k2*u); }); dev = Math.max(dev, Math.abs(P/Lv - red.p(x))); }
      check.push(dev);
    }
    for (const key of ['lor', 'ib', 'mom', 'lsq']){
      const [gg, ll] = lookup(key, kind, sol), sh = x => pvGL(x, gg, ll);
      out[type][key].push({ dev: maxDev(S, sh), read: readScale(S, sh).read });
    }
  }
}
const q = (xs, p) => { const s2 = xs.slice().sort((a, b)=> a - b); return s2[Math.min(s2.length - 1, Math.floor(p*(s2.length - 1) + 0.5))]; };
console.log(`reduce() against the generator's A(L): max |Δp| ${Math.max(...check).toExponential(1)} over ${check.length} members × 7 points (peak 1)`);
console.log('| solid | ' + ['lor', 'ib', 'mom', 'lsq'].map(k=> k + ': max |Δ| median (90 %); read median (10–90 %)').join(' | ') + ' |');
for (const type of SOL) console.log(`| ${type} | ` + ['lor', 'ib', 'mom', 'lsq'].map(k=> { const d = out[type][k].map(e=> e.dev), r = out[type][k].map(e=> e.read); return `${(100*q(d, 0.5)).toFixed(1)} % (${(100*q(d, 0.9)).toFixed(1)}); ${q(r, 0.5).toFixed(3)} (${q(r, 0.1).toFixed(3)}–${q(r, 0.9).toFixed(3)})`; }).join(' | ') + ' |');
const all = k => SOL.flatMap(t=> out[t][k]);
console.log('| all | ' + ['lor', 'ib', 'mom', 'lsq'].map(k=> { const d = all(k).map(e=> e.dev), r = all(k).map(e=> e.read); return `${(100*q(d, 0.5)).toFixed(1)} % (${(100*q(d, 0.9)).toFixed(1)}); ${q(r, 0.5).toFixed(3)} (${q(r, 0.1).toFixed(3)}–${q(r, 0.9).toFixed(3)})`; }).join(' | ') + ' |');
fs.writeFileSync(arg('out'), JSON.stringify({ n, sample: SOPT, check, out }));
console.log('sampling', JSON.stringify(SOPT));
