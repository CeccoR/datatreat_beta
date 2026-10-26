// The exact line's shape per solid and direction: FWHM·⟨L⟩_V (a Lorentzian of integral breadth 1 has 0.637, a Gaussian 0.939),
// ⟨L⟩_A/⟨L⟩_V, the lsq table's (g, l) and its Lorentzian share l/(g + l), and the value at x = 1, 2 (tails; Lorentzian 0.675: 0.10, 0.026).
import { ballA, boxA, cylA, reduce } from './profiles.mjs';
import fs from 'node:fs';
const T = JSON.parse(fs.readFileSync(new URL('./tables.json', import.meta.url)));
const cases = [['ball (any direction)', ballA(), T.ball], ['box along an edge', boxA(0, 0), T.box.e[0][0]], ['box, face diagonal', boxA(1, 0), T.box.e[40][0]], ['box, body diagonal', boxA(1, 1), T.box.e[40][40]],
  ['cylinder along the axis', cylA(0), T.cyl.e[0]], ['cylinder at 45° (scaled)', cylA(Math.PI/4), T.cyl.e[90]], ['cylinder across', cylA(Math.PI/2), T.cyl.e[180]]];
for (const [nm, s, e] of cases){
  const r = reduce(s); let lo = 0, hi = 3; for (let i = 0; i < 60; i++){ const m = (lo + hi)/2; if (r.p(m) > 0.5) lo = m; else hi = m; }
  console.log(`| ${nm} | ${(2*lo).toFixed(3)} | ${r.LaV.toFixed(3)} | ${e.lsq[0].toFixed(3)}, ${e.lsq[1].toFixed(3)} | ${(e.lsq[1]/(e.lsq[0] + e.lsq[1])).toFixed(2)} | ${(100*e.devLsq).toFixed(1)} % | ${r.p(1).toFixed(3)} | ${r.p(2).toFixed(4)} |`);
}
