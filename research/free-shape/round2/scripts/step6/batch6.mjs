#!/usr/bin/env node
/* Step 6's batches: one run a job, nice -n 15, at most 3 at a time, a timeout each, resumable (a record that
   exists is skipped; written as .part, renamed when the run ends well).
     node batch6.mjs <jobs file> [--jobs 3] [--timeout 2400] [--validation]
   The jobs file is read again whenever a slot frees, so jobs can be added or put first while it runs.
   A job line: <tag> <row> <p|t> <K=V,...|->
   - p: the prototype (h/run.mjs, methods p6 and truth: the run, then the solid refined from the truth as
     the reference of the same line); the row from fs2/design/design.json, else (a derived row, by its key)
     h/design5.json. K=V: the job's environment (MIN_SET, KEEP_SET, FAMILY_SET, CHECK_SET, PROTO_FILL,
     PROTO_Y0F; ';' for a value's own commas).
   - t: today's search (fs2/pilot/run.mjs on the frozen b9bef5f engine, methods today and truth).
   Validation rows are refused unless --validation is given and FROZEN.json exists (h/run.mjs checks the
   engine against it too). Records: results/<tag>/<row>.json. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..');
const a = process.argv.slice(2), opt = {};
for (let i = 1; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const D = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const D5 = JSON.parse(fs.readFileSync(path.join(HERE, 'h', 'design5.json'), 'utf8'));
const parse = () => fs.readFileSync(a[0], 'utf8').split('\n').map(l=> l.trim()).filter(l=> l && !l.startsWith('#')).map(l=>{
  const [tag, key, h, extra] = l.split(/\s+/);
  const r0 = D.rows.find(x=> x.id === key), r = r0 || D5.rows.find(x=> x.key === key);
  if (!r) throw new Error('no row ' + key);
  if (r.split === 'validation' && !(opt.validation && fs.existsSync(path.join(HERE, 'FROZEN.json')))) throw new Error('a validation row before the freeze: ' + key);
  if (h !== 'p' && h !== 't') throw new Error('harness p or t: ' + l);
  const xenv = Object.fromEntries((extra && extra !== '-' ? extra : '').split(',').filter(Boolean).map(kv=> { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1).replace(/;/g, ',')]; }));
  if (r.split === 'validation') xenv.STEP6_VALIDATION = '1';
  return { tag, key, h, xenv, design: r0 ? path.join(FS2, 'design', 'design.json') : path.join(HERE, 'h', 'design5.json'), out: path.join(HERE, 'results', tag, key + '.json') };
});
// the jobs file is read again whenever a slot frees: jobs may be added or reordered while it runs
const jobs = parse(), started = new Set();
const N = Math.max(1, Math.min(3, +(opt.jobs || 3))), tmo = +(opt.timeout || 2400)*1000;
const logf = path.join(HERE, 'results', 'batch6.log'); fs.mkdirSync(path.dirname(logf), { recursive: true });
const log = t => { const s = `${new Date().toISOString()} ${t}`; fs.appendFileSync(logf, s + '\n'); console.log(s); };
const pending = () => { let J; try { J = parse(); } catch(e){ log('jobs file unreadable, kept: ' + e.message); J = jobs; } return J.filter(j=> !started.has(j.out) && !fs.existsSync(j.out)); };
log(`${a[0]}: ${jobs.length} jobs, ${pending().length} to run, ${N} at a time`);
let running = 0, ok = 0, bad = 0;
await new Promise(done=> {
  const launch = () => {
    let todo = pending();
    while (running < N && todo.length){
      const j = todo.shift(); running++; started.add(j.out);
      fs.mkdirSync(path.dirname(j.out), { recursive: true });
      const args = j.h === 'p'
        ? ['-n', '15', process.execPath, path.join(HERE, 'h', 'run.mjs'), '--design', j.design, '--row', j.key, '--method', 'p6,truth', '--quiet', '--out', j.out + '.part']
        : ['-n', '15', process.execPath, path.join(FS2, 'pilot', 'run.mjs'), '--row', j.key, '--quiet', '--out', j.out + '.part'];
      const t0 = Date.now(), p = spawn('nice', args, { cwd: j.h === 'p' ? path.join(HERE, 'h') : path.join(FS2, 'pilot'), env: { ...process.env, ...j.xenv }, stdio: ['ignore', 'ignore', 'pipe'] });
      let err = ''; p.stderr.on('data', d=> { err += d; });
      const timer = setTimeout(()=> { p.kill('SIGKILL'); }, tmo);
      p.on('close', code=> {
        clearTimeout(timer); running--;
        if (code === 0 && fs.existsSync(j.out + '.part')){ fs.renameSync(j.out + '.part', j.out); ok++; log(`ok ${j.tag} ${j.key} ${j.h} ${((Date.now() - t0)/1000).toFixed(0)} s`); }
        else { bad++; log(`FAILED ${j.tag} ${j.key} ${j.h} code ${code}: ${err.split('\n').slice(-4).join(' | ')}`); }
        launch();
      });
    }
    if (running === 0 && !todo.length) done();
  };
  launch();
});
log(`${a[0]}: done, ${ok} ok, ${bad} failed`);
