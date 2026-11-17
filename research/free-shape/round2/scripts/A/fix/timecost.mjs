#!/usr/bin/env node
/* [fix] The cost under one load (fix/time.mjs records): per row and mode, the fit's CPU time (out.cpu:
   isotropic fit + search + report, the main thread and the GC's helpers) and the stages' wall time,
   and the evaluations (isotropic fit + search + report). The modes of a row ran back to back in turn,
   two rows at a time, so their walls share one load. Checked first: every run reproduces the
   reference record's χ² and evaluations (the runs are deterministic). Per Laue class and overall:
   the mean per run, the ratio of sums to lor, and the per-row ratio (median, range). The sub-screen is
   2 rows per class, the screening set 7: the ratio of sums over it is the set's ratio estimated with
   the classes weighted as the set weights them; the set's own minutes are estimated per class as
   7 × the class's mean.
   node fix/timecost.mjs [--tag time] [--out file.md] [--json file.json] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { readResult } = await import('../harness/lib.mjs');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const dir = path.join(HERE, 'results', opt.tag || 'time');
const REF = { lor: path.join(HERE, '..', 'pilot', 'results', 'screen'), lsq: path.join(HERE, 'results', 's-lsq'), wppm: path.join(HERE, 'results', 's-wppm') };
const modes = fs.readdirSync(dir).filter(m=> fs.statSync(path.join(dir, m)).isDirectory());
const ord = ['lor', 'lsq', 'mom', 'wppm', 'ib'].filter(m=> modes.includes(m));
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
const rd = f => readResult(fs.readFileSync(f, 'utf8'));
const R = {}, checks = [];
for (const m of ord){
  for (const f of fs.readdirSync(path.join(dir, m)).filter(f=> f.endsWith('.json'))){
    const o = rd(path.join(dir, m, f)), t = o.records.find(r=> r.method === 'today');
    const e = { id: o.row, laue: o.laue, mode: m, cpu: o.cpu.fitMs/1000, wall: (o.iso.ms + t.search.ms + (t.report ? t.report.ms : 0))/1000,
      ev: o.iso.evals + t.search.evals + (t.report ? t.report.evals : 0), sEv: t.search.evals, chi2: t.chi2, load: [o.cpu.load0, o.cpu.load1] };
    (R[o.row] ||= {})[m] = e;
    if (REF[m] && fs.existsSync(path.join(REF[m], f))){
      const p = rd(path.join(REF[m], f)), q = p.records.find(r=> r.method === 'today');
      const same = q.chi2 === t.chi2 && q.search.evals === t.search.evals && (q.report ? q.report.evals : 0) === (t.report ? t.report.evals : 0) && p.iso.evals === o.iso.evals;
      checks.push({ id: o.row, mode: m, same, refWall: (p.iso.ms + q.search.ms + (q.report ? q.report.ms : 0))/1000 });
    }
  }
}
const ids = Object.keys(R).filter(id=> ord.every(m=> R[id][m]));
const med = xs => { const s = xs.slice().sort((p, q)=> p - q); const i = (s.length - 1)/2; return (s[Math.floor(i)] + s[Math.ceil(i)])/2; };
const sum = xs => xs.reduce((s, x)=> s + x, 0), f = (x, d = 0) => Number.isFinite(x) ? x.toFixed(d) : '—';
const L = [];
const bad = checks.filter(c=> !c.same);
L.push(`Rows timed with every mode: ${ids.length}. Reproduced the reference record (χ², evaluations): ${checks.length - bad.length} of ${checks.length}${bad.length ? ' — differ: ' + bad.map(c=> c.id + ' ' + c.mode).join(', ') : ''}.`, '');
for (const [key, title] of [['cpu', 'CPU s a run (isotropic fit + search + report)'], ['wall', 'wall s a run, same stages, under one load']]){
  L.push(`**${title}**: mean per run; ratio of sums to lor; per-row ratio median (range)`, '', `| class | rows | ${ord.join(' | ')} | ${ord.filter(m=> m !== 'lor').map(m=> m + '/lor').join(' | ')} |`, '|---|---|' + ord.map(()=> '---|').join('') + ord.filter(m=> m !== 'lor').map(()=> '---|').join(''));
  for (const l of [...LAUE, 'all']){
    const g = ids.filter(id=> l === 'all' || R[id].lor.laue === l); if (!g.length) continue;
    const S = m => sum(g.map(id=> R[id][m][key]));
    L.push(`| ${l} | ${g.length} | ${ord.map(m=> f(S(m)/g.length)).join(' | ')} | ${ord.filter(m=> m !== 'lor').map(m=> { const r = g.map(id=> R[id][m][key]/R[id].lor[key]); return `${f(S(m)/S('lor'), 2)} (${f(med(r), 2)}, ${f(Math.min(...r), 2)}–${f(Math.max(...r), 2)})`; }).join(' | ')} |`);
  }
  L.push('');
}
L.push('**Evaluations a run** (isotropic fit + search + report; the search alone): mean', '', `| ${ord.join(' | ')} |`, '|' + ord.map(()=> '---|').join(''), `| ${ord.map(m=> `${f(sum(ids.map(id=> R[id][m].ev))/ids.length)} (${f(sum(ids.map(id=> R[id][m].sEv))/ids.length)})`).join(' | ')} |`, '');
L.push('**CPU per evaluation, ms** (median over rows)', '', `| ${ord.join(' | ')} |`, '|' + ord.map(()=> '---|').join(''), `| ${ord.map(m=> f(med(ids.map(id=> 1000*R[id][m].cpu/R[id][m].ev)), 1)).join(' | ')} |`, '');
const setMin = m => sum(LAUE.map(l=> { const g = ids.filter(id=> R[id].lor.laue === l); return g.length ? 7*sum(g.map(id=> R[id][m].cpu))/g.length : 0; }))/60;
L.push(`The 77-run screening set estimated from these (7 runs a class × the class's mean CPU s): ${ord.map(m=> `${m} ${f(setMin(m))} min`).join(', ')}.`, '');
L.push('Against the records\' own walls (other loads): ' + ord.filter(m=> REF[m]).map(m=> { const c = checks.filter(x=> x.mode === m && ids.includes(x.id)); return `${m} ${f(sum(c.map(x=> x.refWall))/c.length)} s a run then, ${f(sum(c.map(x=> R[x.id][m].wall))/c.length)} s now`; }).join('; ') + '.');
const text = L.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, text);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ R, checks }));
console.log(text);
