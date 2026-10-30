#!/usr/bin/env node
/* [fix] The cost of a run under one load: each row of the list run with every mode in turn (the order
   rotated row by row), two rows at a time, each run in its own process under nice -n 15 with
   --method today (isotropic fit + search + report); run.mjs records the fit's CPU time (out.cpu,
   iso + methods, the draw left out) beside the stages' wall times. Resumable; refuses validation rows.
   node fix/time.mjs [--rows subscreen|id,id] [--modes lor,lsq,mom,wppm] [--tag time] [--timeout 2400] */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/)[0]);
const ids = !opt.rows || opt.rows === 'subscreen' ? sub : String(opt.rows).split(',');
const rows = ids.map(id=> design.rows.find(r=> r.id === id));
if (rows.some(r=> !r || r.split === 'validation')){ console.error('unknown or validation row: refused'); process.exit(2); }
const MODES = { lor: {}, lsq: { FS2A_LINE: 'lsq' }, mom: { FS2A_LINE: 'mom' }, wppm: { FS2A_PROFILE: 'wppm' }, ib: { FS2A_LINE: 'ib' } };
const modes = String(opt.modes || 'lor,lsq,mom,wppm').split(',');
const tag = opt.tag || 'time', dir = path.join(HERE, 'results', tag), tmo = +(opt.timeout || 2400)*1000;
for (const m of modes) fs.mkdirSync(path.join(dir, m), { recursive: true });
const log = t => { const line = `${new Date().toISOString()} ${t}`; fs.appendFileSync(path.join(dir, 'time.log'), line + '\n'); console.log(line); };
const runOne = (r, m) => new Promise(res=> {
  const out = path.join(dir, m, r.id + '.json');
  if (fs.existsSync(out)) return res();
  const env = { ...process.env, ...MODES[m] };
  const p = spawn('nice', ['-n', '15', process.execPath, path.join(HERE, 'run.mjs'), '--row', r.id, '--method', 'today', '--out', out + '.part', '--nolog'], { stdio: ['ignore', 'pipe', 'pipe'], env });
  const kill = setTimeout(()=> p.kill('SIGKILL'), tmo), ts = Date.now();
  let txt = ''; p.stdout.on('data', d=> { txt += d; }); p.stderr.on('data', d=> { txt += d; });
  p.on('close', code=> { clearTimeout(kill); if (code === 0 && fs.existsSync(out + '.part')) fs.renameSync(out + '.part', out); log(`${r.id} ${m}: ${code === 0 ? 'ok' : 'FAILED ' + code} ${((Date.now() - ts)/1000).toFixed(0)} s\n${txt.trim()}`); res(); });
});
let next = 0;
const worker = async ()=> { while (next < rows.length){ const i = next++, r = rows[i]; const ord = modes.map((_, k)=> modes[(k + i) % modes.length]); for (const m of ord) await runOne(r, m); } };
log(`${tag}: ${rows.length} rows × ${modes.join(',')}, 2 at a time`);
const t0 = Date.now();
await Promise.all([worker(), worker()]);
log(`${tag}: done, ${((Date.now() - t0)/60000).toFixed(1)} min`);
