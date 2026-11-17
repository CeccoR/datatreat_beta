#!/usr/bin/env node
/* node fishercheck.mjs: does the Fisher matrix point at the quantity the truth says is worst?
   For each synthetic run: the largest error against the truth in tolerance units (an extent's
   |ln ratio|/0.2, a direction's angle/10°; roles thin, mid, long), and the loosest
   eigen-combination of results/fisher-main.json (its names: ln W <role>, turn about <role>).
   A hit: the worst quantity is named in the loosest combination (an extent by its ln W, a
   direction by a turn about another axis). Also: runs with no loose combination, and their
   worst error. */
import fs from 'node:fs';
import path from 'node:path';
import { fmt, median } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const F = new Map(JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'fisher-main.json'), 'utf8')).rows.map(r=> [r.run, r]));
const S = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'main', 'score.json'), 'utf8')).filter(r=> r.iv && r.kind === 'synth');
let hit = 0, n = 0, none = [], miss = [];
for (const r of S){
  const f = F.get(r.run); if (!f) continue;
  const T = r.iv.app.truthQ;
  const q = T.flatMap(t=> [{ k: 'ln W ' + t.role, e: t.err/0.2 }, ...(t.angErr == null ? [] : [{ k: 'dir ' + t.role, e: t.angErr/10 }])]).sort((a, b)=> b.e - a.e);
  const worst = q[0];
  if (!f.loose.length){ none.push(worst.e); continue; }
  if (worst.e < 1) continue;          // nothing outside tolerance: no worst to point at
  n++;
  const L = f.loose[0].nm;
  const role = worst.k.split(' ').pop();
  const ok = worst.k.startsWith('ln W') ? L.includes('ln W ' + role) || L.includes('+' + role) || L.includes(role + '+') : /turn about/.test(L) && !L.includes('turn about ' + role) || L.includes('turn about') && role !== 'thin';
  if (ok) hit++; else miss.push(`${r.run}: worst ${worst.k} (${fmt(worst.e, 1)}), loosest ${L}`);
}
console.log(`synthetic runs with an error over tolerance and a loose combination: ${n}; the worst quantity in the loosest combination: ${hit}`);
console.log(`runs with no loose combination: ${none.length}; their worst error in tolerance units: median ${fmt(median(none), 2)}, max ${fmt(Math.max(...none), 2)}, over 1: ${none.filter(e=> e > 1).length}`);
console.log(miss.join('\n'));
