// Compare search methods on the runs they all have.
// node compare.mjs --tags t1,t2 [--methods a,b] [--json out.json] [--runs]
// Reads fs/starts/results/<tag>/*.json and the harness's baseline (its 'baseline' and 'truth'
// records). Δ = (chi2Best − the best chi2Best of any record of any tag for that case, seed
// and solid)/max(1, χ²_ν); reached Δ ≤ 1 (rejected early: not judged). Per method: runs,
// reached, outcomes and those that differ from the baseline's, evaluations and time by set,
// accuracy of the kept synthetic runs (largest relative dimension error, the smallest
// dimension's, the truth's most distinct axis), sample-like proxies (thickness, normal),
// precision per synthetic case over its seeds (sd of the dimension errors, mean pairwise
// misorientation).
import fs from 'node:fs'; import path from 'node:path';
const H = new URL('../../', import.meta.url).pathname + 'harness';
const ST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { readResult, compareSolids, CASES, truthOf } = await import(H + '/lib.mjs');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const load = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f=> f.endsWith('.json') && f !== 'summary.json').map(f=> readResult(fs.readFileSync(path.join(d, f), 'utf8'))).filter(r=> r.records) : [];
const tags = String(opt.tags || '').split(',').filter(Boolean);
const runs = [...load(path.join(H, 'results', 'baseline')).map(r=> ({ ...r, tag: 'baseline' })), ...tags.flatMap(t=> load(path.join(ST, 'results', t)).map(r=> ({ ...r, tag: t })))];
const key = r => `${r.case}|${r.seed}|${r.shape}`;
const best = new Map();
for (const r of runs) for (const m of r.records){
  const c = m.chi2Best;
  if (Number.isFinite(c) && (!best.has(key(r)) || c < best.get(key(r)).c)) best.set(key(r), { c, nu: Math.max(1, c/Math.max(1, r.iso.N - (m.P || r.iso.P))) });
}
// one record per (method, run)
const recs = new Map();
for (const r of runs) for (const m of r.records){
  if (m.method === 'truth') continue;
  const k = m.method; if (!recs.has(k)) recs.set(k, new Map());
  recs.get(k).set(key(r), { r, m, first: r.records[0] === m });
}
let methods = opt.methods ? String(opt.methods).split(',') : [...recs.keys()];
methods = methods.filter(m=> recs.has(m));
// the runs every method has
let common = [...recs.get(methods[0]).keys()].filter(k=> methods.every(m=> recs.get(m).has(k)));
if (opt.kinds){ const ks = String(opt.kinds).split(','); common = common.filter(k=> ks.includes(recs.get(methods[0]).get(k).r.kind)); }
const outcome = m => m.error ? 'error' : m.kept ? (m.held ? 'held' : 'free') : m.rejected ? (m.early ? 'rej-early' : 'rejected') : 'none';
const mean = xs => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((t, x)=> t + x, 0)/v.length : NaN; };
const sd = xs => { const v = xs.filter(Number.isFinite); if (v.length < 2) return NaN; const mu = mean(v); return Math.sqrt(v.reduce((t, x)=> t + (x - mu)**2, 0)/(v.length - 1)); };
const q = (xs, p) => { const v = xs.filter(Number.isFinite).sort((x, y)=> x - y); if (!v.length) return NaN; const i = p*(v.length - 1), lo = Math.floor(i); return v[lo] + (v[Math.min(v.length - 1, lo + 1)] - v[lo])*(i - lo); };
const out = {};
for (const meth of methods){
  const rows = common.map(k=> {
    const { r, m, first } = recs.get(meth).get(k), b = best.get(k), bl = recs.get('baseline') && recs.get('baseline').get(k);
    const delta = b && Number.isFinite(m.chi2Best) ? (m.chi2Best - b.c)/b.nu : NaN;
    const truth = r.truth || ((r.kind === 'synth' || r.kind === 'sample') && r.truthType === r.shape ? truthOf(CASES.find(c=> c.id === r.case)).solid : null);
    // the smallest dimension's error (a plate's thickness, a needle's section)
    let minErr = NaN;
    if (m.acc && truth){ const i = [0, 1, 2].sort((x, y)=> truth.dims[x] - truth.dims[y])[0]; minErr = m.acc.dimErr[i]; }
    return { k, case: r.case, seed: r.seed, kind: r.kind, shape: r.shape, out: outcome(m), base: bl ? outcome(bl.m) : null, delta, reached: Number.isFinite(delta) ? delta <= 1 : null,
      evals: m.evals, ms: m.ms, first, acc: m.acc, minErr, solid: m.solid, chi2Best: m.chi2Best };
  });
  const by = kind => rows.filter(r=> r.kind === kind);
  const syn = by('synth'), kept = syn.filter(r=> r.acc), smp = by('sample').filter(r=> r.acc);
  // precision per synthetic case over its seeds
  const prec = [];
  for (const c of new Set(syn.map(r=> r.case))){
    const rs = syn.filter(r=> r.case === c && r.solid);
    if (rs.length < 2) continue;
    const mis = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++){ const s = compareSolids(rs[i].solid, rs[j].solid); if (s.orient != null) mis.push(s.orient); }
    prec.push({ case: c, dimSd: Math.max(...[0, 1, 2].map(ax=> sd(rs.map(r=> r.acc ? r.acc.dimErr[ax] : NaN))).filter(Number.isFinite), -Infinity), mis: mean(mis) });
  }
  const set = rs => ({ n: rs.length, evals: mean(rs.map(r=> r.evals)), ms: mean(rs.map(r=> r.ms)), msFirst: mean(rs.filter(r=> r.first).map(r=> r.ms)), nFirst: rs.filter(r=> r.first).length });
  out[meth] = {
    runs: rows.length, judged: rows.filter(r=> r.reached != null).length, reached: rows.filter(r=> r.reached).length,
    misses: rows.filter(r=> r.reached === false).map(r=> `${r.case}#${r.seed} Δ ${r.delta.toFixed(1)}`),
    miss3: rows.filter(r=> r.delta > 3).length, miss3s: rows.filter(r=> r.delta > 3 && r.kind === 'sample').length, dSampleMean: mean(rows.filter(r=> r.kind === 'sample').map(r=> r.delta)),
    outDiff: rows.filter(r=> r.base && r.out !== r.base && !(/rej/.test(r.out) && /rej/.test(r.base))).map(r=> `${r.case}#${r.seed} ${r.base}→${r.out}`),
    kept: rows.filter(r=> r.out === 'held' || r.out === 'free').length,
    all: set(rows), synth: set(syn), sample: set(by('sample')), control: set([...by('control'), ...by('fixture')]),
    acc: { n: kept.length, dimMed: q(kept.map(r=> r.acc.dimMax), 0.5), dimP90: q(kept.map(r=> r.acc.dimMax), 0.9), minMed: q(kept.map(r=> Math.abs(r.minErr)), 0.5), minP90: q(kept.map(r=> Math.abs(r.minErr)), 0.9),
      prinMed: q(kept.map(r=> r.acc.principal), 0.5), prinP90: q(kept.map(r=> r.acc.principal), 0.9), prinMax: q(kept.map(r=> r.acc.principal), 1), orientMed: q(kept.map(r=> r.acc.orient), 0.5) },
    smp: { n: smp.length, thinMed: q(smp.map(r=> r.minErr), 0.5), prinMed: q(smp.map(r=> r.acc.principal), 0.5) },
    prec: { n: prec.length, dimSdMed: q(prec.map(p=> p.dimSd), 0.5), misMed: q(prec.map(p=> p.mis), 0.5), misMean: mean(prec.map(p=> p.mis)) },
    rows,
  };
}
const f = (x, d = 0) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const pc = x => x == null || !Number.isFinite(x) ? '—' : (100*x).toFixed(0) + ' %';
console.log(`${common.length} runs common to ${methods.join(', ')}\n`);
console.log('| method | reached (Δ ≤ 1) | Δ > 3 (of which proxies) | proxies: mean Δ | outcome ≠ baseline | evals synth | evals sample | evals ctrl | evals all | s all | s (first in process) | dim err med / p90 | thinnest med / p90 | normal ° med / p90 / max | precision: dim sd med, misor. ° med / mean |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const m of methods){ const o = out[m];
  console.log(`| ${m} | ${o.reached}/${o.judged} | ${o.miss3} (${o.miss3s}) | ${f(o.dSampleMean, 1)} | ${o.outDiff.length} | ${f(o.synth.evals)} | ${f(o.sample.evals)} | ${f(o.control.evals)} | ${f(o.all.evals)} | ${f(o.all.ms/1000, 1)} | ${f(o.all.msFirst/1000, 1)} (${o.all.nFirst}) | ${pc(o.acc.dimMed)} / ${pc(o.acc.dimP90)} | ${pc(o.acc.minMed)} / ${pc(o.acc.minP90)} | ${f(o.acc.prinMed, 1)} / ${f(o.acc.prinP90, 1)} / ${f(o.acc.prinMax, 1)} | ${pc(o.prec.dimSdMed)}, ${f(o.prec.misMed, 1)} / ${f(o.prec.misMean, 1)} |`); }
