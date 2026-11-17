#!/usr/bin/env node
/* The harness's batch.mjs, writing into fs/starts/results/<tag> (and the methods' side
   records into results/<tag>/side.jsonl through WS_SIDE). Same options:
   node batch.mjs --tag t --method methods/a.mjs,../harness/methods/truth.mjs [--cases ...] [--seeds 1] [--jobs 2] */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CASES } from '../harness/cases.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname), HARNESS = path.resolve(HERE, '..', 'harness');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag){ console.error('--tag <name>'); process.exit(2); }
const dir = path.join(HERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const sel = String(opt.cases || 'all'), kinds = ['synth', 'sample', 'control', 'fixture'];
const cases = sel === 'all' ? CASES : kinds.includes(sel) ? CASES.filter(c=> c.kind === sel) : sel.split(',').flatMap(id=> kinds.includes(id) ? CASES.filter(c=> c.kind === id) : [CASES.find(c=> c.id === id) || (()=> { throw new Error('no case ' + id); })()]);
const seeds = opt.seeds ? String(opt.seeds).split(',').map(Number) : null;
// --seeds limits the cases with several realisations (synthetic, controls); the others keep theirs
const jobs = []; for (const c of cases) for (const s of (seeds && c.seeds.length > 1 ? seeds.filter(s=> c.seeds.includes(s)) : c.seeds)) jobs.push({ id: c.id, seed: s });
const N = Math.max(1, Math.min(2, +(opt.jobs || 2)));
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const todo = jobs.filter(j=> !fs.existsSync(path.join(dir, `${j.id}-${j.seed}.json`)));
log(`${opt.tag}: ${todo.length} of ${jobs.length} runs to do, ${N} at a time; method ${opt.method}`);
const methodArg = String(opt.method).split(',').map(f=> path.resolve(HERE, f)).join(',');
const env = { ...process.env, WS_SIDE: path.join(dir, 'side.jsonl') };
let next = 0, done = 0, failed = 0;
const t0 = Date.now();
await new Promise(resolve=> {
  const start = ()=> {
    if (next >= todo.length){ if (done + failed === todo.length) resolve(); return; }
    const j = todo[next++], out = path.join(dir, `${j.id}-${j.seed}.json`);
    const args = ['-n', '15', process.execPath, path.join(HARNESS, 'run.mjs'), '--case', j.id, '--seed', String(j.seed), '--method', methodArg, '--out', out];
    if (opt.shape) args.push('--shape', opt.shape);
    if (opt.fit) args.push('--fit', opt.fit);
    if (opt.nolog) args.push('--nolog');
    const ts = Date.now(), p = spawn('nice', args, { stdio: ['ignore', 'pipe', 'pipe'], env });
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
