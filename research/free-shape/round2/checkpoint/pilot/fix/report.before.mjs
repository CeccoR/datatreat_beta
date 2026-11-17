#!/usr/bin/env node
/* node report.mjs --tag <name>[,<name>…] [--out file.md] [--json file.json] [--sections cost,bias,baseline]
   Reads results/<tag>/*.json (run.mjs records) and writes the pilot's tables:
   - cost: per run and per Laue class, the members (in range, and in the model's list), ms
     per evaluation of today's search, evaluations and wall time of the isotropic fit, the
     search and the report, and of the truth reference;
   - bias: per solid, the extents' signed errors (truth's thinnest, middle, longest) and the
     truth's most distinct axis, for the truth reference (the Lorentzian's minimum next to
     the truth: the line-shape bias with no search in it) and for today's reported solid;
     χ²_ν at the truth reference;
   - baseline: today's search per run, and by solid, class, orientation and error kind:
     reach (Δ ≤ 1 against the truth reference), outcome, accuracy, evaluations, time.
   Δ = (today's best exact χ² − the lower of today's and the truth reference's) / max(1, χ²_ν
   of that lower fit), on truths only and not on early rejections (round 1's rule). The truth reference's ΔBIC against the isotropic fit says whether the
   data support the shape at all (a rejection is a miss only where it is under −10). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const rowOf = id => design.rows.find(r=> r.id === id);
const readResult = text => JSON.parse(text, (k, v)=> k === 'dims' && Array.isArray(v) ? v.map(d=> d == null ? Infinity : d) : v);
const runs = [];
const failed = [];
for (const tag of String(opt.tag).split(',')){
  const dir = path.join(HERE, 'results', tag);
  for (const f of fs.readdirSync(dir).filter(f=> f.endsWith('.json'))){ const o = readResult(fs.readFileSync(path.join(dir, f), 'utf8')); if (o && Array.isArray(o.records)) runs.push({ tag, ...o }); }
  const lg = path.join(dir, 'batch.log');
  if (fs.existsSync(lg)) for (const m of fs.readFileSync(lg, 'utf8').matchAll(/\] (\S+): FAILED (\S+)/g)) failed.push({ tag, id: m[1], code: m[2] });
}
const f = (x, d = 1) => x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const pc = (x, d = 0) => x == null || !Number.isFinite(x) ? '—' : (100*x >= 0 ? '+' : '') + (100*x).toFixed(d) + ' %';
const med = xs => { const s = xs.filter(Number.isFinite).sort((p, q)=> p - q); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m])/2; };
const qtl = (xs, p) => { const s = xs.filter(Number.isFinite).sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo])*(i - lo); };
const sum = xs => xs.reduce((t, x)=> t + (Number.isFinite(x) ? x : 0), 0);
const mean = xs => { const s = xs.filter(Number.isFinite); return s.length ? sum(s)/s.length : NaN; };

/* one line per run */
function digest(o){
  const row = rowOf(o.row), T = o.records.find(r=> r.method === 'today'), R = o.records.find(r=> r.method === 'truth');
  const N = o.iso ? o.iso.N : NaN;
  const d = { tag: o.tag, id: o.row, row, laue: o.laue, solid: row.solid, search: o.shape, orient: row.orient || '—', err: row.error ? row.error.kind : 'none', kernel: o.draw.kernel,
    grid: o.draw.grid, members: o.draw.info.nMembers, refl: o.draw.info.nRefl, list: o.list || null, n: o.draw.n,
    iso: o.iso, drawMs: o.draw.ms, wall: o.wall, error: o.error || (T && T.error) || null };
  if (T){
    d.out = T.error ? 'error' : T.kept ? (T.held ? 'held' : 'free') : T.rejected ? (T.early ? 'early' : 'rejected') : 'none';
    d.dBIC = T.dBIC; d.sEv = T.search.evals; d.sMs = T.search.ms; d.rEv = T.report ? T.report.evals : 0; d.rMs = T.report ? T.report.ms : 0;
    d.msEv = T.search.ms/Math.max(1, T.search.evals); d.chi2 = T.chi2Best; d.acc = T.acc || null; d.accFree = T.accFree || null; d.solidT = T.solid || null; d.rep = T.report || null;
    d.TchiNu = T.chi2nu;
  }
  if (R){
    d.ref = { chi2: R.chi2Best, P: R.P, chi2nu: R.chi2nu, acc: R.acc || null, ms: R.ms, evals: R.evals, held: R.held, solid: R.solid || null };
    if (o.iso && Number.isFinite(R.chi2Best)) d.ref.dBIC = (R.chi2Best - o.iso.chi2)/Math.max(1, o.iso.chi2nu) + (R.P - o.iso.P)*Math.log(N);
  }
  const best = Math.min(...[d.chi2, d.ref && d.ref.chi2].filter(Number.isFinite));
  // reach is judged on truths with a truth reference, and not on early rejections: their
  // only ends are the brief refinements (round 1's rule)
  if (row.kind === 'truth' && d.ref && d.out !== 'early' && Number.isFinite(d.chi2) && Number.isFinite(best)){
    const Pb = d.ref && d.ref.chi2 === best ? d.ref.P : (T && T.P) || (d.ref && d.ref.P);
    d.delta = (d.chi2 - best)/Math.max(1, best/Math.max(1, N - Pb));
  }
  // extents by the truth's own order (thinnest, middle, longest)
  if (row.kind === 'truth'){
    const ord = [0, 1, 2].sort((p, q)=> row.dims[p] - row.dims[q]);
    const by = acc => acc ? ord.map(i=> acc.dimErr[i]) : null;
    d.ord = ord; d.dimT = by(d.acc); d.dimR = d.ref ? by(d.ref.acc) : null; d.dimF = by(d.accFree);
  }
  return d;
}
const D = runs.map(digest);
const lines = [];
const sections = String(opt.sections || 'cost,bias,baseline').split(',');

