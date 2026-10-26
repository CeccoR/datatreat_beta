#!/usr/bin/env node
/* node batch.mjs --tag <name> [--method methods/a.mjs[,b.mjs]] [--rows screen|tuning|validation|truths|spheres|all|id,id]
                  [--design ../design/design.json] [--shape type] [--fit '{...}'] [--jobs 2] [--draw]
   Runs run.mjs once per row, each in its own process under nice -n 15, --jobs at a time
   (default 2; 3 is allowed for the pilot when nothing else runs, never more); writes
   results/<tag>/<row>.json and skips those already there (a batch resumes). Progress in
   results/<tag>/batch.log. --rows screen: the 77-run screening set; tuning: the 154 tuning
   runs; validation: the 77 validation runs (score them once, on the final version). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag){ console.error('--tag <name>'); process.exit(2); }
const designFile = path.resolve(opt.design || path.join(HERE, '..', 'design', 'design.json'));
const design = JSON.parse(fs.readFileSync(designFile, 'utf8'));
const dir = path.join(HERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const sel = String(opt.rows || 'screen');
const pick = { all: ()=> true, screen: r=> r.screen, tuning: r=> r.split === 'tuning', validation: r=> r.split === 'validation', truths: r=> r.kind === 'truth', spheres: r=> r.kind === 'sphere' };
const rows = pick[sel] ? design.rows.filter(pick[sel]) : sel.split(',').map(id=> design.rows.find(r=> r.id === id) || (()=> { throw new Error('no row ' + id); })());
const N = Math.max(1, Math.min(3, +(opt.jobs || 2)));
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const todo = rows.filter(r=> !fs.existsSync(path.join(dir, `${r.id}.json`)));
log(`${opt.tag}: ${todo.length} of ${rows.length} runs to do (${sel}), ${N} at a time; method ${opt.method || 'methods/baseline.mjs'}; design ${design.version}`);
const methodArg = String(opt.method || 'methods/baseline.mjs').split(',').map(f=> path.resolve(HERE, f)).join(',');
let next = 0, done = 0, failed = 0;
const t0 = Date.now();
await new Promise(resolve=> {
  if (!todo.length) return resolve();
  const start = ()=> {
    if (next >= todo.length){ if (done + failed === todo.length) resolve(); return; }
    const r = todo[next++], out = path.join(dir, `${r.id}.json`);
    const args = ['-n', '15', process.execPath, path.join(HERE, 'run.mjs'), '--row', r.id, '--design', designFile, '--method', methodArg, '--out', out];
    if (opt.shape) args.push('--shape', opt.shape);
    if (opt.fit) args.push('--fit', opt.fit);
    if (opt.draw) args.push('--draw');
    const ts = Date.now(), p = spawn('nice', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
    p.on('close', code=> {
      if (code === 0) done++; else failed++;
      log(`[${done + failed}/${todo.length}] ${r.id}: ${code === 0 ? 'ok' : 'FAILED ' + code} ${((Date.now() - ts)/1000).toFixed(0)} s\n${txt.trim()}`);
      start();
    });
  };
  for (let i = 0; i < N; i++) start();
});
log(`${opt.tag}: ${done} done, ${failed} failed, ${((Date.now() - t0)/60000).toFixed(1)} min`);
