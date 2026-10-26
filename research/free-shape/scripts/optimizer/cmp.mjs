#!/usr/bin/env node
/* node cmp.mjs tag1 tag2 … [--md out.md] [--json out.json]
   Compares variants run by pbatch.mjs with the baseline (harness/results/baseline) on the
   runs each has: Δ against the best exact χ² any run found (the baseline's, the truth
   reference's, every tag's), reached (Δ ≤ 1), the outcome against the baseline's, the
   evaluations and wall time (mean, and as a ratio of the baseline's on the same runs),
   the accuracy against the truth (synthetic and sample-like: largest dimension error,
   normal), and how far the reported solid lies from the baseline's (sameSolid). */
import fs from 'node:fs';
import path from 'node:path';
import { readResult, compareSolids, sameSolid, CASES } from './h/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const a = process.argv.slice(2), tags = [], opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ opt[a[i].slice(2)] = a[++i]; } else tags.push(a[i]); }
const load = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f=> f.endsWith('.json') && !['summary.json'].includes(f)).map(f=> readResult(fs.readFileSync(path.join(d, f), 'utf8'))).filter(r=> r.records) : [];
const key = r => `${r.case}|${r.seed}`;
const base = new Map(load(path.join(HERE, '..', 'harness', 'results', 'baseline')).map(r=> [key(r), r]));
// --only pilot|robust|sample|synth: the runs compared
const PILOT = ['box-plate110:1', 'box-plate110-t20:1', 'box-plate110-off8:2', 'box-needle111:1', 'box-ribbon001:1', 'box-plate111-big:1', 'sqbox-plate110-t15:1', 'sqbox-plate-rand:1', 'ell-plate110:1', 'ell-ribbon-rand:1', 'sph-oblate-rand:1', 'cyl-disc111-off8:1', 'ecyl-ribbon001:1', 'ecyl-rand:1', 'u03:1', 'u09:1', 'u10:1', 'iso-7:1'];
const ONLY = opt.only === 'pilot' ? new Set(PILOT) : opt.only === 'robust' ? new Set([...PILOT, ...CASES.filter(c=> c.kind === 'sample').map(c=> c.id + ':1')]) : null;
const keep = r => !opt.only ? true : ONLY ? ONLY.has(`${r.case}:${r.seed}`) : r.kind === opt.only;
const runsBy = Object.fromEntries(tags.map(t=> [t, load(path.join(HERE, 'results', t)).filter(keep)]));
// The brief refinements of a sub-model variant (stride: every 2nd or 3rd point) log χ² on
// their own points: its exact χ² is taken from the refinements on all points alone.
const STRIDE = new Set(['p-stride2', 'p-stride3', 'p-c6']);
for (const t of tags) if (STRIDE.has(t)) for (const r of runsBy[t]) for (const m of r.records){
  const ball = ['ellipsoid', 'spheroid'].includes(r.shape);
  const ex = (m.log || []).filter(e=> e.mi > 8 && Number.isFinite(e.c) && !e.err && (!e.soft || ball)).map(e=> e.c);
  m.chi2Best = ex.length ? Math.min(...ex) : NaN;
}
// --tref <tag>: the wall times as a ratio of that tag's on the same runs (run under the same load)
const tref = opt.tref ? new Map(load(path.join(HERE, 'results', opt.tref)).map(r=> [key(r), r.records.find(m=> m.method !== 'truth')])) : null;
// the best exact χ² per run: every record of every source
const best = new Map();
const note = (r, m) => { const c = m.chi2Best; if (!Number.isFinite(c)) return; const k = key(r), nu = Math.max(1, c/Math.max(1, r.iso.N - (m.P || r.iso.P))); if (!best.has(k) || c < best.get(k).c) best.set(k, { c, nu }); };
for (const r of base.values()) for (const m of r.records) note(r, m);
for (const t of tags) for (const r of runsBy[t]) for (const m of r.records) note(r, m);
const med = xs => { const v = xs.filter(Number.isFinite).sort((p, q)=> p - q); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length/2 - 1] + v[v.length/2])/2) : NaN; };
const mean = xs => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((s, x)=> s + x, 0)/v.length : NaN; };
const outc = m => m.error ? 'error' : m.kept ? (m.held ? 'held' : 'free') : m.rejected ? 'rejected' : 'none';
const rowsOut = [], perRun = {};
const f = (x, d = 1) => Number.isFinite(x) ? x.toFixed(d) : '—';
for (const t of tags){
  const rows = [];
  for (const r of runsBy[t]){
    const m = r.records.find(m=> m.method !== 'truth'), b0 = base.get(key(r)), bm = b0 && b0.records[0];
    if (!m || !bm) continue;
    const bb = best.get(key(r));
    const delta = bb && Number.isFinite(m.chi2Best) ? (m.chi2Best - bb.c)/bb.nu : NaN, dBase = bb && Number.isFinite(bm.chi2Best) ? (bm.chi2Best - bb.c)/bb.nu : NaN;
    const same = m.solid && bm.solid ? sameSolid(m.solid, bm.solid) : (!m.solid && !bm.solid);
    const vsBase = m.solid && bm.solid ? compareSolids(m.solid, bm.solid) : null;
    const cost = Number.isFinite(m.evalEq) ? m.evalEq + (m.mjMs > 0 ? m.mjMs*m.evals/Math.max(1, m.ms - m.mjMs) : 0) : m.evals;
    const tr = tref && tref.get(key(r));
    rows.push({ run: key(r), kind: r.kind, cost, evals: m.evals, tMs: tr ? tr.ms : NaN, ms: m.ms, bEvals: bm.evals, bMs: bm.ms, delta, dBase, out: outc(m), bOut: outc(bm), same,
      dimVsBase: vsBase ? vsBase.dimMax : NaN, orVsBase: vsBase ? vsBase.orient : NaN,
      dim: m.acc ? m.acc.dimMax : NaN, prin: m.acc ? m.acc.principal : NaN, bDim: bm.acc ? bm.acc.dimMax : NaN, bPrin: bm.acc ? bm.acc.principal : NaN, err: m.error });
  }
  perRun[t] = rows;
  const judged = rows.filter(r=> Number.isFinite(r.delta)), bj = rows.filter(r=> Number.isFinite(r.dBase));
  rowsOut.push({ tag: t, runs: rows.length, evals: mean(rows.map(r=> r.evals)), evalRatio: mean(rows.map(r=> r.evals))/mean(rows.map(r=> r.bEvals)), cost: mean(rows.map(r=> r.cost)), costRatio: mean(rows.map(r=> r.cost))/mean(rows.map(r=> r.bEvals)),
    ms: mean(rows.map(r=> r.ms)), msRatio: tref ? mean(rows.filter(r=> Number.isFinite(r.tMs)).map(r=> r.ms))/mean(rows.filter(r=> Number.isFinite(r.tMs)).map(r=> r.tMs)) : mean(rows.map(r=> r.ms))/mean(rows.map(r=> r.bMs)),
    reached: judged.filter(r=> r.delta <= 1).length, judged: judged.length, bReached: bj.filter(r=> r.dBase <= 1).length, bJudged: bj.length,
    dMax: Math.max(...judged.map(r=> r.delta), -Infinity), outMatch: rows.filter(r=> r.out === r.bOut).length, same: rows.filter(r=> r.same).length,
    dimMed: med(rows.map(r=> r.dim)), bDimMed: med(rows.map(r=> r.bDim)), prinMed: med(rows.map(r=> r.prin)), prin90: (()=>{ const v = rows.map(r=> r.prin).filter(Number.isFinite).sort((p, q)=> p - q); return v.length ? v[Math.floor(0.9*(v.length - 1))] : NaN; })(),
    errors: rows.filter(r=> r.err).length });
}
const L = [`| variant | runs | evals (mean) | × baseline | eval-equivalents × baseline | s (mean) | × ${opt.tref || 'baseline'} | reached | baseline reached | Δ max | outcome = baseline | same solid as baseline | max dim err (median; baseline) | normal ° (median / 90th) |`, '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const o of rowsOut) L.push(`| ${o.tag} | ${o.runs} | ${f(o.evals, 0)} | ${f(o.evalRatio, 2)} | ${f(o.costRatio, 2)} | ${f(o.ms/1000)} | ${f(o.msRatio, 2)} | ${o.reached}/${o.judged} | ${o.bReached}/${o.bJudged} | ${f(o.dMax, 2)} | ${o.outMatch}/${o.runs} | ${o.same}/${o.runs} | ${f(100*o.dimMed, 0)} %; ${f(100*o.bDimMed, 0)} % | ${f(o.prinMed)} / ${f(o.prin90)} |`);
console.log(L.join('\n'));
if (opt.v) for (const t of tags){ console.log('\n' + t); for (const r of perRun[t]) console.log(`  ${r.run.padEnd(22)} ${String(r.evals).padStart(5)} (${r.bEvals}) Δ ${f(r.delta, 2)} (${f(r.dBase, 2)}) ${r.out}/${r.bOut} same ${r.same} dim ${f(100*r.dim, 0)}% (${f(100*r.bDim, 0)}%) normal ${f(r.prin)} (${f(r.bPrin)}) vsBase ${f(100*r.dimVsBase, 0)}% ${f(r.orVsBase)}°${r.err ? ' ERR ' + r.err.split('\n')[0] : ''}`); }
if (opt.md) fs.writeFileSync(opt.md, L.join('\n') + '\n');
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ tags, summary: rowsOut, perRun }, null, 1));