if (sections.includes('cost')){
  lines.push(`## Cost (${D.length} runs: ${[...new Set(D.map(d=> d.tag))].join(', ')})`, '',
    'Per run: members in range (generator) and in the model\'s list; isotropic fit; today\'s search and report; the truth reference. Wall times in s, one process each, nice 15.', '',
    '| run | class | grid | members (list) | iso ev | iso s | search ev | ms/ev | search s | report ev | report s | iso+search+report s | truth ref s | wall s | outcome |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const d of [...D].sort((p, q)=> p.laue < q.laue ? -1 : p.laue > q.laue ? 1 : 0))
    lines.push(`| ${d.id} | ${d.laue} | ${d.grid.lo}–${d.grid.hi}/${d.grid.step} | ${d.members} (${d.list ? d.list.members : '—'}) | ${d.iso ? d.iso.evals : '—'} | ${f(d.iso && d.iso.ms/1000)} | ${d.sEv} | ${f(d.msEv)} | ${f(d.sMs/1000)} | ${d.rEv} | ${f(d.rMs/1000)} | ${f(((d.iso ? d.iso.ms : 0) + d.sMs + d.rMs)/1000)} | ${f(d.ref && d.ref.ms/1000)} | ${f(d.wall/1000)} | ${d.out} |`);
  const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
  lines.push('', 'Per Laue class (means over its runs): members in range (in the model\'s list), ms per evaluation of the search, evaluations, wall time (s).', '',
    '| class | runs | members (list) | refl. (list) | ms/ev search | iso ev | search ev | report ev | iso s | search s | report s | iso+search+report s | truth ref s |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const l of LAUE){
    const g = D.filter(d=> d.laue === l); if (!g.length) continue;
    const m = sel => mean(g.map(sel));
    lines.push(`| ${l} | ${g.length} | ${f(m(d=> d.members), 0)} (${f(m(d=> d.list && d.list.members), 0)}) | ${f(m(d=> d.refl), 0)} (${f(m(d=> d.list && d.list.refl), 0)}) | ${f(m(d=> d.msEv))} | ${f(m(d=> d.iso && d.iso.evals), 0)} | ${f(m(d=> d.sEv), 0)} | ${f(m(d=> d.rEv), 0)} | ${f(m(d=> d.iso && d.iso.ms/1000))} | ${f(m(d=> d.sMs/1000))} | ${f(m(d=> d.rMs/1000))} | ${f(m(d=> ((d.iso ? d.iso.ms : 0) + d.sMs + d.rMs)/1000))} | ${f(m(d=> d.ref && d.ref.ms/1000))} |`);
  }
  const tot = D.map(d=> ((d.iso ? d.iso.ms : 0) + d.sMs + d.rMs)/1000);
  lines.push('', `Mean iso+search+report: ${f(mean(tot))} s (median ${f(med(tot))}, max ${f(Math.max(...tot))}); mean whole run with the truth reference and drawing: ${f(mean(D.map(d=> d.wall/1000)))} s; ms per evaluation of the search: median ${f(med(D.map(d=> d.msEv)))}, ${f(Math.min(...D.map(d=> d.msEv)))}–${f(Math.max(...D.map(d=> d.msEv)))}.`, '');
}

const solids = ['box', 'sqbox', 'cylinder', 'ellcyl', 'ellipsoid', 'spheroid'];
if (sections.includes('bias')){
  const tr = D.filter(d=> d.row.kind === 'truth');
  lines.push(`## Line-shape bias (${tr.length} truths)`, '',
    'Signed errors of the extents, the truth\'s thinnest, middle and longest (median, and the 10th–90th percentiles); the truth\'s most distinct axis (°, median and 90th percentile). "ref": the truth reference (refined from the truth, no search); "today": today\'s reported solid (kept runs). χ²_ν: the truth reference\'s.', '',
    '| solid | kernel | runs | ref thinnest | ref middle | ref longest | ref axis ° | ref χ²_ν | today kept | today thinnest | today longest | today axis ° |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of [...new Set(tr.map(d=> d.kernel))]) for (const s of solids){
    const g = tr.filter(d=> d.solid === s && d.kernel === k); if (!g.length) continue;
    const col = (key, j) => g.map(d=> d[key] ? d[key][j] : NaN);
    const rng3 = xs => `${pc(med(xs))} (${pc(qtl(xs, 0.1))}…${pc(qtl(xs, 0.9))})`;
    const ax = (sel) => { const xs = g.map(sel); return `${f(med(xs))} (${f(qtl(xs, 0.9))})`; };
    const kept = g.filter(d=> d.acc);
    lines.push(`| ${s} | ${k} | ${g.length} | ${rng3(col('dimR', 0))} | ${rng3(col('dimR', 1))} | ${rng3(col('dimR', 2))} | ${ax(d=> d.ref && d.ref.acc ? d.ref.acc.principal : NaN)} | ${f(med(g.map(d=> d.ref && d.ref.chi2nu)), 2)} | ${kept.length} | ${rng3(kept.map(d=> d.dimT[0]))} | ${rng3(kept.map(d=> d.dimT[2]))} | ${f(med(kept.map(d=> d.acc.principal)))} (${f(qtl(kept.map(d=> d.acc.principal), 0.9))}) |`);
  }
  // by error kind (the truth reference: the model's minimum next to the truth)
  lines.push('', 'By the model error (truth reference, all solids):', '', '| error | runs | ref thinnest | ref middle | ref longest | ref axis ° | ref χ²_ν |', '|---|---|---|---|---|---|---|');
  for (const e of ['none', 'hump', 'sizedist', 'impurity', 'air', 'po']){
    const g = tr.filter(d=> d.err === e && d.kernel === 'exact'); if (!g.length) continue;
    const col = j => g.map(d=> d.dimR ? d.dimR[j] : NaN), rng3 = xs => `${pc(med(xs))} (${pc(qtl(xs, 0.1))}…${pc(qtl(xs, 0.9))})`;
    const ax = g.map(d=> d.ref && d.ref.acc ? d.ref.acc.principal : NaN);
    lines.push(`| ${e} | ${g.length} | ${rng3(col(0))} | ${rng3(col(1))} | ${rng3(col(2))} | ${f(med(ax))} (${f(qtl(ax, 0.9))}) | ${f(med(g.map(d=> d.ref && d.ref.chi2nu)), 2)} |`);
  }
  // by Laue class, clean truths
  lines.push('', 'By Laue class (truth reference, clean truths):', '', '| class | runs | ref thinnest | ref longest | longest/thinnest read ÷ true | ref axis ° |', '|---|---|---|---|---|---|');
  for (const l of ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m']){
    const g = tr.filter(d=> d.laue === l && d.err === 'none' && d.kernel === 'exact'); if (!g.length) continue;
    const an = g.map(d=> d.dimR ? (1 + d.dimR[2])/(1 + d.dimR[0]) : NaN), ax = g.map(d=> d.ref && d.ref.acc ? d.ref.acc.principal : NaN);
    lines.push(`| ${l} | ${g.length} | ${pc(med(g.map(d=> d.dimR ? d.dimR[0] : NaN)))} | ${pc(med(g.map(d=> d.dimR ? d.dimR[2] : NaN)))} | ${f(med(an), 2)} (${f(qtl(an, 0.1), 2)}…${f(qtl(an, 0.9), 2)}) | ${f(med(ax))} (${f(qtl(ax, 0.9))}) |`);
  }
  lines.push('', '| run | kernel | dims nm | ref dims nm | ref thinnest | middle | longest | ref axis ° | ref orient ° | ref χ²_ν | today | today thinnest | middle | longest | today axis ° |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const d of [...tr].sort((p, q)=> (p.solid + p.id) < (q.solid + q.id) ? -1 : 1))
    lines.push(`| ${d.id} | ${d.kernel} | ${d.row.dims.map(x=> f(x)).join('×')} | ${d.ref && d.ref.solid ? d.ref.solid.dims.map(x=> f(x)).join('×') : '—'} | ${d.dimR ? d.dimR.map(x=> pc(x)).join(' | ') : '— | — | —'} | ${f(d.ref && d.ref.acc && d.ref.acc.principal)} | ${f(d.ref && d.ref.acc && d.ref.acc.orient)} | ${f(d.ref && d.ref.chi2nu, 2)} | ${d.out} | ${d.dimT ? d.dimT.map(x=> pc(x)).join(' | ') : '— | — | —'} | ${f(d.acc && d.acc.principal)} |`);
  lines.push('');
}

if (sections.includes('baseline')){
  lines.push(`## Today's search (${D.length} runs)`, '');
  const show = (title, key, ks) => {
    lines.push(`| ${title} | runs | held | free | rejected (early) | reached / judged | Δ>1 | ref ΔBIC<−10, today rejected | worst dim, median (90 %) | thinnest, median | axis °, median (90 %) | axis ° holohedry, median | search ev | search s | report s | iso s |`, '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const k of ks){
      const g = D.filter(d=> (typeof key === 'function' ? key(d) : d[key]) === k); if (!g.length) continue;
      const judged = g.filter(d=> Number.isFinite(d.delta)), reached = judged.filter(d=> d.delta <= 1);
      const missed = g.filter(d=> (d.out === 'early' || d.out === 'rejected') && d.ref && d.ref.dBIC < -10);
      const kept = g.filter(d=> d.acc);
      lines.push(`| ${k} | ${g.length} | ${g.filter(d=> d.out === 'held').length} | ${g.filter(d=> d.out === 'free').length} | ${g.filter(d=> d.out === 'rejected' || d.out === 'early').length} (${g.filter(d=> d.out === 'early').length}) | ${reached.length} / ${judged.length} | ${judged.length - reached.length} | ${missed.length} | ${kept.length ? pc(med(kept.map(d=> d.acc.dimMax))) + ' (' + pc(qtl(kept.map(d=> d.acc.dimMax), 0.9)) + ')' : '—'} | ${kept.length ? pc(med(kept.map(d=> d.dimT ? d.dimT[0] : NaN))) : '—'} | ${kept.length ? f(med(kept.map(d=> d.acc.principal))) + ' (' + f(qtl(kept.map(d=> d.acc.principal), 0.9)) + ')' : '—'} | ${kept.length ? f(med(kept.map(d=> d.acc.principalHolo))) : '—'} | ${f(mean(g.map(d=> d.sEv)), 0)} | ${f(mean(g.map(d=> d.sMs/1000)))} | ${f(mean(g.map(d=> d.rMs/1000)))} | ${f(mean(g.map(d=> d.iso && d.iso.ms/1000)))} |`);
    }
    lines.push('');
  };
  const isT = d => d.row.kind === 'truth' ? 'truths' : 'spheres';
  show('set', isT, ['truths', 'spheres']);
  show('solid', d=> d.row.kind === 'truth' ? d.solid : null, solids);
  show('sphere searched as', d=> d.row.kind === 'sphere' ? d.search : null, solids);
  show('class', 'laue', ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m']);
  show('orientation', d=> d.row.kind === 'truth' ? d.orient : null, ['on', 'near', 'generic']);
  show('error (truths)', d=> d.row.kind === 'truth' ? d.err : null, ['none', 'hump', 'sizedist', 'impurity', 'air', 'po']);
  show('error (spheres)', d=> d.row.kind === 'sphere' ? d.err : null, ['none', 'hump', 'sizedist', 'impurity', 'air', 'po']);
  lines.push('| run | class | solid (searched) | orient | error | iso χ²_ν | outcome | ΔBIC | ref ΔBIC | Δ | worst dim | thinnest | axis ° | axis ° holo | search ev | search s | report s |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const d of [...D].sort((p, q)=> p.id < q.id ? -1 : 1))
    lines.push(`| ${d.id} | ${d.laue} | ${d.solid}${d.solid !== d.search ? ' (' + d.search + ')' : ''} | ${d.orient} | ${d.err}${d.row.error ? ' ' + f(d.row.error.strength, 2) : ''} | ${f(d.iso && d.iso.chi2nu, 2)} | ${d.out} | ${f(d.dBIC, 0)} | ${f(d.ref && d.ref.dBIC, 0)} | ${f(d.delta, 2)} | ${d.acc ? pc(d.acc.dimMax) : '—'} | ${d.dimT ? pc(d.dimT[0]) : '—'} | ${f(d.acc && d.acc.principal)} | ${f(d.acc && d.acc.principalHolo)} | ${d.sEv} | ${f(d.sMs/1000)} | ${f(d.rMs/1000)} |`);
  lines.push('', `Failures: ${failed.length ? failed.map(x=> x.id + ' (' + x.code + ')').join(', ') : 'none'}; records with an error: ${D.filter(d=> d.error).map(d=> d.id).join(', ') || 'none'}.`, '');
}
const text = lines.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, text);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(D.map(({ row, rep, solidT, ...d })=> d)));
console.log(text);
