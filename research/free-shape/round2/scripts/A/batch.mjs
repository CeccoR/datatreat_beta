#!/usr/bin/env node
/* Track A's batches (../pilot/batch.mjs adapted): run.mjs of this folder once per row (and
   solid), each in its own process under nice -n 15, at most 2 at a time, resumable.
   node batch.mjs --tag <name> --rows subscreen|subclean|screen|spheres|id,id [--line lor|ib|mom|lsq]
     [--profile lorentz|wppm] [--tables file] [--method today,truth] [--shapes all|box,...] [--jobs 2]
     [--timeout s] [--kernel exact|none]
   - subscreen: the 22 rows of subscreen.txt; subclean: its 11 clean rows; screen: the 77;
     spheres: the screening set's 11 spheres.
   - --shapes: each row searched as each of these solids (cross-solid fits): results
     <row>.<solid>.json; else <row>.json.
   Validation rows are refused. Results: results/<tag>/, log results/<tag>/batch.log. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
if (!opt.tag){ console.error('--tag <name>'); process.exit(2); }
const designFile = path.resolve(path.join(HERE, '..', 'design', 'design.json'));
const design = JSON.parse(fs.readFileSync(designFile, 'utf8'));
const dir = path.join(HERE, 'results', opt.tag); fs.mkdirSync(dir, { recursive: true });
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/));
const sel = String(opt.rows || 'subscreen');
const byId = id => design.rows.find(r=> r.id === id) || (()=> { throw new Error('no row ' + id); })();
const rows = sel === 'subscreen' ? sub.map(s=> byId(s[0])) : sel === 'subclean' ? sub.filter(s=> s[4] === 'none').map(s=> byId(s[0]))
  : sel === 'screen' ? design.rows.filter(r=> r.screen) : sel === 'spheres' ? design.rows.filter(r=> r.screen && r.kind === 'sphere')
  : sel.split(',').map(byId);
if (rows.some(r=> r.split === 'validation')){ console.error('validation rows are scored once, on the final version: refused'); process.exit(2); }
const SOLIDS = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
const shapes = opt.shapes ? (opt.shapes === 'all' ? SOLIDS : String(opt.shapes).split(',')) : [null];
const jobs = rows.flatMap(r=> shapes.map(s=> ({ r, s, out: path.join(dir, `${r.id}${s ? '.' + s : ''}.json`) })));
const N = Math.max(1, Math.min(2, +(opt.jobs || 2)));
const env = { ...process.env };
if (opt.line) env.FS2A_LINE = opt.line;
if (opt.profile) env.FS2A_PROFILE = opt.profile;
if (opt.tables) env.FS2A_TABLES = path.resolve(opt.tables);
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'batch.log'), line + '\n'); console.log(line); };
const todo = jobs.filter(j=> !fs.existsSync(j.out));
const pass = ['method', 'kernel'].filter(k=> opt[k] != null).flatMap(k=> ['--' + k, String(opt[k])]);
log(`${opt.tag}: ${todo.length} of ${jobs.length} runs to do (${sel}${opt.shapes ? ' × ' + shapes.join(',') : ''}), ${N} at a time; line ${env.FS2A_LINE || 'lor'}, profile ${env.FS2A_PROFILE || 'lorentz'}${env.FS2A_TABLES ? ', tables ' + env.FS2A_TABLES : ''}; ${pass.join(' ') || 'methods today,truth'}`);
let next = 0, done = 0, failed = 0;
const t0 = Date.now(), tmo = +(opt.timeout || 3600)*1000;
await new Promise(resolve=> {
  if (!todo.length) return resolve();
  const start = ()=> {
    if (next >= todo.length){ if (done + failed === todo.length) resolve(); return; }
    const j = todo[next++];
    const args = ['-n', '15', process.execPath, path.join(HERE, 'run.mjs'), '--row', j.r.id, '--out', j.out + '.part', ...(j.s ? ['--shape', j.s] : []), ...pass];
    const ts = Date.now(), p = spawn('nice', args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    const kill = setTimeout(()=> p.kill('SIGKILL'), tmo);
    let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
    p.on('close', code=> {
      clearTimeout(kill);
      if (code === 0 && fs.existsSync(j.out + '.part')){ fs.renameSync(j.out + '.part', j.out); done++; } else failed++;
      log(`[${done + failed}/${todo.length}] ${j.r.id}${j.s ? ' as ' + j.s : ''}: ${code === 0 ? 'ok' : 'FAILED ' + code} ${((Date.now() - ts)/1000).toFixed(0)} s\n${txt.trim()}`);
      start();
    });
  };
  for (let i = 0; i < N; i++) start();
});
log(`${opt.tag}: ${done} done, ${failed} failed, ${((Date.now() - t0)/60000).toFixed(1)} min`);
