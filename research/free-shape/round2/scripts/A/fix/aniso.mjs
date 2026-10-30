#!/usr/bin/env node
/* [fix] The anisotropy (longest/thinnest read ÷ true, extents paired as report.mjs pairs them) scored
   like for like: per Laue class and overall, on the clean rows that every variant kept (today's
   search) and on the truth reference (every row); the median ratio, the median |ln ratio| (the
   typical size of the error either way), and per row; the count of rows outside 0.9–1.1.
   node fix/aniso.mjs results/screen-final-digest.json [--out file.md] */
import fs from 'node:fs';
const a = process.argv.slice(2);
const D = JSON.parse(fs.readFileSync(a[0], 'utf8'));
const num = x => typeof x === 'number' ? x : x === 'Infinity' ? Infinity : x === '-Infinity' ? -Infinity : NaN;
const med = xs => { const s = xs.filter(x=> !Number.isNaN(x)).sort((p, q)=> p - q); if (!s.length) return NaN; const i = (s.length - 1)/2, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : (s[lo] + s[hi])/2; };
const f = (x, d = 2) => x === Infinity ? '∞' : Number.isNaN(x) ? '—' : x.toFixed(d);
const V = [...new Set(D.map(d=> d.v))];
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
const an = t => (1 + num(t[2]))/(1 + num(t[0]));
const T = D.filter(d=> d.solid !== 'sphere' && !d.missing && d.err === 'none');
const ids = [...new Set(T.map(d=> d.id))];
const get = (v, id) => T.find(d=> d.v === v && d.id === id);
const common = ids.filter(id=> V.every(v=> { const d = get(v, id); return d && d.dimT && d.acc; }));
const L = [];
const block = (title, rowsOf, key) => {
  L.push(`**${title}**`, '', `| class | rows | ${V.map(v=> v + ': median ratio, median |ln|').join(' | ')} | per row (${V.join(' / ')}) |`, '|---|---|' + V.map(()=> '---|').join('') + '---|');
  for (const l of [...LAUE, 'all']){
    const g = rowsOf.filter(id=> l === 'all' || get(V[0], id).laue === l);
    if (!g.length) continue;
    const cells = V.map(v=> { const r = g.map(id=> an(get(v, id)[key])); return `${f(med(r))}, ${f(med(r.map(x=> Math.abs(Math.log(x)))))}`; });
    const per = l === 'all' ? '' : g.map(id=> V.map(v=> f(an(get(v, id)[key]))).join('/')).join('; ');
    L.push(`| ${l} | ${g.length} | ${cells.join(' | ')} | ${per} |`);
  }
  for (const v of V){
    const r = rowsOf.map(id=> ({ id, x: an(get(v, id)[key]) })).sort((p, q)=> p.x - q.x), out = r.filter(o=> o.x < 0.9 || o.x > 1.1);
    L.push('', `${v}: range ${f(r[0].x)}–${f(r[r.length - 1].x)}; outside 0.9–1.1: ${out.length} of ${r.length} (${out.map(o=> `${o.id} ${f(o.x)}`).join(', ')})`);
  }
  L.push('');
};
block(`Today's search, clean rows kept by every variant (${common.length} of ${ids.length})`, common, 'dimT');
block(`Truth reference, every clean row (${ids.length})`, ids.filter(id=> V.every(v=> get(v, id) && get(v, id).dimR)), 'dimR');
// each variant's own kept rows (as perclass.mjs), for reference: how many rows each median covers
L.push('**Kept clean rows per variant and class (what perclass.mjs medians cover)**', '', `| class | rows | ${V.join(' | ')} |`, '|---|---|' + V.map(()=> '---|').join(''));
for (const l of LAUE){ const g = ids.filter(id=> get(V[0], id).laue === l); L.push(`| ${l} | ${g.length} | ${V.map(v=> g.filter(id=> { const d = get(v, id); return d && d.dimT && d.acc; }).length).join(' | ')} |`); }
const text = L.join('\n') + '\n';
if (a[1] === '--out') fs.writeFileSync(a[2], text);
console.log(text);
