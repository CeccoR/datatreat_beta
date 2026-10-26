// Hold-out of the null threshold (§5.5): the app's search on isotropic truths at fresh seeds 24–46
// (fix/root6/harness/results/null), the gain G over the isotropic size read as uniqueness/null.mjs
// reads it (the early route's ΔBIC = dPmin ln N − G), against the thresholds proposed from seeds 1–23
// (about 8 χ²_ν for three widths, 6.5 for two) and the first nulls' maxima (7.6, 6.1).
//   node null-hold.mjs <fs>
import fs from 'node:fs';
import path from 'node:path';
const FS = path.resolve(process.argv[2]);
const R = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const lnN = Math.log(5384), nW = { box: 3, cylinder: 2 }, TH = { box: 8, cylinder: 6.5 };
const old = R(path.join(FS, 'uniqueness/results/null.json'));
const dir = path.join(FS, 'fix/root6/harness/results/null');
const G = { box: [], cylinder: [] };
let kept = 0, late = 0;
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const j = R(path.join(dir, fn)), m = j.records[0];
  if (m.kept){ kept++; continue; }
  if (!m.early){ late++; continue; }
  G[j.shape].push((nW[j.shape] - 1)*lnN - m.dBIC);
}
const q = (a, p) => { const s = [...a].sort((x, y)=> x - y); const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo])*(i - lo); };
for (const b of ['box', 'cylinder']){
  const g = G[b], all = [...g, ...old.body[b].G];
  console.log(`${b}: ${g.length} fresh nulls, gain median ${q(g, 0.5).toFixed(1)}, 95th ${q(g, 0.95).toFixed(1)}, max ${Math.max(...g).toFixed(1)}; above the proposed ${TH[b]}: ${g.filter(x=> x > TH[b]).length}; above the first nulls' max ${old.body[b].max.toFixed(1)}: ${g.filter(x=> x > old.body[b].max).length}. All ${all.length}: 99th ${q(all, 0.99).toFixed(1)}, max ${Math.max(...all).toFixed(1)}`);
}
console.log(`kept by the app: ${kept}; rejected after a full search: ${late}`);
