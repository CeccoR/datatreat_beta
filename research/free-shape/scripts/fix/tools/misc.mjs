// Results-only checks for the review (no pattern evaluated):
//  1. the plate normal's error split by whether the truth's most distinct axis lies on a lattice
//     direction (the baseline's 80 kept synthetic runs; the rand and off8 cases are off-lattice);
//  2. far plausible minima (Δ ≤ 12.55, beyond 25 % or 10° of the reported solid) on all 80 runs,
//     by solid, from the uniqueness study's score (fixed copy);
//  3. the "one size" statement on the synthetic runs the app rejects: the truth's own gain against
//     the isotropic nulls' maximum (uniqueness/results/null.json);
//  4. the solid class ranked first by χ² and by BIC on the proxies (uniqueness/results/classes2.json).
//   node misc.mjs <fs>
import fs from 'node:fs';
import path from 'node:path';
const FS = path.resolve(process.argv[2]);
const R = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const q = (a, p) => { const s = [...a].sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo])*(i - lo); };
const f1 = x => x.toFixed(1);
// 1
const dir = path.join(FS, 'harness/results/baseline'), on = [], off = [];
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const j = R(path.join(dir, fn)); if (j.kind !== 'synth') continue;
  const m = j.records[0]; if (!m.kept || !m.acc) continue;
  (/rand|off8/.test(j.case) ? off : on).push({ run: `${j.case}#${j.seed}`, a: m.acc.principal, held: m.held });
}
console.log(`1. normal error, on-lattice truths: ${on.length} runs (${on.filter(x=> x.held).length} held), median ${f1(q(on.map(x=> x.a), 0.5))}°, p90 ${f1(q(on.map(x=> x.a), 0.9))}°, max ${f1(Math.max(...on.map(x=> x.a)))}°; off-lattice (rand, off8): ${off.length} runs (${off.filter(x=> x.held).length} held), median ${f1(q(off.map(x=> x.a), 0.5))}°, p90 ${f1(q(off.map(x=> x.a), 0.9))}°, max ${f1(Math.max(...off.map(x=> x.a)))}°; all ${on.length + off.length}: median ${f1(q([...on, ...off].map(x=> x.a), 0.5))}°, p90 ${f1(q([...on, ...off].map(x=> x.a), 0.9))}°`);
// 2
const pF = D => { const z = -D/Math.sqrt(4*D + 8); const t = 1/(1 + 0.2316419*Math.abs(z)), d = 0.3989423*Math.exp(-z*z/2); const p = d*t*(0.3193815 + t*(-0.3565638 + t*(1.781478 + t*(-1.821256 + t*1.330274)))); return z > 0 ? 1 - p : p; };
const sc = R(path.join(FS, 'fix/fixed/uniqueness/results/score10/score.json')).filter(r=> r.iv && r.kind === 'synth');
const bySolid = {}, runs = new Set(), list = [];
for (const r of sc) for (const o of r.others){ if (!(pF(o.D) >= 0.05 && (o.maxRatio > Math.log(1.25) || o.worst > 10))) continue; bySolid[r.type] = (bySolid[r.type] || 0) + 1; runs.add(r.run); list.push(`${r.run} Δ ${o.D.toFixed(2)} ${(100*(Math.exp(o.maxRatio) - 1)).toFixed(0)} % ${f1(o.worst)}°`); }
console.log(`2. far plausible minima on ${sc.length} synthetic runs: ${list.length} in ${runs.size} runs; by solid ${JSON.stringify(bySolid)}`); list.forEach(s=> console.log('   ' + s));
// 3
const nu = R(path.join(FS, 'uniqueness/results/null.json'));
const nmax = { box: nu.body.box.max, cylinder: nu.body.cylinder.max };
console.log(`3. null maxima: box ${f1(nmax.box)}, cylinder ${f1(nmax.cylinder)}; rejected anisotropic truths (synthetic): ${nu.alt.length}`);
for (const a of nu.alt){ const lim = ['spheroid', 'cylinder', 'sqbox'].includes(a.shape) ? nmax.cylinder : nmax.box; console.log(`   ${a.run} ${a.shape} search gain ${Number.isFinite(a.G) ? f1(a.G) : '—'} truth gain ${Number.isFinite(a.Gtruth) ? f1(a.Gtruth) : '—'} ${a.Gtruth > lim ? 'above every null of its width count' : ''}`); }
// 4
try {
  const c2 = R(path.join(FS, 'uniqueness/results/classes2.json'));
  const rows = (c2.rows || c2).filter(x=> /^u\d/.test(x.run || ''));
  const byChi = {}, byBic = {};
  for (const x of rows){ const k1 = x.firstChi || x.bestChi, k2 = x.firstBic || x.bestBic; if (k1) byChi[k1] = (byChi[k1] || 0) + 1; if (k2) byBic[k2] = (byBic[k2] || 0) + 1; }
  console.log(`4. proxies (${rows.length}): first by χ² ${JSON.stringify(byChi)}, by BIC ${JSON.stringify(byBic)}`);
} catch(e){ console.log('4. classes2.json:', e.message); }
