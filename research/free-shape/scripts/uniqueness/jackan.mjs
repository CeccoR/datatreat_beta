#!/usr/bin/env node
/* node jackan.mjs [tag=jack]: the delete-one-reflection jackknife (methods/u-jack.mjs) and the
   residual checks at the best free fit, synthetic against sample-like. Per run: χ²_ν, the
   Durbin–Watson d, the worst segment's χ²_ν (and its line), the jackknife sd of ln D per
   extent (thin, mid, long of the best) and rms turn of the most distinct axis; the cost.
   Then: how well χ²_ν and d separate the two sets (the misfit flag), and the jackknife sd
   of the thin extent against the thin extent's actual error. */
import fs from 'node:fs';
import path from 'node:path';
import { readResult } from '../harness/lib.mjs';
import { align, fmt, median, quantile } from './ulib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const tag = process.argv[2] || 'jack';
const rows = [];
for (const fn of fs.readdirSync(path.join(HERE, 'results', tag)).filter(f=> f.endsWith('.json')).sort()){
  const r = readResult(fs.readFileSync(path.join(HERE, 'results', tag, fn), 'utf8')); if (!r.records) continue;
  const j = r.records[0].info && r.records[0].info.jack; if (!j) continue;
  const mr = readResult(fs.readFileSync(path.join(HERE, 'results', 'main', fn), 'utf8')), best = mr.records[0].info.uniq.minima[0];
  const dims = best.solid.dims, order = [0, 1, 2].sort((a, b)=> dims[a] - dims[b]);
  const K = j.drops.length, f = (K - 1)/K, ok = j.drops.filter(d=> d.solid);
  const sd = order.map(bi=> { let s = 0, inf = false; for (const d of ok){ const p = align(d.solid, best.solid, { loose: true }).per[bi]; let lr = Math.log(p.ratio); if (!Number.isFinite(lr)){ if (!Number.isNaN(lr)) inf = true; lr = 0; } s += lr*lr; } return inf || ok.length < K ? Infinity : Math.sqrt(f*s); });
  const rms = order.map(bi=> { let s = 0, n = 0; for (const d of ok){ const p = align(d.solid, best.solid, { loose: true }).per[bi]; if (p.angle != null){ s += p.angle**2; n++; } } return n ? Math.sqrt(f*s) : null; });
  const worst = [...j.segs].sort((a, b)=> b.chi2nu - a.chi2nu)[0];
  // the thin extent's error against the truth (loose pairing)
  let thinErr = null;
  if (r.truth){ const at = align(best.solid, r.truth, { loose: true }), ti = [0, 1, 2].sort((a, b)=> r.truth.dims[a] - r.truth.dims[b])[0]; thinErr = Math.log(at.per[ti].ratio); }
  rows.push({ run: `${r.case}#${r.seed}`, kind: r.kind, chi2nu: j.chi2nu, dw: j.dw, worst: { tt: worst.tt, hkl: worst.hkl[0], chi2nu: worst.chi2nu }, K, failed: K - ok.length, sd, rms, evals: j.evals, ms: j.ms, thinErr });
}
const S = rows.filter(r=> r.kind === 'synth'), U = rows.filter(r=> r.kind === 'sample');
const st = (xs, k) => `median ${fmt(median(xs.map(k)), 3)}, range ${fmt(Math.min(...xs.map(k)), 3)}–${fmt(Math.max(...xs.map(k)), 3)}`;
console.log(`${rows.length} runs (${S.length} synthetic, ${U.length} sample-like); jackknife cost per run: ${fmt(median(rows.map(r=> r.evals)), 0)} evaluations, ${fmt(median(rows.map(r=> r.ms))/1000, 1)} s (median); segments ${fmt(median(rows.map(r=> r.K)), 0)}`);
for (const [nm, X] of [['synthetic', S], ['sample-like', U]]){
  if (!X.length) continue;
  console.log(`\n${nm}: χ²_ν ${st(X, r=> r.chi2nu)}; Durbin–Watson ${st(X, r=> r.dw)}; worst segment χ²_ν ${st(X, r=> r.worst.chi2nu)}`);
  console.log(`  jackknife sd ln D: thin ${st(X.filter(r=> Number.isFinite(r.sd[0])), r=> r.sd[0])}; mid ${fmt(median(X.map(r=> r.sd[1])), 3)}; long ${fmt(median(X.map(r=> r.sd[2])), 3)} (unbounded in ${X.filter(r=> !Number.isFinite(r.sd[2])).length})`);
  const T = X.filter(r=> r.thinErr != null && Number.isFinite(r.sd[0]));
  console.log(`  thin extent: |error| / jackknife sd median ${fmt(median(T.map(r=> Math.abs(r.thinErr)/Math.max(1e-4, r.sd[0]))), 2)}; within 2 sd ${T.filter(r=> Math.abs(r.thinErr) <= 2*r.sd[0]).length}/${T.length}`);
}
// the misfit flag: thresholds that separate the sets
for (const th of [1.1, 1.2, 1.3]) console.log(`χ²_ν > ${th}: synthetic ${S.filter(r=> r.chi2nu > th).length}/${S.length}, sample-like ${U.filter(r=> r.chi2nu > th).length}/${U.length}`);
for (const th of [1.8, 1.5, 1.2]) console.log(`Durbin–Watson < ${th}: synthetic ${S.filter(r=> r.dw < th).length}/${S.length}, sample-like ${U.filter(r=> r.dw < th).length}/${U.length}`);
console.log('\n| run | χ²_ν | DW | worst segment (line, χ²_ν) | jackknife sd ln D thin, mid, long | rms turn ° thin, mid, long | thin error |');
console.log('|---|---|---|---|---|---|---|');
for (const r of [...U, ...S.filter((_, i)=> i % 6 === 0)]) console.log(`| ${r.run} | ${fmt(r.chi2nu, 3)} | ${fmt(r.dw, 2)} | ${r.worst.hkl.join('')} ${fmt(r.worst.tt, 1)}°, ${fmt(r.worst.chi2nu, 2)} | ${r.sd.map(x=> fmt(x, 3)).join(', ')} | ${r.rms.map(x=> fmt(x, 1)).join(', ')} | ${r.thinErr == null ? '—' : fmt(100*(Math.exp(r.thinErr) - 1), 0) + ' %'} |`);
fs.writeFileSync(path.join(HERE, 'results', `jackan-${tag}.json`), JSON.stringify(rows, null, 1));
