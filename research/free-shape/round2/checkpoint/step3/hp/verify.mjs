#!/usr/bin/env node
/* The prototype's last checks: (1) P2 (retest on, the 26 flagged kept fits): each outcome as P1's refit
   without the worst third of the flagged segments predicts (ΔBIC ≥ −10: rejected), its ΔBIC equal, and the
   retest's evaluations; (2) F1 (the final engine's defaults) equal to P1 bit for bit, times apart; (3) F0
   (SHAPE_CHECK.on false) equal to step 2's fits (C1): χ², the search's and the report's evaluations. */
import fs from 'node:fs';
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8')), rec = f => rd(f).records[0];
const rows = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l=> l.trim().split(/\s+/).pop());
const dB = d => { const rI = d.iso.c/Math.max(1, d.iso.N - d.iso.P); return (d.shape.c - d.iso.c)/Math.max(1, rI) + (d.shape.P - d.iso.P)*Math.log(d.shape.N); };
let ok = 0; const rej = [], ev = [];
const R2 = rows('jobs-P2.txt');
for (const r of R2){
  const a = rec(`results/P2/${r}.json`), b = rec(`results/P1/${r}.json`), p = dB(b.drop.third), t = a.check && a.check.retest;
  if (t && Math.abs(t.dBIC - p) <= 1e-6*Math.max(1, Math.abs(p)) && a.kept === (p < -10)) ok++;
  if (!a.kept) rej.push(`${r} (${t.dBIC.toFixed(1)})`); else ev.push(a.search.evals - b.search.evals);
}
ev.sort((x, y)=> x - y);
console.log(`P2: ${ok} of ${R2.length} as predicted; rejected ${rej.join(', ')}; the retest's evaluations on the kept: median ${ev[ev.length >> 1]} (${ev[0]}–${ev[ev.length - 1]})`);
const strip = r => { delete r.ms; delete r.log; delete r.search.ms; if (r.report) delete r.report.ms; if (r.drop) delete r.drop.ms; return JSON.stringify(r); };
const F1 = rows('jobs-F1.txt'); console.log(`F1: ${F1.filter(r=> strip(rec(`results/F1/${r}.json`)) === strip(rec(`results/P1/${r}.json`))).length} of ${F1.length} equal to P1`);
const F0 = rows('jobs-F0.txt'); console.log(`F0: ${F0.filter(r=> { const a = rec(`results/F0/${r}.json`), b = rec(`../h/results/C1/${r}.json`); return a.chi2 === b.chi2 && a.search.evals === b.search.evals && (a.report && a.report.evals) === (b.report && b.report.evals) && a.kept === b.kept && !a.check; }).length} of ${F0.length} equal to step 2's fits`);
