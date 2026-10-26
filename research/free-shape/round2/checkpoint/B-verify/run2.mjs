#!/usr/bin/env node
/* Track B's one command: a design row drawn (../gen/gen.mjs drawRow, exact lines) and
   refined (h/lib.mjs runCase on h/eng) with each variant in turn, all from one isotropic fit.
   node run.mjs --row <id> --method today,nocov,fwd [--out file.json] [--nolog] [--quiet]
   The record is the pilot's (run.mjs) with, per method record: search { evals, ms }, var
   (the method's stats: stages, starts, heldDup, covOnly, central, pre) and pre.acc (the fit
   before the central pass against the truth). No report (bodyShapeOf) is run: it is today's,
   unchanged, and outside the search. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawRow, GRID } from '../gen/gen.mjs';
import { runCase, writeResult, FS2, truthOf, accuracy } from '../B/h/lib.mjs';
import { make } from './var2.mjs';
import { VARIANTS } from './variants2.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const row = design.rows.find(r=> r.id === opt.row);
if (!row){ console.error('--row <id>: no row ' + opt.row); process.exit(2); }
if (row.split === 'validation'){ console.error('validation rows are scored once, on the final version: refused'); process.exit(2); }
const grid = { lo: GRID.lo, hi: GRID.hi, step: GRID.step };
const methods = String(opt.method || 'today').split(',').map(n=> { if (!VARIANTS[n]) throw new Error('no variant ' + n); return make({ name: n, ...VARIANTS[n] }); });
const T0 = Date.now();
const pat = drawRow(row, { kernel: 'exact', grid });
const drawMs = Date.now() - T0;
const out = runCase({ row, pattern: { x: pat.x, y: pat.y, instr: pat.instr, irf: pat.irf }, methods, log: !opt.nolog });
out.wall = Date.now() - T0;
out.draw = { grid, kernel: 'exact', ms: drawMs, n: pat.x.length, info: pat.info, error: pat.truth.error };
const T = truthOf(row);
out.records.forEach((r, i)=> {
  const st = methods[i].stats;
  r.search = st.search || { evals: r.evals, ms: r.ms }; out.list = st.list;
  const { list, search, ...rest } = st;
  r.var = rest;
  if (st.pre && T.solid && T.solid.type === out.shape){ r.var.pre.acc = accuracy(row.phase, st.pre.solid, T.solid); delete r.var.pre.v; }
});
out.at = new Date().toISOString(); out.node = process.version; out.design = design.version;
if (opt.out){ fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true }); fs.writeFileSync(opt.out, writeResult(out)); }
if (!opt.quiet){
  const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
  console.log(`${row.id} (${row.laue}, ${row.solid}${row.error ? ', ' + row.error.kind : ''}) as ${out.shape}: iso χ²_ν ${f(out.iso && out.iso.chi2nu, 3)}, ${out.iso && out.iso.evals} ev, ${out.iso && out.iso.ms} ms`);
  for (const r of out.records){
    const v = r.var || {};
    console.log(`  ${r.method}: ${r.error ? 'ERROR ' + r.error.split('\n')[0] : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' + (r.early ? ' early' : '') : 'none'} χ² ${f(r.chi2, 2)} best ${f(r.chi2Best, 2)} ΔBIC ${f(r.dBIC, 0)} | ${r.search.evals} ev ${r.search.ms} ms | starts ${v.starts ? v.starts.n : '—'}`
      + (v.central ? ` | central ${v.central.ev} ev Δχ² ${f(v.central.dChi, 3)}` : '') + (v.covOnly ? ` | cov ${v.covOnly.ev} ev` : '') + (v.heldDup && v.heldDup.length ? ` | heldDup ${v.heldDup.length}` : '')
      + (r.solid ? ' | ' + r.solid.dims.map(d=> f(d, 2)).join('×') : '') + (r.acc ? ` | dims ${r.acc.dimErr.map(e=> f(100*e, 0) + '%').join(' ')} axis ${f(r.acc.principal)}°` : ''));
  }
  console.log(`  wall ${f(out.wall/1000)} s`);
}
