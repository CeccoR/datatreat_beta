// The screen-only pilot: per run the screen's best against the truth, whether a pick (and
// which rank) lies in the baseline's final solid's morphology (8°, e^0.25), the widths'
// isotropy p against the baseline's outcome. node screen-report.mjs results/screen
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const { readResult, compareSolids, sameSolid, truthOf, CASES } = await import(H + '/lib.mjs');
const dir = process.argv[2];
const side = fs.readFileSync(path.join(dir, 'side.jsonl'), 'utf8').trim().split('\n').map(l=> JSON.parse(l, (k, v)=> k === 'dims' && Array.isArray(v) ? v.map(d=> d >= 1e8 ? Infinity : d) : v));
const base = new Map();
for (const f of fs.readdirSync(H + '/results/baseline').filter(f=> f.endsWith('.json') && f !== 'summary.json')){
  const r = readResult(fs.readFileSync(H + '/results/baseline/' + f, 'utf8')); if (!r.records) continue;
  base.set(r.case + '|' + r.seed, r);
}
const f1 = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const rows = [];
for (const s of side){
  const c = CASES.find(c=> c.id === s.case), b = base.get(s.case + '|' + s.seed), bm = b && b.records.find(m=> m.method === 'baseline');
  const truth = (c.kind === 'synth' || c.kind === 'sample') ? truthOf(c).solid : null;
  const best = s.picks[0] && { type: s.type, dims: s.picks[0].dims, axes: s.picks[0].axes };
  const acc = truth && best ? compareSolids(best, truth) : null;
  // the baseline's final exact solid: reported, else its free solid
  const fin = bm && (bm.solid || bm.freeSolid);
  const rank = fin ? s.picks.findIndex(p=> sameSolid({ type: s.type, dims: p.dims, axes: p.axes }, fin)) : -2;
  const rankT = truth ? s.picks.findIndex(p=> sameSolid({ type: s.type, dims: p.dims, axes: p.axes }, truth)) : -2;
  rows.push({ id: s.case, seed: s.seed, kind: c.kind, type: s.type, rows: s.rows, rowsAll: s.rowsAll, msW: s.msWidths, evW: s.evWidths, msS: s.msScreen, isoP: s.isoP, gainW: s.chiIsoW - s.chiBestW, chiBestW: s.chiBestW,
    out: bm ? (bm.kept ? (bm.held ? 'held' : 'free') : bm.rejected ? (bm.early ? 'rej-early' : 'rejected') : 'none') : '?', rank, rankT, dimMax: acc && acc.dimMax, principal: acc && acc.principal, orient: acc && acc.orient, best: s.picks[0] });
}
rows.sort((a, b)=> CASES.findIndex(c=> c.id === a.id) - CASES.findIndex(c=> c.id === b.id) || a.seed - b.seed);
console.log('| run | type | rows | isoP | widths gain | best χ²_w | baseline | pick in baseline morphology (rank) | pick near truth (rank) | screen best: dims | dim err | normal ° |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} #${r.seed} | ${r.type} | ${r.rows}/${r.rowsAll} | ${r.isoP < 1e-3 ? r.isoP.toExponential(0) : f1(r.isoP, 3)} | ${f1(r.gainW, 0)} | ${f1(r.chiBestW)} | ${r.out} | ${r.rank} | ${r.rankT} | ${r.best ? r.best.dims.map(d=> f1(d)).join('×') : '—'} | ${r.dimMax != null ? (100*r.dimMax).toFixed(0) + ' %' : '—'} | ${f1(r.principal)} |`);
const med = xs => { const v = xs.filter(Number.isFinite).sort((a, b)=> a - b); return v.length ? v[v.length >> 1] : NaN; };
const pct = (xs, p) => { const v = xs.filter(Number.isFinite).sort((a, b)=> a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(p*v.length))] : NaN; };
for (const k of ['synth', 'sample', 'control', 'fixture']){
  const rs = rows.filter(r=> r.kind === k); if (!rs.length) continue;
  const kept = rs.filter(r=> r.out === 'held' || r.out === 'free');
  console.log(`\n${k}: ${rs.length} runs; widths ${f1(med(rs.map(r=> r.msW)), 0)} ms (median), screen ${f1(med(rs.map(r=> r.msS)), 0)} ms; rows ${f1(med(rs.map(r=> r.rows)), 0)}; isoP<1e-3 in ${rs.filter(r=> r.isoP < 1e-3).length};` +
    ` baseline kept ${kept.length}, of which a pick in its final morphology ${kept.filter(r=> r.rank >= 0).length} (rank 0: ${kept.filter(r=> r.rank === 0).length}); a pick near the truth ${rs.filter(r=> r.rankT >= 0).length};` +
    ` screen best: dim err median ${f1(100*med(kept.map(r=> r.dimMax)), 0)} %, p90 ${f1(100*pct(kept.map(r=> r.dimMax), 0.9), 0)} %, normal median ${f1(med(kept.map(r=> r.principal)))}°, p90 ${f1(pct(kept.map(r=> r.principal), 0.9))}°`);
  console.log('  isoP of rejected:', rs.filter(r=> /rej/.test(r.out)).map(r=> `${r.id}#${r.seed} ${r.isoP.toExponential(1)} gainW ${f1(r.gainW, 0)}`).join('; '));
  console.log('  min isoP-side: kept runs with isoP >= 1e-3:', kept.filter(r=> r.isoP >= 1e-3).map(r=> `${r.id}#${r.seed} ${f1(r.isoP, 3)}`).join('; '));
}