console.log('');
for (const m of methods){ const o = out[m]; if (o.misses.length || o.outDiff.length) console.log(`${m}: misses ${o.misses.join('; ') || 'none'}; outcomes changed ${o.outDiff.join('; ') || 'none'}`); }
if (opt.runs){
  console.log('\n| run | ' + methods.join(' | ') + ' |'); console.log('|---|' + methods.map(()=> '---|').join(''));
  for (const k of common){ const r0 = out[methods[0]].rows.find(r=> r.k === k); console.log(`| ${r0.case}#${r0.seed} | ` + methods.map(m=> { const r = out[m].rows.find(r=> r.k === k); return `${r.out} Δ${f(r.delta, 1)} ${r.evals}`; }).join(' | ') + ' |'); }
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(Object.fromEntries(methods.map(m=> [m, { ...out[m], rows: undefined }])), null, 1));
if (opt.bysolid){
  const shapes = [...new Set(out[methods[0]].rows.filter(r=> r.kind === 'synth').map(r=> r.shape))];
  console.log('\n| solid (synthetic) | runs | ' + methods.map(m=> `${m}: evals, reached`).join(' | ') + ' |'); console.log('|---|---|' + methods.map(()=> '---|').join(''));
  for (const s of shapes){ const rs = m => out[m].rows.filter(r=> r.kind === 'synth' && r.shape === s);
    console.log(`| ${s} | ${rs(methods[0]).length} | ` + methods.map(m=> `${f(mean(rs(m).map(r=> r.evals)))}, ${rs(m).filter(r=> r.reached).length}/${rs(m).filter(r=> r.reached != null).length}`).join(' | ') + ' |'); }
}
