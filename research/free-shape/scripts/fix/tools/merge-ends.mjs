// What merging by resolution does to the near-equivalent count, apart from the uniqueness
// analysis' cap (uniq-core: at most maxExtra = 4 ends refined a run besides the converged ones it
// meets first). Results only.
//  - backlog's grouping (harness ends.mjs: 8°, e^0.25, on every end of the app's search): groups
//    within Δ 10 of the best, the best's own group excluded ("others");
//  - every end of the same search within Δ 10, unrefined, tested against the refined minima of the
//    uniqueness record with the same rule (each paired extent within max(0.1, 3σ) in ln, each axis
//    within max(5°, 3σ), σ the minimum's own esds, modulo m-3m and the body's symmetry): the ends
//    the minima represent, and the rest grouped among themselves at the rule's floors (0.1, 5°):
//    the most that the cap can have hidden;
//  - the uniqueness study's refined minima within Δ 10 other than the best (plaus.mjs's count).
//   node merge-ends.mjs <fs>
import fs from 'node:fs';
import path from 'node:path';
import { align } from '../../uniqueness/ulib.mjs';
const FS = path.resolve(process.argv[2]);
const R = f => JSON.parse(fs.readFileSync(f, 'utf8'), (k, v)=> k === 'dims' && Array.isArray(v) ? v.map(d=> d == null ? Infinity : d) : v);
const repBy = (s, m) => { const a = align(s, m.solid); return a.per.every((p, i)=> {
  const sl = Number.isFinite(m.sLogW && m.sLogW[i]) ? m.sLogW[i] : 0, okD = !Number.isFinite(p.ratio) || Math.abs(Math.log(p.ratio)) <= Math.max(0.1, 3*sl) || (!Number.isFinite(s.dims[p.fi]) && !Number.isFinite(m.solid.dims[i]));
  const st = Number.isFinite(m.sTilt && m.sTilt[i]) ? m.sTilt[i] : 0, okA = p.angle == null || p.angle <= Math.max(5, 3*st);
  return okD && okA; }); };
const ends = R(path.join(FS, 'harness/results/baseline/ends.json'));
const dir = path.join(FS, 'uniqueness/results/main');
let usedOthers = 0, nRuns = 0, backOthers = 0, nEnds = 0, nRep = 0, nUnrep = 0, nUnrepBrief = 0, groups = 0, refined = 0, runsUnrep = 0;
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){
  const j = R(path.join(dir, fn)); if (j.kind !== 'synth') continue;
  const m = j.records[0]; if (!m.kept) continue;
  const u = m.info.uniq; if (!u || !u.minima) continue;
  nRuns++;
  const key = `${j.case}#${j.seed}`;
  const e = ends.find(x=> `${x.case}#${x.seed}` === key);
  if (e && Number.isFinite(e.near)) backOthers += e.near - 1;
  const c0 = u.minima[0].chi, nu0 = u.nu0;
  // the app's search's own ends (the extra lattice starts of the analysis left out, as the backlog's grouping has none)
  const near = u.ends.filter(x=> x.src !== 'extra' && (x.chi - c0)/nu0 <= 10 && x.solid && x.solid.dims);
  const mins = u.minima.filter(x=> (x.chi - c0)/nu0 <= 30);
  refined += u.minima.filter(x=> x !== u.minima[0] && (x.chi - c0)/nu0 <= 10).length;
  const un = [];
  const used = new Set();
  for (const x of near){ nEnds++; const k = mins.findIndex(mm=> repBy(x.solid, mm)); if (k >= 0){ nRep++; if (mins[k] !== u.minima[0]) used.add(k); } else { nUnrep++; if (x.src === 'brief') nUnrepBrief++; un.push(x); } }
  usedOthers += used.size;
  const G = [];
  for (const x of un){ if (!G.some(g=> repBy(x.solid, { solid: g }))) G.push(x.solid); }
  groups += G.length; if (G.length) runsUnrep++;
}
console.log(`${nRuns} kept synthetic runs`);
console.log(`backlog grouping (8°, e^0.25): others within Δ 10: ${backOthers}`);
console.log(`ends within Δ 10 of the best: ${nEnds}; represented by a refined minimum (merged by resolution): ${nRep}; not represented: ${nUnrep} (${nUnrepBrief} brief), forming ${groups} groups at the rule's floors in ${runsUnrep} runs`);
console.log(`refined minima within Δ 10 other than the best: ${refined}; refined minima other than the best that represent at least one of the search's ends within Δ 10: ${usedOthers}`);
