#!/usr/bin/env node
/* The quick parametric bootstrap per fit (L records): G, the replicas' G* (19), p, the test at 5 % (G above
   every G*) against the adopted rule (G > χ²_{k+1}(0.999) + 2), the replicas' mean against k + 1, and the
   cost as searches. node lrt-an.mjs */
import fs from 'node:fs';
import { design } from './lib5.mjs';
const K = { '-1': 5, '2/m': 3, mmm: 2, '4/m': 1, '4/mmm': 1, '-3': 1, '-3m': 1, '6/m': 1, '6/mmm': 1, 'm-3': 0, 'm-3m': 0 };
const chi2q = (k, p) => { let lo = -10, hi = 10; for (let i = 0; i < 80; i++){ const m = (lo + hi)/2, t = 1/(1 + 0.2316419*Math.abs(m)), d = 0.3989422804014327*Math.exp(-m*m/2), u = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))), up = m >= 0 ? u : 1 - u; if (up > p) lo = m; else hi = m; } const z = (lo + hi)/2; return k*Math.pow(1 - 2/(9*k) + z*Math.sqrt(2/(9*k)), 3); };
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
console.log('| fit | class (k) | truth | G | replicas G*: mean, max | p | bootstrap at 5 % | the adopted rule (need) | cost (searches) |\n|---|---|---|---|---|---|---|---|---|');
let n = 0, agree = 0, cost = [];
for (const fn of fs.readdirSync('results/L').filter(x=> x.endsWith('.json')).sort()){
  const r = JSON.parse(fs.readFileSync('results/L/' + fn, 'utf8')), x = r.records[0], L = x.lrt; if (!L) continue;
  const base = fn.replace(/\.json$/, ''), row = design.rows.find(y=> y.key === base) || design.rows.find(y=> y.key === base.replace(/\.[a-z]+$/, ''));
  const k = K[r.laue], need = chi2q(k + 1, 0.001) + 2, reps = L.reps.filter(Number.isFinite), boot = L.G > Math.max(...reps), rule = L.G > need;
  const c = L.evals/L.searchEvals; cost.push(c); n++; if (boot === rule) agree++;
  const truth = row && row.mild ? `${row.solid} r ${row.mild.r.toFixed(2)}` : 'sphere';
  console.log(`| ${fn.replace(/\.json$/, '')} | ${r.laue} (${k}) | ${truth} | ${f(L.G)} | ${f(reps.reduce((t, v)=> t + v, 0)/reps.length)}, ${f(Math.max(...reps))} | ${f(L.p, 2)} | ${boot ? 'kept' : '—'} | ${rule ? 'kept' : '—'} (${f(need)}) | ${f(1 + c)} |`);
}
cost.sort((a, b)=> a - b);
console.log(`\n${n} fits; the bootstrap and the adopted rule agree on ${agree}; the bootstrap costs ${f(cost[cost.length >> 1])} searches beyond the fit's own (median; ${f(cost[0])}–${f(cost[cost.length - 1])}).`);
