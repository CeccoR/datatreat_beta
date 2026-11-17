#!/usr/bin/env node
/* node table.mjs --tag <name> [--ref tag1,tag2] [--method name]
   Reads results/<tag>/*.json (and the --ref tags' runs of the same cases: they count for
   the best χ² any run found) and writes results/<tag>/summary.json and table.md:
   per run: Δ = (χ²_best,run − χ²_best,any)/max(1, χ²_ν) of the exact solid (free or held,
   the lower; a search rejected early has none), reached = Δ ≤ 1, evaluations, wall time,
   the reported solid's errors against the truth (dimensions relative, paired by size
   within the body's axis classes; orientation: the worst defined axis, and the truth's
   most distinct axis — the plate normal, the needle axis — modulo the cubic Laue group
   and the body's symmetry); per case: reached k/n, means, and the precision over the
   noise realisations (sd of each dimension's relative error, mean pairwise
   misorientation of the reported solids). --method: the method summarised (default the
   first that is not a reference). */
import fs from 'node:fs';
import path from 'node:path';
import { compareSolids, readResult, truthOf } from './lib.mjs';
import { CASES } from './cases.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const dir = path.join(HERE, 'results', opt.tag);
const load = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(d, f), 'utf8'))) : [];
const runs = load(dir);
const refs = (opt.ref ? String(opt.ref).split(',') : []).flatMap(t=> load(path.join(HERE, 'results', t)));
const key = r => `${r.case}|${r.seed}|${r.shape}`;
// the best exact χ² any run found, per (case, seed, solid)
const best = new Map();
for (const r of [...runs, ...refs]) for (const m of r.records || []){
  const c = m.chi2Best;
  if (Number.isFinite(c) && (!best.has(key(r)) || c < best.get(key(r)).c)) best.set(key(r), { c, nu: Math.max(1, c/Math.max(1, r.iso.N - (m.P || r.iso.P))), by: m.method });
}
// the truth's solid (a result of before it was stored: from the case list)
const truthSolid = r => r.truth || (r.kind === 'synth' || r.kind === 'sample' ? (r.truthType === r.shape ? truthOf(CASES.find(c=> c.id === r.case)).solid : null) : null);
const mean = xs => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((t, x)=> t + x, 0)/v.length : NaN; };
const sd = xs => { const v = xs.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((t, x)=> t + (x - m)**2, 0)/(v.length - 1)); };
const rows = [];
for (const r of runs){
  const m = (r.records || []).find(m=> opt.method ? m.method === opt.method : !['truth'].includes(m.method));
  if (!m) continue;
  const b = best.get(key(r));
  const delta = b && Number.isFinite(m.chi2Best) ? (m.chi2Best - b.c)/b.nu : NaN;
  rows.push({ case: r.case, kind: r.kind, seed: r.seed, shape: r.shape, method: m.method, outcome: m.error ? 'error' : m.kept ? (m.held ? 'held' : 'free') : m.rejected ? (m.early ? 'rejected early' : 'rejected') : 'none',
    dBIC: m.dBIC, delta, reached: Number.isFinite(delta) ? delta <= 1 : null, bestBy: b && b.by, evals: m.evals, ms: m.ms, isoMs: r.iso && r.iso.ms, refines: m.refines,
    dims: m.solid ? m.solid.dims : null, acc: m.acc || null, accLoose: m.accLoose || (m.solid && truthSolid(r) ? compareSolids(m.solid, truthSolid(r), { loose: true }) : null), accFree: m.accFree || null, solid: m.solid || null, chi2nuIso: r.iso && r.iso.chi2nu, chi2nu: m.chi2nu });
}
rows.sort((x, y)=> CASES.findIndex(c=> c.id === x.case) - CASES.findIndex(c=> c.id === y.case) || x.seed - y.seed);
// per case
const cases = [];
for (const c of CASES){
  const rs = rows.filter(r=> r.case === c.id);
  if (!rs.length) continue;
  const solids = rs.map(r=> r.solid).filter(Boolean);
  let mis = [];
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++){ const s = compareSolids(solids[i], solids[j]); if (s && s.orient != null) mis.push(s.orient); }
  const de = [0, 1, 2].map(ax=> sd(rs.map(r=> r.acc ? r.acc.dimErr[ax] : NaN)));
  cases.push({ case: c.id, kind: c.kind, shape: rs[0].shape, n: rs.length, reached: rs.filter(r=> r.reached).length, judged: rs.filter(r=> r.reached != null).length,
    outcomes: rs.map(r=> r.outcome), evals: mean(rs.map(r=> r.evals)), ms: mean(rs.map(r=> r.ms)), deltaMax: Math.max(...rs.map(r=> Number.isFinite(r.delta) ? r.delta : -Infinity)),
    dimMax: mean(rs.map(r=> r.acc ? r.acc.dimMax : NaN)), dimLoose: mean(rs.map(r=> r.accLoose ? r.accLoose.dimMax : NaN)), orient: mean(rs.map(r=> r.acc ? r.acc.orient : NaN)), principal: mean(rs.map(r=> r.acc ? r.acc.principal : NaN)),
    precDim: Math.max(...de.filter(Number.isFinite), -Infinity), precOrient: mean(mis) });
}
const syn = rows.filter(r=> r.kind === 'synth');
const totals = {};
for (const [k, sel] of [['synth', r=> r.kind === 'synth'], ['sample', r=> r.kind === 'sample'], ['control', r=> r.kind === 'control'], ['fixture', r=> r.kind === 'fixture'], ['all', ()=> true]]){
  const rs = rows.filter(sel); if (!rs.length) continue;
  totals[k] = { runs: rs.length, reached: rs.filter(r=> r.reached).length, judged: rs.filter(r=> r.reached != null).length, kept: rs.filter(r=> r.outcome === 'held' || r.outcome === 'free').length,
    evals: mean(rs.map(r=> r.evals)), ms: mean(rs.map(r=> r.ms)), msTotal: rs.reduce((t, r)=> t + r.ms, 0), dimMax: mean(rs.map(r=> r.acc ? r.acc.dimMax : NaN)), dimMed: median(rs.map(r=> r.acc ? r.acc.dimMax : NaN)),
    orient: mean(rs.map(r=> r.acc ? r.acc.orient : NaN)), orientMed: median(rs.map(r=> r.acc ? r.acc.orient : NaN)), principal: mean(rs.map(r=> r.acc ? r.acc.principal : NaN)), principalMed: median(rs.map(r=> r.acc ? r.acc.principal : NaN)) };
}
function median(xs){ const v = xs.filter(Number.isFinite).sort((a, b)=> a - b); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length/2 - 1] + v[v.length/2])/2) : NaN; }
const byShape = {};
for (const s of [...new Set(syn.map(r=> r.shape))]){ const rs = syn.filter(r=> r.shape === s);
  byShape[s] = { runs: rs.length, reached: rs.filter(r=> r.reached).length, evals: mean(rs.map(r=> r.evals)), ms: mean(rs.map(r=> r.ms)), dimMed: median(rs.map(r=> r.acc ? r.acc.dimMax : NaN)), principalMed: median(rs.map(r=> r.acc ? r.acc.principal : NaN)) }; }
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ tag: opt.tag, refs: opt.ref || null, totals, byShape, cases, rows }, null, 1));
// table.md
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const pct = x => x == null || !Number.isFinite(x) ? '—' : (100*x).toFixed(0) + ' %';
const L = [];
L.push(`# ${opt.tag}: ${rows.length} runs${opt.ref ? ` (best χ² also from ${opt.ref})` : ''}`, '');
L.push('Δ = (χ² − best χ² any run found)/χ²_ν, of the exact solid (free or held); reached: Δ ≤ 1. Evaluations: one phase pattern each (phasePattern calls) in the search alone; time: the search alone (the isotropic fit before it excluded), one process under nice -n 15 on this 4-vCPU machine, 2 runs at a time. Errors: the reported solid against the truth (dimensions paired by size within the body\'s axis classes; orientation modulo m-3m and the body\'s symmetry; "normal": the truth\'s most distinct axis).', '');
L.push('| set | runs | reached | kept | evals (mean) | s (mean) | max dim err (median) | worst axis ° (median) | normal ° (median) |', '|---|---|---|---|---|---|---|---|---|');
for (const k in totals){ const t = totals[k]; L.push(`| ${k} | ${t.runs} | ${t.reached}/${t.judged} | ${t.kept} | ${f(t.evals, 0)} | ${f(t.ms/1000)} | ${pct(t.dimMed)} | ${f(t.orientMed)} | ${f(t.principalMed)} |`); }
L.push('', '| solid (synthetic) | runs | reached | evals | s | max dim err (median) | normal ° (median) |', '|---|---|---|---|---|---|---|');
for (const s in byShape){ const t = byShape[s]; L.push(`| ${s} | ${t.runs} | ${t.reached} | ${f(t.evals, 0)} | ${f(t.ms/1000)} | ${pct(t.dimMed)} | ${f(t.principalMed)} |`); }
L.push('', '| case | solid | outcomes | reached | Δ max | evals | s | max dim err | max extent err | worst axis ° | normal ° | precision: dim sd | precision: misorientation ° |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const c of cases) L.push(`| ${c.case} | ${c.shape} | ${[...new Set(c.outcomes)].map(o=> `${o} ×${c.outcomes.filter(x=> x === o).length}`).join(', ')} | ${c.reached}/${c.judged} | ${f(c.deltaMax)} | ${f(c.evals, 0)} | ${f(c.ms/1000)} | ${pct(c.dimMax)} | ${pct(c.dimLoose)} | ${f(c.orient)} | ${f(c.principal)} | ${pct(c.precDim)} | ${f(c.precOrient)} |`);
L.push('', '| run | outcome | ΔBIC | Δ | best by | evals | s | dims (nm, x×y×z) | dim errors | worst axis ° | normal ° |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) L.push(`| ${r.case} #${r.seed} | ${r.outcome} | ${f(r.dBIC, 0)} | ${f(r.delta, 2)} | ${r.bestBy || '—'} | ${r.evals} | ${f(r.ms/1000)} | ${r.dims ? r.dims.map(d=> f(d, 1)).join('×') : '—'} | ${r.acc ? r.acc.dimErr.map(pct).join(', ') : '—'} | ${f(r.acc && r.acc.orient)} | ${f(r.acc && r.acc.principal)} |`);
fs.writeFileSync(path.join(dir, 'table.md'), L.join('\n') + '\n');
console.log(L.slice(0, 12 + Object.keys(byShape).length + 4).join('\n'));
