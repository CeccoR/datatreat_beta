#!/usr/bin/env node
/* node uniq-sum.mjs <tag> [--json out.json]: the uniqueness analysis (methods/uniq.mjs) per
   run: the converged minima within Δ 10 of the best, each with its Δ, the straight-path
   barrier (χ²_ν), how it differs from the best (largest dimension ratio, worst axis), and
   the analysis's cost. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from './h/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2], dir = path.join(HERE, 'results', tag);
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
const out = [];
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json')).sort()){
  const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8')); if (!r.records) continue;
  const m = r.records[0], u = m.info && m.info.uniq;
  if (!u){ console.log(`${r.case}#${r.seed}: ${m.kept ? 'no analysis' : m.rejected ? 'rejected' : 'none'}`); continue; }
  const others = u.minima.filter(x=> x.delta > 0 || x.vsBest);
  const dims = s => s.dims.map(d=> Number.isFinite(d) ? d.toFixed(1) : '∞').join('×');
  console.log(`${r.case}#${r.seed}: search ${m.evals - u.evals} evals; analysis ${u.evals} evals ${f(u.ms/1000)} s, ${u.extra} extra refinements, ${u.nMinima} minima; best ${dims(u.minima[0].solid)}`);
  for (const x of others) console.log(`   Δ ${f(x.delta, 2)}  barrier ${f(x.barrier, 1)}  ${dims(x.solid)}  vs best: dims ${x.vsBest ? x.vsBest.dimErr.map(e=> f(100*e, 0) + '%').join(' ') : ''} axis ${f(x.vsBest && x.vsBest.orient)}°  (${x.stage})`);
  out.push({ run: `${r.case}#${r.seed}`, kind: r.kind, searchEvals: m.evals - u.evals, ...u });
}
if (process.argv[3] === '--json') fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 1));
