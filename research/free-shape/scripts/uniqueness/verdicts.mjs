#!/usr/bin/env node
/* node verdicts.mjs <tag> <variant> [--md out.md]: the resolution verdict of each run from a
   variant's intervals (results/<tag>/score.json), checked against the truth, and per case over
   its noise realisations (the verdict's precision).
   Run verdict: 'unique' every extent determined (±25 % at 2σ) and every direction the solid
   has determined (10°); 'part' the thinnest extent and the most distinct axis' direction
   determined (a plate's thickness and normal, a needle's section and axis), the rest not;
   'none' otherwise. Right: every quantity called determined is accurate (25 %, 10°). For
   'part' the quantities it names are listed (t, m, l: the fit's extents from the thinnest;
   ∠ their directions). */
import fs from 'node:fs';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[i + 1]; i++; } else pos.push(a[i]); }
const [tag = 'main', V = 'profD'] = pos;
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'results', tag, 'score.json'), 'utf8'));
const lg = d => Math.log(d == null || !Number.isFinite(d) ? 1e4 : d);
export function verdictOf(r, V){
  const I = r.iv[V]; if (!I) return null;
  const q = I.q, dims = r.dims.map(d=> d == null ? Infinity : d);
  const order = [0, 1, 2].sort((i, j)=> dims[i] - dims[j]);
  const gap = i => Math.min(...[0, 1, 2].filter(j=> j !== i).map(j=> Math.abs(lg(dims[i]) - lg(dims[j]))));
  const prin = [0, 1, 2].filter(i=> q[i].ang != null).sort((x, y)=> gap(y) - gap(x))[0];
  const dimDet = order.map(i=> q[i].detDim), angDet = order.map(i=> q[i].ang == null ? null : q[i].detAng);
  const all = dimDet.every(Boolean) && angDet.every(x=> x !== false);
  const part = dimDet[0] && (prin == null || q[prin].detAng);
  const cls = all ? 'unique' : part ? 'part' : 'none';
  const names = ['t', 'm', 'l'], det = [];
  order.forEach((i, k)=> { if (q[i].detDim) det.push(names[k]); if (q[i].ang != null && q[i].detAng) det.push('∠' + names[k]); });
  let right = null, wrong = [];
  if (I.truthQ){ for (const t of I.truthQ){ const k = order.indexOf(t.fi); if (t.detDim && !t.accD) wrong.push(names[k]); if (t.detAng === true && t.accA === false) wrong.push('∠' + names[k]); } right = !wrong.length; }
  const accAll = I.truthQ ? I.truthQ.every(t=> t.accD) && I.truthQ.every(t=> t.accA !== false) : null;
  return { cls, det, right, wrong, accAll };
}
const out = [], byCase = new Map();
for (const r of rows){
  if (!r.iv){ if (r.run) { const c = r.run.split('#')[0]; if (!byCase.has(c)) byCase.set(c, []); byCase.get(c).push({ run: r.run, kind: r.kind, cls: 'isotropic', det: [], right: null }); } continue; }
  const v = verdictOf(r, V); if (!v) continue;
  const c = r.case; if (!byCase.has(c)) byCase.set(c, []);
  byCase.get(c).push({ run: r.run, kind: r.kind, ...v, truth: r.truthDims, dims: r.dims, chi2nu: r.jack ? r.jack.chi2nu : null });
}
const lines = [`# Resolution verdicts (${tag}, ${V})`, '', '| case | runs | verdicts | determined (per run) | wrong claims | accurate in full |', '|---|---|---|---|---|---|'];
const tot = { unique: [0, 0], part: [0, 0], none: [0, 0], isotropic: [0, 0] }, totS = { unique: [0, 0], part: [0, 0], none: [0, 0], isotropic: [0, 0] };
let same = 0, nc = 0;
for (const [c, xs] of [...byCase.entries()].sort((a, b)=> (a[1][0].kind === 'sample') - (b[1][0].kind === 'sample') || a[0].localeCompare(b[0]))){
  const T = xs[0].kind === 'sample' ? totS : tot;
  for (const x of xs){ T[x.cls][0]++; if (x.right === false) T[x.cls][1]++; }
  if (xs.length > 1){ nc++; if (xs.every(x=> x.cls === xs[0].cls)) same++; }
  lines.push(`| ${c} | ${xs.length} | ${xs.map(x=> x.cls).join(', ')} | ${xs.map(x=> x.det.join(' ') || '—').join(' / ')} | ${xs.map(x=> x.wrong && x.wrong.length ? x.wrong.join(' ') : '—').join(' / ')} | ${xs.map(x=> x.accAll == null ? '—' : x.accAll ? 'yes' : 'no').join(', ')} |`);
}
lines.push('', `synthetic runs: ${Object.entries(tot).map(([k, [n, w]])=> `${k} ${n} (wrong ${w})`).join(', ')}; the same verdict on every realisation in ${same} of ${nc} cases with several.`);
lines.push(`sample-like runs: ${Object.entries(totS).map(([k, [n, w]])=> `${k} ${n} (wrong ${w})`).join(', ')}.`);
const txt = lines.join('\n');
if (opt.md) fs.writeFileSync(opt.md, txt + '\n');
console.log(txt);
