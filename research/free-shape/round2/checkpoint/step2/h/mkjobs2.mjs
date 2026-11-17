// mkjobs2.mjs <rows file|screen> <variant,...>: jobs for batch2.mjs, rows longest first (by step 1's WPPM
// record: CPU of the fit), each row's variants next to each other in a rotating order (one load).
// Variants: T (today: lor, today's search, step 1's engine), W0 (WPPM v2, step 1's engine), W1 (WPPM v2,
// step 2's engine, defaults), W3 (… pair), W4 (… pair,axial), W5 (… fast,axial), L1 (lsq v2, step 2's engine),
// or name=hdir:line:search:fwd:profile:flags.
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const [rowsArg, vs] = process.argv.slice(2);
const design = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const rows = rowsArg === 'screen' ? design.rows.filter(r=> r.screen && r.split !== 'validation').map(r=> r.id)
  : fs.readFileSync(rowsArg, 'utf8').split('\n').filter(l=> l.trim() && !l.startsWith('#')).map(l=> l.split(/\s+/)[0]);
const V = { T: 'h0 lor today briefs lorentz -', W0: 'h0 lsq v2 briefs wppm -', W1: 'h2 lsq v2 briefs wppm -', W3: 'h2 lsq v2 briefs wppm pair',
  W4: 'h2 lsq v2 briefs wppm pair,axial', W5: 'h2 lsq v2 briefs wppm fast,axial', L1: 'h2 lsq v2 briefs lorentz -' };
const vars = vs.split(',').map(v=> { const [n, d] = v.split('='); return [n, d ? d.split(':').join(' ') : V[n]]; });
const cost = id => { try { return JSON.parse(fs.readFileSync(path.join(FS2, 'step1', 'h', 'results', 'v2b-wppm', id + '.json'), 'utf8')).cpu.fitMs; } catch(e){ return 0; } };
rows.sort((a, b)=> cost(b) - cost(a));
rows.forEach((id, i)=> { for (let k = 0; k < vars.length; k++){ const [n, d] = vars[(i + k) % vars.length]; console.log(`${n} ${d} ${id}`); } });
