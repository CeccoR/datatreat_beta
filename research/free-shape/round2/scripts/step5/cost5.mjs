/* The keep rule's cost on the nulls (N, draws 0–4 and X1): the brief trials' gain against each rule's
   early threshold; a run going on costs its search (less the minima stage), one stopped early the
   median of the early-stopped runs of its solid and class. node cost5.mjs */
import fs from 'node:fs';
import { design, SOLIDS, rec5, q } from './lib5.mjs';
const K = { '-1': 5, '2/m': 3, mmm: 2, '4/m': 1, '4/mmm': 1, '-3': 1, '-3m': 1, '6/m': 1, '6/mmm': 1, 'm-3': 0, 'm-3m': 0 };
const chi2q = (k, p) => { let lo = -10, hi = 10; for (let i = 0; i < 80; i++){ const m = (lo + hi)/2, t = 1/(1 + 0.2316419*Math.abs(m)), d = 0.3989422804014327*Math.exp(-m*m/2), u = d*t*(0.319381530 + t*(-0.356563782 + t*(1.781477937 + t*(-1.821255978 + t*1.330274429)))), up = m >= 0 ? u : 1 - u; if (up > p) lo = m; else hi = m; } const z = (lo + hi)/2; return k*Math.pow(1 - 2/(9*k) + z*Math.sqrt(2/(9*k)), 3); };
const R = [];
for (const r of design.rows.filter(r=> r.solid === 'sphere' && r.split === 'tuning')) for (const s of SOLIDS){
  const rec = (!r.from && r.screen) ? rec5('X1', r.key, s) : rec5('N', r.key, s); if (!rec) continue;
  const x = rec.records[0], k = x.keep; if (!k) continue;
  R.push({ s, laue: r.laue, err: !!r.error, early: x.early, gb: k.gainBrief, dPheld: k.dPheld, N: rec.iso.N, ev: rec.stages.today.search.evals - (x.min ? x.min.evals : 0), isoEv: rec.iso.evals });
}
const briefEv = {}; for (const o of R.filter(o=> o.early)) (briefEv[o.s + o.laue] = briefEv[o.s + o.laue] || []).push(o.ev);
const bOf = o => briefEv[o.s + o.laue] ? q(briefEv[o.s + o.laue], 0.5) : q(R.filter(x=> x.early && x.s === o.s).map(x=> x.ev), 0.5);
const rules = { bic: o=> 0.5*(10 + o.dPheld*Math.log(o.N)), lrt: o=> 0.5*(chi2q(K[o.laue] + 1, 0.001) + 2) };
for (const [nm, set] of [['clean nulls', R.filter(o=> !o.err)], ['error nulls', R.filter(o=> o.err)]]){
  const line = Object.entries(rules).map(([rn, E])=> { let go = 0, ev = 0; for (const o of set){ const full = o.gb > E(o); if (full) go++; ev += full ? (o.early ? bOf(o) : o.ev) : (o.early ? o.ev : bOf(o)); } return `${rn}: ${go}/${set.length} go on, ${(ev/set.length).toFixed(0)} evaluations a search`; });
  console.log(`${nm}: ${line.join('; ')}; the isotropic fit ${q(set.map(o=> o.isoEv), .5)}`);
}
