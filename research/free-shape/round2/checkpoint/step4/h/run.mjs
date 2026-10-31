#!/usr/bin/env node
/* [step3] step 2's run.mjs; the method 'proto' (methods/proto.mjs) adds r.check (the engine's
   per-line check) and r.drop (the refits without the flagged segments).
   The pilot's one command: a design row drawn by the generator (../gen/gen.mjs drawRow, in
   memory) and refined by the harness (../harness/lib.mjs runCase) with each method, from
   one isotropic fit. Writes one JSON per run.
   node run.mjs --row <id> [--design ../design/design.json] [--lo 10 --hi 110 --step 0.01]
                [--kernel exact|none] [--method today,truth] [--out file.json] [--nolog] [--quiet]
   - --kernel none draws the row with the engine's own Lorentzian lines (the in-model
     control); exact (default) with the solid's exact line shapes.
   - methods: 'today' (methods/today.mjs: freeShape and the card's report, timed apart),
     'truth' (../harness/methods/truth.mjs: the solid refined from the truth, a reference),
     'baseline' (../harness/methods/baseline.mjs: freeShape alone), or a path.
   The record is runCase's (../harness/README.md, "What a record holds") plus: draw (the
   pattern's grid, kernel, ms, the generator's info and the error's draws), stages (wall
   ms and evaluations of the isotropic fit, each method's search and report), list (the
   model's reflections, members and points), wall, and per record `search` and `report`.
   The grid's default is the generator's GRID, the pilot's decision (PILOT.md): 10–110° in
   0.01° steps. Unbounded extents are written as "Infinity" (lib.mjs writeResult). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawRow, GRID } from '../../gen/gen.mjs';
import { loadMethod, runCase, writeResult, FS2, ENG } from './lib.mjs';
// [proto] the switches from the environment: PROTO_LINE (lsq | lor), PROTO_SEARCH (v2 | today)
if (process.env.PROTO_LINE) ENG.SHAPE_MODE.line = process.env.PROTO_LINE;
if (process.env.PROTO_SEARCH) ENG.SHAPE_MODE.search = process.env.PROTO_SEARCH;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const designFile = path.resolve(opt.design || path.join(FS2, 'design', 'design.json'));
const design = JSON.parse(fs.readFileSync(designFile, 'utf8'));
const row = design.rows.find(r=> r.id === opt.row);
if (!row){ console.error('--row <id>: no row ' + opt.row); process.exit(2); }
const grid = { lo: +(opt.lo || GRID.lo), hi: +(opt.hi || GRID.hi), step: +(opt.step || GRID.step) };
const kernel = opt.kernel || 'exact';
const KNOWN = { min: path.join(HERE, 'methods', 'min.mjs'), boot: path.join(HERE, 'methods', 'boot.mjs'), proto: path.join(HERE, 'methods', 'proto.mjs'), today: path.join(FS2, 'pilot', 'methods', 'today.mjs'), truth: path.join(FS2, 'harness', 'methods', 'truth.mjs'), baseline: path.join(FS2, 'harness', 'methods', 'baseline.mjs') };
const methods = [];
for (const m of String(opt.method || 'today,truth').split(',')) methods.push(await loadMethod(KNOWN[m] || path.resolve(m)));
const T0 = Date.now();
const pat = drawRow(row, { kernel, grid });
const drawMs = Date.now() - T0;
// runCase runs the methods in turn inside one autoRefine; each method's stats (today.mjs)
// are read right after its own search, before the next method clears nothing of it
const cpu0 = process.cpuUsage();   // [proto] CPU of the fit (iso + methods), the draw left out
const out = runCase({ row, pattern: { x: pat.x, y: pat.y, instr: pat.instr, irf: pat.irf }, methods, log: !opt.nolog });
{ const c = process.cpuUsage(cpu0); out.cpu = { fitMs: (c.user + c.system)/1000 }; }
out.mode = { ...ENG.SHAPE_MODE, fwd: ENG.SHAPE_FWD, profile: process.env.PROTO_PROFILE || 'lorentz', wppm: process.env.PROTO_WPPM || '' };   // [proto] [step1] [step2]
out.wall = Date.now() - T0;
out.draw = { grid, kernel, ms: drawMs, n: pat.x.length, info: pat.info, error: pat.truth.error };
out.stages = { draw: { ms: drawMs }, iso: out.iso ? { ms: out.iso.ms, evals: out.iso.evals } : null };
out.records.forEach((r, i)=> {
  const st = methods[i].stats;
  if (st && st.search){
    r.search = st.search; r.report = st.report || null; out.list = st.list;
    if (st.check) r.check = st.check;   // [step3]
    if (st.drop) r.drop = st.drop;   // [step3] the refits without the flagged segments (methods/proto.mjs)
    if (st.min) r.min = st.min; if (st.settings) r.settings = st.settings; if (st.boot) r.boot = st.boot;   // [step4]
    if (st.dump && opt.out) fs.writeFileSync(String(opt.out).replace(/\.json(\.part)?$/, '') + '.res.json', JSON.stringify(st.dump));   // [step3]
    out.stages[r.method] = { search: st.search, report: st.report ? { ms: st.report.ms, evals: st.report.evals } : null };
  } else { r.search = { evals: r.evals, ms: r.ms }; out.stages[r.method] = { search: r.search }; }
});
out.at = new Date().toISOString(); out.node = process.version; out.design = design.version; out.host = { cpus: (await import('node:os')).cpus().length };
if (opt.out){ fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true }); fs.writeFileSync(opt.out, writeResult(out)); }
if (!opt.quiet){
  const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
  console.log(`${row.id} (${row.laue}, ${row.solid} ${row.dims.map(d=> f(d)).join('×')}${row.error ? ', ' + row.error.kind + ' ' + row.error.strength.toFixed(2) : ''}; ${kernel}, ${grid.lo}–${grid.hi}/${grid.step}) as ${out.shape}: draw ${drawMs} ms; iso χ²_ν ${f(out.iso && out.iso.chi2nu, 3)}, ${out.iso && out.iso.evals} ev, ${out.iso && out.iso.ms} ms; list ${out.list ? out.list.refl + ' refl, ' + out.list.members + ' members' : ''}`);
  for (const r of out.records){
    const dims = r.solid ? r.solid.dims.map(d=> f(d, 2)).join('×') : '';
    console.log(`  ${r.method}: ${r.error ? 'ERROR ' + r.error.split('\n')[0] : r.kept ? (r.held ? 'held' : 'free') : r.rejected ? 'rejected' + (r.early ? ' early' : '') : 'none'} χ² ${f(r.chi2, 1)} best ${f(r.chi2Best, 1)} ΔBIC ${f(r.dBIC, 0)} | search ${r.search.evals} ev ${r.search.ms} ms${r.report ? ` report ${r.report.evals} ev ${r.report.ms} ms` : ''} | ${dims}`
      + (r.acc ? ` | dims ${r.acc.dimErr.map(e=> f(100*e, 0) + '%').join(' ')} orient ${f(r.acc.orient)}° (holo ${f(r.acc.orientHolo)}°) principal ${f(r.acc.principal)}°` : ''));
  }
  console.log(`  wall ${f(out.wall/1000)} s`);
}
