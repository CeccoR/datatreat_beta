#!/usr/bin/env node
/* node summary.mjs --tag <name> [--method baseline] [--ref truth]
   One line per run of results/<tag>/ and the means per Laue class and per solid: the
   search's pattern evaluations and seconds, the outcome (held, free, rejected, early), Δ
   (the method's best exact χ² against the lowest any method of the run reached, over
   max(1, χ²_ν)), and its accuracy against the truth (the worst dimension's relative error,
   the orientation's worst axis modulo the class and modulo the holohedry). Writes
   results/<tag>/summary.md. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, HERE } from './lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag){ console.error('--tag <name>'); process.exit(2); }
const dir = path.join(HERE, 'results', opt.tag), method = opt.method || 'baseline';
const runs = fs.readdirSync(dir).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(dir, f), 'utf8')));
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const rows = [];
for (const o of runs){
  const r = o.records.find(r=> r.method === method); if (!r) continue;
  const best = Math.min(...o.records.map(x=> x.chi2Best).filter(Number.isFinite));
  const nu = Math.max(1, r.chi2nu || 1);
  rows.push({ id: o.row, laue: o.laue, solid: o.truthType, shape: o.shape, evals: r.evals, s: r.ms/1000, isoEvals: o.iso && o.iso.evals, isoS: o.iso && o.iso.ms/1000,
    out: r.error ? 'error' : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rejected') : 'none',
    delta: Number.isFinite(r.chi2Best) ? (r.chi2Best - best)/nu : null, dim: r.acc ? r.acc.dimMax : null, orient: r.acc ? r.acc.orient : null, holo: r.acc ? r.acc.orientHolo : null });
}
const lines = [`# ${opt.tag}: ${method} (${rows.length} runs)`, '', '| row | class | solid | searched | evals | s | iso evals | iso s | outcome | Δ | worst dim | orient ° | holohedry ° |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows.sort((x, y)=> x.id < y.id ? -1 : 1)) lines.push(`| ${r.id} | ${r.laue} | ${r.solid} | ${r.shape} | ${r.evals} | ${f(r.s)} | ${r.isoEvals} | ${f(r.isoS)} | ${r.out} | ${f(r.delta, 2)} | ${r.dim == null ? '—' : f(100*r.dim, 0) + ' %'} | ${f(r.orient)} | ${f(r.holo)} |`);
const group = (key, title) => {
  const ks = [...new Set(rows.map(r=> r[key]))];
  lines.push('', `| ${title} | runs | evals | s | iso s | held | free | rejected (early) |`, '|---|---|---|---|---|---|---|---|');
  for (const k of ks){ const g = rows.filter(r=> r[key] === k), m = x => g.reduce((t, r)=> t + (r[x] || 0), 0)/g.length;
    lines.push(`| ${k} | ${g.length} | ${f(m('evals'), 0)} | ${f(m('s'))} | ${f(m('isoS'))} | ${g.filter(r=> r.out === 'held').length} | ${g.filter(r=> r.out === 'free').length} | ${g.filter(r=> r.out === 'rejected' || r.out === 'early').length} (${g.filter(r=> r.out === 'early').length}) |`); }
};
group('laue', 'class'); group('solid', 'solid');
fs.writeFileSync(path.join(dir, 'summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
