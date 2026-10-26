// The bootstrap under misfit (fix/u-bootmis.mjs): replicas drawn from the proxies' generator (truth +
// hump, fresh Poisson), every minimum refitted on each. Per competitor j of the data's best (0): Δ on
// the data (both refitted as on the replicas, in χ²_ν of the best), and the share of replicas on which
// j wins (a flip), against Φ(−Δ/√(4Δ + 8)), the fitted-model bootstrap's prediction (§5.3). Then
// accuracy: on each replica, is the winner the minimum closest to the truth (largest dimension error;
// the normal's angle)? Results only.
//   node bootmis-sum.mjs <dir of records> [--md out.md]
import fs from 'node:fs';
import path from 'node:path';
const D = path.resolve(process.argv[2]);
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const R = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const Phi = z => { const t = 1/(1 + 0.2316419*Math.abs(z)), d = 0.3989423*Math.exp(-z*z/2); const p = d*t*(0.3193815 + t*(-0.3565638 + t*(1.781478 + t*(-1.821256 + t*1.330274)))); return z > 0 ? 1 - p : p; };
const pF = d => Phi(-d/Math.sqrt(4*Math.max(d, 0) + 8));
const pairs = [], acc = { reps: 0, winBest: 0, winMostAcc: 0, bestMostAcc: 0, winNormal: 0, n0: 0, runs: 0, cost: 0, ms: 0 };
const rows = [];
for (const fn of fs.readdirSync(D).filter(f=> f.endsWith('.json')).sort()){
  const j = R(path.join(D, fn)), m = j.records[0], b = m.info && m.info.bootmis; if (!b || !b.data) continue;
  acc.runs++; acc.cost += b.evals; acc.ms += b.ms;
  const nu = Math.max(1, b.data[0].chi2nu), c0 = b.data[0].chi;
  const dD = b.data.map(x=> x ? (x.chi - c0)/nu : NaN);
  const wins = b.data.map(()=> 0);
  for (const rep of b.reps){
    const ok = rep.map(x=> x && Number.isFinite(x.chi));
    if (!ok[0]) continue;
    acc.reps++;
    let w = 0; rep.forEach((x, i)=> { if (ok[i] && x.chi < rep[w].chi) w = i; });
    wins[w]++;
    if (w === 0) acc.winBest++;
    const err = rep.map((x, i)=> ok[i] ? x.acc.dimMax : Infinity), nerr = rep.map((x, i)=> ok[i] ? x.acc.principal : Infinity);
    const most = err.indexOf(Math.min(...err));
    if (err[w] <= err[most] + 1e-9) acc.winMostAcc++;
    if (err[0] <= err[most] + 1e-9) acc.bestMostAcc++;
    if (nerr[w] <= Math.min(...nerr) + 1e-6) acc.winNormal++;
    for (let i = 1; i < rep.length; i++) if (ok[i]) pairs.push({ run: j.case, j: i, D: dD[i], flip: rep[i].chi < rep[0].chi ? 1 : 0, Drep: (rep[i].chi - rep[0].chi)/Math.max(1, rep[0].chi2nu) });
  }
  rows.push(`| ${j.case} | ${b.data.length} | ${dD.slice(1).map(x=> x.toFixed(1)).join(', ')} | ${wins.join(' / ')} | ${b.data.map(x=> x ? `${(100*x.acc.dimMax).toFixed(0)} %, ${x.acc.principal.toFixed(1)}°` : '—').join('; ')} |`);
}
const bins = [[-Infinity, 0], [0, 1], [1, 3], [3, 6], [6, 12.5], [12.5, Infinity]];
const L = [`Replicas from the generator (truth + hump, fresh Poisson): ${acc.runs} proxies, ${acc.reps} replicas, ${pairs.length} competitor-replica pairs; ${acc.cost} evaluations, ${(acc.ms/1000).toFixed(0)} s.`, '',
  '| Δ on the data (bin) | pairs | flips observed | predicted by the fitted-model calibration |', '|---|---|---|---|'];
for (const [lo, hi] of bins){
  const P = pairs.filter(p=> p.D > lo && p.D <= hi); if (!P.length) continue;
  L.push(`| ${lo === -Infinity ? '≤ 0' : `${lo}–${hi === Infinity ? '∞' : hi}`} | ${P.length} | ${(P.reduce((t, p)=> t + p.flip, 0)/P.length).toFixed(2)} | ${(P.reduce((t, p)=> t + pF(p.D), 0)/P.length).toFixed(2)} |`);
}
L.push('', `The data's best wins on ${acc.winBest} of ${acc.reps} replicas. The replica's winner is also the minimum with the smallest largest-dimension error on ${acc.winMostAcc} of ${acc.reps}, and the smallest normal error on ${acc.winNormal}; the data's best is the most accurate minimum on ${acc.bestMostAcc} of ${acc.reps}.`, '',
  '| proxy | minima | Δ of the others on the data | wins over the replicas (best / others) | each minimum against the truth: largest dimension error, normal |', '|---|---|---|---|---|', ...rows);
const md = L.join('\n');
console.log(md);
if (arg('--md')) fs.writeFileSync(arg('--md'), md + '\n');
