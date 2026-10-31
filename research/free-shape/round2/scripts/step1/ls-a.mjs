// list A's records for a tag: row, class, outcome, search evals, search ms, iso ms, report ms
import fs from 'node:fs'; import path from 'node:path'; import { readResult } from './lib.mjs';
const FS2 = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const tag = process.argv[2], dir = path.join(FS2, 'A', 'results', tag);
const sub = new Set(fs.readFileSync(path.join(FS2, 'A', 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split(/\s+/)[0]));
for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json')).sort()){
  const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8')), r = o.records.find(r=> r.method === 'today');
  const out = r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rej') : 'none';
  console.log(f.replace('.json','').padEnd(26), o.laue.padEnd(6), out.padEnd(6), String(r.search.evals).padStart(6), String(Math.round(r.search.ms/1000)).padStart(5), String(Math.round(o.iso.ms/1000)).padStart(4), r.report ? String(Math.round(r.report.ms/1000)).padStart(4) : '   -', sub.has(f.replace('.json','')) ? 'S' : '', o.records.map(x=>x.method).join(','));
}
