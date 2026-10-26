#!/usr/bin/env node
/* node ends.mjs --tag <name> [--method name]
   Where each run's starts ended: the brief refinements (audit off) grouped into
   morphologies (sameSolid: 8°, e^0.25), the share of starts that ended in the group of the
   run's best χ², and the distinct morphologies among all its refinements within Δ 10 of
   that best (Δ in its χ²_ν). Writes results/<tag>/ends.json and ends.md. */
import fs from 'node:fs';
import path from 'node:path';
import { sameSolid, readResult } from './lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const dir = path.join(HERE, 'results', opt.tag);
const runs = fs.readdirSync(dir).filter(f=> f.endsWith('.json') && !['summary.json', 'ends.json'].includes(f)).map(f=> readResult(fs.readFileSync(path.join(dir, f), 'utf8')));
const out = [];
for (const r of runs){
  const m = (r.records || []).find(m=> opt.method ? m.method === opt.method : m.method !== 'truth');
  if (!m || !m.log) continue;
  const ok = e => e.to && Number.isFinite(e.c);
  const brief = m.log.filter(e=> ok(e) && e.mi <= 8);
  const all = m.log.filter(ok).sort((x, y)=> x.c - y.c);
  if (!all.length) continue;
  const nu = Math.max(1, (m.chi2nu || r.iso.chi2nu));
  const best = all[0];
  const groups = [];
  for (const e of all){ const g = groups.find(g=> sameSolid(e.to, g.solid)); if (g) g.n++; else groups.push({ c: e.c, solid: e.to, n: 1 }); }
  const near = groups.filter(g=> (g.c - best.c)/nu <= 10).map(g=> ({ delta: (g.c - best.c)/nu, dims: g.solid.dims.map(d=> Number.isFinite(d) ? +d.toFixed(2) : Infinity), n: g.n }));
  const bGroups = [];
  for (const e of brief.sort((x, y)=> x.c - y.c)){ const g = bGroups.find(g=> sameSolid(e.to, g.solid)); if (g) g.n++; else bGroups.push({ c: e.c, solid: e.to, n: 1 }); }
  const inBest = brief.filter(e=> sameSolid(e.to, best.to)).length;
  out.push({ case: r.case, seed: r.seed, shape: r.shape, starts: brief.length, briefGroups: bGroups.length, startsInBest: inBest, near: near.length, nearList: near });
}
out.sort((x, y)=> x.case.localeCompare(y.case) || x.seed - y.seed);
fs.writeFileSync(path.join(dir, 'ends.json'), JSON.stringify(out, null, 1));
const L = [`# ${opt.tag}: where the starts ended`, '', 'starts: brief refinements; groups: their distinct morphologies (8°, e^0.25); in best: starts whose brief end is already the best fit\'s morphology; near: distinct morphologies among all the run\'s refinements within Δ 10 of its best (Δ in χ²_ν), with their Δ and dimensions.', '',
  '| run | solid | starts | groups | in best | near (Δ ≤ 10) |', '|---|---|---|---|---|---|'];
for (const o of out) L.push(`| ${o.case} #${o.seed} | ${o.shape} | ${o.starts} | ${o.briefGroups} | ${o.startsInBest} | ${o.near}: ${o.nearList.map(g=> `${g.delta.toFixed(1)} (${g.dims.join('×')})`).join('; ')} |`);
const tot = k => out.reduce((t, o)=> t + o[k], 0);
L.push('', `Totals: ${out.length} runs, ${tot('starts')} starts in ${tot('briefGroups')} groups, ${tot('startsInBest')} in the best's; ${out.filter(o=> o.near > 1).length} runs with more than one morphology within Δ 10 (${tot('near')} in all).`);
fs.writeFileSync(path.join(dir, 'ends.md'), L.join('\n') + '\n');
console.log(L.slice(-1)[0]);
