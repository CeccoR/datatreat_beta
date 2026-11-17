#!/usr/bin/env node
/* node costs.mjs <tag>: what each part of the analysis costs (pattern evaluations, s), per
   run and in total, by set: the search itself, the app's own esds (bodyShapeOf, which the
   worker computes today), the free fit of a held result, each refined candidate by where it
   came from (the search's converged ends, its brief ends, the extra starts), the extra
   starts' brief refinements, the profiles, the noise-free δ. And how many distinct minima
   (within Δ 30) each source contributed. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from '../harness/lib.mjs';
import { fmt, median } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'main', dir = path.join(HERE, 'results', tag);
const sets = {};
for (const fn of fs.readdirSync(dir).filter(f=> f.endsWith('.json') && !f.startsWith('score')).sort()){
  const r = readResult(fs.readFileSync(path.join(dir, fn), 'utf8')); if (!r.records) continue;
  const m = r.records[0], u = m.info && m.info.uniq, S = sets[r.kind] || (sets[r.kind] = { runs: 0, kept: 0, parts: {}, cand: {}, minima: {}, metered: 0 });
  S.runs++;
  if (!u) continue;
  S.kept++;
  const add = (k, c) => { if (!c) return; const p = S.parts[k] || (S.parts[k] = { evals: 0, ms: 0, n: 0 }); p.evals += c.evals; p.ms += c.ms; p.n++; };
  for (const [k, c] of Object.entries(u.cost)) add(k, c);
  if (u.tried.some(t=> t.evals != null)) S.metered++;
  for (const t of u.tried){ if (t.evals == null) continue; const c = S.cand[t.src] || (S.cand[t.src] = { evals: 0, ms: 0, n: 0, newMin: 0 }); c.evals += t.evals; c.ms += t.ms; c.n++; if (t.dup === -1) c.newMin++; }
  const c0 = u.minima[0].chi;
  for (const x of u.minima.slice(1)) if ((x.chi - c0)/u.nu0 <= 30) S.minima[x.src] = (S.minima[x.src] || 0) + 1;
}
for (const [k, S] of Object.entries(sets)){
  console.log(`\n## ${k}: ${S.runs} runs, ${S.kept} kept (analysed); candidates metered on ${S.metered}`);
  console.log('| part | runs | evaluations per run | s per run |\n|---|---|---|---|');
  for (const [p, c] of Object.entries(S.parts)) console.log(`| ${p} | ${c.n} | ${fmt(c.evals/c.n, 0)} | ${fmt(c.ms/c.n/1000, 1)} |`);
  console.log('| candidate from | refined | evaluations each | new minima |\n|---|---|---|---|');
  for (const [p, c] of Object.entries(S.cand)) console.log(`| ${p} | ${c.n} | ${fmt(c.evals/c.n, 0)} | ${c.newMin} |`);
  console.log('minima within Δ 30 by source:', JSON.stringify(S.minima));
}
