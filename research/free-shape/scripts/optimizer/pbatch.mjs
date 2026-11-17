#!/usr/bin/env node
/* node pbatch.mjs --tag <name> --method methods/v-x.mjs[,…] [--runs pilot|synth|sample|all|id:seed,…] [--jobs 2]
   batch.mjs for a list of (case, seed) runs: one process per run under nice -n 15, at
   most 2 at a time, results/<tag>/<case>-<seed>.json, skipped when present. The pilot set
   is PILOT below; 'robust' the pilot and the twelve sample-like runs (27). */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { CASES } from './h/cases.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
export const PILOT = ['box-plate110:1', 'box-plate110-t20:1', 'box-plate110-off8:2', 'box-needle111:1', 'box-ribbon001:1', 'box-plate111-big:1',
  'sqbox-plate110-t15:1', 'sqbox-plate-rand:1', 'ell-plate110:1', 'ell-ribbon-rand:1', 'sph-oblate-rand:1', 'cyl-disc111-off8:1',
  'ecyl-ribbon001:1', 'ecyl-rand:1', 'u03:1', 'u09:1', 'u10:1', 'iso-7:1'];
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag || !opt.method){ console.error('--tag <name> --method <files>'); process.exit(2); }
const sel = String(opt.runs || 'pilot');
const kinds = ['synth', 'sample', 'control', 'fixture'];
const ROBUST = [...PILOT, ...CASES.filter(c=> c.kind === 'sample').map(c=> `${c.id}:1`).filter(j=> !PILOT.includes(j))];
const jobs = sel === 'pilot' ? PILOT : sel === 'robust' ? ROBUST : sel === 'all' ? CASES.flatMap(c=> c.seeds.map(s=> `${c.id}:${s}`))
  : kinds.includes(sel) ? CASES.filter(c=> c.kind === sel).flatMap(c=> c.seeds.map(s=> `${c.id}:${s}`)) : sel.split(',');
const dir = path.join(HERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const N = Math.max(1, Math.min(2, +(opt.jobs || 2)));
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const todo = jobs.map(j=> { const [id, s] = j.split(':'); return { id, seed: +s }; }).filter(j=> !fs.existsSync(path.join(dir, `${j.id}-${j.seed}.json`)));
const methodArg = String(opt.method).split(',').map(f=> path.resolve(HERE, f)).join(',');
log(`${opt.tag}: ${todo.length} of ${jobs.length} runs, ${N} at a time; ${methodArg}`);
let next = 0, done = 0;
const t0 = Date.now();
await new Promise(resolve=> {
  const start = ()=> {
    if (next >= todo.length){ if (done === todo.length) resolve(); return; }
    const j = todo[next++], out = path.join(dir, `${j.id}-${j.seed}.json`);
    const args = ['-n', '15', process.execPath, path.join(HERE, 'h', 'run.mjs'), '--case', j.id, '--seed', String(j.seed), '--method', methodArg, '--out', out];
    if (opt.fit) args.push('--fit', opt.fit);
    const ts = Date.now(), p = spawn('nice', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
    p.on('close', code=> { done++; log(`[${done}/${todo.length}] ${j.id}:${j.seed} ${code === 0 ? 'ok' : 'FAILED ' + code} ${((Date.now() - ts)/1000).toFixed(0)} s\n${txt.trim()}`); start(); });
  };
  for (let i = 0; i < N; i++) start();
});
log(`${opt.tag}: done, ${((Date.now() - t0)/60000).toFixed(1)} min`);
