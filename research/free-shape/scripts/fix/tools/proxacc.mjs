// Adapted from the review's tool (critic/tools/proxacc.mjs): on the proxies, each full-set search's Δ on the
// write-up's common reference (writer/common.json) against its accuracy. node proxacc.mjs <fs>
import fs from 'node:fs'; import path from 'node:path';
const FS = process.argv[2];
const R = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const cm = R(path.join(FS, 'writer/common.json'));
const SRC = { 'app (baseline)': ['harness/results/baseline', 'baseline'], fwd: ['optimizer/results/f-fwd', 'fwd'], 'c1 = fwd + halving': ['optimizer/results/f-c1', 'c1'], a4: [['starts/results/r3', 'starts/results/r4'], 'a4'], cfam: ['starts/results/r2b', 'cfam'] };
const rows = [];
for (const [lab, [dirs, meth]] of Object.entries(SRC)) {
  for (const x of cm.per[lab]) {
    if (x.kind !== 'sample') continue;
    const [c, s] = x.key.split('#');
    let rec = null;
    for (const d of [].concat(dirs)) { const f = path.join(FS, d, `${c}-${s}.json`); if (fs.existsSync(f)) { const j = R(f); rec = j.records.find(m => m.method === meth) || rec; } }
    if (!rec || !rec.acc) continue;
    const de = rec.acc.dimErr.map(e => Math.abs(e)); 
    rows.push({ lab, key: x.key, delta: x.delta, held: rec.held, maxDim: Math.max(...de), thin: Math.abs(rec.acc.dimErr[rec.acc.dimErr.length - 1]), dimErr: rec.acc.dimErr.map(e => (100 * e).toFixed(0)).join('/'), normal: rec.acc.principal, orient: rec.acc.orient });
  }
}
const keys = [...new Set(rows.map(r => r.key))].sort();
for (const k of keys) {
  console.log(k);
  for (const r of rows.filter(r => r.key === k)) console.log(`  ${r.lab.padEnd(20)} Δ ${r.delta.toFixed(2).padStart(6)} ${r.held ? 'held' : 'free'} dims ${r.dimErr} normal ${r.normal.toFixed(1)} orient ${r.orient.toFixed(1)}`);
}
// Spearman-free summary: for each proxy, does the lowest-Δ search have the smallest normal error / max dim err?
let nN = 0, nD = 0, nK = 0;
for (const k of keys) {
  const rs = rows.filter(r => r.key === k); if (rs.length < 2) continue; nK++;
  const best = rs.reduce((a, b) => a.delta <= b.delta ? a : b);
  if (rs.every(r => r.normal >= best.normal - 0.05)) nN++;
  if (rs.every(r => r.maxDim >= best.maxDim - 0.005)) nD++;
}
console.log(`proxies ${nK}: lowest-Δ search also has the smallest normal error on ${nN}, smallest max dim error on ${nD}`);
