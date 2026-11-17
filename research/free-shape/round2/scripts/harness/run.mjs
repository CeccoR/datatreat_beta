#!/usr/bin/env node
/* node run.mjs --row <id> [--design ../design/design.json] [--pattern file.json | --draw [--kernel exact|none]]
                [--method methods/baseline.mjs[,methods/truth.mjs]] [--shape type] [--fit '{"shapeStarts":10}']
                [--out file.json] [--nolog] [--quiet]
   One design row: its pattern (default ../gen/patterns/<id>.json, as gen/draw.mjs writes
   them; --draw draws it in memory with gen/gen.mjs drawRow), refined to the shape search
   and each method run there (lib.mjs runCase). --shape searches another solid than the
   row's (the truth's errors are then not computed). Prints a line per method; writes the
   whole record (JSON) to --out. node run.mjs --list [--design …] prints the rows. */
import fs from 'node:fs';
import path from 'node:path';
import { loadMethod, runCase, patternFor, writeResult, HERE, FS2 } from './lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(opt.design || path.join(FS2, 'design', 'design.json'), 'utf8'));
if (opt.list){ for (const r of design.rows) console.log([r.id, r.kind, r.phase, r.laue, r.solid, r.search, r.orient || '', r.split, r.screen ? 'screen' : '', r.error ? r.error.kind : 'none'].join('\t')); process.exit(0); }
if (!opt.row){ console.error('--row <id> (or --list)'); process.exit(2); }
const row = design.rows.find(r=> r.id === opt.row);
if (!row){ console.error('no row ' + opt.row); process.exit(2); }
const pattern = await patternFor(row, { file: opt.pattern || null, draw: !!opt.draw, kernel: opt.kernel || 'exact' });
const files = String(opt.method || path.join(HERE, 'methods', 'baseline.mjs')).split(',');
const methods = []; for (const f of files) methods.push(await loadMethod(path.resolve(HERE, f)));
const fit = opt.fit ? JSON.parse(opt.fit) : {};
const t0 = Date.now();
const out = runCase({ row, pattern, methods, shape: opt.shape || null, fit, log: !opt.nolog });
out.wall = Date.now() - t0; out.fit = fit; out.node = process.version; out.at = new Date().toISOString(); out.design = design.version;
out.pattern = { file: opt.draw ? 'drawn in memory, kernel ' + (opt.kernel || 'exact') : (opt.pattern || `gen/patterns/${row.id}.json`), info: pattern.info || null, n: pattern.x.length, lo: pattern.x[0], hi: pattern.x[pattern.x.length - 1] };
if (opt.out){ fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true }); fs.writeFileSync(opt.out, writeResult(out)); }
if (!opt.quiet){
  const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
  console.log(`${row.id} (${row.laue}, ${row.solid}${row.error ? ', ' + row.error.kind + ' ' + row.error.strength.toFixed(2) : ''}) searched as ${out.shape}: iso χ² ${f(out.iso && out.iso.chi2, 0)} (χ²_ν ${f(out.iso && out.iso.chi2nu, 3)}, ${out.iso && out.iso.evals} evals, ${out.iso && out.iso.ms} ms)`);
  for (const r of out.records){
    const dims = r.solid ? r.solid.dims.map(d=> f(d, 2)).join('×') : '';
    console.log(`  ${r.method}: ${r.error ? 'ERROR ' + r.error.split('\n')[0] : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' + (r.early ? ' early' : '') : 'none'} χ² ${f(r.chi2, 1)} best ${f(r.chi2Best, 1)} ΔBIC ${f(r.dBIC, 0)} | ${r.evals} evals ${r.ms} ms ${r.refines} refines | ${dims}`
      + (r.acc ? ` | dims ${r.acc.dimErr.map(e=> f(100*e, 0) + '%').join(' ')} orient ${f(r.acc.orient)}° (holohedry ${f(r.acc.orientHolo)}°) principal ${f(r.acc.principal)}°` : '')
      + (r.canonical ? ` | ${r.canonical.labels.map(l=> l || '·').join(' ')}` : ''));
  }
}
