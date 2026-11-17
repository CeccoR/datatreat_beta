/* Expected family margins (AB.md §3.6, track A's fix/sepcmp.mjs): noise-free fits to the generator's exact
   pattern, the true solid and each other family's general member; margin = (rival χ² − true solid's χ²) /
   χ²_ν of the row's isotropic fit (track A's xconf3.json, the WPPM runs'), the nearest rival family's per row;
   right (> 3) / within ±3 / wrong (< −3). Track A's lsq and WPPM beside each given run.
   node bench/margins.mjs label=file.json ... [--out file.md] */
import fs from 'node:fs'; import path from 'node:path';
const A = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'A', 'results');
const args = process.argv.slice(2), outI = args.indexOf('--out'), out = outI >= 0 ? args.splice(outI, 2)[1] : null;
const X = JSON.parse(fs.readFileSync(path.join(A, 'xconf3.json'), 'utf8'));
const M = { lsq: JSON.parse(fs.readFileSync(path.join(A, 'shapesep-exact-lsq.json'), 'utf8')), wppm: JSON.parse(fs.readFileSync(path.join(A, 'shapesep-exact-wppm.json'), 'utf8')) };
for (const a of args){ const [k, f] = a.split('='); M[k] = JSON.parse(fs.readFileSync(f, 'utf8')); }
const SC = { lsq: 'lsq' }, scOf = (m, id, c) => { const r = X[SC[m] || 'wppm'].find(o=> o.id === id); return r && r.per[c] ? r.per[c].sc : NaN; };
const FAM = { box: 'box', sqbox: 'box', cylinder: 'cyl', ellcyl: 'cyl', ellipsoid: 'ball', spheroid: 'ball' }, GEN = { box: 'box', cyl: 'ellcyl', ball: 'ellipsoid' };
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
const ids = M.wppm.map(r=> r.id), names = Object.keys(M), L = [];
L.push(`| row | counts | ${names.map(n=> n + ': margin (rival)').join(' | ')} |`, `|---|---|${names.map(()=> '---|').join('')}`);
const per = Object.fromEntries(names.map(n=> [n, []]));
for (const id of ids){
  const cells = names.map(n=> { const r = M[n].find(o=> o.id === id); if (!r) return { x: NaN };
    const own = r.cand[r.solid].chi2, rv = Object.keys(GEN).filter(k=> k !== FAM[r.solid]).map(k=> GEN[k]).map(c=> ({ c, x: (r.cand[c].chi2 - own)/scOf(n, id, c) })).sort((p, q)=> p.x - q.x)[0];
    per[n].push(rv.x); return rv; });
  L.push(`| ${id} | ${M.wppm.find(o=> o.id === id).counts} | ${cells.map(c=> `${f(c.x)} (${c.c})`).join(' | ')} |`);
}
L.push(`| right / within ±3 / wrong | | ${names.map(n=> `${per[n].filter(x=> x > 3).length} / ${per[n].filter(x=> Math.abs(x) <= 3).length} / ${per[n].filter(x=> x < -3).length}`).join(' | ')} |`);
const t = L.join('\n') + '\n'; if (out) fs.writeFileSync(out, t); console.log(t);
