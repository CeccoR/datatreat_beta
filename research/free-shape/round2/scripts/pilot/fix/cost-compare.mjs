/* The cost of a run at the first decision (C3, results/screen-c3) against the final one (D2,
   results/screen), on the rows both hold: iso + search + report wall time, evaluations, ms
   per evaluation of the search, members in range. node cost-compare.mjs [--rows a,b] */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), rows = a.includes('--rows') ? a[a.indexOf('--rows') + 1].split(',') : null;
const load = tag => { const d = path.join(HERE, '..', 'results', tag), m = new Map(); for (const f of fs.readdirSync(d).filter(f=> f.endsWith('.json'))){ const o = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (o.records) m.set(o.row, o); } return m; };
const C3 = load('screen-c3'), D2 = load('screen');
const one = o => { const T = o.records.find(r=> r.method === 'today'), R = o.records.find(r=> r.method === 'truth');
  return { s: ((o.iso ? o.iso.ms : 0) + T.search.ms + (T.report ? T.report.ms : 0))/1000, ev: (o.iso ? o.iso.evals : 0) + T.search.evals + (T.report ? T.report.evals : 0), msEv: T.search.ms/Math.max(1, T.search.evals), mem: o.draw.info.nMembers, wall: o.wall/1000, ref: R ? R.ms/1000 : 0, laue: o.laue }; };
const ids = [...D2.keys()].filter(id=> C3.has(id) && (!rows || rows.includes(id))).sort((p, q)=> D2.get(p).laue < D2.get(q).laue ? -1 : 1);
let sc = 0, sd = 0, ec = 0, ed = 0, wc = 0, wd = 0;
console.log('| run | class | members C3 → D2 | ms/ev C3 → D2 | evals C3 → D2 | run s C3 → D2 |\n|---|---|---|---|---|---|');
for (const id of ids){ const c = one(C3.get(id)), d = one(D2.get(id)); sc += c.s; sd += d.s; ec += c.ev; ed += d.ev; wc += c.wall; wd += d.wall;
  console.log(`| ${id} | ${d.laue} | ${c.mem} → ${d.mem} | ${c.msEv.toFixed(1)} → ${d.msEv.toFixed(1)} | ${c.ev} → ${d.ev} | ${c.s.toFixed(0)} → ${d.s.toFixed(0)} |`); }
const n = ids.length;
console.log(`\n${n} runs: mean iso+search+report ${(sc/n).toFixed(1)} s (C3) → ${(sd/n).toFixed(1)} s (D2); evaluations ${(ec/n).toFixed(0)} → ${(ed/n).toFixed(0)}; whole run with the truth reference and drawing ${(wc/n).toFixed(1)} → ${(wd/n).toFixed(1)} s`);
