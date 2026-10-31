#!/usr/bin/env node
/* Step 5's rows (design5.json), all from the tuning part (validation rows are never read):
   - every tuning row as it is (key = id);
   - fresh noise draws of the 22 tuning spheres: key <id>~d<k>, k = 1..K (default 4), the seed moved
     (the noise and, on error rows, the error's own draws are new);
   - mild shapes: each tuning truth outside the screening set, its extents pulled towards their
     geometric mean, D_i' = g·(D_i/g)^s, so that the largest over the smallest is r, log-uniform in
     [1.02, 1.6] (seeded by the key); key <id>~m<k>, k = 1, 2, and 3, 4 for the ellipsoids and
     spheroids; a new seed for the noise. The error, counts, orientation, phase are the truth's.
   node mkdesign5.mjs [--draws 4] */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), FS2 = path.resolve(HERE, '..', '..');
const a = process.argv.slice(2), opt = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[++i];
const D = JSON.parse(fs.readFileSync(path.join(FS2, 'design', 'design.json'), 'utf8'));
const T = D.rows.filter(r=> r.split === 'tuning');   // the tuning part only
const K = +(opt.draws || 4);
const hash = s => { let h = 2166136261; for (const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const unif = key => { let x = hash(key); x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x/4294967296; };
const rows = T.map(r=> ({ ...r, key: r.id }));
for (const r of T.filter(r=> r.solid === 'sphere')) for (let k = 1; k <= K; k++) rows.push({ ...r, key: `${r.id}~d${k}`, seed: (r.seed + k*7919) >>> 0, draw: k, from: r.id });
for (const r of T.filter(r=> r.kind === 'truth' && !r.screen)){
  const n = ['ellipsoid', 'spheroid'].includes(r.solid) ? 4 : 2;
  for (let k = 1; k <= n; k++){
    const key = `${r.id}~m${k}`, rt = Math.exp(Math.log(1.02) + unif(key)*(Math.log(1.6) - Math.log(1.02)));
    const g = Math.exp(r.dims.reduce((t, d)=> t + Math.log(d), 0)/3), an = Math.log(Math.max(...r.dims)/Math.min(...r.dims)), s = an > 0 ? Math.log(rt)/an : 1;
    rows.push({ ...r, key, dims: r.dims.map(d=> g*Math.pow(d/g, s)), ratios: undefined, seed: (r.seed + 104729*k) >>> 0, mild: { r: rt, s, dims0: r.dims }, from: r.id });
  }
}
fs.writeFileSync(path.join(HERE, 'design5.json'), JSON.stringify({ version: D.version + '+step5', rows }));
console.log(rows.length, 'rows:', T.length, 'tuning,', rows.filter(r=> r.draw).length, 'sphere draws,', rows.filter(r=> r.mild).length, 'mild');
