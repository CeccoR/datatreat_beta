// stages.mjs dir=label ...: search evaluations by stage, summed over the 77 runs, and iterations a refinement
// (brief: 8 iterations; full: soft, free, 60 (the polish included); exact/refit: exact, free; held; v2's central pass: a kept run's last refinement)
import fs from 'node:fs'; import path from 'node:path'; import { readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = design.rows.filter(r=> r.screen && r.split !== 'validation').map(r=> r.id);
for (const d of process.argv.slice(2)){
  const [dir, lab] = d.split('='), S = {}, add = (k, e)=> { (S[k] ||= { n: 0, ev: 0, it: 0 }); S[k].n++; S[k].ev += e.ev; S[k].it += e.it || 0; };
  for (const id of rows){
    const o = readResult(fs.readFileSync(path.resolve(HERE, dir, id + '.json'), 'utf8')), r = o.records.find(x=> x.method === 'today');
    const v2 = o.mode && o.mode.search === 'v2';
    r.log.forEach((e, i)=> add(v2 && r.kept && i === r.log.length - 1 ? 'central' : e.mi === 8 ? 'brief' : e.soft ? 'full' : e.rot ? 'exact/refit' : 'held', e));
  }
  const tot = Object.values(S).reduce((t, s)=> t + s.ev, 0);
  console.log(`${(lab || dir).padEnd(14)} ${tot} ev: ` + ['brief', 'full', 'exact/refit', 'held', 'central'].filter(k=> S[k]).map(k=> `${k} ${S[k].ev} (${S[k].n}, ${(S[k].it/S[k].n).toFixed(1)} it, ${(S[k].ev/S[k].it).toFixed(1)} ev/it)`).join('; '));
}
