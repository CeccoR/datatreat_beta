/* sum.mjs <tag new> <tag old>: two of the prototype's sub-screen runs side by side (the same
   line, two searches): outcome, reach against track A's lsq truth reference (Δ ≤ 1 χ²_ν, as
   A's analyse.mjs), the returned fit's χ², the solid (an extent by > 5 % or the axis by > 2°
   modulo the class: changed), accuracy (A's rules: worst |extent error|, thinnest, the
   truth's most distinct axis), search evaluations and the fit's CPU. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.join(HERE, '..', 'fs2');
const [tn, to] = process.argv.slice(2);
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = fs.readFileSync(path.join(FS2, 'A', 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split(/\s+/)[0]);
const rd = f => readResult(fs.readFileSync(f, 'utf8'));
const out = r => r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rej') : 'none';
const med = a => { const s = a.filter(x=> !Number.isNaN(x)).sort((x, y)=> x - y); return s.length ? s[Math.floor((s.length - 1)/2)] : NaN; };
const q90 = a => { const s = a.filter(x=> !Number.isNaN(x)).sort((x, y)=> x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9*s.length) - 1)] : NaN; };
const pc = x => Number.isFinite(x) ? (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %' : String(x);
const S = { n: 0, same: 0, reach: [0, 0], ev: [0, 0], cpu: [0, 0], chg: 0, dchi: [], acc: [[], []], changed: [] };
for (const id of rows){
  const N = rd(path.join(HERE, 'results', tn, id + '.json')), O = rd(path.join(HERE, 'results', to, id + '.json'));
  const A = rd(path.join(FS2, 'A', 'results', 's-lsq', id + '.json')), R = A.records.find(r=> r.method === 'truth');
  const row = design.rows.find(r=> r.id === id), ord = [0, 1, 2].sort((p, q)=> row.dims[p] - row.dims[q]);
  const a = N.records[0], b = O.records[0];
  S.n++; if (out(a) === out(b)) S.same++;
  S.ev[0] += a.search.evals; S.ev[1] += b.search.evals; S.cpu[0] += N.cpu.fitMs; S.cpu[1] += O.cpu.fitMs;
  const nu = Math.max(1, b.chi2nu); S.dchi.push((a.chi2 - b.chi2)/nu);
  [a, b].forEach((r, k)=>{
    const best = Math.min(...[r.chi2Best, R.chi2Best].filter(Number.isFinite)), Pb = R.chi2Best === best ? R.P : r.P;
    if (r.kept || (r.rejected && !r.early)){ const d = (r.chi2Best - best)/Math.max(1, best/Math.max(1, N.iso.N - Pb)); if (d <= 1) S.reach[k]++; }
    if (r.kept && r.acc){ const e = ord.map(i=> r.acc.dimErr[i]); S.acc[k].push({ worst: Math.max(...e.map(Math.abs)), thin: e[0], axis: r.acc.principal }); }
  });
  let chg = '';
  if (a.kept && b.kept){
    const c = compareSolids(a.solid, b.solid, { rots: laueRotations(N.phase) });
    if (c.dimErr.some(e=> !(Math.abs(e) <= 0.05)) || (c.orient != null && c.orient > 2)){ S.chg++; chg = `changed (extents ${c.dimErr.map(pc).join(', ')}; ${c.orient == null ? '—' : c.orient.toFixed(1)}°)`; }
  } else if (a.kept !== b.kept) chg = 'kept ≠';
  console.log(id.padEnd(24), `${out(a)}/${out(b)}`.padEnd(10), `ev ${a.search.evals}/${b.search.evals} = ${(a.search.evals/b.search.evals).toFixed(2)}`, `cpu ${(N.cpu.fitMs/1000).toFixed(0)}/${(O.cpu.fitMs/1000).toFixed(0)} s`,
    `Δχ² ${((a.chi2 - b.chi2)/nu).toFixed(2)} χ²_ν`, a.acc ? `worst ${pc(Math.max(...a.acc.dimErr.map(Math.abs)))}/${b.acc ? pc(Math.max(...b.acc.dimErr.map(Math.abs))) : '—'}` : '', chg);
}
const accLine = L => `worst ${pc(med(L.map(x=> x.worst)))} (90 %: ${pc(q90(L.map(x=> x.worst)))}), thinnest ${pc(med(L.map(x=> x.thin)))}, axis ${med(L.map(x=> x.axis)).toFixed(1)}° (90 %: ${q90(L.map(x=> x.axis)).toFixed(1)}°), ${L.length} kept`;
const dc = S.dchi;
console.log(`${S.n} rows: outcome the same on ${S.same}; reach (Δ ≤ 1 against A's lsq truth reference) ${S.reach[0]} against ${S.reach[1]}; solid changed on ${S.chg}; search evaluations ${S.ev[0]} against ${S.ev[1]} (${(S.ev[0]/S.ev[1]).toFixed(3)}×); CPU (iso + search + report) ${(S.cpu[0]/1000).toFixed(0)} s against ${(S.cpu[1]/1000).toFixed(0)} s (${(S.cpu[0]/S.cpu[1]).toFixed(3)}×)`);
console.log(`returned fit's χ² new − old (χ²_ν): within 0.1 on ${dc.filter(x=> Math.abs(x) <= 0.1).length}, lower on ${dc.filter(x=> x < -0.1).length} (${dc.filter(x=> x < -0.1).map(x=> x.toFixed(2)).join(', ')}), higher on ${dc.filter(x=> x > 0.1).length} (${dc.filter(x=> x > 0.1).map(x=> '+' + x.toFixed(2)).join(', ')})`);
console.log(`accuracy, new: ${accLine(S.acc[0])}`);
console.log(`accuracy, old: ${accLine(S.acc[1])}`);
