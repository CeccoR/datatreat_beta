// Iterations per refinement by stage: the pilot's today (stages inferred from its log by position and
// flags) against track B's fwd record (labelled stages), on the same rows. Sub-screen rows vs the rest.
import fs from 'node:fs';
const FS2 = new URL('..', import.meta.url).pathname.replace(/\/$/, '');   // $W/fs2 (this script ran from $W/fs2/B-verify)
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const design = rd(FS2 + '/design/design.json'), rows = design.rows.filter(r => r.screen);
const sub = new Set(fs.readFileSync(FS2 + '/B/subscreen.txt', 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t')[0]));
const label = lg => {   // today's stages from the log: 11 briefs (mi 8), then full (soft, mi 60, ≤3), polish (soft), exact (hard, rot), held (!rot), refit (rot after held)
  const out = []; let i = 0;
  while (i < lg.length && lg[i].mi === 8){ out.push('brief'); i++; }
  let nf = 0; while (i < lg.length && lg[i].soft && nf < 3){ out.push('full'); nf++; i++; }
  while (i < lg.length && lg[i].soft){ out.push('polish'); i++; }
  let seenHeld = false;
  for (; i < lg.length; i++){ const e = lg[i]; if (!e.rot){ out.push('held'); seenHeld = true; } else out.push(seenHeld ? 'refit' : 'exact'); }
  return out;
};
const acc = {};
const add = (k, st, it, ev) => { const a = acc[k] = acc[k] || {}; const s = a[st] = a[st] || { n: 0, it: 0, ev: 0 }; s.n++; s.it += it; s.ev += ev; };
let checked = 0, mism = 0;
for (const r of rows){
  const p = rd(`${FS2}/pilot/results/screen/${r.id}.json`).records.find(x => x.method === 'today');
  const tag = fs.existsSync(`${FS2}/B/results/sub1/${r.id}.json`) ? 'sub1' : 'full';
  const o = rd(`${FS2}/B/results/${tag}/${r.id}.json`);
  const f = o.records.find(x => x.method === 'fwd'), t = o.records.find(x => x.method === 'today');
  const grp = sub.has(r.id) ? 'sub' : 'rest';
  const L = label(p.log);
  // check the inferred labels on the replica, where B labelled them (sub1 rows)
  if (t){ const tl = t.var.stages.map(s => s.st); checked++; if (tl.join() !== L.slice(0, tl.length).join()) mism++; }
  L.forEach((st, i) => add('today ' + grp, st, p.log[i].it, p.log[i].ev));
  f.var.stages.forEach((s, i) => { if (s.st !== 'central') add('fwd ' + grp, s.st, s.it, s.ev); });
}
console.log(`label inference checked on ${checked} replica runs: ${mism} mismatches`);
for (const k of Object.keys(acc).sort()) console.log(k.padEnd(10), Object.entries(acc[k]).map(([st, s]) => `${st} ${s.n} × ${(s.it / s.n).toFixed(1)} it, ${(s.ev / s.n).toFixed(0)} ev`).join(' | '));
