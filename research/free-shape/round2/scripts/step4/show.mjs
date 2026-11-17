// print a step-4 record's stage, minima and report errors
import fs from 'node:fs';
import { readResult } from './lib.mjs';
for (const f of process.argv.slice(2)){
  const o = readResult(fs.readFileSync(f, 'utf8')), r = o.records[0], i = r.info || {}, rep = r.report || {};
  const g = (x, d = 2) => x == null ? '—' : x === Infinity ? '∞' : Number.isFinite(x) ? (+x).toFixed(d) : String(x);
  console.log(o.row, r.kept ? (r.held ? 'held' : 'free') : 'rej', 'χ²', g(r.chi2, 1), 'search', r.search.evals, 'min', r.min && r.min.evals, r.min && r.min.ms + 'ms', 'stage', JSON.stringify(i.minimaStage || null));
  for (const m of i.minima || []) console.log('   min Δ', g(m.delta), 'n', m.n, 'from', m.from.join(','), 'kicks', m.kicks, 'W', m.W.map(x=> g(x, 4)).join(' '), 'sW', m.s.w.map(x=> g(x, 4)).join(' '), 'sA°', m.s.a.map(x=> g(x*57.3, 2)).join(' '));
  if (rep.dims) for (const d of rep.dims) console.log('   dim', d.name, g(d.D), '±', g(d.Desd), 'between', g(d.betweenLo), g(d.betweenHi));
  if (rep.axes) for (const a of rep.axes) console.log('   axis', a.role, a.label, 'esd°', g(a.esdAngle), 'betw°', g(a.betweenDeg), 'set', a.set);
  if (rep.sets) console.log('   sets', JSON.stringify(rep.sets));
  if (rep.minima) console.log('   minima', JSON.stringify({ n: rep.minima.n, unique: rep.minima.unique }), rep.minima.list.map(m=> g(m.delta, 1) + ':' + m.dims.map(d=> g(d, 1)).join('x') + '@' + g(m.angle, 1)).join(' | '));
  if (r.acc) console.log('   acc dims', r.acc.dimErr.map(e=> g(100*e, 1) + '%').join(' '), 'principal', g(r.acc.principal, 1));
}
