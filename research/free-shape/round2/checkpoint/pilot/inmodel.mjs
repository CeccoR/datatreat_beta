#!/usr/bin/env node
/* node inmodel.mjs [--exact screen] [--none inmodel] [--out file.md]
   The in-model controls against the same truths drawn with exact lines: for each row in the
   --none tag (drawn with the engine's own Lorentzian lines, run.mjs --kernel none), today's
   reported solid and the truth reference, against the truth: the extents' signed errors (the
   truth's thinnest, middle, longest), the most distinct axis (°, modulo the class), χ²_ν and
   the outcome; then the medians. Unbounded extents count as +∞. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { readResult } = await import('../harness/lib.mjs');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), arg = (k, d) => a.includes('--' + k) ? a[a.indexOf('--' + k) + 1] : d;
const load = tag => { const dir = path.join(HERE, 'results', tag), m = new Map(); for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){ const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8')); if (o && o.records) m.set(o.row, o); } return m; };
const EX = load(arg('exact', 'screen')), NO = load(arg('none', 'inmodel'));
const pc = x => x === Infinity ? '+∞' : x == null || !Number.isFinite(x) ? '—' : (x >= 0 ? '+' : '') + (100*x).toFixed(0) + ' %';
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const num = x => typeof x === 'number' && !Number.isNaN(x);
const med = xs => { const s = xs.filter(num).sort((p, q)=> p - q); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (Number.isFinite(s[m]) ? (s[m - 1] + s[m])/2 : s[m]); };
const side = (o, method) => {
  if (!o) return null;
  const r = o.records.find(x=> x.method === method), ord = [0, 1, 2].sort((p, q)=> o.truth.dims[p] - o.truth.dims[q]);
  const out = r.kept ? (r.held ? 'held' : 'free') : r.rejected ? (r.early ? 'early' : 'rejected') : 'none';
  return { out, dims: r.acc ? ord.map(i=> r.acc.dimErr[i]) : null, worst: r.acc ? r.acc.dimMax : NaN, axis: r.acc ? r.acc.principal : NaN, chi2nu: r.chi2nu, dBIC: r.dBIC };
};
const lines = ['| run | lines | today | thinnest / middle / longest | worst | axis ° | χ²_ν | truth ref: thinnest / middle / longest | axis ° | χ²_ν |', '|---|---|---|---|---|---|---|---|---|---|'];
const acc = { exact: { t: [], r: [] }, none: { t: [], r: [] } };
for (const id of [...NO.keys()].sort()){
  for (const [lab, M] of [['exact', EX], ['none', NO]]){
    const o = M.get(id); if (!o) continue;
    const t = side(o, 'today'), r = side(o, 'truth');
    acc[lab].t.push(t); acc[lab].r.push(r);
    lines.push(`| ${lab === 'exact' ? id : ''} | ${lab === 'exact' ? 'exact' : "engine's"} | ${t.out}${t.dBIC != null ? ' (ΔBIC ' + f(t.dBIC, 0) + ')' : ''} | ${t.dims ? t.dims.map(pc).join(' / ') : '—'} | ${pc(t.worst)} | ${f(t.axis)} | ${f(t.chi2nu, 2)} | ${r.dims ? r.dims.map(pc).join(' / ') : '—'} | ${f(r.axis)} | ${f(r.chi2nu, 2)} |`);
  }
}
lines.push('', '| lines | runs | today kept | today worst extent, median | today thinnest | today axis °, median | today χ²_ν | truth ref worst extent | truth ref axis ° | truth ref χ²_ν |', '|---|---|---|---|---|---|---|---|---|---|');
for (const lab of ['exact', 'none']){
  const T = acc[lab].t, R = acc[lab].r, K = T.filter(t=> t.dims);
  lines.push(`| ${lab === 'exact' ? 'exact' : "engine's"} | ${T.length} | ${K.length} | ${pc(med(K.map(t=> t.worst)))} | ${pc(med(K.map(t=> t.dims[0])))} | ${f(med(K.map(t=> t.axis)))} | ${f(med(T.map(t=> t.chi2nu)), 2)} | ${pc(med(R.map(r=> r.worst)))} | ${f(med(R.map(r=> r.axis)))} | ${f(med(R.map(r=> r.chi2nu)), 2)} |`);
}
const text = lines.join('\n') + '\n';
if (arg('out')) fs.writeFileSync(arg('out'), text);
console.log(text);
