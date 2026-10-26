#!/usr/bin/env node
/* node classes.mjs: model selection across the solids. For each case and seed run with every
   solid (results/cls-<solid>/, the app's search: harness methods/baseline.mjs, --shape), the
   ΔBIC of each solid against the isotropic size (the card's), the truth's solid's rank and
   its ΔBIC from the best solid; the extents of each kept solid against the truth's (loose:
   paired by size), and what the pattern sees (obsDist: the members' widths per d-spacing)
   of each against the truth's. Writes results/classes.json and prints a table. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, caseById, truthOf } from '../harness/lib.mjs';
import { align, fmt, median, quantile } from './ulib.mjs';
import { obsDist } from './obs.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SOLIDS = ['box', 'sqbox', 'ellipsoid', 'spheroid', 'cylinder', 'ellcyl'];
const runs = new Map();
for (const s of SOLIDS){
  const dirs = [path.join(HERE, 'results', 'cls-' + s)];
  for (const d of dirs){ if (!fs.existsSync(d)) continue;
    for (const fn of fs.readdirSync(d).filter(f=> f.endsWith('.json'))){
      const r = readResult(fs.readFileSync(path.join(d, fn), 'utf8')); if (!r.records) continue;
      const key = `${r.case}#${r.seed}`; if (!runs.has(key)) runs.set(key, { case: r.case, seed: r.seed, kind: r.kind, by: {} });
      const m = r.records[0];
      runs.get(key).by[s] = { kept: m.kept, rejected: m.rejected, early: m.early, dBIC: m.dBIC, chi2Best: m.chi2Best, solid: m.solid || null, evals: m.evals, held: m.held };
    }
  }
}
// the baseline's own-solid runs fill in the truth's solid
const base = path.join(HERE, '..', 'harness', 'results', 'baseline');
for (const [key, R] of runs){
  const c = caseById(R.case);
  if (c.type && SOLIDS.includes(c.type) && !R.by[c.type]){
    const f = path.join(base, `${R.case}-${R.seed}.json`);
    if (fs.existsSync(f)){ const r = readResult(fs.readFileSync(f, 'utf8')), m = r.records[0];
      R.by[c.type] = { kept: m.kept, rejected: m.rejected, early: m.early, dBIC: m.dBIC, chi2Best: m.chi2Best, solid: m.solid || null, evals: m.evals, held: m.held, fromBaseline: true }; }
  }
  R.truth = c.dims ? truthOf(c).solid : null; R.type = c.type;
}
const rows = [];
for (const [key, R] of runs){
  const S = SOLIDS.filter(s=> R.by[s] && Number.isFinite(R.by[s].dBIC));
  if (!S.length) continue;
  const bestS = S.sort((a, b)=> R.by[a].dBIC - R.by[b].dBIC)[0];
  const row = { run: key, kind: R.kind, type: R.type, best: bestS, per: {} };
  for (const s of SOLIDS){
    const x = R.by[s]; if (!x) continue;
    const e = { dBIC: x.dBIC, gap: Number.isFinite(x.dBIC) ? x.dBIC - R.by[bestS].dBIC : null, kept: x.kept };
    if (x.solid && R.truth){ const al = align(x.solid, R.truth, { loose: true }); e.ext = al.per.map(p=> p.ratio); e.worst = al.orient; e.obs = obsDist(x.solid, R.truth); }
    row.per[s] = e;
  }
  if (R.type && row.per[R.type]) row.truthGap = row.per[R.type].gap, row.truthRank = SOLIDS.filter(s=> row.per[s] && Number.isFinite(row.per[s].dBIC)).sort((a, b)=> row.per[a].dBIC - row.per[b].dBIC).indexOf(R.type) + 1;
  rows.push(row);
}
fs.writeFileSync(path.join(HERE, 'results', 'classes.json'), JSON.stringify(rows, null, 1));
console.log('| run | truth | best solid | truth solid: rank, ΔBIC from best | ' + SOLIDS.join(' | ') + ' |');
console.log('|---|---|---|---|' + SOLIDS.map(()=> '---').join('|') + '|');
for (const r of rows.sort((a, b)=> a.run.localeCompare(b.run))){
  console.log(`| ${r.run} | ${r.type} | ${r.best} | ${r.truthRank || '—'}, ${fmt(r.truthGap, 1)} | ` + SOLIDS.map(s=> { const e = r.per[s]; if (!e) return '';
    return `${fmt(e.gap, 0)}${e.kept ? '' : 'r'}${e.ext ? ' [' + e.ext.map(x=> fmt(100*(x - 1), 0)).join(',') + ']% ' + fmt(e.worst, 0) + '° o' + fmt(100*e.obs, 1) : ''}`; }).join(' | ') + ' |');
}
const T = rows.filter(r=> r.truthRank);
console.log(`\ntruth solid ranked first: ${T.filter(r=> r.truthRank === 1).length}/${T.length}; within ΔBIC 10 of the best: ${T.filter(r=> r.truthGap <= 10).length}/${T.length}`);
const gaps = rows.flatMap(r=> SOLIDS.filter(s=> r.per[s] && s !== r.best && Number.isFinite(r.per[s].gap)).map(s=> r.per[s].gap));
console.log(`other solids' ΔBIC gap from the best: median ${fmt(median(gaps), 1)}, share under 10: ${gaps.filter(g=> g < 10).length}/${gaps.length}`);
