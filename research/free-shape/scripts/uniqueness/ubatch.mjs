#!/usr/bin/env node
/* node batch.mjs --tag <name> [--method methods/a.mjs[,b.mjs]] [--cases id,id|all|synth|sample|control|fixture]
                  [--seeds 1,2] [--shape type] [--fit '{...}'] [--jobs 2]
   Runs run.mjs once per (case, seed), each in its own process under nice -n 15, at most
   --jobs (default 2) at a time; writes results/<tag>/<case>-<seed>.json and skips those
   already there (a batch resumes where it stopped). Progress in results/<tag>/batch.log. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CASES } from '../harness/cases.mjs';
const UHERE = path.dirname(new URL(import.meta.url).pathname), HERE = path.join(UHERE, '..', 'harness');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag){ console.error('--tag <name>'); process.exit(2); }
const dir = path.join(UHERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const sel = String(opt.cases || 'all'), kinds = ['synth', 'sample', 'control', 'fixture'];
const cases = sel === 'all' ? CASES : kinds.includes(sel) ? CASES.filter(c=> c.kind === sel) : sel.split(',').map(id=> CASES.find(c=> c.id === id) || (()=> { throw new Error('no case ' + id); })());
const seeds = opt.seeds ? String(opt.seeds).split(',').map(Number) : null;
const jobs = [];
// --list file: one "case seed" per line (specific pairs) instead of cases × seeds
if (opt.list) for (const ln of fs.readFileSync(opt.list, 'utf8').split('\n')){ const [id, s] = ln.trim().split(/\s+/); if (id) jobs.push({ id, seed: +s }); }
else for (const c of cases) for (const s of (seeds || c.seeds)) if (c.seeds.includes(s) || seeds) jobs.push({ id: c.id, seed: s });
const N = Math.max(1, Math.min(2, +(opt.jobs || 2)));
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const todo = jobs.filter(j=> !fs.existsSync(path.join(dir, `${j.id}-${j.seed}.json`)));
log(`${opt.tag}: ${todo.length} of ${jobs.length} runs to do, ${N} at a time; method ${opt.method || 'methods/baseline.mjs'}`);
const methodArg = String(opt.method || 'methods/baseline.mjs').split(',').map(f=> path.resolve(UHERE, f)).join(',');
let next = 0, done = 0, failed = 0;
const t0 = Date.now();
await new Promise(resolve=> {
  const start = ()=> {
    if (next >= todo.length){ if (done + failed === todo.length) resolve(); return; }
    const j = todo[next++], out = path.join(dir, `${j.id}-${j.seed}.json`);
    const args = ['-n', '15', process.execPath, path.join(HERE, 'run.mjs'), '--case', j.id, '--seed', String(j.seed), '--method', methodArg, '--out', out];
    if (opt.shape) args.push('--shape', opt.shape);
    if (opt.fit) args.push('--fit', opt.fit);
    const ts = Date.now(), p = spawn('nice', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
    p.on('close', code=> {
      if (code === 0) done++; else failed++;
      log(`[${done + failed}/${todo.length}] ${j.id} seed ${j.seed}: ${code === 0 ? 'ok' : 'FAILED ' + code} ${((Date.now() - ts)/1000).toFixed(0)} s\n${txt.trim()}`);
      start();
    });
  };
  for (let i = 0; i < N; i++) start();
});
log(`${opt.tag}: ${done} done, ${failed} failed, ${((Date.now() - t0)/60000).toFixed(1)} min`);
