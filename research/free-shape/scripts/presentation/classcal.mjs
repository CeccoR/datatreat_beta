#!/usr/bin/env node
/* node classcal.mjs: what ΔBIC between solids tells. On every run with the six solids
   searched (seed 1: the synthetic truths, each searched as its own solid by the app's search
   and as the other five by xclass; the 12 proxies, truth a box), the truth's solid's ΔBIC
   against the best solid. Its quantiles calibrate a threshold τ: a solid more than τ above the
   best is ruled out. Per τ: the truth's solid kept (not ruled out), the solids kept (median),
   the runs where one solid alone is kept, and how often the solids ruled out include every
   body of revolution (spheroid, cylinder: "the section is not round") or every square-based
   or round-sectioned one ("the lateral extents differ"), and whether that statement is true
   of the truth. */
import fs from 'node:fs';
import path from 'node:path';
import { loadRun, CASES, quantile, median, fmt, pct, HERE, Lprin } from './plib.mjs';
import { classFits } from './approaches.mjs';
const rows = [];
for (const c of CASES.filter(c=> c.kind === 'synth' || c.kind === 'sample')){
  const R = loadRun(c.id, 1);
  if (!R.base || !R.uq || Object.keys(R.xc).length < 5) continue;
  const cf = classFits(R); if (!cf.fits || !cf.fits.length) continue;
  const by = Object.fromEntries(cf.fits.map(f=> [f.type, f.dBIC]));
  for (const f of cf.rejected || []) by[f.type] = Infinity;          // a solid rejected against one size
  const T = R.truth, L = T ? Lprin(T).slice().sort((a, b)=> a - b) : null;
  // truth's facts: is the section across its most distinct axis round-like (two extents within 10 %)?
  const twoEqual = L ? (L[1]/L[0] < 1.1 || L[2]/L[1] < 1.1) : null;
  rows.push({ id: c.id, kind: c.kind, truth: c.type, by, dT: by[c.type], twoEqual });
}
const out = {};
for (const kind of ['synth', 'sample']){
  const S = rows.filter(r=> r.kind === kind), d = S.map(r=> r.dT);
  console.log(`\n${kind}: ${S.length} runs; the truth's solid's ΔBIC against the best: median ${fmt(median(d), 1)}, 75 % ${fmt(quantile(d, 0.75), 1)}, 90 % ${fmt(quantile(d, 0.9), 1)}, max ${fmt(Math.max(...d), 1)}; best in ${pct(d.filter(x=> x === 0).length, S.length)}`);
  console.log('| τ | truth\'s solid kept | solids kept: median | one solid alone | "not round" stated (all bodies of revolution out): n, true | "lateral extents differ" (square box, cylinder, spheroid out): n, true |');
  console.log('|---|---|---|---|---|---|');
  out[kind] = {};
  for (const tau of [4, 10, 20, 25, 30]){
    const kept = S.map(r=> Object.entries(r.by).filter(([, v])=> v <= tau).map(([k])=> k));
    const nr = S.filter((r, i)=> !kept[i].includes('spheroid') && !kept[i].includes('cylinder'));
    const ld = S.filter((r, i)=> !kept[i].includes('spheroid') && !kept[i].includes('cylinder') && !kept[i].includes('sqbox'));
    const nrTrue = nr.filter(r=> !['spheroid', 'cylinder'].includes(r.truth)).length;
    const ldTrue = ld.filter(r=> !['spheroid', 'cylinder', 'sqbox'].includes(r.truth) && !r.twoEqual).length;
    out[kind][tau] = { truthKept: S.filter(r=> r.dT <= tau).length, n: S.length, keptMed: median(kept.map(k=> k.length)), alone: kept.filter(k=> k.length === 1).length, nr: nr.length, nrTrue, ld: ld.length, ldTrue };
    console.log(`| ${tau} | ${pct(S.filter(r=> r.dT <= tau).length, S.length)} | ${median(kept.map(k=> k.length))} | ${kept.filter(k=> k.length === 1).length} | ${nr.length}, ${nrTrue} | ${ld.length}, ${ldTrue} |`);
  }
}
fs.writeFileSync(path.join(HERE, 'results', 'classcal.json'), JSON.stringify({ rows, out }));
