#!/usr/bin/env node
/* Per Laue class, per variant, from analyse.mjs --json digests: the anisotropy (longest/thinnest
   read ÷ true, extents paired as report.mjs pairs them, median) and the truth's most distinct
   axis (°, median), for the truth reference and for today's search (kept solids), on the clean
   rows and on all rows; and the same over clean and error rows with the extents' errors.
   node perclass.mjs results/screen-final-digest.json [> file.md] */
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : x === '-Infinity' ? -Infinity : NaN;
const qtl = (xs, p) => { const s = xs.filter(x=> !Number.isNaN(x)).sort((a, b)=> a - b); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? s[hi] : s[lo] + (s[hi] - s[lo])*(i - lo); };
const f = (x, d = 2) => x === Infinity ? '∞' : Number.isNaN(x) ? '—' : x.toFixed(d);
const pc = x => x === Infinity ? '+∞' : Number.isNaN(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
const V = [...new Set(D.map(d=> d.v))];
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
const an = t => (1 + num(t[2]))/(1 + num(t[0]));
const T = D.filter(d=> d.solid !== 'sphere' && !d.missing);
for (const [nm, sel] of [['clean rows', d=> d.err === 'none'], ['all rows', d=> true]]){
  console.log(`\n**Per Laue class, ${nm}: anisotropy read ÷ true / axis ° (medians); truth reference | today's search (kept)**\n`);
  console.log(`| class | runs | ${V.map(v=> v + ' ref').join(' | ')} | ${V.map(v=> v + ' search').join(' | ')} |`);
  console.log('|---|---|' + V.map(()=> '---|').join('') + V.map(()=> '---|').join(''));
  for (const l of [...LAUE, 'all']){
    const g = v => T.filter(d=> d.v === v && (l === 'all' || d.laue === l) && sel(d));
    const ref = V.map(v=> { const h = g(v).filter(d=> d.dimR); return `${f(qtl(h.map(d=> an(d.dimR)), 0.5))} / ${f(qtl(h.map(d=> num(d.ref.acc.principal)), 0.5), 1)}`; });
    const sea = V.map(v=> { const h = g(v).filter(d=> d.dimT && d.acc); return `${f(qtl(h.map(d=> an(d.dimT)), 0.5))} / ${f(qtl(h.map(d=> num(d.acc.principal)), 0.5), 1)} (${h.length}/${g(v).length})`; });
    console.log(`| ${l} | ${g(V[0]).length} | ${ref.join(' | ')} | ${sea.join(' | ')} |`);
  }
}
console.log('\n**Extents, clean and error rows: thinnest, middle, longest (median, 10–90 %), axis ° (median, 90 %), anisotropy read ÷ true (median, 10–90 %)**\n');
console.log('| variant | what | rows | n | thinnest | middle | longest | axis ° | anisotropy |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const v of V) for (const [what, key, ok] of [['truth reference', 'dimR', d=> d.dimR && d.ref && d.ref.acc], ['search (kept)', 'dimT', d=> d.dimT && d.acc]]) for (const [nm, sel] of [['clean', d=> d.err === 'none'], ['error', d=> d.err !== 'none']]){
  const g = T.filter(d=> d.v === v && sel(d) && ok(d));
  const col = j => g.map(d=> num(d[key][j])), r3 = xs => `${pc(qtl(xs, 0.5))} (${pc(qtl(xs, 0.1))}…${pc(qtl(xs, 0.9))})`;
  const ax = g.map(d=> num((key === 'dimR' ? d.ref.acc : d.acc).principal)), a = g.map(d=> an(d[key]));
  console.log(`| ${v} | ${what} | ${nm} | ${g.length} | ${r3(col(0))} | ${r3(col(1))} | ${r3(col(2))} | ${f(qtl(ax, 0.5), 1)} (${f(qtl(ax, 0.9), 1)}) | ${f(qtl(a, 0.5))} (${f(qtl(a, 0.1))}…${f(qtl(a, 0.9))}) |`);
}
