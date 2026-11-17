#!/usr/bin/env node
/* node run.mjs --case <id> [--seed n] [--method methods/baseline.mjs[,other.mjs]] [--shape type]
                [--fit '{"shapeStarts":10}'] [--out file.json] [--nolog] [--quiet]
   Runs the case's pattern (seed: the noise realisation; a case's first seed by default)
   to the shape search and each method there; prints a one-line summary per method and
   writes the whole record (JSON) to --out. node run.mjs --list prints the cases. */
import fs from 'node:fs';
import path from 'node:path';
import { CASES, caseById, loadMethod, runCase, HERE } from './lib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (opt.list){ for (const c of CASES) console.log([c.id, c.kind, c.run || c.type, c.dims ? c.dims.join('×') + ' nm' : c.D ? c.D + ' nm' : c.file || '', 'seeds ' + c.seeds.join(',')].join('\t')); process.exit(0); }
if (!opt.case){ console.error('--case <id> (or --list)'); process.exit(2); }
const c = caseById(opt.case), seed = opt.seed != null ? +opt.seed : c.seeds[0];
const files = String(opt.method || path.join(HERE, 'methods', 'baseline.mjs')).split(',');
const methods = []; for (const f of files) methods.push(await loadMethod(f));
const fit = opt.fit ? JSON.parse(opt.fit) : {};
const t0 = Date.now();
const out = runCase({ id: c.id, seed, methods, shape: opt.shape || null, fit, log: !opt.nolog });
out.wall = Date.now() - t0; out.fit = fit; out.node = process.version; out.at = new Date().toISOString();
if (opt.out){ fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true }); fs.writeFileSync(opt.out, JSON.stringify(out)); }
if (!opt.quiet){
  const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
  console.log(`${c.id} seed ${seed} ${out.shape}: iso χ² ${f(out.iso && out.iso.chi2, 0)} (χ²_ν ${f(out.iso && out.iso.chi2nu, 3)}, ${out.iso && out.iso.evals} evals, ${out.iso && out.iso.ms} ms)`);
  for (const r of out.records){
    const dims = r.solid ? r.solid.dims.map(d=> f(d, 2)).join('×') : '';
    console.log(`  ${r.method}: ${r.error ? 'ERROR ' + r.error.split('\n')[0] : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' + (r.early ? ' early' : '') : 'none'} χ² ${f(r.chi2, 1)} free ${f(r.chi2Free, 1)} ΔBIC ${f(r.dBIC, 0)} | ${r.evals} evals ${r.ms} ms ${r.refines} refines | ${dims}${r.acc ? ` | dims ${r.acc.dimErr.map(e=> f(100*e, 0) + '%').join(' ')} orient ${f(r.acc.orient)}° normal ${f(r.acc.principal)}°` : ''}`);
  }
}
