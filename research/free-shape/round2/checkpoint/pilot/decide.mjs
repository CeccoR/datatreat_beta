#!/usr/bin/env node
/* The pilot's cost decision, from numbers: each class's run (results/cost: isotropic fit,
   today's search and report, one clean truth per class, 3 processes) scaled by the
   per-evaluation cost ratios that costgrid.mjs measured (results/costgrid/costgrid-*.json: a variant's ms
   per evaluation over the 10–130°/0.01°, scale-1 one's, for the shaped model and the
   isotropic one, in one row of each profiled class). A class not profiled takes the median
   ratio of the profiled classes with no stretched list (m−3, 4/mmm, 6/mmm). The evaluations
   are taken as unchanged. Prints the predicted mean over the 11 classes per configuration,
   against the budget: 77 runs in about 1 h on 3 processes, 140 s a run.
   node decide.mjs [--budget 140] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), budget = +(a.includes('--budget') ? a[a.indexOf('--budget') + 1] : 140);
const runs = fs.readdirSync(path.join(HERE, 'results', 'cost')).filter(f=> f.endsWith('.json')).map(f=> JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'cost', f), 'utf8')));
const prof = fs.readdirSync(path.join(HERE, 'results', 'costgrid')).filter(f=> /^costgrid-.*\.json$/.test(f)).flatMap(f=> JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'costgrid', f), 'utf8')));
const key = (s, g) => `${s}|${g.lo}-${g.hi}/${g.step}`;
const ratio = {};          // laue → key → { shape, iso }
for (const p of prof){
  const b = prof.find(q=> q.row === p.row && q.scale === 1 && q.grid.hi === 130 && q.grid.step === 0.01);
  (ratio[p.laue] ||= {})[key(p.scale, p.grid)] = { shape: p.shape.msEv/b.shape.msEv, iso: p.iso.msEv/b.iso.msEv, inRange: p.inRange };
}
const med = xs => { const s = xs.filter(Number.isFinite).sort((x, y)=> x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m])/2; };
const plain = ['m-3', '4/mmm', '6/mmm'];
const r = (laue, k) => ratio[laue] && ratio[laue][k] ? ratio[laue][k] : { shape: med(plain.map(l=> ratio[l] && ratio[l][k] ? ratio[l][k].shape : NaN)), iso: med(plain.map(l=> ratio[l] && ratio[l][k] ? ratio[l][k].iso : NaN)), est: true };
const configs = [
  { name: 'C0 as drawn: cells as they are, 10–130°/0.01°', cell: ()=> 1, g: { lo: 10, hi: 130, step: 0.01 } },
  { name: 'C1 the three costliest cells × 0.8 (P−1, P2/m, Pmmm), 10–130°/0.01°', cell: l=> ['-1', '2/m', 'mmm'].includes(l) ? 0.8 : 1, g: { lo: 10, hi: 130, step: 0.01 } },
  { name: 'C2 C1, 10–110°/0.01°', cell: l=> ['-1', '2/m', 'mmm'].includes(l) ? 0.8 : 1, g: { lo: 10, hi: 110, step: 0.01 } },
  { name: 'C3 C1, 10–100°/0.01°', cell: l=> ['-1', '2/m', 'mmm'].includes(l) ? 0.8 : 1, g: { lo: 10, hi: 100, step: 0.01 } },
  { name: 'C4 C1, 10–110°/0.02°', cell: l=> ['-1', '2/m', 'mmm'].includes(l) ? 0.8 : 1, g: { lo: 10, hi: 110, step: 0.02 } },
  { name: 'D1 every cell × 0.8, 10–130°/0.01°', cell: ()=> 0.8, g: { lo: 10, hi: 130, step: 0.01 } },
  { name: 'D2 every cell × 0.8, 10–110°/0.01°', cell: ()=> 0.8, g: { lo: 10, hi: 110, step: 0.01 } },
];
const out = [];
for (const c of configs){
  const rows = runs.map(o=> {
    const T = o.records.find(x=> x.method === 'today'), k = key(c.cell(o.laue), c.g), q = r(o.laue, k);
    const iso = o.iso.ms/1000, sr = (T.search.ms + (T.report ? T.report.ms : 0))/1000;
    return { laue: o.laue, row: o.row, t: iso*q.iso + sr*q.shape, est: !!q.est, inRange: q.inRange };
  });
  const mean = rows.reduce((t, x)=> t + x.t, 0)/rows.length;
  out.push({ name: c.name, mean, rows });
  console.log(`${c.name}: mean ${mean.toFixed(0)} s (${mean <= budget ? 'within' : 'over'} ${budget} s) — ` + rows.sort((x, y)=> x.laue < y.laue ? -1 : 1).map(x=> `${x.laue} ${x.t.toFixed(0)}${x.est ? '*' : ''}`).join(', '));
}
fs.writeFileSync(path.join(HERE, 'results', 'costgrid', 'decide.json'), JSON.stringify({ budget, ratio, out }, null, 1));
