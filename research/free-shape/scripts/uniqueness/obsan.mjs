#!/usr/bin/env node
/* node obsan.mjs <tag>: for each pair (best, other minimum) of a run: Δ on the data, δ (the
   best's noise-free pattern refitted by the other: what a perfect pattern would tell
   apart), and obsDist (what the pattern sees of the two solids: their members' widths per
   d-spacing, rank-paired; no pattern evaluated). Rank correlations, and how well obsDist
   alone sorts pairs into δ < 4 against δ > 16. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from '../harness/lib.mjs';
import { obsDist } from './obs.mjs';
import { fmt, median } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'main', dir = path.join(HERE, 'results', tag);
const P = [];
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json') && !f.startsWith('score')).sort()){
  const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8')); if (!r.records || !r.records[0].kept) continue;
  const u = r.records[0].info.uniq; if (!u || !u.minima || u.minima.length < 2) continue;
  const c0 = u.minima[0].chi, comps = u.minima.filter(x=> (x.chi - c0)/u.nu0 <= 30).slice(0, 4);
  u.minima.slice(1).forEach(m=> {
    const j = comps.indexOf(m), delta = j > 0 && u.bootFree && u.bootFree[j] != null ? u.bootFree[j] - u.bootFree[0] : NaN;
    P.push({ run: `${r.case}#${r.seed}`, kind: r.kind, D: (m.chi - c0)/u.nu0, delta, obs: obsDist(m.solid, u.minima[0].solid) });
  });
}
const rank = xs => { const s = xs.map((x, i)=> [x, i]).sort((a, b)=> a[0] - b[0]), r = new Array(xs.length); s.forEach(([, i], k)=> { r[i] = k; }); return r; };
const spearman = (a, b) => { const ra = rank(a), rb = rank(b), n = a.length, ma = (n - 1)/2; let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++){ s += (ra[i] - ma)*(rb[i] - ma); sa += (ra[i] - ma)**2; sb += (rb[i] - ma)**2; } return s/Math.sqrt(sa*sb); };
const Q = P.filter(p=> Number.isFinite(p.delta));
console.log(`${P.length} pairs; ${Q.length} with δ`);
console.log(`Spearman(Δ, δ) ${fmt(spearman(Q.map(p=> p.D), Q.map(p=> p.delta)), 2)}; Spearman(obsDist, δ) ${fmt(spearman(Q.map(p=> p.obs), Q.map(p=> p.delta)), 2)}; Spearman(obsDist, Δ) ${fmt(spearman(P.map(p=> p.obs), P.map(p=> p.D)), 2)}`);
const lo = Q.filter(p=> p.delta < 4), hi = Q.filter(p=> p.delta > 16);
console.log(`δ < 4: ${lo.length} pairs, obsDist median ${fmt(median(lo.map(p=> p.obs)), 3)} (max ${fmt(Math.max(...lo.map(p=> p.obs)), 3)}); δ > 16: ${hi.length}, median ${fmt(median(hi.map(p=> p.obs)), 3)} (min ${fmt(Math.min(...hi.map(p=> p.obs)), 3)})`);
console.log(`Δ against δ: median |Δ − δ| ${fmt(median(Q.map(p=> Math.abs(p.D - p.delta))), 2)}; for δ < 30: ${Q.filter(p=> p.delta < 30).map(p=> `${fmt(p.D, 1)}/${fmt(p.delta, 1)}`).join(' ')}`);
fs.writeFileSync(path.join(HERE, 'results', `obs-${tag}.json`), JSON.stringify(P, null, 1));
