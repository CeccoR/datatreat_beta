// Where the search's wall time goes: the time inside phasePattern (the pattern evaluations)
// and the rest, for today and fwd, on rows given. Engine hp/eng = h/eng with a timer around
// phasePattern and a flag inside the Jacobians (no arithmetic change). node prof.mjs --rows a,b --method today,fwd
import fs from 'node:fs';
import { drawRow, GRID } from '../gen/gen.mjs';
import { runCase, ENG } from './hp/lib.mjs';
import { make } from './methods/var.mjs';
import { VARIANTS } from './methods/variants.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync('../design/design.json', 'utf8'));
for (const id of String(opt.rows).split(',')){
  const row = design.rows.find(r=> r.id === id);
  const pat = drawRow(row, { kernel: 'exact', grid: GRID });
  const ms = String(opt.method || 'today,fwd').split(',').map(n=> { const m = make({ name: n, ...VARIANTS[n] }); const s0 = m.search; m.search = (...args)=> { const t0 = ENG.FS.tPP || 0, e0 = ENG.FS.evals, j0 = ENG.FS.tJ || 0, n0 = ENG.FS.nJ || 0; const r = s0.apply(m, args); m.stats.pp = { ms: (ENG.FS.tPP || 0) - t0, evals: ENG.FS.evals - e0, jms: (ENG.FS.tJ || 0) - j0, jn: (ENG.FS.nJ || 0) - n0 }; return r; }; return m; });
  runCase({ row, pattern: { x: pat.x, y: pat.y, instr: pat.instr, irf: pat.irf }, methods: ms, log: false });
  for (const m of ms){ const s = m.stats; console.log(`${id} ${m.name}: search ${s.search.evals} ev ${s.search.ms} ms; in phasePattern ${s.pp.ms.toFixed(0)} ms (${(s.pp.ms/s.pp.evals).toFixed(2)} ms/ev); outside ${(s.search.ms - s.pp.ms).toFixed(0)} ms = ${(100*(s.search.ms - s.pp.ms)/s.search.ms).toFixed(1)} %; iterations ${s.stages.reduce((t, e)=> t + (e.it || 0), 0)}; in Jacobians ${s.pp.jn} ev ${(s.pp.jms/s.pp.jn).toFixed(2)} ms/ev, elsewhere ${s.pp.evals - s.pp.jn} ev ${((s.pp.ms - s.pp.jms)/(s.pp.evals - s.pp.jn)).toFixed(2)} ms/ev`); }
}
