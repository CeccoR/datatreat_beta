#!/usr/bin/env node
/* Track A's tables: one column block per variant (a folder of run.mjs records), over a fixed
   row list, scored as the pilot's report.mjs scores (its digest, its medians with +∞ kept).
   node analyse.mjs --v lor=../pilot/results/screen,ib=results/tr-ib,... [--rows subscreen|subclean|screen|spheres|truths]
                    [--sections ref,search,spheres,rows] [--out file.md] [--json file.json]
   - ref: the truth reference (the model's minimum next to the truth): the truth's thinnest,
     middle and longest extent (signed, median and 10th–90th percentiles), the worst |error|,
     the truth's most distinct axis (principal, °), χ²_ν, its ΔBIC against the variant's own
     isotropic fit, the anisotropy longest/thinnest read ÷ true per Laue class (clean rows);
   - search: today's search with the variant's line (outcome, reach against the variant's own
     truth reference, accuracy of the kept solid, evaluations, ms per evaluation, wall time);
   - spheres: the screening spheres, kept or not and their ΔBIC. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { readResult } = await import('./harness/lib.mjs');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i++){ if (a[i].startsWith('--')){ const k = a[i].slice(2); opt[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } }
const design = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'design', 'design.json'), 'utf8'));
const rowOf = id => design.rows.find(r=> r.id === id);
const sub = fs.readFileSync(path.join(HERE, 'subscreen.txt'), 'utf8').split('\n').filter(l=> l && !l.startsWith('#')).map(l=> l.trim().split(/\s+/));
const sel = String(opt.rows || 'subscreen');
const ids = sel === 'subscreen' ? sub.map(s=> s[0]) : sel === 'subclean' ? sub.filter(s=> s[4] === 'none').map(s=> s[0])
  : sel === 'screen' ? design.rows.filter(r=> r.screen).map(r=> r.id) : sel === 'truths' ? design.rows.filter(r=> r.screen && r.kind === 'truth').map(r=> r.id)
  : sel === 'spheres' ? design.rows.filter(r=> r.screen && r.kind === 'sphere').map(r=> r.id) : sel.split(',');
const V = String(opt.v).split(',').map(s=> { const [k, d] = s.split('='); return { name: k, dir: path.resolve(HERE, d) }; });
const f = (x, d = 1) => x === Infinity ? '∞' : x === -Infinity ? '−∞' : x == null || !Number.isFinite(x) ? '—' : x.toFixed(d);
const pc = (x, d = 0) => x === Infinity ? '+∞' : x == null || !Number.isFinite(x) ? '—' : (100*x >= 0 ? '+' : '') + (100*x).toFixed(d) + ' %';
const num = x => typeof x === 'number' && !Number.isNaN(x);
const qtl = (xs, p) => { const s = xs.filter(num).sort((x, y)=> x - y); if (!s.length) return NaN; const i = (s.length - 1)*p, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi || s[lo] === s[hi] ? s[lo] : !Number.isFinite(s[hi]) || !Number.isFinite(s[lo]) ? (i - lo < 1e-12 ? s[lo] : s[hi]) : s[lo] + (s[hi] - s[lo])*(i - lo); };
const med = xs => qtl(xs, 0.5);
const mean = xs => { const s = xs.filter(Number.isFinite); return s.length ? s.reduce((t, x)=> t + x, 0)/s.length : NaN; };
const nInf = xs => xs.filter(x=> x === Infinity).length;
function digest(o, vname){
  const row = rowOf(o.row), T = o.records.find(r=> r.method === 'today' || r.method === 'hybrid'), R = o.records.find(r=> r.method === 'truth');
  const N = o.iso ? o.iso.N : NaN;
  const d = { v: vname, id: o.row, row, laue: o.laue, solid: row.solid, search: o.shape, err: row.error ? row.error.kind : 'none', iso: o.iso, wall: o.wall, line: o.line || { mode: 'lor' } };
  if (T){
    d.out = T.error ? 'error' : T.kept ? (T.held ? 'held' : 'free') : T.rejected ? (T.early ? 'early' : 'rejected') : 'none';
    d.dBIC = T.dBIC; d.sEv = T.search.evals + (T.extra && T.extra.end ? T.extra.end.evals : 0); d.sMs = T.search.ms + (T.extra && T.extra.end ? T.extra.end.ms : 0); d.extra = T.extra || null;   // (the hybrid: its WPPM end counted with the search)
     d.rEv = T.report ? T.report.evals : 0; d.rMs = T.report ? T.report.ms : 0;
    d.msEv = T.search.ms/Math.max(1, T.search.evals); d.chi2 = T.chi2Best; d.acc = T.acc || null; d.solidT = T.solid || null; d.TchiNu = T.chi2nu;
  }
  if (R){
    d.ref = { chi2: R.chi2Best, P: R.P, chi2nu: R.chi2nu, acc: R.acc || null, ms: R.ms, evals: R.evals, held: R.held, solid: R.solid || null };
    if (o.iso && Number.isFinite(R.chi2Best)) d.ref.dBIC = (R.chi2Best - o.iso.chi2)/Math.max(1, o.iso.chi2nu) + (R.P - o.iso.P)*Math.log(N);
  }
  const best = Math.min(...[d.chi2, d.ref && d.ref.chi2].filter(Number.isFinite));
  if (row.kind === 'truth' && d.ref && d.out && d.out !== 'early' && Number.isFinite(d.chi2) && Number.isFinite(best)){
    const Pb = d.ref.chi2 === best ? d.ref.P : (T && T.P) || d.ref.P;
    d.delta = (d.chi2 - best)/Math.max(1, best/Math.max(1, N - Pb));
  }
  if (row.kind === 'truth'){
    const ord = [0, 1, 2].sort((p, q)=> row.dims[p] - row.dims[q]);
    const by = acc => acc ? ord.map(i=> acc.dimErr[i]) : null;
    d.dimT = by(d.acc); d.dimR = d.ref ? by(d.ref.acc) : null;
  }
  return d;
}
const D = [];
for (const v of V) for (const id of ids){
  const file = path.join(v.dir, id + '.json');
  if (!fs.existsSync(file)){ D.push({ v: v.name, id, missing: true, row: rowOf(id) }); continue; }
  D.push(digest(readResult(fs.readFileSync(file, 'utf8')), v.name));
}
const lines = [], sections = String(opt.sections || 'ref,search,spheres').split(',');
const LAUE = ['-1', '2/m', 'mmm', '4/m', '4/mmm', '-3', '-3m', '6/m', '6/mmm', 'm-3', 'm-3m'];
const rng3 = xs => `${pc(med(xs))} (${pc(qtl(xs, 0.1))}…${pc(qtl(xs, 0.9))})`;
const absMax = d => d.ref && d.ref.acc ? d.ref.acc.dimMax : NaN;
if (sections.includes('ref')){
  lines.push(`## Truth reference (${sel}: ${ids.length} rows)`, '', 'Signed extent errors (median, 10th–90th percentiles), worst extent (median, 90th), the most distinct axis (°, median, 90th), χ²_ν, ΔBIC against the variant\'s own isotropic fit (median; count over −10 = not supported even from the truth).', '');
  for (const grp of [['all', d=> true], ['clean', d=> d.err === 'none'], ['error', d=> d.err !== 'none']]){
    lines.push(`**${grp[0]}**`, '', '| variant | runs | thinnest | middle | longest | worst (90 %) | unbounded | axis ° (90 %) | χ²_ν | ref ΔBIC | ref ΔBIC > −10 |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const v of V){
      const g = D.filter(d=> d.v === v.name && !d.missing && d.row.kind === 'truth' && d.ref && grp[1](d));
      if (!g.length) continue;
      const col = j => g.map(d=> d.dimR ? d.dimR[j] : NaN), ax = g.map(d=> d.ref.acc ? d.ref.acc.principal : NaN), wm = g.map(absMax);
      lines.push(`| ${v.name} | ${g.length} | ${rng3(col(0))} | ${rng3(col(1))} | ${rng3(col(2))} | ${pc(med(wm))} (${pc(qtl(wm, 0.9))}) | ${nInf(wm)} | ${f(med(ax))} (${f(qtl(ax, 0.9))}) | ${f(med(g.map(d=> d.ref.chi2nu)), 2)} | ${f(med(g.map(d=> d.ref.dBIC)), 0)} | ${g.filter(d=> !(d.ref.dBIC < -10)).length} |`);
    }
    lines.push('');
  }
  lines.push('Anisotropy (longest/thinnest read ÷ true) and the axis (°) per Laue class, clean rows of the list; per row when one:', '', `| class | runs | ${V.map(v=> v.name).join(' | ')} |`, `|---|---|${V.map(()=> '---|').join('')}`);
  for (const l of LAUE){
    const per = V.map(v=> D.filter(d=> d.v === v.name && !d.missing && d.laue === l && d.err === 'none' && d.row.kind === 'truth' && d.dimR));
    if (!per[0].length) continue;
    lines.push(`| ${l} | ${per[0].length} | ${per.map(g=> { const an = g.map(d=> (1 + d.dimR[2])/(1 + d.dimR[0])), ax = g.map(d=> d.ref.acc.principal); return `${f(med(an), 2)} / ${f(med(ax))}°`; }).join(' | ')} |`);
  }
  lines.push('');
  lines.push(`| run | error | ${V.map(v=> v.name + ': thinnest, middle, longest; axis; χ²_ν; ΔBIC').join(' | ')} |`, `|---|---|${V.map(()=> '---|').join('')}`);
  for (const id of ids){
    const row = rowOf(id); if (row.kind !== 'truth') continue;
    lines.push(`| ${id} | ${row.error ? row.error.kind : 'none'} | ${V.map(v=> { const d = D.find(x=> x.v === v.name && x.id === id); return !d || d.missing || !d.dimR ? '—' : `${d.dimR.map(x=> pc(x)).join(', ')}; ${f(d.ref.acc.principal)}°; ${f(d.ref.chi2nu, 2)}; ${f(d.ref.dBIC, 0)}`; }).join(' | ')} |`);
  }
  lines.push('');
}
if (sections.includes('search')){
  lines.push(`## Today's search with each line (${sel})`, '', 'Outcome; reach (Δ ≤ 1 against the variant\'s own truth reference, early rejections not judged); kept solids\' worst extent (median, 90th), thinnest, axis (median, 90th); evaluations and seconds (means); ms per evaluation (median).', '');
  lines.push('| variant | runs | held | free | rejected (early) | reached / judged | unbounded | worst (90 %) | thinnest | axis ° (90 %) | search ev | search s | report s | iso s | ms/ev |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const v of V){
    const g = D.filter(d=> d.v === v.name && !d.missing && d.row.kind === 'truth' && d.out);
    if (!g.length) continue;
    const judged = g.filter(d=> Number.isFinite(d.delta)), kept = g.filter(d=> d.acc);
    lines.push(`| ${v.name} | ${g.length} | ${g.filter(d=> d.out === 'held').length} | ${g.filter(d=> d.out === 'free').length} | ${g.filter(d=> d.out === 'rejected' || d.out === 'early').length} (${g.filter(d=> d.out === 'early').length}) | ${judged.filter(d=> d.delta <= 1).length} / ${judged.length} | ${nInf(kept.map(d=> d.acc.dimMax))} | ${pc(med(kept.map(d=> d.acc.dimMax)))} (${pc(qtl(kept.map(d=> d.acc.dimMax), 0.9))}) | ${pc(med(kept.map(d=> d.dimT[0])))} | ${f(med(kept.map(d=> d.acc.principal)))} (${f(qtl(kept.map(d=> d.acc.principal), 0.9))}) | ${f(mean(g.map(d=> d.sEv)), 0)} | ${f(mean(g.map(d=> d.sMs/1000)))} | ${f(mean(g.map(d=> d.rMs/1000)))} | ${f(mean(g.map(d=> d.iso.ms/1000)))} | ${f(med(g.map(d=> d.msEv)))} |`);
  }
  lines.push('', `| run | ${V.map(v=> v.name + ': outcome, ΔBIC, Δ, worst, thinnest, axis').join(' | ')} |`, `|---|${V.map(()=> '---|').join('')}`);
  for (const id of ids){
    const row = rowOf(id); if (row.kind !== 'truth') continue;
    lines.push(`| ${id} | ${V.map(v=> { const d = D.find(x=> x.v === v.name && x.id === id); return !d || d.missing || !d.out ? '—' : `${d.out}, ${f(d.dBIC, 0)}, ${f(d.delta, 1)}, ${d.acc ? pc(d.acc.dimMax) + ', ' + pc(d.dimT[0]) + ', ' + f(d.acc.principal) + '°' : '—'}`; }).join(' | ')} |`);
  }
  lines.push('');
}
if (sections.includes('spheres')){
  const sp = ids.filter(id=> rowOf(id).kind === 'sphere');
  if (sp.length){
    lines.push('## Spheres', '', `| sphere | D nm | searched as | error | ${V.map(v=> v.name + ': outcome, ΔBIC, iso χ²_ν').join(' | ')} |`, `|---|---|---|---|${V.map(()=> '---|').join('')}`);
    for (const id of sp){
      const row = rowOf(id);
      lines.push(`| ${id} | ${f(row.D)} | ${row.search} | ${row.error ? row.error.kind : 'none'} | ${V.map(v=> { const d = D.find(x=> x.v === v.name && x.id === id); return !d || d.missing || !d.out ? '—' : `${d.out}, ${f(d.dBIC, 0)}, ${f(d.iso.chi2nu, 2)}`; }).join(' | ')} |`);
    }
    lines.push('', `Kept: ${V.map(v=> v.name + ' ' + D.filter(d=> d.v === v.name && !d.missing && d.row.kind === 'sphere' && (d.out === 'held' || d.out === 'free')).length + ' of ' + D.filter(d=> d.v === v.name && !d.missing && d.row.kind === 'sphere' && d.out).length).join(', ')}.`, '');
  }
}
const miss = D.filter(d=> d.missing).map(d=> d.v + ':' + d.id);
if (miss.length) lines.push(`Missing: ${miss.join(', ')}`, '');
const text = lines.join('\n') + '\n';
if (opt.out) fs.writeFileSync(opt.out, text);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(D.map(({ row, solidT, ...d })=> d), (k, v)=> typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));
console.log(text);
