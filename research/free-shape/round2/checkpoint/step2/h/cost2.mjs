// cost2.mjs <rows: sub|screen> <ref label> label=dir ...: CPU of the fit (iso + search + report, out.cpu) per variant,
// its ratio to the reference (ratio of sums; per run median and range), per Laue class, and the evaluations
// (iso + search + report) with the CPU an evaluation. Markdown.
import fs from 'node:fs'; import path from 'node:path'; import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const [sel, ref, ...ds] = process.argv.slice(2);
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = sel === 'sub' ? fs.readFileSync(path.join(FS2, 'A', 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split(/\s+/)[0]) : design.rows.filter(r=> r.screen && r.split !== 'validation').map(r=> r.id);
const V = ds.map(d=> { const [lab, dir] = d.split('='); return { lab, dir: path.resolve(HERE, dir) }; });
const D = {};
for (const v of V){ D[v.lab] = {}; for (const id of rows){ const f = path.join(v.dir, id + '.json'); if (!fs.existsSync(f)) continue; const o = readResult(fs.readFileSync(f, 'utf8')), r = o.records.find(x=> x.method === 'today');
  D[v.lab][id] = { laue: o.laue, cpu: o.cpu.fitMs/1000, ev: o.iso.evals + r.search.evals + (r.report ? r.report.evals : 0) }; } }
const ids = rows.filter(id=> V.every(v=> D[v.lab][id]));
const sum = (lab, xs, k = 'cpu') => xs.reduce((s, id)=> s + D[lab][id][k], 0);
const med = xs => { const s = xs.slice().sort((a, b)=> a - b); return s.length % 2 ? s[s.length >> 1] : (s[s.length/2 - 1] + s[s.length/2])/2; };
const f = (x, d = 2) => x.toFixed(d);
const L = [`${ids.length} runs with every variant. CPU s of the fit (iso + search + report), sums; × ${ref}: ratio of sums (per run median, range); evaluations of the fit; ms CPU an evaluation.`, '', `| variant | CPU s | × ${ref} | evaluations | ms an evaluation |`, '|---|---|---|---|---|'];
for (const v of V){ const rs = ids.map(id=> D[v.lab][id].cpu/D[ref][id].cpu);
  L.push(`| ${v.lab} | ${f(sum(v.lab, ids), 0)} | ${f(sum(v.lab, ids)/sum(ref, ids))} (${f(med(rs))}, ${f(Math.min(...rs))}–${f(Math.max(...rs))}) | ${sum(v.lab, ids, 'ev')} | ${f(1000*sum(v.lab, ids)/sum(v.lab, ids, 'ev'), 1)} |`); }
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
L.push('', `Per Laue class, CPU × ${ref} (ratio of sums; ${ref}'s CPU s a run):`, '', `| class | ${ref} s a run | ${V.filter(v=> v.lab !== ref).map(v=> v.lab).join(' | ')} |`, `|---|---|${V.filter(v=> v.lab !== ref).map(()=> '---|').join('')}`);
for (const l of LAUE){ const xs = ids.filter(id=> D[ref][id].laue === l); if (!xs.length) continue;
  L.push(`| ${l} | ${f(sum(ref, xs)/xs.length, 0)} | ${V.filter(v=> v.lab !== ref).map(v=> f(sum(v.lab, xs)/sum(ref, xs))).join(' | ')} |`); }
console.log(L.join('\n'));
