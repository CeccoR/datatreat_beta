#!/usr/bin/env node
/* Step 2's batches: one run.mjs a job, each in its own process under nice -n 15, at most 3 at a
   time, a timeout each, resumable (a job whose record exists is skipped; a record is written as
   .part and renamed when the run ends well). Validation rows are refused.
     node batch2.mjs <jobs file> [--jobs 3] [--timeout 3600]
   A job line: <tag> <harness dir> <line lsq|lor> <search v2|today> <fwd briefs|all> <profile lorentz|wppm>
   <wppm flags|-|default> <row> ('default': the variable unset, the engine copy's default; also for the others): PROTO_LINE, PROTO_SEARCH, PROTO_FWD, PROTO_PROFILE, PROTO_WPPM (step 2's
   WPPM_OPT: fast, pair, axial) for <harness dir>/run.mjs (h0: step 1's engine; h: step 2's).
   Records: results/<tag>/<row>.json; log: results/batch2.log. Jobs start in the file's order. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const a = process.argv.slice(2), opt = {};
for (let i = 1; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } }
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const jobs = fs.readFileSync(a[0], 'utf8').split('\n').map(l=> l.trim()).filter(l=> l && !l.startsWith('#')).map(l=>{
  const [tag, hdir, line, search, fwd, profile, wppm, row] = l.split(/\s+/);
  const r = design.rows.find(x=> x.id === row);
  if (!r) throw new Error('no row ' + row);
  if (r.split === 'validation') throw new Error('validation row refused: ' + row);
  return { tag, hdir, line, search, fwd, profile, wppm: wppm === '-' ? '' : wppm, row, out: path.join(HERE, 'results', tag, row + '.json') };
});
const N = Math.max(1, Math.min(3, +(opt.jobs || 3))), tmo = +(opt.timeout || 3600)*1000;
const logf = path.join(HERE, 'results', 'batch2.log'); fs.mkdirSync(path.dirname(logf), { recursive: true });
const log = t => { const s = `${new Date().toISOString()} ${t}`; fs.appendFileSync(logf, s + '\n'); console.log(s); };
const todo = jobs.filter(j=> !fs.existsSync(j.out));
log(`${a[0]}: ${todo.length} of ${jobs.length} to do, ${N} at a time, timeout ${tmo/1000} s`);
let next = 0, fin = 0;
await new Promise(resolve=>{
  if (!todo.length) return resolve();
  const start = ()=>{
    if (next >= todo.length){ if (fin === todo.length) resolve(); return; }
    const j = todo[next++];
    fs.mkdirSync(path.dirname(j.out), { recursive: true });
    const env = { ...process.env, PROTO_LINE: j.line, PROTO_SEARCH: j.search, PROTO_FWD: j.fwd, PROTO_PROFILE: j.profile, PROTO_WPPM: j.wppm };
    if (j.wppm === 'default') delete env.PROTO_WPPM;   // (the engine copy's own defaults)
    for (const k of ['PROTO_LINE', 'PROTO_SEARCH', 'PROTO_FWD', 'PROTO_PROFILE']) if (env[k] === 'default') delete env[k];
    const ts = Date.now(), p = spawn('nice', ['-n', '15', process.execPath, path.join(HERE, j.hdir, 'run.mjs'), '--row', j.row, '--method', process.env.CK_METHOD || 'proto', '--out', j.out + '.part'], { stdio: ['ignore', 'pipe', 'pipe'], env });
    const kill = setTimeout(()=> p.kill('SIGKILL'), tmo);
    let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
    p.on('close', code=>{
      clearTimeout(kill); fin++;
      const ok = code === 0 && fs.existsSync(j.out + '.part');
      if (ok) fs.renameSync(j.out + '.part', j.out);
      log(`[${fin}/${todo.length}] ${j.tag} ${j.row}: ${ok ? 'ok' : 'FAILED ' + code} ${((Date.now() - ts)/1000).toFixed(0)} s\n${txt.trim()}`);
      start();
    });
  };
  for (let i = 0; i < N; i++) start();
});
log('done');
