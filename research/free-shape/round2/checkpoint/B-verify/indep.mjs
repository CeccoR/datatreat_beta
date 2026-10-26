// Skeptic's independent reading of track B's raw records (not through score.mjs).
// 1. bestC / fwd / fwdC evaluation and wall sums against the pilot, from search.evals, covOnly, central.
// 2. Load between batches: per row, the same mechanics run in two batches (fwd vs fwdH, fwd vs symA in
//    the six classes where symA = fwdH), ms per evaluation compared.
// 3. The today replica's ms against the pilot's, per row (load during sub1).
import fs from 'node:fs';
import path from 'node:path';
const FS2 = '/tmp/claude-0/-home-user-datatreat-beta/51d5ad4e-64c4-51d8-8fdc-0e18be5b5240/scratchpad/fs2';
const R = path.join(FS2, 'B', 'results');
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = design.rows.filter(r => r.screen);
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const recs = {};   // id -> { method -> {tag, rec, wall} }
for (const tag of ['sub1', 'sub2', 'sub2s', 'full', 'fullsub', 'sym25', 'held30']){
  for (const r of rows){
    const f = path.join(R, tag, r.id + '.json'); if (!fs.existsSync(f)) continue;
    const o = rd(f);
    for (const rec of o.records){ (recs[r.id] = recs[r.id] || {}); if (recs[r.id][rec.method]) console.log('DUP', r.id, rec.method, tag); recs[r.id][rec.method] = { tag, rec }; }
  }
}
const pilot = {}; for (const r of rows){ const o = rd(path.join(FS2, 'pilot', 'results', 'screen', r.id + '.json')); pilot[r.id] = o.records.find(x => x.method === 'today'); }
const FIVE = new Set(['-3m', '6/m', '6/mmm', 'm-3', 'm-3m']);
let S = { pil: 0, pilMs: 0, bestC: 0, bestCms: 0, fwd: 0, fwdC: 0 };
const byClass = {};
for (const r of rows){
  const p = pilot[r.id]; S.pil += p.search.evals; S.pilMs += p.search.ms;
  const src = FIVE.has(r.laue) ? 'symA' : 'fwdH';
  const x = recs[r.id][src]; if (!x){ console.log('MISSING', r.id, src); continue; }
  const v = x.rec.var, ev = x.rec.search.evals - (v.covOnly ? v.covOnly.ev : 0), ms = x.rec.search.ms - (v.covOnly ? v.covOnly.ms : 0);
  S.bestC += ev; S.bestCms += ms;
  const c = byClass[r.laue] = byClass[r.laue] || { pil: 0, ev: 0, pms: 0, ms: 0 }; c.pil += p.search.evals; c.ev += ev; c.pms += p.search.ms; c.ms += ms;
  const fw = recs[r.id].fwd.rec, fv = fw.var;
  S.fwd += fw.search.evals - (fv.central ? fv.central.ev : 0);
  S.fwdC += fw.search.evals - (fv.covOnly ? fv.covOnly.ev : 0);
  // the other source exists in the five classes? (symA in the six would be the same config)
  if (!FIVE.has(r.laue) && recs[r.id].symA) console.log('symA ran in a six-class row', r.id);
}
console.log('evals: pilot', S.pil, 'bestC', S.bestC, (S.bestC / S.pil).toFixed(3), 'fwd', S.fwd, (S.fwd / S.pil).toFixed(3), 'fwdC', S.fwdC, (S.fwdC / S.pil).toFixed(3));
console.log('wall: pilot', (S.pilMs / 60000).toFixed(1), 'min, bestC', (S.bestCms / 60000).toFixed(1), 'min', (S.bestCms / S.pilMs).toFixed(3), '; per run', (S.pilMs / 77000).toFixed(1), (S.bestCms / 77000).toFixed(1), 's');
for (const [l, c] of Object.entries(byClass)) console.log(' ', l.padEnd(6), 'ev', (c.ev / c.pil).toFixed(2), 'wall', (c.ms / c.pms).toFixed(2));

// 2. load between batches: ms/ev of fwdH (or symA in the six classes = none) vs fwd, same row.
console.log('\nper-evaluation time, same row, same mechanics in two batches (ratio of ms/ev: second / first):');
const groups = {};
for (const r of rows){
  const a = recs[r.id].fwd, b = recs[r.id].fwdH; if (!a || !b) continue;
  const pa = a.rec.search.ms / a.rec.search.evals, pb = b.rec.search.ms / b.rec.search.evals;
  const k = `fwd@${a.tag} → fwdH@${b.tag}`; (groups[k] = groups[k] || []).push({ id: r.id, ratio: pb / pa, eva: a.rec.search.evals, evb: b.rec.search.evals, msa: a.rec.search.ms, msb: b.rec.search.ms });
}
for (const r of rows){
  const a = recs[r.id].fwd, b = recs[r.id].symA; if (!a || !b) continue;
  const pa = a.rec.search.ms / a.rec.search.evals, pb = b.rec.search.ms / b.rec.search.evals;
  const k = `fwd@${a.tag} → symA@${b.tag}`; (groups[k] = groups[k] || []).push({ id: r.id, ratio: pb / pa, msa: a.rec.search.ms, msb: b.rec.search.ms, eva: a.rec.search.evals, evb: b.rec.search.evals });
}
const med = xs => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
for (const [k, g] of Object.entries(groups)){
  const sumA = g.reduce((t, x) => t + x.msa, 0), sumB = g.reduce((t, x) => t + x.msb, 0), eA = g.reduce((t, x) => t + x.eva, 0), eB = g.reduce((t, x) => t + x.evb, 0);
  console.log(`  ${k}: ${g.length} rows; ms/ev ratio median ${med(g.map(x => x.ratio)).toFixed(3)}, pooled ${((sumB / eB) / (sumA / eA)).toFixed(3)}; evals ${eB}/${eA} = ${(eB / eA).toFixed(3)}, ms ${(sumB / sumA).toFixed(3)}`);
}
// 3. today replica vs pilot
const t = rows.filter(r => recs[r.id].today).map(r => ({ id: r.id, ratio: recs[r.id].today.rec.search.ms / pilot[r.id].search.ms }));
console.log('\ntoday replica ms / pilot ms:', t.length, 'rows, median', med(t.map(x => x.ratio)).toFixed(3), 'range', Math.min(...t.map(x => x.ratio)).toFixed(3), Math.max(...t.map(x => x.ratio)).toFixed(3));
// 4. pilot vs the today replica ms/ev, and pilot's ms/ev of the rows by tag of best's source
