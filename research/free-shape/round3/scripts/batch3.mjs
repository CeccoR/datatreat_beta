#!/usr/bin/env node
/* Round 3's batches (step 6's batch6.mjs): one run a job, nice -n 15, at most 3 at a time, a timeout each,
   resumable (a record that exists is skipped; written as .part, renamed when the run ends well).
     node batch3.mjs <jobs file> [--jobs 3] [--timeout 2400] [--validation]
   A job line: <tag> <row> <p|q> <K=V,...|->: p round 3's prototype (h/run.mjs), q round 2's frozen engine
   (h2/run.mjs); both run the method p3 then truth (the solid refined from the truth, the reach's
   reference); rows from design/design.json (round 3's design). K=V: the job's environment (MIN_SET,
   ANGLE_SET, TARGET_SET, KEEP_SET, CHECK_SET, PROTO_FILL; ';' for a value's own commas). Validation rows
   are refused unless --validation is given and FROZEN3.json exists (run.mjs checks the engine copies
   against FROZEN3.json and FROZEN-r2.json too). Records: results/<tag>/<row>.json. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..');
const a = process.argv.slice(2), opt = {};
for (let i = 1; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const DF = path.join(HERE, 'design', 'design.json'), D = JSON.parse(fs.readFileSync(DF, 'utf8'));
const parse = () => fs.readFileSync(a[0], 'utf8').split('\n').map(l=> l.trim()).filter(l=> l && !l.startsWith('#')).map(l=>{
  const [tag, key, h, extra] = l.split(/\s+/);
  const r = D.rows.find(x=> x.id === key);
  if (!r) throw new Error('no row ' + key);
  if (r.split === 'validation' && !(opt.validation && fs.existsSync(path.join(HERE, 'FROZEN3.json')))) throw new Error('a validation row before the freeze: ' + key);
  if (h !== 'p' && h !== 'q') throw new Error('harness p or q: ' + l);
  const xenv = Object.fromEntries((extra && extra !== '-' ? extra : '').split(',').filter(Boolean).map(kv=> { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1).replace(/;/g, ',')]; }));
  if (r.split === 'validation') xenv.R3_VALIDATION = '1';
  return { tag, key, h, xenv, design: DF, out: path.join(HERE, 'results', tag, key + '.json') };
});
// the jobs file is read again whenever a slot frees: jobs may be added or reordered while it runs
const jobs = parse(), started = new Set();
const N = Math.max(1, Math.min(3, +(opt.jobs || 3))), tmo = +(opt.timeout || 2400)*1000;
const logf = path.join(HERE, 'results', 'batch3.log'); fs.mkdirSync(path.dirname(logf), { recursive: true });
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
      const hd = path.join(HERE, j.h === 'p' ? 'h' : 'h2');
      const args = ['-n', '15', process.execPath, path.join(hd, 'run.mjs'), '--design', j.design, '--row', j.key, '--method', 'p3,truth', '--quiet', '--out', j.out + '.part'];
      const t0 = Date.now(), p = spawn('nice', args, { cwd: hd, env: { ...process.env, ...j.xenv }, stdio: ['ignore', 'ignore', 'pipe'] });
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
