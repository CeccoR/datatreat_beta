#!/usr/bin/env node
/* node seeds.mjs [--approach P0_app,P3_points]: precision over the noise realisations.
   Per synthetic case with 3 scored seeds: the spread of each length's point value (sd of
   its log over the seeds), the median 95 % half-width the approach states for it (in log),
   and whether the three intervals have a common part (consistent results). */
import fs from 'node:fs';
import path from 'node:path';
import { median, quantile, fmt, pct, HERE } from './plib.mjs';
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const o = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'eval-synth.json'), 'utf8'));
const out = {};
console.log('| approach | quantity | cases | sd of log value over seeds: median | stated 95 % half-width (log): median | ratio sd/(half-width/1.96): median | three intervals overlap |');
console.log('|---|---|---|---|---|---|---|');
for (const ap of (opt.approach || 'P0_app,P1_profile,P3_points,P3_mixture').split(',')){
  const by = new Map();
  for (const r of o.per){ const s = r.sc[ap]; if (!s || !s.dims) continue; if (!by.has(r.id)) by.set(r.id, []); by.get(r.id).push(s); }
  for (const k of ['thin', 'mid', 'long']){
    const rows = [];
    for (const [id, ss] of by){
      if (ss.length < 3) continue;
      const v = ss.map(s=> s.dims[k]);
      if (v.some(d=> !Number.isFinite(d.est))) continue;
      const lg = v.map(d=> Math.log(d.est)), m = lg.reduce((t, x)=> t + x, 0)/3, sd = Math.sqrt(lg.reduce((t, x)=> t + (x - m)**2, 0)/2);
      const hw = median(v.map(d=> Number.isFinite(d.hi) && d.lo > 0 ? Math.log(d.hi/d.lo)/2 : Infinity));
      const lo = Math.max(...v.map(d=> d.lo)), hi = Math.min(...v.map(d=> d.hi));
      rows.push({ id, sd, hw, ratio: sd/(hw/1.96), overlap: lo <= hi });
    }
    out[ap + ':' + k] = rows;
    console.log(`| ${ap} | ${k} | ${rows.length} | ${fmt(100*median(rows.map(r=> r.sd)), 1)} % | ${fmt(100*median(rows.map(r=> r.hw)), 1)} % | ${fmt(median(rows.map(r=> r.ratio)), 2)} | ${pct(rows.filter(r=> r.overlap).length, rows.length)} |`);
  }
}
fs.writeFileSync(path.join(HERE, 'results', 'seeds-synth.json'), JSON.stringify(out));
