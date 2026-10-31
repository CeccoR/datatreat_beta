#!/usr/bin/env node
/* Step 4: does the free minimum depend on the random turn? The same rows with the search's turns seeded
   three ways (S1: v522's seed; T1, T2: PROTO_TURNSEED 12345, 777), the stage on. Per row, over the
   three: the spread of the search's own free fit (minimaStage.before, today) and of the stage's lowest
   minimum (after), in χ²_ν; and of the returned fit: its outcome, the largest relative difference of
   its extents and of its principal axis's angle (modulo the class). node turn4.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, laueRotations } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const rd = (t, f) => { const p = path.join(HERE, 'results', t, f); return fs.existsSync(p) ? readResult(fs.readFileSync(p, 'utf8')) : null; };
const TAGS = process.env.TAGS ? process.env.TAGS.split(',') : ['S1', 'T1', 'T2'];   // node turn4.mjs, or TAGS=S2,U1,U2
const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const L = ['| row | today: free χ² spread (χ²_ν) | stage: lowest χ² spread | outcomes | extents, largest difference | axis, largest angle |', '|---|---|---|---|---|---|'];
for (const fn of fs.readdirSync(path.join(HERE, 'results', TAGS[1])).filter(x=> x.endsWith('.json'))){
  const O = TAGS.map(t=> rd(t, fn)).filter(Boolean); if (O.length < 3) continue;
  const R = O.map(o=> o.records[0]), nu = Math.max(1, R[0].chi2nu), st = R.map(r=> r.info && r.info.minimaStage);
  const spread = a => (Math.max(...a) - Math.min(...a))/nu;
  const today = st.every(Boolean) ? spread(st.map(s=> s.before)) : NaN, stage = st.every(Boolean) ? spread(st.map(s=> s.after)) : NaN;
  const oc = R.map(r=> r.kept ? (r.held ? 'held' : 'free') : 'rej');
  let dd = 0, da = 0;
  if (R.every(r=> r.kept)) for (let i = 1; i < 3; i++){ const c = compareSolids(R[i].solid, { ...R[0].solid }, { rots: laueRotations(O[0].phase) }); dd = Math.max(dd, c.dimMax); da = Math.max(da, c.principal || 0); }
  L.push(`| ${O[0].row} | ${f(today)} | ${f(stage)} | ${oc.join(', ')} | ${f(100*dd, 1)} % | ${f(da, 1)}° |`);
}
console.log(L.join('\n'));
