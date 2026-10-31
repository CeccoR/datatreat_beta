// cost.mjs <rows: sub|screen> dir=label ...: sums of CPU (out.cpu, iso + search + report), the search's wall and evaluations, the report's and the iso fit's walls
import fs from 'node:fs'; import path from 'node:path'; import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const [sel, ...ds] = process.argv.slice(2);
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = sel === 'sub' ? fs.readFileSync(path.join(FS2, 'A', 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split(/\s+/)[0]) : design.rows.filter(r=> r.screen && r.split !== 'validation').map(r=> r.id);
for (const d of ds){
  const [dir, lab] = d.split('=');
  let cpu = 0, sw = 0, ev = 0, rw = 0, iw = 0, n = 0, hasCpu = true;
  for (const id of rows){
    const f = path.resolve(HERE, dir, id + '.json'); if (!fs.existsSync(f)) continue;
    const o = readResult(fs.readFileSync(f, 'utf8')), r = o.records.find(x=> x.method === 'today');
    n++; if (o.cpu) cpu += o.cpu.fitMs; else hasCpu = false; sw += r.search.ms; ev += r.search.evals; rw += r.report ? r.report.ms : 0; iw += o.iso.ms;
  }
  console.log(`${(lab || dir).padEnd(10)} ${sel} ${n} runs: CPU ${hasCpu ? (cpu/1000).toFixed(0) : '—'} s; walls: search ${(sw/1000).toFixed(0)}, report ${(rw/1000).toFixed(0)}, iso ${(iw/1000).toFixed(0)} s; search evaluations ${ev}`);
}
