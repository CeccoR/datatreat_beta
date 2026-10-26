/* The final baseline (results/screen-digest.json) against the first one, rescored
   (results/screen-c3-rescored-digest.json), row by row: outcome, Δ (reach against the
   truth reference), the worst extent, the axis. Both digests are report.mjs --json's.
   node compare-c3.mjs [--all] */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), R = path.join(HERE, '..', 'results');
const rd = f => new Map(JSON.parse(fs.readFileSync(path.join(R, f), 'utf8'), (k, v)=> v === 'Infinity' ? Infinity : v).map(d=> [d.id, d]));
const A = rd('screen-c3-rescored-digest.json'), B = rd('screen-digest.json');
const pc = x => x === Infinity ? '+∞' : x == null || !Number.isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
const f = (x, d = 2) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const all = process.argv.includes('--all');
let same = 0, n = 0; const moves = {};
console.log('| run | outcome C3 → D2 | Δ C3 → D2 | worst extent C3 → D2 | axis ° C3 → D2 |\n|---|---|---|---|---|');
for (const [id, b] of B){
  const a = A.get(id); if (!a) continue; n++;
  const k = a.out + ' → ' + b.out; moves[k] = (moves[k] || 0) + 1; if (a.out === b.out) same++;
  const missA = a.delta > 1, missB = b.delta > 1;
  if (all || missA || missB || (a.out === 'early' || a.out === 'rejected') !== (b.out === 'early' || b.out === 'rejected'))
    console.log(`| ${id} | ${a.out} → ${b.out} | ${f(a.delta)} → ${f(b.delta)} | ${pc(a.acc && a.acc.dimMax)} → ${pc(b.acc && b.acc.dimMax)} | ${f(a.acc && a.acc.principal, 1)} → ${f(b.acc && b.acc.principal, 1)} |`);
}
const judged = m => [...m.values()].filter(d=> Number.isFinite(d.delta)), reach = m => judged(m).filter(d=> d.delta <= 1).length;
console.log(`\n${n} rows in both; the same outcome in ${same}. Reach: C3 ${reach(A)}/${judged(A).length}, D2 ${reach(B)}/${judged(B).length}.`);
console.log(Object.entries(moves).sort((p, q)=> q[1] - p[1]).map(([k, v])=> `${k}: ${v}`).join('; '));
