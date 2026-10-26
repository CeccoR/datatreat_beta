// One reference for every search tried on the 110 harness runs: Δ against the lowest exact χ²
// (chi2Best: the exact solid, free or held) that any record of any study found for that case and
// seed, divided by max(1, χ²_ν) of that best fit (the harness's table.mjs definition). Reads
// results only; runs nothing.
//   node common.mjs <fs folder> [--md out.md] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';

const FS = path.resolve(process.argv[2] || '.');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const rd = d => fs.existsSync(d) ? fs.readdirSync(d) : [];
const isDir = d => fs.existsSync(d) && fs.statSync(d).isDirectory();

// Result folders: the harness baseline (with the truth reference), the starts study's rounds, the
// optimiser study's batches (the stride variants, whose sub-model χ² are on half the points, and the
// configuration-bug batch left out), the uniqueness study's main batch (the app's search).
const OPT = path.join(FS, 'optimizer/results');
const folders = [
  'harness/results/baseline',
  ...['r1', 'r2b', 'r3', 'r4'].map(d => 'starts/results/' + d),
  ...rd(OPT).filter(d => isDir(path.join(OPT, d)) && !['baseline', 'p-stride2', 'p-c6', 'p-c4-buggy'].includes(d) && !d.startsWith('t-')).map(d => 'optimizer/results/' + d),
  'uniqueness/results/main',
];

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/\bInfinity\b/g, '1e308'));
const runs = new Map();          // key -> { kind, case, seed, iso, recs: [{ tag, method, ... }] }
for (const d of folders) {
  const dir = path.join(FS, d), tag = path.basename(d);
  for (const f of rd(dir).filter(f => f.endsWith('.json') && !/^(compare|summary|stages|coverage)/.test(f))) {
    let j; try { j = readJSON(path.join(dir, f)); } catch { continue; }
    if (!j.records) continue;
    const key = `${j.case}#${j.seed}`;
    if (!runs.has(key)) runs.set(key, { case: j.case, seed: j.seed, kind: j.kind, iso: j.iso, recs: [] });
    for (const m of j.records) runs.get(key).recs.push({ tag, ...m, log: undefined });
  }
}

// The reference per run.
for (const r of runs.values()) {
  let best = null;
  for (const m of r.recs) {
    const c = m.chi2Best;
    if (Number.isFinite(c) && c < 1e300 && (!best || c < best.c)) best = { c, nu: Math.max(1, c / Math.max(1, r.iso.N - (m.P || r.iso.P))), by: `${m.tag}:${m.method}` };
  }
  r.best = best;
}

// The full-set searches (110 runs each).
const SETS = [
  ['app (baseline)', 'baseline', 'baseline'],
  ['fwd', 'f-fwd', 'fwd'],
  ['c1 = fwd + halving', 'f-c1', 'c1'],
  ['c4 = c1 + frames screened', 'f-c4', 'c4'],
  ['cfam', 'r2b', 'cfam'],
  ['6 screened picks', 'r2b', 'c6'],
  ['a4', ['r3', 'r4'], 'a4'],
  ['a3', 'r2b', 'a3'],
];
const outcome = m => m.rejected ? (m.early ? 'rejected early' : 'rejected') : m.kept ? (m.held ? 'held' : 'free') : 'none';
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
const rows = [], per = {};
for (const [label, tags, meth] of SETS) {
  const tg = [].concat(tags), list = [];
  for (const r of runs.values()) {
    const m = r.recs.find(x => tg.includes(x.tag) && x.method === meth);
    if (!m) continue;
    const base = r.recs.find(x => x.tag === 'baseline' && x.method === 'baseline');
    const delta = r.best && Number.isFinite(m.chi2Best) && m.chi2Best < 1e300 ? (m.chi2Best - r.best.c) / r.best.nu : NaN;
    list.push({ key: `${r.case}#${r.seed}`, kind: r.kind, evals: m.evals, ms: m.ms, delta, out: outcome(m), same: base ? outcome(base) === outcome(m) : null });
  }
  per[label] = list;
  const judged = list.filter(x => Number.isFinite(x.delta));
  const samp = list.filter(x => x.kind === 'sample');
  const by = k => mean(list.filter(x => x.kind === k).map(x => x.evals));
  rows.push({
    label, runs: list.length,
    reached: judged.filter(x => x.delta <= 1).length, judged: judged.length,
    over3: judged.filter(x => x.delta > 3).length, over3s: judged.filter(x => x.delta > 3 && x.kind === 'sample').length,
    sampReached: samp.filter(x => Number.isFinite(x.delta) && x.delta <= 1).length, samp: samp.length,
    sampMean: mean(samp.filter(x => Number.isFinite(x.delta)).map(x => x.delta)),
    sameOutcome: list.filter(x => x.same).length,
    evals: mean(list.map(x => x.evals)), synth: by('synth'), sample: by('sample'), ctrl: mean(list.filter(x => x.kind !== 'synth' && x.kind !== 'sample').map(x => x.evals)),
    misses: judged.filter(x => x.delta > 1).sort((a, b) => b.delta - a.delta).map(x => `${x.key} ${x.delta.toFixed(1)}`),
  });
}
const base = rows[0];
const f0 = x => Number.isFinite(x) ? x.toFixed(0) : '—';
const L = [];
L.push(`Δ against the lowest exact χ² any record of any study found (${[...runs.values()].filter(r => r.best).length} runs with an exact fit; folders: ${folders.join(', ')}).`, '');
L.push('| search | runs | evaluations (× app) | synthetic | sample-like | controls, fixtures | reached Δ ≤ 1 | Δ > 3 (proxies) | proxies reached, mean Δ | outcome as the app |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) L.push(`| ${r.label} | ${r.runs} | ${f0(r.evals)} (${(r.evals / base.evals).toFixed(2)}) | ${f0(r.synth)} | ${f0(r.sample)} | ${f0(r.ctrl)} | ${r.reached}/${r.judged} | ${r.over3} (${r.over3s}) | ${r.sampReached}/${r.samp}, ${r.sampMean.toFixed(2)} | ${r.sameOutcome}/${r.runs} |`);
L.push('');
for (const r of rows) L.push(`- ${r.label} misses: ${r.misses.join('; ') || 'none'}`);
const bestBy = {};
for (const r of runs.values()) if (r.best) bestBy[r.best.by] = (bestBy[r.best.by] || 0) + 1;
L.push('', 'Which record holds the reference: ' + Object.entries(bestBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
const md = L.join('\n');
console.log(md);
if (arg('--md')) fs.writeFileSync(arg('--md'), md + '\n');
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify({ rows, per }, null, 1));
