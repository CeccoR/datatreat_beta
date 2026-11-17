#!/usr/bin/env node
/* Step 5's batches (step 4's batch2.mjs, simplified): one run.mjs a job, nice -n 15, at most 3 at a
   time, a timeout each, resumable (a record that exists is skipped; written as .part, renamed when the
   run ends well). Rows come from design5.json; a row of the validation part is refused.
     node batch5.mjs <jobs file> [--jobs 3] [--timeout 1800]
   A job line: <tag> <row key> <shape|-> <K=V,...|-> (the job's environment: KEEP_SET with ';' for its
   own commas, MIN_OFF, MIN_SET, CK_OFF, FAM_REPORT). Records: results/<tag>/<key>[.<shape>].json. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {};
for (let i = 1; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, 'design5.json'), 'utf8'));
const jobs = fs.readFileSync(a[0], 'utf8').split('\n').map(l=> l.trim()).filter(l=> l && !l.startsWith('#')).map(l=>{
  const [tag, key, shape, extra] = l.split(/\s+/);
  const r = design.rows.find(x=> x.key === key);
  if (!r) throw new Error('no row ' + key);
  if (r.split !== 'tuning') throw new Error('not a tuning row: ' + key);
  const xenv = Object.fromEntries((extra && extra !== '-' ? extra : '').split(',').filter(Boolean).map(kv=> { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1).replace(/;/g, ',')]; }));
  const sh = shape && shape !== '-' ? shape : null;
  return { tag, key, shape: sh, xenv, out: path.join(HERE, 'results', tag, key + (sh ? '.' + sh : '') + '.json') };
});
const N = Math.max(1, Math.min(3, +(opt.jobs || 3))), tmo = +(opt.timeout || 1800)*1000;
const logf = path.join(HERE, 'results', 'batch5.log'); fs.mkdirSync(path.dirname(logf), { recursive: true });
const log = t => { const s = `${new Date().toISOString()} ${t}`; fs.appendFileSync(logf, s + '\n'); console.log(s); };
const todo = jobs.filter(j=> !fs.existsSync(j.out));
log(`${a[0]}: ${jobs.length} jobs, ${todo.length} to run, ${N} at a time`);
let next = 0, running = 0, ok = 0, bad = 0;
await new Promise(done=> {
  const launch = () => {
    while (running < N && next < todo.length){
      const j = todo[next++]; running++;
      fs.mkdirSync(path.dirname(j.out), { recursive: true });
      const args = ['-n', '15', 'node', path.join(HERE, 'run.mjs'), '--design', path.join(HERE, 'design5.json'), '--row', j.key, '--method', j.xenv.METHOD || 'fam', '--nolog', '--quiet', '--out', j.out + '.part', ...(j.shape ? ['--shape', j.shape] : [])];
      const t0 = Date.now(), p = spawn('nice', args, { cwd: HERE, env: { ...process.env, ...j.xenv }, stdio: ['ignore', 'ignore', 'pipe'] });
      let err = ''; p.stderr.on('data', d=> { err += d; });
      const timer = setTimeout(()=> { p.kill('SIGKILL'); }, tmo);
      p.on('close', code=> {
        clearTimeout(timer); running--;
        if (code === 0 && fs.existsSync(j.out + '.part')){ fs.renameSync(j.out + '.part', j.out); ok++; log(`ok ${j.tag} ${j.key} ${j.shape || ''} ${((Date.now() - t0)/1000).toFixed(0)} s`); }
        else { bad++; log(`FAILED ${j.tag} ${j.key} ${j.shape || ''} code ${code}: ${err.split('\n').slice(-4).join(' | ')}`); }
        if (next >= todo.length && running === 0) done(); else launch();
      });
    }
    if (todo.length === 0) done();
  };
  launch();
});
log(`${a[0]}: done, ${ok} ok, ${bad} failed`);
