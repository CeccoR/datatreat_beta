// Evaluations of today's search by stage, per Laue class, from the pilot's screen records.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2] || '../pilot/results/screen', meth = process.argv[3] || 'today';
const files = fs.readdirSync(dir).filter(f=> f.endsWith('.json'));
const by = {}, tot = {};
const stageOf = (lg) => { // label each refine of the search
  const out = []; let nFull = 0, seenExact = false, seenHeld = false;
  for (const e of lg){
    if (e.mi === 8) out.push('brief');
    else if (e.soft && e.rot) out.push(nFull++ < 3 ? 'full' : 'polish');
    else if (!e.soft && e.rot && !seenHeld){ out.push('exact'); seenExact = true; }
    else if (!e.rot){ out.push('held'); seenHeld = true; }
    else out.push('refit');
  }
  return out;
};
const cnt = {};
for (const f of files){
  const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = o.records.find(r=> r.method === meth); if (!r) continue;
  const st = stageOf(r.log), L = o.laue;
  by[L] = by[L] || { n: 0 }; by[L].n++;
  r.log.forEach((e, i)=> { const s = st[i]; by[L][s] = (by[L][s] || 0) + e.ev; tot[s] = (tot[s] || 0) + e.ev; cnt[s] = (cnt[s] || 0) + 1; });
  const other = r.search.evals - r.log.reduce((t, e)=> t + e.ev, 0);
  by[L].other = (by[L].other || 0) + other; tot.other = (tot.other || 0) + other;
}
const S = ['brief', 'full', 'polish', 'exact', 'held', 'refit', 'other'];
console.log('class n ' + S.join(' '));
for (const [L, b] of Object.entries(by)) console.log(L, b.n, S.map(s=> Math.round((b[s] || 0)/b.n)).join(' '));
const N = files.length - 0;
console.log('all', S.map(s=> Math.round((tot[s] || 0)/77)).join(' '), 'counts', JSON.stringify(cnt));
