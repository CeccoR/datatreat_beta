#!/usr/bin/env node
/* node batch.mjs --tag <name> --rows sub|screen|id,id --method a,b [--jobs 2]
   run.mjs once per row (all the methods in one process, from one isotropic fit), each under
   nice -n 15, --jobs at a time (at most 2). Writes results/<tag>/<row>.json, skips those
   already there (resumable), logs to results/<tag>/batch.log. Validation rows are refused. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag || !opt.method){ console.error('--tag <name> --method a,b'); process.exit(2); }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.split('\t')[0]);
const sel = String(opt.rows || 'sub');
const ids = sel === 'sub' ? sub : sel === 'screen' ? design.rows.filter(r=> r.screen).map(r=> r.id) : sel.split(',');
const rows = ids.map(id=> design.rows.find(r=> r.id === id) || (()=> { throw new Error('no row ' + id); })());
if (rows.some(r=> r.split === 'validation')){ console.error('validation rows are scored once, on the final version: refused'); process.exit(2); }
// the dearest first, so that the two processes end together (today's search s, pilot)
const cost = id => { try { const o = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'pilot', 'results', 'screen', id + '.json'), 'utf8')); return o.stages.today.search.ms + o.stages.iso.ms; } catch(e){ return 0; } };
rows.sort((p, q)=> cost(q.id) - cost(p.id));
const N = Math.max(1, Math.min(2, +(opt.jobs || 2)));
const dir = path.join(HERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const todo = rows.filter(r=> !fs.existsSync(path.join(dir, `${r.id}.json`)));
log(`${opt.tag}: ${todo.length} of ${rows.length} runs to do (${sel}), ${N} at a time; methods ${opt.method}`);
let next = 0, done = 0, failed = 0;
const t0 = Date.now();
await new Promise(resolve=> {
  if (!todo.length) return resolve();
  const start = ()=> {
    if (next >= todo.length){ if (done + failed === todo.length) resolve(); return; }
    const r = todo[next++], out = path.join(dir, `${r.id}.json`);
    const args = ['-n', '15', process.execPath, path.join(HERE, 'run.mjs'), '--row', r.id, '--method', opt.method, '--out', out];
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
