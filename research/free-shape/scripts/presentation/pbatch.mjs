#!/usr/bin/env node
/* node pbatch.mjs --tag <name> --method methods/xc.mjs --list jobs.txt [--jobs 2]
   jobs.txt: one "case seed shape" per line. One run.mjs process per job under nice -n 15,
   at most 2 at a time; results/<tag>/<case>-<seed>-<shape>.json, skipped when present. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), HARN = path.join(HERE, '..', 'harness');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const dir = path.join(HERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const jobs = fs.readFileSync(opt.list, 'utf8').split('\n').map(l=> l.trim().split(/\s+/)).filter(x=> x[0]).map(([id, s, shape])=> ({ id, seed: +s, shape }));
const N = Math.max(1, Math.min(2, +(opt.jobs || 2)));
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const outOf = j => path.join(dir, `${j.id}-${j.seed}-${j.shape}.json`);
const todo = jobs.filter(j=> !fs.existsSync(outOf(j)));
log(`${opt.tag}: ${todo.length} of ${jobs.length} to do, ${N} at a time; ${opt.method}`);
const method = path.resolve(HERE, opt.method);
let next = 0, fin = 0; const t0 = Date.now();
await new Promise(resolve=> {
  const start = ()=> {
    if (next >= todo.length){ if (fin === todo.length) resolve(); return; }
    const j = todo[next++], ts = Date.now();
    const p = spawn('nice', ['-n', '15', process.execPath, path.join(HARN, 'run.mjs'), '--case', j.id, '--seed', String(j.seed), '--shape', j.shape, '--method', method, '--out', outOf(j)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
    p.on('close', code=> { fin++; log(`[${fin}/${todo.length}] ${j.id} ${j.seed} ${j.shape}: ${code === 0 ? 'ok' : 'FAILED ' + code} ${Math.round((Date.now() - ts)/1000)} s\n${txt.trim()}`); start(); if (fin === todo.length) resolve(); });
  };
  for (let i = 0; i < N; i++) start();
});
log(`done in ${((Date.now() - t0)/60000).toFixed(1)} min`);
