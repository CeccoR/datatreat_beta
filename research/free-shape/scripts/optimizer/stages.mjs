#!/usr/bin/env node
/* node stages.mjs <tag|baseline> …: the evaluations per run by stage, from each record's
   refine() log (brief: maxIter ≤ 8 or the halving rungs; full+polish: faces rounded,
   60 iterations; exact/refit: the exact solid with its orientation free; held: orientation
   held; cov: the final covariance alone, 0 iterations), synthetic and sample-like runs. */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
for (const tag of process.argv.slice(2)){
  const dir = tag === 'baseline' ? path.join(HERE, '..', 'harness', 'results', 'baseline') : path.join(HERE, 'results', tag);
  const S = {}; let runs = 0, tot = 0;
  for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json') && !['summary.json', 'ends.json'].includes(f))){
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (!r.records || !['synth', 'sample'].includes(r.kind)) continue;
    const b = r.records.find(m=> m.method !== 'truth'); runs++; tot += b.evals;
    for (const e of b.log || []){
      const st = !e.soft && !e.rot && e.mi === 6 ? 'heldBrief' : e.mi <= 8 ? 'brief' : e.it === 0 && e.mi === 60 && !e.soft ? 'cov' : e.soft ? (e.mi === 6 ? 'heldBrief' : 'full+polish') : e.rot ? 'exact/refit' : (e.mi === 6 ? 'heldBrief' : 'held');
      (S[st] = S[st] || { n: 0, ev: 0, it: 0 }); S[st].n++; S[st].ev += e.ev; S[st].it += e.it || 0;
    }
  }
  console.log(`${tag}: ${runs} runs, ${(tot/runs).toFixed(0)} evaluations a run`);
  for (const k in S) console.log(`  ${k.padEnd(12)} ${(S[k].n/runs).toFixed(2)} refines/run  ${(S[k].ev/runs).toFixed(0).padStart(5)} evals/run (${(100*S[k].ev/tot).toFixed(0)} %)  ${(S[k].it/S[k].n).toFixed(1)} it/refine  ${(S[k].ev/S[k].n).toFixed(0)} evals/refine`);
}
